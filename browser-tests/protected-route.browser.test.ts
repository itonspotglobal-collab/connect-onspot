import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser } from "playwright";

type Role = "client" | "talent" | "admin";
const roles: Role[] = ["client", "talent", "admin"];
const fallback: Record<Role, string> = { client: "/", talent: "/get-hired", admin: "/login" };
const entry = "/__protected-route-fixture.tsx";
let browser: Browser;
let server: Server;
let output: string;
let baseUrl: string;
let fixtureBundle: string;

// Build the real AuthProvider and guards in production mode. Only the pages
// are probes and backend responses are intercepted; no application server runs.
const fixtureSource = `
  import React, { useState } from "react";
  import { createRoot } from "react-dom/client";
  import { Route, Switch, useLocation } from "wouter";
  import { AuthProvider, useAuth } from "/src/contexts/AuthContext";
  import { ClientProtectedRoute, TalentProtectedRoute, AdminProtectedRoute, AuthenticatedRoute } from "/src/components/ProtectedRoute";
  function Controls() {
    const auth = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [location, navigate] = useLocation();
    return <>
      <p data-testid="build-mode">{import.meta.env.PROD ? "production" : "development"}</p>
      <p data-testid="session">{auth.isLoading ? "loading" : auth.isAuthenticated ? auth.user.role : "anonymous"}</p>
      <p data-testid="location">{location}</p>
      <input aria-label="Email" value={email} onChange={event => setEmail(event.target.value)} />
      <input aria-label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} />
      <button onClick={() => auth.login(email, password)}>Sign in</button>
      <button onClick={() => auth.logout()}>Sign out</button>
      <button onClick={() => navigate("/protected/client")}>Client route</button>
    </>;
  }
  createRoot(document.getElementById("root")).render(
    <AuthProvider>
      <Controls />
      <Switch>
        <Route path="/protected/client"><ClientProtectedRoute><p data-testid="protected">client</p></ClientProtectedRoute></Route>
        <Route path="/protected/talent"><TalentProtectedRoute><p data-testid="protected">talent</p></TalentProtectedRoute></Route>
        <Route path="/protected/admin"><AdminProtectedRoute><p data-testid="protected">admin</p></AdminProtectedRoute></Route>
        <Route path="/protected/any"><AuthenticatedRoute><p data-testid="protected">any</p></AuthenticatedRoute></Route>
        <Route><p data-testid="public">Public destination</p></Route>
      </Switch>
    </AuthProvider>
  );
`;

before(async () => {
  output = mkdtempSync(join(tmpdir(), "protected-route-production-"));
  await build({
    configFile: false,
    root: resolve("client"),
    mode: "production",
    logLevel: "error",
    // Library builds do not replace Node's environment reference by default.
    // Pin React's production runtime just as the application build does.
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    plugins: [react(), {
      name: "production-guard-fixture",
      resolveId(id) { if (id === entry) return id; },
      load(id) { if (id === entry) return fixtureSource; },
    }],
    build: {
      outDir: output,
      minify: true,
      lib: { entry, formats: ["es"], fileName: () => "guard.js" },
    },
  });
  fixtureBundle = readFileSync(join(output, "guard.js"), "utf8");
  server = createServer((req, res) => {
    if (req.url === "/guard.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(fixtureBundle);
    } else if (req.url?.startsWith("/api/")) {
      // Unexpected API traffic must not silently resemble a successful session.
      res.writeHead(500);
      res.end("Unintercepted fixture API");
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<html><body><div id="root"></div><script type="module" src="/guard.js"></script></body></html>');
    }
  });
  await new Promise<void>((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise<void>((resolveClosed, reject) => server.close(error => error ? reject(error) : resolveClosed()));
  if (output) rmSync(output, { recursive: true, force: true });
});

async function fixture(role: Role | null, override: string | null) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const user = { id: randomUUID(), email: `${randomUUID()}@example.test`, role, first_name: "Guard", last_name: "Fixture" };
  // Synthetic transport token only; intercepted APIs are not server-auth proof.
  const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  await context.addInitScript(({ role, override, token, user }) => {
    if (override !== null) localStorage.setItem("dev_portal_role", override);
    if (role) {
      localStorage.setItem("onspot_jwt_token", token);
      localStorage.setItem("onspot_user", JSON.stringify(user));
      localStorage.setItem(`onboarding_completed_${user.id}`, "true");
    }
  }, { role, override, token, user });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => {
    errors.push(error.message);
    console.error("[production guard fixture]", error.message);
  });
  let loginRequests = 0;
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== baseUrl) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/login" && route.request().method() === "POST") {
      loginRequests++;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        success: true, token, user: { ...user, role: "client" },
      }) });
    }
    return route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"Unauthorized"}' });
  });
  return { context, page, errors, loginRequests: () => loginRequests };
}

