/**
 * candidateMedia.ts
 *
 * Registers the four candidate resume/video upload-and-delete route handlers on
 * an Express app.  All I/O dependencies are injected so the handlers can be
 * mounted in tests with mocked storage, ACL, and DB without a live connection.
 *
 * Production usage (routes.ts):
 *   import { registerCandidateMediaRoutes } from "./routes/candidateMedia.js";
 *   registerCandidateMediaRoutes(app, upload, {
 *     jwtSecret:       process.env.JWT_SECRET || "dev-fallback-secret",
 *     dbQuery:         query,
 *     updateCandidate: (id, u) => storage.updateCandidate(id, u as any),
 *     saveToStorage:   async (subdir, buf, mime, name) => { ... return url; },
 *     deleteFromStorage: async (url) => { ... },
 *   });
 */

import type { Express } from "express";
import type { Multer } from "multer";
import { checkCandidateMediaAuth } from "../lib/candidateMediaAuth.js";

// ─── Dependency interface ──────────────────────────────────────────────────────

export interface CandidateMediaDeps {
  /** JWT signing secret (process.env.JWT_SECRET in production). */
  jwtSecret: string;

  /**
   * Execute a parameterised SQL query and return its rows.
   * Used only for the talent-role JWT email ownership check.
   */
  dbQuery: (sql: string, params: any[]) => Promise<{ rows: any[] }>;

  /**
   * Persist `resumeUrl`+`resumeFileName` or `videoIntroUrl`+`videoIntroFileName`
   * (or clear them to null) on the candidate row.
   */
  updateCandidate: (id: string, updates: Record<string, any>) => Promise<any>;

  /**
   * Upload a file buffer to private object storage.
   *
   * @param subdir   "candidate-resumes" | "candidate-videos"
   * @param buffer   Raw file bytes
   * @param mimetype File MIME type (e.g. "application/pdf")
   * @param originalName  Original file name from the upload
   * @returns        The stored object path, e.g. "/objects/candidate-resumes/<uuid>"
   */
  saveToStorage: (
    subdir: "candidate-resumes" | "candidate-videos",
    buffer: Buffer,
    mimetype: string,
    originalName: string,
  ) => Promise<string>;

