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
test("Clients, Talent, TA and Client Success receive 403 on every override endpoint, including capabilities/history",async()=>{
  for(const actor of [client,talent,ta,cs])for(const path of ["capabilities","",...HIRING_OVERRIDE_ACTIONS]) {
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
  assert.equal((await query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1 AND note LIKE 'Super Admin override:%'",[id])).rows[0].n,3);
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
test("Migration is idempotent and does not destroy any deposit financial evidence",async()=>{
  const before=(await query("SELECT id,amount,currency,status,held_at,waived_at FROM security_deposits ORDER BY id")).rows;
  await query(readFileSync("migrations/0051_admin_hiring_overrides.sql","utf8"));
  await query(readFileSync("migrations/0051_admin_hiring_overrides.sql","utf8"));
  assert.deepEqual((await query("SELECT id,amount,currency,status,held_at,waived_at FROM security_deposits ORDER BY id")).rows,before);
});
