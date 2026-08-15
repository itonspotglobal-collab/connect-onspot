/**
 * Shared source of truth for all job-related constants.
 *
 * Import from here — never duplicate these lists in individual components.
 */

// ── Job Functions ─────────────────────────────────────────────────────────────
// The canonical list of job functions used in:
//   - Admin/client Create & Edit forms
//   - FindWork filter chips
//   - API validation
//   - Display logic
export const JOB_FUNCTIONS = [
  "Executive",
  "Operations",
  "Engineering",
  "Artificial Intelligence",
  "Data & Analytics",
  "Product",
  "Design (UI/UX)",
  "Information Technology (IT)",
  "Marketing",
  "Sales",
  "Customer Success",
  "Customer Support",
  "Finance & Accounting",
  "Human Resources",
  "Legal & Compliance",
  "Procurement",
  "Supply Chain",
  "Business Development",
  "Strategy",
  "Project & Program Management",
  "Research & Development (R&D)",
] as const;

export type JobFunction = (typeof JOB_FUNCTIONS)[number];

/** Set for O(1) membership tests (API validation, filter logic). */
export const JOB_FUNCTIONS_SET = new Set<string>(JOB_FUNCTIONS);

// ── Legacy → canonical function name mapping ──────────────────────────────────
// Applied only to jobs that were saved before the dropdown was introduced.
// Only maps unambiguous equivalents; ambiguous values are left for admin review.
export const LEGACY_FUNCTION_MAP: Record<string, string> = {
  // exact legacy values stored in DB (case-insensitive key after toLowerCase())
  "admin":            "Operations",
  "it":               "Information Technology (IT)",
  "finance":          "Finance & Accounting",
  "hr":               "Human Resources",
  "customer success": "Customer Success",
  "support":          "Customer Support",
  "customer support": "Customer Support",
  "development":      "Engineering",
  "tech support":     "Information Technology (IT)",
  "design":           "Design (UI/UX)",
  "marketing":        "Marketing",
  "sales":            "Sales",
  "operations":       "Operations",
  "data":             "Data & Analytics",
  "product":          "Product",
  "legal":            "Legal & Compliance",
  "strategy":         "Strategy",
};

/**
 * Resolves a raw jobFunction/category value to a canonical JOB_FUNCTIONS entry.
 * Returns the original value unchanged if it already matches the list or has no mapping.
 */
export function resolveJobFunction(raw: string | null | undefined): string {
  if (!raw) return "";
  // Already canonical?
  if (JOB_FUNCTIONS_SET.has(raw)) return raw;
  // Check legacy map
  const mapped = LEGACY_FUNCTION_MAP[raw.trim().toLowerCase()];
  return mapped ?? raw;
}

// ── Work Setups ───────────────────────────────────────────────────────────────
export const WORK_SETUPS = ["Remote", "Hybrid", "Onsite"] as const;
export type WorkSetup = (typeof WORK_SETUPS)[number];

// ── Engagement Types ──────────────────────────────────────────────────────────
// The two canonical engagement types. "Hourly", "fixed", "part-time", etc. are
// retired — all jobs use Half-Day or Full-Time going forward.
export const ENGAGEMENT_TYPE_OPTIONS = [
  { value: "Full-Time", label: "Full-Time" },
  { value: "Half-Day",  label: "Half-Day"  },
] as const;

export type EngagementTypeValue = (typeof ENGAGEMENT_TYPE_OPTIONS)[number]["value"];

// ── Compensation ──────────────────────────────────────────────────────────────
// All new/edited jobs must use Monthly compensation.
export const COMPENSATION_TYPE = "monthly" as const;

// ── Filter engagement-type options (public FindWork page) ─────────────────────
export const FILTER_CONTRACT_TYPES = [
  { value: "All Types", label: "All Types" },
  { value: "Full-Time", label: "Full-Time" },
  { value: "Half-Day",  label: "Half-Day"  },
] as const;
