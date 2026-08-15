/**
 * profileCompletion.ts — single source of truth for Profile Strength / Completion.
 *
 * Rules:
 *  - One shared data contract (ProfileStrengthInput) maps to one calculation.
 *  - Each caller maps its own data model (Candidate or Profile) to ProfileStrengthInput.
 *  - If a field is `undefined`, that item is not tracked by the caller's system and is
 *    excluded from BOTH numerator and denominator — so each system can still reach 100%.
 *  - Calculation is purely deterministic from persisted server data; never from form state.
 */

export interface CompletionItem {
  label: string;
  done: boolean;
}

/**
 * Normalised input. Use `undefined` (not `false`) for fields your data model
 * doesn't track — those items are skipped entirely rather than counted as missing.
 */
export interface ProfileStrengthInput {
  hasPhoto?: boolean;       // profile picture / photo URL
  hasName?: boolean;        // first+last name or displayName/fullName
  hasTitle?: boolean;       // headline / professional title
  hasSummary?: boolean;     // bio or summary text (any non-empty string)
  hasEmail?: boolean;       // email address
  hasLocation?: boolean;    // location (non-empty, not just the default placeholder)
  hasSkills?: boolean;      // ≥1 core skill listed
  hasExperience?: boolean;  // ≥1 work history entry
  hasEducation?: boolean;   // ≥1 education entry
  hasPreferences?: boolean; // work-setup preference set
  hasResume?: boolean;      // resume document present
  hasLinks?: boolean;       // LinkedIn URL or portfolio URL/items present
}

// ─── Ordered display list ────────────────────────────────────────────────────

const ITEM_DEFS: ReadonlyArray<{ key: keyof ProfileStrengthInput; label: string }> = [
  { key: "hasPhoto",       label: "Photo" },
  { key: "hasName",        label: "Name" },
  { key: "hasTitle",       label: "Headline" },
  { key: "hasSummary",     label: "Summary" },
  { key: "hasEmail",       label: "Email" },
  { key: "hasLocation",    label: "Location" },
  { key: "hasSkills",      label: "Core skills" },
  { key: "hasExperience",  label: "Experience" },
  { key: "hasEducation",   label: "Education" },
  { key: "hasPreferences", label: "Preferences" },
  { key: "hasResume",      label: "Resume" },
  { key: "hasLinks",       label: "LinkedIn / portfolio" },
];

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Build a labelled checklist from a ProfileStrengthInput.
 * Items whose value is `undefined` are excluded from the list.
 */
export function buildCompletionItems(input: ProfileStrengthInput): CompletionItem[] {
  return ITEM_DEFS.filter(({ key }) => input[key] !== undefined).map(({ key, label }) => ({
    label,
    done: !!input[key],
  }));
}

/**
 * Convert a checklist to a 0-100 integer percentage.
 * Returns 0 when the list is empty.
 */
