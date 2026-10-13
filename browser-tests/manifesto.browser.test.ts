import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

// This suite replaces the old content-specific Manifesto screenshots. The
// original reference and font fixtures remain untouched for design provenance.
const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5177);
const BASE = `http://127.0.0.1:${PORT}`;
let browser: Browser;
let vite: ChildProcess;
let cache: string;
let paragraphs: string[];

before(async () => {
  paragraphs = (await readFile("browser-tests/fixtures/join-onspot-copy.txt", "utf8"))
    .trim().split(/\n\n/);
  cache = await mkdtemp(join(tmpdir(), "join-onspot-browser-"));
  vite = spawn(process.execPath, [
    "node_modules/vite/bin/vite.js", "--host", "127.0.0.1",
    "--port", String(PORT), "--strictPort",
  ], {
    stdio: "ignore",
    // No database, external credentials, staging overrides or Replit plugins.
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME,
      NODE_ENV: "development", AUTH_BROWSER_CACHE_DIR: cache,
    },
  });
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Vite exited: ${vite.exitCode}`);
    try { if ((await fetch(BASE)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, "Isolated frontend did not start");
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: ["--no-sandbox"],
  });
}, { timeout: 90_000 });

after(async () => {
  await browser?.close();
  if (vite?.exitCode === null) vite.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 500));
  if (vite?.exitCode === null) vite.kill("SIGKILL");
  if (cache) await rm(cache, { recursive: true, force: true });
});

async function open(width: number, path = "/join-onspot"): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width, height: 900 }, reducedMotion: "reduce",
  });
  page.setDefaultTimeout(20_000);
  await page.addInitScript("window.__name = (fn) => fn;");
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      return route.fulfill({
        status: url.pathname.includes("/auth/") ? 401 : 200,
        contentType: "application/json",
        body: url.pathname.includes("/auth/") ? '{"message":"Unauthenticated"}' : "[]",
      });
    }
    if (url.origin !== BASE) return route.abort();
    return route.continue();
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator(".manifesto-headline").waitFor();
  return page;
}

for (const width of [390, 768, 1280]) {
  test(`Join OnSpot preserves exact copy and reading layout at ${width}px`, { timeout: 90_000 }, async () => {
    const page = await open(width);
    try {
      assert.equal((await page.locator("h1").innerText()).replace(/\s+/g, " "), "Join OnSpot");
      assert.deepEqual(await page.locator(".manifesto-wrap p").allTextContents()
        .then(items => items.map(item => item.trim().replace(/\s+/g, " "))), paragraphs);
      const layout = await page.evaluate(() => {
        const root = document.querySelector(".manifesto-page")!;
        const heading = document.querySelector(".manifesto-headline")!;
        const rows = [...document.querySelectorAll(".manifesto-headline-row")];
        return {
          background: getComputedStyle(root).backgroundColor,
          font: getComputedStyle(heading).fontFamily,
          overflow: document.documentElement.scrollWidth > innerWidth,
          overlapping: rows[1].getBoundingClientRect().top < rows[0].getBoundingClientRect().bottom,
        };
      });
      assert.equal(layout.background, "rgb(10, 15, 46)");
      assert.match(layout.font, /Manifesto Inter/);
      assert.equal(layout.overflow, false);
      assert.equal(layout.overlapping, true);
      assert.equal(await page.locator("nav").count(), 0);
      assert.equal(await page.getByText("The OnSpot Manifesto", { exact: true }).count(), 0);
      assert.equal(await page.locator(".manifesto-about-link").getAttribute("href"), "/why-onspot/about");
      assert.equal(await page.locator(".manifesto-join-link").getAttribute("href"), "/signup");
      await page.waitForFunction(() => document.title === "Join OnSpot | OnSpot");
      assert.match(await page.locator('meta[name="description"]').getAttribute("content") ?? "", /Join OnSpot/);
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), "Join OnSpot | OnSpot");
      assert.match(await page.locator('link[rel="canonical"]').getAttribute("href") ?? "", /\/join-onspot$/);
    } finally { await page.close(); }
  });
}

test("Old Manifesto SPA links redirect to Join OnSpot", { timeout: 90_000 }, async () => {
  const page = await open(1280, "/manifesto");
  try { assert.equal(new URL(page.url()).pathname, "/join-onspot"); }
  finally { await page.close(); }
});

test("CTA opens the existing Client/Talent signup selection", { timeout: 90_000 }, async () => {
  const page = await open(390);
  try {
    await page.locator(".manifesto-join-link").click();
    await page.getByRole("heading", { name: "Create your OnSpot account" }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/signup");
    for (const portal of ["client", "talent"]) {
      const href = await page.locator(`a[href^="/signup/${portal}"]`).getAttribute("href");
      assert.equal(new URL(href!, BASE).searchParams.get("backTo"), "/join-onspot");
    }
  } finally { await page.close(); }
});

test("Back link and shared desktop/mobile footer use real renamed navigation", { timeout: 90_000 }, async () => {
  for (const width of [390, 1280]) {
    const page = await open(width);
    try {
      await page.locator(".manifesto-about-link").click();
      await page.locator('a[href="/join-onspot"]').first().waitFor();
      assert.equal(new URL(page.url()).pathname, "/why-onspot/about");
      assert.equal(await page.getByRole("link", { name: "Manifesto", exact: true }).count(), 0);
      await page.locator('a[href="/join-onspot"]').first().click();
      await page.locator(".manifesto-headline").waitFor();
      assert.equal(new URL(page.url()).pathname, "/join-onspot");
    } finally { await page.close(); }
  }
});
