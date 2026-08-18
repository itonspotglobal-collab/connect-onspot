import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  BriefcaseBusiness,
  Target,
  TrendingUp,
  ChevronRight,
  SearchX,
  Loader2,
  Inbox,
  Upload,
  FileText,
  X as XIcon,
  Shield,
  Zap,
  Heart,
  Award,
  Lightbulb,
  Clock,
  BarChart2,
  Star,
  User,
  Briefcase,
  Tag,
  Plus,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Building2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Job } from "@shared/schema";
import { usePostedJobs } from "@/hooks/usePostedJobs";
import {
  parseResumeFile,
  extractTextFromFile,
  type ExtractedCandidateProfile,
  type WorkHistoryEntry,
  type EducationEntry,
  type CertificationEntry,
} from "@/lib/resumeParser";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { parsePhoneNumber as libParsePhoneNumber } from "libphonenumber-js";

// ─── CandidateProfile type ────────────────────────────────────────────────────

type Phase = "flow" | "matching" | "results";

// WorkHistoryEntry is imported from resumeParser

interface CandidateProfile {
  // Step 1 — Upload
  resumeFile: File | null;
  /** Persisted resume URL from DB — shown when no new File has been selected. */
  resumeUrl: string;
  /** Persisted filename from DB — displayed alongside the on-file indicator. */
  resumeFileName: string;
  // Step 2 — Finalize Information (primary source of truth for matching)
  fullName: string;
  email: string;
  phone: string;
  location: string;
  targetPosition: string; // FREE TEXT — most important matching input
  jobCategory: string; // niche / department
  yearsOfExperience: string; // "0-1" | "1-3" | "3-5" | "5+"
  seniority: string; // "entry" | "mid" | "senior"
  coreSkills: string[]; // from skill chips
  secondarySkills: string[]; // from free-text tag input
  workHistory: WorkHistoryEntry[];
  /** Parsed from resume — persisted to candidate.education at save time. */
  education: EducationEntry[];
  /** Parsed from resume — persisted to candidate.certifications at save time. */
  certifications: CertificationEntry[];
  /** Parsed from resume — stored in candidate.preferences.languages at save time. */
  languages: string[];
  preferredSetup: string; // "Remote" | "Hybrid" | "On-site"
  preferredShift: string;
  preferredJobType: string; // "Full-time" | "Part-time"
  workEnvironment: string;
  summary: string; // optional short bio
  // Step 3 — Culture Evaluation
  valuesAnswers: Record<string, string>;
}

const EMPTY_WORK_ENTRY: WorkHistoryEntry = {
  jobTitle: "",
  company: "",
  duration: "",
  responsibilities: "",
};

const EMPTY_PROFILE: CandidateProfile = {
  resumeFile: null,
  resumeUrl: "",
  resumeFileName: "",
  fullName: "",
  email: "",
  phone: "",
  location: "",
  targetPosition: "",
  jobCategory: "",
  yearsOfExperience: "",
  seniority: "",
  coreSkills: [],
  secondarySkills: [],
  workHistory: [],
  education: [],
  certifications: [],
  languages: [],
  preferredSetup: "",
  preferredShift: "",
  preferredJobType: "",
  workEnvironment: "",
  summary: "",
  valuesAnswers: {},
};

// ─── Flow step definitions ────────────────────────────────────────────────────

const FLOW_STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Profile", icon: FileText },
  { label: "Culture", icon: Heart },
  { label: "Result", icon: Sparkles },
  { label: "Jobs", icon: BriefcaseBusiness },
];
const TOTAL_FLOW_STEPS = FLOW_STEPS.length; // 5 steps; actual flow steps are 0-3
const LAST_FLOW_STEP = 3; // step index that triggers matching (Culture Result)

// ─── Constants for Finalize step ─────────────────────────────────────────────

const CORE_SKILLS = [
  "Customer Support",
  "Admin Support",
  "Data Entry",
  "Calendar Management",
  "Email Management",
  "Research",
  "Social Media",
  "Content Writing",
  "Bookkeeping",
  "Project Coordination",
  "Sales Support",
  "Technical Support",
  "CRM Management",
  "Scheduling",
  "Report Generation",
];

const JOB_CATEGORIES = [
  "Admin",
  "Customer Support",
  "Marketing",
  "Finance",
  "Tech Support",
  "Sales",
  "Operations",
  "Design",
  "Development",
  "HR",
];

const EXPERIENCE_LEVELS = [
  {
    id: "0-1",
    label: "0–1 year",
    desc: "New to professional remote work or just starting out",
  },
  {
    id: "1-3",
    label: "1–3 years",
    desc: "Solid foundation with some hands-on experience",
  },
  {
    id: "3-5",
    label: "3–5 years",
    desc: "Confident, well-rounded, and independently capable",
  },
  {
    id: "5+",
    label: "5+ years",
    desc: "Senior-level expertise with a strong track record",
  },
];

// Human-readable labels for auto-extracted field badges shown in Step 2 notice
const EXTRACTED_FIELD_LABELS: Record<string, string> = {
  fullName: "Name",
  targetPosition: "Job Title",
  jobCategory: "Category",
  yearsOfExperience: "Experience",
  seniority: "Seniority",
  coreSkills: "Core Skills",
  secondarySkills: "Other Skills",
  summary: "Summary",
};

const SENIORITY_LEVELS = [
  {
    id: "entry",
    label: "Entry / Junior",
    desc: "Learning the ropes, eager to grow and contribute",
  },
  {
    id: "mid",
    label: "Mid-level",
    desc: "Independently capable with solid execution experience",
  },
  {
    id: "senior",
    label: "Senior / Lead",
    desc: "Deep expertise, mentors others, drives initiatives",
  },
];

const SETUP_OPTIONS = ["Remote", "Hybrid", "On-site"];
const SHIFT_OPTIONS = ["Day shift", "Night shift", "Flexible hours"];
const JOBTYPE_OPTIONS = ["Full-time", "Part-time"];

const WORK_ENVIRONMENTS = [
  {
    id: "structured",
    label: "Structured & predictable",
    desc: "Clear processes, consistent routines, predictable days",
  },
  {
    id: "flexible",
    label: "Flexible & dynamic",
    desc: "Adapts fast, no two days are the same",
  },
  {
    id: "collaborative",
    label: "Highly collaborative",
    desc: "Always working closely with a team",
  },
  {
    id: "independent",
    label: "Independent & focused",
    desc: "Deep focus, minimal interruptions",
  },
  {
    id: "process",
    label: "Process-driven",
    desc: "Systems, checklists, standards, quality control",
  },
  {
    id: "creative",
    label: "Creative & evolving",
    desc: "Ideas, content, and constant iteration",
  },
];

// ─── Core Values Assessment ───────────────────────────────────────────────────

interface ValuesOption {
  id: string;
  text: string;
  score: number;
  trait: string | null;
}
interface ValuesQuestion {
  id: string;
  value: string;
  icon: React.ElementType;
  question: string;
  context: string;
  options: ValuesOption[];
}

const CORE_VALUES_QUESTIONS: ValuesQuestion[] = [
  {
    id: "people_first",
    value: "People First",
    icon: Heart,
    question:
      "A colleague is struggling and falling behind on a shared deliverable. What is your first instinct?",
    context:
      "We believe everything begins with people — and that the best teams lift each other up.",
    options: [
      {
        id: "a",
        text: "Check in privately and offer help before anything else",
        score: 2,
        trait: "Empathetic & supportive",
      },
      {
        id: "b",
        text: "Raise it with the team so we can redistribute the load",
        score: 2,
        trait: "Team-first thinker",
      },
      {
        id: "c",
        text: "Pick up the slack quietly without drawing attention",
        score: 1,
        trait: "Selfless contributor",
      },
      {
        id: "d",
        text: "Focus on my own tasks and let them resolve it themselves",
        score: 0,
        trait: null,
      },
    ],
  },
  {
    id: "beat_yesterday",
    value: "Beat Yesterday",
    icon: TrendingUp,
    question:
      "You receive pointed feedback on a piece of work you were proud of. How do you respond?",
    context:
      "We never stop improving. The standard here is not perfection — it is continuous growth.",
    options: [
      {
        id: "a",
        text: "Welcome it immediately — this is how I get better",
        score: 2,
        trait: "Growth-driven",
      },
      {
        id: "b",
        text: "Take time to process it, then apply what is useful",
        score: 1,
        trait: "Reflective improver",
      },
      {
        id: "c",
        text: "Evaluate it based on who is giving it and why",
        score: 1,
        trait: "Discerning learner",
      },
      {
        id: "d",
        text: "Prefer encouragement — critical feedback is demotivating",
        score: 0,
        trait: null,
      },
    ],
  },
  {
    id: "fast_fast",
    value: "Fast-Fast-Fast",
    icon: Zap,
    question:
      "You are assigned an urgent task with incomplete information. What is your first move?",
    context:
      "Speed is our edge. We move with urgency and precision — not chaos.",
    options: [
      {
        id: "a",
        text: "Clarify the critical gaps fast, then start immediately",
        score: 2,
        trait: "Decisive & precise",
      },
      {
        id: "b",
        text: "Make reasonable assumptions, document them, and move",
        score: 2,
        trait: "Proactive executor",
      },
      {
        id: "c",
        text: "Loop in a teammate before starting to align",
        score: 1,
        trait: "Collaborative",
      },
      {
        id: "d",
        text: "Wait until I have complete information before beginning",
        score: 0,
        trait: null,
      },
    ],
  },
  {
    id: "integrity",
    value: "Integrity Matters",
    icon: Shield,
    question:
      "You discover a process producing inaccurate results that your manager has not noticed. What do you do?",
    context:
      "We do what is right, especially when it is difficult. Trust is earned through transparency.",
    options: [
      {
        id: "a",
        text: "Report it immediately and come to the table with a fix",
        score: 2,
        trait: "High integrity",
      },
      {
        id: "b",
        text: "Document it clearly and raise it at the next check-in",
        score: 1,
        trait: "Methodical & reliable",
      },
      {
        id: "c",
        text: "Quietly correct it without flagging it",
        score: 1,
        trait: "Self-starter",
      },
      {
        id: "d",
        text: "Wait to see if anyone else catches it first",
        score: 0,
        trait: null,
      },
    ],
  },
  {
    id: "ownership",
    value: "Extreme Ownership",
    icon: Award,
    question:
      "A project you led missed a deadline — partly due to a teammate's delay. How do you handle the debrief?",
    context:
      "We do not pass problems. Every outcome — good or bad — belongs to the person who owns it.",
    options: [
      {
        id: "a",
        text: "Own the outcome fully — it was my project to deliver",
        score: 2,
        trait: "Full ownership mindset",
      },
      {
        id: "b",
        text: "Share context honestly, including what I could have flagged earlier",
        score: 2,
        trait: "Accountable",
      },
      {
        id: "c",
        text: "Explain the contributing factors clearly and without blame",
        score: 1,
        trait: "Transparent",
      },
      {
        id: "d",
        text: "Highlight what went well and focus the conversation on next steps",
        score: 0,
        trait: null,
      },
    ],
  },
  {
    id: "intrapreneur",
    value: "We Are Intrapreneurs",
    icon: Lightbulb,
    question:
      "You spot an inefficiency in a process that is not officially your responsibility. What do you do?",
    context:
      "We think like builders. We take initiative and act like owners — not spectators.",
    options: [
      {
        id: "a",
        text: "Raise it with a proposed solution ready",
        score: 2,
        trait: "Proactive problem-solver",
      },
      {
        id: "b",
        text: "Flag it to my manager so they can decide what to do",
        score: 1,
        trait: "Communicative",
      },
      {
        id: "c",
        text: "Fix it myself without raising it",
        score: 1,
        trait: "Independent fixer",
      },
      {
        id: "d",
        text: "It is not my area — I stay focused on my own work",
        score: 0,
        trait: null,
      },
    ],
  },
];

const VALUES_MAX_SCORE = CORE_VALUES_QUESTIONS.length * 2; // 12

