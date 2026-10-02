import type { RequestHandler } from "express";

export type TalentDocumentUrlQuery = (
  sql: string,
  parameters: unknown[],
) => Promise<{ rowCount?: number | null }>;

export type TalentDocumentObjectPolicy = {
  owner?: string;
  visibility: "private" | "public";
};

export class TalentDocumentObjectNotFoundError extends Error {
  constructor() {
    super("Document object not found");
    this.name = "TalentDocumentObjectNotFoundError";
  }
}

type TalentDocumentUrlHandlerDependencies = {
  query: TalentDocumentUrlQuery;
  readObjectPolicy: (fileUrl: string) => Promise<TalentDocumentObjectPolicy | null>;
  kind: "resume" | "videoIntro";
};

const DOCUMENT_CONFIG = {
  resume: {
    sql: `UPDATE candidates SET resume_url = $1, resume_file_name = $2, updated_at = NOW()
          WHERE lower(email) = lower($3)`,
    urlKey: "resumeUrl",
    fileNameKey: "resumeFileName",
    errorLabel: "resume",
  },
  videoIntro: {
    sql: `UPDATE candidates SET video_intro_url = $1, video_intro_file_name = $2, updated_at = NOW()
          WHERE lower(email) = lower($3)`,
    urlKey: "videoIntroUrl",
    fileNameKey: "videoIntroFileName",
    errorLabel: "video intro",
  },
} as const;

function isCanonicalObjectPath(fileUrl: unknown): fileUrl is string {
  if (typeof fileUrl !== "string" || !fileUrl || !fileUrl.startsWith("/objects/")) {
    return false;
  }

  // Accept only canonical path characters: no URL components, encodings, or
  // backslashes that could disguise an external/signed URL or traversal.
  if (!/^\/objects\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(fileUrl)) {
    return false;
  }
  return fileUrl.slice("/objects/".length).split("/").every(
    (segment) => segment !== "." && segment !== "..",
  );
}

export function createTalentDocumentUrlHandler({
  query,
  readObjectPolicy,
  kind,
}: TalentDocumentUrlHandlerDependencies): RequestHandler {
  const config = DOCUMENT_CONFIG[kind];

  return async (req: any, res: any) => {
    const email = req.user?.email;
    const userId = req.user?.id || req.user?.claims?.sub || req.user?.sub;
    if (!email || !userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { fileUrl, fileName } = req.body ?? {};
    if (!isCanonicalObjectPath(fileUrl)) {
      return res.status(400).json({ error: "fileUrl must be a canonical /objects/ path" });
    }

    try {
      const policy = await readObjectPolicy(fileUrl);
      if (!policy) {
        return res.status(403).json({ error: "Document object ACL policy is missing" });
      }
      if (policy.visibility !== "private" || policy.owner !== userId) {
        return res.status(403).json({ error: "Document object is not privately owned by this user" });
      }

      const result = await query(config.sql, [fileUrl, fileName ?? null, email]);
      if ((result.rowCount ?? 0) === 0) {
        return res.status(404).json({
          error: "Candidate profile not found — please complete your profile setup first.",
        });
      }

      return res.json({
        success: true,
        [config.urlKey]: fileUrl,
        [config.fileNameKey]: fileName ?? null,
      });
    } catch (error) {
      if (error instanceof TalentDocumentObjectNotFoundError) {
        return res.status(404).json({ error: "Document object not found" });
      }
      return res.status(500).json({ error: `Failed to update talent ${config.errorLabel} URL` });
    }
  };
}