/**
 * Shared application status configuration.
 * Single source of truth used by both Admin and Talent views.
 * Never duplicate status strings across components — import from here.
 */

export interface StatusMeta {
  label: string;
  /** Talent-facing label when different from admin label (e.g. "Rejected" → "Not Selected") */
  talentLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  /** Whether this is a terminal/final status */
  isTerminal: boolean;
}

export const APPLICATION_STATUS_META: Record<string, StatusMeta> = {
  submitted:    { label: "Submitted",    talentLabel: "Submitted",     bgClass: "bg-blue-100",   textClass: "text-blue-800",   borderClass: "border-blue-200",   isTerminal: false },
  new:          { label: "Submitted",    talentLabel: "Submitted",     bgClass: "bg-blue-100",   textClass: "text-blue-800",   borderClass: "border-blue-200",   isTerminal: false },
  under_review: { label: "Under Review", talentLabel: "Under Review",  bgClass: "bg-yellow-100", textClass: "text-yellow-800", borderClass: "border-yellow-200", isTerminal: false },
  reviewed:     { label: "Under Review", talentLabel: "Under Review",  bgClass: "bg-yellow-100", textClass: "text-yellow-800", borderClass: "border-yellow-200", isTerminal: false },
  shortlisted:  { label: "Shortlisted",  talentLabel: "Shortlisted",   bgClass: "bg-purple-100", textClass: "text-purple-800", borderClass: "border-purple-200", isTerminal: false },
  interview:    { label: "Interview",    talentLabel: "Interview",      bgClass: "bg-orange-100", textClass: "text-orange-800", borderClass: "border-orange-200", isTerminal: false },
  offered:      { label: "Offered",      talentLabel: "Offered",        bgClass: "bg-teal-100",   textClass: "text-teal-800",   borderClass: "border-teal-200",   isTerminal: false },
  hired:        { label: "Hired",        talentLabel: "Hired",          bgClass: "bg-green-100",  textClass: "text-green-800",  borderClass: "border-green-200",  isTerminal: true  },
  rejected:     { label: "Rejected",     talentLabel: "Not Selected",   bgClass: "bg-red-100",    textClass: "text-red-800",    borderClass: "border-red-200",    isTerminal: true  },
  withdrawn:    { label: "Withdrawn",    talentLabel: "Withdrawn",      bgClass: "bg-slate-100",  textClass: "text-slate-700",  borderClass: "border-slate-200",  isTerminal: true  },
};

export function getStatusMeta(status: string): StatusMeta {
  return APPLICATION_STATUS_META[status] ?? {
    label: status,
    talentLabel: status,
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-200",
    isTerminal: false,
  };
}

/**
 * Normal hiring pipeline — used for status timeline visualization.
 * Does NOT include terminal failure states (rejected, withdrawn).
 */
export const STATUS_PIPELINE = [
  "submitted",
  "under_review",
  "shortlisted",
  "interview",
  "hired",
] as const;

export type PipelineStatus = typeof STATUS_PIPELINE[number];

/** Active (non-terminal) statuses for filter grouping */
export const ACTIVE_STATUSES = new Set([
  "submitted", "new", "under_review", "reviewed", "shortlisted", "interview", "offered",
]);

/** Terminal statuses for filter grouping */
export const COMPLETED_STATUSES = new Set(["hired", "rejected", "withdrawn"]);
