import { getClient } from "../db";
import { FORMAL_PIPELINE_PREDICATE } from "./formalPipelineGuard";
import { ContractError } from "./hiringContractService";

/** Explicit renewal preserves the unchanged offer terms and the old deadline. */
export async function extendOfferExpiration(offerId:string,actorId:string,expiresAt:unknown) {
  if(typeof expiresAt!=="string" || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt)<=Date.now()) {
    throw new ContractError(400,{error:"invalid_expiration",message:"Choose a future expiration date."});
  }
  const tx=await getClient();
  try {
    await tx.query("BEGIN");
    let row=(await tx.query(`SELECT o.*,js.client_id,js.talent_id,js.status AS submission_status,u.role AS actor_role
      FROM offers o JOIN job_submissions js ON js.id=o.submission_id JOIN users u ON u.id=$2
      WHERE o.id=$1 AND (u.role='admin' OR (u.role='client' AND js.client_id=u.id))
        AND js.${FORMAL_PIPELINE_PREDICATE} FOR UPDATE OF js`,[offerId,actorId])).rows[0];
    if(!row) throw new ContractError(404,{error:"offer_not_found"});
    row={...row,...(await tx.query("SELECT * FROM offers WHERE id=$1 FOR UPDATE",[offerId])).rows[0]};
    if(!["sent","expired"].includes(row.status) || row.proposer_role==="talent" ||
       !["offer_extended","offer_expired"].includes(row.submission_status)) {
      throw new ContractError(409,{error:"offer_not_renewable"});
    }
    const other=await tx.query("SELECT id FROM offers WHERE submission_id=$1 AND status='sent' AND id<>$2",[row.submission_id,offerId]);
    if(other.rows.length) throw new ContractError(409,{error:"offer_already_pending"});
    await tx.query(`INSERT INTO offer_expiration_history(offer_id,actor_user_id,previous_expires_at,new_expires_at) VALUES($1,$2,$3,$4)`,
      [offerId,actorId,row.expires_at,expiresAt]);
    await tx.query("UPDATE offers SET expires_at=$2,status='sent',expiry_reminder_sent_at=NULL,updated_at=NOW() WHERE id=$1",[offerId,expiresAt]);
    await tx.query("UPDATE job_submissions SET status='offer_extended',updated_at=NOW() WHERE id=$1",[row.submission_id]);
    await tx.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,'offer_extended',$3,$4)`,[row.submission_id,row.submission_status,
      `Offer expiration explicitly extended from ${row.expires_at?new Date(row.expires_at).toISOString():"none"} to ${new Date(expiresAt).toISOString()}`,actorId]);
    await tx.query(`INSERT INTO notifications(user_id,type,title,message,related_id,related_type)
      VALUES($1,'offer_received','Offer expiration extended','The sender renewed your offer. Review the updated deadline before responding.',$2,'offer')`,
      [row.talent_id,offerId]);
    await tx.query("COMMIT");
    return {id:offerId,status:"sent",expiresAt};
  } catch(error) { await tx.query("ROLLBACK").catch(()=>{}); throw error; }
  finally { tx.release(); }
}
