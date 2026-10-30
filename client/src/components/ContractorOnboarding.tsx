import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check, Circle, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export interface OnboardingStage {
  key: string;
  label: string;
  complete: boolean;
  current: boolean;
  actor: string | null;
}
export interface ContractorOnboarding {
  policy: "legacy" | "deposit_first";
  submissionId: string;
  status: string;
  shortlistSatisfied: boolean;
  finalInterviewPassed: boolean;
  canScheduleInterview: boolean;
  canSendOffer: boolean;
  defaultInterviewType: string;
  offerId: string | null;
  deposit: { id: string; status: string; amount?: string; currency?: string; paymentStatus: string; invoiceUrl: string | null } | null;
  contract: { id: string; status: string; url: string | null } | null;
  msa: { version: string | null; signed: boolean; available: boolean; url: string | null };
  conditions: { depositHeld: boolean; contractSigned: boolean; msaSigned: boolean };
  canPrepareContract: boolean;
  missing: string[];
  offerBlockers?: string[];
  activationMissing?: string[];
  stageMissing?: string[];
  offerAccepted?: boolean;
  msaUploadWarning?: string | null;
  nextActor: string | null;
  stages: OnboardingStage[];
}

export function useContractorOnboarding(submissionId?: string) {
  return useQuery<ContractorOnboarding>({
    queryKey: ["/api/contractor-onboarding", submissionId],
    queryFn: async () => (await apiRequest("GET", `/api/contractor-onboarding/${encodeURIComponent(submissionId!)}`)).json(),
    enabled: Boolean(submissionId),
    retry: false,
  });
}

export function ContractorOnboardingTracker({
  data, isLoading, isError, onRetry, onShortlist, compact = false,
}: {
  data?: ContractorOnboarding;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onShortlist?: () => void;
  compact?: boolean;
}) {
  const [, navigate] = useLocation();
  if (isLoading) return <div aria-label="Loading onboarding stages" className="space-y-2 rounded-xl border border-slate-200 bg-[#f8faf8] p-4"><div className="h-3 w-36 animate-pulse rounded bg-slate-200" /><div className="h-8 animate-pulse rounded bg-slate-100" /><div className="h-8 animate-pulse rounded bg-slate-100" /></div>;
  if (isError || !data) return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />Onboarding details are unavailable. Existing application workflow remains unchanged.</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
  const stages = data.stages?.length ? data.stages : [];
  return (
    <section aria-label="Contractor onboarding progress" className="rounded-xl border border-[#dce5df] bg-[#f7faf7] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#557064]">Hiring journey</p>
          <p className="mt-1 text-xs text-slate-600">{data.nextActor ? `Next action · ${data.nextActor}` : "Progress updated from the application record"}</p></div>
        {data.policy === "legacy" && <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">Legacy workflow</span>}
      </div>
      {stages.length > 0 ? (
        <ol className={`mt-4 grid ${compact ? "grid-cols-2 gap-2 sm:grid-cols-4" : "grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8"}`}>
          {stages.map((stage, index) => (
            <li key={stage.key} className={`relative min-w-0 rounded-lg border px-2.5 py-2 ${stage.current ? "border-[#709081] bg-[#e8f0eb]" : stage.complete ? "border-[#d5e2d9] bg-white" : "border-slate-200 bg-white/60"}`}>
              <div className="flex items-center gap-1.5">
                {stage.complete ? <Check className="h-3.5 w-3.5 shrink-0 text-[#417052]" /> : stage.current ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#557064]" /> : <Circle className="h-3 w-3 shrink-0 text-slate-300" />}
                <span className={`truncate text-[11px] font-semibold ${stage.current ? "text-[#344f40]" : stage.complete ? "text-slate-700" : "text-slate-500"}`}>{stage.label}</span>
              </div>
              {stage.actor && <p className="mt-1 truncate pl-5 text-[9px] text-slate-400">{stage.actor}</p>}
              {index < stages.length - 1 && <span className="sr-only">followed by</span>}
            </li>
          ))}
        </ol>
      ) : <p className="mt-3 text-xs text-slate-500">Stage details have not been provided yet.</p>}
      {!!(data.stageMissing??data.missing)?.length && <p className="mt-3 text-xs leading-relaxed text-amber-800">Still needed: {(data.stageMissing??data.missing).join(" · ")}</p>}
      {data.offerAccepted && data.deposit?.status==="pending" && data.deposit.invoiceUrl && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold">Deposit required · {data.deposit.currency} {data.deposit.amount}</p>
          <p className="mt-1 text-xs">Agreements can be prepared once OnSpot independently verifies the deposit.</p>
          <Button size="sm" className="mt-2" onClick={()=>navigate(data.deposit!.invoiceUrl!)}>View deposit invoice</Button>
        </div>
      )}
      {data.msaUploadWarning&&<p role="alert" className="mt-2 text-xs text-amber-800">{data.msaUploadWarning}</p>}
      {data.contract?.id && <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/contracts?id=${encodeURIComponent(data.contract!.id)}`)}>
        {data.contract.status === "draft" ? "Manage agreement draft" : "Open agreement"}
      </Button>}
      {onShortlist && !data.shortlistSatisfied && data.policy === "deposit_first" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#dce5df] pt-3">
          <p className="text-xs text-slate-600">Shortlisting is required before an interview can be scheduled.</p>
          <Button size="sm" onClick={onShortlist} className="bg-[#405f4d] text-white hover:bg-[#344d3e]">Shortlist applicant</Button>
        </div>
      )}
      {!data.offerAccepted && data.policy === "deposit_first" && !data.canSendOffer && !!data.offerBlockers?.length && (
        <p className="mt-2 text-[11px] text-slate-500">Offer unavailable: {data.offerBlockers.join(", ")}.</p>
      )}
    </section>
  );
}

export function OnboardingLoadingMark() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />;
}
