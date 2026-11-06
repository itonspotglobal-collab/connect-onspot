import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { contractMergeFields, sampleMergeData, templateFieldSchema, templateKindSchema } from "../../shared/contractTemplates";
import { ContractTemplateError, sanitizeTemplateBody, templateMergeKeys, renderContractTemplate } from "./contractMergeService";

const draftSchema = z.object({
  kind: templateKindSchema, name: z.string().trim().min(1).max(180),
  version: z.string().trim().min(1).max(100), body: z.string().max(250000).optional(),
  fields: z.array(templateFieldSchema).max(100).optional(), sourceTemplateId: z.string().uuid().optional(),
}).strict();
const editSchema = draftSchema.pick({ name: true, body: true, fields: true }).partial().strict();
const fail = (status: number, code: string, message: string): never => { throw new ContractTemplateError(status, code, message); };
export class ContractTemplateService {
  constructor(private db: Pool) {}
  private async admin(db: Pick<Pool, "query">, actorId: string) {
    const actor = (await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1", [actorId])).rows[0];
    if (!actor || actor.role !== "admin" || actor.admin_sub_role !== null) fail(403, "SUPER_ADMIN_REQUIRED", "Only a Super Admin can manage contract templates");
  }
  private async tx<T>(fn: (tx: PoolClient) => Promise<T>) {
    const tx = await this.db.connect();
    try { await tx.query("BEGIN"); const result = await fn(tx); await tx.query("COMMIT"); return result; }
    catch (error) { await tx.query("ROLLBACK").catch(() => {}); throw error; }
    finally { tx.release(); }
  }
  private clean(body: string, incoming?: z.infer<typeof templateFieldSchema>[], allowEmpty = false) {
    const clean = sanitizeTemplateBody(body);
    if (!allowEmpty && !clean.replace(/<[^>]*>|&nbsp;/g, "").trim()) fail(422, "EMPTY_TEMPLATE", "Enter document content");
    const keys = templateMergeKeys(clean);
    const registry = new Map(contractMergeFields.map(field => [field.key, field]));
    if (keys.some(key => !registry.has(key))) fail(422, "UNKNOWN_FIELD", "Use registered merge fields from the Insert field picker");
    const fields = incoming ? [...incoming] : keys.map(key => ({ ...registry.get(key)! }));
    const seen = new Set<string>();
    for (const field of fields) {
      const canonical = registry.get(field.key);
      if (!canonical || canonical.source !== field.source || seen.has(field.key)) fail(422, "INVALID_FIELD_RULES", "Use unique registered fields with their canonical sources");
      seen.add(field.key);
    }
    for (const key of keys) if (!seen.has(key)) fields.push({ ...registry.get(key)! });
    return { body: clean, fields };
  }
  private async read(db: Pick<Pool, "query">, id: string) {
    const row = (await db.query(`SELECT id,kind,name,version,body,status,created_at AS "createdAt",updated_at AS "updatedAt",
      activated_at AS "activatedAt",activation_reason AS "activationReason",created_by AS "createdBy",
      activated_by AS "activatedBy",source_document_sha256 AS "sourceDocumentSha256"
      FROM contract_templates WHERE id=$1`, [id])).rows[0];
    if (!row) fail(404, "TEMPLATE_NOT_FOUND", "Template not found");
    row.fields = (await db.query(`SELECT key,label,source,required,editable_by AS "editableBy"
      FROM contract_template_fields WHERE template_id=$1 ORDER BY key`, [id])).rows;
    row.reviewHash = this.hash(row);
    return row;
  }
  private hash(row: any) {
    return createHash("sha256").update(JSON.stringify({
      kind: row.kind, name: row.name, version: row.version, body: row.body,
      fields: [...row.fields].sort((a: any, b: any) => a.key.localeCompare(b.key)),
    })).digest("hex");
  }
  private async writeFields(tx: PoolClient, id: string, fields: z.infer<typeof templateFieldSchema>[]) {
    await tx.query("DELETE FROM contract_template_fields WHERE template_id=$1", [id]);
    for (const field of fields) await tx.query(`INSERT INTO contract_template_fields
      (template_id,key,label,source,required,editable_by) VALUES($1,$2,$3,$4,$5,$6)`,
    [id, field.key, field.label, field.source, field.required, field.editableBy]);
  }
  async list(actorId: string) {
    await this.admin(this.db, actorId);
    const items = (await this.db.query(`SELECT id,kind,name,version,status,created_at AS "createdAt",
      activated_at AS "activatedAt",activation_reason AS "activationReason" FROM contract_templates ORDER BY created_at DESC,id DESC`)).rows;
    return { items, mergeFields: contractMergeFields };
  }
  async detail(actorId: string, id: string) { await this.admin(this.db, actorId); return this.read(this.db, id); }
  async create(actorId: string, input: unknown) {
    const payload = draftSchema.parse(input);
    try {
      return await this.tx(async tx => {
        await this.admin(tx, actorId);
        const original = payload.sourceTemplateId ? await this.read(tx, payload.sourceTemplateId) : null;
        if (original && original.kind !== payload.kind) fail(422, "KIND_MISMATCH", "A new version must retain the template kind");
        const clean = this.clean(payload.body ?? original?.body ?? "<p></p>", payload.fields ?? original?.fields, true);
        const row = (await tx.query(`INSERT INTO contract_templates(kind,name,version,body,created_by)
          VALUES($1,$2,$3,$4,$5) RETURNING id`, [payload.kind, payload.name, payload.version, clean.body, actorId])).rows[0];
        await this.writeFields(tx, row.id, clean.fields);
        return this.read(tx, row.id);
      });
    } catch (error: any) {
      if (error.code === "23505") fail(409, "VERSION_EXISTS", "That kind/version already exists; choose a new version");
      throw error;
    }
  }
  async update(actorId: string, id: string, input: unknown) {
    const payload = editSchema.parse(input);
    return this.tx(async tx => {
      await this.admin(tx, actorId);
      await tx.query("SELECT id FROM contract_templates WHERE id=$1 FOR UPDATE", [id]);
      const row = await this.read(tx, id);
      if (row.status !== "draft") fail(409, "TEMPLATE_IMMUTABLE", "Create a new version to change an active or retired template");
      const clean = this.clean(payload.body ?? row.body, payload.fields ?? row.fields, true);
      await tx.query("UPDATE contract_templates SET name=$2,body=$3,updated_at=NOW() WHERE id=$1",
        [id, payload.name ?? row.name, clean.body]);
      await this.writeFields(tx, id, clean.fields);
      return this.read(tx, id);
    });
  }
  async preview(actorId: string, id: string, input: unknown) {
    await this.admin(this.db, actorId);
    const payload = z.object({ body: z.string().max(250000).optional(),
      sampleData: z.record(z.string().max(5000)).optional() }).strict().parse(input ?? {});
    const row = await this.read(this.db, id);
    const body = payload.body ?? row.body;
    return { ...renderContractTemplate(body, { ...sampleMergeData, ...payload.sampleData }),
      reviewHash: this.hash({ ...row, body: sanitizeTemplateBody(body) }) };
  }
  async activate(actorId: string, id: string, input: unknown) {
    const payload = z.object({ reviewed: z.literal(true), reason: z.string().trim().min(1).max(2000),
      reviewHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(input);
    return this.tx(async tx => {
      await this.admin(tx, actorId);
      const identity = (await tx.query("SELECT kind FROM contract_templates WHERE id=$1", [id])).rows[0];
      if (!identity) fail(404, "TEMPLATE_NOT_FOUND", "Template not found");
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`contract-template:${identity.kind}`]);
      await tx.query("SELECT id FROM contract_templates WHERE id=$1 FOR UPDATE", [id]);
      const row = await this.read(tx, id);
      if (row.status === "retired") fail(409, "TEMPLATE_IMMUTABLE", "Clone a retired template into a new draft");
      if (row.reviewHash !== payload.reviewHash) fail(409, "REVIEW_STALE", "This template changed after review. Reload and review again");
      if (row.status === "active") return row;
      this.clean(row.body, row.fields);
      await tx.query("UPDATE contract_templates SET status='retired',updated_at=NOW() WHERE kind=$1 AND status='active'", [row.kind]);
      await tx.query(`UPDATE contract_templates SET status='active',activated_by=$2,activation_reason=$3,
        activated_at=NOW(),updated_at=NOW() WHERE id=$1`, [id, actorId, payload.reason]);
      return this.read(tx, id);
    });
  }
}
