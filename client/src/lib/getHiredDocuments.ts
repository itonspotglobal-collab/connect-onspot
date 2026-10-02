export type GetHiredDocumentType = "resume" | "video_intro";

const documentTypes = {
  resume: {
    accept: ".pdf,.doc,.docx",
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  video_intro: {
    accept: ".mp4,.mov,.avi,.webm",
    maxSize: 100 * 1024 * 1024,
    mimeTypes: ["video/mp4", "video/quicktime", "video/x-msvideo", "video/avi", "video/webm"],
  },
} as const;

export function getHiredFileRules(type: GetHiredDocumentType) {
  return documentTypes[type];
}

export function validateGetHiredFile(file: Pick<File, "name" | "size" | "type">, type: GetHiredDocumentType) {
  const rules = documentTypes[type];
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!rules.accept.split(",").includes(extension) ||
      (file.type && !(rules.mimeTypes as readonly string[]).includes(file.type))) {
    throw new Error(`Choose a supported file: ${rules.accept}.`);
  }
  if (file.size <= 0 || file.size > rules.maxSize) {
    throw new Error(`Choose a non-empty file no larger than ${rules.maxSize / 1024 / 1024}MB.`);
  }
}

export interface GetHiredUploadResult {
  successful?: { name: string; uploadURL?: string; data?: File }[];
  failed?: unknown[];
}

/** Called only after ObjectUploader has uploaded bytes. Never synthesize a reference. */
export async function persistGetHiredDocument(
  result: GetHiredUploadResult,
  type: GetHiredDocumentType,
  patch: (url: string, body: { fileUrl: string; fileName: string }) => Promise<unknown>,
) {
  const file = result.successful?.[0];
  if (!file || result.successful?.length !== 1 || result.failed?.length) {
    throw new Error("The file upload did not complete. Please try again.");
  }
  const fileUrl = file.uploadURL;
  if (!file.name || !fileUrl || !/^\/objects\/uploads\/[A-Za-z0-9-]+$/.test(fileUrl)) {
    throw new Error("Upload did not return a permanent private object reference.");
  }
  const field = type === "resume" ? "resumeUrl" : "videoIntroUrl";
  const endpoint = type === "resume" ? "/api/talent/me/resume-url" : "/api/talent/me/video-intro-url";
  const saved = await patch(endpoint, { fileUrl, fileName: file.name }) as Record<string, unknown> | null;
  if (saved?.success !== true || saved[field] !== fileUrl) {
    throw new Error("File uploaded but could not be confirmed on your profile. Please try again.");
  }
  return {
    file: file.data,
    document: {
      id: type,
      type,
      fileName: file.name,
      fileUrl,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Uses the existing authenticated ACL route, not a public or signed storage URL. */
export function getHiredRetrievalPath(fileUrl: string): string {
  if (!/^\/objects\/[A-Za-z0-9/_-]+$/.test(fileUrl)) {
    throw new Error("This document does not have a supported private object reference.");
  }
  return `/api${fileUrl}`;
}