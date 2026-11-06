import type { Pool } from "pg";
import { pool } from "../db";
import approvedMsa from "./legal/onspot-msa-template.json";
import { sanitizeTemplateBody } from "../services/contractMergeService";

/** A system-created DRAFT only. Never activate or impersonate an Admin reviewer. */
export async function seedContractTemplates(db: Pool = pool) {
  const tx = await db.connect();
  try {
    await tx.query("BEGIN");
    const row = (await tx.query(`INSERT INTO contract_templates(kind,name,version,body,source_document_sha256)
      VALUES('msa',$1,$2,$3,$4) ON CONFLICT(kind,version) DO NOTHING RETURNING id`,
    [approvedMsa.name, approvedMsa.version, sanitizeTemplateBody(approvedMsa.body), approvedMsa.sourceDocumentSha256])).rows[0];
    if (row) for (const field of approvedMsa.fields) {
      await tx.query(`INSERT INTO contract_template_fields(template_id,key,label,source,required,editable_by)
        VALUES($1,$2,$3,$4,$5,$6)`, [row.id, field.key, field.label, field.source, field.required, field.editableBy]);
    }
    await tx.query("COMMIT");
  } catch (error) { await tx.query("ROLLBACK").catch(() => {}); throw error; }
  finally { tx.release(); }
}
