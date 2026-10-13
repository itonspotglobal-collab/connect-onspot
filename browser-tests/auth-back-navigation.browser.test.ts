import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { authBackDestination, authPortalHref, safeAuthOrigin } from "../client/src/lib/authBackNavigation";

const PORT = 5188;
const BASE = `http://127.0.0.1:${PORT}`;
let browser: Browser;
let vite: ChildProcess;
let cache: string;

before(async () => {
  cache = await mkdtemp(join(tmpdir(), "auth-back-browser-"));
  vite = spawn(process.execPath, [
    "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort",
  ], {
    stdio: "ignore",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "development", AUTH_BROWSER_CACHE_DIR: cache },
  });
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Isolated Vite exited: ${vite.exitCode}`);
    try { if ((await fetch(BASE)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, "Isolated frontend did not start");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    headless: true, args: ["--no-sandbox"],
  });
}, { timeout: 90_000 });

after(async () => {
  await browser?.close();
  if (vite?.exitCode === null) vite.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 500));
  if (vite?.exitCode === null) vite.kill("SIGKILL");
  if (cache) await rm(cache, { recursive: true, force: true });
});

async function open(path: string, mobile = false): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: mobile ? 390 : 1280, height: mobile ? 844 : 900 },
    reducedMotion: "reduce", serviceWorkers: "block",
  });
  page.setDefaultTimeout(15_000);
  await page.addInitScript("window.__name = (fn) => fn;");
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      // No real account, database, social provider or registration is contacted.
      assert.equal(route.request().method(), "GET", `Unexpected write: ${url.pathname}`);
      const auth = url.pathname.includes("/auth/") || url.pathname === "/api/auth/me";
      return route.fulfill({
        status: auth ? 401 : 200, contentType: "application/json",
        body: auth ? '{"message":"Unauthenticated"}' :
          url.pathname === "/api/jobs/search"
            ? '{"items":[],"meta":{"page":1,"pageSize":25,"total":0,"totalPages":0}}' : "[]",
      });
    }
    if (url.origin !== BASE) return route.abort();
    return route.continue();
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  return page;
}

async function enter(page: Page, kind: "login" | "signup", mobile = false) {
  if (mobile) await page.getByTestId("mobile-menu-toggle").click();
  await page.getByTestId(mobile ? `mobile-${kind}-button` : `nav-${kind}-button`).click();
  await page.getByTestId("auth-back-to-origin").waitFor();
}

async function choose(page: Page, kind: "login" | "signup", portal: "client" | "talent") {
  await page.locator(`a[href^="/${kind}/${portal}"]`).click();
  await page.getByTestId("auth-back-to-portal").waitFor();
}

test("Cancellation destinations reject unsafe URLs and intermediate auth pages", () => {
  for (const value of ["https://evil.invalid", "//evil.invalid", "/%2f%2fevil.invalid", "/\\evil.invalid",
    "/%255cevil.invalid", "/login/talent", "/signup?backTo=/jobs", "/%6cogin", "/admin/login"]) {
    assert.equal(safeAuthOrigin(value), null, value);
    assert.equal(authBackDestination(`backTo=${encodeURIComponent(value)}`), "/");
  }
  assert.equal(safeAuthOrigin("/find-work/jobs?category=sales#roles"), "/find-work/jobs?category=sales#roles");
  const href = new URL(authPortalHref("login", "?portal=talent&returnTo=%2Fmy-applications&backTo=%2Fjobs"), BASE);
  assert.equal(href.searchParams.has("portal"), false);
  assert.equal(href.searchParams.get("returnTo"), "/my-applications");
  assert.equal(href.searchParams.get("backTo"), "/jobs");
});

for (const mobile of [false, true]) {
  for (const kind of ["login", "signup"] as const) {
    for (const portal of ["talent", "client"] as const) {
      test(`Find Work → ${kind} → ${portal} → portal → Find Work (${mobile ? "mobile" : "desktop"})`,
        { timeout: 90_000 }, async () => {
          const origin = "/find-work/jobs?category=sales#roles";
          const page = await open(origin, mobile);
          try {
            await enter(page, kind, mobile);
            assert.equal(new URL(page.url()).searchParams.get("backTo"), origin);
            assert.equal(await page.getByTestId("auth-back-to-origin").innerText(), "Back to Find Work");
            await choose(page, kind, portal);
            // Refresh must preserve the originating URL, including query and hash.
            await page.reload({ waitUntil: "domcontentloaded" });
            const back = page.getByTestId("auth-back-to-portal");
            await back.waitFor();
            assert.equal(await back.innerText(), "Back to Portal");
            const box = await back.boundingBox();
            assert.ok(box && box.height >= 44 && box.x >= 0 && box.y >= 0);
            assert.ok(box && box.x + box.width <= (mobile ? 390 : 1280));
            await back.focus();
            assert.equal(await back.evaluate(el => document.activeElement === el), true);
            await back.press("Enter");
            await page.getByTestId("auth-back-to-origin").waitFor();
            assert.equal(new URL(page.url()).pathname, `/${kind}`);
            assert.equal(new URL(page.url()).searchParams.get("backTo"), origin);
            await page.getByTestId("auth-back-to-origin").click();
            await page.waitForURL(`${BASE}${origin}`);
          } finally { await page.close(); }
        });
    }
  }
}

test("Switching Login ↔ Sign Up preserves origin and existing successful-auth returnTo", { timeout: 90_000 }, async () => {
  const page = await open("/login/talent?backTo=%2Fwhy-onspot%2Fabout&returnTo=%2Fmy-applications");
  try {
    await page.getByRole("link", { name: "Create Account", exact: true }).click();
    await page.getByTestId("auth-back-to-portal").waitFor();
    assert.equal(new URL(page.url()).pathname, "/signup/talent");
    assert.equal(new URL(page.url()).searchParams.get("backTo"), "/why-onspot/about");
    assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/my-applications");
    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await page.getByTestId("button-submit-portal-login").waitFor();
    assert.equal(new URL(page.url()).pathname, "/login/talent");
    assert.equal(new URL(page.url()).searchParams.get("backTo"), "/why-onspot/about");
    assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/my-applications");
    await page.getByTestId("auth-back-to-portal").click();
    await page.getByTestId("auth-back-to-origin").click();
    await page.waitForURL(`${BASE}/why-onspot/about`);
  } finally { await page.close(); }
});

test("Other public origins are captured; fresh direct auth visits do not inherit stale origins", { timeout: 90_000 }, async () => {
  const page = await open("/talent-pool");
  try {
    await enter(page, "login");
    assert.equal(await page.getByTestId("auth-back-to-origin").innerText(), "Back to Talent Search");
    await page.getByTestId("auth-back-to-origin").click();
    await page.waitForURL(`${BASE}/talent-pool`);
    for (const path of ["/login", "/signup"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      const back = page.getByTestId("auth-back-to-origin");
      await back.waitFor();
      assert.equal(await back.innerText(), "Back to Home");
      assert.equal(await back.getAttribute("href"), "/");
      await back.click();
      await page.waitForURL(`${BASE}/`);
    }
  } finally { await page.close(); }
});

test("Unsafe explicit origins fall back to Home and legacy portal query returns to selection", { timeout: 90_000 }, async () => {
  const page = await open("/login?portal=talent&backTo=https%3A%2F%2Fevil.invalid&returnTo=%2Fmy-applications");
  try {
    await page.getByTestId("auth-back-to-portal").click();
    const back = page.getByTestId("auth-back-to-origin");
    await back.waitFor();
    assert.equal(await back.getAttribute("href"), "/");
    assert.equal(await back.innerText(), "Back to Home");
    assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/my-applications");
  } finally { await page.close(); }
});
