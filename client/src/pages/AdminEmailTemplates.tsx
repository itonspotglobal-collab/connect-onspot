import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Plus, Edit, Copy, Archive, Trash2, Eye, EyeOff,
  AlertTriangle, Search, RefreshCw, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  subject: string;
  category: string;
  stage?: string;
  isPublished: boolean;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("onspot_jwt_token");
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  const ct = res.headers.get("content-type");
  if (!ct?.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Server returned non-JSON (${res.status}): ${t.slice(0, 200)}`);
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

const CATEGORY_LABELS: Record<string, string> = {
  application_received: "Application Received",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview_invitation: "Interview Invitation",
  interview_confirmed: "Interview Confirmed",
  offer_extended: "Offer Extended",
  hired: "Hired / Welcome",
  rejection_early: "Rejection (Early)",
  rejection_post_interview: "Rejection (Post-Interview)",
  withdrawn: "Withdrawn",
  follow_up: "Follow-Up",
  document_request: "Document Request",
  reference_check: "Reference Check",
  general_update: "General Update",
};

function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// TODO: Protect this page with admin authorization before production launch.
export default function AdminEmailTemplates() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const listKey = ["/api/admin/email-templates", showArchived];
  const { data: templates = [], isLoading, isError, refetch } = useQuery<Template[]>({
    queryKey: listKey,
    queryFn: () => apiFetch(`/api/admin/email-templates?archived=${showArchived}`),
  });

  // Derived / filtered
  const categories = Array.from(new Set(templates.map(t => t.category))).sort();
  const visible = templates.filter(t => {
    if (catFilter && t.category !== catFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const publishMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/email-templates/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({ title: "Template updated." });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/email-templates/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({ title: "Template archived." });
    },
    onError: (err: any) => toast({ title: "Archive failed", description: err.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/email-templates/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({ title: "Template duplicated." });
    },
    onError: (err: any) => toast({ title: "Duplicate failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/email-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      setDeleteTarget(null);
      toast({ title: "Template deleted." });
    },
    onError: (err: any) => {
      setDeleteTarget(null);
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="h-6 w-6 text-[#474ead]" />
              Email Templates
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage and publish applicant email templates.</p>
          </div>
          <Button
            onClick={() => navigate("/admin/email-templates/create")}
            className="bg-[#474ead] hover:bg-[#3d439c] text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> New Template
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="w-52">
            <Select value={catFilter || "_all"} onValueChange={v => setCatFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant={showArchived ? "default" : "outline"}
            className={`h-9 text-xs ${showArchived ? "bg-slate-700 text-white" : ""}`}
            onClick={() => setShowArchived(v => !v)}
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* List */}
        <Card className="shadow-sm overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))}
                {isError && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center">
                    <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Failed to load templates.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button>
                  </td></tr>
                )}
                {!isLoading && !isError && visible.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-14 text-center">
                    <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-600">No templates found.</p>
                    <Button
                      size="sm" className="mt-3 bg-[#474ead] hover:bg-[#3d439c] text-white"
                      onClick={() => navigate("/admin/email-templates/create")}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Create your first template
                    </Button>
                  </td></tr>
                )}
                {visible.map(tpl => (
                  <tr key={tpl.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{tpl.name}</p>
                      <p className="text-xs text-slate-400 truncate max-w-xs">{tpl.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600 text-xs">{categoryLabel(tpl.category)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tpl.isArchived ? (
                          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">Archived</Badge>
                        ) : tpl.isPublished ? (
                          <Badge className="text-xs bg-green-100 text-green-800 border border-green-200 hover:bg-green-100">Published</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">Draft</Badge>
                        )}
                        {tpl.isDefault && (
                          <Badge className="text-xs bg-[#474ead]/10 text-[#474ead] border border-[#474ead]/20 hover:bg-[#474ead]/10">Default</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(tpl.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => navigate(`/admin/email-templates/${tpl.id}/edit`)}
                        >
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => publishMutation.mutate(tpl.id)}
                          disabled={publishMutation.isPending || tpl.isArchived}
                          title={tpl.isPublished ? "Unpublish" : "Publish"}
                        >
                          {tpl.isPublished
                            ? <><EyeOff className="h-3 w-3 mr-1" /> Unpublish</>
                            : <><Eye className="h-3 w-3 mr-1" /> Publish</>
                          }
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => duplicateMutation.mutate(tpl.id)}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => archiveMutation.mutate(tpl.id)}
                          disabled={archiveMutation.isPending}
                          title={tpl.isArchived ? "Unarchive" : "Archive"}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(tpl)}
                        >
                          <Trash2 className="h-3 w-3" />
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
                <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" />
              </div>
            ))}
            {!isLoading && visible.map(tpl => (
              <div key={tpl.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-slate-900">{tpl.name}</p>
                  <div className="flex gap-1">
                    {tpl.isPublished && !tpl.isArchived && (
                      <span className="text-xs bg-green-100 text-green-800 border border-green-200 rounded-full px-2 py-0.5">Published</span>
                    )}
                    {tpl.isArchived && (
                      <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">Archived</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">{categoryLabel(tpl.category)}</p>
                <p className="text-xs text-slate-400 truncate">{tpl.subject}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                    onClick={() => navigate(`/admin/email-templates/${tpl.id}/edit`)}>
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                    onClick={() => publishMutation.mutate(tpl.id)} disabled={tpl.isArchived}>
                    {tpl.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(tpl)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {!isLoading && visible.length === 0 && !isError && (
              <div className="py-14 text-center">
                <Mail className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No templates found.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Delete confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete template?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{deleteTarget?.name}</strong>. This action cannot be undone.
                Email history records that used this template will be retained.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
