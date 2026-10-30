/** Current policy regression suite. Never reinstall the superseded pre-offer trigger.
 * Historical deferred debt remains payable; ordinary pre-offer fees are retired.
 * These are real disposable PostgreSQL tests, not authenticated-account UAT.
 */
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {randomUUID} from "node:crypto";
import {pool,query} from "./fixtures/hiring-db";
import {HiringPaymentService,requireVerifiedHiringPayment} from "../services/hiringPaymentService";
import {HiringPaymentWaiverService,verifiedDeferredHiringPayment} from "../services/hiringPaymentWaiverService";
import {registerHiringPaymentRoutes} from "../routes/hiringPayments";
import {offerHandler} from "./fixtures/onboarding-offer-handlers";
import {issueAcceptedOfferDeposit,isDepositFirst,requirePaidContract} from "../services/contractorOnboardingPolicy";
const service=new HiringPaymentService(pool),skips=new HiringPaymentWaiverService(pool);
const client="payment-client",other="payment-other",admin="payment-admin",subadmin="payment-subadmin",talent="payment-talent",
  candidate="payment-candidate",job="payment-job";
const policy={amount:"135.25",currency:"USD",feeBasis:"fixed_per_hiring_attempt",feeDescription:"HISTORICAL SYNTHETIC DEBT ONLY",
  taxTreatment:"inclusive",taxDescription:"Synthetic only",dueDays:7,paymentMethod:"manual_transfer",
  paymentRecipient:"SYNTHETIC ONLY — NOT A RECEIVING ACCOUNT",paymentInstructions:"DO NOT PAY — disposable test fixture"};
const reason="Synthetic historical debt attestation in owned disposable PostgreSQL";
const verification=(extra={})=>({action:"verify",reason,verifiedAmount:policy.amount,verifiedCurrency:"USD",
  verifiedReference:randomUUID(),verifiedRecipient:policy.paymentRecipient,independentlyVerified:true,...extra});
let server:any,base:string;
async function tx<T>(fn:(db:any)=>Promise<T>){const db=await pool.connect();try{await db.query("BEGIN");const r=await fn(db);await db.query("COMMIT");return r;}
catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}}
async function application(status="reviewed",workflow="application") {
  return (await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,status,workflow_type,initiated_by,registration_status)
    VALUES($1,$2,$3,$4,'Synthetic only',$5,$6,'talent','linked') RETURNING id`,[job,client,talent,`${talent}@fixture.invalid`,status,workflow])).rows[0].id;
}
async function historicalDebt() {
  const id=await application("reviewed");
  await skips.grant(admin,id,{waiverType:"defer",reason});
  // Model a real previously accepted, debt-bearing exception. No new recruiting fee.
  await query("UPDATE hiring_payment_waivers SET locked_at=now(),deferred_payment_required=true WHERE submission_id=$1 AND scope='pre_offer'",[id]);
  await query("UPDATE job_submissions SET status='offer_accepted' WHERE id=$1",[id]);
  const invoice=await service.ready(admin,id,true);
  return {id,invoice};
}
before(async()=>{
  for(const [id,role,sub]of [[client,"client",null],[other,"client",null],[admin,"admin",null],[subadmin,"admin","talent_acquisition"],[talent,"talent",null]])
    await query("INSERT INTO users(id,email,role,admin_sub_role,password_hash) VALUES($1,$2,$3,$4,'NOT_A_LOGIN_HASH')",[id,`${id}@fixture.invalid`,role,sub]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Synthetic payment role','No real engagement','Operations','Intermediate','open','approved','Standard','tracked')`,[job,client]);
  await query("INSERT INTO candidates(id,user_id,email,full_name) VALUES($1,$2,$3,'Synthetic only')",[candidate,talent,`${talent}@fixture.invalid`]);
  await service.configure(admin,policy);
  const app=express();app.use(express.json());
  registerHiringPaymentRoutes(app,{service,authenticate:(req:any,res,next)=>{
    const id=req.get("x-fixture-actor");if(!id)return res.sendStatus(401);req.user={id};next();
  },limiter:(_req,_res,next)=>next()});
  app.use((e:any,_req:any,res:any,_next:any)=>res.status(e.status??500).json({error:e.code,message:e.message}));
  server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{await new Promise<void>(r=>server.close(r));await pool.end();});
