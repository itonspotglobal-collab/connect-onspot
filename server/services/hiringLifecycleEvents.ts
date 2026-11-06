/** Pure transactional helpers; no application DB or provider initialization. */
import type { PoolClient } from "pg";
import { isDepositFirst, lockOnboarding } from "./contractorOnboardingPolicy";
import type { HiringPaymentDb } from "./hiringPaymentService";
import { verifiedDeferredHiringPayment } from "./hiringPaymentWaiverService";
import {hiringOverrideState} from "./adminHiringOverrideState";
import {msaSignatureExists} from "./depositArrangementState";
import {currentClientMsa} from "./currentClientMsa";

export type HiringLifecycleType = "offer_accepted" | "deposit_issued" | "deposit_reminder" | "proof_submitted" | "proof_rejected" | "engagement_active" | "deposit_verified" | "msa_missing" | "msa_required" | "msa_signed" | "agreements_recheck"
  | "msa_preparation_required" | "msa_countersign_required" | "msa_countersigned"
  | "deposit_arrangement" | "deposit_invoice_resend" | "onboarding_setup_alert"
  | "admin_hiring_override" | "hiring_skip_requested" | "hiring_skip_granted" | "hiring_skip_revoked" | "hiring_deferred_due" | "hiring_deferred_reminder" | "hiring_deferred_invoice_issued";
export async function queueHiringLifecycleEvent(
  db: HiringPaymentDb, key: string, type: HiringLifecycleType, payload: Record<string, unknown>,
) {
  return (await db.query(`INSERT INTO hiring_lifecycle_events(event_key,event_type,payload)
    VALUES($1,$2,$3::jsonb) ON CONFLICT(event_key) DO NOTHING RETURNING event_key`, [key,type,JSON.stringify(payload)])).rows.length>0;
}

/**
 * Called inside the independently verified deposit settlement transaction.
 * Historical already-Hired records are left unchanged, never reactivated.
 */
export async function activateFundedEngagement(db: Pick<PoolClient, "query">, contractId: string, actor: string) {
  const row = (await db.query(`SELECT hc.id,hc.status,hc.submission_id,js.status AS application_status,
      d.status AS deposit_status
    FROM hiring_contracts hc JOIN job_submissions js ON js.id=hc.submission_id
    JOIN security_deposits d ON d.hiring_contract_id=hc.id
    WHERE hc.id=$1 FOR UPDATE OF hc,js,d`, [contractId])).rows[0];
  if (!row || row.status !== "signed" || !["held","waived"].includes(row.deposit_status)) {
    throw new Error("A signed contract and verified held deposit are required for activation.");
  }
  if (row.application_status === "hired") return;
  if (row.application_status !== "contract_signed") {
    throw new Error("The application requires lifecycle review before activation.");
  }
  await db.query("UPDATE job_submissions SET status='hired',updated_at=now() WHERE id=$1", [row.submission_id]);
  await db.query("UPDATE hiring_contracts SET billing_activated_at=now(),updated_at=now() WHERE id=$1", [contractId]);
  await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
    VALUES($1,'contract_signed','hired',$3,$2)`, [row.submission_id,actor,row.deposit_status==="waived"?"Security deposit explicitly waived by Admin; no settlement claimed":"Security deposit independently verified"]);
  await queueHiringLifecycleEvent(db,`engagement-active:${contractId}`,"engagement_active",
    {submissionId:row.submission_id,contractId});
}

/** The only new-flow activation writer. Caller owns BEGIN/COMMIT. */
export async function tryActivateEngagement(db:Pick<PoolClient,"query">,submissionId:string,actor:string|null=null) {
  if(!await isDepositFirst(db,submissionId))return false; // D7 follows the existing path.
  await lockOnboarding(db,submissionId);
  const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[submissionId])).rows[0];
  if(!s || s.status==="hired")return false;
  if(!await verifiedDeferredHiringPayment(db,s))return false;
  if(!["offer_accepted","contract_sent","contract_signed"].includes(s.status))return false;
  const override=await hiringOverrideState(db,submissionId);
  const hc=(await db.query(`SELECT hc.* FROM hiring_contracts hc JOIN offers o ON o.id=hc.offer_id
    WHERE hc.submission_id=$1 AND o.status IN ('accepted','offer_accepted') AND hc.status NOT IN ('void','voided','terminated')
      AND ($2::boolean OR (hc.status='signed' AND hc.onspot_signed_at IS NOT NULL AND hc.talent_signed_at IS NOT NULL))
    ORDER BY hc.created_at DESC LIMIT 1 FOR UPDATE OF hc`,[submissionId,override.skipContractorAgreement])).rows[0];
  if(!hc)return false;
  const d=(await db.query(`SELECT * FROM security_deposits WHERE offer_id=$1 AND submission_id=$2
    AND hiring_contract_id=$3 AND status IN ('held','waived') FOR UPDATE`,[hc.offer_id,submissionId,hc.id])).rows[0];
  if(!d)return false;
  const msa=await currentClientMsa(db,s.client_id);
  if(!msa&&!override.skipMsa) {
    await queueHiringLifecycleEvent(db,`msa-missing:${submissionId}`,"msa_missing",{submissionId});
    return false;
  }
  const signature=await msaSignatureExists(db,s.client_id,msa);
  if(!signature&&!override.skipMsa)return false;
  await db.query("UPDATE job_submissions SET status='hired',updated_at=now() WHERE id=$1",[submissionId]);
  const audit=(override.skipContractorAgreement||override.skipMsa)?(await db.query(`SELECT id FROM admin_hiring_overrides
    WHERE submission_id=$1 AND reverted_at IS NULL AND (new_state->>'skipContractorAgreement'='true' OR new_state->>'skipMsa'='true')
    ORDER BY created_at DESC,id DESC LIMIT 1`,[submissionId])).rows[0]:null;
  await db.query(`UPDATE hiring_contracts SET billing_activated_at=coalesce(billing_activated_at,now()),
    activation_override_id=coalesce($2::uuid,activation_override_id),updated_at=now() WHERE id=$1`,[hc.id,audit?.id??null]);
  await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
    VALUES($1,$2,'hired',$4,$3)`,
    [submissionId,s.status,actor,audit||d.status==="waived"?"Activated under audited Admin hiring exceptions; no absent signatures or settlement were fabricated":"Deposit independently verified; Contractor Agreement executed and current MSA signed by Client; additional OnSpot MSA countersignature tracked separately"]);
  await queueHiringLifecycleEvent(db,`engagement-active:${hc.id}`,"engagement_active",{submissionId,contractId:hc.id});
  return true;
}
