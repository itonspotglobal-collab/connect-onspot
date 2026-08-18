/**
 * vanessaResumeAnalyzer.ts
 *
 * Vanessa Resume Intelligence — a dedicated resume-parsing capability that
 * reuses the project's existing OpenAI infrastructure (same API key / client)
 * WITHOUT touching Vanessa's normal chat/assistant system.
 *
 * Architecture:
 *   resumeText
 *     → Chat Completions (gpt-4o, json_object mode)
 *     → Raw JSON
 *     → Zod parse + deterministic post-validation
 *     → VanessaResumeAnalysis
 *
 * Resume content is NEVER written to Vanessa's global RAG / knowledge base.
 */

import OpenAI from "openai";
import { z } from "zod";

// ── Constants ──────────────────────────────────────────────────────────────────

export const VANESSA_RESUME_VERSION = "vanessa-resume-v1";

/** Max characters sent to the AI to stay well within token budgets. */
const MAX_RESUME_CHARS = 8_000;

/** Confidence thresholds */
const THRESHOLD_AUTOFILL = 0.80;  // safe to fill empty fields
const THRESHOLD_CORROBORATE = 0.60; // use only when deterministic parser agrees

// ── OpenAI client ──────────────────────────────────────────────────────────────
// Separate instance from the Assistants-API client in openaiService.ts.
// Uses the same OPENAI_API_KEY but Chat Completions (not Assistants API).
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ── Zod schema ─────────────────────────────────────────────────────────────────

const ExperienceEntrySchema = z.object({
  jobTitle:         z.string(),
  company:          z.string(),
  startDate:        z.string().optional(),
  endDate:          z.string().optional(),
  duration:         z.string().optional(),
  responsibilities: z.array(z.string()),
});

const EducationEntrySchema = z.object({
  school:       z.string(),
  degree:       z.string(),
  fieldOfStudy: z.string().optional(),
  startYear:    z.string().optional(),
  endYear:      z.string().optional(),
});

const CertificationEntrySchema = z.object({
  name:   z.string(),
  issuer: z.string().optional(),
  date:   z.string().optional(),
});

const ConfidenceSchema = z.object({
  overall:           z.number().min(0).max(1),
  professionalTitle: z.number().min(0).max(1).optional(),
  summary:           z.number().min(0).max(1).optional(),
  experience:        z.number().min(0).max(1).optional(),
  education:         z.number().min(0).max(1).optional(),
  skills:            z.number().min(0).max(1).optional(),
  location:          z.number().min(0).max(1).optional(),
});

const VanessaResumeOutputSchema = z.object({
  personalInfo: z.object({
    fullName:  z.string(),
    email:     z.string(),
    phone:     z.string(),
    location:  z.string(),
    languages: z.array(z.string()),
  }),
  professional: z.object({
    title:             z.string(),
    summary:           z.string(),
    yearsOfExperience: z.string(),
    seniority:         z.string(),
  }),
  skills: z.object({
    core:      z.array(z.string()),
    secondary: z.array(z.string()),
  }),
  experience:     z.array(ExperienceEntrySchema),
  education:      z.array(EducationEntrySchema),
  certifications: z.array(CertificationEntrySchema),
  confidence:     ConfidenceSchema,
});

export type VanessaResumeOutput = z.infer<typeof VanessaResumeOutputSchema>;

// ── Public result type ─────────────────────────────────────────────────────────

