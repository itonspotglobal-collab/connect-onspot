import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Check, Circle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export interface OnboardingStage {
  key: string; label: string; complete: boolean; current: boolean; actor: string | null; overridden?: boolean;
}
export interface ContractorOnboarding {
  policy: "legacy" | "deposit_first"; submissionId: string; status: string; shortlistSatisfied: boolean;
  finalInterviewPassed: boolean; canScheduleInterview: boolean; canSendOffer: boolean; defaultInterviewType: string;
  offerId: string | null;
  deposit: { id: string; status: string; amount?: string; currency?: string; paymentStatus: string; invoiceUrl: string | null; deferredDueAt?: string | null; paymentSource?: string | null; arrangementNote?: string | null } | null;
  contract: { id: string; status: string; url: string | null } | null;
  msa: { version: string | null; signed: boolean; available: boolean; url: string | null };
  conditions: { depositHeld: boolean; contractSigned: boolean; msaSigned: boolean };
  canPrepareContract: boolean; missing: string[]; offerBlockers?: string[]; activationMissing?: string[];
  stageMissing?: string[]; offerAccepted?: boolean; msaUploadWarning?: string | null; dataIssue?: boolean;
  dataIssueMessage?: string; repairUrl?: string | null; paymentState?: string | null;
  setup?: { wiseReady: boolean; msaReady: boolean; clientMessage: string | null }; isTalent?: boolean;
  nextActor: string | null; stages: OnboardingStage[];
}

export function useContractorOnboarding(submissionId?: string) {
  return useQuery<ContractorOnboarding>({
    queryKey: ["/api/contractor-onboarding", submissionId],
    queryFn: async () => (await apiRequest("GET", `/api/contractor-onboarding/${encodeURIComponent(submissionId!)}`)).json(),
    enabled: Boolean(submissionId), retry: false,
  });
}

