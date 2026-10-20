import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { registerApplicationVideoUploads, readApplicationVideoToken, verifyApplicationVideoObject } from "../routes/applicationVideoUploads";
import type { CandidateVideoStorage } from "../services/candidateVideoStorage";
const secret = "application-video-isolated-test-only";
const pending = new Map<string, any>();
let generation = "42", status = "open", published = 0;
const head = Buffer.from("000000186674797069736f6d0000020069736f6d", "hex");
const store: CandidateVideoStorage = {
  async initiate() { const uploadId = randomUUID(); return { uploadId, uploadUrl: `https://fixture.invalid/${uploadId}` }; },
  async inspect(id) { if (!pending.has(id)) throw new Error("Private provider failure"); return { ...pending.get(id), generation }; },
  async publish() { published++; return "not-used-by-completion"; },
  async discard(id) { pending.delete(id); },
};
let server: Server, base: string;
const auth = (id = "owner", role = "talent") => `Bearer ${jwt.sign({ userId: id, role }, secret)}`;
before(async () => {
  const app = express(); app.use(express.json());
  registerApplicationVideoUploads(app, {
    jwtSecret: secret, store, getJob: async () => ({ status }),
    authenticate(req, res, next) {
      try { (req as any).user = { id: (jwt.verify(req.headers.authorization!.slice(7), secret) as any).userId,
        role: (jwt.decode(req.headers.authorization!.slice(7)) as any).role }; next(); }
      catch { res.status(401).json({ error: "Authentication required" }); }
    },
  });
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as any).port}/api/jobs/job-one/video/uploads`;
});
after(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
const post = (suffix: string, body: any, authorization = auth()) => fetch(base + suffix, {
  method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
async function start(size = 5 * 1024 * 1024) {
  const response = await post("", { filename: "intro.mp4", size, type: "video/mp4" });
  assert.equal(response.status, 200);
  const value = await response.json(), input = jwt.decode(value.uploadToken) as any;
  pending.set(input.uploadId, { size, type: "video/mp4", head });
  return { ...value, input };
}
for (const mb of [5, 30, 63, 100, 200]) test(`${mb} MiB verified receipt is bound to Talent/job and stays quarantined until submit (fixture storage)`, async () => {
  const u = await start(mb * 1024 * 1024);
  const response = await post("/complete", { uploadToken: u.uploadToken });
  assert.equal(response.status, 200);
  const receipt = (await response.json()).applicationVideoToken;
  const input = readApplicationVideoToken(receipt, secret, "owner", "job-one");
  assert.equal(input.generation, "42");
  assert.throws(() => readApplicationVideoToken(receipt, secret, "other", "job-one"));
  assert.throws(() => readApplicationVideoToken(receipt, secret, "owner", "other-job"));
  assert.equal(published, 0);
});
test("anonymous and non-Talent accounts are denied on every application upload action", async () => {
  for (const suffix of ["", "/complete", "/cancel"]) {
    assert.equal((await post(suffix, {}, "")).status, 401);
    assert.equal((await post(suffix, {}, auth("client", "client"))).status, 403);
    assert.equal((await post(suffix, {}, auth("admin", "admin"))).status, 403);
  }
});
test("oversize/type/empty/malformed metadata are rejected before storage initiation", async () => {
  for (const input of [{ size: 200 * 1024 * 1024 + 1, type: "video/mp4" }, { size: 5, type: "text/plain" }, { size: 0, type: "video/mp4" }]) {
    assert.ok([400, 413, 415].includes((await post("", { filename: "bad", ...input })).status));
  }
});
test("closed job is rejected", async () => {
  status = "closed";
  assert.equal((await post("", { filename: "v.mp4", size: 5, type: "video/mp4" })).status, 400);
  status = "open";
});
test("upload capability cannot serve as a completed receipt", async () => {
  const u = await start();
  assert.throws(() => readApplicationVideoToken(u.uploadToken, secret, "owner", "job-one"));
  assert.equal((await post("/complete", { uploadToken: u.uploadToken }, auth("other"))).status, 403);
});
test("missing bytes and format/size/header mismatch never complete", async () => {
  for (const override of [null, { size: 1 }, { type: "text/plain" }, { head: Buffer.from("not video") }, { size: 201 * 1024 * 1024 }]) {
    const u = await start();
    if (override) pending.set(u.input.uploadId, { ...pending.get(u.input.uploadId), ...override });
    else pending.delete(u.input.uploadId);
    const response = await post("/complete", { uploadToken: u.uploadToken });
    assert.ok([413, 415, 503].includes(response.status));
    assert.doesNotMatch(JSON.stringify(await response.json()), /Private provider/);
  }
});
test("a generation changed after verification is rejected during submission", async () => {
  const u = await start();
  const receipt = (await (await post("/complete", { uploadToken: u.uploadToken })).json()).applicationVideoToken;
  const input = readApplicationVideoToken(receipt, secret, "owner", "job-one");
  generation = "43";
  await assert.rejects(() => verifyApplicationVideoObject(input, store));
  generation = "42";
});
test("expired, forged and profile capabilities cannot authorize an application attachment", () => {
  const input = { filename: "i.mp4", size: 5, type: "video/mp4", uploadId: randomUUID(), userId: "owner", jobId: "job-one", generation: "42" };
  for (const token of [
    jwt.sign(input, secret, { audience: "job-application-video-upload", expiresIn: -1 }),
    jwt.sign(input, "wrong-secret", { audience: "job-application-video-upload" }),
    jwt.sign(input, secret, { audience: "candidate-profile-video-upload" }),
  ]) assert.throws(() => readApplicationVideoToken(token, secret, "owner", "job-one"));
});
test("cancel deletes only the authenticated Talent's pending upload", async () => {
  const u = await start();
  assert.equal((await post("/cancel", { uploadToken: u.uploadToken }, auth("other"))).status, 403);
  assert.equal(pending.has(u.input.uploadId), true);
  assert.equal((await post("/cancel", { uploadToken: u.uploadToken })).status, 200);
  assert.equal(pending.has(u.input.uploadId), false);
});
