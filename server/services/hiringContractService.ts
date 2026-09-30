/**
 * hiringContractService.ts — Phase 3: Hiring Contracts (admin/OnSpot-driven)
 *
 * OnSpot is the contracting party with the talent (the client's relationship
 * with OnSpot is a separate MSA outside this system), so the signing model is
 * onspot_signed_at + talent_signed_at only.
 *
 * Status flow:
 *   contract created from an ACCEPTED offer → submission 'contract_sent'
 *   both signatures recorded               → submission 'hired' (terminal)
 *
 * 'hired' and 'contract_sent' are never settable via the direct status PATCH
 * endpoints — this module is the only writer of those transitions.
 *
 * Every multi-row state change runs on a single checked-out pool client inside
 * one BEGIN/COMMIT, so a contract row can never commit without its matching
 * submission-status transition (and vice versa). Duplicate active contracts per
 * offer are prevented both by an in-transaction row lock and by the partial
 * unique index uq_hiring_contracts_active_offer (excluding 'void' and legacy
 * 'voided' statuses).
 */
import { getClient } from "../db.ts";
import type { PoolClient } from "pg";
import { loadAdminFormalSubmission } from "./formalPipelineGuard.js";
import { computeDepositAmount } from "../lib/billing.js";
import { query } from "../db.js";
import {
  notifyClientOfTalentHired,
  notifyTalentOfApplicationStatusChange,
} from "./applicationNotificationService.js";
import { sendTalentHiredEmail } from "./emailCompanionService.js";

export class ContractError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.error ?? "contract_error"));
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_SIGNING_ENTITY = "OnSpot Technologies Inc.";

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection-level failure — nothing more to do */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Read the signing entity from platform_settings, with the seeded default. */
export async function getContractSigningEntity(client: PoolClient): Promise<string> {
  try {
    const result = await client.query(
      `SELECT value FROM platform_settings WHERE key = 'contract_signing_entity' LIMIT 1`,
    );
    return result.rows[0]?.value || DEFAULT_SIGNING_ENTITY;
  } catch {
    return DEFAULT_SIGNING_ENTITY;
  }
}

/**
 * Create + send a hiring contract from an ACCEPTED offer.
 * Sets the submission → 'contract_sent' in the same transaction.
 */
