import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, ShieldCheck, ReceiptText, Eye } from "lucide-react";
import { Link } from "wouter";
import {
  formatPaymentAmount,
  formatPaymentDate,
  HiringInvoiceStatus,
  hiringPaymentRequest,
  HiringInvoice,
  HiringInvoiceHistory,
  statusLabel,
  getHiringPaymentErrorInfo,
  HiringPaymentErrorInfo,
} from "./paymentTypes";

function InvoiceDetail({ invoice, history, onClose, onRetry }: {
  invoice: HiringInvoice;
  history: HiringInvoiceHistory[];
  onClose: () => void;
  onRetry?: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" /> Hiring invoice {invoice.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-slate-50 p-4">
            <div><p className="font-semibold">{invoice.job_title || "Pre-offer hiring fee"}</p><p className="text-sm text-muted-foreground">{invoice.talent_name || "Selected talent"}</p></div>
            <div className="text-right"><p className="text-xl font-semibold tabular-nums">{formatPaymentAmount(invoice.amount, invoice.currency)}</p><HiringInvoiceStatus status={invoice.status} /></div>
          </div>
          <p className="text-sm">{invoice.fee_description}</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Issued:</span> {formatPaymentDate(invoice.issued_at)}</p>
            <p><span className="text-muted-foreground">Due:</span> {formatPaymentDate(invoice.due_date)}</p>
            <p><span className="text-muted-foreground">Fee basis:</span> {invoice.fee_basis.replaceAll("_", " ")}</p>
            <p><span className="text-muted-foreground">Tax:</span> {invoice.tax_treatment} — {invoice.tax_description}</p>
          </div>
          {invoice.status === "paid" && invoice.verified_at && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Payment Verified</p>
              <p className="mt-1">Verified {formatPaymentDate(invoice.verified_at)}. This verified invoice may authorize the existing offer workflow.</p>
            </div>
          )}
          {invoice.status !== "paid" && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <p className="text-sm text-muted-foreground">Open the secure payment page to review the invoice, approved instructions, and receipt history.</p>
              <Button asChild className="mt-3">
                <Link href={`/client/payments/hiring_invoice/${encodeURIComponent(invoice.id)}`}>Continue to secure checkout</Link>
              </Button>
            </div>
          )}
          {history.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Invoice history</h3>
              <ol className="space-y-2 border-l pl-4 text-sm">
                {history.map((event) => <li key={event.id}>
                  <span className="font-medium">{event.event.replaceAll("_", " ")}</span>
                  {(event.previous_status || event.new_status) && <span> · {statusLabel[event.previous_status || ""] || event.previous_status || "—"} → {statusLabel[event.new_status || ""] || event.new_status || "—"}</span>}
                  <span className="text-muted-foreground"> · {formatPaymentDate(event.created_at)}</span>
                </li>)}
              </ol>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {onRetry && <Button variant="outline" onClick={onRetry}>Retry details</Button>}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientHiringPaymentPanel({ submissionId }: { submissionId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<HiringInvoice | null>(null);
  const [readyError, setReadyError] = useState<HiringPaymentErrorInfo | null>(null);
  const { data: invoices = [], isLoading, isError, refetch, isFetching } = useQuery<HiringInvoice[]>({
    queryKey: ["/api/client/hiring-invoices", submissionId],
    queryFn: () => hiringPaymentRequest("GET", `/api/client/hiring-invoices?submissionId=${encodeURIComponent(submissionId)}`),
    refetchInterval: 30_000,
  });
  const ready = useMutation({
    mutationFn: () => hiringPaymentRequest("POST", "/api/client/hiring-invoices/ready", { submissionId }),
    onSuccess: async () => { setReadyError(null); await queryClient.invalidateQueries({ queryKey: ["/api/client/hiring-invoices", submissionId] }); },
    onError: (cause: unknown) => setReadyError(getHiringPaymentErrorInfo(cause)),
  });
  const active = invoices.find((invoice) => !["void", "refunded", "invalidated"].includes(invoice.status));
  const verifiedInvoice = invoices.find((invoice) => invoice.status === "paid" && Boolean(invoice.verified_at));
  const detail = useQuery<{ invoice: HiringInvoice; history: HiringInvoiceHistory[] }>({
    queryKey: ["/api/client/hiring-invoices/detail", selected?.id],
    queryFn: () => hiringPaymentRequest("GET", `/api/client/hiring-invoices/${selected!.id}`),
    enabled: Boolean(selected),
  });
  return (
    <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:bg-indigo-950/20" aria-label="Pre-offer hiring payment">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="flex items-center gap-2 font-semibold text-indigo-950 dark:text-indigo-100"><ReceiptText className="h-4 w-4" /> Pre-offer hiring payment</p><p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">Your hiring invoice must be paid and verified before you can send an offer to this talent.</p></div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="mr-2 h-4 w-4" /> Check payment status</Button>
      </div>
      {isLoading ? <div className="h-12 animate-pulse rounded bg-slate-200/70" /> : isError
        ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-rose-800"><span>Invoice status could not be confirmed. Sending an offer remains unavailable until status is checked.</span><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>
        : verifiedInvoice
          ? <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 font-semibold text-emerald-800"><ShieldCheck className="h-5 w-5" /> Payment Verified</p><Button variant="outline" size="sm" onClick={() => setSelected(verifiedInvoice)}>View Invoice</Button></div>
          : active
            ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/75 p-3 dark:bg-slate-900/60"><div><p className="font-medium">{active.invoice_number} · {formatPaymentAmount(active.amount, active.currency)}</p><p className="text-sm text-muted-foreground">{active.job_title || "Hiring fee"} · Due {formatPaymentDate(active.due_date)}</p><HiringInvoiceStatus status={active.status} /></div><Button onClick={() => setSelected(active)}>View invoice &amp; payment instructions</Button></div>
            : <Button onClick={() => ready.mutate()} disabled={ready.isPending}>{ready.isPending ? "Preparing invoice…" : "Ready for Offer"}</Button>}
      {readyError && (
        <div
          role="alert"
          className={`space-y-2 rounded-lg border p-4 text-sm ${
            readyError.kind === "job-billing"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <p className="font-semibold">{readyError.heading}</p>
          <p>{readyError.message}</p>
          {readyError.kind === "job-billing" && readyError.missingFields.length > 0 && (
            <div>
              <p className="font-medium">Missing job billing settings:</p>
              <ul className="list-inside list-disc">
                {readyError.missingFields.map((field) => <li key={field}>{field}</li>)}
              </ul>
            </div>
          )}
          {readyError.kind === "job-billing" && (
            readyError.editPath
              ? <a
                  href={readyError.editPath}
                  className="inline-flex min-h-9 items-center rounded-md border border-current px-3 font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  Review Job Billing Settings
                </a>
              : <p className="font-medium">Please contact an OnSpot administrator to update this job's billing settings.</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReadyError(null)}
            className="ml-2"
          >
            Dismiss
          </Button>
        </div>
      )}
      {selected && (detail.isLoading
        ? <div className="h-10 animate-pulse rounded bg-slate-200" />
        : detail.data
          ? <InvoiceDetail invoice={detail.data.invoice} history={detail.data.history || []} onClose={() => setSelected(null)} onRetry={() => detail.refetch()} />
          : <div role="alert" className="flex items-center justify-between gap-2 text-sm text-rose-700"><span>Invoice details could not be loaded.</span><span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => detail.refetch()}>Retry</Button><Button size="sm" variant="outline" onClick={() => setSelected(null)}>Close</Button></span></div>)}
    </section>
  );
}

export function ClientHiringInvoicesSection() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery<HiringInvoice[]>({
    queryKey: ["/api/client/hiring-invoices"],
    queryFn: () => hiringPaymentRequest("GET", "/api/client/hiring-invoices"),
    refetchInterval: 60_000,
  });
  const detail = useQuery<{ invoice: HiringInvoice; history: HiringInvoiceHistory[] }>({
    queryKey: ["/api/client/hiring-invoices/detail", selected],
    queryFn: () => hiringPaymentRequest("GET", `/api/client/hiring-invoices/${selected}`),
    enabled: Boolean(selected),
  });
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Separate from engagement billing</p><h2 className="mt-1 text-xl font-semibold">Pre-offer hiring invoices</h2><p className="text-sm text-muted-foreground">One-time invoice and payment verification required before a formal offer.</p></div><Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="space-y-3 p-5"><div className="h-8 animate-pulse rounded bg-muted" /><div className="h-8 animate-pulse rounded bg-muted" /></div>
          : isError ? <div role="alert" className="p-6 text-sm text-rose-700">Pre-offer invoices could not be loaded. <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>
            : data.length === 0 ? <div className="p-8 text-center"><ReceiptText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="font-medium">No pre-offer invoices yet</p><p className="mt-1 text-sm text-muted-foreground">When you mark an eligible application Ready for Offer, its invoice will appear here.</p></div>
              : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground"><tr>{["Invoice", "Talent / job", "Amount", "Issued / due", "Status", ""].map((title) => <th key={title} className="px-4 py-3 font-medium">{title}</th>)}</tr></thead><tbody>{data.map((invoice) => <tr key={invoice.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{invoice.invoice_number}</td><td className="px-4 py-3">{invoice.talent_name || "Talent"}<p className="text-xs text-muted-foreground">{invoice.job_title || "Job"}</p></td><td className="px-4 py-3 tabular-nums">{formatPaymentAmount(invoice.amount, invoice.currency)}</td><td className="px-4 py-3 text-muted-foreground">{formatPaymentDate(invoice.issued_at)} / {formatPaymentDate(invoice.due_date)}</td><td className="px-4 py-3"><HiringInvoiceStatus status={invoice.status} /></td><td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => setSelected(invoice.id)}><Eye className="mr-1 h-3.5 w-3.5" />View invoice</Button></td></tr>)}</tbody></table></div>}
      </CardContent></Card>
      {selected && (detail.isLoading ? <div className="h-10 animate-pulse rounded bg-muted" /> : detail.data ? <InvoiceDetail invoice={detail.data.invoice} history={detail.data.history || []} onClose={() => setSelected(null)} onRetry={() => detail.refetch()} /> : <div role="alert" className="flex justify-end gap-2 text-sm text-rose-700"><span className="mr-auto">Invoice details are unavailable.</span><Button variant="outline" size="sm" onClick={() => detail.refetch()}>Retry</Button><Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button></div>)}
    </section>
  );
}
