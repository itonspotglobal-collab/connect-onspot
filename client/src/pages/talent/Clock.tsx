import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock3, Loader2, MapPin, Timer, Globe2, AlertTriangle } from "lucide-react";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useServerClock } from "@/hooks/useServerClock";
import { elapsedSeconds, formatElapsed, formatWorkClock, formatWorkTime, isValidTimeZone, supportedTimeZones, timezoneOffsetLabel, workLocalInput, workLocalInputInstant } from "@/lib/workClockTime";
import { ActivityBreakdown, ActivityTrace, type ClockActivity, type ClockActivityType } from "@/components/ActivityTimeline";

const TIME_ZONES = supportedTimeZones();
type Session = {
  id: string;
  hiringContractId: string;
  startedAt: string;
  endedAt?: string | null;
  effectiveEndAt?: string | null;
  proposedEndAt?: string | null;
  proposalReason?: string | null;
  resolutionReason?: string | null;
  durationSeconds?: number | null;
  requestedHours?: number | null;
  workTimezone?: string | null;
  status: "active" | "completed" | "exception_detected" | "exception_pending" | "exception_approved" | "exception_rejected";
  currentActivity?: ClockActivity & { maxMinutes?: number | null } | null;
  activities?: ClockActivity[];
  breakdown?: { workSeconds?: number; meetingSeconds?: number; lunchSeconds?: number; breakSeconds?: number; paidSeconds?: number; unpaidSeconds?: number };
};
type BreakRules = { lunchPaid: boolean; breakPaid: boolean; meetingPaid: boolean; lunchMaxMinutes: number; breakMaxMinutes: number; breaksPerDay: number };
type Contract = {
  id: string;
  jobTitle: string;
  clientName?: string;
  talentName?: string;
  organizations?: Array<{ id: string; name: string }>;
  workTimezone?: string | null;
  timezoneLocked?: boolean;
  breakRules?: BreakRules;
};
type ClockData = { serverNow?: string; contracts: Contract[]; activeSession: Session | null; recentSessions: Session[]; todayTotals?: Session["breakdown"] & { workedSeconds?: number }; todayActivities?: Array<ClockActivity & { sessionId?: string; workTimezone?: string }> };
function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? (error instanceof Error ? error.message : "The clock could not be updated. Please try again.");
}
function statusText(status: Session["status"]) {
  if (status === "exception_pending") return "Adjustment pending";
  if (status === "exception_approved") return "Adjustment approved";
  if (status === "exception_rejected") return "Adjustment rejected";
  if (status === "exception_detected") return "Needs adjustment";
  return "Completed";
}
function defaultProposal(session: Session, zone: string) {
  const start = new Date(session.startedAt).getTime();
  const rawEnd = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const proposed = Math.min(start + 8 * 60 * 60 * 1000, rawEnd);
  return workLocalInput(new Date(proposed).toISOString(), zone);
}

