import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import express, { type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import ts from "typescript";
import { PDFDocument } from "pdf-lib";
import { pool, query } from "./fixtures/hiring-db";
import { HiringPaymentService, requireVerifiedHiringPayment } from "../services/hiringPaymentService";
import { registerHiringPaymentRoutes, hiringPaymentFailure } from "../routes/hiringPayments";
import * as guard from "../services/formalPipelineGuard";
import * as currency from "../../shared/currency";
import * as documents from "../services/contractDocumentService";
import type { ContractBlobProvider } from "../services/contractBlobStore";
import { extendOfferExpiration } from "../services/offerExpirationService";
import { queueHiringLifecycleEvent } from "../services/hiringLifecycleEvents";
import {requireHiringStage,issueAcceptedOfferDeposit,lockOnboarding} from "../services/contractorOnboardingPolicy";
import { dispatchHiringLifecycleEvents } from "../services/hiringLifecycleDispatch";
import { DEFAULT_TEMPLATES } from "../seeds/seedEmailTemplates";

const service = new HiringPaymentService(pool);
const client = "payment-client", other = "payment-other", admin = "payment-admin", subadmin = "payment-subadmin", talent = "payment-talent";
const job = "payment-job";
const source = ts.createSourceFile("routes.ts",readFileSync("server/routes.ts","utf8"),ts.ScriptTarget.Latest,true);
let base: string;
const app = express(); app.use(express.json());
const server = createServer(app);
const secret = "hiring-payment-fixture-only";
const auth: RequestHandler = (req,res,next) => {
  try { (req as any).user = jwt.verify(req.headers.authorization?.replace(/^Bearer /,"") ?? "",secret); next(); }
  catch { res.status(401).json({ error:"unauthorized" }); }
};
registerHiringPaymentRoutes(app,{service,authenticate:auth,limiter:(_r,_s,n)=>n()});
const storage = { async createNotification(n: any) {
  await query("INSERT INTO notifications(user_id,type,title,message,related_id,related_type) VALUES($1,$2,$3,$4,$5,$6)",
    [n.userId,n.type,n.title,n.message,n.relatedId,n.relatedType]);
}};
function declaration(name: string) {
  let text = "";
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text===name) text=node.getText(source);
    ts.forEachChild(node,visit);
  }; visit(source); return text;
}
function handler(method: string,path: string) {
  let text = "";
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source)===`app.${method}` &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text===path) text=node.arguments.at(-1)!.getText(source);
    ts.forEachChild(node,visit);
  }; visit(source);
  assert.ok(text,`Missing production handler ${path}`);
  const dependencies = {query,pool,storage,...guard,...currency,requireVerifiedHiringPayment,hiringPaymentFailure,
    queueHiringLifecycleEvent,requireHiringStage,issueAcceptedOfferDeposit,lockOnboarding,dispatchHiringLifecycleEvents:async()=>{},
    buildTalentApplicationsUrl:()=>"/my-applications",buildClientApplicationUrl:()=>"/client-dashboard",
    require:(name: string) => {
      if (name.includes("microsoftGraphEmailService")) return {isEmailServiceConfigured:()=>false};
      if (name.includes("emailVariableResolver")) return {};
      throw new Error(`Unexpected external dependency ${name}`);
    },
  };
  const compiled = ts.transpileModule(`${declaration("respondUsdOnly")}; ${declaration("loadTalentOwnedOffer")}; return (${text});`,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  return new Function(...Object.keys(dependencies),compiled)(...Object.values(dependencies));
}
const token = (id: string) => jwt.sign({id},secret);
async function api(method: string,path: string,body?: unknown,id=client) {
  const response = await fetch(`${base}${path}`,{method,signal:AbortSignal.timeout(20000),headers:{"Authorization":`Bearer ${token(id)}`,"Content-Type":"application/json"},...(body===undefined ? {} : {body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json()};
}
async function submission(workflow="application",status="reviewed",owner=client,who=talent) {
  return (await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,workflow_type,initiated_by,registration_status,status)
    VALUES($1,$2,$3,$4,'Fixture Talent',$5,$6,'linked',$7) RETURNING id`,
    [job,owner,who,`${who}@fixture.test`,workflow,workflow==="application"?"talent":"client",status])).rows[0].id as string;
}
const policy = {
  amount:"135.25",currency:"USD",feeBasis:"fixed_per_hiring_attempt",feeDescription:"Fixture hiring setup fee",
  taxTreatment:"inclusive",taxDescription:"Fixture inclusive treatment",dueDays:7,paymentMethod:"manual_transfer",
  paymentRecipient:"OnSpot Fixture Recipient",paymentInstructions:"Fixture instructions only; do not transfer money.",
};
const verification = (extra={}) => ({
  action:"verify",reason:"Independently matched cleared fixture bank settlement",verifiedAmount:policy.amount,
  verifiedCurrency:"USD",verifiedReference:randomUUID(),verifiedRecipient:policy.paymentRecipient,independentlyVerified:true,...extra,
});
async function paid(id: string) {
  const invoice = await service.ready(client,id);
  await service.reference(client,invoice.id,"Fixture claim");
  await service.review(admin,invoice.id,verification());
  return invoice;
}
async function offer(id: string,actor=client,body={}) {
  return api("POST","/api/client/offers",{submissionId:id,rate:2500,rateCurrency:"USD",proposedStartDate:"2032-10-01",...body},actor);
}
let historicalSubmission: string, historicalOffer: string;
before(async()=>{
  await query("CREATE TABLE IF NOT EXISTS platform_settings(key text PRIMARY KEY,value text)");
  for (const [id,role,sub] of [[client,"client",null],[other,"client",null],[admin,"admin",null],[subadmin,"admin","talent_acquisition"],[talent,"talent",null]]) {
    await query("INSERT INTO users(id,email,role,admin_sub_role) VALUES($1,$2,$3,$4)",[id,`${id}@fixture.test`,role,sub]);
  }
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode,created_via)
    VALUES($1,$2,'Payment Fixture','Disposable','Operations','Intermediate','open','approved','Standard','tracked','client')`,[job,client]);
  historicalSubmission=await submission("application","offer_accepted");
  historicalOffer=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode)
    VALUES($1,'accepted',2500,'USD','Standard','tracked') RETURNING id`,[historicalSubmission])).rows[0].id;
  await query(readFileSync("migrations/0038_hiring_pre_offer_payment.sql","utf8"));
  // Verify idempotence with tables already generated by the ORM and SQL guards present.
  await query(readFileSync("migrations/0038_hiring_pre_offer_payment.sql","utf8"));
  await query(readFileSync("migrations/0043_deposit_funded_activation.sql","utf8"));
  await query(readFileSync("migrations/0043_deposit_funded_activation.sql","utf8"));
  // Existing guard regressions explicitly exercise the restored legacy mode.
  await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  const guarded = (method: string,path: string): RequestHandler => (r,s,n) => {
    Promise.resolve(handler(method,path)(r,s)).catch(n);
  };
  app.post("/api/client/offers",auth,guarded("post","/api/client/offers"));
  app.patch("/api/client/offers/:id/respond",auth,guarded("patch","/api/client/offers/:id/respond"));
  const talentAuth: RequestHandler = (r,_s,n)=>{ (r as any).talentAuth={candidateId:"payment-candidate"}; n(); };
  app.patch("/api/talent/offers/:id/respond",auth,talentAuth,guarded("patch","/api/talent/offers/:id/respond"));
  app.use((e: Error,_r: any,s: any,_n: any)=>{ console.error("Fixture handler dependency failed",e); s.status(500).json({error:e.message}); });
  await query("INSERT INTO candidates(id,user_id,email,full_name) VALUES('payment-candidate',$1,$2,'Fixture Talent')",[talent,`${talent}@fixture.test`]);
  await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  base=`http://127.0.0.1:${(server.address() as any).port}`;
});

