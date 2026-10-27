import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, ShieldCheck, Loader2, AlertCircle, RotateCw } from "lucide-react";

interface ClientMsaInfo {
  document: { id: string; version: string; sha256: string; effectiveAt: string; viewUrl: string } | null;
  signature: { id: string; signedAt: string; signerName: string } | null;
  requiresSignature: boolean;
  issued: boolean;
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
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfRetry, setPdfRetry] = useState(0);
  const currentUrl = useRef("");
  const { data, isLoading, isError, refetch } = useQuery<ClientMsaInfo>({
    queryKey: ["/api/client/msa"],
    queryFn: async () => (await apiRequest("GET", "/api/client/msa")).json(),
  });
  useEffect(() => {
    let live = true;
    async function load() {
      if (!data?.document || data.signature || !data.issued) {
        if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = "";
        setPdfUrl("");
        return;
      }
      setPdfError("");
      try {
        const response = await fetch(`/api/client/msa/${encodeURIComponent(data.document.id)}/pdf`, { headers: authHeaders(), credentials: "include" });
        if (!response.ok) throw new Error(`The private document could not be opened (${response.status}).`);
        const blob = await response.blob();
        if (blob.type !== "application/pdf") throw new Error("The authorized response was not a PDF.");
        const url = URL.createObjectURL(blob);
        if (live) { if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); currentUrl.current = url; setPdfUrl(url); }
        else URL.revokeObjectURL(url);
      } catch (error) { if (live) setPdfError(error instanceof Error ? error.message : "Unable to load the private agreement."); }
    }
    void load();
    return () => { live = false; };
  }, [data?.document?.id, data?.document?.sha256, data?.issued, data?.signature, pdfRetry]);
  useEffect(() => () => { if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); }, []);
  async function sign() {
    if (!data?.document || !consent || !signerName.trim()) return;
    setBusy(true);
    try {
      await apiRequest("POST", "/api/client/msa/sign", { documentId: data.document.id, documentSha256: data.document.sha256, consent: true, signerName: signerName.trim() });
      await qc.invalidateQueries({ queryKey: ["/api/client/msa"] });
      toast({ title: "Master Services Agreement signed", description: "Your signature is bound to this document version." });
    } catch (error) { toast({ title: "Could not record signature", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <div className="min-h-[100dvh] bg-[#f3f6f2]"><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#557064]">Client documents</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#20352a]">Master Services Agreement</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Review the active OnSpot agreement. A signed current version is required before a contractor engagement can become active.</p></div>
    <Card className="overflow-hidden border-[#dce5df] shadow-sm"><CardContent className="p-0">
      {isLoading ? <div className="space-y-3 p-6"><div className="h-5 w-52 animate-pulse rounded bg-slate-200" /><div className="h-[420px] animate-pulse rounded bg-slate-100" /></div>
        : isError ? <div className="p-8 text-center"><AlertCircle className="mx-auto h-8 w-8 text-amber-600" /><p className="mt-3 font-semibold">Agreement status could not be loaded</p><Button className="mt-4" variant="outline" onClick={() => refetch()}><RotateCw className="mr-2 h-4 w-4" />Retry</Button></div>
        : !data?.document ? <div className="p-8 text-center"><FileText className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 font-semibold text-slate-800">No active agreement available</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">OnSpot has not published an active MSA document. This must be resolved by an administrator; no agreement has been assumed or created.</p></div>
        : data.signature ? <div className="p-8 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#4b7958]" /><h2 className="mt-3 text-xl font-semibold text-[#20352a]">Agreement signed</h2><p className="mt-2 text-sm text-slate-600">Version {data.document.version} · signed by {data.signature.signerName} on {new Date(data.signature.signedAt).toLocaleDateString()}.</p></div>
        : !data.issued ? <div className="p-8 text-center"><FileText className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 font-semibold text-slate-800">No signature request yet</h2><p className="mt-2 text-sm text-slate-500">The agreement will appear here when it is issued for your engagement.</p></div>
        : <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3eae5] bg-[#f8faf8] px-5 py-4"><div><p className="font-semibold text-slate-800">OnSpot MSA · Version {data.document.version}</p><p className="mt-1 text-xs text-slate-500">Effective {new Date(data.document.effectiveAt).toLocaleDateString()} · SHA-256 {data.document.sha256.slice(0, 16)}…</p></div><span className="rounded-full bg-[#e5efe7] px-3 py-1 text-xs font-semibold text-[#45664d]">Issued for review</span></div>
          {pdfError ? <div className="p-8 text-center text-sm text-rose-700">{pdfError}<Button variant="outline" size="sm" className="ml-3" onClick={() => setPdfRetry((value) => value + 1)}>Retry</Button></div> : pdfUrl ? <iframe title={`OnSpot MSA version ${data.document.version}`} src={pdfUrl} className="h-[min(65vh,720px)] w-full bg-slate-100" /> : <div className="h-[420px] animate-pulse bg-slate-100" />}
          <div className="space-y-4 border-t border-[#e3eae5] p-5">
            <div className="flex items-start gap-3"><Checkbox id="msa-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><Label htmlFor="msa-consent" className="text-sm leading-relaxed">I have reviewed this agreement and consent to sign version {data.document.version}, identified by the SHA-256 hash shown above.</Label></div>
            <div className="max-w-md space-y-2"><Label htmlFor="msa-signer">Full legal name</Label><Input id="msa-signer" autoComplete="name" value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Type your full name" maxLength={180} /></div>
            <Button onClick={sign} disabled={!consent || !signerName.trim() || !pdfUrl || busy} className="bg-[#405f4d] text-white hover:bg-[#344d3e]">{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording signature…</> : <><ShieldCheck className="mr-2 h-4 w-4" />Sign current agreement</>}</Button>
          </div></>}
    </CardContent></Card>
  </main></div>;
}
