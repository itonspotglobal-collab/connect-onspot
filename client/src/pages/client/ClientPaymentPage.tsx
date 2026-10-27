import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, ArrowLeft, CalendarDays, Check, Clock3, FileText, LockKeyhole, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";
import { ManualWisePaymentPanel, type WiseCategory, type WiseObligation } from "@/components/manual-wise/ManualWisePaymentPanel";
import { OnSpotLogo } from "@/components/OnSpotLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authAPI } from "@/lib/api";
import { Link } from "wouter";

const incomingCategories = new Set<WiseCategory>([
  "deposit",
  "monthly_invoice",
  "invoice",
  "hiring_invoice",
  "replenishment",
  "inquiry",
]);

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function money(amount: string | number, currency: string) {
  const value = Number(amount);
  if ((typeof amount === "string" && !amount.trim()) || !Number.isFinite(value)) return "Amount not finalized";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

function getDueState(obligation: WiseObligation) {
  if (obligation.paymentStatus === "paid" && !["void","refunded","invalidated"].includes(obligation.status)) {
    return { label: "Paid", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" };
  }
  if (obligation.status === "void" || obligation.status === "refunded" || obligation.status === "invalidated") {
    return { label: obligation.status.replaceAll("_", " "), className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
  }
  const dueAt = obligation.dueAt ? new Date(obligation.dueAt) : null;
  if (dueAt && !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < Date.now()) {
    return { label: "Overdue", className: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200" };
  }
  return {
    label: obligation.dueAt ? `Due ${formatDate(obligation.dueAt)}` : "Due date not specified",
    className: "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100",
  };
}

function InvoiceCard({ obligation }: { obligation: WiseObligation }) {
  const dueState = getDueState(obligation);
  const lineItems = obligation.lineItems?.length
    ? obligation.lineItems
    : [{
      name: "Invoice balance",
      description: "As recorded in your OnSpot account",
      amount: obligation.amount,
    }];

  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe2ee] bg-card shadow-[0_20px_55px_rgba(31,36,91,0.08)] dark:border-slate-700">
      <CardContent className="space-y-7 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invoice for {obligation.companyName || "Client account"}</p>
            <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="min-w-0 break-words text-[clamp(2.15rem,7vw,3.85rem)] font-semibold leading-none tracking-[-0.055em] text-[#20245f] dark:text-slate-50">
                {money(obligation.amount, obligation.currency)}
              </h1>
              <span className="text-sm font-semibold tracking-[0.12em] text-muted-foreground">{obligation.currency}</span>
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">Ref {obligation.reference}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${dueState.className}`}>
            {obligation.paymentStatus === "paid" ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            {dueState.label}
          </span>
        </div>

        <div className="h-px bg-border" />

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">Invoice</dt>
            <dd className="mt-1 break-words font-mono text-xs font-semibold text-foreground sm:text-sm">{obligation.reference || obligation.id}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">Period</dt>
            <dd className="mt-1 break-words text-xs font-medium text-foreground sm:text-sm">{obligation.period || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">Issued</dt>
            <dd className="mt-1 break-words text-xs font-medium text-foreground sm:text-sm">{formatDate(obligation.issuedAt)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">Due date</dt>
            <dd className="mt-1 break-words text-xs font-medium text-foreground sm:text-sm">{obligation.dueAt ? formatDate(obligation.dueAt) : "Due date not specified"}</dd>
          </div>
        </dl>

        <section aria-labelledby="payment-line-items-title">
          <div className="mb-3 flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-[#53599b]" />
            <h2 id="payment-line-items-title" className="text-sm font-semibold text-foreground">Line items</h2>
          </div>
          <div className="divide-y divide-border border-y">
            {lineItems.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex min-w-0 items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-foreground">{item.name}</p>
                  {item.description && <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
                </div>
                <p className="shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-foreground">{money(item.amount, obligation.currency)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between gap-3 pt-4">
            <p className="text-sm font-semibold text-foreground">Total due</p>
            <p className="text-lg font-bold tabular-nums text-[#20245f] dark:text-slate-50">{money(obligation.amount, obligation.currency)}</p>
          </div>
        </section>

        <p className="border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          Billing questions? Reply to your invoice email or contact <a href="mailto:hello@onspotglobal.com" className="font-medium text-[#454b8a] underline underline-offset-2 dark:text-indigo-300">hello@onspotglobal.com</a>.
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingInvoice() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
      <Card className="rounded-2xl"><CardContent className="space-y-5 p-6"><Skeleton className="h-4 w-40" /><Skeleton className="h-14 w-3/4" /><Skeleton className="h-28 w-full" /><Skeleton className="h-40 w-full" /></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="space-y-4 p-6"><Skeleton className="h-5 w-36" /><Skeleton className="mx-auto aspect-square w-64 max-w-full" /><Skeleton className="h-11 w-full" /></CardContent></Card>
    </div>
  );
}

export default function ClientPaymentPage() {
  const { category: rawCategory, id = "" } = useParams<{ category: string; id: string }>();
  const category = rawCategory as WiseCategory;
  const isSupportedCategory = incomingCategories.has(category);
  const query = useQuery<WiseObligation>({
    queryKey: ["/api/manual-wise/obligations", category, id],
    queryFn: () => authAPI.get(`/api/manual-wise/obligations/${encodeURIComponent(category)}/${encodeURIComponent(id)}`),
    enabled: isSupportedCategory && Boolean(id),
    retry: false,
  });

  return (
    <div className="min-h-[100dvh] min-w-0 bg-[#f2f3f9] text-foreground dark:bg-[#11142c]">
      <header className="bg-gradient-to-r from-[#20245f] via-[#25296c] to-[#171a4d] text-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" aria-label="OnSpot home" className="inline-flex min-h-11 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
            <OnSpotLogo size="sm" className="brightness-0 invert" />
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold tracking-wide text-white/95">
            <LockKeyhole className="h-4 w-4" />
            Secure checkout
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6 sm:py-9">
        <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 text-[#53599b]" />
          <span>OnSpot billing</span>
        </div>
        {!isSupportedCategory ? (
          <Card className="mx-auto max-w-xl rounded-2xl">
            <CardContent className="space-y-4 p-6 text-center">
              <AlertCircle className="mx-auto h-9 w-9 text-rose-600" />
              <h1 className="text-lg font-semibold">Payment record unavailable</h1>
              <p className="text-sm text-muted-foreground">This payment category is not available through client checkout.</p>
              <Button asChild variant="outline"><Link href="/client/billing"><ArrowLeft className="mr-2 h-4 w-4" />Return to billing</Link></Button>
            </CardContent>
          </Card>
        ) : query.isLoading || !query.data && !query.isError ? (
          <LoadingInvoice />
        ) : query.isError || !query.data ? (
          <Card className="mx-auto max-w-xl rounded-2xl border-rose-200 dark:border-rose-900">
            <CardContent className="space-y-4 p-6 text-center">
              <ShieldCheck className="mx-auto h-9 w-9 text-[#53599b]" />
              <h1 className="text-lg font-semibold">We couldn’t open this payment</h1>
              <p className="text-sm text-muted-foreground">Payment details are private to the authorized client account. Check that you’re signed in to the right workspace, or try again.</p>
              <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid min-w-0 gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <InvoiceCard obligation={query.data} />
            <ManualWisePaymentPanel category={category} id={id} showHeading={false} checkout />
          </div>
        )}
        <p className="mx-auto mt-6 flex max-w-4xl items-center justify-center gap-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          A receipt is evidence for review, not confirmation that funds settled.
        </p>
      </main>
    </div>
  );
}
