/** Explicit IANA identifiers only; ICU also accepts ambiguous abbreviations. */
export function validWorkTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100
    || !(value === "UTC" || /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value))) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch { return false; }
}
