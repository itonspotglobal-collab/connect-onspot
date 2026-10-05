import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import express from "express";
import { SignupError, SignupVerificationService, generateSignupCode, signupCodeHmac, safeSignupReturnTo, signupEmailVerificationRequired } from "../services/signupVerificationService";
import { hashPassword, verifyPassword } from "../auth-utils";
import { emailOwnershipAllowsAccess, hasEmailOwnership } from "../lib/emailOwnership";
import { findOwnedProviderAccount } from "../services/providerEmailOwnership";
import { signupVerificationPreflight } from "../lib/signupVerificationPreflight";
import { registerSignupVerificationRoutes } from "../routes/signupVerification";
import { verificationSender } from "../services/signupVerificationEmail";

const target = process.env.SIGNUP_VERIFICATION_TEST_DATABASE_URL;
if (target) {
  const url = new URL(target);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/signup_verification_test",
    "Refuse any non-disposable database target");
}
const pool = target ? new Pool({ connectionString: target, max: 12 }) : null;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !pool }, fn);
let clock = new Date("2026-10-02T00:00:00Z");
let emails: { email: string; role: "client" | "talent"; code: string }[] = [];
let deliveryWorks = true;
let deliveryThrows = false;
let failCandidate = false;
let credentialCalls = 0;
let activationCommits = 0;
const key = "test-only-cryptographic-fixture-key-32-bytes";
const details = (overrides: Record<string, unknown> = {}) => ({
  email: "person@example.test", role: "talent", first_name: "Fixture", last_name: "Talent",
  password: "ValidPassword123!", ...overrides,
});
function service(verificationFlag?: string) {
  assert.ok(pool);
  return new SignupVerificationService({
    connect: async () => {
      const client = await pool.connect();
      let activated = false;
      return {
        release: () => client.release(),
        query: async (sql, values) => {
          if (failCandidate && sql.includes("INSERT INTO candidates")) throw new Error("fixture-required-write-failure");
          const result = await client.query(sql, values);
          if (sql.includes("INSERT INTO users") || sql.includes("UPDATE users SET password_hash")) activated = true;
          if (sql === "COMMIT" && activated) activationCommits++;
          return result;
        },
      };
    },
    now: () => clock,
    verificationRequired: () => signupEmailVerificationRequired({ SIGNUP_EMAIL_VERIFICATION_REQUIRED: verificationFlag }),
    hmacKey: () => {
      assert.notEqual(verificationFlag, "false", "direct signup must not access the HMAC key");
      return key;
    },
    assertConfigured: () => {
      assert.notEqual(verificationFlag, "false", "direct signup must not require verification configuration");
    },
    hashPassword: async value => verificationFlag === "false" ? hashPassword(value)
      : createHash("sha256").update(value).digest("hex"),
    send: async input => {
      emails.push(input);
      if (deliveryThrows) throw new Error(`fixture-transport-error-${input.code}`);
      return { success: deliveryWorks };
    },
    issueCredentials: identity => {
      assert.ok(activationCommits > credentialCalls, "credentials only after activation COMMIT");
      credentialCalls++;
      return { token: `user-token-${identity.user.id}`, user: identity.user, candidateId: identity.candidateId,
        talentToken: identity.candidateId ? `candidate-token-${identity.candidateId}` : null };
    },
  });
}
async function begin(overrides = {}, capability?: string) {
  const svc = service();
  const result = await svc.start(details(overrides), "start-fixture", capability);
  return { svc, ...result, code: emails.at(-1)!.code };
}
const rejectsCode = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: any) => error instanceof SignupError && error.code === code);
const advance = (ms: number) => { clock = new Date(clock.getTime() + ms); };
async function counts() {
  const result = await pool!.query(`SELECT
    (SELECT count(*)::int FROM users) users,
    (SELECT count(*)::int FROM profiles) profiles,
    (SELECT count(*)::int FROM candidates) candidates,
    (SELECT count(*)::int FROM client_profiles) clients`);
  return result.rows[0];
}

for (const role of ["talent", "client"] as const) {
  dbTest(`verified signup cannot overwrite a historical ${role} password missed by the NULL-only grandfathering`, async () => {
    const original = await hashPassword("Historical-Fixture-Password-123!");
    await pool!.query(`INSERT INTO users(id,email,username,role,password_hash,created_at,email_verification_required)
      VALUES('legacy','person@example.test','legacy-fixture',$1,$2,'2026-09-01',true)`, [role, original]);
    const { svc, body, capability, code } = await begin({ role });
    await rejectsCode(svc.verify(capability, body.challengeId, code, "fixture"), "ACCOUNT_EXISTS");
    const persisted = await pool!.query(`SELECT password_hash=$1 AS password_unchanged,email_verified_at,
      email_verification_required FROM users WHERE id='legacy'`, [original]);
    assert.deepEqual(persisted.rows[0], { password_unchanged: true, email_verified_at: null, email_verification_required: true });
    assert.equal(credentialCalls, 0);
  });
}

