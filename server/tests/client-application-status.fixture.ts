/**
 * Real registered routes and password authentication on an owned disposable DB.
 * Only Microsoft OAuth/sendMail HTTP responses are simulated. No email, money,
 * production credentials, production data or external network calls are used.
 */
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { query, pool, applicantEmailLedgerPool } from "../db";
import { registerRoutes } from "../routes";
import { hashPassword } from "../auth-utils";
import { DEFAULT_TEMPLATES } from "../seeds/seedEmailTemplates";

const ids = { client: randomUUID(), other: randomUUID(), talent: randomUUID(), admin: randomUUID() };
const candidateId = randomUUID();
const jobId = randomUUID();
const password = "Fixture-status-only-123!";
const logins: Record<string, any> = {};
const nativeFetch = globalThis.fetch;
const emails: any[] = [];
let provider: "ok" | "reject" | "unknown" = "ok";
let server: any;
let base: string;
let browser: Browser;
let uiApplication: string;

globalThis.fetch = async (input: any, init?: any) => {
  const url = String(input);
  if (url.startsWith("https://login.microsoftonline.com/")) {
    return new Response(JSON.stringify({ access_token: "fixture-only-provider-token", expires_in: 3600 }), { status: 200 });
  }
  if (url.startsWith("https://graph.microsoft.com/")) {
    const body = JSON.parse(init.body);
    assert.ok(body.message.toRecipients[0].emailAddress.address.endsWith("@example.test"));
    emails.push(body);
    if (provider === "unknown") throw new Error("Synthetic network interruption after send");
    return new Response(null, { status: provider === "reject" ? 403 : 202 });
  }
  if (base && url.startsWith(base + "/")) return nativeFetch(input, init);
  throw new Error("External network is forbidden in Client status UAT");
};
async function api(method: string, route: string, who = "client", body?: any) {
  const response = await fetch(base + route, {
    signal: AbortSignal.timeout(20000),
    method, headers: { "Content-Type": "application/json", ...(logins[who] ? { Authorization: `Bearer ${logins[who].token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
async function application(status = "new", workflow = "application", initiator = "talent") {
  const id = randomUUID();
  await query(`INSERT INTO job_submissions
    (id,job_id,client_id,talent_id,email,first_name,last_name,applicant_name,status,workflow_type,initiated_by,registration_status)
    VALUES ($1,$2,$3,$4,$5,'Status','Applicant','Status Applicant',$6,$7,$8,'registered')`,
  [id, jobId, ids.client, ids.talent, `${ids.talent}@example.test`, status, workflow, initiator]);
  return id;
}
async function payload(id: string, status = "shortlisted") {
  const app = (await query("SELECT status, updated_at::text AS version FROM job_submissions WHERE id=$1", [id])).rows[0];
  return { status, expectedStatus: app.status, expectedVersion: app.version, operationId: randomUUID() };
}
const update = (id: string, body: any, who = "client") => api("PATCH", `/api/client/job-submissions/${id}/status`, who, body);
async function counts(id: string) {
  return (await query(`SELECT js.status,
    (SELECT count(*)::int FROM job_application_status_history WHERE application_id=js.id) AS history,
    (SELECT count(*)::int FROM notifications WHERE related_id=js.id AND user_id=$2 AND type='job_application_status_changed') AS alerts,
    (SELECT count(*)::int FROM application_status_change_requests WHERE application_id=js.id AND status='pending') AS approvals
    FROM job_submissions js WHERE js.id=$1`, [id, ids.talent])).rows[0];
}

before(async () => {
  // Test-only values; the parent harness strips all real provider credentials.
  process.env.MICROSOFT_TENANT_ID = "synthetic-status-fixture";
  process.env.MICROSOFT_CLIENT_ID = "synthetic-status-fixture";
  process.env.MICROSOFT_CLIENT_SECRET = "synthetic-status-fixture";
  process.env.PUBLIC_APP_URL = "https://fixture.example.test";
  const hash = await hashPassword(password);
  for (const [key, id] of Object.entries(ids)) {
    const role = key === "other" ? "client" : key;
    await query(`INSERT INTO users (id,email,role,first_name,last_name,password_hash,email_verified_at,email_verified_email)
      VALUES ($1,$2::text,$3,$4,'Fixture',$5,NOW(),$2::text)`, [id, `${id}@example.test`, role, key, hash]);
  }
  await query(`INSERT INTO client_profiles (user_id,company_name,contact_person,email)
    VALUES ($1,'Status Fixture Company','Status Client',$2)`, [ids.client, `${ids.client}@example.test`]);
  await query(`INSERT INTO candidates
    (id,user_id,email,first_name,last_name,full_name,password_hash,email_verified_at,email_verified_email,profile_completed)
    VALUES ($1,$2,$3::text,'Status','Applicant','Status Applicant',$4,NOW(),$3::text,true)`,
  [candidateId, ids.talent, `${ids.talent}@example.test`, hash]);
  await query(`INSERT INTO jobs (id,client_id,title,description,category,status,approval_status,experience_level,application_method)
    VALUES ($1,$2,'TEST Automatic Status Role','Disposable status verification','Other','open','approved','intermediate','built_in_form')`,
  [jobId, ids.client]);
  const app = express(); app.use(express.json()); server = await registerRoutes(app);
  app.use(express.static(path.resolve("dist/public")));
  app.get("*", (_req, res) => res.sendFile(path.resolve("dist/public/index.html")));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [who, id] of Object.entries(ids)) {
    const result = await api("POST", "/api/login", "anonymous", { email: `${id}@example.test`, password });
    assert.equal(result.status, 200, JSON.stringify(result.body)); logins[who] = result.body;
  }
  // Startup seeding preserves customized templates; install controlled published
  // variants in this disposable DB, without altering seed content in the app.
  await query("UPDATE applicant_email_templates SET is_default=false");
  for (const stage of ["under_review", "shortlisted", "rejected"]) {
    const stock = DEFAULT_TEMPLATES.find(t => t.stage === stage && t.isDefault)!;
    await query(`INSERT INTO applicant_email_templates (name,subject,body_html,stage,category,is_default,is_published)
      VALUES ($1,$2,$3,$4,$5,true,true)`,
    [`Custom ${stage}`, `Custom ${stage}: {{job_title}}`,
      stock.bodyHtml.replace("Hi {{applicant_first_name}}", "Custom greeting {{applicant_first_name}}"), stage, stock.category]);
  }
  uiApplication = await application();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
}, { timeout: 120000 });
after(async () => {
  globalThis.fetch = nativeFetch;
  await browser?.close();
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
  await applicantEmailLedgerPool.end();
});

test("Authenticated Client UI updates Under Review automatically without composer or approval", { timeout: 60000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript((login) => {
    localStorage.setItem("onspot_jwt_token", login.token);
    localStorage.setItem("onspot_user", JSON.stringify(login.user));
  }, logins.client);
  try {
    await page.goto(base + "/client-profile", { waitUntil: "domcontentloaded" });
    const tab = page.getByRole("tab", { name: /job submissions/i });
    if (await tab.count()) await tab.click();
    const view = page.getByRole("button", { name: "View", exact: true }).last();
    await view.waitFor(); await view.click();
    await page.getByText("Update application status", { exact: true }).waitFor();
    await page.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Under Review", exact: true }).click();
    await page.getByRole("button", { name: "Update Status", exact: true }).click();
    const response = page.waitForResponse(r => r.url().endsWith(`/job-submissions/${uiApplication}/status`) && r.request().method() === "PATCH");
    await page.getByRole("button", { name: "Confirm & Notify Applicant" }).click();
    const result = await response; assert.equal(result.status(), 200, await result.text());
    assert.deepEqual(await counts(uiApplication), { status: "under_review", history: 1, alerts: 1, approvals: 0 });
    assert.equal(await page.getByText("Pending Admin Approval", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Compose Email", { exact: true }).count(), 0);
    assert.equal(emails.at(-1).message.subject, "Custom under_review: TEST Automatic Status Role");
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    await page.screenshot({ path: "/tmp/client-status-ui.png" });
  } finally { await page.close(); }
  const talentPage = await browser.newPage();
  try {
    await talentPage.addInitScript((login) => {
      localStorage.setItem("onspot_jwt_token", login.token); localStorage.setItem("onspot_user", JSON.stringify(login.user));
    }, logins.talent);
    await talentPage.goto(base + `/my-applications?applicationId=${uiApplication}`);
    await talentPage.getByRole("dialog", { name: "Submission details" }).getByText("Under Review", { exact: true }).waitFor();
    await talentPage.screenshot({ path: "/tmp/client-status-talent-view.png" });
  } finally { await talentPage.close(); }
});

test("All four Client statuses select existing customized default templates, history and Talent display", async () => {
  for (const [target, stage] of [["under_review","under_review"], ["reviewed","under_review"], ["shortlisted","shortlisted"], ["rejected","rejected"]]) {
    const id = await application(); const before = emails.length;
    const response = await update(id, await payload(id, target));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(Object.keys(response.body).sort(), ["emailSent","status","statusVersion","success"]);
    assert.equal(emails.length, before + 1);
    assert.equal(emails.at(-1).message.subject, `Custom ${stage}: TEST Automatic Status Role`);
    assert.match(emails.at(-1).message.body.content, /Custom greeting Status/);
    assert.deepEqual(await counts(id), { status: target, history: 1, alerts: 1, approvals: 0 });
    const talent = await api("GET", "/api/talent/applications", "talent");
    assert.equal(talent.status, 200);
    assert.ok(JSON.stringify(talent.body).includes(id));
    assert.equal(talent.body.find((application: any) => application.id === id).applicationStatus, target);
    const admin = await api("GET", `/api/admin/job-applications/${id}`, "admin");
    assert.equal(admin.status, 200); assert.ok(JSON.stringify(admin.body).includes(target));
  }
});

test("Job ownership is authoritative; unrelated Clients, Talent, Admin and anonymous cannot use Client mutation", async () => {
  const id = await application(); const body = await payload(id); const before = emails.length;
  // A stale redundant submission owner must not grant access.
  await query("UPDATE job_submissions SET client_id=$2 WHERE id=$1", [id, ids.other]);
  for (const who of ["other","talent","admin","anonymous"]) {
    assert.ok([401,403].includes((await update(id, body, who)).status));
  }
  assert.equal(emails.length, before);
  assert.equal((await update(id, body)).status, 200);
  const list = await api("GET", "/api/client/job-submissions");
  assert.equal(list.status, 200);
  assert.doesNotMatch(JSON.stringify(list.body), new RegExp(`${ids.talent}@example.test`));
});

test("Private shortlists, pending/declined invitations, terminal and specialized stages cannot be repurposed", async () => {
  const before = emails.length;
  for (const [source, workflow, initiator] of [
    ["shortlisted","client_shortlist","client"], ["invited","client_invitation","client"],
    ["declined","client_invitation","client"], ["hired","application","talent"],
    ["withdrawn","application","talent"], ["rejected","application","talent"],
    ["offer_extended","application","talent"], ["offer_accepted","application","talent"],
    ["contract_sent","application","talent"], ["interviewing","application","talent"],
  ]) {
    const id = await application(source, workflow, initiator);
    assert.ok([403,409].includes((await update(id, await payload(id, "under_review"))).status));
  }
  const id = await application();
  for (const target of ["hired","withdrawn","interviewing","offer_extended","bogus"]) {
    assert.equal((await update(id, await payload(id, target))).status, 400);
  }
  assert.equal(emails.length, before);
  const accepted = await application("new", "client_invitation", "client");
  assert.equal((await update(accepted, await payload(accepted))).status, 200);
});

test("Provider rejection preserves original status and durable attempts; retry sends once and replays never resend", async () => {
  const id = await application(); const body = await payload(id); const before = emails.length;
  provider = "reject";
  try {
    assert.equal((await update(id, body)).status, 502);
    assert.deepEqual(await counts(id), { status:"new", history:0, alerts:0, approvals:0 });
  } finally { provider = "ok"; }
  assert.equal((await update(id, body)).status, 200);
  assert.equal((await update(id, body)).status, 200);
  const same = await update(id, await payload(id)); assert.equal(same.status, 200); assert.equal(same.body.emailSent, false);
  assert.equal(emails.length, before + 2);
  const ledger = (await query("SELECT * FROM job_application_emails WHERE id=$1", [body.operationId])).rows[0];
  assert.equal(ledger.status, "sent"); assert.ok(ledger.status_completed_at);
  assert.deepEqual(ledger.delivery_attempts.map((a: any) => a.state), ["sending","failed","sending","sent"]);
  assert.deepEqual(await counts(id), { status:"shortlisted", history:1, alerts:1, approvals:0 });
});

test("Concurrent competing requests and stale/ABA versions cannot overwrite or duplicate a transition", async () => {
  const id = await application(); const body = await payload(id); const before = emails.length;
  const responses = await Promise.all(Array.from({ length: 10 }, () => update(id, { ...body, operationId: randomUUID() })));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 9);
  assert.equal(emails.length, before + 1);
  assert.deepEqual(await counts(id), { status:"shortlisted", history:1, alerts:1, approvals:0 });
  const stale = await payload(id, "reviewed");
  await query("UPDATE job_submissions SET status='under_review', updated_at=clock_timestamp() WHERE id=$1", [id]);
  await query("UPDATE job_submissions SET status='shortlisted', updated_at=clock_timestamp() WHERE id=$1", [id]);
  assert.equal((await update(id, stale)).status, 409);
  assert.equal(emails.length, before + 1);
});

test("Email accepted then DB history failure recovers after reload without resending; legacy request is cancelled", async () => {
  const id = await application(); const body = await payload(id); const before = emails.length;
  await query(`INSERT INTO application_status_change_requests
    (application_id,requested_by_user_id,requested_by_role,current_status,requested_status)
    VALUES ($1,$2,'client','new','rejected')`, [id, ids.client]);
  await query(`CREATE FUNCTION fixture_fail_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.application_id='${id}' THEN RAISE EXCEPTION 'Synthetic history write failure'; END IF; RETURN NEW; END $$`);
  await query("CREATE TRIGGER fixture_status_history BEFORE INSERT ON job_application_status_history FOR EACH ROW EXECUTE FUNCTION fixture_fail_status_history()");
  try {
    const failed = await update(id, body); assert.equal(failed.status, 500, JSON.stringify(failed.body));
    assert.deepEqual(await counts(id), { status:"new", history:0, alerts:0, approvals:1 });
    const ledger = (await query("SELECT status,status_completed_at FROM job_application_emails WHERE id=$1", [body.operationId])).rows[0];
    assert.equal(ledger.status, "sent"); assert.equal(ledger.status_completed_at, null);
  } finally { await query("DROP TRIGGER fixture_status_history ON job_application_status_history"); }
  const different = await update(id, { ...body, status:"rejected", operationId:randomUUID() });
  assert.equal(different.status, 409);
  assert.equal((await update(id, { ...body, operationId:randomUUID() })).status, 200);
  assert.equal(emails.length, before + 1);
  assert.deepEqual(await counts(id), { status:"shortlisted", history:1, alerts:1, approvals:0 });
});

test("Unknown provider delivery is never automatically resent and does not claim success", async () => {
  const id = await application(); const body = await payload(id); const before = emails.length;
  provider = "unknown";
  try { assert.equal((await update(id, body)).status, 502); } finally { provider = "ok"; }
  assert.equal((await update(id, body)).status, 409);
  assert.equal((await update(id, { ...body, operationId:randomUUID() })).status, 409);
  assert.equal(emails.length, before + 1);
  assert.deepEqual(await counts(id), { status:"new", history:0, alerts:0, approvals:0 });
});

test("Missing/unpublished/ambiguous/broken templates block safely, without provider calls", async () => {
  const before = emails.length;
  await query("UPDATE applicant_email_templates SET is_published=false WHERE stage='shortlisted' AND is_default=true");
  try {
    const id = await application(); assert.equal((await update(id, await payload(id))).status, 422);
    assert.equal((await counts(id)).status, "new");
  } finally { await query("UPDATE applicant_email_templates SET is_published=true WHERE stage='shortlisted' AND is_default=true"); }
  await query("UPDATE applicant_email_templates SET subject='{{not_a_supported_variable}}' WHERE stage='shortlisted' AND is_default=true");
  try {
    const id = await application(); assert.equal((await update(id, await payload(id))).status, 422);
  } finally { await query("UPDATE applicant_email_templates SET subject='Custom shortlisted: {{job_title}}' WHERE stage='shortlisted' AND is_default=true"); }
  assert.equal(emails.length, before);
});

test("Ambiguous defaults, archived templates, invalid recipients and operation reuse are rejected", async () => {
  const before = emails.length;
  const duplicate = (await query(`INSERT INTO applicant_email_templates
    (name,subject,body_html,stage,category,is_default,is_published)
    VALUES ('Ambiguous test','Subject','<p>Test</p>','shortlisted','shortlisted',true,true) RETURNING id`)).rows[0].id;
  try {
    const id = await application(); assert.equal((await update(id, await payload(id))).status, 422);
  } finally { await query("DELETE FROM applicant_email_templates WHERE id=$1", [duplicate]); }
  await query("UPDATE applicant_email_templates SET is_archived=true WHERE stage='shortlisted' AND is_default=true");
  try {
    const id = await application(); assert.equal((await update(id, await payload(id))).status, 422);
  } finally { await query("UPDATE applicant_email_templates SET is_archived=false WHERE stage='shortlisted' AND is_default=true"); }
  const id = await application(); await query("UPDATE job_submissions SET email='invalid' WHERE id=$1", [id]);
  assert.equal((await update(id, await payload(id))).status, 400);
  assert.equal(emails.length, before);
  const original = await application(); const body = await payload(original);
  assert.equal((await update(original, body)).status, 200);
  const other = await application();
  assert.equal((await update(other, { ...(await payload(other)), operationId: body.operationId })).status, 409);
  assert.equal(emails.length, before + 1);
});

test("Successful provider result whose ledger persistence fails cannot ever be blindly resent", async () => {
  const id = await application(); const body = await payload(id); const before = emails.length;
  await query(`CREATE FUNCTION fixture_fail_delivery_record() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.application_id='${id}' AND NEW.status='sent' THEN RAISE EXCEPTION 'Synthetic sent-evidence failure'; END IF; RETURN NEW; END $$`);
  await query("CREATE TRIGGER fixture_delivery_record BEFORE UPDATE ON job_application_emails FOR EACH ROW EXECUTE FUNCTION fixture_fail_delivery_record()");
  try { assert.equal((await update(id, body)).status, 500); }
  finally { await query("DROP TRIGGER fixture_delivery_record ON job_application_emails"); }
  assert.equal((await update(id, body)).status, 409);
  assert.equal(emails.length, before + 1);
  assert.deepEqual(await counts(id), { status:"new", history:0, alerts:0, approvals:0 });
  const ledger = (await query("SELECT status FROM job_application_emails WHERE id=$1", [body.operationId])).rows[0];
  assert.equal(ledger.status, "sending", "Durable ambiguity marker survives the failed evidence write");
  const history = await api("GET", `/api/admin/job-applications/${id}/email/history`, "admin");
  assert.equal(history.status, 200); assert.equal(history.body[0].automaticStatus, true);
});

test("Independent applications cannot exhaust the connections needed for durable email evidence", { timeout: 45000 }, async () => {
  const requests = await Promise.all(Array.from({length: 13}, async () => {
    const id = await application(); return { id, body: await payload(id) };
  }));
  const before = emails.length;
  const results = await Promise.all(requests.map(({id,body}) => update(id,body)));
  assert.ok(results.every(result => result.status === 200), JSON.stringify(results));
  assert.equal(emails.length, before + requests.length);
  for (const { id } of requests) assert.deepEqual(await counts(id), { status:"shortlisted", history:1, alerts:1, approvals:0 });
});

test("Admin manual composer still sends normal status emails and never bypasses automatic recovery", async () => {
  const id = await application(); const before = emails.length;
  const manual = await api("POST", `/api/admin/job-applications/${id}/email/send`, "admin", {
    subject:"Admin custom status {{job_title}}", bodyHtml:"<p>Hi {{applicant_first_name}}</p>", updateStage:"under_review",
  });
  assert.equal(manual.status, 200, JSON.stringify(manual.body)); assert.equal(emails.length, before + 1);
  assert.deepEqual(await counts(id), { status:"under_review", history:1, alerts:1, approvals:0 });
  const pending = await application(); const body = await payload(pending);
  provider="unknown";
  try { assert.equal((await update(pending, body)).status, 502); } finally { provider="ok"; }
  const blocked = await api("POST", `/api/admin/job-applications/${pending}/email/send`, "admin", {
    subject:"Must not send",bodyHtml:"<p>Must not send</p>",updateStage:"shortlisted",
  });
  assert.equal(blocked.status, 409); assert.equal(emails.length, before + 2);
});

test("Historical delivered approvals recover without sending; undelivered requests archive without denial alerts", async () => {
  const id = await application();
  const requestId = (await query(`INSERT INTO application_status_change_requests
    (application_id,requested_by_user_id,requested_by_role,current_status,requested_status)
    VALUES ($1,$2,'client','new','shortlisted') RETURNING id`, [id, ids.client])).rows[0].id;
  await query(`INSERT INTO job_application_emails
    (application_id,subject,body_html,sent_to,sent_by,status,status_update,status_previous)
    VALUES ($1,'Historical delivered','<p>Delivered</p>',$2,$3,'sent','shortlisted','new')`,
  [id, `${ids.talent}@example.test`, ids.admin]);
  const before = emails.length;
  assert.equal((await update(id, await payload(id, "rejected"))).status, 409);
  assert.equal((await api("POST", `/api/admin/status-change-requests/${requestId}/reject`, "admin", {})).status, 409);
  const recovered = await api("POST", `/api/admin/status-change-requests/${requestId}/finalize`, "admin", {});
  assert.equal(recovered.status, 200, JSON.stringify(recovered.body));
  assert.equal((await counts(id)).status, "shortlisted");
  assert.equal((await api("POST", `/api/admin/status-change-requests/${requestId}/finalize`, "admin", {})).status, 409);
  const staleId = await application();
  const archiveId = (await query(`INSERT INTO application_status_change_requests
    (application_id,requested_by_user_id,requested_by_role,current_status,requested_status)
    VALUES ($1,$2,'client','new','shortlisted') RETURNING id`, [staleId, ids.client])).rows[0].id;
  assert.equal((await api("POST", `/api/admin/status-change-requests/${archiveId}/reject`, "admin", {})).status, 200);
  assert.equal((await query("SELECT status FROM application_status_change_requests WHERE id=$1", [archiveId])).rows[0].status, "cancelled");
  assert.equal((await counts(staleId)).status, "new");
  assert.equal(emails.length, before);
});

test("Client UI provider failure states are truthful and preserve the selected status for retry", { timeout: 60000 }, async () => {
  const id = await application();
  const page = await browser.newPage({viewport:{width:390,height:900}});
  await page.addInitScript((login) => {
    localStorage.setItem("onspot_jwt_token", login.token); localStorage.setItem("onspot_user",JSON.stringify(login.user));
  },logins.client);
  try {
    await page.goto(base + `/client-profile?applicationId=${id}`);
    // The existing application deep link opens the actual detail dialog.
    await page.getByText("Update application status",{exact:true}).waitFor();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option",{name:"Shortlisted",exact:true}).click();
    await page.getByRole("button",{name:"Update Status",exact:true}).click();
    provider="reject";
    await page.getByRole("button",{name:"Confirm & Notify Applicant"}).click();
    await page.getByText("Status was not updated",{exact:true}).first().waitFor();
    assert.equal((await counts(id)).status,"new");
    assert.equal(await page.getByText("The applicant has been notified by email.",{exact:true}).count(),0);
    provider="ok";
    await page.getByRole("button",{name:"Confirm & Notify Applicant"}).click();
    await page.getByText("The applicant has been notified by email.",{exact:true}).first().waitFor();
    assert.equal((await counts(id)).status,"shortlisted");
    await page.getByRole("alertdialog").waitFor({state:"hidden"});
    await page.screenshot({path:"/tmp/client-status-mobile.png"});
  } finally { provider="ok"; await page.close(); }
});

test("Obsolete approval creation/sending is retired, no historical records deleted, migration is additive/idempotent", async () => {
  const id = await application(); const before = emails.length;
  assert.equal((await api("POST", `/api/client/job-submissions/${id}/status-change-requests`, "client", {requestedStatus:"shortlisted"})).status, 410);
  assert.equal((await api("POST", `/api/admin/job-applications/${id}/email/send`, "admin", {
    statusChangeRequestId:randomUUID(), templateId:randomUUID(), updateStage:"shortlisted",
  })).status, 410);
  assert.equal(emails.length, before);
  const sql = await readFile("migrations/0042_client_application_status_email.sql", "utf8");
  await query(sql); await query(sql);
  assert.ok((await query("SELECT id FROM job_application_emails LIMIT 1")).rows.length);
});
