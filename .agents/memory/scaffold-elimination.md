---
name: Scaffold elimination
description: Architecture decision — the Hire Talent search bar never creates a jobs row; invitations require a real open/approved job.
---

## Rule

`POST /api/client/talent-search` **must never write to the `jobs` table**. The endpoint calls `storage.rankTalentByParams()` in-memory and returns `{ results }` with no `jobId`. This is a permanent architectural constraint — reverting it would re-introduce scaffold pollution.

**Why:** Scaffold rows leaked into the client's own job dashboard, the talent-facing Find Work feed, job matches, and popular jobs despite `status='draft'` filters. The root cause was status-based exclusion being unreliable; the fix was to stop creating scaffold rows at all.

## What changed

- `POST /api/client/talent-search` — no DB write; response is `{ results }` (no `jobId`)
- `PATCH /api/client/talent-search/:jobId` — deleted; engagement-type rescore is a new POST call
- `POST /api/client/invitations` — now requires a **real** job: `status='open' AND approval_status='approved' AND (created_via IS NULL OR created_via != 'search_scaffold')` plus `client_id = authenticatedUser` ownership check
- `HireTalentPage.tsx` + `SearchToShortlist.tsx` — invitation flow opens a job-picker modal that fetches `GET /api/client/jobs` on demand; no `jobId` stored in component state

## Job picker modal logic

On "Invite" click: fetch client's open approved jobs → branch:
- **0 jobs** → "Post a job first" + link to `/client-profile`
- **1 job** → single confirm modal
- **2+ jobs** → scrollable picker; Confirm disabled until selection; Cancel resets state with zero network calls

## Backward compatibility

Existing scaffold rows in `jobs` (with real `job_submissions`) are preserved and untouched. Startup migration at routes.ts guards them. New searches never create new scaffold rows.

## Invariant to maintain

Any future endpoint that accepts a `jobId` from a client must include the same four-condition guard: owned by client, open, approved, not a scaffold. Do NOT accept any job the client "just searched for" — those scaffolds no longer exist.
