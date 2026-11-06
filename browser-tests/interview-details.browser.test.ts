import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const SAFE_MEETING_URL = "https://meet.google.com/interview-details-regression";
const INTERNAL_NOTE = "INTERNAL NOTE: never render this to a client or talent";

let browser: Browser;
let vite: ChildProcess | undefined;
let viteCache: string | undefined;

const clientInterview = {
  id: "interview-details-client",
  submission_id: "submission-details-client",
  round_number: 2,
  interview_type: "technical",
  status: "confirmed",
  confirmed_time: "2030-08-22T09:00:00.000Z",
  confirmed_time_zone: "Asia/Manila",
  duration_minutes: 45,
  proposed_times: [],
  candidate_notes: INTERNAL_NOTE,
  meeting_link: SAFE_MEETING_URL,
  current_proposal_owner: null,
  created_at: "2030-08-01T00:00:00.000Z",
  job_title: "Client Interview Details Role",
  job_company: "Regression Client",
  talent_full_name: "Alex Talent",
};

const talentInterview = {
  id: "interview-details-talent",
  submissionId: "submission-details-talent",
  job: { title: "Talent Interview Details Role", company: "Regression Client" },
  roundNumber: 1,
  interviewType: "culture_fit",
  status: "confirmed",
  proposedTimes: [],
  confirmedTime: "2030-08-23T09:00:00.000Z",
  confirmedTimeZone: "America/New_York",
  currentProposalOwner: null,
  meetingLink: null,
  durationMinutes: 30,
  cancelledAt: null,
  cancellationReason: null,
  proposalExchangeCount: 0,
  nudge: false,
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

async function routeApi(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

  if (request.method() === "GET" && path === "/api/client/interviews") {
    return fulfillJson(route, [clientInterview]);
  }
  if (request.method() === "GET" && path === "/api/talent/interviews") {
    return fulfillJson(route, [talentInterview]);
  }
  if (request.method() === "GET" && path === "/api/talent/applications") {
    return fulfillJson(route, []);
  }
  if (request.method() === "POST" && (
    path === "/api/talent/notifications/hired-popup/claim" ||
    path === "/api/notifications/hired-popup/claim"
  )) {
    return fulfillJson(route, null);
  }
  if (request.method() === "GET" && path === "/api/profiles/user/client-interview-details") {
    return fulfillJson(route, { profileCompletion: 100 });
  }

  // Shared navigation and page sections make unrelated API calls. Keep those
  // successful so this spec remains focused on the interview details contract.
  return fulfillJson(route, []);
}

function unsignedCandidateToken(): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      type: "candidate",
      candidateId: "candidate-interview-details",
      email: "talent-interview-details@example.test",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    "test-signature",
  ].join(".");
}

async function authenticatedPage(
  role: "client" | "talent",
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.route("**/api/**", routeApi);
  // Settle the cold Vite dependency scan before an optimizer reload can erase
  // an open dialog during the first test.
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  await page.evaluate(({ role, talentToken }) => {
    localStorage.clear();
    const userId = role === "client"
      ? "client-interview-details"
      : "talent-interview-details";
    localStorage.setItem("onspot_jwt_token", `test-${role}-interview-details-jwt`);
    localStorage.setItem(
      "onspot_user",
      JSON.stringify({
        id: userId,
        email: `${role}@interview-details.example.test`,
        first_name: role === "client" ? "Regression" : "Alex",
        last_name: role === "client" ? "Client" : "Talent",
        role,
      }),
    );
    localStorage.setItem(`onboarding_completed_${userId}`, "true");
    if (role === "talent") {
      localStorage.setItem(
        "talent_profile_token",
        JSON.stringify({
          token: talentToken,
          candidateId: "candidate-interview-details",
          email: "talent-interview-details@example.test",
          fullName: "Alex Talent",
        }),
      );
    }
  }, { role, talentToken: unsignedCandidateToken() });

  await page.goto(
    `${BASE_URL}${role === "client" ? "/client/interviews" : "/my-applications"}`,
    { waitUntil: "networkidle" },
  );
  return page;
}

async function assertDialogHasFocus(page: Page): Promise<void> {
  assert.equal(
    await page.getByRole("dialog").evaluate((dialog) => dialog.contains(document.activeElement)),
    true,
    "opening the details popup should move focus into the dialog",
  );
}

async function assertClosed(page: Page, cardName: string): Promise<void> {
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.getByRole("button", { name: cardName }).count(), 1);
}

async function assertKeyboardOpensAndCloses(
  page: Page,
  cardName: string,
  key: "Enter" | " ",
): Promise<void> {
  const card = page.getByRole("button", { name: cardName });
  await card.focus();
  await page.keyboard.press(key);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await assertDialogHasFocus(page);
  await page.waitForTimeout(250);
  await dialog.press("Escape");
  await assertClosed(page, cardName);
}

