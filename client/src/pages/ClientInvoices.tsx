import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: string;
  currency: string;
  status: string;
  payment_method: string | null;
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  external_ref: string | null;
  period_start: string;
  period_end: string;
  engagement_type: string;
  talent_name: string | null;
  client_invoice_amount: string;
}

interface InvoiceListResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
  items: Invoice[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: React.ReactNode }> = {
  draft:   { label: "Draft",   variant: "secondary",    icon: <Clock className="w-3 h-3" /> },
  sent:    { label: "Sent",    variant: "default",      icon: <ReceiptText className="w-3 h-3" /> },
  overdue: { label: "Overdue", variant: "destructive",  icon: <AlertCircle className="w-3 h-3" /> },
  paid:    { label: "Paid",    variant: "default",      icon: <CheckCircle2 className="w-3 h-3" /> },
  void:    { label: "Void",    variant: "outline",      icon: <XCircle className="w-3 h-3" /> },
};

function statusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "secondary", icon: null };
  const colorClass =
    status === "paid"    ? "bg-green-100 text-green-800 border-green-200" :
    status === "overdue" ? "bg-red-100 text-red-800 border-red-200" :
    status === "sent"    ? "bg-blue-100 text-blue-800 border-blue-200" :
    status === "void"    ? "bg-gray-100 text-gray-500 border-gray-200" :
                           "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatAmount(amount: string | number, currency: string) {
  const symbol = currency === "PHP" ? "₱" : currency === "USD" ? "$" : currency + " ";
  return `${symbol}${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const e = new Date(end).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

export default function ClientInvoices() {
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading, isError } = useQuery<InvoiceListResponse>({
    queryKey: ["/api/client/invoices", page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/client/invoices?page=${page}&limit=${LIMIT}`);
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json();
    },
    staleTime: 30_000,
  });

  const totalPaid = data?.items
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0) ?? 0;

  const totalOutstanding = data?.items
    .filter((i) => ["sent", "overdue"].includes(i.status))
    .reduce((sum, i) => sum + Number(i.amount), 0) ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Billing statements for your contracted talent engagements.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid (this page)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? "—" : formatAmount(totalPaid, "PHP")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding (this page)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {isLoading ? "—" : formatAmount(totalOutstanding, "PHP")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 text-red-400" />
              <p>Unable to load invoices. Please try again.</p>
            </div>
          ) : !data?.items.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No invoices yet</p>
              <p className="text-sm mt-1">Invoices will appear here once billing periods are closed by OnSpot.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Talent</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{inv.talent_name ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatPeriod(inv.period_start, inv.period_end)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {inv.engagement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatAmount(inv.amount, inv.currency)}
                    </TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(inv.due_date)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {inv.paid_at ? (
                        <span className="text-green-600">{formatDate(inv.paid_at)}</span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="px-2">Page {page} of {data.pages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
