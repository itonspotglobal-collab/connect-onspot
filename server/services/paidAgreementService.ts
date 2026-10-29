import type { Pool } from "pg";
import { prepareContract } from "./contractDocumentService";
import { lockOnboarding, OnboardingError } from "./contractorOnboardingPolicy";
import { queueHiringLifecycleEvent, tryActivateEngagement } from "./hiringLifecycleEvents";
import { verifiedDeferredHiringPayment } from "./hiringPaymentWaiverService";

/** Post-commit outbox work: idempotent drafts and MSA issuance, never sending PDFs automatically. */
export async function preparePaidAgreements(pool:Pool,p:any) {
  const source=(await pool.query(`SELECT d.*,o.status AS offer_status,js.client_id FROM security_deposits d
    JOIN offers o ON o.id=d.offer_id JOIN job_submissions js ON js.id=d.submission_id
    WHERE d.id=$1`,[p.depositId])).rows[0];
  if(!source||source.status!=="held"||!["accepted","offer_accepted"].includes(source.offer_status))
    return {contractId:null,eligible:false};
  const submission=(await pool.query("SELECT * FROM job_submissions WHERE id=$1",[source.submission_id])).rows[0];
  if(!submission||!await verifiedDeferredHiringPayment(pool,submission))return {contractId:null,eligible:false};
  let contract=(await pool.query("SELECT id FROM hiring_contracts WHERE offer_id=$1 AND status NOT IN ('void','voided')",[source.offer_id])).rows[0];
  if(!contract) {
    try {contract=await prepareContract({id:p.actorId},{offerId:source.offer_id,partyType:"onspot",title:"Contractor Agreement"});}
    catch(e:any) {
      if(e?.body?.error!=="active_contract_exists")throw e;
      contract=(await pool.query("SELECT id FROM hiring_contracts WHERE offer_id=$1 AND status NOT IN ('void','voided')",[source.offer_id])).rows[0];
    }
  }
  if(!contract)throw new Error("Contract draft unavailable");
  const db=await pool.connect();
  try {
    await db.query("BEGIN");
    await lockOnboarding(db,source.submission_id);
    const current=(await db.query(`SELECT d.status,o.status AS offer_status FROM security_deposits d JOIN offers o ON o.id=d.offer_id
      WHERE d.id=$1 FOR UPDATE OF d,o`,[source.id])).rows[0];
    if(current?.status!=="held"||!["accepted","offer_accepted"].includes(current?.offer_status)) {
      await db.query("COMMIT");
      return {contractId:null,eligible:false};
    }
    const lockedSubmission=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[source.submission_id])).rows[0];
    if(!await verifiedDeferredHiringPayment(db,lockedSubmission)) {
      await db.query("COMMIT");
      return {contractId:null,eligible:false};
    }
    const msa=(await db.query("SELECT id,version,sha256 FROM msa_documents WHERE active AND effective_at<=now() FOR SHARE")).rows[0];
    if(!msa)await queueHiringLifecycleEvent(db,`msa-missing:${source.submission_id}`,"msa_missing",{submissionId:source.submission_id});
    else {
      const signed=!!(await db.query(`SELECT 1 FROM client_msa_signatures WHERE client_id=$1 AND document_id=$2
        AND document_sha256=$3 AND msa_version=$4`,[source.client_id,msa.id,msa.sha256,msa.version])).rows.length;
      if(!signed) {
        await db.query(`INSERT INTO client_msa_requests(client_id,msa_document_id,submission_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
          [source.client_id,msa.id,source.submission_id]);
        await queueHiringLifecycleEvent(db,`msa-required:${source.client_id}:${msa.id}`,"msa_required",
          {submissionId:source.submission_id,msaDocumentId:msa.id,payerId:source.client_id});
      }
    }
    await tryActivateEngagement(db,source.submission_id,p.actorId);
    await db.query("COMMIT");
    return {contractId:contract.id,eligible:true};
  } catch(e) {await db.query("ROLLBACK").catch(()=>{});throw e;} finally {db.release();}
}
