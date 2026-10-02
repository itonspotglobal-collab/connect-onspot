export interface DashboardClockSession {
  id: string;
  hiringContractId: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  approvedEndAt: string | Date | null;
  exceptionStatus: string | null;
  exceptionType?: string | null;
}

export interface DashboardTrackedContract {
  id: string;
  workTimezone: string | null;
  effectiveStartDate: string | null;
  proposedStartDate: string | null;
  effectiveEndDate: string | null;
}

export interface ModernDashboardActivity {
  hoursLogged: number;
  weeklyActivity: number[];
  isCurrentlyClockedIn: boolean;
  incompleteSessionCount: number;
}

export type DashboardHoursTracking = "tracked" | "not_tracked";

export function getDashboardHoursTracking(
  hasLegacyTimeTracking: boolean,
  modernTrackedContractCount: number,
): DashboardHoursTracking {
  return hasLegacyTimeTracking || modernTrackedContractCount > 0 ? "tracked" : "not_tracked";
}

export function getDashboardWeeklyTargetHours(
  hoursTracking: DashboardHoursTracking,
  engagementType: string | null,
): number {
  if (hoursTracking === "not_tracked") return 0;
  return engagementType === "Lite" ? 20 : 40;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const localMidnightCache = new Map<string, Date>();

export function normalizeDashboardHours(hours: number): number {
  return Math.round(hours * 10_000) / 10_000;
}

function parseInstant(value: unknown): Date | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Use raw Talent clock-in/out events, never an admin-reviewed effective end. */
export function latestDashboardActivityAt(
  legacyActivityAt: unknown,
  modernClockActivityAt: unknown,
  now: Date,
): Date | null {
  const legacy = parseInstant(legacyActivityAt);
  const modern = parseInstant(modernClockActivityAt);
  const validModern = modern && modern <= now ? modern : null;
  if (!legacy) return validModern;
  if (!validModern || legacy >= validModern) return legacy;
  return validModern;
}

function parseDateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dateInZone(instant: Date, timezone: string): string {
  let formatter = dateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validTimezone(value: string | null): string {
  // Modern sessions use the signed job's IANA work timezone. Missing/invalid
  // contract zones use deterministic UTC; legacy entries retain their existing
  // database-session-timezone calculation in the dashboard SQL.
  if (!value) return "UTC";
  try {
    if (!dateFormatters.has(value)) {
      dateFormatters.set(value, new Intl.DateTimeFormat("en-CA", {
        timeZone: value,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }));
    }
    return value;
  } catch {
    return "UTC";
  }
}

function firstInstantOfDate(date: string, timezone: string): Date {
  // Binary search the first instant at which the local date reaches `date`.
  // Unlike applying a fixed UTC offset, this remains correct across DST and
  // zones whose local transition occurs at midnight.
  const key = `${timezone}|${date}`;
  const cached = localMidnightCache.get(key);
  if (cached) return new Date(cached.getTime());
  const center = Date.parse(`${date}T00:00:00.000Z`);
  let low = center - 48 * 60 * 60 * 1000;
  let high = center + 48 * 60 * 60 * 1000;
  if (!Number.isFinite(low) || !Number.isFinite(high)) throw new Error("Invalid dashboard calendar date");
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateInZone(new Date(middle), timezone) >= date) high = middle;
    else low = middle;
  }
  const result = new Date(high);
  if (localMidnightCache.size >= 512) localMidnightCache.clear();
  localMidnightCache.set(key, result);
  return new Date(result.getTime());
}

function mondayOf(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addCalendarDays(date, -((weekday + 6) % 7));
}

function currentWeekBounds(now: Date, timezone: string) {
  const monday = mondayOf(dateInZone(now, timezone));
  const nextMonday = addCalendarDays(monday, 7);
  return {
    monday,
    nextMonday,
    start: firstInstantOfDate(monday, timezone),
    end: firstInstantOfDate(nextMonday, timezone),
  };
}

/**
 * Sum only modern recorded clock intervals. Raw sessions are the source of
 * truth here; revision snapshots and invoices are intentionally never inputs.
 * Legacy entries are aggregated separately by the dashboard SQL.
 */
