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
              import { ClientJobRow, JobSubmissionsSection } from "/src/pages/ClientProfile";
            function TrackerFixture() {
              const [, navigate] = useLocation();
              const [shortlisted, setShortlisted] = useState(false);
              const clientMessage = new URLSearchParams(window.location.search).get("message");
              const data = {
                policy: "deposit_first", submissionId: "submission-fixture", status: clientMessage ? "offer_accepted" : "shortlisted",
                shortlistSatisfied: true, finalInterviewPassed: false, canScheduleInterview: true,
                canSendOffer: false, defaultInterviewType: "final", offerId: null,
                contract: { id: "contract-fixture", status: "draft", url: null },
                msa: { version: "2026.1", signed: false, available: true, url: null },
                conditions: { depositHeld: false, contractSigned: false, msaSigned: false },
                canPrepareContract: false, missing: ["Passed final interview"], nextActor: "Client",
                paymentState: clientMessage ? "Awaiting payment" : null,
                offerAccepted: Boolean(clientMessage),
                deposit: clientMessage ? { id: "pending-deposit", status: "pending", paymentStatus: "pending", invoiceUrl: null } : null,
                setup: { wiseReady: false, msaReady: true, clientMessage },
                stages: [
                  { key: "application", label: "Application", complete: true, current: false, actor: "Talent" },
                  { key: "shortlisted", label: "Shortlisted", complete: true, current: false, actor: "Client" },
                  { key: "interview", label: "Interview", complete: true, current: false, actor: "OnSpot" },
                  { key: "final_interview", label: "Final interview", complete: false, current: true, actor: "Client" },
                ],
              };
              return <><output data-testid="current-path">{window.location.pathname + window.location.search}</output><div data-testid="shortlist-state">{String(shortlisted)}</div><ContractorOnboardingTracker data={data} onShortlist={() => setShortlisted(true)} /><button onClick={() => navigate("/contracts?id=" + encodeURIComponent(data.contract.id))}>Open agreement fixture</button></>;
            }
            function ClientJobRowFixture() {
              const [clicked, setClicked] = useState("none");
              const props = {
                onEdit: () => {}, onToggle: () => {}, onDelete: () => {}, onView: () => {},
                onInvite: () => {}, isToggling: false, isDeleting: false,
                onViewApplications: () => setClicked("open-job"),
              };
              return <><output data-testid="applications-clicked">{clicked}</output>
                <ClientJobRow {...props} job={{ id: "open-job", title: "Open role", status: "open", proposalCount: 3 }} />
                <ClientJobRow {...props} job={{ id: "draft-job", title: "Draft role", status: "draft", proposalCount: 8 }} />
              </>;
            }
            function JobSubmissionsFixture() {
              const [viewed, setViewed] = useState("none");
              const params = new URLSearchParams(window.location.search);
              return <><output data-testid="deep-link-viewed">{viewed}</output>
                <JobSubmissionsSection
                  workspace
                  requestedJobId={params.get("jobId")}
                  requestedApplicationId={params.get("applicationId")}
                  requestedInterviewId={null}
                  onView={(submission) => setViewed(submission.id)}
                  onExtendOffer={() => {}}
                />
              </>;
            }
            const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
            createRoot(document.getElementById("root")).render(
              <QueryClientProvider client={queryClient}><Router><Switch>
                <Route path="/msa" component={ClientMsa} />
                <Route path="/tracker" component={TrackerFixture} />
                 <Route path="/row" component={ClientJobRowFixture} />
                 <Route path="/submissions" component={JobSubmissionsFixture} />
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

test("client setup notice appears only when the server supplies a client message", async () => {
  const { context, page } = await fixture();
  try {
    await page.goto(`${baseUrl}/tracker`);
    await page.getByRole("region", { name: "Contractor onboarding progress" }).waitFor();
    await page.getByText("OnSpot is finalising payment details", { exact: false }).waitFor({ state: "detached" });
    await page.getByText("Awaiting payment", { exact: false }).waitFor({ state: "detached" });
    await page.goto(`${baseUrl}/tracker?message=Deposit%20verification%20is%20pending`);
    await page.getByText("Deposit verification is pending").waitFor();
  } finally { await context.close(); }
});

test("job rows show View Applications for non-drafts and invoke the callback with the existing count", async () => {
  const { context, page } = await fixture();
  try {
    await page.goto(`${baseUrl}/row`);
    const button = page.getByTestId("button-view-applications-open-job");
    await button.waitFor();
    assert.match(await button.innerText(), /View Applications\s*3/);
    assert.equal(await page.getByTestId("button-view-applications-draft-job").count(), 0);
    await button.click();
    assert.equal(await page.getByTestId("applications-clicked").innerText(), "open-job");
  } finally { await context.close(); }
});

test("async client-owned job loading applies the requested filter and preserves the application deep link", async () => {
  const { context, page } = await fixture();
  try {
    await page.route("**/api/client/jobs", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([
        { id: "owned-job", title: "Owned role", status: "open" },
        { id: "another-owned-job", title: "Another role", status: "open" },
      ]) });
    });
    await page.route("**/api/client/job-submissions", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        { id: "deep-linked-app", jobId: "owned-job", clientId: "client-fixture", applicantName: "Alex Doe", email: "alex@example.test", phone: null, location: null, resumeUrl: null, resumeFileName: null, portfolioUrl: null, coverLetter: null, expectedSalary: null, availability: null, status: "submitted", statusVersion: "1", submittedAt: "2026-05-01T12:00:00Z", jobTitle: "Owned role", jobCompany: null, jobEngagementType: null, initiated_by: "talent", hiringPipelineEligible: false },
        { id: "other-app", jobId: "another-owned-job", clientId: "client-fixture", applicantName: "Sam Doe", email: "sam@example.test", phone: null, location: null, resumeUrl: null, resumeFileName: null, portfolioUrl: null, coverLetter: null, expectedSalary: null, availability: null, status: "submitted", statusVersion: "1", submittedAt: "2026-05-02T12:00:00Z", jobTitle: "Another role", jobCompany: null, jobEngagementType: null, initiated_by: "talent", hiringPipelineEligible: false },
      ]),
    }));
    await page.route("**/api/me/message-threads", (route) => route.fulfill({
      contentType: "application/json", body: JSON.stringify({ threads: [] }),
    }));
    await page.goto(`${baseUrl}/submissions?jobId=owned-job&applicationId=deep-linked-app`);
    await page.getByTestId("client-application-deep-linked-app").waitFor();
    await page.getByTestId("deep-link-viewed").getByText("deep-linked-app").waitFor();
    await page.getByTestId("select-submission-job").getByText("Owned role").waitFor();
    assert.equal(await page.getByTestId("client-application-other-app").count(), 0);
  } finally { await context.close(); }
});
