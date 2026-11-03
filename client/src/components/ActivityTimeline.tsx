import { formatElapsed, elapsedSeconds } from "@/lib/workClockTime";

export type ClockActivityType = "work" | "lunch" | "break" | "meeting";
export type ClockActivity = {
  id?: string;
  type: ClockActivityType;
  startedAt: string | Date;
  endedAt?: string | Date | null;
  isPaid?: boolean;
  overLimit?: boolean;
  maxMinutes?: number | null;
};

const activityStyle: Record<ClockActivityType, { label: string; bar: string; dot: string }> = {
  work: { label: "Work", bar: "bg-sky-500", dot: "bg-sky-600" },
  meeting: { label: "Meeting", bar: "bg-violet-500", dot: "bg-violet-600" },
  lunch: { label: "Lunch", bar: "bg-amber-400", dot: "bg-amber-500" },
  break: { label: "Break", bar: "bg-rose-400", dot: "bg-rose-500" },
};

export function ActivityTrace({ activities, now = Date.now() }: { activities?: ClockActivity[]; now?: string | number | Date }) {
  const trace = activities ?? [];
  if (!trace.length) return <p className="text-xs text-muted-foreground">Activity detail will appear here as the session is recorded.</p>;
  const current = typeof now === "string" ? new Date(now) : now;
  const durations = trace.map((activity) => Math.max(1, elapsedSeconds(
    activity.startedAt,
    activity.endedAt instanceof Date ? activity.endedAt : activity.endedAt ? new Date(activity.endedAt) : current,
  )));
  const total = durations.reduce((sum, value) => sum + value, 0);
  return <div>
    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Session activity timeline">
      {trace.map((activity, index) => <span key={activity.id || `${activity.startedAt}-${index}`} className={`${activityStyle[activity.type].bar} ${activity.overLimit ? "opacity-60" : ""}`} style={{ width: `${Math.max(1.5, durations[index] / total * 100)}%` }} title={`${activityStyle[activity.type].label}${activity.overLimit ? " · over limit" : ""}`} />)}
    </div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {trace.map((activity, index) => <span key={activity.id || `${activity.startedAt}-legend-${index}`} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${activityStyle[activity.type].dot}`} />
        {activityStyle[activity.type].label} · {formatElapsed(durations[index])}
        {activity.overLimit && <span className="font-semibold text-amber-700">Over limit</span>}
      </span>)}
    </div>
  </div>;
}

export function ActivityBreakdown({ breakdown }: { breakdown?: Partial<Record<"workSeconds" | "meetingSeconds" | "lunchSeconds" | "breakSeconds" | "paidSeconds" | "unpaidSeconds", number>> | null }) {
  if (!breakdown) return null;
  const rows: Array<[string, number | undefined]> = [
    ["Work", breakdown.workSeconds],
    ["Meeting", breakdown.meetingSeconds],
    ["Lunch", breakdown.lunchSeconds],
    ["Break", breakdown.breakSeconds],
    ["Paid", breakdown.paidSeconds],
  ];
  const presentRows = rows.filter(([, value]) => value != null);
  if (!presentRows.length) return null;
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-5">
    {presentRows.map(([label, seconds]) => <div key={label}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">{formatElapsed(Math.max(0, seconds ?? 0))}</dd>
    </div>)}
  </dl>;
}
