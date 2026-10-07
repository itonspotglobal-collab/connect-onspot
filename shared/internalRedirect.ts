/** Only internal paths, never absolute, protocol-relative or backslash URLs. */
export function getSafeReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 4096 || value !== value.trim()) return null;
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { break; }
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
  try {
    const target = new URL(value, "https://internal.onspot.invalid");
    if (target.origin !== "https://internal.onspot.invalid") return null;
    if (target.pathname.startsWith("//")) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return null; }
}
