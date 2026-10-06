import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import type { ContractRow } from "@/components/ContractWorkflow";

export function ContractApplicationPanel({ submissionId, acceptedOfferId }: { submissionId: string; acceptedOfferId?: string | null }) {
  const [, navigate] = useLocation();
  const { data: contracts, isLoading, isError, refetch } = useQuery<ContractRow[]>({
    queryKey: ["/api/contracts", "application", submissionId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/contracts");
      const all = await response.json() as ContractRow[];
      return all.filter((contract) => contract.submission_id === submissionId);
    },
  });
  const active = contracts?.find((contract) => !["voided", "declined"].includes(contract.status));
  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-slate-900">Hiring contract</h3><p className="mt-1 text-xs text-slate-600">Private PDF, signature record, and current signing stage.</p></div>
        <FileText className="h-5 w-5 shrink-0 text-indigo-600" />
      </div>
      {isLoading ? <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading contract status…</div>
        : isError ? <div className="mt-3 flex items-center justify-between gap-3 text-xs text-rose-700"><span>Could not load contract status.</span><Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button></div>
        : active ? <div className="mt-3 rounded-md border border-indigo-100 bg-white p-3">
          <p className="text-sm font-semibold capitalize text-slate-800">{active.title || active.job_title}</p>
          <p className="mt-1 text-xs capitalize text-slate-500">{active.status.replaceAll("_", " ")}{active.document_status ? ` · document ${active.document_status.replaceAll("_", " ")}` : ""}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/contracts?id=${encodeURIComponent(active.id)}`)}>Open secure contract</Button>
        </div> : acceptedOfferId ? <div className="mt-3">
          <p className="text-xs text-slate-600">The accepted offer is ready for a private PDF agreement.</p>
          <Button size="sm" className="mt-2 bg-[#474ead] text-white hover:bg-[#3d439c]" onClick={() => navigate(`/contracts?offerId=${encodeURIComponent(acceptedOfferId)}`)}><FileText className="mr-1.5 h-3.5 w-3.5" />Prepare Contract</Button>
        </div> : <p className="mt-3 text-xs text-slate-500">A contract can be prepared after an offer is accepted.</p>}
    </section>
  );
}