test("production guard fixture contains no executable development-role reader", () => {
  assert.equal(fixtureBundle.includes("dev_portal_role"), false);
  assert.doesNotMatch(readFileSync(resolve("client/src/components/ProtectedRoute.tsx"), "utf8"), /dev_portal_role|devPassthrough|\b(?:localStorage|sessionStorage)\b/);
});

for (const role of roles) {
  test(`production ${role} guard redirects an unauthenticated user despite stored override`, async () => {
    const { context, page, errors } = await fixture(null, role);
    try {
      await page.goto(`${baseUrl}/protected/${role}`);
      await page.waitForURL(`${baseUrl}${fallback[role]}`);
      await page.getByTestId("public").waitFor();
      assert.equal(await page.getByTestId("build-mode").textContent(), "production");
      assert.equal(await page.getByTestId("session").textContent(), "anonymous");
      assert.equal(await page.getByTestId("protected").count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`authenticated ${role} reaches its real guard and survives reload despite conflicting override`, async () => {
    const { context, page, errors } = await fixture(role, roles.find(other => other !== role)!);
    try {
      await page.goto(`${baseUrl}/protected/${role}`);
      await page.getByTestId("protected").waitFor();
      assert.equal(await page.getByTestId("protected").textContent(), role);
      await page.reload();
      await page.getByTestId("protected").waitFor();
      assert.equal(await page.getByTestId("session").textContent(), role);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

for (const role of roles) {
  for (const target of roles.filter(target => target !== role)) {
    test(`production ${role} cannot enter ${target} route using its matching override`, async () => {
      const { context, page, errors } = await fixture(role, target);
      try {
        await page.goto(`${baseUrl}/protected/${target}`);
        await page.waitForURL(`${baseUrl}${role === "talent" ? "/get-hired" : "/dashboard"}`);
        await page.getByTestId("public").waitFor();
        assert.equal(await page.getByTestId("session").textContent(), role);
        assert.equal(await page.getByTestId("protected").count(), 0);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
}

test("generic authenticated guard rejects a development role without a session", async () => {
  const { context, page } = await fixture(null, "admin");
  try {
    await page.goto(`${baseUrl}/protected/any`);
    await page.waitForURL(`${baseUrl}/`);
    assert.equal(await page.getByTestId("protected").count(), 0);
  } finally { await context.close(); }
});

test("real login/logout flow cannot resurrect authentication from a retained development role", async () => {
  const { context, page, errors, loginRequests } = await fixture(null, "client");
  try {
    await page.goto(baseUrl);
    await page.getByTestId("session").waitFor();
    await page.getByRole("textbox", { name: "Email" }).fill(`${randomUUID()}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill(randomUUID());
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="session"]')?.textContent === "client");
    assert.equal(loginRequests(), 1);
    await page.getByRole("button", { name: "Client route", exact: true }).click();
    await page.getByTestId("protected").waitFor();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(`${baseUrl}/`);
    assert.equal(await page.getByTestId("protected").count(), 0);
    assert.deepEqual(await page.evaluate(() => ({
      token: localStorage.getItem("onspot_jwt_token"),
      user: localStorage.getItem("onspot_user"),
      override: localStorage.getItem("dev_portal_role"),
    })), { token: null, user: null, override: "client" });
    await page.reload();
    await page.getByRole("button", { name: "Client route", exact: true }).click();
    await page.getByTestId("public").waitFor();
    assert.equal(await page.getByTestId("session").textContent(), "anonymous");
    assert.equal(await page.getByTestId("protected").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});