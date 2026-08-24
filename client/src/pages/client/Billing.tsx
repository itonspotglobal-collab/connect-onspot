import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Loader2,
  Printer,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { authAPI } from "@/lib/api";

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  amount: string | number;
  currency: string;
  status: string;
  paymentMethod: "wire" | "credit_card" | null;
  paymentInstructions: string | null;
  cardPaymentUrl: string | null;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  jobTitle: string | null;
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "outline",
};

function InvoiceStatus({ status }: { status: string }) {
  return (
    <Badge variant={statusVariants[status] ?? "outline"} data-testid={`badge-invoice-status-${status}`}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatAmount(invoice: Pick<Invoice, "amount" | "currency">) {
  const amount = Number(invoice.amount);
  return `${invoice.currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) : invoice.amount}`;
}

function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const paymentLabel = invoice.paymentMethod === "credit_card"
    ? "Credit card"
    : invoice.paymentMethod === "wire"
      ? "Wire transfer"
      : "Payment method to be confirmed";

  return (
    <Card className="print:shadow-none print:border-0" data-testid="invoice-document">
      <CardHeader className="space-y-4 border-b print:px-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Receipt className="h-5 w-5" />
              <span className="font-semibold tracking-wide">OnSpot</span>
            </div>
            <CardTitle className="text-2xl">Invoice</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoice.invoiceNumber || "Invoice number pending"}
            </p>
          </div>
          <InvoiceStatus status={invoice.status} />
        </div>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Issued</p>
            <p className="font-medium">{formatDate(invoice.issuedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due</p>
            <p className="font-medium">{formatDate(invoice.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Billing period</p>
            <p className="font-medium">
              {invoice.periodStart && invoice.periodEnd
                ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                : "—"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 print:px-0">
        <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 p-4">
          <div>
            <p className="text-sm text-muted-foreground">Services</p>
            <p className="font-medium">{invoice.jobTitle || "OnSpot staffing services"}</p>
          </div>
          <p className="text-right text-xl font-semibold">{formatAmount(invoice)}</p>
        </div>

        {invoice.status === "paid" && invoice.paidAt && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Paid on {formatDate(invoice.paidAt)}
          </p>
        )}

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 font-medium">
            {invoice.paymentMethod === "credit_card" ? (
              <CreditCard className="h-4 w-4 text-primary" />
            ) : (
              <Landmark className="h-4 w-4 text-primary" />
            )}
            Payment details
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{paymentLabel}</p>
          {invoice.paymentMethod === "credit_card" && invoice.cardPaymentUrl ? (
            <a
              className="mt-3 inline-flex text-sm font-medium text-primary underline underline-offset-4"
              href={invoice.cardPaymentUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open secure card payment link
            </a>
          ) : invoice.paymentInstructions ? (
            <p className="mt-3 whitespace-pre-wrap text-sm">{invoice.paymentInstructions}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Payment instructions will appear here once they are available.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceDetail({ invoiceId, onBack }: { invoiceId: string; onBack: () => void }) {
  const { data: invoice, isLoading, isError, refetch } = useQuery<Invoice>({
    queryKey: ["/api/client/invoices", invoiceId],
    queryFn: () => authAPI.get(`/api/client/invoices/${invoiceId}`),
  });

  if (isLoading) {
    return <Skeleton className="h-[520px] w-full" data-testid="invoice-detail-loading" />;
  }

  if (isError || !invoice) {
    return (
      <Card data-testid="invoice-detail-error">
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Invoice unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn&apos;t load this invoice. It may not belong to your account.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
            <Button variant="ghost" onClick={onBack}>Back to billing</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-to-billing">
          <ArrowLeft className="mr-2 h-4 w-4" /> Billing
        </Button>
        <Button variant="outline" onClick={() => window.print()} data-testid="button-print-invoice">
          <Printer className="mr-2 h-4 w-4" /> Print / save invoice
        </Button>
      </div>
      <InvoiceDocument invoice={invoice} />
      <p className="text-center text-xs text-muted-foreground print:hidden">
        Use your browser&apos;s print dialog to print or save this invoice as a PDF.
      </p>
    </div>
  );
}

export default function Billing() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/client/billing/invoices/:id");
  const invoiceId = params?.id;
  const { data: invoices = [], isLoading, isError, refetch } = useQuery<Invoice[]>({
    queryKey: ["/api/client/invoices"],
    queryFn: () => authAPI.get("/api/client/invoices"),
    enabled: !invoiceId,
  });

  if (invoiceId) {
    return <InvoiceDetail invoiceId={invoiceId} onBack={() => navigate("/client/billing")} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Client billing</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Review your OnSpot billing history, due dates, and payment instructions.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-invoices">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="invoices-loading">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
        </div>
      ) : isError ? (
        <Card data-testid="invoices-error">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Invoices could not be loaded.</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card className="border-dashed" data-testid="invoices-empty">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No invoices yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Your invoices will appear here when billing activity is recorded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoice history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="invoice-table">
                <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Invoice</th>
                    <th className="px-6 py-3 font-medium">Billing period</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Due</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`invoice-row-${invoice.id}`}>
                      <td className="px-6 py-4 font-medium">
                        {invoice.invoiceNumber || "Invoice number pending"}
                        {invoice.jobTitle && <p className="mt-1 text-xs font-normal text-muted-foreground">{invoice.jobTitle}</p>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {invoice.periodStart && invoice.periodEnd
                            ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                            : "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-medium">{formatAmount(invoice)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">{formatDate(invoice.dueDate)}</td>
                      <td className="px-6 py-4"><InvoiceStatus status={invoice.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/client/billing/invoices/${invoice.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-view-invoice-${invoice.id}`}>
                            View <Download className="ml-2 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      <Separator />
      <p className="text-xs text-muted-foreground">
        Invoice amounts include the agreed OnSpot service total. Internal pricing details are not itemized.
      </p>
    </div>
  );
}