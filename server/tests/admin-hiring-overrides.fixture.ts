/** Real owned PostgreSQL and HTTP routes; synthetic authenticated identities. */
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import type {Server} from "node:http";
import express from "express";
import {pool,query} from "./fixtures/hiring-db";
import {AdminHiringOverrideService,HIRING_OVERRIDE_ACTIONS} from "../services/adminHiringOverrideService";
import {registerAdminHiringOverrideRoutes} from "../routes/adminHiringOverrides";
import {onboardingStatus} from "../services/contractorOnboardingStatus";
import {requirePaidContract,requireHiringStage} from "../services/contractorOnboardingPolicy";
import {clientTeamDashboardSqlForTests} from "../lib/clientTeamDashboardHandler";
import {TIMESHEET_HIRE_SQL} from "../services/timesheetEligibility";
const admin=`override-admin-${randomUUID()}`,ta=`override-ta-${randomUUID()}`,cs=`override-cs-${randomUUID()}`,
  client=`override-client-${randomUUID()}`,talent=`override-talent-${randomUUID()}`,talent2=`override-talent-${randomUUID()}`,job=`override-job-${randomUUID()}`;
const service=new AdminHiringOverrideService(pool);
let server:Server,base:string;
before(async()=>{
  for(const [id,role,sub] of [[admin,"admin",null],[ta,"admin","talent_acquisition"],[cs,"admin","client_success"],[client,"client",null],[talent,"talent",null],[talent2,"talent",null]])
    await query("INSERT INTO users(id,email,role,admin_sub_role) VALUES($1,$2,$3,$4)",[id,`${id}@fixture.invalid`,role,sub]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Override fixture','No real hiring','Operations','Intermediate','open','approved','Standard','tracked')`,[job,client]);
  const app=express();app.use(express.json());
  // This is an explicit fixture identity adapter, not production sign-in UAT.
  const auth:any=(req:any,res:any,next:any)=>{req.user={id:req.get("x-fixture-actor")};req.user.id?next():res.sendStatus(401);};
  registerAdminHiringOverrideRoutes(app,service,auth,(_req,_res,next)=>next(),(_req,_res,next)=>next());
  server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  base=`http://127.0.0.1:${(server.address() as any).port}`;
});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
const reason="Explicit synthetic business exception for isolated testing";
const terms={rate:2500,currency:"USD",startDate:"2099-01-01"};
async function app() {
  const id=(await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,status,workflow_type,initiated_by,registration_status)
    VALUES($1,$2,$3,$4,'Fixture','new','application','talent','linked') RETURNING id`,[job,client,talent,`${talent}@fixture.invalid`])).rows[0].id;
  await query(`INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status) VALUES($1,2,'new')
    ON CONFLICT(submission_id) DO UPDATE SET workflow_version=2`,[id]);
  return id;
}
test("Clients and Talent receive 403 on every override endpoint, including capabilities/history",async()=>{
  for(const actor of [client,talent])for(const path of ["capabilities","",...HIRING_OVERRIDE_ACTIONS]) {
    const method=HIRING_OVERRIDE_ACTIONS.includes(path as any)?"POST":"GET";
    const response=await fetch(`${base}/api/admin/hiring-overrides${path?`/${path}`:""}`,{method,
      headers:{"x-fixture-actor":actor,"Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify({reason})}:{})});
    assert.equal(response.status,403,`${actor} ${path}`);
  }
  assert.equal((await query("SELECT count(*)::int n FROM admin_hiring_overrides")).rows[0].n,0);
});
test("Stage overrides and safe reversal write immutable audit/history; Final override does not fabricate interviews",async()=>{
  const id=await app();
  await assert.rejects(service.execute(admin,"skip_stage",{submissionId:id,targetStatus:"shortlisted",reason:"short"}),(e:any)=>e.code==="REASON_REQUIRED");
  await service.execute(admin,"skip_stage",{submissionId:id,targetStatus:"shortlisted",reason});
  await service.execute(admin,"revert_override",{submissionId:id,reason});
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"new");
  await service.execute(admin,"skip_stage",{submissionId:id,targetStatus:"final_interview_passed",reason,notifyParties:true});
  const status=await onboardingStatus(pool,id,client);
  assert.equal(status.finalInterviewPassed,true);assert.equal(status.canSendOffer,true);
  assert.equal(status.stages.find(s=>s.key==="final_interview")?.overridden,true);
  assert.equal((await query("SELECT count(*)::int n FROM interviews WHERE submission_id=$1",[id])).rows[0].n,0);
  const db=await pool.connect();
  try {await db.query("BEGIN");await requireHiringStage(db,id,"offer",client);await db.query("COMMIT");}
  finally {db.release();}
  assert.equal((await service.history(admin,id)).items.length,3);
  assert.equal((await query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1 AND note LIKE 'Admin override:%'",[id])).rows[0].n,3);
});
test("Accepted-stage override creates an invoice-first offer; waiver unblocks agreements without proof or claimed funds; explicit signature bypass activates",async()=>{
  const id=await app();
  await service.execute(admin,"skip_stage",{submissionId:id,targetStatus:"offer_accepted",reason,...terms});
  const d=(await query("SELECT * FROM security_deposits WHERE submission_id=$1",[id])).rows[0];
  assert.equal(d.status,"pending");
  const db=await pool.connect();
  try {
    await db.query("BEGIN");
    await assert.rejects(requirePaidContract(db,d.offer_id,id),(e:any)=>e.code==="DEPOSIT_PAYMENT_REQUIRED");
    await db.query("ROLLBACK");
  }finally {db.release();}
  await query("INSERT INTO manual_wise_obligations(category,deposit_id,payer_id) VALUES('deposit',$1,$2) ON CONFLICT(deposit_id) DO NOTHING",[d.id,client]);
  await service.execute(admin,"waive_deposit",{submissionId:id,depositId:d.id,reason});
  const waived=(await query("SELECT * FROM security_deposits WHERE id=$1",[d.id])).rows[0];
  assert.equal(waived.status,"waived");assert.equal(waived.held_at,null);assert.equal(waived.waived_by,admin);
  assert.ok((await query("SELECT cancelled_at FROM manual_wise_obligations WHERE deposit_id=$1",[d.id])).rows[0].cancelled_at);
  await requirePaidContract(pool,d.offer_id,id);
  await service.execute(admin,"skip_agreements",{submissionId:id,reason,skipContractorAgreement:true,skipMsa:true});
  const hc=(await query("SELECT * FROM hiring_contracts WHERE submission_id=$1",[id])).rows[0];
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"hired");
  assert.ok(hc.activation_override_id);assert.ok(hc.billing_activated_at);
  assert.equal(hc.onspot_signed_at,null);assert.equal(hc.talent_signed_at,null);
  assert.equal((await query("SELECT count(*)::int n FROM client_msa_signatures WHERE client_id=$1",[client])).rows[0].n,0);
  assert.equal((await onboardingStatus(pool,id,client)).deposit?.paymentStatus,"waived");
  assert.equal((await query(`SELECT hc.id FROM hiring_contracts hc JOIN job_submissions js ON js.id=hc.submission_id
    WHERE hc.id=$1 AND ${TIMESHEET_HIRE_SQL}`,[hc.id])).rows.length,1);
  await assert.rejects(service.execute(admin,"revert_override",{submissionId:id,reason}),(e:any)=>e.code==="UNSAFE_REVERSAL");
});
test("Direct placements appear in the real authorized-client Team query; required deposits stay pending; no fake signatures",async()=>{
  const result=await service.execute(admin,"direct_placement",{clientId:client,talentId:talent2,jobId:job,depositPolicy:"require",reason,...terms});
  const org=randomUUID();
  await query("INSERT INTO organizations(id,name,created_by) VALUES($1,'Fixture organization',$2)",[org,client]);
  await query("INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'owner','active')",[org,client]);
  const rows=(await query(clientTeamDashboardSqlForTests.members,[org,new Date(),client])).rows;
  assert.ok(rows.some(r=>r.talent_id===talent2));
  const s=(await query("SELECT * FROM job_submissions WHERE id=$1",[result.submissionId])).rows[0];
  assert.equal(s.workflow_type,"client_invitation");assert.equal(s.admin_direct_placement,true);assert.equal(s.status,"offer_accepted");
  const hc=(await query("SELECT * FROM hiring_contracts WHERE submission_id=$1",[s.id])).rows[0];
  assert.equal(hc.billing_activated_at,null);assert.equal(hc.talent_signed_at,null);
  await service.execute(admin,"waive_deposit",{submissionId:s.id,reason});
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[s.id])).rows[0].status,"hired");
  assert.equal((await service.history(admin,s.id)).items.length,2);
});
test("Every regular admin can use the four authorized overrides through HTTP; reversal remains Super Admin-only",async()=>{
  for(const actor of [ta,cs]) {
    const capability=await fetch(`${base}/api/admin/hiring-overrides/capabilities`,{headers:{"x-fixture-actor":actor}});
    assert.equal(capability.status,200);
    assert.deepEqual(await capability.json(),{canManage:true,canRevert:false});
    const id=await app();
    for(const [action,body] of [
      ["skip_stage",{submissionId:id,targetStatus:"offer_accepted",...terms}],
      ["waive_deposit",{submissionId:id}],
      ["skip_agreements",{submissionId:id,skipContractorAgreement:true,skipMsa:true}],
    ] as const) {
      const response=await fetch(`${base}/api/admin/hiring-overrides/${action}`,{method:"POST",
        headers:{"x-fixture-actor":actor,"Content-Type":"application/json"},body:JSON.stringify({...body,reason})});
      assert.equal(response.status,200,await response.text());
    }
    assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"hired");
    assert.equal((await service.history(actor,id)).items.length,3);
    await assert.rejects(service.execute(actor,"revert_override",{submissionId:id,reason}),(e:any)=>e.status===403);
    const placedTalent=`override-placed-${randomUUID()}`;
    await query("INSERT INTO users(id,email,role) VALUES($1,$2,'talent')",[placedTalent,`${placedTalent}@fixture.invalid`]);
    const placed=await fetch(`${base}/api/admin/hiring-overrides/direct_placement`,{method:"POST",
      headers:{"x-fixture-actor":actor,"Content-Type":"application/json"},
      body:JSON.stringify({clientId:client,talentId:placedTalent,jobId:job,reason,...terms})});
    assert.equal(placed.status,200);
    const result=await placed.json() as any;
    assert.equal(result.status,"hired");
    const contract=(await query("SELECT * FROM hiring_contracts WHERE submission_id=$1",[result.submissionId])).rows[0];
    assert.ok(contract.billing_activated_at);assert.ok(contract.activation_override_id);
    assert.equal(contract.onspot_signed_at,null);assert.equal(contract.talent_signed_at,null);
    const org=randomUUID();
    await query("INSERT INTO organizations(id,name,created_by) VALUES($1,'Override Team UAT',$2)",[org,client]);
    await query("INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'owner','active')",[org,client]);
    const team=(await query(clientTeamDashboardSqlForTests.members,[org,new Date(),client])).rows;
    assert.ok(team.some(row=>row.talent_id===placedTalent),"immediate direct placement appears in authorized Client Team");
  }
});
test("Missing accepted-offer deposit is issued and waived atomically, once, without cash or signatures",async()=>{
  const id=await app();
  await query("UPDATE job_submissions SET status='offer_accepted' WHERE id=$1",[id]);
  const offer=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date,accepted_at)
    VALUES($1,'accepted',2500,'USD','Standard','tracked','2099-01-01',now()) RETURNING id`,[id])).rows[0];
  await assert.rejects(service.execute(ta,"waive_deposit",{submissionId:id,reason:"short"}),(e:any)=>e.code==="REASON_REQUIRED");
  assert.equal((await query("SELECT count(*)::int n FROM security_deposits WHERE submission_id=$1",[id])).rows[0].n,0);
  const results=await Promise.allSettled([ta,cs].map(actor=>service.execute(actor,"waive_deposit",{submissionId:id,reason})));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  const deposits=(await query("SELECT * FROM security_deposits WHERE submission_id=$1",[id])).rows;
  assert.equal(deposits.length,1);
  const d=deposits[0];assert.equal(d.offer_id,offer.id);assert.equal(d.status,"waived");
  assert.equal(d.held_at,null);assert.ok(d.hiring_contract_id);
  assert.equal((await service.history(ta,id)).items.length,1);
  await requirePaidContract(pool,offer.id,id);
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"offer_accepted");
  const hc=(await query("SELECT * FROM hiring_contracts WHERE id=$1",[d.hiring_contract_id])).rows[0];
  assert.equal(hc.talent_signed_at,null);assert.equal(hc.onspot_signed_at,null);assert.equal(hc.billing_activated_at,null);
  assert.ok((await query("SELECT cancelled_at FROM manual_wise_obligations WHERE deposit_id=$1",[d.id])).rows[0].cancelled_at);
});
test("Regular admin Hire now activates from early and offer stages with explicit audit and no invented evidence",async()=>{
  for(const stage of ["new","shortlisted","interviewing","offer_extended","offer_accepted"]) {
    const id=await app();
    await query("UPDATE job_submissions SET status=$2 WHERE id=$1",[id,stage]);
    let original:string|undefined;
    if(["offer_extended","offer_accepted"].includes(stage)) {
      original=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date)
        VALUES($1,$2,2500,'USD','Standard','tracked','2099-01-01') RETURNING id`,[id,stage==="offer_extended"?"sent":"accepted"])).rows[0].id;
    }
    const result=await service.execute(cs,"skip_stage",{submissionId:id,targetStatus:"hired",reason,...terms});
    assert.equal(result.status,"hired",stage);
    const d=(await query("SELECT * FROM security_deposits WHERE submission_id=$1",[id])).rows[0];
    assert.equal(d.status,"waived");assert.equal(d.held_at,null);
    if(stage==="offer_extended")assert.equal((await query("SELECT status FROM offers WHERE id=$1",[original])).rows[0].status,"withdrawn");
    const hc=(await query("SELECT * FROM hiring_contracts WHERE submission_id=$1",[id])).rows[0];
    assert.ok(hc.activation_override_id);assert.ok(hc.billing_activated_at);
    assert.equal(hc.onspot_signed_at,null);assert.equal(hc.talent_signed_at,null);
    assert.equal((await query("SELECT count(*)::int n FROM interviews WHERE submission_id=$1",[id])).rows[0].n,0);
    assert.equal((await query("SELECT count(*)::int n FROM admin_hiring_overrides WHERE submission_id=$1 AND actor_id=$2",[id,cs])).rows[0].n,1);
    assert.equal((await query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1 AND new_status='hired'",[id])).rows[0].n>=1,true);
  }
});
test("Migration is idempotent and does not destroy any deposit financial evidence",async()=>{
  const before=(await query("SELECT id,amount,currency,status,held_at,waived_at FROM security_deposits ORDER BY id")).rows;
  await query(readFileSync("migrations/0051_admin_hiring_overrides.sql","utf8"));
  await query(readFileSync("migrations/0051_admin_hiring_overrides.sql","utf8"));
  await query(readFileSync("migrations/0054_admin_deposit_waiver_activation.sql","utf8"));
  await query(readFileSync("migrations/0054_admin_deposit_waiver_activation.sql","utf8"));
  const fingerprint=(await query("SELECT md5(pg_get_functiondef('public.prevent_signed_contract_billing_start_change()'::regprocedure)) AS hash")).rows[0].hash;
  assert.ok(readFileSync("scripts/migration-reconciliation.sql","utf8").includes(`'${fingerprint}'`),"reconciliation recognizes the canonical current guard without accepting arbitrary functions");
  assert.deepEqual((await query("SELECT id,amount,currency,status,held_at,waived_at FROM security_deposits ORDER BY id")).rows,before);
});
