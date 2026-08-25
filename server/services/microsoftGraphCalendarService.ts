/**
 * Microsoft Graph Calendar Service
 * Queries interviewer free/busy availability via the Graph `getSchedule` endpoint.
 *
 * Required application permission (granted by tenant admin):
 *   Calendars.Read   — read any user's calendar in the tenant
 *
 * The same app registration credentials used for Mail.Send are reused here.
 * The service is fully server-side: calendar emails and raw schedule data are
 * never returned to the client.
 *
 * Interviewer list management
 * ---------------------------
 * The list of OnSpot interviewers is configured server-side via the
 * ONSPOT_INTERVIEWERS_JSON environment variable (Replit Secret).
 * Format: JSON array of { id, name, title, calendarEmail }
 *
 * Example:
 *   [{"id":"ta-1","name":"Jane Smith","title":"Talent Acquisition Lead","calendarEmail":"jane@onspotglobal.com"}]
 *
 * An empty calendarEmail means the interviewer is not yet connected to Outlook;
 * they will appear in the list as "not connected".
 */

import { getMicrosoftGraphAccessToken } from "./microsoftGraphEmailService";

// ── Types ────────────────────────────────────────────────────────────────────

/** Safe interviewer representation returned to the client. Never includes calendarEmail. */
export interface InterviewerRecord {
  id: string;
  name: string;
  title: string;
  /** False when calendarEmail is not configured or Graph credentials are absent. */
  isCalendarConnected: boolean;
}

export interface AvailableSlot {
  /** UTC ISO 8601 start timestamp */
  start: string;
  /** UTC ISO 8601 end timestamp */
  end: string;
  /** HH:MM AM/PM in the requested timezone */
  startDisplay: string;
  endDisplay: string;
  /** YYYY-MM-DD in the requested timezone */
  date: string;
}

export interface GetSlotsOptions {
  interviewerId: string;
  startDate: string;       // YYYY-MM-DD inclusive
  endDate: string;         // YYYY-MM-DD inclusive
  durationMinutes: number; // 30 | 45 | 60
  timezone: string;        // IANA timezone
}

// ── Interviewer config ────────────────────────────────────────────────────────

interface InterviewerConfig {
  id: string;
  name: string;
  title: string;
  calendarEmail: string; // M365 UPN; empty string = not connected
}

/**
 * Built-in placeholder list. Replace or extend via ONSPOT_INTERVIEWERS_JSON.
 * Admins can configure real @onspotglobal.com emails through the Replit Secret.
 */
const BUILTIN_INTERVIEWERS: InterviewerConfig[] = [
  { id: "ta-lead", name: "Talent Acquisition Lead", title: "Talent Team", calendarEmail: "" },
  { id: "cs-lead", name: "Client Success Lead",    title: "Client Team", calendarEmail: "" },
];

function loadInterviewerConfigs(): InterviewerConfig[] {
  const raw = process.env.ONSPOT_INTERVIEWERS_JSON?.trim();
  if (!raw) return BUILTIN_INTERVIEWERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as InterviewerConfig[];
    }
  } catch {
    console.warn("[calendarService] ONSPOT_INTERVIEWERS_JSON is not valid JSON — using built-in list");
  }
  return BUILTIN_INTERVIEWERS;
}

function isGraphConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET
  );
}

/**
 * Return the current interviewer list with connection state.
 * The calendarEmail is intentionally omitted from the return value.
 */
export function getInterviewerList(): InterviewerRecord[] {
  const graphReady = isGraphConfigured();
  return loadInterviewerConfigs().map(({ id, name, title, calendarEmail }) => ({
    id,
    name,
    title,
    isCalendarConnected: graphReady && calendarEmail.trim().length > 0,
  }));
}

