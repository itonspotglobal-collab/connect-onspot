import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import express from "express";
import rateLimit from "express-rate-limit";
import type { Server } from "node:http";
import { hashPassword, verifyPassword } from "../auth-utils";
import { PasswordResetService, PasswordResetError, RESET_REQUEST_MESSAGE, RESET_INVALID_CODE_MESSAGE, passwordResetHmac } from "../services/passwordResetService";
import { sendPasswordResetEmail } from "../services/passwordResetEmail";
import { registerPasswordResetRoutes } from "../routes/passwordReset";

const target = process.env.PASSWORD_RESET_TEST_DATABASE_URL;
assert.ok(target, "Run node scripts/test-password-reset-isolated.mjs; never use an application database.");
const url = new URL(target);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.username, "password_reset_fixture");
assert.equal(url.pathname, "/signup_verification_test");
const pool = new Pool({ connectionString: target, max: 8 });
const key = "fixture-only-password-reset-hmac-key-32-characters";
const password = "Updated-Fixture-Password-123!";
const original = "Original-Fixture-Password-123!";
let now = new Date("2026-11-03T00:00:00Z");
let emails: { email: string; role: "client" | "talent"; code: string }[] = [];
let delivery = true;
let failCandidateWrite = false;
let configured = true;
function service() {
  return new PasswordResetService({
    connect: async () => {
      const db = await pool.connect();
      return { release: () => db.release(), query: async (sql, values) => {
        if (failCandidateWrite && sql.startsWith("UPDATE candidates")) throw new Error("fixture-update-failure");
        return db.query(sql, values);
      } };
    },
    hashPassword, hmacKey: () => key, now: () => now,
    assertConfigured: () => { if (!configured) throw new PasswordResetError(503, "Password reset is temporarily unavailable."); },
    send: async input => { emails.push(input); return { success: delivery }; },
  });
}
async function account(role = "talent", candidate = true) {
  const hash = await hashPassword(original);
  await pool.query("INSERT INTO users(id,email,role,password_hash) VALUES('fixture','person@example.test',$1,$2)", [role, hash]);
  if (candidate) await pool.query("INSERT INTO candidates(id,email,password_hash) VALUES('candidate','person@example.test',$1)", [hash]);
}
const request = (role?: "talent" | "client", ip = "request-fixture") => service().request({ email: " PERSON@example.test ", ...(role && { role }) }, ip);
const confirm = (code = emails.at(-1)!.code, changes = {}) => service().confirm({
  email: " PERSON@example.test ", code, newPassword: password, confirmPassword: password, ...changes,
}, "confirm-fixture");
const invalid = (promise: Promise<unknown>) => assert.rejects(promise, (e: any) =>
  e instanceof PasswordResetError && e.status === 400 && e.message === RESET_INVALID_CODE_MESSAGE);
