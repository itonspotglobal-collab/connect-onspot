import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Sparkles, RotateCcw,
  BriefcaseBusiness, Target, TrendingUp, ChevronRight,
  SearchX, Loader2, Inbox, Upload, FileText, X as XIcon,
  Shield, Zap, Heart, Award, Lightbulb, Clock,
  BarChart2, Star, User, Briefcase, Tag, Plus, AlertCircle,
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
import { parseResumeFile, type ExtractedCandidateProfile } from "@/lib/resumeParser";

// ─── CandidateProfile type ────────────────────────────────────────────────────

type Phase = "flow" | "matching" | "results";

interface CandidateProfile {
  // Step 1 — Upload
  resumeFile: File | null;
  // Step 2 — Finalize Information (primary source of truth for matching)
  fullName: string;
  targetPosition: string;   // FREE TEXT — most important matching input
  jobCategory: string;      // niche / department
  yearsOfExperience: string; // "0-1" | "1-3" | "3-5" | "5+"
  seniority: string;         // "entry" | "mid" | "senior"
  coreSkills: string[];      // from skill chips
  secondarySkills: string[]; // from free-text tag input
  preferredSetup: string;    // "Remote" | "Hybrid" | "On-site"
  preferredShift: string;
  preferredJobType: string;  // "Full-time" | "Part-time"
  workEnvironment: string;
  summary: string;           // optional short bio
  // Step 3 — Culture Evaluation
  valuesAnswers: Record<string, string>;
}

const EMPTY_PROFILE: CandidateProfile = {
  resumeFile: null,
  fullName: "", targetPosition: "", jobCategory: "",
  yearsOfExperience: "", seniority: "",
  coreSkills: [], secondarySkills: [],
  preferredSetup: "", preferredShift: "", preferredJobType: "",
  workEnvironment: "", summary: "",
  valuesAnswers: {},
};

// ─── Flow step definitions ────────────────────────────────────────────────────

const FLOW_STEPS = [
  { label: "Upload",        icon: Upload },
  { label: "Your Profile",  icon: FileText },
  { label: "Culture Fit",   icon: Heart },
];
const TOTAL_FLOW_STEPS = FLOW_STEPS.length;

// ─── Constants for Finalize step ─────────────────────────────────────────────

const CORE_SKILLS = [
  "Customer Support", "Admin Support", "Data Entry", "Calendar Management",
  "Email Management", "Research", "Social Media", "Content Writing",
  "Bookkeeping", "Project Coordination", "Sales Support", "Technical Support",
  "CRM Management", "Scheduling", "Report Generation",
];

const JOB_CATEGORIES = [
  "Admin", "Customer Support", "Marketing", "Finance",
  "Tech Support", "Sales", "Operations", "Design", "Development", "HR",
];

const EXPERIENCE_LEVELS = [
  { id: "0-1", label: "0–1 year",  desc: "New to professional remote work or just starting out" },
  { id: "1-3", label: "1–3 years", desc: "Solid foundation with some hands-on experience" },
  { id: "3-5", label: "3–5 years", desc: "Confident, well-rounded, and independently capable" },
  { id: "5+",  label: "5+ years",  desc: "Senior-level expertise with a strong track record" },
];

// Human-readable labels for auto-extracted field badges shown in Step 2 notice
const EXTRACTED_FIELD_LABELS: Record<string, string> = {
  fullName:          "Name",
  targetPosition:    "Job Title",
  jobCategory:       "Category",
  yearsOfExperience: "Experience",
  seniority:         "Seniority",
  coreSkills:        "Core Skills",
  secondarySkills:   "Other Skills",
  summary:           "Summary",
};

const SENIORITY_LEVELS = [
  { id: "entry",  label: "Entry / Junior",  desc: "Learning the ropes, eager to grow and contribute" },
  { id: "mid",    label: "Mid-level",        desc: "Independently capable with solid execution experience" },
  { id: "senior", label: "Senior / Lead",    desc: "Deep expertise, mentors others, drives initiatives" },
];

const SETUP_OPTIONS   = ["Remote", "Hybrid", "On-site"];
const SHIFT_OPTIONS   = ["Day shift", "Night shift", "Flexible hours"];
const JOBTYPE_OPTIONS = ["Full-time", "Part-time"];

const WORK_ENVIRONMENTS = [
  { id: "structured",    label: "Structured & predictable",  desc: "Clear processes, consistent routines, predictable days" },
  { id: "flexible",      label: "Flexible & dynamic",        desc: "Adapts fast, no two days are the same" },
  { id: "collaborative", label: "Highly collaborative",      desc: "Always working closely with a team" },
  { id: "independent",   label: "Independent & focused",     desc: "Deep focus, minimal interruptions" },
  { id: "process",       label: "Process-driven",            desc: "Systems, checklists, standards, quality control" },
  { id: "creative",      label: "Creative & evolving",       desc: "Ideas, content, and constant iteration" },
];

// ─── Core Values Assessment ───────────────────────────────────────────────────

interface ValuesOption { id: string; text: string; score: number; trait: string | null; }
interface ValuesQuestion {
  id: string; value: string; icon: React.ElementType;
  question: string; context: string; options: ValuesOption[];
}

