import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileCheck2, Landmark, RefreshCw, Settings2, Upload } from "lucide-react";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WiseCategory, WiseObligation, WiseSubmission } from "./ManualWisePaymentPanel";

type WiseConfig = { id: string; currency: string; recipient: string; instructions: string; referenceInstructions: string; active: boolean; qrFileId?: string | null; qr_file_id?: string | null; created_at?: string };
type AdminSubmission = WiseSubmission & { category: WiseCategory; obligation_id: string; payer_name: string; payer_email: string; expected_recipient: string; history: WiseSubmission[] };
function errorMessage(error: unknown) {
  const e = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
  if (e?.response?.status === 403 || e?.message?.includes("403")) return "Access denied (403). This console is restricted to authorized Super Admins.";
  return e?.response?.data?.error || e?.message || "The request could not be completed.";
}
function adminToken() {
  return localStorage.getItem("onspot_jwt_token");
}
async function fetchQrBlob(path: string) {
  const token = adminToken();
  const response = await fetch(path, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(response.status === 403
      ? "Access denied (403). This protected QR is available to authorized Super Admins only."
      : `QR image request failed (${response.status}).`);
  }
  return response.blob();
}
function downloadBlob(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noreferrer";
  link.click();
}
function useInvalidate() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["/api/admin/manual-wise/submissions"] }),
      client.invalidateQueries({ queryKey: ["/api/admin/manual-wise/config"] }),
      client.invalidateQueries({ queryKey: ["/api/admin/manual-wise/payouts"] }),
    ]);
  };
}
const initialConfig = { currency: "USD", recipient: "", instructions: "", referenceInstructions: "", active: false, depositFundingConfirmed: false };
const initialReview = { action: "verify" as "verify" | "reject", reason: "", verifiedAmount: "", verifiedCurrency: "", verifiedReference: "", verifiedRecipient: "", settledAt: "", independentlyVerified: false };

