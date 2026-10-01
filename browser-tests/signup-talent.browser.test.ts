import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const VALID_PASSWORD = "ValidPass123!";
const NETWORK_ERROR = "Unable to connect to the server. Your details are still here. Please check your connection and try again.";
const DUPLICATE_ERROR = "An account with this email or username already exists. Please sign in instead, or use a different email address.";

let browser: Browser;
let vite: ChildProcess | undefined;
let viteCacheDir: string | undefined;

type SignupRouteHandler = (route: Route) => Promise<void>;

interface SignupTestPage {
  context: BrowserContext;
  page: Page;
  postCount: () => number;
  payloads: () => Record<string, unknown>[];
}

async function fulfillJson(route: Route, body: unknown, status = 200, headers?: Record<string, string>) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
    headers,
  });
}

async function waitForUrl(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (vite?.exitCode !== null && vite?.exitCode !== undefined) {
      throw new Error(`Isolated Vite exited with code ${vite.exitCode}`);
    }
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Isolated Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for isolated Vite at ${url}`);
}

async function newSignupPage(options: {
  mobile?: boolean;
  signupHandler?: SignupRouteHandler;
} = {}): Promise<SignupTestPage> {
  const context = await browser.newContext({
    viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    ...(options.mobile ? { isMobile: true, hasTouch: true } : {}),
    serviceWorkers: "block",
  });
  // Serialized evaluate callbacks can reference this shim when tsx preserves function names.
  await context.addInitScript("window.__name = (fn) => fn;");
  const page = await context.newPage();
  let signupPostCount = 0;
  const signupPayloads: Record<string, unknown>[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      if (request.method() === "POST" && url.pathname === "/api/signup") {
        signupPostCount += 1;
        try {
          signupPayloads.push(request.postDataJSON() as Record<string, unknown>);
        } catch {
          signupPayloads.push({});
        }
        if (options.signupHandler) return options.signupHandler(route);
        return fulfillJson(route, { message: "Unexpected signup request in this test" }, 500);
      }

      // Shared page chrome and post-signup destinations stay isolated from real APIs.
      return fulfillJson(route, []);
    }
    if (url.origin !== new URL(BASE_URL).origin) return route.abort();
    return route.continue();
  });

  await page.goto(`${BASE_URL}/signup/talent`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-submit-signup").waitFor({ state: "visible" });
  return {
    context,
    page,
    postCount: () => signupPostCount,
    payloads: () => signupPayloads,
  };
}

interface ApplicationSignupTestPage {
  context: BrowserContext;
  page: Page;
  signupPostCount: () => number;
  linkPostCount: () => number;
  signupPayloads: () => Record<string, unknown>[];
  linkPayloads: () => Record<string, unknown>[];
}

async function newApplicationSignupPage(options: {
  query: string;
  signupHandler?: SignupRouteHandler;
  linkHandler?: SignupRouteHandler;
}): Promise<ApplicationSignupTestPage> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  await context.addInitScript("window.__name = (fn) => fn;");
  const page = await context.newPage();
  let signupPosts = 0;
  let linkPosts = 0;
  const signupPayloads: Record<string, unknown>[] = [];
  const linkPayloads: Record<string, unknown>[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      if (request.method() === "POST" && url.pathname === "/api/signup") {
        signupPosts += 1;
        signupPayloads.push((request.postDataJSON() as Record<string, unknown>) ?? {});
        if (options.signupHandler) return options.signupHandler(route);
        return fulfillJson(route, { message: "Unexpected signup request in this test" }, 500);
      }
      if (request.method() === "POST" && url.pathname === "/api/job-applications/link") {
        linkPosts += 1;
        linkPayloads.push((request.postDataJSON() as Record<string, unknown>) ?? {});
        if (options.linkHandler) return options.linkHandler(route);
        return fulfillJson(route, { error: "Unexpected application link request in this test" }, 500);
      }
      if (request.method() === "GET" && url.pathname.startsWith("/api/job-applications/continue/")) {
        return fulfillJson(route, {
          submissionId: "application-submission-45",
          firstName: "Avery",
          lastName: "Applicant",
          email: "avery.applicant@example.test",
          phone: "555-0100",
          jobTitle: "Product Designer",
        });
      }
      return fulfillJson(route, []);
    }
    if (url.origin !== new URL(BASE_URL).origin) return route.abort();
    return route.continue();
  });

  await page.goto(`${BASE_URL}/talent/signup${options.query}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("application-signup-submit").waitFor({ state: "visible" });
  return {
    context,
    page,
    signupPostCount: () => signupPosts,
    linkPostCount: () => linkPosts,
    signupPayloads: () => signupPayloads,
    linkPayloads: () => linkPayloads,
  };
}

