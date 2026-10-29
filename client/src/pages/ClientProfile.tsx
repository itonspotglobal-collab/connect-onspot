import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildRateDisplay, formatCurrencyAmount, getTimeAgo } from "@/lib/jobUtils";
import { getJobFunctionDisplay } from "@shared/jobFunction";
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Clock,
  Briefcase,
  Pencil,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowLeft,
  Save,
  X,
  Users,
  Calendar,
  FileText,
  Download,
  Inbox,
  MessageSquare,
  Loader2,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { CLIENT_SETTABLE_STATUSES, canClientUpdateApplicationStatus } from "@shared/submissionStatuses";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount";
import { formatInterviewTime } from "@/lib/formatInterviewTime";
import {
  InterviewSection,
  RequestInterviewDialog,
  canRequestInterview,
} from "@/components/InterviewWorkflowUi";
import { JobRichText } from "@/components/JobRichText";
import { ContractApplicationPanel } from "@/components/ContractApplicationPanel";
import { OfferExpirationRenewal } from "@/components/OfferExpirationRenewal";
import { ClientHiringPaymentPanel, type HiringInvoice } from "@/components/hiring-payments/HiringPayments";
import { PaymentVerificationCard, usePaymentSkip } from "@/components/hiring-payments/PaymentVerificationCard";
import { InterviewOutcomeControls,InterviewOutcomeList } from "@/components/InterviewOutcomeControls";
import { ContractorOnboardingTracker, useContractorOnboarding } from "@/components/ContractorOnboarding";
import { isContractorOfferAllowed } from "@/lib/contractorOnboarding";

// ─── Name-masking helper ──────────────────────────────────────────────────────
export interface JobSubmission {
  hiringPipelineEligible: boolean;
  id: string;
  jobId: string;
  clientId: string;
  applicantName: string;
  email: string;
  phone: string | null;
  location: string | null;
  resumeUrl: string | null;
  resumeFileName: string | null;
  portfolioUrl: string | null;
  coverLetter: string | null;
  expectedSalary: string | null;
  availability: string | null;
  status: string;
  statusVersion: string;
  proposer_role?: string;
  parent_offer_id?: string | null;
  submittedAt: string;
  jobTitle: string;
  jobCompany: string | null;
  jobEngagementType: string | null;
  combinedInviteReveal?: boolean;
  combinedInterviewConfirmed?: boolean;
  invitationPending?: boolean;
  invitation_pending?: boolean;
  interviewId?: string | null;
  interviewStatus?: string | null;
  proposedTimes?: Array<{ start: string; end?: string; timezone?: string }>;
  confirmedTime?: string | null;
  confirmedTimeZone?: string | null;
  currentProposalOwner?: string | null;
  meetingLink?: string | null;
  proposalExchangeCount?: number;
  interviewNudge?: boolean;
  /** 'client' when the client invited this talent via Search & Shortlist; 'talent' for self-applied */
  initiated_by: string | null;
  acceptedOfferId?: string | null;
}

