import { useState, useMemo, useEffect } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
  XCircle, UserCheck, Briefcase,
} from "lucide-react";

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

function DetailDialog({
  applicationId, open, onClose,
}: { applicationId: string | null; open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const { data: detail, isLoading, isError } = useQuery<ApplicationDetail>({
    queryKey: ["/api/admin/job-applications", applicationId],
    queryFn: () => apiFetch(`/api/admin/job-applications/${applicationId}`),
    enabled: !!applicationId && open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Application Details</DialogTitle>
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
              </div>
              {detail.talentId && (
                <button
                  onClick={() => { onClose(); navigate(`/admin/dashboard`); }}
                  className="mt-2 text-xs text-[#474ead] hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> View Talent Profile
                </button>
              )}
            </section>

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
  const [dateFrom, setDateFrom] = useState(() => new URLSearchParams(rawSearch).get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(() => new URLSearchParams(rawSearch).get("dateTo") ?? "");
  const [page, setPage] = useState(() => parseInt(new URLSearchParams(rawSearch).get("page") ?? "1", 10));
  const LIMIT = 20;

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ id: string; current: string } | null>(null);
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
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p.toString();
  }, [page, search, jobFilter, statusFilter, regFilter, dateFrom, dateTo]);

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams(qs);
    if (params.get("page") === "1") params.delete("page");
    const newQs = params.toString();
    window.history.replaceState(null, "", newQs ? `?${newQs}` : window.location.pathname);
  }, [qs]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const listKey = [`/api/admin/job-applications?${qs}`];
  const { data: listData, isLoading, isError, refetch } = useQuery<ListResponse>({
    queryKey: listKey,
    queryFn: () => apiFetch(`/api/admin/job-applications?${qs}`),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["/api/admin/job-applications/summary"],
    queryFn: () => apiFetch("/api/admin/job-applications/summary"),
    staleTime: 30_000,
  });

  // Fetch distinct jobs for the filter dropdown
  const { data: jobsData } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/admin/jobs-simple"],
    queryFn: async () => {
      const data = await apiFetch("/api/admin/jobs");
      const items: any[] = Array.isArray(data) ? data : (data.items ?? []);
      return items.map((j: any) => ({ id: j.id, title: j.title }));
    },
    staleTime: 60_000,
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = listData ? Math.ceil(listData.total / LIMIT) : 1;
  const items = listData?.items ?? [];

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
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications/summary"] });
    },
    onError: (err: any) => toast({ title: "Bulk update failed", description: err.message, variant: "destructive" }),
  });

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetFilters = () => {
    setSearch(""); setJobFilter(""); setStatusFilter(""); setRegFilter("");
    setDateFrom(""); setDateTo(""); setPage(1); setSelected(new Set());
  };
  const hasFilters = search || jobFilter || statusFilter || regFilter || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

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
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-slate-800">{app.jobTitle}</p>
                      {app.jobCompany && <p className="text-xs text-slate-400 truncate">{app.jobCompany}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{app.email}</p>
                      {app.phone && <p className="text-xs text-slate-400">{app.phone}</p>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
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
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setDetailId(app.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                    onClick={() => setStatusDialog({ id: app.id, current: app.status })}>
                    Change Status
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

          {/* Pagination */}
          {!isLoading && listData && listData.total > LIMIT && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
              <span>{listData.total} total · Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
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
          queryClient.invalidateQueries({ queryKey: listKey });
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
    </div>
  );
}