async function fillValidForm(page: Page, overrides: {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
} = {}): Promise<void> {
  await page.getByTestId("input-first-name").fill(overrides.firstName ?? "Taylor");
  await page.getByTestId("input-last-name").fill(overrides.lastName ?? "Regression");
  await page.getByTestId("input-signup-email").fill(overrides.email ?? "taylor.signup@example.test");
  await page.getByTestId("input-signup-password").fill(overrides.password ?? VALID_PASSWORD);
  await page.getByTestId("input-confirm-password").fill(overrides.password ?? VALID_PASSWORD);
  await page.getByTestId("checkbox-terms").click();
}

async function fillApplicationPassword(page: Page, password = VALID_PASSWORD): Promise<void> {
  await page.getByTestId("application-signup-password").fill(password);
  await page.getByTestId("application-signup-confirm-password").fill(password);
}

async function assertFormValues(page: Page, values: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<void> {
  assert.equal(await page.getByTestId("input-first-name").inputValue(), values.firstName);
  assert.equal(await page.getByTestId("input-last-name").inputValue(), values.lastName);
  assert.equal(await page.getByTestId("input-signup-email").inputValue(), values.email);
  assert.equal(await page.getByTestId("input-signup-password").inputValue(), values.password);
  assert.equal(await page.getByTestId("input-confirm-password").inputValue(), values.password);
  assert.equal(await page.getByTestId("checkbox-terms").getAttribute("aria-checked"), "true");
}

async function assertSignupErrorMessage(page: Page, expectedMessage: string): Promise<void> {
  const alert = page.getByTestId("signup-error");
  await alert.waitFor({ state: "visible" });
  const message = alert.locator("p").nth(1);
  await message.waitFor({ state: "visible" });
  assert.equal((await message.innerText()).trim(), expectedMessage);
}

async function successfulTalentSignup(mobile: boolean): Promise<void> {
  const user = {
    id: "signup-talent-regression",
    email: "success.talent@example.test",
    first_name: "Success",
    last_name: "Talent",
    role: "talent",
  };
  const talentAuth = {
    token: "signup-regression-talent-jwt",
    candidateId: "signup-regression-candidate",
    email: user.email,
    fullName: `${user.first_name} ${user.last_name}`,
  };
  const testPage = await newSignupPage({
    mobile,
    signupHandler: (route) => fulfillJson(route, {
      success: true,
      token: "signup-regression-jwt",
      user,
      talentToken: "signup-regression-talent-jwt",
      candidateId: "signup-regression-candidate",
    }, 201),
  });
  try {
    await fillValidForm(testPage.page, {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
    });
    const submit = testPage.page.getByTestId("button-submit-signup");
    if (mobile) await submit.tap();
    else await submit.click();
    await testPage.page.waitForURL((url) => url.pathname === "/get-hired");

    assert.equal(testPage.page.url(), new URL("/get-hired", BASE_URL).href);
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "signup-regression-jwt");
    assert.deepEqual(
      await testPage.page.evaluate(() => JSON.parse(localStorage.getItem("onspot_user") || "null")),
      user,
    );
    assert.deepEqual(
      await testPage.page.evaluate(() => JSON.parse(localStorage.getItem("talent_profile_token") || "null")),
      talentAuth,
    );
    await testPage.page.reload({ waitUntil: "domcontentloaded" });
    assert.deepEqual(
      await testPage.page.evaluate(() => JSON.parse(localStorage.getItem("talent_profile_token") || "null")),
      talentAuth,
      "candidate portal credentials must remain available after a reload",
    );
    assert.equal(testPage.postCount(), 1);
  } finally {
    await testPage.context.close();
  }
}

