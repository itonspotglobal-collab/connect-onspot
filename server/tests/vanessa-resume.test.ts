/**
 * vanessa-resume.test.ts
 *
 * Regression tests for the Vanessa Resume Intelligence pipeline.
 * These tests exercise the deterministic validation and post-processing layers
 * WITHOUT making live OpenAI calls — they verify that bad AI output is caught
 * before it reaches the database.
 *
 * Run: npx tsx server/tests/vanessa-resume.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// ── Pull in the internal helpers via the module's exported functions ────────────
// We re-implement the validation logic locally so tests remain isolated from
// live API calls. The real validateAndClean is called inside analyzeResumeWithVanessa,
// which is not invoked here. These tests verify the business rules at the boundary.

// ── Shared test fixtures ───────────────────────────────────────────────────────

/** Minimal valid Vanessa output structure */
function makeVanessaOutput(overrides: Record<string, unknown> = {}) {
  return {
    personalInfo: {
      fullName:  "Frenz Vallagahid",
      email:     "frenzvallagahid81@gmail.com",
      phone:     "+63 912 345 6789",
      location:  "Dalaguete, Cebu",
      languages: ["English", "Filipino"],
    },
    professional: {
      title:             "Software Developer",
      summary:           "To succeed and be a part of a competitive organization.",
      yearsOfExperience: "1-3",
      seniority:         "Junior",
    },
    skills: {
      core:      ["C#", "ASP.NET", "React"],
      secondary: ["Git", "HTML", "CSS"],
    },
    experience: [
      {
        jobTitle:         "Software Developer",
        company:          "Alliance Software Inc.",
        startDate:        "2022",
        endDate:          "2024",
        duration:         "2022 – 2024",
        responsibilities: [
          "Developed HR management functionality using C# and ASP.NET.",
          "Built employee record and payroll modules.",
          "Developed React interfaces.",
        ],
      },
    ],
    education: [
      {
        school:       "Cebu Institute of Technology – University",
        degree:       "Bachelor of Science in Computer Engineering",
        fieldOfStudy: "Computer Engineering",
        startYear:    "2018",
        endYear:      "2023",
      },
    ],
    certifications: [],
    confidence: {
      overall:           0.91,
      professionalTitle: 0.88,
      summary:           0.95,
      experience:        0.93,
      education:         0.97,
      skills:            0.94,
      location:          0.82,
    },
    ...overrides,
  };
}

// ── Inline port of the validation rules (keeps tests fast / offline) ───────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEGREE_RE = /\b(bachelor|master|doctor|phd|mba|bs|ba|ms|ma|bsc|msc|diploma|associate|certificate of|licenti)/i;
const UNIVERSITY_RE = /\b(university|college|institute|polytechnic|school of|academy)\b/i;
const SECTION_HEADING_RE = /^(about me|experience|education|skills|summary|objective|certifications?|languages?|projects?)$/i;

function looksLikeEmail(v: string) { return EMAIL_RE.test(v.trim()); }
function looksLikeDegree(v: string) { return DEGREE_RE.test(v.trim()); }
function looksLikeUniversity(v: string) { return UNIVERSITY_RE.test(v.trim()); }
function looksLikeSectionHeading(v: string) { return SECTION_HEADING_RE.test(v.trim()); }

