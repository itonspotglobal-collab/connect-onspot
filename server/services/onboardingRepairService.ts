import type {Pool,PoolClient} from "pg";
import {createHash} from "node:crypto";
import {lockOnboarding,issueAcceptedOfferDeposit,OnboardingError} from "./contractorOnboardingPolicy";
import {AdminHiringOverrideService} from "./adminHiringOverrideService";
const fail=(status:number,code:string,message:string):never=>{throw new OnboardingError(status,code,message);};
export class OnboardingRepairService {
  private auth:AdminHiringOverrideService;
  constructor(private pool:Pool){this.auth=new AdminHiringOverrideService(pool);}
  async list(actor:string) {
    await this.auth.capabilities(actor);
    const rows=(await this.pool.query(`SELECT js.id AS "submissionId",js.status,j.title AS "jobTitle",
      EXISTS(SELECT 1 FROM offers o WHERE o.submission_id=js.id AND o.status IN('accepted','offer_accepted')) AS has_offer,
      EXISTS(SELECT 1 FROM offers o JOIN security_deposits d ON d.offer_id=o.id WHERE o.submission_id=js.id
        AND o.status IN('accepted','offer_accepted')) AS has_deposit
      FROM job_submissions js JOIN jobs j ON j.id=js.job_id
      WHERE js.status IN('offer_accepted','contract_sent','contract_signed')
      AND NOT EXISTS(SELECT 1 FROM onboarding_submission_links l WHERE l.submission_id=js.id)
      ORDER BY js.updated_at DESC`)).rows;
    const items=[];
    for(const r of rows.filter(x=>!x.has_offer||!x.has_deposit))items.push({...r,
      issues:[...(!r.has_offer?["Accepted offer missing"]:[]),...(!r.has_deposit?["Accepted-offer deposit missing"]:[])],
      candidates:(await this.pool.query(`SELECT o.id AS "offerId",o.submission_id AS "submissionId",o.status FROM offers o
        JOIN job_submissions source ON source.id=o.submission_id JOIN job_submissions target ON target.id=$1
        WHERE source.client_id=target.client_id AND source.talent_id=target.talent_id AND source.job_id=target.job_id
        AND source.id<>target.id AND o.status IN('accepted','offer_accepted')
        AND NOT EXISTS(SELECT 1 FROM onboarding_submission_links l WHERE l.submission_id=source.id)`,[r.submissionId])).rows});
    return {items};
  }
  private async plan(db:Pick<PoolClient,"query">,id:string,input:any) {
    const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1",[id])).rows[0];
    if(!s)fail(404,"APPLICATION_NOT_FOUND","Application not found.");
    if(!["offer_accepted","contract_sent","contract_signed"].includes(s.status))fail(409,"REPAIR_NOT_REQUIRED","This application is not in an accepted lifecycle state.");
    const offers=(await db.query("SELECT id,submission_id,status,updated_at FROM offers WHERE submission_id=$1 ORDER BY id",[id])).rows;
    const deposits=(await db.query(`SELECT d.id,d.status,d.offer_id FROM security_deposits d LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
      WHERE d.submission_id=$1 OR hc.submission_id=$1 ORDER BY d.id`,[id])).rows;
    const accepted=offers.find(o=>["accepted","offer_accepted"].includes(o.status));
    let source:any=null,previousStatus:string|null=null,changes:string[]=[];
    if(input.action==="link_offer") {
      source=(await db.query(`SELECT o.id,o.submission_id,o.status,source.updated_at FROM offers o
        JOIN job_submissions source ON source.id=o.submission_id
        WHERE o.id=$1 AND source.client_id=$2 AND source.talent_id=$3 AND source.job_id=$4
        AND source.id<>$5 AND o.status IN('accepted','offer_accepted')
        AND NOT EXISTS(SELECT 1 FROM onboarding_submission_links WHERE submission_id IN($5,source.id))`,
        [input.offerId,s.client_id,s.talent_id,s.job_id,id])).rows[0];
      if(accepted||deposits.length||!source)fail(409,"UNSAFE_OFFER_LINK","Only a duplicate with no accepted offer or deposit can link to the same Client/Talent/job's canonical accepted offer.");
      changes=[`Link this duplicate to canonical application ${source.submission_id}.`,`Keep offer ${source.id} and every financial record on their original immutable application.`,`All onboarding/payment actions use the canonical application.`];
    } else if(input.action==="issue_deposit") {
      if(!accepted)fail(409,"ACCEPTED_OFFER_REQUIRED","No accepted offer exists on this application.");
      changes=[`Ensure the canonical deposit exists for accepted offer ${accepted.id}; preserve any existing invoice unchanged.`];
    } else if(input.action==="revert") {
      if(accepted||deposits.length||(await db.query("SELECT 1 FROM hiring_contracts WHERE submission_id=$1 LIMIT 1",[id])).rows.length)
        fail(409,"UNSAFE_REVERSION","Accepted offers, contracts or deposits exist; a financial lifecycle review is required instead of reverting.");
      previousStatus=(await db.query(`SELECT new_status FROM job_application_status_history WHERE application_id=$1
        AND new_status IN('new','under_review','reviewed','shortlisted','interviewing','offer_extended')
        ORDER BY created_at DESC,id DESC LIMIT 1`,[id])).rows[0]?.new_status??"new";
      if(previousStatus==="offer_extended"&&!offers.some(o=>o.status==="sent"))previousStatus="interviewing";
      changes=[`Restore application status to ${previousStatus}.`,`Keep all existing rows and record the reason and prior state.`];
    } else fail(422,"REPAIR_ACTION_REQUIRED","Choose link_offer, issue_deposit or revert.");
    const fingerprint=createHash("sha256").update(JSON.stringify({s:{id:s.id,status:s.status,updated:s.updated_at},offers,deposits,source,previousStatus,action:input.action})).digest("hex");
    return {submissionId:id,action:input.action,offerId:source?.id??accepted?.id??null,sourceSubmissionId:source?.submission_id??null,
      previousStatus,changes,summary:changes[0],fingerprint};
  }
  async dryRun(actor:string,id:string,input:any) {await this.auth.capabilities(actor);return this.plan(this.pool,id,input);}
  async apply(actor:string,id:string,input:any) {
    const reason=typeof input.reason==="string"?input.reason.trim():"";
    const db=await this.pool.connect();
    try {
      await db.query("BEGIN");await this.auth.authorize(db,actor);
      if(reason.length<10||reason.length>2000)fail(422,"REASON_REQUIRED","A reason of 10–2000 characters is required.");
      const prior=(await db.query(`SELECT new_state FROM admin_hiring_overrides WHERE submission_id=$1 AND action=$2
        AND new_state->>'fingerprint'=$3 LIMIT 1`,[id,`repair_${input.action}`,input.fingerprint??""])).rows[0];
      if(prior){await db.query("COMMIT");return {...prior.new_state,applied:true,replay:true};}
      // Stable lock order for both ends; no offer ownership mutation or trigger bypass.
      const initial=await this.plan(db,id,input);
      for(const key of [id,initial.sourceSubmissionId].filter(Boolean).sort())await lockOnboarding(db,key!);
      await db.query("SELECT id FROM job_submissions WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",[[id,initial.sourceSubmissionId].filter(Boolean)]);
      const plan=await this.plan(db,id,input);
      if(input.fingerprint!==plan.fingerprint)fail(409,"STALE_DRY_RUN","Records changed. Refresh the dry run before confirming.");
      if(plan.action==="link_offer")await db.query(`INSERT INTO onboarding_submission_links
        (submission_id,canonical_submission_id,offer_id,linked_by,reason) VALUES($1,$2,$3,$4,$5)`,
        [id,plan.sourceSubmissionId,plan.offerId,actor,reason]);
      if(plan.action==="issue_deposit")await issueAcceptedOfferDeposit(db,plan.offerId!,id);
      const before=(await db.query("SELECT * FROM job_submissions WHERE id=$1",[id])).rows[0];
      if(plan.action==="revert")await db.query("UPDATE job_submissions SET status=$2,updated_at=now() WHERE id=$1",[id,plan.previousStatus]);
      await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
        VALUES($1,$2,$3,$4,$5)`,[id,before.status,plan.previousStatus??before.status,`Super Admin onboarding repair: ${plan.action}: ${reason}`,actor]);
      await db.query(`INSERT INTO admin_hiring_overrides(actor_id,submission_id,client_id,talent_id,action,previous_state,new_state,reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[actor,id,before.client_id,before.talent_id,`repair_${plan.action}`,
        JSON.stringify({status:before.status}),JSON.stringify(plan),reason]);
      await db.query("INSERT INTO manual_wise_audit(actor_id,event,details) VALUES($1,'onboarding_repaired',$2)",[actor,JSON.stringify(plan)]);
      await db.query("COMMIT");return {...plan,applied:true};
    }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}finally{db.release();}
  }
}
