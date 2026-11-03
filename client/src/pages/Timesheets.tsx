import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, Clock3, RefreshCw } from "lucide-react";
import { useServerClock } from "@/hooks/useServerClock";
import { elapsedSeconds, formatElapsed, formatWorkTime, isValidTimeZone, workLocalInput, workLocalInputInstant } from "@/lib/workClockTime";
import { ActivityBreakdown, ActivityTrace, type ClockActivity } from "@/components/ActivityTimeline";

type Role = "talent" | "client" | "admin";
type TimeBreakdown = { workSeconds?: number; meetingSeconds?: number; lunchSeconds?: number; breakSeconds?: number; paidSeconds?: number; unpaidSeconds?: number };
type BreakRules = { lunchPaid: boolean; breakPaid: boolean; meetingPaid: boolean; lunchMaxMinutes: number; breakMaxMinutes: number; breaksPerDay: number };
type Session = { id: string; startedAt: string; endedAt: string | null; effectiveEndAt: string | null; proposedEndAt?: string | null; proposalReason?: string | null; resolutionReason?: string | null; requestedHours?: number | null; recordedHours?: number | null; status: string; exceptionStatus?: string | null; activities?: ClockActivity[]; breakdown?: TimeBreakdown };
type ActiveSession = { id: string; hiringContractId: string; startedAt: string; status: string; workTimezone: string | null };
type Correction = { id: string; sessionId: string; requestedStartedAt: string | null; requestedEndAt: string | null; reason: string; status: string; decisionReason: string | null; createdAt: string; decidedAt: string | null };
type ClockAdjustment = { sessionId: string; status: string; startedAt: string; endedAt: string | null; proposedEndAt: string | null; proposalReason: string | null; resolutionReason: string | null; requestedHours: number; recordedHours: number; talentName?: string | null; workTimezone?: string | null; submittedAt?: string | null; escalated?: boolean };
type Workspace = { id: string; name: string };
type Engagement = {
  hiringContractId: string;
  jobTitle: string;
  jobId?: string | null;
  talentId?: string | null;
  talentName?: string | null;
  talentAvatar?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  organizations?: Workspace[];
  billingMode?: string | null;
  contractStatus?: string | null;
};
type Period = {
  id: string; hiringContractId: string; periodStart: string; periodEnd: string; status: string;
  workTimezone: string | null; jobTitle: string; clientName: string | null; days: Array<{ date: string; hours: number } & TimeBreakdown>;
  jobId?: string | null; talentId?: string | null; talentName?: string | null; talentAvatar?: string | null;
  clientId?: string | null; organizations?: Workspace[]; billingMode?: string | null;
  totalHours: number; approvalBlocked: boolean; blockingIssues: string[]; pendingAdjustmentCount?: number; clockAdjustments?: ClockAdjustment[]; sessions: Session[];
  activeSession?: ActiveSession | null; serverNow?: string;
  revisions: Array<{ id: string; version: number; reason: string; exceptionApproved: boolean; createdAt: string }>;
  corrections: Correction[];
  disputes: Array<{ id: string; reason: string; status: string; resolutionReason: string | null; createdAt: string; resolvedAt: string | null }>;
};

const fmt = (instant: string | null | undefined, timezone?: string | null) => {
  if (!instant) return "Not recorded";
  return formatWorkTime(instant, timezone);
};

