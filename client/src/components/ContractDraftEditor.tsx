import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Eye, FileText, Loader2, RefreshCw, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeContractHtml } from "@/components/ContractTemplateEditor";

type FieldValue = { value: string | null; source: string; missing: boolean };
type AuthoringField = { key: string; label: string; source: string; required: boolean; editableBy: "admin" | "preparer" | "none" };
type AuthoringTemplate = { id: string; kind: string; name: string; version: string };
type AuthoringDraft = {
  id: string;
  kind: string;
  template_id: string;
  template_version: string;
  field_values: Record<string, FieldValue>;
  field_overrides: Record<string, string>;
  body_overrides: Record<string, string>;
  status: string;
  revision: number;
  rendered_document_id?: string|null;
};
type AuthoringData = {
  templates: AuthoringTemplate[];
  draft: AuthoringDraft | null;
  fields: AuthoringField[];
  clauses: Array<{ id: string; html: string }>;
  preview: { html: string; missingKeys: string[]; unknownKeys: string[] };
  isAdmin: boolean;
};
type LivePreview = { html: string; missingKeys: string[]; unknownKeys: string[] };
type AddressDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
};

const emptyAddress = (): AddressDraft => ({
  addressLine1: "", addressLine2: "", city: "", stateRegion: "", postalCode: "", country: "",
});
const profileFieldKeys: Record<string, { group: "client" | "talent"; key: string }> = {
  "client.legalEntityName": { group: "client", key: "legalEntityName" },
  "client.entityType": { group: "client", key: "entityType" },
  "client.signatoryName": { group: "client", key: "signatoryName" },
  "client.signatoryTitle": { group: "client", key: "signatoryTitle" },
  "talent.legalFullName": { group: "talent", key: "legalFullName" },
};
const addressProfileKeys: Array<keyof AddressDraft> = ["addressLine1", "addressLine2", "city", "stateRegion", "postalCode", "country"];

async function json<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body);
  return response.json() as Promise<T>;
}

function messageFor(error: unknown) {
  if (error instanceof Error) {
    const match = error.message.match(/^\d+:\s*(.*)$/);
    if (match?.[1]) {
      try {
        const body = JSON.parse(match[1]) as { message?: string; error?: string; code?: string };
        return body.message || body.error || body.code || match[1];
      } catch { return match[1]; }
    }
    return error.message;
  }
  return "The agreement could not be updated. Please try again.";
}

function fieldGroup(key: string) {
  if (key.startsWith("client.")) return "Client";
  if (key.startsWith("talent.")) return "Talent";
  if (key.startsWith("onspot.")) return "OnSpot";
  return "Deal terms";
}

const groups = ["Client", "Talent", "OnSpot", "Deal terms"] as const;

