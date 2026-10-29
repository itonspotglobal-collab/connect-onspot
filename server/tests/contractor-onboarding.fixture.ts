/**
 * Real PostgreSQL and canonical services; synthetic disposable actors only.
 * Blob transport is an in-memory test double. No login, money or Wise verification
 * against external accounts is claimed by this suite.
 */
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {PDFDocument} from "pdf-lib";
import {pool,query} from "./fixtures/hiring-db";
import {requireHiringStage,issueAcceptedOfferDeposit,isDepositFirst} from "../services/contractorOnboardingPolicy";
import {tryActivateEngagement} from "../services/hiringLifecycleEvents";
import {preparePaidAgreements} from "../services/paidAgreementService";
import {ClientMsaService} from "../services/clientMsaService";
import {ManualWiseService} from "../services/manualWiseService";
import * as documents from "../services/contractDocumentService";
import {pdfHash,type ContractBlobProvider} from "../services/contractBlobStore";
import {computeDepositAmount} from "../lib/billing";
import {onboardingStatus} from "../services/contractorOnboardingStatus";
import {extendOfferExpiration} from "../services/offerExpirationService";
import {createHiringContract} from "../services/hiringContractService";
import {offerHandler} from "./fixtures/onboarding-offer-handlers";
import {HiringPaymentWaiverService,enqueueDeferredHiringReminders,twoBusinessDaysAfter,verifiedDeferredHiringPayment} from "../services/hiringPaymentWaiverService";
import {HiringPaymentService,requireVerifiedHiringPayment} from "../services/hiringPaymentService";

