import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Sparkles, Clock3, Globe2,
  BriefcaseBusiness, DollarSign, ListChecks, CheckCircle2,
  Award, Gift, Tag, AlertCircle, MapPin, Layers, Loader2,
  Wifi, Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { buildRateDisplay, getJobBadges, getTimeAgo } from "@/lib/jobUtils";
import { saveUserActivity } from "@/lib/userActivityMemory";

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
    speed: "Fills in 14 days",
    fit: 94,
    hook: "The backbone of every high-performing executive.",
    why: "Your background in calendar management, executive coordination, and proactive communication makes you a strong candidate for this high-trust role.",
    tags: ["Remote", "Night shift", "Admin", "Executive support", "High demand"],
    overview:
      "Executive Virtual Assistants at OnSpot work directly with C-suite and senior executives across fast-growing US companies. You will be the operational anchor that keeps leaders focused, informed, and efficient — managing everything from scheduling and communications to research and project coordination.",
    description:
      "This role requires someone who thrives in ambiguity, can switch contexts rapidly, and builds trust quickly with high-achieving principals. You'll be embedded in fast-paced business environments where attention to detail and discretion are non-negotiable.",
    responsibilities: [
      "Manage executive calendars, meetings, and travel logistics across multiple time zones",
      "Screen and prioritize emails, draft correspondence, and maintain executive inboxes",
      "Prepare briefing documents, agendas, and follow-up summaries",
      "Coordinate cross-functional projects and track action items to completion",
      "Conduct research and compile data-driven reports on request",
      "Liaise with internal teams, vendors, and external stakeholders on behalf of the executive",
      "Handle confidential information with absolute discretion",
    ],
    qualifications: [
      "3+ years of experience in an executive assistant or administrative role",
      "Excellent written and verbal communication skills in English",
      "Proficiency in Google Workspace, Microsoft 365, Slack, and Zoom",
      "Strong organizational skills with a track record of managing competing priorities",
      "Ability to work US night shift (Pacific or Eastern time)",
      "Stable internet connection with at least 25 Mbps speed",
    ],
    preferredSkills: [
      "Experience supporting founders or C-suite in a US startup environment",
      "Familiarity with project management tools (Asana, Notion, ClickUp)",
      "Background in finance, legal, or healthcare executive support",
    ],
    benefits: [
      "Competitive PHP salary paid bi-weekly",
      "13th month pay and performance bonuses",
      "HMO coverage after 90 days (principal + 1 dependent)",
      "Paid time off, holidays, and sick leave",
      "Access to OnSpot career development programs",
      "Remote-first work setup with equipment allowance",
    ],
    culturalFit: [
      "Thrives in a fast-paced, high-trust environment with minimal supervision",
      "Communicates proactively — you flag issues before they become problems",
      "Discreet and professional when handling sensitive executive information",
      "Comfortable working US night shift hours (Pacific or Eastern time)",
      "Values long-term partnerships and takes ownership of outcomes",
    ],
    applyLink: APPLY_URL,
  },
  {
    id: 2,
    title: "Customer Success Manager",
    pay: "₱55,000–₱85,000/mo",
    shift: "Night shift",
    market: "US client",
    category: "Customer success",
    demand: "Critical hire",
    speed: "Fills in 10 days",
    fit: 91,
    hook: "Turn clients into lifelong brand advocates.",
    why: "Your ability to build long-term client relationships while driving measurable outcomes aligns precisely with what our US clients need from this high-value role.",
    tags: ["Remote", "Night shift", "Customer success", "B2B SaaS", "Critical hire"],
    overview:
      "Customer Success Managers at OnSpot partner with US-based SaaS companies to ensure their clients achieve meaningful outcomes. You act as the primary relationship owner post-sale — driving adoption, reducing churn, and expanding accounts.",
    description:
      "You'll work with a portfolio of mid-market and enterprise accounts, conducting regular business reviews, identifying at-risk customers, and collaborating with product and sales teams to deliver value at scale. This is a high-visibility, high-impact role where your work directly affects revenue.",
    responsibilities: [
      "Own a portfolio of 20–40 US B2B accounts from onboarding through renewal",
      "Conduct quarterly business reviews and health check calls",
      "Build success plans aligned to each client's business objectives",
      "Monitor product adoption metrics and proactively address churn signals",
      "Collaborate with sales on expansion and upsell opportunities",
      "Serve as the voice of the customer internally to product and engineering teams",
      "Achieve NPS, retention, and expansion revenue targets",
    ],
    qualifications: [
      "3+ years in customer success, account management, or client services (SaaS preferred)",
      "Excellent English communication skills — written and spoken",
      "Experience with CRM tools (Salesforce, HubSpot) and CS platforms (Gainsight, ChurnZero)",
      "Data-driven mindset with ability to interpret usage metrics and present insights",
      "Availability for US night shift hours",
    ],
    preferredSkills: [
      "Experience with PLG (product-led growth) SaaS environments",
      "Background in fintech, HR tech, or martech verticals",
      "Familiarity with Looker, Tableau, or similar analytics tools",
    ],
    benefits: [
      "Competitive PHP salary paid bi-weekly",
      "Performance bonuses tied to retention and NPS targets",
      "HMO coverage after 90 days (principal + 1 dependent)",
      "Paid leave, 13th month pay, and wellness allowance",
      "Mentorship from OnSpot's global CS leadership team",
      "Remote-first with home office setup support",
    ],
    culturalFit: [
      "Client-first mindset — you measure success by client outcomes, not activity",
      "Proactive communicator who surfaces risks before they escalate",
      "Thrives in collaborative environments that span multiple time zones",
      "Comfortable working US night shift hours",
      "Long-term relationship builder, not a transactional thinker",
    ],
    applyLink: APPLY_URL,
  },
  {
    id: 3,
    title: "Digital Marketing Specialist",
    pay: "₱45,000–₱72,000/mo",
    shift: "Flexible / hybrid",
    market: "AU/UK client",
    category: "Marketing",
    demand: "Growing demand",
    speed: "Fills in 18 days",
    fit: 88,
    hook: "Drive campaigns that scale brands globally.",
    why: "Your performance marketing background and multi-channel expertise put you in a strong position for AU/UK clients scaling digital acquisition.",
    tags: ["Remote", "Flexible hours", "Marketing", "Paid media", "AU/UK"],
    overview:
      "Digital Marketing Specialists at OnSpot execute and optimize performance marketing campaigns for AU and UK brands across paid, organic, and social channels. You're not just running ads — you're building growth engines.",
    description:
      "You'll work closely with client marketing teams to plan, launch, and iterate campaigns. From Meta and Google Ads to email sequences and SEO content briefs, you bring tactical precision and strategic thinking to every channel you manage.",
    responsibilities: [
      "Plan and execute paid media campaigns across Meta, Google, and LinkedIn",
      "Manage SEO strategy including technical audits, content briefs, and link-building",
      "Develop and analyze email marketing flows (Klaviyo, Mailchimp, ActiveCampaign)",
      "Report on campaign performance using GA4, Looker Studio, and platform dashboards",
      "Collaborate with creative teams on ad copy, landing pages, and A/B tests",
      "Monitor budgets, ROAS, and CPAs to optimize spend allocation",
    ],
    qualifications: [
      "3+ years in digital marketing with hands-on paid media and SEO experience",
      "Proficiency in Google Ads, Meta Ads Manager, and at least one email platform",
      "Strong analytical skills with experience in GA4 and attribution modeling",
      "Excellent English writing skills — you can write compelling ad copy and reports",
      "Comfortable working flexible hours across AU/UK time zones",
    ],
    preferredSkills: [
      "Experience in e-commerce or DTC brands targeting AU/UK markets",
      "Knowledge of CRO and landing page optimization",
      "Familiarity with HubSpot or other marketing automation platforms",
    ],
    benefits: [
      "Competitive PHP salary paid bi-weekly",
      "13th month pay and performance bonuses",
      "HMO coverage after 90 days",
      "Paid leave and Philippine public holiday observance",
      "Access to premium marketing tool subscriptions",
      "Remote-first with flexible scheduling",
    ],
    culturalFit: [
      "Analytically curious — you love testing, iterating, and improving",
      "Self-directed and comfortable owning campaigns end-to-end",
      "Collaborative with creative and client teams across time zones",
      "Stays current with digital marketing trends and platform changes",
      "Flexible communicator who adapts to AU/UK client culture",
    ],
    applyLink: APPLY_URL,
  },
  {
    id: 4,
    title: "Bookkeeper / Financial VA",
    pay: "₱42,000–₱68,000/mo",
    shift: "Day shift",
    market: "US/AU client",
    category: "Finance",
    demand: "Steady demand",
    speed: "Fills in 21 days",
    fit: 86,
    hook: "Keep the numbers clean — and the business clear.",
    why: "Your Xero/QuickBooks expertise and detail-oriented approach to financial reporting directly match what US and AU SMBs need in a trusted bookkeeping partner.",
    tags: ["Remote", "Day shift", "Finance", "Bookkeeping", "Xero/QB"],
    overview:
      "Bookkeepers and Financial VAs at OnSpot maintain accurate financial records for US and Australian small-to-mid businesses. You ensure month-end closes are clean, reconciliations are timely, and owners always have the numbers they need.",
    description:
      "You'll be embedded in the client's finance workflow, owning accounts payable/receivable, bank reconciliations, payroll support, and basic financial reporting. Precision and consistency are your trademarks.",
    responsibilities: [
      "Record daily transactions in Xero, QuickBooks, or MYOB",
      "Perform weekly and monthly bank and credit card reconciliations",
      "Manage accounts payable and receivable cycles",
      "Prepare profit & loss statements, balance sheets, and cash flow summaries",
      "Assist with payroll processing and superannuation (AU) or payroll tax (US)",
      "Liaise with the client's external accountant or CPA",
      "Flag discrepancies and resolve variance inquiries",
    ],
    qualifications: [
      "2+ years of bookkeeping or accounting experience",
      "Proficiency in Xero and/or QuickBooks (certification preferred)",
      "Understanding of AU GST or US sales tax principles",
      "High attention to detail and comfort working with large datasets",
      "Reliable day-shift availability aligned to client time zones",
    ],
    preferredSkills: [
      "Xero Advisor or QuickBooks ProAdvisor certification",
      "Experience with Dext, Hubdoc, or receipt management tools",
      "Background in e-commerce, real estate, or professional services bookkeeping",
    ],
    benefits: [
      "Competitive PHP salary paid bi-weekly",
      "13th month pay",
      "HMO coverage after 90 days",
      "Paid leave and sick leave",
      "Ongoing CPD support for accounting certifications",
      "Remote work with structured day-shift schedule",
    ],
    culturalFit: [
      "Detail-oriented and methodical — you catch errors before anyone else does",
      "Trustworthy with confidential financial data and client records",
      "Consistent and reliable — deadlines are non-negotiable",
      "Comfortable in day-shift schedules aligned to US/AU business hours",
      "Values accuracy and process discipline over shortcuts",
    ],
    applyLink: APPLY_URL,
  },
  {
    id: 5,
    title: "Technical Support Specialist",
    pay: "₱40,000–₱65,000/mo",
    shift: "Rotating shifts",
    market: "US/Global client",
    category: "Tech support",
    demand: "Always hiring",
    speed: "Fills in 7 days",
    fit: 89,
    hook: "Solve fast. Communicate clearly. Build trust.",
    why: "Your technical troubleshooting skills and calm customer-facing communication style are exactly what high-volume US tech companies need in a Tier 1–2 support specialist.",
    tags: ["Remote", "Rotating shifts", "Tech support", "SaaS", "Always hiring"],
    overview:
      "Technical Support Specialists at OnSpot serve as the front line of support for US and global SaaS, hardware, and tech product companies. You resolve tickets fast, communicate clearly, and escalate intelligently.",
    description:
      "You'll handle inbound tickets across email, chat, and phone, diagnosing issues, walking customers through solutions, and documenting cases. You're the customer's trusted guide through every technical challenge they face.",
    responsibilities: [
      "Handle Tier 1 and Tier 2 support tickets across email, live chat, and phone",
      "Diagnose software, hardware, and connectivity issues and guide users to resolution",
      "Document troubleshooting steps and maintain internal knowledge base articles",
      "Escalate complex or unresolved issues to engineering or Tier 3 support with full context",
      "Monitor ticket queues to meet SLA and CSAT targets",
      "Participate in product feedback loops with the product and engineering teams",
    ],
    qualifications: [
      "2+ years of technical support experience in a SaaS or tech product environment",
      "Strong written and verbal English communication skills",
      "Ability to explain technical concepts clearly to non-technical users",
      "Experience with helpdesk tools (Zendesk, Freshdesk, Intercom)",
      "Availability for rotating shift schedules including evenings and weekends",
    ],
    preferredSkills: [
      "Experience with API troubleshooting, log analysis, or browser DevTools",
      "Background in cybersecurity, networking, or cloud platforms (AWS, Azure)",
      "ITIL Foundation certification",
    ],
    benefits: [
      "Competitive PHP salary paid bi-weekly",
      "Night differential and shift allowances",
      "HMO coverage after 90 days (principal + 1 dependent)",
      "13th month pay and performance incentives",
      "Career path to Tier 3 specialist or team lead roles",
      "Remote-first with equipment support",
    ],
    culturalFit: [
      "Calm under pressure — you solve problems, not panic about them",
      "Patient and empathetic communicator with non-technical end users",
      "Adaptable to rotating shifts and varying workload volumes",
      "Documents processes clearly so the whole team benefits",
      "Genuinely curious about how technology works under the hood",
    ],
    applyLink: APPLY_URL,
  },
  {
    id: 6,
    title: "Sales Development Representative",
    pay: "₱38,000–₱62,000/mo + commission",
    shift: "Night shift",
    market: "US client",
    category: "Sales",
    demand: "High demand",
    speed: "Fills in 12 days",
    fit: 85,
    hook: "Fill pipelines. Start conversations that convert.",
    why: "Your outbound prospecting experience and high-energy approach to cold outreach align with what fast-growing US sales teams need to scale their top-of-funnel.",
    tags: ["Remote", "Night shift", "Sales", "SDR", "Commission", "High demand"],
    overview:
      "Sales Development Representatives at OnSpot generate qualified pipeline for US B2B companies through outbound prospecting via cold calls, LinkedIn, and email. You're the engine that starts every revenue conversation.",
    description:
      "You'll work closely with Account Executives and sales leadership to identify target accounts, personalize outreach sequences, and book high-quality discovery calls. This is a metrics-driven role with real commission upside.",
    responsibilities: [
      "Execute multi-channel outbound sequences (email, LinkedIn, cold call) to ICP targets",
      "Research prospects and personalize outreach to maximize response rates",
      "Qualify inbound leads from marketing and route them to the appropriate AE",
      "Book and confirm discovery calls using Calendly or Chili Piper",
      "Maintain accurate activity logs in Salesforce or HubSpot CRM",
      "Collaborate with marketing on campaign messaging and ABM lists",
      "Hit weekly and monthly SQL and meeting-set targets",
    ],
    qualifications: [
      "1–3 years of SDR or outbound sales experience (B2B preferred)",
      "Strong English communication skills — written and spoken",
      "Experience with sales engagement tools (Outreach, SalesLoft, Apollo)",
      "Comfort with cold calling and handling objections",
      "Availability for US night shift hours",
      "Self-motivated with a data-driven approach to hitting targets",
    ],
    preferredSkills: [
      "Experience selling into SMB or mid-market in SaaS, fintech, or HR tech",
      "LinkedIn Sales Navigator proficiency",
      "Familiarity with account-based marketing (ABM) strategies",
    ],
    benefits: [
      "Base PHP salary + uncapped commission on meetings set",
      "13th month pay and quarterly performance bonuses",
      "HMO coverage after 90 days",
      "Paid leave and Philippine holidays",
      "Sales career path to AE or sales management roles",
      "Remote-first with dedicated SDR coaching and playbooks",
    ],
    culturalFit: [
      "Competitive and driven — you thrive on hitting and exceeding targets",
      "Resilient and coachable — rejection doesn't slow you down for long",
      "Comfortable working US night shift hours",
      "Organized and disciplined with CRM hygiene and follow-up",
      "Team player who shares playbooks and celebrates wins together",
    ],
    applyLink: APPLY_URL,
  },
];