dbTest("verified signup cannot overwrite historical candidate-only credentials missed by grandfathering", async () => {
  const original = await hashPassword("Historical-Fixture-Password-123!");
  await pool!.query(`INSERT INTO candidates(id,email,password_hash,created_at,email_verification_required)
    VALUES('legacy-candidate','person@example.test',$1,'2026-09-01',true)`, [original]);
  const { svc, body, capability, code } = await begin();
  await rejectsCode(svc.verify(capability, body.challengeId, code, "fixture"), "ACCOUNT_EXISTS");
  const persisted = await pool!.query(`SELECT password_hash=$1 AS password_unchanged,user_id
    FROM candidates WHERE id='legacy-candidate'`, [original]);
  assert.deepEqual(persisted.rows[0], { password_unchanged: true, user_id: null });
  assert.equal((await counts()).users, 0);
  assert.equal(credentialCalls, 0);
});

before(async () => {
  if (!pool) return;
  assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "signup_verification_test");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  // Disposable database fixture only. Never import application startup.
  await pool.query(`CREATE TABLE users (
    id varchar PRIMARY KEY, email varchar UNIQUE, username text UNIQUE, first_name text,last_name text,
    password_hash text,company text,role text NOT NULL DEFAULT 'client',replit_id text,
    profile_image_url text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE profiles(id varchar PRIMARY KEY,user_id varchar UNIQUE REFERENCES users(id),
      first_name text,last_name text,location text,rate_currency text,languages text[],timezone text);
    CREATE TABLE client_profiles(id varchar PRIMARY KEY,user_id varchar UNIQUE REFERENCES users(id),
      company_name text,contact_person text,email text);
    CREATE TABLE candidates(id varchar PRIMARY KEY DEFAULT gen_random_uuid(),user_id varchar REFERENCES users(id),
      full_name text NOT NULL DEFAULT '',email text,password_hash text,account_created boolean DEFAULT false,
      created_at timestamp DEFAULT now(),
      is_verified boolean NOT NULL DEFAULT false,is_vetted boolean NOT NULL DEFAULT false);
    INSERT INTO users(id,email,role,password_hash) VALUES ('historical','old@example.test','talent','historical-hash');
    INSERT INTO candidates(email,password_hash) VALUES ('candidate-only@example.test','historical-hash'),
      ('unclaimed@example.test',NULL);`);
  const preflight = await signupVerificationPreflight((sql, values) => pool.query(sql, values));
  assert.equal(preflight.duplicateUserEmails, 0);
  assert.equal(preflight.candidateOnlyIdentities, 2);
  assert.equal(preflight.passwordlessProfiles, 1);
  console.log("Disposable preflight counts:", JSON.stringify(preflight));
  await pool.query(await readFile("migrations/0033_signup_email_verification.sql", "utf8"));
  await pool.query(`CREATE TABLE app_schema_migrations(id text PRIMARY KEY,applied_at timestamptz);
    INSERT INTO app_schema_migrations VALUES('0033_signup_email_verification','2026-10-02T00:00:00Z')`);
  const history = await pool.query("SELECT * FROM users WHERE id='historical'");
  assert.equal(history.rows[0].email_verification_required, false);
  assert.equal(history.rows[0].email_verified_at, null);
  const candidateHistory = await pool.query("SELECT * FROM candidates ORDER BY email");
  assert.equal(candidateHistory.rows[0].email_verification_required, false);
  assert.equal(candidateHistory.rows[1].email_verification_required, true);
});
beforeEach(async () => {
  if (!pool) return;
  await pool.query("TRUNCATE auth_provider_links,pending_registrations,signup_verification_limits,candidates,profiles,client_profiles,users CASCADE");
  clock = new Date("2026-10-02T00:00:00Z");
  emails = []; deliveryWorks = true; deliveryThrows = false; failCandidate = false; credentialCalls = 0; activationCommits = 0;
});
after(async () => { await pool?.end(); });

test("verification flag fails closed unless the exact server value is false", () => {
  for (const value of [undefined, "", "true", "False", "FALSE", " false ", "0"]) {
    assert.equal(signupEmailVerificationRequired({ SIGNUP_EMAIL_VERIFICATION_REQUIRED: value }), true);
  }
  assert.equal(signupEmailVerificationRequired({ SIGNUP_EMAIL_VERIFICATION_REQUIRED: "false" }), false);
});

