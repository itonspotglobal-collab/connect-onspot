export const ACTIVITY_TYPES = ["work", "lunch", "break", "meeting"] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];
export type TimeBreakdown = {
  workSeconds: number; meetingSeconds: number; lunchSeconds: number; breakSeconds: number;
  paidSeconds: number; unpaidSeconds: number;
};
export const emptyBreakdown = (): TimeBreakdown => ({
  workSeconds: 0, meetingSeconds: 0, lunchSeconds: 0, breakSeconds: 0, paidSeconds: 0, unpaidSeconds: 0,
});
export function addBreakdown(target: TimeBreakdown, source: TimeBreakdown) {
  for (const key of Object.keys(target) as (keyof TimeBreakdown)[]) target[key] += source[key];
  return target;
}
export function workDate(instant: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)!.value).join("-");
}
function nextMidnight(date: string, zone: string) {
  const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const target = next.toISOString().slice(0, 10);
  let lo = Date.parse(`${target}T00:00:00Z`) - 48 * 3600_000, hi = lo + 96 * 3600_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (workDate(new Date(mid), zone) >= target) hi = mid; else lo = mid;
  }
  return hi;
}
const millis = (value: any) => value == null ? NaN : new Date(value).getTime();
export function serializeActivity(row: any, now: Date) {
  const type = row.activity_type ?? row.type;
  const startedAt = row.started_at ?? row.startedAt;
  const endedAt = row.ended_at ?? row.endedAt ?? null;
  const maxMinutes = row.max_minutes ?? row.maxMinutes ?? null;
  return { id: row.id, type, startedAt, endedAt, isPaid: row.is_paid ?? row.isPaid,
    maxMinutes, overLimit: maxMinutes != null && ((endedAt ? millis(endedAt) : now.getTime()) - millis(startedAt)) > maxMinutes * 60_000 };
}
/** One canonical paid-time calculation. Bounds are half-open UTC instants; days use the work zone. */
export function sessionPaidTime(session: any, activities: any[], zone: string, options: {
  now?: Date; start?: Date; end?: Date; includeOpen?: boolean;
} = {}) {
  const now = options.now ?? new Date();
  const startValue = session.started_at ?? session.startedAt;
  const exception = session.exception_status ?? session.exceptionStatus;
  const effectiveEnd = session.effective_end_at ?? session.effectiveEndAt
    ?? (exception === "approved" ? session.approved_end_at ?? session.approvedEndAt ?? session.ended_at ?? session.endedAt : session.ended_at ?? session.endedAt);
  const lower = Math.max(millis(startValue), options.start?.getTime() ?? -Infinity);
  const upper = Math.min(millis(effectiveEnd ?? (options.includeOpen ? now : null)), options.end?.getTime() ?? Infinity);
  const totals = emptyBreakdown(), days = new Map<string, TimeBreakdown>();
  const segments: Array<{ date: string; type: ActivityType; startedAt: string; endedAt: string; isPaid: boolean; seconds: number }> = [];
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower
    || (exception && exception !== "approved" && !session.source)) return { ...totals, days: [], segments };
  const rows = activities.length ? activities : [{ activity_type: "work", started_at: startValue, ended_at: effectiveEnd, is_paid: true }];
  const sorted = rows.map(row => serializeActivity(row, now)).sort((a, b) => millis(a.startedAt) - millis(b.startedAt));
  let previousEnd = lower;
  for (const activity of sorted) {
    if (!ACTIVITY_TYPES.includes(activity.type)) throw new Error("Invalid clock activity type");
    let cursor = Math.max(lower, millis(activity.startedAt));
    const finish = Math.min(upper, activity.endedAt ? millis(activity.endedAt) : upper);
    if (finish <= cursor) continue;
    if (cursor < previousEnd) throw new Error("Overlapping clock activities");
    previousEnd = finish;
    while (cursor < finish) {
      const date = workDate(new Date(cursor), zone);
      const end = Math.min(finish, nextMidnight(date, zone));
      if (end <= cursor) throw new Error("Invalid work-day boundary");
      const seconds = (end - cursor) / 1000, day = days.get(date) ?? emptyBreakdown();
      const field = `${activity.type}Seconds` as keyof TimeBreakdown;
      day[field] += seconds; day[activity.isPaid ? "paidSeconds" : "unpaidSeconds"] += seconds;
      days.set(date, day);
      segments.push({ date, type: activity.type, startedAt: new Date(cursor).toISOString(),
        endedAt: new Date(end).toISOString(), isPaid: !!activity.isPaid, seconds });
      cursor = end;
    }
  }
  for (const day of Array.from(days.values())) addBreakdown(totals, day);
  return { ...totals, days: Array.from(days).map(([date, breakdown]) => ({ date, ...breakdown })), segments };
}

export function contractBreakRules(row: any) {
  return { lunchPaid: row.lunch_paid ?? false, breakPaid: row.break_paid ?? true, meetingPaid: row.meeting_paid ?? true,
    lunchMaxMinutes: row.lunch_max_minutes ?? 60, breakMaxMinutes: row.break_max_minutes ?? 15, breaksPerDay: row.breaks_per_day ?? 2 };
}
export const activityRowsSql = `SELECT * FROM clock_session_activities WHERE clock_session_id = ANY($1::uuid[]) ORDER BY started_at`;

/** Invoices consume the immutable approval snapshot, not mutable clock metadata. */
export async function revisionPaidHours(
  query: (sql: string, values?: any[]) => Promise<{ rows: any[] }>,
  revisionId: string, start: Date | string | null = null, end: Date | string | null = null,
) {
  const rows = (await query(`SELECT started_at,effective_end_at,activity_snapshot
    FROM timesheet_revision_sessions WHERE revision_id=$1
    AND effective_end_at>COALESCE($2::timestamptz,started_at)
    AND started_at<COALESCE($3::timestamptz,effective_end_at)`, [revisionId, start, end])).rows;
  return rows.reduce((seconds, row) => seconds + sessionPaidTime(row, row.activity_snapshot ?? [], "UTC", {
    start: start ? new Date(start) : undefined, end: end ? new Date(end) : undefined,
  }).paidSeconds, 0) / 3600;
}
