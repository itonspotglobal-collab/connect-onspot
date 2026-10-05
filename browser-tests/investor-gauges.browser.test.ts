import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page } from "playwright";

let vite: ViteDevServer;
let browser: Browser;
let base: string;
const cacheDir = mkdtempSync(join(tmpdir(), "investor-gauge-vite-"));
before(async () => {
  vite = await createServer({
    configFile: false, root: resolve("client"), cacheDir,
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    optimizeDeps: { entries: ["src/pages/InvestorsCorner.tsx", "src/components/InvestorGoalSettings.tsx"] },
    plugins: [react(), {
      name: "investor-fixture",
      resolveId(id) { if (id === "/__investor-fixture.tsx") return id; },
      load(id) {
        if (id !== "/__investor-fixture.tsx") return;
        return `
          import React from 'react'; import {createRoot} from 'react-dom/client';
          import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
          import InvestorsCorner from '/src/pages/InvestorsCorner.tsx';
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
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => { await browser?.close(); await vite?.close(); rmSync(cacheDir, { recursive: true, force: true }); });

async function pageWithData(reducedMotion: "reduce" | "no-preference" = "reduce") {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion });
  const state = { contractors: 1234, clients: 234, contractorGoal: 2500 as number | null, clientGoal: 500 as number | null, goalsFail: false, statsRequests: 0 };
  await page.route("**/api/public/investor-stats", (route) => {
    state.statsRequests++;
    return route.fulfill({ json: { contractorAccounts: state.contractors, clientAccounts: state.clients, asOf: new Date().toISOString() } });
  });
  await page.route("**/api/public/investor-goals", (route) => route.fulfill(state.goalsFail
    ? { status: 503, json: { error: "Unavailable" } }
    : { json: { contractorGoal2027: state.contractorGoal, clientGoal2027: state.clientGoal } }));
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.valueOf() + 100));
  return { page, state };
}
const gauge = (page: Page) => page.locator(".investor-gauge").first();
async function offset(page: Page) {
  return Number(await gauge(page).locator(".investor-gauge-fill").getAttribute("stroke-dashoffset"));
}

test("reduced motion renders final count/arc, accessible real values and caps at100%", async () => {
  const { page, state } = await pageWithData();
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    (window as any).__rafCalls = 0;
    window.requestAnimationFrame = (callback) => {
      (window as any).__rafCalls++;
      return original(callback);
    };
  });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "1,234");
  assert.match(await gauge(page).getAttribute("aria-label") ?? "", /1,234.*2,500/);
  assert.ok(Math.abs(await offset(page) - 2 * Math.PI * 136 * (1 - 1234 / 2500)) < .01);
  const progressbar = gauge(page).getByRole("progressbar");
  assert.equal(await progressbar.getAttribute("aria-valuenow"), "1234");
  assert.equal(await progressbar.getAttribute("aria-valuemax"), "2500");
  assert.match(await progressbar.getAttribute("aria-valuetext") ?? "", /1,234.*2,500/);
  state.contractors = 6000;
  await page.clock.fastForward(60_000);
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "6,000");
  assert.equal(await offset(page), 0);
  assert.match(await gauge(page).getAttribute("aria-label") ?? "", /6,000/);
  assert.equal(await progressbar.getAttribute("aria-valuenow"), "2500");
  assert.match(await progressbar.getAttribute("aria-valuetext") ?? "", /6,000.*2,500/);
  assert.equal(await page.evaluate(() => (window as any).__rafCalls), 0);
  assert.equal(await page.locator(".investors-intro").evaluate((element) => getComputedStyle(element).animationName), "none");
  await page.close();
});

test("owner targets show exact small progress, independent start dots, account labels and formatted goals", async () => {
  const { page, state } = await pageWithData();
  state.contractors = 98; state.clients = 8;
  state.contractorGoal = 10000; state.clientGoal = 5000;
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "98");
  const gauges = page.locator(".investor-gauge");
  for (const [index, count, goal] of [[0, 98, 10000], [1, 8, 5000]]) {
    const element = gauges.nth(index);
    const actualOffset = Number(await element.locator(".investor-gauge-fill").getAttribute("stroke-dashoffset"));
    assert.ok(Math.abs(actualOffset - 2 * Math.PI * 136 * (1 - count / goal)) < .00001);
    const dot = element.locator(".investor-gauge-marker");
    assert.equal(await dot.count(), 1);
    assert.equal(await dot.getAttribute("cx"), "286");
    assert.equal(await dot.getAttribute("cy"), "150");
    assert.equal(await dot.evaluate((el) => getComputedStyle(el).fill), "rgb(255, 192, 82)");
    const bar = element.getByRole("progressbar");
    assert.equal(await bar.getAttribute("aria-valuenow"), String(count));
    assert.equal(await bar.getAttribute("aria-valuemax"), String(goal));
  }
  assert.deepEqual(await page.locator(".investor-gauge-label").allTextContents(), ["Contractor accounts", "Client accounts"]);
  assert.deepEqual(await page.locator(".investor-gauge-goal").allTextContents(), ["Goal for 2027: 10,000", "Goal for 2027: 5,000"]);
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "98");
    const size = await gauges.first().locator(".investor-gauge-count").evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    assert.ok(size >= 64 && size <= 88, `Desktop count is ${size}px at ${width}px`);
    const diameter = await gauges.first().locator(".investor-gauge-visual").evaluate((el) => el.getBoundingClientRect().width);
    assert.ok(diameter >= 200 && diameter <= 240, `Desktop gauge is ${diameter}px at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Use a fresh mobile render: the frozen browser clock can retain viewport-unit
  // computed values from the desktop render during a device-metrics resize.
  await page.reload();
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "98");
  const mobileLayout = await page.evaluate(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    columns: getComputedStyle(document.querySelector(".investors-counts")!).gridTemplateColumns,
    boxes: [...document.querySelectorAll("html,body,#root,.investors-page,.investors-shell,.investors-intro,.investors-counts,.investor-gauge-visual,.investor-gauge-ring")].map((el) => {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { tag: el.tagName, class: el.getAttribute("class"), x: box.x, y: box.y, width: box.width,
        height: box.height, scrollWidth: el.scrollWidth, transform: style.transform, padding: style.padding };
    }),
    overflowing: [...document.querySelectorAll("*")].map((el) => {
      const box = el.getBoundingClientRect();
      return { tag: el.tagName, class: el.getAttribute("class"), x: box.x, width: box.width, right: box.right };
    }).filter((box) => box.right > innerWidth + 1 || box.x < -1).slice(0, 15),
  }));
  assert.ok(mobileLayout.scrollWidth <= mobileLayout.viewport, JSON.stringify(mobileLayout));
  const boxes = await gauges.evaluateAll((elements) => elements.map((el) => {
    const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, bottom: box.bottom };
  }));
  assert.ok(boxes[0].y === boxes[1].y || boxes[1].y >= boxes[0].bottom, "Mobile gauges must be side-by-side or safely stacked");
  const mobileDiameter = await gauges.first().locator(".investor-gauge-track").evaluate((el) => el.getBoundingClientRect().width);
  assert.ok(mobileDiameter >= 135 && mobileDiameter <= 150, `Mobile gauge is ${mobileDiameter}px`);
  const order = await page.evaluate(() =>
    [".investor-headline", ".investors-counts", ".investor-tagline", ".investor-raise", ".investor-actions", ".investors-phone-column"]
      .map((selector) => document.querySelector(selector)!.getBoundingClientRect().top));
  assert.ok(order.every((top, i) => i === 0 || top >= order[i - 1]), `Mobile order: ${order}`);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.reload();
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "98");
  const narrowBoxes = await gauges.evaluateAll((elements) => elements.map((el) => {
    const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, bottom: box.bottom };
  }));
  assert.equal(narrowBoxes[0].x, narrowBoxes[1].x);
  assert.ok(narrowBoxes[1].y >= narrowBoxes[0].bottom);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.close();
});

