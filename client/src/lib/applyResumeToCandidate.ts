/**
 * applyResumeToCandidate.ts
 *
 * Shared pipeline: analyze a resume file → merge extracted data with existing
 * Candidate → PATCH the Candidate → invalidate caches.
 *
 * Architecture (Vanessa hybrid):
 *   1. Extract raw text client-side (pdfjs / mammoth).
 *   2. POST text to /api/resume/analyze → Vanessa Resume Intelligence (server-side OpenAI).
 *   3. Map structured Vanessa response → ExtractedCandidateProfile.
 *   4. On ANY failure (network, Vanessa unavailable, parse error): fall back to
 *      the deterministic parseResumeFile() — upload is never lost.
 *   5. Merge extracted data with existing Candidate (non-destructive).
 *   6. PATCH the Candidate.
 *   7. Invalidate all candidate query caches.
 *
 * All resume upload entry points (TalentProfile, ProfileSettings, FindBestMatches,
 * Signup) call this after saving the resume file so that profile auto-fill is
 * consistent across the whole product.
 */

import type { QueryClient } from "@tanstack/react-query";
import {
  parseResumeFile,
  extractTextFromFile,
  EMPTY_EXTRACTION,
  type ExtractedCandidateProfile,
  type WorkHistoryEntry,
  type EducationEntry,
  type CertificationEntry,
} from "./resumeParser";
import { invalidateCandidateQueries } from "./candidateCache";

// ─── Server response shape ─────────────────────────────────────────────────────

interface VanessaServerResponse {
  success: boolean;
  source: "vanessa" | "error";
  parserVersion?: string;
  error?: string;
  profile?: {
    personalInfo: { fullName: string; email: string; phone: string; location: string; languages: string[] };
    professional:  { title: string; summary: string; yearsOfExperience: string; seniority: string };
    skills:        { core: string[]; secondary: string[] };
    experience: Array<{
      jobTitle: string; company: string; duration?: string;
      startDate?: string; endDate?: string; responsibilities: string[];
    }>;
    education: Array<{
      school: string; degree: string; fieldOfStudy?: string;
      startYear?: string; endYear?: string;
    }>;
    certifications: Array<{ name: string; issuer?: string; date?: string }>;
    confidence: {
      overall: number; professionalTitle: number; summary: number;
      experience: number; education: number; skills: number; location: number;
    };
  };
}

// ─── Map Vanessa response → ExtractedCandidateProfile ─────────────────────────

function vanessaToExtracted(v: NonNullable<VanessaServerResponse["profile"]>): ExtractedCandidateProfile {
  const conf = v.confidence;
  const overall = conf.overall ?? 0;
  const confidenceLevel: "high" | "partial" | "low" =
    overall >= 0.80 ? "high" : overall >= 0.60 ? "partial" : "low";

  const extractedFields: string[] = [];
  if (v.personalInfo.fullName)   extractedFields.push("fullName");
  if (v.personalInfo.email)      extractedFields.push("email");
  if (v.personalInfo.phone)      extractedFields.push("phone");
  if (v.personalInfo.location)   extractedFields.push("location");
  if (v.professional.title)      extractedFields.push("targetPosition");
  if (v.professional.summary)    extractedFields.push("summary");
  if (v.professional.yearsOfExperience) extractedFields.push("yearsOfExperience");
  if (v.professional.seniority)  extractedFields.push("seniority");
  if (v.skills.core.length)      extractedFields.push("coreSkills");
  if (v.skills.secondary.length) extractedFields.push("secondarySkills");
  if (v.personalInfo.languages.length) extractedFields.push("languages");
  if (v.experience.length)       extractedFields.push("workHistory");
  if (v.education.length)        extractedFields.push("education");
  if (v.certifications.length)   extractedFields.push("certifications");

  const workHistory: WorkHistoryEntry[] = v.experience.map(e => ({
    jobTitle: e.jobTitle,
    company:  e.company,
    duration: e.duration || [e.startDate, e.endDate].filter(Boolean).join(" – ") || "",
    responsibilities: e.responsibilities.join("\n"),
  }));

  const education: EducationEntry[] = v.education.map(e => ({
    school:    e.school,
    degree:    e.degree,
    yearStart: e.startYear ?? "",
    yearEnd:   e.endYear   ?? "",
  }));

  const certifications: CertificationEntry[] = v.certifications.map(c => ({
    name:   c.name,
    issuer: c.issuer ?? "",
    date:   c.date   ?? "",
    link:   "",
  }));

  return {
    fullName:          v.personalInfo.fullName,
    email:             v.personalInfo.email,
    phone:             v.personalInfo.phone,
    location:          v.personalInfo.location,
    targetPosition:    v.professional.title,
    jobCategory:       "",
    summary:           v.professional.summary,
    yearsOfExperience: v.professional.yearsOfExperience,
    seniority:         v.professional.seniority,
    coreSkills:        v.skills.core,
    secondarySkills:   v.skills.secondary,
    languages:         v.personalInfo.languages,
    workHistory,
    education,
    certifications,
    confidence:        confidenceLevel,
    extractedFields,
  };
}

