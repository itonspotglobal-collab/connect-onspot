import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { candidateVideoError, MAX_CANDIDATE_VIDEO_BYTES, VIDEO_TOO_LARGE } from "../../shared/candidateVideo";
import { resolveAuth, type CandidateMediaDeps } from "./candidateMedia";
import type { CandidateVideoStorage } from "../services/candidateVideoStorage";

const metadata = z.object({
  filename: z.string().trim().min(1).max(255).refine(v => !/[\x00-\x1f]/.test(v)),
  size: z.number().int().positive(),
  type: z.string(),
}).strict();
const capability = metadata.extend({
  uploadId: z.string().uuid(), candidateId: z.string(), previousUrl: z.string().nullable(),
}).strip();

export function videoSignatureMatches(head: Buffer, type: string) {
  if (type === "video/webm") return head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (type === "video/x-msvideo") return head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "AVI ";
  if (type === "video/mpeg") return head[0] === 0 && head[1] === 0 && head[2] === 1 && [0xba, 0xb3].includes(head[3]);
  return head.length >= 12 && ["ftyp", "moov", "mdat", "wide", "free"].includes(head.toString("ascii", 4, 8));
}

export function registerCandidateVideoUploads(app: Express, deps: CandidateMediaDeps, store: CandidateVideoStorage) {
  const audience = "candidate-profile-video-upload";
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many video upload requests. Please try again shortly." } });
  const owner = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = await resolveAuth(req.headers.authorization, String(req.params.id), deps);
      if (!auth.authorized) return res.status(auth.status).json({ error: auth.error });
      next();
    } catch { res.status(503).json({ error: "Could not verify profile access. Please try again." }); }
  };
  const readCapability = (req: Request) => {
    const decoded = jwt.verify(req.body?.uploadToken, deps.jwtSecret, { audience, algorithms: ["HS256"] });
    const value = capability.parse(decoded);
    if (value.candidateId !== req.params.id) throw new Error("Wrong owner");
    return value;
  };
  const clean = async (id: string, published = false) => {
    try { await store.discard(id, published); }
    catch { console.warn("Candidate video cleanup needs retry", { published }); }
  };
  app.post("/api/candidates/:id/video/uploads", owner, limiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = metadata.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Provide a valid video filename, size and format." });
    const input = parsed.data;
    const error = candidateVideoError(input.size, input.type);
    if (error) return res.status(input.size > MAX_CANDIDATE_VIDEO_BYTES ? 413 : 415).json({ error });
    try {
      const row = await deps.dbQuery('SELECT video_intro_url AS "videoIntroUrl" FROM candidates WHERE id=$1 LIMIT 1', [req.params.id]);
      if (!row.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const target = await store.initiate();
      void store.pruneExpired?.().catch(() => console.warn("Pending candidate video maintenance needs retry"));
      const uploadToken = jwt.sign({ ...input, uploadId: target.uploadId, candidateId: req.params.id,
        previousUrl: row.rows[0].videoIntroUrl ?? null }, deps.jwtSecret, { audience, expiresIn: "15m", algorithm: "HS256" });
      res.json({ uploadUrl: target.uploadUrl, uploadToken, expiresIn: 900 });
    } catch { res.status(503).json({ error: "Video storage is temporarily unavailable. Please try again." }); }
  });
  app.post("/api/candidates/:id/video/uploads/complete", owner, async (req, res) => {
    res.set("Cache-Control", "no-store");
    let input: z.infer<typeof capability>;
    try { input = readCapability(req); }
    catch { return res.status(403).json({ error: "Upload authorization is invalid or expired. Please upload again." }); }
    const finalUrl = `/objects/candidate-videos/${input.uploadId}`;
    let published = false;
    let committed = false;
    try {
      const row = await deps.dbQuery('SELECT video_intro_url AS "videoIntroUrl" FROM candidates WHERE id=$1 LIMIT 1', [req.params.id]);
      if (!row.rows.length) { await clean(input.uploadId); return res.status(404).json({ error: "Candidate not found" }); }
      if (row.rows[0].videoIntroUrl === finalUrl) {
        return res.json({ success: true, videoIntroUrl: finalUrl, videoIntroFileName: input.filename });
      }
      if ((row.rows[0].videoIntroUrl ?? null) !== input.previousUrl) {
        await clean(input.uploadId);
        return res.status(409).json({ error: "Your video changed during upload. Refresh your profile and try again." });
      }
      const object = await store.inspect(input.uploadId);
      if (object.size > MAX_CANDIDATE_VIDEO_BYTES) {
        await clean(input.uploadId);
        return res.status(413).json({ error: VIDEO_TOO_LARGE });
      }
      if (object.size !== input.size || object.type !== input.type || !videoSignatureMatches(object.head, input.type)) {
        await clean(input.uploadId);
        return res.status(415).json({ error: "The uploaded file is incomplete or does not match its video format." });
      }
      await store.publish(input.uploadId, object.generation, input.type, input.filename);
      published = true;
      const saved = await deps.dbQuery(`UPDATE candidates SET video_intro_url=$2, video_intro_file_name=$3, updated_at=now()
        WHERE id=$1 AND video_intro_url IS NOT DISTINCT FROM $4 RETURNING id`,
      [req.params.id, finalUrl, input.filename, input.previousUrl]);
      if (!saved.rows.length) {
        await clean(input.uploadId, true);
        await clean(input.uploadId);
        return res.status(409).json({ error: "Your video changed during upload. Refresh your profile and try again." });
      }
      committed = true;
      await clean(input.uploadId);
      // Existing job applications can retain the previous profile video URL.
      // Replacement must not silently break their historical attachments.
      res.json({ success: true, videoIntroUrl: finalUrl, videoIntroFileName: input.filename });
    } catch {
      if (published && !committed) {
        // A lost database acknowledgement is not proof of a rollback. Never
        // delete media that may already be referenced by a committed profile.
        try {
          const persisted = await deps.dbQuery('SELECT video_intro_url AS "videoIntroUrl" FROM candidates WHERE id=$1 LIMIT 1', [req.params.id]);
          if (persisted.rows[0]?.videoIntroUrl === finalUrl) {
            await clean(input.uploadId);
            return res.json({ success: true, videoIntroUrl: finalUrl, videoIntroFileName: input.filename });
          }
          await clean(input.uploadId, true);
        } catch { console.warn("Candidate video commit state requires reconciliation"); }
      }
      await clean(input.uploadId);
      res.status(503).json({ error: "Could not confirm your video was saved. Please refresh your profile before retrying." });
    }
  });
  app.post("/api/candidates/:id/video/uploads/cancel", owner, async (req, res) => {
    let input: z.infer<typeof capability>;
    try { input = readCapability(req); }
    catch { return res.status(403).json({ error: "Upload authorization is invalid or expired." }); }
    await clean(input.uploadId);
    res.json({ success: true });
  });
}
