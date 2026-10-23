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
    configFile: false, root: resolve("client"), publicDir: resolve("public"), cacheDir,
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
          import WhyOnSpotAbout from '/src/pages/WhyOnSpotAbout.tsx';
          import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
          import {InvestorGoalSettings} from '/src/components/InvestorGoalSettings.tsx';
          import '/src/index.css';
          const settings={investor_goal_contractors_2027:'{CONTRACTOR_GOAL}',investor_goal_clients_2027:'{CLIENT_GOAL}'};
          createRoot(document.getElementById('root')).render(location.pathname==='/settings'
            ? <QueryClientProvider client={new QueryClient()}><InvestorGoalSettings settings={settings}/></QueryClientProvider>
            : <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
                {location.pathname==='/why-onspot/about' ? <WhyOnSpotAbout/> : <InvestorsCorner/>}
              </QueryClientProvider>);
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

async function openPage(width = 1280, height = 900, statsHandler?: Parameters<Page["route"]>[1], clock = false) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
  if (clock) await page.clock.install();
  await page.bringToFront();
  await page.addInitScript(() => { (window as any).__name = (fn: unknown) => fn; });
  await page.route("**/api/public/investor-stats", statsHandler ?? (route =>
    route.fulfill({ json: { contractorAccounts: 1234, clientAccounts: 56, asOf: "2026-10-16T08:00:00.000Z" } })));
  await page.goto(`${base}/investors`);
  await page.locator("h1").waitFor();
  return page;
}

test("direct URL, refreshed content and unchanged reference narrative preserve investment links", async () => {
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
  const headline = "OnSpot is the unified outsourcing system where businesses find, hire, pay, and manage vetted remote talent in one place — and talent earns more doing it.";
  assert.equal(normalize(await page.locator("h1").innerText()), headline);
  assert.equal(actual.split(headline).length - 1, 1);
  assert.doesNotMatch(await page.locator(".investor-open").innerText(), /Hi, I.m Nur Laminero/);
  assert.equal(normalize(await page.locator(".investor-fact").first().innerText()),
    "7 days As fast as 7 days for businesses to find, hire, and to start global talent");
  const letter = page.locator(".investor-letter p").filter({ hasText: "We spent four years running a BPO" });
  assert.equal(normalize(await letter.innerText()),
    "We spent four years running a BPO before building this platform. We did not guess at the problem. We lived inside it — and we built OnSpot from operational truth rather than theory. We are already self-sustaining. Operations are fully covered by revenue before a single dollar of external investment.");
  assert.deepEqual(await letter.locator("strong").allTextContents().then(values => values.map(normalize)),
    ["We did not guess at the problem. We lived inside it", "We are already self-sustaining."]);
  assert.equal(normalize(await page.locator("#investor-invest-title").innerText()), "Invest in the Future of Work today.");
  assert.ok(await page.locator("#investor-invest-title strong, #investor-invest-title em, #investor-invest-title span").filter({ hasText: "Future of Work" }).count());
  const reference = await browser.newPage();
  await reference.goto(`${base}/reference`);
  const expected = await reference.locator("main").innerText();
  for (const line of expected.split("\n").map(normalize).filter(Boolean)) {
    // The approved update supersedes these reference passages only.
    if (line === "A letter from Nur Laminero" ||
      /^(Hi, I.m Nur Laminero|We.re the unified outsourcing|As fast as 7 days|My co-founders Jake|Invest in OnSpot today|Co-Founder and CEO)/.test(line) ||
      ["NL", "J", "M", "Macky"].includes(line)) continue;
    assert.ok(actual.includes(line), `Missing reference text: ${line}`);
  }
  assert.equal(await page.locator("#investor-letter-title").innerText(), "A letter from the founders.");
  assert.equal(await page.locator(".investor-footer p").innerText(),
    "© 2026 OnSpot. All rights reserved. This page is for information only and is not an offer to sell securities.");
  assert.doesNotMatch(actual, /you may lose your entire investment|© 2026 OnSpot Global/);
  const founders = page.locator(".investor-signatures");
  assert.match(await founders.innerText(), /Nur Laminero/);
  assert.match(await founders.innerText(), /Jake Wainberg/);
  assert.match(await founders.innerText(), /Mark Apostol/);
  assert.deepEqual(await founders.locator(".investor-sign b").allTextContents(), ["Nur Laminero", "Jake Wainberg", "Mark Apostol"]);
  assert.deepEqual(await founders.locator(".investor-sign span").allTextContents(), ["Co-Founder & CEO", "Co-Founder & President", "Co-Founder & COO"]);
  assert.equal(await founders.locator("img").count(), 3);
  for (const image of await founders.locator("img").all()) {
    assert.ok(await image.getAttribute("alt"));
    await image.evaluate((el: HTMLImageElement) => el.decode());
    assert.ok(await image.evaluate((el: HTMLImageElement) => el.naturalWidth > 0));
  }
  const phone = page.locator(".investor-open img");
  assert.equal(await phone.count(), 1);
  await phone.evaluate((el: HTMLImageElement) => el.decode());
  assert.ok(await phone.evaluate((el: HTMLImageElement) => el.naturalWidth > 0));
  const wefunder = page.getByRole("link", { name: /WeFunder/ });
  assert.equal(await wefunder.getAttribute("href"), "https://wefunder.com/onspot");
  assert.equal(await wefunder.getAttribute("target"), "_blank");
  assert.match((await wefunder.getAttribute("rel"))!, /noopener/);
  assert.match((await wefunder.getAttribute("rel"))!, /noreferrer/);
  assert.equal(await page.locator("a[download]").count(), 0);
  await reference.close();
  await page.close();
});

