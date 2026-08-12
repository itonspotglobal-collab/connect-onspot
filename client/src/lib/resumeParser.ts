/**
 * resumeParser.ts
 *
 * Client-side resume text extraction and profile inference.
 * Supports PDF (pdfjs-dist) and DOCX/DOC (mammoth).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedCandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
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
  fullName: "", email: "", phone: "", location: "",
  targetPosition: "", jobCategory: "",
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

// ─── Known secondary / tech skills ───────────────────────────────────────────

const KNOWN_SKILLS: string[] = [
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "PHP", "Ruby",
  "Swift", "Kotlin", "Go", "Rust", "HTML", "CSS", "SQL", "NoSQL",
  ".NET", "Node.js", "Bash", "Shell Scripting", "R", "MATLAB",
  "React", "Vue.js", "Angular", "Next.js", "Nuxt.js", "Svelte",
  "Django", "Flask", "FastAPI", "Laravel", "Express.js", "Spring Boot",
  "ASP.NET", "Ruby on Rails",
  "React Native", "Flutter", "iOS Development", "Android Development",
  "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Redis", "Elasticsearch",
  "Oracle", "MSSQL", "Firebase",
  "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "GCP",
  "Linux", "Ubuntu", "CI/CD", "Jenkins", "GitHub Actions", "Terraform",
  "Ansible", "Nginx",
  "Git", "GitHub", "Gitlab", "Jira", "Trello", "Asana", "Slack",
  "Postman", "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator",
  "Visual Studio", "VS Code", "IntelliJ", "Eclipse", "Xcode",
  "Tableau", "Power BI", "Google Analytics", "Mixpanel", "Amplitude",
  "Automation Testing", "Manual Testing", "Selenium", "Cypress",
  "Playwright", "Jest", "Mocha", "Chai", "JUnit", "TestNG",
  "Quality Assurance", "QA Testing", "Bug Tracking", "UAT Testing",
  "UI/UX Design", "Wireframing", "Prototyping", "User Research",
  "Microsoft Office", "Google Workspace", "MS Excel", "MS Word",
  "Google Sheets", "Google Docs", "PowerPoint", "Google Slides",
  "Canva", "Notion", "Confluence",
  "Documentation", "Technical Writing", "Transcription", "Transcriber",
  "Translation", "Customer Success", "Live Chat Support",
  "Payroll Processing", "Accounts Payable", "Accounts Receivable",
  "Financial Reporting", "Budgeting", "Forecasting", "SAP", "NetSuite",
  "Data Analysis", "Data Entry", "Data Visualization",
  "Machine Learning", "Deep Learning", "NLP", "TensorFlow", "PyTorch",
  "Recruitment", "Talent Acquisition", "Performance Management",
  "Onboarding", "Employee Relations", "HRIS",
  "SEO", "SEM", "Email Marketing", "Content Marketing", "PPC",
  "Facebook Ads", "Google Ads", "LinkedIn Ads", "Copywriting",
  "Lead Generation", "Cold Calling", "CRM", "Pipeline Management",
  "B2B Sales", "B2C Sales", "Account Management",
  "Problem Solving", "Critical Thinking", "Team Leadership",
  "Project Management", "Agile", "Scrum", "Kanban", "Waterfall",
].sort((a, b) => b.length - a.length);

// ─── Title → category mapping ─────────────────────────────────────────────────
// ORDER MATTERS — first match wins, so more specific entries come first.

const TITLE_TO_CATEGORY: Array<{ keywords: string[]; category: string }> = [
  // Development — specific programming/engineering roles FIRST (before Tech Support)
  {
    keywords: [
      "software developer", "software engineer", "web developer", "web engineer",
      "frontend developer", "front-end developer", "backend developer", "back-end developer",
      "fullstack developer", "full-stack developer", "full stack developer",
      "mobile developer", "ios developer", "android developer",
      "application developer", "app developer",
      "programmer", "coder",
      "devops engineer", "cloud engineer", "platform engineer",
      "data engineer", "data scientist", "machine learning engineer", "ml engineer", "ai engineer",
      "database administrator", "dba",
      "systems analyst", "systems architect", "solutions architect",
      "embedded developer", "game developer",
    ],
    category: "Development",
  },
  // QA / Testing
  {
    keywords: [
      "qa engineer", "quality assurance engineer", "test engineer", "software tester",
      "automation engineer", "automation tester", "qa analyst", "qa specialist",
    ],
    category: "Tech Support",
  },
  // IT Support / Admin (infrastructure roles, NOT development)
  {
    keywords: [
      "it administrator", "it admin", "system administrator", "sysadmin",
      "network engineer", "network administrator", "network analyst",
      "cybersecurity", "security analyst", "information security",
      "it specialist", "it officer", "it manager", "it coordinator",
      "technical support", "tech support", "it support",
      "help desk", "helpdesk", "service desk",
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

// ─── Institution/organization keywords — reject these from name extraction ────

const INSTITUTION_WORDS = new Set([
  // Education
  "university", "universities", "college", "colleges", "institute", "institutes",
  "institution", "school", "schools", "academy", "academies",
  "campus", "polytechnic", "seminary",
  // Company suffixes
  "corporation", "corp", "incorporated", "inc", "limited", "ltd", "llc",
  "company", "companies", "enterprises", "enterprise", "group",
  "technologies", "technology", "solutions", "services", "systems",
  "consulting", "consultancy", "agency", "agencies",
  "department", "division", "bureau",
  // Section headings
  "education", "tertiary", "secondary", "primary", "academic", "academics",
  "experience", "employment", "industry", "project", "projects", "developed",
  "volunteer", "volunteering", "achievement", "achievements",
  "certification", "certifications", "certificate",
  "objective", "objectives", "reference", "references",
  "interests", "hobbies", "activities", "publications",
  "qualifications", "address", "contact", "phone", "email",
  "summary", "profile", "overview", "resume", "cv",
]);

// Whole-line section header pattern
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

// ─── Name extraction (confidence-based) ──────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A word in a person's name: letters (incl. accented), optional trailing period for initials. */
const NAME_WORD_RX = /^[A-Za-zÀ-ÖØ-öø-ÿ][\w\u00C0-\u024F'\-]*\.?$/;

/**
 * Score a line as a potential person name.
 * Positive = more likely a name. Negative = likely not a name.
 * Returns null if the line is definitely not a name.
 */
function scoreAsName(line: string, lineIndex: number): number | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Immediate disqualifiers
  if (NOISE_LINE_RX.test(trimmed)) return null;
  if (CONTACT_LINE_RX.test(trimmed)) return null;

  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 5) return null;

  // Reject if any word is an institution/organization/heading keyword
  const hasInstitutionWord = words.some((w) =>
    INSTITUTION_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ""))
  );
  if (hasInstitutionWord) return null;

  // All words must look like name words (letters only, optional trailing period)
  const allLetterWords = words.every((w) => NAME_WORD_RX.test(w));
  if (!allLetterWords) return null;

  // At least 2 substantive words (not all single-letter initials)
  const substantiveWords = words.filter((w) => w.replace(/\.$/, "").length > 1);
  if (substantiveWords.length < 2) return null;

  // ── Scoring ─────────────────────────────────────────────────────────────
  let score = 0;

  // Position bonus: names usually appear in the first few lines
  if (lineIndex === 0) score += 5;
  else if (lineIndex <= 2) score += 4;
  else if (lineIndex <= 5) score += 3;
  else if (lineIndex <= 10) score += 1;

  // Word count sweet spot: 2-3 words is most common for a name
  if (words.length === 2 || words.length === 3) score += 3;
  else if (words.length === 4) score += 1;

  // Title case bonus: properly capitalized
  const isTitleCase = words.every((w) => w[0] === w[0].toUpperCase());
  if (isTitleCase) score += 2;

  // ALL CAPS: could be a name in header or could be a heading — mild negative
  const isAllCaps = trimmed === trimmed.toUpperCase();
  if (isAllCaps) score -= 1;

  // Mostly alphabetic
  const alphaRatio = trimmed.replace(/[^a-zA-Z]/g, "").length / trimmed.length;
  if (alphaRatio >= 0.95) score += 2;
  else if (alphaRatio < 0.8) score -= 2;

  return score;
}

