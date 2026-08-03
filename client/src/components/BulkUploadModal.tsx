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
  Upload, X as XIcon, CheckCircle2, AlertCircle,
  Loader2, ChevronRight, RefreshCcw, FileSpreadsheet,
  File as FileGeneric, Info, FileText,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedJobRecord {
  title: string;
  professionalRoleName?: string;
  originalRoleName?: string;
  jobFunction?: string;
  category: string;
  description: string;
  contractType: string;
  experienceLevel: string;
  location: string;
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
  _valid: boolean;
  _errors: string[];
  _index: number;
  _selected: boolean;
  _source: string;
}

type Stage = "upload" | "parsing" | "preview" | "submitting" | "done";

interface FileResult {
  file: File;
  records: ParsedJobRecord[];
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "Admin", "Customer success", "Marketing", "Finance",
  "Tech support", "Sales", "Operations", "Design", "Development",
];

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

const EXP_MAP: Record<string, string> = {
  entry: "entry", junior: "entry", "entry level": "entry",
  "entry-level": "entry", "0-2": "entry",
  intermediate: "intermediate", mid: "intermediate", "mid-level": "intermediate",
  "mid level": "intermediate", "2-5": "intermediate",
  expert: "expert", senior: "expert", "senior level": "expert",
  "5+": "expert", lead: "expert", manager: "expert",
};

const HEADER_ALIASES: Record<string, keyof ParsedJobRecord> = {
  "job title": "title", title: "title", position: "title", role: "title",
  "professional role name": "professionalRoleName", "professional role": "professionalRoleName",
  "original role": "originalRoleName", "original role name": "originalRoleName",
    "alternative role": "originalRoleName", "original title": "originalRoleName",
  "function": "jobFunction", "job function": "jobFunction",
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
  "skill tags": "skillTags", skills: "skillTags", "key skills": "skillTags",
  "cultural fit": "culturalFit", culture: "culturalFit",
  "company overview": "companyOverview",
  "role mission": "roleMission", "job grade": "jobGrade", "job level": "jobLevel",
};

// ─── Normalisation helpers ────────────────────────────────────────────────────

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
  return raw.toLowerCase().includes("hourly") ? "hourly" : "fixed";
}

function textToArray(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n|•|·|–|-(?=\s)/)
    .map((l) => l.replace(/^[\s\d.•·–\-*]+/, "").trim())
    .filter((l) => l.length > 4);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRecord(
  rec: Partial<ParsedJobRecord>,
  index: number,
  source: string,
): ParsedJobRecord {
  const errors: string[] = [];
  if (!rec.title?.trim()) errors.push("Missing job title");
  if (!rec.description?.trim()) errors.push("Missing job description");
  if (!rec.category?.trim()) errors.push("Missing department / category");

  return {
    title: rec.professionalRoleName?.trim() || rec.title?.trim() || "",
    professionalRoleName: rec.professionalRoleName?.trim() || rec.title?.trim() || "",
    originalRoleName: rec.originalRoleName?.trim() || undefined,
    jobFunction: rec.jobFunction?.trim() || rec.category?.trim() || "",
    category: normaliseCategory(rec.jobFunction || rec.category),
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
    _source: source,
  };
}

// ─── CSV / XLSX / XLS Parser ─────────────────────────────────────────────────

function rowsToRecords(
  rows: Record<string, string>[],
  source: string,
): ParsedJobRecord[] {
  return rows
    .filter((row) => Object.values(row).some((v) => v.trim()))
    .map((row, idx) => {
      const get = (key: keyof ParsedJobRecord): string | undefined => {
        for (const [alias, field] of Object.entries(HEADER_ALIASES)) {
          if (field === key && row[alias] !== undefined) return row[alias];
        }
        for (const [header, value] of Object.entries(row)) {
          if (HEADER_ALIASES[header] === key) return value;
        }
        return undefined;
      };

      const raw: Partial<ParsedJobRecord> = {
        title:                get("title"),
        professionalRoleName: get("professionalRoleName"),
        originalRoleName:     get("originalRoleName"),
        jobFunction:          get("jobFunction"),
        category:             get("category") ?? get("jobFunction"),
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

      return validateRecord(raw, idx, source);
    });
}

async function parseSpreadsheet(file: File): Promise<ParsedJobRecord[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return new Promise<ParsedJobRecord[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim().toLowerCase(),
        complete: (results: Papa.ParseResult<Record<string, string>>) => {
          resolve(rowsToRecords(results.data, file.name));
        },
        error: (err: Error) => reject(err),
      });
    });
  }

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
  return rowsToRecords(rows, file.name);
}

