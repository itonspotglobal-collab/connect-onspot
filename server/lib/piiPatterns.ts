/**
 * PII detection patterns for in-platform messages.
 *
 * The legacy `containsPii` helper remains available for moderation checks.
 * New user-generated messages should use `filterMessageContent`, which
 * deterministically redacts before persistence or delivery.
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

const EMAIL_GLOBAL_RE = new RegExp(EMAIL_RE.source, "gi");

// E.164 / international: +NNN… at least 7 digits after the + and optional
// separators (spaces, dashes, dots).  Min total digits = 7, max = 15.
const PHONE_INTL_RE = /\+\d[\d\s\-().]{6,18}\d/;
const PHONE_INTL_GLOBAL_RE = new RegExp(PHONE_INTL_RE.source, "g");

// US/CA explicit format: (NXX) NXX-XXXX or NXX-NXX-XXXX or NXX.NXX.XXXX
const PHONE_US_RE = /(?:\(\d{3}\)[\s\-.]?\d{3}[\s\-.]?\d{4}|\b\d{3}[\s\-\.]\d{3}[\s\-\.]\d{4}\b)/;
const PHONE_US_GLOBAL_RE = new RegExp(PHONE_US_RE.source, "g");

// Philippine mobile: 09XX XXX XXXX or 08XX XXX XXXX with any separator or none.
// The 4+3+4 grouping is not covered by PHONE_US_RE (which is 3+3+4).
const PHONE_PH_RE = /\b0[89]\d{2}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const PHONE_PH_GLOBAL_RE = new RegExp(PHONE_PH_RE.source, "g");
const PHONE_PH_PARENS_GLOBAL_RE = /\(0[89]\d{2}\)[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const PHONE_DOT_WORD_GLOBAL_RE =
  /\b(?:\d{2,4}\s+dot\s+){1,3}\d{3,4}\b/gi;

// 10+ consecutive digits with no surrounding alpha (catches unformatted phone
// strings; excludes long numeric IDs embedded in words/URLs).
const PHONE_DIGITS_RE = /(?<![a-zA-Z0-9])\d{10,}(?![a-zA-Z0-9])/;
const PHONE_DIGITS_GLOBAL_RE = new RegExp(PHONE_DIGITS_RE.source, "g");

// Obfuscated email: "john at example dot com" / "jane AT gmail DOT org"
// Matches: local-part (no spaces) + "at" + domain-word + "dot" + tld-word.
// Local part: 1–64 chars (mirrors the standard EMAIL_RE minimum of 1 char).
// TLD: 2–24 chars to cover modern long TLDs (.technology, .international, etc.).
// Domain: at least 2 chars total (anchor char + 1–62 more).
const EMAIL_WORDS_RE = /\b[a-zA-Z0-9_%+\-.]{1,64}\s+at\s+[a-zA-Z0-9][a-zA-Z0-9\-]{1,62}\s+dot\s+[a-zA-Z]{2,24}\b/i;

// Obfuscated email variants: "val [at] gmail [dot] com", "val(at)gmail(dot)com",
// and "val @ gmail . com". The surrounding local/domain/tld shape prevents
// ordinary uses of "at" and "dot" from being masked.
const OBFUSCATED_EMAIL_SYMBOL_RE =
  /\b([a-zA-Z0-9_%+\-.]{1,64})\s*(?:@|\[at\]|\(at\))\s*([a-zA-Z0-9][a-zA-Z0-9\-]{1,62})\s*(?:\.|\[dot\]|\(dot\))\s*([a-zA-Z]{2,24})\b/gi;
const OBFUSCATED_EMAIL_WORDS_GLOBAL_RE = new RegExp(EMAIL_WORDS_RE.source, "gi");
const OBFUSCATED_EMAIL_SPACED_RE =
  /\b((?:[a-zA-Z0-9]\s+){1,63}[a-zA-Z0-9])\s*@\s*([a-zA-Z0-9][a-zA-Z0-9\-]{1,62})\s*\.\s*([a-zA-Z]{2,24})\b/gi;

// Obfuscated phone: digit-words in sequence — at least 7 consecutive digit-words
// (space / dash / comma separated) to match a phone number length.
// e.g. "zero nine one two three four five six seven"
const DIGIT_WORD = "(?:zero|one|two|three|four|five|six|seven|eight|nine)";
const PHONE_DIGIT_WORDS_RE = new RegExp(
  `(?:${DIGIT_WORD}[\\s,\\-]*){6,}${DIGIT_WORD}`,
  "i",
);
const PHONE_DIGIT_WORDS_GLOBAL_RE = new RegExp(PHONE_DIGIT_WORDS_RE.source, "gi");

const CREDENTIAL_CONTEXT_RE =
  /(\b(password|passwd|pwd|passcode|pin|otp|one[- ]time password)\b\s*(?:(?::|=)|\b(?:is|was)\b)\s*)(?:"[^"\r\n]{1,256}"|'[^'\r\n]{1,256}'|[^\r\n,;.!?]{1,256}?(?:[.!?](?=\s|$)|(?=[,;])|(?=\s+(?:and|but|then)\s+)|$))/gi;
const LABELED_SECRET_RE =
  /\b(api[_ -]?key|access token|secret key|token)\b\s*(?::|=)\s*([^\s,;]+)/gi;
const BEARER_TOKEN_RE = /\b(Bearer)\s+([A-Za-z0-9._~+/=-]{8,})\b/g;
const STANDALONE_API_KEY_RE = /\bsk-[A-Za-z0-9_-]{6,}\b/g;

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

export type MessagePrivacyDetectionType =
  | "email"
  | "phone"
  | "credential"
  | "token"
  | "obfuscated_contact";

export type MessagePrivacyDetection = {
  type: MessagePrivacyDetectionType;
  confidence: number;
  source: "deterministic" | "vanessa";
};

export type FilteredMessageContent = {
  originalDetected: boolean;
  sanitizedContent: string;
  detections: MessagePrivacyDetection[];
  flaggedForReview: boolean;
};

export type MessagePrivacySpan = {
  start: number;
  end: number;
  contextStart: number;
  contextEnd: number;
  type: MessagePrivacyDetectionType;
};

/**
 * Returns only character offsets and safe category names. Values are never
 * copied into the result. Context offsets may be wider than redaction offsets
 * for labels such as "password:", where only the value should be hidden.
 */
