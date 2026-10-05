import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query, registerRoutes, initializeFixture, closeFixture } from "./fixtures/timesheetServer";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();
const ADMIN = `timesheet-admin-${suffix}`;
const CLIENT = `timesheet-client-${suffix}`;
const OTHER_CLIENT = `timesheet-other-client-${suffix}`;
const TALENT = `timesheet-talent-${suffix}`;
const token = (id: string, role: string) => jwt.sign({ userId: id, email: `${id}@test.example`, role }, JWT_SECRET, { expiresIn: "1h" });
const adminToken = token(ADMIN, "admin");
const clientToken = token(CLIENT, "client");
const otherClientToken = token(OTHER_CLIENT, "client");
const talentToken = token(TALENT, "talent");

function request(server: http.Server, method: string, path: string, body?: unknown, authToken?: string) {
  const { port } = server.address() as { port: number };
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      host: "127.0.0.1", port, method, path,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, json: JSON.parse(text) }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

let server: http.Server;
let jobId: string;
let submissionId: string;
let offerId: string;
let contractId: string;
let sessionId: string;
let periodId: string;
let longSessionId: string;

async function setup() {
  await query(
    `INSERT INTO users (id, email, role) VALUES
     ($1, $2, 'admin'), ($3, $4, 'client'), ($5, $6, 'client'), ($7, $8, 'talent')`,
    [ADMIN, `${ADMIN}@test.example`, CLIENT, `${CLIENT}@test.example`,
      OTHER_CLIENT, `${OTHER_CLIENT}@test.example`, TALENT, `${TALENT}@test.example`],
  );
  jobId = (await query(
    `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type, billing_mode, time_zone)
     VALUES ($1, 'Timesheet test', 'test', 'Engineering', 'intermediate', 'open', 'Standard', 'tracked', 'America/New_York') RETURNING id`,
    [CLIENT],
  )).rows[0].id;
  submissionId = (await query(
    `INSERT INTO job_submissions (job_id, client_id, talent_id, email, applicant_name, status, initiated_by, workflow_type)
     VALUES ($1, $2, $3, $4, 'Timesheet Talent', 'hired', 'client', 'client_invitation') RETURNING id`,
    [jobId, CLIENT, TALENT, `${TALENT}@test.example`],
  )).rows[0].id;
  offerId = (await query(
    `INSERT INTO offers (submission_id, engagement_type, billing_mode, rate, rate_currency, status)
     VALUES ($1, 'Standard', 'tracked', 40000, 'PHP', 'accepted') RETURNING id`,
    [submissionId],
  )).rows[0].id;
  contractId = (await query(
    `INSERT INTO hiring_contracts (offer_id, submission_id, status, talent_signed_at, onspot_signed_at, billing_mode)
     VALUES ($1, $2, 'signed', NOW(), NOW(), 'tracked') RETURNING id`,
    [offerId, submissionId],
  )).rows[0].id;
  sessionId = (await query(
    `INSERT INTO clock_sessions
      (hiring_contract_id, talent_id, started_at, ended_at, exception_type, exception_status)
     VALUES ($1, $2, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour', 'missed_out', 'detected')
     RETURNING id`,
    [contractId, TALENT],
  )).rows[0].id;
  const app = express();
  app.use(express.json());
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
}

