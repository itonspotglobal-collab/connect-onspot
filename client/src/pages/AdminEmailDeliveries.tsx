import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  SkipForward,
} from "lucide-react";

interface DeliveryRow {
  id: string;
  event_key: string;
  event_type: string;
  recipient_email: string | null;
  recipient_user_id: string | null;
  sender_email: string | null;
  template_category: string | null;
  status: string;
  error: string | null;
  attempted_at: string | null;
  sent_at: string | null;
  created_at: string | null;
}

interface DeliveryResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
  items: DeliveryRow[];
}

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
];

const EVENT_TYPE_OPTIONS = [
  { value: "all", label: "All events" },
  { value: "job_approved", label: "Job approved" },
  { value: "job_rejected", label: "Job rejected" },
  { value: "client_new_application", label: "New application" },
  { value: "interview_rescheduled_talent", label: "Interview rescheduled · Talent" },
  { value: "interview_rescheduled_client", label: "Interview rescheduled · Client" },
  { value: "interview_cancelled_talent", label: "Interview cancelled · Talent" },
  { value: "interview_cancelled_client", label: "Interview cancelled · Client" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function statusStyle(status: string) {
  if (status === "sent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "skipped") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "sent") return <CircleCheck className="h-3.5 w-3.5" />;
  if (status === "failed") return <CircleX className="h-3.5 w-3.5" />;
  if (status === "skipped") return <SkipForward className="h-3.5 w-3.5" />;
  return <Clock3 className="h-3.5 w-3.5" />;
}

export default function AdminEmailDeliveries() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [recipient, setRecipient] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, isFetching, isError, refetch } = useQuery<DeliveryResponse>({
    queryKey: ["/api/admin/email-deliveries", { page, status, eventType, recipient, dateFrom, dateTo }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (status !== "all") params.set("status", status);
      if (eventType !== "all") params.set("eventType", eventType);
      if (recipient.trim()) params.set("recipient", recipient.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      return authAPI.get(`/api/admin/email-deliveries?${params.toString()}`);
    },
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.pages ?? Math.ceil(total / PAGE_SIZE));

  const resetToFirstPage = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6" data-testid="admin-email-deliveries-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/dashboard")} className="h-auto p-1">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Email Delivery Audit</h1>
            <p className="text-sm text-muted-foreground">
              Review companion email attempts, outcomes, and delivery errors.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-email-deliveries">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Event</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={eventType}
                onChange={(event) => resetToFirstPage(setEventType, event.target.value)}
                data-testid="select-email-delivery-event"
              >
                {EVENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Status</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(event) => resetToFirstPage(setStatus, event.target.value)}
                data-testid="select-email-delivery-status"
              >
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Recipient</span>
              <Input
                className="h-9"
                placeholder="Search email"
                value={recipient}
                onChange={(event) => resetToFirstPage(setRecipient, event.target.value)}
                data-testid="input-email-delivery-recipient"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">From</span>
              <Input className="h-9" type="date" value={dateFrom} onChange={(event) => resetToFirstPage(setDateFrom, event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">To</span>
              <Input className="h-9" type="date" value={dateTo} onChange={(event) => resetToFirstPage(setDateTo, event.target.value)} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading delivery history…
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-sm text-red-600">
              Unable to load email delivery history. Try refreshing.
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No email delivery records match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Attempted</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 font-medium">Sender</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Error</th>
                    <th className="px-4 py-3 font-medium">Event key</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(row.attempted_at ?? row.created_at)}</td>
                      <td className="px-4 py-3 font-medium">{row.event_type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3">{row.recipient_email ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.sender_email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`inline-flex items-center gap-1 capitalize ${statusStyle(row.status)}`}>
                          <StatusIcon status={row.status} /> {row.status}
                        </Badge>
                      </td>
                      <td className="max-w-[240px] px-4 py-3 text-xs text-red-600" title={row.error ?? undefined}>
                        <span className="block truncate">{row.error ?? "—"}</span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3 font-mono text-[11px] text-muted-foreground" title={row.event_key}>
                        <span className="block truncate">{row.event_key}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "No records" : `Page ${page} of ${totalPages} (${total} total)`}
        </p>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}