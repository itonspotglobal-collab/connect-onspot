import {
  findMessagePrivacySpans,
  type MessagePrivacyDetection,
  type MessagePrivacyDetectionType,
  type MessagePrivacySpan,
} from "./piiPatterns";
import {
  detectMessagePrivacySemantically,
  type MessagePrivacyAiDetection,
} from "../services/openaiService";

export const PRIVACY_CONTEXT_MESSAGE_LIMIT = 5;
export const PRIVACY_CONTEXT_WINDOW_MS = 3 * 60 * 1000;
export const CROSS_MESSAGE_REDACTION = "*****";

export type PrivacyContextMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date | string | null;
};

export type MessagePrivacyContextResult = {
  detected: boolean;
  affectedPreviousMessageIds: string[];
  previousMessageRedactions: Array<{
    id: string;
    sanitizedContent: string;
  }>;
  sanitizedNewContent: string;
  detections: MessagePrivacyDetection[];
  source: "none" | "deterministic" | "vanessa";
};

const SUSPICIOUS_FRAGMENT_RE =
  /@|\+?\d[\d\s().-]{1,}|\b(?:at|dot|gmail|yahoo|outlook|phone|number|whatsapp|telegram|username|handle|password|passwd|pwd|passcode|pin|otp|token|secret|key)\b/i;

const CONTACT_AWARE_COMPACT_RE =
  /^[a-zA-Z0-9_%+\-@.[\]()\s]{1,80}$/;
const ALLOWED_CONTEXT_VANESSA_TYPES = new Set([
  "obfuscated_email",
  "obfuscated_phone",
  "contact_sharing",
  "credential",
  "token",
  "whatsapp_contact",
]);
const MAX_CONTEXT_VANESSA_SPAN_CHARS = 120;

type CandidateSegment = {
  messageIndex: number;
  candidateStart: number;
  candidateEnd: number;
  sourceStart: number;
};

type PrivacyCandidate = {
  text: string;
  segments: CandidateSegment[];
};

export function hasSuspiciousPrivacyFragments(parts: string[]): boolean {
  return parts.some((part) => SUSPICIOUS_FRAGMENT_RE.test(part));
}

function trimmedSlice(
  value: string,
  mode: "full" | "boundary",
  index: number,
  lastIndex: number,
): { text: string; sourceStart: number } {
  const leading = value.length - value.trimStart().length;
  const trimmed = value.trim();
  if (mode === "full" || trimmed.length <= 40) {
    return { text: trimmed, sourceStart: leading };
  }
  if (index === 0) {
    return {
      text: trimmed.slice(-40),
      sourceStart: leading + trimmed.length - 40,
    };
  }
  if (index === lastIndex) {
    return { text: trimmed.slice(0, 40), sourceStart: leading };
  }
  return { text: trimmed.slice(0, 80), sourceStart: leading };
}

function buildCandidate(
  parts: string[],
  separator: string,
  mode: "full" | "boundary",
): PrivacyCandidate {
  let text = "";
  const segments: CandidateSegment[] = [];
  parts.forEach((part, messageIndex) => {
    if (messageIndex > 0) text += separator;
    const selected = trimmedSlice(part, mode, messageIndex, parts.length - 1);
    const candidateStart = text.length;
    text += selected.text;
    segments.push({
      messageIndex,
      candidateStart,
      candidateEnd: text.length,
      sourceStart: selected.sourceStart,
    });
  });
  return { text, segments };
}

function contextVariants(parts: string[]): PrivacyCandidate[] {
  const variants = [
    buildCandidate(parts, " ", "full"),
    buildCandidate(parts, "", "boundary"),
  ];
  if (
    parts.every(
      (part) =>
        part.trim().length > 0 &&
        part.trim().length <= 80 &&
        CONTACT_AWARE_COMPACT_RE.test(part.trim()),
    )
  ) {
    variants.push(buildCandidate(parts, "", "full"));
  }
  return variants.filter(
    (candidate, index) =>
      variants.findIndex((other) => other.text === candidate.text) === index,
  );
}

function overlaps(start: number, end: number, rangeStart: number, rangeEnd: number) {
  return start < rangeEnd && end > rangeStart;
}

