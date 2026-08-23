import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CANDIDATE_ID = "candidate-invite-regression";
const CLIENT_ID = "client-invite-regression";

let browser: Browser;
let vite: ChildProcess | undefined;
let invitationPayloads: Record<string, unknown>[] = [];

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
  const path = new URL(request.url()).pathname;

  if (request.method() === "GET" && path === "/api/candidates") {
    return fulfillJson(route, [
      {
        id: CANDIDATE_ID,
        fullName: "Alex Example",
        displayName: "Alex Example",
        targetPosition: "Senior Operations Specialist",
        category: "Operations Specialists",
        location: "Remote",
        seniority: "Senior",
        experienceYears: "8",
        coreSkills: ["Operations", "Project Management"],
        secondarySkills: [],
        preferences: {},
        profileCompleted: true,
      },
    ]);
  }

  if (
    request.method() === "GET" &&
    path === `/api/candidates/${CANDIDATE_ID}`
  ) {
    return fulfillJson(route, {
      id: CANDIDATE_ID,
      fullName: "Alex Example",
      displayName: "Alex Example",
      targetPosition: "Senior Operations Specialist",
      category: "Operations Specialists",
      location: "Remote",
      seniority: "Senior",
      experienceYears: "8",
      coreSkills: ["Operations", "Project Management"],
      secondarySkills: [],
      preferences: {},
      workHistory: [],
      education: [],
      certifications: [],
      summary: "A strong operations leader.",
      profileCompleted: true,
    });
  }

  if (request.method() === "GET" && path === "/api/client-profile/me") {
    return fulfillJson(route, {
      companyName: "Regression Client",
      preferredRoles: ["Operations Specialists"],
    });
  }

  if (request.method() === "GET" && path === "/api/client/jobs") {
    return fulfillJson(route, [
      {
        id: "job-invite-regression",
        title: "Operations Lead",
        status: "open",
        approvalStatus: "approved",
        engagementType: "Standard",
      },
    ]);
  }

  if (
    request.method() === "POST" &&
    path === "/api/client/invitations"
  ) {
    invitationPayloads.push(request.postDataJSON() as Record<string, unknown>);
    return fulfillJson(route, { id: "invitation-regression" }, 201);
  }

  if (request.method() === "GET" && path.endsWith("/culture-evaluation")) {
    return fulfillJson(route, null);
  }

  // TopNavigation and other shared client chrome make additional API calls.
  // They are irrelevant to this UI contract, so return empty successful data.
  return fulfillJson(route, []);
}

async function newClientPage(): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/api/**", routeApi);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ clientId }) => {
    localStorage.clear();
    localStorage.setItem("onspot_jwt_token", "test-client-invite-jwt");
    localStorage.setItem(
      "onspot_user",
      JSON.stringify({
        id: clientId,
        email: "client-invite@example.test",
        first_name: "Invite",
        last_name: "Client",
        role: "client",
      }),
    );
  }, { clientId: CLIENT_ID });
  await page.goto(`${BASE_URL}/talent-pool`, { waitUntil: "domcontentloaded" });
  return page;
}

before(async () => {
  invitationPayloads = [];
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

test("Talent Pool card CTA opens the combined invite flow and submits candidate IDs safely", async () => {
  const page = await newClientPage();
  try {
    await page.getByRole("button", { name: "Shortlist / Invite" }).first().click();
    await page.getByRole("heading", { name: "Invite Alex E.?" }).waitFor();
    await page.getByText("Propose an initial interview time").waitFor();
    await page.locator('input[type="datetime-local"]').fill("2030-01-02T10:00");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await page.getByText("Invitation sent").waitFor();
    assert.deepEqual(invitationPayloads.at(-1), {
      jobId: "job-invite-regression",
      candidateId: CANDIDATE_ID,
      proposedTimes: [
        {
          start: "2030-01-02T10:00:00.000Z",
          timezone: "UTC",
        },
      ],
    });
  } finally {
    await page.context().close();
  }
});

test("client full talent profile CTA opens the same invite flow", async () => {
  const page = await newClientPage();
  try {
    await page.getByRole("button", { name: "Full Profile" }).first().click();
    await page.waitForURL(new RegExp(`/talent-profile/${CANDIDATE_ID}$`));
    await page.getByRole("button", { name: "Shortlist / Invite" }).click();
    await page.getByRole("heading", { name: "Invite Alex E.?" }).waitFor();
    await page.getByText("Propose an initial interview time").waitFor();
  } finally {
    await page.context().close();
  }
});

test("Talent Pool quick view exposes the invite CTA", async () => {
  const page = await newClientPage();
  try {
    await page.getByRole("button", { name: "Quick View" }).first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Shortlist / Invite" })
      .click();
    await page.getByRole("heading", { name: "Invite Alex E.?" }).waitFor();
    await page.getByText("Propose an initial interview time").waitFor();
  } finally {
    await page.context().close();
  }
});