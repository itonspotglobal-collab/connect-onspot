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
 * An empty calendarEmail means the interviewer has not yet been connected to Outlook;
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
  timezone: string;        // IANA timezone (for display)
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

// ── Windows timezone → IANA mapping ──────────────────────────────────────────

/**
 * Common Windows timezone names → IANA equivalents.
 * Source: Unicode CLDR windowsZones.xml (common subset).
 * workingHours.timeZone.name from Graph uses Windows names; IANA is required
 * for JavaScript's Intl APIs.
 */
const WINDOWS_TO_IANA: Record<string, string> = {
  "Dateline Standard Time":            "Etc/GMT+12",
  "UTC-11":                            "Etc/GMT+11",
  "Hawaiian Standard Time":            "Pacific/Honolulu",
  "Alaskan Standard Time":             "America/Anchorage",
  "Pacific Standard Time":             "America/Los_Angeles",
  "Pacific Standard Time (Mexico)":    "America/Santa_Isabel",
  "US Mountain Standard Time":         "America/Phoenix",
  "Mountain Standard Time (Mexico)":   "America/Chihuahua",
  "Mountain Standard Time":            "America/Denver",
  "Central America Standard Time":     "America/Guatemala",
  "Central Standard Time":             "America/Chicago",
  "Central Standard Time (Mexico)":    "America/Mexico_City",
  "Canada Central Standard Time":      "America/Regina",
  "SA Pacific Standard Time":          "America/Bogota",
  "Eastern Standard Time":             "America/New_York",
  "US Eastern Standard Time":          "America/Indiana/Indianapolis",
  "Venezuela Standard Time":           "America/Caracas",
  "Paraguay Standard Time":            "America/Asuncion",
  "Atlantic Standard Time":            "America/Halifax",
  "Central Brazilian Standard Time":   "America/Cuiaba",
  "SA Western Standard Time":          "America/La_Paz",
  "Pacific SA Standard Time":          "America/Santiago",
  "Newfoundland Standard Time":        "America/St_Johns",
  "E. South America Standard Time":    "America/Sao_Paulo",
  "Argentina Standard Time":           "America/Argentina/Buenos_Aires",
  "SA Eastern Standard Time":          "America/Cayenne",
  "Greenland Standard Time":           "America/Godthab",
  "Montevideo Standard Time":          "America/Montevideo",
  "Bahia Standard Time":               "America/Bahia",
  "UTC-02":                            "Etc/GMT+2",
  "Mid-Atlantic Standard Time":        "Atlantic/South_Georgia",
  "Azores Standard Time":              "Atlantic/Azores",
  "Cape Verde Standard Time":          "Atlantic/Cape_Verde",
  "Morocco Standard Time":             "Africa/Casablanca",
  "UTC":                               "UTC",
  "GMT Standard Time":                 "Europe/London",
  "Greenwich Standard Time":           "Atlantic/Reykjavik",
  "W. Europe Standard Time":           "Europe/Berlin",
  "Central Europe Standard Time":      "Europe/Budapest",
  "Romance Standard Time":             "Europe/Paris",
  "Central European Standard Time":    "Europe/Warsaw",
  "W. Central Africa Standard Time":   "Africa/Lagos",
  "Namibia Standard Time":             "Africa/Windhoek",
  "Jordan Standard Time":              "Asia/Amman",
  "GTB Standard Time":                 "Europe/Bucharest",
  "Middle East Standard Time":         "Asia/Beirut",
  "Egypt Standard Time":               "Africa/Cairo",
  "Syria Standard Time":               "Asia/Damascus",
  "South Africa Standard Time":        "Africa/Johannesburg",
  "FLE Standard Time":                 "Europe/Kiev",
  "Turkey Standard Time":              "Europe/Istanbul",
  "Israel Standard Time":              "Asia/Jerusalem",
  "Libya Standard Time":               "Africa/Tripoli",
  "Arabic Standard Time":              "Asia/Baghdad",
  "Arab Standard Time":                "Asia/Riyadh",
  "Belarus Standard Time":             "Europe/Minsk",
  "Russian Standard Time":             "Europe/Moscow",
  "E. Africa Standard Time":           "Africa/Nairobi",
  "Iran Standard Time":                "Asia/Tehran",
  "Arabian Standard Time":             "Asia/Dubai",
  "Azerbaijan Standard Time":          "Asia/Baku",
  "Russia Time Zone 3":                "Europe/Samara",
  "Mauritius Standard Time":           "Indian/Mauritius",
  "Georgian Standard Time":            "Asia/Tbilisi",
  "Caucasus Standard Time":            "Asia/Yerevan",
  "Afghanistan Standard Time":         "Asia/Kabul",
  "West Asia Standard Time":           "Asia/Tashkent",
  "Ekaterinburg Standard Time":        "Asia/Yekaterinburg",
  "Pakistan Standard Time":            "Asia/Karachi",
  "India Standard Time":               "Asia/Kolkata",
  "Sri Lanka Standard Time":           "Asia/Colombo",
  "Nepal Standard Time":               "Asia/Kathmandu",
  "Central Asia Standard Time":        "Asia/Almaty",
  "Bangladesh Standard Time":          "Asia/Dhaka",
  "N. Central Asia Standard Time":     "Asia/Novosibirsk",
  "Myanmar Standard Time":             "Asia/Rangoon",
  "SE Asia Standard Time":             "Asia/Bangkok",
  "North Asia Standard Time":          "Asia/Krasnoyarsk",
  "China Standard Time":               "Asia/Shanghai",
  "North Asia East Standard Time":     "Asia/Irkutsk",
  "Singapore Standard Time":           "Asia/Singapore",
  "W. Australia Standard Time":        "Australia/Perth",
  "Taipei Standard Time":              "Asia/Taipei",
  "Ulaanbaatar Standard Time":         "Asia/Ulaanbaatar",
  "Tokyo Standard Time":               "Asia/Tokyo",
  "Korea Standard Time":               "Asia/Seoul",
  "Yakutsk Standard Time":             "Asia/Yakutsk",
  "Cen. Australia Standard Time":      "Australia/Adelaide",
  "AUS Central Standard Time":         "Australia/Darwin",
  "E. Australia Standard Time":        "Australia/Brisbane",
  "AUS Eastern Standard Time":         "Australia/Sydney",
  "West Pacific Standard Time":        "Pacific/Port_Moresby",
  "Tasmania Standard Time":            "Australia/Hobart",
  "Vladivostok Standard Time":         "Asia/Vladivostok",
  "Russia Time Zone 10":               "Asia/Srednekolymsk",
  "Magadan Standard Time":             "Asia/Magadan",
  "New Zealand Standard Time":         "Pacific/Auckland",
  "UTC+12":                            "Etc/GMT-12",
  "Fiji Standard Time":                "Pacific/Fiji",
  "Russia Time Zone 11":               "Asia/Kamchatka",
  "Tonga Standard Time":               "Pacific/Tongatapu",
  "Samoa Standard Time":               "Pacific/Apia",
  "Line Islands Standard Time":        "Pacific/Kiritimati",
};

