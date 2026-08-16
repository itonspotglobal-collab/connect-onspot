---
name: Search-to-Shortlist PII audit
description: Contact-information exposure findings and fixes across the client search/invite/accept flow.
---

## Rule
Contact fields (email, phone, resumeUrl, resumeFileName, linkedinUrl, githubUrl, portfolioUrl, websiteUrl, videoIntroUrl, passwordHash) are **never** returned through any client-facing endpoint at any stage — including after acceptance. Name and contact are independent axes: name reveals on acceptance, contact never does.

**Why:** User's explicit product requirement: "name unmask ≠ contact unmask. Email, phone, external links must never be exposed to the client at any stage."

## What was fixed (server/routes.ts)

### 1. Search results (pre-invite) — sanitizeSearchCandidate()
Defined near line 9508 (before POST /api/client/talent-search).
- Applied to both `POST /api/client/talent-search` and `PATCH /api/client/talent-search/:jobId`.
- Allowlists safe non-contact fields; masks name server-side (not just in the browser).
- Explicitly strips: email, phone, resumeUrl, resumeFileName, linkedinUrl, githubUrl, portfolioUrl, websiteUrl, videoIntroUrl, videoIntroFileName, passwordHash, displayName.
- **Previously**: returned the full raw Candidate object from `db.select().from(candidatesTable)` including all contact fields and passwordHash. Masking only happened in the frontend.

### 2. Post-accept submissions (GET /api/client/job-submissions, :id)
`sanitizeClientSubmissionRow` was rewritten to always strip email/phone regardless of status.
- Pre-accept (invited/declined): name masked + all contact null ✅
- Post-accept (submitted+): name reveals, contact still null ✅
- **Previously**: the accepted-row branch returned the full row including email and phone.

### 3. PATCH /api/client/job-submissions/:id/status
Response now passes through `sanitizeClientSubmissionRow`.
- **Previously**: returned raw `RETURNING *` with no sanitization — exposed email, phone on every status update.

## Gap — messaging (not yet implemented)

`message_threads` table exists (participants: text[], jobId FK). Endpoints at /api/message-threads + /api/messages have **no auth middleware** and are not wired to the post-acceptance flow. When talent accepts an invitation, no thread is created. Client has no in-platform communication path with accepted talent. Needs scoping before implementation.

## How to apply

Any new client-facing endpoint that touches the candidates table or job_submissions must:
1. Call `sanitizeSearchCandidate(candidate)` before returning candidate objects.
2. Call `sanitizeClientSubmissionRow(row)` before returning submission rows.
3. Never include a bare `SELECT *` or `RETURNING *` in a client response without sanitization.
