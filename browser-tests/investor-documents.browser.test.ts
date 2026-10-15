import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page } from "playwright";

let vite: ViteDevServer;
let browser: Browser;
let base: string;
const cacheDir = mkdtempSync(join(tmpdir(), "investor-docs-vite-"));
before(async () => {
  vite = await createServer({
    configFile: false, root: resolve("client"), cacheDir,
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    optimizeDeps: {
      noDiscovery: true,
      include: ["react", "react-dom/client", "react/jsx-runtime", "@radix-ui/react-dialog",
        "@tanstack/react-query", "wouter", "lucide-react", "clsx", "tailwind-merge", "axios"],
    },
    plugins: [react(), {
      name: "investor-document-fixture",
      resolveId(id) { if (id === "/__investor-fixture.tsx") return id; },
      load(id) {
        if (id !== "/__investor-fixture.tsx") return;
        return `
          import React from 'react'; import {createRoot} from 'react-dom/client';
          import InvestorsCorner from '/src/pages/InvestorsCorner.tsx';
          import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
          import {InvestorGoalSettings} from '/src/components/InvestorGoalSettings.tsx';
          import '/src/index.css';
          const settings={investor_goal_contractors_2027:'{CONTRACTOR_GOAL}',investor_goal_clients_2027:'{CLIENT_GOAL}'};
          createRoot(document.getElementById('root')).render(location.pathname==='/settings'
            ? <QueryClientProvider client={new QueryClient()}><InvestorGoalSettings settings={settings}/></QueryClientProvider>
            : <InvestorsCorner/>);
        `;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === "/reference") {
            res.setHeader("Content-Type", "text/html");
            res.end(readFileSync("attached_assets/0_OnSpot_Investors_Page_1792064719023.html", "utf8"));
            return;
          }
          if (!req.headers.accept?.includes("text/html")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml("/", '<html><body><div id="root"></div><script type="module" src="/__investor-fixture.tsx"></script></body></html>'));
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  base = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`;
  browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"],
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => { await browser?.close(); await vite?.close(); rmSync(cacheDir, { recursive: true, force: true }); });

async function openPage(width = 1280, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
  await page.addInitScript(() => { (window as any).__name = (fn: unknown) => fn; });
  await page.goto(`${base}/investors`);
  await page.locator("h1").waitFor();
  return page;
}

test("direct URL, refresh, metadata, official logo and exact narrative match reference", async () => {
  const page = await openPage();
  await page.reload();
  await page.locator("h1").waitFor();
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.title(), "Invest in OnSpot — A Letter From Our CEO");
  assert.match((await page.locator('meta[name="description"]').getAttribute("content"))!, /A letter from Nur Laminero/);
  const logo = page.locator(".investor-top img");
  assert.equal(await logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), true);
  assert.equal(await page.locator(".investor-top a").getAttribute("href"), "/");
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const actual = normalize(await page.locator(".onspot-investors-page").innerText());
  const reference = await browser.newPage();
  await reference.goto(`${base}/reference`);
  const expected = await reference.locator("main").innerText();
  for (const line of expected.split("\n").map(normalize).filter(Boolean)) {
    assert.ok(actual.includes(line), `Missing reference text: ${line}`);
  }
  assert.match(actual, /you may lose your entire investment/);
  const wefunder = page.getByRole("link", { name: /WeFunder/ });
  assert.equal(await wefunder.getAttribute("href"), "https://wefunder.com/onspot");
  assert.equal(await wefunder.getAttribute("target"), "_blank");
  assert.match((await wefunder.getAttribute("rel"))!, /noopener/);
  assert.match((await wefunder.getAttribute("rel"))!, /noreferrer/);
  assert.equal(await page.locator("a[download]").count(), 0);
  await reference.close();
  await page.close();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`page and both request dialogs fit ${width}px with no horizontal overflow`, async () => {
    const page = await openPage(width, width === 320 ? 568 : 844);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const name of [/Meet the Founders/, /Seedscope/]) {
      const card = page.getByRole("button", { name });
      await card.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const layout = await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          width: innerWidth, height: innerHeight, bg: s.backgroundColor, color: s.color };
      });
      assert.ok(layout.left >= 0 && layout.right <= layout.width + 1, JSON.stringify(layout));
      assert.ok(layout.top >= 0 && layout.bottom <= layout.height + 1, JSON.stringify(layout));
      assert.equal(layout.bg, "rgb(255, 255, 255)");
      assert.notEqual(layout.color, layout.bg);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(el => el === document.activeElement, await card.elementHandle());
      assert.equal(await card.evaluate((el) => el === document.activeElement), true);
    }
    await page.close();
  });
}

test("validation and typing keep focus, and submit carries document provenance", async () => {
  const page = await openPage(390, 844);
  let submitted: unknown;
  await page.route("**/api/public/investor-document-requests", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: "test-lead", notificationStatus: "sent", documentAvailable: false } });
  });
  await page.getByRole("button", { name: /Meet the Founders/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Get the pitch deck", exact: true }).click();
  assert.equal(await dialog.locator('input[aria-invalid="true"]').count(), 2);
  const name = dialog.getByLabel("First name");
  await name.pressSequentially("Avery", { delay: 25 });
  assert.equal(await name.inputValue(), "Avery");
  assert.equal(await name.evaluate(el => el === document.activeElement), true);
  await dialog.getByLabel("Email", { exact: true }).fill("avery@example.org");
  await dialog.getByRole("button", { name: "Get the pitch deck", exact: true }).click();
  await dialog.getByRole("status").waitFor();
  assert.deepEqual(submitted, { firstName: "Avery", email: "avery@example.org", requestedDocument: "deck", source: "investors-page", website: "" });
  assert.match((await dialog.textContent())!, /request has been saved/);
  assert.match((await dialog.textContent())!, /not available yet/);
  assert.equal(await dialog.locator("a[download]").count(), 0);
  await page.close();
});

for (const outcome of ["notification-failed", "server-error", "network-error", "pending"] as const) {
  test(`valuation form honestly handles ${outcome}`, async () => {
    const page = await openPage();
    let release: (() => void) | undefined;
    await page.route("**/api/public/investor-document-requests", async (route) => {
      assert.equal(route.request().postDataJSON().requestedDocument, "valuation");
      if (outcome === "network-error") return route.abort();
      if (outcome === "pending") await new Promise<void>(resolve => { release = resolve; });
      return outcome === "server-error"
        ? route.fulfill({ status: 503, json: { error: "Request could not be saved. Please try again." } })
        : route.fulfill({ status: 201, json: { id: "test-lead", notificationStatus: "failed", documentAvailable: false } });
    });
    await page.getByRole("button", { name: /Seedscope/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("First name").fill("Avery");
    await dialog.getByLabel("Email", { exact: true }).fill("avery@example.org");
    await dialog.getByRole("button", { name: "Get the valuation summary", exact: true }).click();
    if (outcome === "pending") {
      const pending = dialog.getByRole("button", { name: "Saving request…" });
      await pending.waitFor();
      assert.equal(await pending.isDisabled(), true);
      release?.();
    }
    if (outcome === "server-error") {
      await dialog.getByRole("alert").waitFor();
      assert.equal(await dialog.getByRole("status").count(), 0);
    } else {
      await dialog.getByRole("status").waitFor();
      const content = await dialog.textContent();
      if (outcome === "network-error") assert.match(content!, /couldn’t confirm/);
      else assert.match(content!, /notification.*(not|couldn’t)/i);
    }
    await page.close();
  });
}

// The new approved letter replaces the old gauge-based public presentation.
// Preserve coverage of its still-existing administrative goal controls.
test("existing Platform Settings form saves positive goals and can clear them", async () => {
  const page = await browser.newPage();
  const saved: Record<string, string>[] = [];
  await page.route("**/api/admin/platform-settings", (route) => {
    saved.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true } });
  });
  await page.goto(`${base}/settings`);
  await page.locator("#investor_goal_contractors_2027").fill("12000");
  await page.locator("#investor_goal_clients_2027").fill("1500");
  await page.getByRole("button", { name: "Save Investor Goals" }).click();
  await page.waitForFunction(() => !(document.querySelector("button") as HTMLButtonElement)?.textContent?.includes("Saving"));
  assert.deepEqual(saved[0], { investor_goal_contractors_2027: "12000", investor_goal_clients_2027: "1500" });
  await page.locator("#investor_goal_clients_2027").fill("0");
  assert.equal(await page.getByRole("button", { name: "Save Investor Goals" }).isDisabled(), true);
  await page.locator("#investor_goal_clients_2027").fill("");
  await page.getByRole("button", { name: "Save Investor Goals" }).click();
  await page.waitForFunction(() => !(document.querySelector("button") as HTMLButtonElement)?.textContent?.includes("Saving"));
  assert.equal(saved[1].investor_goal_clients_2027, "");
  await page.close();
});
