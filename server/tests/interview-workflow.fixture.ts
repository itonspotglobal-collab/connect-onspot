/** Owned PostgreSQL only. Actors and Graph responses are synthetic, not external UAT. */
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {pool,query} from "./fixtures/hiring-db";
import {recordInterviewOutcome} from "../services/interviewOutcomeService";
import {syncInterviewCalendarAfterCommit} from "../services/interviewCalendarSync";
import {FindWorkCalendarError,synchronizeFindWorkInterview} from "../services/findWorkCalendarService";
import {onboardingStatus} from "../services/contractorOnboardingStatus";
import {requireHiringStage} from "../services/contractorOnboardingPolicy";
import {offerHandler} from "./fixtures/onboarding-offer-handlers";

const client=`interview-client-${randomUUID()}`,talent=`interview-talent-${randomUUID()}`;
const admin=`interview-admin-${randomUUID()}`,ta=`interview-ta-${randomUUID()}`,cs=`interview-cs-${randomUUID()}`;
const job=`interview-job-${randomUUID()}`,candidate=`interview-candidate-${randomUUID()}`;
before(async()=>{
  for(const [id,role,sub] of [[client,"client",null],[talent,"talent",null],[admin,"admin",null],[ta,"admin","talent_acquisition"],[cs,"admin","client_success"]])
    await query("INSERT INTO users(id,email,role,admin_sub_role) VALUES($1,$2,$3,$4)",[id,`${id}@fixture.invalid`,role,sub]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Interview workflow fixture','No real hiring','Operations','Intermediate','open','approved','Standard','tracked')`,[job,client]);
  await query("INSERT INTO candidates(id,user_id,email,first_name,last_name) VALUES($1,$2,$3,'Fixture','Talent')",[candidate,talent,`${talent}@fixture.invalid`]);
  await query(`INSERT INTO platform_settings(key,value) VALUES('HIRING_PRE_OFFER_PAYMENT_REQUIRED','false')
    ON CONFLICT(key) DO UPDATE SET value='false'`);
});
after(()=>pool.end());
async function app(status="interviewing") {
  return (await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,workflow_type,initiated_by,registration_status,status)
    VALUES($1,$2,$3,$4,'Fixture Talent','application','talent','linked',$5) RETURNING id`,
    [job,client,talent,`${talent}@fixture.invalid`,status])).rows[0].id as string;
}
async function interview(id:string,type="final",creator=client) {
  return (await query(`INSERT INTO interviews(submission_id,round_number,interview_type,status,confirmed_time,created_by)
    VALUES($1,1,$2,'confirmed',now()-interval '1 hour',$3) RETURNING *`,[id,type,creator])).rows[0];
}
const send=(id:string)=>offerHandler("post","/api/client/offers",client,candidate,
  {submissionId:id,rate:2500,rateCurrency:"USD",proposedStartDate:"2099-01-01",expiresAt:"2099-01-02"});
test("Client and recruiting Admin can record past Final Advance, unlock onboarding, and send a real offer",async()=>{
  for(const [actor,isAdmin] of [[client,false],[ta,true],[admin,true]] as const) {
    const id=await app(),i=await interview(id);
    assert.equal((await onboardingStatus(pool,id,client)).canSendOffer,false);
    await recordInterviewOutcome(pool,actor,i.id,{outcome:"advance"},false,isAdmin);
    const ready=await onboardingStatus(pool,id,client);
    assert.equal(ready.canSendOffer,true);assert.deepEqual(ready.offerBlockers,[]);
    assert.deepEqual(ready.activationMissing,[]);
    assert.equal((await send(id)).statusCode,201);
  }
});
test("Initial Advance keeps Final blocker; type edits lock; Pending can resolve once; role and future guards hold",async()=>{
  const id=await app(),i=await interview(id,"initial");
  await recordInterviewOutcome(pool,client,i.id,{outcome:"advance"});
  assert.deepEqual((await onboardingStatus(pool,id,client)).offerBlockers,["Schedule a Final round interview"]);
  assert.equal((await send(id)).statusCode,409);
  await assert.rejects(recordInterviewOutcome(pool,client,i.id,{interviewType:"final"},true),e=>(e as any).status===409);
  const other=await app(),pending=await interview(other,"initial");
  await recordInterviewOutcome(pool,ta,pending.id,{interviewType:"final"},true,true);
  await recordInterviewOutcome(pool,client,pending.id,{outcome:"pending"});
  await recordInterviewOutcome(pool,ta,pending.id,{outcome:"advance"},false,true);
  await assert.rejects(recordInterviewOutcome(pool,ta,pending.id,{outcome:"reject"},false,true),e=>(e as any).status===409);
  await assert.rejects(recordInterviewOutcome(pool,cs,pending.id,{outcome:"advance"},false,true),e=>(e as any).status===403);
  const future=await interview(await app());
  await query("UPDATE interviews SET confirmed_time=now()+interval '1 day' WHERE id=$1",[future.id]);
  await assert.rejects(recordInterviewOutcome(pool,client,future.id,{outcome:"advance"}),e=>(e as any).code==="INTERVIEW_NOT_STARTED");
  const gate=await app("new"),db=await pool.connect();
  try {await db.query("BEGIN");await requireHiringStage(db,gate,"interview",ta,"Approved recruiting exception");await db.query("COMMIT");}
  finally{db.release();}
  assert.equal((await query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1 AND changed_by=$2",[gate,ta])).rows[0].n,1);
});
test("Provider 403, timeout and shared conflict do not reverse confirmation; retry is serialized and idempotent",async()=>{
  for(const code of ["mailbox_inaccessible","calendar_event_failure","calendar_time_conflict"]) {
    const i=await interview(await app(),"final",admin);
    const fail=async()=>{
      if(code==="calendar_event_failure")throw Object.assign(new Error("Synthetic timeout"),{name:"AbortError"});
      throw new FindWorkCalendarError(code,"Synthetic provider failure");
    };
    await syncInterviewCalendarAfterCommit(pool,i.id,true,fail);
    await syncInterviewCalendarAfterCommit(pool,i.id,true,fail);
    const saved=(await query("SELECT * FROM interviews WHERE id=$1",[i.id])).rows[0];
    assert.equal(saved.status,"confirmed");assert.equal(saved.calendar_sync_status,"failed");
    assert.equal(saved.calendar_sync_error,code);
    const notes=(await query(`SELECT user_id,count(*)::int n FROM notifications
      WHERE event_key LIKE $1 GROUP BY user_id`,[`interview-calendar-failed:${i.id}:%`])).rows;
    assert.ok(notes.length>=2);assert.ok(notes.every(n=>n.n===1));
    let creates=0;
    const provider=async(db:any,id:string)=>{
      let row=(await db.query("SELECT * FROM interviews WHERE id=$1",[id])).rows[0];
      if(!row.calendar_event_id){creates++;row=(await db.query("UPDATE interviews SET calendar_event_id=$2 WHERE id=$1 RETURNING *",[id,`synthetic-event-${id}`])).rows[0];}
      return row;
    };
    await Promise.all([syncInterviewCalendarAfterCommit(pool,i.id,false,provider),syncInterviewCalendarAfterCommit(pool,i.id,false,provider)]);
    assert.equal(creates,1);
    assert.equal((await query("SELECT calendar_sync_status FROM interviews WHERE id=$1",[i.id])).rows[0].calendar_sync_status,"synced");
  }
  const id=await app("hired"),i=await interview(id);
  await query("UPDATE job_submissions SET talent_id=NULL WHERE id=$1",[id]);
  const db=await pool.connect();
  try {await db.query("BEGIN");assert.equal((await synchronizeFindWorkInterview(db,i.id)).id,i.id);await db.query("COMMIT");}
  finally{db.release();}
});
test("0047 reclassifies only original in-flight cohorts and is idempotent, preserving new/accepted records",async()=>{
  await query("CREATE TABLE IF NOT EXISTS app_schema_migrations(id text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())");
  const cutoff=(await query("INSERT INTO app_schema_migrations(id,applied_at) VALUES('0044_contractor_onboarding',now()-interval '1 day') ON CONFLICT(id) DO UPDATE SET applied_at=excluded.applied_at RETURNING applied_at")).rows[0].applied_at;
  const moved:string[]=[],kept:string[]=[];
  for(const status of ["interviewing","offer_extended","offer_declined","new"]) {
    const id=await app(status);
    await query("INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status,captured_at) VALUES($1,2,$2,$3)",[id,status,cutoff]);
    if(status==="new") {
      const i=await interview(id);
      await query("UPDATE interviews SET created_at=$2::timestamptz-interval '1 hour' WHERE id=$1",[i.id,cutoff]);
    }
    moved.push(id);
  }
  for(const late of [false,true]) {
    const id=await app(late?"interviewing":"new");
    await query(`INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status,captured_at)
      VALUES($1,2,$2,$3::timestamptz+($4::boolean::int*interval '1 hour'))`,[id,late?"interviewing":"new",cutoff,late]);
    kept.push(id);
  }
  const accepted=await app("offer_accepted");
  await query(`INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status,captured_at)
    VALUES($1,2,'offer_accepted',$2)`,[accepted,cutoff]);kept.push(accepted);
  const sql=readFileSync("migrations/0047_inflight_interview_cohorts.sql","utf8");
  const deposits=(await query("SELECT * FROM security_deposits ORDER BY id")).rows;
  await query(sql);
  const first=(await query("SELECT submission_id,workflow_version,reason,migrated_at FROM contractor_onboarding_cohorts WHERE submission_id=ANY($1::text[]) ORDER BY submission_id",[[...moved,...kept]])).rows;
  assert.ok(first.filter(r=>moved.includes(r.submission_id)).every(r=>r.workflow_version===1&&r.reason&&r.migrated_at));
  assert.ok(first.filter(r=>kept.includes(r.submission_id)).every(r=>r.workflow_version===2&&r.migrated_at===null));
  await query(sql);
  assert.deepEqual((await query("SELECT submission_id,workflow_version,reason,migrated_at FROM contractor_onboarding_cohorts WHERE submission_id=ANY($1::text[]) ORDER BY submission_id",[[...moved,...kept]])).rows,first);
  assert.deepEqual((await query("SELECT * FROM security_deposits ORDER BY id")).rows,deposits);
  const legacy=moved[0],sent=await send(legacy);
  assert.equal(sent.statusCode,201,JSON.stringify(sent.body));
  const response=await offerHandler("patch","/api/talent/offers/:id/respond",talent,candidate,{action:"accept"},sent.body.id);
  assert.equal(response.statusCode,200,JSON.stringify(response.body));
  await query("UPDATE contractor_onboarding_cohorts SET captured_at=$2,captured_status='interviewing' WHERE submission_id=$1",[legacy,cutoff]);
  await query(sql);
  assert.equal((await query("SELECT workflow_version FROM contractor_onboarding_cohorts WHERE submission_id=$1",[legacy])).rows[0].workflow_version,2);
  await query("DELETE FROM app_schema_migrations WHERE id='0044_contractor_onboarding'");
});
