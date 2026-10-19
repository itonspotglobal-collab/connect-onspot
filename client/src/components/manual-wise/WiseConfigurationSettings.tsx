import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, History, ImagePlus, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type WiseConfiguration = {
  id: string;
  currency: string;
  supported_currencies: string[];
  recipient: string;
  instructions: string;
  reference_instructions: string;
  qr_file_id: string | null;
  active: boolean;
  config_status: "draft" | "active" | "inactive" | "reviewed";
  created_by?: string | null;
  created_at?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
  activated_by?: string | null;
  activated_at?: string | null;
  previous_version_id?: string | null;
  source_config_id?: string | null;
  change_reason?: string | null;
  deactivation_reason?: string | null;
  deactivated_by?: string | null;
  deactivated_at?: string | null;
  revoked_at?: string | null;
};

type DraftForm = {
  currency: string;
  supportedCurrenciesText: string;
  recipient: string;
  instructions: string;
  referenceInstructions: string;
  depositFundingConfirmed: boolean;
};

const emptyForm: DraftForm = {
  currency: "",
  supportedCurrenciesText: "",
  recipient: "",
  instructions: "",
  referenceInstructions: "",
  depositFundingConfirmed: false,
};
const configKey = ["/api/admin/manual-wise/config"];

function errorText(error: unknown) {
  const cause = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
  if (cause?.response?.status === 403 || cause?.message?.includes("403")) {
    return "Access denied (403). This configuration is restricted to authorized Super Admins.";
  }
  return cause?.response?.data?.error || cause?.message || "The request could not be completed.";
}

function token() {
  return localStorage.getItem("onspot_jwt_token");
}

