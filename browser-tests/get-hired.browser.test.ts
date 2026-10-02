import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import { resolve, join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Route } from "playwright";

// Real components; isolated frontend and intercepted APIs only. Never contacts
// the full server, production accounts, a database, or an object-storage bucket.
let vite: ViteDevServer;
let browser: Browser;
let baseUrl: string;
let cacheDir: string;
const objectPath = "/objects/uploads/11111111-1111-4111-8111-111111111111";
const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;

before(async () => {
  cacheDir = mkdtempSync(join(tmpdir(), "get-hired-vite-"));
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir,
    optimizeDeps: { entries: ["src/pages/GetHired.tsx"] },
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    plugins: [
      react(),
      {
        name: "isolated-get-hired-fixture",
        resolveId(id) { if (id === "/__get-hired-fixture.tsx") return id; },
        load(id) {
          if (id !== "/__get-hired-fixture.tsx") return;
          return `
            import React from "react";
            import { createRoot } from "react-dom/client";
            import { QueryClientProvider } from "@tanstack/react-query";
            import { queryClient } from "/src/lib/queryClient";
            import { AuthProvider } from "/src/contexts/AuthContext";
            import { Toaster } from "/src/components/ui/toaster";
            import { ObjectUploader } from "/src/components/ObjectUploader";
            import GetHired from "/src/pages/GetHired";
            import "/src/index.css";
            createRoot(document.getElementById("root")).render(
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                  {location.search.includes("legacy")
                    ? <ObjectUploader onGetUploadParameters={async () => { throw new Error("Unused legacy callback"); }}
                        onComplete={(result) => { window.__legacyUpload = result; }}>Legacy Upload</ObjectUploader>
                    : <GetHired />}
                  <Toaster />
                </AuthProvider>
              </QueryClientProvider>
            );
          `;
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.split("?")[0] !== "/__get-hired") return next();
            res.setHeader("Content-Type", "text/html");
            res.end(await server.transformIndexHtml("/__get-hired",
              '<html><body><div id="root"></div><script type="module" src="/__get-hired-fixture.tsx"></script></body></html>'));
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

async function fixture(options: { uploadFails?: boolean; saveFails?: boolean; video?: boolean; legacy?: boolean } = {}) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(({ token }) => {
    (window as any).__name = (fn: unknown) => fn;
    localStorage.setItem("onspot_jwt_token", token);
    localStorage.setItem("onspot_user", JSON.stringify({
      id: "fixture-talent", email: "fixture@example.test", role: "talent",
      firstName: "Fixture", lastName: "Talent",
    }));
    localStorage.setItem("onboarding_skipped_fixture-talent", "true");
  }, { token });
  const page = await context.newPage();
  let uploads = 0;
  let saves = 0;
  let downloads = 0;
  let resumeUrl: string | null = null;
  let resumeFileName: string | null = null;
  let videoIntroUrl: string | null = null;
  let videoIntroFileName: string | null = null;
  let profile = { id: "fixture-profile", userId: "fixture-talent",
    firstName: "Fixture", lastName: "Talent", title: "Designer",
    bio: "Controlled profile fixture", location: "Manila" };
  const requests: { path: string; method: string; authorization?: string; contentType?: string }[] = [];
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      requests.push({ path: url.pathname, method: request.method(),
        authorization: request.headers().authorization, contentType: request.headers()["content-type"] });
      if (url.pathname === "/api/object-storage/upload") {
        uploads++;
        return json(route, options.uploadFails ? { error: "Storage unavailable" } :
          { success: true, fileUrl: objectPath }, options.uploadFails ? 500 : 200);
      }
      if (request.method() === "PATCH" && /\/api\/talent\/me\/(resume-url|video-intro-url)$/.test(url.pathname)) {
        saves++;
        if (options.saveFails) return json(route, { error: "Profile save failed" }, 500);
        const { fileUrl, fileName } = request.postDataJSON();
        assert.equal(fileUrl, objectPath);
        if (url.pathname.endsWith("resume-url")) {
          resumeUrl = fileUrl;
          resumeFileName = fileName;
          return json(route, { success: true, resumeUrl, resumeFileName });
        }
        videoIntroUrl = fileUrl;
        videoIntroFileName = fileName;
        return json(route, { success: true, videoIntroUrl, videoIntroFileName });
      }
      if (url.pathname.startsWith("/api/objects/")) {
        downloads++;
        return route.fulfill({ status: 200, contentType: "application/pdf", body: "controlled document fixture" });
      }
      if (url.pathname === "/api/talent/me/resume-status")
        return json(route, { hasResume: !!resumeUrl, resumeUrl, resumeFileName,
          hasVideoIntro: !!videoIntroUrl, videoIntroUrl, videoIntroFileName });
      if (url.pathname === "/api/profiles/me") {
        if (request.method() === "PUT") profile = { ...profile, ...request.postDataJSON() };
        return json(route, { success: true, profile });
      }
      if (url.pathname === "/api/candidates/me") return json(route, {});
      return json(route, []);
    }
    if (url.origin !== baseUrl) return route.abort();
    return route.continue();
  });
  await page.goto(`${baseUrl}/__get-hired${options.legacy ? "?legacy" : ""}`);
  if (options.legacy) {
    await page.getByRole("button", { name: "Legacy Upload", exact: true }).waitFor({ timeout: 60_000 });
  } else {
    await page.getByTestId("button-save-profile").waitFor({ timeout: 60_000 });
    await page.getByRole("tab", { name: "Documents", exact: true }).click();
  }
  const upload = () => page.locator(`input[type=file][accept="${options.video ? ".mp4,.mov,.avi,.webm" : ".pdf,.doc,.docx"}"]`)
    .setInputFiles({ name: options.video ? "intro.mp4" : "controlled-cv.pdf",
      mimeType: options.video ? "video/mp4" : "application/pdf",
      buffer: Buffer.from("controlled isolated upload fixture") });
  return { context, page, upload, requests, counts: () => ({ uploads, saves, downloads }) };
}

