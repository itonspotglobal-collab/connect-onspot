import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser } from "playwright";

// Real component/query cache, intercepted fixture APIs only. These tests do not
// claim live authentication, real billing decisions or customer-account UAT.
let vite: ViteDevServer;
let browser: Browser;
let base: string;
let cache: string;
before(async () => {
  cache = mkdtempSync(join(tmpdir(), "endings-ui-"));
  vite = await createServer({
    configFile: false, root: resolve("client"), cacheDir: cache,
    optimizeDeps: { entries: ["src/pages/ContractEndings.tsx"] },
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared") } },
    plugins: [react(), {
      name: "isolated-ending-test",
      resolveId(id) { if (id === "/__ending.tsx") return id; },
      load(id) {
        if (id !== "/__ending.tsx") return;
        return `import React from "react";
          import {createRoot} from "react-dom/client";
          import {QueryClientProvider, focusManager} from "@tanstack/react-query";
          import {queryClient} from "/src/lib/queryClient";
          import ContractEndings from "/src/pages/ContractEndings";
          import {Toaster} from "/src/components/ui/toaster";
          import "/src/index.css";
          window.__endingFocus = () => {focusManager.setFocused(false); focusManager.setFocused(true)};
          createRoot(document.getElementById("root")).render(
            <QueryClientProvider client={queryClient}>
              <ContractEndings role={new URLSearchParams(location.search).get("role") || "client"}/>
              <Toaster/>
            </QueryClientProvider>);`;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/__endings") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml("/__endings",
            '<html><body><div id="root"></div><script type="module" src="/__ending.tsx"></script></body></html>'));
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  await vite.listen();
  base = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (cache) rmSync(cache, { recursive: true, force: true });
});

async function fixture(role: "client" | "talent" | "admin", width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  await context.addInitScript((value) => {
    (window as any).__name = (fn: unknown) => fn;
    localStorage.setItem("onspot_jwt_token", value);
  }, token);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = {
    contracts: [{ id: "owned-contract", job_title: "Owned signed engagement", billing_mode: "guaranteed",
      effective_start_date: "2026-01-01", effective_end_date: null as string | null,
      client_email: "client@example.test", talent_email: "talent@example.test" }],
    requests: [] as any[], activeReads: 0, posts: 0, fail: false,
  };
  await page.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let body: unknown = { error: "Unknown fixture API" }, status = 404;
    if (req.method() === "GET" && url.pathname.endsWith("/active-hiring-contracts")) {
      state.activeReads++; body = { contracts: state.contracts }; status = 200;
    } else if (req.method() === "GET" && url.pathname.endsWith("/hiring-contract-termination-requests")) {
      body = { requests: role === "admin" ? state.requests.filter((r) => r.status === "open") : state.requests };
      status = 200;
    } else if (req.method() === "POST" && url.pathname.endsWith("/termination-requests")) {
      state.posts++;
      if (state.fail) { body = { error: "Fixture save rejected" }; status = 500; }
      else {
        const payload = req.postDataJSON();
        const request = { id: "owned-request", hiring_contract_id: "owned-contract",
          requester_role: role, requester_email: `${role}@example.test`,
          job_title: "Owned signed engagement", billing_mode: "guaranteed",
          requested_effective_end_date: payload.effectiveEndDate, reason: payload.reason,
          status: "open", created_at: "2026-10-08" };
        state.requests.push(request); body = { request }; status = 201;
      }
    } else if (req.method() === "POST" && url.pathname.endsWith("/decision")) {
      const payload = req.postDataJSON(), request = state.requests[0];
      request.status = payload.decision === "approve" ? "approved" : "rejected";
      request.decision_reason = payload.reason;
      if (request.status === "approved") {
        state.contracts[0].effective_end_date = request.requested_effective_end_date;
        request.approved_effective_end_date = request.requested_effective_end_date;
      }
      body = { requestId: request.id, status: request.status }; status = 200;
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { context, page, state, errors, async open() { await page.goto(`${base}/__endings?role=${role}`); } };
}

for (const role of ["client", "talent"] as const) {
  test(`${role}: submit, reload, duplicate exclusion and external approval refresh on mobile`, { timeout: 60_000 }, async () => {
    const f = await fixture(role, 390);
    try {
      await f.open();
      await f.page.getByLabel("Active contract").selectOption("owned-contract");
      await f.page.getByLabel("Requested final service date").fill("2030-01-15");
      await f.page.getByLabel(/^Reason/).fill("Controlled end request");
      await f.page.getByRole("button", { name: "Submit end request" }).click();
      await f.page.getByText("End request submitted", { exact: true }).waitFor();
      assert.equal(f.state.posts, 1);
      await f.page.reload();
      await f.page.getByText("Controlled end request", { exact: true }).waitFor();
      await f.page.waitForFunction(() =>
        (document.querySelector('option[value="owned-contract"]') as HTMLOptionElement | null)?.disabled === true);
      f.state.requests[0].status = "approved";
      f.state.requests[0].approved_effective_end_date = "2030-01-15";
      f.state.requests[0].decision_reason = "Approved controlled request";
      f.state.contracts[0].effective_end_date = "2030-01-15";
      await f.page.evaluate(() => (window as any).__endingFocus());
      await f.page.getByText(/Approved end date:/).waitFor();
      await f.page.getByText("Admin decision: Approved controlled request").waitFor();
      f.state.requests.push({
        ...f.state.requests[0],
        id: "earlier-rejected-request",
        status: "rejected",
        approved_effective_end_date: null,
        reason: "Earlier rejected request",
        decision_reason: "Earlier request declined",
      });
      await f.page.reload();
      await f.page.getByText("Earlier rejected request", { exact: true }).waitFor();
      await f.page.getByText("Admin decision: Earlier request declined").waitFor();
      assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

for (const decision of ["approve", "reject"] as const) {
  test(`Admin ${decision}: reason required and active contract cache refreshed`, { timeout: 60_000 }, async () => {
    const f = await fixture("admin");
    try {
      f.state.requests.push({ id: "owned-request", hiring_contract_id: "owned-contract",
        requester_role: "talent", requester_email: "talent@example.test",
        job_title: "Owned signed engagement", billing_mode: "guaranteed", status: "open",
        requested_effective_end_date: "2030-01-15", reason: "Review this owned request", created_at: "2026-10-08" });
      await f.open();
      await f.page.getByLabel("Active contract").selectOption("owned-contract");
      const button = f.page.getByRole("button", { name: decision === "approve" ? "Approve end" : "Reject request" });
      assert.equal(await button.isDisabled(), true);
      await f.page.getByLabel("Decision reason").fill("Recorded review outcome");
      await button.click();
      await f.page.getByText("No open contract end requests.").waitFor();
      await f.page.waitForFunction(() => document.querySelector("select")?.value === "owned-contract");
      if (decision === "approve") await f.page.locator("p").filter({ hasText: /approved final service date/ }).waitFor();
      assert.ok(f.state.activeReads >= 2);
      assert.equal(f.state.requests[0].decision_reason, "Recorded review outcome");
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

test("failed submit never displays success; empty eligibility is clearly explained", { timeout: 60_000 }, async () => {
  const f = await fixture("client");
  try {
    f.state.fail = true;
    await f.open();
    await f.page.getByLabel("Active contract").selectOption("owned-contract");
    await f.page.getByLabel(/^Reason/).fill("Rejected fixture save");
    await f.page.getByRole("button", { name: "Submit end request" }).click();
    await f.page.getByRole("alert").filter({ hasText: /Request failed:/ }).waitFor();
    assert.equal(await f.page.getByText("End request submitted", { exact: true }).count(), 0);
    assert.equal(f.state.requests.length, 0);
    f.state.contracts = [];
    await f.page.reload();
    await f.page.getByText("There are no active Tracked or Guaranteed contracts to end.").waitFor();
  } finally { await f.context.close(); }
});
