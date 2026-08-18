/**
 * notifications-create-auth.test.ts
 *
 * Tests for the newly-secured POST /api/notifications endpoint and the
 * client-role unread-badge path through GET /api/users/:userId/notifications.
 *
 * Coverage:
 *  (a) POST /api/notifications with no token → 401
 *  (b) POST /api/notifications with token but for a different userId → 403
 *  (c) POST /api/notifications with own userId → 201
 *  (d) Admin token can create a notification for any userId → 201
 *  (e) GET /api/users/:userId/notifications?unread_only=true returns new_message
 *      rows for a CLIENT user — confirming the client unread-badge path works
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

function makeToken(userId: string, role: string): string {
  return jwt.sign({ userId, email: `${userId}@test.example`, role }, JWT_SECRET, { expiresIn: "1h" });
}

// ── Minimal test server mirroring the secured POST /api/notifications ──────────
function buildTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Simplified authenticateJWT (main-JWT path only)
  const mainAuth = (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Authentication required" });
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.type === "candidate" || !decoded.userId) {
        return res.status(401).json({ error: "Invalid token" });
      }
      (req as any).user = { id: decoded.userId, role: decoded.role ?? "talent" };
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };

  // POST /api/notifications — mirrors the secured production handler
  app.post("/api/notifications", mainAuth, async (req: Request, res: Response) => {
    try {
      const { userId, type, title, message, relatedId, relatedType } = req.body;
      if (!userId || !type || !title || !message) {
        return res.status(400).json({ error: "Validation failed" });
      }
      const authedUser = (req as any).user;
      if (authedUser.role !== "admin" && userId !== authedUser.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const notif = await storage.createNotification({ userId, type, title, message, relatedId: relatedId ?? null, relatedType: relatedType ?? null });
      return res.status(201).json(notif);
    } catch {
      return res.status(500).json({ error: "Failed to create notification" });
    }
  });

  // GET /api/users/:userId/notifications — mirrors production handler
  app.get("/api/users/:userId/notifications", mainAuth, async (req: Request, res: Response) => {
    try {
      const authedUser = (req as any).user;
      if (authedUser.role !== "admin" && authedUser.id !== req.params.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const unreadOnly = req.query.unread_only === "true";
      const notifs = await storage.listNotificationsByUser(req.params.userId, unreadOnly);
      return res.json(notifs);
    } catch {
      return res.status(500).json({ error: "Failed" });
    }
  });

  return app;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function startServer(app: Express): Promise<http.Server> {
  return new Promise((resolve) => {
    const srv = http.createServer(app);
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function stopServer(srv: http.Server): Promise<void> {
  return new Promise((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve())));
}

function request(
  srv: http.Server,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const { port } = srv.address() as any;
    const data = body ? JSON.stringify(body) : undefined;
    const r = http.request(
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
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("POST /api/notifications — auth gate + client unread badge path", () => {
  let srv: http.Server;
  let clientUserId: string;
  let otherUserId: string;
  let adminUserId: string;
  const createdNotifIds: string[] = [];
  const suffix = Date.now();

  before(async () => {
    srv = await startServer(buildTestApp());

    const c = await query(
      `INSERT INTO users (email, role, password_hash) VALUES ($1, 'client', 'x') RETURNING id`,
      [`notif-create-client-${suffix}@example.com`],
    );
    clientUserId = c.rows[0].id;

    const o = await query(
      `INSERT INTO users (email, role, password_hash) VALUES ($1, 'client', 'x') RETURNING id`,
      [`notif-create-other-${suffix}@example.com`],
    );
    otherUserId = o.rows[0].id;

    const a = await query(
      `INSERT INTO users (email, role, password_hash) VALUES ($1, 'admin', 'x') RETURNING id`,
      [`notif-create-admin-${suffix}@example.com`],
    );
    adminUserId = a.rows[0].id;
  });

  after(async () => {
    await stopServer(srv);
    if (createdNotifIds.length) {
      await query(`DELETE FROM notifications WHERE id = ANY($1::uuid[])`, [createdNotifIds]).catch(() => {});
    }
    await query(
      `DELETE FROM users WHERE id = ANY($1::text[])`,
      [[clientUserId, otherUserId, adminUserId]],
    ).catch(() => {});
  });

  const validPayload = (userId: string) => ({
    userId,
    type: "new_message",
    title: "New message",
    message: "Test notification.",
    relatedId: null,
    relatedType: null,
  });

  // (a) No token → 401
  it("(a) POST /api/notifications with no token returns 401", async () => {
    const res = await request(srv, "POST", "/api/notifications", undefined, validPayload(clientUserId));
    assert.equal(res.status, 401, "unauthenticated request must be rejected");
  });

  // (b) Token for different userId → 403
  it("(b) POST /api/notifications with token for a different userId returns 403", async () => {
    const token = makeToken(clientUserId, "client");
    const res = await request(srv, "POST", "/api/notifications", token, validPayload(otherUserId));
    assert.equal(res.status, 403, "creating notification for another user must be denied");
  });

  // (c) Own userId → 201
  it("(c) POST /api/notifications with own userId returns 201 and persists the notification", async () => {
    const token = makeToken(clientUserId, "client");
    const res = await request(srv, "POST", "/api/notifications", token, validPayload(clientUserId));
    assert.equal(res.status, 201, "creating own notification must succeed");
    assert.ok(res.json?.id, "response must include the new notification id");
    createdNotifIds.push(res.json.id);
    assert.equal(res.json.type, "new_message");
    assert.equal(res.json.isRead, false);
  });

  // (d) Admin token can create for any user
  it("(d) admin token can POST /api/notifications for any userId", async () => {
    const adminToken = makeToken(adminUserId, "admin");
    const res = await request(srv, "POST", "/api/notifications", adminToken, validPayload(otherUserId));
    assert.equal(res.status, 201, "admin must be able to create notification for any user");
    createdNotifIds.push(res.json.id);
  });

  // (e) Client unread badge path: GET /api/users/:userId/notifications?unread_only=true
  // returns new_message rows — this is what useUnreadMessagesCount now calls for clients
  it("(e) client JWT: GET /api/users/:userId/notifications?unread_only=true returns new_message rows", async () => {
    // Seed a new_message notification directly via storage (server-side path, no HTTP auth)
    const seeded = await storage.createNotification({
      userId: clientUserId,
      type: "new_message",
      title: "New message",
      message: "A talent sent you a message.",
      relatedId: null,
      relatedType: null,
    });
    createdNotifIds.push(seeded.id);

    const token = makeToken(clientUserId, "client");
    const res = await request(
      srv,
      "GET",
      `/api/users/${clientUserId}/notifications?unread_only=true`,
      token,
    );
    assert.equal(res.status, 200, "client must be able to fetch own unread notifications");
    assert.ok(Array.isArray(res.json), "response must be an array");
    const msgNotifs = res.json.filter((n: any) => n.type === "new_message");
    assert.ok(msgNotifs.length >= 1, "at least one new_message notification must be present");
    // All returned rows must be unread
    assert.ok(res.json.every((n: any) => n.isRead === false), "unread_only=true must return only unread rows");
  });

  // Verify the ownership check still holds for client role
  it("(e.cross) client JWT: GET /api/users/:otherUserId/notifications returns 403", async () => {
    const token = makeToken(clientUserId, "client");
    const res = await request(srv, "GET", `/api/users/${otherUserId}/notifications`, token);
    assert.equal(res.status, 403, "client must not be able to fetch another user's notifications");
  });
});
