import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CalendarOff, CheckCircle2, Clock3, XCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RequesterRole = "client" | "talent";
type Role = RequesterRole | "admin";
type EndRequest = {
  id: string;
  hiring_contract_id: string;
  requester_role?: string;
  requester_email?: string;
  job_title: string;
  billing_mode?: string;
  requested_effective_end_date: string;
  approved_effective_end_date?: string | null;
  reason: string;
  status: "open" | "approved" | "rejected";
  decision_reason?: string | null;
  created_at: string;
};
type ActiveContract = {
  id: string;
  job_title: string;
  billing_mode: "tracked" | "guaranteed";
  effective_start_date: string;
  effective_end_date?: string | null;
};
type AdminActiveContract = ActiveContract & {
  client_email?: string;
  talent_email?: string;
};
const adminContractDescription = (contract: AdminActiveContract) =>
  `${contract.job_title} · Client: ${contract.client_email || "identity unavailable"} · Talent: ${contract.talent_email || "identity unavailable"} · ${contract.billing_mode} · signed ${prettyDate(contract.effective_start_date)}`;

const todayInNewYork = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const prettyDate = (value?: string | null) => {
  if (!value) return "Not set";
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(parts[0], parts[1] - 1, parts[2]));
};
const json = async <T,>(path: string): Promise<T> => (await apiRequest("GET", path)).json() as Promise<T>;
const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!match) return message;
  try {
    const body = JSON.parse(match[2]);
    if (match[1] === "409") return `Conflict: ${body.error ?? "This contract can no longer be terminated directly. Refresh the list and review any open end request."}`;
    return body.error ? `${body.error} (HTTP ${match[1]})` : message;
  } catch {
    return message;
  }
};

