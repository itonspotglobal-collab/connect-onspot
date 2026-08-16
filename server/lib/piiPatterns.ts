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
 *   - Phone numbers: E.164 (+63…), US/intl formatted, 10-digit runs
 *
 * Patterns intentionally exclude:
 *   - Plain URLs (handled by the "no contact details" advisory notice)
 *   - Short numeric strings (IDs, years, reference codes ≤ 9 digits with no
 *     phone-like grouping)
 */

// Standard email pattern: local@domain.tld
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

// E.164 / international: +NNN… at least 7 digits after the + and optional
// separators (spaces, dashes, dots).  Min total digits = 7, max = 15.
const PHONE_INTL_RE = /\+\d[\d\s\-().]{6,18}\d/;

// US/CA explicit format: (NXX) NXX-XXXX or NXX-NXX-XXXX or NXX.NXX.XXXX
const PHONE_US_RE = /(?:\(\d{3}\)[\s\-.]?\d{3}[\s\-.]?\d{4}|\b\d{3}[\s\-\.]\d{3}[\s\-\.]\d{4}\b)/;

// 10+ consecutive digits with no surrounding alpha (catches unformatted phone
// strings; excludes long numeric IDs embedded in words/URLs).
const PHONE_DIGITS_RE = /(?<![a-zA-Z0-9])\d{10,}(?![a-zA-Z0-9])/;

const PATTERNS: ReadonlyArray<RegExp> = [
  EMAIL_RE,
  PHONE_INTL_RE,
  PHONE_US_RE,
  PHONE_DIGITS_RE,
];

/**
 * Returns true if `content` matches any PII pattern.
 * Never throws — caller wraps in try/catch but this is a belt-and-suspenders
 * guarantee so that a regex edge-case can never surface to the sender.
 */
export function containsPii(content: string): boolean {
  try {
    return PATTERNS.some((re) => re.test(content));
  } catch {
    return false;
  }
}

export { PATTERNS };
