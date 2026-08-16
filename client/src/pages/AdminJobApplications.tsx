import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  ExternalLink, Eye, AlertTriangle, Loader2, Clock, CheckCircle2,
  XCircle, UserCheck, Briefcase, Trash2, Mail, FileText, Download, Video, Play,
} from "lucide-react";
import { lazy, Suspense } from "react";

const ApplicantEmailComposer = lazy(() => import("@/components/ApplicantEmailComposer"));

// ─── Pagination helper ────────────────────────────────────────────────────────
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
  return pages.filter((p, i, arr) => i === 0 || arr[i - 1] !== p);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  "submitted", "under_review", "shortlisted", "interview",
  "offered", "hired", "rejected", "withdrawn",
] as const;
type AppStatus = typeof VALID_STATUSES[number] | "new" | "reviewed";

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  submitted:    { label: "Submitted",    cls: "bg-blue-100 text-blue-800 border-blue-200" },
  new:          { label: "Submitted",    cls: "bg-blue-100 text-blue-800 border-blue-200" },
  under_review: { label: "Under Review", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  reviewed:     { label: "Under Review", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  shortlisted:  { label: "Shortlisted",  cls: "bg-purple-100 text-purple-800 border-purple-200" },
  interview:    { label: "Interview",    cls: "bg-orange-100 text-orange-800 border-orange-200" },
  offered:      { label: "Offered",      cls: "bg-teal-100 text-teal-800 border-teal-200" },
  hired:        { label: "Hired",        cls: "bg-green-100 text-green-800 border-green-200" },
  rejected:     { label: "Rejected",     cls: "bg-red-100 text-red-800 border-red-200" },
  withdrawn:    { label: "Withdrawn",    cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

const REG_CFG: Record<string, { label: string; cls: string }> = {
  pending_account: { label: "Pending Account",  cls: "bg-amber-100 text-amber-800 border-amber-200" },
  registered:      { label: "Linked to Talent", cls: "bg-green-100 text-green-800 border-green-200" },
  existing_talent: { label: "Existing Talent",  cls: "bg-blue-100 text-blue-800 border-blue-200" },
  conflict:        { label: "Account Conflict", cls: "bg-red-100 text-red-800 border-red-200" },
  expired:         { label: "Expired",          cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCompany?: string;
  firstName?: string;
  lastName?: string;
  applicantName?: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  status: string;
  registrationStatus: string;
  isRepeatApplication?: boolean;
  initiatedBy?: string;
  talentId?: string;
  talentFirstName?: string;
  talentLastName?: string;
  submittedAt?: string;
  updatedAt?: string;
}

interface StatusHistory {
  id: string;
  previousStatus?: string;
  newStatus: string;
  note?: string;
  changedBy?: string;
  changedByName?: string;
  createdAt: string;
}

interface ApplicationDetail extends Application {
  candidateId?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeSource?: "application" | "talent_profile" | null;
  videoIntroductionUrl?: string | null;
  videoIntroductionFileName?: string | null;
  history: StatusHistory[];
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byRegStatus: Record<string, number>;
}

interface ListResponse {
  items: Application[];
  total: number;
  page: number;
  limit: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applicantName(a: Application) {
  if (a.firstName || a.lastName) return `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
  return a.applicantName ?? a.email;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function RegBadge({ status }: { status: string }) {
  const cfg = REG_CFG[status] ?? { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("onspot_jwt_token");
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) },
  });
  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await res.text();
    console.error("API returned non-JSON response:", res.status, text.slice(0, 200));
    throw new Error(`Request failed with status ${res.status}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary, loading }: { summary?: Summary; loading: boolean }) {
  const cards = [
    { label: "Total",        key: "_total",       icon: Users,        color: "text-slate-700" },
    { label: "Submitted",    key: "submitted",     icon: Clock,        color: "text-blue-600" },
    { label: "Under Review", key: "under_review",  icon: Eye,          color: "text-yellow-600" },
    { label: "Shortlisted",  key: "shortlisted",   icon: Filter,       color: "text-purple-600" },
    { label: "Interview",    key: "interview",     icon: Briefcase,    color: "text-orange-600" },
    { label: "Hired",        key: "hired",         icon: CheckCircle2, color: "text-green-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map(({ label, key, icon: Icon, color }) => {
        const count = loading ? null : (key === "_total" ? (summary?.total ?? 0) : (summary?.byStatus?.[key] ?? 0));
        return (
          <Card key={key} className="border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              {loading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

// Fetch a CV blob with the admin JWT — returns the blob and filename from Content-Disposition
async function getResumeBlob(applicationId: string): Promise<{ blob: Blob; filename: string | null }> {
  const token = localStorage.getItem("onspot_jwt_token");
  const res = await fetch(`/api/admin/job-applications/${applicationId}/resume`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Failed to load CV (${res.status})`
    );
  }
  const cd = res.headers.get("content-disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const blob = await res.blob();
  return { blob, filename: match?.[1] ?? null };
}

// Fetch a video blob with the admin JWT
async function getVideoBlob(applicationId: string): Promise<{ blob: Blob; filename: string | null }> {
  const token = localStorage.getItem("onspot_jwt_token");
  const res = await fetch(`/api/admin/job-applications/${applicationId}/video`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Failed to load video (${res.status})`
    );
  }
  const cd = res.headers.get("content-disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const blob = await res.blob();
  return { blob, filename: match?.[1] ?? null };
}

function DetailDialog({
  applicationId, open, onClose,
}: { applicationId: string | null; open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvOpening, setCvOpening] = useState<"view" | "download" | null>(null);
  const [videoOpening, setVideoOpening] = useState<"open" | "download" | null>(null);

  // ── Inline video player state ─────────────────────────────────────────────
  const [videoPlayerLoading, setVideoPlayerLoading] = useState(false);
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);
  const [videoPlayerError, setVideoPlayerError] = useState<string | null>(null);

  // Revoke blob URL and reset player when the dialog closes
  useEffect(() => {
    if (!open) {
      setVideoPlayerOpen(false);
      setVideoPlayerError(null);
      setVideoPlayerLoading(false);
      if (videoPlayerUrl) {
        URL.revokeObjectURL(videoPlayerUrl);
        setVideoPlayerUrl(null);
      }
    }
  }, [open]);

  const { data: detail, isLoading, isError } = useQuery<ApplicationDetail>({
    queryKey: ["/api/admin/job-applications", applicationId],
    queryFn: () => apiFetch(`/api/admin/job-applications/${applicationId}`),
    enabled: !!applicationId && open,
  });

  async function handleCvUpload(file: File) {
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only PDF or Word documents (.pdf, .doc, .docx) are allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }
    setCvUploading(true);
    try {
      const token = localStorage.getItem("onspot_jwt_token");
      const form = new FormData();
      form.append("resume", file);
      const res = await fetch(`/api/admin/job-applications/${applicationId}/resume`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      toast({ title: "CV uploaded", description: `${file.name} has been attached to this application.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications", applicationId] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setCvUploading(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  }

  async function handleViewCv() {
    if (!applicationId) return;
    // Open a blank tab immediately (same user gesture) so browsers don't block it
    const previewWindow = window.open("", "_blank");
    setCvOpening("view");
    try {
      const token = localStorage.getItem("onspot_jwt_token");
      const bypassAuth = import.meta.env.VITE_BYPASS_ADMIN_AUTH === "true";
      if (!token && !bypassAuth) {
        previewWindow?.close();
        toast({
          title: "Admin session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        return;
      }
      const response = await fetch(`/api/admin/job-applications/${applicationId}/resume`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.status === 401 || response.status === 403) {
        previewWindow?.close();
        toast({
          title: "Admin session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        return;
      }
      if (!response.ok) {
        previewWindow?.close();
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || body?.error || "Unable to load resume.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        // Fallback if pop-up was blocked anyway
        const a = document.createElement("a");
        a.href = objectUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // Revoke after 60 s — enough time for the new tab to load the PDF
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err: any) {
      previewWindow?.close();
      toast({ title: "Could not open CV", description: err.message, variant: "destructive" });
    } finally {
      setCvOpening(null);
    }
  }

  async function handleDownloadCv() {
    if (!applicationId || !detail) return;
    setCvOpening("download");
    try {
      const { blob, filename } = await getResumeBlob(applicationId);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename ?? detail.resumeFileName ?? "resume";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast({ title: "Could not download CV", description: err.message, variant: "destructive" });
    } finally {
      setCvOpening(null);
    }
  }

  /** Load video blob and show inline <video> player. */
  async function handlePlayVideo() {
    if (!applicationId) return;
    setVideoPlayerLoading(true);
    setVideoPlayerError(null);
    // Revoke previous blob URL to avoid memory leaks
    if (videoPlayerUrl) {
      URL.revokeObjectURL(videoPlayerUrl);
      setVideoPlayerUrl(null);
    }
    try {
      const { blob } = await getVideoBlob(applicationId);
      const url = URL.createObjectURL(blob);
      setVideoPlayerUrl(url);
      setVideoPlayerOpen(true);
    } catch (err: any) {
      setVideoPlayerError(err.message ?? "Could not load video.");
      setVideoPlayerOpen(true); // show error state in the player area
    } finally {
      setVideoPlayerLoading(false);
    }
  }

  /** Open video in a new browser tab (fallback / larger-screen viewing). */
  async function handleOpenVideo() {
    if (!applicationId) return;
    const previewWindow = window.open("", "_blank");
    setVideoOpening("open");
    try {
      const token = localStorage.getItem("onspot_jwt_token");
      const response = await fetch(`/api/admin/job-applications/${applicationId}/video`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        previewWindow?.close();
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || body?.error || "Unable to load video.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err: any) {
      previewWindow?.close();
      toast({ title: "Could not open video", description: err.message, variant: "destructive" });
    } finally {
      setVideoOpening(null);
    }
  }

  async function handleDownloadVideo() {
    if (!applicationId || !detail) return;
    setVideoOpening("download");
    try {
      const { blob, filename } = await getVideoBlob(applicationId);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename ?? detail.videoIntroductionFileName ?? "video-intro";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast({ title: "Could not download video", description: err.message, variant: "destructive" });
    } finally {
      setVideoOpening(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Application Details</DialogTitle>
          <DialogDescription className="sr-only">
            Review applicant information, resume, cover letter, and application status.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#474ead]" /></div>}
        {isError && <p className="text-sm text-red-500 py-4">Failed to load application details.</p>}
        {detail && (
          <div className="space-y-5 text-sm">
            {/* Applicant */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Applicant</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600">
                <div><dt className="text-xs text-slate-400 uppercase">Name</dt><dd className="font-medium text-slate-800">{applicantName(detail)}</dd></div>
                <div><dt className="text-xs text-slate-400 uppercase">Email</dt><dd>{detail.email}</dd></div>
                <div><dt className="text-xs text-slate-400 uppercase">Phone</dt><dd>{detail.phone ?? "—"}</dd></div>
                <div><dt className="text-xs text-slate-400 uppercase">Submitted</dt><dd>{fmtDate(detail.submittedAt)}</dd></div>
              </dl>
            </section>

            {/* Job */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Applied for</h3>
              <p className="font-medium text-slate-800">{detail.jobTitle}</p>
              {detail.jobCompany && <p className="text-slate-500">{detail.jobCompany}</p>}
            </section>

            {/* Status */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Status</h3>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={detail.status} />
                <RegBadge status={detail.registrationStatus} />
                {detail.initiatedBy === "client" && (
                  <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    Client invited
                  </span>
                )}
              </div>
              {detail.talentId && (
                detail.candidateId ? (
                  <button
                    onClick={() => { onClose(); navigate(`/talent-profile/${detail.candidateId}`); }}
                    className="mt-2 text-xs text-[#474ead] hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> View Talent Profile
                  </button>
                ) : (
                  <span className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Talent profile not linked yet
                  </span>
                )
              )}
            </section>

            {/* Resume / CV */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Resume / CV</h3>
              {detail.resumeUrl ? (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#474ead]/10">
                      <FileText className="h-4 w-4 text-[#474ead]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {detail.resumeFileName ?? "Resume"}
                      </p>
                      {detail.resumeSource && (
                        <p className="text-xs text-slate-400">
                          {detail.resumeSource === "application"
                            ? "Submitted with application"
                            : "Uploaded during Find Best Matches"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        disabled={cvOpening !== null}
                        onClick={handleViewCv}
                        className="flex items-center gap-1 text-xs text-[#474ead] hover:underline disabled:opacity-50"
                      >
                        {cvOpening === "view"
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Opening…</>
                          : <><Eye className="h-3 w-3" /> View</>}
                      </button>
                      <button
                        disabled={cvOpening !== null}
                        onClick={handleDownloadCv}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:underline disabled:opacity-50"
                      >
                        {cvOpening === "download"
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Downloading…</>
                          : <><Download className="h-3 w-3" /> Download</>}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <FileText className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-600">No CV available for this applicant.</p>
                      <p className="text-xs text-slate-400">No resume was submitted with this application, and no Find Best Matches CV was found.</p>
                    </div>
                    <div className="shrink-0">
                      <input
                        ref={cvInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleCvUpload(e.target.files[0])}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cvUploading}
                        onClick={() => cvInputRef.current?.click()}
                        className="h-8 text-xs gap-1.5 border-[#474ead] text-[#474ead] hover:bg-[#474ead]/10"
                      >
                        {cvUploading ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                        ) : (
                          <><FileText className="h-3 w-3" /> Upload CV</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Video Introduction */}
            {detail.videoIntroductionUrl && (
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">Video Introduction</h3>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  {/* File info row */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                      <Video className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {detail.videoIntroductionFileName ?? "Video Introduction"}
                      </p>
                      <p className="text-xs text-slate-400">Submitted with application</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Play Video — loads blob and shows inline player */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                        disabled={videoPlayerLoading || videoOpening !== null}
                        onClick={handlePlayVideo}
                        aria-label="Play video introduction inline"
                      >
                        {videoPlayerLoading
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Loading…</>
                          : <><Play className="h-3 w-3" /> Play Video</>}
                      </Button>
                      {/* Open in new tab — fallback for large files or unsupported codec */}
                      <button
                        disabled={videoOpening !== null || videoPlayerLoading}
                        onClick={handleOpenVideo}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:underline disabled:opacity-50"
                        aria-label="Open video in new tab"
                      >
                        {videoOpening === "open"
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Opening…</>
                          : <><ExternalLink className="h-3 w-3" /> Open</>}
                      </button>
                      {/* Download */}
                      <button
                        disabled={videoOpening !== null || videoPlayerLoading}
                        onClick={handleDownloadVideo}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:underline disabled:opacity-50"
                        aria-label="Download video introduction"
                      >
                        {videoOpening === "download"
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Downloading…</>
                          : <><Download className="h-3 w-3" /> Download</>}
                      </button>
                    </div>
                  </div>

                  {/* Inline video player — shown after Play Video is clicked */}
                  {videoPlayerOpen && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      {videoPlayerError ? (
                        <div className="flex flex-col items-center gap-2 py-6 text-sm text-slate-500 text-center">
                          <AlertTriangle className="h-5 w-5 text-amber-400" />
                          <p className="font-medium">Video unavailable</p>
                          <p className="text-xs text-slate-400 max-w-xs">{videoPlayerError}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <button
                              className="text-xs text-violet-600 hover:underline disabled:opacity-50"
                              onClick={handlePlayVideo}
                              disabled={videoPlayerLoading}
                              aria-label="Retry loading video"
                            >
                              {videoPlayerLoading ? "Loading…" : "Retry"}
                            </button>
                            <button
                              className="text-xs text-slate-500 hover:underline"
                              onClick={handleOpenVideo}
                              aria-label="Open video in new tab"
                            >
                              Open in new tab
                            </button>
                          </div>
                        </div>
                      ) : videoPlayerUrl ? (
                        <video
                          controls
                          preload="metadata"
                          className="w-full max-h-[360px] rounded-lg bg-black"
                          title={detail.videoIntroductionFileName ?? "Video Introduction"}
                          onError={() => setVideoPlayerError("Video could not be played in the browser. Try opening it in a new tab.")}
                          aria-label={`Video introduction: ${detail.videoIntroductionFileName ?? "Video Introduction"}`}
                        >
                          <source src={videoPlayerUrl} />
                          Your browser does not support video playback.
                        </video>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Cover Letter */}
            {detail.coverLetter && (
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">Cover Letter</h3>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 whitespace-pre-wrap text-slate-700 text-sm leading-relaxed">
                  {detail.coverLetter}
                </div>
              </section>
            )}

            {/* History */}
            {detail.history && detail.history.length > 0 && (
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">Status History</h3>
                <ol className="space-y-2">
                  {detail.history.map((h) => (
                    <li key={h.id} className="flex gap-3 text-xs">
                      <span className="mt-0.5 h-4 w-4 rounded-full bg-[#474ead]/20 flex items-center justify-center flex-shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#474ead]" />
                      </span>
                      <div>
                        <span className="font-medium text-slate-800">
                          {h.previousStatus ? `${STATUS_CFG[h.previousStatus]?.label ?? h.previousStatus} → ` : ""}
                          {STATUS_CFG[h.newStatus]?.label ?? h.newStatus}
                        </span>
                        {h.note && <p className="text-slate-500 italic mt-0.5">"{h.note}"</p>}
                        <p className="text-slate-400 mt-0.5">{fmtDate(h.createdAt)}{h.changedByName ? ` · ${h.changedByName}` : ""}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Update Dialog ─────────────────────────────────────────────────────

function StatusDialog({
  applicationId, currentStatus, open, onClose, onSuccess,
}: { applicationId: string | null; currentStatus: string; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [confirmHired, setConfirmHired] = useState(false);

  useEffect(() => { if (open) { setStatus(""); setNote(""); setConfirmHired(false); } }, [open]);

  const mutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/job-applications/${applicationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    }),
    onSuccess: () => {
      toast({ title: "Status updated", description: `Application moved to ${STATUS_CFG[status]?.label ?? status}.` });
      onSuccess();
      onClose();
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const needsHiredConfirm = status === "hired" && !confirmHired;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Application Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium">Current status</Label>
            <p className="mt-1"><StatusBadge status={currentStatus} /></p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-status">New status <span className="text-red-500">*</span></Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="new-status">
                <SelectValue placeholder="Select a status…" />
              </SelectTrigger>
              <SelectContent>
                {VALID_STATUSES.filter(s => s !== currentStatus).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_CFG[s]?.label ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status-note">Internal note (optional)</Label>
            <Textarea
              id="status-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add an internal note about this status change…"
              className="h-20 resize-none text-sm"
            />
            <p className="text-xs text-slate-400">This note is not visible to the applicant.</p>
          </div>
          {status === "hired" && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
              <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Marking as Hired
              </p>
              <p className="text-xs text-green-700">
                This changes the application status only. It does not automatically create payroll, employee, contract, or payment records.
              </p>
              <label className="flex items-center gap-2 text-xs text-green-800 cursor-pointer">
                <Checkbox checked={confirmHired} onCheckedChange={v => setConfirmHired(!!v)} />
                I understand — change status to Hired
              </label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!status || mutation.isPending || needsHiredConfirm}
            onClick={() => mutation.mutate()}
            className="bg-[#474ead] text-white hover:bg-[#3d439c]"
          >
            {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  app,
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  app: Application | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  if (!app) return null;
  return (
    <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this application?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This will permanently delete this job application submission. The applicant's Talent account and profile will not be deleted.</p>
              <dl className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-1.5">
                <div className="flex gap-2">
                  <dt className="text-slate-500 w-20 shrink-0">Applicant</dt>
                  <dd className="font-medium text-slate-800">{applicantName(app)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500 w-20 shrink-0">Job</dt>
                  <dd className="font-medium text-slate-800">{app.jobTitle}</dd>
                </div>
                {app.submittedAt && (
                  <div className="flex gap-2">
                    <dt className="text-slate-500 w-20 shrink-0">Submitted</dt>
                    <dd className="text-slate-700">{fmtDate(app.submittedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
            ) : (
              "Delete Application"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Bulk Reject Confirm ──────────────────────────────────────────────────────

function BulkConfirm({
  open, count, action, onConfirm, onCancel,
}: { open: boolean; count: number; action: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={v => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm bulk {action}</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark {count} application{count !== 1 ? "s" : ""} as{" "}
            <strong>{STATUS_CFG[action]?.label ?? action}</strong>. This cannot be undone easily.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Yes, {action === "rejected" ? "Reject" : "Update"} {count} application{count !== 1 ? "s" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

// TODO: Restore AdminProtectedRoute and admin API authorization before production launch.
export default function AdminJobApplications() {
  const [, navigate] = useLocation();
  const rawSearch = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Filter state (synced with URL) ────────────────────────────────────────
  const [search, setSearch] = useState(() => new URLSearchParams(rawSearch).get("search") ?? "");
  const [jobFilter, setJobFilter] = useState(() => new URLSearchParams(rawSearch).get("jobId") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => new URLSearchParams(rawSearch).get("status") ?? "");
  const [regFilter, setRegFilter] = useState(() => new URLSearchParams(rawSearch).get("registrationStatus") ?? "");
  const [initiatedByFilter, setInitiatedByFilter] = useState(() => new URLSearchParams(rawSearch).get("initiatedBy") ?? "");
  const [dateFrom, setDateFrom] = useState(() => new URLSearchParams(rawSearch).get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(() => new URLSearchParams(rawSearch).get("dateTo") ?? "");
  const [page, setPage] = useState(() => parseInt(new URLSearchParams(rawSearch).get("page") ?? "1", 10));
  const LIMIT = 20;

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ id: string; current: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Application | null>(null);
  const [emailDialog, setEmailDialog] = useState<Application | null>(null);

  // ── Email send confirmation (lifted from composer to avoid Radix nested-dialog focus-lock) ────
  // The confirmation is a separate top-level Radix Dialog rendered as a sibling of the Email
  // Applicant modal so it gets its own portal, overlay, and focus-lock scope.
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailPendingPayload, setEmailPendingPayload] = useState<{
    subject: string; bodyHtml: string; templateId: string; senderEmail: string; senderLabel: string;
  } | null>(null);
  const [emailConfirmStage, setEmailConfirmStage] = useState("");

  const sendEmailMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/job-applications/${emailDialog!.id}/email/send`, {
      method: "POST",
      body: JSON.stringify({
        templateId: emailPendingPayload?.templateId || undefined,
        subject: emailPendingPayload?.subject,
        bodyHtml: emailPendingPayload?.bodyHtml,
        senderEmail: emailPendingPayload?.senderEmail,
        updateStage: emailConfirmStage || undefined,
      }),
    }),
    onSuccess: () => {
      toast({ title: "Email sent", description: `Email delivered to ${emailDialog?.email}.` });
      setEmailConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications", emailDialog?.id, "email/history"] });
      if (emailConfirmStage) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications/summary"] });
      }
      setEmailDialog(null);
    },
    onError: (err: any) => {
      setEmailConfirmOpen(false);
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  function handleEmailSendRequest(payload: { subject: string; bodyHtml: string; templateId: string; senderEmail: string; senderLabel: string }) {
    setEmailPendingPayload(payload);
    setEmailConfirmStage("");
    setEmailConfirmOpen(true);
  }

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);

  // ── Build query string ────────────────────────────────────────────────────
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(LIMIT));
    if (search.trim()) p.set("search", search.trim());
    if (jobFilter) p.set("jobId", jobFilter);
    if (statusFilter) p.set("status", statusFilter);
    if (regFilter) p.set("registrationStatus", regFilter);
    if (initiatedByFilter) p.set("initiatedBy", initiatedByFilter);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p.toString();
  }, [page, search, jobFilter, statusFilter, regFilter, initiatedByFilter, dateFrom, dateTo]);

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams(qs);
    if (params.get("page") === "1") params.delete("page");
    const newQs = params.toString();
    window.history.replaceState(null, "", newQs ? `?${newQs}` : window.location.pathname);
  }, [qs]);

  // ── Queries ───────────────────────────────────────────────────────────────
  // Use a two-part key [prefix, qs] so prefix-based invalidation clears all
  // paginated variants at once (not just the current exact URL).
  const listKeyPrefix = "/api/admin/job-applications";
  const listKey = [listKeyPrefix, qs];
  const { data: listData, isLoading, isError, refetch } = useQuery<ListResponse>({
    queryKey: listKey,
    queryFn: () => apiFetch(`/api/admin/job-applications?${qs}`),
    placeholderData: (prev: ListResponse | undefined) => prev,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["/api/admin/job-applications/summary"],
    queryFn: () => apiFetch("/api/admin/job-applications/summary"),
    staleTime: 30_000,
  });

  // Fetch ALL jobs for the filter dropdown using a dedicated lightweight endpoint.
  // /api/admin/jobs is paginated (25/page), so we must NOT use it here or the
  // dropdown would silently show only the first 25 jobs.
  const { data: jobsData } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/admin/jobs/options"],
    queryFn: () => apiFetch("/api/admin/jobs/options"),
    staleTime: 60_000,
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  const total = listData?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / LIMIT) : 1;
  const items = listData?.items ?? [];
  const startItem = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const endItem = Math.min(page * LIMIT, total);

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const allPageIds = items.map(a => a.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every(id => selected.has(id));
  const toggleAll = () => {
    if (allSelected) setSelected(prev => { const n = new Set(prev); allPageIds.forEach(id => n.delete(id)); return n; });
    else setSelected(prev => { const n = new Set(prev); allPageIds.forEach(id => n.add(id)); return n; });
  };

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id =>
        apiFetch(`/api/admin/job-applications/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        })
      ));
    },
    onSuccess: () => {
      toast({ title: "Bulk update complete", description: `${selected.size} applications updated.` });
      setSelected(new Set());
      setBulkAction(null);
      queryClient.invalidateQueries({ queryKey: [listKeyPrefix] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications/summary"] });
    },
    onError: (err: any) => toast({ title: "Bulk update failed", description: err.message, variant: "destructive" }),
  });

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (applicationId: string) =>
      apiFetch(`/api/admin/job-applications/${applicationId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Application deleted successfully." });
      setDeleteDialog(null);
      // If the deleted row was the only item on the current page, move back
      if (items.length === 1 && page > 1) setPage(p => p - 1);
      queryClient.invalidateQueries({ queryKey: [listKeyPrefix] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications/summary"] });
    },
    onError: (err: any) => toast({
      title: "Unable to delete the application. Please try again.",
      description: err.message,
      variant: "destructive",
    }),
  });

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetFilters = () => {
    setSearch(""); setJobFilter(""); setStatusFilter(""); setRegFilter("");
    setInitiatedByFilter(""); setDateFrom(""); setDateTo(""); setPage(1); setSelected(new Set());
  };
  const hasFilters = search || jobFilter || statusFilter || regFilter || initiatedByFilter || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* Dev-only bypass notice */}
        {import.meta.env.VITE_BYPASS_ADMIN_AUTH === "true" && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
            ⚠️ Admin authentication is temporarily disabled for development testing.
            Set <code className="font-mono bg-amber-100 px-1 rounded">VITE_BYPASS_ADMIN_AUTH=false</code> to re-enable before production.
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Job Applications</h1>
          <p className="text-sm text-slate-500 mt-0.5">Monitor and manage applications submitted through Find Work.</p>
        </div>

        {/* Summary cards */}
        <div className="mb-6">
          <SummaryCards summary={summary} loading={summaryLoading} />
        </div>

        {/* Filter toolbar */}
        <Card className="mb-4 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Search */}
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Search name, email, phone, job…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>

              {/* Job filter */}
              <div className="w-44">
                <Select value={jobFilter || "_all"} onValueChange={v => { setJobFilter(v === "_all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All jobs" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All jobs</SelectItem>
                    {(jobsData ?? []).map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Application status */}
              <div className="w-40">
                <Select value={statusFilter || "_all"} onValueChange={v => { setStatusFilter(v === "_all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All statuses</SelectItem>
                    {VALID_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Account status */}
              <div className="w-40">
                <Select value={regFilter || "_all"} onValueChange={v => { setRegFilter(v === "_all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Account status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All account statuses</SelectItem>
                    {Object.entries(REG_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Client invited filter */}
              <div className="w-40">
                <Select value={initiatedByFilter || "_all"} onValueChange={v => { setInitiatedByFilter(v === "_all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All sources" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All sources</SelectItem>
                    <SelectItem value="client">Client invited</SelectItem>
                    <SelectItem value="talent">Self-applied</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date from */}
              <div className="w-36">
                <Input type="date" className="h-9 text-sm" value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
              </div>
              {/* Date to */}
              <div className="w-36">
                <Input type="date" className="h-9 text-sm" value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }} />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-slate-500 hover:text-slate-700">
                  <XCircle className="mr-1.5 h-4 w-4" /> Reset
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#474ead]/10 border border-[#474ead]/20 px-4 py-2.5 text-sm">
            <span className="font-medium text-[#474ead]">{selected.size} selected</span>
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => bulkMutation.mutate({ ids: [...selected], status: "under_review" })}>
              Mark Under Review
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setBulkAction("rejected")}>
              Reject Selected
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto"
              onClick={() => setSelected(new Set())}>
              Deselect all
            </Button>
          </div>
        )}

        {/* Table */}
        <Card className="shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Applicant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">App Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && isError && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center">
                    <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Failed to load applications.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button>
                  </td></tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-16 text-center">
                    <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-600">{hasFilters ? "No applications match your filters." : "No applications yet."}</p>
                    {hasFilters && <Button size="sm" variant="outline" className="mt-3" onClick={resetFilters}>Clear filters</Button>}
                  </td></tr>
                )}
                {items.map(app => (
                  <tr key={app.id} className={`hover:bg-slate-50 transition-colors ${selected.has(app.id) ? "bg-[#474ead]/5" : ""}`}>
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selected.has(app.id)}
                        onCheckedChange={v => setSelected(prev => { const n = new Set(prev); v ? n.add(app.id) : n.delete(app.id); return n; })}
                        aria-label={`Select ${applicantName(app)}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{applicantName(app)}</p>
                      {app.talentId && <span className="text-xs text-[#474ead] flex items-center gap-1 mt-0.5"><UserCheck className="h-3 w-3" /> Talent linked</span>}
                      {app.isRepeatApplication && (
                        <span className="inline-block mt-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Repeat
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-slate-800">{app.jobTitle}</p>
                      {app.jobCompany && <p className="text-xs text-slate-400 truncate">{app.jobCompany}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{app.email}</p>
                      {app.phone && <p className="text-xs text-slate-400">{app.phone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={app.status} />
                        {app.initiatedBy === "client" && (
                          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                            Client invited
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><RegBadge status={app.registrationStatus} /></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(app.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => setDetailId(app.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => setStatusDialog({ id: app.id, current: app.status })}>
                          Status
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-xs border-[#474ead]/30 text-[#474ead] hover:bg-[#474ead]/10 hover:border-[#474ead]/50"
                          onClick={() => setEmailDialog(app)}
                          aria-label={`Email ${applicantName(app)}`}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                          onClick={() => setDeleteDialog(app)}
                          aria-label={`Delete application from ${applicantName(app)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /></div>
              </div>
            ))}
            {!isLoading && items.map(app => (
              <div key={app.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-900">{applicantName(app)}</p>
                    <p className="text-xs text-slate-500">{app.email}</p>
                  </div>
                  <p className="text-xs text-slate-400">{fmtDate(app.submittedAt)}</p>
                </div>
                <p className="text-sm text-slate-700 truncate">{app.jobTitle}</p>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={app.status} />
                  <RegBadge status={app.registrationStatus} />
                  {app.initiatedBy === "client" && (
                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      Client invited
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setDetailId(app.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                    onClick={() => setStatusDialog({ id: app.id, current: app.status })}>
                    Change Status
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 px-2 text-xs border-[#474ead]/30 text-[#474ead] hover:bg-[#474ead]/10"
                    onClick={() => setEmailDialog(app)}
                    aria-label={`Email ${applicantName(app)}`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    onClick={() => setDeleteDialog(app)}
                    aria-label={`Delete application from ${applicantName(app)}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {!isLoading && items.length === 0 && (
              <div className="py-16 text-center">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-600">{hasFilters ? "No applications match your filters." : "No applications yet."}</p>
              </div>
            )}
          </div>

          {/* Pagination — always show range; show controls only when totalPages > 1 */}
          {!isLoading && listData && (
            <div className="border-t border-slate-100 px-4 py-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
                <span>
                  Showing {startItem.toLocaleString()}–{endItem.toLocaleString()} of {total.toLocaleString()} applications
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-400 mr-1">20 per page</span>
                    <Button size="sm" variant="outline" disabled={page <= 1}
                      onClick={() => setPage(1)}>
                      First
                    </Button>
                    <Button size="sm" variant="outline" disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}>
                      ← Previous
                    </Button>
                    {getPaginationPages(page, totalPages).map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-sm text-slate-400">…</span>
                      ) : (
                        <Button
                          key={p}
                          size="sm"
                          variant={page === p ? "default" : "outline"}
                          className={page === p
                            ? "bg-[#474ead] text-white hover:bg-[#3d439c] min-w-[2rem]"
                            : "min-w-[2rem]"}
                          onClick={() => setPage(p as number)}
                        >
                          {p}
                        </Button>
                      )
                    )}
                    <Button size="sm" variant="outline" disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      Next →
                    </Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}>
                      Last
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Dialogs */}
      <DetailDialog applicationId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
      <StatusDialog
        applicationId={statusDialog?.id ?? null}
        currentStatus={statusDialog?.current ?? ""}
        open={!!statusDialog}
        onClose={() => setStatusDialog(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [listKeyPrefix] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications/summary"] });
        }}
      />
      <BulkConfirm
        open={bulkAction === "rejected"}
        count={selected.size}
        action="rejected"
        onConfirm={() => bulkMutation.mutate({ ids: [...selected], status: "rejected" })}
        onCancel={() => setBulkAction(null)}
      />
      <DeleteConfirmDialog
        app={deleteDialog}
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        isPending={deleteMutation.isPending}
      />
      <Suspense fallback={null}>
        <ApplicantEmailComposer
          application={emailDialog ? {
            id: emailDialog.id,
            email: emailDialog.email,
            firstName: emailDialog.firstName,
            lastName: emailDialog.lastName,
            applicantName: emailDialog.applicantName,
            jobTitle: emailDialog.jobTitle,
          } : null}
          open={!!emailDialog}
          onClose={() => setEmailDialog(null)}
          onRequestSend={handleEmailSendRequest}
          isSendingEmail={sendEmailMutation.isPending}
        />
      </Suspense>

      {/* ── Email send confirmation ────────────────────────────────────────────
          Separate top-level Radix Dialog rendered as a sibling to the Email Applicant
          modal. Each Radix Dialog gets its own portal, overlay, and focus-lock scope,
          so the buttons here are always reachable regardless of which dialog opened first. */}
      <Dialog
        open={emailConfirmOpen}
        onOpenChange={v => { if (!v && !sendEmailMutation.isPending) setEmailConfirmOpen(false); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm: Send Email</DialogTitle>
            <DialogDescription>
              Review the details below before sending. You can optionally update the applicant&apos;s stage at the same time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-1.5">
              <div className="flex gap-2">
                <span className="text-slate-500 w-16 shrink-0">From</span>
                <span className="text-slate-700">{emailPendingPayload?.senderLabel ?? "OnSpot Careers <careers@onspotglobal.com>"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-16 shrink-0">To</span>
                <span className="font-medium text-slate-800">{emailDialog?.email}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-16 shrink-0">Subject</span>
                <span className="text-slate-700 truncate">{emailPendingPayload?.subject}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Also update application stage</Label>
              <Select
                value={emailConfirmStage || "_none"}
                onValueChange={v => setEmailConfirmStage(v === "_none" ? "" : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([
                    { value: "_none",        label: "— No stage change —" },
                    { value: "under_review", label: "Under Review" },
                    { value: "shortlisted",  label: "Shortlisted" },
                    { value: "interview",    label: "Interview" },
                    { value: "offered",      label: "Offered" },
                    { value: "hired",        label: "Hired" },
                    { value: "rejected",     label: "Rejected" },
                    { value: "withdrawn",    label: "Withdrawn" },
                  ] as const).map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEmailConfirmOpen(false)}
              disabled={sendEmailMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#474ead] hover:bg-[#3d439c] text-white"
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending}
            >
              {sendEmailMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
