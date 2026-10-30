import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, ShieldCheck, Undo2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type OverrideAction = "skip_stage" | "waive_deposit" | "skip_agreements" | "revert_override";
type OverrideItem = {
  id: string;
  action: string;
  reason: string;
  previous_state: unknown;
  new_state: unknown;
  notify_parties: boolean;
  created_at: string;
  reverted_at: string | null;
};
type Capabilities = { canManage?: boolean };

export function useHiringOverrideCapability() {
  return useQuery<Capabilities>({
    queryKey: ["/api/admin/hiring-overrides/capabilities"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/hiring-overrides/capabilities")).json(),
    retry: false,
    staleTime: 60_000,
  });
}

function useOverrideMutation(onSuccess?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, body }: { action: OverrideAction; body: Record<string, unknown> }) =>
      (await apiRequest("POST", `/api/admin/hiring-overrides/${action}`, body)).json(),
    onSuccess: async (_result, variables) => {
      const submissionId = variables.body.submissionId;
      const invalidations: Promise<unknown>[] = [
        client.invalidateQueries({ queryKey: ["/api/admin/hiring-overrides"] }),
        client.invalidateQueries({ queryKey: ["/api/admin/ledger"] }),
        client.invalidateQueries({ queryKey: ["/api/admin/billing-contracts"] }),
      ];
      if (submissionId) {
        invalidations.push(
          client.invalidateQueries({ queryKey: ["/api/admin/job-applications"] }),
          client.invalidateQueries({ queryKey: ["/api/admin/job-applications", String(submissionId)] }),
          client.invalidateQueries({ queryKey: ["/api/contractor-onboarding", String(submissionId)] }),
        );
      }
      await Promise.all(invalidations);
      onSuccess?.();
    },
  });
}

