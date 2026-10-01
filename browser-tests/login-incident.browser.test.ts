import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5174);
const BASE_URL = `http://127.0.0.1:${PORT}`;

let browser: Browser;
let vite: ChildProcess | undefined;
let viteCacheDir: string | undefined;

type LoginHandler = (route: Route) => Promise<void>;

interface LoginTestPage {
  context: BrowserContext;
  page: Page;
  loginPostCount: () => number;
  payloads: () => Record<string, unknown>[];
  talentIdentityGetCount: () => number;
  profilesMeGetCount: () => number;
  skillWrites: () => { path: string; payload: Record<string, unknown> }[];
}

interface TalentIdentityFixture {
  candidateId: string;
  email: string;
  fullName?: string;
  userId?: string;
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
) {
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

async function newLoginPage(options: {
  mobile?: boolean;
  path?: string;
  readyTestId?: string;
  postAuthTalentIdentity?: TalentIdentityFixture;
  talentIdentityStatus?: number;
  talentSearchResults?: unknown[];
  availableSkills?: { id: string; name: string }[];
  loginHandler?: LoginHandler;
} = {}): Promise<LoginTestPage> {
  const context = await browser.newContext({
    viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    ...(options.mobile ? { isMobile: true, hasTouch: true } : {}),
    serviceWorkers: "block",
  });
  await context.addInitScript("window.__name = (fn) => fn;");
  const page = await context.newPage();
  let loginPosts = 0;
  let talentIdentityGets = 0;
  let profilesMeGets = 0;
  const payloads: Record<string, unknown>[] = [];
  const skillWrites: { path: string; payload: Record<string, unknown> }[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      if (request.method() === "POST" && (
        url.pathname === "/api/login" || url.pathname === "/api/talent-auth/login"
      )) {
        loginPosts += 1;
        try {
          payloads.push(request.postDataJSON() as Record<string, unknown>);
        } catch {
          payloads.push({});
        }
        if (options.loginHandler) return options.loginHandler(route);
        return fulfillJson(route, { message: "Unexpected login request in this test" }, 500);
      }
      if (request.method() === "GET" && url.pathname === "/api/talent-auth/me") {
        talentIdentityGets += 1;
        if (options.talentIdentityStatus) {
          return fulfillJson(route, { error: "Candidate identity unavailable" }, options.talentIdentityStatus);
        }
        return fulfillJson(route, options.postAuthTalentIdentity ?? {});
      }
      if (request.method() === "GET" && url.pathname === "/api/profiles/me") {
        profilesMeGets += 1;
        return fulfillJson(route, { error: "Legacy candidate profile lookup is unavailable" }, 500);
      }
      if (request.method() === "GET" && url.pathname === "/api/skills") {
        return fulfillJson(route, options.availableSkills ?? []);
      }
      if (request.method() === "POST" && /^\/api\/users\/[^/]+\/skills$/.test(url.pathname)) {
        let payload: Record<string, unknown> = {};
        try {
          payload = request.postDataJSON() as Record<string, unknown>;
        } catch {
          // Keep the captured request explicit even if its JSON body is malformed.
        }
        skillWrites.push({ path: url.pathname, payload });
        return fulfillJson(route, { id: "browser-test-user-skill" }, 201);
      }
      if (request.method() === "POST" && url.pathname === "/api/talent-search") {
        return fulfillJson(route, { results: options.talentSearchResults ?? [] });
      }
      if (request.method() === "GET" && url.pathname === "/api/jobs/search") {
        return fulfillJson(route, {
          items: [],
          meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
        });
      }
      if (url.pathname.endsWith("/hired-popup/claim")) {
        return fulfillJson(route, null);
      }
      return fulfillJson(route, []);
    }
    if (url.origin !== new URL(BASE_URL).origin) return route.abort();
    return route.continue();
  });

  await page.goto(`${BASE_URL}${options.path ?? "/login/talent"}`, { waitUntil: "domcontentloaded" });
  if (options.readyTestId) {
    await page.getByTestId(options.readyTestId).waitFor({ state: "visible" });
  } else {
    const pathname = new URL(options.path ?? "/login/talent", BASE_URL).pathname;
    if (pathname === "/talent-pool") {
      await page.getByRole("heading", { name: "Find talent that fits — and delivers results." })
        .waitFor({ state: "visible" });
    } else if (pathname === "/") {
      await page.getByTestId("nav-login-button").waitFor({ state: "visible" });
    } else if (pathname === "/hire-talent") {
      await page.getByPlaceholder("Tell us what you need").waitFor({ state: "visible" });
    } else if (pathname.startsWith("/login/")) {
      await page.getByTestId("button-submit-portal-login").waitFor({ state: "visible" });
    } else {
      await context.close();
      throw new Error(`No route-specific readiness selector configured for ${pathname}`);
    }
  }
  page.setDefaultTimeout(8_000);
  return {
    context,
    page,
    loginPostCount: () => loginPosts,
    payloads: () => payloads,
    talentIdentityGetCount: () => talentIdentityGets,
    profilesMeGetCount: () => profilesMeGets,
    skillWrites: () => skillWrites,
  };
}

