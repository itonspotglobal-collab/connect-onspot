import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, CircleDollarSign, Clock3, FileText, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authAPI } from "@/lib/api";

type Payout = {
  id: string;
  amount: string | number;
  currency: string;
  status: "pending" | "scheduled" | "disbursed" | "failed" | string;
  scheduledAt: string | null;
  disbursedAt: string | null;
  createdAt: string | null;
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  disbursed: "Disbursed",
  failed: "Failed",
};

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  scheduled: "secondary",
  disbursed: "default",
  failed: "destructive",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatAmount(payout: Pick<Payout, "amount" | "currency">) {
  const amount = Number(payout.amount);
  return `${payout.currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) : payout.amount}`;
}

function PayoutStatus({ status }: { status: string }) {
  return (
    <Badge variant={statusVariants[status] ?? "outline"} data-testid={`badge-payout-status-${status}`}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

export default function Payouts() {
  const { data: payouts = [], isLoading, isError, refetch } = useQuery<Payout[]>({
    queryKey: ["/api/talent/payouts"],
    queryFn: () => authAPI.get("/api/talent/payouts"),
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Talent account</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Payout history</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              See when your earnings are scheduled and when each payout is disbursed.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-payouts">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-3" data-testid="payouts-loading">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
          </div>
        ) : isError ? (
          <Card className="mt-8" data-testid="payouts-error">
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Payout history could not be loaded.</p>
              <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            </CardContent>
          </Card>
        ) : payouts.length === 0 ? (
          <Card className="mt-8 border-dashed" data-testid="payouts-empty">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <CircleDollarSign className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No payouts yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Your payout records will appear here once a billing period has been processed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Your payouts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="payout-table">
                  <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Payout</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Scheduled</th>
                      <th className="px-6 py-3 font-medium">Disbursed</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`payout-row-${payout.id}`}>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-2 font-medium">
                            {payout.status === "disbursed"
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              : payout.status === "failed"
                                ? <XCircle className="h-4 w-4 text-destructive" />
                                : <Clock3 className="h-4 w-4 text-muted-foreground" />}
                            <span className="font-mono text-xs text-muted-foreground">{payout.id.slice(0, 8)}</span>
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">Recorded {formatDate(payout.createdAt)}</p>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-base font-semibold">{formatAmount(payout)}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" /> {formatDate(payout.scheduledAt)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">{formatDate(payout.disbursedAt)}</td>
                        <td className="px-6 py-4"><PayoutStatus status={payout.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}