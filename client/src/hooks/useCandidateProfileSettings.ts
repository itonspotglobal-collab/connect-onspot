/**
 * useCandidateProfileSettings
 *
 * Dedicated hook for the /settings page when the user is authenticated via the
 * Talent Portal (talent_profile_token / candidate JWT).
 *
 * Data canonical source: `candidates` table (NOT `profiles` / NOT `users`).
 * Auth: talent Bearer token from loadTalentAuth() — NOT onspot_jwt_token.
 *
 * Fields stored directly on the candidate row:
 *   fullName, phone, location, targetPosition, summary, availability,
 *   coreSkills, profilePhotoUrl
 *
 * Fields stored inside the `preferences` JSONB column (no migration needed):
 *   timezone, languages, hourlyRate, rateCurrency
 *   (merged with existing preferences so workSetup/shift/etc. are preserved)
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryClient } from "@/lib/queryClient";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import {
  buildCompletionItems,
  calcCompletionPct,
  profileStrengthFromCandidate,
  type CompletionItem,
} from "@/lib/profileCompletion";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const candidateSettingsSchema = z.object({
  firstName:    z.string().min(1, "First name is required"),
  lastName:     z.string().default(""),
  phoneNumber:  z.string().optional().default(""),
  location:     z.string().optional().default(""),
  timezone:     z.string().default("UTC"),
  languages:    z.array(z.string()).default([]),
  // Professional Details
  title:        z.string().optional().default(""),
  bio:          z.string().optional().default(""),
  hourlyRate:   z.string().optional().default(""),
  rateCurrency: z.string().default("USD"),
  availability: z.string().default("available"),
  // Skills — stored in candidates.coreSkills (string[])
  coreSkills:   z.array(z.string()).default([]),
});

export type CandidateSettingsFormData = z.infer<typeof candidateSettingsSchema>;

// ─── Photo URL helper ─────────────────────────────────────────────────────────

/**
 * Convert a stored candidate photo path to a publicly accessible URL.
 * Stored as: /objects/candidate-photos/<uuid>.jpg
 * Served via: /api/candidate-photos/<uuid>.jpg
 */
export function candidatePhotoSrc(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/objects/candidate-photos/")) {
    return url.replace("/objects/candidate-photos/", "/api/candidate-photos/");
  }
  return url;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Legacy fallback — only used when the candidate row has no separate
 * first_name / last_name stored.  Treats ALL words except the last as the
 * given name so "Frenzy Val Eloise Legaspi" → "Frenzy Val Eloise" / "Legaspi".
 */
function legacyNameFallback(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0)  return { firstName: "",        lastName: "" };
  if (parts.length === 1)  return { firstName: parts[0],  lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName:  parts.at(-1) ?? "",
  };
}