test("Retired readiness cannot issue new pre-offer invoices; stale stored flags cannot restore the gate",async()=>{
  const id=await application();await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  for(const actor of [client,admin])await assert.rejects(service.ready(actor,id),(e:any)=>e.status===410);
  assert.equal(await tx(db=>requireVerifiedHiringPayment(db,id)),null);
  const sent=await offerHandler("post","/api/client/offers",client,candidate,
    {submissionId:id,rate:2500,rateCurrency:"USD",proposedStartDate:"2099-01-01"});
  assert.equal(sent.statusCode,201,JSON.stringify(sent.body));
  assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE submission_id=$1",[id])).rows[0].n,0);
});
test("Policy re-enable remains retired for Super Admin and forbidden for restricted roles; no false policy-change audit",async()=>{
  for(const actor of [client,talent,subadmin,other,admin]) {
    const r=await offerHandler("patch","/api/admin/hiring-payment-settings",actor,candidate,{preOfferPaymentRequired:true});
    assert.equal(r.statusCode,actor===admin?410:403);
  }
  assert.equal((await query("SELECT count(*)::int n FROM manual_wise_audit WHERE event='hiring_payment_setting_changed'")).rows[0].n,0);
});
test("Historical deferred invoicing remains Super-only and idempotent; owned debt snapshots retain pricing",async()=>{
  const {id,invoice}=await historicalDebt();
  for(const actor of [client,talent,subadmin])await assert.rejects(service.ready(actor,id,true),(e:any)=>e.status===403);
  assert.equal((await service.ready(admin,id,true)).id,invoice.id);
  assert.equal(String(invoice.amount),policy.amount);assert.equal(invoice.currency,"USD");
  await assert.rejects(service.detail(other,invoice.id,false),(e:any)=>e.status===404);
  await assert.rejects(service.review(subadmin,invoice.id,verification()),(e:any)=>e.status===403);
  await assert.rejects(query("UPDATE hiring_pre_offer_invoices SET amount=1 WHERE id=$1",[invoice.id]),/immutable/);
});
test("A historical customer reference is not payment; partial and mismatched verification fail closed, rejection and resubmission retain history",async()=>{
  const {invoice}=await historicalDebt();
  await service.reference(client,invoice.id,"SYNTHETIC UNVERIFIED CLAIM");
  assert.equal((await service.detail(client,invoice.id,false)).invoice.status,"verification_pending");
  for(const mismatch of [{verifiedAmount:"1.00"},{verifiedCurrency:"EUR"},{verifiedRecipient:"Wrong synthetic recipient"}])
    await assert.rejects(service.review(admin,invoice.id,verification(mismatch)),(e:any)=>e.status===409||e.status===422);
  await service.review(admin,invoice.id,{action:"reject",reason:"Synthetic proof needs correction"});
  await service.reference(client,invoice.id,"SYNTHETIC CORRECTED CLAIM");
  await service.review(admin,invoice.id,verification());
  const paid=(await service.detail(client,invoice.id,false)).invoice;assert.equal(paid.status,"paid");
  assert.equal((await query("SELECT verified_by FROM hiring_pre_offer_invoices WHERE id=$1",[invoice.id])).rows[0].verified_by,admin);
  assert.ok((await query("SELECT id FROM hiring_payment_events WHERE invoice_id=$1",[invoice.id])).rows.length>=3);
});
test("Historical settlement references cannot be reused; paid financial records cannot be rewritten",async()=>{
  const a=await historicalDebt(),b=await historicalDebt(),ref=`HISTORICAL-${randomUUID()}`;
  await service.reference(client,a.invoice.id,"Synthetic claim A");await service.reference(client,b.invoice.id,"Synthetic claim B");
  await service.review(admin,a.invoice.id,verification({verifiedReference:ref}));
  await assert.rejects(service.review(admin,b.invoice.id,verification({verifiedReference:ref})),(e:any)=>e.status===409||e.code==="23505");
  const unchanged=(await query("SELECT status,verified_amount FROM hiring_pre_offer_invoices WHERE id=$1",[b.invoice.id])).rows[0];
  assert.equal(unchanged.status,"verification_pending");assert.equal(unchanged.verified_amount,null);
  await assert.rejects(query("UPDATE hiring_pre_offer_invoices SET amount=1 WHERE id=$1",[a.invoice.id]),/immutable/);
});
test("Historical deferred debt is identity-bound and still blocks agreements; it never authorizes another application",async()=>{
  const {id,invoice}=await historicalDebt();const s=(await query("SELECT * FROM job_submissions WHERE id=$1",[id])).rows[0];
  assert.equal(await verifiedDeferredHiringPayment(pool,s),false);
  await service.reference(client,invoice.id,"Synthetic claim");await service.review(admin,invoice.id,verification());
  assert.equal(await verifiedDeferredHiringPayment(pool,s),true);
  const otherId=await application("offer_accepted");
  assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE submission_id=$1",[otherId])).rows[0].n,0);
  // A mismatch can never convert the historical verification into evidence for this relationship.
  assert.equal(await verifiedDeferredHiringPayment(pool,{...s,client_id:other}),true,"No matching waiver means no debt is attached to the other identity");
  const row=(await query("SELECT client_id,submission_id FROM hiring_pre_offer_invoices WHERE id=$1",[invoice.id])).rows[0];
  assert.equal(row.client_id,client);assert.equal(row.submission_id,id);
});
test("Fresh acceptance of a legacy application's offer is invoice-first, idempotent, and cannot sign before the deposit",async()=>{
  const id=await application("offer_accepted");
  const offer=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date,accepted_at)
    VALUES($1,'accepted',2500,'USD','Standard','tracked','2099-01-01',now()) RETURNING id`,[id])).rows[0];
  await Promise.all([tx(db=>issueAcceptedOfferDeposit(db,offer.id,id)),tx(db=>issueAcceptedOfferDeposit(db,offer.id,id))]);
  assert.equal(await isDepositFirst(pool,id),true);
  assert.equal((await query("SELECT count(*)::int n FROM security_deposits WHERE offer_id=$1",[offer.id])).rows[0].n,1);
  await assert.rejects(tx(db=>requirePaidContract(db,offer.id,id)),(e:any)=>e.code==="DEPOSIT_PAYMENT_REQUIRED");
  assert.equal((await query("SELECT count(*)::int n FROM hiring_contracts WHERE offer_id=$1",[offer.id])).rows[0].n,0);
});