function extractName(allLines: string[]): string {
  // Scan first 15 non-empty lines
  const candidates = allLines.slice(0, 15).map((l) => l.trim()).filter(Boolean);
  
  let bestLine = "";
  let bestScore = -Infinity;

  candidates.forEach((line, idx) => {
    const score = scoreAsName(line, idx);
    if (score !== null && score > bestScore) {
      bestScore = score;
      bestLine = line;
    }
  });

  // Only accept if score is reasonably positive (not just marginally above noise)
  if (bestScore >= 3) {
    return toTitleCase(bestLine);
  }
  return "";
}

// ─── Email extraction ─────────────────────────────────────────────────────────

const EMAIL_RX = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/;

function extractEmail(allText: string): string {
  // Search the first ~2000 chars (header area) first, then full text
  const head = allText.slice(0, 2000);
  const m = EMAIL_RX.exec(head) ?? EMAIL_RX.exec(allText);
  if (!m) return "";
  const email = m[1].toLowerCase();
  // Reject obvious placeholder values
  if (email.includes("example.com") || email.includes("email.com") || email === "you@email.com") return "";
  return email;
}

// ─── Phone extraction ─────────────────────────────────────────────────────────

// Matches Philippine numbers (09xx, +639xx) and generic international formats
const PHONE_RX = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}/;

