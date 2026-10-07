import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { query, registerRoutes, initializeFixture, closeFixture } from "./fixtures/timesheetServer";
import { validWorkTimezone } from "../../shared/workTimezone";
import { createClientTeamDashboardHandler } from "../lib/clientTeamDashboardHandler";

let server: Awaited<ReturnType<typeof registerRoutes>>;
let base: string;
let contract: string;
let otherContract: string;
let unsigned: string;
let inactive: string;
let guaranteed: string;
let future: string;
let periodId: string;
let sessionId: string;
let start: string;
const token = (id: string, role: string) => jwt.sign({ userId: id, role },
  process.env.JWT_SECRET || "fixture-only", { expiresIn: "1h" });
const talent = token("clock-talent", "talent");
const otherTalent = token("other-talent", "talent");
const client = token("clock-client", "client");
const otherClient = token("other-client", "client");
async function request(method: string, path: string, body?: unknown, auth = talent) {
  const response = await fetch(base + path, { method, headers: {
    Authorization: `Bearer ${auth}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() as any };
}
async function makeContract(owner: string, status = "signed", billing = "tracked", startDate?: string) {
  const job = (await query(`INSERT INTO jobs (client_id, title, status, billing_mode, time_zone)
    VALUES ('clock-client', 'Website Developer', 'open', $1, NULL) RETURNING id`, [billing])).rows[0].id;
  const submission = (await query(`INSERT INTO job_submissions
    (job_id, client_id, talent_id, applicant_name, status, initiated_by, workflow_type)
    VALUES ($1, 'clock-client', $2, 'Fixture Talent', 'hired', 'client', 'client_invitation') RETURNING id`,
    [job, owner])).rows[0].id;
  const offer = (await query(`INSERT INTO offers (submission_id, status, billing_mode, rate, rate_currency, engagement_type)
    VALUES ($1, 'accepted', $2, 1000, 'USD', 'Standard') RETURNING id`, [submission, billing])).rows[0].id;
  return (await query(`INSERT INTO hiring_contracts
    (offer_id, submission_id, status, billing_mode, talent_signed_at, onspot_signed_at, effective_start_date)
    VALUES ($1, $2, $3, $4, $5, $5, $6) RETURNING id`,
    [offer, submission, status, billing, status === "sent" ? null : new Date(), startDate ?? null])).rows[0].id;
}
before(async () => {
  await initializeFixture();
  await query(`INSERT INTO users (id, email, role, first_name, company) VALUES
    ('clock-client', 'client@fixture.test', 'client', 'Casey', 'Testing workspace'),
    ('other-client', 'other-client@fixture.test', 'client', 'Other', NULL),
    ('clock-talent', 'talent@fixture.test', 'talent', 'Alex', NULL),
    ('other-talent', 'other@fixture.test', 'talent', 'Other', NULL)`);
  contract = await makeContract("clock-talent");
  otherContract = await makeContract("other-talent");
  unsigned = await makeContract("clock-talent", "sent");
  inactive = await makeContract("clock-talent", "terminated");
  guaranteed = await makeContract("clock-talent", "signed", "guaranteed");
  future = await makeContract("clock-talent", "signed", "tracked", "2099-01-01");
  await query(`UPDATE jobs SET time_zone = 'Asia/Manila' WHERE id IN
    (SELECT js.job_id FROM job_submissions js JOIN hiring_contracts hc ON hc.submission_id = js.id WHERE hc.id <> $1)`, [contract]);
  await query("INSERT INTO organizations (id, name) VALUES ('clock-workspace', 'Testing workspace')");
  await query(`INSERT INTO organization_members (organization_id, user_id, role, status)
    VALUES ('clock-workspace', 'clock-client', 'owner', 'active')`);
  const app = express(); app.use(express.json());
  server = await registerRoutes(app);
  app.get("/fixture/client/team", (req: any, _res, next) => {
    try { req.user = { id: (jwt.verify(req.headers.authorization?.replace(/^Bearer /, ""),
      process.env.JWT_SECRET || "fixture-only") as any).userId }; next(); } catch { next(new Error("Unauthorized")); }
  }, createClientTeamDashboardHandler({ query }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeFixture();
});

test("IANA validation rejects abbreviations and accepts explicit DST regions", () => {
  for (const zone of ["PST", "EST", "CST", "UTC+08:00", "invalid/region"]) assert.equal(validWorkTimezone(zone), false);
  for (const zone of ["Asia/Manila", "America/New_York", "Europe/London", "Australia/Sydney", "UTC"]) assert.equal(validWorkTimezone(zone), true);
});
test("anonymous and Client cannot operate Talent Clock", async () => {
  assert.equal((await request("GET", "/api/talent/clock", undefined, "")).status, 401);
  assert.equal((await request("GET", "/api/talent/clock", undefined, client)).status, 403);
});
test("unsigned, inactive, future and Guaranteed contracts reject Clock In", async () => {
  for (const id of [unsigned, inactive, guaranteed, future]) {
    assert.equal((await request("POST", "/api/talent/clock/in", { hiringContractId: id })).status, 409);
  }
  assert.equal(Number((await query("SELECT count(*) AS count FROM clock_sessions")).rows[0].count), 0);
});
test("cross-Talent contract and timezone access rejected", async () => {
  assert.equal((await request("POST", "/api/talent/clock/in", { hiringContractId: otherContract })).status, 409);
  assert.equal((await request("PUT", "/api/talent/clock/timezone", { hiringContractId: otherContract, workTimezone: "Asia/Manila" })).status, 404);
});
test("timezone is explicit and persists across API reload", async () => {
  assert.equal((await request("POST", "/api/talent/clock/in", { hiringContractId: contract })).status, 409);
  assert.equal((await request("PUT", "/api/talent/clock/timezone", { hiringContractId: contract, workTimezone: "PST" })).status, 422);
  assert.equal((await request("PUT", "/api/talent/clock/timezone", { hiringContractId: contract, workTimezone: "Asia/Manila" })).status, 200);
  const state = await request("GET", "/api/talent/clock");
  assert.equal(state.json.contracts.find((item: any) => item.id === contract).workTimezone, "Asia/Manila");
  assert.equal((await query("SELECT work_timezone FROM hiring_contracts WHERE id = $1", [contract])).rows[0].work_timezone, "Asia/Manila");
  assert.ok(Number.isFinite(Date.parse(state.json.serverNow)));
});
test("concurrent duplicate Clock In creates exactly one server-timestamped session", async () => {
  const before = Date.now();
  const responses = await Promise.all([1, 2].map(() => request("POST", "/api/talent/clock/in", {
    hiringContractId: contract, startedAt: "1999-01-01T00:00:00Z",
  })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const session = responses.find((response) => response.status === 201)!.json;
  sessionId = session.id; start = session.startedAt;
  assert.ok(Date.parse(start) >= before - 1000);
  assert.equal(session.workTimezone, "Asia/Manila");
  assert.equal(Number((await query("SELECT count(*) AS count FROM clock_sessions WHERE ended_at IS NULL")).rows[0].count), 1);
});
test("active session recovers with unchanged persisted identity/start and timezone freezes", async () => {
  const state = await request("GET", "/api/talent/clock");
  assert.equal(state.json.activeSession.id, sessionId);
  assert.equal(state.json.activeSession.startedAt, start);
  assert.equal(state.json.contracts.find((item: any) => item.id === contract).timezoneLocked, true);
  assert.equal((await request("PUT", "/api/talent/clock/timezone", { hiringContractId: contract, workTimezone: "America/New_York" })).status, 409);
  assert.equal((await request("PUT", "/api/talent/clock/timezone", { hiringContractId: contract, workTimezone: "Asia/Manila" })).status, 200);
});
test("open sessions display separately, do not add hours, and prevent submission", async () => {
  const sheet = await request("GET", "/api/talent/timesheets");
  const period = sheet.json.periods.find((row: any) => row.hiringContractId === contract);
  periodId = period.id;
  assert.equal(period.activeSession.id, sessionId);
  assert.equal(period.activeSession.startedAt, start);
  assert.equal(period.sessions.length, 0);
  assert.equal(period.totalHours, 0);
  assert.equal((await request("POST", `/api/talent/timesheets/${periodId}/submit`, {})).status, 409);
  assert.equal((await query("SELECT status FROM timesheet_periods WHERE id = $1", [periodId])).rows[0].status, "open");
});
test("another Talent cannot close or submit this Talent's work", async () => {
  assert.equal((await request("POST", "/api/talent/clock/out", {}, otherTalent)).status, 409);
  assert.equal((await request("POST", `/api/talent/timesheets/${periodId}/submit`, {}, otherTalent)).status, 404);
  assert.equal((await query("SELECT ended_at FROM clock_sessions WHERE id = $1", [sessionId])).rows[0].ended_at, null);
});
test("Clock Out captures server end and exact canonical duration", async () => {
  await new Promise((resolve) => setTimeout(resolve, 350));
  const out = await request("POST", "/api/talent/clock/out", { endedAt: "2099-01-01T00:00:00Z", sessionId: "untrusted-id" });
  assert.equal(out.status, 200); assert.equal(out.json.id, sessionId);
  assert.equal(out.json.status, "completed");
  assert.ok(Date.parse(out.json.endedAt) <= Date.now());
  assert.equal(out.json.durationSeconds, (Date.parse(out.json.endedAt) - Date.parse(start)) / 1000);
  assert.equal((await request("GET", "/api/talent/clock")).json.activeSession, null);
});
test("completed canonical sessions and server totals are shared by Talent and hiring Client", async () => {
  await query(`INSERT INTO clock_sessions (hiring_contract_id, talent_id, started_at, ended_at)
    VALUES ($1, 'clock-talent', now() - interval '85 minutes', now())`, [contract]);
  const talentSheet = await request("GET", "/api/talent/timesheets");
  const clientSheet = await request("GET", "/api/client/timesheets", undefined, client);
  const tp = talentSheet.json.periods.find((row: any) => row.id === periodId);
  const cp = clientSheet.json.periods.find((row: any) => row.id === periodId);
  assert.equal(tp.activeSession, null); assert.equal(tp.sessions.length, 2);
  assert.equal(tp.totalHours, cp.totalHours);
  assert.deepEqual(tp.days, cp.days);
  assert.ok(tp.totalHours >= 1.4166 && tp.totalHours < 1.418);
  assert.equal(cp.workTimezone, "Asia/Manila");
  const team = await request("GET", "/fixture/client/team?organizationId=clock-workspace", undefined, client);
  assert.equal(team.status, 200);
  const member = team.json.members.find((item: any) => item.id === "clock-talent");
  assert.equal(member.hoursLogged, tp.totalHours);
  assert.equal(team.json.members.find((item: any) => item.id === "other-talent").hoursLogged, 0,
    "No clock or legacy entries must never fabricate full-day hours.");
});
test("other Client sees neither periods nor tracked Talent", async () => {
  const sheet = await request("GET", "/api/client/timesheets", undefined, otherClient);
  assert.equal(sheet.json.periods.length, 0);
  const team = await request("GET", "/fixture/client/team?organizationId=clock-workspace", undefined, otherClient);
  assert.equal(team.status, 404);
  assert.equal(JSON.stringify(team.json).includes("clock-talent"), false);
});
test("completed period can be submitted and Guaranteed remains not tracked", async () => {
  assert.equal((await request("POST", `/api/talent/timesheets/${periodId}/submit`, {})).status, 200);
  const sheet = await request("GET", "/api/talent/timesheets");
  assert.equal(sheet.json.engagements.find((row: any) => row.hiringContractId === guaranteed).billingMode, "guaranteed");
  assert.equal(sheet.json.periods.some((row: any) => row.hiringContractId === guaranteed), false);
});
test("an open legacy session with no valid zone can confirm an initial zone without resetting its start", async () => {
  const legacyContract = await makeContract("other-talent");
  const legacy = (await query(`INSERT INTO clock_sessions (hiring_contract_id, talent_id, started_at)
    VALUES ($1, 'other-talent', now() - interval '30 minutes') RETURNING *`, [legacyContract])).rows[0];
  assert.equal((await request("PUT", "/api/talent/clock/timezone",
    { hiringContractId: legacyContract, workTimezone: "Asia/Manila" }, otherTalent)).status, 200);
  const state = await request("GET", "/api/talent/clock", undefined, otherTalent);
  assert.equal(state.json.activeSession.id, legacy.id);
  assert.equal(state.json.activeSession.startedAt, legacy.started_at.toISOString());
  assert.equal(state.json.activeSession.workTimezone, "Asia/Manila");
});
