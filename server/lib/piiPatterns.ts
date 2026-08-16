/**
 * PII detection patterns for in-platform messages.
 *
 * Philosophy: flag (never block). False positives are tolerable; false
 * negatives (missed contact details) undermine the channel's purpose.
 * All patterns are pre-compiled so they can be safely re-used across
 * requests without per-call compilation overhead.
 *
 * Patterns intentionally target:
 *   - Email addresses
 *   - Phone numbers: E.164 (+63…), US/intl formatted, Philippine mobile, 10-digit runs
 *
 * Patterns intentionally exclude:
 *   - Plain URLs (handled by the "no contact details" advisory notice)
 *   - Short numeric strings (IDs, years, reference codes ≤ 9 digits with no
 *     phone-like grouping)
 *
 * Performance: content is capped at MAX_SCAN_CHARS before evaluation so
 * execution time is bounded regardless of message length (DoS guard).
 */

/** Maximum characters inspected per message. Keeps regex evaluation O(1). */
const MAX_SCAN_CHARS = 10_000;

// Standard email pattern: local@domain.tld (bounded local/domain lengths to
// avoid catastrophic backtracking on pathological inputs).
const EMAIL_RE = /[a-zA-Z0-9_%+\-][a-zA-Z0-9._%+\-]{0,62}[a-zA-Z0-9_%+\-]?@[a-zA-Z0-9][a-zA-Z0-9.\-]{0,253}[a-zA-Z0-9]\.[a-zA-Z]{2,}/;

// E.164 / international: +NNN… at least 7 digits after the + and optional
// separators (spaces, dashes, dots).  Min total digits = 7, max = 15.
const PHONE_INTL_RE = /\+\d[\d\s\-().]{6,18}\d/;

// US/CA explicit format: (NXX) NXX-XXXX or NXX-NXX-XXXX or NXX.NXX.XXXX
const PHONE_US_RE = /(?:\(\d{3}\)[\s\-.]?\d{3}[\s\-.]?\d{4}|\b\d{3}[\s\-\.]\d{3}[\s\-\.]\d{4}\b)/;

// Philippine mobile: 09XX XXX XXXX or 08XX XXX XXXX with any separator or none.
// The 4+3+4 grouping is not covered by PHONE_US_RE (which is 3+3+4).
const PHONE_PH_RE = /\b0[89]\d{2}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

// 10+ consecutive digits with no surrounding alpha (catches unformatted phone
// strings; excludes long numeric IDs embedded in words/URLs).
const PHONE_DIGITS_RE = /(?<![a-zA-Z0-9])\d{10,}(?![a-zA-Z0-9])/;

// Obfuscated email: "john at example dot com" / "jane AT gmail DOT org"
// Matches: local-part (no spaces) + "at" + domain-word + "dot" + tld-word.
// Local part: 1–64 chars (mirrors the standard EMAIL_RE minimum of 1 char).
// TLD: 2–24 chars to cover modern long TLDs (.technology, .international, etc.).
// Domain: at least 2 chars total (anchor char + 1–62 more).
const EMAIL_WORDS_RE = /\b[a-zA-Z0-9_%+\-.]{1,64}\s+at\s+[a-zA-Z0-9][a-zA-Z0-9\-]{1,62}\s+dot\s+[a-zA-Z]{2,24}\b/i;

// Obfuscated phone: digit-words in sequence — at least 7 consecutive digit-words
// (space / dash / comma separated) to match a phone number length.
// e.g. "zero nine one two three four five six seven"
const DIGIT_WORD = "(?:zero|one|two|three|four|five|six|seven|eight|nine)";
const PHONE_DIGIT_WORDS_RE = new RegExp(
  `(?:${DIGIT_WORD}[\\s,\\-]*){6,}${DIGIT_WORD}`,
  "i",
);

const PATTERNS: ReadonlyArray<RegExp> = [
  EMAIL_RE,
  PHONE_INTL_RE,
  PHONE_US_RE,
  PHONE_PH_RE,
  PHONE_DIGITS_RE,
  EMAIL_WORDS_RE,
  PHONE_DIGIT_WORDS_RE,
];

// Also exported as PII_PATTERNS so test files can import by either name.
export const PII_PATTERNS: ReadonlyArray<RegExp> = PATTERNS;

/**
 * Returns true if `content` matches any PII pattern.
 *
 * Content is capped at MAX_SCAN_CHARS before evaluation so execution time
 * is bounded regardless of message length. Never throws — a regex edge-case
 * must never surface to the sender.
 */
export function containsPii(content: string): boolean {
  try {
    const sample = content.length > MAX_SCAN_CHARS ? content.slice(0, MAX_SCAN_CHARS) : content;
    return PATTERNS.some((re) => re.test(sample));
  } catch {
    return false;
  }
}

export { PATTERNS };
