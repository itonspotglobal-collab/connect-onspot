import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Clock, Eye, Loader2, Mail, Send } from "lucide-react";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml?: string;
  category: string;
  isDefault: boolean;
}

interface Context {
  jobId: string;
  jobTitle: string;
  recipient: { name: string; email: string | null };
  sender: { name: string; email: string };
}

interface HistoryRow {
  id: string;
  subject: string;
  recipientEmail: string;
  senderEmail: string;
  senderName?: string;
  templateName?: string;
  status: "processing" | "sent" | "failed";
  error?: string;
  isTest: boolean;
  createdAt: string;
}

export interface ClientEmailPayload {
  templateId: string;
  subject: string;
  bodyHtml: string;
  senderEmail: string;
  rejectionReason?: string;
}

interface Props {
  job: { id: string; title: string } | null;
  decision: "approved" | "rejected" | "unapproved";
  rejectionReason?: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: ClientEmailPayload) => void;
  isSending: boolean;
}

const SENDERS = [
  { email: "hiretalent@onspotglobal.com", label: "OnSpot Hire Talent" },
  { email: "careers@onspotglobal.com", label: "OnSpot Careers" },
  { email: "findwork@onspotglobal.com", label: "OnSpot Find Work" },
];

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("onspot_jwt_token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
    return body;
  });
}