type Role = (typeof roles)[number];

function BulletRow({ text, color }: { text: string; color: string }) {
  return (
    <li className="flex items-start gap-3 text-base md:text-lg leading-7 md:leading-8 text-slate-700 dark:text-slate-300">
      <span className={`mt-[13px] h-2 w-2 shrink-0 rounded-full ${color}`} />
      {text}
    </li>
  );
}

function Section({
  icon,
  iconBg,
  label,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 px-6 py-10 dark:border-white/[0.08] md:px-12 md:py-12 lg:px-16">
      <div className="mb-6 flex items-center gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-white">{label}</h2>
      </div>
      {children}
    </div>
  );
}

/** True when a string contains rich HTML from the Quill editor */
function isHtml(str: string) {
  return str.trimStart().startsWith("<");
}

/** Renders a section body that may be either plain-text bullets or rich HTML */
function SectionBody({ items, bulletColor }: { items: string[]; bulletColor: string }) {
  if (items.length === 0) return null;
  if (items.length === 1 && isHtml(items[0])) {
    return (
      <div
        className="prose prose-slate max-w-none text-base md:text-lg leading-7 md:leading-8 dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: items[0] }}
      />
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((item, i) => (
        <BulletRow key={i} text={item} color={bulletColor} />
      ))}
    </ul>
  );
}