function formatAction(action: string) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OverrideControls({ submissionId, depositId }: { submissionId: string; depositId?: string | null }) {
  const capability = useHiringOverrideCapability();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<OverrideAction | "">("");
  const [reason, setReason] = useState("");
  const [notifyParties, setNotifyParties] = useState(false);
  const [targetStatus, setTargetStatus] = useState("shortlisted");
  const [rate, setRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [skipContractorAgreement, setSkipContractorAgreement] = useState(false);
  const [skipMsa, setSkipMsa] = useState(false);
  const mutation = useOverrideMutation(() => {
    setAction("");
    setReason("");
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/hiring-overrides", submissionId] });
  });
  const historyQuery = useQuery<{ items: OverrideItem[] }>({
    queryKey: ["/api/admin/hiring-overrides", submissionId],
    queryFn: async () => (await apiRequest("GET", `/api/admin/hiring-overrides?submissionId=${encodeURIComponent(submissionId)}`)).json(),
    enabled: capability.data?.canManage === true,
    retry: false,
  });
  const items = historyQuery.data?.items ?? [];
  const canSubmit = reason.trim().length >= 10 && reason.trim().length <= 2000 && !mutation.isPending;
  const actionDescription = useMemo(() => {
    if(action==="skip_stage"&&targetStatus==="hired")return "Activate this engagement immediately: bypass Final interview evidence, waive any pending deposit, and bypass Contractor Agreement and MSA signatures. Existing held funds remain unchanged. No settlement or signatures will be fabricated. This financial/legal exception cannot be automatically reversed.";
    if(action==="skip_stage"&&targetStatus==="contract_sent")return "Bypass interview and offer prerequisites, create an accepted offer and deposit invoice when needed, and move to the agreements stage. A draft bookkeeping contract is created; this does not send or sign a legal document. The deposit is still required unless separately waived.";
    if (action === "skip_stage") return `Move this application directly to ${formatAction(targetStatus)}, bypassing any unmet pipeline prerequisites${targetStatus === "final_interview_passed" || ["offer_extended", "offer_accepted", "contract_sent", "hired"].includes(targetStatus) ? ". No interview record will be created." : "."}`;
    if (action === "waive_deposit") return "Mark the selected security deposit as satisfied without payment proof. This is an audited waiver, not a payment verification.";
    if (action === "skip_agreements") return `Allow activation without ${[skipContractorAgreement && "a fully signed Contractor Agreement", skipMsa && "a fully signed MSA"].filter(Boolean).join(" and ") || "any agreement bypass selected"}. No signatures will be created.`;
    if (action === "revert_override") return "Attempt to undo the most recent override on this application. The server will refuse if the change is no longer safe to reverse.";
    return "";
  }, [action, targetStatus, skipContractorAgreement, skipMsa]);
  if (!capability.data?.canManage) return null;

  function submit() {
    if (!action || !canSubmit) return;
    const body: Record<string, unknown> = { submissionId, reason: reason.trim(), notifyParties };
    if (action === "skip_stage") {
      body.targetStatus = targetStatus;
      if (["offer_extended","offer_accepted","contract_sent","hired"].includes(targetStatus)) {
        body.rate = Number(rate);
        body.currency = currency.trim().toUpperCase();
        body.startDate = startDate;
      }
    }
    if (action === "waive_deposit") {
      if (!depositId) return;
      body.depositId = depositId;
    }
    if (action === "skip_agreements") {
      body.skipContractorAgreement = skipContractorAgreement;
      body.skipMsa = skipMsa;
    }
    mutation.mutate({ action, body });
  }

  return (
    <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4" aria-label="Super Admin overrides">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-amber-950">Super Admin overrides</h3>
          <p className="mt-1 text-xs text-amber-900/80">Exceptional workflow changes are recorded with an audit reason.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setAction("skip_stage")}>Skip pipeline stage</Button>
        {depositId && <Button size="sm" variant="outline" onClick={() => setAction("waive_deposit")}>Waive deposit</Button>}
        <Button size="sm" variant="outline" onClick={() => setAction("skip_agreements")}>Skip agreements</Button>
      </div>
      {historyQuery.isLoading ? <div className="h-8 animate-pulse rounded bg-amber-100" /> : historyQuery.isError ? (
        <p role="alert" className="text-xs text-rose-700">Override history could not be loaded. <button className="underline" onClick={() => void historyQuery.refetch()}>Retry</button></p>
      ) : (
        <div className="border-t border-amber-200 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-950"><History className="h-3.5 w-3.5" /> Override history</p>
          {!items.length ? <p className="text-xs text-muted-foreground">No overrides recorded.</p> : <ol className="space-y-2">
            {items.map((item) => <li key={item.id} className="rounded-md border border-amber-100 bg-background/70 p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{formatAction(item.action)}</span>
                <span className="text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{item.reason}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.reverted_at ? <Badge variant="outline">Reverted</Badge> : <span className="text-muted-foreground">{item.notify_parties ? "Parties notified" : "No notifications"}</span>}
                {!item.reverted_at && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAction("revert_override")}><Undo2 className="mr-1 h-3 w-3" />Revert latest</Button>}
              </div>
            </li>)}
          </ol>}
        </div>
      )}
      {action && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true" aria-label="Confirm hiring override">
        <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-xl border bg-background p-5 shadow-xl">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-700" /><div><h3 className="text-lg font-semibold">Confirm {formatAction(action).toLowerCase()}</h3><p className="mt-1 text-sm text-muted-foreground">{actionDescription}</p></div></div>
          {action === "skip_stage" && <div className="mt-4 space-y-3">
            <label className="block space-y-1 text-sm font-medium">Target stage<select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>
              {["shortlisted", "interviewing", "final_interview_passed", "offer_extended", "offer_accepted", "contract_sent", "hired"].map((stage) => <option key={stage} value={stage}>{formatAction(stage)}</option>)}
            </select></label>
            {["offer_extended","offer_accepted","contract_sent","hired"].includes(targetStatus) && <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm font-medium">Rate<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" type="number" min="0.01" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
              <label className="space-y-1 text-sm font-medium">Currency<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
              <label className="space-y-1 text-sm font-medium">Start date<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            </div>}
          </div>}
          {action === "waive_deposit" && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">This bypasses deposit payment verification for deposit {depositId}. It does not claim funds were received.</p>}
          {action === "skip_agreements" && <div className="mt-4 space-y-2 rounded-md border p-3 text-sm">
            <label className="flex items-start gap-2"><input type="checkbox" checked={skipContractorAgreement} onChange={(event) => setSkipContractorAgreement(event.target.checked)} /><span>Allow activation without a signed Contractor Agreement</span></label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={skipMsa} onChange={(event) => setSkipMsa(event.target.checked)} /><span>Allow activation without a signed MSA</span></label>
            <p className="text-xs text-muted-foreground">No signatures or agreement records will be fabricated.</p>
          </div>}
          {action === "revert_override" && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">The server will only reverse the latest change when the resulting state can be safely restored.</p>}
          <label className="mt-4 block space-y-1 text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(10–2,000 characters)</span><textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 font-normal" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Document why this exception is necessary." /></label>
          <p className="text-right text-xs text-muted-foreground">{reason.trim().length}/2000</p>
          <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={notifyParties} onChange={(event) => setNotifyParties(event.target.checked)} /><span>Notify client and talent about this override</span></label>
          {mutation.error && <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">{mutation.error.message || "Override failed."}</p>}
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => { setAction(""); mutation.reset(); }}>Cancel</Button><Button onClick={submit} disabled={!canSubmit || (action === "waive_deposit" && !depositId) || (action === "skip_agreements" && !skipContractorAgreement && !skipMsa) || (action === "skip_stage" && targetStatus === "offer_accepted" && (!rate || Number(rate) <= 0 || !currency.trim() || !startDate))}>{mutation.isPending ? "Recording…" : "Confirm override"}</Button></div>
        </div>
      </div>}
    </section>
  );
}

export function WaiveDepositButton({ depositId, className = "" }: { depositId: string; className?: string }) {
  const capability = useHiringOverrideCapability();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notifyParties, setNotifyParties] = useState(false);
  const mutation = useOverrideMutation(() => { setOpen(false); setReason(""); });
  if (!capability.data?.canManage) return null;
  return <>
    <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>Waive without proof</Button>
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true" aria-label="Confirm deposit waiver">
      <div className="w-full max-w-lg rounded-xl border bg-background p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Waive deposit payment verification?</h3>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Deposit {depositId} will be marked satisfied without payment proof. This is an audited waiver, not confirmation that funds were received.</p>
        <label className="mt-4 block space-y-1 text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(10–2,000 characters)</span><textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 font-normal" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={notifyParties} onChange={(event) => setNotifyParties(event.target.checked)} /><span>Notify client and talent</span></label>
        {mutation.error && <p role="alert" className="mt-3 text-sm text-rose-700">{mutation.error.message}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={reason.trim().length < 10 || reason.trim().length > 2000 || mutation.isPending} onClick={() => mutation.mutate({ action: "waive_deposit", body: { depositId, reason: reason.trim(), notifyParties } })}>{mutation.isPending ? "Recording…" : "Confirm waiver"}</Button></div>
      </div>
    </div>}
  </>;
}