test("disabling pre-offer payment allows unpaid offers and re-enabling restores the guard",async()=>{
  await query("UPDATE platform_settings SET value='false' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  try {
    const id=await submission();
    const sent=await offer(id);
    assert.equal(sent.status,201);
    assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE submission_id=$1",[id])).rows[0].n,0);
    const talentCounter=await api("PATCH",`/api/talent/offers/${sent.body.id}/respond`,
      {action:"counter",counterRate:2700,counterRateCurrency:"USD"},talent);
    assert.ok([200,201].includes(talentCounter.status),JSON.stringify(talentCounter));
    const clientCounter=await api("PATCH",`/api/client/offers/${talentCounter.body.id}/respond`,
      {action:"counter",counterRate:2600,counterRateCurrency:"USD"});
    assert.ok([200,201].includes(clientCounter.status),JSON.stringify(clientCounter));
    await query("UPDATE offers SET status='expired',expires_at='2020-01-01' WHERE id=$1",[clientCounter.body.id]);
    await extendOfferExpiration(clientCounter.body.id,admin,"2033-01-01T00:00:00Z");
    const direct=await submission();
    await query("INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type) VALUES($1,'sent',100,'USD','Standard')",[direct]);
  } finally {
    await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  }
  const blocked=await submission();
  assert.equal((await offer(blocked)).status,409);
  await assert.rejects(query("INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type) VALUES($1,'sent',100,'USD','Standard')",[blocked]),/PRE_OFFER_PAYMENT_REQUIRED/);
});

