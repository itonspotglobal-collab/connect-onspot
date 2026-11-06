import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page } from "playwright";

let vite: ViteDevServer;
let browser: Browser;
let cacheDir: string;
let baseUrl: string;

before(async () => {
  cacheDir = mkdtempSync(join(tmpdir(), "onspot-contract-party-browser-"));
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir,
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
        name: "contract-party-browser-fixture",
        resolveId(id) {
          if (id === "/__contract-party-fixture.tsx") return id;
        },
        load(id) {
          if (id !== "/__contract-party-fixture.tsx") return;
          return `
            import React from "react";
            import { createRoot } from "react-dom/client";
            import { QueryClientProvider, useQuery } from "@tanstack/react-query";
            import { ContractPartyDetails } from "/src/components/ContractPartyDetails";
            import { Toaster } from "/src/components/ui/toaster";
            import { queryClient } from "/src/lib/queryClient";

            function ParentQueryProbe({ scope }) {
              const organization = scope === "organization";
              const queryKey = organization
                ? ["/api/organizations", "org-fixture"]
                : ["/api/client-profile/me"];
              const endpoint = organization
                ? "/api/organizations/org-fixture"
                : "/api/client-profile/me";
              const query = useQuery({
                queryKey,
                enabled: scope !== "talent",
                queryFn: async () => {
                  const response = await fetch(endpoint, { credentials: "include" });
                  return response.json();
                },
              });
              return <output data-testid="parent-profile-sequence">{query.data?.__requestSeq ?? "loading"}</output>;
            }

            function Fixture() {
              const params = new URLSearchParams(window.location.search);
              const scope = params.get("scope") || "client";
              const privateOwner = params.get("owner") !== "false";
              return <>
                <ParentQueryProbe scope={scope} />
                <ContractPartyDetails
                  scope={scope}
                  organizationId={scope === "organization" ? "org-fixture" : undefined}
                  candidateId={scope === "talent" ? "candidate-fixture" : undefined}
                  canEdit={privateOwner}
                />
              </>;
            }

            createRoot(document.getElementById("root")).render(
              <QueryClientProvider client={queryClient}><Fixture /><Toaster /></QueryClientProvider>
            );
          `;
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.headers.accept?.includes("text/html")) return next();
            res.setHeader("Content-Type", "text/html");
            res.end(await server.transformIndexHtml(
              "/__contract-party-fixture",
              '<html><body><div id="root"></div><script type="module" src="/__contract-party-fixture.tsx"></script></body></html>',
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
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
});

after(async () => {
  await browser?.close();
  await vite?.close();
  if (cacheDir) rmSync(cacheDir, { recursive: true, force: true });
});

type ApiCall = { method: string; url: string; body?: Record<string, unknown>; authorization?: string };
type FixturePage = { page: Page; context: Awaited<ReturnType<Browser["newContext"]>>; calls: ApiCall[] };

function initialData(scope: string): Record<string, unknown> {
  if (scope === "talent") {
    return {
      legalFullName: "Casey Rivera",
      addressLine1: "18 Garden Street",
      addressLine2: null,
      city: "Tacoma",
      stateRegion: "WA",
      postalCode: "98402",
      country: "United States",
      taxIdLast4: null,
    };
  }
  return {
    legalEntityName: scope === "client" ? "Orchid Systems Ltd" : "Northwind Studio LLC",
    entityType: "Limited company",
    addressLine1: "18 Garden Street",
    addressLine2: null,
    city: "Tacoma",
    stateRegion: "WA",
    postalCode: "98402",
    country: "United States",
    signatoryName: "Jordan Lee",
    signatoryTitle: "Director",
  };
}

async function openFixture(scope: "client" | "organization" | "talent", owner = true): Promise<FixturePage> {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    serviceWorkers: "block",
  });
  if (scope === "talent") {
    const candidateId = "candidate-fixture";
    const payload = Buffer.from(JSON.stringify({
      type: "candidate",
      candidateId,
      email: "talent.fixture@example.test",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const token = `header.${payload}.signature`;
    await context.addInitScript(({ token, candidateId }) => {
      localStorage.setItem("talent_profile_token", JSON.stringify({
        token,
        candidateId,
        email: "talent.fixture@example.test",
        fullName: "Casey Rivera",
      }));
    }, { token, candidateId });
  }

  const page = await context.newPage();
  const calls: ApiCall[] = [];
  let saved = initialData(scope);
  let sequence = 0;
  // Catch every API request. Anything outside this tiny fixture API gets an
  // explicit 404; the test browser cannot reach a real account or service.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = method === "PUT" || method === "PATCH" ? request.postDataJSON() as Record<string, unknown> : undefined;
    calls.push({
      method,
      url: `${url.pathname}${url.search}`,
      body,
      authorization: request.headers().authorization,
    });

    const clientPath = "/api/client-profile/me";
    const organizationPath = "/api/organizations/org-fixture";
    const talentPath = "/api/candidates/candidate-fixture/contract-party-details";
    if (url.pathname === clientPath && scope === "client") {
      if (method === "PUT") saved = { ...saved, ...body };
      sequence++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...saved, __requestSeq: sequence }),
      });
    }
    if (url.pathname === organizationPath && scope === "organization") {
      if (method === "PATCH") saved = { ...saved, ...body };
      sequence++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ organization: saved, __requestSeq: sequence }),
      });
    }
    if (url.pathname === talentPath && scope === "talent") {
      if (method === "PATCH") saved = { ...saved, ...body };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(saved),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unmocked API request in isolated browser test" }),
    });
  });

  await page.goto(`${baseUrl}/contract-party?scope=${scope}&owner=${owner ? "true" : "false"}`);
  return { page, context, calls };
}

