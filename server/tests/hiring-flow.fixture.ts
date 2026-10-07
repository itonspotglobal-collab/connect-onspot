import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";
import jwt from "jsonwebtoken";
import { pool, query } from "./fixtures/hiring-db";
import * as guard from "../services/formalPipelineGuard";
import * as times from "../lib/interviewTime";
import * as calendar from "../services/findWorkCalendarService";
import * as emails from "../services/interviewEmailService";
import * as graphEmail from "../services/microsoftGraphEmailService";
import * as templates from "../services/emailVariableResolver";
import * as currency from "../../shared/currency";
import { storage } from "../storage";
import { escHtml } from "../lib/escHtml";
import { filterMessageContent } from "../lib/piiPatterns";
import { createHiringContract, updateHiringContract } from "../services/hiringContractService";
import * as applicationNotifications from "../services/applicationNotificationService";
import { sendClientNewApplicationEmail } from "../services/emailCompanionService";
import { extendOfferExpiration } from "../services/offerExpirationService";
import { isActionableOffer, isOfferExpired } from "../../shared/offerState";

const suffix = randomUUID();
const client = `hiring-client-${suffix}`, other = `hiring-other-${suffix}`;
const admin = `hiring-admin-${suffix}`, talent = `hiring-talent-${suffix}`;
const candidate = `hiring-candidate-${suffix}`, job = `hiring-job-${suffix}`;
const talentEmail = `talent.${suffix}@fixture.example`;
const source = ts.createSourceFile("routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
const actualFetch = globalThis.fetch;
const requests: Array<{ url: string; method: string; body: any }> = [];
const remoteEvents = new Map<string, any>();
const transactionIds = new Map<string, string>();
let rejectCreation = false;
let loseCreationResponse = false;
let mailboxDenied = false;
let remoteBusy = false;
const instant = "2032-08-22T09:00:00.000Z";
const slot = { start: instant, end: "2032-08-22T10:00:00.000Z", timezone: "Asia/Singapore" };

function declaration(name: string): string {
  let text = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) text = node.getText(source);
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) text = `const ${node.getText(source)};`;
    ts.forEachChild(node, visit);
  }
  visit(source);
  return text;
}

function handler(method: string, path: string): any {
  let text = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === `app.${method}` &&
        ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) text = node.arguments.at(-1)!.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(text, `Real handler missing: ${method} ${path}`);
  const dependencies: Record<string, any> = {
    pool, query, storage, jwt, escHtml, filterMessageContent, ...guard, ...times, ...calendar, ...emails, ...currency,
    ...applicationNotifications, sendClientNewApplicationEmail,
    require: (name: string) => {
      if (name.includes("microsoftGraphEmailService")) return graphEmail;
      if (name.includes("emailVariableResolver")) return templates;
      throw new Error(`Unexpected dynamic dependency: ${name}`);
    },
  };
  const script = `${declaration("normalizeMeetingLink")}\n${declaration("loadTalentOwnedOffer")}\n${declaration("fireAutoApplicationEmail")}\n${declaration("fireInvitationEmail")}\nreturn (${text});`;
  const compiled = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
}

async function invoke(method: string, path: string, body: any, actor = client, params: any = {}, extra: any = {}) {
  const response = {
    statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
  };
  const req = {
    body, params, query: {}, headers: {}, user: { id: actor },
    talentAuth: { candidateId: candidate }, protocol: "https", get: () => "fixture.test", ...extra,
  };
  await handler(method, path)(req, response);
  return response;
}

async function submission(workflow: "application" | "client_invitation", status = "reviewed") {
  const result = await query(
    `INSERT INTO job_submissions (job_id, client_id, talent_id, email, applicant_name,
       workflow_type, initiated_by, registration_status, status)
     VALUES ($1,$2,$3,$4,'Fixture Talent',$5,$6,'linked',$7) RETURNING id`,
    [job, client, talent, talentEmail, workflow, workflow === "application" ? "talent" : "client", status],
  );
  return result.rows[0].id;
}

