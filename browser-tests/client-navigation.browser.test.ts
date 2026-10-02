import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page } from "playwright";
import { functionSource, navigationItems } from "./helpers/clientNavigationSource";

// Actual production router function bodies, shell, sidebar, header and guards.
// Only destination pages are replaced with named probes, and all APIs are
// intercepted. This verifies routing—not live authentication or business UI.
const routerNames = [
  "AppContent", "PublicRouter", "ClientRouter", "SettingsRoute",
  "ClientHireTalentRoute", "ClientTalentRoute", "MessagesRoute", "TalentRouter",
];
const routerSource = routerNames.map(functionSource).join("\n");
const realComponents = new Set([
  ...routerNames, "Route", "Switch", "ClientLayout", "TopNavigation",
  "ClientProtectedRoute", "AdminProtectedRoute", "TalentProtectedRoute",
]);
const pageNames = new Set([
  ...Array.from(routerSource.matchAll(/<([A-Z]\w*)/g), (match) => match[1]),
  ...Array.from(routerSource.matchAll(/component=\{([A-Z]\w*)\}/g), (match) => match[1]),
]);
const pageProbes = [...pageNames].filter((name) => !realComponents.has(name))
  .map((name) => `const ${name} = () => <section data-testid="page-${name}">${name}</section>;`).join("\n");
const expectedPages: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/hire-talent": "HireTalentPage",
  "/messages": "Messages",
  "/client/interviews": "ClientInterviews",
  "/clients": "ClientTeamDashboard",
  "/client/billing": "Billing",
  "/client/monthly-invoices": "Invoicing",
  "/client/contract-endings": "ContractEndings",
  "/client/timesheets": "Timesheets",
  "/client-profile": "ClientProfile",
  "/settings": "ClientSettings",
};
let vite: ViteDevServer;
let browser: Browser;
let cacheDir: string;
let baseUrl: string;