export function findMessagePrivacySpans(content: string): MessagePrivacySpan[] {
  const spans: MessagePrivacySpan[] = [];
  const add = (
    start: number,
    end: number,
    type: MessagePrivacyDetectionType,
    contextStart = start,
    contextEnd = end,
  ) => {
    if (start >= 0 && end > start && end <= content.length) {
      spans.push({ start, end, contextStart, contextEnd, type });
    }
  };
  const each = (pattern: RegExp, callback: (match: RegExpExecArray) => void) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const regex = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      callback(match);
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  };

  each(CREDENTIAL_CONTEXT_RE, (match) => {
    const valueStart = match.index + match[1].length;
    add(
      valueStart,
      match.index + match[0].length,
      "credential",
      match.index,
      match.index + match[0].length,
    );
  });
  each(LABELED_SECRET_RE, (match) => {
    const valueOffset = match[0].lastIndexOf(match[2]);
    add(
      match.index + valueOffset,
      match.index + valueOffset + match[2].length,
      "token",
      match.index,
      match.index + match[0].length,
    );
  });
  each(BEARER_TOKEN_RE, (match) => {
    const valueOffset = match[0].lastIndexOf(match[2]);
    add(
      match.index + valueOffset,
      match.index + valueOffset + match[2].length,
      "token",
      match.index,
      match.index + match[0].length,
    );
  });
  each(STANDALONE_API_KEY_RE, (match) =>
    add(match.index, match.index + match[0].length, "token"),
  );

  for (const pattern of [
    OBFUSCATED_EMAIL_SPACED_RE,
    OBFUSCATED_EMAIL_SYMBOL_RE,
    OBFUSCATED_EMAIL_WORDS_GLOBAL_RE,
  ]) {
    each(pattern, (match) =>
      add(
        match.index,
        match.index + match[0].length,
        "obfuscated_contact",
      ),
    );
  }
  each(EMAIL_GLOBAL_RE, (match) =>
    add(match.index, match.index + match[0].length, "email"),
  );

  for (const pattern of [
    PHONE_INTL_GLOBAL_RE,
    PHONE_PH_GLOBAL_RE,
    PHONE_PH_PARENS_GLOBAL_RE,
    PHONE_DOT_WORD_GLOBAL_RE,
    PHONE_US_GLOBAL_RE,
    PHONE_DIGITS_GLOBAL_RE,
  ]) {
    each(pattern, (match) => {
      const digits = match[0].replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15) {
        add(match.index, match.index + match[0].length, "phone");
      }
    });
  }
  each(PHONE_DIGIT_WORDS_GLOBAL_RE, (match) =>
    add(
      match.index,
      match.index + match[0].length,
      "obfuscated_contact",
    ),
  );

  return spans.sort(
    (a, b) =>
      a.contextStart - b.contextStart ||
      b.contextEnd - a.contextEnd ||
      a.start - b.start,
  );
}

