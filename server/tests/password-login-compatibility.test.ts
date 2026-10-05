import assert from "node:assert/strict";
import { before, test } from "node:test";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import ts from "typescript";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword, validateEmail } from "../auth-utils";
import { authenticatePassword } from "../lib/passwordAuthentication";
import { hasEmailOwnership, type OwnershipIdentity, type OwnershipQuery } from "../lib/emailOwnership";

const password = "Fixture-Only-Password-123!";
const cutoff = "2026-10-02T19:18:20.812Z";
let hash: string;
before(async () => { hash = await hashPassword(password); });

function fixture(identity?: OwnershipIdentity, options: { ledger?: boolean; brokenLedger?: boolean } = {}) {
  const calls: string[] = [];
  const query: OwnershipQuery = async (sql, values) => {
    calls.push(sql);
    assert.match(sql, /^SELECT\b/);
    if (sql.includes("to_regclass")) return { rows: [{ has_rollout_ledger: options.ledger !== false }] };
    if (sql.includes("FROM app_schema_migrations")) {
      if (options.brokenLedger) throw new Error("fixture ledger unavailable");
      assert.equal(values?.[0], "0033_signup_email_verification");
      return { rows: [{ historical_password_access: Date.parse(values?.[1]) < Date.parse(cutoff) }] };
    }
    return { rows: identity ? [{ identity }] : [] };
  };
  return { query, calls };
}

function old(role: string): OwnershipIdentity {
  return { role, email: `${role}@example.test`, password_hash: hash,
    created_at: "2026-09-01T00:00:00", email_verification_required: true,
    email_verified_at: null, email_verified_email: null };
}
function fresh(role: string): OwnershipIdentity {
  return { ...old(role), created_at: "2026-10-05T00:00:00",
    email_verified_at: "2026-10-05T00:00:00Z", email_verified_email: `${role}@example.test` };
}

for (const role of ["talent", "client"]) {
  test(`historical ${role} bcrypt login succeeds despite the DEFAULT-true rollout drift`, async () => {
    const { query, calls } = fixture(old(role));
    const identity = role === "talent" ? { candidateId: "linked-candidate" } : { userId: "client" };
    assert.equal(await authenticatePassword(query, identity, password, hash), "authenticated");
    assert.ok(calls.some(sql => sql.includes("app_schema_migrations")));
  });
  test(`new verified ${role} login still succeeds without a legacy exception`, async () => {
    const { query, calls } = fixture(fresh(role));
    assert.equal(await authenticatePassword(query, { userId: role }, password, hash), "authenticated");
    assert.equal(calls.length, 1);
  });
  test(`incorrect historical ${role} password remains rejected`, async () => {
    const { query } = fixture(old(role));
    assert.equal(await authenticatePassword(query, { userId: role }, "Incorrect-Password!", hash), "invalid_password");
  });
  test(`new unverified ${role} remains blocked even with the correct password`, async () => {
    const { query } = fixture({ ...old(role), created_at: "2026-10-05T00:00:00Z" });
    assert.equal(await authenticatePassword(query, { userId: role }, password, hash), "verification_required");
  });
  test(`signup-exception ${role} account remains usable after verification is re-enabled`, async () => {
    const { query } = fixture({ ...old(role), created_at: "2026-10-05T00:00:00Z", email_verification_required: false });
    assert.equal(await authenticatePassword(query, { userId: role }, password, hash), "authenticated");
  });
}

test("existing Admin authentication is unchanged and still checks the password", async () => {
  const { query, calls } = fixture(old("admin"));
  assert.equal(await authenticatePassword(query, { userId: "admin" }, password, hash), "authenticated");
  assert.equal(await authenticatePassword(query, { userId: "admin" }, "Incorrect-Password!", hash), "invalid_password");
  assert.equal(calls.length, 2);
});

test("unknown account and missing password remain rejected", async () => {
  const { query, calls } = fixture();
  assert.equal(await authenticatePassword(query, { userId: "missing" }, password, undefined), "invalid_password");
  assert.equal(await hasEmailOwnership(query, { userId: "missing" }), false);
  assert.equal(calls.length, 1);
});

test("established pre-metadata account and candidate-only credentials remain supported", async () => {
  const preMetadata = fixture({ role: "talent", email: "old@example.test" });
  assert.equal(await authenticatePassword(preMetadata.query, { userId: "old" }, password, hash), "authenticated");
  const candidateOnly = fixture({ ...old("talent"), role: undefined });
  assert.equal(await authenticatePassword(candidateOnly.query, { candidateId: "candidate-only" }, password, hash), "authenticated");
});