// ─── Try Vanessa server endpoint ───────────────────────────────────────────────

/** Per-field confidence scores as returned by the Vanessa server. */
export type VanessaConfidence = NonNullable<VanessaServerResponse["profile"]>["confidence"];

/**
 * POST resume text to /api/resume/analyze.
 * Returns Vanessa's parsed result mapped to ExtractedCandidateProfile,
 * or null if the call fails or Vanessa is unavailable.
 */
async function tryVanessaAnalysis(
  file: File,
  token: string | null | undefined,
): Promise<{ extracted: ExtractedCandidateProfile; confidence: VanessaConfidence } | null> {
  try {
    const resumeText = await extractTextFromFile(file);
    if (!resumeText.trim()) return null;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/resume/analyze", {
      method:  "POST",
      headers,
      body:    JSON.stringify({ resumeText }),
    });

    if (!res.ok) return null;

    const data: VanessaServerResponse = await res.json();
    if (!data.success || !data.profile) return null;

    return { extracted: vanessaToExtracted(data.profile), confidence: data.profile.confidence };
  } catch {
    return null;
  }
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

/** Case-insensitive dedup union of two string arrays. Existing order is preserved. */
function mergeStringArrays(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase().trim()));
  const result = [...existing];
  for (const item of incoming) {
    const key = item.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mergeWorkHistory(existing: WorkHistoryEntry[], incoming: WorkHistoryEntry[]): WorkHistoryEntry[] {
  const keys = new Set(existing.map((e) => `${normalizeStr(e.jobTitle)}|${normalizeStr(e.company)}`));
  const result = [...existing];
  for (const entry of incoming) {
    const key = `${normalizeStr(entry.jobTitle)}|${normalizeStr(entry.company)}`;
    if (!keys.has(key)) { keys.add(key); result.push(entry); }
  }
  return result;
}

function mergeEducation(existing: EducationEntry[], incoming: EducationEntry[]): EducationEntry[] {
  const keys = new Set(existing.map((e) => `${normalizeStr(e.school)}|${normalizeStr(e.degree)}`));
  const result = [...existing];
  for (const entry of incoming) {
    const key = `${normalizeStr(entry.school)}|${normalizeStr(entry.degree)}`;
    if (!keys.has(key)) { keys.add(key); result.push(entry); }
  }
  return result;
}

function mergeCertifications(existing: CertificationEntry[], incoming: CertificationEntry[]): CertificationEntry[] {
  const keys = new Set(existing.map((e) => normalizeStr(e.name)));
  const result = [...existing];
  for (const entry of incoming) {
    const key = normalizeStr(entry.name);
    if (key && !keys.has(key)) { keys.add(key); result.push(entry); }
  }
  return result;
}

// ─── Candidate field shape (minimal) ─────────────────────────────────────────

interface CandidateSnapshot {
  phone?: string | null;
  location?: string | null;
  targetPosition?: string | null;
  summary?: string | null;
  coreSkills?: string[];
  secondarySkills?: string[];
  workHistory?: WorkHistoryEntry[];
  education?: EducationEntry[];
  certifications?: CertificationEntry[];
  preferences?: Record<string, unknown>;
}

/**
 * Build the PATCH payload from a safe merge of existing candidate data and
 * newly extracted resume fields.
 *
 * Rules:
 * - Scalar strings (phone, location, targetPosition): use extracted if non-empty.
 * - summary: only update when existing is empty (preserve manual edits).
 * - Skill arrays: case-insensitive union, deduped.
 * - Structured arrays: additive (new entries only, never remove existing).
 * - languages: merged inside preferences.languages; other preference keys preserved.
 * - Never set a field to an empty/null value.
 */
export function mergeResumeWithCandidate(
  existing: CandidateSnapshot,
  extracted: ExtractedCandidateProfile,
): Partial<CandidateSnapshot & { preferences: Record<string, unknown> }> {
  const patch: Record<string, unknown> = {};

  // Scalar strings: only fill when the existing field is empty — never overwrite
  // manually maintained data (matches FindBestMatches non-destructive prefill).
  if (extracted.phone?.trim()          && !existing.phone?.trim())          patch.phone          = extracted.phone.trim();
  if (extracted.location?.trim()       && !existing.location?.trim())       patch.location       = extracted.location.trim();
  if (extracted.targetPosition?.trim() && !existing.targetPosition?.trim()) patch.targetPosition = extracted.targetPosition.trim();

  // summary: preserve existing manual edits
  if (extracted.summary?.trim() && !existing.summary?.trim())
    patch.summary = extracted.summary.trim();

  const mergedCore = mergeStringArrays(existing.coreSkills ?? [], extracted.coreSkills);
  if (mergedCore.length > 0) patch.coreSkills = mergedCore;

  const mergedSecondary = mergeStringArrays(existing.secondarySkills ?? [], extracted.secondarySkills);
  if (mergedSecondary.length > 0) patch.secondarySkills = mergedSecondary;

  if (extracted.workHistory.length > 0)
    patch.workHistory = mergeWorkHistory(existing.workHistory ?? [], extracted.workHistory);

  if (extracted.education.length > 0)
    patch.education = mergeEducation(existing.education ?? [], extracted.education);

  if (extracted.certifications.length > 0)
    patch.certifications = mergeCertifications(existing.certifications ?? [], extracted.certifications);

  if (extracted.languages.length > 0) {
    const existingPrefs  = (existing.preferences as Record<string, unknown>) ?? {};
    const existingLangs  = Array.isArray(existingPrefs.languages) ? (existingPrefs.languages as string[]) : [];
    patch.preferences = { ...existingPrefs, languages: mergeStringArrays(existingLangs, extracted.languages) };
  }

  return patch as Partial<CandidateSnapshot & { preferences: Record<string, unknown> }>;
}

// ─── Public result type ────────────────────────────────────────────────────────

/** One profile field Vanessa populated, with before/after values and confidence. */
export interface ResumeReviewField {
  field: string;
  /** Value now on the profile after merging (what was written). */
  importedValue: unknown;
  /** Value that was on the profile before the import. */
  previousValue: unknown;
  /** Vanessa's confidence score 0–1, or null when the deterministic fallback ran. */
  confidence: number | null;
}

export interface ApplyResumeResult {
  extracted: ExtractedCandidateProfile;
  updated: Record<string, unknown> | null;
  appliedFields: string[];
  /** Per-field review details for the "review what Vanessa filled" panel. */
  reviewFields: ResumeReviewField[];
  parseError?: string;
  /** "vanessa" when AI was used, "deterministic" on fallback. */
  analysisSource: "vanessa" | "deterministic";
}

/** Which Vanessa confidence key applies to each candidate field. */
const CONFIDENCE_KEY_BY_FIELD: Record<string, keyof VanessaConfidence> = {
  targetPosition:  "professionalTitle",
  summary:         "summary",
  workHistory:     "experience",
  education:       "education",
  coreSkills:      "skills",
  secondarySkills: "skills",
  location:        "location",
};

function buildReviewFields(
  appliedFields: string[],
  patch: Record<string, unknown>,
  existing: CandidateSnapshot,
  confidence: VanessaConfidence | null,
): ResumeReviewField[] {
  return appliedFields.map((field) => {
    let importedValue: unknown;
    let previousValue: unknown;
    if (field === "languages") {
      importedValue = (patch.preferences as Record<string, unknown> | undefined)?.languages ?? [];
      const prevPrefs = (existing.preferences as Record<string, unknown>) ?? {};
      previousValue = Array.isArray(prevPrefs.languages) ? prevPrefs.languages : [];
    } else {
      importedValue = patch[field];
      previousValue = (existing as Record<string, unknown>)[field] ?? null;
    }
    let conf: number | null = null;
    if (confidence) {
      const key = CONFIDENCE_KEY_BY_FIELD[field];
      conf = (key ? confidence[key] : undefined) ?? confidence.overall ?? null;
    }
    return { field, importedValue, previousValue, confidence: conf };
  });
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Full pipeline called after a resume file has been saved to object storage.
 *
 * 1. Try Vanessa Resume Intelligence (server-side OpenAI).
 * 2. On any Vanessa failure, fall back to deterministic parseResumeFile().
 * 3. Fetch the current Candidate (auth-privileged view).
 * 4. Merge extracted data with existing data (non-destructive).
 * 5. PATCH the Candidate.
 * 6. Invalidate all candidate query keys so the UI refreshes everywhere.
 *
 * The caller is responsible for saving the resume file first
 * (POST /api/candidates/:id/resume) before invoking this.
 */
export async function applyResumeToCandidate({
  file,
  candidateId,
  token,
  queryClient,
}: {
  file: File;
  candidateId: string;
  token: string | null | undefined;
  queryClient: QueryClient;
}): Promise<ApplyResumeResult> {

  // Step 1 — Try Vanessa, fall back to deterministic
  let extracted: ExtractedCandidateProfile;
  let analysisSource: "vanessa" | "deterministic" = "vanessa";
  let vanessaConfidence: VanessaConfidence | null = null;

  const vanessaResult = await tryVanessaAnalysis(file, token);

  if (vanessaResult) {
    extracted = vanessaResult.extracted;
    vanessaConfidence = vanessaResult.confidence;
  } else {
    // Vanessa unavailable or failed — fall back gracefully
    analysisSource = "deterministic";
    try {
      extracted = await parseResumeFile(file);
    } catch {
      return {
        extracted:      { ...EMPTY_EXTRACTION },
        updated:        null,
        appliedFields:  [],
        reviewFields:   [],
        parseError:     "An unexpected error occurred while reading your resume.",
        analysisSource: "deterministic",
      };
    }
  }

  if (extracted.parseError) {
    return { extracted, updated: null, appliedFields: [], reviewFields: [], parseError: extracted.parseError, analysisSource };
  }

  // Step 2 — Fetch current candidate (with auth to get privileged view)
  let existing: CandidateSnapshot = {};
  try {
    const res = await fetch(`/api/candidates/${candidateId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) existing = await res.json();
  } catch {
    // Continue with empty existing
  }

  // Step 3 — Merge
  const patch = mergeResumeWithCandidate(existing, extracted);

  if (Object.keys(patch).length === 0) {
    return { extracted, updated: null, appliedFields: [], reviewFields: [], analysisSource };
  }

  // Step 4 — PATCH
  let updated: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method:  "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...patch, updatedAt: new Date().toISOString() }),
    });
    if (res.ok) updated = await res.json();
  } catch {
    // PATCH failed — not fatal, candidate still has the resume file
  }

  // Step 5 — Invalidate caches
  try {
    await invalidateCandidateQueries(queryClient, candidateId);
  } catch {
    // Non-fatal
  }

  const appliedFields = extracted.extractedFields.filter(
    (f) => f in patch || (f === "languages" && "preferences" in patch),
  );

  const reviewFields = buildReviewFields(
    appliedFields,
    patch as Record<string, unknown>,
    existing,
    vanessaConfidence,
  );

  return { extracted, updated, appliedFields, reviewFields, analysisSource };
}