// ─── Domain-Based Matching Engine ────────────────────────────────────────────
//
// Approach:
//  1. Domain is inferred primarily from targetPosition text (free text entered by candidate)
//     then from jobCategory selection, then from skill chips.
//  2. Each job's domain is inferred from its title keywords FIRST (prevents mislabeled jobs).
//  3. Domain incompatibility matrix defines hard penalties. If the minimum penalty
//     between any candidate domain and the job domain is >= DOMAIN_HARD_THRESHOLD,
//     the job is rejected before scoring.
//  4. Jobs that pass the domain filter are scored on: position relevance (20 pts),
//     skills (30 pts), domain (20 pts), experience (15 pts), preferences (10 pts),
//     values bonus (5 pts).
//  5. Only jobs scoring >= MATCH_THRESHOLD (35) are shown.
// ─────────────────────────────────────────────────────────────────────────────

type Domain =
  | "admin_ops" // admin, operations, coordination, VA
  | "customer_support" // customer service, CX, help desk
  | "sales_marketing" // sales, marketing, social media, content
  | "finance" // bookkeeping, accounting, financial
  | "technical" // IT, development, tech support
  | "design" // graphic, UX/UI
  | "hr" // recruitment, HR
  | "management" // team lead, manager, director
  | "general"; // fallback

// ── Skill → domain(s) mapping ─────────────────────────────────────────────────
const SKILL_DOMAINS: Record<string, Domain[]> = {
  "Customer Support": ["customer_support"],
  "Admin Support": ["admin_ops"],
  "Data Entry": ["admin_ops", "finance"],
  "Calendar Management": ["admin_ops"],
  "Email Management": ["admin_ops", "customer_support"],
  Research: ["admin_ops", "sales_marketing"],
  "Social Media": ["sales_marketing"],
  "Content Writing": ["sales_marketing"],
  Bookkeeping: ["finance"],
  "Project Coordination": ["admin_ops"],
  "Sales Support": ["sales_marketing"],
  "Technical Support": ["technical"],
  "CRM Management": ["sales_marketing", "customer_support"],
  Scheduling: ["admin_ops"],
  "Report Generation": ["finance", "admin_ops"],
};

// ── Skill aliases for overlap detection ──────────────────────────────────────
const SKILL_ALIASES: Record<string, string[]> = {
  "Customer Support": [
    "customer service",
    "customer support",
    "cx",
    "client support",
    "help desk",
    "customer care",
  ],
  "Admin Support": [
    "administrative",
    "admin assistant",
    "office management",
    "admin support",
    "general admin",
  ],
  "Data Entry": [
    "data entry",
    "data processing",
    "data management",
    "data input",
    "data encoding",
  ],
  "Calendar Management": [
    "calendar management",
    "appointment scheduling",
    "diary management",
    "meeting scheduling",
  ],
  "Email Management": [
    "email management",
    "inbox management",
    "email handling",
    "correspondence management",
  ],
  Research: ["research", "market research", "data research", "online research"],
  "Social Media": [
    "social media",
    "instagram",
    "facebook",
    "linkedin management",
    "tiktok",
    "social media management",
  ],
  "Content Writing": [
    "content writing",
    "copywriting",
    "blog writing",
    "content creation",
    "article writing",
  ],
  Bookkeeping: [
    "bookkeeping",
    "accounting",
    "quickbooks",
    "xero",
    "accounts management",
    "bookkeeper",
    "financial records",
    "accounts receivable",
    "accounts payable",
  ],
  "Project Coordination": [
    "project management",
    "project coordination",
    "project planning",
    "task management",
    "pmo",
  ],
  "Sales Support": [
    "sales support",
    "lead generation",
    "cold calling",
    "outbound sales",
    "bdr",
    "sdr",
    "crm sales",
  ],
  "Technical Support": [
    "technical support",
    "tech support",
    "it support",
    "helpdesk",
    "troubleshooting",
  ],
  "CRM Management": [
    "crm",
    "salesforce",
    "hubspot",
    "zoho crm",
    "customer relationship",
    "crm management",
  ],
  Scheduling: [
    "scheduling",
    "appointment setting",
    "diary management",
    "shift scheduling",
  ],
  "Report Generation": [
    "reporting",
    "report generation",
    "data analysis",
    "analytics",
    "business reporting",
    "kpi reporting",
  ],
};

// ── Title keyword → domain inference (overrides category) ────────────────────
const TITLE_DOMAIN_RULES: Array<{ keywords: string[]; domain: Domain }> = [
  {
    keywords: [
      "it administrator",
      "it admin",
      "systems administrator",
      "network administrator",
      "sysadmin",
      "infrastructure",
      "devops",
      "cloud engineer",
      "database administrator",
      "software developer",
      "software engineer",
      "full stack",
      "backend developer",
      "frontend developer",
      "web developer",
      "programmer",
      "technical lead",
      "information technology",
      "it specialist",
      "it support specialist",
      "it manager",
      "it officer",
      "it coordinator",
      "it helpdesk",
      "network engineer",
      "security analyst",
      "cybersecurity",
      // Plain "developer" alone — important for targetPosition free-text matching
      "developer",
    ],
    domain: "technical",
  },
  {
    keywords: [
      "accountant",
      "accounting manager",
      "accounts manager",
      "financial analyst",
      "bookkeeper",
      "bookkeeping",
      "finance manager",
      "finance officer",
      "cfo",
      "controller",
      "payroll",
      "accounts payable",
      "accounts receivable",
      "tax specialist",
      "auditor",
    ],
    domain: "finance",
  },
  {
    keywords: [
      "graphic designer",
      "ux designer",
      "ui designer",
      "visual designer",
      "motion designer",
      "illustrator",
      "creative director",
      "brand designer",
      "web designer",
    ],
    domain: "design",
  },
  {
    keywords: [
      "recruiter",
      "talent acquisition",
      "hr specialist",
      "hr manager",
      "human resources",
      "people operations",
      "hr coordinator",
      "hr officer",
    ],
    domain: "hr",
  },
  // Management — before sales/admin to catch "team manager", "operations manager"
  {
    keywords: [
      "team manager",
      "team lead",
      "operations manager",
      "department manager",
      "department head",
      "account manager",
      "program manager",
      "delivery manager",
      "line manager",
      "general manager",
      "director of",
      "head of",
    ],
    domain: "management",
  },
  {
    keywords: [
      "business development",
      "account executive",
      "sales manager",
      "sales rep",
      "sales specialist",
      "bdr",
      "sdr",
      "lead generation specialist",
      "digital marketing",
      "marketing manager",
      "seo specialist",
      "ads manager",
      "email marketing",
      "social media manager",
      "content strategist",
      "copywriter",
      "content writer",
    ],
    domain: "sales_marketing",
  },
  {
    keywords: [
      "customer service",
      "customer support",
      "customer success",
      "cx specialist",
      "support agent",
      "service representative",
      "client support",
    ],
    domain: "customer_support",
  },
  {
    keywords: [
      "virtual assistant",
      "executive assistant",
      "administrative assistant",
      "office manager",
      "project coordinator",
      "operations coordinator",
      "admin officer",
      "admin coordinator",
      "data entry specialist",
      "data encoder",
    ],
    domain: "admin_ops",
  },
];

// ── Category → domain fallback ────────────────────────────────────────────────
const CATEGORY_DOMAIN: Record<string, Domain> = {
  Admin: "admin_ops",
  Operations: "admin_ops",
  "Customer Support": "customer_support",
  "Customer success": "customer_support",
  Marketing: "sales_marketing",
  Sales: "sales_marketing",
  Finance: "finance",
  "Tech Support": "technical",
  Development: "technical",
  Design: "design",
  HR: "hr",
};

// ── Domain incompatibility penalty matrix ─────────────────────────────────────
const DOMAIN_HARD_THRESHOLD = 40;

const DOMAIN_PENALTY: Partial<Record<Domain, Partial<Record<Domain, number>>>> =
  {
    admin_ops: {
      technical: 50,
      design: 25,
      hr: 0,
      finance: 5,
    },
    customer_support: {
      technical: 45,
      design: 30,
      finance: 30,
      hr: 15,
      sales_marketing: 5,
    },
    sales_marketing: {
      technical: 50,
      finance: 20,
      design: 10,
      hr: 10,
    },
    finance: {
      technical: 45,
      design: 35,
      sales_marketing: 15,
      customer_support: 20,
      hr: 20,
    },
    technical: {
      design: 10,
      finance: 35,
      hr: 40,
      customer_support: 20,
      admin_ops: 55, // developers / IT should never match VA / admin roles
      sales_marketing: 55, // developers / IT should never match sales / marketing roles
      management: 20,
    },
    design: {
      technical: 15,
      finance: 30,
      hr: 30,
      customer_support: 15,
    },
    hr: {
      technical: 40,
      finance: 20,
      design: 30,
    },
    management: {
      // Managers can oversee many domains — low penalty to most
      technical: 10,
      finance: 10,
      design: 15,
      hr: 5,
    },
    general: {},
  };

// ── Experience level tiers ────────────────────────────────────────────────────
const EXP_TO_TIER: Record<string, number> = {
  "0-1": 0,
  "1-3": 1,
  "3-5": 2,
  "5+": 3,
};
const SENIORITY_TO_TIER: Record<string, number> = {
  entry: 0,
  mid: 2,
  senior: 3,
};
const JOB_LEVEL_TIER: Record<string, number> = {
  entry: 0,
  intermediate: 2,
  expert: 3,
};
const ACCEPTABLE_TIERS: Record<number, number[]> = {
  0: [0],
  1: [0, 1, 2],
  2: [1, 2, 3],
  3: [2, 3],
};
const JOB_LEVEL_LABEL: Record<string, string> = {
  entry: "Entry-level",
  intermediate: "Intermediate-level",
  expert: "Senior-level",
};

// ── Domain archetype display ──────────────────────────────────────────────────
const DOMAIN_ARCHETYPES: Record<
  Domain,
  { title: string; archetype: string; description: string }
> = {
  admin_ops: {
    title: "Administrative & Operations Professional",
    archetype: "Operations Support",
    description:
      "Organized, reliable, and highly capable — you excel at keeping teams, calendars, and operations running smoothly.",
  },
  customer_support: {
    title: "Customer Experience Specialist",
    archetype: "Customer Support",
    description:
      "Empathetic, communicative, and client-focused — you build trust and resolve issues with care.",
  },
  sales_marketing: {
    title: "Sales & Marketing Professional",
    archetype: "Sales / Marketing Support",
    description:
      "Persuasive and brand-aware — you thrive in outreach, content, and growth-focused environments.",
  },
  finance: {
    title: "Finance & Accounting Specialist",
    archetype: "Finance / Admin Support",
    description:
      "Precise, methodical, and numbers-driven — you bring accuracy to financial records and reporting.",
  },
  technical: {
    title: "Technical Support Specialist",
    archetype: "Technical Support",
    description:
      "Problem-solving and technically confident — you diagnose issues and keep systems running with calm precision.",
  },
  design: {
    title: "Creative & Design Professional",
    archetype: "Creative / Design Support",
    description:
      "Visually sharp and conceptually strong — you translate briefs into compelling designs.",
  },
  hr: {
    title: "HR & People Operations Specialist",
    archetype: "HR / Recruitment Support",
    description:
      "People-focused and process-driven — you attract, assess, and support talent with integrity.",
  },
  management: {
    title: "Team Lead & Manager",
    archetype: "Leadership / Management",
    description:
      "A natural leader who drives performance, aligns teams, and delivers outcomes through people.",
  },
  general: {
    title: "General Professional",
    archetype: "General Support",
    description:
      "Well-rounded and adaptable — you bring a mix of skills suited to a variety of remote support roles.",
  },
};

// ─── Domain helper functions ──────────────────────────────────────────────────

function inferDomainFromText(text: string): Domain | null {
  const lower = text.toLowerCase();
  for (const { keywords, domain } of TITLE_DOMAIN_RULES) {
    if (keywords.some((kw) => lower.includes(kw))) return domain;
  }
  return null;
}

function inferJobDomain(job: Job): Domain {
  const titleLower = (job.title ?? "").toLowerCase();
  for (const { keywords, domain } of TITLE_DOMAIN_RULES) {
    if (keywords.some((kw) => titleLower.includes(kw))) return domain;
  }
  return CATEGORY_DOMAIN[job.category] ?? "general";
}

/**
 * Determine candidate domains from finalized profile.
 * Priority: targetPosition text → jobCategory selection → skill chips.
 */
