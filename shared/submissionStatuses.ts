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
  "under_review",
  "reviewed",
  "shortlisted",
  "interviewing",
  "offer_extended",
  "offer_accepted",
  "offer_declined",
  "contract_sent",
  "hired",
  "rejected",
  "withdrawn",
];

/** All values accepted by the DB CHECK constraint (used in migration). */
export const DB_CHECK_VALUES = SUBMISSION_STATUSES.join("', '");
