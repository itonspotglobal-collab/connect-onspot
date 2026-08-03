import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Eye, EyeOff, Copy, Mail, Info, Loader2,
} from "lucide-react";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

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

const CATEGORIES = [
  { value: "application_received",   label: "Application Received" },
  { value: "under_review",           label: "Under Review" },
  { value: "shortlisted",            label: "Shortlisted" },
  { value: "interview_invitation",   label: "Interview Invitation" },
  { value: "interview_confirmed",    label: "Interview Confirmed" },
  { value: "offer_extended",         label: "Offer Extended" },
  { value: "hired",                  label: "Hired / Welcome" },
  { value: "rejection_early",        label: "Rejection (Early)" },
  { value: "rejection_post_interview", label: "Rejection (Post-Interview)" },
  { value: "withdrawn",              label: "Withdrawn" },
  { value: "follow_up",              label: "Follow-Up" },
  { value: "document_request",       label: "Document Request" },
  { value: "reference_check",        label: "Reference Check" },
  { value: "general_update",         label: "General Update" },
];

const STAGES = [
  { value: "",              label: "— None —" },
  { value: "submitted",     label: "Submitted" },
  { value: "under_review",  label: "Under Review" },
  { value: "shortlisted",   label: "Shortlisted" },
  { value: "interview",     label: "Interview" },
  { value: "offered",       label: "Offered" },
  { value: "hired",         label: "Hired" },
  { value: "rejected",      label: "Rejected" },
  { value: "withdrawn",     label: "Withdrawn" },
];