test("missing rollout evidence fails closed; database failure is not mislabeled as a bad password", async () => {
  const absent = fixture(old("client"), { ledger: false });
  assert.equal(await authenticatePassword(absent.query, { userId: "old" }, password, hash), "verification_required");
  assert.equal(absent.calls.length, 2);
  const failed = fixture(old("client"), { brokenLedger: true });
  await assert.rejects(authenticatePassword(failed.query, { userId: "old" }, password, hash), /ledger unavailable/);
});

test("passwordless imports, orphaned links, changed verified email and cutoff-boundary records are not grandfathered", async () => {
  for (const identity of [
    { ...old("talent"), password_hash: null },
    { ...old("talent"), password_hash: "unrecognized-credential" },
    { ...old("talent"), created_at: cutoff },
    { ...old("talent"), created_at: undefined },
    { ...old("talent"), email_verified_at: cutoff, email_verified_email: "different@example.test" },
    undefined,
  ]) {
    const { query } = fixture(identity);
    assert.equal(await hasEmailOwnership(query, { candidateId: "candidate" }), false);
  }
});

test("current and historical bcrypt use the same raw-password verifier, never double hashing", async () => {
  assert.match(hash, /^\$2b\$12\$/);
  assert.equal(hash.length, 60);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(await hashPassword(password), hash), false);
});

