// ─── Job Utility Helpers ─────────────────────────────────────────────────────
// Reusable functions for sorting, badge derivation, and timestamp formatting.

// ── Sort Options ─────────────────────────────────────────────────────────────

export type SortOption =
  | "recently-posted"
  | "most-applied"
  | "top-remote"
  | "in-demand"
  | "urgently-hiring"
  | "featured";

export const SORT_OPTIONS: {
  value: SortOption;
  label: string;
  description: string;
}[] = [
  {
    value: "recently-posted",
    label: "Recently Posted",
    description: "Latest opportunities first",
  },
  {
    value: "most-applied",
    label: "Most Applied",
    description: "Highest interest roles",
  },
  {
    value: "top-remote",
    label: "Top Remote Roles",
    description: "Work from anywhere",
  },
  {
    value: "in-demand",
    label: "In-Demand Roles",
    description: "High-demand skills",
  },
  {
    value: "urgently-hiring",
    label: "Urgently Hiring",
    description: "Roles filling quickly",
  },
  {
    value: "featured",
    label: "Featured Jobs",
    description: "Hand-picked opportunities",
  },
];

// ── Badge Logic ───────────────────────────────────────────────────────────────

export type JobBadge = {
  key: string;
  label: string;
  className: string;
};

export function getJobBadges(job: {
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  proposalCount?: number | null;
  title?: string | null;
  location?: string | null;
  createdAt?: string | Date | null;
  urgentlyHiring?: boolean | null;
}): JobBadge[] {
  const badges: JobBadge[] = [];

  const budget = parseFloat(
    job.budget || job.hourlyRateMax || job.hourlyRateMin || "0"
  );
  const title = (job.title || "").toLowerCase();

  // Top Paying: ₱50 000+ budget
  if (budget >= 50000) {
    badges.push({
      key: "top-paying",
      label: "Top Paying",
      className:
        "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    });
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

  const toMs = (j: any) =>
    j.createdAt ? new Date(j.createdAt).getTime() : 0;

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
      // In-demand categories & title keywords
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
      // Featured = high budget OR many proposals OR very recent
      return list
        .filter((j) => {
          const budget = parseFloat(j.budget || "0");
          const daysOld = j.createdAt
            ? Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000)
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

export function buildRateDisplay(job: {
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  contractType?: string;
}): string {
  if (job.hourlyRateMin && job.hourlyRateMax) {
    return `₱${Number(job.hourlyRateMin).toLocaleString()}–₱${Number(job.hourlyRateMax).toLocaleString()}/month`;
  }
  if (job.budget) {
    return `₱${Number(job.budget).toLocaleString()}`;
  }
  return "Rate TBD";
}
