import type {Pool,PoolClient} from "pg";
import {randomUUID} from "node:crypto";
import {lockOnboarding,issueAcceptedOfferDeposit,isDepositFirst,OnboardingError} from "./contractorOnboardingPolicy";
import {queueHiringLifecycleEvent,tryActivateEngagement,activateFundedEngagement} from "./hiringLifecycleEvents";
import {hiringOverrideState} from "./adminHiringOverrideState";
import {FORMAL_PIPELINE_PREDICATE} from "../../shared/formalPipelineSql";

const fail=(status:number,code:string,message:string):never=>{throw new OnboardingError(status,code,message);};
const ranks:Record<string,number>={new:0,under_review:0,reviewed:0,invited:0,shortlisted:1,interviewing:2,
  final_interview_passed:3,offer_declined:3,offer_extended:4,offer_expired:4,offer_accepted:5,contract_sent:6,contract_signed:6,hired:7};
export const HIRING_OVERRIDE_ACTIONS=["skip_stage","waive_deposit","skip_agreements","direct_placement","revert_override"] as const;
export class AdminHiringOverrideService {
  constructor(private pool:Pick<Pool,"connect"|"query">,private afterCommit:()=>Promise<void>=async()=>{}){}
  async authorize(db:Pick<PoolClient,"query">,actorId:string) {
    const a=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[actorId])).rows[0];
    if(a?.role!=="admin"||a.admin_sub_role!==null)fail(403,"SUPER_ADMIN_REQUIRED","Only a database-confirmed Super Admin may override hiring.");
  }
  async history(actorId:string,id:string) {
    await this.authorize(this.pool,actorId);
    return {items:(await this.pool.query(`SELECT id,action,previous_state,new_state,reason,notify_parties,created_at,reverted_at
      FROM admin_hiring_overrides WHERE submission_id=$1 ORDER BY created_at DESC,id DESC`,[id])).rows};
  }
  async capabilities(actorId:string) {
    await this.authorize(this.pool,actorId);return {canManage:true};
  }
  private async record(db:PoolClient,actor:string,s:any,action:string,reason:string,notify:boolean,previous:any,next:any) {
    const row=(await db.query(`INSERT INTO admin_hiring_overrides(actor_id,submission_id,client_id,talent_id,action,previous_state,new_state,reason,notify_parties)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [actor,s.id,s.client_id,s.talent_id,action,JSON.stringify(previous),JSON.stringify(next),reason,notify])).rows[0];
    await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,$3,$4,$5)`,[s.id,previous.status??s.status,next.status??s.status,`Super Admin override: ${action}: ${reason}`,actor]);
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
      fail(409,"JOB_BILLING_CLASSIFICATION_REQUIRED","Choose the job's engagement type and billing mode through its editor first.");
    const offer=(await db.query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date,accepted_at,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $8::boolean THEN now() ELSE NULL END,'Super Admin hiring override; see immutable audit')
      RETURNING *`,[s.id,accepted?"accepted":"sent",terms.rate,terms.currency,job.engagement_type,job.billing_mode,terms.start,accepted])).rows[0];
    if(accepted)await queueHiringLifecycleEvent(db,`offer-accepted:${offer.id}`,"offer_accepted",{submissionId:s.id,offerId:offer.id});
    return offer;
  }
  private async draft(db:PoolClient,s:any,offer:any) {
    const existing=(await db.query("SELECT * FROM hiring_contracts WHERE offer_id=$1 AND status NOT IN ('void','voided') FOR UPDATE",[offer.id])).rows[0];
    if(existing)return existing;
    const entity=(await db.query("SELECT value FROM platform_settings WHERE key='contract_signing_entity'")).rows[0]?.value??"OnSpot";
    const contract=(await db.query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,signing_entity,billing_mode,effective_start_date)
      VALUES($1,$2,'draft',$3,$4,$5) RETURNING *`,[offer.id,s.id,entity,offer.billing_mode,offer.proposed_start_date])).rows[0];
    await db.query("UPDATE security_deposits SET hiring_contract_id=$2 WHERE offer_id=$1 AND hiring_contract_id IS NULL",[offer.id,contract.id]);
    return contract;
  }
  private async waive(db:PoolClient,s:any,actor:string,reason:string,depositId?:string) {
    const d=(await db.query(`SELECT d.* FROM security_deposits d LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
      WHERE coalesce(d.submission_id,hc.submission_id)=$1 AND ($2::uuid IS NULL OR d.id=$2::uuid)
      ORDER BY d.created_at DESC LIMIT 1 FOR UPDATE OF d`,[s.id,depositId??null])).rows[0];
    if(!d)fail(404,"DEPOSIT_NOT_FOUND","No deposit exists for this application.");
    if(d.status!=="pending")fail(409,"DEPOSIT_NOT_WAIVABLE","Only a pending deposit can be waived; held funds and historical settlements cannot be changed.");
    await db.query(`UPDATE security_deposits SET status='waived',waived_by=$2,waived_at=now(),waiver_reason=$3,updated_at=now()
      WHERE id=$1`,[d.id,actor,reason]);
    await db.query(`UPDATE manual_wise_obligations SET cancelled_at=now(),cancellation_reason=$2
      WHERE deposit_id=$1 AND cancelled_at IS NULL`,[d.id,`Deposit waived by Super Admin: ${reason}`]);
    await queueHiringLifecycleEvent(db,`deposit-waived:${d.id}`,"deposit_verified",
      {depositId:d.id,submissionId:s.id,offerId:d.offer_id,actorId:actor,waived:true});
    return d;
  }
  async execute(actor:string,action:string,body:any) {
    const reason=typeof body?.reason==="string"?body.reason.trim():"";
    const db=await this.pool.connect();
    try {
      await db.query("BEGIN");
      await this.authorize(db,actor);
      if(!HIRING_OVERRIDE_ACTIONS.includes(action as any))fail(404,"UNKNOWN_OVERRIDE","Unknown override action.");
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
        if(!["require","waive"].includes(body.depositPolicy))fail(422,"DEPOSIT_POLICY_REQUIRED","Explicitly require or waive the deposit.");
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
      const s=(await db.query(`SELECT js.* FROM job_submissions js WHERE js.id=$1 AND js.${FORMAL_PIPELINE_PREDICATE} FOR UPDATE OF js`,[id])).rows[0];
      if(!s)fail(404,"ELIGIBLE_APPLICATION_REQUIRED","An eligible original application is required. Withdrawn or rejected applications are not reopened by overrides.");
      const state=await hiringOverrideState(db,id);
      const previous:any={status:action==="direct_placement"?null:s.status,...state};
      let next:any={status:s.status};
      if(action==="revert_override") {
        const last=(await db.query(`SELECT * FROM admin_hiring_overrides WHERE submission_id=$1 AND reverted_at IS NULL
          AND action<>'revert_override' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`,[id])).rows[0];
        if(!last)fail(409,"NO_OVERRIDE","No unreverted override exists.");
        if(last.action!=="skip_stage"||!["shortlisted","interviewing"].includes(last.new_state.status)||s.status!==last.new_state.status)
          fail(409,"UNSAFE_REVERSAL","This override has financial, agreement or later-stage effects. It cannot be automatically reversed; use an audited financial/contract review.");
        const history=(await db.query(`SELECT id FROM job_application_status_history WHERE application_id=$1 AND created_at>$2
          AND note<>$3 LIMIT 1`,[id,last.created_at,`Super Admin override: ${last.action}: ${last.reason}`])).rows;
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
        if(typeof body.skipContractorAgreement!=="boolean"||typeof body.skipMsa!=="boolean"||
          (!body.skipContractorAgreement&&!body.skipMsa))fail(422,"AGREEMENT_SELECTION_REQUIRED","Select which agreement requirement is being bypassed.");
        if(!["offer_accepted","contract_sent","contract_signed"].includes(s.status))fail(409,"ACCEPTANCE_REQUIRED","Accept the offer before bypassing agreements.");
        const accepted=(await db.query(`SELECT * FROM offers WHERE submission_id=$1 AND status IN ('accepted','offer_accepted')
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[id])).rows[0];
        if(!accepted)fail(409,"ACCEPTED_OFFER_REQUIRED","An accepted offer is required.");
        await this.draft(db,s,accepted);
        next={...next,skipContractorAgreement:body.skipContractorAgreement,skipMsa:body.skipMsa};
      } else if(action==="skip_stage") {
        const target=body.targetStatus;
        if(!["shortlisted","interviewing","final_interview_passed","offer_extended","offer_accepted","contract_sent","hired"].includes(target)||
          ranks[target]<=ranks[s.status])fail(422,"LATER_STAGE_REQUIRED","Choose a later supported pipeline stage.");
        next={status:target==="final_interview_passed"?"interviewing":target,finalInterviewPassed:ranks[target]>=3};
        let offer=(await db.query(`SELECT * FROM offers WHERE submission_id=$1 AND status IN ('accepted','offer_accepted','sent')
          ORDER BY CASE WHEN status IN ('accepted','offer_accepted') THEN 0 ELSE 1 END,created_at DESC LIMIT 1 FOR UPDATE`,[id])).rows[0];
        if(ranks[target]>=4) {
          if(offer&&!["accepted","offer_accepted"].includes(offer.status)&&ranks[target]>=5) {
            fail(409,"PENDING_OFFER_EXISTS","A sent offer already exists. Use its normal acceptance or withdraw it before creating an administrative accepted offer.");
          }
          if(!offer)offer=await this.offer(db,s,body,ranks[target]>=5);
          if(ranks[target]>=5) {
            await db.query("UPDATE job_submissions SET status='offer_accepted',updated_at=now() WHERE id=$1",[id]);
            await issueAcceptedOfferDeposit(db,offer.id,id);
            await this.draft(db,s,offer);
          }
        }
        if(target==="hired")next={...next,skipContractorAgreement:true,skipMsa:true};
        await db.query("UPDATE job_submissions SET status=$2,updated_at=now() WHERE id=$1",[id,target==="hired"?"offer_accepted":next.status]);
      } else {
        const offer=await this.offer(db,s,body,true);
        await issueAcceptedOfferDeposit(db,offer.id,id);
        await this.draft(db,s,offer);
        next={status:"offer_accepted",finalInterviewPassed:true,skipContractorAgreement:true,skipMsa:true,directPlacement:true,offerId:offer.id,depositPolicy:body.depositPolicy};
        if(body.depositPolicy==="waive")await this.waive(db,s,actor,reason);
      }
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
}
