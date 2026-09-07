/**
 * ClientInterviews — calendar-wide interview listing for logged-in clients.
 * Shows upcoming and past interviews across all their submissions.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Video, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import { useToast } from "@/hooks/use-toast";
import { convertLocalDateTimeToUtc, formatInterviewTime } from "@/lib/formatInterviewTime";
import { getClientInterviewDisplayState } from "@/lib/clientInterviewState";

interface InterviewRow {
  id: string;
  submission_id: string;
  round_number: number;
  interview_type: string;
  status: string;
  confirmed_time: string | null;
  confirmed_time_zone: string | null;
  duration_minutes: number | null;
  proposed_times: any[];
  candidate_notes: string | null;
  meeting_link: string | null;
  current_proposal_owner: string | null;
  created_at: string;
  // joined fields
  job_title?: string;
  job_company?: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  awaiting_talent: { label: "Awaiting Talent", color: "bg-yellow-100 text-yellow-800" },
  action_required: { label: "Action Required", color: "bg-orange-100 text-orange-800" },
  confirmed:  { label: "Confirmed",         color: "bg-green-100 text-green-800" },
  rescheduled:{ label: "Rescheduled",       color: "bg-blue-100 text-blue-800" },
  cancelled:  { label: "Cancelled",         color: "bg-red-100 text-red-800" },
  completed:  { label: "Completed",         color: "bg-slate-100 text-slate-700" },
};

function InterviewCard({
  interview,
  busy,
  onUpdate,
}: {
  interview: InterviewRow;
  busy: boolean;
  onUpdate: (interviewId: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const { toast } = useToast();
  const state = getClientInterviewDisplayState(interview);
  const badge = STATUS_BADGE[state] ?? { label: interview.status, color: "bg-slate-100 text-slate-700" };
  const confirmedTime = interview.confirmed_time
    ? formatInterviewTime(interview.confirmed_time, interview.confirmed_time_zone ?? "UTC")
    : null;
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterDateTime, setCounterDateTime] = useState("");
  const [counterTimezone, setCounterTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const latestSlots = Array.isArray(interview.proposed_times) ? interview.proposed_times : [];

  const submitCounter = async () => {
    try {
      const start = convertLocalDateTimeToUtc(counterDateTime, counterTimezone);
      const updated = await onUpdate(interview.id, {
        proposedTimes: [{ start, timezone: counterTimezone }],
      });
      if (updated) {
        setCounterOpen(false);
        setCounterDateTime("");
      }
    } catch (error: any) {
      toast({
        title: "Choose a valid interview time",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {interview.job_title ?? "Position"}
            {interview.job_company && <span className="ml-1 font-normal text-slate-500"> · {interview.job_company}</span>}
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

      {!confirmedTime && state === "awaiting_talent" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <AlertCircle className="h-4 w-4 shrink-0 text-yellow-500" />
          <span>Waiting for talent to confirm a time</span>
        </div>
      )}

      {!confirmedTime && state === "action_required" && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Talent proposed a new interview time</span>
          </div>
          <div className="mt-2 space-y-2">
            {latestSlots.map((slot) => (
              <div key={slot.start} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2">
                <span className="text-sm font-semibold text-slate-800">
                  {formatInterviewTime(slot.start, slot.timezone ?? "UTC")}
                </span>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onUpdate(interview.id, {
                    status: "confirmed",
                    confirmedTime: slot.start,
                  })}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept Time"}
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setCounterOpen(true)}
          >
            Suggest Another Time
          </Button>
        </div>
      )}

      {interview.meeting_link && state === "confirmed" && (
        <div className="mt-2">
          <a
            href={interview.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#474ead]/30 bg-[#474ead]/5 px-3 py-1.5 text-xs font-medium text-[#474ead] hover:bg-[#474ead]/10 transition"
          >
            <Video className="h-3.5 w-3.5" />
            Join meeting
          </a>
        </div>
      )}

      {interview.candidate_notes && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{interview.candidate_notes}</p>
      )}

      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest another time</DialogTitle>
            <DialogDescription>
              Talent will need to explicitly accept this new time before the interview is confirmed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`counter-time-${interview.id}`}>Date and time</Label>
              <Input
                id={`counter-time-${interview.id}`}
                type="datetime-local"
                value={counterDateTime}
                onChange={(event) => setCounterDateTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <TimezoneSelect value={counterTimezone} onChange={setCounterTimezone} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterOpen(false)}>Cancel</Button>
            <Button disabled={!counterDateTime || busy} onClick={submitCounter}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send New Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function fetchClientInterviews(token: string | null): Promise<InterviewRow[]> {
  const res = await fetch("/api/client/interviews", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function ClientInterviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const token = typeof window !== "undefined" ? localStorage.getItem("onspot_jwt_token") : null;
  const [tab, setTab] = useState("upcoming");

  const { data, isLoading, isError, refetch } = useQuery<InterviewRow[]>({
    queryKey: ["/api/client/interviews"],
    queryFn: () => fetchClientInterviews(token),
    enabled: !!user,
  });
  const [busyInterviewId, setBusyInterviewId] = useState<string | null>(null);

  const updateInterview = async (interviewId: string, payload: Record<string, unknown>) => {
    setBusyInterviewId(interviewId);
    try {
      const response = await fetch(`/api/client/interviews/${interviewId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.error === "interview_proposal_stale") {
          await refetch();
          throw new Error("The interview proposal changed. Please review the latest proposed time.");
        }
        throw new Error(body.message || body.error || "Could not update the interview");
      }
      await refetch();
      toast({
        title: payload.status === "confirmed" ? "Interview confirmed" : "New time proposed",
        description: payload.status === "confirmed"
          ? "The agreed interview time is now confirmed."
          : "Talent has been asked to review your new proposed time.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Could not update interview",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBusyInterviewId(null);
    }
  };

  const now = new Date();

  const upcoming = (data ?? []).filter((i) => {
    if (i.status === "cancelled" || i.status === "completed") return false;
    if (i.confirmed_time) return new Date(i.confirmed_time) >= now;
    return true; // proposed/rescheduled without a time → show as upcoming
  });

  const past = (data ?? []).filter((i) => {
    if (i.status === "cancelled" || i.status === "completed") return true;
    if (i.confirmed_time) return new Date(i.confirmed_time) < now;
    return false;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-[#474ead]" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Interviews</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          All interviews across your active applications.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading interviews…
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800">
          Failed to load your interviews. Please try refreshing.
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
                <p className="mt-1 text-xs text-slate-400">Interviews you schedule will appear here.</p>
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
                  .map((iv) => (
                    <InterviewCard
                      key={iv.id}
                      interview={iv}
                      busy={busyInterviewId === iv.id}
                      onUpdate={updateInterview}
                    />
                  ))}
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
                  .map((iv) => (
                    <InterviewCard
                      key={iv.id}
                      interview={iv}
                      busy={busyInterviewId === iv.id}
                      onUpdate={updateInterview}
                    />
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
