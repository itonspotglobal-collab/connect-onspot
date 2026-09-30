import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock3, RefreshCw } from "lucide-react";

type Role = "talent" | "client" | "admin";
type Session = { id: string; startedAt: string; endedAt: string | null; effectiveEndAt: string | null; status: string };
type Correction = { id: string; sessionId: string; requestedStartedAt: string | null; requestedEndAt: string | null; reason: string; status: string; decisionReason: string | null; createdAt: string; decidedAt: string | null };
type Period = {
  id: string; hiringContractId: string; periodStart: string; periodEnd: string; status: string;
  workTimezone: string | null; jobTitle: string; clientName: string | null; days: Array<{ date: string; hours: number }>;
  totalHours: number; approvalBlocked: boolean; blockingIssues: string[]; sessions: Session[];
  revisions: Array<{ id: string; version: number; reason: string; exceptionApproved: boolean; createdAt: string }>;
  corrections: Correction[];
  disputes: Array<{ id: string; reason: string; status: string; resolutionReason: string | null; createdAt: string; resolvedAt: string | null }>;
};

const fmt = (instant: string | null | undefined, timezone?: string | null) => {
  if (!instant) return "Not recorded";
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", ...(timezone ? { timeZone: timezone } : {}) }).format(date);
};
const zonedParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
};
const inputInstant = (value: string, timezone?: string | null) => {
  if (!value) return undefined;
  if (!timezone) return new Date(value).toISOString();
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(instant), timezone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    instant += target - represented;
  }
  return new Date(instant).toISOString();
};
const localInput = (value?: string | null, timezone?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (timezone) {
    const p = zonedParts(date, timezone);
    return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  }
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
};

