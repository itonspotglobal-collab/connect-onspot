import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock3, Loader2 } from "lucide-react";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Session = {
  id: string;
  hiringContractId: string;
  startedAt: string;
  endedAt?: string | null;
  status: "active" | "completed" | "exception_detected" | "exception_pending" | "exception_approved" | "exception_rejected";
};
type Contract = { id: string; jobTitle: string; clientName?: string };
type ClockData = { contracts: Contract[]; activeSession: Session | null; recentSessions: Session[] };

const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
function showTime(value?: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? "The clock could not be updated. Please try again.";
}

export default function Clock() {
  const client = useQueryClient();
  const [contractId, setContractId] = useState("");
  const [proposedEnd, setProposedEnd] = useState("");
  const [reason, setReason] = useState("");
  const [correctionSessionId, setCorrectionSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { data, isLoading, error, refetch } = useQuery<ClockData>({
    queryKey: ["/api/talent/clock"],
    queryFn: () => authAPI.get("/api/talent/clock"),
    refetchInterval: 60_000,
  });
  const action = useMutation({
    mutationFn: async (kind: "in" | "out" | "exception") => {
      if (kind === "in") return authAPI.post("/api/talent/clock/in", { hiringContractId: contractId || data?.contracts[0]?.id });
      if (kind === "out") return authAPI.post("/api/talent/clock/out", {});
      const instant = new Date(proposedEnd);
      if (!proposedEnd || Number.isNaN(instant.getTime()) || !reason.trim()) {
        throw new Error("Enter the missing Clock Out time and a reason.");
      }
      return authAPI.post("/api/talent/clock/exception", {
        sessionId: correctionSessionId || data?.activeSession?.id, proposedEndAt: instant.toISOString(), reason: reason.trim(),
      });
    },
    onSuccess: (_result, kind) => {
      setMessage(kind === "in" ? "Clocked in." : kind === "out" ? "Clocked out." : "Request sent to OnSpot for review.");
      setReason("");
      setProposedEnd("");
      setCorrectionSessionId(null);
      client.invalidateQueries({ queryKey: ["/api/talent/clock"] });
    },
    onError: (failure) => setMessage(failure instanceof Error && !("response" in failure) ? failure.message : errorMessage(failure)),
  });
  const active = data?.activeSession;
  const needsResolution = active?.status === "exception_detected" || active?.status === "exception_pending" || active?.status === "exception_rejected";
  const selectedContract = data?.contracts.find((item) => item.id === active?.hiringContractId);
  const correctionForm = (sessionId: string) => <div className="space-y-3 rounded-lg border p-4">
    <p className="font-medium">Request a missed Clock Out correction</p>
    <p className="text-xs text-muted-foreground">Enter the time in your local timezone ({localZone}). This is a correction request, not a recorded button press.</p>
    <Label htmlFor={`proposed-end-${sessionId}`}>Actual finish time</Label>
    <Input id={`proposed-end-${sessionId}`} type="datetime-local" value={proposedEnd} onChange={(event) => setProposedEnd(event.target.value)} />
    <Label htmlFor={`clock-reason-${sessionId}`}>What happened?</Label>
    <Textarea id={`clock-reason-${sessionId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} />
    <Button disabled={action.isPending || !proposedEnd || !reason.trim()} onClick={() => { setCorrectionSessionId(sessionId); action.mutate("exception"); }}>Submit for review</Button>
  </div>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/my-applications" className="text-sm text-primary hover:underline">← My Applications</Link>
      <h1 className="mt-5 text-3xl font-semibold">Time In / Time Out</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Press the button when you start and finish work. Times are recorded by OnSpot at the time you press it, and shown here in {localZone}.
      </p>
      {message && <p role="status" className="mt-5 rounded-md border px-4 py-3 text-sm">{message}</p>}
      {isLoading ? <p className="mt-8 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading clock…</p>
        : error ? <div className="mt-8"><p role="alert">Could not load the clock.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
        : <Card className="mt-7">
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> Work session</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {active ? <>
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium">{selectedContract?.jobTitle ?? "Your current contract"}</p>
                <p className="mt-1 text-sm">Time In: {showTime(active.startedAt)} ({localZone})</p>
                {needsResolution && <p className="mt-2 text-sm text-amber-700">
                  {active.status === "exception_pending"
                    ? "Your missed Clock Out request is awaiting OnSpot review. This session cannot be used for approved hours yet."
                    : "A Clock Out is missing. Submit a correction for OnSpot review; this session will not be silently closed."}
                </p>}
              </div>
              {!needsResolution && <Button disabled={action.isPending} onClick={() => action.mutate("out")}>
                {action.isPending ? "Recording…" : "Clock Out"}
              </Button>}
              {(active.status === "exception_detected" || active.status === "exception_rejected") && correctionForm(active.id)}
            </> : data?.contracts.length ? <>
              <div className="space-y-2">
                <Label htmlFor="clock-contract">Contract</Label>
                <select id="clock-contract" className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={contractId || data.contracts[0].id} onChange={(event) => setContractId(event.target.value)}>
                  {data.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.jobTitle}{contract.clientName ? ` · ${contract.clientName}` : ""}</option>)}
                </select>
              </div>
              <Button disabled={action.isPending} onClick={() => action.mutate("in")}>{action.isPending ? "Recording…" : "Clock In"}</Button>
            </> : <p className="text-sm text-muted-foreground">Clock controls appear when you have a signed hiring contract.</p>}
          </CardContent>
        </Card>}
      {!!data?.recentSessions.length && <Card className="mt-6">
        <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.recentSessions.filter((session) => session.id !== active?.id).map((session) => <div key={session.id} className="space-y-2 border-b pb-3 last:border-0">
            <div className="flex flex-wrap justify-between gap-2">
              <span>{showTime(session.startedAt)} → {showTime(session.endedAt)}</span>
              <span className="text-muted-foreground">{session.status === "exception_approved" ? "Approved correction" : session.status === "completed" ? "Completed" : "Needs review"}</span>
            </div>
            {(session.status === "exception_detected" || session.status === "exception_rejected") && (
              correctionSessionId === session.id ? correctionForm(session.id) : <Button variant="outline" size="sm" onClick={() => setCorrectionSessionId(session.id)}>Request correction</Button>
            )}
            {session.status === "exception_pending" && <p className="text-amber-700">Correction awaiting OnSpot review.</p>}
          </div>)}
        </CardContent>
      </Card>}
    </main>
  );
}