import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Info,
  MessageSquare,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface LatestActivity {
  type: string;
  label: string;
  occurredAt: string;
}

interface TeamMember {
  id: string;
  talentId: string | number;
  submissionId: string | number;
  jobId: string | number;
  name: string;
  initials: string;
  role: string;
  team: string | null;
  projectOrJobTitle: string;
  hireDate: string;
  contractStatus: string;
  contractEndDate: string | null;
  daysUntilContractEnd: number | null;
  latestActivity: LatestActivity | null;
  rating: number | null;
  weeklyHours: number | null;
  weeklyTargetHours: number | null;
  weeklyActivity: number[] | null;
  status: string | null;
}

interface TeamResponse {
  teamMembers: TeamMember[];
}

interface SummaryMetric {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone: "indigo" | "blue" | "violet" | "amber";
}

const CONTRACT_ENDING_SOON_DAYS = 14;

async function fetchTeam(): Promise<TeamResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("onspot_jwt_token") : null;
  const response = await fetch("/api/client/team", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatActivity(activity: LatestActivity | null) {
  if (!activity) return "No activity recorded";
  return `${activity.label} · ${formatDate(activity.occurredAt)}`;
}

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

function TeamHeader({ memberCount, attentionCount }: { memberCount: number; attentionCount: number }) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-[#f3f3ff] via-white to-[#eef7ff] px-5 py-6 shadow-[0_12px_35px_-24px_rgba(67,56,202,0.45)] sm:px-7">
      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-200/25 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-indigo-700"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />Organization workspace</div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">My Team</h1>
          <p className="mt-2 text-sm text-slate-600">Overview of your remote employees and their activity</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Team summary">
          <span className="rounded-full border border-indigo-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700">{memberCount} team {memberCount === 1 ? "member" : "members"}</span>
          <span className="rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-700">{attentionCount} needs attention</span>
        </div>
      </div>
    </header>
  );
}

function SummaryMetricCard({ metric }: { metric: SummaryMetric }) {
  const styles = { indigo: "bg-indigo-50 text-indigo-700", blue: "bg-sky-50 text-sky-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700" };
  const Icon = metric.icon;
  return (
    <Card className="group border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_-22px_rgba(15,23,42,0.5)] transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between"><span className={`rounded-lg p-2 ${styles[metric.tone]}`}><Icon className="h-4 w-4" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">{metric.label}</p>
      <p className="mt-1 text-[11px] text-slate-500">{metric.detail}</p>
    </Card>
  );
}

