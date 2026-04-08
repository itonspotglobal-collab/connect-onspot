/**
 * resumeParser.ts
 *
 * Client-side resume text extraction and profile inference.
 * Supports PDF (via pdfjs-dist) and DOCX/DOC (via mammoth).
 *
 * Exported surface:
 *   parseResumeFile(file)  → Promise<ExtractedCandidateProfile>
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedCandidateProfile {
  fullName: string;
  targetPosition: string;
  jobCategory: string;
  yearsOfExperience: string;   // "0-1" | "1-3" | "3-5" | "5+"
  seniority: string;            // "entry" | "mid" | "senior"
  coreSkills: string[];
  secondarySkills: string[];
  summary: string;
  // Meta
  confidence: "high" | "partial" | "low";
  extractedFields: string[];    // which fields were successfully detected
  parseError?: string;
}

export const EMPTY_EXTRACTION: ExtractedCandidateProfile = {
  fullName: "", targetPosition: "", jobCategory: "",
  yearsOfExperience: "", seniority: "",
  coreSkills: [], secondarySkills: [],
  summary: "",
  confidence: "low", extractedFields: [],
};

// ─── Known core skills (mirrors FindBestMatches) ──────────────────────────────

const CORE_SKILL_LIST = [
  "Customer Support", "Admin Support", "Data Entry", "Calendar Management",
  "Email Management", "Research", "Social Media", "Content Writing",
  "Bookkeeping", "Project Coordination", "Sales Support", "Technical Support",
  "CRM Management", "Scheduling", "Report Generation",
];

// Lower-cased aliases → canonical core skill name
const CORE_SKILL_ALIASES: Record<string, string> = {
  "customer service": "Customer Support", "customer support": "Customer Support",
  "cx": "Customer Support", "client support": "Customer Support",
  "help desk": "Customer Support", "helpdesk": "Customer Support",
  "admin support": "Admin Support", "administrative": "Admin Support",
  "admin assistant": "Admin Support", "office administration": "Admin Support",
  "general admin": "Admin Support", "office management": "Admin Support",
  "data entry": "Data Entry", "data encoding": "Data Entry",
  "data input": "Data Entry", "data processing": "Data Entry",
  "calendar management": "Calendar Management", "appointment scheduling": "Calendar Management",
  "diary management": "Calendar Management",
  "email management": "Email Management", "inbox management": "Email Management",
  "email handling": "Email Management", "correspondence": "Email Management",
  "research": "Research", "market research": "Research", "online research": "Research",
  "social media": "Social Media", "social media management": "Social Media",
  "instagram": "Social Media", "facebook": "Social Media",
  "content writing": "Content Writing", "copywriting": "Content Writing",
  "content creation": "Content Writing", "blog writing": "Content Writing",
  "bookkeeping": "Bookkeeping", "accounting": "Bookkeeping",
  "quickbooks": "Bookkeeping", "xero": "Bookkeeping",
  "accounts payable": "Bookkeeping", "accounts receivable": "Bookkeeping",
  "project coordination": "Project Coordination", "project management": "Project Coordination",
  "project planning": "Project Coordination",
  "sales support": "Sales Support", "lead generation": "Sales Support",
  "cold calling": "Sales Support", "outbound sales": "Sales Support",
  "technical support": "Technical Support", "tech support": "Technical Support",
  "it support": "Technical Support", "troubleshooting": "Technical Support",
  "crm management": "CRM Management", "crm": "CRM Management",
  "salesforce": "CRM Management", "hubspot": "CRM Management",
  "scheduling": "Scheduling", "appointment setting": "Scheduling",
  "report generation": "Report Generation", "reporting": "Report Generation",
  "data analysis": "Report Generation", "analytics": "Report Generation",
};

// ─── Title → category mapping ─────────────────────────────────────────────────

const TITLE_TO_CATEGORY: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: [
      "it administrator", "it admin", "systems administrator", "network administrator",
      "sysadmin", "devops", "cloud engineer", "software developer", "software engineer",
      "web developer", "programmer", "it specialist", "it support specialist",
      "it manager", "network engineer", "cybersecurity", "it officer",
    ],
    category: "Tech Support",
  },
  {
    keywords: [
      "accountant", "accounting", "bookkeeper", "bookkeeping", "finance manager",
      "financial analyst", "accounts manager", "payroll", "tax specialist",
      "accounts payable", "accounts receivable", "controller", "auditor",
    ],
    category: "Finance",
  },
  {
    keywords: [
      "graphic designer", "ux designer", "ui designer", "visual designer",
      "motion designer", "illustrator", "creative director", "brand designer",
      "web designer",
    ],
    category: "Design",
  },
  {
    keywords: [
      "recruiter", "talent acquisition", "hr specialist", "hr manager",
      "human resources", "people operations", "hr coordinator", "hr officer",
    ],
    category: "HR",
  },
  {
    keywords: [
      "team manager", "operations manager", "department manager", "line manager",
      "general manager", "program manager", "delivery manager", "account manager",
      "project manager", "head of", "director of",
    ],
    category: "Operations",
  },
  {
    keywords: [
      "sales manager", "sales representative", "sales specialist", "account executive",
      "business development", "bdr", "sdr", "lead generation specialist",
    ],
    category: "Sales",
  },
  {
    keywords: [
      "digital marketing", "marketing manager", "seo specialist", "ads manager",
      "email marketing", "social media manager", "content strategist",
      "copywriter", "content writer", "marketing specialist",
    ],
    category: "Marketing",
  },
  {
    keywords: [
      "customer service", "customer support", "customer success", "cx specialist",
      "support agent", "service representative", "client support", "csr",
    ],
    category: "Customer Support",
  },
  {
    keywords: [
      "virtual assistant", "executive assistant", "administrative assistant",
      "admin officer", "admin coordinator", "office admin", "admin support",
      "data entry specialist", "data encoder",
    ],
    category: "Admin",
  },
];

// ─── Seniority keywords ───────────────────────────────────────────────────────

const SENIOR_KEYWORDS = [
  "senior", "sr.", "lead", "principal", "head", "chief", "director",
  "vp", "vice president", "manager", "supervisor", "team lead",
];
const JUNIOR_KEYWORDS = ["junior", "jr.", "associate", "trainee", "intern", "entry"];

// ─── Text extraction from file ────────────────────────────────────────────────

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const byY = new Map<number, string[]>();
    const yOrder: number[] = [];
    for (const item of content.items) {
      const ti = item as { str: string; transform: number[] };
      const y = Math.round(ti.transform[5]);
      if (!byY.has(y)) { byY.set(y, []); yOrder.push(y); }
      if (ti.str.trim()) byY.get(y)!.push(ti.str);
    }
    yOrder.sort((a, b) => b - a);
    for (const y of yOrder) {
      const line = byY.get(y)!.join(" ").replace(/\s{2,}/g, " ").trim();
      if (line) allLines.push(line);
    }
  }
  return allLines.join("\n");
}

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractTextFromPdf(file);
  if (name.endsWith(".docx") || name.endsWith(".doc")) return extractTextFromDocx(file);
  // Plain text fallback
  return file.text();
}

// ─── Section detection ────────────────────────────────────────────────────────

const SECTION_HEADERS: Record<string, RegExp> = {
  summary:    /^(?:summary|professional\s+summary|objective|profile|about\s+me|professional\s+profile|career\s+objective)\s*:?\s*$/i,
  experience: /^(?:work\s+experience|experience|employment\s+history|professional\s+experience|work\s+history|career\s+history)\s*:?\s*$/i,
  education:  /^(?:education|academic|qualifications?)\s*:?\s*$/i,
  skills:     /^(?:skills?|technical\s+skills?|key\s+skills?|core\s+competencies|competencies|expertise|tools?\s*&?\s*technologies?|skills?\s*&\s*competencies)\s*:?\s*$/i,
};

interface ResumeSection { type: string; lines: string[]; }

function splitIntoSections(lines: string[]): ResumeSection[] {
  const sections: ResumeSection[] = [{ type: "header", lines: [] }];
  let current = sections[0];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;
    for (const [type, rx] of Object.entries(SECTION_HEADERS)) {
      if (rx.test(trimmed)) {
        current = { type, lines: [] };
        sections.push(current);
        matched = true;
        break;
      }
    }
    if (!matched) current.lines.push(trimmed);
  }
  return sections;
}

// ─── Name detection ───────────────────────────────────────────────────────────

const CONTACT_RX = /[@\d\+\(\)\/\-\.]{3,}|^https?:\/\//i;
const SECTION_HEADER_RX = /^(?:resume|curriculum vitae|cv|name|contact|profile)\s*:?\s*$/i;

function extractName(headerLines: string[]): string {
  for (const line of headerLines.slice(0, 8)) {
    const t = line.trim();
    if (!t || CONTACT_RX.test(t) || SECTION_HEADER_RX.test(t)) continue;
    // 2–4 words, mostly letters, likely PascalCase or ALL CAPS
    const words = t.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const hasLetters = words.every((w) => /^[A-Za-z\u00C0-\u024F\'\-\.]+$/.test(w));
      if (hasLetters) return toTitleCase(t);
    }
  }
  return "";
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Job title detection ──────────────────────────────────────────────────────

const TITLE_INDICATORS = [
  "manager", "specialist", "executive", "assistant", "coordinator", "analyst",
  "developer", "engineer", "officer", "representative", "consultant",
  "lead", "director", "associate", "supervisor", "administrator", "support",
  "agent", "operator", "advisor", "technician", "bookkeeper", "accountant",
  "recruiter", "designer",
];

function looksLikeTitle(line: string): boolean {
  const lower = line.toLowerCase();
  const wordCount = line.split(/\s+/).length;
  return (
    wordCount >= 1 && wordCount <= 8 &&
    TITLE_INDICATORS.some((kw) => lower.includes(kw)) &&
    !CONTACT_RX.test(line)
  );
}

/** Extract the most recent job title from experience section or header area. */
function extractTitle(sections: ResumeSection[]): string {
  // Check header first (often has title right under name)
  const header = sections.find((s) => s.type === "header");
  if (header) {
    for (const line of header.lines.slice(1, 6)) {
      if (looksLikeTitle(line)) return toTitleCase(line.trim());
    }
  }

  // Check experience section — first job title entry
  const exp = sections.find((s) => s.type === "experience");
  if (exp) {
    for (const line of exp.lines.slice(0, 15)) {
      if (looksLikeTitle(line)) return toTitleCase(line.trim());
    }
  }

  return "";
}

