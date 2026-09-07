import { Calendar, Clock, ExternalLink, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInterviewTime } from "@/lib/formatInterviewTime";

export interface InterviewDetails {
  jobTitle: string;
  participantLabel: string;
  participantName: string | null;
  interviewType: string;
  roundNumber: number;
  status: string;
  confirmedTime: string | null;
  confirmedTimeZone: string | null;
  durationMinutes: number | null;
  meetingLink: string | null;
}

function displayInterviewType(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeMeetingLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-white/[0.08]">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

export function InterviewDetailsDialog({
  open,
  onOpenChange,
  interview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: InterviewDetails | null;
}) {
  if (!interview) return null;

  const meetingLink = safeMeetingLink(interview.meetingLink);
  const timezone = interview.confirmedTimeZone || "UTC";
  const schedule = interview.confirmedTime
    ? formatInterviewTime(interview.confirmedTime, timezone)
    : "Not confirmed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Interview Details</DialogTitle>
          <DialogDescription>
            Review the confirmed schedule and meeting information.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <dl>
            <DetailRow label="Job" value={interview.jobTitle} />
            {interview.participantName && (
              <DetailRow label={interview.participantLabel} value={interview.participantName} />
            )}
            <DetailRow label="Interview type" value={displayInterviewType(interview.interviewType)} />
            <DetailRow label="Round" value={`Round ${interview.roundNumber}`} />
            <DetailRow label="Status" value={displayInterviewType(interview.status)} />
            <DetailRow label="Date and time" value={schedule} />
            <DetailRow label="Timezone" value={timezone} />
            <DetailRow
              label="Duration"
              value={interview.durationMinutes ? `${interview.durationMinutes} minutes` : "Not specified"}
            />
          </dl>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-800/40 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Video className="h-4 w-4 text-indigo-600" />
            Meeting
          </div>
          {meetingLink ? (
            <Button className="mt-3" asChild>
              <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Join Meeting
              </a>
            </Button>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Meeting link not available yet</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="h-3.5 w-3.5" />
          <Clock className="h-3.5 w-3.5" />
          Times are shown in the confirmed interview timezone.
        </div>
      </DialogContent>
    </Dialog>
  );
}