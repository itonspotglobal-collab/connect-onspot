import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiRequestError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ContractTemplateEditor, TEMPLATE_BASE } from "@/components/ContractTemplateEditor";
import type { MergeField, TemplateField } from "@/components/ContractTemplateEditor";
import { AlertCircle, ArrowRight, CheckCircle2, FilePlus2, FileText, LockKeyhole, Plus, RefreshCw, ShieldCheck, Tag, X } from "lucide-react";

type TemplateKind = "msa" | "talent_agreement" | "sow";
type TemplateStatus = "draft" | "active" | "retired";
type TemplateListItem = {
  id: string;
  kind: TemplateKind;
  name: string;
  version: string;
  status: TemplateStatus;
  createdAt: string;
  activatedAt?: string | null;
  activationReason?: string | null;
};
type ContractTemplate = TemplateListItem & { body: string; fields: TemplateField[] };
type ListResponse = { items: TemplateListItem[]; mergeFields: MergeField[] };
type DetailResponse = ContractTemplate & { mergeFields?: MergeField[]; reviewHash: string };

const kindNames: Record<TemplateKind, string> = { msa: "Master services agreement", talent_agreement: "Talent agreement", sow: "Statement of work" };
const kindOrder: TemplateKind[] = ["msa", "talent_agreement", "sow"];
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const errorStatus = (error: unknown) => error instanceof ApiRequestError ? error.status : null;