async function teardown() {
  await query(`ALTER TABLE timesheet_revisions DISABLE TRIGGER timesheet_revisions_immutable`).catch(() => {});
  await query(`ALTER TABLE timesheet_revision_sessions DISABLE TRIGGER timesheet_revision_sessions_immutable`).catch(() => {});
  await query(`ALTER TABLE timesheet_audit DISABLE TRIGGER timesheet_audit_immutable`).catch(() => {});
  await query(`DELETE FROM timesheet_audit WHERE timesheet_period_id IN (SELECT id FROM timesheet_periods WHERE hiring_contract_id = $1)`, [contractId]).catch(() => {});
  await query(`DELETE FROM timesheet_disputes WHERE timesheet_period_id IN (SELECT id FROM timesheet_periods WHERE hiring_contract_id = $1)`, [contractId]).catch(() => {});
  await query(`DELETE FROM timesheet_correction_proposals WHERE timesheet_period_id IN (SELECT id FROM timesheet_periods WHERE hiring_contract_id = $1)`, [contractId]).catch(() => {});
  await query(`DELETE FROM timesheet_revision_sessions WHERE revision_id IN (SELECT id FROM timesheet_revisions WHERE timesheet_period_id IN (SELECT id FROM timesheet_periods WHERE hiring_contract_id = $1))`, [contractId]).catch(() => {});
  await query(`UPDATE timesheet_periods SET approved_revision_id = NULL WHERE hiring_contract_id = $1`, [contractId]).catch(() => {});
  await query(`DELETE FROM timesheet_revisions WHERE timesheet_period_id IN (SELECT id FROM timesheet_periods WHERE hiring_contract_id = $1)`, [contractId]).catch(() => {});
  await query(`DELETE FROM timesheet_periods WHERE hiring_contract_id = $1`, [contractId]).catch(() => {});
  await query(`DELETE FROM clock_sessions WHERE id = $1`, [sessionId]).catch(() => {});
  if (longSessionId) await query(`DELETE FROM clock_sessions WHERE id = $1`, [longSessionId]).catch(() => {});
  await query(`DELETE FROM hiring_contracts WHERE id = $1`, [contractId]).catch(() => {});
  await query(`DELETE FROM offers WHERE id = $1`, [offerId]).catch(() => {});
  await query(`DELETE FROM job_submissions WHERE id = $1`, [submissionId]).catch(() => {});
  await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
  await query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [[ADMIN, CLIENT, OTHER_CLIENT, TALENT]]).catch(() => {});
  await query(`ALTER TABLE timesheet_revisions ENABLE TRIGGER timesheet_revisions_immutable`).catch(() => {});
  await query(`ALTER TABLE timesheet_revision_sessions ENABLE TRIGGER timesheet_revision_sessions_immutable`).catch(() => {});
  await query(`ALTER TABLE timesheet_audit ENABLE TRIGGER timesheet_audit_immutable`).catch(() => {});
}

