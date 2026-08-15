export type SortOption =
  | "recently-posted"
  | "most-applied"
  | "top-remote"
  | "in-demand"
  | "urgently-hiring"
  | "featured";

// ── Currency helpers ──────────────────────────────────────────────────────────

export type SupportedCurrency =
  | "PHP"
  | "USD"
  | "EUR"
  | "GBP"
  | "AUD"
  | "CAD"
  | "SGD"
  | "JPY"
  | "OTHER";

export const SUPPORTED_CURRENCIES: { value: SupportedCurrency; label: string }[] = [
  { value: "PHP", label: "PHP — Philippine Peso" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "OTHER", label: "Other" },
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  JPY: "¥",
};

/** Returns the display symbol for a job's currency selection */
export function getCurrencySymbol(
  currency?: string | null,
  customCurrencyCode?: string | null
): string {
  const code = (currency || "PHP").toUpperCase();
  if (code === "OTHER") return customCurrencyCode?.toUpperCase() || "?";
  return CURRENCY_SYMBOLS[code] || code;
}

/** Returns the ISO currency code to use for formatting */
export function getEffectiveCurrencyCode(
  currency?: string | null,
  customCurrencyCode?: string | null
): string {
  const code = (currency || "PHP").toUpperCase();
  if (code === "OTHER") return customCurrencyCode?.toUpperCase() || "PHP";
  return code;
}

/** Formats a numeric amount using the job's currency */
export function formatJobCurrency(
  amount: number,
  currency?: string | null,
  customCurrencyCode?: string | null
): string {
  const code = getEffectiveCurrencyCode(currency, customCurrencyCode);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback for unknown/custom codes
    const sym = getCurrencySymbol(currency, customCurrencyCode);
    return `${sym}${amount.toLocaleString()}`;
  }
}

/** Returns the period suffix string for a given compensationType value. */
function compensationSuffix(type?: string | null): string {
  if (type === "monthly") return "/month";
  if (type === "annual") return "/year";
  if (type === "project") return "/project";
  return "";
}

/**
 * Returns true when the salary text looks like a number or monetary value
 * (contains at least one digit), so a period suffix can safely be appended.
 * Pure descriptive text like "Competitive" or "Rate TBD" contains no digits
 * and should be left unchanged.
 */
function salaryHasNumericContent(text: string): boolean {
  return /\d/.test(text);
}

/** Formats a job's full salary/rate display string.
 *  Prefers the free-text `salaryDisplay` field; falls back to computing
 *  from the legacy numeric fields for backward compatibility.
 *  Appends a compensation-type suffix (/month, /year, /project) when the
 *  salary text contains numeric content — never appends to freeform phrases. */
export function formatJobSalary(job: {
  salaryDisplay?: string | null;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  budgetCurrency?: string | null;
  customCurrencyCode?: string | null;
  compensationType?: string | null;
}): string {
  const suffix = compensationSuffix(job.compensationType);

  // 1. Free-text display wins
  if (job.salaryDisplay?.trim()) {
    const display = job.salaryDisplay.trim();
    // Only append suffix when the text contains a number, not for "Competitive" etc.
    if (suffix && salaryHasNumericContent(display)) {
      return `${display}${suffix}`;
    }
    return display;
  }

  // 2. Legacy numeric fallback (old jobs before salaryDisplay was added)
  const currency = job.budgetCurrency || "PHP";
  const customCode = job.customCurrencyCode;

  if (job.hourlyRateMin && job.hourlyRateMax) {
    return `${formatJobCurrency(Number(job.hourlyRateMin), currency, customCode)}–${formatJobCurrency(Number(job.hourlyRateMax), currency, customCode)}/mo`;
  }
  if (job.hourlyRateMin) {
    return `${formatJobCurrency(Number(job.hourlyRateMin), currency, customCode)}+/mo`;
  }
  if (job.budget) {
    return `${formatJobCurrency(Number(job.budget), currency, customCode)}/mo`;
  }
  // No salary saved — flag for admin review rather than silently showing "Rate TBD"
  return "Salary not set";
}

// ── Badge Logic ───────────────────────────────────────────────────────────────

export type JobBadge = {
  key: string;
  label: string;
  className: string;
};

