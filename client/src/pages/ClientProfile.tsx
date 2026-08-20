import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { buildRateDisplay, getTimeAgo } from "@/lib/jobUtils";
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Clock,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Save,
  X,
  Users,
  Calendar,
  FileText,
  Download,
  ChevronRight,
  Inbox,
  Search,
  MessageSquare,
  Loader2,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount";
import ApplicantEmailComposer from "@/components/ApplicantEmailComposer";

// ─── Name-masking helper ──────────────────────────────────────────────────────
interface JobSubmission {
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
  submittedAt: string;
  jobTitle: string;
  jobCompany: string | null;
  jobEngagementType: string | null;
  /** 'client' when the client invited this talent via Search & Shortlist; 'talent' for self-applied */
  initiated_by: string | null;
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
  rate_below_expectation: boolean | null;
  rate_delta: string | null;
  sent_at: string | null;
  created_at: string;
}
function ViewSubmissionModal({
  submission,
  onClose,
  onStatusChange,
  onExtendOffer,
  nameRevealThreshold = "submitted",
}: {
  submission: JobSubmission;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onExtendOffer: (sub: JobSubmission) => void;
  nameRevealThreshold?: string;
}) {
  const { toast } = useToast();
  const statusInfo = SUBMISSION_STATUS_LABELS[submission.status] ?? SUBMISSION_STATUS_LABELS.new;

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const statusEmailMutation = useMutation({
    mutationFn: (payload: {
      subject: string; bodyHtml: string; templateId: string; senderEmail: string;
    }) =>
      apiRequest("POST", `/api/client/job-submissions/${submission.id}/status-with-email`, {
        ...payload,
        updateStage: pendingStatus,
      }),
    onSuccess: () => {
      if (pendingStatus) onStatusChange(submission.id, pendingStatus);
      queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      toast({ title: "Application status updated and email sent" });
      setPendingStatus(null);
    },
    onError: (err: any) =>
      toast({ title: "Email could not be sent. Status was not changed.", description: err.message, variant: "destructive" }),
  });

  const handleResumeDownload = () => {
    if (!submission.resumeUrl) return;
    const resumeId = submission.resumeUrl.split("/").pop();
    window.open(`/api/job-resumes/${resumeId}`, "_blank");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Application Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Job info */}
          <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Position</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{submission.jobTitle}</p>
            {submission.jobCompany && <p className="text-xs text-slate-500">{submission.jobCompany}</p>}
          </div>

          {/* Status + update */}
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
            {!isPendingOrDeclinedInvite(submission.initiated_by, submission.status) && (
              <Select
                value={submission.status}
                onValueChange={setPendingStatus}
                disabled={statusEmailMutation.isPending}
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Update status" />
                </SelectTrigger>
                <SelectContent>
                  {/* Only include statuses the PATCH /api/client/job-submissions/:id/status
                      endpoint accepts (CLIENT_SETTABLE_STATUSES): under_review | reviewed |
                      shortlisted | rejected. 'hired' is reached only via the contract workflow. */}
                  {(["under_review", "reviewed", "shortlisted", "rejected"] as const).map((val) => (
                    <SelectItem key={val} value={val}>
                      {SUBMISSION_STATUS_LABELS[val]?.label ?? val}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Applicant details */}
          {isPendingOrDeclinedInvite(submission.initiated_by, submission.status) && (
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
                value: maskSubmissionName(submission.applicantName, submission.initiated_by, submission.status, nameRevealThreshold),
              },
              {
                label: "Email",
                value: isPendingOrDeclinedInvite(submission.initiated_by, submission.status)
                  ? null
                  : submission.email,
              },
              {
                label: "Phone",
                value: isPendingOrDeclinedInvite(submission.initiated_by, submission.status) ? null : submission.phone,
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

          {/* Extend Offer action */}
          {OFFERABLE_STATUSES.has(submission.status) && !isPendingOrDeclinedInvite(submission.initiated_by, submission.status) && (
            <div className="border-t border-slate-100 dark:border-white/[0.08] pt-4">
              <Button
                className="w-full gap-2 bg-[#474ead] hover:bg-[#3a3d8f] text-white"
                onClick={() => { onClose(); onExtendOffer(submission); }}
              >
                <FileText className="h-4 w-4" />
                Extend an Offer
              </Button>
            </div>
          )}
        </div>
        <ApplicantEmailComposer
          application={submission}
          open={!!pendingStatus}
          onClose={() => setPendingStatus(null)}
          pendingStatus={pendingStatus ? {
            previousStatus: submission.status,
            newStatus: pendingStatus,
          } : undefined}
          onRequestSend={statusEmailMutation.mutate}
          isSendingEmail={statusEmailMutation.isPending}
        />
      </DialogContent>
    </Dialog>
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
  createdAt: string;
}

// ─── Client job preview dialog ────────────────────────────────────────────────
// Shows the full details of a client-owned job regardless of its status.
// Uses data already loaded from GET /api/client/jobs (SELECT j.*) — no extra fetch.
// For open+approved jobs a "View public listing" link is also shown.
function ClientJobPreviewDialog({ job, onClose }: { job: Job | null; onClose: () => void }) {
  if (!job) return null;

  const pay = buildRateDisplay(job as any);
  const approvalStatus = (job as any).approvalStatus ?? "approved";
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
    { label: "Category",        value: (job as any).category },
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
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {(job as any).description}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Job row inside client profile ────────────────────────────────────────────
function ClientJobRow({
  job,
  onEdit,
  onToggle,
  onDelete,
  onView,
  isToggling,
  isDeleting,
}: {
  job: Job;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onView: () => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const isOpen = job.status === "open";
  const pay = buildRateDisplay(job as any);
  const timeAgo = getTimeAgo(job.createdAt);
  const approvalStatus = (job as any).approvalStatus ?? "approved";

  const approvalBadge = ({
    pending: { label: "Pending Approval", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
    approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    rejected: { label: "Declined", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
    linked_to_existing: { label: "Linked to Existing", className: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400" },
  } as Record<string, { label: string; className: string }>)[approvalStatus] ?? { label: approvalStatus, className: "bg-slate-100 text-slate-500" };

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-slate-900/60 transition-shadow hover:shadow-sm">
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
      <div className="flex flex-col gap-3 px-5 py-4 pl-7 sm:flex-row sm:items-center sm:justify-between">
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
              {isOpen ? "Open" : job.status === "closed" ? "Closed" : job.status}
            </span>
            {/* Approval status badge */}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${approvalBadge.className}`}>
              {approvalBadge.label}
            </span>
          </div>
          {/* Status messages */}
          {approvalStatus === "rejected" && (job as any).rejectionReason && (
            <p className="mb-1 text-xs text-red-600 dark:text-red-400">
              Reason: {(job as any).rejectionReason}
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
            <span className="capitalize">{job.category?.replace(/-/g, " ")}</span>
            <span className="text-slate-300 dark:text-white/20">·</span>
            <span>{job.location || "Remote"}</span>
            {pay && (
              <>
                <span className="text-slate-300 dark:text-white/20">·</span>
                <span className="font-medium text-[#474ead] dark:text-indigo-400">{pay}</span>
              </>
            )}
            <span className="text-slate-300 dark:text-white/20">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
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
          <Button variant="outline" size="sm" onClick={onToggle} disabled={isToggling}>
            {isOpen ? (
              <><EyeOff className="w-3 h-3 mr-1.5" />Close</>
            ) : (
              <><Eye className="w-3 h-3 mr-1.5" />Reopen</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3 h-3 mr-1.5" />Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-3 h-3 mr-1.5" />View
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" disabled={isDeleting}>
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
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const unreadMessagesCount = useUnreadMessagesCount();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ClientProfile>>({});
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<JobSubmission | null>(null);
  const [extendingOfferFor, setExtendingOfferFor] = useState<JobSubmission | null>(null);

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

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/client/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/jobs");
      return res.json();
    },
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

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/client/jobs/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
      toast({ title: "Job status updated" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" }),
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/client/jobs/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Failed to delete job");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
      toast({ title: "Job deleted" });
    },
    onError: (err: any) =>
      toast({ title: "Could not delete job", description: err.message, variant: "destructive" }),
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
  const closedJobs = jobs.filter((j) => j.status !== "open");
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
              <Button
                onClick={() => navigate("/client/jobs/new")}
                className="bg-[#474ead] text-white shadow-[0_4px_16px_rgba(71,78,173,0.4)] hover:bg-[#3d439c]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post a Job
              </Button>
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
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit Profile
              </Button>
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

        {/* ── Find Talent CTA ──────────────────────────────────────────────── */}
        <Card className="border-[#474ead]/30 bg-gradient-to-r from-[#474ead]/5 to-indigo-500/5 dark:from-[#474ead]/10 dark:to-indigo-500/10">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5 px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#474ead]/15 border border-[#474ead]/25">
                <Search className="h-5 w-5 text-[#474ead]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Search &amp; Shortlist Talent
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Browse and shortlist candidates from our talent pool.
                </p>
              </div>
            </div>
            <Link href="/client-search">
              <Button className="shrink-0 bg-[#474ead] text-white shadow-[0_4px_16px_rgba(71,78,173,0.3)] hover:bg-[#3d439c]">
                <Search className="w-4 h-4 mr-2" />
                Find Talent
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* ── Job Postings ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Briefcase className="h-5 w-5 text-[#474ead]" />
              Job Postings
              <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                {jobs.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {openJobs.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {openJobs.length} open
                </div>
              )}
              {closedJobs.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <XCircle className="h-3.5 w-3.5" />
                  {closedJobs.length} closed
                </div>
              )}
              <Button
                size="sm"
                className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                onClick={() => navigate("/client/jobs/new")}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Post a Job
              </Button>
            </div>
          </div>

          {jobsLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead]/10">
                  <Briefcase className="h-7 w-7 text-[#474ead]" />
                </div>
                <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
                  No job postings yet
                </h3>
                <p className="mb-5 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                  Post your first job to start finding talent on OnSpot.
                </p>
                <Button
                  className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                  onClick={() => navigate("/client/jobs/new")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Post Your First Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <ClientJobRow
                  key={job.id}
                  job={job}
                  onEdit={() => navigate(`/client/jobs/${job.id}/edit`)}
                  onToggle={() =>
                    toggleStatusMutation.mutate({
                      id: job.id,
                      status: job.status === "open" ? "closed" : "open",
                    })
                  }
                  onDelete={() => deleteJobMutation.mutate(job.id)}
                  onView={() => setViewingJob(job)}
                  isToggling={toggleStatusMutation.isPending}
                  isDeleting={deleteJobMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Job Submissions ───────────────────────────────────────────────── */}
        <JobSubmissionsSection
          onView={(sub) => setViewingSubmission(sub)}
          onExtendOffer={(sub) => setExtendingOfferFor(sub)}
          nameRevealThreshold={nameRevealThreshold}
        />

        {/* ── Footer info ──────────────────────────────────────────────────── */}
        {profile?.createdAt && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pb-4">
            <Calendar className="h-3.5 w-3.5" />
            Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
          </div>
        )}
      </div>

      {/* ── Job preview dialog (owner-aware — works for draft/closed/pending) ── */}
      <ClientJobPreviewDialog
        job={viewingJob}
        onClose={() => setViewingJob(null)}
      />

      {/* ── View Submission modal ─────────────────────────────────────────────── */}
      {viewingSubmission && (
        <ViewSubmissionModal
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
          onStatusChange={(id, status) =>
            setViewingSubmission((prev) => prev && prev.id === id ? { ...prev, status } : prev)
          }
          onExtendOffer={(sub) => setExtendingOfferFor(sub)}
          nameRevealThreshold={nameRevealThreshold}
        />
      )}

      {/* ── Extend Offer dialog ──────────────────────────────────────────────── */}
      {extendingOfferFor && (
        <ExtendOfferDialog
          submission={extendingOfferFor}
          onClose={() => setExtendingOfferFor(null)}
          onOfferSent={() => {
            setExtendingOfferFor(null);
            queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] });
          }}
        />
      )}
    </div>
  );
}

// ─── Job Submissions Section ──────────────────────────────────────────────────
function JobSubmissionsSection({
  onView,
  onExtendOffer,
  nameRevealThreshold = "submitted",
}: {
  onView: (sub: JobSubmission) => void;
  onExtendOffer: (sub: JobSubmission) => void;
  nameRevealThreshold?: string;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: submissions = [], isLoading } = useQuery<JobSubmission[]>({
    queryKey: ["/api/client/job-submissions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/job-submissions");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/client/job-submissions/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const openMessageMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/message-thread`);
      return res.json() as Promise<{ threadId: string }>;
    },
    onSuccess: ({ threadId }) => navigate(`/messages/${threadId}`),
    onError: () =>
      toast({
        title: "Unable to open conversation",
        description: "Please try again.",
        variant: "destructive",
      }),
  });

  return (
    <div>
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

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead]/10">
              <Inbox className="h-7 w-7 text-[#474ead]" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
              No submissions yet
            </h3>
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Applications submitted via your Built-in Form jobs will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <table className="w-full text-sm">
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
              {submissions.map((sub) => {
                const statusInfo = SUBMISSION_STATUS_LABELS[sub.status] ?? SUBMISSION_STATUS_LABELS.new;
                const clientInvited = sub.initiated_by === "client";
                const pendingInvite = sub.status === "invited";
                return (
                  <tr
                    key={sub.id}
                    className={`transition-colors ${
                      pendingInvite
                        ? "bg-indigo-50/60 hover:bg-indigo-50 dark:bg-indigo-900/[0.08] dark:hover:bg-indigo-900/[0.14]"
                        : "bg-white hover:bg-slate-50/60 dark:bg-transparent dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {maskSubmissionName(sub.applicantName, sub.initiated_by, sub.status, nameRevealThreshold)}
                        </p>
                        {clientInvited && (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            You invited
                          </span>
                        )}
                      </div>
                      {isPendingOrDeclinedInvite(sub.initiated_by, sub.status) ? (
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
                        {OFFERABLE_STATUSES.has(sub.status) && !isPendingOrDeclinedInvite(sub.initiated_by, sub.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs border-[#474ead]/40 text-[#474ead] hover:bg-[#474ead]/5"
                            onClick={() => onExtendOffer(sub)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Offer</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={openMessageMutation.isPending}
                          onClick={() => openMessageMutation.mutate(sub.id)}
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
    </div>
  );
}

// Reveal logic is shared with the server — see shared/submissionStatuses.ts.
import { revealedStatusesForThreshold } from "@shared/submissionStatuses";
function maskSubmissionName(
  name: string,
  initiatedBy: string | null,
  status: string,
  threshold = "submitted",
): string {
  if (initiatedBy !== "client") return name;
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
function isPendingOrDeclinedInvite(initiatedBy: string | null, status: string): boolean {
  if (initiatedBy !== "client") return false;
  // Only "invited" (pending) and "declined" are locked — all other statuses
  // mean the talent has actively accepted and the client may advance them.
  return status === "invited" || status === "declined";
}

function revealedStatuses(threshold: string): Set<string> {
  return revealedStatusesForThreshold(threshold);
}

function ExtendOfferDialog({
  submission,
  onClose,
  onOfferSent,
}: {
  submission: JobSubmission;
  onClose: () => void;
  onOfferSent: () => void;
}) {
  const { toast } = useToast();
  const [rate, setRate] = useState("");
  const [rateCurrency, setRateCurrency] = useState("PHP");
  const [proposedStartDate, setProposedStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [lastResult, setLastResult] = useState<{ rate_below_expectation?: boolean | null; rate_delta?: string | null } | null>(null);

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
      toast({ title: "Could not send offer", description: err.message, variant: "destructive" });
    },
  });

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
              <Input
                id="offer-currency"
                maxLength={3}
                placeholder="PHP"
                value={rateCurrency}
                onChange={(e) => setRateCurrency(e.target.value.toUpperCase())}
                className="mt-1 uppercase"
              />
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
                      Difference: {rateCurrency} {Math.abs(parseFloat(lastResult.rate_delta)).toLocaleString()}
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
                          {o.rate_currency} {parseFloat(o.rate).toLocaleString()}
                          {o.engagement_type && <span className="ml-1 text-slate-400">· {o.engagement_type}</span>}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          o.status === "accepted" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                          o.status === "declined" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" :
                          o.status === "sent"     ? "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400" :
                          o.status === "expired"  ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" :
                          "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        }`}>
                          {offerStatusLabel[o.status] ?? o.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-slate-400 mt-0.5">
                        {o.proposed_start_date && <span>Start: {formatOfferDate(o.proposed_start_date)}</span>}
                        {o.expires_at && <span>Expires: {formatOfferDate(o.expires_at)}</span>}
                        <span>Sent: {formatOfferDate(o.sent_at ?? o.created_at)}</span>
                      </div>
                      {o.rate_below_expectation === true && (
                        <p className="mt-0.5 text-amber-600 dark:text-amber-400">Below expectation by {o.rate_currency} {Math.abs(parseFloat(o.rate_delta ?? "0")).toLocaleString()}</p>
                      )}
                      {o.notes && <p className="mt-1 text-slate-500 italic line-clamp-2">{o.notes}</p>}
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
            disabled={offerMutation.isPending || !rate || !rateCurrency || rateCurrency.length !== 3}
            className="bg-[#474ead] hover:bg-[#3a3d8f] text-white"
          >
            {offerMutation.isPending ? "Sending…" : "Send Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