// ─── Category inference ───────────────────────────────────────────────────────

function inferCategory(title: string, allText: string): string {
  const lower = (title + " " + allText.slice(0, 1500)).toLowerCase();
  for (const { keywords, category } of TITLE_TO_CATEGORY) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "";
}

// ─── Seniority inference ──────────────────────────────────────────────────────

function inferSeniority(title: string, yearsId: string): string {
  const lower = title.toLowerCase();
  if (SENIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "senior";
  if (JUNIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "entry";
  // Fall back to years of experience
  if (yearsId === "5+") return "senior";
  if (yearsId === "3-5") return "mid";
  if (yearsId === "1-3") return "mid";
  return "entry";
}

// ─── Years of experience ──────────────────────────────────────────────────────

const YEAR_RX = /\b(19|20)\d{2}\b/g;
const PRESENT_RX = /\b(?:present|current|now|ongoing)\b/i;
const DATE_RANGE_RX = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+(\d{4})\s*[-–—to]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+(\d{4})|present|current)/gi;

function extractYearsOfExperience(expSection: ResumeSection | undefined, allText: string): string {
  const currentYear = new Date().getFullYear();
  const text = expSection ? expSection.lines.join(" ") : allText.slice(0, 3000);

  let earliest = currentYear;
  let latest = 0;

  // Try date range pattern first (month year – month year)
  let m: RegExpExecArray | null;
  const dr = new RegExp(DATE_RANGE_RX.source, "gi");
  while ((m = dr.exec(text)) !== null) {
    const start = parseInt(m[1]);
    const end = PRESENT_RX.test(m[0]) ? currentYear : parseInt(m[2] ?? String(currentYear));
    if (start >= 1990 && start <= currentYear) earliest = Math.min(earliest, start);
    if (end >= 1990 && end <= currentYear) latest = Math.max(latest, end);
  }

  // Fall back to bare year mentions
  if (latest === 0) {
    const years: number[] = [];
    let ym: RegExpExecArray | null;
    const yr = new RegExp(YEAR_RX.source, "g");
    while ((ym = yr.exec(text)) !== null) {
      const y = parseInt(ym[0]);
      if (y >= 1990 && y <= currentYear) years.push(y);
    }
    if (years.length >= 2) {
      earliest = Math.min(...years);
      latest = Math.max(...years);
      // If text says "present" anywhere, set latest to current
      if (PRESENT_RX.test(text)) latest = currentYear;
    }
  }

  if (latest === 0) return ""; // Could not determine

  const totalYears = Math.max(0, latest - earliest);
  if (totalYears <= 1)  return "0-1";
  if (totalYears <= 3)  return "1-3";
  if (totalYears <= 5)  return "3-5";
  return "5+";
}

// ─── Skills extraction ────────────────────────────────────────────────────────

function extractSkills(
  skillsSection: ResumeSection | undefined,
  allText: string,
): { coreSkills: string[]; secondarySkills: string[] } {
  const coreFound = new Set<string>();
  const secondaryFound = new Set<string>();

  const sources = [
    skillsSection ? skillsSection.lines.join(" ") : "",
    allText.slice(0, 4000),
  ];

  for (const src of sources) {
    if (!src) continue;
    const lower = src.toLowerCase();

    // Match against known aliases
    for (const [alias, canonical] of Object.entries(CORE_SKILL_ALIASES)) {
      if (lower.includes(alias) && CORE_SKILL_LIST.includes(canonical)) {
        coreFound.add(canonical);
      }
    }
  }

  // Secondary: look in skills section for items not already captured
  if (skillsSection) {
    const rawText = skillsSection.lines.join("\n");
    // Split by bullets, commas, pipes, semicolons, newlines
    const tokens = rawText
      .split(/[\n•·,|;\/\t]+/)
      .map((t) => t.replace(/^[\s\-*●]+/, "").trim())
      .filter((t) => t.length > 2 && t.length < 50);

    for (const token of tokens) {
      // Skip if it matches a core skill alias (already handled)
      const lower = token.toLowerCase();
      const isCore = Object.keys(CORE_SKILL_ALIASES).some((a) => lower.includes(a));
      if (!isCore && !secondaryFound.has(token)) {
        secondaryFound.add(toTitleCase(token));
      }
    }
  }

  return {
    coreSkills: [...coreFound],
    secondarySkills: [...secondaryFound].slice(0, 10), // cap secondary
  };
}

// ─── Summary extraction ───────────────────────────────────────────────────────

function extractSummary(summarySection: ResumeSection | undefined): string {
  if (!summarySection || summarySection.lines.length === 0) return "";
  const text = summarySection.lines
    .slice(0, 8)
    .join(" ")
    .trim();
  // Take up to ~280 chars (roughly 2–3 sentences)
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, 3).join(" ").trim().slice(0, 350);
}