export function ContractorOnboardingTracker({ data, isLoading, isError, onRetry, onShortlist, compact = false }: {
  data?: ContractorOnboarding; isLoading?: boolean; isError?: boolean; onRetry?: () => void; onShortlist?: () => void; compact?: boolean;
}) {
  const [, navigate] = useLocation();
  const container = useRef<HTMLDivElement>(null);
  const [vertical, setVertical] = useState(true);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (compact || !container.current || typeof ResizeObserver === "undefined") { setVertical(true); return; }
    const observer = new ResizeObserver(entries => setVertical(entries[0].contentRect.width < 660));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [compact, Boolean(data), isLoading, isError, data?.dataIssue]);
  if (isLoading) return <div aria-label="Loading onboarding stages" className="space-y-3 rounded-xl border border-slate-200 bg-[#f8faf8] p-4"><div className="h-3 w-36 animate-pulse rounded bg-slate-200" /><div className="h-7 animate-pulse rounded bg-slate-100" /><div className="h-7 animate-pulse rounded bg-slate-100" /></div>;
  if (isError || !data) return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />Onboarding details are unavailable. Existing application workflow remains unchanged.</span>{onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}</div>;
  const stages = data.stages?.length ? (data.isTalent ? data.stages.filter(s => !/payment|deposit|wise|invoice/i.test(`${s.key} ${s.label}`)) : data.stages) : [];
  if (data.dataIssue) return <section aria-label="Onboarding review needed" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">This application needs OnSpot review</p><p className="mt-1 text-sm">{data.dataIssueMessage || "The onboarding record needs a data repair before its progress can be shown."}</p>{data.repairUrl && <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(data.repairUrl!)}>Open repair record</Button>}</div></div></section>;
  const paymentState = data.paymentState
    ?? (data.deposit?.status === "waived" || data.deposit?.paymentStatus === "waived" ? "Waived"
      : data.deposit?.paymentStatus === "paid" || data.deposit?.paymentStatus === "succeeded" ? "Paid" : undefined);
  const depositStatusCopy = data.isTalent ? "Waiting on OnSpot/client paperwork"
    : paymentState === "Deferred" ? `Deferred · due ${data.deposit?.deferredDueAt ? new Date(data.deposit.deferredDueAt).toLocaleDateString() : "as agreed"}`
      : paymentState === "Waived" ? "Payment waived"
        : paymentState === "Paid" && data.deposit?.paymentSource === "external" ? "Paid (recorded by OnSpot)" : paymentState;
  const markedCurrent = stages.findIndex(stage => stage.current);
  const firstIncomplete = stages.findIndex(stage => !stage.complete);
  const currentIndex = markedCurrent >= 0 ? markedCurrent : firstIncomplete >= 0 ? firstIncomplete : Math.max(0, stages.length - 1);
  const currentStage = stages[currentIndex];
  const currentStep = currentIndex + 1;
  const needed = (data.stageMissing ?? data.missing) ?? [];
  const stepList = vertical && !showAll ? stages.map((stage, index) => ({ stage, index })).filter(({ stage, index }) => stage.current || !stage.complete || index === currentIndex) : stages.map((stage, index) => ({ stage, index }));
  return <section ref={container} aria-label="Contractor onboarding progress" className="rounded-xl border border-[#dce5df] bg-[#f7faf7] p-4 dark:border-slate-700 dark:bg-slate-900/60">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#557064]">Hiring Journey</p>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Step {stages.length ? currentStep : 0} of {stages.length} · {currentStage?.label ?? "Progress not provided"}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-[#547763] transition-[width] duration-300" style={{ width: `${stages.length ? currentStep / stages.length * 100 : 0}%` }} /></div>
      </div>
      {data.policy === "legacy" && <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800">Legacy workflow</span>}
    </div>
    <div className="mt-4 rounded-lg border border-[#dce5df] bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#557064]">Next step</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{currentStage?.label ?? "Progress updated from the application record"}</p></div>
        {data.nextActor && <span className="rounded-full bg-[#edf3ee] px-2.5 py-1 text-[10px] font-semibold text-[#405f4d] dark:bg-slate-700 dark:text-slate-100">Waiting on: {data.nextActor}</span>}
      </div>
      {!!needed.length && !data.isTalent && <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">{needed.map(item => <li key={item} className="flex items-start gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul>}
      {data.isTalent && /agreement|paperwork/i.test(currentStage?.label ?? "") && <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">Waiting on OnSpot/client paperwork</p>}
      {!data.isTalent && data.setup?.clientMessage && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">{data.setup.clientMessage}</p>}
      {data.offerAccepted && !data.isTalent && data.deposit?.status === "pending" && data.deposit.invoiceUrl && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold">Deposit required · {data.deposit.currency} {data.deposit.amount}</p><p className="mt-1 text-xs">Agreements can be prepared once OnSpot independently verifies the deposit.</p><Button size="sm" className="mt-2" onClick={() => navigate(data.deposit!.invoiceUrl!)}>View deposit invoice</Button></div>}
      {data.contract?.id && <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/contracts?id=${encodeURIComponent(data.contract!.id)}`)}>{data.contract.status === "draft" ? "Manage agreement draft" : "Open agreement"}</Button>}
      {onShortlist && !data.shortlistSatisfied && data.policy === "deposit_first" && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#dce5df] pt-3"><p className="text-xs text-slate-600">Shortlisting is required before an interview can be scheduled.</p><Button size="sm" onClick={onShortlist} className="bg-[#405f4d] text-white hover:bg-[#344d3e]">Shortlist applicant</Button></div>}
      {!data.offerAccepted && data.policy === "deposit_first" && !data.canSendOffer && !!data.offerBlockers?.length && <p className="mt-2 text-[11px] text-slate-500">Offer unavailable: {data.offerBlockers.join(", ")}.</p>}
      {data.msaUploadWarning && <p role="alert" className="mt-2 text-xs text-amber-800">{data.msaUploadWarning}</p>}
    </div>
    {stages.length > 0 && <ol className={`mt-4 ${vertical ? "relative space-y-2 border-l border-slate-300 pl-4 dark:border-slate-600" : "flex gap-2 overflow-x-auto pb-2"}`}>
      {stepList.map(({ stage, index }) => {
        const paymentStage = /payment|deposit/i.test(`${stage.key} ${stage.label}`);
        const state = stage.complete ? "Done" : stage.current ? "In progress" : "Up next";
        return <li key={stage.key} aria-current={stage.current ? "step" : undefined} className={`relative min-w-0 ${vertical ? "rounded-lg border px-3 py-2" : "w-36 shrink-0 rounded-lg border p-3"} ${stage.current ? "border-[#709081] bg-[#e8f0eb] dark:bg-emerald-950/30" : stage.complete ? "border-[#d5e2d9] bg-white dark:bg-slate-800" : "border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/50"}`}>
          {vertical && <span className={`absolute -left-[21px] top-3 h-3 w-3 rounded-full border-2 ${stage.current ? "border-[#527661] bg-[#e8f0eb] ring-2 ring-[#b8cbbf]" : stage.complete ? "border-[#527661] bg-[#527661]" : "border-slate-300 bg-slate-100 dark:bg-slate-700"}`} />}
          <div className="flex items-start gap-2">{stage.complete ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#417052]" /> : stage.current ? <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[#527661] ring-2 ring-[#b8cbbf]"><span className="h-1.5 w-1.5 rounded-full bg-[#527661]" /></span> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />}
            <div className="min-w-0"><p className="whitespace-normal break-words text-xs font-semibold leading-snug text-slate-800 dark:text-slate-100">{stage.label}</p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{state}{stage.actor ? ` · ${stage.actor}` : ""}</p>
              {stage.overridden && <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">Bypassed by Admin</span>}
              {paymentStage && (paymentState || data.deposit?.status) && <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{depositStatusCopy ?? data.deposit?.status}</span>}
            </div>
          </div>
          {!vertical && index < stages.length - 1 && <span className="sr-only">followed by</span>}
        </li>;
      })}
    </ol>}
    {vertical && stages.length > 1 && <button type="button" className="mt-2 text-xs font-medium text-[#45664d] underline underline-offset-2" onClick={() => setShowAll(value => !value)}>{showAll ? "Show current steps" : `Show all ${stages.length} steps`}</button>}
  </section>;
}

export function OnboardingLoadingMark() { return <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />; }
