// Own every process/database. Never copy application credentials into test workers.
import { mkdtemp, rm, readdir, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";
import { build } from "esbuild";

const env = Object.fromEntries(["PATH","HOME","LANG","TZ","TMPDIR","LD_LIBRARY_PATH",
  "PLAYWRIGHT_EXECUTABLE_PATH","PLAYWRIGHT_BROWSERS_PATH"].filter(k => process.env[k]).map(k => [k,process.env[k]]));
const root = await mkdtemp(join(tmpdir(),"onspot-hiring-payment-"));
const data = join(root,"data");
const socket = createServer();
await new Promise(r => socket.listen(0,"127.0.0.1",r));
const port = socket.address().port;
await new Promise(r => socket.close(r));
let postgres;
function run(command,args,extra = {}) {
  return new Promise((res,rej) => {
    const child = spawn(command,args,{ env:{...env,...extra},stdio:"inherit" });
    child.once("error",rej);
    child.once("exit",code => code === 0 ? res() : rej(new Error(`${command} exited ${code}`)));
  });
}
try {
  await run("initdb",["-D",data,"-U","hiring_fixture","-A","trust","--no-locale"]);
  postgres = spawn("postgres",["-D",data,"-h","127.0.0.1","-p",String(port),"-k",root],{env,stdio:["ignore","ignore","inherit"]});
  const admin = `postgresql://hiring_fixture@127.0.0.1:${port}/postgres`;
  let ready = false;
  for (let i=0;i<60;i++) {
    const connection = new pg.Client({connectionString:admin});
    try { await connection.connect(); await connection.query("CREATE DATABASE onspot_hiring_test"); ready=true; break; }
    catch { await new Promise(r => setTimeout(r,100)); }
    finally { await connection.end().catch(()=>{}); }
  }
  if (!ready) throw new Error("Disposable PostgreSQL failed to start");
  const url = `postgresql://hiring_fixture@127.0.0.1:${port}/onspot_hiring_test`;
  const workerEnv = { DATABASE_URL:url,HIRING_FLOW_TEST_DATABASE_URL:url,JWT_SECRET:"hiring-payment-fixture-only",DISABLE_AUTH:"false" };
  const schema = join(root,"schema");
  await run(process.execPath,["node_modules/drizzle-kit/bin.cjs","generate","--dialect","postgresql","--schema","./shared/schema.ts","--out",schema],workerEnv);
  const db = new pg.Client({connectionString:url});
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("CREATE TEMP TABLE fixture_bootstrap(id integer)");
    await db.query(await readFile("scripts/migration-reconciliation.sql","utf8"));
    await db.query("SET LOCAL search_path=public,pg_catalog");
    const migrations = [];
    for (const name of (await readdir("migrations")).filter(n=>n.endsWith(".sql") && Number(n.slice(0,4))>=18 && Number(n.slice(0,4))<=37).sort()) {
      migrations.push(await readFile(join("migrations",name),"utf8"));
    }
    const sqlOwned = new Set(migrations.flatMap(sql =>
      [...sql.matchAll(/pg_temp\.reconcile_table\(\s*'public\.([a-z_]+)'/g)].map(m=>m[1])));
    const deferredReferences = [];
    for (const name of (await readdir(schema)).filter(n=>n.endsWith(".sql")).sort()) {
      // For SQL-owned financial tables, build from their versioned definitions
      // instead of incompatible ORM final-state defaults. Do not weaken guards.
      for (const statement of (await readFile(join(schema,name),"utf8")).split("--> statement-breakpoint")) {
        const table = statement.match(/(?:CREATE TABLE|ALTER TABLE)\s+"([^"]+)"/)?.[1]
          ?? statement.match(/CREATE (?:UNIQUE )?INDEX .* ON "([^"]+)"/)?.[1];
        if (table && sqlOwned.has(table)) continue;
        if (/^\s*CREATE INDEX\s/.test(statement)) continue;
        const referenced = statement.match(/REFERENCES "(?:public"\.")?([^"]+)"/)?.[1];
        if (referenced && sqlOwned.has(referenced)) { deferredReferences.push(statement); continue; }
        if(statement.trim()) await db.query(statement);
      }
    }
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_sub_role text");
    for (const sql of migrations) await db.query(sql);
    for (const sql of deferredReferences) await db.query(sql);
    await db.query("COMMIT");
  } catch(e) { await db.query("ROLLBACK"); throw e; } finally { await db.end(); }
  // Run the existing real signing/contract regression before adding the new gate.
  // Its fixture deliberately manufactures accepted offers, which are now forbidden.
  if (!process.argv.includes("--payments-only") && !process.argv.includes("--regressions-only")) {
    await run(process.execPath,["--import","tsx","scripts/verify-hiring-flow.ts","contracts"],workerEnv);
  }
  await symlink(resolve("node_modules"),join(root,"node_modules"),"dir");
  const entries = process.argv.includes("--regressions-only") ? [
    "server/tests/talent-invoice-calculations.test.ts",
    "server/tests/talent-invoices-usd-guard.test.ts",
    "server/tests/ledger-currency-summary.test.ts",
    "server/tests/client-team-dashboard.test.ts",
    "server/tests/client-team-dashboard-activity.test.ts",
  ] : ["server/tests/hiring-payments.fixture.ts"];
  for (const [index,entry] of entries.entries()) {
    const output = join(root,`fixture-${index}.mjs`);
    await build({
    entryPoints:[entry],outfile:output,
    bundle:true,platform:"node",format:"esm",packages:"external",target:"node22",
    plugins:[{name:"owned-database-only",setup(builder) {
      builder.onLoad({filter:/client-team-dashboard-activity\.test\.ts$/},async args => ({
        contents:(await readFile(args.path,"utf8")).replaceAll("import.meta.url",JSON.stringify(pathToFileURL(args.path).href)),
        loader:"ts",resolveDir:dirname(args.path),
      }));
      builder.onResolve({filter:/(?:^|\/)db(?:\.[jt]s)?$/},args => {
        const file = resolve(args.resolveDir,args.path.replace(/\.[jt]s$/,""));
        return file===resolve("server/db") ? {path:resolve("server/tests/fixtures/hiring-db.ts")} : undefined;
      });
    }}],
  });
    await run(process.execPath,["--test",output],workerEnv);
  }
} finally {
  if (postgres && postgres.exitCode===null) {
    const stopped = new Promise(r=>postgres.once("exit",r));
    postgres.kill("SIGTERM"); await stopped;
  }
  await rm(root,{recursive:true,force:true});
}
