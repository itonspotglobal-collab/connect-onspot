import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SearchX, Sparkles, BriefcaseBusiness, Clock3, Globe2,
  ChevronRight, Star, BadgeCheck, DollarSign, Brain,
  TrendingUp, Plus, Minus, X, CheckCircle2, Gift,
  ListChecks, Award, ArrowRight, ArrowLeft, Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Role {
  id: number;
  title: string;
  salaryPhp: string;
  pay: string; // peso value — used for filter parsing
  shift: string;
  market: string;
  category: string;
  demand: string;
  speed: string;
  fit: number;
  hook: string;
  why: string;
  tags: string[];
  overview: string;
  description: string;
  responsibilities: string[];
  qualifications: string[];
  preferredSkills: string[];
  benefits: string[];
}

// ─── Roles ────────────────────────────────────────────────────────────────────

const roles: Role[] = [
  {
    id: 1,
    title: "Executive Virtual Assistant",
    salaryPhp: "₱50,000–₱78,000 / month",
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
    overview:
      "A US-based founder scaling their business needs a sharp, proactive Executive VA to be the connective tissue that keeps everything moving — from inbox to special projects.",
    description:
      "You'll manage communications, scheduling, research, and critical projects that require judgment and trust. This isn't a basic admin role — it's a high-ownership position where you'll interact with clients, vendors, and leadership daily. You'll have visibility across the business and direct impact on how efficiently the founder operates.",
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
    salaryPhp: "₱45,000–₱67,000 / month",
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
    overview:
      "A fast-growing US ecommerce brand needs a dedicated Customer Support Specialist for inbound queries, order resolution, and delivering an exceptional customer experience.",
    description:
      "You'll be part of a structured support team with clear processes, escalation paths, and regular coaching. High-volume but highly organized — great for someone who thrives on people-first work with solid systems behind them. CSAT and resolution speed are the key metrics you'll own.",
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
    salaryPhp: "₱56,000–₱101,000 / month",
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
    overview:
      "A well-established Australian business needs an experienced Bookkeeper to own day-to-day financial records, reconciliations, and reporting with clear accountability.",
    description:
      "You'll work closely with the finance lead and have full ownership of your accounts. Stable, long-term engagement with above-market compensation for candidates with solid accounting foundations. Day shift means a more normal schedule — a big quality-of-life advantage for the right candidate.",
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
      "₱56,000–₱101,000 per month — above-market pay",
      "Stable, long-term engagement with a reputable AU business",
      "Day shift — great work-life balance",
      "Professional development and structured review cycle",
      "Paid leave and Philippine public holiday recognition",
    ],
  },
  {
    id: 4,
    title: "Sales Development Representative",
    salaryPhp: "₱62,000–₱112,000 / month",
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
    overview:
      "A high-growth B2B company in the US needs a motivated SDR to drive top-of-funnel pipeline through outbound prospecting, cold outreach, and lead qualification.",
    description:
      "This role offers base plus performance commission — making it one of the best-paying opportunities for strong communicators in the Philippines. You'll work in a structured sales environment with clear targets, regular coaching, and real earning potential based on what you close.",
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
    salaryPhp: "₱48,000–₱73,000 / month",
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
    overview:
      "A UK-based digital brand needs a Content & Social Media Assistant to support their growing content operation — producing, scheduling, and tracking across platforms.",
    description:
      "You'll work closely with the marketing lead to build consistent, high-quality content output across LinkedIn, Instagram, and other key channels. Strong creative direction is provided — your job is to execute it reliably, build efficient content systems, and bring your own ideas when you see opportunities.",
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
    salaryPhp: "₱56,000–₱84,000 / month",
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
    overview:
      "An Australian company with a multi-functional remote team needs an Operations Coordinator to manage workflows, track deliverables, and keep cross-functional projects on schedule.",
    description:
      "You'll be the operational backbone — the person who ensures nothing falls through the cracks. This is a high-visibility role with access to leadership and real influence over how the team functions. Ideal for detail-driven professionals who love systems, structure, and helping teams perform at their best.",
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

// ─── Static data ──────────────────────────────────────────────────────────────

const trustStats = [
  { label: "Candidates placed",    value: "1,200+" },
  { label: "Typical monthly roles", value: "₱45K–₱112K" },
  { label: "Global client markets", value: "US · AU · UK" },
  { label: "Hiring speed",          value: "3–10 days" },
];

const stories = [
  { name: "Maria",  role: "Virtual Assistant",           quote: "I went from routine admin work to supporting a premium global client with better pay and clearer growth.", outcome: "From ₱25K to ₱85K/month" },
  { name: "Paolo",  role: "Customer Support Specialist",  quote: "The process felt faster and more human. I got matched to a role that actually fit my schedule and strengths.", outcome: "Hired in 5 days" },
  { name: "Andrea", role: "Bookkeeping Assistant",        quote: "What stood out was the quality of opportunities. It didn't feel like random applications anymore.", outcome: "Moved into an AU role" },
];

const prompts = [
  "Virtual assistant, night shift, ₱50K+",
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


// Extracts the minimum peso value from a salary string like "₱50,000–₱78,000/mo"
function parseMinPhp(salaryStr: string): number {
  const cleaned = salaryStr.replace(/[₱,\/mo\s]/g, "");
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// ─── ReadMore helper ──────────────────────────────────────────────────────────

function ReadMore({ text, limit = 240 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const short = text.length > limit;
  const display = short && !expanded ? text.slice(0, limit).trimEnd() + "…" : text;
  return (
    <span>
      {display}
      {short && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-1.5 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </span>
  );
}

// ─── BulletList with show-more collapse ──────────────────────────────────────

function BulletList({ items, accentClass }: { items: string[]; accentClass: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 4;
  const visible = expanded ? items : items.slice(0, LIMIT);
  const hasMore = items.length > LIMIT;
  return (
    <div>
      <ul className="space-y-2.5">
        {visible.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-6 text-stone-700">
            <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${accentClass}`} />
            {item}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          {expanded ? "Show fewer" : `Show ${items.length - LIMIT} more`}
        </button>
      )}
    </div>
  );
}

// ─── Section block inside modal ───────────────────────────────────────────────

function ModalSection({
  icon: Icon,
  title,
  iconBg,
  children,
}: {
  icon: React.ElementType;
  title: string;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5 md:px-8">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-stone-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Role Detail Modal ────────────────────────────────────────────────────────
// z-[200] so it clears the top navigation's z-50
// tab: "summary" = compact highlight view; "full" = complete job posting

function RoleDetailModal({ role, onClose }: { role: Role; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"summary" | "full">("summary");

  // Reset to summary whenever the role changes
  useEffect(() => { setTab("summary"); }, [role]);

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
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      aria-modal="true"
      role="dialog"
      aria-label={role.title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.32)] sm:rounded-[28px]"
        style={{ maxHeight: "92vh" }}
      >

        {/* ── HEADER (same for both tabs) ── */}
        <div className="relative shrink-0 overflow-hidden bg-[#1C1917] px-6 pb-6 pt-5 md:px-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/30 blur-[70px]" />

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Demand + speed + match row */}
          <div className="relative mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white">
              {role.demand}
            </span>
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] text-white/60">
              {role.speed}
            </span>
            <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-400">
              {role.fit}% match
            </span>
          </div>

          {/* Title + hook */}
          <div className="relative">
            <h2 className="text-2xl font-black leading-tight text-white md:text-[28px]">
              {role.title}
            </h2>
            <p className="mt-1.5 text-sm text-stone-400">{role.hook}</p>
          </div>

          {/* Salary */}
          <div className="relative mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <div className="text-[10px] text-white/40">Monthly salary (PHP)</div>
              <div className="text-sm font-black text-white">{role.salaryPhp}</div>
            </div>
          </div>

          {/* Meta chips */}
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {[
              { Icon: Clock3,            label: "Schedule",  value: role.shift    },
              { Icon: Globe2,            label: "Market",    value: role.market   },
              { Icon: BriefcaseBusiness, label: "Category",  value: role.category },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/[0.06] p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-white/40">
                  <Icon className="h-2.5 w-2.5" />{label}
                </div>
                <div className="mt-1 text-xs font-bold text-white/90">{value}</div>
              </div>
            ))}
          </div>

          {/* Tab breadcrumb */}
          {tab === "full" && (
            <div className="relative mt-3 flex items-center gap-1.5">
              <span className="text-[10px] text-white/30">Summary</span>
              <span className="text-[10px] text-white/20">›</span>
              <span className="text-[10px] font-semibold text-primary/80">Full Details</span>
            </div>
          )}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <AnimatePresence mode="wait" initial={false}>
          {tab === "summary" ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex-1 overflow-y-auto divide-y divide-stone-100"
            >
              {/* Why you're a fit */}
              <div className="bg-primary/[0.04] px-6 py-5 md:px-8">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">
                      Why you're a fit
                    </p>
                    <p className="text-sm leading-6 text-stone-700">{role.why}</p>
                  </div>
                </div>
              </div>

              {/* Overview snippet */}
              <div className="px-6 py-5 md:px-8">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-400">Overview</p>
                <p className="line-clamp-3 text-sm leading-7 text-stone-600">{role.overview}</p>
              </div>

              {/* Responsibilities preview — first 3 */}
              <div className="px-6 py-5 md:px-8">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                    <ListChecks className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-stone-800">Responsibilities</h3>
                </div>
                <ul className="space-y-2.5">
                  {role.responsibilities.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-6 text-stone-700">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                {role.responsibilities.length > 3 && (
                  <p className="mt-3 text-xs text-stone-400">
                    +{role.responsibilities.length - 3} more — click Show More to see all
                  </p>
                )}
              </div>

              {/* Qualifications preview — first 3 */}
              <div className="px-6 py-5 md:px-8">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-stone-800">Qualifications</h3>
                </div>
                <ul className="space-y-2.5">
                  {role.qualifications.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-6 text-stone-700">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                {role.qualifications.length > 3 && (
                  <p className="mt-3 text-xs text-stone-400">
                    +{role.qualifications.length - 3} more — click Show More to see all
                  </p>
                )}
              </div>

              {/* Tags */}
              <div className="px-6 py-5 md:px-8">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-stone-400">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {role.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex-1 overflow-y-auto divide-y divide-stone-100"
            >
              {/* Why you're a fit */}
              <div className="bg-primary/[0.04] px-6 py-5 md:px-8">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">
                      Why you're a fit
                    </p>
                    <p className="text-sm leading-6 text-stone-700">{role.why}</p>
                  </div>
                </div>
              </div>

              {/* Overview */}
              <ModalSection icon={Sparkles} title="Overview" iconBg="bg-stone-100 text-stone-500">
                <p className="text-sm leading-7 text-stone-600">{role.overview}</p>
              </ModalSection>

              {/* Full description */}
              <ModalSection icon={ListChecks} title="About this role" iconBg="bg-indigo-50 text-indigo-500">
                <p className="text-sm leading-7 text-stone-600">{role.description}</p>
              </ModalSection>

              {/* All responsibilities */}
              <ModalSection icon={ListChecks} title="Responsibilities" iconBg="bg-blue-50 text-blue-500">
                <ul className="space-y-2.5">
                  {role.responsibilities.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-6 text-stone-700">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </ModalSection>

              {/* All qualifications */}
              <ModalSection icon={CheckCircle2} title="Qualifications" iconBg="bg-emerald-50 text-emerald-600">
                <ul className="space-y-2.5">
                  {role.qualifications.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-6 text-stone-700">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </ModalSection>

              {/* All preferred skills */}
              {role.preferredSkills.length > 0 && (
                <ModalSection icon={Award} title="Preferred skills" iconBg="bg-amber-50 text-amber-500">
                  <ul className="space-y-2.5">
                    {role.preferredSkills.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm leading-6 text-stone-700">
                        <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </ModalSection>
              )}

              {/* All benefits */}
              <ModalSection icon={Gift} title="Benefits & perks" iconBg="bg-purple-50 text-purple-500">
                <ul className="space-y-2.5">
                  {role.benefits.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-6 text-stone-700">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </ModalSection>

              {/* Tags */}
              <div className="px-6 py-5 md:px-8">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-stone-400">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {role.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FOOTER ── */}
        <div className="shrink-0 border-t border-stone-100 bg-white px-6 py-4 md:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="rounded-xl px-6"
              onClick={() => navigate("/find-work/jobs")}
            >
              Apply Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            {tab === "summary" ? (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setTab("full")}
              >
                <Maximize2 className="mr-2 h-4 w-4" />
                Show More
              </Button>
            ) : (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setTab("summary")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}

            <Button variant="ghost" className="rounded-xl" onClick={onClose}>
              Close
            </Button>

            <span className="ml-auto hidden text-xs text-stone-400 sm:block">
              OnSpot · {role.market}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Accordion-style role row — dark/hero-matched theme ──────────────────────

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
  const [, navigate] = useLocation();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`border-b border-white/[0.07] transition-colors duration-200 ${
        isOpen ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
      }`}
    >
      {/* Row header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-6 py-5 text-left md:px-8"
      >
        {/* Index number */}
        <span className="w-6 shrink-0 text-xs font-bold text-white/20">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Fit badge */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-xs font-black text-primary">
          {role.fit}%
        </div>

        {/* Title + hook + demand */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-base font-bold text-white md:text-lg">{role.title}</span>
            <span className="hidden text-sm text-white/30 md:inline">— {role.hook}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary/90">
              {role.demand}
            </span>
            <span className="text-xs text-white/25">{role.speed}</span>
          </div>
        </div>

        {/* Salary — amber accent */}
        <div className="hidden shrink-0 text-right md:block">
          <div className="text-[10px] font-medium uppercase tracking-wide text-white/25">Monthly salary</div>
          <div className="mt-0.5 text-sm font-bold text-amber-400">{role.salaryPhp}</div>
        </div>

        {/* Toggle icon */}
        <div className="ml-2 shrink-0 text-white/30 transition-colors group-hover:text-white/50">
          {isOpen
            ? <Minus className="h-4 w-4 text-primary/70" />
            : <Plus  className="h-4 w-4" />
          }
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
            <div className="border-t border-white/[0.07] px-6 pb-7 pt-5 md:px-8">
              {/* Mobile salary */}
              <div className="mb-4 flex items-center gap-2 md:hidden">
                <DollarSign className="h-3.5 w-3.5 text-amber-400/70" />
                <span className="text-sm font-bold text-amber-400">{role.salaryPhp}</span>
              </div>

              <div className="grid gap-6 md:grid-cols-[1fr_252px]">
                {/* Left — summary */}
                <div>
                  {/* Meta chips — glassy */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {[
                      { Icon: DollarSign,        l: "Salary",    v: role.salaryPhp  },
                      { Icon: Clock3,             l: "Schedule",  v: role.shift      },
                      { Icon: Globe2,             l: "Market",    v: role.market     },
                      { Icon: BriefcaseBusiness,  l: "Category",  v: role.category   },
                    ].map(({ Icon, l, v }) => (
                      <div key={l} className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-3 backdrop-blur-sm">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-white/30">
                          <Icon className="h-2.5 w-2.5" />{l}
                        </div>
                        <div className="mt-1 text-xs font-bold leading-tight text-white/85">{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Why you're a fit — primary glow pill */}
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.08] px-4 py-3.5">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-white/70">
                      <span className="font-semibold text-white/90">Why you're a fit: </span>
                      {role.why}
                    </p>
                  </div>

                  {/* Overview snippet */}
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-white/35">{role.overview}</p>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {role.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs text-white/40"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right — CTA panel — glassy dark card */}
                <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.1] bg-white/[0.04] p-5 backdrop-blur-sm">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                      Match score
                    </div>
                    <div className="mt-1 text-4xl font-black text-primary">{role.fit}%</div>
                    <Progress value={role.fit} className="mt-2 h-1 bg-white/10 [&>div]:bg-primary" />
                  </div>

                  <Button
                    className="w-full rounded-xl bg-primary text-white hover:bg-primary/90"
                    onClick={() => navigate("/find-work/jobs")}
                  >
                    Apply in 30 seconds
                  </Button>

                  <button
                    onClick={(e) => { e.stopPropagation(); onViewDetails(role); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] py-2.5 text-sm font-medium text-white/50 transition hover:border-primary/40 hover:bg-primary/[0.08] hover:text-primary"
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
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("Virtual assistant, night shift, ₱50K+");
  const [schedule, setSchedule] = useState("All schedules");
  const [earning, setEarning] = useState("Any pay");
  const [kind, setKind] = useState("All work");
  const [profileStrength] = useState(68);
  const [openRoleId, setOpenRoleId] = useState<number | null>(1);

  // Modal state
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openModal(role: Role) {
    setSelectedRole(role);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setTimeout(() => setSelectedRole(null), 280);
  }

  // Filter logic (unchanged — uses pay for $ range matching)
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const q = query.toLowerCase();
      const schedulePass = schedule === "All schedules" || role.shift === schedule;
      const kindPass = kind === "All work" || role.category === kind;
      const minPay = parseMinPhp(role.salaryPhp);
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
        role.hook.toLowerCase().includes(q) ||
        role.salaryPhp.toLowerCase().includes(q);
      return schedulePass && kindPass && earningPass && queryPass;
    });
  }, [query, schedule, earning, kind]);

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-stone-900">

      {/* Modal — z-[200] so it clears the nav's z-50 */}
      <AnimatePresence>
        {modalOpen && selectedRole && (
          <RoleDetailModal role={selectedRole} onClose={closeModal} />
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

        {/* Live preview cards — click arrow to open modal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.45 }}
          className="relative mt-14 w-full max-w-3xl"
        >
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">
            Live matches — click any card to view details
          </p>
          <div className="grid gap-2">
            {roles.slice(0, 3).map((role, i) => (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.42 + i * 0.08, duration: 0.35 }}
                onClick={() => openModal(role)}
                className="flex w-full items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3.5 text-left transition hover:border-primary/30 hover:bg-white/[0.08]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-black text-primary">
                  {role.fit}%
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white leading-tight">{role.title}</p>
                  <p className="mt-0.5 text-xs text-stone-400">{role.salaryPhp} · {role.market}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary sm:block">
                    {role.demand}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.45 }}
          className="relative mt-10 grid w-full max-w-4xl grid-cols-2 divide-x divide-white/10 border-t border-white/10 md:grid-cols-4"
        >
          {trustStats.map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-1 px-4 py-5 text-center">
              <span className="text-xl font-black text-white md:text-2xl">{value}</span>
              <span className="text-[10px] text-stone-500">{label}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2"
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
          FEATURED ROLES — dark / hero-matched
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#1C1917]">
        {/* Ambient glow — top centre */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(71,78,173,0.18),transparent)]" />
        {/* Subtle side glows */}
        <div className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-primary/[0.07] blur-[90px]" />
        <div className="pointer-events-none absolute -right-32 top-2/3 h-80 w-80 rounded-full bg-amber-500/[0.05] blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-0 py-20 md:py-28">

          {/* ── Section header ── */}
          <div className="mb-10 px-6 md:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                {/* Eye-line label */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px w-8 bg-primary/50" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/70">
                    Featured roles
                  </span>
                </div>

                <h2 className="text-4xl font-black leading-[1.06] tracking-tight text-white md:text-5xl">
                  Roles that feel<br className="hidden md:block" />
                  {" "}like <span className="text-primary">opportunities</span>.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-white/40">
                  Every listing shows salary, schedule, market, and a match score — so you can skip the guesswork and focus on roles that genuinely fit.
                </p>
              </div>

              {/* Role count */}
              <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2">
                <span className="text-2xl font-black text-white">{filteredRoles.length}</span>
                <span className="text-xs text-white/30">role{filteredRoles.length !== 1 ? "s" : ""} matched</span>
              </div>
            </div>

            {/* ── Filter pills — dark glassy ── */}
            <div className="mt-8 flex flex-wrap gap-5">
              {[
                { label: "Earn",     options: ["Any pay", "₱45,000+", "₱60,000+", "₱85,000+"],                                  state: earning,  set: setEarning  },
                { label: "Schedule", options: ["All schedules", "Day shift", "Night shift", "Flexible"],                            state: schedule, set: setSchedule },
                { label: "Type",     options: ["All work", "Admin", "Support", "Finance", "Sales", "Marketing", "Operations"],     state: kind,     set: setKind     },
              ].map((group) => (
                <div key={group.label} className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{group.label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => group.set(opt)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                          group.state === opt
                            ? "bg-primary text-white shadow-[0_0_14px_rgba(71,78,173,0.45)]"
                            : "border border-white/[0.08] bg-white/[0.04] text-white/40 hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white/70"
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

          {/* ── Role list ── */}
          <div className="border-t border-white/[0.07]">
            <AnimatePresence>
              {filteredRoles.length === 0 ? (
                <div className="px-6 py-16 text-center md:px-8">
                  <SearchX className="mx-auto mb-3 h-8 w-8 text-white/20" />
                  <p className="text-sm text-white/30">No roles match your filters. Try adjusting your search.</p>
                </div>
              ) : (
                filteredRoles.map((role, i) => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    index={i}
                    isOpen={openRoleId === role.id}
                    onToggle={() => setOpenRoleId(openRoleId === role.id ? null : role.id)}
                    onViewDetails={openModal}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Bottom fade into next section */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#141210] to-transparent" />
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
                className={`flex items-center gap-8 rounded-2xl border border-stone-100 bg-stone-50 p-6 md:p-8 ${
                  i % 2 !== 0 ? "md:flex-row-reverse" : ""
                }`}
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
