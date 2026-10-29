import type { PoolClient } from "pg";
import { computeDepositAmount } from "../lib/billing";
import { queueHiringLifecycleEvent } from "./hiringLifecycleEvents";
import { lockAcceptedHiringWaiver, verifiedDeferredHiringPayment } from "./hiringPaymentWaiverService";
import { HiringPaymentError } from "./hiringPaymentErrors";

export type OnboardingDb = Pick<PoolClient,"query">;
export class OnboardingError extends HiringPaymentError {
  constructor(status:number,code:string,message:string) { super(status,code,message); }
}
export async function isDepositFirst(db:OnboardingDb,submissionId:string):Promise<boolean> {
  const r=await db.query("SELECT workflow_version FROM contractor_onboarding_cohorts WHERE submission_id=$1",[submissionId]);
  return r.rows[0]?.workflow_version!==1;
}
export async function lockOnboarding(db:OnboardingDb,id:string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`contractor-onboarding:${id}`]);
}
export async function requireHiringStage(db:OnboardingDb,id:string,stage:"interview"|"offer",actorId:string,overrideReason?:unknown,recordOverride=true) {
  if(!await isDepositFirst(db,id))return false;
  const s=(await db.query("SELECT status FROM job_submissions WHERE id=$1 FOR UPDATE",[id])).rows[0];
  if(!s)throw new OnboardingError(404,"APPLICATION_NOT_FOUND","Application not found.");
  const passed=stage==="interview" ? ["shortlisted","interviewing"].includes(s.status) :
    !!(await db.query(`SELECT id FROM interviews WHERE submission_id=$1 AND interview_type='final'
      AND status='completed' AND lower(btrim(outcome)) IN ('advance','passed') LIMIT 1`,[id])).rows.length;
  if(passed)return false;
  const reason=typeof overrideReason==="string"?overrideReason.trim():"";
  const a=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[actorId])).rows[0];
  if(reason && reason.length<=2000 && a?.role==="admin" && (a.admin_sub_role===null||a.admin_sub_role==="talent_acquisition")) {
    if(recordOverride)await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,$2,$3,$4)`,[id,s.status,`Recruiting Admin ${stage} prerequisite override: ${reason}`,actorId]);
    return true;
  }
  throw new OnboardingError(409,stage==="interview"?"SHORTLIST_REQUIRED":"FINAL_INTERVIEW_REQUIRED",
    stage==="interview"?"Shortlist this application before scheduling an interview.":
      "Complete a Final round interview with an Advance/Passed outcome before sending an offer.");
}
export async function requirePaidContract(db:OnboardingDb,offerId:string,id:string) {
  const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[id])).rows[0];
  if(s&&!await verifiedDeferredHiringPayment(db,s))
    throw new OnboardingError(409,"DEFERRED_HIRING_PAYMENT_REQUIRED","The deferred hiring invoice must be paid and independently verified before agreements are issued.");
  if(!await isDepositFirst(db,id))return;
  if(!(await db.query("SELECT id FROM security_deposits WHERE offer_id=$1 AND submission_id=$2 AND status='held' FOR UPDATE",[offerId,id])).rows.length)
    throw new OnboardingError(409,"DEPOSIT_PAYMENT_REQUIRED","The security deposit must be independently verified before preparing or sending an agreement.");
}
/** Runs inside the offer acceptance transaction; the deposit is the only debt. */
export async function issueAcceptedOfferDeposit(db:OnboardingDb,offerId:string,submissionId:string) {
  await lockOnboarding(db,submissionId);
  const o=(await db.query(`SELECT o.*,js.client_id FROM offers o JOIN job_submissions js ON js.id=o.submission_id
    WHERE o.id=$1 AND o.submission_id=$2 AND o.status IN ('accepted','offer_accepted') FOR UPDATE OF o,js`,[offerId,submissionId])).rows[0];
  if(!o)throw new OnboardingError(409,"ACCEPTED_OFFER_REQUIRED","An accepted offer is required.");
  const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[submissionId])).rows[0];
  await lockAcceptedHiringWaiver(db,s);
  // Only successful, fresh acceptance transactions call this helper. Historical
  // accepted offers are not replayed at startup. A new acceptance (including a
  // counter or renewed offer) must never inherit an application's legacy waiver.
  await db.query(`INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status)
    VALUES($1,2,'offer_accepted') ON CONFLICT(submission_id) DO UPDATE
    SET workflow_version=2,captured_status='offer_accepted'`,[submissionId]);
  const rate=Number(o.rate),amount=computeDepositAmount(rate);
  if(!Number.isFinite(rate)||rate<=0||!Number.isFinite(amount)||amount<=0)
    throw new OnboardingError(409,"DEPOSIT_AMOUNT_REQUIRED","The accepted offer needs a finalized positive rate.");
  const d=(await db.query(`INSERT INTO security_deposits(offer_id,submission_id,hiring_contract_id,amount,currency,status,invoice_number)
    VALUES($1,$2,NULL,$3,$4,'pending',$5)
    ON CONFLICT(offer_id) WHERE offer_id IS NOT NULL DO UPDATE SET offer_id=excluded.offer_id RETURNING *`,
    [offerId,submissionId,amount.toFixed(2),o.rate_currency,`DEP-${offerId}`])).rows[0];
  await db.query(`INSERT INTO manual_wise_obligations(category,deposit_id,payer_id,config_id)
    VALUES('deposit',$1,$2,(SELECT id FROM manual_wise_config WHERE currency=$3 AND active))
    ON CONFLICT(deposit_id) DO NOTHING`,[d.id,o.client_id,d.currency]);
  const issued=await queueHiringLifecycleEvent(db,`deposit-issued-offer:${offerId}`,"deposit_issued",{submissionId,offerId,depositId:d.id});
  if(issued)await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,created_at)
    SELECT id,status,status,'Accepted-offer security deposit invoice issued; awaiting independent settlement verification',clock_timestamp()
    FROM job_submissions WHERE id=$1`,[submissionId]);
  return d;
}