before(async () => {
  // All values are test-only; do not read/override real credentials or databases.
  process.env.MICROSOFT_TENANT_ID = "fixture-tenant";
  process.env.MICROSOFT_CLIENT_ID = "fixture-app";
  process.env.MICROSOFT_CLIENT_SECRET = "fixture-secret";
  process.env.MICROSOFT_FINDWORK_MAILBOX = "shared-findwork@fixture.example";
  process.env.APPLICATION_EMAIL_FROM = "careers@fixture.example";
  process.env.JWT_SECRET = "fixture-signing-key";
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith("https://login.microsoftonline.com/")) {
      return new Response(JSON.stringify({ access_token: "fixture-graph-token", expires_in: 3600 }), { status: 200 });
    }
    assert.ok(url.startsWith("https://graph.microsoft.com/"), "No non-Graph external requests are permitted");
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const method = init.method || "GET";
    requests.push({ url, method, body });
    if (mailboxDenied) return new Response("{}", { status: 403 });
    if (url.includes("/sendMail")) return new Response(null, { status: 202 });
    if (url.includes("/calendar?")) return Response.json({ id: "shared-calendar", allowedOnlineMeetingProviders: ["teamsForBusiness"] });
    if (url.includes("/calendarView?")) {
      const parsed = new URL(url);
      const from = new Date(parsed.searchParams.get("startDateTime")!).getTime();
      const to = new Date(parsed.searchParams.get("endDateTime")!).getTime();
      const occupied = Array.from(remoteEvents.values()).filter(event =>
        new Date(`${event.start.dateTime}Z`).getTime() < to && new Date(`${event.end.dateTime}Z`).getTime() > from);
      return Response.json({ value: remoteBusy ? [{ id: "other-real-booking", showAs: "busy" }] : occupied });
    }
    if (method === "POST" && url.endsWith("/events")) {
      if (rejectCreation) return new Response("{}", { status: 503 });
      const id = transactionIds.get(body.transactionId) || randomUUID();
      transactionIds.set(body.transactionId, id);
      const event = { ...body, id, onlineMeeting: { joinUrl: "https://teams.microsoft.com/fixture-meeting" } };
      remoteEvents.set(id, event);
      if (loseCreationResponse) throw new Error("Fixture network failure after Outlook saved the event");
      return Response.json(event, { status: 201 });
    }
    if (method === "PATCH" && url.includes("/events/")) {
      const id = decodeURIComponent(url.split("/events/")[1]);
      assert.ok(remoteEvents.has(id));
      const event = { ...remoteEvents.get(id), ...body, id };
      remoteEvents.set(id, event);
      return Response.json(event);
    }
    if (method === "DELETE" && url.includes("/events/")) {
      remoteEvents.delete(decodeURIComponent(url.split("/events/")[1]));
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected Graph fixture operation: ${method}`);
  };
  for (const [id, role, email] of [
    [client, "client", `client.${suffix}@fixture.example`], [other, "client", `other.${suffix}@fixture.example`],
    [admin, "admin", `admin.${suffix}@fixture.example`], [talent, "talent", talentEmail],
  ]) {
    await query(`INSERT INTO users (id,email,role,password_hash,first_name,last_name) VALUES ($1,$2,$3,'fixture-not-a-login-hash','Fixture','Account')`, [id, email, role]);
  }
  await query(`INSERT INTO candidates (id,user_id,email,full_name) VALUES ($1,$2,$3,'Fixture Talent')`, [candidate, talent, talentEmail]);
  await query(`INSERT INTO jobs (id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES ($1,$2,'Fixture Client Job','Disposable test job','Operations','Intermediate','open','approved','Standard','tracked')`, [job, client]);
  await query(readFileSync("migrations/0034_findwork_interview_calendar.sql", "utf8"));
  await query(readFileSync("migrations/0036_offer_response_contract_package.sql", "utf8"));
  // This existing runtime-managed table is not represented in Drizzle schema.
  await query(`CREATE TABLE IF NOT EXISTS platform_settings (key text PRIMARY KEY, value text)`);
});

after(async () => {
  // Allow existing asynchronous companion notifications to finish on fixture data.
  await new Promise(resolve => setTimeout(resolve, 150));
  globalThis.fetch = actualFetch;
  await pool.end();
});

test("offer review, pending counts, response ownership, expiration and renewal use real records", async () => {
  const id=await submission("application","shortlisted");
  const created=await invoke("post","/api/client/offers",{submissionId:id,rate:500,rateCurrency:"USD",proposedStartDate:"2032-09-01",expiresAt:"2032-09-01T00:00:00Z"});
  assert.equal(created.statusCode,201,JSON.stringify(created.body));
  const offerId=created.body.id;
  const listed=await invoke("get","/api/talent/offers",{},talent);
  assert.equal(listed.statusCode,200);
  assert.ok(listed.body.some((o:any)=>o.id===offerId && isActionableOffer(o)));
  assert.equal((await invoke("get","/api/talent/offers/:id",{},talent,{id:offerId})).statusCode,200);
  const foreign=await invoke("patch","/api/talent/offers/:id/respond",{action:"accept"},other,{id:offerId},{talentAuth:{candidateId:"missing-other-talent"}});
  assert.equal(foreign.statusCode,404);
  await query("UPDATE offers SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[offerId]);
  const expired=await invoke("get","/api/talent/offers",{},talent);
  const record=expired.body.find((o:any)=>o.id===offerId);
  assert.equal(isOfferExpired(record),true);
  assert.equal(isActionableOffer(record),false);
  assert.equal((await invoke("patch","/api/talent/offers/:id/respond",{action:"accept"},talent,{id:offerId})).statusCode,409);
  await assert.rejects(extendOfferExpiration(offerId,other,"2032-10-01T00:00:00Z"));
  await extendOfferExpiration(offerId,client,"2032-10-01T00:00:00Z");
  assert.equal((await query("SELECT count(*)::int AS count FROM offer_expiration_history WHERE offer_id=$1",[offerId])).rows[0].count,1);
  const accepted=await invoke("patch","/api/talent/offers/:id/respond",{action:"accept"},talent,{id:offerId});
  assert.equal(accepted.statusCode,200,JSON.stringify(accepted.body));
  const saved=(await query("SELECT status,accepted_at,responded_by FROM offers WHERE id=$1",[offerId])).rows[0];
  assert.equal(saved.status,"accepted"); assert.ok(saved.accepted_at); assert.equal(saved.responded_by,talent);
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1",[id])).rows[0].status,"offer_accepted");
  assert.equal((await invoke("patch","/api/talent/offers/:id/respond",{action:"accept"},talent,{id:offerId})).statusCode,409);
  await assert.rejects(extendOfferExpiration(offerId,client,"2032-11-01T00:00:00Z"));
  const declinedId=await submission("application","shortlisted");
  const declinedOffer=await invoke("post","/api/client/offers",{submissionId:declinedId,rate:500,rateCurrency:"USD",proposedStartDate:"2032-09-01",expiresAt:"2032-10-01T00:00:00Z"});
  const declined=await invoke("patch","/api/talent/offers/:id/respond",{action:"decline"},talent,{id:declinedOffer.body.id});
  assert.equal(declined.statusCode,200);
  assert.ok((await query("SELECT declined_at FROM offers WHERE id=$1",[declinedOffer.body.id])).rows[0].declined_at);
  assert.equal((await invoke("patch","/api/talent/offers/:id/respond",{action:"accept"},talent,{id:declinedOffer.body.id})).statusCode,409);
  await assert.rejects(createHiringContract({offerId:declinedOffer.body.id,adminId:admin}));
});
test("both entry paths qualify; silent, unlinked, forged, rejected and withdrawn submissions do not", async () => {
  for (const workflow of ["application", "client_invitation"] as const) {
    const id = await submission(workflow);
    assert.equal((await guard.loadClientFormalSubmission(id, client)).ok, true);
    assert.equal((await guard.loadClientFormalSubmission(id, other)).ok, false);
    assert.equal((await guard.loadAdminFormalSubmission(id)).ok, true);
    await query(`UPDATE job_submissions SET status='rejected' WHERE id=$1`, [id]);
    assert.equal((await guard.loadAdminFormalSubmission(id)).ok, false);
    await query(`UPDATE job_submissions SET status='withdrawn' WHERE id=$1`, [id]);
    assert.equal((await guard.loadClientFormalSubmission(id, client)).ok, false);
  }
  const id = await submission("application");
  for (const patch of ["workflow_type='client_shortlist'", "workflow_type='application',registration_status='pending_account'", "registration_status='linked',client_id=$2"]) {
    await query(`UPDATE job_submissions SET ${patch} WHERE id=$1`, patch.includes("$2") ? [id, other] : [id]);
    assert.equal((await guard.loadAdminFormalSubmission(id)).ok, false);
  }
  assert.equal((await guard.loadClientFormalSubmission(randomUUID(), client)).ok, false);
});

for (const workflow of ["application", "client_invitation"] as const) {
  test(`${workflow}: Client interview → offer → Talent acceptance → contract; other Client cannot access`, async () => {
    let id: string;
    if (workflow === "application") {
      const token = jwt.sign({ type: "candidate", candidateId: candidate, email: talentEmail }, process.env.JWT_SECRET!);
      const applied = await invoke("post", "/api/jobs/:jobId/apply",
        { firstName: "Fixture", lastName: "Talent", email: talentEmail, phone: "+10000000000" },
        talent, { jobId: job }, { headers: { authorization: `Bearer ${token}` } });
      assert.ok(applied.statusCode >= 200 && applied.statusCode < 300, JSON.stringify(applied.body));
      const saved = await query(`SELECT id FROM job_submissions WHERE talent_id=$1 AND job_id=$2 AND status='new' ORDER BY submitted_at DESC LIMIT 1`, [talent, job]);
      id = saved.rows[0].id;
      // Review is fixture preparation; hiring mutations below use real handlers.
      await query(`UPDATE job_submissions SET status='reviewed' WHERE id=$1`, [id]);
    } else {
      const invitationJob = `${job}-invitation`;
      await query(`INSERT INTO jobs (id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
        SELECT $1,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode
          FROM jobs WHERE id=$2`, [invitationJob, job]);
      const invited = await invoke("post", "/api/client/invitations",
        { jobId: invitationJob, talentUserId: talent, proposedTimes: [slot] });
      assert.equal(invited.statusCode, 201, JSON.stringify(invited.body));
      const saved = await query(`SELECT id FROM job_submissions WHERE job_id=$1 AND talent_id=$2 AND workflow_type='client_invitation'`, [invitationJob, talent]);
      id = saved.rows[0].id;
      const accepted = await invoke("post", "/api/talent/invitations/:id/respond", { action: "accept" }, talent, { id });
      assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
      assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1", [id])).rows[0].status, "new");
      await query("UPDATE job_submissions SET status='reviewed' WHERE id=$1", [id]);
    }
    let result = await invoke("post", "/api/client/interviews", { submissionId: id, proposedTimes: [slot], durationMinutes: 60 }, other);
    assert.equal(result.statusCode, 404);
    result = await invoke("post", "/api/client/interviews", { submissionId: id, proposedTimes: [slot], durationMinutes: 60 });
    assert.equal(result.statusCode, 201, JSON.stringify(result.body));
    const interviewId = result.body.id;
    result = await invoke("get", "/api/client/interviews", {}, other, {}, { query: { submissionId: id } });
    assert.equal(result.statusCode, 404);
    result = await invoke("patch", "/api/client/interviews/:id", { status: "confirmed", confirmedTime: instant }, other, { id: interviewId });
    assert.equal(result.statusCode, 404);
    const outcome = await invoke("patch", "/api/client/interviews/:id/outcome", { outcome: "advance" }, client, { id: interviewId });
    assert.equal(outcome.statusCode, 200, JSON.stringify(outcome.body));
    const repeatedOutcome = await invoke("patch", "/api/client/interviews/:id/outcome", { outcome: "advance" }, client, { id: interviewId });
    assert.equal(repeatedOutcome.statusCode, 409);
    result = await invoke("post", "/api/client/offers", { submissionId: id, rate: 1500, rateCurrency: "USD", proposedStartDate: "2032-09-01", expiresAt: "2032-09-01T00:00:00Z" }, other);
    assert.equal(result.statusCode, 404);
    result = await invoke("post", "/api/client/offers", { submissionId: id, rate: 1500, rateCurrency: "USD", proposedStartDate: "2032-09-01", expiresAt: "2032-09-01T00:00:00Z" });
    assert.equal(result.statusCode, 201, JSON.stringify(result.body));
    const offerId = result.body.id;
    result = await invoke("get", "/api/client/offers", {}, other, {}, { query: { submissionId: id } });
    assert.equal(result.statusCode, 404);
    result = await invoke("post", "/api/client/offers", { submissionId: id, rate: 1500 });
    assert.equal(result.statusCode, 409);
    result = await invoke("patch", "/api/talent/offers/:id/respond", { action: "accept" }, talent, { id: offerId });
    assert.equal(result.statusCode, 200, JSON.stringify(result.body));
    const contract = await createHiringContract({ offerId, adminId: admin, templateRef: "fixture-agreement" });
    assert.equal(contract.status, "sent");
    assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1", [id])).rows[0].status, "contract_sent");
    await assert.rejects(updateHiringContract(contract.id, { actorRole: "admin", adminId: admin, talentSigned: true }), /talent_signature_forbidden/);
    await updateHiringContract(contract.id, { actorRole: "talent", talentSigned: true });
    assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1", [id])).rows[0].status, "contract_sent");
    const signed = await updateHiringContract(contract.id, { actorRole: "admin", adminId: admin, onspotSigned: true });
    assert.equal(signed.status, "signed");
    assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1", [id])).rows[0].status, "hired");
    const terminalOutcome = await invoke("patch", "/api/client/interviews/:id/outcome", { outcome: "reject" }, client, { id: interviewId });
    assert.equal(terminalOutcome.statusCode, 409);
    assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1", [id])).rows[0].status, "hired");
    const blocked = await invoke("post", "/api/client/offers", { submissionId: id, rate: 1500 });
    assert.equal(blocked.statusCode, 409);
    await query(`UPDATE interviews SET status='rescheduled', current_proposal_owner='client' WHERE id=$1`, [interviewId]);
    const terminalInterview = await invoke("patch", "/api/client/interviews/:id",
      { status: "confirmed", confirmedTime: instant, confirmedTimeZone: slot.timezone }, client, { id: interviewId });
    assert.equal(terminalInterview.statusCode, 409, JSON.stringify(terminalInterview.body));
    assert.equal(terminalInterview.body.error, "submission_not_interviewable");
    assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1", [id])).rows[0].status, "hired");
  });
}

test("Admin direct confirmation uses shared mailbox, real account attendee, UTC instants and persisted event ID", async () => {
  const id = await submission("application");
  const result = await invoke("post", "/api/admin/interviews", { submissionId: id, proposedTimes: [slot], confirmedTime: instant, confirmedTimeZone: slot.timezone, durationMinutes: 60 }, admin);
  assert.equal(result.statusCode, 201, JSON.stringify(result.body));
  assert.equal(result.body.status, "confirmed");
  assert.ok(result.body.calendar_event_id);
  const event = remoteEvents.get(result.body.calendar_event_id);
  assert.equal(event.start.dateTime, "2032-08-22T09:00:00.000");
  assert.equal(event.start.timeZone, "UTC");
  assert.equal(event.end.dateTime, "2032-08-22T10:00:00.000");
  assert.ok(event.attendees.some((attendee: any) => attendee.emailAddress.address === talentEmail));
  assert.equal(event.isOnlineMeeting, true);
  assert.equal(result.body.meeting_link, event.onlineMeeting.joinUrl);
  assert.ok(requests.some(request => request.method === "POST" && request.url.includes("/users/shared-findwork%40fixture.example/events")));
  const count = remoteEvents.size;
  const retry = await invoke("post", "/api/admin/interviews", { submissionId: id, proposedTimes: [slot], confirmedTime: instant, durationMinutes: 60 }, admin);
  assert.equal(retry.statusCode, 409);
  assert.equal(remoteEvents.size, count);
});

test("Graph failure rolls back confirmation, proposal history and status; retry creates one event", async () => {
  const id = await submission("application");
  const later = { ...slot, start: "2032-08-23T09:00:00.000Z", end: "2032-08-23T10:00:00.000Z" };
  rejectCreation = true;
  let result = await invoke("post", "/api/admin/interviews", { submissionId: id, proposedTimes: [later], confirmedTime: later.start, durationMinutes: 60 }, admin);
  assert.equal(result.statusCode, 502, JSON.stringify(result.body));
  assert.equal((await query("SELECT status FROM job_submissions WHERE id=$1", [id])).rows[0].status, "reviewed");
  assert.equal((await query("SELECT id FROM interviews WHERE submission_id=$1", [id])).rows.length, 0);
  const attempted = requests.filter(request => request.method === "POST" && request.url.endsWith("/events")).at(-1)!.body.transactionId;
  rejectCreation = false;
  result = await invoke("post", "/api/admin/interviews", { submissionId: id, proposedTimes: [later], confirmedTime: later.start, durationMinutes: 60 }, admin);
  assert.equal(result.statusCode, 201, JSON.stringify(result.body));
  assert.equal(requests.filter(request => request.method === "POST" && request.url.endsWith("/events")).at(-1)!.body.transactionId, attempted);
});

test("Talent chooses an Admin proposal; Graph failure leaves it pending and successful retry persists one calendar event", async () => {
  const id = await submission("client_invitation");
  const later = { ...slot, start: "2032-08-24T09:00:00.000Z", end: "2032-08-24T10:00:00.000Z" };
  const created = await invoke("post", "/api/admin/interviews", { submissionId: id, proposedTimes: [later], durationMinutes: 60 }, admin);
  assert.equal(created.statusCode, 201, JSON.stringify(created.body));
  assert.equal(created.body.status, "proposed");
  assert.equal(created.body.calendar_event_id, null);
  rejectCreation = true;
  let result = await invoke("patch", "/api/talent/interviews/:id/respond", { action: "accept", selectedTime: later.start }, talent, { id: created.body.id });
  assert.equal(result.statusCode, 502);
  assert.equal((await query("SELECT status FROM interviews WHERE id=$1", [created.body.id])).rows[0].status, "proposed");
  rejectCreation = false;
  result = await invoke("patch", "/api/talent/interviews/:id/respond", { action: "accept", selectedTime: later.start }, talent, { id: created.body.id });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  assert.equal(result.body.status, "confirmed");
  assert.ok(result.body.calendar_event_id);
  assert.equal(result.body.confirmed_time_zone, slot.timezone);
  const count = remoteEvents.size;
  result = await invoke("patch", "/api/talent/interviews/:id/respond", { action: "accept", selectedTime: later.start }, talent, { id: created.body.id });
  assert.equal(result.statusCode, 409);
  assert.equal(remoteEvents.size, count);
});

test("calendar permission and shared-busy failures are explicit and never save confirmed interviews", async () => {
  const id = await submission("application");
  const later = { ...slot, start: "2032-08-25T09:00:00.000Z", end: "2032-08-25T10:00:00.000Z" };
  mailboxDenied = true;
  let result = await invoke("post", "/api/admin/interviews", { submissionId: id, proposedTimes: [later], confirmedTime: later.start }, admin);
  assert.equal(result.body.error, "mailbox_inaccessible");
  mailboxDenied = false;
  remoteBusy = true;
  result = await invoke("post", "/api/admin/interviews", { submissionId: id, proposedTimes: [later], confirmedTime: later.start }, admin);
  assert.equal(result.statusCode, 409);
  assert.equal(result.body.error, "calendar_time_conflict");
  remoteBusy = false;
  assert.equal((await query("SELECT id FROM interviews WHERE submission_id=$1", [id])).rows.length, 0);
});

test("calendar configuration reuses existing FindWork sender, never generic Careers or personal Admin mail", () => {
  const env = { MICROSOFT_TENANT_ID: "test", MICROSOFT_CLIENT_ID: "test", MICROSOFT_CLIENT_SECRET: "test", TALENT_VERIFICATION_EMAIL_FROM: "configured-shared@fixture.example" };
  assert.equal(calendar.findWorkMailbox(env), env.TALENT_VERIFICATION_EMAIL_FROM);
  assert.throws(() => calendar.findWorkMailbox({ ...env, TALENT_VERIFICATION_EMAIL_FROM: "", MICROSOFT_SENDER_EMAIL: "personal@fixture.example" }), calendar.FindWorkCalendarError);
});

test("a lost Outlook creation response is recovered on retry without a second invitation event", async () => {
  const id = await submission("application");
  const later = { ...slot, start: "2032-08-26T09:00:00.000Z", end: "2032-08-26T10:00:00.000Z" };
  const body = { submissionId: id, proposedTimes: [later], confirmedTime: later.start };
  const before = remoteEvents.size;
  loseCreationResponse = true;
  let result = await invoke("post", "/api/admin/interviews", body, admin);
  assert.equal(result.statusCode, 502);
  assert.equal(remoteEvents.size, before + 1);
  assert.equal((await query("SELECT id FROM interviews WHERE submission_id=$1", [id])).rows.length, 0);
  loseCreationResponse = false;
  result = await invoke("post", "/api/admin/interviews", body, admin);
  assert.equal(result.statusCode, 201, JSON.stringify(result.body));
  assert.equal(remoteEvents.size, before + 1);
  assert.ok(result.body.calendar_event_id);
});

test("draft, unapproved and scaffold jobs cannot promote organic applications", async () => {
  const id = await submission("application");
  for (const changed of ["status='draft'", "status='open',approval_status='pending'", "approval_status='approved',created_via='search_scaffold'"]) {
    await query(`UPDATE jobs SET ${changed} WHERE id=$1`, [job]);
    assert.equal((await guard.loadClientFormalSubmission(id, client)).ok, false);
    const response = await invoke("post", "/api/client/interviews", { submissionId: id, proposedTimes: [slot] });
    assert.equal(response.statusCode, 404);
  }
  await query(`UPDATE jobs SET status='open',approval_status='approved',created_via='manual' WHERE id=$1`, [job]);
});
