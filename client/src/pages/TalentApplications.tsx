import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { useMatchedJobs, MatchedJobsList } from "@/components/MatchedJobs";
import {
  useTalentApplications, TalentApplication, ApplicationAnswer, getTalentAppsLastViewedKey,
} from "@/hooks/useTalentApplications";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount";
import { getStatusMeta, STATUS_PIPELINE, ACTIVE_STATUSES, COMPLETED_STATUSES } from "@/lib/applicationStatus";
import {
  Briefcase, Calendar, ChevronRight, RefreshCw,
  CheckCircle2, Circle, AlertCircle, Loader2, ExternalLink, Clock,
  FileText, X, Download, MessageSquare, BookOpen, Mail,
  Check, XCircle,
} from "lucide-react";

function MatchedJobsSection() {
  const { data, isLoading } = useMatchedJobs(true);
  return <MatchedJobsList matches={data} isLoading={isLoading} />;
}

function StatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
    >
      {meta.talentLabel}
    </span>
  );
}

// ─── Status Timeline ──────────────────────────────────────────────────────────

function StatusTimeline({ status }: { status: string }) {
  const isTerminal = getStatusMeta(status).isTerminal;
  // Find current step index in the normal pipeline
  const pipelineStatus = status === "new" ? "submitted" : status === "reviewed" ? "under_review" : status;
  const currentIdx = STATUS_PIPELINE.indexOf(pipelineStatus as any);
  const isRejected = status === "rejected" || status === "withdrawn";

  if (isRejected) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <span className="text-xs text-slate-500 dark:text-slate-400">Status:</span>
        <StatusBadge status={status} />
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-0">
        {STATUS_PIPELINE.map((step, idx) => {
          const isPast = currentIdx >= 0 && idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = currentIdx < 0 || idx > currentIdx;
          const meta = getStatusMeta(step);
          const isLast = idx === STATUS_PIPELINE.length - 1;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-0.5">
                <div className={[
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                  isPast   ? "border-emerald-500 bg-emerald-500" : "",
                  isCurrent ? `border-[#474ead] bg-[#474ead]` : "",
                  isFuture && !isCurrent ? "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800" : "",
                ].join(" ")}>
                  {isPast   ? <CheckCircle2 className="h-3 w-3 text-white" /> : null}
                  {isCurrent ? <Circle className="h-2 w-2 fill-white text-white" /> : null}
                  {isFuture && !isCurrent ? <Circle className="h-2 w-2 text-slate-300 dark:text-slate-600" /> : null}
                </div>
                <span className={[
                  "text-[9px] whitespace-nowrap font-medium",
                  isPast    ? "text-emerald-600 dark:text-emerald-400" : "",
                  isCurrent ? "text-[#474ead] dark:text-indigo-400" : "",
                  isFuture && !isCurrent  ? "text-slate-400" : "",
                ].join(" ")}>
                  {meta.label}
                </span>
              </div>
              {!isLast && (
                <div className={[
                  "h-0.5 flex-1 mb-3.5 mx-0.5",
                  isPast ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700",
                ].join(" ")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Submission Drawer ────────────────────────────────────────────────────────

function SubmissionDrawer({ app, onClose }: { app: TalentApplication; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);

  const submittedDate = app.submittedAt
    ? new Date(app.submittedAt).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  const hasAnswers = Array.isArray(app.answers) && app.answers.length > 0;
  const hasCoverLetter = !!app.coverLetter;
  const hasResume = !!app.resume;

  /** Fetch the resume through the talent-authenticated endpoint and trigger a browser download. */
  async function handleResumeDownload() {
    const auth = loadTalentAuth();
    if (!auth) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/talent/applications/${app.id}/resume?download=1`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = app.resume?.fileName || "resume";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Resume download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="Submission details"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-white truncate">{app.job.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {app.job.companyName}
              {submittedDate && <span className="ml-2 text-slate-400">· Applied {submittedDate}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</span>
            <StatusBadge status={app.applicationStatus} />
          </div>

          {/* Resume */}
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Resume
            </h3>
            {hasResume ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <FileText className="h-5 w-5 shrink-0 text-[#474ead]" />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
                  {app.resume!.fileName || "Submitted resume"}
                </span>
                <button
                  onClick={handleResumeDownload}
                  disabled={downloading}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-[#474ead] hover:underline dark:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloading ? "Downloading…" : "Download"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No resume was submitted with this application.</p>
            )}
          </section>

          {/* Cover Letter */}
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              Cover Letter
            </h3>
            {hasCoverLetter ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {app.coverLetter}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No cover letter was included.</p>
            )}
          </section>

          {/* Application Answers */}
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              Application Questions
            </h3>
            {hasAnswers ? (
              <div className="space-y-4">
                {(app.answers as ApplicationAnswer[]).map((item, idx) => (
                  <div key={item.questionId ?? idx} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                      Q{idx + 1}: {item.question}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {item.answer || <span className="italic text-slate-400">No answer provided</span>}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No additional questions were asked for this role.</p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

function ApplicationCard({
  app,
  onViewSubmission,
  unreadMessageCount = 0,
}: {
  app: TalentApplication;
  onViewSubmission: () => void;
  unreadMessageCount?: number;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const qc = useQueryClient();
  const jobOpen = app.job.status === "open" || !app.job.status;
  const meta = getStatusMeta(app.applicationStatus);
  const canWithdraw = !meta.isTerminal;
  const canOpenChat = new Set([
    "new",
    "submitted",
    "under_review",
    "reviewed",
    "shortlisted",
    "interviewing",
    "offer_extended",
    "offer_accepted",
    "contract_sent",
  ]).has(app.applicationStatus);

  const submittedDate = app.submittedAt
    ? new Date(app.submittedAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : null;

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      await apiRequest("PATCH", `/api/talent/applications/${app.id}/withdraw`);
      // Optimistic update: flip status immediately then refetch
      qc.setQueryData<TalentApplication[]>(["talent-applications"], (old) =>
        old?.map((a) => a.id === app.id ? { ...a, applicationStatus: "withdrawn" } : a) ?? old,
      );
      qc.invalidateQueries({ queryKey: ["talent-applications"] });
    } catch (error) {
      console.error("Withdraw failed:", error);
      toast({
        title: "Unable to withdraw application",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleOpenChat() {
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const res = await apiRequest("POST", `/api/applications/${app.id}/message-thread`);
      const data = await res.json() as { threadId?: string };
      if (!data.threadId) throw new Error("No thread returned");
      navigate(`/messages/${data.threadId}`);
    } catch (error) {
      console.error("Open application conversation failed:", error);
      toast({
        title: "Unable to open conversation",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setOpeningChat(false);
    }
  }

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{app.job.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {app.job.companyName}
              {(app.job.location || app.job.workSetup) && (
                <span className="text-slate-400"> · {app.job.workSetup || app.job.location}</span>
              )}
            </p>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <StatusBadge status={app.applicationStatus} />
              {submittedDate && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="h-3 w-3" />
                  Applied {submittedDate}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {jobOpen ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-xs"
                onClick={() => navigate(`/find-work/job/${app.job.id}`)}
              >
                View Job <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            ) : (
              <span className="text-xs text-slate-400 italic">Job closed</span>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={onViewSubmission}
                className="text-xs text-[#474ead] hover:underline dark:text-indigo-400 flex items-center gap-0.5"
              >
                <FileText className="h-3 w-3" />
                View submission
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                onClick={() => setExpanded((p) => !p)}
                className="text-xs text-[#474ead] hover:underline dark:text-indigo-400 flex items-center gap-0.5"
              >
                {expanded ? "Hide" : "Timeline"}
                <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
              {canOpenChat && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <button
                    onClick={handleOpenChat}
                    disabled={openingChat}
                    className="text-xs text-[#474ead] hover:underline dark:text-indigo-400 flex items-center gap-0.5 disabled:opacity-50"
                    data-testid={`button-reach-client-${app.id}`}
                  >
                    {openingChat ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                    {openingChat ? "Opening…" : "Reach the Client"}
                    {unreadMessageCount > 0 && (
                      <span className="ml-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
            {canWithdraw && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={withdrawing}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline dark:text-red-400 dark:hover:text-red-300 flex items-center gap-0.5 disabled:opacity-50"
                  >
                    {withdrawing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Withdraw
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Withdraw Application?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You're about to withdraw your application for <strong>{app.job.title}</strong>
                      {app.job.companyName ? ` at ${app.job.companyName}` : ""}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleWithdraw}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Yes, Withdraw
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {expanded && <StatusTimeline status={app.applicationStatus} />}
      </CardContent>
    </Card>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterKey = "all" | "active" | "interview" | "completed";

function filterApplications(apps: TalentApplication[], filter: FilterKey) {
  switch (filter) {
    case "active":
      return apps.filter((a) => ACTIVE_STATUSES.has(a.applicationStatus) && a.applicationStatus !== "interview");
    case "interview":
      return apps.filter((a) => a.applicationStatus === "interview" || a.applicationStatus === "offered");
    case "completed":
      return apps.filter((a) => COMPLETED_STATUSES.has(a.applicationStatus));
    default:
      return apps;
  }
}

// ─── Recommended Jobs ─────────────────────────────────────────────────────────

interface JobResult {
  id: string;
  title: string;
  company?: string;
  location?: string;
  workSetup?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetCurrency?: string;
  createdAt?: string;
}

function RecommendedJobs({ appliedJobIds }: { appliedJobIds: Set<string> }) {
  const [, navigate] = useLocation();
  const { data: jobs, isLoading } = useQuery<JobResult[]>({
    queryKey: ["/api/jobs/search", "recommended"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/search?status=open&limit=10");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.jobs ?? data.items ?? data ?? []) as JobResult[];
    },
    staleTime: 5 * 60_000,
  });

  const recommendations = (jobs ?? [])
    .filter((j) => !appliedJobIds.has(j.id))
    .slice(0, 4);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!recommendations.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {recommendations.map((job) => (
        <button
          key={job.id}
          onClick={() => navigate(`/find-work/job/${job.id}`)}
          className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-[#474ead]/50 hover:shadow-sm transition-all dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{job.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {job.company}
            {job.workSetup ? ` · ${job.workSetup}` : job.location ? ` · ${job.location}` : ""}
          </p>
          <span className="mt-2 inline-flex items-center text-xs font-medium text-[#474ead] dark:text-indigo-400">
            View role <ChevronRight className="h-3 w-3 ml-0.5" />
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Offers Section ───────────────────────────────────────────────────────────

interface TalentOffer {
  id: string;
  submissionId: string;
  job: { title: string; company: string; location?: string };
  engagementType: string | null;
  rate: string | null;
  rateCurrency: string | null;
  proposedStartDate: string | null;
  status: string;
  talentExpectedRate: string | null;
  talentExpectedCurrency: string | null;
  talentExpectedEngagement: string | null;
  rateBelowExpectation: boolean | null;
  rateDelta: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  parentOfferId?: string | null;
  proposerRole?: string;
}

function formatRate(rate: string | null, currency: string | null, engagement: string | null): string {
  if (!rate) return "—";
  const amount = parseFloat(rate).toLocaleString();
  const cur = currency ?? "PHP";
  const eng = engagement ? ` / ${engagement}` : "";
  return `${cur} ${amount}${eng}`;
}

interface OfferCardProps {
  offer: TalentOffer;
  isPending: boolean;
  errorMessages: Record<string, string>;
  respondingId: string | null;
  onRespond: (id: string, action: "accept" | "decline" | "counter", payload?: Record<string, unknown>) => void;
  isMutating: boolean;
}

function OfferCard({ offer, isPending, errorMessages, respondingId, onRespond, isMutating }: OfferCardProps) {
    const isExpired = offer.expiresAt ? new Date(offer.expiresAt) < new Date() : false;
    const expiryLabel = offer.expiresAt
      ? new Date(offer.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : null;
    const startLabel = offer.proposedStartDate
      ? new Date(offer.proposedStartDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : null;
    const offerError = errorMessages[offer.id];
    const isBusy = isMutating && respondingId === offer.id;

    let statusBadge: { label: string; classes: string } | null = null;
    if (offer.status === "accepted")
      statusBadge = { label: "Accepted", classes: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400" };
    else if (offer.status === "declined")
      statusBadge = { label: "Declined", classes: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" };
    else if (offer.status === "expired" || isExpired)
      statusBadge = { label: "Expired", classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400" };
    else if (offer.status === "withdrawn")
      statusBadge = { label: "Withdrawn", classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400" };
    else if (offer.status === "countered")
      statusBadge = { label: "Countered", classes: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" };
    else if (offer.status === "sent" && offer.proposerRole === "talent")
      statusBadge = { label: "Waiting for client", classes: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400" };

    return (
      <div
        className={[
          "rounded-xl border p-4",
          isPending && !isExpired
            ? "border-teal-200 bg-teal-50/60 dark:border-teal-800/40 dark:bg-teal-950/20"
            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {offer.job.title}
              </p>
              {statusBadge && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.classes}`}>
                  {statusBadge.label}
                </span>
              )}
              {isPending && !isExpired && (
                <span className="rounded-full border border-teal-300 bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                  Pending Response
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {offer.job.company}
              {offer.job.location ? ` · ${offer.job.location}` : ""}
            </p>
          </div>
        </div>

        {/* Offer details */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500">Offered Rate</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
              {formatRate(offer.rate, offer.rateCurrency, offer.engagementType)}
            </p>
          </div>
          {offer.talentExpectedRate && (
            <div>
              <span className="text-slate-400 dark:text-slate-500">Your Expectation</span>
              <p className={[
                "font-medium mt-0.5",
                offer.rateBelowExpectation === true
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-800 dark:text-slate-200",
              ].join(" ")}>
                {formatRate(offer.talentExpectedRate, offer.talentExpectedCurrency, offer.talentExpectedEngagement)}
                {offer.rateBelowExpectation === true && " ↓"}
              </p>
            </div>
          )}
          {offer.engagementType && (
            <div>
              <span className="text-slate-400 dark:text-slate-500">Engagement</span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{offer.engagementType}</p>
            </div>
          )}
          {startLabel && (
            <div>
              <span className="text-slate-400 dark:text-slate-500">Start Date</span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{startLabel}</p>
            </div>
          )}
          {expiryLabel && (
            <div>
              <span className={isExpired ? "text-red-400" : "text-slate-400 dark:text-slate-500"}>
                {isExpired ? "Expired" : "Offer Expires"}
              </span>
              <p className={[
                "font-medium mt-0.5",
                isExpired ? "text-red-500 dark:text-red-400" : "text-slate-800 dark:text-slate-200",
              ].join(" ")}>
                {expiryLabel}
              </p>
            </div>
          )}
          {offer.respondedAt && (
            <div>
              <span className="text-slate-400 dark:text-slate-500">Responded</span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                {new Date(offer.respondedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}
        </div>

        {offer.notes && (
          <div className="mt-3 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 px-3 py-2">
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Note from recruiter</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{offer.notes}</p>
          </div>
        )}

        {/* Error message */}
        {offerError && (
          <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-3 py-2">
            <p className="text-xs text-red-600 dark:text-red-400">{offerError}</p>
          </div>
        )}

        {/* Action buttons — only for genuinely pending offers */}
        {isPending && !isExpired && offer.status === "sent" && offer.proposerRole !== "talent" && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="rounded-full bg-teal-600 text-white hover:bg-teal-700 h-8 text-xs"
              disabled={isBusy}
              onClick={() => onRespond(offer.id, "accept")}
            >
              {isBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Accept Offer
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
              disabled={isBusy}
              onClick={() => {
                const raw = window.prompt("What rate would you like to propose?");
                if (raw === null) return;
                const nextRate = Number(raw);
                if (!Number.isFinite(nextRate) || nextRate <= 0) {
                  window.alert("Please enter a positive rate.");
                  return;
                }
                onRespond(offer.id, "counter", {
                  counterRate: nextRate,
                  counterRateCurrency: offer.rateCurrency ?? "PHP",
                });
              }}
            >
              Counter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-8 text-xs text-slate-500"
              disabled={isBusy}
              onClick={() => onRespond(offer.id, "decline")}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Decline
            </Button>
          </div>
        )}
      </div>
    );
}

function OffersSection({ refetchApplications }: { refetchApplications: () => void }) {
  const auth = loadTalentAuth();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  const { data: offers = [], refetch: refetchOffers, isLoading } = useQuery<TalentOffer[]>({
    queryKey: ["talent-offers"],
    queryFn: async () => {
      if (!auth) return [];
      const res = await fetch("/api/talent/offers", {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, action, payload }: { id: string; action: "accept" | "decline" | "counter"; payload?: Record<string, unknown> }) => {
      const res = await fetch(`/api/talent/offers/${id}/respond`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token ?? ""}`,
        },
        body: JSON.stringify({ action, ...(payload ?? {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error(body.message || body.error || "Failed to respond"), { code: body.error });
      }
      return body;
    },
    onMutate: ({ id }) => setRespondingId(id),
    onSuccess: () => {
      setRespondingId(null);
      refetchOffers();
      refetchApplications();
    },
    onError: (err: any, variables) => {
      setRespondingId(null);
      const friendly =
        err.code === "offer_expired"
          ? "This offer has expired and can no longer be responded to."
          : err.code === "offer_not_pending"
          ? "This offer has already been responded to."
          : err.message || "Something went wrong. Please try again.";
      setErrorMessages((prev) => ({ ...prev, [variables.id]: friendly }));
    },
  });

  if (isLoading || offers.length === 0) return null;

  const pendingOffers = offers.filter((o) => o.status === "sent" && o.proposerRole !== "talent");
  const waitingForClientOffers = offers.filter((o) => o.status === "sent" && o.proposerRole === "talent");
  const pastOffers = offers.filter((o) => o.status !== "sent");

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Offers
        </h2>
        {pendingOffers.length > 0 && (
          <span className="ml-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
            {pendingOffers.length} pending
          </span>
        )}
      </div>

      {pendingOffers.length > 0 && (
        <p className="text-xs text-slate-400 mb-3">
          Review your offer{pendingOffers.length > 1 ? "s" : ""} and respond before {pendingOffers.length > 1 ? "they expire" : "it expires"}.
        </p>
      )}
      {waitingForClientOffers.length > 0 && (
        <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-3">
          Your counter offer{waitingForClientOffers.length > 1 ? "s" : ""} {waitingForClientOffers.length > 1 ? "are" : "is"} waiting for the client’s response.
        </p>
      )}

      <div className="space-y-3">
        {pendingOffers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            isPending={true}
            errorMessages={errorMessages}
            respondingId={respondingId}
            onRespond={(id, action, payload) => respondMutation.mutate({ id, action, payload })}
            isMutating={respondMutation.isPending}
          />
        ))}
        {waitingForClientOffers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            isPending={false}
            errorMessages={errorMessages}
            respondingId={respondingId}
            onRespond={(id, action, payload) => respondMutation.mutate({ id, action, payload })}
            isMutating={respondMutation.isPending}
          />
        ))}
        {pastOffers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            isPending={false}
            errorMessages={errorMessages}
            respondingId={respondingId}
            onRespond={(id, action, payload) => respondMutation.mutate({ id, action, payload })}
            isMutating={respondMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

interface TalentHiringContract {
  id: string;
  status: string;
  documentPath?: string | null;
  documentVersion?: number | null;
  talentSignedAt?: string | null;
  onspotSignedAt?: string | null;
  signingEntity?: string | null;
  createdAt?: string;
  engagementType?: string | null;
  rate?: string | null;
  rateCurrency?: string | null;
  proposedStartDate?: string | null;
}

function TalentContractCard({
  application,
  authToken,
}: {
  application: TalentApplication;
  authToken: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: contracts = [], isLoading } = useQuery<TalentHiringContract[]>({
    queryKey: ["talent-hiring-contracts", application.id],
    queryFn: async () => {
      const res = await fetch(`/api/talent/hiring-contracts?submissionId=${encodeURIComponent(application.id)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Unable to load contract");
      const rows = await res.json();
      return rows.map((row: any) => ({
        id: row.id,
        status: row.status,
        documentPath: row.document_path,
        documentVersion: row.document_version,
        talentSignedAt: row.talent_signed_at,
        onspotSignedAt: row.onspot_signed_at,
        signingEntity: row.signing_entity,
        createdAt: row.created_at,
        engagementType: row.engagement_type,
        rate: row.rate,
        rateCurrency: row.rate_currency,
        proposedStartDate: row.proposed_start_date,
      }));
    },
    enabled: !!authToken,
    staleTime: 30_000,
  });
  const signMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const res = await fetch(`/api/talent/hiring-contracts/${contractId}/sign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || "Unable to sign contract");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Signature recorded", description: "OnSpot will countersign before the hire is finalized." });
      queryClient.invalidateQueries({ queryKey: ["talent-hiring-contracts", application.id] });
      queryClient.invalidateQueries({ queryKey: ["talent-applications"] });
    },
    onError: (error: Error) => toast({ title: "Could not sign contract", description: error.message, variant: "destructive" }),
  });

  const contract = contracts.find((item) => !["void", "voided"].includes(item.status));
  if (isLoading || !contract) return null;

  const rate = contract.rate
    ? `${contract.rateCurrency ? `${contract.rateCurrency} ` : ""}${contract.rate}`
    : null;
  return (
    <Card className="border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">Contract ready for review</h3>
              <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300">
                {contract.status === "signed" ? "Fully signed" : "Your signature needed"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {application.job.title} · {application.job.companyName}
            </p>
          </div>
          <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          {rate && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">Rate</span>
              <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{rate}</p>
            </div>
          )}
          {contract.engagementType && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">Engagement</span>
              <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{contract.engagementType}</p>
            </div>
          )}
          {contract.proposedStartDate && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">Proposed start</span>
              <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                {new Date(contract.proposedStartDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}
          <div>
            <span className="text-slate-500 dark:text-slate-400">Signatures</span>
            <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
              {contract.talentSignedAt ? "You signed" : "You have not signed"}
              {" · "}
              {contract.onspotSignedAt ? "OnSpot signed" : "OnSpot pending"}
            </p>
          </div>
        </div>

        {contract.documentPath && (
          <p className="mt-3 rounded-md border border-indigo-100 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-indigo-900/40 dark:bg-slate-900/50 dark:text-slate-300">
            Contract document: {contract.documentPath}
          </p>
        )}
        {!contract.talentSignedAt && contract.status !== "signed" && (
          <Button
            size="sm"
            className="mt-3 bg-[#474ead] text-white hover:bg-[#3d439c]"
            disabled={signMutation.isPending}
            onClick={() => signMutation.mutate(contract.id)}
          >
            {signMutation.isPending
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Recording…</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" /> Review and sign contract</>}
          </Button>
        )}
        {contract.talentSignedAt && contract.status !== "signed" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" /> Waiting for OnSpot to countersign.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ContractsSection({
  applications,
  authToken,
}: {
  applications: TalentApplication[];
  authToken: string | null;
}) {
  if (!authToken || applications.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-indigo-500" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Contracts</h2>
      </div>
      <div className="space-y-3">
        {applications.map((application) => (
          <TalentContractCard key={application.id} application={application} authToken={authToken} />
        ))}
      </div>
    </div>
  );
}

interface TalentInterview {
  id: string;
  submissionId: string;
  job: { title: string; company: string };
  roundNumber: number;
  interviewType: string;
  status: string;
  proposedTimes: Array<{ start: string; end?: string; timezone?: string }>;
  confirmedTime: string | null;
  currentProposalOwner: string | null;
  meetingLink: string | null;
  proposalExchangeCount: number;
  nudge: boolean;
}

function InterviewsSection({ refetchApplications }: { refetchApplications: () => void }) {
  const auth = loadTalentAuth();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [counterTimes, setCounterTimes] = useState<Record<string, string>>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  const { data: interviews = [], isLoading, refetch } = useQuery<TalentInterview[]>({
    queryKey: ["talent-interviews"],
    queryFn: async () => {
      if (!auth) return [];
      const res = await fetch("/api/talent/interviews", {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });
  const respond = async (interview: TalentInterview, action: "accept" | "decline" | "counter", selectedTime?: string) => {
    setRespondingId(interview.id);
    setErrorMessages((current) => ({ ...current, [interview.id]: "" }));
    try {
      const body = action === "counter"
        ? { action, proposedTimes: [{ start: new Date(selectedTime!).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }] }
        : { action, ...(selectedTime ? { selectedTime: new Date(selectedTime).toISOString() } : {}) };
      const res = await fetch(`/api/talent/interviews/${interview.id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth?.token ?? ""}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Unable to update interview");
      await refetch();
      refetchApplications();
    } catch (err: any) {
      setErrorMessages((current) => ({ ...current, [interview.id]: err.message }));
    } finally {
      setRespondingId(null);
    }
  };
  if (isLoading || interviews.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-indigo-500" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Interviews</h2>
        <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
          {interviews.filter((item) => item.status === "proposed" || item.status === "rescheduled").length} awaiting
        </span>
      </div>
      <div className="space-y-3">
        {interviews.map((interview) => {
          const pending = (interview.status === "proposed" || interview.status === "rescheduled") &&
            interview.currentProposalOwner === "talent";
          return (
            <div key={interview.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-800/40 dark:bg-indigo-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{interview.job.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {interview.job.company} · Round {interview.roundNumber} · {interview.interviewType}
                  </p>
                </div>
                <span className="rounded-full border border-indigo-200 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">
                  {interview.status === "confirmed" ? "Confirmed" : "Proposal"}
                </span>
              </div>
              {interview.confirmedTime && (
                <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Confirmed: {new Date(interview.confirmedTime).toLocaleString()}
                </p>
              )}
              {interview.meetingLink && interview.status === "confirmed" && (
                <a className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline" href={interview.meetingLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" /> Join meeting
                </a>
              )}
              {pending && (
                <>
                  <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">Choose one of the client’s proposed times:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {interview.proposedTimes.map((slot) => (
                      <Button key={slot.start} size="sm" className="h-8 rounded-full bg-indigo-600 text-xs text-white hover:bg-indigo-700" disabled={respondingId === interview.id} onClick={() => respond(interview, "accept", slot.start)}>
                        <Check className="mr-1 h-3 w-3" /> {new Date(slot.start).toLocaleString()}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      aria-label="Alternative interview time"
                      type="datetime-local"
                      value={counterTimes[interview.id] ?? ""}
                      onChange={(event) => setCounterTimes((current) => ({ ...current, [interview.id]: event.target.value }))}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" disabled={respondingId === interview.id || !counterTimes[interview.id]} onClick={() => respond(interview, "counter", counterTimes[interview.id])}>
                      Suggest another time
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs text-slate-500" disabled={respondingId === interview.id} onClick={() => respond(interview, "decline")}>
                      <XCircle className="mr-1 h-3 w-3" /> Decline
                    </Button>
                  </div>
                  {interview.nudge && (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">You’ve exchanged several time proposals. Consider the other side’s available times.</p>
                  )}
                </>
              )}
              {errorMessages[interview.id] && <p className="mt-2 text-xs text-red-600">{errorMessages[interview.id]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Role Invitations Section ─────────────────────────────────────────────────

interface TalentInvitation {
  id: string;
  jobId: string;
  status: string;
  createdAt: string;
  jobTitle: string;
  jobCategory: string | null;
  engagementType: string | null;
  salaryDisplay: string | null;
  budgetCurrency: string | null;
  description: string | null;
}

function InvitationsSection({ refetchApplications }: { refetchApplications: () => void }) {
  const auth = loadTalentAuth();
  const [, navigate] = useLocation();

  const { data: invitations = [], refetch: refetchInvitations, isLoading } = useQuery<TalentInvitation[]>({
    queryKey: ["talent-invitations"],
    queryFn: async () => {
      if (!auth) return [];
      const res = await fetch("/api/talent/invitations", {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "decline" }) => {
      const res = await fetch(`/api/talent/invitations/${id}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token ?? ""}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to respond");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchInvitations();
      refetchApplications(); // accepted invite becomes a regular application
      // On acceptance, a message thread with the client is opened — take the talent there
      if (data?.threadId) {
        navigate(`/messages/${data.threadId}`);
      }
    },
  });

  if (isLoading || invitations.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="h-4 w-4 text-indigo-500" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Role Invitations
        </h2>
        <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
          {invitations.length}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        A client has matched you with a role and would like to connect. Accept to start the process.
      </p>

      <div className="space-y-3">
        {invitations.map((invite) => (
          <div
            key={invite.id}
            className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-800/40 dark:bg-indigo-950/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {invite.jobTitle}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {invite.jobCategory && (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 dark:bg-slate-800">
                      {invite.jobCategory}
                    </span>
                  )}
                  {invite.engagementType && (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 dark:bg-slate-800">
                      {invite.engagementType}
                    </span>
                  )}
                </div>
                {invite.description && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {invite.description}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="rounded-full bg-[#474ead] text-white hover:bg-[#3d439c] h-8 text-xs"
                disabled={respondMutation.isPending}
                onClick={() => respondMutation.mutate({ id: invite.id, action: "accept" })}
              >
                {respondMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Accept
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs text-slate-500"
                disabled={respondMutation.isPending}
                onClick={() => respondMutation.mutate({ id: invite.id, action: "decline" })}
              >
                <XCircle className="mr-1 h-3 w-3" />
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TalentApplications() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const talentAuth = loadTalentAuth();
  const talentSessionId = user?.role === "talent" ? user.id : talentAuth?.candidateId ?? null;
  const hasTalentSession = user?.role === "talent" || (!user && !!talentAuth);
  const unreadMessagesCount = useUnreadMessagesCount();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [drawerApp, setDrawerApp] = useState<TalentApplication | null>(null);

  const { data: applications, isLoading, isError, refetch } = useTalentApplications();
  const { data: messageThreadData } = useQuery<{
    threads: Array<{ jobId: string | null; unreadCount: number }>;
  }>({
    queryKey: ["my-message-threads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/message-threads");
      return res.json();
    },
    enabled: hasTalentSession,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Stamp the per-candidate "last viewed" timestamp so the nav badge resets on visit.
  // Must be scoped by candidateId so one talent's visit doesn't clear another's baseline.
  useEffect(() => {
    if (talentSessionId) {
      localStorage.setItem(getTalentAppsLastViewedKey(talentSessionId), new Date().toISOString());
    }
  }, [talentSessionId]);

  useEffect(() => {
    if (!authLoading && !hasTalentSession) {
      navigate("/portal-login?portal=talent&returnTo=/my-applications");
    }
  }, [authLoading, hasTalentSession, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#060816]">
        <TopNavigation />
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!hasTalentSession) {
    return null;
  }

  const apps = applications ?? [];
  const unreadByJobId = new Map(
    (messageThreadData?.threads ?? [])
      .filter((thread) => thread.jobId)
      .map((thread) => [thread.jobId as string, thread.unreadCount]),
  );
  const filtered = filterApplications(apps, filter);
  const appliedJobIds = new Set(apps.map((a) => a.job.id));
  const contractApplications = apps.filter((app) => ["contract_sent", "hired"].includes(app.applicationStatus));

  // Stats
  const totalCount       = apps.length;
  const underReviewCount = apps.filter((a) => a.applicationStatus === "under_review" || a.applicationStatus === "reviewed").length;
  const shortlistedCount = apps.filter((a) => a.applicationStatus === "shortlisted").length;
  const interviewCount   = apps.filter((a) => a.applicationStatus === "interview" || a.applicationStatus === "offered").length;

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all",       label: "All",       count: apps.length },
    { key: "active",    label: "Active",    count: apps.filter((a) => ACTIVE_STATUSES.has(a.applicationStatus) && a.applicationStatus !== "interview").length },
    { key: "interview", label: "Interview", count: interviewCount },
    { key: "completed", label: "Completed", count: apps.filter((a) => COMPLETED_STATUSES.has(a.applicationStatus)).length },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060816]">
      <TopNavigation />

      <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 md:px-6">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Applications</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track your applications and discover roles that match your profile.
            </p>
          </div>
          <button
            onClick={() => navigate("/messages")}
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Messages
            {unreadMessagesCount > 0 && (
              <span
                aria-label={`${unreadMessagesCount} unread messages`}
                className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
              >
                {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
              </span>
            )}
          </button>
        </div>

        {/* Stats banner */}
        {!isLoading && !isError && totalCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total",        value: totalCount },
              { label: "Under Review", value: underReviewCount },
              { label: "Shortlisted",  value: shortlistedCount },
              { label: "Interviews",   value: interviewCount },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        <ContractsSection
          applications={contractApplications}
          authToken={talentAuth?.token ?? null}
        />

        {/* Your Applications */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Your Applications</h2>
            {!isLoading && (
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#474ead] dark:hover:text-indigo-400 transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            )}
          </div>

          {/* Filter tabs */}
          {!isLoading && !isError && totalCount > 0 && (
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {filterTabs.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={[
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                    filter === key
                      ? "bg-[#474ead] text-white border-[#474ead]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#474ead]/40 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                  ].join(" ")}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      filter === key ? "bg-white/20" : "bg-slate-100 dark:bg-slate-700"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="font-medium text-red-700 dark:text-red-400">Couldn't load your applications right now.</p>
              <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && totalCount === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <Briefcase className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No applications yet</p>
              <p className="mt-1 text-sm text-slate-400">Explore open roles and find your next opportunity.</p>
              <Button
                className="mt-4 rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]"
                onClick={() => navigate("/find-work/jobs")}
              >
                Browse Roles
              </Button>
            </div>
          )}

          {/* Filtered empty */}
          {!isLoading && !isError && totalCount > 0 && filtered.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-400">No applications in this category.</p>
            </div>
          )}

          {/* Application list */}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  onViewSubmission={() => setDrawerApp(app)}
                  unreadMessageCount={unreadByJobId.get(app.job.id) ?? 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Interviews — schedule negotiation and confirmed meeting details */}
        <InterviewsSection refetchApplications={refetch} />

        {/* Offers — rate/engagement offers from clients that talent can accept, decline, or counter */}
        <OffersSection refetchApplications={refetch} />

        {/* Role Invitations — client-initiated invites the talent can accept/decline */}
        <InvitationsSection refetchApplications={refetch} />

        {/* Matched Jobs — scored matches for this talent */}
        <div className="mb-8" id="matched-jobs">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Matched Jobs</h2>
          <p className="text-xs text-slate-400 mb-3">
            Roles ranked by how well they fit your skills, engagement preference, and rate.
          </p>
          <MatchedJobsSection />
        </div>

        {/* Recommended for You */}
        {!isLoading && !isError && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Recommended for You</h2>
            <p className="text-xs text-slate-400 mb-0">Open roles you haven't applied to yet.</p>
            <RecommendedJobs appliedJobIds={appliedJobIds} />
          </div>
        )}

        {/* Browse More Roles */}
        <div className="text-center">
          <Button
            variant="outline"
            className="rounded-full border-[#474ead] text-[#474ead] hover:bg-[#474ead]/5 dark:border-indigo-400 dark:text-indigo-400"
            onClick={() => navigate("/find-work/jobs")}
          >
            Browse More Roles <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Submission drawer */}
      {drawerApp && (
        <SubmissionDrawer app={drawerApp} onClose={() => setDrawerApp(null)} />
      )}
    </div>
  );
}
