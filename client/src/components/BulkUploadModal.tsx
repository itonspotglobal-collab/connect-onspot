import { useState, useRef } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, X as XIcon, CheckCircle2, AlertCircle,
  Loader2, ChevronRight, RefreshCcw, FileSpreadsheet,
  File as FilePdfIcon, Info,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedJobRecord {
  // Core fields
  title: string;
  category: string;
  description: string;
  contractType: string;
  experienceLevel: string;
  location: string;
  // Extended fields
  reportingTo?: string;
  division?: string;
  jobGrade?: string;
  jobLevel?: string;
  companyOverview?: string;
  roleMission?: string;
  responsibilities?: string[];
  requirements?: string[];
  skillTags?: string[];
  culturalFit?: string[];
  // Validation
  _valid: boolean;
  _errors: string[];
  _index: number;
  _selected: boolean;
}

type Stage = "upload" | "parsing" | "preview" | "submitting" | "done";

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "Admin", "Customer success", "Marketing", "Finance",
  "Tech support", "Sales", "Operations", "Design", "Development",
];

// Map department/division text → closest valid DB category
const CATEGORY_MAP: Record<string, string> = {
  admin: "Admin", administrative: "Admin", "admin support": "Admin",
  operations: "Operations", ops: "Operations", delivery: "Operations",
  "customer success": "Customer success", customer: "Customer success",
  cx: "Customer success", support: "Customer success",
  marketing: "Marketing",
  finance: "Finance", accounting: "Finance", financial: "Finance",
  "tech support": "Tech support", technical: "Tech support",
  it: "Tech support", technology: "Tech support",
  development: "Development", dev: "Development", engineering: "Development",
  sales: "Sales", "business development": "Sales",
  design: "Design", creative: "Design",
  hr: "Admin", "human resources": "Admin", recruitment: "Admin",
};

// Map experience-level text → DB value
const EXP_MAP: Record<string, string> = {
  entry: "entry", junior: "entry", "entry level": "entry",
  "entry-level": "entry", "0-2": "entry",
  intermediate: "intermediate", mid: "intermediate", "mid-level": "intermediate",
  "mid level": "intermediate", "2-5": "intermediate",
  expert: "expert", senior: "expert", "senior level": "expert",
  "5+": "expert", lead: "expert", manager: "expert",
};

// Spreadsheet header alias → internal field key
const HEADER_ALIASES: Record<string, keyof ParsedJobRecord> = {
  "job title": "title", title: "title", position: "title", role: "title",
  department: "category", division: "category", team: "category",
  "employment type": "contractType", "job type": "contractType", type: "contractType",
  "work setup": "location", "work arrangement": "location",
  location: "location", "work location": "location",
  "job description": "description", description: "description",
  "about the role": "description", summary: "description",
  qualifications: "requirements", requirements: "requirements",
  responsibilities: "responsibilities", duties: "responsibilities",
  "key responsibilities": "responsibilities",
  "hiring manager": "reportingTo", "reporting to": "reportingTo",
  "reports to": "reportingTo",
  "experience level": "experienceLevel", experience: "experienceLevel",
  seniority: "experienceLevel",
  "skill tags": "skillTags", skills: "skillTags",
  "key skills": "skillTags",
  "cultural fit": "culturalFit", culture: "culturalFit",
  "company overview": "companyOverview",
  "role mission": "roleMission", "job grade": "jobGrade",
  "job level": "jobLevel",
};

// ─── Category / experience normalisation ─────────────────────────────────────

function normaliseCategory(raw: string | undefined): string {
  if (!raw) return "Admin";
  const key = raw.trim().toLowerCase();
  return CATEGORY_MAP[key]
    ?? VALID_CATEGORIES.find((c) => c.toLowerCase() === key)
    ?? VALID_CATEGORIES.find((c) => key.includes(c.toLowerCase()))
    ?? "Admin";
}

