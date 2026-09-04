import { useCallback } from "react";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  DollarSign,
  Info,
  MessageSquare,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

type MemberStatus = "online" | "away" | "offline";

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  team?: string;
  status: MemberStatus;
  activityLabel: string;
  timezone: string;
  localTime: string;
  project: string;
  contractWarning?: string;
  rating: number;
  hoursLogged: number;
  weeklyTargetHours: number;
  weeklyActivity: number[];
  hourlyRate: number;
  localRate: number;
  savedToDate: string;
}

interface SummaryMetric {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone: "indigo" | "blue" | "violet" | "amber";
}

const dashboardData = {
  summary: [
    { label: "Team members", value: "6", detail: "Across 3 active projects", icon: Users, tone: "indigo" },
    { label: "Hours logged", value: "214h", detail: "94% of weekly capacity", icon: Clock3, tone: "blue" },
    { label: "Spend this week", value: "$5,340", detail: "Within planned budget", icon: Wallet, tone: "violet" },
    { label: "Needs attention", value: "2", detail: "Review activity or contracts", icon: Activity, tone: "amber" },
  ] satisfies SummaryMetric[],
  members: [
    {
      id: "maria-cruz",
      name: "Maria Cruz",
      initials: "MC",
      role: "Senior Graphic Designer",
      team: "Branding Team",
      status: "online",
      activityLabel: "Active now",
      timezone: "GMT+8",
      localTime: "10:42 PM",
      project: "Q3 Rebrand",
      rating: 4.9,
      hoursLogged: 36,
      weeklyTargetHours: 40,
      weeklyActivity: [5, 7, 6, 8, 7, 3, 1],
      hourlyRate: 28,
      localRate: 65,
      savedToDate: "$14,820",
    },
    {
      id: "rafael-santos",
      name: "Rafael Santos",
      initials: "RS",
      role: "Backend Developer",
      team: "Platform Team",
      status: "away",
      activityLabel: "Idle · 24 min",
      timezone: "GMT+8",
      localTime: "10:42 PM",
      project: "API Migration",
      contractWarning: "Contract ends in 12 days",
      rating: 4.7,
      hoursLogged: 18,
      weeklyTargetHours: 40,
      weeklyActivity: [4, 5, 3, 2, 4, 0, 0],
      hourlyRate: 34,
      localRate: 78,
      savedToDate: "$11,960",
    },
    {
      id: "anna-torres",
      name: "Anna Torres",
      initials: "AT",
      role: "Customer Support Specialist",
      status: "offline",
      activityLabel: "Offline · 3h ago",
      timezone: "GMT+8",
      localTime: "10:42 PM",
      project: "Tier-1 Support",
      rating: 5.0,
      hoursLogged: 40,
      weeklyTargetHours: 40,
      weeklyActivity: [8, 8, 8, 8, 8, 0, 0],
      hourlyRate: 16,
      localRate: 34,
      savedToDate: "$11,640",
    },
  ] satisfies TeamMember[],
} as const;

const statusCopy: Record<MemberStatus, { label: string; className: string; dot: string }> = {
  online: { label: "Online", className: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  away: { label: "Away", className: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  offline: { label: "Offline", className: "text-slate-500 bg-slate-50 border-slate-200", dot: "bg-slate-400" },
};

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5556b3]">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      </div>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function TeamHeader() {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-[#f3f3ff] via-white to-[#eef7ff] px-5 py-6 shadow-[0_12px_35px_-24px_rgba(67,56,202,0.45)] sm:px-7">
      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-200/25 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Organization workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">My Team</h1>
          <p className="mt-2 text-sm text-slate-600">Overview of your remote employees and their activity</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Team status summary">
          <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700">4 active now</span>
          <span className="rounded-full border border-indigo-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700">6 team members</span>
          <span className="rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-700">1 contract ending soon</span>
        </div>
      </div>
    </header>
  );
}

function SummaryMetricCard({ metric }: { metric: SummaryMetric }) {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-700",
    blue: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };
  const Icon = metric.icon;
  return (
    <Card className="group border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_-22px_rgba(15,23,42,0.5)] transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <span className={`rounded-lg p-2 ${styles[metric.tone]}`}><Icon className="h-4 w-4" /></span>
        <ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">{metric.label}</p>
      <p className="mt-1 text-[11px] text-slate-500">{metric.detail}</p>
    </Card>
  );
}

