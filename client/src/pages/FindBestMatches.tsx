import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Sparkles, RotateCcw,
  BriefcaseBusiness, Target, TrendingUp, ChevronRight,
  SearchX, Loader2, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Job } from "@shared/schema";
import { usePostedJobs } from "@/hooks/usePostedJobs";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface QuizAnswers {
  skills: string[];
  values: string[];
  environment: string;
  shift: string;
  workType: string;
  voiceType: string;
  clientFacing: string;
  workStyle: string;
  taskVariety: string;
  multitasking: string;
  communicationLoad: string;
}

const EMPTY_ANSWERS: QuizAnswers = {
  skills: [],
  values: [],
  environment: "",
  shift: "",
  workType: "",
  voiceType: "",
  clientFacing: "",
  workStyle: "",
  taskVariety: "",
  multitasking: "",
  communicationLoad: "",
};

// ─── Quiz data ─────────────────────────────────────────────────────────────────

const SKILLS = [
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
];

const VALUES = [
  "High earnings",
  "Work-life balance",
  "Growth opportunities",
  "Stable schedule",
  "Independent work",
  "Collaborative team",
  "Meaningful work",
  "Fast-paced environment",
];

const ENVIRONMENTS = [
  { id: "structured",    label: "Structured & predictable",   desc: "Clear processes, consistent routines" },
  { id: "flexible",      label: "Flexible & dynamic",         desc: "Adapts fast, no two days are the same" },
  { id: "collaborative", label: "Highly collaborative",       desc: "Always working with others" },
  { id: "independent",   label: "Independent & quiet",        desc: "Deep focus, minimal interruptions" },
  { id: "process",       label: "Process-driven",             desc: "Systems, checklists, standards" },
  { id: "creative",      label: "Creative & evolving",        desc: "Ideas, content, and constant change" },
];

const SHIFTS       = ["Day shift", "Night shift", "Flexible hours"];
const WORK_TYPES   = ["Full-time", "Part-time"];
const VOICE_TYPES  = ["Voice", "Non-voice", "Either"];
const CLIENT_FACING = ["Client-facing", "Behind-the-scenes", "Either"];

const WORK_STYLE_OPTIONS  = ["Detail-oriented", "Big-picture thinking"];
const TASK_VARIETY_OPTIONS = ["Repetitive & consistent", "Varied & unpredictable"];
const MULTITASK_OPTIONS    = ["I prefer one task at a time", "I'm a multitasker"];
const COMM_LOAD_OPTIONS    = ["Execution-heavy — I just get things done", "Communication-heavy — I thrive on interaction"];

// ─── Role definitions (internal profiles for quiz scoring only) ────────────────

interface RoleProfile {
  title: string;
  categories: string[];   // maps to DB job.category values
  skills: string[];
  values: string[];
  environments: string[];
  shifts: string[];
  voiceTypes: string[];
  clientFacing: string[];
  workStyles: string[];
  taskVariety: string[];
  multitasking: string[];
  commLoad: string[];
}

