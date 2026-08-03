import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Eye, Clock, Send, RefreshCw, Loader2,
  ChevronRight, AlertTriangle, CheckCircle2, X, Plus,
} from "lucide-react";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml?: string;
  category: string;
  stage?: string;
  isPublished: boolean;
  isDefault: boolean;
}

interface EmailHistoryRow {
  id: string;
  subject: string;
  sentTo: string;
  status: "sent" | "failed";
  errorMessage?: string;
  isTest: boolean;
  sentAt: string;
  templateName?: string;
  senderFirstName?: string;
  senderLastName?: string;
}

interface PreviewResult {
  subject: string;
  bodyHtml: string;
  unresolvedKeys: string[];
}

interface ApplicationInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  applicantName?: string;
  jobTitle?: string;
}

interface Props {
  application: ApplicationInfo | null;
  open: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("onspot_jwt_token");
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  }).then(async (res) => {
    const ct = res.headers.get("content-type");
    if (!ct?.includes("application/json")) {
      const t = await res.text();
      throw new Error(`Server returned non-JSON (${res.status}): ${t.slice(0, 200)}`);
    }
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body;
  });
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = "compose" | "preview" | "history";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "compose",  label: "Compose",  icon: Mail  },
    { id: "preview",  label: "Preview",  icon: Eye   },
    { id: "history",  label: "History",  icon: Clock },
  ];
  return (
    <div className="flex border-b border-slate-200 mb-4">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            active === id
              ? "border-[#474ead] text-[#474ead]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Compose Tab ──────────────────────────────────────────────────────────────

function ComposeTab({
  appId,
  templates,
  templatesLoading,
  templateId,
  setTemplateId,
  subject,
  setSubject,
  bodyHtml,
  setBodyHtml,
  onPreview,
  onSend,
  isSending,
  onTestSend,
  isTestSending,
}: {
  appId: string;
  templates: EmailTemplate[];
  templatesLoading: boolean;
  templateId: string;
  setTemplateId: (id: string) => void;
  subject: string;
  setSubject: (s: string) => void;
  bodyHtml: string;
  setBodyHtml: (s: string) => void;
  onPreview: () => void;
  onSend: () => void;
  isSending: boolean;
  onTestSend: () => void;
  isTestSending: boolean;
}) {
  const published = templates.filter(t => t.isPublished);

  // When template changes, load its content
  const { refetch: loadTemplate } = useQuery<EmailTemplate>({
    queryKey: ["/api/admin/email-templates", templateId],
    queryFn: () => apiFetch(`/api/admin/email-templates/${templateId}`),
    enabled: false,
  });

  async function handleTemplateChange(id: string) {
    setTemplateId(id);
    if (!id || id === "_none") {
      setSubject("");
      setBodyHtml("");
      return;
    }
    try {
      const data = await apiFetch(`/api/admin/email-templates/${id}`);
      setSubject(data.subject ?? "");
      setBodyHtml(data.bodyHtml ?? "");
    } catch {
      // ignore — keep current subject/body
    }
  }

  return (
    <div className="space-y-4">
      {/* Template selector */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Template (optional)</Label>
        {templatesLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select value={templateId || "_none"} onValueChange={v => handleTemplateChange(v === "_none" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a template…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— No template —</SelectItem>
              {published.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="email-subject" className="text-sm font-medium">
          Subject <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email-subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Email subject…"
          className="h-9 text-sm"
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Message <span className="text-red-500">*</span>
        </Label>
        <div className="min-h-[240px] border border-slate-200 rounded-md overflow-hidden">
          <Suspense fallback={<Skeleton className="h-60 w-full" />}>
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Compose your email…"
            />
          </Suspense>
        </div>
        <p className="text-xs text-slate-400">
          Use <code className="bg-slate-100 px-1 rounded">{"{{variable_name}}"}</code> tokens — e.g.{" "}
          <code className="bg-slate-100 px-1 rounded">{"{{applicant_first_name}}"}</code>.
          Variables are resolved when sending.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onPreview}
          disabled={!bodyHtml.trim()}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onTestSend}
          disabled={!subject.trim() || !bodyHtml.trim() || isTestSending}
        >
          {isTestSending
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending test…</>
            : <><Send className="mr-1.5 h-3.5 w-3.5" /> Test send</>
          }
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          className="bg-[#474ead] hover:bg-[#3d439c] text-white h-8 text-xs px-4"
          onClick={onSend}
          disabled={!subject.trim() || !bodyHtml.trim() || isSending}
        >
          {isSending
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending…</>
            : <><Send className="mr-1.5 h-3.5 w-3.5" /> Send Email</>
          }
        </Button>
      </div>
    </div>
  );
}

// ─── Preview Tab ──────────────────────────────────────────────────────────────

function PreviewTab({
  appId,
  templateId,
  subject,
  bodyHtml,
}: {
  appId: string;
  templateId: string;
  subject: string;
  bodyHtml: string;
}) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bodyHtml.trim()) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/admin/job-applications/${appId}/email/preview`, {
      method: "POST",
      body: JSON.stringify({ templateId: templateId || undefined, subject, bodyHtml }),
    })
      .then(data => { if (!cancelled) { setPreview(data); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [appId, templateId, subject, bodyHtml]);

  if (!bodyHtml.trim()) {
    return (
      <div className="py-16 text-center text-slate-400">
        <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Compose a message first to see a preview.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-[#474ead]" />
    </div>
  );

  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
      <AlertTriangle className="h-4 w-4 inline mr-1.5" /> {error}
    </div>
  );

  if (!preview) return null;

  return (
    <div className="space-y-3">
      {preview.unresolvedKeys.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 inline mr-1.5" />
          Unresolved variables: {preview.unresolvedKeys.map(k => (
            <code key={k} className="mx-1 bg-amber-100 px-1 rounded text-xs">{`{{${k}}}`}</code>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Subject</p>
        <p className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-2">
          {preview.subject}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Body</p>
        <iframe
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                   font-size: 14px; line-height: 1.6; color: #1e293b; padding: 16px; margin: 0; }
            a { color: #474ead; }
          </style></head><body>${preview.bodyHtml}</body></html>`}
          className="w-full border border-slate-200 rounded-lg bg-white"
          style={{ height: "360px" }}
          sandbox="allow-same-origin"
          title="Email preview"
        />
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ appId }: { appId: string }) {
  const { data: history, isLoading, isError, refetch } = useQuery<EmailHistoryRow[]>({
    queryKey: ["/api/admin/job-applications", appId, "email/history"],
    queryFn: () => apiFetch(`/api/admin/job-applications/${appId}/email/history`),
  });

  const { toast } = useToast();
  const retryMutation = useMutation({
    mutationFn: (emailId: string) =>
      apiFetch(`/api/admin/job-applications/${appId}/email/${emailId}/retry`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Email resent successfully." });
      refetch();
    },
    onError: (err: any) => toast({ title: "Retry failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );

  if (isError) return (
    <div className="py-8 text-center text-slate-500 text-sm">
      <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
      Failed to load email history.
    </div>
  );

  if (!history || history.length === 0) return (
    <div className="py-16 text-center text-slate-400">
      <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">No emails sent yet for this application.</p>
    </div>
  );

  return (
    <ol className="space-y-3">
      {history.map(row => (
        <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              row.status === "sent" ? "bg-green-100" : "bg-red-100"
            }`}>
              {row.status === "sent"
                ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                : <X className="h-3 w-3 text-red-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-slate-800 truncate">{row.subject}</p>
                {row.isTest && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-300 text-amber-700">
                    TEST
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                <span>To: {row.sentTo}</span>
                {row.templateName && <span>Template: {row.templateName}</span>}
                {(row.senderFirstName || row.senderLastName) && (
                  <span>By: {[row.senderFirstName, row.senderLastName].filter(Boolean).join(" ")}</span>
                )}
                <span>{fmtDate(row.sentAt)}</span>
              </div>
              {row.status === "failed" && row.errorMessage && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  {row.errorMessage}
                </p>
              )}
            </div>
            {row.status === "failed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs flex-shrink-0"
                disabled={retryMutation.isPending}
                onClick={() => retryMutation.mutate(row.id)}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Send Confirm Dialog ──────────────────────────────────────────────────────

function SendConfirmDialog({
  open,
  recipientEmail,
  subject,
  updateStage,
  setUpdateStage,
  onConfirm,
  onCancel,
  isSending,
}: {
  open: boolean;
  recipientEmail: string;
  subject: string;
  updateStage: string;
  setUpdateStage: (s: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSending: boolean;
}) {
  const STAGES = [
    { value: "", label: "— No stage change —" },
    { value: "under_review",  label: "Under Review" },
    { value: "shortlisted",   label: "Shortlisted" },
    { value: "interview",     label: "Interview" },
    { value: "offered",       label: "Offered" },
    { value: "hired",         label: "Hired" },
    { value: "rejected",      label: "Rejected" },
    { value: "withdrawn",     label: "Withdrawn" },
  ];

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Confirm: Send Email</h3>
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-1.5">
          <div className="flex gap-2">
            <span className="text-slate-500 w-16 shrink-0">To</span>
            <span className="font-medium text-slate-800">{recipientEmail}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-slate-500 w-16 shrink-0">Subject</span>
            <span className="text-slate-700 truncate">{subject}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Also update application stage</Label>
          <Select value={updateStage || "_none"} onValueChange={v => setUpdateStage(v === "_none" ? "" : v)}>
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
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isSending}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-[#474ead] hover:bg-[#3d439c] text-white"
            onClick={onConfirm}
            disabled={isSending}
          >
            {isSending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
              : "Send Email"
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Test Send Dialog ─────────────────────────────────────────────────────────

function TestSendDialog({
  open,
  onSend,
  onClose,
  isSending,
}: {
  open: boolean;
  onSend: (recipient: string) => void;
  onClose: () => void;
  isSending: boolean;
}) {
  const [email, setEmail] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Send Test Email</h3>
        <p className="text-sm text-slate-500">
          Sends the email to you (with <strong>[TEST]</strong> prefix) so you can verify the layout before sending to the applicant.
        </p>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Your email address</Label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSending}>Cancel</Button>
          <Button
            className="flex-1 bg-[#474ead] hover:bg-[#3d439c] text-white"
            onClick={() => onSend(email)}
            disabled={!email.trim() || isSending}
          >
            {isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : "Send Test"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Composer ────────────────────────────────────────────────────────────

export default function ApplicantEmailComposer({ application, open, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("compose");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [updateStage, setUpdateStage] = useState("");

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab("compose");
      setTemplateId("");
      setSubject("");
      setBodyHtml("");
      setShowSendConfirm(false);
      setShowTestDialog(false);
      setUpdateStage("");
    }
  }, [open]);

  // Load published templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: () => apiFetch("/api/admin/email-templates"),
    enabled: open,
    staleTime: 60_000,
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/job-applications/${application!.id}/email/send`, {
      method: "POST",
      body: JSON.stringify({
        templateId: templateId || undefined,
        subject,
        bodyHtml,
        updateStage: updateStage || undefined,
      }),
    }),
    onSuccess: () => {
      toast({ title: "Email sent", description: `Email delivered to ${application?.email}.` });
      setShowSendConfirm(false);
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/job-applications", application?.id, "email/history"],
      });
      if (updateStage) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/job-applications/summary"] });
      }
      setActiveTab("history");
    },
    onError: (err: any) => {
      setShowSendConfirm(false);
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  // Test send mutation
  const testSendMutation = useMutation({
    mutationFn: (testRecipient: string) =>
      apiFetch(`/api/admin/job-applications/${application!.id}/email/test`, {
        method: "POST",
        body: JSON.stringify({
          templateId: templateId || undefined,
          subject,
          bodyHtml,
          testRecipient,
        }),
      }),
    onSuccess: (_data, testRecipient) => {
      toast({ title: "Test email sent", description: `Delivered to ${testRecipient}.` });
      setShowTestDialog(false);
    },
    onError: (err: any) => {
      setShowTestDialog(false);
      toast({ title: "Test send failed", description: err.message, variant: "destructive" });
    },
  });

  if (!application) return null;

  const applicantDisplayName = [application.firstName, application.lastName].filter(Boolean).join(" ")
    || application.applicantName
    || application.email;

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-[#474ead]" />
              Email Applicant
              <span className="text-slate-400 font-normal text-sm ml-1">
                — {applicantDisplayName}
              </span>
            </DialogTitle>
          </DialogHeader>

          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === "compose" && (
            <ComposeTab
              appId={application.id}
              templates={templates}
              templatesLoading={templatesLoading}
              templateId={templateId}
              setTemplateId={setTemplateId}
              subject={subject}
              setSubject={setSubject}
              bodyHtml={bodyHtml}
              setBodyHtml={setBodyHtml}
              onPreview={() => setActiveTab("preview")}
              onSend={() => setShowSendConfirm(true)}
              isSending={sendMutation.isPending}
              onTestSend={() => setShowTestDialog(true)}
              isTestSending={testSendMutation.isPending}
            />
          )}

          {activeTab === "preview" && (
            <PreviewTab
              appId={application.id}
              templateId={templateId}
              subject={subject}
              bodyHtml={bodyHtml}
            />
          )}

          {activeTab === "history" && (
            <HistoryTab appId={application.id} />
          )}
        </DialogContent>
      </Dialog>

      {/* Send confirmation overlay */}
      <SendConfirmDialog
        open={showSendConfirm}
        recipientEmail={application.email}
        subject={subject}
        updateStage={updateStage}
        setUpdateStage={setUpdateStage}
        onConfirm={() => sendMutation.mutate()}
        onCancel={() => setShowSendConfirm(false)}
        isSending={sendMutation.isPending}
      />

      {/* Test send overlay */}
      <TestSendDialog
        open={showTestDialog}
        onSend={email => testSendMutation.mutate(email)}
        onClose={() => setShowTestDialog(false)}
        isSending={testSendMutation.isPending}
      />
    </>
  );
}
