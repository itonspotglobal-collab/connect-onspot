import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { assertDesktopLayout, compareScreenshots } from "./manifesto-visual.helpers";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const REFERENCE = "attached_assets/manifesto_final_mockup_1790834956585.html";
const PINNED_HEADLINE_FONT = "client/public/fonts/manifesto-inter-reference-600.woff2";
let browser: Browser;
let vite: ChildProcess | undefined;
let referenceHtml: string;

// Test-only copies of the approved Google font faces, served to BOTH documents
// through the existing font stylesheet request (not injected into product CSS).
// The product's isolated "Manifesto Inter" face still loads from its real URL.
const fontCss = [
  ["Inter", 400, "inter-400.ttf"],
  ["Inter", 500, "inter-500.ttf"],
  ["Inter", 600, "inter-reference-600.woff2"],
  ["Caveat", 600, "caveat-600.ttf"],
].map(([family, weight, file]) => `@font-face {
  font-family: '${family}'; font-style: normal; font-weight: ${weight};
  src: url('${BASE_URL}/__manifesto-fonts/${file}');
}`).join("\n");

before(async () => {
  // Never aim this suite at a deployed host, even via BROWSER_BASE_URL.
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(BASE_URL).hostname),
    "Manifesto tests must use a loopback frontend only, never production");
  referenceHtml = await readFile(REFERENCE, "utf8");
  const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
  assert.equal(hash(referenceHtml), "8968e5bb6921c6803fede86eee768ee73b91b6345acb75f9e325ebcb5c075e55",
    "Approved reference changed; do not silently rebaseline");
  assert.equal(hash(await readFile(PINNED_HEADLINE_FONT)), "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62",
    "Approved synthetic-heavy Inter face changed");
  if (!process.env.BROWSER_BASE_URL) {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
    delete env.REPL_ID; // Isolated Vite only; never npm run dev (predev migrates).
    vite = spawn(process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
      { stdio: "pipe", env });
    vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (vite.exitCode !== null) throw new Error(`Vite exited: ${vite.exitCode}`);
      try { if ((await fetch(BASE_URL)).ok) { ready = true; break; } } catch { /* starting */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Frontend did not start at ${BASE_URL}`);
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([once(vite, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
});

async function newPage(width: number, reference = false): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height: 900 }, deviceScaleFactor: 1, colorScheme: "light",
    reducedMotion: "reduce", serviceWorkers: "block",
  });
  // tsx/esbuild preserves nested function names with __name; Playwright
  // serializes evaluate callbacks without that module-scoped helper.
  await context.addInitScript("window.__name = (fn) => fn;");
  const page = await context.newPage();
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.hostname === "fonts.googleapis.com") {
      return route.fulfill({ contentType: "text/css", body: fontCss });
    }
    if (url.pathname.startsWith("/__manifesto-fonts/")) {
      const file = url.pathname.split("/").pop()!;
      assert.ok(["inter-400.ttf", "inter-500.ttf", "inter-reference-600.woff2", "caveat-600.ttf"].includes(file));
      return route.fulfill({
        contentType: file.endsWith("woff2") ? "font/woff2" : "font/ttf",
        body: await readFile(file === "inter-reference-600.woff2"
          ? PINNED_HEADLINE_FONT : `browser-tests/fixtures/manifesto/${file}`),
      });
    }
    if (url.origin !== new URL(BASE_URL).origin) return route.abort();
    if (url.pathname === "/__manifesto-reference") {
      return route.fulfill({ contentType: "text/html", body: referenceHtml });
    }
    return route.continue();
  });
  await page.goto(`${BASE_URL}${reference ? "/__manifesto-reference" : "/manifesto"}`);
  await page.locator(reference ? ".headline" : ".manifesto-headline").waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  return page;
}

async function assertInvariants(page: Page, mobile = false) {
  const state = await page.evaluate(() => {
    const select = (selector: string) => document.querySelector<HTMLElement>(selector)!;
    const wrap = select(".manifesto-wrap");
    const title = select(".manifesto-headline");
    const rows = [...title.children].map((el) => el.getBoundingClientRect());
    const leaves = [...document.querySelectorAll(".manifesto-page *")]
      .filter((el) => el.children.length === 0 && el.textContent?.trim());
    const closing = select(".manifesto-closing");
    const divider = select(".manifesto-divider");
    return {
      width: wrap.getBoundingClientRect().width,
      padding: getComputedStyle(wrap).padding,
      background: getComputedStyle(select(".manifesto-page")).backgroundColor,
      closingBackground: getComputedStyle(closing).backgroundColor,
      closingDirection: getComputedStyle(closing).flexDirection,
      overlap: rows[0].bottom - rows[1].top,
      titleFont: getComputedStyle(title).fontFamily,
      scriptLines: leaves.filter((el) => getComputedStyle(el).fontFamily.includes("Caveat"))
        .map((el) => el.textContent!.trim()),
      fontsLoaded: document.fonts.check('600 30px Caveat')
        && document.fonts.check('600 92px "Manifesto Inter"'),
      divider: [divider.offsetWidth, divider.offsetHeight, getComputedStyle(divider).backgroundImage],
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      fixedElements: [...document.querySelectorAll("body *")].filter((el) => {
        const css = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        // Radix keeps an empty, transparent toast viewport mounted globally.
        // It paints nothing; an actual toast inside it must still fail.
        if (el.matches('ol[tabindex="-1"]') && el.children.length === 0
          && !el.textContent?.trim() && css.backgroundColor === "rgba(0, 0, 0, 0)"
          && css.boxShadow === "none" && css.borderWidth === "0px") return false;
        return ["fixed", "sticky"].includes(css.position)
          && css.visibility !== "hidden" && css.display !== "none" && rect.width > 0 && rect.height > 0;
      }).map((el) => el.outerHTML.slice(0, 200)),
    };
  });
  assert.equal(state.background, "rgb(10, 15, 46)");
  assert.equal(state.closingBackground, "rgb(18, 24, 63)");
  assert.equal(state.width, mobile ? page.viewportSize()!.width : 760);
  assert.equal(state.padding, "120px 32px 0px");
  assert.ok(state.overlap > 0, "Headline rows must overlap, not sit on separate non-overlapping lines");
  assert.match(state.titleFont, /Manifesto Inter/);
  assert.equal(state.fontsLoaded, true, "Approved fonts must finish loading, not fall back");
  assert.deepEqual(state.scriptLines, ["We don't accept that.", "Work Without Limits."]);
  assert.equal(state.closingDirection, mobile ? "column" : "row");
  assert.deepEqual(state.divider, [48, 2,
    "linear-gradient(90deg, rgb(245, 166, 35) 0px, rgb(245, 166, 35) 8px, rgb(111, 114, 160) 8px, rgb(111, 114, 160) 100%)"]);
  assert.equal(state.overflow, false, "Page must not overflow horizontally");
  assert.deepEqual(state.fixedElements, [], "No navigation/chat/floating overlay");
  assert.equal(await page.locator("nav:visible, header:visible, footer:visible").count(), 0);
  assert.equal(await page.getByTestId("button-open-vanessa-global").count(), 0);
}

for (const width of [1280, 1440]) {
  test(`Manifesto matches the approved full-page reference at ${width}px`, async () => {
    const app = await newPage(width);
    const reference = await newPage(width, true);
    try {
      await assertInvariants(app);
      // The ONLY approved desktop difference: first 8x2 pixels of the divider
      // are gold. Apply that exact accent to the rendered reference; no masks.
      await reference.addStyleTag({ content:
        ".divider { background: linear-gradient(90deg, #F5A623 0 8px, #6F72A0 8px 100%); }",
      });
      await assertDesktopLayout(app, reference);
      await compareScreenshots(app,
        await reference.screenshot({ fullPage: true, animations: "disabled" }),
        await app.screenshot({ fullPage: true, animations: "disabled" }),
        `desktop-${width}`);
    } finally {
      await Promise.all([app.context().close(), reference.context().close()]);
    }
  });
}

test("Manifesto remains standalone and readable on mobile; closing panel intentionally stacks", async () => {
  for (const width of [320, 375, 390, 600]) {
    const page = await newPage(width);
    try {
      await assertInvariants(page, true);
      const copy = await page.locator(".manifesto-closing-copy").boundingBox();
      const link = await page.locator(".manifesto-closing-link").boundingBox();
      assert.ok(copy && link && link.y >= copy.y + copy.height + 23,
        "Mobile closing link must stack below copy with its 24px gap");
      for (const box of [copy!, link!]) {
        assert.ok(box.x >= 0 && box.x + box.width <= width, "Closing content stays within viewport");
      }
    } finally { await page.context().close(); }
  }
});

test("Both Manifesto About links navigate to the real About route", async () => {
  const page = await newPage(1280);
  try {
    for (const selector of [".manifesto-about-link", ".manifesto-closing-link"]) {
      const link = page.locator(selector);
      assert.equal(await link.getAttribute("href"), "/why-onspot/about");
      await link.click();
      await page.waitForURL(`${BASE_URL}/why-onspot/about`);
      await page.getByRole("heading", { name: "Built by people who lived the problem.", exact: true }).waitFor();
      assert.equal(await page.locator(".manifesto-page").count(), 0);
      await page.goto(`${BASE_URL}/manifesto`);
      await page.locator(".manifesto-headline").waitFor();
    }
  } finally { await page.context().close(); }
});

test("The layout guard rejects representative unapproved design drift", async () => {
  const app = await newPage(1280);
  const reference = await newPage(1280, true);
  try {
    await reference.addStyleTag({ content:
      ".divider { background: linear-gradient(90deg, #F5A623 0 8px, #6F72A0 8px 100%); }",
    });
    for (const [css, reason] of [
      [".manifesto-page { background: white !important; }", /rgb/],
      [".manifesto-closing { background: white !important; }", /rgb/],
      [".manifesto-headline-row:last-child { margin-top: 0 !important; }", /overlap/],
      [".manifesto-wrap { max-width: 900px !important; }", /760/],
      [".manifesto-copy { font-family: Caveat !important; }", /deep-equal/],
      [".manifesto-divider { background: #6F72A0 !important; }", /linear-gradient/],
    ] as Array<[string, RegExp]>) {
      const style = await app.addStyleTag({ content: css });
      await app.evaluate(() => new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      try { await assert.rejects(() => assertInvariants(app), reason); }
      finally {
        await style.evaluate((el) => el.parentNode?.removeChild(el));
        // Chromium applies stylesheet invalidation on the next rendering turn.
        await app.evaluate(() => new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      }
    }
    const spacing = await app.addStyleTag({ content:
      ".manifesto-copy { margin-bottom: 40px !important; }",
    });
    await app.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    try {
      await assert.rejects(() => assertDesktopLayout(app, reference), /section .*?(axis|typography\/spacing\/color)/);
    } finally { await spacing.evaluate((el) => el.parentNode?.removeChild(el)); }
    await app.evaluate(() => {
      const overlay = document.createElement("button");
      overlay.id = "unapproved-test-overlay";
      overlay.textContent = "Chat";
      overlay.style.cssText = "position:fixed;right:0;bottom:0;width:64px;height:64px";
      document.body.append(overlay);
    });
    await assert.rejects(() => assertInvariants(app), /floating overlay/);
  } finally {
    await Promise.all([app.context().close(), reference.context().close()]);
  }
});