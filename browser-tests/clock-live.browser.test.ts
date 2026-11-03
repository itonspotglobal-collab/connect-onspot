import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page } from "playwright";
import { query, initializeFixture, closeFixture, registerRoutes } from "../server/tests/fixtures/timesheetServer";

// Real isolated PostgreSQL + real production Clock/Timesheet routes/components.
// Only unrelated account/navigation requests are stubbed; no clock/time data is mocked.
let api: Awaited<ReturnType<typeof registerRoutes>>;
let vite: ViteDevServer;
let browser: Browser;
let cache: string;
let apiBase: string;
let appBase: string;
let contract: string;
let period: string;
const signedToken = (role: string) => jwt.sign({ userId: `live-${role}`, role },
  process.env.JWT_SECRET || "fixture-only", { expiresIn: "1h" });
async function makePage(role: "talent" | "client") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", timezoneId: "America/New_York" });
  await context.addInitScript(({ role, token }) => {
    localStorage.setItem("onspot_jwt_token", token);
    localStorage.setItem("onspot_user", JSON.stringify({
      id: `live-${role}`, email: `${role}@fixture.test`, role, first_name: "Fixture", last_name: role,
    }));
    localStorage.setItem(`onboarding_completed_live-${role}`, "true");
  }, { role, token: signedToken(role) });
  const page = await context.newPage();
  page.on("pageerror", error => console.error("Clock fixture browser error:", error));
  const attendanceWrites: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/talent/clock") || url.pathname.startsWith(`/api/${role}/timesheets`)
      || (role === "client" && url.pathname.startsWith("/api/client/clock/"))) {
      if (url.pathname === "/api/talent/clock/in" || url.pathname === "/api/talent/clock/out") {
        attendanceWrites.push(`${route.request().method()} ${url.pathname}`);
      }
      const response = await route.fetch({ url: apiBase + url.pathname + url.search });
      return route.fulfill({ response });
    }
    if (url.pathname.startsWith("/api/")) {
      const value = url.pathname.includes("/notifications/hired-popup/claim") ? null
        : url.pathname.includes("/notifications") ? []
        : url.pathname.includes("message-threads") ? { unreadMessageCount: 0 }
        : url.pathname.includes("profiles/me") ? { profile: {} }
        : url.pathname.includes("organizations") ? { organizations: [] }
        : { profileCompleted: true };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
    }
    if (url.origin !== appBase) return route.abort();
    return route.continue();
  });
  return { page, context, attendanceWrites };
}
const timerValue = async (page: Page) => {
  const text = await page.locator("main").innerText();
  const values = text.match(/\b\d{2}:\d{2}:\d{2}\b/g) ?? [];
  // Timer is the large CURRENT SESSION value, not the 12-hour local clock.
  const timer = page.locator(".text-3xl.tabular-nums").first();
  const value = (await timer.count()) ? await timer.innerText() : values[0];
  assert.match(value ?? "", /^\d{2}:\d{2}:\d{2}$/);
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

before(async () => {
  await initializeFixture();
  await query(`INSERT INTO users (id, email, role, first_name, company) VALUES
    ('live-client', 'client@live.fixture.test', 'client', 'Fixture Client', 'Testing workspace'),
    ('live-talent', 'talent@live.fixture.test', 'talent', 'Fixture Talent', NULL)`);
  const job = (await query(`INSERT INTO jobs (client_id, title, status, billing_mode)
    VALUES ('live-client', 'Website Developer', 'open', 'tracked') RETURNING id`)).rows[0].id;
  const submission = (await query(`INSERT INTO job_submissions
    (job_id, client_id, talent_id, applicant_name, status, initiated_by, workflow_type)
    VALUES ($1, 'live-client', 'live-talent', 'Fixture Talent', 'hired', 'client', 'client_invitation') RETURNING id`, [job])).rows[0].id;
  const offer = (await query(`INSERT INTO offers (submission_id, status, engagement_type, billing_mode, rate, rate_currency)
    VALUES ($1, 'accepted', 'Standard', 'tracked', 1000, 'USD') RETURNING id`, [submission])).rows[0].id;
  contract = (await query(`INSERT INTO hiring_contracts
    (offer_id, submission_id, status, billing_mode, talent_signed_at, onspot_signed_at)
    VALUES ($1, $2, 'signed', 'tracked', now(), now()) RETURNING id`, [offer, submission])).rows[0].id;
  const app = express(); app.use(express.json()); api = await registerRoutes(app);
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  apiBase = `http://127.0.0.1:${(api.address() as any).port}`;
  cache = mkdtempSync(join(tmpdir(), "clock-live-vite-"));
  vite = await createServer({
    configFile: false, root: resolve("client"), cacheDir: cache,
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    optimizeDeps: { entries: ["src/pages/talent/Clock.tsx", "src/pages/Timesheets.tsx"] },
    plugins: [react(), {
      name: "isolated-live-clock",
      resolveId(id) { if (id === "/__clock-fixture.tsx") return id; },
      load(id) {
        if (id !== "/__clock-fixture.tsx") return;
        return `import React from 'react'; import {createRoot} from 'react-dom/client';
          import {QueryClientProvider} from '@tanstack/react-query'; import {queryClient} from '/src/lib/queryClient';
          import {AuthProvider} from '/src/contexts/AuthContext'; import {Switch,Route} from 'wouter';
          import {SignupModalProvider} from '/src/components/SignupModalProvider';
          import Clock from '/src/pages/talent/Clock'; import Timesheets from '/src/pages/Timesheets'; import '/src/index.css';
          createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><AuthProvider>
           <SignupModalProvider><Switch><Route path='/talent/clock'><Clock/></Route><Route path='/talent/timesheets'><Timesheets role='talent'/></Route>
           <Route path='/client/timesheets'><Timesheets role='client'/></Route></Switch></SignupModalProvider></AuthProvider></QueryClientProvider>);`;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.headers.accept?.includes("text/html")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml(req.url || "/", '<html><body><div id="root"></div><script type="module" src="/__clock-fixture.tsx"></script></body></html>'));
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  appBase = `http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
});
after(async () => {
  await browser?.close(); await vite?.close();
  if (api) await new Promise<void>((resolve) => api.close(() => resolve()));
  await closeFixture();
  if (cache) rmSync(cache, { recursive: true, force: true });
});

test("real mobile Clock In → two-minute wait → reload/navigation → Clock Out → submit → Client same hours", { timeout: 240_000 }, async () => {
  const { page, context, attendanceWrites } = await makePage("talent");
  try {
    await page.goto(appBase + `/talent/clock?hiringContractId=${contract}`);
    await page.getByRole("combobox", { name: "Select work timezone" }).selectOption("Asia/Manila");
    await page.getByRole("button", { name: "Confirm timezone" }).click();
    await page.getByRole("button", { name: "Time In", exact: true }).waitFor();
    await page.waitForFunction(() => !(Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Time In") as HTMLButtonElement)?.disabled);
    await page.getByRole("button", { name: "Time In", exact: true }).click();
    await page.getByRole("button", { name: "Time Out", exact: true }).waitFor();
    const persisted = (await query("SELECT * FROM clock_sessions WHERE talent_id = 'live-talent' AND ended_at IS NULL")).rows[0];
    assert.ok(persisted); assert.equal(persisted.ended_at, null);
    const start = persisted.started_at.toISOString();
    await page.reload();
    await page.getByRole("button", { name: "Time Out", exact: true }).waitFor();
    await page.goto(appBase + "/talent/timesheets");
    await page.getByText("Currently working", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Submit for review", exact: true }).isDisabled(), true);
    const state = await fetch(apiBase + "/api/talent/timesheets", { headers: { Authorization: `Bearer ${signedToken("talent")}` } }).then((response) => response.json());
    period = state.periods[0].id;
    assert.equal(state.periods[0].activeSession.startedAt, start);
    assert.equal(state.periods[0].totalHours, 0);
    await page.getByRole("link", { name: "Open Clock", exact: true }).last().click();
    await page.getByRole("button", { name: "Time Out", exact: true }).waitFor();
    await page.waitForTimeout(120_000); // Real elapsed time; no fake clock or DB timestamp manipulation.
    assert.ok(await timerValue(page) >= 119);
    await page.reload();
    await page.getByRole("button", { name: "Time Out", exact: true }).waitFor();
    assert.ok(await timerValue(page) >= 119);
    await page.getByRole("button", { name: "Time Out", exact: true }).click();
    await page.getByText(/^Time Out recorded/).first().waitFor();
    const ended = (await query("SELECT * FROM clock_sessions WHERE id = $1", [persisted.id])).rows[0];
    assert.deepEqual(attendanceWrites, ["POST /api/talent/clock/in", "POST /api/talent/clock/out"],
      "The live timer must not send per-second clock mutations.");
    assert.ok(ended.ended_at > ended.started_at);
    assert.ok((ended.ended_at.getTime() - ended.started_at.getTime()) / 1000 >= 120);
    await page.goto(appBase + "/talent/timesheets");
    await page.getByRole("button", { name: "Submit for review", exact: true }).waitFor();
    assert.equal(await page.getByText("Currently working", { exact: true }).count(), 0);
    const submitted = page.waitForResponse((response) => response.url().includes(`/timesheets/${period}/submit`));
    await page.getByRole("button", { name: "Submit for review", exact: true }).click();
    assert.equal((await submitted).status(), 200);
    await page.waitForFunction(() => /submitted/i.test(document.body.innerText));
    const completed = await fetch(apiBase + "/api/talent/timesheets", { headers: { Authorization: `Bearer ${signedToken("talent")}` } }).then((response) => response.json());
    const tp = completed.periods.find((row: any) => row.id === period);
    assert.equal(tp.status, "submitted");
    assert.equal(tp.sessions[0].id, persisted.id);
    assert.ok(tp.totalHours >= 0.033 && tp.totalHours < 0.06);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const client = await makePage("client");
    try {
      await client.page.goto(appBase + "/client/timesheets");
      await client.page.locator("main p").filter({ hasText: /^Website Developer$/ }).first().waitFor();
      const cp = await fetch(apiBase + "/api/client/timesheets", { headers: { Authorization: `Bearer ${signedToken("client")}` } }).then((response) => response.json());
      assert.equal(cp.periods.find((row: any) => row.id === period).totalHours, tp.totalHours);
      assert.deepEqual(cp.periods.find((row: any) => row.id === period).days, tp.days);
      assert.match(await client.page.locator("main").innerText(), new RegExp(tp.totalHours.toFixed(2)));
    } finally { await client.context.close(); }
  } catch (error) {
    console.error("Clock fixture visible page:", await page.locator("body").innerText());
    throw error;
  } finally {
    await context.close();
    // Do not let a failed assertion leave this owned fixture's Talent clock
    // open and hide an independent browser regression behind a duplicate key.
    await fetch(apiBase + "/api/talent/clock/out", {
      method: "POST", headers: { Authorization: `Bearer ${signedToken("talent")}` },
    });
  }
});

test("activity lifecycle uses real Clock APIs and exposes the paid breakdown in Client Timesheets", { timeout: 90_000 }, async () => {
  await query("UPDATE hiring_contracts SET work_timezone=COALESCE(work_timezone,'Asia/Manila') WHERE id=$1", [contract]);
  const { page, context } = await makePage("talent");
  const client = await makePage("client");
  const getClock = () => fetch(apiBase + "/api/talent/clock", {
    headers: { Authorization: `Bearer ${signedToken("talent")}` },
  }).then(r => r.json() as Promise<any>);
  try {
    await page.goto(appBase + `/talent/clock?hiringContractId=${contract}`);
    await page.getByRole("button", { name: "Time In", exact: true }).click();
    await page.getByRole("button", { name: "Lunch", exact: true }).waitFor();
    const sessionId = (await getClock()).activeSession.id;
    await page.getByRole("button", { name: "Lunch", exact: true }).click();
    await page.getByRole("button", { name: "Back to work", exact: true }).waitFor();
    assert.equal((await getClock()).activeSession.currentActivity.type, "lunch");
    await page.getByRole("button", { name: "Time Out", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /on lunch/i);
    await page.keyboard.press("Escape");
    assert.ok((await getClock()).activeSession);
    await page.getByRole("button", { name: "Back to work", exact: true }).click();
    await page.getByText("Back to work.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Meeting", exact: true }).click();
    await page.getByRole("button", { name: "Back to work", exact: true }).waitFor();
    assert.equal((await getClock()).activeSession.currentActivity.type, "meeting");
    await page.getByRole("button", { name: "Time Out", exact: true }).click();
    await page.getByText(/^Time Out recorded/).first().waitFor();
    const clock = await getClock(), recent = clock.recentSessions.find((s: any) => s.id === sessionId);
    assert.deepEqual(recent.activities.map((a: any) => a.type), ["work", "lunch", "work", "meeting"]);
    assert.ok(recent.breakdown.lunchSeconds > 0);
    assert.ok(recent.breakdown.paidSeconds > 0);
    assert.equal(recent.breakdown.unpaidSeconds, recent.breakdown.lunchSeconds);
    assert.ok(Math.abs(recent.breakdown.paidSeconds - recent.breakdown.workSeconds - recent.breakdown.meetingSeconds) < 0.001);
    await page.getByText("Today’s activity", { exact: true }).waitFor();
    await client.page.goto(appBase + "/client/timesheets");
    await client.page.locator("main p").filter({ hasText: /^Website Developer$/ }).first().waitFor();
    await client.page.getByRole("img", { name: "Session activity timeline" }).first().waitFor();
    const periods = await fetch(apiBase + "/api/client/timesheets", {
      headers: { Authorization: `Bearer ${signedToken("client")}` },
    }).then(r => r.json() as Promise<any>);
    const session = periods.periods.flatMap((p: any) => p.sessions).find((s: any) => s.id === sessionId);
    assert.deepEqual(session.breakdown, recent.breakdown);
    assert.match(await client.page.locator("main").innerText(), /paid/i);
    mkdirSync("generated-artifacts/clock-activities", { recursive: true });
    await client.page.screenshot({ path: "generated-artifacts/clock-activities/client-breakdown.png" });
  } finally {
    await context.close(); await client.context.close();
    await fetch(apiBase + "/api/talent/clock/out", {
      method: "POST", headers: { Authorization: `Bearer ${signedToken("talent")}` },
    });
  }
});

test("forgotten Time Out closes immediately, opens adjustment dialog and Client approval restores counted hours", { timeout: 90_000 }, async () => {
  await query("UPDATE hiring_contracts SET work_timezone=COALESCE(work_timezone,'Asia/Manila') WHERE id=$1", [contract]);
  const row = (await query(`INSERT INTO clock_sessions (hiring_contract_id,talent_id,started_at)
    VALUES ($1,'live-talent',date_trunc('minute',now())-interval '18 hours') RETURNING *`, [contract])).rows[0];
  const { page, context } = await makePage("talent");
  const client = await makePage("client");
  const directory = "generated-artifacts/clock-adjustments";
  mkdirSync(directory, { recursive: true });
  try {
    await page.goto(appBase + `/talent/clock?hiringContractId=${contract}`);
    await page.getByRole("button", { name: "Time Out", exact: true }).waitFor();
    const response = page.waitForResponse(r => r.url().endsWith("/api/talent/clock/out") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Time Out", exact: true }).click();
    assert.equal((await response).status(), 200);
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const closed = (await query("SELECT * FROM clock_sessions WHERE id=$1", [row.id])).rows[0];
    assert.ok(closed.ended_at, "Time Out closes the raw session before any adjustment is submitted");
    assert.equal(closed.exception_status, "detected");
    await dialog.getByLabel("Reason", { exact: true }).fill("Forgot to time out after finishing my shift.");
    await page.screenshot({ path: `${directory}/talent-adjustment-dialog.png`, fullPage: true });
    await dialog.getByRole("button", { name: "Submit adjustment", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    const pending = (await query("SELECT * FROM clock_sessions WHERE id=$1", [row.id])).rows[0];
    assert.equal(pending.exception_status, "pending");
    assert.equal(pending.ended_at.toISOString(), closed.ended_at.toISOString());
    await page.getByRole("button", { name: "Time In", exact: true }).waitFor();
    const getSheets = (role: "talent" | "client") => fetch(apiBase + `/api/${role}/timesheets`, {
      headers: { Authorization: `Bearer ${signedToken(role)}` },
    }).then(r => r.json());
    const before = await getSheets("client");
    const affected = before.periods.filter((p: any) => p.sessions.some((s: any) => s.id === row.id));
    assert.ok(affected.length > 0);
    assert.ok(affected.every((p: any) => p.pendingAdjustmentCount === 1));
    const beforeHours = affected.reduce((sum: number, p: any) => sum + p.totalHours, 0);
    await client.page.goto(appBase + "/client/timesheets");
    await client.page.getByRole("button", { name: "Approve adjustment", exact: true }).waitFor();
    await client.page.getByText("Forgot to time out after finishing my shift.", { exact: true }).waitFor();
    await client.page.screenshot({ path: `${directory}/client-adjustment-review.png`, fullPage: true });
    const approval = client.page.waitForResponse(r => r.url().includes(`/clock/${row.id}/resolve`));
    await client.page.getByRole("button", { name: "Approve adjustment", exact: true }).click();
    assert.equal((await approval).status(), 200);
    const after = await getSheets("client");
    const counted = after.periods.filter((p: any) => affected.some((a: any) => a.id === p.id));
    const afterHours = counted.reduce((sum: number, p: any) => sum + p.totalHours, 0);
    assert.ok(Math.abs(afterHours - beforeHours - 8) < .001);
    const saved = (await query("SELECT * FROM clock_sessions WHERE id=$1", [row.id])).rows[0];
    assert.equal(saved.ended_at.toISOString(), closed.ended_at.toISOString());
    assert.equal(saved.exception_status, "approved");
    await page.goto(appBase + "/talent/timesheets");
    await page.getByText(/^Adjustment approved ·/).first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await client.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await client.page.screenshot({ path: `${directory}/client-approved-hours.png`, fullPage: true });
  } finally { await context.close(); await client.context.close(); }
});
