import type { PoolClient } from "pg";
import { isDepositFirst, OnboardingError } from "./contractorOnboardingPolicy";
import {hiringOverrideState} from "./adminHiringOverrideState";
import {depositArrangement,msaSignatureExists} from "./depositArrangementState";
import {onboardingPrerequisites} from "./onboardingPrerequisites";

interface OnboardingStatusResult {
  stages:Array<{key:string;label:string;complete:boolean;current:boolean;actor:string;overridden:boolean}>;
  [key:string]:any;
}
export async function onboardingStatus(db:Pick<PoolClient,"query">,id:string,actorId:string):Promise<OnboardingStatusResult> {
  const s=(await db.query(`SELECT js.*,u.role AS actor_role,u.admin_sub_role AS actor_sub_role FROM job_submissions js JOIN users u ON u.id=$2
    WHERE js.id=$1 AND (u.role='admin' OR js.client_id=u.id OR js.talent_id=u.id)`,[id,actorId])).rows[0];
  if(!s)throw new OnboardingError(404,"APPLICATION_NOT_FOUND","Application not found.");
  const alias=(await db.query("SELECT canonical_submission_id FROM onboarding_submission_links WHERE submission_id=$1",[id])).rows[0];
  if(alias) {
    const canonical=await onboardingStatus(db,alias.canonical_submission_id,actorId);
    return {...canonical,requestedSubmissionId:id,canonicalSubmissionId:alias.canonical_submission_id};
  }
  const depositFirst=await isDepositFirst(db,id);
  const interviews=(await db.query("SELECT interview_type,status,outcome FROM interviews WHERE submission_id=$1",[id])).rows;
  const overrides=await hiringOverrideState(db,id);
  const final=overrides.finalInterviewPassed||interviews.some(i=>i.interview_type==="final"&&i.status==="completed"&&["advance","passed"].includes(String(i.outcome).trim().toLowerCase()));
  const shortlisted=["shortlisted","interviewing"].includes(s.status)||!!(await db.query(
    "SELECT 1 FROM job_application_status_history WHERE application_id=$1 AND new_status='shortlisted' LIMIT 1",[id])).rows.length;
  const offer=(await db.query(`SELECT id,status FROM offers WHERE submission_id=$1
    ORDER BY CASE WHEN status IN ('accepted','offer_accepted') THEN 0 ELSE 1 END,created_at DESC LIMIT 1`,[id])).rows[0];
  const contract=(await db.query("SELECT id,status,onspot_signed_at,talent_signed_at,billing_activated_at FROM hiring_contracts WHERE submission_id=$1 AND status NOT IN ('void','voided') ORDER BY created_at DESC LIMIT 1",[id])).rows[0];
  const deposit=(await db.query(`SELECT d.*,s.status AS proof_status FROM security_deposits d
    LEFT JOIN manual_wise_obligations o ON o.deposit_id=d.id
    LEFT JOIN LATERAL(SELECT status FROM manual_wise_submissions WHERE obligation_id=o.id ORDER BY created_at DESC LIMIT 1)s ON true
    WHERE (d.offer_id=$1 OR d.hiring_contract_id=$2) ORDER BY d.created_at DESC LIMIT 1`,[offer?.id??null,contract?.id??null])).rows[0];
  const msa=(await db.query("SELECT id,version,sha256 FROM msa_documents WHERE active AND effective_at<=now()")).rows[0];
  const msaSigned=await msaSignatureExists(db,s.client_id,msa);
  const arrangement=await depositArrangement(db,id);
  const setup=await onboardingPrerequisites(db);
  const isTalent=s.actor_role==="talent",isSuper=s.actor_role==="admin"&&s.actor_sub_role===null;
  const conditions={depositHeld:["held","waived"].includes(deposit?.status),contractSigned:
    !!(contract?.status==="signed"&&contract.onspot_signed_at&&contract.talent_signed_at)||overrides.skipContractorAgreement,msaSigned:msaSigned||overrides.skipMsa};
  const active=s.status==="hired"&&(!depositFirst||!!contract?.billing_activated_at);
  const missing=depositFirst?[
    ...(!conditions.depositHeld?["Deposit payment must be independently verified"]:[]),
    ...(!conditions.contractSigned?["Contractor Agreement must be fully signed"]:[]),
    ...(!overrides.skipMsa?(!msa?["The current service agreement is being prepared by OnSpot"]:!msaSigned?["Client must sign the current MSA"]:[]):[]),
  ]:[];
  const accepted=offer&&["accepted","offer_accepted"].includes(offer.status);
  const dataIssue=["offer_accepted","contract_sent","contract_signed","hired"].includes(s.status)&&!accepted;
  const deferred=deposit?.status==="pending"&&arrangement?.waiver_type==="defer";
  const paymentState=!accepted||!deposit?null:deposit.status==="waived"?"Waived":conditions.depositHeld?"Paid":
    deposit.proof_status==="verification_pending"?"Verifying":deferred?"Deferred":"Awaiting payment";
  const offerBlockers:string[]=[];
  if(!accepted&&depositFirst) {
    if(!shortlisted)offerBlockers.push("Shortlist this application");
    if(!final)offerBlockers.push(interviews.some(i=>i.interview_type==="final"&&i.status!=="cancelled")
      ?"Record an Advance outcome for the Final round":"Schedule a Final round interview");
  }
  const offerStatusAllowed=["under_review","reviewed","shortlisted","interviewing","offer_declined"].includes(s.status);
  if(!accepted&&!offerStatusAllowed)offerBlockers.push(s.status==="offer_extended"?"An offer has already been sent":"This application is not at an offer-eligible stage");
  const activationMissing=accepted?missing:[];
  const stageMissing=accepted?(!conditions.depositHeld?activationMissing.slice(0,1):activationMissing):
    depositFirst&&!shortlisted?["Shortlist this application"]:
      depositFirst&&!interviews.length&&!final&&!overrides.overriddenStages.includes("interviewing")?["Schedule an interview"]:offerBlockers;
  const flags=[true,shortlisted,interviews.length>0||final||overrides.overriddenStages.includes("interviewing"),final,!!accepted,!!deposit,conditions.depositHeld,
    conditions.contractSigned&&(!depositFirst||conditions.msaSigned),active];
  const labels=["Application","Shortlisted","Interview","Final interview","Offer","Invoice","Payment verified","Agreements","Active"];
  const keys=["application","shortlisted","interview","final_interview","offer","invoice","payment_verified","agreements","active"];
  const actors=["Talent","Client","Client / Talent","Client / Admin","Talent","Client","Super Admin","Client / Talent / OnSpot","OnSpot"];
  const current=dataIssue||active?-1:accepted
    ?(!deposit?5:!conditions.depositHeld&&!deferred?6:!conditions.contractSigned||!conditions.msaSigned?7:!conditions.depositHeld?6:8)
    :final?4:interviews.length?3:flags.findIndex(done=>!done);
  let nextActor=current<0?"None":actors[current];
  if(accepted&&!conditions.depositHeld)nextActor=deposit?.proof_status==="verification_pending"?"Super Admin":"Client";
  if((conditions.depositHeld||deferred)&&!conditions.contractSigned)nextActor=contract?.status==="sent"?"Talent / OnSpot":"OnSpot";
  if(conditions.contractSigned&&!conditions.msaSigned)nextActor=msa?"Client":"Super Admin";
  return {policy:depositFirst?"deposit_first":"legacy",submissionId:id,status:s.status,jobTitle:(await db.query("SELECT title FROM jobs WHERE id=$1",[s.job_id])).rows[0]?.title,
    isTalent,dataIssue,dataIssueMessage:dataIssue?"This application needs OnSpot review":null,
    repairUrl:dataIssue&&isSuper?`/admin/contractor-onboarding?applicationId=${encodeURIComponent(id)}#repairs`:null,
    paymentState:isTalent?null:paymentState,
    setup:isTalent?null:{wiseReady:setup.wiseReady,msaReady:setup.msaReady,
      clientMessage:accepted&&s.actor_role==="client"&&!setup.wiseReady&&deposit?.status==="pending"?
        "OnSpot is finalising payment details — you'll get an email shortly":null},
    shortlistSatisfied:shortlisted,finalInterviewPassed:final,
    canScheduleInterview:depositFirst?["shortlisted","interviewing"].includes(s.status):["new","under_review","reviewed","shortlisted","interviewing"].includes(s.status),
    canSendOffer:(!depositFirst||final)&&offerStatusAllowed,
    offerAccepted:!!accepted,offerBlockers,
    activationMissing:isTalent?(accepted&&!active?["Waiting on OnSpot/client paperwork"]:[]):activationMissing,
    stageMissing:isTalent&&accepted?(active?[]:["Waiting on OnSpot/client paperwork"]):stageMissing,
    msaUploadWarning:s.actor_role==="admin"&&s.actor_sub_role===null&&!msa?"New engagements cannot be activated until an MSA is uploaded":null,
    defaultInterviewType:interviews.some(i=>i.status==="completed")?"final":"initial",
    offerId:offer?.id??null,deposit:deposit?(s.actor_role==="talent"
      ?null
      :{id:deposit.id,status:deposit.status,amount:deposit.amount,currency:deposit.currency,paymentStatus:deposit.status==="waived"?"waived":deposit.status==="held"?"paid":deposit.proof_status??"awaiting_payment",
        deferredDueAt:deferred?arrangement.deposit_due_at:null,paymentSource:deposit.payment_source,
        arrangementNote:arrangement?.arrangement_note??deposit.waiver_reason??null,
        invoiceUrl:`/client/payments/deposit/${deposit.id}`}):null,
    contract:contract?{id:contract.id,status:contract.status,url:`/contracts?id=${contract.id}`}:null,
    msa:{version:msa?.version??null,signed:msaSigned,available:!!msa,url:"/client/msa"},
    conditions:isTalent?{contractSigned:conditions.contractSigned}:conditions,
    canPrepareContract:!isTalent&&!!accepted&&(!depositFirst||conditions.depositHeld||deferred)&&(!contract||["void","voided"].includes(contract.status)),
    missing:dataIssue?["This application needs OnSpot review"]:active?[]:isTalent&&accepted?["Waiting on OnSpot/client paperwork"]:accepted?activationMissing:offerBlockers,
    nextActor:isTalent&&accepted?"OnSpot / Client":nextActor,
    stages:keys.map((key,i)=>({key,label:key==="payment_verified"&&paymentState?paymentState:labels[i],complete:flags[i],current:i===current,actor:actors[i],
      overridden:key==="final_interview"?overrides.finalInterviewPassed:key==="agreements"?(overrides.skipContractorAgreement||overrides.skipMsa):
        key==="payment_verified"?deposit?.status==="waived":key==="interview"?(overrides.finalInterviewPassed||overrides.overriddenStages.includes("interviewing")):
        key==="shortlisted"?overrides.overriddenStages.includes("shortlisted"):key==="offer"?overrides.overriddenStages.some(x=>["offer_extended","offer_accepted","contract_sent","hired"].includes(x)):false}))
      .filter(stage=>!isTalent||!["invoice","payment_verified"].includes(stage.key))};
}