export async function createHiringContract(params: {
  offerId: string;
  templateRef?: string | null;
  documentPath?: string | null;
  adminId?: string | null;
}): Promise<Record<string, any>> {
  const { offerId, templateRef, documentPath, adminId } = params;
  return withTransaction(async (client) => {
    // Lock the offer row so two concurrent creates serialize on it.
    const offerResult = await client.query(
      `SELECT id, submission_id, status, billing_mode, proposed_start_date FROM offers WHERE id = $1 FOR UPDATE`,
      [offerId],
    );
    if (offerResult.rows.length === 0) throw new ContractError(404, { error: "Offer not found" });
    const offer = offerResult.rows[0];
    if (offer.status !== "accepted" && offer.status !== "offer_accepted") {
      throw new ContractError(409, {
        error: "offer_not_accepted",
        message: `A contract can only be created from an accepted offer (current offer status: '${offer.status}').`,
      });
    }
    if (["tracked", "guaranteed"].includes(offer.billing_mode) && !offer.proposed_start_date) {
      throw new ContractError(409, {
        error: "effective_start_date_required",
        message: "A confirmed billing-mode contract requires the accepted offer's agreed start date.",
      });
    }

    const existing = await client.query(
      `SELECT id FROM hiring_contracts
       WHERE offer_id = $1 AND status NOT IN ('void', 'voided')
       LIMIT 1`,
      [offerId],
    );
    if (existing.rows.length > 0) {
      throw new ContractError(409, {
        error: "active_contract_exists",
        message: "An active contract already exists for this offer. Void it before creating a new one.",
        contractId: existing.rows[0].id,
      });
    }

    const signingEntity = await getContractSigningEntity(client);
    const submissionId: string = offer.submission_id;

    // Lock and verify the submission is a formal client_invitation.
    // loadAdminFormalSubmission enforces the pipeline predicate atomically — a
    // shortlist or application row returns not-found rather than a locked row with
    // the wrong workflow_type. The secondary lookup distinguishes "truly missing"
    // (404) from "wrong workflow_type" (409) when the guard rejects.
    const subGuard = await loadAdminFormalSubmission(submissionId, {
      forUpdate: true,
      txClient: client,
    });
    if (!subGuard.ok) {
      const anyRow = await client.query(
        `SELECT id FROM job_submissions WHERE id = $1`,
        [submissionId],
      );
      if (!anyRow.rows.length) {
        throw new ContractError(404, { error: "Submission not found" });
      }
      throw new ContractError(409, {
        error: "formal_invitation_required",
        message: "A hiring contract can only be created for a formally invited submission.",
      });
    }
    const previousStatus: string = subGuard.row.status;
    if (previousStatus !== "offer_accepted") {
      throw new ContractError(409, {
        error: "submission_not_contractable",
        message:
          previousStatus === "withdrawn"
            ? "A withdrawn application cannot proceed to contract."
            : previousStatus === "rejected"
              ? "A rejected application cannot proceed to contract."
              : `A hiring contract requires an accepted-offer application (current status: '${previousStatus}').`,
        currentStatus: previousStatus,
      });
    }

    let insert;
    try {
      insert = await client.query(
        `INSERT INTO hiring_contracts
           (offer_id, submission_id, template_ref, document_path, status, signing_entity, billing_mode, effective_start_date)
         VALUES ($1, $2, $3, $4, 'sent', $5, $6, $7::date)
         RETURNING *`,
        [offerId, submissionId, templateRef ?? null, documentPath ?? null, signingEntity,
          offer.billing_mode ?? null, offer.proposed_start_date ? new Date(offer.proposed_start_date).toISOString().slice(0, 10) : null],
      );
    } catch (err: any) {
      // Partial unique index uq_hiring_contracts_active_offer — race-safe duplicate guard
      if (err?.code === "23505") {
        throw new ContractError(409, {
          error: "active_contract_exists",
          message: "An active contract already exists for this offer. Void it before creating a new one.",
        });
      }
      throw err;
    }

    await client.query(
      `UPDATE job_submissions SET status = 'contract_sent', updated_at = NOW() WHERE id = $1`,
      [submissionId],
    );
    await client.query(
      `INSERT INTO job_application_status_history
         (application_id, previous_status, new_status, note, changed_by)
       VALUES ($1, $2, 'contract_sent', $3, $4)`,
      [submissionId, previousStatus, `Hiring contract sent (signing entity: ${signingEntity})`, adminId ?? null],
    );
    return insert.rows[0];
  });
}

/**
 * Update document/template and/or record signatures.
 * When both signatures are set, contract → 'signed' and submission → 'hired'
 * in the same transaction.
 */
