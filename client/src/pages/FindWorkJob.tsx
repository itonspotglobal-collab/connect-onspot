import { useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Sparkles, Star, Clock3, Globe2,
  BriefcaseBusiness, DollarSign, ListChecks, CheckCircle2,
  Award, Gift, Tag, AlertCircle, MapPin, Layers, Loader2,
  Wifi, Monitor, CalendarDays, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { buildRateDisplay, buildRateDisplayWithCode, getJobBadges, getTimeAgo, getEffectiveCurrencyCode, getPublicCompanyName, getPublicCompanyDescription } from "@/lib/jobUtils";
import { saveUserActivity } from "@/lib/userActivityMemory";
import { BenefitsDisplay } from "@/components/BenefitsDisplay";


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
  },
];

type Role = (typeof roles)[number];

function BulletRow({ text, color }: { text: string; color: string }) {
  return (
    <li className={`flex items-start gap-2.5 ${contentTextClass}`}>
      <span className={`mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
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
    <div className="border-t border-slate-100 px-5 py-7 dark:border-white/[0.08] md:px-8 md:py-8">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-white">{label}</h2>
      </div>
      {children}
    </div>
  );
}

/** True when a string contains rich HTML from the Quill editor */
function isHtml(str: string) {
  return str.trimStart().startsWith("<");
}

/**
 * Extract text/HTML of each <li> from a Quill HTML string.
 * Returns null when no list items are found (fallback to prose rendering).
 */
function parseListItems(html: string): string[] | null {
  const matches = html.match(/<li(?:[^>]*)>([\s\S]*?)<\/li>/g);
  if (!matches || matches.length === 0) return null;
  return matches.map((m) => m.replace(/^<li[^>]*>/, "").replace(/<\/li>$/, "").trim());
}

/**
 * Renders a "What We Offer" Quill HTML string as a 2-column bullet grid on
 * desktop and a 1-column list on mobile.  Falls back to prose when the HTML
 * has no recognisable list items (paragraphs, headings, etc.).
 */
function WhatWeOfferGrid({ html }: { html: string }) {
  const items = parseListItems(html);
  if (items && items.length > 0) {
    return (
      <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-base leading-7 text-slate-600 dark:text-slate-300">
            <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    );
  }
  // Fallback — rich prose (paragraphs, nested lists, etc.)
  return (
    <div
      className="prose prose-slate max-w-3xl text-base leading-7 dark:prose-invert prose-li:text-left prose-li:leading-7"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Shared class for all long-form paragraph and list-item text */
const contentTextClass =
  "text-left sm:text-justify text-base leading-7 text-slate-600 dark:text-slate-300";

/** Renders a section body that may be either plain-text bullets or rich HTML */
function SectionBody({ items, bulletColor }: { items: string[]; bulletColor: string }) {
  if (items.length === 0) return null;
  if (items.length === 1 && isHtml(items[0])) {
    return (
      <div
        className="prose prose-slate max-w-3xl text-base leading-7 dark:prose-invert prose-p:text-left sm:prose-p:text-justify prose-li:text-left sm:prose-li:text-justify prose-p:leading-7 prose-li:leading-7"
        dangerouslySetInnerHTML={{ __html: items[0] }}
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <BulletRow key={i} text={item} color={bulletColor} />
      ))}
    </ul>
  );
}

/** Score DB jobs against the current job; returns top N excluding itself.
 *  Priority: 1. Same Function  2. Same Contract Type  3. Same Work Setup  4. Tag overlap
 *  Falls back to filling remaining slots with any other open job (already filtered open). */
function getSimilarDbJobs(currentJob: Job, allJobs: Job[], limit = 3): Job[] {
  const currentFunction = ((currentJob as any).jobFunction ?? currentJob.category ?? "").toLowerCase().trim();
  const currentContract = (currentJob.contractType ?? "").toLowerCase().trim();
  const currentLocation = (currentJob.location ?? "").toLowerCase().trim();
  const currentTags = new Set((currentJob.skillTags ?? []).map((t) => t.toLowerCase()));

  const scored = allJobs
    .filter((j) => j.id !== currentJob.id)
    .map((j) => {
      let score = 0;
      // Priority 1 — same job function
      const jFunction = ((j as any).jobFunction ?? j.category ?? "").toLowerCase().trim();
      if (currentFunction && jFunction === currentFunction) score += 3;
      // Priority 2 — same contract type
      if (currentContract && (j.contractType ?? "").toLowerCase().trim() === currentContract) score += 2;
      // Priority 3 — same work setup / location
      if (currentLocation && (j.location ?? "").toLowerCase().trim() === currentLocation) score += 1;
      // Skill tag overlap (bonus)
      const jTags = (j.skillTags ?? []).map((t) => t.toLowerCase());
      score += jTags.filter((t) => currentTags.has(t)).length;
      return { job: j, score };
    })
    .sort((a, b) => b.score - a.score);

  // Take jobs with at least one matching signal first
  const top = scored.filter(({ score }) => score > 0).slice(0, limit).map(({ job }) => job);
  if (top.length >= limit) return top;

  // Fill remaining slots with deduplicated open jobs (sorted by score desc)
  const topIds = new Set(top.map((j) => j.id));
  const extras = scored
    .filter(({ job }) => !topIds.has(job.id))
    .slice(0, limit - top.length)
    .map(({ job }) => job);

  return [...top, ...extras];
}
function DbJobDetail({ job, navigate }: { job: Job; navigate: (path: string) => void }) {
  const pay = buildRateDisplayWithCode(job);
  const badges = getJobBadges(job);
  const timeAgo = getTimeAgo((job as any).postedAt || job.createdAt);

  // ── Field extraction ───────────────────────────────────────────────────────

  // "About the Company" — use helper so confidential jobs never reveal overview
  const companyOverview = getPublicCompanyDescription(job as any);

  // "About the Role" — prefer JSP roleMission, fall back to legacy description
  const roleMission = (job as any).roleMission as string | null | undefined;
  const aboutTheRole = roleMission?.trim() || job.description?.trim() || "";

  // "Key Responsibilities" — prefer JSP keyResponsibilities, else legacy array
  const keyResponsibilities  = (job as any).keyResponsibilities as string | null | undefined;
  const legacyResponsibilities = (job.responsibilities ?? []) as string[];

  // "Required Qualifications" — prefer JSP skillsAndCompetencies, else legacy array
  const skillsAndCompetencies = (job as any).skillsAndCompetencies as string | null | undefined;
  const legacyRequirements    = (job.requirements ?? []) as string[];

  // Cultural Fit — only shown when the job has actual saved data (no default fallback)
  const culturalFitData = (job.culturalFit ?? []) as string[];
  const hasCulturalFit = culturalFitData.length > 0 && culturalFitData.some((s) => s.trim());

  // "Required Tools & Equipment"
  const minimumInternetSpeed       = (job as any).minimumInternetSpeed       as string | null | undefined;
  const systemRequirements         = (job as any).systemRequirements         as string | null | undefined;
  const requiredToolsSoftware      = (job as any).requiredToolsSoftware      as string | null | undefined;
  const otherEquipmentRequirements = (job as any).otherEquipmentRequirements as string | null | undefined;
  const hasToolsSection = !!(
    minimumInternetSpeed?.trim() || systemRequirements?.trim() ||
    requiredToolsSoftware?.trim() || otherEquipmentRequirements?.trim()
  );

  // "Preferred Qualifications"
  const preferredQualifications = (job as any).preferredQualifications as string | null | undefined;

  // "Work Schedule"
  const workDays            = (job as any).workDays            as string | null | undefined;
  const timeZone            = (job as any).timeZone            as string | null | undefined;
  const weeklyHours         = (job as any).weeklyHours         as string | null | undefined;
  const scheduleFlexibility = (job as any).scheduleFlexibility as string | null | undefined;
  const hasWorkSchedule     = !!(workDays?.trim() || timeZone?.trim() || weeklyHours?.trim() || scheduleFlexibility?.trim());

  // "What We Offer" extra content
  const whatWeOfferContent = (job as any).whatWeOffer as string | null | undefined;

  // Compensation extras
  const paymentFrequency  = (job as any).paymentFrequency  as string | null | undefined;
  const compensationNotes = (job as any).compensationNotes as string | null | undefined;

  // Compensation
  const currencyCode = getEffectiveCurrencyCode((job as any).budgetCurrency, (job as any).customCurrencyCode);

  // "What We Offer"
  const benefitsStr = ((job as any).benefits as string | null | undefined)?.trim() ?? "";
  const hasCommission = !!(job as any).hasCommission;
  const hasEquity     = !!(job as any).hasEquity;
  // Commission/Equity are now shown in the Compensation section only (no duplication in What We Offer)
  const hasWhatWeOffer = !!(benefitsStr || whatWeOfferContent?.trim());

  const tags = (job.skillTags ?? []) as string[];

  // ── Apply button helper ────────────────────────────────────────────────────
  function ApplyButton({ size = "default" }: { size?: "default" | "large" }) {
    const px = size === "large" ? "px-10 py-2.5" : "px-7";
    const cls = `rounded-full bg-[#474ead] ${px} text-white shadow-[0_8px_32px_rgba(71,78,173,0.20)] hover:bg-[#3d439c]`;
    if ((job as any).applicationMethod === "built_in_form") {
      return (
        <Button className={cls} onClick={() => navigate(`/jobs/${job.id}/apply`)}>
          Apply Now
        </Button>
      );
    }
    if (job.applyLink) {
      return (
        <Button className={cls} onClick={() => window.open(job.applyLink!, "_blank", "noopener,noreferrer")}>
          Apply Now
        </Button>
      );
    }
    return (
      <Button disabled variant="outline" className="rounded-full px-7">
        Application link unavailable
      </Button>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.10),transparent_30%),linear-gradient(to_bottom,#f8fafc,white)] dark:bg-[#060816] dark:text-white">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="relative overflow-hidden bg-gradient-to-br from-[#0d0f2d] via-[#141656] to-[#0d0f2d]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#474ead]/25 blur-[90px]" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-indigo-600/15 blur-[70px]" />
        <div className="relative mx-auto max-w-5xl px-5 pb-8 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">

          {/* Back link */}
          <button onClick={() => navigate("/find-work/jobs#job-openings")}
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to All Jobs
          </button>

          {/* Status badges + posted age */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {(job as any).isFeatured && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold text-amber-300 ring-1 ring-amber-300/30">
                <Star className="h-3 w-3" aria-hidden="true" /> Featured
              </span>
            )}
            {badges.map((b) => (
              <span key={b.key} className={`rounded-full px-3 py-1 text-[11px] font-bold ${b.className}`}>{b.label}</span>
            ))}
            {badges.length === 0 && (
              <span className="rounded-full bg-[#474ead] px-3 py-1 text-[11px] font-bold text-white">Open</span>
            )}
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] text-white/60">
              {timeAgo === "Just posted" ? "Just posted" : `Posted ${timeAgo}`}
            </span>
          </div>

          {/* Job title + sub-role + company */}
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
            {(job as any).professionalRoleName || job.title}
          </h1>
          {(job as any).originalRoleName && (
            <p className="mt-1.5 text-base italic text-slate-400">{(job as any).originalRoleName}</p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-base text-slate-400">
            {getPublicCompanyName(job as any)}
          </p>

          {/* Compensation pill */}
          <div className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3">
            <div>
              <div className="text-[10px] text-white/40">Monthly Compensation</div>
              <div className="text-sm font-bold text-white">{pay}</div>
            </div>
          </div>

          {/* Location / Function / Contract compact cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { icon: MapPin,             label: "Location", value: job.location ?? "Remote" },
              { icon: BriefcaseBusiness, label: "Function", value: (job as any).jobFunction || job.category },
              { icon: Layers,            label: "Engagement", value: (job.contractType ?? "Full-time").replace(/-/g, " ") },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/40"><Icon className="h-3 w-3" /> {label}</div>
                <div className="mt-1 text-sm font-semibold capitalize text-white">{value}</div>
              </div>
            ))}
          </div>

          {/* Apply button */}
          <div className="mt-6 flex gap-3">
            <ApplyButton />
          </div>
        </div>
      </motion.div>

      {/* ── BODY ─────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mx-auto max-w-5xl"
      >

        {/* 1. About the Company */}
        {companyOverview?.trim() && (
          <Section
            icon={<Globe2 className="h-5 w-5 text-indigo-500" />}
            iconBg="bg-indigo-50 dark:bg-indigo-900/30"
            label="About the Company"
          >
            <p className={`max-w-3xl whitespace-pre-wrap ${contentTextClass}`}>
              {companyOverview.trim()}
            </p>
          </Section>
        )}

        {/* 2. About the Role — roleMission (JSP) or description (legacy) */}
        {aboutTheRole && (
          <Section
            icon={<BriefcaseBusiness className="h-5 w-5 text-slate-500" />}
            iconBg="bg-slate-100 dark:bg-white/[0.06]"
            label="About the Role"
          >
            {isHtml(aboutTheRole) ? (
              <div
                className="prose prose-slate max-w-3xl text-base leading-7 dark:prose-invert prose-p:text-left sm:prose-p:text-justify prose-li:text-left sm:prose-li:text-justify prose-p:leading-7 prose-li:leading-7"
                dangerouslySetInnerHTML={{ __html: aboutTheRole }}
              />
            ) : (
              <p className={`max-w-3xl whitespace-pre-wrap ${contentTextClass}`}>{aboutTheRole}</p>
            )}
          </Section>
        )}

        {/* 3. Key Responsibilities */}
        {keyResponsibilities?.trim() ? (
          <Section
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            label="Key Responsibilities"
          >
            <SectionBody items={[keyResponsibilities.trim()]} bulletColor="bg-blue-400" />
          </Section>
        ) : legacyResponsibilities.length > 0 ? (
          <Section
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            label="Key Responsibilities"
          >
            <SectionBody items={legacyResponsibilities} bulletColor="bg-blue-400" />
          </Section>
        ) : null}

        {/* 4. Required Qualifications */}
        {skillsAndCompetencies?.trim() ? (
          <Section
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
            label="Required Qualifications"
          >
            <SectionBody items={[skillsAndCompetencies.trim()]} bulletColor="bg-emerald-500" />
          </Section>
        ) : legacyRequirements.length > 0 ? (
          <Section
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
            label="Required Qualifications"
          >
            <SectionBody items={legacyRequirements} bulletColor="bg-emerald-500" />
          </Section>
        ) : null}

        {/* 5. Preferred Qualifications — only shown when populated */}
        {preferredQualifications?.trim() && (
          <Section
            icon={<Award className="h-5 w-5 text-violet-500" />}
            iconBg="bg-violet-50 dark:bg-violet-900/30"
            label="Preferred Qualifications"
          >
            <SectionBody items={[preferredQualifications.trim()]} bulletColor="bg-violet-400" />
          </Section>
        )}

        {/* 6. Cultural Fit — only shown when the job has actual saved data */}
        {hasCulturalFit && (
          <Section
            icon={<Sparkles className="h-5 w-5 text-[#474ead]" />}
            iconBg="bg-[#474ead]/10 dark:bg-[#474ead]/20"
            label="Cultural Fit"
          >
            <SectionBody items={culturalFitData} bulletColor="bg-[#474ead]" />
          </Section>
        )}

        {/* 7. Required Tools & Equipment */}
        {hasToolsSection && (
          <Section
            icon={<Monitor className="h-5 w-5 text-sky-500" />}
            iconBg="bg-sky-50 dark:bg-sky-900/30"
            label="Required Tools & Equipment"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {minimumInternetSpeed?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Wifi className="h-3.5 w-3.5" /> Minimum Internet Speed
                  </div>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{minimumInternetSpeed.trim()}</p>
                </div>
              )}
              {systemRequirements?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Monitor className="h-3.5 w-3.5" /> System &amp; Equipment
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{systemRequirements.trim()}</p>
                </div>
              )}
              {requiredToolsSoftware?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Wrench className="h-3.5 w-3.5" /> Required Tools / Software
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{requiredToolsSoftware.trim()}</p>
                </div>
              )}
              {otherEquipmentRequirements?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Monitor className="h-3.5 w-3.5" /> Other Equipment
                  </div>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{otherEquipmentRequirements.trim()}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 8. Work Schedule — only shown when at least one field is populated */}
        {hasWorkSchedule && (
          <Section
            icon={<CalendarDays className="h-5 w-5 text-indigo-500" />}
            iconBg="bg-indigo-50 dark:bg-indigo-900/30"
            label="Work Schedule"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {workDays?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Days</div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{workDays.trim()}</p>
                </div>
              )}
              {timeZone?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Time Zone</div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{timeZone.trim()}</p>
                </div>
              )}
              {weeklyHours?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Weekly Hours</div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{weeklyHours.trim()}</p>
                </div>
              )}
              {scheduleFlexibility?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Flexibility</div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{scheduleFlexibility.trim()}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 9. Compensation — monthly only; Commission/Equity shown here (not duplicated in What We Offer) */}
        {pay && (
          <Section
            icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
            label="Compensation"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Currency</div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{currencyCode}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Monthly Rate</div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{pay}</p>
              </div>
              {paymentFrequency?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Payment Frequency</div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{paymentFrequency.trim()}</p>
                </div>
              )}
              {(hasCommission || hasEquity) && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Additional Compensation</div>
                  <div className="flex flex-wrap gap-2">
                    {hasCommission && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                        Commission
                      </span>
                    )}
                    {hasEquity && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 dark:bg-purple-400/15 dark:text-purple-300">
                        Equity
                      </span>
                    )}
                  </div>
                </div>
              )}
              {compensationNotes?.trim() && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{compensationNotes.trim()}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 10. What We Offer — 2-col bullet grid on desktop, 1-col on mobile; benefits tags below */}
        {hasWhatWeOffer && (
          <Section
            icon={<Gift className="h-5 w-5 text-purple-500" />}
            iconBg="bg-purple-50 dark:bg-purple-900/30"
            label="What We Offer"
          >
            {whatWeOfferContent?.trim() && (
              <div className={benefitsStr ? "mb-6" : ""}>
                <WhatWeOfferGrid html={whatWeOfferContent.trim()} />
              </div>
            )}
            {benefitsStr && (
              <div className={whatWeOfferContent?.trim() ? "border-t border-slate-100 pt-4 dark:border-white/[0.08]" : ""}>
                <BenefitsDisplay benefits={benefitsStr} />
              </div>
            )}
          </Section>
        )}

        {/* 9. Skills & Tags */}
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
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* 10. Ready to Apply CTA — text only (buttons follow the disclaimer) */}
        <div className="border-t border-slate-100 px-5 pb-0 pt-10 text-center dark:border-white/[0.08] md:px-8 md:pt-12">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Ready to apply?</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Apply for this role today.
          </h2>
          <p className="mt-2 text-sm text-slate-500 md:text-base">
            Takes under 30 seconds. Our team reviews and reaches out within 3 business days.
          </p>

          {/* Independent Contractor Disclaimer */}
          {/* ⚠ Legal note: the disclaimer copy below has NOT been reviewed by legal counsel.
              Replace with approved text before production launch. */}
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-left dark:border-amber-800/40 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Independent Contractor Engagement
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  This is an independent contractor engagement, not an employment arrangement. As a
                  contractor, you are responsible for your own taxes, government contributions
                  (SSS, PhilHealth, Pag-IBIG), and professional expenses. Mandatory employee
                  benefits do not apply. Please review the full terms before applying.
                </p>
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="mt-6 flex flex-col items-center justify-center gap-3 pb-10 sm:flex-row md:pb-12">
            <ApplyButton size="large" />
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => navigate("/find-work/jobs")}
            >
              View all roles
            </Button>
          </div>
        </div>

        {/* 11. Similar roles */}
        <DbSimilarJobsSection currentJob={job} navigate={navigate} />

      </motion.div>

      {/* Compact page footer */}
      <footer className="bg-gradient-to-br from-[#1A1836] to-[#2A2760] py-6 text-sm text-white/60">
        <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 OnSpot Global — One marketplace connecting the world's best talent and clients.</span>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/terms-and-conditions" className="transition-colors hover:text-white">
                Terms
              </Link>
              <Link href="/privacy-policy" className="transition-colors hover:text-white">
                Privacy
              </Link>
              {/* /contractor-agreement route not yet created — rendered non-clickable */}
              <span className="cursor-default opacity-50" title="Page coming soon">
                Contractor Agreement
              </span>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function FindWorkJob() {
  const params = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();

  const rawId = params.jobId ?? "";
  const numericId = parseInt(rawId, 10);
  const isStaticId = !isNaN(numericId) && numericId >= 1 && numericId <= 6 && String(numericId) === rawId;

  // Only fetch from DB for UUID-style IDs — use the public single-job endpoint
  const { data: dbJob, isLoading, isError, error } = useQuery<Job>({
    queryKey: ["/api/jobs", rawId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${encodeURIComponent(rawId)}`);
      if (res.status === 404) throw new Error("NOT_FOUND");
      if (!res.ok) throw new Error("FETCH_ERROR");
      return res.json();
    },
    enabled: !isStaticId && !!rawId,
    staleTime: 5 * 60 * 1000,
    retry: false,
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
      // Increment server-side view count once per browser session per job.
      // Include the updatedAt timestamp so a materially changed job resets
      // the guard and counts the re-visit as a genuine new view.
      const versionTag = dbJob.updatedAt
        ? new Date(dbJob.updatedAt).getTime()
        : "0";
      const sessionKey = `viewed_job_${dbJob.id}_v${versionTag}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        fetch(`/api/jobs/${dbJob.id}/view`, { method: "POST" }).catch(() => {});
      }
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

  // Error state — distinguish 404 from server/network failures
  if (!isStaticId && isError) {
    const is404 = (error as Error)?.message === "NOT_FOUND";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06]">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {is404 ? "Job not found" : "Unable to load this job right now"}
          </h1>
          <p className="mt-2 text-slate-500">
            {is404
              ? "This role may have been filled, removed, or is no longer public."
              : "Please try again or browse all open roles."}
          </p>
        </div>
        <Button
          className="rounded-full bg-[#474ead] px-6 text-white"
          onClick={() => navigate("/find-work/jobs")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Find Work
        </Button>
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

        <div className="relative mx-auto max-w-5xl px-5 pb-8 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">

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
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">{role.title}</h1>
          <p className="mt-2 text-base text-slate-400">{role.hook}</p>

          {/* Salary pill */}
          <div className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3">
            <div>
              <div className="text-[10px] text-white/40">Monthly salary</div>
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

          {/* CTA — static roles navigate to the jobs listing */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              className="rounded-full bg-[#474ead] px-8 py-2.5 text-white"
              onClick={() => navigate("/find-work/jobs")}
            >
              Apply Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── BODY SECTIONS ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-5xl"
      >

        {/* Why you're a fit */}
        <div className="bg-[#474ead]/[0.04] px-5 py-6 md:px-8">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#474ead]" />
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Why you're a fit</p>
              <p className="text-left sm:text-justify text-[15px] leading-7 text-slate-700 dark:text-slate-300">{role.why}</p>
            </div>
          </div>
        </div>

        {/* Overview */}
        <Section
          icon={<Globe2 className="h-4 w-4 text-indigo-500" />}
          iconBg="bg-indigo-50 dark:bg-indigo-900/30"
          label="Overview"
        >
          <p className={`max-w-3xl ${contentTextClass}`}>{role.overview}</p>
        </Section>

        {/* About the Role */}
        <Section
          icon={<BriefcaseBusiness className="h-4 w-4 text-slate-500" />}
          iconBg="bg-slate-100 dark:bg-white/[0.06]"
          label="About the Role"
        >
          <p className={`max-w-3xl ${contentTextClass}`}>{role.description}</p>
        </Section>

        {/* Key Responsibilities */}
        <Section
          icon={<ListChecks className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          label="Key Responsibilities"
        >
          <ul className="space-y-2">
            {role.responsibilities.map((item, i) => (
              <BulletRow key={i} text={item} color="bg-blue-400" />
            ))}
          </ul>
        </Section>

        {/* Required Qualifications */}
        <Section
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          label="Required Qualifications"
        >
          <ul className="space-y-2">
            {role.qualifications.map((item, i) => (
              <BulletRow key={i} text={item} color="bg-emerald-500" />
            ))}
          </ul>
        </Section>

        {/* Preferred Qualifications — before Cultural Fit */}
        {role.preferredSkills.length > 0 && (
          <Section
            icon={<Award className="h-5 w-5 text-violet-500" />}
            iconBg="bg-violet-50 dark:bg-violet-900/30"
            label="Preferred Qualifications"
          >
            <ul className="space-y-2">
              {role.preferredSkills.map((item, i) => (
                <BulletRow key={i} text={item} color="bg-violet-400" />
              ))}
            </ul>
          </Section>
        )}

        {/* Cultural Fit */}
        <Section
          icon={<Sparkles className="h-5 w-5 text-[#474ead]" />}
          iconBg="bg-[#474ead]/10 dark:bg-[#474ead]/20"
          label="Cultural Fit"
        >
          <ul className="space-y-2">
            {role.culturalFit.map((item, i) => (
              <BulletRow key={i} text={item} color="bg-[#474ead]" />
            ))}
          </ul>
        </Section>

        {/* What We Offer */}
        <Section
          icon={<Gift className="h-5 w-5 text-purple-500" />}
          iconBg="bg-purple-50 dark:bg-purple-900/30"
          label="What We Offer"
        >
          <ul className="space-y-2">
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
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>

        {/* Ready to Apply CTA — text only (buttons follow the disclaimer) */}
        <div className="border-t border-slate-100 px-5 pb-0 pt-10 text-center dark:border-white/[0.08] md:px-8 md:pt-12">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Ready to apply?</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Apply for this role today.
          </h2>
          <p className="mt-2 text-sm text-slate-500 md:text-base">
            Takes under 30 seconds. Our team reviews and reaches out within 3 business days.
          </p>

          {/* Independent Contractor Disclaimer */}
          {/* ⚠ Legal note: the disclaimer copy below has NOT been reviewed by legal counsel.
              Replace with approved text before production launch. */}
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-left dark:border-amber-800/40 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Independent Contractor Engagement
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  This is an independent contractor engagement, not an employment arrangement. As a
                  contractor, you are responsible for your own taxes, government contributions
                  (SSS, PhilHealth, Pag-IBIG), and professional expenses. Mandatory employee
                  benefits do not apply. Please review the full terms before applying.
                </p>
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="mt-6 flex flex-col items-center justify-center gap-3 pb-10 sm:flex-row md:pb-12">
            <Button
              className="rounded-full bg-[#474ead] px-10 py-2.5 text-white shadow-[0_8px_32px_rgba(71,78,173,0.20)] hover:bg-[#3d439c]"
              onClick={() => navigate("/find-work/jobs")}
            >
              Apply Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => navigate("/find-work/jobs")}
            >
              View all roles
            </Button>
          </div>
        </div>

        {/* Similar static roles strip */}
        {(() => {
          const similar = getSimilarStaticRoles(role.id, 3);
          if (similar.length === 0) return null;
          return (
            <div className="border-t border-slate-100 px-5 py-8 dark:border-white/[0.08] md:px-8">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#474ead]" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Similar projects you might like</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {similar.map((r) => (
                  <StaticSimilarCard key={r.id} role={r} navigate={navigate} />
                ))}
              </div>
            </div>
          );
        })()}

      </motion.div>

      {/* Compact page footer */}
      <footer className="bg-gradient-to-br from-[#1A1836] to-[#2A2760] py-6 text-sm text-white/60">
        <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 OnSpot Global — One marketplace connecting the world's best talent and clients.</span>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/terms-and-conditions" className="transition-colors hover:text-white">
                Terms
              </Link>
              <Link href="/privacy-policy" className="transition-colors hover:text-white">
                Privacy
              </Link>
              {/* /contractor-agreement route not yet created — rendered non-clickable */}
              <span className="cursor-default opacity-50" title="Page coming soon">
                Contractor Agreement
              </span>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Score static roles against the current role; returns top N excluding itself */
function getSimilarStaticRoles(currentId: number, limit = 3): Role[] {
  const current = roles.find((r) => r.id === currentId);
  if (!current) return roles.filter((r) => r.id !== currentId).slice(0, limit);
  const stopWords = new Set(["for", "the", "and", "with", "role"]);
  const currentCategory = current.category.toLowerCase();
  const currentTagsSet = new Set(current.tags.map((t) => t.toLowerCase()));
  const currentTitleWords = new Set(
    current.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w)),
  );

  return roles
    .filter((r) => r.id !== currentId)
    .map((r) => {
      let score = 0;
      if (r.category.toLowerCase() === currentCategory) score += 3;
      score += r.tags.filter((t) => currentTagsSet.has(t.toLowerCase())).length;
      const rWords = r.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));
      score += rWords.filter((w) => currentTitleWords.has(w)).length;
      return { role: r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ role }) => role);
}