async function officialQrBlob() {
  const response = await fetch("/api/admin/manual-wise/config/qr/official", {
    credentials: "include",
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  if (!response.ok) {
    throw new Error(response.status === 403
      ? "Access denied (403). The supplied QR source is restricted to authorized Super Admins."
      : `Supplied QR preview request failed (${response.status}).`);
  }
  return response.blob();
}

async function protectedQrBlob(fileId: string) {
  const response = await fetch(`/api/manual-wise/files/${encodeURIComponent(fileId)}`, {
    credentials: "include",
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  if (!response.ok) {
    throw new Error(response.status === 403
      ? "Access denied (403). This protected QR is available to authorized Super Admins only."
      : `QR image request failed (${response.status}).`);
  }
  return response.blob();
}

function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(config: WiseConfiguration) {
  return config.active || config.config_status === "active" ? "Active" : config.config_status;
}

function ImagePreview({ fileId, alt = "Protected Wise QR image", readinessKey = fileId, onReady }: { fileId: string; alt?: string; readinessKey?: string; onReady?: (fileId: string, readinessKey: string, ready: boolean) => void }) {
  const [asset, setAsset] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    setAsset(null);
    setError("");
    onReadyRef.current?.(fileId, readinessKey, false);
    protectedQrBlob(fileId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setAsset({ id: fileId, url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((cause: unknown) => {
        if (alive) {
          setError(errorText(cause));
          onReadyRef.current?.(fileId, readinessKey, false);
        }
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, readinessKey]);

  const current = !error && asset?.id === fileId ? asset : null;
  return <div className="flex min-h-36 w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-3 sm:w-40">
    {current
      ? <img src={current.url} alt={alt} className="h-32 w-full object-contain" onLoad={() => onReadyRef.current?.(fileId, readinessKey, true)} onError={() => { setError("The protected QR image could not be decoded."); onReadyRef.current?.(fileId, readinessKey, false); }} />
      : error
        ? <p role="alert" className="text-center text-xs text-rose-700">{error}</p>
        : <div className="h-28 w-28 animate-pulse rounded bg-muted" aria-label="Loading protected QR image" />}
  </div>;
}

function LocalQrPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <div className="flex items-center gap-3">
    <div className="flex h-32 w-32 items-center justify-center rounded-lg border bg-muted/20 p-2">
      {url && <img src={url} alt="Selected QR image preview" className="h-full w-full object-contain" />}
    </div>
    <p className="min-w-0 break-all text-xs text-muted-foreground">{file.name}<span className="block">Local preview · upload to stage for this draft</span></p>
  </div>;
}

function OfficialQrSourcePreview() {
  const [source, setSource] = useState<{ url: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    officialQrBlob()
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setSource({ url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((cause: unknown) => { if (alive) setError(errorText(cause)); });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);
  return <div className="flex flex-wrap items-center gap-3">
    {source
      ? <img src={source.url} alt="Supplied official OnSpot QR source" className="h-24 w-24 rounded border bg-background object-contain p-1" />
      : error
        ? <p role="alert" className="max-w-sm text-xs text-rose-700">Supplied official QR preview unavailable: {error}</p>
        : <div className="h-24 w-24 animate-pulse rounded border bg-muted" aria-label="Loading supplied QR preview" />}
    <p className="max-w-md text-xs text-muted-foreground">Supplied official OnSpot QR source. It is not selected until staged and is never activated by staging.</p>
  </div>;
}

function MetadataLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <p><span className="font-medium text-foreground">{label}:</span> {value}</p>;
}

export function WiseConfigurationSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrFileId, setQrFileId] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [selectedQrLoaded, setSelectedQrLoaded] = useState(false);
  const [review, setReview] = useState({ image: false, account: false, currencies: false, instructions: false, reason: "" });
  const [deactivationReasons, setDeactivationReasons] = useState<Record<string, string>>({});
  const [restoreReasons, setRestoreReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const query = useQuery<{ items: WiseConfiguration[] }>({
    queryKey: configKey,
    queryFn: () => authAPI.get("/api/admin/manual-wise/config"),
  });
  const configurations = query.data?.items || [];
  const activeConfigs = useMemo(
    () => configurations.filter((item) => item.active || item.config_status === "active"),
    [configurations],
  );
  const draftConfigs = useMemo(
    () => configurations.filter((item) => !item.active && item.config_status === "draft"),
    [configurations],
  );
  const historyConfigs = useMemo(
    () => configurations.filter((item) => !item.active && item.config_status !== "draft"),
    [configurations],
  );
  const selectedDraft = draftConfigs.find((item) => item.id === selectedDraftId);
  const selectedImageFileId = selectedDraft?.qr_file_id || "";
  const selectedReadinessKey = selectedDraftId ? `${selectedDraftId}:${selectedImageFileId}` : "";
  const selectedReviewRef = useRef({ draftId: "", fileId: "", readinessKey: "" });
  selectedReviewRef.current = { draftId: selectedDraftId, fileId: selectedImageFileId, readinessKey: selectedReadinessKey };
  const onSelectedQrReady = useCallback((fileId: string, readinessKey: string, ready: boolean) => {
    if (!selectedReviewRef.current.draftId || selectedReviewRef.current.fileId !== fileId || selectedReviewRef.current.readinessKey !== readinessKey) return;
    setSelectedQrLoaded(ready);
    if (!ready) setReview((current) => current.image ? { ...current, image: false } : current);
  }, []);
  useEffect(() => {
    setSelectedQrLoaded(false);
    setReview({ image: false, account: false, currencies: false, instructions: false, reason: "" });
  }, [selectedDraftId, selectedImageFileId]);
  const supportedCurrencies = form.supportedCurrenciesText.split(",").map((value) => value.trim().toUpperCase());
  const currencyEntries = supportedCurrencies;
  const hasBlankCurrency = currencyEntries.some((value) => value.length === 0);
  const invalidCurrencyEntries = supportedCurrencies.filter((value) => value.length > 0 && !/^[A-Z]{3}$/.test(value));
  const duplicateCurrencies = currencyEntries.filter((value, index) => currencyEntries.indexOf(value) !== index);
  const currenciesValid = currencyEntries.length >= 1 && currencyEntries.length <= 20
    && !hasBlankCurrency && invalidCurrencyEntries.length === 0 && duplicateCurrencies.length === 0
    && /^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())
    && currencyEntries.includes(form.currency.trim().toUpperCase());
  const reviewComplete = Boolean(selectedImageFileId) && selectedQrLoaded && review.image && review.account && review.currencies && review.instructions && Boolean(review.reason.trim());

  const refreshConfig = async () => {
    await queryClient.invalidateQueries({ queryKey: configKey });
  };
  const createDraft = useMutation({
    mutationFn: () => {
      const currencies = form.supportedCurrenciesText.split(",").map((value) => value.trim().toUpperCase());
      if (currencies.length < 1 || currencies.length > 20 || currencies.some((value) => !/^[A-Z]{3}$/.test(value))) {
        throw new Error("Enter 1–20 valid three-letter currencies, separated by commas. Invalid entries are not ignored.");
      }
      if (new Set(currencies).size !== currencies.length) throw new Error("Remove duplicate supported currencies.");
      const currency = form.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency) || !currencies.includes(currency)) {
        throw new Error("Primary currency must be a valid three-letter currency included in the supported currency list.");
      }
      if (!form.recipient.trim() || !form.instructions.trim()) throw new Error("Recipient and transfer instructions are required.");
      return authAPI.post("/api/admin/manual-wise/config", {
        currency,
        supportedCurrencies: currencies,
        recipient: form.recipient.trim(),
        instructions: form.instructions.trim(),
        referenceInstructions: form.referenceInstructions.trim(),
        active: false,
        ...(qrFileId ? { qrFileId } : {}),
        depositFundingConfirmed: form.depositFundingConfirmed,
      });
    },
    onSuccess: async () => {
      setNotice("Draft saved. It is not active and will not collect customer payments until separately reviewed and activated.");
      setForm(emptyForm);
      setQrFile(null);
      setQrFileId("");
      await refreshConfig();
    },
  });
  const uploadQr = useMutation({
    mutationFn: async () => {
      if (!qrFile) throw new Error("Choose an image before uploading.");
      const body = new FormData();
      body.append("receipt", qrFile);
      const response = await fetch("/api/admin/manual-wise/config/qr", {
        method: "POST",
        body,
        credentials: "include",
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(response.status === 403
          ? "Access denied (403). Only an authorized Super Admin can upload payment QR images."
          : payload.error || `QR upload failed (${response.status}).`);
      }
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: (result) => {
      setQrFile(null);
      setQrFileId(result.id);
      setNotice("QR uploaded and staged. Review the protected server preview before saving; upload does not activate a configuration.");
    },
  });
  const stageOfficial = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/manual-wise/config/qr/official", {
        method: "POST",
        credentials: "include",
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(response.status === 403
          ? "Access denied (403). Only an authorized Super Admin can stage the supplied QR."
          : payload.error || `Could not stage supplied QR (${response.status}).`);
      }
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: (result) => {
      setQrFile(null);
      setQrFileId(result.id);
      setNotice("Supplied OnSpot QR staged. Review its protected server preview before saving a draft.");
    },
  });
  const activate = useMutation({
    mutationFn: () => authAPI.post(`/api/admin/manual-wise/config/${encodeURIComponent(selectedDraftId)}/activate`, {
      confirmImageReviewed: review.image,
      confirmReceivingAccount: review.account,
      confirmCurrencies: review.currencies,
      confirmInstructions: review.instructions,
      reason: review.reason.trim(),
    }),
    onSuccess: async () => {
      setNotice("Configuration activated. Customer collection now uses the activated configuration.");
      setSelectedDraftId("");
      setReview({ image: false, account: false, currencies: false, instructions: false, reason: "" });
      await refreshConfig();
    },
  });
  const deactivate = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      authAPI.post(`/api/admin/manual-wise/config/${encodeURIComponent(id)}/deactivate`, { reason }),
    onSuccess: async () => {
      setNotice("Configuration deactivated. Customer collection is blocked for the affected currency until another configuration is activated.");
      await refreshConfig();
    },
  });
  const restore = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      authAPI.post(`/api/admin/manual-wise/config/${encodeURIComponent(id)}/restore`, { reason }),
    onSuccess: async () => {
      setNotice("Historical configuration copied as a new draft. It still requires a separate review and activation.");
      await refreshConfig();
    },
  });

  const handleFile = (file: File | null) => {
    setQrFile(file);
    setQrFileId("");
    setNotice("");
  };
  const chooseDraft = (id: string) => {
    setSelectedDraftId(id);
    setReview({ image: false, account: false, currencies: false, instructions: false, reason: "" });
    setNotice("");
  };
  const useAsTemplate = (item: WiseConfiguration) => {
    setForm({
      currency: item.currency || "",
      supportedCurrenciesText: (item.supported_currencies || []).join(", "),
      recipient: item.recipient || "",
      instructions: item.instructions || "",
      referenceInstructions: item.reference_instructions || "",
      depositFundingConfirmed: false,
    });
    setQrFile(null);
    setQrFileId(item.qr_file_id || "");
    setNotice("Loaded as a new-draft template. Saving creates a separate immutable draft; no prior confirmation is carried over.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submitDraft = (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setNotice("");
    createDraft.mutate(undefined, { onError: (cause) => setFormError(errorText(cause)) });
  };
  const statusClass = (item: WiseConfiguration) => item.active || item.config_status === "active"
    ? "bg-emerald-100 text-emerald-900"
    : item.config_status === "draft" || item.config_status === "reviewed"
      ? "bg-amber-100 text-amber-900"
      : "bg-muted text-muted-foreground";

  return <Card aria-label="Wise payment configuration">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> Wise configuration lifecycle</CardTitle>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Immutable drafts, four independent review confirmations, then explicit activation. Uploading or saving never enables customer collection.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className="mr-2 h-4 w-4" />Refresh configuration</Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-6">
      {query.isLoading && <div className="space-y-3" aria-label="Loading configurations"><div className="h-20 animate-pulse rounded-lg bg-muted" /><div className="h-16 animate-pulse rounded-lg bg-muted" /></div>}
      {query.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errorText(query.error)}<Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button></div>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {(formError || createDraft.isError || uploadQr.isError || stageOfficial.isError || activate.isError || deactivate.isError || restore.isError) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{formError || errorText(createDraft.error || uploadQr.error || stageOfficial.error || activate.error || deactivate.error || restore.error)}</p>}

      {!query.isLoading && !query.isError && <section aria-labelledby="active-wise-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 id="active-wise-heading" className="font-semibold">Currently active · customer collection</h3><span className="text-xs text-muted-foreground">{activeConfigs.length} active configuration{activeConfigs.length === 1 ? "" : "s"}</span></div>
        {activeConfigs.length === 0
          ? <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4"><p className="font-medium text-amber-950">No active Wise configuration</p><p className="mt-1 text-sm text-amber-900">Customer collection instructions are unavailable until a saved draft passes review and is activated.</p></div>
          : activeConfigs.map((item) => <article key={item.id} className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{item.currency} · {item.recipient}</h4><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">Active</span></div>
              <p className="text-xs text-muted-foreground">Supported currencies: {(item.supported_currencies || []).join(", ") || item.currency}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.instructions}</p>
              {item.reference_instructions && <p className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Reference:</span> {item.reference_instructions}</p>}
              <p className="text-xs text-muted-foreground">Activated {dateText(item.activated_at)} · {item.activated_by || "actor unavailable"}</p>
              <label className="block space-y-1 text-sm font-medium">Reason to deactivate
                <textarea aria-label={`Reason to deactivate ${item.currency}`} className="min-h-16 w-full rounded-md border bg-background px-3 py-2 font-normal" value={deactivationReasons[item.id] || ""} onChange={(event) => setDeactivationReasons({ ...deactivationReasons, [item.id]: event.target.value })} placeholder="Explain why customer collection should stop" />
              </label>
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" />Deactivation immediately blocks this receiving configuration.</p><p className="mt-1">All still-active currency rows activated together with this version are revoked. Separately activated configurations are unchanged. A reason is required; historical records remain available.</p></div>
              <Button type="button" variant="destructive" disabled={!deactivationReasons[item.id]?.trim() || deactivate.isPending} onClick={() => deactivate.mutate({ id: item.id, reason: deactivationReasons[item.id].trim() })}>{deactivate.isPending ? "Deactivating…" : "Deactivate"}</Button>
              <Button type="button" variant="outline" className="ml-2" onClick={() => useAsTemplate(item)}>Edit as new draft</Button>
            </div>
            <div className="flex flex-col items-center gap-2 sm:items-end">
              {item.qr_file_id ? <ImagePreview fileId={item.qr_file_id} alt={`Active ${item.currency} Wise QR`} /> : <p className="rounded border border-dashed p-5 text-xs text-muted-foreground">No QR image configured</p>}
              <p className="text-center text-xs text-muted-foreground sm:text-right">Active receiving details for {item.currency}</p>
            </div>
          </article>)}
      </section>}

      <section aria-labelledby="draft-editor-heading" className="space-y-3 border-t pt-5">
        <div><h3 id="draft-editor-heading" className="font-semibold">Create an immutable draft</h3><p className="mt-1 text-sm text-muted-foreground">Every save creates a new version. To revise a draft, load it as a template and save another draft.</p></div>
        <form className="space-y-4 rounded-xl border bg-muted/10 p-4" onSubmit={submitDraft}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Primary currency
              <Input required maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} placeholder="Three-letter code" />
            </label>
            <label className="space-y-1 text-sm font-medium">Supported currencies
              <Input required value={form.supportedCurrenciesText} onChange={(event) => setForm({ ...form, supportedCurrenciesText: event.target.value })} placeholder="Comma-separated, e.g. USD, EUR" aria-describedby="wise-currency-help" />
              <span id="wise-currency-help" className="block text-xs font-normal text-muted-foreground">Enter 1–20 distinct three-letter codes. Primary currency must be included; invalid entries are never silently removed.</span>
              {form.supportedCurrenciesText && !currenciesValid && <span role="alert" className="block text-xs text-rose-700">{invalidCurrencyEntries.length ? `Invalid entries: ${invalidCurrencyEntries.join(", ")}` : hasBlankCurrency ? "Remove empty entries from the comma-separated list." : duplicateCurrencies.length ? `Duplicate entries: ${Array.from(new Set(duplicateCurrencies)).join(", ")}` : currencyEntries.length > 20 ? "Maximum 20 supported currencies." : currencyEntries.length === 0 ? "Enter at least one supported currency." : "Primary currency must be a valid code in this list."}</span>}
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">Receiving account recipient
              <Input required value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} placeholder="Enter independently verified recipient" />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">Transfer instructions
            <textarea required className="min-h-24 w-full rounded-md border bg-background px-3 py-2 font-normal" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Enter confirmed transfer instructions" />
          </label>
          <label className="block space-y-1 text-sm font-medium">Reference instructions
            <textarea className="min-h-16 w-full rounded-md border bg-background px-3 py-2 font-normal" value={form.referenceInstructions} onChange={(event) => setForm({ ...form, referenceInstructions: event.target.value })} placeholder="Optional instructions for the transfer reference" />
          </label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.depositFundingConfirmed} onChange={(event) => setForm({ ...form, depositFundingConfirmed: event.target.checked })} className="mt-1" /><span>I independently confirmed any required deposit funding for this destination. This is not preconfirmed.</span></label>
          <div className="space-y-3 rounded-lg border bg-background p-3">
            <div><p className="text-sm font-semibold">QR image for this draft</p><p className="mt-1 text-xs text-muted-foreground">Preview your local selection before upload; after upload, inspect the protected server preview before saving.</p></div>
            <label className="block space-y-1 text-sm font-medium">Choose QR image
              <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFile(event.target.files?.[0] || null)} />
            </label>
            {qrFile && <div className="flex flex-wrap items-center gap-3"><LocalQrPreview file={qrFile} /><Button type="button" variant="outline" disabled={uploadQr.isPending} onClick={() => uploadQr.mutate()}><Upload className="mr-2 h-4 w-4" />{uploadQr.isPending ? "Uploading…" : "Upload QR image"}</Button></div>}
            {qrFileId && <div className="flex flex-wrap items-center gap-3 border-t pt-3"><ImagePreview fileId={qrFileId} alt="Uploaded protected QR preview before draft save" /><p className="max-w-xs text-xs text-muted-foreground">Protected server preview · ready to attach to the draft. Upload does not activate payment instructions.</p></div>}
            <div className="flex flex-wrap items-center gap-3 border-t pt-3">
              <OfficialQrSourcePreview />
              <Button type="button" variant="outline" disabled={stageOfficial.isPending} onClick={() => stageOfficial.mutate()}><ImagePlus className="mr-2 h-4 w-4" />{stageOfficial.isPending ? "Staging supplied QR…" : "Use supplied OnSpot QR"}</Button>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mr-2 inline h-4 w-4" />Saving makes a draft only. Account ownership and every instruction must be independently reviewed before activation.</div>
          <Button type="submit" disabled={createDraft.isPending || !form.currency.trim() || !currenciesValid || !form.recipient.trim() || !form.instructions.trim()}>{createDraft.isPending ? "Saving draft…" : "Save draft"}</Button>
        </form>
      </section>

      <section aria-labelledby="drafts-heading" className="space-y-3 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="drafts-heading" className="font-semibold">Saved drafts · review before activation</h3><span className="text-xs text-muted-foreground">{draftConfigs.length} awaiting activation</span></div>
        {draftConfigs.length === 0
          ? <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No saved drafts are waiting for review.</div>
          : <div className="grid gap-3">{draftConfigs.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${selectedDraftId === item.id ? "border-primary/60 bg-primary/[0.03]" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{item.currency} · {item.recipient}</h4><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(item)}`}>{statusLabel(item)}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">Supported: {(item.supported_currencies || []).join(", ") || "—"} · Draft {item.id}</p>
              </div>
              <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={selectedDraftId === item.id ? "default" : "outline"} onClick={() => chooseDraft(item.id)}>{selectedDraftId === item.id ? "Selected for review" : "Review this draft"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => useAsTemplate(item)}>Use as new draft</Button></div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div><p className="whitespace-pre-wrap text-sm leading-relaxed">{item.instructions}</p>{item.reference_instructions && <p className="mt-2 whitespace-pre-wrap border-l-2 pl-3 text-sm text-muted-foreground">{item.reference_instructions}</p>}<p className="mt-2 text-xs text-muted-foreground">Created {dateText(item.created_at)} · {item.created_by || "actor unavailable"}</p></div>
              {item.qr_file_id ? <ImagePreview fileId={item.qr_file_id} alt={`Draft ${item.currency} Wise QR`} /> : <p className="flex min-h-24 items-center justify-center rounded border border-dashed px-4 text-center text-xs text-muted-foreground">No QR image attached</p>}
            </div>
          </article>)}</div>}
        {selectedDraft && <div data-testid="wise-configuration-review" className="space-y-4 rounded-xl border-2 border-primary/30 bg-primary/[0.025] p-4">
          <div><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Review selected draft · {selectedDraft.currency}</p><p className="mt-1 text-sm text-muted-foreground">Read the exact saved recipient, currencies, instructions, and QR image before making four separate confirmations.</p></div>
      <div className="grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receiving account</p><p className="font-semibold">{selectedDraft.recipient}</p><p className="mt-1 text-sm text-muted-foreground">Primary currency: {selectedDraft.currency} · Supported: {(selectedDraft.supported_currencies || []).join(", ")}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transfer instructions</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{selectedDraft.instructions}</p>{selectedDraft.reference_instructions && <p className="mt-3 whitespace-pre-wrap border-l-2 border-primary/30 pl-3 text-sm"><span className="font-semibold">Reference instructions</span><br />{selectedDraft.reference_instructions}</p>}</div>
            </div>
            {selectedDraft.qr_file_id ? <div className="space-y-2"><ImagePreview key={selectedReadinessKey} fileId={selectedDraft.qr_file_id} alt={`Full review image for ${selectedDraft.currency} Wise configuration`} readinessKey={selectedReadinessKey} onReady={onSelectedQrReady} />{selectedQrLoaded ? <p role="status" className="text-xs font-medium text-emerald-800">Protected QR loaded and ready for review.</p> : <p role="status" className="text-xs text-amber-900">Activation is blocked until the protected QR image loads successfully.</p>}</div> : <p role="alert" className="flex min-h-36 items-center justify-center rounded border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">This saved draft has no protected QR image. It cannot be activated until a QR is attached to a new draft.</p>}
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Independent review confirmations</legend>
            {([
              ["image", selectedDraft.qr_file_id ? "I reviewed the complete QR image and confirmed it is the intended payment destination." : "I verified this saved configuration intentionally has no QR image."],
              ["account", "I independently verified receiving account ownership and recipient details."],
              ["currencies", "I verified the primary and all supported currencies."],
              ["instructions", "I reviewed the full transfer and reference instructions."],
            ] as const).map(([key, text]) => <label key={key} className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm"><input type="checkbox" checked={review[key]} disabled={key === "image" && !selectedQrLoaded} onChange={(event) => setReview({ ...review, [key]: event.target.checked })} className="mt-1" /><span>{text}</span></label>)}
          </fieldset>
          <label className="block space-y-1 text-sm font-medium">Activation reason
            <textarea required className="min-h-16 w-full rounded-md border bg-background px-3 py-2 font-normal" value={review.reason} onChange={(event) => setReview({ ...review, reason: event.target.value })} placeholder="Record why this reviewed configuration is being activated" />
          </label>
          <Button type="button" disabled={!reviewComplete || activate.isPending} onClick={() => activate.mutate()}><Check className="mr-2 h-4 w-4" />{activate.isPending ? "Activating…" : "Activate reviewed configuration"}</Button>
        </div>}
      </section>

      <section aria-labelledby="history-heading" className="space-y-3 border-t pt-5">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><h3 id="history-heading" className="font-semibold">Configuration history</h3></div>
        {historyConfigs.length === 0
          ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Inactive and historical configurations will appear here.</p>
          : <div className="space-y-3">{historyConfigs.map((item) => <article key={item.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{item.currency} · {item.recipient}</h4><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(item)}`}>{statusLabel(item)}</span></div><p className="mt-1 text-xs text-muted-foreground">Supported currencies: {(item.supported_currencies || []).join(", ") || "—"}</p></div>
              {item.config_status === "inactive" && <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={!restoreReasons[item.id]?.trim() || restore.isPending} onClick={() => restore.mutate({ id: item.id, reason: restoreReasons[item.id].trim() })}>{restore.isPending ? "Restoring…" : "Restore as draft"}</Button></div>}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2 text-sm"><p className="whitespace-pre-wrap">{item.instructions}</p>{item.reference_instructions && <p className="whitespace-pre-wrap text-muted-foreground">Reference: {item.reference_instructions}</p>}
                <div className="grid gap-x-5 gap-y-1 border-t pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <MetadataLine label="Created" value={`${dateText(item.created_at)}${item.created_by ? ` · ${item.created_by}` : ""}`} />
                  <MetadataLine label="Uploaded" value={item.uploaded_at ? `${dateText(item.uploaded_at)}${item.uploaded_by ? ` · ${item.uploaded_by}` : ""}` : null} />
                  <MetadataLine label="Activated" value={item.activated_at ? `${dateText(item.activated_at)}${item.activated_by ? ` · ${item.activated_by}` : ""}` : null} />
                  <MetadataLine label="Deactivated" value={item.deactivated_at ? `${dateText(item.deactivated_at)}${item.deactivated_by ? ` · ${item.deactivated_by}` : ""}` : null} />
                  <MetadataLine label="Previous version" value={item.previous_version_id} />
                  <MetadataLine label="Source draft/version" value={item.source_config_id} />
                  <MetadataLine label="Change reason" value={item.change_reason} />
                  <MetadataLine label="Deactivation reason" value={item.deactivation_reason} />
                  <MetadataLine label="Revoked" value={item.revoked_at ? dateText(item.revoked_at) : null} />
                </div>
                {item.config_status === "inactive" && <label className="block space-y-1 text-sm font-medium">Reason to restore as a draft
                  <Input value={restoreReasons[item.id] || ""} onChange={(event) => setRestoreReasons({ ...restoreReasons, [item.id]: event.target.value })} placeholder="Explain why this historical version is being restored" />
                </label>}
              </div>
              {item.qr_file_id ? <ImagePreview fileId={item.qr_file_id} alt={`Historical ${item.currency} Wise QR`} /> : <p className="flex min-h-24 items-center justify-center rounded border border-dashed px-4 text-center text-xs text-muted-foreground">No QR image retained</p>}
            </div>
          </article>)}</div>}
      </section>
    </CardContent>
  </Card>;
}