const ROLE_PROFILES: RoleProfile[] = [
  {
    title: "Virtual Assistant",
    categories: ["Admin", "Operations"],
    skills: ["Admin Support", "Calendar Management", "Email Management", "Research"],
    values: ["Work-life balance", "Independent work", "Stable schedule"],
    environments: ["structured", "process", "independent"],
    shifts: ["Day shift", "Night shift", "Flexible hours"],
    voiceTypes: ["Non-voice", "Either"],
    clientFacing: ["Behind-the-scenes", "Either"],
    workStyles: ["Detail-oriented"],
    taskVariety: ["Varied & unpredictable"],
    multitasking: ["I'm a multitasker"],
    commLoad: ["Execution-heavy — I just get things done"],
  },
  {
    title: "Executive Assistant",
    categories: ["Admin"],
    skills: ["Admin Support", "Calendar Management", "Email Management", "Research", "Project Coordination"],
    values: ["Growth opportunities", "Fast-paced environment", "Meaningful work"],
    environments: ["structured", "flexible", "process"],
    shifts: ["Night shift"],
    voiceTypes: ["Either"],
    clientFacing: ["Client-facing", "Either"],
    workStyles: ["Detail-oriented", "Big-picture thinking"],
    taskVariety: ["Varied & unpredictable"],
    multitasking: ["I'm a multitasker"],
    commLoad: ["Communication-heavy — I thrive on interaction"],
  },
  {
    title: "Customer Support Representative",
    categories: ["Customer success"],
    skills: ["Customer Support", "Email Management", "Technical Support"],
    values: ["Collaborative team", "Meaningful work", "Stable schedule"],
    environments: ["structured", "collaborative", "process"],
    shifts: ["Night shift", "Day shift"],
    voiceTypes: ["Voice", "Either"],
    clientFacing: ["Client-facing"],
    workStyles: ["Detail-oriented"],
    taskVariety: ["Repetitive & consistent"],
    multitasking: ["I prefer one task at a time", "I'm a multitasker"],
    commLoad: ["Communication-heavy — I thrive on interaction"],
  },
  {
    title: "Data Entry Specialist",
    categories: ["Admin", "Operations"],
    skills: ["Data Entry", "Admin Support", "Research"],
    values: ["Stable schedule", "Independent work", "Work-life balance"],
    environments: ["structured", "independent", "process"],
    shifts: ["Day shift", "Flexible hours"],
    voiceTypes: ["Non-voice"],
    clientFacing: ["Behind-the-scenes"],
    workStyles: ["Detail-oriented"],
    taskVariety: ["Repetitive & consistent"],
    multitasking: ["I prefer one task at a time"],
    commLoad: ["Execution-heavy — I just get things done"],
  },
  {
    title: "Social Media Assistant",
    categories: ["Marketing"],
    skills: ["Social Media", "Content Writing", "Research"],
    values: ["Creative", "Growth opportunities", "Meaningful work"],
    environments: ["creative", "flexible", "collaborative"],
    shifts: ["Flexible hours", "Day shift"],
    voiceTypes: ["Non-voice", "Either"],
    clientFacing: ["Either", "Client-facing"],
    workStyles: ["Big-picture thinking"],
    taskVariety: ["Varied & unpredictable"],
    multitasking: ["I'm a multitasker"],
    commLoad: ["Communication-heavy — I thrive on interaction"],
  },
  {
    title: "Content Writer",
    categories: ["Marketing"],
    skills: ["Content Writing", "Research", "Social Media"],
    values: ["Meaningful work", "Independent work", "Creative"],
    environments: ["creative", "independent", "flexible"],
    shifts: ["Flexible hours"],
    voiceTypes: ["Non-voice"],
    clientFacing: ["Behind-the-scenes", "Either"],
    workStyles: ["Big-picture thinking"],
    taskVariety: ["Varied & unpredictable"],
    multitasking: ["I prefer one task at a time"],
    commLoad: ["Execution-heavy — I just get things done"],
  },
  {
    title: "Bookkeeping Assistant",
    categories: ["Finance"],
    skills: ["Bookkeeping", "Data Entry", "Admin Support"],
    values: ["Stable schedule", "Independent work", "Work-life balance"],
    environments: ["structured", "process", "independent"],
    shifts: ["Day shift"],
    voiceTypes: ["Non-voice"],
    clientFacing: ["Behind-the-scenes"],
    workStyles: ["Detail-oriented"],
    taskVariety: ["Repetitive & consistent"],
    multitasking: ["I prefer one task at a time"],
    commLoad: ["Execution-heavy — I just get things done"],
  },
  {
    title: "Project Coordinator",
    categories: ["Operations", "Admin"],
    skills: ["Project Coordination", "Admin Support", "Email Management", "Research"],
    values: ["Growth opportunities", "Collaborative team", "Fast-paced environment"],
    environments: ["structured", "collaborative", "flexible"],
    shifts: ["Day shift", "Night shift"],
    voiceTypes: ["Either"],
    clientFacing: ["Client-facing", "Either"],
    workStyles: ["Big-picture thinking", "Detail-oriented"],
    taskVariety: ["Varied & unpredictable"],
    multitasking: ["I'm a multitasker"],
    commLoad: ["Communication-heavy — I thrive on interaction"],
  },
  {
    title: "Sales Support Assistant",
    categories: ["Sales"],
    skills: ["Sales Support", "Email Management", "Customer Support", "Research"],
    values: ["High earnings", "Fast-paced environment", "Growth opportunities"],
    environments: ["flexible", "collaborative", "structured"],
    shifts: ["Night shift", "Day shift"],
    voiceTypes: ["Voice", "Either"],
    clientFacing: ["Client-facing"],
    workStyles: ["Big-picture thinking"],
    taskVariety: ["Varied & unpredictable"],
    multitasking: ["I'm a multitasker"],
    commLoad: ["Communication-heavy — I thrive on interaction"],
  },
  {
    title: "Research Assistant",
    categories: ["Admin", "Operations", "Marketing"],
    skills: ["Research", "Data Entry", "Content Writing"],
    values: ["Independent work", "Meaningful work", "Work-life balance"],
    environments: ["independent", "process", "structured"],
    shifts: ["Flexible hours", "Day shift"],
    voiceTypes: ["Non-voice"],
    clientFacing: ["Behind-the-scenes"],
    workStyles: ["Detail-oriented", "Big-picture thinking"],
    taskVariety: ["Repetitive & consistent", "Varied & unpredictable"],
    multitasking: ["I prefer one task at a time"],
    commLoad: ["Execution-heavy — I just get things done"],
  },
  {
    title: "Operations Assistant",
    categories: ["Operations", "Admin"],
    skills: ["Admin Support", "Project Coordination", "Data Entry", "Research"],
    values: ["Stable schedule", "Growth opportunities", "Collaborative team"],
    environments: ["process", "structured", "collaborative"],
    shifts: ["Day shift", "Flexible hours"],
    voiceTypes: ["Non-voice", "Either"],
    clientFacing: ["Behind-the-scenes", "Either"],
    workStyles: ["Detail-oriented"],
    taskVariety: ["Varied & unpredictable"],
    multitasking: ["I'm a multitasker"],
    commLoad: ["Execution-heavy — I just get things done"],
  },
  {
    title: "Technical Support Assistant",
    categories: ["Tech support", "Development"],
    skills: ["Technical Support", "Customer Support", "Data Entry"],
    values: ["Stable schedule", "Growth opportunities", "Meaningful work"],
    environments: ["structured", "process", "collaborative"],
    shifts: ["Night shift", "Day shift"],
    voiceTypes: ["Voice", "Non-voice", "Either"],
    clientFacing: ["Client-facing", "Either"],
    workStyles: ["Detail-oriented"],
    taskVariety: ["Repetitive & consistent", "Varied & unpredictable"],
    multitasking: ["I prefer one task at a time", "I'm a multitasker"],
    commLoad: ["Communication-heavy — I thrive on interaction", "Execution-heavy — I just get things done"],
  },
];