test("transactional companion templates send after commit, render start dates, and deduplicate retries",async()=>{
  // This fixture process owns its PostgreSQL database and denies real transport.
  const previousFetch=globalThis.fetch;
  const sent:Array<{subject:string;body:string}>=[];
  Object.assign(process.env,{PUBLIC_APP_URL:"https://fixture.example.test",
    MICROSOFT_TENANT_ID:"fixture",MICROSOFT_CLIENT_ID:"fixture",MICROSOFT_CLIENT_SECRET:"fixture",
    MICROSOFT_SENDER_EMAIL:"fixture@example.invalid"});
  globalThis.fetch=async (input,options)=>{
    const url=String(input);
    if(url.startsWith("https://login.microsoftonline.com/fixture/")) return Response.json({access_token:"fixture",expires_in:3600});
    if(url.startsWith("https://graph.microsoft.com/") && url.endsWith("/sendMail")) {
      const message=JSON.parse(String(options?.body)).message;
      sent.push({subject:message.subject,body:message.body.content});
      return new Response(null,{status:202});
    }
    throw new Error("Real network forbidden in companion fixture");
  };
  try {
    await query(`CREATE TABLE IF NOT EXISTS email_notification_deliveries(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text UNIQUE,event_type text,
      recipient_email text,recipient_user_id varchar,sender_email text,template_category text,
      template_id uuid,related_type text,related_id text,status text,attempted_at timestamptz,
      subject text,body_html text,sent_at timestamptz,error text)`);
    for(const t of DEFAULT_TEMPLATES.filter(t=>t.category.startsWith("hiring_"))) {
      await query(`INSERT INTO applicant_email_templates(name,category,subject,body_html,is_default,is_published,is_archived)
        VALUES($1,$2,$3,$4,true,true,false)`,[t.name,t.category,t.subject,t.bodyHtml]);
    }
    // Remove unrelated deliberately queued events from preceding guard tests.
    await query("UPDATE hiring_lifecycle_events SET status='sent'");
    const id=await submission("application","contract_signed");
    await query("UPDATE platform_settings SET value='false' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
    const accepted=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date)
      VALUES($1,'accepted',2500,'USD','Standard','tracked','2032-10-01') RETURNING id`,[id])).rows[0];
    await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
    const contract=(await query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,signing_entity)
      VALUES($1,$2,'signed','Fixture entity') RETURNING id`,[accepted.id,id])).rows[0];
    const deposit=(await query(`INSERT INTO security_deposits(hiring_contract_id,amount,currency,status,invoice_number)
      VALUES($1,100,'USD','pending',$2) RETURNING id`,[contract.id,`FIXTURE-${contract.id}`])).rows[0];
    // These outbox fixtures test rendering/transport only, not settlement.
    const eventKey=`fixture-receipt:${id}`;
    await queueHiringLifecycleEvent(pool,eventKey,"proof_submitted",{payerId:client,category:"invoice",obligationId:randomUUID(),
      amount:"100.00",currency:"USD",reference:"FIXTURE-CLAIM"});
    await queueHiringLifecycleEvent(pool,`fixture-active:${id}`,"engagement_active",{submissionId:id,contractId:contract.id});
    await queueHiringLifecycleEvent(pool,`fixture-invoice:${id}`,"deposit_issued",{submissionId:id,contractId:contract.id,depositId:deposit.id});
    await queueHiringLifecycleEvent(pool,`fixture-accepted:${id}`,"offer_accepted",{submissionId:id});
    await queueHiringLifecycleEvent(pool,`fixture-rejected:${id}`,"proof_rejected",
      {payerId:client,category:"deposit",obligationId:deposit.id,reason:"Please correct <reference>."});
    await dispatchHiringLifecycleEvents();
    assert.ok(sent.some(m=>m.subject==="Payment submitted for verification"));
    assert.ok(sent.some(m=>m.body.includes("up to 24 hours")));
    assert.equal(sent.filter(m=>m.body.includes("2032-10-01")).length,2);
    assert.ok(sent.some(m=>m.subject==="Your deposit invoice for Payment Fixture" && m.body.includes(`/client/payments/deposit/${deposit.id}`)));
    assert.ok(sent.some(m=>m.subject.includes("Next: sign the contract.")));
    assert.ok(sent.some(m=>m.body.includes("Please correct &lt;reference&gt;.")));
    const count=sent.length;
    await dispatchHiringLifecycleEvents();
    await query("UPDATE hiring_lifecycle_events SET status='failed' WHERE event_key=$1",[eventKey]);
    await dispatchHiringLifecycleEvents();
    assert.equal(sent.length,count);
    const adminCount=(await query("SELECT count(*)::int n FROM users WHERE role='admin' AND admin_sub_role IS NULL")).rows[0].n;
    assert.equal((await query("SELECT count(*)::int n FROM notifications WHERE event_key LIKE $1",[`${eventKey}:%`])).rows[0].n,1+adminCount);
    assert.ok(accepted.id);
  } finally {
    globalThis.fetch=previousFetch;
    for(const key of ["MICROSOFT_TENANT_ID","MICROSOFT_CLIENT_ID","MICROSOFT_CLIENT_SECRET","MICROSOFT_SENDER_EMAIL"]) delete process.env[key];
    await query("UPDATE platform_settings SET value='true' WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'");
  }
});
after(async()=>{ await new Promise<void>(r=>server.close(()=>r())); await pool.end(); });