test("missing goals or failed goal fetch show counts only; mobile fits without overflow", async () => {
  const { page, state } = await pageWithData();
  state.contractorGoal = null; state.clientGoal = null;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "1,234");
  assert.equal(await page.locator(".investor-gauge-ring,.investor-gauge-goal").count(), 0);
  const boxes = await page.locator(".investor-gauge").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, bottom: rect.bottom };
  }));
  assert.ok(boxes[0].y === boxes[1].y || boxes[1].y >= boxes[0].bottom);
  const labelGap = await gauge(page).evaluate((element) => {
    const number = element.querySelector(".investor-gauge-count")!.getBoundingClientRect();
    const label = element.querySelector(".investor-gauge-label")!.getBoundingClientRect();
    return label.top - number.bottom;
  });
  assert.ok(labelGap <= 24, `Count-only labels must not reserve the missing ring's space: ${labelGap}px`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  state.goalsFail = true;
  await page.reload();
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "1,234");
  assert.equal(await page.locator(".investor-gauge-ring").count(), 0);
  await page.close();
});

test("load,60s refresh and goal-only refresh animate from current values; preference changes finish immediately", async () => {
  const { page, state } = await pageWithData("no-preference");
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".investor-gauge-ring") !== null);
  await page.clock.runFor(1600);
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "1,234");
  const initialOffset = await offset(page);
  state.contractors = 1800;
  await page.clock.fastForward(60_000);
  await page.waitForFunction(() => document.querySelector(".investor-gauge")?.getAttribute("aria-label")?.includes("1,800"));
  const before = Number((await gauge(page).locator(".investor-gauge-count").textContent())?.replace(/,/g, ""));
  assert.ok(before >= 1234 && before <= 1800);
  await page.clock.runFor(1600);
  assert.equal(await gauge(page).locator(".investor-gauge-count").textContent(), "1,800");
  assert.ok(await offset(page) < initialOffset);
  const previous = await offset(page);
  state.contractorGoal = 5000;
  await page.clock.fastForward(60_000);
  await page.waitForFunction(() => document.querySelector(".investor-gauge")?.getAttribute("aria-label")?.includes("5,000"));
  assert.ok(Math.abs(await offset(page) - previous) < 2);
  await page.clock.runFor(1600);
  assert.ok(await offset(page) > previous);
  state.contractors = 2100;
  await page.clock.fastForward(60_000);
  await page.waitForFunction(() => document.querySelector(".investor-gauge")?.getAttribute("aria-label")?.includes("2,100"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "2,100");
  assert.ok(Math.abs(await offset(page) - 2 * Math.PI * 136 * (1 - 2100 / 5000)) < .01);
  assert.ok(state.statsRequests >= 4);
  await page.close();
});

