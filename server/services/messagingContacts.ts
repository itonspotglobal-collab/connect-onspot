import { query } from "../db";
import { maskClientTalentName } from "../../shared/talentName";
import { nameRevealExistsSQL } from "./formalPipelineGuard";

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

export function activeHireExistsSQL(applicationParam: string) {
  return `EXISTS (SELECT 1 FROM job_submissions js WHERE js.id = ${applicationParam}
    AND ${ACTIVE_HIRE_SUBMISSION_SQL})`;
}

export async function listMessagingContacts(userId: string, role: "client" | "talent") {
  const result = await query(
    `SELECT js.id AS application_id, js.job_id, j.title AS job_title,
       client.id AS client_id, talent.id AS talent_id,
       talent.first_name, talent.last_name, talent.username,
       TRIM(CONCAT_WS(' ',talent.first_name,talent.last_name)) AS talent_name,
       TRIM(CONCAT_WS(' ',client.first_name,client.last_name)) AS client_name,
       cp.company_name, cp.contact_person,
       ${nameRevealExistsSQL("client.id", "talent.id")} AS name_revealed,
       (SELECT GREATEST(hc.talent_signed_at,hc.onspot_signed_at,hc.billing_activated_at,
          (SELECT MAX(cd.executed_at) FROM contract_documents cd
            WHERE cd.hiring_contract_id=hc.id AND cd.status='executed')) FROM hiring_contracts hc
         WHERE hc.submission_id = js.id AND ${ACTIVE_CONTRACT_SQL}
         ORDER BY hc.onspot_signed_at DESC, hc.id LIMIT 1) AS hired_at,
       thread.id AS thread_id,
       COALESCE((SELECT COUNT(*) FROM messages m WHERE m.thread_id = thread.id
         AND m.sender_id <> $1
         AND NOT ($1 = ANY(COALESCE(m.read_by, '{}'::text[])))),0)::int AS unread_count
     FROM job_submissions js
     JOIN jobs j ON j.id = js.job_id AND j.client_id = js.client_id
     JOIN users client ON client.id = js.client_id AND client.role = 'client'
     JOIN users talent ON talent.id = js.talent_id AND talent.role = 'talent'
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
       AND ${ACTIVE_HIRE_SUBMISSION_SQL}
     ORDER BY hired_at DESC, js.id`, [userId],
  );
  return result.rows.map(row => ({
    applicationId: row.application_id,
    jobId: row.job_id,
    jobTitle: row.job_title,
    hiredAt: row.hired_at,
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
