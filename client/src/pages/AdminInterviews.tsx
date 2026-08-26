/**
 * AdminInterviews — cross-client interview calendar for admins.
 * Shows all interviews with filters for status, job, and date range.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar, Clock, CheckCircle2, XCircle, Loader2,
  Video, Filter, AlertCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInterviewTime } from "@/lib/formatInterviewTime";

interface InterviewRow {
  id: number;
  submission_id: number;
  round_number: number;
  interview_type: string;
  status: string;
  confirmed_time: string | null;
  confirmed_time_zone: string | null;
  duration_minutes: number | null;
  proposed_times: any[];
  candidate_notes: string | null;
  internal_notes: string | null;
  meeting_link: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  created_at: string;
  job_title?: string;
  job_company?: string;
  job_id?: string;
  client_id?: string;
  talent_id?: string;
  talent_full_name?: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  proposed:    { label: "Proposed",         color: "bg-yellow-100 text-yellow-800" },
  confirmed:   { label: "Confirmed",        color: "bg-green-100 text-green-800" },
  rescheduled: { label: "Rescheduled",      color: "bg-blue-100 text-blue-800" },
  cancelled:   { label: "Cancelled",        color: "bg-red-100 text-red-800" },
  completed:   { label: "Completed",        color: "bg-slate-100 text-slate-700" },
};

function InterviewCard({ interview }: { interview: InterviewRow }) {
  const badge = STATUS_BADGE[interview.status] ?? { label: interview.status, color: "bg-slate-100 text-slate-700" };
  const confirmedTime = interview.confirmed_time
    ? formatInterviewTime(interview.confirmed_time, interview.confirmed_time_zone ?? "UTC")
    : null;
  const talentName = interview.talent_full_name ?? "Talent";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {talentName}
            <span className="ml-1 font-normal text-slate-500">for {interview.job_title ?? "Position"}</span>
            {interview.job_company && <span className="ml-1 font-normal text-slate-400">· {interview.job_company}</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 capitalize">
            Round {interview.round_number} · {interview.interview_type.replace(/_/g, " ")} interview
            {interview.duration_minutes ? ` · ${interview.duration_minutes} min` : ""}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {confirmedTime && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <Clock className="h-4 w-4 shrink-0 text-[#474ead]" />
          <span>{confirmedTime}</span>
        </div>
      )}

      {!confirmedTime && interview.status === "proposed" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <AlertCircle className="h-4 w-4 shrink-0 text-yellow-500" />
          <span>Awaiting talent confirmation</span>
        </div>
      )}

      {interview.meeting_link && (
        <div className="mt-2">
          <a
            href={interview.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#474ead]/30 bg-[#474ead]/5 px-3 py-1.5 text-xs font-medium text-[#474ead] hover:bg-[#474ead]/10 transition"
          >
            <Video className="h-3.5 w-3.5" />
            Meeting link
          </a>
        </div>
      )}

      {interview.cancellation_reason && (
        <p className="mt-2 text-xs text-red-600">Reason: {interview.cancellation_reason}</p>
      )}

      {interview.internal_notes && (
        <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-slate-400">
          <strong className="font-semibold">Internal:</strong> {interview.internal_notes}
        </p>
      )}
    </div>
  );
}

async function fetchAdminInterviews(
  token: string | null,
  params: Record<string, string>,
): Promise<InterviewRow[]> {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  const res = await fetch(`/api/admin/interviews${qs ? `?${qs}` : ""}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function AdminInterviews() {
  const token = typeof window !== "undefined" ? localStorage.getItem("onspot_jwt_token") : null;
  const [tab, setTab] = useState("upcoming");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  const filterParams: Record<string, string> = {};
  if (statusFilter && statusFilter !== "all") filterParams.status = statusFilter;
  if (dateFrom) filterParams.dateFrom = dateFrom;
  if (dateTo) filterParams.dateTo = dateTo;

  const { data, isLoading, isError, refetch } = useQuery<InterviewRow[]>({
    queryKey: ["/api/admin/interviews", filterParams],
    queryFn: () => fetchAdminInterviews(token, filterParams),
  });

  const now = new Date();

  const upcoming = (data ?? []).filter((i) => {
    if (i.status === "cancelled" || i.status === "completed") return false;
    if (i.confirmed_time) return new Date(i.confirmed_time) >= now;
    return true;
  });

  const past = (data ?? []).filter((i) => {
    if (i.status === "cancelled" || i.status === "completed") return true;
    if (i.confirmed_time) return new Date(i.confirmed_time) < now;
    return false;
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-[#474ead]" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Interview Calendar</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="proposed">Proposed</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-8 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-8 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        {(statusFilter || dateFrom || dateTo) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => { setStatusFilter(""); setDateFrom(""); setDateTo(""); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading interviews…
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800">
          Failed to load interviews.{" "}
          <button type="button" className="h-auto p-0 text-sm underline hover:no-underline" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {!isLoading && !isError && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="upcoming">
              Upcoming
              {upcoming.length > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 rounded-full bg-[#474ead] px-1.5 text-white">
                  {upcoming.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">Past & cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 py-14 text-center dark:border-white/[0.08]">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No upcoming interviews</p>
                <p className="mt-1 text-xs text-slate-400">Scheduled interviews will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming
                  .slice()
                  .sort((a, b) => {
                    const ta = a.confirmed_time ? new Date(a.confirmed_time).getTime() : Number.MAX_SAFE_INTEGER;
                    const tb = b.confirmed_time ? new Date(b.confirmed_time).getTime() : Number.MAX_SAFE_INTEGER;
                    return ta - tb;
                  })
                  .map((iv) => <InterviewCard key={iv.id} interview={iv} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {past.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 py-14 text-center dark:border-white/[0.08]">
                <XCircle className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No past interviews</p>
              </div>
            ) : (
              <div className="space-y-3">
                {past
                  .slice()
                  .sort((a, b) => {
                    const ta = a.confirmed_time ? new Date(a.confirmed_time).getTime() : 0;
                    const tb = b.confirmed_time ? new Date(b.confirmed_time).getTime() : 0;
                    return tb - ta;
                  })
                  .map((iv) => <InterviewCard key={iv.id} interview={iv} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
