import DOMPurify from "dompurify";
import "./profile-rich-text.css";

// ── Allowlist matching the server-side sanitize-html config ───────────────────
const ALLOWED_TAGS = [
  "p", "br", "h2", "h3", "strong", "em",
  "ul", "ol", "li", "blockquote", "a",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the string contains at least one HTML element tag. */
function isHTML(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s);
}

/**
 * Convert legacy plain-text profile content to a minimal HTML string.
 * Blank-line-separated blocks become <p> tags; single newlines become <br>.
 */
function legacyToHTML(plain: string): string {
  const paragraphs = plain
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Sanitize HTML, keeping only safe tags. Runs client-side only.
 * Returns empty string if window is unavailable (SSR guard — not expected in this app).
 */
function sanitize(html: string): string {
  if (typeof window === "undefined") return "";
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "rel", "target"],
    FORCE_BODY: true,
  });
  // Ensure every <a> that opens an external URL gets rel="noopener noreferrer"
  return clean.replace(
    /<a\s+([^>]*href="([^"]*)"[^>]*)>/gi,
    (_match, attrs, href) => {
      const isExternal =
        href.startsWith("http://") || href.startsWith("https://");
      if (isExternal && !/rel=/.test(attrs)) {
        return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
      }
      return `<a ${attrs}>`;
    }
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ProfileRichTextRendererProps {
  value: string;
}

/**
 * Renders profile long-form content (About / More About Me) with:
 * - Rich-text HTML output from the editor (sanitized before display)
 * - Legacy plain-text profiles gracefully converted to paragraphs
 * - Consistent typography matching the OnSpot profile visual style
 */
export function ProfileRichTextRenderer({ value }: ProfileRichTextRendererProps) {
  if (!value?.trim()) return null;

  const raw = isHTML(value) ? value : legacyToHTML(value);
  const clean = sanitize(raw);

  if (!clean) return null;

  return (
    <div
      className="profile-rich-text max-w-prose"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
