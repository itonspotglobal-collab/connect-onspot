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

// ─── Static data ─────────────────────────────────────────────────────────────

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

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ─── JobCard ──────────────────────────────────────────────────────────────────
function JobCard({ role }: { role: typeof roles[number] }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="h-full"
    >
      <Card className="group h-full overflow-hidden rounded-3xl border-slate-200 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_56px_rgba(71,78,173,0.13)]">
        <CardContent className="flex h-full flex-col p-6">

          {/* Header: badges + match score */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Badge className="rounded-full bg-primary px-3 py-1 text-white">
                  {role.demand}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {role.speed}
                </Badge>
              </div>
              <h3 className="text-lg font-bold leading-snug tracking-tight text-slate-900">
                {role.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{role.hook}</p>
            </div>
            {/* Match score badge */}
            <div className="shrink-0 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Match
              </div>
              <div className="text-xl font-bold text-slate-900">{role.fit}%</div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { Icon: DollarSign, label: "Monthly pay", value: role.pay },
              { Icon: Clock3,     label: "Schedule",    value: role.shift },
              { Icon: Globe2,     label: "Market",      value: role.market },
              { Icon: BriefcaseBusiness, label: "Category", value: role.category },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>

          {/* Why you're a fit */}
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-primary" />
              Why you're a fit
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{role.why}</p>
          </div>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {role.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button className="rounded-full px-5" size="sm">
              Apply in 30 seconds
            </Button>
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              View details <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── FilterGroup ──────────────────────────────────────────────────────────────
function FilterGroup({
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
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              value === option
                ? "bg-primary text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
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

  // ── Filtering logic (unchanged) ──────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        {/* Gradient wash */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.12),transparent_28%),radial-gradient(circle_at_80%_0%,hsl(var(--primary)/0.08),transparent_24%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-10 md:px-8 md:pb-24 md:pt-14">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">

            {/* Left column */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge
                  variant="secondary"
                  className="mb-5 rounded-full px-4 py-1.5 text-sm font-medium"
                >
                  Find work with global companies hiring now
                </Badge>

                <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-950 md:text-[3.5rem] md:leading-[1.07]">
                  Find work that pays well —{" "}
                  <span className="text-primary">and moves you forward.</span>
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                  Get matched to premium remote opportunities across admin, support, finance, sales, marketing, and operations. Faster, smarter, and more human than a typical job board.
                </p>
              </motion.div>

              {/* Search card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-8 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_80px_rgba(71,78,173,0.10)]"
              >
                <div className="flex items-start gap-3 rounded-[22px] border border-slate-100 bg-slate-50 p-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Smart match input
                    </div>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-auto border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-lg"
                      placeholder="Tell us what kind of work you're looking for…"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setQuery(prompt)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-primary/30 hover:text-primary"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                  <Button className="rounded-full px-6">
                    Find My Best Matches
                  </Button>
                  <Button variant="outline" className="rounded-full px-6">
                    Browse Roles
                  </Button>
                </div>
              </motion.div>

              {/* Stat pills */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatPill icon={Users}    label="Candidates placed" value="1,200+" />
                <StatPill icon={DollarSign} label="Typical roles" value="$800–$2,500/mo" />
                <StatPill icon={Globe2}   label="Client markets" value="US · AU · UK" />
                <StatPill icon={Zap}      label="Hiring speed" value="3–10 days" />
              </div>
            </div>

            {/* Right column — live preview panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
            >
              <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
                {/* Panel header */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Live preview
                    </p>
                    <p className="mt-1 text-lg font-bold">Your best opportunities</p>
                  </div>
                  <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                    12 matches found
                  </Badge>
                </div>

                {/* Mini role cards */}
                <div className="space-y-2.5">
                  {roles.slice(0, 3).map((role, index) => (
                    <motion.div
                      key={role.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + index * 0.1, duration: 0.35 }}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{role.title}</span>
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {role.fit}% match
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {role.pay} · {role.shift} · {role.market}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-700">
                            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                            {role.why}
                          </div>
                        </div>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Profile strength card */}
                <div className="mt-4 rounded-2xl bg-slate-950 p-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                        Profile strength
                      </p>
                      <p className="mt-1 text-base font-semibold leading-snug">
                        Complete your profile to unlock better matches
                      </p>
                    </div>
                    <div className="shrink-0 text-2xl font-bold">{profileStrength}%</div>
                  </div>
                  <Progress value={profileStrength} className="mt-4 h-1.5" />
                  <p className="mt-3 text-xs leading-5 text-white/60">
                    Add your resume, work history, and preferred schedule to improve match quality.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Roles section ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">

        {/* Section header + filters */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <Badge className="mb-3 rounded-full bg-slate-900 text-white hover:bg-slate-900">
              Top matches for you
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Roles that feel more like opportunities.
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Designed to reduce random scrolling and help applicants focus on roles that fit their pay goals, schedule, and strengths.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col xl:flex-row">
            <FilterGroup
              label="How much do you want to earn?"
              options={["Any pay", "$800+", "$1,000+", "$1,500+"]}
              value={earning}
              onChange={setEarning}
            />
            <FilterGroup
              label="What schedule works for you?"
              options={["All schedules", "Day shift", "Night shift", "Flexible"]}
              value={schedule}
              onChange={setSchedule}
            />
            <FilterGroup
              label="What type of work do you enjoy?"
              options={["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"]}
              value={kind}
              onChange={setKind}
            />
          </div>
        </div>

        {/* Role cards grid */}
        {filteredRoles.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {filteredRoles.map((role) => (
              <JobCard key={role.id} role={role} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-muted-foreground">
            <Search className="mx-auto mb-3 h-8 w-8 opacity-30" />
            <p className="text-sm">No roles match your current filters. Try adjusting your search or filter selections.</p>
          </div>
        )}
      </section>

      {/* ── Why OnSpot ───────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Badge
                className="mb-4 rounded-full bg-primary/10 text-primary hover:bg-primary/10"
              >
                Why OnSpot
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                More than listings. Better matching. Better outcomes.
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                This page is built for applicants, not for recruiters. The experience is designed to feel guided, high-trust, and momentum-driven from first click to application.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {whyFeatures.map((item) => (
                <Card
                  key={item.title}
                  className="rounded-3xl border-slate-200 bg-white shadow-sm hover-elevate transition-all duration-300"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Applicant stories ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <Badge className="mb-4 rounded-full bg-slate-900 text-white hover:bg-slate-900">
              Proof it works
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Applicant stories that create trust instantly.
            </h2>
          </div>
          <p className="hidden text-sm text-muted-foreground md:block">
            Use real placement stories here once approved.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {stories.map((story) => (
            <Card
              key={story.name}
              className="rounded-3xl border-slate-200 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)] hover-elevate transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-0.5 text-primary">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-base leading-7 text-slate-700">"{story.quote}"</p>
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="font-semibold text-slate-900">{story.name}</p>
                  <p className="text-sm text-muted-foreground">{story.role}</p>
                  <span className="mt-2 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {story.outcome}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-20 md:px-8 md:pb-28">
        <div className="overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#111827,hsl(var(--primary)/0.94))] p-8 text-white shadow-[0_30px_100px_hsl(var(--primary)/0.22)] md:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm backdrop-blur">
                Roles fill fast
              </div>
              <h2 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl md:leading-[1.05]">
                Your next opportunity is already here. Take the step.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 md:text-lg">
                New roles are added regularly. Strong applicants move faster. Start with a quick application, then complete your profile to improve your match quality.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-white px-6 text-slate-900 hover:bg-white/90"
                >
                  Start Matching
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  Upload Resume
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {ctaSteps.map((step) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                  <span className="text-sm md:text-base">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
