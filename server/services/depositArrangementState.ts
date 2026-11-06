import type {PoolClient} from "pg";
export async function depositArrangement(db:Pick<PoolClient,"query">,id:string) {
  return (await db.query(`SELECT * FROM hiring_payment_waivers WHERE submission_id=$1 AND scope='deposit'
    AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1`,[id])).rows[0]??null;
}
export async function msaSignatureExists(db:Pick<PoolClient,"query">,clientId:string,msa:any) {
  if(!msa)return false;
  const ownership=(await db.query("SELECT client_id,status FROM client_msa_documents WHERE document_id=$1",[msa.id])).rows[0];
  if(ownership&&(ownership.client_id!==clientId||ownership.status!=="issued"))return false;
  return !!(await db.query(`SELECT 1 FROM client_msa_signatures WHERE client_id=$1 AND document_id=$2
    AND msa_version=$3 AND document_sha256=$4
    UNION ALL SELECT 1 FROM client_msa_offline_evidence WHERE client_id=$1 AND document_id=$2
    AND msa_version=$3 AND document_sha256=$4 LIMIT 1`,[clientId,msa.id,msa.version,msa.sha256])).rows.length;
}
