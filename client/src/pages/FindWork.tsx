import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, BriefcaseBusiness, Clock3, Globe2, ChevronRight, Star, ArrowRight, BadgeCheck, Filter, Zap, DollarSign, Building2, CheckCircle2, Users, Brain, TrendingUp, X, ListChecks, Maximize2, ChevronDown, MapPin, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Job } from "@shared/schema";
import { buildRateDisplay, getJobBadges, getTimeAgo } from "@/lib/jobUtils";

const APPLY_URL = "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true";

const roles = [
  {
    id: 1,
    title: "Executive Virtual Assistant",
    pay: "₱50,000–₱78,000/mo",
    shift: "Night shift",
    market: "US client",
    category: "Admin",
    demand: "High demand",
    speed: "Quick hire",
    fit: 92,
    hook: "Support a fast-moving founder and become a key operator.",
    why: "Strong fit for admin-heavy, client-facing candidates who want ownership and growth in a premium client environment.",
    tags: ["Remote", "Growth path", "Premium client"],
    overview: "A US-based founder scaling their business needs a sharp, proactive Executive VA to be the connective tissue that keeps everything moving — from inbox to special projects.",
    description: "You'll manage communications, scheduling, research, and critical projects that require judgment and trust. This isn't a basic admin role — it's a high-ownership position where you'll interact with clients, vendors, and leadership daily. You'll have visibility across the business and direct impact on how efficiently the founder operates.",
    responsibilities: [
      "Manage the founder's inbox, calendar, and scheduling across time zones",
      "Coordinate meetings, prepare agendas, and take minutes",
      "Conduct research and compile reports for decision-making",
      "Handle travel arrangements, bookings, and itineraries",
      "Manage CRM updates, follow-ups, and priority communications",
      "Draft and proofread emails, proposals, and presentations",
      "Track key deadlines and flag action items proactively",
    ],
    qualifications: [
      "2+ years as a VA, EA, or senior admin support role",
      "Excellent written and verbal English communication",
      "Proficient with Google Workspace, Notion, Slack, or similar tools",
      "Strong time management and attention to detail",
      "Ability to work night shift aligned with US business hours",
      "High degree of discretion and professionalism",
    ],
    preferredSkills: [
      "Experience supporting C-suite or founders in a startup environment",
      "Familiarity with CRM tools like HubSpot or GoHighLevel",
      "Experience with project management tools like Asana or ClickUp",
    ],
    benefits: [
      "₱50,000–₱78,000 per month — above-market compensation",
      "100% remote — work from anywhere in the Philippines",
      "Long-term engagement with a growth-oriented client",
      "Career development support and performance reviews",
      "Paid leave and Philippine public holiday recognition",
    ],
  },
  {
    id: 2,
    title: "Customer Support Specialist",
    pay: "₱45,000–₱67,000/mo",
    shift: "Night shift",
    market: "US client",
    category: "Support",
    demand: "Actively hiring",
    speed: "3–5 days",
    fit: 88,
    hook: "Join a scaling ecommerce brand with structured training.",
    why: "Great for strong communicators with service experience who want a well-supported, high-volume role.",
    tags: ["Remote", "Training provided", "High volume"],
    overview: "A fast-growing US ecommerce brand needs a dedicated Customer Support Specialist for inbound queries, order resolution, and delivering an exceptional customer experience.",
    description: "You'll be part of a structured support team with clear processes, escalation paths, and regular coaching. High-volume but highly organized — great for someone who thrives on people-first work with solid systems behind them. CSAT and resolution speed are the key metrics you'll own.",
    responsibilities: [
      "Respond to customer inquiries via email, chat, and ticketing systems",
      "Resolve order issues including refunds, replacements, and delivery disputes",
      "Maintain accurate case records in the CRM",
      "Identify recurring issues and escalate to the team lead",
      "Meet and exceed CSAT, response time, and resolution rate KPIs",
      "Collaborate with fulfillment and logistics teams on order investigations",
    ],
    qualifications: [
      "1+ year in customer service, support, or BPO environment",
      "Strong English written communication skills",
      "Experience with Zendesk, Freshdesk, or similar helpdesk tools",
      "Ability to work US night shift hours",
      "Fast typing speed with high accuracy",
      "Empathetic and patient under pressure",
    ],
    preferredSkills: [
      "Experience with ecommerce brands (Shopify, Amazon, etc.)",
      "Familiarity with Gorgias or Re:amaze",
      "Live chat or phone support experience",
    ],
    benefits: [
      "₱45,000–₱67,000 per month",
      "Structured onboarding and continuous training",
      "Remote work setup",
      "Performance bonuses for top CSAT scores",
      "Career pathway into senior support or team lead roles",
    ],
  },
  {
    id: 3,
    title: "Bookkeeper / Accounting Assistant",
    pay: "₱56,000–₱100,000/mo",
    shift: "Day shift",
    market: "AU client",
    category: "Finance",
    demand: "Above market pay",
    speed: "Priority role",
    fit: 84,
    hook: "Own reconciliations and reporting for a stable global business.",
    why: "Strong match for organized candidates with finance exposure who want stability and above-market pay.",
    tags: ["Remote", "Stable team", "Career track"],
    overview: "A well-established Australian business needs an experienced Bookkeeper to own day-to-day financial records, reconciliations, and reporting with clear accountability.",
    description: "You'll work closely with the finance lead and have full ownership of your accounts. Stable, long-term engagement with above-market compensation for candidates with solid accounting foundations. Day shift means a more normal schedule — a big quality-of-life advantage for the right candidate.",
    responsibilities: [
      "Perform daily bank reconciliations and transaction coding",
      "Manage accounts payable and receivable processes",
      "Prepare weekly and monthly financial reports",
      "Assist with payroll processing and superannuation compliance",
      "Maintain accurate records in Xero or MYOB",
      "Coordinate with the external accountant during year-end processes",
    ],
    qualifications: [
      "2+ years of bookkeeping or accounting assistant experience",
      "Proficiency with Xero, MYOB, or QuickBooks",
      "Strong attention to detail and numerical accuracy",
      "Understanding of Australian GST and BAS reporting preferred",
      "Ability to work AU-aligned day shift hours",
      "Excellent communication for remote coordination",
    ],
    preferredSkills: [
      "CPA or accounting degree/diploma",
      "Experience working with AU-based clients",
      "Familiarity with Australian payroll standards",
    ],
    benefits: [
      "₱56,000–₱100,000 per month — above-market pay",
      "Stable, long-term engagement with a reputable AU business",
      "Day shift — great work-life balance",
      "Professional development and structured review cycle",
      "Paid leave and Philippine public holiday recognition",
    ],
  },
  {
    id: 4,
    title: "Sales Development Representative",
    pay: "₱62,000–₱112,000/mo",
    shift: "Night shift",
    market: "US client",
    category: "Sales",
    demand: "Fast growth",
    speed: "Urgent",
    fit: 86,
    hook: "Book meetings, drive pipeline, and earn in a performance culture.",
    why: "Best for confident communicators who like targets, want commission upside, and are ready for a B2B sales career.",
    tags: ["Commission upside", "Remote", "B2B"],
    overview: "A high-growth B2B company in the US needs a motivated SDR to drive top-of-funnel pipeline through outbound prospecting, cold outreach, and lead qualification.",
    description: "This role offers base plus performance commission — making it one of the best-paying opportunities for strong communicators in the Philippines. You'll work in a structured sales environment with clear targets, regular coaching, and real earning potential based on what you close.",
    responsibilities: [
      "Execute outbound prospecting via cold calls, emails, and LinkedIn",
      "Qualify inbound leads against defined ICP criteria",
      "Book discovery calls for Account Executives",
      "Maintain accurate activity logs in the CRM (Salesforce or HubSpot)",
      "Meet and exceed monthly meeting booked targets",
      "Research target accounts and personalize outreach messaging",
    ],
    qualifications: [
      "1+ year in B2B sales, telemarketing, or appointment setting",
      "Confident, clear spoken and written English",
      "Comfortable with cold calling and rejection",
      "Familiarity with CRM tools (Salesforce, HubSpot)",
      "Goal-oriented mindset with demonstrated target achievement",
      "Ability to work US business hours (night shift in PH)",
    ],
    preferredSkills: [
      "SaaS or technology sales experience",
      "Familiarity with sales tools like Outreach or Apollo",
      "Experience with structured methodologies (SPIN, MEDDIC)",
    ],
    benefits: [
      "Base: ₱62,000–₱84,000/month + uncapped commission",
      "Total OTE up to ₱112,000/month",
      "Remote work, night shift",
      "Sales training and B2B career development",
      "Regular team incentives and recognition programs",
    ],
  },
  {
    id: 5,
    title: "Content & Social Media Assistant",
    pay: "₱48,000–₱73,000/mo",
    shift: "Flexible",
    market: "UK client",
    category: "Marketing",
    demand: "Creative role",
    speed: "Open now",
    fit: 81,
    hook: "Create content systems for a modern digital brand.",
    why: "Great fit for organized creatives with execution skills who want to build their portfolio with a quality UK brand.",
    tags: ["Remote", "Portfolio builder", "Flexible"],
    overview: "A UK-based digital brand needs a Content & Social Media Assistant to support their growing content operation — producing, scheduling, and tracking across platforms.",
    description: "You'll work closely with the marketing lead to build consistent, high-quality content output across LinkedIn, Instagram, and other key channels. Strong creative direction is provided — your job is to execute it reliably, build efficient content systems, and bring your own ideas when you see opportunities.",
    responsibilities: [
      "Create and schedule content for LinkedIn, Instagram, and Facebook",
      "Draft captions, carousels, and short-form written content",
      "Repurpose long-form content (blogs, videos) into social assets",
      "Manage a content calendar and maintain publishing consistency",
      "Track engagement metrics and prepare monthly performance reports",
      "Assist with basic graphic design using Canva or Adobe Express",
    ],
    qualifications: [
      "1+ year in social media management, content creation, or digital marketing",
      "Strong written English with a clear, engaging voice",
      "Proficiency with Canva and scheduling tools like Buffer or Later",
      "Understanding of social media best practices",
      "Organized, proactive, and able to work independently",
      "Portfolio of past content or examples required",
    ],
    preferredSkills: [
      "Experience with UK brands or audiences",
      "Basic video editing skills (CapCut, Premiere Rush)",
      "Familiarity with SEO content principles",
    ],
    benefits: [
      "₱48,000–₱73,000 per month",
      "Flexible schedule — some UK timezone alignment",
      "Work with a forward-thinking creative brand",
      "Portfolio-worthy work and brand exposure",
      "Remote, long-term engagement",
    ],
  },
  {
    id: 6,
    title: "Operations Coordinator",
    pay: "₱56,000–₱84,000/mo",
    shift: "Day shift",
    market: "AU client",
    category: "Operations",
    demand: "Actively hiring",
    speed: "7 days",
    fit: 79,
    hook: "Keep projects, people, and systems moving without chaos.",
    why: "Excellent for detail-driven candidates who thrive on structure and want high-visibility cross-functional work.",
    tags: ["Remote", "Process-driven", "Cross-functional"],
    overview: "An Australian company with a multi-functional remote team needs an Operations Coordinator to manage workflows, track deliverables, and keep cross-functional projects on schedule.",
    description: "You'll be the operational backbone — the person who ensures nothing falls through the cracks. This is a high-visibility role with access to leadership and real influence over how the team functions. Ideal for detail-driven professionals who love systems, structure, and helping teams perform at their best.",
    responsibilities: [
      "Coordinate project timelines, milestones, and deliverables across teams",
      "Maintain and improve internal SOPs and documentation",
      "Manage team task boards in ClickUp, Asana, or Monday.com",
      "Prepare status updates and operational reports for leadership",
      "Identify bottlenecks and propose process improvements",
      "Assist with onboarding coordination for new team members",
    ],
    qualifications: [
      "2+ years in operations, project coordination, or similar role",
      "Experience with project management tools (ClickUp, Asana, Notion)",
      "Excellent organizational and prioritization skills",
      "Clear written communication for async, remote environments",
      "Ability to work AU-aligned day shift hours",
      "Proven ability to manage multiple workstreams simultaneously",
    ],
    preferredSkills: [
      "Experience with process documentation and SOP creation",
      "Familiarity with remote-first team cultures",
      "PMP, CAPM, or similar project management certification",
    ],
    benefits: [
      "₱56,000–₱84,000 per month",
      "Day shift — AU time zone aligned",
      "Stable, long-term remote engagement",
      "High-visibility role with access to leadership",
      "Opportunities to grow into a senior ops or team lead role",
    ],
  },
];

