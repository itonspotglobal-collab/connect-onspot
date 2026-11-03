import { query } from "../db";
import { maskClientTalentName } from "../../shared/talentName";
import { FORMAL_PIPELINE_PREDICATE, nameRevealExistsSQL } from "./formalPipelineGuard";
import type { PoolClient } from "pg";

// An administrative activation exception is not evidence of signatures.
// Legacy OnSpot agreements have the two signature timestamps; managed PDFs
// additionally require their executed document and all required signing parties.
const ACTIVE_CONTRACT_SQL = `hc.status = 'signed'
  AND hc.talent_signed_at IS NOT NULL AND hc.onspot_signed_at IS NOT NULL
  AND hc.voided_at IS NULL
  AND (hc.effective_end_date IS NULL OR hc.effective_end_date >=
    (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(
      (SELECT name FROM pg_timezone_names WHERE name = hc.work_timezone LIMIT 1), 'UTC'))::date)
  AND (
    (NOT hc.document_managed AND hc.party_type = 'onspot')
    OR EXISTS (
      SELECT 1 FROM contract_documents cd
       WHERE cd.hiring_contract_id = hc.id AND cd.status = 'executed'
         AND cd.executed_at IS NOT NULL
         AND EXISTS (SELECT 1 FROM contract_signatures cs
           WHERE cs.document_id = cd.id AND cs.signer_role = 'talent'
             AND cs.document_sha256 = cd.sha256 AND cs.document_version = cd.version)
         AND EXISTS (SELECT 1 FROM contract_signatures cs
           WHERE cs.document_id = cd.id AND cs.signer_role = 'onspot'
             AND cs.document_sha256 = cd.sha256 AND cs.document_version = cd.version)
         AND (hc.party_type = 'onspot' OR EXISTS (
           SELECT 1 FROM contract_signatures cs
            WHERE cs.document_id = cd.id AND cs.signer_role = hc.party_type
              AND cs.document_sha256 = cd.sha256 AND cs.document_version = cd.version))
    )
  )`;

export const ACTIVE_HIRE_SUBMISSION_SQL = `js.status = 'hired'
  AND js.workflow_type IN ('application','client_invitation')
  AND js.talent_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM hiring_contracts hc
    WHERE hc.submission_id = js.id AND ${ACTIVE_CONTRACT_SQL})`;

/**
 * Messaging deliberately allows formal hires whose paperwork is still pending,
 * including Super Admin overrides and hires without a contract, so both parties
 * can communicate urgently. This is NOT billing, timesheet or roster eligibility.
 * A void/terminated agreement or an elapsed final work day still closes access.
 */
export const MESSAGING_ELIGIBLE_SUBMISSION_SQL = `js.${FORMAL_PIPELINE_PREDICATE}
  AND js.status = 'hired'
  AND NOT EXISTS (SELECT 1 FROM hiring_contracts hc WHERE hc.submission_id=js.id
    AND (hc.status IN ('void','voided','terminated') OR hc.voided_at IS NOT NULL
      OR (hc.effective_end_date IS NOT NULL AND hc.effective_end_date <
        (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(
          (SELECT name FROM pg_timezone_names WHERE name=hc.work_timezone LIMIT 1),'UTC'))::date)))`;

// Kept as the existing messaging-only interface; financial eligibility continues
// to use its own predicates, and ACTIVE_HIRE_SUBMISSION_SQL remains unchanged.
export function activeHireExistsSQL(applicationParam: string) {
  return `EXISTS (SELECT 1 FROM job_submissions js WHERE js.id = ${applicationParam}
    AND ${MESSAGING_ELIGIBLE_SUBMISSION_SQL})`;
}

export function messagingNameRevealExistsSQL(clientParam: string, talentParam: string) {
  return `(${nameRevealExistsSQL(clientParam, talentParam)} OR EXISTS (
    SELECT 1 FROM job_submissions js WHERE
      ((js.client_id=${clientParam} AND js.talent_id=${talentParam})
        OR (js.client_id=${talentParam} AND js.talent_id=${clientParam}))
      AND ${MESSAGING_ELIGIBLE_SUBMISSION_SQL}))`;
}

export function hiredHistoryExistsSQL(applicationParam: string) {
  return `EXISTS (SELECT 1 FROM job_application_status_history history
    WHERE history.application_id=${applicationParam} AND history.new_status='hired')`;
}