test("traction refresh behavior is preserved and page and portaled dialog use homepage Inter", async () => {
  let loads = 0;
  const page = await openPage(1280, 900, route => {
    loads++;
    return route.fulfill({ json: {
      contractorAccounts: loads === 1 ? 1234 : 1235,
      clientAccounts: loads === 1 ? 56 : 55,
      asOf: "2026-10-16T08:00:00.000Z",
    } });
  }, true);
  await page.getByText("1,234", { exact: true }).waitFor();
  assert.equal(await page.locator(".investor-traction-card b").allTextContents().then(v => v.join("|")), "1,234|56");
  await page.clock.fastForward(60_001);
  await page.getByText("1,235", { exact: true }).waitFor();
  assert.deepEqual(await page.locator(".investor-traction-card b").allTextContents(), ["1,235", "55"]);
  await page.getByRole("button", { name: /Meet the Founders/ }).click();
  for (const selector of [".onspot-investors-page h1", ".investor-traction-card b",
    ".investor-footer p", ".investor-request-dialog input", ".investor-request-dialog button"]) {
    const font = await page.locator(selector).first().evaluate(el => getComputedStyle(el).fontFamily);
    assert.match(font, /Inter/);
    assert.doesNotMatch(font, /Mont/);
  }
  await page.close();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Founding Team has five honest profiles in order and fits ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(10_000);
    await page.addInitScript(() => { (window as any).__name = (fn: unknown) => fn; });
    await page.goto(`${base}/why-onspot/about#team`);
    const team = page.locator("#team");
    const names = team.locator(".about-grid-leaders > div > div:last-child > p:first-child");
    await names.first().waitFor();
    assert.deepEqual((await names.allTextContents()).map(name => name.replace(" (Emman)", "")),
      ["Nur Laminero", "Jake Wainberg", "Mark Apostol", "Val Legaspi", "Emmanuel Rogel"]);
    assert.doesNotMatch(await team.innerText(), /Leadership/);
    assert.ok(await page.getByRole("button", { name: "Founding Team", exact: true, includeHidden: true }).count());
    const cards = team.locator(".about-grid-leaders > div");
    assert.equal(await cards.count(), 5);
    for (const index of [3, 4]) {
      assert.match(await cards.nth(index).innerText(), /pending approval/i);
      assert.doesNotMatch(await cards.nth(index).innerText(), /Co-Founder|CEO|COO|President|years of|years in/);
    }
    assert.match(await cards.nth(4).innerText(), /photo.*pending|pending.*photo/i);
    assert.equal(await cards.nth(4).locator("img").count(), 0);
    assert.equal(await team.locator("img").count(), 4);
    for (const image of await team.locator("img").all()) {
      assert.ok(await image.getAttribute("alt"));
      await image.evaluate((el: HTMLImageElement) => el.decode());
      assert.ok(await image.evaluate((el: HTMLImageElement) => el.naturalWidth > 0));
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const card of await cards.all()) {
      const bounds = await card.boundingBox();
      assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
    }
    if (width === 390 || width === 1440) {
      await team.screenshot({ path: `/tmp/onspot-founding-team-${width}.png`, animations: "disabled" });
    }
    await page.close();
  });
}

test("traction loading and unavailable states never fabricate zero and can retry", async () => {
  let release: (() => void) | undefined;
  let calls = 0;
  const page = await openPage(390, 844, async route => {
    calls++;
    if (calls === 1) await new Promise<void>(resolve => { release = resolve; });
    return calls === 1
      ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: { contractorAccounts: 0, clientAccounts: 7, asOf: "2026-10-16T08:00:00.000Z" } });
  });
  await page.locator(".investor-traction-loading").first().waitFor();
  assert.equal(await page.locator(".investor-traction-card b").count(), 0);
  release?.();
  await page.locator(".investor-traction-unavailable").waitFor();
  assert.equal(await page.locator(".investor-traction-card b").count(), 0);
  await page.locator(".investor-traction-unavailable button").click();
  await page.locator(".investor-traction-card b").first().waitFor();
  assert.deepEqual(await page.locator(".investor-traction-card b").allTextContents(), ["0", "7"]);
  await page.close();
});

test("invalid aggregate responses are unavailable rather than plausible numbers", async () => {
  const page = await openPage(1280, 900, route => route.fulfill({
    json: { contractorAccounts: -1, clientAccounts: 99, asOf: "not-a-date" },
  }));
  await page.locator(".investor-traction-unavailable").waitFor();
  assert.equal(await page.locator(".investor-traction-card b").count(), 0);
  await page.close();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`page and both request dialogs fit ${width}px with no horizontal overflow`, async () => {
    const page = await openPage(width, width === 320 ? 568 : 844);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 390 || width === 1440) {
      await page.locator(".investor-open img").evaluate((el: HTMLImageElement) => el.decode());
      await page.locator(".investor-open").screenshot({ path: `/tmp/onspot-investor-hero-${width}.png`, animations: "disabled" });
    }
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