before(async () => {
  if (!process.env.BROWSER_BASE_URL) {
    const viteEnv = { ...process.env };
    delete viteEnv.REPL_ID;
    viteCache = mkdtempSync(join(tmpdir(), "interview-response-browser-"));
    vite = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "pipe", env: { ...viteEnv, NODE_ENV: "development", AUTH_BROWSER_CACHE_DIR: viteCache } },
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
  if (viteCache) rmSync(viteCache, { recursive: true, force: true });
});

test("Client interview details preserve keyboard access and meeting links", async () => {
  const page = await authenticatedPage("client");
  try {
    const cardName = "View interview details for Client Interview Details Role";
    const card = page.getByRole("button", { name: cardName });
    await card.waitFor({ state: "visible" });

    // The card also contains outcome controls that intentionally stop clicks.
    // Exercise its non-interactive title rather than its geometric center.
    await card.getByText("Client Interview Details Role").click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await assertDialogHasFocus(page);
    assert.equal(await dialog.getByText(INTERNAL_NOTE, { exact: true }).count(), 0);
    await dialog.getByRole("button", { name: "Close" }).click();
    await assertClosed(page, cardName);

    await assertKeyboardOpensAndCloses(page, cardName, "Enter");
    await assertKeyboardOpensAndCloses(page, cardName, " ");

    const meetingLink = page.getByRole("link", { name: "Join meeting" });
    assert.equal(await meetingLink.getAttribute("href"), SAFE_MEETING_URL);
    assert.equal(await meetingLink.getAttribute("target"), "_blank");
    const meetingPagePromise = page.context().waitForEvent("page");
    await meetingLink.click();
    const meetingPage = await meetingPagePromise;
    assert.equal(await page.getByRole("dialog").count(), 0);
    await meetingPage.close();
  } finally {
    await page.context().close();
  }
});

test("Talent interview details support keyboard access and missing-link fallback", async () => {
  const page = await authenticatedPage("talent");
  try {
    const cardName = "View interview details for Talent Interview Details Role";
    const card = page.getByRole("button", { name: cardName });
    await card.waitFor({ state: "visible" });

    await card.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await assertDialogHasFocus(page);
    await dialog.press("Escape");
    await assertClosed(page, cardName);

    await assertKeyboardOpensAndCloses(page, cardName, "Enter");
    await assertKeyboardOpensAndCloses(page, cardName, " ");

    await card.click();
    await dialog.waitFor({ state: "visible" });
    await assertDialogHasFocus(page);
    await page.getByText("Meeting link not available yet", { exact: true }).waitFor();
    assert.equal(await dialog.getByRole("link", { name: "Join Meeting" }).count(), 0);
    assert.equal(await page.getByText(INTERNAL_NOTE, { exact: true }).count(), 0);
    await dialog.press("Escape");
    await assertClosed(page, cardName);
  } finally {
    await page.context().close();
  }
});