before(async () => {
  const baseUrl = new URL(BASE_URL);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
    "Signup browser tests must use a loopback frontend only");

  if (!process.env.BROWSER_BASE_URL) {
    viteCacheDir = mkdtempSync(join(tmpdir(), "auth-browser-vite-"));
    const viteEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
    delete viteEnv.REPL_ID;
    viteEnv.AUTH_BROWSER_CACHE_DIR = viteCacheDir;
    vite = spawn(process.execPath, [
      "node_modules/vite/bin/vite.js",
      "--host", "127.0.0.1",
      "--port", String(PORT),
      "--strictPort",
    ], { stdio: "pipe", env: viteEnv });
    await waitForUrl(BASE_URL);
  }

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([once(vite, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
  if (viteCacheDir) {
    rmSync(viteCacheDir, { recursive: true, force: true });
  }
});

test("mobile touch signup rejects a password missing a special character without posting", async () => {
  const testPage = await newSignupPage({ mobile: true });
  try {
    await fillValidForm(testPage.page, { password: "ValidPass123" });
    await testPage.page.getByTestId("button-submit-signup").tap();

    await assertSignupErrorMessage(testPage.page, "Password must contain at least one special character");
    await testPage.page.getByTestId("button-submit-signup").waitFor({ state: "visible" });
    assert.equal(testPage.postCount(), 0, "invalid password must be rejected before any signup POST");
  } finally {
    await testPage.context.close();
  }
});

test("mobile touch signup keeps a backend error visible beside the sticky submit button", async () => {
  const backendMessage = "Your signup could not be completed right now.";
  const testPage = await newSignupPage({
    mobile: true,
    signupHandler: (route) => fulfillJson(route, { message: backendMessage }, 400),
  });
  try {
    await fillValidForm(testPage.page);
    await testPage.page.getByTestId("button-submit-signup").tap();

    await assertSignupErrorMessage(testPage.page, backendMessage);
    const alert = testPage.page.getByTestId("signup-error");
    const submit = testPage.page.getByTestId("button-submit-signup");
    await submit.waitFor({ state: "visible" });
    assert.equal(await alert.locator("xpath=..").getByTestId("button-submit-signup").count(), 1,
      "the persistent inline error and submit CTA must share the sticky footer");
    const visibleInViewport = await testPage.page.evaluate(() => {
      const alertElement = document.querySelector<HTMLElement>('[data-testid="signup-error"]');
      const submitElement = document.querySelector<HTMLElement>('[data-testid="button-submit-signup"]');
      if (!alertElement || !submitElement) return false;
      const alertRect = alertElement.getBoundingClientRect();
      const submitRect = submitElement.getBoundingClientRect();
      const withinViewport = (rect: DOMRect) =>
        rect.left >= 0 && rect.top >= 0
        && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
      return withinViewport(alertRect) && withinViewport(submitRect);
    });
    assert.equal(visibleInViewport, true, "mobile footer error and submit button must remain inside the viewport");
  } finally {
    await testPage.context.close();
  }
});

test("desktop signup shows an exact backend 400 message inline and preserves entered values", async () => {
  const backendMessage = "The email address cannot be used for this account.";
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(route, { message: backendMessage }, 400),
  });
  try {
    const values = {
      firstName: "Jordan",
      lastName: "Preserved",
      email: "jordan.preserved@example.test",
      password: VALID_PASSWORD,
    };
    await fillValidForm(testPage.page, values);
    await testPage.page.getByTestId("button-submit-signup").click();

    await assertSignupErrorMessage(testPage.page, backendMessage);
    await assertFormValues(testPage.page, values);
    await testPage.page.getByTestId("input-first-name").focus();
    await testPage.page.getByTestId("signup-error").waitFor({ state: "visible" });
    assert.equal(testPage.postCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("desktop signup displays a network failure inline and keeps entered values", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => route.abort("failed"),
  });
  try {
    const values = {
      firstName: "Morgan",
      lastName: "Network",
      email: "morgan.network@example.test",
      password: VALID_PASSWORD,
    };
    await fillValidForm(testPage.page, values);
    await testPage.page.getByTestId("button-submit-signup").click();

    await assertSignupErrorMessage(testPage.page, NETWORK_ERROR);
    await assertFormValues(testPage.page, values);
    assert.equal(testPage.postCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("desktop signup shows the duplicate-account message for a 409 and preserves fields", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(route, { message: "Conflict" }, 409),
  });
  try {
    const values = {
      firstName: "Casey",
      lastName: "Duplicate",
      email: "already.registered@example.test",
      password: VALID_PASSWORD,
    };
    await fillValidForm(testPage.page, values);
    await testPage.page.getByTestId("button-submit-signup").click();

    await assertSignupErrorMessage(testPage.page, DUPLICATE_ERROR);
    await assertFormValues(testPage.page, values);
    assert.equal(testPage.postCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("desktop 429 Retry-After disables repeat signup until its two-second cooldown expires", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(
      route,
      { message: "Too many signup attempts. Please try again later." },
      429,
      { "Retry-After": "2" },
    ),
  });
  try {
    await fillValidForm(testPage.page);
    const submit = testPage.page.getByTestId("button-submit-signup");
    await submit.click();
    await testPage.page.getByTestId("signup-error").waitFor({ state: "visible" });
    await testPage.page.waitForFunction(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="button-submit-signup"]');
      return button?.disabled === true;
    });
    assert.equal(testPage.postCount(), 1, "the active retry cooldown must prevent another POST");

    await testPage.page.waitForFunction(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="button-submit-signup"]');
      return button?.disabled === false;
    }, undefined, { timeout: 6_000 });
    assert.equal(testPage.postCount(), 1, "the button should re-enable without an automatic retry");
  } finally {
    await testPage.context.close();
  }
});

