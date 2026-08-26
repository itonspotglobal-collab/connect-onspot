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
  listRequestUrls: string[];
  talentItems?: FixtureTalent[];
  jobItems?: Record<string, unknown>[];
}

interface FixtureTalent {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  candidate_id: string;
  category: string;
  profile_completed: boolean;
  location: string;
  target_position: string;
  seniority: string;
  headline: string;
  availability: string;
  is_vetted: boolean;
  top_skills: string[];
  application_statuses: string[];
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

function talentListResponse(state: FixtureState, url?: URL) {
  if (state.talentItems && url) {
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const skill = url.searchParams.get("skill") ?? "";
    const applicationStatus = url.searchParams.get("applicationStatus") ?? "";
    const vetted = url.searchParams.get("vetted") === "true";
    const sortBy = url.searchParams.get("sortBy");
    const sortOrder = url.searchParams.get("sortOrder");
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 50);

    const filtered = state.talentItems.filter((talent) => {
      const matchesSearch =
        !search ||
        [talent.email, talent.first_name, talent.last_name]
          .some((value) => value.toLowerCase().includes(search));
      const matchesSkill = !skill || talent.top_skills.includes(skill);
      const matchesStatus =
        !applicationStatus || talent.application_statuses.includes(applicationStatus);
      const matchesVetted = !vetted || talent.is_vetted;
      return matchesSearch && matchesSkill && matchesStatus && matchesVetted;
    });

    const sorted = [...filtered].sort((left, right) => {
      if (sortBy === "vetted" && left.is_vetted !== right.is_vetted) {
        const vettedFirst = sortOrder === "desc";
        return left.is_vetted === vettedFirst ? -1 : 1;
      }
      return 0;
    });
    const start = (page - 1) * limit;

    return {
      total: sorted.length,
      vettedTotal: filtered.filter((talent) => talent.is_vetted).length,
      page,
      limit,
      items: sorted.slice(start, start + limit).map(({ application_statuses: _statuses, ...talent }) => talent),
    };
  }

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

  if (request.method() === "GET" && path === "/api/admin/jobs" && state.jobItems) {
    return fulfillJson(route, {
      items: state.jobItems,
      meta: { page: 1, pageSize: 25, total: state.jobItems.length, totalPages: 1 },
      stats: { total: state.jobItems.length, pending: state.jobItems.length, approved: 0, rejected: 0 },
    });
  }