// ─── PDF Parser ───────────────────────────────────────────────────────────────

// Section definitions ordered most-specific first.
// `inline: true`  → label + value on the same line  (e.g. "Role: Senior VA")
// `inline: false` → label is a standalone header; body follows on next lines
// Keys prefixed with "_" are internal-only — captured but never mapped to public fields.
const PDF_SECTIONS: Array<{
  key: string;
  regex: RegExp;
  inline: boolean;
}> = [
  // ── Inline label fields ──────────────────────────────────────────────────
  { key: "title",       regex: /^(?:role|job\s+title|position|title)\s*:\s*(.+)/i,                        inline: true },
  { key: "reportingTo", regex: /^(?:reporting\s+to|reports\s+to|reporting\s+line)\s*:\s*(.+)/i,           inline: true },
  { key: "division",    regex: /^(?:division|department|team)\s*:\s*(.+)/i,                                inline: true },
  { key: "jobGrade",    regex: /^(?:job\s+grade|grade)\s*:\s*(.+)/i,                                      inline: true },
  { key: "jobLevel",    regex: /^(?:job\s+level|level)\s*:\s*(.+)/i,                                      inline: true },

  // ── Internal-only block sections (captured, not mapped to public fields) ─
  // Must come before public sections so they capture first and stop bleed
  { key: "_disc",           regex: /^(?:ideal\s+)?disc\s+profile(?:\s+for\s+success)?\s*:?\s*$/i,         inline: false },
  { key: "_redFlags",       regex: /^(?:what\s+to\s+avoid|red\s+flags?)\s*:?\s*$/i,                       inline: false },
  { key: "_successFactors", regex: /^(?:additional\s+)?success\s+factors\s*:?\s*$/i,                      inline: false },
  { key: "_jspHeader",      regex: /^[A-Z]\.\s+(?:job\s+success\s+profile|role\s+details?)\s*:?\s*$/i,    inline: false },

  // ── Public block sections ────────────────────────────────────────────────
  { key: "companyOverview",  regex: /^company\s+overview\s*:?\s*$/i,                                       inline: false },
  { key: "description",      regex: /^(?:about\s+the\s+(?:role|position)|role\s+summary)\s*:?\s*$/i,       inline: false },
  { key: "roleMission",      regex: /^(?:position\s+overview|role\s+overview)\s*:?\s*$/i,                  inline: false },
  { key: "responsibilities", regex: /^(?:key\s+)?responsibilities\s*:?\s*$/i,                               inline: false },
  { key: "requirements",     regex: /^(?:requirements?|job\s+qualifications?|qualifications?)\s*:?\s*$/i,  inline: false },
  { key: "culturalFit",      regex: /^(?:cultural|culture)\s+fit\s*:?\s*$/i,                               inline: false },
  { key: "_benefits",        regex: /^(?:why\s+join\s+us|benefits|what\s+we\s+offer)\s*:?\s*$/i,           inline: false },
];

// ── Text extraction — uses Y-coordinate grouping to preserve real line breaks ──

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Local Vite bundle — no CDN dependency
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group spans by rounded Y position so we reconstruct actual visual lines
    const byY = new Map<number, string[]>();
    const yOrder: number[] = [];

    for (const item of content.items) {
      const ti = item as { str: string; transform: number[]; hasEOL?: boolean };
      const y = Math.round(ti.transform[5]);
      if (!byY.has(y)) { byY.set(y, []); yOrder.push(y); }
      if (ti.str.trim()) byY.get(y)!.push(ti.str);
    }

    // Sort descending (PDF y=0 is bottom) then emit lines top→bottom
    yOrder.sort((a, b) => b - a);
    for (const y of yOrder) {
      const lineText = byY.get(y)!.join(" ").replace(/\s{2,}/g, " ").trim();
      if (lineText) allLines.push(lineText);
    }
  }

  return allLines.join("\n");
}

// ── Section-based parser using regex ─────────────────────────────────────────