// ─── Matching engine ─────────────────────────────────────────────────────────────

interface ProfileScore {
  profile: RoleProfile;
  score: number;
  reasons: string[];
}

function scoreProfiles(answers: QuizAnswers): ProfileScore[] {
  return ROLE_PROFILES.map((role) => {
    let hits = 0;
    let total = 0;
    const reasons: string[] = [];

    const skillMatches = answers.skills.filter((s) => role.skills.includes(s));
    hits += skillMatches.length * 3;
    total += Math.max(answers.skills.length, role.skills.length) * 3;
    if (skillMatches.length > 0)
      reasons.push(`Matched skills: ${skillMatches.slice(0, 3).join(", ")}`);

    const valueMatches = answers.values.filter((v) => role.values.includes(v));
    hits += valueMatches.length * 2;
    total += Math.max(answers.values.length, role.values.length) * 2;
    if (valueMatches.length > 0)
      reasons.push(`Aligned values: ${valueMatches.slice(0, 2).join(", ")}`);

    if (answers.environment) {
      total += 2;
      if (role.environments.includes(answers.environment)) {
        hits += 2;
        const envLabel = ENVIRONMENTS.find((e) => e.id === answers.environment)?.label ?? answers.environment;
        reasons.push(`Environment fit: ${envLabel}`);
      }
    }

    if (answers.shift) {
      total += 1;
      if (role.shifts.includes(answers.shift)) {
        hits += 1;
        reasons.push(`Schedule: ${answers.shift}`);
      }
    }

    if (answers.voiceType && answers.voiceType !== "Either") {
      total += 1;
      if (role.voiceTypes.includes(answers.voiceType) || role.voiceTypes.includes("Either")) hits += 1;
    }

    if (answers.clientFacing && answers.clientFacing !== "Either") {
      total += 1;
      if (role.clientFacing.includes(answers.clientFacing) || role.clientFacing.includes("Either")) hits += 1;
    }

    if (answers.workStyle) {
      total += 1;
      if (role.workStyles.includes(answers.workStyle)) hits += 1;
    }

    if (answers.taskVariety) {
      total += 1;
      if (role.taskVariety.includes(answers.taskVariety)) hits += 1;
    }

    if (answers.multitasking) {
      total += 1;
      if (role.multitasking.includes(answers.multitasking)) hits += 1;
    }

    if (answers.communicationLoad) {
      total += 1;
      if (role.commLoad.includes(answers.communicationLoad)) hits += 1;
    }

    const score = total > 0 ? Math.round((hits / total) * 100) : 0;
    return { profile: role, score, reasons };
  }).sort((a, b) => b.score - a.score);
}

