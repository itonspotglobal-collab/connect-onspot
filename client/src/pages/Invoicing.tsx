import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, RefreshCw } from "lucide-react";

type Role = "talent" | "client" | "admin";
type TalentInvoice = {
  id: string; period_start: string; period_end: string; currency: string; amount: string | number;
  base_amount?: string | number; credit_amount?: string | number; status: string;
  drafted_at?: string | null; auto_send_at?: string | null; sent_at?: string | null;
  payout_due_on?: string | null; hours?: string | number | null; billing_mode?: string;
};
type CreditMemo = {
  id: string; currency: string; amount: string | number; remaining_amount: string | number;
  original_period_start: string; original_period_end: string; created_at: string;
};
type ClientInvoice = { id: string; invoice_month: string; currency: string; subtotal: string | number; status: string; created_at: string; applied_credits?: string | number };
type LateInvoice = { talent_invoice_id: string; hiring_contract_id: string; period_start: string; period_end: string; currency: string; job_title: string };
type LateClaim = Claim & { talent_invoice_id: string; original_talent_invoice_id?: string; all_in_amount?: string | number | null; applied_amount?: string | number; currency?: string; client_credit_memo_id?: string | null; base_amount?: string | number; commission_rate?: string | number };
type Claim = {
  id: string; hiring_contract_id: string; period_start: string; period_end: string; reason: string;
  status: string; decision_reason?: string | null; created_at: string; decided_at?: string | null;
  job_title?: string; talent_id?: string;
};
type AdminTalentInvoice = {
  id: string; hiring_contract_id: string; talent_id: string; client_id: string; job_title: string;
  billing_mode: string; period_start: string; period_end: string; currency: string;
  amount: string | number; base_amount: string | number; credit_amount: string | number;
  status: string; payout_due_on: string | null; drafted_at: string | null;
  auto_send_at: string | null; sent_at: string | null;
};
type CreditApplication = {
  invoice_id: string; credit_memo_id: string; memo_amount: string | number;
  applied_amount: string | number; created_at: string;
};
type Contract = {
  id: string; jobTitle: string;
  eligiblePeriods: Array<{ periodStart: string; periodEnd: string; claimDeadline: string; status: string; claimId: string | null }>;
};

