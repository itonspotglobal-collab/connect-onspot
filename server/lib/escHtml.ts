/**
 * escHtml.ts
 *
 * Escapes a plain string for safe insertion into HTML — both as text content
 * between tags and inside double-quoted attribute values.
 *
 * Escaped characters:
 *   &  → &amp;   (must be first to avoid double-escaping the & in later replacements)
 *   <  → &lt;
 *   >  → &gt;
 *   "  → &quot;  (breaks out of double-quoted attributes)
 *   '  → &#39;   (defence-in-depth; not strictly required in double-quoted attributes
 *                  or text content, but prevents issues in edge cases)
 *
 * Used by: server/routes.ts → fireInvitationEmail (email HTML body generation only).
 * NOT used in browser DOM contexts; dangerouslySetInnerHTML/innerHTML usages in the
 * frontend are entirely separate concerns.
 */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
