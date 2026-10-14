import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page, type Route } from "playwright";

// Runs the real routed app with isolated Vite/cache and intercepted APIs.
// No production accounts, email delivery or database are touched.
const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5177);
const BASE = `http://127.0.0.1:${PORT}`;
let browser: Browser;
let vite: ChildProcess;
let cache: string;

before(async () => {
  cache = await mkdtemp(join(tmpdir(), "talent-landing-browser-"));
  vite = spawn(process.execPath, [
    "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort",
  ], {
    stdio: "ignore",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "development", AUTH_BROWSER_CACHE_DIR: cache },
  });
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Vite exited: ${vite.exitCode}`);
    try { if ((await fetch(BASE)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, "Isolated frontend did not start");
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ["--no-sandbox"] });
}, { timeout: 90_000 });

after(async () => {
  await browser?.close();
  if (vite?.exitCode === null) vite.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 500));
  if (vite?.exitCode === null) vite.kill("SIGKILL");
  if (cache) await rm(cache, { recursive: true, force: true });
});

async function open(width = 390, path = "/join-onspot", reducedMotion: "reduce" | "no-preference" = "reduce") {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion });
  page.setDefaultTimeout(20_000);
  const writes: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript("window.__name = (fn) => fn;");
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      if (!["GET", "HEAD"].includes(route.request().method())) {
        writes.push(`${route.request().method()} ${url.pathname}`);
        return route.fulfill({ status: 500, json: { message: "Unexpected test write" } });
      }
      if (url.pathname === "/api/signup/status") return route.fulfill({ status: 404, json: { message: "No pending signup" } });
      return route.fulfill({ status: url.pathname.includes("/auth/") ? 401 : 200, json: url.pathname.includes("/auth/") ? { message: "Unauthenticated" } : [] });
    }
    if (url.origin !== BASE) return route.abort();
    return route.continue();
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator(".talent-landing h1").waitFor();
  return { page, writes, errors };
}

async function startSignup(page: Page, nativeAutofill = false) {
  if (nativeAutofill) {
    await page.evaluate(() => {
      const values: Record<string, string> = { "talent-first-name": "Maria", "talent-last-name": "Santos", "talent-email": "maria@example.test" };
      for (const [id, value] of Object.entries(values)) (document.getElementById(id) as HTMLInputElement).value = value;
    });
  } else {
    await page.locator("#talent-first-name").fill("Maria");
    await page.locator("#talent-last-name").fill("Santos");
    await page.locator("#talent-email").fill("maria@example.test");
  }
  await page.locator("#talent-main-skill").selectOption({ label: "Customer support" });
  await page.getByRole("form", { name: "Start your talent profile" }).getByRole("button", { name: "Create my free profile" }).click();
  await page.getByTestId("button-submit-signup").waitFor();
}

async function finishCredentials(page: Page) {
  await page.getByTestId("input-signup-password").fill("ValidPassword123!");
  await page.getByTestId("input-confirm-password").fill("ValidPassword123!");
  await page.getByTestId("checkbox-terms").click();
}

function pending(deliveryStatus = "accepted") {
  return {
    success: false, pendingVerification: true, role: "talent", challengeId: "landing-fixture-challenge",
    maskedEmail: "m***@example.test", deliveryStatus,
    codeExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test(`Approved talent landing content and layout fit ${width}px`, { timeout: 90_000 }, async () => {
    const { page, writes, errors } = await open(width);
    try {
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal((await page.locator("h1").innerText()).replace(/\s+/g, " "), "Do the work you love. Keep every dollar.");
      assert.equal(await page.locator(".tl-benefit").count(), 4);
      assert.equal(await page.locator(".tl-benefit h3").count(), 4);
      assert.equal(await page.locator(".tl-nav-cta").evaluate(el => getComputedStyle(el).color), "rgb(16, 26, 120)");
      assert.equal(await page.locator(".tl-steps li").count(), 3);
      assert.equal(await page.locator(".tl-roles li").count(), 10);
      assert.equal(await page.locator(".tl-qa details").count(), 5);
      assert.equal(await page.locator(".manifesto-page").count(), 0);
      assert.doesNotMatch(await page.locator(".talent-landing").innerText(), /Hi, I’m Nur|hourly|\/ hour|Profile started|Welcome aboard/);
      const sections = [".tl-hero", ".tl-benefits", ".tl-row-flip", ".tl-rate-row", ".tl-how", ".tl-skill-row", ".tl-faq", ".tl-closing"];
      const tops: number[] = [];
      for (const selector of sections) tops.push((await page.locator(selector).first().boundingBox())!.y);
      assert.ok(tops.every((y, i) => i === 0 || y > tops[i - 1]));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator(".tl-hero-image").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 495));
      for (const id of ["talent-first-name", "talent-last-name", "talent-email", "talent-main-skill"]) {
        const control = page.locator(`#${id}`);
        const box = await control.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.height >= 42, `${id}: ${JSON.stringify(box)}`);
        assert.ok(await control.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
      }
      assert.equal(await page.locator(".tl-logo").getAttribute("href"), "/");
      assert.equal(await page.locator(".legal a").first().getAttribute("href"), "/terms-and-conditions");
      assert.equal(await page.locator(".legal a").last().getAttribute("href"), "/privacy-policy");
      assert.equal(await page.locator('a[href="#"]').count(), 0);
      await page.waitForFunction(() => document.title === "Join OnSpot — Set your rate. Keep every dollar.");
      if ([320, 390, 1440].includes(width)) {
        await page.screenshot({ path: `/tmp/talent-landing-${width}.png`, fullPage: true });
      }
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test("FAQ answers and all anchor/signup controls work with keyboard and reduced motion", async () => {
  const { page } = await open();
  try {
    const summaries = page.locator(".tl-qa summary");
    for (let i = 0; i < 5; i++) {
      await summaries.nth(i).focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(".tl-qa details").nth(i).getAttribute("open"), "");
      assert.ok((await page.locator(".tl-qa details").nth(i).locator("p").innerText()).length > 30);
      await page.keyboard.press("Space");
      assert.equal(await page.locator(".tl-qa details").nth(i).getAttribute("open"), null);
    }
    for (const selector of [".tl-nav-cta", ".tl-closing .tl-button"]) {
      await page.locator(selector).click();
      await page.waitForFunction(() => document.activeElement?.id === "talent-first-name");
    }
    for (const target of ["how", "faq"]) {
      await page.locator(`.tl-nav a[href="#${target}"]`).click();
      await page.waitForFunction(id => document.getElementById(id)!.getBoundingClientRect().top < 150, target);
    }
    assert.equal(await page.locator(".tl-sticky").evaluate(el => parseFloat(getComputedStyle(el).transitionDuration)) < .01, true);
  } finally { await page.close(); }
});