for (const video of [false, true]) {
  test(`confirmed ${video ? "video" : "resume"} upload survives reload and uses authenticated private retrieval`, async () => {
    const f = await fixture({ video });
    try {
      await f.upload();
      await f.page.getByText("Upload Successful", { exact: true }).waitFor();
      await f.page.getByText(video ? "intro.mp4" : "controlled-cv.pdf", { exact: true }).waitFor();
      assert.deepEqual(f.counts(), { uploads: 1, saves: 1, downloads: 0 });
      const uploadRequest = f.requests.find((r) => r.path === "/api/object-storage/upload")!;
      assert.equal(uploadRequest.authorization, `Bearer ${token}`);
      assert.match(uploadRequest.contentType!, /^multipart\/form-data; boundary=/);
      assert.equal(await f.page.getByRole("tab", { name: "Documents", exact: true }).getAttribute("data-state"), "active");
      await f.page.reload();
      await f.page.getByRole("tab", { name: "Documents", exact: true }).click();
      await f.page.getByText(video ? "intro.mp4" : "controlled-cv.pdf", { exact: true }).waitFor();
      assert.doesNotMatch(await f.page.locator("body").innerText(), /Invalid Date/);
      const download = f.page.waitForEvent("download");
      await f.page.getByRole("button", { name: "Download", exact: true }).click();
      assert.equal((await download).suggestedFilename(), video ? "intro.mp4" : "controlled-cv.pdf");
      assert.equal(f.counts().downloads, 1);
      assert.equal(f.requests.find((r) => r.path.startsWith("/api/objects/"))?.authorization, `Bearer ${token}`);
    } finally { await f.context.close(); }
  });
}

for (const failure of ["uploadFails", "saveFails"] as const) {
  test(`${failure} never announces success, adds a document, or advances`, async () => {
    const f = await fixture({ [failure]: true });
    try {
      await f.upload();
      await f.page.getByText("Upload Failed", { exact: true }).waitFor();
      assert.equal(await f.page.getByText("Upload Successful", { exact: true }).count(), 0);
      assert.equal(await f.page.getByText("controlled-cv.pdf", { exact: true }).count(), 0);
      assert.equal(await f.page.getByRole("tab", { name: "Documents", exact: true }).getAttribute("data-state"), "active");
      assert.equal(f.counts().saves, failure === "uploadFails" ? 0 : 1);
    } finally { await f.context.close(); }
  });
}

test("invalid category fails before any upload or persistence request", async () => {
  const f = await fixture();
  try {
    await f.page.locator('input[type=file][accept=".pdf,.doc,.docx"]').setInputFiles({
      name: "wrong.mp4", mimeType: "video/mp4", buffer: Buffer.from("isolated invalid-file fixture"),
    });
    await f.page.getByText("Invalid File", { exact: true }).waitFor();
    assert.deepEqual(f.counts(), { uploads: 0, saves: 0, downloads: 0 });
    assert.equal(await f.page.getByText("Upload Successful", { exact: true }).count(), 0);
  } finally { await f.context.close(); }
});

test("assessment stays truthful, continues without a result, and Priority 4 stays intact", async () => {
  const f = await fixture();
  try {
    assert.equal(await f.page.getByRole("tab", { name: /linkedin/i }).count(), 0);
    await f.page.getByRole("tab", { name: "Assessments", exact: true }).click();
    await f.page.getByTestId("assessment-unavailable").waitFor();
    assert.doesNotMatch(await f.page.locator("body").innerText(), /92%|March.*2024|Top 10%|Technical Skills Assessment/);
    await f.page.getByTestId("button-continue-without-assessment").click();
    assert.equal(await f.page.getByRole("tab", { name: "Matching", exact: true }).getAttribute("data-state"), "active");
    assert.equal(f.requests.some((r) => /\/api\/assessments|\/api\/linkedin\/|\/api\/objects\/upload$/.test(r.path)), false);
    await f.page.getByRole("tab", { name: "Profile", exact: true }).click();
    await f.page.getByTestId("input-first-name").fill("Edited");
    assert.equal(await f.page.getByTestId("input-first-name").inputValue(), "Edited");
    const save = f.page.waitForRequest((request) => request.url().endsWith("/api/profiles/me") && request.method() === "PUT");
    await f.page.getByTestId("button-save-profile").click();
    assert.equal((await save).postDataJSON().firstName, "Edited");
    await f.page.locator('[role="tab"][data-state="active"]').filter({ hasText: "Documents" }).waitFor();
  } finally { await f.context.close(); }
});

test("shared uploader keeps legacy props, direct multipart behavior, default file types and callback contract", async () => {
  const f = await fixture({ legacy: true });
  try {
    await f.page.locator('input[type=file]').setInputFiles({
      name: "legacy.csv", mimeType: "text/csv", buffer: Buffer.from("name\ncontrolled fixture"),
    });
    await f.page.getByText("Upload Successful", { exact: true }).waitFor();
    assert.deepEqual(f.counts(), { uploads: 1, saves: 0, downloads: 0 });
    const result = await f.page.evaluate(() => (window as any).__legacyUpload);
    assert.equal(result.successful[0].uploadURL, objectPath);
    assert.equal(result.successful[0].name, "legacy.csv");
    assert.deepEqual(result.failed, []);
  } finally { await f.context.close(); }
});