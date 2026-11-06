import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, FileText, Loader2, RotateCw, ShieldCheck } from "lucide-react";
import { SignatureInput } from "@/components/SignatureInput";

interface MsaRecord { id: string; version: string; sha256: string; effectiveAt: string; viewUrl: string; executedUrl?: string | null; }
interface MsaHistory extends MsaRecord {
  signedAt: string | null;
  signerName: string | null;
  signerTitle?: string | null;
  personalized: boolean;
  status: string;
  executedUrl?: string | null;
}
interface SignerProfile { userId: string; legalName: string; title: string; }
interface ClientMsaInfo {
  document: MsaRecord | null;
  signerProfile?: SignerProfile;
  signature: { id: string; signedAt: string; signerName: string; signerTitle?: string | null; hasDrawnSignature?: boolean } | null;
  requiresSignature: boolean;
  issued: boolean;
  countersignature: { legalName: string; signedAt: string; signerTitle?: string | null; hasDrawnSignature?: boolean } | null;
  countersignatureBlocksActivation: false;
  personalized: boolean;
  history: MsaHistory[];
}
function authHeaders(): Record<string, string> {
  const jwt = localStorage.getItem("onspot_jwt_token");
  if (jwt) return { Authorization: `Bearer ${jwt}` };
  try { const token = JSON.parse(localStorage.getItem("talent_profile_token") || "null")?.token; return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; }
}

