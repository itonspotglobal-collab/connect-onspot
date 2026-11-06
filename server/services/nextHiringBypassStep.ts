import type {OnboardingDb} from "./contractorOnboardingPolicy";
import {hiringOverrideState} from "./adminHiringOverrideState";
import {currentClientMsa} from "./currentClientMsa";
import {msaSignatureExists} from "./depositArrangementState";

export interface NextBypassStep {
  stageKey:string;
  action:"skip_stage"|"waive_deposit"|"skip_agreements";
  targetStatus?:string;
  requiresTerms?:boolean;
  skipContractorAgreement?:boolean;
  skipMsa?:boolean;
  label:string;
  description:string;
  rate?:string;
  currency?:string;
  startDate?:string;
}

/** Read-only resolver. Execution must resolve again under the onboarding lock. */
export async function resolveNextBypassStep(db:OnboardingDb,submissionId:string):Promise<NextBypassStep|null> {
  const s=(await db.query("SELECT status,client_id FROM job_submissions WHERE id=$1",[submissionId])).rows[0];
  if(!s||["hired","rejected","withdrawn","declined"].includes(s.status))return null;
  const override=await hiringOverrideState(db,submissionId);
  const final=override.finalInterviewPassed||!!(await db.query(`SELECT 1 FROM interviews WHERE submission_id=$1
    AND status='completed' AND interview_type='final' AND lower(btrim(outcome)) IN ('advance','passed') LIMIT 1`,[submissionId])).rows.length;
  const stage=s.status==="interviewing"&&final?"final_interview_passed":s.status;
  const pipeline:Record<string,[string,string,string,string]> = {
    new:["shortlisted","shortlisted","Shortlist","Shortlist this application."],
    under_review:["shortlisted","shortlisted","Shortlist","Shortlist this application."],
    reviewed:["shortlisted","shortlisted","Shortlist","Shortlist this application."],
    shortlisted:["interview","interviewing","Interview","Bypass the initial interview prerequisite. No interview record is created."],
    interviewing:["final_interview","final_interview_passed","Final interview","Bypass the final-interview requirement. No completed interview or outcome is fabricated."],
    final_interview_passed:["offer","offer_extended","Extend offer","Create an offer using explicitly agreed terms, or retain the existing sent offer."],
    offer_extended:["offer","offer_accepted","Accept offer","Administratively accept the existing sent offer using its unchanged terms and issue its deposit invoice. This is an audited exception, not a Talent signature."],
  };
  const entry=pipeline[stage];
  if(entry) {
    const [stageKey,targetStatus,label,description]=entry;
    const step:NextBypassStep={stageKey,action:"skip_stage",targetStatus,label,description};
    if(stageKey==="offer") {
      step.requiresTerms=true;
      const offer=(await db.query(`SELECT rate,rate_currency,proposed_start_date::date::text AS start_date
        FROM offers WHERE submission_id=$1 AND status='sent' ORDER BY created_at DESC,id DESC LIMIT 1`,[submissionId])).rows[0];
      if(offer)Object.assign(step,{rate:String(offer.rate),currency:offer.rate_currency,startDate:offer.start_date});
    }
    return step;
  }
  if(!["offer_accepted","contract_sent","contract_signed"].includes(stage))return null;
  const accepted=(await db.query(`SELECT o.id,hc.status AS contract_status,hc.talent_signed_at,hc.onspot_signed_at,d.status AS deposit_status
    FROM offers o LEFT JOIN hiring_contracts hc ON hc.offer_id=o.id AND hc.status NOT IN ('void','voided','terminated')
    LEFT JOIN security_deposits d ON coalesce(d.offer_id,(SELECT offer_id FROM hiring_contracts WHERE id=d.hiring_contract_id))=o.id
    WHERE o.submission_id=$1 AND o.status IN ('accepted','offer_accepted') ORDER BY o.created_at DESC,hc.created_at DESC LIMIT 1`,[submissionId])).rows[0];
  if(!accepted)return null;
  if(accepted.deposit_status==="pending")return {stageKey:"payment_verified",action:"waive_deposit",label:"Payment verification",
    description:"Waive this pending deposit. No received funds, payment proof or independent settlement verification will be claimed."};
  if(!["held","waived"].includes(accepted.deposit_status))return null;
  const contractSatisfied=override.skipContractorAgreement||(accepted.contract_status==="signed"&&accepted.talent_signed_at&&accepted.onspot_signed_at);
  const msaSatisfied=override.skipMsa||await msaSignatureExists(db,s.client_id,await currentClientMsa(db,s.client_id));
  if(!contractSatisfied||!msaSatisfied)return {stageKey:"agreements",action:"skip_agreements",skipContractorAgreement:true,skipMsa:true,
    label:"Agreements",description:"Bypass Contractor Agreement and MSA signature requirements. No signatures are created. Activation is attempted only when all remaining requirements are satisfied."};
  return null;
}