export function AdminWisePayments() {
  const invalidate = useInvalidate();
  const [filters, setFilters] = useState({ category: "", status: "", payer: "", reference: "", from: "", to: "", currency: "" });
  const [config, setConfig] = useState(initialConfig);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrFileId, setQrFileId] = useState("");
  const [officialQrUrl, setOfficialQrUrl] = useState("");
  const [officialQrError, setOfficialQrError] = useState("");
  const [quote, setQuote] = useState({ inquiryId: "", amount: "", currency: "USD" });
  const [topup, setTopup] = useState({ depositId: "", amount: "", reference: "" });
  const [topupResult, setTopupResult] = useState("");
  const [selected, setSelected] = useState<AdminSubmission | null>(null);
  const [review, setReview] = useState(initialReview);
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
  const configQuery = useQuery<{ items: WiseConfig[] }>({ queryKey: ["/api/admin/manual-wise/config"], queryFn: () => authAPI.get("/api/admin/manual-wise/config") });
  useEffect(() => {
    let alive = true;
    let createdUrl = "";
    setOfficialQrError("");
    fetchQrBlob("/api/admin/manual-wise/config/qr/official")
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob);
        if (alive) setOfficialQrUrl(createdUrl);
        else URL.revokeObjectURL(createdUrl);
      })
      .catch((cause: unknown) => { if (alive) setOfficialQrError(errorMessage(cause)); });
    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, []);
  const submissionQuery = useQuery<{ items: AdminSubmission[] }>({
    queryKey: ["/api/admin/manual-wise/submissions", filters],
    queryFn: () => authAPI.get(`/api/admin/manual-wise/submissions${params.toString() ? `?${params.toString()}` : ""}`),
  });
  const payoutsQuery = useQuery<{ items: WiseObligation[] }>({ queryKey: ["/api/admin/manual-wise/payouts"], queryFn: () => authAPI.get("/api/admin/manual-wise/payouts") });
  const queryClient = useQueryClient();
  const saveConfig = useMutation({
    mutationFn: () => authAPI.post("/api/admin/manual-wise/config", { ...config, ...(qrFileId ? { qrFileId } : {}) }),
    onSuccess: async () => { setConfig(initialConfig); setQrFileId(""); setQrFile(null); await invalidate(); },
  });
  const uploadQr = useMutation({
    mutationFn: async () => {
      if (!qrFile) throw new Error("Select a QR image first.");
      const form = new FormData(); form.append("receipt", qrFile);
      const token = localStorage.getItem("onspot_jwt_token");
      const res = await fetch("/api/admin/manual-wise/config/qr", { method: "POST", body: form, credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(res.status === 403 ? "Access denied (403). Only an authorized Super Admin can upload payment QR images." : body.error || `QR upload failed (${res.status}).`); }
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => { setQrFileId(data.id); setQrFile(null); },
  });
  const useOfficialQr = useMutation({
    mutationFn: async () => {
      const token = adminToken();
      const response = await fetch("/api/admin/manual-wise/config/qr/official", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 403
          ? "Access denied (403). Only an authorized Super Admin can stage the supplied QR."
          : body.error || `Could not stage supplied QR (${response.status}).`);
      }
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => setQrFileId(data.id),
  });
  const reviewMutation = useMutation({
    mutationFn: () => authAPI.post(`/api/admin/manual-wise/submissions/${selected!.id}/review`, {
      action: review.action,
      reason: review.reason.trim(),
      ...(review.action === "verify" ? {
        independentlyVerified: review.independentlyVerified,
        verifiedAmount: review.verifiedAmount.trim(),
        verifiedCurrency: review.verifiedCurrency.trim(),
        verifiedReference: review.verifiedReference.trim(),
        verifiedRecipient: review.verifiedRecipient.trim(),
        settledAt: review.settledAt ? new Date(review.settledAt).toISOString() : "",
      } : {}),
    }),
    onSuccess: async () => { setSelected(null); setReview(initialReview); await invalidate(); },
  });
  const quoteMutation = useMutation({
    mutationFn: () => authAPI.post(`/api/admin/manual-wise/inquiries/${encodeURIComponent(quote.inquiryId)}/quote`, { amount: quote.amount, currency: quote.currency }),
    onSuccess: async () => { setQuote({ inquiryId: "", amount: "", currency: "USD" }); await invalidate(); },
  });
  const topupMutation = useMutation({
    mutationFn: () => authAPI.post(`/api/admin/security-deposits/${encodeURIComponent(topup.depositId)}/replenishments`, {
      amount: topup.amount,
      currency: "USD",
      ...(topup.reference.trim() ? { reference: topup.reference.trim() } : {}),
    }),
    onSuccess: async (result: { payment_status?: string }) => {
      setTopupResult(`Funding request created with payment status “${result?.payment_status || "unpaid"}”. This request is not settled funding and provides no deposit coverage until independently verified.`);
      setTopup({ depositId: "", amount: "", reference: "" });
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/ledger"] });
    },
  });
  const openReview = (item: AdminSubmission) => {
    setSelected(item);
    setReview({ ...initialReview, verifiedAmount: item.amount || "", verifiedCurrency: item.currency || "", verifiedReference: item.reference || "", verifiedRecipient: item.expected_recipient || "" });
  };
  const formSubmit = (event: FormEvent) => { event.preventDefault(); saveConfig.mutate(); };
  const submissions = submissionQuery.data?.items || [];
  const configs = configQuery.data?.items || [];
  const payouts = payoutsQuery.data?.items || [];
  const mutationError = saveConfig.error || uploadQr.error || reviewMutation.error || quoteMutation.error || topupMutation.error;
  return <section id="manual-wise-admin" className="space-y-6" aria-label="Manual Wise payment administration">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Settlement operations</p><h2 className="mt-1 text-2xl font-semibold">Manual Wise payments</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Receipts are claims, not settlement. Record only independently confirmed transfers.</p></div><Button variant="outline" onClick={() => { configQuery.refetch(); submissionQuery.refetch(); payoutsQuery.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Refresh all</Button></div>
    {mutationError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errorMessage(mutationError)}</p>}
    {(configQuery.isError || submissionQuery.isError || payoutsQuery.isError) && <div role="alert" className="rounded-lg border border-rose-200 p-3 text-sm text-rose-800">{errorMessage(configQuery.error || submissionQuery.error || payoutsQuery.error)} <span className="block text-xs">403 responses are shown directly: this feature requires an authorized Super Admin.</span></div>}
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-primary" /> Wise payment instructions</CardTitle><p className="text-sm text-muted-foreground">Existing versions remain immutable. Save a new recipient configuration to replace the active instructions. Do not use placeholder or unverified bank details.</p></CardHeader>
      <CardContent className="space-y-4">
         {configQuery.isLoading ? <div className="h-16 animate-pulse rounded bg-muted" /> : configs.length > 0 && <div className="space-y-2">{configs.map((item) => { const fileId = item.qr_file_id || item.qrFileId; return <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{item.currency} · {item.recipient}</strong><span className={item.active ? "font-semibold text-emerald-700" : "text-muted-foreground"}>{item.active ? "Active version" : "Historical / inactive"}</span></div><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.instructions}</p>{fileId ? <AuthorizedQrPreview fileId={fileId} name={`wise-qr-${item.currency.toLowerCase()}.png`} /> : <p className="mt-2 text-xs text-muted-foreground">No QR image configured for this version.</p>}</div>; })}</div>}
        <form className="space-y-3 border-t pt-4" onSubmit={formSubmit}>
          <p className="font-semibold">Create / replace instructions</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Currency<Input required maxLength={3} value={config.currency} onChange={(event) => setConfig({ ...config, currency: event.target.value.toUpperCase() })} placeholder="USD" /></label>
            <label className="space-y-1 text-sm">Verified Wise recipient<Input required value={config.recipient} onChange={(event) => setConfig({ ...config, recipient: event.target.value })} placeholder="Enter confirmed account recipient" /></label>
          </div>
          <label className="block space-y-1 text-sm">Transfer instructions<textarea required className="min-h-20 w-full rounded-md border bg-background px-3 py-2" value={config.instructions} onChange={(event) => setConfig({ ...config, instructions: event.target.value })} /></label>
          <label className="block space-y-1 text-sm">Reference instructions<textarea className="min-h-16 w-full rounded-md border bg-background px-3 py-2" value={config.referenceInstructions} onChange={(event) => setConfig({ ...config, referenceInstructions: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.active} onChange={(event) => setConfig({ ...config, active: event.target.checked })} />Set this configuration as active</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={config.depositFundingConfirmed} onChange={(event) => setConfig({ ...config, depositFundingConfirmed: event.target.checked })} /><span>I independently confirmed the destination and any required deposit funding.</span></label>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><AlertTriangle className="mr-1 inline h-4 w-4" />No real recipient or QR is prefilled. Confirm account ownership independently before activating.</div>
           <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
             <div className="flex flex-wrap items-center gap-2"><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setQrFile(event.target.files?.[0] || null)} className="max-w-sm" /><Button type="button" variant="outline" disabled={!qrFile || uploadQr.isPending} onClick={() => uploadQr.mutate()}><Upload className="mr-2 h-4 w-4" />{uploadQr.isPending ? "Uploading…" : "Upload QR image"}</Button></div>
             <div className="flex flex-wrap items-center gap-3">
               {officialQrUrl ? <div className="flex items-center gap-3"><img src={officialQrUrl} alt="Supplied official OnSpot QR preview" className="h-24 w-24 rounded border bg-white object-contain p-1" /><p className="max-w-xs text-xs text-muted-foreground">Supplied official OnSpot QR image. It is not applied until saved with verified recipient instructions.</p></div>
                 : <p className="text-xs text-muted-foreground">{officialQrError ? `Supplied official QR preview unavailable: ${officialQrError}` : "Loading supplied official QR preview…"}</p>}
                <Button type="button" variant="outline" disabled={useOfficialQr.isPending} onClick={() => useOfficialQr.mutate()}>{useOfficialQr.isPending ? "Staging supplied QR…" : "Use supplied OnSpot QR"}</Button>
             </div>
             {qrFileId && <div className="flex flex-wrap items-center gap-3 border-t pt-3"><p className="text-xs font-medium text-emerald-800">QR staged for the next saved version; it is not active yet.</p><AuthorizedQrPreview fileId={qrFileId} name="wise-qr-staged.png" /></div>}
             {(uploadQr.isError || useOfficialQr.isError) && <p role="alert" className="text-sm text-rose-700">{errorMessage(uploadQr.error || useOfficialQr.error)}</p>}
           </div>
           <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Before saving, confirm the receiving destination and support currency independently. Saving validates the recipient, currency and instructions; staging a QR alone does not activate payment instructions.</p>
          <Button type="submit" disabled={saveConfig.isPending || !config.currency.trim() || !config.recipient.trim() || !config.instructions.trim()}>{saveConfig.isPending ? "Saving…" : "Save new instructions version"}</Button>
        </form>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileCheck2 className="h-5 w-5 text-primary" /> Receipt review queue</CardTitle><p className="text-sm text-muted-foreground">Review every incoming category using independent settlement records. Customer-provided amount and reference are evidence only.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{([
          ["category", "Category", ["", "inquiry", "hiring_invoice", "invoice", "monthly_invoice", "deposit", "replenishment"]],
          ["status", "Status", ["", "pending", "verification_pending", "rejected", "verified"]],
        ] as [keyof typeof filters, string, string[]][]).map(([key, label, values]) => <label key={key} className="space-y-1 text-xs font-semibold">{label}<select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}>{values.map((value) => <option key={value} value={value}>{value ? value.replaceAll("_", " ") : `All ${label.toLowerCase()}`}</option>)}</select></label>)}
          {(["payer", "reference", "currency"] as const).map((key) => <label key={key} className="space-y-1 text-xs font-semibold capitalize">{key}<Input value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} /></label>)}
          {(["from", "to"] as const).map((key) => <label key={key} className="space-y-1 text-xs font-semibold">Submitted {key}<Input type="date" value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} /></label>)}
        </div>
        {submissionQuery.isLoading ? <div className="h-20 animate-pulse rounded bg-muted" /> : submissions.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No receipt submissions match these filters.</div> : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/50 text-left text-xs"><tr>{["Payer", "Category / obligation", "Claimed transfer", "Submitted", ""].map((x) => <th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody>{submissions.map((item) => <tr key={item.id} className="border-t"><td className="px-3 py-3">{item.payer_name || "Client"}<p className="text-xs text-muted-foreground">{item.payer_email || "—"}</p></td><td className="px-3 py-3 capitalize">{item.category.replaceAll("_", " ")}<p className="text-xs text-muted-foreground">ID {item.obligation_id}</p></td><td className="px-3 py-3">{item.amount} {item.currency}<p className="text-xs text-muted-foreground">Reference: {item.reference}</p></td><td className="px-3 py-3">{new Date(item.created_at).toLocaleString()}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => openReview(item)}>Review receipt</Button></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
    <Card id="manual-wise-payouts"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Landmark className="h-5 w-5 text-primary" /> Talent payouts · outgoing</CardTitle><p className="text-sm text-muted-foreground">Never show collection instructions to a payee. Record an independently approved destination before uploading transfer evidence.</p></CardHeader>
      <CardContent className="space-y-3">{payoutsQuery.isLoading ? <div className="h-16 animate-pulse rounded bg-muted" /> : payouts.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No payout obligations are available.</p> : payouts.map((item) => <PayoutPanel key={item.id} item={item} onUpdated={invalidate} />)}</CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="text-lg">Request security-deposit replenishment</CardTitle><p className="text-sm text-muted-foreground">Create a pending funding request only. A held top-up or suspended-deposit cure is not settled, and adds no coverage until payment is independently verified. For a suspended cure, the server enforces the existing deposit principal amount.</p></CardHeader><CardContent className="space-y-3">
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); setTopupResult(""); topupMutation.mutate(); }}>
        <label className="space-y-1 text-sm">Deposit ID<Input required value={topup.depositId} onChange={(event) => setTopup({ ...topup, depositId: event.target.value })} /></label>
        <label className="space-y-1 text-sm">Finalized top-up amount<Input required type="number" min="0.01" step="0.01" value={topup.amount} onChange={(event) => setTopup({ ...topup, amount: event.target.value })} /></label>
        <label className="space-y-1 text-sm">Currency<Input value="USD" readOnly /></label>
        <label className="space-y-1 text-sm">Reference (optional)<Input value={topup.reference} onChange={(event) => setTopup({ ...topup, reference: event.target.value })} /></label>
        <Button disabled={topupMutation.isPending || !topup.depositId.trim() || !topup.amount}>{topupMutation.isPending ? "Creating request…" : "Create pending funding request"}</Button>
      </form>
      {topupResult && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{topupResult}</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-lg">Finalize endorsed inquiry amount</CardTitle><p className="text-sm text-muted-foreground">Set only a reviewed quote for an endorsed inquiry. Amount and currency are not inferred from client input.</p></CardHeader><CardContent>
      <form className="grid gap-3 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); quoteMutation.mutate(); }}>
        <label className="space-y-1 text-sm sm:col-span-2">Inquiry ID<Input required value={quote.inquiryId} onChange={(event) => setQuote({ ...quote, inquiryId: event.target.value })} /></label>
        <label className="space-y-1 text-sm">Final amount<Input required type="number" min="0.01" step="0.01" value={quote.amount} onChange={(event) => setQuote({ ...quote, amount: event.target.value })} /></label>
        <label className="space-y-1 text-sm">Currency<Input required maxLength={3} value={quote.currency} onChange={(event) => setQuote({ ...quote, currency: event.target.value.toUpperCase() })} /></label>
        <Button disabled={quoteMutation.isPending || !quote.inquiryId.trim() || !quote.amount}>{quoteMutation.isPending ? "Saving quote…" : "Save finalized quote"}</Button>
      </form>
    </CardContent></Card>
    {selected && <ReviewDialog item={selected} review={review} setReview={setReview} onClose={() => setSelected(null)} onSubmit={() => reviewMutation.mutate()} pending={reviewMutation.isPending} error={reviewMutation.error} />}
  </section>;
}

