import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CLIENT_ID = "client-job-search-ui";
const JOB_ID = "job-search-ui";
const TALENT_ID = "talent-search-ui";

let browser: Browser;
let vite: ChildProcess | undefined;
let invitationPayload: Record<string, unknown> | undefined;

async function waitForUrl(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function routeApi(route: Route): Promise<void> {
  const request = route.request();
  const path = new URL(request.url()).pathname;

  if (request.method() === "GET" && path === "/api/client-profile/me") {
    return fulfillJson(route, { companyName: "UI Regression Co.", preferredRoles: [], createdAt: "2026-01-01T00:00:00.000Z" });
  }
  if (request.method() === "GET" && path === "/api/client/msa-status") {
    return fulfillJson(route, { accepted: true, acceptedAt: "2026-01-01T00:00:00.000Z", version: "v1", currentVersion: "v1", termsUrl: "/terms-and-conditions" });
  }
  if (request.method() === "GET" && path === "/api/platform-settings/public") {
    return fulfillJson(route, { nameRevealThreshold: "submitted" });
  }
  if (request.method() === "GET" && path === "/api/client/jobs") {
    return fulfillJson(route, [{
      id: JOB_ID,
      title: "Customer Support Specialist",
      status: "open",
      approvalStatus: "approved",
      createdAt: "2026-01-01T00:00:00.000Z",
      category: "Customer Support",
      location: "Remote",
      engagementType: "Standard",
      proposalCount: 0,
    }]);
  }
  if (request.method() === "POST" && path === `/api/client/jobs/${JOB_ID}/talent-search`) {
    return fulfillJson(route, {
      results: [{
        candidateId: "candidate-search-ui",
        userId: TALENT_ID,
        score: 92,
        overlapSkills: ["Customer support", "Zendesk"],
        candidate: {
          maskedName: "Jane S.",
          targetPosition: "Customer Support Specialist",
          availability: "Available now",
          location: "Remote",
          coreSkills: ["Customer support", "Zendesk"],
          secondarySkills: [],
        },
      }],
      invitedTalentIds: [],
    });
  }
  if (request.method() === "GET" && path === `/api/client/talent-profile/${TALENT_ID}`) {
    return fulfillJson(route, {
      maskedName: "Jane S.",
      targetPosition: "Customer Support Specialist",
      availability: "Available now",
      location: "Remote",
      summary: "Experienced customer support specialist.",
      coreSkills: ["Customer support", "Zendesk"],
      secondarySkills: [],
    });
  }
  if (request.method() === "POST" && path === "/api/client/invitations") {
    invitationPayload = request.postDataJSON() as Record<string, unknown>;
    return fulfillJson(route, { id: "invitation-search-ui" }, 201);
  }
  if (request.method() === "GET" && path === "/api/client/job-submissions") return fulfillJson(route, []);
  if (request.method() === "GET" && path === "/api/me/message-threads") return fulfillJson(route, { threads: [] });

  // Shared page chrome issues unrelated requests; a harmless successful
  // response keeps this test focused on the Client Profile interaction.
  return fulfillJson(route, []);
}

async function newClientPage(): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/api/**", routeApi);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ clientId }) => {
    localStorage.clear();
    localStorage.setItem("onspot_jwt_token", "client-job-search-ui-jwt");
    localStorage.setItem("onspot_user", JSON.stringify({
      id: clientId,
      email: "client-job-search-ui@example.test",
      first_name: "Client",
      last_name: "Regression",
      role: "client",
    }));
  }, { clientId: CLIENT_ID });
  await page.goto(`${BASE_URL}/client-profile`, { waitUntil: "domcontentloaded" });
  return page;
}

before(async () => {
  invitationPayload = undefined;
  if (!process.env.BROWSER_BASE_URL) {
    const viteEnv = { ...process.env };
    delete viteEnv.REPL_ID;
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)], {
      stdio: "pipe",
      env: { ...viteEnv, NODE_ENV: "development" },
    });
    vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    await waitForUrl(BASE_URL);
  }
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { headless: true });
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([once(vite, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
});

test("Client Profile keeps job-specific talent search inline and sends one selected-job invitation", async () => {
  const page = await newClientPage();
  try {
    for (const label of ["Dashboard", "Find Talent", "Messages", "Projects", "Performance", "Team", "Contracts", "Payments", "Billing", "ROI Analytics", "Settings"]) {
      assert.ok(await page.getByText(label, { exact: true }).count(), `${label} must be rendered in Client navigation`);
    }
    for (const oldLabel of ["OnSpot Talent", "Client Projects", "Client Management"]) {
      assert.equal(await page.getByText(oldLabel, { exact: true }).count(), 0, `${oldLabel} must not appear in the Client sidebar`);
    }

    await page.getByRole("button", { name: "Invite Talent" }).click();
    await page.getByRole("heading", { name: "Invite Talent to Apply" }).waitFor();
    await page.getByText("Customer Support Specialist", { exact: true }).first().waitFor();
    assert.match(page.url(), /\/client-profile$/, "opening job talent search must not navigate away");

    await page.getByText("Jane S.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.getByText("Safe client-facing profile preview").waitFor();
    await page.getByText("Experienced customer support specialist.").waitFor();
    await page.getByRole("button", { name: "Close" }).last().click();

    await page.locator("#invite-time").fill("2030-01-02T10:00");
    await page.getByRole("button", { name: "Invite to Apply" }).click();
    await page.getByRole("button", { name: "Invited" }).waitFor();
    assert.match(page.url(), /\/client-profile$/, "sending an invitation must keep the Client Profile route");
    assert.equal(invitationPayload?.jobId, JOB_ID);
    assert.equal(invitationPayload?.talentUserId, TALENT_ID);
    assert.ok(Array.isArray(invitationPayload?.proposedTimes));
  } finally {
    await page.context().close();
  }
});