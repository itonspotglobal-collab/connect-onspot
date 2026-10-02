import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  getHiredFileRules, getHiredRetrievalPath, persistGetHiredDocument, validateGetHiredFile,
} from "./getHiredDocuments";

const fileUrl = "/objects/uploads/11111111-1111-4111-8111-111111111111";
const result = { successful: [{ name: "resume.pdf", uploadURL: fileUrl }], failed: [] };

describe("Get Hired confirmed document references", () => {
  for (const type of ["resume", "video_intro"] as const) {
    it(`persists ${type} and returns only the server-confirmed permanent reference`, async () => {
      const field = type === "resume" ? "resumeUrl" : "videoIntroUrl";
      const patch = vi.fn(async () => ({ success: true, [field]: fileUrl }));
      const saved = await persistGetHiredDocument(result, type, patch);
      expect(patch).toHaveBeenCalledWith(
        type === "resume" ? "/api/talent/me/resume-url" : "/api/talent/me/video-intro-url",
        { fileUrl, fileName: "resume.pdf" },
      );
      expect(saved.document.fileUrl).toBe(fileUrl);
      expect(saved.document.type).toBe(type);
    });
  }

  it("does not return a document until the profile save resolves", async () => {
    let resolveSave!: (value: unknown) => void;
    let completed = false;
    const pending = persistGetHiredDocument(result, "resume", () => new Promise((resolve) => {
      resolveSave = resolve;
    })).then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    resolveSave({ success: true, resumeUrl: fileUrl });
    await pending;
    expect(completed).toBe(true);
  });

  it("rejects profile-save errors rather than returning an optimistic document", async () => {
    await expect(persistGetHiredDocument(result, "resume", async () => {
      throw new Error("Save failed");
    })).rejects.toThrow("Save failed");
  });

  for (const saved of [null, {}, { success: false }, { success: true, resumeUrl: "/objects/uploads/other" }]) {
    it(`rejects missing or inconsistent persistence confirmation: ${JSON.stringify(saved)}`, async () => {
      await expect(persistGetHiredDocument(result, "resume", async () => saved)).rejects.toThrow("confirmed");
    });
  }

  for (const badResult of [{}, { successful: [] }, { ...result, failed: ["failed"] }]) {
    it("does not persist when the byte-upload result is missing or failed", async () => {
      const patch = vi.fn();
      await expect(persistGetHiredDocument(badResult, "resume", patch)).rejects.toThrow("did not complete");
      expect(patch).not.toHaveBeenCalled();
    });
  }

  for (const url of [undefined, "", "https://storage.example.test/file?signature=temporary", "/objects/uploads/../private", "fake-upload-url"]) {
    it(`never persists a missing, signed, external or fabricated URL: ${url}`, async () => {
      const patch = vi.fn();
      await expect(persistGetHiredDocument({ successful: [{ name: "resume.pdf", uploadURL: url }] }, "resume", patch)).rejects.toThrow("permanent private");
      expect(patch).not.toHaveBeenCalled();
    });
  }
});

describe("Get Hired file validation and private retrieval", () => {
  it("retains resume 10MiB and video 100MiB limits", () => {
    expect(getHiredFileRules("resume").maxSize).toBe(10 * 1024 * 1024);
    expect(getHiredFileRules("video_intro").maxSize).toBe(100 * 1024 * 1024);
  });
  it("accepts existing document and video types, including browser recordings", () => {
    expect(() => validateGetHiredFile({ name: "CV.PDF", size: 100, type: "application/pdf" }, "resume")).not.toThrow();
    expect(() => validateGetHiredFile({ name: "cv.docx", size: 100, type: "" }, "resume")).not.toThrow();
    expect(() => validateGetHiredFile({ name: "intro.webm", size: 100, type: "video/webm" }, "video_intro")).not.toThrow();
  });
  it("rejects cross-category files, mismatched MIME, empty and oversized files", () => {
    expect(() => validateGetHiredFile({ name: "video.mp4", size: 100, type: "video/mp4" }, "resume")).toThrow();
    expect(() => validateGetHiredFile({ name: "cv.pdf", size: 100, type: "text/html" }, "resume")).toThrow();
    expect(() => validateGetHiredFile({ name: "cv.pdf", size: 0, type: "" }, "resume")).toThrow();
    expect(() => validateGetHiredFile({ name: "cv.pdf", size: 10 * 1024 * 1024 + 1, type: "" }, "resume")).toThrow();
    expect(() => validateGetHiredFile({ name: "intro.mp4", size: 100 * 1024 * 1024 + 1, type: "" }, "video_intro")).toThrow();
  });
  it("uses the existing authenticated ACL route for generic and candidate media paths", () => {
    expect(getHiredRetrievalPath(fileUrl)).toBe(`/api${fileUrl}`);
    expect(getHiredRetrievalPath("/objects/candidate-resumes/id")).toBe("/api/objects/candidate-resumes/id");
    expect(() => getHiredRetrievalPath("https://storage.example.test/private")).toThrow();
    expect(() => getHiredRetrievalPath("/objects/../private")).toThrow();
  });
});

describe("Get Hired assessment and Priority 4 source regressions", () => {
  const page = readFileSync(new URL("../pages/GetHired.tsx", import.meta.url), "utf8");
  const assessment = readFileSync(new URL("../components/GetHiredAssessment.tsx", import.meta.url), "utf8");
  it("removes the obsolete caller and relies on the actual shared direct uploader", () => {
    expect(page).not.toMatch(/\/api\/objects\/upload|onGetUploadParameters/);
    expect(page).toContain("<ObjectUploader");
    expect(page.indexOf("await persistGetHiredDocument")).toBeLessThan(page.indexOf("addDocument(document)"));
    expect(page).toMatch(/responseType: "blob"/);
  });
  it("removes fabricated assessment scores, dates, rankings and dead API calls", () => {
    expect(page + assessment).not.toMatch(/92%|March.*2024|Top 10%|startAssessmentMutation|\/api\/assessments/);
    expect(assessment).toContain("Assessments are currently unavailable");
    expect(assessment).toContain("This does not mark an assessment as completed.");
  });
  it("allows continuing without an assessment and never gates completion on it", () => {
    expect(page).toContain("<GetHiredAssessment onContinue={() => setCurrentStep(5)}");
    expect(assessment).toContain("onClick={onContinue}");
  });
  it("keeps fake LinkedIn import absent and manual profile save progressing to Documents", () => {
    expect(page).not.toMatch(/LinkedInImport|\/api\/linkedin\/|TabsTrigger value="2"/);
    expect(page).toContain('data-testid="button-save-profile"');
    expect(page).toContain("setCurrentStep(3)");
  });
});