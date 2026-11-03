// Owned disposable PostgreSQL only; never run Clock mutations against app data.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { readFile } from "node:fs/promises";
import { query, initializeFixture, closeFixture, registerRoutes } from "./fixtures/timesheetServer";

let server: Awaited<ReturnType<typeof registerRoutes>>;
let base: string;
let contract: string;
const token = (id: string, role: string) => jwt.sign({ userId: id, role },
  process.env.JWT_SECRET || "fixture-only", { expiresIn: "1h" });
const talent = token("adjust-talent", "talent");
const client = token("adjust-client", "client");
const otherClient = token("unrelated-client", "client");
const admin = token("adjust-admin", "admin");
async function request(method: string, path: string, body?: any, auth = talent) {
  const response = await fetch(base + path, { method, headers: {
    Authorization: `Bearer ${auth}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() as any };
}
async function makeContract(zone = "Asia/Manila") {
  const job = (await query(`INSERT INTO jobs (client_id,title,billing_mode,time_zone)
    VALUES ('adjust-client','Adjustment test role','tracked',$1) RETURNING id`, [zone])).rows[0].id;
  const submission = (await query(`INSERT INTO job_submissions (job_id,client_id,talent_id,status,workflow_type,initiated_by)
    VALUES ($1,'adjust-client','adjust-talent','hired','client_invitation','client') RETURNING id`, [job])).rows[0].id;
  const offer = (await query(`INSERT INTO offers (submission_id,billing_mode,status)
    VALUES ($1,'tracked','accepted') RETURNING id`, [submission])).rows[0].id;
  return (await query(`INSERT INTO hiring_contracts
    (offer_id,submission_id,status,billing_mode,talent_signed_at,onspot_signed_at,work_timezone)
    VALUES ($1,$2,'signed','tracked',now(),now(),$3) RETURNING id`, [offer, submission, zone])).rows[0].id;
}
async function closedSession(hiringContract = contract, startedAt = "2026-10-07T04:00:00Z", endedAt = "2026-10-08T04:00:00Z") {
  return (await query(`INSERT INTO clock_sessions (hiring_contract_id,talent_id,started_at,ended_at)
    VALUES ($1,'adjust-talent',$2,$3) RETURNING *`, [hiringContract, startedAt, endedAt])).rows[0];
}
async function propose(row: any, end?: string, auth = talent) {
  return request("POST", "/api/talent/clock/exception", {
    sessionId: row.id, proposedEndAt: end ?? new Date(new Date(row.started_at).getTime() + 8 * 3600000).toISOString(),
    reason: "I forgot to time out after my work ended.",
  }, auth);
}
before(async () => {
  await initializeFixture();
  await query(`INSERT INTO users (id,email,role) VALUES
    ('adjust-talent','talent@adjust.test','talent'),('adjust-client','client@adjust.test','client'),
    ('unrelated-client','other@adjust.test','client'),('adjust-admin','admin@adjust.test','admin')`);
  contract = await makeContract();
  const app = express(); app.use(express.json()); server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await closeFixture();
});

test("detected, pending and rejected open sessions always Time Out and release Time In", async () => {
  for (const status of ["detected", "pending", "rejected"]) {
    const row = (await query(`INSERT INTO clock_sessions
      (hiring_contract_id,talent_id,started_at,exception_type,exception_status,exception_detected_at,
       proposed_end_at,proposal_reason,resolved_by,resolved_at,resolution_reason)
      VALUES ($1,'adjust-talent',now()-interval '7 days','missed_out',$2,now()-interval '6 days',
       CASE WHEN $2 <> 'detected' THEN now()-interval '6 days' END,
       CASE WHEN $2 <> 'detected' THEN 'Missed time out' END,
       CASE WHEN $2 = 'rejected' THEN 'adjust-admin' END,
       CASE WHEN $2 = 'rejected' THEN now()-interval '4 days' END,
       CASE WHEN $2 = 'rejected' THEN 'Clarify the request' END) RETURNING *`, [contract, status])).rows[0];
    const out = await request("POST", "/api/talent/clock/out", {});
    assert.equal(out.status, 200, JSON.stringify(out.json));
    assert.equal(out.json.status, `exception_${status}`);
    assert.equal(out.json.needsAdjustment, status !== "pending");
    assert.equal(out.json.startedAt, row.started_at.toISOString());
    assert.ok(out.json.endedAt);
    assert.equal((await request("POST", "/api/talent/clock/out", {})).status, 409);
    const fresh = await request("POST", "/api/talent/clock/in", { hiringContractId: contract });
    assert.equal(fresh.status, 201, JSON.stringify(fresh.json));
    assert.equal((await request("POST", "/api/talent/clock/in", { hiringContractId: contract })).status, 409);
    assert.equal((await request("POST", "/api/talent/clock/out", {})).status, 200);
    if (status === "pending") {
      // Existing pre-release pending requests remain reviewable after raw close.
      assert.equal((await request("POST", `/api/client/clock/${row.id}/resolve`, { decision: "approve" }, client)).status, 200);
    }
  }
});

test("closed ordinary sessions may request shortening; invalid bounds, reason and ownership fail", async () => {
  const row = await closedSession();
  for (const end of [row.started_at.toISOString(), "2026-10-07T03:59:00Z", "2026-10-08T04:00:01Z"]) {
    assert.equal((await propose(row, end)).status, 422);
  }
  assert.equal((await propose(row, undefined, client)).status, 403);
  assert.equal((await request("POST", "/api/talent/clock/exception", {
    sessionId: row.id, proposedEndAt: "2026-10-07T12:00:00Z", reason: "x".repeat(1001),
  })).status, 422);
  assert.equal((await propose(row)).status, 200);
  assert.equal((await propose(row)).status, 409);
  const notification = await query("SELECT * FROM notifications WHERE related_id = $1", [row.id]);
  assert.equal(notification.rows[0].user_id, "adjust-client");
  assert.equal(notification.rows[0].type, "clock_adjustment_requested");
});

test("only the hiring client resolves; rejection requires a reason, resubmission preserves history and raw times", async () => {
  const row = await closedSession();
  assert.equal((await propose(row)).status, 200);
  for (const auth of [otherClient, talent]) {
    assert.ok([403, 404].includes((await request("POST", `/api/client/clock/${row.id}/resolve`, { decision: "approve" }, auth)).status));
  }
  assert.equal((await request("POST", `/api/client/clock/${row.id}/resolve`, { decision: "reject" }, client)).status, 422);
  assert.equal((await request("POST", `/api/client/clock/${row.id}/resolve`, {
    decision: "reject", reason: "Please clarify when work ended.",
  }, client)).status, 200);
  assert.equal((await propose(row)).status, 200);
  const results = await Promise.all([1, 2].map(() =>
    request("POST", `/api/client/clock/${row.id}/resolve`, { decision: "approve" }, client)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const saved = (await query("SELECT * FROM clock_sessions WHERE id = $1", [row.id])).rows[0];
  assert.equal(saved.started_at.toISOString(), row.started_at.toISOString());
  assert.equal(saved.ended_at.toISOString(), row.ended_at.toISOString());
  assert.equal(saved.approved_end_at.toISOString(), "2026-10-07T12:00:00.000Z");
  const history = (await query(`SELECT action,reviewer_role,proposal_reason FROM clock_exception_reviews
    WHERE clock_session_id=$1 ORDER BY created_at,id`, [row.id])).rows;
  assert.deepEqual(history.map(r => r.action), ["proposed", "rejected", "proposed", "approved"]);
  assert.deepEqual(history.filter(r => r.reviewer_role).map(r => r.reviewer_role), ["client", "client"]);
  assert.equal(history[0].proposal_reason, "I forgot to time out after my work ended.",
    "resubmission and decisions preserve the original proposal");
  assert.equal((await query(`SELECT count(*)::int AS n FROM notifications
    WHERE related_id=$1 AND user_id='adjust-talent' AND type='clock_adjustment_resolved'`, [row.id])).rows[0].n, 2);
});

test("any admin is a fallback only after three days since the latest proposal", async () => {
  const row = await closedSession();
  assert.equal((await propose(row)).status, 200);
  const path = `/api/admin/clock/${row.id}/resolve`;
  assert.equal((await request("POST", path, { decision: "approve" }, admin)).status, 409);
  const pending = (await request("GET", "/api/admin/clock/exceptions", undefined, admin)).json.find((r: any) => r.id === row.id);
  assert.equal(pending.escalated, false); assert.equal(pending.canResolve, false);
  const old = await closedSession();
  await query(`UPDATE clock_sessions SET exception_type='missed_out',exception_status='pending',
    exception_detected_at=now()-interval '5 days',proposed_end_at=started_at+interval '8 hours',
    proposal_reason='Old pending request' WHERE id=$1`, [old.id]);
  await query(`INSERT INTO clock_exception_reviews
    (clock_session_id,action,actor_id,proposed_end_at,proposal_reason,created_at)
    VALUES ($1,'proposed','adjust-talent',$2,'Old pending request',now()-interval '4 days')`,
  [old.id, "2026-10-07T12:00:00Z"]);
  const escalated = (await request("GET", "/api/admin/clock/exceptions", undefined, admin)).json.find((r: any) => r.id === old.id);
  assert.equal(escalated.escalated, true); assert.equal(escalated.canResolve, true);
  assert.equal((await request("POST", `/api/admin/clock/${old.id}/resolve`, { decision: "reject", reason: "Clarify" }, admin)).status, 200);
  assert.equal((await propose(old)).status, 200);
  assert.equal((await request("POST", `/api/admin/clock/${old.id}/resolve`, { decision: "approve" }, admin)).status, 409,
    "a resubmission starts a fresh client review window");
  const oldApprove = await closedSession();
  await query(`UPDATE clock_sessions SET exception_type='missed_out',exception_status='pending',
    exception_detected_at=now()-interval '5 days',proposed_end_at=started_at+interval '8 hours',
    proposal_reason='Historical request' WHERE id=$1`, [oldApprove.id]);
  assert.equal((await request("POST", `/api/admin/clock/${oldApprove.id}/resolve`, { decision: "approve" }, admin)).status, 200);
  const audit = (await query("SELECT reviewer_role FROM clock_exception_reviews WHERE clock_session_id=$1", [oldApprove.id])).rows;
  assert.equal(audit[0].reviewer_role, "admin");
});

test("approved periods reject proposals and the reviewer-role migration is additive and repeatable", async () => {
  const own = await makeContract();
  const row = await closedSession(own);
  const periods = (await request("GET", "/api/talent/timesheets")).json.periods.filter((p: any) => p.hiringContractId === own);
  const period = periods.find((p: any) => p.sessions.some((s: any) => s.id === row.id));
  await query("UPDATE timesheet_periods SET status='approved' WHERE id=$1", [period.id]);
  assert.equal((await propose(row)).status, 409);
  const before = (await query("SELECT count(*)::int AS n FROM clock_exception_reviews")).rows[0].n;
  const migration = await readFile("migrations/0056_clock_review_roles.sql", "utf8");
  await query(migration); await query(migration);
  assert.equal((await query("SELECT count(*)::int AS n FROM clock_exception_reviews")).rows[0].n, before);
});

test("the production-shaped stuck pending record can close, retain its proposal and receive Client approval", async () => {
  // Synthetic copy in the explicitly owned fixture, not the production account.
  const id = "5c13547e-907f-42f0-b995-f07a67820858";
  await query(`INSERT INTO clock_sessions
    (id,hiring_contract_id,talent_id,started_at,exception_type,exception_status,exception_detected_at,
     proposed_end_at,proposal_reason)
    VALUES ($1,$2,'adjust-talent','2026-10-07T04:34:55.804Z','missed_out','pending',
      '2026-10-12T12:32:00Z','2026-10-12T12:32:00Z','Existing pending adjustment')`, [id, contract]);
  const out = await request("POST", "/api/talent/clock/out", {});
  assert.equal(out.status, 200); assert.equal(out.json.id, id);
  assert.equal(out.json.status, "exception_pending"); assert.equal(out.json.needsAdjustment, false);
  const rawEnd = out.json.endedAt;
  assert.equal((await request("POST", `/api/client/clock/${id}/resolve`, { decision: "approve" }, client)).status, 200);
  const saved = (await query("SELECT * FROM clock_sessions WHERE id=$1", [id])).rows[0];
  assert.equal(saved.ended_at.toISOString(), rawEnd);
  assert.equal(saved.proposed_end_at.toISOString(), "2026-10-12T12:32:00.000Z");
  assert.equal(saved.approved_end_at.toISOString(), saved.proposed_end_at.toISOString());
});
