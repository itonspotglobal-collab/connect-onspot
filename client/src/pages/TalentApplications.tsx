import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { useTalentApplications, TalentApplication, ApplicationAnswer } from "@/hooks/useTalentApplications";
import { getStatusMeta, STATUS_PIPELINE, ACTIVE_STATUSES, COMPLETED_STATUSES } from "@/lib/applicationStatus";
import {
  Briefcase, MapPin, Calendar, ChevronRight, RefreshCw,
  Clock, CheckCircle2, Circle, AlertCircle, Loader2, ExternalLink,
  FileText, X, Download, MessageSquare, BookOpen,
} from "lucide-react";

// ─── Status Badge ─────────────────────────────────────────────────────────────

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

function ApplicationCard({ app, onViewSubmission }: { app: TalentApplication; onViewSubmission: () => void }) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const jobOpen = app.job.status === "open" || !app.job.status;
  const meta = getStatusMeta(app.applicationStatus);

  const submittedDate = app.submittedAt
    ? new Date(app.submittedAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : null;

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
            <div className="flex items-center gap-2">
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
            </div>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TalentApplications() {
  const [, navigate] = useLocation();
  const auth = loadTalentAuth();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [drawerApp, setDrawerApp] = useState<TalentApplication | null>(null);

  const { data: applications, isLoading, isError, refetch } = useTalentApplications();

  // Redirect unauthenticated visitors to the portal login
  if (!auth) {
    navigate("/portal-login?portal=talent&returnTo=/my-applications");
    return null;
  }

  const apps = applications ?? [];
  const filtered = filterApplications(apps, filter);
  const appliedJobIds = new Set(apps.map((a) => a.job.id));

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Applications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track your applications and discover roles that match your profile.
          </p>
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
                />
              ))}
            </div>
          )}
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