function AuthorizedQrPreview({ fileId, name }: { fileId: string; name: string }) {
  const [asset, setAsset] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let createdUrl = "";
    setAsset(null);
    setError("");
    fetchQrBlob(`/api/manual-wise/files/${encodeURIComponent(fileId)}`)
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob);
        if (alive) setAsset({ id: fileId, url: createdUrl });
        else URL.revokeObjectURL(createdUrl);
      })
      .catch((cause: unknown) => { if (alive) setError(errorMessage(cause)); });
    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [fileId]);
  const current = asset?.id === fileId ? asset : null;
  return <div className="mt-2 flex flex-wrap items-center gap-3">
    {current ? <img src={current.url} alt="Configured Wise QR preview" className="h-28 w-28 rounded border bg-white object-contain p-1" />
      : error ? <p role="alert" className="max-w-sm text-xs text-rose-700">Protected QR preview unavailable: {error}</p>
        : <div className="h-28 w-28 animate-pulse rounded border bg-muted" aria-label="Loading QR preview" />}
    {current && <Button type="button" variant="ghost" size="sm" onClick={() => downloadBlob(current.url, name)}><Download className="mr-2 h-4 w-4" />Download QR</Button>}
  </div>;
}

function PayoutPanel({ item, onUpdated }: { item: WiseObligation; onUpdated: () => Promise<void> }) {
  const [recipient, setRecipient] = useState(item.approvedDestination || "");
  const [reason, setReason] = useState("");
  const [approved, setApproved] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(Boolean(item.approvedDestination));
  const canRecordTransfer = item.paymentStatus === "awaiting_payment" || item.paymentStatus === "rejected";
  useEffect(() => {
    if (item.approvedDestination) {
      setRecipient(item.approvedDestination);
      setShowUpload(true);
    }
  }, [item.approvedDestination]);
  const destination = useMutation({ mutationFn: () => authAPI.post(`/api/admin/manual-wise/payouts/${item.id}/destination`, { recipient: recipient.trim(), reason: reason.trim(), independentlyApproved: approved }), onSuccess: async () => { setError("Destination approval recorded. Submit outgoing transfer receipt below."); setShowUpload(true); await onUpdated(); }, onError: (e: unknown) => setError(errorMessage(e)) });
  const submitProof = useMutation({ mutationFn: async () => {
    if (!file || !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      throw new Error("Choose a PNG, JPEG, WebP or PDF receipt up to 8 MiB.");
    }
    const form = new FormData(); form.append("reference", reference.trim()); form.append("recipient", recipient.trim()); if (file) form.append("receipt", file);
    const token = localStorage.getItem("onspot_jwt_token");
    const res = await fetch(`/api/manual-wise/obligations/payout/${encodeURIComponent(item.id)}/proofs`, { method: "POST", body: form, credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(res.status === 403 ? "Access denied (403). Admin authorization required." : body.error || `Transfer evidence upload failed (${res.status}).`); }
    return res.json();
  }, onSuccess: async () => { setError("Outgoing transfer evidence submitted. Payout remains pending independent verification."); await onUpdated(); }, onError: (e: unknown) => setError(errorMessage(e)) });
  return <div className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.reference} · {item.amount} {item.currency}</p><p className="text-xs text-muted-foreground">Payout ID {item.id} · outgoing transfer</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{item.paymentStatus.replaceAll("_", " ")}</span></div>
    {canRecordTransfer && !showUpload && <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); destination.mutate(); }}>
      <label className="space-y-1 text-sm">Approved payout recipient<Input required value={recipient} onChange={(event) => setRecipient(event.target.value)} /></label>
      <label className="space-y-1 text-sm">Approval reason<Input required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />I independently approved this immutable payout destination outside this workflow.</label>
      <Button disabled={destination.isPending || !recipient.trim() || !reason.trim() || !approved}>{destination.isPending ? "Recording…" : "Record approved destination"}</Button>
    </form>}
    {canRecordTransfer && !showUpload && <Button type="button" variant="ghost" size="sm" onClick={() => setShowUpload(true)}>Continue with a previously recorded approved destination</Button>}
    {canRecordTransfer && showUpload && <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submitProof.mutate(); }}>
      <label className="space-y-1 text-sm">Previously approved recipient<Input required value={recipient} readOnly={Boolean(item.approvedDestination) || destination.isSuccess} onChange={(event) => setRecipient(event.target.value)} /></label>
      <label className="space-y-1 text-sm">Transfer reference<Input required value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <label className="space-y-1 text-sm">Transfer receipt<Input required type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <Button disabled={submitProof.isPending || !file || !reference.trim()}>{submitProof.isPending ? "Submitting…" : "Submit outgoing transfer evidence"}</Button>
    </form>}
    {error && <p role="status" className="text-sm text-amber-900">{error}</p>}
    {Boolean(destination.error || submitProof.error) && <p role="alert" className="text-sm text-rose-700">{errorMessage(destination.error || submitProof.error)}</p>}
    {item.paymentStatus === "verification_pending" && <div className="rounded bg-amber-50 p-3 text-sm text-amber-950"><CheckCircle2 className="mr-2 inline h-4 w-4" />Evidence exists; an administrator must independently confirm settlement before this payout is disbursed.</div>}
    {item.history?.length > 0 && <div className="border-t pt-3"><p className="mb-2 text-sm font-semibold">Outgoing transfer evidence</p>{item.history.map((entry) => <div key={entry.id} className="mb-2 rounded border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium capitalize">{entry.status.replaceAll("_", " ")}</span><span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span></div><p className="mt-1 text-muted-foreground">Transfer reference: {entry.reference} · {entry.amount} {entry.currency}</p>{entry.receipt_id && <ReviewReceipt fileId={entry.receipt_id} name={entry.receipt_name || "Open transfer receipt"} />}{entry.rejection_reason && <p className="mt-1 text-rose-800">Reason: {entry.rejection_reason}</p>}</div>)}</div>}
  </div>;
}