function applyRanges(
  content: string,
  ranges: Array<{ start: number; end: number }>,
): string {
  const merged = ranges
    .filter((range) => range.start >= 0 && range.end > range.start)
    .sort((a, b) => a.start - b.start)
    .reduce<Array<{ start: number; end: number }>>((result, range) => {
      const previous = result.at(-1);
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        result.push({ ...range });
      }
      return result;
    }, []);
  let sanitized = content;
  for (const range of merged.reverse()) {
    sanitized =
      sanitized.slice(0, range.start) +
      CROSS_MESSAGE_REDACTION +
      sanitized.slice(range.end);
  }
  return sanitized;
}

function resultFromSpans({
  recent,
  newContent,
  candidate,
  spans,
  source,
}: {
  recent: PrivacyContextMessage[];
  newContent: string;
  candidate: PrivacyCandidate;
  spans: Array<
    MessagePrivacySpan & {
      confidence?: number;
    }
  >;
  source: "deterministic" | "vanessa";
}): MessagePrivacyContextResult | null {
  const newMessageIndex = recent.length;
  const involvedIndexes = new Set<number>();
  const rangesByMessage = new Map<number, Array<{ start: number; end: number }>>();
  const acceptedSpans: typeof spans = [];

  for (const span of spans) {
    const contextIndexes = candidate.segments
      .filter((segment) =>
        overlaps(
          span.contextStart,
          span.contextEnd,
          segment.candidateStart,
          segment.candidateEnd,
        ),
      )
      .map((segment) => segment.messageIndex);
    if (
      !contextIndexes.includes(newMessageIndex) ||
      !contextIndexes.some((index) => index < newMessageIndex)
    ) {
      continue;
    }
    acceptedSpans.push(span);
    contextIndexes.forEach((index) => involvedIndexes.add(index));
    for (const segment of candidate.segments) {
      const overlapStart = Math.max(span.start, segment.candidateStart);
      const overlapEnd = Math.min(span.end, segment.candidateEnd);
      if (overlapEnd <= overlapStart) continue;
      const ranges = rangesByMessage.get(segment.messageIndex) ?? [];
      ranges.push({
        start: segment.sourceStart + overlapStart - segment.candidateStart,
        end: segment.sourceStart + overlapEnd - segment.candidateStart,
      });
      rangesByMessage.set(segment.messageIndex, ranges);
    }
  }
  if (acceptedSpans.length === 0) return null;

  const affectedPreviousMessageIds = recent
    .filter((_message, index) => involvedIndexes.has(index))
    .map((message) => message.id);
  const previousMessageRedactions = recent
    .map((message, index) => ({
      id: message.id,
      sanitizedContent: applyRanges(
        message.content,
        rangesByMessage.get(index) ?? [],
      ),
    }))
    .filter((_message, index) => involvedIndexes.has(index));
  const detections: MessagePrivacyDetection[] = acceptedSpans.map((span) => ({
    type: span.type,
    confidence: span.confidence ?? 1,
    source,
  }));

  return {
    detected: true,
    affectedPreviousMessageIds,
    previousMessageRedactions,
    sanitizedNewContent: applyRanges(
      newContent,
      rangesByMessage.get(newMessageIndex) ?? [],
    ),
    detections,
    source,
  };
}

function safeRecentMessages({
  senderId,
  recentMessages,
  now,
}: {
  senderId: string;
  recentMessages: PrivacyContextMessage[];
  now: Date;
}): PrivacyContextMessage[] {
  const cutoff = now.getTime() - PRIVACY_CONTEXT_WINDOW_MS;
  return recentMessages
    .filter(
      (message) =>
        message.senderId === senderId &&
        message.createdAt !== null &&
        new Date(message.createdAt).getTime() >= cutoff,
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime(),
    )
    .slice(-PRIVACY_CONTEXT_MESSAGE_LIMIT);
}

/**
 * Finds the smallest recent same-sender suffix that becomes sensitive only
 * when combined with the incoming message. Stored messages are never
 * concatenated; the combined strings exist only for detection.
 */
