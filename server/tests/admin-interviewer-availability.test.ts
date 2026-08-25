/**
 * Admin Interviewer Availability — Route Smoke Tests
 *
 * Covers:
 * - Admin-only access enforcement for both endpoints
 * - Parameter validation (missing, invalid date ranges, bad timezone, bad duration)
 * - Calendar-not-connected handling (422 when calendarEmail is empty)
 * - Microsoft Graph not configured (503 when credentials missing)
 * - No application status changes when availability is checked
 *
 * Run with: npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-fallback-secret";
const TS = Date.now();

const ADMIN_ID  = `avail-smoke-admin-${TS}`;
const CLIENT_ID = `avail-smoke-client-${TS}`;
const TALENT_ID = `avail-smoke-talent-${TS}`;

const adminToken  = jwt.sign({ userId: ADMIN_ID,  email: `avail-admin-${TS}@onspotglobal.com`,  role: "admin"  }, JWT_SECRET, { expiresIn: "1h" });
const clientToken = jwt.sign({ userId: CLIENT_ID, email: `avail-client-${TS}@example.com`, role: "client" }, JWT_SECRET, { expiresIn: "1h" });
const talentToken = jwt.sign({ userId: TALENT_ID, email: `avail-talent-${TS}@example.com`, role: "talent" }, JWT_SECRET, { expiresIn: "1h" });

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(
  server: http.Server,
  method: string,
  path: string,
  token?: string,
): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => {
          let json: any = null;
          try { json = JSON.parse(body); } catch { /* non-JSON */ }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let server: http.Server;

before(async () => {
  // Insert minimal user rows so authenticateJWT can resolve the role
  await query(
    `INSERT INTO users (id, email, role)
     VALUES ($1, $2, 'admin'), ($3, $4, 'client'), ($5, $6, 'talent')
     ON CONFLICT (id) DO NOTHING`,
    [
      ADMIN_ID,  `avail-admin-${TS}@onspotglobal.com`,
      CLIENT_ID, `avail-client-${TS}@example.com`,
      TALENT_ID, `avail-talent-${TS}@example.com`,
    ],
  );

  const app = express();
  app.use(express.json());
  await registerRoutes(app);
  server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await query("DELETE FROM users WHERE id = ANY($1::text[])", [[ADMIN_ID, CLIENT_ID, TALENT_ID]]).catch(() => {});
});

// ── GET /api/admin/interviewers — access control ──────────────────────────────

describe("GET /api/admin/interviewers — access control", () => {
  it("returns 401 without a token", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewers");
    assert.equal(status, 401);
  });

  it("returns 403 for a client token", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewers", clientToken);
    assert.equal(status, 403);
  });

  it("returns 403 for a talent token", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewers", talentToken);
    assert.equal(status, 403);
  });

  it("returns 200 with an interviewer array for an admin token", async () => {
    const { status, json } = await request(server, "GET", "/api/admin/interviewers", adminToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.interviewers), "response.interviewers should be an array");
  });

  it("never exposes calendarEmail in the response", async () => {
    const { json } = await request(server, "GET", "/api/admin/interviewers", adminToken);
    for (const iv of json.interviewers ?? []) {
      assert.ok(!Object.prototype.hasOwnProperty.call(iv, "calendarEmail"), "calendarEmail must not be returned");
    }
  });

  it("each interviewer has id, name, title, and isCalendarConnected", async () => {
    const { json } = await request(server, "GET", "/api/admin/interviewers", adminToken);
    for (const iv of json.interviewers ?? []) {
      assert.ok(typeof iv.id === "string",   "id should be a string");
      assert.ok(typeof iv.name === "string", "name should be a string");
      assert.ok(typeof iv.title === "string", "title should be a string");
      assert.ok(typeof iv.isCalendarConnected === "boolean", "isCalendarConnected should be a boolean");
    }
  });
});

// ── GET /api/admin/interviewer-availability — access control ──────────────────

describe("GET /api/admin/interviewer-availability — access control", () => {
  const qs = "?interviewerId=ta-lead&startDate=2030-01-06&endDate=2030-01-07&duration=30&timezone=UTC";

  it("returns 401 without a token", async () => {
    const { status } = await request(server, "GET", `/api/admin/interviewer-availability${qs}`);
    assert.equal(status, 401);
  });

  it("returns 403 for a client token", async () => {
    const { status } = await request(server, "GET", `/api/admin/interviewer-availability${qs}`, clientToken);
    assert.equal(status, 403);
  });

  it("returns 403 for a talent token", async () => {
    const { status } = await request(server, "GET", `/api/admin/interviewer-availability${qs}`, talentToken);
    assert.equal(status, 403);
  });
});