function normaliseExperience(raw: string | undefined): string {
  if (!raw) return "entry";
  const key = raw.trim().toLowerCase();
  return EXP_MAP[key]
    ?? (key.includes("senior") || key.includes("lead") || key.includes("expert")
      ? "expert"
      : key.includes("mid") || key.includes("intermediate")
      ? "intermediate"
      : "entry");
}

function normaliseContractType(raw: string | undefined): string {
  if (!raw) return "fixed";
  const k = raw.toLowerCase();
  if (k.includes("hourly") || k.includes("per hour")) return "hourly";
  return "fixed";
}

// Turn a multi-line text block into a clean string array of bullet points
function textToArray(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n|•|·|–|-(?=\s)/)
    .map((l) => l.replace(/^[\s\d.•·–\-*]+/, "").trim())
    .filter((l) => l.length > 4);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRecord(rec: Partial<ParsedJobRecord>, index: number): ParsedJobRecord {
  const errors: string[] = [];
  if (!rec.title?.trim()) errors.push("Missing job title");
  if (!rec.description?.trim()) errors.push("Missing job description");
  if (!rec.category?.trim()) errors.push("Missing department / category");

  return {
    title: rec.title?.trim() ?? "",
    category: normaliseCategory(rec.category),
    description: rec.description?.trim() ?? "",
    contractType: normaliseContractType(rec.contractType),
    experienceLevel: normaliseExperience(rec.experienceLevel),
    location: rec.location?.trim() || "Remote",
    reportingTo: rec.reportingTo?.trim(),
    division: rec.division?.trim(),
    jobGrade: rec.jobGrade?.trim(),
    jobLevel: rec.jobLevel?.trim(),
    companyOverview: rec.companyOverview?.trim(),
    roleMission: rec.roleMission?.trim(),
    responsibilities: rec.responsibilities?.filter(Boolean),
    requirements: rec.requirements?.filter(Boolean),
    skillTags: rec.skillTags?.filter(Boolean),
    culturalFit: rec.culturalFit?.filter(Boolean),
    _valid: errors.length === 0,
    _errors: errors,
    _index: index,
    _selected: errors.length === 0,
  };
}

// ─── CSV / XLSX / XLS Parser ─────────────────────────────────────────────────

async function parseSpreadsheet(file: File): Promise<ParsedJobRecord[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  if (isCsv) {
    return new Promise<ParsedJobRecord[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim().toLowerCase(),
        complete: (results: Papa.ParseResult<Record<string, string>>) => {
          resolve(rowsToRecords(results.data as Record<string, string>[]));
        },
        error: (err: Error) => reject(err),
      });
    });
  }

  // XLSX / XLS — dynamic import to avoid bundling the worker in main chunk
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const rows = rawRows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k.trim().toLowerCase()] = String(v ?? "").trim();
    }
    return out;
  });
  return rowsToRecords(rows);
}

function rowsToRecords(rows: Record<string, string>[]): ParsedJobRecord[] {
  return rows
    .filter((row) => Object.values(row).some((v) => v.trim()))
    .map((row, idx) => {
      const get = (key: keyof ParsedJobRecord) => {
        // check exact alias match first
        for (const [alias, field] of Object.entries(HEADER_ALIASES)) {
          if (field === key && row[alias] !== undefined) return row[alias];
        }
        // then check if any header contains the field name
        for (const [header, value] of Object.entries(row)) {
          if (HEADER_ALIASES[header] === key) return value;
        }
        return undefined;
      };

      const raw: Partial<ParsedJobRecord> = {
        title:           get("title"),
        category:        get("category"),
        description:     get("description"),
        contractType:    get("contractType"),
        experienceLevel: get("experienceLevel"),
        location:        get("location"),
        reportingTo:     get("reportingTo"),
        division:        get("division"),
        jobGrade:        get("jobGrade"),
        jobLevel:        get("jobLevel"),
        companyOverview: get("companyOverview"),
        roleMission:     get("roleMission"),
        responsibilities: textToArray(get("responsibilities")),
        requirements:    textToArray(get("requirements")),
        skillTags:       textToArray(get("skillTags")),
        culturalFit:     textToArray(get("culturalFit")),
      };

      return validateRecord(raw, idx);
    });
}