function ReviewDialog({ item, review, setReview, onClose, onSubmit, pending, error }: { item: AdminSubmission; review: typeof initialReview; setReview: (value: typeof initialReview) => void; onClose: () => void; onSubmit: () => void; pending: boolean; error: unknown }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true" aria-label="Review Wise payment">
    <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-semibold">Review transfer evidence</h3><p className="text-sm text-muted-foreground">{item.payer_name} · {item.category.replaceAll("_", " ")} · obligation {item.obligation_id}</p></div><Button variant="ghost" onClick={onClose}>Close</Button></div>
      <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm"><p>Client claim: {item.amount} {item.currency} · reference {item.reference}</p><p>Expected recipient: {item.expected_recipient || "Not set"}</p>{item.receipt_id && <ReviewReceipt fileId={item.receipt_id} name={item.receipt_name || "Open receipt"} />}</div>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1 text-sm">Decision<select className="h-10 w-full rounded-md border bg-background px-3" value={review.action} onChange={(event) => setReview({ ...review, action: event.target.value as "verify" | "reject" })}><option value="verify">Verify settled payment</option><option value="reject">Reject receipt</option></select></label>
        <label className="block space-y-1 text-sm">Reason / review note<textarea required className="min-h-16 w-full rounded-md border bg-background px-3 py-2" value={review.reason} onChange={(event) => setReview({ ...review, reason: event.target.value })} /></label>
        {review.action === "verify" && <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-amber-950"><AlertTriangle className="h-4 w-4" />Confirm against independent Wise settlement records</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Confirmed amount<Input required inputMode="decimal" value={review.verifiedAmount} onChange={(event) => setReview({ ...review, verifiedAmount: event.target.value })} /></label>
            <label className="space-y-1 text-sm">Confirmed currency<Input required maxLength={3} value={review.verifiedCurrency} onChange={(event) => setReview({ ...review, verifiedCurrency: event.target.value.toUpperCase() })} /></label>
            <label className="space-y-1 text-sm">Independently confirmed reference<Input required value={review.verifiedReference} onChange={(event) => setReview({ ...review, verifiedReference: event.target.value })} /></label>
            <label className="space-y-1 text-sm">Confirmed recipient<Input required value={review.verifiedRecipient} onChange={(event) => setReview({ ...review, verifiedRecipient: event.target.value })} /></label>
            <label className="space-y-1 text-sm sm:col-span-2">Settlement date and time<Input required type="datetime-local" value={review.settledAt} onChange={(event) => setReview({ ...review, settledAt: event.target.value })} /></label>
          </div>
          <label className="flex items-start gap-2 text-sm text-amber-950"><input type="checkbox" checked={review.independentlyVerified} onChange={(event) => setReview({ ...review, independentlyVerified: event.target.checked })} /><span>I independently confirmed actual settled funds, amount, currency, recipient and reference; this is not based solely on submitted proof.</span></label>
        </div>}
        {Boolean(error) && <p role="alert" className="text-sm text-rose-700">{errorMessage(error)}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !review.reason.trim() || (review.action === "verify" && (!review.independentlyVerified || !review.verifiedAmount || !review.verifiedCurrency || !review.verifiedReference || !review.verifiedRecipient || !review.settledAt))} onClick={onSubmit}>{pending ? "Recording…" : review.action === "verify" ? "Verify settled payment" : "Reject receipt"}</Button></div>
      </div>
    </div>
  </div>;
}

function ReviewReceipt({ fileId, name }: { fileId: string; name: string }) {
  const [error, setError] = useState("");
  return <div className="mt-2"><Button type="button" variant="ghost" className="h-auto p-0" onClick={async () => {
    setError("");
    try {
      const token = localStorage.getItem("onspot_jwt_token");
      const res = await fetch(`/api/manual-wise/files/${encodeURIComponent(fileId)}`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(res.status === 403 ? "Access denied (403) to protected receipt." : `Receipt download failed (${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noreferrer"; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(errorMessage(cause)); }
  }}>{name}</Button>{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}</div>;
}