const CULTURAL_FIT_DEFAULTS = [
  "Thrives in a fast-paced, fully remote environment",
  "Communicates proactively with clients and team members",
  "Takes ownership and follows through on every deliverable",
  "Comfortable working US business hours (night shift PH)",
  "Values long-term partnerships over short-term engagements",
];

function DbJobDetail({ job, navigate }: { job: Job; navigate: (path: string) => void }) {
  const pay = buildRateDisplay(job);
  const badges = getJobBadges(job);
  const timeAgo = getTimeAgo(job.createdAt);

  // Determine if this is a remote role (location stores the work setup value)
  const isRemote = (job.location ?? "Remote").toLowerCase().includes("remote");

  // ── JSP field extraction with fallbacks to legacy array fields ──────────
  // Job Description: prefer JSP companyOverview + roleMission, else legacy description
  const companyOverview = (job as any).companyOverview as string | null | undefined;
  const roleMission     = (job as any).roleMission     as string | null | undefined;
  const hasJspDescription = !!(companyOverview?.trim() || roleMission?.trim());

  // Responsibilities: prefer JSP keyResponsibilities, else legacy responsibilities array
  const keyResponsibilities   = (job as any).keyResponsibilities   as string | null | undefined;
  const legacyResponsibilities = (job.responsibilities ?? []) as string[];

  // Skills Needed: prefer JSP skillsAndCompetencies, else legacy requirements array
  const skillsAndCompetencies = (job as any).skillsAndCompetencies as string | null | undefined;
  const legacyRequirements    = (job.requirements ?? []) as string[];

  // Cultural Fit (unchanged — falls back to defaults)
  const culturalFit = ((job.culturalFit ?? []) as string[]).length > 0
    ? (job.culturalFit as string[])
    : CULTURAL_FIT_DEFAULTS;

  // Remote-only requirement fields
  const minimumInternetSpeed = (job as any).minimumInternetSpeed as string | null | undefined;
  const systemRequirements   = (job as any).systemRequirements   as string | null | undefined;

  const tags = (job.skillTags ?? []) as string[];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.10),transparent_30%),linear-gradient(to_bottom,#f8fafc,white)] dark:bg-[#060816] dark:text-white">

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="relative overflow-hidden bg-gradient-to-br from-[#0d0f2d] via-[#141656] to-[#0d0f2d]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#474ead]/25 blur-[90px]" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-indigo-600/15 blur-[70px]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-8 md:px-12 lg:px-16">
          <button onClick={() => navigate("/find-work/jobs")}
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to All Jobs
          </button>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {badges.map((b) => (
              <span key={b.key} className={`rounded-full px-3 py-1 text-[11px] font-bold ${b.className}`}>{b.label}</span>
            ))}
            {badges.length === 0 && (
              <span className="rounded-full bg-[#474ead] px-3 py-1 text-[11px] font-bold text-white">Open</span>
            )}
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] text-white/60">Posted {timeAgo}</span>
          </div>

          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl lg:text-[42px]">{job.title}</h1>
          <p className="mt-2 text-base text-slate-400">{job.company ?? "OnSpot"}</p>

          <div className="mt-6 inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3">
            <DollarSign className="h-4 w-4 text-[#474ead]" />
            <div>
              <div className="text-[10px] text-white/40">Compensation (PHP)</div>
              <div className="text-sm font-bold text-white">{pay}</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { icon: MapPin, label: "Location", value: job.location ?? "Remote" },
              { icon: BriefcaseBusiness, label: "Category", value: job.category },
              { icon: Layers, label: "Contract", value: (job.contractType ?? "Full-time").replace(/-/g, " ") },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/40"><Icon className="h-3 w-3" /> {label}</div>
                <div className="mt-1 text-sm font-semibold capitalize text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            {(job as any).applicationMethod === "built_in_form" ? (
              <Button className="rounded-full bg-[#474ead] px-7 text-white hover:bg-[#3d439c]"
                onClick={() => navigate(`/jobs/${job.id}/apply`)}>
                Apply in 30 seconds <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : job.applyLink ? (
              <Button className="rounded-full bg-[#474ead] px-7 text-white hover:bg-[#3d439c]"
                onClick={() => window.open(job.applyLink!, "_blank", "noopener,noreferrer")}>
                Apply in 30 seconds <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled variant="outline" className="rounded-full px-7">
                Application link unavailable
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Body */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mx-auto max-w-4xl"
      >

        {/* Job Description — JSP (companyOverview + roleMission) or legacy description */}
        {hasJspDescription ? (
          <Section
            icon={<Globe2 className="h-5 w-5 text-indigo-500" />}
            iconBg="bg-indigo-50 dark:bg-indigo-900/30"
            label="Job Description"
          >
            {companyOverview?.trim() && (
              <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {companyOverview.trim()}
              </p>
            )}
            {roleMission?.trim() && (
              <p className={`text-base md:text-lg leading-7 md:leading-8 text-slate-600 dark:text-slate-300 whitespace-pre-wrap${companyOverview?.trim() ? " mt-5" : ""}`}>
                {roleMission.trim()}
              </p>
            )}
          </Section>
        ) : job.description ? (
          <Section
            icon={<Globe2 className="h-5 w-5 text-indigo-500" />}
            iconBg="bg-indigo-50 dark:bg-indigo-900/30"
            label="Job Description"
          >
            <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600 dark:text-slate-300">{job.description}</p>
          </Section>
        ) : null}

        {/* Responsibilities — JSP keyResponsibilities or legacy array */}
        {keyResponsibilities?.trim() ? (
          <Section
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            label="Responsibilities"
          >
            <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {keyResponsibilities.trim()}
            </p>
          </Section>
        ) : legacyResponsibilities.length > 0 ? (
          <Section
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            label="Responsibilities"
          >
            <SectionBody items={legacyResponsibilities} bulletColor="bg-blue-400" />
          </Section>
        ) : null}

        {/* Skills Needed — JSP skillsAndCompetencies or legacy requirements array */}
        {skillsAndCompetencies?.trim() ? (
          <Section
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
            label="Skills Needed"
          >
            <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {skillsAndCompetencies.trim()}
            </p>
          </Section>
        ) : legacyRequirements.length > 0 ? (
          <Section
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
            label="Skills Needed"
          >
            <SectionBody items={legacyRequirements} bulletColor="bg-emerald-500" />
          </Section>
        ) : null}

        {/* Cultural Fit */}
        <Section
          icon={<Sparkles className="h-5 w-5 text-[#474ead]" />}
          iconBg="bg-[#474ead]/10 dark:bg-[#474ead]/20"
          label="Cultural Fit"
        >
          <SectionBody items={culturalFit} bulletColor="bg-[#474ead]" />
        </Section>

        {/* Minimum Internet Speed */}
        {minimumInternetSpeed?.trim() && (
          <Section
            icon={<Wifi className="h-5 w-5 text-sky-500" />}
            iconBg="bg-sky-50 dark:bg-sky-900/30"
            label="Minimum Internet Speed"
          >
            <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600 dark:text-slate-300">
              {minimumInternetSpeed.trim()}
            </p>
          </Section>
        )}

        {/* System Requirements */}
        {systemRequirements?.trim() && (
          <Section
            icon={<Monitor className="h-5 w-5 text-slate-500" />}
            iconBg="bg-slate-100 dark:bg-white/[0.06]"
            label="System Requirements"
          >
            <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {systemRequirements.trim()}
            </p>
          </Section>
        )}

        {/* Skills & Tags */}
        {tags.length > 0 && (
          <Section
            icon={<Tag className="h-5 w-5 text-slate-400" />}
            iconBg="bg-slate-100 dark:bg-white/[0.06]"
            label="Skills & Tags"
          >
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Bottom CTA */}
        <div className="border-t border-slate-100 px-6 py-12 text-center dark:border-white/[0.08] md:px-12 lg:px-16">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Ready to join?</p>
          <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">Apply before this role fills.</h2>
          <p className="mb-8 text-slate-500">Takes under 30 seconds. Our team will reach out within 3 business days.</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {(job as any).applicationMethod === "built_in_form" ? (
              <Button
                className="rounded-full bg-[#474ead] px-10 py-2.5 text-white shadow-[0_8px_32px_rgba(71,78,173,0.25)] hover:bg-[#3d439c]"
                onClick={() => navigate(`/jobs/${job.id}/apply`)}
              >
                Apply Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : job.applyLink ? (
              <Button
                className="rounded-full bg-[#474ead] px-10 py-2.5 text-white shadow-[0_8px_32px_rgba(71,78,173,0.25)] hover:bg-[#3d439c]"
                onClick={() => window.open(job.applyLink!, "_blank", "noopener,noreferrer")}
              >
                Apply Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled variant="outline" className="rounded-full px-10">
                Application link unavailable
              </Button>
            )}
            <Button variant="outline" className="rounded-full px-6" onClick={() => navigate("/find-work/jobs")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> View all roles
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function FindWorkJob() {
  const params = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();

  const rawId = params.jobId ?? "";
  const numericId = parseInt(rawId, 10);
  const isStaticId = !isNaN(numericId) && numericId >= 1 && numericId <= 6 && String(numericId) === rawId;

  // Only fetch from DB for UUID-style IDs
  const { data: dbJob, isLoading, isError } = useQuery<Job>({
    queryKey: ["/api/admin/jobs", rawId],
    queryFn: async () => {
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const jobs: Job[] = await res.json();
      const found = jobs.find((j) => {
        if (j.id !== rawId) return false;
        const approval = (j as any).approvalStatus;
        return approval === "approved" || approval == null;
      });
      if (!found) throw new Error("Job not found");
      return found;
    },
    enabled: !isStaticId && !!rawId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Track job view once the job details are available
  useEffect(() => {
    if (isStaticId) {
      const staticRole = roles.find((r) => r.id === numericId);
      if (!staticRole) return;
      saveUserActivity({
        activityType: "JobView",
        referenceId: rawId,
        title: staticRole.title,
        category: staticRole.category,
        tags: staticRole.tags,
        page: "FindWorkJob",
      });
    } else if (dbJob) {
      saveUserActivity({
        activityType: "JobView",
        referenceId: dbJob.id,
        title: dbJob.title,
        category: dbJob.category ?? undefined,
        tags: dbJob.skillTags ?? undefined,
        page: "FindWorkJob",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbJob, isStaticId, rawId]);

  // Loading state for DB jobs
  if (!isStaticId && isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
        <p className="text-slate-500">Loading role details…</p>
      </div>
    );
  }

  // DB job found — render with DB detail view
  if (!isStaticId && dbJob) {
    return <DbJobDetail job={dbJob} navigate={navigate} />;
  }

  // Static fallback lookup
  const role: Role | undefined = roles.find((r) => r.id === numericId);

  if (!role) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06]">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Job not found</h1>
          <p className="mt-2 text-slate-500">This role may have been filled or removed.</p>
        </div>
        <Button
          className="rounded-full bg-[#474ead] px-6 text-white"
          onClick={() => navigate("/find-work/jobs")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Find Work
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.10),transparent_30%),linear-gradient(to_bottom,#f8fafc,white)] dark:bg-[#060816] dark:text-white">

      {/* ── HERO HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative overflow-hidden bg-[#0f172a]"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#474ead]/25 blur-[90px]" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-indigo-600/15 blur-[70px]" />

        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-8 md:px-12 lg:px-16">

          {/* Back link */}
          <button
            onClick={() => navigate("/find-work/jobs")}
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Find Work
          </button>

          {/* Badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#474ead] px-3 py-1 text-[11px] font-bold text-white">{role.demand}</span>
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] text-white/60">{role.speed}</span>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-400">{role.fit}% match</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl lg:text-[42px]">{role.title}</h1>
          <p className="mt-2 text-base text-slate-400">{role.hook}</p>

          {/* Salary pill */}
          <div className="mt-6 inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3">
            <DollarSign className="h-4 w-4 text-[#474ead]" />
            <div>
              <div className="text-[10px] text-white/40">Monthly salary (PHP)</div>
              <div className="text-sm font-bold text-white">{role.pay}</div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { Icon: Clock3,            label: "Schedule",  value: role.shift    },
              { Icon: Globe2,            label: "Market",    value: role.market   },
              { Icon: BriefcaseBusiness, label: "Category",  value: role.category },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <Icon className="h-3 w-3" />{label}
                </div>
                <div className="mt-1 text-sm font-bold text-white/90">{value}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap gap-3">
            {(job as any).applicationMethod === "built_in_form" ? (
              <Button
                className="rounded-full bg-[#474ead] px-8 py-2.5 text-white"
                onClick={() => navigate(`/jobs/${job.id}/apply`)}
              >
                Apply Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : job.applyLink ? (
              <Button
                className="rounded-full bg-[#474ead] px-8 py-2.5 text-white"
                onClick={() => window.open(job.applyLink!, "_blank", "noopener,noreferrer")}
              >
                Apply Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled variant="outline" className="rounded-full px-8">
                Application link unavailable
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── BODY SECTIONS ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-4xl"
      >

        {/* Why you're a fit */}
        <div className="bg-[#474ead]/[0.04] px-6 py-8 md:px-12 lg:px-16">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#474ead]" />
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Why you're a fit</p>
              <p className="text-[15px] leading-7 text-slate-700 dark:text-slate-300">{role.why}</p>
            </div>
          </div>
        </div>

        {/* Overview */}
        <Section
          icon={<Globe2 className="h-4 w-4 text-indigo-500" />}
          iconBg="bg-indigo-50 dark:bg-indigo-900/30"
          label="Overview"
        >
          <p className="text-[15px] leading-8 text-slate-600 dark:text-slate-300">{role.overview}</p>
        </Section>

        {/* About this role */}
        <Section
          icon={<BriefcaseBusiness className="h-4 w-4 text-slate-500" />}
          iconBg="bg-slate-100 dark:bg-white/[0.06]"
          label="About this role"
        >
          <p className="text-[15px] leading-8 text-slate-600 dark:text-slate-300">{role.description}</p>
        </Section>

        {/* Responsibilities */}
        <Section
          icon={<ListChecks className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          label="Responsibilities"
        >
          <ul className="space-y-4">
            {role.responsibilities.map((item, i) => (
              <BulletRow key={i} text={item} color="bg-blue-400" />
            ))}
          </ul>
        </Section>

        {/* Qualifications */}
        <Section
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          label="Qualifications"
        >
          <ul className="space-y-4">
            {role.qualifications.map((item, i) => (
              <BulletRow key={i} text={item} color="bg-emerald-500" />
            ))}
          </ul>
        </Section>

        {/* Cultural Fit */}
        <Section
          icon={<Sparkles className="h-5 w-5 text-[#474ead]" />}
          iconBg="bg-[#474ead]/10 dark:bg-[#474ead]/20"
          label="Cultural Fit"
        >
          <ul className="space-y-4">
            {role.culturalFit.map((item, i) => (
              <BulletRow key={i} text={item} color="bg-[#474ead]" />
            ))}
          </ul>
        </Section>

        {/* Preferred skills */}
        {role.preferredSkills.length > 0 && (
          <Section
            icon={<Award className="h-5 w-5 text-amber-500" />}
            iconBg="bg-amber-50 dark:bg-amber-900/30"
            label="Preferred skills (nice to have)"
          >
            <ul className="space-y-4">
              {role.preferredSkills.map((item, i) => (
                <BulletRow key={i} text={item} color="bg-amber-400" />
              ))}
            </ul>
          </Section>
        )}

        {/* Benefits */}
        <Section
          icon={<Gift className="h-5 w-5 text-purple-500" />}
          iconBg="bg-purple-50 dark:bg-purple-900/30"
          label="Benefits & perks"
        >
          <ul className="space-y-4">
            {role.benefits.map((item, i) => (
              <BulletRow key={i} text={item} color="bg-purple-400" />
            ))}
          </ul>
        </Section>

        {/* Tags */}
        <Section
          icon={<Tag className="h-5 w-5 text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-white/[0.06]"
          label="Tags"
        >
          <div className="flex flex-wrap gap-2">
            {role.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>

        {/* ── BOTTOM CTA ── */}
        <div className="border-t border-slate-100 px-6 py-12 text-center dark:border-white/[0.08] md:px-12 lg:px-16">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Ready to apply?</p>
          <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
            This role fills in {role.speed.replace("Fills in ", "")}
          </h2>
          <p className="mb-8 text-slate-500">Don't wait — top candidates are already in the process.</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {role.applyLink ? (
              <Button
                className="rounded-full bg-[#474ead] px-10 py-2.5 text-white"
                onClick={() => window.open(role.applyLink!, "_blank", "noopener,noreferrer")}
              >
                Apply in 30 seconds <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled variant="outline" className="rounded-full px-10">
                Application not available
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => navigate("/find-work/jobs")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              View all roles
            </Button>
          </div>
          <p className="mt-6 text-xs text-slate-400">OnSpot · Philippines · {role.market}</p>
        </div>
      </motion.div>
    </div>
  );
}
