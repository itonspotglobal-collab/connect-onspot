/**
 * message-threads.test.ts
 *
 * Route-level integration tests for the client↔talent messaging authorization
 * model (same middleware chain + SQL as the production handlers in routes.ts):
 *
 *   POST /api/message-threads                       — gated on accepted invitation
 *   GET  /api/me/message-threads                    — own threads only
 *   GET  /api/message-threads/:threadId/messages    — participants only
 *   POST /api/messages                              — participants only, sender forced
 *   POST /api/talent/invitations/:id/respond accept — creates thread transactionally
 *
 * Coverage:
 *  (a) No token → 401 on every messaging endpoint
 *  (b) Client cannot open a thread with a talent BEFORE acceptance (403) —
 *      pre-accept name disclosure via the inbox is therefore impossible
 *  (c) Accepting an invitation creates the thread and returns threadId
 *  (d) Accept is idempotent thread-wise: a second accepted submission for the
 *      same pair/job reuses the thread
 *  (e) After acceptance, explicit thread creation succeeds and is idempotent
 *  (f) A third user (non-participant) cannot read or post to the thread (403)
 *  (g) Participants can list their threads, read messages, and send; the
 *      senderId is always the authenticated user (spoofing is ignored)
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query, pool } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";

const CLIENT_ID = "msgtest-client-user";
const TALENT_ID = "msgtest-talent-user";
const OUTSIDER_ID = "msgtest-outsider-user";
const JOB_ID = "msgtest-job-1";

function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, email: `${userId}@example.com`, role },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

// ── Minimal Express app mirroring the production messaging routes ─────────────
function buildMessagingTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Simplified mirror of authenticateJWT (standard-token path)
  const auth = (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.userId) return res.status(401).json({ error: "Unauthorized" });
      (req as any).user = { id: decoded.userId, email: decoded.email, role: decoded.role };
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };

  const uid = (req: Request) => (req as any).user?.id as string;

  // POST /api/message-threads — mirrors production gating
  app.post("/api/message-threads", auth, async (req, res) => {
    const userId = uid(req);
    const participants: string[] = Array.from(new Set(req.body.participants ?? []));
    if (participants.length !== 2 || !participants.includes(userId)) {
      return res.status(403).json({ error: "Threads must have exactly two participants, including yourself" });
    }
    const otherId = participants.find((p) => p !== userId)!;
    const rel = await query(
      `SELECT job_id FROM job_submissions
       WHERE ((client_id = $1 AND talent_id = $2) OR (client_id = $2 AND talent_id = $1))
         AND initiated_by = 'client'
         AND status IN ('submitted', 'new', 'under_review', 'reviewed', 'shortlisted', 'interview', 'offered', 'hired')
       ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [userId, otherId],
    );
    if (!rel.rows.length) {
      return res.status(403).json({ error: "Messaging requires an accepted invitation between both parties" });
    }
    const jobId = rel.rows[0].job_id ?? null;
    const existing = await query(
      `SELECT id FROM message_threads
       WHERE participants @> ARRAY[$1, $2]::text[] AND participants <@ ARRAY[$1, $2]::text[]
         AND (job_id = $3 OR ($3::text IS NULL AND job_id IS NULL)) LIMIT 1`,
      [userId, otherId, jobId],
    );
    if (existing.rows.length) {
      return res.status(200).json({ id: existing.rows[0].id, reused: true });
    }
    const created = await query(
      `INSERT INTO message_threads (job_id, participants, subject)
       VALUES ($1, ARRAY[$2, $3]::text[], $4) RETURNING id`,
      [jobId, userId, otherId, req.body.subject ?? null],
    );
    return res.status(201).json({ id: created.rows[0].id, reused: false });
  });

  // GET /api/me/message-threads
  app.get("/api/me/message-threads", auth, async (req, res) => {
    const userId = uid(req);
    const threads = await query(
      `SELECT id, participants FROM message_threads WHERE $1 = ANY(participants)`,
      [userId],
    );
    res.json({ userId, threads: threads.rows });
  });

  // GET /api/message-threads/:threadId/messages — participants only
  app.get("/api/message-threads/:threadId/messages", auth, async (req, res) => {
    const userId = uid(req);
    const t = await query(`SELECT participants FROM message_threads WHERE id = $1`, [req.params.threadId]);
    if (!t.rows.length) return res.status(404).json({ error: "Thread not found" });
    if (!t.rows[0].participants.includes(userId)) {
      return res.status(403).json({ error: "Not a participant of this thread" });
    }
    const msgs = await query(
      `SELECT id, sender_id AS "senderId", content FROM messages WHERE thread_id = $1 ORDER BY created_at`,
      [req.params.threadId],
    );
    res.json(msgs.rows);
  });

  // POST /api/messages — participants only, sender forced to authed user
  app.post("/api/messages", auth, async (req, res) => {
    const userId = uid(req);
    const { threadId, content } = req.body;
    const t = await query(`SELECT participants FROM message_threads WHERE id = $1`, [threadId]);
    if (!t.rows.length) return res.status(404).json({ error: "Thread not found" });
    if (!t.rows[0].participants.includes(userId)) {
      return res.status(403).json({ error: "Not a participant of this thread" });
    }
    const created = await query(
      `INSERT INTO messages (thread_id, sender_id, content) VALUES ($1, $2, $3)
       RETURNING id, sender_id AS "senderId", content`,
      [threadId, userId, content],
    );
    res.status(201).json(created.rows[0]);
  });

  // POST /api/talent/invitations/:id/respond — mirrors production accept transaction
  app.post("/api/talent/invitations/:id/respond", auth, async (req, res) => {
    const userId = uid(req);
    const { id } = req.params;
    const { action } = req.body;
    const check = await query(
      `SELECT id FROM job_submissions WHERE id = $1 AND talent_id = $2`,
      [id, userId],
    );
    if (!check.rows.length) return res.status(404).json({ error: "Invitation not found" });

    const newStatus = action === "accept" ? "submitted" : "declined";
    if (action !== "accept") {
      const declined = await query(
        `UPDATE job_submissions SET status = $1, updated_at = NOW()
         WHERE id = $2 AND talent_id = $3 AND status = 'invited' RETURNING id`,
        [newStatus, id, userId],
      );
      if (!declined.rows.length) return res.status(409).json({ error: "No longer pending" });
      return res.json({ status: newStatus, threadId: null });
    }
    let threadId: string;
    const tx = await pool.connect();
    try {
      await tx.query("BEGIN");
      const updated = await tx.query(
        `UPDATE job_submissions SET status = $1, updated_at = NOW()
         WHERE id = $2 AND talent_id = $3 AND status = 'invited'
         RETURNING client_id, job_id`,
        [newStatus, id, userId],
      );
      if (!updated.rows.length) {
        await tx.query("ROLLBACK");
        return res.status(409).json({ error: "No longer pending" });
      }
      const { client_id: clientId, job_id: jobId } = updated.rows[0];
      const jobRow = jobId ? await tx.query(`SELECT title FROM jobs WHERE id = $1`, [jobId]) : { rows: [] as any[] };
      const jobTitle = jobRow.rows[0]?.title ?? null;
      if (!clientId || clientId === userId) throw new Error("Invitation has no valid inviting client");
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || COALESCE($3, '')))`,
        [clientId, userId, jobId ?? null],
      );
      const existing = await tx.query(
        `SELECT id FROM message_threads
         WHERE participants @> ARRAY[$1, $2]::text[] AND participants <@ ARRAY[$1, $2]::text[]
           AND (job_id = $3 OR ($3::text IS NULL AND job_id IS NULL)) LIMIT 1`,
        [clientId, userId, jobId],
      );
      if (existing.rows.length) {
        threadId = existing.rows[0].id;
      } else {
        const created = await tx.query(
          `INSERT INTO message_threads (job_id, participants, subject)
           VALUES ($1, ARRAY[$2, $3]::text[], $4) RETURNING id`,
          [jobId ?? null, clientId, userId, jobTitle ? `Invitation accepted — ${jobTitle}` : "Invitation accepted"],
        );
        threadId = created.rows[0].id;
        await tx.query(
          `INSERT INTO messages (thread_id, sender_id, content, message_type)
           VALUES ($1, $2, $3, 'system')`,
          [threadId, userId, "Invitation accepted."],
        );
      }
      await tx.query("COMMIT");
    } catch (e) {
      await tx.query("ROLLBACK").catch(() => {});
      return res.status(500).json({ error: "Failed to accept invitation. Please try again." });
    } finally {
      tx.release();
    }
    return res.json({ status: newStatus, threadId });
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

function request(
  srv: http.Server,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const { port } = srv.address() as any;
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: "127.0.0.1", port, method, path,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
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

// ── Fixtures ───────────────────────────────────────────────────────────────────
async function cleanup() {
  await query(
    `DELETE FROM messages WHERE thread_id IN (
       SELECT id FROM message_threads WHERE participants && ARRAY[$1, $2, $3]::text[])`,
    [CLIENT_ID, TALENT_ID, OUTSIDER_ID],
  );
  await query(
    `DELETE FROM message_threads WHERE participants && ARRAY[$1, $2, $3]::text[]`,
    [CLIENT_ID, TALENT_ID, OUTSIDER_ID],
  );
  await query(`DELETE FROM job_submissions WHERE client_id = $1`, [CLIENT_ID]);
  await query(`DELETE FROM jobs WHERE id = $1`, [JOB_ID]);
  await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [CLIENT_ID, TALENT_ID, OUTSIDER_ID]);
}

async function seed() {
  await cleanup();
  await query(
    `INSERT INTO users (id, email, role, first_name, last_name)
     VALUES ($1, 'msgtest-client@example.com', 'client', 'Msg', 'Client'),
            ($2, 'msgtest-talent@example.com', 'talent', 'Msg', 'Talent'),
            ($3, 'msgtest-outsider@example.com', 'client', 'Msg', 'Outsider')`,
    [CLIENT_ID, TALENT_ID, OUTSIDER_ID],
  );
  await query(
    `INSERT INTO jobs (id, client_id, title, category, description, status, experience_level)
     VALUES ($1, $2, 'Msgtest Job', 'other', 'test', 'active', 'mid')`,
    [JOB_ID, CLIENT_ID],
  );
}

async function insertInvitation(status = "invited"): Promise<string> {
  const r = await query(
    `INSERT INTO job_submissions (id, job_id, client_id, applicant_name, first_name, last_name, email, status, initiated_by, talent_id, registration_status)
     VALUES (gen_random_uuid(), $1, $2, 'Msg Talent', 'Msg', 'Talent', 'msgtest-talent@example.com', $3, 'client', $4, 'linked')
     RETURNING id`,
    [JOB_ID, CLIENT_ID, status, TALENT_ID],
  );
  return r.rows[0].id;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("messaging authorization model", () => {
  let srv: http.Server;
  const clientTok = makeToken(CLIENT_ID, "client");
  const talentTok = makeToken(TALENT_ID, "talent");
  const outsiderTok = makeToken(OUTSIDER_ID, "client");

  before(async () => {
    await seed();
    srv = await startServer(buildMessagingTestApp());
  });

  after(async () => {
    srv?.close();
    await cleanup();
  });

  it("(a) rejects every messaging endpoint without a token", async () => {
    assert.equal((await request(srv, "GET", "/api/me/message-threads")).status, 401);
    assert.equal((await request(srv, "POST", "/api/message-threads", undefined, { participants: [CLIENT_ID, TALENT_ID] })).status, 401);
    assert.equal((await request(srv, "POST", "/api/messages", undefined, { threadId: "x", content: "hi" })).status, 401);
  });

  it("(b2) an ordinary talent application does NOT open a messaging channel", async () => {
    // A talent-initiated, submitted application between the same pair must not count
    const r = await query(
      `INSERT INTO job_submissions (id, job_id, client_id, applicant_name, first_name, last_name, email, status, initiated_by, talent_id, registration_status)
       VALUES (gen_random_uuid(), $1, $2, 'Msg Talent', 'Msg', 'Talent', 'msgtest-talent@example.com', 'submitted', 'talent', $3, 'linked')
       RETURNING id`,
      [JOB_ID, CLIENT_ID, TALENT_ID],
    );
    const asClient = await request(srv, "POST", "/api/message-threads", clientTok, {
      participants: [CLIENT_ID, TALENT_ID],
    });
    assert.equal(asClient.status, 403);
    const asTalent = await request(srv, "POST", "/api/message-threads", talentTok, {
      participants: [CLIENT_ID, TALENT_ID],
    });
    assert.equal(asTalent.status, 403);
    await query(`DELETE FROM job_submissions WHERE id = $1`, [r.rows[0].id]);
  });

  it("(b) blocks a client from opening a thread before the talent accepts", async () => {
    // Even with a pending (invited) submission, creation must be rejected.
    await insertInvitation("invited");
    const res = await request(srv, "POST", "/api/message-threads", clientTok, {
      participants: [CLIENT_ID, TALENT_ID],
    });
    assert.equal(res.status, 403);
    // And with no relationship at all (outsider → talent)
    const res2 = await request(srv, "POST", "/api/message-threads", outsiderTok, {
      participants: [OUTSIDER_ID, TALENT_ID],
    });
    assert.equal(res2.status, 403);
    // No thread must exist — the inbox therefore cannot disclose any name
    const inbox = await request(srv, "GET", "/api/me/message-threads", clientTok);
    assert.equal(inbox.json.threads.length, 0);
  });

  let threadId: string;

  it("(c) accepting an invitation creates the thread and returns threadId", async () => {
    const invId = await insertInvitation("invited");
    // (b) left one pending invitation; respond to the new one
    const res = await request(srv, "POST", `/api/talent/invitations/${invId}/respond`, talentTok, { action: "accept" });
    assert.equal(res.status, 200);
    assert.equal(res.json.status, "submitted");
    assert.ok(res.json.threadId, "accept response must include threadId");
    threadId = res.json.threadId;
  });

  it("(d) a second acceptance for the same pair/job reuses the thread", async () => {
    const invId = await insertInvitation("invited");
    const res = await request(srv, "POST", `/api/talent/invitations/${invId}/respond`, talentTok, { action: "accept" });
    assert.equal(res.status, 200);
    assert.equal(res.json.threadId, threadId);
  });

  it("(e) explicit thread creation after acceptance succeeds and is idempotent", async () => {
    const res = await request(srv, "POST", "/api/message-threads", clientTok, {
      participants: [CLIENT_ID, TALENT_ID],
    });
    assert.ok([200, 201].includes(res.status));
    assert.equal(res.json.id, threadId); // reuses the accept-created thread
  });

  it("(f) a non-participant cannot read or post to the thread", async () => {
    const read = await request(srv, "GET", `/api/message-threads/${threadId}/messages`, outsiderTok);
    assert.equal(read.status, 403);
    const post = await request(srv, "POST", "/api/messages", outsiderTok, { threadId, content: "intruding" });
    assert.equal(post.status, 403);
  });

  it("(h) concurrent accept + decline: exactly one wins; no thread if decline wins", async () => {
    // Use a separate job to isolate thread state from earlier tests
    await query(
      `INSERT INTO jobs (id, client_id, title, category, description, status, experience_level)
       VALUES ('msgtest-job-2', $1, 'Msgtest Job 2', 'other', 'test', 'active', 'mid')
       ON CONFLICT (id) DO NOTHING`,
      [CLIENT_ID],
    );
    const r = await query(
      `INSERT INTO job_submissions (id, job_id, client_id, applicant_name, first_name, last_name, email, status, initiated_by, talent_id, registration_status)
       VALUES (gen_random_uuid(), 'msgtest-job-2', $1, 'Msg Talent', 'Msg', 'Talent', 'msgtest-talent@example.com', 'invited', 'client', $2, 'linked')
       RETURNING id`,
      [CLIENT_ID, TALENT_ID],
    );
    const invId = r.rows[0].id;
    const [a, d] = await Promise.all([
      request(srv, "POST", `/api/talent/invitations/${invId}/respond`, talentTok, { action: "accept" }),
      request(srv, "POST", `/api/talent/invitations/${invId}/respond`, talentTok, { action: "decline" }),
    ]);
    const statuses = [a.status, d.status].sort();
    assert.deepEqual(statuses, [200, 409], "exactly one request must win");
    const final = await query(`SELECT status FROM job_submissions WHERE id = $1`, [invId]);
    const threadCount = await query(
      `SELECT COUNT(*)::int AS n FROM message_threads WHERE job_id = 'msgtest-job-2'`,
    );
    if (final.rows[0].status === "declined") {
      assert.equal(threadCount.rows[0].n, 0, "no thread may exist after a decline win");
    } else {
      assert.equal(final.rows[0].status, "submitted");
      assert.equal(threadCount.rows[0].n, 1);
    }
    await query(`DELETE FROM messages WHERE thread_id IN (SELECT id FROM message_threads WHERE job_id = 'msgtest-job-2')`);
    await query(`DELETE FROM message_threads WHERE job_id = 'msgtest-job-2'`);
    await query(`DELETE FROM job_submissions WHERE id = $1`, [invId]);
    await query(`DELETE FROM jobs WHERE id = 'msgtest-job-2'`);
  });

  it("(i) concurrent accepts on two invitations for the same pair/job create one thread", async () => {
    const mk = () => insertInvitation("invited");
    const [i1, i2] = await Promise.all([mk(), mk()]);
    const [r1, r2] = await Promise.all([
      request(srv, "POST", `/api/talent/invitations/${i1}/respond`, talentTok, { action: "accept" }),
      request(srv, "POST", `/api/talent/invitations/${i2}/respond`, talentTok, { action: "accept" }),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.json.threadId, r2.json.threadId, "both accepts must land on the same thread");
  });

  it("(g) participants can list, read, and send; senderId is the authed user", async () => {
    const inbox = await request(srv, "GET", "/api/me/message-threads", talentTok);
    assert.equal(inbox.status, 200);
    assert.ok(inbox.json.threads.some((t: any) => t.id === threadId));

    const sent = await request(srv, "POST", "/api/messages", clientTok, {
      threadId, content: "Can we schedule an interview?", senderId: OUTSIDER_ID, // spoof attempt
    });
    assert.equal(sent.status, 201);
    assert.equal(sent.json.senderId, CLIENT_ID); // spoofed senderId ignored

    const msgs = await request(srv, "GET", `/api/message-threads/${threadId}/messages`, talentTok);
    assert.equal(msgs.status, 200);
    assert.ok(msgs.json.some((m: any) => m.content === "Can we schedule an interview?"));
  });
});
