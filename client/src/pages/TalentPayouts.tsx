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
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface Payout {
  id: string;
  amount: string;
  currency: string;
  status: string;
  payout_region: string | null;
  payout_method: string | null;
  external_ref: string | null;
  failed_reason: string | null;
  scheduled_at: string | null;
  disbursed_at: string | null;
  created_at: string;
  period_start: string;
  period_end: string;
  engagement_type: string;
  talent_rate: string;
  talent_rate_currency: string;
  client_invoice_amount: string;
  client_name: string | null;
}

interface PayoutListResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
  items: Payout[];
}

function statusBadge(status: string) {
  const cfg: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending:   { label: "Pending",   color: "bg-gray-100 text-gray-700 border-gray-200",    icon: <Clock className="w-3 h-3" /> },
    scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-800 border-blue-200",    icon: <CalendarDays className="w-3 h-3" /> },
    disbursed: { label: "Disbursed", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed:    { label: "Failed",    color: "bg-red-100 text-red-800 border-red-200",        icon: <AlertCircle className="w-3 h-3" /> },
  };
  const c = cfg[status] ?? { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function payoutMethodLabel(method: string | null) {
  if (!method) return "—";
  const labels: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    gcash: "GCash",
    wise: "Wise",
    wire: "Wire",
    paypal: "PayPal",
  };
  return labels[method] ?? method;
}

function formatAmount(amount: string | number, currency: string) {
  const symbol = currency === "PHP" ? "₱" : currency === "USD" ? "$" : `${currency} `;
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

export default function TalentPayouts() {
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading, isError } = useQuery<PayoutListResponse>({
    queryKey: ["/api/talent/payouts", page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/talent/payouts?page=${page}&limit=${LIMIT}`);
      if (!res.ok) throw new Error("Failed to load payout history");
      return res.json();
    },
    staleTime: 30_000,
  });

  const totalDisbursed = data?.items
    .filter((p) => p.status === "disbursed")
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const totalPending = data?.items
    .filter((p) => ["pending", "scheduled"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link href="/hired-talent-portal" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Earnings</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings &amp; Payouts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your payout history for completed billing periods.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disbursed (this page)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? "—" : formatAmount(totalDisbursed, "PHP")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending (this page)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? "—" : formatAmount(totalPending, "PHP")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout table */}
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
              <p>Unable to load payout history. Please try again.</p>
            </div>
          ) : !data?.items.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No payouts yet</p>
              <p className="text-sm mt-1">
                Payouts will appear here once OnSpot processes your first billing period.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead className="text-right">Your Payout</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Disbursed</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatPeriod(p.period_start, p.period_end)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {p.engagement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-green-700">
                      {formatAmount(p.amount, p.currency)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {payoutMethodLabel(p.payout_method)}
                    </TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {p.disbursed_at ? (
                        <span className="text-green-600">{formatDate(p.disbursed_at)}</span>
                      ) : p.scheduled_at ? (
                        <span className="text-blue-600">Scheduled {formatDate(p.scheduled_at)}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {p.external_ref ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Failed reason banner */}
          {data?.items.some((p) => p.status === "failed" && p.failed_reason) && (
            <div className="border-t px-4 py-3 bg-red-50 space-y-1">
              {data.items
                .filter((p) => p.status === "failed" && p.failed_reason)
                .map((p) => (
                  <p key={p.id} className="text-xs text-red-700">
                    <span className="font-medium">Payout failed ({formatPeriod(p.period_start, p.period_end)}):</span>{" "}
                    {p.failed_reason}
                  </p>
                ))}
            </div>
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
