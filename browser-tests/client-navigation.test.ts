import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  appSource, functionSource, layoutSource, navigationItems, routesInFunction,
} from "./helpers/clientNavigationSource";

const outer = routesInFunction("AppContent");
const client = routesInFunction("ClientRouter");
const publicRoutes = routesInFunction("PublicRouter");
const removed = ["/contracts", "/payments", "/projects", "/performance", "/roi"];
const retained = [
  "/dashboard", "/hire-talent", "/messages", "/client/interviews", "/clients",
  "/client/billing", "/client/monthly-invoices", "/client/contract-endings",
  "/client/timesheets", "/client-profile", "/settings",
];

describe("Client navigation and production router coverage", () => {
  it("retains every working primary item exactly once and removes only the five approved entries", () => {
    assert.deepEqual(navigationItems.map((item) => item.url).sort(), [...retained].sort());
    assert.equal(new Set(navigationItems.map((item) => item.title)).size, navigationItems.length);
  });

  for (const { title, url } of navigationItems) {
    it(`${title} has both a mounted outer route and an intentional Client destination`, () => {
      assert.ok(outer.has(url), `Missing outer route for ${url}`);
      assert.ok(client.has(url), `Missing Client route for ${url}`);
      assert.doesNotMatch(client.get(url)!.component, /NotFound|Coming Soon|Admin|TalentProtectedRoute/);
      const dispatch = outer.get(url)!.component;
      assert.match(dispatch, /^(ClientRouter|ClientHireTalentRoute|MessagesRoute|SettingsRoute)$/);
      if (dispatch === "ClientHireTalentRoute") {
        assert.match(functionSource(dispatch), /user\?\.role === "client" \? <ClientRouter/);
      }
      if (dispatch === "SettingsRoute") {
        assert.match(functionSource(dispatch), /user\?\.role === "client"/);
        assert.match(functionSource(dispatch), /<ClientLayout>\s*<ClientSettings/);
      }
    });
  }

  for (const url of removed) {
    it(`${url} is absent from Client navigation`, () => {
      assert.ok(!navigationItems.some((item) => item.url === url));
    });
  }

  it("does not mount or redirect the obsolete Contracts/Payments destinations", () => {
    for (const url of removed.slice(0, 2)) {
      assert.ok(!outer.has(url) && !client.has(url) && !publicRoutes.has(url));
    }
  });

  it("keeps existing Coming Soon routes/components intact but unexposed", () => {
    for (const url of removed.slice(2)) {
      assert.equal(outer.get(url)?.component, "ClientRouter");
      assert.match(client.get(url)?.component ?? "", /Coming Soon/);
    }
  });

  it("preserves Team, contract endings, Client finance, and nested invoice routes", () => {
    assert.equal(client.get("/clients")?.component, "ClientTeamDashboard");
    for (const [path, component] of [
      ["/client/contract-endings", "ContractEndings"],
      ["/client/timesheets", "Timesheets"],
      ["/client/monthly-invoices", "Invoicing"],
    ]) {
      assert.match(client.get(path)?.component ?? "", new RegExp(`<${component} role="client"`));
      assert.equal(outer.get(path)?.component, "ClientRouter");
    }
    for (const path of ["/client/billing", "/client/billing/invoices/:id"]) {
      assert.equal(client.get(path)?.component, "Billing");
      assert.equal(outer.get(path)?.component, "ClientRouter");
    }
  });

  it("preserves protected Client job create/edit and public job browsing routes", () => {
    for (const path of ["/client/jobs/new", "/client/jobs/:jobId/edit"]) {
      assert.match(publicRoutes.get(path)?.component ?? "", /<ClientProtectedRoute><JobFormPage mode="client"/);
    }
    for (const path of ["/jobs", "/jobs/:jobId", "/find-work/jobs"]) assert.ok(outer.has(path));
  });

  it("keeps account/dropdown and organization destinations mounted", () => {
    for (const path of ["/organization/create", "/organization-invitations", "/organization/:organizationId"]) {
      assert.equal(outer.get(path)?.component, "ClientRouter");
      assert.ok(client.has(path));
    }
    const topNavigation = readFileSync("client/src/components/TopNavigation.tsx", "utf8");
    const clientDropdown = topNavigation.split('if (user?.role === "client") return [')[1]?.split("];")[0];
    assert.ok(clientDropdown);
    for (const match of clientDropdown.matchAll(/route: "([^"]+)"/g)) {
      assert.ok(outer.has(match[1]), `Unregistered Client dropdown path ${match[1]}`);
      assert.ok(client.has(match[1]), `Missing Client destination ${match[1]}`);
    }
    assert.doesNotMatch(clientDropdown, /\/contracts|\/payments|\/projects|\/performance|\/roi/);
  });

  it("uses one production sidebar for desktop/mobile without changing active-state matching", () => {
    assert.equal((layoutSource.match(/<ClientSidebar\s*\/>/g) ?? []).length, 1);
    assert.match(layoutSource, /data-testid="button-sidebar-toggle"/);
    assert.match(layoutSource, /location === url \|\| \(url !== "\/dashboard" && location\.startsWith\(`\$\{url\}\/`\)\)/);
    for (const list of ["coreModules", "managementItems", "systemItems"]) {
      assert.match(layoutSource, new RegExp(`${list}\\.map`));
    }
  });

  it("keeps role isolation and does not expose Admin/Talent-only navigation", () => {
    assert.match(functionSource("ClientRouter"), /<ClientProtectedRoute>/);
    assert.match(layoutSource, /user\?\.role === 'admin' &&/);
    for (const item of navigationItems) assert.doesNotMatch(item.url, /^\/(admin|talent)\//);
    const guards = readFileSync("client/src/components/ProtectedRoute.tsx", "utf8");
    for (const role of ["client", "talent", "admin"]) {
      assert.match(guards, new RegExp(`requiredRole="${role}"`));
    }
    assert.match(publicRoutes.get("/admin/clients")?.component ?? "", /AdminProtectedRoute/);
    assert.match(client.get("/admin/csv-import")?.component ?? "", /AdminProtectedRoute/);
  });

  it("keeps Priority 4/5 Get Hired routing and truthful assessment integration intact", () => {
    assert.equal(outer.get("/get-hired")?.component, "PublicRouter");
    assert.equal(publicRoutes.get("/get-hired")?.component, "GetHired");
    const getHired = readFileSync("client/src/pages/GetHired.tsx", "utf8");
    assert.match(getHired, /<GetHiredAssessment/);
    assert.doesNotMatch(getHired, /LinkedInImport|\/api\/linkedin\/|\/api\/objects\/upload|92%|March.*2024/);
    assert.doesNotMatch(appSource, /<Route path="\/(contracts|payments)"/);
  });
});