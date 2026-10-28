/**
 * No live connection support. Reads a read-only catalog export, then owns and
 * destroys an isolated local PostgreSQL cluster. Never reads DATABASE_URL.
 * Usage: node scripts/dry-run-onboarding-migrations.mjs /tmp/catalog.json
 */
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import pg from "pg";

const snapshot=JSON.parse(await readFile(process.argv[2],"utf8"));
const env=Object.fromEntries(["PATH","HOME","LANG","LD_LIBRARY_PATH","NIX_LD","NIX_LD_LIBRARY_PATH",
  "LD_AUDIT","REPLIT_LD_AUDIT","REPLIT_LD_LIBRARY_PATH"].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const root=await mkdtemp(join(tmpdir(),"onspot-migration-dry-run-"));
const probe=createServer();
await new Promise(r=>probe.listen(0,"127.0.0.1",r));
const port=probe.address().port;
await new Promise(r=>probe.close(r));
let child,db;
async function run(cmd,args) {
  await new Promise((res,rej)=>{
    const p=spawn(cmd,args,{env,stdio:"ignore"});
    p.once("error",rej);p.once("exit",c=>c===0?res():rej(new Error(`${cmd} failed: ${c}`)));
  });
}
try {
  await run("initdb",["-D",join(root,"data"),"-U","migration_fixture","-A","trust","--no-locale"]);
  child=spawn("postgres",["-D",join(root,"data"),"-h","127.0.0.1","-p",String(port),"-k",root],{env,stdio:"ignore"});
  for(let attempt=0;attempt<100;attempt++) {
    db=new pg.Client({host:"127.0.0.1",port,user:"migration_fixture",database:"postgres"});
    try {await db.connect();break;} catch(e) {await db.end().catch(()=>{});if(attempt===99)throw e;await new Promise(r=>setTimeout(r,100));}
  }
  await db.query("SET check_function_bodies=false");
  for(const sql of snapshot.enums??[])await db.query(sql);
  for(const sql of snapshot.sequences??[])await db.query(sql);
  for(const t of snapshot.tables)await db.query(t.sql);
  for(const sql of snapshot.functions??[])await db.query(sql);
  for(const c of snapshot.constraints.filter(c=>c.kind!=="f"))await db.query(c.sql);
  for(const c of snapshot.constraints.filter(c=>c.kind==="f"))await db.query(c.sql);
  for(const sql of snapshot.indexes??[])await db.query(sql);
  for(const sql of snapshot.triggers??[])await db.query(sql);
  // Exact ledger values, no user/client rows or personal data copied.
  // Replica mode only in THIS disposable cluster avoids copying personal parent
  // records for the ledger FK chain. FKs remain installed in the schema.
  await db.query("SET session_replication_role=replica");
  for(const row of snapshot.deposits??[]) {
    const columns=Object.keys(row);
    assert.ok(columns.every(c=>/^[a-z_]+$/.test(c)));
    await db.query(`INSERT INTO security_deposits(${columns.join(",")}) VALUES(${columns.map((_,i)=>`$${i+1}`).join(",")})`,Object.values(row));
  }
  await db.query("SET session_replication_role=origin");
  const baseline=(await db.query("SELECT id,to_jsonb(d) AS row FROM security_deposits d ORDER BY id")).rows;
  const catalog=async()=>(await db.query(`SELECT 'column' AS kind,table_name||'.'||column_name AS name FROM information_schema.columns
    WHERE table_schema='public' UNION ALL SELECT 'table',tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1,2`)).rows;
  const before=await catalog();
  const definitions=async()=>(await db.query(`SELECT jsonb_build_object(
    'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM information_schema.columns c WHERE table_schema='public'),
    'constraints',(SELECT jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conrelid::regclass::text,k.conname) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
    'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'),
    'indexes',(SELECT jsonb_agg(indexdef ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
    'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgrelid::regclass::text,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal)
    ) AS snapshot`)).rows[0].snapshot;
  const originalDefinitions=await definitions();
  const sqls=await Promise.all(["0044_contractor_onboarding.sql","0045_onboarding_billing_activation.sql"].map(n=>readFile(join("migrations",n),"utf8")));
  // Transactional rollback rehearsal.
  await db.query("BEGIN");
  for(const sql of sqls)await db.query(sql);
  await db.query("ROLLBACK");
  assert.deepEqual(await catalog(),before);
  assert.deepEqual(await definitions(),originalDefinitions);
  let firstDefinitions;
  for(let pass=1;pass<=2;pass++) {
    await db.query("BEGIN");
    for(const sql of sqls)await db.query(sql);
    await db.query("COMMIT");
    // Compare only original columns: newly added nullable columns are expected.
    for(const old of baseline) {
      const current=(await db.query("SELECT to_jsonb(d) AS row FROM security_deposits d WHERE id=$1",[old.id])).rows[0]?.row;
      assert.ok(current,`Missing original deposit ${old.id}`);
      for(const [key,value] of Object.entries(old.row))assert.deepEqual(current[key],value,`${old.id}.${key}`);
    }
    assert.equal((await db.query("SELECT count(*)::int n FROM security_deposits")).rows[0].n,baseline.length);
    const after=await catalog();
    for(const old of before)assert.ok(after.some(c=>c.kind===old.kind&&c.name===old.name),`Removed ${old.name}`);
    if(pass===1)firstDefinitions=await definitions();
    else assert.deepEqual(await definitions(),firstDefinitions,"Reapplication changed schema definitions");
    console.log(`PASS ${pass}: existing tables/columns retained; ${baseline.length} exact deposit row(s) unchanged`);
  }
  console.log("PASS: both migrations reapplied; transactional rollback restored original catalog");
  console.log(`Scope: live catalog copy of ${snapshot.tables.length} public base tables; exact ledger rows; no personal parent data, no live writes.`);
} finally {
  await db?.end().catch(()=>{});
  if(child) {const done=new Promise(r=>child.once("exit",r));child.kill("SIGTERM");await done;}
  await rm(root,{recursive:true,force:true});
}
