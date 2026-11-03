/**
 * Production routes + compiled UI + password login + owned PostgreSQL.
 * Run: node scripts/test-hiring-payments-isolated.mjs --messaging-only
 * Original route reproduction: add --baseline --baseline-ref=<pre-fix revision>.
 * Never point this fixture at an application or production database.
 */
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Server } from "node:http";
import express from "express";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { query, pool } from "../db";
import { registerRoutes } from "../routes";
import { hashPassword } from "../auth-utils";
import { ACTIVE_HIRE_SUBMISSION_SQL } from "../services/messagingContacts";
import { TIMESHEET_HIRE_SQL } from "../services/timesheetEligibility";

assert.ok(process.env.HIRING_FLOW_TEST_DATABASE_URL?.includes("/onspot_hiring_test"));
const baseline = process.env.MESSAGING_UAT_BASELINE === "true";
const ids = { client: randomUUID(), talent: randomUUID(), otherClient: randomUUID(), otherTalent: randomUUID(), admin: randomUUID() };
const candidateId = randomUUID(), jobId = randomUUID(), applicationId = randomUUID();
const password = `Disposable-only-${randomUUID()}!`;
let base: string, server: Server, browser: Browser, clientContext: BrowserContext, talentContext: BrowserContext;
let clientPage: Page, talentPage: Page, threadId: string, candidateToken: string;
const logins: Record<string, { token: string; user: any }> = {};
async function api(method: string, route: string, who = "client", body?: unknown) {
  const response = await fetch(base + route, { method, headers: {
    ...(logins[who] ? { Authorization: `Bearer ${logins[who].token}` } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
}
const open = (id: string = applicationId, who = "client") => api("POST", `/api/applications/${id}/message-thread`, who);
async function hiredContact(title: string, signed = true, historicallyEnded = false,
  pair = { client: ids.client, talent: ids.talent }) {
  const job = randomUUID();
  await query(`INSERT INTO jobs(id,client_id,title,description,category,status,experience_level)
    VALUES($1,$2,$3,'Isolated messaging test','Other','open','intermediate')`, [job, pair.client, title]);
  const application = await submission({ talent: pair.talent, status: "hired", workflow: "client_invitation", initiator: "client" });
  await query("UPDATE job_submissions SET job_id=$1,client_id=$3 WHERE id=$2", [job, application, pair.client]);
  const offer = (await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type)
    VALUES($1,'accepted',1000,'USD','Standard') RETURNING id`, [application])).rows[0].id;
  const contract = (await query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,talent_signed_at,onspot_signed_at,
    effective_end_date,termination_reason,terminated_by,terminated_at)
    VALUES($1,$2,$3,CASE WHEN $4 THEN now() END,CASE WHEN $4 THEN now() END,
      CASE WHEN $5 THEN CURRENT_DATE-2 END,CASE WHEN $5 THEN 'Historical fixture ending' END,
      CASE WHEN $5 THEN $6 END,CASE WHEN $5 THEN now()-interval '3 days' END) RETURNING id`,
  [offer, application, signed ? "signed" : "sent", signed, historicallyEnded, ids.admin])).rows[0].id;
  return { application, contract, job };
}
async function submission(values: { talent?: string | null; email?: string; status?: string; workflow?: string; initiator?: string } = {}) {
  const id = randomUUID();
  await query(`INSERT INTO job_submissions
    (id,job_id,client_id,talent_id,email,first_name,last_name,status,workflow_type,initiated_by,registration_status)
    VALUES ($1,$2,$3,$4,$5,'Applicant','Fixture',$6,$7,$8,'registered')`,
  [id, jobId, ids.client, values.talent === undefined ? ids.talent : values.talent,
    values.email || `${ids.talent}@example.test`, values.status || "new", values.workflow || "application", values.initiator || "talent"]);
  return id;
}

function registerHiredContactTests() {
  test("active hired contacts are role-scoped, per job, privately presented, and use readBy unread counts", async () => {
    assert.equal((await api("GET", "/api/me/message-contacts", "anonymous")).status, 401);
    assert.equal((await api("GET", "/api/me/message-contacts", "admin")).status, 403);
    const a = await hiredContact("Active hire A"), b = await hiredContact("Active hire B");
    const unsigned = await hiredContact("Unsigned hire", false);
    const client = await api("GET", "/api/me/message-contacts");
    const talent = await api("GET", "/api/me/message-contacts", "talent");
    assert.equal(client.status, 200, JSON.stringify(client.body));
    assert.equal(talent.status, 200, JSON.stringify(talent.body));
    const clientRows = client.body.contacts.filter((c: any) => [a.application, b.application].includes(c.applicationId));
    assert.equal(clientRows.length, 2);
    assert.deepEqual(clientRows.map((c: any) => c.jobTitle).sort(), ["Active hire A", "Active hire B"]);
    assert.ok(clientRows.every((c: any) => c.otherUserId === ids.talent && c.hiredAt));
    assert.ok(talent.body.contacts.some((c: any) => c.applicationId === a.application
      && c.companyName === "Messaging UAT Company" && c.contactPerson === "Client Fixture"));
    assert.equal(client.body.contacts.find((c: any) => c.applicationId === unsigned.application).paperworkPending, true);
    assert.ok(!client.body.contacts.some((c: any) => c.applicationId === applicationId));
    assert.ok([200, 201].includes((await open(unsigned.application)).status));
    assert.equal((await api("GET", "/api/me/message-contacts", "otherClient")).body.contacts.length, 0);
    assert.equal((await api("GET", "/api/me/message-contacts", "otherTalent")).body.contacts.length, 0);
    assert.equal((await open(a.application, "otherClient")).status, 403);
    assert.equal((await open(a.application, "otherTalent")).status, 403);
    const started = await open(a.application);
    assert.ok([200, 201].includes(started.status), JSON.stringify(started.body));
    const repeated = await open(a.application, "talent");
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.threadId, started.body.threadId);
    await query(`INSERT INTO messages(thread_id,sender_id,content,read_by)
      VALUES($1,$2,'Isolated hired message',$3::text[])`, [started.body.threadId, ids.talent, [ids.talent]]);
    const contact = (await api("GET", "/api/me/message-contacts")).body.contacts.find((c: any) => c.applicationId === a.application);
    const thread = (await api("GET", "/api/me/message-threads")).body.threads.find((t: any) => t.id === started.body.threadId);
    assert.equal(contact.threadId, started.body.threadId);
    assert.equal(contact.unreadCount, thread.unreadCount);
    assert.ok(contact.unreadCount >= 1);
    assert.ok(!("email" in contact) && !("phone" in contact));
    assert.equal((await api("POST", `/api/message-threads/${started.body.threadId}/mark-read`, "client", {})).status, 204);
    assert.equal((await api("GET", "/api/me/message-contacts")).body.contacts.find((c: any) => c.applicationId === a.application).unreadCount, 0);
    // Execution cannot bypass the canonical formal-pipeline provenance rule.
    await query("UPDATE job_submissions SET workflow_type='application',initiated_by='client' WHERE id=$1", [a.application]);
    assert.equal((await open(a.application)).status, 409);
    assert.ok(!(await api("GET", "/api/me/message-contacts")).body.contacts.some((c: any) => c.applicationId === a.application));
  });

  test("formal hires with draft or missing contracts can communicate without becoming timesheet or roster eligible", async () => {
    const pair = { client: ids.otherClient, talent: ids.otherTalent };
    const pending = await hiredContact("Draft paperwork hire", false, false, pair);
    const missing = await hiredContact("Missing paperwork hire", false, false, pair);
    await query("UPDATE hiring_contracts SET status='draft' WHERE id=$1", [pending.contract]);
    await query("DELETE FROM hiring_contracts WHERE id=$1", [missing.contract]);
    await query("UPDATE jobs SET approval_status='approved' WHERE id=ANY($1::text[])", [[pending.job, missing.job]]);
    await query(`UPDATE job_submissions SET workflow_type='application',initiated_by='talent',registration_status='linked'
      WHERE id=ANY($1::text[])`, [[pending.application, missing.application]]);
    await query(`INSERT INTO candidates(id,email,first_name,last_name,full_name,user_id)
      SELECT $1,email,first_name,last_name,concat_ws(' ',first_name,last_name),id FROM users WHERE id=$2`,
    [randomUUID(), pair.talent]);
    const expectedName = (await query("SELECT concat_ws(' ',first_name,last_name) AS name FROM users WHERE id=$1", [pair.talent])).rows[0].name;
    for (const hire of [pending, missing]) {
      await query(`INSERT INTO job_application_status_history(application_id,new_status,changed_by,created_at)
        VALUES($1,'hired',$2,'2026-02-01T09:00:00Z')`, [hire.application, ids.admin]);
      for (const who of ["otherClient", "otherTalent"]) {
        const result = await api("GET", "/api/me/message-contacts", who);
        assert.equal(result.status, 200);
        const contact = result.body.contacts.find((c: any) => c.applicationId === hire.application);
        assert.ok(contact);
        assert.equal(contact.paperworkPending, true);
        assert.equal(new Date(contact.hiredAt).toISOString(), "2026-02-01T09:00:00.000Z");
        if (who === "otherClient") assert.equal(contact.personName, expectedName);
        const policy = await api("GET", "/api/me/messaging-policy", who);
        assert.equal((await api("POST", "/api/me/messaging-policy/accept", who, { version: policy.body.currentVersion })).status, 200);
      }
      const started = await open(hire.application, "otherClient");
      assert.ok([200, 201].includes(started.status), JSON.stringify(started.body));
      assert.equal((await open(hire.application, "otherTalent")).body.threadId, started.body.threadId);
      for (const who of ["otherClient", "otherTalent"]) {
        assert.equal((await api("POST", "/api/messages", who, {
          threadId: started.body.threadId, content: "Can we discuss the project setup?",
        })).status, 201);
      }
      const headers = await api("GET", "/api/me/message-threads", "otherClient");
      assert.equal(headers.body.participantNames[pair.talent], expectedName);
    }
    const strict = await query(`SELECT (${ACTIVE_HIRE_SUBMISSION_SQL}) AS active,
      (${TIMESHEET_HIRE_SQL}) AS timesheet FROM job_submissions js
      JOIN hiring_contracts hc ON hc.submission_id=js.id WHERE js.id=$1`, [pending.application]);
    assert.deepEqual(strict.rows[0], { active: false, timesheet: false });
    assert.equal((await query(`SELECT hc.id FROM job_submissions js JOIN hiring_contracts hc ON hc.submission_id=js.id
      WHERE js.id=$1 AND ${TIMESHEET_HIRE_SQL}`, [missing.application])).rows.length, 0);
    const org = (await query("INSERT INTO organizations(name,created_by) VALUES('Pending paperwork team',$1) RETURNING id", [pair.client])).rows[0].id;
    await query("INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'owner','active')", [org, pair.client]);
    const roster = await api("GET", `/api/client/team-dashboard?organizationId=${org}`, "otherClient");
    assert.equal(roster.status, 200, JSON.stringify(roster.body));
    assert.equal(roster.body.members.length, 0);
    for (const [hire, status] of [[pending, "rejected"], [missing, "withdrawn"]] as const) {
      const existing = await open(hire.application, "otherClient");
      await query("UPDATE job_submissions SET status=$2 WHERE id=$1", [hire.application, status]);
      for (const who of ["otherClient", "otherTalent"]) {
        assert.ok(!(await api("GET", "/api/me/message-contacts", who)).body.contacts.some((c: any) => c.applicationId === hire.application));
        assert.equal((await open(hire.application, who)).status, 409);
        assert.equal((await api("POST", "/api/messages", who, { threadId: existing.body.threadId, content: "Should not be sent." })).status, 409);
      }
    }
  });

  test("ended, void and inactive hires disappear and stale entry points cannot reuse their old thread", async () => {
    // Insert historical data rather than bypassing the real no-backdating
    // update guard. Application code cannot manufacture a past termination.
    const hire = await hiredContact("Ended hire", true, true);
    for (const who of ["client", "talent"]) {
      const result = await api("GET", "/api/me/message-contacts", who);
      assert.equal(result.status, 200);
      assert.ok(!result.body.contacts.some((c: any) => c.applicationId === hire.application));
      assert.equal((await open(hire.application, who)).status, 409);
    }
    const voidHire = await hiredContact("Void hire");
    const voidThread = await open(voidHire.application);
    assert.ok([200, 201].includes(voidThread.status));
    await query("UPDATE hiring_contracts SET status='void',voided_at=now() WHERE id=$1", [voidHire.contract]);
    assert.equal((await open(voidHire.application)).status, 409);
    assert.equal((await api("POST", "/api/messages", "client", { threadId: voidThread.body.threadId, content: "Should not be sent." })).status, 409);
    assert.ok(!(await api("GET", "/api/me/message-contacts")).body.contacts.some((c: any) => c.applicationId === voidHire.application));
    for (const status of ["terminated", "voided"]) {
      const inactive = await hiredContact(`${status} hire`);
      const oldThread = await open(inactive.application);
      assert.ok([200, 201].includes(oldThread.status));
      await query("UPDATE hiring_contracts SET status=$2 WHERE id=$1", [inactive.contract, status]);
      for (const who of ["client", "talent"]) {
        assert.ok(!(await api("GET", "/api/me/message-contacts", who)).body.contacts.some((c: any) => c.applicationId === inactive.application));
        assert.equal((await open(inactive.application, who)).status, 409);
        assert.equal((await api("POST", "/api/messages", who, { threadId: oldThread.body.threadId, content: "Should not be sent." })).status, 409);
      }
    }
    const futureEnd = await hiredContact("Active scheduled ending");
    await query(`UPDATE hiring_contracts SET effective_end_date=CURRENT_DATE+10,
      termination_reason='Future isolated ending',terminated_by=$2,terminated_at=now() WHERE id=$1`,
    [futureEnd.contract, ids.admin]);
    assert.ok((await api("GET", "/api/me/message-contacts")).body.contacts.some((c: any) => c.applicationId === futureEnd.application));
    await query("UPDATE job_submissions SET status='rejected' WHERE id=$1", [futureEnd.application]);
    assert.equal((await open(futureEnd.application)).status, 409);
  });

  test("paperwork stays pending until actual execution without preventing messaging", async () => {
    const hire = await hiredContact("Managed agreement");
    await query("UPDATE hiring_contracts SET document_managed=true,party_type='client' WHERE id=$1", [hire.contract]);
    assert.ok([200, 201].includes((await open(hire.application)).status));
    assert.equal((await api("GET", "/api/me/message-contacts")).body.contacts.find((c: any) => c.applicationId === hire.application).paperworkPending, true);
    const document = (await query(`INSERT INTO contract_documents(hiring_contract_id,object_key,original_filename,mime_type,file_size,
      sha256,version,status,uploaded_by,executed_at) VALUES($1,$2,'fixture.pdf','application/pdf',100,$3,1,'executed',$4,now()) RETURNING id`,
    [hire.contract, `fixture/${randomUUID()}`, "a".repeat(64), ids.admin])).rows[0].id;
    for (const [role, user] of [["talent", ids.talent], ["onspot", ids.admin]]) {
      await query(`INSERT INTO contract_signatures(document_id,signer_user_id,signer_role,legal_name,document_version,document_sha256,authority_context)
        VALUES($1,$2,$3,'Isolated Fixture',1,$4,'Disposable eligibility fixture')`, [document, user, role, "a".repeat(64)]);
    }
    assert.ok([200, 201].includes((await open(hire.application)).status));
    assert.equal((await api("GET", "/api/me/message-contacts")).body.contacts.find((c: any) => c.applicationId === hire.application).paperworkPending, true);
    await query(`INSERT INTO contract_signatures(document_id,signer_user_id,signer_role,legal_name,document_version,document_sha256,authority_context)
      VALUES($1,$2,'client','Isolated Client',1,$3,'Disposable eligibility fixture')`, [document, ids.client, "a".repeat(64)]);
    assert.equal((await api("GET", "/api/me/message-contacts")).body.contacts.find((c: any) => c.applicationId === hire.application).paperworkPending, false);
    assert.ok([200, 201].includes((await open(hire.application)).status));
  });

  test("password-authenticated Talent and Client see hired contacts, open chats, and retain the privacy policy", { timeout: 60000 }, async () => {
    const hire = await hiredContact("Browser hired engagement", false);
    await query("UPDATE hiring_contracts SET status='draft' WHERE id=$1", [hire.contract]);
    for (const [page, who] of [[talentPage, "talent"], [clientPage, "client"]] as const) {
      await page.goto(base + "/messages");
      await page.getByTestId("tab-messages-chats").waitFor();
      await page.getByTestId("tab-messages-contacts").click();
      const row = page.getByTestId(`message-contact-${hire.application}`);
      await row.waitFor();
      assert.match(await row.innerText(), /Browser hired engagement/);
      assert.match(await row.innerText(), /Hired/);
      assert.match(await row.innerText(), /Paperwork pending/);
      if (who === "talent") await page.getByText("Messaging is optional. Use it for urgent matters or when you need to reach your client.", { exact: true }).waitFor();
      await page.getByTestId(`button-message-contact-${hire.application}`).click();
      await page.waitForURL(/\/messages\/[a-zA-Z0-9-]+$/);
      await page.getByTestId("button-view-messaging-policy").waitFor();
    }
    assert.equal(clientPage.url(), talentPage.url());
    const expectedThread = clientPage.url();
    await talentPage.goto(base + "/my-applications");
    await talentPage.getByTestId(`button-message-client-${hire.application}`).click();
    await talentPage.waitForURL(/\/messages\/[a-zA-Z0-9-]+$/);
    assert.equal(talentPage.url(), expectedThread);

    const membership = await query("SELECT organization_id FROM organization_members WHERE user_id=$1 AND status='active' LIMIT 1", [ids.client]);
    if (!membership.rows.length) {
      const org = (await query("INSERT INTO organizations(name,created_by) VALUES('Messaging Fixture Team',$1) RETURNING id", [ids.client])).rows[0].id;
      await query("INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'owner','active')", [org, ids.client]);
    }
    await clientPage.goto(base + "/clients");
    await clientPage.getByRole("button", { name: "Message", exact: true }).first().click();
    await clientPage.getByRole("dialog").getByRole("button", { name: /Browser hired engagement/ }).click();
    await clientPage.waitForURL(/\/messages\/[a-zA-Z0-9-]+$/);
    assert.equal(clientPage.url(), expectedThread);
  });
}
async function acceptPolicy(page: Page) {
  const checkbox = page.getByTestId("checkbox-messaging-policy");
  await checkbox.waitFor({ timeout: 15000 });
  await checkbox.click();
  await page.getByTestId("button-accept-messaging-policy").click();
  await checkbox.waitFor({ state: "hidden" });
}
async function eventually(check: () => Promise<boolean>) {
  for (let n = 0; n < 50; n++) { if (await check()) return; await new Promise(r => setTimeout(r, 100)); }
  assert.fail("Expected persisted asynchronous result within 5 seconds");
}
before(async () => {
  const hash = await hashPassword(password);
  for (const [key, id] of Object.entries(ids)) {
    const role = key === "otherClient" ? "client" : key === "otherTalent" ? "talent" : key;
    await query(`INSERT INTO users (id,email,role,first_name,last_name,password_hash,email_verified_at,email_verified_email)
      VALUES ($1,$2::text,$3,$4,'Fixture',$5,now(),$2::text)`, [id, `${id}@example.test`, role, key, hash]);
  }
  await query(`INSERT INTO client_profiles (user_id,company_name,contact_person,email)
    VALUES ($1,'Messaging UAT Company','Client Fixture',$2)`, [ids.client, `${ids.client}@example.test`]);
  await query(`INSERT INTO candidates
    (id,user_id,email,first_name,last_name,full_name,password_hash,email_verified_at,email_verified_email,profile_completed)
    VALUES ($1,$2,$3::text,'Applicant','Fixture','Applicant Fixture',$4,now(),$3::text,true)`,
  [candidateId, ids.talent, `${ids.talent}@example.test`, hash]);
  await query(`INSERT INTO jobs (id,client_id,title,description,category,status,approval_status,experience_level,application_method)
    VALUES ($1,$2,'TEST Messaging Role','Disposable messaging verification','Other','open','approved','intermediate','built_in_form')`,
  [jobId, ids.client]);
  await query(`INSERT INTO job_submissions
    (id,job_id,client_id,talent_id,email,first_name,last_name,status,workflow_type,initiated_by,registration_status)
    VALUES ($1,$2,$3,$4,$5,'Applicant','Fixture','new','application','talent','registered')`,
  [applicationId, jobId, ids.client, ids.talent, `${ids.talent}@example.test`]);
  const app = express(); app.use(express.json());
  server = await registerRoutes(app);
  app.use(express.static(path.resolve("dist/public")));
  app.get("*", (_req, res) => res.sendFile(path.resolve("dist/public/index.html")));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  for (const [key, id] of Object.entries(ids)) {
    const response = await api("POST", "/api/login", "anonymous", { email: `${id}@example.test`, password });
    assert.equal(response.status, 200, `Normal password login for ${key}: ${JSON.stringify(response.body)}`);
    logins[key] = response.body;
  }
  const candidateLogin = await api("POST", "/api/talent-auth/login", "anonymous", { email: `${ids.talent}@example.test`, password });
  assert.equal(candidateLogin.status, 200); candidateToken = candidateLogin.body.token;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  clientContext = await browser.newContext();
  await clientContext.addInitScript(({ login }) => {
    localStorage.setItem("onspot_jwt_token", login.token);
    localStorage.setItem("onspot_user", JSON.stringify(login.user));
  }, { login: logins.client });
  talentContext = await browser.newContext();
  await talentContext.addInitScript(({ token, candidateId, email }) => {
    localStorage.setItem("talent_profile_token", JSON.stringify({ token, candidateId, email, fullName: "Applicant Fixture" }));
  }, { token: candidateToken, candidateId, email: `${ids.talent}@example.test` });
  clientPage = await clientContext.newPage(); talentPage = await talentContext.newPage();
  clientPage.on("pageerror",error=>console.error("Authenticated Client UI error:",error.message));
}, { timeout: 60000 });
after(async () => {
  await browser?.close();
  if (server) await new Promise<void>(r => server.close(() => r()));
  await pool.end();
});

test("actual Client Job Submissions Message button: original 403 reproduced or owned application opens", { timeout: 45000 }, async () => {
  await clientPage.goto(base + "/client/job-submissions");
  const button = clientPage.getByTestId(`button-message-submission-${applicationId}`);
  try { await button.waitFor({ timeout: 20000 }); }
  catch (error) {
    await clientPage.screenshot({path:"/tmp/client-navigation-messaging-failure.png"});
    console.error("Client application page at failure:",await clientPage.locator("body").innerText());
    throw error;
  }
  let requests = 0;
  const countRequests = (request: import("playwright").Request) => {
    if (request.method() === "POST" && request.url().endsWith(`/api/applications/${applicationId}/message-thread`)) requests++;
  };
  clientPage.on("request", countRequests);
  const request = clientPage.waitForResponse(r => r.url().endsWith(`/api/applications/${applicationId}/message-thread`));
  // Same-event-loop clicks verify the synchronous guard as well as disabled UI.
  await button.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  const response = await request, body = await response.json();
  assert.equal(requests, 1, "Repeated same-task clicks must send only one API request");
  clientPage.off("request", countRequests);
  console.log(JSON.stringify({ scenario: baseline ? "original-production-route" : "fixed-production-route",
    endpoint: "POST /api/applications/:applicationId/message-thread", status: response.status(), body }));
  if (baseline) {
    assert.equal(response.status(), 403);
    await clientPage.getByText("Unable to open conversation", { exact: true }).first().waitFor();
    assert.equal((await query("SELECT count(*)::int AS n FROM message_threads")).rows[0].n, 0);
    return;
  }
  assert.equal(response.status(), 201, JSON.stringify(body)); threadId = body.threadId;
  await clientPage.waitForURL(`**/messages/${threadId}`);
  assert.deepEqual((await query("SELECT participants,job_id FROM message_threads WHERE id=$1", [threadId])).rows[0],
    { participants: [ids.client, ids.talent], job_id: jobId });
  assert.notEqual(candidateId, ids.talent);
  assert.equal((await query("SELECT count(*)::int AS n FROM message_threads WHERE job_id=$1", [jobId])).rows[0].n, 1);
});

if (!baseline) {
  test("Client sends, Talent receives/replies, history survives refresh and normal password re-login", { timeout: 60000 }, async () => {
    await acceptPolicy(clientPage);
    await clientPage.getByTestId("input-message").fill("Hello, I would like to discuss this role.");
    const sent = clientPage.waitForResponse(r => r.url().endsWith("/api/messages") && r.request().method() === "POST");
    await clientPage.getByTestId("button-send-message").click();
    assert.equal((await sent).status(), 201);
    await eventually(async () => (await query("SELECT id FROM notifications WHERE user_id=$1 AND related_id=$2 AND type='new_message'", [ids.talent, threadId])).rows.length === 1);
    await talentPage.goto(base + `/messages/${threadId}`);
    await acceptPolicy(talentPage);
    await talentPage.getByText("Hello, I would like to discuss this role.", { exact: true }).waitFor();
    await talentPage.getByTestId("input-message").fill("Thank you. I am available to discuss the position.");
    const replied = talentPage.waitForResponse(r => r.url().endsWith("/api/messages") && r.request().method() === "POST");
    await talentPage.getByTestId("button-send-message").click();
    assert.equal((await replied).status(), 201);
    await clientPage.reload();
    await clientPage.getByText("Thank you. I am available to discuss the position.", { exact: true }).waitFor();
    await talentPage.reload();
    await talentPage.getByText("Hello, I would like to discuss this role.", { exact: true }).waitFor();
    await eventually(async () => (await query("SELECT id FROM notifications WHERE user_id=$1 AND related_id=$2 AND type='new_message'", [ids.client, threadId])).rows.length === 1);
    const login = await api("POST", "/api/login", "anonymous", { email: `${ids.client}@example.test`, password });
    assert.equal(login.status, 200); logins.client = login.body;
    const history = await api("GET", `/api/message-threads/${threadId}/messages`);
    assert.equal(history.status, 200); assert.equal(history.body.length, 2);
    for (const role of ["client", "talent"]) {
      const inbox = await api("GET", "/api/me/message-threads", role);
      assert.equal(inbox.status, 200); assert.ok(inbox.body.threads.some((t: any) => t.id === threadId));
    }
    assert.equal((await open(applicationId, "talent")).body.threadId, threadId);
  });

  test("repeat/concurrent requests reuse the existing job conversation and preserve message history", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => open(applicationId, i % 2 ? "client" : "talent")));
    for (const result of results) { assert.equal(result.status, 200); assert.equal(result.body.threadId, threadId); }
    assert.equal((await query("SELECT count(*)::int AS n FROM message_threads WHERE job_id=$1", [jobId])).rows[0].n, 1);
    assert.equal((await api("GET", `/api/message-threads/${threadId}/messages`)).body.length, 2);
  });

  test("unrelated Client/Talent, anonymous, Admin and invalid application IDs cannot open or read chats", async () => {
    for (const who of ["otherClient", "otherTalent", "admin", "anonymous"]) {
      const result = await open(applicationId, who);
      assert.ok((who === "anonymous" ? [401] : [403,404]).includes(result.status), JSON.stringify(result.body));
    }
    for (const who of ["otherClient", "otherTalent"]) {
      assert.equal((await api("GET", `/api/message-threads/${threadId}/messages`, who)).status, 403);
      assert.equal((await api("POST", "/api/messages", who, { threadId, content: "Unauthorized" })).status, 403);
      const inbox = await api("GET", "/api/me/message-threads", who);
      assert.equal(inbox.body.threads.length, 0);
    }
    assert.equal((await open("not-an-application")).status, 404);
    assert.equal((await open(candidateId)).status, 404);
    assert.equal((await api("POST", "/api/message-threads", "client", { participants: [ids.client, ids.talent] })).status, 403,
      "Generic relationship endpoint remains invitation-only even after organic chat exists");
  });

  test("private shortlists and ineligible stages stay gated; missing/non-Talent account mappings fail safely", async () => {
    assert.equal((await open(await submission({ workflow: "client_shortlist", initiator: "client" }))).status, 403);
    // Other Talent has no existing thread, so this tests new-thread stage guards.
    assert.equal((await open(await submission({ talent: ids.otherTalent, status: "rejected" }))).status, 409);
    assert.equal((await open(await submission({ talent: ids.otherTalent, status: "invited", workflow: "client_invitation", initiator: "client" }))).status, 409);
    assert.equal((await open(await submission({ talent: null, email: "unregistered@example.test" }))).status, 404);
    assert.equal((await open(await submission({ talent: ids.otherClient }))).status, 404,
      "An invalid explicit participant must not fall back to the applicant email");
    assert.equal((await open(await submission({ talent: null }))).body.threadId, threadId,
      "Legacy email mapping uses a canonical Talent user ID");
  });

  test("concurrent first creation and existing direct/invitation channel reuse are idempotent", async () => {
    const fresh = await submission({ talent: ids.otherTalent, email: `${ids.otherTalent}@example.test` });
    const results = await Promise.all(Array.from({ length: 10 }, () => open(fresh)));
    assert.equal(results.filter(r => r.status === 201).length, 1);
    assert.equal(new Set(results.map(r => r.body.threadId)).size, 1);
    const anotherJob = randomUUID();
    await query(`INSERT INTO jobs (id,client_id,title,description,category,status,experience_level)
      VALUES ($1,$2,'Another Test Role','Fixture only','Other','open','intermediate')`, [anotherJob, ids.otherClient]);
    const invited = await submission({ workflow: "client_invitation", initiator: "client" });
    assert.equal((await open(invited)).body.threadId, threadId);
    const direct = await query(`INSERT INTO message_threads (participants,job_id,subject)
      VALUES (ARRAY[$1,$2]::text[],NULL,'Existing direct history') RETURNING id`, [ids.otherClient, ids.talent]);
    const otherApplication = randomUUID();
    await query(`INSERT INTO job_submissions (id,job_id,client_id,talent_id,email,status,workflow_type,initiated_by)
      VALUES ($1,$2,$3,$4,$5,'new','application','talent')`, [otherApplication, anotherJob, ids.otherClient, ids.talent, `${ids.talent}@example.test`]);
    assert.equal((await open(otherApplication, "otherClient")).body.threadId, direct.rows[0].id);
  });

  test("a stage change while creation is waiting cannot open a stale conversation", { timeout: 15000 }, async () => {
    const roleId = randomUUID(), application = await submission();
    await query(`INSERT INTO jobs (id,client_id,title,description,category,status,experience_level)
      VALUES ($1,$2,'Stage Race Fixture','Fixture only','Other','open','intermediate')`, [roleId, ids.client]);
    await query("UPDATE job_submissions SET job_id=$1 WHERE id=$2", [roleId, application]);
    const blocker = await pool.connect();
    let opening: ReturnType<typeof open> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || $3))", [ids.client, ids.talent, roleId]);
      opening = open(application);
      await eventually(async () => (await query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows.length > 0);
      await query("UPDATE job_submissions SET status='rejected' WHERE id=$1", [application]);
      await blocker.query("COMMIT");
      assert.equal((await opening).status, 409);
      assert.equal((await query("SELECT id FROM message_threads WHERE job_id=$1", [roleId])).rows.length, 0);
    } finally {
      await blocker.query("ROLLBACK").catch(() => {});
      blocker.release();
      await opening?.catch(() => {});
    }
  });

  test("database insert failure rolls back and frontend rejects empty/failed conversation responses", { timeout: 45000 }, async () => {
    const thirdJob = randomUUID(), application = await submission();
    await query(`INSERT INTO jobs (id,client_id,title,description,category,status,experience_level)
      VALUES ($1,$2,'Failure Fixture','Fixture only','Other','open','intermediate')`, [thirdJob, ids.client]);
    await query("UPDATE job_submissions SET job_id=$1 WHERE id=$2", [thirdJob, application]);
    await query(`CREATE FUNCTION fixture_deny_thread_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Fixture insert failure'; END$$`);
    await query(`CREATE TRIGGER fixture_deny_thread BEFORE INSERT ON message_threads FOR EACH ROW EXECUTE FUNCTION fixture_deny_thread_insert()`);
    try {
      assert.equal((await open(application)).status, 500);
      assert.equal((await query("SELECT id FROM message_threads WHERE job_id=$1", [thirdJob])).rows.length, 0);
    } finally {
      await query("DROP TRIGGER fixture_deny_thread ON message_threads");
      await query("DROP FUNCTION fixture_deny_thread_insert()");
    }
    await clientPage.route(`**/api/applications/*/message-thread`, route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await clientPage.goto(base + "/client/job-submissions");
    await clientPage.locator('[data-testid^="button-message-submission-"]').first().click();
    await clientPage.getByText("The conversation could not be opened. Please try again.", { exact: true }).first().waitFor();
    assert.ok(clientPage.url().endsWith("/client/job-submissions"));
    await clientPage.unroute(`**/api/applications/*/message-thread`);
  });
}

if (!baseline) registerHiredContactTests();