function emailSuffix(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length >= 2 && (labels.at(-2)?.length ?? 0) <= 3) {
    return `.${labels.at(-2)}.${labels.at(-1)}`;
  }
  return `.${labels.at(-1) ?? "com"}`;
}

function emailMask(domain: string): string {
  return `*****${emailSuffix(domain)}`;
}

function phoneMask(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `***${digits.slice(-4)}`;
}

function credentialMask(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized === "pin") return "****";
  if (normalized === "otp" || normalized === "passcode") return "******";
  return "********";
}

/**
 * Synchronously detects and redacts sensitive message values.
 * This function never logs or returns the detected values.
 */
export function filterMessageContent(content: string): FilteredMessageContent {
  let sanitizedContent = content;
  const detections: MessagePrivacyDetection[] = [];

  const addDetection = (type: MessagePrivacyDetectionType) => {
    detections.push({ type, confidence: 1, source: "deterministic" });
  };

  sanitizedContent = sanitizedContent.replace(
    CREDENTIAL_CONTEXT_RE,
    (_full: string, prefix: string, label: string) => {
      addDetection("credential");
      return `${prefix}${credentialMask(label)}`;
    },
  );
  sanitizedContent = sanitizedContent.replace(
    LABELED_SECRET_RE,
    (_full: string, label: string, value: string, offset: number, source: string) => {
      addDetection("token");
      const prefixEnd = source.indexOf(value, offset);
      const prefix = prefixEnd >= 0 ? source.slice(offset, prefixEnd) : `${label}: `;
      return `${prefix}********`;
    },
  );
  sanitizedContent = sanitizedContent.replace(BEARER_TOKEN_RE, (_full, label: string) => {
    addDetection("token");
    return `${label} ********`;
  });
  sanitizedContent = sanitizedContent.replace(STANDALONE_API_KEY_RE, () => {
    addDetection("token");
    return "********";
  });

  sanitizedContent = sanitizedContent.replace(
    OBFUSCATED_EMAIL_SPACED_RE,
    (_full, _local: string, domain: string, tld: string) => {
      addDetection("obfuscated_contact");
      return emailMask(`${domain}.${tld}`);
    },
  );
  sanitizedContent = sanitizedContent.replace(
    OBFUSCATED_EMAIL_SYMBOL_RE,
    (_full, _local: string, domain: string, tld: string) => {
      addDetection("obfuscated_contact");
      return emailMask(`${domain}.${tld}`);
    },
  );
  sanitizedContent = sanitizedContent.replace(
    OBFUSCATED_EMAIL_WORDS_GLOBAL_RE,
    (full: string) => {
      const parts = full.trim().split(/\s+/);
      const domain = parts.at(-3) ?? "hidden";
      const tld = parts.at(-1) ?? "com";
      addDetection("obfuscated_contact");
      return emailMask(`${domain}.${tld}`);
    },
  );
  sanitizedContent = sanitizedContent.replace(EMAIL_GLOBAL_RE, (full: string) => {
    addDetection("email");
    return emailMask(full.slice(full.indexOf("@") + 1));
  });

  const replacePhone = (regex: RegExp) => {
    sanitizedContent = sanitizedContent.replace(regex, (full: string) => {
      const digits = full.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) return full;
      addDetection("phone");
      return phoneMask(full);
    });
  };
  replacePhone(PHONE_INTL_GLOBAL_RE);
  replacePhone(PHONE_PH_GLOBAL_RE);
  replacePhone(PHONE_PH_PARENS_GLOBAL_RE);
  replacePhone(PHONE_DOT_WORD_GLOBAL_RE);
  replacePhone(PHONE_US_GLOBAL_RE);
  replacePhone(PHONE_DIGITS_GLOBAL_RE);
  sanitizedContent = sanitizedContent.replace(PHONE_DIGIT_WORDS_GLOBAL_RE, () => {
    addDetection("obfuscated_contact");
    return "********";
  });

  return {
    originalDetected: detections.length > 0,
    sanitizedContent,
    detections,
    flaggedForReview: detections.length > 0,
  };
}

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
