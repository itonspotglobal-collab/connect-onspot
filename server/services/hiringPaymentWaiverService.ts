import type { HiringPaymentDb } from "./hiringPaymentService";
import { queueHiringLifecycleEvent } from "./hiringLifecycleEvents";
import {createHash} from "node:crypto";

type WaiverPool = HiringPaymentDb & {connect():Promise<HiringPaymentDb & {release():void}>};
export class WaiverError extends Error {
  constructor(public status:number,public code:string,message:string) {super(message);}
}
const fail=(status:number,code:string,message:string):never=>{throw new WaiverError(status,code,message);};
const reason=(value:unknown)=>{
  if(typeof value!=="string"||value.trim().length<10||value.length>2000)
    return fail(422,"REASON_REQUIRED","A written reason of 10–2000 characters is required.");
  return value.trim();
};
/** Caller must lock the submission first. Identity matching is never optional. */
export async function activeHiringWaiver(db:HiringPaymentDb,s:any) {
  return (await db.query(`SELECT * FROM hiring_payment_waivers WHERE submission_id=$1
    AND client_id=$2 AND job_id=$3 AND talent_id=$4 AND revoked_at IS NULL FOR SHARE`,
    [s.id,s.client_id,s.job_id,s.talent_id])).rows[0]??null;
}
export async function verifiedDeferredHiringPayment(db:HiringPaymentDb,s:any) {
  const w=await activeHiringWaiver(db,s);
  if(!w||w.waiver_type!=="defer"||!w.locked_at||!w.deferred_payment_required)return true;
  if(!w.deferred_invoice_id)return false;
  return !!(await db.query(`SELECT i.id FROM hiring_pre_offer_invoices i JOIN hiring_payment_attempts a ON a.id=i.attempt_id
    WHERE i.id=$1 AND i.submission_id=$2 AND a.submission_id=$2
      AND i.client_id=$3 AND a.client_id=$3 AND i.job_id=$4 AND a.job_id=$4
      AND i.talent_id=$5 AND a.talent_id=$5 AND i.invoice_type='hiring_pre_offer'
      AND i.status='paid' AND i.verified_at IS NOT NULL AND i.verified_by IS NOT NULL
      AND i.amount>0 AND i.verified_amount=i.amount AND i.verified_currency=i.currency
      AND length(btrim(i.verified_reference))>0 AND i.verified_recipient=i.payment_recipient FOR SHARE OF i`,
    [w.deferred_invoice_id,s.id,s.client_id,s.job_id,s.talent_id])).rows.length;
}
export async function lockAcceptedHiringWaiver(db:HiringPaymentDb,s:any) {
  const w=await activeHiringWaiver(db,s);
  if(!w)return;
  const locked=(await db.query(`UPDATE hiring_payment_waivers SET locked_at=now(),
    deferred_payment_required=(waiver_type='defer' AND coalesce((SELECT value::boolean FROM platform_settings
      WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'),false))
    WHERE id=$1 AND locked_at IS NULL RETURNING id`,[w.id])).rows.length;
  const required=(await db.query("SELECT deferred_payment_required FROM hiring_payment_waivers WHERE id=$1",[w.id])).rows[0]?.deferred_payment_required;
  if(locked&&required)await queueHiringLifecycleEvent(db,`hiring-deferred-due:${w.id}`,
    "hiring_deferred_due",{submissionId:s.id,waiverId:w.id});
}
/** UTC weekdays; no holiday calendar is assumed. */
export function twoBusinessDaysAfter(acceptedAt:Date) {
  const due=new Date(acceptedAt);
  let days=0;while(days<2){due.setUTCDate(due.getUTCDate()+1);if(![0,6].includes(due.getUTCDay()))days++;}
  return due;
}
export async function enqueueDeferredHiringReminders(db:HiringPaymentDb,now=new Date()) {
  const rows=(await db.query(`SELECT id,submission_id,locked_at FROM hiring_payment_waivers
    WHERE revoked_at IS NULL AND waiver_type='defer' AND deferred_payment_required AND locked_at IS NOT NULL AND deferred_invoice_id IS NULL`)).rows;
  for(const w of rows)if(now>=twoBusinessDaysAfter(new Date(w.locked_at)))
    await queueHiringLifecycleEvent(db,`hiring-deferred-reminder:${w.id}:${now.toISOString().slice(0,10)}`,
      "hiring_deferred_reminder",{submissionId:w.submission_id,waiverId:w.id});
}
export class HiringPaymentWaiverService {
  constructor(private pool:WaiverPool,private afterCommit?:()=>Promise<void>) {}
  private async tx<T>(fn:(db:HiringPaymentDb)=>Promise<T>,dispatch=true) {
    const db=await this.pool.connect();
    try {await db.query("BEGIN");const r=await fn(db);await db.query("COMMIT");
      if(dispatch)void this.afterCommit?.().catch(()=>{});return r;
    }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}finally{db.release();}
  }
  private async actor(db:HiringPaymentDb,id:string,superOnly=false) {
    const a=(await db.query("SELECT id,role,admin_sub_role FROM users WHERE id=$1",[id])).rows[0];
    if(!a||superOnly&&(a.role!=="admin"||a.admin_sub_role!==null))
      return fail(403,"FORBIDDEN","Super Admin access required.");
    return a;
  }
  private async submission(db:HiringPaymentDb,id:string,actor:any) {
    // Ownership is checked before returning payment data; Talent never sees arrangements.
    const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[id])).rows[0];
    if(!s||!(actor.role==="admin"||actor.role==="client"&&s.client_id===actor.id))
      return fail(403,"FORBIDDEN","Application payment access denied.");
    return s;
  }
  private async mutable(db:HiringPaymentDb,s:any) {
    if(["offer_accepted","contract_sent","contract_signed","hired"].includes(s.status)||
      (await db.query("SELECT id FROM offers WHERE submission_id=$1 AND status IN ('accepted','offer_accepted')",[s.id])).rows.length)
      return fail(409,"WAIVER_LOCKED","Payment arrangements are locked after acceptance.");
  }
  private async audit(db:HiringPaymentDb,s:any,actorId:string,event:string,details:any) {
    await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,$2,$3,$4)`,[s.id,s.status,`${event}: ${details.reason}`,actorId]);
    // Existing financial Admin audit ledger. No fake obligation or receipt is created.
    await db.query("INSERT INTO manual_wise_audit(actor_id,event,details) VALUES($1,$2,$3)",
      [actorId,event,JSON.stringify({applicationId:s.id,...details})]);
  }
  async status(actorId:string,id:string) {
    return this.tx(async db=>{
      const a=await this.actor(db,actorId),s=await this.submission(db,id,a);
      const w=await activeHiringWaiver(db,s);
      const required=(await db.query("SELECT value::boolean AS v FROM platform_settings WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'")).rows[0]?.v===true;
      const paid=!!(await db.query(`SELECT id FROM hiring_pre_offer_invoices WHERE submission_id=$1 AND client_id=$2
        AND job_id=$3 AND talent_id=$4 AND status='paid' AND verified_at IS NOT NULL AND verified_by IS NOT NULL
        AND amount>0 AND verified_amount=amount AND verified_currency=currency
        AND length(btrim(verified_reference))>0 AND verified_recipient=payment_recipient`,
        [s.id,s.client_id,s.job_id,s.talent_id])).rows.length;
      return {required,paid,canManage:a.role==="admin"&&a.admin_sub_role===null,
        waiver:w?(a.role==="admin"?w:{id:w.id,waiver_type:w.waiver_type,locked_at:w.locked_at}):null};
    },false);
  }
  async grant(actorId:string,id:string,input:any) {
    return this.tx(async db=>{
      const a=await this.actor(db,actorId,true);
      const why=reason(input?.reason);
      if(!["defer","waive"].includes(input?.waiverType))return fail(422,"INVALID_TYPE","Choose Defer or Waive.");
      const note=typeof input?.arrangementNote==="string"?input.arrangementNote.trim():"";
      if(note.length>2000)return fail(422,"INVALID_NOTE","Arrangement note is too long.");
      const s=await this.submission(db,id,a);await this.mutable(db,s);
      if(!s.client_id||!s.job_id||!s.talent_id)return fail(409,"LINKED_APPLICATION_REQUIRED","A linked hiring application is required.");
      if(await activeHiringWaiver(db,s))return fail(409,"ACTIVE_WAIVER_EXISTS","Revoke the existing skip before granting another.");
      // Never reinterpret or hide an already-issued financial obligation.
      if((await db.query("SELECT id FROM hiring_pre_offer_invoices WHERE submission_id=$1 AND status NOT IN ('void','refunded','invalidated')",[id])).rows.length)
        return fail(409,"EXISTING_INVOICE_REQUIRES_REVIEW","An invoice already exists. Review it through the normal financial workflow before granting a skip.");
      const w=(await db.query(`INSERT INTO hiring_payment_waivers(submission_id,client_id,job_id,talent_id,waiver_type,reason,arrangement_note,granted_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,s.client_id,s.job_id,s.talent_id,input.waiverType,why,note||null,actorId])).rows[0];
      await this.audit(db,s,actorId,"hiring_payment_skip_granted",{reason:why,waiverId:w.id,type:w.waiver_type});
      await queueHiringLifecycleEvent(db,`hiring-skip-granted:${w.id}`,"hiring_skip_granted",{submissionId:id,waiverId:w.id});
      return w;
    });
  }
  async revoke(actorId:string,id:string,input:any) {
    return this.tx(async db=>{
      const a=await this.actor(db,actorId,true),why=reason(input?.reason),s=await this.submission(db,id,a);await this.mutable(db,s);
      const w=await activeHiringWaiver(db,s);
      if(!w)return fail(404,"WAIVER_NOT_FOUND","No active skip exists.");
      if(w.locked_at)return fail(409,"WAIVER_LOCKED","Payment arrangements are locked after acceptance.");
      await db.query("UPDATE hiring_payment_waivers SET revoked_at=now(),revoked_by=$2,revoke_reason=$3 WHERE id=$1",[w.id,actorId,why]);
      await this.audit(db,s,actorId,"hiring_payment_skip_revoked",{reason:why,waiverId:w.id});
      await queueHiringLifecycleEvent(db,`hiring-skip-revoked:${w.id}`,"hiring_skip_revoked",{submissionId:id,waiverId:w.id});
      return {revoked:true};
    });
  }
  async request(actorId:string,id:string,input:any) {
    return this.tx(async db=>{
      const a=await this.actor(db,actorId);
      if(a.role!=="client")return fail(403,"FORBIDDEN","Client account required.");
      const message=reason(input?.message);
      const s=await this.submission(db,id,a);await this.mutable(db,s);
      if(await activeHiringWaiver(db,s))return fail(409,"ACTIVE_WAIVER_EXISTS","A skip is already active.");
      // One outstanding request at a time; retries never send duplicate notifications.
      const key=`hiring-skip-request:${id}:${createHash("sha256").update(message).digest("hex")}`;
      await queueHiringLifecycleEvent(db,key,"hiring_skip_requested",{submissionId:id,message});
      return {requested:true};
    });
  }
}
