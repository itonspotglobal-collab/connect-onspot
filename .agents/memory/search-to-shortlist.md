---
name: Search-to-Shortlist feature
description: How the client-initiated talent discovery flow works end-to-end
---

# Search-to-Shortlist

## Architecture
- Client enters free-text search + optional category chip + engagement type on `/client-search`
- `POST /api/client/talent-search` creates a **scaffold job** (`status='draft'`, `created_via='search_scaffold'`, `approval_status='approved'`) purely for scoring — never shown on public board
- `storage.rankTalentForJob(jobId, limit)` loads the scaffold job via `getJobWithSkills()` (works with draft), queries all `candidates WHERE user_id IS NOT NULL`, scores each via `scoreJobForCandidate`, returns sorted list
- Client clicks "Invite" → `POST /api/client/invitations` creates `job_submissions` row with `status='invited'`, `initiated_by='client'`
- Talent sees invitations at `/my-applications` via `InvitationsSection` component (uses `GET /api/talent/invitations`)
- Talent accepts → `POST /api/talent/invitations/:id/respond { action: 'accept' }` → status becomes `'submitted'` (regular application); decline → `'declined'`

## Key columns used
- `jobs.created_via` — `'search_scaffold'` distinguishes from real postings (`'manual'`)
- `job_submissions.initiated_by` — `'client'` vs `'talent'`; persists across status changes
- `job_submissions.status` — `'invited'` → `'submitted'` on accept, `'declined'` on decline

## Category constants
- `TALENT_BROWSE_CATEGORIES` in `client/src/lib/jobConstants.ts` — 10 canonical browse chips (source of truth)
- `resolveBrowseCategory(raw)` — maps raw DB values to canonical chip label, case-insensitive; returns null for unrecognized values (by design — two known mistagged jobs are deliberately unmapped)

**Why:** Returning null on unknown values surfaces mistagged jobs rather than silently mis-filing them.

## Parity note
`rankTalentForJob` includes the same `coreSkills/secondarySkills` fallback as `calculateJobMatches` (legacy candidates with no `user_skills` rows are scored using candidate record directly).

## Known mistagged jobs (do not auto-fix)
- CSR (`af990741`) — tagged `"Operations"`, should be `"Customer Support"`
- Accounting Manager (`0fc0176c`) — tagged `"Executive"`, should be `"Accountants"`