const OFFERABLE_STATUSES = new Set([
  "shortlisted", "reviewed", "under_review", "interviewing", "offer_declined",
]);
const SUBMISSION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:            { label: "New",             color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  submitted:      { label: "Applied",         color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  reviewed:       { label: "Reviewed",        color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  under_review:   { label: "Under Review",    color: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400" },
  shortlisted:    { label: "Shortlisted",     color: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" },
  interviewing:   { label: "Interviewing",    color: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400" },
  offer_extended: { label: "Offer Extended",  color: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400" },
  offer_expired:  { label: "Offer Expired",   color: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" },
  contract_sent:  { label: "Contract Sent",   color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  contract_signed:{ label: "Contract signed · deposit due", color: "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" },
  offer_declined: { label: "Offer Declined",  color: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" },
  rejected:       { label: "Rejected",        color: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  hired:          { label: "Hired",           color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  invited:        { label: "Invited",         color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400" },
  declined:       { label: "Declined",        color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

interface OfferRecord {
  id: string;
  submission_id: string;
  engagement_type: string | null;
  rate: string;
  rate_currency: string;
  proposed_start_date: string | null;
  expires_at: string | null;
  notes: string | null;
  status: string;
  proposer_role?: string;
  parent_offer_id?: string | null;
  rate_below_expectation: boolean | null;
  rate_delta: string | null;
  sent_at: string | null;
  created_at: string;
}
export function ViewSubmissionModal({
  submission,
  requestedInterviewId,
  onClose,
  onStatusChange,
  onExtendOffer,
  nameRevealThreshold = "submitted",
}: {
  submission: JobSubmission;
  requestedInterviewId: string | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string, statusVersion: string) => void;
  onExtendOffer: (sub: JobSubmission) => void;
  nameRevealThreshold?: string;
}) {
  const { toast } = useToast();
  const onboarding = useContractorOnboarding(submission.id);
  const [shortlisting, setShortlisting] = useState(false);
  const statusInfo = SUBMISSION_STATUS_LABELS[submission.status] ?? SUBMISSION_STATUS_LABELS.new;

  const [requestedStatus, setRequestedStatus] = useState<string>("");
  const [requestConfirmOpen, setRequestConfirmOpen] = useState(false);
  const [requestInterviewOpen, setRequestInterviewOpen] = useState(false);
  const statusOperation = useRef<{ id: string; status: string } | null>(null);
  const statusBusy = useRef(false);
  const { data: interviewRows = [], isLoading: interviewRowsLoading, refetch: refetchInterviews } = useQuery<any[]>({
    queryKey: ["/api/client/interviews", submission.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/client/interviews?submissionId=${submission.id}`);
      return res.ok ? res.json() : [];
    },
    enabled: Boolean(submission.interviewId || requestedInterviewId),
  });
  const { data: submissionOffers = [] } = useQuery<OfferRecord[]>({
    queryKey: ["/api/client/offers", submission.id],
    queryFn: async () => (await apiRequest("GET", `/api/client/offers?submissionId=${encodeURIComponent(submission.id)}`)).json(),
    enabled: ["offer_accepted", "contract_sent", "contract_signed", "hired"].includes(submission.status),
  });
  const acceptedOfferId = submission.acceptedOfferId || submissionOffers.find((offer) => offer.status === "accepted")?.id || null;
  const [meetingLinkDraft, setMeetingLinkDraft] = useState("");
  const [interviewBusy, setInterviewBusy] = useState(false);
  const requestedInterview = requestedInterviewId
    ? interviewRows.find((row: any) => row.id === requestedInterviewId)
    : null;
  const currentInterview = requestedInterviewId
    ? requestedInterview
    : interviewRows.find((row: any) => row.id === submission.interviewId);
  const requestedInterviewNotFound = !!requestedInterviewId && !interviewRowsLoading && !requestedInterview;
  const requestedInterviewIsHistorical = !!requestedInterviewId &&
    requestedInterviewId !== submission.interviewId && !!requestedInterview;
  const respondToInterview = async (payload: Record<string, unknown>) => {
    const interviewId = currentInterview?.id;
    if (!interviewId) return;
    setInterviewBusy(true);
    try {
      const response = await apiRequest("PATCH", `/api/client/interviews/${interviewId}`, payload);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Could not update the interview");
      }
      await refetchInterviews();
      toast({ title: "Interview updated" });
    } catch (err: any) {
      toast({ title: "Could not update interview", description: err.message, variant: "destructive" });
    } finally {
      setInterviewBusy(false);
    }
  };
  const requestStatusMutation = useMutation({
    mutationFn: async () => {
      if (!statusOperation.current || statusOperation.current.status !== requestedStatus) {
        statusOperation.current = { id: crypto.randomUUID(), status: requestedStatus };
      }
      return (await apiRequest("PATCH", `/api/client/job-submissions/${submission.id}/status`, {
        status: requestedStatus, expectedStatus: submission.status,
        expectedVersion: submission.statusVersion, operationId: statusOperation.current.id,
      })).json();
    },
    onSuccess: (result) => {
      onStatusChange(submission.id, result.status, result.statusVersion);
      queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      toast({
        title: `Application status ${result.alreadyApplied ? "is already" : "updated to"} ${SUBMISSION_STATUS_LABELS[result.status]?.label ?? result.status}`,
        description: result.emailSent ? "The applicant has been notified by email." : "No additional email was sent.",
      });
      statusOperation.current = null;
      setRequestedStatus("");
      setRequestConfirmOpen(false);
    },
    onError: (err: any) => {
      let message = "The status update could not be completed.";
      try { const body = JSON.parse(err.message.replace(/^\d+:\s*/, "")); message = body.message || body.error || message; } catch {}
      toast({ title: "Status was not updated", description: message, variant: "destructive" });
    },
    onSettled: () => { statusBusy.current = false; },
  });
  const canRequestInterviewNow =
    canRequestInterview(submission.status) &&
    (onboarding.data?.policy !== "deposit_first" || onboarding.data.canScheduleInterview) &&
    !isPendingOrDeclinedInvite(submission.initiated_by, submission.status, isInvitationPending(submission)) &&
    !submission.interviewId;

  const handleResumeDownload = () => {
    if (!submission.resumeUrl) return;
    const resumeId = submission.resumeUrl.split("/").pop();
    window.open(`/api/job-resumes/${resumeId}`, "_blank");
  };
  async function shortlistApplication() {
    if (shortlisting) return;
    setShortlisting(true);
    try {
      await apiRequest("PATCH", `/api/client/job-submissions/${submission.id}/status`, {
        status: "shortlisted", expectedStatus: submission.status, expectedVersion: submission.statusVersion,
        operationId: crypto.randomUUID(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/contractor-onboarding", submission.id] }),
      ]);
      toast({ title: "Applicant shortlisted", description: "Interview scheduling is now available." });
    } catch (error) {
      toast({ title: "Could not shortlist applicant", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setShortlisting(false); }
  }

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Application Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <ContractorOnboardingTracker
            data={onboarding.data}
            isLoading={onboarding.isLoading}
            isError={onboarding.isError}
            onRetry={() => void onboarding.refetch()}
            onShortlist={onboarding.data?.policy === "deposit_first" && !onboarding.data.shortlistSatisfied && !shortlisting ? shortlistApplication : undefined}
          />
          {/* Job info */}
          <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Position</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{submission.jobTitle}</p>
            {submission.jobCompany && <p className="text-xs text-slate-500">{submission.jobCompany}</p>}
          </div>

          {/* Canonical status and automatic applicant email */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {submission.initiated_by === "client" && (
              <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                You invited
              </span>
            )}
            {submission.status === "invited" && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                Pending response
              </span>
            )}
            {/* Only allow status changes once the talent has accepted (submitted or later).
                Pending and declined invitations are locked — only the talent's respond
                endpoint may transition those rows. */}
          </div>
          {CLIENT_SETTABLE_STATUSES.some(status => canClientUpdateApplicationStatus(submission.status, status)) && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Update application status</Label>
                <div className="flex gap-2">
                  <Select value={requestedStatus} onValueChange={setRequestedStatus} disabled={requestStatusMutation.isPending}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Choose a status" /></SelectTrigger>
                    <SelectContent>{CLIENT_SETTABLE_STATUSES.filter(v => v !== submission.status && canClientUpdateApplicationStatus(submission.status, v)).map(v => <SelectItem key={v} value={v}>{SUBMISSION_STATUS_LABELS[v]?.label ?? v}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button disabled={!requestedStatus || requestStatusMutation.isPending} onClick={() => setRequestConfirmOpen(true)}>Update Status</Button>
                </div>
                <p className="text-xs text-muted-foreground">The applicant’s status email will be sent automatically. No Admin approval is required.</p>
              </div>
          )}

           {/* Interview coordination */}
            {submission.interviewId || requestedInterviewId ? (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/20">
               {requestedInterviewNotFound ? (
                 <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
                   This interview is unavailable or is not associated with this application and your account.
                 </p>
               ) : interviewRowsLoading && requestedInterviewId ? (
                 <p className="text-sm text-slate-500">Loading requested interview…</p>
               ) : (
               <>
              <div className="flex items-center justify-between gap-2">
                 <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                   {requestedInterviewId ? `Interview round ${currentInterview?.round_number ?? currentInterview?.roundNumber ?? ""}` : "Initial interview"}
                 </p>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold capitalize text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">
                   {currentInterview?.status ?? submission.interviewStatus ?? "proposed"}
                </span>
              </div>
               {requestedInterviewIsHistorical && (
                 <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">This is an earlier interview round. It is shown read-only because a newer round is current.</p>
               )}
              {(currentInterview?.confirmed_time ?? submission.confirmedTime) ? (
                <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Confirmed: {formatInterviewTime(
                    currentInterview?.confirmed_time ?? submission.confirmedTime!,
                    currentInterview?.confirmed_time_zone ?? submission.confirmedTimeZone ?? "UTC",
                  )}
                </p>
              ) : (currentInterview?.current_proposal_owner ?? submission.currentProposalOwner) === "client" ? (
                <p className="mt-2 text-xs font-medium text-orange-700 dark:text-orange-300">
                  Talent proposed a new interview time. Your response is required.
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Waiting for the talent to choose a time. {submission.proposalExchangeCount ? `${submission.proposalExchangeCount} time exchange${submission.proposalExchangeCount === 1 ? "" : "s"} so far.` : ""}
                </p>
              )}
              {currentInterview&&<InterviewOutcomeControls interview={currentInterview} />}
              <InterviewOutcomeList submissionId={submission.id} excludeId={currentInterview?.id} />
              {(() => {
                const interview = currentInterview;
                 const canRespond = interview && !requestedInterviewIsHistorical &&
                   ["proposed", "rescheduled"].includes(interview.status) && interview.current_proposal_owner === "client";
                if (!interview || !canRespond) return null;
                return (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">The talent suggested new times. Confirm one to lock the interview:</p>
                    <div className="flex flex-wrap gap-2">
                      {(interview.proposed_times ?? []).map((slot: any) => (
                        <Button key={slot.start} size="sm" className="h-8 rounded-full bg-indigo-600 text-xs text-white hover:bg-indigo-700" disabled={interviewBusy} onClick={() => respondToInterview({ status: "confirmed", confirmedTime: slot.start, meetingLink: meetingLinkDraft || undefined })}>
                          Confirm {formatInterviewTime(slot.start, slot.timezone ?? "UTC")}
                        </Button>
                      ))}
                    </div>
                    <Input aria-label="Meeting link" value={meetingLinkDraft} onChange={(event) => setMeetingLinkDraft(event.target.value)} placeholder="Optional meeting link (Zoom, Teams, Meet)" className="h-9 text-xs" />
                  </div>
                );
              })()}
               {!requestedInterviewIsHistorical && (currentInterview?.status ?? submission.interviewStatus) === "confirmed" && (
                <div className="mt-3 flex gap-2">
                  <Input aria-label="Meeting link" value={meetingLinkDraft || submission.meetingLink || ""} onChange={(event) => setMeetingLinkDraft(event.target.value)} placeholder="Add a meeting link" className="h-9 text-xs" />
                  <Button size="sm" variant="outline" className="h-9 text-xs" disabled={interviewBusy || !meetingLinkDraft} onClick={() => respondToInterview({ meetingLink: meetingLinkDraft })}>Save link</Button>
                </div>
              )}
               {(currentInterview?.meeting_link ?? submission.meetingLink) && (currentInterview?.status ?? submission.interviewStatus) === "confirmed" && (
                 <a href={currentInterview?.meeting_link ?? submission.meetingLink ?? undefined} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"><ExternalLink className="h-3 w-3" /> Open meeting link</a>
              )}
              {submission.interviewNudge && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">Several time proposals have been exchanged. Consider the talent’s suggested availability.</p>}
               </>
               )}
            </div>
           ) : (
             <InterviewSection
               role="client"
               applicantName={maskSubmissionName(submission.applicantName, submission.initiated_by, submission.status, nameRevealThreshold, isInvitationPending(submission))}
               position={submission.jobTitle}
               company={submission.jobCompany}
               currentStatus={submission.status}
               onAction={() => setRequestInterviewOpen(true)}
               actionDisabled={!canRequestInterviewNow || !submission.hiringPipelineEligible}
                disabledReason={!submission.hiringPipelineEligible ? "This application is not eligible for formal hiring. A linked Talent account and a real approved job are required." : onboarding.data?.policy === "deposit_first" && !onboarding.data.canScheduleInterview ? "Shortlist this applicant before scheduling an interview." : undefined}
             />
           )}

          {/* Applicant details */}
          {isPendingOrDeclinedInvite(submission.initiated_by, submission.status, isInvitationPending(submission)) && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 dark:bg-amber-900/20 dark:border-amber-700/40">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {submission.status === "declined"
                  ? "This talent declined the invitation — their identity remains private."
                  : "Awaiting talent response — name and email reveal once they accept."}
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Full Name",
                value: maskSubmissionName(submission.applicantName, submission.initiated_by, submission.status, nameRevealThreshold, isInvitationPending(submission)),
              },
              {
                label: "Email",
                value: isPendingOrDeclinedInvite(submission.initiated_by, submission.status, isInvitationPending(submission))
                  ? null
                  : submission.email,
              },
              {
                label: "Phone",
                value: isPendingOrDeclinedInvite(submission.initiated_by, submission.status, isInvitationPending(submission)) ? null : submission.phone,
              },
              { label: "Location", value: submission.location },
              { label: "Expected Salary", value: submission.expectedSalary },
              { label: "Availability", value: submission.availability },
              { label: "Submitted", value: submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null },
            ].filter(({ value }) => value).map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          {/* Portfolio */}
          {submission.portfolioUrl && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Portfolio / LinkedIn</p>
              <a
                href={submission.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#474ead] hover:underline"
              >
                {submission.portfolioUrl} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Cover Letter */}
          {submission.coverLetter && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Cover Letter</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {submission.coverLetter}
              </p>
            </div>
          )}

          {/* Resume */}
          {submission.resumeUrl && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Resume</p>
              <Button variant="outline" size="sm" onClick={handleResumeDownload} className="gap-2">
                <Download className="h-4 w-4" />
                {submission.resumeFileName || "Download Resume"}
              </Button>
            </div>
          )}

          {(["offer_accepted", "contract_sent", "contract_signed", "hired"].includes(submission.status) || Boolean(acceptedOfferId)) && (
            <ContractApplicationPanel submissionId={submission.id} acceptedOfferId={acceptedOfferId} />
          )}

          {/* Extend Offer action */}
          {submission.hiringPipelineEligible && OFFERABLE_STATUSES.has(submission.status) && !isPendingOrDeclinedInvite(submission.initiated_by, submission.status, isInvitationPending(submission)) && (
            <div className="border-t border-slate-100 dark:border-white/[0.08] pt-4">
              <Button
                className="w-full gap-2 bg-[#474ead] hover:bg-[#3a3d8f] text-white"
                disabled={onboarding.data?.policy === "deposit_first" && !onboarding.data.canSendOffer}
                onClick={() => { onClose(); onExtendOffer(submission); }}
              >
                <FileText className="h-4 w-4" />
                {onboarding.data?.policy === "deposit_first" && !onboarding.data.canSendOffer ? onboarding.data.offerBlockers?.[0]??"Offer unavailable" : "Ready for Offer"}
              </Button>
              {!onboarding.data?.offerAccepted&&onboarding.data?.policy === "deposit_first" && !onboarding.data.canSendOffer && <p className="mt-2 text-center text-xs text-amber-800">Offer unavailable: {onboarding.data.offerBlockers?.join(", ") || "a passed final interview is required"}.</p>}
            </div>
          )}
        </div>
        <AlertDialog open={requestConfirmOpen} onOpenChange={setRequestConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Update application status?</AlertDialogTitle><AlertDialogDescription>
              The corresponding applicant email will be sent automatically before the status changes. If sending fails, the application will remain {statusInfo.label}.
            </AlertDialogDescription></AlertDialogHeader>
            <div className="text-sm space-y-1"><p><strong>Talent:</strong> {submission.applicantName}</p><p><strong>Position:</strong> {submission.jobTitle}</p><p><strong>Requested status:</strong> {SUBMISSION_STATUS_LABELS[requestedStatus]?.label}</p></div>
            <AlertDialogFooter><AlertDialogCancel disabled={requestStatusMutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={(event) => {
              event.preventDefault();
              if (statusBusy.current) return;
              statusBusy.current = true;
              requestStatusMutation.mutate();
            }} disabled={requestStatusMutation.isPending}>{requestStatusMutation.isPending ? "Sending email…" : "Confirm & Notify Applicant"}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
    <RequestInterviewDialog
      open={requestInterviewOpen}
      onOpenChange={setRequestInterviewOpen}
      submissionId={submission.id}
      onScheduled={() => {
        setRequestInterviewOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/client/interviews", submission.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions", submission.id, "status-change-request"] });
      }}
      context={{
        applicantName: maskSubmissionName(submission.applicantName, submission.initiated_by, submission.status, nameRevealThreshold, isInvitationPending(submission)),
        position: submission.jobTitle,
        company: submission.jobCompany,
        currentStatus: submission.status,
      }}
      defaultInterviewType={onboarding.data?.defaultInterviewType}
    />
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientProfile {
  id: string;
  userId: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phoneNumber: string | null;
  website: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  about: string | null;
  hiringNeeds: string | null;
  preferredRoles: string[];
  timezone: string | null;
  msaAcceptedAt: string | null;
  msaVersion: string | null;
  createdAt: string;
}

// ─── Client job preview dialog ────────────────────────────────────────────────
// Shows the full details of a client-owned job regardless of its status.
// Uses data already loaded from GET /api/client/jobs (SELECT j.*) — no extra fetch.
// For open+approved jobs a "View public listing" link is also shown.
export function ClientJobPreviewDialog({ job, onClose }: { job: Job | null; onClose: () => void }) {
  if (!job) return null;

  const normalizedJob = {
    ...(job as any),
    salaryDisplay: (job as any).salaryDisplay ?? (job as any).salary_display,
    budget: (job as any).budget,
    budgetCurrency: (job as any).budgetCurrency ?? (job as any).budget_currency,
    customCurrencyCode: (job as any).customCurrencyCode ?? (job as any).custom_currency_code,
    engagementType: (job as any).engagementType ?? (job as any).engagement_type,
  };
  const hasSalary = Boolean(normalizedJob.salaryDisplay?.trim() || normalizedJob.budget);
  const pay = hasSalary ? buildRateDisplay(normalizedJob) : "";
  const approvalStatus =
    (job as any).approvalStatus ??
    (job as any).approval_status ??
    "pending";
  const isPublic = job.status === "open" && approvalStatus === "approved";

  const statusBadge = ({
    open:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    closed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    draft:  "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  } as Record<string, string>)[job.status ?? "draft"] ?? "bg-slate-100 text-slate-500";

  const approvalLabel = ({
    pending:           "Pending Approval",
    approved:          "Approved",
    rejected:          "Declined",
    linked_to_existing:"Linked to Existing",
  } as Record<string, string>)[approvalStatus] ?? approvalStatus;

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Engagement Type", value: (job as any).engagementType },
    { label: "Function",        value: getJobFunctionDisplay(job) },
    { label: "Rate / Salary",   value: pay || null },
    { label: "Location",        value: (job as any).location },
    { label: "Posted",          value: job.createdAt ? getTimeAgo(job.createdAt) : null },
  ].filter((f) => f.value);

  return (
    <Dialog open={!!job} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug pr-6">{job.title}</DialogTitle>
        </DialogHeader>

        {/* Status badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadge}`}>
            {job.status ?? "draft"}
          </span>
          {approvalStatus !== "approved" && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              {approvalLabel}
            </span>
          )}
          {isPublic && (
            <a
              href={`/find-work/job/${job.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-[#474ead] hover:underline border border-[#474ead]/30"
            >
              <ExternalLink className="w-3 h-3" />View public listing
            </a>
          )}
        </div>

        {/* Key fields */}
        {fields.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {(job as any).description && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Description</p>
            <JobRichText
              html={(job as any).description}
              className="max-h-48 overflow-y-auto text-slate-700 dark:text-slate-300"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Job row inside client profile ────────────────────────────────────────────
export function ClientJobRow({
  job,
  onEdit,
  onToggle,
  onDelete,
  onView,
  onInvite,
  isToggling,
  isDeleting,
}: {
  job: Job;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onView: () => void;
  onInvite: () => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const isOpen = job.status === "open";
  const isDraft = job.status === "draft";
  const normalizedJob = {
    ...(job as any),
    salaryDisplay: (job as any).salaryDisplay ?? (job as any).salary_display,
    budget: (job as any).budget,
    budgetCurrency: (job as any).budgetCurrency ?? (job as any).budget_currency,
    customCurrencyCode: (job as any).customCurrencyCode ?? (job as any).custom_currency_code,
    engagementType: (job as any).engagementType ?? (job as any).engagement_type,
  };
  const pay = normalizedJob.salaryDisplay?.trim() || normalizedJob.budget ? buildRateDisplay(normalizedJob) : "";
  const approvalStatus =
    (job as any).approvalStatus ??
    (job as any).approval_status ??
    "pending";
  const canInviteTalent =
    isOpen &&
    approvalStatus === "approved" &&
    (job as any).createdVia !== "search_scaffold";
  const workArrangement = (job as any).workArrangement ?? (job as any).work_arrangement ??
    (job as any).workSetup ?? (job as any).work_setup ?? job.location;
  const postedAt = (job as any).createdAt ?? (job as any).created_at;

  const approvalBadge = ({
    pending: { label: "Pending Approval", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
    approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    rejected: { label: "Declined", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
    linked_to_existing: { label: "Linked to Existing", className: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400" },
  } as Record<string, { label: string; className: string }>)[approvalStatus] ?? { label: approvalStatus, className: "bg-slate-100 text-slate-500" };

  return (
    <div data-testid={`client-job-${job.id}`} className="group relative rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-slate-900/60 transition-shadow hover:shadow-sm">
      <div
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${
          approvalStatus === "approved" && isOpen
            ? "bg-emerald-400"
            : approvalStatus === "pending"
              ? "bg-amber-400"
              : approvalStatus === "rejected"
                ? "bg-red-400"
                : approvalStatus === "linked_to_existing"
                  ? "bg-violet-400"
                  : "bg-slate-300 dark:bg-white/20"
        }`}
      />
      <div className="flex flex-col gap-3 px-5 py-4 pl-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {job.title}
            </h3>
            {/* Job status badge */}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isOpen
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/40"
              }`}
            >
              {isDraft ? "Draft" : isOpen ? "Open" : job.status === "closed" ? "Closed" : job.status}
            </span>
            {/* Approval status badge */}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${approvalBadge.className}`}>
              {approvalBadge.label}
            </span>
          </div>
          {/* Status messages */}
          {approvalStatus === "rejected" && ((job as any).rejectionReason ?? (job as any).rejection_reason) && (
            <p className="mb-1 text-xs text-red-600 dark:text-red-400">
              Reason: {(job as any).rejectionReason ?? (job as any).rejection_reason}
            </p>
          )}
          {approvalStatus === "pending" && (
            <p className="mb-1 text-xs text-amber-600 dark:text-amber-400">
              Pending Admin review — not yet visible publicly
            </p>
          )}
          {approvalStatus === "linked_to_existing" && (
            <p className="mb-1 text-xs text-violet-600 dark:text-violet-400">
              Your job request was linked to an existing active job posting to avoid duplicate listings.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            {getJobFunctionDisplay(job) && <span className="capitalize">{getJobFunctionDisplay(job).replace(/-/g, " ")}</span>}
            {workArrangement && <><span className="text-slate-300 dark:text-white/20">·</span><span className="capitalize">{String(workArrangement).replace(/[_-]/g, " ")}</span></>}
            {pay && (
              <>
                <span className="text-slate-300 dark:text-white/20">·</span>
                <span className="font-medium text-[#474ead] dark:text-indigo-400">{pay}</span>
              </>
            )}
            {postedAt && <><span className="text-slate-300 dark:text-white/20">·</span><span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getTimeAgo(postedAt)}
            </span></>}
            {(job.proposalCount ?? 0) > 0 && (
              <>
                <span className="text-slate-300 dark:text-white/20">·</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {job.proposalCount} application{job.proposalCount !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isDraft && canInviteTalent && (
            <Button
              size="sm"
              className="bg-[#474ead] text-white hover:bg-[#3d439c]"
              onClick={onInvite}
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />Invite Talent
            </Button>
          )}
          {!isDraft && <Button variant="outline" size="sm" onClick={onToggle} disabled={isToggling}>
            {isOpen ? (
              <><EyeOff className="w-3 h-3 mr-1.5" />Close</>
            ) : (
              <><Eye className="w-3 h-3 mr-1.5" />Reopen</>
            )}
          </Button>}
          <Button
            variant={isDraft ? "default" : "outline"}
            size="sm"
            className={isDraft ? "bg-[#474ead] text-white hover:bg-[#3d439c]" : ""}
            onClick={onEdit}
          >
            <Pencil className="w-3 h-3 mr-1.5" />
            {isDraft ? "Continue Editing" : "Edit"}
          </Button>
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-3 h-3 mr-1.5" />View
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" disabled={isDeleting} aria-label={`Delete job ${job.title}`} data-testid={`button-delete-job-${job.id}`}>
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently delete this job?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{job.title}&rdquo; will be permanently removed and cannot be recovered.
                  {(job.proposalCount ?? 0) > 0 && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                      This job has {job.proposalCount} application{job.proposalCount !== 1 ? "s" : ""}. Delete will be blocked — close it instead if you want to hide it.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ─── Profile field ────────────────────────────────────────────────────────────
function ProfileField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ElementType;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="text-sm text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ClientProfile() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const destination = params.get("applicationId") || params.get("interviewId")
    ? "/client/job-submissions"
    : params.get("jobId") ? "/client/job-postings" : null;
  useEffect(() => {
    if (destination) navigate(`${destination}?${search}`, { replace: true });
  }, [destination, navigate, search]);
  // Do not mount overview queries when resolving a historical resource link.
  return destination ? null : <ClientProfileOverview />;
}

function ClientProfileOverview() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const unreadMessagesCount = useUnreadMessagesCount();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ClientProfile>>({});

  // ─── Redirect if not client ───────────────────────────────────────────────
  if (!isAuthenticated || user?.role !== "client") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Client access required
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Sign in with a client account to view your profile.
            </p>
            <Button onClick={() => navigate("/hire-talent")}>Go to Hire Talent</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Platform settings (name-reveal threshold) ────────────────────────────
  const { data: platformSettings } = useQuery<{ nameRevealThreshold: string }>({
    queryKey: ["/api/platform-settings/public"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform-settings/public");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });
  const nameRevealThreshold = platformSettings?.nameRevealThreshold ?? "submitted";

  // ─── Data queries ─────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery<ClientProfile>({
    queryKey: ["/api/client-profile/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client-profile/me");
      return res.json();
    },
  });

  const { data: msaStatus, refetch: refetchMsaStatus } = useQuery<{
    accepted: boolean;
    acceptedAt: string | null;
    version: string | null;
    currentVersion: string;
    termsUrl: string;
  }>({
    queryKey: ["/api/client/msa-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/msa-status");
      return res.json();
    },
  });

  const acceptMsaMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/client/msa-acceptance", { accepted: true }),
    onSuccess: () => {
      refetchMsaStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/client-profile/me"] });
      toast({ title: "Terms accepted", description: "You can now send talent invitations." });
    },
    onError: (err: any) => toast({ title: "Could not save acceptance", description: err.message, variant: "destructive" }),
  });

  const { data: jobs = [], isLoading: jobsLoading, isError: jobsError, refetch: refetchJobs } = useQuery<Job[]>({
    queryKey: ["/api/client/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/jobs");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const { data: submissions = [], isLoading: submissionsLoading, isError: submissionsError, refetch: refetchSubmissions } = useQuery<JobSubmission[]>({
    queryKey: ["/api/client/job-submissions"],
    queryFn: async () => (await apiRequest("GET", "/api/client/job-submissions")).json(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<ClientProfile>) =>
      apiRequest("PUT", "/api/client-profile/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-profile/me"] });
      toast({ title: "Profile updated" });
      setEditing(false);
    },
    onError: (err: any) =>
      toast({ title: "Failed to save profile", description: err.message, variant: "destructive" }),
  });

  // ─── Edit handlers ────────────────────────────────────────────────────────
  const startEdit = () => {
    setForm({
      companyName: profile?.companyName ?? "",
      contactPerson: profile?.contactPerson ?? "",
      email: profile?.email ?? "",
      phoneNumber: profile?.phoneNumber ?? "",
      website: profile?.website ?? "",
      industry: profile?.industry ?? "",
      companySize: profile?.companySize ?? "",
      location: profile?.location ?? "",
      timezone: profile?.timezone ?? "",
      about: profile?.about ?? "",
      hiringNeeds: profile?.hiringNeeds ?? "",
    });
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => updateProfileMutation.mutate(form);
  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const openJobs = jobs.filter((j) => j.status === "open");
  const approvalOf = (job: Job) =>
    (job as any).approvalStatus ?? (job as any).approval_status ?? "pending";
  const recentJobs = [...jobs].sort((a, b) => new Date((b as any).createdAt ?? (b as any).created_at ?? 0).getTime() - new Date((a as any).createdAt ?? (a as any).created_at ?? 0).getTime()).slice(0, 3);
  const uniqueSubmissions = Array.from(new Map(submissions.map((submission) => [submission.id, submission])).values());
  const recentSubmissions = [...uniqueSubmissions].sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()).slice(0, 3);
  const companyName = profile?.companyName || "My Company";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060816]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#0f172a] relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#474ead]/25 blur-[90px]" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-indigo-600/20 blur-[70px]" />

        <div className="relative mx-auto max-w-5xl px-6 pb-10 pt-8 md:px-10">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/hire-talent">
              <button className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" />
                Hire Talent
              </button>
            </Link>
            <span className="rounded-full bg-[#474ead]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#7c82d4]">
              Client
            </span>
            <Link href="/messages">
              <button className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
                <MessageSquare className="h-3.5 w-3.5" />
                Messages
                {unreadMessagesCount > 0 && (
                  <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                  </span>
                )}
              </button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#474ead]/20 border border-[#474ead]/30">
                <Building2 className="h-8 w-8 text-[#7c82d4]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  {profileLoading ? (
                    <Skeleton className="h-8 w-48 bg-white/10" />
                  ) : (
                    companyName
                  )}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {profile?.industry || "Client Account"}
                  {profile?.location && ` · ${profile.location}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-4 mr-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{openJobs.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Open</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{jobs.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Jobs</p>
                </div>
              </div>
              <Link href="/client/job-postings" className="inline-flex h-10 items-center rounded-md bg-[#474ead] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#3d439c]">
                <Briefcase className="mr-2 h-4 w-4" />Manage Job Postings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 space-y-8">

        {/* ── Profile Details Card ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#474ead]" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Company Profile
              </h2>
            </div>
            {!editing ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/contracts")}>
                  <FileText className="w-3.5 h-3.5 mr-1.5" />Contracts
                </Button>
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Edit Profile
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                  onClick={saveEdit}
                  disabled={updateProfileMutation.isPending}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {updateProfileMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ProfileField icon={Building2} label="Company" value={profile?.companyName} />
                <ProfileField icon={User} label="Contact Person" value={profile?.contactPerson} />
                <ProfileField icon={Mail} label="Email" value={profile?.email} />
                <ProfileField icon={Phone} label="Phone" value={profile?.phoneNumber} />
                <ProfileField icon={Globe} label="Website" value={profile?.website} />
                <ProfileField icon={Briefcase} label="Industry" value={profile?.industry} />
                <ProfileField icon={Users} label="Company Size" value={profile?.companySize} />
                <ProfileField icon={MapPin} label="Location" value={profile?.location} />
                <ProfileField icon={Clock} label="Timezone" value={profile?.timezone} />
                {profile?.about && (
                  <div className="sm:col-span-2">
                    <ProfileField icon={Building2} label="About" value={profile.about} />
                  </div>
                )}
                {profile?.hiringNeeds && (
                  <div className="sm:col-span-2">
                    <ProfileField icon={Briefcase} label="Hiring Needs" value={profile.hiringNeeds} />
                  </div>
                )}
                {(!profile?.companyName && !profile?.about) && (
                  <div className="sm:col-span-2 py-6 text-center text-sm text-slate-400">
                    Your profile is empty — click &ldquo;Edit Profile&rdquo; to add your company details.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: "companyName", label: "Company Name", placeholder: "Your company name" },
                  { key: "contactPerson", label: "Contact Person", placeholder: "Full name" },
                  { key: "email", label: "Business Email", placeholder: "hello@yourcompany.com" },
                  { key: "phoneNumber", label: "Phone Number", placeholder: "+1 555 000 0000" },
                  { key: "website", label: "Website", placeholder: "https://yourcompany.com" },
                  { key: "industry", label: "Industry", placeholder: "Technology, Healthcare…" },
                  { key: "companySize", label: "Company Size", placeholder: "1–10, 11–50, 51–200, 200+" },
                  { key: "location", label: "Location / Country", placeholder: "New York, US" },
                  { key: "timezone", label: "Timezone", placeholder: "America/New_York" },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium">{label}</Label>
                    <Input
                      value={(form as any)[key] ?? ""}
                      onChange={field(key)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">About the Company</Label>
                  <Textarea
                    rows={3}
                    value={form.about ?? ""}
                    onChange={field("about")}
                    placeholder="Brief description of your company and what you do…"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">Hiring Needs</Label>
                  <Textarea
                    rows={2}
                    value={form.hiringNeeds ?? ""}
                    onChange={field("hiringNeeds")}
                    placeholder="What roles are you typically hiring for?"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── MSA acceptance ───────────────────────────────────────────────── */}
        <Card className={msaStatus?.accepted ? "border-emerald-200 dark:border-emerald-800/40" : "border-amber-200 dark:border-amber-800/40"}>
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {msaStatus?.accepted ? "Terms of Service accepted" : "Terms of Service acceptance required"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {msaStatus?.accepted
                  ? `Accepted${msaStatus.acceptedAt ? ` on ${new Date(msaStatus.acceptedAt).toLocaleDateString()}` : ""} · Version ${msaStatus.version ?? msaStatus.currentVersion}`
                  : "Accept the current terms before sending your first talent invitation."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={msaStatus?.termsUrl ?? "/terms-and-conditions"} target="_blank">
                <Button variant="outline" size="sm">Read Terms <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Button>
              </Link>
              {!msaStatus?.accepted && (
                <Button size="sm" className="bg-[#474ead] text-white hover:bg-[#3d439c]" onClick={() => acceptMsaMutation.mutate()} disabled={acceptMsaMutation.isPending}>
                  {acceptMsaMutation.isPending ? "Saving…" : "Accept Terms"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <section data-testid="client-jobs-preview" aria-labelledby="profile-jobs-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="profile-jobs-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Briefcase className="h-5 w-5 text-[#474ead]" />Job Postings</h2>
              <p className="mt-1 text-sm text-slate-500">{jobs.length} total · {openJobs.length} open · {jobs.filter((job) => job.status !== "draft" && approvalOf(job) === "pending").length} pending</p>
            </div>
            <Link href="/client/job-postings" className="text-sm font-semibold text-[#474ead] hover:underline">View All Job Postings <span aria-hidden="true">→</span></Link>
          </div>
          {jobsError ? <div role="alert" className="text-sm text-slate-600">Job postings could not be loaded. <Button variant="ghost" onClick={() => refetchJobs()}>Retry</Button></div> : jobsLoading ? <div className="space-y-2">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : recentJobs.length ? (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {recentJobs.map((job) => <div key={job.id} data-testid={`client-job-${job.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{job.title}</span>
                <span className="text-xs text-slate-500">{job.status === "open" ? "Open" : job.status === "draft" ? "Draft" : job.status === "closed" ? "Closed" : job.status}{((job as any).createdAt ?? (job as any).created_at) && ` · ${new Date((job as any).createdAt ?? (job as any).created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</span>
              </div>)}
            </div>
          ) : <p className="text-sm text-slate-500">No job postings yet.</p>}
        </section>

        <section data-testid="client-submissions-preview" aria-labelledby="profile-submissions-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="profile-submissions-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Inbox className="h-5 w-5 text-[#474ead]" />Job Submissions</h2>
              <p className="mt-1 text-sm text-slate-500">{uniqueSubmissions.length} applications · {uniqueSubmissions.filter((submission) => submission.status === "new").length} new · {uniqueSubmissions.filter((submission) => submission.status === "shortlisted").length} shortlisted</p>
            </div>
            <Link href="/client/job-submissions" className="text-sm font-semibold text-[#474ead] hover:underline">View All Submissions <span aria-hidden="true">→</span></Link>
          </div>
          {submissionsError ? <div role="alert" className="text-sm text-slate-600">Applications could not be loaded. <Button variant="ghost" onClick={() => refetchSubmissions()}>Retry</Button></div> : submissionsLoading ? <div className="space-y-2">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : recentSubmissions.length ? (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {recentSubmissions.map((submission) => <div key={submission.id} data-testid={`client-application-${submission.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{maskSubmissionName(submission.applicantName, submission.initiated_by, submission.status, nameRevealThreshold, isInvitationPending(submission))}</p><p className="truncate text-xs text-slate-500">{submission.jobTitle}</p></div>
                <span className="text-xs text-slate-500">{SUBMISSION_STATUS_LABELS[submission.status]?.label ?? submission.status}</span>
              </div>)}
            </div>
          ) : <p className="text-sm text-slate-500">No applications yet.</p>}
        </section>

        {/* ── Footer info ──────────────────────────────────────────────────── */}
        {profile?.createdAt && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pb-4">
            <Calendar className="h-3.5 w-3.5" />
            Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Job Submissions Section ──────────────────────────────────────────────────
export function JobSubmissionsSection({
  onView,
  onExtendOffer,
  requestedApplicationId,
  requestedInterviewId,
  nameRevealThreshold = "submitted",
  workspace = false,
}: {
  onView: (sub: JobSubmission) => void;
  onExtendOffer: (sub: JobSubmission) => void;
  requestedApplicationId: string | null;
  requestedInterviewId: string | null;
  nameRevealThreshold?: string;
  workspace?: boolean;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: rawSubmissions = [], isLoading, isError, refetch } = useQuery<JobSubmission[]>({
    queryKey: ["/api/client/job-submissions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/job-submissions");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const submissions = Array.from(new Map(rawSubmissions.map((submission) => [submission.id, submission])).values());
  const [searchText, setSearchText] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const openedDeepLink = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedApplicationId || isLoading || openedDeepLink.current === requestedApplicationId) return;
    const submission = submissions.find((item) => item.id === requestedApplicationId);
    if (submission) {
      openedDeepLink.current = requestedApplicationId;
      onViewRef.current(submission);
    }
  }, [requestedApplicationId, isLoading, submissions]);
  const deepLinkUnavailable = !!requestedApplicationId && !isLoading &&
    !submissions.some((item) => item.id === requestedApplicationId);
  const { data: messageThreadData } = useQuery<{
    threads: Array<{ jobId: string | null; unreadCount: number }>;
  }>({
    queryKey: ["my-message-threads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/message-threads");
      return res.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const unreadByJobId = new Map(
    (messageThreadData?.threads ?? [])
      .filter((thread) => thread.jobId)
      .map((thread) => [thread.jobId as string, thread.unreadCount]),
  );
  const filteredSubmissions = submissions
    .filter((sub) => {
      const query = searchText.trim().toLowerCase();
      const maskedApplicant = maskSubmissionName(sub.applicantName, sub.initiated_by, sub.status, nameRevealThreshold, isInvitationPending(sub)).toLowerCase();
      const matchesSearch = !query || maskedApplicant.includes(query) || sub.jobTitle.toLowerCase().includes(query);
      const matchesJob = jobFilter === "all" || sub.jobId === jobFilter;
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "under_review" ? ["under_review", "reviewed"].includes(sub.status) : sub.status === statusFilter);
      return matchesSearch && matchesJob && matchesStatus;
    })
    .sort((a, b) => {
      const delta = new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime();
      return sortOrder === "newest" ? -delta : delta;
    });
  const pageCount = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize));
  const pageSubmissions = filteredSubmissions.slice((page - 1) * pageSize, page * pageSize);
  const summaryCounts = {
    total: submissions.length,
    new: submissions.filter((sub) => sub.status === "new").length,
    underReview: submissions.filter((sub) => ["under_review", "reviewed"].includes(sub.status)).length,
    shortlisted: submissions.filter((sub) => sub.status === "shortlisted").length,
    rejected: submissions.filter((sub) => sub.status === "rejected").length,
  };
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const openingMessageRef = useRef(false);
  const openMessageMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/message-thread`);
      const data = await res.json() as { threadId?: string };
      if (typeof data.threadId !== "string" || !data.threadId.trim()) {
        throw new Error("The conversation could not be opened. Please try again.");
      }
      return { threadId: data.threadId };
    },
    onSuccess: ({ threadId }) => {
      queryClient.invalidateQueries({ queryKey: ["my-message-threads"] });
      navigate(`/messages/${encodeURIComponent(threadId)}`);
    },
    onError: (error: Error) => {
      let description = "The conversation could not be opened. Please try again.";
      const responseBody = error.message.match(/^\d{3}:\s*([\s\S]*)$/)?.[1];
      if (responseBody) {
        try {
          const body = JSON.parse(responseBody);
          if (typeof body.error === "string") {
            description = typeof body.message === "string" ? body.message : body.error;
          }
        } catch { /* Non-JSON infrastructure errors use the safe default. */ }
      } else if (error.message === "The conversation could not be opened. Please try again.") {
        description = error.message;
      }
      toast({
        title: "Unable to open conversation",
        description,
        variant: "destructive",
      });
    },
    onSettled: () => { openingMessageRef.current = false; },
  });

  return (
    <div>
      {workspace && (
        <>
          <section aria-label="Application counts" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([
              ["total", "Total Applications", summaryCounts.total],
              ["new", "New Applications", summaryCounts.new],
              ["under-review", "Under Review", summaryCounts.underReview],
              ["shortlisted", "Shortlisted", summaryCounts.shortlisted],
              ["rejected", "Rejected", summaryCounts.rejected],
            ] as const).map(([key, label, count]) => (
              <div key={key} data-testid={`submissions-count-${key}`} data-value={count} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-slate-900/60">
                <p className="text-xl font-semibold text-slate-900 dark:text-white">{count}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
              </div>
            ))}
          </section>
          <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/[0.08] dark:bg-slate-900/60">
            <Input aria-label="Search applications by applicant or job title" placeholder="Search applicant or job title" value={searchText} onChange={(event) => { setSearchText(event.target.value); setPage(1); }} data-testid="input-submission-search" />
            <Select value={jobFilter} onValueChange={(value) => { setJobFilter(value); setPage(1); }}>
              <SelectTrigger aria-label="Filter applications by job posting" data-testid="select-submission-job"><SelectValue placeholder="All job postings" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All job postings</SelectItem>
                {Array.from(new Map(submissions.map((sub) => [sub.jobId, sub.jobTitle])).entries()).map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger aria-label="Filter applications by status" data-testid="select-submission-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="contract_sent">Contract sent</SelectItem>
                <SelectItem value="contract_signed">Contract signed · deposit due</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
                {Object.entries(SUBMISSION_STATUS_LABELS).filter(([status]) => !["new", "reviewed", "under_review", "shortlisted", "rejected", "contract_sent", "contract_signed", "hired"].includes(status)).map(([status, info]) => <SelectItem key={status} value={status}>{info.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(value: "newest" | "oldest") => { setSortOrder(value); setPage(1); }}>
              <SelectTrigger aria-label="Sort applications by date" data-testid="select-submission-sort"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent>
            </Select>
          </div>
        </>
      )}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <Inbox className="h-5 w-5 text-[#474ead]" />
          Job Submissions
          {submissions.length > 0 && (
            <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
              {submissions.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {submissions.length > 0 && (() => {
            const invitedCount = submissions.filter((s) => s.initiated_by === "client").length;
            const appliedCount = submissions.filter((s) => s.initiated_by !== "client").length;
            return (
              <>
                {invitedCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">
                    {invitedCount} invited
                  </span>
                )}
                {appliedCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {appliedCount} applied
                  </span>
                )}
              </>
            );
          })()}
          {submissions.filter((s) => s.status === "new").length > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
              {submissions.filter((s) => s.status === "new").length} new
            </span>
          )}
        </div>
      </div>

      {deepLinkUnavailable && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This application or interview is unavailable, or is not associated with your account.
        </p>
      )}
      {isError ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center">
          <p role="alert" className="mb-4 text-sm text-slate-600 dark:text-slate-300">Applications could not be loaded. Please retry.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3" aria-label="Loading applications">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (workspace ? filteredSubmissions.length === 0 : submissions.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead]/10">
              <Inbox className="h-7 w-7 text-[#474ead]" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
              {submissions.length && workspace ? "No applications match these filters" : "No submissions yet"}
            </h3>
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              {submissions.length && workspace ? "Adjust your search or filters to see applications." : "Applications submitted via your Built-in Form jobs will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Applicant</th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:table-cell">Position</th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 md:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {pageSubmissions.map((sub) => {
                const statusInfo = SUBMISSION_STATUS_LABELS[sub.status] ?? SUBMISSION_STATUS_LABELS.new;
                const clientInvited = sub.initiated_by === "client";
                const pendingInvite = sub.status === "invited";
                return (
                  <tr
                    key={sub.id}
                    data-testid={`client-application-${sub.id}`}
                    className={`transition-colors ${
                      pendingInvite
                        ? "bg-indigo-50/60 hover:bg-indigo-50 dark:bg-indigo-900/[0.08] dark:hover:bg-indigo-900/[0.14]"
                        : "bg-white hover:bg-slate-50/60 dark:bg-transparent dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {maskSubmissionName(sub.applicantName, sub.initiated_by, sub.status, nameRevealThreshold, isInvitationPending(sub))}
                        </p>
                        {clientInvited && (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            You invited
                          </span>
                        )}
                      </div>
                        {isPendingOrDeclinedInvite(sub.initiated_by, sub.status, isInvitationPending(sub)) ? (
                        <p className="text-[10px] text-slate-400 italic">
                          {sub.status === "declined" ? "Invitation declined" : "Name and email reveal when talent accepts"}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">{sub.email}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <p className="text-slate-700 dark:text-slate-300">{sub.jobTitle}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                      {sub.submittedAt
                        ? new Date(sub.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {pendingInvite && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            Pending response
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {sub.hiringPipelineEligible && OFFERABLE_STATUSES.has(sub.status) && !isPendingOrDeclinedInvite(sub.initiated_by, sub.status, isInvitationPending(sub)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs border-[#474ead]/40 text-[#474ead] hover:bg-[#474ead]/5"
                            onClick={() => onExtendOffer(sub)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Ready for Offer</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          aria-label={`Message applicant for ${sub.jobTitle}`}
                          disabled={openMessageMutation.isPending}
                          onClick={() => {
                            if (openingMessageRef.current) return;
                            openingMessageRef.current = true;
                            openMessageMutation.mutate(sub.id);
                          }}
                          data-testid={`button-message-submission-${sub.id}`}
                        >
                          {openMessageMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">
                            {openMessageMutation.isPending ? "Opening…" : "Message"}
                          </span>
                          {(unreadByJobId.get(sub.jobId) ?? 0) > 0 && (
                            <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                              {(unreadByJobId.get(sub.jobId) ?? 0) > 99 ? "99+" : unreadByJobId.get(sub.jobId)}
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => onView(sub)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {workspace && filteredSubmissions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Showing {Math.min((page - 1) * pageSize + 1, filteredSubmissions.length)}–{Math.min(page * pageSize, filteredSubmissions.length)} of {filteredSubmissions.length}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} data-testid="button-submissions-previous">Previous</Button>
            <span className="text-xs text-slate-500" aria-live="polite">Page {page} of {pageCount}</span>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} data-testid="button-submissions-next">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reveal logic is shared with the server — see shared/submissionStatuses.ts.
import { revealedStatusesForThreshold } from "@shared/submissionStatuses";
function maskSubmissionName(
  name: string | null | undefined,
  initiatedBy: string | null,
  status: string,
  threshold = "submitted",
  invitationPending = false,
): string {
  // Older genuine applications may not have applicant_name populated. Keep
  // both rendering and masked-name search usable without revealing other data.
  if (!name?.trim()) return "Talent Profile";
  if (initiatedBy !== "client" && initiatedBy !== "client_invitation") return name;
  if (invitationPending || status === "invited" || status === "declined") {
    return name.toLowerCase().startsWith("invited ") ? "Talent Profile" : `${name.trim().split(/\s+/)[0]} ${name.trim().split(/\s+/)[1]?.[0] ?? ""}.`;
  }
  // Reveal only once talent's status meets or exceeds the configured threshold
  if (revealedStatuses(threshold).has(status)) return name;
  // Mask for "invited" (pending), "declined" (rejected), or pre-threshold statuses
  if (!name || name.toLowerCase().startsWith("invited ")) return "Talent Profile";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0] + "•".repeat(4);
  return parts[0] + " " + (parts[1]?.[0] ?? "") + ".";
}

/**
 * Returns true when a client-invited submission is still pending or was declined.
 * Used to gate status-transition UI and identity field visibility — always based
 * on the actual invite state, never on the name-reveal threshold.
 */
function isInvitationPending(submission: Pick<JobSubmission, "invitationPending" | "invitation_pending" | "combinedInviteReveal" | "status">): boolean {
  return submission.invitationPending === true
    || submission.invitation_pending === true
    || (submission.combinedInviteReveal === true && submission.status === "shortlisted");
}

function isPendingOrDeclinedInvite(initiatedBy: string | null, status: string, invitationPending = false): boolean {
  if (initiatedBy !== "client" && initiatedBy !== "client_invitation") return false;
  return invitationPending || status === "invited" || status === "declined";
}

function revealedStatuses(threshold: string): Set<string> {
  return revealedStatusesForThreshold(threshold);
}

export function ExtendOfferDialog({
  submission,
  onClose,
  onOfferSent,
}: {
  submission: JobSubmission;
  onClose: () => void;
  onOfferSent: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const onboarding = useContractorOnboarding(submission.id);
  const [rate, setRate] = useState("");
  const rateCurrency = "USD";
  const [proposedStartDate, setProposedStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [stageOverrideReason, setStageOverrideReason] = useState("");
  const [lastResult, setLastResult] = useState<{ rate_below_expectation?: boolean | null; rate_delta?: string | null } | null>(null);
  const hiringSettings = useQuery<{ preOfferPaymentRequired: boolean }>({
    queryKey: ["/api/hiring-payment-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/hiring-payment-settings");
      if (!response.ok) throw new Error("Hiring payment settings unavailable");
      return response.json();
    },
    retry: false,
  });
  const hiringSettingsLoaded = !hiringSettings.isError && hiringSettings.data?.preOfferPaymentRequired !== undefined;
  const paymentSkip=usePaymentSkip(submission.id);
  const hasPaymentSkip=!!paymentSkip.data?.waiver;
  const preOfferPaymentRequired = !hiringSettingsLoaded || hiringSettings.data?.preOfferPaymentRequired !== false;
  const { data: hiringInvoices = [], isLoading: hiringInvoicesLoading, isError: hiringInvoicesError, refetch: refetchHiringInvoices } = useQuery<HiringInvoice[]>({
    queryKey: ["/api/client/hiring-invoices", submission.id],
    queryFn: async () => (await apiRequest("GET", `/api/client/hiring-invoices?submissionId=${encodeURIComponent(submission.id)}`)).json(),
    refetchInterval: 30_000,
  });
  const invoiceVerified = hiringInvoices.some((invoice) => invoice.submission_id === submission.id && invoice.status === "paid" && Boolean(invoice.verified_at));
  const offerPaymentGateReady = hiringSettingsLoaded
    && (!preOfferPaymentRequired || hasPaymentSkip || (!hiringInvoicesLoading && !hiringInvoicesError && invoiceVerified));
  const onboardingOfferGateReady = isContractorOfferAllowed(onboarding.data);

  // Load prior offers for this submission
  const { data: priorOffers = [], isLoading: offersLoading } = useQuery<OfferRecord[]>({
    queryKey: ["/api/client/offers", submission.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/client/offers?submissionId=${submission.id}`);
      return res.json();
    },
  });

  const offerMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        submissionId: submission.id,
        rate: parseFloat(rate),
        rateCurrency: rateCurrency.trim().toUpperCase(),
      };
      if (proposedStartDate) body.proposedStartDate = proposedStartDate;
      if (expiresAt) body.expiresAt = expiresAt;
      if (notes.trim()) body.notes = notes.trim();
      if (user?.role === "admin" && stageOverrideReason.trim()) body.stageOverrideReason = stageOverrideReason.trim();
      const res = await apiRequest("POST", "/api/client/offers", body);
      if (!res.ok) {
        const data = await res.json();
        // Map known error codes to human-readable messages
        const errorMessages: Record<string, string> = {
          offer_already_pending: "An offer is already awaiting this talent's response. Wait for them to respond before sending another.",
          cannot_extend_offer:   `An offer cannot be extended for a submission in "${submission.status}" status.`,
          job_missing_engagement_type: "This job is missing an engagement type. Please set it before extending an offer.",
        };
        throw new Error(errorMessages[data.error] ?? data.message ?? data.error ?? "Failed to send offer");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLastResult({ rate_below_expectation: data.rate_below_expectation, rate_delta: data.rate_delta });
      queryClient.invalidateQueries({ queryKey: ["/api/client/offers", submission.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] });
      toast({ title: "Offer sent", description: "The talent will be notified." });
      onOfferSent();
    },
    onError: (err: any) => {
      const detail = String(err?.message || "");
      const description = detail.includes("PRE_OFFER_PAYMENT_REQUIRED")
        ? "Payment verification is no longer current for this hiring attempt. Refresh the invoice status and verify the matching invoice before sending."
        : detail.includes("409")
          ? "The offer could not be sent because the application or payment state changed. Refresh and review the current hiring invoice status."
          : detail;
      refetchHiringInvoices();
      toast({ title: "Could not send offer", description: description || "Please try again.", variant: "destructive" });
    },
  });

  const counterResponseMutation = useMutation({
    mutationFn: async ({ offerId, action, payload = {} }: { offerId: string; action: "accept" | "decline" | "counter"; payload?: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/client/offers/${offerId}/respond`, { action, ...payload });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Could not update the counter offer");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/offers", submission.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] });
      toast({
        title: variables.action === "accept" ? "Counter offer accepted" : variables.action === "decline" ? "Counter offer declined" : "Counter offer sent",
        description: variables.action === "counter" ? "The talent will be notified of your revised terms." : undefined,
      });
    },
    onError: (err: any) => toast({ title: "Could not update counter offer", description: err.message, variant: "destructive" }),
  });

  const respondToCounter = (offer: OfferRecord, action: "accept" | "decline" | "counter") => {
    if (action !== "counter") {
      counterResponseMutation.mutate({ offerId: offer.id, action });
      return;
    }
    const nextRate = window.prompt("Enter a new revised rate in USD. The existing offer amount is not copied.");
    if (!nextRate || Number.isNaN(Number(nextRate)) || Number(nextRate) <= 0) return;
    counterResponseMutation.mutate({
      offerId: offer.id,
      action,
      payload: {
        counterRate: Number(nextRate),
        counterRateCurrency: "USD",
      },
    });
  };

  const formatOfferDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const offerStatusLabel: Record<string, string> = {
    sent:     "Sent",
    accepted: "Accepted",
    declined: "Declined",
    expired:  "Expired",
    voided:   "Voided",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#474ead]" />
            Extend an Offer
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            For <span className="font-medium text-slate-700 dark:text-slate-200">{submission.applicantName}</span>
            {" — "}{submission.jobTitle}
            {submission.jobEngagementType && (
              <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {submission.jobEngagementType}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {!hiringSettingsLoaded && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Checking the current hiring-payment policy. Offer sending stays locked until that policy is confirmed.</div>}
          {hiringSettings.isError && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Hiring-payment policy could not be confirmed. Offer sending remains unavailable. <Button variant="outline" size="sm" onClick={() => hiringSettings.refetch()}>Retry</Button></div>}
          {hiringSettings.isError&&<p role="alert" className="rounded border border-amber-200 p-3 text-sm">Couldn't check payment policy — <button className="underline" onClick={()=>hiringSettings.refetch()}>Retry</button></p>}
          {preOfferPaymentRequired&&!hasPaymentSkip && <ClientHiringPaymentPanel submissionId={submission.id} />}
          <PaymentVerificationCard submissionId={submission.id} client />
          {preOfferPaymentRequired && hiringInvoicesError && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Invoice payment status could not be confirmed. The offer action stays locked. <Button variant="outline" size="sm" onClick={() => refetchHiringInvoices()}>Retry</Button></div>}
          {/* Rate row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="offer-rate" className="text-xs font-semibold">Rate <span className="text-red-500">*</span></Label>
              <Input
                id="offer-rate"
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 50000"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="w-28">
              <Label htmlFor="offer-currency" className="text-xs font-semibold">Currency</Label>
              <div id="offer-currency" className="mt-1 flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm" data-testid="offer-currency">
                USD ($)
              </div>
            </div>
          </div>

          {/* Engagement type (read-only) */}
          {submission.jobEngagementType && (
            <div>
              <Label className="text-xs font-semibold">Engagement Type</Label>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{submission.jobEngagementType}</p>
            </div>
          )}

          {/* Dates */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="offer-start" className="text-xs font-semibold">Proposed Start Date</Label>
              <Input
                id="offer-start"
                type="date"
                value={proposedStartDate}
                onChange={(e) => setProposedStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="offer-expiry" className="text-xs font-semibold">Offer Expiry</Label>
              <Input
                id="offer-expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="offer-notes" className="text-xs font-semibold">Notes</Label>
            <Textarea
              id="offer-notes"
              rows={3}
              placeholder="Any additional details for the talent…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 resize-none"
            />
          </div>
          {user?.role === "admin" && <div>
            <Label htmlFor="offer-stage-override" className="text-xs font-semibold">Super Admin stage override reason</Label>
            <Textarea id="offer-stage-override" rows={2} maxLength={1200} placeholder="Leave blank for the standard flow. A Super Admin must provide a written reason to override a stage gate." value={stageOverrideReason} onChange={(event) => setStageOverrideReason(event.target.value)} className="mt-1 resize-none" />
          </div>}

          {/* Rate expectation result banner */}
          {lastResult && lastResult.rate_below_expectation !== null && lastResult.rate_below_expectation !== undefined && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${
              lastResult.rate_below_expectation
                ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300"
            }`}>
              {lastResult.rate_below_expectation ? (
                <>
                  <p className="font-semibold">Rate is below the talent's expectation</p>
                  {lastResult.rate_delta && (
                    <p className="text-xs mt-0.5">
                      Difference: {formatCurrencyAmount(Math.abs(parseFloat(lastResult.rate_delta)), rateCurrency)}
                    </p>
                  )}
                </>
              ) : (
                <p className="font-semibold">Rate meets or exceeds the talent's expectation ✓</p>
              )}
            </div>
          )}

          {/* Prior offers */}
          {(offersLoading || priorOffers.length > 0) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Prior Offers</p>
              {offersLoading ? (
                <Skeleton className="h-12 w-full rounded-lg" />
              ) : (
                <div className="space-y-2">
                  {priorOffers.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-white/[0.06] dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrencyAmount(o.rate, o.rate_currency || "USD")}
                          {o.engagement_type && <span className="ml-1 text-slate-400">· {o.engagement_type}</span>}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          o.status === "accepted" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                          o.status === "declined" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" :
                          o.status === "sent" && o.expires_at && new Date(o.expires_at) < new Date() ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" :
                          o.status === "sent"     ? "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400" :
                          o.status === "expired"  ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" :
                          "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        }`}>
                          {o.status === "sent" && o.expires_at && new Date(o.expires_at) < new Date()
                            ? "Expired"
                            : offerStatusLabel[o.status] ?? o.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-slate-400 mt-0.5">
                        {o.proposed_start_date && <span>Start: {formatOfferDate(o.proposed_start_date)}</span>}
                        {o.expires_at && <span>Expires: {formatOfferDate(o.expires_at)}</span>}
                        <span>Sent: {formatOfferDate(o.sent_at ?? o.created_at)}</span>
                      </div>
                      {o.rate_below_expectation === true && (
                        <p className="mt-0.5 text-amber-600 dark:text-amber-400">Below expectation by {formatCurrencyAmount(Math.abs(parseFloat(o.rate_delta ?? "0")), o.rate_currency || "USD")}</p>
                      )}
                       {o.notes && <p className="mt-1 text-slate-500 italic line-clamp-2">{o.notes}</p>}
                       {(o.status === "expired" || (o.status === "sent" && !!o.expires_at && new Date(o.expires_at).getTime() <= Date.now())) && (
                         <OfferExpirationRenewal offerId={o.id} />
                       )}
                       {o.status === "sent" && o.proposer_role === "talent" && (!o.expires_at || new Date(o.expires_at) >= new Date()) && (
                         <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                           <span className="mr-auto text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">Talent counter offer — your response</span>
                           <Button size="sm" className="h-7 rounded-full bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-700" disabled={counterResponseMutation.isPending} onClick={() => respondToCounter(o, "accept")}>Accept</Button>
                           <Button size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px]" disabled={counterResponseMutation.isPending} onClick={() => respondToCounter(o, "counter")}>Counter</Button>
                           <Button size="sm" variant="outline" className="h-7 rounded-full border-red-200 px-3 text-[11px] text-red-600 hover:bg-red-50" disabled={counterResponseMutation.isPending} onClick={() => respondToCounter(o, "decline")}>Decline</Button>
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={offerMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => offerMutation.mutate()}
            disabled={offerMutation.isPending || !rate || !offerPaymentGateReady || onboarding.isLoading || !onboardingOfferGateReady}
            className="bg-[#474ead] hover:bg-[#3a3d8f] text-white"
          >
            {offerMutation.isPending ? "Sending…" : !onboardingOfferGateReady ? onboarding.data?.offerBlockers?.[0]??"Offer unavailable" : hiringSettings.isError ? "Couldn't check payment policy — Retry" : !hiringSettingsLoaded ? "Checking payment policy…" : preOfferPaymentRequired && !invoiceVerified && !hasPaymentSkip ? "Payment verification required" : "Send Offer"}
          </Button>
          {!onboarding.data?.offerAccepted&&onboarding.data?.policy === "deposit_first" && !onboarding.data.canSendOffer && <p role="status" className="text-xs text-amber-800">Offer unavailable: {onboarding.data.offerBlockers?.join(", ") || "a passed final interview is required"}.</p>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
