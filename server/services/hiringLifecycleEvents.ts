/** Pure transactional helpers; no application DB or provider initialization. */
import type { PoolClient } from "pg";

export type HiringLifecycleType = "offer_accepted" | "deposit_issued" | "proof_submitted" | "proof_rejected" | "engagement_active";
export async function queueHiringLifecycleEvent(
  db: Pick<PoolClient, "query">, key: string, type: HiringLifecycleType, payload: Record<string, unknown>,
) {
  await db.query(`INSERT INTO hiring_lifecycle_events(event_key,event_type,payload)
    VALUES($1,$2,$3::jsonb) ON CONFLICT(event_key) DO NOTHING`, [key,type,JSON.stringify(payload)]);
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
  if (!row || row.status !== "signed" || row.deposit_status !== "held") {
    throw new Error("A signed contract and verified held deposit are required for activation.");
  }
  if (row.application_status === "hired") return;
  if (row.application_status !== "contract_signed") {
    throw new Error("The application requires lifecycle review before activation.");
  }
  await db.query("UPDATE job_submissions SET status='hired',updated_at=now() WHERE id=$1", [row.submission_id]);
  await db.query("UPDATE hiring_contracts SET billing_activated_at=now(),updated_at=now() WHERE id=$1", [contractId]);
  await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
    VALUES($1,'contract_signed','hired','Security deposit independently verified',$2)`, [row.submission_id,actor]);
  await queueHiringLifecycleEvent(db,`engagement-active:${contractId}`,"engagement_active",
    {submissionId:row.submission_id,contractId});
}
