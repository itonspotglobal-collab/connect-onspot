/**
 * Development-only, rollback UAT on an existing application. No sign-in is
 * simulated: this calls canonical services against real rows and triggers.
 * No COMMIT escapes the savepoint adapter, and no outbox event is dispatched.
 * Usage: NODE_ENV=development npx tsx scripts/verify-legacy-admin-overrides.ts <submission> <USD rate> <YYYY-MM-DD>
 */
import assert from "node:assert/strict";
import {pool} from "../server/db";
import {AdminHiringOverrideService} from "../server/services/adminHiringOverrideService";
import {loadClientFormalSubmission} from "../server/services/formalPipelineGuard";
import {FORMAL_PIPELINE_PREDICATE} from "../shared/formalPipelineSql";

if(process.env.NODE_ENV!=="development")throw new Error("Development-only verification; never run against production.");
const [id,rate,startDate]=process.argv.slice(2);
if(!id||!rate||!startDate)throw new Error("Provide the existing submission, explicitly approved USD rate and start date.");
const reason="Owner-authorized legacy development rollback UAT; no real money, signatures or notification delivery claimed";
const db=await pool.connect();
const adapter:any={
  query:(text:string,params?:any[])=>db.query(text,params),
  connect:async()=>({
    query:async(text:string,params?:any[])=>{
      if(text==="BEGIN")return db.query("SAVEPOINT override_uat");
      if(text==="COMMIT")return db.query("RELEASE SAVEPOINT override_uat");
      if(text==="ROLLBACK"){
        await db.query("ROLLBACK TO SAVEPOINT override_uat");
        return db.query("RELEASE SAVEPOINT override_uat");
      }
      return db.query(text,params);
    },
    release:()=>{},
  }),
};
const service=new AdminHiringOverrideService(adapter);
const results:any[]=[];
try {
  const actor=(await db.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")).rows[0]?.id;
  if(!actor)throw new Error("No existing database-confirmed Admin is available.");
  const original=(await db.query("SELECT status,client_id FROM job_submissions WHERE id=$1",[id])).rows[0];
  if(!original)throw new Error("Application not found.");
  for(const path of ["hire_now","skip_stage_then_agreements","contract_sent_then_agreements"]) {
    await db.query("BEGIN");
    try {
      assert.equal((await loadClientFormalSubmission(id,original.client_id,{txClient:db})).ok,false);
      const before=(await db.query("SELECT count(*)::int n FROM admin_hiring_overrides WHERE submission_id=$1",[id])).rows[0].n;
      const body={submissionId:id,rate,currency:"USD",startDate,reason,notifyParties:false};
      if(path==="hire_now")await service.execute(actor,"skip_stage",{...body,targetStatus:"hired"});
      else {
        await service.execute(actor,"skip_stage",{...body,targetStatus:path==="contract_sent_then_agreements"?"contract_sent":"offer_accepted"});
        await service.execute(actor,"waive_deposit",{submissionId:id,reason,notifyParties:false});
        await service.execute(actor,"skip_agreements",{submissionId:id,reason,notifyParties:false,skipContractorAgreement:true,skipMsa:true});
      }
      const s=(await db.query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0];
      const d=(await db.query("SELECT status,held_at FROM security_deposits WHERE submission_id=$1 ORDER BY created_at DESC LIMIT 1",[id])).rows[0];
      const c=(await db.query("SELECT talent_signed_at,onspot_signed_at,billing_activated_at FROM hiring_contracts WHERE submission_id=$1 ORDER BY created_at DESC LIMIT 1",[id])).rows[0];
      const audits=(await db.query("SELECT count(*)::int n FROM admin_hiring_overrides WHERE submission_id=$1",[id])).rows[0].n-before;
      assert.equal(s.status,"hired");assert.equal(d.status,"waived");assert.equal(d.held_at,null);
      assert.equal(c.talent_signed_at,null);assert.equal(c.onspot_signed_at,null);assert.ok(c.billing_activated_at);
      assert.equal(audits,path==="hire_now"?1:3);
      assert.equal((await loadClientFormalSubmission(id,original.client_id,{txClient:db})).ok,false);
      results.push({submissionId:id,path,status:s.status,deposit:"Waived",newAuditRows:audits,normalClientGuard:"denied",rolledBack:true});
    } finally {await db.query("ROLLBACK");}
    assert.equal((await db.query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,original.status);
  }
  const blocked=(await db.query(`SELECT js.id,js.client_id FROM job_submissions js
    WHERE js.status NOT IN ('rejected','withdrawn','declined')
      AND NOT (js.${FORMAL_PIPELINE_PREDICATE}) IS TRUE
      AND NOT EXISTS(SELECT 1 FROM users t WHERE t.id=js.talent_id AND t.role='talent') ORDER BY js.id`)).rows;
  for(const s of blocked) {
    await db.query("BEGIN");
    try {
      const before=(await db.query("SELECT count(*)::int n FROM admin_hiring_overrides WHERE submission_id=$1",[s.id])).rows[0].n;
      for(const action of ["skip_stage","waive_deposit","skip_agreements"])
        await assert.rejects(service.execute(actor,action,{submissionId:s.id,targetStatus:"hired",reason,rate,currency:"USD",startDate,skipContractorAgreement:true,skipMsa:true}),
          (e:any)=>e.code==="TALENT_ACCOUNT_REQUIRED");
      assert.equal((await loadClientFormalSubmission(s.id,s.client_id,{txClient:db})).ok,false);
      assert.equal((await db.query("SELECT count(*)::int n FROM admin_hiring_overrides WHERE submission_id=$1",[s.id])).rows[0].n,before);
      results.push({submissionId:s.id,actionsTested:3,result:"TALENT_ACCOUNT_REQUIRED",newAuditRows:0,normalClientGuard:"denied",rolledBack:true});
    } finally {await db.query("ROLLBACK");}
  }
  console.log(JSON.stringify({verification:"Real development rows and canonical services; not authenticated-browser UAT; all mutations rolled back",results},null,2));
} finally {
  await db.query("ROLLBACK").catch(()=>{});
  db.release();await pool.end();
}