export default function ClientMsa() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [executedPdfUrl, setExecutedPdfUrl] = useState("");
  const [executedPdfError, setExecutedPdfError] = useState("");
  const [executedLoading, setExecutedLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfRetry, setPdfRetry] = useState(0);
  const [historySelection, setHistorySelection] = useState<MsaHistory | null>(null);
  const currentUrl = useRef("");
  const executedUrlRef = useRef("");
  const initializedSignerKey = useRef("");
  const { data, isLoading, isError, refetch } = useQuery<ClientMsaInfo>({
    queryKey: ["/api/client/msa"],
    queryFn: async () => (await apiRequest("GET", "/api/client/msa")).json(),
  });
  const signerIdentityKey = `${data?.document?.id ?? ""}:${data?.document?.sha256 ?? ""}:${data?.signerProfile?.userId ?? ""}`;
  const viewing = historySelection ?? (data?.document ? {
    ...data.document,
    signedAt: data.signature?.signedAt ?? null,
    signerName: data.signature?.signerName ?? null,
    personalized: data.personalized,
    status: data.issued ? "issued" : "available",
  } : null);
  useEffect(() => {
    setExecutedPdfError("");
    if (executedUrlRef.current) URL.revokeObjectURL(executedUrlRef.current);
    executedUrlRef.current = "";
    setExecutedPdfUrl("");
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = "";
    setPdfUrl("");
  }, [viewing?.id, viewing?.sha256]);

  useEffect(() => {
    if (!data?.document || initializedSignerKey.current === signerIdentityKey) return;
    initializedSignerKey.current = signerIdentityKey;
    setConsent(false);
    setSignerName(data.signerProfile?.legalName ?? "");
    setSignerTitle(data.signerProfile?.title ?? "");
    setDrawnSignature(null);
    setHistorySelection(null);
    setExecutedPdfError("");
    if (executedUrlRef.current) URL.revokeObjectURL(executedUrlRef.current);
    executedUrlRef.current = "";
    setExecutedPdfUrl("");
  }, [data?.document?.id, data?.document?.sha256, signerIdentityKey]);

  useEffect(() => {
    let live = true;
    async function load() {
      if (!viewing || (!historySelection && !data?.issued && !data?.signature)) {
        if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = "";
        setPdfUrl("");
        return;
      }
      setPdfError("");
      setPdfUrl("");
      try {
        const response = await fetch(`/api/client/msa/${encodeURIComponent(viewing.id)}/pdf`, { headers: authHeaders(), credentials: "include" });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || body.error || `Private agreement could not be opened (${response.status}).`);
        }
        const blob = await response.blob();
        if (blob.type !== "application/pdf") throw new Error("The authorized response was not a PDF.");
        const url = URL.createObjectURL(blob);
        if (live) {
          if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
          currentUrl.current = url;
          setPdfUrl(url);
        } else URL.revokeObjectURL(url);
      } catch (error) { if (live) setPdfError(error instanceof Error ? error.message : "Unable to load the private agreement."); }
    }
    void load();
    return () => { live = false; };
  }, [viewing?.id, viewing?.sha256, pdfRetry, data?.issued, historySelection?.id, signerIdentityKey]);
  useEffect(() => () => { if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); if (executedUrlRef.current) URL.revokeObjectURL(executedUrlRef.current); }, []);

  async function loadExecutedPdf(record: MsaRecord) {
    if (!record.executedUrl) return;
    setExecutedLoading(true); setExecutedPdfError("");
    try {
      const response = await fetch(`/api/client/msa/${encodeURIComponent(record.id)}/executed`, { headers: authHeaders(), credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Executed copy unavailable (${response.status}).`);
      }
      const blob = await response.blob();
      if (blob.type !== "application/pdf") throw new Error("The authorized response was not an executed PDF.");
      const url = URL.createObjectURL(blob);
      if (executedUrlRef.current) URL.revokeObjectURL(executedUrlRef.current);
      executedUrlRef.current = url;
      setExecutedPdfUrl(url);
    } catch (error) { setExecutedPdfError(error instanceof Error ? error.message : "Unable to load executed copy."); }
    finally { setExecutedLoading(false); }
  }

  async function sign() {
    if (!data?.document || !consent || !signerName.trim() || !pdfUrl || historySelection) return;
    setBusy(true);
    try {
      await apiRequest("POST", "/api/client/msa/sign", { documentId: data.document.id, documentSha256: data.document.sha256, consent: true, signerName: signerName.trim(), signerTitle: signerTitle.trim().slice(0, 160) || undefined, drawnSignature });
      await qc.invalidateQueries({ queryKey: ["/api/client/msa"] });
      toast({ title: "Master Services Agreement signed", description: "Your signature is bound to this document version." });
    } catch (error) { toast({ title: "Could not record signature", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setBusy(false); }
  }

  return <div className="min-h-[100dvh] bg-[#f3f6f2]"><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#557064]">Client documents</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#20352a]">Master Services Agreement</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Review the agreement issued for your engagement. A recorded signature applies only to the identified document version.</p></div>
    {data?.personalized && <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#cbd9cf] bg-[#eaf1eb] p-4 text-sm text-[#365743]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Your client-specific agreement</strong><br />This version is populated for your engagement and is separate from the shared MSA archive.</p></div>}
    <Card className="overflow-hidden border-[#dce5df] shadow-sm"><CardContent className="p-0">
      {isLoading ? <div className="space-y-3 p-6"><div className="h-5 w-52 animate-pulse rounded bg-slate-200" /><div className="h-[420px] animate-pulse rounded bg-slate-100" /></div>
        : isError || !data ? <div className="p-8 text-center"><AlertCircle className="mx-auto h-8 w-8 text-amber-600" /><p className="mt-3 font-semibold">Agreement status could not be loaded</p><Button className="mt-4" variant="outline" onClick={() => void refetch()}><RotateCw className="mr-2 h-4 w-4" />Retry</Button></div>
        : !data.document && !historySelection ? <div className="p-8 text-center"><FileText className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 font-semibold text-slate-800">No active agreement available</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">OnSpot has not issued an agreement for this engagement. No agreement has been assumed or created.</p></div>
        : !data.issued && !data.signature && !historySelection ? <div className="p-8 text-center"><FileText className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 font-semibold text-slate-800">No signature request yet</h2><p className="mt-2 text-sm text-slate-500">The agreement will appear here when it is issued for your engagement.</p></div>
        : <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3eae5] bg-[#f8faf8] px-5 py-4"><div><p className="font-semibold text-slate-800">{viewing?.personalized ? "Client-specific MSA" : "OnSpot MSA"} · Version {viewing?.version}</p><p className="mt-1 text-xs text-slate-500">Effective {viewing?.effectiveAt ? new Date(viewing.effectiveAt).toLocaleDateString() : "—"} · SHA-256 {viewing?.sha256.slice(0, 16)}…</p>{historySelection && <p className="mt-1 text-[11px] text-slate-500">Reviewing archived version · {historySelection.status}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.signature && !historySelection ? "bg-[#e5efe7] text-[#45664d]" : "bg-[#e7ece8] text-slate-700"}`}>{historySelection ? historySelection.status : data.signature ? "Signed" : "Issued for review"}</span></div>
            {historySelection && <Button variant="outline" size="sm" className="m-4" onClick={()=>{setHistorySelection(null);setConsent(false);setSignerName(data.signerProfile?.legalName ?? "");setSignerTitle(data.signerProfile?.title ?? "");setDrawnSignature(null);}}>Back to current agreement</Button>}
          {pdfError ? <div className="p-8 text-center text-sm text-rose-700">{pdfError}<Button variant="outline" size="sm" className="ml-3" onClick={() => setPdfRetry((value) => value + 1)}>Retry</Button></div> : pdfUrl ? <iframe title={`${viewing?.personalized ? "Client" : "OnSpot"} MSA version ${viewing?.version}`} src={pdfUrl} className="h-[min(65vh,720px)] w-full bg-slate-100" /> : <div className="h-[420px] animate-pulse bg-slate-100" />}
            {!historySelection && data.signature && <div className="flex flex-wrap items-center gap-2 border-t border-[#e3eae5] bg-[#f8faf8] px-5 py-4 text-sm text-[#365743]"><CheckCircle2 className="h-5 w-5" /><p><strong>Signature recorded</strong> by {data.signature.signerName}{data.signature.signerTitle ? ` · ${data.signature.signerTitle}` : ""} on {new Date(data.signature.signedAt).toLocaleDateString()}.{data.signature.hasDrawnSignature ? " Drawn signature recorded." : ""}</p></div>}
            {viewing?.executedUrl && <div className="space-y-3 border-t border-[#e3eae5] bg-[#f8faf8] p-5"><div><h2 className="font-semibold text-slate-800">Executed agreement</h2><p className="mt-1 text-xs text-slate-500">Available only after both personal MSA signatures have been recorded.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={executedLoading} onClick={() => void loadExecutedPdf(viewing)}>{executedLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}{executedPdfUrl ? "Reload executed copy" : "Open executed copy"}</Button>{executedPdfUrl && <Button size="sm" variant="outline" onClick={() => { const anchor = document.createElement("a"); anchor.href = executedPdfUrl; anchor.download = `msa-${viewing.version}-executed.pdf`; anchor.click(); }}>Download executed copy</Button>}</div>{executedPdfError && <p role="alert" className="text-sm text-rose-700">{executedPdfError}</p>}{executedPdfUrl && <iframe title="Private executed MSA" src={executedPdfUrl} className="h-[min(55vh,560px)] w-full rounded-lg border border-[#dce5df] bg-slate-100" />}</div>}
          {!historySelection && data.document && (data.personalized || !data.signature) && <div className={`border-t border-[#e3eae5] p-5 ${data.signature ? "bg-[#fbfcfb]" : ""}`}>
            {data.signature ? <div className="space-y-3"><h2 className="font-semibold text-slate-800">OnSpot countersignature</h2>{data.countersignature ? <p className="flex items-start gap-2 rounded-lg bg-[#eaf1eb] p-3 text-sm text-[#365743]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Countersignature recorded by {data.countersignature.legalName}{data.countersignature.signerTitle ? ` · ${data.countersignature.signerTitle}` : ""} on {new Date(data.countersignature.signedAt).toLocaleDateString()}.{data.countersignature.hasDrawnSignature ? " Drawn signature recorded." : ""} This status does not block activation.</p> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">OnSpot countersignature is pending. It is non-blocking and is not required for activation.</p>}</div>
              : data.requiresSignature && <div className="space-y-4"><div className="flex items-start gap-3"><Checkbox id="msa-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><Label htmlFor="msa-consent" className="text-sm leading-relaxed">I have reviewed this agreement and consent to sign version {data.document.version}, identified by the SHA-256 hash shown above.</Label></div><div className="max-w-md space-y-2"><Label htmlFor="msa-signer">Full legal name</Label><Input id="msa-signer" autoComplete="name" value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Type your full name" maxLength={180} /></div><div className="max-w-md space-y-2"><Label htmlFor="msa-signer-title">Title <span className="font-normal text-slate-400">Optional</span></Label><Input id="msa-signer-title" value={signerTitle} onChange={(event) => setSignerTitle(event.target.value)} placeholder="Your role or title" maxLength={160} /></div><SignatureInput id="msa-drawn-signature" value={drawnSignature} onChange={setDrawnSignature} /><Button onClick={() => void sign()} disabled={!consent || !signerName.trim() || !pdfUrl || busy || !!historySelection} className="bg-[#405f4d] text-white hover:bg-[#344d3e]">{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording signature…</> : <><ShieldCheck className="mr-2 h-4 w-4" />Sign current agreement</>}</Button></div>}
          </div>}
        </>}
    </CardContent></Card>
    {!!data?.history?.length && <section className="mt-6 space-y-3"><div><h2 className="text-lg font-semibold text-[#20352a]">Agreement history</h2><p className="mt-1 text-xs text-slate-500">Private versions and signature records remain available for review.</p></div>
       {data.history.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[#dce5df] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">Version {item.version} <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.personalized ? "bg-[#e5efe7] text-[#45664d]" : "bg-slate-100 text-slate-600"}`}>{item.personalized ? "Client-specific" : "Shared MSA"}</span></p><p className="mt-1 text-xs text-slate-500">Effective {new Date(item.effectiveAt).toLocaleDateString()} · {item.status}</p><p className="mt-1 text-xs text-slate-600">{item.signedAt ? `Signature recorded · ${item.signerName || "authorized signer"}${item.signerTitle ? `, ${item.signerTitle}` : ""} · ${new Date(item.signedAt).toLocaleDateString()}` : "Not signed"}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">SHA-256 {item.sha256}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setConsent(false); setSignerName(""); setSignerTitle(""); setDrawnSignature(null); setHistorySelection(item); }}><FileText className="mr-2 h-4 w-4" />Review signed copy</Button>{item.executedUrl && <Button size="sm" variant="outline" onClick={() => void loadExecutedPdf(item)}>Open executed copy</Button>}</div></div>)}
    </section>}
  </main></div>;
}
