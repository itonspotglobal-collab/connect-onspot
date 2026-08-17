---
name: Status rename audit
description: Complete record of the 'submitted' → 'new' canonical rename in job_submissions.status, including all write paths fixed and the name_reveal system overhaul.
---

## Summary

`'submitted'` was a display alias only. The canonical DB value is `'new'`. All write paths
have been normalized. A CHECK constraint on `job_submissions.status` enforces this going forward.

## What was fixed

### Write paths in server/routes.ts
1. `POST /api/talent/invitations/:id/respond` accept branch — `"submitted"` → `"new"`
2. Authenticated talent self-apply INSERT — `'submitted'` → `'new'`
3. Unauthenticated talent self-apply INSERT — `'submitted'` → `'new'`

### Name-reveal system
- Seed: `platform_settings('name_reveal_threshold', 'submitted')` → `'new'`
- Migration: `UPDATE platform_settings SET value = 'new' WHERE key = 'name_reveal_threshold' AND value = 'submitted'` — ran at startup, migrated 1 row in production
- `SUBMISSION_STATUS_ORDER` expanded from `["submitted","reviewed","shortlisted","hired"]` to include ALL post-acceptance statuses (new, under_review, reviewed, shortlisted, interviewing, offer_extended, offer_accepted, offer_declined, contract_sent, hired, rejected, withdrawn) — pre-existing bug where intermediate statuses were not in the reveal set
- Fallback values `?? 'submitted'` and `{ nameRevealThreshold: 'submitted' }` → `'new'`
- `VALID_THRESHOLDS` admin-settable values: `['new', 'reviewed', 'shortlisted', 'hired']`

### IN() read clauses (stale dead code)
- Two messaging "has accepted invitation" IN() clauses updated to use canonical statuses

### Test files
Fixed in: `talent-invitations.test.ts`, `message-threads.test.ts`, `message-threads-production.test.ts`, `client-talent-search.test.ts`

## Display alias pattern (intentional, kept)

The admin summary endpoint maps `new` → `submitted` for the UI display layer:
- `routes.ts`: `const key = row.status === "new" ? "submitted" : row.status` — **keep as-is**
- Admin filter: `if (statusFilter === "submitted") { params.push("submitted", "new") }` — **keep as-is**

These are deliberate UI aliases, not bugs.

**Why:** The UI shows "Submitted" to users but stores "new" in the DB. Changing the display would be a UX regression.
