import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";

const BASE_URL = process.env.BROWSER_BASE_URL ?? "http://127.0.0.1:5173";
const challenge = {
  success: false,
  pendingVerification: true,
  challengeId: "fixture-challenge-a",
  role: "talent" as const,
  maskedEmail: "t***@example.test",
  codeExpiresAt: "2035-03-10T12:10:00.000Z",
  resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: "2035-03-11T12:00:00.000Z",
  deliveryStatus: "accepted" as const,
};
let browser: Browser;

async function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers });
}

async function fixturePage(handler: (route: Route) => Promise<void>, path = "/signup/talent") {
  const context: BrowserContext = await browser.newContext({ serviceWorkers: "block" });
  const page: Page = await context.newPage();
  await page.route("**/api/**", async (route) => handler(route));
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-submit-signup").waitFor({ state: "visible" });
  return { context, page };
}

before(async () => {
  const url = new URL(BASE_URL);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "verification browser tests must use an isolated loopback frontend");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => { await browser?.close(); });

test("application continuation waits for email proof before storing credentials or linking the application", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let links = 0;
  let started = false;
  let verified = false;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/job-applications/continue/")) return json(route, 200, {
      submissionId: "submission-fixture", firstName: "Talent", lastName: "Fixture",
      email: "talent@example.test", phone: "", jobTitle: "Fixture role",
    });
    if (path === "/api/signup/status") return json(route, started && !verified ? 200 : 404, started ? challenge : {});
    if (path === "/api/signup") { started = true; return json(route, 202, challenge); }
    if (path === "/api/signup/verify") {
      verified = true;
      return json(route, 201, { success: true, token: "application-user-token",
        candidateId: "application-candidate", talentToken: "application-candidate-token",
        user: { id: "application-user", email: "talent@example.test", role: "talent" } });
    }
    if (path === "/api/job-applications/link") {
      assert.equal(verified, true);
      assert.equal(route.request().headers().authorization, "Bearer application-user-token");
      assert.deepEqual(route.request().postDataJSON(), { submissionId: "submission-fixture", token: "fixture-continuation" });
      links++;
      return json(route, 200, { success: true });
    }
    return json(route, 200, []);
  });
  try {
    await page.goto(`${BASE_URL}/talent/signup?applicationToken=fixture-continuation`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("application-signup-password").fill("ValidPass123!");
    await page.getByTestId("application-signup-confirm-password").fill("ValidPass123!");
    await page.getByTestId("application-signup-submit").click();
    await page.getByTestId("application-verification-code").waitFor({ state: "visible" });
    assert.equal(links, 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("application-verification-code").fill("004271");
    await page.getByTestId("application-verification-verify").click();
    await page.waitForURL(url => url.pathname === "/find-best-matches");
    assert.equal(links, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "application-user-token");
  } finally { await context.close(); }
});

test("Client signup remains pending and preserves invitation continuation only after verification", async () => {
  let signupPayload: any;
  const clientChallenge = { ...challenge, role: "client", maskedEmail: "c***@example.test" };
  const fixture = await fixturePage(async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/signup/status") return json(route, signupPayload ? 200 : 404, signupPayload ? clientChallenge : {});
    if (path === "/api/signup") {
      signupPayload = route.request().postDataJSON();
      return json(route, 202, clientChallenge);
    }
    if (path === "/api/signup/verify") return json(route, 201, {
      success: true, token: "verified-client-token", candidateId: null, talentToken: null,
      returnTo: "/hire-talent?invitation=fixture",
      user: { id: "client-fixture", email: "client@example.test", role: "client", first_name: "Client", last_name: "Fixture" },
    });
    return json(route, 200, []);
  }, "/signup/client");
  try {
    const page = fixture.page;
    await page.getByTestId("input-first-name").fill("Client");
    await page.getByTestId("input-last-name").fill("Fixture");
    await page.getByTestId("input-signup-email").fill("client@example.test");
    await page.getByTestId("input-company").fill("Fixture company");
    await page.getByTestId("input-signup-password").fill("ValidPass123!");
    await page.getByTestId("input-confirm-password").fill("ValidPass123!");
    await page.getByTestId("checkbox-terms").click();
    await page.getByTestId("button-submit-signup").click();
    await page.getByTestId("signup-verification-code").waitFor({ state: "visible" });
    assert.equal(signupPayload.role, "client");
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
    await page.getByTestId("signup-verification-code").fill("004271");
    await page.getByTestId("signup-verification-verify").click();
    await page.waitForURL(url => url.pathname === "/hire-talent" && url.searchParams.get("invitation") === "fixture");
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "verified-client-token");
    assert.equal(await page.evaluate(() => localStorage.getItem("talent_profile_token")), null);
  } finally { await fixture.context.close(); }
});

