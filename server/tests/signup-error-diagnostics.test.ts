import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { SignupGraphError, signupErrorDiagnostic } from "../lib/signupErrorDiagnostic";
import { SignupVerificationService } from "../services/signupVerificationService";
import { registerSignupVerificationRoutes } from "../routes/signupVerification";

test("SQL structural failure preserves class, SQLSTATE, message and source but not detail or parameters", () => {
  class DatabaseError extends Error {}
  const error = Object.assign(new DatabaseError('relation "signup_verification_limits" does not exist'), {
    code: "42P01", detail: "private@example.test 938421 Password123! token-value",
    parameters: ["private@example.test", "938421"],
  });
  error.stack = `DatabaseError: sensitive header\n    at SignupVerificationService.budget (/workspace/server/services/signupVerificationService.ts:66:29)`;
  assert.deepEqual(signupErrorDiagnostic(error), {
    errorClass: "DatabaseError", code: "42P01",
    message: 'relation "signup_verification_limits" does not exist',
    source: "server/services/signupVerificationService.ts:66:29",
  });
});

test("untrusted exception messages, names, codes and stack headers never reach diagnostics", () => {
  const secret = "secret-fixture-JWT-HMAC-password-938421";
  const error = Object.assign(new Error(`${secret} private@example.test`), { name: secret, code: secret });
  error.stack = `${secret}\n    at /untrusted/${secret}.ts:12:3`;
  assert.deepEqual(signupErrorDiagnostic(error), {
    errorClass: "Error", code: "UNEXPECTED_BACKEND_ERROR",
    message: "Signup backend exception; unsafe message withheld", source: "server/routes/signupVerification.ts",
  });
});

test("Graph rejection exposes only known provider code, stage and HTTP status", () => {
  for (const stage of ["token", "sendMail"] as const) {
    const body = JSON.stringify({ error: stage === "token" ? "invalid_client" : {
      code: "ErrorSendAsDenied", message: "private@example.test password OTP 938421",
    }, access_token: "never-log-token", error_description: "never-log-secret" });
    const result = signupErrorDiagnostic(new SignupGraphError(stage, 403, body));
    assert.equal(result.errorClass, "SignupGraphError");
    assert.equal("httpStatus" in result && result.httpStatus, 403);
    assert.equal("stage" in result && result.stage, stage);
    assert.equal("providerCode" in result && result.providerCode,
      stage === "token" ? "invalid_client" : "ErrorSendAsDenied");
    for (const value of ["private@example.test", "938421", "never-log-token", "never-log-secret"]) {
      assert.ok(!JSON.stringify(result).includes(value));
    }
  }
  assert.equal(new SignupGraphError("sendMail", 500, "HTML with secret").providerCode, "UNKNOWN_PROVIDER_CODE");
  assert.equal(new SignupGraphError("token", 400, '{"error":"secret-value"}').providerCode, "UNKNOWN_PROVIDER_CODE");
});

test("unexpected signup DB exception is safely logged while the HTTP response remains generic", async () => {
  const error = Object.assign(new Error('column "code_hmac" does not exist'), {
    code: "42703", detail: "never-log-email@example.test",
  });
  const service = new SignupVerificationService({
    assertConfigured() {},
    connect: async () => { throw error; },
    hashPassword: async () => { throw new Error("Unexpected hashing"); },
    hmacKey: () => { throw new Error("Unexpected OTP"); },
    send: async () => { throw new Error("Unexpected delivery"); },
    issueCredentials: () => { throw new Error("Unexpected activation"); },
  });
  const app = express();
  app.use(express.json());
  registerSignupVerificationRoutes(app, service);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const original = console.error;
  const logs: unknown[][] = [];
  console.error = (...args) => { logs.push(args); };
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "controlled@example.test", role: "talent",
        first_name: "Controlled", last_name: "Test", password: "ValidPassword123!" }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false, error: "VERIFICATION_UNAVAILABLE",
      message: "Signup is temporarily unavailable. Please try again.",
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], "[signup-verification] VERIFICATION_UNAVAILABLE");
    assert.equal((logs[0][1] as any).code, "42703");
    assert.equal((logs[0][1] as any).message, 'column "code_hmac" does not exist');
    assert.ok(!JSON.stringify(logs).includes("controlled@example.test"));
    assert.ok(!JSON.stringify(logs).includes("ValidPassword123!"));
    assert.ok(!JSON.stringify(logs).includes("never-log-email@example.test"));
  } finally {
    console.error = original;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});