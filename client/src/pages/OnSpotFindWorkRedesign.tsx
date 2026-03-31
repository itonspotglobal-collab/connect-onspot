import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// ─── StatPill (kept, used in hero right panel) ───────────────────────────────
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

// ─── Featured role card (first result, full-width, elevated) ─────────────────
function FeaturedRoleCard({ role }: { role: typeof roles[number] }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-[#1e2057] to-slate-900 p-8 text-white shadow-[0_32px_80px_rgba(71,78,173,0.22)] md:p-10">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary/30 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-primary/10 blur-[80px]" />

        <div className="relative grid gap-8 md:grid-cols-[1fr_auto]">
          {/* Left content */}
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                {role.demand}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
                {role.speed}
              </span>
              <span className="ml-auto rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
                Top match
              </span>
            </div>

            <h3 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">
              {role.title}
            </h3>
            <p className="mt-2 text-lg text-white/60">{role.hook}</p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { Icon: DollarSign, v: role.pay,    l: "Pay" },
                { Icon: Clock3,     v: role.shift,  l: "Schedule" },
                { Icon: Globe2,     v: role.market, l: "Market" },
                { Icon: BriefcaseBusiness, v: role.category, l: "Type" },
              ].map(({ Icon, v, l }) => (
                <div key={l} className="rounded-xl bg-white/[0.07] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                    <Icon className="h-3 w-3" />{l}
                  </div>
                  <div className="mt-1 text-sm font-bold">{v}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-white/70">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Why you're a fit
              </div>
              <p className="text-sm leading-6 text-white/80">{role.why}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {role.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button className="rounded-full bg-white px-6 text-slate-900 hover:bg-white/90">
                Apply in 30 seconds
              </Button>
              <button className="inline-flex items-center gap-1.5 text-sm font-medium text-white/60 transition hover:text-white">
                View details <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right: match dial */}
          <div className="flex flex-col items-center justify-center gap-2 md:w-36">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary/30 bg-primary/10">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${role.fit * 3.6}deg, transparent 0deg)`,
                  opacity: 0.3,
                }}
              />
              <div className="relative text-center">
                <div className="text-3xl font-black text-white">{role.fit}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">% fit</div>
              </div>
            </div>
            <p className="text-center text-xs text-white/40 max-w-[6rem]">Your highest match</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Secondary role card ──────────────────────────────────────────────────────
function SecondaryRoleCard({ role, index }: { role: typeof roles[number]; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_8px_40px_rgba(71,78,173,0.12)]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge className="rounded-full bg-primary px-3 py-1 text-white">
                {role.demand}
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {role.speed}
              </Badge>
            </div>
            <h3 className="text-lg font-bold leading-snug text-slate-900">{role.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{role.hook}</p>
          </div>
          {/* Match score */}
          <div className="shrink-0 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Match</div>
            <div className="text-2xl font-black text-slate-900">{role.fit}%</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {[
            { Icon: DollarSign, v: role.pay,    l: "Monthly pay" },
            { Icon: Clock3,     v: role.shift,  l: "Schedule" },
            { Icon: Globe2,     v: role.market, l: "Market" },
            { Icon: BriefcaseBusiness, v: role.category, l: "Category" },
          ].map(({ Icon, v, l }) => (
            <div key={l} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Icon className="h-3.5 w-3.5" />{l}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{v}</div>
            </div>
          ))}
        </div>

        {/* Why fit */}
        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Why you're a fit
          </div>
          <p className="text-xs leading-5 text-slate-500">{role.why}</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {role.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Button size="sm" className="rounded-full px-5">
            Apply in 30 seconds
          </Button>
          <button className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-primary">
            View details <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Inline filter chip bar ───────────────────────────────────────────────────
function FilterChipGroup({
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
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-semibold text-slate-400">{label}</span>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
            value === opt
              ? "bg-primary text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnSpotFindWorkRedesign() {
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

  const [featured, ...secondary] = filteredRoles;

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-slate-900">

      {/* ════════════════════════════════════════════════════════════════════
          HERO — split-screen: dark left / layered right
      ════════════════════════════════════════════════════════════════════ */}
      <section className="grid min-h-[90vh] lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_520px]">

        {/* Left: deep indigo hero pane */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-[#0d0f2e] px-8 py-14 md:px-14 md:py-20">
          {/* Layered gradients */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(71,78,173,0.45),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.2),transparent_50%)]" />
          {/* Dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          {/* Content */}
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/70 backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Find work with global companies hiring now
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06 }}
              className="max-w-xl text-5xl font-black leading-[1.04] tracking-tight text-white md:text-6xl xl:text-7xl"
            >
              Find work that pays well —
              <span className="block text-primary"> and moves you forward.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-6 max-w-lg text-base leading-8 text-slate-400"
            >
              Get matched to premium remote opportunities across admin, support, finance, sales, marketing, and operations. Faster, smarter, and more human than a typical job board.
            </motion.p>

            {/* Intelligent match assistant input */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-10"
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary/80">
                Match assistant
              </p>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur ring-0 transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-auto flex-1 border-0 bg-transparent p-0 text-base text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
                  placeholder="Tell us what kind of work you're looking for…"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setQuery(prompt)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition hover:border-primary/30 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="rounded-full px-7">
                  Find My Best Matches
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  Browse Roles
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Profile strength at bottom */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="relative mt-14 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Complete your profile to unlock better matches</p>
              <span className="text-xl font-black text-primary">{profileStrength}%</span>
            </div>
            <Progress value={profileStrength} className="h-1.5 bg-white/10" />
            <p className="mt-2 text-xs text-slate-500">Add your resume, work history, and preferred schedule to improve match quality.</p>
          </motion.div>
        </div>

        {/* Right: elevated trust panel */}
        <div className="flex flex-col justify-center gap-6 bg-white px-8 py-14 md:px-10 lg:border-l lg:border-slate-100">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
              Live preview
            </p>
            <h2 className="text-2xl font-black text-slate-900">Your best opportunities</h2>
            <Badge className="mt-2 rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
              12 matches found
            </Badge>
          </div>

          {/* Mini role previews */}
          <div className="space-y-3">
            {roles.slice(0, 3).map((role, i) => (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-primary/20 hover:bg-primary/[0.02]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">
                  {role.fit}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{role.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{role.pay} · {role.market}</p>
                  <p className="mt-1 text-xs text-slate-400 leading-5">{role.why}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
              </motion.div>
            ))}
          </div>

          {/* Stats woven in */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {[
              { icon: Users,      label: "Placed",  value: "1,200+" },
              { icon: DollarSign, label: "Pay range", value: "$800–$2.5K" },
              { icon: Globe2,     label: "Markets",  value: "US · AU · UK" },
              { icon: Zap,        label: "Speed",    value: "3–10 days" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">{label}</p>
                  <p className="text-sm font-bold text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FILTER BAR — productized horizontal, sticky-style
      ════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl overflow-x-auto px-6 md:px-8">
          <div className="flex items-center gap-6 py-3">
            <span className="shrink-0 text-sm font-bold text-slate-800">Filter:</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <FilterChipGroup
                label="Earn"
                options={["Any pay", "$800+", "$1,000+", "$1,500+"]}
                value={earning}
                onChange={setEarning}
              />
              <FilterChipGroup
                label="Schedule"
                options={["All schedules", "Day shift", "Night shift", "Flexible"]}
                value={schedule}
                onChange={setSchedule}
              />
              <FilterChipGroup
                label="Type"
                options={["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"]}
                value={kind}
                onChange={setKind}
              />
            </div>
            <span className="ml-auto shrink-0 text-sm text-slate-400">
              {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ROLES — featured first, then 2-col secondary grid
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
        <div className="mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
            Top matches for you
          </p>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Roles that feel more like opportunities.
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Designed to reduce random scrolling and help applicants focus on roles that fit their pay goals, schedule, and strengths.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {filteredRoles.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center"
            >
              <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">No roles match your filters. Try adjusting your search.</p>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Featured top match */}
              {featured && <FeaturedRoleCard role={featured} />}

              {/* Secondary grid */}
              {secondary.length > 0 && (
                <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {secondary.map((role, i) => (
                    <SecondaryRoleCard key={role.id} role={role} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          WHY ONSPOT — horizontal numbered timeline, product narrative
      ════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-24">
          {/* Header */}
          <div className="mb-14 max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Why OnSpot
            </p>
            <h2 className="text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
              More than listings.<br />Better matching. Better outcomes.
            </h2>
            <p className="mt-4 text-slate-500">
              This page is built for applicants, not for recruiters. The experience is designed to feel guided, high-trust, and momentum-driven from first click to application.
            </p>
          </div>

          {/* Feature timeline */}
          <div className="relative grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {/* Connector line */}
            <div className="absolute left-0 top-6 hidden h-px w-full bg-slate-100 lg:block" />

            {whyFeatures.map((item, i) => (
              <div key={item.title} className="relative">
                {/* Step number */}
                <div className="relative z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-[0_0_0_4px_#FAFAF9,0_0_0_6px_#e2e8f0]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          STORIES — case-study layout, outcome-forward
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-100 bg-[#FAFAF9]">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-24">
          <div className="mb-12">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
              Proof it works
            </p>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
              Applicant stories that create trust instantly.
            </h2>
            <p className="mt-2 text-sm text-slate-400">Use real placement stories here once approved.</p>
          </div>

          <div className="grid gap-0 divide-y divide-slate-200 md:divide-y-0 lg:grid-cols-3 lg:divide-x">
            {stories.map((story, i) => (
              <motion.div
                key={story.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex flex-col gap-5 px-0 py-8 md:py-0 lg:px-10 first:lg:pl-0 last:lg:pr-0"
              >
                {/* Outcome as hero number */}
                <div className="rounded-2xl bg-slate-950 p-5 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Outcome</p>
                  <p className="mt-1 text-2xl font-black leading-tight">{story.outcome}</p>
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 text-primary">
                  {[0,1,2,3,4].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-current" />
                  ))}
                </div>

                {/* Quote */}
                <p className="flex-1 text-base leading-8 text-slate-700">"{story.quote}"</p>

                {/* Attribution */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                    {story.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{story.name}</p>
                    <p className="text-xs text-slate-400">{story.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          CTA — immersive, full-bleed with checklist + gradient
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d0f2e] via-[#1c1f5a] to-[#0d0f2e] px-8 py-16 text-white md:px-16 md:py-20">
            {/* Glows */}
            <div className="pointer-events-none absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-primary/30 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-16 right-0 h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />

            <div className="relative grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              {/* Left */}
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Roles fill fast
                </div>
                <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl xl:text-6xl">
                  Your next opportunity is already here. Take the step.
                </h2>
                <p className="mt-5 max-w-lg text-base leading-8 text-white/60">
                  New roles are added regularly. Strong applicants move faster. Start with a quick application, then complete your profile to improve your match quality.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button className="rounded-full bg-white px-8 text-slate-900 hover:bg-white/90">
                    Start Matching
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full border-white/15 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
                  >
                    Upload Resume
                  </Button>
                </div>
              </div>

              {/* Right: numbered checklist */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-white/40">How it works</p>
                <div className="space-y-4">
                  {ctaSteps.map((step, i) => (
                    <div key={step} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-xs font-black text-primary">
                        {i + 1}
                      </div>
                      <p className="pt-1 text-sm leading-6 text-white/80">{step}</p>
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
