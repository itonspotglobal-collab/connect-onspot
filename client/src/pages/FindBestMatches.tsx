import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Sparkles, RotateCcw,
  BriefcaseBusiness, Target, TrendingUp, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
  { id: "structured",   label: "Structured & predictable",    desc: "Clear processes, consistent routines" },
  { id: "flexible",     label: "Flexible & dynamic",          desc: "Adapts fast, no two days are the same" },
  { id: "collaborative",label: "Highly collaborative",        desc: "Always working with others" },
  { id: "independent",  label: "Independent & quiet",         desc: "Deep focus, minimal interruptions" },
  { id: "process",      label: "Process-driven",              desc: "Systems, checklists, standards" },
  { id: "creative",     label: "Creative & evolving",         desc: "Ideas, content, and constant change" },
];

const SHIFTS      = ["Day shift", "Night shift", "Flexible hours"];
const WORK_TYPES  = ["Full-time", "Part-time"];
const VOICE_TYPES = ["Voice", "Non-voice", "Either"];
const CLIENT_FACING = ["Client-facing", "Behind-the-scenes", "Either"];

const WORK_STYLE_OPTIONS  = ["Detail-oriented", "Big-picture thinking"];
const TASK_VARIETY_OPTIONS = ["Repetitive & consistent", "Varied & unpredictable"];
const MULTITASK_OPTIONS   = ["I prefer one task at a time", "I'm a multitasker"];
const COMM_LOAD_OPTIONS   = ["Execution-heavy — I just get things done", "Communication-heavy — I thrive on interaction"];

// ─── Role definitions for matching ─────────────────────────────────────────────

