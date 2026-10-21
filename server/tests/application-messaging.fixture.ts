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
async function submission(values: { talent?: string | null; email?: string; status?: string; workflow?: string; initiator?: string } = {}) {
  const id = randomUUID();
  await query(`INSERT INTO job_submissions
    (id,job_id,client_id,talent_id,email,first_name,last_name,status,workflow_type,initiated_by,registration_status)
    VALUES ($1,$2,$3,$4,$5,'Applicant','Fixture',$6,$7,$8,'registered')`,
  [id, jobId, ids.client, values.talent === undefined ? ids.talent : values.talent,
    values.email || `${ids.talent}@example.test`, values.status || "new", values.workflow || "application", values.initiator || "talent"]);
  return id;
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
}, { timeout: 60000 });
after(async () => {
  await browser?.close();
  if (server) await new Promise<void>(r => server.close(() => r()));
  await pool.end();
});

test("actual Client Job Submissions Message button: original 403 reproduced or owned application opens", { timeout: 45000 }, async () => {
  await clientPage.goto(base + "/client-profile");
  const button = clientPage.getByRole("button", { name: "Message", exact: true }).first();
  await button.waitFor({ timeout: 20000 });
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
      assert.equal(result.status, who === "anonymous" ? 401 : 403, JSON.stringify(result.body));
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
    await clientPage.goto(base + "/client-profile");
    await clientPage.getByRole("button", { name: "Message", exact: true }).first().click();
    await clientPage.getByText("The conversation could not be opened. Please try again.", { exact: true }).first().waitFor();
    assert.ok(clientPage.url().endsWith("/client-profile"));
    await clientPage.unroute(`**/api/applications/*/message-thread`);
  });
}