export default function Timesheets({ role }: { role: Role }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");
  const [correctionSession, setCorrectionSession] = useState("");
  const [correctionStart, setCorrectionStart] = useState("");
  const [correctionEnd, setCorrectionEnd] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"approve" | "reject" | "edit" | "exception">("approve");
  const [sessionEdits, setSessionEdits] = useState<Record<string, { startedAt: string; endedAt: string }>>({});
  const [correctionDecisions, setCorrectionDecisions] = useState<Record<string, "approve" | "reject">>({});
  const endpoint = `/api/${role}/timesheets`;
  const { data, isLoading, isError, error, refetch } = useQuery<{ periods: Period[] }>({
    queryKey: [endpoint],
    queryFn: async () => (await apiRequest("GET", endpoint)).json(),
  });
  const periods = data?.periods ?? [];
  const activeId = selectedId && periods.some((period) => period.id === selectedId) ? selectedId : periods[0]?.id;
  const period = useMemo(() => periods.find((item) => item.id === activeId), [periods, activeId]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [endpoint] });
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
  const submitCorrection = () => {
    if (!period || !correctionSession || !correctionReason.trim() || (!correctionStart && !correctionEnd)) return;
    mutate.mutate({
      path: `${endpoint}/${period.id}/corrections`,
      body: { corrections: [{ sessionId: correctionSession, ...(correctionStart ? { startedAt: inputInstant(correctionStart, period.workTimezone) } : {}), ...(correctionEnd ? { endedAt: inputInstant(correctionEnd, period.workTimezone) } : {}), reason: correctionReason.trim() }] },
    });
    setCorrectionStart(""); setCorrectionEnd(""); setCorrectionReason(""); setCorrectionSession("");
  };
  const review = (decision: "approve" | "reject" | "edit" | "exception") => {
    if (!period || !reviewReason.trim()) return;
    const edits = Object.entries(sessionEdits).filter(([, times]) => times.startedAt && times.endedAt)
      .map(([sessionId, times]) => ({ sessionId, startedAt: inputInstant(times.startedAt, period.workTimezone), endedAt: inputInstant(times.endedAt, period.workTimezone) }));
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
            <p className="mt-2 text-sm text-slate-600">{role === "talent" ? "Review recorded work periods and request timestamp corrections against a clock session." : role === "client" ? "Review submitted work periods, daily totals and recorded sessions." : "Review submitted periods, correction proposals and clock anomalies."}</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </header>
        {isLoading ? <p className="py-12 text-center text-sm text-slate-500">Loading timesheets…</p>
          : isError ? <Card><CardContent className="p-6 text-sm text-red-700">Unable to load timesheets: {(error as Error).message}</CardContent></Card>
          : !periods.length ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">No timesheet periods are available yet.</CardContent></Card>
          : <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-2">
              {periods.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-4 text-left transition ${activeId === item.id ? "border-indigo-300 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <span className="block text-sm font-semibold text-slate-900">{item.jobTitle}</span>
                {role !== "client" && item.clientName && <span className="mt-1 block text-xs text-slate-500">{item.clientName}</span>}
                <span className="mt-2 block text-xs text-slate-500">{item.periodStart} – {item.periodEnd}</span>
                <span className="mt-2 flex justify-between text-xs"><span className="capitalize text-indigo-700">{item.status}</span><b>{item.totalHours.toFixed(2)} hrs</b></span>
              </button>)}
            </aside>
            {period && <section className="space-y-5">
              <Card><CardContent className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-xl font-semibold text-slate-950">{period.jobTitle}</h2><p className="mt-1 text-sm text-slate-500">{period.periodStart} – {period.periodEnd}{role !== "client" && period.clientName ? ` · ${period.clientName}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-500">Work timezone: {period.workTimezone || "Not specified"} · Contract {period.hiringContractId}</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold capitalize text-slate-700">{period.status}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-indigo-50 p-4"><p className="text-xs font-medium text-indigo-700">Period total</p><p className="mt-1 text-2xl font-bold text-slate-950">{period.totalHours.toFixed(2)} <span className="text-sm font-medium">hours</span></p></div>
                  <div className="rounded-lg border border-slate-100 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Daily totals</p><div className="flex flex-wrap gap-x-4 gap-y-1">{period.days.map((day) => <span key={day.date} className="text-xs text-slate-700">{day.date}: <b>{day.hours.toFixed(2)}h</b></span>)}</div></div>
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
                    {role === "admin" && <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-slate-600">Final start timestamp ({period.workTimezone || "browser timezone"})<input aria-label={`Final start for session ${session.id}`} type="datetime-local" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={sessionEdits[session.id]?.startedAt ?? localInput(session.startedAt, period.workTimezone)} onChange={(e) => setSessionEdits({ ...sessionEdits, [session.id]: { startedAt: e.target.value, endedAt: sessionEdits[session.id]?.endedAt ?? localInput(end, period.workTimezone) } })} /></label>
                      <label className="text-xs text-slate-600">Final end timestamp ({period.workTimezone || "browser timezone"})<input aria-label={`Final end for session ${session.id}`} type="datetime-local" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={sessionEdits[session.id]?.endedAt ?? localInput(end, period.workTimezone)} onChange={(e) => setSessionEdits({ ...sessionEdits, [session.id]: { startedAt: sessionEdits[session.id]?.startedAt ?? localInput(session.startedAt, period.workTimezone), endedAt: e.target.value } })} /></label>
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

              {period.corrections.length > 0 && <Card><CardContent className="p-5 md:p-6"><h3 className="font-semibold text-slate-900">Timestamp correction requests</h3><div className="mt-3 space-y-2">{period.corrections.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b className="text-slate-800">Session {item.sessionId}</b><span className="text-xs capitalize text-slate-500">{item.status}</span></div><p className="mt-1 text-xs text-slate-600">{item.reason}</p><p className="mt-1 text-xs text-slate-500">Requested: {item.requestedStartedAt ? fmt(item.requestedStartedAt, period.workTimezone) : "start unchanged"} – {item.requestedEndAt ? fmt(item.requestedEndAt, period.workTimezone) : "end unchanged"}</p>{role !== "client" && item.decisionReason && <p className="mt-1 text-xs text-slate-500">Decision note: {item.decisionReason}</p>}{role === "admin" && item.status === "pending" && <div className="mt-2 flex gap-2"><Button size="sm" variant={correctionDecisions[item.id] === "approve" ? "default" : "outline"} onClick={() => setCorrectionDecisions({ ...correctionDecisions, [item.id]: "approve" })}>Approve</Button><Button size="sm" variant={correctionDecisions[item.id] === "reject" ? "default" : "outline"} onClick={() => setCorrectionDecisions({ ...correctionDecisions, [item.id]: "reject" })}>Reject</Button></div>}</div>)}</div></CardContent></Card>}

              {role === "talent" && ["open", "rejected"].includes(period.status) && <Card><CardContent className="p-5"><h3 className="font-semibold text-slate-900">Submit timesheet</h3><p className="mt-1 text-sm text-slate-500">Submission sends the recorded clock-derived period for client review.</p><Button className="mt-3" disabled={mutate.isPending || !period.sessions.length} onClick={() => mutate.mutate({ path: `${endpoint}/${period.id}/submit`, body: {} })}>Submit for review</Button></CardContent></Card>}
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