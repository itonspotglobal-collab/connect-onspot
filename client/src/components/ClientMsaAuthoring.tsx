import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Eye, FileText, Loader2, LockKeyhole, RotateCw, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ContractDraftEditor } from "@/components/ContractDraftEditor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignatureInput } from "@/components/SignatureInput";

export interface ClientMsaEngagement {
  clientId: string;
  submissionId: string;
  jobTitle: string;
  clientName: string;
}
export interface ClientMsaDocument {
  id: string;
  version: string;
  filename: string;
  sha256: string;
  effectiveAt: string;
  clientId: string;
  clientName: string;
  status: "draft" | "issued" | "superseded" | "voided";
  templateVersion: string;
  submissionId: string;
  clientSignerName: string | null;
  clientSignerTitle?: string | null;
  clientHasDrawnSignature?: boolean;
  clientSignedAt: string | null;
  onspotSignerName: string | null;
  onspotSignerTitle?: string | null;
  onspotHasDrawnSignature?: boolean;
  onspotSignedAt: string | null;
  viewUrl: string;
  executedUrl?: string | null;
}
export interface MsaSignerProfile { userId: string; legalName: string; title: string; }
function adminAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("onspot_jwt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Please try again.";
  const match = error.message.match(/^\d+:\s*(.*)$/);
  if (match) {
    try { const body = JSON.parse(match[1]); return body.message || body.error || match[1]; } catch { return match[1]; }
  }
  return error.message;
}