export interface VanessaResumeAnalysis {
  /** Which parser produced this result. */
  parserVersion: string;
  /** Whether Vanessa AI was used (false means fallback to deterministic). */
  source: "vanessa" | "deterministic-fallback";
  personalInfo: {
    fullName:  string;
    email:     string;
    phone:     string;
    location:  string;
    languages: string[];
  };
  professional: {
    title:             string;
    summary:           string;
    yearsOfExperience: string;
    seniority:         string;
  };
  skills: {
    core:      string[];
    secondary: string[];
  };
  experience: Array<{
    jobTitle:         string;
    company:          string;
    startDate?:       string;
    endDate?:         string;
    duration?:        string;
    responsibilities: string[];
  }>;
  education: Array<{
    school:        string;
    degree:        string;
    fieldOfStudy?: string;
    startYear?:    string;
    endYear?:      string;
  }>;
  certifications: Array<{
    name:    string;
    issuer?: string;
    date?:   string;
  }>;
  confidence: {
    overall:           number;
    professionalTitle: number;
    summary:           number;
    experience:        number;
    education:         number;
    skills:            number;
    location:          number;
  };
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Vanessa Resume Intelligence, the resume interpretation capability of OnSpot's Vanessa AI platform.

Your sole job is to transform resume text into a structured, validated candidate profile JSON object.

You must interpret resume sections SEMANTICALLY — not simply based on neighboring lines or keyword matching.

Never invent information. If a field cannot be confidently determined, return an empty string or empty array.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD CLASSIFICATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTACT INFORMATION
- Email addresses (anything@domain.com) → personalInfo.email ONLY.
  An email address can NEVER be a jobTitle, company, degree, school, or certification.
- Phone numbers → personalInfo.phone ONLY.
  A phone number can NEVER be a jobTitle, company, or any other field.
- Personal address/city → personalInfo.location.
  Distinguish the candidate's HOME location from company or school locations.

PROFESSIONAL TITLE (professional.title)
Determine it using this priority order:
  1. Explicit professional headline directly beneath the candidate's name
  2. An explicit "Professional Title" or "Profile" heading
  3. Most recent work-experience job title
  4. Semantic inference from overall experience and skills — ONLY if confidence >= 0.75

NEVER use any of the following as the professional title:
  - Degree names (Bachelor of Science, Master of Arts, Diploma in...)
  - School/university names
  - Email addresses
  - Phone numbers
  - Location / address
  - Objective or summary sentences
  - Company names
  - Section headings (Skills, Experience, Education, About Me)

If you cannot determine a professional title with >= 0.75 confidence, return "" (empty string).

PROFESSIONAL SUMMARY (professional.summary)
Map sections labeled: Summary, Professional Summary, Objective, Career Objective, About Me, Professional Profile.
Return CLEAN PLAIN TEXT. Strip all HTML tags (<p>, <div>, <br>, etc.).
Join broken lines from the same paragraph. Do not invent content.

EXPERIENCE (experience[])
An experience entry groups: Job Title + Company + Dates + Responsibilities.
ALL responsibilities/achievements for a single job must be in ONE entry, not fragmented into multiple entries.

REJECT an entry as experience if:
  - The "jobTitle" is an email address
  - The "jobTitle" is a phone number
  - The "jobTitle" is only an education degree
  - The "jobTitle" is "About Me", "Experience", "Education", "Summary", etc.
  - There is no job title AND no company AND no date range
  - The entry is just a single responsibility sentence with no employer context

Academic projects (3rd Year College project, Capstone Project, etc.) are NOT work experience unless the resume explicitly describes them as professional employment.

For each valid experience entry at minimum ONE of these must be true:
  - Has a valid job title + company name
  - Has a valid job title + date range
  - Has a company name + date range + clearly associated role

EDUCATION (education[])
Correctly group: Degree + School + Dates.
  "Bachelor of Science in Computer Engineering" → education.degree
  "Cebu Institute of Technology" → education.school
  "2018 – 2023" → startYear / endYear
Do NOT place a degree into professional.title.

CERTIFICATIONS (certifications[])
Only actual certifications/accreditations (AWS Certified..., Microsoft Azure..., Civil Service Eligibility, etc.).
Do NOT classify: school degrees, project names, company training headings, skill names.

SKILLS (skills.core / skills.secondary)
Use explicit Skills sections first. Also identify strongly evidenced technical skills from experience descriptions.
Normalize aliases: React.js/ReactJS → React, NodeJS → Node.js, Postgres → PostgreSQL, ASP .NET → ASP.NET.
Do NOT infer unsupported technologies.
Core skills: primary technical/professional skills.
Secondary skills: supporting or supplementary skills.

LANGUAGES (personalInfo.languages)
Extract actual spoken/written human languages (English, Filipino, Cebuano, Japanese...).
Strip proficiency labels: "English — Fluent" → "English".
Do NOT classify programming languages (Java, Python, C#) as human languages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE SCORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return a confidence object (0.0–1.0) for:
  overall, professionalTitle, summary, experience, education, skills, location

If a field was clearly present in the resume: 0.85–1.0
If inferred from context: 0.60–0.84
If uncertain or empty: 0.0–0.59

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY a valid JSON object matching this exact structure. No markdown fences. No explanation text.

{
  "personalInfo": {
    "fullName": "",
    "email": "",
    "phone": "",
    "location": "",
    "languages": []
  },
  "professional": {
    "title": "",
    "summary": "",
    "yearsOfExperience": "",
    "seniority": ""
  },
  "skills": {
    "core": [],
    "secondary": []
  },
  "experience": [
    {
      "jobTitle": "",
      "company": "",
      "startDate": "",
      "endDate": "",
      "duration": "",
      "responsibilities": []
    }
  ],
  "education": [
    {
      "school": "",
      "degree": "",
      "fieldOfStudy": "",
      "startYear": "",
      "endYear": ""
    }
  ],
  "certifications": [
    {
      "name": "",
      "issuer": "",
      "date": ""
    }
  ],
  "confidence": {
    "overall": 0.0,
    "professionalTitle": 0.0,
    "summary": 0.0,
    "experience": 0.0,
    "education": 0.0,
    "skills": 0.0,
    "location": 0.0
  }
}`;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Strip HTML tags and normalise whitespace. */
function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")   // remove HTML tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s()+\-./]{7,20}$/;
const DEGREE_RE = /\b(bachelor|master|doctor|phd|mba|bs|ba|ms|ma|bsc|msc|diploma|associate|certificate of|licenti)/i;
const SECTION_HEADING_RE = /^(about me|experience|education|skills|summary|objective|certifications?|languages?|projects?|references?|contact)$/i;
const UNIVERSITY_RE = /\b(university|college|institute|polytechnic|school of|academy|cit[- ]u)\b/i;

function looksLikeEmail(v: string): boolean { return EMAIL_RE.test(v.trim()); }
function looksLikePhone(v: string): boolean { return PHONE_RE.test(v.trim()) && /\d{6,}/.test(v); }
function looksLikeDegree(v: string): boolean { return DEGREE_RE.test(v.trim()); }
function looksLikeUniversity(v: string): boolean { return UNIVERSITY_RE.test(v.trim()); }
function looksLikeSectionHeading(v: string): boolean { return SECTION_HEADING_RE.test(v.trim()); }
function isTooLong(v: string, max: number): boolean { return v.length > max; }

/** Validate and clean Vanessa's raw output, applying confidence thresholds. */
function validateAndClean(raw: VanessaResumeOutput): VanessaResumeAnalysis {
  const conf = {
    overall:           raw.confidence.overall ?? 0,
    professionalTitle: raw.confidence.professionalTitle ?? raw.confidence.overall ?? 0,
    summary:           raw.confidence.summary ?? raw.confidence.overall ?? 0,
    experience:        raw.confidence.experience ?? raw.confidence.overall ?? 0,
    education:         raw.confidence.education ?? raw.confidence.overall ?? 0,
    skills:            raw.confidence.skills ?? raw.confidence.overall ?? 0,
    location:          raw.confidence.location ?? raw.confidence.overall ?? 0,
  };

  // ── Personal info ──────────────────────────────────────────────────────────
  const location = conf.location >= THRESHOLD_CORROBORATE
    ? cleanText(raw.personalInfo.location)
    : "";

  // ── Professional title ────────────────────────────────────────────────────
  let title = cleanText(raw.professional.title);
  if (
    looksLikeEmail(title) ||
    looksLikePhone(title) ||
    looksLikeDegree(title) ||
    looksLikeUniversity(title) ||
    looksLikeSectionHeading(title) ||
    isTooLong(title, 100) ||
    conf.professionalTitle < THRESHOLD_CORROBORATE
  ) {
    title = "";
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = conf.summary >= THRESHOLD_CORROBORATE
    ? cleanText(raw.professional.summary)
    : "";

  // ── Experience ─────────────────────────────────────────────────────────────
  const experience = conf.experience >= THRESHOLD_CORROBORATE
    ? raw.experience
        .map(e => ({
          jobTitle:         cleanText(e.jobTitle),
          company:          cleanText(e.company),
          startDate:        cleanText(e.startDate),
          endDate:          cleanText(e.endDate),
          duration:         cleanText(e.duration),
          responsibilities: e.responsibilities.map(r => cleanText(r)).filter(Boolean),
        }))
        .filter(e => {
          const t = e.jobTitle;
          const c = e.company;
          // Reject bad job titles
          if (looksLikeEmail(t) || looksLikePhone(t)) return false;
          if (looksLikeDegree(t) || looksLikeUniversity(t)) return false;
          if (looksLikeSectionHeading(t)) return false;
          if (isTooLong(t, 120)) return false;
          // Must have at least a job title or company
          if (!t && !c) return false;
          return true;
        })
    : [];

  // ── Education ──────────────────────────────────────────────────────────────
  const education = conf.education >= THRESHOLD_CORROBORATE
    ? raw.education
        .map(e => ({
          school:       cleanText(e.school),
          degree:       cleanText(e.degree),
          fieldOfStudy: cleanText(e.fieldOfStudy),
          startYear:    cleanText(e.startYear),
          endYear:      cleanText(e.endYear),
        }))
        .filter(e => e.school || e.degree)
    : [];

  // ── Certifications ─────────────────────────────────────────────────────────
  const certifications = raw.certifications
    .map(c => ({
      name:   cleanText(c.name),
      issuer: cleanText(c.issuer),
      date:   cleanText(c.date),
    }))
    .filter(c => {
      if (!c.name) return false;
      // Don't accept degrees or university names as certifications
      if (looksLikeDegree(c.name)) return false;
      if (looksLikeUniversity(c.name)) return false;
      return true;
    });

  // ── Skills ─────────────────────────────────────────────────────────────────
  const coreSkills = conf.skills >= THRESHOLD_CORROBORATE
    ? raw.skills.core.map(s => cleanText(s)).filter(Boolean)
    : [];
  const secondarySkills = conf.skills >= THRESHOLD_CORROBORATE
    ? raw.skills.secondary.map(s => cleanText(s)).filter(Boolean)
    : [];

  // ── Languages — filter out programming languages ───────────────────────────
  const PROGRAMMING_LANGUAGES = new Set([
    "java","javascript","python","c","c#","c++","php","ruby","swift","kotlin",
    "go","rust","scala","r","matlab","perl","typescript","dart","lua","bash",
    "shell","html","css","sql","xml","assembly","cobol","fortran","haskell",
    "erlang","elixir","clojure","groovy","vba","objective-c","abap",
  ]);
  const languages = raw.personalInfo.languages
    .map(l => cleanText(l))
    .filter(l => l && !PROGRAMMING_LANGUAGES.has(l.toLowerCase()));

  // ── YoE / seniority only when confident ───────────────────────────────────
  const yearsOfExperience = conf.experience >= THRESHOLD_CORROBORATE
    ? cleanText(raw.professional.yearsOfExperience)
    : "";
  const seniority = conf.experience >= THRESHOLD_AUTOFILL
    ? cleanText(raw.professional.seniority)
    : "";

  return {
    parserVersion: VANESSA_RESUME_VERSION,
    source: "vanessa",
    personalInfo: {
      fullName:  cleanText(raw.personalInfo.fullName),
      email:     cleanText(raw.personalInfo.email),
      phone:     cleanText(raw.personalInfo.phone),
      location,
      languages,
    },
    professional: { title, summary, yearsOfExperience, seniority },
    skills:        { core: coreSkills, secondary: secondarySkills },
    experience,
    education,
    certifications,
    confidence: conf,
  };
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Analyze a resume using Vanessa Resume Intelligence (OpenAI Chat Completions).
 *
 * Throws if OpenAI is unavailable — callers must catch and fall back to the
 * deterministic parser.
 *
 * @param resumeText  Plain text extracted from the resume file.
 * @param candidateId Optional — used for observability logging only.
 */
export async function analyzeResumeWithVanessa(
  resumeText: string,
  candidateId?: string,
): Promise<VanessaResumeAnalysis> {
  if (!openaiClient) {
    throw new Error("OPENAI_API_KEY is not configured. Cannot run Vanessa Resume Intelligence.");
  }

  // Truncate to avoid exceeding token budget
  const truncated = resumeText.slice(0, MAX_RESUME_CHARS);

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,   // low temperature for deterministic extraction
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze the following resume text and return a structured JSON profile.\n\nRESUME TEXT:\n${truncated}`,
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";

  // Parse and validate with Zod
  let parsed: VanessaResumeOutput;
  try {
    const json = JSON.parse(rawContent);
    parsed = VanessaResumeOutputSchema.parse(json);
  } catch (err) {
    throw new Error(`Vanessa returned invalid JSON structure: ${err}`);
  }

  const result = validateAndClean(parsed);

  // Observability log — no PII, no resume content
  console.log(`🧠 Vanessa Resume Intelligence`, {
    candidateId: candidateId ?? "unknown",
    parser:      VANESSA_RESUME_VERSION,
    overallConfidence: result.confidence.overall,
    fieldsExtracted: [
      result.professional.title   && "professionalTitle",
      result.professional.summary && "summary",
      result.skills.core.length   && "skills",
      result.experience.length    && "experience",
      result.education.length     && "education",
      result.certifications.length && "certifications",
      result.personalInfo.languages.length && "languages",
      result.personalInfo.location && "location",
    ].filter(Boolean),
  });

  return result;
}