export default function Timesheets({ role }: { role: Role }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");
  const [talentFilter, setTalentFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [engagementFilter, setEngagementFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [correctionSession, setCorrectionSession] = useState("");
  const [correctionStart, setCorrectionStart] = useState("");
  const [correctionEnd, setCorrectionEnd] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"approve" | "reject" | "edit" | "exception">("approve");
  const [sessionEdits, setSessionEdits] = useState<Record<string, { startedAt: string; endedAt: string }>>({});
  const [correctionDecisions, setCorrectionDecisions] = useState<Record<string, "approve" | "reject">>({});
  const [adjustmentReasons, setAdjustmentReasons] = useState<Record<string, string>>({});
  const [adjustmentRejectionOpen, setAdjustmentRejectionOpen] = useState<Record<string, boolean>>({});
  const endpoint = `/api/${role}/timesheets`;
  const requestedOrganizationId = role === "client" && typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("organizationId")
    : null;
  const queryEndpoint = requestedOrganizationId
    ? `${endpoint}?organizationId=${encodeURIComponent(requestedOrganizationId)}`
    : endpoint;
  const { data, isLoading, isError, error, refetch } = useQuery<{
    periods?: Period[];
    engagements?: Engagement[];
    eligible?: boolean;
    trackedEligible?: boolean;
    serverNow?: string;
  }>({
    queryKey: [queryEndpoint],
    queryFn: async () => (await apiRequest("GET", queryEndpoint)).json(),
    refetchOnWindowFocus: true,
    refetchInterval: role === "talent" ? 60_000 : false,
  });
  const periods = data?.periods ?? [];
  const engagements = data?.engagements ?? [];
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const deepLinkedTalentId = role === "client" ? searchParams.get("talentId") : null;
  const deepLinkedOrganizationId = requestedOrganizationId;
  const filteredPeriods = useMemo(() => periods.filter((item) => {
    if (deepLinkedTalentId && item.talentId && item.talentId !== deepLinkedTalentId) return false;
    if (talentFilter && item.talentId !== talentFilter) return false;
    if (roleFilter && item.jobTitle !== roleFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (engagementFilter && item.hiringContractId !== engagementFilter) return false;
    if (periodFilter && item.id !== periodFilter) return false;
    return true;
  }), [periods, deepLinkedTalentId, talentFilter, roleFilter, statusFilter, engagementFilter, periodFilter]);
  const filteredEngagements = useMemo(() => engagements.filter((item) => {
    if (deepLinkedTalentId && item.talentId && item.talentId !== deepLinkedTalentId) return false;
    if (talentFilter && item.talentId !== talentFilter) return false;
    if (roleFilter && item.jobTitle !== roleFilter) return false;
    if (engagementFilter && item.hiringContractId !== engagementFilter) return false;
    if (statusFilter && statusFilter !== "no-period") return false;
    if (periodFilter) return false;
    return true;
  }), [engagements, deepLinkedTalentId, talentFilter, roleFilter, engagementFilter, statusFilter, periodFilter]);
  const periodContractIds = new Set(periods.map((item) => item.hiringContractId));
  const noPeriodEngagements = filteredEngagements.filter((item) => !periodContractIds.has(item.hiringContractId));
  const activeId = selectedId && filteredPeriods.some((period) => period.id === selectedId) ? selectedId : filteredPeriods[0]?.id;
  const period = useMemo(() => filteredPeriods.find((item) => item.id === activeId), [filteredPeriods, activeId]);
  const rulesQuery = useQuery<{ breakRules: BreakRules }>({
    queryKey: ["/api/admin/hiring-contracts", period?.hiringContractId, "break-rules"],
    queryFn: async () => (await apiRequest("GET", `/api/admin/hiring-contracts/${encodeURIComponent(period!.hiringContractId)}/break-rules`)).json(),
    enabled: role === "admin" && !!period?.hiringContractId,
  });
  const [rulesDraft, setRulesDraft] = useState<BreakRules>({ lunchPaid: false, breakPaid: true, meetingPaid: true, lunchMaxMinutes: 60, breakMaxMinutes: 15, breaksPerDay: 2 });
  useEffect(() => { if (rulesQuery.data?.breakRules) setRulesDraft(rulesQuery.data.breakRules); }, [rulesQuery.data]);
  const saveRules = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/admin/hiring-contracts/${encodeURIComponent(period!.hiringContractId)}/break-rules`, rulesDraft)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hiring-contracts", period?.hiringContractId, "break-rules"] });
      queryClient.invalidateQueries({ queryKey: [queryEndpoint] });
      toast({ title: "Break rules saved", description: "New rules apply to activities started from now on." });
    },
    onError: (err: Error) => toast({ title: "Could not save break rules", description: err.message, variant: "destructive" }),
  });
  const activeEntry = useMemo(() => {
    if (role !== "talent") return null;
    const bySessionId = new Map<string, { session: ActiveSession; period: Period }>();
    periods.forEach((candidate) => {
      const session = candidate.activeSession;
      if (!session || bySessionId.has(session.id)) return;
      bySessionId.set(session.id, { session, period: candidate });
    });
    const entries = Array.from(bySessionId.values());
    return entries.find(({ session }) => periods.some((candidate) => candidate.hiringContractId === session.hiringContractId))
      ?? entries[0]
      ?? null;
  }, [role, periods]);
  const activeSession = activeEntry?.session ?? null;
  const activePeriod = activeSession
    ? periods.find((candidate) => candidate.hiringContractId === activeSession.hiringContractId) ?? activeEntry?.period
    : undefined;
  const activeEngagement = activeSession
    ? engagements.find((candidate) => candidate.hiringContractId === activeSession.hiringContractId)
    : undefined;
  const activeJobTitle = activePeriod?.jobTitle || activeEngagement?.jobTitle || "Tracked engagement";
  const activeClientName = activePeriod?.clientName || activeEngagement?.clientName;
  const activeOrganizations = activePeriod?.organizations || activeEngagement?.organizations || [];
  const serverNow = useServerClock(activeEntry?.period.serverNow ?? period?.serverNow ?? data?.serverNow);
  const activeSessionForPeriod = !!activeSession && !!period && activeSession.hiringContractId === period.hiringContractId;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [queryEndpoint] });
    queryClient.invalidateQueries({ queryKey: ["/api/client/timesheets?eligibilityOnly=true"] });
    queryClient.invalidateQueries({ queryKey: ["/api/talent/clock"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/clock/exceptions"] });
  };
  useEffect(() => {
    setCorrectionSession("");
    setCorrectionStart("");
    setCorrectionEnd("");
    setCorrectionReason("");
    setDisputeReason("");
    setReviewReason("");
    setReviewDecision("approve");
    setSessionEdits({});
    setCorrectionDecisions({});
    setAdjustmentReasons({});
    setAdjustmentRejectionOpen({});
  }, [period?.id]);
  const chooseCorrectionSession = (sessionId: string) => {
    if (correctionSession !== sessionId) {
      setCorrectionStart("");
      setCorrectionEnd("");
      setCorrectionReason("");
    }
    setCorrectionSession(sessionId);
  };
  const mutate = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: unknown }) => {
      const response = await apiRequest("POST", path, body);
      return response.json();
    },
    onSuccess: () => { refresh(); toast({ title: "Timesheet updated" }); },
    onError: (err: Error) => toast({ title: "Could not update timesheet", description: err.message, variant: "destructive" }),
  });
  const resolveClockAdjustment = useMutation({
    mutationFn: async ({ sessionId, decision, reason }: { sessionId: string; decision: "approve" | "reject"; reason?: string }) => {
      const response = await apiRequest("POST", `/api/client/clock/${sessionId}/resolve`, { decision, ...(reason ? { reason } : {}) });
      return response.json();
    },
    onSuccess: (_result, variables) => {
      setAdjustmentRejectionOpen((current) => ({ ...current, [variables.sessionId]: false }));
      setAdjustmentReasons((current) => ({ ...current, [variables.sessionId]: "" }));
      refresh();
      toast({ title: "Time-out adjustment resolved" });
    },
    onError: (err: Error) => toast({ title: "Could not resolve adjustment", description: err.message, variant: "destructive" }),
  });
  const submitCorrection = () => {
    if (!period || !correctionSession || !correctionReason.trim() || (!correctionStart && !correctionEnd)) return;
    if (!isValidTimeZone(period.workTimezone)) {
      toast({ title: "Work timezone required", description: "Timestamp corrections require the engagement's saved work timezone.", variant: "destructive" });
      return;
    }
    let startedAt: string | undefined;
    let endedAt: string | undefined;
    try {
      startedAt = correctionStart ? workLocalInputInstant(correctionStart, period.workTimezone) : undefined;
      endedAt = correctionEnd ? workLocalInputInstant(correctionEnd, period.workTimezone) : undefined;
    } catch (error) {
      toast({ title: "Invalid local timestamp", description: error instanceof Error ? error.message : "Check the selected work timezone and time.", variant: "destructive" });
      return;
    }
    mutate.mutate({
      path: `${endpoint}/${period.id}/corrections`,
      body: { corrections: [{ sessionId: correctionSession, ...(startedAt ? { startedAt } : {}), ...(endedAt ? { endedAt } : {}), reason: correctionReason.trim() }] },
    });
    setCorrectionStart(""); setCorrectionEnd(""); setCorrectionReason(""); setCorrectionSession("");
  };
  const review = (decision: "approve" | "reject" | "edit" | "exception") => {
    if (!period || !reviewReason.trim()) return;
    if (!isValidTimeZone(period.workTimezone)) {
      toast({ title: "Work timezone required", description: "Timestamp edits require the engagement's saved work timezone.", variant: "destructive" });
      return;
    }
    let edits: Array<{ sessionId: string; startedAt: string; endedAt: string }>;
    try {
      edits = Object.entries(sessionEdits).filter(([, times]) => times.startedAt && times.endedAt)
        .map(([sessionId, times]) => ({ sessionId, startedAt: workLocalInputInstant(times.startedAt, period.workTimezone!), endedAt: workLocalInputInstant(times.endedAt, period.workTimezone!) }));
    } catch (error) {
      toast({ title: "Invalid local timestamp", description: error instanceof Error ? error.message : "Check the selected work timezone and time.", variant: "destructive" });
      return;
    }
    const decisions = period.corrections.filter((item) => item.status === "pending").map((item) => ({
      correctionId: item.id, decision: correctionDecisions[item.id], reason: reviewReason.trim(),
    }));
    mutate.mutate({ path: `${endpoint}/${period.id}/review`, body: {
      decision, reason: reviewReason.trim(), ...(edits.length ? { edits } : {}),
      ...(decisions.length ? { correctionDecisions: decisions } : {}),
    } });
  };

  return (
    <div className={role === "talent" ? "min-h-screen bg-slate-50 dark:bg-[#060816]" : "min-h-full bg-slate-50"}>
      {role === "talent" && <TopNavigation />}
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Clock-derived hours</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{role === "admin" ? "Timesheet Review" : "Timesheets"}</h1>
            <p className="mt-2 text-sm text-slate-600">{role === "talent" ? "Review and submit recorded work for your active Client engagements." : role === "client" ? "Review recorded work for your hired Talent." : "Review submitted periods, correction proposals and clock anomalies."}</p>
          </div>
          <div className="flex items-center gap-2">
            {role === "talent" && data?.trackedEligible === true && <Button variant="outline" asChild><Link href={`/talent/clock${period ? `?hiringContractId=${encodeURIComponent(period.hiringContractId)}` : ""}`}><Clock3 className="mr-2 h-4 w-4" />Open Clock</Link></Button>}
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
        </header>
        {role === "client" && !isLoading && !isError && (
          <section aria-label="Timesheet filters" className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-medium text-slate-600">Talent
              <select value={talentFilter || deepLinkedTalentId || ""} onChange={(event) => setTalentFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Filter by Talent">
                <option value="">All Talent</option>
                {Array.from(new Map([...periods, ...engagements].filter((item) => item.talentId).map((item) => [item.talentId!, item.talentName || "Talent"]))).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Role / job
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Filter by role">
                <option value="">All roles</option>
                {Array.from(new Set([...periods, ...engagements].map((item) => item.jobTitle))).map((title) => <option key={title} value={title}>{title}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Filter by status">
                <option value="">All statuses</option>
                {Array.from(new Set(periods.map((item) => item.status))).map((status) => <option key={status} value={status}>{status}</option>)}
                <option value="no-period">No period yet</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Period
              <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Filter by period">
                <option value="">All periods</option>
                {periods.map((item) => <option key={item.id} value={item.id}>{item.periodStart} – {item.periodEnd}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Engagement
              <select value={engagementFilter} onChange={(event) => setEngagementFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Filter by engagement">
                <option value="">All engagements</option>
                {Array.from(new Map([...periods, ...engagements].map((item) => [item.hiringContractId, `${item.jobTitle} · ${item.talentName || item.clientName || "Engagement"}`]))).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            {deepLinkedOrganizationId && <p className="sm:col-span-2 lg:col-span-5 text-xs text-slate-500">Showing records available to this Client for the selected workspace.</p>}
          </section>
        )}
        {role === "talent" && !isLoading && !isError && activeSession && <Card className="mb-5 border-indigo-200 bg-indigo-50/70"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">
              {activeSession.status === "active" && <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />}
              {activeSession.status === "active" ? "Currently working" : "Open session · needs review"}
            </p>
            <h3 className="mt-2 font-semibold text-slate-950">{activeJobTitle}</h3>
            {activeClientName && <p className="mt-1 text-sm text-slate-600">Client: {activeClientName}</p>}
            {activeOrganizations.length > 0 && <p className="mt-1 text-xs text-slate-500">Client workspaces: {activeOrganizations.map((workspace) => workspace.name).join(", ")}</p>}
            <p className="mt-1 text-sm text-slate-600">Started {fmt(activeSession.startedAt, activeSession.workTimezone || activePeriod?.workTimezone)}</p>
            <p className="mt-1 text-xs text-slate-500">Work timezone: {activeSession.workTimezone || activePeriod?.workTimezone || "Not specified"} · Contract {activeSession.hiringContractId}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right"><p className="text-xs font-medium text-indigo-700">Elapsed</p><p className="text-xl font-semibold tabular-nums text-slate-950">{formatElapsed(elapsedSeconds(activeSession.startedAt, serverNow))}</p></div>
            <Button variant="outline" asChild><Link href={`/talent/clock?hiringContractId=${encodeURIComponent(activeSession.hiringContractId)}`}><Clock3 className="mr-2 h-4 w-4" />Open active engagement</Link></Button>
          </div>
        </CardContent></Card>}
        {isLoading ? <p className="py-12 text-center text-sm text-slate-500">Loading timesheets…</p>
          : isError ? <Card><CardContent className="p-6 text-sm text-red-700">Unable to load timesheets: {(error as Error).message}<Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>Retry</Button></CardContent></Card>
          : role === "talent" && data?.eligible === false && engagements.length === 0 && !periods.length
            ? <Card><CardContent className="p-8 text-center text-sm text-slate-600">Timesheets become available after you are hired by a Client.</CardContent></Card>
          : role === "client" && !engagements.length && !periods.length
            ? <Card><CardContent className="p-8 text-center text-sm text-slate-600">No hired Talent have timesheets yet.</CardContent></Card>
          : !filteredPeriods.length ? (
            <div className="space-y-4">
              <Card><CardContent className="p-8 text-center text-sm text-slate-600">
                {role === "client" && (engagements.length > 0 || periods.length > 0)
                  ? "Hired Talent are connected to this Client, but no timesheet periods match these filters yet."
                  : "No timesheet periods are available yet."}
              </CardContent></Card>
              {noPeriodEngagements.map((engagement) => (
                <Card key={engagement.hiringContractId}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    {role === "client" && <Avatar className="h-10 w-10"><AvatarImage src={engagement.talentAvatar || undefined} alt="" /><AvatarFallback>{(engagement.talentName || "T").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>}
                    <div className="min-w-0 flex-1">
                      {role === "client" && <p className="text-sm font-semibold text-slate-900">{engagement.talentName || "Hired Talent"}</p>}
                      <p className="text-sm font-medium text-slate-800">{engagement.jobTitle}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {role === "talent" ? `${engagement.clientName || "Client"} · ` : ""}
                        Client workspaces: {engagement.organizations?.length ? engagement.organizations.map((workspace) => workspace.name).join(", ") : "Not listed"}
                      </p>
                    </div>
                    {engagement.billingMode === "guaranteed"
                      ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">Not tracked</span>
                      : <span className="text-xs text-slate-500">No timesheet period yet</span>}
                    {engagement.billingMode === "guaranteed" && <p className="w-full pl-1 text-xs text-slate-500">Guaranteed engagement; clock attendance is not required.</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
          : <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-2">
              {filteredPeriods.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-4 text-left transition ${activeId === item.id ? "border-indigo-300 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                {role === "client" && <span className="mb-2 flex items-center gap-2">{item.talentAvatar && <Avatar className="h-7 w-7"><AvatarImage src={item.talentAvatar} alt="" /><AvatarFallback>{(item.talentName || "T").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>}<span className="text-xs font-semibold text-slate-700">{item.talentName || "Hired Talent"}</span></span>}
                <span className="block text-sm font-semibold text-slate-900">{item.jobTitle}</span>
                {role !== "client" && item.clientName && <span className="mt-1 block text-xs text-slate-500">{item.clientName}</span>}
                {(item.organizations?.length || item.billingMode) && <span className="mt-1 block text-xs text-slate-500">Client workspaces: {item.organizations?.map((workspace) => workspace.name).join(", ") || "Not listed"}</span>}
                <span className="mt-2 block text-xs text-slate-500">{item.periodStart} – {item.periodEnd}</span>
                <span className="mt-2 flex justify-between text-xs"><span className="capitalize text-indigo-700">{item.status}</span><b>{item.totalHours.toFixed(2)} hrs</b></span>
                {!!item.pendingAdjustmentCount && <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">{item.pendingAdjustmentCount} time-out {item.pendingAdjustmentCount === 1 ? "adjustment" : "adjustments"} pending</span>}
              </button>)}
              {noPeriodEngagements.map((engagement) => <div key={engagement.hiringContractId} className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
                {role === "client" && <p className="text-xs font-semibold text-slate-700">{engagement.talentName || "Hired Talent"}</p>}
                <p className="mt-1 text-sm font-medium text-slate-900">{engagement.jobTitle}</p>
                <p className="mt-1 text-xs text-slate-500">Client workspaces: {engagement.organizations?.map((workspace) => workspace.name).join(", ") || "Not listed"}</p>
                <p className="mt-2 text-xs font-medium text-slate-600">{engagement.billingMode === "guaranteed" ? "Not tracked · attendance not required" : "No period yet"}</p>
              </div>)}
            </aside>
            {period && <section className="space-y-5">
              <Card><CardContent className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {role === "client" && <Avatar className="mt-1 h-11 w-11"><AvatarImage src={period.talentAvatar || undefined} alt="" /><AvatarFallback>{(period.talentName || "T").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>}
                    <div><h2 className="text-xl font-semibold text-slate-950">{role === "client" && period.talentName ? period.talentName : period.jobTitle}</h2>{role === "client" && <p className="mt-0.5 text-sm font-medium text-slate-700">{period.jobTitle}</p>}<p className="mt-1 text-sm text-slate-500">{period.periodStart} – {period.periodEnd}{role !== "client" && period.clientName ? ` · ${period.clientName}` : ""}</p>
                    {(role === "talent" || period.organizations?.length) && <p className="mt-1 text-xs text-slate-500">{role === "talent" && period.clientName ? `Client: ${period.clientName} · ` : ""}Client workspaces: {period.organizations?.map((workspace) => workspace.name).join(", ") || "Not listed"}</p>}</div>
                  </div>
                  <div>
                    <p className="mt-1 text-xs text-slate-500">Work timezone: {period.workTimezone || "Not specified"} · Contract {period.hiringContractId}</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold capitalize text-slate-700">{period.status}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-indigo-50 p-4"><p className="text-xs font-medium text-indigo-700">Period total</p><p className="mt-1 text-2xl font-bold text-slate-950">{period.totalHours.toFixed(2)} <span className="text-sm font-medium">hours</span></p></div>
                  <div className="rounded-lg border border-slate-100 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Daily totals</p><div className="space-y-3">{period.days.map((day) => <div key={day.date} className="space-y-1.5 border-b border-slate-100 pb-2 last:border-0 last:pb-0"><div className="flex justify-between text-xs text-slate-700"><span>{day.date}</span><b>{day.hours.toFixed(2)}h paid</b></div><ActivityBreakdown breakdown={day} /></div>)}</div></div>
                </div>
                {role === "admin" && period.approvalBlocked && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" />Approval requires attention</p><ul className="mt-1 list-inside list-disc text-xs">{period.blockingIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
              </CardContent></Card>

              <Card><CardContent className="p-5 md:p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><Clock3 className="h-4 w-4" />Recorded sessions</h3>
                <div className="space-y-3">{period.sessions.map((session) => {
                  const end = session.effectiveEndAt || session.endedAt;
                  const pending = period.corrections.some((item) => item.sessionId === session.id && item.status === "pending");
                  return <div key={session.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-medium text-slate-500">Session {session.id}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{session.status}</span></div>
                    <p className="mt-2 text-sm text-slate-800">{fmt(session.startedAt, period.workTimezone)} → {fmt(end, period.workTimezone)}</p>
                    <div className="mt-3 space-y-3"><ActivityBreakdown breakdown={session.breakdown} /><ActivityTrace activities={session.activities} /></div>
                    {session.exceptionStatus === "pending" && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">Pending adjustment · {Number(session.requestedHours ?? 0).toFixed(2)} hrs requested. Not included in period totals until approved.</p>}
                    {session.exceptionStatus === "rejected" && session.resolutionReason && <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">Adjustment rejected: {session.resolutionReason}</p>}
                    {session.exceptionStatus === "approved" && <p className="mt-2 text-xs text-emerald-800">Adjustment approved · {Number(session.requestedHours ?? 0).toFixed(2)} hrs accepted.</p>}
                    {role === "admin" && <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-slate-600">Final start timestamp ({period.workTimezone || "work timezone not set"})<input disabled={!isValidTimeZone(period.workTimezone)} aria-label={`Final start for session ${session.id}`} type="datetime-local" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={sessionEdits[session.id]?.startedAt ?? workLocalInput(session.startedAt, period.workTimezone)} onChange={(e) => setSessionEdits({ ...sessionEdits, [session.id]: { startedAt: e.target.value, endedAt: sessionEdits[session.id]?.endedAt ?? workLocalInput(end, period.workTimezone) } })} /></label>
                      <label className="text-xs text-slate-600">Final end timestamp ({period.workTimezone || "work timezone not set"})<input disabled={!isValidTimeZone(period.workTimezone)} aria-label={`Final end for session ${session.id}`} type="datetime-local" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={sessionEdits[session.id]?.endedAt ?? workLocalInput(end, period.workTimezone)} onChange={(e) => setSessionEdits({ ...sessionEdits, [session.id]: { startedAt: sessionEdits[session.id]?.startedAt ?? workLocalInput(session.startedAt, period.workTimezone), endedAt: e.target.value } })} /></label>
                    </div>}
                    {role === "talent" && !["approved", "disputed"].includes(period.status) && <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-indigo-700">{pending ? "Correction pending" : "Request a timestamp correction"}</summary>
                      {!pending && <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="text-xs text-slate-600">Proposed start (optional)<input type="datetime-local" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={correctionSession === session.id ? correctionStart : ""} onFocus={() => chooseCorrectionSession(session.id)} onChange={(e) => { chooseCorrectionSession(session.id); setCorrectionStart(e.target.value); }} /></label>
                        <label className="text-xs text-slate-600">Proposed end (optional)<input type="datetime-local" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={correctionSession === session.id ? correctionEnd : ""} onFocus={() => chooseCorrectionSession(session.id)} onChange={(e) => { chooseCorrectionSession(session.id); setCorrectionEnd(e.target.value); }} /></label>
                        <label className="text-xs text-slate-600 sm:col-span-2">Reason<textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={2} value={correctionSession === session.id ? correctionReason : ""} onFocus={() => chooseCorrectionSession(session.id)} onChange={(e) => { chooseCorrectionSession(session.id); setCorrectionReason(e.target.value); }} placeholder="Explain the timestamp correction" /></label>
                        <Button size="sm" className="sm:col-span-2 sm:justify-self-start" disabled={mutate.isPending || correctionSession !== session.id || !correctionReason.trim() || (!correctionStart && !correctionEnd)} onClick={submitCorrection}>Send correction request</Button>
                      </div>}
                    </details>}
                  </div>;
                })}{!period.sessions.length && <p className="text-sm text-slate-500">No clock sessions were recorded for this period.</p>}</div>
              </CardContent></Card>

              {role === "admin" && <Card className="border-indigo-100"><CardContent className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-slate-900">Activity pay rules</h3><p className="mt-1 text-xs text-slate-500">Contract {period.hiringContractId}. Rules are snapshotted when an activity starts; saving only affects future activities.</p></div>
                  {rulesQuery.isLoading && <span className="text-xs text-slate-500">Loading contract rules…</span>}
                </div>
                {rulesQuery.isError && <div role="alert" className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-800">Contract rules could not be loaded. <Button type="button" size="sm" variant="outline" className="ml-2" onClick={() => rulesQuery.refetch()}>Retry</Button></div>}
                {!rulesQuery.isError && <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-lg border p-4">
                    <h4 className="text-sm font-semibold">Pay treatment</h4>
                    {([["lunchPaid", "Lunch is paid"], ["breakPaid", "Break is paid"], ["meetingPaid", "Meetings are paid"]] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-700"><span>{label}</span><input type="checkbox" checked={rulesDraft[key]} onChange={(event) => setRulesDraft((previous) => ({ ...previous, [key]: event.target.checked }))} aria-label={label} className="h-4 w-4 accent-indigo-600" /></label>)}
                  </div>
                  <div className="space-y-3 rounded-lg border p-4">
                    <h4 className="text-sm font-semibold">Activity limits</h4>
                    {([["lunchMaxMinutes", "Lunch max (minutes)"], ["breakMaxMinutes", "Break max (minutes)"], ["breaksPerDay", "Breaks per day"]] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-700"><span>{label}</span><input type="number" min="0" max="1440" step="1" value={rulesDraft[key]} onChange={(event) => setRulesDraft((previous) => ({ ...previous, [key]: Math.max(0, Number(event.target.value) || 0) }))} aria-label={label} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm" /></label>)}
                  </div>
                </div>}
                {!rulesQuery.isError && <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Over-limit time is flagged in activity records, not automatically switched.</p><Button type="button" disabled={saveRules.isPending || rulesQuery.isLoading || !period.hiringContractId} onClick={() => saveRules.mutate()}>{saveRules.isPending ? "Saving…" : "Save contract rules"}</Button></div>}
              </CardContent></Card>}

              {role === "client" && !!period.clockAdjustments?.length && <Card className="border-amber-200"><CardContent className="p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">Time-out adjustments</h3><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{period.pendingAdjustmentCount ?? period.clockAdjustments.filter((item) => item.status === "pending").length} pending</span></div>
                <p className="mt-1 text-sm text-slate-500">Review the proposed time separately from the recorded clock event. Approval does not rewrite the original Time Out.</p>
                <div className="mt-4 space-y-3">{period.clockAdjustments.map((item) => {
                  const pendingAdjustment = item.status === "pending";
                  const decisionReason = adjustmentReasons[item.sessionId] ?? "";
                  const resolving = resolveClockAdjustment.isPending && resolveClockAdjustment.variables?.sessionId === item.sessionId;
                  return <div key={item.sessionId} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-semibold text-slate-900">{item.talentName || period.talentName || "Hired Talent"}</p><p className="mt-0.5 text-xs text-slate-500">Session {item.sessionId}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${item.status === "pending" ? "bg-amber-100 text-amber-900" : item.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{item.status}</span>
                    </div>
                    <dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs text-slate-500">Original start</dt><dd className="mt-0.5 font-medium">{fmt(item.startedAt, item.workTimezone || period.workTimezone)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Recorded time out</dt><dd className="mt-0.5 font-medium">{fmt(item.endedAt, item.workTimezone || period.workTimezone)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Requested time out</dt><dd className="mt-0.5 font-medium">{fmt(item.proposedEndAt, item.workTimezone || period.workTimezone)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Hours · recorded / requested</dt><dd className="mt-0.5 font-medium tabular-nums">{Number(item.recordedHours ?? 0).toFixed(2)} hrs → {Number(item.requestedHours ?? 0).toFixed(2)} hrs</dd></div>
                    </dl>
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm"><p className="text-xs font-semibold text-slate-600">Talent’s reason</p><p className="mt-1 whitespace-pre-wrap text-slate-800">{item.proposalReason || "No reason supplied."}</p></div>
                    {item.resolutionReason && <p className="mt-2 text-xs text-slate-600">Decision note: {item.resolutionReason}</p>}
                    {pendingAdjustment && <div className="mt-4 border-t pt-3">
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        {!adjustmentRejectionOpen[item.sessionId]
                          ? <Button size="sm" variant="outline" disabled={resolving} onClick={() => setAdjustmentRejectionOpen({ ...adjustmentRejectionOpen, [item.sessionId]: true })}>Reject</Button>
                          : <Button size="sm" variant="outline" disabled={resolving || !decisionReason.trim()} onClick={() => resolveClockAdjustment.mutate({ sessionId: item.sessionId, decision: "reject", reason: decisionReason.trim() })}>Confirm rejection</Button>}
                        <Button size="sm" disabled={resolving} onClick={() => resolveClockAdjustment.mutate({ sessionId: item.sessionId, decision: "approve" })}>Approve adjustment</Button>
                      </div>
                      {adjustmentRejectionOpen[item.sessionId] && <div className="mt-3">
                        <label htmlFor={`clock-adjustment-reason-${item.sessionId}`} className="text-xs font-medium text-slate-600">Reason for rejection <span className="text-rose-700">*</span></label>
                        <textarea id={`clock-adjustment-reason-${item.sessionId}`} required aria-required="true" maxLength={1000} rows={2} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={decisionReason} onChange={(event) => setAdjustmentReasons({ ...adjustmentReasons, [item.sessionId]: event.target.value })} placeholder="Explain why this adjustment cannot be approved" />
                        <Button type="button" size="sm" variant="ghost" className="mt-1 px-2" disabled={resolving} onClick={() => setAdjustmentRejectionOpen({ ...adjustmentRejectionOpen, [item.sessionId]: false })}>Cancel</Button>
                      </div>}
                    </div>}
                  </div>;
                })}</div>
              </CardContent></Card>}
              {period.corrections.length > 0 && <Card><CardContent className="p-5 md:p-6"><h3 className="font-semibold text-slate-900">Timestamp correction requests</h3><div className="mt-3 space-y-2">{period.corrections.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b className="text-slate-800">Session {item.sessionId}</b><span className="text-xs capitalize text-slate-500">{item.status}</span></div><p className="mt-1 text-xs text-slate-600">{item.reason}</p><p className="mt-1 text-xs text-slate-500">Requested: {item.requestedStartedAt ? fmt(item.requestedStartedAt, period.workTimezone) : "start unchanged"} – {item.requestedEndAt ? fmt(item.requestedEndAt, period.workTimezone) : "end unchanged"}</p>{role !== "client" && item.decisionReason && <p className="mt-1 text-xs text-slate-500">Decision note: {item.decisionReason}</p>}{role === "admin" && item.status === "pending" && <div className="mt-2 flex gap-2"><Button size="sm" variant={correctionDecisions[item.id] === "approve" ? "default" : "outline"} onClick={() => setCorrectionDecisions({ ...correctionDecisions, [item.id]: "approve" })}>Approve</Button><Button size="sm" variant={correctionDecisions[item.id] === "reject" ? "default" : "outline"} onClick={() => setCorrectionDecisions({ ...correctionDecisions, [item.id]: "reject" })}>Reject</Button></div>}</div>)}</div></CardContent></Card>}

              {role === "talent" && ["open", "rejected"].includes(period.status) && <Card><CardContent className="p-5"><h3 className="font-semibold text-slate-900">Submit timesheet</h3><p className="mt-1 text-sm text-slate-500">Submission sends the recorded clock-derived period to OnSpot Admin for review.</p>{activeSessionForPeriod && <p className="mt-2 text-sm text-amber-800">{activeSession?.status === "active" ? "Clock out of this engagement before submitting. Its open session is not included in recorded period hours." : "This engagement has an open session that needs review before its timesheet can be submitted."}</p>}{!!period.pendingAdjustmentCount && <p role="alert" className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">This period has {period.pendingAdjustmentCount} time-out {period.pendingAdjustmentCount === 1 ? "adjustment" : "adjustments"} awaiting review. Submit after every adjustment is approved or rejected.</p>}<Button className="mt-3" disabled={mutate.isPending || !period.sessions.length || activeSessionForPeriod || !!period.pendingAdjustmentCount} onClick={() => mutate.mutate({ path: `${endpoint}/${period.id}/submit`, body: {} })}>Submit for review</Button></CardContent></Card>}
              {role === "client" && period.status === "approved" && <Card><CardContent className="p-5"><h3 className="font-semibold text-slate-900">Dispute this approved timesheet</h3><p className="mt-1 text-sm text-slate-500">A clear reason is required and will be reviewed by the timesheet administrator.</p><textarea maxLength={2000} rows={3} className="mt-3 w-full rounded-md border border-slate-300 p-2 text-sm" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Describe the issue with this approved period" /><Button className="mt-3" variant="destructive" disabled={mutate.isPending || !disputeReason.trim()} onClick={() => mutate.mutate({ path: `${endpoint}/${period.id}/dispute`, body: { reason: disputeReason.trim() } })}>Submit dispute</Button></CardContent></Card>}
              {role === "admin" && ["submitted", "disputed"].includes(period.status) && <Card><CardContent className="p-5 md:p-6"><h3 className="font-semibold text-slate-900">Review decision</h3><p className="mt-1 text-sm text-slate-500">Provide a decision reason. For approved corrections, include the final timestamps in the session fields above.</p><label className="mt-4 block text-xs font-medium text-slate-600">Decision reason<textarea rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Record why this review decision is being made" /></label><div className="mt-4 flex flex-wrap gap-2">{(["approve", "reject", "edit", "exception"] as const).map((choice) => <Button key={choice} variant={choice === "reject" ? "destructive" : reviewDecision === choice ? "default" : "outline"} onClick={() => setReviewDecision(choice)} className="capitalize">{choice}</Button>)}<Button className="ml-auto" disabled={mutate.isPending || !reviewReason.trim() || (reviewDecision === "edit" && !Object.keys(sessionEdits).length) || period.corrections.some((item) => item.status === "pending" && !correctionDecisions[item.id])} onClick={() => review(reviewDecision)}>Record {reviewDecision} decision</Button></div></CardContent></Card>}
              {role !== "client" && period.revisions.length > 0 && <Card><CardContent className="p-5"><h3 className="font-semibold text-slate-900">Approved revisions</h3><div className="mt-2 space-y-2">{period.revisions.map((item) => <p key={item.id} className="text-sm text-slate-600">Version {item.version}{item.exceptionApproved ? " · exception approved" : ""} · {item.reason} <span className="text-xs text-slate-400">({fmt(item.createdAt, period.workTimezone)})</span></p>)}</div></CardContent></Card>}
              {period.disputes.length > 0 && <Card><CardContent className="p-5"><h3 className="font-semibold text-slate-900">Dispute updates</h3>{period.disputes.map((item) => <div key={item.id} className="mt-2 text-sm text-slate-600"><p><b className="capitalize">{item.status}</b> · {item.reason}</p>{role !== "client" && item.resolutionReason && <p className="mt-1 text-xs">Resolution: {item.resolutionReason}</p>}</div>)}</CardContent></Card>}
            </section>}
          </div>}
      </main>
    </div>
  );
}