export function ContractDraftEditor({ contractId, authoringUrl, createContext, documentNoun = "agreement", onChanged, onSendReadinessChange }: {
  contractId: string;
  authoringUrl?: string;
  createContext?: { submissionId: string };
  documentNoun?: string;
  onChanged?: () => void;
  onSendReadinessChange?: (blocked: boolean) => void;
}) {
  const qc = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});
  const [bodyOverrides, setBodyOverrides] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshReview, setRefreshReview] = useState<{ changes: Array<{ key: string; before: string | null; after: string | null }>; refreshHash: string } | null>(null);
  const [livePreview, setLivePreview] = useState<LivePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [needsRender, setNeedsRender] = useState(false);
  const [profileFieldSave, setProfileFieldSave] = useState<Record<string, boolean>>({});
  const [addressDraft, setAddressDraft] = useState<{ client: AddressDraft; talent: AddressDraft }>({
    client: emptyAddress(), talent: emptyAddress(),
  });
  const [saveAddressToProfile, setSaveAddressToProfile] = useState({ client: false, talent: false });
  const initializedDraft = useRef<string | null>(null);
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = authoringUrl ?? `/api/contracts/${encodeURIComponent(contractId)}/authoring`;
  const queryKey = useMemo(() => authoringUrl ? [base, "authoring"] : ["/api/contracts",contractId,"authoring"], [authoringUrl,base,contractId]);
  const { data, isLoading, isError, refetch } = useQuery<AuthoringData>({
    queryKey,
    queryFn: () => json("GET", base),
    enabled: !!contractId,
  });
  const initialFields = data?.draft?.field_overrides ?? {};
  const initialBodies = data?.draft?.body_overrides ?? {};
  const serializedOverrides = JSON.stringify([fieldOverrides, bodyOverrides]);
  const initialSerialized = JSON.stringify([initialFields, initialBodies]);
  const legalProfileSelection = Object.entries(profileFieldSave).some(([key, enabled]) =>
    enabled && !!profileFieldKeys[key] && Object.prototype.hasOwnProperty.call(fieldOverrides, key) &&
    fieldOverrides[key] !== (data?.draft?.field_values[key]?.value ?? ""));
  const addressProfileSelection = (["client", "talent"] as const).some((group) =>
    saveAddressToProfile[group] && Object.values(addressDraft[group]).some((value) => value.trim()));
  const profileDirty = legalProfileSelection || addressProfileSelection;
  const dirty = !!data?.draft && (serializedOverrides !== initialSerialized || profileDirty);
  const blocked = isLoading || saving || rendering || refreshing ||
    (!!data?.draft && (initializedDraft.current !== data.draft.id || dirty || needsRender || previewLoading));

  useEffect(() => {
    setSelectedTemplate("");
    setFieldOverrides({});
    setBodyOverrides({});
    setNeedsRender(false);
    setProfileFieldSave({});
    setAddressDraft({ client: emptyAddress(), talent: emptyAddress() });
    setSaveAddressToProfile({ client: false, talent: false });
    initializedDraft.current = null;
    setError("");
    setNotice("");
    setRefreshReview(null);
    setLivePreview(null);
    sequence.current += 1;
  }, [contractId]);

  useEffect(() => {
    if (!data?.draft) {
      setFieldOverrides({});
      setBodyOverrides({});
      setNeedsRender(false);
      setProfileFieldSave({});
      setAddressDraft({ client: emptyAddress(), talent: emptyAddress() });
      setSaveAddressToProfile({ client: false, talent: false });
      initializedDraft.current = null;
      return;
    }
    if (initializedDraft.current !== data.draft.id) {
      initializedDraft.current = data.draft.id;
      setNeedsRender(!data.draft.rendered_document_id);
    }
    setFieldOverrides(data.draft.field_overrides || {});
    setBodyOverrides(data.draft.body_overrides || {});
  }, [data?.draft?.id]);

  useEffect(() => {
    if (!data?.draft || !data.preview) return;
    sequence.current += 1;
    if (timer.current) clearTimeout(timer.current);
    if (dirty) return;
    setLivePreview({ ...data.preview, html: sanitizeContractHtml(data.preview.html) });
    setPreviewLoading(false);
  }, [data?.draft?.revision]);

  useEffect(() => {
    onSendReadinessChange?.(blocked);
  }, [blocked, onSendReadinessChange]);

  const schedulePreview = useCallback((fields: Record<string, string>, bodies: Record<string, string>) => {
    if (timer.current) clearTimeout(timer.current);
    const current = ++sequence.current;
    setLivePreview(null);
    setPreviewLoading(true);
    setError("");
    timer.current = setTimeout(() => {
      const revision = data?.draft?.revision;
      if (revision === undefined) { setPreviewLoading(false); return; }
      void json<LivePreview>("POST", `${base}/preview`, {
        revision,
        fieldOverrides: fields,
        bodyOverrides: Object.fromEntries(Object.entries(bodies).map(([id, html]) => [id, sanitizeContractHtml(html)])),
      }).then((result) => {
        if (sequence.current === current) setLivePreview({ ...result, html: sanitizeContractHtml(result.html) });
      }).catch((cause: unknown) => {
        if (sequence.current === current) setError(messageFor(cause));
      }).finally(() => {
        if (sequence.current === current) setPreviewLoading(false);
      });
    }, 450);
  }, [base, data?.draft?.revision]);

  function markNeedsRender() {
    setNeedsRender(true);
    onSendReadinessChange?.(true);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    sequence.current += 1;
  }, [contractId]);

  async function reloadAuthoring() {
    await refetch();
      if (!authoringUrl) await qc.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
  }

  async function createDraft() {
    if (!selectedTemplate) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await json("POST", base, { templateId: selectedTemplate, ...createContext });
      await reloadAuthoring();
      markNeedsRender();
      setNotice(`${documentNoun[0].toUpperCase()}${documentNoun.slice(1)} draft created. Review the populated fields, save edits, then generate its PDF.`);
      onChanged?.();
    } catch (cause) { setError(messageFor(cause)); }
    finally { setSaving(false); }
  }

  function editField(key: string, value: string) {
    const next = { ...fieldOverrides, [key]: value };
    setFieldOverrides(next);
    if (profileFieldKeys[key] && value === (data?.draft?.field_values[key]?.value ?? "")) {
      setProfileFieldSave((current) => ({ ...current, [key]: false }));
    }
    markNeedsRender();
    setRefreshReview(null);
    schedulePreview(next, bodyOverrides);
  }

  function resetField(key: string) {
    const next = { ...fieldOverrides };
    delete next[key];
    setFieldOverrides(next);
    setProfileFieldSave((current) => ({ ...current, [key]: false }));
    if (key === "client.address") {
      setAddressDraft((current) => ({ ...current, client: emptyAddress() }));
      setSaveAddressToProfile((current) => ({ ...current, client: false }));
    }
    if (key === "talent.address") {
      setAddressDraft((current) => ({ ...current, talent: emptyAddress() }));
      setSaveAddressToProfile((current) => ({ ...current, talent: false }));
    }
    markNeedsRender();
    setRefreshReview(null);
    schedulePreview(next, bodyOverrides);
  }

  function editClause(id: string, html: string) {
    const next = { ...bodyOverrides, [id]: html };
    setBodyOverrides(next);
    markNeedsRender();
    setRefreshReview(null);
    schedulePreview(fieldOverrides, next);
  }

  function editAddressPart(group: "client" | "talent", key: keyof AddressDraft, value: string) {
    const next = { ...addressDraft[group], [key]: value };
    setAddressDraft((current) => ({ ...current, [group]: next }));
    const composed = [
      next.addressLine1,
      next.addressLine2,
      [next.city, next.stateRegion].filter(Boolean).join(", "),
      next.postalCode,
      next.country,
    ].filter((part) => part.trim()).join(", ");
    editField(group === "client" ? "client.address" : "talent.address", composed);
  }

  function resetClause(id: string) {
    const next = { ...bodyOverrides };
    delete next[id];
    setBodyOverrides(next);
    markNeedsRender();
    setRefreshReview(null);
    schedulePreview(fieldOverrides, next);
  }

  async function saveChanges() {
    if (!data?.draft) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const normalizedBodyOverrides = Object.fromEntries(
        Object.entries(bodyOverrides).map(([id, html]) => [id, sanitizeContractHtml(html)]),
      );
      const profileChanges: { client?: Record<string, string | null>; talent?: Record<string, string | null> } = {};
      for (const [fieldKey, enabled] of Object.entries(profileFieldSave)) {
        const mapping = profileFieldKeys[fieldKey];
        if (!enabled || !mapping || !Object.prototype.hasOwnProperty.call(fieldOverrides, fieldKey) ||
          fieldOverrides[fieldKey] === (data.draft.field_values[fieldKey]?.value ?? "")) continue;
        profileChanges[mapping.group] ??= {};
        profileChanges[mapping.group]![mapping.key] = fieldOverrides[fieldKey] || null;
      }
      for (const group of ["client", "talent"] as const) {
        if (!saveAddressToProfile[group]) continue;
        const address = addressDraft[group];
        if (!Object.values(address).some((value) => value.trim())) continue;
        profileChanges[group] ??= {};
        for (const key of addressProfileKeys) {
          profileChanges[group]![key] = address[key].trim() || null;
        }
      }
      await json("PATCH", base, {
        revision: data.draft.revision,
        fieldOverrides,
        bodyOverrides: normalizedBodyOverrides,
        ...(Object.keys(profileChanges).length ? { profileChanges } : {}),
      });
      setBodyOverrides(normalizedBodyOverrides);
      markNeedsRender();
      setProfileFieldSave({});
      setSaveAddressToProfile({ client: false, talent: false });
      setNotice(authoringUrl ? `Changes saved to this ${documentNoun} revision. Generate a new PDF before issuing.` : "Changes saved to this agreement revision. Generate a new PDF before sending.");
      await reloadAuthoring();
      onChanged?.();
    } catch (cause) {
      const description = messageFor(cause);
      const conflict = /409|conflict|revision|stale/i.test(description);
      setError(conflict
        ? `${description} The latest revision was loaded; your local edits were kept. Review them before saving again.`
        : description);
      if (conflict) await refetch();
    } finally { setSaving(false); }
  }

  async function beginRefresh() {
    if (!data?.draft) return;
    setRefreshing(true); setError(""); setNotice("");
    try {
      const result = await json<{ revision: number; changes: Array<{ key: string; before: string | null; after: string | null }>; fieldValues: Record<string, FieldValue>; refreshHash: string }>("POST", `${base}/refresh-preview`, { revision: data.draft.revision });
      setRefreshReview({ changes: result.changes || [], refreshHash: result.refreshHash });
      setNotice(result.changes?.length ? "Review the profile snapshot changes before applying them." : "No source values have changed.");
    } catch (cause) {
      const description = messageFor(cause);
      setError(/409|conflict|revision|stale/i.test(description)
        ? `${description} Reload the latest agreement before checking source changes again.`
        : description);
      if (/409|conflict|revision|stale/i.test(description)) await refetch();
    }
    finally { setRefreshing(false); }
  }

  async function applyRefresh() {
    if (!data?.draft || !refreshReview) return;
    setRefreshing(true); setError(""); setNotice("");
    try {
      await json("POST", `${base}/refresh`, { revision: data.draft.revision, refreshHash: refreshReview.refreshHash });
      setRefreshReview(null);
      markNeedsRender();
      setNotice("Latest source snapshot applied. Your explicit overrides were retained.");
      await reloadAuthoring();
      onChanged?.();
    } catch (cause) {
      setError(messageFor(cause));
      if (/409|conflict|revision|hash|stale/i.test(messageFor(cause))) {
        setRefreshReview(null);
        await refetch();
      }
    } finally { setRefreshing(false); }
  }

  async function renderPdf() {
    if (!data?.draft || dirty) return;
    setRendering(true); setError(""); setNotice("");
    try {
      await json("POST", `${base}/render`, { revision: data.draft.revision });
      const parentRefresh = onChanged?.();
      setNeedsRender(false);
      onSendReadinessChange?.(false);
      setNotice(authoringUrl ? "PDF generated as a versioned private document. Review it below before issuing." : "PDF generated as a versioned contract document. Use Review PDF below before sending.");
      await Promise.all([reloadAuthoring(), authoringUrl ? Promise.resolve() : qc.invalidateQueries({ queryKey: ["/api/contracts"] }), parentRefresh]);
    } catch (cause) {
      const description = messageFor(cause);
      setError(/409|conflict|revision|stale/i.test(description)
        ? `${description} The current revision could not be rendered. Reload the latest agreement and review it.`
        : description);
      if (/409|conflict|revision|stale/i.test(description)) await refetch();
    }
    finally { setRendering(false); }
  }

  const allowed = (field: AuthoringField) => field.editableBy !== "none" &&
    (data?.isAdmin ? field.editableBy === "admin" || field.editableBy === "preparer" : field.editableBy === "preparer");
  const hasDraft = !!data?.draft;
  const editableFieldCount = data?.fields.filter(allowed).length ?? 0;

  if (isLoading) return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Agreement authoring loading">
    <div className="h-5 w-48 animate-pulse rounded bg-slate-100" /><div className="h-16 animate-pulse rounded bg-slate-100" /><div className="h-32 animate-pulse rounded bg-slate-100" />
  </section>;
  if (isError || !data) return <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
    <div className="flex gap-2 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Editable agreement details could not be loaded.</p></div>
    <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Retry</Button>
  </section>;

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Editable agreement authoring">
    <header className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-indigo-700">Auditable {documentNoun} draft</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{hasDraft ? "Edit agreement details" : "Start from an approved template"}</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">This authoring flow creates a versioned PDF alongside uploaded PDFs. Profile updates are separate and opt-in; this does not replace uploaded-PDF signing.</p>
      </div>
      {hasDraft && <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Revision {data.draft!.revision} · {data.draft!.status.replaceAll("_", " ")}</span>}
    </header>

    {!hasDraft ? <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="space-y-1.5"><Label htmlFor={`authoring-template-${contractId}`}>Approved template</Label>
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger id={`authoring-template-${contractId}`}><SelectValue placeholder="Choose a contract template" /></SelectTrigger>
          <SelectContent>{data.templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name} · v{template.version}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button onClick={() => void createDraft()} disabled={!selectedTemplate || saving} className="bg-[#474ead] text-white hover:bg-[#3d439c]">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Create editable agreement
      </Button>
      {!data.templates.length && <p className="text-sm text-slate-500 sm:col-span-2">No active approved template is available. An admin must activate an approved template before an agreement can be generated.</p>}
    </div> : <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void beginRefresh()} disabled={refreshing || saving || dirty}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Check for source changes
        </Button>
        <Button size="sm" variant="outline" onClick={() => void saveChanges()} disabled={!dirty || saving || refreshing}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save edits
        </Button>
        <Button size="sm" onClick={() => void renderPdf()} disabled={dirty || rendering || saving || refreshing} className="bg-[#474ead] text-white hover:bg-[#3d439c]">
          {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Generate PDF
        </Button>
        {dirty && <span className="text-xs font-medium text-amber-800">Unsaved edits</span>}
        {!dirty && needsRender && <span className="text-xs font-medium text-amber-800">PDF needs regeneration</span>}
      </div>
      {refreshReview && <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <div><h4 className="text-sm font-semibold text-amber-950">Review source snapshot changes</h4><p className="mt-1 text-xs text-amber-900">Applying refresh updates this agreement snapshot only. Your field and clause overrides remain in place; profile records are never written.</p></div>
        {refreshReview.changes.length ? <div className="max-h-56 space-y-2 overflow-auto">
          {refreshReview.changes.map((change) => <div key={change.key} className="grid gap-1 rounded-md border border-amber-200/80 bg-white/80 p-2 text-xs sm:grid-cols-[minmax(100px,.7fr)_1fr_1fr]">
            <code className="break-all font-medium text-slate-700">{change.key}</code><p className="break-words text-slate-600"><span className="font-semibold">Before:</span> {change.before || "—"}</p><p className="break-words text-slate-800"><span className="font-semibold">After:</span> {change.after || "—"}</p>
          </div>)}
        </div> : <p className="text-xs text-slate-700">No source values changed since this snapshot.</p>}
        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void applyRefresh()} disabled={refreshing} className="bg-amber-900 text-white hover:bg-amber-800">{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Apply snapshot refresh</Button><Button size="sm" variant="outline" onClick={() => setRefreshReview(null)} disabled={refreshing}>Keep current snapshot</Button></div>
      </div>}

      {groups.map((group) => {
        const fields = data.fields.filter((field) => fieldGroup(field.key) === group);
        if (!fields.length) return null;
        return <section key={group} className="space-y-2">
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5"><h4 className="text-sm font-semibold text-slate-800">{group}</h4><span className="text-[10px] uppercase tracking-wider text-slate-400">{fields.length} fields</span></div>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => {
              const snapshot = data.draft!.field_values[field.key];
              const overridden = Object.prototype.hasOwnProperty.call(fieldOverrides, field.key);
              const value = overridden ? fieldOverrides[field.key] : snapshot?.value ?? "";
              const canEdit = allowed(field);
              const missing = field.required && !value.trim();
              return <div key={field.key} className={`space-y-1.5 rounded-lg border p-3 ${missing ? "border-rose-300 bg-rose-50/60" : "border-slate-200 bg-slate-50/60"}`}>
                <div className="flex items-start justify-between gap-2"><Label htmlFor={`authoring-field-${field.key}`} className="text-xs font-semibold text-slate-700">{field.label}{field.required && <span className="ml-1 text-rose-600" aria-label="required">*</span>}</Label>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${overridden ? "bg-indigo-100 text-indigo-800" : "bg-slate-200/70 text-slate-600"}`}>{overridden ? "Edited" : "Auto"}</span>
                </div>
                {field.key === "job.description" || field.key === "contract.terminationClause" ? <Textarea id={`authoring-field-${field.key}`} value={value} onChange={(event) => editField(field.key, event.target.value)} disabled={!canEdit} rows={3} className="bg-white text-sm" /> :
                  field.key.endsWith(".address") && data.isAdmin && canEdit ? <div className="space-y-2">
                    <p className="text-[10px] leading-relaxed text-slate-500">Current snapshot: {value || "No address saved"}. Existing one-line addresses are not split automatically.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["addressLine1", "Address line 1"],
                        ["addressLine2", "Address line 2"],
                        ["city", "City"],
                        ["stateRegion", "State / region"],
                        ["postalCode", "Postal code"],
                        ["country", "Country"],
                      ] as Array<[keyof AddressDraft, string]>).map(([key, label]) => <div key={key} className="space-y-1">
                        <Label htmlFor={`${field.key}-${key}`} className="text-[10px] font-medium text-slate-500">{label}</Label>
                        <Input id={`${field.key}-${key}`} maxLength={300} value={addressDraft[field.key.startsWith("client.") ? "client" : "talent"][key]} onChange={(event) => editAddressPart(field.key.startsWith("client.") ? "client" : "talent", key, event.target.value)} className="bg-white text-sm" />
                      </div>)}
                    </div>
                    <p className="text-[10px] text-slate-500">Enter the complete replacement address. These parts become this agreement’s address. If you also save to the profile, blank parts clear the corresponding profile fields. Use Reset to restore the saved snapshot.</p>
                  </div> :
                    <Input id={`authoring-field-${field.key}`} value={value} onChange={(event) => editField(field.key, event.target.value)} disabled={!canEdit} maxLength={300} className="bg-white text-sm" />}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>{missing ? "Required value missing" : `${overridden ? "Manual override" : snapshot?.source || field.source} · ${canEdit ? "editable" : "locked"}`}</span>
                  {overridden && canEdit && <button type="button" className="font-semibold text-indigo-700 hover:underline" onClick={() => resetField(field.key)}><RotateCcw className="mr-1 inline h-3 w-3" />Reset to snapshot</button>}
                </div>
                {data.isAdmin && canEdit && profileFieldKeys[field.key] && overridden && value !== (snapshot?.value ?? "") && <label className="flex items-start gap-2 border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-600">
                  <input type="checkbox" className="mt-0.5 accent-indigo-700" checked={!!profileFieldSave[field.key]} onChange={(event) => setProfileFieldSave((current) => ({ ...current, [field.key]: event.target.checked }))} />
                  <span>Also save this changed value to the linked {profileFieldKeys[field.key].group} profile</span>
                </label>}
                {data.isAdmin && field.key.endsWith(".address") && canEdit && <label className="flex items-start gap-2 border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-600">
                  <input type="checkbox" className="mt-0.5 accent-indigo-700" checked={saveAddressToProfile[field.key.startsWith("client.") ? "client" : "talent"]} disabled={!Object.values(addressDraft[field.key.startsWith("client.") ? "client" : "talent"]).some((part) => part.trim())} onChange={(event) => setSaveAddressToProfile((current) => ({ ...current, [field.key.startsWith("client.") ? "client" : "talent"]: event.target.checked }))} />
                  <span>Also save the entered address parts to the linked {field.key.startsWith("client.") ? "client" : "talent"} profile</span>
                </label>}
              </div>;
            })}
          </div>
        </section>;
      })}

      {!!data.clauses.length && <section className="space-y-2">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2"><div><h4 className="text-sm font-semibold text-slate-800">Agreement clauses</h4><p className="mt-1 text-xs text-slate-500">Safe HTML only. Merge fields such as {"{{client.legalEntityName}}"} are retained.</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase text-slate-600">Admin edits</span></div>
        <div className="space-y-3">{data.clauses.map((clause, index) => {
          const overridden = Object.prototype.hasOwnProperty.call(bodyOverrides, clause.id);
          return <div key={clause.id} className="space-y-1.5 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2"><Label htmlFor={`authoring-clause-${clause.id}`} className="text-xs font-semibold text-slate-700">Clause {index + 1}</Label><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${overridden ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"}`}>{overridden ? "Edited" : "Auto"}</span></div>
            <Textarea id={`authoring-clause-${clause.id}`} value={overridden ? bodyOverrides[clause.id] : sanitizeContractHtml(clause.html)} onChange={(event) => editClause(clause.id, event.target.value)} disabled={!data.isAdmin} rows={Math.min(10, Math.max(4, (overridden ? bodyOverrides[clause.id] : clause.html).split("\n").length + 1))} className="bg-white font-mono text-xs leading-5" />
            {!data.isAdmin && <p className="text-[10px] text-slate-500">Clause text is read-only for preparers.</p>}
            {overridden && data.isAdmin && <button type="button" className="text-[10px] font-semibold text-indigo-700 hover:underline" onClick={() => resetClause(clause.id)}><RotateCcw className="mr-1 inline h-3 w-3" />Reset to template</button>}
          </div>;
        })}</div>
      </section>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5"><div><h4 className="text-sm font-semibold text-slate-800">Live agreement preview</h4><p className="text-[10px] text-slate-500">Unsaved edits are previewed without saving.</p></div><span className="flex items-center gap-1 text-[10px] text-slate-500">{previewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} {previewLoading ? "Updating" : "Sandboxed"}</span></div>
        <div className="p-3">
          {previewLoading && !livePreview ? <div className="h-72 animate-pulse rounded bg-white" /> : error && !livePreview ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div> : livePreview ? <>
            {(livePreview.missingKeys.length > 0 || livePreview.unknownKeys.length > 0) && <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{livePreview.missingKeys.length > 0 && <p>Missing values: {livePreview.missingKeys.join(", ")}</p>}{livePreview.unknownKeys.length > 0 && <p>Unknown fields: {livePreview.unknownKeys.join(", ")}</p>}</div>}
            <iframe title="Live agreement preview" sandbox="" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px/1.65 Georgia,serif;color:#263d40;background:#fff;max-width:720px;margin:0 auto;padding:28px 24px}h1,h2,h3,h4{line-height:1.25}table{width:100%;border-collapse:collapse;margin:1em 0}td,th{border:1px solid #cbd5d6;padding:7px;text-align:left}blockquote{border-left:3px solid #8ba7a5;margin-left:0;padding-left:14px;color:#526d70}section{margin:1.5em 0}</style></head><body>${sanitizeContractHtml(livePreview.html)}</body></html>`} className="h-[min(55vh,580px)] min-h-[320px] w-full rounded border border-slate-200 bg-white" />
          </> : <div className="flex h-72 items-center justify-center rounded bg-white px-6 text-center text-xs text-slate-500"><div><ShieldCheck className="mx-auto mb-2 h-5 w-5 text-indigo-600" />Preview appears after agreement edits are made.</div></div>}
        </div>
      </section>
      {notice && <p role="status" className="text-xs text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      <p className="text-[10px] text-slate-500">{editableFieldCount} of {data.fields.length} fields editable for your role. Saves record edited field keys on the server audit trail.</p>
    </>}
  </section>;
}
