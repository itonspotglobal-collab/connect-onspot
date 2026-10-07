import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, Loader2, LockKeyhole, PenLine, Plus, RefreshCw, Send, ShieldCheck, Upload, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fallbackContractsLocation, getContractListLocation, getTrustedPreviousLocation, getContractNavigationDocumentId } from "@/lib/contractNavigation";
import { loadTalentAuth } from "@/components/TalentLoginModal";

export interface ContractRow {
  id: string;
  talent_message?: string | null;
  offer_id: string;
  submission_id: string;
  talent_id?: string | null;
  status: string;
  title: string | null;
  party_type: "onspot" | "client" | "organization";
  organization_id: string | null;
  job_title: string;
  talent_name: string;
  client_name: string | null;
  signing_entity: string | null;
  rate: string | null;
  rate_currency: string | null;
  engagement_type: string | null;
  proposed_start_date: string | null;
  document_status: string | null;
}
interface ContractContext {
  offerId: string;
  talentName: string;
  jobTitle: string;
  clientName: string | null;
  rate: string | null;
  currency: string | null;
  engagementType: string | null;
  startDate: string | null;
  allowedPartyTypes: Array<"onspot" | "client" | "organization">;
  organizations: Array<{ id: string; name: string }>;
}
interface ContractDetail {
  contract: ContractRow;
  document: null | { id: string; version: number; sha256: string; original_filename: string; mime_type: string; file_size: number; status: string; sent_at: string | null; executed_at: string | null };
  attachments?: Array<{ id: string; originalFilename: string; fileSize: number; sha256: string; version: number; status: string }>;
  signatures: Array<{ signer_role: string; legal_name: string; signed_at: string; organization_name: string | null }>;
  timeline: Array<{ action: string; actor_name: string | null; created_at: string }>;
  permissions: { canPrepare: boolean; canManage?: boolean; canSend: boolean; canSign: boolean; canVoid: boolean; canDecline: boolean; signerRole: string | null };
}