async function parentSequence(page: Page): Promise<number> {
  await page.getByTestId("parent-profile-sequence").waitFor();
  return Number(await page.getByTestId("parent-profile-sequence").innerText());
}

test("Client editor cancels drafts, clears fields, saves the PUT payload, and reloads persisted data", async () => {
  const { context, page, calls } = await openFixture("client");
  try {
    await page.getByText("Orchid Systems Ltd", { exact: true }).waitFor();
    const startingSequence = await parentSequence(page);

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Legal entity name").fill("Unsaved change");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByText("Orchid Systems Ltd", { exact: true }).waitFor();
    assert.equal(calls.some((call) => call.method === "PUT"), false, "cancel must not submit a request");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Legal entity name").fill("");
    await page.getByLabel("City").fill("Portland");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Contract details saved").waitFor();

    const saveCall = calls.find((call) => call.method === "PUT");
    assert.ok(saveCall);
    assert.equal(saveCall.url, "/api/client-profile/me");
    assert.equal(saveCall.body?.legalEntityName, null);
    assert.equal(saveCall.body?.city, "Portland");
    await page.getByText("Portland", { exact: true }).waitFor();
    await page.waitForFunction((before) => {
      const value = Number(document.querySelector('[data-testid="parent-profile-sequence"]')?.textContent);
      return value > before;
    }, startingSequence);

    await page.reload();
    await page.getByText("Portland", { exact: true }).waitFor();
    await page.getByText("Orchid Systems Ltd", { exact: true }).waitFor({ state: "detached" });
  } finally {
    await context.close();
  }
});

test("Organization owner editor PATCHes legal details, refreshes its parent settings query, and reloads saved values", async () => {
  const { context, page, calls } = await openFixture("organization");
  try {
    await page.getByText("Northwind Studio LLC", { exact: true }).waitFor();
    const startingSequence = await parentSequence(page);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Signatory title").fill("Managing Partner");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Contract details saved").waitFor();

    const saveCall = calls.find((call) => call.method === "PATCH");
    assert.ok(saveCall);
    assert.equal(saveCall.url, "/api/organizations/org-fixture");
    assert.equal(saveCall.body?.signatoryTitle, "Managing Partner");
    await page.getByText("Managing Partner", { exact: true }).waitFor();
    await page.waitForFunction((before) => {
      const value = Number(document.querySelector('[data-testid="parent-profile-sequence"]')?.textContent);
      return value > before;
    }, startingSequence);

    await page.reload();
    await page.getByText("Managing Partner", { exact: true }).waitFor();
  } finally {
    await context.close();
  }
});

test("Talent validates exactly four digits, preserves 0012 on PATCH and reload, and hides private fields when not owner-editable", async () => {
  const { context, page, calls } = await openFixture("talent");
  try {
    await page.getByText("Casey Rivera", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit" }).click();
    const taxId = page.getByLabel(/Tax ID — last 4 digits/);
    await taxId.fill("12");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("alert").filter({ hasText: "Enter exactly four digits" }).waitFor();
    assert.equal(calls.some((call) => call.method === "PATCH"), false, "invalid digits must not reach the API");

    await taxId.fill("0012");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Contract details saved").waitFor();
    const saveCall = calls.find((call) => call.method === "PATCH");
    assert.ok(saveCall);
    assert.equal(saveCall.url, "/api/candidates/candidate-fixture/contract-party-details");
    assert.equal(saveCall.body?.taxIdLast4, "0012");
    const getCall = calls.find((call) => call.method === "GET");
    assert.ok(getCall?.authorization?.startsWith("Bearer header."));
    assert.equal(saveCall.authorization, getCall.authorization, "PATCH must use the same candidate-owner token as the private GET");
    await page.getByText("0012", { exact: true }).waitFor();

    await page.reload();
    await page.getByText("0012", { exact: true }).waitFor();
  } finally {
    await context.close();
  }

  const hidden = await openFixture("talent", false);
  try {
    await hidden.page.waitForLoadState("networkidle");
    assert.equal(await hidden.page.getByText("Private contract details", { exact: true }).count(), 0);
    assert.equal(await hidden.page.getByLabel(/Tax ID/).count(), 0);
    assert.equal(hidden.calls.some((call) => call.url.includes("/contract-party-details")), false);
  } finally {
    await hidden.context.close();
  }
});