const VARIABLES = [
  { key: "applicant_first_name", label: "First Name" },
  { key: "applicant_last_name",  label: "Last Name" },
  { key: "applicant_full_name",  label: "Full Name" },
  { key: "applicant_email",      label: "Email" },
  { key: "applicant_phone",      label: "Phone" },
  { key: "job_title",            label: "Job Title" },
  { key: "job_company",          label: "Company" },
  { key: "job_location",         label: "Job Location" },
  { key: "application_status",   label: "App Status" },
  { key: "submitted_date",       label: "Submitted Date" },
  { key: "portal_url",           label: "Portal URL" },
  { key: "company_name",         label: "Our Company" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

// TODO: Protect this page with admin authorization before production launch.
export default function AdminEmailTemplateEditor() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const isCreate = !params.id;
  const templateId = params.id;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [category, setCategory] = useState("general_update");
  const [stage, setStage] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load existing template
  const { data: existingTpl, isLoading: loadingTpl } = useQuery({
    queryKey: ["/api/admin/email-templates", templateId],
    queryFn: () => apiFetch(`/api/admin/email-templates/${templateId}`),
    enabled: !isCreate && !!templateId,
  });

  useEffect(() => {
    if (existingTpl) {
      setName(existingTpl.name ?? "");
      setSubject(existingTpl.subject ?? "");
      setBodyHtml(existingTpl.bodyHtml ?? "");
      setCategory(existingTpl.category ?? "general_update");
      setStage(existingTpl.stage ?? "");
      setIsPublished(existingTpl.isPublished ?? false);
      setIsDefault(existingTpl.isDefault ?? false);
      setDirty(false);
    }
  }, [existingTpl]);

  function markDirty() { setDirty(true); }

  // Insert variable token into subject
  function insertVariableInSubject(key: string) {
    setSubject(prev => prev + `{{${key}}}`);
    markDirty();
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!name.trim() || !subject.trim() || !bodyHtml.trim() || !category) {
        throw new Error("Name, subject, body, and category are required.");
      }
      const payload = { name, subject, bodyHtml, category, stage: stage || null, isPublished, isDefault };
      if (isCreate) {
        return apiFetch("/api/admin/email-templates", { method: "POST", body: JSON.stringify(payload) });
      }
      return apiFetch(`/api/admin/email-templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      toast({ title: isCreate ? "Template created." : "Template saved." });
      setDirty(false);
      if (isCreate && data?.id) {
        navigate(`/admin/email-templates/${data.id}/edit`);
      }
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  // Publish toggle mutation
  const publishMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/email-templates/${templateId}/publish`, { method: "POST" }),
    onSuccess: (data) => {
      setIsPublished(data.isPublished);
      toast({ title: data.isPublished ? "Template published." : "Template unpublished." });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const isBusy = saveMutation.isPending || publishMutation.isPending;

  if (!isCreate && loadingTpl) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNavigation />
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />

      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/email-templates")}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#474ead]" />
            <h1 className="text-base font-semibold text-slate-900 truncate max-w-xs">
              {isCreate ? "New Template" : (name || "Edit Template")}
            </h1>
          </div>
          {!isCreate && (
            <Badge className={`text-xs ml-1 ${
              isPublished
                ? "bg-green-100 text-green-800 border border-green-200 hover:bg-green-100"
                : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}>
              {isPublished ? "Published" : "Draft"}
            </Badge>
          )}
          {dirty && (
            <span className="text-xs text-amber-600 font-medium ml-1">● Unsaved</span>
          )}
          <div className="flex-1" />
          {!isCreate && (
            <Button
              size="sm" variant="outline" className="h-8 text-xs"
              onClick={() => publishMutation.mutate()}
              disabled={isBusy}
            >
              {isPublished
                ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Unpublish</>
                : <><Eye className="mr-1.5 h-3.5 w-3.5" /> Publish</>
              }
            </Button>
          )}
          <Button
            size="sm"
            className="bg-[#474ead] hover:bg-[#3d439c] text-white h-8 text-xs"
            onClick={() => saveMutation.mutate()}
            disabled={isBusy}
          >
            {saveMutation.isPending
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
              : <><Save className="mr-1.5 h-3.5 w-3.5" /> Save</>
            }
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — main form */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Template Details</h2>

              <div className="space-y-1.5">
                <Label htmlFor="tpl-name" className="text-sm font-medium">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={e => { setName(e.target.value); markDirty(); }}
                  placeholder="e.g. Application Received"
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select value={category} onValueChange={v => { setCategory(v); markDirty(); }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Stage</Label>
                  <Select value={stage || "_none"} onValueChange={v => { setStage(v === "_none" ? "" : v); markDirty(); }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map(s => (
                        <SelectItem key={s.value || "_none"} value={s.value || "_none"}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Switch checked={isPublished} onCheckedChange={v => { setIsPublished(v); markDirty(); }} />
                  <span className="font-medium text-slate-700">Published</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Switch checked={isDefault} onCheckedChange={v => { setIsDefault(v); markDirty(); }} />
                  <span className="font-medium text-slate-700">Default for category</span>
                </label>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Email Content</h2>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-subject" className="text-sm font-medium">
                    Subject line <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES.slice(0, 4).map(v => (
                      <button
                        key={v.key}
                        onClick={() => insertVariableInSubject(v.key)}
                        className="text-xs px-1.5 py-0.5 rounded bg-[#474ead]/10 text-[#474ead] hover:bg-[#474ead]/20 transition-colors"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={e => { setSubject(e.target.value); markDirty(); }}
                  placeholder="e.g. We received your application — {{job_title}}"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Body <span className="text-red-500">*</span>
                </Label>
                <div className="min-h-[320px] border border-slate-200 rounded-md overflow-hidden">
                  <Suspense fallback={<Skeleton className="h-80 w-full" />}>
                    <RichTextEditor
                      value={bodyHtml}
                      onChange={v => { setBodyHtml(v); markDirty(); }}
                      placeholder="Compose the email body…"
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>

          {/* Right — variable reference */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sticky top-[72px]">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <Copy className="h-4 w-4 text-slate-400" />
                Variable Reference
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Click to copy. Paste anywhere in the subject or body.
              </p>
              <div className="space-y-1.5">
                {VARIABLES.map(v => (
                  <button
                    key={v.key}
                    onClick={() => {
                      navigator.clipboard.writeText(`{{${v.key}}}`).catch(() => {});
                      toast({ title: `Copied {{${v.key}}}` });
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group"
                  >
                    <span className="font-medium text-slate-700">{v.label}</span>
                    <code className="text-[#474ead] bg-[#474ead]/10 px-1.5 py-0.5 rounded group-hover:bg-[#474ead]/20 transition-colors">
                      {`{{${v.key}}}`}
                    </code>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Variables are resolved at send time using actual applicant and job data.
                Unresolved tokens remain visible in the sent email — always preview before sending.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