test("desktop 429 honors a 3,000-second Retry-After through the full window", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(
      route,
      { message: "Too many signup attempts. Please try again later." },
      429,
      { "Retry-After": "3000" },
    ),
  });
  try {
    await testPage.page.clock.install({ time: new Date("2030-01-01T00:00:00.000Z") });
    await fillValidForm(testPage.page);
    await testPage.page.getByTestId("button-submit-signup").click();
    await testPage.page.getByTestId("signup-error").waitFor({ state: "visible" });
    const submit = testPage.page.getByTestId("button-submit-signup");
    assert.equal(await submit.isDisabled(), true);
    assert.equal(testPage.postCount(), 1);

    await testPage.page.clock.fastForward(15 * 60 * 1000);
    assert.equal(await submit.isDisabled(), true, "a delay longer than 15 minutes must not be capped");
    await testPage.page.clock.fastForward((3_000 - 900 - 1) * 1000);
    assert.equal(await submit.isDisabled(), true, "the CTA must remain disabled until the complete Retry-After window");
    assert.equal(testPage.postCount(), 1);

    await testPage.page.clock.fastForward(1_000);
    assert.equal(await submit.isDisabled(), false, "the CTA should re-enable only after all 3,000 seconds");
    assert.equal(testPage.postCount(), 1, "cooldown expiry must not automatically retry signup");
  } finally {
    await testPage.context.close();
  }
});