before(async () => {
  cacheDir = mkdtempSync(join(tmpdir(), "client-nav-vite-"));
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir,
    optimizeDeps: { entries: ["src/components/ClientLayout.tsx", "src/components/ProtectedRoute.tsx"] },
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    plugins: [
      react(),
      {
        name: "isolated-client-navigation",
        resolveId(id) { if (id === "/__client-navigation-fixture.tsx") return id; },
        load(id) {
          if (id !== "/__client-navigation-fixture.tsx") return;
          return `
            import React, { useState, useEffect } from "react";
            import { createRoot } from "react-dom/client";
            import { Route, Switch, useLocation } from "wouter";
            import { QueryClientProvider } from "@tanstack/react-query";
            import { queryClient } from "/src/lib/queryClient";
            import { AuthProvider, useAuth } from "/src/contexts/AuthContext";
            import { ClientLayout } from "/src/components/ClientLayout";
            import { TopNavigation } from "/src/components/TopNavigation";
            import { ClientProtectedRoute, AdminProtectedRoute, TalentProtectedRoute } from "/src/components/ProtectedRoute";
            import { loadTalentAuth } from "/src/components/TalentLoginModal";
            import { Toaster } from "/src/components/ui/toaster";
            import "/src/index.css";
            ${pageProbes}
            ${routerSource}
            createRoot(document.getElementById("root")).render(
              <QueryClientProvider client={queryClient}>
                <AuthProvider><AppContent /><Toaster /></AuthProvider>
              </QueryClientProvider>
            );
          `;
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.headers.accept?.includes("text/html")) return next();
            res.setHeader("Content-Type", "text/html");
            res.end(await server.transformIndexHtml("/__client-navigation",
              '<html><body><div id="root"></div><script type="module" src="/__client-navigation-fixture.tsx"></script></body></html>'));
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

async function fixture(width: number, role: "client" | "talent" | null = "client") {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  await context.addInitScript(({ token, role }) => {
    (window as any).__name = (fn: unknown) => fn;
    if (role) {
      localStorage.setItem("onspot_jwt_token", token);
      localStorage.setItem("onspot_user", JSON.stringify({
        id: "navigation-fixture", email: "navigation@example.test",
        role, firstName: "Navigation", lastName: "Fixture",
      }));
    }
    // Never set dev_portal_role, DISABLE_AUTH, or a test-login bypass.
  }, { token, role });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      return route.fulfill({ contentType: "application/json", body: "[]" });
    }
    if (url.origin !== baseUrl) return route.abort();
    return route.continue();
  });
  return { context, page, errors };
}

async function openSidebar(page: Page, mobile: boolean) {
  if (mobile && !(await page.getByRole("dialog", { name: "Sidebar" }).isVisible())) {
    await page.getByTestId("button-sidebar-toggle").click();
    await page.getByRole("dialog", { name: "Sidebar" }).waitFor();
  }
}

for (const width of [1280, 390]) {
  test(`${width}px: every retained Client primary link renders its destination, correct active state and shell`, { timeout: 90_000 }, async () => {
    const f = await fixture(width);
    try {
      await f.page.goto(`${baseUrl}/dashboard`);
      await f.page.getByTestId("page-Dashboard").waitFor({ timeout: 60_000 });
      for (const item of navigationItems) {
        await openSidebar(f.page, width < 768);
        for (const path of ["/contracts", "/payments", "/projects", "/performance", "/roi"]) {
          assert.equal(await f.page.locator(`a[href="${path}"]`).count(), 0);
        }
        const link = f.page.getByTestId(`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`);
        assert.equal(await link.getAttribute("href"), item.url);
        await link.click();
        await f.page.getByTestId(`page-${expectedPages[item.url]}`).waitFor();
        assert.equal(new URL(f.page.url()).pathname, item.url);
        await openSidebar(f.page, width < 768);
        assert.equal(await f.page.getByTestId(`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`).getAttribute("data-active"), "true");
        assert.equal(await f.page.locator('[data-sidebar="menu-button"][data-active="true"]').count(), 1);
        assert.equal(await f.page.getByTestId("page-NotFound").count(), 0);
      }
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

test("nested invoice active state, browser back/forward, and existing Client Jobs routes", { timeout: 45_000 }, async () => {
  const f = await fixture(1280);
  try {
    await f.page.goto(`${baseUrl}/client/billing/invoices/fixture-invoice`);
    await f.page.getByTestId("page-Billing").waitFor();
    assert.equal(await f.page.getByTestId("nav-billing").getAttribute("data-active"), "true");
    assert.equal(await f.page.getByTestId("nav-monthly-invoices").getAttribute("data-active"), "false");
    await f.page.getByTestId("nav-team").click();
    await f.page.getByTestId("page-ClientTeamDashboard").waitFor();
    await f.page.goBack();
    await f.page.getByTestId("page-Billing").waitFor();
    await f.page.goForward();
    await f.page.getByTestId("page-ClientTeamDashboard").waitFor();
    for (const path of ["/client/jobs/new", "/client/jobs/fixture-job/edit"]) {
      await f.page.goto(`${baseUrl}${path}`);
      await f.page.getByTestId("page-JobFormPage").waitFor();
      assert.equal(await f.page.getByTestId("page-NotFound").count(), 0);
    }
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("removed routes are not retargeted and Coming Soon routes remain untouched", { timeout: 45_000 }, async () => {
  const f = await fixture(1280);
  try {
    for (const path of ["/contracts", "/payments"]) {
      await f.page.goto(`${baseUrl}${path}`);
      await f.page.getByTestId("page-NotFound").waitFor();
      assert.equal(new URL(f.page.url()).pathname, path);
    }
    for (const [path, text] of [
      ["/projects", "Projects Module - Coming Soon"],
      ["/performance", "Performance Module - Coming Soon"],
      ["/roi", "ROI Analytics Module - Coming Soon"],
    ]) {
      await f.page.goto(`${baseUrl}${path}`);
      await f.page.getByText(text, { exact: true }).waitFor();
      assert.equal(await f.page.locator(`a[href="${path}"]`).count(), 0);
    }
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("Client cannot enter Admin or Talent-only destinations", { timeout: 45_000 }, async () => {
  const f = await fixture(1280);
  try {
    for (const path of ["/admin/clients", "/candidate-profile/fixture-candidate", "/talent/clock"]) {
      await f.page.goto(`${baseUrl}${path}`);
      await f.page.getByTestId(path === "/talent/clock" ? "page-HireTalentPage" : "page-Dashboard").waitFor();
      assert.equal(await f.page.getByTestId("page-AdminClients").count(), 0);
      assert.equal(await f.page.getByTestId("page-CandidateProfile").count(), 0);
      assert.equal(await f.page.getByTestId("page-TalentClock").count(), 0);
      assert.equal(await f.page.locator('a[href^="/admin/"],a[href^="/talent/"]').count(), 0);
    }
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

for (const role of [null, "talent"] as const) {
  test(`${role ?? "anonymous"} cannot enter Client Team`, { timeout: 30_000 }, async () => {
    const f = await fixture(1280, role);
    try {
      await f.page.goto(`${baseUrl}/clients`);
      await f.page.waitForURL((url) => url.pathname !== "/clients");
      assert.equal(await f.page.getByTestId("page-ClientTeamDashboard").count(), 0);
      assert.equal(await f.page.getByTestId("nav-team").count(), 0);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}