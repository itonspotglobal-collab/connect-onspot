import { ChangeEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Banknote, Check, CheckCircle2, Clock3, ExternalLink, FileText, Landmark, LockKeyhole, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export type WiseCategory = "inquiry" | "hiring_invoice" | "invoice" | "monthly_invoice" | "deposit" | "replenishment" | "payout";
export type WiseObligation = {
  category: WiseCategory;
  id: string;
  reference: string;
  amount: string;
  currency: string;
  payerId: string;
  status: string;
  paymentStatus: "awaiting_payment" | "verification_pending" | "paid" | "rejected";
  payable: boolean;
  direction: "incoming" | "outgoing";
  companyName?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  period?: string | null;
  lineItems?: Array<{ name: string; description?: string; amount: string | number }>;
  verifiedAt?: string | null;
  approvedDestination?: string | null;
  instructions: null | { id: string; recipient: string; instructions: string; referenceInstructions: string; qrFileId: string | null; currency: string };
  history: WiseSubmission[];
  blockedReason?: string;
};
export type WiseSubmission = {
  id: string;
  status: string;
  reference: string;
  amount: string;
  currency: string;
  receipt_id: string | null;
  receipt_name: string | null;
  created_at: string;
  rejection_reason: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

function token() {
  return localStorage.getItem("onspot_jwt_token");
}
function errorText(error: unknown) {
  const e = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
  if (e?.response?.status === 403 || e?.message?.includes("403")) return "Access denied (403). Your account is not authorized to access this payment record.";
  return e?.response?.data?.error || e?.message || "The request could not be completed.";
}
async function protectedFile(fileId: string) {
  const blob = await protectedFileBlob(fileId);
  return URL.createObjectURL(blob);
}
async function protectedFileBlob(fileId: string) {
  const res = await fetch(`/api/manual-wise/files/${encodeURIComponent(fileId)}`, {
    credentials: "include",
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  if (!res.ok) throw new Error(res.status === 403 ? "Access denied (403) for this protected file." : `Protected file download failed (${res.status}).`);
  return res.blob();
}
function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (!amount?.trim() || !Number.isFinite(value)) return "Amount not finalized";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${amount}`; }
}
const lifecycleLabels: Record<string, string> = {
  void: "Void",
  refunded: "Refunded",
  invalidated: "Invalidated",
  payment_failed: "Payment failed",
};
function StatusNotice({ status, lifecycleStatus = "" }: { status: WiseObligation["paymentStatus"]; lifecycleStatus?: string }) {
  const historicalPaidProof = status === "paid" && Boolean(lifecycleLabels[lifecycleStatus]);
  const map = {
    awaiting_payment: ["Payment not submitted", "bg-slate-100 text-slate-700", Landmark],
    verification_pending: ["Pending verification", "bg-amber-100 text-amber-900", Clock3],
    paid: ["Paid — independently verified", "bg-emerald-100 text-emerald-900", CheckCircle2],
    rejected: ["Proof rejected — resubmission available", "bg-rose-100 text-rose-900", AlertCircle],
  } as const;
  const [statusLabel, style, Icon] = map[status];
  const label = historicalPaidProof ? "Verified proof · historical" : statusLabel;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style}`}><Icon className="h-3.5 w-3.5" />{label}</span>;
}
function LifecycleNotice({ status }: { status: string }) {
  const label = lifecycleLabels[status];
  return label ? <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Obligation: {label}</span> : null;
}

export function ManualWisePaymentPanel({ category, id, title = "Manual Wise payment", showHeading = true, checkout = false }: { category: WiseCategory; id: string; title?: string; showHeading?: boolean; checkout?: boolean }) {
  const qc = useQueryClient();
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [qrAsset, setQrAsset] = useState<{ fileId: string; url: string } | null>(null);
  const [qrLoadError, setQrLoadError] = useState("");
  const [proofOpen, setProofOpen] = useState(false);
  const [instructionMethod, setInstructionMethod] = useState<"wise" | "bank" | null>(null);
  const queryKey = ["/api/manual-wise/obligations", category, id];
  const query = useQuery<WiseObligation>({
    queryKey,
    queryFn: () => authAPI.get(`/api/manual-wise/obligations/${category}/${encodeURIComponent(id)}`),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a receipt file before submitting.");
      const form = new FormData();
      form.append("reference", reference.trim());
      form.append("receipt", file);
      const res = await fetch(`/api/manual-wise/obligations/${category}/${encodeURIComponent(id)}/proofs`, {
        method: "POST", body: form, credentials: "include",
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(res.status === 403 ? "Access denied (403). This obligation is not available to your account." : body.error || `Receipt submission failed (${res.status}).`);
      }
      return res.json();
    },
    onSuccess: async () => {
      setReference(""); setFile(null); setFileError("");
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ["/api/manual-wise/obligations"] });
      await qc.invalidateQueries({ queryKey: ["/api/client/hiring-invoices"] });
      await qc.invalidateQueries({ queryKey: ["/api/client/invoices"] });
    },
  });
  const qrRecord = query.data;
  const qrStatusAllowed = qrRecord?.paymentStatus === "awaiting_payment" || qrRecord?.paymentStatus === "verification_pending" || qrRecord?.paymentStatus === "rejected";
  const qrLifecycleBlocked = ["paid", "void", "refunded", "invalidated", "blocked"].includes(qrRecord?.status || "");
  const qrFileId = qrRecord?.direction === "incoming"
    && (qrRecord.payable || qrRecord.paymentStatus === "verification_pending")
    && qrStatusAllowed
    && !qrLifecycleBlocked
    && !qrRecord.blockedReason
    && qrRecord.instructions?.currency === qrRecord.currency
    && Boolean(qrRecord.instructions?.recipient.trim())
    ? qrRecord.instructions.qrFileId
    : null;
  useEffect(() => {
    let alive = true;
    let created = "";
    setQrAsset(null);
    setQrLoadError("");
    if (qrFileId) protectedFileBlob(qrFileId)
      .then((blob) => {
        created = URL.createObjectURL(blob);
        if (alive) setQrAsset({ fileId: qrFileId, url: created });
        else URL.revokeObjectURL(created);
      })
      .catch((cause: unknown) => { if (alive) setQrLoadError(errorText(cause)); });
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [qrFileId]);
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    if (selected && (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(selected.type) || selected.size > 8 * 1024 * 1024)) {
      setFileError("Choose a PNG, JPEG, WebP or PDF file up to 8 MiB."); setFile(null); event.target.value = ""; return;
    }
    setFileError(""); setFile(selected);
  };

  if (query.isLoading) return <Card><CardContent className="space-y-3 p-5"><div className="h-5 w-44 animate-pulse rounded bg-muted" /><div className="h-16 animate-pulse rounded bg-muted" /></CardContent></Card>;
  if (query.isError || !query.data) return <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p role="alert" className="text-sm text-rose-700">{errorText(query.error)}</p><Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></CardContent></Card>;
  const obligation = query.data;
  const canSubmit = obligation.direction === "incoming" && obligation.payable && (obligation.paymentStatus === "awaiting_payment" || obligation.paymentStatus === "rejected");
  const showIncomingInstructions = obligation.direction === "incoming";
  const qrEligible = obligation.direction === "incoming"
    && (obligation.payable || obligation.paymentStatus === "verification_pending")
    && (obligation.paymentStatus === "awaiting_payment" || obligation.paymentStatus === "verification_pending" || obligation.paymentStatus === "rejected")
    && !["paid", "void", "refunded", "invalidated", "blocked"].includes(obligation.status)
    && !obligation.blockedReason
    && Boolean(obligation.instructions)
    && Boolean(obligation.instructions?.recipient.trim())
    && obligation.instructions?.currency === obligation.currency;
  const qrFileConfigured = qrEligible && Boolean(obligation.instructions?.qrFileId);
  const visibleQr = qrFileConfigured && qrAsset?.fileId === obligation.instructions?.qrFileId ? qrAsset : null;
  if (checkout) {
    const lastVerifiedAt = obligation.verifiedAt
      || [...(obligation.history || [])].reverse().find((item) => item.status === "paid" || item.verified_at)?.verified_at
      || null;
    const statusHistory = obligation.history || [];
    const latestRejection = [...statusHistory].reverse().find((item) => item.rejection_reason)?.rejection_reason;
    const instructionsVisible = instructionMethod !== null || !qrFileConfigured;
    return <Card className="min-w-0 overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-[#20245f] via-[#25296d] to-[#171a4d] text-white shadow-[0_22px_60px_rgba(28,32,89,0.24)]">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100/75"><LockKeyhole className="h-3.5 w-3.5" /> Secure checkout</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{obligation.paymentStatus === "paid" ? "Payment confirmed" : "Scan to pay"}</h2>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-indigo-100/80">Open your banking or payment app and scan the code.</p>
          </div>
          <StatusNotice status={obligation.paymentStatus} lifecycleStatus={obligation.status} />
        </div>

        <div className="mx-auto flex min-h-[250px] w-full max-w-[350px] flex-col items-center justify-center rounded-2xl bg-white p-4 text-center text-slate-900 shadow-[0_8px_28px_rgba(5,9,43,0.18)] sm:min-h-[300px]">
          {visibleQr ? <>
            <img src={visibleQr.url} alt="Authorized incoming Wise payment QR code" className="aspect-square h-auto w-full max-w-[260px] object-contain" />
            <p className="mt-3 text-sm font-semibold">{formatMoney(obligation.amount, obligation.currency)} to OnSpot Global</p>
          </> : !qrEligible ? <>
            <Landmark className="h-8 w-8 text-slate-400" />
            <p className="mt-3 max-w-64 text-sm font-semibold text-slate-800">QR payment is unavailable for this obligation.</p>
            <p className="mt-1 max-w-64 text-xs leading-relaxed text-slate-600">Use only the approved written instructions below, or contact OnSpot billing support.</p>
          </> : qrLoadError ? <>
            <AlertCircle className="h-8 w-8 text-rose-600" />
            <p role="alert" className="mt-3 max-w-64 text-sm font-semibold text-rose-800">The configured QR could not be loaded.</p>
            <p className="mt-1 max-w-64 break-words text-xs text-slate-600">{qrLoadError}</p>
          </> : qrFileConfigured ? <>
            <div className="h-8 w-8 animate-pulse rounded bg-slate-200" />
            <p className="mt-3 text-sm text-slate-600">Loading authorized QR…</p>
          </> : <>
            <Landmark className="h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">QR code not configured</p>
            <p className="mt-1 max-w-64 text-xs leading-relaxed text-slate-600">Use the approved written transfer instructions below.</p>
          </>}
        </div>

        {obligation.paymentStatus === "verification_pending" || upload.isSuccess ? (
          <div role="status" className="rounded-xl border border-amber-200/30 bg-amber-100/10 p-4 text-sm text-white">
            <p className="flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4 text-amber-200" />Payment received — verifying (up to 24 hours)</p>
            <p className="mt-1 text-xs leading-relaxed text-indigo-100/80">Your receipt is evidence for review only. An authorized administrator must independently confirm settlement.</p>
          </div>
        ) : obligation.paymentStatus === "paid" ? (
          <div role="status" className="rounded-xl border border-emerald-200/30 bg-emerald-100/10 p-4 text-sm text-white">
            <p className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4 text-emerald-200" />Paid ✓</p>
            <p className="mt-1 text-xs text-indigo-100/80">Independently verified{lastVerifiedAt ? ` on ${new Date(lastVerifiedAt).toLocaleDateString()}` : " · verification date not available"}.</p>
          </div>
        ) : null}

        {showIncomingInstructions && <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/20" />
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100/65">Or pay another way</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => setInstructionMethod(instructionMethod === "wise" ? null : "wise")} className="min-h-11 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Landmark className="mr-2 h-4 w-4" />Wise
            </Button>
            <Button type="button" variant="outline" onClick={() => setInstructionMethod(instructionMethod === "bank" ? null : "bank")} className="min-h-11 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Banknote className="mr-2 h-4 w-4" />Bank
            </Button>
          </div>
          {instructionsVisible && obligation.instructions ? <div className="rounded-xl border border-white/15 bg-white/[0.07] p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-100/70">{instructionMethod === "bank" ? "Approved bank transfer instructions" : "Approved Wise transfer instructions"}</p>
            <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-white/95">{obligation.instructions.instructions}</p>
            {obligation.instructions.referenceInstructions && <p className="mt-3 border-t border-white/15 pt-3 text-sm leading-relaxed text-indigo-50"><span className="font-semibold">Payment reference:</span> {obligation.instructions.referenceInstructions}</p>}
            <p className="mt-3 text-[11px] leading-relaxed text-indigo-100/65">Instructions are the approved details bound to this payment record. Do not transfer if the recipient or currency does not match.</p>
          </div> : !obligation.instructions ? <div className="rounded-xl border border-amber-100/30 bg-amber-100/10 p-3 text-xs leading-relaxed text-amber-50">{obligation.blockedReason || "Approved payment instructions are not available yet. Do not send funds to an unconfirmed account."}</div> : null}
        </section>}

        {showIncomingInstructions && canSubmit && <>
          <p className="rounded-lg border border-white/15 bg-white/[0.06] p-3 text-xs leading-relaxed text-indigo-100/80">After sending payment externally, submit your transfer reference and receipt. Uploading proof does not mark this invoice paid.</p>
          <div className="space-y-3">
            <Button type="button" variant="outline" onClick={() => setProofOpen(true)} className="min-h-12 w-full border-white/65 bg-white text-[#20245f] hover:bg-indigo-50 hover:text-[#20245f]">
              <ShieldCheck className="mr-2 h-4 w-4" />I&apos;ve sent the payment
            </Button>
            <button type="button" onClick={() => setProofOpen(true)} className="mx-auto flex min-h-11 items-center justify-center text-sm font-medium text-indigo-100 underline decoration-white/40 underline-offset-4 hover:text-white">
              Upload proof of payment
            </button>
          </div>
        </>}

        {proofOpen && canSubmit && obligation.instructions && <form className="space-y-3 rounded-xl border border-white/20 bg-white/[0.06] p-4" onSubmit={(event) => { event.preventDefault(); upload.mutate(); }}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Submit proof of payment</h3>
            <button type="button" onClick={() => setProofOpen(false)} className="min-h-11 px-2 text-xs text-indigo-100 underline underline-offset-2">Cancel</button>
          </div>
          <p className="text-xs leading-relaxed text-indigo-100/75">A submitted receipt is a claim for review, not a payment confirmation.</p>
          <label className="block space-y-1.5 text-sm"><span className="font-medium">Transfer reference</span><Input value={reference} onChange={(event) => setReference(event.target.value)} required maxLength={300} placeholder="Reference shown in your transfer" className="min-h-11 text-base text-slate-900" /></label>
          <label className="block space-y-1.5 text-sm"><span className="font-medium">Receipt file</span><Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={onFile} required className="min-h-11 bg-white text-base text-slate-900 file:mr-3 file:rounded file:border-0 file:bg-[#20245f] file:px-3 file:py-1 file:text-white" /><span className="text-xs text-indigo-100/70">PNG, JPEG, WebP or PDF · maximum 8 MiB</span></label>
          {file && <p className="flex items-center gap-2 break-words text-xs text-indigo-100"><FileText className="h-4 w-4 shrink-0" />{file.name}</p>}
          {fileError && <p role="alert" className="text-sm text-rose-200">{fileError}</p>}
          {upload.isError && <p role="alert" className="text-sm text-rose-200">{errorText(upload.error)}</p>}
          <Button type="submit" disabled={!reference.trim() || !file || upload.isPending} className="min-h-11 w-full bg-white text-[#20245f] hover:bg-indigo-50">
            {upload.isPending ? "Submitting proof…" : "Submit payment proof"}<Upload className="ml-2 h-4 w-4" />
          </Button>
        </form>}

        {latestRejection && <p role="alert" className="rounded-lg border border-rose-100/30 bg-rose-100/10 p-3 text-sm text-rose-50"><span className="font-semibold">Previous proof needs correction:</span> {latestRejection}</p>}
        {obligation.history?.length > 0 && <section className="space-y-2 border-t border-white/15 pt-4">
          <h3 className="text-sm font-semibold">Receipt history</h3>
          {obligation.history.map((item) => <div key={item.id} className="rounded-lg border border-white/15 bg-white/[0.05] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold capitalize">{item.status.replaceAll("_", " ")}</span><span className="text-indigo-100/65">{new Date(item.created_at).toLocaleString()}</span></div>
            <p className="mt-1 break-words text-indigo-100/80">Reference: {item.reference || "—"} · {formatMoney(item.amount, item.currency)}</p>
            {item.rejection_reason && <p className="mt-2 break-words rounded bg-rose-100/10 p-2 text-rose-100">Reason: {item.rejection_reason}</p>}
            {item.receipt_id && <ReceiptDownload fileId={item.receipt_id} name={item.receipt_name || "View submitted receipt"} />}
          </div>)}
        </section>}

        <p className="border-t border-white/15 pt-3 text-[11px] leading-relaxed text-indigo-100/65">
          OnSpot updates payment status only after an authorized administrator independently confirms the transfer. A submitted receipt is not proof that funds settled.
        </p>
      </CardContent>
    </Card>;
  }
  return <Card className="overflow-hidden">
    <CardContent className="space-y-5 p-5 sm:p-6">
      {showHeading && <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><Landmark className="h-4 w-4" /> Wise transfer</p><h2 className="mt-1 text-lg font-semibold">{title}</h2></div><div className="flex flex-wrap gap-2"><StatusNotice status={obligation.paymentStatus} lifecycleStatus={obligation.status} /><LifecycleNotice status={obligation.status} /></div></div>}
      <div className="grid gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Payable amount</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(obligation.amount, obligation.currency)}</p><p className="mt-1 font-mono text-sm text-muted-foreground">Reference: {obligation.reference}</p></div>
        {!showHeading && <div className="flex flex-wrap gap-2"><StatusNotice status={obligation.paymentStatus} lifecycleStatus={obligation.status} /><LifecycleNotice status={obligation.status} /></div>}
      </div>
      {showIncomingInstructions && obligation.instructions ? <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="rounded-lg border p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipient</p><p className="mt-1 font-semibold">{obligation.instructions.recipient}</p><p className="mt-1 text-sm text-muted-foreground">Currency: {obligation.instructions.currency}</p></div>
          <div className="rounded-lg border p-4"><p className="whitespace-pre-wrap text-sm leading-relaxed">{obligation.instructions.instructions}</p>{obligation.instructions.referenceInstructions && <p className="mt-3 border-t pt-3 text-sm font-medium">Transfer reference instructions: {obligation.instructions.referenceInstructions}</p>}</div>
        </div>
         <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-3 sm:w-[280px]">
           {visibleQr ? <><img src={visibleQr.url} alt="Authorized incoming Wise payment QR code" className="aspect-square h-auto w-full max-w-[260px] object-contain" /><p className="mt-2 text-center text-xs font-medium">Scan using Wise or a compatible app</p><Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => downloadQr(visibleQr.url, obligation.currency)}>Download QR Code</Button></>
             : !qrEligible ? <div className="max-w-56 py-4 text-center"><Landmark className="mx-auto h-7 w-7 text-muted-foreground/50" /><p className="mt-2 text-xs text-muted-foreground">QR payment is unavailable for this obligation or currency. Contact OnSpot billing support before sending funds.</p></div>
               : qrLoadError ? <div role="alert" className="max-w-56 py-4 text-center"><p className="text-sm font-medium text-rose-700">The configured QR could not be loaded.</p><p className="mt-1 text-xs text-muted-foreground">{qrLoadError}</p></div>
                 : qrFileConfigured ? <div className="max-w-56 py-4 text-center"><div className="mx-auto h-7 w-7 animate-pulse rounded bg-muted" /><p className="mt-2 text-xs text-muted-foreground">Loading authorized QR…</p></div>
                   : <div className="max-w-56 py-4 text-center"><Landmark className="mx-auto h-7 w-7 text-muted-foreground/50" /><p className="mt-2 text-xs text-muted-foreground">QR code not configured. Use the written recipient instructions.</p></div>}
        </div>
      </div> : showIncomingInstructions ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Payment instructions are not available yet.</p><p className="mt-1">{obligation.blockedReason || "OnSpot has not configured an active Wise recipient for this currency. Do not send funds to an unconfirmed account."}</p></div> : <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Outgoing settlement details are restricted to the payout administration workflow. No collection QR or incoming payment instructions are shown.</div>}
      {obligation.paymentStatus === "verification_pending" && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><ShieldCheck className="mr-2 inline h-4 w-4" />Your receipt is evidence for review only. Uploading it does not mark this obligation paid; an administrator must independently verify settlement.</p>}
      {showIncomingInstructions && canSubmit && <p className="rounded-lg border border-slate-200 bg-muted/30 p-3 text-sm text-muted-foreground">Upload your transfer receipt separately for review. A QR scan or receipt upload does not verify settlement.</p>}
      {canSubmit && obligation.instructions && <form className="space-y-3 border-t pt-4" onSubmit={(event) => { event.preventDefault(); upload.mutate(); }}>
        <p className="font-semibold">Submit transfer receipt</p>
        <p className="text-sm text-muted-foreground">After sending payment externally, enter your Wise transfer reference and attach its receipt.</p>
        <label className="block space-y-1 text-sm"><span className="font-medium">Transfer reference</span><Input value={reference} onChange={(event) => setReference(event.target.value)} required maxLength={300} placeholder="Reference shown in your Wise transfer" /></label>
        <label className="block space-y-1 text-sm"><span className="font-medium">Receipt file</span><Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={onFile} required className="file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground" /><span className="text-xs text-muted-foreground">PNG, JPEG, WebP or PDF · maximum 8 MiB</span></label>
        {file && <p className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-4 w-4" />{file.name}</p>}
        {fileError && <p role="alert" className="text-sm text-rose-700">{fileError}</p>}
        {upload.isError && <p role="alert" className="text-sm text-rose-700">{errorText(upload.error)}</p>}
        {upload.isSuccess && <p role="status" className="text-sm font-medium text-emerald-800">Receipt received and pending independent verification.</p>}
        <Button type="submit" disabled={!reference.trim() || !file || upload.isPending}>{upload.isPending ? "Submitting receipt…" : "Submit Payment Proof"}<Upload className="ml-2 h-4 w-4" /></Button>
      </form>}
      {showIncomingInstructions && obligation.blockedReason && obligation.instructions && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{obligation.blockedReason}</p>}
      {obligation.history?.length > 0 && <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Receipt history</h3>{obligation.history.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium capitalize">{item.status.replaceAll("_", " ")}</span><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span></div>
        <p className="mt-1 text-muted-foreground">Reference: {item.reference || "—"} · {formatMoney(item.amount, item.currency)}</p>
        {item.rejection_reason && <p className="mt-2 rounded bg-rose-50 p-2 text-rose-800">Reason: {item.rejection_reason}</p>}
        {item.receipt_id && <ReceiptDownload fileId={item.receipt_id} name={item.receipt_name || "View submitted receipt"} />}
      </div>)}</div>}
      <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">A submitted receipt is not proof that funds have settled. OnSpot updates payment status only after an authorized administrator independently confirms the transfer.</p>
    </CardContent>
  </Card>;
}

