/**
 * message-threads-production.test.ts
 *
 * Exercises the PRODUCTION registered routes (via registerRoutes) — not a
 * mirrored implementation — to prove the consent invariant of the messaging
 * feature end-to-end:
 *
 *  1. Accepting a talent-initiated 'invited' submission is rejected (409) and
 *     creates NO message thread (no identity exposure without client consent).
 *  2. Accepting a client-initiated invitation succeeds, returns threadId, and
 *     both participants (and only they) can access the thread.
 *  3. A client cannot open a thread pre-acceptance via POST /api/message-threads.
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";
import { MAX_USER_MESSAGE_CHARS } from "../lib/messagePrivacyFilter.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";

const CLIENT_ID = "msgprod-client-user";
const TALENT_ID = "msgprod-talent-user";
const OUTSIDER_ID = "msgprod-outsider-user";
const CANDIDATE_ID = "msgprod-linked-candidate";
const LEGACY_CANDIDATE_ID = "msgprod-unlinked-candidate";
const JOB_ID = "msgprod-job-1";

const tok = (userId: string, role: string) =>
  jwt.sign({ userId, email: `${userId}@example.com`, role }, JWT_SECRET, { expiresIn: "1h" });

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

async function cleanup() {
  const policyTable = await query(
    `SELECT to_regclass('public.user_policy_acceptances') AS name`,
  );
  if (policyTable.rows[0]?.name) {
    await query(
      `DELETE FROM user_policy_acceptances WHERE user_id IN ($1, $2, $3)`,
      [CLIENT_ID, TALENT_ID, OUTSIDER_ID],
    );
  }
  await query(
    `DELETE FROM notifications WHERE user_id IN ($1, $2, $3)`,
    [CLIENT_ID, TALENT_ID, OUTSIDER_ID],
  );
  await query(
    `DELETE FROM messages WHERE thread_id IN (
       SELECT id FROM message_threads WHERE participants && ARRAY[$1, $2, $3]::text[])`,
    [CLIENT_ID, TALENT_ID, OUTSIDER_ID],
  );
  await query(`DELETE FROM message_threads WHERE participants && ARRAY[$1, $2, $3]::text[]`, [CLIENT_ID, TALENT_ID, OUTSIDER_ID]);
  await query(`DELETE FROM job_submissions WHERE client_id = $1`, [CLIENT_ID]);
  await query(`DELETE FROM jobs WHERE id = $1`, [JOB_ID]);
  await query(
    `DELETE FROM candidates WHERE id IN ($1, $2)`,
    [CANDIDATE_ID, LEGACY_CANDIDATE_ID],
  );
  await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [CLIENT_ID, TALENT_ID, OUTSIDER_ID]);
}

async function insertSubmission(initiatedBy: string, status = "invited"): Promise<string> {
  const r = await query(
    `INSERT INTO job_submissions (id, job_id, client_id, applicant_name, first_name, last_name, email, status, initiated_by, workflow_type, talent_id, registration_status)
     VALUES (gen_random_uuid(), $1, $2, 'Prod Talent', 'Prod', 'Talent', 'msgprod-talent@example.com', $3, $4, 'client_invitation', $5, 'linked')
     RETURNING id`,
    [JOB_ID, CLIENT_ID, status, initiatedBy, TALENT_ID],
  );
  return r.rows[0].id;
}

const threadCount = async () =>
  (await query(
    `SELECT COUNT(*)::int AS n FROM message_threads WHERE participants && ARRAY[$1, $2]::text[]`,
    [CLIENT_ID, TALENT_ID],
  )).rows[0].n as number;

describe("production messaging routes (registerRoutes)", () => {
  let srv: http.Server;
  let acceptedThreadId: string;
  const clientTok = tok(CLIENT_ID, "client");
  const talentTok = tok(TALENT_ID, "talent");
  const outsiderTok = tok(OUTSIDER_ID, "client");
  const candidateTok = jwt.sign(
    {
      type: "candidate",
      candidateId: CANDIDATE_ID,
      email: "msgprod-talent@example.com",
    },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
  const unlinkedCandidateTok = jwt.sign(
    {
      type: "candidate",
      candidateId: LEGACY_CANDIDATE_ID,
      email: "msgprod-unlinked@example.com",
    },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  before(async () => {
    await cleanup();
    await query(
      `INSERT INTO users (id, email, role, first_name, last_name)
       VALUES ($1, 'msgprod-client@example.com', 'client', 'Prod', 'Client'),
              ($2, 'msgprod-talent@example.com', 'talent', 'Prod', 'Talent'),
              ($3, 'msgprod-outsider@example.com', 'client', 'Prod', 'Outsider')`,
      [CLIENT_ID, TALENT_ID, OUTSIDER_ID],
    );
    await query(
      `INSERT INTO jobs (id, client_id, title, category, description, status, experience_level)
       VALUES ($1, $2, 'Msgprod Job', 'other', 'test', 'active', 'mid')`,
      [JOB_ID, CLIENT_ID],
    );
    await query(
      `INSERT INTO candidates (id, user_id, email)
       VALUES ($1, $2, 'msgprod-talent@example.com'),
              ($3, NULL, 'msgprod-unlinked@example.com')`,
      [CANDIDATE_ID, TALENT_ID, LEGACY_CANDIDATE_ID],
    );
    const app = express();
    app.use(express.json());
    const httpServer = await registerRoutes(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    srv = httpServer;
  });

  after(async () => {
    srv?.close();
    await cleanup();
  });

  it("reports the current messaging policy as unaccepted on first visit", async () => {
    const asClient = await request(srv, "GET", "/api/me/messaging-policy", clientTok);
    const asTalent = await request(srv, "GET", "/api/me/messaging-policy", talentTok);
    const asCandidate = await request(
      srv,
      "GET",
      "/api/me/messaging-policy",
      candidateTok,
    );
    assert.equal(asClient.status, 200);
    assert.equal(asTalent.status, 200);
    assert.equal(asCandidate.status, 200);
    assert.equal(asClient.json.accepted, false);
    assert.equal(asTalent.json.accepted, false);
    assert.equal(asCandidate.json.accepted, false);
    assert.equal(typeof asClient.json.currentVersion, "string");
    assert.ok(asClient.json.currentVersion.length > 0);
  });

  it("fails safely when a legacy candidate has no canonical messaging account", async () => {
    const status = await request(
      srv,
      "GET",
      "/api/me/messaging-policy",
      unlinkedCandidateTok,
    );
    assert.equal(status.status, 409);
    assert.equal(status.json.error, "messaging_account_link_required");

    const accepted = await request(
      srv,
      "POST",
      "/api/me/messaging-policy/accept",
      unlinkedCandidateTok,
      { version: "2026-08-28" },
    );
    assert.equal(accepted.status, 409);
    assert.equal(accepted.json.error, "messaging_account_link_required");

    const sent = await request(
      srv,
      "POST",
      "/api/messages",
      unlinkedCandidateTok,
      { threadId: "missing-thread", content: "Hello" },
    );
    assert.equal(sent.status, 409);
    assert.equal(sent.json.error, "messaging_account_link_required");

    const stored = await query(
      `SELECT COUNT(*)::int AS count
         FROM user_policy_acceptances
        WHERE user_id = $1`,
      [LEGACY_CANDIDATE_ID],
    );
    assert.equal(stored.rows[0].count, 0);
  });

  it("blocks an unaccepted user's direct API send without inserting a message", async () => {
    const before = await query(
      `SELECT COUNT(*)::int AS count FROM messages WHERE sender_id = $1`,
      [CLIENT_ID],
    );
    const sent = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: "missing-thread",
      content: "Hello",
    });
    assert.equal(sent.status, 403);
    assert.equal(sent.json.error, "messaging_policy_required");
    const afterCount = await query(
      `SELECT COUNT(*)::int AS count FROM messages WHERE sender_id = $1`,
      [CLIENT_ID],
    );
    assert.equal(afterCount.rows[0].count, before.rows[0].count);
  });

  it("rejects arbitrary versions and accepts the current policy for both roles", async () => {
    const status = await request(srv, "GET", "/api/me/messaging-policy", clientTok);
    const invalid = await request(
      srv,
      "POST",
      "/api/me/messaging-policy/accept",
      clientTok,
      { version: "future-version" },
    );
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.error, "invalid_messaging_policy_version");

    await query(
      `INSERT INTO user_policy_acceptances (user_id, policy_type, policy_version)
       VALUES ($1, 'messaging_communication', 'old-version')`,
      [CLIENT_ID],
    );
    const outdated = await request(srv, "GET", "/api/me/messaging-policy", clientTok);
    assert.equal(outdated.status, 200);
    assert.equal(outdated.json.accepted, false);
    assert.equal(outdated.json.version, "old-version");

    const clientAccepted = await request(
      srv,
      "POST",
      "/api/me/messaging-policy/accept",
      clientTok,
      { version: status.json.currentVersion },
    );
    const talentAccepted = await request(
      srv,
      "POST",
      "/api/me/messaging-policy/accept",
      talentTok,
      { version: status.json.currentVersion },
    );
    assert.equal(clientAccepted.status, 200);
    assert.equal(talentAccepted.status, 200);
    assert.equal(clientAccepted.json.accepted, true);
    assert.equal(talentAccepted.json.accepted, true);

    const acceptedAt = clientAccepted.json.acceptedAt;
    const revisited = await request(srv, "GET", "/api/me/messaging-policy", clientTok);
    assert.equal(revisited.json.accepted, true);
    assert.equal(revisited.json.acceptedAt, acceptedAt);
    const candidateRevisited = await request(
      srv,
      "GET",
      "/api/me/messaging-policy",
      candidateTok,
    );
    assert.equal(candidateRevisited.status, 200);
    assert.equal(candidateRevisited.json.accepted, true);
    assert.equal(candidateRevisited.json.acceptedAt, talentAccepted.json.acceptedAt);

    const stored = await query(
      `SELECT user_id, policy_version, accepted_at
         FROM user_policy_acceptances
        WHERE user_id IN ($1, $2)`,
      [CLIENT_ID, TALENT_ID],
    );
    assert.equal(stored.rows.length, 2);
    assert.ok(stored.rows.every((row: any) => row.accepted_at));
    assert.ok(
      stored.rows.every(
        (row: any) => row.policy_version === status.json.currentVersion,
      ),
    );
  });

  it("rejects accepting a talent-initiated 'invited' submission and creates no thread", async () => {
    const subId = await insertSubmission("talent", "invited");
    const res = await request(srv, "POST", `/api/talent/invitations/${subId}/respond`, talentTok, { action: "accept" });
    assert.equal(res.status, 409, `expected 409, got ${res.status}: ${JSON.stringify(res.json)}`);
    assert.equal(await threadCount(), 0, "no thread may exist for a talent-initiated submission");
    const row = await query(`SELECT status FROM job_submissions WHERE id = $1`, [subId]);
    assert.equal(row.rows[0].status, "invited", "status must be unchanged");
    await query(`DELETE FROM job_submissions WHERE id = $1`, [subId]);
  });

  it("blocks pre-accept explicit thread creation via the production route", async () => {
    await insertSubmission("client", "invited");
    const res = await request(srv, "POST", "/api/message-threads", clientTok, {
      participants: [CLIENT_ID, TALENT_ID],
    });
    assert.equal(res.status, 403);
    assert.equal(await threadCount(), 0);
  });

  it("concurrent explicit thread creations converge on a single thread", async () => {
    // An accepted client-initiated relationship already exists after this test
    // block seeds one; create it here to be self-contained.
    const subId = await insertSubmission("client", "new");
    const body = { participants: [CLIENT_ID, TALENT_ID] };
    const [r1, r2, r3] = await Promise.all([
      request(srv, "POST", "/api/message-threads", clientTok, body),
      request(srv, "POST", "/api/message-threads", clientTok, body),
      request(srv, "POST", "/api/message-threads", talentTok, body),
    ]);
    for (const r of [r1, r2, r3]) assert.ok([200, 201].includes(r.status), JSON.stringify(r.json));
    const ids = new Set([r1.json.id, r2.json.id, r3.json.id]);
    assert.equal(ids.size, 1, "all concurrent creations must return the same thread id");
    assert.equal(await threadCount(), 1, "exactly one thread row may exist");
    // Clean state for subsequent tests
    await query(`DELETE FROM messages WHERE thread_id = $1`, [r1.json.id]);
    await query(`DELETE FROM message_threads WHERE id = $1`, [r1.json.id]);
    await query(`DELETE FROM job_submissions WHERE id = $1`, [subId]);
  });

  it("accepting a client-initiated invitation creates the thread; access is participant-only", async () => {
    const subId = await insertSubmission("client", "invited");
    const res = await request(srv, "POST", `/api/talent/invitations/${subId}/respond`, talentTok, { action: "accept" });
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json.status, "new"); // canonical DB value; UI displays as 'submitted'
    assert.ok(res.json.threadId);
    const threadId = res.json.threadId;
    acceptedThreadId = threadId;

    // Participants can read; outsider cannot
    const asTalent = await request(srv, "GET", `/api/message-threads/${threadId}/messages`, talentTok);
    assert.equal(asTalent.status, 200);
    const asClient = await request(srv, "GET", `/api/message-threads/${threadId}/messages`, clientTok);
    assert.equal(asClient.status, 200);
    const asOutsider = await request(srv, "GET", `/api/message-threads/${threadId}/messages`, outsiderTok);
    assert.equal(asOutsider.status, 403);
    const unauth = await request(srv, "GET", `/api/message-threads/${threadId}/messages`);
    assert.equal(unauth.status, 401);
  });

  it("redacts and flags messages from both roles before persistence", async () => {
    assert.ok(acceptedThreadId);

    const clientInput =
      "Email val@gmail.com or call +639171234723. Password: hello123, please use it.";
    const clientSent = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: acceptedThreadId,
      content: clientInput,
      senderId: OUTSIDER_ID,
    });
    assert.equal(clientSent.status, 201, JSON.stringify(clientSent.json));
    assert.equal(
      clientSent.json.content,
      "Email *****.com or call ***4723. Password: ********, please use it.",
    );
    assert.equal(clientSent.json.senderId, CLIENT_ID);
    assert.equal(clientSent.json.privacyRedacted, true);
    assert.ok(clientSent.json.privacyCategories.includes("phone"));
    assert.ok(clientSent.json.privacyCategories.includes("credential"));
    assert.ok(
      clientSent.json.privacyCategories.includes("email") ||
        clientSent.json.privacyCategories.includes("obfuscated_contact"),
    );
    assert.ok(
      clientSent.json.privacyCategories.every((category: string) =>
        ["email", "phone", "credential", "token", "obfuscated_contact"].includes(category),
      ),
    );
    assert.ok(!JSON.stringify(clientSent.json).includes("val@gmail.com"));
    assert.ok(!JSON.stringify(clientSent.json).includes("hello123"));

    const talentSent = await request(srv, "POST", "/api/messages", candidateTok, {
      threadId: acceptedThreadId,
      content: "OTP is 839221; do not share it.",
    });
    assert.equal(talentSent.status, 201, JSON.stringify(talentSent.json));
    assert.equal(talentSent.json.content, "OTP is ******; do not share it.");
    assert.equal(talentSent.json.senderId, TALENT_ID);
    assert.equal(talentSent.json.privacyRedacted, true);
    assert.deepEqual(talentSent.json.privacyCategories, ["credential"]);

    const persisted = await query(
      `SELECT content, flagged_for_review AS "flaggedForReview"
         FROM messages
        WHERE id = ANY($1::text[])
        ORDER BY created_at`,
      [[clientSent.json.id, talentSent.json.id]],
    );
    assert.equal(persisted.rows.length, 2);
    assert.ok(persisted.rows.every((row: any) => row.flaggedForReview === true));
    const persistedJson = JSON.stringify(persisted.rows);
    assert.ok(!persistedJson.includes("val@gmail.com"));
    assert.ok(!persistedJson.includes("hello123"));
    assert.ok(!persistedJson.includes("839221"));

    const recipientView = await request(
      srv,
      "GET",
      `/api/message-threads/${acceptedThreadId}/messages`,
      talentTok,
    );
    assert.equal(recipientView.status, 200);
    const recipientJson = JSON.stringify(recipientView.json);
    assert.ok(recipientJson.includes("*****.com"));
    assert.ok(recipientJson.includes("***4723"));
    assert.ok(!recipientJson.includes("val@gmail.com"));
    assert.ok(!recipientJson.includes("hello123"));

    let notifications: any[] = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const rows = await query(
        `SELECT user_id, title, message
           FROM notifications
          WHERE user_id IN ($1, $2) AND type = 'new_message'`,
        [CLIENT_ID, TALENT_ID],
      );
      notifications = rows.rows;
      if (notifications.length >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(notifications.length, 2);
    const notificationJson = JSON.stringify(notifications);
    assert.ok(!notificationJson.includes("val@gmail.com"));
    assert.ok(!notificationJson.includes("hello123"));
    assert.ok(!notificationJson.includes("839221"));

    const normalSent = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: acceptedThreadId,
      content: "Can we schedule the interview tomorrow?",
    });
    assert.equal(normalSent.status, 201);
    assert.equal(normalSent.json.privacyRedacted, false);
    assert.deepEqual(normalSent.json.privacyCategories, []);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const grouped = await query(
        `SELECT message_count
           FROM notifications
          WHERE user_id = $1 AND type = 'new_message' AND related_id = $2
          ORDER BY created_at DESC
          LIMIT 1`,
        [TALENT_ID, acceptedThreadId],
      );
      if ((grouped.rows[0]?.message_count ?? 0) >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });

  it("retroactively sanitizes split PII in one atomic same-sender workflow", async () => {
    const first = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: acceptedThreadId,
      content: "My portfolio is val@onspot",
    });
    assert.equal(first.status, 201, JSON.stringify(first.json));
    assert.equal(first.json.privacyRedacted, false);

    const second = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: acceptedThreadId,
      content: "global.com",
    });
    assert.equal(second.status, 201, JSON.stringify(second.json));
    assert.equal(second.json.privacyRedacted, true);
    assert.equal(second.json.privacyContextRedacted, true);
    assert.deepEqual(
      new Set(second.json.affectedMessageIds),
      new Set([first.json.id, second.json.id]),
    );

    const persisted = await query(
      `SELECT id, content, flagged_for_review AS "flaggedForReview"
         FROM messages
        WHERE id = ANY($1::text[])
        ORDER BY created_at`,
      [[first.json.id, second.json.id]],
    );
    assert.equal(persisted.rows.length, 2);
    assert.ok(
      persisted.rows.every((row: any) => row.flaggedForReview === true),
    );
    assert.deepEqual(
      persisted.rows.map((row: any) => row.content),
      ["My portfolio is *****", "*****"],
    );
    const persistedJson = JSON.stringify(persisted.rows).toLowerCase();
    assert.ok(!persistedJson.includes("val@onspot"));
    assert.ok(!persistedJson.includes("global.com"));

    const recipientView = await request(
      srv,
      "GET",
      `/api/message-threads/${acceptedThreadId}/messages`,
      talentTok,
    );
    assert.equal(recipientView.status, 200);
    const recipientJson = JSON.stringify(recipientView.json).toLowerCase();
    assert.ok(!recipientJson.includes("val@onspot"));
    assert.ok(!recipientJson.includes("global.com"));
  });

  it("does not deterministically join a sender across another participant's reply", async () => {
    const first = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: acceptedThreadId,
      content: "different@onspot",
    });
    assert.equal(first.status, 201);
    const reply = await request(srv, "POST", "/api/messages", talentTok, {
      threadId: acceptedThreadId,
      content: "Sounds good",
    });
    assert.equal(reply.status, 201);
    const afterReply = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: acceptedThreadId,
      content: "global.com",
    });
    assert.equal(afterReply.status, 201);
    assert.equal(afterReply.json.privacyContextRedacted, false);
    assert.equal(afterReply.json.content, "global.com");
  });

  it("rejects messages too long for complete semantic screening", async () => {
    const sent = await request(srv, "POST", "/api/messages", clientTok, {
      threadId: acceptedThreadId,
      content: "a".repeat(MAX_USER_MESSAGE_CHARS + 1),
    });
    assert.equal(sent.status, 400);
  });
});
