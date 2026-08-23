/**
 * clientSearchSanitize.ts
 *
 * Server-side PII sanitizer for client-facing talent search results.
 *
 * This is the SINGLE authoritative implementation used by both the route
 * handlers and the regression test suite. Defining it here (not inline)
 * means the test always imports the real function — if the route is ever
 * changed to bypass this, the HTTP-level integration test will still catch it,
 * but the unit tests will also document exactly what the function must do.
 *
 * Rule: contact fields are permanently withheld at every stage. Name is masked
 * server-side (not in the browser) so inspecting the raw API response reveals
 * nothing useful. This is an explicit allowlist — anything not listed is dropped.
 *
 * Blocked fields (never returned to the client through this flow):
 *   email, phone, phoneNumber, resumeUrl, resumeFileName, linkedinUrl,
 *   githubUrl, portfolioUrl, websiteUrl, videoIntroUrl, videoIntroFileName,
 *   passwordHash, displayName (may differ from fullName and contain real identity)
 */
export function sanitizeSearchCandidate(candidate: Record<string, any>): Record<string, any> {
  const rawName: string = (candidate.fullName ?? candidate.full_name ?? "").trim();
  const parts = rawName.split(/\s+/).filter(Boolean);

  // Server-side name masking — format mirrors maskInviteName in routes.ts:
  //   ""          → "Talent Profile"
  //   "Madonna"   → "M••••"
  //   "Jane Smith"→ "Jane S."
  const maskedName =
    !rawName
      ? "Talent Profile"
      : parts.length === 1
        ? parts[0][0] + "•".repeat(4)
        : parts[0] + " " + (parts[1]?.[0] ?? "") + ".";

  return {
    // Identity — always masked; name only reveals through the submissions view on acceptance
    fullName:  maskedName,
    full_name: maskedName,

    // Professional profile — safe to expose pre-invite
    targetPosition:  candidate.targetPosition  ?? candidate.target_position  ?? null,
    location:        candidate.location        ?? null,
    seniority:       candidate.seniority       ?? null,
    category:        candidate.category        ?? null,
    availability:    candidate.availability    ?? null,
    headline:        candidate.headline        ?? null,
    summary:         candidate.summary         ?? null,
    moreAboutMe:     candidate.moreAboutMe     ?? null,
    coreSkills:      candidate.coreSkills      ?? candidate.core_skills      ?? [],
    secondarySkills: candidate.secondarySkills ?? candidate.secondary_skills ?? [],
    profilePhotoUrl: candidate.profilePhotoUrl ?? null,
    workHistory:     candidate.workHistory     ?? [],
    preferences:     candidate.preferences     ?? {},
    experienceYears: candidate.experienceYears ?? null,
    // Public trust signal — not PII; same visibility tier as seniority/category
    isVetted:        candidate.isVetted        ?? candidate.is_vetted ?? false,

    // Explicitly omitted (never returned to the client through this flow):
    // email, phone, phoneNumber, resumeUrl, resumeFileName, linkedinUrl,
    // githubUrl, portfolioUrl, websiteUrl, videoIntroUrl, videoIntroFileName,
    // passwordHash, displayName
  };
}

/**
 * sanitizeFullProfileForClient — extended allowlist for the "View Full Profile"
 * endpoint (/api/client/talent-profile/:userId). Adds education and
 * certifications to the base search-result fields. Requires client JWT.
 *
 * This is a SEPARATE, EXPLICIT allowlist — not a spread of sanitizeSearchCandidate.
 * Any field not listed here is dropped. URL fields, contact fields, and
 * password hash are intentionally absent.
 */
export function sanitizeFullProfileForClient(candidate: Record<string, any>): Record<string, any> {
  const rawName: string = (candidate.fullName ?? candidate.full_name ?? "").trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  const maskedName =
    !rawName
      ? "Talent Profile"
      : parts.length === 1
        ? parts[0][0] + "•".repeat(4)
        : parts[0] + " " + (parts[1]?.[0] ?? "") + ".";

  return {
    // Identity — always masked; same pattern as sanitizeSearchCandidate
    fullName:  maskedName,
    full_name: maskedName,

    // Professional profile fields (same set as search results)
    targetPosition:  candidate.targetPosition  ?? candidate.target_position  ?? null,
    location:        candidate.location        ?? null,
    seniority:       candidate.seniority       ?? null,
    category:        candidate.category        ?? null,
    availability:    candidate.availability    ?? null,
    headline:        candidate.headline        ?? null,
    summary:         candidate.summary         ?? null,
    moreAboutMe:     candidate.moreAboutMe     ?? null,
    coreSkills:      candidate.coreSkills      ?? candidate.core_skills      ?? [],
    secondarySkills: candidate.secondarySkills ?? candidate.secondary_skills ?? [],
    profilePhotoUrl: candidate.profilePhotoUrl ?? null,
    workHistory:     candidate.workHistory     ?? [],
    preferences:     candidate.preferences     ?? {},
    experienceYears: candidate.experienceYears ?? null,

    // Full-profile extras — NOT in sanitizeSearchCandidate
    education:      candidate.education      ?? [],
    certifications: candidate.certifications ?? [],
    // Public trust signal — not PII; same visibility tier as seniority/category
    isVetted:       candidate.isVetted       ?? candidate.is_vetted ?? false,

    // Explicitly omitted (never returned through this flow):
    // email, phone, resumeUrl, resumeFileName, linkedinUrl, githubUrl,
    // portfolioUrl, websiteUrl, videoIntroUrl, videoIntroFileName,
    // passwordHash, displayName, userId
  };
}

/** Fields that MUST NEVER appear in a client search API response at any stage. */
export const SEARCH_RESULT_BLOCKED_FIELDS: readonly string[] = [
  "email",
  "phone",
  "phoneNumber",   "phone_number",
  "passwordHash",  "password_hash",
  "resumeUrl",     "resume_url",
  "resumeFileName","resume_file_name",
  "linkedinUrl",   "linkedin_url",
  "githubUrl",     "github_url",
  "portfolioUrl",  "portfolio_url",
  "websiteUrl",    "website_url",
  "videoIntroUrl", "video_intro_url",
  "videoIntroFileName", "video_intro_file_name",
  "displayName",   "display_name",
  "userId",        "user_id",
];
