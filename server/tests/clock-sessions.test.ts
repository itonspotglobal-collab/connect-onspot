import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();
const ADMIN_ID = `clock-admin-${suffix}`;
const CLIENT_ID = `clock-client-${suffix}`;
const TALENT_ID = `clock-talent-${suffix}`;
const OTHER_TALENT_ID = `clock-other-talent-${suffix}`;
const talentToken = jwt.sign(
  { userId: TALENT_ID, email: `${TALENT_ID}@test.example`, role: "talent" },
  JWT_SECRET,
  { expiresIn: "1h" },
);
const otherTalentToken = jwt.sign(
  { userId: OTHER_TALENT_ID, email: `${OTHER_TALENT_ID}@test.example`, role: "talent" },
  JWT_SECRET,
  { expiresIn: "1h" },
);
const clientToken = jwt.sign(
  { userId: CLIENT_ID, email: `${CLIENT_ID}@test.example`, role: "client" },
  JWT_SECRET,
  { expiresIn: "1h" },
);
const adminToken = jwt.sign(
  { userId: ADMIN_ID, email: `${ADMIN_ID}@test.example`, role: "admin" },
  JWT_SECRET,
  { expiresIn: "1h" },
);

function request(server: http.Server, method: string, path: string, body?: unknown, token?: string) {
  const { port } = server.address() as { port: number };
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      host: "127.0.0.1", port, method, path,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode ?? 0, json });
      });
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
let otherSubmissionId: string;
let otherOfferId: string;
let otherContractId: string;
let legacySubmissionId: string;
let legacyOfferId: string;
let legacyContractId: string;
let sessionId: string;

async function setup() {
  await query(
    `INSERT INTO users (id, email, role) VALUES
       ($1, $2, 'admin'), ($3, $4, 'client'), ($5, $6, 'talent'), ($7, $8, 'talent')`,
    [ADMIN_ID, `${ADMIN_ID}@test.example`, CLIENT_ID, `${CLIENT_ID}@test.example`,
      TALENT_ID, `${TALENT_ID}@test.example`, OTHER_TALENT_ID, `${OTHER_TALENT_ID}@test.example`],
  );
  jobId = (await query(
    `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type, billing_mode)
     VALUES ($1, 'Clock Test Job', 'test', 'Engineering', 'intermediate', 'open', 'Standard', 'tracked') RETURNING id`,
    [CLIENT_ID],
  )).rows[0].id;
  submissionId = (await query(
    `INSERT INTO job_submissions
       (job_id, client_id, talent_id, email, applicant_name, status, initiated_by, workflow_type)
     VALUES ($1, $2, $3, $4, 'Clock Talent', 'hired', 'client', 'client_invitation') RETURNING id`,
    [jobId, CLIENT_ID, TALENT_ID, `${TALENT_ID}@test.example`],
  )).rows[0].id;
  offerId = (await query(
    `INSERT INTO offers (submission_id, engagement_type, rate, rate_currency, status)
     VALUES ($1, 'Standard', 40000, 'PHP', 'accepted') RETURNING id`,
    [submissionId],
  )).rows[0].id;
  contractId = (await query(
     `INSERT INTO hiring_contracts (offer_id, submission_id, status, talent_signed_at, onspot_signed_at, billing_mode)
      VALUES ($1, $2, 'signed', NOW(), NOW(), 'tracked') RETURNING id`,
    [offerId, submissionId],
  )).rows[0].id;
  otherSubmissionId = (await query(
    `INSERT INTO job_submissions
       (job_id, client_id, talent_id, email, applicant_name, status, initiated_by, workflow_type)
     VALUES ($1, $2, $3, $4, 'Other Clock Talent', 'hired', 'client', 'client_invitation') RETURNING id`,
    [jobId, CLIENT_ID, OTHER_TALENT_ID, `${OTHER_TALENT_ID}@test.example`],
  )).rows[0].id;
  otherOfferId = (await query(
     `INSERT INTO offers (submission_id, engagement_type, billing_mode, rate, rate_currency, status)
      VALUES ($1, 'Standard', 'tracked', 40000, 'PHP', 'accepted') RETURNING id`,
    [otherSubmissionId],
  )).rows[0].id;
  otherContractId = (await query(
     `INSERT INTO hiring_contracts (offer_id, submission_id, status, talent_signed_at, onspot_signed_at, billing_mode)
      VALUES ($1, $2, 'signed', NOW(), NOW(), 'tracked') RETURNING id`,
    [otherOfferId, otherSubmissionId],
  )).rows[0].id;
  legacySubmissionId = (await query(
    `INSERT INTO job_submissions
       (job_id, client_id, talent_id, email, applicant_name, status, initiated_by, workflow_type)
     VALUES ($1, $2, $3, $4, 'Legacy Clock Talent', 'hired', 'client', 'client_invitation') RETURNING id`,
    [jobId, CLIENT_ID, TALENT_ID, `${TALENT_ID}@test.example`],
  )).rows[0].id;
  legacyOfferId = (await query(
    `INSERT INTO offers (submission_id, engagement_type, rate, rate_currency, status)
     VALUES ($1, 'Standard', 40000, 'PHP', 'accepted') RETURNING id`,
    [legacySubmissionId],
  )).rows[0].id;
  legacyContractId = (await query(
    `INSERT INTO hiring_contracts (offer_id, submission_id, status, talent_signed_at, onspot_signed_at)
     VALUES ($1, $2, 'signed', NOW(), NOW()) RETURNING id`,
    [legacyOfferId, legacySubmissionId],
  )).rows[0].id;
  const app = express();
  app.use(express.json());
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
}

