import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, BriefcaseBusiness, Clock3, Globe2, ChevronRight, Star, ArrowRight, BadgeCheck, Filter, Zap, DollarSign, Building2, CheckCircle2, Users, Brain, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
    quote: "What stood out was the quality of opportunities. It didn’t feel like random applications anymore.",
    outcome: "Moved into an AU role",
  },
];

const prompts = [
  "Virtual assistant, night shift, $900+",
  "Customer support, remote, US client",
  "Accounting or finance role, day shift",
  "Social media assistant with flexible schedule",
];

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="rounded-full border border-white/15 bg-white/70 px-4 py-3 backdrop-blur dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#474ead]/10 text-[#474ead]">
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

function JobCard({ role }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="group h-full overflow-hidden rounded-3xl border-slate-200/70 bg-white/90 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur transition-all hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(71,78,173,0.14)] dark:border-white/10 dark:bg-white/[0.03]">
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge className="rounded-full bg-[#474ead] px-3 py-1 text-white hover:bg-[#474ead]">{role.demand}</Badge>
                <Badge variant="secondary" className="rounded-full">{role.speed}</Badge>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{role.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{role.hook}</p>
            </div>
            <div className="rounded-2xl border border-[#474ead]/15 bg-[#474ead]/5 px-3 py-2 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#474ead]">Match</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{role.fit}%</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-500"><DollarSign className="h-3.5 w-3.5" /> Monthly pay</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">{role.pay}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> Schedule</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">{role.shift}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-500"><Globe2 className="h-3.5 w-3.5" /> Market</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">{role.market}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-500"><BriefcaseBusiness className="h-3.5 w-3.5" /> Category</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">{role.category}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-[#474ead]" /> Why you’re a fit
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{role.why}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {role.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button className="rounded-full bg-[#474ead] px-5 text-white hover:bg-[#3d439c]">
              Apply in 30 seconds
            </Button>
            <button className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#474ead] dark:text-slate-300">
              View details <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function OnSpotFindWorkRedesign() {
  const [query, setQuery] = useState("Virtual assistant, night shift, $900+");
  const [schedule, setSchedule] = useState("All schedules");
  const [earning, setEarning] = useState("Any pay");
  const [kind, setKind] = useState("All work");
  const [profileStrength] = useState(68);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.12),transparent_32%),linear-gradient(to_bottom,#f8fafc,white)] text-slate-900 dark:bg-[#060816] dark:text-white">
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(71,78,173,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.12),transparent_24%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-10 md:px-8 md:pb-24 md:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Badge className="mb-5 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
                  Find work with global companies hiring now
                </Badge>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl md:leading-[1.04] dark:text-white">
                  Find work that pays well — and moves you forward.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg dark:text-slate-300">
                  Get matched to premium remote opportunities across admin, support, finance, sales, marketing, and operations. Faster, smarter, and more human than a typical job board.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-8 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_20px_80px_rgba(71,78,173,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#474ead] text-white">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="w-full">
                    <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Smart match input</div>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-auto border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-lg"
                      placeholder="Tell us what kind of work you’re looking for…"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setQuery(prompt)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-[#474ead]/30 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c]">
                    Find My Best Matches
                  </Button>
                  <Button variant="outline" className="rounded-full px-6">
                    Browse Roles
                  </Button>
                </div>
              </motion.div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatPill icon={Users} label="Candidates placed" value="1,200+" />
                <StatPill icon={DollarSign} label="Typical roles" value="$800–$2,500/mo" />
                <StatPill icon={Globe2} label="Client markets" value="US · AU · UK" />
                <StatPill icon={Zap} label="Hiring speed" value="3–10 days" />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="relative"
            >
              <div className="rounded-[32px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Live preview</div>
                    <div className="mt-1 text-lg font-semibold">Your best opportunities</div>
                  </div>
                  <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">12 matches found</Badge>
                </div>

                <div className="space-y-3">
                  {roles.slice(0, 3).map((role, index) => (
                    <motion.div
                      key={role.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + index * 0.1, duration: 0.35 }}
                      className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{role.title}</span>
                            <span className="rounded-full bg-[#474ead]/10 px-2 py-1 text-[11px] font-medium text-[#474ead]">{role.fit}% match</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{role.pay} · {role.shift} · {role.market}</div>
                          <div className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <Sparkles className="h-4 w-4 text-[#474ead]" /> {role.why}
                          </div>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 rounded-3xl bg-[#0f172a] p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/60">Profile strength</div>
                      <div className="mt-1 text-lg font-semibold">Complete your profile to unlock better matches</div>
                    </div>
                    <div className="text-2xl font-bold">{profileStrength}%</div>
                  </div>
                  <Progress value={profileStrength} className="mt-4 h-2" />
                  <div className="mt-3 text-sm text-white/70">Add your resume, work history, and preferred schedule to improve match quality.</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge className="mb-4 rounded-full bg-slate-900 text-white hover:bg-slate-900 dark:bg-white dark:text-slate-900">Top matches for you</Badge>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Roles that feel more like opportunities.</h2>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Designed to reduce random scrolling and help applicants focus on roles that fit their pay goals, schedule, and strengths.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              { label: "How much do you want to earn?", value: earning, options: ["Any pay", "$800+", "$1,000+", "$1,500+"] },
              { label: "What schedule works for you?", value: schedule, options: ["All schedules", "Day shift", "Night shift", "Flexible"] },
              { label: "What type of work do you enjoy?", value: kind, options: ["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"] },
            ].map((group, idx) => (
              <div key={group.label} className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><Filter className="h-3.5 w-3.5" /> {group.label}</div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const active = group.value === option;
                    const onClick = () => {
                      if (idx === 0) setEarning(option);
                      if (idx === 1) setSchedule(option);
                      if (idx === 2) setKind(option);
                    };
                    return (
                      <button
                        key={option}
                        onClick={onClick}
                        className={`rounded-full px-3 py-1.5 text-xs transition ${
                          active
                            ? "bg-[#474ead] text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {filteredRoles.map((role) => (
            <JobCard key={role.id} role={role} />
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Badge className="mb-4 rounded-full bg-[#474ead]/10 text-[#474ead] hover:bg-[#474ead]/10">Why OnSpot</Badge>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">More than listings. Better matching. Better outcomes.</h2>
              <p className="mt-4 max-w-xl text-slate-600 dark:text-slate-300">This page is built for applicants, not for recruiters. The experience is designed to feel guided, high-trust, and momentum-driven from first click to application.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
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
              ].map((item) => (
                <Card key={item.title} className="rounded-3xl border-slate-200/70 bg-white/90 dark:border-white/10 dark:bg-white/[0.03]">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#474ead]/10 text-[#474ead]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.copy}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <Badge className="mb-4 rounded-full bg-slate-900 text-white hover:bg-slate-900 dark:bg-white dark:text-slate-900">Proof it works</Badge>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Applicant stories that create trust instantly.</h2>
          </div>
          <div className="hidden text-sm text-slate-500 md:block">Use real placement stories here once approved.</div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {stories.map((story) => (
            <Card key={story.name} className="rounded-3xl border-slate-200/70 bg-white/90 shadow-[0_10px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03]">
              <CardContent className="p-6">
                <div className="mb-5 flex items-center gap-1 text-[#474ead]">
                  {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="text-base leading-7 text-slate-700 dark:text-slate-300">“{story.quote}”</p>
                <div className="mt-6 border-t border-slate-200/80 pt-4 dark:border-white/10">
                  <div className="font-semibold">{story.name}</div>
                  <div className="text-sm text-slate-500">{story.role}</div>
                  <div className="mt-2 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{story.outcome}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 md:px-8 md:pb-28">
        <div className="overflow-hidden rounded-[36px] border border-slate-200/70 bg-[linear-gradient(135deg,#111827,rgba(71,78,173,0.94))] p-8 text-white shadow-[0_30px_100px_rgba(71,78,173,0.25)] md:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm backdrop-blur">
                Roles fill fast
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl md:leading-[1.05]">
                Your next opportunity is already here. Take the step.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 md:text-lg">
                New roles are added regularly. Strong applicants move faster. Start with a quick application, then complete your profile to improve your match quality.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button className="rounded-full bg-white px-6 text-slate-900 hover:bg-white/90">
                  Start Matching
                </Button>
                <Button variant="outline" className="rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
                  Upload Resume
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                "Apply in 30 seconds",
                "Get matched to better-fit roles",
                "Complete your profile for stronger opportunities",
                "Stay visible for active hiring teams",
              ].map((step) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
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
