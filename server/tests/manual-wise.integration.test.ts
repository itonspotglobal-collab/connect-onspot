import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { Server } from "node:http";
import express from "express";
import pg from "pg";
import { ManualWiseService, WiseError, type WiseCategory } from "../services/manualWiseService";
import { requireVerifiedHiringPayment } from "../services/hiringPaymentService";
import { registerManualWiseRoutes } from "../routes/manualWise";
import { inspectWiseFile } from "../services/manualWiseFiles";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { createHash } from "node:crypto";
import { officialWiseQr } from "../services/officialWiseQr";

// This suite owns a fresh local PostgreSQL cluster. It cannot connect to the app DB.
const root=mkdtempSync(join(tmpdir(),"wise-isolated-"));
let pool:pg.Pool;
let service:ManualWiseService;
let http:Server;
let base:string;
let fixtureQr:string;
const blobs=new Map<string,Buffer>();
const ids={inquiry:randomUUID(),hiring_invoice:randomUUID(),invoice:randomUUID(),
  monthly_invoice:randomUUID(),deposit:randomUUID(),replenishment:randomUUID(),payout:randomUUID()};
const contract= randomUUID(), submission=randomUUID(),talentInvoice=randomUUID(),attempt=randomUUID();
const historicalInvoice=randomUUID(),historicalTopup=randomUUID();
const config={currency:"USD",recipient:"Fixture recipient",instructions:"Fixture transfer instructions only",
  referenceInstructions:"Invoice reference",active:true,depositFundingConfirmed:true};