/** Lookup a single interviewer config by id. Returns null if not found. */
export function findInterviewerConfig(id: string): InterviewerConfig | null {
  return loadInterviewerConfigs().find((i) => i.id === id) ?? null;
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * Return the UTC offset in minutes for a given IANA timezone at a specific UTC epoch.
 * Positive value = UTC is ahead of local; negative = UTC is behind local.
 *
 * Example: Singapore (UTC+8) → offset = -480
 */
function getUtcOffsetMinutes(utcMs: number, timezone: string): number {
  const d = new Date(utcMs);
  const utcStr   = d.toLocaleString("en-US", { timeZone: "UTC" });
  const localStr = d.toLocaleString("en-US", { timeZone: timezone });
  return (new Date(utcStr).getTime() - new Date(localStr).getTime()) / 60_000;
}

/** Convert a local date + hour + minute (in the given timezone) to a UTC Date. */
function localToUtc(dateStr: string, hour: number, minute: number, timezone: string): Date {
  // Treat the local time as UTC first, then shift by the offset
  const asUtcMs = new Date(
    `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
  ).getTime();
  const offset = getUtcOffsetMinutes(asUtcMs, timezone);
  return new Date(asUtcMs + offset * 60_000);
}

/** Return YYYY-MM-DD for a UTC epoch displayed in the given IANA timezone. */
function getLocalDateStr(utcMs: number, timezone: string): string {
  return new Date(utcMs).toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA → YYYY-MM-DD
}

/** Format a UTC epoch as a time string in the given timezone (e.g. "09:00 AM"). */
function formatTimeDisplay(utcMs: number, timezone: string): string {
  return new Date(utcMs).toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Return the 3-letter weekday name in the given timezone ("Mon", "Tue", … "Sun"). */
function getLocalWeekday(utcMs: number, timezone: string): string {
  return new Date(utcMs).toLocaleDateString("en-US", { timeZone: timezone, weekday: "short" });
}

// ── Microsoft Graph free/busy ─────────────────────────────────────────────────

interface GraphScheduleItem {
  status: string; // "free" | "busy" | "tentative" | "oof" | "workingElsewhere"
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

interface GraphScheduleResponse {
  value: Array<{
    scheduleId: string;
    scheduleItems?: GraphScheduleItem[];
    error?: { message: string; code?: string };
  }>;
}

/** Parse a Graph dateTime object into a UTC epoch. Graph returns timestamps without "Z" for UTC. */
function parseGraphDateTime(dt: { dateTime: string; timeZone: string }): number {
  const str = dt.timeZone.toUpperCase() === "UTC" ? `${dt.dateTime}Z` : dt.dateTime;
  return new Date(str).getTime();
}

/**
 * Fetch free/busy schedule items from Graph `getSchedule`.
 * Returns only non-free items (busy, tentative, oof, workingElsewhere).
 * Throws on network/auth failures; the caller handles 502/503 responses.
 */
async function fetchBusyItems(
  calendarEmail: string,
  rangeStartUtc: Date,
  rangeEndUtc: Date,
  intervalMinutes: number,
): Promise<GraphScheduleItem[]> {
  const token = await getMicrosoftGraphAccessToken();

  const body = {
    schedules: [calendarEmail],
    startTime: {
      dateTime: rangeStartUtc.toISOString().replace("Z", ""),
      timeZone: "UTC",
    },
    endTime: {
      dateTime: rangeEndUtc.toISOString().replace("Z", ""),
      timeZone: "UTC",
    },
    availabilityViewInterval: intervalMinutes,
  };

  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(calendarEmail)}/calendar/getSchedule`;
  const res = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph getSchedule failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as GraphScheduleResponse;
  const entry = data.value?.[0];
  if (!entry) return [];

  if (entry.error) {
    throw new Error(
      `Graph returned error for ${calendarEmail}: [${entry.error.code ?? "?"}] ${entry.error.message}`,
    );
  }

  return (entry.scheduleItems ?? []).filter((item) => item.status !== "free");
}

/** True when [slotStart, slotEnd) and [busyStart, busyEnd) overlap. */
function overlaps(slotStartMs: number, slotEndMs: number, busyStartMs: number, busyEndMs: number): boolean {
  return slotStartMs < busyEndMs && slotEndMs > busyStartMs;
}

// ── Public slot query ─────────────────────────────────────────────────────────

/** Working-hours window (local timezone). Slots that end by WORK_END_HOUR are included. */
const WORK_START_HOUR = 9;
const WORK_END_HOUR   = 18; // slots end by 6 PM

/**
 * Query real interviewer availability from Microsoft Graph and return
 * available interview slot windows.
 *
 * The function:
 * 1. Calls Graph `getSchedule` for the full date range.
 * 2. Generates candidate slots (9 AM – 6 PM, weekdays only) in the requested timezone.
 * 3. Filters out any candidate slot that overlaps a busy/tentative calendar item.
 * 4. Returns available slots in UTC ISO + display strings in the requested timezone.
 *
 * Throws if Microsoft Graph credentials are not configured or the API call fails.
 */
export async function getInterviewerSlots(opts: GetSlotsOptions): Promise<AvailableSlot[]> {
  if (!isGraphConfigured()) {
    throw new Error("Microsoft Graph credentials are not configured.");
  }

  const interviewer = findInterviewerConfig(opts.interviewerId);
  if (!interviewer || !interviewer.calendarEmail?.trim()) {
    throw new Error(`Interviewer '${opts.interviewerId}' has no calendar connected.`);
  }

  const { calendarEmail } = interviewer;
  const { startDate, endDate, durationMinutes, timezone } = opts;

  // Expand query range to cover full working days in the timezone
  const rangeStart = localToUtc(startDate, 0, 0, timezone);
  const rangeEnd   = new Date(localToUtc(endDate, 23, 59, timezone).getTime() + 60_000);

  const busyItems = await fetchBusyItems(calendarEmail, rangeStart, rangeEnd, durationMinutes);

  const slots: AvailableSlot[] = [];

  // Iterate day by day within the date range
  let cursor = localToUtc(startDate, 0, 0, timezone);
  const rangeEndMs = rangeEnd.getTime();

  while (cursor.getTime() < rangeEndMs) {
    const localDate = getLocalDateStr(cursor.getTime(), timezone);
    const weekday   = getLocalWeekday(cursor.getTime(), timezone);

    if (weekday !== "Sat" && weekday !== "Sun") {
      const dayWorkStart = localToUtc(localDate, WORK_START_HOUR, 0, timezone);
      const dayWorkEnd   = localToUtc(localDate, WORK_END_HOUR,   0, timezone);

      let slotStart = dayWorkStart;
      while (slotStart.getTime() < dayWorkEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
        if (slotEnd.getTime() > dayWorkEnd.getTime()) break;

        const startMs = slotStart.getTime();
        const endMs   = slotEnd.getTime();

        const isBusy = busyItems.some((item) =>
          overlaps(startMs, endMs, parseGraphDateTime(item.start), parseGraphDateTime(item.end)),
        );

        if (!isBusy) {
          slots.push({
            start:        slotStart.toISOString(),
            end:          slotEnd.toISOString(),
            startDisplay: formatTimeDisplay(startMs, timezone),
            endDisplay:   formatTimeDisplay(endMs, timezone),
            date:         localDate,
          });
        }

        slotStart = new Date(slotStart.getTime() + durationMinutes * 60_000);
      }
    }

    // Advance to start of the next calendar day in the timezone (handles DST correctly)
    const nextDayMs    = cursor.getTime() + 25 * 60 * 60_000; // overshoot by 1 h to cross DST safely
    const nextLocalDate = getLocalDateStr(nextDayMs, timezone);
    cursor = localToUtc(nextLocalDate, 0, 0, timezone);
  }

  return slots;
}
