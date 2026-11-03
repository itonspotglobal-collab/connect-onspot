import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { readFile } from "node:fs/promises";
import { query, initializeFixture, registerRoutes, closeFixture } from "./fixtures/timesheetServer";
import { revisionPaidHours, sessionPaidTime } from "../services/sessionPaidTime";
import { calculateModernDashboardActivity } from "../lib/clientTeamDashboardActivity";

let server: Awaited<ReturnType<typeof registerRoutes>>, base: string, contract: string;
const token = (role: string) => jwt.sign({ userId: `activities-${role}`, role }, process.env.JWT_SECRET || "fixture-only");
async function api(method: string, path: string, body?: any, role = "talent") {
  const response = await fetch(base + path, { method, headers: {
    Authorization: `Bearer ${token(role)}`, "Content-Type": "application/json",
  }, ...(body !== undefined && { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}
const clockIn = () => api("POST", "/api/talent/clock/in", { hiringContractId: contract });
const change = (activityType: string, role = "talent") => api("POST", "/api/talent/clock/activity", { activityType }, role);
const out = () => api("POST", "/api/talent/clock/out", {});
before(async () => {
  await initializeFixture();
  await query(`INSERT INTO users(id,email,role,first_name) VALUES
    ('activities-talent','talent@activities.test','talent','Fixture'),
    ('activities-client','client@activities.test','client','Fixture'),
    ('activities-admin','admin@activities.test','admin','Fixture');
    INSERT INTO jobs(id,client_id,title,status,billing_mode,time_zone)
      VALUES('activities-job','activities-client','Activity testing','open','tracked','Asia/Manila')`);
  const submission = (await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,applicant_name,status,initiated_by,workflow_type)
    VALUES('activities-job','activities-client','activities-talent','Fixture','hired','client','client_invitation') RETURNING id`)).rows[0].id;
  const offer = (await query(`INSERT INTO offers(submission_id,status,billing_mode,rate,rate_currency,engagement_type)
    VALUES($1,'accepted','tracked',1000,'USD','Standard') RETURNING id`, [submission])).rows[0].id;
  contract = (await query(`INSERT INTO hiring_contracts(offer_id,submission_id,status,billing_mode,work_timezone,talent_signed_at,onspot_signed_at)
    VALUES($1,$2,'signed','tracked','Asia/Manila',now(),now()) RETURNING id`, [offer, submission])).rows[0].id;
  const app = express(); app.use(express.json()); server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
beforeEach(async () => {
  await query(`TRUNCATE clock_sessions,timesheet_periods,notifications CASCADE;
    UPDATE hiring_contracts SET lunch_paid=false,break_paid=true,meeting_paid=true,
      lunch_max_minutes=60,break_max_minutes=15,breaks_per_day=2`);
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await closeFixture();
});
test("Time In inserts work atomically; switching has exact contiguous timestamps; Time Out closes both", async () => {
  const session = (await clockIn()).body;
  assert.equal((await query("SELECT count(*)::int n FROM clock_session_activities")).rows[0].n, 1);
  for (const type of ["lunch", "work", "meeting"]) assert.equal((await change(type)).status, 200);
  const state = (await api("GET", "/api/talent/clock")).body;
  assert.equal(state.activeSession.currentActivity.type, "meeting");
  assert.equal(state.activeSession.activities.length, 4);
  assert.equal((await out()).status, 200);
  const checks = (await query(`SELECT
    (SELECT count(*)::int FROM clock_session_activities WHERE ended_at IS NULL) AS open,
    (SELECT count(*)::int FROM (SELECT started_at,lag(ended_at) OVER (ORDER BY started_at) AS prev
      FROM clock_session_activities WHERE clock_session_id=$1) a WHERE prev IS NOT NULL AND prev<>started_at) AS gaps,
    (SELECT a.ended_at=cs.ended_at FROM clock_session_activities a JOIN clock_sessions cs ON cs.id=a.clock_session_id
      WHERE cs.id=$1 ORDER BY a.started_at DESC LIMIT 1) AS exact_end,
    (SELECT a.started_at=cs.started_at FROM clock_session_activities a JOIN clock_sessions cs ON cs.id=a.clock_session_id
      WHERE cs.id=$1 ORDER BY a.started_at LIMIT 1) AS exact_start`, [session.id])).rows[0];
  assert.deepEqual(checks, { open: 0, gaps: 0, exact_end: true, exact_start: true });
});
test("same-type and concurrent switches cannot create duplicate/open activities", async () => {
  await clockIn(); assert.equal((await change("work")).status, 409);
  const results = await Promise.all([change("lunch"), change("lunch")]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await query("SELECT count(*)::int n FROM clock_session_activities WHERE ended_at IS NULL")).rows[0].n, 1);
});
test("lunch and break limits are per work day, including another session", async () => {
  await clockIn();
  assert.equal((await change("lunch")).status, 200);
  await change("work"); await out(); await clockIn();
  const denied = await change("lunch");
  assert.equal(denied.status, 409); assert.match(denied.body.error, /already taken lunch/);
  for (let i = 0; i < 2; i++) { assert.equal((await change("break")).status, 200); await change("work"); }
  const third = await change("break"); assert.equal(third.status, 409); assert.match(third.body.error, /2 breaks/);
});
test("real role middleware denies Client/Talent rule edits and non-Talent activity writes", async () => {
  await clockIn();
  assert.equal((await change("lunch", "client")).status, 403);
  assert.equal((await change("meeting", "admin")).status, 403);
  for (const role of ["talent", "client"]) {
    assert.equal((await api("PATCH", `/api/admin/hiring-contracts/${contract}/break-rules`, { lunchPaid: true }, role)).status, 403);
  }
  assert.equal((await api("PATCH", `/api/admin/hiring-contracts/${contract}/break-rules`, { breakMaxMinutes: -1 }, "admin")).status, 422);
  assert.equal((await change("invalid")).status, 422);
});
test("Admin rule changes snapshot only future activities, including the maximum duration", async () => {
  await clockIn(); await change("meeting");
  const first = (await api("GET", "/api/talent/clock")).body.activeSession.currentActivity;
  assert.equal(first.isPaid, true);
  assert.equal((await api("PATCH", `/api/admin/hiring-contracts/${contract}/break-rules`, {
    meetingPaid: false, lunchPaid: true, lunchMaxMinutes: 30, breaksPerDay: 0,
  }, "admin")).status, 200);
  await change("work"); await change("meeting");
  const meetings = (await query("SELECT is_paid FROM clock_session_activities WHERE activity_type='meeting' ORDER BY started_at")).rows;
  assert.deepEqual(meetings.map(r => r.is_paid), [true, false]);
  await change("work"); assert.equal((await change("break")).status, 409);
  await change("lunch");
  const state = (await api("GET", "/api/talent/clock")).body;
  assert.equal(state.activeSession.currentActivity.maxMinutes, 30);
  assert.equal(state.activeSession.currentActivity.isPaid, true);
  assert.equal(state.contracts[0].breakRules.breaksPerDay, 0);
});
test("over-limit lunch remains open, flags the response and creates only one Talent notification", async () => {
  const id = (await clockIn()).body.id; await change("lunch");
  // Advance only the explicitly owned fixture's clock history.
  await query("UPDATE clock_sessions SET started_at=now()-interval '2 hours' WHERE id=$1", [id]);
  await query(`UPDATE clock_session_activities SET started_at=(SELECT started_at FROM clock_sessions WHERE id=$1),
    ended_at=date_trunc('second',now())-interval '61 minutes' WHERE clock_session_id=$1 AND activity_type='work'`, [id]);
  await query(`UPDATE clock_session_activities SET started_at=(SELECT ended_at FROM clock_session_activities
    WHERE clock_session_id=$1 AND activity_type='work') WHERE clock_session_id=$1 AND activity_type='lunch'`, [id]);
  for (let n = 0; n < 2; n++) {
    const state = (await api("GET", "/api/talent/clock")).body;
    assert.equal(state.activeSession.currentActivity.type, "lunch");
    assert.equal(state.activeSession.currentActivity.overLimit, true);
    assert.ok(state.todayTotals.lunchSeconds > 3600);
    assert.ok(state.todayTotals.unpaidSeconds > 3600);
  }
  assert.equal((await query("SELECT count(*)::int n FROM notifications WHERE type='clock_activity_over_limit' AND user_id='activities-talent'")).rows[0].n, 1);
  await out();
  assert.equal((await query("SELECT count(*)::int n FROM notifications WHERE type='clock_activity_over_limit'")).rows[0].n, 1);
});
test("legacy open sessions gain a work history without changing original timestamps", async () => {
  const id = (await query(`INSERT INTO clock_sessions(hiring_contract_id,talent_id,started_at)
    VALUES($1,'activities-talent',clock_timestamp()-interval '2 minutes') RETURNING id`, [contract])).rows[0].id;
  assert.equal((await change("meeting")).status, 200); await out();
  assert.equal((await query(`SELECT a.started_at=cs.started_at AS same FROM clock_session_activities a
    JOIN clock_sessions cs ON cs.id=a.clock_session_id WHERE cs.id=$1 AND a.activity_type='work'`, [id])).rows[0].same, true);
});

const start = "2026-01-01T15:00:00Z", end = "2026-01-01T18:00:00Z";
const timeline = [
  { type: "work", startedAt: start, endedAt: "2026-01-01T15:30:00Z", isPaid: true },
  { type: "lunch", startedAt: "2026-01-01T15:30:00Z", endedAt: "2026-01-01T16:30:00Z", isPaid: false },
  { type: "meeting", startedAt: "2026-01-01T16:30:00Z", endedAt: "2026-01-01T17:30:00Z", isPaid: true },
  { type: "break", startedAt: "2026-01-01T17:30:00Z", endedAt: end, isPaid: false },
];
test("paid/unpaid math splits precisely at Asia/Manila midnight and clips period boundaries", () => {
  const result = sessionPaidTime({ startedAt: start, endedAt: end }, timeline, "Asia/Manila");
  assert.equal(result.paidSeconds, 5400); assert.equal(result.unpaidSeconds, 5400);
  assert.deepEqual(result.days.map(d => [d.date, d.paidSeconds, d.unpaidSeconds]),
    [["2026-01-01", 1800, 1800], ["2026-01-02", 3600, 3600]]);
  const clipped = sessionPaidTime({ startedAt: start, endedAt: end }, timeline, "Asia/Manila", {
    start: new Date("2026-01-01T15:45:00Z"), end: new Date("2026-01-01T17:00:00Z"),
  });
  assert.equal(clipped.paidSeconds, 1800); assert.equal(clipped.unpaidSeconds, 2700);
});
test("approved early ends ignore later activities without rewriting them; legacy/no-activity time is paid work", () => {
  const original = JSON.stringify(timeline);
  const result = sessionPaidTime({ started_at: start, ended_at: end, exception_status: "approved",
    approved_end_at: "2026-01-01T16:15:00Z" }, timeline, "Asia/Manila");
  assert.equal(result.paidSeconds, 1800); assert.equal(result.lunchSeconds, 2700); assert.equal(result.meetingSeconds, 0);
  assert.equal(JSON.stringify(timeline), original);
  const legacy = sessionPaidTime({ startedAt: start, endedAt: end }, [], "Asia/Manila");
  assert.equal(legacy.workSeconds, 10800); assert.equal(legacy.paidSeconds, 10800);
  assert.equal(sessionPaidTime({ started_at: start, ended_at: end, exception_status: "pending" }, timeline, "Asia/Manila").paidSeconds, 0);
});
test("client dashboard shares paid math, excluding unpaid lunch and break", () => {
  const result = calculateModernDashboardActivity([{ id: contract, workTimezone: "Asia/Manila",
    effectiveStartDate: null, effectiveEndDate: null, proposedStartDate: null }], [{
    id: "fixture", hiringContractId: contract, startedAt: start, endedAt: end, exceptionStatus: null,
    approvedEndAt: null, activities: timeline,
  }], new Date("2026-01-02T12:00:00Z"));
  assert.equal(result.hoursLogged, 1.5);
});
test("activity migration reapplies without altering recorded events or rule snapshots", async () => {
  await clockIn(); await change("lunch"); await out();
  const before = (await query("SELECT * FROM clock_session_activities ORDER BY started_at")).rows;
  const db = await import("pg");
  const client = new db.default.Client({ connectionString: process.env.TIMESHEET_TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(await readFile("scripts/migration-reconciliation.sql", "utf8"));
    await client.query(await readFile("migrations/0058_clock_session_activities.sql", "utf8"));
    await client.query(await readFile("migrations/0058_clock_session_activities.sql", "utf8"));
    await client.query("COMMIT");
  } finally { await client.end(); }
  assert.deepEqual((await query("SELECT * FROM clock_session_activities ORDER BY started_at")).rows, before);
});
test("approved timesheets freeze the paid activity snapshot even if source metadata changes", async () => {
  const sessionId = (await query(`INSERT INTO clock_sessions(hiring_contract_id,talent_id,started_at,ended_at)
    VALUES($1,'activities-talent',$2,$3) RETURNING id`, [contract, start, end])).rows[0].id;
  for (const row of timeline) await query(`INSERT INTO clock_session_activities
    (clock_session_id,activity_type,started_at,ended_at,is_paid) VALUES($1,$2,$3,$4,$5)`,
  [sessionId, row.type, row.startedAt, row.endedAt, row.isPaid]);
  const period = (await api("GET", "/api/talent/timesheets")).body.periods.find((p: any) =>
    p.sessions.some((s: any) => s.id === sessionId));
  assert.equal(period.totalHours, 1.5);
  assert.equal((await api("POST", `/api/talent/timesheets/${period.id}/submit`, {})).status, 200);
  const review = await api("POST", `/api/admin/timesheets/${period.id}/review`,
    { decision: "approve", reason: "Reviewed the canonical paid activity timeline" }, "admin");
  assert.equal(review.status, 200, JSON.stringify(review.body));
  const snapshot = (await query("SELECT activity_snapshot FROM timesheet_revision_sessions WHERE clock_session_id=$1", [sessionId])).rows[0].activity_snapshot;
  assert.equal(snapshot.filter((a: any) => !a.is_paid).length, 2);
  // Corrupt only this owned fixture to prove approval does not consult live
  // mutable metadata. No application endpoint permits this rewrite.
  await query("UPDATE clock_session_activities SET is_paid=true WHERE clock_session_id=$1", [sessionId]);
  const approved = (await api("GET", "/api/client/timesheets", undefined, "client")).body.periods.find((p: any) => p.id === period.id);
  assert.equal(approved.totalHours, 1.5);
  assert.equal(approved.sessions[0].breakdown.unpaidSeconds, 5400);
  const revisionId = (await query("SELECT approved_revision_id FROM timesheet_periods WHERE id=$1", [period.id])).rows[0].approved_revision_id;
  assert.equal(await revisionPaidHours(query, revisionId), 1.5);
  assert.equal(await revisionPaidHours(query, revisionId, "2026-01-01T15:45:00Z", "2026-01-01T17:00:00Z"), 0.5);
});