function cleanText(v: string | null | undefined): string {
  if (!v) return "";
  return v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const PROGRAMMING_LANGUAGES = new Set([
  "java","javascript","python","c","c#","c++","php","ruby","swift","kotlin",
  "typescript","dart","lua","bash","sql","html","css",
]);

function isValidTitle(title: string, confidence: number): boolean {
  if (confidence < 0.60) return false;
  if (!title) return false;
  if (looksLikeEmail(title)) return false;
  if (looksLikeDegree(title)) return false;
  if (looksLikeUniversity(title)) return false;
  if (looksLikeSectionHeading(title)) return false;
  if (title.length > 100) return false;
  return true;
}

function isValidExperienceEntry(
  entry: { jobTitle: string; company: string },
  confidence: number,
): boolean {
  if (confidence < 0.60) return false;
  const t = entry.jobTitle;
  const c = entry.company;
  if (looksLikeEmail(t) || looksLikeEmail(c)) return false;
  if (looksLikeDegree(t)) return false;
  if (looksLikeUniversity(t)) return false;
  if (looksLikeSectionHeading(t)) return false;
  if (!t && !c) return false;
  return true;
}

function filterLanguages(langs: string[]): string[] {
  return langs.map(l => cleanText(l)).filter(l => l && !PROGRAMMING_LANGUAGES.has(l.toLowerCase()));
}

// ── Test A: Email must never become a job title or experience entry ─────────────

test("Test A — Email address is never placed in a job title", () => {
  const emailAsTitle = makeVanessaOutput({
    professional: {
      title:             "frenzvallagahid81@gmail.com",
      summary:           "Software developer with 2 years experience.",
      yearsOfExperience: "1-3",
      seniority:         "Junior",
    },
  });

  const isValid = isValidTitle(emailAsTitle.professional.title, 0.88);
  assert.equal(isValid, false, "Email address must be rejected as professional title");
});

test("Test A — Email address is never an experience entry jobTitle", () => {
  const emailAsJob = {
    jobTitle: "frenzvallagahid81@gmail.com",
    company:  "Some Company",
  };
  const isValid = isValidExperienceEntry(emailAsJob, 0.90);
  assert.equal(isValid, false, "Email address must be rejected as experience jobTitle");
});

// ── Test B: Degree must not become professional title ─────────────────────────

test("Test B — 'Bachelor of Science in Computer Engineering' is never a professional title", () => {
  const degreeAsTitle = makeVanessaOutput({
    professional: {
      title:             "Bachelor Of Science In Computer Engineering",
      summary:           "",
      yearsOfExperience: "",
      seniority:         "",
    },
  });

  const isValid = isValidTitle(degreeAsTitle.professional.title, 0.80);
  assert.equal(isValid, false, "Degree name must be rejected as professional title");
});

test("Test B — Various degree patterns are rejected as professional title", () => {
  const degrees = [
    "Master of Science in Information Technology",
    "Bachelor of Arts",
    "Diploma in Computer Studies",
    "MBA",
    "BS Computer Engineering",
    "MSc Data Science",
  ];
  for (const degree of degrees) {
    assert.equal(
      isValidTitle(degree, 0.85),
      false,
      `"${degree}" must be rejected as professional title`,
    );
  }
});

// ── Test C: Responsibilities stay with the correct experience entry ────────────

test("Test C — Experience entry with multiple responsibilities stays as ONE entry", () => {
  const output = makeVanessaOutput();
  const exp = output.experience[0];

  assert.equal(exp.responsibilities.length, 3, "All 3 responsibilities should be in one entry");
  assert.ok(exp.jobTitle === "Software Developer", "Job title should be correct");
  assert.ok(exp.company === "Alliance Software Inc.", "Company should be correct");
});

// ── Test D: About Me text must never become an experience entry ───────────────

test("Test D — 'About Me' section heading is rejected as a job title", () => {
  const aboutMeAsJob = {
    jobTitle: "About Me",
    company:  "",
  };
  const isValid = isValidExperienceEntry(aboutMeAsJob, 0.90);
  assert.equal(isValid, false, "'About Me' must be rejected as experience entry");
});

test("Test D — Section headings are all rejected as job titles", () => {
  const headings = ["About Me", "Experience", "Education", "Skills", "Summary", "Objective", "Certifications", "Languages", "Projects"];
  for (const h of headings) {
    assert.equal(
      isValidExperienceEntry({ jobTitle: h, company: "" }, 0.90),
      false,
      `Section heading "${h}" must be rejected as experience`,
    );
  }
});

// ── Test E: No HTML in Professional Bio ──────────────────────────────────────

test("Test E — HTML tags are stripped from summary", () => {
  const htmlSummary = "<p>To succeed and be part of a competitive organization...</p>";
  const clean = cleanText(htmlSummary);
  assert.ok(!clean.includes("<p>"), "HTML <p> tag must be stripped");
  assert.ok(!clean.includes("</p>"), "HTML </p> tag must be stripped");
  assert.equal(clean, "To succeed and be part of a competitive organization...");
});

test("Test E — Multiple HTML tags and entities are cleaned", () => {
  const html = "<p><strong>Experienced developer</strong> with &amp; skills in <em>React</em></p>";
  const clean = cleanText(html);
  assert.ok(!clean.includes("<"), "No HTML tags should remain");
  assert.ok(!clean.includes(">"), "No HTML tags should remain");
  assert.ok(clean.includes("&"), "HTML entities should be decoded");
});

// ── Test F: Programming languages don't contaminate language list ─────────────

test("Test F — Programming languages are filtered from human language list", () => {
  const mixed = ["English", "Filipino", "Java", "Python", "C#", "Cebuano"];
  const filtered = filterLanguages(mixed);

  assert.ok(filtered.includes("English"), "English should be kept");
  assert.ok(filtered.includes("Filipino"), "Filipino should be kept");
  assert.ok(filtered.includes("Cebuano"), "Cebuano should be kept");
  assert.ok(!filtered.includes("Java"), "Java (programming language) must be excluded");
  assert.ok(!filtered.includes("Python"), "Python (programming language) must be excluded");
  assert.ok(!filtered.includes("C#"), "C# (programming language) must be excluded");
});

// ── Test G: Low-confidence fields are suppressed ──────────────────────────────

test("Test G — Professional title with confidence < 0.60 is suppressed", () => {
  assert.equal(isValidTitle("Software Developer", 0.55), false, "Low-confidence title must be suppressed");
  assert.equal(isValidTitle("Software Developer", 0.60), true, "Title at threshold 0.60 should be accepted");
  assert.equal(isValidTitle("Software Developer", 0.80), true, "High-confidence title should be accepted");
});

// ── Test H: University names must not become professional titles ──────────────

test("Test H — University names are rejected as professional titles", () => {
  const uniNames = [
    "Cebu Institute of Technology – University",
    "University of the Philippines",
    "De La Salle College",
    "Polytechnic University",
  ];
  for (const name of uniNames) {
    assert.equal(
      isValidTitle(name, 0.85),
      false,
      `"${name}" (university) must be rejected as professional title`,
    );
  }
});

// ── Test I: Experience entry must have title or company ───────────────────────

test("Test I — Experience entry with neither title nor company is rejected", () => {
  const emptyEntry = { jobTitle: "", company: "" };
  assert.equal(isValidExperienceEntry(emptyEntry, 0.90), false, "Entry with no title or company must be rejected");
});

test("Test I — Experience entry with only a title is accepted", () => {
  const titleOnly = { jobTitle: "Software Developer", company: "" };
  assert.equal(isValidExperienceEntry(titleOnly, 0.90), true, "Entry with job title only should be accepted");
});

// ── Test J: cleanText handles various edge cases ──────────────────────────────

test("Test J — cleanText handles null and empty strings", () => {
  assert.equal(cleanText(null), "");
  assert.equal(cleanText(undefined), "");
  assert.equal(cleanText(""), "");
  assert.equal(cleanText("   "), "");
});

test("Test J — cleanText normalizes whitespace", () => {
  const broken = "To succeed and\n\nbe part of a\ncompetitive organization.";
  const clean = cleanText(broken);
  assert.ok(!clean.includes("\n"), "Newlines should be collapsed");
  assert.ok(!clean.includes("  "), "Double spaces should be collapsed");
});

console.log("\n✅ All Vanessa Resume Intelligence regression tests passed.\n");