// ─── PDF Parser ───────────────────────────────────────────────────────────────

// Section labels used in job profile documents
const PDF_SECTION_KEYS = [
  { key: "title",          patterns: ["role:", "job title:", "position:"] },
  { key: "reportingTo",    patterns: ["reporting to:", "reports to:", "reporting line:"] },
  { key: "division",       patterns: ["division:", "department:", "team:"] },
  { key: "jobGrade",       patterns: ["job grade:", "grade:"] },
  { key: "jobLevel",       patterns: ["job level:", "level:"] },
  { key: "companyOverview",patterns: ["company overview"] },
  { key: "description",    patterns: ["about the role", "about the position", "role summary"] },
  { key: "responsibilities",patterns: ["key responsibilities", "responsibilities"] },
  { key: "requirements",   patterns: ["requirements", "qualifications"] },
  { key: "culturalFit",    patterns: ["cultural fit", "culture fit"] },
  { key: "benefits",       patterns: ["why join us", "benefits", "what we offer"] },
  { key: "roleMission",    patterns: ["position overview", "job success profile", "role overview"] },
  { key: "successFactors", patterns: ["additional success factors", "success factors"] },
] as const;

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // Use the CDN worker to avoid complex Vite bundling
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => (item as { str: string }).str)
      .join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

function parseSections(text: string): Record<string, string> {
  const lines = text.split(/\n|\r/).map((l) => l.trim());
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  const accum: string[] = [];

  const flushCurrent = () => {
    if (currentKey) {
      sections[currentKey] = (sections[currentKey]
        ? sections[currentKey] + "\n"
        : "") + accum.join("\n").trim();
    }
    accum.length = 0;
  };

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect known section header
    let matched: string | null = null;
    for (const sec of PDF_SECTION_KEYS) {
      if (sec.patterns.some((p) => lower.startsWith(p) || lower === p.replace(/:$/, ""))) {
        matched = sec.key;
        break;
      }
    }

    if (matched) {
      flushCurrent();
      currentKey = matched;
      // Inline value after colon (e.g., "Role: Senior VA")
      const colonIdx = line.indexOf(":");
      if (colonIdx > -1) {
        const inline = line.slice(colonIdx + 1).trim();
        if (inline) accum.push(inline);
      }
    } else if (line && currentKey) {
      accum.push(line);
    }
  }
  flushCurrent();
  return sections;
}

// Try to detect a standalone job title from the beginning of the document
// (ALL CAPS lines or the first substantial line before any section header)
function detectDocTitle(text: string): string | undefined {
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter((l) => l.length > 2);
  for (const line of lines.slice(0, 8)) {
    const lower = line.toLowerCase();
    const isSectionStart = PDF_SECTION_KEYS.some((s) =>
      s.patterns.some((p) => lower.startsWith(p)),
    );
    if (!isSectionStart && line.length > 4 && line.length < 80) {
      // Looks like a title
      return line;
    }
  }
  return undefined;
}

async function parsePdf(file: File): Promise<ParsedJobRecord[]> {
  const text = await extractPdfText(file);
  const sections = parseSections(text);
  const docTitle = sections["title"] || detectDocTitle(text);

  const description = [
    sections["companyOverview"],
    sections["description"],
    sections["roleMission"],
    sections["successFactors"],
    sections["benefits"],
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const raw: Partial<ParsedJobRecord> = {
    title:           docTitle,
    category:        sections["division"],
    description:     description || sections["roleMission"],
    reportingTo:     sections["reportingTo"],
    division:        sections["division"],
    jobGrade:        sections["jobGrade"],
    jobLevel:        sections["jobLevel"],
    companyOverview: sections["companyOverview"],
    roleMission:     sections["roleMission"],
    responsibilities:textToArray(sections["responsibilities"]),
    requirements:    textToArray(sections["requirements"]),
    culturalFit:     textToArray(sections["culturalFit"]),
    skillTags:       [],
    contractType:    "fixed",
    experienceLevel: sections["jobLevel"],
  };

  return [validateRecord(raw, 0)];
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

async function parseFile(file: File): Promise<ParsedJobRecord[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".xls") || name.endsWith(".xlsx")) {
    return parseSpreadsheet(file);
  }
  if (name.endsWith(".pdf")) {
    return parsePdf(file);
  }
  throw new Error("Unsupported file type. Please upload CSV, XLS, XLSX, or PDF.");
}

