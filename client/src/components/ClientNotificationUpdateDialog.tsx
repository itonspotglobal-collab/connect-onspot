import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInterviewTime } from "@/lib/formatInterviewTime";
import {
  currentInterviewSchedule,
  type ClientNotificationModalKind,
} from "@/lib/notificationRouting";

interface InterviewSlot {
  start: string;
  timezone?: string | null;
}

interface InterviewProposal {
  id: string;
  proposerRole: string;
  action: string;
  proposedTimes: InterviewSlot[];
  selectedTime: string | null;
  selectedTimeZone: string | null;
  createdAt: string;
}

interface NotificationUpdate {
  notificationType: string;
  submissionId: string;
  talentName: string;
  jobTitle: string;
  invitationStatus: string;
  interview: {
    id: string;
    status: string;
    currentProposalOwner: string | null;
    proposedTimes: InterviewSlot[];
    confirmedTime: string | null;
    confirmedTimeZone: string | null;
    proposals: InterviewProposal[];
  } | null;
}

interface ClientNotificationUpdateDialogProps {
  open: boolean;
  kind: ClientNotificationModalKind;
  notificationId: string | null;
  onClose: () => void;
}

function bearerHeaders(): Record<string, string> {
  const token = localStorage.getItem("onspot_jwt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function interviewStatusLabel(interview: NotificationUpdate["interview"]): string {
  if (!interview) return "Not scheduled";
  if (interview.status === "confirmed") return "Confirmed";
  if (interview.status === "cancelled") return "Cancelled";
  if (interview.currentProposalOwner === "client") return "Awaiting your response";
  if (interview.currentProposalOwner === "talent") return "Awaiting Talent response";
  return interview.status === "rescheduled" ? "New time proposed" : "Awaiting response";
}

function formatSlot(slot: InterviewSlot | null): string | null {
  if (!slot?.start) return null;
  return formatInterviewTime(slot.start, slot.timezone || "UTC");
}

export function ClientNotificationUpdateDialog({
  open,
  kind,
  notificationId,
  onClose,
}: ClientNotificationUpdateDialogProps) {
  const [, navigate] = useLocation();
  const [data, setData] = useState<NotificationUpdate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !notificationId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/client/notification-details/${encodeURIComponent(notificationId)}`, {
      headers: bearerHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Unable to load this update");
        return body as NotificationUpdate;
      })
      .then(setData)
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message || "Unable to load this update");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [notificationId, open]);

  const schedule = useMemo(() => {
    const interview = data?.interview;
    if (!interview) return { current: null, previous: null, prefix: "" };
    if (interview.confirmedTime) {
      return {
        current: formatInterviewTime(
          interview.confirmedTime,
          interview.confirmedTimeZone || "UTC",
        ),
        previous: null,
        prefix: "Confirmed",
      };
    }

    const currentSchedule = currentInterviewSchedule(interview);
    return {
      current: formatSlot(currentSchedule.current),
      previous: formatSlot(currentSchedule.previous),
      prefix: currentSchedule.prefix,
    };
  }, [data]);

  function goTo(path: string) {
    onClose();
    navigate(path);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === "invitation_acceptance"
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              : <CalendarClock className="h-5 w-5 text-amber-600" />}
            Invitation &amp; Interview Update
          </DialogTitle>
          <DialogDescription>
            {kind === "invitation_acceptance"
              ? "Talent accepted your invitation"
              : "Interview schedule update"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the latest details…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Talent</dt>
                <dd className="mt-1 font-semibold text-slate-900">{data.talentName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</dt>
                <dd className="mt-1 font-semibold text-slate-900">{data.jobTitle}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Invitation</dt>
                <dd className="mt-1 font-semibold text-emerald-700">{data.invitationStatus}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Interview</dt>
                <dd className="mt-1 font-semibold text-slate-900">{interviewStatusLabel(data.interview)}</dd>
              </div>
            </dl>

            {data.interview ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                {schedule.previous && kind === "interview_reschedule" && (
                  <p className="text-xs text-slate-500">Previous schedule: {schedule.previous}</p>
                )}
                <p className="mt-1 text-sm font-semibold text-indigo-950">
                  {schedule.current
                    ? `${schedule.prefix}: ${schedule.current}`
                    : data.interview.currentProposalOwner === "talent"
                      ? "Awaiting Talent response"
                      : "No interview time selected yet"}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                No interview scheduled yet.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => goTo("/client-profile")}>
            View Application
          </Button>
          {data?.interview && (
            <Button onClick={() => goTo("/client/interviews")}>
              Review Interview
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}