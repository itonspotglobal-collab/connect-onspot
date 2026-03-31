import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search, Sparkles, BriefcaseBusiness, Clock3, Globe2,
  ChevronRight, Star, ArrowRight, BadgeCheck, Filter,
  Zap, DollarSign, Building2, CheckCircle2, Users, Brain,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// ─── Data (unchanged) ────────────────────────────────────────────────────────

const roles = [
  {
    id: 1,
    title: "Executive Virtual Assistant",
    pay: "$900–$1,400/mo",
    shift: "Night shift",
    market: "US client",
    category: "Admin",
    demand: "High demand",
    speed: "Quick hire",
    fit: 92,
    hook: "Support a fast-moving founder and become a key operator.",
    why: "Strong fit for admin-heavy, client-facing candidates.",
    tags: ["Remote", "Growth path", "Premium client"],
  },
  {
    id: 2,
    title: "Customer Support Specialist",
    pay: "$800–$1,200/mo",
    shift: "Night shift",
    market: "US client",
    category: "Support",
    demand: "Actively hiring",
    speed: "3–5 days",
    fit: 88,
    hook: "Join a scaling ecommerce brand with structured training.",
    why: "Great for strong communicators with service experience.",
    tags: ["Remote", "Training provided", "High volume"],
  },
  {
    id: 3,
    title: "Bookkeeper / Accounting Assistant",
    pay: "$1,000–$1,800/mo",
    shift: "Day shift",
    market: "AU client",
    category: "Finance",
    demand: "Above market pay",
    speed: "Priority role",
    fit: 84,
    hook: "Own reconciliations and reporting for a stable global business.",
    why: "Strong match for organized candidates with finance exposure.",
    tags: ["Remote", "Stable team", "Career track"],
  },
  {
    id: 4,
    title: "Sales Development Representative",
    pay: "$1,100–$2,000/mo",
    shift: "Night shift",
    market: "US client",
    category: "Sales",
    demand: "Fast growth",
    speed: "Urgent",
    fit: 86,
    hook: "Book meetings, drive pipeline, and earn in a performance culture.",
    why: "Best for confident communicators who like targets.",
    tags: ["Commission upside", "Remote", "B2B"],
  },
  {
    id: 5,
    title: "Content & Social Media Assistant",
    pay: "$850–$1,300/mo",
    shift: "Flexible",
    market: "UK client",
    category: "Marketing",
    demand: "Creative role",
    speed: "Open now",
    fit: 81,
    hook: "Create content systems for a modern digital brand.",
    why: "Great fit for organized creatives with execution skills.",
    tags: ["Remote", "Portfolio builder", "Flexible"],
  },
  {
    id: 6,
    title: "Operations Coordinator",
    pay: "$1,000–$1,500/mo",
    shift: "Day shift",
    market: "AU client",
    category: "Operations",
    demand: "Actively hiring",
    speed: "7 days",
    fit: 79,
    hook: "Keep projects, people, and systems moving without chaos.",
    why: "Excellent for detail-driven candidates who thrive on structure.",
    tags: ["Remote", "Process-driven", "Cross-functional"],
  },
];

const trustStats = [
  { label: "Candidates placed", value: "1,200+" },
  { label: "Typical monthly roles", value: "$800–$2,500" },
  { label: "Global client markets", value: "US · AU · UK" },
  { label: "Hiring speed", value: "3–10 days" },
];

const stories = [
  {
    name: "Maria",
    role: "Virtual Assistant",
    quote: "I went from routine admin work to supporting a premium global client with better pay and clearer growth.",
    outcome: "From ₱25K to ₱85K/month",
  },
  {
    name: "Paolo",
    role: "Customer Support Specialist",
    quote: "The process felt faster and more human. I got matched to a role that actually fit my schedule and strengths.",
    outcome: "Hired in 5 days",
  },
  {
    name: "Andrea",
    role: "Bookkeeping Assistant",
    quote: "What stood out was the quality of opportunities. It didn't feel like random applications anymore.",
    outcome: "Moved into an AU role",
  },
];

const prompts = [
  "Virtual assistant, night shift, $900+",
  "Customer support, remote, US client",
  "Accounting or finance role, day shift",
  "Social media assistant with flexible schedule",
];

