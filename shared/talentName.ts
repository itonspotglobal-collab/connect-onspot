/**
 * Privacy-safe display formatting for talent names.
 *
 * This helper is intentionally presentation-only. It never mutates stored
 * candidate data and never returns a full surname.
 */
export function formatTalentDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();

  if (!first || /[•*]/.test(first) || /[•*]/.test(last)) return "";
  if (!last) return first;

  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

/**
 * Safe fallback for records that only have a combined full name. If the input
 * is already an old asterisk/bullet mask, return nothing rather than showing
 * it again.
 */
export function formatTalentDisplayNameFromFull(
  fullName: string | null | undefined,
): string {
  const name = (fullName ?? "").trim();
  if (!name || /[•*]/.test(name)) return "";

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];

  return formatTalentDisplayName(parts[0], parts[parts.length - 1]);
}