export function calcCompletionPct(items: CompletionItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

// ─── Model mappers ────────────────────────────────────────────────────────────

/**
 * Map a Candidate record (from /api/candidates/:id or /api/candidates/me) to ProfileStrengthInput.
 * All 12 items are tracked — denominator is always 12.
 *
 * Dual-key handling (no caller mapping required):
 *  - Title:       `headline` (edited on Talent Profile) OR `targetPosition` (saved by Find Best Matches)
 *  - Preferences: `preferences.workSetup` (Talent Profile / Settings) OR `preferences.setup`
 *                 (saved by Find Best Matches as { setup, shift, jobType, environment })
 *
 * This makes the function safe to call with the raw DB candidate object from any path
 * without per-caller normalization.
 */
export function profileStrengthFromCandidate(c: {
  profilePhotoUrl?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  /** Dedicated headline column — set via Talent Profile inline edits. */
  headline?: string | null;
  /** Professional title column — set via Find Best Matches and Settings. */
  targetPosition?: string | null;
  summary?: string | null;
  email?: string | null;
  location?: string | null;
  coreSkills?: string[] | null;
  workHistory?: unknown;
  education?: unknown;
  preferences?: unknown;
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
}): ProfileStrengthInput {
  const wh = Array.isArray(c.workHistory) ? c.workHistory : [];
  const edu = Array.isArray(c.education) ? c.education : [];
  const prefs =
    c.preferences != null && typeof c.preferences === "object"
      ? (c.preferences as Record<string, unknown>)
      : null;

  return {
    hasPhoto:       !!c.profilePhotoUrl,
    hasName:        !!(c.displayName?.trim() || c.fullName?.trim()),
    // Either the dedicated `headline` column (Talent Profile path) or
    // `targetPosition` (Find Best Matches / Settings path) counts.
    hasTitle:       !!(c.headline || c.targetPosition),
    hasSummary:     !!c.summary,
    hasEmail:       !!c.email,
    hasLocation:    !!c.location,
    hasSkills:      (c.coreSkills?.length ?? 0) > 0,
    hasExperience:  wh.length > 0,
    hasEducation:   edu.length > 0,
    // Either `workSetup` (Talent Profile / Settings JSONB key) or `setup`
    // (Find Best Matches saves as preferences.setup) counts.
    hasPreferences: !!(prefs?.workSetup || prefs?.setup),
    hasResume:      !!c.resumeUrl,
    hasLinks:       !!(c.linkedinUrl || c.portfolioUrl),
  };
}

/**
 * @deprecated Use `profileStrengthFromCandidate` instead.
 * Kept for backward compatibility with any remaining call sites.
 * All pages (Settings, Talent Profile, TopNavigation) now use the canonical
 * 12-field calculator so the completion % is always consistent everywhere.
 *
 * Map a Candidate record to the 7 fields tracked on the Settings page.
 *
 * Only the items a talent can actually fill in on /settings are tracked here;
 * experience, education, preferences, and links are left `undefined` so they
 * are excluded from the denominator and a talent CAN reach 100% from Settings alone.
 *
 * `hasResume` must be supplied explicitly — the caller resolves it from
 * `candidate.resumeUrl` (candidates table) or from a legacy documents query.
 */
export function profileStrengthFromCandidateSettings(c: {
  profilePhotoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  targetPosition?: string | null;
  summary?: string | null;
  location?: string | null;
  coreSkills?: string[] | null;
  hasResume: boolean;  // caller resolves from documents table OR candidate.resumeUrl
}): ProfileStrengthInput {
  // Prefer explicit first/last name columns; fall back to non-empty fullName.
  const hasName =
    !!(c.firstName?.trim() && c.lastName?.trim()) ||
    !!(c.fullName?.trim());

  return {
    hasPhoto:    !!c.profilePhotoUrl,
    hasName,
    hasTitle:    !!c.targetPosition?.trim(),
    hasSummary:  !!c.summary?.trim(),
    hasLocation: !!c.location?.trim(),
    hasSkills:   (c.coreSkills?.length ?? 0) > 0,
    hasResume:   c.hasResume,
    // experience, education, preferences, links, email — not tracked in Settings;
    // leaving them `undefined` excludes them from the denominator.
  };
}

/**
 * @deprecated Use `profileStrengthFromCandidate` for all completion calculations.
 * Kept for legacy code paths that operate on the `profiles` table (separate from
 * the `candidates` table used by the Talent Portal). New code should target the
 * candidates table and use `profileStrengthFromCandidate` for a unified % everywhere.
 *
 * Map a Profile record (from /api/profiles/me) + related API data to ProfileStrengthInput.
 * Email, experience, education, and preferences are not tracked in the profiles table,
 * so those keys are left undefined (excluded from the denominator).
 * Denominator is 8 — reaching 100% is achievable.
 */
export function profileStrengthFromProfile(p: {
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  bio?: string | null;
  location?: string | null;
  profilePicture?: string | null;
  // Resolved from separate API queries
  hasSkills: boolean;   // user_skills table — ≥1 skill
  hasResume: boolean;   // documents table — resume doc present
  hasLinks: boolean;    // portfolio items table — ≥1 item, OR linkedinUrl on profile
}): ProfileStrengthInput {
  return {
    hasPhoto:    !!p.profilePicture,
    hasName:     !!(p.firstName?.trim() && p.lastName?.trim()),
    hasTitle:    !!p.title,
    hasSummary:  !!p.bio,
    hasLocation: !!(p.location && p.location !== "Global"),
    hasSkills:   p.hasSkills,
    hasResume:   p.hasResume,
    hasLinks:    p.hasLinks,
    // email, experience, education, preferences — not in profiles table; excluded
  };
}