/**
 * Convert a Windows timezone name to an IANA timezone identifier.
 * Falls back to the original string if no mapping is found (covers IANA strings
 * that Outlook might return directly, e.g. "UTC").
 */
export function windowsToIana(windowsName: string): string {
  return WINDOWS_TO_IANA[windowsName] ?? windowsName;
}

// ── Working-hours types ───────────────────────────────────────────────────────

/** Graph short weekday label → our 3-letter weekday label */
const GRAPH_DAY_TO_SHORT: Record<string, string> = {
  monday:    "Mon",
  tuesday:   "Tue",
  wednesday: "Wed",
  thursday:  "Thu",
  friday:    "Fri",
  saturday:  "Sat",
  sunday:    "Sun",
};

/**
 * Parsed working-hours boundary for a single interviewer.
 * All fields are derived from the Graph workingHours object after timezone conversion.
 */
export interface ParsedWorkingHours {
  /** Short weekday names that are work days, e.g. Set{"Mon","Tue","Wed","Thu","Fri"} */
  workDays: Set<string>;
  /** Local start hour (0-23) in `timezone` */
  startHour: number;
  /** Local start minute (0-59) */
  startMinute: number;
  /** Local end hour (0-23) — slots must end by or at this time */
  endHour: number;
  /** Local end minute (0-59) */
  endMinute: number;
  /** IANA timezone in which the start/end hours are expressed */
  timezone: string;
}

/** Busy interval expressed as UTC epoch milliseconds. */
export interface BusyInterval {
  startMs: number;
  endMs: number;
}

/** Parse an Outlook time string like "08:00:00.0000000" → { hour, minute }. */
function parseOutlookTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

/**
 * Build a ParsedWorkingHours from a Graph workingHours object.
 * Returns null when the object is missing or malformed.
 */
function parseGraphWorkingHours(
  wh: GraphWorkingHours | undefined | null,
): ParsedWorkingHours | null {
  if (!wh?.daysOfWeek?.length || !wh.startTime || !wh.endTime || !wh.timeZone?.name) {
    return null;
  }

  const ianaTimezone = windowsToIana(wh.timeZone.name);
  const start = parseOutlookTime(wh.startTime);
  const end   = parseOutlookTime(wh.endTime);

  const workDays = new Set<string>();
  for (const day of wh.daysOfWeek) {
    const short = GRAPH_DAY_TO_SHORT[day.toLowerCase()];
    if (short) workDays.add(short);
  }

  if (workDays.size === 0) return null;

  return {
    workDays,
    startHour:   start.hour,
    startMinute: start.minute,
    endHour:     end.hour,
    endMinute:   end.minute,
    timezone:    ianaTimezone,
  };
}

