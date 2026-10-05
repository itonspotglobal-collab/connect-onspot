import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page, type Route } from "playwright";

const userTalentId = "talent-alex";
let vite: ViteDevServer;
let browser: Browser;
let cacheDir: string;
let baseUrl: string;

type PeriodFixture = {
  id: string;
  hiringContractId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  workTimezone: string;
  jobTitle: string;
  jobId: string;
  talentId: string;
  talentName: string;
  talentAvatar: string;
  clientId: string;
  clientName: string;
  organizations: Array<{ id: string; name: string }>;
  billingMode: string;
  days: Array<{ date: string; hours: number }>;
  totalHours: number;
  approvalBlocked: boolean;
  blockingIssues: string[];
  sessions: Array<{ id: string; startedAt: string; endedAt: string; effectiveEndAt: string; status: string }>;
  revisions: unknown[];
  corrections: unknown[];
  disputes: unknown[];
};

function period({
  id,
  contractId,
  talentId,
  talentName,
  talentAvatar,
  roleName,
  status,
  workspace,
}: {
  id: string;
  contractId: string;
  talentId: string;
  talentName: string;
  talentAvatar: string;
  roleName: string;
  status: string;
  workspace: { id: string; name: string };
}): PeriodFixture {
  return {
    id,
    hiringContractId: contractId,
    periodStart: "2026-05-04",
    periodEnd: "2026-05-10",
    status,
    workTimezone: "UTC",
    jobTitle: roleName,
    jobId: `job-${contractId}`,
    talentId,
    talentName,
    talentAvatar,
    clientId: "client-fixture",
    clientName: "Morrow Studio",
    organizations: [workspace],
    billingMode: "tracked",
    days: [{ date: "2026-05-05", hours: 7.25 }],
    totalHours: 7.25,
    approvalBlocked: false,
    blockingIssues: [],
    sessions: [{
      id: `session-${id}`,
      startedAt: "2026-05-05T09:00:00.000Z",
      endedAt: "2026-05-05T16:15:00.000Z",
      effectiveEndAt: "2026-05-05T16:15:00.000Z",
      status: "completed",
    }],
    revisions: [],
    corrections: [],
    disputes: [],
  };
}

const northWorkspace = { id: "workspace-north", name: "North workspace" };
const southWorkspace = { id: "workspace-south", name: "South workspace" };
const clientPeriods = [
  period({
    id: "period-alex",
    contractId: "contract-alex",
    talentId: "talent-alex",
    talentName: "Alex Rivera",
    talentAvatar: "/fixture/alex.jpg",
    roleName: "Research Analyst",
    status: "approved",
    workspace: northWorkspace,
  }),
  period({
    id: "period-jules",
    contractId: "contract-jules",
    talentId: "talent-jules",
    talentName: "Jules Park",
    talentAvatar: "/fixture/jules.jpg",
    roleName: "Product Designer",
    status: "approved",
    workspace: southWorkspace,
  }),
];
const guaranteedEngagement = {
  hiringContractId: "contract-guaranteed",
  jobTitle: "Operations Partner",
  jobId: "job-guaranteed",
  talentId: "talent-guaranteed",
  talentName: "Sam Okafor",
  talentAvatar: "/fixture/sam.jpg",
  clientId: "client-fixture",
  clientName: "Morrow Studio",
  organizations: [northWorkspace, southWorkspace],
  billingMode: "guaranteed",
  contractStatus: "signed",
};

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function fixturePage({
  role,
  timesheets,
}: {
  role: "talent" | "client";
  timesheets: Record<string, unknown>;
}): Promise<{ page: Page; context: Awaited<ReturnType<Browser["newContext"]>>; unexpectedApiRequests: string[]; organizationRequests: string[] }> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  await context.addInitScript(({ role }) => {
    localStorage.setItem("onspot_jwt_token", "fixture-only-jwt");
    localStorage.setItem("onspot_user", JSON.stringify({
      id: role === "talent" ? "user-talent-fixture" : "user-client-fixture",
      email: `${role}@example.test`,
      first_name: role === "talent" ? "Alex" : "Casey",
      last_name: role === "talent" ? "Rivera" : "Client",
      role,
    }));
    localStorage.setItem(
      `onboarding_completed_${role === "talent" ? "user-talent-fixture" : "user-client-fixture"}`,
      "true",
    );
  }, { role });

  const page = await context.newPage();
  const unexpectedApiRequests: string[] = [];
  const organizationRequests: string[] = [];
  await page.route("**/fixture/*.jpg", async (route) => {
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/T1sAAAAASUVORK5CYII=", "base64"),
    });
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;
    if (pathname === "/api/talent/timesheets") {
      assert.equal(request.method(), "GET");
      return fulfillJson(route, timesheets);
    }
    if (pathname === "/api/client/timesheets") {
      assert.equal(request.method(), "GET");
      organizationRequests.push(searchParams.get("organizationId") ?? "");
      return fulfillJson(route, {
        periods: clientPeriods,
        engagements: [
          ...clientPeriods.map((item) => ({
            hiringContractId: item.hiringContractId,
            jobTitle: item.jobTitle,
            jobId: item.jobId,
            talentId: item.talentId,
            talentName: item.talentName,
            talentAvatar: item.talentAvatar,
            clientId: item.clientId,
            clientName: item.clientName,
            organizations: item.organizations,
            billingMode: item.billingMode,
            contractStatus: "signed",
          })),
          guaranteedEngagement,
        ],
        eligible: true,
        trackedEligible: true,
      });
    }
    if (pathname === "/api/profiles/me") return fulfillJson(route, { profile: { profilePicture: null } });
    if (pathname === "/api/candidates/me") return fulfillJson(route, { profileCompleted: true });
    if (pathname === `/api/users/${role === "talent" ? "user-talent-fixture" : "user-client-fixture"}/notifications`) {
      return fulfillJson(route, []);
    }
    if (pathname === "/api/me/message-threads") return fulfillJson(route, { unreadMessageCount: 0 });
    if (pathname === "/api/notifications/hired-popup/claim" && request.method() === "POST") {
      return fulfillJson(route, null);
    }
    unexpectedApiRequests.push(`${request.method()} ${pathname}`);
    return fulfillJson(route, { error: "Unexpected fixture API request" }, 501);
  });

  return { page, context, unexpectedApiRequests, organizationRequests };
}

