import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock3, Loader2, MapPin, Timer, Globe2 } from "lucide-react";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useServerClock } from "@/hooks/useServerClock";
import { elapsedSeconds, formatElapsed, formatWorkClock, formatWorkTime, isValidTimeZone, supportedTimeZones, timezoneOffsetLabel, workLocalInputInstant } from "@/lib/workClockTime";

const TIME_ZONES = supportedTimeZones();
type Session = {
  id: string;
  hiringContractId: string;
  startedAt: string;
  endedAt?: string | null;
  effectiveEndAt?: string | null;
  durationSeconds?: number | null;
  workTimezone?: string | null;
  status: "active" | "completed" | "exception_detected" | "exception_pending" | "exception_approved" | "exception_rejected";
};
type Contract = {
  id: string;
  jobTitle: string;
  clientName?: string;
  talentName?: string;
  organizations?: Array<{ id: string; name: string }>;
  workTimezone?: string | null;
  timezoneLocked?: boolean;
};
type ClockData = { serverNow?: string; contracts: Contract[]; activeSession: Session | null; recentSessions: Session[] };
function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? (error instanceof Error ? error.message : "The clock could not be updated. Please try again.");
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
  const action = useMutation({
    mutationFn: async (kind: "in" | "out" | "exception") => {
      if (kind === "in") return authAPI.post("/api/talent/clock/in", { hiringContractId: selectedId });
      if (kind === "out") return authAPI.post("/api/talent/clock/out", {});
      const correctionSession = [active, ...(data?.recentSessions ?? [])].find((session) => session?.id === correctionSessionId);
      const zone = correctionSession?.workTimezone || data?.contracts.find((item) => item.id === correctionSession?.hiringContractId)?.workTimezone;
      if (!proposedEnd || !reason.trim()) throw new Error("Enter the missing Clock Out time and a reason.");
      if (!isValidTimeZone(zone)) throw new Error("A valid saved work timezone is required for timestamp corrections.");
      return authAPI.post("/api/talent/clock/exception", {
        sessionId: correctionSessionId || active?.id,
        proposedEndAt: workLocalInputInstant(proposedEnd, zone),
        reason: reason.trim(),
      });
    },
    onSuccess: (result, kind) => {
      if (kind === "out") {
        const payload = result as { session?: Session } & Session;
        const session = payload.session || payload;
        const duration = Number((result as { durationSeconds?: number }).durationSeconds ?? session.durationSeconds ?? 0);
        if (!session.workTimezone && active?.workTimezone) session.workTimezone = active.workTimezone;
        if (session.durationSeconds == null && duration) session.durationSeconds = duration;
        setCompletedSession(session);
        setMessage(`Session completed${duration ? ` · ${formatElapsed(duration)} recorded` : ""}.`);
      } else {
        setMessage(kind === "in" ? "Clocked in." : "Request sent to OnSpot for review.");
      }
      setReason("");
      setProposedEnd("");
      setCorrectionSessionId(null);
      client.invalidateQueries({ queryKey: ["/api/talent/clock"] });
      client.invalidateQueries({ queryKey: ["/api/talent/timesheets"] });
    },
    onError: (failure) => setMessage(errorMessage(failure)),
  });
  const saveTimezone = useMutation({
    mutationFn: (workTimezone: string) => authAPI.put("/api/talent/clock/timezone", { hiringContractId: selectedId, workTimezone }),
    onSuccess: () => {
      setMessage("Work timezone saved for this engagement.");
      client.invalidateQueries({ queryKey: ["/api/talent/clock"] });
      client.invalidateQueries({ queryKey: ["/api/talent/timesheets"] });
    },
    onError: (failure) => setMessage(errorMessage(failure)),
  });
  const needsResolution = active?.status === "exception_detected" || active?.status === "exception_pending" || active?.status === "exception_rejected";
  const correctionForm = (sessionId: string) => {
    const session = [active, ...(data?.recentSessions ?? [])].find((item) => item?.id === sessionId);
    const zone = session?.workTimezone || data?.contracts.find((item) => item.id === session?.hiringContractId)?.workTimezone;
    return <div className="space-y-3 rounded-lg border p-4">
      <p className="font-medium">Request a missed Clock Out correction</p>
      <p className="text-xs text-muted-foreground">Enter the actual finish time in the saved work timezone ({zone || "not set"}). This is a correction request, not a recorded button press.</p>
      {!isValidTimeZone(zone) && <p role="alert" className="text-xs text-amber-700">A work timezone must be configured before requesting a timestamp correction.</p>}
      <Label htmlFor={`proposed-end-${sessionId}`}>Actual finish time</Label>
      <Input id={`proposed-end-${sessionId}`} type="datetime-local" value={proposedEnd} onChange={(event) => setProposedEnd(event.target.value)} />
      <Label htmlFor={`clock-reason-${sessionId}`}>What happened?</Label>
      <Textarea id={`clock-reason-${sessionId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} />
      <Button disabled={action.isPending || !proposedEnd || !reason.trim() || !isValidTimeZone(zone)} onClick={() => { setCorrectionSessionId(sessionId); action.mutate("exception"); }}>Submit for review</Button>
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
      <p className="mt-2 text-xs text-muted-foreground">
        {selectedContract?.workTimezone && !isValidTimeZone(selectedContract.workTimezone)
          ? `The saved value “${selectedContract.workTimezone}” is not a valid IANA timezone. Choose and confirm a valid timezone.`
          : "Choose and confirm the timezone used for this engagement."}
        {browserSuggestion ? ` Browser suggestion: ${browserSuggestion}; it will not be saved unless you confirm it.` : ""}
      </p>
    </div>;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/my-applications" className="text-sm text-primary hover:underline">← My Applications</Link>
      <h1 className="mt-5 text-3xl font-semibold">Time In / Time Out</h1>
      <p className="mt-2 text-sm text-muted-foreground">Attendance records for your actual Client engagements. OnSpot records your clock actions; it is not a separate payroll calculator.</p>
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
                {needsResolution && <p className="mt-2 text-sm text-amber-700">{active.status === "exception_pending" ? "Your missed Clock Out request is awaiting OnSpot review. This session cannot be used for approved hours yet." : "A Clock Out is missing. Submit a correction for OnSpot review; this session will not be silently closed."}</p>}
                {!validZone && selectedContract && <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-amber-800">This open session has no valid saved work timezone. Confirm one for its engagement; elapsed time and the original start remain unchanged.</p>
                  {timezoneEditor()}
                </div>}
              </div>
              {!needsResolution && <Button disabled={action.isPending} onClick={() => action.mutate("out")}>{action.isPending ? "Recording…" : "Clock Out"}</Button>}
              {(active.status === "exception_detected" || active.status === "exception_rejected") && correctionForm(active.id)}
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
                {selectedContract?.timezoneLocked && isValidTimeZone(selectedContract.workTimezone)
                  ? <p className="mt-2 font-medium">{selectedContract.workTimezone}</p>
                  : timezoneEditor()}
                {selectedContract?.timezoneLocked && isValidTimeZone(selectedContract.workTimezone) && <p className="mt-2 text-xs text-muted-foreground">Saved for this engagement and locked after recorded work.</p>}
                {validZone && <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work timezone local time</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatWorkClock(now, workZone)}</p><p className="text-xs text-muted-foreground">{workZone} · {timezoneOffsetLabel(now, workZone)}</p></div><div className="text-right text-sm text-muted-foreground">{formatWorkClock(now, workZone, true)}</div></div>}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Timer className="h-4 w-4" />Ready to start work</div>
              <p className="text-3xl font-semibold tabular-nums">00:00:00</p>
              {!validZone && <p role="alert" className="text-sm text-amber-700">Clock In is available after you choose and save a valid work timezone for this engagement.</p>}
              <Button disabled={action.isPending || !selectedId || !validZone} onClick={() => action.mutate("in")}>{action.isPending ? "Recording…" : "Clock In"}</Button>
            </> : <p className="text-sm text-muted-foreground">Clock controls appear when you have a signed tracked hiring contract.</p>}
          </CardContent>
        </Card>}
      {completedSession && <Card className="mt-6"><CardHeader><CardTitle>Session completed</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
        <p>Started: {formatWorkTime(completedSession.startedAt, completedSession.workTimezone || workZone)}</p>
        <p>Ended: {formatWorkTime(completedSession.endedAt || completedSession.effectiveEndAt, completedSession.workTimezone || workZone)}</p>
        {completedSession.durationSeconds != null && <p>Duration: <span className="font-semibold tabular-nums">{formatElapsed(completedSession.durationSeconds)}</span></p>}
        <p className="text-muted-foreground">Recorded in {completedSession.workTimezone || workZone || "an unspecified work timezone"}.</p>
      </CardContent></Card>}
      {!!data?.recentSessions.length && <Card className="mt-6">
        <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.recentSessions.filter((session) => session.id !== active?.id).map((session) => {
            const sessionZone = session.workTimezone || data.contracts.find((item) => item.id === session.hiringContractId)?.workTimezone;
            return <div key={session.id} className="space-y-2 border-b pb-3 last:border-0">
              <div className="flex flex-wrap justify-between gap-2"><span>{formatWorkTime(session.startedAt, sessionZone)} → {formatWorkTime(session.effectiveEndAt || session.endedAt, sessionZone)}</span><span className="text-muted-foreground">{session.status === "exception_approved" ? "Approved correction" : session.status === "completed" ? "Completed" : "Needs review"}</span></div>
              <p className="text-xs text-muted-foreground">{sessionZone || "Work timezone not set"}{session.durationSeconds != null ? ` · ${formatElapsed(session.durationSeconds)}` : ""}</p>
              {(session.status === "exception_detected" || session.status === "exception_rejected") && (correctionSessionId === session.id ? correctionForm(session.id) : <Button variant="outline" size="sm" onClick={() => setCorrectionSessionId(session.id)}>Request correction</Button>)}
              {session.status === "exception_pending" && <p className="text-amber-700">Correction awaiting OnSpot review.</p>}
            </div>;
          })}
        </CardContent>
      </Card>}
    </main>
  );
}
