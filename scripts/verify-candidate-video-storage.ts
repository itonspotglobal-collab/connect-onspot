/**
 * Explicit opt-in real PRIVATE STORAGE transport check; no real accounts/DB edits.
 * Uses actual production upload route handlers with fixture DB and signed fixture JWTs.
 * npx tsx scripts/verify-candidate-video-storage.ts --execute
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import express from "express";
import jwt from "jsonwebtoken";
import { registerCandidateVideoUploads } from "../server/routes/candidateVideoUploads";
import { candidateVideoStorage } from "../server/services/candidateVideoStorage";
import { ObjectStorageService } from "../server/objectStorage";
import { getObjectAclPolicy } from "../server/objectAcl";
import { build } from "esbuild";

let stage = "setup";

async function run() {
  if (!process.argv.includes("--execute")) throw new Error("Requires explicit --execute; writes and removes private test objects.");
  const secret = randomUUID() + randomUUID();
  const id = `transport-fixture-${randomUUID()}`;
  const authorization = `Bearer ${jwt.sign({ type: "candidate", candidateId: id }, secret)}`;
  const store = candidateVideoStorage();
  const cleanup = new Set<string>();
  let current: string | null = null;
  const app = express(); app.use(express.json({ limit: "16kb" }));
  if (process.argv.includes("--browser63")) {
    const bundle = await build({ entryPoints: ["client/src/lib/uploadCandidateVideo.ts"], bundle: true, format: "esm", write: false });
    app.get("/video-helper.js", (_req, res) => res.type("application/javascript").send(bundle.outputFiles[0].text));
    app.get("/video-uat", (_req, res) => res.type("html").send(`<input type="file" id="fixture">
      <script type="module">import {uploadCandidateVideo} from '/video-helper.js'; window.uploadVideo=uploadCandidateVideo;</script>`));
  }
  registerCandidateVideoUploads(app, {
    jwtSecret: secret,
    async dbQuery(sql, args) {
      if (sql.startsWith("UPDATE")) {
        if (current !== args[3]) return { rows: [] };
        current = args[1]; return { rows: [{ id }] };
      }
      return { rows: [{ videoIntroUrl: current }] };
    },
    async updateCandidate() {},
    async saveToStorage() { throw new Error("No buffered transport"); },
    async deleteFromStorage(url) { await (await new ObjectStorageService().getObjectEntityFile(url)).delete({ ignoreNotFound: true }); },
  }, store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/candidates/${id}/video/uploads`;
  const dir = await mkdtemp(path.join(tmpdir(), "candidate-video-transport-"));
  const seed = path.join(dir, "seed.mp4");
  try {
    const made = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=32x32:d=1", "-c:v", "libx264", "-movflags", "+faststart", seed]);
    assert.equal(made.status, 0, "Playable MP4 fixture generation failed");
    const seedBytes = await import("node:fs/promises").then(fs => fs.readFile(seed));
    for (const mb of process.argv.includes("--browser63") ? [63] : [5, 30, 63, 100, 200]) {
      stage = `${mb}MiB initiate`;
      const size = mb * 1024 * 1024;
      const fixture = path.join(dir, `${mb}.mp4`);
      const handle = await open(fixture, "w");
      const padding = Buffer.alloc(8); padding.writeUInt32BE(size - seedBytes.length); padding.write("free", 4, "ascii");
      await handle.write(seedBytes); await handle.write(padding); await handle.truncate(size); await handle.close();
      const post = (suffix: string, body: unknown) => fetch(base + suffix, { method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const init = await post("", { filename: `${mb}MiB-test-only.mp4`, size, type: "video/mp4" });
      assert.equal(init.status, 200);
      const { uploadUrl, uploadToken } = await init.json();
      const claims = jwt.decode(uploadToken) as any; cleanup.add(claims.uploadId);
      // Check browser-origin preflight on the real signed destination, without logging it.
      const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      stage = `${mb}MiB CORS preflight`;
      const cors = await fetch(uploadUrl, { method: "OPTIONS", headers: {
        Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type",
      } });
      assert.ok([origin, "*"].includes(cors.headers.get("access-control-allow-origin") || ""), "Storage CORS does not permit this preview origin");
      stage = `${mb}MiB direct PUT`;
      let putStatus: number;
      if (process.argv.includes("--browser63")) {
        // Exercise the actual browser uploader, including storage CORS, progress,
        // application authorization, and completion. No storage/network mocks.
        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
        try {
          const page = await browser.newPage();
          await page.goto(base.split("/api/")[0] + "/video-uat");
          await page.waitForFunction(() => typeof (window as any).uploadVideo === "function");
          await page.locator("#fixture").setInputFiles(fixture);
          const result = await page.evaluate(async ({ id, authorization }) => {
            const progress: number[] = [];
            const file = (document.querySelector("#fixture") as HTMLInputElement).files![0];
            const saved = await (window as any).uploadVideo(id, file, authorization, (p: number) => progress.push(p));
            return { saved, progress };
          }, { id, authorization });
          assert.equal(result.saved.success, true);
          assert.equal(result.progress.at(-1), 100);
          assert.ok(result.progress.some(p => p > 0 && p < 100));
          // The browser initiated its own scoped upload; retain that final object
          // for the same persistence checks and deterministic cleanup below.
          const browserUploadId = result.saved.videoIntroUrl.split("/").at(-1);
          cleanup.add(browserUploadId);
          const browserFile = await new ObjectStorageService().getObjectEntityFile(result.saved.videoIntroUrl);
          const [browserMeta] = await browserFile.getMetadata();
          assert.equal(Number(browserMeta.size), size);
          assert.equal((await getObjectAclPolicy(browserFile))?.visibility, "private");
          console.log(JSON.stringify({ fixtureMiB: mb, actualBrowserToRealStorage: true, progress: true, finalized: true, persistedBytes: size, private: true }));
        } finally { await browser.close(); }
        await store.discard(claims.uploadId);
        await rm(fixture);
        continue;
      } else {
        const uploaded = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(size), Origin: origin },
          body: Readable.toWeb(createReadStream(fixture)) as any, duplex: "half" } as any);
        assert.ok(uploaded.ok, `Direct storage ${mb}MiB returned ${uploaded.status}`);
        putStatus = uploaded.status;
      }
      stage = `${mb}MiB finalize`;
      const completed = await post("/complete", { uploadToken });
      const saved = await completed.json();
      assert.equal(completed.status, 200, saved.error);
      stage = `${mb}MiB persistent private read`;
      const file = await new ObjectStorageService().getObjectEntityFile(saved.videoIntroUrl);
      const [meta] = await file.getMetadata();
      assert.equal(Number(meta.size), size);
      assert.equal((await getObjectAclPolicy(file))?.visibility, "private");
      const [first] = await file.download({ start: 0, end: seedBytes.length - 1, validation: false });
      assert.ok(first.equals(seedBytes), "Playable original prefix changed");
      console.log(JSON.stringify({ fixtureMiB: mb, directPut: putStatus, finalize: completed.status, persistedBytes: Number(meta.size), private: true, cors: true }));
      await rm(fixture);
    }
    console.log("PASS: actual private storage transport and real handlers; fixture auth/database only, no live account UAT.");
  } finally {
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()));
    for (const uploadId of cleanup) {
      await store.discard(uploadId).catch(() => console.error("Pending test-object cleanup failed"));
      await store.discard(uploadId, true).catch(() => console.error("Final test-object cleanup failed"));
    }
    await rm(dir, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error("Private video transport verification failed", { stage, type: error.name, assertion: error.code === "ERR_ASSERTION" ? error.message : undefined }); process.exitCode = 1; });
