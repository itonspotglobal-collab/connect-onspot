import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const APPROVAL_JOB_ID = "admin-composer-approval-job";
const REJECTION_JOB_ID = "admin-composer-rejection-job";

let browser: Browser;
let vite: ChildProcess | undefined;

interface JobFixture {
  id: string;
  title: string;
  approvalStatus: "pending" | "approved" | "rejected";
  status: "open";
  category: string;
  engagementType: string;
  location: string;
  clientCompanyName: string;
  clientContactName: string;
  createdAt: string;
}

interface EmailHistoryRow {
  id: string;
  subject: string;
  recipientEmail: string;
  senderEmail: string;
  senderName: string;
  templateName: string;
  status: "sent";
  isTest: boolean;
  createdAt: string;
}

interface FixtureState {
  jobs: JobFixture[];
  history: Record<string, EmailHistoryRow[]>;
  requests: Array<{ method: string; path: string; body?: Record<string, unknown> }>;
  transitionNumber: number;
}

const APPROVAL_TEMPLATE = {
  id: "client-job-approved-template",
  name: "Job approved",
  subject: "Your {{job_title}} job is approved",
  bodyHtml: "<p>Hi {{client_first_name}}, your {{job_title}} job is now approved.</p>",
  category: "job_approved",
  isDefault: true,
};

const REJECTION_TEMPLATE = {
  id: "client-job-rejected-template",
  name: "Job rejected",
  subject: "Update about your {{job_title}} job",
  bodyHtml: "<p>Hi {{client_first_name}}, we reviewed your {{job_title}} job.</p>",
  category: "job_rejected",
  isDefault: true,
};

async function waitForUrl(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function waitForEnabled(page: Page, testId: string): Promise<void> {
  await page.waitForFunction((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;
    return !!button && !button.disabled;
  }, testId);
}

function jobResponse(job: JobFixture) {
  return {
    ...job,
    professionalRoleName: job.title,
    approvalStatus: job.approvalStatus,
  };
}

function statsFor(jobs: JobFixture[]) {
  return {
    total: jobs.length,
    open: jobs.length,
    closed: 0,
    pending: jobs.filter((job) => job.approvalStatus === "pending").length,
    approved: jobs.filter((job) => job.approvalStatus === "approved").length,
    declined: jobs.filter((job) => job.approvalStatus === "rejected").length,
    clientRequests: jobs.length,
  };
}

function templateFor(id: string) {
  return id === APPROVAL_TEMPLATE.id ? APPROVAL_TEMPLATE : REJECTION_TEMPLATE;
}

async function routeApi(route: Route, state: FixtureState): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const body = request.postDataJSON?.() as Record<string, unknown> | undefined;
  state.requests.push({ method: request.method(), path, body });

  if (request.method() === "GET" && path === "/api/admin/jobs") {
    const tab = url.searchParams.get("tab") ?? "all";
    const jobs = state.jobs.filter((job) => {
      if (tab === "pending") return job.approvalStatus === "pending";
      if (tab === "approved") return job.approvalStatus === "approved";
      if (tab === "declined") return job.approvalStatus === "rejected";
      return true;
    });
    return fulfillJson(route, {
      items: jobs.map(jobResponse),
      meta: { page: 1, pageSize: 25, total: jobs.length, totalPages: 1 },
      stats: statsFor(state.jobs),
    });
  }

  const contextMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)\/client-email\/context$/);
  if (request.method() === "GET" && contextMatch) {
    const job = state.jobs.find((item) => item.id === contextMatch[1]);
    if (!job) return fulfillJson(route, { error: "Job not found" }, 404);
    return fulfillJson(route, {
      jobId: job.id,
      jobTitle: job.title,
      approvalStatus: job.approvalStatus,
      recipient: { name: job.clientContactName, email: "client-owner@example.test" },
      sender: { name: "OnSpot Hire Talent", email: "hiretalent@onspotglobal.com" },
    });
  }

  if (request.method() === "GET" && path === "/api/admin/email-templates") {
    return fulfillJson(route, [APPROVAL_TEMPLATE, REJECTION_TEMPLATE]);
  }

  const templateMatch = path.match(/^\/api\/admin\/email-templates\/([^/]+)$/);
  if (request.method() === "GET" && templateMatch) {
    return fulfillJson(route, templateFor(templateMatch[1]));
  }

  const historyMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)\/client-email\/history$/);
  if (request.method() === "GET" && historyMatch) {
    return fulfillJson(route, state.history[historyMatch[1]] ?? []);
  }

  const previewMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)\/client-email\/preview$/);
  if (request.method() === "POST" && previewMatch) {
    assert.equal(
      body?.decision,
      previewMatch[1] === APPROVAL_JOB_ID ? "approved" : "rejected",
    );
    return fulfillJson(route, {
      subject: body?.subject,
      bodyHtml: body?.bodyHtml,
    });
  }

  const testMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)\/client-email\/test$/);
  if (request.method() === "POST" && testMatch) {
    const jobId = testMatch[1];
    assert.equal(body?.testRecipient, "qa@example.test");
    assert.ok(body?.templateId);
    state.history[jobId] = [{
      id: `${jobId}-test-email`,
      subject: String(body?.subject),
      recipientEmail: "qa@example.test",
      senderEmail: "hiretalent@onspotglobal.com",
      senderName: "OnSpot Hire Talent",
      templateName: "Job approved",
      status: "sent",
      isTest: true,
      createdAt: "2026-08-26T12:00:00.000Z",
    }];
    return fulfillJson(route, { success: true, email: { status: "sent" } });
  }

  const rejectTransitionMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)\/reject-for-email$/);
  if (request.method() === "POST" && rejectTransitionMatch) {
    const job = state.jobs.find((item) => item.id === rejectTransitionMatch[1]);
    assert.ok(job);
    assert.equal(body?.rejectionReason, "Needs a clearer role description.");
    job.approvalStatus = "rejected";
    state.transitionNumber += 1;
    return fulfillJson(route, {
      success: true,
      transitioned: true,
      transitionEventKey: `job-approval-transition:${job.id}:${state.transitionNumber}`,
      job: { id: job.id, title: job.title, rejection_reason: body?.rejectionReason },
    });
  }

  const approveMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)\/approve-with-email$/);
  if (request.method() === "POST" && approveMatch) {
    const job = state.jobs.find((item) => item.id === approveMatch[1]);
    assert.ok(job);
    assert.equal(body?.decision, "approved");
    assert.equal(body?.templateId, APPROVAL_TEMPLATE.id);
    job.approvalStatus = "approved";
    return fulfillJson(route, { success: true, transitioned: true, job, email: { status: "sent" } });
  }

  const sendAfterTransitionMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)\/client-email\/send-after-transition$/);
  if (request.method() === "POST" && sendAfterTransitionMatch) {
    const job = state.jobs.find((item) => item.id === sendAfterTransitionMatch[1]);
    assert.ok(job);
    assert.equal(job.approvalStatus, "rejected");
    assert.equal(body?.decision, "rejected");
    assert.match(String(body?.transitionEventKey), new RegExp(`^job-approval-transition:${job.id}:`));
    return fulfillJson(route, { success: true, email: { status: "sent" } });
  }

  // Shared admin chrome makes additional requests that are irrelevant here.
  return fulfillJson(route, []);
}