before(async () => {
  cacheDir = mkdtempSync(join(tmpdir(), "timesheets-vite-"));
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir,
    optimizeDeps: { entries: ["src/pages/Timesheets.tsx", "src/components/TopNavigation.tsx"] },
    resolve: {
      alias: {
        "@": resolve("client/src"),
        "@shared": resolve("shared"),
        "@assets": resolve("attached_assets"),
      },
    },
    plugins: [
      react(),
      {
        name: "timesheets-browser-fixture",
        resolveId(id) {
          if (id === "/__timesheets-browser-fixture.tsx") return id;
        },
        load(id) {
          if (id !== "/__timesheets-browser-fixture.tsx") return;
          return `
            import React from "react";
            import { createRoot } from "react-dom/client";
            import { QueryClientProvider } from "@tanstack/react-query";
            import { queryClient } from "/src/lib/queryClient";
            import { AuthProvider } from "/src/contexts/AuthContext";
            import { Switch, Route } from "wouter";
            import Timesheets from "/src/pages/Timesheets";
            import "/src/index.css";

            function FixtureRoutes() {
              return <Switch>
                <Route path="/talent/clock"><main data-testid="clock-destination">Talent Clock fixture</main></Route>
                <Route path="/talent/timesheets"><Timesheets role="talent" /></Route>
                <Route path="/client/timesheets"><Timesheets role="client" /></Route>
                <Route><main data-testid="unmatched-route">No fixture route</main></Route>
              </Switch>;
            }

            createRoot(document.getElementById("root")).render(
              <QueryClientProvider client={queryClient}>
                <AuthProvider><FixtureRoutes /></AuthProvider>
              </QueryClientProvider>
            );
          `;
        },
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            if (!request.headers.accept?.includes("text/html")) return next();
            response.setHeader("Content-Type", "text/html");
            response.end(await server.transformIndexHtml(
              "/__timesheets-browser",
              '<html><body><div id="root"></div><script type="module" src="/__timesheets-browser-fixture.tsx"></script></body></html>',
            ));
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

test("eligible Talent gets Open Clock and Timesheets navigation; non-hired Talent gets only the eligibility state", { timeout: 90_000 }, async () => {
  for (const eligibility of ["eligible", "not-hired"] as const) {
    const timesheets = eligibility === "eligible"
      ? {
          eligible: true,
          trackedEligible: true,
          engagements: [],
          periods: [period({
            id: "talent-period",
            contractId: "talent-contract",
            talentId: userTalentId,
            talentName: "Alex Rivera",
            talentAvatar: "/fixture/alex.jpg",
            roleName: "Research Analyst",
            status: "open",
            workspace: northWorkspace,
          })],
        }
      : { eligible: false, trackedEligible: false, engagements: [], periods: [] };
    const f = await fixturePage({ role: "talent", timesheets });
    try {
      await f.page.goto(`${baseUrl}/talent/timesheets`);
      await f.page.getByRole("heading", { name: "Timesheets" }).waitFor();
      if (eligibility === "eligible") {
        const openClock = f.page.getByRole("link", { name: "Open Clock" });
        await openClock.waitFor();
        assert.equal(await openClock.getAttribute("href"), "/talent/clock");
        await f.page.getByTestId("account-dropdown-trigger").click();
        const timesheetMenuItem = f.page.getByRole("menuitem", { name: "Timesheets", exact: true });
        await timesheetMenuItem.waitFor();
        await timesheetMenuItem.click();
        assert.equal(new URL(f.page.url()).pathname, "/talent/timesheets");
        await openClock.click();
        await f.page.getByTestId("clock-destination").waitFor();
        assert.equal(new URL(f.page.url()).pathname, "/talent/clock");
      } else {
        await f.page.getByText("Timesheets become available after you are hired by a Client.").waitFor();
        await f.page.getByTestId("account-dropdown-trigger").click();
        assert.equal(await f.page.getByRole("menuitem", { name: "Timesheets", exact: true }).count(), 0);
        assert.equal(await f.page.getByRole("link", { name: "Open Clock" }).count(), 0);
      }
      assert.deepEqual(f.unexpectedApiRequests, []);
    } finally {
      await f.context.close();
    }
  }
});

test("Client deep links and filters retain hired Talent context; Guaranteed engagements are not tracked", { timeout: 90_000 }, async () => {
  const f = await fixturePage({
    role: "client",
    timesheets: { eligible: false, trackedEligible: false, engagements: [], periods: [] },
  });
  try {
    await f.page.goto(`${baseUrl}/client/timesheets?talentId=talent-alex&organizationId=workspace-north`);
    await f.page.getByRole("heading", { name: "Alex Rivera" }).waitFor();
    assert.equal(await f.page.getByRole("button").filter({ hasText: "Jules Park" }).count(), 0);
    assert.ok(await f.page.locator('img[src="/fixture/alex.jpg"]').count() >= 1, "Talent avatar should be visible on the Client timesheet");
    await f.page.getByText("Client workspaces: North workspace").first().waitFor();
    assert.deepEqual(f.organizationRequests, ["workspace-north"]);

    await f.page.goto(`${baseUrl}/client/timesheets`);
    await f.page.getByRole("heading", { name: "Alex Rivera" }).waitFor();
    const select = (name: string) => f.page.getByRole("combobox", { name });
    const resetFilters = async () => {
      await select("Filter by Talent").selectOption("");
      await select("Filter by role").selectOption("");
      await select("Filter by status").selectOption("");
      await select("Filter by period").selectOption("");
      await select("Filter by engagement").selectOption("");
    };

    await select("Filter by Talent").selectOption("talent-jules");
    await f.page.getByRole("heading", { name: "Jules Park" }).waitFor();
    await resetFilters();
    await select("Filter by role").selectOption("Product Designer");
    await f.page.getByRole("heading", { name: "Jules Park" }).waitFor();
    await resetFilters();
    await select("Filter by status").selectOption("approved");
    assert.equal(await f.page.getByRole("button").filter({ hasText: "Alex Rivera" }).count(), 1);
    assert.equal(await f.page.getByRole("button").filter({ hasText: "Jules Park" }).count(), 1);
    await resetFilters();
    await select("Filter by period").selectOption("period-jules");
    await f.page.getByRole("heading", { name: "Jules Park" }).waitFor();
    await resetFilters();
    await select("Filter by engagement").selectOption("contract-alex");
    await f.page.getByRole("heading", { name: "Alex Rivera" }).waitFor();
    await resetFilters();
    await f.page.getByRole("heading", { name: "Alex Rivera" }).waitFor();

    const dispute = f.page.getByPlaceholder("Describe the issue with this approved period");
    await dispute.fill("Check this first period only");
    await f.page.getByRole("button").filter({ hasText: "Jules Park" }).first().click();
    await f.page.getByRole("heading", { name: "Jules Park" }).waitFor();
    await f.page.waitForFunction(() => {
      const draft = document.querySelector<HTMLTextAreaElement>('[placeholder="Describe the issue with this approved period"]');
      return draft?.value === "";
    });
    assert.equal(await dispute.inputValue(), "", "switching periods must clear the previous dispute draft");

    await select("Filter by engagement").selectOption("contract-guaranteed");
    await f.page.getByText("Not tracked", { exact: true }).waitFor();
    await f.page.getByText("Guaranteed engagement; clock attendance is not required.").waitFor();
    assert.equal(await f.page.getByText("0.00", { exact: true }).count(), 0);
    assert.deepEqual(f.unexpectedApiRequests, []);
  } finally {
    await f.context.close();
  }
});