const trustStats = [
  { label: "Candidates placed", value: "1,200+" },
  { label: "Typical monthly roles", value: "₱45,000–₱140,000/mo" },
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
  "Virtual assistant, night shift, ₱50,000+",
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

// ─── Role Detail Modal ─────────────────────────────────────────────────────
// tab "summary" = compact highlights; tab "full" = complete posting
// z-[200] clears TopNavigation z-50

type Role = (typeof roles)[number];

function RoleModal({ role, onClose }: { role: Role; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function openFullPage() {
    window.open(`/find-work/job/${role.id}`, "_blank", "noopener,noreferrer");
  }

  const BulletRow = ({ text, color }: { text: string; color: string }) => (
    <li className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
      <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
      {text}
    </li>
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      aria-modal="true"
      role="dialog"
      aria-label={role.title}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 flex w-[95vw] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.32)] dark:bg-[#0f172a] sm:w-[92vw] sm:rounded-[28px] lg:w-[880px] xl:w-[980px]"
        style={{ maxHeight: "92vh" }}
      >
        {/* ── HEADER ── */}
        <div className="relative shrink-0 overflow-hidden bg-[#0f172a] px-6 pb-6 pt-5 md:px-10">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#474ead]/30 blur-[70px]" />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#474ead] px-3 py-1 text-[11px] font-bold text-white">{role.demand}</span>
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] text-white/60">{role.speed}</span>
            <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-400">{role.fit}% match</span>
          </div>

          <div className="relative">
            <h2 className="text-2xl font-bold leading-tight text-white md:text-[28px]">{role.title}</h2>
            <p className="mt-1.5 text-sm text-slate-400">{role.hook}</p>
          </div>

          <div className="relative mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
            <DollarSign className="h-4 w-4 text-[#474ead]" />
            <div>
              <div className="text-[10px] text-white/40">Monthly salary (PHP)</div>
              <div className="text-sm font-bold text-white">{role.pay}</div>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2 sm:grid-cols-3 md:flex md:gap-3">
            {[
              { Icon: Clock3,            label: "Schedule",  value: role.shift    },
              { Icon: Globe2,            label: "Market",    value: role.market   },
              { Icon: BriefcaseBusiness, label: "Category",  value: role.category },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/[0.06] p-2.5 md:flex-1">
                <div className="flex items-center gap-1 text-[10px] text-white/40">
                  <Icon className="h-2.5 w-2.5" />{label}
                </div>
                <div className="mt-1 text-xs font-bold text-white/90">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-white/10">

          {/* Why you're a fit */}
          <div className="bg-[#474ead]/[0.04] px-6 py-5 md:px-10">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#474ead]" />
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Why you're a fit</p>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{role.why}</p>
              </div>
            </div>
          </div>

          {/* Overview */}
          <div className="px-6 py-5 md:px-10">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Overview</p>
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{role.overview}</p>
          </div>

          {/* Responsibilities preview — first 3 */}
          <div className="px-6 py-5 md:px-10">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-900/30">
                <ListChecks className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">Responsibilities</h3>
            </div>
            <ul className="space-y-2.5">
              {role.responsibilities.slice(0, 3).map((item, i) => (
                <BulletRow key={i} text={item} color="bg-blue-400" />
              ))}
            </ul>
            {role.responsibilities.length > 3 && (
              <button onClick={openFullPage} className="mt-3 text-xs font-semibold text-[#474ead] underline-offset-2 hover:underline">
                +{role.responsibilities.length - 3} more — view full posting
              </button>
            )}
          </div>

          {/* Qualifications preview — first 3 */}
          <div className="px-6 py-5 md:px-10">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">Qualifications</h3>
            </div>
            <ul className="space-y-2.5">
              {role.qualifications.slice(0, 3).map((item, i) => (
                <BulletRow key={i} text={item} color="bg-emerald-500" />
              ))}
            </ul>
            {role.qualifications.length > 3 && (
              <button onClick={openFullPage} className="mt-3 text-xs font-semibold text-[#474ead] underline-offset-2 hover:underline">
                +{role.qualifications.length - 3} more — view full posting
              </button>
            )}
          </div>

          {/* Tags */}
          <div className="px-6 py-5 md:px-10">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Tags</p>
            <div className="flex flex-wrap gap-2">
              {role.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0f172a] md:px-10">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d439c]"
              onClick={() => window.open(APPLY_URL, "_blank")}
            >
              Apply Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button variant="outline" className="rounded-full" onClick={openFullPage}>
              <Maximize2 className="mr-2 h-4 w-4" />
              Show More
            </Button>

            <Button variant="ghost" className="rounded-full" onClick={onClose}>Close</Button>

            <span className="ml-auto hidden text-xs text-slate-400 sm:block">OnSpot Global · {role.market}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function JobCard({ role, onViewDetails }: { role: Role; onViewDetails: (r: Role) => void }) {
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
            <Button
              className="rounded-full bg-[#474ead] px-5 text-white hover:bg-[#3d439c]"
              onClick={() => window.open(APPLY_URL, "_blank")}
            >
              Apply in 30 seconds
            </Button>
            <button
              onClick={() => onViewDetails(role)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#474ead] dark:text-slate-300"
            >
              View details <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DbJobCard({ job, onNavigate }: { job: Job; onNavigate: (id: string) => void }) {
  const pay = buildRateDisplay(job);
  const badges = getJobBadges(job);
  const timeAgo = getTimeAgo(job.createdAt);
  const tags = (job.skillTags ?? []).slice(0, 4);

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="group flex h-full flex-col rounded-3xl border-slate-200/70 bg-white/90 transition-all hover:border-[#474ead]/25 hover:shadow-[0_16px_48px_rgba(71,78,173,0.10)] dark:border-white/10 dark:bg-white/[0.03]">
        <CardContent className="flex flex-1 flex-col p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span key={b.key} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${b.className}`}>{b.label}</span>
                ))}
                {badges.length === 0 && (
                  <span className="rounded-full bg-[#474ead]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#474ead]">Open</span>
                )}
              </div>
              <h3 className="text-lg font-semibold leading-snug text-slate-900 dark:text-white">{job.title}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{job.company ?? "OnSpot Global"}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{timeAgo}</span>
          </div>

          {/* Meta pills */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><DollarSign className="h-3 w-3" /> Pay</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{pay}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><MapPin className="h-3 w-3" /> Location</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{job.location ?? "Remote"}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><BriefcaseBusiness className="h-3 w-3" /> Category</div>
              <div className="mt-0.5 text-sm font-semibold capitalize text-slate-900 dark:text-white">{job.category}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Layers className="h-3 w-3" /> Type</div>
              <div className="mt-0.5 text-sm font-semibold capitalize text-slate-900 dark:text-white">{job.contractType?.replace(/-/g, " ") ?? "Full-time"}</div>
            </div>
          </div>

          {/* Description excerpt */}
          {job.description && (
            <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{job.description}</p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between gap-3 pt-1">
            <Button
              className="rounded-full bg-[#474ead] px-5 text-white hover:bg-[#3d439c]"
              onClick={() => window.open(APPLY_URL, "_blank", "noopener,noreferrer")}
            >
              Apply in 30 seconds
            </Button>
            <button
              onClick={() => onNavigate(job.id)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#474ead] dark:text-slate-300"
            >
              View details <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function OnSpotFindWorkRedesign() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("Virtual assistant, night shift, ₱50,000+");
  const [schedule, setSchedule] = useState("All schedules");
  const [earning, setEarning] = useState("Any pay");
  const [kind, setKind] = useState("All work");
  const [profileStrength] = useState(68);  
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: dbJobs = [], isLoading: isJobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  function openModal(role: Role) {
    setSelectedRole(role);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setTimeout(() => setSelectedRole(null), 300);
  }

  // Extracts the minimum peso value from strings like "₱50,000–₱78,000/mo"
  function getMinimumPay(payRange: string): number {
    const cleaned = payRange.replace(/[₱,\/mo\s]/g, "");
    const match = cleaned.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const q = query.toLowerCase();
      const schedulePass = schedule === "All schedules" || role.shift === schedule;
      const kindPass = kind === "All work" || role.category === kind;
      const minPay = getMinimumPay(role.pay);
      const earningPass =
        earning === "Any pay" ||
        (earning === "₱45,000+" && minPay >= 45000) ||
        (earning === "₱60,000+" && minPay >= 60000) ||
        (earning === "₱85,000+" && minPay >= 85000);

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

  // First 3 open DB jobs for the live preview — unaffected by search/filter state
  const previewDbJobs = useMemo(() => dbJobs.filter((j) => j.status === "open").slice(0, 3), [dbJobs]);

  const filteredDbJobs = useMemo(() => {
    return dbJobs.filter((job) => {
      if (job.status !== "open") return false;
      const q = query.toLowerCase();
      const queryPass =
        !q ||
        job.title.toLowerCase().includes(q) ||
        (job.description ?? "").toLowerCase().includes(q) ||
        (job.category ?? "").toLowerCase().includes(q) ||
        (job.location ?? "").toLowerCase().includes(q);
      const kindPass =
        kind === "All work" ||
        (job.category ?? "").toLowerCase() === kind.toLowerCase();
      const earningPass = (() => {
        if (earning === "Any pay") return true;
        const max = parseFloat(job.hourlyRateMax ?? job.budget ?? "0");
        if (earning === "₱45,000+") return max >= 45000;
        if (earning === "₱60,000+") return max >= 60000;
        if (earning === "₱85,000+") return max >= 85000;
        return true;
      })();
      return queryPass && kindPass && earningPass;
    });
  }, [dbJobs, query, kind, earning]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.12),transparent_32%),linear-gradient(to_bottom,#f8fafc,white)] text-slate-900 dark:bg-[#060816] dark:text-white">

      {/* Role detail modal — z-[200] clears top nav */}
      <AnimatePresence>
        {isModalOpen && selectedRole && (
          <RoleModal role={selectedRole} onClose={closeModal} />
        )}
      </AnimatePresence>

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
                  <Button variant="outline" className="rounded-full px-6" onClick={() => navigate("/find-work/jobs")}>
                    Browse Roles
                  </Button>
                </div>
              </motion.div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatPill icon={Users} label="Candidates placed" value="1,200+" />
                <StatPill icon={DollarSign} label="Typical roles" value="₱45,000–₱140,000/mo" />
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
                  <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
                    {dbJobs.filter((j) => j.status === "open").length || roles.length} open roles
                  </Badge>
                </div>

                <div className="space-y-3">
                  {/* DB-powered preview (first 3 open jobs); falls back to static roles when DB is empty */}
                  {(previewDbJobs.length > 0 ? previewDbJobs : roles).slice(0, 3).map((item, index) => {
                    const isDbJob = previewDbJobs.length > 0;
                    const job = item as Job;
                    const role = item as Role;

                    const title  = isDbJob ? job.title  : role.title;
                    const pay    = isDbJob ? buildRateDisplay(job) : role.pay;
                    const shift  = isDbJob ? (job.contractType?.replace(/-/g, " ") ?? "Full-time") : role.shift;
                    const market = isDbJob ? (job.location ?? "Remote") : role.market;
                    const fit    = isDbJob ? 90 : role.fit;
                    const why    = isDbJob
                      ? ((job.description ?? "").slice(0, 90) || "Matching your profile to this open role.")
                      : role.why;

                    const handleClick = isDbJob
                      ? () => navigate(`/find-work/job/${job.id}`)
                      : () => openModal(role);

                    return (
                      <motion.button
                        key={isDbJob ? job.id : role.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + index * 0.1, duration: 0.35 }}
                        onClick={handleClick}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
                        tabIndex={0}
                        className="w-full cursor-pointer rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-left transition-all hover:border-[#474ead]/30 hover:shadow-[0_12px_40px_rgba(71,78,173,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#474ead]/30 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#474ead]/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{title}</span>
                              <span className="rounded-full bg-[#474ead]/10 px-2 py-1 text-[11px] font-medium text-[#474ead]">{fit}% match</span>
                            </div>
                            <div className="mt-1 text-sm text-slate-500">{pay} · {shift} · {market}</div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                              <Sparkles className="h-4 w-4 shrink-0 text-[#474ead]" />
                              <span className="line-clamp-1">{why}</span>
                            </div>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-[#474ead]" />
                        </div>
                      </motion.button>
                    );
                  })}
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
              { label: "How much do you want to earn?", value: earning, options: ["Any pay", "₱45,000+", "₱60,000+", "₱85,000+"] },
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

        {/* Job cards — DB-powered when available, static fallback when DB is empty */}
        {isJobsLoading ? (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/[0.04]" />
            ))}
          </div>
        ) : filteredDbJobs.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {filteredDbJobs.slice(0, 6).map((job) => (
              <DbJobCard key={job.id} job={job} onNavigate={(id) => navigate(`/find-work/job/${id}`)} />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {filteredRoles.map((role) => (
              <JobCard key={role.id} role={role} onViewDetails={openModal} />
            ))}
          </div>
        )}

        {/* Show More Job Opening CTA */}
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filteredDbJobs.length > 6
              ? `Showing 6 of ${filteredDbJobs.length} open roles`
              : "Explore the full list of available opportunities"}
          </p>
          <Button
            className="rounded-full bg-[#474ead] px-8 py-2.5 text-white shadow-[0_8px_32px_rgba(71,78,173,0.28)] hover:bg-[#3d439c]"
            onClick={() => navigate("/find-work/jobs")}
          >
            Show More Job Opening <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
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
