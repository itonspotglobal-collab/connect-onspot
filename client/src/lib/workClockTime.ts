import { validWorkTimezone } from "@shared/workTimezone";

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  return validWorkTimezone(timeZone);
}

export function formatWorkTime(value: string | Date | null | undefined, timeZone?: string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (!isValidTimeZone(timeZone)) return "Work timezone not set";
  return new Intl.DateTimeFormat(undefined, {
    timeZone, dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

export function formatWorkClock(value: number | Date, timeZone: string, withDate = false) {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValidTimeZone(timeZone) || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, withDate
    ? { timeZone, dateStyle: "full" }
    : { timeZone, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(date);
}

export function timezoneOffsetLabel(value: number | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValidTimeZone(timeZone) || Number.isNaN(date.getTime())) return "";
  const label = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = label.match(/(?:GMT|UTC)(?:([+-])(\d{1,2})(?::?(\d{2}))?)?/);
  if (!match || !match[1]) return "UTC+00:00";
  return `UTC${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}`;
}

export function elapsedSeconds(startedAt: string | number | Date, now: number | Date) {
  const start = startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime();
  const current = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(current)) return 0;
  return Math.max(0, Math.floor((current - start) / 1000));
}

export function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

/** Converts a datetime-local value in the selected zone; nonexistent DST times are rejected. */
export function workLocalInputInstant(value: string, timeZone: string) {
  if (!value || !isValidTimeZone(timeZone)) throw new Error("Choose a valid work timezone and timestamp.");
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) throw new Error("Enter a valid timestamp.");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) throw new Error("Enter a valid timestamp.");
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const p = zonedParts(new Date(instant), timeZone);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    instant += target - represented;
  }
  const result = new Date(instant);
  const p = zonedParts(result, timeZone);
  if (p.year !== year || p.month !== month || p.day !== day || p.hour !== hour || p.minute !== minute) {
    throw new Error("That local time does not exist because of a daylight-saving time change.");
  }
  return result.toISOString();
}

export function workLocalInput(value: string | null | undefined, timeZone?: string | null) {
  if (!value || !isValidTimeZone(timeZone)) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = zonedParts(date, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function supportedTimeZones() {
  const values = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf;
  const zones = values ? values("timeZone") : ["America/Los_Angeles", "America/New_York", "Asia/Manila", "Australia/Sydney", "Europe/London"];
  return zones.includes("UTC") ? zones : [...zones, "UTC"];
}
