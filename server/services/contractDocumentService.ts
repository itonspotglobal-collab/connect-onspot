import { getClient, query } from "../db";
import type { PoolClient } from "pg";
import { ContractError, createHiringContract, updateHiringContract, voidHiringContract, dispatchHiringActivation } from "./hiringContractService";
import { FORMAL_PIPELINE_PREDICATE } from "./formalPipelineGuard";
import { contractBlobProvider, executedContractPdf, pdfHash, validateContractPdf, type ContractBlobProvider } from "./contractBlobStore";

export type ContractActor = { id: string };
const deny = () => new ContractError(404, { error: "Contract not found or forbidden" });
const baseSelect = `SELECT hc.*, js.client_id,js.talent_id,js.status AS submission_status,
 j.title AS job_title, COALESCE(NULLIF(TRIM(CONCAT(t.first_name,' ',t.last_name)),''),'Talent') AS talent_name,
 COALESCE(NULLIF(c.company,''),NULLIF(TRIM(CONCAT(c.first_name,' ',c.last_name)),''),'Client') AS client_name,
 t.email AS talent_email, c.email AS client_email, o.rate,o.rate_currency,o.engagement_type,o.proposed_start_date,
 org.name AS organization_name
 FROM hiring_contracts hc JOIN job_submissions js ON js.id=hc.submission_id JOIN jobs j ON j.id=js.job_id
 JOIN offers o ON o.id=hc.offer_id JOIN users t ON t.id=js.talent_id JOIN users c ON c.id=js.client_id
 LEFT JOIN organizations org ON org.id=hc.organization_id`;