export async function updateHiringContract(
  contractId: string,
  updates: {
    documentPath?: string;
    templateRef?: string;
    onspotSigned?: boolean;
    talentSigned?: boolean;
    onspotSignedAt?: Date | string;
    talentSignedAt?: Date | string;
    actorRole?: "admin" | "talent";
    adminId?: string | null;
  },
): Promise<Record<string, any>> {
  const {
    documentPath,
    templateRef,
    onspotSigned,
    talentSigned,
    onspotSignedAt,
    talentSignedAt,
    actorRole,
    adminId,
  } = updates;
  const result = await withTransaction(async (client) => {
    let hiredTransition: { submissionId: string; previousStatus: string } | null = null;
    const contractResult = await client.query(
      `SELECT * FROM hiring_contracts WHERE id = $1 FOR UPDATE`,
      [contractId],
    );
    if (contractResult.rows.length === 0) throw new ContractError(404, { error: "Contract not found" });
    const contract = contractResult.rows[0];
    if (contract.status === "void" || contract.status === "voided") {
      throw new ContractError(409, { error: "contract_void", message: "A voided contract cannot be updated." });
    }
    if (contract.status === "signed") {
      throw new ContractError(409, {
        error: "contract_signed",
        message: "A fully signed contract is immutable. Void it and issue a new contract to change its terms.",
      });
    }
    if (actorRole === "admin" && (talentSigned === true || talentSignedAt !== undefined)) {
      throw new ContractError(403, {
        error: "talent_signature_forbidden",
        message: "Only the authenticated talent can record the talent signature.",
      });
    }

    const sets: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (typeof documentPath === "string" && documentPath.trim()) {
      sets.push(`document_path = $${p++}`);
      params.push(documentPath.trim());
      if (contract.document_path && contract.document_path !== documentPath.trim()) {
        sets.push(`document_version = document_version + 1`);
      }
    }
    if (typeof templateRef === "string" && templateRef.trim()) {
      sets.push(`template_ref = $${p++}`);
      params.push(templateRef.trim());
    }
    if (onspotSigned === true && !contract.onspot_signed_at) {
      sets.push(`onspot_signed_at = $${p++}`);
      params.push(onspotSignedAt ?? new Date());
    }
    if (talentSigned === true && !contract.talent_signed_at) {
      sets.push(`talent_signed_at = $${p++}`);
      params.push(talentSignedAt ?? new Date());
    }
    if (sets.length === 0) {
      throw new ContractError(400, {
        error: "no_updates",
        message: "Provide at least one of: documentPath, templateRef, onspotSigned, talentSigned.",
      });
    }

    const willBeOnspotSigned = onspotSigned === true || !!contract.onspot_signed_at;
    const willBeTalentSigned = talentSigned === true || !!contract.talent_signed_at;
    const fullySigned = willBeOnspotSigned && willBeTalentSigned;
    if (fullySigned && contract.status !== "signed") {
      sets.push(`status = 'signed'`);
      sets.push(`billing_activated_at = NOW()`);
    }
    sets.push(`updated_at = NOW()`);

    const updated = await client.query(
      `UPDATE hiring_contracts SET ${sets.join(", ")} WHERE id = $${p} RETURNING *`,
      [...params, contractId],
    );

    // Terminal transition: both parties signed → submission 'hired'
    if (fullySigned) {
      const sub = await client.query(
        `SELECT id, status FROM job_submissions WHERE id = $1 FOR UPDATE`,
        [contract.submission_id],
      );
      const previousStatus: string | undefined = sub.rows[0]?.status;
      if (previousStatus !== "contract_sent") {
        throw new ContractError(409, {
          error: "submission_not_hireable",
          message:
            previousStatus === "withdrawn"
              ? "A withdrawn application cannot be marked as hired."
              : `This application cannot be marked as hired from status '${previousStatus ?? "unknown"}'.`,
          currentStatus: previousStatus ?? null,
        });
      }
      await client.query(
        `UPDATE job_submissions SET status = 'hired', updated_at = NOW() WHERE id = $1`,
        [contract.submission_id],
      );
      hiredTransition = {
        submissionId: contract.submission_id,
        previousStatus,
      };
      await client.query(
        `INSERT INTO job_application_status_history
           (application_id, previous_status, new_status, note, changed_by)
         VALUES ($1, $2, 'hired', 'Hiring contract fully signed by OnSpot and talent', $3)`,
        [contract.submission_id, previousStatus, adminId ?? null],
      );

      // Contract activation starts the deposit lifecycle. Keep this in the
      // same transaction as the signing transition so an active contract
      // cannot exist without its ledger deposit.
      const offerForDeposit = await client.query(
        `SELECT rate, rate_currency FROM offers WHERE id = $1`,
        [contract.offer_id],
      );
      const talentRate = Number(offerForDeposit.rows[0]?.rate);
      if (Number.isFinite(talentRate) && talentRate >= 0) {
        await client.query(
          `INSERT INTO security_deposits (hiring_contract_id, amount, currency, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT (hiring_contract_id) DO NOTHING`,
          [
            contract.id,
            computeDepositAmount(talentRate).toFixed(2),
            offerForDeposit.rows[0]?.rate_currency || "PHP",
          ],
        );
      }
    }
    return { contract: updated.rows[0], hiredTransition };
  });

  if (result.hiredTransition) {
    const { submissionId, previousStatus } = result.hiredTransition;
    try {
      const contextResult = await query(
        `SELECT js.talent_id, js.client_id, js.email, js.first_name, js.last_name,
                js.applicant_name, js.job_id, j.title AS job_title, j.company AS company_name,
                c.id AS candidate_id
           FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN candidates c ON c.user_id = js.talent_id
          WHERE js.id = $1
          LIMIT 1`,
        [submissionId],
      );
      const context = contextResult.rows[0];
      if (context) {
        const talentName =
          [context.first_name, context.last_name].filter(Boolean).join(" ")
          || context.applicant_name
          || "The Talent";
        await Promise.all([
          notifyTalentOfApplicationStatusChange({
            submissionId,
            talentUserId: context.talent_id,
            candidateId: context.candidate_id,
            applicantEmail: context.email,
            jobTitle: context.job_title,
            companyName: context.company_name,
            previousStatus,
            newStatus: "hired",
            eventKey: `application-status:${submissionId}:${previousStatus}:hired`,
          }),
          notifyClientOfTalentHired({
            submissionId,
            clientUserId: context.client_id,
            talentName,
            jobTitle: context.job_title,
          }),
        ]);
        void sendTalentHiredEmail({
          submissionId,
          talentUserId: context.talent_id,
          recipientEmail: context.email,
          firstName: context.first_name,
          lastName: context.last_name,
          applicantName: context.applicant_name,
          jobId: context.job_id,
          jobTitle: context.job_title,
          companyName: context.company_name,
        });
      }
    } catch (error) {
      console.error(`[hiring-contract] committed Hired side effects failed for ${submissionId}:`, error);
    }
  }

  return result.contract;
}

