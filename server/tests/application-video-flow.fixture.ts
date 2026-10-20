/**
 * Explicit opt-in UAT: real password authentication, disposable PostgreSQL,
 * production routes/frontend, real private storage. Never use the app database.
 * Run only via scripts/test-hiring-payments-isolated.mjs --video-only --real-storage.
 */
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import express from "express";
import type { Server } from "node:http";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { query, pool } from "../db";
import { registerRoutes } from "../routes";
import { hashPassword } from "../auth-utils";
import { candidateVideoStorage } from "../services/candidateVideoStorage";
import { ObjectStorageService } from "../objectStorage";
import { getObjectAclPolicy } from "../objectAcl";

assert.equal(process.env.VIDEO_UAT_REAL_STORAGE, "true", "Explicit --real-storage approval required");
assert.ok(process.env.HIRING_FLOW_TEST_DATABASE_URL?.includes("/onspot_hiring_test"), "Disposable database required");
const suffix = randomUUID();
const userId = `video-uat-${suffix}`, otherId = `video-other-${suffix}`, candidateId = `video-candidate-${suffix}`;
const clientId = `video-client-${suffix}`, adminId = `video-admin-${suffix}`;
const email = `video-uat-${suffix}@example.test`, otherEmail = `video-other-${suffix}@example.test`;
const password = `Video-UAT-only-${randomUUID()}!`;
const objects = new Map<string, { namespace: "candidate-videos" | "application-videos"; id: string }>();
let jobId: string, optionalJobId: string, token: string, candidateToken: string, otherToken: string, clientToken: string, adminToken: string;
let server: Server, base: string, dir: string, seed: Buffer, browser: Browser, context: BrowserContext, page: Page;
function remember(url: string) {
  const parts = url.split("/");
  objects.set(url, { namespace: parts[2] as any, id: parts[3] });
}
async function api(method: string, url: string, data?: any, authorization = token, key?: string) {
  const response = await fetch(base + url, { method, headers: {
    ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(key ? { "Idempotency-Key": key } : {}),
  }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
}
async function file(mb: number) {
  const target = path.join(dir, `${mb}MiB-introduction.mp4`);
  const size = mb * 1024 * 1024;
  const handle = await open(target, "w");
  try {
    await handle.write(seed);
    const box = Buffer.alloc(8); box.writeUInt32BE(size - seed.length, 0); box.write("free", 4);
    await handle.write(box);
    await handle.truncate(size);
  } finally { await handle.close(); }
  return target;
}
function fields(extra = {}) {
  return { firstName: "Video", lastName: "UAT Talent", email, phone: "+15550199", answers: "[]", ...extra };
}
async function directApplicationUpload(mb: number) {
  const fixture = await file(mb);
  const init = await api("POST", `/api/jobs/${jobId}/video/uploads`, {
    filename: `${mb}MiB-introduction.mp4`, size: mb * 1024 * 1024, type: "video/mp4",
  });
  assert.equal(init.status, 200, JSON.stringify(init.body));
  const raw = JSON.parse(Buffer.from(init.body.uploadToken.split(".")[1], "base64url").toString());
  objects.set(`/objects/application-videos/${raw.uploadId}`, { namespace: "application-videos", id: raw.uploadId });
  const put = await fetch(init.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4",
    "Content-Length": String(mb * 1024 * 1024) }, body: Readable.toWeb(createReadStream(fixture)) as any, duplex: "half" } as any);
  assert.equal(put.status, 200);
  const complete = await api("POST", `/api/jobs/${jobId}/video/uploads/complete`, { uploadToken: init.body.uploadToken });
  assert.equal(complete.status, 200, JSON.stringify(complete.body));
  return complete.body.applicationVideoToken;
}
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "video-account-uat-"));
  const seedPath = path.join(dir, "seed.mp4");
  assert.equal(spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=32x32:d=1",
    "-c:v", "libx264", "-movflags", "+faststart", seedPath]).status, 0);
  seed = await readFile(seedPath);
  const hash = await hashPassword(password);
  await query(`INSERT INTO users (id,email,first_name,last_name,role,password_hash,email_verified_at,email_verified_email)
    VALUES ($1,$2::text,'Video','UAT Talent','talent',$3,now(),$2::text), ($4,$5::text,'Other','Talent','talent',$3,now(),$5::text)`,
  [userId, email, hash, otherId, otherEmail]);
  await query(`INSERT INTO users (id,email,role,password_hash,email_verified_at,email_verified_email,admin_sub_role)
    VALUES ($1,$2::text,'client',$3,now(),$2::text,NULL),($4,$5::text,'admin',$3,now(),$5::text,'talent_acquisition')`,
  [clientId, `${clientId}@example.test`, hash, adminId, `${adminId}@example.test`]);
  await query(`INSERT INTO candidates
    (id,user_id,email,full_name,first_name,last_name,phone,target_position,category,password_hash,profile_completed,email_verified_at,email_verified_email)
    VALUES ($1,$2,$3::text,'Video UAT Talent','Video','UAT Talent','+15550199','Engineer','Engineering',$4,true,now(),$3::text)`,
  [candidateId, userId, email, hash]);
  for (const required of [true, false]) {
    const inserted = await query(`INSERT INTO jobs
      (title,description,category,experience_level,status,approval_status,engagement_type,application_method,requires_video_intro,client_id)
      VALUES ($1,'Disposable video UAT only','Engineering','intermediate','open','approved','Standard','built_in_form',$2,$3) RETURNING id`,
    [required ? "TEST ONLY Required Video Job" : "TEST ONLY Optional Video Job", required, clientId]);
    if (required) jobId = inserted.rows[0].id; else optionalJobId = inserted.rows[0].id;
  }
  const app = express(); app.use(express.json());
  server = await registerRoutes(app);
  app.use(express.static(path.resolve("dist/public")));
  app.get("*", (_req, res) => res.sendFile(path.resolve("dist/public/index.html")));
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  const login = await api("POST", "/api/login", { email, password }, "");
  assert.equal(login.status, 200, "Normal password login must succeed; no injected JWT");
  token = login.body.token;
  const talentLogin = await api("POST", "/api/talent-auth/login", { email, password }, "");
  assert.equal(talentLogin.status, 200);
  candidateToken = talentLogin.body.token;
  const otherLogin = await api("POST", "/api/login", { email: otherEmail, password }, "");
  assert.equal(otherLogin.status, 200); otherToken = otherLogin.body.token;
  const clientLogin = await api("POST", "/api/login", { email: `${clientId}@example.test`, password }, "");
  assert.equal(clientLogin.status, 200); clientToken = clientLogin.body.token;
  const adminLogin = await api("POST", "/api/login", { email: `${adminId}@example.test`, password }, "");
  assert.equal(adminLogin.status, 200); adminToken = adminLogin.body.token;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  context = await browser.newContext({ permissions: ["camera", "microphone"] });
  await context.addInitScript(({ candidateToken, candidateId, email }) => {
    localStorage.setItem("talent_profile_token", JSON.stringify({
      token: candidateToken, candidateId, email, fullName: "Video UAT Talent",
    }));
  }, { candidateToken, candidateId, email });
  page = await context.newPage();
  // Native confirm dialogs default to dismissal in Playwright. These prompts
  // belong only to this disposable account's explicit deletion scenarios.
  page.on("dialog", dialog => void dialog.accept());
}, { timeout: 90000 });
after(async () => {
  await browser?.close();
  server?.closeAllConnections();
  if (server) await new Promise<void>(r => server.close(() => r()));
  let cleanupFailed = false;
  for (const { namespace, id } of Array.from(objects.values())) {
    for (const published of [false, true]) {
      try { await candidateVideoStorage(namespace).discard(id, published); }
      catch { cleanupFailed = true; console.error("TEST object cleanup needs retry", { namespace, id, published }); }
    }
  }
  await pool.end();
  if (dir) await rm(dir, { recursive: true, force: true });
  assert.equal(cleanupFailed, false, "All test-only storage objects must be removed");
}, { timeout: 90000 });
async function openPage(route: string) {
  await page.goto(base + route);
  if (route === "/settings") await page.getByRole("button", { name: "Documents", exact: true }).click({ timeout: 20000 });
}