export function ClientEmailComposer({
  job, decision, rejectionReason, open, onClose, onConfirm, isSending,
}: Props) {
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [senderEmail, setSenderEmail] = useState("hiretalent@onspotglobal.com");
  const [testRecipient, setTestRecipient] = useState("");
  const [activeTab, setActiveTab] = useState<"compose" | "preview" | "history">("compose");

  const contextQuery = useQuery<Context>({
    queryKey: ["/api/admin/jobs", job?.id, "client-email-context"],
    queryFn: () => apiFetch(`/api/admin/jobs/${job!.id}/client-email/context`),
    enabled: open && !!job,
  });
  const templatesQuery = useQuery<Template[]>({
    queryKey: ["/api/admin/email-templates", "client_job"],
    queryFn: () => apiFetch("/api/admin/email-templates?scope=client_job"),
    enabled: open,
  });
  const historyQuery = useQuery<HistoryRow[]>({
    queryKey: ["/api/admin/jobs", job?.id, "client-email-history"],
    queryFn: () => apiFetch(`/api/admin/jobs/${job!.id}/client-email/history`),
    enabled: open && !!job,
  });

  const eligibleTemplates = useMemo(
    () => (templatesQuery.data ?? []).filter((item) => item.category === `job_${decision}`),
    [templatesQuery.data, decision],
  );

  useEffect(() => {
    if (!open || !eligibleTemplates.length) return;
    const selected = eligibleTemplates.find((item) => item.isDefault) ?? eligibleTemplates[0];
    if (!selected || templateId === selected.id) return;
    setTemplateId(selected.id);
    apiFetch(`/api/admin/email-templates/${selected.id}`).then((full: Template) => {
      setSubject(full.subject);
      setBodyHtml(full.bodyHtml ?? "");
    }).catch((error) => toast({ title: "Template could not be loaded", description: error.message, variant: "destructive" }));
  }, [open, decision, eligibleTemplates, templateId, toast]);

  useEffect(() => {
    setTemplateId("");
    setSubject("");
    setBodyHtml("");
    setSenderEmail("hiretalent@onspotglobal.com");
    setTestRecipient("");
    setActiveTab("compose");
  }, [open, job?.id, decision]);

  const selectTemplate = async (id: string) => {
    setTemplateId(id);
    const full: Template = await apiFetch(`/api/admin/email-templates/${id}`);
    setSubject(full.subject);
    setBodyHtml(full.bodyHtml ?? "");
  };

  const payload = {
    decision,
    templateId,
    subject,
    bodyHtml,
    senderEmail,
    rejectionReason,
  };

  const previewQuery = useQuery<{ subject: string; bodyHtml: string }>({
    queryKey: ["/api/admin/jobs", job?.id, "client-email-preview", payload],
    queryFn: () => apiFetch(`/api/admin/jobs/${job!.id}/client-email/preview`, {
      method: "POST", body: JSON.stringify(payload),
    }),
    enabled: open && !!job && !!subject && !!bodyHtml,
  });

  const testMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/jobs/${job!.id}/client-email/test`, {
      method: "POST",
      body: JSON.stringify({ ...payload, testRecipient }),
    }),
    onSuccess: () => {
      toast({ title: "Test email sent" });
      historyQuery.refetch();
    },
    onError: (error: Error) => toast({ title: "Test email failed", description: error.message, variant: "destructive" }),
  });

  const canSend = !!contextQuery.data?.recipient.email && !!templateId && !!subject.trim() && !!bodyHtml.trim();

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isSending) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {decision === "approved" ? "Approve Job & Email Client" : decision === "unapproved" ? "Email Client About Unapproved Job" : "Email Client About Rejected Job"}
          </DialogTitle>
          <DialogDescription>
            {decision === "approved"
              ? "Review and edit the Client notification before confirming approval. Canceling or sending a test will not change the job."
              : "Review and edit the Client notification. The job decision has already been saved; canceling or sending a test will not change it."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="compose"><Mail className="mr-1.5 h-4 w-4" />Compose</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="mr-1.5 h-4 w-4" />Preview</TabsTrigger>
            <TabsTrigger value="history"><Clock className="mr-1.5 h-4 w-4" />History</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4 pt-3">
            {contextQuery.isLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2">
                <div><p className="text-xs font-medium text-slate-500">To</p><p className="text-sm font-semibold">{contextQuery.data?.recipient.name}</p><p className="text-xs text-slate-500">{contextQuery.data?.recipient.email ?? "No Client email found"}</p></div>
                <div><p className="text-xs font-medium text-slate-500">Job</p><p className="text-sm font-semibold">{job?.title}</p></div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={selectTemplate}>
                  <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                  <SelectContent>{eligibleTemplates.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={senderEmail} onValueChange={setSenderEmail}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SENDERS.map((item) => <SelectItem key={item.email} value={item.email}>{item.label} &lt;{item.email}&gt;</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Suspense fallback={<Skeleton className="h-52 w-full" />}>
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Write the Client email…" />
              </Suspense>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5"><Label>Test recipient</Label><Input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="you@onspotglobal.com" /></div>
              <Button variant="outline" disabled={!testRecipient || !canSend || testMutation.isPending} onClick={() => testMutation.mutate()}>
                {testMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send Test
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="pt-4">
            {previewQuery.isLoading ? <Skeleton className="h-80 w-full" /> : previewQuery.isError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(previewQuery.error as Error).message}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-white">
                <div className="border-b p-4"><p className="text-xs text-slate-500">Subject</p><p className="font-semibold">{previewQuery.data?.subject}</p></div>
                <iframe title="Client email preview" className="h-[430px] w-full" sandbox="" srcDoc={previewQuery.data?.bodyHtml ?? ""} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 pt-4">
            {historyQuery.isLoading ? <Skeleton className="h-40 w-full" /> : !historyQuery.data?.length ? (
              <p className="py-12 text-center text-sm text-slate-500">No Client emails recorded for this job.</p>
            ) : historyQuery.data.map((row) => (
              <div key={row.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3"><p className="font-medium">{row.subject}</p><Badge variant={row.status === "sent" ? "default" : row.status === "failed" ? "destructive" : "secondary"}>{row.isTest ? "Test · " : ""}{row.status}</Badge></div>
                <p className="mt-1 text-xs text-slate-500">To {row.recipientEmail} · From {row.senderName ?? row.senderEmail} · {new Date(row.createdAt).toLocaleString()}</p>
                {row.templateName && <p className="mt-1 text-xs text-slate-500">Template: {row.templateName}</p>}
                {row.error && <p className="mt-2 text-xs text-red-600">{row.error}</p>}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" disabled={isSending} onClick={onClose}>Cancel</Button>
          <Button
            className={decision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
            disabled={!canSend || isSending}
            onClick={() => onConfirm({ templateId, subject, bodyHtml, senderEmail, rejectionReason })}
          >
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {decision === "approved" ? "Approve & Send" : "Send Email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}