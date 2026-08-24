import { useEffect, useState, type ReactNode } from "react";
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Info,
  UserRound,
} from "lucide-react";

import { submissionStatusLabel } from "@shared/submissionStatuses";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ACTIVE_INTERVIEW_STATUSES = new Set([
  "under_review",
  "reviewed",
  "shortlisted",
]);

const TERMINAL_INTERVIEW_STATUSES = new Set([
  "withdrawn",
  "rejected",
  "hired",
  "declined",
  "offer_declined",
]);

export function canScheduleInterview(status: string): boolean {
  return ACTIVE_INTERVIEW_STATUSES.has(status) || status === "interviewing";
}

export function canRequestInterview(status: string): boolean {
  return ACTIVE_INTERVIEW_STATUSES.has(status);
}

interface InterviewContext {
  applicantName: string;
  position: string;
  company?: string | null;
  currentStatus: string;
}

interface InterviewSectionProps extends InterviewContext {
  role: "admin" | "client";
  hasInterview?: boolean;
  onAction?: () => void;
  actionDisabled?: boolean;
  children?: ReactNode;
}

/**
 * The permanent interview section shell. Real timeline/appointment content can
 * be passed as children later without changing the surrounding application
 * details layout.
 */
export function InterviewSection({
  role,
  currentStatus,
  hasInterview = false,
  onAction,
  actionDisabled = false,
  children,
}: InterviewSectionProps) {
  const eligible = role === "admin"
    ? canScheduleInterview(currentStatus)
    : canRequestInterview(currentStatus);
  const isInterviewing = currentStatus === "interviewing";
  const isTerminal = TERMINAL_INTERVIEW_STATUSES.has(currentStatus);
  const actionLabel = role === "admin"
    ? isInterviewing ? "View Interview" : "Schedule Interview"
    : "Request Interview";

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-white/[0.06]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#474ead]/10">
            <CalendarClock className="h-4.5 w-4.5 text-[#474ead]" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Interviews</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {role === "admin"
                ? "Coordinate the next step with this applicant."
                : "Keep interview planning separate from application status."}
            </p>
          </div>
        </div>
        {isInterviewing && (
          <Badge className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50 dark:border-orange-800/40 dark:bg-orange-900/20 dark:text-orange-300">
            Interviewing
          </Badge>
        )}
      </div>

      {children ?? (
        <div className="px-4 py-4">
          {isInterviewing ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50/60 px-3.5 py-3 dark:border-orange-800/40 dark:bg-orange-900/10">
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                No interview details available yet.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-orange-800/80 dark:text-orange-300/80">
                This application is in the Interviewing stage. Interview details will appear here when the interview record is connected.
              </p>
            </div>
          ) : isTerminal ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Interview actions are unavailable for this application.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No interview scheduled yet.
              </p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {role === "admin"
                  ? "Schedule an interview using the assigned interviewer's future availability."
                  : "You can request an interview with this applicant. OnSpot Admin will review and arrange the next step."}
              </p>
            </>
          )}
        </div>
      )}

      {eligible && onAction && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-white/[0.06]">
          <Button
            type="button"
            size="sm"
            className="gap-2 bg-[#474ead] text-white hover:bg-[#3d439c]"
            onClick={onAction}
            disabled={actionDisabled}
          >
            <Calendar className="h-4 w-4" />
            {actionLabel}
          </Button>
        </div>
      )}
    </section>
  );
}


