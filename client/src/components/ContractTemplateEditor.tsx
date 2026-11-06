import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";
import DOMPurify from "dompurify";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Quote, Underline, Braces, Check, Save, Eye, AlertTriangle, LoaderCircle } from "lucide-react";
import "./contract-template-editor.css";

export type TemplateField = {
  key: string;
  label: string;
  source: string;
  required: boolean;
  editableBy: "admin" | "preparer" | "none";
};
export type MergeField = Omit<TemplateField, "required"> & { required?: boolean };

export const TEMPLATE_BASE = "/api/admin/contract-templates";
export const sanitizeContractHtml = (html: string) => {
  const safe = DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ["section", "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "span"],
  ALLOWED_ATTR: ["data-clause-id", "colspan", "rowspan"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "a", "img"],
  FORBID_ATTR: ["style", "src", "href"],
  });
  if (typeof document === "undefined") return safe;
  const template = document.createElement("template");
  template.innerHTML = safe;
  template.content.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const allowed = (attribute.name === "data-clause-id" && ["SECTION", "P"].includes(element.tagName)) ||
        (["colspan", "rowspan"].includes(attribute.name) && ["TD", "TH"].includes(element.tagName) && /^\d{1,3}$/.test(attribute.value));
      if (!allowed) element.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
};

type Props = {
  templateId: string;
  initialName: string;
  initialBody: string;
  initialFields: TemplateField[];
  registry: MergeField[];
  reviewHash: string;
  onSave: (data: { name: string; body: string; fields: TemplateField[] }) => Promise<void>;
  onPreview: (body: string) => Promise<{ html: string; missingKeys: string[]; unknownKeys: string[]; reviewHash: string }>;
  onActivate: (reviewHash: string) => void;
  activating: boolean;
};

const editableValues: TemplateField["editableBy"][] = ["admin", "preparer", "none"];

