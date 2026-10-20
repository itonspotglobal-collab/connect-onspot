import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";

let server: Server, browser: Browser, base: string;
let uploaded = 0;
let credentialLeak = false;
before(async () => {
  const bundle = await build({ entryPoints: ["client/src/lib/uploadCandidateVideo.ts"], bundle: true,
    format: "esm", write: false });
  const js = bundle.outputFiles[0].text;
  server = createServer((req, res) => {
    if (req.url === "/helper.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(js); }
    if (req.url === "/storage") {
      credentialLeak ||= !!req.headers.authorization || !!req.headers.cookie;
      uploaded = 0;
      req.on("data", bytes => { uploaded += bytes.length; });
      req.on("end", () => { res.writeHead(200); res.end(); });
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(`<script type="module">
      import {uploadCandidateVideo} from '/helper.js';
      window.upload=uploadCandidateVideo; window.ready=true;
    </script>`);
  }).listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
});
after(async () => {
  await browser?.close();
  server?.closeAllConnections();
  await new Promise<void>(r => server?.close(() => r()));
});
async function open() {
  const page = await browser.newPage();
  await page.goto(base);
  await page.waitForFunction(() => (window as any).ready);
  return page;
}
async function fixture(page: Page, completeStatus = 200, completeBody: any = { success: true }) {
  let calls = 0, canceled = 0;
  await page.route("**/api/candidates/owner/video/uploads", async route => {
    calls++;
    assert.equal(route.request().headers().authorization, "Bearer isolated-session");
    const input = route.request().postDataJSON();
    assert.equal(input.type, "video/mp4");
    await route.fulfill({ json: { uploadUrl: `${base}/storage`, uploadToken: "fixture-capability" } });
  });
  await page.route("**/api/candidates/owner/video/uploads/complete", route =>
    route.fulfill({ status: completeStatus, json: completeBody }));
  await page.route("**/api/candidates/owner/video/uploads/cancel", route => {
    canceled++; return route.fulfill({ json: { success: true } });
  });
  return { calls: () => calls, canceled: () => canceled };
}
for (const mb of [5, 63]) test(`real browser XHR sends ${mb} MiB bytes, reports progress and finalizes`, async () => {
  const page = await open();
  try {
    const count = await fixture(page);
    const result = await page.evaluate(async size => {
      const progress: number[] = [];
      const file = new File([new Uint8Array(size)], "intro.mp4", { type: "video/mp4" });
      const value = await (window as any).upload("owner", file, "Bearer isolated-session", (p: number) => progress.push(p));
      return { value, progress };
    }, mb * 1024 * 1024);
    assert.equal(result.value.success, true);
    assert.equal(uploaded, mb * 1024 * 1024);
    assert.equal(credentialLeak, false);
    assert.equal(count.calls(), 1);
    assert.equal(count.canceled(), 0);
    assert.equal(result.progress.at(-1), 100);
    assert.ok(result.progress.some(p => p < 100), "Browser progress events must be reported before finalization");
  } finally { await page.close(); }
});
test("oversize and unsupported files fail before any authorization/upload request", async () => {
  const page = await open();
  try {
    const count = await fixture(page);
    const errors = await page.evaluate(async () => {
      const errors: string[] = [];
      for (const type of ["video/mp4", "text/html"]) {
        const file = new File(["x"], "bad", { type });
        if (type === "video/mp4") Object.defineProperty(file, "size", { value: 200 * 1024 * 1024 + 1 });
        try { await (window as any).upload("owner", file, "Bearer isolated-session", () => {}); }
        catch (e: any) { errors.push(e.message); }
      }
      return errors;
    });
    assert.match(errors[0], /exceeds the 200 MB limit/);
    assert.match(errors[1], /MP4, WebM/);
    assert.equal(count.calls(), 0);
  } finally { await page.close(); }
});
test("non-JSON infrastructure 413 does not falsely blame the file", async () => {
  const page = await open();
  try {
    await page.route("**/api/candidates/owner/video/uploads", route =>
      route.fulfill({ status: 413, contentType: "text/html", body: "<h1>Request Entity Too Large</h1>" }));
    const error = await page.evaluate(async () => {
      try { await (window as any).upload("owner", new File(["x"], "a.mp4", { type: "video/mp4" }), "Bearer isolated-session", () => {}); }
      catch (e: any) { return e.message; }
    });
    assert.match(error!, /service rejected.*may be within the limit/);
  } finally { await page.close(); }
});
test("failed finalization triggers pending-object cancellation and a useful error", async () => {
  const page = await open();
  try {
    const count = await fixture(page, 503, { error: "Storage is temporarily unavailable. Please retry." });
    const error = await page.evaluate(async () => {
      try { await (window as any).upload("owner", new File(["x"], "a.mp4", { type: "video/mp4" }), "Bearer isolated-session", () => {}); }
      catch (e: any) { return e.message; }
    });
    assert.match(error!, /temporarily unavailable/);
    assert.equal(count.canceled(), 1);
  } finally { await page.close(); }
});
test("both existing profile pages use the same direct uploader with validation, busy guard and refresh", () => {
  for (const filename of ["TalentProfile", "ProfileSettings"]) {
    const source = readFileSync(`client/src/pages/${filename}.tsx`, "utf8");
    assert.match(source, /uploadCandidateVideo\(/);
    assert.match(source, /candidateVideoError\(file.size, file.type\)/);
    assert.match(source, /videoUploadBusy.current/);
    assert.match(source, /videoUploadProgress/);
    assert.match(source, filename === "TalentProfile" ? /qc.invalidateQueries/ : /await invalidateCandidate\(\)/);
  }
});

test("Settings recordings cannot regress to the legacy multipart video endpoint", () => {
  const source = readFileSync("client/src/pages/ProfileSettings.tsx", "utf8");
  const recordedHandler = source.slice(source.indexOf("async function uploadRecordedVideo()"), source.indexOf("// `documents`"));
  assert.match(recordedHandler, /if \(await uploadVideo\(file\)\) discardVideoRecording\(\)/);
  assert.doesNotMatch(recordedHandler, /FormData|fetch\(/);
});