export function detectDeterministicMessagePrivacyContext({
  senderId,
  recentMessages,
  newContent,
  now = new Date(),
}: {
  senderId: string;
  recentMessages: PrivacyContextMessage[];
  newContent: string;
  now?: Date;
}): MessagePrivacyContextResult {
  const recent = safeRecentMessages({ senderId, recentMessages, now });

  for (let count = 1; count <= recent.length; count += 1) {
    const involved = recent.slice(-count);
    const parts = involved.map((message) => message.content).concat(newContent);
    for (const candidate of contextVariants(parts)) {
      const result = resultFromSpans({
        recent: involved,
        newContent,
        candidate,
        spans: findMessagePrivacySpans(candidate.text),
        source: "deterministic",
      });
      if (result) return result;
    }
  }

  return {
    detected: false,
    affectedPreviousMessageIds: [],
    previousMessageRedactions: [],
    sanitizedNewContent: newContent,
    detections: [],
    source: "none",
  };
}

/**
 * Bounded semantic fallback for suspicious split attempts missed by explicit
 * boundary rules. Only the latest three sanitized fragments are supplied.
 */
export async function detectMessagePrivacyContext({
  senderId,
  recentMessages,
  newContent,
  now = new Date(),
  semanticDetector = detectMessagePrivacySemantically,
}: {
  senderId: string;
  recentMessages: PrivacyContextMessage[];
  newContent: string;
  now?: Date;
  semanticDetector?: typeof detectMessagePrivacySemantically;
}): Promise<MessagePrivacyContextResult> {
  const deterministic = detectDeterministicMessagePrivacyContext({
    senderId,
    recentMessages,
    newContent,
    now,
  });
  if (deterministic.detected) return deterministic;

  const recent = safeRecentMessages({ senderId, recentMessages, now }).slice(-3);
  const parts = recent.map((message) => message.content).concat(newContent);
  if (recent.length === 0 || !hasSuspiciousPrivacyFragments(parts)) {
    return deterministic;
  }

  // Cross-message values necessarily meet at message boundaries. Supplying
  // only bounded boundary excerpts limits both disclosure and the amount a
  // broad-but-valid model range could ever redact.
  const candidate = buildCandidate(parts, "\n", "boundary");
  const combined = candidate.text;

  let semantic: {
    containsSensitiveInfo: boolean;
    detections: MessagePrivacyAiDetection[];
  };
  try {
    semantic = await semanticDetector(combined);
  } catch {
    return deterministic;
  }
  if (!semantic.containsSensitiveInfo) return deterministic;

  const valid = semantic.detections
    .map((detection) => ({
      type:
        typeof detection.type === "string"
          ? detection.type.toLowerCase()
          : "",
      start: Number(detection.start),
      end: Number(detection.end),
      confidence: Number(detection.confidence),
    }))
    .filter(
      (detection) =>
        ALLOWED_CONTEXT_VANESSA_TYPES.has(detection.type) &&
        Number.isInteger(detection.start) &&
        Number.isInteger(detection.end) &&
        detection.start >= 0 &&
        detection.end > detection.start &&
        detection.end <= combined.length &&
        detection.end - detection.start <= MAX_CONTEXT_VANESSA_SPAN_CHARS &&
        // A model that selects the entire supplied context has not identified
        // a precise sensitive value, so it is unsafe to erase any message.
        !(detection.start === 0 && detection.end === combined.length) &&
        Number.isFinite(detection.confidence) &&
        detection.confidence >= 0.9,
    );
  const semanticSpans: Array<MessagePrivacySpan & { confidence: number }> =
    valid.map((detection) => ({
      start: detection.start,
      end: detection.end,
      contextStart: detection.start,
      contextEnd: detection.end,
      type:
        detection.type === "credential"
          ? "credential"
          : detection.type === "token"
            ? "token"
            : ("obfuscated_contact" as MessagePrivacyDetectionType),
      confidence: Math.min(1, Math.max(0, detection.confidence)),
    }));
  return (
    resultFromSpans({
      recent,
      newContent,
      candidate,
      spans: semanticSpans,
      source: "vanessa",
    }) ?? deterministic
  );
}