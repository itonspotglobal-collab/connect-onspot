const FIXED_OFFSET = /^UTC([+-])(\d{2}):(\d{2})$/;

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