// Returns true if a posted job is a good fit for a role profile.
// Matches on: title keywords, DB category, or skill tags.
function jobFitsProfile(job: Job, profile: RoleProfile): boolean {
  // Category match (strongest signal)
  if (profile.categories.includes(job.category ?? "")) return true;

  // Title keyword match — ignore generic words, look for role keywords
  const stopWords = new Set(["assistant", "specialist", "representative", "associate", "lead", "senior", "junior", "and", "the"]);
  const profileKeywords = profile.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
  const jobTitleLower = (job.title ?? "").toLowerCase();
  if (profileKeywords.some((kw) => jobTitleLower.includes(kw))) return true;

  // Skill tag match — any skill tag from the job overlaps with profile skills
  const jobTagsLower = (job.skillTags ?? []).map((t) => t.toLowerCase());
  const profileSkillsLower = profile.skills.map((s) => s.toLowerCase());
  if (jobTagsLower.some((jt) => profileSkillsLower.some((ps) => jt.includes(ps.split(" ")[0]) || ps.includes(jt.split(" ")[0])))) return true;

  return false;
}

// ─── Posted-job match result ───────────────────────────────────────────────────

export interface PostedJobMatch {
  job: Job;
  score: number;
  reasons: string[];
}

function computePostedMatches(answers: QuizAnswers, openJobs: Job[]): PostedJobMatch[] {
  if (openJobs.length === 0) return [];

  const profileScores = scoreProfiles(answers);
  const usedIds = new Set<string>();
  const results: PostedJobMatch[] = [];

  // Iterate profiles highest-score-first. For each profile, collect matching posted jobs.
  for (const { profile, score, reasons } of profileScores) {
    for (const job of openJobs) {
      if (usedIds.has(job.id)) continue;
      if (jobFitsProfile(job, profile)) {
        usedIds.add(job.id);
        results.push({ job, score, reasons });
      }
    }
    if (results.length >= 6) break;
  }

  return results.sort((a, b) => b.score - a.score);
}

// ─── Small reusable UI components ─────────────────────────────────────────────

function OptionChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        selected
          ? "border-[#474ead] bg-[#474ead] text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#474ead]/40 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-[#474ead]/40"
      }`}
    >
      {selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </button>
  );
}

function EnvCard({ id, label, desc, selected, onClick }: { id: string; label: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-1 rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-[#474ead] bg-[#474ead]/5 ring-1 ring-[#474ead]/30"
          : "border-slate-200 bg-white hover:border-[#474ead]/30 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-[#474ead]/30"
      }`}
    >
      <span className={`text-sm font-semibold ${selected ? "text-[#474ead]" : "text-slate-800 dark:text-slate-200"}`}>{label}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
    </button>
  );
}

function RadioGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <OptionChip key={opt} label={opt} selected={value === opt} onClick={() => onChange(value === opt ? "" : opt)} />
      ))}
    </div>
  );
}

// ─── Posted-job result card ────────────────────────────────────────────────────