function getCandidateDomainsFromProfile(
  profile: CandidateProfile,
): Set<Domain> {
  const domains = new Set<Domain>();

  // 1. Target position text is the strongest signal
  const positionDomain = inferDomainFromText(profile.targetPosition);
  if (positionDomain) domains.add(positionDomain);

  // 2. Selected job category
  const categoryDomain = CATEGORY_DOMAIN[profile.jobCategory];
  if (categoryDomain) domains.add(categoryDomain);

  // 3. Skill chips — secondary signal
  for (const skill of profile.coreSkills) {
    (SKILL_DOMAINS[skill] ?? []).forEach((d) => domains.add(d));
  }

  if (domains.size === 0) domains.add("general");
  return domains;
}

function getPrimaryDomainFromProfile(profile: CandidateProfile): Domain {
  // Prefer position text → category → skill majority
  const positionDomain = inferDomainFromText(profile.targetPosition);
  if (positionDomain) return positionDomain;

  const categoryDomain = CATEGORY_DOMAIN[profile.jobCategory];
  if (categoryDomain) return categoryDomain;

  const counts: Partial<Record<Domain, number>> = {};
  for (const skill of profile.coreSkills) {
    const primary = (SKILL_DOMAINS[skill] ?? ["general" as Domain])[0];
    counts[primary] = (counts[primary] ?? 0) + 1;
  }
  if (Object.keys(counts).length === 0) return "general";
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0] as Domain;
}

function computeDomainPenalty(
  candidateDomains: Set<Domain>,
  jobDomain: Domain,
): number {
  let minPenalty = Infinity;
  for (const cd of Array.from(candidateDomains)) {
    if (cd === jobDomain) return 0;
    const p = (DOMAIN_PENALTY as any)[cd]?.[jobDomain] ?? 0;
    minPenalty = Math.min(minPenalty, p);
  }
  return minPenalty === Infinity ? 0 : minPenalty;
}

// ── Position relevance scoring ─────────────────────────────────────────────────
// Scores how closely the candidate's target position text matches the job title.
function scorePositionRelevance(candidatePosition: string, job: Job): number {
  if (!candidatePosition.trim()) return 0;
  const candLower = candidatePosition.toLowerCase();
  const titleLower = (job.title ?? "").toLowerCase();
  const descLower = (job.description ?? "").toLowerCase();

  // Exact or strong substring match against title
  if (titleLower === candLower) return 20;
  if (titleLower.includes(candLower) || candLower.includes(titleLower))
    return 16;

  // Split into words and count overlap
  const candWords = candLower.split(/\s+/).filter((w) => w.length > 2);
  const titleWords = titleLower.split(/\s+/);
  const overlap = candWords.filter((w) => titleWords.includes(w)).length;
  if (overlap >= 2) return 12;
  if (overlap === 1) return 6;

  // Check description
  if (descLower.includes(candLower)) return 8;

  return 0;
}

// ── Skill overlap detection ────────────────────────────────────────────────────
function computeSkillOverlap(
  profile: CandidateProfile,
  job: Job,
): { matched: string[]; score: number } {
  const jobText = [
    job.title ?? "",
    job.description ?? "",
    ...(job.skillTags ?? []),
    ...(job.requirements ?? []),
    job.skillsAndCompetencies ?? "",
    job.responsibilities?.join(" ") ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // Combine core + secondary skills for matching
  const allSkills = [...profile.coreSkills, ...profile.secondarySkills];

  const matched: string[] = [];
  for (const skill of profile.coreSkills) {
    const aliases = [skill.toLowerCase(), ...(SKILL_ALIASES[skill] ?? [])];
    if (aliases.some((alias) => jobText.includes(alias))) {
      matched.push(skill);
    }
  }
  // Also check secondary skills (no aliases, plain text)
  for (const skill of profile.secondarySkills) {
    if (skill.length > 2 && jobText.includes(skill.toLowerCase())) {
      if (!matched.includes(skill)) matched.push(skill);
    }
  }

  const total = Math.max(allSkills.length, 1);
  const raw =
    matched.length === 0
      ? 0
      : matched.length === 1
        ? 12
        : matched.length === 2
          ? 20
          : Math.min(30, Math.round((matched.length / total) * 30) + 5);

  return { matched, score: raw };
}

// ── Values score helper ───────────────────────────────────────────────────────
function computeValuesScore(valuesAnswers: Record<string, string>): number {
  let total = 0;
  for (const q of CORE_VALUES_QUESTIONS) {
    const opt = q.options.find((o) => o.id === valuesAnswers[q.id]);
    if (opt) total += opt.score;
  }
  return total;
}

// ─── Main scoring function ────────────────────────────────────────────────────
const MATCH_THRESHOLD = 35;

export interface PostedJobMatch {
  job: Job;
  score: number;
  reasons: string[];
}

function scoreJobMatch(job: Job, profile: CandidateProfile): PostedJobMatch {
  let score = 0;
  const reasons: string[] = [];

  // ── 1. Domain gate ────────────────────────────────────────────────────────
  const candidateDomains = getCandidateDomainsFromProfile(profile);
  const jobDomain = inferJobDomain(job);
  const penalty = computeDomainPenalty(candidateDomains, jobDomain);

  if (penalty >= DOMAIN_HARD_THRESHOLD) {
    return { job, score: 0, reasons: [] };
  }

  // ── 1b. Position sub-domain gate (within shared broad domain) ─────────────
  // Prevents "Developer" from matching "IT Administrator" and vice-versa even
  // though both sit in the "technical" domain.
  {
    const candLower = profile.targetPosition.toLowerCase();
    const jobTitleLower = (job.title ?? "").toLowerCase();

    const isSoftwareDev =
      /\b(develop|programm|engineer|coder|web\s*dev|full[\s\-]?stack|front[\s\-]?end|back[\s\-]?end|software)\b/.test(
        candLower,
      );
    const isItAdminJob =
      /\b(it\s*admin|system\s*admin|sysadmin|infrastructure|network\s*admin|helpdesk|help\s*desk)\b/.test(
        jobTitleLower,
      );

    const isItAdminCand =
      /\b(it\s*admin|system\s*admin|sysadmin|infrastructure|helpdesk)\b/.test(
        candLower,
      );
    const isSoftwareDevJob =
      /\b(software\s*dev|web\s*dev|full[\s\-]?stack|front[\s\-]?end|back[\s\-]?end|programm)\b/.test(
        jobTitleLower,
      );

    if (
      (isSoftwareDev && isItAdminJob) ||
      (isItAdminCand && isSoftwareDevJob)
    ) {
      return { job, score: 0, reasons: [] };
    }
  }

  // ── 2. Position relevance (0–20 pts) — PRIMARY driver ────────────────────
  const posScore = scorePositionRelevance(profile.targetPosition, job);
  score += posScore;
  if (posScore >= 12) {
    reasons.push(
      `Role aligns with your target position: ${profile.targetPosition}`,
    );
  }

  // ── 3. Domain score (0–20 pts, minus partial penalty) ────────────────────
  const exactDomainMatch = candidateDomains.has(jobDomain);
  if (exactDomainMatch) {
    score += 20;
  } else if (penalty === 0) {
    score += 8;
  } else {
    score += Math.max(0, 8 - Math.round(penalty * 0.4));
  }
  score -= Math.round(penalty * 0.3);

  // ── 4. Skill overlap (0–30 pts) ──────────────────────────────────────────
  const { matched, score: skillScore } = computeSkillOverlap(profile, job);
  score += skillScore;
  if (matched.length > 0) {
    reasons.push(`Matched skills: ${matched.slice(0, 3).join(", ")}`);
  } else if (!exactDomainMatch) {
    score -= 15;
  }

  // ── 5. Experience / seniority (0–15 pts, -10 on mismatch) ────────────────
  if (job.experienceLevel) {
    const expTier = EXP_TO_TIER[profile.yearsOfExperience] ?? -1;
    const senTier = SENIORITY_TO_TIER[profile.seniority] ?? -1;
    const cTier = expTier >= 0 ? expTier : senTier >= 0 ? senTier : -1;
    const jTier = JOB_LEVEL_TIER[job.experienceLevel] ?? 1;
    const acceptable = ACCEPTABLE_TIERS[cTier] ?? [0, 1, 2];

    if (cTier >= 0) {
      if (acceptable.includes(jTier)) {
        score += 15;
        reasons.push(
          `Experience fit: ${JOB_LEVEL_LABEL[job.experienceLevel] ?? job.experienceLevel} role`,
        );
      } else {
        const diff = Math.abs(cTier - jTier);
        if (diff === 1) score += 5;
        else score -= 10;
      }
    }
  }

  // ── 6. Work preferences (0–10 pts) ───────────────────────────────────────
  const descText = [job.description ?? "", ...(job.requirements ?? [])]
    .join(" ")
    .toLowerCase();
  const isVoiceRole =
    /\b(voice|phone call|calling|inbound call|outbound call|live call)\b/.test(
      descText,
    );
  let prefScore = 0;
  const prefReasons: string[] = [];

  const locationLower = (job.location ?? "").toLowerCase();
  const isRemote = locationLower.includes("remote") || !locationLower;

  if (profile.preferredSetup === "Remote" && isRemote) {
    prefScore += 4;
    prefReasons.push("Remote setup");
  } else if (profile.preferredSetup === "Remote" && !isRemote) prefScore -= 2;

  const isFixedFull = job.engagementType === "Full-Time";
  if (profile.preferredJobType === "Full-time" && isFixedFull) prefScore += 3;
  else if (profile.preferredJobType === "Part-time" && !isFixedFull)
    prefScore += 3;

  if (prefReasons.length > 0) {
    reasons.push(`Preference fit: ${prefReasons.join(", ")}`);
  }
  score += Math.max(0, prefScore);

  // ── 7. Values bonus (0–5 pts — supportive only) ───────────────────────────
  const valuesRaw = computeValuesScore(profile.valuesAnswers);
  score += Math.round((valuesRaw / VALUES_MAX_SCORE) * 5);

  score = Math.round(Math.max(0, Math.min(100, score)));
  return { job, score, reasons };
}

function computeAllMatches(
  profile: CandidateProfile,
  openJobs: Job[],
): PostedJobMatch[] {
  if (openJobs.length === 0) return [];
  return openJobs
    .map((job) => scoreJobMatch(job, profile))
    .filter((m) => m.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ─── Values alignment output ──────────────────────────────────────────────────

interface ValuesAlignment {
  score: number;
  traits: string[];
  summary: string;
}

function computeValuesAlignment(
  valuesAnswers: Record<string, string>,
): ValuesAlignment {
  let total = 0;
  const traits: string[] = [];
  for (const q of CORE_VALUES_QUESTIONS) {
    const opt = q.options.find((o) => o.id === valuesAnswers[q.id]);
    if (opt) {
      total += opt.score;
      if (opt.trait) traits.push(opt.trait);
    }
  }
  const score = Math.round((total / VALUES_MAX_SCORE) * 100);
  let summary = "";
  if (score >= 80)
    summary =
      "Your responses reflect strong alignment with how we work at OnSpot. You demonstrate ownership, a people-first mindset, and a bias toward action — exactly what our best team members embody.";
  else if (score >= 60)
    summary =
      "You show solid alignment with several of our core values. You bring a growth-oriented approach and collaborative instincts that we value across all roles.";
  else if (score >= 40)
    summary =
      "Some of your instincts align with our culture. Every team member grows into our values — what matters most is the willingness to be accountable and keep improving.";
  else
    summary =
      "Our culture may be a meaningful shift for you. We value transparency, urgency, and ownership highly — and we invest in helping our team develop these traits over time.";
  return { score, traits, summary };
}

// ─── canProceed per step ──────────────────────────────────────────────────────

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_FORMAT_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(v: string): boolean {
  return EMAIL_FORMAT_RX.test(v.trim());
}

/** Validate phone using libphonenumber-js with PH as default country hint.
 *  Accepts any valid international format (+XX…) or PH local format (09…). */
function isValidPhone(v: string): boolean {
  const raw = (v || "").trim();
  if (!raw) return false;
  try {
    // Try Philippines local format first (most candidates are PH-based)
    const parsed = libParsePhoneNumber(raw, "PH");
    if (parsed?.isValid()) return true;
    // Fall back to pure international format (number starting with +)
    const intl = libParsePhoneNumber(raw);
    return !!(intl?.isValid());
  } catch {
    // If the library throws, fall back to a generous length check
    return raw.replace(/\D/g, "").length >= 7;
  }
}

function canProceed(step: number, p: CandidateProfile): boolean {
  switch (step) {
    case 0:
      return true; // Upload is optional
    case 1:
      return (
        !!p.fullName.trim() &&
        isValidEmail(p.email) &&
        isValidPhone(p.phone) &&
        !!p.location.trim() &&
        !!p.targetPosition.trim() &&
        !!p.jobCategory &&
        !!p.yearsOfExperience &&
        !!p.seniority &&
        p.coreSkills.length > 0
      );
    case 2: // Culture Evaluation — all questions answered
      return Object.keys(p.valuesAnswers).length === CORE_VALUES_QUESTIONS.length;
    case 3: // Culture Result — always ready to proceed
      return true;
    default:
      return true;
  }
}

// ─── Per-value breakdown helper for Culture Result step ──────────────────────

interface ValueBreakdown {
  value: string;
  icon: React.ElementType;
  score: number; // 0, 1, or 2
  trait: string | null;
}

function computeValuesBreakdown(
  valuesAnswers: Record<string, string>,
): ValueBreakdown[] {
  return CORE_VALUES_QUESTIONS.map((q) => {
    const opt = q.options.find((o) => o.id === valuesAnswers[q.id]);
    return {
      value: q.value,
      icon: q.icon,
      score: opt?.score ?? 0,
      trait: opt?.trait ?? null,
    };
  });
}

// ─── Matching animation ───────────────────────────────────────────────────────

const MATCHING_MESSAGES = [
  "Reading your finalized profile…",
  "Identifying your role domain and niche…",
  "Applying domain compatibility gate…",
  "Scoring active posted jobs against your background…",
  "Finalizing your personalized matches…",
];

function MatchingAnimation() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    if (msgIdx >= MATCHING_MESSAGES.length - 1) return;
    const t = setTimeout(() => setMsgIdx((i) => i + 1), 520);
    return () => clearTimeout(t);
  }, [msgIdx]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#474ead]/10">
        <Sparkles className="h-10 w-10 animate-pulse text-[#474ead]" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-900">
        Matching in Progress
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Sit tight — this takes just a moment.
      </p>
      <div className="mt-8 space-y-2">
        {MATCHING_MESSAGES.map((msg, i) => (
          <motion.div
            key={msg}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: i <= msgIdx ? 1 : 0.2, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm"
          >
            {i < msgIdx ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#474ead]" />
            ) : i === msgIdx ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#474ead]" />
            ) : (
              <div className="h-4 w-4 shrink-0 rounded-full border border-slate-200" />
            )}
            <span className={i <= msgIdx ? "text-slate-700" : "text-slate-400"}>
              {msg}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function OptionChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        selected
          ? "border-[#474ead] bg-[#474ead] text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#474ead]/40 hover:text-[#474ead]"
      }`}
    >
      {selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </button>
  );
}

function SelectCard({
  label,
  desc,
  selected,
  onClick,
  icon: Icon,
}: {
  label: string;
  desc?: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-[#474ead] bg-[#474ead]/5 ring-1 ring-[#474ead]/20"
          : "border-slate-200 bg-white hover:border-[#474ead]/30"
      }`}
    >
      {Icon && (
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            selected ? "bg-[#474ead] text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1">
        <p
          className={`text-sm font-semibold ${selected ? "text-[#474ead]" : "text-slate-800"}`}
        >
          {label}
        </p>
        {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      </div>
      {selected && (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#474ead]" />
      )}
    </button>
  );
}

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">
        Step {step} — {title}
      </p>
    </div>
  );
}

