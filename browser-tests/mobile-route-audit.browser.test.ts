import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Route } from "playwright";

const fixtureCache = mkdtempSync(join(tmpdir(), "onspot-mobile-route-audit-"));
const artifactDir = resolve(`generated-artifacts/mobile-route-audit/${process.env.MOBILE_AUDIT_ALL==="1"?"full":"profile"}`);
const reportPath = resolve(`generated-artifacts/mobile-route-audit/${process.env.MOBILE_AUDIT_ALL==="1"?"report":"profile-report"}.md`);
const appSource = readFileSync(resolve("client/src/App.tsx"), "utf8");
const widths = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
let vite: ViteDevServer;
let browser: Browser;
let baseUrl = "";
let builtServer:Server|undefined;

type RouteEntry = { route: string; role: "client" | "talent" | "admin" };
type AuditResult = {
  route: string;
  role: string;
  width: number;
  scrollWidth: number;
  clientWidth: number;
  overflow: boolean;
  appError: string | null;
  pageTitle: string;
  finalPath: string;
  outcome: "rendered" | "blocked-auth" | "runtime-error" | "redirected" | "missing-priority-marker" | "no-page-content";
  marker: string;
};

const PRIORITY_ROUTES = [
  "/talent-profile/:id", "/get-hired", "/my-applications", "/client-profile",
  "/client/interviews", "/client/billing", "/client/payments/:category/:id",
  "/messages", "/hire-talent", "/jobs/:jobId/apply", "/admin/job-applications",
  "/admin/interviews", "/admin/ledger", "/sign-in", "/signup",
];

function routeEntries(): RouteEntry[] {
  const paths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);
  const unique = [...new Set(paths)].filter((path) => !path.includes("*"));
  return unique.map((route) => ({
    route,
    role: route.startsWith("/admin") ? "admin"
      : route.startsWith("/client") || ["/dashboard", "/clients", "/projects", "/performance", "/roi", "/settings", "/profile-settings"].includes(route) ? "client"
        : route.startsWith("/talent") || route.startsWith("/hired-talent") || ["/my-applications", "/get-hired", "/inbox", "/contracts", "/messages", "/candidate-profile/:candidateId"].includes(route) ? "talent"
          : "client",
  }));
}

function concretePath(route: string): string {
  return route
    .replace(":candidateId", "fixture-candidate")
    .replace(":organizationId", "fixture-organization")
    .replace(":jobId", "fixture-job")
    .replace(":threadId", "fixture-thread")
    .replace(":pilotId", "fixture-pilot")
    .replace(":slug", "fixture-story")
    .replace(":token", "fixture-invite-token")
    .replace(":category", "invoice")
    .replace(":id", "fixture-record")
    .replace("/talent-profile/fixture-record", "/talent-profile/fixture-candidate");
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 150) || "root";
}

async function fulfillFixture(route: Route) {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith("/api/")) return route.continue();
  if (url.pathname === "/api/candidates/fixture-candidate") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "fixture-candidate",
        firstName: "Fixture",
        lastName: "Talent",
        fullName: "Fixture Talent",
        displayName: "Fixture Talent",
        email: "talent-fixture@example.invalid",
        headline: "Client operations specialist with a deliberately extended headline value for narrow viewport stress testing",
        targetPosition: "Customer success specialist",
        summary: `A profile summary with long text to test real responsive rendering. ${"UNBROKENPROFILETEXT".repeat(36)} More writing follows so line wrapping remains natural across the page.`,
        location: "Manila, Philippines",
        profilePhotoUrl: null,
        resumeUrl: null,
        linkedinUrl: "https://example.invalid/fixture-profile",
        portfolioUrl: null,
        coreSkills: ["Customer support", "Operations"],
        secondarySkills: ["Documentation"],
        workHistory: [{
          title: "Customer operations specialist",
          company: "NorthstarCustomerOperationsAndExperienceStudioWithAnIntentionallyLongCompanyName",
          duration: "2023–2025",
          responsibilities: "Resolved complex customer cases and maintained a reliable service knowledge base.",
        }],
        education: [{
          school: "International Institute for Customer Experience and Digital Operations",
          degree: "Bachelor of Arts, Communication",
          yearStart: "2018",
          yearEnd: "2022",
        }],
        certifications: [{
          name: "Professional Customer Experience Operations Certification",
          issuer: "Fixture Learning Institute",
          date: "2025",
          link: "https://example.invalid/certificates/customer-experience-operations",
        }],
        preferences: {},
      }),
    });
  }
  if (url.pathname === "/api/candidates/fixture-candidate/culture-evaluation") {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(null) });
  }
  if (url.pathname === "/api/talent/me/resume-status") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasResume: false, resumeUrl: null, hasVideoIntro: false, videoIntroUrl: null }),
    });
  }
  if (url.pathname === "/api/talent/applications") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: "fixture-application",
        job: { id: "fixture-job", title: "Customer Support Specialist", companyName: "Fixture Company", status: "open" },
        applicationStatus: "contract_signed",
        statusHistory: [{ status: "contract_signed", at: "2026-01-02T00:00:00.000Z" }],
        submittedAt: "2025-12-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        coverLetter: "Fixture application detail for responsive testing.",
      }]),
    });
  }
  if (/^\/api\/users\/fixture-talent\/skills$/.test(url.pathname) || /^\/api\/talents\/fixture-talent\/portfolio$/.test(url.pathname)) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  }
  const body = {
    items: [],
    data: [],
    results: [],
    applications: [],
    invoices: [],
    messages: [],
    notifications: [],
    user: {
      id: "fixture-user",
      role: "client",
      email: "client-fixture@example.invalid",
      first_name: "Fixture",
      last_name: "Client",
      company: "Fixture Company",
      profileCompletion: 100,
      isNewUser: false,
    },
  };
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

