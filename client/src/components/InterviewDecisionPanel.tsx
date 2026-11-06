import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getAdvanceAvailability } from "@/lib/getAdvanceAvailability";
import {formatInterviewTime} from "@/lib/formatInterviewTime";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export function InterviewDecisionPanel({
  interview, admin = false, onRejectBeforeStart, onScheduleNext, onFinalAdvance,
}: {
  interview: any; admin?: boolean; onRejectBeforeStart?: () => void; onScheduleNext?: () => void; onFinalAdvance?: () => void;
}) {
  const cache = useQueryClient();
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [successfulAdvance, setSuccessfulAdvance] = useState(false);
  const [localDecision,setLocalDecision]=useState<"advance"|"reject"|"pending"|null>(null);
  const effectiveOutcome=localDecision??interview.outcome;
  const [outcome, setOutcome] = useState<"advance" | "reject">("advance");
  const [notes, setNotes] = useState("");
  const [finalRound, setFinalRound] = useState((interview.interview_type ?? interview.interviewType) === "final");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(()=>{setNow(Date.now());setSuccessfulAdvance(false);setLocalDecision(null);setOpen(false);setNotes("");},[interview.id]);
  const availability = getAdvanceAvailability({...interview,outcome:effectiveOutcome}, now);
  const currentType = interview.interview_type ?? interview.interviewType ?? "initial";
  const started = availability.available;
  const mutation = useMutation({
    mutationFn: async ({ decision, isFinal }: { decision: "advance" | "reject" | "pending"; isFinal: boolean }) => {
      const prefix = admin ? "/api/admin" : "/api/client";
      const response = await apiRequest("PATCH", `${prefix}/interviews/${interview.id}/outcome`, {
        outcome: decision, internalNotes: notes, interviewType: isFinal ? "final" : currentType,
      });
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      setLocalDecision(variables.decision);
      setFinalRound(variables.isFinal);
      await Promise.all([
        cache.invalidateQueries({ predicate: q => q.queryKey.some(k => typeof k === "string" && /interview|application|contractor-onboarding/i.test(k)) }),
      ]);
      setOpen(false);
      if (variables.decision === "pending") toast({ title: "Interview marked as pending" });
      else if (variables.decision === "advance" && variables.isFinal) {
        toast({ title: "Final interview passed" });
        onFinalAdvance?.();
      } else if (variables.decision === "advance") { setSuccessfulAdvance(true); toast({ title: "Interview advanced" }); }
      else toast({ title: "Applicant rejected" });
      setNotes("");
    },
    onError: (error) => toast({ title: "Could not record interview decision", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });
  if (!interview || interview.status === "cancelled") return null;
  const recorded = effectiveOutcome && effectiveOutcome !== "pending";
  const advanced = effectiveOutcome === "advance" || effectiveOutcome === "passed" || successfulAdvance;
  const round = interview.round_number ?? interview.roundNumber ?? "—";
  const confirmed = interview.confirmed_time ?? interview.confirmedTime;
  return <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm" aria-label="Interview decision">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="font-semibold text-slate-900">Round {round} · {String(currentType).replace(/^./, c => c.toUpperCase())} interview</p>
        {confirmed && <p className="mt-1 text-xs text-slate-600">Confirmed: {formatInterviewTime(confirmed,interview.confirmed_time_zone??interview.confirmedTimeZone??"UTC")}</p>}
      </div>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{interview.status}</span>
    </div>
    {recorded ? <p className="mt-3 flex items-center gap-2 border-t pt-3 font-semibold text-slate-700">
      {effectiveOutcome === "advance" || effectiveOutcome === "passed" ? <><Check className="h-4 w-4 text-emerald-700" />Advanced ✓</> : effectiveOutcome === "reject" || effectiveOutcome === "rejected" ? "Rejected" : String(effectiveOutcome)}
    </p> : <>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button className="w-full bg-emerald-700 text-white hover:bg-emerald-800" disabled={!availability.available || mutation.isPending}
          onClick={() => { setOutcome("advance"); setFinalRound(currentType === "final"); setOpen(true); }}>
          {currentType === "final" ? "Advance to offer" : "Advance to next round"}
        </Button>
        <Button className="w-full border-rose-300 text-rose-700 hover:bg-rose-50" variant="outline" disabled={mutation.isPending}
          onClick={() => { if (started) { setOutcome("reject"); setFinalRound(currentType === "final"); setOpen(true); } else onRejectBeforeStart?.(); }}>
          Reject
        </Button>
      </div>
      {!availability.available && <p className="mt-2 text-xs text-slate-600">{availability.reason}</p>}
      {started && !effectiveOutcome && <button type="button" className="mt-2 text-xs font-medium text-slate-600 underline underline-offset-2"
        disabled={mutation.isPending} onClick={() => mutation.mutate({ decision: "pending", isFinal: currentType === "final" })}>Mark as pending</button>}
      {!availability.available && <aside data-testid="interview-skip-known-limitation" className="mt-3 rounded-md border border-slate-200 bg-sky-50/70 p-3 text-slate-700">
        <div className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" /><div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">Skipping an interview isn't available yet</p><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">Known limitation</span></div>
          <p className="mt-1 text-xs leading-relaxed">An interview must take place before the candidate can be advanced. This is expected behavior, not an error — a skip option is planned for a future release.{admin ? " For testing or exceptions, admins can use 'Admin bypass → Skip this step' below." : ""}</p>
        </div></div>
      </aside>}
    </>}
    {advanced && (localDecision ? !finalRound : currentType !== "final") && onScheduleNext && <Button size="sm" variant="outline" className="mt-3" onClick={onScheduleNext}>Schedule next round</Button>}
    <Dialog open={open} onOpenChange={value=>{if(!mutation.isPending)setOpen(value);}}>
      <DialogContent>
        <DialogHeader><DialogTitle>{outcome === "advance" ? (finalRound ? "Advance to offer?" : "Advance to next round?") : "Reject applicant?"}</DialogTitle>
          <DialogDescription>{outcome === "advance" ? "Record the interview decision. No payment or agreement state is changed." : "This records a rejection for the interview."}</DialogDescription></DialogHeader>
        <Label className="flex items-center gap-2"><Checkbox checked={finalRound} disabled={mutation.isPending||effectiveOutcome==="pending"} onCheckedChange={v => setFinalRound(v === true)} />This was the final round</Label>
        <Label>Internal notes (optional)<Textarea value={notes} disabled={mutation.isPending} maxLength={5000} onChange={e => setNotes(e.target.value)} /></Label>
        {mutation.error&&<p role="alert" className="text-sm text-rose-700">{(mutation.error as Error).message}</p>}
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ decision: outcome, isFinal: finalRound })}>{mutation.isPending ? "Saving…" : outcome === "advance" ? "Confirm advance" : "Confirm rejection"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
