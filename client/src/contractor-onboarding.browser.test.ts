import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser } from "playwright";

let vite: ViteDevServer;
let browser: Browser;
let cacheDir: string;
let baseUrl: string;
let signed = false;
let receivedSignature: Record<string, unknown> | null = null;

before(async () => {
  cacheDir = mkdtempSync(join(tmpdir(), "onspot-onboarding-browser-"));
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir,
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    plugins: [
      react(),
      {
        name: "contractor-onboarding-browser-fixture",
        resolveId(id) { if (id === "/__contractor-onboarding-fixture.tsx") return id; },
        load(id) {
          if (id !== "/__contractor-onboarding-fixture.tsx") return;
          return `
            import React, { useState } from "react";
            import { createRoot } from "react-dom/client";
            import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
            import { Route, Router, Switch, useLocation } from "wouter";
            import ClientMsa from "/src/pages/ClientMsa";
            import { ContractorOnboardingTracker } from "/src/components/ContractorOnboarding";
            function TrackerFixture() {
              const [, navigate] = useLocation();
              const [shortlisted, setShortlisted] = useState(false);
              const data = {
                policy: "deposit_first", submissionId: "submission-fixture", status: "shortlisted",
                shortlistSatisfied: true, finalInterviewPassed: false, canScheduleInterview: true,
                canSendOffer: false, defaultInterviewType: "final", offerId: null, deposit: null,
                contract: { id: "contract-fixture", status: "draft", url: null },
                msa: { version: "2026.1", signed: false, available: true, url: null },
                conditions: { depositHeld: false, contractSigned: false, msaSigned: false },
                canPrepareContract: false, missing: ["Passed final interview"], nextActor: "Client",
                stages: [
                  { key: "application", label: "Application", complete: true, current: false, actor: "Talent" },
                  { key: "shortlisted", label: "Shortlisted", complete: true, current: false, actor: "Client" },
                  { key: "interview", label: "Interview", complete: true, current: false, actor: "OnSpot" },
                  { key: "final_interview", label: "Final interview", complete: false, current: true, actor: "Client" },
                ],
              };
              return <><output data-testid="current-path">{window.location.pathname + window.location.search}</output><div data-testid="shortlist-state">{String(shortlisted)}</div><ContractorOnboardingTracker data={data} onShortlist={() => setShortlisted(true)} /><button onClick={() => navigate("/contracts?id=" + encodeURIComponent(data.contract.id))}>Open agreement fixture</button></>;
            }
            const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
            createRoot(document.getElementById("root")).render(
              <QueryClientProvider client={queryClient}><Router><Switch>
                <Route path="/msa" component={ClientMsa} />
                <Route path="/tracker" component={TrackerFixture} />
              </Switch></Router></QueryClientProvider>
            );
          `;
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.headers.accept?.includes("text/html")) return next();
            res.setHeader("Content-Type", "text/html");
            res.end(await server.transformIndexHtml("/__contractor-onboarding", '<html><body><div id="root"></div><script type="module" src="/__contractor-onboarding-fixture.tsx"></script></body></html>'));
          });
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  await vite.listen();
  baseUrl = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});

after(async () => {
  await browser?.close();
  await vite?.close();
  if (cacheDir) rmSync(cacheDir, { recursive: true, force: true });
});

async function fixture() {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.route("**/api/client/msa/sign", async (route) => {
    receivedSignature = route.request().postDataJSON();
    signed = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signature: { id: "signature-fixture" } }) });
  });
  await page.route("**/api/client/msa", async (route) => {
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(signed
        ? { document: { id: "msa-fixture", version: "2026.1", sha256: "abc123hash", effectiveAt: "2026-06-01", viewUrl: "/api/client/msa/msa-fixture/pdf" }, signature: { id: "signature-fixture", signedAt: "2026-06-02T12:00:00Z", signerName: "Jordan Lee" }, requiresSignature: false, issued: true }
        : { document: { id: "msa-fixture", version: "2026.1", sha256: "abc123hash", effectiveAt: "2026-06-01", viewUrl: "/api/client/msa/msa-fixture/pdf" }, signature: null, requiresSignature: true, issued: true }),
    });
  });
  await page.route("**/api/client/msa/msa-fixture/pdf", (route) => route.fulfill({
    status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
  }));
  return { context, page };
}

test("client reviews the protected MSA PDF and signs the displayed hash-bound version", async () => {
  signed = false;
  receivedSignature = null;
  const { context, page } = await fixture();
  try {
    await page.goto(`${baseUrl}/msa`);
    await page.getByText("OnSpot MSA · Version 2026.1").waitFor();
    await page.locator("iframe[title='OnSpot MSA version 2026.1']").waitFor();
    await page.getByRole("checkbox", { name: /reviewed this agreement/ }).check();
    await page.getByLabel("Full legal name").fill("Jordan Lee");
    await page.getByRole("button", { name: "Sign current agreement" }).click();
    await page.getByText("Agreement signed").waitFor();
    assert.equal(receivedSignature?.documentId, "msa-fixture");
    assert.equal(receivedSignature?.documentSha256, "abc123hash");
    assert.equal(receivedSignature?.consent, true);
    assert.equal(receivedSignature?.signerName, "Jordan Lee");
  } finally { await context.close(); }
});

test("tracker renders server blockers and contract links use the existing id query key", async () => {
  const { context, page } = await fixture();
  try {
    await page.goto(`${baseUrl}/tracker`);
    await page.getByRole("region", { name: "Contractor onboarding progress" }).waitFor();
    await page.getByRole("region", { name: "Contractor onboarding progress" }).locator("p").filter({ hasText: "Still needed: Passed final interview" }).waitFor();
    await page.getByRole("button", { name: "Manage agreement draft" }).click();
    await page.waitForURL(/\/contracts\?id=contract-fixture/);
    assert.equal(new URL(page.url()).searchParams.get("id"), "contract-fixture");
  } finally { await context.close(); }
});