test("desktop 429 uses the response-body retryAfter fallback when the header is absent", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(
      route,
      { message: "Too many signup attempts. Please wait.", retryAfter: 5 },
      429,
    ),
  });
  try {
    await testPage.page.clock.install({ time: new Date("2030-01-01T00:00:00.000Z") });
    await fillValidForm(testPage.page);
    await testPage.page.getByTestId("button-submit-signup").click();
    await testPage.page.getByTestId("signup-error").waitFor({ state: "visible" });
    const submit = testPage.page.getByTestId("button-submit-signup");
    assert.equal(await submit.isDisabled(), true);
    await testPage.page.clock.fastForward(4_000);
    assert.equal(await submit.isDisabled(), true);
    await testPage.page.clock.fastForward(1_000);
    assert.equal(await submit.isDisabled(), false, "the body retryAfter value should be used as seconds");
    assert.equal(testPage.postCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("desktop rapid double-submit sends only one signup POST while the request is pending", async () => {
  let releaseSignup!: () => void;
  const held = new Promise<void>((resolve) => { releaseSignup = resolve; });
  const testPage = await newSignupPage({
    signupHandler: async (route) => {
      await held;
      await fulfillJson(route, { message: "Signup temporarily unavailable." }, 400);
    },
  });
  try {
    await fillValidForm(testPage.page);
    const routeBeforeSubmit = testPage.page.url();
    const signupRequest = testPage.page.waitForRequest((request) =>
      request.method() === "POST" && new URL(request.url()).pathname === "/api/signup");
    await testPage.page.getByTestId("button-submit-signup").click();
    await signupRequest;

    const headerBack = testPage.page.getByTestId("button-back");
    assert.equal(await headerBack.isDisabled(), true, "header back must be disabled during submission");
    await headerBack.dispatchEvent("click");
    assert.equal(testPage.page.url(), routeBeforeSubmit, "back must not change routes while signup is pending");
    await testPage.page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("#signup-form");
      if (!form) throw new Error("Signup form was not rendered");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    // Let both synchronously dispatched submit events finish before releasing the held response.
    await testPage.page.waitForTimeout(150);
    assert.equal(testPage.postCount(), 1, "the submission guard must reject a concurrent submit");
    releaseSignup();
    await testPage.page.getByTestId("signup-error").waitFor({ state: "visible" });
  } finally {
    releaseSignup();
    await testPage.context.close();
  }
});

test("desktop successful signup stores the returned auth session and navigates to /get-hired", async () => {
  await successfulTalentSignup(false);
});

test("mobile successful signup via touch stores the returned auth session and navigates to /get-hired", async () => {
  await successfulTalentSignup(true);
});

test("talent candidate-session storage failure keeps manual sign-in and blocks duplicate signup", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(route, {
      success: true,
      token: "signup-storage-error-jwt",
      user: {
        id: "signup-storage-error-user",
        email: "storage.error@example.test",
        first_name: "Storage",
        last_name: "Error",
        role: "talent",
      },
      talentToken: "signup-storage-error-candidate-jwt",
      candidateId: "signup-storage-error-candidate",
    }, 201),
  });
  try {
    await testPage.page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "talent_profile_token") throw new Error("Candidate session storage is unavailable.");
        return originalSetItem.call(this, key, value);
      };
    });
    await fillValidForm(testPage.page, {
      firstName: "Storage",
      lastName: "Error",
      email: "storage.error@example.test",
    });
    await testPage.page.getByTestId("button-submit-signup").click();

    await assertSignupErrorMessage(
      testPage.page,
      "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.",
    );
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "signup-storage-error-jwt");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("talent_profile_token")), null);
    await testPage.page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("#signup-form");
      if (!form) throw new Error("Signup form was not rendered");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(testPage.postCount(), 1, "storage failure after 201 must not repeat signup");
  } finally {
    await testPage.context.close();
  }
});