// ─── Job API submission ───────────────────────────────────────────────────────

async function submitJob(record: ParsedJobRecord): Promise<void> {
  const body: Record<string, unknown> = {
    title:           record.title,
    description:     record.description,
    category:        record.category,
    contractType:    record.contractType,
    experienceLevel: record.experienceLevel,
    location:        record.location || "Remote",
    status:          "open",
  };

  if (record.responsibilities?.length)  body.responsibilities  = record.responsibilities;
  if (record.requirements?.length)      body.requirements      = record.requirements;
  if (record.skillTags?.length)         body.skillTags         = record.skillTags;
  if (record.culturalFit?.length)       body.culturalFit       = record.culturalFit;
  if (record.reportingTo)               body.reportingTo       = record.reportingTo;
  if (record.division)                  body.division          = record.division;
  if (record.companyOverview)           body.companyOverview   = record.companyOverview;
  if (record.roleMission)               body.roleMission       = record.roleMission;
  if (record.jobLevel)                  body.jobLevel          = record.jobLevel;
  if (record.jobGrade)                  body.jobGrade          = record.jobGrade;

  await apiRequest("POST", "/api/admin/jobs", body);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SubmitSummary {
  succeeded: number;
  failed: number;
  errors: Array<{ title: string; error: string }>;
}

export function BulkUploadModal({ open, onClose, onSuccess }: BulkUploadModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [records, setRecords] = useState<ParsedJobRecord[]>([]);
  const [summary, setSummary] = useState<SubmitSummary | null>(null);
  const [progressCount, setProgressCount] = useState(0);

  function reset() {
    setStage("upload");
    setFile(null);
    setParseError(null);
    setRecords([]);
    setSummary(null);
    setProgressCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleParse() {
    if (!file) return;
    setStage("parsing");
    setParseError(null);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        setParseError("No records were found in the file. Please check the format.");
        setStage("upload");
        return;
      }
      setRecords(parsed);
      setStage("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(msg);
      setStage("upload");
    }
  }

  function toggleSelect(index: number) {
    setRecords((prev) =>
      prev.map((r) =>
        r._index === index ? { ...r, _selected: !r._selected } : r,
      ),
    );
  }

  async function handleSubmit() {
    const selected = records.filter((r) => r._selected && r._valid);
    if (selected.length === 0) return;

    setStage("submitting");
    setProgressCount(0);
    const errors: SubmitSummary["errors"] = [];
    let succeeded = 0;

    for (const record of selected) {
      try {
        await submitJob(record);
        succeeded++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push({ title: record.title, error: msg });
      }
      setProgressCount((c) => c + 1);
    }

    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });

    setSummary({ succeeded, failed: errors.length, errors });
    setStage("done");

    if (succeeded > 0) {
      toast({ title: `${succeeded} job${succeeded > 1 ? "s" : ""} created successfully` });
      onSuccess();
    }
  }

  const validCount    = records.filter((r) => r._valid).length;
  const invalidCount  = records.filter((r) => !r._valid).length;
  const selectedCount = records.filter((r) => r._selected && r._valid).length;

  const fileIcon = file?.name.endsWith(".pdf") ? FilePdfIcon : FileSpreadsheet;
  const FileIcon = fileIcon;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#474ead]/10">
              <Upload className="h-4.5 w-4.5 text-[#474ead]" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white">
                Bulk Upload Job Postings
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload CSV, Excel, or a job profile PDF to create multiple postings at once.
              </p>
            </div>
            {stage !== "upload" && stage !== "parsing" && (
              <button
                onClick={reset}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <RefreshCcw className="h-3 w-3" /> Start over
              </button>
            )}
          </div>

          {/* Stage progress pills */}
          <div className="mt-3 flex gap-2">
            {(["upload", "preview", "done"] as Stage[]).map((s, i) => {
              const isActive  = stage === s || (s === "preview" && stage === "submitting");
              const isDone    = (s === "upload" && stage !== "upload")
                             || (s === "preview" && stage === "done");
              return (
                <div
                  key={s}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    isDone
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                      : isActive
                      ? "bg-[#474ead]/10 text-[#474ead]"
                      : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-current text-center text-[9px] font-bold leading-[14px]">
                      {i + 1}
                    </span>
                  )}
                  {s === "upload" ? "Select File" : s === "preview" ? "Preview" : "Results"}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Stage: upload ── */}
          {(stage === "upload" || stage === "parsing") && (
            <div className="space-y-5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setParseError(null);
                }}
              />

              {/* Drop zone */}
              {!file ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center transition-all hover:border-[#474ead]/40 hover:bg-[#474ead]/3 dark:border-white/10 dark:bg-white/[0.02]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
                    <Upload className="h-6 w-6 text-[#474ead]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Click to upload a file
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Supported formats: CSV, Excel (.xls / .xlsx), PDF
                    </p>
                  </div>
                  <span className="rounded-full border border-[#474ead]/30 bg-white px-4 py-1.5 text-xs font-medium text-[#474ead] shadow-sm dark:bg-[#0f172a]">
                    Choose file
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-4 rounded-2xl border border-[#474ead]/20 bg-[#474ead]/5 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#474ead] text-white">
                    <FileIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {parseError}
                </div>
              )}

              {/* Tip block */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  <Info className="h-3.5 w-3.5" /> Upload Tips
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#474ead]" />
                    <span>
                      <strong>CSV / Excel:</strong> Use headers like{" "}
                      <code className="rounded bg-slate-100 px-1 dark:bg-white/10">Job Title</code>,{" "}
                      <code className="rounded bg-slate-100 px-1 dark:bg-white/10">Department</code>,{" "}
                      <code className="rounded bg-slate-100 px-1 dark:bg-white/10">Job Description</code>,{" "}
                      <code className="rounded bg-slate-100 px-1 dark:bg-white/10">Qualifications</code>,{" "}
                      <code className="rounded bg-slate-100 px-1 dark:bg-white/10">Responsibilities</code>.
                      Each row = one job posting.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FilePdfIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                    <span>
                      <strong>PDF:</strong> Job Success Profile documents with sections like{" "}
                      <em>Role, About the Role, Key Responsibilities, Requirements</em> are
                      automatically parsed. Text-based PDFs only (not scanned images).
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Stage: parsing (spinner) ── */}
          {stage === "parsing" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#474ead]" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Parsing file…</p>
              <p className="mt-1 text-xs text-slate-400">Extracting job records and validating fields.</p>
            </div>
          )}

          {/* ── Stage: preview ── */}
          {stage === "preview" && (
            <div className="space-y-4">
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {records.length} total record{records.length !== 1 ? "s" : ""}
                </span>
                {validCount > 0 && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {validCount} valid
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400">
                    {invalidCount} invalid
                  </span>
                )}
                <span className="rounded-full border border-[#474ead]/20 bg-[#474ead]/8 px-3 py-1 text-xs font-medium text-[#474ead]">
                  {selectedCount} selected
                </span>
              </div>

              {/* Record cards */}
              <div className="space-y-3">
                {records.map((rec) => (
                  <div
                    key={rec._index}
                    className={`rounded-2xl border p-4 transition-all ${
                      rec._valid && rec._selected
                        ? "border-[#474ead]/25 bg-[#474ead]/4"
                        : rec._valid
                        ? "border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#0f172a]/40"
                        : "border-red-200 bg-red-50/40 dark:border-red-800/30 dark:bg-red-900/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {rec._valid && (
                        <button
                          onClick={() => toggleSelect(rec._index)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                            rec._selected
                              ? "border-[#474ead] bg-[#474ead]"
                              : "border-slate-300 dark:border-white/20"
                          }`}
                        >
                          {rec._selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </button>
                      )}
                      {!rec._valid && (
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className={`text-sm font-semibold ${
                            rec.title ? "text-slate-900 dark:text-white" : "text-red-500 italic"
                          }`}>
                            {rec.title || "No title"}
                          </p>
                          <Badge
                            className={`rounded-full text-[10px] ${
                              rec._valid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30"
                                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                            }`}
                          >
                            {rec._valid ? "Valid" : "Invalid"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {rec.category}
                          </span>
                          {rec.experienceLevel && (
                            <span className="capitalize">{rec.experienceLevel}</span>
                          )}
                          {rec.location && <span>{rec.location}</span>}
                        </div>

                        {rec.description && (
                          <p className="mt-1.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                            {rec.description.slice(0, 160)}
                            {rec.description.length > 160 ? "…" : ""}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-2">
                          {(rec.responsibilities?.length ?? 0) > 0 && (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                              {rec.responsibilities!.length} responsibilit{rec.responsibilities!.length === 1 ? "y" : "ies"}
                            </span>
                          )}
                          {(rec.requirements?.length ?? 0) > 0 && (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                              {rec.requirements!.length} requirement{rec.requirements!.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {(rec.culturalFit?.length ?? 0) > 0 && (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                              Cultural fit
                            </span>
                          )}
                        </div>

                        {/* Errors */}
                        {rec._errors.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {rec._errors.map((e) => (
                              <li key={e} className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                                <AlertCircle className="h-3 w-3 shrink-0" /> {e}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Stage: submitting ── */}
          {stage === "submitting" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#474ead]" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Creating job postings…
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {progressCount} of {selectedCount} created
              </p>
              <div className="mt-4 h-2 w-48 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#474ead] transition-all duration-300"
                  style={{ width: `${(progressCount / Math.max(selectedCount, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Stage: done ── */}
          {stage === "done" && summary && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center text-center pb-4">
                {summary.succeeded > 0 ? (
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                ) : (
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {summary.succeeded > 0 ? "Upload Complete" : "Upload Failed"}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-white/[0.08] dark:bg-[#0f172a]/60">
                  <p className="text-2xl font-bold text-[#474ead]">{selectedCount}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Attempted</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800/30 dark:bg-emerald-900/20">
                  <p className="text-2xl font-bold text-emerald-600">{summary.succeeded}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Created</p>
                </div>
                {summary.failed > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-800/30 dark:bg-red-900/20">
                    <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Failed</p>
                  </div>
                )}
              </div>

              {summary.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Failures</p>
                  {summary.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs dark:border-red-800/30 dark:bg-red-900/10">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{e.title}:</span>
                      <span className="text-slate-600 dark:text-slate-400">{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0f172a]">
          {(stage === "upload" || stage === "parsing") && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={handleClose} className="rounded-full">
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={!file || stage === "parsing"}
                className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c] disabled:opacity-40"
              >
                {stage === "parsing" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing…</>
                ) : (
                  <>Upload and Preview <ChevronRight className="ml-1 h-4 w-4" /></>
                )}
              </Button>
            </div>
          )}

          {stage === "preview" && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={handleClose} className="rounded-full">
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setStage("upload"); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="rounded-full"
                >
                  Change File
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={selectedCount === 0}
                  className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c] disabled:opacity-40"
                >
                  Confirm Bulk Create ({selectedCount})
                </Button>
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className="flex justify-end">
              <Button onClick={handleClose} className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