for (const role of ["talent", "client"] as const) {
  dbTest(`direct ${role} signup creates normal records with bcrypt, no OTP/configuration dependency`, async () => {
    const result = await service("false").start(details({ role, company: "Fixture Company" }), "direct-fixture");
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    assert.equal(result.body.accountCreated, true);
    assert.equal(result.body.pendingVerification, undefined);
    assert.equal(result.capability, "");
    assert.ok(result.body.token);
    const user = (await pool!.query("SELECT * FROM users")).rows[0];
    assert.match(user.password_hash, /^\$2[aby]\$12\$/);
    assert.equal(await verifyPassword("ValidPassword123!", user.password_hash), true);
    assert.equal(user.role, role);
    assert.equal(user.email_verification_required, false);
    assert.equal(user.email_verified_at, null);
    assert.equal(user.email_verified_email, null);
    assert.equal(emailOwnershipAllowsAccess(user), true);
    assert.equal((await pool!.query("SELECT count(*)::int n FROM pending_registrations")).rows[0].n, 0);
    assert.equal(emails.length, 0);
    assert.equal(credentialCalls, 1);
    assert.deepEqual(await counts(), role === "talent"
      ? { users: 1, profiles: 1, candidates: 1, clients: 0 }
      : { users: 1, profiles: 0, candidates: 0, clients: 1 });
    if (role === "talent") {
      const candidate = (await pool!.query("SELECT * FROM candidates")).rows[0];
      assert.equal(candidate.user_id, user.id);
      assert.equal(candidate.password_hash, user.password_hash);
      assert.equal(candidate.email_verification_required, false);
      assert.equal(candidate.email_verified_at, null);
      assert.ok(result.body.talentToken);
      assert.equal(result.body.candidateId, candidate.id);
      assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { candidateId: candidate.id }), true);
    } else {
      assert.equal(result.body.talentToken, null);
      assert.equal((await pool!.query("SELECT company_name FROM client_profiles")).rows[0].company_name, "Fixture Company");
    }
  });
}

dbTest("direct duplicate email and username are rejected without overwriting an account", async () => {
  const svc = service("false");
  await svc.start(details({ username: "fixture-user" }), "duplicate-fixture");
  const original = (await pool!.query("SELECT * FROM users")).rows[0];
  await rejectsCode(svc.start(details({ email: " PERSON@EXAMPLE.TEST ", role: "client" }), "duplicate-fixture"), "ACCOUNT_EXISTS");
  await rejectsCode(svc.start(details({ email: "other@example.test", username: "fixture-user" }), "duplicate-fixture"), "USERNAME_UNAVAILABLE");
  assert.deepEqual((await pool!.query("SELECT * FROM users")).rows[0], original);
  assert.equal(credentialCalls, 1);
});

dbTest("direct signup cannot claim an existing unverified account or imported Talent profile", async () => {
  await pool!.query(`INSERT INTO users(id,email,username,role,password_hash,email_verification_required)
    VALUES ('unverified','person@example.test','original','talent','original-hash',true)`);
  await rejectsCode(service("false").start(details(), "claim-fixture"), "ACCOUNT_EXISTS");
  assert.equal((await pool!.query("SELECT password_hash FROM users")).rows[0].password_hash, "original-hash");
  await pool!.query("INSERT INTO candidates(email,full_name) VALUES ('imported@example.test','Imported Profile')");
  await rejectsCode(service("false").start(details({ email: "imported@example.test" }), "claim-fixture"), "ACCOUNT_EXISTS");
  assert.equal((await pool!.query("SELECT user_id FROM candidates")).rows[0].user_id, null);
  assert.equal(credentialCalls, 0);
});

dbTest("direct signup still rejects invalid roles, fields, email and weak passwords", async () => {
  for (const [input, code] of [
    [{ role: "admin" }, "INVALID_SIGNUP"], [{ first_name: "" }, "INVALID_SIGNUP"],
    [{ email: "not-an-email" }, "INVALID_SIGNUP"], [{ email_verification_required: false }, "INVALID_SIGNUP"],
    [{ password: "weak" }, "WEAK_PASSWORD"], [{ password: undefined }, "WEAK_PASSWORD"],
  ] as const) {
    await rejectsCode(service("false").start(details(input), "invalid-fixture"), code);
  }
  assert.deepEqual(await counts(), { users: 0, profiles: 0, candidates: 0, clients: 0 });
  assert.equal(credentialCalls, 0);
});