test("all four production login branches use the tested checker; token signing remains outside it", () => {
  const source = readFileSync("server/routes.ts", "utf8");
  for (const path of ["/api/login", "/api/talent-auth/login", "/login"]) {
    const start = source.indexOf(`app.post("${path}",`);
    assert.ok(start >= 0);
    const end = source.indexOf("\n  app.", start + 1);
    const route = source.slice(start, end < 0 ? undefined : end);
    assert.ok(route.includes("authenticatePassword("), path);
    assert.ok(route.includes("jwt.sign("), path);
    assert.ok(route.includes('passwordAuthentication === "verification_required"'), path);
  }
  assert.equal((source.match(/await authenticatePassword\(/g) ?? []).length, 4);
  assert.ok(!readFileSync("server/lib/passwordAuthentication.ts", "utf8").includes("jwt.sign"));
});

// Extract the actual registered handler, not a hand-written imitation. Inject
// only its dependencies so importing startup cannot touch real data/providers.
function productionHandler(path: string, user: OwnershipIdentity & { id?: string } | undefined, candidate?: any) {
  const file = ts.createSourceFile("routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let handlerText = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.getText(file) === "app.post" && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === path) handlerText = node.arguments.at(-1)!.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(handlerText, `Missing production handler ${path}`);
  const code = ts.transpileModule(`const handler = ${handlerText};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const owner = fixture(user);
  let createdCandidates = 0;
  const query: OwnershipQuery = async (sql, values) => {
    if (sql.includes("INSERT INTO candidates")) {
      createdCandidates++;
      return { rows: [{ id: "created-candidate" }] };
    }
    if (sql.includes("FROM users WHERE email") || sql.includes("FROM users WHERE lower(email)")) {
      return { rows: user?.email === values?.[0] ? [user] : [] };
    }
    if (sql.includes("SELECT id FROM candidates")) return { rows: [] };
    return owner.query(sql, values);
  };
  const quietConsole = { log() {}, warn() {}, error() {} };
  const handler = new Function("query", "storage", "authenticatePassword", "jwt", "validateEmail",
    "process", "console", "handleRouteError", `${code}\nreturn handler;`)(
    query, { getCandidateByEmail: async (email: string) => candidate?.email === email ? candidate : undefined },
    authenticatePassword, jwt, validateEmail,
    { env: { NODE_ENV: "production", JWT_SECRET: "fixture-only-jwt-key-not-a-real-secret" } },
    quietConsole, (error: unknown) => { throw error; },
  );
  return {
    createdCandidates: () => createdCandidates,
    async run(email: string, submittedPassword: string) {
      const response = { status: 200, body: {} as any };
      const res = {
        status(value: number) { response.status = value; return this; },
        json(value: unknown) { response.body = value; return this; },
      };
      await handler({ body: { email, password: submittedPassword }, requestId: "fixture", ip: "127.0.0.1",
        get: () => "fixture-agent" }, res);
      return response;
    },
  };
}

for (const path of ["/api/login", "/login", "/api/talent-auth/login"]) {
  test(`${path}: actual production handler accepts old/new accounts and rejects incorrect/unknown credentials`, async () => {
    const role = path === "/api/talent-auth/login" ? "talent" : "client";
    for (const identity of [old(role), fresh(role)]) {
      const user = { ...identity, id: `${role}-user` };
      const candidate = role === "talent" ? { id: "candidate", email: user.email, passwordHash: hash } : undefined;
      const actual = productionHandler(path, user, candidate);
      const accepted = await actual.run(user.email!, password);
      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.success, true);
      const claims = jwt.verify(accepted.body.token, "fixture-only-jwt-key-not-a-real-secret") as jwt.JwtPayload;
      if (role === "talent") {
        assert.equal(claims.type, "candidate");
        assert.equal(claims.candidateId, "candidate");
      } else {
        assert.equal(claims.userId, user.id);
        assert.equal(claims.role, role);
      }
      assert.equal(claims.exp! - claims.iat!, (role === "talent" ? 30 : 7) * 86400);
      assert.equal((await actual.run(user.email!, "Incorrect-Password!")).status, 401);
      assert.equal((await actual.run("unknown@example.test", password)).status, 401);
    }
  });
}

test("actual Admin handler retains role; legacy Talent fallback creates a candidate only after password verification", async () => {
  const admin = { ...old("admin"), id: "admin" };
  const accepted = await productionHandler("/api/login", admin).run(admin.email!, password);
  assert.equal(accepted.body.user.role, "admin");
  const legacy = { ...old("talent"), id: "legacy-without-candidate" };
  const route = productionHandler("/api/talent-auth/login", legacy);
  assert.equal((await route.run(legacy.email!, "Incorrect-Password!")).status, 401);
  assert.equal(route.createdCandidates(), 0);
  const response = await route.run(legacy.email!, password);
  assert.equal(response.status, 200);
  assert.equal(response.body.candidate.id, "created-candidate");
  assert.equal(route.createdCandidates(), 1);
});

const sqlTarget = process.env.AUTH_COMPATIBILITY_TEST_DATABASE_URL;
test("real PostgreSQL chronology, canonical linked-user ownership and DEFAULT-true drift", { skip: !sqlTarget }, async () => {
  const url = new URL(sqlTarget!);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/auth_compatibility_test");
  const pool = new Pool({ connectionString: sqlTarget, max: 1 });
  try {
    await pool.query(`CREATE TABLE users(id text PRIMARY KEY,role text,email text,password_hash text,
      created_at timestamp,email_verification_required boolean DEFAULT true,
      email_verified_at timestamptz,email_verified_email text);
      CREATE TABLE candidates(id text PRIMARY KEY,user_id text,email text,password_hash text,
      created_at timestamp,email_verification_required boolean DEFAULT true,
      email_verified_at timestamptz,email_verified_email text);
      CREATE TABLE app_schema_migrations(id text PRIMARY KEY,applied_at timestamptz);`);
    await pool.query("INSERT INTO app_schema_migrations VALUES($1,$2)", ["0033_signup_email_verification", cutoff]);
    await pool.query(`INSERT INTO users(id,role,email,password_hash,created_at) VALUES
      ('legacy','talent','old@example.test',$1,'2026-09-01'),
      ('new','talent','new@example.test',$1,'2026-10-05')`, [hash]);
    await pool.query(`INSERT INTO candidates(id,user_id,email,password_hash,created_at,email_verification_required)
      VALUES ('linked','legacy','old@example.test',$1,'2026-10-05',true),
      ('unverified-link','new','new@example.test',$1,'2026-09-01',false),
      ('orphan','missing','orphan@example.test',$1,'2026-09-01',false)`, [hash]);
    const query: OwnershipQuery = (sql, values) => pool.query(sql, values);
    assert.equal(await authenticatePassword(query, { candidateId: "linked" }, password, hash), "authenticated");
    assert.equal(await authenticatePassword(query, { candidateId: "unverified-link" }, password, hash), "verification_required");
    assert.equal(await hasEmailOwnership(query, { candidateId: "orphan" }), false);
    assert.equal(await authenticatePassword(query, { userId: "legacy" }, "Wrong-Password!", hash), "invalid_password");
    const unchanged = await pool.query("SELECT password_hash=$1 AS hash_unchanged,email_verification_required,email_verified_at FROM users WHERE id='legacy'", [hash]);
    assert.deepEqual(unchanged.rows[0], { hash_unchanged: true, email_verification_required: true, email_verified_at: null });
  } finally { await pool.end(); }
});