function downloadQr(url: string, currency: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = `wise-payment-qr-${currency.toLowerCase()}.png`;
  link.rel = "noreferrer";
  link.click();
}

function ReceiptDownload({ fileId, name }: { fileId: string; name: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="mt-2"><Button type="button" variant="ghost" className="h-auto p-0 text-primary" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try { const url = await protectedFile(fileId); const link = document.createElement("a"); link.href = url; link.download = name; link.target = "_blank"; link.rel = "noreferrer"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }}>{busy ? "Opening…" : name}<ExternalLink className="ml-1 h-3 w-3" /></Button>{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}</div>;
}

export function ClientWiseObligations() {
  const query = useQuery<{ items: WiseObligation[] }>({
    queryKey: ["/api/manual-wise/obligations"],
    queryFn: () => authAPI.get("/api/manual-wise/obligations"),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const incomingItems = (query.data?.items || []).filter((item) => item.direction === "incoming" && item.category !== "payout");
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Manual settlement</p><h2 className="mt-1 text-xl font-semibold">Payment obligations</h2><p className="text-sm text-muted-foreground">Monthly invoices, deposits and replenishments are shown when they are assigned to your account.</p></div><Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    {query.isLoading ? <div className="space-y-2"><div className="h-20 animate-pulse rounded-lg bg-muted" /><div className="h-20 animate-pulse rounded-lg bg-muted" /></div>
      : query.isError ? <div role="alert" className="rounded-lg border border-rose-200 p-4 text-sm text-rose-800">{errorText(query.error)} <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button></div>
       : incomingItems.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><Landmark className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-2 font-medium">No payment obligations</p><p className="mt-1 text-sm text-muted-foreground">When an invoice or deposit is due, its verified payment instructions will appear here.</p></div>
         : <div className="grid gap-3">{incomingItems.map((item) => <Link key={`${item.category}-${item.id}`} href={`/client/payments/${encodeURIComponent(item.category)}/${encodeURIComponent(item.id)}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="min-w-0"><p className="break-words font-semibold capitalize">{item.category.replaceAll("_", " ")} · {item.reference}</p><p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.amount, item.currency)}</p></div><div className="flex flex-wrap gap-2"><StatusNotice status={item.paymentStatus} lifecycleStatus={item.status} /><LifecycleNotice status={item.status} /></div>
           </Link>)}</div>}
  </section>;
}
