import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Briefcase,
  Clock,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Loader2,
  Users,
  Tag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScaffoldJob {
  id: string;
  title: string;
  clientId: string;
  clientEmail: string | null;
  companyName: string | null;
  createdAt: string;
  ageHours: number;
  invitationCount: number;
  skillTags: string[];
  engagementType: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(hours: number): string {
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.floor(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function ageBadgeCls(hours: number): string {
  if (hours >= 168) return "bg-red-100 text-red-800 border-red-200";   // ≥ 7 days
  if (hours >= 72)  return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getAdminToken(): string | null {
  return localStorage.getItem("onspot_jwt_token");
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminScaffoldJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: jobs = [], isLoading, isError, refetch } = useQuery<ScaffoldJob[]>({
    queryKey: ["admin-scaffold-jobs"],
    queryFn: () => apiFetch("/api/admin/scaffold-jobs"),
    staleTime: 30_000,
  });

  const orphaned = jobs.filter((j) => j.invitationCount === 0);
  const withInvitations = jobs.filter((j) => j.invitationCount > 0);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch("/api/admin/scaffold-jobs", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (data) => {
      toast({ title: `Deleted ${data.deleted} scaffold job${data.deleted !== 1 ? "s" : ""}` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-scaffold-jobs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/scaffold-jobs/cleanup", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: `Cleanup complete — ${data.deleted} row${data.deleted !== 1 ? "s" : ""} removed` });
      qc.invalidateQueries({ queryKey: ["admin-scaffold-jobs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Cleanup failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllOrphaned = () => {
    const orphanIds = orphaned.map((j) => j.id);
    const allSelected = orphanIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) orphanIds.forEach((id) => next.delete(id));
      else orphanIds.forEach((id) => next.add(id));
      return next;
    });
  };

  // Only orphaned rows (no invitations) can be deleted — the server enforces this too
  const selectedList = Array.from(selected).filter(
    (id) => orphaned.some((j) => j.id === id),
  );
  const allOrphanedSelected =
    orphaned.length > 0 && orphaned.every((j) => selected.has(j.id));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNavigation />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Scaffold Jobs</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Phantom job rows created when clients search for talent. The server automatically
              removes orphaned rows (no invitations) after 7 days, running hourly. Use
              "Run Cleanup Now" to trigger an immediate pass.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCleanupDialogOpen(true)}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-1.5" />
              )}
              Run Cleanup Now
            </Button>
            {selectedList.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1.5" />
                )}
                Delete Selected ({selectedList.length})
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Briefcase className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold">{jobs.length}</p>
                <p className="text-xs text-slate-500">Total scaffold jobs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-2xl font-bold">{orphaned.length}</p>
                <p className="text-xs text-slate-500">Orphaned (no invitations)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{withInvitations.length}</p>
                <p className="text-xs text-slate-500">With invitations (kept)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error state */}
        {isError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-red-700 text-sm">
              Failed to load scaffold jobs. Check server logs.
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white rounded-lg border animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && jobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <Briefcase className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No scaffold jobs found</p>
              <p className="text-sm mt-1">Scaffold rows are created when clients run a talent search.</p>
            </CardContent>
          </Card>
        )}

        {/* Orphaned section */}
        {!isLoading && orphaned.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Orphaned (no invitations)
                </CardTitle>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <Checkbox
                    checked={allOrphanedSelected}
                    onCheckedChange={toggleAllOrphaned}
                  />
                  Select all orphaned
                </label>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {orphaned.map((job) => (
                  <ScaffoldRow
                    key={job.id}
                    job={job}
                    checked={selected.has(job.id)}
                    onToggle={() => toggle(job.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* With invitations section */}
        {!isLoading && withInvitations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                With invitations
                <span className="text-xs font-normal text-slate-500">(retained for audit)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {withInvitations.map((job) => (
                  <ScaffoldRow
                    key={job.id}
                    job={job}
                    checked={false}
                    onToggle={() => {}}
                    disabled
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk delete confirm */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedList.length} orphaned scaffold job{selectedList.length !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected scaffold rows from the database. Only orphaned
              rows (those with no invitations) are deleted — jobs that have invitations are
              automatically skipped to protect existing talent contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setDeleteDialogOpen(false);
                deleteMutation.mutate(selectedList);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run cleanup confirm */}
      <AlertDialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run scaffold cleanup now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all orphaned scaffold jobs older than 7 days — the same query the
              server runs automatically each night. Jobs that have invitations are never removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCleanupDialogOpen(false);
                cleanupMutation.mutate();
              }}
            >
              Run cleanup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Row Component ────────────────────────────────────────────────────────────

function ScaffoldRow({
  job,
  checked,
  onToggle,
  disabled = false,
}: {
  job: ScaffoldJob;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
        disabled ? "opacity-60" : "hover:bg-slate-50"
      } ${checked ? "bg-blue-50/60" : ""}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={disabled ? undefined : onToggle}
        disabled={disabled}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-slate-900 truncate">
            {job.title || "(untitled)"}
          </span>
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${ageBadgeCls(job.ageHours)}`}
          >
            <Clock className="h-3 w-3 mr-1" />
            {formatAge(job.ageHours)}
          </Badge>
          {job.invitationCount > 0 && (
            <Badge variant="outline" className="text-xs shrink-0 bg-green-50 text-green-700 border-green-200">
              <Users className="h-3 w-3 mr-1" />
              {job.invitationCount} invitation{job.invitationCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {job.engagementType && (
            <Badge variant="outline" className="text-xs shrink-0 bg-slate-50 text-slate-600 border-slate-200">
              {job.engagementType}
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {job.companyName || job.clientEmail || job.clientId}
          {job.companyName && job.clientEmail && (
            <span className="text-slate-400"> · {job.clientEmail}</span>
          )}
          <span className="text-slate-400">
            {" "}· created {new Date(job.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </p>
        {job.skillTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            <Tag className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
            {job.skillTags.slice(0, 6).map((t) => (
              <span
                key={t}
                className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
              >
                {t}
              </span>
            ))}
            {job.skillTags.length > 6 && (
              <span className="text-xs text-slate-400">+{job.skillTags.length - 6} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
