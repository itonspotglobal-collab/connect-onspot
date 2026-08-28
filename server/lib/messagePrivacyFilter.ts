import {
  filterMessageContent,
  type FilteredMessageContent,
  type MessagePrivacyDetection,
} from "./piiPatterns";
import { detectMessagePrivacySemantically } from "../services/openaiService";

export const MAX_USER_MESSAGE_CHARS = 12_000;
const VANESSA_CONFIDENCE_THRESHOLD = 0.9;
const ALLOWED_VANESSA_TYPES = new Set([
  "obfuscated_email",
  "obfuscated_phone",
  "contact_sharing",
  "credential",
  "token",
  "whatsapp_contact",
]);

type VanessaDetection = {
  type?: unknown;
  start?: unknown;
  end?: unknown;
  confidence?: unknown;
};

function applyVanessaRedactions(
  content: string,
  detections: VanessaDetection[],
): { sanitizedContent: string; detections: MessagePrivacyDetection[] } {
  const valid = detections
    .map((d) => ({
      start: Number(d.start),
      end: Number(d.end),
      confidence: Number(d.confidence),
      type: typeof d.type === "string" ? d.type.toLowerCase() : "",
    }))
    .filter((d) =>
      Number.isInteger(d.start) &&
      Number.isInteger(d.end) &&
      d.start >= 0 &&
      d.end > d.start &&
      d.end <= content.length &&
      d.end - d.start <= 500 &&
      ALLOWED_VANESSA_TYPES.has(d.type) &&
      !content.slice(d.start, d.end).includes("*") &&
      !content.slice(d.start, d.end).includes("[REDACTED_") &&
      Number.isFinite(d.confidence) &&
      d.confidence >= VANESSA_CONFIDENCE_THRESHOLD,
    )
    .sort((a, b) => b.start - a.start);

  const accepted: typeof valid = [];
  let nextStart = content.length;
  for (const detection of valid) {
    if (detection.end <= nextStart) {
      accepted.push(detection);
      nextStart = detection.start;
    }
  }

  let sanitizedContent = content;
  for (const detection of accepted) {
    sanitizedContent =
      sanitizedContent.slice(0, detection.start) +
      "********" +
      sanitizedContent.slice(detection.end);
  }

  return {
    sanitizedContent,
    detections: accepted.map((d) => ({
      type: "obfuscated_contact",
      confidence: Math.min(1, Math.max(0, d.confidence)),
      source: "vanessa",
    })),
  };
}

/**
 * Canonical server-side user-message privacy pipeline.
 * Deterministic redaction always runs first. Vanessa only receives already
 * sanitized text and can never delay delivery indefinitely.
 */
export async function filterMessageContentWithVanessa(
  content: string,
  semanticDetector: typeof detectMessagePrivacySemantically =
    detectMessagePrivacySemantically,
): Promise<FilteredMessageContent> {
  const deterministic = filterMessageContent(content);
  let sanitizedContent = deterministic.sanitizedContent;
  let detections = [...deterministic.detections];

  try {
    const semantic = await semanticDetector(
      sanitizedContent,
    );
    if (semantic.containsSensitiveInfo && semantic.detections.length > 0) {
      const aiRedaction = applyVanessaRedactions(sanitizedContent, semantic.detections);
      sanitizedContent = aiRedaction.sanitizedContent;
      detections = detections.concat(aiRedaction.detections);
    }
  } catch {
    // Deterministic filtering is the required protection and remains usable
    // when Vanessa is unavailable, times out, or returns malformed JSON.
  }

  return {
    originalDetected: detections.length > 0,
    sanitizedContent,
    detections,
    flaggedForReview: detections.length > 0,
  };
}