export default function Clock() {
  const client = useQueryClient();
  const [contractId, setContractId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("hiringContractId") || "");
  const [proposedEnd, setProposedEnd] = useState("");
  const [reason, setReason] = useState("");
  const [correctionSessionId, setCorrectionSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [completedSession, setCompletedSession] = useState<Session | null>(null);
  const [timezoneDraft, setTimezoneDraft] = useState("");
  const [timeOutConfirmationType, setTimeOutConfirmationType] = useState<"lunch" | "break" | null>(null);
  const { data, isLoading, error, refetch } = useQuery<ClockData>({
    queryKey: ["/api/talent/clock"],
    queryFn: () => authAPI.get("/api/talent/clock"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const now = useServerClock(data?.serverNow);
  const active = data?.activeSession;
  const selectedContract = active
    ? data?.contracts.find((item) => item.id === active.hiringContractId)
    : data?.contracts.find((item) => item.id === contractId) ?? data?.contracts[0];
  const selectedId = active?.hiringContractId || (data?.contracts.some((item) => item.id === contractId) ? contractId : selectedContract?.id) || "";
  const activeZone = isValidTimeZone(active?.workTimezone) ? active?.workTimezone : selectedContract?.workTimezone;
  const workZone = activeZone || active?.workTimezone || selectedContract?.workTimezone || "";
  const validZone = isValidTimeZone(workZone);
  const browserSuggestion = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
  }, []);
  const refreshRelated = () => {
    client.invalidateQueries({ queryKey: ["/api/talent/clock"] });
    client.invalidateQueries({ queryKey: ["/api/talent/timesheets"] });
    client.invalidateQueries({ queryKey: ["/api/client/timesheets"] });
    client.invalidateQueries({ queryKey: ["/api/client/timesheets?eligibilityOnly=true"] });
    client.invalidateQueries({ queryKey: ["/api/admin/clock/exceptions"] });
  };
  const openAdjustment = (session: Session) => {
    setCorrectionSessionId(session.id);
    const zone = session.workTimezone || data?.contracts.find((item) => item.id === session.hiringContractId)?.workTimezone || "";
    setProposedEnd(isValidTimeZone(zone)
      ? (session.status === "exception_rejected" && session.proposedEndAt ? workLocalInput(session.proposedEndAt, zone) : defaultProposal(session, zone))
      : "");
    setReason(session.status === "exception_rejected" ? session.proposalReason || "" : "");
  };
  const action = useMutation({
    mutationFn: async (kind: "in" | "out" | "exception") => {
      if (kind === "in") return authAPI.post("/api/talent/clock/in", { hiringContractId: selectedId });
      if (kind === "out") return authAPI.post("/api/talent/clock/out", {});
      const session = [completedSession, active, ...(data?.recentSessions ?? [])].find((item) => item?.id === correctionSessionId);
      const zone = session?.workTimezone || data?.contracts.find((item) => item.id === session?.hiringContractId)?.workTimezone;
      if (!proposedEnd || !reason.trim()) throw new Error("Enter the actual time you stopped working and a reason.");
      if (reason.trim().length > 1000) throw new Error("Keep the reason to 1,000 characters or fewer.");
      if (!isValidTimeZone(zone)) throw new Error("A valid saved work timezone is required for the adjustment.");
      const sessionId = correctionSessionId;
      if (!sessionId) throw new Error("Choose a session to adjust.");
      return authAPI.post("/api/talent/clock/exception", {
        sessionId,
        proposedEndAt: workLocalInputInstant(proposedEnd, zone),
        reason: reason.trim(),
      });
    },
    onSuccess: (result, kind) => {
      if (kind === "out") {
        setTimeOutConfirmationType(null);
        const payload = result as { session?: Session; needsAdjustment?: boolean } & Session;
        const session = payload.session || payload;
        const duration = Number((result as { durationSeconds?: number }).durationSeconds ?? session.durationSeconds ?? 0);
        if (!session.workTimezone && active?.workTimezone) session.workTimezone = active.workTimezone;
        if (session.durationSeconds == null && duration) session.durationSeconds = duration;
        setCompletedSession(session);
        setMessage(`Time Out recorded${duration ? ` · ${formatElapsed(duration)} on the recorded session` : ""}.`);
        if (payload.needsAdjustment) openAdjustment(session);
      } else {
        setMessage(kind === "in" ? "Time In recorded." : "Adjustment request sent for review. Your recorded Time Out has not changed.");
        if (kind === "exception") setCompletedSession((current) => current?.id === correctionSessionId ? { ...current, status: "exception_pending" } : current);
        setCorrectionSessionId(null);
        setReason("");
        setProposedEnd("");
      }
      refreshRelated();
    },
    onError: (failure) => setMessage(errorMessage(failure)),
  });
  const saveTimezone = useMutation({
    mutationFn: (workTimezone: string) => authAPI.put("/api/talent/clock/timezone", { hiringContractId: selectedId, workTimezone }),
    onSuccess: () => {
      setMessage("Work timezone saved for this engagement.");
      refreshRelated();
    },
    onError: (failure) => setMessage(errorMessage(failure)),
  });
  const activity = useMutation({
    mutationFn: (activityType: ClockActivityType) => authAPI.post("/api/talent/clock/activity", { activityType }),
    onSuccess: (_result, activityType) => {
      setMessage(activityType === "work" ? "Back to work." : `${activityType[0].toUpperCase()}${activityType.slice(1)} status recorded.`);
      refreshRelated();
    },
    onError: (failure) => setMessage(errorMessage(failure)),
  });
  const correctionForm = (sessionId: string) => {
    const session = [completedSession, active, ...(data?.recentSessions ?? [])].find((item) => item?.id === sessionId);
    const zone = session?.workTimezone || data?.contracts.find((item) => item.id === session?.hiringContractId)?.workTimezone;
    return <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div><p className="font-medium">When did you actually stop working?</p><p className="mt-1 text-xs text-muted-foreground">This sends a proposed time for review. The recorded Time Out stays unchanged.</p></div>
      {!isValidTimeZone(zone) && <p role="alert" className="text-xs text-amber-800">A valid work timezone must be saved before requesting an adjustment.</p>}
      <div className="space-y-1"><Label htmlFor={`proposed-end-${sessionId}`}>Actual finish time · {zone || "work timezone"}</Label><Input id={`proposed-end-${sessionId}`} type="datetime-local" value={proposedEnd} min={session ? workLocalInput(session.startedAt, zone) : undefined} max={session?.endedAt ? workLocalInput(session.endedAt, zone) : undefined} onChange={(event) => setProposedEnd(event.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor={`clock-reason-${sessionId}`}>Reason</Label><Textarea id={`clock-reason-${sessionId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Briefly explain why you missed Time Out" /></div>
      {action.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(action.error)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={action.isPending || !proposedEnd || !reason.trim() || !isValidTimeZone(zone)} onClick={() => action.mutate("exception")}>{action.isPending ? "Sending…" : "Submit adjustment"}</Button>
        <Button variant="ghost" disabled={action.isPending} onClick={() => { setCorrectionSessionId(null); setProposedEnd(""); setReason(""); }}>Skip for now</Button>
      </div>
    </div>;
  };
  const timezoneEditor = () => {
    const savedZone = isValidTimeZone(selectedContract?.workTimezone) ? selectedContract.workTimezone : "";
    return <div className="rounded-lg border p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Globe2 className="h-4 w-4" />Confirm work timezone</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <select aria-label="Select work timezone" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" value={timezoneDraft || savedZone} onChange={(event) => setTimezoneDraft(event.target.value)}>
          <option value="">Choose a timezone</option>
          {browserSuggestion && browserSuggestion !== savedZone && !TIME_ZONES.includes(browserSuggestion) && <option value={browserSuggestion}>{browserSuggestion} (browser suggestion)</option>}
          {savedZone && !TIME_ZONES.includes(savedZone) && <option value={savedZone}>{savedZone} (saved)</option>}
          {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
        <Button variant="outline" disabled={saveTimezone.isPending || !selectedId || !isValidTimeZone(timezoneDraft || savedZone)} onClick={() => saveTimezone.mutate(timezoneDraft || savedZone)}>
          {saveTimezone.isPending ? "Saving…" : "Confirm timezone"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{selectedContract?.workTimezone && !isValidTimeZone(selectedContract.workTimezone) ? `The saved value “${selectedContract.workTimezone}” is not valid. Choose a valid timezone.` : "Choose the timezone used for this engagement."}{browserSuggestion ? ` Browser suggestion: ${browserSuggestion}; it will only be saved if you confirm it.` : ""}</p>
    </div>;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/my-applications" className="text-sm text-primary hover:underline">← My Applications</Link>
      <h1 className="mt-5 text-3xl font-semibold">Time In / Time Out</h1>
      <p className="mt-2 text-sm text-muted-foreground">Record the moment you clock in and out. If you miss Time Out, close the session first and request a reviewed adjustment separately.</p>
      {message && <p role="status" className="mt-5 rounded-md border px-4 py-3 text-sm">{message}</p>}
      {isLoading ? <p className="mt-8 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading clock…</p>
        : error ? <div className="mt-8"><p role="alert">Could not load the clock.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
        : <Card className="mt-7">
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> Work session</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {active ? <>
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium">{selectedContract?.jobTitle ?? "Your current contract"}</p>
                <p className="mt-1 text-sm">{selectedContract?.clientName || "Client"}{selectedContract?.organizations?.length ? ` · ${selectedContract.organizations.map((item) => item.name).join(", ")}` : ""}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current session</p><p className="mt-1 text-3xl font-semibold tabular-nums">{formatElapsed(elapsedSeconds(active.startedAt, now))}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work timezone local time</p><p className="mt-1 text-lg font-semibold tabular-nums">{validZone ? formatWorkClock(now, workZone) : "Timezone not set"}</p><p className="text-xs text-muted-foreground">{validZone ? `${workZone} · ${timezoneOffsetLabel(now, workZone)}` : "A saved work timezone is required."}</p>{validZone && <p className="mt-1 text-xs text-muted-foreground">{formatWorkClock(now, workZone, true)}</p>}</div>
                </div>
                <p className="mt-3 text-sm">Started: {formatWorkTime(active.startedAt, workZone)}</p>
                {active.status !== "active" && <p className="mt-2 flex items-center gap-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />You can still Time Out now. Then request a shorter finish time for review.</p>}
                {active.currentActivity && (() => {
                  const currentOverLimit = Boolean(active.currentActivity.overLimit || (active.currentActivity.maxMinutes && elapsedSeconds(active.currentActivity.startedAt, now) > active.currentActivity.maxMinutes * 60));
                  return <div className={`mt-4 rounded-lg border p-3 ${currentOverLimit ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-white/80"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current status</p>
                  <p className="mt-1 text-sm font-semibold">{active.currentActivity.type === "work" ? "Working" : active.currentActivity.type === "meeting" ? "In a meeting" : active.currentActivity.type === "lunch" ? "On lunch" : "On break"} · {formatElapsed(elapsedSeconds(active.currentActivity.startedAt, now))}{active.currentActivity.maxMinutes ? ` of ${active.currentActivity.maxMinutes} min` : ""}</p>
                  {currentOverLimit && <p className="mt-1 text-xs font-medium text-amber-800">This activity is over its contract limit. Switch status when you’re ready.</p>}
                </div>;
                })()}
                {!validZone && selectedContract && <div className="mt-4"><p className="mb-2 text-sm font-medium text-amber-800">Confirm a valid work timezone for this engagement. The session's original start stays unchanged.</p>{timezoneEditor()}</div>}
              </div>
              <section aria-label="Activity status" className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Session status</p><p className="text-xs text-muted-foreground">Switch activities without ending your session.</p></div>
                  {active.currentActivity?.type !== "work" && <Button variant="outline" size="sm" disabled={activity.isPending} onClick={() => activity.mutate("work")}>Back to work</Button>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["work", "lunch", "break", "meeting"] as ClockActivityType[]).map((type) => {
                    const activeType = active.currentActivity?.type || "work";
                    const label = type === "work" ? "Working" : type === "lunch" ? "Lunch" : type === "break" ? "Break" : "Meeting";
                    return <Button key={type} type="button" variant={activeType === type ? "default" : "outline"} className="min-h-10" disabled={activity.isPending || activeType === type} aria-pressed={activeType === type} onClick={() => activity.mutate(type)}>{label}</Button>;
                  })}
                </div>
                <ActivityTrace activities={active.activities} now={now} />
                <ActivityBreakdown breakdown={active.breakdown} />
                {selectedContract?.breakRules && <p className="text-[11px] leading-relaxed text-muted-foreground">Contract rules · Lunch {selectedContract.breakRules.lunchPaid ? "paid" : "unpaid"}, up to {selectedContract.breakRules.lunchMaxMinutes} min · Break {selectedContract.breakRules.breakPaid ? "paid" : "unpaid"}, up to {selectedContract.breakRules.breakMaxMinutes} min ({selectedContract.breakRules.breaksPerDay}/day) · Meetings {selectedContract.breakRules.meetingPaid ? "paid" : "unpaid"}.</p>}
              </section>
              <Button className="min-h-14 w-full text-lg font-semibold" disabled={action.isPending} onClick={() => {
                const type = active.currentActivity?.type;
                if (type === "lunch" || type === "break") {
                  action.reset();
                  setTimeOutConfirmationType(type);
                  return;
                }
                action.mutate("out");
              }}>{action.isPending ? "Recording…" : "Time Out"}</Button>
              {(active.status === "exception_detected" || active.status === "exception_rejected") && <p className="text-xs text-muted-foreground">Record Time Out first, then request an adjustment if you finished earlier.</p>}
            </> : data?.contracts.length ? <>
              <div className="space-y-2">
                <Label htmlFor="clock-contract">Client engagement</Label>
                <select id="clock-contract" className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={selectedId} onChange={(event) => { setContractId(event.target.value); setTimezoneDraft(""); setCompletedSession(null); }}>
                  {data.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.jobTitle}{contract.clientName ? ` · ${contract.clientName}` : ""}</option>)}
                </select>
                {selectedContract?.organizations?.length ? <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />Client workspace: {selectedContract.organizations.map((item) => item.name).join(", ")}</p> : null}
              </div>
              <div className="rounded-lg border p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Globe2 className="h-4 w-4" />Work timezone</p>
                {selectedContract?.timezoneLocked && isValidTimeZone(selectedContract.workTimezone) ? <p className="mt-2 font-medium">{selectedContract.workTimezone}</p> : timezoneEditor()}
                {selectedContract?.timezoneLocked && isValidTimeZone(selectedContract.workTimezone) && <p className="mt-2 text-xs text-muted-foreground">Saved for this engagement and locked after recorded work.</p>}
                {validZone && <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work timezone local time</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatWorkClock(now, workZone)}</p><p className="text-xs text-muted-foreground">{workZone} · {timezoneOffsetLabel(now, workZone)}</p></div><div className="text-right text-sm text-muted-foreground">{formatWorkClock(now, workZone, true)}</div></div>}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Timer className="h-4 w-4" />Ready to start work</div>
              <p className="text-3xl font-semibold tabular-nums">00:00:00</p>
              {!validZone && <p role="alert" className="text-sm text-amber-700">Clock In is available after you choose and save a valid work timezone for this engagement.</p>}
              <Button className="min-h-14 w-full text-lg font-semibold" disabled={action.isPending || !selectedId || !validZone} onClick={() => action.mutate("in")}>{action.isPending ? "Recording…" : "Time In"}</Button>
            </> : <p className="text-sm text-muted-foreground">Clock controls appear when you have a signed tracked hiring contract.</p>}
          </CardContent>
        </Card>}
      <Dialog open={timeOutConfirmationType !== null} onOpenChange={(open) => { if (!open && !action.isPending) setTimeOutConfirmationType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Time out for the day?</DialogTitle>
            <DialogDescription>
              {timeOutConfirmationType ? `You're on ${timeOutConfirmationType}. Time out for the day?` : "Time out for the day?"}
            </DialogDescription>
          </DialogHeader>
          {action.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(action.error)}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={action.isPending} onClick={() => setTimeOutConfirmationType(null)}>Cancel</Button>
            <Button type="button" disabled={action.isPending} onClick={() => action.mutate("out")}>{action.isPending ? "Recording…" : "Time Out"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {completedSession && <Card className="mt-6"><CardHeader><CardTitle>Time Out recorded</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
        <p>Started: {formatWorkTime(completedSession.startedAt, completedSession.workTimezone || workZone)}</p>
        <p>Recorded Time Out: {formatWorkTime(completedSession.endedAt || completedSession.effectiveEndAt, completedSession.workTimezone || workZone)}</p>
        {completedSession.durationSeconds != null && <p>Recorded duration: <span className="font-semibold tabular-nums">{formatElapsed(completedSession.durationSeconds)}</span></p>}
        <p className="text-muted-foreground">This is the recorded event. Any adjustment is a separate proposal for review.</p>
        {completedSession.status !== "exception_pending" && completedSession.status !== "exception_approved" && <>
          <Button variant="ghost" className="h-auto px-0 text-primary underline underline-offset-4" onClick={() => openAdjustment(completedSession)}>Forgot to time out earlier? Request an adjustment</Button>
          <Dialog open={correctionSessionId === completedSession.id} onOpenChange={(open) => { if (!open) setCorrectionSessionId(null); }}>
            <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>Looks like you forgot to time out. Adjust your actual finish time?</DialogTitle><DialogDescription>Your recorded Time Out is saved. An earlier finish time requires review and does not change that recorded event.</DialogDescription></DialogHeader>
              {correctionForm(completedSession.id)}
            </DialogContent>
          </Dialog>
        </>}
      </CardContent></Card>}
      {data?.todayTotals && <Card className="mt-6"><CardHeader><CardTitle>Today’s activity</CardTitle></CardHeader><CardContent className="space-y-3">
        <ActivityBreakdown breakdown={{ ...data.todayTotals, workSeconds: data.todayTotals.workSeconds ?? data.todayTotals.workedSeconds }} />
        <ActivityTrace activities={data.todayActivities} now={now} />
      </CardContent></Card>}
      {!!data?.recentSessions.length && <Card className="mt-6">
        <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.recentSessions.filter((session) => session.id !== active?.id).map((session) => {
            const sessionZone = session.workTimezone || data.contracts.find((item) => item.id === session.hiringContractId)?.workTimezone;
            const adjustable = !!session.endedAt && (session.status === "exception_detected" || session.status === "exception_rejected");
             return <details key={session.id} className="space-y-2 border-b pb-3 last:border-0">
               <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-2"><span>{formatWorkTime(session.startedAt, sessionZone)} → {formatWorkTime(session.endedAt || session.effectiveEndAt, sessionZone)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${session.status === "exception_rejected" ? "bg-rose-100 text-rose-800" : session.status.startsWith("exception") ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"}`}>{statusText(session.status)}</span></div>
               </summary>
              <p className="text-xs text-muted-foreground">{sessionZone || "Work timezone not set"}{session.durationSeconds != null ? ` · ${formatElapsed(session.durationSeconds)} ${session.status === "exception_approved" ? "approved" : "recorded"}` : ""}</p>
               <ActivityTrace activities={session.activities} />
               <ActivityBreakdown breakdown={session.breakdown} />
              {session.status === "exception_rejected" && session.resolutionReason && <p className="text-xs text-rose-800">Review note: {session.resolutionReason}</p>}
              {session.status === "exception_pending" && <p className="text-xs text-amber-800">Requested time is awaiting review; recorded events remain unchanged.</p>}
              {session.status === "exception_approved" && session.proposedEndAt && <p className="text-xs text-muted-foreground">Approved adjustment: {formatWorkTime(session.proposedEndAt, sessionZone)}</p>}
              {adjustable && (correctionSessionId === session.id && completedSession?.id !== session.id ? correctionForm(session.id) : <Button variant="outline" size="sm" onClick={() => openAdjustment(session)}>{session.status === "exception_rejected" ? "Resubmit adjustment" : "Adjust time out"}</Button>)}
             </details>;
          })}
        </CardContent>
      </Card>}
    </main>
  );
}
