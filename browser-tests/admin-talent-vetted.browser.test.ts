import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const TALENT_ID = "talent-vetted-regression";

let browser: Browser;
let vite: ChildProcess | undefined;

interface FixtureState {
  isVetted: boolean;
  listRequests: number;
}

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

function talentListResponse(state: FixtureState) {
  return {
    total: 1,
    vettedTotal: state.isVetted ? 1 : 0,
    page: 1,
    limit: 50,
    items: [
      {
        id: TALENT_ID,
        email: "vetted-regression@example.test",
        first_name: "Vetted",
        last_name: "Regression",
        created_at: "2026-08-20T12:00:00.000Z",
        candidate_id: "candidate-vetted-regression",
        category: "Operations Specialists",
        profile_completed: true,
        location: "Remote",
        target_position: "Operations Specialist",
        seniority: "Senior",
        headline: "Vetted regression talent",
        availability: "Immediately",
        is_vetted: state.isVetted,
        top_skills: ["Operations"],
        total_applications: 0,
        last_active_at: "2026-08-20T12:00:00.000Z",
      },
    ],
  };
}

function talentDetailResponse(state: FixtureState) {
  return {
    talent: {
      id: TALENT_ID,
      email: "vetted-regression@example.test",
      firstName: "Vetted",
      lastName: "Regression",
      createdAt: "2026-08-20T12:00:00.000Z",
      candidateId: "candidate-vetted-regression",
      fullName: "Vetted Regression",
      displayName: "Vetted Regression",
      category: "Operations Specialists",
      targetPosition: "Operations Specialist",
      seniority: "Senior",
      experienceYears: "5",
      headline: "Vetted regression talent",
      summary: null,
      moreAboutMe: null,
      availability: "Immediately",
      location: "Remote",
      coreSkills: ["Operations"],
      secondarySkills: [],
      workHistory: [],
      education: [],
      certifications: [],
      preferences: {},
      profileCompleted: true,
      profilePhotoUrl: null,
      linkedinUrl: null,
      githubUrl: null,
      portfolioUrl: null,
      websiteUrl: null,
      hasResume: false,
      hasVideo: false,
      resumeFileName: null,
      videoIntroFileName: null,
      profileUpdatedAt: "2026-08-20T12:00:00.000Z",
      isVetted: state.isVetted,
      vettedAt: state.isVetted ? "2026-08-20T12:00:00.000Z" : null,
      vettedByMechanism: state.isVetted ? "manual" : null,
    },
    applications: [],
    vettingHistory: [],
  };
}

function eligibilityResponse(state: FixtureState) {
  return {
    isVetted: state.isVetted,
    vettedAt: state.isVetted ? "2026-08-20T12:00:00.000Z" : null,
    vettedByMechanism: state.isVetted ? "manual" : null,
    completedHireCount: 0,
    autoThreshold: 3,
    meetsAutoThreshold: false,
  };
}

async function routeApi(route: Route, state: FixtureState): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

  if (request.method() === "GET" && path === "/api/admin/talent") {
    state.listRequests += 1;
    return fulfillJson(route, talentListResponse(state));
  }

  if (request.method() === "GET" && path === `/api/admin/talent/${TALENT_ID}`) {
    return fulfillJson(route, talentDetailResponse(state));
  }

  if (
    request.method() === "GET" &&
    path === `/api/admin/talent/${TALENT_ID}/vetted-eligibility`
  ) {
    return fulfillJson(route, eligibilityResponse(state));
  }

  if (
    request.method() === "PATCH" &&
    path === `/api/admin/talent/${TALENT_ID}/vetted`
  ) {
    const body = request.postDataJSON() as { action?: string; reason?: string };
    assert.match(body.action ?? "", /^(grant|revoke)$/);
    assert.equal(body.reason, body.action === "grant" ? "Regression test" : "Regression revoke");
    state.isVetted = body.action === "grant";
    return fulfillJson(route, { success: true });
  }

  // Shared admin chrome makes additional requests that are irrelevant here.
  return fulfillJson(route, []);
}

async function newAdminPage(): Promise<{ page: Page; state: FixtureState }> {
  const state: FixtureState = { isVetted: false, listRequests: 0 };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/api/**", (route) => routeApi(route, state));
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("onspot_jwt_token", "test-admin-vetted-jwt");
    localStorage.setItem(
      "onspot_user",
      JSON.stringify({
        id: "admin-vetted-regression",
        email: "admin-vetted-regression@example.test",
        first_name: "Admin",
        last_name: "Regression",
        role: "admin",
      }),
    );
  });
  await page.goto(`${BASE_URL}/admin/talent`, { waitUntil: "domcontentloaded" });
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

test("admin talent list refreshes the Vetted count after granting and revoking the badge", async () => {
  const { page, state } = await newAdminPage();
  try {
    await page.getByTestId("talent-vetted-filter").getByText("0").waitFor();
    await page.getByTestId(`talent-vetted-status-${TALENT_ID}`).getByText("Not vetted").waitFor();
    const initialListRequests = state.listRequests;

    await page.getByTestId(`talent-row-${TALENT_ID}`).click();
    await page.getByRole("button", { name: "Grant Vetted" }).waitFor();
    await page.locator("textarea").fill("Regression test");
    await page.getByRole("button", { name: "Grant Vetted" }).click();
    await page.getByRole("button", { name: "Revoke Vetted" }).waitFor();

    await page.getByRole("button", { name: /Back to Talent/ }).click();
    await page.getByTestId("talent-vetted-filter").getByText("1").waitFor();
    await page.getByTestId(`talent-vetted-status-${TALENT_ID}`).getByText("Vetted").waitFor();
    assert.ok(
      state.listRequests > initialListRequests,
      "returning to the list should refetch its invalidated query",
    );

    await page.getByTestId(`talent-row-${TALENT_ID}`).click();
    await page.getByRole("button", { name: "Revoke Vetted" }).waitFor();
    await page.locator("textarea").fill("Regression revoke");
    await page.getByRole("button", { name: "Revoke Vetted" }).click();
    await page.getByRole("button", { name: "Grant Vetted" }).waitFor();

    await page.getByRole("button", { name: /Back to Talent/ }).click();
    await page.getByTestId("talent-vetted-filter").getByText("0").waitFor();
    await page.getByTestId(`talent-vetted-status-${TALENT_ID}`).getByText("Not vetted").waitFor();
  } finally {
    await page.context().close();
  }
});