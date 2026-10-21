/**
 * Real production routes, normal password-authenticated accounts, compiled UI,
 * and an owned disposable PostgreSQL database. No production records or money.
 * Run after npm run build:
 * node scripts/test-hiring-payments-isolated.mjs --job-billing-only
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { browser, base, logins, ids, api } from "./client-application-status.fixture";
import { query } from "../db";

let jobId: string, submissionId: string, invoiceId: string;
const body = (engagementType: string | null, billingMode: string | null) => ({
  title: "TEST Billing Classification Role", description: "Disposable classification UAT",
  category: "Other", jobFunction: "Other", otherFunction: "Fixture Support", experienceLevel: "intermediate",
  engagementType, billingMode, budgetCurrency: "USD",
});
const policy = {
  amount:"135.25",currency:"USD",feeBasis:"fixed_per_hiring_attempt",feeDescription:"Fixture hiring fee",
  taxTreatment:"inclusive",taxDescription:"Synthetic test only",dueDays:7,paymentMethod:"manual_transfer",
  paymentRecipient:"OnSpot Fixture Recipient",paymentInstructions:"Test instructions only. Do not send money.",
};

test("Actual Client creation persists Lite/tracked and Standard/guaranteed; missing or invalid selections fail",async()=>{
  for (const [engagement,billing] of [["Lite","tracked"],["Standard","guaranteed"]]) {
    const created = await api("POST","/api/client/jobs","client",body(engagement,billing));
    assert.equal(created.status,201,JSON.stringify(created.body));
    const loaded = await api("GET",`/api/client/jobs/${created.body.id}`);
    assert.equal(loaded.body.engagementType,engagement);
    assert.equal(loaded.body.billingMode,billing);
    const stored = (await query("SELECT engagement_type,billing_mode FROM jobs WHERE id=$1",[created.body.id])).rows[0];
    assert.deepEqual(stored,{engagement_type:engagement,billing_mode:billing});
    jobId = created.body.id;
  }
  for (const [engagement,billing] of [[null,"tracked"],["Lite",null],["standard","Tracked"],["Full-Time","guaranteed"]]) {
    const rejected = await api("POST","/api/client/jobs","client",body(engagement,billing));
    assert.equal(rejected.status,400,JSON.stringify(rejected.body));
    assert.match(JSON.stringify(rejected.body),/engagement|billing/i);
  }
});

test("Legacy classification errors identify exactly what is missing and expose only an owned editor",async()=>{
  await query("UPDATE jobs SET billing_mode=NULL,approval_status='approved' WHERE id=$1",[jobId]);
  submissionId = randomUUID();
  await query(`INSERT INTO job_submissions
    (id,job_id,client_id,talent_id,applicant_name,first_name,last_name,email,status,workflow_type,initiated_by,registration_status)
    VALUES($1,$2,$3,$4,'Billing Fixture','Billing','Fixture','billing@example.test','shortlisted','application','talent','linked')`,
    [submissionId,jobId,ids.client,ids.talent]);
  const missing = await api("POST","/api/client/hiring-invoices/ready","client",{submissionId});
  assert.equal(missing.status,409);
  assert.equal(missing.body.code,"JOB_BILLING_CLASSIFICATION_REQUIRED");
  assert.deepEqual(missing.body.details.missingFields,["billingMode"]);
  assert.equal(missing.body.details.engagementType,"Standard");
  assert.equal(missing.body.details.billingMode,null);
  assert.equal(missing.body.details.editPath,`/client/jobs/${jobId}/edit`);
  assert.equal((await api("PATCH",`/api/client/jobs/${jobId}`,"other",{billingMode:"tracked"})).status,403);
  assert.equal((await api("POST","/api/client/hiring-invoices/ready","other",{submissionId})).status,404);
  assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE job_id=$1",[jobId])).rows[0].n,0);
  await query("UPDATE jobs SET status='cancelled' WHERE id=$1",[jobId]);
  const unavailable = await api("POST","/api/client/hiring-invoices/ready","client",{submissionId});
  assert.equal(unavailable.body.details.editPath,null);
  await query("UPDATE jobs SET status='open' WHERE id=$1",[jobId]);
});

test("Authenticated Job Submissions → Extend an Offer → Ready for Offer explains billing setup and repairs the same job through the form",
  {timeout:90000},async()=>{
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(({login})=>{
      localStorage.setItem("onspot_jwt_token",login.token);
      localStorage.setItem("onspot_user",JSON.stringify(login.user));
    },{login:logins.client});
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror",error=>errors.push(error.message));
    try {
      await page.goto(base+`/client/job-submissions?applicationId=${submissionId}`);
      await page.getByRole("dialog").getByRole("button",{name:"Ready for Offer",exact:true}).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("heading",{name:"Extend an Offer",exact:true}).waitFor();
      await dialog.getByRole("button",{name:"Ready for Offer",exact:true}).click();
      await dialog.getByText("Job billing setup required",{exact:true}).waitFor();
      await dialog.getByText("This job needs an engagement type and billing mode before a hiring invoice can be prepared. Please complete the job's billing settings and try again.",{exact:true}).waitFor();
      assert.doesNotMatch(await dialog.innerText(),/JOB_BILLING_CLASSIFICATION_REQUIRED|409:|\{"error"/);
      await page.screenshot({path:"/tmp/job-billing-setup-required.png",fullPage:true});
      await dialog.getByRole("link",{name:"Review Job Billing Settings",exact:true}).click();
      await page.waitForURL(`**/client/jobs/${jobId}/edit`);
      await page.locator("#basics-billing-mode").waitFor();
      assert.match(await page.locator("#basics-contract").innerText(),/Standard/);
      await page.locator("#basics-billing-mode").click();
      await page.getByRole("option",{name:/^Tracked/}).click();
      for(let step=0;step<3;step++) await page.getByRole("button",{name:"Continue",exact:true}).click();
      const [saved] = await Promise.all([
        page.waitForResponse(response=>response.url().endsWith(`/api/client/jobs/${jobId}`)&&response.request().method()==="PATCH"),
        page.getByRole("button",{name:"Update Job",exact:true}).last().click(),
      ]);
      assert.equal(saved.status(),200,await saved.text());
      const updated = (await api("GET",`/api/client/jobs/${jobId}`)).body;
      assert.equal(updated.id,jobId);
      assert.equal(updated.engagementType,"Standard");
      assert.equal(updated.billingMode,"tracked");
      assert.equal(updated.approvalStatus,"pending","Existing approved-job re-review stays required");
      assert.equal((await query("SELECT job_id FROM job_submissions WHERE id=$1",[submissionId])).rows[0].job_id,jobId);
      const awaitingReview = await api("POST","/api/client/hiring-invoices/ready","client",{submissionId});
      assert.equal(awaitingReview.body.code,"APPLICATION_NOT_OFFER_ELIGIBLE");
      // Preserve the normal job-review lifecycle before testing the next gate.
      const approved = await api("POST",`/api/admin/jobs/${jobId}/approve`,"admin",{});
      assert.equal(approved.status,200,JSON.stringify(approved.body));
      assert.deepEqual(errors,[]);
    } catch (error) {
      console.error("Billing form at UAT failure:",await page.locator("body").innerText());
      await page.screenshot({path:"/tmp/job-billing-form-failure.png",fullPage:true});
      throw error;
    } finally { await context.close(); }
  });

test("Correct classification does not invent a hiring fee; missing policy is independently guarded",async()=>{
  const missing = await api("POST","/api/client/hiring-invoices/ready","client",{submissionId});
  assert.equal(missing.status,409);
  assert.equal(missing.body.code,"HIRING_BILLING_POLICY_REQUIRED");
  assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE submission_id=$1",[submissionId])).rows[0].n,0);
  assert.equal((await api("POST","/api/admin/hiring-invoices/policy","client",policy)).status,403);
  const configured = await api("POST","/api/admin/hiring-invoices/policy","admin",policy);
  assert.equal(configured.status,200,JSON.stringify(configured.body));
});

test("Authenticated readiness creates one unpaid invoice and keeps sending an offer locked", {timeout:60000},async()=>{
  const context = await browser.newContext();
  await context.addInitScript(({login})=>{
    localStorage.setItem("onspot_jwt_token",login.token);
    localStorage.setItem("onspot_user",JSON.stringify(login.user));
  },{login:logins.client});
  const page = await context.newPage();
  try {
    await page.goto(base+`/client/job-submissions?applicationId=${submissionId}`);
    await page.getByRole("dialog").getByRole("button",{name:"Ready for Offer",exact:true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading",{name:"Extend an Offer",exact:true}).waitFor();
    await dialog.getByRole("button",{name:"Ready for Offer",exact:true}).click();
    await dialog.getByRole("button",{name:"View invoice & payment instructions",exact:true}).waitFor();
    assert.equal(await dialog.getByRole("button",{name:"Payment verification required",exact:true}).isDisabled(),true);
    await page.screenshot({path:"/tmp/job-billing-invoice-prepared.png",fullPage:true});
    const repeated = await Promise.all(Array.from({length:5},()=>api("POST","/api/client/hiring-invoices/ready","client",{submissionId})));
    assert.ok(repeated.every(result=>result.status===200),JSON.stringify(repeated.map(result=>result.body)));
    assert.equal(new Set(repeated.map(result=>result.body.id)).size,1);
    invoiceId = repeated[0].body.id;
    const stored = (await query("SELECT * FROM hiring_pre_offer_invoices WHERE id=$1",[invoiceId])).rows[0];
    assert.equal(stored.status,"issued");
    assert.equal(stored.verified_at,null);
    assert.equal((await query("SELECT count(*)::int n FROM hiring_pre_offer_invoices WHERE submission_id=$1",[submissionId])).rows[0].n,1);
    const offer = await api("POST","/api/client/offers","client",{submissionId,rate:2500,rateCurrency:"USD",proposedStartDate:"2032-10-01"});
    assert.equal(offer.status,409);
    assert.equal(offer.body.code,"PRE_OFFER_PAYMENT_REQUIRED");
    const before = JSON.stringify(stored);
    assert.equal((await api("PATCH",`/api/client/jobs/${jobId}`,"client",{engagementType:"Lite",billingMode:"guaranteed"})).status,200);
    assert.equal(JSON.stringify((await query("SELECT * FROM hiring_pre_offer_invoices WHERE id=$1",[invoiceId])).rows[0]),before);
  } finally {await context.close();}
});