async function startHttp() {
  const app=express();app.use(express.json());
  registerManualWiseRoutes(app,{service,
    officialQr:async()=>readFileSync("attached_assets/wise-qr-code_1792385025903.png"),
    authenticate:(req:any,res,next)=>{
      const id=req.headers.authorization?.replace("Bearer ","");
      if(!["client","other","admin","limited","talent"].includes(id))return res.status(401).json({error:"Authentication required."});
      req.user={id};next();
    },
    limiter:(_req,_res,next)=>next(),
    blobs:{
      async save(buffer){const key=`fixture-private/${randomUUID()}`;blobs.set(key,buffer);return key;},
      read(key){return Readable.from(blobs.get(key)??[]);},
      async delete(key){blobs.delete(key);},
    },
  });
  http=app.listen(0);await new Promise<void>(resolve=>http.once("listening",resolve));
  base=`http://127.0.0.1:${(http.address() as any).port}`;
}
before(async()=>{
  execFileSync("initdb",["-D",join(root,"data"),"-U","wise_fixture","-A","trust"],{stdio:"ignore"});
  execFileSync("pg_ctl",["-D",join(root,"data"),"-o",`-k ${root} -p 55443 -h ''`,"-w","start"],{stdio:"ignore"});
  pool=new pg.Pool({host:root,port:55443,user:"wise_fixture",database:"postgres"});
  service=new ManualWiseService(pool);
  await pool.query(`
    CREATE TABLE users(id varchar PRIMARY KEY,role text,admin_sub_role text,email text,first_name text,last_name text,
      email_verified_at timestamptz,email_verified_email text,created_at timestamptz DEFAULT now());
    INSERT INTO users VALUES
      ('client','client',null,'payer@fixture.invalid','Payer','One',now(),'payer@fixture.invalid',now()),
      ('other','client',null,'other@fixture.invalid','Other','Two',now(),'other@fixture.invalid',now()),
      ('admin','admin',null,'admin@fixture.invalid','Admin','One',now(),null,now()),
      ('admin2','admin',null,'admin2@fixture.invalid','Admin','Two',now(),null,now()),
      ('limited','admin','client_success','limited@fixture.invalid','Limited','Admin',now(),null,now()),
      ('talent','talent',null,'talent@fixture.invalid','Talent','One',now(),null,now());
    CREATE TABLE job_submissions(id varchar PRIMARY KEY,client_id varchar,talent_id varchar,job_id varchar,
      status text DEFAULT 'contract_signed',updated_at timestamptz);
    CREATE TABLE jobs(id varchar PRIMARY KEY,title text);
    INSERT INTO jobs VALUES('job','Fixture role');
    CREATE TABLE job_application_status_history(id serial PRIMARY KEY,application_id varchar,
      previous_status text,new_status text,note text,changed_by varchar);
    CREATE TABLE hiring_contracts(id uuid PRIMARY KEY,submission_id varchar,status text DEFAULT 'signed',
      billing_activated_at timestamptz,updated_at timestamptz);
    CREATE TABLE inquiries(id varchar PRIMARY KEY,email text,status text,payment_amount numeric(12,2),
      reference_number text,payment_status text,payment_reference_number text,payment_proof_url text,
      payment_confirmation_submitted_at timestamptz,payment_method text,updated_at timestamptz,
      paid_at timestamptz,payment_verified_at timestamptz,payment_rejected_at timestamptz,
      transaction_reference text,admin_payment_notes text,created_at timestamptz DEFAULT now());
    CREATE TABLE hiring_payment_attempts(id uuid PRIMARY KEY,submission_id varchar,client_id varchar,job_id varchar,talent_id varchar);
    CREATE TABLE hiring_pre_offer_invoices(id uuid PRIMARY KEY,submission_id varchar,attempt_id uuid,client_id varchar,talent_id varchar,job_id varchar,
      invoice_type text DEFAULT 'hiring_pre_offer',invoice_number text,amount numeric(12,2),currency text,payment_recipient text,
      payment_reference text,status text,updated_at timestamptz,created_at timestamptz DEFAULT now(),
      verified_amount numeric(12,2),verified_currency text,verified_reference text,verified_recipient text,verified_by varchar,verified_at timestamptz);
    CREATE TABLE hiring_payment_events(id serial PRIMARY KEY,invoice_id uuid,actor_id varchar,event text,
      previous_status text,new_status text,details jsonb);
    CREATE TABLE invoices(id uuid PRIMARY KEY,client_id varchar,amount numeric(12,2),currency text,status text,
      invoice_number text,period_id uuid,paid_at timestamptz,payment_method text,external_ref text,updated_at timestamptz,created_at timestamptz DEFAULT now());
    CREATE TABLE client_monthly_invoices(id uuid PRIMARY KEY,client_id varchar,subtotal numeric(12,2),
      currency text,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE client_credit_applications(client_monthly_invoice_id uuid,amount numeric(12,2));
    CREATE TABLE security_deposits(id uuid PRIMARY KEY,hiring_contract_id uuid,amount numeric(12,2),currency text,status text,
      held_at timestamptz,cure_deadline_at timestamptz,updated_at timestamptz,created_at timestamptz DEFAULT now());
    CREATE TABLE security_deposit_replenishments(id uuid PRIMARY KEY,hiring_contract_id uuid,amount numeric(12,2),
      currency text,reference text,created_at timestamptz DEFAULT now());
    CREATE TABLE talent_invoices(id uuid PRIMARY KEY,status text,talent_id varchar,amount numeric(12,2),currency text);
    CREATE TABLE client_monthly_invoice_lines(client_monthly_invoice_id uuid,talent_invoice_id uuid,client_amount numeric(12,2));
    CREATE TABLE payouts(id uuid PRIMARY KEY,hiring_contract_id uuid,talent_id varchar,talent_invoice_id uuid,
      amount numeric(12,2),currency text,status text,external_ref text,payout_method text,disbursed_at timestamptz,
      period_id uuid,updated_at timestamptz,created_at timestamptz DEFAULT now());
  `);
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status,external_ref) VALUES($1,'client',100,'USD','paid','legacy-settled')",[historicalInvoice]);
  await pool.query("INSERT INTO security_deposit_replenishments(id,hiring_contract_id,amount,currency,reference) VALUES($1,$2,5,'USD','legacy-topup')",[historicalTopup,contract]);
  const migration=readFileSync("migrations/0040_manual_wise_payments.sql","utf8");
  await pool.query(migration); await pool.query(migration);
  const lifecycle=readFileSync("migrations/0041_manual_wise_configuration_lifecycle.sql","utf8");
  await pool.query(lifecycle); await pool.query(lifecycle);
  await pool.query(readFileSync("migrations/0043_deposit_funded_activation.sql","utf8"));
  await pool.query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  await pool.query("INSERT INTO job_submissions(id,client_id,talent_id,job_id) VALUES($1,'client','talent','job')",[submission]);
  await pool.query("INSERT INTO hiring_contracts(id,submission_id) VALUES($1,$2)",[contract,submission]);
  await pool.query("INSERT INTO inquiries(id,email,status,payment_amount,reference_number) VALUES($1,'payer@fixture.invalid','endorsed',100,'INQ-FIXTURE')",[ids.inquiry]);
  await pool.query("INSERT INTO hiring_payment_attempts VALUES($1,$2,'client','job','talent')",[attempt,submission]);
  await pool.query(`INSERT INTO hiring_pre_offer_invoices(id,submission_id,attempt_id,client_id,talent_id,job_id,amount,currency,payment_recipient,status)
    VALUES($1,$2,$3,'client','talent','job',100,'USD','Fixture recipient','issued')`,[ids.hiring_invoice,submission,attempt]);
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','sent')",[ids.invoice]);
  await pool.query("INSERT INTO client_monthly_invoices(id,client_id,subtotal,currency,status) VALUES($1,'client',120,'USD','sent')",[ids.monthly_invoice]);
  await pool.query("INSERT INTO client_credit_applications VALUES($1,20)",[ids.monthly_invoice]);
  await pool.query("INSERT INTO security_deposits(id,hiring_contract_id,amount,currency,status) VALUES($1,$2,1000,'USD','pending')",[ids.deposit,contract]);
  await pool.query("INSERT INTO security_deposit_replenishments(id,hiring_contract_id,amount,currency,payment_status) VALUES($1,$2,100,'USD','unpaid')",[ids.replenishment,contract]);
  await pool.query("INSERT INTO talent_invoices VALUES($1,'sent','talent',100,'USD')",[talentInvoice]);
  await pool.query(`INSERT INTO payouts(id,hiring_contract_id,talent_id,talent_invoice_id,amount,currency,status)
    VALUES($1,$2,'talent',$3,100,'USD','scheduled')`,[ids.payout,contract,talentInvoice]);
  await startHttp();
  const staged=await fetch(base+"/api/admin/manual-wise/config/qr/official",{method:"POST",headers:{Authorization:"Bearer admin"}});
  assert.equal(staged.status,201);
  fixtureQr=(await staged.json() as any).id;
});
after(async()=>{
  if(http)await new Promise<void>(resolve=>http.close(()=>resolve()));
  await pool?.end();
  try {execFileSync("pg_ctl",["-D",join(root,"data"),"-m","immediate","stop"],{stdio:"ignore"});}catch{}
  rmSync(root,{recursive:true,force:true});
});
async function receipt(actor="client") {
  return (await pool.query(`INSERT INTO manual_wise_files(uploaded_by,purpose,object_key,filename,content_type,byte_size)
    VALUES($1,'receipt',$2,'fixture.pdf','application/pdf',100) RETURNING id`,[actor,`fixture-private/${randomUUID()}`])).rows[0].id as string;
}
const review=(reference:string,extra={})=>({action:"verify",reason:"Checked independent transaction record",
  independentlyVerified:true,verifiedAmount:"100",verifiedCurrency:"USD",verifiedReference:reference,
  verifiedRecipient:config.recipient,settledAt:"2026-01-01",...extra});