async function teardown() {
  await query(`DELETE FROM clock_sessions WHERE talent_id = ANY($1::varchar[])`, [[TALENT_ID, OTHER_TALENT_ID]]).catch(() => {});
  await query(`DELETE FROM hiring_contracts WHERE id = ANY($1::uuid[])`, [[contractId, otherContractId]]).catch(() => {});
  await query(`DELETE FROM hiring_contracts WHERE id = $1`, [legacyContractId]).catch(() => {});
  await query(`DELETE FROM offers WHERE id = ANY($1::uuid[])`, [[offerId, otherOfferId, legacyOfferId]]).catch(() => {});
  await query(`DELETE FROM job_submissions WHERE id = ANY($1::varchar[])`, [[submissionId, otherSubmissionId, legacySubmissionId]]).catch(() => {});
  await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
  await query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [[ADMIN_ID, CLIENT_ID, TALENT_ID, OTHER_TALENT_ID]]).catch(() => {});
}

describe("clock session foundation", () => {
  before(async () => setup());
  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await teardown();
  });

  it("authenticates talent-only clock access and limits signed contracts to their owner", async () => {
    assert.equal((await request(server, "GET", "/api/talent/clock")).status, 401);
    assert.equal((await request(server, "GET", "/api/talent/clock", undefined, clientToken)).status, 403);
    const own = await request(server, "GET", "/api/talent/clock", undefined, talentToken);
    assert.equal(own.status, 200);
    assert.deepEqual(own.json.contracts.map((contract: any) => contract.id), [contractId]);
    assert.equal(own.json.contracts[0].jobTitle, "Clock Test Job");
    assert.ok(!own.json.contracts.some((contract: any) => contract.id === legacyContractId),
      "signed legacy contracts without an explicit billing mode are not clock-eligible");
    const legacyClockIn = await request(server, "POST", "/api/talent/clock/in", { hiringContractId: legacyContractId }, talentToken);
    assert.equal(legacyClockIn.status, 409);
    const foreign = await request(server, "POST", "/api/talent/clock/in", { hiringContractId: otherContractId }, talentToken);
    assert.equal(foreign.status, 409);
    assert.match(foreign.json.error, /signed contract/i);
    assert.equal((await request(server, "POST", "/api/talent/clock/in", {}, talentToken)).status, 422);
  });

  it("captures clock-in/out through database timestamps and rejects duplicate transitions", async () => {
    const concurrentIns = await Promise.all([
      request(server, "POST", "/api/talent/clock/in", { hiringContractId: contractId }, talentToken),
      request(server, "POST", "/api/talent/clock/in", { hiringContractId: contractId }, talentToken),
    ]);
    assert.deepEqual(concurrentIns.map((response) => response.status).sort(), [201, 409]);
    const started = concurrentIns.find((response) => response.status === 201)!;
    assert.equal(started.status, 201);
    assert.equal(started.json.status, "active");
    assert.ok(started.json.startedAt);
    sessionId = started.json.id;
    assert.equal((await request(server, "POST", "/api/talent/clock/in", { hiringContractId: contractId }, talentToken)).status, 409);
    const active = await request(server, "GET", "/api/talent/clock", undefined, talentToken);
    assert.equal(active.json.activeSession.id, sessionId);
    const ended = await request(server, "POST", "/api/talent/clock/out", undefined, talentToken);
    assert.equal(ended.status, 200);
    assert.equal(ended.json.status, "completed");
    assert.ok(ended.json.endedAt);
    assert.equal((await request(server, "POST", "/api/talent/clock/out", undefined, talentToken)).status, 409);
  });

  it("detects missed clock-outs and resolves a proposed end without rewriting the raw event", async () => {
    const started = await request(server, "POST", "/api/talent/clock/in", { hiringContractId: contractId }, talentToken);
    assert.equal(started.status, 201);
    sessionId = started.json.id;
    await query(`UPDATE clock_sessions SET started_at = NOW() - INTERVAL '18 hours' WHERE id = $1`, [sessionId]);
    const detected = await request(server, "GET", "/api/talent/clock", undefined, talentToken);
    assert.equal(detected.json.activeSession.status, "exception_detected");
    const startTime = new Date(detected.json.activeSession.startedAt);
    const proposedEndAt = new Date(startTime.getTime() + 60 * 60 * 1000).toISOString();
    const proposal = await request(
      server, "POST", "/api/talent/clock/exception",
      { sessionId, proposedEndAt, reason: "Forgot to stop the timer" }, talentToken,
    );
    assert.equal(proposal.status, 200);
    assert.equal((await request(server, "GET", "/api/admin/clock/exceptions")).status, 401);
    assert.equal((await request(server, "GET", "/api/admin/clock/exceptions", undefined, clientToken)).status, 403);
    const exceptions = await request(server, "GET", "/api/admin/clock/exceptions", undefined, adminToken);
    assert.equal(exceptions.status, 200);
    const listed = exceptions.json.find((exception: any) => exception.id === sessionId);
    assert.ok(listed);
    assert.equal(listed.status, "pending");
    assert.equal(listed.jobTitle, "Clock Test Job");
    assert.equal(listed.talentEmail, `${TALENT_ID}@test.example`);
    assert.equal(listed.proposalReason, "Forgot to stop the timer");
    assert.equal(new Date(listed.proposedEndAt).toISOString(), proposedEndAt);
    assert.equal((await request(server, "POST", `/api/admin/clock/${sessionId}/resolve`, {
      decision: "approve", reason: "Approved after review",
    }, clientToken)).status, 403);
    const rejected = await request(server, "POST", `/api/admin/clock/${sessionId}/resolve`, {
      decision: "reject", reason: "Please provide a clearer explanation",
    }, adminToken);
    assert.equal(rejected.status, 200);
    assert.equal(rejected.json.status, "exception_rejected");
    const rejectedItems = await request(server, "GET", "/api/admin/clock/exceptions", undefined, adminToken);
    assert.equal(rejectedItems.json.find((exception: any) => exception.id === sessionId).status, "rejected");
    const resubmitted = await request(
      server, "POST", "/api/talent/clock/exception",
      { sessionId, proposedEndAt, reason: "I reviewed the time and confirm this end" }, talentToken,
    );
    assert.equal(resubmitted.status, 200);
    assert.equal(resubmitted.json.status, "exception_pending");
    const approved = await request(server, "POST", `/api/admin/clock/${sessionId}/resolve`, {
      decision: "approve", reason: "Approved after review",
    }, adminToken);
    assert.equal(approved.status, 200);
    assert.equal(approved.json.status, "exception_approved");
    const audit = await query(
      `SELECT ended_at, proposed_end_at, approved_end_at, proposal_reason,
              resolution_reason, resolved_by, exception_status
         FROM clock_sessions WHERE id = $1`,
      [sessionId],
    );
    assert.equal(audit.rows[0].ended_at, null);
    assert.equal(audit.rows[0].exception_status, "approved");
    assert.equal(audit.rows[0].proposed_end_at.toISOString(), proposedEndAt);
    assert.equal(audit.rows[0].approved_end_at.toISOString(), proposedEndAt);
    assert.equal(audit.rows[0].proposal_reason, "I reviewed the time and confirm this end");
    assert.equal(audit.rows[0].resolution_reason, "Approved after review");
    assert.equal(audit.rows[0].resolved_by, ADMIN_ID);
    const history = await query(
      `SELECT action, proposal_reason, decision_reason
         FROM clock_exception_reviews WHERE clock_session_id = $1`,
      [sessionId],
    );
    assert.equal(history.rows.filter((row: any) => row.action === "proposed").length, 2);
    assert.equal(history.rows.filter((row: any) => row.action === "rejected").length, 1);
    assert.equal(history.rows.filter((row: any) => row.action === "approved").length, 1);
    assert.ok(history.rows.some((row: any) => row.decision_reason === "Please provide a clearer explanation"));
    assert.equal((await request(server, "POST", `/api/admin/clock/${sessionId}/resolve`, {
      decision: "approve", reason: "Duplicate decision",
    }, adminToken)).status, 409);
  });

  it("allows a legitimate long-session clock-out while keeping the anomaly visible to admins", async () => {
    const started = await request(server, "POST", "/api/talent/clock/in", { hiringContractId: contractId }, talentToken);
    assert.equal(started.status, 201);
    sessionId = started.json.id;
    await query(`UPDATE clock_sessions SET started_at = NOW() - INTERVAL '18 hours' WHERE id = $1`, [sessionId]);
    const ended = await request(server, "POST", "/api/talent/clock/out", undefined, talentToken);
    assert.equal(ended.status, 200);
    assert.equal(ended.json.status, "exception_detected");
    assert.ok(ended.json.endedAt);
    const talentClock = await request(server, "GET", "/api/talent/clock", undefined, talentToken);
    assert.equal(talentClock.json.activeSession, null);
    const recentAnomaly = talentClock.json.recentSessions.find((session: any) => session.id === sessionId);
    assert.ok(recentAnomaly);
    assert.equal(recentAnomaly.status, "exception_detected");
    assert.equal(recentAnomaly.exceptionType, "missed_out");
    const listed = await request(server, "GET", "/api/admin/clock/exceptions", undefined, adminToken);
    const anomaly = listed.json.find((exception: any) => exception.id === sessionId);
    assert.ok(anomaly);
    assert.equal(anomaly.status, "detected");
    assert.ok(anomaly.endedAt);
    const row = await query(`SELECT exception_status, approved_end_at FROM clock_sessions WHERE id = $1`, [sessionId]);
    assert.equal(row.rows[0].exception_status, "detected");
    assert.equal(row.rows[0].approved_end_at, null);

    const proposedEndAt = new Date(new Date(ended.json.startedAt).getTime() + 60 * 60 * 1000).toISOString();
    const proposal = await request(
      server, "POST", "/api/talent/clock/exception",
      { sessionId, proposedEndAt, reason: "Reviewing the long session end time" }, talentToken,
    );
    assert.equal(proposal.status, 200);
    assert.equal(proposal.json.status, "exception_pending");
    const pendingRecent = await request(server, "GET", "/api/talent/clock", undefined, talentToken);
    const pendingSession = pendingRecent.json.recentSessions.find((session: any) => session.id === sessionId);
    assert.equal(pendingSession.proposedEndAt, proposedEndAt);
    const approved = await request(server, "POST", `/api/admin/clock/${sessionId}/resolve`, {
      decision: "approve", reason: "Reviewed and approved",
    }, adminToken);
    assert.equal(approved.status, 200);
    const resolved = await query(
      `SELECT ended_at, approved_end_at, exception_status FROM clock_sessions WHERE id = $1`,
      [sessionId],
    );
    assert.equal(resolved.rows[0].ended_at.toISOString(), new Date(ended.json.endedAt).toISOString());
    assert.equal(resolved.rows[0].approved_end_at.toISOString(), proposedEndAt);
    assert.equal(resolved.rows[0].exception_status, "approved");
  });
});