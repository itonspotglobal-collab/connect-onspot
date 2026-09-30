import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  Info,
  MessageSquare,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

type MemberStatus = "online" | "away" | "offline";

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  team?: string;
  status: MemberStatus;
  timezone: string;
  latestActivityAt: string | null;
  project: string;
  projectCount: number;
  contractWarning?: string;
  rating: number | null;
  hoursLogged: number;
  weeklyTargetHours: number;
  weeklyActivity: number[];
  rate: number | null;
  rateCurrency: string | null;
  ratePeriod: string | null;
  engagementType: string | null;
  spendByCurrency: Array<{ currency: string; amount: number }>;
}

interface TeamDashboardData {
  organization: { id: string; name: string };
  summary: {
    teamMembers: number;
    activeProjects: number;
    hoursLogged: number;
    weeklyCapacityHours: number;
    needsAttention: number;
  };
  members: TeamMember[];
  spendByCurrency: Array<{ currency: string; total: number; thisWeek: number }>;
  roi: {
    benchmarkAvailable: boolean;
    totalSpendByCurrency: Array<{ currency: string; amount: number }>;
    thisWeekSpendByCurrency: Array<{ currency: string; amount: number }>;
    savingsByCurrency: Array<{ currency: string; amount: number }>;
  };
}

interface SummaryMetric {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone: "indigo" | "blue" | "violet" | "amber";
}

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

function TeamHeader({ data }: { data: TeamDashboardData }) {
  const activeNow = data.members.filter((member) => member.status === "online").length;
  return (
    <header className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-[#f3f3ff] via-white to-[#eef7ff] px-5 py-6 shadow-[0_12px_35px_-24px_rgba(67,56,202,0.45)] sm:px-7">
      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-200/25 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            {data.organization.name}
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">My Team</h1>
          <p className="mt-2 text-sm text-slate-600">Overview of your remote employees and their activity</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Team status summary">
          <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700">{activeNow} active now</span>
          <span className="rounded-full border border-indigo-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700">{data.summary.teamMembers} team member{data.summary.teamMembers === 1 ? "" : "s"}</span>
          <span className="rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-700">{data.summary.needsAttention} contract{data.summary.needsAttention === 1 ? "" : "s"} need attention</span>
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

function formatLocalTime(member: TeamMember) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: member.timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return "Local time unavailable";
  }
}

function formatActivity(member: TeamMember) {
  if (!member.latestActivityAt) return "No activity recorded";
  const activityDate = new Date(member.latestActivityAt);
  if (member.status === "online" && Date.now() - activityDate.getTime() < 30 * 60_000) {
    return "Active now";
  }
  return `Last active ${activityDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function TeamMemberCard({ member, onAction }: { member: TeamMember; onAction: (name: string) => void }) {
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
              <span>{member.timezone} · {formatLocalTime(member)}</span>
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
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latest activity</p><p className="mt-1 text-xs font-medium text-slate-700">{formatActivity(member)}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Rating</p>{member.rating == null ? <p className="mt-1 text-xs text-slate-500">Not rated</p> : <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{member.rating.toFixed(1)} <span className="font-normal text-slate-400">/ 5</span></p>}</div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600">Weekly hours</span><span className="font-semibold text-slate-900">{member.hoursLogged} <span className="font-normal text-slate-400">/ {member.weeklyTargetHours}h</span></span></div>
        <Progress value={progress} className="mt-2 h-1.5 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-violet-500" />
        <ActivityStrip values={member.weeklyActivity} />
        <div className="mt-4 flex gap-2">
          <a href="/client/timesheets" className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">View timesheets</a>
          <Button type="button" size="sm" className="flex-1 bg-[#474ead] text-xs text-white hover:bg-[#3e439c]" onClick={() => onAction(member.name)}><MessageSquare className="h-3.5 w-3.5" />Message</Button>
        </div>
      </div>
    </Card>
  );
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatSpendList(spend: Array<{ currency: string; amount: number }>) {
  if (!spend.length) return "No billed spend recorded";
  return spend.map((item) => formatMoney(item.amount, item.currency)).join(" · ");
}

function formatMemberRate(member: TeamMember) {
  if (member.rate == null || !member.rateCurrency) return "Rate not available";
  const period = member.ratePeriod === "hourly"
    ? "hour"
    : `${member.engagementType || "contract"} period`;
  return `${formatMoney(member.rate, member.rateCurrency)} / ${period}`;
}

function TeamROI({ data }: { data: TeamDashboardData }) {
  const totalSpend = data.roi.totalSpendByCurrency;
  const thisWeekSpend = data.roi.thisWeekSpendByCurrency;
  const totalValue = totalSpend.reduce((sum, item) => sum + item.amount, 0);
  const bars = [
    { label: "This week", value: formatSpendList(thisWeekSpend), amount: thisWeekSpend.reduce((sum, item) => sum + item.amount, 0), color: "bg-indigo-500" },
    { label: "Billed to date", value: formatSpendList(totalSpend), amount: totalValue, color: "bg-slate-300" },
  ];
  const maxBar = Math.max(...bars.map((bar) => bar.amount), 1);
  return (
    <section>
      <SectionHeading eyebrow="Efficiency snapshot" title="Return on investment" detail="Based on organization billing data" />
      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <Card className="relative overflow-hidden border-indigo-200 bg-gradient-to-br from-[#383d9a] via-[#4d4ab0] to-[#4f72c7] p-5 text-white shadow-[0_18px_38px_-24px_rgba(67,56,202,0.7)] sm:p-6">
          <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full border-[22px] border-white/10" aria-hidden="true" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-100">Total billed for this team</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.04em]">{formatSpendList(totalSpend)}</p>
            <p className="mt-1 text-xs text-indigo-100">Across this organization&apos;s active engagements</p>
            <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
              <div><p className="text-lg font-semibold">{data.summary.activeProjects}</p><p className="mt-0.5 text-[11px] text-indigo-100">active projects</p></div>
              <div><p className="text-lg font-semibold">{data.summary.hoursLogged.toFixed(1)}h</p><p className="mt-0.5 text-[11px] text-indigo-100">logged this week</p></div>
            </div>
          </div>
        </Card>
        <Card className="border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Spend tracking</h3><span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">Live billing records</span></div>
          <div className="mt-6 space-y-5">
            {bars.map((bar) => <div key={bar.label}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="font-medium text-slate-600">{bar.label}</span><span className="text-right font-semibold text-slate-900">{bar.value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${bar.color}`} style={{ width: `${Math.max((bar.amount / maxBar) * 100, bar.amount ? 4 : 0)}%` }} /></div></div>)}
          </div>
          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />{data.roi.benchmarkAvailable ? "Savings are calculated from the organization benchmark." : "A local-market benchmark is not available yet, so savings are not estimated."}</p>
        </Card>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {data.members.map((member) => <Card key={member.id} className="border-slate-200/80 bg-white p-4"><p className="text-sm font-semibold text-slate-900">{member.name}</p><p className="mt-2 text-xs text-slate-500"><span className="font-semibold text-indigo-700">{formatMemberRate(member)}</span></p><div className="mt-4 flex items-end justify-between gap-3"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Billed to date</span><span className="text-right text-lg font-semibold tracking-tight text-slate-900">{formatSpendList(member.spendByCurrency)}</span></div></Card>)}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">ROI savings remain unavailable until a benchmark is configured. This view reports only organization-scoped billing records and does not infer a market rate.</p>
    </section>
  );
}