const statusStyles: Record<EndRequest["status"], string> = {
  open: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

function RequestHistory({ requests, loading, error }: { requests?: EndRequest[]; loading: boolean; error?: unknown }) {
  if (loading) return <p className="py-5 text-sm text-slate-500">Loading end-request history…</p>;
  if (error) return <p role="alert" className="py-4 text-sm text-red-700">Unable to load request history: {(error as Error).message}</p>;
  if (!requests?.length) return <p className="py-4 text-sm text-slate-500">No end requests yet.</p>;
  return <div className="space-y-3">{requests.map((item) => <Card key={item.id}>
    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold text-slate-900">{item.job_title}</h3>
        <p className="mt-1 text-sm text-slate-600">Requested end: {prettyDate(item.requested_effective_end_date)}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.reason}</p>
        {item.approved_effective_end_date && <p className="mt-2 text-sm font-medium text-emerald-800">Approved end date: {prettyDate(item.approved_effective_end_date)}</p>}
        {item.decision_reason && <p className="mt-2 text-sm text-slate-600">Admin decision: {item.decision_reason}</p>}
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[item.status]}`}>
        {item.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === "rejected" ? <XCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
        {item.status}
      </span>
    </CardContent>
  </Card>)}</div>;
}

function PartyEndRequests({ role }: { role: RequesterRole }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const root = `/api/${role}`;
  const contractsQuery = useQuery<{ contracts: ActiveContract[] }>({
    queryKey: [`${root}/active-hiring-contracts`],
    queryFn: () => json(`${root}/active-hiring-contracts`),
  });
  const requestsQuery = useQuery<{ requests: EndRequest[] }>({
    queryKey: [`${root}/hiring-contract-termination-requests`],
    queryFn: () => json(`${root}/hiring-contract-termination-requests`),
  });
  const [contractId, setContractId] = useState("");
  const [endDate, setEndDate] = useState(todayInNewYork);
  const [reason, setReason] = useState("");
  const contracts = contractsQuery.data?.contracts ?? [];
  const selectedContract = contracts.find((contract) => contract.id === contractId);
  const requestByContract = useMemo(
    () => new Map((requestsQuery.data?.requests ?? []).filter((request) => request.status !== "rejected").map((request) => [request.hiring_contract_id, request])),
    [requestsQuery.data?.requests],
  );

  const submit = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/hiring-contracts/${contractId}/termination-requests`, {
      effectiveEndDate: endDate, reason: reason.trim(),
    })).json(),
    onSuccess: () => {
      setContractId("");
      setReason("");
      void qc.invalidateQueries({ queryKey: [`${root}/active-hiring-contracts`] });
      void qc.invalidateQueries({ queryKey: [`${root}/hiring-contract-termination-requests`] });
      toast({ title: "End request submitted", description: "The contract remains active until an Admin approves an end date." });
    },
    onError: (error: Error) => toast({ title: "Could not submit end request", description: error.message, variant: "destructive" }),
  });

  return <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 md:px-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Contract management</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">End an engagement</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">This requests a final end to the engagement; no replacement contract is created. An Admin must approve it before billing stops. A billing-mode change is a separate end-and-resign process.</p>
    </header>

    <Card><CardContent className="p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><CalendarOff className="h-5 w-5 text-indigo-600" />Request a contract end</h2>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Submitting a request does not stop the contract or billing. Until approval, existing signed terms remain in effect. Approved final periods use Guaranteed calendar-day proration or the approved, date-clipped Tracked timesheet.
      </div>
      {contractsQuery.isLoading ? <p className="mt-4 text-sm text-slate-500">Loading active contracts…</p> : contractsQuery.isError
        ? <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Unable to load active contracts: {(contractsQuery.error as Error).message}</p>
        : contracts.length === 0 ? <p className="mt-4 text-sm text-slate-500">There are no active Tracked or Guaranteed contracts to end.</p> : <>
          <label className="mt-4 block text-sm font-medium text-slate-700">Active contract
            <select value={contractId} onChange={(event) => setContractId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5" aria-describedby="end-request-contract-note">
              <option value="">Select an engagement</option>
              {contracts.map((contract) => {
                const prior = requestByContract.get(contract.id);
                return <option key={contract.id} value={contract.id} disabled={!!prior}>
                  {contract.job_title} · {contract.billing_mode} {prior ? `· ${prior.status} request` : ""}
                </option>;
              })}
            </select>
          </label>
          {selectedContract && <p id="end-request-contract-note" className="mt-2 text-xs text-slate-500">Signed {selectedContract.billing_mode} agreement · effective from {prettyDate(selectedContract.effective_start_date)}</p>}
          <label className="mt-4 block text-sm font-medium text-slate-700">Requested final service date
            <input type="date" required min={todayInNewYork()} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5 sm:max-w-xs" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Use today or a future date. Past end dates require a separate Admin resolution.</span>
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">Reason
            <textarea required maxLength={2000} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-2.5" placeholder="Explain why this engagement should end" />
            <span className="mt-1 block text-xs font-normal text-slate-500">{reason.length}/2000 characters</span>
          </label>
          <Button className="mt-4" disabled={submit.isPending || !contractId || endDate < todayInNewYork() || !reason.trim()} onClick={() => submit.mutate()}>
            {submit.isPending ? "Submitting…" : "Submit end request"}
          </Button>
          {submit.isError && <p role="alert" className="mt-3 text-sm text-red-700">Request failed: {submit.error.message}</p>}
        </>}
    </CardContent></Card>

    <section>
      <h2 className="mb-3 text-xl font-semibold text-slate-900">End-request history</h2>
      <RequestHistory requests={requestsQuery.data?.requests} loading={requestsQuery.isLoading} error={requestsQuery.error} />
    </section>
  </main>;
}