/** Map a raw candidate API response to Settings form values. */
function candidateToFormValues(candidate: any): CandidateSettingsFormData {
  // Prefer the explicit first_name / last_name columns (populated after first Settings save).
  // Fall back to splitting fullName only when both are absent.
  let firstName: string;
  let lastName: string;

  const hasSeparate =
    (candidate.firstName != null && candidate.firstName !== "") ||
    (candidate.lastName  != null && candidate.lastName  !== "");

  if (hasSeparate) {
    firstName = candidate.firstName ?? "";
    lastName  = candidate.lastName  ?? "";
  } else {
    ({ firstName, lastName } = legacyNameFallback(candidate.fullName || ""));
  }

  const prefs = (candidate.preferences && typeof candidate.preferences === "object")
    ? candidate.preferences as Record<string, any>
    : {};

  return {
    firstName,
    lastName,
    phoneNumber:  candidate.phone          || "",
    location:     candidate.location       || "",
    timezone:     prefs.timezone           || detectTimezone(),
    languages:    Array.isArray(prefs.languages) ? prefs.languages : [],
    title:        candidate.targetPosition || "",
    bio:          candidate.summary        || "",
    hourlyRate:   prefs.hourlyRate   ? String(prefs.hourlyRate) : "",
    rateCurrency: prefs.rateCurrency || "USD",
    availability: candidate.availability   || "available",
    coreSkills:   Array.isArray(candidate.coreSkills) ? candidate.coreSkills : [],
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCandidateProfileSettings() {
  // Read talent auth every render (cheap localStorage read).
  // If the user is not logged in via the talent portal, talentAuth is null.
  const talentAuth = loadTalentAuth();
  const candidateId = talentAuth?.candidateId ?? null;

  // ── Fetch candidate ──────────────────────────────────────────────────────────
  // GET /api/candidates/:id is public — no auth required.
  const {
    data: candidate,
    isLoading: candidateLoading,
    error: candidateError,
  } = useQuery({
    queryKey: ["candidate-profile", candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const res = await fetch(`/api/candidates/${candidateId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `Failed to load candidate (${res.status})`);
      }
      return res.json();
    },
    enabled: !!candidateId,
    staleTime: 30_000,
  });

  // ── Available skills (from global skills table) ────────────────────────────
  const { data: availableSkills = [] } = useQuery({
    queryKey: ["/api/skills"],
    queryFn: async () => {
      const res = await fetch("/api/skills");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ── Documents (resume + video_intro stored in documents table) ────────────
  // Fetched with the talent Bearer token so `/api/documents` (authenticateJWT)
  // accepts it via the same fallback the Axios interceptor uses.
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["candidate-documents", candidateId],
    queryFn: async () => {
      const auth = loadTalentAuth();
      if (!auth?.token) return [];
      const res = await fetch("/api/documents", {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!candidateId,
    staleTime: 30_000,
  });

  // Expose a refetch trigger so the Settings page can call it after upload/remove.
  const invalidateDocuments = () =>
    queryClient.invalidateQueries({ queryKey: ["candidate-documents", candidateId] });

  // ── Profile completion (shared module — single source of truth) ────────────
  // hasResume: true when a document of type "resume" is in the documents table
  // OR when the candidate row itself has a resumeUrl (legacy / direct upload path).
  const hasResume =
    documents.some((d: any) => d.type === "resume") || !!candidate?.resumeUrl;

  const completionItems: CompletionItem[] = useMemo(() => {
    if (!candidate) return [];
    // Use the canonical 12-field calculator so Settings, Talent Profile, and TopNavigation
    // all show the same percentage. profileStrengthFromCandidate handles both dual-key
    // variants internally (headline || targetPosition, workSetup || setup) — no manual
    // normalization needed here. Resume uses candidate.resumeUrl only (same source as
    // TalentProfile and nav) for a consistent % across all surfaces.
    return buildCompletionItems(profileStrengthFromCandidate(candidate as any));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, hasResume]);

  const profileCompletion = useMemo(
    () => calcCompletionPct(completionItems),
    [completionItems]
  );

  // ── Default form values ───────────────────────────────────────────────────
  const getDefaultFormValues = useCallback((): CandidateSettingsFormData => {
    if (candidate) return candidateToFormValues(candidate);
    // Fallback while loading — pre-populate from the token's fullName (legacy split)
    const { firstName, lastName } = legacyNameFallback(talentAuth?.fullName || "");
    return {
      firstName, lastName,
      phoneNumber: "", location: "", timezone: detectTimezone(),
      languages: [], title: "", bio: "",
      hourlyRate: "", rateCurrency: "USD", availability: "available",
      coreSkills: [],
    };
  }, [candidate, talentAuth]);

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: CandidateSettingsFormData) => {
      const auth = loadTalentAuth();
      if (!auth?.token || !auth.candidateId) {
        throw new Error("Talent session not found. Please log in again.");
      }

      // Merge new prefs with existing ones so workSetup/shift/etc. survive.
      const existingPrefs: Record<string, any> =
        (candidate?.preferences && typeof candidate.preferences === "object")
          ? (candidate.preferences as Record<string, any>)
          : {};

      // firstName / lastName / targetPosition are NOT NULL in the DB —
      // send empty strings, not null, or PostgreSQL will throw a constraint violation.
      // The server derives fullName = firstName + " " + lastName automatically.
      const patchBody = {
        firstName:      data.firstName.trim(),
        lastName:       data.lastName.trim(),
        phone:          data.phoneNumber  || null,   // nullable column — null OK
        location:       data.location     || null,   // nullable column — null OK
        targetPosition: data.title        ?? "",     // NOT NULL — empty string, not null
        summary:        data.bio          || null,   // nullable column — null OK
        availability:   data.availability || "available",
        coreSkills:     data.coreSkills,
        preferences: {
          ...existingPrefs,
          timezone:     data.timezone,
          languages:    data.languages,
          hourlyRate:   data.hourlyRate   || null,
          rateCurrency: data.rateCurrency || "USD",
        },
      };

      if (import.meta.env.DEV) {
        console.log("Candidate settings PATCH payload", patchBody);
      }

      const res = await fetch(`/api/candidates/${auth.candidateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${auth.token}`,
        },
        body: JSON.stringify(patchBody),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => null);
        console.error("Candidate settings API error:", result);
        throw new Error(
          result?.message || result?.error || `Failed to update candidate (${res.status})`
        );
      }
      return res.json(); // sanitised candidate row
    },
    onSuccess: () => {
      // Refresh candidate so re-opening settings shows the latest values.
      queryClient.invalidateQueries({ queryKey: ["candidate-profile", candidateId] });
      // Invalidate TopNavigation candidate queries so the completion % updates immediately.
      // Use prefix-only invalidation for the JWT path (no user.id available in this hook).
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/me"] });
      if (candidateId) {
        queryClient.invalidateQueries({ queryKey: ["/api/candidates", candidateId] });
      }
    },
    onError: (err: any) => {
      console.error("Candidate settings save failed:", err?.message);
    },
  });

  // ── Photo upload ──────────────────────────────────────────────────────────
  /**
   * Upload a photo via POST /api/candidates/:id/photo (authenticateTalentJWT).
   * Returns the stored path e.g. "/objects/candidate-photos/<uuid>.jpg".
   * Convert to displayable URL with candidatePhotoSrc().
   */
  const uploadPhoto = async (file: File): Promise<string> => {
    const auth = loadTalentAuth();
    if (!auth?.token || !auth.candidateId) {
      throw new Error("Talent session not found. Please log in again.");
    }

    const formData = new FormData();
    formData.append("photo", file);
    // Do NOT set Content-Type — the browser sets multipart/form-data with boundary.

    const res = await fetch(`/api/candidates/${auth.candidateId}/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || `Photo upload failed (${res.status})`);
    }

    const data = await res.json() as { success: boolean; profilePhotoUrl: string };
    if (!data.success) throw new Error("Photo upload failed");

    // Refresh candidate query so avatar renders the persisted URL after refetch.
    queryClient.invalidateQueries({ queryKey: ["candidate-profile", candidateId] });
    return data.profilePhotoUrl; // "/objects/candidate-photos/..."
  };

  // ── Photo removal ─────────────────────────────────────────────────────────
  const removePhoto = async (): Promise<void> => {
    const auth = loadTalentAuth();
    if (!auth?.token || !auth.candidateId) {
      throw new Error("Talent session not found. Please log in again.");
    }

    const res = await fetch(`/api/candidates/${auth.candidateId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ profilePhotoUrl: null }),
    });
    if (!res.ok) throw new Error("Failed to remove photo");
    queryClient.invalidateQueries({ queryKey: ["candidate-profile", candidateId] });
  };

  return {
    /** Talent auth object — null if not logged in via talent portal. */
    talentAuth,
    candidateId,
    /** Raw candidate row from the API. */
    candidate,
    isLoading: candidateLoading && !!candidateId,
    isSaving:  saveMutation.isPending,
    error:     candidateError,
    /** 0–100 percentage calculated from persisted server data via profileCompletion.ts. */
    profileCompletion,
    /** Labelled checklist used to show which items are complete/missing. */
    completionItems,
    /** Documents from the `documents` table (resume + video_intro). */
    documents,
    /** Call after a document is uploaded or removed to trigger completion recalculation. */
    invalidateDocuments,
    getDefaultFormValues,
    /** PATCH /api/candidates/:id with talent Bearer token. */
    saveSettings: (data: CandidateSettingsFormData) => saveMutation.mutateAsync(data),
    uploadPhoto,
    removePhoto,
    /** Global skills catalogue (for the skill toggle picker). */
    availableSkills: availableSkills as Array<{ id: string; name: string }>,
  };
}
