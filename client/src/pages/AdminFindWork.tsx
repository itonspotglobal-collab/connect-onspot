import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
} from "lucide-react";
import type { Job } from "@shared/schema";
import { JobFormModal } from "@/components/JobFormModal";
import { getJobBadges, getTimeAgo, buildRateDisplay } from "@/lib/jobUtils";

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

// ─── Admin job row ────────────────────────────────────────────────────────────
function AdminJobRow({
  job,
  onEdit,
  onToggle,
  onDelete,
  onCopy,
  copiedId,
  isToggling,
  isDeleting,
}: {
  job: Job;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCopy: () => void;
  copiedId: string | null;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const badges = getJobBadges(job as any);
  const isOpen = job.status === "open";
  const pay = buildRateDisplay(job);
  const timeAgo = getTimeAgo(job.createdAt);

  return (
    <div className="group relative rounded-2xl border border-slate-200/70 bg-white transition-shadow hover:shadow-md dark:border-white/[0.08] dark:bg-[#0f172a]/60">
      {/* Status strip */}
      <div
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${
          isOpen ? "bg-emerald-400" : "bg-slate-300 dark:bg-white/20"
        }`}
      />

      <div className="flex flex-col gap-4 px-6 py-5 pl-8 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {job.title}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isOpen
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/40"
              }`}
            >
              {isOpen
                ? "Open"
                : job.status === "closed"
                  ? "Closed"
                  : job.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-500 dark:text-slate-400">
            <span className="capitalize">
              {job.category?.replace(/-/g, " ")}
            </span>
            <span className="text-slate-300 dark:text-white/20">·</span>
            <span>{job.location || "Remote"}</span>
            {pay && (
              <>
                <span className="text-slate-300 dark:text-white/20">·</span>
                <span className="font-medium text-[#474ead] dark:text-indigo-400">
                  {pay}
                </span>
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
                  {job.proposalCount} application
                  {job.proposalCount !== 1 ? "s" : ""}
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
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            disabled={isToggling}
          >
            {isOpen ? (
              <>
                <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                Close
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Reopen
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>

          <Button variant="outline" size="sm" asChild>
            <a
              href={`/find-work/job/${job.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Preview
            </a>
          </Button>

          <Button variant="outline" size="sm" onClick={onCopy}>
            {copiedId === job.id ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Share
              </>
            )}
          </Button>

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
                  This will cancel &ldquo;{job.title}&rdquo;. It will no longer
                  appear on the Find Work page.
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminFindWork() {
  const { toast } = useToast();
  const { copiedId, copy } = useCopyLink();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const openCreate = () => {
    setEditingJob(null);
    setModalOpen(true);
  };
  const openEdit = (job: Job) => {
    setEditingJob(job);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingJob(null);
  };

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/jobs");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
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
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting removed" });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to remove job",
        description: err.message,
        variant: "destructive",
      }),
  });

  // ─── Derived stats ────────────────────────────────────────────────────────
  const openJobs = jobs.filter((j) => j.status === "open");
  const closedJobs = jobs.filter(
    (j) => j.status === "closed" || j.status === "cancelled",
  );
  const totalApps = jobs.reduce((sum, j) => sum + (j.proposalCount || 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <JobFormModal
        open={modalOpen}
        onClose={closeModal}
        job={editingJob}
        onSuccess={closeModal}
      />

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatPill
                icon={Briefcase}
                label="Total Jobs"
                value={jobs.length}
                accent
              />
              <StatPill
                icon={CheckCircle2}
                label="Open"
                value={openJobs.length}
              />
              <StatPill
                icon={XCircle}
                label="Closed"
                value={closedJobs.length}
              />
              <StatPill icon={Users} label="Applications" value={totalApps} />
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
          {/* Section header */}
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <BarChart3 className="h-5 w-5 text-[#474ead]" />
              Job Postings
              <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                {jobs.length}
              </span>
            </h2>
            <Button
              onClick={openCreate}
              size="sm"
              className="bg-[#474ead] text-white hover:bg-[#3d439c]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add New Job
            </Button>
          </div>

          {/* Job list */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-center dark:border-white/[0.08] dark:bg-[#0f172a]/60">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#474ead]/10">
                <Briefcase className="h-8 w-8 text-[#474ead]" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                No job postings yet
              </h3>
              <p className="mb-6 max-w-xs text-slate-500 dark:text-slate-400">
                Create your first job posting to start attracting talent to
                OnSpot Global.
              </p>
              <Button
                onClick={openCreate}
                className="bg-[#474ead] text-white hover:bg-[#3d439c]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Job
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <AdminJobRow
                  key={job.id}
                  job={job}
                  onEdit={() => openEdit(job)}
                  onToggle={() =>
                    toggleStatusMutation.mutate({
                      id: job.id,
                      status: job.status === "open" ? "closed" : "open",
                    })
                  }
                  onDelete={() => deleteMutation.mutate(job.id)}
                  onCopy={() => copy(job.id)}
                  copiedId={copiedId}
                  isToggling={toggleStatusMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
