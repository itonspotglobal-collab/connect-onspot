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

/** Formats a job's full salary/rate display string.
 *  Prefers the free-text `salaryDisplay` field; falls back to computing
 *  from the legacy numeric fields for backward compatibility. */
export function formatJobSalary(job: {
  salaryDisplay?: string | null;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  budgetCurrency?: string | null;
  customCurrencyCode?: string | null;
}): string {
  // 1. Free-text display wins
  if (job.salaryDisplay?.trim()) return job.salaryDisplay.trim();

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
  return "Rate TBD";
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

// ── Sort Engine ───────────────────────────────────────────────────────────────

export function sortJobs(jobs: any[], sortBy: SortOption): any[] {
  const list = [...jobs];

  const toMs = (j: any) => {
    const d = j.postedAt || j.createdAt;
    return d ? new Date(d).getTime() : 0;
  };

  switch (sortBy) {
    case "recently-posted":
      return list.sort((a, b) => toMs(b) - toMs(a));

    case "most-applied":
      return list.sort(
        (a, b) => (b.proposalCount || 0) - (a.proposalCount || 0)
      );

    case "top-remote":
      return list
        .filter((j) => {
          const l = (j.location || "").toLowerCase();
          return l.includes("remote") || l.includes("wfh") || l === "";
        })
        .sort((a, b) => toMs(b) - toMs(a));

    case "in-demand": {
      const cats = ["development", "marketing", "support", "design"];
      const kws = [
        "developer",
        "engineer",
        "specialist",
        "manager",
        "analyst",
        "administrator",
        "coordinator",
      ];
      return list
        .filter(
          (j) =>
            cats.includes(j.category) ||
            kws.some((kw) => (j.title || "").toLowerCase().includes(kw))
        )
        .sort((a, b) => (b.proposalCount || 0) - (a.proposalCount || 0));
    }

    case "urgently-hiring":
      return list
        .filter((j) => j.urgentlyHiring === true)
        .sort((a, b) => toMs(b) - toMs(a));

    case "featured":
      return list
        .filter((j) => {
          const budget = parseFloat(j.budget || "0");
          const dateRef = j.postedAt || j.createdAt;
          const daysOld = dateRef
            ? Math.floor((Date.now() - new Date(dateRef).getTime()) / 86400000)
            : 999;
          return budget >= 30000 || (j.proposalCount || 0) >= 2 || daysOld <= 5;
        })
        .sort((a, b) => parseFloat(b.budget || "0") - parseFloat(a.budget || "0"));

    default:
      return list;
  }
}

// ── Timestamp Formatting ──────────────────────────────────────────────────────

export function getTimeAgo(
  dateInput: string | Date | null | undefined
): string {
  if (!dateInput) return "Recently";
  const date =
    typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "Recently";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
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
 * Primary rate display — uses salaryDisplay first, falls back to
 * legacy numeric fields for backward compatibility.
 */
export function buildRateDisplay(job: {
  salaryDisplay?: string | null;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  budgetCurrency?: string | null;
  customCurrencyCode?: string | null;
  contractType?: string;
}): string {
  return formatJobSalary(job);
}
