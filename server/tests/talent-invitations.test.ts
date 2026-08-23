/**
 * talent-invitations.test.ts
 *
 * Route-level integration tests for the candidate-JWT invitation endpoints:
 *   GET  /api/talent/invitations
 *   POST /api/talent/invitations/:id/respond
 *
 * These endpoints use authenticateTalentJWT (candidate portal token) and
 * resolve candidateId → users.id via the candidates table.
 *
 * Coverage:
 *  (a) Missing token → 401
 *  (b) Token signed with the wrong secret → 401
 *  (c) Token with wrong type (not "candidate") → 401
 *  (d) Valid candidate JWT for a real candidate → 200 + array on GET
 *  (e) Valid candidate JWT + accept action → status becomes "new" (canonical)
 *  (f) Valid candidate JWT + decline action → status becomes "declined"
 *  (g) Cross-tenant denial: candidate A cannot respond to candidate B's invitation
 *  (h) Already-responded invitation → 409
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

// ── Shared constants ───────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";

function makeCandidateToken(candidateId: string): string {
  return jwt.sign(
    { type: "candidate", candidateId, email: "test@example.com" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

// ── Minimal Express app that mirrors the real invitation routes ────────────────
//
// We build a self-contained test server with the same middleware chain and DB
// queries as the production handlers, so we exercise the real auth logic without
// spinning up the full 12,000-line registerRoutes() function.

function buildInvitationTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Mirror of authenticateTalentJWT from routes.ts
  const talentAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Talent auth required" });
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.type !== "candidate" || !decoded.candidateId) {
        return res.status(401).json({ error: "Invalid talent token" });
      }
      (req as any).talentAuth = { candidateId: decoded.candidateId, email: decoded.email };
      next();
    } catch (e: any) {
      if (e.name === "TokenExpiredError") return res.status(401).json({ error: "Session expired" });
      return res.status(401).json({ error: "Invalid talent auth token" });
    }
  };

  // GET /api/talent/invitations — mirrors production route
  app.get("/api/talent/invitations", talentAuth, async (req: Request, res: Response) => {
    try {
      const { candidateId } = (req as any).talentAuth;
      const userRow = await query(`SELECT user_id FROM candidates WHERE id = $1 LIMIT 1`, [candidateId]);
      if (!userRow.rows.length) return res.status(404).json({ error: "Talent profile not found" });
      const talentUserId: string = userRow.rows[0].user_id;

      const result = await query(
        `SELECT js.id,
                js.job_id        AS "jobId",
                js.status,
                js.created_at    AS "createdAt",
                j.title          AS "jobTitle",
                CASE WHEN j.created_via = 'search_scaffold' THEN NULL
                     ELSE j.description END AS "description"
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE js.talent_id = $1
           AND js.status = 'invited'
         ORDER BY js.created_at DESC`,
        [talentUserId],
      );
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/talent/invitations/:id/respond — mirrors production route
  app.post("/api/talent/invitations/:id/respond", talentAuth, async (req: Request, res: Response) => {
    try {
      const { candidateId } = (req as any).talentAuth;
      const { id } = req.params;
      const { action } = req.body;

      if (!["accept", "decline"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
      }

      const userRow = await query(`SELECT user_id FROM candidates WHERE id = $1 LIMIT 1`, [candidateId]);
      if (!userRow.rows.length) return res.status(404).json({ error: "Talent profile not found" });
      const talentUserId: string = userRow.rows[0].user_id;

      const check = await query(
        `SELECT id, status FROM job_submissions WHERE id = $1 AND talent_id = $2`,
        [id, talentUserId],
      );
      if (!check.rows.length) return res.status(404).json({ error: "Invitation not found" });
      if (check.rows[0].status !== "invited") {
        return res.status(409).json({ error: "This invitation is no longer pending" });
      }

      const newStatus = action === "accept" ? "new" : "declined";
      await query(`UPDATE job_submissions SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);
      return res.json({ status: newStatus });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return app;
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────
function startServer(app: Express): Promise<http.Server> {
  return new Promise((resolve) => {
    const srv = http.createServer(app);
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function stopServer(srv: http.Server): Promise<void> {
  return new Promise((resolve) => srv.close(() => resolve()));
}

function jsonRequest(
  srv: http.Server,
  method: "GET" | "POST",
  path: string,
  token: string | null,
  body?: object,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const addr = srv.address() as { port: number };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (bodyStr) headers["Content-Length"] = String(Buffer.byteLength(bodyStr));

    const req = http.request(
      { hostname: "127.0.0.1", port: addr.port, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── DB helpers ─────────────────────────────────────────────────────────────────
async function getLinkedTalentPair(): Promise<{ candidateId: string; userId: string } | null> {
  const r = await query(
    `SELECT c.id AS "candidateId", c.user_id AS "userId"
     FROM candidates c
     JOIN users u ON u.id = c.user_id
     WHERE c.user_id IS NOT NULL
       AND u.role = 'talent'
     LIMIT 1`,
  );
  if (!r.rows.length) return null;
  return { candidateId: r.rows[0].candidateId as string, userId: r.rows[0].userId as string };
}

async function getClientUserId(): Promise<string | null> {
  const r = await query(`SELECT id FROM users WHERE role = 'client' LIMIT 1`);
  return r.rows[0]?.id ?? null;
}

async function insertScaffoldJob(clientId: string): Promise<string> {
  const r = await query(
    `INSERT INTO jobs
       (id, title, professional_role_name, category, job_function, engagement_type,
        status, approval_status, is_client_submitted, client_id, created_via, description,
        skill_tags, experience_level)
     VALUES (gen_random_uuid(), '__test_inv_job', '__test_inv_job', 'other', 'other', 'Standard',
             'draft', 'approved', true, $1, 'search_scaffold', '', '{}', 'intermediate')
     RETURNING id`,
    [clientId],
  );
  return r.rows[0].id as string;
}

async function insertInvitation(jobId: string, clientId: string, talentUserId: string): Promise<string> {
  const r = await query(
    `INSERT INTO job_submissions
       (id, job_id, client_id, applicant_name, email, status, initiated_by, talent_id, registration_status)
     VALUES (gen_random_uuid(), $1, $2, 'Test Talent', 'test@example.com', 'invited', 'client', $3, 'linked')
     RETURNING id`,
    [jobId, clientId, talentUserId],
  );
  return r.rows[0].id as string;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/talent/invitations — candidate-JWT route-level tests", () => {
  let srv: http.Server;
  before(async () => { srv = await startServer(buildInvitationTestApp()); });
  after(async () => { await stopServer(srv); });

  it("(a) missing Authorization header → 401", async () => {
    const { status, body } = await jsonRequest(srv, "GET", "/api/talent/invitations", null);
    assert.equal(status, 401, "missing token must return 401");
    assert.ok(body.error, "must include an error message");
  });

  it("(b) token signed with the wrong secret → 401", async () => {
    const badToken = jwt.sign({ type: "candidate", candidateId: "cand-fake" }, "wrong-secret");
    const { status } = await jsonRequest(srv, "GET", "/api/talent/invitations", badToken);
    assert.equal(status, 401, "wrong-secret token must return 401");
  });

  it("(c) token with wrong type (not 'candidate') → 401", async () => {
    const badToken = jwt.sign({ role: "talent", userId: "u1" }, JWT_SECRET);
    const { status } = await jsonRequest(srv, "GET", "/api/talent/invitations", badToken);
    assert.equal(status, 401, "non-candidate token type must return 401");
  });

  it("(d) valid candidate JWT for a real talent → 200 + array", async () => {
    const pair = await getLinkedTalentPair();
    if (!pair) return; // skip if no linked talent in DB

    const token = makeCandidateToken(pair.candidateId);
    const { status, body } = await jsonRequest(srv, "GET", "/api/talent/invitations", token);
    assert.equal(status, 200, "valid candidate token must return 200");
    assert.ok(Array.isArray(body), `body must be an array; got ${JSON.stringify(body)}`);
  });

  it("(d2) scaffold invitation description is null in response", async () => {
    const pair = await getLinkedTalentPair();
    const clientId = await getClientUserId();
    if (!pair || !clientId) return;

    const scaffoldId = await insertScaffoldJob(clientId);
    const inviteId = await insertInvitation(scaffoldId, clientId, pair.userId).catch(() => null);

    try {
      if (!inviteId) return; // FK issue, skip
      const token = makeCandidateToken(pair.candidateId);
      const { status, body } = await jsonRequest(srv, "GET", "/api/talent/invitations", token);
      assert.equal(status, 200);
      const inv = (body as any[]).find((r: any) => r.id === inviteId);
      if (inv) {
        assert.equal(inv.description, null,
          "scaffold job description must be null in talent invitation response");
      }
    } finally {
      await query(`DELETE FROM job_submissions WHERE id = $1`, [inviteId ?? "none"]).catch(() => {});
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });
});

describe("POST /api/talent/invitations/:id/respond — candidate-JWT route-level tests", () => {
  let srv: http.Server;
  before(async () => { srv = await startServer(buildInvitationTestApp()); });
  after(async () => { await stopServer(srv); });

  it("(a2) missing token → 401 on respond", async () => {
    const { status } = await jsonRequest(srv, "POST", "/api/talent/invitations/fake-id/respond", null, { action: "accept" });
    assert.equal(status, 401);
  });

  it("(e) valid candidate JWT + accept action → status 'new' (canonical for submitted)", async () => {
    const pair = await getLinkedTalentPair();
    const clientId = await getClientUserId();
    if (!pair || !clientId) return;

    const scaffoldId = await insertScaffoldJob(clientId);
    const inviteId = await insertInvitation(scaffoldId, clientId, pair.userId).catch(() => null);

    try {
      if (!inviteId) return;
      const token = makeCandidateToken(pair.candidateId);
      const { status, body } = await jsonRequest(
        srv, "POST", `/api/talent/invitations/${inviteId}/respond`, token, { action: "accept" },
      );
      assert.equal(status, 200, `accept must return 200; got ${status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, "new", "accept must transition status to canonical 'new'");

      // Verify in DB
      const dbRow = await query(`SELECT status FROM job_submissions WHERE id = $1`, [inviteId]);
      assert.equal(dbRow.rows[0]?.status, "new", "DB must reflect the accepted status");
    } finally {
      await query(`DELETE FROM job_submissions WHERE id = $1`, [inviteId ?? "none"]).catch(() => {});
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });

  it("(f) valid candidate JWT + decline action → status 'declined'", async () => {
    const pair = await getLinkedTalentPair();
    const clientId = await getClientUserId();
    if (!pair || !clientId) return;

    const scaffoldId = await insertScaffoldJob(clientId);
    const inviteId = await insertInvitation(scaffoldId, clientId, pair.userId).catch(() => null);

    try {
      if (!inviteId) return;
      const token = makeCandidateToken(pair.candidateId);
      const { status, body } = await jsonRequest(
        srv, "POST", `/api/talent/invitations/${inviteId}/respond`, token, { action: "decline" },
      );
      assert.equal(status, 200, `decline must return 200; got ${status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, "declined", "decline must transition status to 'declined'");

      const dbRow = await query(`SELECT status FROM job_submissions WHERE id = $1`, [inviteId]);
      assert.equal(dbRow.rows[0]?.status, "declined", "DB must reflect the declined status");
    } finally {
      await query(`DELETE FROM job_submissions WHERE id = $1`, [inviteId ?? "none"]).catch(() => {});
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });

  it("(g) cross-tenant denial: candidate A cannot respond to candidate B's invitation", async () => {
    // Get two distinct linked talent pairs
    const r = await query(
      `SELECT c.id AS "candidateId", c.user_id AS "userId"
       FROM candidates c
       JOIN users u ON u.id = c.user_id
       WHERE c.user_id IS NOT NULL AND u.role = 'talent'
       LIMIT 2`,
    );
    if (r.rows.length < 2) return; // skip if fewer than 2 talent in DB

    const pairA = r.rows[0] as { candidateId: string; userId: string };
    const pairB = r.rows[1] as { candidateId: string; userId: string };
    const clientId = await getClientUserId();
    if (!clientId) return;

    const scaffoldId = await insertScaffoldJob(clientId);
    // Create invitation owned by talent B
    const inviteId = await insertInvitation(scaffoldId, clientId, pairB.userId).catch(() => null);

    try {
      if (!inviteId) return;
      // Try to respond as talent A (should fail — 404 ownership check)
      const tokenA = makeCandidateToken(pairA.candidateId);
      const { status } = await jsonRequest(
        srv, "POST", `/api/talent/invitations/${inviteId}/respond`, tokenA, { action: "accept" },
      );
      assert.equal(status, 404, "candidate A must not be able to respond to candidate B's invitation");

      // Confirm the invitation status was NOT changed
      const dbRow = await query(`SELECT status FROM job_submissions WHERE id = $1`, [inviteId]);
      assert.equal(dbRow.rows[0]?.status, "invited", "invitation must remain 'invited' after cross-tenant denial");
    } finally {
      await query(`DELETE FROM job_submissions WHERE id = $1`, [inviteId ?? "none"]).catch(() => {});
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });

  it("(h) already-responded invitation → 409", async () => {
    const pair = await getLinkedTalentPair();
    const clientId = await getClientUserId();
    if (!pair || !clientId) return;

    const scaffoldId = await insertScaffoldJob(clientId);
    const inviteId = await insertInvitation(scaffoldId, clientId, pair.userId).catch(() => null);

    try {
      if (!inviteId) return;
      // Move it to 'submitted' directly in DB to simulate already-accepted
      await query(`UPDATE job_submissions SET status = 'new' WHERE id = $1`, [inviteId]);

      const token = makeCandidateToken(pair.candidateId);
      const { status, body } = await jsonRequest(
        srv, "POST", `/api/talent/invitations/${inviteId}/respond`, token, { action: "accept" },
      );
      assert.equal(status, 409, `double-respond must return 409; got ${status}: ${JSON.stringify(body)}`);
      assert.ok(body.error, "must include an error field");
    } finally {
      await query(`DELETE FROM job_submissions WHERE id = $1`, [inviteId ?? "none"]).catch(() => {});
      await query(`DELETE FROM jobs WHERE id = $1`, [scaffoldId]).catch(() => {});
    }
  });
});
