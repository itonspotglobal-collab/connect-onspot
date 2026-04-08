import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Sparkles, RotateCcw,
  BriefcaseBusiness, Target, TrendingUp, ChevronRight,
  SearchX, Loader2, Inbox, Upload, FileText, X as XIcon,
  Shield, Zap, Heart, Award, Lightbulb, Clock,
  BarChart2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Job } from "@shared/schema";
import { usePostedJobs } from "@/hooks/usePostedJobs";

// ─── CandidateProfile type ────────────────────────────────────────────────────

type Phase = "quiz" | "matching" | "results";

interface CandidateProfile {
  resumeFile: File | null;
  skills: string[];
  experienceLevel: string;
  environment: string;
  shift: string;
  workType: string;
  voiceType: string;
  clientFacing: string;
  workStyle: string;
  taskVariety: string;
  multitasking: string;
  communicationLoad: string;
  valuesAnswers: Record<string, string>;
}

const EMPTY_PROFILE: CandidateProfile = {
  resumeFile: null, skills: [], experienceLevel: "",
  environment: "", shift: "", workType: "", voiceType: "",
  clientFacing: "", workStyle: "", taskVariety: "",
  multitasking: "", communicationLoad: "", valuesAnswers: {},
};

// ─── Quiz constants ───────────────────────────────────────────────────────────

const SKILLS = [
  "Customer Support", "Admin Support", "Data Entry", "Calendar Management",
  "Email Management", "Research", "Social Media", "Content Writing",
  "Bookkeeping", "Project Coordination", "Sales Support", "Technical Support",
  "CRM Management", "Scheduling", "Report Generation",
];

const EXPERIENCE_LEVELS = [
  { id: "0-1", label: "0–1 year",  desc: "New to professional remote work or just starting out" },
  { id: "1-3", label: "1–3 years", desc: "Solid foundation with some hands-on experience" },
  { id: "3-5", label: "3–5 years", desc: "Confident, well-rounded, and independently capable" },
  { id: "5+",  label: "5+ years",  desc: "Senior-level expertise with a strong track record" },
];

const ENVIRONMENTS = [
  { id: "structured",    label: "Structured & predictable",  desc: "Clear processes, consistent routines, predictable days" },
  { id: "flexible",      label: "Flexible & dynamic",        desc: "Adapts fast, no two days are the same" },
  { id: "collaborative", label: "Highly collaborative",      desc: "Always working closely with a team" },
  { id: "independent",   label: "Independent & focused",     desc: "Deep focus, minimal interruptions" },
  { id: "process",       label: "Process-driven",            desc: "Systems, checklists, standards, quality control" },
  { id: "creative",      label: "Creative & evolving",       desc: "Ideas, content, and constant iteration" },
];