  if (request.method() === "GET" && path === "/api/admin/talent") {
    state.listRequests += 1;
    await fulfillJson(route, talentListResponse(state, url));
    state.listRequestUrls.push(url.toString());
    return;
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

async function newAdminPage(talentItems?: FixtureTalent[]): Promise<{ page: Page; state: FixtureState }> {
  const state: FixtureState = { isVetted: false, listRequests: 0, listRequestUrls: [], talentItems };
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

async function newAdminFindWorkPage(): Promise<{ page: Page; state: FixtureState }> {
  const state: FixtureState = {
    isVetted: false,
    listRequests: 0,
    listRequestUrls: [],
    jobItems: [{
      id: "admin-rich-text-job",
      title: "Customer Success Manager",
      professionalRoleName: "Customer Success Manager",
      description: "<p><strong>Role Overview</strong></p><p>We are looking for an experienced candidate.</p><ul><li>Manage accounts</li><li>Work with clients</li></ul>",
      status: "open",
      approvalStatus: "pending",
      category: "Customer Success",
      engagementType: "Standard",
      location: "Remote",
      clientCompanyName: "Regression Client",
      clientContactName: "Client Owner",
      createdAt: "2026-08-20T12:00:00.000Z",
    }],
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/api/**", (route) => routeApi(route, state));
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("onspot_jwt_token", "test-admin-find-work-jwt");
    localStorage.setItem(
      "onspot_user",
      JSON.stringify({
        id: "admin-find-work-regression",
        email: "admin-find-work-regression@example.test",
        first_name: "Admin",
        last_name: "Regression",
        role: "admin",
      }),
    );
  });
  await page.goto(`${BASE_URL}/admin/find-work`, { waitUntil: "domcontentloaded" });
  return { page, state };
}

function createSortFixture(): FixtureTalent[] {
  const matchingTalent = Array.from({ length: 54 }, (_, index) => {
    const isVetted = index < 27;
    return {
      id: `talent-sort-${index + 1}`,
      email: `sort-regression-${index + 1}@example.test`,
      first_name: isVetted ? "Vetted" : "Not",
      last_name: `Sort ${index + 1}`,
      created_at: new Date(Date.UTC(2026, 7, 23, 0, 0, -index)).toISOString(),
      candidate_id: `candidate-sort-${index + 1}`,
      category: "Operations Specialists",
      profile_completed: true,
      location: "Remote",
      target_position: "Operations Specialist",
      seniority: "Senior",
      headline: "Sort regression talent",
      availability: "Immediately",
      is_vetted: isVetted,
      top_skills: ["Operations"],
      application_statuses: ["new"],
    };
  });

  return [
    ...matchingTalent,
    {
      id: "talent-decoy-search",
      email: "different-person@example.test",
      first_name: "Different",
      last_name: "Person",
      created_at: "2026-08-22T12:00:00.000Z",
      candidate_id: "candidate-decoy-search",
      category: "Operations Specialists",
      profile_completed: true,
      location: "Remote",
      target_position: "Operations Specialist",
      seniority: "Senior",
      headline: "Unrelated talent",
      availability: "Immediately",
      is_vetted: false,
      top_skills: ["Operations"],
      application_statuses: ["new"],
    },
    {
      id: "talent-decoy-skill",
      email: "skill-decoy@example.test",
      first_name: "Skill",
      last_name: "Decoy",
      created_at: "2026-08-21T12:00:00.000Z",
      candidate_id: "candidate-decoy-skill",
      category: "Finance",
      profile_completed: true,
      location: "Remote",
      target_position: "Financial Analyst",
      seniority: "Senior",
      headline: "Different skill",
      availability: "Immediately",
      is_vetted: false,
      top_skills: ["Finance"],
      application_statuses: ["new"],
    },
    {
      id: "talent-decoy-status",
      email: "status-decoy@example.test",
      first_name: "Status",
      last_name: "Decoy",
      created_at: "2026-08-20T12:00:00.000Z",
      candidate_id: "candidate-decoy-status",
      category: "Operations Specialists",
      profile_completed: true,
      location: "Remote",
      target_position: "Operations Specialist",
      seniority: "Senior",
      headline: "Different status",
      availability: "Immediately",
      is_vetted: false,
      top_skills: ["Operations"],
      application_statuses: ["invited"],
    },
  ];
}

async function waitForListRequest(
  state: FixtureState,
  previousRequestCount: number,
  predicate: (url: URL) => boolean,
): Promise<URL> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    for (const requestUrl of state.listRequestUrls.slice(previousRequestCount)) {
      const url = new URL(requestUrl);
      if (predicate(url)) return url;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for an admin talent request after ${previousRequestCount}`);
}

async function rowIds(page: Page): Promise<string[]> {
  return page.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-testid") ?? ""),
  );
}

async function waitForFirstRow(page: Page, talentId: string): Promise<void> {
  const expectedRowId = `talent-row-${talentId}`;
  await page.waitForFunction(
    (expected) => document.querySelector("tbody tr")?.getAttribute("data-testid") === expected,
    expectedRowId,
  );
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

test("admin talent list keeps Vetted sorting through filters and pagination", async () => {
  const { page, state } = await newAdminPage(createSortFixture());
  try {
    const initialRequestCount = state.listRequests;

    await page.getByTestId("talent-vetted-sort").click();
    await page.getByRole("option", { name: "Vetted first", exact: true }).click();
    const vettedFirstRequest = await waitForListRequest(
      state,
      initialRequestCount,
      (url) =>
        url.searchParams.get("sortBy") === "vetted" &&
        url.searchParams.get("sortOrder") === "desc" &&
        url.searchParams.get("page") === "1",
    );
    assert.equal(vettedFirstRequest.searchParams.get("limit"), "50");
    await waitForFirstRow(page, "talent-sort-1");
    assert.deepEqual((await rowIds(page)).slice(0, 3), [
      "talent-row-talent-sort-1",
      "talent-row-talent-sort-2",
      "talent-row-talent-sort-3",
    ]);
    assert.equal((await rowIds(page)).at(-1), "talent-row-talent-sort-50");

    const pageOne = page.getByText(/Page 1 of 2/).locator("..");
    await pageOne.getByRole("button").last().click();
    const pageTwoRequest = await waitForListRequest(
      state,
      state.listRequests - 1,
      (url) =>
        url.searchParams.get("sortBy") === "vetted" &&
        url.searchParams.get("sortOrder") === "desc" &&
        url.searchParams.get("page") === "2",
    );
    assert.equal(pageTwoRequest.searchParams.get("search"), null);
    await page.getByText(/Page 2 of 2/).waitFor();
    await waitForFirstRow(page, "talent-sort-51");
    assert.equal((await rowIds(page))[0], "talent-row-talent-sort-51");

    const beforeNotVettedFirst = state.listRequests;
    await page.getByTestId("talent-vetted-sort").click();
    await page.getByRole("option", { name: "Not vetted first", exact: true }).click();
    const notVettedFirstRequest = await waitForListRequest(
      state,
      beforeNotVettedFirst,
      (url) =>
        url.searchParams.get("sortBy") === "vetted" &&
        url.searchParams.get("sortOrder") === "asc" &&
        url.searchParams.get("page") === "1",
    );
    assert.equal(notVettedFirstRequest.searchParams.get("limit"), "50");
    await waitForFirstRow(page, "talent-sort-28");
    assert.equal((await rowIds(page))[0], "talent-row-talent-sort-28");

    const beforeSearch = state.listRequests;
    await page.getByTestId("talent-search-input").fill("sort-regression");
    const searchRequest = await waitForListRequest(
      state,
      beforeSearch,
      (url) =>
        url.searchParams.get("search") === "sort-regression" &&
        url.searchParams.get("sortBy") === "vetted" &&
        url.searchParams.get("sortOrder") === "asc" &&
        url.searchParams.get("page") === "1",
    );
    assert.equal(searchRequest.searchParams.get("skill"), null);
    await page.getByText("Filtered results — 54 matches", { exact: true }).waitFor();
    await waitForFirstRow(page, "talent-sort-28");
    assert.equal((await rowIds(page))[0], "talent-row-talent-sort-28");
    assert.ok(!(await rowIds(page)).some((id) => id.includes("decoy")));

    const beforeSkill = state.listRequests;
    await page.getByTestId("talent-skill-filter").fill("Operations");
    const skillRequest = await waitForListRequest(
      state,
      beforeSkill,
      (url) =>
        url.searchParams.get("search") === "sort-regression" &&
        url.searchParams.get("skill") === "Operations" &&
        url.searchParams.get("sortBy") === "vetted" &&
        url.searchParams.get("sortOrder") === "asc",
    );
    assert.equal(skillRequest.searchParams.get("applicationStatus"), null);
    await waitForFirstRow(page, "talent-sort-28");
    assert.equal((await rowIds(page))[0], "talent-row-talent-sort-28");
    assert.ok(!(await rowIds(page)).some((id) => id.includes("decoy")));

    const beforeStatus = state.listRequests;
    await page.getByTestId("talent-status-filter").click();
    await page.getByRole("option", { name: "New" }).click();
    const statusRequest = await waitForListRequest(
      state,
      beforeStatus,
      (url) =>
        url.searchParams.get("search") === "sort-regression" &&
        url.searchParams.get("skill") === "Operations" &&
        url.searchParams.get("applicationStatus") === "new" &&
        url.searchParams.get("sortBy") === "vetted" &&
        url.searchParams.get("sortOrder") === "asc",
    );
    await waitForFirstRow(page, "talent-sort-28");
    assert.equal((await rowIds(page))[0], "talent-row-talent-sort-28");
    assert.ok(!(await rowIds(page)).some((id) => id.includes("decoy")));

    const beforeVettedFilter = state.listRequests;
    await page.getByTestId("talent-vetted-filter").click();
    const vettedFilterRequest = await waitForListRequest(
      state,
      beforeVettedFilter,
      (url) =>
        url.searchParams.get("search") === "sort-regression" &&
        url.searchParams.get("skill") === "Operations" &&
        url.searchParams.get("applicationStatus") === "new" &&
        url.searchParams.get("vetted") === "true" &&
        url.searchParams.get("sortBy") === "vetted" &&
        url.searchParams.get("sortOrder") === "asc" &&
        url.searchParams.get("page") === "1",
    );
    assert.equal(vettedFilterRequest.searchParams.get("limit"), "50");
    await page.getByText("Filtered results — 27 matches", { exact: true }).waitFor();
    await waitForFirstRow(page, "talent-sort-1");
    const filteredRows = await rowIds(page);
    assert.equal(filteredRows.length, 27);
    assert.equal(filteredRows[0], "talent-row-talent-sort-1");
    assert.ok(filteredRows.every((id) => !id.includes("decoy")));
  } finally {
    await page.context().close();
  }
});

test("admin pending approval details render rich job descriptions safely", async () => {
  const { page } = await newAdminFindWorkPage();
  try {
    await page.getByRole("button", { name: "Pending Approvals", exact: true }).click();
    await page.getByText("Customer Success Manager", { exact: true }).waitFor();
    await page.getByRole("button", { name: "View Details", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByText("Role Overview", { exact: true }).waitFor();
    await dialog.getByText("We are looking for an experienced candidate.", { exact: true }).waitFor();
    await dialog.getByText("Manage accounts", { exact: true }).waitFor();
    await dialog.getByText("Work with clients", { exact: true }).waitFor();
    assert.equal(await dialog.getByText("<p>", { exact: true }).count(), 0);
    assert.equal(await dialog.getByText("<strong>", { exact: true }).count(), 0);
    assert.equal(await dialog.getByText("<ul>", { exact: true }).count(), 0);
    assert.equal(await dialog.getByText("<li>", { exact: true }).count(), 0);

    await dialog.getByRole("button", { name: "Approve", exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Decline", exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
    await dialog.waitFor({ state: "hidden" });

    await page.getByRole("button", { name: "View Details", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("dialog").filter({ hasText: "Approve this job?" }).getByRole("button", { name: "Cancel", exact: true }).click();

    await page.getByRole("button", { name: "View Details", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Decline", exact: true }).click();
    await page.getByRole("dialog").filter({ hasText: "Decline Job Request" }).getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await page.context().close();
  }
});