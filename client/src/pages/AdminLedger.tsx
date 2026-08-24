import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authAPI } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  WalletCards,
} from "lucide-react";

interface LedgerRow {
  id: string;
  hiring_contract_id: string;
  period_start: string;
  period_end: string;
  status: string;
  client_name: string | null;
  client_email: string | null;
  talent_name: string | null;
  talent_email: string | null;
  talent_rate: string;
  talent_rate_currency: string;
  adjusted_talent_payout: string;
  client_invoice_amount: string;
  commission_earned: string;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  invoice_amount: string | null;
  invoice_currency: string | null;
  due_date: string | null;
  paid_at: string | null;
  payout_id: string | null;
  payout_status: string | null;
  payout_amount: string | null;
  payout_currency: string | null;
  payout_method: string | null;
  payout_external_ref: string | null;
  disbursed_at: string | null;
  failed_reason: string | null;
  deposit_id: string | null;
  deposit_status: string | null;
  deposit_amount: string | null;
  deposit_currency: string | null;
  outstanding_invoice_amount: string;
  outstanding_payout_amount: string;
}

interface LedgerResponse {
  page: number;
  pages: number;
  total: number;
  summary: {
    gtv: string;
    outstanding_invoices: string;
    pending_payouts: string;
    deposits_at_risk: number;
  };
  items: LedgerRow[];
}

interface SignedContract {
  hiring_contract_id: string;
  contract_status: string;
  onspot_signed_at: string | null;
  engagement_type: string;
  talent_rate: string;
  talent_rate_currency: string;
  client_name: string | null;
  client_email: string | null;
  talent_name: string | null;
  talent_email: string | null;
  job_title: string | null;
  period_count: number;
  last_period_end: string | null;
  deposit_id: string | null;
  deposit_status: string | null;
  deposit_amount: string | null;
  deposit_currency: string | null;
}

const PAGE_SIZE = 20;

function money(value: string | number | null | undefined, currency: string | null = "PHP") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "PHP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function statusClass(status: string | null | undefined) {
  if (status === "paid" || status === "disbursed" || status === "closed" || status === "held") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (status === "failed" || status === "void" || status === "forfeited") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (status === "drawn" || status === "suspended" || status === "overdue") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function currentMonthDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const pad = (value: number) => String(value).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