function newFixtureState(): FixtureState {
  const base = {
    status: "open" as const,
    category: "Customer Success",
    engagementType: "Standard",
    location: "Remote",
    clientCompanyName: "Regression Client",
    clientContactName: "Client Owner",
    createdAt: "2026-08-20T12:00:00.000Z",
  };
  return {
    jobs: [
      { ...base, id: APPROVAL_JOB_ID, title: "Approval Composer Regression", approvalStatus: "pending" },
      { ...base, id: REJECTION_JOB_ID, title: "Rejection Composer Regression", approvalStatus: "pending" },
    ],
    history: {},
    requests: [],
    transitionNumber: 0,
  };
}

async function newAdminFindWorkPage(
  state = newFixtureState(),
  expectedPendingJobId = APPROVAL_JOB_ID,
): Promise<{ page: Page; state: FixtureState }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/api/**", (route) => routeApi(route, state));
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("onspot_jwt_token", "test-admin-composer-jwt");
    localStorage.setItem(
      "onspot_user",
      JSON.stringify({
        id: "admin-composer-regression",
        email: "admin-composer-regression@example.test",
        first_name: "Admin",
        last_name: "Regression",
        role: "admin",
      }),
    );
  });
  await page.goto(`${BASE_URL}/admin/find-work`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Pending Approvals", exact: true }).click();
  await page.getByTestId(`pending-job-${expectedPendingJobId}`).waitFor();
  return { page, state };
}

before(async () => {
  if (!process.env.BROWSER_BASE_URL) {
    const viteEnv = { ...process.env };
    delete viteEnv.REPL_ID;
    vite = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "pipe", env: { ...viteEnv, NODE_ENV: "development" } },
    );
    vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    await waitForUrl(BASE_URL);
  }
  const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { headless: true };
  browser = await chromium.launch(launchOptions);
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([
      once(vite, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
});

test("authenticated admin can review Client approval and rejection composers safely", async () => {
  const state = newFixtureState();

  const tabPageResult = await newAdminFindWorkPage(state);
  const tabPage = tabPageResult.page;
  try {
    const approvalCard = tabPage.getByTestId(`pending-job-${APPROVAL_JOB_ID}`);
    await approvalCard.getByRole("button", { name: "Approve", exact: true }).click();

    const composer = tabPage.getByTestId("client-email-composer");
    await composer.getByRole("heading", { name: "Approve Job & Email Client" }).waitFor();
    assert.equal(
      state.jobs.find((job) => job.id === APPROVAL_JOB_ID)?.approvalStatus,
      "pending",
      "opening the approval composer must not transition the job",
    );

    await composer.getByTestId("client-email-tab-preview").click();
    await composer.getByTitle("Client email preview").waitFor();
    await composer.getByTestId("client-email-tab-history").click();
    await composer.getByText("No Client emails recorded for this job.").waitFor();
    await composer.getByTestId("client-email-tab-compose").click();
    await composer.getByTestId("client-email-cancel").click();
    await composer.waitFor({ state: "hidden" });
    assert.equal(
      state.jobs.find((job) => job.id === APPROVAL_JOB_ID)?.approvalStatus,
      "pending",
      "canceling must leave the approval decision unchanged",
    );
    assert.equal(
      state.requests.filter((request) => request.path.endsWith("/approve-with-email")).length,
      0,
      "canceling must not submit the approval decision",
    );
  } finally {
    await tabPage.context().close();
  }

  const testPageResult = await newAdminFindWorkPage(state);
  const testPage = testPageResult.page;
  try {
    const approvalCard = testPage.getByTestId(`pending-job-${APPROVAL_JOB_ID}`);
    await approvalCard.getByRole("button", { name: "Approve", exact: true }).click();
    const testComposer = testPage.getByTestId("client-email-composer");
    await testComposer.getByRole("heading", { name: "Approve Job & Email Client" }).waitFor();
    await testComposer.getByPlaceholder("you@onspotglobal.com").fill("qa@example.test");
    await waitForEnabled(testPage, "client-email-send-test");
    await testComposer.getByTestId("client-email-send-test").click();
    await testPage.getByText("Test email sent", { exact: true }).waitFor();
    assert.equal(
      state.jobs.find((job) => job.id === APPROVAL_JOB_ID)?.approvalStatus,
      "pending",
      "sending a test must not transition the job",
    );
  } finally {
    await testPage.context().close();
  }

  const decisionPageResult = await newAdminFindWorkPage(state);
  const decisionPage = decisionPageResult.page;
  try {
    const decisionApprovalCard = decisionPage.getByTestId(`pending-job-${APPROVAL_JOB_ID}`);
    await decisionApprovalCard.getByRole("button", { name: "Approve", exact: true }).click();
    const approvalComposer = decisionPage.getByTestId("client-email-composer");
    await approvalComposer.getByRole("heading", { name: "Approve Job & Email Client" }).waitFor();
    await approvalComposer.getByTestId("client-email-tab-history").click();
    await approvalComposer.getByText("Test · sent", { exact: true }).waitFor();
    await approvalComposer.getByTestId("client-email-tab-compose").click();
    await waitForEnabled(decisionPage, "client-email-confirm");
    await approvalComposer.getByTestId("client-email-confirm").click();
    await decisionPage.getByText("Job approved — email sent to Client", { exact: true }).waitFor();
    assert.equal(
      state.jobs.find((job) => job.id === APPROVAL_JOB_ID)?.approvalStatus,
      "approved",
    );
    assert.equal(
      state.requests.filter((request) => request.path.endsWith("/approve-with-email")).length,
      1,
    );

  } finally {
    await decisionPage.context().close();
  }

  const rejectionPageResult = await newAdminFindWorkPage(state, REJECTION_JOB_ID);
  const rejectionPage = rejectionPageResult.page;
  try {
    const rejectionCard = rejectionPage.getByTestId(`pending-job-${REJECTION_JOB_ID}`);
    await rejectionCard.getByRole("button", { name: "Decline", exact: true }).click();
    const reasonDialog = rejectionPage.getByRole("dialog").filter({ hasText: "Decline Job Request" });
    await reasonDialog.getByRole("heading", { name: "Decline Job Request" }).waitFor();
    await reasonDialog.locator("textarea").fill("Needs a clearer role description.");
    await reasonDialog.getByRole("button", { name: "Confirm Decline", exact: true }).click();
    const rejectionConfirmDialog = rejectionPage.getByRole("dialog").filter({ hasText: "Confirm rejection?" });
    await rejectionConfirmDialog.getByRole("heading", { name: "Confirm rejection?" }).waitFor();
    await rejectionConfirmDialog.getByRole("button", { name: "Confirm Reject", exact: true }).click();

    const rejectionComposer = rejectionPage.getByTestId("client-email-composer");
    await rejectionComposer.getByRole("heading", { name: "Email Client About Rejected Job" }).waitFor();
    assert.equal(
      state.jobs.find((job) => job.id === REJECTION_JOB_ID)?.approvalStatus,
      "rejected",
      "the rejection composer opens only after the decision is persisted",
    );

    await rejectionComposer.getByTestId("client-email-tab-preview").click();
    await rejectionComposer.getByTitle("Client email preview").waitFor();
    await rejectionComposer.getByTestId("client-email-tab-history").click();
    await rejectionComposer.getByText("No Client emails recorded for this job.").waitFor();
    await rejectionComposer.getByTestId("client-email-tab-compose").click();
    await rejectionComposer.getByTestId("client-email-cancel").click();
    await rejectionComposer.waitFor({ state: "hidden" });
    assert.equal(
      state.jobs.find((job) => job.id === REJECTION_JOB_ID)?.approvalStatus,
      "rejected",
      "canceling rejection email review must not change the saved decision",
    );
  } finally {
    await rejectionPage.context().close();
  }
});