/** Default fallback when working hours are not returned by Graph. */
const DEFAULT_WORKING_HOURS: ParsedWorkingHours = {
  workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
  startHour:   9,
  startMinute: 0,
  endHour:     18,
  endMinute:   0,
  timezone:    "UTC", // caller's displayTimezone is used when this is the fallback
};

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

interface GraphWorkingHours {
  daysOfWeek: string[];               // e.g. ["monday","tuesday","wednesday","thursday","friday"]
  startTime: string;                  // e.g. "08:00:00.0000000"
  endTime: string;                    // e.g. "17:00:00.0000000"
  timeZone: { name: string };         // Windows TZ name, e.g. "Pacific Standard Time"
}

interface GraphScheduleResponse {
  value: Array<{
    scheduleId: string;
    scheduleItems?: GraphScheduleItem[];
    workingHours?: GraphWorkingHours;
    error?: { message: string; code?: string };
  }>;
}

/** Parse a Graph dateTime object into a UTC epoch. Graph returns timestamps without "Z" for UTC. */
function parseGraphDateTime(dt: { dateTime: string; timeZone: string }): number {
  const str = dt.timeZone.toUpperCase() === "UTC" ? `${dt.dateTime}Z` : dt.dateTime;
  return new Date(str).getTime();
}

interface ScheduleData {
  busyItems: GraphScheduleItem[];
  workingHours: GraphWorkingHours | null;
}

/**
 * Fetch free/busy schedule and working hours from Graph `getSchedule`.
 * Returns only non-free busy items plus the raw workingHours object.
 * Throws on network/auth failures; the caller handles 502/503 responses.
 */
async function fetchScheduleData(
  calendarEmail: string,
  rangeStartUtc: Date,
  rangeEndUtc: Date,
  intervalMinutes: number,
): Promise<ScheduleData> {
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
  if (!entry) return { busyItems: [], workingHours: null };

  if (entry.error) {
    throw new Error(
      `Graph returned error for ${calendarEmail}: [${entry.error.code ?? "?"}] ${entry.error.message}`,
    );
  }

  const busyItems = (entry.scheduleItems ?? []).filter((item) => item.status !== "free");
  const workingHours = entry.workingHours ?? null;

  return { busyItems, workingHours };
}

/** True when [slotStart, slotEnd) and [busyStart, busyEnd) overlap. */
function overlaps(slotStartMs: number, slotEndMs: number, busyStartMs: number, busyEndMs: number): boolean {
  return slotStartMs < busyEndMs && slotEndMs > busyStartMs;
}

// ── Date string helpers ───────────────────────────────────────────────────────

/**
 * Return the 3-letter weekday name ("Mon"…"Sun") for a YYYY-MM-DD calendar
 * date, independently of any timezone.  Parsing at noon UTC guarantees the
 * Date object falls on the correct calendar day everywhere.
 */
function weekdayOfDateStr(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
  });
}

/** Advance a YYYY-MM-DD string by one calendar day. */
function nextDateStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Slot generation (pure, exported for unit testing) ─────────────────────────

/**
 * Generate available slots from pre-fetched schedule data.
 *
 * This is the pure core of the slot-generation algorithm and is exported so
 * unit tests can exercise it without making network calls.
 *
 * ## Design
 * We iterate over working-hours-timezone (whTz) calendar dates rather than
 * display-timezone dates.  This is critical: if we walked display-timezone
 * midnights and used each midnight to determine the whTz weekday we would
 * silently drop a full work day whenever the display timezone is behind the
 * working-hours timezone (e.g. display=UTC, wh=America/Los_Angeles — UTC
 * midnight is still Sunday in LA so Monday's slots are never generated).
 *
 * Algorithm:
 * 1. Compute the UTC bounds of the requested display-date range.
 * 2. Expand those bounds by one day on each side (in whTz) so we never miss
 *    a working-day window that straddles a UTC date boundary.
 * 3. For each whTz calendar date in the expanded range that is a work day,
 *    generate candidate slots within the configured work window.
 * 4. Keep only slots whose UTC start falls inside the requested UTC range.
 * 5. Filter out busy intervals and return.
 *
 * @param workingHours  - Parsed working-hours boundary from Graph (or default).
 * @param busyIntervals - Non-free calendar blocks as UTC epoch ms pairs.
 * @param startDate     - First display-timezone date to include (YYYY-MM-DD).
 * @param endDate       - Last display-timezone date to include (YYYY-MM-DD), inclusive.
 * @param durationMinutes - Slot length in minutes.
 * @param displayTimezone - IANA timezone for startDisplay/endDisplay/date fields.
 */
