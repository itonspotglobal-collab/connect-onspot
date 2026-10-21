import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Briefcase, ChevronLeft, ChevronRight, Plus, RotateCw } from "lucide-react";
import type { Job } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientJobTalentSearchDialog } from "@/components/ClientJobTalentSearchDialog";
import { ClientJobPreviewDialog, ClientJobRow } from "@/pages/ClientProfile";
import { useClientJobs } from "@/hooks/useClientJobs";

type JobFilter = "all" | "drafts" | "pending" | "open" | "closed";
const PAGE_SIZE = 10;

function approvalOf(job: Job) {
  return (job as any).approvalStatus ?? (job as any).approval_status ?? "pending";
}

export default function JobPostingsPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { jobsQuery, toggleStatusMutation, deleteJobMutation } = useClientJobs();
  const jobs = jobsQuery.data ?? [];
  const [filter, setFilter] = useState<JobFilter>("all");
  const [page, setPage] = useState(1);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [talentSearchJob, setTalentSearchJob] = useState<{ id: string; title: string } | null>(null);
  const jobId = new URLSearchParams(search).get("jobId");
  const openedJob = useRef<string | null>(null);

  const counts = useMemo(() => ({
    all: jobs.length,
    drafts: jobs.filter((job) => job.status === "draft").length,
    pending: jobs.filter((job) => job.status !== "draft" && approvalOf(job) === "pending").length,
    open: jobs.filter((job) => job.status === "open").length,
    closed: jobs.filter((job) => ["closed", "cancelled", "completed"].includes(job.status ?? "")).length,
  }), [jobs]);
  const filtered = useMemo(() => jobs.filter((job) => {
    if (filter === "drafts") return job.status === "draft";
    if (filter === "pending") return job.status !== "draft" && approvalOf(job) === "pending";
    if (filter === "open") return job.status === "open";
    if (filter === "closed") return ["closed", "cancelled", "completed"].includes(job.status ?? "");
    return true;
  }), [filter, jobs]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleJobs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  useEffect(() => {
    if (!jobId || jobsQuery.isLoading || openedJob.current === jobId) return;
    const ownedJob = jobs.find((job) => job.id === jobId);
    if (ownedJob) {
      openedJob.current = jobId;
      setViewingJob(ownedJob);
    }
  }, [jobId, jobs, jobsQuery.isLoading]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#474ead]">Hiring workspace</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Job Postings</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create, manage, and track your job openings.</p>
        </div>
        <Button onClick={() => navigate("/client/jobs/new")} className="bg-[#474ead] text-white hover:bg-[#3d439c]" data-testid="button-post-job">
          <Plus className="mr-2 h-4 w-4" />Post a Job
        </Button>
      </header>

      <section aria-label="Job counts" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ["all", "All Jobs"],
          ["drafts", "Drafts"],
          ["pending", "Pending"],
          ["open", "Open"],
          ["closed", "Closed"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            data-testid={`jobs-count-${key}`}
            data-value={counts[key]}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${filter === key ? "border-[#474ead]/40 bg-[#474ead]/[0.06] ring-1 ring-[#474ead]/20" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/[0.08] dark:bg-slate-900/60 dark:hover:bg-white/[0.04]"}`}
          >
            <span className="block text-xl font-semibold text-slate-900 dark:text-white">{counts[key]}</span>
            <span className="mt-0.5 block text-xs font-medium text-slate-500">{label}</span>
          </button>
        ))}
      </section>

      {jobId && !jobsQuery.isLoading && !jobsQuery.isError && !jobs.some((job) => job.id === jobId) && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This job is unavailable or is not associated with your account.
        </p>
      )}
      {jobsQuery.isError ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center">
          <p role="alert" className="mb-4 text-sm text-slate-600 dark:text-slate-300">Job postings could not be loaded. Your account data has not been changed.</p>
          <Button variant="outline" onClick={() => jobsQuery.refetch()}><RotateCw className="mr-2 h-4 w-4" />Retry</Button>
        </CardContent></Card>
      ) : jobsQuery.isLoading ? (
        <div className="space-y-3" aria-label="Loading job postings">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-14 text-center">
          <div className="mb-4 rounded-2xl bg-[#474ead]/10 p-4"><Briefcase className="h-7 w-7 text-[#474ead]" /></div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{jobs.length ? `No ${filter === "all" ? "" : `${filter} `}jobs found` : "No job postings yet"}</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{jobs.length ? "Choose another status filter to see your postings." : "Post your first opening to start finding talent on OnSpot."}</p>
          {!jobs.length && <Button className="mt-5 bg-[#474ead] text-white hover:bg-[#3d439c]" onClick={() => navigate("/client/jobs/new")}><Plus className="mr-2 h-4 w-4" />Post Your First Job</Button>}
        </CardContent></Card>
      ) : (
        <>
          <div className="space-y-3">
            {visibleJobs.map((job) => <ClientJobRow
              key={job.id}
              job={job}
              onEdit={() => navigate(`/client/jobs/${job.id}/edit`)}
              onToggle={() => toggleStatusMutation.mutate({ id: job.id, status: job.status === "open" ? "closed" : "open" })}
              onDelete={() => deleteJobMutation.mutate(job.id)}
              onView={() => setViewingJob(job)}
              onInvite={() => setTalentSearchJob({ id: job.id, title: job.title })}
              isToggling={toggleStatusMutation.isPending}
              isDeleting={deleteJobMutation.isPending}
            />)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/[0.08]">
            <p className="text-xs text-slate-500">Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} data-testid="button-jobs-previous"><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
              <span className="min-w-16 text-center text-xs text-slate-500" aria-live="polite">Page {page} of {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((current) => current + 1)} data-testid="button-jobs-next">Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>
        </>
      )}
      <ClientJobPreviewDialog job={viewingJob} onClose={() => setViewingJob(null)} />
      <ClientJobTalentSearchDialog
        open={Boolean(talentSearchJob)}
        onOpenChange={(open) => { if (!open) setTalentSearchJob(null); }}
        job={talentSearchJob}
      />
    </div>
  );
}