const whyFeatures = [
  {
    icon: Brain,
    title: "Smart matching",
    copy: "Surface better-fit roles first instead of forcing endless browsing.",
  },
  {
    icon: DollarSign,
    title: "Premium remote roles",
    copy: "Highlight compensation clearly so applicants instantly see quality.",
  },
  {
    icon: TrendingUp,
    title: "Faster hiring momentum",
    copy: "Show urgency, speed-to-hire, and profile strength to increase action.",
  },
  {
    icon: BadgeCheck,
    title: "Trust by design",
    copy: "Use fit reasoning, hiring signals, and outcomes to build confidence.",
  },
];

const ctaSteps = [
  "Apply in 30 seconds",
  "Get matched to better-fit roles",
  "Complete your profile for stronger opportunities",
  "Stay visible for active hiring teams",
];

// ─── StatPill (unchanged structure, new styling) ─────────────────────────────
function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/15 bg-white/70 px-4 py-3 backdrop-blur dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

// ─── JobCard — now a bold horizontal strip ────────────────────────────────────
function JobCard({ role, index }: { role: typeof roles[number]; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <div className="group relative flex gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_8px_32px_rgba(71,78,173,0.10)]">

        {/* Left accent + match number */}
        <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-slate-100 bg-slate-50 px-3 py-5 transition-colors group-hover:bg-primary/5">
          <span className="text-3xl font-black leading-none tracking-tight text-primary">
            {role.fit}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            % fit
          </span>
          <div className="mt-2 h-1 w-8 rounded-full bg-primary/20">
            <div
              className="h-1 rounded-full bg-primary transition-all"
              style={{ width: `${role.fit}%` }}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          {/* Top row: title + badges */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {role.demand}
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {role.speed}
                </span>
              </div>
              <h3 className="text-lg font-bold leading-snug text-slate-900">
                {role.title}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">{role.hook}</p>
            </div>

            {/* Actions — visible on hover on desktop, always on mobile */}
            <div className="flex items-center gap-2">
              <Button size="sm" className="rounded-lg px-4">
                Apply in 30 seconds
              </Button>
              <button className="hidden items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-primary md:inline-flex">
                Details <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <DollarSign className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <strong className="font-semibold text-slate-800">{role.pay}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {role.shift}
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Globe2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {role.market}
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {role.category}
            </span>

            {/* Tags */}
            <span className="ml-auto flex flex-wrap gap-1">
              {role.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500"
                >
                  {tag}
                </span>
              ))}
            </span>
          </div>

          {/* Why fit */}
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-4 py-3">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-xs leading-5 text-slate-600">
              <span className="font-semibold text-slate-800">Why you're a fit: </span>
              {role.why}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sidebar filter pill ──────────────────────────────────────────────────────
function SidebarFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
              value === opt
                ? "bg-primary text-white font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {opt}
            {value === opt && <CheckCircle2 className="h-3.5 w-3.5 opacity-80" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnSpotFindWorkRedesign() {
  // State (unchanged)
  const [query, setQuery] = useState("Virtual assistant, night shift, $900+");
  const [schedule, setSchedule] = useState("All schedules");
  const [earning, setEarning] = useState("Any pay");
  const [kind, setKind] = useState("All work");
  const [profileStrength] = useState(68);

  // Filtering logic (unchanged)
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const q = query.toLowerCase();
      const schedulePass = schedule === "All schedules" || role.shift === schedule;
      const kindPass = kind === "All work" || role.category === kind;
      const earningPass =
        earning === "Any pay" ||
        (earning === "$800+" && /\$(\d+)/.test(role.pay)) ||
        (earning === "$1,000+" && parseInt(role.pay.match(/\$(\d+)/)?.[1] || "0", 10) >= 1000) ||
        (earning === "$1,500+" && parseInt(role.pay.match(/\$(\d+)/)?.[1] || "0", 10) >= 1500);

      const queryPass =
        !q ||
        role.title.toLowerCase().includes(q) ||
        role.category.toLowerCase().includes(q) ||
        role.market.toLowerCase().includes(q) ||
        role.shift.toLowerCase().includes(q) ||
        role.hook.toLowerCase().includes(q);

      return schedulePass && kindPass && earningPass && queryPass;
    });
  }, [query, schedule, earning, kind]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ════════════════════════════════════════════════════════════════════
          HERO — full dark editorial, no white card
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* Faint grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.4) 39px,rgba(255,255,255,0.4) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.4) 39px,rgba(255,255,255,0.4) 40px)",
          }}
        />
        {/* Primary glow */}
        <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[600px] rounded-full bg-primary/25 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-14 pb-0 md:px-8 md:pt-20">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-6 flex items-center gap-3"
          >
            <div className="h-px w-8 bg-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Find work with global companies hiring now
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="max-w-5xl text-5xl font-black leading-[1.03] tracking-tight md:text-7xl"
          >
            Find work that pays well —{" "}
            <span className="text-primary">and moves you forward.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 max-w-2xl text-base leading-8 text-slate-400 md:text-lg"
          >
            Get matched to premium remote opportunities across admin, support, finance, sales, marketing, and operations. Faster, smarter, and more human than a typical job board.
          </motion.p>

          {/* Search — minimal dark treatment */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-10 border-t border-white/10 pt-8"
          >
            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-auto flex-1 border-0 bg-transparent p-0 text-base text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0 md:text-lg"
                placeholder="Tell us what kind of work you're looking for…"
              />
              <Button className="shrink-0 rounded-lg px-6">
                Find My Best Matches
              </Button>
            </div>

            {/* Prompt chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setQuery(prompt)}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300 transition hover:border-primary/40 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Stats band */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-14 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 md:grid-cols-4"
          >
            {[
              { icon: Users,      label: "Candidates placed",   value: "1,200+" },
              { icon: DollarSign, label: "Typical monthly roles", value: "$800–$2,500" },
              { icon: Globe2,     label: "Global client markets", value: "US · AU · UK" },
              { icon: Zap,        label: "Hiring speed",         value: "3–10 days" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col gap-1 px-6 py-6 first:pl-0">
                <Icon className="mb-1 h-4 w-4 text-primary" />
                <span className="text-2xl font-black tracking-tight">{value}</span>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Profile strength bar — transitions hero to body */}
      <div className="border-b border-slate-200 bg-white px-6 md:px-8">
        <div className="mx-auto max-w-7xl py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-slate-700">Profile strength</div>
              <div className="w-48">
                <Progress value={profileStrength} className="h-1.5" />
              </div>
              <span className="text-sm font-bold text-primary">{profileStrength}%</span>
            </div>
            <p className="text-xs text-slate-500">
              Complete your profile to unlock better matches
            </p>
            <Button variant="outline" size="sm" className="rounded-lg">
              Browse Roles
            </Button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ROLES — sidebar layout, horizontal list cards
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
        {/* Section header */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
              — Top matches for you
            </p>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Roles that feel more like opportunities.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">
            Designed to reduce random scrolling and help applicants focus on roles that fit their pay goals, schedule, and strengths.
          </p>
        </div>

        {/* Two-column: sidebar + role list */}
        <div className="flex gap-8 lg:gap-12">

          {/* ── Left sidebar filters ─────────────────────────────────────── */}
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-6 space-y-6">
              <SidebarFilter
                label="Earning goal"
                options={["Any pay", "$800+", "$1,000+", "$1,500+"]}
                value={earning}
                onChange={setEarning}
              />
              <div className="h-px bg-slate-200" />
              <SidebarFilter
                label="Schedule"
                options={["All schedules", "Day shift", "Night shift", "Flexible"]}
                value={schedule}
                onChange={setSchedule}
              />
              <div className="h-px bg-slate-200" />
              <SidebarFilter
                label="Work type"
                options={["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"]}
                value={kind}
                onChange={setKind}
              />
              {/* Live preview card */}
              <div className="h-px bg-slate-200" />
              <div className="rounded-xl bg-slate-950 p-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Live preview
                </p>
                <p className="mt-1 text-base font-bold leading-snug">Your best opportunities</p>
                <Badge className="mt-2 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">
                  12 matches found
                </Badge>
                <div className="mt-4 space-y-2">
                  {roles.slice(0, 2).map((role) => (
                    <div key={role.id} className="rounded-lg bg-white/5 p-3">
                      <p className="text-xs font-semibold">{role.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{role.pay} · {role.fit}% match</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ── Mobile filters ───────────────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap gap-2 lg:hidden w-full">
            {[
              { options: ["Any pay", "$800+", "$1,000+", "$1,500+"],                           state: earning,   set: setEarning },
              { options: ["All schedules", "Day shift", "Night shift", "Flexible"],             state: schedule,  set: setSchedule },
              { options: ["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"], state: kind, set: setKind },
            ].map((group, gi) =>
              group.options.map((opt) => (
                <button
                  key={`${gi}-${opt}`}
                  onClick={() => group.set(opt)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    group.state === opt
                      ? "bg-primary text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>

          {/* ── Role list ────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">
            {filteredRoles.length > 0 ? (
              filteredRoles.map((role, index) => (
                <JobCard key={role.id} role={role} index={index} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">
                  No roles match your filters. Try adjusting your search.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          WHY ONSPOT — bento grid, editorial
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          {/* Header */}
          <div className="mb-10 grid gap-6 border-b border-slate-900 pb-8 md:grid-cols-[1fr_1fr]">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                — Why OnSpot
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                More than listings. Better matching. Better outcomes.
              </h2>
            </div>
            <p className="self-end text-slate-500 md:pl-8">
              This page is built for applicants, not for recruiters. The experience is designed to feel guided, high-trust, and momentum-driven from first click to application.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Dark feature — full width on small, 2 cols on lg */}
            <div className="col-span-full rounded-xl bg-slate-950 p-8 text-white lg:col-span-2">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-black">Smart matching</h3>
              <p className="mt-2 max-w-sm text-slate-400">
                Surface better-fit roles first instead of forcing endless browsing.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary">
                See how it works <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* Light features */}
            {whyFeatures.slice(1).map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          STORIES — magazine pull-quote style
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          {/* Section header */}
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-slate-900 pb-5">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                — Proof it works
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Applicant stories that create trust instantly.
              </h2>
            </div>
            <p className="text-sm text-slate-400">Use real placement stories here once approved.</p>
          </div>

          {/* Pull-quote cards */}
          <div className="grid gap-6 lg:grid-cols-3">
            {stories.map((story, i) => (
              <motion.div
                key={story.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex flex-col gap-4"
              >
                {/* Stars */}
                <div className="flex items-center gap-0.5 text-primary">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-current" />
                  ))}
                </div>

                {/* Quote */}
                <div className="relative flex-1">
                  {/* Large decorative quote mark */}
                  <span className="absolute -top-4 -left-1 text-7xl font-black leading-none text-primary/10 select-none">
                    "
                  </span>
                  <p className="relative text-base leading-8 text-slate-700">
                    {story.quote}
                  </p>
                </div>

                {/* Attribution */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-3">
                    {/* Initial avatar */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                      {story.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{story.name}</p>
                      <p className="text-xs text-slate-500">{story.role}</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {story.outcome}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          CTA — split two-tone, bold
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          <div className="grid overflow-hidden rounded-2xl lg:grid-cols-2">

            {/* Left dark pane */}
            <div className="relative overflow-hidden bg-slate-950 p-8 text-white md:p-12">
              <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
              <div className="relative">
                <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70">
                  Roles fill fast
                </div>
                <h2 className="max-w-sm text-3xl font-black leading-tight md:text-4xl">
                  Your next opportunity is already here. Take the step.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-400">
                  New roles are added regularly. Strong applicants move faster. Start with a quick application, then complete your profile to improve your match quality.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button className="rounded-lg bg-white px-6 text-slate-900 hover:bg-white/90">
                    Start Matching
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-lg border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
                  >
                    Upload Resume
                  </Button>
                </div>
              </div>
            </div>

            {/* Right checklist pane */}
            <div className="flex flex-col justify-center gap-4 bg-primary p-8 text-white md:p-12">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-white/60">
                How it works
              </p>
              {ctaSteps.map((step, i) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-black">
                    {i + 1}
                  </div>
                  <p className="text-sm font-medium leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