function ActivityStrip({ values }: { values: number[] | null }) {
  if (!values?.length) return <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-400">Weekly activity is not available yet.</div>;
  const max = Math.max(...values, 1);
  return (
    <div className="mt-4" aria-label="Weekly activity">
      <div className="flex items-end gap-1.5">
        {values.slice(0, 7).map((value, index) => (
          <div key={`${index}-${value}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-8 w-full items-end rounded-sm bg-slate-100 px-0.5"><div className="w-full rounded-sm bg-indigo-400" style={{ height: `${Math.max((value / max) * 100, 8)}%` }} /></div>
            <span className="text-[9px] font-medium text-slate-400">{["M", "T", "W", "T", "F", "S", "S"][index] ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamMemberCard({ member, onAction }: { member: TeamMember; onAction: (action: "timesheet" | "message", name: string) => void }) {
  const contractWarning = member.daysUntilContractEnd !== null && member.daysUntilContractEnd <= CONTRACT_ENDING_SOON_DAYS;
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white shadow-[0_10px_28px_-25px_rgba(15,23,42,0.65)] transition-shadow duration-200 hover:shadow-[0_15px_34px_-24px_rgba(67,56,202,0.35)]">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-sm font-bold text-white shadow-sm">{member.initials}</div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900">{member.name}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{member.role}{member.team ? ` · ${member.team}` : ""}</p>
            <p className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{member.status || member.contractStatus || "Employment status not provided"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50/60 text-[11px] font-medium text-indigo-700">{member.projectOrJobTitle}</Badge>
          {contractWarning && <Badge variant="outline" className="border-amber-200 bg-amber-50/70 text-[11px] font-medium text-amber-700">{member.daysUntilContractEnd === 0 ? "Contract ends today" : `Contract ends in ${member.daysUntilContractEnd} days`}</Badge>}
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Hired</p><p className="mt-1 text-xs font-medium text-slate-700">{formatDate(member.hireDate)}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latest activity</p><p className="mt-1 line-clamp-2 text-xs font-medium text-slate-700">{formatActivity(member.latestActivity)}</p></div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600">Rating</span><span className="flex items-center gap-1 font-semibold text-slate-500">{member.rating === null ? "Not available yet" : <><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{member.rating.toFixed(1)} <span className="font-normal text-slate-400">/ 5</span></>}</span></div>
        <div className="mt-3 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600">Weekly hours</span><span className="font-medium text-slate-500">Not available yet</span></div>
        <ActivityStrip values={member.weeklyActivity} />
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1 border-slate-200 text-xs text-slate-700" onClick={() => onAction("timesheet", member.name)}>View timesheet</Button>
          <Button type="button" size="sm" className="flex-1 bg-[#474ead] text-xs text-white hover:bg-[#3e439c]" onClick={() => onAction("message", member.name)}><MessageSquare className="h-3.5 w-3.5" />Message</Button>
        </div>
      </div>
    </Card>
  );
}

function TeamROIUnavailable() {
  return (
    <section>
      <SectionHeading eyebrow="Efficiency snapshot" title="Return on investment" detail="Connected reporting is not available yet" />
      <Card className="border-slate-200/80 bg-slate-50/70 p-6 sm:p-8">
        <div className="flex max-w-2xl items-start gap-3"><span className="rounded-lg bg-indigo-100 p-2 text-indigo-700"><Info className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-slate-900">Presentation unavailable</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">Spend, savings, and local-market comparisons will appear here once financial reporting is connected. We do not estimate or display figures without source data.</p></div></div>
      </Card>
    </section>
  );
}

function LoadingState() {
  return <div className="grid gap-4 xl:grid-cols-3" aria-label="Loading team members">{[1, 2, 3].map((item) => <Card key={item} className="h-80 animate-pulse border-slate-200/80 bg-white p-5"><div className="flex gap-3"><div className="h-11 w-11 rounded-xl bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-3 w-1/2 rounded bg-slate-100" /><div className="h-3 w-2/3 rounded bg-slate-100" /></div></div><div className="mt-8 space-y-3"><div className="h-3 rounded bg-slate-100" /><div className="h-3 w-3/4 rounded bg-slate-100" /><div className="h-16 rounded bg-slate-100" /></div></Card>)}</div>;
}

export default function ClientTeamDashboard() {
  const { data, isLoading, isError, refetch } = useQuery<TeamResponse>({ queryKey: ["/api/client/team"], queryFn: fetchTeam });
  const members = useMemo(() => data?.teamMembers ?? [], [data]);
  const activeContracts = members.filter((member) => /active/i.test(member.status ?? "") || member.contractStatus === "signed").length;
  const attentionCount = members.filter((member) => member.daysUntilContractEnd !== null && member.daysUntilContractEnd <= CONTRACT_ENDING_SOON_DAYS).length;
  const handleAction = useCallback((action: "timesheet" | "message", name: string) => {
    toast({ title: action === "timesheet" ? "Timesheets are coming soon" : "Messaging is coming soon", description: `${action === "timesheet" ? "Timesheet access" : "A connection to"} ${name} will be available later.` });
  }, []);
  const summary: SummaryMetric[] = [
    { label: "Team members", value: String(members.length), detail: `${activeContracts} active contracts`, icon: Users, tone: "indigo" },
    { label: "Hours logged", value: "—", detail: "Reporting is not connected yet", icon: Clock3, tone: "blue" },
    { label: "Spend this week", value: "—", detail: "Financial reporting is not connected yet", icon: Wallet, tone: "violet" },
    { label: "Needs attention", value: String(attentionCount), detail: "Based on contract end dates only", icon: Activity, tone: "amber" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-7 pb-8">
      <TeamHeader memberCount={members.length} attentionCount={attentionCount} />
      <section><SectionHeading eyebrow="This week at a glance" title="Your team, in focus" detail="Current reporting period" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map((metric) => <SummaryMetricCard key={metric.label} metric={metric} />)}</div></section>
      <section>
        <SectionHeading eyebrow="Distributed team" title="Team members" detail={isLoading ? "Loading live team data" : "Current contracts and activity"} />
        {isLoading && <LoadingState />}
        {isError && <Card className="border-red-200 bg-red-50/60 p-6"><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 text-red-600" /><div><h3 className="text-sm font-semibold text-red-900">We couldn’t load your team</h3><p className="mt-1 text-sm text-red-700">Please try again. Your team data has not been changed.</p><Button type="button" variant="outline" className="mt-4 border-red-200 bg-white text-red-800 hover:bg-red-50" onClick={() => refetch()}>Try again</Button></div></div></Card>}
        {!isLoading && !isError && members.length === 0 && <Card className="border-dashed border-slate-300 bg-slate-50/60 p-10 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><h3 className="mt-3 text-sm font-semibold text-slate-700">No team members yet</h3><p className="mt-1 text-sm text-slate-500">Once a talent is hired, their contract and activity will appear here.</p></Card>}
        {!isLoading && !isError && members.length > 0 && <div className="grid gap-4 xl:grid-cols-3">{members.map((member) => <TeamMemberCard key={member.id} member={member} onAction={handleAction} />)}</div>}
      </section>
      <TeamROIUnavailable />
    </div>
  );
}