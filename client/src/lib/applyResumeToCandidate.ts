/**
 * applyResumeToCandidate.ts
 *
 * Shared pipeline: parse a resume file → merge extracted data with existing
 * Candidate → PATCH the Candidate → invalidate caches.
 *
 * All resume upload entry points (TalentProfile, ProfileSettings, FindBestMatches,
 * Signup) call this after saving the resume file so that profile auto-fill is
 * consistent across the whole product.
 */

import type { QueryClient } from "@tanstack/react-query";
import {
  parseResumeFile,
  type ExtractedCandidateProfile,
  type WorkHistoryEntry,
  type EducationEntry,
  type CertificationEntry,
} from "./resumeParser";
import { invalidateCandidateQueries } from "./candidateCache";

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

/**
 * Merge work history entries — deduplicate by normalized jobTitle + company.
 * Existing entries are preserved; only truly new jobs from the resume are added.
 */
function mergeWorkHistory(
  existing: WorkHistoryEntry[],
  incoming: WorkHistoryEntry[],
): WorkHistoryEntry[] {
  const keys = new Set(
    existing.map((e) => `${normalizeStr(e.jobTitle)}|${normalizeStr(e.company)}`),
  );
  const result = [...existing];
  for (const entry of incoming) {
    const key = `${normalizeStr(entry.jobTitle)}|${normalizeStr(entry.company)}`;
    if (!keys.has(key)) {
      keys.add(key);
      result.push(entry);
    }
  }
  return result;
}

/**
 * Merge education entries — deduplicate by normalized school + degree.
 */
function mergeEducation(
  existing: EducationEntry[],
  incoming: EducationEntry[],
): EducationEntry[] {
  const keys = new Set(
    existing.map((e) => `${normalizeStr(e.school)}|${normalizeStr(e.degree)}`),
  );
  const result = [...existing];
  for (const entry of incoming) {
    const key = `${normalizeStr(entry.school)}|${normalizeStr(entry.degree)}`;
    if (!keys.has(key)) {
      keys.add(key);
      result.push(entry);
    }
  }
  return result;
}

/**
 * Merge certifications — deduplicate by normalized name.
 */
function mergeCertifications(
  existing: CertificationEntry[],
  incoming: CertificationEntry[],
): CertificationEntry[] {
  const keys = new Set(existing.map((e) => normalizeStr(e.name)));
  const result = [...existing];
  for (const entry of incoming) {
    const key = normalizeStr(entry.name);
    if (key && !keys.has(key)) {
      keys.add(key);
      result.push(entry);
    }
  }
  return result;
}

// ─── Candidate field shape (minimal — only what we read/write) ────────────────

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
 *   This allows a re-uploaded resume to refresh contact/title data.
 * - summary (rich user-edited field): only update when existing is empty.
 * - Skill arrays: union, deduped case-insensitively.
 * - Structured arrays (workHistory, education, certifications): add new entries,
 *   never remove existing ones. Duplicates are skipped.
 * - languages: stored inside preferences.languages — merged case-insensitively.
 *   All other preference keys are preserved unchanged.
 * - NEVER set a field to an empty/null value if the extracted value is blank.
 */
