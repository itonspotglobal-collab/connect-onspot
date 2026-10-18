import { z } from "zod";
import type { Pool, PoolClient } from "pg";

const categories = ["inquiry","hiring_invoice","invoice","monthly_invoice","deposit","replenishment","payout"] as const;
export type WiseCategory = typeof categories[number];
const tables = { inquiry:"inquiries",hiring_invoice:"hiring_pre_offer_invoices",invoice:"invoices",
  monthly_invoice:"client_monthly_invoices",deposit:"security_deposits",replenishment:"security_deposit_replenishments",payout:"payouts" } as const;
const columns = { inquiry:"inquiry_id",hiring_invoice:"hiring_invoice_id",invoice:"invoice_id",
  monthly_invoice:"monthly_invoice_id",deposit:"deposit_id",replenishment:"replenishment_id",payout:"payout_id" } as const;
const text = (n: number) => z.string().trim().min(1).max(n);
const money = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/).refine(v => Number(v)>0);
const currency = z.string().regex(/^[A-Z]{3}$/);
export const wiseConfigInput = z.object({
  currency, recipient:text(500), instructions:text(4000),
  referenceInstructions:z.string().trim().max(1000).default(""),
  active:z.boolean(), qrFileId:z.string().uuid().nullish(),
  depositFundingConfirmed:z.boolean().default(false),
}).strict();
export const wiseReviewInput = z.object({
  action:z.enum(["verify","reject"]), reason:text(2000),
  independentlyVerified:z.literal(true).optional(), verifiedAmount:money.optional(),
  verifiedCurrency:currency.optional(), verifiedReference:text(500).optional(),
  verifiedRecipient:text(500).optional(), settledAt:z.string().date().or(z.string().datetime({offset:true})).optional(),
}).strict().superRefine((v,ctx) => {
  if (v.action==="verify" && (!v.independentlyVerified || !v.verifiedAmount || !v.verifiedCurrency ||
      !v.verifiedReference || !v.verifiedRecipient || !v.settledAt)) {
    ctx.addIssue({code:"custom",message:"Independent settlement confirmation, amount, currency, recipient, reference and settlement date are required."});
  }
});
export class WiseError extends Error {
  constructor(public status:number,message:string) { super(message); }
}
const fail = (status:number,message:string):never => { throw new WiseError(status,message); };
export const wiseCents = (v:unknown):bigint => {
  const s=String(v);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return fail(409,"The obligation does not have a finalized positive amount.");
  const [w,f=""]=s.split(".");
  return BigInt(w)*BigInt(100)+BigInt(f.padEnd(2,"0"));
};
const amountOf=(r:any,c:WiseCategory) => c==="monthly_invoice" ? r.amount_due : c==="inquiry" ? r.payment_amount : r.amount;