const money = (currency: string, amount: string | number | null | undefined) => {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}`;
};
const date = (value?: string | null, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Not recorded";
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const displayDate = dayOnly
    ? (() => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); })()
    : new Date(value);
  return new Intl.DateTimeFormat(undefined, options).format(displayDate);
};
async function getJson<T>(path: string): Promise<T> {
  return (await apiRequest("GET", path)).json() as Promise<T>;
}

function PageHeader({ title, description, onRefresh, loading }: { title: string; description: string; onRefresh: () => void; loading: boolean }) {
  return <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Invoicing</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-600">{description}</p></div>
    <Button variant="outline" onClick={onRefresh} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
  </header>;
}
function LoadState({ loading, error, empty, children }: { loading: boolean; error?: unknown; empty?: boolean; children: React.ReactNode }) {
  if (loading) return <p className="py-12 text-center text-sm text-slate-500">Loading invoices…</p>;
  if (error) return <Card><CardContent className="flex gap-2 p-6 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />Unable to load data: {(error as Error).message}</CardContent></Card>;
  if (empty) return <Card><CardContent className="p-8 text-center text-sm text-slate-500">Nothing to display yet.</CardContent></Card>;
  return <>{children}</>;
}

function TalentInvoices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const invoicesQuery = useQuery<{ invoices: TalentInvoice[] }>({ queryKey: ["/api/talent/invoices"], queryFn: () => getJson("/api/talent/invoices") });
  const memoQuery = useQuery<{ creditMemos: CreditMemo[] }>({ queryKey: ["/api/talent/credit-memos"], queryFn: () => getJson("/api/talent/credit-memos") });
  const invoices = invoicesQuery.data?.invoices ?? [];
  const send = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/talent/invoices/${id}/send`, {})).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/talent/invoices"] }); toast({ title: "Invoice sent" }); },
    onError: (error: Error) => toast({ title: "Could not send invoice", description: error.message, variant: "destructive" }),
  });
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <PageHeader title="Your invoices" description="Review your billing periods, credit adjustments and scheduled payment dates." onRefresh={() => { invoicesQuery.refetch(); memoQuery.refetch(); }} loading={invoicesQuery.isFetching || memoQuery.isFetching} />
    <LoadState loading={invoicesQuery.isLoading} error={invoicesQuery.error} empty={!invoicesQuery.isLoading && !invoicesQuery.error && !invoices.length}>
      <div className="space-y-3">{invoices.map((invoice) => {
        const deadline = invoice.auto_send_at || (invoice.drafted_at ? new Date(new Date(invoice.drafted_at).getTime() + 48 * 60 * 60 * 1000).toISOString() : null);
        return <Card key={invoice.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{date(invoice.period_start)} – {date(invoice.period_end)}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${invoice.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{invoice.status}</span></div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600"><span>Amount: <b className="text-slate-900">{money(invoice.currency, invoice.amount)}</b></span><span>Hours: <b className="text-slate-900">{invoice.hours == null ? "—" : Number(invoice.hours).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></span><span>Pay date: <b className="text-slate-900">{date(invoice.payout_due_on)}</b></span></div>
            {invoice.status === "draft" && deadline && <p className="mt-2 text-xs text-amber-800">Automatically sends after the 48-hour review window: <b>{date(deadline, { dateStyle: "full", timeStyle: "short" })}</b></p>}
            {Number(invoice.credit_amount ?? 0) > 0 && <p className="mt-1 text-xs text-indigo-700">Credit memo applied: {money(invoice.currency, invoice.credit_amount)}</p>}
          </div>
          {invoice.status === "draft" && <Button onClick={() => send.mutate(invoice.id)} disabled={send.isPending} className="w-full shrink-0 sm:w-auto">Send invoice</Button>}
        </CardContent></Card>;
      })}</div>
    </LoadState>
    {memoQuery.isError && <p role="alert" className="mt-4 text-sm text-red-700">Could not load credit memos: {(memoQuery.error as Error).message}</p>}
    {(memoQuery.data?.creditMemos?.length ?? 0) > 0 && <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Credit memos</h2>
      <div className="space-y-2">{memoQuery.data!.creditMemos.map((memo) => <Card key={memo.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div><p className="font-medium text-slate-900">From period {date(memo.original_period_start)} – {date(memo.original_period_end)}</p><p className="mt-1 text-xs text-slate-500">Created {date(memo.created_at)}</p></div>
        <div className="text-right"><p>{money(memo.currency, memo.amount)} issued</p><p className="text-xs text-indigo-700">{Number(memo.remaining_amount) > 0 ? `${money(memo.currency, memo.remaining_amount)} pending application` : "Fully applied"}</p></div>
      </CardContent></Card>)}</div>
    </section>}
  </main>;
}

function ClientInvoices() {
  const [, navigate] = useLocation();
  const [detailRoute, params] = useRoute("/client/monthly-invoices/:id");
  const invoiceId = detailRoute ? params?.id : undefined;
  const qc = useQueryClient();
  const { toast } = useToast();
  const listQuery = useQuery<{ invoices: ClientInvoice[] }>({ queryKey: ["/api/client/monthly-invoices"], queryFn: () => getJson("/api/client/monthly-invoices") });
  const detailQuery = useQuery<{ invoice: ClientInvoice; lines: Array<{ period_start: string; period_end: string; job_title: string; client_amount: string | number }> }>({
    queryKey: ["/api/client/monthly-invoices", invoiceId], queryFn: () => getJson(`/api/client/monthly-invoices/${invoiceId}`), enabled: !!invoiceId,
  });
  const contractsQuery = useQuery<{ contracts: Contract[] }>({ queryKey: ["/api/client/guaranteed-contracts"], queryFn: () => getJson("/api/client/guaranteed-contracts") });
  const claimsQuery = useQuery<{ claims: Claim[] }>({ queryKey: ["/api/client/guaranteed-claims"], queryFn: () => getJson("/api/client/guaranteed-claims") });
  const lateInvoicesQuery = useQuery<{ invoices: LateInvoice[] }>({ queryKey: ["/api/client/late-guaranteed-invoices"], queryFn: () => getJson("/api/client/late-guaranteed-invoices") });
  const lateClaimsQuery = useQuery<{ claims: LateClaim[] }>({ queryKey: ["/api/client/late-guaranteed-claims"], queryFn: () => getJson("/api/client/late-guaranteed-claims") });
  const [selectedContract, setSelectedContract] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [reason, setReason] = useState("");
  const [lateInvoiceId, setLateInvoiceId] = useState("");
  const [lateReason, setLateReason] = useState("");
  const contracts = contractsQuery.data?.contracts ?? [];
  const activeContract = contracts.find((contract) => contract.id === selectedContract);
  const claim = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/client/guaranteed-claims", { hiringContractId: selectedContract, periodStart: selectedPeriod, reason: reason.trim() })).json(),
    onSuccess: () => { setReason(""); setSelectedPeriod(""); qc.invalidateQueries({ queryKey: ["/api/client/guaranteed-contracts"] }); qc.invalidateQueries({ queryKey: ["/api/client/guaranteed-claims"] }); toast({ title: "Claim submitted" }); },
    onError: (error: Error) => toast({ title: "Could not submit claim", description: error.message, variant: "destructive" }),
  });
  const lateClaim = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/client/late-guaranteed-claims", { talentInvoiceId: lateInvoiceId, reason: lateReason.trim() })).json(),
    onSuccess: () => { setLateInvoiceId(""); setLateReason(""); qc.invalidateQueries({ queryKey: ["/api/client/late-guaranteed-invoices"] }); qc.invalidateQueries({ queryKey: ["/api/client/late-guaranteed-claims"] }); toast({ title: "Late claim submitted for Admin review" }); },
    onError: (error: Error) => toast({ title: "Could not submit late claim", description: error.message, variant: "destructive" }),
  });
  const refresh = () => { listQuery.refetch(); contractsQuery.refetch(); claimsQuery.refetch(); lateInvoicesQuery.refetch(); lateClaimsQuery.refetch(); if (invoiceId) detailQuery.refetch(); };
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
     <PageHeader title="Monthly invoices" description="Your complete monthly all-in statements, including billed service periods and Client-side credits." onRefresh={refresh} loading={listQuery.isFetching || detailQuery.isFetching || contractsQuery.isFetching || claimsQuery.isFetching || lateClaimsQuery.isFetching || lateInvoicesQuery.isFetching} />
    {invoiceId ? <>
      <Button variant="ghost" className="mb-4" onClick={() => navigate("/client/monthly-invoices")}><ArrowLeft className="mr-2 h-4 w-4" />All monthly invoices</Button>
      <LoadState loading={detailQuery.isLoading} error={detailQuery.error}>
        {detailQuery.data && <Card><CardContent className="p-5 md:p-7">
           <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold text-slate-950">{date(detailQuery.data.invoice.invoice_month, { month: "long", year: "numeric" })}</h2><p className="mt-1 text-sm text-slate-500">Complete all-in statement · {detailQuery.data.invoice.status}</p>{Number(detailQuery.data.invoice.applied_credits ?? 0) > 0 && <p className="mt-1 text-sm text-indigo-700">Late Client credits applied: {money(detailQuery.data.invoice.currency, detailQuery.data.invoice.applied_credits)}</p>}</div><p className="text-xl font-bold">{money(detailQuery.data.invoice.currency, detailQuery.data.invoice.subtotal)}</p></div>
          <div className="mt-6 divide-y">{detailQuery.data.lines.map((line, index) => <div key={`${line.period_start}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium text-slate-900">{line.job_title}</p><p className="mt-1 text-sm text-slate-500">{date(line.period_start)} – {date(line.period_end)}</p></div><p className="font-semibold text-slate-900">{money(detailQuery.data!.invoice.currency, line.client_amount)}</p></div>)}
             {(detailQuery.data as any).appliedCredits?.map((credit: any) => <div key={credit.client_credit_memo_id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-indigo-800"><div><p className="font-medium">Guaranteed nonperformance credit</p><p className="mt-1 text-sm">Original service period {date(credit.period_start)} – {date(credit.period_end)}</p></div><p className="font-semibold">−{money(detailQuery.data!.invoice.currency, credit.amount)}</p></div>)}
             {!detailQuery.data.lines.length && <p className="py-4 text-sm text-slate-500">No statement lines are available.</p>}</div>
        </CardContent></Card>}
      </LoadState>
    </> : <LoadState loading={listQuery.isLoading} error={listQuery.error} empty={!listQuery.isLoading && !listQuery.error && !listQuery.data?.invoices.length}>
       <div className="grid gap-3 sm:grid-cols-2">{(listQuery.data?.invoices ?? []).map((invoice) => <button key={invoice.id} className="text-left" onClick={() => navigate(`/client/monthly-invoices/${invoice.id}`)}><Card className="h-full transition hover:border-indigo-300 hover:shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-5"><div><p className="font-semibold text-slate-900">{date(invoice.invoice_month, { month: "long", year: "numeric" })}</p><p className="mt-1 text-xs capitalize text-slate-500">{invoice.status} · Created {date(invoice.created_at)}</p>{Number(invoice.applied_credits ?? 0) > 0 && <p className="mt-1 text-xs text-indigo-700">{money(invoice.currency, invoice.applied_credits)} in Client credits applied</p>}</div><div className="text-right"><p className="font-bold text-slate-900">{money(invoice.currency, invoice.subtotal)}</p><FileText className="ml-auto mt-2 h-4 w-4 text-indigo-600" /></div></CardContent></Card></button>)}</div>
    </LoadState>}
    <section className="mt-8">
      <Card><CardContent className="p-5 md:p-6">
        <h2 className="text-xl font-semibold text-slate-900">Guaranteed contract claim</h2><p className="mt-1 text-sm text-slate-600">Report total nonperformance for an eligible period before its deadline. Partial invoice deductions are not supported.</p>
        {contractsQuery.isError && <p role="alert" className="mt-3 text-sm text-red-700">Could not load eligible contracts: {(contractsQuery.error as Error).message}</p>}
        {contractsQuery.isLoading ? <p className="mt-3 text-sm text-slate-500">Loading eligible periods…</p> : <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Contract<select className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5" value={selectedContract} onChange={(event) => { setSelectedContract(event.target.value); setSelectedPeriod(""); }}><option value="">Select a guaranteed contract</option>{contracts.map((item) => <option key={item.id} value={item.id}>{item.jobTitle}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Eligible period<select className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} disabled={!activeContract}><option value="">Select a period</option>{(activeContract?.eligiblePeriods ?? []).filter((item) => item.status === "eligible").map((item) => <option key={item.periodStart} value={item.periodStart}>{item.periodStart} – {item.periodEnd} · deadline {date(item.claimDeadline, { dateStyle: "medium", timeStyle: "short" })}</option>)}</select></label>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">Claim reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-2.5" placeholder="Describe the total nonperformance for this period" /></label>
          <Button className="mt-3" disabled={claim.isPending || !selectedContract || !selectedPeriod || !reason.trim()} onClick={() => claim.mutate()}>Submit claim</Button>
        </>}
      </CardContent></Card>
      <div className="mt-5">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Your claim status</h2>
        {claimsQuery.isLoading ? <p className="text-sm text-slate-500">Loading claim history…</p> : claimsQuery.isError ? <p role="alert" className="text-sm text-red-700">Could not load claim history: {(claimsQuery.error as Error).message}</p> : (claimsQuery.data?.claims.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No claims submitted.</p> : <div className="space-y-2">{claimsQuery.data!.claims.map((item) => <Card key={item.id}><CardContent className="flex flex-wrap items-start justify-between gap-3 p-4"><div><p className="font-medium text-slate-900">{item.job_title} · {date(item.period_start)} – {date(item.period_end)}</p><p className="mt-1 text-sm text-slate-600">{item.reason}</p>{item.decision_reason && <p className="mt-2 text-sm text-slate-500">Decision: {item.decision_reason}</p>}</div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">{item.status}</span></CardContent></Card>)}</div>}
      </div>
    </section>
    <section className="mt-8">
      <Card><CardContent className="p-5 md:p-6">
        <h2 className="text-xl font-semibold text-slate-900">Late Guaranteed claim</h2>
        <p className="mt-1 text-sm text-slate-600">Submit a period-specific claim for a sent Guaranteed Talent invoice. Late claims are escalated to OnSpot Admin; an approved credit applies to an eligible Client statement only and does not change the Talent invoice.</p>
        {lateInvoicesQuery.isError && <p role="alert" className="mt-3 text-sm text-red-700">Could not load sent Guaranteed invoices: {(lateInvoicesQuery.error as Error).message}</p>}
        <label className="mt-4 block text-sm font-medium text-slate-700">Sent invoice<select className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5" value={lateInvoiceId} onChange={(event) => setLateInvoiceId(event.target.value)}><option value="">Select a sent Guaranteed invoice</option>{(lateInvoicesQuery.data?.invoices ?? []).map((item) => <option key={item.talent_invoice_id} value={item.talent_invoice_id}>{item.job_title} · {date(item.period_start)} – {date(item.period_end)} · {item.currency}</option>)}</select></label>
        <label className="mt-3 block text-sm font-medium text-slate-700">Claim reason<textarea value={lateReason} onChange={(event) => setLateReason(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-2.5" placeholder="Describe the total nonperformance for this billed period" /></label>
        <Button className="mt-3" disabled={lateClaim.isPending || !lateInvoiceId || !lateReason.trim()} onClick={() => lateClaim.mutate()}>Submit late claim</Button>
      </CardContent></Card>
      <div className="mt-5"><h2 className="mb-3 text-xl font-semibold text-slate-900">Late claim and credit history</h2>
        {lateClaimsQuery.isError ? <p role="alert" className="text-sm text-red-700">Could not load late claim history: {(lateClaimsQuery.error as Error).message}</p> : (lateClaimsQuery.data?.claims.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No late claims submitted.</p> : <div className="space-y-2">{lateClaimsQuery.data!.claims.map((item) => <Card key={item.id}><CardContent className="flex flex-wrap items-start justify-between gap-3 p-4"><div><p className="font-medium text-slate-900">{item.job_title} · {date(item.period_start)} – {date(item.period_end)}</p><p className="mt-1 text-sm text-slate-600">{item.reason}</p>{item.decision_reason && <p className="mt-2 text-sm text-slate-500">Admin decision: {item.decision_reason}</p>}{item.client_credit_memo_id && <p className="mt-2 text-sm text-indigo-700">Client credit {money(item.currency ?? "", item.all_in_amount)} · applied {money(item.currency ?? "", item.applied_amount ?? 0)}</p>}</div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">{item.status}</span></CardContent></Card>)}</div>}
      </div>
    </section>
  </main>;
}

function AdminInvoicing() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const claimsQuery = useQuery<{ claims: Claim[] }>({ queryKey: ["/api/admin/guaranteed-claims"], queryFn: () => getJson("/api/admin/guaranteed-claims") });
  const lateClaimsQuery = useQuery<{ claims: LateClaim[] }>({ queryKey: ["/api/admin/late-guaranteed-claims"], queryFn: () => getJson("/api/admin/late-guaranteed-claims") });
  const clientCreditsQuery = useQuery<{ creditMemos: Array<Record<string, any>>; applications: Array<Record<string, any>> }>({
    queryKey: ["/api/admin/client-credit-memos"], queryFn: () => getJson("/api/admin/client-credit-memos"),
  });
  const blockedQuery = useQuery<{ blockedContracts: Array<Record<string, any>>; blockedPayouts: Array<Record<string, any>> }>({ queryKey: ["/api/admin/talent-invoicing/blocked"], queryFn: () => getJson("/api/admin/talent-invoicing/blocked") });
  const talentInvoicesQuery = useQuery<{ invoices: AdminTalentInvoice[]; creditApplications: CreditApplication[] }>({
    queryKey: ["/api/admin/talent-invoices"],
    queryFn: () => getJson("/api/admin/talent-invoices"),
  });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const decision = useMutation({
    mutationFn: async ({ id, choice }: { id: string; choice: "approve" | "reject" }) => (await apiRequest("POST", `/api/admin/guaranteed-claims/${id}/decision`, { decision: choice, reason: (reasons[id] ?? "").trim() })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/guaranteed-claims"] }); toast({ title: "Claim decision recorded" }); },
    onError: (error: Error) => toast({ title: "Could not record decision", description: error.message, variant: "destructive" }),
  });
  const lateDecision = useMutation({
    mutationFn: async ({ id, choice }: { id: string; choice: "approve" | "reject" }) => (await apiRequest("POST", `/api/admin/late-guaranteed-claims/${id}/decision`, { decision: choice, reason: (reasons[id] ?? "").trim() })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/late-guaranteed-claims"] }); qc.invalidateQueries({ queryKey: ["/api/admin/client-credit-memos"] }); toast({ title: "Late claim decision recorded" }); },
    onError: (error: Error) => toast({ title: "Could not adjudicate late claim", description: error.message, variant: "destructive" }),
  });
  const refresh = () => { claimsQuery.refetch(); lateClaimsQuery.refetch(); clientCreditsQuery.refetch(); blockedQuery.refetch(); talentInvoicesQuery.refetch(); };
  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
     <PageHeader title="Guaranteed claims & invoicing" description="Review on-time and escalated late claims, inspect separate Talent and Client credit ledgers, and diagnose billing blockers. No payment-provider execution is available here." onRefresh={refresh} loading={claimsQuery.isFetching || lateClaimsQuery.isFetching || clientCreditsQuery.isFetching || blockedQuery.isFetching || talentInvoicesQuery.isFetching} />
    <h2 className="mb-3 text-xl font-semibold text-slate-900">Guaranteed claim queue</h2>
    <LoadState loading={claimsQuery.isLoading} error={claimsQuery.error} empty={!claimsQuery.isLoading && !claimsQuery.error && !claimsQuery.data?.claims.length}>
      <div className="space-y-3">{(claimsQuery.data?.claims ?? []).map((item) => <Card key={item.id}><CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{item.job_title} · {date(item.period_start)} – {date(item.period_end)}</h3><p className="mt-1 text-xs text-slate-500">Contract {item.hiring_contract_id} · Talent {item.talent_id} · Filed {date(item.created_at)}</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Open</span></div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.reason}</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">Decision reason<textarea maxLength={2000} rows={2} className="mt-1 w-full rounded-md border border-slate-300 p-2.5" value={reasons[item.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} placeholder="Required explanation for approval or rejection" /></label>
        <div className="mt-3 flex flex-wrap gap-2"><Button disabled={decision.isPending || !(reasons[item.id] ?? "").trim()} onClick={() => decision.mutate({ id: item.id, choice: "approve" })}><CheckCircle2 className="mr-2 h-4 w-4" />Approve total nonperformance</Button><Button variant="destructive" disabled={decision.isPending || !(reasons[item.id] ?? "").trim()} onClick={() => decision.mutate({ id: item.id, choice: "reject" })}>Reject claim</Button></div>
      </CardContent></Card>)}</div>
    </LoadState>
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Escalated late Client claims</h2>
      <p className="mb-3 text-sm text-slate-600">These claims reference already-sent Guaranteed Talent invoices. Approval creates only a Client credit memo; the Talent invoice and payout remain untouched.</p>
      <LoadState loading={lateClaimsQuery.isLoading} error={lateClaimsQuery.error} empty={!lateClaimsQuery.isLoading && !lateClaimsQuery.error && !lateClaimsQuery.data?.claims.length}>
        <div className="space-y-3">{(lateClaimsQuery.data?.claims ?? []).map((item) => <Card key={item.id}><CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{item.job_title} · {date(item.period_start)} – {date(item.period_end)}</h3><p className="mt-1 text-xs text-slate-500">Claim {item.id} · Contract {item.hiring_contract_id} · Talent {item.talent_id} · Source Talent invoice {item.original_talent_invoice_id} · Filed {date(item.created_at)}</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Escalated · Open</span></div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.reason}</p>
          <p className="mt-2 text-sm text-slate-600">Potential all-in Client credit: {money(item.currency ?? "", Number(item.base_amount) * (1 + Number(item.commission_rate)))}</p>
          <label className="mt-4 block text-sm font-medium text-slate-700">Decision reason<textarea maxLength={2000} rows={2} className="mt-1 w-full rounded-md border border-slate-300 p-2.5" value={reasons[item.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} placeholder="Required explanation for approval or rejection" /></label>
          <div className="mt-3 flex flex-wrap gap-2"><Button disabled={lateDecision.isPending || !(reasons[item.id] ?? "").trim()} onClick={() => lateDecision.mutate({ id: item.id, choice: "approve" })}><CheckCircle2 className="mr-2 h-4 w-4" />Approve total nonperformance</Button><Button variant="destructive" disabled={lateDecision.isPending || !(reasons[item.id] ?? "").trim()} onClick={() => lateDecision.mutate({ id: item.id, choice: "reject" })}>Reject claim</Button></div>
        </CardContent></Card>)}</div>
      </LoadState>
    </section>
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Client credit memo ledger</h2>
      <LoadState loading={clientCreditsQuery.isLoading} error={clientCreditsQuery.error} empty={!clientCreditsQuery.isLoading && !clientCreditsQuery.error && !clientCreditsQuery.data?.creditMemos.length}>
        <div className="space-y-2">{(clientCreditsQuery.data?.creditMemos ?? []).map((memo) => <Card key={memo.id}><CardContent className="p-4">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium text-slate-900">Credit {memo.id} · Client {memo.client_id}</p><p className="mt-1 text-sm text-slate-600">Original period {date(memo.period_start)} – {date(memo.period_end)} · Claim {memo.claim_status}</p><p className="mt-1 break-all text-xs text-slate-500">Source Talent invoice {memo.original_talent_invoice_id} · Contract {memo.hiring_contract_id}</p></div><div className="text-right text-sm"><p>{money(memo.currency, memo.all_in_amount)} issued</p><p className="text-indigo-700">{money(memo.currency, memo.applied_amount)} applied · {money(memo.currency, memo.remaining_amount)} remaining</p></div></div>
          {(clientCreditsQuery.data?.applications ?? []).filter((app) => app.client_credit_memo_id === memo.id).map((app) => <p key={app.client_monthly_invoice_id} className="mt-2 text-xs text-slate-600">Applied {money(memo.currency, app.amount)} to Client statement {date(app.invoice_month, { month: "long", year: "numeric" })} · {app.status}</p>)}
        </CardContent></Card>)}</div>
      </LoadState>
    </section>
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Talent invoice ledger</h2>
      <LoadState loading={talentInvoicesQuery.isLoading} error={talentInvoicesQuery.error} empty={!talentInvoicesQuery.isLoading && !talentInvoicesQuery.error && !talentInvoicesQuery.data?.invoices.length}>
        <div className="space-y-3">{(talentInvoicesQuery.data?.invoices ?? []).map((invoice) => {
          const applications = (talentInvoicesQuery.data?.creditApplications ?? []).filter((application) => application.invoice_id === invoice.id);
          return <Card key={invoice.id}><CardContent className="p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="font-semibold text-slate-900">{invoice.job_title}</h3><p className="mt-1 break-all text-xs text-slate-500">Invoice {invoice.id}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${invoice.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{invoice.status}</span>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-slate-500">Service period</p><p className="mt-1 font-medium text-slate-900">{date(invoice.period_start)} – {date(invoice.period_end)}</p></div>
              <div><p className="text-xs text-slate-500">Billing mode</p><p className="mt-1 font-medium capitalize text-slate-900">{invoice.billing_mode || "Not specified"}</p></div>
              <div><p className="text-xs text-slate-500">Talent invoice amount</p><p className="mt-1 font-medium text-slate-900">{money(invoice.currency, invoice.amount)}</p></div>
              <div><p className="text-xs text-slate-500">Talent / Client</p><p className="mt-1 break-all text-xs text-slate-800">Talent: {invoice.talent_id}<br />Client: {invoice.client_id}</p></div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit applications</p>
              {applications.length ? <ul className="mt-2 space-y-2">{applications.map((application) => <li key={`${application.credit_memo_id}-${application.created_at}`} className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="break-all text-slate-700">Memo {application.credit_memo_id} · applied {money(invoice.currency, application.applied_amount)} of {money(invoice.currency, application.memo_amount)}</span>
                <span className="text-xs text-slate-500">{date(application.created_at, { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>)}</ul> : <p className="mt-1 text-sm text-slate-500">No credit applications recorded.</p>}
            </div>
          </CardContent></Card>;
        })}</div>
      </LoadState>
    </section>
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Talent invoicing blockers</h2>
      <LoadState loading={blockedQuery.isLoading} error={blockedQuery.error}>
        {blockedQuery.data && <div className="grid gap-4 lg:grid-cols-2">
          {(["blockedContracts", "blockedPayouts"] as const).map((key) => <Card key={key}><CardContent className="p-5"><h3 className="font-semibold text-slate-900">{key === "blockedContracts" ? "Blocked contracts" : "Blocked payouts"}</h3>{blockedQuery.data![key].length === 0 ? <p className="mt-3 text-sm text-slate-500">No {key === "blockedContracts" ? "blocked contracts" : "blocked payouts"}.</p> : <div className="mt-3 space-y-3">{blockedQuery.data![key].map((row, index) => <div key={String(row.hiring_contract_id ?? row.invoice_id ?? index)} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-medium text-slate-900">{key === "blockedContracts" ? `Contract ${row.hiring_contract_id}` : `Invoice ${row.invoice_id}`}</p><p className="mt-1 text-amber-900">{row.error}</p></div>)}</div>}</CardContent></Card>)}
        </div>}
      </LoadState>
    </section>
  </main>;
}

export default function Invoicing({ role }: { role: Role }) {
  return <div className="min-h-screen bg-slate-50">{role === "talent" ? <TalentInvoices /> : role === "client" ? <ClientInvoices /> : <AdminInvoicing />}</div>;
}