function ContextSummary({
  applicantName,
  position,
  company,
  currentStatus,
}: InterviewContext) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Applicant</p>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{applicantName}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Position</p>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{position}</p>
        {company && <p className="text-xs text-slate-500">{company}</p>}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current status</p>
        <div className="mt-1">
          <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white dark:border-white/[0.12] dark:bg-slate-900 dark:text-slate-200">
            {submissionStatusLabel(currentStatus)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function BookingsNotice() {
  return (
    <div className="flex gap-3 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3.5 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/20">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
      <div className="text-xs leading-relaxed text-indigo-900/80 dark:text-indigo-200/80">
        <p className="font-semibold text-indigo-900 dark:text-indigo-200">Microsoft Bookings</p>
        <p className="mt-0.5">
          Available interview times will be based on the assigned interviewer's Microsoft 365 calendar to help prevent schedule conflicts.
        </p>
        <p className="mt-1 font-medium">
          Microsoft Bookings connection will be configured in the next integration phase.
        </p>
      </div>
    </div>
  );
}

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  context,
  mode = "schedule",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: InterviewContext;
  mode?: "schedule" | "view";
}) {
  const [continued, setContinued] = useState(false);
  const [interviewType, setInterviewType] = useState("video");
  const [duration, setDuration] = useState("30");
  const [timezone, setTimezone] = useState(getBrowserTimezone);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [schedulingMethod, setSchedulingMethod] = useState("talent");

  useEffect(() => {
    if (open) {
      setContinued(false);
      setInterviewType("video");
      setDuration("30");
      setTimezone(getBrowserTimezone());
      setStartDate("");
      setEndDate("");
      setSchedulingMethod("talent");
    }
  }, [open]);

  const isViewOnly = mode === "view";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[#474ead]" />
            {isViewOnly ? "Interview details" : "Schedule Interview"}
          </DialogTitle>
          <DialogDescription>
            {isViewOnly
              ? "This application is marked as Interviewing, but no interview record is available yet."
              : "Prepare the interview preferences before Microsoft Bookings is connected."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ContextSummary {...context} />

          {isViewOnly ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-800/40 dark:bg-orange-900/10">
              <p className="font-semibold text-orange-900 dark:text-orange-200">No interview scheduled yet.</p>
              <p className="mt-1 text-sm leading-relaxed text-orange-800/80 dark:text-orange-300/80">
                The interview timeline and appointment details will appear here once the interview record is available. No changes have been made.
              </p>
            </div>
          ) : continued ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-800/40 dark:bg-indigo-950/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                <div>
                  <p className="font-semibold text-indigo-900 dark:text-indigo-200">Availability preview ready</p>
                  <p className="mt-1 text-sm leading-relaxed text-indigo-900/80 dark:text-indigo-200/80">
                    Microsoft Bookings availability will be connected in the next phase. No interview has been scheduled yet.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setContinued(false)}>
                Back to preferences
              </Button>
            </div>
          ) : (
            <form
              id="schedule-interview-form"
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setContinued(true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-interview-type">Interview type</Label>
                  <Select value={interviewType} onValueChange={setInterviewType}>
                    <SelectTrigger id="admin-interview-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video Interview</SelectItem>
                      <SelectItem value="phone">Phone Interview</SelectItem>
                      <SelectItem value="in_person">In-Person Interview</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-interviewer">Interviewer</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="admin-interviewer"
                      className="pl-9"
                      disabled
                      placeholder="Microsoft Bookings staff will appear here once connected."
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-interview-duration">Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger id="admin-interview-duration"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time zone</Label>
                  <TimezoneSelect value={timezone} onChange={setTimezone} placeholder="Select timezone" />
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">Scheduling method</legend>
                <RadioGroup value={schedulingMethod} onValueChange={setSchedulingMethod} className="grid gap-2 sm:grid-cols-2">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${schedulingMethod === "talent" ? "border-[#474ead] bg-[#474ead]/5" : "border-slate-200 dark:border-white/[0.08]"}`}>
                    <RadioGroupItem value="talent" className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Let Talent choose an available time</span>
                      <span className="mt-0.5 block text-xs text-slate-500">Recommended</span>
                    </span>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${schedulingMethod === "admin" ? "border-[#474ead] bg-[#474ead]/5" : "border-slate-200 dark:border-white/[0.08]"}`}>
                    <RadioGroupItem value="admin" className="mt-0.5" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Admin chooses a time</span>
                  </label>
                </RadioGroup>
              </fieldset>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Allow Talent to choose a time between</p>
                  <p className="mt-0.5 text-xs text-slate-500">This window will be used when availability is connected.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-interview-start">Start date</Label>
                    <Input id="admin-interview-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-interview-end">End date</Label>
                    <Input id="admin-interview-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </div>
                </div>
              </div>

              <BookingsNotice />
            </form>
          )}
        </div>

        <DialogFooter>
          {isViewOnly || continued ? (
            <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" form="schedule-interview-form" className="bg-[#474ead] text-white hover:bg-[#3d439c]">
                Continue to Availability
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestInterviewDialog({
  open,
  onOpenChange,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: InterviewContext;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [format, setFormat] = useState("video");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setFormat("video");
      setDuration("30");
      setNotes("");
      setStartDate("");
      setEndDate("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#474ead]" />
            Request an Interview
          </DialogTitle>
          <DialogDescription>
            Send an interview request to OnSpot Admin. The Talent is not being scheduled yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ContextSummary {...context} />

          {submitted ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-800/40 dark:bg-indigo-950/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                <div>
                  <p className="font-semibold text-indigo-900 dark:text-indigo-200">Request preview complete</p>
                  <p className="mt-1 text-sm leading-relaxed text-indigo-900/80 dark:text-indigo-200/80">
                    Interview request delivery will be connected in the next phase. No request was sent and no application status changed.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form
              id="request-interview-form"
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmitted(true);
              }}
            >
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 text-sm leading-relaxed text-indigo-900/80 dark:border-indigo-800/40 dark:bg-indigo-950/20 dark:text-indigo-200/80">
                Send an interview request to OnSpot Admin. Once approved, the Admin will arrange the interview and send the Talent a scheduling invitation.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-interview-format">Preferred interview format</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger id="client-interview-format"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="no_preference">No preference</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-interview-duration">Preferred duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger id="client-interview-duration"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="no_preference">No preference</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-interview-notes">Requested interviewer / notes</Label>
                <Textarea
                  id="client-interview-notes"
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Please have the account manager interview this candidate this week."
                  className="resize-none"
                />
                <p className="text-xs text-slate-500">Add guidance for the OnSpot Admin team. Do not choose a final time here.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Preferred interview window <span className="font-normal text-slate-400">(optional)</span></Label>
                  <p className="mt-0.5 text-xs text-slate-500">Admin will coordinate the final time after review.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="client-interview-start" className="text-xs text-slate-500">Start date</Label>
                    <Input id="client-interview-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-interview-end" className="text-xs text-slate-500">End date</Label>
                    <Input id="client-interview-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        <DialogFooter>
          {submitted ? (
            <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" form="request-interview-form" className="bg-[#474ead] text-white hover:bg-[#3d439c]">
                Send Interview Request
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}