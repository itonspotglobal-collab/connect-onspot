import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, FileUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { depositToolError, useSuperAdminTools } from "./useSuperAdminTools";

type BillingData = {
  canManage: boolean;
  deposit: {
    id: string;
    amount: string | number;
    currency: string;
    status: string;
    invoiceUrl: string | null;
    payment_source?: string | null;
    waiver_reason?: string | null;
    receiptUrl?: string | null;
  };
  waiver: null | { waiver_type: string; deposit_due_at: string | null; arrangement_note: string | null };
};
type MsaItem = { id: string; version: string; active: boolean };
const reasonHint = "Reason must be between 10 and 2,000 characters.";

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

export function DepositBillingCard({ submissionId }: { submissionId: string }) {
  const isSuperAdmin = useSuperAdminTools();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"record_payment" | "defer" | "waive" | "resend_invoice" | "msa" | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState<"bank_transfer" | "check" | "cash" | "other">("bank_transfer");
  const [verified, setVerified] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [arrangementNote, setArrangementNote] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [message, setMessage] = useState("");

  const access = useQuery<{ canManage: boolean }>({
    queryKey: ["/api/admin/onboarding-prerequisites"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/onboarding-prerequisites")).json(),
    retry: false,
    enabled: isSuperAdmin,
  });
  const billing = useQuery<BillingData>({
    queryKey: ["/api/admin/deposit-billing", submissionId],
    queryFn: async () => (await apiRequest("GET", `/api/admin/deposit-billing/${encodeURIComponent(submissionId)}`)).json(),
    retry: false,
    enabled: isSuperAdmin && access.data?.canManage === true,
  });
  const documents = useQuery<{ items: MsaItem[] }>({
    queryKey: ["/api/admin/msa-documents"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/msa-documents")).json(),
    enabled: isSuperAdmin && mode === "msa",
    retry: false,
  });
  const activeMsa = documents.data?.items?.find((item) => item.active);

  const action = useMutation({
    mutationFn: async () => {
      if (!mode || mode === "msa") throw new Error("Choose an action.");
      const path = `/api/admin/deposit-billing/${encodeURIComponent(submissionId)}/${mode}`;
      if (mode === "record_payment") {
        const form = new FormData();
        form.set("amount", amount);
        form.set("currency", currency);
        form.set("receivedAt", receivedAt);
        form.set("reference", reference);
        form.set("method", method);
        form.set("reason", reason.trim());
        form.set("independentlyVerified", String(verified));
        if (receipt) form.set("receipt", receipt);
        return (await apiRequest("POST", path, form)).json();
      }
      if (mode === "defer") return (await apiRequest("POST", path, { reason: reason.trim(), dueDate })).json();
      if (mode === "waive") return (await apiRequest("POST", path, { reason: reason.trim(), arrangementNote })).json();
      return (await apiRequest("POST", path, { reason: reason.trim(), requestId: crypto.randomUUID() })).json();
    },
    onSuccess: async () => {
      setMessage("Deposit record updated.");
      setMode(null);
      setReason("");
      setReceipt(null);
      await qc.invalidateQueries({ queryKey: ["/api/admin/deposit-billing", submissionId] });
      await qc.invalidateQueries({ queryKey: ["/api/admin/contractor-onboarding"] });
    },
  });
  const msaUpload = useMutation({
    mutationFn: async (form: FormData) => {
      return (await apiRequest("POST", `/api/admin/msa-offline/${encodeURIComponent(submissionId)}`, form)).json();
    },
    onSuccess: async () => {
      setMessage("Signed MSA uploaded.");
      setMode(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["/api/admin/contractor-onboarding"] });
    },
  });
  const current = billing.data;
  const deposit = current?.deposit;

  if (!isSuperAdmin) return null;
  if (access.isError) return <p role="alert" className="text-sm text-red-700">{depositToolError(access.error, "Deposit billing access could not be checked.")}</p>;
  if (access.isPending) return <section className="animate-pulse rounded-xl border border-[#dce5df] bg-white p-4" aria-label="Checking billing access"><div className="h-4 w-40 rounded bg-slate-200" /><div className="mt-3 h-10 rounded bg-slate-100" /></section>;
  if (access.isError || !access.data?.canManage) return null;
  if (billing.isPending) return <section className="animate-pulse rounded-xl border border-[#dce5df] bg-white p-4" aria-label="Loading deposit billing"><div className="h-4 w-40 rounded bg-slate-200" /><div className="mt-3 h-10 rounded bg-slate-100" /></section>;
  if (billing.isError && (billing.error as { status?: number }).status === 403) return <p role="alert" className="text-sm text-red-700">{depositToolError(billing.error, billing.error.message)}</p>;
  if (billing.isError) return <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="mr-2 inline h-4 w-4" />Deposit billing details are unavailable. <button className="underline" onClick={() => billing.refetch()}>Retry</button></section>;
  if (!current?.canManage || !deposit) return null;

  const validReason = reason.trim().length >= 10 && reason.trim().length <= 2000;
  const validAmount = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && Number(amount) > 0;
  const validCurrency = /^[A-Z]{3}$/.test(currency.trim());
  const fileOkay = !receipt || (receipt.size <= 10 * 1024 * 1024 && (/^image\//.test(receipt.type) || receipt.type === "application/pdf"));
  const closeForm = () => { setMode(null); action.reset(); msaUpload.reset(); };
  const dateInput = (label: string, value: string, setter: (value: string) => void) => <label className="block text-xs font-medium text-slate-700">{label}<input type="date" value={value} onChange={(event) => setter(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>;

  return <section className="rounded-xl border border-[#dce5df] bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#557064]">Payment verification</p><h3 className="mt-1 font-semibold text-[#20352a]">Deposit billing</h3></div>
      <span className="rounded-full border border-[#dce5df] bg-[#f4f8f4] px-2.5 py-1 text-xs font-semibold text-[#405f4d]">{current.waiver?.waiver_type === "defer" ? "Deferred" : current.waiver?.waiver_type === "waive" ? "Waived" : deposit.status}</span>
    </div>
    <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
      <p><span className="text-slate-500">Deposit</span> · {deposit.currency} {deposit.amount}</p>
      <p><span className="text-slate-500">Source</span> · {deposit.payment_source || "Not recorded"}</p>
      {current.waiver?.deposit_due_at && <p><span className="text-slate-500">Deferred due</span> · {dateLabel(current.waiver.deposit_due_at)}</p>}
      {current.waiver?.arrangement_note && <p><span className="text-slate-500">Arrangement</span> · {current.waiver.arrangement_note}</p>}
      {deposit.waiver_reason && <p className="sm:col-span-2"><span className="text-slate-500">Recorded reason</span> · {deposit.waiver_reason}</p>}
    </div>
    {deposit.invoiceUrl && <a className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#405f4d] underline" href={deposit.invoiceUrl} target="_blank" rel="noreferrer">Open deposit invoice <ExternalLink className="h-3.5 w-3.5" /></a>}
    {deposit.receiptUrl&&<button type="button" className="ml-4 mt-3 inline-flex items-center gap-1 text-sm underline" onClick={async()=>{
      try{const response=await apiRequest("GET",deposit.receiptUrl!);const url=URL.createObjectURL(await response.blob());
        const a=document.createElement("a");a.href=url;a.download="payment-receipt";a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(e){setMessage(e instanceof Error?e.message:"Could not load the private receipt.");}
    }}>Download private payment receipt <ExternalLink className="h-3.5 w-3.5" /></button>}
    {current.waiver?.waiver_type === "defer" ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">This deposit is deferred. No payment is marked paid by the arrangement.</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setMode("record_payment")}><ShieldCheck className="mr-1.5 h-4 w-4" />A · Record payment</Button>
      <Button size="sm" variant="outline" onClick={() => setMode("defer")}>B · Defer</Button>
      <Button size="sm" variant="outline" onClick={() => setMode("waive")}>C · Waive</Button>
      <Button size="sm" variant="outline" onClick={() => setMode("resend_invoice")}><RefreshCw className="mr-1.5 h-4 w-4" />Resend invoice</Button>
      <Button size="sm" variant="outline" onClick={() => setMode("msa")}><FileUp className="mr-1.5 h-4 w-4" />Upload signed MSA</Button>
    </div>
    {message && <p role="status" className="mt-3 text-sm text-emerald-800"><CheckCircle2 className="mr-1 inline h-4 w-4" />{message}</p>}
    {mode && <div className="mt-4 rounded-lg border border-[#dce5df] bg-[#f8faf8] p-4">
      <div className="flex items-start justify-between gap-2"><h4 className="font-semibold text-slate-800">{mode === "record_payment" ? "Record received payment" : mode === "defer" ? "Defer deposit" : mode === "waive" ? "Waive deposit" : mode === "resend_invoice" ? "Resend invoice" : "Upload signed MSA"}</h4><button className="text-xs text-slate-500 underline" onClick={closeForm}>Cancel</button></div>
      {mode === "msa" ? documents.isPending ? <p className="mt-3 text-sm text-slate-600">Checking active MSA versions…</p> : documents.isError ? <p role="alert" className="mt-3 text-sm text-red-800">The canonical MSA list could not be loaded. <button className="underline" onClick={() => documents.refetch()}>Retry</button></p> : !activeMsa ? <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">No active canonical MSA is available.</p><p className="mt-1">Upload and activate the canonical MSA first. This form will not create a version or simulate a signature.</p></div> : <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); form.set("reason", reason.trim()); form.set("documentId", activeMsa.id); form.set("signerName", signerName); form.set("signerEmail", signerEmail); form.set("signedAt", signedAt); msaUpload.mutate(form); }} className="mt-3 space-y-3">
        <p className="rounded-md bg-white p-2 text-xs text-slate-600">Canonical document: {activeMsa.version} · {activeMsa.id}</p>
        <input type="hidden" name="documentId" value={activeMsa.id} />
        <label className="block text-xs font-medium">Signed PDF<input name="signedPDF" type="file" required accept="application/pdf" className="mt-1 block w-full text-sm" /></label>
        <label className="block text-xs font-medium">Signer name<input value={signerName} onChange={(event) => setSignerName(event.target.value)} required className="mt-1 block w-full rounded-md border px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">Signer email<input type="email" value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} required className="mt-1 block w-full rounded-md border px-3 py-2 text-sm" /></label>
        {dateInput("Signed date", signedAt, setSignedAt)}
        <label className="block text-xs font-medium">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required className="mt-1 block min-h-20 w-full rounded-md border px-3 py-2 text-sm" /></label>
        {msaUpload.isError && <p role="alert" className="text-sm text-red-700">{depositToolError(msaUpload.error, (msaUpload.error as Error).message)}</p>}
        <Button size="sm" type="submit" disabled={!activeMsa || !validReason || !signedAt || msaUpload.isPending}>{msaUpload.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload signed MSA</Button>
      </form> : <div className="mt-3 space-y-3">
        {mode === "record_payment" && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium">Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium">Currency<input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} className="mt-1 block w-full rounded-md border px-3 py-2 text-sm" /></label>
            {dateInput("Received date", receivedAt, setReceivedAt)}
            <label className="block text-xs font-medium">Payment method<select value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm"><option value="bank_transfer">Bank transfer</option><option value="check">Check</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
          </div>
          <label className="block text-xs font-medium">Reference<input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-medium">Receipt (optional; image or PDF, up to 10 MB)<input type="file" accept="image/*,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" /></label>
          {!fileOkay && <p role="alert" className="text-xs text-red-700">Choose an image or PDF no larger than 10 MB.</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="mt-1" /><span>I independently verified this payment against the received funds.</span></label>
        </>}
        {mode === "defer" && dateInput("New due date", dueDate, setDueDate)}
        {mode === "waive" && <label className="block text-xs font-medium">Arrangement note<textarea value={arrangementNote} onChange={(event) => setArrangementNote(event.target.value)} maxLength={2000} className="mt-1 block min-h-16 w-full rounded-md border px-3 py-2 text-sm" /></label>}
        <label className="block text-xs font-medium">Reason <span className="font-normal text-slate-500">({reason.trim().length}/2000; minimum 10)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} className="mt-1 block min-h-20 w-full rounded-md border px-3 py-2 text-sm" /></label>
        {action.isError && <p role="alert" className="text-sm text-red-700">{depositToolError(action.error, (action.error as Error).message)}</p>}
        <Button size="sm" disabled={!validReason || action.isPending || (mode === "record_payment" && (!validAmount || !validCurrency || !receivedAt || !reference.trim() || !verified || !fileOkay)) || (mode === "defer" && !dueDate)} onClick={() => action.mutate()}>{action.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === "record_payment" ? "Confirm verified payment" : mode === "defer" ? "Confirm deferral" : mode === "waive" ? "Confirm waiver" : "Resend invoice"}</Button>
        {mode === "record_payment" && <p className="text-xs text-slate-500">{reasonHint}</p>}
      </div>}
    </div>}
  </section>;
}
