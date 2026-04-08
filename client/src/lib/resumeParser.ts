/**
 * resumeParser.ts
 *
 * Client-side resume text extraction and profile inference.
 * Supports PDF (pdfjs-dist) and DOCX/DOC (mammoth).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedCandidateProfile {
  fullName: string;
  targetPosition: string;
  jobCategory: string;
  yearsOfExperience: string;   // "0-1" | "1-3" | "3-5" | "5+"
  seniority: string;
  coreSkills: string[];
  secondarySkills: string[];
  summary: string;
  confidence: "high" | "partial" | "low";
  extractedFields: string[];
  parseError?: string;
}

export const EMPTY_EXTRACTION: ExtractedCandidateProfile = {
  fullName: "", targetPosition: "", jobCategory: "",
  yearsOfExperience: "", seniority: "",
  coreSkills: [], secondarySkills: [],
  summary: "",
  confidence: "low", extractedFields: [],
};

// ─── Core skill aliases (maps resume phrases → chip labels) ──────────────────

const CORE_SKILL_LIST = [
  "Customer Support", "Admin Support", "Data Entry", "Calendar Management",
  "Email Management", "Research", "Social Media", "Content Writing",
  "Bookkeeping", "Project Coordination", "Sales Support", "Technical Support",
  "CRM Management", "Scheduling", "Report Generation",
];

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

// ─── Known secondary / tech skills (case-insensitive exact phrase match) ─────
// Ordered longest-first so more specific matches win before shorter ones.

const KNOWN_SKILLS: string[] = [
  // Languages & markup
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "PHP", "Ruby",
  "Swift", "Kotlin", "Go", "Rust", "HTML", "CSS", "SQL", "NoSQL",
  ".NET", "Node.js", "Bash", "Shell Scripting", "R", "MATLAB",
  // Web frameworks / libs
  "React", "Vue.js", "Angular", "Next.js", "Nuxt.js", "Svelte",
  "Django", "Flask", "FastAPI", "Laravel", "Express.js", "Spring Boot",
  "ASP.NET", "Ruby on Rails",
  // Mobile
  "React Native", "Flutter", "iOS Development", "Android Development",
  // Databases
  "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Redis", "Elasticsearch",
  "Oracle", "MSSQL", "Firebase",
  // DevOps / infra
  "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "GCP",
  "Linux", "Ubuntu", "CI/CD", "Jenkins", "GitHub Actions", "Terraform",
  "Ansible", "Nginx",
  // Tools
  "Git", "GitHub", "Gitlab", "Jira", "Trello", "Asana", "Slack",
  "Postman", "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator",
  "Visual Studio", "VS Code", "IntelliJ", "Eclipse", "Xcode",
  "Tableau", "Power BI", "Google Analytics", "Mixpanel", "Amplitude",
  // QA / testing
  "Automation Testing", "Manual Testing", "Selenium", "Cypress",
  "Playwright", "Jest", "Mocha", "Chai", "JUnit", "TestNG",
  "Quality Assurance", "QA Testing", "Bug Tracking", "UAT Testing",
  // Design / UX
  "UI/UX Design", "Wireframing", "Prototyping", "User Research",
  // Office / productivity
  "Microsoft Office", "Google Workspace", "MS Excel", "MS Word",
  "Google Sheets", "Google Docs", "PowerPoint", "Google Slides",
  "Canva", "Notion", "Confluence",
  // Communication / support
  "Documentation", "Technical Writing", "Transcription", "Transcriber",
  "Translation", "Customer Success", "Live Chat Support",
  // Finance / operations
  "Payroll Processing", "Accounts Payable", "Accounts Receivable",
  "Financial Reporting", "Budgeting", "Forecasting", "SAP", "NetSuite",
  // Data
  "Data Analysis", "Data Entry", "Data Visualization",
  "Machine Learning", "Deep Learning", "NLP", "TensorFlow", "PyTorch",
  // HR / management
  "Recruitment", "Talent Acquisition", "Performance Management",
  "Onboarding", "Employee Relations", "HRIS",
  // Marketing
  "SEO", "SEM", "Email Marketing", "Content Marketing", "PPC",
  "Facebook Ads", "Google Ads", "LinkedIn Ads", "Copywriting",
  // Sales
  "Lead Generation", "Cold Calling", "CRM", "Pipeline Management",
  "B2B Sales", "B2C Sales", "Account Management",
  // Generic
  "Problem Solving", "Critical Thinking", "Team Leadership",
  "Project Management", "Agile", "Scrum", "Kanban", "Waterfall",
].sort((a, b) => b.length - a.length); // longest first for greedy matching

// ─── Title → category mapping ─────────────────────────────────────────────────

const TITLE_TO_CATEGORY: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: [
      "qa engineer", "quality assurance", "test engineer", "software tester",
      "automation engineer", "it administrator", "it admin", "system administrator",
      "sysadmin", "devops", "cloud engineer", "software developer", "software engineer",
      "web developer", "programmer", "it specialist", "it support specialist",
      "it manager", "network engineer", "cybersecurity", "it officer",
      "systems analyst", "database administrator", "dba",
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

const SENIOR_KEYWORDS = [
  "senior", "sr.", "lead", "principal", "head", "chief", "director",
  "vp", "vice president", "manager", "supervisor", "team lead",
];
const JUNIOR_KEYWORDS = ["junior", "jr.", "associate", "trainee", "intern", "entry"];

// ─── Lines that should never be treated as a person's name ───────────────────

const NOISE_LINE_RX = /^(?:resume|curriculum\s+vitae|cv|profile|contact|references?|about\s+me|education|objectives?|work\s+experience|experience|employment|skills?|summary|professional\s+summary|career\s+objective|languages?|certifications?|awards?|achievements?|projects?|portfolio|hobbies?|interests?|activities|publications?|volunteer)\s*:?\s*$/i;

const CONTACT_LINE_RX = /[@\d]{2,}|https?:\/\/|linkedin\.com|github\.com|facebook\.com/i;

// ─── Text extraction ──────────────────────────────────────────────────────────

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
  return file.text();
}

// ─── Section splitting ────────────────────────────────────────────────────────

const SECTION_HEADERS: Record<string, RegExp> = {
  summary: /^(?:summary|professional\s+summary|objective[s]?|profile|about\s+me|professional\s+profile|career\s+objective)\s*:?\s*$/i,
  experience: /^(?:work\s+experience|experience|employment\s+history|professional\s+experience|work\s+history|career\s+history)\s*:?\s*$/i,
  education: /^(?:education|academic|qualifications?|schooling)\s*:?\s*$/i,
  skills: /^(?:skills?|technical\s+skills?|key\s+skills?|core\s+competencies|competencies|expertise|tools?\s*(?:&|and)?\s*technologies?|skills?\s*(?:&|and)\s*competencies|programming\s+languages?|frameworks?|technologies?|tools?\s+(?:used|&)|technical\s+competencies|technical\s+toolkit)\s*:?\s*$/i,
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
        // Merge adjacent skill sections into one
        if (type === "skills") {
          const existing = sections.find((s) => s.type === "skills");
          if (existing) { current = existing; matched = true; break; }
        }
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

// ─── Name extraction ──────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A word in a person's name: letters (incl. accented), optional trailing period for initials. */
const NAME_WORD_RX = /^[A-Za-zÀ-ÖØ-öø-ÿ][\w\u00C0-\u024F\'\-]*\.?$/;

function looksLikePersonName(line: string): boolean {
  if (NOISE_LINE_RX.test(line)) return false;
  if (CONTACT_LINE_RX.test(line)) return false;

  const words = line.trim().split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;

  // Allow middle initials like "L." — the word just needs to start with a letter
  const allLetterWords = words.every((w) => NAME_WORD_RX.test(w));
  if (!allLetterWords) return false;

  // At least 2 words that are longer than 1 char (not all initials)
  const substantiveWords = words.filter((w) => w.replace(/\.$/, "").length > 1);
  return substantiveWords.length >= 2;
}

function extractName(allLines: string[]): string {
  // Scan the first 15 non-empty lines of the document
  const candidates = allLines.slice(0, 15).map((l) => l.trim()).filter(Boolean);
  for (const line of candidates) {
    if (looksLikePersonName(line)) {
      return toTitleCase(line);
    }
  }
  return "";
}

// ─── Job title extraction ─────────────────────────────────────────────────────

const TITLE_INDICATORS = [
  "manager", "specialist", "executive", "assistant", "coordinator", "analyst",
  "developer", "engineer", "officer", "representative", "consultant",
  "lead", "director", "associate", "supervisor", "administrator", "support",
  "agent", "operator", "advisor", "technician", "bookkeeper", "accountant",
  "recruiter", "designer", "tester", "qa", "transcriber",
];

function looksLikeTitle(line: string): boolean {
  const lower = line.toLowerCase();
  const wordCount = line.split(/\s+/).length;
  return (
    wordCount >= 1 && wordCount <= 8 &&
    TITLE_INDICATORS.some((kw) => lower.includes(kw)) &&
    !CONTACT_LINE_RX.test(line)
  );
}

function extractTitle(sections: ResumeSection[], allLines: string[]): string {
  const header = sections.find((s) => s.type === "header");

  // First: lines in header that look like a title (skip likely name lines)
  if (header) {
    for (const line of header.lines.slice(0, 10)) {
      if (!looksLikePersonName(line) && looksLikeTitle(line)) {
        return toTitleCase(line.trim());
      }
    }
  }

  // Second: look at lines 1–20 of raw text for a title-like line after the name
  for (const line of allLines.slice(1, 20)) {
    if (!looksLikePersonName(line) && looksLikeTitle(line) && !CONTACT_LINE_RX.test(line)) {
      return toTitleCase(line.trim());
    }
  }

  // Third: first title in experience section
  const exp = sections.find((s) => s.type === "experience");
  if (exp) {
    for (const line of exp.lines.slice(0, 10)) {
      if (looksLikeTitle(line)) return toTitleCase(line.trim());
    }
  }

  return "";
}

// ─── Category ─────────────────────────────────────────────────────────────────

function inferCategory(title: string, allText: string): string {
  const lower = (title + " " + allText.slice(0, 2000)).toLowerCase();
  for (const { keywords, category } of TITLE_TO_CATEGORY) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "";
}

// ─── Seniority ────────────────────────────────────────────────────────────────

function inferSeniority(title: string, yearsId: string): string {
  const lower = title.toLowerCase();
  if (SENIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "senior";
  if (JUNIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "entry";
  if (yearsId === "5+") return "senior";
  if (yearsId === "3-5") return "mid";
  if (yearsId === "1-3") return "mid";
  return "entry";
}

// ─── Years of experience ──────────────────────────────────────────────────────

const PRESENT_RX = /\b(?:present|current|now|ongoing)\b/i;
const DATE_RANGE_RX = /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+(\d{4})\s*[-–—to]+\s*(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+(\d{4})|present|current|now)/gi;
const BARE_YEAR_RX = /\b(19|20)\d{2}\b/g;

function extractYearsOfExperience(expSection: ResumeSection | undefined, allText: string): string {
  const currentYear = new Date().getFullYear();
  const text = expSection ? expSection.lines.join(" ") : allText.slice(0, 4000);

  let earliest = currentYear;
  let latest = 0;

  // Named month + year range
  const dr = new RegExp(DATE_RANGE_RX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = dr.exec(text)) !== null) {
    const start = parseInt(m[1]);
    const isPresent = PRESENT_RX.test(m[0]);
    const end = isPresent ? currentYear : parseInt(m[2] ?? String(currentYear));
    if (start >= 1990 && start <= currentYear) earliest = Math.min(earliest, start);
    if (end >= 1990 && end <= currentYear) latest = Math.max(latest, end);
  }

  // Bare year fallback
  if (latest === 0) {
    const years: number[] = [];
    const yr = new RegExp(BARE_YEAR_RX.source, "g");
    let ym: RegExpExecArray | null;
    while ((ym = yr.exec(text)) !== null) {
      const y = parseInt(ym[0]);
      if (y >= 1990 && y <= currentYear) years.push(y);
    }
    if (years.length >= 2) {
      earliest = Math.min(...years);
      latest = Math.max(...years);
      if (PRESENT_RX.test(text)) latest = currentYear;
    }
  }

  if (latest === 0) return "";

  const total = Math.max(0, latest - earliest);
  if (total <= 1)  return "0-1";
  if (total <= 3)  return "1-3";
  if (total <= 5)  return "3-5";
  return "5+";
}

// ─── Skills extraction ────────────────────────────────────────────────────────

function extractSkills(
  skillSections: ResumeSection[],
  allText: string,
): { coreSkills: string[]; secondarySkills: string[] } {
  const coreFound = new Set<string>();
  const secondaryFound = new Set<string>();

  const fullLower = allText.toLowerCase();

  // ── Core skills: match aliases across full text ──────────────────────────
  for (const [alias, canonical] of Object.entries(CORE_SKILL_ALIASES)) {
    if (CORE_SKILL_LIST.includes(canonical) && fullLower.includes(alias)) {
      coreFound.add(canonical);
    }
  }

  // ── Secondary skills: match known skill keywords in full text ────────────
  for (const skill of KNOWN_SKILLS) {
    const needle = skill.toLowerCase();
    // Look for the skill as a whole word/phrase (not as a substring of another word)
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`, "i");
    if (rx.test(allText)) {
      secondaryFound.add(skill);
    }
  }

  // ── Also parse skill section lines for unlisted items ───────────────────
  const skillLines = skillSections.flatMap((s) => s.lines).join("\n");
  const tokens = skillLines
    .split(/[\n•·,|;\/\t\u2022\u2023\u25E6\u2043\u204C\u204D]+/)
    .map((t) => t.replace(/^\s*[\-*●▪▸►→]+\s*/, "").trim())
    .filter((t) => t.length > 1 && t.length < 60);

  for (const token of tokens) {
    const lower = token.toLowerCase();
    // Skip if already in core
    const isCore = Object.keys(CORE_SKILL_ALIASES).some((a) => lower.includes(a) && CORE_SKILL_LIST.includes(CORE_SKILL_ALIASES[a]));
    if (isCore) continue;
    // Skip if already in known skills (already captured)
    const isKnown = KNOWN_SKILLS.some((k) => k.toLowerCase() === lower);
    if (isKnown) continue;
    // Skip noise
    if (/^\d+$/.test(token)) continue;
    if (NOISE_LINE_RX.test(token)) continue;
    if (token.split(/\s+/).length > 5) continue;
    secondaryFound.add(toTitleCase(token));
  }

  // Remove any secondary skills that duplicate core skills
  const coreArr = [...coreFound];
  const secondaryArr = [...secondaryFound]
    .filter((s) => !coreArr.includes(s))
    .slice(0, 20);

  return { coreSkills: coreArr, secondarySkills: secondaryArr };
}

// ─── Summary extraction ───────────────────────────────────────────────────────

function extractSummary(summarySection: ResumeSection | undefined): string {
  if (!summarySection || summarySection.lines.length === 0) return "";
  const text = summarySection.lines.slice(0, 6).join(" ").trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, 3).join(" ").trim().slice(0, 350);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parseResumeFile(file: File): Promise<ExtractedCandidateProfile> {
  let rawText: string;
  try {
    rawText = await extractTextFromFile(file);
  } catch (err) {
    return { ...EMPTY_EXTRACTION, parseError: "Could not read the file. Please try a PDF or DOCX format." };
  }

  if (!rawText.trim() || rawText.trim().length < 30) {
    return { ...EMPTY_EXTRACTION, parseError: "The file appears to be empty or unreadable." };
  }

  const lines    = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections = splitIntoSections(lines);
  const expSec   = sections.find((s) => s.type === "experience");
  const skillSec = sections.filter((s) => s.type === "skills");
  const summSec  = sections.find((s) => s.type === "summary");

  const extracted: Partial<ExtractedCandidateProfile> = {};
  const extractedFields: string[] = [];

  // Name — scan first 15 raw lines (before any section-grouping)
  const name = extractName(lines);
  if (name) { extracted.fullName = name; extractedFields.push("fullName"); }

  // Title
  const title = extractTitle(sections, lines);
  if (title) { extracted.targetPosition = title; extractedFields.push("targetPosition"); }

  // Years of experience
  const yearsId = extractYearsOfExperience(expSec, rawText);
  if (yearsId) { extracted.yearsOfExperience = yearsId; extractedFields.push("yearsOfExperience"); }

  // Seniority
  const seniority = inferSeniority(title, yearsId);
  extracted.seniority = seniority;
  if (title || yearsId) extractedFields.push("seniority");

  // Category
  const category = inferCategory(title, rawText);
  if (category) { extracted.jobCategory = category; extractedFields.push("jobCategory"); }

  // Skills — pass all skill sections and full text
  const { coreSkills, secondarySkills } = extractSkills(skillSec, rawText);
  extracted.coreSkills = coreSkills;
  extracted.secondarySkills = secondarySkills;
  if (coreSkills.length > 0)    extractedFields.push("coreSkills");
  if (secondarySkills.length > 0) extractedFields.push("secondarySkills");

  // Summary
  const summary = extractSummary(summSec);
  if (summary) { extracted.summary = summary; extractedFields.push("summary"); }

  // Confidence
  const keyCount = [
    extracted.fullName, extracted.targetPosition, extracted.jobCategory,
    extracted.yearsOfExperience, extracted.coreSkills?.length ?? 0,
    extracted.secondarySkills?.length ?? 0,
  ].filter(Boolean).length;
  const confidence: "high" | "partial" | "low" =
    keyCount >= 4 ? "high" : keyCount >= 2 ? "partial" : "low";

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
