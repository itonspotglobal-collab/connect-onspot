---
name: Hiring pipeline status invariants
description: Durable rules for job_submissions.status and the contract/offer pipeline — who may write which status, and migration ordering.
---

## Rules

- `shared/submissionStatuses.ts` is the single source of truth for status values, the settable allowlists, and the name-reveal logic (`revealedStatusesForThreshold`). Server, client, and tests must all import from it — never redefine status lists inline.
- Pipeline-driven statuses (`interviewing`, `offer_extended`, `offer_accepted`, `contract_sent`, `hired`) are set only as side effects of creating/updating pipeline records (interviews, offers, hiring contracts) — never via direct status PATCH, email-send `updateStage`, or UI selectors. Every status-writing surface must validate against the shared allowlists.
- **Why:** a DB CHECK constraint enforces canonical values, and reviews repeatedly rejected work where some writer (email path, UI dropdown) could bypass the contract workflow or write a legacy alias.
- `'submitted'` is a legacy display alias for canonical `'new'`. Any migration that adds/changes the CHECK constraint must normalize legacy values first ('submitted'→'new', 'offered'→'offer_extended', 'interview'→'interviewing'), and reveal/filter logic must treat 'submitted' and 'new' as the same phase.
- Hiring-contract routes require explicit `authenticateJWT` + `role === 'admin'`; the dev `BYPASS_ADMIN_AUTH` bypass must never apply to them. Contract void status is `'void'` (matches the partial unique index `WHERE status != 'void'`); offer acceptance status is `'offer_accepted'` (not `'accepted'`).
- Pending interviews must always have an explicit proposal owner. Startup migration backfills legacy rows from the latest proposal role, defaulting history-less pending rows to talent.
  **Why:** nullable ownership left pre-existing proposals unavailable to both response paths after turn enforcement was added.
- **How to apply:** when adding any new status writer or selector, wire it to the shared module and extend `server/tests/hiring-contracts.test.ts`, which exercises the production routes end-to-end.