for (const [label, route] of [["Talent Profile", () => `/talent-profile/${candidateId}`], ["Profile Settings", () => "/settings"]] as const) {
  test(`${label}: actual signed-in page uploads 5/30/63/100/200 MiB, refresh, private persistence and cross-page consistency`, { timeout: 300000 }, async () => {
    for (const mb of [5, 30, 63, 100, 200]) {
      await openPage(route());
      const input = page.locator('input[type="file"][accept*="video/mp4"]').first();
      await input.waitFor({ state: "attached", timeout: 20000 });
      const response = page.waitForResponse(r => r.url().endsWith(`/api/candidates/${candidateId}/video/uploads/complete`) && r.request().method() === "POST", { timeout: 90000 });
      await input.setInputFiles(await file(mb));
      const saved = await response, body = await saved.json();
      assert.equal(saved.status(), 200, JSON.stringify(body)); remember(body.videoIntroUrl);
      const object = await new ObjectStorageService().getObjectEntityFile(body.videoIntroUrl);
      const [metadata] = await object.getMetadata();
      assert.equal(Number(metadata.size), mb * 1024 * 1024);
      assert.equal((await getObjectAclPolicy(object))?.visibility, "private");
      const stored = (await query("SELECT video_intro_url,video_intro_file_name FROM candidates WHERE id=$1", [candidateId])).rows[0];
      assert.equal(stored.video_intro_url, body.videoIntroUrl);
      assert.equal(stored.video_intro_file_name, `${mb}MiB-introduction.mp4`);
      await page.reload();
      if (route() === "/settings") await page.getByRole("button", { name: "Documents", exact: true }).click();
      await page.getByText(`${mb}MiB-introduction.mp4`, { exact: true }).first().waitFor({ timeout: 20000 });
      await openPage(label === "Talent Profile" ? "/settings" : `/talent-profile/${candidateId}`);
      await page.getByText(`${mb}MiB-introduction.mp4`, { exact: true }).first().waitFor({ timeout: 20000 });
      console.log(JSON.stringify({ page: label, MiB: mb, realPasswordLogin: true, realStorage: true, private: true, refreshAndCrossPage: true }));
    }
  });
}
test("actual application page: 63 MiB file upload and submit, correct persisted Talent/job, double-click prevention and review playback", { timeout: 120000 }, async () => {
  const prefill = await api("GET", `/api/jobs/${jobId}/application-prefill`, undefined, candidateToken);
  assert.equal(prefill.status, 200, JSON.stringify(prefill.body));
  await page.goto(`${base}/jobs/${jobId}/apply`);
  await page.getByRole("button", { name: /^Continue$/ }).click({ timeout: 20000 });
  // The required-video step initially offers the profile video. Select our new file.
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page.locator('input[type="file"][accept*="video/mp4"]').setInputFiles(await file(63));
  await page.getByText("63MiB-introduction.mp4", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  const savedResponse = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${jobId}/apply`) && r.request().method() === "POST", { timeout: 90000 });
  const completeResponse = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${jobId}/video/uploads/complete`), { timeout: 90000 });
  const submit = page.getByRole("button", { name: /Submit Application/ });
  // Two events in one task exercise the synchronous ref guard, not React's disabled state.
  await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  const completed = await completeResponse;
  assert.equal(completed.status(), 200);
  const receipt = (await completed.json()).applicationVideoToken;
  const raw = JSON.parse(Buffer.from(receipt.split(".")[1], "base64url").toString());
  remember(`/objects/application-videos/${raw.uploadId}`);
  const saved = await savedResponse, data = await saved.json();
  assert.equal(saved.status(), 201, JSON.stringify(data)); assert.equal(data.success, true);
  const rows = (await query("SELECT * FROM job_submissions WHERE job_id=$1 AND talent_id=$2", [jobId, userId])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, data.applicationId);
  assert.equal(rows[0].video_introduction_url, `/objects/application-videos/${raw.uploadId}`);
  assert.equal(rows[0].video_introduction_file_name, "63MiB-introduction.mp4");
  assert.equal(rows[0].status, "new");
  const object = await new ObjectStorageService().getObjectEntityFile(rows[0].video_introduction_url);
  assert.equal(Number((await object.getMetadata())[0].size), 63 * 1024 * 1024);
  const review = await fetch(`${base}/api/admin/job-applications/${data.applicationId}/video`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(review.status, 200); assert.match(review.headers.get("content-type") || "", /video\/mp4/);
  await review.body?.cancel();
  console.log("PASS actual application page + real storage + disposable database: one linked submission after double click");
});
test("actual application page: record, preview, release camera/microphone, upload and submit recorded video", { timeout: 90000 }, async () => {
  await page.goto(`${base}/jobs/${jobId}/apply`);
  await page.getByRole("heading", { name: "Review your details", exact: true }).waitFor({ timeout: 20000 });
  const warning = page.getByRole("button", { name: /Continue anyway/ });
  if (await warning.isVisible()) await warning.click();
  await page.getByRole("button", { name: /^Continue$/ }).click({ timeout: 20000 });
  await page.getByRole("button", { name: "Record a video introduction", exact: true }).click();
  await page.getByRole("button", { name: "Stop recording", exact: true }).waitFor();
  await page.waitForTimeout(1300); // capture actual fake-device frames/audio
  const tracks = await page.getByLabel("Live recording preview").evaluate((video: HTMLVideoElement) => (window as any).__uatTracks = (video.srcObject as MediaStream).getTracks());
  assert.ok(tracks.length >= 2);
  await page.getByRole("button", { name: "Stop recording", exact: true }).click();
  await page.getByLabel("Recorded introduction preview").waitFor();
  assert.equal(await page.evaluate(() => (window as any).__uatTracks.every((track: MediaStreamTrack) => track.readyState === "ended")), true);
  await page.getByRole("button", { name: /^Continue$/ }).click();
  const response = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${jobId}/apply`) && r.request().method() === "POST", { timeout: 60000 });
  await page.getByRole("button", { name: /Submit Application/ }).click();
  const saved = await response, data = await saved.json(); assert.equal(saved.status(), 201, JSON.stringify(data));
  const row = (await query("SELECT video_introduction_url,video_introduction_file_name FROM job_submissions WHERE id=$1", [data.applicationId])).rows[0];
  remember(row.video_introduction_url);
  assert.match(row.video_introduction_file_name, /^application-introduction\.(webm|mp4)$/);
  assert.equal((await getObjectAclPolicy(await new ObjectStorageService().getObjectEntityFile(row.video_introduction_url)))?.visibility, "private");
});
test("actual application form: interrupted storage transfer shows failure, saves no application, and retries the same file successfully", { timeout: 90000 }, async () => {
  const count = async () => Number((await query("SELECT count(*) FROM job_submissions WHERE job_id=$1 AND talent_id=$2", [jobId, userId])).rows[0].count);
  const before = await count();
  await page.goto(`${base}/jobs/${jobId}/apply`);
  await page.getByRole("heading", { name: "Review your details", exact: true }).waitFor({ timeout: 20000 });
  const warning = page.getByRole("button", { name: /Continue anyway/ });
  if (await warning.isVisible()) await warning.click();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page.locator('input[type="file"][accept*="video/mp4"]').setInputFiles(await file(5));
  await page.getByText("5MiB-introduction.mp4", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  let interrupted = false;
  await page.route("**/*", async route => {
    if (!interrupted && route.request().method() === "PUT" && !route.request().url().startsWith(base)) {
      interrupted = true;
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: /Submit Application/ }).click();
  await page.getByText(/Video upload could not reach storage/).first().waitFor({ timeout: 20000 });
  assert.equal(interrupted, true);
  assert.equal(await count(), before);
  await page.unroute("**/*");
  const completed = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${jobId}/video/uploads/complete`), { timeout: 60000 });
  const submitted = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${jobId}/apply`) && r.request().method() === "POST", { timeout: 60000 });
  await page.getByRole("button", { name: /Submit Application/ }).click();
  assert.equal((await completed).status(), 200);
  const response = await submitted, saved = await response.json();
  assert.equal(response.status(), 201, JSON.stringify(saved));
  const row = (await query("SELECT video_introduction_url FROM job_submissions WHERE id=$1", [saved.applicationId])).rows[0];
  remember(row.video_introduction_url);
  assert.equal(await count(), before + 1);
});
test("unavailable job shows its error rather than an indefinite preparation spinner", { timeout: 30000 }, async () => {
  await page.goto(`${base}/jobs/${randomUUID()}/apply`);
  await page.getByRole("heading", { name: "Job not found", exact: true }).waitFor({ timeout: 20000 });
});
test("required/optional video, reference ownership, idempotent retries and private access use actual routes and database", { timeout: 90000 }, async () => {
  assert.equal((await api("POST", `/api/jobs/${jobId}/apply`, fields())).status, 400);
  const noVideo = await api("POST", `/api/jobs/${optionalJobId}/apply`, fields(), token, randomUUID());
  assert.equal(noVideo.status, 201, JSON.stringify(noVideo.body));
  assert.equal((await query("SELECT video_introduction_url FROM job_submissions WHERE id=$1", [noVideo.body.applicationId])).rows[0].video_introduction_url, null);
  const receipt = await directApplicationUpload(5);
  assert.equal((await api("POST", `/api/jobs/${jobId}/apply`, fields({ applicationVideoToken: receipt }), otherToken)).status, 403);
  assert.equal((await api("POST", `/api/jobs/${optionalJobId}/apply`, fields({ applicationVideoToken: receipt }))).status, 403);
  const key = randomUUID();
  const saved = await api("POST", `/api/jobs/${jobId}/apply`, fields({ applicationVideoToken: receipt }), token, key);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const retries = await Promise.all([api("POST", `/api/jobs/${jobId}/apply`, fields({ applicationVideoToken: receipt }), token, key),
    api("POST", `/api/jobs/${jobId}/apply`, fields({ applicationVideoToken: receipt }), token, key)]);
  assert.ok(retries.every(r => r.status === 201 && r.body.applicationId === saved.body.applicationId));
  assert.equal((await query("SELECT count(*) FROM job_submissions WHERE id=$1", [saved.body.applicationId])).rows[0].count, "1");
  assert.equal((await api("POST", `/api/jobs/${jobId}/video/uploads`, { filename: "bad.mp4", size: 201 * 1024 * 1024, type: "video/mp4" })).status, 413);
  assert.equal((await api("POST", `/api/jobs/${jobId}/video/uploads`, { filename: "bad.txt", size: 5, type: "text/plain" })).status, 415);
  assert.equal((await api("POST", `/api/jobs/${jobId}/video/uploads`, {}, "")).status, 401);
  assert.equal((await api("POST", `/api/jobs/${jobId}/video/uploads`, {}, clientToken)).status, 403);
  assert.equal((await api("POST", `/api/jobs/${jobId}/video/uploads`, {}, adminToken)).status, 403);
  const denied = await fetch(`${base}/api/candidates/${candidateId}/video`, { headers: { Authorization: `Bearer ${otherToken}` } });
  assert.equal(denied.status, 403);
  const profile = (await query("SELECT video_intro_url FROM candidates WHERE id=$1", [candidateId])).rows[0];
  const privateRead = await fetch(`${base}/api/objects/${profile.video_intro_url.replace("/objects/", "")}`, { headers: { Authorization: `Bearer ${otherToken}` } });
  assert.ok([401, 403].includes(privateRead.status));
});
test("profile reuse snapshots survive profile removal; owner playback still works before removal", { timeout: 60000 }, async () => {
  const profile = (await query("SELECT video_intro_url FROM candidates WHERE id=$1", [candidateId])).rows[0];
  assert.ok(profile.video_intro_url);
  const submitted = await api("POST", `/api/jobs/${jobId}/apply`, fields({ useProfileVideo: "true" }), token, randomUUID());
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const playback = await fetch(`${base}/api/candidates/${candidateId}/video`, { headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(playback.status, 200); await playback.body?.cancel();
  const removed = await api("DELETE", `/api/candidates/${candidateId}/video`, undefined, candidateToken);
  assert.equal(removed.status, 200);
  const row = (await query("SELECT video_intro_url,video_intro_file_name FROM candidates WHERE id=$1", [candidateId])).rows[0];
  assert.equal(row.video_intro_url, null); assert.equal(row.video_intro_file_name, null);
  const attachment = (await query("SELECT video_introduction_url FROM job_submissions WHERE id=$1", [submitted.body.applicationId])).rows[0].video_introduction_url;
  assert.equal(attachment, profile.video_intro_url);
  assert.equal((await new ObjectStorageService().getObjectEntityFile(attachment).then(file => file.exists()))[0], true);
});
for (const [label, route] of [["Talent Profile", () => `/talent-profile/${candidateId}`], ["Profile Settings", () => "/settings"]] as const) {
  test(`${label}: record, preview, save, refresh and delete through the actual signed-in controls`, { timeout: 90000 }, async () => {
    await openPage(route());
    await page.getByRole("button", { name: /^(Re-record Video|Record a Video)$/i }).click();
    await page.getByRole("button", { name: "Start Recording", exact: true }).click();
    await page.waitForTimeout(1300);
    await page.getByRole("button", { name: "Stop Recording", exact: true }).click();
    const completed = page.waitForResponse(r => r.url().endsWith(`/api/candidates/${candidateId}/video/uploads/complete`), { timeout: 60000 });
    await page.getByRole("button", { name: "Save to Profile", exact: true }).click();
    const response = await completed, saved = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(saved)); remember(saved.videoIntroUrl);
    assert.match(saved.videoIntroFileName, /\.(webm|mp4)$/);
    await page.reload();
    if (route() === "/settings") await page.getByRole("button", { name: "Documents", exact: true }).click();
    await page.getByText(saved.videoIntroFileName, { exact: true }).first().waitFor();
    const deleted = page.waitForResponse(r => r.url().endsWith(`/api/candidates/${candidateId}/video`) && r.request().method() === "DELETE");
    await page.locator('button[title="Delete video"]').click();
    assert.equal((await deleted).status(), 200);
    const persisted = (await query("SELECT video_intro_url,video_intro_file_name FROM candidates WHERE id=$1", [candidateId])).rows[0];
    assert.equal(persisted.video_intro_url, null);
    assert.equal(persisted.video_intro_file_name, null);
    await assert.rejects(() => new ObjectStorageService().getObjectEntityFile(saved.videoIntroUrl), { name: "ObjectNotFoundError" });
  });
}