export function getJobBadges(job: {
  salaryDisplay?: string | null;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  budgetCurrency?: string | null;
  proposalCount?: number | null;
  title?: string | null;
  location?: string | null;
  createdAt?: string | Date | null;
  urgentlyHiring?: boolean | null;
}): JobBadge[] {
  const badges: JobBadge[] = [];

  // Top Paying: only meaningful for PHP jobs (₱50,000+)
  const currency = (job.budgetCurrency || "PHP").toUpperCase();
  if (currency === "PHP") {
    // Try salaryDisplay first (extract first numeric run), then fall back to legacy fields
    let budget = 0;
    if (job.salaryDisplay) {
      const match = job.salaryDisplay.replace(/[,_]/g, "").match(/[\d]+/);
      budget = match ? parseFloat(match[0]) : 0;
    } else {
      budget = parseFloat(job.budget || job.hourlyRateMax || job.hourlyRateMin || "0");
    }
    if (budget >= 50000) {
      badges.push({
        key: "top-paying",
        label: "Top Paying",
        className:
          "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
      });
    }
  }

  // Urgently Hiring: controlled by the urgentlyHiring boolean field only
  if (job.urgentlyHiring === true) {
    badges.push({
      key: "urgent",
      label: "Urgently Hiring",
      className:
        "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    });
  }

  // Multiple Slots Open: team-oriented keywords in title
  const title = (job.title || "").toLowerCase();
  const multiSlotWords = [
    "team",
    "agents",
    "specialists",
    "representatives",
    "reps",
    "staff",
    "multiple",
    "openings",
    "slots",
    "positions",
  ];
  if (multiSlotWords.some((w) => title.includes(w))) {
    badges.push({
      key: "multiple-slots",
      label: "Multiple Slots Open",
      className:
        "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    });
  }

  return badges;
}

// ── Priority helpers ──────────────────────────────────────────────────────────

/** True if the job should show the "Urgently Hiring" badge. Single source of truth. */
export function isUrgentJob(job: any): boolean {
  return job.urgentlyHiring === true;
}

/** True if the job is featured. Single source of truth. */
export function isFeaturedJob(job: any): boolean {
  return job.isFeatured === true;
}

/**
 * Priority score: Urgent+Featured=3, Urgent=2, Featured=1, Normal=0.
 * Matches the CASE WHEN expression used server-side in searchJobsPaginated.
 */
export function getJobPriorityScore(job: any): number {
  let score = 0;
  if (isFeaturedJob(job)) score += 1;
  if (isUrgentJob(job))   score += 2;
  return score;
}

// ── Sort Engine ───────────────────────────────────────────────────────────────

export function sortJobs(jobs: any[], sortBy: SortOption): any[] {
  const list = [...jobs];

  const toMs = (j: any) => {
    const d = j.postedAt || j.createdAt;
    return d ? new Date(d).getTime() : 0;
  };

  // "featured" mode: show only explicitly-featured jobs, sorted by recency
  if (sortBy === "featured") {
    return list
      .filter((j) => j.isFeatured === true)
      .sort((a, b) => toMs(b) - toMs(a));
  }

  // "recently-posted": priority-first (urgent > featured > normal), then recency within group.
  // Server-side searchJobsPaginated applies the same ordering before pagination, so this
  // client-side pass keeps per-page display consistent without re-fetching.
  if (sortBy === "recently-posted") {
    return list.sort((a, b) => {
      const priorityDiff = getJobPriorityScore(b) - getJobPriorityScore(a);
      if (priorityDiff !== 0) return priorityDiff;
      const dateDiff = toMs(b) - toMs(a);
      if (dateDiff !== 0) return dateDiff;
      return (b.id ?? "").localeCompare(a.id ?? "");
    });
  }

  // All other sorts: compute order first, then float isFeatured jobs to the top
  // while preserving relative order within each group.
  let sorted: any[];
  switch (sortBy) {
    case "recently-posted": // unreachable — handled above, kept for exhaustive switch
      sorted = list.sort((a, b) => toMs(b) - toMs(a));
      break;

    case "most-applied":
      sorted = list.sort((a, b) => (b.proposalCount || 0) - (a.proposalCount || 0));
      break;

    case "top-remote":
      sorted = list
        .filter((j) => {
          const l = (j.location || "").toLowerCase();
          return l.includes("remote") || l.includes("wfh") || l === "";
        })
        .sort((a, b) => toMs(b) - toMs(a));
      break;

    case "in-demand": {
      const cats = ["development", "marketing", "support", "design"];
      const kws = ["developer", "engineer", "specialist", "manager", "analyst", "administrator", "coordinator"];
      sorted = list
        .filter((j) => cats.includes(j.category) || kws.some((kw) => (j.title || "").toLowerCase().includes(kw)))
        .sort((a, b) => (b.proposalCount || 0) - (a.proposalCount || 0));
      break;
    }

    case "urgently-hiring":
      sorted = list
        .filter((j) => j.urgentlyHiring === true)
        .sort((a, b) => toMs(b) - toMs(a));
      break;

    default:
      sorted = list;
  }

  // Float explicitly-featured jobs to the top, preserving relative sort within each group
  const featuredJobs = sorted.filter((j) => j.isFeatured === true);
  const normalJobs   = sorted.filter((j) => j.isFeatured !== true);
  return [...featuredJobs, ...normalJobs];
}

// ── Timestamp Formatting ──────────────────────────────────────────────────────

/**
 * Returns a human-readable relative age for a job posting date.
 *
 * Rules:
 *   < 1 min       → "Just posted"
 *   1–59 min      → "X minute(s) ago"
 *   1–23 h        → "X hour(s) ago"
 *   1 day         → "1 day ago"
 *   2–6 days      → "X days ago"
 *   7+ days       → "X week(s) ago"   ← never months
 *
 * Future timestamps (clock skew etc.) are treated as "Just posted".
 * Invalid / missing dates fall back to "Recently".
 */
export function getTimeAgo(
  dateInput: string | Date | null | undefined
): string {
  if (!dateInput) return "Recently";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Just posted"; // clock skew / future timestamp

  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins  < 1)  return "Just posted";
  if (diffMins  < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays  < 7)  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  // Anything 7 days or older → single consistent label (no "2 weeks ago", "3 months ago", etc.)
  return "more than a week ago";
}

// ── Formatting Helpers ────────────────────────────────────────────────────────

export function formatContractType(type: string): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

export function formatExperienceLevel(level: string): string {
  switch (level) {
    case "entry":
      return "Entry Level (0–2 years)";
    case "intermediate":
      return "Intermediate (2–5 years)";
    case "expert":
      return "Expert (5+ years)";
    default:
      return level;
  }
}

/**
 * Primary rate display — delegates to buildRateDisplayWithCode so all
 * talent-facing salary strings use the same symbol-based, suffix-free format.
 */
export function buildRateDisplay(job: {
  salaryDisplay?: string | null;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  budgetCurrency?: string | null;
  customCurrencyCode?: string | null;
  engagementType?: string;
  compensationType?: string | null;
}): string {
  return buildRateDisplayWithCode(job);
}

/**
 * Talent-facing rate display — uses the currency symbol (not the ISO code)
 * before each numeric amount and omits any period suffix (/month, /year, etc.).
 * Ranges get the symbol on both values: "$3,100 - $3,300", "₱50,000".
 * Descriptive phrases ("Competitive", "Rate TBD") pass through unchanged.
 * Use this everywhere salary is displayed to candidates.
 */
export function buildRateDisplayWithCode(job: {
  salaryDisplay?: string | null;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  budgetCurrency?: string | null;
  customCurrencyCode?: string | null;
  engagementType?: string;
  compensationType?: string | null;
}): string {
  const sym = getCurrencySymbol(job.budgetCurrency, job.customCurrencyCode);

  // ── 1. Free-text salaryDisplay ─────────────────────────────────────────────
  if (job.salaryDisplay?.trim()) {
    const display = job.salaryDisplay.trim();

    // No digits → descriptive phrase ("Competitive", "Rate TBD") — return as-is
    if (!/\d/.test(display)) return display;

    // Strip any trailing period suffix, then normalise each range part by
    // removing any leading currency prefix (ISO code or symbol) before the
    // first digit — handles "USD 3,100", "₱50,000", "A$3,100", "$3,100", etc.
    const withoutSuffix = display
      .replace(/\/(month|year|project|mo)\s*$/i, "")
      .trim();

    const stripPrefix = (s: string) => s.replace(/^[^0-9]*/, "").trim();

    const rangeParts = withoutSuffix.split(/\s*[-–—]\s*/);
    if (rangeParts.length >= 2) {
      return `${sym}${stripPrefix(rangeParts[0])} - ${sym}${stripPrefix(rangeParts[1])}`;
    }
    return `${sym}${stripPrefix(withoutSuffix)}`;
  }

  // ── 2. Legacy numeric fallback ─────────────────────────────────────────────
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  if (job.hourlyRateMin && job.hourlyRateMax) {
    return `${sym}${fmt(Number(job.hourlyRateMin))} - ${sym}${fmt(Number(job.hourlyRateMax))}`;
  }
  if (job.hourlyRateMin) {
    return `${sym}${fmt(Number(job.hourlyRateMin))}`;
  }
  if (job.budget) {
    return `${sym}${fmt(Number(job.budget))}`;
  }
  return "Salary not set";
}

// ── Company visibility helpers ──────────────────────────────────────────────

/**
 * Returns the company name a public visitor should see.
 */
export function getPublicCompanyName(job: {
  company?: string | null;
}): string {
  return job.company || "OnSpot";
}

/**
 * Returns the company overview a public visitor should see.
 */
export function getPublicCompanyDescription(job: {
  companyOverview?: string | null;
}): string | null {
  return (job as any).companyOverview?.trim() || null;
}

/**
 * Returns the section label for the company overview block.
 */
export function getCompanyOverviewLabel(): string {
  return "About the Company";
}
