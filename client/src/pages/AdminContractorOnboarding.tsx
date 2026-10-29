import { useQuery } from "@tanstack/react-query";
import { AdminMsaWarning } from "@/components/AdminMsaWarning";
import { PaymentVerificationCard } from "@/components/hiring-payments/PaymentVerificationCard";
import { apiRequest } from "@/lib/queryClient";
import { ContractorOnboarding, ContractorOnboardingTracker } from "@/components/ContractorOnboarding";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RotateCw, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

interface AdminOnboardingRecord extends ContractorOnboarding {
  jobTitle?: string;
  talentName?: string;
  clientName?: string;
}
export default function AdminContractorOnboarding() {
  const [, navigate] = useLocation();
  const { data, isLoading, isError, refetch } = useQuery<{ items: AdminOnboardingRecord[] }>({
    queryKey: ["/api/admin/contractor-onboarding"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/contractor-onboarding")).json(),
  });
  const records = data?.items ?? [];
  const needsAttention = records.filter((item) => item.policy === "deposit_first" && (item.status === "offer_accepted" || item.status === "contract_sent" || item.status === "contract_signed") && item.missing?.length);
  const legacyCount = records.filter((item) => item.policy === "legacy").length;
  return <div className="min-h-[100dvh] bg-[#f3f6f2]"><TopNavigation /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#557064]">Operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#20352a]">Contractor onboarding</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Review accepted offers, payment verification, and the three conditions required to activate each engagement.</p></div><Button variant="outline" onClick={() => refetch()}><RotateCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    <AdminMsaWarning />
    {new URLSearchParams(window.location.search).get("applicationId")&&<div className="mb-4"><PaymentVerificationCard submissionId={new URLSearchParams(window.location.search).get("applicationId")!} /></div>}
    {records.length>0&&<details className="mb-5 rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Application payment verification</summary><div className="mt-3 space-y-3">{records.map(r=><div key={r.submissionId}><p className="mb-1 text-xs text-slate-500">{r.jobTitle||"Contractor role"} · {r.submissionId}</p><PaymentVerificationCard submissionId={r.submissionId} /></div>)}</div></details>}
    {isLoading ? <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-36 animate-pulse rounded-2xl bg-white" />)}</div>
      : isError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><AlertCircle className="mr-2 inline h-4 w-4" />Could not load onboarding records. <button className="underline" onClick={() => refetch()}>Retry</button></div>
      : <>
        <div className="mb-5 flex flex-wrap gap-3"><div className="rounded-xl border border-[#dce5df] bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Needs follow-up</p><p className="mt-1 text-2xl font-semibold text-[#344f40]">{needsAttention.length}</p></div><div className="rounded-xl border border-[#dce5df] bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Legacy in-flight</p><p className="mt-1 text-2xl font-semibold text-slate-700">{legacyCount}</p></div></div>
        {needsAttention.length > 0 ? <div className="space-y-4">{needsAttention.map((record) => <Card key={record.submissionId} className="border-[#dce5df] shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#557064]" /><h2 className="font-semibold text-slate-900">{record.talentName || "Talent"} · {record.jobTitle || "Contractor role"}</h2></div><p className="mt-1 text-xs text-slate-500">{record.clientName || "Client"} · Application {record.submissionId}</p></div><Button size="sm" variant="outline" onClick={() => navigate(`/admin/job-applications?applicationId=${encodeURIComponent(record.submissionId)}`)}>Open application</Button></div><ContractorOnboardingTracker data={record} compact /></CardContent></Card>)}</div>
          : <div className="rounded-2xl border border-dashed border-[#cbd9cf] bg-white/70 p-9 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-[#557064]" /><h2 className="mt-3 font-semibold text-slate-800">No accepted offers are blocked</h2><p className="mt-1 text-sm text-slate-500">When offers need deposit verification or signed agreements, their missing conditions will appear here.</p></div>}
        {legacyCount > 0 && <p className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">{legacyCount} legacy application{legacyCount === 1 ? " remains" : "s remain"} on the prior workflow and are listed for visibility only. They will not be rebilled or re-contracted.</p>}
      </>}
  </main></div>;
}
