import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BarChart3,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Star,
  Zap,
  Layers,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { ExpandableJobCard } from "@/components/ExpandableJobCard";
import { JobFormModal } from "@/components/JobFormModal";
import { getJobBadges } from "@/lib/jobUtils";

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
    const url = `${window.location.origin}/jobs/${jobId}`;
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminFindWork() {
  const { toast } = useToast();
  const { copiedId, copy } = useCopyLink();

  // Modal state — null = closed, null job = create mode, Job = edit mode
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const openCreate = () => { setEditingJob(null); setModalOpen(true); };
  const openEdit = (job: Job) => { setEditingJob(job); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingJob(null); };

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/jobs");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  // ─── Mutations (status toggle + delete only — form mutations live in modal) ─
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/jobs/${id}/status`, { status }),
    onSuccess: () => { invalidate(); toast({ title: "Job status updated" }); },
    onError: (err: any) =>
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/jobs/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Job posting removed" }); },
    onError: (err: any) =>
      toast({ title: "Failed to remove job", description: err.message, variant: "destructive" }),
  });

  // ─── Derived stats ────────────────────────────────────────────────────────
  const openJobs = jobs.filter((j) => j.status === "open");
  const closedJobs = jobs.filter(
    (j) => j.status === "closed" || j.status === "cancelled"
  );
  const totalProposals = jobs.reduce(
    (sum, j) => sum + (j.proposalCount || 0),
    0
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Job Form Modal ─────────────────────────────────────────────────── */}
      <JobFormModal
        open={modalOpen}
        onClose={closeModal}
        job={editingJob}
        onSuccess={closeModal}
      />

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">

          {/* Page header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <Link href="/find-work">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Jobs Admin</h1>
                <p className="text-muted-foreground">
                  Manage job postings — changes appear instantly on the public
                  Find Work page
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/find-work" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  View Public Page
                </a>
              </Button>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add New Job
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{jobs.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold">{openJobs.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Closed</p>
                  <p className="text-2xl font-bold">{closedJobs.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Applications</p>
                  <p className="text-2xl font-bold">{totalProposals}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Job list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Job Postings
              </h2>
              <Badge variant="secondary">{jobs.length} total</Badge>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No job postings yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first job posting to start attracting talent.
                  </p>
                  <Button onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Job
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const badges = getJobBadges(job as any);
                  return (
                    <ExpandableJobCard
                      key={job.id}
                      job={job}
                      showApply={false}
                      adminActions={
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status badge */}
                          <Badge
                            variant={job.status === "open" ? "default" : "secondary"}
                          >
                            {job.status === "open"
                              ? "Open"
                              : job.status === "closed"
                              ? "Closed"
                              : job.status}
                          </Badge>

                          {/* Application count */}
                          {(job.proposalCount ?? 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {job.proposalCount} application
                              {job.proposalCount !== 1 ? "s" : ""}
                            </span>
                          )}

                          {/* Auto-computed badges */}
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

                          {/* Toggle status */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: job.id,
                                status:
                                  job.status === "open" ? "closed" : "open",
                              })
                            }
                            disabled={toggleStatusMutation.isPending}
                          >
                            {job.status === "open" ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5 mr-1" />
                                Close
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Reopen
                              </>
                            )}
                          </Button>

                          {/* Edit — opens modal */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(job)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>

                          {/* Preview public page */}
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/jobs/${job.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              Preview
                            </a>
                          </Button>

                          {/* Copy share link */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copy(job.id)}
                          >
                            {copiedId === job.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                Copy Link
                              </>
                            )}
                          </Button>

                          {/* Delete */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove job posting?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will cancel &ldquo;{job.title}&rdquo;.
                                  It will no longer appear on the Find Work
                                  page.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(job.id)}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Field reference */}
          <Card className="mt-10">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">
                Field Reference — Where Each Field Appears Publicly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Field</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Job Card</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Dedicated Page</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Modal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {[
                      ["title", "✅ Header", "✅ Hero", "✅ Header"],
                      ["company", "✅ Header", "✅ Hero", "✅ Header"],
                      ["location / work setup", "✅ Stat bar", "✅ Hero + sidebar", "✅ Stat bar"],
                      ["contractType", "✅ Stat bar", "✅ Sidebar", "✅ Stat bar"],
                      ["experienceLevel", "—", "✅ Hero + sidebar", "✅ Stat bar"],
                      ["category", "✅ Card color", "✅ Hero color", "✅ Header color"],
                      ["description", "✅ 2-line preview", "✅ Role Overview section", "✅ Description"],
                      ["responsibilities", "—", "✅ Full section", "✅ Full section"],
                      ["requirements / skillTags", "✅ Skill badges", "✅ Skills & Requirements", "✅ Skill badges"],
                      ["budget / hourlyRateMin/Max (₱)", "Hidden", "✅ Hero + sidebar", "✅ Header"],
                      ["status", "—", "—", "—"],
                      ["proposalCount", "—", "—", "—"],
                      ["createdAt", "✅ Stat bar (relative)", "✅ Hero (relative)", "✅ Stat bar"],
                      ["Top Paying badge (auto)", "✅ Auto: ₱50k+", "✅ Auto", "—"],
                      ["Urgently Hiring badge (auto)", "✅ Auto: 0 apps + ≤14d", "✅ Auto", "—"],
                      ["Multiple Slots badge (auto)", "✅ Auto: title keywords", "✅ Auto", "—"],
                    ].map(([field, card, page, modal]) => (
                      <tr key={field}>
                        <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">{field}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{card}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{page}</td>
                        <td className="py-2 text-xs text-muted-foreground">{modal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}
