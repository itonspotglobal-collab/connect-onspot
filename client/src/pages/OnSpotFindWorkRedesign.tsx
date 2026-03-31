import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Sparkles, BriefcaseBusiness, Clock3, Globe2,
  ChevronRight, Star, BadgeCheck, DollarSign, Brain,
  TrendingUp, Plus, Minus, X, CheckCircle2, Gift,
  ListChecks, Award, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

// ─── Extended role type ───────────────────────────────────────────────────────

interface Role {
  id: number;
  title: string;
  pay: string;
  shift: string;
  market: string;
  category: string;
  demand: string;
  speed: string;
  fit: number;
  hook: string;
  why: string;
  tags: string[];
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHaves: string[];
  benefits: string[];
}

// ─── Roles data ───────────────────────────────────────────────────────────────

const roles: Role[] = [
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
    description:
      "We're looking for a sharp, proactive Executive Virtual Assistant to support a US-based founder scaling their business. You'll manage communications, scheduling, research, and special projects — acting as the connective tissue that keeps things moving. This is a high-trust role with real ownership and visible impact, ideal for someone who wants more than task execution.",
    responsibilities: [
      "Manage the founder's inbox, calendar, and scheduling across time zones",
      "Coordinate meetings, prepare agendas, and take minutes",
      "Conduct research and compile reports for decision-making",
      "Handle travel arrangements, bookings, and itineraries",
      "Manage CRM updates, follow-ups, and priority communications",
      "Draft and proofread emails, proposals, and presentations",
      "Track key deadlines and flag action items proactively",
    ],
    requirements: [
      "2+ years as a VA, EA, or senior admin support role",
      "Excellent written and verbal English communication",
      "Proficient with Google Workspace, Notion, Slack, or similar tools",
      "Strong time management and attention to detail",
      "Ability to work night shift aligned with US business hours",
      "High degree of discretion and professionalism",
    ],
    niceToHaves: [
      "Experience supporting C-suite or founders in a startup environment",
      "Familiarity with CRM tools like HubSpot or GoHighLevel",
      "Experience with project management tools like Asana or ClickUp",
    ],
    benefits: [
      "Competitive monthly salary: $900–$1,400 USD",
      "100% remote — work from anywhere in the Philippines",
      "Long-term engagement with a growth-oriented client",
      "Career development support and performance reviews",
      "Paid leave and Philippine public holiday recognition",
    ],
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
    description:
      "A fast-growing US ecommerce brand is looking for a dedicated Customer Support Specialist to handle inbound queries, resolve order issues, and deliver an exceptional customer experience. You'll be part of a structured support team with clear processes, escalation paths, and regular coaching — great for someone who thrives in high-volume, people-first environments.",
    responsibilities: [
      "Respond to customer inquiries via email, chat, and ticketing systems",
      "Resolve order issues including refunds, replacements, and delivery disputes",
      "Maintain accurate case records in the CRM",
      "Identify recurring issues and escalate to the team lead",
      "Meet and exceed CSAT, response time, and resolution rate KPIs",
      "Collaborate with fulfillment and logistics teams on order investigations",
    ],
    requirements: [
      "1+ year in customer service, support, or BPO environment",
      "Strong English written communication skills",
      "Experience with Zendesk, Freshdesk, or similar helpdesk tools",
      "Ability to work US night shift hours",
      "Fast typing speed with high accuracy",
      "Empathetic and patient under pressure",
    ],
    niceToHaves: [
      "Experience with ecommerce brands (Shopify, Amazon, etc.)",
      "Familiarity with Gorgias or Re:amaze",
      "Live chat or phone support experience",
    ],
    benefits: [
      "Monthly salary: $800–$1,200 USD",
      "Structured onboarding and continuous training",
      "Remote work setup",
      "Performance bonuses for top CSAT scores",
      "Career pathway into senior support or team lead roles",
    ],
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
    description:
      "A well-established Australian business is seeking an experienced Bookkeeper to manage day-to-day financial records, reconciliations, and reporting. You'll work closely with the finance lead and have clear ownership of your accounts. This is a stable, long-term engagement with above-market pay for candidates with solid accounting foundations.",
    responsibilities: [
      "Perform daily bank reconciliations and transaction coding",
      "Manage accounts payable and receivable processes",
      "Prepare weekly and monthly financial reports",
      "Assist with payroll processing and superannuation compliance",
      "Maintain accurate records in Xero or MYOB",
      "Coordinate with the external accountant during year-end processes",
    ],
    requirements: [
      "2+ years of bookkeeping or accounting assistant experience",
      "Proficiency with Xero, MYOB, or QuickBooks",
      "Strong attention to detail and numerical accuracy",
      "Understanding of Australian GST and BAS reporting preferred",
      "Ability to work AU-aligned day shift hours",
      "Excellent communication for remote coordination",
    ],
    niceToHaves: [
      "CPA or accounting degree/diploma",
      "Experience working with AU-based clients",
      "Familiarity with Australian payroll standards",
    ],
    benefits: [
      "Above-market salary: $1,000–$1,800 USD/month",
      "Stable, long-term engagement",
      "Day shift — aligned with Australian Eastern Time",
      "Professional development support",
      "Paid leave and a structured review cycle",
    ],
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
    description:
      "A high-growth B2B company based in the US is looking for a motivated Sales Development Representative (SDR) to drive top-of-funnel pipeline through outbound prospecting, cold outreach, and qualification. This role offers base plus commission, making it one of the best-paying opportunities for strong communicators in the Philippines who want to build a career in B2B sales.",
    responsibilities: [
      "Execute outbound prospecting via cold calls, emails, and LinkedIn",
      "Qualify inbound leads against defined ICP criteria",
      "Book discovery calls for Account Executives",
      "Maintain accurate activity logs in the CRM (Salesforce or HubSpot)",
      "Meet and exceed monthly meeting booked targets",
      "Research target accounts and personalize outreach messaging",
    ],
    requirements: [
      "1+ year in B2B sales, telemarketing, or appointment setting",
      "Confident, clear spoken and written English",
      "Comfortable with cold calling and rejection",
      "Familiarity with CRM tools (Salesforce, HubSpot)",
      "Goal-oriented mindset with demonstrated target achievement",
      "Ability to work US business hours (night shift in PH)",
    ],
    niceToHaves: [
      "SaaS or technology sales experience",
      "Familiarity with sales engagement tools like Outreach or Apollo",
      "Experience with structured sales methodologies (SPIN, MEDDIC)",
    ],
    benefits: [
      "Base salary: $1,100–$1,500 USD/month",
      "Uncapped commission — total OTE up to $2,000+",
      "Remote work, night shift",
      "Sales training and career development in B2B",
      "Regular team incentives and recognition programs",
    ],
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
    description:
      "A UK-based digital brand is looking for a Content & Social Media Assistant to support their growing content operation. You'll help produce, schedule, and track content across LinkedIn, Instagram, and other channels — working closely with the marketing lead to build consistent, high-quality output. This is a great portfolio-building role for organized creatives who love content systems.",
    responsibilities: [
      "Create and schedule content for LinkedIn, Instagram, and Facebook",
      "Draft captions, carousels, and short-form written content",
      "Repurpose long-form content (blogs, videos) into social assets",
      "Manage a content calendar and maintain publishing consistency",
      "Track engagement metrics and prepare monthly performance reports",
      "Assist with basic graphic design using Canva or Adobe Express",
    ],
    requirements: [
      "1+ year in social media management, content creation, or digital marketing",
      "Strong written English with a clear, engaging voice",
      "Proficiency with Canva and scheduling tools like Buffer or Later",
      "Understanding of social media best practices across platforms",
      "Organized, proactive, and able to work independently",
      "Portfolio of past content or examples",
    ],
    niceToHaves: [
      "Experience with UK brands or audiences",
      "Basic video editing skills (CapCut, Premiere Rush)",
      "Familiarity with SEO content principles",
    ],
    benefits: [
      "Monthly salary: $850–$1,300 USD",
      "Flexible schedule — some UK timezone alignment",
      "Work with a forward-thinking creative brand",
      "Portfolio-worthy work in a modern brand environment",
      "Remote, long-term engagement",
    ],
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
    description:
      "An Australian company with a multi-functional remote team is looking for an Operations Coordinator to manage workflows, track deliverables, and keep cross-functional projects on schedule. You'll be the operational backbone — making sure nothing falls through the cracks. Ideal for detail-driven professionals who love systems, structure, and cross-team coordination.",
    responsibilities: [
      "Coordinate project timelines, milestones, and deliverables across teams",
      "Maintain and improve internal SOPs and documentation",
      "Manage team task boards in ClickUp, Asana, or Monday.com",
      "Prepare status updates and operational reports for leadership",
      "Identify bottlenecks and propose process improvements",
      "Assist with onboarding coordination for new team members",
    ],
    requirements: [
      "2+ years in operations, project coordination, or similar role",
      "Experience with project management tools (ClickUp, Asana, Notion)",
      "Excellent organizational and prioritization skills",
      "Clear written communication for async, remote environments",
      "Ability to work AU-aligned day shift hours",
      "Proven ability to manage multiple workstreams simultaneously",
    ],
    niceToHaves: [
      "Experience with process documentation and SOP creation",
      "Familiarity with remote-first team cultures",
      "PMP, CAPM, or similar project management certification",
    ],
    benefits: [
      "Monthly salary: $1,000–$1,500 USD",
      "Day shift — AU time zone aligned",
      "Stable, long-term remote engagement",
      "High-visibility role with access to leadership",
      "Opportunities to grow into a senior ops or team lead role",
    ],
  },
];

