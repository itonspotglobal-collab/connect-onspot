import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const SAFE_MEETING_URL = "https://meet.google.com/interview-details-regression";
const INTERNAL_NOTE = "INTERNAL NOTE: never render this to a client or talent";

let browser: Browser;
let vite: ChildProcess | undefined;

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
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

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
    { waitUntil: "domcontentloaded" },
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

test("Client interview details preserve keyboard access and meeting links", async () => {
  const page = await authenticatedPage("client");
  try {
    const cardName = "View interview details for Client Interview Details Role";
    const card = page.getByRole("button", { name: cardName });
    await card.waitFor({ state: "visible" });

    await card.click();
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