export function ContractTemplateEditor({ templateId, initialName, initialBody, initialFields, registry, reviewHash, onSave, onPreview, onActivate, activating }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const initializedId = useRef("");
  const [name, setName] = useState(initialName);
  const [body, setBody] = useState(sanitizeContractHtml(initialBody));
  const [fields, setFields] = useState(initialFields);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ html: string; missingKeys: string[]; unknownKeys: string[]; reviewHash: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequence = useRef(0);
  const snapshot = (n: string, b: string, f: TemplateField[]) => JSON.stringify([n, b, f]);
  const dirty = snapshot(name, body, fields) !== savedSnapshot;
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!templateId || initializedId.current === templateId) return;
    initializedId.current = templateId;
    const safeBody = sanitizeContractHtml(initialBody);
    setName(initialName);
    setBody(safeBody);
    setFields(initialFields);
    setSavedSnapshot(snapshot(initialName, safeBody, initialFields));
    setPreviewResult(null);
    setPreviewError("");
  }, [templateId, initialName, initialBody, initialFields]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== body) editorRef.current.innerHTML = body;
  }, [body, templateId]);

  const requestPreview = useCallback((html: string) => {
    const seq = ++requestSequence.current;
    setPreviewLoading(true);
    setPreviewError("");
    void onPreview(html).then((result) => {
      if (seq === requestSequence.current) setPreviewResult({ ...result, html: sanitizeContractHtml(result.html) });
    }).catch((error: unknown) => {
      if (seq === requestSequence.current) setPreviewError(error instanceof Error ? error.message : "Preview could not be generated.");
    }).finally(() => {
      if (seq === requestSequence.current) setPreviewLoading(false);
    });
  }, [onPreview]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => requestPreview(body), 650);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [body, reviewHash, previewEpoch, requestPreview]);

  const captureSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };
  const applyCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    captureSelection();
    if (editorRef.current) setBody(sanitizeContractHtml(editorRef.current.innerHTML));
  };
  const insertField = (key: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selection && selectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    const activeSelection = window.getSelection();
    if (activeSelection?.rangeCount && editor.contains(activeSelection.anchorNode)) {
      const range = activeSelection.getRangeAt(0);
      range.deleteContents();
      const text = document.createTextNode(`{{${key}}}`);
      range.insertNode(text);
      range.setStartAfter(text);
      range.collapse(true);
      activeSelection.removeAllRanges();
      activeSelection.addRange(range);
    } else {
      editor.appendChild(document.createTextNode(`{{${key}}}`));
    }
    captureSelection();
    setBody(sanitizeContractHtml(editor.innerHTML));
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    captureSelection();
    if (editorRef.current) setBody(sanitizeContractHtml(editorRef.current.innerHTML));
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    if (text) document.execCommand("insertText", false, text);
    captureSelection();
    if (editorRef.current) setBody(sanitizeContractHtml(editorRef.current.innerHTML));
  };

  const save = async () => {
    setSaving(true);
    try {
      const safeBody = sanitizeContractHtml(body);
      await onSave({ name: name.trim(), body: safeBody, fields });
      setName(name.trim());
      setBody(safeBody);
      setSavedSnapshot(snapshot(name.trim(), safeBody, fields));
      setPreviewEpoch((epoch) => epoch + 1);
    } finally { setSaving(false); }
  };
  const updateField = (key: string, update: Partial<TemplateField>) => {
    setFields((current) => current.map((field) => field.key === key ? { ...field, ...update } : field));
  };
  const ensureField = (item: MergeField) => {
    setFields((current) => current.some((field) => field.key === item.key) ? current : [...current, { ...item, required: item.required ?? false, editableBy: item.editableBy }]);
  };
  const previewIsCurrent = !!previewResult && previewResult.reviewHash === reviewHash && !previewLoading;
  const canActivate = !dirty && !saving && !activating && previewIsCurrent && previewResult?.unknownKeys.length === 0;

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 border-b border-[#d9e2e4] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#668184]">Draft workspace</p>
        <h2 className="mt-1 text-xl font-semibold text-[#18353a]">Edit agreement content</h2>
        <p className="mt-1 text-xs text-[#6b8082]">Changes stay private until saved and explicitly reviewed.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => previewResult && onActivate(previewResult.reviewHash)} disabled={!canActivate} title={!previewIsCurrent ? "Wait for a current preview before activation." : previewResult?.unknownKeys.length ? "Remove unregistered merge fields before activation." : undefined} className="inline-flex items-center gap-2 rounded-md border border-[#183f45] px-3 py-2 text-sm font-semibold text-[#183f45] disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" />Review & activate</button>
        <button type="button" onClick={() => void save()} disabled={!dirty || !name.trim() || saving} className="inline-flex items-center gap-2 rounded-md bg-[#174c53] px-3 py-2 text-sm font-semibold text-white hover:bg-[#103c42] disabled:cursor-not-allowed disabled:opacity-40">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save draft</button>
      </div>
    </header>
    {dirty && <p className="flex items-center gap-2 rounded-md bg-[#fbf2df] px-3 py-2 text-xs text-[#775b1c]"><AlertTriangle className="h-4 w-4 shrink-0" />Unsaved changes. Save this draft before review and activation.</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,.92fr)]">
      <section className="min-w-0 space-y-4">
        <label className="block text-sm font-semibold text-[#29464a]">Template name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={180} className="mt-1.5 block w-full rounded-md border border-[#cbd9db] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#34757b] focus:ring-2 focus:ring-[#34757b]/15" />
        </label>
        <div className="overflow-hidden rounded-lg border border-[#cbd9db] bg-white">
          <div className="flex flex-wrap items-center gap-1 border-b border-[#e1e8e8] bg-[#f4f8f7] p-2" aria-label="Editor formatting">
            {[
              ["Bold", "bold", <Bold className="h-4 w-4" />],
              ["Italic", "italic", <Italic className="h-4 w-4" />],
              ["Underline", "underline", <Underline className="h-4 w-4" />],
              ["Heading 2", "formatBlock", <Heading2 className="h-4 w-4" />, "h2"],
              ["Heading 3", "formatBlock", <Heading3 className="h-4 w-4" />, "h3"],
              ["Bulleted list", "insertUnorderedList", <List className="h-4 w-4" />],
              ["Numbered list", "insertOrderedList", <ListOrdered className="h-4 w-4" />],
              ["Quote", "formatBlock", <Quote className="h-4 w-4" />, "blockquote"],
            ].map(([label, command, icon, value]) => <button key={String(label)} type="button" title={String(label)} aria-label={String(label)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand(String(command), value ? String(value) : undefined)} className="rounded p-2 text-[#466266] hover:bg-[#e4eeec]">{icon}</button>)}
            <details className="relative ml-auto">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-[#cbd9db] bg-white px-2.5 py-2 text-xs font-semibold text-[#31565a]"><Braces className="h-3.5 w-3.5" />Insert field</summary>
              <div className="absolute right-0 z-20 mt-2 max-h-72 w-[min(320px,85vw)] overflow-auto rounded-lg border border-[#cfdbdc] bg-white p-2 shadow-xl">
                {registry.map((field) => <button key={field.key} type="button" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { insertField(field.key); (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }} className="block w-full rounded px-2.5 py-2 text-left hover:bg-[#f0f6f5]"><span className="block text-sm font-medium text-[#29464a]">{field.label}</span><code className="text-[11px] text-[#648083]">{`{{${field.key}}}`}</code></button>)}
                {!registry.length && <p className="p-3 text-xs text-[#6b8082]">No registered fields returned.</p>}
              </div>
            </details>
          </div>
          <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Agreement body" aria-multiline="true" onInput={(event) => { captureSelection(); setBody(sanitizeContractHtml(event.currentTarget.innerHTML)); }} onKeyUp={captureSelection} onMouseUp={captureSelection} onPaste={handlePaste} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()} className="contract-template-edit min-h-[480px] px-5 py-6 text-[14px] leading-7 text-[#29464a] outline-none" />
        </div>
        <p className="text-[11px] leading-relaxed text-[#74888a]">Tables and paragraph structure are preserved. Pasted content is plain text; links, images, scripts, and inline styles are not accepted.</p>
      </section>
      <section className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div><h3 className="text-sm font-semibold text-[#29464a]">Field rules</h3><p className="text-xs text-[#74888a]">Canonical source is fixed by the registry.</p></div>
          <span className="rounded-full bg-[#e7f0ef] px-2.5 py-1 text-[10px] font-semibold text-[#3c696c]">{fields.length} configured</span>
        </div>
        <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
          {registry.map((item) => {
            const field = fields.find((candidate) => candidate.key === item.key);
            return <div key={item.key} className="rounded-md border border-[#d9e2e4] bg-white p-3">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-[#29464a]">{item.label}</p><code className="text-[10px] text-[#71878a]">{item.key}</code><p className="mt-1 text-[11px] text-[#74888a]">Source · {item.source}</p></div>
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-[#4c6265]"><input type="checkbox" checked={field?.required ?? false} disabled={!field} onChange={(event) => { if (!field) ensureField(item); updateField(item.key, { required: event.target.checked }); }} />Required</label>
              </div>
              <div className="mt-2 flex items-center gap-2"><label htmlFor={`editable-${item.key}`} className="text-[11px] text-[#74888a]">Editable by</label><select id={`editable-${item.key}`} value={field?.editableBy ?? "none"} onChange={(event) => { if (!field) ensureField(item); updateField(item.key, { editableBy: event.target.value as TemplateField["editableBy"] }); }} className="rounded border border-[#d3dfe0] bg-white px-2 py-1 text-xs text-[#29464a]">{editableValues.map((value) => <option key={value} value={value}>{value === "none" ? "No one" : value === "admin" ? "Admin" : "Preparer"}</option>)}</select>
                {!field && <button type="button" onClick={() => ensureField(item)} className="ml-auto text-[11px] font-semibold text-[#23656a] hover:underline">Add rule</button>}
              </div>
            </div>;
          })}
        </div>
        <div className="overflow-hidden rounded-lg border border-[#d9e2e4] bg-[#eef4f2]">
          <div className="flex items-center justify-between border-b border-[#d9e2e4] px-4 py-3"><div><h3 className="text-sm font-semibold text-[#29464a]">Sample preview</h3><p className="text-[11px] text-[#74888a]">Synthetic values only · no account data</p></div><span className="inline-flex items-center gap-1 text-[10px] text-[#698083]"><Eye className="h-3.5 w-3.5" />Live</span></div>
          <div className="bg-[#dce7e5] p-3">
            {previewLoading && !previewResult ? <div className="h-[300px] animate-pulse rounded bg-white/80" /> : previewError ? <div className="rounded bg-[#fff7ea] p-3 text-xs text-[#775b1c]">{previewError} <button type="button" onClick={() => requestPreview(body)} className="ml-1 underline">Retry</button></div> : previewResult ? <>
              {(previewResult.missingKeys.length > 0 || previewResult.unknownKeys.length > 0) && <div className="mb-2 rounded bg-[#fff7ea] px-3 py-2 text-[11px] text-[#775b1c]">{previewResult.missingKeys.length > 0 && <p>Missing values: {previewResult.missingKeys.join(", ")}</p>}{previewResult.unknownKeys.length > 0 && <p>Unregistered fields: {previewResult.unknownKeys.join(", ")}</p>}</div>}
              <iframe title="Agreement preview using sample data" sandbox="" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px/1.65 Georgia,serif;color:#263d40;background:#fff;max-width:720px;margin:0 auto;padding:36px 30px}h1,h2,h3,h4{line-height:1.25}table{width:100%;border-collapse:collapse;margin:1em 0}td,th{border:1px solid #cbd5d6;padding:7px;text-align:left}blockquote{border-left:3px solid #8ba7a5;margin-left:0;padding-left:14px;color:#526d70}section{margin:1.5em 0}</style></head><body>${previewResult.html}</body></html>`} className="h-[min(55vh,620px)] min-h-[340px] w-full rounded border border-[#cbd9db] bg-white" />
            </> : <div className="flex h-[340px] items-center justify-center rounded bg-white text-xs text-[#74888a]">Preparing sample preview…</div>}
          </div>
          {(previewLoading || (previewResult && previewResult.reviewHash !== reviewHash)) && <p className="px-4 py-2 text-[10px] text-[#74888a]">Updating sample preview for the current saved version…</p>}
        </div>
      </section>
    </div>
  </div>;
}
