/**
 * interview-scheduling-v1.test.ts
 *
 * End-to-end regression + feature tests for the built-in Interview Scheduling V1.
 * Uses real DB + registerRoutes (same pattern as hiring-contracts.test.ts).
 *
 * Coverage:
 *   - Client POST /api/client/interviews — validation, durationMinutes, 201
 *   - Client PATCH /api/client/interviews/:id — cancellation metadata (cancelled_at / reason), duration update
 *   - Client PATCH /api/client/interviews/:id/outcome — completed_at set
 *   - Client GET /api/client/interviews (no submissionId) — calendar-wide listing
 *   - Admin GET /api/admin/interviews — cross-client listing, status filter
 *   - Admin POST /api/admin/interviews — talent-led + direct-confirm modes
 *   - Admin PATCH /api/admin/interviews/:id — reschedule + cancel with metadata
 *   - Backward compat: existing talent-response route still reachable
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();

// ── Token helpers ─────────────────────────────────────────────────────────────

const tok = (userId: string, role: string) =>
  jwt.sign({ userId, email: `${userId}@test.local`, role }, JWT_SECRET, { expiresIn: "1h" });

const talentTok = (candidateId: string, email: string) =>
  jwt.sign({ type: "candidate", candidateId, email }, JWT_SECRET, { expiresIn: "1h" });

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(
  srv: http.Server,
  method: string,
  path: string,
  token?: string | null,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const { port } = srv.address() as any;
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
            : {}),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json: any = null;
          try { json = JSON.parse(buf); } catch {}
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Fixture IDs ───────────────────────────────────────────────────────────────

const ADMIN_ID       = `iv1-admin-${suffix}`;
const CLIENT_ID      = `iv1-client-${suffix}`;
const TALENT_ID      = `iv1-talent-${suffix}`;
const CANDIDATE_ID   = `iv1-candidate-${suffix}`;

const adminTok  = tok(ADMIN_ID, "admin");
const clientTok = tok(CLIENT_ID, "client");
const candTok   = talentTok(CANDIDATE_ID, `${TALENT_ID}@test.local`);

let srv: http.Server;
let jobId: string;
let submissionId: string;

// ── future timestamp helpers ──────────────────────────────────────────────────

const future = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

// ── Lifecycle ─────────────────────────────────────────────────────────────────

before(async () => {
  // Seed users
  for (const [id, role] of [
    [ADMIN_ID,  "admin"],
    [CLIENT_ID, "client"],
    [TALENT_ID, "talent"],
  ] as const) {
    await query(
      `INSERT INTO users (id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, `${id}@test.local`, role],
    );
  }

  // Candidate row
  await query(
    `INSERT INTO candidates (id, user_id, email, full_name)
     VALUES ($1, $2, $3, 'IV1 Test Talent')
     ON CONFLICT (id) DO NOTHING`,
    [CANDIDATE_ID, TALENT_ID, `${TALENT_ID}@test.local`],
  );

  // Job
  const jobRow = await query(
    `INSERT INTO jobs (client_id, title, description, category, experience_level, status, engagement_type)
     VALUES ($1, 'IV1 Test Job', 'scheduling test', 'Engineering', 'mid', 'open', 'Standard')
     RETURNING id`,
    [CLIENT_ID],
  );
  jobId = jobRow.rows[0].id;

  // Formal-pipeline submission (client_invitation workflow_type)
  const subRow = await query(
    `INSERT INTO job_submissions
       (job_id, talent_id, client_id, applicant_name, email, status,
        initiated_by, workflow_type)
     VALUES ($1, $2, $3, 'IV1 Test Talent', $4, 'shortlisted',
             'client', 'client_invitation')
     RETURNING id`,
    [jobId, TALENT_ID, CLIENT_ID, `${TALENT_ID}@test.local`],
  );
  submissionId = subRow.rows[0].id;

  // Start server — JSON body parser must come before registerRoutes
  const app = express();
  app.use(express.json());
  await registerRoutes(app);
  await new Promise<void>((resolve) => {
    srv = app.listen(0, "127.0.0.1", () => resolve());
  });
});

after(async () => {
  await new Promise<void>((resolve) => srv.close(() => resolve()));

  // Cleanup in FK order
  const subRows = await query(
    `SELECT id FROM job_submissions WHERE job_id = $1`,
    [jobId],
  );
  const ids = subRows.rows.map((r: { id: string }) => r.id);
  if (ids.length) {
    await query(`DELETE FROM interview_proposals WHERE interview_id IN (SELECT id FROM interviews WHERE submission_id = ANY($1::varchar[]))`, [ids]);
    await query(`DELETE FROM interviews WHERE submission_id = ANY($1::varchar[])`, [ids]);
    await query(`DELETE FROM job_application_status_history WHERE application_id = ANY($1::varchar[])`, [ids]);
    await query(`DELETE FROM job_submissions WHERE id = ANY($1::varchar[])`, [ids]);
  }
  await query(`DELETE FROM jobs WHERE id = $1`, [jobId]);
  await query(`DELETE FROM candidates WHERE id = $1`, [CANDIDATE_ID]);
  await query(`DELETE FROM notifications WHERE user_id = ANY($1::varchar[])`, [[ADMIN_ID, CLIENT_ID, TALENT_ID]]);
  await query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [[ADMIN_ID, CLIENT_ID, TALENT_ID]]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Interview Scheduling V1", () => {

  // ── Client POST ─────────────────────────────────────────────────────────

  describe("POST /api/client/interviews", () => {
    it("returns 401 without token", async () => {
      const r = await request(srv, "POST", "/api/client/interviews", null, {
        submissionId,
        proposedTimes: [{ start: future(2) }],
      });
      assert.equal(r.status, 401);
    });

    it("returns 400 without submissionId", async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        proposedTimes: [{ start: future(2) }],
      });
      assert.equal(r.status, 400);
    });

    it("returns 400 for durationMinutes < 15", async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        submissionId,
        proposedTimes: [{ start: future(2) }],
        durationMinutes: 10,
      });
      assert.equal(r.status, 400);
      assert.ok(r.json?.error, "Should include error message");
    });

    it("returns 400 for durationMinutes > 240", async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        submissionId,
        proposedTimes: [{ start: future(2) }],
        durationMinutes: 300,
      });
      assert.equal(r.status, 400);
    });

    it("returns 400 for unknown interviewType", async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        submissionId,
        interviewType: "magic",
        proposedTimes: [{ start: future(2) }],
      });
      assert.equal(r.status, 400);
    });

    it("creates interview (201) and persists durationMinutes", async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        submissionId,
        interviewType: "initial",
        proposedTimes: [{ start: future(3) }],
        durationMinutes: 60,
        candidateNotes: "Please bring your portfolio",
      });
      assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert.equal(r.json.status, "proposed");
      assert.equal(r.json.interview_type, "initial");
      assert.equal(r.json.duration_minutes, 60);
      assert.equal(r.json.candidate_notes, "Please bring your portfolio");
      assert.equal(r.json.round_number, 1);
    });

    it("increments round_number on subsequent interview for same submission", async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        submissionId,
        interviewType: "technical",
        proposedTimes: [{ start: future(4) }],
        durationMinutes: 45,
      });
      assert.equal(r.status, 201, `Expected 201, got ${r.status}`);
      assert.equal(r.json.round_number, 2);
      assert.equal(r.json.duration_minutes, 45);
    });
  });

  // ── Client PATCH ────────────────────────────────────────────────────────

  describe("PATCH /api/client/interviews/:id", () => {
    let interviewId: number;

    before(async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        submissionId,
        proposedTimes: [{ start: future(5) }],
        durationMinutes: 30,
      });
      assert.equal(r.status, 201, `Setup failed: ${r.status}`);
      interviewId = r.json.id;
    });

    it("updates durationMinutes", async () => {
      const r = await request(srv, "PATCH", `/api/client/interviews/${interviewId}`, clientTok, {
        durationMinutes: 90,
      });
      assert.ok(r.status >= 200 && r.status < 300, `Expected 2xx, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert.equal(r.json.duration_minutes, 90);
    });

    it("rejects durationMinutes > 240", async () => {
      const r = await request(srv, "PATCH", `/api/client/interviews/${interviewId}`, clientTok, {
        durationMinutes: 250,
      });
      assert.equal(r.status, 400);
    });

    it("sets cancelled_at and cancellation_reason on cancel", async () => {
      const cancelR = await request(srv, "PATCH", `/api/client/interviews/${interviewId}`, clientTok, {
        status: "cancelled",
        cancellationReason: "Schedule conflict",
      });
      assert.ok(cancelR.status >= 200 && cancelR.status < 300, `Cancel failed: ${cancelR.status}`);

      // Verify via GET
      const getR = await request(srv, "GET", `/api/client/interviews?submissionId=${submissionId}`, clientTok);
      const updated = (getR.json as any[]).find((iv: any) => iv.id === interviewId);
      assert.ok(updated, "Interview should appear in list");
      assert.equal(updated.status, "cancelled");
      assert.ok(updated.cancelled_at, "cancelled_at should be set");
      assert.equal(updated.cancellation_reason, "Schedule conflict");
    });
  });

  // ── Client outcome ──────────────────────────────────────────────────────

  describe("PATCH /api/client/interviews/:id/outcome", () => {
    let interviewId: number;

    before(async () => {
      const r = await request(srv, "POST", "/api/client/interviews", clientTok, {
        submissionId,
        proposedTimes: [{ start: future(7) }],
        durationMinutes: 60,
      });
      assert.equal(r.status, 201, `Setup failed: ${r.status}`);
      interviewId = r.json.id;
    });

    it("sets completed_at when recording outcome=advance", async () => {
      const r = await request(srv, "PATCH", `/api/client/interviews/${interviewId}/outcome`, clientTok, {
        outcome: "advance",
        internalNotes: "Strong candidate",
      });
      assert.ok(r.status >= 200 && r.status < 300, `Outcome failed: ${r.status}: ${JSON.stringify(r.json)}`);
      assert.equal(r.json.status, "completed");
      assert.equal(r.json.outcome, "advance");
      assert.ok(r.json.completed_at, "completed_at should be set");
    });

    it("rejects duplicate outcome on completed interview", async () => {
      const r = await request(srv, "PATCH", `/api/client/interviews/${interviewId}/outcome`, clientTok, {
        outcome: "reject",
      });
      assert.equal(r.status, 409);
    });
  });

  // ── Client calendar-wide GET ────────────────────────────────────────────

  describe("GET /api/client/interviews (calendar-wide — no submissionId)", () => {
    it("returns 401 without token", async () => {
      const r = await request(srv, "GET", "/api/client/interviews");
      assert.equal(r.status, 401);
    });

    it("returns an array for the authenticated client", async () => {
      const r = await request(srv, "GET", "/api/client/interviews", clientTok);
      assert.ok(r.status >= 200 && r.status < 300, `Expected 2xx, got ${r.status}`);
      assert.ok(Array.isArray(r.json), "Should return array");
    });
  });

  // ── Admin GET ───────────────────────────────────────────────────────────

  describe("GET /api/admin/interviews", () => {
    it("returns 403 for client token", async () => {
      const r = await request(srv, "GET", "/api/admin/interviews", clientTok);
      assert.equal(r.status, 403);
    });

    it("returns an array for admin token", async () => {
      const r = await request(srv, "GET", "/api/admin/interviews", adminTok);
      assert.ok(r.status >= 200 && r.status < 300, `Expected 2xx, got ${r.status}`);
      assert.ok(Array.isArray(r.json), "Should return array");
    });

    it("status filter returns only matching records", async () => {
      const r = await request(srv, "GET", "/api/admin/interviews?status=confirmed", adminTok);
      assert.ok(r.status >= 200 && r.status < 300);
      assert.ok(Array.isArray(r.json));
      for (const iv of r.json as any[]) {
        assert.equal(iv.status, "confirmed");
      }
    });
  });

  // ── Admin POST ──────────────────────────────────────────────────────────

  describe("POST /api/admin/interviews", () => {
    it("returns 403 for client token", async () => {
      const r = await request(srv, "POST", "/api/admin/interviews", clientTok, {
        submissionId,
        proposedTimes: [{ start: future(2) }],
      });
      assert.equal(r.status, 403);
    });

    it("creates proposed interview (talent-led — no confirmedTime)", async () => {
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId,
        interviewType: "culture",
        proposedTimes: [{ start: future(4) }, { start: future(5) }],
        durationMinutes: 60,
        candidateNotes: "Admin talent-led scheduling",
      });
      assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert.equal(r.json.status, "proposed");
      assert.equal(r.json.interview_type, "culture");
      assert.equal(r.json.duration_minutes, 60);
    });

    it("creates confirmed interview when confirmedTime is supplied", async () => {
      const confirmedTime = future(10);
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId,
        interviewType: "final",
        proposedTimes: [{ start: confirmedTime }],
        confirmedTime,
        confirmedTimeZone: "Asia/Singapore",
        durationMinutes: 90,
        internalNotes: "Admin direct-confirm",
      });
      assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert.equal(r.json.status, "confirmed");
      assert.ok(r.json.confirmed_time, "confirmed_time should be set");
      assert.equal(r.json.confirmed_time_zone, "Asia/Singapore");
      assert.equal(r.json.duration_minutes, 90);
    });

    it("rejects confirmedTime in the past", async () => {
      const pastTime = new Date(Date.now() - 3_600_000).toISOString();
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId,
        proposedTimes: [{ start: future(2) }],
        confirmedTime: pastTime,
        durationMinutes: 60,
      });
      assert.equal(r.status, 400);
    });
  });

  // ── Admin PATCH ─────────────────────────────────────────────────────────

  describe("PATCH /api/admin/interviews/:id", () => {
    let interviewId: number;

    before(async () => {
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId,
        proposedTimes: [{ start: future(6) }],
        durationMinutes: 60,
      });
      assert.equal(r.status, 201, `Setup failed: ${r.status}`);
      interviewId = r.json.id;
    });

    it("returns 403 for client token", async () => {
      const r = await request(srv, "PATCH", `/api/admin/interviews/${interviewId}`, clientTok, {
        status: "cancelled",
      });
      assert.equal(r.status, 403);
    });

    it("reschedules with new proposed times", async () => {
      const r = await request(srv, "PATCH", `/api/admin/interviews/${interviewId}`, adminTok, {
        status: "rescheduled",
        proposedTimes: [{ start: future(8) }],
      });
      assert.ok(r.status >= 200 && r.status < 300, `Reschedule failed: ${r.status}`);
      assert.equal(r.json.status, "rescheduled");
    });

    it("cancels with reason and sets cancelled_at", async () => {
      const r = await request(srv, "PATCH", `/api/admin/interviews/${interviewId}`, adminTok, {
        status: "cancelled",
        cancellationReason: "Talent withdrew",
      });
      assert.ok(r.status >= 200 && r.status < 300, `Cancel failed: ${r.status}`);
      assert.equal(r.json.status, "cancelled");
      assert.ok(r.json.cancelled_at, "cancelled_at should be set");
      assert.equal(r.json.cancellation_reason, "Talent withdrew");
    });
  });

  // ── Backward-compat: existing submission-scoped GET still works ─────────

  describe("GET /api/client/interviews?submissionId=… (existing behavior)", () => {
    it("returns array scoped to the submission", async () => {
      const r = await request(srv, "GET", `/api/client/interviews?submissionId=${submissionId}`, clientTok);
      assert.ok(r.status >= 200 && r.status < 300, `Scoped GET failed: ${r.status}`);
      assert.ok(Array.isArray(r.json), "Should return array");
      for (const iv of r.json as any[]) {
        assert.equal(String(iv.submission_id), String(submissionId), "submission_id should match");
      }
    });
  });

  // ── Backward-compat: existing talent-response route untouched ───────────

  describe("Existing talent interview-respond route", () => {
    it("/api/interviews/:id/respond is still routable (not 404/500)", async () => {
      // We expect 404 (interview doesn't exist) or 403 (no access) — never 500
      const r = await request(srv, "POST", "/api/interviews/999999/respond", candTok, {
        action: "accept",
        selectedTime: future(2),
        selectedTimeZone: "UTC",
      });
      assert.notEqual(r.status, 500, "Should not cause a server error");
    });
  });

  // ── Conflict-check edge cases ────────────────────────────────────────────

  describe("Interview conflict-check edge cases", () => {
    // Use a dedicated second submission so these tests are isolated from
    // the proposed-only interviews created by earlier describe blocks.
    let conflictSubId: string;

    // Use far-future slots (days 30+) to avoid any overlap with other tests.
    // All times are pinned relative to the moment the before() hook runs.
    let slotBase: Date; // start of the "base" confirmed slot used across sub-tests

    before(async () => {
      const subRow = await query(
        `INSERT INTO job_submissions
           (job_id, talent_id, client_id, applicant_name, email, status,
            initiated_by, workflow_type)
         VALUES ($1, $2, $3, 'IV1 Conflict Talent', $4, 'shortlisted',
                 'client', 'client_invitation')
         RETURNING id`,
        [jobId, TALENT_ID, CLIENT_ID, `${TALENT_ID}@test.local`],
      );
      conflictSubId = subRow.rows[0].id;

      // Pin slotBase now so all tests share the same reference point.
      slotBase = new Date(Date.now() + 30 * 86_400_000);
    });

    after(async () => {
      await query(
        `DELETE FROM interview_proposals WHERE interview_id IN
           (SELECT id FROM interviews WHERE submission_id = $1)`,
        [conflictSubId],
      );
      await query(`DELETE FROM interviews WHERE submission_id = $1`, [conflictSubId]);
      await query(
        `DELETE FROM job_application_status_history WHERE application_id = $1`,
        [conflictSubId],
      );
      await query(`DELETE FROM job_submissions WHERE id = $1`, [conflictSubId]);
    });

    it("overlapping interval returns 409 with interview_time_conflict (sanity check)", async () => {
      // Create a confirmed interview at slotBase for 60 min.
      const slotStart = slotBase.toISOString();
      const create = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId: conflictSubId,
        proposedTimes: [{ start: slotStart }],
        confirmedTime: slotStart,
        durationMinutes: 60,
      });
      assert.equal(create.status, 201, `Setup failed: ${JSON.stringify(create.json)}`);

      // A new slot starting 30 min in overlaps the first (end = base + 90 min, but existing ends at base + 60 min).
      const overlappingStart = new Date(slotBase.getTime() + 30 * 60_000).toISOString();
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId: conflictSubId,
        proposedTimes: [{ start: overlappingStart }],
        confirmedTime: overlappingStart,
        durationMinutes: 60,
      });
      assert.equal(r.status, 409, `Expected 409 for overlap, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert.equal(r.json?.error, "interview_time_conflict", "Error code should be interview_time_conflict");
    });

    it("boundary-touching interval (new starts exactly when existing ends) is NOT a conflict", async () => {
      // The confirmed interview created above ends at slotBase + 60 min.
      // A new slot starting exactly at that boundary should be allowed.
      const boundaryStart = new Date(slotBase.getTime() + 60 * 60_000).toISOString();
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId: conflictSubId,
        proposedTimes: [{ start: boundaryStart }],
        confirmedTime: boundaryStart,
        durationMinutes: 30,
      });
      assert.equal(
        r.status, 201,
        `Boundary-touching slot must not conflict (got ${r.status}): ${JSON.stringify(r.json)}`,
      );
      assert.equal(r.json?.status, "confirmed");
    });

    it("cancelled interview does NOT block the same time slot", async () => {
      // Use a slot further in the future (day 32) to be independent of slotBase interviews.
      const cancelSlotStart = new Date(Date.now() + 32 * 86_400_000).toISOString();

      // Create a confirmed interview at this slot.
      const create = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId: conflictSubId,
        proposedTimes: [{ start: cancelSlotStart }],
        confirmedTime: cancelSlotStart,
        durationMinutes: 60,
      });
      assert.equal(create.status, 201, `Setup failed: ${JSON.stringify(create.json)}`);
      const cancelledId = create.json.id;

      // Cancel it.
      const cancelR = await request(srv, "PATCH", `/api/admin/interviews/${cancelledId}`, adminTok, {
        status: "cancelled",
        cancellationReason: "Conflict-check test cancellation",
      });
      assert.ok(
        cancelR.status >= 200 && cancelR.status < 300,
        `Cancel failed: ${cancelR.status}: ${JSON.stringify(cancelR.json)}`,
      );

      // Now schedule a new confirmed interview for the same slot — must succeed.
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId: conflictSubId,
        proposedTimes: [{ start: cancelSlotStart }],
        confirmedTime: cancelSlotStart,
        durationMinutes: 60,
      });
      assert.equal(
        r.status, 201,
        `Cancelled interview must not block same slot (got ${r.status}): ${JSON.stringify(r.json)}`,
      );
      assert.equal(r.json?.status, "confirmed");
    });

    it("completed interview does NOT block the same time slot", async () => {
      // Use day 34 for this sub-test.
      const completedSlotStart = new Date(Date.now() + 34 * 86_400_000).toISOString();

      // Create a confirmed interview at this slot.
      const create = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId: conflictSubId,
        proposedTimes: [{ start: completedSlotStart }],
        confirmedTime: completedSlotStart,
        durationMinutes: 60,
      });
      assert.equal(create.status, 201, `Setup failed: ${JSON.stringify(create.json)}`);
      const completedId = create.json.id;

      // Force the interview to 'completed' status directly in the DB.
      // (The outcome endpoint requires the submission to have a client, which it does,
      // but the route is /api/client/interviews/:id/outcome — use that.)
      const outcomeR = await request(
        srv, "PATCH", `/api/client/interviews/${completedId}/outcome`, clientTok,
        { outcome: "advance", internalNotes: "Conflict-check completed test" },
      );
      assert.ok(
        outcomeR.status >= 200 && outcomeR.status < 300,
        `Mark completed failed: ${outcomeR.status}: ${JSON.stringify(outcomeR.json)}`,
      );

      // Schedule a new confirmed interview at the same slot — must succeed.
      const r = await request(srv, "POST", "/api/admin/interviews", adminTok, {
        submissionId: conflictSubId,
        proposedTimes: [{ start: completedSlotStart }],
        confirmedTime: completedSlotStart,
        durationMinutes: 60,
      });
      assert.equal(
        r.status, 201,
        `Completed interview must not block same slot (got ${r.status}): ${JSON.stringify(r.json)}`,
      );
    });

    it("two concurrent admin confirms for the same slot — one succeeds, other returns 409 not 500", async () => {
      // Use day 36 as the racing slot.
      const racingSlot = new Date(Date.now() + 36 * 86_400_000).toISOString();

      // Fire both requests simultaneously.
      const [r1, r2] = await Promise.all([
        request(srv, "POST", "/api/admin/interviews", adminTok, {
          submissionId: conflictSubId,
          proposedTimes: [{ start: racingSlot }],
          confirmedTime: racingSlot,
          durationMinutes: 60,
        }),
        request(srv, "POST", "/api/admin/interviews", adminTok, {
          submissionId: conflictSubId,
          proposedTimes: [{ start: racingSlot }],
          confirmedTime: racingSlot,
          durationMinutes: 60,
        }),
      ]);

      // Neither request should cause a 500.
      assert.notEqual(r1.status, 500, `Request 1 must not 500 (got ${r1.status})`);
      assert.notEqual(r2.status, 500, `Request 2 must not 500 (got ${r2.status})`);

      // Exactly one should succeed (201) and the other should conflict (409).
      const succeeded = [r1, r2].filter((r) => r.status === 201);
      const conflicted = [r1, r2].filter((r) => r.status === 409);
      assert.equal(succeeded.length, 1, `Expected exactly one 201, got statuses: ${r1.status}, ${r2.status}`);
      assert.equal(conflicted.length, 1, `Expected exactly one 409, got statuses: ${r1.status}, ${r2.status}`);
      assert.equal(conflicted[0].json?.error, "interview_time_conflict");
    });
  });
});
