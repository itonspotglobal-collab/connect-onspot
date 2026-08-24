import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;

let browser: Browser;
let vite: ChildProcess | undefined;

function candidateToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      type: "candidate",
      candidateId: "candidate-payout-regression",
      email: "payout-talent@example.test",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    "test-signature",
  ].join(".");
}

async function waitForUrl(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function preparePage(session: "main" | "candidate"): Promise<{ page: Page; getPayoutAuth: () => string | undefined }> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let payoutAuth: string | undefined;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/profiles/me" && session === "candidate") {
      // Keep AuthContext unresolved for this fixture. The route guard must
      // still accept the independently stored candidate-portal session.
      return fulfillJson(route, { error: "profile lookup unavailable" }, 503);
    }
    if (path === "/api/candidates/me" && session === "main") {
      return fulfillJson(route, { profileCompleted: true });
    }
    if (path === "/api/talent/payouts") {
      payoutAuth = request.headers().authorization;
      return fulfillJson(route, [{
        id: `payout-${session}`,
        amount: "1250.00",
        currency: "PHP",
        status: "scheduled",
        scheduledAt: "2026-09-01T00:00:00.000Z",
        disbursedAt: null,
        createdAt: "2026-08-20T00:00:00.000Z",
      }]);
    }
    return route.continue();
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ session, token }) => {
    localStorage.clear();
    if (session === "candidate") {
      localStorage.setItem("talent_profile_token", JSON.stringify({
        token,
        candidateId: "candidate-payout-regression",
        email: "payout-talent@example.test",
        fullName: "Payout Talent",
      }));
    } else {
      localStorage.setItem("onspot_jwt_token", "test-main-talent-payout-jwt");
      localStorage.setItem("onspot_user", JSON.stringify({
        id: "user-payout-regression",
        email: "payout-talent@example.test",
        first_name: "Payout",
        last_name: "Talent",
        role: "talent",
      }));
    }
  }, { session, token: candidateToken() });
  await page.goto(`${BASE_URL}/talent/payouts`, { waitUntil: "domcontentloaded" });

  return { page, getPayoutAuth: () => payoutAuth };
}

before(async () => {
  if (!process.env.BROWSER_BASE_URL) {
    const viteEnv = { ...process.env };
    delete viteEnv.REPL_ID;
    vite = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "pipe", env: { ...viteEnv, NODE_ENV: "development" } },
    );
    vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    await waitForUrl(BASE_URL);
  }
  const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { headless: true };
  browser = await chromium.launch(launchOptions);
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([
      once(vite, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
});

test("payout history loads for main and candidate-portal talent sessions", async () => {
  for (const session of ["main", "candidate"] as const) {
    const { page, getPayoutAuth } = await preparePage(session);
    try {
      await page.getByRole("heading", { name: "Payout history" }).waitFor({
        state: "visible",
        timeout: 10_000,
      });
      await page.getByTestId(`payout-row-payout-${session}`).waitFor({
        state: "visible",
        timeout: 10_000,
      });

      assert.equal(
        getPayoutAuth(),
        session === "candidate"
          ? `Bearer ${await page.evaluate(() => {
              const raw = localStorage.getItem("talent_profile_token");
              return raw ? JSON.parse(raw).token : null;
            })}`
          : "Bearer test-main-talent-payout-jwt",
        "payout requests must use the active session's token",
      );
    } finally {
      await page.context().close();
    }
  }
});