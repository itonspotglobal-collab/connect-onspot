/**
 * Canonical privacy mask for Client-facing talent identities.
 *
 * It never mutates stored data or returns a full surname. Structured given and
 * family names are authoritative when present; legacy full names are only a
 * fallback for rows that do not have both structured values.
 */
export function maskClientTalentName(candidate: Record<string, unknown>): string {
  const firstName = firstNonBlank(
    candidate.firstName,
    candidate.first_name,
    candidate.givenName,
    candidate.given_name,
  );
  const lastName = firstNonBlank(
    candidate.lastName,
    candidate.last_name,
    candidate.familyName,
    candidate.family_name,
  );

  return (
    formatTalentDisplayName(firstName, lastName) ||
    formatTalentDisplayNameFromFull(firstNonBlank(candidate.fullName, candidate.full_name)) ||
    "Talent Profile"
  );
}

/** Structured first/family-name formatter retained for public display callers. */
export function formatTalentDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first || !last || containsLegacyMask(first) || containsLegacyMask(last)) return "";

  const givenName = first.split(/\s+/)[0];
  const familyInitial = firstAlphabeticCharacter(last);
  return familyInitial ? `${givenName} ${familyInitial}.` : "";
}

/** Combined-name fallback retained for legacy public display callers. */
export function formatTalentDisplayNameFromFull(
  fullName: string | null | undefined,
): string {
  return maskLegacyFullName((fullName ?? "").trim());
}

function firstNonBlank(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function containsLegacyMask(value: string): boolean {
  return /[•*]/.test(value);
}

function firstAlphabeticCharacter(value: string): string {
  const character = Array.from(value).find(
    (item) => item.toUpperCase() !== item.toLowerCase(),
  );
  return character ? character.toUpperCase() : "";
}

function maskSingleName(value: string): string {
  const initial = firstAlphabeticCharacter(value);
  return initial ? `${initial}••••` : "Talent Profile";
}

function maskLegacyFullName(fullName: string): string {
  if (!fullName || containsLegacyMask(fullName)) return "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return maskSingleName(parts[0]);

  const firstGivenName = parts[0];
  const finalToken = parts[parts.length - 1];
  // Preserve an existing one-letter surname initial while dropping any middle
  // names that may already have been included in an older masked value.
  const withoutPeriod = finalToken.replace(/\./g, "");
  const existingInitial = Array.from(withoutPeriod).length === 1
    ? firstAlphabeticCharacter(withoutPeriod)
    : "";
  const surnameInitial = existingInitial || firstAlphabeticCharacter(finalToken);
  return surnameInitial ? `${firstGivenName} ${surnameInitial}.` : maskSingleName(firstGivenName);
}