type PlacementJob = { id: string; title: string; status?: string; approvalStatus?: string };
export function DirectPlacementDialog({ clientId, jobs }: { clientId: string; jobs: PlacementJob[] }) {
  const capability = useHiringOverrideCapability();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [talentId, setTalentId] = useState("");
  const [jobId, setJobId] = useState("");
  const [createJob, setCreateJob] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [engagementType, setEngagementType] = useState<"Lite" | "Standard">("Standard");
  const [billingMode, setBillingMode] = useState<"tracked" | "guaranteed">("tracked");
  const [rate, setRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [depositPolicy, setDepositPolicy] = useState<"require" | "waive">("require");
  const [skipContractorAgreement, setSkipContractorAgreement] = useState(false);
  const [skipMsa, setSkipMsa] = useState(false);
  const [reason, setReason] = useState("");
  const [notifyParties, setNotifyParties] = useState(false);
  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await apiRequest("POST", "/api/admin/hiring-overrides/direct_placement", body)).json(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/clients", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/hiring-overrides"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/ledger"] }),
      ]);
      setOpen(false);
    },
  });
  if (!capability.data?.canManage) return null;
  const approvedJobs = jobs.filter((job) => job.approvalStatus === "approved");
  const formReady = talentId.trim() && rate && Number(rate) > 0 && startDate && reason.trim().length >= 10
    && (createJob ? jobTitle.trim() : jobId) && reason.trim().length <= 2000;
  function submit() {
    const payload: Record<string, unknown> = {
      clientId, talentId: talentId.trim(), rate: Number(rate), currency: currency.toUpperCase(),
      startDate, depositPolicy, skipContractorAgreement, skipMsa, reason: reason.trim(), notifyParties,
    };
    if (createJob) payload.createJob = { title: jobTitle.trim(), engagementType, billingMode };
    else payload.jobId = jobId;
    mutation.mutate(payload);
  }
  return <>
    <Button onClick={() => setOpen(true)}><ShieldCheck className="mr-2 h-4 w-4" />Add talent directly</Button>
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true" aria-label="Add talent directly">
      <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background p-5 shadow-xl">
        <h2 className="text-xl font-semibold">Add talent directly</h2>
        <p className="mt-1 text-sm text-muted-foreground">Creates a pending team placement for this client. No signatures are generated; deposit and agreement bypasses are explicitly audited.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium sm:col-span-2">Talent user ID<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={talentId} onChange={(event) => setTalentId(event.target.value)} placeholder="Paste the talent account ID" /></label>
          <label className="space-y-1 text-sm font-medium sm:col-span-2">Placement job
            <select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={createJob ? "__create__" : jobId} onChange={(event) => { if (event.target.value === "__create__") { setCreateJob(true); setJobId(""); } else { setCreateJob(false); setJobId(event.target.value); } }}>
              <option value="">Choose an approved job</option>{approvedJobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.id}</option>)}<option value="__create__">Create a job record for this placement</option>
            </select>
          </label>
          {createJob && <>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">Job title<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></label>
            <label className="space-y-1 text-sm font-medium">Engagement type<select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={engagementType} onChange={(event) => setEngagementType(event.target.value as "Lite" | "Standard")}><option>Lite</option><option>Standard</option></select></label>
            <label className="space-y-1 text-sm font-medium">Billing mode<select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={billingMode} onChange={(event) => setBillingMode(event.target.value as "tracked" | "guaranteed")}><option value="tracked">Tracked</option><option value="guaranteed">Guaranteed</option></select></label>
          </>}
          <label className="space-y-1 text-sm font-medium">Rate<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" type="number" min="0.01" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
          <label className="space-y-1 text-sm font-medium">Currency<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
          <label className="space-y-1 text-sm font-medium">Start date<input className="h-10 w-full rounded-md border bg-background px-3 font-normal" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label className="space-y-1 text-sm font-medium">Deposit policy<select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={depositPolicy} onChange={(event) => setDepositPolicy(event.target.value as "require" | "waive")}><option value="require">Require deposit</option><option value="waive">Waive deposit</option></select></label>
          <div className="space-y-2 rounded-md border p-3 text-sm sm:col-span-2">
            <p className="font-medium">Agreement bypasses (no signatures will be fabricated)</p>
            <label className="flex items-start gap-2"><input type="checkbox" checked={skipContractorAgreement} onChange={(event) => setSkipContractorAgreement(event.target.checked)} /><span>Allow activation without signed Contractor Agreement</span></label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={skipMsa} onChange={(event) => setSkipMsa(event.target.checked)} /><span>Allow activation without signed MSA</span></label>
            <p className="text-xs text-muted-foreground">These explicit bypass choices are included in the direct-placement audit. If unchecked, the placement remains pending until signatures are completed.</p>
          </div>
        </div>
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Confirm what this will bypass</p>
          <p className="mt-1">This skips the standard application, interview, and offer process and creates a pending team placement. {depositPolicy === "waive" ? "Deposit payment verification will be waived without proof." : "Deposit funding remains required before activation."} {skipContractorAgreement ? "Contractor Agreement signature will be bypassed." : "Contractor Agreement signature remains required."} {skipMsa ? "MSA signature will be bypassed." : "MSA signature remains required."}</p>
        </div>
        <label className="mt-4 block space-y-1 text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(10–2,000 characters)</span><textarea maxLength={2000} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 font-normal" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={notifyParties} onChange={(event) => setNotifyParties(event.target.checked)} /><span>Notify client and talent</span></label>
        {mutation.error && <p role="alert" className="mt-3 text-sm text-rose-700">{mutation.error.message}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!formReady || mutation.isPending} onClick={submit}>{mutation.isPending ? "Creating placement…" : "Confirm direct placement"}</Button></div>
      </div>
    </div>}
  </>;
}