function parseSections(rawText: string): Record<string, string> {
  // Normalise line endings
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s{2,}/g, " ").trim());

  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  const accum: string[] = [];

  const flush = () => {
    if (currentKey && accum.length) {
      sections[currentKey] = (sections[currentKey]
        ? sections[currentKey] + "\n"
        : "") + accum.join("\n").trim();
    }
    accum.length = 0;
  };

  for (const line of lines) {
    if (!line) continue;

    let matched = false;
    for (const sec of PDF_SECTIONS) {
      const m = sec.regex.exec(line);
      if (!m) continue;

      flush();
      currentKey = sec.key;

      if (sec.inline) {
        // Value is on the same line after the colon
        const val = m[1]?.trim();
        if (val) sections[currentKey] = val;
        // Don't accumulate more lines for inline fields
        currentKey = null;
      }
      // For block headers, keep currentKey so body lines accumulate

      matched = true;
      break;
    }

    if (!matched && currentKey) {
      accum.push(line);
    }
  }
  flush();

  return sections;
}

// ── Document noise patterns ───────────────────────────────────────────────────

const PDF_NOISE_PATTERNS: RegExp[] = [
  // Company header / confidential stamp (all variants)
  /onspot\s+global(\s+corp\.?)?/i,
  /confidential\s+document/i,
  /do\s+not\s+share/i,
  // Combined-line variant
  /onspot.*confidential.*share/i,
  // Page numbers and decorative separators
  /^page\s+\d+(\s+of\s+\d+)?$/i,
  /^\d+\s*$/,
  /^[-–—=_*]{3,}$/,                   // decorative dividers
  // Standalone lettered section markers like "A. ROLE DETAILS", "B. JOB SUCCESS PROFILE"
  /^[A-Z]\.\s+(job\s+success\s+profile|role\s+details?)\s*$/i,
  // Standalone "Job Success Profile" label (not inline)
  /^job\s+success\s+profile\s*$/i,
];

/** Remove company header/footer noise lines from raw PDF lines. */
function removeDocumentNoise(lines: string[]): string[] {
  return lines.filter((line) => {
    const t = line.trim();
    if (!t) return false;
    return !PDF_NOISE_PATTERNS.some((rx) => rx.test(t));
  });
}

// ── Filename → title fallback ─────────────────────────────────────────────────

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/Job\s+Success\s+Profile/gi, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Smart line merging ────────────────────────────────────────────────────────

// A line starts a new bullet when it begins with a common bullet marker.
const BULLET_START_RX = /^[\s]*[•●·▪▸→\-\*][\s]|^\s*\d+[.)]\s+|^\s*[a-z][.)]\s+/i;

/**
 * Merge PDF text lines that are continuations of the previous line.
 * A line is a continuation when it does NOT begin with a bullet marker
 * and is NOT blank. This handles wrapped bullets and wrapped paragraphs.
 */
function mergeWrappedLines(rawLines: string[]): string[] {
  const result: string[] = [];
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) {
      // Blank line = new logical paragraph / bullet
      result.push("");
      continue;
    }
    if (result.length === 0 || BULLET_START_RX.test(line) || result[result.length - 1] === "") {
      result.push(line);
    } else {
      // Continuation: glue onto previous
      result[result.length - 1] += " " + line;
    }
  }
  // Collapse consecutive blanks
  return result.filter((l, i) => l !== "" || (result[i - 1] ?? "") !== "");
}

/**
 * Extract a clean bullet array from section body text.
 * - Merges wrapped lines first
 * - Strips leading bullet characters
 * - Filters out very short fragments (likely OCR noise)
 */
function extractBullets(sectionText: string | undefined): string[] {
  if (!sectionText?.trim()) return [];
  const lines = mergeWrappedLines(sectionText.split("\n"));
  return lines
    .filter((l) => l.trim().length > 5)
    .map((l) =>
      l
        .replace(/^[\s•●·▪▸→\-\*]+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .replace(/^[a-z][.)]\s+/i, "")
        .trim(),
    )
    .filter((l) => l.length > 5);
}

/**
 * Merge and clean a single block-section body into a readable paragraph string.
 */
function cleanParagraph(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const merged = mergeWrappedLines(raw.split("\n"));
  return merged.filter((l) => l.trim()).join(" ").trim();
}

/**
 * Build the public-facing Job Description.
 *
 * Priority:
 *   1. "About the Role" (sec.description) — most role-specific
 *   2. "Position Overview" (sec.roleMission) — fallback role narrative
 *   3. A SHORT excerpt from Company Overview prepended as intro only if it
 *      adds context and neither of the above covers the company.
 *
 * Internal-only sections (DISC, red flags, success factors) are never included.
 */
