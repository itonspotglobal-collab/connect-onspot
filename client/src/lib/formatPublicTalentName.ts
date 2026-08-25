import {
  formatTalentDisplayName,
  formatTalentDisplayNameFromFull,
} from "@shared/talentName";

/** Privacy-safe public format: full first name plus surname initial. */
export function formatPublicTalentName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return formatTalentDisplayName(firstName, lastName);
}

/** Combined-name fallback for legacy records. */
export function formatPublicTalentNameMasked(
  name: string | null | undefined,
): string {
  return formatTalentDisplayNameFromFull(name);
}

export function formatPublicTalentNameFromFull(
  fullName: string | null | undefined,
): string {
  return formatTalentDisplayNameFromFull(fullName);
}

/**
 * Resolver for Hire Talent surfaces. Structured fields take precedence over
 * legacy display/full-name fields; old asterisk/bullet masks are never reused.
 */
export function getPrivacySafeTalentDisplayName(name: {
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  maskedName?: string | null;
  fullName?: string | null;
  full_name?: string | null;
}): string {
  const structured = formatPublicTalentName(
    name.firstName ?? name.first_name,
    name.lastName ?? name.last_name,
  );
  if (structured) return structured;

  const preformatted = (name.maskedName ?? "").trim();
  if (preformatted && !/[•*]/.test(preformatted)) return preformatted;

  return formatPublicTalentNameFromFull(name.fullName ?? name.full_name) || "Talent Profile";
}