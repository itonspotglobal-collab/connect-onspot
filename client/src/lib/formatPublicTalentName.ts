/**
 * formatPublicTalentName
 *
 * Display-layer utility that converts a talent's structured name fields into
 * a privacy-safe public format:  "First Name + Last Initial."
 *
 * Rules
 * ─────
 * • The complete firstName value is kept intact (supports multi-word first names).
 * • Only the first meaningful character of lastName is shown, uppercased, followed by ".".
 * • If lastName is absent/empty, firstName is returned unchanged.
 * • If firstName is absent/empty, an empty string is returned (callers fall back
 *   to their own ID-based display — this function does NOT expose the last name).
 * • Periods are never doubled (e.g. "O." not "O..").
 *
 * Examples
 * ────────
 *   ("Odie",        "Galang")          → "Odie G."
 *   ("Van Carlo",   "Labanan")         → "Van Carlo L."
 *   ("Maria",       "De la Cruz")      → "Maria D."
 *   ("John",        "O'Connor")        → "John O."
 *   ("Lesley Jean", "Valencinerina")   → "Lesley Jean V."
 *   ("Cher",        "")                → "Cher"
 *   ("Cher",        null)              → "Cher"
 *   ("",            "Galang")          → ""
 *   (null,          null)              → ""
 */
export function formatPublicTalentName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const fn = (firstName ?? "").trim();
  const ln = (lastName ?? "").trim();

  if (!fn) return "";                  // never expose surname without first name
  if (!ln) return fn;                  // no last name → show first name only

  // charAt(0) is safe here; exotic multi-byte edge cases are not realistically
  // present in name data and this avoids the --downlevelIteration requirement.
  const initial = ln.charAt(0).toUpperCase();
  return `${fn} ${initial}.`;
}

/**
 * formatPublicTalentNameMasked
 *
 * Stronger privacy variant: the FIRST word of the name is kept in full;
 * every subsequent word is reduced to its first letter (uppercased, no period).
 *
 * "Frenzy Val Eloise Legaspi"  → "Frenzy V E L"
 * "Maria Eubhe Regine T."      → "Maria E R T"
 * "Ijeoma O."                  → "Ijeoma O"
 * "John Smith"                 → "John S"
 * "Cher"                       → "Cher"
 * ""                           → ""
 */
export function formatPublicTalentNameMasked(
  name: string | null | undefined,
): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  const [firstName, ...rest] = parts;
  const initials = rest
    .map((p) => p.replace(/\./g, "").charAt(0))
    .filter(Boolean)
    .map((c) => c.toUpperCase());
  return [firstName, ...initials].join(" ");
}

/**
 * Convenience overload for callers that only have a combined fullName string
 * and no structured firstName/lastName fields.
 *
 * Splits on whitespace; all tokens except the last are treated as the first
 * name, and the last token becomes the last name.
 *
 * "Van Carlo Labanan" → firstName="Van Carlo", lastName="Labanan" → "Van Carlo L."
 * "Odie Galang"       → firstName="Odie",      lastName="Galang"  → "Odie G."
 * "Cher"              → no lastName                                → "Cher"
 */
export function formatPublicTalentNameFromFull(
  fullName: string | null | undefined,
): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "";

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];

  const lastName  = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  return formatPublicTalentName(firstName, lastName);
}
