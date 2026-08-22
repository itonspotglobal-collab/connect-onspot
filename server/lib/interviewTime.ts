export type InterviewTimeSlot = {
  start: string;
  end?: string;
  timezone: string;
};

export const normalizeInterviewTimeZone = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return "UTC";
  if (typeof value !== "string") return null;
  const timezone = value.trim().slice(0, 80);
  if (!timezone) return "UTC";
  if (/^(?:UTC|GMT)$/i.test(timezone)) return "UTC";
  const offset = timezone.match(/^(?:UTC|GMT)?([+-])(\d{2}):?(\d{2})$/i);
  if (offset) {
    const hours = Number(offset[2]);
    const minutes = Number(offset[3]);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
    return `UTC${offset[1]}${String(hours).padStart(2, "0")}:${offset[3]}`;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return null;
  }
};

export const parseInterviewTimestamp = (value: unknown): number => {
  if (typeof value !== "string") return Number.NaN;
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  // Treat timezone-less interview input as UTC, independent of the server's
  // process timezone. New values are stored as ISO UTC instants below.
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  return Date.parse(!hasExplicitZone && trimmed.includes("T") ? `${trimmed}Z` : trimmed);
};

export const normalizeInterviewTimes = (value: unknown): InterviewTimeSlot[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return null;
  const normalized = value.map((slot: any) => {
    const startTimestamp = parseInterviewTimestamp(slot?.start);
    const endTimestamp = typeof slot?.end === "string" ? parseInterviewTimestamp(slot.end) : undefined;
    const timezone = normalizeInterviewTimeZone(slot?.timezone);
    return {
      start: Number.isNaN(startTimestamp) ? "" : new Date(startTimestamp).toISOString(),
      end: endTimestamp !== undefined && !Number.isNaN(endTimestamp)
        ? new Date(endTimestamp).toISOString()
        : undefined,
      timezone: timezone ?? "UTC",
      invalidTimezone: timezone === null,
      invalidStart: Number.isNaN(startTimestamp),
      invalidEnd: endTimestamp !== undefined && Number.isNaN(endTimestamp),
    };
  });
  if (normalized.some((slot) => slot.invalidStart || slot.invalidEnd || slot.invalidTimezone)) return null;
  return normalized.map(({ invalidTimezone, invalidStart, invalidEnd, ...slot }) => slot);
};