  /**
   * Delete a previously stored object by its path
   * (e.g. "/objects/candidate-resumes/<uuid>").
   * Must be tolerant of "not found" — ignore it rather than throwing.
   */
  deleteFromStorage: (url: string) => Promise<void>;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Full auth resolution: handles both candidate-JWT (pure) and talent-email
 * (requires DB check) paths in one async function.
 */
async function resolveAuth(
  authHeader: string | undefined,
  candidateId: string,
  deps: Pick<CandidateMediaDeps, "jwtSecret" | "dbQuery">,
): Promise<{ authorized: true } | { authorized: false; status: 401 | 403; error: string }> {
  const result = checkCandidateMediaAuth(authHeader, candidateId, deps.jwtSecret);

  if (result.ok) return { authorized: true };

  if (result.error === "talent-email-check-required") {
    const { email } = result as any;
    const check = await deps.dbQuery(
      `SELECT id FROM candidates WHERE id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
      [candidateId, email],
    );
    if (check.rows.length > 0) return { authorized: true };
    return { authorized: false, status: 403, error: "You are not authorized to upload to this profile" };
  }

  return { authorized: false, status: (result as any).status, error: (result as any).error };
}

// ─── Route registration ────────────────────────────────────────────────────────

export function registerCandidateMediaRoutes(
  app: Express,
  upload: Multer,
  deps: CandidateMediaDeps,
): void {
  const ALLOWED_RESUME_MIMES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const ALLOWED_VIDEO_MIMES = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/mpeg",
  ];

  // ── POST /api/candidates/:id/resume ─────────────────────────────────────────
  app.post(
    "/api/candidates/:id/resume",
    upload.single("resume"),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;

        const auth = await resolveAuth(req.headers["authorization"], id, deps);
        if (!auth.authorized) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        if (!ALLOWED_RESUME_MIMES.includes(file.mimetype)) {
          return res.status(400).json({ error: "Only PDF or Word documents are allowed" });
        }
        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ error: "File too large — max 10 MB" });
        }

        const resumeUrl = await deps.saveToStorage(
          "candidate-resumes",
          file.buffer,
          file.mimetype,
          file.originalname,
        );

        await deps.updateCandidate(id, { resumeUrl, resumeFileName: file.originalname });

        res.json({ success: true, resumeUrl, resumeFileName: file.originalname });
      } catch (error: any) {
        console.error("POST /api/candidates/:id/resume error:", error);
        res.status(500).json({ error: "Failed to upload resume" });
      }
    },
  );

  // ── DELETE /api/candidates/:id/resume ───────────────────────────────────────
  app.delete("/api/candidates/:id/resume", async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const auth = await resolveAuth(req.headers["authorization"], id, deps);
      if (!auth.authorized) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const row = await deps.dbQuery(
        `SELECT resume_url AS "resumeUrl" FROM candidates WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (!row.rows.length) return res.status(404).json({ error: "Candidate not found" });

      const { resumeUrl } = row.rows[0];
      if (resumeUrl) {
        try {
          await deps.deleteFromStorage(resumeUrl);
        } catch (delErr) {
          console.warn("DELETE /api/candidates/:id/resume — could not delete object:", delErr);
          // Non-fatal: clear the DB record regardless
        }
      }

      await deps.updateCandidate(id, { resumeUrl: null, resumeFileName: null });
      res.json({ success: true });
    } catch (error: any) {
      console.error("DELETE /api/candidates/:id/resume error:", error);
      res.status(500).json({ error: "Failed to delete resume" });
    }
  });

  // ── POST /api/candidates/:id/video ──────────────────────────────────────────
  app.post(
    "/api/candidates/:id/video",
    upload.single("video"),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;

        const auth = await resolveAuth(req.headers["authorization"], id, deps);
        if (!auth.authorized) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        if (!ALLOWED_VIDEO_MIMES.includes(file.mimetype)) {
          return res.status(400).json({ error: "Only MP4, WebM, MOV, AVI or MPEG video files are allowed" });
        }
        if (file.size > 200 * 1024 * 1024) {
          return res.status(400).json({ error: "File too large — max 200 MB" });
        }

        const videoIntroUrl = await deps.saveToStorage(
          "candidate-videos",
          file.buffer,
          file.mimetype,
          file.originalname,
        );

        await deps.updateCandidate(id, { videoIntroUrl, videoIntroFileName: file.originalname });

        res.json({ success: true, videoIntroUrl, videoIntroFileName: file.originalname });
      } catch (error: any) {
        console.error("POST /api/candidates/:id/video error:", error);
        res.status(500).json({ error: "Failed to upload video" });
      }
    },
  );

  // ── DELETE /api/candidates/:id/video ────────────────────────────────────────
  app.delete("/api/candidates/:id/video", async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const auth = await resolveAuth(req.headers["authorization"], id, deps);
      if (!auth.authorized) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const candRow = await deps.dbQuery(
        `SELECT video_intro_url AS "videoIntroUrl" FROM candidates WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (!candRow.rows.length) return res.status(404).json({ error: "Candidate not found" });

      const { videoIntroUrl } = candRow.rows[0];
      if (videoIntroUrl) {
        try {
          await deps.deleteFromStorage(videoIntroUrl);
        } catch (delErr) {
          console.warn("DELETE /api/candidates/:id/video — could not delete object:", delErr);
          // Non-fatal: clear the DB record regardless
        }
      }

      await deps.updateCandidate(id, { videoIntroUrl: null, videoIntroFileName: null });
      res.json({ success: true });
    } catch (error: any) {
      console.error("DELETE /api/candidates/:id/video error:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });
}
