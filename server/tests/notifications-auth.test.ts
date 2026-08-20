/**
 * notifications-auth.test.ts
 *
 * Route-level integration tests for the authenticated notification endpoints:
 *   GET   /api/talent/notifications           (candidateTalentJWT, resolves candidateId → users.id)
 *   PATCH /api/talent/notifications/:id/read  (candidateTalentJWT, ownership check)
 *   GET   /api/users/:userId/notifications    (main JWT, ownership check)
 *   PATCH /api/notifications/:id/read         (main JWT, ownership check)
 *
 * Coverage:
 *  (a) Talent portal JWT → GET /api/talent/notifications returns offer_received + new_message rows
 *  (b) Talent portal JWT → PATCH /api/talent/notifications/:id/read marks the row; cross-user denied
 *  (c) Missing token → 401 on GET /api/talent/notifications
 *  (d) Main JWT → GET /api/users/:userId/notifications returns the caller's notifications
 *  (e) Main JWT with mismatched userId → 403 on GET /api/users/:userId/notifications
 *  (f) Main JWT → PATCH /api/notifications/:id/read marks the row; cross-user denied
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { DbStorage } from "../storage.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const storage = new DbStorage();

// ── Token factories ────────────────────────────────────────────────────────────

function makeCandidateToken(candidateId: string, email: string): string {
  return jwt.sign({ type: "candidate", candidateId, email }, JWT_SECRET, { expiresIn: "1h" });
}

function makeUserToken(userId: string, role = "talent"): string {
  return jwt.sign({ userId, email: `${userId}@test.example`, role }, JWT_SECRET, { expiresIn: "1h" });
}

// ── Minimal test server ────────────────────────────────────────────────────────
//
// Mirrors the real middleware chain for the four notification endpoints without
// spinning up the full 14,000-line registerRoutes() function.

function buildNotifTestApp(): Express {
  const app = express();
  app.use(express.json());

  // ── authenticateTalentJWT (mirrors routes.ts) ────────────────────────────────
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

  // ── authenticateJWT (simplified mirror — main JWT only, no candidate token path) ──
  const mainAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Authentication required" });
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      // Reject candidate tokens on this middleware path
      if (decoded.type === "candidate") return res.status(401).json({ error: "Use /api/talent/ endpoints" });
      if (!decoded.userId) return res.status(401).json({ error: "Invalid token" });
      (req as any).user = { id: decoded.userId, role: decoded.role ?? "talent" };
      next();
    } catch (e: any) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };

  // GET /api/talent/notifications
  app.get("/api/talent/notifications", talentAuth, async (req: Request, res: Response) => {
    try {
      const { candidateId, email } = (req as any).talentAuth;
      let linkedUserId: string | null = null;
      const candRow = await query(`SELECT email FROM candidates WHERE id = $1 LIMIT 1`, [candidateId]);
      const candidateEmail: string = candRow.rows[0]?.email ?? email;
      if (candidateEmail) {
        const userRow = await query(
          `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
          [candidateEmail],
        );
        linkedUserId = userRow.rows[0]?.id ?? null;
      }
      if (!linkedUserId) return res.json([]);
      const unreadOnly = req.query.unread_only === "true";
      const notifs = await storage.listNotificationsByUser(linkedUserId, unreadOnly);
      res.json(notifs);
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  // PATCH /api/talent/notifications/:id/read
  app.patch("/api/talent/notifications/:id/read", talentAuth, async (req: Request, res: Response) => {
    try {
      const { candidateId, email } = (req as any).talentAuth;
      let linkedUserId: string | null = null;
      const candRow = await query(`SELECT email FROM candidates WHERE id = $1 LIMIT 1`, [candidateId]);
      const candidateEmail: string = candRow.rows[0]?.email ?? email;
      if (candidateEmail) {
        const userRow = await query(
          `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
          [candidateEmail],
        );
        linkedUserId = userRow.rows[0]?.id ?? null;
      }
      if (!linkedUserId) return res.status(403).json({ error: "Forbidden" });
      const notifRow = await query(
        `SELECT user_id FROM notifications WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      if (!notifRow.rows.length) return res.status(404).json({ error: "Not found" });
      if (notifRow.rows[0].user_id !== linkedUserId) return res.status(403).json({ error: "Forbidden" });
      await storage.markNotificationAsRead(req.params.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  // GET /api/users/:userId/notifications
  app.get("/api/users/:userId/notifications", mainAuth, async (req: Request, res: Response) => {
    try {
      const authedUser = (req as any).user;
      if (authedUser.role !== "admin" && authedUser.id !== req.params.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const unreadOnly = req.query.unread_only === "true";
      const notifs = await storage.listNotificationsByUser(req.params.userId, unreadOnly);
      res.json(notifs);
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  // PATCH /api/notifications/:id/read
  app.patch("/api/notifications/:id/read", mainAuth, async (req: Request, res: Response) => {
    try {
      const authedUser = (req as any).user;
      const notifRow = await query(
        `SELECT user_id FROM notifications WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      if (!notifRow.rows.length) return res.status(404).json({ error: "Not found" });
      if (authedUser.role !== "admin" && notifRow.rows[0].user_id !== authedUser.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.markNotificationAsRead(req.params.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  return app;
}

function startServer(app: Express): Promise<http.Server> {
  return new Promise((resolve) => {
    const srv = http.createServer(app);
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function stopServer(srv: http.Server): Promise<void> {
  return new Promise((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve())));
}

async function req(
  srv: http.Server,
  method: string,
  path: string,
  opts: { token?: string } = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = srv.address() as { port: number };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
    const r = http.request(
      { hostname: "127.0.0.1", port: addr.port, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : null });
        });
      },
    );
    r.on("error", reject);
    r.end();
  });
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

describe("notification endpoint authorization", () => {
  let srv: http.Server;
  let talentUserId: string;
  let otherUserId: string;
  let candidateId: string;
  const notifIds: string[] = [];
  const talentEmail = `notif-auth-talent-${Date.now()}@example.com`;
  const otherEmail  = `notif-auth-other-${Date.now()}@example.com`;

  before(async () => {
    srv = await startServer(buildNotifTestApp());

    // Create two test users
    const t = await query(
      `INSERT INTO users (email, role, password_hash) VALUES ($1,'talent','x') RETURNING id`,
      [talentEmail],
    );
    talentUserId = t.rows[0].id;

    const o = await query(
      `INSERT INTO users (email, role, password_hash) VALUES ($1,'talent','x') RETURNING id`,
      [otherEmail],
    );
    otherUserId = o.rows[0].id;

    // Create a candidate row linked to the talent user (same email)
    const c = await query(
      `INSERT INTO candidates (email, full_name) VALUES ($1, 'Notif Talent') RETURNING id`,
      [talentEmail],
    );
    candidateId = c.rows[0].id;

    // Seed offer, application-status, and message notifications for talentUserId.
    const n1 = await storage.createNotification({
      userId: talentUserId,
      type: "offer_received",
      title: "New offer",
      message: "You have a new offer.",
      relatedId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
      relatedType: "offer",
    });
    const n2 = await storage.createNotification({
      userId: talentUserId,
      type: "new_message",
      title: "New message",
      message: "Someone sent you a message.",
      relatedId: null,
      relatedType: null,
    });
    const n3 = await storage.createNotification({
      userId: talentUserId,
      type: "job_application_status_changed",
      title: "Application update",
      message: "Your application for a role is now Under Review.",
      relatedId: "00000000-0000-0000-0000-bbbbbbbbbbbb",
      relatedType: "job_submission",
    });
    notifIds.push(n1.id, n2.id, n3.id);
  });

  after(async () => {
    await stopServer(srv);
    if (notifIds.length) {
      await query(`DELETE FROM notifications WHERE id = ANY($1::text[])`, [notifIds]).catch(() => {});
    }
    await query(`DELETE FROM candidates WHERE id = $1`, [candidateId]).catch(() => {});
    await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[talentUserId, otherUserId]]).catch(() => {});
  });

  // ── (a) Talent portal JWT fetches offer, application, and message notifications ─
  it("(a) candidate JWT: GET /api/talent/notifications returns job_application_status_changed rows", async () => {
    const token = makeCandidateToken(candidateId, talentEmail);
    const { status, body } = await req(srv, "GET", "/api/talent/notifications", { token });
    assert.equal(status, 200, "must return 200");
    assert.ok(Array.isArray(body), "body must be an array");
    const types = body.map((n: any) => n.type);
    assert.ok(types.includes("offer_received"), "must include offer_received");
    assert.ok(types.includes("new_message"), "must include new_message");
    assert.ok(types.includes("job_application_status_changed"), "must include application status updates");
  });

  // ── (b) Mark-read endpoint verifies ownership ─────────────────────────────────
  it("(b) candidate JWT: PATCH /api/talent/notifications/:id/read marks the row read", async () => {
    const token = makeCandidateToken(candidateId, talentEmail);
    const notifId = notifIds[0]; // offer_received
    const { status } = await req(srv, "PATCH", `/api/talent/notifications/${notifId}/read`, { token });
    assert.equal(status, 204, "must return 204 on success");
    // Verify it is now marked read
    const rows = await storage.listNotificationsByUser(talentUserId, false);
    const notif = rows.find((n) => n.id === notifId);
    assert.ok(notif, "notification must still exist");
    assert.equal(notif!.isRead, true, "notification must be marked read");
  });

  it("(b.cross) candidate JWT: PATCH /api/talent/notifications/:id/read denied for another user's notification", async () => {
    // Create a notification for otherUserId
    const n = await storage.createNotification({
      userId: otherUserId,
      type: "offer_received",
      title: "Other offer",
      message: "For the other user.",
      relatedId: null,
      relatedType: null,
    });
    notifIds.push(n.id);
    const token = makeCandidateToken(candidateId, talentEmail);
    const { status } = await req(srv, "PATCH", `/api/talent/notifications/${n.id}/read`, { token });
    assert.equal(status, 403, "cross-user mark-read must be denied with 403");
  });

  // ── (c) Missing token → 401 ───────────────────────────────────────────────────
  it("(c) missing token: GET /api/talent/notifications returns 401", async () => {
    const { status } = await req(srv, "GET", "/api/talent/notifications");
    assert.equal(status, 401, "must require authentication");
  });

  // ── (d) Main JWT → GET /api/users/:userId/notifications ──────────────────────
  it("(d) main JWT: GET /api/users/:userId/notifications returns caller's notifications", async () => {
    const token = makeUserToken(talentUserId);
    const { status, body } = await req(srv, "GET", `/api/users/${talentUserId}/notifications`, { token });
    assert.equal(status, 200, "must return 200");
    assert.ok(Array.isArray(body), "body must be an array");
  });

  // ── (e) Main JWT with mismatched userId → 403 ─────────────────────────────────
  it("(e) main JWT: GET /api/users/:userId/notifications with mismatched userId returns 403", async () => {
    const token = makeUserToken(talentUserId);
    const { status } = await req(srv, "GET", `/api/users/${otherUserId}/notifications`, { token });
    assert.equal(status, 403, "mismatched userId must be denied with 403");
  });

  // ── (f) Main JWT mark-read + cross-user denial ────────────────────────────────
  it("(f) main JWT: PATCH /api/notifications/:id/read marks own notification read; denies cross-user", async () => {
    // Mark the second notification (new_message) as read via main JWT
    const notifId = notifIds[1];
    const token = makeUserToken(talentUserId);
    const { status } = await req(srv, "PATCH", `/api/notifications/${notifId}/read`, { token });
    assert.equal(status, 204, "must return 204 on success");

    // Cross-user denial: talentUserId token cannot mark otherUserId's notification
    const crossNotif = await storage.createNotification({
      userId: otherUserId,
      type: "offer_accepted",
      title: "Offer accepted",
      message: "Cross-user test.",
      relatedId: null,
      relatedType: null,
    });
    notifIds.push(crossNotif.id);
    const { status: crossStatus } = await req(srv, "PATCH", `/api/notifications/${crossNotif.id}/read`, { token });
    assert.equal(crossStatus, 403, "cross-user mark-read via main JWT must be denied with 403");
  });
});
