import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DollarSign, TrendingUp, AlertCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface LedgerSummary {
  total_gtv: string;
  total_commission: string;
  total_talent_payouts: string;
  total_periods: string;
  draft_periods: string;
  ready_periods: string;
  invoiced_periods: string;
  payout_scheduled_periods: string;
  closed_periods: string;
  outstanding_invoice_amount: string;
  pending_payout_count: string;
  deposits_at_risk: string;
}

interface LedgerPeriod {
  id: string;
  hiring_contract_id: string;
  period_start: string;
  period_end: string;
  talent_rate: string;
  talent_rate_currency: string;
  standard_period_hours: number;
  extended_hours: string;
  deduction_hours: string;
  adjusted_talent_payout: string;
  commission_rate: string;
  client_invoice_amount: string;
  commission_earned: string;
  status: string;
  engagement_type: string;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  paid_at: string | null;
  payout_id: string | null;
  payout_status: string | null;
  disbursed_at: string | null;
  deposit_id: string | null;
  deposit_status: string | null;
  deposit_amount: string | null;
  notes: string | null;
  created_at: string;
}

interface LedgerResponse {
  periods: LedgerPeriod[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PHP = (v: string | number | null | undefined) =>
  v == null ? "—" : `₱${parseFloat(String(v)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const PCT = (v: string | number) => `${(parseFloat(String(v)) * 100).toFixed(0)}%`;

const fDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

const PERIOD_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  invoiced: "bg-yellow-100 text-yellow-800",
  payout_scheduled: "bg-purple-100 text-purple-700",
  closed: "bg-green-100 text-green-800",
};

const INV_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-200 text-gray-500 line-through",
};

const DEP_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  held: "bg-green-100 text-green-700",
  drawn: "bg-yellow-100 text-yellow-800",
  replenishment_pending: "bg-orange-100 text-orange-700",
  suspended: "bg-red-100 text-red-700",
  forfeited: "bg-red-200 text-red-900 font-bold",
  applied: "bg-green-100 text-green-700",
  void: "bg-gray-200 text-gray-500",
};

// ── Create Billing Period Modal ────────────────────────────────────────────────

function CreatePeriodModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [hcId, setHcId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [extHours, setExtHours] = useState("0");
  const [dedHours, setDedHours] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      authAPI.post(`/api/admin/hiring-contracts/${hcId.trim()}/billing-periods`, {
        periodStart, periodEnd,
        extendedHours: parseFloat(extHours),
        deductionHours: parseFloat(dedHours),
        notes: notes || undefined,
      }),
    onSuccess: () => { onCreated(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error ?? e.message ?? "Failed"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Create Billing Period</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <label className="text-sm font-medium">Hiring Contract ID</label>
          <Input placeholder="UUID" value={hcId} onChange={e => setHcId(e.target.value)} className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Period Start</label>
            <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Period End</label>
            <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Extended Hours</label>
            <Input type="number" min="0" step="0.5" value={extHours} onChange={e => setExtHours(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Deduction Hours</label>
            <Input type="number" min="0" step="0.5" value={dedHours} onChange={e => setDedHours(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Notes (optional)</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !hcId || !periodStart || !periodEnd}>
          {mutation.isPending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Issue Invoice Modal ────────────────────────────────────────────────────────

function IssueInvoiceModal({ periodId, onClose, onDone }: { periodId: string; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState<"wire" | "credit_card">("wire");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      authAPI.post(`/api/admin/billing-periods/${periodId}/invoices`, { paymentMethod: method, notes: notes || undefined }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error ?? e.message ?? "Failed"),
  });

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Issue Invoice</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <label className="text-sm font-medium">Payment Method</label>
          <Select value={method} onValueChange={v => setMethod(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wire">Wire Transfer</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Notes (optional)</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Issuing…" : "Issue Invoice"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Mark Paid Modal ────────────────────────────────────────────────────────────

function MarkPaidModal({ invoiceId, onClose, onDone }: { invoiceId: string; onClose: () => void; onDone: () => void }) {
  const [externalRef, setExternalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      authAPI.patch(`/api/admin/invoices/${invoiceId}`, { action: "pay", externalRef: externalRef || undefined, notes: notes || undefined }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error ?? e.message ?? "Failed"),
  });

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Mark Invoice Paid</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <label className="text-sm font-medium">Payment Reference</label>
          <Input placeholder="Wire ref # or charge ID" value={externalRef} onChange={e => setExternalRef(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Notes (optional)</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Mark Paid"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Create Payout Modal ────────────────────────────────────────────────────────

function CreatePayoutModal({ periodId, onClose, onDone }: { periodId: string; onClose: () => void; onDone: () => void }) {
  const [region, setRegion] = useState("PH");
  const [method, setMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      authAPI.post(`/api/admin/billing-periods/${periodId}/payouts`, {
        payoutRegion: region, payoutMethod: method, notes: notes || undefined,
      }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error ?? e.message ?? "Failed"),
  });

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Create Payout Record</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Region</label>
            <Input value={region} onChange={e => setRegion(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="gcash">GCash</SelectItem>
                <SelectItem value="wise">Wise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Notes (optional)</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create Payout"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: LedgerSummary }) {
  const cards = [
    {
      label: "Total GTV",
      value: PHP(summary.total_gtv),
      sub: `${summary.total_periods} periods`,
      icon: <DollarSign className="w-5 h-5 text-green-600" />,
      color: "border-l-green-500",
    },
    {
      label: "Commission Earned",
      value: PHP(summary.total_commission),
      sub: `${PCT(parseFloat(summary.total_commission) / Math.max(1, parseFloat(summary.total_gtv)))} margin`,
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
      color: "border-l-blue-500",
    },
    {
      label: "Outstanding Invoices",
      value: PHP(summary.outstanding_invoice_amount),
      sub: `${summary.pending_payout_count} payouts pending`,
      icon: <Clock className="w-5 h-5 text-yellow-600" />,
      color: "border-l-yellow-500",
    },
    {
      label: "Deposits at Risk",
      value: summary.deposits_at_risk,
      sub: "drawn / suspended / replenishment",
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      color: parseInt(summary.deposits_at_risk) > 0 ? "border-l-red-500" : "border-l-gray-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <Card key={c.label} className={`border-l-4 ${c.color}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{c.label}</span>
              {c.icon}
            </div>
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Status Pipeline Bar ────────────────────────────────────────────────────────

function PipelineBar({ summary }: { summary: LedgerSummary }) {
  const stages = [
    { key: "draft_periods", label: "Draft" },
    { key: "ready_periods", label: "Ready" },
    { key: "invoiced_periods", label: "Invoiced" },
    { key: "payout_scheduled_periods", label: "Payout Sched." },
    { key: "closed_periods", label: "Closed" },
  ] as const;

  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {stages.map(s => (
        <div key={s.key} className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-3 py-2">
          <span className="text-xl font-bold text-gray-800">{(summary as any)[s.key]}</span>
          <span className="text-xs text-gray-500">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Period Row Actions ─────────────────────────────────────────────────────────

function PeriodActions({
  period, onRefresh,
}: {
  period: LedgerPeriod;
  onRefresh: () => void;
}) {
  const [modal, setModal] = useState<"invoice" | "paid" | "payout" | null>(null);
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ledger"] }); onRefresh(); };

  const advanceMutation = useMutation({
    mutationFn: (body: object) => authAPI.patch(`/api/admin/billing-periods/${period.id}`, body),
    onSuccess: refresh,
  });

  return (
    <div className="flex gap-1 flex-wrap">
      {/* draft → ready */}
      {period.status === "draft" && (
        <Button size="sm" variant="outline" className="text-xs"
          onClick={() => advanceMutation.mutate({ status: "ready" })}>
          Mark Ready
        </Button>
      )}
      {/* ready → issue invoice */}
      {period.status === "ready" && !period.invoice_id && (
        <Button size="sm" className="text-xs" onClick={() => setModal("invoice")}>
          Issue Invoice
        </Button>
      )}
      {/* invoice exists, not paid */}
      {period.invoice_id && period.invoice_status && !["paid", "void"].includes(period.invoice_status) && (
        <Button size="sm" variant="outline" className="text-xs" onClick={() => setModal("paid")}>
          Mark Paid
        </Button>
      )}
      {/* create payout */}
      {["invoiced", "ready"].includes(period.status) && !period.payout_id && (
        <Button size="sm" variant="outline" className="text-xs" onClick={() => setModal("payout")}>
          Create Payout
        </Button>
      )}

      <Dialog open={modal === "invoice"} onOpenChange={o => !o && setModal(null)}>
        {modal === "invoice" && <IssueInvoiceModal periodId={period.id} onClose={() => setModal(null)} onDone={refresh} />}
      </Dialog>
      <Dialog open={modal === "paid"} onOpenChange={o => !o && setModal(null)}>
        {modal === "paid" && period.invoice_id && (
          <MarkPaidModal invoiceId={period.invoice_id} onClose={() => setModal(null)} onDone={refresh} />
        )}
      </Dialog>
      <Dialog open={modal === "payout"} onOpenChange={o => !o && setModal(null)}>
        {modal === "payout" && <CreatePayoutModal periodId={period.id} onClose={() => setModal(null)} onDone={refresh} />}
      </Dialog>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminLedger() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const queryKey = ["ledger", page, statusFilter];
  const { data: ledger, isLoading: ledgerLoading } = useQuery<LedgerResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return authAPI.get(`/api/admin/ledger?${params}`);
    },
  });

  const { data: summary } = useQuery<LedgerSummary>({
    queryKey: ["ledger-summary"],
    queryFn: () => authAPI.get("/api/admin/ledger/summary"),
    refetchInterval: 30_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["ledger-summary"] });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Invoice periods · Client invoices · Talent payouts · Security deposits
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Billing Period</Button>
      </div>

      {/* Summary */}
      {summary && (
        <>
          <SummaryCards summary={summary} />
          <PipelineBar summary={summary} />
        </>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="payout_scheduled">Payout Scheduled</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        {ledger && (
          <span className="text-sm text-gray-500">{ledger.total} period{ledger.total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invoice Periods</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ledgerLoading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : !ledger?.periods.length ? (
            <div className="p-8 text-center text-gray-400">No billing periods yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Talent Payout</TableHead>
                    <TableHead className="text-right">Client Invoice</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Period Status</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.periods.map(p => (
                    <TableRow key={p.id} className="text-sm align-top">
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{fDate(p.period_start)}</div>
                        <div className="text-xs text-gray-400">→ {fDate(p.period_end)}</div>
                        <div className="text-[10px] text-gray-300 font-mono mt-0.5">{p.id.slice(0, 8)}…</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div>{p.engagement_type}</div>
                        <div className="text-xs text-gray-400">{p.standard_period_hours}h</div>
                        {(parseFloat(p.extended_hours) > 0 || parseFloat(p.deduction_hours) > 0) && (
                          <div className="text-[10px] text-blue-600">
                            {parseFloat(p.extended_hours) > 0 && `+${p.extended_hours}h ext`}
                            {parseFloat(p.deduction_hours) > 0 && ` -${p.deduction_hours}h ded`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {PHP(p.adjusted_talent_payout)}
                        <div className="text-xs text-gray-400">{p.talent_rate_currency}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap text-gray-800">
                        {PHP(p.client_invoice_amount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div>{PHP(p.commission_earned)}</div>
                        <div className="text-xs text-gray-400">{PCT(p.commission_rate)} rate</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${PERIOD_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.invoice_number ? (
                          <>
                            <div className="font-mono text-xs">{p.invoice_number}</div>
                            <Badge className={`text-xs mt-0.5 ${INV_COLORS[p.invoice_status ?? ""] ?? ""}`}>
                              {p.invoice_status}
                            </Badge>
                            {p.paid_at && <div className="text-[10px] text-green-600">{fDate(p.paid_at)}</div>}
                          </>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.payout_status ? (
                          <>
                            <Badge className={`text-xs ${p.payout_status === "disbursed" ? "bg-green-100 text-green-700" : p.payout_status === "failed" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}`}>
                              {p.payout_status}
                            </Badge>
                            {p.disbursed_at && <div className="text-[10px] text-green-600">{fDate(p.disbursed_at)}</div>}
                          </>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.deposit_status ? (
                          <>
                            <Badge className={`text-xs ${DEP_COLORS[p.deposit_status] ?? ""}`}>
                              {p.deposit_status}
                            </Badge>
                            {p.deposit_amount && (
                              <div className="text-[10px] text-gray-400">{PHP(p.deposit_amount)}</div>
                            )}
                          </>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <PeriodActions period={p} onRefresh={refresh} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {ledger && ledger.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-gray-500">
                Page {ledger.page} of {ledger.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= ledger.pages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Period Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreatePeriodModal onClose={() => setCreateOpen(false)} onCreated={refresh} />
      </Dialog>
    </div>
  );
}
