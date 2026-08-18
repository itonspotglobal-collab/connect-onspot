/**
 * ResumeImportReviewPanel.tsx
 *
 * Slide-over panel shown after Vanessa analyzes a resume and auto-fills profile
 * fields. Shows each populated field, the imported value alongside what was
 * there before, and a per-field confidence indicator. Low-confidence fields
 * (0.60–0.79) are visually distinguished so talent knows to review carefully.
 *
 * Used by both Talent Profile and Profile Settings resume-upload flows; the
 * host page supplies onEditField to route the talent to the right editor.
 */

import { useEffect } from "react";
import { X, Check, Pencil, Sparkles, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ResumeReviewField } from "@/lib/applyResumeToCandidate";

// ─── Labels ───────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  fullName: "Name",
  phone: "Phone",
  location: "Location",
  targetPosition: "Professional Title",
  summary: "Bio / About",
  coreSkills: "Core Skills",
  secondarySkills: "Secondary Skills",
  workHistory: "Work Experience",
  education: "Education",
  certifications: "Certifications",
  languages: "Languages",
};

// ─── Value rendering helpers ──────────────────────────────────────────────────

type AnyEntry = Record<string, unknown>;

function entryKey(field: string, e: AnyEntry): string {
  const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (field === "workHistory") return `${norm(e.jobTitle ?? e.title)}|${norm(e.company)}`;
  if (field === "education") return `${norm(e.school)}|${norm(e.degree)}`;
  return norm(e.name);
}

function entryLabel(field: string, e: AnyEntry): string {
  if (field === "workHistory") {
    const t = String(e.jobTitle ?? e.title ?? "").trim();
    const c = String(e.company ?? "").trim();
    return [t, c].filter(Boolean).join(" — ") || "Untitled role";
  }
  if (field === "education") {
    const d = String(e.degree ?? "").trim();
    const s = String(e.school ?? "").trim();
    return [d, s].filter(Boolean).join(" — ") || "Untitled entry";
  }
  return String(e.name ?? "").trim() || "Untitled";
}

/**
 * For array fields, compute only the items Vanessa newly added
 * (importedValue is the post-merge array; previousValue is what existed).
 */
function newlyAdded(field: string, imported: unknown, previous: unknown): string[] {
  const imp = Array.isArray(imported) ? imported : [];
  const prev = Array.isArray(previous) ? previous : [];
  if (imp.length === 0) return [];
  if (typeof imp[0] === "string" || imp.every((v) => typeof v === "string")) {
    const prevSet = new Set((prev as string[]).map((s) => String(s).toLowerCase().trim()));
    return (imp as string[]).filter((s) => !prevSet.has(String(s).toLowerCase().trim()));
  }
  const prevKeys = new Set((prev as AnyEntry[]).map((e) => entryKey(field, e)));
  return (imp as AnyEntry[])
    .filter((e) => !prevKeys.has(entryKey(field, e)))
    .map((e) => entryLabel(field, e));
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function confidenceMeta(confidence: number | null) {
  if (confidence === null) {
    return { label: "Auto-detected", cls: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300", low: false };
  }
  if (confidence >= 0.8) {
    return { label: "High confidence", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", low: false };
  }
  if (confidence >= 0.6) {
    return { label: "Review carefully", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", low: true };
  }
  return { label: "Low confidence", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", low: true };
}

// ─── Field card ───────────────────────────────────────────────────────────────

function FieldCard({
  item,
  onEdit,
}: {
  item: ResumeReviewField;
  onEdit?: (field: string) => void;
}) {
  const label = FIELD_LABELS[item.field] ?? item.field;
  const meta = confidenceMeta(item.confidence);
  const isArray = Array.isArray(item.importedValue);

  let body: React.ReactNode;
  if (isArray) {
    const added = newlyAdded(item.field, item.importedValue, item.previousValue);
    body =
      added.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {added.slice(0, 12).map((v, i) => (
            <span
              key={i}
              className="rounded-full bg-[#474ead]/8 px-2 py-0.5 text-xs text-[#474ead] dark:bg-indigo-400/10 dark:text-indigo-300"
            >
              {v}
            </span>
          ))}
          {added.length > 12 && (
            <span className="text-xs text-slate-400">+{added.length - 12} more</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Merged with your existing entries.</p>
      );
  } else {
    const prev = typeof item.previousValue === "string" ? item.previousValue.trim() : "";
    body = (
      <div className="space-y-1.5">
        {prev && prev !== String(item.importedValue ?? "").trim() && (
          <p className="text-xs text-slate-400 line-through break-words">{prev}</p>
        )}
        <p className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap line-clamp-4">
          {String(item.importedValue ?? "")}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid={`review-field-${item.field}`}
      className={[
        "rounded-xl border p-3.5",
        meta.low
          ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-400/30 dark:bg-amber-500/5"
          : "border-slate-200/70 bg-white dark:border-white/10 dark:bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
          <Badge variant="secondary" className={`h-5 rounded-full px-2 text-[10px] font-medium ${meta.cls}`}>
            {meta.low && <AlertTriangle className="mr-1 h-3 w-3" />}
            {meta.label}
            {item.confidence !== null && ` · ${Math.round(item.confidence * 100)}%`}
          </Badge>
        </div>
        {onEdit && (
          <button
            onClick={() => onEdit(item.field)}
            data-testid={`button-review-edit-${item.field}`}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#474ead] transition hover:bg-[#474ead]/10 dark:text-indigo-300 dark:hover:bg-indigo-400/10"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      {body}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ResumeImportReviewPanel({
  open,
  onClose,
  fields,
  analysisSource,
  onEditField,
}: {
  open: boolean;
  onClose: () => void;
  fields: ResumeReviewField[];
  analysisSource: "vanessa" | "deterministic";
  /** Route the talent to the editor for a field. The panel closes first. */
  onEditField?: (field: string) => void;
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const lowCount = fields.filter(
    (f) => f.confidence !== null && f.confidence < 0.8,
  ).length;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Review resume import">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      {/* Slide-over */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:bg-[#0b0e1f]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#474ead]/10">
              {analysisSource === "vanessa"
                ? <Sparkles className="h-4 w-4 text-[#474ead]" />
                : <FileText className="h-4 w-4 text-[#474ead]" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {analysisSource === "vanessa" ? "Vanessa filled in your profile" : "We filled in your profile"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {fields.length} field{fields.length === 1 ? "" : "s"} updated from your resume.
                {lowCount > 0 && ` ${lowCount} may need a closer look.`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Dismiss"
            data-testid="button-review-close"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Field list */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {fields.map((item) => (
            <FieldCard key={item.field} item={item} onEdit={onEditField} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200/70 px-5 py-4 dark:border-white/10">
          <Button
            onClick={onClose}
            data-testid="button-review-looks-good"
            className="w-full rounded-full bg-[#474ead] text-white hover:bg-[#3c418f]"
          >
            <Check className="mr-1.5 h-4 w-4" /> Looks good
          </Button>
        </div>
      </div>
    </div>
  );
}
