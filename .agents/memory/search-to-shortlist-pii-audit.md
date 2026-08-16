---
name: Client search/shortlist PII invariants
description: Durable privacy rules for the client talent-search and invitation flow — what client-facing endpoints may and may never expose.
---


## Invariant

Contact fields (email, phone, resumeUrl, resumeFileName, linkedinUrl, githubUrl, portfolioUrl, websiteUrl, videoIntroUrl, videoIntroFileName, passwordHash) are **never** returned through any client-facing endpoint at any stage — including after the talent accepts an invitation. Name masking and contact redaction are independent axes.

**Why:** Product requirement: "name unmask ≠ contact unmask. Email, phone, external links must never be exposed to the client."

## Regression test location

`server/tests/client-talent-search.test.ts` — two describe blocks at the bottom:
- **"PII regression — sanitizeSearchCandidate (imports real shared module)"** — unit tests that import from `server/lib/clientSearchSanitize.ts` (not a copy)
- **"PII regression — HTTP endpoint response (integration)"** — makes real fetch calls to `POST` and `PATCH /api/client/talent-search`, checks every SEARCH_RESULT_BLOCKED_FIELDS key is absent from response JSON

Both layers are needed together: unit tests catch function-level regressions; HTTP tests catch route-level bypasses.

Run with: `npm test`

## How to apply

1. Any endpoint serving candidate objects to clients **must** pass through `sanitizeSearchCandidate(candidate)` (defined in server/routes.ts near `POST /api/client/talent-search`). It allowlists safe non-contact fields and masks name server-side.
2. Any endpoint serving submission rows to clients **must** pass through `sanitizeClientSubmissionRow(row)` before responding — including `PATCH` responses.
3. Never return a bare `SELECT *` or `RETURNING *` to a client route without explicit sanitization.
4. Client status selector options must match the API's `validStatuses` (`new | reviewed | shortlisted | rejected | hired`). Invitation-only states (`invited`, `declined`, `submitted`) must never appear as selectable options.