export class ManualWiseService {
  constructor(public pool:Pool) {}
  async tx<T>(fn:(db:PoolClient)=>Promise<T>) {
    const db=await this.pool.connect();
    try { await db.query("BEGIN"); const value=await fn(db); await db.query("COMMIT"); return value; }
    catch(e) { await db.query("ROLLBACK").catch(()=>{}); throw e; } finally { db.release(); }
  }
  async actor(db:Pick<PoolClient,"query">,id:string,admin=false) {
    const a=(await db.query("SELECT id,role,admin_sub_role,email,email_verified_at,email_verified_email FROM users WHERE id=$1",[id])).rows[0];
    if (!a || (admin ? a.role!=="admin" || a.admin_sub_role!==null : !["client","admin"].includes(a.role))) {
      return fail(403,"Only an authorized Super Admin may verify settlements or manage payment instructions.");
    }
    return a;
  }
  private async event(db:PoolClient,actor:string,event:string,obligation:string|null=null,submission:string|null=null,details:unknown={}) {
    await db.query(`INSERT INTO manual_wise_audit(actor_id,event,obligation_id,submission_id,details)
      VALUES($1,$2,$3,$4,$5)`,[actor,event,obligation,submission,JSON.stringify(details)]);
  }
  category(value:string):WiseCategory {
    return z.enum(categories).parse(value);
  }
  private async raw(db:PoolClient,c:WiseCategory,id:string) {
    z.string().uuid().parse(id);
    let contractStatus:string|undefined;
    // Match the existing hiring/contract locking order before taking ledger locks.
    if (c==="hiring_invoice") {
      await db.query(`SELECT id FROM job_submissions WHERE id=(SELECT submission_id FROM hiring_pre_offer_invoices WHERE id=$1) FOR UPDATE`,[id]);
    }
    if (c==="deposit" || c==="replenishment" || c==="payout") {
      contractStatus=(await db.query(`SELECT id,status FROM hiring_contracts WHERE id=(SELECT hiring_contract_id FROM ${tables[c]} WHERE id=$1) FOR UPDATE`,[id])).rows[0]?.status;
      if(c==="payout")await db.query("SELECT id FROM talent_invoices WHERE id=(SELECT talent_invoice_id FROM payouts WHERE id=$1) FOR UPDATE",[id]);
      if (c==="payout" || c==="replenishment") await db.query(`SELECT id FROM security_deposits WHERE hiring_contract_id=(SELECT hiring_contract_id FROM ${tables[c]} WHERE id=$1) FOR UPDATE`,[id]);
    }
    const r=(await db.query(`SELECT * FROM ${tables[c]} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if (!r) return fail(404,"Payment obligation not found.");
    r.contract_status=contractStatus;
    if (c==="monthly_invoice") {
      const credits=(await db.query("SELECT COALESCE(SUM(amount),0)::text AS amount FROM client_credit_applications WHERE client_monthly_invoice_id=$1",[id])).rows[0];
      const net=wiseCents(r.subtotal)-wiseCents(credits.amount);
      r.amount_due=net<BigInt(0) ? "" : `${net/BigInt(100)}.${String(net%BigInt(100)).padStart(2,"0")}`;
    }
    if (c==="deposit" || c==="replenishment") {
      r.client_id=(await db.query(`SELECT js.client_id FROM hiring_contracts hc JOIN job_submissions js ON js.id=hc.submission_id WHERE hc.id=$1`,[r.hiring_contract_id])).rows[0]?.client_id;
    }
    return r;
  }
  private async load(db:PoolClient,actorId:string,c:WiseCategory,id:string,adminRequired=false) {
    const actor=await this.actor(db,actorId,adminRequired || c==="payout");
    const superAdmin=actor.role==="admin" && actor.admin_sub_role===null;
    const r=await this.raw(db,c,id);
    let payerId=c==="payout" ? r.talent_id : r.client_id;
    if (c==="inquiry") {
      // A public inquiry UUID or claimed email is not an authentication credential.
      if (!superAdmin && (String(actor.email).trim().toLowerCase()!==String(r.email).trim().toLowerCase() ||
          !actor.email_verified_at || String(actor.email_verified_email).toLowerCase()!==String(actor.email).toLowerCase())) {
        return fail(403,"Sign in with the verified email address used for this inquiry.");
      }
      const matches=await db.query(`SELECT id FROM users WHERE lower(btrim(email))=lower(btrim($1)) AND role='client' ORDER BY created_at,id LIMIT 2`,[r.email]);
      if (matches.rows.length!==1) return fail(409,"A unique verified Client account must own this inquiry before it can accept payment.");
      payerId=matches.rows[0].id;
    }
    if (!payerId || (!superAdmin && payerId!==actorId)) return fail(404,"Payment obligation not found.");
    if (actor.role==="admin" && !superAdmin) return fail(403,"Super Admin access is required.");
    const col=columns[c];
    await db.query(`INSERT INTO manual_wise_obligations(category,${col},payer_id) VALUES($1,$2,$3)
      ON CONFLICT(${col}) DO NOTHING`,[c,id,payerId]);
    const binding=(await db.query(`SELECT * FROM manual_wise_obligations WHERE ${col}=$1 FOR UPDATE`,[id])).rows[0];
    if (binding.payer_id!==payerId) return fail(409,"Payment owner changed; financial review is required.");
    let config=binding.config_id ? (await db.query("SELECT * FROM manual_wise_config WHERE id=$1",[binding.config_id])).rows[0] : null;
    const curr=c==="inquiry" ? r.payment_currency : r.currency;
    if (!config && c!=="payout") {
      config=(await db.query("SELECT * FROM manual_wise_config WHERE currency=$1 AND active FOR SHARE",[curr])).rows[0] ?? null;
      if (config) {
        // Immutable first-enrollment snapshot. Existing invoices' own fields are never overwritten.
        await db.query("UPDATE manual_wise_obligations SET config_id=$2 WHERE id=$1",[binding.id,config.id]);
        binding.config_id=config.id;
      }
    }
    const history=(await db.query(`SELECT s.*,f.filename AS receipt_name FROM manual_wise_submissions s
      JOIN manual_wise_files f ON f.id=s.receipt_id WHERE s.obligation_id=$1 ORDER BY s.created_at DESC,s.id DESC`,[binding.id])).rows;
    const settled=c==="inquiry" ? ["paid","completed"].includes(r.status) || r.payment_status==="verified"
      : c==="deposit" ? r.status==="held" || ["applied","forfeited"].includes(r.status)
      : c==="payout" ? r.status==="disbursed" : c==="monthly_invoice" || c==="replenishment" ? r.payment_status==="paid" : r.status==="paid";
    const allowed=c==="inquiry" ? ["endorsed","payment_pending"].includes(r.status)
      : c==="hiring_invoice" ? ["issued","overdue","payment_failed","verification_pending"].includes(r.status)
      : c==="invoice" ? ["sent","overdue"].includes(r.status)
      : c==="monthly_invoice" ? r.status==="sent" : c==="deposit" ? r.status==="pending"
      : c==="replenishment" ? r.payment_status==="unpaid"
      : ["pending","scheduled"].includes(r.status);
    let blockedReason:string|undefined;
    let amount=String(amountOf(r,c)??"");
    try { if (wiseCents(amount)<=BigInt(0)) blockedReason="No finalized positive amount is due."; }
    catch { blockedReason="A finalized payable amount is required. Contact OnSpot for a formal quote."; amount=""; }
    if (!allowed && !settled) blockedReason="This obligation is not eligible for a new payment proof.";
    if (c!=="payout" && !config) blockedReason="Wise payment instructions are not configured for this currency.";
    const activeConfig=c==="payout" ? null : (await db.query("SELECT deposit_funding_confirmed FROM manual_wise_config WHERE currency=$1 AND active",[curr])).rows[0];
    if(config && c!=="payout" && !activeConfig)blockedReason="Wise collection is paused for this currency. Do not send funds.";
    if (c==="hiring_invoice" && config && config.recipient!==r.payment_recipient) {
      blockedReason="Configured Wise recipient does not match this invoice's immutable payment recipient. Financial review is required.";
    }
    if (["deposit","replenishment"].includes(c)) {
      if (!activeConfig?.deposit_funding_confirmed) blockedReason="Manual deposit funding requires explicit business/custody policy confirmation.";
      if(r.contract_status!=="signed")blockedReason="Deposit funding requires an active signed contract; closed obligations need financial review.";
    }
    if (c==="payout" && !binding.approved_destination) blockedReason="Independently approve the Talent payout destination before recording a transfer.";
    const latest=history[0];
    const paymentStatus=settled ? "paid" : latest?.status ?? "awaiting_payment";
    return {actor,r,binding,config,view:{
      category:c,id,reference:r.invoice_number ?? r.reference_number ?? id,
      amount,currency:curr,payerId,status:r.status,paymentStatus,
      direction:c==="payout" ? "outgoing" : "incoming",
      payable:allowed && !settled && !blockedReason && !["verification_pending","paid"].includes(latest?.status),
      instructions:c==="payout" ? null : config ? {id:config.id,recipient:config.recipient,instructions:config.instructions,
        referenceInstructions:config.reference_instructions,qrFileId:config.qr_file_id,currency:config.currency} : null,
      approvedDestination:binding.approved_destination,blockedReason,history,
    }};
  }
  detail(actor:string,c:WiseCategory,id:string) { return this.tx(async db=>(await this.load(db,actor,c,id)).view); }
  async list(actorId:string,payouts=false) {
    return this.tx(async db=>{
      const actor=await this.actor(db,actorId,payouts);
      if (!payouts && actor.role!=="client") return fail(403,"Client account required.");
      const ids=payouts ? (await db.query("SELECT id,'payout' AS category FROM payouts WHERE status IN ('pending','scheduled') ORDER BY created_at DESC LIMIT 100")).rows
        : (await db.query(`SELECT id,category FROM (
          SELECT id::text,'invoice' AS category,created_at FROM invoices WHERE client_id=$1 AND status<>'draft'
          UNION ALL SELECT id::text,'hiring_invoice',created_at FROM hiring_pre_offer_invoices WHERE client_id=$1 AND status<>'draft'
          UNION ALL SELECT id::text,'monthly_invoice',created_at FROM client_monthly_invoices WHERE client_id=$1 AND status='sent'
          UNION ALL SELECT d.id::text,'deposit',d.created_at FROM security_deposits d JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
            JOIN job_submissions js ON js.id=hc.submission_id WHERE js.client_id=$1
          UNION ALL SELECT r.id::text,'replenishment',r.created_at FROM security_deposit_replenishments r
            JOIN hiring_contracts hc ON hc.id=r.hiring_contract_id JOIN job_submissions js ON js.id=hc.submission_id WHERE js.client_id=$1
          UNION ALL SELECT id::text,'inquiry',created_at FROM inquiries WHERE lower(btrim(email))=lower(btrim($2))
            AND status IN ('endorsed','payment_pending','paid','completed')
        ) x ORDER BY created_at DESC,id LIMIT 100`,[actorId,actor.email])).rows;
      const items=[];
      // Listing should not fail all invoices because a separate public inquiry is unclaimed.
      for (const row of ids) {
        if (row.category==="inquiry" && !actor.email_verified_at) continue;
        items.push((await this.load(db,actorId,row.category,row.id,payouts)).view);
      }
      return {items};
    });
  }
  async configure(actorId:string,input:unknown) {
    const v=wiseConfigInput.parse(input);
    return this.tx(async db=>{
      await this.actor(db,actorId,true);
      await db.query("SELECT pg_advisory_xact_lock(hashtext('manual-wise-config'))");
      if (v.qrFileId && !(await db.query("SELECT id FROM manual_wise_files WHERE id=$1 AND purpose='qr'",[v.qrFileId])).rows.length) {
        return fail(422,"Configured QR image not found.");
      }
      await db.query("UPDATE manual_wise_config SET active=false WHERE currency=$1 AND active",[v.currency]);
      const row=(await db.query(`INSERT INTO manual_wise_config(currency,recipient,instructions,reference_instructions,
        qr_file_id,active,deposit_funding_confirmed,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [v.currency,v.recipient,v.instructions,v.referenceInstructions,v.qrFileId??null,v.active,v.depositFundingConfirmed,actorId])).rows[0];
      await this.event(db,actorId,"wise_configuration_created",null,null,{configId:row.id,currency:v.currency,active:v.active});
      return row;
    });
  }
  async config(actor:string) {
    await this.actor(this.pool,actor,true);
    return {items:(await this.pool.query("SELECT * FROM manual_wise_config ORDER BY created_at DESC LIMIT 100")).rows};
  }
  async quote(actorId:string,id:string,input:unknown) {
    const v=z.object({amount:money,currency}).strict().parse(input);
    return this.tx(async db=>{
      await this.actor(db,actorId,true);
      const r=await this.raw(db,"inquiry",id);
      if (!["endorsed","payment_pending"].includes(r.status) || r.paid_at ||
          (await db.query(`SELECT 1 FROM manual_wise_obligations o JOIN manual_wise_submissions s ON s.obligation_id=o.id WHERE o.inquiry_id=$1`,[id])).rows.length) {
        return fail(409,"Quote can only be finalized on an endorsed inquiry before payment enrollment.");
      }
      await db.query("UPDATE inquiries SET payment_amount=$2,payment_currency=$3,updated_at=now() WHERE id=$1",[id,v.amount,v.currency]);
      await db.query("UPDATE manual_wise_obligations SET config_id=NULL WHERE inquiry_id=$1",[id]);
      await this.event(db,actorId,"inquiry_quote_finalized",null,null,{inquiryId:id,...v});
      return {success:true};
    });
  }
  async destination(actorId:string,id:string,input:unknown) {
    const v=z.object({recipient:text(500),reason:text(2000),independentlyApproved:z.literal(true)}).strict().parse(input);
    return this.tx(async db=>{
      const o=await this.load(db,actorId,"payout",id,true);
      if (o.binding.approved_destination || !["pending","scheduled"].includes(o.r.status)) {
        return fail(409,"Payout destination is already approved or the payout is closed.");
      }
      await db.query(`UPDATE manual_wise_obligations SET approved_destination=$2,
        destination_approved_by=$3,destination_approved_at=now() WHERE id=$1`,[o.binding.id,v.recipient,actorId]);
      await this.event(db,actorId,"payout_destination_approved",o.binding.id,null,{recipient:v.recipient,reason:v.reason});
      return {success:true};
    });
  }
  async submit(actorId:string,c:WiseCategory,id:string,reference:string,fileId:string) {
    text(500).parse(reference);
    return this.tx(async db=>{
      const o=await this.load(db,actorId,c,id);
      if (!o.view.payable) return fail(409,o.view.blockedReason ?? "A payment proof is already pending or this obligation is settled.");
      if (c==="payout") await this.actor(db,actorId,true);
      if (!(await db.query(`SELECT id FROM manual_wise_files WHERE id=$1 AND uploaded_by=$2 AND purpose='receipt' FOR UPDATE`,[fileId,actorId])).rows.length) {
        return fail(403,"Receipt not available to this account.");
      }
      const row=(await db.query(`INSERT INTO manual_wise_submissions(obligation_id,submitted_by,amount,currency,reference,recipient,receipt_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [o.binding.id,actorId,o.view.amount,o.view.currency,reference.trim(),c==="payout" ? o.binding.approved_destination : o.config.recipient,fileId])).rows[0];
      if (c==="inquiry") await db.query(`UPDATE inquiries SET payment_status='pending_verification',payment_reference_number=$2,
        payment_proof_url=$3,payment_confirmation_submitted_at=now(),payment_method='manual',updated_at=now() WHERE id=$1`,
      [id,reference.trim(),`/api/manual-wise/files/${fileId}`]);
      if (c==="hiring_invoice") {
        await db.query("UPDATE hiring_pre_offer_invoices SET status='verification_pending',payment_reference=$2,updated_at=now() WHERE id=$1",[id,reference.trim()]);
        await db.query(`INSERT INTO hiring_payment_events(invoice_id,actor_id,event,previous_status,new_status,details)
          VALUES($1,$2,'payment_receipt_submitted',$3,'verification_pending',$4)`,[id,actorId,o.r.status,JSON.stringify({submissionId:row.id})]);
      }
      await this.event(db,actorId,"proof_submitted",o.binding.id,row.id);
      return row;
    });
  }
  async submissions(actorId:string,filters:Record<string,string>) {
    await this.actor(this.pool,actorId,true);
    const values:unknown[]=[]; const conditions:string[]=[];
    for (const [key,column] of [["category","o.category"],["status","s.status"],["currency","s.currency"]] as const) {
      if (filters[key]) {values.push(filters[key]);conditions.push(`${column}=$${values.length}`);}
    }
    for (const [key,column] of [["payer","coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')||' '||coalesce(u.email,'')"],["reference","s.reference"]] as const) {
      if (filters[key]) {values.push(`%${filters[key]}%`);conditions.push(`(${column}) ILIKE $${values.length}`);}
    }
    for (const key of ["from","to"] as const) if (filters[key]) {
      z.string().date().parse(filters[key]); values.push(filters[key]);
      conditions.push(`s.created_at ${key==="from" ? ">=" : "<"} $${values.length}::date ${key==="to" ? "+ interval '1 day'" : ""}`);
    }
    const items=(await this.pool.query(`SELECT s.*,o.category,
      coalesce(o.inquiry_id,o.hiring_invoice_id::text,o.invoice_id::text,o.monthly_invoice_id::text,o.deposit_id::text,o.replenishment_id::text,o.payout_id::text) AS obligation_id,
      trim(concat_ws(' ',u.first_name,u.last_name)) AS payer_name,u.email AS payer_email,
      s.recipient AS expected_recipient,f.filename AS receipt_name,
      (SELECT coalesce(json_agg(h ORDER BY h.created_at DESC),'[]') FROM
        (SELECT id,status,reference,amount,currency,receipt_id,created_at,rejection_reason,verified_at,verified_by
         FROM manual_wise_submissions WHERE obligation_id=o.id) h) AS history
      FROM manual_wise_submissions s JOIN manual_wise_obligations o ON o.id=s.obligation_id
      JOIN users u ON u.id=o.payer_id JOIN manual_wise_files f ON f.id=s.receipt_id
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY s.created_at DESC LIMIT 200`,values)).rows;
    return {items};
  }
  async review(actorId:string,id:string,input:unknown) {
    const v=wiseReviewInput.parse(input);
    return this.tx(async db=>{
      await this.actor(db,actorId,true);
      const found=(await db.query(`SELECT o.category,coalesce(o.inquiry_id,o.hiring_invoice_id::text,o.invoice_id::text,
        o.monthly_invoice_id::text,o.deposit_id::text,o.replenishment_id::text,o.payout_id::text) AS target
        FROM manual_wise_submissions s JOIN manual_wise_obligations o ON o.id=s.obligation_id WHERE s.id=$1`,[id])).rows[0];
      if (!found) return fail(404,"Payment submission not found.");
      const c:WiseCategory=found.category;
      const o=await this.load(db,actorId,c,found.target,true);
      const s=(await db.query("SELECT * FROM manual_wise_submissions WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if (s.status==="paid" && v.action==="verify") {
        if (s.verified_reference===v.verifiedReference && wiseCents(s.amount)===wiseCents(v.verifiedAmount!) &&
            s.currency===v.verifiedCurrency && s.recipient===v.verifiedRecipient) return s;
        return fail(409,"This payment already has different settlement evidence.");
      }
      if (s.status!=="verification_pending") return fail(409,"Only pending submissions can be reviewed.");
      if (v.action==="reject") {
        await db.query("UPDATE manual_wise_submissions SET status='rejected',rejection_reason=$2,verified_by=$3,verified_at=now() WHERE id=$1",[id,v.reason,actorId]);
        if (c==="inquiry") await db.query("UPDATE inquiries SET payment_status='rejected',payment_rejected_at=now(),admin_payment_notes=$2 WHERE id=$1",[found.target,v.reason]);
        if (c==="hiring_invoice" && o.r.status==="verification_pending") {
          await db.query("UPDATE hiring_pre_offer_invoices SET status='payment_failed',updated_at=now() WHERE id=$1",[found.target]);
          await db.query(`INSERT INTO hiring_payment_events(invoice_id,actor_id,event,previous_status,new_status,details)
            VALUES($1,$2,'payment_rejected','verification_pending','payment_failed',$3)`,[found.target,actorId,JSON.stringify({reason:v.reason,submissionId:id})]);
        }
        await this.event(db,actorId,"proof_rejected",o.binding.id,id,{reason:v.reason});
        return {id,status:"rejected"};
      }
      if (o.view.paymentStatus==="paid" || o.view.blockedReason) return fail(409,o.view.blockedReason ?? "Obligation is already settled.");
      if (wiseCents(s.amount)!==wiseCents(o.view.amount) || s.currency!==o.view.currency ||
          wiseCents(v.verifiedAmount!)!==wiseCents(s.amount) || v.verifiedCurrency!==s.currency ||
          v.verifiedRecipient!==s.recipient) return fail(409,"Settlement amount, currency or destination does not match the obligation.");
      if (new Date(v.settledAt!).getTime()>Date.now()) return fail(422,"Settlement date cannot be in the future.");
      // Same normalized reference lock serializes cross-category and old hiring-route verification.
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`wise-settlement:${v.verifiedReference!.trim().toLowerCase()}`]);
      if ((await db.query(`SELECT id FROM manual_wise_submissions WHERE status='paid'
        AND lower(btrim(verified_reference))=lower(btrim($1)) AND id<>$2`,[v.verifiedReference,id])).rows.length ||
          (await db.query(`SELECT id FROM hiring_pre_offer_invoices WHERE verified_reference IS NOT NULL
            AND lower(btrim(verified_reference))=lower(btrim($1)) AND ($2::text<>'hiring_invoice' OR id::text<>$3)`,
          [v.verifiedReference,c,found.target])).rows.length) return fail(409,"This settled transaction reference has already been used. No duplicate credits are permitted.");
      const legacy=(await db.query(`SELECT 1 FROM (
        SELECT external_ref AS reference FROM invoices WHERE status='paid'
        UNION ALL SELECT transaction_reference FROM inquiries WHERE paid_at IS NOT NULL
        UNION ALL SELECT external_ref FROM payouts WHERE status='disbursed'
      ) t WHERE lower(btrim(t.reference))=lower(btrim($1)) LIMIT 1`,[v.verifiedReference])).rows;
      if(legacy.length)return fail(409,"This transaction reference already appears in historical settlement records.");
      await this.settle(db,c,o.r,o.view.amount,v,actorId);
      const result=(await db.query(`UPDATE manual_wise_submissions SET status='paid',verified_by=$2,verified_at=now(),
        verified_amount=$3,verified_currency=$4,verified_reference=$5,verified_recipient=$6,settled_at=$7
        WHERE id=$1 RETURNING *`,[id,actorId,v.verifiedAmount,v.verifiedCurrency,v.verifiedReference,v.verifiedRecipient,v.settledAt])).rows[0];
      await this.event(db,actorId,c==="payout" ? "payout_disbursed" : "payment_verified",o.binding.id,id,v);
      return result;
    });
  }
  private async settle(db:PoolClient,c:WiseCategory,r:any,amount:string,v:z.infer<typeof wiseReviewInput>,actor:string) {
    if (c==="inquiry") await db.query(`UPDATE inquiries SET status='paid',payment_status='verified',paid_at=now(),
      payment_verified_at=now(),transaction_reference=$2,admin_payment_notes=$3,updated_at=now() WHERE id=$1`,[r.id,v.verifiedReference,v.reason]);
    if (c==="invoice") await db.query(`UPDATE invoices SET status='paid',paid_at=now(),payment_method='wire',
      external_ref=$2,updated_at=now() WHERE id=$1`,[r.id,v.verifiedReference]);
    if (c==="monthly_invoice") await db.query(`UPDATE client_monthly_invoices SET payment_status='paid',paid_at=now() WHERE id=$1`,[r.id]);
    if (c==="deposit") await db.query(`UPDATE security_deposits SET status='held',held_at=now(),updated_at=now() WHERE id=$1`,[r.id]);
    if (c==="replenishment") {
      const deposit=(await db.query("SELECT status FROM security_deposits WHERE hiring_contract_id=$1 FOR UPDATE",[r.hiring_contract_id])).rows[0];
      if (!["held","suspended"].includes(deposit?.status)) return fail(409,"This deposit top-up needs lifecycle review before settlement.");
      if (deposit.status==="suspended") {
        const principal=(await db.query("SELECT amount FROM security_deposits WHERE hiring_contract_id=$1",[r.hiring_contract_id])).rows[0];
        if (wiseCents(principal.amount)!==wiseCents(r.amount)) return fail(409,"A cure must restore the existing deposit principal exactly.");
        await db.query("UPDATE security_deposits SET status='held',held_at=now(),cure_deadline_at=NULL,updated_at=now() WHERE hiring_contract_id=$1",[r.hiring_contract_id]);
      }
      await db.query("UPDATE security_deposit_replenishments SET payment_status='paid',verified_at=now(),reference=$2 WHERE id=$1",[r.id,v.verifiedReference]);
    }
    if (c==="hiring_invoice") {
      await db.query(`UPDATE hiring_pre_offer_invoices SET status='paid',verified_amount=$2,verified_currency=$3,
        verified_reference=$4,verified_recipient=$5,verified_by=$6,verified_at=now(),updated_at=now() WHERE id=$1`,
      [r.id,amount,v.verifiedCurrency,v.verifiedReference,v.verifiedRecipient,actor]);
      await db.query(`INSERT INTO hiring_payment_events(invoice_id,actor_id,event,previous_status,new_status,details)
        VALUES($1,$2,'payment_verify',$3,'paid',$4)`,[r.id,actor,r.status,JSON.stringify(v)]);
    }
    if (c==="payout") {
      if (r.talent_invoice_id) {
        const ti=(await db.query("SELECT * FROM talent_invoices WHERE id=$1 FOR UPDATE",[r.talent_invoice_id])).rows[0];
        if (!ti || ti.status!=="sent" || ti.talent_id!==r.talent_id || ti.currency!==r.currency ||
            wiseCents(ti.amount)!==wiseCents(r.amount)) return fail(409,"Payout does not match a sent Talent invoice.");
        const coverage=(await db.query(`SELECT d.status,d.currency,
          d.amount + coalesce((SELECT SUM(x.amount) FROM security_deposit_replenishments x
            WHERE x.hiring_contract_id=d.hiring_contract_id AND x.currency=d.currency AND x.payment_status='paid'),0)
          - coalesce((SELECT SUM(p.amount) FROM payouts p WHERE p.hiring_contract_id=d.hiring_contract_id
            AND p.currency=d.currency AND p.id<>$2 AND p.status IN ('pending','scheduled','disbursed','failed')),0) AS available
          FROM security_deposits d WHERE d.hiring_contract_id=$1`,[r.hiring_contract_id,r.id])).rows[0];
        if (!coverage || coverage.status!=="held" || coverage.currency!==r.currency ||
            wiseCents(coverage.available)<wiseCents(r.amount)) return fail(409,"Verified held deposit coverage is required for this Talent invoice payout.");
      } else if (!(await db.query(`SELECT id FROM invoices WHERE period_id=$1 AND status='paid' LIMIT 1`,[r.period_id])).rows.length) {
        return fail(409,"The legacy Client invoice must be paid before disbursement.");
      }
      await db.query(`UPDATE payouts SET status='disbursed',external_ref=$2,payout_method='wise_manual',
        disbursed_at=now(),updated_at=now() WHERE id=$1`,[r.id,v.verifiedReference]);
    }
  }
  async fileAccess(actorId:string,id:string) {
    z.string().uuid().parse(id);
    const actor=await this.actor(this.pool,actorId);
    const file=(await this.pool.query("SELECT * FROM manual_wise_files WHERE id=$1",[id])).rows[0];
    if (!file) return fail(404,"Receipt not found.");
    if (actor.role==="admin" && actor.admin_sub_role===null) return file;
    const allowed=file.purpose==="qr"
      ? await this.pool.query(`SELECT o.id FROM manual_wise_obligations o JOIN manual_wise_config c ON c.id=o.config_id WHERE o.payer_id=$1 AND c.qr_file_id=$2`,[actorId,id])
      : await this.pool.query(`SELECT o.id FROM manual_wise_obligations o JOIN manual_wise_submissions s ON s.obligation_id=o.id WHERE o.payer_id=$1 AND o.category<>'payout' AND s.receipt_id=$2`,[actorId,id]);
    if (!allowed.rows.length) return fail(404,"Receipt not found.");
    return file;
  }
}