before(async () => {
  const baseUrl = new URL(BASE_URL);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
    "Login browser tests must use a loopback frontend only");

  const viteEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
  delete viteEnv.REPL_ID;
  viteCacheDir = mkdtempSync(join(tmpdir(), "login-browser-vite-cache-"));
  viteEnv.AUTH_BROWSER_CACHE_DIR = viteCacheDir;
  vite = spawn(process.execPath, [
    "node_modules/vite/bin/vite.js",
    "--host", "127.0.0.1",
    "--port", String(PORT),
    "--strictPort",
  ], { stdio: "pipe", env: viteEnv });
  await waitForUrl(BASE_URL);

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
    viteCacheDir = undefined;
  }
});

test("portal login submits silent-autofill DOM credentials despite stale React state", async () => {
  const testPage = await newLoginPage({
    loginHandler: (route) => fulfillJson(route, { message: "Test invalid credentials." }, 401),
  });
  try {
    const values = {
      email: "autofill.dom@example.test",
      password: " A password with spaces ",
    };
    await testPage.page.evaluate((domValues) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("Native input value setter unavailable");
      for (const [name, value] of Object.entries(domValues)) {
        const input = document.querySelector<HTMLInputElement>(`#login-${name}`);
        if (!input) throw new Error(`Portal login input ${name} was not rendered`);
        setter.call(input, value);
      }
    }, values);

    const submit = testPage.page.getByTestId("button-submit-portal-login");
    assert.equal(await submit.isDisabled(), false,
      "eligibility must reflect the actual required DOM controls rather than stale React state");
    await submit.click();
    await testPage.page.getByTestId("portal-login-error").waitFor({ state: "visible" });

    assert.deepEqual(testPage.payloads()[0], values,
      "the login request must use actual DOM values and must not trim or strength-check a password");
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

async function invalidCredentials(mobile: boolean): Promise<void> {
  const backendMessage = "Incorrect email or password.";
  const testPage = await newLoginPage({
    mobile,
    loginHandler: (route) => fulfillJson(route, { message: backendMessage }, 401),
  });
  try {
    await testPage.page.evaluate(() => {
      localStorage.setItem("onspot_jwt_token", "existing-client-token");
      localStorage.setItem("onspot_user", JSON.stringify({
        id: "existing-client-user",
        email: "existing.client@example.test",
        role: "client",
      }));
    });
    const values = { email: "person@example.test", password: "wrong pass" };
    await testPage.page.getByTestId("input-portal-login-email").fill(values.email);
    await testPage.page.getByTestId("input-portal-login-password").fill(values.password);
    const submit = testPage.page.getByTestId("button-submit-portal-login");
    if (mobile) await submit.tap();
    else await submit.click();

    const alert = testPage.page.getByTestId("portal-login-error");
    await alert.waitFor({ state: "visible" });
    assert.match(await alert.innerText(), /Incorrect email or password/);
    assert.equal(await testPage.page.getByTestId("input-portal-login-email").inputValue(), values.email);
    assert.equal(await testPage.page.getByTestId("input-portal-login-password").inputValue(), values.password);
    assert.equal(testPage.loginPostCount(), 1);
    assert.equal(new URL(testPage.page.url()).pathname, "/login/talent");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "existing-client-token",
      "failed talent credentials must not clear a pre-existing main session");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_user")),
      JSON.stringify({ id: "existing-client-user", email: "existing.client@example.test", role: "client" }));
  } finally {
    await testPage.context.close();
  }
}

test("desktop talent portal keeps a 401 visible and preserves credentials", async () => {
  await invalidCredentials(false);
});

test("mobile talent portal keeps a 401 visible and preserves credentials", async () => {
  await invalidCredentials(true);
});