export default function AdminContractTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createSource, setCreateSource] = useState<TemplateListItem | null>(null);
  const [createKind, setCreateKind] = useState<TemplateKind>("msa");
  const [createName, setCreateName] = useState("");
  const [createVersion, setCreateVersion] = useState("");
  const [activateTarget, setActivateTarget] = useState<TemplateListItem | null>(null);
  const [activationReason, setActivationReason] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [activationReviewHash, setActivationReviewHash] = useState("");

  const listQuery = useQuery<ListResponse>({
    queryKey: [TEMPLATE_BASE],
    queryFn: async () => (await apiRequest("GET", TEMPLATE_BASE)).json(),
  });
  const items = listQuery.data?.items ?? [];
  useEffect(() => {
    if (selectedId && items.some((item) => item.id === selectedId)) return;
    if (!selectedId && items.length) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const detailQuery = useQuery<DetailResponse>({
    queryKey: [TEMPLATE_BASE, selectedId],
    queryFn: async () => (await apiRequest("GET", `${TEMPLATE_BASE}/${encodeURIComponent(selectedId!)}`)).json(),
    enabled: !!selectedId,
  });
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const registry = useMemo(() => listQuery.data?.mergeFields ?? detailQuery.data?.mergeFields ?? [], [listQuery.data?.mergeFields, detailQuery.data?.mergeFields]);

  const createMutation = useMutation({
    mutationFn: async (source: { kind: TemplateKind; name: string; version: string; sourceTemplateId?: string }) => {
      const response = await apiRequest("POST", TEMPLATE_BASE, source);
      return response.json() as Promise<ContractTemplate>;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: [TEMPLATE_BASE] });
      setSelectedId(created.id);
      setShowCreate(false);
      setCreateSource(null);
      setCreateName("");
      setCreateVersion("");
      toast({ title: "Draft version created", description: "This version is private until saved and reviewed." });
    },
    onError: (error) => toast({ title: "Could not create draft", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }),
  });
  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; body: string; fields: TemplateField[] } }) => {
      await apiRequest("PATCH", `${TEMPLATE_BASE}/${encodeURIComponent(id)}`, data);
    },
    onSuccess: async (_result, variables) => {
      queryClient.setQueryData<DetailResponse>([TEMPLATE_BASE, variables.id], (old) => old ? { ...old, ...variables.data } : old);
      await queryClient.invalidateQueries({ queryKey: [TEMPLATE_BASE] });
      await queryClient.invalidateQueries({ queryKey: [TEMPLATE_BASE, variables.id] });
      toast({ title: "Draft saved", description: "The saved version is ready for review." });
    },
    onError: (error) => toast({ title: "Could not save draft", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }),
  });
  const activationMutation = useMutation({
    mutationFn: async ({ id, reason, reviewHash }: { id: string; reason: string; reviewHash: string }) => {
      const response = await apiRequest("POST", `${TEMPLATE_BASE}/${encodeURIComponent(id)}/activate`, { reviewed: true, reason, reviewHash });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [TEMPLATE_BASE] });
      await queryClient.invalidateQueries({ queryKey: [TEMPLATE_BASE, selectedId] });
      setActivateTarget(null);
      setActivationReason("");
      setReviewConfirmed(false);
      setActivationReviewHash("");
      toast({ title: "Template activated", description: "The reviewed version is now active." });
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 409 && error.code === "REVIEW_STALE") {
        toast({ title: "Review is stale", description: "The saved template changed after this preview. Reload the version and review a fresh preview before activation.", variant: "destructive" });
        setActivateTarget(null);
        setActivationReviewHash("");
        void queryClient.invalidateQueries({ queryKey: [TEMPLATE_BASE, selectedId] });
        return;
      }
      toast({ title: "Could not activate version", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    },
  });

  const startCreate = (source: TemplateListItem | null = null) => {
    setCreateSource(source);
    setCreateKind(source?.kind ?? "msa");
    setCreateName(source ? source.name : "");
    setCreateVersion(source ? nextVersion(source.version) : "1.0");
    setShowCreate(true);
  };
  function nextVersion(version: string) {
    const numeric = Number(version);
    return Number.isFinite(numeric) ? (numeric + 1).toFixed(version.includes(".") ? Math.max(1, version.split(".")[1].length) : 0) : `${version}-next`;
  }
  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate({ kind: createKind, name: createName.trim(), version: createVersion.trim(), ...(createSource ? { sourceTemplateId: createSource.id } : {}) });
  };
  const preview = useCallback(async (body: string) => {
    const response = await apiRequest("POST", `${TEMPLATE_BASE}/${encodeURIComponent(selectedId!)}/preview`, { body });
    return response.json() as Promise<{ html: string; missingKeys: string[]; unknownKeys: string[]; reviewHash: string }>;
  }, [selectedId]);
  const beginActivation = (reviewHash: string) => {
    if (!selected || selected.status !== "draft") return;
    if (!detailQuery.data?.reviewHash || reviewHash !== detailQuery.data.reviewHash) {
      toast({ title: "Review is stale", description: "The preview no longer matches the saved draft. Wait for a fresh preview before activation.", variant: "destructive" });
      return;
    }
    setActivationReason("");
    setReviewConfirmed(false);
    setActivationReviewHash(reviewHash);
    setActivateTarget(selected);
  };
  const confirmActivation = () => {
    if (!activateTarget || !activationReviewHash || !reviewConfirmed || !activationReason.trim() || activationReason.length > 2000) return;
    activationMutation.mutate({ id: activateTarget.id, reason: activationReason.trim(), reviewHash: activationReviewHash });
  };
  const forbidden = errorStatus(listQuery.error) === 403 || errorStatus(detailQuery.error) === 403;

  return <main className="min-h-[100dvh] bg-[#edf3f1] text-[#203a3e]">
    <div className="mx-auto max-w-[1480px] px-4 pb-12 pt-8 sm:px-7 lg:px-10">
      <header className="mb-7 flex flex-col gap-4 border-b border-[#d3dfdd] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#648184]">OnSpot · Admin controls</p>
          <h1 className="mt-2 font-semibold tracking-[-.035em] text-[#18353a] text-3xl sm:text-[38px]">Contract templates</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#657b7e]">Maintain reviewed agreement versions for the hiring workflow. Drafts are private; activation is deliberate and auditable.</p>
        </div>
        <button type="button" onClick={() => startCreate()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#174c53] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#103c42]"><Plus className="h-4 w-4" />New template</button>
      </header>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kindOrder.map((kind) => <div key={kind} className="flex items-center gap-3 rounded-lg border border-[#d5e0de] bg-[#f8fbfa] px-4 py-3">
          <div className="rounded-md bg-[#e1ecea] p-2 text-[#4b7375]"><FileText className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#355357]">{kindNames[kind]}</p><p className="mt-0.5 text-[11px] text-[#7a8e90]">{items.filter((item) => item.kind === kind).length} versions</p></div>
        </div>)}
      </div>

      {forbidden ? <section className="mx-auto max-w-xl rounded-xl border border-[#e7c8ba] bg-[#fff8f3] px-6 py-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f5e3d8] text-[#9b573e]"><LockKeyhole className="h-5 w-5" /></div><h2 className="mt-4 text-lg font-semibold text-[#663d30]">Super Admin access required</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#835f54]">Your account is not authorized to manage contract templates. Ask a Super Admin to grant access.</p>
      </section> : <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="self-start rounded-lg border border-[#d5e0de] bg-[#f8fbfa] p-3 xl:sticky xl:top-4">
          <div className="flex items-center justify-between px-2 pb-3 pt-1"><div><h2 className="text-sm font-semibold text-[#29464a]">Version library</h2><p className="text-[11px] text-[#7a8e90]">Select a version to inspect</p></div><button type="button" title="Refresh templates" onClick={() => void listQuery.refetch()} className="rounded p-2 text-[#648184] hover:bg-[#e7efed]"><RefreshCw className="h-4 w-4" /></button></div>
          {listQuery.isLoading ? <div className="space-y-2 p-1">{[1, 2, 3].map((item) => <div key={item} className="h-[74px] animate-pulse rounded-md bg-[#e5edeb]" />)}</div> :
            listQuery.isError ? <div className="m-1 rounded-md border border-[#e5c5bb] bg-[#fff7f2] p-3 text-xs text-[#8a4d3b]"><AlertCircle className="mr-1 inline h-4 w-4" />Could not load templates. <button onClick={() => void listQuery.refetch()} className="font-semibold underline">Retry</button>{errorStatus(listQuery.error) === 403 && <p className="mt-2 font-semibold">Super Admin access is required.</p>}</div> :
              items.length === 0 ? <div className="rounded-md border border-dashed border-[#cddbd8] px-4 py-8 text-center"><FilePlus2 className="mx-auto h-6 w-6 text-[#809799]" /><p className="mt-3 text-sm font-semibold text-[#456064]">No versions yet</p><p className="mt-1 text-xs leading-relaxed text-[#7a8e90]">Create a draft to begin organizing a reviewed agreement.</p><button type="button" onClick={() => startCreate()} className="mt-4 text-xs font-semibold text-[#23656a] hover:underline">Create first template</button></div> :
              <div className="max-h-[68vh] space-y-1 overflow-y-auto pr-1">{kindOrder.map((kind) => {
                const grouped = items.filter((item) => item.kind === kind);
                return grouped.length ? <section key={kind} className="pt-2"><p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#819395]">{kindNames[kind]}</p>{grouped.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`mb-1 block w-full rounded-md border px-3 py-3 text-left transition ${selectedId === item.id ? "border-[#8caead] bg-[#e9f2f0] shadow-sm" : "border-transparent hover:border-[#dae4e2] hover:bg-white"}`}>
                  <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#29464a]">{item.name}</span><span className="mt-1 block text-[11px] text-[#7b8f91]">Version {item.version} · {dateLabel(item.createdAt)}</span></span><StatusChip status={item.status} /></span>
                </button>)}</section> : null;
              })}</div>}
        </aside>
        <section className="min-w-0 rounded-lg border border-[#d5e0de] bg-[#f8fbfa] p-4 sm:p-6">
          {!selected ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><Tag className="h-7 w-7 text-[#8aa0a0]" /><h2 className="mt-3 font-semibold text-[#355357]">Choose a template version</h2><p className="mt-1 max-w-xs text-xs leading-relaxed text-[#7a8e90]">Details, field rules, and the sample preview will appear here.</p></div> :
            detailQuery.isLoading ? <div className="space-y-4"><div className="h-16 animate-pulse rounded bg-[#e5edeb]" /><div className="h-80 animate-pulse rounded bg-[#e5edeb]" /></div> :
              detailQuery.isError ? <div className="rounded-md border border-[#e5c5bb] bg-[#fff7f2] p-5 text-sm text-[#8a4d3b]"><AlertCircle className="mr-2 inline h-4 w-4" />Could not load version details. <button type="button" onClick={() => void detailQuery.refetch()} className="font-semibold underline">Retry</button>{errorStatus(detailQuery.error) === 403 && <p className="mt-2">Super Admin access is required.</p>}</div> :
                detailQuery.data && <div className="space-y-5">
                  <div className="flex flex-col gap-4 border-b border-[#dbe4e2] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-[#e6eeec] px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#607a7d]">{kindNames[detailQuery.data.kind]}</span><StatusChip status={detailQuery.data.status} /></div><h2 className="mt-2 break-words text-xl font-semibold tracking-tight text-[#203e42]">{detailQuery.data.name}</h2><p className="mt-1 text-xs text-[#7b8f91]">Version {detailQuery.data.version} · Created {dateLabel(detailQuery.data.createdAt)}{detailQuery.data.activatedAt ? ` · Activated ${dateLabel(detailQuery.data.activatedAt)}` : ""}</p>
                      {detailQuery.data.activationReason && <p className="mt-2 max-w-2xl border-l-2 border-[#9dbab4] pl-3 text-xs leading-relaxed text-[#687e80]">Review record: {detailQuery.data.activationReason}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {detailQuery.data.status !== "draft" && <button type="button" onClick={() => startCreate(detailQuery.data)} className="inline-flex items-center gap-2 rounded-md border border-[#c8d8d6] bg-white px-3 py-2 text-xs font-semibold text-[#365b5f] hover:bg-[#f1f6f5]"><FilePlus2 className="h-3.5 w-3.5" />New version from this</button>}
                    </div>
                  </div>
                  {detailQuery.data.status === "draft" ? <ContractTemplateEditor key={detailQuery.data.id} templateId={detailQuery.data.id} initialName={detailQuery.data.name} initialBody={detailQuery.data.body ?? ""} initialFields={detailQuery.data.fields ?? []} registry={registry} reviewHash={detailQuery.data.reviewHash} onSave={(data) => saveMutation.mutateAsync({ id: detailQuery.data!.id, data })} onPreview={preview} onActivate={beginActivation} activating={activationMutation.isPending} /> :
                    <div className="rounded-md border border-[#d3e0de] bg-[#f2f7f5] p-5 sm:p-7">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="rounded-lg bg-[#e1ece9] p-3 text-[#527a78]"><ShieldCheck className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#345357]">{detailQuery.data.status === "active" ? "Current approved version" : "Retired version"}</h3><p className="mt-1 max-w-xl text-sm leading-relaxed text-[#718587]">Activated and retired versions are immutable. Start a new version to make edits; the selected template will be cloned into a private draft.</p><button type="button" onClick={() => startCreate(detailQuery.data)} className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#174c53] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#103c42]">Create editable version <ArrowRight className="h-3.5 w-3.5" /></button></div></div>
                    </div>}
                </div>}
        </section>
      </div>}
    </div>

    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#15373c]/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="create-template-title" className="w-full max-w-lg rounded-xl border border-[#d0ddda] bg-[#f9fbfa] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#71888a]">{createSource ? "Clone source into new draft" : "New agreement"}</p><h2 id="create-template-title" className="mt-1 text-xl font-semibold text-[#203e42]">{createSource ? "Create a new version" : "Create template draft"}</h2></div><button type="button" aria-label="Close" onClick={() => setShowCreate(false)} className="rounded p-1.5 text-[#688083] hover:bg-[#e9f0ee]"><X className="h-4 w-4" /></button></div>
        {createSource && <p className="mt-3 rounded-md bg-[#e9f1ef] p-3 text-xs leading-relaxed text-[#5d7476]">A copy of <strong>{createSource.name}, version {createSource.version}</strong> will be created. The source remains unchanged.</p>}
        <form onSubmit={submitCreate} className="mt-5 space-y-4">
          <label className="block text-xs font-semibold text-[#456064]">Agreement type<select value={createKind} onChange={(event) => setCreateKind(event.target.value as TemplateKind)} disabled={!!createSource} className="mt-1.5 block w-full rounded-md border border-[#cbd9db] bg-white px-3 py-2.5 text-sm font-normal disabled:bg-[#edf2f1]">{kindOrder.map((kind) => <option key={kind} value={kind}>{kindNames[kind]}</option>)}</select></label>
          <label className="block text-xs font-semibold text-[#456064]">Template name<input value={createName} onChange={(event) => setCreateName(event.target.value)} maxLength={180} required className="mt-1.5 block w-full rounded-md border border-[#cbd9db] bg-white px-3 py-2.5 text-sm font-normal" placeholder="e.g. OnSpot Master Services Agreement" /></label>
          <label className="block text-xs font-semibold text-[#456064]">Version<input value={createVersion} onChange={(event) => setCreateVersion(event.target.value)} maxLength={80} required className="mt-1.5 block w-full rounded-md border border-[#cbd9db] bg-white px-3 py-2.5 text-sm font-normal" placeholder="e.g. 1.0" /></label>
          <div className="flex items-center gap-2 rounded-md border border-[#d9e4e2] bg-[#f1f6f4] p-3 text-[11px] leading-relaxed text-[#657b7d]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#5d8580]" />This creates a draft only. No agreement is sent or generated.</div>
          <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-[#cfdbda] px-3.5 py-2 text-xs font-semibold text-[#557073] hover:bg-white">Cancel</button><button type="submit" disabled={!createName.trim() || !createVersion.trim() || createMutation.isPending} className="rounded-md bg-[#174c53] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{createMutation.isPending ? "Creating…" : "Create draft"}</button></div>
        </form>
      </section>
    </div>}

    {activateTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#15373c]/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivateTarget(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="activate-template-title" className="w-full max-w-lg rounded-xl border border-[#d0ddda] bg-[#f9fbfa] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start gap-3"><div className="rounded-lg bg-[#e5efeb] p-2.5 text-[#527a70]"><ShieldCheck className="h-5 w-5" /></div><div><h2 id="activate-template-title" className="text-lg font-semibold text-[#203e42]">Review and activate</h2><p className="mt-1 text-xs leading-relaxed text-[#718587]">Activation makes this template the approved current version. Confirm legal review before continuing.</p></div></div>
        <div className="mt-4 rounded-md border border-[#d9e4e2] bg-white p-3"><p className="text-sm font-semibold text-[#355357]">{activateTarget.name}</p><p className="mt-1 text-xs text-[#7b8f91]">{kindNames[activateTarget.kind]} · Version {activateTarget.version}</p></div>
        <label className="mt-4 block text-xs font-semibold text-[#456064]">Review and activation reason <span className="font-normal text-[#809395]">({activationReason.length}/2000)</span><textarea value={activationReason} onChange={(event) => setActivationReason(event.target.value.slice(0, 2000))} maxLength={2000} rows={4} placeholder="Record who or what reviewed this version and why it is approved." className="mt-1.5 block w-full resize-y rounded-md border border-[#cbd9db] bg-white px-3 py-2.5 text-sm font-normal leading-relaxed outline-none focus:border-[#34757b] focus:ring-2 focus:ring-[#34757b]/15" /></label>
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[#536d70]"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-0.5 accent-[#1b6066]" /><span>I confirm this draft was reviewed and is approved for use.</span></label>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setActivateTarget(null)} className="rounded-md border border-[#cfdbda] px-3.5 py-2 text-xs font-semibold text-[#557073] hover:bg-white">Cancel</button><button type="button" onClick={confirmActivation} disabled={!activationReason.trim() || !reviewConfirmed || activationMutation.isPending} className="rounded-md bg-[#174c53] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{activationMutation.isPending ? "Activating…" : "Confirm activation"}</button></div>
      </section>
    </div>}
  </main>;
}

function StatusChip({ status }: { status: TemplateStatus }) {
  const statusStyle: Record<TemplateStatus, string> = { draft: "bg-[#f4ecd8] text-[#886929]", active: "bg-[#dff0e8] text-[#3b735f]", retired: "bg-[#e8eceb] text-[#718083]" };
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${statusStyle[status]}`}>{status === "active" && <CheckCircle2 className="h-3 w-3" />}{status}</span>;
}