test("Policy is explicit, Super Admin authorized, immutable and missing configuration blocks issuance",async()=>{
  const id=await submission();
  const noPolicy=await api("POST","/api/client/hiring-invoices/ready",{submissionId:id});
  assert.equal(noPolicy.status,409); assert.equal(noPolicy.body.code,"HIRING_BILLING_POLICY_REQUIRED");
  for (const actor of [client,talent,subadmin]) {
    assert.equal((await api("POST","/api/admin/hiring-invoices/policy",policy,actor)).status,403);
  }
  assert.equal((await api("POST","/api/admin/hiring-invoices/policy",{...policy,amount:"0"},admin)).status,422);
  assert.equal((await api("POST","/api/admin/hiring-invoices/policy",policy,admin)).status,200);
  await assert.rejects(query("UPDATE hiring_fee_policies SET amount=1"),/immutable/);
});
for (const workflow of ["application","client_invitation"]) {
  test(`${workflow}: unpaid and reference-only return409; independent verification unlocks actual offer handler`,async()=>{
    const id=await submission(workflow);
    const invoices=await Promise.all(Array.from({length:8},()=>service.ready(client,id)));
    assert.equal(new Set(invoices.map(i=>i.id)).size,1);
    const invoice=invoices[0];
    assert.equal((await offer(id)).body.code,"PRE_OFFER_PAYMENT_REQUIRED");
    assert.equal((await api("POST",`/api/client/hiring-invoices/${invoice.id}/reference`,{reference:"Fixture screenshot/transaction claim"})).status,200);
    assert.equal((await offer(id)).status,409);
    assert.equal((await api("POST",`/api/admin/hiring-invoices/${invoice.id}/review`,verification(),client)).status,403);
    assert.equal((await api("POST",`/api/admin/hiring-invoices/${invoice.id}/review`,verification({verifiedAmount:"1.00"}),admin)).status,409);
    const evidence=verification();
    assert.equal((await api("POST",`/api/admin/hiring-invoices/${invoice.id}/review`,evidence,admin)).status,200);
    assert.equal((await api("POST",`/api/admin/hiring-invoices/${invoice.id}/review`,evidence,admin)).status,200);
    const offered=await offer(id); assert.equal(offered.status,201,JSON.stringify(offered));
    assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"offer_extended");
    assert.equal((await query("SELECT count(*)::int AS n FROM hiring_payment_events WHERE invoice_id=$1 AND event='payment_verify'",[invoice.id])).rows[0].n,1);
    const detail=await api("GET",`/api/client/hiring-invoices/${invoice.id}`);
    assert.equal(detail.body.invoice.verified_by,undefined);
    assert.equal(detail.body.invoice.talent_name,undefined,"Financial endpoints must not bypass pre-hire Talent name-reveal rules");
    assert.equal(detail.body.history.at(-1).details,undefined);
  });
}
test("Ownership and role checks protect readiness, invoice details, evidence, policy and review",async()=>{
  const id=await submission(), invoice=await service.ready(client,id);
  assert.equal((await api("POST","/api/client/hiring-invoices/ready",{submissionId:id},other)).status,404);
  for (const actor of [other,talent]) {
    assert.ok([403,404].includes((await api("GET",`/api/client/hiring-invoices/${invoice.id}`,undefined,actor)).status));
    assert.ok([403,404].includes((await api("POST",`/api/client/hiring-invoices/${invoice.id}/reference`,{reference:"claim"},actor)).status));
  }
  for (const actor of [client,talent,subadmin]) {
    assert.equal((await api("GET","/api/admin/hiring-invoices",undefined,actor)).status,403);
    assert.equal((await api("POST",`/api/admin/hiring-invoices/${invoice.id}/review`,verification(),actor)).status,403);
  }
  assert.equal((await offer(id,other)).status,404);
  const bad={...verification(),independentlyVerified:false};
  assert.equal((await api("POST",`/api/admin/hiring-invoices/${invoice.id}/review`,bad,admin)).status,422);
});
test("Silent shortlists, unlinked records, foreign job owners, pending invites and rejected applications cannot issue",async()=>{
  for (const [workflow,status] of [["client_shortlist","shortlisted"],["application","rejected"],["client_invitation","invited"]]) {
    assert.equal((await api("POST","/api/client/hiring-invoices/ready",{submissionId:await submission(workflow,status)})).status,409);
  }
  const id=await submission();
  await query("UPDATE job_submissions SET registration_status='unregistered' WHERE id=$1",[id]);
  assert.equal((await api("POST","/api/client/hiring-invoices/ready",{submissionId:id})).status,409);
  const foreign=await submission("application","reviewed",other);
  assert.equal((await api("POST","/api/client/hiring-invoices/ready",{submissionId:foreign},other)).status,409);
});
test("Paid invoice cannot authorize a different submission, Talent or job; direct elevated INSERT is guarded",async()=>{
  const id=await submission(); await paid(id);
  assert.equal((await offer(await submission())).body.code,"PRE_OFFER_PAYMENT_REQUIRED");
  await query("INSERT INTO users(id,email,role) VALUES('payment-second-talent','second@fixture.test','talent')");
  await query("UPDATE job_submissions SET talent_id='payment-second-talent' WHERE id=$1",[id]);
  assert.equal((await offer(id)).body.code,"PRE_OFFER_PAYMENT_REQUIRED");
  await query("UPDATE job_submissions SET talent_id=$2 WHERE id=$1",[id,talent]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES('payment-second-job',$1,'Other','Fixture','Operations','Intermediate','open','approved','Standard','tracked')`,[client]);
  await query("UPDATE job_submissions SET job_id='payment-second-job' WHERE id=$1",[id]);
  assert.equal((await offer(id)).body.code,"PRE_OFFER_PAYMENT_REQUIRED");
  await assert.rejects(query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode)
    VALUES($1,'sent',2000,'USD','Standard','tracked')`,[id]),/PRE_OFFER_PAYMENT_REQUIRED/);
});
test("Reject, void and refund preserve immutable history, block offers and never rewrite accepted history",async()=>{
  const id=await submission(), invoice=await service.ready(client,id);
  await service.reference(client,invoice.id,"claim one");
  await service.review(admin,invoice.id,{action:"reject",reason:"No received settlement"});
  assert.equal((await offer(id)).status,409);
  await service.review(admin,invoice.id,{action:"void",reason:"Client requested cancellation"});
  assert.equal((await offer(id)).status,409);
  const replacement=await service.ready(client,id); assert.notEqual(replacement.id,invoice.id);
  await service.review(admin,replacement.id,verification());
  const sent=await offer(id); assert.equal(sent.status,201);
  await query("UPDATE offers SET status='accepted' WHERE id=$1",[sent.body.id]);
  await service.review(admin,replacement.id,{action:"refund",reason:"Settled refund fixture"});
  assert.equal((await query("SELECT status FROM offers WHERE id=$1",[sent.body.id])).rows[0].status,"accepted");
  assert.ok((await service.exceptions(admin)).some(e=>e.invoice_id===replacement.id));
  await assert.rejects(query("UPDATE hiring_payment_events SET event='fake' WHERE invoice_id=$1",[replacement.id]),/immutable/);
  await assert.rejects(query("UPDATE hiring_pre_offer_invoices SET amount=1 WHERE id=$1",[replacement.id]),/immutable/);
});
test("Concurrent verified creates produce one offer, one invoice; settlement reference cannot be reused",async()=>{
  const id=await submission(), invoice=await paid(id);
  const results=await Promise.all([offer(id),offer(id),offer(id)]);
  assert.equal(results.filter(r=>r.status===201).length,1);
  assert.equal((await query("SELECT count(*)::int n FROM offers WHERE submission_id=$1",[id])).rows[0].n,1);
  const otherInvoice=await service.ready(client,await submission());
  const ref=(await service.detail(admin,invoice.id,true)).invoice.verified_reference;
  await assert.rejects(service.review(admin,otherInvoice.id,verification({verifiedReference:ref})),(e:any)=>e.code==="23505");
});
test("Invalidation closes authorization; missing verification evidence cannot be manufactured as paid",async()=>{
  const id=await submission(), invoice=await paid(id);
  await service.review(admin,invoice.id,{action:"invalidate",reason:"Reconciliation exception"});
  assert.equal((await offer(id)).body.code,"PRE_OFFER_PAYMENT_REQUIRED");
  const unpaid=await service.ready(client,await submission());
  await assert.rejects(query("UPDATE hiring_pre_offer_invoices SET status='paid' WHERE id=$1",[unpaid.id]),/check constraint/);
});
test("Historical offers remain untouched, are flagged for review, and accepting an old offer is not fabricated payment",async()=>{
  const exceptions=await service.exceptions(admin);
  assert.equal(exceptions.filter(e=>e.offer_id===historicalOffer).length,1);
  assert.equal((await query("SELECT status FROM offers WHERE id=$1",[historicalOffer])).rows[0].status,"accepted");
  assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE submission_id=$1",[historicalSubmission])).rows[0].n,0);
});
test("Decline/reoffer reuse the paid attempt; Talent and Client counters retain their existing chain and payment gate",async()=>{
  const id=await submission(); const invoice=await paid(id);
  const sent=await offer(id); assert.equal(sent.status,201);
  const declined=await api("PATCH",`/api/talent/offers/${sent.body.id}/respond`,{action:"decline"},talent);
  assert.equal(declined.status,200);
  assert.equal((await service.ready(client,id)).id,invoice.id);
  const reoffer=await offer(id); assert.equal(reoffer.status,201);
  const counter=await api("PATCH",`/api/talent/offers/${reoffer.body.id}/respond`,{action:"counter",counterRate:2700,counterRateCurrency:"USD"},talent);
  assert.equal(counter.status,200,JSON.stringify(counter));
  assert.equal(counter.body.proposer_role,"talent");
  const revised=await api("PATCH",`/api/client/offers/${counter.body.id}/respond`,{action:"counter",counterRate:2600,counterRateCurrency:"USD"});
  assert.equal(revised.status,200,JSON.stringify(revised));
  assert.equal(revised.body.proposer_role,"client");
  await service.review(admin,invoice.id,{action:"invalidate",reason:"Settlement reversed fixture"});
  const blocked=await api("PATCH",`/api/talent/offers/${revised.body.id}/respond`,{action:"counter",counterRate:2750,counterRateCurrency:"USD"},talent);
  assert.equal(blocked.status,409);
  assert.equal(blocked.body.code,"PRE_OFFER_PAYMENT_REQUIRED");
  assert.equal((await query("SELECT status FROM offers WHERE id=$1",[revised.body.id])).rows[0].status,"sent");
});
test("Expiry and Admin-assisted renewal keep original terms but cannot bypass a reversed payment",async()=>{
  const id=await submission(); const invoice=await paid(id);
  const sent=await offer(id,client,{expiresAt:"2020-01-01T00:00:00Z"}); assert.equal(sent.status,201);
  assert.equal((await api("PATCH",`/api/talent/offers/${sent.body.id}/respond`,{action:"accept"},talent)).status,409);
  await extendOfferExpiration(sent.body.id,admin,"2032-12-01T00:00:00Z");
  assert.equal((await query("SELECT rate FROM offers WHERE id=$1",[sent.body.id])).rows[0].rate,"2500.00");
  await service.review(admin,invoice.id,{action:"refund",reason:"Fixture reversed settlement"});
  await assert.rejects(extendOfferExpiration(sent.body.id,admin,"2033-01-01T00:00:00Z"),(e:any)=>e.code==="PRE_OFFER_PAYMENT_REQUIRED");
  await assert.rejects(query("UPDATE offers SET expires_at='2033-01-01' WHERE id=$1",[sent.body.id]),/PRE_OFFER_PAYMENT_REQUIRED/);
});
test("Concurrent refund/offer requests serialize without consuming an invalid invoice or changing prior offers",async()=>{
  const id=await submission(), invoice=await paid(id);
  const [created] = await Promise.all([offer(id),service.review(admin,invoice.id,{action:"refund",reason:"Concurrent fixture refund"})]);
  assert.ok([201,409].includes(created.status));
  assert.equal((await service.detail(admin,invoice.id,true)).invoice.status,"refunded");
  assert.equal((await offer(id)).status,409);
  assert.equal((await query("SELECT count(*)::int n FROM offers WHERE submission_id=$1",[id])).rows[0].n,created.status===201?1:0);
});