export default function AdminLedger() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const monthDates = currentMonthDates();
  const [periodDraft, setPeriodDraft] = useState({
    contractId: "",
    start: monthDates.start,
    end: monthDates.end,
    extendedHours: "0",
    deductionHours: "0",
    commissionRate: "",
    notes: "",
  });

  const { data, isFetching, refetch } = useQuery<LedgerResponse>({
    queryKey: ["/api/admin/ledger", { page, status }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status !== "all") params.set("status", status);
      return authAPI.get(`/api/admin/ledger?${params.toString()}`);
    },
  });

  const { data: signedContracts = [], isFetching: contractsFetching } = useQuery<SignedContract[]>({
    queryKey: ["/api/admin/billing-contracts"],
    queryFn: () => authAPI.get("/api/admin/billing-contracts"),
  });

  const mutation = useMutation({
    mutationFn: async (input: { endpoint: string; body: Record<string, unknown> }) =>
      authAPI.patch(input.endpoint, input.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-contracts"] });
      toast({ title: "Ledger updated", description: "The billing record was updated successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Ledger update failed",
        description: error?.response?.data?.error || "Please check the record and try again.",
        variant: "destructive",
      });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (input: { endpoint: string; body?: Record<string, unknown> }) =>
      authAPI.post(input.endpoint, input.body || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-contracts"] });
      toast({ title: "Ledger updated", description: "The billing record was updated successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Ledger update failed",
        description: error?.response?.data?.error || "Please check the record and try again.",
        variant: "destructive",
      });
    },
  });

  const issueInvoice = (row: LedgerRow) => {
    postMutation.mutate({ endpoint: `/api/admin/billing-periods/${row.id}/invoices` });
  };

  const schedulePayout = (row: LedgerRow) => {
    postMutation.mutate({ endpoint: `/api/admin/billing-periods/${row.id}/payouts` });
  };

  const collectDeposit = (row: LedgerRow) => {
    postMutation.mutate({ endpoint: `/api/admin/contracts/${row.hiring_contract_id}/security-deposit` });
  };

  const collectContractDeposit = (contract: SignedContract) => {
    postMutation.mutate({ endpoint: `/api/admin/contracts/${contract.hiring_contract_id}/security-deposit` });
  };

  const createPeriod = () => {
    if (!periodDraft.contractId) {
      toast({ title: "Choose a signed contract", description: "Select the contract this billing period belongs to.", variant: "destructive" });
      return;
    }
    const body: Record<string, unknown> = {
      periodStart: periodDraft.start,
      periodEnd: periodDraft.end,
      extendedHours: Number(periodDraft.extendedHours || 0),
      deductionHours: Number(periodDraft.deductionHours || 0),
    };
    if (periodDraft.commissionRate.trim()) body.commissionRate = Number(periodDraft.commissionRate);
    if (periodDraft.notes.trim()) body.notes = periodDraft.notes.trim();
    postMutation.mutate({
      endpoint: `/api/admin/contracts/${periodDraft.contractId}/billing-periods`,
      body,
    });
  };

  const updateInvoice = (row: LedgerRow, action: "paid" | "void") => {
    if (!row.invoice_id) return;
    if (action === "void" && !window.confirm(`Void invoice ${row.invoice_number}?`)) return;
    const body: Record<string, unknown> = { action };
    if (action === "paid") {
      const paymentMethod = window.prompt("Payment method: wire or credit_card", "wire");
      if (!paymentMethod) return;
      const externalRef = window.prompt("Payment reference", "");
      if (!externalRef) return;
      body.paymentMethod = paymentMethod;
      body.externalRef = externalRef;
    }
    mutation.mutate({ endpoint: `/api/admin/invoices/${row.invoice_id}`, body });
  };

  const updatePayout = (row: LedgerRow, action: "disbursed" | "failed") => {
    if (!row.payout_id) return;
    const value = window.prompt(
      action === "disbursed" ? "Disbursement reference" : "Reason the payout failed",
      "",
    );
    if (!value) return;
    mutation.mutate({
      endpoint: `/api/admin/payouts/${row.payout_id}`,
      body: action === "disbursed" ? { action, externalRef: value } : { action, failedReason: value },
    });
  };

  const advanceDeposit = (row: LedgerRow, action: string) => {
    if (!row.deposit_id) return;
    const body: Record<string, unknown> = { action };
    if (action === "draw") {
      body.drawnReason = window.prompt("Reason for drawing the deposit", "Client payment shortfall") || "";
    }
    if (action === "apply") {
      body.terminalReason = window.prompt("Terminal reason: normal_termination or mutual_end", "normal_termination") || "";
    }
    if (action === "forfeit") {
      body.terminalReason = window.prompt("Terminal reason (must be nonpayment_breach)", "nonpayment_breach") || "";
    }
    mutation.mutate({ endpoint: `/api/admin/security-deposits/${row.deposit_id}`, body });
  };

  const summary = data?.summary;
  const rows = data?.items ?? [];

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6" data-testid="admin-ledger-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/dashboard")} className="h-auto p-1">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CircleDollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Billing Ledger</h1>
            <p className="text-sm text-muted-foreground">Invoices, talent payouts, and security deposits in one place.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-ledger">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">GTV</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{money(summary?.gtv)}</p><p className="text-xs text-muted-foreground">Client billing value</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding invoices</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{money(summary?.outstanding_invoices)}</p><p className="text-xs text-muted-foreground">Not paid or void</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending payouts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{money(summary?.pending_payouts)}</p><p className="text-xs text-muted-foreground">Pending or scheduled</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Deposits at risk</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary?.deposits_at_risk ?? 0}</p><p className="text-xs text-muted-foreground">Drawn or suspended</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            Start a billing period
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a signed contract to calculate a draft period from its offer rate and engagement type.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Signed contract</span>
              <select
                value={periodDraft.contractId}
                onChange={(event) => setPeriodDraft((draft) => ({ ...draft, contractId: event.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-3"
                aria-label="Select signed contract"
                data-testid="select-billing-contract"
                disabled={contractsFetching}
              >
                <option value="">{contractsFetching ? "Loading contracts…" : "Choose a contract"}</option>
                {signedContracts.map((contract) => (
                  <option key={contract.hiring_contract_id} value={contract.hiring_contract_id}>
                    {contract.job_title || "Untitled job"} · {contract.talent_name || contract.talent_email || "Talent"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Period start</span>
              <input
                type="date"
                value={periodDraft.start}
                onChange={(event) => setPeriodDraft((draft) => ({ ...draft, start: event.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-3"
                data-testid="input-period-start"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Period end</span>
              <input
                type="date"
                value={periodDraft.end}
                onChange={(event) => setPeriodDraft((draft) => ({ ...draft, end: event.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-3"
                data-testid="input-period-end"
              />
            </label>
            <div className="flex items-end">
              <Button onClick={createPeriod} disabled={postMutation.isPending || contractsFetching} data-testid="button-create-period">
                {postMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create draft period
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Extended hours</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={periodDraft.extendedHours}
                onChange={(event) => setPeriodDraft((draft) => ({ ...draft, extendedHours: event.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-3"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Deduction hours</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={periodDraft.deductionHours}
                onChange={(event) => setPeriodDraft((draft) => ({ ...draft, deductionHours: event.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-3"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Commission rate (optional)</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                placeholder="Use billing default"
                value={periodDraft.commissionRate}
                onChange={(event) => setPeriodDraft((draft) => ({ ...draft, commissionRate: event.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-3"
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Notes (optional)</span>
            <textarea
              value={periodDraft.notes}
              onChange={(event) => setPeriodDraft((draft) => ({ ...draft, notes: event.target.value }))}
              className="min-h-16 w-full rounded-md border bg-background px-3 py-2"
              placeholder="Add reconciliation notes for this period"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Signed contract work queue
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Signed contracts remain visible here even before their first billing period exists.
          </p>
        </CardHeader>
        <CardContent>
          {contractsFetching ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading signed contracts…</div>
          ) : signedContracts.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No signed contracts are ready for billing.</p>
          ) : (
            <div className="space-y-3">
              {signedContracts.map((contract) => (
                <div key={contract.hiring_contract_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" data-testid={`billing-contract-${contract.hiring_contract_id}`}>
                  <div>
                    <div className="font-medium">{contract.job_title || "Untitled job"}</div>
                    <div className="text-sm text-muted-foreground">
                      {contract.client_name || contract.client_email || "Client"} · {contract.talent_name || contract.talent_email || "Talent"} · {money(contract.talent_rate, contract.talent_rate_currency)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{contract.period_count} period{contract.period_count === 1 ? "" : "s"}</span>
                      {contract.last_period_end ? <span>Last through {date(contract.last_period_end)}</span> : <span>No period yet</span>}
                      <Badge variant="outline" className={statusClass(contract.deposit_status)}>{contract.deposit_status?.replaceAll("_", " ") || "deposit missing"}</Badge>
                    </div>
                  </div>
                  {contract.deposit_status === "pending" || !contract.deposit_id ? (
                    <Button size="sm" variant="outline" onClick={() => collectContractDeposit(contract)} disabled={postMutation.isPending} data-testid={`button-collect-contract-deposit-${contract.hiring_contract_id}`}>
                      Collect deposit
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Billing periods</h2>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} total period{data?.total === 1 ? "" : "s"}</p>
        </div>
        <select
          value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(1); }}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="Filter billing periods by status"
          data-testid="select-ledger-status"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="invoiced">Invoiced</option>
          <option value="payout_scheduled">Payout scheduled</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isFetching && rows.length === 0 ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No billing periods match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium">Period / parties</th>
                    <th className="px-4 py-3 font-medium">GTV / commission</th>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Talent payout</th>
                    <th className="px-4 py-3 font-medium">Deposit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top last:border-0 hover:bg-muted/20" data-testid={`ledger-row-${row.id}`}>
                      <td className="space-y-1 px-4 py-4">
                        <div className="font-medium">{date(row.period_start)} – {date(row.period_end)}</div>
                        <div className="text-xs text-muted-foreground">Client: {row.client_name || row.client_email || "—"}</div>
                        <div className="text-xs text-muted-foreground">Talent: {row.talent_name || row.talent_email || "—"}</div>
                        <Badge variant="outline" className={statusClass(row.status)}>{row.status.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="space-y-1 px-4 py-4">
                        <div className="font-semibold">{money(row.client_invoice_amount, row.talent_rate_currency)}</div>
                        <div className="text-xs text-muted-foreground">Commission {money(row.commission_earned, row.talent_rate_currency)}</div>
                        <div className="text-xs text-muted-foreground">Rate {money(row.talent_rate, row.talent_rate_currency)}</div>
                      </td>
                      <td className="space-y-1 px-4 py-4">
                        {row.invoice_id && row.invoice_status !== "void" ? (
                          <>
                            <div className="font-medium">{row.invoice_number}</div>
                            <Badge variant="outline" className={statusClass(row.invoice_status)}>{row.invoice_status}</Badge>
                            <div className="text-xs text-muted-foreground">{money(row.invoice_amount, row.invoice_currency)} · Due {date(row.due_date)}</div>
                            {row.invoice_status === "sent" || row.invoice_status === "overdue" ? (
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" onClick={() => updateInvoice(row, "paid")} disabled={mutation.isPending} data-testid={`button-pay-invoice-${row.id}`}>Mark paid</Button>
                                <Button size="sm" variant="outline" onClick={() => updateInvoice(row, "void")} disabled={mutation.isPending}>Void</Button>
                              </div>
                            ) : null}
                          </>
                        ) : row.invoice_id && row.invoice_status === "void" ? (
                          <>
                            <div className="font-medium">{row.invoice_number}</div>
                            <Badge variant="outline" className={statusClass(row.invoice_status)}>void</Badge>
                            <Button size="sm" onClick={() => issueInvoice(row)} disabled={postMutation.isPending} data-testid={`button-reissue-invoice-${row.id}`}>
                              Issue replacement
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => issueInvoice(row)} disabled={postMutation.isPending} data-testid={`button-issue-invoice-${row.id}`}>
                            Issue invoice
                          </Button>
                        )}
                      </td>
                      <td className="space-y-1 px-4 py-4">
                        <div className="font-semibold">{money(row.adjusted_talent_payout, row.talent_rate_currency)}</div>
                        {row.payout_id ? (
                          <>
                            <Badge variant="outline" className={statusClass(row.payout_status)}>{row.payout_status}</Badge>
                            <div className="text-xs text-muted-foreground">{row.payout_method || "—"}</div>
                            {row.payout_status === "pending" || row.payout_status === "scheduled" ? (
                              row.invoice_status === "paid" ? (
                                <div className="flex gap-2 pt-1">
                                  <Button size="sm" onClick={() => updatePayout(row, "disbursed")} disabled={mutation.isPending} data-testid={`button-disburse-payout-${row.id}`}>Disburse</Button>
                                  <Button size="sm" variant="outline" onClick={() => updatePayout(row, "failed")} disabled={mutation.isPending}>Fail</Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Pay invoice before disbursing</span>
                              )
                            ) : null}
                          </>
                        ) : (
                          row.invoice_status === "paid" ? (
                            <Button size="sm" variant="outline" onClick={() => schedulePayout(row)} disabled={postMutation.isPending} data-testid={`button-schedule-payout-${row.id}`}>
                              Schedule payout
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pay invoice before scheduling</span>
                          )
                        )}
                      </td>
                      <td className="space-y-1 px-4 py-4">
                        {row.deposit_id ? (
                          <>
                            <div className="font-medium">{money(row.deposit_amount, row.deposit_currency)}</div>
                            <Badge variant="outline" className={statusClass(row.deposit_status)}>{row.deposit_status?.replaceAll("_", " ")}</Badge>
                            {row.deposit_status === "held" ? (
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="outline" onClick={() => advanceDeposit(row, "draw")} disabled={mutation.isPending}>Draw</Button>
                                <Button size="sm" variant="outline" onClick={() => advanceDeposit(row, "apply")} disabled={mutation.isPending}>Apply</Button>
                              </div>
                            ) : null}
                            {row.deposit_status === "pending" ? (
                              <Button size="sm" variant="outline" onClick={() => collectDeposit(row)} disabled={postMutation.isPending}>
                                Collect deposit
                              </Button>
                            ) : null}
                            {row.deposit_status === "drawn" ? (
                              <Button size="sm" variant="outline" onClick={() => advanceDeposit(row, "replenishment_pending")} disabled={mutation.isPending}>
                                Mark replenishment due
                              </Button>
                            ) : null}
                            {row.deposit_status === "replenishment_pending" ? (
                              <Button size="sm" variant="outline" onClick={() => advanceDeposit(row, "suspend")} disabled={mutation.isPending}>Suspend</Button>
                            ) : null}
                            {row.deposit_status === "suspended" ? (
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="outline" onClick={() => advanceDeposit(row, "cure")} disabled={mutation.isPending}>Cure / hold</Button>
                                <Button size="sm" variant="outline" onClick={() => advanceDeposit(row, "forfeit")} disabled={mutation.isPending}>Forfeit</Button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => collectDeposit(row)} disabled={postMutation.isPending}>
                            Collect deposit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {data?.page ?? page} of {data?.pages ?? 1}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || isFetching}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(data?.pages ?? value, value + 1))} disabled={page >= (data?.pages ?? 1) || isFetching}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