test("all three CTAs share a treatment and still select their original request type", async () => {
  const { page } = await pageWithData();
  await page.goto(base);
  const actions = page.locator(".investor-actions button");
  await actions.first().waitFor();
  assert.equal(await actions.count(), 3);
  const styles = await actions.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element); return [element.className, style.backgroundColor, style.border, style.fontWeight];
  }));
  assert.deepEqual(styles[0], styles[1]); assert.deepEqual(styles[1], styles[2]);
  for (const [index, type] of ["meeting", "deck", "founder"].entries()) {
    await actions.nth(index).click();
    assert.equal(await page.locator("#investor-request-type").inputValue(), type);
    await page.keyboard.press("Escape");
  }
  await page.close();
});

test("Investors typography and primary pills match Home while the pitch headline and tagline supersede the old subhead", async () => {
  const { page } = await pageWithData();
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".investor-gauge-count")?.textContent === "1,234");
  const styles = await page.evaluate(() => {
    const [headline, count, label, goal, button] = [
      "#investor-headline", ".investor-gauge-count", ".investor-gauge-label",
      ".investor-gauge-goal", ".investor-actions button",
    ].map((selector) => {
      const computed = getComputedStyle(document.querySelector(selector)!);
      return { fontFamily: computed.fontFamily, fontWeight: computed.fontWeight,
        fontSize: computed.fontSize, lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing, color: computed.color,
        background: computed.backgroundColor, height: computed.height,
        borderRadius: computed.borderRadius, padding: computed.padding };
    });
    return { headline, count, label, goal, button };
  });
  assert.equal(styles.headline.fontFamily, "Inter, -apple-system, BlinkMacSystemFont, sans-serif");
  assert.equal(styles.headline.fontWeight, "700");
  assert.ok(Math.abs(Number.parseFloat(styles.headline.letterSpacing) / Number.parseFloat(styles.headline.fontSize) + .03) < .0001);
  for (const element of [styles.count, styles.label, styles.goal, styles.button]) {
    assert.equal(element.fontFamily, styles.headline.fontFamily);
  }
  assert.equal(styles.button.background, "rgb(255, 255, 255)");
  assert.equal(styles.button.color, "rgb(75, 81, 184)");
  assert.equal(styles.button.fontWeight, "600");
  assert.equal(styles.button.fontSize, "15.5px");
  assert.equal(styles.button.lineHeight, "23.25px");
  assert.equal(styles.button.height, "52px");
  assert.equal(styles.button.borderRadius, "9999px");
  assert.equal(styles.button.padding, "0px 32px");
  const gold = page.locator(".investor-headline-secondary");
  assert.equal(await gold.count(), 1);
  assert.equal((await gold.textContent())?.trim(), "We are not watching. We built the replacement.");
  assert.equal(await gold.evaluate((element) => getComputedStyle(element).color), "rgb(255, 192, 82)");
  assert.equal((await page.locator(".investor-headline-primary").textContent())?.trim(), "The outsourcing industry is being replaced.");
  assert.equal(await page.locator(".investors-subhead,.investors-eyebrow").count(), 0);
  assert.match((await page.locator(".investor-tagline").textContent())?.trim() ?? "", /^Work Without Limits$/i);
  assert.equal(await page.locator(".investor-tagline").getAttribute("aria-label"), "Work Without Limits");
  const accent = page.locator(".investor-tagline-accent");
  assert.equal(await accent.textContent(), "WITHOUT");
  assert.equal(await accent.evaluate((el) => getComputedStyle(el).color), "rgb(255, 192, 82)");
  assert.match(await accent.evaluate((el) => getComputedStyle(el).fontFamily), /Permanent Marker/);
  assert.equal(await page.getByAltText("OnSpot mobile About page: Built by people who lived the problem").count(), 1);
  assert.doesNotMatch(await page.locator(".investors-page").innerText(), /nur@|jake@|Contacts:/i);
  await page.close();
});

test("existing Platform Settings form saves positive goals and can clear them", async () => {
  const page = await browser.newPage();
  const saved: any[] = [];
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
  await page.waitForTimeout(150);
  assert.equal(saved[1].investor_goal_clients_2027, "");
  await page.close();
});
