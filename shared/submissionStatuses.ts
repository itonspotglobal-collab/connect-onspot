/**
 * Canonical job_submissions.status values — single source of truth.
 *
 * Every endpoint that reads or writes job_submissions.status MUST import from
 * here. Do NOT declare a local validStatuses array anywhere in the codebase.
 *
 * DB constraint: ALTER TABLE job_submissions ADD CONSTRAINT
 *   job_submissions_status_check CHECK (status IN (...these values...))
 * Applied at startup migration. Any value not in this list will be rejected
 * by the DB before it ever reaches application logic.
 */
export const SUBMISSION_STATUSES = [
  // ── Initial states ─────────────────────────────────────────────────────────
  "new",           // Talent self-applied (displayed as "submitted" in UI — alias only)
  "invited",       // Client-invited talent, awaiting talent's accept/decline
  "declined",      // Talent declined a client invitation
  "withdrawn",     // Talent withdrew their own application

  // ── Client review pipeline (client-driven) ─────────────────────────────────
  "under_review",  // Client actively reviewing the application
  "reviewed",      // Client has completed review
  "shortlisted",   // Client shortlisted for interview consideration
  "rejected",      // Client rejected at any pipeline stage

  // ── Interview pipeline (client-driven, set via interview record creation) ──
  "interviewing",  // First interview scheduled; replaces old partial value "interview"

  // ── Offer pipeline (client-driven for offer, talent for response) ──────────
  "offer_extended", // Client created and sent offer; replaces old partial value "offered"
  "offer_expired",  // Offer passed its expiry date without a talent response (system-set)
  "offer_accepted", // Talent formally accepted the offer
  "offer_declined", // Talent formally declined the offer

  // ── Contract + hire (Admin/OnSpot-driven) ─────────────────────────────────
  "contract_sent",  // Admin/OnSpot generated and sent the hiring contract
  "hired",          // Contract fully signed — terminal success state
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Statuses a CLIENT may write directly via PATCH /api/client/job-submissions/:id/status.
 * Other status transitions happen as side effects of creating interview/offer/contract records.
 */
export const CLIENT_SETTABLE_STATUSES: SubmissionStatus[] = [
  "under_review",
  "reviewed",
  "shortlisted",
  "rejected",
];

/**
 * Statuses the ADMIN may write directly via PATCH /api/admin/job-applications/:id.
 * Contract-stage statuses (contract_sent, hired) are set via the hiring_contracts workflow.
 */
export const ADMIN_SETTABLE_STATUSES: SubmissionStatus[] = [
  "new",
  "under_review",
  "reviewed",
  "shortlisted",
  "interviewing",
  "offer_extended",
  "offer_accepted",
  "offer_declined",
  "rejected",
  "withdrawn",
];

/**
 * True when an admin may set this status directly (email-send stage update,
 * status PATCH endpoints). Contract-workflow statuses always return false.
 */
export function isAdminSettableStatus(status: string): boolean {
  return ADMIN_SETTABLE_STATUSES.includes(status as SubmissionStatus);
}

/**
 * Ordered reveal-threshold phases. 'new' is the canonical submitted phase;
 * 'submitted' is its legacy alias (accepted as a stored threshold value and
 * included in the revealed set for any legacy rows).
 */
/**
 * Ordered list of statuses used to compute the name-reveal threshold.
 * Only post-acceptance statuses are listed; 'invited' and 'declined' are
 * deliberately absent so pre-acceptance client-invited talent stay anonymous.
 * 'new' is the canonical submitted phase; 'submitted' is its legacy alias
 * (accepted as a stored threshold value and included in revealed sets).
 */
export const REVEAL_STATUS_ORDER = [
  "new",            // accepted invitation or self-applied
  "under_review",   // client actively reviewing
  "reviewed",       // client completed review
  "shortlisted",    // client shortlisted
  "interviewing",   // interview scheduled
  "offer_extended", // offer sent
  "offer_expired",  // offer lapsed without a response — name stays visible
  "offer_accepted", // talent accepted offer
  "offer_declined", // talent declined offer — name still visible; relationship was active
  "contract_sent",  // contract sent
  "hired",          // terminal success
  "rejected",       // name still visible; review already happened
  "withdrawn",      // name still visible if post-acceptance
] as const;

/**
 * Returns the set of submission statuses at which identity is revealed for a
 * given threshold (single definition shared by server, client, and tests).
 */
export function revealedStatusesForThreshold(threshold: string): Set<string> {
  const normalized = threshold === "submitted" ? "new" : threshold;
  const idx = REVEAL_STATUS_ORDER.indexOf(normalized as (typeof REVEAL_STATUS_ORDER)[number]);
  const startAt = idx === -1 ? 0 : idx;
  const revealed = new Set<string>(REVEAL_STATUS_ORDER.slice(startAt));
  if (revealed.has("new")) revealed.add("submitted"); // legacy alias rows
  return revealed;
}

/** All values accepted by the DB CHECK constraint (used in migration). */
export const DB_CHECK_VALUES = SUBMISSION_STATUSES.join("', '");
