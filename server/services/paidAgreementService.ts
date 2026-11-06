import type { Pool } from "pg";
import { prepareContract } from "./contractDocumentService";
import { lockOnboarding, OnboardingError } from "./contractorOnboardingPolicy";
import { queueHiringLifecycleEvent, tryActivateEngagement } from "./hiringLifecycleEvents";
import { verifiedDeferredHiringPayment } from "./hiringPaymentWaiverService";
import {hiringOverrideState} from "./adminHiringOverrideState";
import {depositArrangement,msaSignatureExists} from "./depositArrangementState";
import {currentClientMsa} from "./currentClientMsa";

/** Post-commit outbox work: idempotent drafts and MSA issuance, never sending PDFs automatically. */
export async function preparePaidAgreements(pool:Pool,p:any) {
  const source=(await pool.query(`SELECT d.*,o.status AS offer_status,js.client_id FROM security_deposits d
    JOIN offers o ON o.id=d.offer_id JOIN job_submissions js ON js.id=d.submission_id
    WHERE d.id=$1`,[p.depositId])).rows[0];
  const arrangement=source?await depositArrangement(pool,source.submission_id):null;
  if(!source||(!["held","waived"].includes(source.status)&&arrangement?.waiver_type!=="defer")||!["accepted","offer_accepted"].includes(source.offer_status))
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
    const currentArrangement=await depositArrangement(db,source.submission_id);
    if((!["held","waived"].includes(current?.status)&&currentArrangement?.waiver_type!=="defer")||!["accepted","offer_accepted"].includes(current?.offer_status)) {
      await db.query("COMMIT");
      return {contractId:null,eligible:false};
    }
    const lockedSubmission=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[source.submission_id])).rows[0];
    if(!await verifiedDeferredHiringPayment(db,lockedSubmission)) {
      await db.query("COMMIT");
      return {contractId:null,eligible:false};
    }
    const override=await hiringOverrideState(db,source.submission_id);
    const msa=await currentClientMsa(db,source.client_id);
    const hasTemplate=!!(await db.query("SELECT 1 FROM contract_templates WHERE kind='msa' AND status='active'")).rows.length;
    if(!msa&&!override.skipMsa)await queueHiringLifecycleEvent(db,
      `${hasTemplate?"msa-preparation":"msa-missing"}:${source.submission_id}`,
      hasTemplate?"msa_preparation_required":"msa_missing",{submissionId:source.submission_id,clientId:source.client_id});
    else if(msa&&!override.skipMsa) {
      const signed=await msaSignatureExists(db,source.client_id,msa);
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