describe("clock-derived timesheets", () => {
  before(async () => { await initializeFixture(); await setup(); });
  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await teardown();
    await closeFixture();
  });

  it("isolates client periods and blocks unresolved missed-out sessions until explicit Admin exception", async () => {
    const talent = await request(server, "GET", "/api/talent/timesheets", undefined, talentToken);
    assert.equal(talent.status, 200);
    assert.equal(talent.json.periods.length, 1);
    const period = talent.json.periods[0];
    periodId = period.id;
    assert.equal(period.workTimezone, "America/New_York");
    assert.equal(period.approvalBlocked, true);
    assert.equal(period.sessions.find((item: any) => item.id === sessionId).status, "exception_detected");
    assert.deepEqual((await request(server, "GET", "/api/client/timesheets", undefined, otherClientToken)).json.periods, []);
    assert.equal((await request(server, "GET", "/api/client/timesheets", undefined, clientToken)).json.periods[0].id, periodId);

    const correctedEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const correction = await request(server, "POST", `/api/talent/timesheets/${periodId}/corrections`, {
      corrections: [{ sessionId, endedAt: correctedEnd, reason: "The recorded interval needs review" }],
    }, talentToken);
    assert.equal(correction.status, 200);
    const correctionId = correction.json.period.corrections[0].id;
    assert.equal((await request(server, "POST", `/api/talent/timesheets/${periodId}/submit`, {}, talentToken)).status, 200);
    const edit = { sessionId, startedAt: new Date(new Date(correctedEnd).getTime() - 4 * 60 * 60 * 1000).toISOString(), endedAt: correctedEnd };
    const blocked = await request(server, "POST", `/api/admin/timesheets/${periodId}/review`, {
      decision: "approve", reason: "Attempt approval", edits: [edit],
      correctionDecisions: [{ correctionId, decision: "approve" }],
    }, adminToken);
    assert.equal(blocked.status, 409);
    assert.match(blocked.json.error, /unresolved/i);

    const approved = await request(server, "POST", `/api/admin/timesheets/${periodId}/review`, {
      decision: "exception",
      reason: "Reviewed the anomalous session and explicitly approved its corrected interval",
      edits: [edit], correctionDecisions: [{ correctionId, decision: "approve" }],
    }, adminToken);
    assert.equal(approved.status, 200);
    assert.equal(approved.json.period.status, "approved");
    assert.equal(approved.json.period.revisions.length, 1);
    assert.equal(approved.json.period.revisions[0].version, 1);
    assert.equal(approved.json.period.totalHours, 4);
    assert.equal(approved.json.period.corrections[0].status, "approved");
    const raw = await query(`SELECT ended_at, approved_end_at FROM clock_sessions WHERE id = $1`, [sessionId]);
    assert.ok(raw.rows[0].ended_at);
    assert.equal(raw.rows[0].approved_end_at, null);
    const beforeReapproval = await query(
      `SELECT rs.clock_session_id, rs.started_at::text, rs.effective_end_at::text, rs.source
         FROM timesheet_revision_sessions rs
        WHERE rs.revision_id = (SELECT approved_revision_id FROM timesheet_periods WHERE id = $1)
        ORDER BY rs.clock_session_id`,
      [periodId],
    );
    const originalTotal = approved.json.period.totalHours;
    assert.equal((await request(server, "POST", `/api/client/timesheets/${periodId}/dispute`, { reason: "Please review" }, clientToken)).status, 200);
    await query(`UPDATE jobs SET time_zone = 'Asia/Tokyo' WHERE id = $1`, [jobId]);
    const duringDispute = await request(server, "GET", "/api/client/timesheets", undefined, clientToken);
    assert.equal(duringDispute.json.periods.find((item: any) => item.id === periodId).workTimezone, "America/New_York");
    const reapproved = await request(server, "POST", `/api/admin/timesheets/${periodId}/review`, {
      decision: "approve", reason: "Reviewed the dispute; original approved intervals remain correct",
    }, adminToken);
    assert.equal(reapproved.status, 200);
    assert.equal(reapproved.json.period.totalHours, originalTotal);
    assert.equal(reapproved.json.period.revisions[1].workTimezone, "America/New_York");
    const afterReapproval = await query(
      `SELECT rs.clock_session_id, rs.started_at::text, rs.effective_end_at::text, rs.source
         FROM timesheet_revision_sessions rs
        WHERE rs.revision_id = (SELECT approved_revision_id FROM timesheet_periods WHERE id = $1)
        ORDER BY rs.clock_session_id`,
      [periodId],
    );
    assert.deepEqual(afterReapproval.rows, beforeReapproval.rows);
  });

  it("enumerates and clips every crossed ET half-month across DST", async () => {
    await query(`UPDATE jobs SET time_zone = 'America/New_York' WHERE id = $1`, [jobId]);
    longSessionId = (await query(
      `INSERT INTO clock_sessions (hiring_contract_id, talent_id, started_at, ended_at)
       VALUES ($1, $2, '2026-02-14T12:00:00Z', '2026-03-17T04:00:00Z') RETURNING id`,
      [contractId, TALENT],
    )).rows[0].id;
    const response = await request(server, "GET", "/api/talent/timesheets", undefined, talentToken);
    assert.equal(response.status, 200);
    const crossed = response.json.periods.filter((item: any) =>
      ["2026-02-01", "2026-02-16", "2026-03-01", "2026-03-16"].includes(item.periodStart));
    assert.deepEqual(crossed.map((item: any) => item.periodStart).sort(), [
      "2026-02-01", "2026-02-16", "2026-03-01", "2026-03-16",
    ]);
    const clock = crossed.map((period: any) => ({
      period,
      session: period.sessions.find((item: any) => item.id === longSessionId),
    }));
    assert.ok(clock.every((item) => item.session));
    for (const { period, session } of clock) {
      const bounds = await query(
        `SELECT period_start::timestamp AT TIME ZONE 'America/New_York' AS period_start,
                (period_end + 1)::timestamp AT TIME ZONE 'America/New_York' AS period_end
           FROM timesheet_periods WHERE id = $1`,
        [period.id],
      );
      const rawStart = new Date("2026-02-14T12:00:00Z");
      const rawEnd = new Date("2026-03-17T04:00:00Z");
      const clippedStart = rawStart > bounds.rows[0].period_start ? rawStart : bounds.rows[0].period_start;
      const clippedEnd = rawEnd < bounds.rows[0].period_end ? rawEnd : bounds.rows[0].period_end;
      assert.equal(new Date(session.startedAt).toISOString(), clippedStart.toISOString());
      assert.equal(new Date(session.effectiveEndAt).toISOString(), clippedEnd.toISOString());
    }
    const totalHours = crossed.reduce((total: number, period: any) => total + period.totalHours, 0);
    assert.equal(totalHours, 736);
    const march8 = crossed.flatMap((period: any) => period.days).find((day: any) => day.date === "2026-03-08");
    assert.equal(march8.hours, 23);
  });
});