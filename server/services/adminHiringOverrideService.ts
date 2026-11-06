import type {Pool,PoolClient} from "pg";
import {randomUUID} from "node:crypto";
import {lockOnboarding,issueAcceptedOfferDeposit,isDepositFirst,OnboardingError} from "./contractorOnboardingPolicy";
import {queueHiringLifecycleEvent,tryActivateEngagement,activateFundedEngagement} from "./hiringLifecycleEvents";
import {hiringOverrideState} from "./adminHiringOverrideState";
import {ADMIN_OVERRIDE_ELIGIBILITY_PREDICATE} from "../../shared/adminOverrideEligibilitySql";
import {resolveNextBypassStep} from "./nextHiringBypassStep";
export {resolveNextBypassStep} from "./nextHiringBypassStep";

const fail=(status:number,code:string,message:string):never=>{throw new OnboardingError(status,code,message);};
const ranks:Record<string,number>={new:0,under_review:0,reviewed:0,invited:0,shortlisted:1,interviewing:2,
  final_interview_passed:3,offer_declined:3,offer_extended:4,offer_expired:4,offer_accepted:5,contract_sent:6,contract_signed:6,hired:7};
export const HIRING_OVERRIDE_ACTIONS=["skip_stage","skip_next_step","waive_deposit","skip_agreements","direct_placement","revert_override"] as const;
export class AdminHiringOverrideService {
  constructor(private pool:Pick<Pool,"connect"|"query">,private afterCommit:()=>Promise<void>=async()=>{}){}
  async authorize(db:Pick<PoolClient,"query">,actorId:string) {
    const a=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[actorId])).rows[0];
    if(a?.role!=="admin")fail(403,"ADMIN_REQUIRED","Only a database-confirmed Admin may override hiring.");
    return a;
  }
  async history(actorId:string,id:string) {
    await this.authorize(this.pool,actorId);
    return {items:(await this.pool.query(`SELECT id,action,previous_state,new_state,reason,notify_parties,created_at,reverted_at
      FROM admin_hiring_overrides WHERE submission_id=$1 ORDER BY created_at DESC,id DESC`,[id])).rows};
  }
  async capabilities(actorId:string) {
    const actor=await this.authorize(this.pool,actorId);return {canManage:true,canRevert:actor.admin_sub_role===null};
  }
  async nextStep(actorId:string,id:string) {
    await this.authorize(this.pool,actorId);
    return {step:await resolveNextBypassStep(this.pool,id)};
  }
  private async record(db:PoolClient,actor:string,s:any,action:string,reason:string,notify:boolean,previous:any,next:any) {
    const row=(await db.query(`INSERT INTO admin_hiring_overrides(actor_id,submission_id,client_id,talent_id,action,previous_state,new_state,reason,notify_parties)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [actor,s.id,s.client_id,s.talent_id,action,JSON.stringify(previous),JSON.stringify(next),reason,notify])).rows[0];
    await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,$3,$4,$5)`,[s.id,previous.status??s.status,next.status??s.status,`Admin override: ${action}: ${reason}`,actor]);
    if(notify)await queueHiringLifecycleEvent(db,`admin-hiring-override:${row.id}`,"admin_hiring_override",
      {submissionId:s.id,overrideId:row.id,action});
    return row;
  }
  private terms(body:any) {
    const rate=String(body.rate??"");
    if(!/^\d{1,9}(\.\d{1,2})?$/.test(rate)||Number(rate)<=0)fail(422,"RATE_REQUIRED","Enter an agreed positive rate with at most two decimal places.");
    if(body.currency!=="USD")fail(422,"USD_REQUIRED","New placements and offers must use USD.");
    const start=body.startDate;
    if(typeof start!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start))||
      new Date(start).toISOString().slice(0,10)!==start)fail(422,"START_DATE_REQUIRED","Enter the agreed start date as YYYY-MM-DD.");
    return {rate,currency:"USD",start};
  }
  private async offer(db:PoolClient,s:any,body:any,accepted:boolean) {
    const terms=this.terms(body);
    const job=(await db.query("SELECT engagement_type,billing_mode FROM jobs WHERE id=$1",[s.job_id])).rows[0];
    if(!["Lite","Standard"].includes(job?.engagement_type)||!["tracked","guaranteed"].includes(job?.billing_mode))
      throw new OnboardingError(409,"JOB_BILLING_CLASSIFICATION_REQUIRED",
        "This job is missing a valid engagement type or billing mode. Choose both in the job editor before creating an offer.",
        {jobId:s.job_id,jobEditorUrl:`/admin/find-work/jobs/${encodeURIComponent(s.job_id)}/edit`});
    const offer=(await db.query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date,accepted_at,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $8::boolean THEN now() ELSE NULL END,'Admin hiring override; see immutable audit')
      RETURNING *`,[s.id,accepted?"accepted":"sent",terms.rate,terms.currency,job.engagement_type,job.billing_mode,terms.start,accepted])).rows[0];
    if(accepted)await queueHiringLifecycleEvent(db,`offer-accepted:${offer.id}`,"offer_accepted",{submissionId:s.id,offerId:offer.id});
    return offer;
  }
  private async draft(db:PoolClient,s:any,offer:any) {
    const existing=(await db.query("SELECT * FROM hiring_contracts WHERE offer_id=$1 AND status NOT IN ('void','voided') FOR UPDATE",[offer.id])).rows[0];
    if(existing) {
      await db.query("UPDATE security_deposits SET hiring_contract_id=$2 WHERE offer_id=$1 AND hiring_contract_id IS NULL",[offer.id,existing.id]);
      return existing;
    }
    const entity=(await db.query("SELECT value FROM platform_settings WHERE key='contract_signing_entity'")).rows[0]?.value??"OnSpot";
    const contract=(await db.query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,signing_entity,billing_mode,effective_start_date)
      VALUES($1,$2,'draft',$3,$4,$5) RETURNING *`,[offer.id,s.id,entity,offer.billing_mode,offer.proposed_start_date])).rows[0];
    await db.query("UPDATE security_deposits SET hiring_contract_id=$2 WHERE offer_id=$1 AND hiring_contract_id IS NULL",[offer.id,contract.id]);
    return contract;
  }
  private async waive(db:PoolClient,s:any,actor:string,reason:string,depositId?:string) {
    const accepted=depositId?null:(await db.query(`SELECT * FROM offers WHERE submission_id=$1 AND status IN ('accepted','offer_accepted')
      ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`,[s.id])).rows[0];
    if(!depositId&&!accepted)fail(409,"ACCEPTED_OFFER_REQUIRED","An accepted offer is required before waiving its security deposit.");
    let d=(await db.query(`SELECT d.* FROM security_deposits d LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
      WHERE coalesce(d.submission_id,hc.submission_id)=$1 AND ($2::uuid IS NULL OR d.id=$2::uuid)
        AND ($3::uuid IS NULL OR coalesce(d.offer_id,hc.offer_id)=$3::uuid)
      ORDER BY d.created_at DESC LIMIT 1 FOR UPDATE OF d`,[s.id,depositId??null,accepted?.id??null])).rows[0];
    if(!d&&!depositId) {
      d=await issueAcceptedOfferDeposit(db,accepted.id,s.id);
      await this.draft(db,s,accepted);
    }
    if(!d)fail(404,"DEPOSIT_NOT_FOUND","The selected deposit does not belong to this application.");
    if(d.status!=="pending")fail(409,"DEPOSIT_NOT_WAIVABLE","Only a pending deposit can be waived; held funds and historical settlements cannot be changed.");
    await db.query(`UPDATE hiring_payment_waivers SET revoked_at=now(),revoked_by=$2,
      revoke_reason='Replaced by explicit Admin deposit waiver'
      WHERE submission_id=$1 AND scope='deposit' AND revoked_at IS NULL`,[s.id,actor]);
    await db.query(`INSERT INTO hiring_payment_waivers(submission_id,client_id,job_id,talent_id,waiver_type,reason,
      arrangement_note,granted_by,scope,deposit_id,locked_at) VALUES($1,$2,$3,$4,'waive',$5,$5,$6,'deposit',$7,now())`,
      [s.id,s.client_id,s.job_id,s.talent_id,reason,actor,d.id]);
    await db.query(`UPDATE security_deposits SET status='waived',waived_by=$2,waived_at=now(),waiver_reason=$3,updated_at=now()
      WHERE id=$1`,[d.id,actor,reason]);
    await db.query(`UPDATE manual_wise_obligations SET cancelled_at=now(),cancellation_reason=$2
      WHERE deposit_id=$1 AND cancelled_at IS NULL`,[d.id,`Deposit waived by Admin: ${reason}`]);
    await queueHiringLifecycleEvent(db,`deposit-waived:${d.id}`,"deposit_verified",
      {depositId:d.id,submissionId:s.id,offerId:d.offer_id,actorId:actor,waived:true});
    return d;
  }
  async execute(actor:string,action:string,body:any) {
    const reason=typeof body?.reason==="string"?body.reason.trim():"";
    const db=await this.pool.connect();
    try {
      await db.query("BEGIN");
      const administrator=await this.authorize(db,actor);
      if(!HIRING_OVERRIDE_ACTIONS.includes(action as any))fail(404,"UNKNOWN_OVERRIDE","Unknown override action.");
      if(action==="revert_override"&&administrator.admin_sub_role!==null)
        fail(403,"SUPER_ADMIN_REQUIRED","Only a Super Admin may reverse hiring overrides.");
      if(reason.length<10||reason.length>2000)fail(422,"REASON_REQUIRED","A reason of 10–2000 characters is required.");
      if(body.notifyParties!==undefined&&typeof body.notifyParties!=="boolean")fail(422,"INVALID_NOTIFICATION_CHOICE","notifyParties must be true or false.");
      const notify=body.notifyParties===true;
      let id=body.submissionId;
      if(action==="direct_placement") {
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`direct-placement:${body.clientId}:${body.talentId}`]);
        const client=(await db.query("SELECT id FROM users WHERE id=$1 AND role='client'",[body.clientId])).rows[0];
        const talent=(await db.query("SELECT id,email FROM users WHERE id=$1 AND role='talent'",[body.talentId])).rows[0];
        if(!client||!talent)fail(422,"PARTIES_REQUIRED","Select an existing Client account and a linked Talent user account.");
        this.terms(body);
        if((await db.query(`SELECT 1 FROM job_submissions WHERE client_id=$1 AND talent_id=$2 AND
          status IN ('offer_accepted','contract_sent','contract_signed','hired') LIMIT 1`,[client.id,talent.id])).rows.length)
          fail(409,"PLACEMENT_EXISTS","This Client and Talent already have an active or accepted hiring application. Manage the original application.");
        let jobId=body.jobId;
        if(!jobId) {
          const j=body.createJob;
          if(!j||typeof j.title!=="string"||j.title.trim().length<3||j.title.length>200||
            !["Lite","Standard"].includes(j.engagementType)||!["tracked","guaranteed"].includes(j.billingMode))
            fail(422,"JOB_REQUIRED","Provide an approved owned job, or its new title, engagement type and billing mode.");
          jobId=randomUUID();
          await db.query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode,created_via)
            VALUES($1,$2,$3,'Administrative direct placement','Operations','Intermediate','open','approved',$4,$5,'admin_direct_placement')`,
            [jobId,client.id,j.title.trim(),j.engagementType,j.billingMode]);
        }
        if(!(await db.query("SELECT id FROM jobs WHERE id=$1 AND client_id=$2 AND approval_status='approved' AND status IN ('open','published') AND created_via<>'search_scaffold' FOR SHARE",[jobId,client.id])).rows.length)
          fail(422,"APPROVED_OWNED_JOB_REQUIRED","The job must be open, approved and owned by this Client.");
        if(body.depositPolicy!==undefined&&!["require","waive"].includes(body.depositPolicy))fail(422,"DEPOSIT_POLICY_REQUIRED","Explicitly require or waive the deposit.");
        for(const key of ["skipContractorAgreement","skipMsa"])
          if(body[key]!==undefined&&typeof body[key]!=="boolean")fail(422,"AGREEMENT_SELECTION_REQUIRED","Agreement bypass choices must be true or false.");
        id=randomUUID();
        await lockOnboarding(db,id);
        await db.query(`INSERT INTO job_submissions(id,job_id,client_id,talent_id,email,applicant_name,status,workflow_type,initiated_by,registration_status,admin_direct_placement)
          VALUES($1,$2,$3,$4,$5,'Talent','offer_accepted','client_invitation','client','linked',true)`,[id,jobId,client.id,talent.id,talent.email]);
      } else if(!id&&body.depositId) {
        id=(await db.query(`SELECT coalesce(d.submission_id,hc.submission_id) AS id FROM security_deposits d
          LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id WHERE d.id=$1`,[body.depositId])).rows[0]?.id;
      }
      if(typeof id!=="string"||id.length>150)fail(422,"APPLICATION_REQUIRED","An application or deposit identifier is required.");
      await lockOnboarding(db,id);
      const s=(await db.query(`SELECT js.*,
        (js.${ADMIN_OVERRIDE_ELIGIBILITY_PREDICATE}) AS override_eligible,
        (SELECT role FROM users WHERE id=js.talent_id) AS linked_talent_role,
        (SELECT client_id FROM jobs WHERE id=js.job_id) AS owned_job_client_id,
        EXISTS(SELECT 1 FROM jobs WHERE id=js.job_id) AS job_exists
        FROM job_submissions js WHERE js.id=$1 FOR UPDATE OF js`,[id])).rows[0];
      if(!s)fail(404,"APPLICATION_NOT_FOUND","This application no longer exists.");
      if(["rejected","withdrawn","declined"].includes(s.status))
        fail(409,"APPLICATION_CLOSED","Rejected, withdrawn or declined applications cannot be reopened by hiring overrides.");
      if(!s.talent_id||!s.linked_talent_role)
        fail(409,"TALENT_ACCOUNT_REQUIRED","This applicant has no linked Talent account — they must sign up/link first");
      if(s.linked_talent_role!=="talent")
        fail(409,"TALENT_ACCOUNT_REQUIRED","This applicant is linked to an account that is not a Talent account — they must link a Talent account first");
      if(!s.job_exists)fail(409,"JOB_NOT_FOUND","The application's job no longer exists. Restore a valid owned job before hiring.");
      if(s.owned_job_client_id!==s.client_id)
        fail(409,"JOB_CLIENT_MISMATCH","The application's job belongs to a different Client. Correct the ownership relationship before hiring.");
      if(!s.override_eligible)fail(409,"ADMIN_OVERRIDE_INELIGIBLE","The application's status, linked Talent account or job ownership is invalid.");
      const state=await hiringOverrideState(db,id);
      const stepwise=action==="skip_next_step";
      if(stepwise) {
        const step=await resolveNextBypassStep(db,id);
        if(!step)throw new OnboardingError(409,"STEP_CHANGED","The application moved on — refresh and try again");
        if(step.stageKey!==body.expectedStageKey||
          (body.expectedTargetStatus!==undefined&&body.expectedTargetStatus!==step.targetStatus))
          fail(409,"STEP_CHANGED","The application moved on — refresh and try again");
        action=step.action;
        body={...body,depositId:undefined,targetStatus:step.targetStatus,skipContractorAgreement:step.skipContractorAgreement,skipMsa:step.skipMsa};
      }
      const previous:any={status:action==="direct_placement"?null:s.status,...state};
      let next:any={status:s.status};
      if(action==="revert_override") {
        const last=(await db.query(`SELECT * FROM admin_hiring_overrides WHERE submission_id=$1 AND reverted_at IS NULL
          AND action<>'revert_override' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`,[id])).rows[0];
        if(!last)fail(409,"NO_OVERRIDE","No unreverted override exists.");
        if(last.action!=="skip_stage"||!["shortlisted","interviewing"].includes(last.new_state.status)||s.status!==last.new_state.status)
          fail(409,"UNSAFE_REVERSAL","This override has financial, agreement or later-stage effects. It cannot be automatically reversed; use an audited financial/contract review.");
        const history=(await db.query(`SELECT id FROM job_application_status_history WHERE application_id=$1 AND created_at>$2
          AND note NOT IN ($3,$4) LIMIT 1`,[id,last.created_at,`Super Admin override: ${last.action}: ${last.reason}`,`Admin override: ${last.action}: ${last.reason}`])).rows;
        if(history.length||(await db.query(`SELECT 1 FROM interviews WHERE submission_id=$1 AND created_at>=$2
          UNION ALL SELECT 1 FROM offers WHERE submission_id=$1 AND created_at>=$2 LIMIT 1`,[id,last.created_at])).rows.length)
          fail(409,"DOWNSTREAM_ACTIVITY","Later activity exists. Automatic reversal would invalidate hiring records.");
        next={status:last.previous_state.status,revertedOverrideId:last.id};
        await db.query("UPDATE job_submissions SET status=$2,updated_at=now() WHERE id=$1",[id,next.status]);
        await db.query("UPDATE admin_hiring_overrides SET reverted_at=now(),reverted_by=$2 WHERE id=$1",[last.id,actor]);
      } else if(action==="waive_deposit") {
        const d=await this.waive(db,s,actor,reason,body.depositId);
        previous.depositId=d.id;previous.depositStatus=d.status;
        next={...next,depositId:d.id,depositStatus:"waived",previousDepositStatus:d.status};
      } else if(action==="skip_agreements") {
        next={...next,...await this.skipAgreements(db,s,body)};
      } else if(action==="skip_stage") {
        next=await this.skipStage(db,s,body,previous,state.finalInterviewPassed,stepwise);
      } else {
        const offer=await this.offer(db,s,body,true);
        await issueAcceptedOfferDeposit(db,offer.id,id);
        await this.draft(db,s,offer);
        next={status:"offer_accepted",finalInterviewPassed:true,skipContractorAgreement:body.skipContractorAgreement??true,
          skipMsa:body.skipMsa??true,directPlacement:true,offerId:offer.id,depositPolicy:body.depositPolicy??"waive"};
        if(next.depositPolicy==="waive")await this.waive(db,s,actor,reason);
      }
      if(stepwise)next.stepwise=true;
      const audit=await this.record(db,actor,s,action,reason,notify,previous,next);
      if(action==="skip_stage"&&body.targetStatus==="hired") {
        const deposit=(await db.query("SELECT status FROM security_deposits WHERE submission_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[id])).rows[0];
        if(deposit?.status==="pending")await this.waive(db,s,actor,reason);
        else if(!["held","waived"].includes(deposit?.status))fail(409,"DEPOSIT_REVIEW_REQUIRED","This deposit needs financial lifecycle review before activation.");
      }
      await tryActivateEngagement(db,id,actor);
      if(action==="waive_deposit"&&!await isDepositFirst(db,id)) {
        const legacy=(await db.query("SELECT id,status FROM hiring_contracts WHERE submission_id=$1 AND status='signed' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[id])).rows[0];
        if(legacy&&s.status==="contract_signed")await activateFundedEngagement(db,legacy.id,actor);
      }
      const current=(await db.query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0];
      const immediate=(action==="skip_stage"&&body.targetStatus==="hired")||
        (action==="direct_placement"&&next.depositPolicy==="waive"&&next.skipContractorAgreement&&next.skipMsa);
      if(immediate&&current.status!=="hired")
        fail(409,"ACTIVATION_REQUIREMENTS_NOT_MET","The engagement could not be activated. Review historical obligations and contract eligibility; no override changes were committed.");
      const resultingContract=(await db.query(`SELECT id,status,billing_activated_at,activation_override_id
        FROM hiring_contracts WHERE submission_id=$1 ORDER BY created_at DESC LIMIT 1`,[id])).rows[0]??null;
      await db.query(`UPDATE admin_hiring_overrides SET new_state=new_state||$2::jsonb WHERE id=$1`,
        [audit.id,JSON.stringify({status:current.status,contract:resultingContract})]);
      await db.query("COMMIT");
      void this.afterCommit().catch(()=>{});
      return {id:audit.id,submissionId:id,status:current.status,action};
    } catch(e) {await db.query("ROLLBACK").catch(()=>{});throw e;}
    finally {db.release();}
  }
  private async skipAgreements(db:PoolClient,s:any,body:any) {
    if(typeof body.skipContractorAgreement!=="boolean"||typeof body.skipMsa!=="boolean"||
      (!body.skipContractorAgreement&&!body.skipMsa))fail(422,"AGREEMENT_SELECTION_REQUIRED","Select which agreement requirement is being bypassed.");
    if(!["offer_accepted","contract_sent","contract_signed"].includes(s.status))fail(409,"ACCEPTANCE_REQUIRED","Accept the offer before bypassing agreements.");
    const accepted=(await db.query(`SELECT * FROM offers WHERE submission_id=$1 AND status IN ('accepted','offer_accepted')
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[s.id])).rows[0];
    if(!accepted)fail(409,"ACCEPTED_OFFER_REQUIRED","An accepted offer is required.");
    await this.draft(db,s,accepted);
    return {skipContractorAgreement:body.skipContractorAgreement,skipMsa:body.skipMsa};
  }
  private async skipStage(db:PoolClient,s:any,body:any,previous:any,finalPassed:boolean,stepwise:boolean) {
    const target=body.targetStatus;
    const actualFinal=finalPassed||!!(await db.query(`SELECT 1 FROM interviews WHERE submission_id=$1 AND interview_type='final'
      AND status='completed' AND lower(btrim(outcome)) IN ('advance','passed') LIMIT 1`,[s.id])).rows.length;
    const effectiveRank=s.status==="interviewing"&&actualFinal?3:ranks[s.status];
    if(!["shortlisted","interviewing","final_interview_passed","offer_extended","offer_accepted","contract_sent","hired"].includes(target))
      fail(422,"LATER_STAGE_REQUIRED","Choose a later supported pipeline stage.");
    if(target!=="hired"&&ranks[target]!==effectiveRank+1)
      fail(422,"ONE_STEP_ONLY","Only the next hiring step can be bypassed.");
    if(target==="hired"&&ranks[target]<=effectiveRank)fail(422,"LATER_STAGE_REQUIRED","Choose a later supported pipeline stage.");
    let next:any={status:target==="final_interview_passed"?"interviewing":target,finalInterviewPassed:ranks[target]>=3};
    if(target==="hired")this.terms(body);
    let offer=(await db.query(`SELECT *,proposed_start_date::date::text AS agreed_start_date FROM offers WHERE submission_id=$1 AND status IN ('accepted','offer_accepted','sent')
      ORDER BY CASE WHEN status IN ('accepted','offer_accepted') THEN 0 ELSE 1 END,created_at DESC LIMIT 1 FOR UPDATE`,[s.id])).rows[0];
    if(target==="hired"&&offer&&["accepted","offer_accepted"].includes(offer.status)&&
      (Number(offer.rate)!==Number(body.rate)||offer.rate_currency!==body.currency||offer.agreed_start_date!==body.startDate))
      fail(409,"ACCEPTED_TERMS_MISMATCH","Use the accepted offer's agreed rate, currency and start date. Existing accepted financial terms cannot be silently replaced.");
    if(ranks[target]>=4) {
      if(offer&&!["accepted","offer_accepted"].includes(offer.status)&&ranks[target]>=5) {
        if(stepwise&&target==="offer_accepted") {
          offer=(await db.query(`UPDATE offers SET status='accepted',accepted_at=now(),updated_at=now()
            WHERE id=$1 RETURNING *`,[offer.id])).rows[0];
          await queueHiringLifecycleEvent(db,`offer-accepted:${offer.id}`,"offer_accepted",{submissionId:s.id,offerId:offer.id});
        } else {
          if(target!=="hired")fail(409,"PENDING_OFFER_EXISTS","A sent offer already exists. Use its normal acceptance or the audited next-step bypass.");
          this.terms(body);
          previous.supersededOfferId=offer.id;previous.supersededOfferStatus=offer.status;
          await db.query("UPDATE offers SET status='withdrawn',updated_at=now() WHERE id=$1",[offer.id]);
          offer=undefined;
        }
      }
      if(stepwise&&target==="offer_accepted"&&!offer)fail(409,"SENT_OFFER_REQUIRED","Refresh and extend an offer before accepting it.");
      if(!offer)offer=await this.offer(db,s,body,ranks[target]>=5);
      if(ranks[target]>=5) {
        await db.query("UPDATE job_submissions SET status='offer_accepted',updated_at=now() WHERE id=$1",[s.id]);
        await issueAcceptedOfferDeposit(db,offer.id,s.id);
        await this.draft(db,s,offer);
      }
    }
    if(target==="hired")next={...next,skipContractorAgreement:true,skipMsa:true};
    await db.query("UPDATE job_submissions SET status=$2,updated_at=now() WHERE id=$1",[s.id,target==="hired"?"offer_accepted":next.status]);
    return next;
  }
}