test("HTTP 201 empty or invalid JSON body is treated as created and cannot be resubmitted", async () => {
  for (const body of ["", "{"]) {
    const testPage = await newSignupPage({
      signupHandler: (route) => route.fulfill({
        status: 201,
        contentType: "application/json",
        body,
      }),
    });
    try {
      await fillValidForm(testPage.page, {
        firstName: "Created",
        lastName: "WithoutBody",
        email: "created.without.body@example.test",
      });
      await testPage.page.getByTestId("button-submit-signup").click();
      const error = testPage.page.getByTestId("signup-error");
      await error.waitFor({ state: "visible" });
      assert.equal((await error.locator("p").first().innerText()).trim(), "Account created");
      await assertSignupErrorMessage(
        testPage.page,
        "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.",
      );
      assert.equal(await testPage.page.getByTestId("button-submit-signup").isDisabled(), true);
      await testPage.page.evaluate(() => {
        const form = document.querySelector<HTMLFormElement>("#signup-form");
        if (!form) throw new Error("Signup form was not rendered");
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      assert.equal(testPage.postCount(), 1, "an HTTP 201 response must latch account-created even without valid JSON");
    } finally {
      await testPage.context.close();
    }
  }
});

test("desktop signup submits silent-autofill DOM values instead of stale React state", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(route, { message: "Test response." }, 400),
  });
  try {
    await testPage.page.getByTestId("checkbox-terms").click();
    const domValues = {
      firstName: "Autofilled",
      lastName: "FromDOM",
      email: "autofill.dom@example.test",
      password: "SilentAutoFill123!",
      confirmPassword: "SilentAutoFill123!",
    };
    await testPage.page.evaluate((values) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("Native input value setter unavailable");
      for (const [name, value] of Object.entries(values)) {
        const input = document.querySelector<HTMLInputElement>(`[name="${name}"]`);
        if (!input) throw new Error(`Signup input ${name} was not rendered`);
        setter.call(input, value);
      }
    }, domValues);

    await testPage.page.getByTestId("button-submit-signup").click();
    await testPage.page.getByTestId("signup-error").waitFor({ state: "visible" });
    assert.deepEqual(testPage.payloads()[0], {
      email: domValues.email,
      username: "autofill.dom",
      password: domValues.password,
      first_name: domValues.firstName,
      last_name: domValues.lastName,
      role: "talent",
    });
    assert.equal(testPage.postCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("desktop signup rejects an invalid email before sending a request", async () => {
  const testPage = await newSignupPage();
  try {
    await fillValidForm(testPage.page, { email: "not-an-email" });
    await testPage.page.getByTestId("button-submit-signup").click();

    await assertSignupErrorMessage(
      testPage.page,
      "Please enter a valid email address, such as name@example.com.",
    );
    assert.equal(testPage.postCount(), 0, "invalid email must be rejected before any signup POST");
  } finally {
    await testPage.context.close();
  }
});

test("desktop signup success without an auth token offers manual sign-in and cannot create twice", async () => {
  const testPage = await newSignupPage({
    signupHandler: (route) => fulfillJson(route, { success: true }, 201),
  });
  try {
    await fillValidForm(testPage.page, {
      firstName: "Created",
      lastName: "WithoutToken",
      email: "created.without.token@example.test",
    });
    await testPage.page.getByTestId("button-submit-signup").click();

    const error = testPage.page.getByTestId("signup-error");
    await error.waitFor({ state: "visible" });
    assert.equal((await error.locator("p").first().innerText()).trim(), "Account created");
    await assertSignupErrorMessage(
      testPage.page,
      "Automatic sign-in could not be completed. Use the sign-in link below to access your new account.",
    );
    const submit = testPage.page.getByTestId("button-submit-signup");
    await testPage.page.waitForFunction(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="button-submit-signup"]');
      return button?.disabled === true;
    });
    assert.equal(await submit.innerText(), "Account created — sign in below");
    assert.equal(await testPage.page.getByTestId("button-back").isDisabled(), true,
      "the header back action stays disabled after account creation");
    assert.equal(await testPage.page.getByRole("button", { name: /Back to options/ }).isDisabled(), true,
      "the footer back action stays disabled after account creation");

    await testPage.page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("#signup-form");
      if (!form) throw new Error("Signup form was not rendered");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(testPage.postCount(), 1, "a created account without a token must not be submitted a second time");
  } finally {
    await testPage.context.close();
  }
});

test("application signup uses the complete shared password policy before posting", async () => {
  const returnTo = "/find-work/jobs/role-123/apply?jobId=role-123";
  const testPage = await newApplicationSignupPage({
    query: `?returnTo=${encodeURIComponent(returnTo)}`,
  });
  try {
    await testPage.page.getByTestId("application-signup-first-name").fill("Riley");
    await testPage.page.getByTestId("application-signup-last-name").fill("Applicant");
    await testPage.page.getByTestId("application-signup-email").fill("riley.applicant@example.test");
    await fillApplicationPassword(testPage.page, "ValidPass123");
    await testPage.page.getByTestId("application-signup-submit").click();

    await testPage.page.getByText("Password must contain at least one special character", { exact: true }).waitFor({ state: "visible" });
    assert.equal(testPage.signupPostCount(), 0, "passwords missing a required special character must not be posted");
    assert.equal(testPage.linkPostCount(), 0);
  } finally {
    await testPage.context.close();
  }
});

test("application signup observes the full 429 cooldown without auto-retrying", async () => {
  const returnTo = "/find-work/jobs/role-123/apply?jobId=role-123";
  const testPage = await newApplicationSignupPage({
    query: `?returnTo=${encodeURIComponent(returnTo)}`,
    signupHandler: (route) => fulfillJson(
      route,
      { message: "Please wait before trying again." },
      429,
      { "Retry-After": "3000" },
    ),
  });
  try {
    await testPage.page.clock.install({ time: new Date("2030-01-01T00:00:00.000Z") });
    await testPage.page.getByTestId("application-signup-first-name").fill("Riley");
    await testPage.page.getByTestId("application-signup-last-name").fill("Applicant");
    await testPage.page.getByTestId("application-signup-email").fill("riley.applicant@example.test");
    await fillApplicationPassword(testPage.page);
    const submit = testPage.page.getByTestId("application-signup-submit");
    await submit.click();
    await testPage.page.getByTestId("application-signup-error").waitFor({ state: "visible" });
    assert.equal(await submit.isDisabled(), true);
    assert.equal(testPage.signupPostCount(), 1);

    await testPage.page.clock.fastForward(15 * 60 * 1000);
    assert.equal(await submit.isDisabled(), true, "long Retry-After windows must not be capped");
    await testPage.page.clock.fastForward((3_000 - 900 - 1) * 1000);
    assert.equal(await submit.isDisabled(), true, "signup remains disabled for the complete server cooldown");
    await testPage.page.clock.fastForward(1_000);
    assert.equal(await submit.isDisabled(), false);
    assert.equal(testPage.signupPostCount(), 1, "cooldown expiry must not automatically retry signup");
  } finally {
    await testPage.context.close();
  }
});

