import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { assertSignupVerificationConfigured } from "../services/signupVerificationConfig";
import { SignupError, SignupVerificationService } from "../services/signupVerificationService";
import { registerSignupVerificationRoutes } from "../routes/signupVerification";

const configured = (): NodeJS.ProcessEnv => ({
  EMAIL_VERIFICATION_HMAC_KEY: "synthetic-key-value-for-config-tests-only",
  JWT_SECRET: "synthetic-jwt-secret",
  MICROSOFT_TENANT_ID: "synthetic-tenant",
  MICROSOFT_CLIENT_ID: "synthetic-client",
  MICROSOFT_CLIENT_SECRET: "synthetic-client-secret",
  CLIENT_VERIFICATION_EMAIL_FROM: "HireTalent@onspotglobal.com",
  TALENT_VERIFICATION_EMAIL_FROM: "FindWork@onspotglobal.com",
});

function failure(env: NodeJS.ProcessEnv) {
  const logs: unknown[][] = [];
  assert.throws(
    () => assertSignupVerificationConfigured(env, (...args) => logs.push(args)),
    (error: unknown) => error instanceof SignupError
      && error.status === 503 && error.code === "VERIFICATION_NOT_CONFIGURED"
      && error.message === "Email verification is temporarily unavailable.",
  );
  assert.equal(logs.length, 1);
  return logs[0];
}

test("valid development and production configurations pass without logging", () => {
  for (const NODE_ENV of ["development", "production"]) {
    let calls = 0;
    assertSignupVerificationConfigured({ ...configured(), NODE_ENV }, () => calls++);
    assert.equal(calls, 0);
  }
});

test("all missing prerequisites are reported together using only allowed statuses", () => {
  assert.deepEqual(failure({}), [
    "[signup-verification] VERIFICATION_NOT_CONFIGURED",
    {
      EMAIL_VERIFICATION_HMAC_KEY: "missing",
      JWT_SECRET: "missing",
      MICROSOFT_TENANT_ID: "missing",
      MICROSOFT_CLIENT_ID: "missing",
      MICROSOFT_CLIENT_SECRET: "missing",
      CLIENT_VERIFICATION_EMAIL_FROM: "invalid",
      TALENT_VERIFICATION_EMAIL_FROM: "invalid",
    },
  ]);
});

for (const key of ["JWT_SECRET", "MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"]) {
  test(`${key} reports only missing, without other configuration values`, () => {
    assert.deepEqual(failure({ ...configured(), [key]: "" })[1], { [key]: "missing" });
  });
}

test("HMAC diagnostics distinguish missing and too short without disclosing value or byte count", () => {
  assert.deepEqual(failure({ ...configured(), EMAIL_VERIFICATION_HMAC_KEY: "" })[1],
    { EMAIL_VERIFICATION_HMAC_KEY: "missing" });
  const shortKey = "x".repeat(31);
  const log = failure({ ...configured(), EMAIL_VERIFICATION_HMAC_KEY: shortKey });
  assert.deepEqual(log[1], { EMAIL_VERIFICATION_HMAC_KEY: "too short" });
  assert.ok(!JSON.stringify(log).includes(shortKey));
  assert.ok(!JSON.stringify(log).includes("31"));
  assertSignupVerificationConfigured({ ...configured(), EMAIL_VERIFICATION_HMAC_KEY: "x".repeat(32) });
  assertSignupVerificationConfigured({ ...configured(), EMAIL_VERIFICATION_HMAC_KEY: "é".repeat(16) });
});

test("both sender diagnostics use existing exact-role validation and never log supplied addresses", () => {
  for (const key of ["CLIENT_VERIFICATION_EMAIL_FROM", "TALENT_VERIFICATION_EMAIL_FROM"]) {
    const invalid = "untrusted-recipient@example.test\nsecret-marker";
    const log = failure({ ...configured(), [key]: invalid });
    assert.deepEqual(log[1], { [key]: "invalid" });
    assert.ok(!JSON.stringify(log).includes(invalid));
    assert.ok(!JSON.stringify(log).includes("secret-marker"));
  }
  assertSignupVerificationConfigured({
    ...configured(),
    CLIENT_VERIFICATION_EMAIL_FROM: " HIRETALENT@ONSPOTGLOBAL.COM ",
    TALENT_VERIFICATION_EMAIL_FROM: " FINDWORK@ONSPOTGLOBAL.COM ",
  });
  assert.deepEqual(failure({
    ...configured(), CLIENT_VERIFICATION_EMAIL_FROM: "FindWork@onspotglobal.com",
  })[1], { CLIENT_VERIFICATION_EMAIL_FROM: "invalid" });
});

test("browser response remains generic for both signup aliases and fails before DB, OTP or delivery", async () => {
  const logs: unknown[][] = [];
  const deny = () => { throw new Error("Unexpected account, database or email operation"); };
  const service = new SignupVerificationService({
    assertConfigured: () => assertSignupVerificationConfigured({}, (...args) => logs.push(args)),
    connect: async () => deny(),
    hashPassword: async () => deny(),
    hmacKey: deny,
    send: async () => deny(),
    issueCredentials: deny,
  });
  const app = express();
  app.use(express.json());
  registerSignupVerificationRoutes(app, service);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    for (const path of ["/api/signup", "/signup"]) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        success: false, error: "VERIFICATION_NOT_CONFIGURED",
        message: "Email verification is temporarily unavailable.",
      });
    }
    assert.equal(logs.length, 2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});