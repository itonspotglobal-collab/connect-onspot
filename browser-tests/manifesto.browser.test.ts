import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

// Preserve current approved copy while allowing the explicitly requested
// illustration-led Join OnSpot redesign. Old references remain provenance.
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

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Join OnSpot preserves exact copy and responsive storytelling at ${width}px`, { timeout: 90_000 }, async () => {
    const page = await open(width);
    try {
      assert.equal((await page.locator("h1").innerText()).replace(/\s+/g, " "), "Join OnSpot");
      assert.deepEqual(await page.locator(".manifesto-lead,.manifesto-copy").allTextContents()
        .then(items => items.map(item => item.trim().replace(/\s+/g, " "))), paragraphs);
      const layout = await page.evaluate(() => {
        const root = document.querySelector(".manifesto-page")!;
        const heading = document.querySelector(".manifesto-headline")!;
        return {
          background: getComputedStyle(root).background,
          font: getComputedStyle(heading).fontFamily,
          overflow: document.documentElement.scrollWidth > innerWidth,
          paragraphs: [...document.querySelectorAll(".manifesto-lead,.manifesto-copy")].map(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return { x: r.x, right: r.right, fontSize: parseFloat(s.fontSize), lineHeight: parseFloat(s.lineHeight), visible: s.visibility !== "hidden" && s.opacity !== "0" };
          }),
        };
      });
      assert.match(layout.background, /gradient/);
      assert.match(layout.font, /Inter/);
      assert.equal(layout.overflow, false);
      assert.ok(layout.paragraphs.every(p => p.x >= 0 && p.right <= width && p.fontSize >= 16 && p.lineHeight / p.fontSize >= 1.4 && p.visible), JSON.stringify(layout));
      assert.ok(await page.locator(".manifesto-hero-copy").evaluate(el => parseFloat(getComputedStyle(el).animationDuration) < .01), "Reduced-motion preference disables entrance motion");
      assert.equal(await page.locator("nav").count(), 0);
      assert.equal(await page.getByText("The OnSpot Manifesto", { exact: true }).count(), 0);
      assert.equal(await page.locator(".manifesto-about-link").getAttribute("href"), "/why-onspot/about");
      const joins = page.locator(".manifesto-join-link");
      assert.equal(await joins.count(), 2, "Hero and final invitation each offer signup");
      assert.deepEqual(await joins.evaluateAll(els => els.map(el => el.getAttribute("href"))), ["/signup", "/signup"]);
      assert.equal(await page.getByRole("link", { name: "Hire Talent", exact: true }).getAttribute("href"), "/signup/client");
      assert.equal(await page.getByRole("link", { name: "Find Work", exact: true }).getAttribute("href"), "/signup/talent");
      const images = page.locator(".manifesto-page img");
      assert.ok(await images.count() >= 3, "Real supplied illustrations support the story");
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((el: HTMLImageElement) => el.decode());
        assert.ok((await image.getAttribute("alt"))?.trim());
        assert.ok(await image.evaluate((el: HTMLImageElement) => el.naturalWidth > 0 && getComputedStyle(el).objectFit === "contain"));
      }
      assert.ok((await page.locator(".manifesto-page").innerText()).includes("Nur Laminero"));
      await page.evaluate(() => scrollTo(0, 0));
      if ([320, 390, 1440].includes(width)) {
        await page.screenshot({ path: `/tmp/join-onspot-redesign-${width}.png`, fullPage: true });
      }
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

for (const width of [390, 1280]) {
  test(`All Join OnSpot signup CTAs reuse the existing blurred modal at ${width}px`, { timeout: 90_000 }, async () => {
    const page = await open(width);
    try {
      const controls = [
        { locator: page.locator(".manifesto-join-link").first(), role: "selection" },
        { locator: page.getByRole("link", { name: "Hire Talent", exact: true }), role: "client" },
        { locator: page.getByRole("link", { name: "Find Work", exact: true }), role: "talent" },
        { locator: page.locator(".manifesto-join-link").last(), role: "selection" },
      ];
      for (const { locator, role } of controls) {
        await locator.scrollIntoViewIfNeeded();
        assert.ok(await locator.evaluate(el => el.getBoundingClientRect().height >= 44));
        const originalScroll = await page.evaluate(() => scrollY);
        await locator.click();
        const overlay = page.locator("[data-signup-modal-overlay]");
        await overlay.waitFor();
        if (role === "selection") {
          await page.getByRole("heading", { name: "Get started with OnSpot" }).waitFor();
          assert.equal(await page.getByTestId("card-client-signup").count(), 1);
          assert.equal(await page.getByTestId("card-talent-signup").count(), 1);
        } else {
          await page.getByRole("heading", { name: role === "client" ? "Hire Talent" : "Find Work", exact: true }).waitFor();
        }
        assert.equal(new URL(page.url()).pathname, "/join-onspot");
        assert.match(await page.locator('[class*="backdrop-blur-"]').evaluate(el => getComputedStyle(el).backdropFilter), /blur/);
        assert.equal(await page.locator(".manifesto-headline").count(), 1);
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await overlay.waitFor({ state: "detached" });
        await page.waitForFunction(y => Math.abs(scrollY - y) <= 1, originalScroll);
      }
    } finally { await page.close(); }
  });
}

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