function FlowProgress({ flowStep }: { flowStep: number }) {
  const pct = ((flowStep + 1) / TOTAL_FLOW_STEPS) * 100;
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          Step {flowStep + 1} of {TOTAL_FLOW_STEPS} —{" "}
          <span className="font-semibold text-slate-700">
            {FLOW_STEPS[flowStep].label}
          </span>
        </span>
        <span>{Math.round(pct)}% complete</span>
      </div>
      <Progress value={pct} className="h-1.5 bg-slate-200" />
      <div className="mt-3 flex gap-2">
        {FLOW_STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                i < flowStep
                  ? "bg-[#474ead] text-white"
                  : i === flowStep
                    ? "border-2 border-[#474ead] text-[#474ead]"
                    : "border border-slate-200 text-slate-400"
              }`}
            >
              {i < flowStep ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result cards ─────────────────────────────────────────────────────────────

function TopProfileCard({
  primaryDomain,
  profile,
}: {
  primaryDomain: Domain;
  profile: CandidateProfile;
}) {
  const archetype =
    DOMAIN_ARCHETYPES[primaryDomain] ?? DOMAIN_ARCHETYPES.general;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#474ead]/20 bg-gradient-to-br from-[#474ead]/6 via-white to-[#8e93ff]/5">
      <div className="px-6 py-5 border-b border-[#474ead]/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#474ead] mb-1">
          Your Profile Match
        </p>
        <h3 className="text-xl font-bold text-slate-900">
          {profile.targetPosition || archetype.title}
        </h3>
        <p className="text-sm text-[#474ead] font-medium mt-0.5">
          {archetype.archetype} archetype
        </p>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {archetype.description}
        </p>
      </div>
      {profile.coreSkills.length > 0 && (
        <div className="px-6 py-4">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Your core skills
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.coreSkills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#474ead]/20 bg-[#474ead]/6 px-3 py-1 text-xs font-medium text-[#474ead]"
              >
                <CheckCircle2 className="h-3 w-3" /> {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ValuesAlignmentCard({ alignment }: { alignment: ValuesAlignment }) {
  const colorClass =
    alignment.score >= 80
      ? "text-emerald-600"
      : alignment.score >= 60
        ? "text-[#474ead]"
        : "text-amber-600";
  const bgClass =
    alignment.score >= 80
      ? "bg-emerald-50 border-emerald-100"
      : alignment.score >= 60
        ? "bg-[#474ead]/5 border-[#474ead]/15"
        : "bg-amber-50 border-amber-100";
  return (
    <div className={`overflow-hidden rounded-2xl border ${bgClass}`}>
      <div className="px-6 py-5 border-b border-inherit">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Values & Culture Fit
            </p>
            <h3 className="text-xl font-bold text-slate-900">
              Your Values Alignment
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-3xl font-bold ${colorClass}`}>
              {alignment.score}%
            </div>
            <div className="text-[10px] font-medium text-slate-500">
              alignment
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {alignment.summary}
        </p>
      </div>
      {alignment.traits.length > 0 && (
        <div className="px-6 py-4">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Your standout traits
          </p>
          <div className="flex flex-wrap gap-2">
            {alignment.traits.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#474ead]/20 bg-[#474ead]/8 px-3 py-1 text-xs font-medium text-[#474ead]"
              >
                <Star className="h-3 w-3" /> {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PostedJobMatchCard({
  match,
  rank,
  onApply,
}: {
  match: PostedJobMatch;
  rank: number;
  onApply: () => void;
}) {
  const { job, score, reasons } = match;
  const tags = (job.skillTags ?? []).slice(0, 5);
  const scoreColor =
    score >= 75
      ? "text-emerald-600"
      : score >= 55
        ? "text-[#474ead]"
        : "text-slate-500";
  const scoreBg =
    score >= 75
      ? "bg-emerald-50"
      : score >= 55
        ? "bg-[#474ead]/8"
        : "bg-slate-100";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.07 }}
    >
      <Card className="overflow-hidden border-slate-200/80">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div className="flex-1">
              {rank === 0 && (
                <Badge className="mb-2 rounded-full bg-[#474ead] text-[11px] text-white hover:bg-[#474ead]">
                  Top Match
                </Badge>
              )}
              <h3 className="text-base font-bold text-slate-900">
                {job.title}
              </h3>
              <p className="mt-0.5 text-sm capitalize text-slate-500">
                {job.category ?? "General"}
                {job.location ? ` · ${job.location}` : ""}
                {job.engagementType
                  ? ` · ${job.engagementType}`
                  : ""}
                {job.experienceLevel
                  ? ` · ${JOB_LEVEL_LABEL[job.experienceLevel] ?? job.experienceLevel}`
                  : ""}
              </p>
            </div>
            <div
              className={`shrink-0 rounded-2xl px-3 py-1.5 text-center ${scoreBg}`}
            >
              <div className={`text-xl font-bold leading-none ${scoreColor}`}>
                {score}%
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500">
                match
              </div>
            </div>
          </div>
          {reasons.length > 0 && (
            <div className="border-b border-slate-100 bg-[#474ead]/[0.02] px-5 py-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Why it fits you
              </p>
              <ul className="space-y-1">
                {reasons.map((r) => (
                  <li
                    key={r}
                    className="flex items-center gap-2 text-sm text-slate-600"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#474ead]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tags.length > 0 && (
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Key skills for this role
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-slate-100 px-5 py-4">
            <Button
              onClick={onApply}
              className="rounded-full bg-[#474ead] text-white"
              size="sm"
            >
              Apply for this role <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NoOpenRoles({ onBrowse }: { onBrowse: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-2xl border border-slate-200 bg-white px-8 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Inbox className="h-7 w-7 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          There are no open roles available at the moment.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          We're not showing role matches yet because there are currently no
          active job postings. Please check back later.
        </p>
        <div className="mt-6">
          <Button
            onClick={onBrowse}
            className="rounded-full bg-[#474ead] px-8 text-white"
          >
            Browse All Roles
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function NoStrongMatches({
  onBrowse,
  onRetake,
  targetPosition,
}: {
  onBrowse: () => void;
  onRetake: () => void;
  targetPosition?: string;
}) {
  const pos = (targetPosition ?? "").toLowerCase();
  const isDev =
    /\b(develop|programm|engineer|coder|web\s*dev|full[\s\-]?stack)\b/.test(
      pos,
    );
  const heading = isDev
    ? `No strong ${targetPosition ?? "developer"}-related openings are available right now.`
    : "No strong role matches are available right now.";
  const body = isDev
    ? `Based on your finalized profile, we do not currently have an active posted role that closely matches your development background. Please browse all openings or check back soon.`
    : `Based on your finalized profile and culture assessment, we do not currently have an active posted role that closely matches your background. Please browse all current openings or check back soon.`;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-2xl border border-slate-200 bg-white px-8 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead]/10">
          <SearchX className="h-7 w-7 text-[#474ead]" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            onClick={onBrowse}
            className="rounded-full bg-[#474ead] px-8 text-white"
          >
            Browse All Roles
          </Button>
          <Button
            variant="outline"
            onClick={onRetake}
            className="rounded-full px-8"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Retake Assessment
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FindBestMatches() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("flow");
  const [flowStep, setFlowStep] = useState(0);
  // True when the DB confirms the talent already completed initial onboarding.
  // Controls whether mount shows Step 1 (first-timer) or results (returning user).
  const [profileAlreadyCompleted, setProfileAlreadyCompleted] = useState(false);

  // ── Post-registration welcome banner ─────────────────────────────────────
  // Set by TalentSignupFromApplication after creating a new account.
  // ── Auth context — authenticated talent user ───────────────────────────────
  const { user } = useAuth();
  // Helper: get the best available JWT token for authenticated API calls.
  // Priority: Talent Portal JWT (type:"candidate", owns the candidateId) > main platform JWT.
  // Using the portal JWT for PATCH /api/candidates/:id passes the `isTalentOwner` check
  // directly; the main JWT only works if the JWT email matches the candidate's email.
  const getAuthToken = () => {
    const ta = loadTalentAuth();
    if (ta?.token) return ta.token;
    return localStorage.getItem("onspot_jwt_token") ?? null;
  };

  // Read-and-clear so it fires exactly once per registration, never on return visits.
  const [showWelcome, setShowWelcome] = useState(() => {
    const flag = sessionStorage.getItem("onspot_new_talent_welcome");
    if (flag) sessionStorage.removeItem("onspot_new_talent_welcome");
    return flag === "1";
  });
  const [profile, setProfile] = useState<CandidateProfile>(() => ({
    ...EMPTY_PROFILE,
    // Pre-fill email from authenticated user so the form isn't blank
    email: "",
  }));
  const [secSkillInput, setSecSkillInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resume-extraction state ──────────────────────────────────────────────
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedCandidateProfile | null>(
    null,
  );
  const [extractParseError, setExtractParseError] = useState<string | null>(
    null,
  );

  // ── Candidate persistence state ──────────────────────────────────────────
  // candidateId priority:
  //   1. sessionStorage — set by TalentSignupFromApplication right after creating a new account
  //   2. Talent Portal JWT candidateId — the single reliable source for returning users;
  //      avoids the /api/candidates/me email-lookup that returns 404 when the JWT user's
  //      email differs from the candidate's email (different auth systems)
  //   3. null — FBM will POST a new candidate on first save
  const [candidateId, setCandidateId] = useState<string | null>(() => {
    const stored = sessionStorage.getItem("onspot_talent_candidate_id");
    if (stored) { sessionStorage.removeItem("onspot_talent_candidate_id"); return stored; }
    // Use the portal JWT candidateId so FBM and Settings always write/read the SAME row
    const ta = loadTalentAuth();
    if (ta?.candidateId) return ta.candidateId;
    return null;
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Work history form state ──────────────────────────────────────────────
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [editWorkIdx, setEditWorkIdx] = useState<number | null>(null);
  const [workEntry, setWorkEntry] = useState<WorkHistoryEntry>({
    ...EMPTY_WORK_ENTRY,
  });

  // ── Culture evaluation persistence state ──────────────────────────────────
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationSaveError, setEvaluationSaveError] = useState(false);
  const [savedEvaluationId, setSavedEvaluationId] = useState<string | null>(null);

  // ── On mount: look up existing candidate data and pre-populate the form ──────
  // Two objectives:
  //   1. Detect returning users (profileCompleted=true in DB) and show results instead of Step 1.
  //   2. Hydrate ALL form fields so returning users see their existing data, not a blank form.
  //
  // Key invariant: profileCompleted=true → results phase, NEVER Step 1 again automatically.
  // The user must explicitly click "Retake Assessment" to restart the guided flow.
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      if (user?.email) {
        setProfile((p) => ({ ...p, email: p.email || user.email || "" }));
      }
      return;
    }

    const fetchAndHydrate = async () => {
      try {
        const endpoint = candidateId
          ? `/api/candidates/${candidateId}`
          : "/api/candidates/me";
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        const r = await fetch(endpoint, { headers });
        if (!r.ok) return;
        const data = await r.json();
        if (!data?.id) return;

        // Persist the candidateId so subsequent saves use PATCH instead of POST
        if (!candidateId) setCandidateId(data.id);

        // ── Returning user detection ────────────────────────────────────────
        // If the DB says onboarding was already completed, skip to results immediately.
        // profileCompleted is the single source of truth — do not depend on localStorage.
        if (data.profileCompleted === true) {
          setProfileAlreadyCompleted(true);
          setPhase("results");
          // Still hydrate fields so Retake Assessment starts with pre-filled data.
        }

        // Hydrate preferences sub-fields from the stored preferences JSONB object.
        // FindBestMatches saves them as: { setup, shift, jobType, environment }
        const prefs = (data.preferences && typeof data.preferences === "object")
          ? data.preferences as Record<string, string>
          : {};

        setProfile((p) => ({
          ...p,
          // Persisted resume info — shown in Step 1 when no new file is selected
          resumeUrl:        p.resumeUrl        || data.resumeUrl        || "",
          resumeFileName:   p.resumeFileName   || data.resumeFileName   || "",
          // Basic identity
          email:            p.email            || data.email            || user?.email || "",
          fullName:         p.fullName         || data.fullName         || "",
          phone:            p.phone            || data.phone            || "",
          location:         p.location         || data.location         || "",
          // Professional details
          targetPosition:   p.targetPosition   || data.targetPosition   || "",
          jobCategory:      p.jobCategory      || data.category         || "",
          // API returns "experienceYears" (schema column: experience_years)
          yearsOfExperience: p.yearsOfExperience || data.experienceYears || "",
          seniority:        p.seniority        || data.seniority        || "",
          summary:          p.summary          || data.summary          || "",
          // Skills — only replace when the form still has no skills entered
          coreSkills:      p.coreSkills.length      > 0 ? p.coreSkills      : (Array.isArray(data.coreSkills)      ? data.coreSkills      : []),
          secondarySkills: p.secondarySkills.length > 0 ? p.secondarySkills : (Array.isArray(data.secondarySkills) ? data.secondarySkills : []),
          // Work history — only replace when the form is still empty
          workHistory: p.workHistory.length > 0
            ? p.workHistory
            : (Array.isArray(data.workHistory) ? data.workHistory : []),
          // Education, certifications, languages — only replace when form is empty
          education: p.education.length > 0
            ? p.education
            : (Array.isArray(data.education) ? data.education : []),
          certifications: p.certifications.length > 0
            ? p.certifications
            : (Array.isArray(data.certifications) ? data.certifications : []),
          languages: p.languages.length > 0
            ? p.languages
            : (Array.isArray(prefs.languages) ? prefs.languages as string[] : []),
          // Preferences
          preferredSetup:   p.preferredSetup   || prefs.setup        || "",
          preferredShift:   p.preferredShift   || prefs.shift        || "",
          preferredJobType: p.preferredJobType || prefs.jobType      || "",
          workEnvironment:  p.workEnvironment  || prefs.environment  || "",
          // Culture evaluation answers — only replace when none entered yet
          valuesAnswers: Object.keys(p.valuesAnswers).length > 0
            ? p.valuesAnswers
            : (data.valuesAnswers && typeof data.valuesAnswers === "object" ? data.valuesAnswers : {}),
        }));
      } catch {
        // Silently ignore — form defaults are fine
      }
    };

    fetchAndHydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { openJobs, isLoading: jobsLoading } = usePostedJobs();

  const primaryDomain = useMemo(
    () => getPrimaryDomainFromProfile(profile),
    [profile],
  );
  const valuesAlignment = useMemo(
    () => computeValuesAlignment(profile.valuesAnswers),
    [profile.valuesAnswers],
  );
  const jobMatches = useMemo(
    () => (phase === "results" ? computeAllMatches(profile, openJobs) : []),
    [phase, profile, openJobs],
  );

  // Auto-transition matching → results after 2.8 s
  useEffect(() => {
    if (phase !== "matching") return;
    const t = setTimeout(() => setPhase("results"), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Resume extraction trigger ────────────────────────────────────────────
  async function handleFileChange(file: File | null) {
    setField("resumeFile", file);
    if (!file) {
      setExtracted(null);
      setExtractParseError(null);
      return;
    }

    setExtracting(true);
    setExtractParseError(null);

    try {
      // Try Vanessa server-side analysis first; fall back to deterministic parser
      let result: ReturnType<typeof parseResumeFile> extends Promise<infer T> ? T : never;
      try {
        const rawText = await extractTextFromFile(file);
        if (rawText.trim()) {
          const token = loadTalentAuth()?.token || getAuthToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetch("/api/resume/analyze", {
            method:  "POST",
            headers,
            body:    JSON.stringify({ resumeText: rawText }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.profile) {
              // Map Vanessa response to the local result shape
              const p = data.profile;
              result = {
                fullName:          p.personalInfo.fullName,
                email:             p.personalInfo.email,
                phone:             p.personalInfo.phone,
                location:          p.personalInfo.location,
                targetPosition:    p.professional.title,
                jobCategory:       "",
                summary:           p.professional.summary,
                yearsOfExperience: p.professional.yearsOfExperience,
                seniority:         p.professional.seniority,
                coreSkills:        p.skills.core,
                secondarySkills:   p.skills.secondary,
                languages:         p.personalInfo.languages,
                workHistory: (p.experience ?? []).map((e: any) => ({
                  jobTitle:         e.jobTitle,
                  company:          e.company,
                  duration:         e.duration || [e.startDate, e.endDate].filter(Boolean).join(" – ") || "",
                  responsibilities: Array.isArray(e.responsibilities) ? e.responsibilities.join("\n") : (e.responsibilities ?? ""),
                })),
                education: (p.education ?? []).map((e: any) => ({
                  school:    e.school,
                  degree:    e.degree,
                  yearStart: e.startYear ?? "",
                  yearEnd:   e.endYear   ?? "",
                })),
                certifications: (p.certifications ?? []).map((c: any) => ({
                  name:   c.name,
                  issuer: c.issuer ?? "",
                  date:   c.date   ?? "",
                  link:   "",
                })),
                confidence:     p.confidence?.overall >= 0.80 ? "high" : p.confidence?.overall >= 0.60 ? "partial" : "low",
                extractedFields: Object.keys(p.personalInfo ?? {}).concat(Object.keys(p.professional ?? {})),
              } as any;
            } else {
              throw new Error("Vanessa unavailable");
            }
          } else {
            throw new Error("Vanessa server error");
          }
        } else {
          throw new Error("Empty text");
        }
      } catch {
        // Fall back to local deterministic parser
        result = await parseResumeFile(file);
      }
      if (import.meta.env.DEV) {
        console.log("[FindBestMatches] Resume parse result:", {
          extractedLocation: result.location,
          extractedFields: result.extractedFields,
          parseError: result.parseError,
        });
      }

      if (result.parseError) {
        setExtractParseError(result.parseError);
      } else {
        setExtracted(result);
        if (import.meta.env.DEV) {
          console.log("[FindBestMatches] Applying location to profile:", {
            location: result.location,
          });
        }
        // Hydrate profile with extracted values — suggestions only, never overwrite user edits
        setProfile((prev) => ({
          ...prev,
          fullName:         prev.fullName         || result.fullName,
          email:            prev.email            || result.email,
          phone:            prev.phone            || result.phone,
          location:         prev.location         || result.location,
          targetPosition:   prev.targetPosition   || result.targetPosition,
          jobCategory:      prev.jobCategory      || result.jobCategory,
          yearsOfExperience: prev.yearsOfExperience || result.yearsOfExperience,
          seniority:        prev.seniority        || result.seniority,
          summary:          prev.summary          || result.summary,
          coreSkills: prev.coreSkills.length
            ? prev.coreSkills
            : result.coreSkills.length ? result.coreSkills : prev.coreSkills,
          secondarySkills: prev.secondarySkills.length
            ? prev.secondarySkills
            : result.secondarySkills.length ? result.secondarySkills : prev.secondarySkills,
          workHistory: prev.workHistory.length
            ? prev.workHistory
            : result.workHistory.length ? result.workHistory : prev.workHistory,
          education: prev.education.length
            ? prev.education
            : result.education.length ? result.education : prev.education,
          certifications: prev.certifications.length
            ? prev.certifications
            : result.certifications.length ? result.certifications : prev.certifications,
          languages: prev.languages.length
            ? prev.languages
            : result.languages.length ? result.languages : prev.languages,
        }));
      }
    } catch {
      setExtractParseError(
        "An unexpected error occurred while reading your resume.",
      );
    } finally {
      setExtracting(false);
      // Automatically advance to Step 2 (profile review)
      setFlowStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function setField<K extends keyof CandidateProfile>(
    key: K,
    value: CandidateProfile[K],
  ) {
    setProfile((p) => ({ ...p, [key]: value }));
  }
  function toggleCoreSkill(skill: string) {
    const cur = profile.coreSkills;
    setField(
      "coreSkills",
      cur.includes(skill) ? cur.filter((s) => s !== skill) : [...cur, skill],
    );
  }
  function addSecondarySkill() {
    const val = secSkillInput.trim();
    if (!val || profile.secondarySkills.includes(val)) {
      setSecSkillInput("");
      return;
    }
    setField("secondarySkills", [...profile.secondarySkills, val]);
    setSecSkillInput("");
  }
  function removeSecondarySkill(skill: string) {
    setField(
      "secondarySkills",
      profile.secondarySkills.filter((s) => s !== skill),
    );
  }
  function setValuesAnswer(qId: string, optId: string) {
    setField("valuesAnswers", { ...profile.valuesAnswers, [qId]: optId });
  }

  // ── Work history helpers ──────────────────────────────────────────────────
  function openAddWorkForm() {
    setWorkEntry({ ...EMPTY_WORK_ENTRY });
    setEditWorkIdx(null);
    setShowWorkForm(true);
  }
  function openEditWorkForm(idx: number) {
    setWorkEntry({ ...profile.workHistory[idx] });
    setEditWorkIdx(idx);
    setShowWorkForm(true);
  }
  function cancelWorkForm() {
    setShowWorkForm(false);
    setEditWorkIdx(null);
    setWorkEntry({ ...EMPTY_WORK_ENTRY });
  }
  function saveWorkEntry() {
    if (!workEntry.jobTitle.trim() || !workEntry.company.trim()) return;
    const newHistory = [...profile.workHistory];
    if (editWorkIdx !== null) {
      newHistory[editWorkIdx] = { ...workEntry };
    } else {
      newHistory.push({ ...workEntry });
    }
    setField("workHistory", newHistory);
    cancelWorkForm();
  }
  function removeWorkEntry(idx: number) {
    setField(
      "workHistory",
      profile.workHistory.filter((_, i) => i !== idx),
    );
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  async function handleNext() {
    // ── Step 1 → 2: Save profile to DB ──────────────────────────────────────
    if (flowStep === 1) {
      setIsSavingProfile(true);
      let savedOk = false;
      try {
        // Derive firstName / lastName from fullName using the same heuristic as
        // Settings (all words except the last = given name, last word = surname).
        // This populates the separate DB columns so Settings doesn't need to fall back
        // to splitting and the name round-trips correctly.
        const _nameParts = (profile.fullName || "").trim().split(/\s+/).filter(Boolean);
        const _derivedFirst = _nameParts.length > 1 ? _nameParts.slice(0, -1).join(" ") : (_nameParts[0] || "");
        const _derivedLast  = _nameParts.length > 1 ? (_nameParts.at(-1) ?? "") : "";

        // ── DIAGNOSTIC: trace exactly what FBM is about to send ────────────
        console.log("FBM FINAL CANDIDATE PAYLOAD", {
          candidateId,
          fullName:         profile.fullName,
          phone:            profile.phone,
          location:         profile.location,
          targetPosition:   profile.targetPosition,
          jobCategory:      profile.jobCategory,
          yearsOfExperience: profile.yearsOfExperience,
          seniority:        profile.seniority,
          coreSkills:       profile.coreSkills,
          secondarySkills:  profile.secondarySkills,
          summary:          profile.summary,
          workHistory:      profile.workHistory,
          preferences:      {
            setup:       profile.preferredSetup,
            shift:       profile.preferredShift,
            jobType:     profile.preferredJobType,
            environment: profile.workEnvironment,
          },
          tokenSource: loadTalentAuth()?.token ? "portal-jwt" : "main-jwt",
        });

        const payload = {
          fullName:        profile.fullName,
          firstName:       _derivedFirst,
          lastName:        _derivedLast,
          email:           profile.email || user?.email || null,
          phone:           profile.phone || null,
          location:        profile.location || null,
          targetPosition:  profile.targetPosition,
          category:        profile.jobCategory,
          experienceYears: profile.yearsOfExperience || null,
          seniority:       profile.seniority || null,
          coreSkills:      profile.coreSkills,
          secondarySkills: profile.secondarySkills,
          workHistory:     profile.workHistory,
          education:       profile.education.length > 0 ? profile.education : undefined,
          certifications:  profile.certifications.length > 0 ? profile.certifications : undefined,
          preferences: {
            setup:       profile.preferredSetup,
            shift:       profile.preferredShift,
            jobType:     profile.preferredJobType,
            environment: profile.workEnvironment,
            ...(profile.languages.length > 0 ? { languages: profile.languages } : {}),
          },
          summary:          profile.summary || null,
          profileCompleted: true,
          updatedAt:        new Date().toISOString(),
        };
        const token = getAuthToken();
        const url = candidateId ? `/api/candidates/${candidateId}` : "/api/candidates";
        const method = candidateId ? "PATCH" : "POST";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
        if (res.ok) {
          const data = await res.json();
          // ── DIAGNOSTIC: confirm what the server actually persisted ──────────
          console.log("FBM SAVED CANDIDATE RESPONSE", {
            id:             data.id,
            location:       data.location,
            targetPosition: data.targetPosition,
            coreSkills:     data.coreSkills,
            secondarySkills: data.secondarySkills,
            summary:        data.summary,
            preferences:    data.preferences,
            profileCompleted: data.profileCompleted,
          });
          let resolvedCandidateId = candidateId;
          if (!candidateId) {
            setCandidateId(data.id);
            resolvedCandidateId = data.id;
          }
          savedOk = true;

          // Invalidate ALL candidate query key variants so TopNavigation, Settings,
          // and TalentProfile all see the fresh data without a page reload.
          queryClient.invalidateQueries({ queryKey: ["/api/candidates/me"] });
          if (resolvedCandidateId) {
            queryClient.invalidateQueries({ queryKey: ["/api/candidates", resolvedCandidateId] });
            queryClient.invalidateQueries({ queryKey: ["candidate", resolvedCandidateId] });
            // Settings hook uses "candidate-profile" — bust its cache too so it
            // shows the FBM-saved values as soon as the user opens /settings.
            queryClient.invalidateQueries({ queryKey: ["candidate-profile", resolvedCandidateId] });
          }

          // Non-blocking: upload the resume file to object storage now that we have a candidateId.
          // Uses the standard talent user JWT — the resume endpoint accepts both candidate and user JWTs.
          if (profile.resumeFile && resolvedCandidateId) {
            const uploadToken = getAuthToken();
            if (uploadToken) {
              const resumeForm = new FormData();
              resumeForm.append("resume", profile.resumeFile);
              fetch(`/api/candidates/${resolvedCandidateId}/resume`, {
                method: "POST",
                headers: { Authorization: `Bearer ${uploadToken}` },
                body: resumeForm,
              }).catch(() => {}); // Non-blocking — profile JSON save already succeeded
            }
          }
        }
      } catch {
        // Non-blocking — proceed even if save fails
      } finally {
        setIsSavingProfile(false);
      }
      // On successful save, show Profile Saved confirmation instead of auto-advancing
      if (savedOk) {
        setProfileSaved(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    // ── Step 2: Culture Evaluation → save to DB, then show result ────────────
    if (flowStep === 2) {
      const { score, traits, summary } = computeValuesAlignment(profile.valuesAnswers);
      const breakdown = computeValuesBreakdown(profile.valuesAnswers);
      const alignmentLevel =
        score >= 80 ? "Strong" :
        score >= 60 ? "Solid" :
        score >= 40 ? "Growing" : "Developing";
      const valueScores = breakdown.map((b) => ({
        value: b.value,
        score: b.score,
        trait: b.trait,
      }));

      setIsSavingEvaluation(true);
      setEvaluationSaveError(false);
      try {
        const cidToUse = candidateId;
        if (cidToUse) {
          const res = await fetch(
            `/api/candidates/${cidToUse}/culture-evaluation`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                answers: profile.valuesAnswers,
                valueScores,
                overallScore: score,
                alignmentLevel,
                summary,
                traits,
              }),
            },
          );
          if (res.ok) {
            const data = await res.json();
            setSavedEvaluationId(data.evaluationId ?? null);
          } else {
            setEvaluationSaveError(true);
          }
        }
        // Non-blocking — always advance even if no candidateId or save failed
      } catch {
        setEvaluationSaveError(true);
      } finally {
        setIsSavingEvaluation(false);
      }
    }

    // ── Step 3: Culture Result → trigger matching ────────────────────────────
    if (flowStep === LAST_FLOW_STEP) {
      if (candidateId) {
        const answered = Object.keys(profile.valuesAnswers).length;
        if (answered > 0) {
          const { score } = computeValuesAlignment(profile.valuesAnswers);
          const patchToken = getAuthToken();
          const patchHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (patchToken) patchHeaders["Authorization"] = `Bearer ${patchToken}`;
          fetch(`/api/candidates/${candidateId}`, {
            method: "PATCH",
            headers: patchHeaders,
            body: JSON.stringify({
              cultureScore: score,
              updatedAt: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
      }
      setPhase("matching");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setFlowStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    // On the Profile Saved confirmation screen, go back to the profile form
    if (profileSaved) {
      setProfileSaved(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (flowStep > 0) {
      setFlowStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // On the first step, navigate back to the Talent Portal
      navigate("/talent-portal");
    }
  }
  function handleRetake() {
    // Restart the guided flow so the talent can update their career path/preferences.
    // IMPORTANT: keep candidateId — subsequent saves must PATCH the existing candidate,
    //   not POST a new one. Retaking does NOT reset profileCompleted.
    // Keep profile data pre-filled — the user only edits what changed.
    setSecSkillInput("");
    setFlowStep(0);
    setPhase("flow");
    setExtracted(null);
    setExtractParseError(null);
    setExtracting(false);
    // candidateId intentionally NOT cleared — saves must update the existing record.
    setProfileSaved(false);
    setShowWorkForm(false);
    setEditWorkIdx(null);
    setWorkEntry({ ...EMPTY_WORK_ENTRY });
    setIsSavingEvaluation(false);
    setEvaluationSaveError(false);
    setSavedEvaluationId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const ready = canProceed(flowStep, profile) && !extracting && !isSavingProfile && !isSavingEvaluation;

  // ── Hero ──────────────────────────────────────────────────────────────────
  function HeroContent() {
    if (phase === "matching")
      return (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge className="mb-4 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin inline" />
            Matching in Progress
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Finding your best-fit roles.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-500">
            We're evaluating your profile, preferences, and values alignment
            against active posted roles.
          </p>
        </motion.div>
      );

    if (phase === "results")
      return (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#474ead]/10">
              <Sparkles className="h-5 w-5 text-[#474ead]" />
            </div>
            <Badge className="rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
              {profileAlreadyCompleted ? "Your Career Match" : "Your Results"}
            </Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            {profileAlreadyCompleted ? "Welcome back." : "Your personalized matches."}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-500">
            {profileAlreadyCompleted
              ? "You've already completed your Talent setup. View your profile, browse roles, or retake the assessment to update your career direction."
              : "Below is your profile archetype, values alignment, and any active posted roles that genuinely fit your background."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {/* Primary: view the actual Talent Profile — always available once candidateId is known */}
            {candidateId && (
              <Button
                onClick={() => navigate(`/talent-profile/${candidateId}`)}
                className="rounded-full bg-[#474ead] px-6 text-white"
              >
                <User className="mr-2 h-4 w-4" /> View Talent Profile
              </Button>
            )}
            <Button
              onClick={() => navigate("/find-work/jobs")}
              className={`rounded-full px-6 ${candidateId ? "bg-transparent text-[#474ead] border border-[#474ead]/30 hover:bg-[#474ead]/5" : "bg-[#474ead] text-white"}`}
              variant={candidateId ? "outline" : "default"}
            >
              Browse All Roles
            </Button>
            <Button
              variant="outline"
              onClick={handleRetake}
              className="rounded-full px-6"
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Retake Assessment
            </Button>
          </div>
        </motion.div>
      );

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Badge className="mb-4 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
          Candidate Matching Journey
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
          Find your best-fit remote role.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-500">
          A guided journey. Upload your resume, build your profile, complete a
          culture evaluation — then see roles that truly match you.
        </p>
        <FlowProgress flowStep={flowStep} />
      </motion.div>
    );
  }

  // ── Step 0: Resume Upload ─────────────────────────────────────────────────
  function UploadResumeStep() {
    return (
      <div>
        <StepLabel step={1} title="Resume Upload" />
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Let's start with your resume.
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Upload your resume and we'll automatically fill in your profile for
          you — or continue manually if you prefer.
        </p>
        <div className="mt-6 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />

          {/* Extracting state */}
          {extracting ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#474ead]/25 bg-[#474ead]/5 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead] text-white shadow-lg shadow-[#474ead]/20">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Analyzing your resume…
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Extracting your profile details. This takes a moment.
                </p>
              </div>
            </div>
          ) : profile.resumeFile ? (
            <div className="flex items-center gap-4 rounded-2xl border border-[#474ead]/25 bg-[#474ead]/5 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#474ead] text-white">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {profile.resumeFile.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resume received. Review your prefilled profile in the next
                  step.
                </p>
              </div>
              <button
                onClick={() => {
                  setField("resumeFile", null);
                  setExtracted(null);
                  setExtractParseError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Remove resume"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : profile.resumeUrl ? (
            /* Resume already on file from a previous session — no upload needed */
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">Resume on file</p>
                  <p className="text-xs text-emerald-700 mt-0.5 truncate">
                    {profile.resumeFileName || "Your resume is saved"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFlowStep(1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors text-center"
                >
                  Use Existing Resume
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors text-center"
                >
                  Replace Resume
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center transition-all hover:border-[#474ead]/40 hover:bg-[#474ead]/3"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
                <Upload className="h-5 w-5 text-[#474ead]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Upload your resume
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  PDF, DOC, or DOCX — up to 5 MB
                </p>
              </div>
              <span className="rounded-full border border-[#474ead]/30 bg-white px-4 py-1.5 text-xs font-medium text-[#474ead] shadow-sm">
                Choose file
              </span>
            </button>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <span>or continue without one</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <button
            type="button"
            onClick={() => {
              setFlowStep(1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 hover:border-[#474ead]/40 hover:bg-[#474ead]/5 hover:text-[#474ead] transition-all text-center"
          >
            Continue Manually — I'll fill in my profile myself
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Finalize Information ─────────────────────────────────────────
  function FinalizeInformationStep() {
    // Banner copy depends on extraction outcome
    const hasPrefilled = extracted && extracted.extractedFields.length > 0;
    const hasPartialPrefill = extracted && extracted.confidence === "partial";

    return (
      <div className="space-y-8">
        <div>
          <StepLabel step={2} title="Finalize Your Profile" />
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {hasPrefilled
              ? "Review your extracted profile."
              : "Tell us about yourself."}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            This is the main source of truth for your job matching. Please
            review and complete every field — the more accurate this is, the
            more precise your matches will be.
          </p>
        </div>

        {/* ── Extraction notice ─────────────────────────────────────────────── */}
        {profile.resumeFile && !extracting && (
          <>
            {hasPrefilled && (
              <div
                className={`flex gap-3 rounded-2xl border p-4 ${
                  hasPartialPrefill
                    ? "border-amber-200 bg-amber-50"
                    : "border-[#474ead]/20 bg-[#474ead]/5"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    hasPartialPrefill
                      ? "bg-amber-100 text-amber-600"
                      : "bg-[#474ead]/15 text-[#474ead]"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${hasPartialPrefill ? "text-amber-800" : "text-[#474ead]"}`}
                  >
                    {hasPartialPrefill
                      ? "Partially auto-filled from your resume"
                      : "Pre-filled from your resume"}
                  </p>
                  <p
                    className={`mt-0.5 text-xs leading-relaxed ${hasPartialPrefill ? "text-amber-700" : "text-slate-600"}`}
                  >
                    {hasPartialPrefill
                      ? "We extracted some details. Please review and fill in any missing fields."
                      : "We've populated your profile with detected information. Review everything before continuing."}
                  </p>
                  {extracted.extractedFields.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {extracted.extractedFields.map((f) => (
                        <Badge
                          key={f}
                          className={`text-[10px] px-2 py-0.5 rounded-full pointer-events-none ${
                            hasPartialPrefill
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : "bg-[#474ead]/10 text-[#474ead] border-transparent"
                          }`}
                        >
                          {EXTRACTED_FIELD_LABELS[f] ?? f}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {extractParseError && (
              <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    Couldn't fully read your resume
                  </p>
                  <p className="mt-0.5 text-xs text-red-600">
                    {extractParseError} Please complete your profile manually
                    below.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Basic info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Basic Information
          </h3>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Full Name{" "}
              <span className="text-[#474ead] text-xs font-semibold ml-1">Required</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="e.g. Maria Santos"
                value={profile.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                className={`rounded-xl pl-9 ${flowStep === 1 && !profile.fullName.trim() ? "border-red-300 focus-visible:ring-red-400" : ""}`}
              />
            </div>
            {flowStep === 1 && !profile.fullName.trim() && (
              <p className="text-xs text-red-500">Please enter your full name.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Email{" "}
                <span className="text-[#474ead] text-xs font-semibold ml-1">Required</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="e.g. maria@gmail.com"
                  value={profile.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={`rounded-xl pl-9 ${flowStep === 1 && profile.email && !isValidEmail(profile.email) ? "border-red-300 focus-visible:ring-red-400" : ""}`}
                />
              </div>
              {flowStep === 1 && profile.email && !isValidEmail(profile.email) && (
                <p className="text-xs text-red-500">Please enter a valid email address.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Phone Number{" "}
                <span className="text-[#474ead] text-xs font-semibold ml-1">Required</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={profile.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className={`rounded-xl pl-9 ${flowStep === 1 && profile.phone && !isValidPhone(profile.phone) ? "border-red-300 focus-visible:ring-red-400" : ""}`}
                />
              </div>
              {flowStep === 1 && profile.phone && !isValidPhone(profile.phone) && (
                <p className="text-xs text-red-500">Please enter a valid phone number.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Location{" "}
              <span className="text-[#474ead] text-xs font-semibold ml-1">Required</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="e.g. Cebu City, Philippines"
                value={profile.location}
                onChange={(e) => setField("location", e.target.value)}
                className={`rounded-xl pl-9 ${flowStep === 1 && !profile.location.trim() ? "border-red-300 focus-visible:ring-red-400" : ""}`}
              />
            </div>
            {flowStep === 1 && !profile.location.trim() && (
              <p className="text-xs text-red-500">Please enter your current location.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Target Job Position{" "}
              <span className="text-[#474ead] text-xs font-semibold ml-1">
                Required — drives your match
              </span>
            </Label>
            <Input
              placeholder="e.g. Executive Assistant, Team Manager, Bookkeeper"
              value={profile.targetPosition}
              onChange={(e) => setField("targetPosition", e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-slate-400">
              Be specific — this is the most important field for accurate
              matching.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Job Category
              <span className="text-[#474ead] text-xs font-semibold ml-1">
                Required
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {JOB_CATEGORIES.map((cat) => (
                <OptionChip
                  key={cat}
                  label={cat}
                  selected={profile.jobCategory === cat}
                  onClick={() => setField("jobCategory", cat)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Experience */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Experience & Seniority
          </h3>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Years of Professional Experience{" "}
              <span className="text-[#474ead] text-xs font-semibold ml-1">
                Required
              </span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <SelectCard
                  key={lvl.id}
                  label={lvl.label}
                  desc={lvl.desc}
                  selected={profile.yearsOfExperience === lvl.id}
                  onClick={() => setField("yearsOfExperience", lvl.id)}
                  icon={Clock}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Seniority Level{" "}
              <span className="text-[#474ead] text-xs font-semibold ml-1">
                Required
              </span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {SENIORITY_LEVELS.map((s) => (
                <SelectCard
                  key={s.id}
                  label={s.label}
                  desc={s.desc}
                  selected={profile.seniority === s.id}
                  onClick={() => setField("seniority", s.id)}
                  icon={Target}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Skills
          </h3>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Core Skills{" "}
              <span className="text-[#474ead] text-xs font-semibold ml-1">
                Required — select all that apply
              </span>
            </Label>
            <div className="flex flex-wrap gap-2.5">
              {CORE_SKILLS.map((s) => (
                <OptionChip
                  key={s}
                  label={s}
                  selected={profile.coreSkills.includes(s)}
                  onClick={() => toggleCoreSkill(s)}
                />
              ))}
            </div>
            {profile.coreSkills.length > 0 && (
              <p className="text-xs text-slate-400">
                {profile.coreSkills.length} skill
                {profile.coreSkills.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Secondary Skills{" "}
              <span className="text-slate-400 font-normal">
                (optional — type and add)
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Canva, HubSpot, G Suite…"
                value={secSkillInput}
                onChange={(e) => setSecSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSecondarySkill();
                  }
                }}
                className="rounded-xl flex-1"
              />
              <Button
                type="button"
                size="default"
                variant="outline"
                onClick={addSecondarySkill}
                className="rounded-xl shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {profile.secondarySkills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {profile.secondarySkills.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSecondarySkill(s)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Work Preferences */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Work Preferences
          </h3>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Preferred Work Setup
            </Label>
            <div className="flex flex-wrap gap-2.5">
              {SETUP_OPTIONS.map((opt) => (
                <OptionChip
                  key={opt}
                  label={opt}
                  selected={profile.preferredSetup === opt}
                  onClick={() => setField("preferredSetup", opt)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Preferred Shift
            </Label>
            <div className="flex flex-wrap gap-2.5">
              {SHIFT_OPTIONS.map((opt) => (
                <OptionChip
                  key={opt}
                  label={opt}
                  selected={profile.preferredShift === opt}
                  onClick={() => setField("preferredShift", opt)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Preferred Job Type
            </Label>
            <div className="flex flex-wrap gap-2.5">
              {JOBTYPE_OPTIONS.map((opt) => (
                <OptionChip
                  key={opt}
                  label={opt}
                  selected={profile.preferredJobType === opt}
                  onClick={() => setField("preferredJobType", opt)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Preferred Work Environment
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {WORK_ENVIRONMENTS.map((e) => (
                <SelectCard
                  key={e.id}
                  label={e.label}
                  desc={e.desc}
                  selected={profile.workEnvironment === e.id}
                  onClick={() => setField("workEnvironment", e.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Work History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
              Work History{" "}
              <span className="font-normal normal-case text-slate-400">
                (optional)
              </span>
            </h3>
            {!showWorkForm && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openAddWorkForm}
                className="rounded-full shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
              </Button>
            )}
          </div>

          {/* Existing entries */}
          {profile.workHistory.length > 0 && (
            <div className="space-y-3">
              {profile.workHistory.map((entry, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {entry.jobTitle}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {entry.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {entry.company}
                          </span>
                        )}
                        {entry.duration && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> {entry.duration}
                          </span>
                        )}
                      </div>
                      {entry.responsibilities && (
                        <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {entry.responsibilities}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditWorkForm(idx)}
                        className="h-7 w-7"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeWorkEntry(idx)}
                        className="h-7 w-7 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inline add/edit form */}
          {showWorkForm && (
            <div className="rounded-2xl border border-[#474ead]/20 bg-[#474ead]/3 p-5 space-y-4">
              <p className="text-sm font-semibold text-[#474ead]">
                {editWorkIdx !== null ? "Edit Work Entry" : "Add Work Entry"}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">
                    Job Title <span className="text-[#474ead]">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Virtual Assistant"
                    value={workEntry.jobTitle}
                    onChange={(e) =>
                      setWorkEntry((w) => ({ ...w, jobTitle: e.target.value }))
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">
                    Company <span className="text-[#474ead]">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Acme Corp"
                    value={workEntry.company}
                    onChange={(e) =>
                      setWorkEntry((w) => ({ ...w, company: e.target.value }))
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  Duration (optional)
                </Label>
                <Input
                  placeholder="e.g. Jan 2022 – Present · 2 yrs"
                  value={workEntry.duration}
                  onChange={(e) =>
                    setWorkEntry((w) => ({ ...w, duration: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  Key Responsibilities (optional)
                </Label>
                <Textarea
                  placeholder="Brief summary of your main duties and achievements…"
                  value={workEntry.responsibilities}
                  onChange={(e) =>
                    setWorkEntry((w) => ({
                      ...w,
                      responsibilities: e.target.value,
                    }))
                  }
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={cancelWorkForm}
                  className="rounded-full px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveWorkEntry}
                  disabled={
                    !workEntry.jobTitle.trim() || !workEntry.company.trim()
                  }
                  className="rounded-full bg-[#474ead] px-5 text-white"
                >
                  {editWorkIdx !== null ? "Save Changes" : "Add Entry"}
                </Button>
              </div>
            </div>
          )}

          {profile.workHistory.length === 0 && !showWorkForm && (
            <p className="text-xs text-slate-400">
              No work history added yet. Click "Add Entry" to include past
              experience.
            </p>
          )}
        </div>

        {/* Optional summary */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Professional Summary{" "}
            <span className="font-normal normal-case text-slate-400">
              (optional)
            </span>
          </h3>
          <Textarea
            placeholder="A short paragraph about your background, what you're looking for, and what makes you a great fit…"
            value={profile.summary}
            onChange={(e) => setField("summary", e.target.value)}
            rows={4}
            className="rounded-xl resize-none"
          />
        </div>

        {/* Required fields reminder */}
        {flowStep === 1 && !canProceed(1, profile) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700 mb-1">
              Please fill in all required fields before continuing:
            </p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
              {!profile.fullName.trim() && <li>Full Name</li>}
              {!isValidEmail(profile.email) && <li>Email — valid email required</li>}
              {!isValidPhone(profile.phone) && <li>Phone Number</li>}
              {!profile.location.trim() && <li>Location</li>}
              {!profile.targetPosition.trim() && <li>Target Job Position</li>}
              {!profile.jobCategory && <li>Job Category</li>}
              {!profile.yearsOfExperience && <li>Years of Experience</li>}
              {!profile.seniority && <li>Seniority Level</li>}
              {profile.coreSkills.length === 0 && <li>At least one Core Skill</li>}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Profile Saved Confirmation (shown after step 1 saves successfully) ───────
  function ProfileSavedStep() {
    const idForProfile = candidateId;
    return (
      <div className="flex flex-col items-center text-center py-4">
        {/* Icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#474ead]/10">
          <CheckCircle2 className="h-10 w-10 text-[#474ead]" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Your profile has been saved.
        </h2>
        <p className="mt-3 max-w-md text-slate-500 leading-relaxed">
          We've saved your candidate profile. You can continue setting up your
          application journey, or view your profile page to review and complete
          your details.
        </p>

        {/* Profile summary pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {profile.targetPosition && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-[#474ead]" />
              {profile.targetPosition}
            </span>
          )}
          {profile.jobCategory && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              <Tag className="h-3.5 w-3.5 text-[#474ead]" />
              {profile.jobCategory}
            </span>
          )}
          {profile.yearsOfExperience && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              <Clock className="h-3.5 w-3.5 text-[#474ead]" />
              {profile.yearsOfExperience} exp
            </span>
          )}
          {profile.coreSkills.slice(0, 3).map((sk) => (
            <span
              key={sk}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#474ead]/20 bg-[#474ead]/5 px-3 py-1 text-sm text-[#474ead]"
            >
              {sk}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {/* Primary: continue the journey */}
          <Button
            className="w-full rounded-full bg-[#474ead] px-8 text-white sm:w-auto"
            onClick={() => {
              setProfileSaved(false);
              setFlowStep(2);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Continue Setup <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {/* Secondary: go to profile page */}
          {idForProfile && (
            <Button
              variant="outline"
              className="w-full rounded-full border-slate-300 px-8 sm:w-auto"
              onClick={() => navigate(`/candidate-profile/${idForProfile}`)}
            >
              <User className="mr-2 h-4 w-4" /> View My Profile
            </Button>
          )}
        </div>

        {/* Subtle note */}
        <p className="mt-6 text-xs text-slate-400">
          Your progress is saved — you can always return to complete the setup.
        </p>
      </div>
    );
  }



  // ── Step 2: Culture Evaluation ─────────────────────────────────────────────
  function CultureEvaluationStep() {
    const answered = Object.keys(profile.valuesAnswers).length;
    return (
      <div>
        <StepLabel step={3} title="Culture Evaluation" />
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          How well do you align with our culture?
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          These 6 questions evaluate your alignment with OnSpot's core values —
          accountability, urgency, integrity, and ownership. There are no wrong
          answers.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#474ead] transition-all duration-300"
              style={{
                width: `${(answered / CORE_VALUES_QUESTIONS.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-slate-400 shrink-0">
            {answered}/{CORE_VALUES_QUESTIONS.length} answered
          </span>
        </div>
        <div className="mt-6 space-y-6">
          {CORE_VALUES_QUESTIONS.map((q) => {
            const QIcon = q.icon;
            const selected = profile.valuesAnswers[q.id];
            return (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#474ead]/10 text-[#474ead]">
                    <QIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#474ead]">
                      {q.value}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      {q.question}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 italic">
                      "{q.context}"
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {q.options.map((opt) => {
                    const isSel = selected === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setValuesAnswer(q.id, opt.id)}
                        className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-all ${isSel ? "bg-[#474ead]/5" : "hover:bg-slate-50"}`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isSel ? "border-[#474ead] bg-[#474ead]" : "border-slate-300"}`}
                        >
                          {isSel && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span
                          className={`text-sm ${isSel ? "font-medium text-[#474ead]" : "text-slate-700"}`}
                        >
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {!ready && answered < CORE_VALUES_QUESTIONS.length && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium text-amber-700">
              Please answer all {CORE_VALUES_QUESTIONS.length} questions to
              continue.
            </p>
          </div>
        )}

        {/* Save error notice — shown if evaluation couldn't be persisted */}
        {evaluationSaveError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs font-medium text-red-700">
              We couldn't save your evaluation to the database. Your results
              will still be shown — please try again or contact support if this
              persists.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Culture Result ────────────────────────────────────────────────────────
  function CultureResultStep() {
    const alignment = valuesAlignment;
    const breakdown = computeValuesBreakdown(profile.valuesAnswers);
    const aligned = breakdown.filter((v) => v.score === 2);
    const partial = breakdown.filter((v) => v.score === 1);
    const missing = breakdown.filter((v) => v.score === 0);

    const headingText =
      alignment.score >= 80
        ? "You show strong alignment with OnSpot's core values."
        : alignment.score >= 60
          ? "You show promising alignment with several of OnSpot's core values."
          : alignment.score >= 40
            ? "You show some alignment with our culture — and room to grow."
            : "Our culture may be a meaningful shift for you.";

    const scoreBandColor =
      alignment.score >= 80
        ? "text-emerald-600"
        : alignment.score >= 60
          ? "text-[#474ead]"
          : alignment.score >= 40
            ? "text-amber-600"
            : "text-slate-500";

    const scoreBandBg =
      alignment.score >= 80
        ? "border-emerald-200 bg-emerald-50"
        : alignment.score >= 60
          ? "border-indigo-200 bg-indigo-50"
          : alignment.score >= 40
            ? "border-amber-200 bg-amber-50"
            : "border-slate-200 bg-slate-50";

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <StepLabel step={6} title="Culture Result" />
          {savedEvaluationId ? (
            <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100 shrink-0 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Evaluation Saved
            </Badge>
          ) : evaluationSaveError ? (
            <Badge className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-100 shrink-0">
              Save failed — contact support
            </Badge>
          ) : null}
        </div>

        {/* Score card */}
        <div
          className={`flex items-center gap-4 rounded-2xl border p-5 ${scoreBandBg}`}
        >
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 ${
              alignment.score >= 80
                ? "border-emerald-300 bg-emerald-100"
                : alignment.score >= 60
                  ? "border-indigo-300 bg-indigo-100"
                  : alignment.score >= 40
                    ? "border-amber-300 bg-amber-100"
                    : "border-slate-300 bg-slate-100"
            }`}
          >
            <span className={`text-xl font-bold ${scoreBandColor}`}>
              {alignment.score}%
            </span>
          </div>
          <div className="flex-1">
            <p className={`text-base font-semibold ${scoreBandColor}`}>
              {headingText}
            </p>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              {alignment.summary}
            </p>
          </div>
        </div>

        {/* Per-value breakdown */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Values Breakdown
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {breakdown.map((v) => {
              const Icon = v.icon;
              const isAligned = v.score === 2;
              const isPartial = v.score === 1;
              return (
                <div
                  key={v.value}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    isAligned
                      ? "border-emerald-200 bg-emerald-50"
                      : isPartial
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isAligned
                        ? "bg-emerald-100 text-emerald-600"
                        : isPartial
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold leading-tight ${
                        isAligned
                          ? "text-emerald-700"
                          : isPartial
                            ? "text-amber-700"
                            : "text-slate-500"
                      }`}
                    >
                      {v.value}
                    </p>
                    {v.trait ? (
                      <p className="text-xs text-slate-500 mt-0.5">{v.trait}</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Growth opportunity
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isAligned ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : isPartial ? (
                      <div className="h-4 w-4 rounded-full border-2 border-amber-400 bg-amber-100" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strengths */}
        {aligned.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              Observed Strengths
            </p>
            <div className="flex flex-wrap gap-2">
              {aligned.map((v) => (
                <span
                  key={v.value}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {v.trait ?? v.value}
                </span>
              ))}
              {partial.map(
                (v) =>
                  v.trait && (
                    <span
                      key={v.value}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                    >
                      {v.trait}
                    </span>
                  ),
              )}
            </div>
          </div>
        )}

        {/* Growth areas */}
        {missing.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-600">
              Growth areas to explore:{" "}
              <span className="font-normal text-slate-500">
                {missing.map((v) => v.value).join(", ")}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Every team member grows into our values. These are simply areas to
              be aware of as you join and develop.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">
            Ready to see which roles match your profile and values? Click{" "}
            <span className="font-semibold text-[#474ead]">
              Find My Matches
            </span>{" "}
            to continue.
          </p>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  function ResultsSection() {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <TopProfileCard primaryDomain={primaryDomain} profile={profile} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ValuesAlignmentCard alignment={valuesAlignment} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Relevant Job Openings
            </p>
            <h3 className="text-xl font-bold text-slate-900">
              {profile.targetPosition
                ? `Roles matching "${profile.targetPosition}"`
                : "Active roles that fit your profile"}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Only showing real open positions that are genuinely aligned to
              your finalized profile and niche.
            </p>
          </div>
        </motion.div>

        {jobsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
          </div>
        ) : openJobs.length === 0 ? (
          <NoOpenRoles onBrowse={() => navigate("/find-work/jobs")} />
        ) : jobMatches.length === 0 ? (
          <NoStrongMatches
            onBrowse={() => navigate("/find-work/jobs")}
            onRetake={handleRetake}
            targetPosition={profile.targetPosition}
          />
        ) : (
          <div className="space-y-4">
            {jobMatches.map((match, i) => (
              <PostedJobMatchCard
                key={match.job.id}
                match={match}
                rank={i}
                onApply={() => navigate(`/jobs/${match.job.id}/apply`)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  // IMPORTANT: call step functions directly (not as JSX components) so React
  // does NOT create a new component boundary on each render.  Using
  // <UploadResumeStep /> would cause React to see a new component type on
  // every parent re-render (since the function is recreated inside this
  // closure), unmounting and remounting all DOM nodes — including inputs —
  // which causes focus loss on every keystroke.
  function renderStep() {
    if (flowStep === 0) return UploadResumeStep();
    if (flowStep === 1) return profileSaved ? ProfileSavedStep() : FinalizeInformationStep();
    if (flowStep === 2) return CultureEvaluationStep();
    return CultureResultStep(); // step 3
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Post-registration welcome banner — only shown to newly created Talent accounts */}
      {showWelcome && (
        <div className="border-b border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-base font-semibold text-emerald-800 dark:text-emerald-300">
                  🎉 Welcome to OnSpot!
                </p>
                <p className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-400">
                  Your Talent account has been created and your application has been submitted.
                  Complete your Talent Profile so we can recommend the best opportunities for you.
                </p>
                {/* Progress steps */}
                <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Application Submitted
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Account Created
                  </li>
                  <li className="flex items-center gap-1 opacity-60">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-500 text-[9px] font-bold">3</span>
                    Complete Your Talent Profile
                  </li>
                  <li className="flex items-center gap-1 opacity-40">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-400 text-[9px] font-bold">4</span>
                    Start Receiving Job Matches
                  </li>
                </ol>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setShowWelcome(false)}
                className="mt-0.5 shrink-0 text-emerald-500 hover:text-emerald-700 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <HeroContent />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {phase === "matching" ? (
            <motion.div
              key="matching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <MatchingAnimation />
            </motion.div>
          ) : phase === "results" ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ResultsSection />
            </motion.div>
          ) : (
            <motion.div
              key={`step-${flowStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22 }}
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                {renderStep()}
              </div>

              {/* Nav buttons — hide primary CTA when existing-account card handles it */}
              <div className="mt-6 flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="rounded-full px-6"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                {/* Hide footer CTA when showing Profile Saved confirmation (it has its own CTAs) */}
                {!(flowStep === 1 && profileSaved) && (
                  <Button
                    onClick={handleNext}
                    disabled={!ready}
                    className="rounded-full bg-[#474ead] px-8 text-white"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Profile…
                      </>
                    ) : isSavingEvaluation ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Evaluation…
                      </>
                    ) : flowStep === LAST_FLOW_STEP ? (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" /> Find My Matches
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
