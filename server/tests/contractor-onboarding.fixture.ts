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

const suffix=randomUUID(),client=`onboard-client-${suffix}`,talent=`onboard-talent-${suffix}`;
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