test("Initial form validates without writes, reads autofill and hands all details to existing signup", async () => {
  const { page, writes } = await open(320);
  try {
    await page.locator(".talent-signup button[type=submit]").click();
    assert.equal(await page.locator("[aria-invalid=true]").count(), 4);
    assert.equal(await page.locator("#talent-first-name").evaluate(el => el === document.activeElement), true);
    await startSignup(page, true);
    assert.equal(await page.getByTestId("input-first-name").inputValue(), "Maria");
    assert.equal(await page.getByTestId("input-last-name").inputValue(), "Santos");
    assert.equal(await page.getByTestId("input-signup-email").inputValue(), "maria@example.test");
    assert.equal(new URL(page.url()).pathname, "/join-onspot");
    assert.deepEqual(writes, []);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator("[data-signup-modal-overlay]").waitFor({ state: "detached" });
    assert.equal(await page.locator("#talent-email").inputValue(), "maria@example.test");
  } finally { await page.close(); }
});

for (const status of [409, 429, 500]) {
  test(`Existing signup handles HTTP ${status} without a false success or losing names`, async () => {
    const { page } = await open();
    let count = 0;
    await page.route("**/api/signup", route => {
      count++;
      return route.fulfill({ status, headers: status === 429 ? { "Retry-After": "30" } : {}, json: { message: status === 409 ? "This email is already registered." : "Please try again later." } });
    });
    try {
      await startSignup(page);
      await finishCredentials(page);
      await page.getByTestId("button-submit-signup").click();
      await page.getByTestId("signup-error").waitFor();
      assert.equal(count, 1);
      assert.equal(await page.getByTestId("input-first-name").inputValue(), "Maria");
      assert.equal(await page.locator('[data-testid="signup-email-verification"]').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
    } finally { await page.close(); }
  });
}

for (const delivery of ["accepted", "failed"]) {
  test(`Signup uses real pending-verification UI for ${delivery} delivery, then activates only after valid code`, async () => {
    const { page } = await open();
    let posts = 0;
    let payload: any;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/signup", async route => {
      posts++;
      payload = route.request().postDataJSON();
      await gate;
      await route.fulfill({ status: 202, json: pending(delivery) });
    });
    let verifies = 0;
    await page.route("**/api/signup/verify", async route => {
      verifies++;
      assert.equal(route.request().postDataJSON().challengeId, "landing-fixture-challenge");
      if (verifies === 1) return route.fulfill({ status: 400, json: { message: "Incorrect code. Please try again." } });
      return route.fulfill({ status: 201, json: {
        success: true, accountCreated: true, token: "fixture-jwt", talentToken: "fixture-talent-token", candidateId: "fixture-candidate",
        returnTo: payload.returnTo,
        user: { id: "fixture-user", email: payload.email, first_name: payload.first_name, last_name: payload.last_name, role: "talent" },
      } });
    });
    await page.route("**/get-hired?*", route => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: "text/html", body: "<html><body>Fixture onboarding destination</body></html>" })
      : route.continue());
    try {
      await startSignup(page);
      await finishCredentials(page);
      const request = page.waitForRequest(r => new URL(r.url()).pathname === "/api/signup" && r.method() === "POST");
      await page.getByTestId("button-submit-signup").click();
      await request;
      await page.locator("#signup-form").dispatchEvent("submit");
      assert.equal(posts, 1, "Double submit cannot start another registration");
      assert.equal(payload.first_name, "Maria");
      assert.equal(payload.last_name, "Santos");
      assert.equal(payload.email, "maria@example.test");
      assert.equal(payload.role, "talent");
      assert.equal(new URL(payload.returnTo, BASE).searchParams.get("mainSkill"), "Customer support");
      assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
      release();
      await page.getByRole("heading", { name: "Check your email" }).waitFor();
      if (delivery === "failed") await page.getByText("The email service did not accept the message.", { exact: false }).waitFor();
      const code = page.getByLabel("Six-digit verification code");
      await code.fill("111111");
      await page.getByRole("button", { name: "Verify email", exact: true }).click();
      await page.getByText("Incorrect code. Please try again.", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem("onspot_jwt_token")), null);
      await code.fill("222222");
      await page.getByRole("button", { name: "Verify email", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/get-hired");
      assert.equal(new URL(page.url()).searchParams.get("mainSkill"), "Customer support");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("onspot_user")!).first_name), "Maria");
    } finally { release(); await page.close(); }
  });
}

test("Mobile sticky signup is hidden for the form, modal and closing CTA and returns focus safely", async () => {
  const { page } = await open();
  try {
    const sticky = page.locator(".tl-sticky");
    await page.locator("#signup").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".tl-sticky")?.getAttribute("aria-hidden") === "true");
    await page.locator(".tl-rate-row").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".tl-sticky")?.getAttribute("aria-hidden") === "false");
    await sticky.locator("a").click();
    await page.waitForFunction(() => document.activeElement?.id === "talent-first-name");
    await startSignup(page);
    assert.equal(await sticky.getAttribute("aria-hidden"), "true");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator("#join").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".tl-sticky")?.getAttribute("aria-hidden") === "true");
    await page.setViewportSize({ width: 390, height: 380 });
    await page.locator(".tl-nav-cta").click();
    await page.waitForFunction(() => document.activeElement?.id === "talent-first-name");
    assert.equal(await sticky.getAttribute("aria-hidden"), "true");
  } finally { await page.close(); }
});

test("Legacy Manifesto URL still resolves to the new talent landing", async () => {
  const { page } = await open(1280, "/manifesto");
  try { assert.equal(new URL(page.url()).pathname, "/join-onspot"); }
  finally { await page.close(); }
});