const SHIFTS        = ["Day shift", "Night shift", "Flexible hours"];
const WORK_TYPES    = ["Full-time", "Part-time"];
const VOICE_TYPES   = ["Voice (calls)", "Non-voice (written)", "Open to either"];
const CLIENT_TYPES  = ["Client-facing", "Behind the scenes", "Open to either"];
const WORK_STYLES   = ["Detail-oriented precision", "Big-picture thinking"];
const TASK_STYLES   = ["Consistent & repetitive tasks", "Varied & unpredictable work"];
const MULTI_OPTIONS = ["I prefer one thing at a time", "I thrive as a multitasker"];
const ENERGY_OPTIONS = [
  "Execution-heavy — I get things done",
  "Communication-heavy — I thrive on interaction",
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
//  1. Each candidate skill maps to one or more functional domains.
//  2. Each job's domain is inferred from its title keywords FIRST, then category.
//     Title inference prevents mislabeled jobs (e.g. "IT Administrator" in "Admin" category)
//     from appearing as admin/operations matches.
//  3. Domain incompatibility matrix defines hard penalties. If the minimum penalty
//     between any candidate domain and the job domain is >= DOMAIN_HARD_THRESHOLD,
//     the job is rejected before scoring.
//  4. Jobs that pass the domain filter are scored on: skills (35 pts), domain (25 pts),
//     experience (20 pts), work preferences (12 pts), values bonus (5 pts).
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
  | "general";         // fallback

// ── Skill → domain(s) mapping ─────────────────────────────────────────────────
// First entry is the primary domain for dominant-domain calculations.
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
// Used to match candidate skills against job skill tags + description text.
const SKILL_ALIASES: Record<string, string[]> = {
  "Customer Support":    ["customer service", "customer support", "cx", "client support", "help desk", "customer care", "service agent", "support agent", "inbound support"],
  "Admin Support":       ["administrative", "admin assistant", "office management", "admin support", "office admin", "general admin"],
  "Data Entry":          ["data entry", "data processing", "data management", "database entry", "data input", "data encoding"],
  "Calendar Management": ["calendar management", "calendar scheduling", "appointment scheduling", "diary management", "meeting scheduling"],
  "Email Management":    ["email management", "inbox management", "email handling", "correspondence management", "email correspondence"],
  "Research":            ["research", "market research", "data research", "online research", "internet research", "desk research"],
  "Social Media":        ["social media", "instagram", "facebook", "twitter", "linkedin management", "tiktok", "social media management", "social media posting"],
  "Content Writing":     ["content writing", "copywriting", "blog writing", "content creation", "creative writing", "article writing"],
  "Bookkeeping":         ["bookkeeping", "accounting", "quickbooks", "xero", "accounts management", "bookkeeper", "financial records", "accounts receivable", "accounts payable"],
  "Project Coordination":["project management", "project coordination", "project planning", "task management", "project scheduling", "pmo"],
  "Sales Support":       ["sales support", "lead generation", "cold calling", "outbound sales", "bdr", "sdr", "crm sales", "sales outreach"],
  "Technical Support":   ["technical support", "tech support", "it support", "helpdesk", "troubleshooting", "hardware support", "software support"],
  "CRM Management":      ["crm", "salesforce", "hubspot", "zoho crm", "customer relationship", "crm management", "crm tools"],
  "Scheduling":          ["scheduling", "appointment setting", "diary management", "shift scheduling", "rota management"],
  "Report Generation":   ["reporting", "report generation", "data analysis", "analytics", "business reporting", "dashboard reporting", "kpi reporting"],
};

// ── Title keyword → domain inference (overrides category) ────────────────────
// Ordered: most specific / highest false-positive risk first.
const TITLE_DOMAIN_RULES: Array<{ keywords: string[]; domain: Domain }> = [
  // Technical — must come FIRST to override "Admin" category for IT roles
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
  // Finance — before admin to catch "accounts admin" etc.
  {
    keywords: [
      "accountant", "accounting manager", "accounts manager", "financial analyst",
      "bookkeeper", "bookkeeping", "finance manager", "finance officer", "cfo",
      "controller", "payroll", "accounts payable", "accounts receivable",
      "tax specialist", "auditor", "budgeting analyst",
    ],
    domain: "finance",
  },
  // Design
  {
    keywords: [
      "graphic designer", "ux designer", "ui designer", "visual designer",
      "motion designer", "illustrator", "creative director", "brand designer",
      "web designer",
    ],
    domain: "design",
  },
  // HR / Recruitment
  {
    keywords: [
      "recruiter", "talent acquisition", "hr specialist", "hr manager",
      "human resources", "people operations", "hr coordinator", "hr officer",
    ],
    domain: "hr",
  },
  // Sales / Marketing
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
  // Customer Support
  {
    keywords: [
      "customer service", "customer support", "customer success", "cx specialist",
      "support agent", "service representative", "client support",
    ],
    domain: "customer_support",
  },
  // Admin / Operations
  {
    keywords: [
      "virtual assistant", "executive assistant", "administrative assistant",
      "office manager", "project coordinator", "operations coordinator",
      "operations manager", "admin officer", "admin coordinator",
      "data entry specialist", "data encoder",
    ],
    domain: "admin_ops",
  },
];

// ── Category → domain fallback ────────────────────────────────────────────────
const CATEGORY_DOMAIN: Record<string, Domain> = {
  "Admin":            "admin_ops",
  "Operations":       "admin_ops",
  "Customer success": "customer_support",
  "Marketing":        "sales_marketing",
  "Sales":            "sales_marketing",
  "Finance":          "finance",
  "Tech support":     "technical",
  "Development":      "technical",
  "Design":           "design",
};

// ── Domain incompatibility penalty matrix ─────────────────────────────────────
// DOMAIN_PENALTY[candidateDomain][jobDomain] = penalty points applied to score.
// Values >= DOMAIN_HARD_THRESHOLD cause hard rejection before any scoring.
const DOMAIN_HARD_THRESHOLD = 40;

const DOMAIN_PENALTY: Partial<Record<Domain, Partial<Record<Domain, number>>>> = {
  admin_ops: {
    technical:  50, // IT Admin ≠ Admin Support — hardest mismatch
    design:     25,
    hr:          0,
    finance:     5, // some overlap (admin + basic finance)
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
  general: {}, // unknown candidate domain — no penalty applied
};

// ── Experience level tiers ────────────────────────────────────────────────────
const EXP_TO_TIER: Record<string, number> = { "0-1": 0, "1-3": 1, "3-5": 2, "5+": 3 };
const JOB_LEVEL_TIER: Record<string, number> = { entry: 0, intermediate: 2, expert: 3 };
// Candidate tier → acceptable job tiers
const ACCEPTABLE_TIERS: Record<number, number[]> = {
  0: [0],         // 0–1 yr → entry only
  1: [0, 1, 2],   // 1–3 yr → entry or intermediate
  2: [1, 2, 3],   // 3–5 yr → intermediate or expert
  3: [2, 3],      // 5+ yr  → intermediate or expert
};
const JOB_LEVEL_LABEL: Record<string, string> = {
  entry: "Entry-level", intermediate: "Intermediate-level", expert: "Senior-level",
};

// ── Domain archetype display ──────────────────────────────────────────────────
const DOMAIN_ARCHETYPES: Record<Domain, { title: string; archetype: string; description: string }> = {
  admin_ops: {
    title: "Administrative & Operations Professional",
    archetype: "Operations Support",
    description: "Organized, reliable, and highly capable — you excel at keeping teams, calendars, and operations running smoothly across any environment.",
  },
  customer_support: {
    title: "Customer Experience Specialist",
    archetype: "Customer Support",
    description: "Empathetic, communicative, and client-focused — you build trust and resolve issues with care, turning every interaction into a positive experience.",
  },
  sales_marketing: {
    title: "Sales & Marketing Professional",
    archetype: "Sales / Marketing Support",
    description: "Persuasive and brand-aware — you thrive in outreach, content, and growth-focused environments where results are visible and measurable.",
  },
  finance: {
    title: "Finance & Accounting Specialist",
    archetype: "Finance / Admin Support",
    description: "Precise, methodical, and numbers-driven — you bring accuracy and consistency to financial records, reporting, and operational finance tasks.",
  },
  technical: {
    title: "Technical Support Specialist",
    archetype: "Technical Support",
    description: "Problem-solving and technically confident — you diagnose issues, support users, and keep systems running with calm precision.",
  },
  design: {
    title: "Creative & Design Professional",
    archetype: "Creative / Design Support",
    description: "Visually sharp and conceptually strong — you translate briefs into compelling designs that serve both brand and audience.",
  },
  hr: {
    title: "HR & People Operations Specialist",
    archetype: "HR / Recruitment Support",
    description: "People-focused and process-driven — you attract, assess, and support talent with integrity and organizational awareness.",
  },
  general: {
    title: "General Professional",
    archetype: "General Support",
    description: "Well-rounded and adaptable — you bring a mix of skills suited to a variety of remote support roles.",
  },
};

// ─── Domain helper functions ──────────────────────────────────────────────────

function inferJobDomain(job: Job): Domain {
  const titleLower = (job.title ?? "").toLowerCase();
  for (const { keywords, domain } of TITLE_DOMAIN_RULES) {
    if (keywords.some((kw) => titleLower.includes(kw))) return domain;
  }
  return CATEGORY_DOMAIN[job.category] ?? "general";
}

function getCandidateDomains(skills: string[]): Set<Domain> {
  const domains = new Set<Domain>();
  for (const skill of skills) {
    (SKILL_DOMAINS[skill] ?? []).forEach((d) => domains.add(d));
  }
  if (domains.size === 0) domains.add("general");
  return domains;
}

function getPrimaryDomain(skills: string[]): Domain {
  const counts: Partial<Record<Domain, number>> = {};
  for (const skill of skills) {
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

// ── Skill overlap detection ────────────────────────────────────────────────────
// Builds a searchable text blob from the job, then checks each candidate skill
// (and its aliases) against it for a precise but comprehensive match.
function computeSkillOverlap(
  candidateSkills: string[],
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

  const matched: string[] = [];
  for (const skill of candidateSkills) {
    const aliases = [skill.toLowerCase(), ...(SKILL_ALIASES[skill] ?? [])];
    if (aliases.some((alias) => jobText.includes(alias))) {
      matched.push(skill);
    }
  }

  const total = Math.max(candidateSkills.length, 1);
  // Score: 0–35. Partially weighted: first two matches get boosted value.
  const raw = matched.length === 0 ? 0
    : matched.length === 1 ? 15
    : matched.length === 2 ? 24
    : Math.min(35, Math.round((matched.length / total) * 35) + 6);

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
//
// Returns a score 0–100 and a list of human-readable match reasons.
// Jobs scoring < MATCH_THRESHOLD are excluded from results entirely.
//
const MATCH_THRESHOLD = 35;

export interface PostedJobMatch {
  job: Job;
  score: number;
  reasons: string[];
}

function scoreJobMatch(job: Job, candidate: CandidateProfile): PostedJobMatch {
  let score = 0;
  const reasons: string[] = [];

  // ── 1. Domain filter ──────────────────────────────────────────────────────
  const candidateDomains = getCandidateDomains(candidate.skills);
  const jobDomain = inferJobDomain(job);
  const penalty = computeDomainPenalty(candidateDomains, jobDomain);

  if (penalty >= DOMAIN_HARD_THRESHOLD) {
    // Hard incompatibility — reject immediately
    return { job, score: 0, reasons: [] };
  }

  // ── 2. Domain score (0–25 pts, minus partial penalty) ────────────────────
  const exactDomainMatch = candidateDomains.has(jobDomain);
  if (exactDomainMatch) {
    score += 25;
  } else if (penalty === 0) {
    score += 10; // compatible adjacent domain
  } else {
    score += Math.max(0, 10 - Math.round(penalty * 0.4));
  }
  score -= Math.round(penalty * 0.3); // apply partial domain penalty to score

  // ── 3. Skill overlap (0–35 pts, -15 if no overlap and not exact domain) ───
  const { matched, score: skillScore } = computeSkillOverlap(candidate.skills, job);
  score += skillScore;
  if (matched.length > 0) {
    reasons.push(`Matched skills: ${matched.slice(0, 3).join(", ")}`);
  } else if (!exactDomainMatch) {
    // No skill overlap AND not even the same domain → heavy penalty
    score -= 20;
  }

  // ── 4. Experience level (0–20 pts, -10 on mismatch) ─────────────────────
  if (candidate.experienceLevel && job.experienceLevel) {
    const cTier = EXP_TO_TIER[candidate.experienceLevel] ?? 1;
    const jTier = JOB_LEVEL_TIER[job.experienceLevel] ?? 1;
    const acceptable = ACCEPTABLE_TIERS[cTier] ?? [0, 1, 2];

    if (acceptable.includes(jTier)) {
      score += 20;
      reasons.push(`Experience fit: ${JOB_LEVEL_LABEL[job.experienceLevel] ?? job.experienceLevel} role`);
    } else {
      const diff = Math.abs(cTier - jTier);
      if (diff === 1) score += 8;
      else score -= 10;
    }
  }

  // ── 5. Work preference alignment (0–12 pts) ──────────────────────────────
  const descText = [job.description ?? "", ...(job.requirements ?? [])].join(" ").toLowerCase();
  const isVoiceRole = /\b(voice|phone call|calling|inbound call|outbound call|live call)\b/.test(descText);
  let prefScore = 0;
  const prefReasons: string[] = [];

  // Voice / non-voice
  if (candidate.voiceType === "Voice (calls)") {
    if (isVoiceRole) { prefScore += 4; prefReasons.push("Voice role"); }
    else prefScore -= 4;
  } else if (candidate.voiceType === "Non-voice (written)") {
    if (!isVoiceRole) { prefScore += 4; prefReasons.push("Non-voice role"); }
    else prefScore -= 4;
  } else {
    prefScore += 2; // "Open to either" — neutral credit
  }

  // Work type (full-time vs part-time signal from contractType)
  const isFixedFull = job.contractType === "fixed";
  if (candidate.workType === "Full-time" && isFixedFull) prefScore += 4;
  else if (candidate.workType === "Part-time" && !isFixedFull) prefScore += 4;
  else prefScore += 1; // partial credit

  // Location / setup
  const locationLower = (job.location ?? "").toLowerCase();
  const isRemote = locationLower.includes("remote") || locationLower === "" || !locationLower;
  if (isRemote) { prefScore += 2; prefReasons.push("Remote setup"); }

  score += Math.max(0, prefScore);
  if (prefReasons.length > 0 && prefScore > 0) {
    reasons.push(`Preference fit: ${prefReasons.join(", ")}`);
  }

  // ── 6. Values bonus (0–5 pts — supportive, never primary driver) ─────────
  const valuesRaw = computeValuesScore(candidate.valuesAnswers);
  score += Math.round((valuesRaw / VALUES_MAX_SCORE) * 5);

  // ── Clamp and return ──────────────────────────────────────────────────────
  score = Math.round(Math.max(0, Math.min(100, score)));
  return { job, score, reasons };
}

// ─── Full match computation ───────────────────────────────────────────────────

function computeAllMatches(candidate: CandidateProfile, openJobs: Job[]): PostedJobMatch[] {
  if (openJobs.length === 0) return [];

  const results = openJobs
    .map((job) => scoreJobMatch(job, candidate))
    .filter((m) => m.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return results;
}

// ─── Values alignment output ──────────────────────────────────────────────────

interface ValuesAlignment {
  score: number;
  traits: string[];
  summary: string;
}

function computeValuesAlignment(valuesAnswers: Record<string, string>): ValuesAlignment {
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
    summary = "Your responses reflect strong alignment with how we work at OnSpot. You demonstrate ownership, a people-first mindset, and a bias toward action — exactly what our best team members embody.";
  else if (score >= 60)
    summary = "You show solid alignment with several of our core values. You bring a growth-oriented approach and collaborative instincts that we value across all roles.";
  else if (score >= 40)
    summary = "Some of your instincts align with our culture. Every team member grows into our values — what matters most is the willingness to be accountable and keep improving.";
  else
    summary = "Our culture may be a meaningful shift for you. We value transparency, urgency, and ownership highly — and we invest in helping our team develop these traits over time.";

  return { score, traits, summary };
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const QUIZ_STEPS = [
  { label: "Welcome",     icon: Sparkles },
  { label: "Skills",      icon: BriefcaseBusiness },
  { label: "Preferences", icon: BarChart2 },
  { label: "Values Fit",  icon: Heart },
];
const TOTAL_STEPS = QUIZ_STEPS.length;

function canProceed(step: number, p: CandidateProfile): boolean {
  switch (step) {
    case 0: return true;
    case 1: return p.skills.length > 0 && !!p.experienceLevel;
    case 2:
      return (
        !!p.environment && !!p.shift && !!p.workType && !!p.voiceType &&
        !!p.clientFacing && !!p.workStyle && !!p.taskVariety &&
        !!p.multitasking && !!p.communicationLoad
      );
    case 3: return Object.keys(p.valuesAnswers).length === CORE_VALUES_QUESTIONS.length;
    default: return true;
  }
}

// ─── Small UI components ──────────────────────────────────────────────────────

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
}: { label: string; desc: string; selected: boolean; onClick: () => void; icon?: React.ElementType }) {
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
        <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
      </div>
      {selected && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#474ead]" />}
    </button>
  );
}

function RadioGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <OptionChip key={opt} label={opt} selected={value === opt} onClick={() => onChange(opt)} />
      ))}
    </div>
  );
}

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step {step} — {title}</p>
    </div>
  );
}

