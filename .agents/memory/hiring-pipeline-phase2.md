---
name: Hiring pipeline — offers
description: Durable rules for the offer flow — engagement snapshot, rate-mismatch flags, expectation source, canonical statuses, and concurrency patterns.
---

## Durable rules
- **Offer engagement type is snapshotted from the job, never accepted from a request body.** Only 'Half-Day' | 'Full-Time' are valid (DB CHECK); jobs without one cannot receive offers (409 `job_missing_engagement_type`).
  **Why:** offer terms must reflect what the job was approved as, not what a client types.
- **Rate-mismatch flags (`rate_below_expectation`/`rate_delta`) are NULL unless currency AND engagement type both match the talent's expectation exactly. Never fake FX conversion.** Talent-facing views omit these fields — client-internal analytics only.
- **Talent rate expectation source of truth is `candidates.preferences` (keys rateAmount / rateCurrency / rateEngagementType)** — dual-written from Settings and onboarding. Not profiles.hourlyRate. Resolved via `candidates.user_id = js.talent_id`, email fallback.
- **Only canonical submission statuses may be written to the DB** ('new', not 'submitted'; 'interviewing', not 'interview'; 'offer_extended', not 'offered'). The CHECK constraint rejects legacy aliases — any endpoint or UI writing legacy values fails at the DB. Legacy aliases belong in the display layer or an alias map at the route boundary.
  **Why:** a review caught invitation-accept and the admin status route still writing legacy values after the constraint landed — a production-breaking regression.
- **Business-rule uniqueness must be DB-enforced, not check-then-insert.** Single pending offer per submission uses a partial unique index (`WHERE status = 'sent'`); the route maps error 23505 to a 409 `offer_already_pending`. Status transitions plus their history/side-effect writes go in one transaction, with conditional UPDATEs (`WHERE status = ...`) for race safety; re-offer after decline is a new row.
- **Talent ownership resolution:** talent JWT (type:"candidate") → candidates row → linked users row by email → `job_submissions.talent_id = users.id`, with legacy fallback `(talent_id IS NULL AND email match)`.
- **Dev trace JWTs:** client tokens need `{userId, email, role}` and the role must match the users row (middleware re-checks DB → 401 "User role has changed" on mismatch); talent tokens need `{type:"candidate", candidateId, email}`.

**How to apply:** contract-stage work hangs contracts off offers, reuses the conditional-UPDATE + single-transaction pattern, and checks every status writer against the canonical list before adding new pipeline states.

