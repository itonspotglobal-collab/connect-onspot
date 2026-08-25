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
 * Rule: contact fields are permanently withheld at every stage. Names are
 * formatted server-side as "First Name L." so the browser never receives a
 * complete surname. This is an explicit allowlist — anything not listed is dropped.
 *
 * Blocked fields (never returned to the client through this flow):
 *   email, phone, phoneNumber, resumeUrl, resumeFileName, linkedinUrl,
 *   githubUrl, portfolioUrl, websiteUrl, videoIntroUrl, videoIntroFileName,
 *   passwordHash, displayName (may differ from fullName and contain real identity)
 */
import { formatTalentDisplayName, formatTalentDisplayNameFromFull } from "../../shared/talentName";

function getSafeTalentName(candidate: Record<string, any>): string {
  const firstName = candidate.firstName ?? candidate.first_name;
  const lastName = candidate.lastName ?? candidate.last_name;
  const structured = formatTalentDisplayName(firstName, lastName);
  if (structured) return structured;

  return formatTalentDisplayNameFromFull(candidate.fullName ?? candidate.full_name) || "Talent Profile";
}

export function sanitizeSearchCandidate(candidate: Record<string, any>): Record<string, any> {
  const maskedName = getSafeTalentName(candidate);

  return {
    // Identity — always privacy formatted; raw/structured names are not returned.
    maskedName,

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
    isVetted:        candidate.isVetted        ?? candidate.is_vetted    ?? false,
    isVerified:      candidate.isVerified      ?? candidate.is_verified  ?? false,

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
  const maskedName = getSafeTalentName(candidate);

  return {
    // Identity — always privacy formatted; raw/structured names are not returned.
    maskedName,

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
    isVetted:       candidate.isVetted       ?? candidate.is_vetted    ?? false,
    isVerified:     candidate.isVerified     ?? candidate.is_verified  ?? false,

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
  "fullName",      "full_name",
  "firstName",     "first_name",
  "lastName",      "last_name",
  "userId",        "user_id",
];
