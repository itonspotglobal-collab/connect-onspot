import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import {
  formatPaymentAmount,
  formatPaymentDate,
  HiringInvoice,
  HiringInvoiceHistory,
  HiringInvoiceStatus,
  hiringPaymentRequest,
  statusLabel,
} from "./paymentTypes";

const blankPolicy = {
  amount: "", currency: "USD", feeBasis: "fixed_per_hiring_attempt", feeDescription: "",
  taxTreatment: "", taxDescription: "", dueDays: "", paymentMethod: "manual_transfer",
  paymentRecipient: "", paymentInstructions: "",
};

function isForbidden(error: unknown) {
  return String((error as Error)?.message || "").includes("403");
}

export function AdminHiringPaymentsSection() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ clientId: "", talentId: "", jobId: "", status: "" });
  const [selected, setSelected] = useState<HiringInvoice | null>(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [policy, setPolicy] = useState(blankPolicy);
  const [message, setMessage] = useState("");
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });

  const invoicesQuery = useQuery<HiringInvoice[]>({
    queryKey: ["/api/admin/hiring-invoices", filters],
    queryFn: () => hiringPaymentRequest("GET", `/api/admin/hiring-invoices${params.toString() ? `?${params.toString()}` : ""}`),
  });
  const policyQuery = useQuery<any>({
    queryKey: ["/api/admin/hiring-invoices/policy"],
    queryFn: () => hiringPaymentRequest("GET", "/api/admin/hiring-invoices/policy"),
  });
  const exceptionsQuery = useQuery<any[]>({
    queryKey: ["/api/admin/hiring-invoices/exceptions"],
    queryFn: () => hiringPaymentRequest("GET", "/api/admin/hiring-invoices/exceptions"),
  });
  const detailQuery = useQuery<{ invoice: HiringInvoice; history: HiringInvoiceHistory[] }>({
    queryKey: ["/api/admin/hiring-invoices/detail", selected?.id],
    queryFn: () => hiringPaymentRequest("GET", `/api/admin/hiring-invoices/${selected!.id}`),
    enabled: Boolean(selected),
  });

  const explainError = (error: any) => setMessage(isForbidden(error)
    ? "Access denied: this action requires a database-confirmed Super Admin account."
    : error?.message || "Request failed.");
  const savePolicy = useMutation({
    mutationFn: () => hiringPaymentRequest("POST", "/api/admin/hiring-invoices/policy", { ...policy, dueDays: Number(policy.dueDays) }),
    onSuccess: async () => {
      setMessage("A new immutable policy version is active. Existing invoices retain their original snapshots.");
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/hiring-invoices/policy"] });
      setPolicy(blankPolicy);
    },
    onError: explainError,
  });
  const submitReview = useMutation({
    mutationFn: () => hiringPaymentRequest("POST", `/api/admin/hiring-invoices/${selected!.id}/review`, {
      action,
      reason: reason.trim(),
    }),
    onSuccess: async () => {
      setSelected(null);
      setMessage("Invoice review recorded.");
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/hiring-invoices"] });
    },
    onError: explainError,
  });

  const openInvoice = (invoice: HiringInvoice) => {
    setSelected(invoice);
    setReason("");
    setAction(invoice.status === "paid" ? "refund"
      : invoice.status === "verification_pending" ? "void"
        : ["issued", "overdue", "payment_failed", "draft"].includes(invoice.status) ? "void" : "");
  };
  const updateFilter = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const allowedActions = selected?.status === "paid" ? ["refund", "invalidate"]
    : selected?.status === "verification_pending" ? ["void"]
      : selected && ["issued", "overdue", "payment_failed", "draft"].includes(selected.status) ? ["void"] : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Separate financial workflow</p><h2 className="mt-1 text-xl font-semibold">Pre-offer hiring invoices</h2><p className="text-sm text-muted-foreground">Receipt verification and payment settlement happen in the unified Payment Verifications queue.</p></div>
        <Button variant="outline" onClick={() => invoicesQuery.refetch()} disabled={invoicesQuery.isFetching}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
      {message && <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">{message}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Hiring fee policy</CardTitle><p className="text-sm text-muted-foreground">No default amount, tax treatment, instructions, or due date is assumed. Saving creates a new immutable version; existing invoices are unchanged.</p></CardHeader>
        <CardContent className="space-y-4">
          {policyQuery.isLoading ? <div className="h-12 animate-pulse rounded bg-muted" />
            : policyQuery.isError
              ? <div role="alert" className="text-sm text-rose-700">{isForbidden(policyQuery.error) ? "Access denied: only database-confirmed Super Admins may view or configure the hiring fee policy." : "Policy could not be loaded."} <Button size="sm" variant="outline" onClick={() => policyQuery.refetch()}>Retry</Button></div>
              : policyQuery.data ? <div className="rounded-lg border bg-slate-50 p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong>Current immutable policy</strong><Badge variant="outline">{policyQuery.data.id ? `Policy ${policyQuery.data.id}` : "Active"}</Badge></div>
                <p className="mt-2">{policyQuery.data.fee_description} · {formatPaymentAmount(policyQuery.data.amount, policyQuery.data.currency)}</p>
                <p className="text-muted-foreground">Tax: {policyQuery.data.tax_treatment} — {policyQuery.data.tax_description} · Due in {policyQuery.data.due_days} days</p>
                <p className="mt-1 text-muted-foreground">Recipient: {policyQuery.data.payment_recipient}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{policyQuery.data.payment_instructions}</p>
                <p className="mt-1 text-xs text-muted-foreground">Configured {formatPaymentDate(policyQuery.data.created_at)}</p>
              </div> : <p className="text-sm text-muted-foreground">No policy configured.</p>}
          <details>
            <summary className="cursor-pointer text-sm font-semibold">Configure a new explicit policy version</summary>
            <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); savePolicy.mutate(); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["amount", "Fee amount (USD)"], ["feeDescription", "Fee description"],
                  ["taxDescription", "Tax description"], ["dueDays", "Due in days (1–90)"],
                  ["paymentRecipient", "Payment recipient"], ["paymentInstructions", "Payment instructions"],
                ].map(([key, title]) => <label key={key} className="space-y-1 text-sm">
                  <span className="font-medium">{title}</span>
                  {key === "paymentInstructions"
                    ? <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2" value={policy[key as keyof typeof policy]} onChange={(event) => setPolicy({ ...policy, [key]: event.target.value })} required />
                    : <Input value={policy[key as keyof typeof policy]} onChange={(event) => setPolicy({ ...policy, [key]: event.target.value })} required type={key === "amount" || key === "dueDays" ? "number" : "text"} min={key === "amount" ? "0.01" : key === "dueDays" ? "1" : undefined} max={key === "dueDays" ? "90" : undefined} step={key === "amount" ? "0.01" : key === "dueDays" ? "1" : undefined} />}
                </label>)}
                <label className="space-y-1 text-sm"><span className="font-medium">Tax treatment</span><select className="h-10 w-full rounded-md border bg-background px-3" value={policy.taxTreatment} onChange={(event) => setPolicy({ ...policy, taxTreatment: event.target.value })} required><option value="">Choose treatment</option><option value="inclusive">Inclusive</option><option value="exempt">Exempt</option></select></label>
              </div>
              <Button disabled={savePolicy.isPending}>{savePolicy.isPending ? "Saving…" : "Save immutable policy version"}</Button>
            </form>
          </details>
        </CardContent>
      </Card>

      <Card><CardContent className="space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([["clientId", "Client ID"], ["talentId", "Talent ID"], ["jobId", "Job ID"]] as const).map(([key, title]) => <label key={key} className="space-y-1 text-xs font-medium">{title}<Input value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)} /></label>)}
          <label className="space-y-1 text-xs font-medium">Status<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{Object.entries(statusLabel).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        </div>
        {invoicesQuery.isLoading ? <div className="h-20 animate-pulse rounded bg-muted" />
          : invoicesQuery.isError ? <div role="alert" className="text-sm text-rose-700">{isForbidden(invoicesQuery.error) ? "Access denied: only database-confirmed Super Admins may access pre-offer payment administration." : "Hiring invoices could not be loaded."} <Button size="sm" variant="outline" onClick={() => invoicesQuery.refetch()}>Retry</Button></div>
            : (invoicesQuery.data || []).length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No pre-offer invoices match these filters.</p>
               : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="border-y bg-muted/40 text-left text-xs"><tr>{["Invoice", "Client", "Talent / job", "Amount", "Status", ""].map((title) => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead><tbody>{invoicesQuery.data?.map((invoice) => <tr key={invoice.id} className="border-b"><td className="px-3 py-3 font-medium">{invoice.invoice_number}</td><td className="px-3 py-3">{invoice.client_name || invoice.client_email || invoice.client_id || "—"}</td><td className="px-3 py-3">{invoice.talent_name || invoice.talent_id || "Talent"}<p className="text-xs text-muted-foreground">{invoice.job_title || invoice.job_id}</p></td><td className="px-3 py-3">{formatPaymentAmount(invoice.amount, invoice.currency)}</td><td className="px-3 py-3"><HiringInvoiceStatus status={invoice.status} /></td><td className="px-3 py-3 text-right"><div className="flex flex-wrap justify-end gap-2">{invoice.status === "verification_pending" && <Button asChild size="sm" variant="outline"><Link href="/admin/ledger#manual-wise-admin">Review receipt in Payment Verifications</Link></Button>}{invoice.status === "paid" && <span className="self-center text-xs font-medium text-emerald-800">{invoice.verified_at ? "Paid · independently verified" : "Paid record"}</span>}<Button size="sm" variant="outline" onClick={() => openInvoice(invoice)}>Details</Button></div></td></tr>)}</tbody></table></div>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Historical payment exceptions</CardTitle><p className="text-sm text-muted-foreground">Read-only records; no payment or hiring state is changed here.</p></CardHeader><CardContent>
        {exceptionsQuery.isLoading ? <div className="h-10 animate-pulse rounded bg-muted" />
          : exceptionsQuery.isError ? <div role="alert" className="text-sm text-rose-700">{isForbidden(exceptionsQuery.error) ? "Access denied: only database-confirmed Super Admins may view exceptions." : "Exceptions unavailable."} <Button size="sm" variant="outline" onClick={() => exceptionsQuery.refetch()}>Retry</Button></div>
            : exceptionsQuery.data?.length ? <ul className="space-y-2">{exceptionsQuery.data.map((item) => <li key={item.id} className="rounded border p-3 text-sm"><strong>{item.reason}</strong><p className="text-xs text-muted-foreground">Submission {item.submission_id} · Offer {item.offer_id || "—"} · Invoice {item.invoice_id || "—"} · {formatPaymentDate(item.created_at)}</p></li>)}</ul>
              : <p className="text-sm text-muted-foreground">No historical exceptions.</p>}
      </CardContent></Card>

      {selected && <Dialog open onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Review {selected.invoice_number}</DialogTitle></DialogHeader>
          {detailQuery.isLoading ? <div className="h-16 animate-pulse rounded bg-muted" />
            : detailQuery.isError ? <div role="alert" className="space-y-3 text-sm text-rose-700"><p>{isForbidden(detailQuery.error) ? "Access denied: only database-confirmed Super Admins may view payment details." : "Invoice details unavailable."}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => detailQuery.refetch()}>Retry</Button><Button size="sm" variant="outline" onClick={() => setSelected(null)}>Close</Button></div></div>
              : detailQuery.data && <div className="space-y-4">
                <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between gap-2"><strong>{detailQuery.data.invoice.fee_description}</strong><HiringInvoiceStatus status={detailQuery.data.invoice.status} /></div>
                  <p className="mt-1">{formatPaymentAmount(detailQuery.data.invoice.amount, detailQuery.data.invoice.currency)} · {detailQuery.data.invoice.job_title || "Job"} · {detailQuery.data.invoice.talent_name || "Talent"}</p>
                  <p className="mt-1">Invoice amount due: {formatPaymentAmount(detailQuery.data.invoice.amount, detailQuery.data.invoice.currency)}</p>
                  <p>Invoice recipient: {detailQuery.data.invoice.payment_recipient}</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detailQuery.data.invoice.payment_instructions}</p>
                  <p className="mt-2">Client-submitted reference (unverified evidence): {detailQuery.data.invoice.payment_reference || "None"}</p>
                  {detailQuery.data.invoice.verified_at && <div className="mt-3 border-t pt-2"><p className="font-semibold text-emerald-800">Verified payment details</p><p>Verifier: {detailQuery.data.invoice.verified_by || "Authorized reviewer"} · {formatPaymentDate(detailQuery.data.invoice.verified_at)}</p><p>Verified amount/currency: {detailQuery.data.invoice.verified_amount || "—"} {detailQuery.data.invoice.verified_currency || ""}</p><p>Verified reference: {detailQuery.data.invoice.verified_reference || "—"}</p><p>Verified recipient: {detailQuery.data.invoice.verified_recipient || "—"}</p></div>}
                </div>
                {detailQuery.data.history?.length > 0 && <div><h3 className="font-semibold">Immutable status history</h3><ul className="mt-2 space-y-2 text-sm">{detailQuery.data.history.map((entry: HiringInvoiceHistory) => <li key={entry.id} className="rounded border p-2"><strong>{entry.event.replaceAll("_", " ")}</strong>{(entry.previous_status || entry.new_status) && <span> · {statusLabel[entry.previous_status || ""] || entry.previous_status || "—"} → {statusLabel[entry.new_status || ""] || entry.new_status || "—"}</span>}<span className="text-muted-foreground"> · {formatPaymentDate(entry.created_at)}{entry.actor_id ? ` · Actor ${entry.actor_id}` : ""}</span>{entry.details?.reason && <p className="text-muted-foreground">Reason: {entry.details.reason}</p>}</li>)}</ul></div>}
                 {detailQuery.data.invoice.status === "verification_pending" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Receipt pending independent verification</p><p className="mt-1">This proof is not payment confirmation. Complete verification in the unified payment queue.</p><Button asChild size="sm" variant="outline" className="mt-3"><Link href="/admin/ledger#manual-wise-admin">Review receipt in Payment Verifications</Link></Button></div>}
                 {detailQuery.data.invoice.status === "paid" && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{detailQuery.data.invoice.verified_at ? "Payment independently verified. The invoice is paid." : "This invoice is recorded as paid."}</p>}
                 <div className="space-y-3 border-t pt-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">Review action<select className="h-10 w-full rounded-md border bg-background px-3" value={action} onChange={(event) => setAction(event.target.value)}><option value="">No permitted action</option>{allowedActions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                    <label className="space-y-1 text-sm">Required reason<textarea className="min-h-10 w-full rounded-md border bg-background px-3 py-2" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
                  </div>
                   <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={submitReview.isPending || !action || !reason.trim()} onClick={() => submitReview.mutate()}>{submitReview.isPending ? "Recording…" : action ? `Record ${action}` : "Choose an action"}</Button></div>
                </div>
              </div>}
        </DialogContent>
      </Dialog>}
    </section>
  );
}