const blobs=new Map<string,Buffer>();
const blobProvider: ContractBlobProvider = {
  async save(bytes) { const id=randomUUID(); blobs.set(id,Buffer.from(bytes)); return id; },
  async read(id) { const bytes=blobs.get(id); if(!bytes) throw new Error("Missing fixture PDF"); return bytes; },
  async remove(id) { blobs.delete(id); },
};
test("Paid offer follows real acceptance and private PDF signing; partial signatures never hire and execution creates one deposit",async()=>{
  const id=await submission(); await paid(id);
  const sent=await offer(id); assert.equal(sent.status,201);
  const accepted=await api("PATCH",`/api/talent/offers/${sent.body.id}/respond`,{action:"accept"},talent);
  assert.equal(accepted.status,200,JSON.stringify(accepted));
  const doc=await PDFDocument.create(); doc.addPage();
  const bytes=Buffer.from(await doc.save());
  const contract=await documents.prepareContract({id:client},{offerId:sent.body.id,partyType:"client"});
  await documents.uploadContractPdf(contract.id,{id:client},{buffer:bytes,mimetype:"application/pdf",originalname:"fixture.pdf"},blobProvider);
  await documents.contractPdf(contract.id,{id:client},false,blobProvider);
  await documents.sendContract(contract.id,{id:client},blobProvider);
  const sign=async(who:string)=>{
    const detail=await documents.contractDetail(contract.id,{id:who});
    await documents.contractPdf(contract.id,{id:who},false,blobProvider);
    return documents.signContractPdf(contract.id,{id:who},{documentId:detail.document!.id,sha256:detail.document!.sha256,legalName:"Fixture Signer",consent:true},{},blobProvider);
  };
  await sign(talent); await sign(client);
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"contract_sent");
  await sign(admin);
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"contract_signed");
  assert.equal((await query("SELECT billing_activated_at FROM hiring_contracts WHERE id=$1",[contract.id])).rows[0].billing_activated_at,null);
  assert.equal((await query("SELECT count(*)::int n FROM hiring_lifecycle_events WHERE event_key=$1",[`deposit-issued:${contract.id}`])).rows[0].n,1);
  await sign(admin).catch(()=>{}); // Idempotent replay or explicit already-signed conflict.
  assert.equal((await query("SELECT count(*)::int n FROM security_deposits WHERE hiring_contract_id=$1",[contract.id])).rows[0].n,1);
});