test("account-first application signup submits autofilled DOM values as a talent and returns to the job", async () => {
  const returnTo = "/find-work/jobs/role-123/apply?jobId=role-123";
  const user = {
    id: "application-signup-user",
    email: "riley.autofill@example.test",
    first_name: "Riley",
    last_name: "Autofill",
    role: "talent",
  };
  const testPage = await newApplicationSignupPage({
    query: `?returnTo=${encodeURIComponent(returnTo)}`,
    signupHandler: (route) => fulfillJson(route, {
      success: true,
      token: "application-signup-user-jwt",
      user,
      talentToken: "application-signup-candidate-jwt",
      candidateId: "application-signup-candidate",
    }, 201),
  });
  try {
    const values = {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    };
    await testPage.page.evaluate((domValues) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("Native input value setter unavailable");
      for (const [name, value] of Object.entries(domValues)) {
        const input = document.querySelector<HTMLInputElement>(`[name="${name}"]`);
        if (!input) throw new Error(`Application signup input ${name} was not rendered`);
        setter.call(input, value);
      }
    }, values);
    await testPage.page.getByTestId("application-signup-submit").click();
    await testPage.page.waitForURL((url) =>
      url.pathname === "/find-work/jobs/role-123/apply" && url.searchParams.get("jobId") === "role-123");

    assert.deepEqual(testPage.signupPayloads()[0], {
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email,
      password: VALID_PASSWORD,
      role: "talent",
    });
    assert.equal(testPage.signupPostCount(), 1);
    assert.equal(testPage.linkPostCount(), 0);
    assert.deepEqual(
      await testPage.page.evaluate(() => JSON.parse(localStorage.getItem("talent_profile_token") || "null")),
      {
        token: "application-signup-candidate-jwt",
        candidateId: "application-signup-candidate",
        email: "riley.autofill@example.test",
        fullName: "Riley Autofill",
      },
    );
  } finally {
    await testPage.context.close();
  }
});

test("application link failure offers link-only recovery without repeating confirmed signup", async () => {
  let linkAttempt = 0;
  const testPage = await newApplicationSignupPage({
    query: "?applicationToken=continuation-token-45",
    signupHandler: (route) => fulfillJson(route, {
      success: true,
      token: "application-signup-user-jwt",
      user: {
        id: "application-signup-user",
        email: "avery.applicant@example.test",
        first_name: "Avery",
        last_name: "Applicant",
        role: "talent",
      },
      talentToken: "application-signup-candidate-jwt",
      candidateId: "application-signup-candidate",
    }, 201),
    linkHandler: (route) => {
      linkAttempt += 1;
      return linkAttempt === 1
        ? fulfillJson(route, { error: "Application link is temporarily unavailable." }, 503)
        : fulfillJson(route, { success: true });
    },
  });
  try {
    await testPage.page.getByTestId("application-signup-last-name").fill("Applicant");
    await fillApplicationPassword(testPage.page);
    await testPage.page.getByTestId("application-signup-submit").click();

    const inlineError = testPage.page.getByTestId("application-signup-error");
    await inlineError.waitFor({ state: "visible" });
    assert.match(await inlineError.innerText(), /account was created/i);
    assert.match(await inlineError.innerText(), /retry linking/i);
    assert.equal(await testPage.page.getByTestId("application-signup-first-name").inputValue(), "Avery");
    assert.equal(await testPage.page.getByTestId("application-signup-email").inputValue(), "avery.applicant@example.test");
    assert.equal(testPage.signupPostCount(), 1);
    assert.equal(testPage.linkPostCount(), 1);
    assert.deepEqual(testPage.linkPayloads()[0], {
      submissionId: "application-submission-45",
      token: "continuation-token-45",
    });

    await testPage.page.getByTestId("application-signup-retry-link").click();
    await testPage.page.waitForURL((url) => url.pathname === "/find-best-matches");
    assert.equal(testPage.signupPostCount(), 1, "link recovery must never create the account again");
    assert.equal(testPage.linkPostCount(), 2, "recovery retries only the existing application link");
    assert.deepEqual(testPage.linkPayloads()[1], testPage.linkPayloads()[0]);
  } finally {
    await testPage.context.close();
  }
});

