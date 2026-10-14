import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page, type Route } from "playwright";
import { authBackDestination, authPortalHref, safeAuthOrigin } from "../client/src/lib/authBackNavigation";
import { PASSWORD_POLICY_HINT } from "../shared/passwordPolicy";

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

async function open(path: string, mobile = false, options: {
  width?: number;
  height?: number;
  signup?: (route: Route) => Promise<void>;
} = {}): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: options.width ?? (mobile ? 390 : 1280), height: options.height ?? (mobile ? 844 : 900) },
    reducedMotion: "reduce", serviceWorkers: "block",
  });
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(60_000);
  await page.addInitScript("window.__name = (fn) => fn;");
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/signup" && options.signup && route.request().method() === "POST") {
        return options.signup(route);
      }
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

test("Signup chooser uses clear role-specific messages without changing Login copy", { timeout: 90_000 }, async () => {
  const page = await open("/signup?backTo=%2Ffind-work%2Fjobs", true);
  try {
    await page.getByRole("heading", { name: "Get started with OnSpot", exact: true }).waitFor();
    const client = page.locator('a[href^="/signup/client"]');
    const talent = page.locator('a[href^="/signup/talent"]');
    assert.match(await client.innerText(), /Hiring/);
    assert.match(await client.innerText(), /Find and manage vetted global talent for your business/);
    assert.match(await talent.innerText(), /Looking for Work/);
    assert.match(await talent.innerText(), /Discover global opportunities and grow your career/);
    for (const option of [client, talent]) {
      assert.match(await option.innerText(), /Get Started/);
      await option.focus();
      assert.equal(await option.evaluate(el => document.activeElement === el), true);
    }
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
    assert.equal(await page.getByText("Choose how you want to access OnSpot.", { exact: true }).count(), 1);
  } finally { await page.close(); }
});

for (const width of [320, 768, 1280]) {
  for (const portal of ["client", "talent"] as const) {
    test(`Polished ${portal} signup remains readable and usable at ${width}px`, { timeout: 90_000 }, async () => {
      const height = width === 320 ? 667 : 900;
      const page = await open(`/signup/${portal}?backTo=%2Ffind-work%2Fjobs`, width === 320, { width, height });
      try {
        await page.getByTestId("auth-back-to-portal").waitFor();
        await page.getByRole("heading", { name: portal === "client" ? "Hire Talent" : "Find Work", exact: true }).waitFor();
        assert.equal(await page.getByText(portal === "client"
          ? "Create your account and start building your remote team."
          : "Create your profile and connect with global opportunities.", { exact: true }).count(), 1);
        assert.equal((await page.getByTestId("button-submit-signup").innerText()).trim(),
          portal === "client" ? "Create Client Account" : "Create Talent Profile");
        const layout = await page.evaluate(() => {
          const first = document.querySelector<HTMLInputElement>("#firstName")!;
          const last = document.querySelector<HTMLInputElement>("#lastName")!;
          const helper = document.querySelector("#signup-password-hint")!;
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            first: first.getBoundingClientRect().toJSON(),
            last: last.getBoundingClientRect().toJSON(),
            heights: [...document.querySelectorAll<HTMLInputElement>("#signup-form input.signup-field")].map(el => el.getBoundingClientRect().height),
            labelSizes: [...document.querySelectorAll("#signup-form label")].map(el => parseFloat(getComputedStyle(el).fontSize)),
            helperSize: parseFloat(getComputedStyle(helper).fontSize),
            helperLineHeight: parseFloat(getComputedStyle(helper).lineHeight),
          };
        });
        assert.equal(layout.overflow, false);
        assert.ok(layout.heights.every(value => value >= 44));
        assert.ok(layout.labelSizes.every(value => value >= 13));
        assert.ok(layout.helperSize >= 12 && layout.helperLineHeight >= 18);
        assert.equal((await page.locator("#signup-password-hint").innerText()).trim(), PASSWORD_POLICY_HINT);
        if (width === 320) assert.ok(layout.last.top >= layout.first.bottom, "Names must stack on narrow phones");
        else assert.equal(layout.first.top, layout.last.top, "Names share a row on larger screens");
        for (const id of ["auth-back-to-portal", "button-submit-signup"]) {
          const box = await page.getByTestId(id).boundingBox();
          assert.ok(box && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.y + box.height <= height);
        }
        for (const button of await page.locator(".signup-footer button").all()) {
          const box = await button.boundingBox();
          assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= height,
            "The complete sticky footer, including secondary actions, stays inside the viewport");
        }
        await page.getByTestId("input-signup-email").focus();
        assert.equal(await page.getByTestId("input-signup-email").evaluate(el => document.activeElement === el), true);
        for (const [name, href] of [["Terms of Service", "/terms-and-conditions"], ["Privacy Policy", "/privacy-policy"]]) {
          const link = page.getByRole("link", { name, exact: true });
          assert.equal(await link.getAttribute("href"), href);
          assert.equal(await link.getAttribute("target"), "_blank");
          await link.scrollIntoViewIfNeeded();
          await link.focus();
          assert.equal(await link.evaluate(el => document.activeElement === el), true);
        }
      } finally { await page.close(); }
    });
  }
}

test("Client signup retains required company validation, inline feedback, and successful redirect", { timeout: 90_000 }, async () => {
  let writes = 0;
  let payload: Record<string, unknown> = {};
  const page = await open("/signup/client?backTo=%2Ffind-work%2Fjobs", true, {
    signup: async route => {
      writes++;
      payload = route.request().postDataJSON();
      if (writes === 1) return route.fulfill({
        status: 400, contentType: "application/json", body: JSON.stringify({ message: "Fixture: please review company details." }),
      });
      return route.fulfill({
        status: 201, contentType: "application/json",
        body: JSON.stringify({
          success: true, token: "isolated-client-session",
          user: { id: "signup-polish-client", email: "client@example.test", first_name: "Test", last_name: "Client", role: "client" },
        }),
      });
    },
  });
  try {
    await page.getByTestId("input-first-name").fill("Test");
    await page.getByTestId("input-last-name").fill("Client");
    await page.getByTestId("input-signup-email").fill("client@example.test");
    await page.getByTestId("input-signup-password").fill("ValidPass123!");
    await page.getByTestId("input-confirm-password").fill("ValidPass123!");
    await page.getByTestId("checkbox-terms").click();
    await page.getByTestId("button-submit-signup").click();
    await page.getByTestId("signup-error").waitFor();
    assert.match(await page.getByTestId("signup-error").innerText(), /company/i);
    assert.equal(writes, 0);
    await page.locator("#company").fill("Test Company");
    await page.getByTestId("button-submit-signup").click();
    await page.getByText("Fixture: please review company details.", { exact: true }).waitFor();
    assert.equal(await page.locator("#company").inputValue(), "Test Company");
    await page.getByTestId("button-submit-signup").click();
    await page.waitForURL(url => url.pathname === "/hire-talent");
    assert.equal(writes, 2);
    assert.equal(payload.role, "client");
    assert.equal(payload.company, "Test Company");
    assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), "isolated-client-session");
  } finally { await page.close(); }
});