export function calculateModernDashboardActivity(
  contracts: DashboardTrackedContract[],
  sessions: DashboardClockSession[],
  now: Date,
): ModernDashboardActivity {
  const nowInstant = new Date(now.getTime());
  const weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
  let isCurrentlyClockedIn = false;
  const incompleteSessionIds = new Set<string>();
  const sessionsByContract = new Map<string, DashboardClockSession[]>();
  for (const session of sessions) {
    const contractSessions = sessionsByContract.get(session.hiringContractId) ?? [];
    contractSessions.push(session);
    sessionsByContract.set(session.hiringContractId, contractSessions);
  }

  for (const contract of contracts) {
    const timezone = validTimezone(contract.workTimezone);
    const bounds = currentWeekBounds(nowInstant, timezone);
    const contractStartDate = parseDateOnly(contract.effectiveStartDate)
      ?? parseDateOnly(contract.proposedStartDate);
    const contractEndDate = parseDateOnly(contract.effectiveEndDate);
    const contractStart = contractStartDate
      ? firstInstantOfDate(contractStartDate, timezone)
      : null;
    // Effective contract end dates are inclusive service dates.
    const contractEnd = contractEndDate
      ? firstInstantOfDate(addCalendarDays(contractEndDate, 1), timezone)
      : null;

    for (const session of sessionsByContract.get(contract.id) ?? []) {
      const startedAt = parseInstant(session.startedAt);
      if (!startedAt || startedAt > nowInstant) continue;
      if (contractEnd && startedAt >= contractEnd) continue;

      // Presence is based only on a genuinely open, exception-free clock.
      // An approved exception with a missing raw clock-out is historical,
      // reviewed work—not proof the Talent is still clocked in.
      if (
        session.exceptionStatus == null
        && session.exceptionType == null
        && session.endedAt == null
        && (!contractStart || startedAt >= contractStart)
        && (!contractEnd || nowInstant < contractEnd)
        && nowInstant.getTime() - startedAt.getTime() < 30 * 60 * 1000
      ) {
        isCurrentlyClockedIn = true;
      }

      let endedAt: Date | null = null;
      if (session.exceptionStatus == null && session.exceptionType == null) {
        endedAt = parseInstant(session.endedAt);
      } else if (session.exceptionStatus === "approved" && session.exceptionType) {
        endedAt = parseInstant(session.approvedEndAt);
      }
      if (
        (session.endedAt == null && session.exceptionStatus !== "approved")
        || (session.exceptionStatus != null && session.exceptionStatus !== "approved")
        || (session.exceptionStatus === "approved" && !endedAt)
        || (endedAt != null && endedAt <= startedAt)
        || (endedAt != null && endedAt > nowInstant)
      ) {
        incompleteSessionIds.add(session.id);
      }
      // Open, unresolved, rejected, malformed and non-positive intervals do
      // not contribute hours. In particular, no missing end time is invented.
      if (!endedAt || endedAt <= startedAt || endedAt > nowInstant) continue;

      let clippedStart = new Date(Math.max(startedAt.getTime(), bounds.start.getTime()));
      let clippedEnd = new Date(Math.min(endedAt.getTime(), bounds.end.getTime(), nowInstant.getTime()));
      if (contractStart && clippedStart < contractStart) clippedStart = contractStart;
      if (contractEnd && clippedEnd > contractEnd) clippedEnd = contractEnd;
      if (clippedEnd <= clippedStart) continue;

      let cursor = clippedStart;
      // The seven iterations are an invariant for a seven-day week; the loop
      // also safely handles timezone date skips and malformed extreme spans.
      for (let day = 0; day < 8 && cursor < clippedEnd; day += 1) {
        const localDate = dateInZone(cursor, timezone);
        const index = Math.round(
          (Date.parse(`${localDate}T00:00:00.000Z`) - Date.parse(`${bounds.monday}T00:00:00.000Z`))
          / DAY_MS,
        );
        const nextMidnight = firstInstantOfDate(addCalendarDays(localDate, 1), timezone);
        const segmentEnd = new Date(Math.min(clippedEnd.getTime(), nextMidnight.getTime()));
        if (index >= 0 && index < 7 && segmentEnd > cursor) {
          weeklyActivity[index] += (segmentEnd.getTime() - cursor.getTime()) / (60 * 60 * 1000);
        }
        if (segmentEnd <= cursor) break;
        cursor = segmentEnd;
      }
    }
  }

  const normalizedWeeklyActivity = weeklyActivity.map(normalizeDashboardHours);
  return {
    hoursLogged: normalizeDashboardHours(
      normalizedWeeklyActivity.reduce((total, hours) => total + hours, 0),
    ),
    weeklyActivity: normalizedWeeklyActivity,
    isCurrentlyClockedIn,
    incompleteSessionCount: incompleteSessionIds.size,
  };
}