dbTest("direct signup retains IP, hourly email and daily email abuse limits", async () => {
  for (const [kind, value, maximum, duration] of [
    ["start-ip", "limited-fixture", 10, 3_600_000],
    ["send-hour", "person@example.test", 5, 3_600_000],
    ["send-day", "person@example.test", 10, 86_400_000],
  ] as const) {
    await pool!.query("TRUNCATE signup_verification_limits");
    const bucket = `${kind}:${createHash("sha256").update(value).digest("hex")}:${Math.floor(clock.getTime() / duration)}`;
    await pool!.query("INSERT INTO signup_verification_limits(bucket,used,resets_at) VALUES ($1,$2,$3)",
      [bucket, maximum, new Date(clock.getTime() + duration)]);
    await rejectsCode(service("false").start(details(), "limited-fixture"), "RATE_LIMITED");
  }
  assert.equal(credentialCalls, 0);
  assert.deepEqual(await counts(), { users: 0, profiles: 0, candidates: 0, clients: 0 });
});

dbTest("direct required-record failure rolls back account creation and issues no credentials", async () => {
  failCandidate = true;
  await assert.rejects(service("false").start(details(), "rollback-fixture"), /fixture-required-write-failure/);
  assert.deepEqual(await counts(), { users: 0, profiles: 0, candidates: 0, clients: 0 });
  assert.equal(credentialCalls, 0);
});

