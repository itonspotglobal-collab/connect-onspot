import { useEffect, useState, useMemo, type ReactNode } from "react";
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  UserRound,
  WifiOff,
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

// ── Eligibility helpers ───────────────────────────────────────────────────────

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

// ── Shared types ──────────────────────────────────────────────────────────────

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

interface InterviewerRecord {
  id: string;
  name: string;
  title: string;
  isCalendarConnected: boolean;
}

interface AvailableSlot {
  start: string;
  end: string;
  startDisplay: string;
  endDisplay: string;
  date: string; // YYYY-MM-DD in the requested timezone
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function apiFetch(path: string): Promise<any> {
  const token = localStorage.getItem("onspot_jwt_token");
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
  return body;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContextSummary({ applicantName, position, company, currentStatus }: InterviewContext) {
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

// ── InterviewSection shell ────────────────────────────────────────────────────

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
                  ? "Schedule an interview using the assigned interviewer's real-time Outlook availability."
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

// ── ScheduleInterviewDialog (Admin) ───────────────────────────────────────────

type DialogStep = "configure" | "slots";

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
  // Form state
  const [interviewType, setInterviewType]     = useState("video");
  const [selectedInterviewerId, setSelectedInterviewerId] = useState("");
  const [duration, setDuration]               = useState("30");
  const [timezone, setTimezone]               = useState(getBrowserTimezone);
  const [startDate, setStartDate]             = useState("");
  const [endDate, setEndDate]                 = useState("");
  const [schedulingMethod, setSchedulingMethod] = useState<"talent" | "admin">("talent");

  // Dialog step
  const [step, setStep] = useState<DialogStep>("configure");

  // Interviewer list
  const [interviewers, setInterviewers]       = useState<InterviewerRecord[]>([]);
  const [loadingInterviewers, setLoadingInterviewers] = useState(false);
  const [interviewersError, setInterviewersError]     = useState<string | null>(null);

  // Availability slots
  const [slots, setSlots]                     = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots]       = useState(false);
  const [slotsError, setSlotsError]           = useState<string | null>(null);

  // View-only mode
  const isViewOnly = mode === "view";

  // Reset on open
  useEffect(() => {
    if (open) {
      setInterviewType("video");
      setSelectedInterviewerId("");
      setDuration("30");
      setTimezone(getBrowserTimezone());
      setStartDate("");
      setEndDate("");
      setSchedulingMethod("talent");
      setStep("configure");
      setSlots([]);
      setSlotsError(null);
      setInterviewersError(null);

      // Fetch interviewers when the dialog opens (admin only)
      if (!isViewOnly) {
        setLoadingInterviewers(true);
        apiFetch("/api/admin/interviewers")
          .then((data) => {
            setInterviewers(data.interviewers ?? []);
          })
          .catch((err: Error) => {
            setInterviewersError(err.message);
          })
          .finally(() => setLoadingInterviewers(false));
      }
    }
  }, [open, isViewOnly]);

  // Selected interviewer object
  const selectedInterviewer = useMemo(
    () => interviewers.find((i) => i.id === selectedInterviewerId) ?? null,
    [interviewers, selectedInterviewerId],
  );

  // Validation for the "Check Availability" step
  const canCheckAvailability =
    selectedInterviewerId !== "" &&
    selectedInterviewer?.isCalendarConnected === true &&
    startDate !== "" &&
    endDate !== "" &&
    startDate <= endDate;

  // Slots grouped by date
  const slotsByDate = useMemo<Record<string, AvailableSlot[]>>(() => {
    const groups: Record<string, AvailableSlot[]> = {};
    for (const slot of slots) {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    }
    return groups;
  }, [slots]);

  const sortedDates = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate]);

  async function handleCheckAvailability() {
    setSlotsError(null);
    setSlots([]);
    setLoadingSlots(true);
    setStep("slots");

    const params = new URLSearchParams({
      interviewerId: selectedInterviewerId,
      startDate,
      endDate,
      duration,
      timezone,
    });

    try {
      const data = await apiFetch(`/api/admin/interviewer-availability?${params}`);
      setSlots(data.slots ?? []);
    } catch (err: Error | any) {
      setSlotsError(err.message ?? "Failed to load availability");
    } finally {
      setLoadingSlots(false);
    }
  }

  // ── View-only mode (status is already "interviewing" but no record yet) ──────
  if (isViewOnly) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#474ead]" />
              Interview details
            </DialogTitle>
            <DialogDescription>
              This application is marked as Interviewing, but no interview record is available yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <ContextSummary {...context} />
            <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-800/40 dark:bg-orange-900/10">
              <p className="font-semibold text-orange-900 dark:text-orange-200">No interview scheduled yet.</p>
              <p className="mt-1 text-sm leading-relaxed text-orange-800/80 dark:text-orange-300/80">
                The interview timeline and appointment details will appear here once the interview record is available. No changes have been made.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Step: configure ───────────────────────────────────────────────────────────
  const configureStep = (
    <form
      id="schedule-interview-form"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        handleCheckAvailability();
      }}
    >
      {/* Interview type + Interviewer */}
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
          {loadingInterviewers ? (
            <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 dark:border-white/[0.1]">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="text-sm text-slate-400">Loading interviewers…</span>
            </div>
          ) : interviewersError ? (
            <div className="flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50/60 px-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{interviewersError}</span>
            </div>
          ) : (
            <Select
              value={selectedInterviewerId}
              onValueChange={setSelectedInterviewerId}
            >
              <SelectTrigger id="admin-interviewer">
                <UserRound className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                <SelectValue placeholder="Select interviewer" />
              </SelectTrigger>
              <SelectContent>
                {interviewers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-400">No interviewers configured</div>
                ) : (
                  interviewers.map((iv) => (
                    <SelectItem key={iv.id} value={iv.id}>
                      <span className="flex items-center gap-2">
                        <span>{iv.name}</span>
                        {!iv.isCalendarConnected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <WifiOff className="h-2.5 w-2.5" />
                            No calendar
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
          {selectedInterviewer && !selectedInterviewer.isCalendarConnected && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              This interviewer's Outlook calendar is not yet connected. Select a connected interviewer to check availability.
            </p>
          )}
        </div>
      </div>

      {/* Duration + Timezone */}
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

      {/* Scheduling method */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">Scheduling method</legend>
        <RadioGroup
          value={schedulingMethod}
          onValueChange={(v) => setSchedulingMethod(v as "talent" | "admin")}
          className="grid gap-2 sm:grid-cols-2"
        >
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${schedulingMethod === "talent" ? "border-[#474ead] bg-[#474ead]/5" : "border-slate-200 dark:border-white/[0.08]"}`}>
            <RadioGroupItem value="talent" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Let Talent choose an available time</span>
              <span className="mt-0.5 block text-xs text-slate-500">Recommended — Talent picks from open slots</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${schedulingMethod === "admin" ? "border-[#474ead] bg-[#474ead]/5" : "border-slate-200 dark:border-white/[0.08]"}`}>
            <RadioGroupItem value="admin" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Admin selects a specific time</span>
              <span className="mt-0.5 block text-xs text-slate-500">You choose one slot from the available windows</span>
            </span>
          </label>
        </RadioGroup>
      </fieldset>

      {/* Date window */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Availability window to check</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Only weekday slots between 9 AM and 6 PM in the selected timezone will be shown.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="admin-interview-start">Start date</Label>
            <Input
              id="admin-interview-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-interview-end">End date <span className="font-normal text-slate-400">(max 14 days)</span></Label>
            <Input
              id="admin-interview-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>
      </div>

      {/* Validation hint for missing calendar */}
      {!canCheckAvailability && selectedInterviewerId && !selectedInterviewer?.isCalendarConnected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            Select an interviewer with a connected Outlook calendar to check availability.
          </p>
        </div>
      )}
    </form>
  );

  // ── Step: slots ───────────────────────────────────────────────────────────────
  const slotsStep = (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-slate-200 bg-white text-slate-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-slate-300">
          {selectedInterviewer?.name ?? selectedInterviewerId}
        </Badge>
        <Badge className="border-slate-200 bg-white text-slate-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-slate-300">
          {duration} min
        </Badge>
        <Badge className="border-slate-200 bg-white text-slate-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-slate-300">
          {interviewType.replace("_", "-")}
        </Badge>
        <Badge className="border-slate-200 bg-white text-slate-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-slate-300">
          {timezone}
        </Badge>
      </div>

      {loadingSlots && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 py-10 dark:border-white/[0.08]">
          <Loader2 className="h-5 w-5 animate-spin text-[#474ead]" />
          <span className="text-sm text-slate-500">Checking {selectedInterviewer?.name}'s Outlook calendar…</span>
        </div>
      )}

      {slotsError && !loadingSlots && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-800/40 dark:bg-red-950/20">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200">Availability unavailable</p>
            <p className="mt-1 text-sm text-red-800/80 dark:text-red-300/80">{slotsError}</p>
          </div>
        </div>
      )}

      {!loadingSlots && !slotsError && slots.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 py-10 text-center dark:border-white/[0.08]">
          <Clock className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No open slots found</p>
          <p className="max-w-xs text-xs text-slate-500">
            No free 9 AM–6 PM weekday windows were found in the selected date range.
            Try a different window or interviewer.
          </p>
        </div>
      )}

      {!loadingSlots && !slotsError && sortedDates.length > 0 && (
        <div className="space-y-4">
          {schedulingMethod === "talent" && (
            <div className="flex items-start gap-3 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3.5 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/20">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
              <p className="text-xs leading-relaxed text-indigo-900/80 dark:text-indigo-200/80">
                <span className="font-semibold">Talent-led scheduling:</span> The Talent will receive a scheduling invitation with these open windows and can choose their preferred time. No appointment is created yet.
              </p>
            </div>
          )}

          {sortedDates.map((date) => (
            <div key={date}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {formatDateHeading(date)}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {slotsByDate[date].map((slot) => (
                  <div
                    key={slot.start}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#474ead]" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {slot.startDisplay}
                    </span>
                    <span className="text-xs text-slate-400">–</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{slot.endDisplay}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {slots.length} slot{slots.length !== 1 ? "s" : ""} available across {sortedDates.length} day{sortedDates.length !== 1 ? "s" : ""}.
            No interview has been scheduled. No application status has changed.
          </p>
        </div>
      )}
    </div>
  );

  // ── Main dialog ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[#474ead]" />
            {step === "configure" ? "Schedule Interview" : "Available Times"}
          </DialogTitle>
          <DialogDescription>
            {step === "configure"
              ? "Select an interviewer and date window to check real-time Outlook availability."
              : `Showing open slots for ${selectedInterviewer?.name ?? "the interviewer"} between ${startDate} and ${endDate}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ContextSummary {...context} />
          {step === "configure" ? configureStep : slotsStep}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === "configure" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="schedule-interview-form"
                className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                disabled={!canCheckAvailability}
              >
                Check Availability
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("configure")}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── RequestInterviewDialog (Client) ───────────────────────────────────────────

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
  const [format, setFormat]       = useState("video");
  const [duration, setDuration]   = useState("30");
  const [notes, setNotes]         = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");

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
              onSubmit={(e) => {
                e.preventDefault();
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
                  onChange={(e) => setNotes(e.target.value)}
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
                    <Input id="client-interview-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-interview-end" className="text-xs text-slate-500">End date</Label>
                    <Input id="client-interview-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