before(async () => {
  mkdirSync(artifactDir, { recursive: true });
  if(process.env.MOBILE_AUDIT_BUILT==="1") {
    const root=resolve("dist/public");
    const html=readFileSync(join(root,"index.html"),"utf8");
    // Same isolated App boundary as the development harness: local production
    // assets only, excluding unrelated third-party HTML embeds and trackers.
    const assets=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="\/assets\/[^"]+"[^>]*>(?:<\/script>)?/g)].map(m=>m[0]).join("\n");
    builtServer=createHttpServer((req,res)=>{
      const pathname=new URL(req.url||"/","http://fixture.test").pathname;
      const file=resolve(root,`.${pathname}`);
      if(file.startsWith(`${root}/`)&&existsSync(file)&&statSync(file).isFile()) {
        const extension=file.slice(file.lastIndexOf("."));
        res.setHeader("Content-Type",({".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png"} as Record<string,string>)[extension]||"application/octet-stream");
        res.end(readFileSync(file));
      } else {
        res.setHeader("Content-Type","text/html");
        res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${assets}</head><body><div id="root"></div></body></html>`);
      }
    });
    await new Promise<void>(done=>builtServer!.listen(0,"127.0.0.1",done));
    baseUrl=`http://127.0.0.1:${(builtServer.address() as {port:number}).port}`;
  } else {
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir: fixtureCache,
    resolve: {
      alias: {
        "@": resolve("client/src"),
        "@shared": resolve("shared"),
        "@assets": resolve("attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        "react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime",
        "@tanstack/react-query", "@radix-ui/react-dialog", "@radix-ui/react-slot", "axios",
        "lucide-react", "clsx", "tailwind-merge", "class-variance-authority",
        "use-sync-external-store", "use-sync-external-store/shim/index.js",
        "use-sync-external-store/shim/with-selector", "lodash", "lodash/get", "lodash/isNaN",
      ],
    },
    plugins: [react(), {
      name: "mobile-route-audit-fixture",
      resolveId(id) { if (id === "/__route-audit.tsx") return id; },
      load(id) {
        if (id !== "/__route-audit.tsx") return;
        return `
          import React from "react";
          import { createRoot } from "react-dom/client";
          import App from "/src/App.tsx";
          import "/src/index.css";
          createRoot(document.getElementById("root")).render(<App />);
        `;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.headers.accept?.includes("text/html")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml("/", '<html><body><div id="root"></div><script type="module" src="/__route-audit.tsx"></script></body></html>'));
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  baseUrl = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`;
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});

after(async () => {
  await browser?.close();
  await vite?.close();
  await new Promise<void>(done=>builtServer?builtServer.close(()=>done()):done());
  rmSync(fixtureCache, { recursive: true, force: true });
});

test("audit actual App routes at 375, 390 and 430 CSS pixels with disposable role fixtures", async () => {
  const allRoutes = routeEntries();
  const focusedRoutes=(process.env.MOBILE_AUDIT_ROUTES||"/talent-profile/:id").split(",");
  const routes = process.env.MOBILE_AUDIT_ALL==="1"?allRoutes:allRoutes.filter((entry) => focusedRoutes.includes(entry.route));
  assert.ok(routes.length > 0, "App.tsx must expose priority route declarations for this audit");
  const results: AuditResult[] = [];
  const routesMissingContent = new Set<string>();
  const pages = new Map<string, import("playwright").Page>();

  for (const entry of routes) {
    for (const viewport of widths) {
      const pageKey = `${entry.role}-${viewport.width}`;
      let page = pages.get(pageKey);
      let errorOffset = 0;
      if (!page) {
        page = await browser.newPage({ viewport });
        pages.set(pageKey, page);
        (page as typeof page & { __routeAuditErrors?: string[] }).__routeAuditErrors = [];
        page.on("pageerror", (error) => {
          (page as typeof page & { __routeAuditErrors?: string[] }).__routeAuditErrors?.push(error.message);
        });
        page.on("console", (message) => {
          if (message.type() === "error") {
            (page as typeof page & { __routeAuditErrors?: string[] }).__routeAuditErrors?.push(`console: ${message.text()}`);
          }
        });
        await page.addInitScript((role) => {
          const user = {
            id: `fixture-${role}`,
            role,
            email: `${role}-fixture@example.invalid`,
            first_name: "Fixture",
            last_name: role[0].toUpperCase() + role.slice(1),
            company: "Fixture Company",
          };
          localStorage.setItem("onspot_jwt_token", "disposable-route-audit-token");
          localStorage.setItem("onspot_user", JSON.stringify(user));
          localStorage.setItem(`onboarding_completed_${user.id}`, "true");
          if (role === "talent") {
            const candidateId = "fixture-candidate";
            const email = "talent-fixture@example.invalid";
            const payload = btoa(JSON.stringify({
              type: "candidate",
              candidateId,
              email,
              exp: Math.floor(Date.now() / 1000) + 3600,
            })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
            localStorage.setItem("talent_profile_token", JSON.stringify({
              token: `fixture.${payload}.signature`,
              candidateId,
              email,
              fullName: "Fixture Talent",
            }));
          }
        }, entry.role);
        await page.route("**/*", fulfillFixture);
        await page.goto(`${baseUrl}${concretePath(entry.route)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        errorOffset = 0;
      } else {
        errorOffset = (page as typeof page & { __routeAuditErrors?: string[] }).__routeAuditErrors?.length || 0;
        // Reset the App/error boundary and query cache: one bad fixture must
        // not leave every later route measuring the same blank document.
        await page.goto(`${baseUrl}${concretePath(entry.route)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      }
      if (entry.route === "/talent-profile/:id") {
        await page.waitForFunction(() => {
          const text = document.body.innerText;
          return text.includes("Finish Setting Up") && text.includes("Education")
            && text.includes("Certifications") && text.includes("Applications") && text.includes("Portfolio");
        }, undefined, { timeout: 8000 }).catch(() => {});
      } else {
        await page.waitForTimeout(250);
      }
      const errors = (page as typeof page & { __routeAuditErrors?: string[] }).__routeAuditErrors;
      const appError = errors?.slice(errorOffset).join("; ") || null;
      if (errors && errors.length > errorOffset) errors.splice(errorOffset, errors.length - errorOffset);

      const measurements = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        title: document.title,
        visibleText: document.body.innerText.trim().slice(0, 4000),
        pageText: (document.querySelector("main")?.innerText || document.body.innerText).trim().slice(0, 4000),
        finalPath: `${location.pathname}${location.search}`,
      }));
      if(measurements.scrollWidth>measurements.clientWidth+1)console.log("Overflow elements",JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll("body *"))
        .filter(el=>el.getBoundingClientRect().right>document.documentElement.clientWidth+1)
        .slice(0,18).map(el=>({tag:el.tagName,class:String(el.className),width:Math.round(el.getBoundingClientRect().width),
          text:el.textContent?.slice(0,70)})))));
      const isSignInRedirect = /(?:portal-login|sign-in|\/login)(?:[/?]|$)/i.test(measurements.finalPath)
        && !["/sign-in", "/portal-login", "/admin/login"].includes(entry.route);
      const expectedRoute = new RegExp(`^${entry.route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[^/]+/g, "[^/]+")}/?$`);
      const intentionallyRedirected = new Set(["/find-work", "/client-search", "/signup", "/manifesto"]);
      const pathMatches = expectedRoute.test(measurements.finalPath.split("?")[0])
        || (entry.route === "/find-work" && measurements.finalPath.startsWith("/find-work/jobs"))
        || (entry.route === "/client-search" && measurements.finalPath === "/hire-talent")
        || (entry.route === "/signup" && measurements.finalPath.startsWith("/portal"))
        || (entry.route === "/manifesto" && measurements.finalPath === "/join-onspot");
      const requiredProfileMarkers = ["Finish Setting Up", "Education", "Certifications", "Applications", "Portfolio"];
      const missingProfileMarker = entry.route === "/talent-profile/:id"
        && requiredProfileMarkers.some((marker) => !measurements.pageText.includes(marker));
      const outcome: AuditResult["outcome"] = isSignInRedirect
        ? "blocked-auth"
        : appError
          ? "runtime-error"
          : missingProfileMarker
            ? "missing-priority-marker"
            : !pathMatches && !intentionallyRedirected.has(entry.route)
              ? "redirected"
              : !measurements.pageText
                ? "no-page-content"
                : "rendered";
      const marker = entry.route === "/talent-profile/:id"
        ? requiredProfileMarkers.filter((item) => measurements.pageText.includes(item)).join(", ")
        : measurements.pageText.slice(0, 120).replaceAll("\n", " ");
      if (outcome !== "rendered") routesMissingContent.add(entry.route);
      const overflow = measurements.scrollWidth > measurements.clientWidth;
      const name = safeName(`${entry.role}-${entry.route}-${viewport.width}`);
      await page.screenshot({ path: join(artifactDir, `${name}.png`), fullPage: true, animations: "disabled" });
      results.push({
        route: entry.route,
        role: entry.role,
        width: viewport.width,
        scrollWidth: measurements.scrollWidth,
        clientWidth: measurements.clientWidth,
        overflow,
        appError,
        pageTitle: measurements.title,
        finalPath: measurements.finalPath,
        outcome,
        marker,
      });
    }
  }
  await Promise.all([...pages.values()].map((page) => page.close()));

  const failing = results.filter((result) => result.overflow && result.outcome === "rendered");
  const errorRoutes = results.filter((result) => result.appError);
  const groupedFailing = [...new Set(failing.map((result) => result.route))];
  const groupedErrorRoutes = [...new Set(errorRoutes.map((result) => result.route))];
  const report = [
    "# Mobile route audit — actual App routes",
    "",
    `- App.tsx route declarations discovered: ${allRoutes.length}; focused priority routes selected: ${routes.length}`,
    `- Viewport measurements/screenshots: ${results.length} (${widths.map((item) => item.width).join(", ")} CSS px)`,
    `- Priority route declarations: ${PRIORITY_ROUTES.filter((route) => routes.some((entry) => entry.route === route)).length}/${PRIORITY_ROUTES.length}`,
    "- Authentication: disposable localStorage JWT/user fixtures; no live credentials or backend calls.",
    "- API data: isolated fixtures; TalentProfile includes a populated incomplete profile and long values to exercise its setup banner and section tabs.",
    "- A route is considered rendered only when the final location matches the expected route (or a documented redirect), the expected marker is present, and no page error/sign-in redirect occurred. Blocked/redirected/error states are not overflow passes.",
    "",
    "## Horizontal overflow failures",
    groupedFailing.length
      ? groupedFailing.map((route) => `- ${route}: ${failing.filter((item) => item.route === route).map((item) => `${item.width}px (${item.scrollWidth}/${item.clientWidth})`).join(", ")}`).join("\n")
      : "- None observed in routes that passed their expected-page marker.",
    "",
    "## Priority route baseline",
    ...PRIORITY_ROUTES.map((route) => {
      const rows = results.filter((item) => item.route === route);
      if (!rows.length) return `- ${route}: not declared by App.tsx; not audited.`;
      const outcomes = [...new Set(rows.map((item) => item.outcome))];
      const overflows = rows.filter((item) => item.overflow && item.outcome === "rendered").map((item) => item.width);
      return `- ${route}: ${outcomes.join(", ")}${overflows.length ? `; overflow at ${overflows.join(", ")}px` : ""}${rows[0].marker ? `; marker: ${rows[0].marker}` : ""}`;
    }),
    "",
    "## Unauditable or runtime-error states",
    groupedErrorRoutes.length
      ? groupedErrorRoutes.map((route) => `- ${route}: page runtime error in one or more fixtures; see per-route screenshot and route/viewport detail.`).join("\n")
      : [...routesMissingContent].map((route) => `- ${route}: empty fixture data/auth state did not produce representative page content.`).join("\n") || "- None observed.",
    "",
    "## Route/viewport detail",
    "| Role | Route | Final path | Width | document scrollWidth | clientWidth | Overflow | Outcome | Runtime error |",
    "|---|---|---|---:|---:|---:|---|---|---|",
    ...results.map((result) => `| ${result.role} | ${result.route} | ${result.finalPath} | ${result.width} | ${result.scrollWidth} | ${result.clientWidth} | ${result.overflow ? "yes" : "no"} | ${result.outcome} | ${result.appError ? result.appError.replaceAll("|", "\\|") : "no"} |`),
    "",
    `Screenshots: ${artifactDir}`,
  ].join("\n");
  writeFileSync(reportPath, report);
  console.log(report);
  console.log(`Report written: ${reportPath}`);
  if(process.env.MOBILE_AUDIT_ALL==="1")assert.equal(results.filter(result=>result.outcome!=="rendered").length,0,
    "The route sweep is incomplete; missing fixture content, redirects and runtime errors must not pass CI.");
  else assert.ok(results.length===routes.length*widths.length&&results.every(result=>result.outcome==="rendered"),
    "The populated profile must actually render at every target width.");
  assert.equal(results.filter(result=>result.outcome==="rendered"&&result.overflow).length,0,
    "Rendered routes must not overflow; see the saved audit report.");
});