// ─── Static data ──────────────────────────────────────────────────────────────

const trustStats = [
  { label: "Candidates placed",    value: "1,200+" },
  { label: "Typical monthly roles", value: "$800–$2,500" },
  { label: "Global client markets", value: "US · AU · UK" },
  { label: "Hiring speed",          value: "3–10 days" },
];

const stories = [
  { name: "Maria",  role: "Virtual Assistant",           quote: "I went from routine admin work to supporting a premium global client with better pay and clearer growth.", outcome: "From ₱25K to ₱85K/month" },
  { name: "Paolo",  role: "Customer Support Specialist",  quote: "The process felt faster and more human. I got matched to a role that actually fit my schedule and strengths.", outcome: "Hired in 5 days" },
  { name: "Andrea", role: "Bookkeeping Assistant",        quote: "What stood out was the quality of opportunities. It didn't feel like random applications anymore.", outcome: "Moved into an AU role" },
];

const prompts = [
  "Virtual assistant, night shift, $900+",
  "Customer support, remote, US client",
  "Accounting or finance role, day shift",
  "Social media assistant with flexible schedule",
];

const whyFeatures = [
  { icon: Brain,      title: "Smart matching",         copy: "Surface better-fit roles first instead of forcing endless browsing." },
  { icon: DollarSign, title: "Premium remote roles",   copy: "Highlight compensation clearly so applicants instantly see quality." },
  { icon: TrendingUp, title: "Faster hiring momentum", copy: "Show urgency, speed-to-hire, and profile strength to increase action." },
  { icon: BadgeCheck, title: "Trust by design",        copy: "Use fit reasoning, hiring signals, and outcomes to build confidence." },
];