// These exercise the real Applications UI with synthetic auth and mocked HTTP;
// they do not establish real-account, email-delivery, or calendar-provider UAT.
const proposedStart = "2035-08-23T09:00:00.000Z";
const secondStart = "2035-08-24T09:00:00.000Z";
async function pendingTalentPage(
  starts = [proposedStart],
  options: { failStatus?: number; conflictRemovesInterview?: boolean; owner?: string; hold?: Promise<void> } = {},
) {
  const page = await authenticatedPage("talent");
  const sent: any[] = [];
  let current: any = {
    ...talentInterview, status: "proposed", confirmedTime: null,
    currentProposalOwner: options.owner ?? "talent",
    proposedTimes: starts.map((start) => ({ start, timezone: "Asia/Manila" })),
  };
  let failStatus = options.failStatus;
  await page.route("**/api/talent/interviews", (route) =>
    fulfillJson(route, current ? [current] : []));
  await page.route("**/api/talent/interviews/*/respond", async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    if (options.hold) await options.hold;
    if (failStatus) {
      const status = failStatus;
      failStatus = undefined; // A deliberate retry may succeed.
      if (status === 409) current = options.conflictRemovesInterview ? null : {
        ...current, status: "confirmed", confirmedTime: proposedStart, currentProposalOwner: null,
      };
      return fulfillJson(route, { message: status === 409
        ? "This interview is no longer awaiting your response."
        : "Could not save the interview. Please try again." }, status);
    }
    current = {
      ...current,
      status: body.action === "accept" ? "confirmed" : body.action === "decline" ? "cancelled" : "rescheduled",
      currentProposalOwner: body.action === "counter" ? "client" : null,
      confirmedTime: body.action === "accept" ? body.selectedTime : null,
      meetingLink: body.action === "accept" ? SAFE_MEETING_URL : null,
    };
    return fulfillJson(route, current);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(talentInterview.job.title, { exact: true }).waitFor();
  return { page, sent };
}

test("Talent has an explicit mobile Accept action and must confirm the exact proposed time", async () => {
  const { page, sent } = await pendingTalentPage([proposedStart, "2020-01-01T00:00:00.000Z"]);
  try {
    await page.setViewportSize({ width: 380, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const accept = page.getByRole("button", { name: "Accept", exact: true });
    await accept.waitFor();
    assert.equal(await accept.count(), 1, "past slots must not get Accept actions");
    await page.getByText("The client proposed this time. Accept it or suggest another.", { exact: true }).waitFor();
    const bounds = (await accept.boundingBox())!;
    assert.ok(bounds.height >= 36);
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 380);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await accept.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "Accept this interview time?" }).waitFor();
    for (const text of [talentInterview.job.title, `${talentInterview.job.company} · Round 1`, "30 minutes"]) {
      await dialog.getByText(text, { exact: true }).waitFor();
    }
    assert.match(await dialog.innerText(), /2035|Aug/);
    assert.equal(sent.length, 0, "opening the dialog must not send acceptance");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(sent.length, 0);
    await accept.click();
    await page.getByRole("button", { name: "Confirm interview", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(sent, [{ action: "accept", selectedTime: proposedStart }]);
    await page.getByText("Confirmed", { exact: true }).waitFor();
    await page.getByRole("link", { name: /Join meeting/i }).waitFor();
    await page.getByText("Interview confirmed", { exact: true }).waitFor();
    await page.getByText("You'll receive a calendar invitation and meeting details by email.", { exact: true }).waitFor();
  } finally { await page.context().close(); }
});

test("Multiple slots keep selection-specific loading and disable every action while accepting", async () => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const { page, sent } = await pendingTalentPage([proposedStart, secondStart], { hold });
  try {
    await page.getByText("Choose one of the client's proposed times:", { exact: true }).waitFor();
    const accepts = page.getByRole("button", { name: "Accept", exact: true });
    await accepts.nth(1).click();
    await page.getByRole("button", { name: "Confirm interview", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll("button .animate-spin").length >= 2);
    // Radix hides the background from accessibility while the dialog is open.
    const buttons = page.getByRole("button", { name: "Accept", exact: true, includeHidden: true });
    assert.equal(await buttons.count(), 2);
    assert.equal(await buttons.nth(0).isDisabled(), true);
    assert.equal(await buttons.nth(1).isDisabled(), true);
    assert.equal(await buttons.nth(0).locator(".animate-spin").count(), 0);
    assert.equal(await buttons.nth(1).locator(".animate-spin").count(), 1);
    for (const name of ["Suggest another time", "Decline interview", "Cancel", "Confirm interview"]) {
      assert.equal(await page.getByRole("button", { name, exact: true, includeHidden: true }).isDisabled(), true);
    }
    release();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(sent, [{ action: "accept", selectedTime: secondStart }]);
  } finally { release(); await page.context().close(); }
});

test("A non-conflict error stays in the confirmation dialog and allows a deliberate retry", async () => {
  const { page, sent } = await pendingTalentPage([proposedStart], { failStatus: 503 });
  try {
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Confirm interview" }).click();
    await dialog.getByText("Could not save the interview. Please try again.", { exact: true }).waitFor();
    assert.equal(await dialog.isVisible(), true);
    assert.equal(sent.length, 1);
    await dialog.getByRole("button", { name: "Confirm interview" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(sent.length, 2);
  } finally { await page.context().close(); }
});

test("409 closes acceptance and preserves the error after changed or removed interview refetch", async () => {
  for (const conflictRemovesInterview of [false, true]) {
    const { page, sent } = await pendingTalentPage([proposedStart], { failStatus: 409, conflictRemovesInterview });
    try {
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      await page.getByRole("button", { name: "Confirm interview" }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByText("This interview is no longer awaiting your response.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Accept", exact: true }).count(), 0);
      assert.equal(sent.length, 1);
      assert.equal(await page.getByText("Interview confirmed", { exact: true }).count(), 0);
    } finally { await page.context().close(); }
  }
});

test("Expired proposals retain counter-proposal and decline actions without acceptance", async () => {
  for (const action of ["counter", "decline"]) {
    const { page, sent } = await pendingTalentPage(["2020-01-01T00:00:00.000Z"]);
    try {
      await page.getByText("These times have passed — propose new times", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Accept", exact: true }).count(), 0);
      const expectedCounterTime = await page.evaluate(() => new Date("2035-09-02T10:00").toISOString());
      if (action === "counter") {
        await page.getByLabel("Alternative interview time").fill("2035-09-02T10:00");
        await page.getByRole("button", { name: "Suggest another time", exact: true }).click();
      } else {
        await page.getByRole("button", { name: "Decline interview", exact: true }).click();
      }
      await page.getByLabel("Alternative interview time").waitFor({ state: "hidden" });
      assert.equal(sent.length, 1);
      assert.equal(sent[0].action, action);
      if (action === "counter") {
        assert.equal(sent[0].proposedTimes[0].start, expectedCounterTime);
        assert.ok(sent[0].proposedTimes[0].timezone);
      } else assert.deepEqual(sent[0], { action: "decline" });
    } finally { await page.context().close(); }
  }
});

test("Talent cannot accept while the Client owes the next response", async () => {
  const { page } = await pendingTalentPage([proposedStart], { owner: "client" });
  try {
    assert.equal(await page.getByRole("button", { name: "Accept", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Decline interview", exact: true }).count(), 0);
  } finally { await page.context().close(); }
});