export function buildSlotsFromScheduleData(
  workingHours: ParsedWorkingHours,
  busyIntervals: BusyInterval[],
  startDate: string,
  endDate: string,
  durationMinutes: number,
  displayTimezone: string,
): AvailableSlot[] {
  const whTz = workingHours.timezone;

  // UTC bounds of the caller-requested display date range (exclusive upper bound)
  const rangeStartUtcMs = localToUtc(startDate, 0, 0, displayTimezone).getTime();
  const rangeEndUtcMs   = new Date(localToUtc(endDate, 23, 59, displayTimezone).getTime() + 60_000).getTime();

  // Working-hours-timezone calendar dates that could contribute slots.
  // Expand ±1 day to handle any UTC offset between whTz and displayTimezone.
  let whCursor    = getLocalDateStr(rangeStartUtcMs - 24 * 60 * 60_000, whTz);
  const whIterEnd = getLocalDateStr(rangeEndUtcMs   + 24 * 60 * 60_000, whTz);

  const slots: AvailableSlot[] = [];

  while (whCursor <= whIterEnd) {
    if (workingHours.workDays.has(weekdayOfDateStr(whCursor))) {
      const dayWorkStart = localToUtc(whCursor, workingHours.startHour, workingHours.startMinute, whTz);
      const dayWorkEnd   = localToUtc(whCursor, workingHours.endHour,   workingHours.endMinute,   whTz);

      let slotStart = dayWorkStart;
      while (slotStart.getTime() < dayWorkEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
        if (slotEnd.getTime() > dayWorkEnd.getTime()) break;

        const startMs = slotStart.getTime();
        const endMs   = slotEnd.getTime();

        // Only keep slots whose start falls within the requested display range.
        if (startMs >= rangeStartUtcMs && startMs < rangeEndUtcMs) {
          const isBusy = busyIntervals.some((iv) =>
            overlaps(startMs, endMs, iv.startMs, iv.endMs),
          );

          if (!isBusy) {
            slots.push({
              start:        slotStart.toISOString(),
              end:          slotEnd.toISOString(),
              startDisplay: formatTimeDisplay(startMs, displayTimezone),
              endDisplay:   formatTimeDisplay(endMs, displayTimezone),
              date:         getLocalDateStr(startMs, displayTimezone),
            });
          }
        }

        slotStart = new Date(slotStart.getTime() + durationMinutes * 60_000);
      }
    }

    whCursor = nextDateStr(whCursor);
  }

  // Sort by start time — iterating whTz dates can produce slots that are
  // slightly out of chronological order at DST transitions.
  slots.sort((a, b) => a.start.localeCompare(b.start));

  return slots;
}

// ── Public slot query ─────────────────────────────────────────────────────────

/**
 * Query real interviewer availability from Microsoft Graph and return
 * available interview slot windows.
 *
 * The function:
 * 1. Calls Graph `getSchedule` for the full date range.
 * 2. Reads the interviewer's workingHours from the response (days + start/end time + timezone).
 * 3. Generates candidate slots within those working hours, falling back to 9 AM – 6 PM
 *    Mon–Fri if workingHours are absent.
 * 4. Filters out any candidate slot that overlaps a busy/tentative calendar item.
 * 5. Returns available slots in UTC ISO + display strings in the requested timezone.
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

  // Expand query range to cover full working days in the display timezone
  const rangeStart = localToUtc(startDate, 0, 0, timezone);
  const rangeEnd   = new Date(localToUtc(endDate, 23, 59, timezone).getTime() + 60_000);

  const { busyItems, workingHours: rawWorkingHours } = await fetchScheduleData(
    calendarEmail,
    rangeStart,
    rangeEnd,
    durationMinutes,
  );

  // Parse working hours returned by Graph; fall back to defaults if absent.
  const parsedWh = parseGraphWorkingHours(rawWorkingHours);
  const effectiveWh: ParsedWorkingHours = parsedWh
    ? parsedWh
    : { ...DEFAULT_WORKING_HOURS, timezone }; // default uses the display timezone as-is

  // Convert Graph busy items to plain UTC-ms intervals for buildSlotsFromScheduleData.
  const busyIntervals: BusyInterval[] = busyItems.map((item) => ({
    startMs: parseGraphDateTime(item.start),
    endMs:   parseGraphDateTime(item.end),
  }));

  return buildSlotsFromScheduleData(effectiveWh, busyIntervals, startDate, endDate, durationMinutes, timezone);
}