function DbSimilarJobsSection({
  currentJob,
  navigate,
}: {
  currentJob: Job;
  navigate: (p: string) => void;
}) {
  const { data: allJobsData } = useQuery<{ items: Job[]; meta: unknown }>({
    queryKey: ["/api/jobs/search", "open-similar"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/search?status=open&limit=50");
      if (!res.ok) throw new Error("fetch-failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const similar = useMemo(() => {
    const allJobs: Job[] = allJobsData?.items ?? [];
    return getSimilarDbJobs(currentJob, allJobs, 3);
  }, [currentJob, allJobsData]);

  if (similar.length === 0) return null;

  return (
    <div className="border-t border-slate-100 px-5 py-8 dark:border-white/[0.08] md:px-8">
      <div className="mb-5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#474ead]" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Similar projects you might like</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {similar.map((job) => (
          <DbSimilarCard key={job.id} job={job} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}

function DbSimilarCard({ job, navigate }: { job: Job; navigate: (p: string) => void }) {
  const pay = buildRateDisplay(job);
  const displayTitle = (job as any).professionalRoleName || job.title;
  const functionBadge = (job as any).jobFunction || job.category;
  const companyName = getPublicCompanyName(job as any);
  return (
    <button
      onClick={() => navigate(`/find-work/job/${job.id}`)}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#474ead]/40 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-[#474ead]/50"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#474ead] dark:text-white dark:group-hover:text-indigo-300">
          {displayTitle}
        </p>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#474ead] dark:text-slate-600 dark:group-hover:text-indigo-300" />
      </div>
      {functionBadge && (
        <span className="inline-flex w-fit rounded-full bg-[#474ead]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#474ead] dark:bg-[#474ead]/20">
          {functionBadge}
        </span>
      )}
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{pay}</p>
      {companyName && (
        <p className="text-xs text-slate-400 dark:text-slate-500">{companyName}</p>
      )}
    </button>
  );
}

function StaticSimilarCard({ role, navigate }: { role: Role; navigate: (p: string) => void }) {
  return (
    <button
      onClick={() => navigate(`/find-work/job/${role.id}`)}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#474ead]/40 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-[#474ead]/50"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#474ead] dark:text-white dark:group-hover:text-indigo-300">
          {role.title}
        </p>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#474ead] dark:text-slate-600 dark:group-hover:text-indigo-300" />
      </div>
      <span className="inline-flex w-fit rounded-full bg-[#474ead]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#474ead] dark:bg-[#474ead]/20">
        {role.category}
      </span>
      <p className="text-xs text-slate-500 dark:text-slate-400">{role.pay}</p>
    </button>
  );
}
