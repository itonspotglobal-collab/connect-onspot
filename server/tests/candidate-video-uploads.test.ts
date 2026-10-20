import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { registerCandidateVideoUploads } from "../routes/candidateVideoUploads";
import { MAX_CANDIDATE_VIDEO_BYTES, VIDEO_TOO_LARGE } from "../../shared/candidateVideo";
import type { CandidateMediaDeps } from "../routes/candidateMedia";
import type { CandidateVideoStorage } from "../services/candidateVideoStorage";

const secret = "isolated-video-upload-fixture-only";
const auth = (id = "owner") => `Bearer ${jwt.sign({ type: "candidate", candidateId: id }, secret)}`;
const head = Buffer.from("000000186674797069736f6d0000020069736f6d", "hex");
let current: string | null = null;
let failCommit = false;
let failInspect = false;
let inspectOverride: Record<string, unknown> = {};
const pending = new Map<string, { size: number; type: string }>();
const published = new Set<string>();
const deleted: string[] = [];
let server: Server, base: string;
const store: CandidateVideoStorage = {
  async initiate() {
    const uploadId = randomUUID();
    return { uploadId, uploadUrl: `https://storage.fixture.invalid/${uploadId}` };
  },
  async inspect(id) {
    if (failInspect) throw new Error("Provider secret error must not escape");
    const item = pending.get(id);
    if (!item) throw new Error("Not uploaded");
    return { ...item, generation: "42", head, ...inspectOverride } as any;
  },
  async publish(id) { published.add(id); return `/objects/candidate-videos/${id}`; },
  async discard(id, final = false) { if (final) published.delete(id); else pending.delete(id); },
};
const deps: CandidateMediaDeps = {
  jwtSecret: secret,
  async dbQuery(sql, args) {
    if (sql.startsWith("UPDATE")) {
      if (failCommit) throw new Error("DB unavailable");
      if (current !== args[3]) return { rows: [] };
      current = args[1];
      return { rows: [{ id: "owner" }] };
    }
    return { rows: [{ videoIntroUrl: current }] };
  },
  async updateCandidate() {},
  async saveToStorage() { throw new Error("No buffered uploads allowed"); },
  async deleteFromStorage(path) { deleted.push(path); },
};
before(async () => {
  const app = express(); app.use(express.json({ limit: "16kb" }));
  registerCandidateVideoUploads(app, deps, store);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as any).port}/api/candidates/owner/video/uploads`;
});
after(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
async function post(path: string, body: any, authorization = auth()) {
  return fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify(body) });
}
async function start(size = 5 * 1024 * 1024) {
  const response = await post("", { filename: "intro.mp4", size, type: "video/mp4" });
  assert.equal(response.status, 200);
  const value = await response.json();
  const claims = jwt.decode(value.uploadToken) as any;
  pending.set(claims.uploadId, { size, type: "video/mp4" });
  return { ...value, id: claims.uploadId, claims };
}
test("unauthenticated and another candidate cannot authorize, complete or cancel uploads", async () => {
  for (const path of ["", "/complete", "/cancel"]) {
    assert.equal((await post(path, {}, "")).status, 401);
    assert.equal((await post(path, {}, auth("other"))).status, 403);
    assert.equal((await post(path, {}, `Bearer ${jwt.sign({ role: "admin" }, secret)}`)).status, 403);
  }
});
for (const mb of [5, 30, 63, 100, 200]) {
  test(`${mb} MiB: scoped direct upload, verification, replacement and idempotent metadata commit`, async () => {
    const old = current;
    const upload = await start(mb * 1024 * 1024);
    assert.equal(upload.claims.exp - upload.claims.iat, 900);
    assert.equal(current, old, "Initiation must not change metadata");
    const response = await post("/complete", { uploadToken: upload.uploadToken });
    assert.equal(response.status, 200);
    assert.equal(current, `/objects/candidate-videos/${upload.id}`);
    assert.equal(pending.has(upload.id), false);
    assert.equal((await post("/complete", { uploadToken: upload.uploadToken })).status, 200);
    if (old) assert.ok(!deleted.includes(old), "Keep historical job-application attachments intact");
  });
}
test("over 200 MiB and unsupported/missing file metadata fail before storage allocation", async () => {
  const response = await post("", { filename: "large.mp4", size: MAX_CANDIDATE_VIDEO_BYTES + 1, type: "video/mp4" });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, VIDEO_TOO_LARGE);
  assert.equal((await post("", { filename: "bad.html", size: 20, type: "text/html" })).status, 415);
  assert.equal((await post("", {})).status, 400);
});
test("capability cannot be forged, moved to another candidate, or used after expiry", async () => {
  assert.equal((await post("/complete", { uploadToken: "bad" })).status, 403);
  const u = await start();
  const token = jwt.sign({ ...u.claims, candidateId: "other" }, secret);
  assert.equal((await post("/complete", { uploadToken: token })).status, 403);
  const expired = jwt.sign({ ...u.claims, exp: 1 }, secret);
  assert.equal((await post("/complete", { uploadToken: expired })).status, 403);
  await post("/cancel", { uploadToken: u.uploadToken });
});
test("authoritative stored size/type/signature are checked, not trusted from the browser", async () => {
  const original = current;
  for (const mismatch of [
    { size: MAX_CANDIDATE_VIDEO_BYTES + 1 }, { size: 100 }, { type: "text/html" }, { head: Buffer.from("not a video") },
  ]) {
    const u = await start();
    inspectOverride = mismatch;
    const response = await post("/complete", { uploadToken: u.uploadToken });
    assert.equal(response.status, "size" in mismatch && mismatch.size > MAX_CANDIDATE_VIDEO_BYTES ? 413 : 415);
    assert.equal(pending.has(u.id), false);
    assert.equal(current, original);
    assert.equal(published.has(u.id), false);
  }
  inspectOverride = {};
});
test("storage and DB failures preserve previous metadata and clean new objects", async () => {
  const original = current;
  const a = await start();
  failInspect = true;
  const response = await post("/complete", { uploadToken: a.uploadToken });
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /Provider secret/);
  failInspect = false;
  const b = await start();
  failCommit = true;
  assert.equal((await post("/complete", { uploadToken: b.uploadToken })).status, 503);
  failCommit = false;
  assert.equal(published.has(b.id), false);
  assert.equal(current, original);
});
test("overlapping replacements reject the stale authorization and preserve winning video", async () => {
  const a = await start(), b = await start();
  assert.equal((await post("/complete", { uploadToken: a.uploadToken })).status, 200);
  assert.equal((await post("/complete", { uploadToken: b.uploadToken })).status, 409);
  assert.equal(current, `/objects/candidate-videos/${a.id}`);
});
test("cancellation only removes pending bytes, never the committed video", async () => {
  const u = await start();
  assert.equal((await post("/complete", { uploadToken: u.uploadToken })).status, 200);
  assert.equal((await post("/cancel", { uploadToken: u.uploadToken })).status, 200);
  assert.equal(published.has(u.id), true);
});