function buildJobDescription(sec: Record<string, string>): string {
  const aboutRole      = cleanParagraph(sec["description"]);
  const posOverview    = cleanParagraph(sec["roleMission"]);
  const companyOverview = cleanParagraph(sec["companyOverview"]);

  // Pick the primary role narrative
  const roleNarrative = aboutRole || posOverview;

  const parts: string[] = [];

  // Company Overview: only as a short intro (max ~400 chars, first 2 sentences)
  if (companyOverview && roleNarrative) {
    const sentences = companyOverview.match(/[^.!?]+[.!?]+/g) ?? [companyOverview];
    const shortIntro = sentences.slice(0, 2).join(" ").trim();
    if (shortIntro.length > 20) parts.push(shortIntro);
  }

  if (roleNarrative) parts.push(roleNarrative);

  // If neither About the Role nor Position Overview exist, fall back to full overview
  if (parts.length === 0 && companyOverview) parts.push(companyOverview);

  return parts.join("\n\n").trim();
}

/** Deduplicate adjacent near-identical paragraphs that appear due to page-break repeats. */
function deduplicateText(text: string): string {
  const paras = text.split(/\n{2,}/);
  const seen = new Set<string>();
  return paras
    .filter((p) => {
      const key = p.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n\n");
}

// ── Build the final record from extracted sections ────────────────────────────

async function parsePdf(file: File): Promise<ParsedJobRecord[]> {
  const rawText = await extractPdfText(file);

  // Strip noise lines before section parsing
  const cleanedLines = removeDocumentNoise(rawText.split("\n"));
  const cleanedText  = cleanedLines.join("\n");

  const sec = parseSections(cleanedText);

  // ── Public fields ─────────────────────────────────────────────────────────

  // Title: explicit "Role:" label → filename fallback
  const title = sec["title"]?.trim() || titleFromFilename(file.name);

  // Department/Division
  const division = sec["division"]?.trim() || "";

  // Job Description: role-first, company overview as short intro only
  const description = deduplicateText(buildJobDescription(sec));

  // Bullet lists — internal keys (_disc, _redFlags, _successFactors) are ignored
  const responsibilities = extractBullets(sec["responsibilities"]);
  const requirements     = extractBullets(sec["requirements"]);
  const culturalFit      = extractBullets(sec["culturalFit"]);

  // Dev-mode debug
  if (import.meta.env.DEV) {
    console.group(`[BulkUpload] PDF parsed: ${file.name}`);
    console.log("title:", title, sec["title"] ? "(from 'Role:' label)" : "(from filename fallback)");
    console.log("division:", division || "(none)");
    console.log("description source:",
      sec["description"] ? "About the Role" :
      sec["roleMission"] ? "Position Overview" :
      sec["companyOverview"] ? "Company Overview (fallback)" : "none",
    );
    console.log("description chars:", description.length);
    console.log("responsibilities:", responsibilities.length, "items");
    console.log("requirements:", requirements.length, "items");
    console.log("culturalFit:", culturalFit.length, "items");
    console.log("internal keys captured:", Object.keys(sec).filter((k) => k.startsWith("_")));
    console.log("--- raw sections ---", sec);
    console.groupEnd();
  }

  const raw: Partial<ParsedJobRecord> = {
    title,
    professionalRoleName: title,
    jobFunction:      division,
    category:         division,
    description,
    reportingTo:      sec["reportingTo"]?.trim(),
    division,
    jobGrade:         sec["jobGrade"]?.trim(),
    jobLevel:         sec["jobLevel"]?.trim(),
    companyOverview:  sec["companyOverview"]?.trim(),
    roleMission:      sec["roleMission"]?.trim(),
    responsibilities,
    requirements,
    culturalFit,
    skillTags:        [],
    contractType:     "fixed",
    experienceLevel:  sec["jobLevel"]?.trim(),
  };

  return [validateRecord(raw, 0, file.name)];
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

// ─── API submission ───────────────────────────────────────────────────────────

async function submitJob(record: ParsedJobRecord): Promise<void> {
  const body: Record<string, unknown> = {
    title:                record.professionalRoleName || record.title,
    professionalRoleName: record.professionalRoleName || record.title,
    originalRoleName:     record.originalRoleName || null,
    jobFunction:          record.jobFunction || record.category,
    description:          record.description,
    category:             record.jobFunction || record.category,
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

// ─── File icon helper ─────────────────────────────────────────────────────────

function fileExtBadge(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf"))  return { label: "PDF",  Icon: FileGeneric,    cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/30" };
  if (lower.endsWith(".csv"))  return { label: "CSV",  Icon: FileText,       cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30" };
  return                               { label: "XLSX", Icon: FileSpreadsheet,cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30" };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SubmitSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: Array<{ title: string; error: string }>;
  fileCount: number;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
}

export function BulkUploadModal({ open, onClose, onSuccess }: BulkUploadModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [records, setRecords] = useState<ParsedJobRecord[]>([]);
  const [summary, setSummary] = useState<SubmitSummary | null>(null);
  const [progressCount, setProgressCount] = useState(0);

  function reset() {
    setStage("upload");
    setFiles([]);
    setFileResults([]);
    setRecords([]);
    setSummary(null);
    setProgressCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    if (chosen.length === 0) return;
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const deduped = chosen.filter((f) => !existingNames.has(f.name));
      return [...prev, ...deduped];
    });
  }

  async function handleParse() {
    if (files.length === 0) return;
    setStage("parsing");

    // Parse each file independently; failures don't stop others
    const results: FileResult[] = await Promise.all(
      files.map(async (file) => {
        try {
          const parsed = await parseFile(file);
          return { file, records: parsed };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          return { file, records: [], error };
        }
      }),
    );

    setFileResults(results);

    // Flatten all records, giving each a unique global index
    let globalIdx = 0;
    const allRecords: ParsedJobRecord[] = [];
    for (const r of results) {
      for (const rec of r.records) {
        allRecords.push({ ...rec, _index: globalIdx++ });
      }
    }

    if (allRecords.length === 0 && results.every((r) => r.error)) {
      // All files failed — stay on upload with errors shown
      setStage("upload");
    } else {
      setRecords(allRecords);
      setStage("preview");
    }
  }

  function toggleSelect(index: number) {
    setRecords((prev) =>
      prev.map((r) => (r._index === index ? { ...r, _selected: !r._selected } : r)),
    );
  }

  function toggleAll(to: boolean) {
    setRecords((prev) => prev.map((r) => (r._valid ? { ...r, _selected: to } : r)));
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

    const validCount   = records.filter((r) => r._valid).length;
    const invalidCount = records.filter((r) => !r._valid).length;

    setSummary({
      attempted:     selected.length,
      succeeded,
      failed:        errors.length,
      errors,
      fileCount:     files.length,
      totalRecords:  records.length,
      validRecords:  validCount,
      invalidRecords: invalidCount,
    });
    setStage("done");

    if (succeeded > 0) {
      toast({ title: `${succeeded} job${succeeded > 1 ? "s" : ""} created successfully` });
      onSuccess();
    }
  }

  const validCount    = records.filter((r) => r._valid).length;
  const invalidCount  = records.filter((r) => !r._valid).length;
  const selectedCount = records.filter((r) => r._selected && r._valid).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0">

        {/* Header */}
        <DialogHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#474ead]/10">
              <Upload className="h-4 w-4 text-[#474ead]" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white">
                Bulk Upload Job Postings
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select two or more files to bulk upload job postings. Supports CSV, Excel, and text-based PDF job profile files.
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

          {/* Stage pills */}
          <div className="mt-3 flex gap-2">
            {(["upload", "preview", "done"] as Stage[]).map((s) => {
              const isActive = stage === s || (s === "preview" && stage === "submitting");
              const isDone   = (s === "upload" && stage !== "upload" && stage !== "parsing")
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
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  {s === "upload" ? "Select Files" : s === "preview" ? "Preview" : "Results"}
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
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Drop zone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center transition-all hover:border-[#474ead]/40 hover:bg-[#474ead]/5 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
                  <Upload className="h-6 w-6 text-[#474ead]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Click to add files
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    CSV, Excel (.xls / .xlsx), or text-based PDF — multiple files supported
                  </p>
                </div>
                <span className="rounded-full border border-[#474ead]/30 bg-white px-4 py-1.5 text-xs font-medium text-[#474ead] shadow-sm dark:bg-[#0f172a]">
                  {files.length > 0 ? "Add more files" : "Choose files"}
                </span>
              </button>

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </p>
                  {files.map((f, i) => {
                    const { label, Icon, cls } = fileExtBadge(f.name);
                    return (
                      <div
                        key={`${f.name}-${i}`}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10">
                          <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {f.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {(f.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Badge className={`shrink-0 rounded-full border text-[10px] ${cls}`}>
                          {label}
                        </Badge>
                        <button
                          onClick={() => removeFile(i)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Per-file errors from last parse attempt */}
              {fileResults.some((r) => r.error) && (
                <div className="space-y-2">
                  {fileResults.filter((r) => r.error).map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <strong className="font-semibold">{r.file.name}:</strong> {r.error}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tips */}
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
                      <code className="rounded bg-slate-100 px-1 dark:bg-white/10">Qualifications</code>.
                      Each row = one job posting.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileGeneric className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                    <span>
                      <strong>PDF:</strong> Text-based Job Success Profile documents with sections like{" "}
                      <em>Role, About the Role, Key Responsibilities, Requirements</em> are
                      automatically parsed. Scanned/image PDFs are not supported.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Upload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                      <strong>Mixed uploads:</strong> You can select a combination of CSV, Excel, and PDF files in one session. Each file is parsed independently.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Stage: parsing spinner ── */}
          {stage === "parsing" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#474ead]" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Parsing {files.length} file{files.length !== 1 ? "s" : ""}…
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Extracting job records and validating fields.
              </p>
            </div>
          )}

          {/* ── Stage: preview ── */}
          {stage === "preview" && (
            <div className="space-y-4">

              {/* Per-file summary */}
              <div className="space-y-2">
                {fileResults.map((fr, i) => {
                  const { label, Icon, cls } = fileExtBadge(fr.file.name);
                  const frValid   = fr.records.filter((r) => r._valid).length;
                  const frInvalid = fr.records.filter((r) => !r._valid).length;
                  return (
                    <div
                      key={i}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                        fr.error
                          ? "border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/10"
                          : "border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                        {fr.file.name}
                      </p>
                      <Badge className={`rounded-full border text-[10px] ${cls}`}>{label}</Badge>
                      {fr.error ? (
                        <span className="text-xs text-red-600 dark:text-red-400">{fr.error}</span>
                      ) : (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">{fr.records.length} found</span>
                          {frValid > 0 && (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {frValid} valid
                            </span>
                          )}
                          {frInvalid > 0 && (
                            <span className="font-medium text-red-500">
                              {frInvalid} invalid
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Aggregate pills + select-all */}
              <div className="flex flex-wrap items-center gap-2">
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
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => toggleAll(true)}
                    className="text-xs text-[#474ead] underline-offset-2 hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                  <button
                    onClick={() => toggleAll(false)}
                    className="text-xs text-slate-500 underline-offset-2 hover:underline"
                  >
                    Deselect all
                  </button>
                </div>
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
                      {rec._valid ? (
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
                      ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-semibold ${
                            rec.title ? "text-slate-900 dark:text-white" : "text-red-500 italic"
                          }`}>
                            {rec.title || "No title"}
                          </p>
                          <Badge
                            className={`rounded-full border text-[10px] ${
                              rec._valid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30"
                                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                            }`}
                          >
                            {rec._valid ? "Valid" : "Invalid"}
                          </Badge>
                          {/* Source file badge */}
                          <Badge className="rounded-full border border-slate-200 bg-slate-100 text-[10px] text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                            {rec._source}
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
              <div className="flex flex-col items-center pb-4 text-center">
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
                  <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{summary.fileCount}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Files</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-white/[0.08] dark:bg-[#0f172a]/60">
                  <p className="text-2xl font-bold text-[#474ead]">{summary.attempted}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Attempted</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800/30 dark:bg-emerald-900/20">
                  <p className="text-2xl font-bold text-emerald-600">{summary.succeeded}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Created</p>
                </div>
                {summary.invalidRecords > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-white/[0.08] dark:bg-[#0f172a]/60">
                    <p className="text-2xl font-bold text-amber-500">{summary.invalidRecords}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Skipped (invalid)</p>
                  </div>
                )}
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

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0f172a]">
          {(stage === "upload" || stage === "parsing") && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={handleClose} className="rounded-full">
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={files.length === 0 || stage === "parsing"}
                className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c] disabled:opacity-40"
              >
                {stage === "parsing" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing…</>
                ) : (
                  <>
                    Parse &amp; Preview
                    {files.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                        {files.length}
                      </span>
                    )}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
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
                  onClick={() => { setStage("upload"); setFileResults([]); }}
                  className="rounded-full"
                >
                  Change Files
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
              <Button
                onClick={handleClose}
                className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
