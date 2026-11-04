import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Wrench } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { depositToolError, useSuperAdminTools } from "./useSuperAdminTools";

type RepairItem = { submissionId: string; status: string; jobTitle: string; issues: string[]; candidates: { offerId: string; submissionId: string; status: string }[] };
type Plan = { action: "link_offer" | "issue_deposit" | "revert"; offerId?: string };
type DryRun = { action: string; submissionId: string; summary: string; changes: string[]; fingerprint: string };

export function OnboardingRepairs() {
  const isSuperAdmin = useSuperAdminTools();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<RepairItem | null>(null);
  const [plan, setPlan] = useState<Plan>({ action: "link_offer" });
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [reason, setReason] = useState("");
  const access = useQuery<{ canManage: boolean }>({
    queryKey: ["/api/admin/onboarding-prerequisites"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/onboarding-prerequisites")).json(),
    retry: false,
    enabled: isSuperAdmin,
  });
  const repairs = useQuery<{ items: RepairItem[] }>({
    queryKey: ["/api/admin/onboarding-repairs"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/onboarding-repairs")).json(),
    retry: false,
    enabled: isSuperAdmin && access.data?.canManage === true,
  });
  const preview = useMutation({
    mutationFn: async ({ item, action }: { item: RepairItem; action: Plan }) => (await apiRequest("POST", `/api/admin/onboarding-repairs/${encodeURIComponent(item.submissionId)}/dry-run`, action)).json() as Promise<DryRun>,
    onSuccess: (data) => setDryRun(data),
  });
  const apply = useMutation({
    mutationFn: async () => {
      if (!selected || !dryRun) throw new Error("Create a repair plan first.");
      return (await apiRequest("POST", `/api/admin/onboarding-repairs/${encodeURIComponent(selected.submissionId)}/apply`, { ...plan, reason: reason.trim(), fingerprint: dryRun.fingerprint })).json();
    },
    onSuccess: async () => {
      setSelected(null); setDryRun(null); setReason("");
      await qc.invalidateQueries({ queryKey: ["/api/admin/onboarding-repairs"] });
      await qc.invalidateQueries({ queryKey: ["/api/admin/contractor-onboarding"] });
    },
  });

  if (!isSuperAdmin) return null;
  if (access.isError) return <p role="alert" className="text-sm text-red-700">{depositToolError(access.error, "Repair access could not be checked.")}</p>;
  if (access.isPending) return <section className="mb-6 animate-pulse rounded-xl border border-[#dce5df] bg-white p-4"><div className="h-4 w-44 rounded bg-slate-200" /><div className="mt-3 h-16 rounded bg-slate-100" /></section>;
  if (access.isError || !access.data?.canManage) return null;
  if (repairs.isPending) return <section className="mb-6 animate-pulse rounded-xl border border-[#dce5df] bg-white p-4"><div className="h-4 w-44 rounded bg-slate-200" /><div className="mt-3 h-16 rounded bg-slate-100" /></section>;
  if (repairs.isError && (repairs.error as { status?: number }).status === 403) return <p role="alert" className="text-sm text-red-700">{depositToolError(repairs.error, repairs.error.message)}</p>;
  if (repairs.isError) return <section className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="mr-2 inline h-4 w-4" />Repair queue is unavailable. <button className="underline" onClick={() => repairs.refetch()}>Retry</button></section>;
  return <section className="mb-6 rounded-xl border border-[#dce5df] bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#557064]">Super Admin tools</p><h2 className="mt-1 flex items-center gap-2 font-semibold text-[#20352a]"><Wrench className="h-4 w-4" />Onboarding repairs</h2></div><span className="rounded-full bg-[#f2f6f2] px-2.5 py-1 text-xs text-slate-600">{repairs.data?.items?.length ?? 0} flagged</span></div>
    {!repairs.data?.items?.length ? <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-slate-500">No onboarding records need repair.</p> : <div className="mt-3 space-y-3">{repairs.data.items.map((item) => <article key={item.submissionId} className="rounded-lg border border-[#e2e9e3] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium text-slate-800">{item.jobTitle || "Contractor role"} · {item.status}</h3><p className="mt-1 text-xs text-slate-500">Application {item.submissionId}</p><ul className="mt-2 list-inside list-disc text-xs text-red-800">{item.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul></div><Button size="sm" variant="outline" onClick={() => { setSelected(item); setDryRun(null); setReason(""); setPlan({ action: "link_offer" }); }}>Plan repair</Button></div>
    </article>)}</div>}
    {selected && <div className="mt-4 border-t border-[#e2e9e3] pt-4">
      <h3 className="font-semibold text-slate-800">Plan repair · {selected.submissionId}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-medium">Action<select className="mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm" value={plan.action} onChange={(event) => { const action = event.target.value as Plan["action"]; setPlan({ action, offerId: action === "link_offer" ? plan.offerId : undefined }); setDryRun(null); }}><option value="link_offer">Link offer</option><option value="issue_deposit">Issue deposit</option><option value="revert">Revert</option></select></label>
        {plan.action === "link_offer" ? <label className="text-xs font-medium">Offer<select className="mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm" value={plan.offerId || ""} onChange={(event) => { setPlan({ ...plan, offerId: event.target.value }); setDryRun(null); }}><option value="">Choose offer</option>{selected.candidates.map((candidate) => <option key={candidate.offerId} value={candidate.offerId}>{candidate.offerId} · {candidate.status} · {candidate.submissionId}</option>)}</select></label> : <div />}
        <Button className="self-end" size="sm" variant="outline" disabled={preview.isPending || (plan.action === "link_offer" && !plan.offerId)} onClick={() => preview.mutate({ item: selected, action: plan })}>{preview.isPending ? "Building plan…" : "Preview dry run"}</Button>
      </div>
      {preview.isError && <p role="alert" className="mt-2 text-sm text-red-700">{depositToolError(preview.error, (preview.error as Error).message)}</p>}
      {dryRun && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="font-semibold text-amber-950">Explicit confirmation required</p><p className="mt-1 text-sm text-amber-900">{dryRun.summary}</p><ul className="mt-2 list-inside list-disc text-xs text-amber-900">{dryRun.changes.map((change, index) => <li key={`${change}-${index}`}>{change}</li>)}</ul>
        <label className="mt-3 block text-xs font-medium text-amber-950">Reason ({reason.trim().length}/2000; minimum 10)<textarea value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} className="mt-1 block min-h-20 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800" /></label>
        {apply.isError && <p role="alert" className="mt-2 text-sm text-red-700">{depositToolError(apply.error, (apply.error as Error).message)}</p>}
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={reason.trim().length < 10 || reason.trim().length > 2000 || apply.isPending} onClick={() => { if (window.confirm(`Apply this repair?\n\n${dryRun.summary}\n\n${dryRun.changes.join("\n")}`)) apply.mutate(); }}>{apply.isPending ? "Applying…" : "Confirm and apply"}</Button><Button size="sm" variant="outline" onClick={() => { setDryRun(null); setSelected(null); }}>Cancel</Button></div>
      </div>}
    </div>}
  </section>;
}