const CORE_VALUES_QUESTIONS: ValuesQuestion[] = [
  {
    id: "people_first", value: "People First", icon: Heart,
    question: "A colleague is struggling and falling behind on a shared deliverable. What is your first instinct?",
    context: "We believe everything begins with people — and that the best teams lift each other up.",
    options: [
      { id: "a", text: "Check in privately and offer help before anything else",   score: 2, trait: "Empathetic & supportive" },
      { id: "b", text: "Raise it with the team so we can redistribute the load",   score: 2, trait: "Team-first thinker" },
      { id: "c", text: "Pick up the slack quietly without drawing attention",       score: 1, trait: "Selfless contributor" },
      { id: "d", text: "Focus on my own tasks and let them resolve it themselves",  score: 0, trait: null },
    ],
  },
  {
    id: "beat_yesterday", value: "Beat Yesterday", icon: TrendingUp,
    question: "You receive pointed feedback on a piece of work you were proud of. How do you respond?",
    context: "We never stop improving. The standard here is not perfection — it is continuous growth.",
    options: [
      { id: "a", text: "Welcome it immediately — this is how I get better",        score: 2, trait: "Growth-driven" },
      { id: "b", text: "Take time to process it, then apply what is useful",       score: 1, trait: "Reflective improver" },
      { id: "c", text: "Evaluate it based on who is giving it and why",            score: 1, trait: "Discerning learner" },
      { id: "d", text: "Prefer encouragement — critical feedback is demotivating", score: 0, trait: null },
    ],
  },
  {
    id: "fast_fast", value: "Fast-Fast-Fast", icon: Zap,
    question: "You are assigned an urgent task with incomplete information. What is your first move?",
    context: "Speed is our edge. We move with urgency and precision — not chaos.",
    options: [
      { id: "a", text: "Clarify the critical gaps fast, then start immediately",   score: 2, trait: "Decisive & precise" },
      { id: "b", text: "Make reasonable assumptions, document them, and move",     score: 2, trait: "Proactive executor" },
      { id: "c", text: "Loop in a teammate before starting to align",              score: 1, trait: "Collaborative" },
      { id: "d", text: "Wait until I have complete information before beginning",  score: 0, trait: null },
    ],
  },
  {
    id: "integrity", value: "Integrity Matters", icon: Shield,
    question: "You discover a process producing inaccurate results that your manager has not noticed. What do you do?",
    context: "We do what is right, especially when it is difficult. Trust is earned through transparency.",
    options: [
      { id: "a", text: "Report it immediately and come to the table with a fix",   score: 2, trait: "High integrity" },
      { id: "b", text: "Document it clearly and raise it at the next check-in",   score: 1, trait: "Methodical & reliable" },
      { id: "c", text: "Quietly correct it without flagging it",                   score: 1, trait: "Self-starter" },
      { id: "d", text: "Wait to see if anyone else catches it first",              score: 0, trait: null },
    ],
  },
  {
    id: "ownership", value: "Extreme Ownership", icon: Award,
    question: "A project you led missed a deadline — partly due to a teammate's delay. How do you handle the debrief?",
    context: "We do not pass problems. Every outcome — good or bad — belongs to the person who owns it.",
    options: [
      { id: "a", text: "Own the outcome fully — it was my project to deliver",                       score: 2, trait: "Full ownership mindset" },
      { id: "b", text: "Share context honestly, including what I could have flagged earlier",        score: 2, trait: "Accountable" },
      { id: "c", text: "Explain the contributing factors clearly and without blame",                 score: 1, trait: "Transparent" },
      { id: "d", text: "Highlight what went well and focus the conversation on next steps",          score: 0, trait: null },
    ],
  },
  {
    id: "intrapreneur", value: "We Are Intrapreneurs", icon: Lightbulb,
    question: "You spot an inefficiency in a process that is not officially your responsibility. What do you do?",
    context: "We think like builders. We take initiative and act like owners — not spectators.",
    options: [
      { id: "a", text: "Raise it with a proposed solution ready",                  score: 2, trait: "Proactive problem-solver" },
      { id: "b", text: "Flag it to my manager so they can decide what to do",      score: 1, trait: "Communicative" },
      { id: "c", text: "Fix it myself without raising it",                         score: 1, trait: "Independent fixer" },
      { id: "d", text: "It is not my area — I stay focused on my own work",        score: 0, trait: null },
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
  | "admin_ops"        // admin, operations, coordination, VA
  | "customer_support" // customer service, CX, help desk
  | "sales_marketing"  // sales, marketing, social media, content
  | "finance"          // bookkeeping, accounting, financial
  | "technical"        // IT, development, tech support
  | "design"           // graphic, UX/UI
  | "hr"               // recruitment, HR
  | "management"       // team lead, manager, director
  | "general";         // fallback

// ── Skill → domain(s) mapping ─────────────────────────────────────────────────
const SKILL_DOMAINS: Record<string, Domain[]> = {
  "Customer Support":    ["customer_support"],
  "Admin Support":       ["admin_ops"],
  "Data Entry":          ["admin_ops", "finance"],
  "Calendar Management": ["admin_ops"],
  "Email Management":    ["admin_ops", "customer_support"],
  "Research":            ["admin_ops", "sales_marketing"],
  "Social Media":        ["sales_marketing"],
  "Content Writing":     ["sales_marketing"],
  "Bookkeeping":         ["finance"],
  "Project Coordination":["admin_ops"],
  "Sales Support":       ["sales_marketing"],
  "Technical Support":   ["technical"],
  "CRM Management":      ["sales_marketing", "customer_support"],
  "Scheduling":          ["admin_ops"],
  "Report Generation":   ["finance", "admin_ops"],
};

// ── Skill aliases for overlap detection ──────────────────────────────────────
const SKILL_ALIASES: Record<string, string[]> = {
  "Customer Support":    ["customer service", "customer support", "cx", "client support", "help desk", "customer care"],
  "Admin Support":       ["administrative", "admin assistant", "office management", "admin support", "general admin"],
  "Data Entry":          ["data entry", "data processing", "data management", "data input", "data encoding"],
  "Calendar Management": ["calendar management", "appointment scheduling", "diary management", "meeting scheduling"],
  "Email Management":    ["email management", "inbox management", "email handling", "correspondence management"],
  "Research":            ["research", "market research", "data research", "online research"],
  "Social Media":        ["social media", "instagram", "facebook", "linkedin management", "tiktok", "social media management"],
  "Content Writing":     ["content writing", "copywriting", "blog writing", "content creation", "article writing"],
  "Bookkeeping":         ["bookkeeping", "accounting", "quickbooks", "xero", "accounts management", "bookkeeper", "financial records", "accounts receivable", "accounts payable"],
  "Project Coordination":["project management", "project coordination", "project planning", "task management", "pmo"],
  "Sales Support":       ["sales support", "lead generation", "cold calling", "outbound sales", "bdr", "sdr", "crm sales"],
  "Technical Support":   ["technical support", "tech support", "it support", "helpdesk", "troubleshooting"],
  "CRM Management":      ["crm", "salesforce", "hubspot", "zoho crm", "customer relationship", "crm management"],
  "Scheduling":          ["scheduling", "appointment setting", "diary management", "shift scheduling"],
  "Report Generation":   ["reporting", "report generation", "data analysis", "analytics", "business reporting", "kpi reporting"],
};

// ── Title keyword → domain inference (overrides category) ────────────────────
const TITLE_DOMAIN_RULES: Array<{ keywords: string[]; domain: Domain }> = [
  {
    keywords: [
      "it administrator", "it admin", "systems administrator", "network administrator",
      "sysadmin", "infrastructure", "devops", "cloud engineer", "database administrator",
      "software developer", "software engineer", "full stack", "backend developer",
      "frontend developer", "web developer", "programmer", "technical lead",
      "information technology", "it specialist", "it support specialist",
      "it manager", "it officer", "it coordinator", "it helpdesk",
      "network engineer", "security analyst", "cybersecurity",
    ],
    domain: "technical",
  },
  {
    keywords: [
      "accountant", "accounting manager", "accounts manager", "financial analyst",
      "bookkeeper", "bookkeeping", "finance manager", "finance officer", "cfo",
      "controller", "payroll", "accounts payable", "accounts receivable",
      "tax specialist", "auditor",
    ],
    domain: "finance",
  },
  {
    keywords: [
      "graphic designer", "ux designer", "ui designer", "visual designer",
      "motion designer", "illustrator", "creative director", "brand designer", "web designer",
    ],
    domain: "design",
  },
  {
    keywords: [
      "recruiter", "talent acquisition", "hr specialist", "hr manager",
      "human resources", "people operations", "hr coordinator", "hr officer",
    ],
    domain: "hr",
  },
  // Management — before sales/admin to catch "team manager", "operations manager"
  {
    keywords: [
      "team manager", "team lead", "operations manager", "department manager",
      "department head", "account manager", "program manager", "delivery manager",
      "line manager", "general manager", "director of", "head of",
    ],
    domain: "management",
  },
  {
    keywords: [
      "business development", "account executive", "sales manager", "sales rep",
      "sales specialist", "bdr", "sdr", "lead generation specialist",
      "digital marketing", "marketing manager", "seo specialist", "ads manager",
      "email marketing", "social media manager", "content strategist",
      "copywriter", "content writer",
    ],
    domain: "sales_marketing",
  },
  {
    keywords: [
      "customer service", "customer support", "customer success", "cx specialist",
      "support agent", "service representative", "client support",
    ],
    domain: "customer_support",
  },
  {
    keywords: [
      "virtual assistant", "executive assistant", "administrative assistant",
      "office manager", "project coordinator", "operations coordinator",
      "admin officer", "admin coordinator", "data entry specialist", "data encoder",
    ],
    domain: "admin_ops",
  },
];

// ── Category → domain fallback ────────────────────────────────────────────────
const CATEGORY_DOMAIN: Record<string, Domain> = {
  "Admin":            "admin_ops",
  "Operations":       "admin_ops",
  "Customer Support": "customer_support",
  "Customer success": "customer_support",
  "Marketing":        "sales_marketing",
  "Sales":            "sales_marketing",
  "Finance":          "finance",
  "Tech Support":     "technical",
  "Development":      "technical",
  "Design":           "design",
  "HR":               "hr",
};

// ── Domain incompatibility penalty matrix ─────────────────────────────────────
const DOMAIN_HARD_THRESHOLD = 40;

const DOMAIN_PENALTY: Partial<Record<Domain, Partial<Record<Domain, number>>>> = {
  admin_ops: {
    technical:  50,
    design:     25,
    hr:          0,
    finance:     5,
  },
  customer_support: {
    technical:  45,
    design:     30,
    finance:    30,
    hr:         15,
    sales_marketing: 5,
  },
  sales_marketing: {
    technical:  50,
    finance:    20,
    design:     10,
    hr:         10,
  },
  finance: {
    technical:  45,
    design:     35,
    sales_marketing: 15,
    customer_support: 20,
    hr:         20,
  },
  technical: {
    design:     10,
    finance:    25,
    hr:         30,
    customer_support: 10,
  },
  design: {
    technical:  15,
    finance:    30,
    hr:         30,
    customer_support: 15,
  },
  hr: {
    technical:  40,
    finance:    20,
    design:     30,
  },
  management: {
    // Managers can oversee many domains — low penalty to most
    technical:  10,
    finance:    10,
    design:     15,
    hr:          5,
  },
  general: {},
};

// ── Experience level tiers ────────────────────────────────────────────────────
const EXP_TO_TIER: Record<string, number> = { "0-1": 0, "1-3": 1, "3-5": 2, "5+": 3 };
const SENIORITY_TO_TIER: Record<string, number> = { entry: 0, mid: 2, senior: 3 };
const JOB_LEVEL_TIER: Record<string, number> = { entry: 0, intermediate: 2, expert: 3 };
const ACCEPTABLE_TIERS: Record<number, number[]> = {
  0: [0],
  1: [0, 1, 2],
  2: [1, 2, 3],
  3: [2, 3],
};
const JOB_LEVEL_LABEL: Record<string, string> = {
  entry: "Entry-level", intermediate: "Intermediate-level", expert: "Senior-level",
};

// ── Domain archetype display ──────────────────────────────────────────────────
const DOMAIN_ARCHETYPES: Record<Domain, { title: string; archetype: string; description: string }> = {
  admin_ops: {
    title: "Administrative & Operations Professional",
    archetype: "Operations Support",
    description: "Organized, reliable, and highly capable — you excel at keeping teams, calendars, and operations running smoothly.",
  },
  customer_support: {
    title: "Customer Experience Specialist",
    archetype: "Customer Support",
    description: "Empathetic, communicative, and client-focused — you build trust and resolve issues with care.",
  },
  sales_marketing: {
    title: "Sales & Marketing Professional",
    archetype: "Sales / Marketing Support",
    description: "Persuasive and brand-aware — you thrive in outreach, content, and growth-focused environments.",
  },
  finance: {
    title: "Finance & Accounting Specialist",
    archetype: "Finance / Admin Support",
    description: "Precise, methodical, and numbers-driven — you bring accuracy to financial records and reporting.",
  },
  technical: {
    title: "Technical Support Specialist",
    archetype: "Technical Support",
    description: "Problem-solving and technically confident — you diagnose issues and keep systems running with calm precision.",
  },
  design: {
    title: "Creative & Design Professional",
    archetype: "Creative / Design Support",
    description: "Visually sharp and conceptually strong — you translate briefs into compelling designs.",
  },
  hr: {
    title: "HR & People Operations Specialist",
    archetype: "HR / Recruitment Support",
    description: "People-focused and process-driven — you attract, assess, and support talent with integrity.",
  },
  management: {
    title: "Team Lead & Manager",
    archetype: "Leadership / Management",
    description: "A natural leader who drives performance, aligns teams, and delivers outcomes through people.",
  },
  general: {
    title: "General Professional",
    archetype: "General Support",
    description: "Well-rounded and adaptable — you bring a mix of skills suited to a variety of remote support roles.",
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
function getCandidateDomainsFromProfile(profile: CandidateProfile): Set<Domain> {
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
  return (Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0] as Domain);
}

function computeDomainPenalty(candidateDomains: Set<Domain>, jobDomain: Domain): number {
  let minPenalty = Infinity;
  for (const cd of candidateDomains) {
    if (cd === jobDomain) return 0;
    const p = DOMAIN_PENALTY[cd]?.[jobDomain] ?? 0;
    minPenalty = Math.min(minPenalty, p);
  }
  return minPenalty === Infinity ? 0 : minPenalty;
}

// ── Position relevance scoring ─────────────────────────────────────────────────
// Scores how closely the candidate's target position text matches the job title.
function scorePositionRelevance(candidatePosition: string, job: Job): number {
  if (!candidatePosition.trim()) return 0;
  const candLower  = candidatePosition.toLowerCase();
  const titleLower = (job.title ?? "").toLowerCase();
  const descLower  = (job.description ?? "").toLowerCase();

  // Exact or strong substring match against title
  if (titleLower === candLower) return 20;
  if (titleLower.includes(candLower) || candLower.includes(titleLower)) return 16;

  // Split into words and count overlap
  const candWords  = candLower.split(/\s+/).filter((w) => w.length > 2);
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
  const raw = matched.length === 0 ? 0
    : matched.length === 1 ? 12
    : matched.length === 2 ? 20
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

  // ── 2. Position relevance (0–20 pts) — PRIMARY driver ────────────────────
  const posScore = scorePositionRelevance(profile.targetPosition, job);
  score += posScore;
  if (posScore >= 12) {
    reasons.push(`Role aligns with your target position: ${profile.targetPosition}`);
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
        reasons.push(`Experience fit: ${JOB_LEVEL_LABEL[job.experienceLevel] ?? job.experienceLevel} role`);
      } else {
        const diff = Math.abs(cTier - jTier);
        if (diff === 1) score += 5;
        else score -= 10;
      }
    }
  }

  // ── 6. Work preferences (0–10 pts) ───────────────────────────────────────
  const descText = [job.description ?? "", ...(job.requirements ?? [])].join(" ").toLowerCase();
  const isVoiceRole = /\b(voice|phone call|calling|inbound call|outbound call|live call)\b/.test(descText);
  let prefScore = 0;
  const prefReasons: string[] = [];

  const locationLower = (job.location ?? "").toLowerCase();
  const isRemote = locationLower.includes("remote") || !locationLower;

  if (profile.preferredSetup === "Remote" && isRemote) { prefScore += 4; prefReasons.push("Remote setup"); }
  else if (profile.preferredSetup === "Remote" && !isRemote) prefScore -= 2;

  const isFixedFull = job.contractType === "fixed";
  if (profile.preferredJobType === "Full-time" && isFixedFull) prefScore += 3;
  else if (profile.preferredJobType === "Part-time" && !isFixedFull) prefScore += 3;

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

function computeAllMatches(profile: CandidateProfile, openJobs: Job[]): PostedJobMatch[] {
  if (openJobs.length === 0) return [];
  return openJobs
    .map((job) => scoreJobMatch(job, profile))
    .filter((m) => m.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ─── Values alignment output ──────────────────────────────────────────────────

interface ValuesAlignment { score: number; traits: string[]; summary: string; }

function computeValuesAlignment(valuesAnswers: Record<string, string>): ValuesAlignment {
  let total = 0;
  const traits: string[] = [];
  for (const q of CORE_VALUES_QUESTIONS) {
    const opt = q.options.find((o) => o.id === valuesAnswers[q.id]);
    if (opt) { total += opt.score; if (opt.trait) traits.push(opt.trait); }
  }
  const score = Math.round((total / VALUES_MAX_SCORE) * 100);
  let summary = "";
  if (score >= 80)
    summary = "Your responses reflect strong alignment with how we work at OnSpot. You demonstrate ownership, a people-first mindset, and a bias toward action — exactly what our best team members embody.";
  else if (score >= 60)
    summary = "You show solid alignment with several of our core values. You bring a growth-oriented approach and collaborative instincts that we value across all roles.";
  else if (score >= 40)
    summary = "Some of your instincts align with our culture. Every team member grows into our values — what matters most is the willingness to be accountable and keep improving.";
  else
    summary = "Our culture may be a meaningful shift for you. We value transparency, urgency, and ownership highly — and we invest in helping our team develop these traits over time.";
  return { score, traits, summary };
}

// ─── canProceed per step ──────────────────────────────────────────────────────

function canProceed(step: number, p: CandidateProfile): boolean {
  switch (step) {
    case 0: return true; // Upload is optional
    case 1:
      return (
        !!p.targetPosition.trim() &&
        !!p.jobCategory &&
        !!p.yearsOfExperience &&
        !!p.seniority &&
        p.coreSkills.length > 0
      );
    case 2: return Object.keys(p.valuesAnswers).length === CORE_VALUES_QUESTIONS.length;
    default: return true;
  }
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
      <h2 className="text-2xl font-semibold text-slate-900">Matching in Progress</h2>
      <p className="mt-2 text-sm text-slate-500">Sit tight — this takes just a moment.</p>
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
            <span className={i <= msgIdx ? "text-slate-700" : "text-slate-400"}>{msg}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function OptionChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
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
  label, desc, selected, onClick, icon: Icon,
}: { label: string; desc?: string; selected: boolean; onClick: () => void; icon?: React.ElementType }) {
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
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          selected ? "bg-[#474ead] text-white" : "bg-slate-100 text-slate-500"
        }`}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1">
        <p className={`text-sm font-semibold ${selected ? "text-[#474ead]" : "text-slate-800"}`}>{label}</p>
        {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      </div>
      {selected && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#474ead]" />}
    </button>
  );
}

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step {step} — {title}</p>
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
          <span className="font-semibold text-slate-700">{FLOW_STEPS[flowStep].label}</span>
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
              {i < flowStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result cards ─────────────────────────────────────────────────────────────

function TopProfileCard({ primaryDomain, profile }: { primaryDomain: Domain; profile: CandidateProfile }) {
  const archetype = DOMAIN_ARCHETYPES[primaryDomain] ?? DOMAIN_ARCHETYPES.general;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#474ead]/20 bg-gradient-to-br from-[#474ead]/6 via-white to-[#8e93ff]/5">
      <div className="px-6 py-5 border-b border-[#474ead]/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#474ead] mb-1">Your Profile Match</p>
        <h3 className="text-xl font-bold text-slate-900">
          {profile.targetPosition || archetype.title}
        </h3>
        <p className="text-sm text-[#474ead] font-medium mt-0.5">{archetype.archetype} archetype</p>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{archetype.description}</p>
      </div>
      {profile.coreSkills.length > 0 && (
        <div className="px-6 py-4">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Your core skills</p>
          <div className="flex flex-wrap gap-2">
            {profile.coreSkills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-[#474ead]/20 bg-[#474ead]/6 px-3 py-1 text-xs font-medium text-[#474ead]">
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
  const colorClass = alignment.score >= 80 ? "text-emerald-600" : alignment.score >= 60 ? "text-[#474ead]" : "text-amber-600";
  const bgClass    = alignment.score >= 80 ? "bg-emerald-50 border-emerald-100" : alignment.score >= 60 ? "bg-[#474ead]/5 border-[#474ead]/15" : "bg-amber-50 border-amber-100";
  return (
    <div className={`overflow-hidden rounded-2xl border ${bgClass}`}>
      <div className="px-6 py-5 border-b border-inherit">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Values & Culture Fit</p>
            <h3 className="text-xl font-bold text-slate-900">Your Values Alignment</h3>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-3xl font-bold ${colorClass}`}>{alignment.score}%</div>
            <div className="text-[10px] font-medium text-slate-500">alignment</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{alignment.summary}</p>
      </div>
      {alignment.traits.length > 0 && (
        <div className="px-6 py-4">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Your standout traits</p>
          <div className="flex flex-wrap gap-2">
            {alignment.traits.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[#474ead]/20 bg-[#474ead]/8 px-3 py-1 text-xs font-medium text-[#474ead]">
                <Star className="h-3 w-3" /> {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PostedJobMatchCard({ match, rank, onApply }: { match: PostedJobMatch; rank: number; onApply: () => void }) {
  const { job, score, reasons } = match;
  const tags = (job.skillTags ?? []).slice(0, 5);
  const scoreColor = score >= 75 ? "text-emerald-600" : score >= 55 ? "text-[#474ead]" : "text-slate-500";
  const scoreBg    = score >= 75 ? "bg-emerald-50" : score >= 55 ? "bg-[#474ead]/8" : "bg-slate-100";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.07 }}>
      <Card className="overflow-hidden border-slate-200/80">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div className="flex-1">
              {rank === 0 && (
                <Badge className="mb-2 rounded-full bg-[#474ead] text-[11px] text-white hover:bg-[#474ead]">Top Match</Badge>
              )}
              <h3 className="text-base font-bold text-slate-900">{job.title}</h3>
              <p className="mt-0.5 text-sm capitalize text-slate-500">
                {job.category ?? "General"}
                {job.location ? ` · ${job.location}` : ""}
                {job.contractType ? ` · ${job.contractType.replace(/-/g, " ")}` : ""}
                {job.experienceLevel ? ` · ${JOB_LEVEL_LABEL[job.experienceLevel] ?? job.experienceLevel}` : ""}
              </p>
            </div>
            <div className={`shrink-0 rounded-2xl px-3 py-1.5 text-center ${scoreBg}`}>
              <div className={`text-xl font-bold leading-none ${scoreColor}`}>{score}%</div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500">match</div>
            </div>
          </div>
          {reasons.length > 0 && (
            <div className="border-b border-slate-100 bg-[#474ead]/[0.02] px-5 py-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Why it fits you</p>
              <ul className="space-y-1">
                {reasons.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#474ead]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tags.length > 0 && (
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Key skills for this role</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((s) => (
                  <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{s}</span>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-slate-100 px-5 py-4">
            <Button onClick={onApply} className="rounded-full bg-[#474ead] text-white" size="sm">
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
        <h2 className="text-lg font-semibold text-slate-900">There are no open roles available at the moment.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          We're not showing role matches yet because there are currently no active job postings. Please check back later.
        </p>
        <div className="mt-6">
          <Button onClick={onBrowse} className="rounded-full bg-[#474ead] px-8 text-white">Browse All Roles</Button>
        </div>
      </div>
    </motion.div>
  );
}

function NoStrongMatches({ onBrowse, onRetake }: { onBrowse: () => void; onRetake: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-2xl border border-slate-200 bg-white px-8 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead]/10">
          <SearchX className="h-7 w-7 text-[#474ead]" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">No strong role matches are available right now.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Based on your finalized profile and culture assessment, we do not currently have an active posted role that closely matches your background. Please browse all current openings or check back soon.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onBrowse} className="rounded-full bg-[#474ead] px-8 text-white">Browse All Roles</Button>
          <Button variant="outline" onClick={onRetake} className="rounded-full px-8">
            <RotateCcw className="mr-2 h-4 w-4" /> Retake Assessment
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const APPLY_URL = "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true";

export default function FindBestMatches() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("flow");
  const [flowStep, setFlowStep] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile>(EMPTY_PROFILE);
  const [secSkillInput, setSecSkillInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resume-extraction state ──────────────────────────────────────────────
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedCandidateProfile | null>(null);
  const [extractParseError, setExtractParseError] = useState<string | null>(null);

  const { openJobs, isLoading: jobsLoading } = usePostedJobs();

  const primaryDomain   = useMemo(() => getPrimaryDomainFromProfile(profile), [profile]);
  const valuesAlignment = useMemo(() => computeValuesAlignment(profile.valuesAnswers), [profile.valuesAnswers]);
  const jobMatches      = useMemo(
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
    if (!file) { setExtracted(null); setExtractParseError(null); return; }

    setExtracting(true);
    setExtractParseError(null);

    try {
      const result = await parseResumeFile(file);

      if (result.parseError) {
        setExtractParseError(result.parseError);
      } else {
        setExtracted(result);
        // Hydrate profile with extracted values, keeping any already-set fields
        setProfile((prev) => ({
          ...prev,
          fullName:          result.fullName          || prev.fullName,
          targetPosition:    result.targetPosition    || prev.targetPosition,
          jobCategory:       result.jobCategory       || prev.jobCategory,
          yearsOfExperience: result.yearsOfExperience || prev.yearsOfExperience,
          seniority:         result.seniority         || prev.seniority,
          coreSkills:        result.coreSkills.length    ? result.coreSkills    : prev.coreSkills,
          secondarySkills:   result.secondarySkills.length ? result.secondarySkills : prev.secondarySkills,
          summary:           result.summary           || prev.summary,
        }));
      }
    } catch {
      setExtractParseError("An unexpected error occurred while reading your resume.");
    } finally {
      setExtracting(false);
      // Automatically advance to Step 2 (profile review)
      setFlowStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function setField<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }
  function toggleCoreSkill(skill: string) {
    const cur = profile.coreSkills;
    setField("coreSkills", cur.includes(skill) ? cur.filter((s) => s !== skill) : [...cur, skill]);
  }
  function addSecondarySkill() {
    const val = secSkillInput.trim();
    if (!val || profile.secondarySkills.includes(val)) { setSecSkillInput(""); return; }
    setField("secondarySkills", [...profile.secondarySkills, val]);
    setSecSkillInput("");
  }
  function removeSecondarySkill(skill: string) {
    setField("secondarySkills", profile.secondarySkills.filter((s) => s !== skill));
  }
  function setValuesAnswer(qId: string, optId: string) {
    setField("valuesAnswers", { ...profile.valuesAnswers, [qId]: optId });
  }
  function handleNext() {
    if (flowStep < TOTAL_FLOW_STEPS - 1) {
      setFlowStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setPhase("matching");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function handleBack() {
    if (flowStep > 0) { setFlowStep((s) => s - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }
  function handleRetake() {
    setProfile(EMPTY_PROFILE);
    setSecSkillInput("");
    setFlowStep(0);
    setPhase("flow");
    setExtracted(null);
    setExtractParseError(null);
    setExtracting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const ready = canProceed(flowStep, profile) && !extracting;

  // ── Hero ──────────────────────────────────────────────────────────────────
  function HeroContent() {
    if (phase === "matching")
      return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Badge className="mb-4 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin inline" />Matching in Progress
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">Finding your best-fit roles.</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-500">
            We're evaluating your profile, preferences, and values alignment against active posted roles.
          </p>
        </motion.div>
      );

    if (phase === "results")
      return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#474ead]/10">
              <Sparkles className="h-5 w-5 text-[#474ead]" />
            </div>
            <Badge className="rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">Your Results</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">Your personalized matches.</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-500">
            Below is your profile archetype, values alignment, and any active posted roles that genuinely fit your background.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => navigate("/find-work/jobs")} className="rounded-full bg-[#474ead] px-6 text-white">Browse All Roles</Button>
            <Button variant="outline" onClick={handleRetake} className="rounded-full px-6">
              <RotateCcw className="mr-2 h-4 w-4" /> Retake Assessment
            </Button>
          </div>
        </motion.div>
      );

    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Badge className="mb-4 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">Candidate Matching Journey</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">Find your best-fit remote role.</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-500">
          A guided 3-step journey. Upload your resume, finalize your profile, complete a culture evaluation — then see roles that truly match you.
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
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Let's start with your resume.</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Upload your resume and we'll automatically fill in your profile for you — or continue manually if you prefer.
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
                <p className="text-sm font-semibold text-slate-900">Analyzing your resume…</p>
                <p className="mt-1 text-xs text-slate-500">Extracting your profile details. This takes a moment.</p>
              </div>
            </div>
          ) : profile.resumeFile ? (
            <div className="flex items-center gap-4 rounded-2xl border border-[#474ead]/25 bg-[#474ead]/5 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#474ead] text-white">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{profile.resumeFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Resume received. Review your prefilled profile in the next step.</p>
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
                <p className="text-sm font-semibold text-slate-800">Upload your resume</p>
                <p className="mt-0.5 text-xs text-slate-500">PDF, DOC, or DOCX — up to 5 MB</p>
              </div>
              <span className="rounded-full border border-[#474ead]/30 bg-white px-4 py-1.5 text-xs font-medium text-[#474ead] shadow-sm">Choose file</span>
            </button>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <span>or continue without one</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">What happens next</p>
            <div className="space-y-3">
              {[
                { icon: Sparkles,  text: "We auto-extract your details from the resume" },
                { icon: FileText,  text: "Review and confirm your target position, skills, and preferences" },
                { icon: Heart,     text: "Complete a short culture evaluation aligned to our values" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#474ead]/10 text-[#474ead]">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm text-slate-600">{text}</span>
                </div>
              ))}
            </div>
          </div>
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
            {hasPrefilled ? "Review your extracted profile." : "Tell us about yourself."}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            This is the main source of truth for your job matching. Please review and complete every field — the more accurate this is, the more precise your matches will be.
          </p>
        </div>

        {/* ── Extraction notice ─────────────────────────────────────────────── */}
        {profile.resumeFile && !extracting && (
          <>
            {hasPrefilled && (
              <div className={`flex gap-3 rounded-2xl border p-4 ${
                hasPartialPrefill
                  ? "border-amber-200 bg-amber-50"
                  : "border-[#474ead]/20 bg-[#474ead]/5"
              }`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  hasPartialPrefill ? "bg-amber-100 text-amber-600" : "bg-[#474ead]/15 text-[#474ead]"
                }`}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${hasPartialPrefill ? "text-amber-800" : "text-[#474ead]"}`}>
                    {hasPartialPrefill
                      ? "Partially auto-filled from your resume"
                      : "Pre-filled from your resume"}
                  </p>
                  <p className={`mt-0.5 text-xs leading-relaxed ${hasPartialPrefill ? "text-amber-700" : "text-slate-600"}`}>
                    {hasPartialPrefill
                      ? "We extracted some details. Please review and fill in any missing fields."
                      : "We've populated your profile with detected information. Review everything before continuing."}
                  </p>
                  {extracted.extractedFields.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {extracted.extractedFields.map((f) => (
                        <Badge key={f} className={`text-[10px] px-2 py-0.5 rounded-full pointer-events-none ${
                          hasPartialPrefill
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-[#474ead]/10 text-[#474ead] border-transparent"
                        }`}>
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
                  <p className="text-sm font-semibold text-red-700">Couldn't fully read your resume</p>
                  <p className="mt-0.5 text-xs text-red-600">
                    {extractParseError} Please complete your profile manually below.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Basic info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Basic Information</h3>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Full Name <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              placeholder="e.g. Maria Santos"
              value={profile.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Target Job Position <span className="text-[#474ead] text-xs font-semibold ml-1">Required — drives your match</span>
            </Label>
            <Input
              placeholder="e.g. Executive Assistant, Team Manager, Bookkeeper"
              value={profile.targetPosition}
              onChange={(e) => setField("targetPosition", e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-slate-400">Be specific — this is the most important field for accurate matching.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Job Category / Niche <span className="text-[#474ead] text-xs font-semibold ml-1">Required</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {JOB_CATEGORIES.map((cat) => (
                <OptionChip
                  key={cat} label={cat}
                  selected={profile.jobCategory === cat}
                  onClick={() => setField("jobCategory", cat)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Experience */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Experience & Seniority</h3>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Years of Professional Experience <span className="text-[#474ead] text-xs font-semibold ml-1">Required</span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <SelectCard
                  key={lvl.id} label={lvl.label} desc={lvl.desc}
                  selected={profile.yearsOfExperience === lvl.id}
                  onClick={() => setField("yearsOfExperience", lvl.id)}
                  icon={Clock}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Seniority Level <span className="text-[#474ead] text-xs font-semibold ml-1">Required</span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {SENIORITY_LEVELS.map((s) => (
                <SelectCard
                  key={s.id} label={s.label} desc={s.desc}
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
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Skills</h3>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Core Skills <span className="text-[#474ead] text-xs font-semibold ml-1">Required — select all that apply</span>
            </Label>
            <div className="flex flex-wrap gap-2.5">
              {CORE_SKILLS.map((s) => (
                <OptionChip key={s} label={s} selected={profile.coreSkills.includes(s)} onClick={() => toggleCoreSkill(s)} />
              ))}
            </div>
            {profile.coreSkills.length > 0 && (
              <p className="text-xs text-slate-400">{profile.coreSkills.length} skill{profile.coreSkills.length !== 1 ? "s" : ""} selected</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Secondary Skills <span className="text-slate-400 font-normal">(optional — type and add)</span></Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Canva, HubSpot, G Suite…"
                value={secSkillInput}
                onChange={(e) => setSecSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSecondarySkill(); } }}
                className="rounded-xl flex-1"
              />
              <Button type="button" size="default" variant="outline" onClick={addSecondarySkill} className="rounded-xl shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {profile.secondarySkills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {profile.secondarySkills.map((s) => (
                  <span key={s} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                    {s}
                    <button type="button" onClick={() => removeSecondarySkill(s)} className="text-slate-400 hover:text-slate-600">
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
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Work Preferences</h3>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Preferred Work Setup</Label>
            <div className="flex flex-wrap gap-2.5">
              {SETUP_OPTIONS.map((opt) => (
                <OptionChip key={opt} label={opt} selected={profile.preferredSetup === opt} onClick={() => setField("preferredSetup", opt)} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Preferred Shift</Label>
            <div className="flex flex-wrap gap-2.5">
              {SHIFT_OPTIONS.map((opt) => (
                <OptionChip key={opt} label={opt} selected={profile.preferredShift === opt} onClick={() => setField("preferredShift", opt)} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Preferred Job Type</Label>
            <div className="flex flex-wrap gap-2.5">
              {JOBTYPE_OPTIONS.map((opt) => (
                <OptionChip key={opt} label={opt} selected={profile.preferredJobType === opt} onClick={() => setField("preferredJobType", opt)} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Preferred Work Environment</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {WORK_ENVIRONMENTS.map((e) => (
                <SelectCard
                  key={e.id} label={e.label} desc={e.desc}
                  selected={profile.workEnvironment === e.id}
                  onClick={() => setField("workEnvironment", e.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Optional summary */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Professional Summary <span className="font-normal normal-case text-slate-400">(optional)</span></h3>
          <Textarea
            placeholder="A short paragraph about your background, what you're looking for, and what makes you a great fit…"
            value={profile.summary}
            onChange={(e) => setField("summary", e.target.value)}
            rows={4}
            className="rounded-xl resize-none"
          />
        </div>

        {/* Required fields reminder */}
        {!ready && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium text-amber-700">
              Please complete: Target Job Position, Job Category, Years of Experience, Seniority Level, and at least one Core Skill to continue.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Step 2: Culture Evaluation ─────────────────────────────────────────────
  function CultureEvaluationStep() {
    const answered = Object.keys(profile.valuesAnswers).length;
    return (
      <div>
        <StepLabel step={3} title="Culture Evaluation" />
        <h2 className="mt-1 text-xl font-semibold text-slate-900">How well do you align with our culture?</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          These 6 questions evaluate your alignment with OnSpot's core values — accountability, urgency, integrity, and ownership. There are no wrong answers.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#474ead] transition-all duration-300" style={{ width: `${(answered / CORE_VALUES_QUESTIONS.length) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-400 shrink-0">{answered}/{CORE_VALUES_QUESTIONS.length} answered</span>
        </div>
        <div className="mt-6 space-y-6">
          {CORE_VALUES_QUESTIONS.map((q) => {
            const QIcon = q.icon;
            const selected = profile.valuesAnswers[q.id];
            return (
              <div key={q.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#474ead]/10 text-[#474ead]">
                    <QIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#474ead]">{q.value}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{q.question}</p>
                    <p className="mt-1 text-xs text-slate-500 italic">"{q.context}"</p>
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
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isSel ? "border-[#474ead] bg-[#474ead]" : "border-slate-300"}`}>
                          {isSel && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        <span className={`text-sm ${isSel ? "font-medium text-[#474ead]" : "text-slate-700"}`}>{opt.text}</span>
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
              Please answer all {CORE_VALUES_QUESTIONS.length} questions to continue.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  function ResultsSection() {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <TopProfileCard primaryDomain={primaryDomain} profile={profile} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ValuesAlignmentCard alignment={valuesAlignment} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Relevant Job Openings</p>
            <h3 className="text-xl font-bold text-slate-900">
              {profile.targetPosition ? `Roles matching "${profile.targetPosition}"` : "Active roles that fit your profile"}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Only showing real open positions that are genuinely aligned to your finalized profile and niche.
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
          <NoStrongMatches onBrowse={() => navigate("/find-work/jobs")} onRetake={handleRetake} />
        ) : (
          <div className="space-y-4">
            {jobMatches.map((match, i) => (
              <PostedJobMatchCard
                key={match.job.id}
                match={match}
                rank={i}
                onApply={() => window.open(APPLY_URL, "_blank")}
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
    if (flowStep === 1) return FinalizeInformationStep();
    return CultureEvaluationStep();
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
            <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MatchingAnimation />
            </motion.div>
          ) : phase === "results" ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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

              {/* Nav buttons */}
              <div className="mt-6 flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={flowStep === 0}
                  className="rounded-full px-6"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!ready}
                  className="rounded-full bg-[#474ead] px-8 text-white"
                >
                  {flowStep === TOTAL_FLOW_STEPS - 1 ? (
                    <><Sparkles className="mr-2 h-4 w-4" /> Find My Matches</>
                  ) : (
                    <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
