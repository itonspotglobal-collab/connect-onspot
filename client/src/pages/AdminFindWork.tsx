import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BulkUploadModal } from "@/components/BulkUploadModal";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  ArrowLeft,
  Briefcase,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Star,
  Zap,
  Layers,
  BarChart3,
  Sparkles,
  Clock,
  BookOpen,
  Upload,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Building2,
  Link2,
  Search,
  ListFilter,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { getJobBadges, getTimeAgo, buildRateDisplay, buildRateDisplayWithCode } from "@/lib/jobUtils";
import { JobRichText } from "@/components/JobRichText";
import { ClientEmailComposer, type ClientEmailPayload } from "@/components/ClientEmailComposer";

// ─── Badge icon map ───────────────────────────────────────────────────────────
const BADGE_ICONS: Record<string, React.ElementType> = {
  "top-paying": Star,
  urgent: Zap,
  "multiple-slots": Layers,
};

// ─── Copy link hook ───────────────────────────────────────────────────────────
function useCopyLink() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  function copy(jobId: string) {
    const url = `${window.location.origin}/find-work/job/${jobId}`;
    navigator.clipboard?.writeText(url).catch(() => {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  }
  return { copiedId, copy };
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur-sm">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          accent ? "bg-[#474ead]" : "bg-white/10"
        }`}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">
          {label}
        </p>
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─── Approval status config ───────────────────────────────────────────────────
const APPROVAL_CONFIG: Record<string, { label: string; strip: string; badge: string }> = {
  pending: {
    label: "Pending Approval",
    strip: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    strip: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  rejected: {
    label: "Rejected",
    strip: "bg-red-400",
    badge: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  },
  linked_to_existing: {
    label: "Linked to Existing",
    strip: "bg-violet-400",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  },
};

// ─── Duplicate detection ──────────────────────────────────────────────────────
const ABBREVIATIONS: Record<string, string> = {
  "csr": "customer service representative",
  "customer service rep": "customer service representative",
  "va": "virtual assistant",
  "bpo": "business process outsourcing",
  "qa": "quality assurance",
  "pm": "project manager",
  "hr": "human resources",
  "it": "information technology",
  "dev": "developer",
  "seo": "search engine optimization",
  "smm": "social media manager",
  "smms": "social media manager",
};

function normalizeTitle(title: string): string {
  let s = title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    s = s.replace(new RegExp(`\\b${abbr}\\b`, "g"), full);
  }
  return s;
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1;
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  const intersection = Array.from(wa).filter(w => wb.has(w) && w.length > 2);
  const union = new Set([...Array.from(wa), ...Array.from(wb)]);
  return intersection.length / Math.max(union.size, 1);
}

type EnrichedJob = Job & {
  clientCompanyName?: string | null;
  clientContactName?: string | null;
};

function findDuplicates(job: EnrichedJob, allJobs: EnrichedJob[]): EnrichedJob[] {
  return allJobs.filter(
    (j) =>
      j.id !== job.id &&
      (j as any).approvalStatus === "approved" &&
      j.status === "open" &&
      titleSimilarity(job.title, j.title) >= 0.45,
  );
}

// ─── Tabs config ──────────────────────────────────────────────────────────────
type TabKey = "all" | "pending" | "approved" | "declined";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Jobs" },
  { key: "pending", label: "Pending Approvals" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
];

// ─── Admin job row ────────────────────────────────────────────────────────────
function AdminJobRow({
  job,
  onEdit,
  onToggle,
  onDelete,
  onCopy,
  onApprove,
  onReject,
  onMoveToPending,
  onRefresh,
  copiedId,
  isToggling,
  isDeleting,
  isApproving,
  isRejecting,
  isRefreshing,
}: {
  job: Job;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onApprove: () => void;
  onReject: () => void;
  onMoveToPending: () => void;
  onRefresh: () => void;
  copiedId: string | null;
  isToggling: boolean;
  isDeleting: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  isRefreshing: boolean;
}) {
  const badges = getJobBadges(job as any);
  const isOpen = job.status === "open";
  const pay = buildRateDisplayWithCode({ ...job, engagementType: job.engagementType ?? undefined });
  const timeAgo = getTimeAgo((job as any).postedAt || job.createdAt);
  const approvalStatus = (job as any).approvalStatus ?? "approved";
  const approvalCfg = APPROVAL_CONFIG[approvalStatus] ?? APPROVAL_CONFIG.pending;

  return (
    <div className="group relative rounded-2xl border border-slate-200/70 bg-white transition-shadow hover:shadow-md dark:border-white/[0.08] dark:bg-[#0f172a]/60">
      {/* Status strip — colour reflects approval state */}
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${approvalCfg.strip}`} />

      <div className="flex flex-col gap-4 px-6 py-5 pl-8 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {(job as any).professionalRoleName || job.title}
            </h3>
            {/* Job open/closed badge */}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isOpen
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/40"
              }`}
            >
              {isOpen ? "Open" : job.status === "closed" ? "Closed" : job.status}
            </span>
            {/* Approval badge */}
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${approvalCfg.badge}`}>
              {approvalCfg.label}
            </span>
            {/* Featured badge */}
            {(job as any).isFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Star className="h-2.5 w-2.5" /> Featured
              </span>
            )}
          </div>

          {/* Original role name */}
          {(job as any).originalRoleName && (
            <p className="mb-1 text-xs italic text-slate-500 dark:text-slate-400 truncate">
              Original: {(job as any).originalRoleName}
            </p>
          )}

          {/* Rejection reason */}
          {approvalStatus === "rejected" && (job as any).rejectionReason && (
            <p className="mb-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {(job as any).rejectionReason}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-500 dark:text-slate-400">
            <span className="capitalize">{((job as any).jobFunction || job.category)?.replace(/-/g, " ")}</span>
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

          {/* Auto badges */}
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b) => {
                const Icon = BADGE_ICONS[b.key];
                return (
                  <span
                    key={b.key}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${b.className}`}
                  >
                    {Icon && <Icon className="w-2.5 h-2.5" />}
                    {b.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* ── Approval actions ── */}
          {approvalStatus === "pending" && (
            <>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={onApprove}
                disabled={isApproving}
              >
                <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400"
                onClick={onReject}
                disabled={isRejecting}
              >
                <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                Reject
              </Button>
            </>
          )}
          {approvalStatus === "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-200 text-amber-700 hover:border-amber-400 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400"
              onClick={onMoveToPending}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Unapprove
            </Button>
          )}
          {approvalStatus === "rejected" && (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onApprove}
              disabled={isApproving}
            >
              <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
              Approve
            </Button>
          )}

          {/* ── Standard actions ── */}
          <Button variant="outline" size="sm" onClick={onToggle} disabled={isToggling}>
            {isOpen ? (
              <><EyeOff className="w-3.5 h-3.5 mr-1.5" />Close</>
            ) : (
              <><Eye className="w-3.5 h-3.5 mr-1.5" />Reopen</>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
          </Button>

          <Button variant="outline" size="sm" asChild>
            <a href={`/find-work/job/${job.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Preview
            </a>
          </Button>

          <Button variant="outline" size="sm" onClick={onCopy}>
            {copiedId === job.id ? (
              <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5 mr-1.5" />Share</>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                title="Reset posted date to today"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Refresh
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refresh posting date?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset &ldquo;{(job as any).professionalRoleName || job.title}&rdquo; so it appears as posted today on the job board. No other details will change.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRefresh}>Refresh Posting</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" disabled={isDeleting}>
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove job posting?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel &ldquo;{(job as any).professionalRoleName || job.title}&rdquo;. It will no longer appear on the Find Work page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Approval Card ────────────────────────────────────────────────────
function PendingApprovalCard({
  job,
  allJobs,
  onApprove,
  onReject,
  onLink,
  onView,
  isApproving,
  isRejecting,
}: {
  job: EnrichedJob;
  allJobs: EnrichedJob[];
  onApprove: () => void;
  onReject: () => void;
  onLink: () => void;
  onView: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const pay = buildRateDisplayWithCode({ ...job, engagementType: job.engagementType ?? undefined });
  const timeAgo = getTimeAgo(job.createdAt);
  const duplicates = findDuplicates(job, allJobs);
  const hasDuplicates = duplicates.length > 0;

  return (
    <div className={`relative rounded-2xl border bg-white dark:bg-[#0f172a]/60 transition-shadow hover:shadow-md ${hasDuplicates ? "border-amber-300 dark:border-amber-700/50" : "border-slate-200/70 dark:border-white/[0.08]"}`}>
      {/* Amber left strip */}
      <div className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-amber-400" />

      <div className="px-6 py-5 pl-8 space-y-4">
        {/* ── Header ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{job.title}</h3>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                Pending Approval
              </span>
              {hasDuplicates && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                  <AlertCircle className="h-3 w-3" />
                  Possible Duplicate
                </span>
              )}
            </div>

            {/* Client info */}
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-500 dark:text-slate-400">
              {(job.clientCompanyName || job.clientContactName) && (
                <>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {job.clientCompanyName ?? job.clientContactName}
                  </span>
                  <span className="text-slate-300 dark:text-white/20">·</span>
                </>
              )}
              <span className="capitalize">{job.category?.replace(/-/g, " ")}</span>
              <span className="text-slate-300 dark:text-white/20">·</span>
              <span>{job.engagementType}</span>
              {job.location && (
                <>
                  <span className="text-slate-300 dark:text-white/20">·</span>
                  <span>{job.location}</span>
                </>
              )}
              {pay && (
                <>
                  <span className="text-slate-300 dark:text-white/20">·</span>
                  <span className="font-medium text-[#474ead] dark:text-indigo-400">{pay}</span>
                </>
              )}
              <span className="text-slate-300 dark:text-white/20">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Submitted {timeAgo}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onView}>
              <Search className="w-3.5 h-3.5 mr-1.5" />
              View Details
            </Button>
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={onApprove} disabled={isApproving}>
              <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
              Approve
            </Button>
            <Button
              size="sm" variant="outline"
              className="border-red-200 text-red-600 dark:border-red-900/40 dark:text-red-400"
              onClick={onReject} disabled={isRejecting}
            >
              <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
              Decline
            </Button>
            {hasDuplicates && (
              <Button
                size="sm" variant="outline"
                className="border-violet-200 text-violet-700 dark:border-violet-900/40 dark:text-violet-400"
                onClick={onLink}
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                Link to Existing
              </Button>
            )}
          </div>
        </div>

        {/* ── Duplicate warning ── */}
        {hasDuplicates && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-700/30 dark:bg-orange-900/10">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Similar active job postings already exist:
            </p>
            <ul className="space-y-1.5">
              {duplicates.slice(0, 3).map((dup) => (
                <li key={dup.id} className="flex items-center justify-between gap-2 text-xs text-orange-700 dark:text-orange-300">
                  <span className="font-medium">{dup.title}</span>
                  <span className="text-orange-500 dark:text-orange-500 capitalize">{dup.category?.replace(/-/g, " ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Topgrading Guide — document-style content (mirrors TA-TGP-001 PDF) ────────

const PROCEDURE_STAGES = [
  {
    code: "Stage 1",
    title: "Preparation & Job Scorecard",
    items: [
      { text: "Create Job Success Profile (JSP) based on:", sub: ["Key Accountabilities (3–5 measurable outcomes)", "Core Values and Behaviors", "Technical and Soft Skills"] },
      { text: "Develop an A-Player Scorecard including:", sub: ["Core Competencies", "Performance Metrics", "Culture Fit Indicators"] },
      { text: "Use Standard Template: A-Player Job Scorecard" },
    ],
  },
  {
    code: "Stage 2",
    title: "Attracting A-Players",
    items: [
      { text: "Publish Smart Job Ads using compelling, results-focused language." },
      { text: "Emphasize OnSpot\u2019s culture, growth opportunity, and impact." },
      { text: "Include self-screening challenge questions." },
      { text: "Post across Careers Page, LinkedIn, and relevant platforms." },
    ],
  },
  {
    code: "Stage 3",
    title: "Written Pre-Screening",
    items: [
      { text: "Collect initial applications through ATS." },
      { text: "Include required written responses:", sub: ["Compensation History and Expectation", "Motivation for Role", "Career Goals", "Manager Assessment Insights", "Core Values Alignment Scenario (Mandatory)"] },
      { text: "Disqualify applicants who skip value-alignment question." },
      { text: "Invite qualified candidates to complete the Career History Form (CHF)." },
    ],
  },
  {
    code: "Stage 4",
    title: "Career History Form (CHF)",
    items: [
      { text: "Candidate submits CHF with:", sub: ["Full Salary History", "Past Manager Names and Contacts", "Key Achievements and Failures", "Self and Manager Performance Ratings", "Reasons for Leaving Roles"] },
      { text: "Notify candidate about reference checks to ensure transparency." },
    ],
  },
  {
    code: "Stage 5",
    title: "Initial Screening Interview",
    items: [
      { text: "Conduct interview using the \u201cGets It, Wants It, Capacity to Do It\u201d model." },
      { text: "Key Evaluation Areas:", sub: ["Role Understanding and Motivation", "Personal and Professional Capacity", "Environmental and Cultural Alignment"] },
      { text: "Document findings using Interview Notes Sheet." },
    ],
  },
  {
    code: "Stage 6",
    title: "Topgrading Interview (Deep Dive)",
    items: [
      { text: "Hiring Manager conducts a chronological interview covering all roles since college." },
      { text: "Capture information on:", sub: ["Role Objectives", "Successes and Failures", "Team and Manager Feedback", "Departure Reason"] },
      { text: "Use structured follow-up for pattern recognition." },
      { text: "One interviewer leads; one (or AI Agent) records detailed notes." },
    ],
  },
  {
    code: "Stage 7",
    title: "Competency Interviews (Manager Level Roles)",
    items: [
      { text: "Conduct a panel or functional interview." },
      { text: "Assess top 3\u20135 competencies from the scorecard." },
      { text: "Include scenario-based and behavioral questions." },
      { text: "Client Interview required for Delivery-related positions." },
    ],
  },
  {
    code: "Stage 8",
    title: "TORC Reference Checking",
    items: [
      { text: "Require candidate to facilitate 2\u20133 reference calls." },
      { text: "Suggested Questions:", sub: ["Relationship and Tenure", "Performance, Integrity, Team Fit", "Rehire Likelihood"] },
      { text: "Use TORC to validate claims and eliminate dishonest candidates." },
    ],
  },
  {
    code: "Stage 9",
    title: "Hiring Decision",
    items: [
      { text: "Use the Topgrading Decision Grid:", sub: ["Performance Record", "Competency Match", "Values Alignment", "Coachability", "Compensation Fit"] },
      { text: "Hire only if all criteria are met with evidence." },
      { text: "Disqualify candidates with consistent blame behavior or lack of evidence." },
    ],
  },
  {
    code: "Stage 10",
    title: "Post-Hire Coaching",
    items: [
      { text: "Share the Job Scorecard on Day 1." },
      { text: "Provide a 30-60-90 Day Plan." },
      { text: "Hold monthly check-ins on outcomes." },
      { text: "Review Topgrading interview inputs and build coaching alignment." },
    ],
  },
] as const;

// ─── Guide modal micro-components ────────────────────────────────────────────

function DocSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-bold tracking-widest text-[#474ead] uppercase">{number}</span>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DocDivider() {
  return <div className="border-t border-slate-200 dark:border-white/10" />;
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#474ead]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Pagination helpers ───────────────────────────────────────────────────────
function getPaginationPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  const nearStart = current <= 3;
  const nearEnd = current >= total - 2;
  pages.push(1);
  if (!nearStart) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (!nearEnd) pages.push("...");
  if (total > 1) pages.push(total);
  // Deduplicate while preserving order
  return pages.filter((p, i, arr) => i === 0 || arr[i - 1] !== p);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminFindWork() {
  const { toast } = useToast();
  const { copiedId, copy } = useCopyLink();
  const [, navigate] = useLocation();

  const [guideOpen, setGuideOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rejectModalJobId, setRejectModalJobId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const jobListRef = useRef<HTMLDivElement>(null);
  const [linkModalJobId, setLinkModalJobId] = useState<string | null>(null);
  const [linkTargetJobId, setLinkTargetJobId] = useState<string>("");
  const [viewDetailJobId, setViewDetailJobId] = useState<string | null>(null);
  const [approveConfirmJobId, setApproveConfirmJobId] = useState<string | null>(null);
  const [unapproveConfirmJobId, setUnapproveConfirmJobId] = useState<string | null>(null);
  const [rejectConfirmJobId, setRejectConfirmJobId] = useState<string | null>(null);
  const [composerJob, setComposerJob] = useState<{ id: string; title: string } | null>(null);
  const [emailDecision, setEmailDecision] = useState<"unapproved" | "rejected">("rejected");
  const [composerRejectionReason, setComposerRejectionReason] = useState("");
  const [composerTransitionEventKey, setComposerTransitionEventKey] = useState<string | null>(null);
  const openCreate = () => navigate("/admin/find-work/jobs/new");
  const openEdit = (job: Job) => navigate(`/admin/find-work/jobs/${job.id}/edit`);
  const openApproveComposer = (jobId: string) => {
    setApproveConfirmJobId(jobId);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    jobListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ─── Response types ────────────────────────────────────────────────────────
  interface AdminJobStats {
    total: number; open: number; closed: number;
    pending: number; approved: number; declined: number; clientRequests: number;
  }
  interface AdminJobsResponse {
    items: Job[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
    stats: AdminJobStats;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery<AdminJobsResponse>({
    queryKey: ["/api/admin/jobs", { page: currentPage, pageSize: PAGE_SIZE, tab: activeTab }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        tab: activeTab,
      });
      const res = await apiRequest("GET", `/api/admin/jobs?${params}`);
      return res.json();
    },
    placeholderData: (prev: AdminJobsResponse | undefined) => prev,
    refetchOnWindowFocus: false,
  });

  // Approved jobs fetched on-demand for the "Link to existing job" modal
  const { data: approvedJobsData } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs", "approved-all", "link-modal"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/jobs?tab=approved&page=1&pageSize=200");
      const d = await res.json();
      return d.items ?? [];
    },
    enabled: !!linkModalJobId,
    refetchOnWindowFocus: false,
  });
  const approvedJobsForLinking = (approvedJobsData ?? []) as EnrichedJob[];

  // ─── Mutations ──────────────────────────── p�───────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/jobs/${id}/status`, { status }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job status updated" });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to update status",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/jobs/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Job posting removed" }); },
    onError: (err: any) =>
      toast({ title: "Failed to remove job", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/approve`),
    onSuccess: () => { invalidate(); toast({ title: "Job approved — now visible publicly" }); },
    onError: (err: any) =>
      toast({ title: "Approval failed", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/admin/jobs/${id}/reject-for-email`, { rejectionReason: reason }),
    onSuccess: async (response) => {
      const result = await response.json();
      invalidate();
      setRejectConfirmJobId(null);
      setRejectionReason("");
      setComposerRejectionReason(result.job?.rejection_reason ?? "");
      setComposerTransitionEventKey(result.transitionEventKey);
      setEmailDecision("rejected");
      setComposerJob(result.job ? { id: result.job.id, title: result.job.title } : null);
    },
    onError: (err: any) =>
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" }),
  });

  const unapproveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/unapprove-for-email`),
    onSuccess: async (response) => {
      const result = await response.json();
      invalidate();
      setUnapproveConfirmJobId(null);
      setComposerTransitionEventKey(result.transitionEventKey);
      setComposerRejectionReason("");
      setEmailDecision("unapproved");
      setComposerJob(result.job ? { id: result.job.id, title: result.job.title } : null);
    },
    onError: (err: any) =>
      toast({ title: "Unapprove failed", description: err.message, variant: "destructive" }),
  });

  const composerSendMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ClientEmailPayload }) =>
      apiRequest("POST", `/api/admin/jobs/${id}/client-email/send-after-transition`, {
        ...payload,
        decision: emailDecision,
        transitionEventKey: composerTransitionEventKey,
      }),
    onSuccess: async (response) => {
      const result = await response.json();
      setComposerJob(null);
      setComposerTransitionEventKey(null);
      toast({
        title: "Email sent",
        description: result.email?.status === "failed" ? "The job decision was saved, but the Client email failed to send." : "The Client email was sent.",
        variant: result.email?.status === "failed" ? "destructive" : "default",
      });
    },
    onError: (err: any) =>
      toast({ title: "Email failed", description: err.message, variant: "destructive" }),
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/refresh`),
    onSuccess: () => { invalidate(); toast({ title: "Posting date refreshed — job now appears as posted today" }); },
    onError: (err: any) =>
      toast({ title: "Failed to refresh posting", description: err.message, variant: "destructive" }),
  });

  const linkMutation = useMutation({
    mutationFn: ({ id, existingJobId }: { id: string; existingJobId: string }) =>
      apiRequest("POST", `/api/admin/jobs/${id}/link`, { existingJobId }),
    onSuccess: () => {
      invalidate();
      setLinkModalJobId(null);
      setLinkTargetJobId("");
      toast({ title: "Job linked — duplicate suppressed from public board" });
    },
    onError: (err: any) =>
      toast({ title: "Link failed", description: err.message, variant: "destructive" }),
  });

  // ─── Derived data (server-paginated, server tab-filtered) ────────────────
  // enrichedJobs = current page items; server already filtered by activeTab
  const enrichedJobs = (data?.items ?? []) as unknown as EnrichedJob[];
  const stats = data?.stats;
  const totalJobs = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const startItem = totalJobs === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, totalJobs);

  // ─── Permission guard ─────────────────────────────────────────────────────
  // Distinguish a 403/401 rejection from a genuine empty result set.
  // Without this, a non-admin who reaches this route sees "0 jobs" instead of
  // an explicit access-denied state.
  if (isError) {
    const msg = (error as Error)?.message ?? "";
    const isPermissionError = msg.startsWith("403") || msg.startsWith("401");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPermissionError ? "Access denied" : "Failed to load jobs"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isPermissionError
              ? "You don't have permission to view this page. Admin access is required."
              : msg || "An unexpected error occurred. Please try again."}
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => setBulkOpen(false)}
      />

      {/* ── Topgrading Guide Modal ── */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0f172a]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#474ead]/10">
                <BookOpen className="h-4 w-4 text-[#474ead]" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white">
                  Topgrading Process Guide
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  OnSpot Talent Acquisition — TA-TGP-001
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-6 space-y-6">

            {/* ── 1.0 PURPOSE ── */}
            <DocSection number="1.0" title="Purpose">
              <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                This document outlines the Talent Acquisition Topgrading Process of OnSpot in alignment with ISO 9001:2015 standards. The objective is to ensure the consistent recruitment of A-Players who exhibit the following:
              </p>
              <BulletList items={["Strong Will and Motivation", "Alignment with OnSpot Core Values", "Proven Ability to Deliver Results", "Skills and Competencies for Role Success"]} />
            </DocSection>

            <DocDivider />

            {/* ── 2.0 SCOPE ── */}
            <DocSection number="2.0" title="Scope">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                This procedure applies to all internal and external hiring for regular, project-based, and contractual roles at OnSpot.
              </p>
            </DocSection>

            <DocDivider />

            {/* ── 3.0 DEFINITIONS ── */}
            <DocSection number="3.0" title="Definitions">
              <ul className="space-y-2">
                {[
                  { term: "A-Player", def: "Top 10% of talent available for any given role." },
                  { term: "Job Success Profile (JSP)", def: "A framework defining success attributes and outcomes required for a role." },
                  { term: "Topgrading", def: "A hiring methodology aimed at systematically identifying high performers through deep-dive screening." },
                ].map(({ term, def }) => (
                  <li key={term} className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{term}</span> — {def}
                  </li>
                ))}
              </ul>
            </DocSection>

            <DocDivider />

            {/* ── 4.0 RESPONSIBILITIES ── */}
            <DocSection number="4.0" title="Responsibilities">
              <BulletList items={[
                "Head of People and Workplace – Oversees implementation of the process.",
                "Talent Acquisition Manager – Executes the process and ensures ISO compliance.",
                "Hiring Managers – Participate in interviews and final decisions.",
                "QMR – Audits process alignment with ISO 9001:2015.",
              ]} />
            </DocSection>

            <DocDivider />

            {/* ── 5.0 PROCEDURE ── */}
            <DocSection number="5.0" title="Procedure">
              <div className="space-y-4">
                {PROCEDURE_STAGES.map((stage, i) => (
                  <div key={stage.code} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#474ead] text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                        {stage.title}
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {stage.items.map((item) => (
                        <li key={item.text} className="text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#474ead]" />
                            <span>{item.text}</span>
                          </div>
                          {"sub" in item && item.sub && (
                            <ul className="ml-5 mt-1.5 space-y-1">
                              {item.sub.map((s: string) => (
                                <li key={s} className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </DocSection>

            <DocDivider />

            {/* ── 6.0 DOCUMENTED INFORMATION ── */}
            <DocSection number="6.0" title="Documented Information (Templates Required)">
              <BulletList items={[
                "Job Success Profile Template",
                "A-Player Job Scorecard Template",
                "Career History Form (CHF)",
                "TORC Reference Script",
                "Interview Notes Sheet",
                "Topgrading Decision Grid",
              ]} />
            </DocSection>

            <DocDivider />

            {/* ── 7.0 QUALITY ASSURANCE ── */}
            <DocSection number="7.0" title="Quality Assurance and Audit">
              <BulletList items={[
                "Regular process audits conducted by QMR.",
                "Feedback loops established from Hiring Managers and New Hires.",
                "Annual process review and template updates.",
              ]} />
            </DocSection>

            <DocDivider />

            {/* ── 8.0 RECORDS RETENTION ── */}
            <DocSection number="8.0" title="Records Retention">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                All candidate documents shall be retained for 2 years in secure HRIS or ATS.
              </p>
            </DocSection>

            <DocDivider />

            {/* ── 9.0 REVISION HISTORY ── */}
            <DocSection number="9.0" title="Revision History">
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10 text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.04]">
                      {["Version", "Date", "Description", "Prepared By"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">1.0</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">[TBD]</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Initial Implementation</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Head of People and Workplace</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </DocSection>

            {/* Document footer */}
            <div className="rounded-xl border border-[#474ead]/15 bg-[#474ead]/[0.04] px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              Document Code: TA-TGP-001 &nbsp;·&nbsp; Owner: Head of People and Workplace &nbsp;·&nbsp; Version 1.0 &nbsp;·&nbsp; ISO 9001:2015 Aligned
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-slate-50 dark:bg-[#060816]">
        {/* ── Hero header ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-[#0f172a]">
          {/* Gradient blobs */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#474ead]/30 blur-[100px]" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-indigo-600/20 blur-[80px]" />

          <div className="relative mx-auto max-w-6xl px-6 pb-10 pt-8 md:px-10">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
              <div className="flex items-center gap-3">
                <Link href="/find-work">
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Find Work
                  </button>
                </Link>
                <span className="rounded-full bg-[#474ead]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#7c82d4]">
                  Admin
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setGuideOpen(true)}
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  Top Grading Process
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <a
                    href="/find-work"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    View Public Page
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setBulkOpen(true)}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Bulk Upload
                </Button>
                <Button
                  onClick={openCreate}
                  className="bg-[#474ead] text-white shadow-[0_4px_20px_rgba(71,78,173,0.4)] hover:bg-[#3d439c]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Job
                </Button>
              </div>
            </div>

            {/* Title */}
            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#474ead]/30 bg-[#474ead]/10 px-4 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#474ead]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c82d4]">
                  Job Board Management
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white md:text-4xl">
                Jobs Admin
              </h1>
              <p className="mt-2 max-w-lg text-slate-400">
                Manage job postings — changes appear instantly on the public
                Find Work page.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatPill icon={Briefcase} label="Total Jobs" value={stats?.total ?? 0} accent />
              <StatPill icon={CheckCircle2} label="Open" value={stats?.open ?? 0} />
              <StatPill icon={XCircle} label="Closed" value={stats?.closed ?? 0} />
              <StatPill icon={AlertCircle} label="Pending" value={stats?.pending ?? 0} />
              <StatPill icon={Users} label="Client Requests" value={stats?.clientRequests ?? 0} />
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">

          {/* ── Tab bar + actions header ── */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-wrap">
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/[0.08] dark:bg-white/[0.04] flex-wrap">
              {TABS.map((tab) => {
                const count =
                  tab.key === "pending" ? (stats?.pending ?? 0)
                  : tab.key === "approved" ? (stats?.approved ?? 0)
                  : tab.key === "declined" ? (stats?.declined ?? 0)
                  : (stats?.total ?? 0);
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#474ead] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {tab.label}
                    {tab.key === "pending" && count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                        {count}
                      </span>
                    )}
                    {tab.key !== "pending" && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="rounded-full">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Bulk Upload
              </Button>
              <Button onClick={openCreate} size="sm" className="bg-[#474ead] text-white hover:bg-[#3d439c]">
                <Plus className="w-4 h-4 mr-1.5" />
                Add New Job
              </Button>
            </div>
          </div>

          {/* ── Pending approvals banner ── */}
          {activeTab === "pending" && (stats?.pending ?? 0) > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700/30 dark:bg-amber-900/10">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {stats?.pending ?? 0} job request{(stats?.pending ?? 0) !== 1 ? "s" : ""} awaiting review
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Pending jobs are not visible to candidates on the public Find Work page until approved.
                </p>
              </div>
            </div>
          )}

          {/* ── Job list ── */}
          <div ref={jobListRef} />
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : enrichedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-center dark:border-white/[0.08] dark:bg-[#0f172a]/60">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#474ead]/10">
                {activeTab === "pending" ? <ListFilter className="h-8 w-8 text-[#474ead]" /> : <Briefcase className="h-8 w-8 text-[#474ead]" />}
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                {activeTab === "pending" ? "No pending approvals" : activeTab === "approved" ? "No approved jobs" : activeTab === "declined" ? "No declined jobs" : "No job postings yet"}
              </h3>
              <p className="mb-6 max-w-xs text-slate-500 dark:text-slate-400">
                {activeTab === "all" ? "Create your first job posting to start attracting talent." : "Nothing in this category right now."}
              </p>
              {activeTab === "all" && (
                <Button onClick={openCreate} className="bg-[#474ead] text-white hover:bg-[#3d439c]">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Job
                </Button>
              )}
            </div>
          ) : activeTab === "pending" ? (
            // ── Pending Approvals view ──
            <div className="space-y-3">
              {enrichedJobs.map((job) => (
                <PendingApprovalCard
                  key={job.id}
                  job={job}
                  allJobs={enrichedJobs}
                  onApprove={() => openApproveComposer(job.id)}
                  onReject={() => { setRejectModalJobId(job.id); setRejectionReason(""); }}
                  onLink={() => {
                    setLinkModalJobId(job.id);
                    const firstDup = findDuplicates(job, enrichedJobs)[0];
                    setLinkTargetJobId(firstDup?.id ?? "");
                  }}
                  onView={() => setViewDetailJobId(job.id)}
                  isApproving={approveMutation.isPending}
                  isRejecting={rejectMutation.isPending}
                />
              ))}
            </div>
          ) : (
            // ── All / Approved / Declined view ──
            <div className="space-y-3">
              {enrichedJobs.map((job) => (
                <AdminJobRow
                  key={job.id}
                  job={job}
                  onEdit={() => openEdit(job as unknown as Job)}
                  onToggle={() => {
                    // Guard: reopening a job without an engagement type must be blocked client-side
                    if (job.status !== "open" && !job.engagementType?.trim()) {
                      toast({
                        title: "Engagement type required",
                        description: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
                        variant: "destructive",
                      });
                      return;
                    }
                    toggleStatusMutation.mutate({ id: job.id, status: job.status === "open" ? "closed" : "open" });
                  }}
                  onDelete={() => deleteMutation.mutate(job.id)}
                  onCopy={() => copy(job.id)}
                  onApprove={() => openApproveComposer(job.id)}
                  onReject={() => { setRejectModalJobId(job.id); setRejectionReason(""); }}
                  onMoveToPending={() => setUnapproveConfirmJobId(job.id)}
                  onRefresh={() => refreshMutation.mutate(job.id)}
                  copiedId={copiedId}
                  isToggling={toggleStatusMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                  isApproving={approveMutation.isPending}
                  isRejecting={rejectMutation.isPending}
                  isRefreshing={refreshMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* ── Result range + pagination ── */}
          {totalJobs > 0 && (
            <div className="mt-6 flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {startItem.toLocaleString()}–{endItem.toLocaleString()} of {totalJobs.toLocaleString()} jobs
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-400 mr-1">25 per page</span>
                    <Button variant="outline" size="sm" disabled={currentPage === 1}
                      onClick={() => handlePageChange(1)}>
                      First
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}>
                      ← Previous
                    </Button>
                    {getPaginationPages(currentPage, totalPages).map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-sm text-slate-400">…</span>
                      ) : (
                        <Button
                          key={p}
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className={currentPage === p
                            ? "bg-[#474ead] text-white hover:bg-[#3d439c] min-w-[2rem]"
                            : "min-w-[2rem]"}
                          onClick={() => handlePageChange(p as number)}
                        >
                          {p}
                        </Button>
                      )
                    )}
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}>
                      Next →
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(totalPages)}>
                      Last
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!approveConfirmJobId} onOpenChange={(open) => { if (!open) setApproveConfirmJobId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-emerald-500" />
              Approve this job?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This role will become visible on the public Find Work page immediately.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setApproveConfirmJobId(null)}>Cancel</Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={approveMutation.isPending}
                onClick={() => {
                  if (approveConfirmJobId) {
                    approveMutation.mutate(approveConfirmJobId);
                    setApproveConfirmJobId(null);
                  }
                }}
              >
                {approveMutation.isPending ? "Approving…" : "Approve"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ClientEmailComposer
        job={composerJob}
        decision={emailDecision}
        rejectionReason={composerRejectionReason}
        open={!!composerJob}
        onClose={() => { setComposerJob(null); setComposerTransitionEventKey(null); setComposerRejectionReason(""); }}
        isSending={composerSendMutation.isPending}
        onConfirm={(payload) => {
          if (!composerJob) return;
          composerSendMutation.mutate({ id: composerJob.id, payload });
        }}
      />

      <Dialog open={!!unapproveConfirmJobId} onOpenChange={(open) => { if (!open) setUnapproveConfirmJobId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unapprove this job post?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This will remove the job from approved status. The Client will be notified and you can review the email before sending.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUnapproveConfirmJobId(null)}>Cancel</Button>
            <Button className="bg-amber-600 text-white hover:bg-amber-700" disabled={unapproveMutation.isPending}
              onClick={() => unapproveConfirmJobId && unapproveMutation.mutate(unapproveConfirmJobId)}>
              {unapproveMutation.isPending ? "Unapproving…" : "Confirm Unapprove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reject reason modal ── */}
      <Dialog open={!!rejectModalJobId} onOpenChange={(open) => { if (!open) setRejectModalJobId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              Decline Job Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The client will see this job as Declined. You can optionally provide a reason.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Reason (optional)
              </label>
              <Textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Incomplete description, missing budget, duplicate posting..."
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setRejectModalJobId(null)}>Cancel</Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={rejectMutation.isPending}
                onClick={() => {
                  if (rejectModalJobId) {
                    setRejectConfirmJobId(rejectModalJobId);
                    setRejectModalJobId(null);
                  }
                }}
              >
                {rejectMutation.isPending ? "Declining..." : "Confirm Decline"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectConfirmJobId} onOpenChange={(open) => { if (!open) setRejectConfirmJobId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm rejection?</DialogTitle>
            <DialogDescription>This will reject the job, preserve the in-app notification, and then open the Client email composer.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRejectConfirmJobId(null)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" disabled={rejectMutation.isPending}
              onClick={() => rejectConfirmJobId && rejectMutation.mutate({ id: rejectConfirmJobId, reason: rejectionReason })}>
              {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Link to existing job modal ── */}
      <Dialog open={!!linkModalJobId} onOpenChange={(open) => { if (!open) { setLinkModalJobId(null); setLinkTargetJobId(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-violet-500" />
              Link to Existing Job
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This client request will be marked as a duplicate and linked to an existing approved job. It will not appear separately on the public board.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select existing approved job
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {approvedJobsForLinking
                  .filter((j) => j.status === "open" && j.id !== linkModalJobId)
                  .map((j) => (
                    <button
                      key={j.id}
                      onClick={() => setLinkTargetJobId(j.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        linkTargetJobId === j.id
                          ? "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-900/20"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.15]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{j.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{j.category?.replace(/-/g, " ")} · {j.location || "Remote"}</p>
                    </button>
                  ))
                }
                {approvedJobsForLinking.filter((j) => j.status === "open" && j.id !== linkModalJobId).length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">No approved open jobs available to link to.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setLinkModalJobId(null); setLinkTargetJobId(""); }}>Cancel</Button>
              <Button
                className="bg-violet-600 text-white hover:bg-violet-700"
                disabled={!linkTargetJobId || linkMutation.isPending}
                onClick={() => {
                  if (linkModalJobId && linkTargetJobId)
                    linkMutation.mutate({ id: linkModalJobId, existingJobId: linkTargetJobId });
                }}
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                {linkMutation.isPending ? "Linking..." : "Link Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Detail modal ── */}
      {viewDetailJobId && (() => {
        const dj = enrichedJobs.find((j) => j.id === viewDetailJobId);
        if (!dj) return null;
        const pay = buildRateDisplayWithCode({ ...dj, engagementType: dj.engagementType ?? undefined });
        const dups = findDuplicates(dj, enrichedJobs);
        return (
          <Dialog open={!!viewDetailJobId} onOpenChange={(open) => { if (!open) setViewDetailJobId(null); }}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span>{dj.title}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">Pending</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {dj.clientCompanyName && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Company</p>
                      <p className="font-medium text-slate-800 dark:text-white">{dj.clientCompanyName}</p>
                    </div>
                  )}
                  {dj.clientContactName && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Contact</p>
                      <p className="font-medium text-slate-800 dark:text-white">{dj.clientContactName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Category</p>
                    <p className="font-medium text-slate-800 dark:text-white capitalize">{dj.category?.replace(/-/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Engagement Type</p>
                    <p className="font-medium text-slate-800 dark:text-white">{dj.engagementType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
                    <p className="font-medium text-slate-800 dark:text-white">{dj.location || "Remote"}</p>
                  </div>
                  {pay && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Rate / Salary</p>
                      <p className="font-medium text-[#474ead] dark:text-indigo-400">{pay}</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {dj.description && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Job Description</p>
                    <JobRichText
                      html={dj.description}
                      className="text-slate-700 dark:text-slate-300"
                    />
                  </div>
                )}

                {/* Duplicate warning */}
                {dups.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-700/30 dark:bg-orange-900/10">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Possible duplicate — similar active job postings:
                    </p>
                    <ul className="space-y-1">
                      {dups.map((dup) => (
                        <li key={dup.id} className="text-xs text-orange-700 dark:text-orange-300">
                          <span className="font-medium">{dup.title}</span>
                          <span className="text-orange-500"> · </span>
                          <span className="capitalize">{dup.category?.replace(/-/g, " ")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => { setViewDetailJobId(null); openApproveComposer(dj.id); }}>
                    <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />Approve
                  </Button>
                  <Button size="sm" variant="outline"
                    className="border-red-200 text-red-600 dark:border-red-900/40 dark:text-red-400"
                    onClick={() => { setViewDetailJobId(null); setRejectModalJobId(dj.id); setRejectionReason(""); }}>
                    <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />Decline
                  </Button>
                  {dups.length > 0 && (
                    <Button size="sm" variant="outline"
                      className="border-violet-200 text-violet-700 dark:border-violet-900/40 dark:text-violet-400"
                      onClick={() => { setViewDetailJobId(null); setLinkModalJobId(dj.id); setLinkTargetJobId(dups[0]?.id ?? ""); }}>
                      <Link2 className="w-3.5 h-3.5 mr-1.5" />Link to Existing
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setViewDetailJobId(null)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

    </>
  );
}
