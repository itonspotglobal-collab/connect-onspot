import sanitizeHtml from "sanitize-html";
import type { Pool, PoolClient } from "pg";
import { pool } from "../db";
import { contractAuthority } from "./contractDocumentService";
import { businessPartyColumns, talentPartyColumns } from "../../shared/contractPartyDetails";
import { contractMergeFields, templateHtmlTags } from "../../shared/contractTemplates";
import { isUsdCurrency } from "../../shared/currency";

export class ContractTemplateError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type MergeValue = { value: string | null; source: string; missing: boolean };
export type MergeContext = { actorId: string; hiringContractId?: string; clientId?: string; organizationId?: string };
type Db = Pick<Pool | PoolClient, "query">;
export function escapeContractHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function sanitizeTemplateBody(body: string) {
  return sanitizeHtml(body, {
    allowedTags: templateHtmlTags,
    allowedAttributes: { section: ["data-clause-id","data-page-break"], p: ["data-clause-id","data-page-break"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: [], disallowedTagsMode: "discard",
  });
}
export function templateMergeKeys(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/{{\s*([^{}]*?)\s*}}/g), match => match[1])));
}
export function renderContractTemplate(body: string, data: Record<string, MergeValue | string | null>) {
  const known = new Set(contractMergeFields.map(field => field.key));
  const unknownKeys = templateMergeKeys(body).filter(key => !known.has(key));
  const missingKeys: string[] = [];
  const html = sanitizeTemplateBody(body).replace(/{{\s*([^{}]*?)\s*}}/g, (_match, key: string) => {
    const raw = data[key];
    const value = raw && typeof raw === "object" ? raw.value : raw;
    if (value === null || value === undefined || value === "") {
      missingKeys.push(key);
      return escapeContractHtml(`{{${key}}}`);
    }
    return escapeContractHtml(value).replace(/\r?\n/g, "<br>");
  });
  return { html, missingKeys: Array.from(new Set(missingKeys)), unknownKeys };
}
export function formatContractAddress(row: Record<string, any>) {
  return [row.address_line1, row.address_line2, row.city, row.state_region, row.postal_code, row.country]
    .filter(value => typeof value === "string" && value.trim()).map(value => value.trim()).join(", ") || null;
}
function money(amount: unknown, currency: unknown) {
  if (amount === null || amount === undefined || amount === "" || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return null;
  const number = Number(amount);
  if (!Number.isFinite(number)) return null;
  // Formatting never converts or relabels historical currencies.
  const code = isUsdCurrency(currency) ? "USD" : currency;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: "code" }).format(number); }
  catch { return null; }
}
function date(value: unknown) {
  if (!value) return null;
  const parsed = new Date(value as string);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }) : null;
}
function setting(value: any) {
  if (typeof value !== "string") return null;
  try { const parsed = JSON.parse(value); return typeof parsed === "string" ? parsed : null; }
  catch { return value.trim() || null; }
}
function plainText(html: string) {
  const escaped = sanitizeHtml(html.replace(/<\/p>|<br\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} });
  // htmlparser2 already decoded named entities before sanitize-html escaped its
  // text output. Undo that final escaping once; renderContractTemplate escapes
  // the resulting plain value exactly once when inserting it into HTML.
  return escaped.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_match, entity: string) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" })[entity]!);
}
/** Private values are resolved only after canonical contract/MSA authority succeeds. */
export async function resolveMergeData(context: MergeContext, db: Db = pool): Promise<Record<string, MergeValue>> {
  if (!context.actorId) throw new ContractTemplateError(401, "AUTH_REQUIRED", "Authentication required");
  let contract: any = {};
  let clientId = context.clientId;
  let organizationId: string | undefined;
  if (context.hiringContractId) {
    contract = (await db.query(`SELECT hc.id,hc.submission_id,hc.offer_id,hc.status,hc.party_type,hc.organization_id,
      hc.prepared_by,hc.signing_entity,hc.effective_start_date,js.client_id,js.talent_id,js.job_id
      FROM hiring_contracts hc JOIN job_submissions js ON js.id=hc.submission_id WHERE hc.id=$1`, [context.hiringContractId])).rows[0];
    if (!contract) throw new ContractTemplateError(404, "CONTRACT_NOT_FOUND", "Contract not found");
    const authority = await contractAuthority(db as any, contract, { id: context.actorId });
    if (!authority.canPrepare) throw new ContractTemplateError(403, "PREPARER_REQUIRED", "Only an authorized draft preparer can resolve merge data");
    clientId = contract.client_id;
    if (contract.party_type === "organization") organizationId = contract.organization_id;
  } else {
    const actor = (await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1", [context.actorId])).rows[0];
    if (!actor || !clientId || !((actor.role === "admin" && actor.admin_sub_role === null) || (actor.role === "client" && clientId === context.actorId))) {
      throw new ContractTemplateError(403, "MSA_PREPARER_REQUIRED", "Only the Client or a Super Admin may prepare its MSA");
    }
    if (context.organizationId) {
      const membership = (await db.query(`SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id
        WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role='owner' AND o.delete_due_at IS NULL`,
      [context.organizationId, clientId])).rows[0];
      if (!membership) throw new ContractTemplateError(403, "ORG_OWNER_REQUIRED", "Client must own the selected organization");
      organizationId = context.organizationId;
    }
  }
  const client = (await db.query("SELECT id FROM users WHERE id=$1 AND role='client'", [clientId])).rows[0];
  if (!client) throw new ContractTemplateError(404, "CLIENT_NOT_FOUND", "Client not found");
  const table = organizationId ? "organizations" : "client_profiles";
  const party = (await db.query(`SELECT ${Object.values(businessPartyColumns).join(",")} FROM ${table}
    WHERE ${organizationId ? "id" : "user_id"}=$1`, [organizationId ?? clientId])).rows[0] ?? {};
  const talent = contract.talent_id ? (await db.query(`SELECT ${Object.values(talentPartyColumns).filter(column => column !== "tax_id_last4").join(",")}
    FROM candidates WHERE user_id=$1 OR (user_id IS NULL AND lower(email)=(SELECT lower(email) FROM users WHERE id=$1))
    ORDER BY CASE WHEN user_id=$1 THEN 0 ELSE 1 END,id LIMIT 1`, [contract.talent_id])).rows[0] ?? {} : {};
  const offer = contract.offer_id ? (await db.query(`SELECT rate,rate_currency,engagement_type,proposed_start_date,status
    FROM offers WHERE id=$1`, [contract.offer_id])).rows[0] ?? {} : {};
  if (contract.offer_id && offer.status !== "accepted") throw new ContractTemplateError(409, "ACCEPTED_OFFER_REQUIRED", "The contract's accepted offer is required");
  const job = contract.job_id ? (await db.query("SELECT title,description FROM jobs WHERE id=$1", [contract.job_id])).rows[0] ?? {} : {};
  const deposit = contract.id ? (await db.query(`SELECT amount,currency FROM security_deposits
    WHERE hiring_contract_id=$1 OR (offer_id=$2 AND submission_id=$3)
    ORDER BY (hiring_contract_id=$1) DESC NULLS LAST,created_at DESC,id DESC LIMIT 1`,
  [contract.id, contract.offer_id, contract.submission_id])).rows[0] ?? {} : {};
  const settings = (await db.query(`SELECT key,value FROM platform_settings WHERE key=ANY($1::text[])`,
    [["contract_signing_entity", "contract_signing_address", "contract_signing_entity_type"]])).rows;
  const config = Object.fromEntries(settings.map((row: any) => [row.key, setting(row.value)]));
  const prefix = organizationId ? "organizations" : "client_profiles";
  const values: Record<string, [any, string]> = {
    "client.legalEntityName": [party.legal_entity_name, `${prefix}.legal_entity_name`],
    "client.entityType": [party.entity_type, `${prefix}.entity_type`],
    "client.address": [formatContractAddress(party), `${prefix}.address_line1,address_line2,city,state_region,postal_code,country`],
    "client.signatoryName": [party.signatory_name, `${prefix}.signatory_name`],
    "client.signatoryTitle": [party.signatory_title, `${prefix}.signatory_title`],
    "talent.legalFullName": [talent.legal_full_name, "candidates.legal_full_name"],
    "talent.address": [formatContractAddress(talent), "candidates.address_line1,address_line2,city,state_region,postal_code,country"],
    "offer.rate": [money(offer.rate, offer.rate_currency), "offers.rate"],
    "offer.currency": [offer.rate_currency, "offers.rate_currency"],
    "offer.engagementType": [offer.engagement_type, "offers.engagement_type"],
    "offer.startDate": [date(offer.proposed_start_date), "offers.proposed_start_date"],
    "job.title": [job.title, "jobs.title"],
    "job.description": [typeof job.description === "string" ? plainText(job.description) : null, "jobs.description"],
    "deposit.amount": [money(deposit.amount, deposit.currency), "security_deposits.amount"],
    "contract.effectiveDate": [date(contract.effective_start_date), "hiring_contracts.effective_start_date"],
    "onspot.entityName": [contract.signing_entity || config.contract_signing_entity, contract.signing_entity ? "hiring_contracts.signing_entity" : "platform_settings.contract_signing_entity"],
    "onspot.address": [config.contract_signing_address, "platform_settings.contract_signing_address"],
    "onspot.entityType": [config.contract_signing_entity_type, "platform_settings.contract_signing_entity_type"],
  };
  return Object.fromEntries(contractMergeFields.map(field => {
    const [raw, source] = values[field.key] ?? [null, "manual"];
    const value = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    return [field.key, { value, source, missing: value === null }];
  }));
}
