import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Sparkles, BriefcaseBusiness, Clock3, Globe2,
  ChevronRight, Star, ArrowRight, BadgeCheck, Filter,
  Zap, DollarSign, Building2, CheckCircle2, Users, Brain,
  TrendingUp, Plus, Minus,
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
  { icon: Brain,      title: "Smart matching",          copy: "Surface better-fit roles first instead of forcing endless browsing." },
  { icon: DollarSign, title: "Premium remote roles",    copy: "Highlight compensation clearly so applicants instantly see quality." },
  { icon: TrendingUp, title: "Faster hiring momentum",  copy: "Show urgency, speed-to-hire, and profile strength to increase action." },
  { icon: BadgeCheck, title: "Trust by design",         copy: "Use fit reasoning, hiring signals, and outcomes to build confidence." },
];

const ctaSteps = [
  "Apply in 30 seconds",
  "Get matched to better-fit roles",
  "Complete your profile for stronger opportunities",
  "Stay visible for active hiring teams",
];

// ─── StatPill (retained, used below hero) ────────────────────────────────────
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

// ─── Accordion-style role row ─────────────────────────────────────────────────
function RoleRow({ role, index, isOpen, onToggle }: {
  role: typeof roles[number];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`border-b border-stone-200 transition-colors duration-200 ${isOpen ? "bg-stone-100" : "hover:bg-stone-50"}`}
    >
      {/* Row header — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-6 py-5 text-left md:px-8"
      >
        {/* Index number */}
        <span className="w-6 shrink-0 text-xs font-bold text-stone-400">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Match arc */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5 text-xs font-black text-primary">
          {role.fit}%
        </div>

        {/* Title + hook */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-base font-bold text-stone-900 md:text-lg">{role.title}</span>
            <span className="hidden text-sm text-stone-400 md:inline">— {role.hook}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {role.demand}
            </span>
            <span className="text-xs text-stone-400">{role.speed}</span>
          </div>
        </div>

        {/* Pay */}
        <div className="hidden shrink-0 text-right md:block">
          <div className="text-xs text-stone-400">Monthly pay</div>
          <div className="text-sm font-bold text-stone-900">{role.pay}</div>
        </div>

        {/* Toggle icon */}
        <div className="ml-2 shrink-0 text-stone-400">
          {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-stone-200 px-6 pb-6 pt-5 md:px-8">
              <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                {/* Left */}
                <div>
                  <p className="text-sm text-stone-500 md:hidden mb-4">{role.hook}</p>

                  {/* Meta grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { Icon: DollarSign, l: "Monthly pay",  v: role.pay      },
                      { Icon: Clock3,     l: "Schedule",     v: role.shift    },
                      { Icon: Globe2,     l: "Market",       v: role.market   },
                      { Icon: BriefcaseBusiness, l: "Category", v: role.category },
                    ].map(({ Icon, l, v }) => (
                      <div key={l} className="rounded-xl border border-stone-200 bg-white p-3">
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                          <Icon className="h-3 w-3" />{l}
                        </div>
                        <div className="mt-1 text-sm font-bold text-stone-900">{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Why fit */}
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary/5 px-4 py-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-stone-700">
                      <span className="font-semibold text-stone-900">Why you're a fit: </span>
                      {role.why}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {role.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: CTA panel */}
                <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      Match score
                    </div>
                    <div className="mt-1 text-4xl font-black text-primary">{role.fit}%</div>
                    <Progress value={role.fit} className="mt-2 h-1.5" />
                  </div>
                  <Button className="w-full rounded-xl">
                    Apply in 30 seconds
                  </Button>
                  <button className="flex w-full items-center justify-center gap-1.5 text-sm text-stone-400 transition hover:text-stone-900">
                    View details <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnSpotFindWorkRedesign() {
  const [query, setQuery] = useState("Virtual assistant, night shift, $900+");
  const [schedule, setSchedule] = useState("All schedules");
  const [earning, setEarning] = useState("Any pay");
  const [kind, setKind] = useState("All work");
  const [profileStrength] = useState(68);
  const [openRoleId, setOpenRoleId] = useState<number | null>(1);

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
    <div className="min-h-screen bg-[#F7F4EF] text-stone-900">

      {/* ════════════════════════════════════════════════════════════════════
          HERO — centered, full-viewport, typographic
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden bg-[#1C1917] px-6 text-center md:px-8">
        {/* Warm ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(71,78,173,0.35),transparent)]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-3/4 rounded-full bg-primary/10 blur-[100px]" />

        {/* Subtle horizontal rule */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.04]" />

        <div className="relative max-w-5xl">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 flex items-center justify-center gap-3"
          >
            <div className="h-px w-10 bg-primary/60" />
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-primary/80">
              Find work with global companies hiring now
            </span>
            <div className="h-px w-10 bg-primary/60" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06 }}
            className="text-5xl font-black leading-[1.02] tracking-tight text-white md:text-7xl xl:text-8xl"
          >
            Find work that
            <br />
            <span className="text-primary">pays well</span> — and
            <br />
            moves you forward.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="mx-auto mt-7 max-w-2xl text-base leading-8 text-stone-400 md:text-lg"
          >
            Get matched to premium remote opportunities across admin, support, finance, sales, marketing, and operations. Faster, smarter, and more human than a typical job board.
          </motion.p>

          {/* Search bar — full width, minimal */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-10 flex max-w-3xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur-sm transition-all focus-within:border-primary/40 focus-within:bg-white/[0.08]"
          >
            <Search className="h-5 w-5 shrink-0 text-stone-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-auto flex-1 border-0 bg-transparent p-0 text-base text-white shadow-none placeholder:text-stone-600 focus-visible:ring-0 md:text-lg"
              placeholder="Tell us what kind of work you're looking for…"
            />
            <Button className="shrink-0 rounded-xl px-6">
              Find My Best Matches
            </Button>
          </motion.div>

          {/* Prompt chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.4 }}
            className="mt-4 flex flex-wrap justify-center gap-2"
          >
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setQuery(prompt)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-stone-400 transition hover:border-primary/30 hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Stats row — bottom of hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.45 }}
          className="relative mt-16 grid w-full max-w-4xl grid-cols-2 divide-x divide-white/10 border-t border-white/10 md:grid-cols-4"
        >
          {[
            { label: "Candidates placed",    value: "1,200+" },
            { label: "Typical monthly roles", value: "$800–$2,500" },
            { label: "Global client markets", value: "US · AU · UK" },
            { label: "Hiring speed",          value: "3–10 days" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-1 px-4 py-6 text-center">
              <span className="text-2xl font-black text-white md:text-3xl">{value}</span>
              <span className="text-[11px] text-stone-500">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-8 w-px bg-gradient-to-b from-transparent to-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Discover</span>
          </div>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          PROFILE STRENGTH — warm cream band
      ════════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 md:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 items-center gap-4">
              <p className="text-sm font-bold text-stone-800">Profile strength</p>
              <div className="flex-1 max-w-48">
                <Progress value={profileStrength} className="h-1.5" />
              </div>
              <span className="text-sm font-black text-primary">{profileStrength}%</span>
            </div>
            <p className="text-xs text-stone-400">Complete your profile to unlock better matches</p>
            <Button variant="outline" size="sm" className="rounded-lg">Browse Roles</Button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ROLES — filter tabs + accordion rows
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-0 py-16 md:py-24">
        {/* Section header */}
        <div className="mb-10 px-6 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-stone-400">
                Top matches for you
              </p>
              <h2 className="text-4xl font-black tracking-tight text-stone-950 md:text-5xl">
                Roles that feel more<br className="hidden md:block" /> like opportunities.
              </h2>
              <p className="mt-3 max-w-lg text-stone-500">
                Designed to reduce random scrolling and help applicants focus on roles that fit their pay goals, schedule, and strengths.
              </p>
            </div>
            <p className="text-sm font-semibold text-stone-400">
              {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {/* Filter tabs */}
          <div className="mt-8 flex flex-wrap gap-6">
            {[
              { label: "Earn", options: ["Any pay", "$800+", "$1,000+", "$1,500+"],      state: earning,   set: setEarning },
              { label: "Schedule", options: ["All schedules", "Day shift", "Night shift", "Flexible"], state: schedule, set: setSchedule },
              { label: "Type", options: ["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"], state: kind, set: setKind },
            ].map((group) => (
              <div key={group.label} className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400">{group.label}</span>
                <div className="flex flex-wrap gap-1">
                  {group.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => group.set(opt)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                        group.state === opt
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Accordion role list */}
        <div className="border-t border-stone-200">
          <AnimatePresence>
            {filteredRoles.length === 0 ? (
              <div className="px-6 py-14 text-center md:px-8">
                <Search className="mx-auto mb-3 h-8 w-8 text-stone-300" />
                <p className="text-sm text-stone-400">No roles match your filters. Try adjusting your search.</p>
              </div>
            ) : (
              filteredRoles.map((role, i) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  index={i}
                  isOpen={openRoleId === role.id}
                  onToggle={() => setOpenRoleId(openRoleId === role.id ? null : role.id)}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          WHY ONSPOT — staggered feature blocks, alternating layout
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-24">
          {/* Header */}
          <div className="mb-16 grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-stone-400">
                Why OnSpot
              </p>
              <h2 className="text-4xl font-black leading-tight tracking-tight text-stone-950 md:text-5xl">
                More than listings.<br />Better matching.<br />Better outcomes.
              </h2>
            </div>
            <div className="flex items-end">
              <p className="text-stone-500 leading-7">
                This page is built for applicants, not for recruiters. The experience is designed to feel guided, high-trust, and momentum-driven from first click to application.
              </p>
            </div>
          </div>

          {/* Alternating staggered feature blocks */}
          <div className="space-y-5">
            {whyFeatures.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className={`flex items-center gap-8 rounded-2xl border border-stone-100 bg-stone-50 p-6 md:p-8 ${
                  i % 2 !== 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Icon + number */}
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-950 text-white">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black text-stone-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-xl font-black text-stone-950">{item.title}</h3>
                  <p className="mt-2 text-stone-500 leading-6">{item.copy}</p>
                </div>

                {/* Right accent bar */}
                <div className="hidden w-1.5 self-stretch rounded-full bg-primary/20 md:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          STORIES — large editorial, outcome-forward with warm accents
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-200 bg-[#F7F4EF]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-24">
          <div className="mb-12">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-stone-400">
              Proof it works
            </p>
            <h2 className="text-4xl font-black tracking-tight text-stone-950 md:text-5xl">
              Applicant stories that<br className="hidden md:block" /> create trust instantly.
            </h2>
            <p className="mt-2 text-sm text-stone-400">Use real placement stories here once approved.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {stories.map((story, i) => (
              <motion.div
                key={story.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white"
              >
                {/* Outcome header — warm dark */}
                <div className="bg-stone-950 px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Outcome</p>
                  <p className="mt-1 text-xl font-black text-white leading-tight">{story.outcome}</p>
                </div>

                {/* Quote body */}
                <div className="flex flex-1 flex-col gap-5 p-6">
                  <div className="flex gap-0.5 text-primary">
                    {[0,1,2,3,4].map((s) => (
                      <Star key={s} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="flex-1 text-base leading-8 text-stone-700">"{story.quote}"</p>
                  <div className="flex items-center gap-3 border-t border-stone-100 pt-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                      {story.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{story.name}</p>
                      <p className="text-xs text-stone-400">{story.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          CTA — editorial full-bleed, warm on dark
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-20">
          <div className="overflow-hidden rounded-3xl bg-[#1C1917]">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">

              {/* Left — headline + CTAs */}
              <div className="relative overflow-hidden px-8 py-14 md:px-14 md:py-16">
                <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
                <div className="relative">
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-stone-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Roles fill fast
                  </div>
                  <h2 className="max-w-md text-4xl font-black leading-tight text-white md:text-5xl">
                    Your next opportunity is already here. Take the step.
                  </h2>
                  <p className="mt-5 max-w-md text-stone-400 leading-7">
                    New roles are added regularly. Strong applicants move faster. Start with a quick application, then complete your profile to improve your match quality.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button className="rounded-xl bg-white px-8 text-stone-900 hover:bg-white/90">
                      Start Matching
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl border-white/15 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
                    >
                      Upload Resume
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right — numbered steps, warm accent bg */}
              <div className="border-t border-white/5 bg-[#252220] px-8 py-14 md:border-l md:border-t-0 md:px-10 md:py-16">
                <p className="mb-8 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-500">
                  How it works
                </p>
                <div className="space-y-6">
                  {ctaSteps.map((step, i) => (
                    <div key={step} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-black text-primary">
                        {i + 1}
                      </div>
                      <p className="pt-1 text-sm leading-6 text-stone-300">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