function ActivityStrip({ values }: { values: number[] }) {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="mt-4" aria-label="Monday to Sunday activity">
      <div className="flex items-end gap-1.5">
        {values.map((value, index) => (
          <div key={`${labels[index]}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-8 w-full items-end rounded-sm bg-slate-100 px-0.5">
              <div className={`w-full rounded-sm ${value === 0 ? "bg-slate-200" : "bg-gradient-to-t from-indigo-500 to-violet-400"}`} style={{ height: `${Math.max(value * 11, 8)}%` }} />
            </div>
            <span className="text-[9px] font-medium text-slate-400">{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamMemberCard({ member, onAction }: { member: TeamMember; onAction: (action: "timesheet" | "message", name: string) => void }) {
  const status = statusCopy[member.status];
  const progress = Math.min((member.hoursLogged / member.weeklyTargetHours) * 100, 100);
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white shadow-[0_10px_28px_-25px_rgba(15,23,42,0.65)] transition-shadow duration-200 hover:shadow-[0_15px_34px_-24px_rgba(67,56,202,0.35)]">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-sm font-bold text-white shadow-sm">{member.initials}</div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`} aria-label={`${status.label} status`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900">{member.name}</h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">{member.role}{member.team ? ` · ${member.team}` : ""}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${status.className}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</span>
              <span>{member.timezone} · {member.localTime}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50/60 text-[11px] font-medium text-indigo-700">{member.project}</Badge>
          {member.contractWarning && <Badge variant="outline" className="border-amber-200 bg-amber-50/70 text-[11px] font-medium text-amber-700">{member.contractWarning}</Badge>}
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latest activity</p><p className="mt-1 text-xs font-medium text-slate-700">{member.activityLabel}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Rating</p><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{member.rating.toFixed(1)} <span className="font-normal text-slate-400">/ 5</span></p></div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600">Weekly hours</span><span className="font-semibold text-slate-900">{member.hoursLogged} <span className="font-normal text-slate-400">/ {member.weeklyTargetHours}h</span></span></div>
        <Progress value={progress} className="mt-2 h-1.5 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-violet-500" />
        <ActivityStrip values={member.weeklyActivity} />
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1 border-slate-200 text-xs text-slate-700" onClick={() => onAction("timesheet", member.name)}>View timesheet</Button>
          <Button type="button" size="sm" className="flex-1 bg-[#474ead] text-xs text-white hover:bg-[#3e439c]" onClick={() => onAction("message", member.name)}><MessageSquare className="h-3.5 w-3.5" />Message</Button>
        </div>
      </div>
    </Card>
  );
}

function TeamROI() {
  const bars = [{ label: "Your spend", value: "$5,340", width: "38%", color: "bg-indigo-500" }, { label: "Local hire", value: "$14,100", width: "100%", color: "bg-slate-300" }];
  return (
    <section>
      <SectionHeading eyebrow="Efficiency snapshot" title="Return on investment" detail="Presentation data · updated this week" />
      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <Card className="relative overflow-hidden border-indigo-200 bg-gradient-to-br from-[#383d9a] via-[#4d4ab0] to-[#4f72c7] p-5 text-white shadow-[0_18px_38px_-24px_rgba(67,56,202,0.7)] sm:p-6">
          <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full border-[22px] border-white/10" aria-hidden="true" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-100">Total saved with onSpot talent</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.04em]">$38,420</p>
            <p className="mt-1 text-xs text-indigo-100">Since your first hire, Feb 2026</p>
            <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
              <div><p className="text-lg font-semibold">≈ 2.4</p><p className="mt-0.5 text-[11px] text-indigo-100">local hires · equivalent headcount value</p></div>
              <div><p className="text-lg font-semibold">$2,860 / mo</p><p className="mt-0.5 text-[11px] text-indigo-100">average monthly savings</p></div>
            </div>
          </div>
        </Card>
        <Card className="border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Spend comparison</h3><span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">This week</span></div>
          <div className="mt-6 space-y-5">
            {bars.map((bar) => <div key={bar.label}><div className="mb-2 flex justify-between text-xs"><span className="font-medium text-slate-600">{bar.label}</span><span className="font-semibold text-slate-900">{bar.value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${bar.color}`} style={{ width: bar.width }} /></div></div>)}
          </div>
          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />Your team delivers the same weekly capacity at 38% of the estimated local hire cost.</p>
        </Card>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {dashboardData.members.map((member) => <Card key={member.id} className="border-slate-200/80 bg-white p-4"><p className="text-sm font-semibold text-slate-900">{member.name}</p><p className="mt-2 text-xs text-slate-500"><span className="font-semibold text-indigo-700">${member.hourlyRate}/hr</span> vs. ${member.localRate}/hr local market rate</p><div className="mt-4 flex items-end justify-between"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Saved to date</span><span className="text-lg font-semibold tracking-tight text-slate-900">{member.savedToDate}</span></div></Card>)}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Savings are estimated by comparing each hire&apos;s onSpot rate to the average local market rate for the same role and seniority, based on aggregated industry benchmarks.</p>
    </section>
  );
}

export default function ClientTeamDashboard() {
  const handleAction = useCallback((action: "timesheet" | "message", name: string) => {
    toast({ title: action === "timesheet" ? "Timesheets are coming soon" : "Messaging is coming soon", description: `${action === "timesheet" ? "Timesheet access" : "A connection to"} ${name} will be available later.` });
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-7 pb-8">
      <TeamHeader />
      <section>
        <SectionHeading eyebrow="This week at a glance" title="Your team, in focus" detail="Current reporting period" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{dashboardData.summary.map((metric) => <SummaryMetricCard key={metric.label} metric={metric} />)}</div>
      </section>
      <section>
        <SectionHeading eyebrow="Distributed team" title="Team members" detail="Activity across your organization" />
        <div className="grid gap-4 xl:grid-cols-3">{dashboardData.members.map((member) => <TeamMemberCard key={member.id} member={member} onAction={handleAction} />)}</div>
      </section>
      <TeamROI />
    </div>
  );
}