/**
 * Void a contract. A fully signed contract cannot be voided.
 * If the submission was waiting on this contract ('contract_sent'), it rolls
 * back to 'offer_accepted' in the same transaction.
 */
export async function voidHiringContract(
  contractId: string,
  reason: string,
  adminId?: string | null,
): Promise<Record<string, any>> {
  const trimmed = String(reason ?? "").trim();
  if (!trimmed) throw new ContractError(400, { error: "reason is required to void a contract" });

  return withTransaction(async (client) => {
    const contractResult = await client.query(
      `SELECT * FROM hiring_contracts WHERE id = $1 FOR UPDATE`,
      [contractId],
    );
    if (contractResult.rows.length === 0) throw new ContractError(404, { error: "Contract not found" });
    const contract = contractResult.rows[0];
    if (contract.status === "void" || contract.status === "voided") {
      throw new ContractError(409, { error: "already_void", message: "This contract is already void." });
    }
    if (contract.status === "signed") {
      throw new ContractError(409, {
        error: "contract_signed",
        message: "A fully signed contract cannot be voided.",
      });
    }

    const updated = await client.query(
      `UPDATE hiring_contracts
       SET status = 'void', voided_at = NOW(), voided_reason = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [trimmed, contractId],
    );

    const sub = await client.query(
      `SELECT id, status FROM job_submissions WHERE id = $1 FOR UPDATE`,
      [contract.submission_id],
    );
    if (sub.rows[0]?.status === "contract_sent") {
      await client.query(
        `UPDATE job_submissions SET status = 'offer_accepted', updated_at = NOW() WHERE id = $1`,
        [contract.submission_id],
      );
      await client.query(
        `INSERT INTO job_application_status_history
           (application_id, previous_status, new_status, note, changed_by)
         VALUES ($1, 'contract_sent', 'offer_accepted', $2, $3)`,
        [contract.submission_id, `Contract voided: ${trimmed}`, adminId ?? null],
      );
    }
    return updated.rows[0];
  });
}
