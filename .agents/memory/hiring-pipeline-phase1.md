---
name: Hiring pipeline — Phase 1
description: Canonical status constant, three new pipeline tables, CHECK constraint migration, and Phase 1 interview endpoints. Key decisions and gotchas for Phase 2/3 work.
---

## What was built

**shared/submissionStatuses.ts** — single source of truth for all job_submissions.status values.
- `SUBMISSION_STATUSES` — full canonical list (used in DB CHECK constraint)
- `CLIENT_SETTABLE_STATUSES` — what PATCH /api/client/job-submissions/:id/status accepts directly
- `ADMIN_SETTABLE_STATUSES` — what PATCH /api/admin/job-applications/:id accepts directly
- Pipeline-driven statuses (`interviewing`, `offer_extended`, `hired`, etc.) are set as side effects of creating pipeline records — never via direct PATCH.

**Three new tables** (created via startup migration, idempotent):
- `interviews` — one row per round per submission; `round_number` auto-increments per submission
- `offers` — one row per offer; `engagement_type` constrained to `'Half-Day' | 'Full-Time'`
- `hiring_contracts` — linked to offers; `signing_entity` snapshotted from `platform_settings`

**platform_settings seed**: `('contract_signing_entity', 'OnSpot Technologies Inc.')`

**CHECK constraint** on `job_submissions.status` — added after normalizing legacy values.

## Migration gotchas

Dev DB had 17 rows with `status = 'submitted'` (legacy alias for `new`).
**Why**: The old codebase stored 'submitted' in the DB; the canonical design treats it as display-only. Must normalize before adding the CHECK constraint.
Migration order: normalize ('submitted'→'new', 'offered'→'offer_extended', 'interview'→'interviewing') THEN add constraint via `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`.

## Phase 1 endpoints

All require `authenticateJWT`. Ownership check: `job_submissions.client_id = req.user.id` (via JWT `userId` field, not `id`).

- `POST /api/client/interviews` — schedules a round; side-effect: status → `interviewing` (also writes audit row to `job_application_status_history`)
- `GET /api/client/interviews?submissionId=` — lists all rounds for a submission
- `PATCH /api/client/interviews/:id` — confirm (requires `confirmedTime`), reschedule (requires `proposedTimes`), or cancel; enforces valid state transitions
- `PATCH /api/client/interviews/:id/outcome` — records `advance | reject | pending`; `reject` side-effects submission to `rejected` with audit trail

## JWT structure (critical)

authenticateJWT expects `{ userId, email, role }` — NOT `{ id, email, role }`. Using `id` causes "Token missing required claims" and the middleware returns 401 with "Invalid token".

## Status guard for interview creation

Submission must be in `['shortlisted', 'reviewed', 'under_review', 'interviewing']` to schedule an interview. Any other status (new, rejected, hired, etc.) returns 409.

## Phase 2 next steps

Build `POST /api/client/offers`:
- Snapshot `engagement_type` from `jobs` at offer creation (NOT from body)
- Compute `rate_below_expectation` / `rate_delta` only when currencies AND engagement types match; NULL otherwise
- Set submission status → `offer_extended`
- Talent respond endpoint: `PATCH /api/talent/offers/:id/respond` (accept/decline → `offer_accepted` / `offer_declined`)

## Phase 3 next steps

Build `hiring_contracts` CRUD (admin-only):
- Snapshot `signing_entity` from `platform_settings('contract_signing_entity')` at create time
- `onspot_signed_at` only — no `client_signed_at`
- Fully signed → submission status → `hired`