// ── GET /api/admin/interviewer-availability — parameter validation ─────────────

describe("GET /api/admin/interviewer-availability — parameter validation", () => {
  it("returns 400 when interviewerId is missing", async () => {
    const { status, json } = await request(server, "GET", "/api/admin/interviewer-availability?startDate=2030-01-06&endDate=2030-01-07&duration=30&timezone=UTC", adminToken);
    assert.equal(status, 400);
    assert.match(json.error ?? json.message ?? "", /missing/i);
  });

  it("returns 400 when startDate is missing", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&endDate=2030-01-07&duration=30&timezone=UTC", adminToken);
    assert.equal(status, 400);
  });

  it("returns 400 when endDate is missing", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-06&duration=30&timezone=UTC", adminToken);
    assert.equal(status, 400);
  });

  it("returns 400 when duration is missing", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-06&endDate=2030-01-07&timezone=UTC", adminToken);
    assert.equal(status, 400);
  });

  it("returns 400 when timezone is missing", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-06&endDate=2030-01-07&duration=30", adminToken);
    assert.equal(status, 400);
  });

  it("returns 400 when startDate is after endDate", async () => {
    const { status, json } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-10&endDate=2030-01-07&duration=30&timezone=UTC", adminToken);
    assert.equal(status, 400);
    assert.match(json.error ?? "", /after/i);
  });

  it("returns 400 when date range exceeds 14 days", async () => {
    const { status, json } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-01&endDate=2030-01-20&duration=30&timezone=UTC", adminToken);
    assert.equal(status, 400);
    assert.match(json.error ?? "", /14 day/i);
  });

  it("returns 400 for invalid duration value (15)", async () => {
    const { status, json } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-06&endDate=2030-01-07&duration=15&timezone=UTC", adminToken);
    assert.equal(status, 400);
    assert.match(json.error ?? "", /duration/i);
  });

  it("returns 400 for an invalid timezone string", async () => {
    const { status, json } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-06&endDate=2030-01-07&duration=30&timezone=Not%2FA%2FTimezone", adminToken);
    assert.equal(status, 400);
    assert.match(json.error ?? "", /timezone/i);
  });

  it("returns 404 for an unknown interviewerId", async () => {
    const { status } = await request(server, "GET", "/api/admin/interviewer-availability?interviewerId=unknown-id-xyz&startDate=2030-01-06&endDate=2030-01-07&duration=30&timezone=UTC", adminToken);
    assert.equal(status, 404);
  });

  it("returns 422 or 503 for built-in interviewers with no calendarEmail", async () => {
    // Built-in interviewers have empty calendarEmail — should return 422 (calendar_not_connected)
    // or 503 (microsoft_graph_not_configured) in a test environment without secrets.
    const { status, json } = await request(
      server,
      "GET",
      "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-06&endDate=2030-01-07&duration=30&timezone=UTC",
      adminToken,
    );
    assert.ok(
      status === 422 || status === 503,
      `Expected 422 or 503, got ${status}: ${JSON.stringify(json)}`,
    );
    if (status === 422) {
      assert.equal(json.error, "calendar_not_connected");
    } else {
      assert.equal(json.error, "microsoft_graph_not_configured");
    }
  });
});

// ── No status side effects ────────────────────────────────────────────────────

describe("GET /api/admin/interviewer-availability — no status side effects", () => {
  it("does not write any submission_status_history rows when availability is checked", async () => {
    const beforeResult = await query(
      "SELECT COUNT(*) AS cnt FROM job_application_status_history WHERE changed_by = $1",
      [ADMIN_ID],
    );
    const before = parseInt(beforeResult.rows[0].cnt, 10);

    // Fire the request — will return 422 or 503 in test env (no real calendar)
    await request(
      server,
      "GET",
      "/api/admin/interviewer-availability?interviewerId=ta-lead&startDate=2030-01-06&endDate=2030-01-07&duration=30&timezone=UTC",
      adminToken,
    );

    const afterResult = await query(
      "SELECT COUNT(*) AS cnt FROM job_application_status_history WHERE changed_by = $1",
      [ADMIN_ID],
    );
    const after = parseInt(afterResult.rows[0].cnt, 10);

    assert.equal(after, before, "No status history rows should be written by an availability check");
  });
});