function JourneyProgress({ quizStep, total }: { quizStep: number; total: number }) {
  const pct = ((quizStep + 1) / total) * 100;
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          Step {quizStep + 1} of {total} —{" "}
          <span className="font-semibold text-slate-700">{QUIZ_STEPS[quizStep].label}</span>
        </span>
        <span>{Math.round(pct)}% complete</span>
      </div>
      <Progress value={pct} className="h-1.5 bg-slate-200" />
      <div className="mt-3 flex gap-2">
        {QUIZ_STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                i < quizStep
                  ? "bg-[#474ead] text-white"
                  : i === quizStep
                  ? "border-2 border-[#474ead] text-[#474ead]"
                  : "border border-slate-200 text-slate-400"
              }`}
            >
              {i < quizStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Matching animation ───────────────────────────────────────────────────────

const MATCHING_MESSAGES = [
  "Analyzing your skills and experience…",
  "Inferring role domain and function…",
  "Applying compatibility filters…",
  "Scoring active posted jobs…",
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

// ─── Result cards ─────────────────────────────────────────────────────────────

function TopProfileCard({
  primaryDomain, skills,
}: { primaryDomain: Domain; skills: string[] }) {
  const archetype = DOMAIN_ARCHETYPES[primaryDomain] ?? DOMAIN_ARCHETYPES.general;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#474ead]/20 bg-gradient-to-br from-[#474ead]/6 via-white to-[#8e93ff]/5">
      <div className="px-6 py-5 border-b border-[#474ead]/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#474ead] mb-1">Your Strongest Profile Match</p>
        <h3 className="text-xl font-bold text-slate-900">{archetype.title}</h3>
        <p className="text-sm text-[#474ead] font-medium mt-0.5">{archetype.archetype} archetype</p>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{archetype.description}</p>
      </div>
      {skills.length > 0 && (
        <div className="px-6 py-4">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Your selected skills</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
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
  const colorClass =
    alignment.score >= 80 ? "text-emerald-600"
    : alignment.score >= 60 ? "text-[#474ead]"
    : "text-amber-600";
  const bgClass =
    alignment.score >= 80 ? "bg-emerald-50 border-emerald-100"
    : alignment.score >= 60 ? "bg-[#474ead]/5 border-[#474ead]/15"
    : "bg-amber-50 border-amber-100";

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

function PostedJobMatchCard({
  match, rank, onApply,
}: { match: PostedJobMatch; rank: number; onApply: () => void }) {
  const { job, score, reasons } = match;
  const tags = (job.skillTags ?? []).slice(0, 5);

  const scoreColor =
    score >= 75 ? "text-emerald-600"
    : score >= 55 ? "text-[#474ead]"
    : "text-slate-500";
  const scoreBg =
    score >= 75 ? "bg-emerald-50"
    : score >= 55 ? "bg-[#474ead]/8"
    : "bg-slate-100";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.07 }}>
      <Card className="overflow-hidden border-slate-200/80">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div className="flex-1">
              {rank === 0 && (
                <Badge className="mb-2 rounded-full bg-[#474ead] text-[11px] text-white hover:bg-[#474ead]">
                  Top Match
                </Badge>
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
                  <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 px-5 py-4">
            <Button onClick={onApply} className="rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]" size="sm">
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
          <Button onClick={onBrowse} className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]">
            Browse All Roles
          </Button>
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
          Based on your skills, experience, and preferences, we do not currently have an active posted role that closely matches your profile. You can browse all open positions or check back soon.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onBrowse} className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]">
            Browse All Roles
          </Button>
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
  const [phase, setPhase] = useState<Phase>("quiz");
  const [quizStep, setQuizStep] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile>(EMPTY_PROFILE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { openJobs, isLoading: jobsLoading } = usePostedJobs();

  const primaryDomain   = useMemo(() => getPrimaryDomain(profile.skills), [profile.skills]);
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

  function setField<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }
  function toggleSkill(skill: string) {
    const cur = profile.skills;
    setField("skills", cur.includes(skill) ? cur.filter((s) => s !== skill) : [...cur, skill]);
  }
  function setValuesAnswer(qId: string, optId: string) {
    setField("valuesAnswers", { ...profile.valuesAnswers, [qId]: optId });
  }
  function handleNext() {
    if (quizStep < TOTAL_STEPS - 1) {
      setQuizStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setPhase("matching");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function handleBack() {
    if (quizStep > 0) { setQuizStep((s) => s - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }
  function handleRetake() {
    setProfile(EMPTY_PROFILE);
    setQuizStep(0);
    setPhase("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const ready = canProceed(quizStep, profile);

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
            <Button onClick={() => navigate("/find-work/jobs")} className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c]">Browse All Roles</Button>
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
          A guided 4-step journey. We evaluate your skills, preferences, and values — then surface only active roles that genuinely match you.
        </p>
        <JourneyProgress quizStep={quizStep} total={TOTAL_STEPS} />
      </motion.div>
    );
  }

  // ── Step 0: Welcome + Resume Upload ──────────────────────────────────────
  function Step0() {
    return (
      <div>
        <StepLabel step={1} title="Welcome" />
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Let's start with your background.</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Upload your resume to give us a head start, or continue manually. Either way, we'll guide you through the full assessment.
        </p>
        <div className="mt-6 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => setField("resumeFile", e.target.files?.[0] ?? null)}
          />
          {profile.resumeFile ? (
            <div className="flex items-center gap-4 rounded-2xl border border-[#474ead]/25 bg-[#474ead]/5 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#474ead] text-white">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{profile.resumeFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Resume received. You'll refine your preferences in the steps ahead.</p>
              </div>
              <button
                onClick={() => { setField("resumeFile", null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
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
                { icon: BriefcaseBusiness, text: "Tell us your strongest skills and experience level" },
                { icon: BarChart2,         text: "Share your work preferences and ideal environment" },
                { icon: Heart,             text: "Answer 6 values-fit questions aligned to our culture" },
                { icon: Sparkles,          text: "Get matched to real active posted roles — no filler" },
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

  // ── Step 1: Skills + Experience ───────────────────────────────────────────
  function Step1() {
    return (
      <div className="space-y-8">
        <div>
          <StepLabel step={2} title="Skills" />
          <h2 className="mt-1 text-xl font-semibold text-slate-900">What are your strongest skills?</h2>
          <p className="mt-1.5 text-sm text-slate-500">Select all that apply. Choose the ones you're genuinely confident in — this is the primary input for your match.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {SKILLS.map((s) => (
              <OptionChip key={s} label={s} selected={profile.skills.includes(s)} onClick={() => toggleSkill(s)} />
            ))}
          </div>
          {profile.skills.length > 0 && (
            <p className="mt-4 text-xs text-slate-400">{profile.skills.length} skill{profile.skills.length > 1 ? "s" : ""} selected</p>
          )}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">How much professional experience do you have?</h2>
          <p className="mt-1.5 text-sm text-slate-500">In remote or professional work settings. This determines which seniority levels we match you to.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EXPERIENCE_LEVELS.map((lvl) => (
              <SelectCard
                key={lvl.id} label={lvl.label} desc={lvl.desc}
                selected={profile.experienceLevel === lvl.id}
                onClick={() => setField("experienceLevel", lvl.id)}
                icon={Clock}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Work Preferences ──────────────────────────────────────────────
  function Step2() {
    return (
      <div className="space-y-8">
        <div>
          <StepLabel step={3} title="Preferences" />
          <h2 className="mt-1 text-xl font-semibold text-slate-900">What kind of work environment suits you best?</h2>
          <p className="mt-1.5 text-sm text-slate-500">Choose the one that resonates most.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ENVIRONMENTS.map((e) => (
              <SelectCard key={e.id} label={e.label} desc={e.desc}
                selected={profile.environment === e.id} onClick={() => setField("environment", e.id)} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Preferred shift</h2>
          <div className="mt-3"><RadioGroup options={SHIFTS} value={profile.shift} onChange={(v) => setField("shift", v)} /></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Work type</h2>
          <div className="mt-3"><RadioGroup options={WORK_TYPES} value={profile.workType} onChange={(v) => setField("workType", v)} /></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Voice or non-voice?</h2>
          <p className="mt-1 text-sm text-slate-500">Do you prefer calls or written communication?</p>
          <div className="mt-3"><RadioGroup options={VOICE_TYPES} value={profile.voiceType} onChange={(v) => setField("voiceType", v)} /></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Client-facing or behind the scenes?</h2>
          <div className="mt-3"><RadioGroup options={CLIENT_TYPES} value={profile.clientFacing} onChange={(v) => setField("clientFacing", v)} /></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">How do you approach work?</h2>
          <div className="mt-3"><RadioGroup options={WORK_STYLES} value={profile.workStyle} onChange={(v) => setField("workStyle", v)} /></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Task variety preference</h2>
          <div className="mt-3"><RadioGroup options={TASK_STYLES} value={profile.taskVariety} onChange={(v) => setField("taskVariety", v)} /></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Multitasking comfort</h2>
          <div className="mt-3"><RadioGroup options={MULTI_OPTIONS} value={profile.multitasking} onChange={(v) => setField("multitasking", v)} /></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">How do you prefer to spend your energy?</h2>
          <div className="mt-3"><RadioGroup options={ENERGY_OPTIONS} value={profile.communicationLoad} onChange={(v) => setField("communicationLoad", v)} /></div>
        </div>
      </div>
    );
  }

  // ── Step 3: Core Values Assessment ───────────────────────────────────────
  function Step3() {
    const answered = Object.keys(profile.valuesAnswers).length;
    return (
      <div>
        <StepLabel step={4} title="Values Fit" />
        <h2 className="mt-1 text-xl font-semibold text-slate-900">A short values assessment.</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          These 6 questions help us understand how you think and work — and how well you'd align with the OnSpot culture. There are no wrong answers.
        </p>
        <div className="mt-2 flex items-center gap-2">
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
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  function ResultsSection() {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <TopProfileCard primaryDomain={primaryDomain} skills={profile.skills} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ValuesAlignmentCard alignment={valuesAlignment} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-[#474ead]" />
            <p className="text-sm font-semibold text-slate-700">Active posted roles that match your profile</p>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Only roles scoring above our confidence threshold are shown. We'd rather show you fewer, more accurate results.
          </p>
        </motion.div>

        {jobsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-[#474ead]" />
          </div>
        ) : openJobs.length === 0 ? (
          <NoOpenRoles onBrowse={() => navigate("/find-work/jobs")} />
        ) : jobMatches.length === 0 ? (
          <NoStrongMatches
            onBrowse={() => navigate("/find-work/jobs")}
            onRetake={handleRetake}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Target className="h-4 w-4" />
              {jobMatches.length} active {jobMatches.length === 1 ? "role" : "roles"} above confidence threshold
            </div>
            {jobMatches.map((match, i) => (
              <PostedJobMatchCard
                key={match.job.id}
                match={match}
                rank={i}
                onApply={() => window.open(APPLY_URL, "_blank", "noopener,noreferrer")}
              />
            ))}
            <div className="mt-6 rounded-2xl border border-[#474ead]/10 bg-[#474ead]/[0.03] px-8 py-8 text-center">
              <TrendingUp className="mx-auto mb-3 h-8 w-8 text-[#474ead]" />
              <h2 className="text-xl font-semibold text-slate-900">Ready to take the next step?</h2>
              <p className="mt-2 text-sm text-slate-500">Browse all open positions and apply directly. We hire fast — most roles fill within 3–10 days.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button onClick={() => navigate("/find-work/jobs")} className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]">Browse All Roles</Button>
                <Button variant="outline" onClick={handleRetake} className="rounded-full px-8">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retake Assessment
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.10),transparent_30%),linear-gradient(to_bottom,#f8fafc,white)] text-slate-900">
      <section className="relative overflow-hidden border-b border-slate-200/70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(71,78,173,0.12),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.08),transparent_24%)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-10 md:px-8 md:pb-14 md:pt-12">
          <button
            onClick={() => navigate("/find-work")}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-[#474ead]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Find Work
          </button>
          <HeroContent />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-10 md:px-8 md:py-14">
        {phase === "matching" && <MatchingAnimation />}
        {phase === "results"  && <ResultsSection />}
        {phase === "quiz" && (
          <AnimatePresence mode="wait">
            <motion.div
              key={quizStep}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
            >
              <Card className="border-slate-200/80">
                <CardContent className="p-6 md:p-8">
                  {quizStep === 0 && <Step0 />}
                  {quizStep === 1 && <Step1 />}
                  {quizStep === 2 && <Step2 />}
                  {quizStep === 3 && <Step3 />}
                </CardContent>
              </Card>

              <div className="mt-6 flex items-center justify-between gap-4">
                <Button
                  variant="outline" onClick={handleBack}
                  disabled={quizStep === 0} className="rounded-full px-6"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleNext} disabled={!ready}
                  className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c] disabled:opacity-40"
                >
                  {quizStep === TOTAL_STEPS - 1 ? (
                    <><Sparkles className="mr-2 h-4 w-4" /> Find My Matches</>
                  ) : quizStep === 0 ? (
                    <>Begin <ArrowRight className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>Next <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
