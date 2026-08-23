---
name: Formal Pipeline Guard
description: Centralized enforcement module for the rule that only client_invitation submissions may enter the hiring pipeline (interviews, offers, contracts, messaging, name-reveal).
---

## The rule
`job_submissions.workflow_type = 'client_invitation'` must appear in every query that accesses pipeline resources. Silent shortlists (`client_shortlist`) and organic applications (`application`) must be excluded from all pipeline mutation and read paths.

## Module: server/services/formalPipelineGuard.ts

### Exported constants
- `FORMAL_PIPELINE_PREDICATE` — SQL fragment `"workflow_type = 'client_invitation'"`. Embed as `js.${FORMAL_PIPELINE_PREDICATE}` in JOIN queries or `${FORMAL_PIPELINE_PREDICATE}` in single-table queries.
- `FORMAL_PIPELINE_ACTIVE_STATUSES` — readonly tuple of statuses that unlock name-reveal and messaging (new through hired).
- `FORMAL_PIPELINE_ACTIVE_STATUS_SQL` — pre-built IN-list string for embedding: `status IN (${FORMAL_PIPELINE_ACTIVE_STATUS_SQL})`.

### Exported functions
- `nameRevealExistsSQL(clientParam, talentParam)` — builds the standard EXISTS subquery for name-reveal / messaging eligibility. Params are SQL placeholders or column refs (e.g. `"$2"`, `"u.id"`).
- `loadClientFormalSubmission(submissionId, clientId, options?)` — loads a submission that belongs to this client AND is a formal invitation. Returns `{ ok: true, row }` or `{ ok: false, status: 404 | 403, error }`. Options: `extraCols`, `joinClause`, `forUpdate`, `txClient`.
- `loadAdminFormalSubmission(submissionId, options?)` — same but no ownership filter for admin routes.

### Return type note
`FormalSubmissionCore` uses `[key: string]: any` for extra columns so the named core fields (`id`, `status`, `workflow_type`, `client_id`, `talent_id`, `email`, `job_id`) remain properly typed while extra cols requested via `extraCols` are accessible without TypeScript errors.

## Retrofitted enforcement points
All of these now use constants or helpers from the guard instead of hand-written literals:

| Route / helper | Mechanism used |
|---|---|
| `resolveSafeMessageSenderName` EXISTS subquery | `nameRevealExistsSQL` |
| `POST /api/message-threads` relationship query | `FORMAL_PIPELINE_PREDICATE` + `FORMAL_PIPELINE_ACTIVE_STATUS_SQL` |
| `GET /api/me/message-threads` EXISTS enrichment | `nameRevealExistsSQL` |
| `POST /api/client/interviews` | `loadClientFormalSubmission` with joinClause |
| `GET /api/client/interviews` | `loadClientFormalSubmission` |
| `PATCH /api/client/interviews/:id` | `FORMAL_PIPELINE_PREDICATE` in txClient query |
| `GET /api/client/interviews/:id/proposals` | `FORMAL_PIPELINE_PREDICATE` |
| `PATCH /api/client/interviews/:id/outcome` | `FORMAL_PIPELINE_PREDICATE` |
| `POST /api/client/offers` | `loadClientFormalSubmission` with joinClause |
| `GET /api/client/offers` (both queries) | `loadClientFormalSubmission` + `FORMAL_PIPELINE_PREDICATE` |
| `PATCH /api/client/offers/:id/respond` | `FORMAL_PIPELINE_PREDICATE` |
| `GET /api/talent/offers` | `FORMAL_PIPELINE_PREDICATE` |
| `GET /api/admin/hiring-contracts` | `FORMAL_PIPELINE_PREDICATE` |
| `createHiringContract` (hiringContractService.ts) | `loadAdminFormalSubmission` with forUpdate + txClient; secondary lookup distinguishes 404 vs 409 |

## NOT centralized (intentional)
- Status-change routes use `<> 'client_shortlist'` (not `= 'client_invitation'`) because they also accept organic `application` submissions. These are intentionally left as inline predicates.
- Shortlist management routes (create, list, delete, promote) hard-code `workflow_type = 'client_shortlist'` — also intentional.

## Usage rule for new pipeline routes
Any new route that touches interviews, offers, contracts, messaging, or name-reveal MUST:
1. Call `loadClientFormalSubmission` / `loadAdminFormalSubmission` for submission ownership checks, OR
2. Embed `FORMAL_PIPELINE_PREDICATE` in the SQL for queries that join through other tables (interviews, offers).

Never hand-write `workflow_type = 'client_invitation'` in a new route.