function AdminEndRequests() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [directContractId, setDirectContractId] = useState("");
  const [directEndDate, setDirectEndDate] = useState(todayInNewYork);
  const [directReason, setDirectReason] = useState("");
  const contractsQuery = useQuery<{ contracts: AdminActiveContract[] }>({
    queryKey: ["/api/admin/active-hiring-contracts"],
    queryFn: () => json("/api/admin/active-hiring-contracts"),
  });
  const requestsQuery = useQuery<{ requests: EndRequest[] }>({
    queryKey: ["/api/admin/hiring-contract-termination-requests", "open"],
    queryFn: () => json("/api/admin/hiring-contract-termination-requests?status=open"),
  });
  const decision = useMutation({
    mutationFn: async ({ id, choice }: { id: string; choice: "approve" | "reject" }) => (await apiRequest("POST", `/api/admin/hiring-contract-termination-requests/${id}/decision`, {
      decision: choice, reason: (reasons[id] ?? "").trim(),
    })).json(),
    onSuccess: (_data, variables) => {
      setReasons((current) => ({ ...current, [variables.id]: "" }));
      void qc.invalidateQueries({ queryKey: ["/api/admin/hiring-contract-termination-requests"] });
      toast({ title: `Contract end request ${variables.choice === "approve" ? "approved" : "rejected"}` });
    },
    onError: (error: Error) => toast({ title: "Could not decide end request", description: error.message, variant: "destructive" }),
  });
  const directTermination = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/hiring-contracts/${directContractId}/terminate`, {
      effectiveEndDate: directEndDate,
      reason: directReason.trim(),
    })).json(),
    onSuccess: () => {
      setDirectContractId("");
      setDirectEndDate(todayInNewYork());
      setDirectReason("");
      void qc.invalidateQueries({ queryKey: ["/api/admin/active-hiring-contracts"] });
      void qc.invalidateQueries({ queryKey: ["/api/admin/hiring-contract-termination-requests"] });
      toast({ title: "Contract terminated", description: "The approved end date is effective immediately and cannot be undone." });
    },
    onError: (error: Error) => {
      void qc.invalidateQueries({ queryKey: ["/api/admin/active-hiring-contracts"] });
      toast({ title: "Could not terminate contract", description: errorMessage(error), variant: "destructive" });
    },
  });
  const requests = requestsQuery.data?.requests ?? [];
  const openRequestContractIds = new Set(requests.map((request) => request.hiring_contract_id));
  const activeContracts = contractsQuery.data?.contracts ?? [];
  const selectedDirectContract = activeContracts.find((contract) => contract.id === directContractId);
  const hasOpenRequest = directContractId ? openRequestContractIds.has(directContractId) : false;
  const contractLabelCounts = new Map<string, number>();
  activeContracts.forEach((contract) => {
    const label = adminContractDescription(contract);
    contractLabelCounts.set(label, (contractLabelCounts.get(label) ?? 0) + 1);
  });

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Contract administration</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Contract end requests</h1>
      <p className="mt-2 text-sm text-slate-600">Approving an end date stops future billing after the final service date. The signed billing mode and all previously sent invoices and payouts remain unchanged.</p>
    </header>
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
      Final-period settlement is based on actual service through the approved inclusive end date: Guaranteed periods prorate by calendar days, while Tracked periods use the approved timesheet clipped at that boundary.
    </div>
    <Card><CardContent className="p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><CalendarOff className="h-5 w-5 text-indigo-600" />Directly terminate a contract</h2>
      <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p><strong>Immediate and irreversible:</strong> direct termination approves the selected final service date immediately and cannot be undone. The contract’s future billing ends at that boundary. Review the contract and date carefully before proceeding.</p>
      </div>
      {contractsQuery.isLoading ? <p className="mt-4 text-sm text-slate-500">Loading active contracts…</p> : contractsQuery.isError
        ? <p role="alert" className="mt-4 text-sm text-red-700">Unable to load active contracts: {errorMessage(contractsQuery.error)}</p>
        : activeContracts.length === 0 ? <p className="mt-4 text-sm text-slate-500">There are no active Tracked or Guaranteed contracts available for direct termination.</p> : <>
          <label className="mt-4 block text-sm font-medium text-slate-700">Active contract
            <select value={directContractId} onChange={(event) => setDirectContractId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5">
              <option value="">Select an engagement</option>
              {activeContracts.map((contract) => {
                const hasRequest = openRequestContractIds.has(contract.id);
                const label = adminContractDescription(contract);
                return <option key={contract.id} value={contract.id} disabled={hasRequest}>
                  {label}{(contractLabelCounts.get(label) ?? 0) > 1 ? ` · contract ${contract.id.slice(0, 8)}` : ""}{hasRequest ? " · open request must be adjudicated first" : ""}
                </option>;
              })}
            </select>
          </label>
          {selectedDirectContract && <p className="mt-2 text-xs text-slate-500">Signed {selectedDirectContract.billing_mode} agreement · effective from {prettyDate(selectedDirectContract.effective_start_date)}</p>}
          <label className="mt-4 block text-sm font-medium text-slate-700">Final service date
            <input type="date" required min={todayInNewYork()} value={directEndDate} onChange={(event) => setDirectEndDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5 sm:max-w-xs" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Use today or a future date in Eastern Time.</span>
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">Required reason
            <textarea required maxLength={2000} rows={3} value={directReason} onChange={(event) => setDirectReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-2.5" placeholder="Document why this contract is being terminated immediately" />
            <span className="mt-1 block text-xs font-normal text-slate-500">{directReason.length}/2000 characters</span>
          </label>
          {hasOpenRequest && <p role="alert" className="mt-3 text-sm text-amber-800">Resolve or reject this contract’s open end request before using direct termination.</p>}
          {directTermination.isError && <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage(directTermination.error)}</p>}
          <Button className="mt-4" variant="destructive" disabled={directTermination.isPending || !directContractId || hasOpenRequest || directEndDate < todayInNewYork() || !directReason.trim()} onClick={() => {
            const confirmation = selectedDirectContract
              ? `Immediately and irreversibly terminate:\n\n${adminContractDescription(selectedDirectContract)}\nFinal service date: ${prettyDate(directEndDate)}\nContract ID: ${selectedDirectContract.id}\n\nThis action cannot be undone. Continue?`
              : "Immediately and irreversibly terminate this contract? This action cannot be undone. Continue?";
            if (window.confirm(confirmation)) directTermination.mutate();
          }}>
            {directTermination.isPending ? "Terminating…" : "Terminate contract immediately"}
          </Button>
        </>}
    </CardContent></Card>
    {requestsQuery.isLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading requests…</p>
      : requestsQuery.isError ? <p role="alert" className="flex items-start gap-2 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Unable to load requests: {(requestsQuery.error as Error).message}</p>
        : requests.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">No open contract end requests.</CardContent></Card>
          : <div className="space-y-3">{requests.map((item) => <Card key={item.id}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-semibold text-slate-900">{item.job_title}</h2><p className="mt-1 text-xs text-slate-500">{item.requester_role} request · {item.requester_email} · {item.billing_mode} · submitted {prettyDate(item.created_at)}</p></div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Review required</span>
              </div>
              <p className="mt-3 text-sm text-slate-700"><span className="font-medium">Requested final day:</span> {prettyDate(item.requested_effective_end_date)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.reason}</p>
              <label className="mt-4 block text-sm font-medium text-slate-700">Decision reason
                <textarea maxLength={2000} rows={3} value={reasons[item.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 p-2.5" placeholder="Required explanation for approval or rejection" />
              </label>
              {decision.isError && <p role="alert" className="mt-2 text-sm text-red-700">{decision.error.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={decision.isPending || !(reasons[item.id] ?? "").trim()} onClick={() => decision.mutate({ id: item.id, choice: "approve" })}><CheckCircle2 className="mr-2 h-4 w-4" />Approve end</Button>
                <Button variant="destructive" disabled={decision.isPending || !(reasons[item.id] ?? "").trim()} onClick={() => decision.mutate({ id: item.id, choice: "reject" })}><XCircle className="mr-2 h-4 w-4" />Reject request</Button>
              </div>
            </CardContent>
          </Card>)}
          </div>}
  </main>;
}

export default function ContractEndings({ role }: { role: Role }) {
  return <div className="min-h-screen bg-slate-50">{role === "admin" ? <AdminEndRequests /> : <PartyEndRequests role={role} />}</div>;
}