// ─── Main parse function ──────────────────────────────────────────────────────

export async function parseResumeFile(file: File): Promise<ExtractedCandidateProfile> {
  let rawText: string;
  try {
    rawText = await extractTextFromFile(file);
  } catch (err) {
    return {
      ...EMPTY_EXTRACTION,
      parseError: "Could not read the file. Please try a PDF or DOCX format.",
    };
  }

  if (!rawText.trim() || rawText.trim().length < 30) {
    return {
      ...EMPTY_EXTRACTION,
      parseError: "The file appears to be empty or unreadable.",
    };
  }

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections = splitIntoSections(lines);
  const header   = sections.find((s) => s.type === "header");
  const expSec   = sections.find((s) => s.type === "experience");
  const skillSec = sections.find((s) => s.type === "skills");
  const summSec  = sections.find((s) => s.type === "summary");

  const extracted: Partial<ExtractedCandidateProfile> = {};
  const extractedFields: string[] = [];

  // ── Full name ──────────────────────────────────────────────────────────────
  const name = extractName(header?.lines ?? lines);
  if (name) { extracted.fullName = name; extractedFields.push("fullName"); }

  // ── Target position ────────────────────────────────────────────────────────
  const title = extractTitle(sections);
  if (title) { extracted.targetPosition = title; extractedFields.push("targetPosition"); }

  // ── Years of experience ────────────────────────────────────────────────────
  const yearsId = extractYearsOfExperience(expSec, rawText);
  if (yearsId) { extracted.yearsOfExperience = yearsId; extractedFields.push("yearsOfExperience"); }

  // ── Seniority ──────────────────────────────────────────────────────────────
  const seniority = inferSeniority(title, yearsId);
  extracted.seniority = seniority;
  if (title || yearsId) extractedFields.push("seniority");

  // ── Category ───────────────────────────────────────────────────────────────
  const category = inferCategory(title, rawText);
  if (category) { extracted.jobCategory = category; extractedFields.push("jobCategory"); }

  // ── Skills ─────────────────────────────────────────────────────────────────
  const { coreSkills, secondarySkills } = extractSkills(skillSec, rawText);
  extracted.coreSkills = coreSkills;
  extracted.secondarySkills = secondarySkills;
  if (coreSkills.length > 0) extractedFields.push("coreSkills");
  if (secondarySkills.length > 0) extractedFields.push("secondarySkills");

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = extractSummary(summSec);
  if (summary) { extracted.summary = summary; extractedFields.push("summary"); }

  // ── Confidence rating ──────────────────────────────────────────────────────
  const keyFieldCount = [
    extracted.fullName, extracted.targetPosition, extracted.jobCategory,
    extracted.yearsOfExperience, extracted.coreSkills?.length,
  ].filter(Boolean).length;

  const confidence: "high" | "partial" | "low" =
    keyFieldCount >= 4 ? "high" : keyFieldCount >= 2 ? "partial" : "low";

  if (import.meta.env.DEV) {
    console.group("[ResumeParser] Extraction complete");
    console.log("name:", extracted.fullName || "(none)");
    console.log("title:", extracted.targetPosition || "(none)");
    console.log("category:", extracted.jobCategory || "(none)");
    console.log("years:", extracted.yearsOfExperience || "(none)");
    console.log("seniority:", extracted.seniority);
    console.log("coreSkills:", extracted.coreSkills);
    console.log("secondarySkills:", extracted.secondarySkills);
    console.log("confidence:", confidence);
    console.groupEnd();
  }

  return {
    fullName:          extracted.fullName          ?? "",
    targetPosition:    extracted.targetPosition    ?? "",
    jobCategory:       extracted.jobCategory       ?? "",
    yearsOfExperience: extracted.yearsOfExperience ?? "",
    seniority:         extracted.seniority         ?? "",
    coreSkills:        extracted.coreSkills        ?? [],
    secondarySkills:   extracted.secondarySkills   ?? [],
    summary:           extracted.summary           ?? "",
    confidence,
    extractedFields,
  };
}