interface RoleProfile {
  title: string;
  tagline: string;
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
    tagline: "A versatile operator who keeps things running smoothly.",
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
    tagline: "A high-trust operator for senior leaders and founders.",
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
    tagline: "A people-first specialist who resolves issues and builds trust.",
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
    tagline: "A precise and focused professional who keeps data clean.",
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
    tagline: "A creative voice who builds brand presence online.",
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
    tagline: "A storyteller who turns ideas into compelling copy.",
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
    tagline: "A numbers-focused professional who keeps finances in order.",
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
    tagline: "An organized leader who keeps teams and timelines aligned.",
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
    tagline: "A driven professional who powers the sales engine.",
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
    tagline: "A curious analyst who surfaces insights and intelligence.",
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
    tagline: "A process-savvy operator who keeps the business running.",
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
    tagline: "A tech-savvy problem-solver who keeps systems working.",
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

// ─── Matching engine ────────────────────────────────────────────────────────────

interface MatchResult {
  role: RoleProfile;
  score: number;
  reasons: string[];
}

function computeMatches(answers: QuizAnswers): MatchResult[] {
  return ROLE_PROFILES.map((role) => {
    let hits = 0;
    let total = 0;
    const reasons: string[] = [];

    // Skills — weighted 3x
    const skillMatches = answers.skills.filter((s) => role.skills.includes(s));
    hits += skillMatches.length * 3;
    total += Math.max(answers.skills.length, role.skills.length) * 3;
    if (skillMatches.length > 0)
      reasons.push(`Matched skills: ${skillMatches.slice(0, 3).join(", ")}`);

    // Values — weighted 2x
    const valueMatches = answers.values.filter((v) => role.values.includes(v));
    hits += valueMatches.length * 2;
    total += Math.max(answers.values.length, role.values.length) * 2;
    if (valueMatches.length > 0)
      reasons.push(`Aligned values: ${valueMatches.slice(0, 2).join(", ")}`);

    // Environment — weighted 2x
    if (answers.environment) {
      total += 2;
      if (role.environments.includes(answers.environment)) {
        hits += 2;
        const envLabel = ENVIRONMENTS.find((e) => e.id === answers.environment)?.label ?? answers.environment;
        reasons.push(`Environment fit: ${envLabel}`);
      }
    }

    // Shift
    if (answers.shift) {
      total += 1;
      if (role.shifts.includes(answers.shift)) {
        hits += 1;
        reasons.push(`Schedule: ${answers.shift}`);
      }
    }

    // Voice type
    if (answers.voiceType && answers.voiceType !== "Either") {
      total += 1;
      if (role.voiceTypes.includes(answers.voiceType) || role.voiceTypes.includes("Either")) {
        hits += 1;
      }
    }

    // Client facing
    if (answers.clientFacing && answers.clientFacing !== "Either") {
      total += 1;
      if (role.clientFacing.includes(answers.clientFacing) || role.clientFacing.includes("Either")) {
        hits += 1;
      }
    }

    // Work style
    if (answers.workStyle) {
      total += 1;
      if (role.workStyles.includes(answers.workStyle)) hits += 1;
    }

    // Task variety
    if (answers.taskVariety) {
      total += 1;
      if (role.taskVariety.includes(answers.taskVariety)) hits += 1;
    }

    // Multitasking
    if (answers.multitasking) {
      total += 1;
      if (role.multitasking.includes(answers.multitasking)) hits += 1;
    }

    // Communication load
    if (answers.communicationLoad) {
      total += 1;
      if (role.commLoad.includes(answers.communicationLoad)) hits += 1;
    }

    const score = total > 0 ? Math.round((hits / total) * 100) : 0;
    return { role, score, reasons };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ─── Small reusable components ─────────────────────────────────────────────────

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
          : "border-slate-200 bg-white text-slate-700 hover:border-[#474ead]/40 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-[#474ead]/40"
      }`}
    >
      {selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </button>
  );
}

function EnvCard({
  id,
  label,
  desc,
  selected,
  onClick,
}: {
  id: string;
  label: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
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
      <span className={`text-sm font-semibold ${selected ? "text-[#474ead]" : "text-slate-800 dark:text-slate-200"}`}>
        {label}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
    </button>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <OptionChip
          key={opt}
          label={opt}
          selected={value === opt}
          onClick={() => onChange(value === opt ? "" : opt)}
        />
      ))}
    </div>
  );
}

function MatchCard({
  match,
  rank,
  onApply,
}: {
  match: MatchResult;
  rank: number;
  onApply: () => void;
}) {
  const scoreColor =
    match.score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : match.score >= 60
      ? "text-[#474ead]"
      : "text-slate-500 dark:text-slate-400";

  const scoreBg =
    match.score >= 80
      ? "bg-emerald-50 dark:bg-emerald-900/20"
      : match.score >= 60
      ? "bg-[#474ead]/10"
      : "bg-slate-100 dark:bg-white/[0.04]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.07 }}
    >
      <Card className="overflow-hidden border-slate-200/80 dark:border-white/10">
        <CardContent className="p-0">
          {/* Header bar */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-white/10">
            <div className="flex-1">
              {rank === 0 && (
                <Badge className="mb-2 rounded-full bg-[#474ead] text-[11px] text-white hover:bg-[#474ead]">
                  Top Match
                </Badge>
              )}
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{match.role.title}</h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{match.role.tagline}</p>
            </div>
            <div className={`shrink-0 rounded-2xl px-3 py-1.5 text-center ${scoreBg}`}>
              <div className={`text-xl font-bold leading-none ${scoreColor}`}>{match.score}%</div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">match</div>
            </div>
          </div>

          {/* Why it matches */}
          {match.reasons.length > 0 && (
            <div className="border-b border-slate-100 bg-[#474ead]/[0.02] px-5 py-4 dark:border-white/10">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Why it fits you</p>
              <ul className="space-y-1">
                {match.reasons.slice(0, 3).map((r) => (
                  <li key={r} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#474ead]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills aligned */}
          <div className="px-5 py-4">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Key skills for this role</p>
            <div className="flex flex-wrap gap-2">
              {match.role.skills.slice(0, 5).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
            <Button
              onClick={onApply}
              className="rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]"
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
  { label: "Skills",       short: "1" },
  { label: "Values",       short: "2" },
  { label: "Environment",  short: "3" },
  { label: "Schedule",     short: "4" },
  { label: "Work Style",   short: "5" },
];

// ─── Main component ─────────────────────────────────────────────────────────────

const APPLY_URL = "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true";

export default function FindBestMatches() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const [showResults, setShowResults] = useState(false);

  const matches = useMemo(() => (showResults ? computeMatches(answers) : []), [showResults, answers]);

  function toggleMulti<K extends keyof QuizAnswers>(
    key: K,
    value: string,
    answers: QuizAnswers,
    setAnswers: (a: QuizAnswers) => void
  ) {
    const current = answers[key] as string[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
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
          {/* Back */}
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

              {/* Progress tracker */}
              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Step {step + 1} of {STEPS.length} — <span className="font-semibold text-slate-700 dark:text-slate-300">{STEPS[step].label}</span></span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-slate-200 dark:bg-white/10" />

                {/* Step dots */}
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
                Based on your skills, values, and work preferences, here are the roles you're most likely to thrive in. Explore each one and apply when you're ready.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={() => navigate("/find-work/jobs")}
                  className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c]"
                >
                  Browse All Roles
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRetake}
                  className="rounded-full px-6"
                >
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
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Target className="h-4 w-4" />
              Showing your top {matches.length} matches based on your answers
            </div>
            {matches.map((match, i) => (
              <MatchCard
                key={match.role.title}
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
                <Button
                  onClick={() => navigate("/find-work/jobs")}
                  className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c]"
                >
                  Browse All Roles
                </Button>
                <Button variant="outline" onClick={handleRetake} className="rounded-full px-8">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retake Quiz
                </Button>
              </div>
            </div>
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
                            onClick={() => toggleMulti("skills", s, answers, setAnswers)}
                          />
                        ))}
                      </div>
                      {answers.skills.length > 0 && (
                        <p className="mt-4 text-xs text-slate-400">
                          {answers.skills.length} selected
                        </p>
                      )}
                    </div>
                  )}

                  {/* ─ Step 2: Values ─ */}
                  {step === 1 && (
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#474ead]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 2 — Work Values</p>
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">What matters most to you in a role?</h2>
                      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Choose up to 3 priorities that genuinely drive you.</p>
                      <div className="mt-6 flex flex-wrap gap-2.5">
                        {VALUES.map((v) => (
                          <OptionChip
                            key={v}
                            label={v}
                            selected={answers.values.includes(v)}
                            onClick={() => {
                              const current = answers.values;
                              if (current.includes(v)) {
                                setAnswers({ ...answers, values: current.filter((x) => x !== v) });
                              } else if (current.length < 3) {
                                setAnswers({ ...answers, values: [...current, v] });
                              }
                            }}
                          />
                        ))}
                      </div>
                      {answers.values.length === 3 && (
                        <p className="mt-4 text-xs text-[#474ead]">Maximum 3 selected.</p>
                      )}
                    </div>
                  )}

                  {/* ─ Step 3: Environment ─ */}
                  {step === 2 && (
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Target className="h-4 w-4 text-[#474ead]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 3 — Work Environment</p>
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">What kind of environment suits you best?</h2>
                      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Choose the one that feels most natural to you.</p>
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {ENVIRONMENTS.map((env) => (
                          <EnvCard
                            key={env.id}
                            id={env.id}
                            label={env.label}
                            desc={env.desc}
                            selected={answers.environment === env.id}
                            onClick={() => setSingle("environment", env.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─ Step 4: Schedule & setup ─ */}
                  {step === 3 && (
                    <div className="space-y-7">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <BriefcaseBusiness className="h-4 w-4 text-[#474ead]" />
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 4 — Schedule & Setup</p>
                        </div>
                        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Tell us about your preferred work setup.</h2>
                        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Be honest — matching you to the right shift and format matters.</p>
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Preferred shift</p>
                        <RadioGroup options={SHIFTS} value={answers.shift} onChange={(v) => setSingle("shift", v)} />
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Work commitment</p>
                        <RadioGroup options={WORK_TYPES} value={answers.workType} onChange={(v) => setSingle("workType", v)} />
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Voice or non-voice</p>
                        <RadioGroup options={VOICE_TYPES} value={answers.voiceType} onChange={(v) => setSingle("voiceType", v)} />
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Client interaction preference</p>
                        <RadioGroup options={CLIENT_FACING} value={answers.clientFacing} onChange={(v) => setSingle("clientFacing", v)} />
                      </div>
                    </div>
                  )}

                  {/* ─ Step 5: Work style ─ */}
                  {step === 4 && (
                    <div className="space-y-7">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-[#474ead]" />
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Step 5 — Work Style</p>
                        </div>
                        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">How do you naturally work best?</h2>
                        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Pick the option that feels most true, not the one you think sounds best.</p>
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Your thinking style</p>
                        <RadioGroup options={WORK_STYLE_OPTIONS} value={answers.workStyle} onChange={(v) => setSingle("workStyle", v)} />
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Task preference</p>
                        <RadioGroup options={TASK_VARIETY_OPTIONS} value={answers.taskVariety} onChange={(v) => setSingle("taskVariety", v)} />
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Multitasking comfort</p>
                        <RadioGroup options={MULTITASK_OPTIONS} value={answers.multitasking} onChange={(v) => setSingle("multitasking", v)} />
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Day-to-day work mix</p>
                        <RadioGroup options={COMM_LOAD_OPTIONS} value={answers.communicationLoad} onChange={(v) => setSingle("communicationLoad", v)} />
                      </div>
                    </div>
                  )}

                  {/* ─ Navigation ─ */}
                  <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6 dark:border-white/10">
                    <Button
                      variant="outline"
                      onClick={() => step > 0 ? setStep(step - 1) : navigate("/find-work")}
                      className="rounded-full px-6"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {step === 0 ? "Back" : "Previous"}
                    </Button>

                    <Button
                      onClick={handleNext}
                      disabled={!ready}
                      className="rounded-full bg-[#474ead] px-8 text-white hover:bg-[#3d439c] disabled:opacity-40"
                    >
                      {step === STEPS.length - 1 ? (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" /> See My Matches
                        </>
                      ) : (
                        <>
                          Next <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