function MatchCard({ match, rank, onApply }: { match: PostedJobMatch; rank: number; onApply: () => void }) {
  const { job, score, reasons } = match;

  const scoreColor =
    score >= 80 ? "text-emerald-600 dark:text-emerald-400"
    : score >= 60 ? "text-[#474ead]"
    : "text-slate-500 dark:text-slate-400";

  const scoreBg =
    score >= 80 ? "bg-emerald-50 dark:bg-emerald-900/20"
    : score >= 60 ? "bg-[#474ead]/10"
    : "bg-slate-100 dark:bg-white/[0.04]";

  const tags = (job.skillTags ?? []).slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.07 }}>
      <Card className="overflow-hidden border-slate-200/80 dark:border-white/10">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-white/10">
            <div className="flex-1">
              {rank === 0 && (
                <Badge className="mb-2 rounded-full bg-[#474ead] text-[11px] text-white hover:bg-[#474ead]">
                  Top Match
                </Badge>
              )}
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{job.title}</h3>
              <p className="mt-0.5 text-sm capitalize text-slate-500 dark:text-slate-400">
                {job.category ?? "General"}{job.location ? ` · ${job.location}` : ""}{job.contractType ? ` · ${job.contractType.replace(/-/g, " ")}` : ""}
              </p>
            </div>
            <div className={`shrink-0 rounded-2xl px-3 py-1.5 text-center ${scoreBg}`}>
              <div className={`text-xl font-bold leading-none ${scoreColor}`}>{score}%</div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">match</div>
            </div>
          </div>

          {/* Why it matches */}
          {reasons.length > 0 && (
            <div className="border-b border-slate-100 bg-[#474ead]/[0.02] px-5 py-4 dark:border-white/10">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Why it fits you</p>
              <ul className="space-y-1">
                {reasons.slice(0, 3).map((r) => (
                  <li key={r} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#474ead]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skill tags */}
          {tags.length > 0 && (
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Key skills for this role</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((s) => (
                  <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
            <Button onClick={onApply} className="rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]" size="sm">
              Apply for this role <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Empty / notice states ─────────────────────────────────────────────────────

function NoOpenRoles({ onBrowse }: { onBrowse: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="rounded-3xl border border-slate-200/80 bg-white px-8 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/[0.06]">
          <Inbox className="h-7 w-7 text-slate-400 dark:text-slate-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          There are no open roles available at the moment.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
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

function NoMatchingRoles({ onBrowse, onRetake }: { onBrowse: () => void; onRetake: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="rounded-3xl border border-slate-200/80 bg-white px-8 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#474ead]/10">
          <SearchX className="h-7 w-7 text-[#474ead]" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          No matching roles are available right now.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Based on your quiz responses, we do not have an active posted role that matches your profile yet. Please browse all current openings or check back soon.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onBrowse} className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]">
            Browse All Roles
          </Button>
          <Button variant="outline" onClick={onRetake} className="rounded-full px-8">
            <RotateCcw className="mr-2 h-4 w-4" /> Retake Quiz
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Validation ─────────────────────────────────────────────────────────────────

function canProceed(step: number, answers: QuizAnswers): boolean {
  switch (step) {
    case 0: return answers.skills.length > 0;
    case 1: return answers.values.length > 0;
    case 2: return !!answers.environment;
    case 3: return !!answers.shift && !!answers.workType && !!answers.voiceType && !!answers.clientFacing;
    case 4: return !!answers.workStyle && !!answers.taskVariety && !!answers.multitasking && !!answers.communicationLoad;
    default: return true;
  }
}

// ─── Step labels ────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Skills",      short: "1" },
  { label: "Values",      short: "2" },
  { label: "Environment", short: "3" },
  { label: "Schedule",    short: "4" },
  { label: "Work Style",  short: "5" },
];

// ─── Main component ─────────────────────────────────────────────────────────────

const APPLY_URL = "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true";

export default function FindBestMatches() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const [showResults, setShowResults] = useState(false);

  // Fetch posted jobs — same source of truth as FindWorkAllJobs
  const { openJobs, isLoading: jobsLoading } = usePostedJobs();

  const matches = useMemo(
    () => (showResults ? computePostedMatches(answers, openJobs) : []),
    [showResults, answers, openJobs]
  );

  function toggleMulti<K extends keyof QuizAnswers>(key: K, value: string) {
    const current = answers[key] as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setAnswers({ ...answers, [key]: next });
  }

  function setSingle<K extends keyof QuizAnswers>(key: K, value: string) {
    setAnswers({ ...answers, [key]: value });
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      setShowResults(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleRetake() {
    setAnswers(EMPTY_ANSWERS);
    setStep(0);
    setShowResults(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const ready = canProceed(step, answers);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.12),transparent_32%),linear-gradient(to_bottom,#f8fafc,white)] text-slate-900 dark:bg-[#060816] dark:text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(71,78,173,0.14),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.10),transparent_24%)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-10 md:px-8 md:pb-14 md:pt-12">
          <button
            onClick={() => navigate("/find-work")}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-[#474ead] dark:text-slate-400"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Find Work
          </button>

          {!showResults ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Badge className="mb-4 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
                Role Discovery Quiz
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl dark:text-white">
                Find your best-fit remote role.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-500 dark:text-slate-400">
                Answer 5 short questions about your skills, values, and work preferences. We'll surface the roles you're most likely to thrive in.
              </p>

              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Step {step + 1} of {STEPS.length} — <span className="font-semibold text-slate-700 dark:text-slate-300">{STEPS[step].label}</span></span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-slate-200 dark:bg-white/10" />

                <div className="mt-3 flex gap-2">
                  {STEPS.map((s, i) => (
                    <div
                      key={s.label}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                        i < step
                          ? "bg-[#474ead] text-white"
                          : i === step
                          ? "border-2 border-[#474ead] text-[#474ead]"
                          : "border border-slate-200 text-slate-400 dark:border-white/10"
                      }`}
                    >
                      {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.short}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#474ead]/10">
                  <Sparkles className="h-5 w-5 text-[#474ead]" />
                </div>
                <Badge className="rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
                  Your Results
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl dark:text-white">
                Your best-fit roles.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-500 dark:text-slate-400">
                Based on your skills, values, and work preferences, here are active posted roles you're most likely to thrive in.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => navigate("/find-work/jobs")} className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c]">
                  Browse All Roles
                </Button>
                <Button variant="outline" onClick={handleRetake} className="rounded-full px-6">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retake Quiz
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Body ── */}
      <div className="mx-auto max-w-4xl px-6 py-10 md:px-8 md:py-14">

        {/* ── Results ── */}
        {showResults && (
          <div className="space-y-5">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-[#474ead]" />
              </div>
            ) : openJobs.length === 0 ? (
              <NoOpenRoles onBrowse={() => navigate("/find-work/jobs")} />
            ) : matches.length === 0 ? (
              <NoMatchingRoles
                onBrowse={() => navigate("/find-work/jobs")}
                onRetake={handleRetake}
              />
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Target className="h-4 w-4" />
                  Showing {matches.length} active {matches.length === 1 ? "role" : "roles"} matched to your profile
                </div>

                {matches.map((match, i) => (
                  <MatchCard
                    key={match.job.id}
                    match={match}
                    rank={i}
                    onApply={() => window.open(APPLY_URL, "_blank", "noopener,noreferrer")}
                  />
                ))}

                {/* Bottom CTA */}
                <div className="mt-8 rounded-3xl border border-[#474ead]/10 bg-[#474ead]/[0.03] px-8 py-8 text-center">
                  <TrendingUp className="mx-auto mb-3 h-8 w-8 text-[#474ead]" />
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Ready to take the next step?</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Browse all open positions and apply directly. We hire fast — most roles fill within 3–10 days.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Button onClick={() => navigate("/find-work/jobs")} className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]">
                      Browse All Roles
                    </Button>
                    <Button variant="outline" onClick={handleRetake} className="rounded-full px-8">
                      <RotateCcw className="mr-2 h-4 w-4" /> Retake Quiz
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Quiz ── */}
        {!showResults && (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
            >
              <Card className="border-slate-200/80 dark:border-white/10">
                <CardContent className="p-6 md:p-8">

                  {/* ─ Step 1: Skills ─ */}
                  {step === 0 && (
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <BriefcaseBusiness className="h-4 w-4 text-[#474ead]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 1 — Skills</p>
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">What are your strongest skills?</h2>
                      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Select all that apply. Pick the ones you're genuinely confident in.</p>
                      <div className="mt-6 flex flex-wrap gap-2.5">
                        {SKILLS.map((s) => (
                          <OptionChip
                            key={s}
                            label={s}
                            selected={answers.skills.includes(s)}
                            onClick={() => toggleMulti("skills", s)}
                          />
                        ))}
                      </div>
                      {answers.skills.length > 0 && (
                        <p className="mt-4 text-xs text-slate-400">{answers.skills.length} skill{answers.skills.length > 1 ? "s" : ""} selected</p>
                      )}
                    </div>
                  )}

                  {/* ─ Step 2: Values ─ */}
                  {step === 1 && (
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Target className="h-4 w-4 text-[#474ead]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 2 — Values</p>
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">What matters most to you at work?</h2>
                      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Pick up to 3 things that are most important to you.</p>
                      <div className="mt-6 flex flex-wrap gap-2.5">
                        {VALUES.map((v) => (
                          <OptionChip
                            key={v}
                            label={v}
                            selected={answers.values.includes(v)}
                            onClick={() => {
                              if (answers.values.includes(v)) {
                                toggleMulti("values", v);
                              } else if (answers.values.length < 3) {
                                toggleMulti("values", v);
                              }
                            }}
                          />
                        ))}
                      </div>
                      {answers.values.length > 0 && (
                        <p className="mt-4 text-xs text-slate-400">{answers.values.length}/3 selected</p>
                      )}
                    </div>
                  )}

                  {/* ─ Step 3: Environment ─ */}
                  {step === 2 && (
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#474ead]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 3 — Environment</p>
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">What kind of work environment suits you best?</h2>
                      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Choose one that resonates most with how you like to work.</p>
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {ENVIRONMENTS.map((e) => (
                          <EnvCard
                            key={e.id}
                            id={e.id}
                            label={e.label}
                            desc={e.desc}
                            selected={answers.environment === e.id}
                            onClick={() => setSingle("environment", e.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─ Step 4: Schedule & Setup ─ */}
                  {step === 3 && (
                    <div className="space-y-7">
                      <div className="mb-1 flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-[#474ead]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 4 — Schedule & Setup</p>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Preferred shift</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">When are you most productive?</p>
                        <div className="mt-4"><RadioGroup options={SHIFTS} value={answers.shift} onChange={(v) => setSingle("shift", v)} /></div>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Work type</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Full-time or part-time?</p>
                        <div className="mt-4"><RadioGroup options={WORK_TYPES} value={answers.workType} onChange={(v) => setSingle("workType", v)} /></div>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Voice or non-voice?</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Do you want to be on calls, or prefer written communication?</p>
                        <div className="mt-4"><RadioGroup options={VOICE_TYPES} value={answers.voiceType} onChange={(v) => setSingle("voiceType", v)} /></div>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Client-facing or behind the scenes?</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Do you want to interact with clients directly?</p>
                        <div className="mt-4"><RadioGroup options={CLIENT_FACING} value={answers.clientFacing} onChange={(v) => setSingle("clientFacing", v)} /></div>
                      </div>
                    </div>
                  )}

                  {/* ─ Step 5: Work Style ─ */}
                  {step === 4 && (
                    <div className="space-y-7">
                      <div className="mb-1 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#474ead]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 5 — Work Style</p>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How do you approach work?</h2>
                        <div className="mt-4"><RadioGroup options={WORK_STYLE_OPTIONS} value={answers.workStyle} onChange={(v) => setSingle("workStyle", v)} /></div>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Task variety preference</h2>
                        <div className="mt-4"><RadioGroup options={TASK_VARIETY_OPTIONS} value={answers.taskVariety} onChange={(v) => setSingle("taskVariety", v)} /></div>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Multitasking comfort</h2>
                        <div className="mt-4"><RadioGroup options={MULTITASK_OPTIONS} value={answers.multitasking} onChange={(v) => setSingle("multitasking", v)} /></div>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How do you prefer to spend your energy?</h2>
                        <div className="mt-4"><RadioGroup options={COMM_LOAD_OPTIONS} value={answers.communicationLoad} onChange={(v) => setSingle("communicationLoad", v)} /></div>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* Nav buttons */}
              <div className="mt-6 flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0}
                  className="rounded-full px-6"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!ready}
                  className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c] disabled:opacity-40"
                >
                  {step === STEPS.length - 1 ? (
                    <><Sparkles className="mr-2 h-4 w-4" /> See My Matches</>
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
