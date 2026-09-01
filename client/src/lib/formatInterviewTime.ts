const FIXED_OFFSET = /^UTC([+-])(\d{2}):(\d{2})$/;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function toUtcLikeMilliseconds(parts: DateTimeParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.getTime();
}

function getTimeZoneParts(formatter: Intl.DateTimeFormat, instant: number): DateTimeParts {
  const values = Object.fromEntries(
    formatter.formatToParts(new Date(instant))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/**
 * Convert a timezone-less datetime-local wall-clock value into a UTC instant.
 *
 * datetime-local values intentionally have no timezone. This resolves the
 * entered wall-clock time in the selected IANA timezone instead of the
 * browser's timezone, including daylight-saving offsets.
 */
export function convertLocalDateTimeToUtc(value: string, timeZone: string): string {
  const match = value.match(LOCAL_DATE_TIME);
  if (!match) throw new Error("Choose a valid interview date and time.");

  const wallClock: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0") || "0");

  if (
    wallClock.month < 1 || wallClock.month > 12 ||
    wallClock.day < 1 || wallClock.day > 31 ||
    wallClock.hour > 23 || wallClock.minute > 59 || wallClock.second > 59
  ) {
    throw new Error("Choose a valid interview date and time.");
  }

  const wallClockDate = new Date(0);
  wallClockDate.setUTCFullYear(wallClock.year, wallClock.month - 1, wallClock.day);
  wallClockDate.setUTCHours(wallClock.hour, wallClock.minute, wallClock.second, milliseconds);
  if (
    wallClockDate.getUTCFullYear() !== wallClock.year ||
    wallClockDate.getUTCMonth() !== wallClock.month - 1 ||
    wallClockDate.getUTCDate() !== wallClock.day ||
    wallClockDate.getUTCHours() !== wallClock.hour ||
    wallClockDate.getUTCMinutes() !== wallClock.minute ||
    wallClockDate.getUTCSeconds() !== wallClock.second ||
    wallClockDate.getUTCMilliseconds() !== milliseconds
  ) {
    throw new Error("Choose a valid interview date and time.");
  }

  const zone = timeZone?.trim() || "UTC";
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("Choose a valid timezone.");
  }

  const wallClockMs = toUtcLikeMilliseconds(wallClock);
  const getOffset = (instant: number) => {
    const localParts = getTimeZoneParts(formatter, instant);
    return toUtcLikeMilliseconds(localParts) - instant;
  };

  // Resolve the offset once, then recalculate at the candidate instant so
  // dates near a DST transition use the offset that actually applies.
  let utcMilliseconds = wallClockMs - getOffset(wallClockMs);
  utcMilliseconds = wallClockMs - getOffset(utcMilliseconds);

  // Reject nonexistent wall-clock times during a spring-forward gap rather
  // than silently changing the user's requested interview time.
  const resolvedParts = getTimeZoneParts(formatter, utcMilliseconds);
  if (
    resolvedParts.year !== wallClock.year ||
    resolvedParts.month !== wallClock.month ||
    resolvedParts.day !== wallClock.day ||
    resolvedParts.hour !== wallClock.hour ||
    resolvedParts.minute !== wallClock.minute ||
    resolvedParts.second !== wallClock.second
  ) {
    throw new Error("That interview time does not exist in the selected timezone.");
  }

  return new Date(utcMilliseconds + milliseconds).toISOString();
}

/**
 * Format an interview instant in the timezone the proposer selected.
 * The timezone label is always included so a browser-local rendering cannot
 * be mistaken for the agreed scheduling timezone.
 */
export function formatInterviewTime(value: string | Date, timezone = "UTC"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid interview time";

  const zone = timezone || "UTC";
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  let formatted: string;

  const fixedOffset = zone.match(FIXED_OFFSET);
  if (fixedOffset) {
    const hours = Number(fixedOffset[2]);
    const minutes = Number(fixedOffset[3]);
    const delta = (hours * 60 + minutes) * (fixedOffset[1] === "+" ? 1 : -1);
    formatted = new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" })
      .format(new Date(date.getTime() + delta * 60_000));
  } else {
    try {
      formatted = new Intl.DateTimeFormat(undefined, { ...options, timeZone: zone }).format(date);
    } catch {
      // Keep a clear label even if an old or unsupported timezone reaches a
      // browser; never silently show a bare viewer-local timestamp.
      formatted = new Intl.DateTimeFormat(undefined, options).format(date);
      return `${formatted} (viewer local time; source timezone: ${zone})`;
    }
  }

  return `${formatted} (${zone})`;
}