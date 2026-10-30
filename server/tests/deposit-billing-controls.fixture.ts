/** Real disposable PostgreSQL. Fixture identities/storage are NOT authenticated account UAT. */
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {PDFDocument} from "pdf-lib";
import {pool,query} from "./fixtures/hiring-db";
import {DepositBillingService} from "../services/depositBillingService";
import {OnboardingRepairService} from "../services/onboardingRepairService";
import {onboardingStatus} from "../services/contractorOnboardingStatus";
import {issueAcceptedOfferDeposit,requirePaidContract} from "../services/contractorOnboardingPolicy";
import {tryActivateEngagement} from "../services/hiringLifecycleEvents";
import {onboardingPrerequisites,enqueueOnboardingSetupAlerts} from "../services/onboardingPrerequisites";
import {enqueueDeferredDepositReminders} from "../services/depositReminders";
import {msaSignatureExists} from "../services/depositArrangementState";
import {contractorOnboardingRouter} from "../routes/contractorOnboarding";
import {ManualWiseService} from "../services/manualWiseService";
import {pdfHash} from "../services/contractBlobStore";

const suffix=randomUUID(),admin=`deposit-super-${suffix}`,client=`deposit-client-${suffix}`,talent=`deposit-talent-${suffix}`,
  ta=`deposit-ta-${suffix}`,cs=`deposit-cs-${suffix}`,other=`deposit-other-${suffix}`,job=randomUUID();
const objects=new Map<string,Buffer>();
const blobs={save:async(b:Buffer)=>{const k=`/objects/hiring-contract-documents/${randomUUID()}`;objects.set(k,b);return k;},
  read:async(k:string)=>{if(!objects.has(k))throw new Error("Missing private evidence");return objects.get(k)!;},
  remove:async(k:string)=>{objects.delete(k);}};