const deny=(status:number)=>(e:any)=>e instanceof WiseError && e.status===status;
const confirmations={confirmImageReviewed:true,confirmReceivingAccount:true,confirmCurrencies:true,
  confirmInstructions:true,reason:"Fixture independently reviewed receiving details"};
async function publish(input:Record<string,unknown>) {
  const draft=await service.configure("admin",{...input,active:false,qrFileId:input.qrFileId??fixtureQr});
  return (await service.configurations.activate("admin",draft.id,confirmations)).items[0];
}
test("no invented Wise destination, QR or fallback payable amount",async()=>{
  const o=await service.detail("client","invoice",ids.invoice);
  assert.equal(o.instructions,null);assert.equal(o.payable,false);
  await assert.rejects(service.submit("client","invoice",ids.invoice,"ref",await receipt()),deny(409));
  await publish(config);
  const configured=await service.detail("client","invoice",ids.invoice);
  assert.equal(configured.instructions?.qrFileId,fixtureQr);assert.equal(configured.payable,true);
});
test("additive migration preserves historical paid records and counts only historical settled top-ups",async()=>{
  const old=await service.detail("client","invoice",historicalInvoice);
  assert.equal(old.paymentStatus,"paid");assert.deepEqual(old.history,[]);
  assert.equal((await pool.query("SELECT external_ref FROM invoices WHERE id=$1",[historicalInvoice])).rows[0].external_ref,"legacy-settled");
  assert.equal((await pool.query("SELECT payment_status FROM security_deposit_replenishments WHERE id=$1",[historicalTopup])).rows[0].payment_status,"paid");
  await assert.rejects(service.submit("client","invoice",historicalInvoice,"extra",await receipt()),deny(409));
});
test("viewing an inquiry before quoting does not prevent finalizing the real quote",async()=>{
  const id=randomUUID();
  await pool.query("INSERT INTO inquiries(id,email,status,reference_number) VALUES($1,'payer@fixture.invalid','endorsed','INQ-QUOTE')",[id]);
  assert.equal((await service.detail("client","inquiry",id)).payable,false);
  await service.quote("admin",id,{amount:"75.25",currency:"USD"});
  assert.equal((await service.detail("client","inquiry",id)).amount,"75.25");
  await service.submit("client","inquiry",id,"quoted",await receipt());
  await assert.rejects(service.quote("admin",id,{amount:"85",currency:"USD"}),deny(409));
});
test("inquiry receipt stays pending; rejection is retained and corrected evidence can be submitted",async()=>{
  const s=await service.submit("client","inquiry",ids.inquiry,"inquiry-claim",await receipt());
  assert.equal((await pool.query("SELECT status,payment_status FROM inquiries WHERE id=$1",[ids.inquiry])).rows[0].status,"endorsed");
  assert.equal((await service.detail("client","inquiry",ids.inquiry)).paymentStatus,"verification_pending");
  await service.review("admin",s.id,{action:"reject",reason:"Reference does not appear in recipient account"});
  let o=await service.detail("client","inquiry",ids.inquiry);
  assert.equal(o.paymentStatus,"rejected");assert.equal(o.payable,true);
  assert.match(o.history[0].rejection_reason,/recipient account/);
  const resub=await service.submit("client","inquiry",ids.inquiry,"corrected",await receipt());
  await service.review("admin",resub.id,review("inquiry-settled"));
  o=await service.detail("client","inquiry",ids.inquiry);
  assert.equal(o.paymentStatus,"paid");assert.equal(o.history.length,2);assert.equal(o.history[1].status,"rejected");
});
test("hiring receipt never unlocks offer; only Super Admin independent verification satisfies canonical gate",async()=>{
  const s=await service.submit("client","hiring_invoice",ids.hiring_invoice,"hiring-claim",await receipt());
  await assert.rejects(requireVerifiedHiringPayment(pool as any,submission),/paid and verified/);
  await assert.rejects(service.review("client",s.id,review("hiring-settled")),deny(403));
  await assert.rejects(service.review("limited",s.id,review("hiring-settled")),deny(403));
  await service.review("admin",s.id,review("hiring-settled"));
  assert.equal(await requireVerifiedHiringPayment(pool as any,submission),ids.hiring_invoice);
});
test("legacy invoice and monthly net balance remain unpaid until settled; all mismatch checks fail closed",async()=>{
  for(const c of ["invoice","monthly_invoice"] as const) {
    const s=await service.submit("client",c,ids[c],`${c}-claim`,await receipt());
    assert.notEqual((await service.detail("client",c,ids[c])).paymentStatus,"paid");
    for(const extra of [{verifiedAmount:"99"},{verifiedCurrency:"PHP"},{verifiedRecipient:"Wrong recipient"}]) {
      await assert.rejects(service.review("admin",s.id,review(`${c}-settled`,extra)),deny(409));
    }
    await assert.rejects(service.review("admin",s.id,{action:"verify",reason:"Only receipt"}),/Independent settlement/);
    await service.review("admin",s.id,review(`${c}-settled`));
    assert.equal((await service.detail("client",c,ids[c])).paymentStatus,"paid");
  }
});
test("pending deposit proof does not establish held funding; policy confirmation is mandatory",async()=>{
  await publish({...config,depositFundingConfirmed:false});
  assert.equal((await service.detail("client","deposit",ids.deposit)).payable,false);
  await publish(config);
  let s=await service.submit("client","deposit",ids.deposit,"deposit-claim",await receipt());
  assert.equal((await pool.query("SELECT status FROM security_deposits WHERE id=$1",[ids.deposit])).rows[0].status,"pending");
  assert.equal((await pool.query("SELECT status FROM job_submissions WHERE id=$1",[submission])).rows[0].status,"contract_signed");
  assert.equal((await pool.query("SELECT billing_activated_at FROM hiring_contracts WHERE id=$1",[contract])).rows[0].billing_activated_at,null);
  assert.equal((await pool.query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_type='proof_submitted' AND payload->>'proofId'=$1",[s.id])).rows[0].n,1);
  await service.review("admin",s.id,{action:"reject",reason:"Fixture reference needs correction"});
  assert.equal((await pool.query("SELECT status FROM job_submissions WHERE id=$1",[submission])).rows[0].status,"contract_signed");
  assert.equal((await pool.query("SELECT status FROM security_deposits WHERE id=$1",[ids.deposit])).rows[0].status,"pending");
  assert.equal((await pool.query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_type='proof_rejected' AND payload->>'proofId'=$1",[s.id])).rows[0].n,1);
  s=await service.submit("client","deposit",ids.deposit,"corrected-deposit-claim",await receipt());
  await service.review("admin",s.id,review("deposit-settled",{verifiedAmount:"1000"}));
  assert.equal((await pool.query("SELECT status FROM security_deposits WHERE id=$1",[ids.deposit])).rows[0].status,"held");
  assert.equal((await pool.query("SELECT status FROM job_submissions WHERE id=$1",[submission])).rows[0].status,"hired");
  assert.ok((await pool.query("SELECT billing_activated_at FROM hiring_contracts WHERE id=$1",[contract])).rows[0].billing_activated_at);
  await service.review("admin",s.id,review("deposit-settled",{verifiedAmount:"1000"}));
  assert.equal((await pool.query("SELECT count(*)::int n FROM job_application_status_history WHERE application_id=$1 AND new_status='hired'",[submission])).rows[0].n,1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key=$1",[`engagement-active:${contract}`])).rows[0].n,1);
});
test("unverified replenishment does not add settled coverage",async()=>{
  const s=await service.submit("client","replenishment",ids.replenishment,"topup-claim",await receipt());
  assert.equal((await pool.query("SELECT payment_status FROM security_deposit_replenishments WHERE id=$1",[ids.replenishment])).rows[0].payment_status,"unpaid");
  await service.review("admin",s.id,review("topup-settled"));
  assert.equal((await pool.query("SELECT payment_status FROM security_deposit_replenishments WHERE id=$1",[ids.replenishment])).rows[0].payment_status,"paid");
});
test("authorization, ownership and private receipt access are enforced independently of IDs",async()=>{
  await assert.rejects(service.detail("other","invoice",ids.invoice),deny(404));
  await assert.rejects(service.detail("talent","invoice",ids.invoice),deny(403));
  const owner=await service.detail("client","invoice",ids.invoice);
  const fileId=owner.history[0].receipt_id;
  assert.equal((await service.fileAccess("client",fileId)).id,fileId);
  await assert.rejects(service.fileAccess("other",fileId),deny(404));
  await assert.rejects(service.fileAccess("limited",fileId),deny(404));
  assert.equal((await service.fileAccess("admin",fileId)).id,fileId);
  await assert.rejects(service.submissions("client",{}),deny(403));
  await assert.rejects(service.config("limited"),deny(403));
});
test("two admins, retries and duplicate settlement references cannot double-credit or rewrite history",async()=>{
  const id=randomUUID();
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','sent')",[id]);
  const s=await service.submit("client","invoice",id,"race-claim",await receipt());
  await assert.rejects(service.review("admin",s.id,review("INVOICE-SETTLED")),deny(409));
  await assert.rejects(service.review("admin",s.id,review("legacy-settled")),deny(409));
  const result=await Promise.all([service.review("admin",s.id,review("race-settled")),service.review("admin2",s.id,review("race-settled"))]);
  assert.equal(result[0].id,result[1].id);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM manual_wise_audit WHERE submission_id=$1 AND event='payment_verified'",[s.id])).rows[0].n,1);
  await assert.rejects(service.submit("client","invoice",id,"duplicate",await receipt()),deny(409));
});
test("voided obligations reject new proofs and admin list returns history without blob keys",async()=>{
  const id=randomUUID();
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','void')",[id]);
  await assert.rejects(service.submit("client","invoice",id,"claim",await receipt()),deny(409));
  const result=await service.submissions("admin",{currency:"USD",reference:"claim"});
  assert.ok(result.items.length>0);
  assert.equal(JSON.stringify(result).includes("object_key"),false);
});
test("outgoing payout has no collection QR; receipt alone leaves it scheduled, verified transfer disburses once",async()=>{
  const o=await service.detail("admin","payout",ids.payout);
  assert.equal(o.instructions,null);assert.equal(o.direction,"outgoing");assert.equal(o.payable,false);
  await service.destination("admin",ids.payout,{recipient:"Approved Talent destination",reason:"Independent destination approval",independentlyApproved:true});
  const s=await service.submit("admin","payout",ids.payout,"outgoing-claim",await receipt("admin"));
  assert.equal((await pool.query("SELECT status FROM payouts WHERE id=$1",[ids.payout])).rows[0].status,"scheduled");
  await service.review("admin2",s.id,review("outgoing-settled",{verifiedRecipient:"Approved Talent destination"}));
  assert.equal((await pool.query("SELECT status FROM payouts WHERE id=$1",[ids.payout])).rows[0].status,"disbursed");
  await service.review("admin2",s.id,review("outgoing-settled",{verifiedRecipient:"Approved Talent destination"}));
  await assert.rejects(service.detail("talent","payout",ids.payout),deny(403));
});
test("real HTTP multipart validates content, stores privately, and owner/admin-only downloads preserve bytes",async()=>{
  const storedBefore=blobs.size;
  const id=randomUUID();
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','sent')",[id]);
  const endpoint=`${base}/api/manual-wise/obligations/invoice/${id}/proofs`;
  const bad=new FormData();bad.append("reference","bad");bad.append("receipt",new Blob(["<html>not a receipt</html>"],{type:"image/png"}),"fake.png");
  const rejected=await fetch(endpoint,{method:"POST",headers:{Authorization:"Bearer client"},body:bad});
  assert.equal(rejected.status,422);assert.equal(blobs.size,storedBefore);
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLYsAAAAASUVORK5CYII=","base64");
  const form=new FormData();form.append("reference","http-claim");form.append("amount","1");form.append("currency","PHP");form.append("payerId","other");form.append("receipt",new Blob([png],{type:"text/plain"}),"receipt.txt");
  const submitted=await fetch(endpoint,{method:"POST",headers:{Authorization:"Bearer client"},body:form});
  assert.equal(submitted.status,201,await submitted.clone().text());
  const s=await submitted.json() as any;assert.equal(s.status,"verification_pending");
  assert.equal(s.amount,"100.00");assert.equal(s.currency,"USD");assert.equal(s.submitted_by,"client");
  const url=`${base}/api/manual-wise/files/${s.receipt_id}`;
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{Authorization:"Bearer other"}})).status,404);
  for(const actor of ["client","admin"]) {
    const response=await fetch(url,{headers:{Authorization:`Bearer ${actor}`}});
    assert.equal(response.status,200);
    assert.equal(response.headers.get("content-type"),"image/png");
    assert.equal(response.headers.get("cache-control"),"no-store");
    assert.equal(response.headers.get("x-content-type-options"),"nosniff");
    assert.ok(Buffer.from(await response.arrayBuffer()).equals(png));
  }
  assert.equal((await fetch(`${base}/api/admin/manual-wise/submissions`,{headers:{Authorization:"Bearer client"}})).status,403);
  assert.equal((await fetch(`${base}/api/admin/manual-wise/submissions`,{headers:{Authorization:"Bearer limited"}})).status,403);
  const unauthenticated=await fetch(`${base}/api/admin/manual-wise/submissions/${s.id}/review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(review("http-settled"))});
  assert.equal(unauthenticated.status,401);
});
test("retired settlement shortcuts and public legacy receipt URLs cannot bypass verification",async()=>{
  for(const [method,path,body] of [
    ["PATCH",`/api/inquiries/${ids.inquiry}/payment/verify`,{}],
    ["POST",`/api/client/hiring-invoices/${ids.hiring_invoice}/reference`,{reference:"shortcut"}],
    ["PATCH",`/api/admin/invoices/${ids.invoice}`,{action:"paid"}],
    ["PATCH",`/api/admin/payouts/${ids.payout}`,{action:"disbursed"}],
    ["PATCH",`/api/admin/security-deposits/${ids.deposit}`,{action:"held"}],
  ] as const) {
    const response=await fetch(base+path,{method,headers:{Authorization:"Bearer client","Content-Type":"application/json"},body:JSON.stringify(body)});
    assert.equal(response.status,409);
  }
  assert.equal((await fetch(base+"/payment-proofs/old-receipt.pdf")).status,403);
});
test("receipt inspection rejects invalid, oversized and active evidence and accepts passive PDFs",async()=>{
  await assert.rejects(inspectWiseFile(Buffer.from("<svg onload='alert(1)'/>")));
  await assert.rejects(inspectWiseFile(Buffer.alloc(8*1024*1024+1)));
  const doc=await PDFDocument.create();doc.addPage();
  const passive=Buffer.from(await doc.save());
  assert.equal(await inspectWiseFile(passive),"application/pdf");
  await assert.rejects(inspectWiseFile(passive,true));
  doc.catalog.set(PDFName.of("OpenAction"),doc.context.obj({S:PDFName.of("JavaScript"),JS:PDFString.of("app.alert('fixture')")}));
  await assert.rejects(inspectWiseFile(Buffer.from(await doc.save())),/without active content/);
});
test("supplied official QR is admin-only, stages exact original bytes, and does not activate a receiving configuration",async()=>{
  const url=base+"/api/admin/manual-wise/config/qr/official";
  for(const method of ["GET","POST"]) {
    assert.equal((await fetch(url,{method})).status,401);
    for(const id of ["client","limited","talent"])assert.equal((await fetch(url,{method,headers:{Authorization:`Bearer ${id}`}})).status,403);
  }
  const before=(await service.config("admin")).items.map((c:any)=>c.id);
  const original=readFileSync("attached_assets/wise-qr-code_1792385025903.png");
  const preview=await fetch(url,{headers:{Authorization:"Bearer admin"}});
  assert.equal(preview.status,200);
  assert.ok(Buffer.from(await preview.arrayBuffer()).equals(original));
  const stage=await fetch(url,{method:"POST",headers:{Authorization:"Bearer admin"}});
  assert.equal(stage.status,201);
  const {id}=await stage.json() as any;
  assert.deepEqual((await service.config("admin")).items.map((c:any)=>c.id),before);
  const bytes=await fetch(`${base}/api/manual-wise/files/${id}`,{headers:{Authorization:"Bearer admin"}});
  assert.equal(createHash("sha256").update(Buffer.from(await bytes.arrayBuffer())).digest("hex"),officialWiseQr.sha256);
  assert.equal((await fetch(`${base}/api/manual-wise/files/${id}`,{headers:{Authorization:"Bearer client"}})).status,404);
  // Bound invoices retain the original QR even when receiving text is unchanged.
  const invoice=randomUUID();
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','sent')",[invoice]);
  assert.equal((await service.detail("client","invoice",invoice)).instructions?.qrFileId,fixtureQr);
  await publish({...config,qrFileId:id});
  assert.equal((await service.detail("client","invoice",invoice)).instructions?.qrFileId,fixtureQr);
  const newInvoice=randomUUID();
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','sent')",[newInvoice]);
  assert.equal((await service.detail("client","invoice",newInvoice)).instructions?.qrFileId,id);
  const ownerDownload=await fetch(`${base}/api/manual-wise/files/${id}`,{headers:{Authorization:"Bearer client"}});
  assert.equal(ownerDownload.status,200);
  assert.ok(Buffer.from(await ownerDownload.arrayBuffer()).equals(original));
  await pool.query("UPDATE invoices SET currency='PHP' WHERE id=$1",[invoice]);
  assert.equal((await service.detail("client","invoice",invoice)).instructions?.qrFileId,null);
  await pool.query("UPDATE invoices SET currency='USD',status='paid' WHERE id=$1",[invoice]);
  assert.equal((await service.detail("client","invoice",invoice)).instructions?.qrFileId,null);
  assert.equal((await service.detail("admin","payout",ids.payout)).instructions,null);
});

test("drafts preserve active settings, require four confirmations, and cannot activate through legacy save",async()=>{
  const active=(await pool.query("SELECT * FROM manual_wise_config WHERE active AND currency='USD'")).rows[0];
  const draft=await service.configure("admin",{...config,active:false,qrFileId:fixtureQr,recipient:"Unapproved replacement"});
  assert.equal(draft.config_status,"draft");
  assert.equal((await pool.query("SELECT id FROM manual_wise_config WHERE active AND currency='USD'")).rows[0].id,active.id);
  await assert.rejects(service.configure("admin",{...config,active:true,qrFileId:fixtureQr}));
  for(const name of ["confirmImageReviewed","confirmReceivingAccount","confirmCurrencies","confirmInstructions"]) {
    await assert.rejects(service.configurations.activate("admin",draft.id,{...confirmations,[name]:false}));
  }
  assert.equal((await pool.query("SELECT id FROM manual_wise_config WHERE active AND currency='USD'")).rows[0].id,active.id);
});

test("real QR replacement upload validates content, previews original bytes, and leaves active config untouched",async()=>{
  const old=(await pool.query("SELECT id FROM manual_wise_config WHERE active AND currency='USD'")).rows[0].id;
  const original=readFileSync("attached_assets/wise-qr-code_1792385025903.png");
  const form=new FormData();form.append("receipt",new Blob([original],{type:"image/png"}),"replacement.png");
  const response=await fetch(base+"/api/admin/manual-wise/config/qr",{method:"POST",headers:{Authorization:"Bearer admin"},body:form});
  assert.equal(response.status,201);
  const {id}=await response.json() as any;
  const preview=await fetch(base+"/api/manual-wise/files/"+id,{headers:{Authorization:"Bearer admin"}});
  assert.ok(Buffer.from(await preview.arrayBuffer()).equals(original));
  const invalid=new FormData();invalid.append("receipt",new Blob(["<svg onload='alert(1)'/>"],{type:"image/png"}),"fake.png");
  assert.equal((await fetch(base+"/api/admin/manual-wise/config/qr",{method:"POST",headers:{Authorization:"Bearer admin"},body:invalid})).status,422);
  assert.equal((await pool.query("SELECT id FROM manual_wise_config WHERE active AND currency='USD'")).rows[0].id,old);
});

test("activation preserves bound proofs and unviewed issued invoices; new currencies use reviewed new QR",async()=>{
  const old=(await pool.query("SELECT * FROM manual_wise_config WHERE active AND currency='USD'")).rows[0];
  const pending=randomUUID(),unviewed=randomUUID();
  for(const id of [pending,unviewed])await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','sent')",[id]);
  const evidence=await service.submit("client","invoice",pending,"CONFIG-OLD-DESTINATION",await receipt());
  const draft=await service.configure("admin",{...config,active:false,supportedCurrencies:["USD","CAD"],
    qrFileId:fixtureQr,recipient:"Reviewed replacement recipient",instructions:"Reviewed replacement instructions",
    referenceInstructions:"New reference instructions"});
  const result=await service.configurations.activate("admin",draft.id,confirmations);
  assert.equal(result.items.length,2);
  const current=result.items.find((r:any)=>r.currency==="USD");
  assert.equal(current.previous_version_id,old.id);
  assert.equal(current.source_config_id,draft.id);
  assert.equal(current.activated_by,"admin");assert.ok(current.activated_at);
  for(const id of [pending,unviewed]) {
    const historical=await service.detail("client","invoice",id);
    assert.equal(historical.instructions?.id,old.id);
    assert.equal(historical.instructions?.qrFileId,old.qr_file_id);
    assert.equal(historical.instructions?.recipient,old.recipient);
    assert.equal(historical.instructions?.referenceInstructions,old.reference_instructions);
  }
  const proof=(await pool.query("SELECT * FROM manual_wise_submissions WHERE id=$1",[evidence.id])).rows[0];
  assert.equal(proof.recipient,old.recipient);assert.equal(proof.status,"verification_pending");
  await service.review("admin",evidence.id,review("CONFIG-OLD-DESTINATION",{verifiedRecipient:old.recipient}));
  assert.equal((await pool.query("SELECT status FROM invoices WHERE id=$1",[pending])).rows[0].status,"paid");
  for(const currency of ["USD","CAD","EUR"]) {
    const id=randomUUID();
    await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,$2,'sent')",[id,currency]);
    const view=await service.detail("client","invoice",id);
    assert.equal(view.instructions?.recipient??null,currency==="EUR"?null:draft.recipient);
    assert.equal(view.instructions?.qrFileId??null,currency==="EUR"?null:fixtureQr);
    assert.equal(view.payable,currency!=="EUR");
  }
  const listed=(await service.config("admin")).items.find((r:any)=>r.id===current.id);
  assert.equal(listed.uploaded_by,"admin");assert.ok(listed.uploaded_at);
});

test("concurrent overlapping activations reject stale review and leave one active version per currency",async()=>{
  const a=await service.configure("admin",{...config,active:false,qrFileId:fixtureQr,supportedCurrencies:["USD","PHP"]});
  const b=await service.configure("admin",{...config,active:false,qrFileId:fixtureQr,supportedCurrencies:["USD","PHP"]});
  const result=await Promise.allSettled([
    service.configurations.activate("admin",a.id,confirmations),
    service.configurations.activate("admin2",b.id,confirmations),
  ]);
  assert.equal(result.filter(r=>r.status==="fulfilled").length,1);
  const loser=result.find(r=>r.status==="rejected") as PromiseRejectedResult;
  assert.ok(deny(409)(loser.reason));
  for(const c of ["USD","PHP"])assert.equal((await pool.query("SELECT count(*)::int AS n FROM manual_wise_config WHERE active AND currency=$1",[c])).rows[0].n,1);
  const winner=result[0].status==="fulfilled"?a:b;
  await assert.rejects(service.configurations.activate("admin",winner.id,confirmations),deny(409));
});

test("emergency revocation blocks collection, retains snapshots and receipts, and restore requires new review",async()=>{
  const active=(await pool.query("SELECT * FROM manual_wise_config WHERE active AND currency='USD'")).rows[0];
  const invoice=randomUUID();
  await pool.query("INSERT INTO invoices(id,client_id,amount,currency,status) VALUES($1,'client',100,'USD','sent')",[invoice]);
  const before=await service.detail("client","invoice",invoice);
  assert.equal(before.payable,true);
  await service.configurations.deactivate("admin",active.id,{reason:"Fixture destination temporarily invalid"});
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM manual_wise_config WHERE active AND currency IN ('USD','PHP')")).rows[0].n,0);
  const blocked=await service.detail("client","invoice",invoice);
  assert.equal(blocked.payable,false);assert.equal(blocked.instructions?.qrFileId,null);
  assert.match(blocked.blockedReason!,/revoked/);
  assert.equal(blocked.instructions?.id,active.id);
  const restored=await service.configurations.restore("admin",active.id,{reason:"Fixture destination independently reconfirmed"});
  assert.notEqual(restored.id,active.id);assert.equal(restored.source_config_id,active.id);
  assert.equal(restored.config_status,"draft");assert.equal(restored.active,false);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM manual_wise_config WHERE active AND currency='USD'")).rows[0].n,0);
  const reactivated=(await service.configurations.activate("admin",restored.id,confirmations)).items.find((r:any)=>r.currency==="USD");
  assert.notEqual(reactivated.id,active.id);assert.ok(reactivated.activated_at);
  // A restored approval never silently rehabilitates a previously revoked invoice snapshot.
  assert.equal((await service.detail("client","invoice",invoice)).payable,false);
  const historical=(await pool.query("SELECT * FROM manual_wise_config WHERE id=$1",[active.id])).rows[0];
  assert.equal(historical.recipient,active.recipient);assert.ok(historical.revoked_at);
  assert.equal(historical.deactivation_reason,"Fixture destination temporarily invalid");
  const restarted=new ManualWiseService(pool);
  assert.ok((await restarted.config("admin")).items.some((r:any)=>r.id===reactivated.id && r.active));
  assert.ok((await pool.query("SELECT id FROM manual_wise_audit WHERE event='wise_configuration_revoked'")).rowCount);
  assert.ok((await pool.query("SELECT id FROM manual_wise_audit WHERE event='wise_configuration_restore_drafted'")).rowCount);
});

test("all lifecycle endpoints reject unauthenticated and non-Super-Admin callers",async()=>{
  const id=randomUUID();
  for(const endpoint of ["",`/${id}/activate`,`/${id}/deactivate`,`/${id}/restore`]) {
    const body=endpoint.endsWith("activate") && !endpoint.endsWith("deactivate")?confirmations:
      endpoint?{reason:"Fixture test"}:{...config,active:false,qrFileId:fixtureQr};
    for(const actor of ["","client","limited","talent"]) {
      const response=await fetch(base+"/api/admin/manual-wise/config"+endpoint,{method:"POST",
        headers:{"Content-Type":"application/json",...(actor?{Authorization:`Bearer ${actor}`}:{})},body:JSON.stringify(body)});
      assert.equal(response.status,actor?403:401,`${actor||"anonymous"} ${endpoint}`);
    }
  }
});

test("HTTP draft and activation survive application-server restart with a fresh database pool",async()=>{
  const headers={Authorization:"Bearer admin","Content-Type":"application/json"};
  const balances=(await pool.query("SELECT id,amount,currency,status FROM invoices ORDER BY id")).rows;
  const saved=await fetch(base+"/api/admin/manual-wise/config",{method:"POST",headers,
    body:JSON.stringify({...config,active:false,qrFileId:fixtureQr})});
  assert.equal(saved.status,200);
  const draft=await saved.json() as any;
  const activeIds=(await pool.query("SELECT id FROM manual_wise_config WHERE active ORDER BY id")).rows;
  await new Promise<void>(resolve=>http.close(()=>resolve()));
  await pool.end();
  pool=new pg.Pool({host:root,port:55443,user:"wise_fixture",database:"postgres"});
  service=new ManualWiseService(pool);
  await startHttp();
  const list=await fetch(base+"/api/admin/manual-wise/config",{headers});
  assert.equal(list.status,200);
  const restored=(await list.json() as any).items.find((row:any)=>row.id===draft.id);
  assert.equal(restored.config_status,"draft");assert.equal(restored.qr_file_id,fixtureQr);
  assert.deepEqual((await pool.query("SELECT id FROM manual_wise_config WHERE active ORDER BY id")).rows,activeIds);
  const image=await fetch(base+"/api/manual-wise/files/"+fixtureQr,{headers});
  assert.equal(image.status,200);
  assert.equal(createHash("sha256").update(Buffer.from(await image.arrayBuffer())).digest("hex"),officialWiseQr.sha256);
  const activated=await fetch(base+`/api/admin/manual-wise/config/${draft.id}/activate`,
    {method:"POST",headers,body:JSON.stringify(confirmations)});
  assert.equal(activated.status,200);
  assert.equal((await activated.json() as any).items[0].source_config_id,draft.id);
  assert.deepEqual((await pool.query("SELECT id,amount,currency,status FROM invoices ORDER BY id")).rows,balances);
});
