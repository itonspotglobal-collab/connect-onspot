import { z } from "zod";
import type { Pool, PoolClient } from "pg";
import { ManualWiseConfiguration } from "./manualWiseConfiguration";
import { activateFundedEngagement, queueHiringLifecycleEvent, tryActivateEngagement } from "./hiringLifecycleEvents";
import { isDepositFirst, lockOnboarding } from "./contractorOnboardingPolicy";

const categories = ["inquiry","hiring_invoice","invoice","monthly_invoice","deposit","replenishment","payout"] as const;
export type WiseCategory = typeof categories[number];
const tables = { inquiry:"inquiries",hiring_invoice:"hiring_pre_offer_invoices",invoice:"invoices",
  monthly_invoice:"client_monthly_invoices",deposit:"security_deposits",replenishment:"security_deposit_replenishments",payout:"payouts" } as const;
const columns = { inquiry:"inquiry_id",hiring_invoice:"hiring_invoice_id",invoice:"invoice_id",
  monthly_invoice:"monthly_invoice_id",deposit:"deposit_id",replenishment:"replenishment_id",payout:"payout_id" } as const;
const text = (n: number) => z.string().trim().min(1).max(n);
const money = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/).refine(v => Number(v)>0);
const currency = z.string().regex(/^[A-Z]{3}$/);
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
  constructor(public pool:Pool, private afterCommit?:()=>Promise<void>) {}
  get configurations() { return new ManualWiseConfiguration(this.pool,(db,id)=>this.actor(db,id,true),fail); }
  async tx<T>(fn:(db:PoolClient)=>Promise<T>) {
    const db=await this.pool.connect();
    try { await db.query("BEGIN"); const value=await fn(db); await db.query("COMMIT"); return value; }
    catch(e) { await db.query("ROLLBACK").catch(()=>{}); throw e; } finally { db.release(); }
  }
  async actor(db:Pick<PoolClient,"query">,id:string,admin=false) {
    const a=(await db.query("SELECT id,role,admin_sub_role,email,email_verified_at,email_verified_email,to_jsonb(users)->>'company_name' AS company_name FROM users WHERE id=$1",[id])).rows[0];
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
    if(c==="deposit") {
      const source=(await db.query(`SELECT coalesce(d.submission_id,hc.submission_id) AS submission_id
        FROM security_deposits d LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id WHERE d.id=$1`,[id])).rows[0];
      if(source?.submission_id)await lockOnboarding(db,source.submission_id);
    }
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
      r.client_id=(await db.query(`SELECT js.client_id FROM job_submissions js WHERE js.id=coalesce($2::text,
        (SELECT submission_id FROM hiring_contracts WHERE id=$1))`,[r.hiring_contract_id,c==="deposit"?r.submission_id:null])).rows[0]?.client_id;
      if(c==="deposit"&&r.offer_id) {
        r.deposit_first=await isDepositFirst(db,r.submission_id);
        r.offer_status=(await db.query("SELECT status FROM offers WHERE id=$1",[r.offer_id])).rows[0]?.status;
      }
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
      // If an issued obligation has not yet enrolled, recover the known receiving
      // version at issuance, not whichever destination was activated most recently.
      // Never infer an activation period for legacy inactive rows without dates.
      config=(await db.query(`SELECT c.* FROM manual_wise_config c
        CROSS JOIN (SELECT created_at AS issued_at FROM ${tables[c]} WHERE id=$2) issued
        WHERE c.currency=$1 AND c.config_status IN ('active','inactive')
        AND coalesce(c.activated_at,c.created_at)<=issued.issued_at
        AND (c.active OR c.deactivated_at>issued.issued_at)
        ORDER BY coalesce(c.activated_at,c.created_at) DESC LIMIT 1 FOR SHARE OF c`,
        [curr,id])).rows[0] ?? null;
      if(!config)config=(await db.query("SELECT * FROM manual_wise_config WHERE currency=$1 AND active FOR SHARE",[curr])).rows[0] ?? null;
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
    const activeConfig=c==="payout" ? null : (await db.query("SELECT * FROM manual_wise_config WHERE currency=$1 AND active",[curr])).rows[0];
    if(config && c!=="payout" && !activeConfig)blockedReason="Wise collection is paused for this currency. Do not send funds.";
    if(config && config.currency!==curr)blockedReason="The issued receiving instructions do not support this payment's currency. Financial review is required.";
    if (c==="hiring_invoice" && config && config.recipient!==r.payment_recipient) {
      blockedReason="Configured Wise recipient does not match this invoice's immutable payment recipient. Financial review is required.";
    }
    if (["deposit","replenishment"].includes(c)) {
      if (!activeConfig?.deposit_funding_confirmed) blockedReason="Manual deposit funding requires explicit business/custody policy confirmation.";
      if(r.deposit_first) {
        if(!["accepted","offer_accepted"].includes(r.offer_status)||["void","voided","terminated"].includes(r.contract_status))
          blockedReason="This accepted offer is no longer eligible for deposit funding. Contact OnSpot for financial review.";
      } else if(r.contract_status!=="signed")blockedReason="Deposit funding requires an active signed contract; closed obligations need financial review.";
    }
    if (c==="payout" && !binding.approved_destination) blockedReason="Independently approve the Talent payout destination before recording a transfer.";
    const latest=history[0];
    const paymentStatus=settled ? "paid" : latest?.status ?? "awaiting_payment";
    if(config?.revoked_at)blockedReason="These receiving instructions have been revoked. Contact OnSpot billing support before sending funds.";
    const approvedQr=c!=="payout" && config?.currency===curr && allowed && !settled && !blockedReason
      ? config?.qr_file_id ?? null : null;
    // Billing metadata only; never join applicant names into payment projections.
    const payer=(await db.query("SELECT to_jsonb(users)->>'company_name' AS company_name FROM users WHERE id=$1",[payerId])).rows[0];
    let lineItems=[{name:c==="deposit"?"Security deposit":c==="replenishment"?"Deposit replenishment":
      c==="hiring_invoice"?"Hiring invoice":c==="monthly_invoice"?"Monthly statement":c==="inquiry"?"Inquiry payment":"Invoice",
      description:r.fee_description??r.description??"",amount}];
    const dateOnly=(value:any)=>value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`
      : typeof value==="string"?value.slice(0,10):null;
    let period=r.period_start&&r.period_end?`${dateOnly(r.period_start)} – ${dateOnly(r.period_end)}`:
      r.invoice_month?dateOnly(r.invoice_month)?.slice(0,7):null;
    if(c==="invoice" && r.period_id) {
      const source=(await db.query("SELECT period_start::text,period_end::text FROM invoice_periods WHERE id=$1",[r.period_id])).rows[0];
      if(source)period=`${source.period_start} – ${source.period_end}`;
    }
    if(c!=="payout" && r.hiring_contract_id) {
      const role=(await db.query(`SELECT j.title FROM hiring_contracts hc
        JOIN job_submissions js ON js.id=hc.submission_id JOIN jobs j ON j.id=js.job_id WHERE hc.id=$1`,
        [r.hiring_contract_id])).rows[0]?.title;
      if(role) lineItems[0].description=role;
    }
    if(c==="monthly_invoice") {
      const lines=(await db.query(`SELECT j.title,l.client_amount,
          to_jsonb(ti)->>'period_start' AS period_start,to_jsonb(ti)->>'period_end' AS period_end,
          to_jsonb(ti)->>'hours' AS hours
        FROM client_monthly_invoice_lines l JOIN talent_invoices ti ON ti.id=l.talent_invoice_id
        JOIN hiring_contracts hc ON hc.id::text=to_jsonb(ti)->>'hiring_contract_id'
        JOIN job_submissions js ON js.id=hc.submission_id JOIN jobs j ON j.id=js.job_id
        WHERE l.client_monthly_invoice_id=$1 ORDER BY ti.id`,[id])).rows;
      if(lines.length) {
        lineItems=lines.map((line:any)=>({name:line.title||"Contracted role",
          description:[line.period_start&&line.period_end?`${line.period_start} – ${line.period_end}`:"",
            line.hours?`${line.hours} recorded hours`:""].filter(Boolean).join(" · "),
          amount:String(line.client_amount)}));
        const credits=wiseCents(r.subtotal)-wiseCents(amount);
        if(credits>0)lineItems.push({name:"Applied credits",description:"Existing statement credits",
          amount:`-${credits/BigInt(100)}.${String(credits%BigInt(100)).padStart(2,"0")}`});
      }
    }
    if(c==="deposit"&&r.offer_id&&!r.hiring_contract_id) {
      const role=(await db.query("SELECT j.title FROM job_submissions js JOIN jobs j ON j.id=js.job_id WHERE js.id=$1",[r.submission_id])).rows[0]?.title;
      if(role)lineItems[0].description=role;
    }
    return {actor,r,binding,config,view:{
      category:c,id,reference:r.invoice_number ?? r.reference_number ?? id,
      amount,currency:curr,payerId,status:r.status,paymentStatus,
      companyName:payer?.company_name??null,issuedAt:r.issued_at??r.created_at??null,
      dueAt:r.due_date??r.due_at??null,period,
      lineItems,verifiedAt:r.paid_at??r.held_at??history.find((s:any)=>s.status==="paid")?.verified_at??null,
      direction:c==="payout" ? "outgoing" : "incoming",
      payable:allowed && !settled && !blockedReason && !["verification_pending","paid"].includes(latest?.status),
      instructions:c==="payout" ? null : config ? {id:config.id,recipient:config.recipient,instructions:config.instructions,
        referenceInstructions:config.reference_instructions,qrFileId:approvedQr,currency:config.currency} : null,
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
          UNION ALL SELECT d.id::text,'deposit',d.created_at FROM security_deposits d LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
            JOIN job_submissions js ON js.id=coalesce(d.submission_id,hc.submission_id) WHERE js.client_id=$1
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
    return this.configurations.save(actorId,input);
  }
  async config(actor:string) {
    return this.configurations.list(actor);
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
    const result = await this.tx(async db=>{
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
      if(c!=="payout") await queueHiringLifecycleEvent(db,`wise-proof-submitted:${row.id}`,"proof_submitted",
        {category:c,obligationId:id,proofId:row.id,payerId:o.binding.payer_id,amount:o.view.amount,
          currency:o.view.currency,reference:reference.trim()});
      return row;
    });
    void this.afterCommit?.().catch(()=>console.warn("[hiring-lifecycle] post-commit dispatch failed"));
    return result;
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
    const result = await this.tx(async db=>{
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
        if(c!=="payout") await queueHiringLifecycleEvent(db,`wise-proof-rejected:${id}`,"proof_rejected",
          {category:c,obligationId:found.target,proofId:id,payerId:o.binding.payer_id,reason:v.reason});
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
    void this.afterCommit?.().catch(()=>console.warn("[hiring-lifecycle] post-commit dispatch failed"));
    return result;
  }
  private async settle(db:PoolClient,c:WiseCategory,r:any,amount:string,v:z.infer<typeof wiseReviewInput>,actor:string) {
    if (c==="inquiry") await db.query(`UPDATE inquiries SET status='paid',payment_status='verified',paid_at=now(),
      payment_verified_at=now(),transaction_reference=$2,admin_payment_notes=$3,updated_at=now() WHERE id=$1`,[r.id,v.verifiedReference,v.reason]);
    if (c==="invoice") await db.query(`UPDATE invoices SET status='paid',paid_at=now(),payment_method='wire',
      external_ref=$2,updated_at=now() WHERE id=$1`,[r.id,v.verifiedReference]);
    if (c==="monthly_invoice") await db.query(`UPDATE client_monthly_invoices SET payment_status='paid',paid_at=now() WHERE id=$1`,[r.id]);
    if (c==="deposit") {
      await db.query(`UPDATE security_deposits SET status='held',held_at=now(),updated_at=now() WHERE id=$1`,[r.id]);
      if(r.deposit_first) {
        await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by,created_at)
          SELECT id,status,status,'Security deposit independently verified; Contractor Agreement and current signed Client MSA still required',$2,clock_timestamp()
          FROM job_submissions WHERE id=$1`,[r.submission_id,actor]);
        await tryActivateEngagement(db,r.submission_id,actor);
        await queueHiringLifecycleEvent(db,`deposit-verified:${r.id}`,"deposit_verified",
          {submissionId:r.submission_id,offerId:r.offer_id,depositId:r.id,actorId:actor});
      } else await activateFundedEngagement(db,r.hiring_contract_id,actor);
    }
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
      const waiver=(await db.query("SELECT submission_id FROM hiring_payment_waivers WHERE deferred_invoice_id=$1 AND revoked_at IS NULL",[r.id])).rows[0];
      if(waiver) {
        const deposit=(await db.query("SELECT id FROM security_deposits WHERE submission_id=$1 AND status='held' ORDER BY created_at DESC LIMIT 1",[waiver.submission_id])).rows[0];
        if(deposit)await queueHiringLifecycleEvent(db,`deferred-hiring-verified:${r.id}`,"deposit_verified",
          {submissionId:waiver.submission_id,depositId:deposit.id,actorId:actor});
      }
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
      ? await this.pool.query(`SELECT o.id FROM manual_wise_obligations o
          JOIN manual_wise_config c ON c.id=o.config_id
          WHERE o.payer_id=$1 AND o.category<>'payout' AND c.qr_file_id=$2 AND c.revoked_at IS NULL`,[actorId,id])
      : await this.pool.query(`SELECT o.id FROM manual_wise_obligations o JOIN manual_wise_submissions s ON s.obligation_id=o.id WHERE o.payer_id=$1 AND o.category<>'payout' AND s.receipt_id=$2`,[actorId,id]);
    if (!allowed.rows.length) return fail(404,"Receipt not found.");
    return file;
  }
}