const suffix=randomUUID(),client=`onboard-client-${suffix}`,talent=`onboard-talent-${suffix}`;
const candidate=`onboard-candidate-${suffix}`;
const admin=`onboard-admin-${suffix}`,limited=`onboard-limited-${suffix}`,other=`onboard-other-${suffix}`,job=`onboard-job-${suffix}`;
const files=new Map<string,Buffer>();
const blobs:ContractBlobProvider={
  async save(b){const key=`private-fixture/${randomUUID()}`;files.set(key,Buffer.from(b));return key;},
  async read(key){if(!files.has(key))throw new Error("Missing private object");return Buffer.from(files.get(key)!);},
  async remove(key){files.delete(key);},
};
let pdf:Buffer;
const msa=new ClientMsaService(pool,blobs);
const wise=new ManualWiseService(pool);
const skips=new HiringPaymentWaiverService(pool);
const hiringPayments=new HiringPaymentService(pool);
async function tx<T>(fn:(db:any)=>Promise<T>) {
  const db=await pool.connect();
  try{await db.query("BEGIN");const r=await fn(db);await db.query("COMMIT");return r;}
  catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}finally{db.release();}
}
const status=async(id:string)=>(await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status;
const error=(code:string)=>(e:any)=>e.status===409&&e.code===code;
before(async()=>{
  await query("DROP TRIGGER IF EXISTS fixture_legacy_onboarding ON job_submissions");
  for(const [id,role,sub] of [[client,"client",null],[other,"client",null],[talent,"talent",null],[admin,"admin",null],[limited,"admin","client_success"]])
    await query(`INSERT INTO users(id,email,role,admin_sub_role,password_hash,first_name,last_name)
      VALUES($1,$2,$3,$4,'NOT_A_LOGIN_HASH','Disposable','Fixture')`,[id,`${id}@fixture.invalid`,role,sub]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Onboarding UAT only','No real engagement','Operations','Intermediate','open','approved','Standard','tracked')`,[job,client]);
  await query("INSERT INTO candidates(id,user_id,email,first_name,last_name) VALUES($1,$2,$3,'Disposable','Fixture')",
    [candidate,talent,`${talent}@fixture.invalid`]);
  const document=await PDFDocument.create();document.addPage();pdf=Buffer.from(await document.save());
  const qr=(await query(`INSERT INTO manual_wise_files(uploaded_by,purpose,object_key,filename,content_type,byte_size)
    VALUES($1,'qr','private-fixture/qr','UAT-ONLY.png','image/png',100) RETURNING id`,[admin])).rows[0].id;
  await query(`INSERT INTO manual_wise_config(currency,recipient,instructions,reference_instructions,qr_file_id,
    active,deposit_funding_confirmed,created_by,config_status,supported_currencies,activated_by,activated_at)
    VALUES('USD','UAT ONLY — NOT A RECEIVING ACCOUNT','DO NOT PAY — synthetic test fixture','Use test reference',$1,
    true,true,$2,'active',ARRAY['USD'],$2,now())`,[qr,admin]);
});
after(async()=>{await pool.end();});
async function application(state="new") {
  return (await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,workflow_type,initiated_by,registration_status,status)
    VALUES($1,$2,$3,$4,'Disposable Talent','application','talent','linked',$5) RETURNING id`,[job,client,talent,`${talent}@fixture.invalid`,state])).rows[0].id as string;
}
async function offerReadyApplication() {
  const id=await application("interviewing");
  await query(`INSERT INTO interviews(submission_id,round_number,interview_type,status,outcome,created_by)
    VALUES($1,1,'final','completed','advance',$2)`,[id,admin]);
  return id;
}
const sendOffer=(id:string)=>offerHandler("post","/api/client/offers",client,candidate,
  {submissionId:id,rate:2500,rateCurrency:"USD",proposedStartDate:"2032-10-01",expiresAt:"2099-10-01T00:00:00Z"});
test("payment skips preserve route/trigger enforcement, Super Admin authority and application isolation",async()=>{
  await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  try {
    const id=await offerReadyApplication(),b=await offerReadyApplication();
    assert.equal((await sendOffer(id)).statusCode,409);
    await assert.rejects(query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode)
      VALUES($1,'sent',2500,'USD','Standard','tracked')`,[id]),/PRE_OFFER_PAYMENT_REQUIRED/);
    for(const actor of [limited,client,talent])
      await assert.rejects(skips.grant(actor,id,{waiverType:"waive",reason:"Synthetic restricted actor test"}),(e:any)=>e.status===403);
    await assert.rejects(skips.grant(admin,id,{waiverType:"waive",reason:"short"}),(e:any)=>e.status===422);
    await skips.request(client,id,{message:"Synthetic request; do not change payment status"});
    await skips.request(client,id,{message:"Synthetic request; do not change payment status"});
    assert.equal((await skips.status(client,id)).waiver,null);
    assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_type='hiring_skip_requested' AND payload->>'submissionId'=$1",[id])).rows[0].n,1);
    await skips.grant(admin,id,{waiverType:"waive",reason:"Approved synthetic per-application arrangement"});
    const authorization=await tx(db=>requireVerifiedHiringPayment(db,id));
    assert.equal((authorization as any).waiverType,"waive");
    const otherJob=`${job}-identity`;
    await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
      VALUES($1,$2,'Synthetic identity-only job','UAT only','Operations','Intermediate','open','approved','Standard','tracked')`,[otherJob,client]);
    for(const [column,value,original] of [["client_id",other,client],["job_id",otherJob,job],["talent_id",client,talent]]) {
      // An identity mismatch cannot unlock the application even if a row exists.
      // job_id uses an existing second job so foreign-key enforcement stays on.
      await query(`UPDATE hiring_payment_waivers SET ${column}=$2 WHERE submission_id=$1`,[id,value]);
      await assert.rejects(tx(db=>requireVerifiedHiringPayment(db,id)),/paid and verified/);
      await query(`UPDATE hiring_payment_waivers SET ${column}=$2 WHERE submission_id=$1`,[id,original]);
    }
    assert.equal((await sendOffer(id)).statusCode,201);
    assert.equal((await sendOffer(b)).statusCode,409);
    await assert.rejects(skips.status(talent,id),(e:any)=>e.status===403);
    for(const actor of [limited,client,talent])
      await assert.rejects(skips.revoke(actor,id,{reason:"Synthetic unauthorized revoke"}),(e:any)=>e.status===403);
    const sent=(await query("SELECT id FROM offers WHERE submission_id=$1 AND status='sent'",[id])).rows[0].id;
    await skips.revoke(admin,id,{reason:"Synthetic arrangement withdrawn before acceptance"});
    assert.equal((await query("SELECT status FROM offers WHERE id=$1",[sent])).rows[0].status,"sent");
    const counter=await offerHandler("patch","/api/talent/offers/:id/respond",talent,candidate,
      {action:"counter",counterRate:2700,counterRateCurrency:"USD"},sent);
    assert.equal(counter.statusCode,409);
    await assert.rejects(extendOfferExpiration(sent,client,"2099-11-01T00:00:00Z"),/paid and verified/);
    assert.equal((await query("SELECT count(*)::int n FROM manual_wise_audit WHERE details->>'applicationId'=$1",[id])).rows[0].n,2);
  } finally {await query("UPDATE platform_settings SET value='false' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");}
});
test("defer covers initial offers, both counter writers and renewal; acceptance locks; both payments gate agreements",async()=>{
  await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  try {
    const id=await offerReadyApplication();
    const w=await skips.grant(admin,id,{waiverType:"defer",reason:"Approved synthetic deferred payment arrangement"});
    let response=await sendOffer(id);assert.equal(response.statusCode,201,JSON.stringify(response.body));
    response=await offerHandler("patch","/api/talent/offers/:id/respond",talent,candidate,
      {action:"counter",counterRate:2600,counterRateCurrency:"USD"},response.body.id);
    assert.equal(response.statusCode,200,JSON.stringify(response.body));
    response=await offerHandler("patch","/api/client/offers/:id/respond",client,candidate,
      {action:"counter",counterRate:2700,counterRateCurrency:"USD"},response.body.id);
    assert.equal(response.statusCode,200,JSON.stringify(response.body));
    const offerId=response.body.id;
    await extendOfferExpiration(offerId,client,"2099-12-01T00:00:00Z");
    response=await offerHandler("patch","/api/talent/offers/:id/respond",talent,candidate,{action:"accept"},offerId);
    assert.equal(response.statusCode,200,JSON.stringify(response.body));
    const locked=(await skips.status(admin,id)).waiver;assert.ok(locked?.locked_at);
    await assert.rejects(skips.revoke(admin,id,{reason:"Cannot revoke accepted arrangement"}),(e:any)=>e.code==="WAIVER_LOCKED");
    assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key=$1",[`hiring-deferred-due:${w.id}`])).rows[0].n,1);
    const deposit=(await query("SELECT * FROM security_deposits WHERE offer_id=$1",[offerId])).rows[0];
    await query("UPDATE security_deposits SET status='held' WHERE id=$1",[deposit.id]);
    assert.equal((await preparePaidAgreements(pool,{depositId:deposit.id,actorId:admin})).eligible,false);
    assert.equal((await query("SELECT count(*)::int n FROM hiring_contracts WHERE submission_id=$1",[id])).rows[0].n,0);
    await hiringPayments.configure(admin,{amount:"100.00",currency:"USD",feeBasis:"fixed_per_hiring_attempt",
      feeDescription:"SYNTHETIC UAT fee only",taxTreatment:"exempt",taxDescription:"SYNTHETIC UAT only",dueDays:5,
      paymentMethod:"manual_transfer",paymentRecipient:"UAT ONLY — NOT A RECEIVING ACCOUNT",paymentInstructions:"DO NOT PAY — isolated synthetic fixture"});
    for(const actor of [client,talent,limited])
      await assert.rejects(hiringPayments.ready(actor,id,true),(e:any)=>e.status===403);
    const invoice=await hiringPayments.ready(admin,id,true);
    assert.equal((await hiringPayments.ready(admin,id,true)).id,invoice.id);
    assert.equal((await skips.status(admin,id)).waiver?.deferred_invoice_id,invoice.id);
    assert.equal((await preparePaidAgreements(pool,{depositId:deposit.id,actorId:admin})).eligible,false);
    const receipt=(await query(`INSERT INTO manual_wise_files(uploaded_by,purpose,object_key,filename,content_type,byte_size)
      VALUES($1,'receipt',$2,'UAT-ONLY.pdf','application/pdf',100) RETURNING id`,[client,`private-fixture/${randomUUID()}`])).rows[0].id;
    const proof=await wise.submit(client,"hiring_invoice",invoice.id,"UAT-DEFERRED",receipt);
    assert.equal((await preparePaidAgreements(pool,{depositId:deposit.id,actorId:admin})).eligible,false);
    await wise.review(admin,proof.id,{action:"verify",reason:"SIMULATED settlement in disposable PostgreSQL only",independentlyVerified:true,
      verifiedAmount:"100.00",verifiedCurrency:"USD",verifiedReference:`UAT-DEFERRED-${randomUUID()}`,verifiedRecipient:"UAT ONLY — NOT A RECEIVING ACCOUNT",settledAt:"2026-10-01"});
    const doc=await msa.upload(admin,{buffer:pdf,mimetype:"application/pdf",originalname:"UAT-deferred.pdf"} as any,`uat-deferred-${randomUUID()}`,"2026-01-01");
    await msa.activate(admin,doc.id,{reviewed:true,reason:"Synthetic deferred fixture MSA"});
    const prepared=await preparePaidAgreements(pool,{depositId:deposit.id,actorId:admin});
    assert.equal(prepared.eligible,true);
    assert.equal(await tx(db=>tryActivateEngagement(db,id,admin)),false,"unsigned agreements never activate");
    // Terminal signing states are synthetic here; private document signing is
    // independently exercised by the unchanged real-document fixture below.
    await query("UPDATE hiring_contracts SET status='signed',onspot_signed_at=now(),talent_signed_at=now() WHERE id=$1",[prepared.contractId]);
    await query("UPDATE job_submissions SET status='contract_signed' WHERE id=$1",[id]);
    await msa.pdf(client,doc.id);
    await msa.sign(client,{documentId:doc.id,documentSha256:pdfHash(pdf),consent:true,signerName:"Disposable Client"},
      {ip:"127.0.0.1",userAgent:"isolated-deferred-fixture"});
    await tx(db=>tryActivateEngagement(db,id,admin));
    assert.equal(await status(id),"hired");
    // Do not change the active-MSA baseline expected by later independent tests.
    await query("UPDATE msa_documents SET active=false WHERE id=$1",[doc.id]);
  }finally{await query("UPDATE platform_settings SET value='false' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");}
});
test("waive creates no hiring invoice and preserves the independently verified deposit gate",async()=>{
  await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  try {
    const id=await offerReadyApplication();await skips.grant(admin,id,{waiverType:"waive",reason:"Approved synthetic fee-free special arrangement"});
    const sent=await sendOffer(id);assert.equal(sent.statusCode,201);
    const response=await offerHandler("patch","/api/talent/offers/:id/respond",talent,candidate,{action:"accept"},sent.body.id);
    assert.equal(response.statusCode,200,JSON.stringify(response.body));
    const d=(await query("SELECT * FROM security_deposits WHERE offer_id=$1",[sent.body.id])).rows[0];
    assert.ok(d);assert.ok((await skips.status(admin,id)).waiver?.locked_at);
    assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE submission_id=$1",[id])).rows[0].n,0);
    assert.equal((await preparePaidAgreements(pool,{depositId:d.id,actorId:admin})).eligible,false);
    await query("UPDATE security_deposits SET status='held' WHERE id=$1",[d.id]);
    const prepared=await preparePaidAgreements(pool,{depositId:d.id,actorId:admin});
    assert.equal(prepared.eligible,true);
    const doc=(await query("SELECT id,version,sha256 FROM msa_documents ORDER BY created_at DESC LIMIT 1")).rows[0];
    await query("UPDATE msa_documents SET active=true WHERE id=$1",[doc.id]);
    await query("UPDATE hiring_contracts SET status='signed',onspot_signed_at=now(),talent_signed_at=now() WHERE id=$1",[prepared.contractId]);
    await query("UPDATE job_submissions SET status='contract_signed' WHERE id=$1",[id]);
    await tx(db=>tryActivateEngagement(db,id,admin));
    assert.equal(await status(id),"hired");
    await query("UPDATE msa_documents SET active=false WHERE id=$1",[doc.id]);
  }finally{await query("UPDATE platform_settings SET value='false' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");}
});
test("policy OFF ignores skip payment effects; reminders wait two UTC business days and deduplicate daily",async()=>{
  const id=await offerReadyApplication();await skips.grant(admin,id,{waiverType:"defer",reason:"Synthetic exception while global policy is disabled"});
  const sent=await sendOffer(id);assert.equal(sent.statusCode,201);
  const accepted=await offerHandler("patch","/api/talent/offers/:id/respond",talent,candidate,{action:"accept"},sent.body.id);
  assert.equal(accepted.statusCode,200);
  const s=(await query("SELECT * FROM job_submissions WHERE id=$1",[id])).rows[0];
  assert.equal(await verifiedDeferredHiringPayment(pool,s),true);
  assert.equal((await skips.status(admin,id)).waiver?.deferred_payment_required,false);
  assert.equal(twoBusinessDaysAfter(new Date("2026-10-30T10:00:00Z")).toISOString(),"2026-11-03T10:00:00.000Z");
  const due=await application("offer_accepted");
  const w=(await query(`INSERT INTO hiring_payment_waivers(submission_id,client_id,job_id,talent_id,waiver_type,reason,granted_by,locked_at,deferred_payment_required)
    VALUES($1,$2,$3,$4,'defer','Synthetic reminder fixture',$5,'2026-10-30T10:00:00Z',true) RETURNING id`,[due,client,job,talent,admin])).rows[0];
  await enqueueDeferredHiringReminders(pool,new Date("2026-11-02T10:00:00Z"));
  assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key LIKE $1",[`hiring-deferred-reminder:${w.id}:%`])).rows[0].n,0);
  await enqueueDeferredHiringReminders(pool,new Date("2026-11-03T10:00:00Z"));await enqueueDeferredHiringReminders(pool,new Date("2026-11-03T11:00:00Z"));
  assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key LIKE $1",[`hiring-deferred-reminder:${w.id}:%`])).rows[0].n,1);
});
test("concurrent revocation and offer send serialize on the submission; a committed sent offer stays",async()=>{
  await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  try {
    for(const revokeFirst of [true,false]) {
      const id=await offerReadyApplication();
      await skips.grant(admin,id,{waiverType:"waive",reason:"Synthetic concurrency test arrangement"});
      const holder=await pool.connect();
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM job_submissions WHERE id=$1 FOR UPDATE",[id]);
      if(revokeFirst) {
        // A revoke already holding the canonical lock wins before send validation.
        await holder.query("UPDATE hiring_payment_waivers SET revoked_at=now(),revoked_by=$2,revoke_reason='Synthetic locked revoke' WHERE submission_id=$1",[id,admin]);
        const send=sendOffer(id);
        await holder.query("COMMIT");holder.release();
        assert.equal((await send).statusCode,409);
      }else {
        await requireVerifiedHiringPayment(holder,id);
        const revoke=skips.revoke(admin,id,{reason:"Synthetic revoke queued behind committed send"});
        await holder.query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode)
          VALUES($1,'sent',2500,'USD','Standard','tracked')`,[id]);
        await holder.query("COMMIT");holder.release();
        await revoke;
        assert.equal((await query("SELECT count(*)::int n FROM offers WHERE submission_id=$1 AND status='sent'",[id])).rows[0].n,1);
        await assert.rejects(tx(db=>requireVerifiedHiringPayment(db,id)),/paid and verified/);
      }
    }
  }finally{await query("UPDATE platform_settings SET value='false' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");}
});
test("payment policy changes use database Super Admin checks and the financial Admin audit log",async()=>{
  for(const actor of [limited,client,talent]) {
    const response=await offerHandler("patch","/api/admin/hiring-payment-settings",actor,candidate,{preOfferPaymentRequired:true});
    assert.equal(response.statusCode,403);
  }
  const response=await offerHandler("patch","/api/admin/hiring-payment-settings",admin,candidate,{preOfferPaymentRequired:true});
  assert.equal(response.statusCode,200,JSON.stringify(response.body));
  assert.ok((await query("SELECT id FROM manual_wise_audit WHERE actor_id=$1 AND event='hiring_payment_setting_changed'",[admin])).rows.length);
  await offerHandler("patch","/api/admin/hiring-payment-settings",admin,candidate,{preOfferPaymentRequired:false});
});
async function accepted() {
  const submissionId=await application("offer_accepted");
  const offerId=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date)
    VALUES($1,'accepted',2500,'USD','Standard','tracked','2032-10-01') RETURNING id`,[submissionId])).rows[0].id;
  const deposit=await tx(db=>issueAcceptedOfferDeposit(db,offerId,submissionId));
  return {submissionId,offerId,deposit};
}
async function verifiedPayment(a:Awaited<ReturnType<typeof accepted>>) {
  const receipt=async()=>(await query(`INSERT INTO manual_wise_files(uploaded_by,purpose,object_key,filename,content_type,byte_size)
    VALUES($1,'receipt',$2,'UAT-ONLY.pdf','application/pdf',100) RETURNING id`,[client,`private-fixture/${randomUUID()}`])).rows[0].id;
  const proof=await wise.submit(client,"deposit",a.deposit.id,"UAT-CLAIM",await receipt());
  assert.equal(await status(a.submissionId),"offer_accepted","a receipt must never activate");
  await assert.rejects(wise.review(client,proof.id,{action:"reject",reason:"Client must not approve"}),(e:any)=>e.status===403);
  await assert.rejects(wise.review(limited,proof.id,{action:"reject",reason:"Limited admin must not approve"}),(e:any)=>e.status===403);
  await wise.review(admin,proof.id,{action:"reject",reason:"Synthetic reference mismatch"});
  const next=await wise.submit(client,"deposit",a.deposit.id,"UAT-RESUBMISSION",await receipt());
  assert.equal(await status(a.submissionId),"offer_accepted");
  await wise.review(admin,next.id,{action:"verify",reason:"SIMULATED independent evidence in disposable fixture",
    independentlyVerified:true,verifiedAmount:String(a.deposit.amount),verifiedCurrency:"USD",
    verifiedReference:`UAT-SETTLED-${randomUUID()}`,verifiedRecipient:"UAT ONLY — NOT A RECEIVING ACCOUNT",settledAt:"2026-10-01"});
  assert.equal((await query("SELECT status FROM security_deposits WHERE id=$1",[a.deposit.id])).rows[0].status,"held");
  assert.equal(await status(a.submissionId),"offer_accepted");
  return preparePaidAgreements(pool,{...a,depositId:a.deposit.id,actorId:admin});
}
async function signContract(id:string) {
  await documents.uploadContractPdf(id,{id:admin},{buffer:pdf,mimetype:"application/pdf",originalname:"UAT-ONLY.pdf"},blobs);
  await documents.contractPdf(id,{id:admin},false,blobs);
  await documents.sendContract(id,{id:admin},blobs);
  for(const who of [admin,talent]) {
    const detail=await documents.contractDetail(id,{id:who});
    await documents.contractPdf(id,{id:who},false,blobs);
    await documents.signContractPdf(id,{id:who},{documentId:detail.document!.id,sha256:detail.document!.sha256,
      legalName:"Disposable Test Signer",consent:true},{},blobs);
  }
}
test("D1: only shortlisted/interviewing, with a written Super Admin override and audit",async()=>{
  const id=await application();
  await assert.rejects(tx(db=>requireHiringStage(db,id,"interview",client)),error("SHORTLIST_REQUIRED"));
  await assert.rejects(tx(db=>requireHiringStage(db,id,"interview",limited,"test reason")),error("SHORTLIST_REQUIRED"));
  await assert.rejects(tx(db=>requireHiringStage(db,id,"interview",admin," ")),error("SHORTLIST_REQUIRED"));
  await tx(db=>requireHiringStage(db,id,"interview",admin,"Explicit disposable UAT exception"));
  assert.equal((await query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1",[id])).rows[0].n,1);
  await query("UPDATE job_submissions SET status='shortlisted' WHERE id=$1",[id]);
  await tx(db=>requireHiringStage(db,id,"interview",client));
});
test("D2: final completed+advance/passed is mandatory; initial/hold/reject are insufficient",async()=>{
  const id=await application("interviewing");
  await assert.rejects(tx(db=>requireHiringStage(db,id,"offer",client)),error("FINAL_INTERVIEW_REQUIRED"));
  await assert.rejects(tx(db=>requireHiringStage(db,id,"offer",limited,"Not authorized")),error("FINAL_INTERVIEW_REQUIRED"));
  await tx(db=>requireHiringStage(db,id,"offer",admin,"Written Super Admin final-interview UAT exception"));
  const i=(await query(`INSERT INTO interviews(submission_id,round_number,interview_type,status,outcome,created_by)
    VALUES($1,1,'initial','completed','advance',$2) RETURNING id`,[id,admin])).rows[0].id;
  await assert.rejects(tx(db=>requireHiringStage(db,id,"offer",client)),error("FINAL_INTERVIEW_REQUIRED"));
  await query("UPDATE interviews SET interview_type='final',outcome='hold' WHERE id=$1",[i]);
  await assert.rejects(tx(db=>requireHiringStage(db,id,"offer",client)),error("FINAL_INTERVIEW_REQUIRED"));
  await query("UPDATE interviews SET outcome='advance' WHERE id=$1",[i]);
  await tx(db=>requireHiringStage(db,id,"offer",client));
});
test("post-cutover acceptance is invoice-first for initial/admin offers, both counters and renewals, even on a legacy application",async()=>{
  for(const variant of ["initial","admin-created","talent-counter","client-counter","renewed"] as const) {
    const id=await application("interviewing");
    // Stronger than the ordinary case: a previously grandfathered application
    // receives a NEW acceptance. It must lose its signing-first waiver.
    await query(`INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status)
      VALUES($1,1,'contract_sent')`,[id]);
    const created=await offerHandler("post","/api/client/offers",variant==="admin-created"?admin:client,candidate,
      {submissionId:id,rate:2500,rateCurrency:"USD",proposedStartDate:"2032-10-01",expiresAt:"2099-10-01T00:00:00Z"});
    assert.equal(created.statusCode,201,JSON.stringify(created.body));
    let offerId=created.body.id;
    if(variant.includes("counter")) {
      const counter=await offerHandler("patch","/api/talent/offers/:id/respond",talent,candidate,
        {action:"counter",counterRate:2600,counterRateCurrency:"USD"},offerId);
      assert.equal(counter.statusCode,200,JSON.stringify(counter.body));
      offerId=counter.body.id;
      if(variant==="client-counter") {
        const clientCounter=await offerHandler("patch","/api/client/offers/:id/respond",client,candidate,
          {action:"counter",counterRate:2700,counterRateCurrency:"USD"},offerId);
        assert.equal(clientCounter.statusCode,200,JSON.stringify(clientCounter.body));
        offerId=clientCounter.body.id;
      }
    }
    if(variant==="renewed") {
      await query("UPDATE offers SET status='expired' WHERE id=$1",[offerId]);
      await query("UPDATE job_submissions SET status='offer_expired' WHERE id=$1",[id]);
      await extendOfferExpiration(offerId,admin,"2099-11-01T00:00:00Z");
    }
    const acceptPath=variant==="talent-counter"?"/api/client/offers/:id/respond":"/api/talent/offers/:id/respond";
    const accepted=await offerHandler("patch",acceptPath,variant==="talent-counter"?client:talent,candidate,{action:"accept"},offerId);
    assert.equal(accepted.statusCode,200,JSON.stringify(accepted.body));
    const deposit=(await query("SELECT * FROM security_deposits WHERE offer_id=$1",[offerId])).rows[0];
    assert.ok(deposit,variant);
    assert.equal(await isDepositFirst(pool,id),true,variant);
    assert.equal(deposit.hiring_contract_id,null,variant);
    assert.equal(deposit.offer_id,offerId,variant);
    assert.equal(deposit.status,"pending",variant);
    await assert.rejects(createHiringContract({offerId,adminId:admin}),
      error("DEPOSIT_PAYMENT_REQUIRED"),variant);
    assert.equal((await query("SELECT count(*)::int n FROM hiring_contracts WHERE offer_id=$1",[offerId])).rows[0].n,0,variant);
    // Retry creates no second debt.
    assert.equal((await tx(db=>issueAcceptedOfferDeposit(db,offerId,id))).id,deposit.id,variant);
  }
});
test("both HTTP acceptance handlers use the invoice-first helper before committing; admin-created offers use the shared writer",()=>{
  const routes=readFileSync("server/routes.ts","utf8");
  for(const path of ["/api/client/offers/:id/respond","/api/talent/offers/:id/respond"]) {
    const start=routes.indexOf(`app.patch("${path}"`);
    assert.ok(start>=0,path);
    const section=routes.slice(start,routes.indexOf('\n  app.',start+1));
    const call=section.indexOf('await issueAcceptedOfferDeposit(txClient,offer.id,offer.js_id)');
    assert.ok(call>=0,path);
    assert.ok(section.indexOf('await txClient.query("COMMIT")',call)>call,path);
    assert.match(section,/action==="accept"/);
  }
  const writer=routes.slice(routes.indexOf('app.post("/api/client/offers"'));
  assert.match(writer.slice(0,13000),/loadAdminFormalSubmission/);
});
test("accepted offer issues one pre-contract deposit using existing math/currency; drafts blocked until funding",async()=>{
  const a=await accepted();
  assert.equal(a.deposit.hiring_contract_id,null);
  assert.equal(Number(a.deposit.amount),computeDepositAmount(2500));
  assert.equal(a.deposit.currency,"USD");
  const talentProgress=await onboardingStatus(pool,a.submissionId,talent);
  assert.equal(talentProgress.deposit?.invoiceUrl,null);
  assert.equal("id" in talentProgress.deposit!,false,"Talent sees progress, not the Client billing identifier");
  await assert.rejects(onboardingStatus(pool,a.submissionId,other),(e:any)=>e.status===404);
  await Promise.all([tx(db=>issueAcceptedOfferDeposit(db,a.offerId,a.submissionId)),tx(db=>issueAcceptedOfferDeposit(db,a.offerId,a.submissionId))]);
  assert.equal((await query("SELECT count(*)::int n FROM security_deposits WHERE offer_id=$1",[a.offerId])).rows[0].n,1);
  await assert.rejects(documents.prepareContract({id:admin},{offerId:a.offerId,partyType:"onspot"}),error("DEPOSIT_PAYMENT_REQUIRED"));
  assert.equal((await query("SELECT count(*)::int n FROM hiring_contracts WHERE offer_id=$1",[a.offerId])).rows[0].n,0);
});
test("payment reject/resubmit/verify creates one private draft; all missing prerequisites block",async()=>{
  const a=await accepted(),prepared=await verifiedPayment(a);
  assert.ok(prepared.contractId);
  const again=await preparePaidAgreements(pool,{...a,depositId:a.deposit.id,actorId:admin});
  assert.equal(again.contractId,prepared.contractId);
  assert.equal(await tx(db=>tryActivateEngagement(db,a.submissionId,admin)),false);
  await signContract(prepared.contractId);
  assert.equal(await status(a.submissionId),"contract_signed","signed contractor agreement without active MSA cannot hire");
});
test("private versioned MSA requires Super Admin review, exact PDF/hash/read/consent and server evidence; last condition activates once",async()=>{
  await assert.rejects(msa.upload(limited,{buffer:pdf,mimetype:"application/pdf",originalname:"UAT.pdf"} as any,"uat-v1","2026-01-01"),(e:any)=>e.status===403);
  const draft=await msa.upload(admin,{buffer:pdf,mimetype:"application/pdf",originalname:"UAT.pdf"} as any,"uat-v1","2026-01-01");
  assert.equal((await msa.status(client)).document,null);
  await assert.rejects(msa.activate(admin,draft.id,{reviewed:false,reason:"not reviewed"}),(e:any)=>e.status===422&&e.code==="MSA_REVIEW_REQUIRED");
  await msa.activate(admin,draft.id,{reviewed:true,reason:"Synthetic UAT legal PDF reviewed; no legal advice or real signature"});
  const a=await accepted(),prepared=await verifiedPayment(a);
  await signContract(prepared.contractId);
  await assert.rejects(msa.pdf(other,draft.id),(e:any)=>e.status===403||e.status===404);
  const input={documentId:draft.id,documentSha256:pdfHash(pdf),consent:true,signerName:"Disposable Client"};
  await assert.rejects(msa.sign(client,input,{ip:"127.0.0.1",userAgent:"isolated-fixture"}),error("REVIEW_PDF_FIRST"));
  await msa.pdf(client,draft.id);
  await assert.rejects(msa.sign(client,{...input,documentSha256:"0".repeat(64)},{ip:"127.0.0.1",userAgent:"isolated-fixture"}),error("MSA_VERSION_CHANGED"));
  await msa.sign(client,input,{ip:"127.0.0.1",userAgent:"isolated-fixture"});
  assert.equal(await status(a.submissionId),"hired");
  await msa.sign(client,input,{ip:"127.0.0.1",userAgent:"isolated-fixture"});
  await Promise.all([tx(db=>tryActivateEngagement(db,a.submissionId,admin)),tx(db=>tryActivateEngagement(db,a.submissionId,admin))]);
  assert.equal((await query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1 AND new_status='hired'",[a.submissionId])).rows[0].n,1);
  assert.equal((await query("SELECT count(*)::int n FROM client_msa_signatures WHERE client_id=$1 AND msa_version='uat-v1'",[client])).rows[0].n,1);
});
test("same current MSA is reused for the next hire; final contractor signature activates and initializes billing once",async()=>{
  const a=await accepted(),prepared=await verifiedPayment(a);
  assert.equal(await status(a.submissionId),"offer_accepted");
  await signContract(prepared.contractId);
  assert.equal(await status(a.submissionId),"hired");
  assert.ok((await query("SELECT billing_activated_at FROM hiring_contracts WHERE id=$1",[prepared.contractId])).rows[0].billing_activated_at);
});
test("a new MSA version requires fresh signature for a new activation; private bytes cannot be substituted",async()=>{
  const prior=(await query("SELECT id FROM job_submissions WHERE client_id=$1 AND status='hired' LIMIT 1",[client])).rows[0].id;
  const next=await msa.upload(admin,{buffer:pdf,mimetype:"application/pdf",originalname:"UAT-v2.pdf"} as any,"uat-v2","2026-01-01");
  assert.equal((await msa.status(client)).document?.version,"uat-v1","a draft must not change the active agreement");
  await msa.activate(admin,next.id,{reviewed:true,reason:"Reviewed synthetic UAT version two"});
  assert.equal(await status(prior),"hired","publishing an MSA does not rewrite active engagements");
  const a=await accepted(),prepared=await verifiedPayment(a);
  await signContract(prepared.contractId);
  assert.equal(await status(a.submissionId),"contract_signed","a signature of v1 cannot execute v2");
  const key=(await query("SELECT object_key FROM msa_documents WHERE id=$1",[next.id])).rows[0].object_key;
  files.set(key,Buffer.from("TAMPERED UAT BYTES"));
  await assert.rejects(msa.pdf(client,next.id),error("DOCUMENT_CHANGED"));
  files.set(key,Buffer.from(pdf));
  await msa.pdf(client,next.id);
  const input={documentId:next.id,documentSha256:pdfHash(pdf),consent:true,signerName:"Disposable Client"};
  await assert.rejects(msa.sign(admin,input,{ip:"127.0.0.1",userAgent:"isolated-fixture"}),(e:any)=>e.status===403);
  await msa.sign(client,input,{ip:"127.0.0.1",userAgent:"isolated-fixture"});
  assert.equal(await status(a.submissionId),"hired");
});
test("voiding an accepted offer preserves but voids its pending invoice, and the migration is repeatable",async()=>{
  const a=await accepted();
  await query("UPDATE offers SET status='voided' WHERE id=$1",[a.offerId]);
  assert.equal((await query("SELECT status FROM security_deposits WHERE id=$1",[a.deposit.id])).rows[0].status,"void");
  await query(readFileSync("migrations/0044_contractor_onboarding.sql","utf8"));
  assert.equal(await isDepositFirst(pool,a.submissionId),true);
});
test("activation is safe in all six condition/callback orders, with concurrent final attempts",async()=>{
  // These are deliberately synthetic canonical-state fixtures, NOT a way to
  // prepare/sign unpaid contracts through the application APIs. Those guards
  // and actual private-document signing are exercised above.
  for(const order of ["DCM","DMC","CDM","CMD","MDC","MCD"]) {
    const document=await msa.upload(admin,{buffer:pdf,mimetype:"application/pdf",originalname:"UAT-order.pdf"} as any,`uat-order-${order}`,"2026-01-01");
    await msa.activate(admin,document.id,{reviewed:true,reason:`Synthetic callback order ${order}`});
    const a=await accepted();
    await query("UPDATE security_deposits SET status='held' WHERE id=$1",[a.deposit.id]);
    const prepared=await preparePaidAgreements(pool,{...a,depositId:a.deposit.id,actorId:admin});
    await query("UPDATE security_deposits SET status='pending' WHERE id=$1",[a.deposit.id]);
    for(let index=0;index<order.length;index++) {
      if(order[index]==="D")await query("UPDATE security_deposits SET status='held',held_at=now() WHERE id=$1",[a.deposit.id]);
      if(order[index]==="C") {
        await query("UPDATE hiring_contracts SET status='signed',onspot_signed_at=now(),talent_signed_at=now() WHERE id=$1",[prepared.contractId]);
        await query("UPDATE job_submissions SET status='contract_signed' WHERE id=$1",[a.submissionId]);
      }
      if(order[index]==="M") {
        await msa.pdf(client,document.id);
        await msa.sign(client,{documentId:document.id,documentSha256:pdfHash(pdf),consent:true,signerName:"Disposable Client"},
          {ip:"127.0.0.1",userAgent:"isolated-state-order-fixture"});
      }
      await Promise.all([tx(db=>tryActivateEngagement(db,a.submissionId,admin)),tx(db=>tryActivateEngagement(db,a.submissionId,admin))]);
      assert.equal((await status(a.submissionId))==="hired",index===2,`${order} after ${index+1} conditions`);
    }
    assert.equal((await query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1 AND new_status='hired'",[a.submissionId])).rows[0].n,1);
  }
});