async function jsonRequest<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body);
  return response.json() as Promise<T>;
}
function dateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function currencyLabel(amount?: string | null, currency?: string | null) {
  if (!amount) return "Not specified";
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(numeric) : `${currency || "USD"} ${amount}`;
}
function statusLabel(status: string) {
  return ({
    draft: "Draft", sent_for_signature: "Awaiting signature", talent_signed: "Awaiting countersignature",
    countersigned: "Fully executed", executed: "Fully executed", voided: "Voided", declined: "Declined",
  } as Record<string, string>)[status] ?? status.replaceAll("_", " ");
}
function bearerHeaders(): Record<string, string> {
  const jwt = localStorage.getItem("onspot_jwt_token");
  if (jwt) return { Authorization: `Bearer ${jwt}` };
  try {
    const auth = JSON.parse(localStorage.getItem("talent_profile_token") || "null");
    if (auth?.token) return { Authorization: `Bearer ${auth.token}` };
  } catch { /* malformed stale portal token */ }
  return {};
}
async function getPrivatePdf(contractId: string, executed = false): Promise<Blob> {
  const endpoint = `/api/contracts/${encodeURIComponent(contractId)}/pdf${executed ? "?executed=true" : ""}`;
  const response = await fetch(endpoint, { headers: bearerHeaders(), credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Unable to open PDF (${response.status})`);
  }
  const blob = await response.blob();
  if (blob.type !== "application/pdf") throw new Error("The authorized response was not a PDF.");
  return blob;
}

export function PrepareContractDialog({ offerId, open, onOpenChange, onCreated }: {
  offerId: string; open: boolean; onOpenChange: (open: boolean) => void; onCreated?: (id: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [partyType, setPartyType] = useState<"onspot" | "client" | "organization">("onspot");
  const [organizationId, setOrganizationId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState("");
  const [reviewedKey, setReviewedKey] = useState("");
  const [serverReviewError, setServerReviewError] = useState("");
  const [serverPdfUrl, setServerPdfUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [supportingBusy, setSupportingBusy] = useState(false);
  const [supportingPreview, setSupportingPreview] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: context, isLoading, isError, refetch } = useQuery<ContractContext>({
    queryKey: ["/api/contracts/context", offerId],
    queryFn: () => jsonRequest("GET", `/api/contracts/context?offerId=${encodeURIComponent(offerId)}`),
    enabled: open && !!offerId,
  });
  const { data: savedDraft, refetch: refetchSavedDraft } = useQuery<ContractDetail>({
    queryKey: ["/api/contracts", draftId],
    queryFn: () => jsonRequest("GET", `/api/contracts/${encodeURIComponent(draftId!)}`),
    enabled: open && !!draftId,
  });
  useEffect(() => {
    if (context?.allowedPartyTypes.length) setPartyType(context.allowedPartyTypes[0]);
  }, [context?.offerId]);
  useEffect(() => {
    if (!file) { setPdfUrl(null); return; }
    setServerPdfUrl(null);
    setReviewedKey("");
    setServerReviewError("");
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => { if (serverPdfUrl) URL.revokeObjectURL(serverPdfUrl); }, [serverPdfUrl]);
  useEffect(() => () => { if (supportingPreview) URL.revokeObjectURL(supportingPreview.url); }, [supportingPreview]);

  async function uploadSupportingFile() {
    if (!draftId || !supportingFile) return;
    if (supportingFile.type !== "application/pdf" || !supportingFile.name.toLowerCase().endsWith(".pdf") || supportingFile.size <= 0 || supportingFile.size > 10 * 1024 * 1024) {
      toast({ title: "Invalid supporting PDF", description: "Choose a non-empty PDF of 10 MB or less.", variant: "destructive" });
      return;
    }
    setSupportingBusy(true);
    try {
      const form = new FormData();
      form.append("file", supportingFile);
      const response = await fetch(`/api/contracts/${encodeURIComponent(draftId)}/attachments`, { method: "PUT", headers: bearerHeaders(), credentials: "include", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Attachment upload failed (${response.status})`);
      }
      setSupportingFile(null);
      await refetchSavedDraft();
      toast({ title: "Supporting PDF saved", description: "It is private and separate from the signable primary document." });
    } catch (error) {
      toast({ title: "Could not upload supporting PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSupportingBusy(false); }
  }
  async function removeSupportingFile(attachmentId: string) {
    if (!draftId) return;
    setSupportingBusy(true);
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(draftId)}/attachments/${encodeURIComponent(attachmentId)}`, { method: "DELETE", headers: bearerHeaders(), credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Attachment removal failed (${response.status})`);
      }
      await refetchSavedDraft();
      toast({ title: "Supporting PDF removed" });
    } catch (error) {
      toast({ title: "Could not remove supporting PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSupportingBusy(false); }
  }
  async function reviewSupportingFile(attachment: NonNullable<ContractDetail["attachments"]>[number], download = false) {
    if (!draftId) return;
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(draftId)}/attachments/${encodeURIComponent(attachment.id)}/pdf`, { headers: bearerHeaders(), credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Unable to load attachment (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.type !== "application/pdf") throw new Error("The authorized attachment response was not a PDF.");
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = attachment.originalFilename;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        setSupportingPreview((old) => { if (old) URL.revokeObjectURL(old.url); return { url, name: attachment.originalFilename }; });
      }
    } catch (error) {
      toast({ title: "Could not review supporting PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  const selectedFileKey = file ? `${file.name}:${file.size}:${file.lastModified}` : "";
  async function reviewUploadedPdf(contractId: string, fileKey: string) {
    setServerReviewError("");
    try {
      const originalPdf = await getPrivatePdf(contractId);
      const reviewedUrl = URL.createObjectURL(originalPdf);
      setServerPdfUrl(reviewedUrl);
      setReviewedKey(fileKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open the uploaded private PDF.";
      setServerReviewError(message);
      throw error;
    }
  }
  async function retryServerReview() {
    if (!draftId || !file || uploadedKey !== selectedFileKey) return;
    setBusy(true);
    try {
      await reviewUploadedPdf(draftId, selectedFileKey);
    } catch (error) {
      toast({ title: "Could not review uploaded PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setBusy(false); }
  }
  async function removePersistedPrimary() {
    if (!draftId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(draftId)}/document`, {
        method: "DELETE", headers: bearerHeaders(), credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Could not remove saved PDF (${response.status})`);
      }
      setFile(null);
      setUploadedKey("");
      setReviewedKey("");
      setServerReviewError("");
      setServerPdfUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      await qc.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Saved primary PDF removed", description: "The draft remains. A later upload will be stored as a new document version." });
    } catch (error) {
      toast({ title: "Could not remove saved primary PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setBusy(false); }
  }
  async function persistDraft() {
    if (!context || draftId) return;
    setBusy(true);
    try {
      const created = await jsonRequest<{ id: string }>("POST", "/api/contracts", {
        offerId, partyType, ...(partyType === "organization" ? { organizationId } : {}),
        ...(title.trim() ? { title: title.trim() } : {}), ...(message.trim() ? { message: message.trim() } : {}),
      });
      setDraftId(created.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/contracts"] }),
        qc.invalidateQueries({ queryKey: ["/api/contracts/accepted-offers"] }),
      ]);
      toast({ title: "Contract draft saved", description: "You can upload the signable PDF and supporting documents before sending." });
    } catch (error) {
      toast({ title: "Could not save contract draft", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setBusy(false); }
  }
  async function uploadDraft() {
    if (!context || !file) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "PDF required", description: "Choose a file ending in .pdf with PDF file type.", variant: "destructive" });
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      toast({ title: "Check file size", description: "The PDF must be non-empty and no larger than 10 MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      let contractId = draftId;
      if (!contractId) {
        const created = await jsonRequest<{ id: string }>("POST", "/api/contracts", {
          offerId, partyType, ...(partyType === "organization" ? { organizationId } : {}),
          ...(title.trim() ? { title: title.trim() } : {}), ...(message.trim() ? { message: message.trim() } : {}),
        });
        contractId = created.id;
        setDraftId(contractId);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["/api/contracts"] }),
          qc.invalidateQueries({ queryKey: ["/api/contracts/accepted-offers"] }),
        ]);
      }
      const form = new FormData();
      form.append("file", file);
      const upload = await fetch(`/api/contracts/${encodeURIComponent(contractId)}/document`, {
        method: "PUT", headers: bearerHeaders(), credentials: "include", body: form,
      });
      if (!upload.ok) {
        const body = await upload.json().catch(() => ({}));
        throw new Error(body.message || body.error || `PDF upload failed (${upload.status})`);
      }
      setUploadedKey(selectedFileKey);
      await reviewUploadedPdf(contractId, selectedFileKey);
      await qc.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "PDF uploaded and opened securely", description: "Review the server-stored PDF below. You can replace it until the contract is sent." });
    } catch (error) {
      toast({ title: "Could not upload contract PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }
  async function sendDraft() {
    if (!draftId || !file || uploadedKey !== selectedFileKey || reviewedKey !== selectedFileKey || !serverPdfUrl) return;
    setBusy(true);
    try {
      const sent = await jsonRequest<{ email?: { status: "accepted" | "failed" | "skipped" } }>("POST", `/api/contracts/${encodeURIComponent(draftId)}/send`);
      const mailStatus = sent.email?.status;
      toast({
        title: "Contract sent for signature",
        description: mailStatus === "accepted" ? "The system accepted the email request; delivery is not confirmed." : mailStatus === "failed" ? "The contract is in the signing flow, but the email request failed." : "The contract is in the signing flow. No email was sent.",
      });
      onOpenChange(false);
      onCreated?.(draftId);
    } catch (error) {
      toast({ title: "Could not send contract", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }
  const canSendDraft = !!draftId && !!file && uploadedKey === selectedFileKey && reviewedKey === selectedFileKey && !!serverPdfUrl;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-600" />Prepare Contract</DialogTitle>
          <DialogDescription>Prepare a private PDF agreement for the accepted offer. Signing does not mark the hire complete.</DialogDescription>
        </DialogHeader>
        {isLoading ? <div className="space-y-3 py-5"><div className="h-16 animate-pulse rounded-lg bg-slate-100" /><div className="h-8 animate-pulse rounded bg-slate-100" /></div>
          : isError || !context ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>Could not load accepted-offer details.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button></div>
          : <div className="space-y-5">
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Talent</p><p className="mt-1 text-sm font-semibold">{context.talentName}</p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Position</p><p className="mt-1 text-sm font-semibold">{context.jobTitle}</p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Client / organization</p><p className="mt-1 text-sm">{context.clientName || "OnSpot"}</p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Accepted rate</p><p className="mt-1 text-sm">{currencyLabel(context.rate, context.currency)}{context.engagementType ? ` · ${context.engagementType}` : ""}</p></div>
              {context.startDate && <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Proposed start</p><p className="mt-1 text-sm">{dateLabel(context.startDate)}</p></div>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="contract-party">Signing party</Label>
                <Select value={partyType} disabled={!!draftId} onValueChange={(v) => setPartyType(v as typeof partyType)}>
                  <SelectTrigger id="contract-party"><SelectValue /></SelectTrigger>
                  <SelectContent>{context.allowedPartyTypes.map((type) => <SelectItem key={type} value={type}>{type === "onspot" ? "OnSpot" : type === "client" ? "Client / organization" : "Organization"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {partyType === "organization" && <div className="space-y-2"><Label htmlFor="contract-org">Organization</Label>
                <Select value={organizationId} disabled={!!draftId} onValueChange={setOrganizationId}><SelectTrigger id="contract-org"><SelectValue placeholder="Choose organization" /></SelectTrigger><SelectContent>{context.organizations.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent></Select>
              </div>}
            </div>
            <div className="space-y-2"><Label htmlFor="contract-title">Contract title <span className="font-normal text-slate-400">Optional</span></Label><Input id="contract-title" disabled={!!draftId} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${context.jobTitle} agreement`} maxLength={180} /></div>
            <div className="space-y-2"><Label htmlFor="contract-message">Message to Talent <span className="font-normal text-slate-400">Optional</span></Label><Textarea id="contract-message" disabled={!!draftId} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add context for the signing request" rows={3} maxLength={2000} /></div>
            <div className="space-y-2">
              <Label htmlFor="contract-file">Private contract PDF</Label>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4">
                <input ref={fileRef} id="contract-file" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{file ? "Replace PDF" : "Choose PDF"}</Button>
                {file ? <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span> : <span className="text-sm text-slate-500">PDF only · up to 10 MB</span>}
              </div>
            </div>
            {pdfUrl && <div className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"><span>{reviewedKey === selectedFileKey && serverPdfUrl ? "Uploaded private PDF · original review recorded" : "Local selection preview — upload to review stored PDF"}</span><button onClick={() => {
              if (draftId && uploadedKey === selectedFileKey) void removePersistedPrimary();
              else setFile(null);
            }} disabled={busy} className="text-slate-500 hover:text-rose-600 disabled:opacity-50" aria-label={draftId && uploadedKey === selectedFileKey ? "Remove saved primary PDF" : "Clear selected primary PDF"}><X className="h-4 w-4" /></button></div><iframe title="Selected contract PDF preview" src={serverPdfUrl && reviewedKey === selectedFileKey ? serverPdfUrl : pdfUrl} className="h-[360px] w-full bg-slate-100" /></div>}
            {draftId && savedDraft?.permissions.canManage && <section className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div><h3 className="text-sm font-semibold text-slate-900">Supporting documents</h3><p className="mt-1 text-xs text-slate-500">Upload private supporting PDFs after the draft exists. These do not change the primary signature document.</p></div>
              {(savedDraft.attachments ?? []).length ? <div className="space-y-2">
                {savedDraft.attachments!.map((attachment) => <div key={attachment.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{attachment.originalFilename}</p><p className="text-[10px] text-slate-500">Version {attachment.version} · {(attachment.fileSize / 1024).toFixed(0)} KB · SHA-256 {attachment.sha256.slice(0, 12)}…</p></div>
                  <Button size="sm" variant="outline" onClick={() => reviewSupportingFile(attachment)}><FileText className="mr-1 h-3.5 w-3.5" />Review</Button>
                  <Button size="sm" variant="outline" onClick={() => reviewSupportingFile(attachment, true)}><Download className="mr-1 h-3.5 w-3.5" />Download</Button>
                  <Button size="sm" variant="outline" disabled={supportingBusy} onClick={() => removeSupportingFile(attachment.id)}><X className="mr-1 h-3.5 w-3.5" />Remove</Button>
                </div>)}
              </div> : <p className="text-xs text-slate-500">No supporting documents attached.</p>}
              <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">Add a supporting PDF
                  <input aria-label="Supporting PDF" type="file" accept="application/pdf,.pdf" className="mt-1 block max-w-full text-xs" onChange={(event) => setSupportingFile(event.target.files?.[0] ?? null)} />
                </label>
                <Button size="sm" variant="outline" disabled={!supportingFile || supportingBusy} onClick={uploadSupportingFile}>{supportingBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}Upload attachment</Button>
              </div>
              {supportingPreview && <div className="overflow-hidden rounded-lg border border-slate-200"><div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs"><span>{supportingPreview.name} · private preview</span><Button size="sm" variant="ghost" onClick={() => { URL.revokeObjectURL(supportingPreview.url); setSupportingPreview(null); }}><X className="h-4 w-4" /></Button></div><iframe title={`Supporting PDF preview ${supportingPreview.name}`} src={supportingPreview.url} className="h-[320px] w-full bg-slate-100" /></div>}
            </section>}
            {serverReviewError && <p role="alert" className="flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4" />{serverReviewError}</p>}
          </div>}
        <DialogFooter className="gap-2 sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><LockKeyhole className="h-3.5 w-3.5" />Only authorized contract parties can access this document.</p>
          {!draftId && <Button variant="outline" onClick={persistDraft} disabled={!context || busy || (partyType === "organization" && !organizationId)}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Draft"}
          </Button>}
          {!draftId || uploadedKey !== selectedFileKey ? <Button onClick={uploadDraft} disabled={!context || !file || busy || (partyType === "organization" && !organizationId)} className="bg-[#474ead] text-white hover:bg-[#3d439c]">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="mr-2 h-4 w-4" />{draftId ? "Upload replacement PDF" : "Create draft & upload"}</>}
          </Button> : reviewedKey !== selectedFileKey || !serverPdfUrl ? <Button onClick={retryServerReview} disabled={busy} variant="outline">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening private PDF…</> : <><FileText className="mr-2 h-4 w-4" />Review uploaded PDF</>}
          </Button> : null}
          <Button onClick={sendDraft} disabled={busy || !canSendDraft} className="bg-[#474ead] text-white hover:bg-[#3d439c]">
            {busy && canSendDraft ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : <><Send className="mr-2 h-4 w-4" />Send for Signature</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContractDetailDialog({ id, open, onOpenChange, onBackToList }: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackToList?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [executedPdfUrl, setExecutedPdfUrl] = useState<string | null>(null);
  const [executedPdfLoading, setExecutedPdfLoading] = useState(false);
  const [executedPdfError, setExecutedPdfError] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState<"accepted" | "failed" | "skipped" | null>(null);
  const [legalName, setLegalName] = useState("");
  const [consent, setConsent] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonAction, setReasonAction] = useState<"void" | "decline" | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [supportingBusy, setSupportingBusy] = useState(false);
  const [supportingPreview, setSupportingPreview] = useState<{ url: string; name: string } | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<ContractDetail>({
    queryKey: ["/api/contracts", id],
    queryFn: () => jsonRequest("GET", `/api/contracts/${encodeURIComponent(id!)}`),
    enabled: open && !!id,
  });
  useEffect(() => {
    setPdfError("");
    setLegalName("");
    setConsent(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    if (executedPdfUrl) URL.revokeObjectURL(executedPdfUrl);
    setPdfUrl(null);
    setExecutedPdfUrl(null);
    setEmailResult(null);
  // reset securely when switching contract / closing dialog
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, open]);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  useEffect(() => () => { if (executedPdfUrl) URL.revokeObjectURL(executedPdfUrl); }, [executedPdfUrl]);
  useEffect(() => () => { if (supportingPreview?.url) URL.revokeObjectURL(supportingPreview.url); }, [supportingPreview]);
  async function loadPdf() {
    if (!id) return;
    setPdfLoading(true); setPdfError("");
    try {
      const blob = await getPrivatePdf(id);
      const nextUrl = URL.createObjectURL(blob);
      setPdfUrl((old) => { if (old) URL.revokeObjectURL(old); return nextUrl; });
    } catch (error) { setPdfError(error instanceof Error ? error.message : "Unable to load PDF."); }
    finally { setPdfLoading(false); }
  }
  async function loadExecutedPdf() {
    if (!id) return;
    setExecutedPdfLoading(true); setExecutedPdfError("");
    try {
      const blob = await getPrivatePdf(id, true);
      const nextUrl = URL.createObjectURL(blob);
      setExecutedPdfUrl((old) => { if (old) URL.revokeObjectURL(old); return nextUrl; });
    } catch (error) { setExecutedPdfError(error instanceof Error ? error.message : "Unable to load executed PDF."); }
    finally { setExecutedPdfLoading(false); }
  }
  async function resendEmails() {
    if (!id) return;
    setEmailBusy(true);
    try {
      const result = await jsonRequest<{ email?: { status: "accepted" | "failed" | "skipped" } }>("POST", `/api/contracts/${encodeURIComponent(id)}/resend-emails`);
      const status = result.email?.status ?? "skipped";
      setEmailResult(status);
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ["/api/contracts"] })]);
      toast({
        title: status === "failed" ? "Email request failed" : status === "skipped" ? "Email was not sent" : "Email request accepted",
        description: status === "accepted" ? "The system accepted the request; this does not confirm delivery." : status === "failed" ? "The contract remains available in OnSpot. Review the delivery status and retry later." : "No email was sent. The contract remains available in OnSpot.",
        variant: status === "failed" ? "destructive" : "default",
      });
    } catch (error) {
      setEmailResult("failed");
      toast({ title: "Could not retry contract email", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setEmailBusy(false); }
  }
  async function runMutation(path: string, body: unknown) {
    try {
      await jsonRequest("POST", path, body);
      await Promise.all([
        refetch(),
        qc.invalidateQueries({ queryKey: ["/api/contracts"] }),
        qc.invalidateQueries({ queryKey: ["/api/contracts/accepted-offers"] }),
      ]);
      setReasonAction(null); setReason("");
      toast({ title: "Contract updated", description: "The latest signing status is shown below." });
    } catch (error) { toast({ title: "Contract action failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
  }
  async function uploadReplacement() {
    if (!draftFile || !id) return;
    if (draftFile.type !== "application/pdf" || !draftFile.name.toLowerCase().endsWith(".pdf") || draftFile.size <= 0 || draftFile.size > 10 * 1024 * 1024) {
      toast({ title: "Invalid PDF", description: "Choose a non-empty PDF of 10 MB or less.", variant: "destructive" });
      return;
    }
    setDraftBusy(true);
    try {
      const form = new FormData();
      form.append("file", draftFile);
      const response = await fetch(`/api/contracts/${encodeURIComponent(id)}/document`, { method: "PUT", headers: bearerHeaders(), credentials: "include", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Upload failed (${response.status})`);
      }
      setDraftFile(null);
      await refetch();
      toast({ title: "Draft PDF replaced", description: "This version remains editable until sent for signature." });
    } catch (error) { toast({ title: "Could not upload PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setDraftBusy(false); }
  }
  async function removePersistedDocument() {
    if (!id || !window.confirm("Remove the saved primary contract PDF from this draft? The draft remains and a later upload creates a new document version.")) return;
    setDraftBusy(true);
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(id)}/document`, { method: "DELETE", headers: bearerHeaders(), credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Could not remove PDF (${response.status})`);
      }
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Saved primary PDF removed", description: "The draft stays available. A later upload is recorded as a new version." });
    } catch (error) {
      toast({ title: "Could not remove saved PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setDraftBusy(false); }
  }
  async function uploadSupporting() {
    if (!supportingFile || !id) return;
    if (supportingFile.type !== "application/pdf" || !supportingFile.name.toLowerCase().endsWith(".pdf") || supportingFile.size <= 0 || supportingFile.size > 10 * 1024 * 1024) {
      toast({ title: "Invalid supporting PDF", description: "Choose a non-empty PDF of 10 MB or less.", variant: "destructive" });
      return;
    }
    setSupportingBusy(true);
    try {
      const form = new FormData();
      form.append("file", supportingFile);
      const response = await fetch(`/api/contracts/${encodeURIComponent(id)}/attachments`, { method: "PUT", headers: bearerHeaders(), credentials: "include", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Attachment upload failed (${response.status})`);
      }
      setSupportingFile(null);
      await refetch();
      toast({ title: "Supporting document added", description: "It is stored privately and does not alter the signable contract PDF." });
    } catch (error) {
      toast({ title: "Could not upload supporting document", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSupportingBusy(false); }
  }
  async function removeSupporting(attachmentId: string) {
    if (!id) return;
    setSupportingBusy(true);
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { method: "DELETE", headers: bearerHeaders(), credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Attachment removal failed (${response.status})`);
      }
      await refetch();
      toast({ title: "Supporting document removed" });
    } catch (error) {
      toast({ title: "Could not remove supporting document", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSupportingBusy(false); }
  }
  async function openSupporting(attachment: NonNullable<ContractDetail["attachments"]>[number], download = false) {
    if (!id) return;
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachment.id)}/pdf`, { headers: bearerHeaders(), credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Unable to open attachment (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.type !== "application/pdf") throw new Error("The authorized attachment response was not a PDF.");
      if (download) {
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = attachment.originalFilename;
        anchor.click();
        URL.revokeObjectURL(downloadUrl);
        return;
      }
      const url = URL.createObjectURL(blob);
      setSupportingPreview((old) => { if (old) URL.revokeObjectURL(old.url); return { url, name: attachment.originalFilename }; });
    } catch (error) {
      toast({ title: "Could not open supporting document", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }
  const detail = data;
  const canSign = !!detail?.permissions.canSign && !!detail.document;
  const signed = detail?.signatures ?? [];
  const isTerminal = ["executed", "countersigned", "voided", "declined"].includes(detail?.contract.status ?? "");
  const hasExecutedCopy = Boolean(detail?.document?.executed_at || ["executed", "countersigned"].includes(detail?.contract.status ?? ""));
  const canManageEmail = Boolean(detail?.permissions.canPrepare || detail?.permissions.canSend);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          {onBackToList && <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="Back to contracts list" onClick={onBackToList}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Back to Contracts
          </Button>}
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-600" />{detail?.contract.title || "Contract"}</DialogTitle><DialogDescription>Private agreement · {detail?.contract.job_title || "Contract details"}</DialogDescription>
        </DialogHeader>
        {isLoading ? <div className="space-y-3 py-6"><div className="h-20 animate-pulse rounded bg-slate-100" /><div className="h-64 animate-pulse rounded bg-slate-100" /></div>
          : isError || !detail ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>Unable to load this contract. Access is restricted to its authorized parties.</p><Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button></div>
          : <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div><p className="text-sm font-semibold text-slate-900">{detail.contract.talent_name} · {detail.contract.job_title}</p><p className="mt-1 text-xs text-slate-600">{detail.contract.client_name || detail.contract.signing_entity || "OnSpot"}{detail.contract.rate ? ` · ${currencyLabel(detail.contract.rate, detail.contract.rate_currency)}` : ""}{detail.contract.engagement_type ? ` · ${detail.contract.engagement_type}` : ""}</p><p className="mt-2 text-xs text-slate-500">{detail.document ? `Original · Version ${detail.document.version} · ${detail.document.original_filename}` : "No PDF uploaded"}{detail.document?.executed_at ? ` · Executed ${dateLabel(detail.document.executed_at)}` : ""}</p>{detail.document && <p className="mt-1 break-all font-mono text-[10px] text-slate-500">Original SHA-256 · {detail.document.sha256}</p>}</div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">{statusLabel(detail.contract.status)}</span>
            </div>
            {detail.contract.talent_message && <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold">Message from the preparer</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{detail.contract.talent_message}</p></section>}
            {detail.document && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={loadPdf} disabled={pdfLoading}>{pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}{pdfUrl ? "Reload private preview" : "Review PDF"}</Button>
              {pdfUrl && <Button size="sm" variant="outline" onClick={() => { const anchor = document.createElement("a"); anchor.href = pdfUrl; anchor.download = detail.document?.original_filename || "contract.pdf"; anchor.click(); }}><Download className="mr-2 h-4 w-4" />Download authorized copy</Button>}</div>}
            {detail.contract.status === "draft" && detail.permissions.canPrepare && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <label className="min-w-0 flex-1 text-xs text-amber-900">{draftFile ? `Selected: ${draftFile.name}` : "Replace or upload the draft PDF"}
                <input type="file" accept="application/pdf,.pdf" className="mt-1 block max-w-full text-xs" onChange={(event) => setDraftFile(event.target.files?.[0] ?? null)} />
              </label>
              <Button size="sm" variant="outline" disabled={!draftFile || draftBusy} onClick={uploadReplacement}>{draftBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload PDF</Button>
              {detail.document && detail.permissions.canManage && <Button size="sm" variant="outline" disabled={draftBusy} onClick={removePersistedDocument}><X className="mr-2 h-4 w-4" />Remove saved PDF</Button>}
              {detail.permissions.canSend && <Button size="sm" className="bg-[#474ead] text-white hover:bg-[#3d439c]" disabled={!detail.document || draftBusy} onClick={() => runMutation(`/api/contracts/${encodeURIComponent(id!)}/send`, {})}><Send className="mr-2 h-4 w-4" />Send for signature</Button>}
            </div>}
            <section className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div><h3 className="text-sm font-semibold text-slate-900">Supporting documents</h3><p className="mt-1 text-xs text-slate-500">Private attachments are separate from the primary PDF and are never part of its signature hash.</p></div>
              {(detail.attachments ?? []).length ? <div className="space-y-2">
                {detail.attachments!.map((attachment) => <div key={attachment.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{attachment.originalFilename}</p><p className="text-[10px] text-slate-500">Version {attachment.version} · {(attachment.fileSize / 1024).toFixed(0)} KB · SHA-256 {attachment.sha256.slice(0, 12)}…</p></div>
                  <Button size="sm" variant="outline" onClick={() => openSupporting(attachment)}><FileText className="mr-1 h-3.5 w-3.5" />Review</Button>
                  <Button size="sm" variant="outline" onClick={() => openSupporting(attachment, true)}><Download className="mr-1 h-3.5 w-3.5" />Download</Button>
                  {detail.contract.status === "draft" && detail.permissions.canManage && <Button size="sm" variant="outline" disabled={supportingBusy} onClick={() => removeSupporting(attachment.id)}><X className="mr-1 h-3.5 w-3.5" />Remove</Button>}
                </div>)}
              </div> : <p className="text-xs text-slate-500">No supporting documents attached.</p>}
              {detail.contract.status === "draft" && detail.permissions.canManage && <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">Add a supporting PDF
                  <input aria-label="Supporting PDF" type="file" accept="application/pdf,.pdf" className="mt-1 block max-w-full text-xs" onChange={(event) => setSupportingFile(event.target.files?.[0] ?? null)} />
                </label>
                <Button size="sm" variant="outline" disabled={!supportingFile || supportingBusy} onClick={uploadSupporting}>{supportingBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}Upload attachment</Button>
              </div>}
              {supportingPreview && <div className="overflow-hidden rounded-lg border border-slate-200"><div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs"><span className="truncate">{supportingPreview.name} · private preview</span><Button size="sm" variant="ghost" onClick={() => { URL.revokeObjectURL(supportingPreview.url); setSupportingPreview(null); }}><X className="h-4 w-4" /></Button></div><iframe title={`Private supporting document ${supportingPreview.name}`} src={supportingPreview.url} className="h-[min(52dvh,560px)] w-full bg-slate-100" /></div>}
            </section>
            {pdfError && <p role="alert" className="flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4" />{pdfError}</p>}
            {pdfUrl && <div className="overflow-hidden rounded-xl border border-slate-200"><iframe title="Private contract PDF preview" src={pdfUrl} className="h-[min(62dvh,680px)] w-full bg-slate-100" /></div>}
            {hasExecutedCopy && <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div><h3 className="text-sm font-semibold text-slate-900">Executed copy</h3><p className="mt-1 text-xs text-slate-600">The executed copy is retrieved separately. The original PDF and its recorded hash above remain preserved.</p></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={loadExecutedPdf} disabled={executedPdfLoading}>{executedPdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}{executedPdfUrl ? "Reload executed copy" : "Preview executed copy"}</Button>
                {executedPdfUrl && <Button size="sm" variant="outline" onClick={() => { const anchor = document.createElement("a"); anchor.href = executedPdfUrl; anchor.download = `${detail.contract.title || "contract"}-executed.pdf`; anchor.click(); }}><Download className="mr-2 h-4 w-4" />Download executed copy</Button>}
              </div>
              {executedPdfError && <p role="alert" className="flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4" />{executedPdfError}</p>}
              {executedPdfUrl && <div className="overflow-hidden rounded-lg border border-emerald-200"><iframe title="Authenticated executed contract PDF preview" src={executedPdfUrl} className="h-[min(62dvh,680px)] w-full bg-slate-100" /></div>}
            </section>}
            {canManageEmail && detail.document?.sent_at && <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div><p className="text-sm font-medium text-slate-800">Contract email</p><p className="text-xs text-slate-500">{emailResult === "accepted" ? "Request accepted; delivery is not confirmed." : emailResult === "failed" ? "The last email request failed." : emailResult === "skipped" ? "No email was sent by the last request." : "Retry the contract notification for the authorized recipient."}</p></div>
              <Button size="sm" variant="outline" disabled={emailBusy} onClick={resendEmails}>{emailBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Retry email</Button>
            </section>}
            {canSign && <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <div className="flex items-center gap-2"><PenLine className="h-4 w-4 text-indigo-700" /><h3 className="text-sm font-semibold text-slate-900">Sign this agreement</h3></div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Review the complete PDF above. Your signature is associated with the exact document version shown.</p>
              {detail.permissions.signerRole && <p className="mt-2 text-xs text-slate-600">Signing as: <span className="font-semibold capitalize">{detail.permissions.signerRole.replaceAll("_", " ")}</span></p>}
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5"><Label htmlFor="contract-legal-name">Full legal name</Label><Input id="contract-legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} autoComplete="name" maxLength={180} /></div>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-slate-700"><Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} /><span>I confirm that I reviewed this contract and intend to sign it.</span></label>
              </div>
              <Button className="mt-4 bg-[#474ead] text-white hover:bg-[#3d439c]" disabled={!pdfUrl || !legalName.trim() || !consent} onClick={() => runMutation(`/api/contracts/${encodeURIComponent(id!)}/sign`, { documentId: detail.document!.id, sha256: detail.document!.sha256, legalName: legalName.trim(), consent: true })}><ShieldCheck className="mr-2 h-4 w-4" />Sign Contract</Button>
              {!pdfUrl && <p className="mt-2 text-xs text-amber-700">Open and review the private PDF before signing.</p>}
            </section>}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Signature record</h3>
              {signed.length ? <div className="space-y-2">{signed.map((signature, index) => <div key={`${signature.signer_role}-${signature.signed_at}-${index}`} className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" /><div><p className="text-sm font-medium text-slate-800">{signature.legal_name} · {signature.signer_role.replaceAll("_", " ")}</p><p className="text-xs text-slate-600">{signature.organization_name ? `For ${signature.organization_name} · ` : ""}{dateLabel(signature.signed_at)}</p></div></div>)}</div> : <p className="text-sm text-slate-500">No signatures recorded yet.</p>}
            </section>
            <section><h3 className="mb-3 text-sm font-semibold text-slate-900">Activity</h3>
              {detail.timeline.length ? <ol className="space-y-3 border-l border-slate-200 pl-4">{detail.timeline.map((event, index) => <li key={`${event.action}-${event.created_at}-${index}`} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500 ring-1 ring-slate-300" /><p className="text-sm font-medium text-slate-800">{event.action.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{event.actor_name || "System"} · {new Date(event.created_at).toLocaleString()}</p></li>)}</ol> : <p className="text-sm text-slate-500">Activity will appear here as the contract progresses.</p>}
            </section>
            {!isTerminal && (detail.permissions.canVoid || detail.permissions.canDecline) && <div className="border-t border-slate-200 pt-4">
              {reasonAction ? <div className="space-y-2"><Label htmlFor="contract-reason">{reasonAction === "void" ? "Reason for voiding" : "Reason for declining"}</Label><Textarea id="contract-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={2} /><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setReasonAction(null)}>Cancel</Button><Button variant="destructive" size="sm" disabled={!reason.trim()} onClick={() => runMutation(`/api/contracts/${encodeURIComponent(id!)}/${reasonAction}`, { reason: reason.trim() })}>Confirm {reasonAction}</Button></div></div>
                : <div className="flex flex-wrap gap-2">{detail.permissions.canDecline && <Button variant="outline" size="sm" onClick={() => setReasonAction("decline")}>Decline contract</Button>}{detail.permissions.canVoid && <Button variant="outline" size="sm" onClick={() => setReasonAction("void")}>Void contract</Button>}</div>}
            </div>}
          </div>}
      </DialogContent>
    </Dialog>
  );
}

export default function ContractsPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const params = new URLSearchParams(search);
  const offerId = params.get("offerId");
  const selectedId = params.get("id");
  const [prepareOpen, setPrepareOpen] = useState(Boolean(offerId));
  const [prepareOfferId, setPrepareOfferId] = useState<string | null>(offerId);
  const qc = useQueryClient();
  const { data: rows, isLoading, isError, refetch } = useQuery<ContractRow[]>({
    queryKey: ["/api/contracts"],
    queryFn: () => jsonRequest("GET", "/api/contracts"),
  });
  const { data: acceptedOffers, isLoading: acceptedOffersLoading, isError: acceptedOffersError, refetch: refetchAcceptedOffers } = useQuery<ContractContext[]>({
    queryKey: ["/api/contracts/accepted-offers"],
    queryFn: () => jsonRequest("GET", "/api/contracts/accepted-offers"),
  });
  useEffect(() => {
    if (offerId) {
      setPrepareOfferId(offerId);
      setPrepareOpen(true);
    }
  }, [offerId]);
  const onCreated = (id: string) => {
    void Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/contracts"] }),
      qc.invalidateQueries({ queryKey: ["/api/contracts/accepted-offers"] }),
    ]);
    setPrepareOpen(false);
    setPrepareOfferId(null);
    navigate(`/contracts?id=${encodeURIComponent(id)}`);
  };
  const openPrepare = (acceptedOfferId: string) => {
    setPrepareOfferId(acceptedOfferId);
    setPrepareOpen(true);
  };
  const closePrepare = (open: boolean) => {
    setPrepareOpen(open);
    if (!open) {
      setPrepareOfferId(null);
      if (offerId) navigate("/contracts");
    }
  };
  const selected = selectedId ? rows?.find((row) => row.id === selectedId) : null;
  const canPrepareFromContext = Boolean(offerId);
  const safeBack = () => {
    const documentId = getContractNavigationDocumentId();
    const previous = documentId
      ? getTrustedPreviousLocation(window.history.state, documentId, window.location.origin)
      : null;
    if (previous) window.history.back();
    else navigate(fallbackContractsLocation(user?.role || (loadTalentAuth() ? "talent" : null)));
  };
  const returnToContractsList = () => {
    const documentId = getContractNavigationDocumentId();
    const previous = documentId
      ? getTrustedPreviousLocation(window.history.state, documentId, window.location.origin)
      : null;
    if (previous) {
      const previousUrl = new URL(previous, window.location.origin);
      if (previousUrl.pathname === "/contracts" && !previousUrl.searchParams.has("offerId")) {
        window.history.back();
        return;
      }
    }
    navigate(getContractListLocation(search, previous), { replace: true });
  };
  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Button type="button" variant="ghost" size="sm" onClick={safeBack} aria-label="Go back to the previous OnSpot page" className="-ml-2 mb-3 text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-indigo-500">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Back
        </Button>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">OnSpot · Private agreements</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Contracts</h1><p className="mt-2 max-w-xl text-sm text-slate-600">Review agreements and follow each signature through one accountable hiring flow.</p></div>
          {canPrepareFromContext && <Button onClick={() => setPrepareOpen(true)} className="bg-[#474ead] text-white hover:bg-[#3d439c]"><Plus className="mr-2 h-4 w-4" />Prepare Contract</Button>}
        </div>
        {acceptedOffersLoading && <section aria-label="Accepted offers available for contract preparation" className="mb-6 space-y-2">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </section>}
        {acceptedOffersError && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>Accepted offers could not be checked for preparation.</span>
          <Button size="sm" variant="outline" onClick={() => refetchAcceptedOffers()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
        </div>}
        {!!acceptedOffers?.length && <section className="mb-7 space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Accepted offers ready for a contract</h2>
            <span className="text-xs text-slate-500">{acceptedOffers.length} available</span>
          </div>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {acceptedOffers.map((offer) => <div key={offer.offerId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{offer.talentName} <span className="font-normal text-slate-400">·</span> {offer.jobTitle}</p>
                <p className="mt-1 text-xs text-slate-600">{offer.clientName || "OnSpot"}{offer.rate ? ` · ${currencyLabel(offer.rate, offer.currency)}` : ""}{offer.engagementType ? ` · ${offer.engagementType}` : ""}</p>
                {offer.startDate && <p className="mt-1 text-[11px] text-slate-500">Proposed start {dateLabel(offer.startDate)}</p>}
              </div>
              <Button size="sm" className="shrink-0 bg-[#474ead] text-white hover:bg-[#3d439c]" onClick={() => openPrepare(offer.offerId)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Prepare Contract
              </Button>
            </div>)}
          </div>
        </section>}
        {isLoading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border bg-white" />)}</div>
          : isError ? <Card><CardContent className="flex flex-col items-center py-12 text-center"><AlertCircle className="h-8 w-8 text-rose-500" /><p className="mt-3 font-semibold text-slate-800">Contracts could not be loaded</p><p className="mt-1 text-sm text-slate-500">Your session may have expired, or the service is temporarily unavailable.</p><Button variant="outline" className="mt-4" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button></CardContent></Card>
          : rows?.length ? <div className="space-y-3">{rows.map((contract) => <Card key={contract.id} className="border-slate-200 shadow-sm"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-start gap-3"><div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-700"><FileText className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold text-slate-900">{contract.title || contract.job_title}</h2><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">{statusLabel(contract.status)}</span></div><p className="mt-1 text-sm text-slate-600">{contract.job_title} · {contract.client_name || contract.signing_entity || "OnSpot"}</p><p className="mt-1 text-xs text-slate-500">{contract.talent_name}{contract.rate ? ` · ${currencyLabel(contract.rate, contract.rate_currency)}` : ""}{contract.engagement_type ? ` · ${contract.engagement_type}` : ""}</p></div></div>
            <Button variant="outline" className="shrink-0" onClick={() => navigate(`/contracts?id=${encodeURIComponent(contract.id)}`)}>View contract <FileText className="ml-2 h-4 w-4" /></Button>
          </CardContent></Card>)}</div>
          : <Card className="border-dashed"><CardContent className="flex flex-col items-center px-6 py-16 text-center"><div className="rounded-full bg-indigo-50 p-4"><FileText className="h-7 w-7 text-indigo-600" /></div><h2 className="mt-4 text-lg font-semibold text-slate-900">No contracts yet</h2><p className="mt-1 max-w-md text-sm text-slate-500">Contracts appear here after an offer is accepted and an authorized party prepares the PDF.</p></CardContent></Card>}
      </div>
      {prepareOfferId && <PrepareContractDialog offerId={prepareOfferId} open={prepareOpen} onOpenChange={closePrepare} onCreated={onCreated} />}
      <ContractDetailDialog id={selected?.id || (selectedId && isLoading ? selectedId : null)} open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) returnToContractsList(); }} onBackToList={returnToContractsList} />
    </main>
  );
}