function extractPhone(allText: string): string {
  const head = allText.slice(0, 2000);
  const m = PHONE_RX.exec(head);
  if (!m) return "";
  const raw = m[0].trim();
  // Must have at least 7 digits
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return raw;
}

// ─── Location extraction ──────────────────────────────────────────────────────

// Common Philippine city/province names and generic location patterns
const LOCATION_HINTS_RX = /\b(?:cebu|manila|davao|quezon|makati|taguig|pasig|mandaluyong|paranaque|muntinlupa|caloocan|las\s+pinas|malabon|navotas|valenzuela|marikina|pasay|san\s+juan|cavite|laguna|batangas|rizal|bulacan|pampanga|metro\s+manila|ncr|philippines|ph)\b/i;
const CITY_PATTERN_RX = /\b[A-Z][a-zA-Z\s]+(?:City|Province|Region|District)\b/;

// Labels that explicitly introduce an address/location line in a resume
const LOCATION_LABEL_RX =
  /^(?:address|location|current\s+address|home\s+address|residential\s+address|city|based\s+in|residence|residing\s+in|based\s+at)\s*[:\-–]\s*/i;

function extractLocation(sections: ResumeSection[], allText: string): string {
  // ── Pass 1: scan ALL lines for explicit "Address: …" / "Location: …" labels ──
  // This is the highest-confidence signal — works regardless of where it appears.
  const allLines = allText.split("\n");
  for (const line of allLines) {
    const t = line.trim();
    if (!t || t.length > 120) continue;
    if (LOCATION_LABEL_RX.test(t)) {
      // Extract the value after the label
      const value = t.replace(LOCATION_LABEL_RX, "").trim();
      if (value.length >= 3 && value.length <= 100 && !EMAIL_RX.test(value)) {
        return value;
      }
    }
  }

  // ── Pass 2: scan header section for unlabelled location patterns ──────────
  const header = sections.find((s) => s.type === "header");
  const searchLines = header ? header.lines.slice(0, 15) : allText.split("\n").slice(0, 20);

  for (const line of searchLines) {
    const t = line.trim();
    if (!t || NOISE_LINE_RX.test(t) || t.length > 80 || t.length < 3) continue;
    // Skip lines that look like names, emails, phones, or section headings
    if (EMAIL_RX.test(t)) continue;
    if (PHONE_RX.test(t) && t.replace(/\D/g, "").length >= 7) continue;

    // Strong location hint — known PH city/province name in the line
    if (LOCATION_HINTS_RX.test(t) && t.split(/\s+/).length <= 8) {
      return t;
    }
    if (CITY_PATTERN_RX.test(t) && t.split(/\s+/).length <= 6) {
      return t;
    }
    // Generic: "City, Country" or "City, Province" pattern with comma
    if (/^[A-Za-z\s.]+,\s*[A-Za-z\s.]+$/.test(t) && t.split(/\s+/).length <= 7) {
      const words = t.split(/[\s,]+/).filter(Boolean);
      const isLikelyLocation = words.some((w) =>
        /^(?:city|province|state|region|country|ph|phl|philippines|usa|uk|australia|singapore|canada|uae|dubai|remote|metro)$/i.test(w)
      );
      if (isLikelyLocation) return t;
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
  "recruiter", "designer", "tester", "qa", "transcriber", "programmer",
];

/** Strip parenthetical company names: "Software Developer (Alliance Inc.)" → "Software Developer" */
function cleanJobTitle(title: string): string {
  // Remove trailing parenthetical: " (Company Name Inc.)"
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function looksLikeTitle(line: string): boolean {
  const lower = line.toLowerCase();
  const wordCount = line.split(/\s+/).length;
  return (
    wordCount >= 1 && wordCount <= 10 &&
    TITLE_INDICATORS.some((kw) => lower.includes(kw)) &&
    !CONTACT_LINE_RX.test(line)
  );
}

function extractTitle(sections: ResumeSection[], allLines: string[]): string {
  const header = sections.find((s) => s.type === "header");

  // First: lines in header that look like a title (skip likely name lines)
  if (header) {
    for (const line of header.lines.slice(0, 10)) {
      if (scoreAsName(line, 99) === null && looksLikeTitle(line)) {
        return cleanJobTitle(toTitleCase(line.trim()));
      }
    }
  }

  // Second: look at first 20 lines for a title-like line
  for (const line of allLines.slice(1, 20)) {
    if (scoreAsName(line, 99) === null && looksLikeTitle(line) && !CONTACT_LINE_RX.test(line)) {
      return cleanJobTitle(toTitleCase(line.trim()));
    }
  }

  // Third: first title in experience section
  const exp = sections.find((s) => s.type === "experience");
  if (exp) {
    for (const line of exp.lines.slice(0, 10)) {
      if (looksLikeTitle(line)) return cleanJobTitle(toTitleCase(line.trim()));
    }
  }

  return "";
}

// ─── Category ─────────────────────────────────────────────────────────────────

function inferCategory(title: string, allText: string): string {
  // Use title FIRST (primary signal), then a small window of surrounding text as secondary
  const titleLower = title.toLowerCase();
  const textWindow = allText.slice(0, 1500).toLowerCase();

  for (const { keywords, category } of TITLE_TO_CATEGORY) {
    // Strong match: keyword found in the job title itself
    if (keywords.some((kw) => titleLower.includes(kw))) return category;
  }
  // Weaker match: keyword found anywhere in early text
  for (const { keywords, category } of TITLE_TO_CATEGORY) {
    if (keywords.some((kw) => textWindow.includes(kw))) return category;
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

  const dr = new RegExp(DATE_RANGE_RX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = dr.exec(text)) !== null) {
    const start = parseInt(m[1]);
    const isPresent = PRESENT_RX.test(m[0]);
    const end = isPresent ? currentYear : parseInt(m[2] ?? String(currentYear));
    if (start >= 1990 && start <= currentYear) earliest = Math.min(earliest, start);
    if (end >= 1990 && end <= currentYear) latest = Math.max(latest, end);
  }

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

  for (const [alias, canonical] of Object.entries(CORE_SKILL_ALIASES)) {
    if (CORE_SKILL_LIST.includes(canonical) && fullLower.includes(alias)) {
      coreFound.add(canonical);
    }
  }

  for (const skill of KNOWN_SKILLS) {
    const needle = skill.toLowerCase();
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`, "i");
    if (rx.test(allText)) {
      secondaryFound.add(skill);
    }
  }

  const skillLines = skillSections.flatMap((s) => s.lines).join("\n");
  const tokens = skillLines
    .split(/[\n•·,|;\/\t\u2022\u2023\u25E6\u2043\u204C\u204D]+/)
    .map((t) => t.replace(/^\s*[\-*●▪▸►→]+\s*/, "").trim())
    .filter((t) => t.length > 1 && t.length < 60);

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const isCore = Object.keys(CORE_SKILL_ALIASES).some((a) => lower.includes(a) && CORE_SKILL_LIST.includes(CORE_SKILL_ALIASES[a]));
    if (isCore) continue;
    const isKnown = KNOWN_SKILLS.some((k) => k.toLowerCase() === lower);
    if (isKnown) continue;
    if (/^\d+$/.test(token)) continue;
    if (NOISE_LINE_RX.test(token)) continue;
    if (token.split(/\s+/).length > 5) continue;
    secondaryFound.add(toTitleCase(token));
  }

  const coreArr = Array.from(coreFound);
  const secondaryArr = Array.from(secondaryFound)
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
  } catch {
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

  // Name — confidence-based scoring across first 15 raw lines
  const name = extractName(lines);
  if (name) { extracted.fullName = name; extractedFields.push("fullName"); }

  // Email
  const email = extractEmail(rawText);
  if (email) { extracted.email = email; extractedFields.push("email"); }

  // Phone
  const phone = extractPhone(rawText);
  if (phone) { extracted.phone = phone; extractedFields.push("phone"); }

  // Location
  const location = extractLocation(sections, rawText);
  if (location) { extracted.location = location; extractedFields.push("location"); }

  // Title — cleaned of company-name suffixes
  const title = extractTitle(sections, lines);
  if (title) { extracted.targetPosition = title; extractedFields.push("targetPosition"); }

  // Years of experience
  const yearsId = extractYearsOfExperience(expSec, rawText);
  if (yearsId) { extracted.yearsOfExperience = yearsId; extractedFields.push("yearsOfExperience"); }

  // Seniority
  const seniority = inferSeniority(title, yearsId);
  extracted.seniority = seniority;
  if (title || yearsId) extractedFields.push("seniority");

  // Category — title is primary signal
  const category = inferCategory(title, rawText);
  if (category) { extracted.jobCategory = category; extractedFields.push("jobCategory"); }

  // Skills
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
    extracted.yearsOfExperience, (extracted.coreSkills?.length ?? 0) > 0,
    (extracted.secondarySkills?.length ?? 0) > 0,
  ].filter(Boolean).length;
  const confidence: "high" | "partial" | "low" =
    keyCount >= 4 ? "high" : keyCount >= 2 ? "partial" : "low";

  if (import.meta.env.DEV) {
    console.group("[ResumeParser] Extraction complete");
    console.log("name:", extracted.fullName || "(none)");
    console.log("email:", extracted.email || "(none)");
    console.log("phone:", extracted.phone || "(none)");
    console.log("location:", extracted.location || "(none)");
    console.log("title:", extracted.targetPosition || "(none)");
    console.log("category:", extracted.jobCategory || "(none)");
    console.log("years:", extracted.yearsOfExperience || "(none)");
    console.log("seniority:", extracted.seniority);
    console.log("coreSkills:", extracted.coreSkills);
    console.log("confidence:", confidence);
    console.groupEnd();
  }

  return {
    fullName:          extracted.fullName          ?? "",
    email:             extracted.email             ?? "",
    phone:             extracted.phone             ?? "",
    location:          extracted.location          ?? "",
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
