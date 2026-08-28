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
  "Other",
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
// This is intentionally scoped to the job-posting form. The values are stored
// in the existing jobs.location column for backward compatibility.
export const JOB_FORM_WORK_SETUPS = ["Remote", "Onsite", "Hybrid"] as const;
export type JobFormWorkSetup = (typeof JOB_FORM_WORK_SETUPS)[number];

// These labels are intentionally scoped to the guided job-posting form. The
// broader JOB_FUNCTIONS list remains available to existing filters and reports.
export const JOB_FORM_FUNCTION_OPTIONS = [
  "Sales & Business Development",
  "Customer Support",
  "Marketing",
  "Finance & Accounting",
  "Operations & Admin",
  "Engineering & Tech",
  "Design & Creative",
  "Other",
] as const;

// ── Engagement Types ──────────────────────────────────────────────────────────
// The two canonical engagement types. "Hourly", "fixed", "part-time", etc. are
// retired — all jobs use Lite or Standard going forward.
export const ENGAGEMENT_TYPE_OPTIONS = [
  { value: "Standard", label: "Standard (8 Hours)" },
  { value: "Lite",     label: "Lite (4 Hours)" },
] as const;

export type EngagementTypeValue = (typeof ENGAGEMENT_TYPE_OPTIONS)[number]["value"];

export function getEngagementTypeLabel(value?: string | null): string {
  return ENGAGEMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value ?? "";
}

// Stored values preserve the existing vocabulary used by matching and filters.
// "lead" is additive; existing entry/intermediate/expert records remain intact.
export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "entry", label: "Entry level" },
  { value: "intermediate", label: "Mid level" },
  { value: "expert", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
] as const;

export function getExperienceLevelLabel(value?: string | null): string {
  return EXPERIENCE_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value ?? "";
}

export const JOB_DURATION_OPTIONS = [
  "1 month",
  "2 months",
  "3 months",
  "4 months",
  "5 months",
  "6 months",
  "7 months",
  "8 months",
  "9 months",
  "10 months",
  "11 months",
  "12 months",
  "Continuous",
] as const;

export const MINIMUM_EDUCATION_OPTIONS = [
  "No minimum",
  "High school graduate",
  "Some college / vocational",
  "Associate degree",
  "Bachelor's degree",
  "Master's degree or higher",
] as const;

export const SKILL_EXPERIENCE_OPTIONS = [
  { value: "any", label: "Any experience" },
  { value: "1", label: "1+ years" },
  { value: "2", label: "2+ years" },
  { value: "3", label: "3+ years" },
  { value: "5", label: "5+ years" },
] as const;

export const COMPENSATION_DISPLAY_OPTIONS = [
  { value: "range", label: "Range" },
  { value: "starting_from", label: "Starting from" },
  { value: "negotiable", label: "Negotiable" },
] as const;

// ── Talent Browse Categories ──────────────────────────────────────────────────
// The canonical 10 categories for the Client "Search & Shortlist" page and the
// talent-browse filter chips. Source of truth — never duplicate in components.
export const TALENT_BROWSE_CATEGORIES = [
  "Customer Support",
  "Virtual Assistants",
  "Developers",
  "Designers",
  "Marketing Specialists",
  "Accountants",
  "Healthcare Professionals",
  "Sales Representatives",
  "Operations Specialists",
  "IT & Technical Support",
] as const;

export type TalentBrowseCategory = (typeof TALENT_BROWSE_CATEGORIES)[number];

/**
 * Aliases from raw DB category / job_function values → canonical browse chip label.
 * NOTE: Two known mistagged jobs (CSR tagged "Operations", Accounting Manager tagged "Executive")
 * are intentionally NOT mapped here — they require manual admin correction.
 */
const BROWSE_CATEGORY_ALIASES: Record<string, TalentBrowseCategory> = {
  // Customer Support
  "customer support":             "Customer Support",
  "support":                      "Customer Support",
  "customer success":             "Customer Support",
  // Virtual Assistants
  "virtual assistant":            "Virtual Assistants",
  "virtual assistants":           "Virtual Assistants",
  "admin":                        "Virtual Assistants",
  // Developers
  "engineering":                  "Developers",
  "development":                  "Developers",
  "software":                     "Developers",
  "software engineering":         "Developers",
  // Designers
  "design (ui/ux)":               "Designers",
  "design":                       "Designers",
  "ui/ux":                        "Designers",
  // Marketing Specialists
  "marketing":                    "Marketing Specialists",
  // Accountants
  "finance & accounting":         "Accountants",
  "finance":                      "Accountants",
  "accounting":                   "Accountants",
  "bookkeeping":                  "Accountants",
  // Healthcare Professionals
  "healthcare":                   "Healthcare Professionals",
  "health":                       "Healthcare Professionals",
  // Sales Representatives
  "sales":                        "Sales Representatives",
  "sales development":            "Sales Representatives",
  // Operations Specialists
  "operations":                   "Operations Specialists",
  "project & program management": "Operations Specialists",
  "project management":           "Operations Specialists",
  // IT & Technical Support
  "information technology (it)":  "IT & Technical Support",
  "it":                           "IT & Technical Support",
  "tech support":                 "IT & Technical Support",
  "technical support":            "IT & Technical Support",
};

/**
 * Natural-language suggestion phrase for each canonical browse category.
 * Used by the Search-to-Shortlist suggestion chips — the backend returns which
 * categories are top-volume; the frontend looks up the phrase from this map.
 * Treat these as first-draft copy — likely to be tweaked over time.
 */
export const TALENT_CATEGORY_PHRASES: Record<TalentBrowseCategory, string> = {
  "Customer Support":         "Handle customer support inquiries",
  "Virtual Assistants":       "Manage my inbox & calendar",
  "Developers":               "Build or maintain my website",
  "Designers":                "Design marketing or product assets",
  "Marketing Specialists":    "Run my social media & campaigns",
  "Accountants":              "Keep my books and finances in order",
  "Healthcare Professionals": "Support patient care & records",
  "Sales Representatives":    "Handle outbound sales & leads",
  "Operations Specialists":   "Keep my day-to-day operations running",
  "IT & Technical Support":   "Manage my IT & tech support",
};

/**
 * Returns the canonical browse category for a raw DB value, or null if unrecognized.
 * Case-insensitive. Does NOT guess — unlisted values return null so mistagged jobs
 * are surfaced as unrecognized rather than silently mis-filed.
 */
export function resolveBrowseCategory(raw: string | null | undefined): TalentBrowseCategory | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  for (const cat of TALENT_BROWSE_CATEGORIES) {
    if (cat.toLowerCase() === key) return cat;
  }
  return BROWSE_CATEGORY_ALIASES[key] ?? null;
}

// ── Filter engagement-type options (public FindWork page) ─────────────────────
export const FILTER_CONTRACT_TYPES = [
  { value: "All Types", label: "All Types" },
  { value: "Standard",  label: "Standard"  },
  { value: "Lite",      label: "Lite"      },
] as const;