const latest = async () => (await pool.query("SELECT * FROM password_reset_codes ORDER BY created_at DESC,id DESC LIMIT 1")).rows[0];
const advance = (ms: number) => { now = new Date(now.getTime() + ms); };
before(async () => {
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
    CREATE TABLE users(id text PRIMARY KEY,email text,role text,password_hash text,updated_at timestamptz);
    CREATE TABLE candidates(id text PRIMARY KEY,email text,password_hash text);
    CREATE TABLE signup_verification_limits(bucket text PRIMARY KEY,used integer NOT NULL,resets_at timestamptz NOT NULL);`);
  await pool.query(await readFile("migrations/0057_password_reset_codes.sql", "utf8"));
});
beforeEach(async () => {
  await pool.query("TRUNCATE password_reset_codes,signup_verification_limits,candidates,users");
  emails = []; delivery = true; configured = true; failCandidateWrite = false;
  now = new Date("2026-11-03T00:00:00Z");
});
after(async () => { await pool.end(); });

test("unknown email returns the same success response and sends no email", async () => {
  assert.deepEqual(await request(), { success: true, message: RESET_REQUEST_MESSAGE });
  assert.equal(emails.length, 0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM password_reset_codes")).rows[0].n, 0);
  await account();
  advance(60_001);
  assert.deepEqual(await request(), { success: true, message: RESET_REQUEST_MESSAGE });
  assert.equal(emails.length, 1);
});
test("codes are six digits, HMAC-only, domain-separated, lowercased and expire in ten minutes", async () => {
  await account(); await request();
  const row = await latest();
  assert.match(emails[0].code, /^\d{6}$/);
  assert.equal(row.email, "person@example.test");
  assert.match(row.code_hmac, /^[a-f0-9]{64}$/);
  assert.equal(row.code_hmac, passwordResetHmac(key, row, emails[0].code));
  assert.notEqual(row.code_hmac, passwordResetHmac(key, { ...row, role: "client" }, emails[0].code));
  assert.equal(row.expires_at.getTime() - now.getTime(), 600_000);
});
test("wrong codes increment attempts; five failures kill a code even if the next code is correct", async () => {
  await account(); await request();
  const wrong = emails[0].code === "000000" ? "111111" : "000000";
  for (let attempt = 1; attempt <= 5; attempt++) {
    await invalid(confirm(wrong));
    const row = await latest();
    assert.equal(row.attempts, attempt);
    assert.equal(!!row.used_at, attempt === 5);
  }
  await invalid(confirm());
  assert.equal((await latest()).attempts, 5);
  assert.ok(await verifyPassword(original, (await pool.query("SELECT password_hash FROM users")).rows[0].password_hash));
});
test("expired codes and unknown email confirmations share the generic invalid-code error", async () => {
  await account(); await request(); advance(600_000);
  await invalid(confirm());
  await invalid(confirm("123456", { email: "unknown@example.test" }));
});
test("a correct code updates users and candidates atomically using bcrypt; it cannot be reused", async () => {
  await account(); await request();
  assert.deepEqual(await confirm(), { success: true, message: "Password updated. Please sign in." });
  const user = (await pool.query("SELECT password_hash FROM users")).rows[0];
  const candidate = (await pool.query("SELECT password_hash FROM candidates")).rows[0];
  assert.equal(user.password_hash, candidate.password_hash);
  assert.match(user.password_hash, /^\$2[aby]\$12\$/);
  assert.ok(await verifyPassword(password, user.password_hash));
  assert.equal(await verifyPassword(original, user.password_hash), false);
  assert.ok((await latest()).used_at);
  await invalid(confirm());
});
test("candidate-only and user-only accounts reset without creating an identity", async () => {
  await pool.query("INSERT INTO candidates VALUES('only','person@example.test','old')");
  await request("client");
  assert.equal(emails[0].role, "talent");
  await confirm();
  assert.ok(await verifyPassword(password, (await pool.query("SELECT password_hash FROM candidates")).rows[0].password_hash));
  assert.equal((await pool.query("SELECT count(*)::int n FROM users")).rows[0].n, 0);
  await pool.query("TRUNCATE password_reset_codes,signup_verification_limits,candidates");
  emails = [];
  await account("client", false); await request("talent"); await confirm();
  assert.equal(emails[0].role, "client");
  assert.ok(await verifyPassword(password, (await pool.query("SELECT password_hash FROM users")).rows[0].password_hash));
});
test("matching portal roles are preferred, but Admin resets always use the Client sender", async () => {
  await account("client", true); await request("talent");
  assert.equal(emails[0].role, "talent");
  advance(60_001); await request("client"); assert.equal(emails.at(-1)!.role, "client");
  await pool.query("UPDATE users SET role='admin'");
  advance(60_001); await request("talent"); assert.equal(emails.at(-1)!.role, "client");
});
test("mismatch and every shared password rule are enforced without consuming the code", async () => {
  await account(); await request();
  await assert.rejects(confirm(undefined, { confirmPassword: "Different-Password-123!" }), /Passwords don't match/);
  for (const weak of ["aA1!", "lowercase123!", "UPPERCASE123!", "NoDigitsHere!", "NoSpecial123"]) {
    await assert.rejects(confirm(undefined, { newPassword: weak, confirmPassword: weak }), PasswordResetError);
  }
  assert.equal((await latest()).attempts, 0); assert.equal((await latest()).used_at, null);
});
test("resend waits a full sixty seconds across minute boundaries, invalidates older codes and caps at five per hour", async () => {
  await account(); advance(59_000); await request();
  const firstCode = emails[0].code;
  advance(2_000); await request(); assert.equal(emails.length, 1);
  advance(58_001); await request(); assert.equal(emails.length, 2);
  await invalid(confirm(firstCode));
  for (let n = 0; n < 3; n++) { advance(60_001); await request(); }
  assert.equal(emails.length, 5);
  advance(60_001); assert.deepEqual(await request(), { success: true, message: RESET_REQUEST_MESSAGE });
  assert.equal(emails.length, 5);
  assert.equal((await pool.query("SELECT count(*)::int n FROM password_reset_codes WHERE used_at IS NULL")).rows[0].n, 1);
});
test("per-IP buckets apply equally to known and unknown email requests", async () => {
  for (let n = 0; n < 20; n++) {
    await service().request({ email: `unknown${n}@example.test` }, "same-ip");
  }
  await assert.rejects(service().request({ email: "another@example.test" }, "same-ip"),
    (e: any) => e instanceof PasswordResetError && e.status === 429);
  assert.equal(emails.length, 0);
});
test("concurrent requests send once, and concurrent confirmations consume once", async () => {
  await account();
  await Promise.all([request(), request()]);
  assert.equal(emails.length, 1);
  const results = await Promise.allSettled([confirm(), confirm()]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
});
test("a candidate write failure rolls back the user hash and code consumption", async () => {
  await account(); await request(); failCandidateWrite = true;
  await assert.rejects(confirm(), /fixture-update-failure/);
  assert.ok(await verifyPassword(original, (await pool.query("SELECT password_hash FROM users")).rows[0].password_hash));
  assert.equal((await latest()).used_at, null);
  failCandidateWrite = false; await confirm();
});
test("delivery failures remain private, kill the undelivered code, and do not change a password", async () => {
  await account(); delivery = false;
  assert.deepEqual(await request(), { success: true, message: RESET_REQUEST_MESSAGE });
  assert.ok((await latest()).used_at);
  await invalid(confirm());
  configured = false; advance(60_001);
  assert.deepEqual(await request(), { success: true, message: RESET_REQUEST_MESSAGE });
  assert.equal(emails.length, 1);
});
for (const role of ["talent", "client"] as const) {
  test(`${role} reset emails reuse the role sender, reply-to, private Graph transport and signup style`, async () => {
    const env = { PASSWORD_RESET_EMAIL_DELIVERY_ENABLED: "true",
      TALENT_VERIFICATION_EMAIL_FROM: "FindWork@onspotglobal.com", CLIENT_VERIFICATION_EMAIL_FROM: "HireTalent@onspotglobal.com" };
    const sent: any[] = [];
    const transport = async (input: any) => { sent.push(input); return { success: true }; };
    assert.deepEqual(await sendPasswordResetEmail({ email: "person@example.test", role, code: "001234" }, transport, env), { success: true });
    const sender = role === "talent" ? "findwork@onspotglobal.com" : "hiretalent@onspotglobal.com";
    assert.equal(sent[0].senderEmail, sender); assert.equal(sent[0].replyTo, sender);
    assert.equal(sent[0].subject, "Your OnSpot password reset code"); assert.equal(sent[0].redactErrors, true);
    assert.match(sent[0].bodyHtml, /001234/); assert.match(sent[0].bodyHtml, /expires in 10 minutes/);
    assert.match(sent[0].bodyHtml, /your password will not change/);
    await sendPasswordResetEmail({ email: "person@example.test", role, code: "001234" }, transport, { ...env, PASSWORD_RESET_EMAIL_DELIVERY_ENABLED: "false" });
    await sendPasswordResetEmail({ email: "person@example.test", role, code: "<bad>" }, transport, env);
    assert.equal(sent.length, 1);
  });
}
test("migration is additive and repeatable without changing existing hashes or codes", async () => {
  await account(); await request();
  const before = await latest();
  for (let i = 0; i < 2; i++) await pool.query(await readFile("migrations/0057_password_reset_codes.sql", "utf8"));
  assert.deepEqual(await latest(), before);
});
test("both HTTP endpoints share their limiter, no-store responses and private errors", async () => {
  const app = express(); app.use(express.json());
  registerPasswordResetRoutes(app, service(), rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false }));
  let server: Server | undefined;
  try {
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const response = await fetch(`${base}/api/auth/password-reset/request`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "unknown@example.test" }),
    });
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { success: true, message: RESET_REQUEST_MESSAGE });
    const confirmResponse = await fetch(`${base}/api/auth/password-reset/confirm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.test", code: "123456", newPassword: password, confirmPassword: password }),
    });
    assert.equal(confirmResponse.status, 400);
    assert.equal((await confirmResponse.json() as any).message, RESET_INVALID_CODE_MESSAGE);
    assert.equal((await fetch(`${base}/api/auth/password-reset/request`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "unknown@example.test" }),
    })).status, 429);
  } finally { await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()); }
});
test("the unsafe dev reset routes and opt-in bypass are removed", async () => {
  const routes = await readFile("server/routes.ts", "utf8");
  assert.doesNotMatch(routes, /ENABLE_DEV_PASSWORD_RESET|\/api\/dev\/reset-password|\/api\/dev\/candidates\/set-temp-password/);
  assert.match(routes, /registerPasswordResetRoutes\(app, passwordResetRuntime, authResetLimiter\)/);
});