test("wrong/expired codes, Retry-After and failed change-email remain visible without credentials", async () => {
  let verifies = 0;
  const fixture = await fixturePage(async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/signup/status") return json(route, 200, challenge);
    if (path === "/api/signup/verify") {
      verifies++;
      return json(route, verifies === 1 ? 400 : 410, { success: false,
        message: verifies === 1 ? "That code is incorrect." : "Request a new code." });
    }
    if (path === "/api/signup/resend") return json(route, 429, { message: "Please try again later." }, { "Retry-After": "120" });
    if (path === "/api/signup/cancel") return json(route, 503, { message: "Temporarily unavailable." });
    return json(route, 200, []);
  });
  try {
    const page = fixture.page;
    await page.getByTestId("signup-verification-code").fill("004271");
    await page.getByTestId("signup-verification-verify").click();
    await page.getByRole("alert").filter({ hasText: "That code is incorrect." }).waitFor();
    await page.getByTestId("signup-verification-verify").click();
    await page.getByRole("alert").filter({ hasText: "Request a new code." }).waitFor();
    await page.getByTestId("signup-verification-resend").click();
    await page.getByRole("alert").filter({ hasText: "Please try again later." }).waitFor();
    assert.equal(await page.getByTestId("signup-verification-resend").isDisabled(), true);
    await page.getByTestId("signup-verification-change").click();
    await page.getByRole("alert").filter({ hasText: "Could not safely restart signup" }).waitFor();
    assert.equal(await page.getByTestId("signup-verification-code").isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
  } finally { await fixture.context.close(); }
});

test("signup stays pending without browser credentials, refresh recovers server state, then verifies", async () => {
  let signupPayload: Record<string, unknown> | undefined;
  let verifyPayload: Record<string, unknown> | undefined;
  let activated = false;
  const testPage = await fixturePage(async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/signup/status") return json(route, signupPayload ? 200 : 404,
      activated || !signupPayload ? { pendingVerification: false } : challenge);
    if (url.pathname === "/api/signup" && request.method() === "POST") {
      signupPayload = request.postDataJSON() as Record<string, unknown>;
      return json(route, 202, challenge);
    }
    if (url.pathname === "/api/signup/verify" && request.method() === "POST") {
      verifyPayload = request.postDataJSON() as Record<string, unknown>;
      activated = true;
      return json(route, 201, {
        success: true,
        token: "verified-main-token",
        user: { id: "fixture-user", email: "talent@example.test", role: "talent", first_name: "Taylor", last_name: "Fixture" },
        talentToken: "verified-talent-token",
        candidateId: "fixture-candidate",
      });
    }
    if (url.pathname === "/api/signup/resend" && request.method() === "POST") return json(route, 202, challenge);
    if (url.pathname === "/api/signup/cancel" && request.method() === "POST") return json(route, 200, { success: true });
    return json(route, 200, []);
  });
  try {
    const page = testPage.page;
    await page.getByTestId("input-first-name").fill("Taylor");
    await page.getByTestId("input-last-name").fill("Fixture");
    await page.getByTestId("input-signup-email").fill("talent@example.test");
    await page.getByTestId("input-signup-password").fill("ValidPass123!");
    await page.getByTestId("input-confirm-password").fill("ValidPass123!");
    await page.getByTestId("checkbox-terms").click();
    await page.getByTestId("button-submit-signup").click();
    await page.getByTestId("signup-verification-code").waitFor({ state: "visible" });
    assert.equal(signupPayload?.role, "talent");
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("talent_profile_token")), null);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("signup-verification-code").waitFor({ state: "visible" });
    await page.getByTestId("signup-verification-code").fill("004271");
    await page.getByTestId("signup-verification-verify").click();
    await page.waitForURL((target) => target.pathname === "/get-hired");
    assert.deepEqual(verifyPayload, { challengeId: challenge.challengeId, code: "004271" });
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "verified-main-token");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("talent_profile_token") || "null")?.candidateId), "fixture-candidate");
  } finally { await testPage.context.close(); }
});

test("send failure remains a pending challenge and resend does not activate an account", async () => {
  let resendPayload: Record<string, unknown> | undefined;
  let signupPayload: Record<string, unknown> | undefined;
  const failed = { ...challenge, deliveryStatus: "failed" as const };
  const testPage = await fixturePage(async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/signup/status") return json(route, 404, { error: "no_pending_signup" });
    if (url.pathname === "/api/signup" && request.method() === "POST") {
      signupPayload = request.postDataJSON() as Record<string, unknown>;
      return json(route, 503, failed);
    }
    if (url.pathname === "/api/signup/resend" && request.method() === "POST") {
      resendPayload = request.postDataJSON() as Record<string, unknown>;
      return json(route, 202, challenge);
    }
    return json(route, 200, []);
  });
  try {
    const page = testPage.page;
    await page.getByTestId("input-first-name").fill("Casey");
    await page.getByTestId("input-last-name").fill("NoMail");
    await page.getByTestId("input-signup-email").fill("casey@example.test");
    await page.getByTestId("input-signup-password").fill("ValidPass123!");
    await page.getByTestId("input-confirm-password").fill("ValidPass123!");
    await page.getByTestId("checkbox-terms").click();
    await page.getByTestId("button-submit-signup").click();
    await page.getByTestId("signup-verification").waitFor({ state: "visible" });
    assert.equal(await page.getByText(/did not accept the message/i).count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
    await page.getByTestId("signup-verification-resend").click();
    assert.deepEqual(resendPayload, { challengeId: challenge.challengeId });
    assert.equal(signupPayload?.password, "ValidPass123!");
    assert.equal(await page.evaluate(() => localStorage.getItem("talent_profile_token")), null);
  } finally { await testPage.context.close(); }
});