test("portal login reports a network failure inline without clearing inputs", async () => {
  const testPage = await newLoginPage({
    loginHandler: (route) => route.abort("failed"),
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill("network@example.test");
    await testPage.page.getByTestId("input-portal-login-password").fill("still here");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    await testPage.page.getByTestId("portal-login-error").waitFor({ state: "visible" });
    assert.match(await testPage.page.getByTestId("portal-login-error").innerText(), /Could not reach the server/);
    assert.equal(await testPage.page.getByTestId("input-portal-login-email").inputValue(), "network@example.test");
    assert.equal(await testPage.page.getByTestId("input-portal-login-password").inputValue(), "still here");
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("invalid email is displayed inline and rejected before a login request", async () => {
  const testPage = await newLoginPage();
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill("not-an-email");
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    await testPage.page.getByTestId("portal-login-error").waitFor({ state: "visible" });
    assert.match(await testPage.page.getByTestId("portal-login-error").innerText(), /valid email/);
    assert.equal(testPage.loginPostCount(), 0);
  } finally {
    await testPage.context.close();
  }
});

test("portal login 429 honors full Retry-After, body metadata and blocks repeat submits", async () => {
  const testPage = await newLoginPage({
    loginHandler: (route) => fulfillJson(
      route,
      { message: "Please wait before trying again.", retryAfter: 3 },
      429,
      { "Retry-After": "3000" },
    ),
  });
  try {
    await testPage.page.clock.install({ time: new Date("2030-01-01T00:00:00.000Z") });
    await testPage.page.getByTestId("input-portal-login-email").fill("limited@example.test");
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    const submit = testPage.page.getByTestId("button-submit-portal-login");
    await submit.click();
    await testPage.page.getByTestId("portal-login-error").waitFor({ state: "visible" });
    assert.equal(await submit.isDisabled(), true);
    await testPage.page.evaluate(() => {
      document.querySelector<HTMLFormElement>("#portal-login-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    assert.equal(testPage.loginPostCount(), 1, "a 429 cooldown must prevent repeated submits");

    await testPage.page.clock.fastForward(15 * 60 * 1000);
    assert.equal(await submit.isDisabled(), true, "a cooldown longer than 15 minutes must not be capped");
    await testPage.page.clock.fastForward((3_000 - 900) * 1000);
    assert.equal(await submit.isDisabled(), false, "the CTA should re-enable after the complete Retry-After");
    assert.equal(testPage.loginPostCount(), 1, "cooldown expiry must not retry automatically");
  } finally {
    await testPage.context.close();
  }
});

test("portal login uses body retryAfter metadata when Retry-After is absent", async () => {
  const testPage = await newLoginPage({
    loginHandler: (route) => fulfillJson(
      route,
      { message: "Please wait.", retryAfter: 5 },
      429,
    ),
  });
  try {
    await testPage.page.clock.install({ time: new Date("2030-01-01T00:00:00.000Z") });
    await testPage.page.getByTestId("input-portal-login-email").fill("limited@example.test");
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    const submit = testPage.page.getByTestId("button-submit-portal-login");
    await submit.click();
    await testPage.page.getByTestId("portal-login-error").waitFor({ state: "visible" });
    await testPage.page.clock.fastForward(4_000);
    assert.equal(await submit.isDisabled(), true);
    await testPage.page.clock.fastForward(1_000);
    assert.equal(await submit.isDisabled(), false);
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("rapid portal double-submit sends one POST and portal switching stays blocked while pending", async () => {
  let releaseLogin!: () => void;
  const held = new Promise<void>((resolve) => { releaseLogin = resolve; });
  const testPage = await newLoginPage({
    loginHandler: async (route) => {
      await held;
      await fulfillJson(route, { message: "Incorrect email or password." }, 401);
    },
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill("pending@example.test");
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    const request = testPage.page.waitForRequest((item) =>
      item.method() === "POST" && new URL(item.url()).pathname === "/api/talent-auth/login");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    await request;
    const routeBeforeSubmit = testPage.page.url();
    const switchPortal = testPage.page.getByRole("button", { name: /Choose another portal/ });
    assert.equal(await switchPortal.isDisabled(), true);
    await switchPortal.dispatchEvent("click");
    assert.equal(testPage.page.url(), routeBeforeSubmit);
    await testPage.page.evaluate(() => {
      document.querySelector<HTMLFormElement>("#portal-login-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await testPage.page.waitForTimeout(100);
    assert.equal(testPage.loginPostCount(), 1);
    releaseLogin();
    await testPage.page.getByTestId("portal-login-error").waitFor({ state: "visible" });
  } finally {
    releaseLogin();
    await testPage.context.close();
  }
});

function talentTokenFor(candidateId: string, email: string): string {
  const claims = Buffer.from(JSON.stringify({
    type: "candidate",
    candidateId,
    email,
    exp: 4_102_444_800,
  })).toString("base64url");
  return `eyJhbGciOiJub25lIn0.${claims}.signature`;
}

test("talent portal success saves its session and honors returnTo across reload", async () => {
  const candidate = {
    id: "browser-test-candidate",
    email: "talént@example.test",
    fullName: "Browser Test Talent",
  };
  const token = talentTokenFor(candidate.id, candidate.email);
  const testPage = await newLoginPage({
    path: "/login/talent?returnTo=%2Ffind-work%2Fjobs",
    postAuthTalentIdentity: {
      candidateId: candidate.id,
      email: candidate.email,
      fullName: candidate.fullName,
    },
    loginHandler: (route) => fulfillJson(route, { token, candidate }),
  });
  try {
    const pageErrors: string[] = [];
    testPage.page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
    await testPage.page.evaluate(() => {
      localStorage.setItem("onspot_jwt_token", "stale-client-token");
      localStorage.setItem("onspot_user", JSON.stringify({
        id: "stale-client-user",
        email: "old.client@example.test",
        role: "client",
      }));
    });
    await testPage.page.getByTestId("input-portal-login-email").fill(candidate.email);
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    const destination = testPage.page.waitForURL((url) => url.pathname === "/find-work/jobs");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    await destination;
    assert.equal(testPage.loginPostCount(), 1);
    assert.equal(testPage.talentIdentityGetCount(), 1);
    assert.equal(testPage.profilesMeGetCount(), 0,
      "legacy candidate login must not depend on the profile endpoint that can fail for candidates without users rows");
    assert.deepEqual(await testPage.page.evaluate(() =>
      JSON.parse(localStorage.getItem("talent_profile_token") || "null")), {
      token,
      candidateId: candidate.id,
      email: candidate.email,
      fullName: candidate.fullName,
    });
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null,
      "a stale client/admin token must be cleared after confirmed talent login");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_user")), null);
    const talentAccount = testPage.page.locator(
      '[data-testid="account-dropdown-trigger"], [data-testid="talent-account-dropdown-trigger"]',
    );
    await testPage.page.waitForTimeout(500);
    const pageState = await testPage.page.evaluate(() => ({
      pathname: location.pathname,
      navControls: Array.from(document.querySelectorAll("[data-testid]"))
        .map((element) => element.getAttribute("data-testid"))
        .filter((testId) => testId?.includes("account-dropdown") || testId?.includes("login-button")),
      bodyText: document.body.innerText.slice(0, 1200),
      rootHtml: document.getElementById("root")?.innerHTML.slice(0, 1200),
      talentAuthStored: localStorage.getItem("talent_profile_token") !== null,
      mainAuthStored: localStorage.getItem("onspot_jwt_token") !== null,
    }));
    assert.ok(await talentAccount.isVisible(), JSON.stringify({ ...pageState, pageErrors }));
    const visibleDialogs = await testPage.page.locator('[role="dialog"]:visible').allInnerTexts();
    const openDialogState = await testPage.page.evaluate(() => Array.from(
        document.querySelectorAll('[data-state="open"][aria-hidden="true"]'),
      ).map((element) => ({
        className: element.className,
        parent: element.parentElement?.outerHTML.slice(0, 1000),
      })));
    assert.deepEqual(visibleDialogs, [], `Unexpected open dialogs after Talent login: ${JSON.stringify(openDialogState)}`);
    await talentAccount.click({ timeout: 8_000 });
    await testPage.page.getByRole("menu").getByText(candidate.email, { exact: true })
      .waitFor({ state: "visible" });
    await testPage.page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(new URL(testPage.page.url()).pathname, "/find-work/jobs");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("talent_profile_token") !== null), true);
  } finally {
    await testPage.context.close();
  }
});

test("talent login is not reported successful until candidate identity resolves", async () => {
  const candidate = {
    id: "unresolved-candidate",
    email: "unresolved@example.test",
    fullName: "Unresolved Talent",
  };
  const token = talentTokenFor(candidate.id, candidate.email);
  const testPage = await newLoginPage({
    path: "/login/talent",
    loginHandler: (route) => fulfillJson(route, { token, candidate }),
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill(candidate.email);
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    const alert = testPage.page.getByTestId("portal-login-error");
    await alert.waitFor({ state: "visible" });
    assert.match(await alert.innerText(), /couldn't verify the signed-in Talent account/i);
    assert.equal(new URL(testPage.page.url()).pathname, "/login/talent");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("talent_profile_token")), null);
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("linked Talent identity response routes an own-account skills write to users.id", async () => {
  const candidate = {
    id: "skills-regression-candidate-id",
    email: "skills.regression@example.test",
    fullName: "Skills Regression Talent",
  };
  const linkedUserId = "skills-regression-linked-user-id";
  const token = talentTokenFor(candidate.id, candidate.email);
  const testPage = await newLoginPage({
    path: "/login/talent?returnTo=%2Fget-hired",
    postAuthTalentIdentity: {
      candidateId: candidate.id,
      userId: linkedUserId,
      email: candidate.email,
      fullName: candidate.fullName,
    },
    availableSkills: [{ id: "browser-test-skill-id", name: "Identity Regression Skill" }],
    loginHandler: (route) => fulfillJson(route, { token, candidate }),
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill(candidate.email);
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    await testPage.page.waitForURL((url) => url.pathname === "/get-hired");

    await testPage.page.getByTestId("input-first-name").waitFor({ state: "visible" });
    await testPage.page.getByTestId("input-first-name").fill("Skills");
    await testPage.page.getByTestId("input-last-name").fill("Regression");
    const skill = testPage.page.getByTestId("skill-identity-regression-skill");
    await skill.waitFor({ state: "visible" });
    const ownAccountSkillWrite = testPage.page.waitForRequest((request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/users/${linkedUserId}/skills`,
    );
    await skill.click();
    await testPage.page.getByTestId("button-save-profile").click();
    const request = await ownAccountSkillWrite;
    const writeResponse = await testPage.page.waitForResponse((response) =>
      response.request() === request,
    );
    assert.equal(writeResponse.status(), 201);

    assert.equal(testPage.talentIdentityGetCount(), 1);
    assert.equal(new URL(request.url()).pathname, `/api/users/${linkedUserId}/skills`);
    assert.deepEqual(request.postDataJSON(), {
      skillId: "browser-test-skill-id",
      level: "intermediate",
      yearsExperience: 1,
    });
    assert.deepEqual(testPage.skillWrites(), [{
      path: `/api/users/${linkedUserId}/skills`,
      payload: {
        skillId: "browser-test-skill-id",
        level: "intermediate",
        yearsExperience: 1,
      },
    }]);
  } finally {
    await testPage.context.close();
  }
});

test("candidate identity 401 and 500 fail login and preserve the prior main session", async () => {
  for (const status of [401, 500]) {
    const candidate = {
      id: `identity-error-candidate-${status}`,
      email: `identity-error-${status}@example.test`,
      fullName: "Identity Error Talent",
    };
    const token = talentTokenFor(candidate.id, candidate.email);
    const testPage = await newLoginPage({
      path: "/login/talent",
      talentIdentityStatus: status,
      loginHandler: (route) => fulfillJson(route, { token, candidate }),
    });
    try {
      await testPage.page.evaluate(() => {
        localStorage.setItem("onspot_jwt_token", "prior-client-token");
        localStorage.setItem("onspot_user", JSON.stringify({
          id: "prior-client-user",
          email: "prior.client@example.test",
          role: "client",
        }));
      });
      await testPage.page.getByTestId("input-portal-login-email").fill(candidate.email);
      await testPage.page.getByTestId("input-portal-login-password").fill("password");
      await testPage.page.getByTestId("button-submit-portal-login").click();
      await testPage.page.waitForURL((url) => url.pathname === "/hire-talent");
      assert.equal(new URL(testPage.page.url()).pathname, "/hire-talent",
        "the pre-existing Client session remains active instead of the failed Talent login");
      assert.equal(testPage.loginPostCount(), 1);
      assert.equal(testPage.talentIdentityGetCount(), 1);
      assert.equal(await testPage.page.evaluate(() => localStorage.getItem("talent_profile_token")), null);
      assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "prior-client-token");
      assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_user")),
        JSON.stringify({
          id: "prior-client-user",
          email: "prior.client@example.test",
          role: "client",
        }));
      assert.equal(testPage.profilesMeGetCount(), 0);
    } finally {
      await testPage.context.close();
    }
  }
});

test("client login success stores session and uses the admin redirect for admin roles", async () => {
  const user = {
    id: "browser-test-admin",
    email: "success.admin@example.test",
    first_name: "Browser",
    role: "admin",
  };
  const testPage = await newLoginPage({
    path: "/login/client",
    loginHandler: (route) => fulfillJson(route, { success: true, token: "admin-session-token", user }),
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill(user.email);
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    const destination = testPage.page.waitForURL((url) => url.pathname === "/admin/find-work");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    await destination;
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "admin-session-token");
    assert.deepEqual(await testPage.page.evaluate(() =>
      JSON.parse(localStorage.getItem("onspot_user") || "null")), user);
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("client portal login stores session and uses its normal success destination", async () => {
  const user = {
    id: "browser-test-client",
    email: "success.client@example.test",
    first_name: "Browser",
    role: "client",
  };
  const testPage = await newLoginPage({
    path: "/login/client",
    loginHandler: (route) => fulfillJson(route, { success: true, token: "client-session-token", user }),
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill(user.email);
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    const destination = testPage.page.waitForURL((url) => url.pathname === "/hire-talent");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    await destination;
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "client-session-token");
    assert.deepEqual(await testPage.page.evaluate(() =>
      JSON.parse(localStorage.getItem("onspot_user") || "null")), user);
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("talent portal clearly links to Client Login for a client account", async () => {
  const testPage = await newLoginPage({
    loginHandler: (route) => fulfillJson(route, { error: "client_account" }, 400),
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill("client@example.test");
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    const alert = testPage.page.getByTestId("portal-login-error");
    await alert.waitFor({ state: "visible" });
    assert.match(await alert.innerText(), /Client account/);
    assert.equal(await testPage.page.getByRole("link", { name: "Go to Client Login" }).getAttribute("href"), "/login/client");
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("client portal clearly links to Talent Login for a talent account", async () => {
  const testPage = await newLoginPage({
    path: "/login/client",
    loginHandler: (route) => fulfillJson(route, { error: "talent_account" }, 401),
  });
  try {
    await testPage.page.getByTestId("input-portal-login-email").fill("talent@example.test");
    await testPage.page.getByTestId("input-portal-login-password").fill("password");
    await testPage.page.getByTestId("button-submit-portal-login").click();
    const alert = testPage.page.getByTestId("portal-login-error");
    await alert.waitFor({ state: "visible" });
    assert.match(await alert.innerText(), /Talent account/);
    assert.equal(await testPage.page.getByRole("link", { name: "Go to Talent Login" }).getAttribute("href"), "/login/talent");
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("LoginDialog talent selection calls the talent endpoint and stores candidate auth", async () => {
  const candidate = {
    id: "dialog-candidate",
    email: "dialog.talent@example.test",
    fullName: "Dialog Talent",
  };
  const token = talentTokenFor(candidate.id, candidate.email);
  const testPage = await newLoginPage({
    path: "/hire-talent",
    talentSearchResults: [{
      candidateId: candidate.id,
      userId: "dialog-talent-user",
      score: 92,
      overlapSkills: [],
      matchReasons: {},
      candidate: { maskedName: "Dialog Talent", category: "technology" },
    }],
    postAuthTalentIdentity: {
      candidateId: candidate.id,
      email: candidate.email,
      fullName: candidate.fullName,
    },
    loginHandler: (route) => fulfillJson(route, { token, candidate }),
  });
  try {
    await testPage.page.getByPlaceholder("Tell us what you need").fill("frontend engineer");
    await testPage.page.getByRole("button", { name: /Hire Talent/ }).click();
    await testPage.page.getByRole("heading", { name: 'Matches for "frontend engineer"' })
      .waitFor({ state: "visible" });
    await testPage.page.getByRole("button", { name: "Preview", exact: true }).click();
    const loginDialogOpened = testPage.page.getByRole("dialog").waitFor({ state: "visible" });
    await testPage.page.getByRole("button", { name: "Sign in", exact: true }).click();
    await loginDialogOpened;
    const dialogOpened = testPage.page.getByTestId("card-talent-login").waitFor({ state: "visible" });
    await dialogOpened;
    await testPage.page.getByTestId("card-talent-login").click();
    await testPage.page.getByTestId("input-email").fill(candidate.email);
    await testPage.page.getByTestId("input-password").fill("password");
    const dialogClosed = testPage.page.getByRole("dialog").waitFor({ state: "hidden" });
    await testPage.page.getByTestId("button-submit-login").click();
    await dialogClosed;
    assert.equal(testPage.loginPostCount(), 1);
    assert.equal(testPage.talentIdentityGetCount(), 1);
    assert.equal(testPage.profilesMeGetCount(), 0);
    assert.deepEqual(testPage.payloads()[0], { email: candidate.email, password: "password" });
    assert.deepEqual(await testPage.page.evaluate(() =>
      JSON.parse(localStorage.getItem("talent_profile_token") || "null")), {
      token,
      candidateId: candidate.id,
      email: candidate.email,
      fullName: candidate.fullName,
    });
  } finally {
    await testPage.context.close();
  }
});

async function newTalentModalPage(
  loginHandler: LoginHandler,
  postAuthTalentIdentity?: TalentIdentityFixture,
  talentIdentityStatus?: number,
): Promise<LoginTestPage> {
  const testPage = await newLoginPage({
    path: "/talent-pool",
    postAuthTalentIdentity,
    talentIdentityStatus,
    loginHandler,
  });
  const promptSignIn = testPage.page.getByRole("button", { name: "Sign in", exact: true });
  await promptSignIn.waitFor({ state: "visible" });
  const modalReady = testPage.page.getByTestId("button-talent-modal-login").waitFor({ state: "visible" });
  await promptSignIn.click();
  await modalReady;
  return testPage;
}

test("TalentLoginModal activates the authenticated Talent UI in the same SPA session", async () => {
  const candidate = {
    id: "modal-live-candidate",
    email: "modal.live@example.test",
    fullName: "Modal Live Talent",
  };
  const token = talentTokenFor(candidate.id, candidate.email);
  const testPage = await newTalentModalPage(
    (route) => fulfillJson(route, { token, candidate }),
    {
      candidateId: candidate.id,
      email: candidate.email,
      fullName: candidate.fullName,
    },
  );
  try {
    await testPage.page.evaluate(() => {
      localStorage.setItem("onspot_jwt_token", "stale-admin-token");
      localStorage.setItem("onspot_user", JSON.stringify({
        id: "stale-admin-user",
        email: "old.admin@example.test",
        role: "admin",
      }));
    });
    await testPage.page.getByLabel("Email address").fill(candidate.email);
    await testPage.page.getByLabel("Password").fill("password");
    const destination = testPage.page.waitForURL((url) =>
      url.pathname === `/talent-profile/${candidate.id}`);
    await testPage.page.getByTestId("button-talent-modal-login").click();
    await destination;
    await testPage.page.getByRole("dialog").waitFor({ state: "hidden" });

    assert.equal(testPage.loginPostCount(), 1);
    assert.equal(testPage.talentIdentityGetCount(), 1);
    assert.equal(testPage.profilesMeGetCount(), 0);
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_user")), null);
    const talentAccount = testPage.page.locator(
      '[data-testid="account-dropdown-trigger"], [data-testid="talent-account-dropdown-trigger"]',
    );
    await talentAccount.waitFor({ state: "visible", timeout: 8_000 });
    await talentAccount.click({ timeout: 8_000 });
    await testPage.page.getByRole("menu").getByText(candidate.email, { exact: true })
      .waitFor({ state: "visible" });
    assert.equal(new URL(testPage.page.url()).pathname, `/talent-profile/${candidate.id}`);
  } finally {
    await testPage.context.close();
  }
});

test("TalentLoginModal displays a network failure and preserves entered values", async () => {
  const testPage = await newTalentModalPage((route) => route.abort("failed"));
  try {
    await testPage.page.getByLabel("Email address").fill("modal.network@example.test");
    await testPage.page.getByLabel("Password").fill("preserved password");
    await testPage.page.getByTestId("button-talent-modal-login").click();
    const alert = testPage.page.getByTestId("talent-login-error");
    await alert.waitFor({ state: "visible" });
    assert.match(await alert.innerText(), /Could not reach the server/);
    assert.equal(await testPage.page.getByLabel("Email address").inputValue(), "modal.network@example.test");
    assert.equal(await testPage.page.getByLabel("Password").inputValue(), "preserved password");
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("failed TalentLoginModal session switch restores the prior candidate session", async () => {
  const candidate = {
    id: "failed-switch-new-candidate",
    email: "failed.switch.new@example.test",
    fullName: "New Candidate Session",
  };
  const token = talentTokenFor(candidate.id, candidate.email);
  const previousTalentAuth = {
    token: talentTokenFor("previous-talent-candidate", "previous.talent@example.test"),
    candidateId: "previous-talent-candidate",
    email: "previous.talent@example.test",
    fullName: "Previous Talent Session",
  };
  const previousMainUser = {
    id: "previous-main-user",
    email: "previous.main@example.test",
    role: "client",
  };
  const testPage = await newTalentModalPage(
    (route) => fulfillJson(route, { token, candidate }),
    undefined,
    500,
  );
  try {
    await testPage.page.evaluate(({ talentAuth, mainUser }) => {
      localStorage.setItem("talent_profile_token", JSON.stringify(talentAuth));
      localStorage.setItem("onspot_jwt_token", "previous-main-session-token");
      localStorage.setItem("onspot_user", JSON.stringify(mainUser));
    }, { talentAuth: previousTalentAuth, mainUser: previousMainUser });

    await testPage.page.getByLabel("Email address").fill(candidate.email);
    await testPage.page.getByLabel("Password").fill("password");
    const identityFailure = testPage.page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/talent-auth/me" && response.status() === 500,
    );
    await testPage.page.getByTestId("button-talent-modal-login").click();
    await identityFailure;
    const previousTalentSession = JSON.stringify(previousTalentAuth);
    await testPage.page.waitForFunction((expected) =>
      localStorage.getItem("talent_profile_token") === expected,
    previousTalentSession);
    assert.equal(testPage.loginPostCount(), 1);
    assert.equal(testPage.talentIdentityGetCount(), 1);
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("talent_profile_token")),
      previousTalentSession,
      "failed switching candidates must restore the exact prior talent_profile_token session");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_jwt_token")),
      "previous-main-session-token");
    assert.equal(await testPage.page.evaluate(() => localStorage.getItem("onspot_user")),
      JSON.stringify(previousMainUser));
  } finally {
    await testPage.context.close();
  }
});

test("TalentLoginModal observes 429 Retry-After metadata before enabling another attempt", async () => {
  const testPage = await newTalentModalPage((route) => fulfillJson(
    route,
    { message: "Too many attempts.", retryAfter: 3 },
    429,
    { "Retry-After": "7" },
  ));
  try {
    await testPage.page.clock.install({ time: new Date("2030-01-01T00:00:00.000Z") });
    await testPage.page.getByLabel("Email address").fill("modal.limited@example.test");
    await testPage.page.getByLabel("Password").fill("password");
    const submit = testPage.page.getByTestId("button-talent-modal-login");
    await submit.click();
    await testPage.page.getByTestId("talent-login-error").waitFor({ state: "visible" });
    assert.equal(await submit.isDisabled(), true);
    await testPage.page.clock.fastForward(6_000);
    assert.equal(await submit.isDisabled(), true);
    await testPage.page.clock.fastForward(1_000);
    assert.equal(await submit.isDisabled(), false);
    assert.equal(testPage.loginPostCount(), 1);
  } finally {
    await testPage.context.close();
  }
});

test("TalentLoginModal replaces its inline error with each backend 400, 401, and 500 message", async () => {
  const responses = [
    { status: 400, body: { message: "Please check your login information." } },
    { status: 401, body: { message: "The email or password is incorrect." } },
    { status: 500, body: { message: "Sign-in service is temporarily unavailable." } },
  ];
  let responseIndex = 0;
  const testPage = await newTalentModalPage((route) => {
    const response = responses[responseIndex++];
    return fulfillJson(route, response.body, response.status);
  });
  try {
    await testPage.page.getByLabel("Email address").fill("modal.status@example.test");
    await testPage.page.getByLabel("Password").fill("password");
    const submit = testPage.page.getByTestId("button-talent-modal-login");
    const alert = testPage.page.getByTestId("talent-login-error");
    for (const response of responses) {
      await submit.click();
      await alert.waitFor({ state: "visible" });
      assert.equal((await alert.innerText()).trim(), response.body.message);
      assert.equal(await testPage.page.getByLabel("Email address").inputValue(), "modal.status@example.test");
      assert.equal(await testPage.page.getByLabel("Password").inputValue(), "password");
    }
    assert.equal(testPage.loginPostCount(), 3);
  } finally {
    await testPage.context.close();
  }
});