/** Recheck under row locks inside the send transaction, preserving pre-hire chat. */
export async function canSendHireMessage(
  db: Pick<PoolClient, "query">,
  thread: { participants: string[]; jobId: string | null },
) {
  if (thread.participants.length !== 2) return true;
  const related = await db.query(
    `SELECT js.id FROM job_submissions js
      WHERE js.client_id=ANY($1::text[]) AND js.talent_id=ANY($1::text[])
        AND js.client_id<>js.talent_id AND ($2::text IS NULL OR js.job_id=$2)
      ORDER BY js.id FOR SHARE OF js`, [thread.participants, thread.jobId],
  );
  const ids = related.rows.map(row => row.id);
  if (!ids.length) return true;
  await db.query(`SELECT id FROM hiring_contracts WHERE submission_id=ANY($1::text[])
    ORDER BY id FOR SHARE`, [ids]);
  const result = await db.query(
    `SELECT EXISTS (SELECT 1 FROM job_submissions js WHERE js.id=ANY($1::text[])
        AND (js.status='hired' OR ${hiredHistoryExistsSQL("js.id")})) AS hire_scoped,
      EXISTS (SELECT 1 FROM job_submissions js WHERE js.id=ANY($1::text[])
        AND ${MESSAGING_ELIGIBLE_SUBMISSION_SQL}) AS eligible`, [ids],
  );
  return !result.rows[0].hire_scoped || result.rows[0].eligible;
}

export async function listMessagingContacts(userId: string, role: "client" | "talent") {
  const result = await query(
    `SELECT js.id AS application_id, js.job_id, j.title AS job_title,
       client.id AS client_id, talent.id AS talent_id,
       talent.first_name, talent.last_name, talent.username,
       TRIM(CONCAT_WS(' ',talent.first_name,talent.last_name)) AS talent_name,
       TRIM(CONCAT_WS(' ',client.first_name,client.last_name)) AS client_name,
       cp.company_name, cp.contact_person,
       ${messagingNameRevealExistsSQL("client.id", "talent.id")} AS name_revealed,
       COALESCE(GREATEST(hc.talent_signed_at,hc.onspot_signed_at),hc.billing_activated_at,
         (SELECT MAX(history.created_at) FROM job_application_status_history history
           WHERE history.application_id=js.id AND history.new_status='hired'),js.updated_at) AS hired_at,
       NOT EXISTS (SELECT 1 FROM hiring_contracts hc
         WHERE hc.submission_id=js.id AND ${ACTIVE_CONTRACT_SQL}) AS paperwork_pending,
       thread.id AS thread_id,
       COALESCE((SELECT COUNT(*) FROM messages m WHERE m.thread_id = thread.id
         AND m.sender_id <> $1
         AND NOT ($1 = ANY(COALESCE(m.read_by, '{}'::text[])))),0)::int AS unread_count
     FROM job_submissions js
     JOIN jobs j ON j.id = js.job_id AND j.client_id = js.client_id
     JOIN users client ON client.id = js.client_id AND client.role = 'client'
     JOIN users talent ON talent.id = js.talent_id AND talent.role = 'talent'
     LEFT JOIN LATERAL (
       SELECT hc.* FROM hiring_contracts hc WHERE hc.submission_id=js.id
        ORDER BY hc.created_at DESC,hc.id LIMIT 1
     ) hc ON TRUE
     LEFT JOIN LATERAL (
       SELECT company_name,contact_person FROM client_profiles
        WHERE user_id = client.id ORDER BY created_at DESC LIMIT 1
     ) cp ON TRUE
     LEFT JOIN LATERAL (
       SELECT mt.id FROM message_threads mt
        WHERE mt.participants @> ARRAY[client.id,talent.id]::text[]
          AND mt.participants <@ ARRAY[client.id,talent.id]::text[]
          AND (mt.job_id = js.job_id OR mt.job_id IS NULL)
        ORDER BY (mt.job_id IS NOT NULL) DESC, mt.created_at, mt.id LIMIT 1
     ) thread ON TRUE
     WHERE ${role === "client" ? "client.id" : "talent.id"} = $1
       AND ${MESSAGING_ELIGIBLE_SUBMISSION_SQL}
     ORDER BY hired_at DESC, js.id`, [userId],
  );
  return result.rows.map(row => ({
    applicationId: row.application_id,
    jobId: row.job_id,
    jobTitle: row.job_title,
    hiredAt: row.hired_at,
    paperworkPending: row.paperwork_pending,
    personName: role === "talent" ? row.client_name || "Client"
      : row.name_revealed ? row.talent_name || row.username || "Talent"
        : maskClientTalentName({ firstName: row.first_name, lastName: row.last_name, fullName: row.talent_name }),
    companyName: role === "talent" ? row.company_name : null,
    contactPerson: role === "talent" ? row.contact_person || row.client_name || "Client" : null,
    otherUserId: role === "talent" ? row.client_id : row.talent_id,
    threadId: row.thread_id,
    unreadCount: row.unread_count,
  }));
}