dbTest("concurrent direct registration creates only one account", async () => {
  const svc = service("false");
  const results = await Promise.allSettled([
    svc.start(details(), "race-fixture"), svc.start(details(), "race-fixture"),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "ACCOUNT_EXISTS");
  assert.equal(credentialCalls, 1);
  assert.deepEqual(await counts(), { users: 1, profiles: 1, candidates: 1, clients: 0 });
});

dbTest("explicit true retains pending OTP flow; switching false does not delete pending data", async () => {
  const result = await service("true").start(details(), "enabled-fixture");
  assert.equal(result.status, 202);
  assert.equal(result.body.pendingVerification, true);
  assert.equal(emails.length, 1);
  assert.equal(credentialCalls, 0);
  await rejectsCode(service("false").status(result.capability), "NO_PENDING_SIGNUP");
  assert.equal((await service("true").status(result.capability)).pendingVerification, true);
  assert.deepEqual(await counts(), { users: 0, profiles: 0, candidates: 0, clients: 0 });
});

dbTest("direct HTTP signup returns credentials and clears the pending cookie; origin protection remains", async () => {
  const app = express();
  app.use(express.json());
  registerSignupVerificationRoutes(app, service("false"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const url = `http://127.0.0.1:${address.port}`;
    const blocked = await fetch(`${url}/api/signup`, {
      method: "POST", headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify(details()),
    });
    assert.equal(blocked.status, 403);
    for (const [path, role, email] of [
      ["/api/signup", "talent", "talent-http@example.test"], ["/signup", "client", "client-http@example.test"],
    ]) {
      const response = await fetch(`${url}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details({ role, email })),
      });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.ok(body.token);
      assert.equal(body.pendingVerification, undefined);
      assert.match(response.headers.get("set-cookie")!, /onspot_pending_signup=;/);
      assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
    }
    assert.equal(emails.length, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("codes are secure six-digit strings and HMAC binds every context dimension", () => {
  for (let n = 0; n < 100; n++) assert.match(generateSignupCode(), /^\d{6}$/);
  const row = { id: "id", email: "a@example.test", role: "talent", purpose: "signup", generation: 1 };
  const hash = signupCodeHmac(key, row, "004271");
  assert.match(hash, /^[a-f0-9]{64}$/);
  for (const field of ["id", "email", "role", "purpose", "generation"]) {
    assert.notEqual(signupCodeHmac(key, { ...row, [field]: "different" }, "004271"), hash);
  }
  assert.notEqual(signupCodeHmac(key, row, "427100"), hash);
});
test("ownership proof and historical exemption are separate from professional badges", () => {
  assert.equal(emailOwnershipAllowsAccess({ email: "a@example.test", email_verification_required: true }), false);
  assert.equal(emailOwnershipAllowsAccess({ email: "a@example.test", email_verification_required: false }), true);
  assert.equal(emailOwnershipAllowsAccess({ email: "a@example.test", email_verification_required: true,
    email_verified_at: new Date(), email_verified_email: "b@example.test" }), false);
  assert.equal(safeSignupReturnTo("//evil.test"), null);
  assert.equal(safeSignupReturnTo("/\\evil.test"), null);
  assert.equal(safeSignupReturnTo("/my-applications"), "/my-applications");
});
test("role sender selection is exact and missing or wrong senders fail closed", () => {
  const oldTalent = process.env.TALENT_VERIFICATION_EMAIL_FROM;
  const oldClient = process.env.CLIENT_VERIFICATION_EMAIL_FROM;
  try {
    process.env.TALENT_VERIFICATION_EMAIL_FROM = "FindWork@onspotglobal.com";
    process.env.CLIENT_VERIFICATION_EMAIL_FROM = "HireTalent@onspotglobal.com";
    assert.equal(verificationSender("talent"), "findwork@onspotglobal.com");
    assert.equal(verificationSender("client"), "hiretalent@onspotglobal.com");
    process.env.CLIENT_VERIFICATION_EMAIL_FROM = "careers@onspotglobal.com";
    assert.throws(() => verificationSender("client"));
    delete process.env.TALENT_VERIFICATION_EMAIL_FROM;
    assert.throws(() => verificationSender("talent"));
  } finally {
    if (oldTalent === undefined) delete process.env.TALENT_VERIFICATION_EMAIL_FROM; else process.env.TALENT_VERIFICATION_EMAIL_FROM = oldTalent;
    if (oldClient === undefined) delete process.env.CLIENT_VERIFICATION_EMAIL_FROM; else process.env.CLIENT_VERIFICATION_EMAIL_FROM = oldClient;
  }
});
for (const role of ["client", "talent"]) {
  dbTest(`${role} stays pending, then atomically creates required records and credentials after commit`, async () => {
    const request = await begin({ role });
    assert.equal(request.status, 202);
    assert.equal(emails[0].role, role);
    assert.deepEqual(await counts(), { users: 0, profiles: 0, candidates: 0, clients: 0 });
    assert.equal(credentialCalls, 0);
    const result = await request.svc.verify(request.capability, request.body.challengeId, request.code, "verify-fixture");
    assert.equal(result.success, true);
    assert.equal(credentialCalls, 1);
    assert.deepEqual(await counts(), role === "talent"
      ? { users: 1, profiles: 1, candidates: 1, clients: 0 }
      : { users: 1, profiles: 0, candidates: 0, clients: 1 });
    const identity = (await pool!.query("SELECT * FROM users")).rows[0];
    assert.equal(identity.email_verified_email, details().email);
    assert.ok(identity.email_verified_at);
    if (role === "talent") {
      const candidate = (await pool!.query("SELECT * FROM candidates")).rows[0];
      assert.equal(candidate.email_verified_at, null, "no mutable copy of linked ownership");
      assert.equal(candidate.is_verified, false);
      assert.equal(candidate.is_vetted, false);
      assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { candidateId: candidate.id }), true);
    }
  });
}
dbTest("incorrect OTP increments persistently and fifth failure requires resend", async () => {
  const request = await begin();
  const wrong = request.code === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++) await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, wrong, "verify"), "INCORRECT_CODE");
  assert.equal((await pool!.query("SELECT incorrect_attempts FROM pending_registrations")).rows[0].incorrect_attempts, 5);
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, "verify"), "ATTEMPTS_EXHAUSTED");
  assert.equal((await counts()).users, 0);
});
dbTest("expired code and expired registration cannot activate", async () => {
  const request = await begin();
  advance(600_001);
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, "verify"), "CODE_EXPIRED");
  advance(86_400_000);
  await rejectsCode(request.svc.resend(request.capability, request.body.challengeId, "resend"), "REGISTRATION_EXPIRED");
});
dbTest("used challenge cannot replay or issue another credential", async () => {
  const request = await begin();
  await request.svc.verify(request.capability, request.body.challengeId, request.code, "verify");
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, "verify"), "CHALLENGE_USED");
  assert.equal(credentialCalls, 1);
});
dbTest("resend cooldown, stale generation and leading-zero code handling", async () => {
  const request = await begin();
  await rejectsCode(request.svc.resend(request.capability, request.body.challengeId, "resend"), "RESEND_COOLDOWN");
  advance(60_001);
  const resend = await request.svc.resend(request.capability, request.body.challengeId, "resend");
  assert.equal(resend.status, 202);
  // Pin test-only generation to an OTP with leading zeros.
  const row = (await pool!.query("SELECT * FROM pending_registrations")).rows[0];
  await pool!.query("UPDATE pending_registrations SET code_hmac=$1", [signupCodeHmac(key, row, "004271")]);
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId,
    request.code === "004271" ? "004272" : request.code, "verify"), "INCORRECT_CODE");
  await request.svc.verify(request.capability, request.body.challengeId, "004271", "verify");
});
dbTest("email send budgets span challenges, roles and server instances", async () => {
  for (let i = 0; i < 5; i++) {
    await service().start(details({ role: i % 2 ? "client" : "talent" }), `ip-${i}`);
    advance(60_001);
  }
  await rejectsCode(service().start(details(), "another-ip"), "RATE_LIMITED");
  advance(3_600_000);
  for (let i = 0; i < 5; i++) { await service().start(details(), `second-${i}`); advance(60_001); }
  advance(3_600_000);
  await rejectsCode(service().start(details(), "third"), "RATE_LIMITED");
});
dbTest("signup IP budget persists across service instances", async () => {
  for (let i = 0; i < 10; i++) await service().start(details({ email: `person${i}@example.test` }), "same-ip");
  await rejectsCode(service().start(details({ email: "next@example.test" }), "same-ip"), "RATE_LIMITED");
});
dbTest("verification email budget spans generations", async () => {
  const request = await begin();
  for (let i = 0; i < 20; i++) {
    // Send-state failures still count against the email attempt budget.
    await pool!.query("UPDATE pending_registrations SET delivery_status='failed'");
    await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, `ip-${i}`), "EMAIL_NOT_SENT");
  }
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, "next-ip"), "RATE_LIMITED");
});
dbTest("verification IP limit and resend IP limit include rejected attempts", async () => {
  const request = await begin();
  for (let i = 0; i < 50; i++) {
    await rejectsCode(request.svc.verify("a".repeat(64), request.body.challengeId, request.code, "same-ip"), "CHALLENGE_USED");
  }
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, "same-ip"), "RATE_LIMITED");
  for (let i = 0; i < 20; i++) await rejectsCode(request.svc.resend(request.capability, request.body.challengeId, "same-resend-ip"), "RESEND_COOLDOWN");
  await rejectsCode(request.svc.resend(request.capability, request.body.challengeId, "same-resend-ip"), "RATE_LIMITED");
});
dbTest("wrong capability and another email/role challenge cannot substitute proof", async () => {
  const a = await begin();
  const b = await begin({ role: "client", email: "other@example.test" });
  await rejectsCode(b.svc.verify(a.capability, b.body.challengeId, b.code, "verify"), "CHALLENGE_USED");
  await rejectsCode(a.svc.verify(a.capability, a.body.challengeId, b.code === a.code ? "999999" : b.code, "verify"), "INCORRECT_CODE");
  assert.equal((await counts()).users, 0);
});
dbTest("Graph start and resend failure never claim sending or activation success", async () => {
  deliveryWorks = false;
  const request = await begin();
  assert.equal(request.status, 503);
  assert.equal(request.body.deliveryStatus, "failed");
  assert.equal(request.body.success, false);
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, "verify"), "EMAIL_NOT_SENT");
  advance(60_001);
  assert.equal((await request.svc.resend(request.capability, request.body.challengeId, "resend")).status, 503);
  assert.equal(credentialCalls, 0);
});
dbTest("simultaneous correct submissions activate exactly once", async () => {
  const request = await begin();
  const results = await Promise.allSettled([1, 2].map(() => request.svc.verify(request.capability, request.body.challengeId, request.code, "verify")));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await counts()).users, 1);
  assert.equal(credentialCalls, 1);
});
dbTest("simultaneous incorrect and correct submissions preserve atomic activation", async () => {
  const request = await begin();
  await Promise.allSettled([
    request.svc.verify(request.capability, request.body.challengeId, request.code, "verify-a"),
    request.svc.verify(request.capability, request.body.challengeId, request.code === "000000" ? "000001" : "000000", "verify-b"),
  ]);
  assert.equal((await counts()).users, 1);
  assert.equal(credentialCalls, 1);
});
dbTest("simultaneous resend and verify cannot consume a stale generation", async () => {
  const request = await begin();
  advance(60_001);
  const results = await Promise.allSettled([
    request.svc.resend(request.capability, request.body.challengeId, "resend"),
    request.svc.verify(request.capability, request.body.challengeId, request.code, "verify"),
  ]);
  const row = (await pool!.query("SELECT * FROM pending_registrations")).rows[0];
  if (row.consumed_at) { assert.equal(credentialCalls, 1); assert.equal(row.generation, 1); }
  else { assert.equal(credentialCalls, 0); assert.equal(row.generation, 2); }
  assert.ok(results.some(result => result.status === "fulfilled"));
});
dbTest("required candidate-write failure rolls back every activation record and consumption", async () => {
  const request = await begin();
  failCandidate = true;
  await assert.rejects(request.svc.verify(request.capability, request.body.challengeId, request.code, "verify"));
  assert.deepEqual(await counts(), { users: 0, profiles: 0, candidates: 0, clients: 0 });
  assert.equal((await pool!.query("SELECT consumed_at FROM pending_registrations")).rows[0].consumed_at, null);
  assert.equal(credentialCalls, 0);
});
dbTest("duplicate signup cannot overwrite an established password or disclose existence before proof", async () => {
  await pool!.query("INSERT INTO users(id,email,username,role,password_hash,email_verification_required) VALUES ('existing',$1,'old','talent','old-hash',false)", [details().email]);
  const request = await begin();
  assert.equal(request.status, 202);
  assert.equal("accountExists" in request.body, false);
  await rejectsCode(request.svc.verify(request.capability, request.body.challengeId, request.code, "verify"), "ACCOUNT_EXISTS");
  assert.equal((await pool!.query("SELECT password_hash FROM users")).rows[0].password_hash, "old-hash");
  assert.equal(credentialCalls, 0);
});
dbTest("new inactive Admin-created password record can finish inbox proof without weakening historical account protection", async () => {
  await pool!.query("INSERT INTO users(id,email,username,role,password_hash) VALUES ('admin-created',$1,'reserved','client','temporary-hash')", [details().email]);
  const request = await begin({ role: "client" });
  assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { userId: "admin-created" }), false);
  const activated = await request.svc.verify(request.capability, request.body.challengeId, request.code, "verify");
  assert.equal(activated.user.id, "admin-created");
  assert.equal((await counts()).users, 1);
  assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { userId: "admin-created" }), true);
});
dbTest("first-password claim preserves imported names and professional flags", async () => {
  await pool!.query("INSERT INTO candidates(id,email,full_name,is_vetted) VALUES ('imported',$1,'Imported Talent',true)", [details().email]);
  const svc = service();
  const pending = await svc.start(details({ first_name: "Talent", last_name: "Member" }), "claim",
    undefined, { purpose: "talent_claim" });
  const result = await svc.verify(pending.capability, pending.body.challengeId, emails.at(-1)!.code, "verify");
  assert.equal(result.user.first_name, "Imported");
  assert.equal(result.user.last_name, "Talent");
  assert.equal((await pool!.query("SELECT is_vetted FROM candidates WHERE id='imported'")).rows[0].is_vetted, true);
});
dbTest("passwordless imported Talent is claimed only by proved email, ignoring unrelated browser candidate IDs", async () => {
  await pool!.query("INSERT INTO candidates(id,email,full_name) VALUES ('imported',$1,'Imported Talent'),('unrelated','unrelated@example.test','Other')", [details().email]);
  const request = await begin();
  assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { candidateId: "imported" }), false);
  const activated = await request.svc.verify(request.capability, request.body.challengeId, request.code, "verify");
  assert.equal(activated.candidateId, "imported");
  assert.equal((await pool!.query("SELECT user_id,password_hash FROM candidates WHERE id='unrelated'")).rows[0].user_id, null);
});
dbTest("linked Talent uses users only, never conflicting candidate verification fields", async () => {
  await pool!.query(`INSERT INTO users(id,email,role) VALUES ('unverified','a@example.test','talent');
    INSERT INTO candidates(id,email,user_id,email_verified_at,email_verified_email,email_verification_required)
      VALUES ('candidate','a@example.test','unverified',now(),'a@example.test',false);`);
  assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { candidateId: "candidate" }), false);
  await pool!.query("UPDATE users SET email_verification_required=false");
  assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { candidateId: "candidate" }), true);
});
dbTest("new Admin/import password record is inactive while historical exemptions remain usable", async () => {
  await pool!.query(`INSERT INTO users(id,email,role,password_hash,email_verification_required) VALUES
    ('new','new@example.test','client','hash',true),('old','old@example.test','client','hash',false);`);
  assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { userId: "new" }), false);
  assert.equal(await hasEmailOwnership((sql, values) => pool!.query(sql, values), { userId: "old" }), true);
  assert.equal((await pool!.query("SELECT email_verified_at FROM users WHERE id='old'")).rows[0].email_verified_at, null);
});
dbTest("provider activation binds trusted provider subject; matching email cannot silently link another account", async () => {
  const svc = service();
  const request = await svc.start({ ...details({ role: "client" }), password: undefined }, "provider-ip", undefined,
    { purpose: "provider", provider: { provider: "google", subject: "provider-subject" } });
  assert.equal(await findOwnedProviderAccount((sql, values) => pool!.query(sql, values), "google", "provider-subject"), null);
  await svc.verify(request.capability, request.body.challengeId, emails.at(-1)!.code, "verify");
  assert.ok(await findOwnedProviderAccount((sql, values) => pool!.query(sql, values), "google", "provider-subject"));
  assert.equal(await findOwnedProviderAccount((sql, values) => pool!.query(sql, values), "google", "different-subject"), null);
});
dbTest("username race creates one account without partial role records", async () => {
  const a = await begin({ email: "a@example.test", username: "same" });
  const b = await begin({ email: "b@example.test", username: "same" });
  const results = await Promise.allSettled([
    a.svc.verify(a.capability, a.body.challengeId, a.code, "a"),
    b.svc.verify(b.capability, b.body.challengeId, b.code, "b"),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.deepEqual(await counts(), { users: 1, profiles: 1, candidates: 1, clients: 0 });
});
dbTest("duplicate signup race enforces shared cooldown; email race activates at most once", async () => {
  const results = await Promise.allSettled([
    service().start(details(), "a"), service().start(details(), "b"),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const first = (results.find(result => result.status === "fulfilled") as PromiseFulfilledResult<any>).value;
  const firstCode = emails[0].code;
  advance(60_001);
  const second = await service().start(details(), "c");
  const secondCode = emails.at(-1)!.code;
  const activated = await Promise.allSettled([
    service().verify(first.capability, first.body.challengeId, firstCode, "verify-a"),
    service().verify(second.capability, second.body.challengeId, secondCode, "verify-b"),
  ]);
  assert.equal(activated.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await counts()).users, 1);
});
dbTest("cancel/change email supersedes old challenge and status restores pending without credentials", async () => {
  const first = await begin();
  const state = await first.svc.status(first.capability);
  assert.equal(state.challengeId, first.body.challengeId);
  assert.equal("token" in state, false);
  await first.svc.cancel(first.capability, first.body.challengeId);
  const next = await first.svc.start(details({ email: "changed@example.test" }), "another-ip", first.capability);
  await rejectsCode(first.svc.verify(first.capability, first.body.challengeId, first.code, "verify"), "CHALLENGE_USED");
  assert.equal((await first.svc.status(next.capability)).challengeId, next.body.challengeId);
});
dbTest("plaintext OTP/password absent from persistence and sensitive transport exceptions are not logged", async () => {
  const request = await begin();
  const row = (await pool!.query("SELECT * FROM pending_registrations")).rows[0];
  assert.equal(row.password_hash, createHash("sha256").update(details().password).digest("hex"));
  assert.equal(row.code_hmac, signupCodeHmac(key, row, request.code));
  assert.equal(Object.values(row).includes(request.code), false);
  assert.equal(Object.values(row).includes(details().password), false);
  assert.equal("code" in request.body, false);
  assert.equal("code_hmac" in request.body, false);
  advance(60_001);
  const logged: unknown[] = [];
  const oldError = console.error;
  console.error = (...args) => { logged.push(...args); };
  deliveryThrows = true;
  try {
    const failed = await begin();
    assert.equal(failed.status, 503);
    assert.equal(JSON.stringify(logged).includes(failed.code), false);
    assert.equal(JSON.stringify(failed.body).includes(failed.code), false);
  } finally { console.error = oldError; }
});
dbTest("HTTP legacy, first-password, refresh, arbitrary sender/verified flags and cross-site requests are protected", async () => {
  const app = express();
  app.use(express.json());
  registerSignupVerificationRoutes(app, service());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const root = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: any, cookie?: string, origin?: string) => fetch(root + path, {
    method: "POST", headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }), ...(origin && { Origin: origin }) },
    body: JSON.stringify(body),
  });
  try {
    assert.equal((await post("/api/signup", { ...details(), senderEmail: "bad@example.test" })).status, 400);
    assert.equal((await post("/api/signup", { ...details(), emailVerified: true })).status, 400);
    assert.equal((await post("/api/signup", details(), undefined, "https://evil.test")).status, 403);
    for (const [index, path] of ["/signup", "/api/talent-auth/set-password", "/api/candidates/setup-password"].entries()) {
      const email = `legacy${index}@example.test`;
      const input = path === "/signup" ? details({ email })
        : path.endsWith("setup-password") ? { email, newPassword: details().password }
        : { email, password: details().password, candidateId: "arbitrary" };
      const response = await post(path, input);
      assert.equal(response.status, 202);
      const pending = await response.json() as any;
      assert.equal(pending.pendingVerification, true);
      assert.equal("token" in pending, false);
      const cookie = response.headers.get("set-cookie")!.split(";")[0];
      assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
      const state = await fetch(root + "/api/signup/status", { headers: { Cookie: cookie } });
      assert.equal(state.status, 200);
      assert.equal(((await state.json()) as any).challengeId, pending.challengeId);
      assert.equal((await post("/api/signup/verify", { challengeId: pending.challengeId, code: emails.at(-1)!.code, email: "other@example.test" }, cookie)).status, 400);
    }
    assert.equal((await counts()).users, 0);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});