export default function ClientTeamDashboard() {
  const { selectedOrganizationId } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery<TeamDashboardData>({
    queryKey: ["/api/client/team-dashboard", selectedOrganizationId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/client/team-dashboard?organizationId=${encodeURIComponent(selectedOrganizationId!)}`,
      );
      return response.json();
    },
    enabled: Boolean(selectedOrganizationId),
    staleTime: 30_000,
  });
  const handleAction = useCallback((name: string) => {
    toast({ title: "Messaging is coming soon", description: `A connection to ${name} will be available later.` });
  }, []);

  if (!selectedOrganizationId) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1500px] items-center justify-center">
        <Card className="max-w-lg border-indigo-100 bg-white p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-indigo-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Select an organization</h1>
          <p className="mt-2 text-sm text-slate-600">Choose an organization from your account menu to see its team activity.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-7 pb-8" aria-label="Loading team dashboard">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-96 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1500px] items-center justify-center">
        <Card className="max-w-lg border-red-100 bg-white p-8 text-center">
          <Activity className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Team activity could not load</h1>
          <p className="mt-2 text-sm text-slate-600">{error instanceof Error ? error.message : "Please try again."}</p>
          <Button type="button" className="mt-5 bg-[#474ead] text-white hover:bg-[#3e439c]" onClick={() => refetch()}>Try again</Button>
        </Card>
      </div>
    );
  }

  const spendThisWeek = data.spendByCurrency.map(({ currency, thisWeek }) => ({ currency, amount: thisWeek }));
  const capacityPercent = data.summary.weeklyCapacityHours > 0
    ? Math.round((data.summary.hoursLogged / data.summary.weeklyCapacityHours) * 100)
    : 0;
  const metrics: SummaryMetric[] = [
    { label: "Team members", value: String(data.summary.teamMembers), detail: `${data.summary.activeProjects} active project${data.summary.activeProjects === 1 ? "" : "s"}`, icon: Users, tone: "indigo" },
    { label: "Hours logged", value: `${data.summary.hoursLogged.toFixed(1)}h`, detail: `${capacityPercent}% of weekly capacity`, icon: Clock3, tone: "blue" },
    { label: "Spend this week", value: formatSpendList(spendThisWeek), detail: "From organization billing records", icon: Wallet, tone: "violet" },
    { label: "Needs attention", value: String(data.summary.needsAttention), detail: "Contracts ending soon", icon: Activity, tone: "amber" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-7 pb-8">
      <TeamHeader data={data} />
      <div className="-mt-4 flex justify-end"><a href="/client/timesheets" className="inline-flex items-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">Review timesheets</a></div>
      <section>
        <SectionHeading eyebrow="This week at a glance" title="Your team, in focus" detail="Current reporting period" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <SummaryMetricCard key={metric.label} metric={metric} />)}</div>
      </section>
      <section>
        <SectionHeading eyebrow="Distributed team" title="Team members" detail="Activity across your organization" />
        {data.members.length === 0 ? (
          <Card className="border-dashed border-slate-300 bg-white p-10 text-center">
            <Users className="mx-auto h-9 w-9 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">No active team members yet</h3>
            <p className="mt-1 text-sm text-slate-500">Signed contracts for this organization will appear here once a team member is onboarded.</p>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">{data.members.map((member) => <TeamMemberCard key={member.id} member={member} onAction={handleAction} />)}</div>
        )}
      </section>
      {data.members.length > 0 && <TeamROI data={data} />}
    </div>
  );
}