const ctaSteps = [
  "Apply in 30 seconds",
  "Get matched to better-fit roles",
  "Complete your profile for stronger opportunities",
  "Stay visible for active hiring teams",
];

const APPLY_URL = "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true";

// ─── ReadMore helper ──────────────────────────────────────────────────────────

function ReadMore({ text, limit = 220 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const short = text.length > limit;
  const display = short && !expanded ? text.slice(0, limit).trimEnd() + "…" : text;
  return (
    <span>
      {display}
      {short && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-1.5 text-primary font-semibold underline-offset-2 hover:underline text-xs"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </span>
  );
}

// ─── BulletList with read-more collapse ──────────────────────────────────────

function BulletList({ items, accent }: { items: string[]; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 4;
  const visible = expanded ? items : items.slice(0, LIMIT);
  const hasMore = items.length > LIMIT;
  return (
    <div>
      <ul className="space-y-2">
        {visible.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-stone-700">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent}`} />
            {item}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          {expanded ? `Show fewer` : `Show ${items.length - LIMIT} more`}
        </button>
      )}
    </div>
  );
}

// ─── Role Detail Modal ────────────────────────────────────────────────────────

function RoleDetailModal({ role, onClose }: { role: Role; onClose: () => void }) {
  // Scroll lock + Escape key
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 md:p-6"
      aria-modal="true"
      role="dialog"
      aria-label={role.title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.28)] sm:rounded-3xl"
        style={{ maxHeight: "92vh" }}
      >
        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden bg-[#1C1917] px-6 pb-6 pt-6">
          {/* Glow */}
          <div className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-primary/25 blur-[80px]" />

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Badges row */}
          <div className="relative mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white">
              {role.demand}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70">
              {role.speed}
            </span>
            <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-400">
              {role.fit}% match
            </span>
          </div>

          {/* Title */}
          <div className="relative">
            <h2 className="text-2xl font-black leading-tight text-white md:text-3xl">
              {role.title}
            </h2>
            <p className="mt-1.5 text-sm text-stone-400">{role.hook}</p>
          </div>

          {/* Meta chips */}
          <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { Icon: DollarSign,      label: "Monthly pay", value: role.pay      },
              { Icon: Clock3,          label: "Schedule",    value: role.shift    },
              { Icon: Globe2,          label: "Market",      value: role.market   },
              { Icon: BriefcaseBusiness, label: "Category",  value: role.category },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/[0.07] p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <Icon className="h-3 w-3" />{label}
                </div>
                <div className="mt-1 text-xs font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0 divide-y divide-stone-100">

            {/* Why you're a fit */}
            <div className="bg-primary/[0.04] px-6 py-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Why you're a fit</p>
                  <p className="text-sm leading-6 text-stone-700">{role.why}</p>
                </div>
              </div>
            </div>

            {/* About this role */}
            <div className="px-6 py-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">About this role</h3>
              </div>
              <p className="text-sm leading-7 text-stone-600">
                <ReadMore text={role.description} limit={260} />
              </p>
            </div>

            {/* Responsibilities */}
            <div className="px-6 py-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <ListChecks className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">Responsibilities</h3>
              </div>
              <BulletList items={role.responsibilities} accent="bg-primary/70" />
            </div>

            {/* Requirements */}
            <div className="px-6 py-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">Requirements</h3>
              </div>
              <BulletList items={role.requirements} accent="bg-emerald-500" />
            </div>

            {/* Nice to have */}
            {role.niceToHaves.length > 0 && (
              <div className="px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-900">Nice to have</h3>
                </div>
                <BulletList items={role.niceToHaves} accent="bg-amber-400" />
              </div>
            )}

            {/* Benefits */}
            <div className="px-6 py-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Gift className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">Benefits & perks</h3>
              </div>
              <BulletList items={role.benefits} accent="bg-purple-400" />
            </div>

            {/* Tags */}
            <div className="px-6 py-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">Tags</p>
              <div className="flex flex-wrap gap-2">
                {role.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-stone-100 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="rounded-xl px-7"
              onClick={() => window.open(APPLY_URL, "_blank")}
            >
              Apply Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
              Close
            </Button>
            <p className="ml-auto hidden text-xs text-stone-400 sm:block">
              OnSpot Global · Remote · {role.market}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Accordion-style role row ─────────────────────────────────────────────────

function RoleRow({
  role,
  index,
  isOpen,
  onToggle,
  onViewDetails,
}: {
  role: Role;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onViewDetails: (role: Role) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`border-b border-stone-200 transition-colors duration-200 ${isOpen ? "bg-stone-100" : "hover:bg-stone-50"}`}
    >
      {/* Row header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-6 py-5 text-left md:px-8"
      >
        <span className="w-6 shrink-0 text-xs font-bold text-stone-400">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5 text-xs font-black text-primary">
          {role.fit}%
        </div>

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

        <div className="hidden shrink-0 text-right md:block">
          <div className="text-xs text-stone-400">Monthly pay</div>
          <div className="text-sm font-bold text-stone-900">{role.pay}</div>
        </div>

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

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { Icon: DollarSign,      l: "Monthly pay", v: role.pay      },
                      { Icon: Clock3,          l: "Schedule",    v: role.shift    },
                      { Icon: Globe2,          l: "Market",      v: role.market   },
                      { Icon: BriefcaseBusiness, l: "Category",  v: role.category },
                    ].map(({ Icon, l, v }) => (
                      <div key={l} className="rounded-xl border border-stone-200 bg-white p-3">
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                          <Icon className="h-3 w-3" />{l}
                        </div>
                        <div className="mt-1 text-sm font-bold text-stone-900">{v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary/5 px-4 py-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-stone-700">
                      <span className="font-semibold text-stone-900">Why you're a fit: </span>
                      {role.why}
                    </p>
                  </div>

                  {/* Description preview */}
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-stone-500">
                    {role.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {role.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right — CTA panel */}
                <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      Match score
                    </div>
                    <div className="mt-1 text-4xl font-black text-primary">{role.fit}%</div>
                    <Progress value={role.fit} className="mt-2 h-1.5" />
                  </div>

                  <Button
                    className="w-full rounded-xl"
                    onClick={() => window.open(APPLY_URL, "_blank")}
                  >
                    Apply in 30 seconds
                  </Button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(role);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 py-2.5 text-sm font-medium text-stone-600 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                  >
                    View full details <ChevronRight className="h-4 w-4" />
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

  // Modal state
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function handleViewDetails(role: Role) {
    setSelectedRole(role);
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setTimeout(() => setSelectedRole(null), 250);
  }

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

      {/* ── Modal (portal-style at top of tree) ── */}
      <AnimatePresence>
        {modalOpen && selectedRole && (
          <RoleDetailModal role={selectedRole} onClose={handleCloseModal} />
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden bg-[#1C1917] px-6 text-center md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(71,78,173,0.35),transparent)]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-3/4 rounded-full bg-primary/10 blur-[100px]" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.04]" />

        <div className="relative max-w-5xl">
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

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.45 }}
          className="relative mt-16 grid w-full max-w-4xl grid-cols-2 divide-x divide-white/10 border-t border-white/10 md:grid-cols-4"
        >
          {trustStats.map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-1 px-4 py-6 text-center">
              <span className="text-2xl font-black text-white md:text-3xl">{value}</span>
              <span className="text-[11px] text-stone-500">{label}</span>
            </div>
          ))}
        </motion.div>

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
          PROFILE STRENGTH
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
          ROLES
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-0 py-16 md:py-24">
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
              { label: "Earn",     options: ["Any pay", "$800+", "$1,000+", "$1,500+"],                                              state: earning,  set: setEarning  },
              { label: "Schedule", options: ["All schedules", "Day shift", "Night shift", "Flexible"],                               state: schedule, set: setSchedule },
              { label: "Type",     options: ["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"],        state: kind,     set: setKind     },
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
                  onViewDetails={handleViewDetails}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          WHY ONSPOT
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-24">
          <div className="mb-16 grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Why OnSpot</p>
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

          <div className="space-y-5">
            {whyFeatures.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className={`flex items-center gap-8 rounded-2xl border border-stone-100 bg-stone-50 p-6 md:p-8 ${i % 2 !== 0 ? "md:flex-row-reverse" : ""}`}
              >
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-950 text-white">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black text-stone-300">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-stone-950">{item.title}</h3>
                  <p className="mt-2 text-stone-500 leading-6">{item.copy}</p>
                </div>
                <div className="hidden w-1.5 self-stretch rounded-full bg-primary/20 md:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          STORIES
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-200 bg-[#F7F4EF]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-24">
          <div className="mb-12">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Proof it works</p>
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
                <div className="bg-stone-950 px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Outcome</p>
                  <p className="mt-1 text-xl font-black text-white leading-tight">{story.outcome}</p>
                </div>
                <div className="flex flex-1 flex-col gap-5 p-6">
                  <div className="flex gap-0.5 text-primary">
                    {[0,1,2,3,4].map((s) => <Star key={s} className="h-4 w-4 fill-current" />)}
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
          CTA
      ════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-20">
          <div className="overflow-hidden rounded-3xl bg-[#1C1917]">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
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

              <div className="border-t border-white/5 bg-[#252220] px-8 py-14 md:border-l md:border-t-0 md:px-10 md:py-16">
                <p className="mb-8 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-500">How it works</p>
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