const billing=new DepositBillingService(pool,undefined,blobs),repair=new OnboardingRepairService(pool);
const reason="Synthetic no-money business exception for disposable PostgreSQL testing";
let base:string,server:any,pdf:Buffer;
async function tx<T>(fn:(db:any)=>Promise<T>){const db=await pool.connect();try{await db.query("BEGIN");const r=await fn(db);await db.query("COMMIT");return r;}
catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}}
async function application(accepted=true,deposit=true) {
  const id=(await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,status,workflow_type,initiated_by,registration_status)
    VALUES($1,$2,$3,$4,'Synthetic only',$5,'application','talent','linked') RETURNING id`,[job,client,talent,`${talent}@fixture.invalid`,accepted?"offer_accepted":"new"])).rows[0].id;
  await query("INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status) VALUES($1,2,'new') ON CONFLICT(submission_id) DO UPDATE SET workflow_version=2",[id]);
  if(!accepted)return {id,offer:null,deposit:null};
  const o=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date,accepted_at)
    VALUES($1,'accepted',2500,'USD','Standard','tracked','2099-01-01',now()) RETURNING *`,[id])).rows[0];
  if(deposit)await tx(db=>issueAcceptedOfferDeposit(db,o.id,id));
  return {id,offer:o,deposit:(await query("SELECT * FROM security_deposits WHERE offer_id=$1",[o.id])).rows[0]??null};
}
before(async()=>{
  await query("DROP TRIGGER IF EXISTS fixture_legacy_onboarding ON job_submissions");
  for(const [id,role,sub] of [[admin,"admin",null],[client,"client",null],[talent,"talent",null],[ta,"admin","talent_acquisition"],[cs,"admin","client_success"],[other,"client",null]])
    await query("INSERT INTO users(id,email,role,admin_sub_role,password_hash) VALUES($1,$2,$3,$4,'NOT_A_LOGIN_HASH')",[id,`${id}@fixture.invalid`,role,sub]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Synthetic deposit role','Not a real job','Operations','Intermediate','open','approved','Standard','tracked')`,[job,client]);
  const doc=await PDFDocument.create();doc.addPage();pdf=Buffer.from(await doc.save());
  const app=express();app.use(express.json());
  app.use(contractorOnboardingRouter((req:any,res,next)=>{req.user={id:req.get("x-fixture-actor")};req.user.id?next():res.sendStatus(401);},(_req,_res,next)=>next()));
  app.use((error:any,_req:any,res:any,_next:any)=>res.status(error.status??500).json({error:error.message}));
  server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{await new Promise<void>(r=>server.close(r));await pool.end();});
test("All new admin endpoints reject Client, Talent, TA, Client Success and unrelated clients before file consumption",async()=>{
  for(const actor of [client,talent,ta,cs,other])for(const [method,path] of [
    ["GET","onboarding-prerequisites"],["GET","onboarding-repairs"],["GET","deposit-billing/synthetic"],["GET",`deposit-receipts/${randomUUID()}`],
    ...["record_payment","defer","waive","resend_invoice"].map(action=>["POST",`deposit-billing/synthetic/${action}`]),
    ["POST","onboarding-repairs/synthetic/dry-run"],["POST","onboarding-repairs/synthetic/apply"],["POST","msa-offline/synthetic"]]) {
    const res=await fetch(`${base}/api/admin/${path}`,{method,headers:{"x-fixture-actor":actor,"Content-Type":"application/json"},
      ...(method==="POST"?{body:JSON.stringify({reason})}:{})});
    assert.equal(res.status,403,`${actor} ${path}`);
  }
});
test("Missing accepted offer is an explicit data issue; repair dry-run, stale protection, missing deposit and duplicate alias preserve immutable sources",async()=>{
  const bad=await application(false);await query("UPDATE job_submissions SET status='offer_accepted' WHERE id=$1",[bad.id]);
  const state=await onboardingStatus(pool,bad.id,client);
  assert.equal(state.dataIssue,true);assert.equal(state.stages.some(s=>s.current),false);assert.equal(state.repairUrl,null);
  assert.match((await onboardingStatus(pool,bad.id,admin)).repairUrl,/contractor-onboarding/);
  const source=await application(true,false);
  const missing=await repair.dryRun(admin,source.id,{action:"issue_deposit"});
  await assert.rejects(repair.apply(admin,source.id,{action:"issue_deposit",fingerprint:"stale",reason}),(e:any)=>e.code==="STALE_DRY_RUN");
  await repair.apply(admin,source.id,{action:"issue_deposit",fingerprint:missing.fingerprint,reason});
  await repair.apply(admin,source.id,{action:"issue_deposit",fingerprint:missing.fingerprint,reason});
  assert.equal((await query("SELECT count(*)::int n FROM security_deposits WHERE offer_id=$1",[source.offer.id])).rows[0].n,1);
  const plan=await repair.dryRun(admin,bad.id,{action:"link_offer",offerId:source.offer.id});
  await repair.apply(admin,bad.id,{action:"link_offer",offerId:source.offer.id,fingerprint:plan.fingerprint,reason});
  const linked=await onboardingStatus(pool,bad.id,client);
  assert.equal(linked.dataIssue,false);assert.equal(linked.canonicalSubmissionId,source.id);assert.equal(linked.offerId,source.offer.id);
  assert.equal((await query("SELECT submission_id FROM offers WHERE id=$1",[source.offer.id])).rows[0].submission_id,source.id);
  const revert=await application(false);await query("UPDATE job_submissions SET status='offer_accepted' WHERE id=$1",[revert.id]);
  const p=await repair.dryRun(admin,revert.id,{action:"revert"});
  await repair.apply(admin,revert.id,{action:"revert",fingerprint:p.fingerprint,reason});
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[revert.id])).rows[0].status,"new");
});
test("External payment requires exact amount, independent admin attestation, private evidence, duplicate-reference protection, one settlement and truthful tracker",async()=>{
  const a=await application();
  const data={amount:String(a.deposit.amount),currency:"USD",receivedAt:"2001-01-01",reference:`EXTERNAL-${randomUUID()}`,method:"cash",reason,independentlyVerified:true};
  await assert.rejects(billing.act(admin,a.id,"record_payment",{...data,amount:"1.00"}),(e:any)=>e.status===422);
  assert.equal((await query("SELECT status FROM security_deposits WHERE id=$1",[a.deposit.id])).rows[0].status,"pending");
  await assert.rejects(billing.act(admin,a.id,"record_payment",{...data,independentlyVerified:false}));
  const before=objects.size;
  const paid=await billing.act(admin,a.id,"record_payment",data,{buffer:pdf,originalname:"synthetic-receipt.pdf",mimetype:"application/pdf"});
  assert.equal(objects.size,before+1);
  assert.deepEqual((await billing.externalReceipt(admin,a.deposit.id)).bytes,pdf);
  await assert.rejects(billing.externalReceipt(client,a.deposit.id),(e:any)=>e.status===403);
  await billing.act(admin,a.id,"record_payment",data);
  const d=(await query("SELECT * FROM security_deposits WHERE id=$1",[a.deposit.id])).rows[0];
  assert.equal(d.status,"held");assert.equal(d.verified_by,admin);assert.equal(d.payment_source,"external");
  assert.equal((await query("SELECT count(*)::int n FROM external_deposit_payments WHERE deposit_id=$1",[d.id])).rows[0].n,1);
  assert.equal((await query("SELECT count(*)::int n FROM manual_wise_audit WHERE event='payment_verified' AND details->>'externalPaymentId'=$1",[paid.id])).rows[0].n,1);
  const b=await application();await assert.rejects(billing.act(admin,b.id,"record_payment",{...data,amount:String(b.deposit.amount)}),(e:any)=>e.status===409);
  const s=await onboardingStatus(pool,a.id,client);assert.equal(s.paymentState,"Paid");assert.equal(s.deposit.paymentSource,"external");
  const t=await onboardingStatus(pool,a.id,talent);assert.equal(t.deposit,null);assert.equal(t.paymentState,null);
  assert.equal(t.stages.some(x=>["invoice","payment_verified"].includes(x.key)),false);
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[a.id])).rows[0].status,"offer_accepted");
});
test("Deposit deferral preserves invoice debt, allows agreement guard, but never activates until held; scoped legacy waivers remain distinct",async()=>{
  const a=await application();await billing.act(admin,a.id,"defer",{reason,dueDate:"2099-01-01"});
  await tx(db=>requirePaidContract(db,a.offer.id,a.id));
  const hc=(await query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,signing_entity,billing_mode,effective_start_date,onspot_signed_at,talent_signed_at)
    VALUES($1,$2,'signed','Synthetic only','tracked','2099-01-01',now(),now()) RETURNING id`,[a.offer.id,a.id])).rows[0];
  await query("UPDATE security_deposits SET hiring_contract_id=$2 WHERE id=$1",[a.deposit.id,hc.id]);
  assert.equal(await tx(db=>tryActivateEngagement(db,a.id,admin)),false);
  const s=await onboardingStatus(pool,a.id,client);assert.equal(s.paymentState,"Deferred");assert.ok(s.deposit.deferredDueAt);
  assert.equal((await query("SELECT status FROM security_deposits WHERE id=$1",[a.deposit.id])).rows[0].status,"pending");
  await query("UPDATE hiring_payment_waivers SET granted_at=now()-interval '15 days',deposit_due_at=now()-interval '15 days' WHERE submission_id=$1 AND scope='deposit'",[a.id]);
  await enqueueDeferredDepositReminders(pool);await enqueueDeferredDepositReminders(pool);
  assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key LIKE 'deferred-deposit-reminder:%' AND payload->>'submissionId'=$1",[a.id])).rows[0].n,3);
  assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key LIKE 'deferred-deposit-overdue:%' AND payload->>'submissionId'=$1",[a.id])).rows[0].n,1);
});
test("Offline signed MSA is private version-bound evidence; waiver permits activation without inventing cash or electronic signatures",async()=>{
  const a=await application();
  await assert.rejects(billing.recordOfflineMsa(admin,a.id,{documentId:randomUUID(),signerName:"Fixture representative",signerEmail:"signer@fixture.invalid",signedAt:"2001-01-01",reason},
    {buffer:pdf,originalname:"signed.pdf",mimetype:"application/pdf"}),(e:any)=>e.code==="ACTIVE_MSA_REQUIRED");
  const m=(await query(`INSERT INTO msa_documents(version,object_key,filename,file_size,sha256,effective_at,active,uploaded_by)
    VALUES($1,$2,'approved-fixture.pdf',$3,$4,now()-interval '1 day',true,$5) RETURNING *`,[randomUUID(),await blobs.save(pdf),pdf.length,pdfHash(pdf),admin])).rows[0];
  const evidence=await billing.recordOfflineMsa(admin,a.id,{documentId:m.id,signerName:"Fixture representative",signerEmail:"signer@fixture.invalid",signedAt:"2001-01-01",reason},
    {buffer:pdf,originalname:"signed.pdf",mimetype:"application/pdf"});
  assert.equal(await msaSignatureExists(pool,client,m),true);
  assert.deepEqual((await billing.offlinePdf(client,evidence.id)).bytes,pdf);
  await assert.rejects(billing.offlinePdf(other,evidence.id),(e:any)=>e.status===404);
  assert.equal((await query("SELECT count(*)::int n FROM client_msa_signatures WHERE client_id=$1",[client])).rows[0].n,0);
  const hc=(await query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,signing_entity,billing_mode,effective_start_date,onspot_signed_at,talent_signed_at)
    VALUES($1,$2,'signed','Synthetic only','tracked','2099-01-01',now(),now()) RETURNING id`,[a.offer.id,a.id])).rows[0];
  await query("UPDATE security_deposits SET hiring_contract_id=$2 WHERE id=$1",[a.deposit.id,hc.id]);
  await billing.act(admin,a.id,"waive",{reason,arrangementNote:"Explicit no-cash synthetic special arrangement"});
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[a.id])).rows[0].status,"hired");
  const d=(await query("SELECT * FROM security_deposits WHERE id=$1",[a.deposit.id])).rows[0];
  assert.equal(d.status,"waived");assert.equal(d.held_at,null);
  assert.equal((await query("SELECT count(*)::int n FROM external_deposit_payments WHERE deposit_id=$1",[d.id])).rows[0].n,0);
});
test("Missing setup is visible and daily Super notifications enqueue idempotently; invoice resend requires explicit unique request",async()=>{
  const s=await onboardingPrerequisites(pool);assert.equal(s.wiseReady,false);assert.equal(s.msaReady,true);
  await enqueueOnboardingSetupAlerts(pool);await enqueueOnboardingSetupAlerts(pool);
  assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key LIKE 'onboarding-setup:%'")).rows[0].n,1);
  const a=await application();const requestId=randomUUID();
  await billing.act(admin,a.id,"resend_invoice",{reason,requestId});await billing.act(admin,a.id,"resend_invoice",{reason,requestId});
  assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key=$1",[`deposit-resend:${a.deposit.id}:${requestId}`])).rows[0].n,1);
});
test("Deferred signed engagement becomes Active only after exact external settlement; MSA is shared by Client/version",async()=>{
  const a=await application();await billing.act(admin,a.id,"defer",{reason,dueDate:"2099-01-01"});
  await tx(db=>requirePaidContract(db,a.offer.id,a.id));
  const hc=(await query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,signing_entity,billing_mode,effective_start_date,onspot_signed_at,talent_signed_at)
    VALUES($1,$2,'signed','Synthetic only','tracked','2099-01-01',now(),now()) RETURNING id`,[a.offer.id,a.id])).rows[0];
  await query("UPDATE security_deposits SET hiring_contract_id=$2 WHERE id=$1",[a.deposit.id,hc.id]);
  assert.equal(await tx(db=>tryActivateEngagement(db,a.id,admin)),false);
  await billing.act(admin,a.id,"record_payment",{amount:String(a.deposit.amount),currency:"USD",receivedAt:"2001-01-01",
    reference:`EXTERNAL-DEFERRED-${randomUUID()}`,method:"bank_transfer",reason,independentlyVerified:true});
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[a.id])).rows[0].status,"hired");
  assert.ok((await query("SELECT billing_activated_at FROM hiring_contracts WHERE id=$1",[hc.id])).rows[0].billing_activated_at);
  await assert.rejects(query("UPDATE hiring_contracts SET effective_start_date='2099-02-01' WHERE id=$1",[hc.id]),/immutable/);
});
test("Real Wise proof verification and external receipt recording use the same settlement effects without duplicate cash or events",async()=>{
  const qr=(await query(`INSERT INTO manual_wise_files(uploaded_by,purpose,object_key,filename,content_type,byte_size)
    VALUES($1,'qr','private-fixture/qr','SYNTHETIC-ONLY.png','image/png',100) RETURNING id`,[admin])).rows[0].id;
  await query(`INSERT INTO manual_wise_config(currency,recipient,instructions,reference_instructions,qr_file_id,
    active,deposit_funding_confirmed,created_by,config_status,supported_currencies,activated_by,activated_at)
    VALUES('USD','SYNTHETIC ONLY — NOT A RECEIVING ACCOUNT','DO NOT PAY — disposable fixture','Synthetic reference',$1,
    true,true,$2,'active',ARRAY['USD'],$2,now())`,[qr,admin]);
  const real=await application(),external=await application(),wise=new ManualWiseService(pool);
  const receipt=(await query(`INSERT INTO manual_wise_files(uploaded_by,purpose,object_key,filename,content_type,byte_size)
    VALUES($1,'receipt','private-fixture/receipt','SYNTHETIC-ONLY.pdf','application/pdf',100) RETURNING id`,[client])).rows[0].id;
  const proof=await wise.submit(client,"deposit",real.deposit.id,`PROOF-${randomUUID()}`,receipt);
  await wise.review(admin,proof.id,{action:"verify",reason:"SIMULATED independent settlement in owned disposable database only",independentlyVerified:true,
    verifiedAmount:String(real.deposit.amount),verifiedCurrency:"USD",verifiedReference:`WISE-${randomUUID()}`,
    verifiedRecipient:"SYNTHETIC ONLY — NOT A RECEIVING ACCOUNT",settledAt:"2001-01-01"});
  await billing.act(admin,external.id,"record_payment",{amount:String(external.deposit.amount),currency:"USD",receivedAt:"2001-01-01",
    reference:`EXTERNAL-COMPARE-${randomUUID()}`,method:"check",reason,independentlyVerified:true});
  const a=(await query("SELECT status,amount,currency,verified_by,held_at IS NOT NULL AS held FROM security_deposits WHERE id=$1",[real.deposit.id])).rows[0];
  const b=(await query("SELECT status,amount,currency,verified_by,held_at IS NOT NULL AS held FROM security_deposits WHERE id=$1",[external.deposit.id])).rows[0];
  assert.deepEqual(a,b);
  for(const id of [real.id,external.id])assert.equal((await query(`SELECT count(*)::int n FROM hiring_lifecycle_events
    WHERE event_type='deposit_verified' AND payload->>'submissionId'=$1`,[id])).rows[0].n,1);
  assert.equal((await onboardingPrerequisites(pool)).wiseReady,true);
});
test("New migrations reapply idempotently without changing existing deposit rows or evidence",async()=>{
  const deposits=(await query("SELECT to_jsonb(d) AS row FROM security_deposits d ORDER BY id")).rows;
  const payments=(await query("SELECT to_jsonb(p) AS row FROM external_deposit_payments p ORDER BY id")).rows;
  await query(readFileSync("migrations/0052_deposit_billing_controls.sql","utf8"));
  await query(readFileSync("migrations/0053_deposit_activation_evidence.sql","utf8"));
  assert.deepEqual((await query("SELECT to_jsonb(d) AS row FROM security_deposits d ORDER BY id")).rows,deposits);
  assert.deepEqual((await query("SELECT to_jsonb(p) AS row FROM external_deposit_payments p ORDER BY id")).rows,payments);
});