export function mergeResumeWithCandidate(
  existing: CandidateSnapshot,
  extracted: ExtractedCandidateProfile,
): Partial<CandidateSnapshot & { preferences: Record<string, unknown> }> {
  const patch: Record<string, unknown> = {};

  // ── Scalar fields ──────────────────────────────────────────────────────────
  if (extracted.phone?.trim())
    patch.phone = extracted.phone.trim();

  if (extracted.location?.trim())
    patch.location = extracted.location.trim();

  if (extracted.targetPosition?.trim())
    patch.targetPosition = extracted.targetPosition.trim();

  // summary: preserve existing manual edits — only fill when empty
  if (extracted.summary?.trim() && !existing.summary?.trim())
    patch.summary = extracted.summary.trim();

  // ── Skill arrays ───────────────────────────────────────────────────────────
  const mergedCore = mergeStringArrays(
    existing.coreSkills ?? [],
    extracted.coreSkills,
  );
  if (mergedCore.length > 0) patch.coreSkills = mergedCore;

  const mergedSecondary = mergeStringArrays(
    existing.secondarySkills ?? [],
    extracted.secondarySkills,
  );
  if (mergedSecondary.length > 0) patch.secondarySkills = mergedSecondary;

  // ── Structured arrays ──────────────────────────────────────────────────────
  if (extracted.workHistory.length > 0) {
    patch.workHistory = mergeWorkHistory(
      (existing.workHistory as WorkHistoryEntry[] | undefined) ?? [],
      extracted.workHistory,
    );
  }

  if (extracted.education.length > 0) {
    patch.education = mergeEducation(
      (existing.education as EducationEntry[] | undefined) ?? [],
      extracted.education,
    );
  }

  if (extracted.certifications.length > 0) {
    patch.certifications = mergeCertifications(
      (existing.certifications as CertificationEntry[] | undefined) ?? [],
      extracted.certifications,
    );
  }

  // ── Languages (inside preferences) ─────────────────────────────────────────
  if (extracted.languages.length > 0) {
    const existingPrefs = (existing.preferences as Record<string, unknown>) ?? {};
    const existingLangs = Array.isArray(existingPrefs.languages)
      ? (existingPrefs.languages as string[])
      : [];
    const mergedLangs = mergeStringArrays(existingLangs, extracted.languages);
    patch.preferences = {
      ...existingPrefs,
      languages: mergedLangs,
    };
  }

  return patch as Partial<CandidateSnapshot & { preferences: Record<string, unknown> }>;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export interface ApplyResumeResult {
  extracted: ExtractedCandidateProfile;
  /** Server response from the PATCH call, or null if the PATCH failed. */
  updated: Record<string, unknown> | null;
  /** Field names that were populated/changed by the import. */
  appliedFields: string[];
  /** True when parsing produced a parseError (resume saved but profile not updated). */
  parseError?: string;
}

/**
 * Full pipeline called after a resume file has been saved to object storage.
 *
 * 1. Parse the file client-side.
 * 2. Fetch the current Candidate (with auth so we get the owner-privileged view).
 * 3. Merge extracted data with existing data (non-destructive).
 * 4. PATCH the Candidate.
 * 5. Invalidate all candidate query keys so the UI refreshes everywhere.
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
  // Step 1 — Parse
  let extracted: ExtractedCandidateProfile;
  try {
    extracted = await parseResumeFile(file);
  } catch {
    return {
      extracted: { ...EMPTY_EXTRACTION },
      updated: null,
      appliedFields: [],
      parseError: "An unexpected error occurred while reading your resume.",
    };
  }

  if (extracted.parseError) {
    return {
      extracted,
      updated: null,
      appliedFields: [],
      parseError: extracted.parseError,
    };
  }

  // Step 2 — Fetch current candidate (with auth to get privileged view)
  let existing: CandidateSnapshot = {};
  try {
    const res = await fetch(`/api/candidates/${candidateId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) existing = await res.json();
  } catch {
    // Continue with empty existing — we'll still apply extracted values
  }

  // Step 3 — Merge
  const patch = mergeResumeWithCandidate(existing, extracted);

  // Nothing to patch?
  if (Object.keys(patch).length === 0) {
    return { extracted, updated: null, appliedFields: [] };
  }

  // Step 4 — PATCH
  let updated: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method: "PATCH",
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

  return { extracted, updated, appliedFields };
}

// Re-export EMPTY_EXTRACTION for callers that need a blank result
const EMPTY_EXTRACTION: ExtractedCandidateProfile = {
  fullName: "", email: "", phone: "", location: "",
  targetPosition: "", jobCategory: "",
  yearsOfExperience: "", seniority: "",
  coreSkills: [], secondarySkills: [],
  summary: "",
  languages: [],
  workHistory: [],
  education: [],
  certifications: [],
  confidence: "low", extractedFields: [],
};
