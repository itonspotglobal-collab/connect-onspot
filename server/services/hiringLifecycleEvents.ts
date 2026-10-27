/** Pure transactional helpers; no application DB or provider initialization. */
import type { PoolClient } from "pg";
import { isDepositFirst, lockOnboarding } from "./contractorOnboardingPolicy";

export type HiringLifecycleType = "offer_accepted" | "deposit_issued" | "proof_submitted" | "proof_rejected" | "engagement_active" | "deposit_verified" | "msa_missing" | "msa_required" | "msa_signed" | "agreements_recheck";
export async function queueHiringLifecycleEvent(
  db: Pick<PoolClient, "query">, key: string, type: HiringLifecycleType, payload: Record<string, unknown>,
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

/** The only new-flow activation writer. Caller owns BEGIN/COMMIT. */
export async function tryActivateEngagement(db:Pick<PoolClient,"query">,submissionId:string,actor:string|null=null) {
  if(!await isDepositFirst(db,submissionId))return false; // D7 follows the existing path.
  await lockOnboarding(db,submissionId);
  const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[submissionId])).rows[0];
  if(!s || s.status==="hired")return false;
  if(!["offer_accepted","contract_sent","contract_signed"].includes(s.status))return false;
  const hc=(await db.query(`SELECT hc.* FROM hiring_contracts hc JOIN offers o ON o.id=hc.offer_id
    WHERE hc.submission_id=$1 AND o.status IN ('accepted','offer_accepted') AND hc.status='signed'
      AND hc.onspot_signed_at IS NOT NULL AND hc.talent_signed_at IS NOT NULL
    ORDER BY hc.created_at DESC LIMIT 1 FOR UPDATE OF hc`,[submissionId])).rows[0];
  if(!hc)return false;
  const d=(await db.query(`SELECT * FROM security_deposits WHERE offer_id=$1 AND submission_id=$2
    AND hiring_contract_id=$3 AND status='held' FOR UPDATE`,[hc.offer_id,submissionId,hc.id])).rows[0];
  if(!d)return false;
  const msa=(await db.query("SELECT id,version,sha256 FROM msa_documents WHERE active AND effective_at<=now() FOR SHARE")).rows[0];
  if(!msa) {
    await queueHiringLifecycleEvent(db,`msa-missing:${submissionId}`,"msa_missing",{submissionId});
    return false;
  }
  const signature=(await db.query(`SELECT id FROM client_msa_signatures WHERE client_id=$1
    AND document_id=$2 AND msa_version=$3 AND document_sha256=$4`,[s.client_id,msa.id,msa.version,msa.sha256])).rows[0];
  if(!signature)return false;
  await db.query("UPDATE job_submissions SET status='hired',updated_at=now() WHERE id=$1",[submissionId]);
  await db.query("UPDATE hiring_contracts SET billing_activated_at=coalesce(billing_activated_at,now()),updated_at=now() WHERE id=$1",[hc.id]);
  await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
    VALUES($1,$2,'hired','Deposit independently verified; Contractor Agreement and current client MSA fully signed',$3)`,
    [submissionId,s.status,actor]);
  await queueHiringLifecycleEvent(db,`engagement-active:${hc.id}`,"engagement_active",{submissionId,contractId:hc.id});
  return true;
}
