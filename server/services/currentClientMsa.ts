import type {PoolClient} from "pg";
type Db=Pick<PoolClient,"query">;
/** Issued client-specific version wins. Before first personalized issuance,
 * keep existing signed shared MSAs valid; an active template never fabricates a signature. */
export async function currentClientMsa(db:Db,clientId:string) {
  const personal=(await db.query(`SELECT d.* FROM msa_documents d JOIN client_msa_documents c ON c.document_id=d.id
    WHERE c.client_id=$1 AND c.status='issued' AND d.effective_at<=now()`,[clientId])).rows[0];
  if(personal)return personal;
  const template=(await db.query("SELECT 1 FROM contract_templates WHERE kind='msa' AND status='active'")).rows.length;
  if(template) {
    const legacy=(await db.query(`SELECT d.* FROM msa_documents d
      WHERE NOT EXISTS(SELECT 1 FROM client_msa_documents c WHERE c.document_id=d.id)
      AND (EXISTS(SELECT 1 FROM client_msa_signatures s WHERE s.client_id=$1 AND s.document_id=d.id AND s.msa_version=d.version AND s.document_sha256=d.sha256)
        OR EXISTS(SELECT 1 FROM client_msa_offline_evidence s WHERE s.client_id=$1 AND s.document_id=d.id AND s.msa_version=d.version AND s.document_sha256=d.sha256))
      ORDER BY d.effective_at DESC,d.created_at DESC LIMIT 1`,[clientId])).rows[0];
    return legacy??null;
  }
  return (await db.query("SELECT * FROM msa_documents WHERE active AND effective_at<=now()")).rows[0]??null;
}
export async function msaSourceAvailable(db:Db) {
  return !!(await db.query(`SELECT 1 FROM msa_documents WHERE active AND effective_at<=now()
    UNION ALL SELECT 1 FROM contract_templates WHERE kind='msa' AND status='active' LIMIT 1`)).rows.length;
}