test("application link failure sign-in navigation preserves talent portal, application token, and return destination", async () => {
  const applicationToken = "continuation-signin-token";
  const returnTo = "/find-work/jobs/role-789/apply?jobId=role-789";
  const testPage = await newApplicationSignupPage({
    query: `?applicationToken=${encodeURIComponent(applicationToken)}&returnTo=${encodeURIComponent(returnTo)}`,
    signupHandler: (route) => fulfillJson(route, {
      success: true,
      token: "application-signin-user-jwt",
      user: {
        id: "application-signin-user",
        email: "avery.applicant@example.test",
        first_name: "Avery",
        last_name: "Applicant",
        role: "talent",
      },
      talentToken: "application-signin-candidate-jwt",
      candidateId: "application-signin-candidate",
    }, 201),
    linkHandler: (route) => fulfillJson(route, { error: "Application link is temporarily unavailable." }, 503),
  });
  try {
    await testPage.page.getByTestId("application-signup-last-name").fill("Applicant");
    await fillApplicationPassword(testPage.page);
    await testPage.page.getByTestId("application-signup-submit").click();
    await testPage.page.getByTestId("application-signup-error").waitFor({ state: "visible" });
    await testPage.page.getByTestId("application-signup-signin").click();
    await testPage.page.waitForURL((url) => url.pathname === "/portal-login");

    const loginUrl = new URL(testPage.page.url());
    assert.equal(loginUrl.searchParams.get("portal"), "talent");
    assert.equal(loginUrl.searchParams.get("applicationToken"), applicationToken);
    assert.equal(loginUrl.searchParams.get("returnTo"), returnTo);
    assert.equal(testPage.signupPostCount(), 1);
    assert.equal(testPage.linkPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("partial candidate-session storage failure routes sign-in with application recovery context", async () => {
  const applicationToken = "continuation-storage-token";
  const returnTo = "/find-work/jobs/role-456/apply?jobId=role-456";
  const testPage = await newApplicationSignupPage({
    query: `?applicationToken=${encodeURIComponent(applicationToken)}&returnTo=${encodeURIComponent(returnTo)}`,
    signupHandler: (route) => fulfillJson(route, {
      success: true,
      token: "application-storage-user-jwt",
      user: {
        id: "application-storage-user",
        email: "avery.applicant@example.test",
        first_name: "Avery",
        last_name: "Applicant",
        role: "talent",
      },
      talentToken: "application-storage-candidate-jwt",
      candidateId: "application-storage-candidate",
    }, 201),
  });
  try {
    await testPage.page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "talent_profile_token") throw new Error("Candidate session storage is unavailable.");
        return originalSetItem.call(this, key, value);
      };
    });
    await testPage.page.getByTestId("application-signup-last-name").fill("Applicant");
    await fillApplicationPassword(testPage.page);
    await testPage.page.getByTestId("application-signup-submit").click();
    await testPage.page.getByTestId("application-signup-error").waitFor({ state: "visible" });
    await testPage.page.getByTestId("application-signup-signin").click();
    await testPage.page.waitForURL((url) => url.pathname === "/portal-login");

    const loginUrl = new URL(testPage.page.url());
    assert.equal(loginUrl.searchParams.get("portal"), "talent");
    assert.equal(loginUrl.searchParams.get("applicationToken"), applicationToken);
    assert.equal(loginUrl.searchParams.get("returnTo"), returnTo);
    assert.equal(testPage.signupPostCount(), 1);
    assert.equal(testPage.linkPostCount(), 0, "linking must not proceed after candidate-session persistence failed");
  } finally {
    await testPage.context.close();
  }
});