export function ClientMsaAuthoring({ engagement, documents, signerProfile, onChanged }: {
  engagement: ClientMsaEngagement;
  documents: ClientMsaDocument[];
  signerProfile?: MsaSignerProfile;
  onChanged: () => void;
}) {
  const base = `/api/admin/client-msas/${encodeURIComponent(engagement.clientId)}/authoring`;
  const queryKey = [base, "authoring"];
  const queryClient = useQueryClient();
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replacementTemplate, setReplacementTemplate] = useState("");
  const [onspotNames, setOnspotNames] = useState<Record<string, string>>({});
  const [onspotConsent, setOnspotConsent] = useState<Record<string, boolean>>({});
  const [onspotTitles, setOnspotTitles] = useState<Record<string, string>>({});
  const [onspotDrawings, setOnspotDrawings] = useState<Record<string, string | null>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [authoringBlocksIssue,setAuthoringBlocksIssue]=useState(true);
  const currentUrl = useRef("");
  const signerContextKey = `${engagement.clientId}:${engagement.submissionId}:${signerProfile?.userId ?? ""}:${documents.filter((item) => item.clientId === engagement.clientId).map((item) => `${item.id}:${item.sha256}`).join("|")}`;
  const { data: authoring, isLoading, isError, refetch } = useQuery<{ draft: { status: string; rendered_document_id?: string | null } | null; templates?: Array<{ id: string; name: string; version: string }> }>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", base)).json(),
  });
  const clientDocuments = documents.filter((document) => document.clientId === engagement.clientId);
  const issuedDocuments = clientDocuments.filter((document) => document.status === "issued" || document.status === "superseded");
  const activeIssued = clientDocuments.find((document) => document.status === "issued");
  const draftLocked = (!!authoring?.draft && authoring.draft.status !== "draft") || (!!issuedDocuments.length && !authoring?.draft);
  const renderedId = authoring?.draft?.rendered_document_id;
  const draftDocument = renderedId ? clientDocuments.find((document) => document.id === renderedId) : undefined;
  const eligibleToCountersign = clientDocuments.filter((document) => document.status === "issued" && document.clientSignedAt && !document.onspotSignedAt);

  useEffect(() => () => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
  }, []);
  useEffect(() => {
    setReviewedId(null);
    setReason("");
    setOnspotConsent({});
    setOnspotTitles({});
    setOnspotDrawings({});
    setError("");
    setNotice("");
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old.url);
      currentUrl.current = "";
      return null;
    });
  }, [signerContextKey]);

  async function createReplacement() {
    if (!replacementTemplate) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest("POST", base, { templateId: replacementTemplate, submissionId: engagement.submissionId });
      setConfirmReplacement(false);
      await queryClient.invalidateQueries({ queryKey });
      await onChanged();
      setNotice("A new version draft is ready. Previous issued versions and signatures remain unchanged until the replacement is issued.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function openPdf(document: ClientMsaDocument, markReviewed = false) {
    setLoadingPdf(document.id); setError("");
    try {
      const response = await fetch(`/api/client/msa/${encodeURIComponent(document.id)}/pdf`, {
        credentials: "include",
        headers: adminAuthHeaders(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Private PDF unavailable (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.type !== "application/pdf") throw new Error("The authorized response was not a PDF.");
      const url = URL.createObjectURL(blob);
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = url;
      setPreview({ id: document.id, url });
      if (markReviewed) setReviewedId(document.id);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoadingPdf(null); }
  }

  async function issue() {
    if (!draftDocument || reviewedId !== draftDocument.id || !reason.trim() || authoringBlocksIssue) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest("POST", `/api/admin/client-msas/${encodeURIComponent(engagement.clientId)}/issue`, {
        documentId: draftDocument.id, reviewed: true, reason: reason.trim(),
      });
      setReason(""); setReviewedId(null);
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = ""; setPreview(null);
      await queryClient.invalidateQueries({ queryKey });
      await onChanged();
      setNotice("The reviewed private MSA is issued to the client. It is a new signature request; prior versions and signatures are retained.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function countersign(document: ClientMsaDocument) {
    if (!document.clientSignedAt || !document.sha256 || reviewedId !== document.id || !onspotConsent[document.id] || !(onspotNames[document.id] ?? signerProfile?.legalName ?? document.onspotSignerName)?.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest("POST", `/api/admin/msa-documents/${encodeURIComponent(document.id)}/countersign`, {
        documentSha256: document.sha256, legalName: (onspotNames[document.id] ?? signerProfile?.legalName ?? document.onspotSignerName ?? "").trim(), consent: true,
        signerTitle: (onspotTitles[document.id] ?? signerProfile?.title ?? document.onspotSignerTitle ?? "").trim().slice(0, 160) || undefined,
        drawnSignature: onspotDrawings[document.id] ?? null,
      });
      await onChanged();
      setNotice("OnSpot countersignature recorded. This status is informational and does not block activation.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (isLoading) return <section className="space-y-3 rounded-xl border border-[#dce5df] bg-white p-5"><div className="h-5 w-56 animate-pulse rounded bg-slate-100" /><div className="h-24 animate-pulse rounded bg-slate-100" /></section>;
  if (isError || !authoring) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle className="mr-2 inline h-4 w-4" />Client MSA authoring could not be loaded. <Button variant="outline" size="sm" onClick={() => void refetch()}><RotateCw className="mr-1 h-3.5 w-3.5" />Retry</Button></section>;

  return <section className="space-y-4 rounded-2xl border border-[#cad9cf] bg-[#f9fbf9] p-4 sm:p-5" aria-label={`MSA preparation for ${engagement.clientName}`}>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#557064]">Private client agreement</p><h2 className="mt-1 text-xl font-semibold text-[#20352a]">{engagement.clientName}</h2><p className="mt-1 text-sm text-slate-600">{engagement.jobTitle} · Engagement {engagement.submissionId}</p></div>
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
        <span className="rounded-full bg-white px-3 py-1.5 text-slate-600">{clientDocuments.length} client version{clientDocuments.length === 1 ? "" : "s"}</span>
        <span className="rounded-full bg-[#e5efe7] px-3 py-1.5 text-[#45664d]">{clientDocuments.filter((d) => d.status === "issued").length} issued</span>
        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900">{eligibleToCountersign.length} countersign pending</span>
      </div>
    </div>
    {activeIssued && <div className="flex items-start gap-2 rounded-lg border border-[#dce5df] bg-white p-3 text-xs leading-relaxed text-slate-600"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#557064]" /><p>Current client version <strong>{activeIssued.version}</strong>{activeIssued.clientSignedAt ? ` · Client signature recorded by ${activeIssued.clientSignerName || "authorized signer"}${activeIssued.clientSignerTitle ? `, ${activeIssued.clientSignerTitle}` : ""}${activeIssued.clientHasDrawnSignature ? " · drawn signature recorded" : ""} on ${new Date(activeIssued.clientSignedAt).toLocaleDateString()}` : " · awaiting client signature"}. OnSpot countersignature is tracked separately and is <strong>not an activation requirement</strong>.</p></div>}
    {draftLocked ? <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div><p className="text-sm font-semibold text-amber-950">This draft has been sent or locked</p><p className="mt-1 text-xs leading-relaxed text-amber-900">Sent versions cannot be edited. Generate a fresh version to prepare changes. This creates a new signature requirement when issued; earlier signatures are retained. Merely rendering a draft does not invalidate an issued document.</p></div>
      {!confirmReplacement ? <Button onClick={() => setConfirmReplacement(true)} className="bg-[#405f4d] text-white hover:bg-[#344d3e]"><FileText className="mr-2 h-4 w-4" />Prepare a new version</Button> : <div className="space-y-3 rounded-lg border border-amber-300 bg-white p-3">
        <p className="text-sm font-medium text-slate-800">Confirm fresh version generation</p><p className="text-xs text-slate-600">The old issued copy remains available with its existing signature history. The new signature request begins only when this new version is issued.</p>
        <div className="max-w-lg space-y-1.5"><Label htmlFor={`replacement-template-${engagement.clientId}`}>Approved MSA template</Label><select id={`replacement-template-${engagement.clientId}`} value={replacementTemplate} onChange={(event) => setReplacementTemplate(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">{!replacementTemplate && <option value="">Choose an approved template</option>}{(authoring.templates || []).map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}</select></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => void createReplacement()} disabled={busy || !replacementTemplate} className="bg-[#405f4d] text-white hover:bg-[#344d3e]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm and create fresh version</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmReplacement(false)}>Cancel</Button></div>
      </div>}
    </div> : <ContractDraftEditor key={`${engagement.clientId}-${engagement.submissionId}`} contractId={engagement.clientId} authoringUrl={base} createContext={{ submissionId: engagement.submissionId }} documentNoun="MSA" onChanged={() => { void onChanged(); }} onSendReadinessChange={setAuthoringBlocksIssue} />}
    {draftDocument && !draftLocked && <section className="space-y-3 rounded-xl border border-[#dce5df] bg-white p-4">
      <div><h3 className="font-semibold text-[#20352a]">Review and issue</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">Open the exact authenticated PDF before issuing. Issuance creates a client signature requirement; generation alone does not replace or invalidate the currently issued MSA.</p></div>
      <Button variant="outline" size="sm" disabled={!!loadingPdf} onClick={() => void openPdf(draftDocument, true)}>{loadingPdf === draftDocument.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}{reviewedId === draftDocument.id ? "Re-open reviewed PDF" : "Open exact draft PDF"}</Button>
      {preview?.id === draftDocument.id && <iframe title={`Private MSA draft ${draftDocument.version}`} src={preview.url} className="h-[min(60vh,620px)] w-full rounded-lg border border-slate-200 bg-slate-100" />}
      <div className="space-y-2"><Label htmlFor={`msa-issue-reason-${engagement.clientId}`}>Issue review reason</Label><Textarea id={`msa-issue-reason-${engagement.clientId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1200} rows={2} placeholder="Record why this exact version was reviewed and approved." /></div>
      <Button onClick={() => void issue()} disabled={busy || authoringBlocksIssue || reviewedId !== draftDocument.id || !reason.trim()} className="bg-[#405f4d] text-white hover:bg-[#344d3e]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Issue reviewed MSA</Button>
      {authoringBlocksIssue && <p className="text-xs text-amber-900">Save edits and generate the current PDF before issuing.</p>}
    </section>}
    {!!eligibleToCountersign.length && <section className="space-y-3 rounded-xl border border-[#dce5df] bg-white p-4">
      <div><h3 className="font-semibold text-[#20352a]">OnSpot countersignature</h3><p className="mt-1 text-xs text-slate-600">Available only after the client signature. Review the exact signed PDF first. Countersigning is auditable and does not block activation.</p></div>
      {eligibleToCountersign.map((document) => <div key={document.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div><p className="text-sm font-semibold text-slate-800">Version {document.version}</p><p className="text-xs text-slate-500">Client signed by {document.clientSignerName || "authorized signer"} · {document.clientSignedAt ? new Date(document.clientSignedAt).toLocaleString() : ""}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">SHA-256 {document.sha256}</p></div>
        <Button size="sm" variant="outline" disabled={!!loadingPdf} onClick={() => void openPdf(document, true)}>{loadingPdf === document.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}{reviewedId === document.id ? "Re-open exact signed PDF" : "Open exact signed PDF"}</Button>
        {preview?.id === document.id && <iframe title={`Signed MSA version ${document.version}`} src={preview.url} className="h-[min(55vh,560px)] w-full rounded-lg border border-slate-200 bg-slate-100" />}
        <div className="max-w-md space-y-2"><Label htmlFor={`onspot-legal-name-${document.id}`}>OnSpot legal name</Label><Input id={`onspot-legal-name-${document.id}`} autoComplete="name" maxLength={180} value={onspotNames[document.id] ?? signerProfile?.legalName ?? document.onspotSignerName ?? ""} onChange={(event) => setOnspotNames((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Authorized OnSpot signatory's full legal name" /></div>
        <div className="max-w-md space-y-2"><Label htmlFor={`onspot-title-${document.id}`}>OnSpot title <span className="font-normal text-slate-400">Optional</span></Label><Input id={`onspot-title-${document.id}`} maxLength={160} value={onspotTitles[document.id] ?? signerProfile?.title ?? document.onspotSignerTitle ?? ""} onChange={(event) => setOnspotTitles((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Authorized signatory title" /></div>
        <SignatureInput id={`onspot-drawing-${document.id}`} label="OnSpot drawn signature" value={onspotDrawings[document.id] ?? null} onChange={(value) => setOnspotDrawings((current) => ({ ...current, [document.id]: value }))} />
        <div className="flex items-start gap-2"><Checkbox id={`onspot-consent-${document.id}`} checked={!!onspotConsent[document.id]} onCheckedChange={(value) => setOnspotConsent((current) => ({ ...current, [document.id]: value === true }))} /><Label htmlFor={`onspot-consent-${document.id}`} className="text-xs leading-relaxed">I reviewed the exact PDF and confirm the legal name above is the authorized OnSpot signatory.</Label></div>
        <Button size="sm" onClick={() => void countersign(document)} disabled={busy || reviewedId !== document.id || !onspotConsent[document.id] || !(onspotNames[document.id] ?? signerProfile?.legalName ?? document.onspotSignerName)?.trim()} className="bg-[#405f4d] text-white hover:bg-[#344d3e]"><ShieldCheck className="mr-2 h-4 w-4" />Record OnSpot countersignature</Button>
      </div>)}
    </section>}
    <section className="space-y-2">
      <h3 className="font-semibold text-[#20352a]">Personalized version history</h3>
      {issuedDocuments.length ? issuedDocuments.map((document) => <div key={document.id} className="rounded-xl border border-[#dce5df] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">Version {document.version} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{document.status}</span></p><p className="mt-1 text-xs text-slate-500">{document.filename} · Effective {new Date(document.effectiveAt).toLocaleDateString()} · Template {document.templateVersion}</p><p className="mt-1 text-xs text-slate-600">{document.clientSignedAt ? `Client signature recorded · ${document.clientSignerName || "authorized signer"}${document.clientSignerTitle ? `, ${document.clientSignerTitle}` : ""}${document.clientHasDrawnSignature ? " · drawn signature recorded" : ""} · ${new Date(document.clientSignedAt).toLocaleDateString()}` : "Client signature pending"} · {document.onspotSignedAt ? `OnSpot signature recorded · ${document.onspotSignerName || "authorized signer"}${document.onspotSignerTitle ? `, ${document.onspotSignerTitle}` : ""}${document.onspotHasDrawnSignature ? " · drawn signature recorded" : ""} · ${new Date(document.onspotSignedAt).toLocaleDateString()}` : "OnSpot countersignature pending (non-blocking)"}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">SHA-256 {document.sha256}</p></div>
          <Button size="sm" variant="outline" disabled={!!loadingPdf} onClick={() => void openPdf(document)}>{loadingPdf === document.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}Review private PDF</Button>
          {document.executedUrl && <Button size="sm" variant="outline" onClick={async () => { const response = await fetch(`/api/client/msa/${encodeURIComponent(document.id)}/executed`, { credentials: "include", headers: adminAuthHeaders() }); if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.message || body.error || "Executed copy unavailable."); return; } const blob = await response.blob(); if (blob.type !== "application/pdf") { setError("The authorized response was not an executed PDF."); return; } const url = URL.createObjectURL(blob); const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `msa-${document.version}-executed.pdf`; anchor.click(); URL.revokeObjectURL(url); }}>Download executed copy</Button>}
        </div>{preview?.id === document.id && <iframe title={`Private MSA version ${document.version}`} src={preview.url} className="mt-3 h-[min(55vh,560px)] w-full rounded-lg border border-slate-200 bg-slate-100" />}
      </div>) : <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">No personalized versions issued for this client yet.</div>}
    </section>
    {notice && <p role="status" className="rounded-lg bg-[#e8f1ea] p-3 text-sm text-[#365743]"><CheckCircle2 className="mr-2 inline h-4 w-4" />{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</p>}
  </section>;
}