async function transaction<T>(fn: (tx: PoolClient) => Promise<T>) {
  const tx = await getClient();
  try { await tx.query("BEGIN"); const value = await fn(tx); await tx.query("COMMIT"); return value; }
  catch (error) { await tx.query("ROLLBACK").catch(() => {}); throw error; }
  finally { tx.release(); }
}
export async function contractAuthority(tx: Pick<PoolClient, "query">, row: any, actor: ContractActor) {
  const user = (await tx.query("SELECT id,role FROM users WHERE id=$1", [actor.id])).rows[0];
  if (!user) throw deny();
  const admin = user.role === "admin";
  const talent = user.role === "talent" && row.talent_id === actor.id;
  if (talent && row.status === "draft") throw deny();
  const client = user.role === "client" && row.client_id === actor.id;
  let owner = false;
  if (row.organization_id && user.role === "client") {
    // The hiring Client itself must be an ACTIVE member of the same organization.
    const membership = await tx.query(
      `SELECT m.role FROM organization_members m
       WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='active'
       AND EXISTS (SELECT 1 FROM organization_members hiring_owner
         WHERE hiring_owner.organization_id=m.organization_id AND hiring_owner.user_id=$3 AND hiring_owner.status='active')
       AND EXISTS(SELECT 1 FROM organizations org WHERE org.id=m.organization_id AND org.delete_due_at IS NULL)`,
      [row.organization_id, actor.id, row.client_id]);
    owner = membership.rows[0]?.role === "owner";
  }
  if (!admin && !talent && !client && !owner) throw deny();
  const representative = row.party_type === "organization" ? owner : row.party_type === "client" && client;
  const manage = admin || (row.party_type === "organization" ? owner : client);
  const slot = talent ? "talent" : admin ? "onspot" : representative ? row.party_type : null;
  return { canView: true, canManage: manage, canPrepare: manage && row.status === "draft",
    canSend: manage && row.status === "draft", canSign: !!slot && row.status === "sent",
    canVoid: (admin || (manage && (row.party_type !== "onspot" || row.prepared_by === actor.id))) && ["draft", "sent"].includes(row.status),
    canDecline: talent && row.status === "sent", signerRole: slot };
}
async function load(tx: PoolClient, id: string, actor: ContractActor, lock = true) {
  const row = (await tx.query(`${baseSelect} WHERE hc.id=$1 ${lock ? "FOR UPDATE OF hc,js" : ""}`, [id])).rows[0];
  if (!row) throw deny();
  const permissions = await contractAuthority(tx, row, actor);
  return { row, permissions };
}
async function currentDocument(tx: PoolClient, id: string) {
  return (await tx.query(`SELECT * FROM contract_documents WHERE hiring_contract_id=$1 ORDER BY version DESC LIMIT 1`, [id])).rows[0];
}
function assertActive(row: any) {
  if (!["offer_accepted", "contract_sent"].includes(row.submission_status)) {
    throw new ContractError(409, { error: "application_not_contractable", message: "This application is no longer awaiting contract signatures." });
  }
}
async function event(tx: PoolClient, contractId: string, documentId: string | null, actorId: string, action: string) {
  await tx.query("INSERT INTO contract_document_events(hiring_contract_id,document_id,actor_user_id,action,created_at) VALUES($1,$2,$3,$4,clock_timestamp())",
    [contractId, documentId, actorId, action]);
  if (documentId && ["sent", "talent_signed", "client_signed", "organization_signed", "onspot_signed", "executed", "voided", "declined"].includes(action)) {
    const recipients = await tx.query(
      `SELECT DISTINCT u.id FROM hiring_contracts hc JOIN job_submissions js ON js.id=hc.submission_id
       JOIN users u ON u.id IN (js.talent_id,js.client_id,hc.prepared_by) OR u.role='admin'
         OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=hc.organization_id
             AND m.user_id=u.id AND m.role='owner' AND m.status='active')
       WHERE hc.id=$1`, [contractId]);
    for (const recipient of recipients.rows) {
      await tx.query(`INSERT INTO notifications(user_id,type,title,message,related_id,related_type,event_key)
        VALUES($1,'contract_update','Contract update',$2,$3,'contract',$4) ON CONFLICT DO NOTHING`,
        [recipient.id, `Contract ${action.replace(/_/g, " ")}. Review the document and required signatures in OnSpot.`,
          contractId, `contract:${documentId}:${action}:${recipient.id}`]);
      await tx.query(`INSERT INTO contract_delivery_events(document_id,event_type,recipient_user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [documentId, action, recipient.id]);
    }
  }
}
export async function contractOfferContext(offerId: string, actor: ContractActor, existing?: PoolClient) {
  const own = !existing, tx = existing ?? await getClient();
  try {
    const row = (await tx.query(
      `SELECT o.*,js.client_id,js.talent_id,js.status AS submission_status,j.title AS job_title,
       CONCAT(t.first_name,' ',t.last_name) AS talent_name,
       COALESCE(NULLIF(c.company,''),NULLIF(TRIM(CONCAT(c.first_name,' ',c.last_name)),''),'Client') AS client_name,u.role AS actor_role
       FROM offers o JOIN job_submissions js ON js.id=o.submission_id JOIN jobs j ON j.id=js.job_id
       JOIN users t ON t.id=js.talent_id JOIN users c ON c.id=js.client_id JOIN users u ON u.id=$2
       WHERE o.id=$1 AND js.${FORMAL_PIPELINE_PREDICATE}
         AND (u.role='admin' OR (u.role='client' AND (js.client_id=u.id OR EXISTS(
           SELECT 1 FROM organization_members mine JOIN organization_members theirs ON theirs.organization_id=mine.organization_id
           JOIN organizations org ON org.id=mine.organization_id
           WHERE mine.user_id=u.id AND mine.role='owner' AND mine.status='active'
             AND theirs.user_id=js.client_id AND theirs.status='active' AND org.delete_due_at IS NULL))))`,
      [offerId, actor.id])).rows[0];
    if (!row) throw deny();
    if (!["accepted", "offer_accepted"].includes(row.status) || row.submission_status !== "offer_accepted") throw new ContractError(409, { error: "accepted_offer_required" });
    const organizations = (await tx.query(
      `SELECT DISTINCT org.id,org.name FROM organizations org JOIN organization_members hiring_owner ON hiring_owner.organization_id=org.id
        WHERE hiring_owner.user_id=$1 AND hiring_owner.status='active' AND org.delete_due_at IS NULL
          AND ($2='admin' OR EXISTS(SELECT 1 FROM organization_members mine
            WHERE mine.organization_id=org.id AND mine.user_id=$3 AND mine.role='owner' AND mine.status='active'))`,
      [row.client_id, row.actor_role, actor.id])).rows;
    const allowed = row.actor_role === "admin" || row.client_id === actor.id ? ["onspot", "client"] : [];
    if (organizations.length) allowed.push("organization");
    return { offerId, talentName: row.talent_name, jobTitle: row.job_title, clientName: row.client_name,
      rate: row.rate, currency: row.rate_currency, engagementType: row.engagement_type, startDate: row.proposed_start_date,
      allowedPartyTypes: allowed, organizations };
  } finally { if (own) tx.release(); }
}
export async function prepareContract(actor: ContractActor, body: any) {
  return transaction(async tx => {
    const context = await contractOfferContext(body.offerId, actor, tx);
    const party = body.partyType ?? "onspot";
    if (!context.allowedPartyTypes.includes(party) ||
        (party === "organization" && !context.organizations.some(org => org.id === body.organizationId))) throw deny();
    const title = String(body.title ?? "Hiring agreement").trim(), message = String(body.message ?? "").trim();
    if (!title || title.length > 200 || message.length > 5000) throw new ContractError(400, { error: "invalid_contract_details" });
    const contract = await createHiringContract({ offerId: body.offerId, adminId: actor.id, prepareOnly: true, transactionClient: tx });
    const row = (await tx.query(`UPDATE hiring_contracts SET party_type=$1,organization_id=$2,prepared_by=$3,title=$4,talent_message=$5,document_managed=true WHERE id=$6 RETURNING *`,
      [party, party === "organization" ? body.organizationId : null, actor.id, title, message, contract.id])).rows[0];
    await event(tx, row.id, null, actor.id, "prepared");
    return { id: row.id };
  });
}
export async function acceptedContractOffers(actor: ContractActor) {
  return transaction(async tx => {
    const ids = (await tx.query(`SELECT o.id FROM offers o JOIN job_submissions js ON js.id=o.submission_id
      JOIN users u ON u.id=$1 WHERE o.status IN ('accepted','offer_accepted') AND js.status='offer_accepted'
      AND (u.role='admin' OR (u.role='client' AND (js.client_id=u.id OR EXISTS(
        SELECT 1 FROM organization_members mine JOIN organization_members theirs ON theirs.organization_id=mine.organization_id
        JOIN organizations org ON org.id=mine.organization_id
        WHERE mine.user_id=u.id AND mine.role='owner' AND mine.status='active'
          AND theirs.user_id=js.client_id AND theirs.status='active' AND org.delete_due_at IS NULL))))
      AND NOT EXISTS(SELECT 1 FROM hiring_contracts hc WHERE hc.offer_id=o.id AND hc.status NOT IN ('void','voided'))
      ORDER BY o.created_at DESC LIMIT 100`, [actor.id])).rows;
    const contexts = [];
    for (const { id } of ids) {
      try { contexts.push(await contractOfferContext(id, actor, tx)); }
      catch (error) { if (error instanceof ContractError && [404,409].includes(error.status)) continue; throw error; }
    }
    return contexts;
  });
}
export async function uploadContractPdf(id: string, actor: ContractActor, file: any, blobs = contractBlobProvider) {
  if (!file) throw new ContractError(400, { error: "pdf_required" });
  const validation = await validateContractPdf(file);
  let key: string | undefined;
  try {
    return await transaction(async tx => {
      const { row, permissions } = await load(tx, id, actor);
      assertActive(row);
      if (!permissions.canPrepare || !row.document_managed) throw new ContractError(409, { error: "draft_document_required" });
      const previous = await currentDocument(tx, id);
      if (previous && previous.status !== "draft") throw new ContractError(409, { error: "document_immutable" });
      key = await blobs.save(file.buffer);
      // Verify actual bytes were stored, rather than trusting an upload response.
      if (pdfHash(await blobs.read(key)) !== validation.sha256) throw new ContractError(502, { error: "upload_verification_failed" });
      if (previous) await tx.query("UPDATE contract_documents SET status='superseded' WHERE id=$1", [previous.id]);
      const version = (previous?.version ?? 0) + 1;
      const document = (await tx.query(
        `INSERT INTO contract_documents(hiring_contract_id,object_key,original_filename,mime_type,file_size,sha256,version,uploaded_by)
         VALUES($1,$2,$3,'application/pdf',$4,$5,$6,$7) RETURNING id,version,sha256,status,original_filename,file_size`,
        [id, key, validation.filename, validation.size, validation.sha256, version, actor.id])).rows[0];
      await tx.query("UPDATE hiring_contracts SET document_path=$1,document_version=$2,updated_at=NOW() WHERE id=$3", [key, version, id]);
      await event(tx, id, document.id, actor.id, previous ? "draft_replaced" : "uploaded");
      return document;
    });
  } catch (error) { if (key) await blobs.remove(key).catch(() => {}); throw error; }
}
export async function contractDetail(id: string, actor: ContractActor) {
  return transaction(async tx => {
    const { row, permissions } = await load(tx, id, actor, false);
    const document = await currentDocument(tx, id);
    const signatures = document ? (await tx.query(
      `SELECT s.signer_role,s.legal_name,s.signed_at,s.signature_method,s.document_version,s.document_sha256,
        org.name AS organization_name FROM contract_signatures s LEFT JOIN organizations org ON org.id=s.organization_id
        WHERE s.document_id=$1 ORDER BY s.signed_at`, [document.id])).rows : [];
    const timeline = (await tx.query(`SELECT e.action,e.created_at,COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''),'Account') AS actor_name
      FROM contract_document_events e JOIN users u ON u.id=e.actor_user_id WHERE e.hiring_contract_id=$1 ORDER BY e.created_at`, [id])).rows;
    if (signatures.some(s => s.signer_role === permissions.signerRole)) permissions.canSign = false;
    if (!document || !["sent_for_signature", "talent_signed", "countersigned"].includes(document.status)) permissions.canSign = false;
    // Storage references and security audit data never enter ordinary DTOs.
    const { document_path, talent_email, client_email, ...safe } = row;
    if (document) { delete document.object_key; delete document.executed_object_key; }
    return { contract: safe, document: document ?? null, signatures, timeline, permissions };
  });
}
export async function listContracts(actor: ContractActor) {
  return transaction(async tx => {
    const rows = (await tx.query(`${baseSelect} WHERE EXISTS (
      SELECT 1 FROM users actor WHERE actor.id=$1 AND (
        actor.role='admin' OR (actor.role='talent' AND js.talent_id=actor.id AND hc.status<>'draft')
        OR (actor.role='client' AND (js.client_id=actor.id OR EXISTS(
          SELECT 1 FROM organization_members mine JOIN organization_members theirs ON theirs.organization_id=mine.organization_id
          JOIN organizations scoped_org ON scoped_org.id=mine.organization_id
          WHERE mine.organization_id=hc.organization_id AND mine.user_id=actor.id AND mine.role='owner' AND mine.status='active'
            AND theirs.user_id=js.client_id AND theirs.status='active' AND scoped_org.delete_due_at IS NULL)))
      )) ORDER BY hc.created_at DESC LIMIT 500`, [actor.id])).rows;
    const allowed = [];
    for (const row of rows) {
      try { await contractAuthority(tx, row, actor); }
      catch (error) { if (error instanceof ContractError && error.status === 404) continue; throw error; }
      const doc = await currentDocument(tx, row.id);
      const { document_path, talent_email, client_email, ...safe } = row;
      allowed.push({ ...safe, document_status: doc?.status ?? null });
    }
    return allowed;
  });
}
export async function contractPdf(id: string, actor: ContractActor, executed = false, blobs = contractBlobProvider) {
  return transaction(async tx => {
    await load(tx, id, actor);
    const document = await currentDocument(tx, id);
    if (!document || (executed && !document.executed_object_key)) throw new ContractError(404, { error: "document_not_available" });
    const bytes = await blobs.read(executed ? document.executed_object_key : document.object_key);
    if (pdfHash(bytes) !== (executed ? document.executed_sha256 : document.sha256)) throw new ContractError(409, { error: "document_changed" });
    if (!executed) await tx.query(
      `INSERT INTO contract_document_reviews(document_id,user_id,sha256) VALUES($1,$2,$3)
       ON CONFLICT(document_id,user_id) DO UPDATE SET sha256=EXCLUDED.sha256,reviewed_at=NOW()`,
      [document.id, actor.id, document.sha256]);
    return { bytes, filename: document.original_filename };
  });
}
export async function sendContract(id: string, actor: ContractActor, blobs = contractBlobProvider) {
  return transaction(async tx => {
    const { row, permissions } = await load(tx, id, actor);
    assertActive(row);
    if (row.status === "sent" && permissions.canManage) return { id, alreadySent: true };
    if (!permissions.canSend) throw deny();
    const document = await currentDocument(tx, id);
    if (!document || document.status !== "draft") throw new ContractError(409, { error: "draft_pdf_required" });
    if (pdfHash(await blobs.read(document.object_key)) !== document.sha256) throw new ContractError(409, { error: "document_changed" });
    const reviewed = await tx.query("SELECT 1 FROM contract_document_reviews WHERE document_id=$1 AND user_id=$2 AND sha256=$3",
      [document.id, actor.id, document.sha256]);
    if (!reviewed.rows.length) throw new ContractError(409, { error: "review_pdf_first" });
    await tx.query("UPDATE contract_documents SET status='sent_for_signature',sent_at=NOW() WHERE id=$1", [document.id]);
    await tx.query("UPDATE hiring_contracts SET status='sent',updated_at=NOW() WHERE id=$1", [id]);
    await tx.query("UPDATE job_submissions SET status='contract_sent',updated_at=NOW() WHERE id=$1", [row.submission_id]);
    await tx.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,'contract_sent','Private contract PDF sent for signature',$3)`, [row.submission_id, row.submission_status, actor.id]);
    await event(tx, id, document.id, actor.id, "sent");
    return { id, alreadySent: false };
  });
}
export async function signContractPdf(id: string, actor: ContractActor, body: any, audit: Record<string, string> = {}, blobs = contractBlobProvider) {
  const name = typeof body.legalName === "string" ? body.legalName.trim() : "";
  if (body.consent !== true || name.length < 3 || name.length > 200 || /[\x00-\x1f]/.test(name)) throw new ContractError(400, { error: "signature_consent_required" });
  let executedKey: string | undefined;
  let result;
  try {
    result = await transaction(async tx => {
      const { row, permissions } = await load(tx, id, actor);
      assertActive(row);
      const document = await currentDocument(tx, id);
      if (!permissions.canSign || !document || !["sent_for_signature", "talent_signed", "countersigned"].includes(document.status)) throw new ContractError(409, { error: "contract_not_signable" });
      if (body.documentId !== document.id || body.sha256 !== document.sha256) throw new ContractError(409, { error: "document_version_changed" });
      if (!(await tx.query("SELECT 1 FROM contract_document_reviews WHERE document_id=$1 AND user_id=$2 AND sha256=$3",
        [document.id, actor.id, document.sha256])).rows.length) throw new ContractError(409, { error: "review_pdf_first" });
      const bytes = await blobs.read(document.object_key);
      if (pdfHash(bytes) !== document.sha256) throw new ContractError(409, { error: "document_changed" });
      const role = permissions.signerRole!;
      if ((await tx.query("SELECT 1 FROM contract_signatures WHERE document_id=$1 AND signer_role=$2", [document.id, role])).rows.length) {
        throw new ContractError(409, { error: "already_signed" });
      }
      await tx.query(`INSERT INTO contract_signatures(document_id,signer_user_id,signer_role,legal_name,document_version,document_sha256,organization_id,authority_context,audit_metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [document.id, actor.id, role, name, document.version, document.sha256,
          role === "organization" ? row.organization_id : null,
          role === "organization" ? "active organization owner" : role === "onspot" ? row.signing_entity : "canonical hiring party", JSON.stringify(audit)]);
      await event(tx, id, document.id, actor.id, `${role}_signed`);
      const signatures = (await tx.query(`SELECT s.*,org.name AS organization_name FROM contract_signatures s
        LEFT JOIN organizations org ON org.id=s.organization_id WHERE document_id=$1 ORDER BY signed_at`, [document.id])).rows;
      const required = row.party_type === "onspot" ? ["talent", "onspot"] : ["talent", row.party_type, "onspot"];
      const complete = required.every(requiredRole => signatures.some(s => s.signer_role === requiredRole));
      const hasTalent = signatures.some(s => s.signer_role === "talent");
      const countersigned = hasTalent && signatures.some(s => s.signer_role !== "talent");
      await tx.query("UPDATE contract_documents SET status=$1 WHERE id=$2",
        [complete ? "executed" : countersigned ? "countersigned" : hasTalent ? "talent_signed" : "sent_for_signature", document.id]);
      if (countersigned) await event(tx, id, document.id, actor.id, "countersigned");
      if (complete) {
        const executedBytes = await executedContractPdf(bytes, document, signatures);
        executedKey = await blobs.save(executedBytes);
        const executedHash = pdfHash(executedBytes);
        if (pdfHash(await blobs.read(executedKey)) !== executedHash) throw new ContractError(502, { error: "executed_copy_verification_failed" });
        const talentSig = signatures.find(s => s.signer_role === "talent"), onspotSig = signatures.find(s => s.signer_role === "onspot");
        await updateHiringContract(id, { talentSigned: true, onspotSigned: true,
          talentSignedAt: talentSig.signed_at, onspotSignedAt: onspotSig.signed_at, adminId: actor.id },
          { transactionClient: tx, documentId: document.id });
        await tx.query("UPDATE contract_documents SET executed_at=NOW(),executed_object_key=$1,executed_sha256=$2 WHERE id=$3", [executedKey, executedHash, document.id]);
        await event(tx, id, document.id, actor.id, "executed");
      }
      return { id, executed: complete };
    });
  } catch (error) { if (executedKey) await blobs.remove(executedKey).catch(() => {}); throw error; }
  if (result.executed) {
    const row = (await query("SELECT submission_id FROM hiring_contracts WHERE id=$1", [id])).rows[0];
    await dispatchHiringActivation(row.submission_id);
  }
  return result;
}
export async function closeContract(id: string, actor: ContractActor, reason: string, decline = false) {
  if (typeof reason !== "string" || !reason.trim() || reason.length > 2000) {
    throw new ContractError(400, { error: "invalid_reason", message: "Provide a reason of 1–2,000 characters." });
  }
  return transaction(async tx => {
    const { row, permissions } = await load(tx, id, actor);
    if (decline ? !permissions.canDecline : !permissions.canVoid) throw deny();
    const document = await currentDocument(tx, id);
    await voidHiringContract(id, reason, actor.id, tx);
    if (document) await tx.query("UPDATE contract_documents SET status=$1 WHERE id=$2", [decline ? "declined" : "voided", document.id]);
    await event(tx, id, document?.id ?? null, actor.id, decline ? "declined" : "voided");
    return { id };
  });
}
