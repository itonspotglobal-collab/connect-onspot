import type { Express, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { candidateVideoError, MAX_CANDIDATE_VIDEO_BYTES, VIDEO_TOO_LARGE } from "../../shared/candidateVideo";
import { videoSignatureMatches } from "./candidateVideoUploads";
import type { CandidateVideoStorage } from "../services/candidateVideoStorage";

const audience = "job-application-video-upload";
const metadata = z.object({
  filename: z.string().trim().min(1).max(255).refine(v => !/[\x00-\x1f]/.test(v)),
  size: z.number().int().positive(), type: z.string(),
}).strict();
const claims = metadata.extend({
  uploadId: z.string().uuid(), jobId: z.string(), userId: z.string(),
  generation: z.string().optional(),
}).strip();

export function readApplicationVideoToken(token: unknown, secret: string, userId: string, jobId: string, completed = true) {
  if (typeof token !== "string") throw new Error("Missing video authorization");
  const value = claims.parse(jwt.verify(token, secret, { audience, algorithms: ["HS256"] }));
  if (value.userId !== userId || value.jobId !== jobId || (completed && !value.generation)) {
    throw new Error("Video authorization does not match this application");
  }
  return value;
}

export async function verifyApplicationVideoObject(
  input: z.infer<typeof claims>, store: CandidateVideoStorage,
) {
  const object = await store.inspect(input.uploadId);
  if (object.size > MAX_CANDIDATE_VIDEO_BYTES) throw Object.assign(new Error(VIDEO_TOO_LARGE), { status: 413 });
  if (object.size !== input.size || object.type !== input.type ||
      (input.generation && input.generation !== object.generation) ||
      !videoSignatureMatches(object.head, input.type)) {
    throw Object.assign(new Error("Your video upload is incomplete or invalid. Please upload again."), { status: 415 });
  }
  return object;
}

export function registerApplicationVideoUploads(app: Express, deps: {
  authenticate: RequestHandler;
  jwtSecret: string;
  getJob: (id: string) => Promise<any>;
  store: CandidateVideoStorage;
}) {
  const { store } = deps;
  const owner: RequestHandler = (req, res, next) => {
    const user = (req as any).user;
    if (!user || user.role !== "talent") return void res.status(403).json({ error: "Talent access required" });
    res.set("Cache-Control", "no-store");
    next();
  };
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
  const base = "/api/jobs/:jobId/video/uploads";
  app.post(base, deps.authenticate, owner, limiter, async (req, res) => {
    const parsed = metadata.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Provide a valid video filename, size and format." });
    const error = candidateVideoError(parsed.data.size, parsed.data.type);
    if (error) return res.status(parsed.data.size > MAX_CANDIDATE_VIDEO_BYTES ? 413 : 415).json({ error });
    try {
      const job = await deps.getJob(String(req.params.jobId));
      if (!job || job.status !== "open" || job.applicationMethod === "external_link") {
        return res.status(400).json({ error: "This job is not accepting built-in applications." });
      }
      const target = await store.initiate();
      void store.pruneExpired?.().catch(() => console.warn("Pending application video maintenance needs retry"));
      const uploadToken = jwt.sign({ ...parsed.data, uploadId: target.uploadId,
        userId: (req as any).user.id, jobId: req.params.jobId }, deps.jwtSecret,
      { audience, algorithm: "HS256", expiresIn: "15m" });
      res.json({ uploadUrl: target.uploadUrl, uploadToken, expiresIn: 900 });
    } catch { res.status(503).json({ error: "Video storage is temporarily unavailable. Please retry." }); }
  });
  app.post(`${base}/complete`, deps.authenticate, owner, async (req, res) => {
    let input: z.infer<typeof claims>;
    try { input = readApplicationVideoToken(req.body?.uploadToken, deps.jwtSecret, (req as any).user.id, String(req.params.jobId), false); }
    catch { return res.status(403).json({ error: "Video upload authorization is invalid or expired." }); }
    try {
      const object = await verifyApplicationVideoObject(input, store);
      // Bytes remain in quarantine until the application persists. A review screen
      // or completed PUT alone must never imply a submitted application.
      const applicationVideoToken = jwt.sign({ ...input, generation: object.generation }, deps.jwtSecret,
        { audience, algorithm: "HS256", expiresIn: "15m" });
      res.json({ success: true, applicationVideoToken });
    } catch (error: any) {
      await store.discard(input.uploadId).catch(() => {});
      res.status(error.status || 503).json({ error: error.status ? error.message : "Could not verify your video. Please upload again." });
    }
  });
  app.post(`${base}/cancel`, deps.authenticate, owner, async (req, res) => {
    try {
      const input = readApplicationVideoToken(req.body?.uploadToken, deps.jwtSecret, (req as any).user.id, String(req.params.jobId), false);
      await store.discard(input.uploadId);
      res.json({ success: true });
    } catch { res.status(403).json({ error: "Could not cancel this upload." }); }
  });
}
