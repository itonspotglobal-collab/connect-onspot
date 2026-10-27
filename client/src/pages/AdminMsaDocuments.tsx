import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, ShieldCheck, Loader2, AlertCircle, RotateCw, CircleCheck, Eye, X } from "lucide-react";

interface MsaDocument {
  id: string; version: string; sha256: string; effectiveAt: string; active: boolean; filename: string; viewUrl: string;
}
function adminHeaders(): Record<string, string> {
  const token = localStorage.getItem("onspot_jwt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export default function AdminMsaDocuments() {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<{ items: MsaDocument[] }>({
    queryKey: ["/api/admin/msa-documents"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/msa-documents")).json(),
  });
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  async function uploadDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !version.trim() || !effectiveAt) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf") || file.size <= 0 || file.size > 20 * 1024 * 1024) {
      toast({ title: "Choose a valid PDF", description: "Use a non-empty PDF up to 20 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("version", version.trim());
      form.append("effectiveAt", effectiveAt);
      const response = await fetch("/api/admin/msa-documents", { method: "POST", headers: adminHeaders(), credentials: "include", body: form });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || body.error || `Upload failed (${response.status})`); }
      setFile(null); setVersion(""); setEffectiveAt("");
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["/api/admin/msa-documents"] });
      toast({ title: "MSA draft uploaded", description: "Review the file and activate it only after approval." });
    } catch (error) { toast({ title: "Could not upload MSA", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setUploading(false); }
  }
  async function activate(document: MsaDocument) {
    if (!reviewReason.trim()) {
      toast({ title: "Review reason required", description: "Enter why this document was reviewed and approved.", variant: "destructive" });
      return;
    }
    setActivating(document.id);
    try {
      await apiRequest("POST", `/api/admin/msa-documents/${encodeURIComponent(document.id)}/activate`, { reviewed: true, reason: reviewReason.trim() });
      await qc.invalidateQueries({ queryKey: ["/api/admin/msa-documents"] });
      setReviewReason("");
      toast({ title: "MSA version activated", description: `Version ${document.version} is now current.` });
    } catch (error) { toast({ title: "Could not activate version", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setActivating(null); }
  }
  async function review(document: MsaDocument) {
    if (preview?.id === document.id) { setPreview(null); return; }
    setPreviewing(document.id);
    try {
      const response = await fetch(document.viewUrl || `/api/client/msa/${encodeURIComponent(document.id)}/pdf`, { headers: adminHeaders(), credentials: "include" });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || body.error || `Private PDF unavailable (${response.status})`); }
      const blob = await response.blob();
      if (blob.type !== "application/pdf") throw new Error("The authorized response was not a PDF.");
      setPreview({ id: document.id, url: URL.createObjectURL(blob) });
    } catch (error) { toast({ title: "Could not review MSA PDF", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setPreviewing(null); }
  }
  return <div className="min-h-[100dvh] bg-[#f3f6f2]"><TopNavigation /><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#557064]">Admin settings</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#20352a]">MSA documents</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Upload versioned agreements to private storage. Only an explicitly reviewed active version can be issued for client signature.</p></div>
    <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <Card className="h-fit border-[#dce5df]"><CardContent className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-[#e7efe9] p-2.5 text-[#45664d]"><Upload className="h-5 w-5" /></div><div><h2 className="font-semibold text-slate-900">Add a draft version</h2><p className="text-xs text-slate-500">PDF only · private until activated</p></div></div>
        <form onSubmit={uploadDraft} className="space-y-4"><div className="space-y-2"><Label htmlFor="msa-version">Version</Label><Input id="msa-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 2025.2" maxLength={80} required /></div>
          <div className="space-y-2"><Label htmlFor="msa-effective-date">Effective date</Label><Input id="msa-effective-date" type="date" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="msa-upload">Agreement PDF</Label><Input id="msa-upload" ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></div>
          <div className="rounded-lg bg-[#f5f8f5] p-3 text-xs leading-relaxed text-slate-600"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[#557064]" />Uploading creates a draft only. It does not seed, publish, or activate an agreement.</div>
          <Button type="submit" disabled={!file || !version.trim() || !effectiveAt || uploading} className="w-full bg-[#405f4d] text-white hover:bg-[#344d3e]">{uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading privately…</> : "Upload draft PDF"}</Button>
        </form>
      </CardContent></Card>
      <section className="space-y-4"><div className="flex items-end justify-between"><div><h2 className="text-lg font-semibold text-[#20352a]">Version history</h2><p className="text-xs text-slate-500">Current and draft documents</p></div><Button variant="outline" size="sm" onClick={() => refetch()}><RotateCw className="mr-2 h-3.5 w-3.5" />Refresh</Button></div>
        {isLoading ? <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />)}</div>
          : isError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><AlertCircle className="mr-2 inline h-4 w-4" />Could not load MSA documents. <button className="underline" onClick={() => refetch()}>Retry</button></div>
          : !(data?.items?.length) ? <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center"><FileText className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-medium text-slate-700">No agreement documents yet</p><p className="mt-1 text-xs text-slate-500">Upload an approved source PDF to begin.</p></div>
          : data.items.map((document) => <Card key={document.id} className={`border ${document.active ? "border-[#b9d0bf] bg-[#f8fbf8]" : "border-[#dce5df] bg-white"}`}><CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="rounded-lg bg-slate-100 p-2 text-slate-600"><FileText className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{document.filename}</p><p className="mt-1 text-xs text-slate-500">Version {document.version} · Effective {new Date(document.effectiveAt).toLocaleDateString()}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">SHA-256 {document.sha256}</p></div></div>
              {document.active ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e5efe7] px-2.5 py-1 text-[10px] font-bold text-[#45664d]"><CircleCheck className="h-3.5 w-3.5" />Active</span> : <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Draft</span>}</div>
            <Button size="sm" variant="outline" disabled={!!previewing} onClick={() => void review(document)}>{previewing === document.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : preview?.id === document.id ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}{preview?.id === document.id ? "Close private preview" : "Review private PDF"}</Button>
            {preview?.id === document.id && <iframe title={`Private MSA version ${document.version}`} src={preview.url} className="h-[min(60vh,640px)] w-full rounded-lg border border-slate-200 bg-slate-100" />}
            {!document.active && <div className="space-y-2 border-t border-slate-100 pt-3"><Label htmlFor={`reason-${document.id}`} className="text-xs">Review and activation reason</Label><div className="flex flex-col gap-2 sm:flex-row"><Textarea id={`reason-${document.id}`} value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Confirm this version was reviewed and approved…" rows={2} maxLength={1200} /><Button disabled={!reviewReason.trim() || !!activating} onClick={() => void activate(document)} className="shrink-0 bg-[#405f4d] text-white hover:bg-[#344d3e]">{activating === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate version"}</Button></div></div>}
          </CardContent></Card>)}
      </section>
    </div>
  </main></div>;
}
