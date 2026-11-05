---
name: Applicant journey presentation
description: Owner-confirmed meaning of job notices, discovery ranking and early-stage payment copy.
---

Job approval notices should take Clients to the published job preview, not an edit form. Editing remains the corrective action for rejected or unapproved posts. Talent application-status notices should open the relevant job, with the applications list only as a missing-job fallback.

**Why:** QA found that generic destinations and edit links made recipients lose the context of the event they had just received.

**How to apply:** Preserve role checks, safe internal routing and mark-read/idempotency behavior when changing notification destinations. Historical alerts must work without rewriting their persisted records.

Only featured jobs receive a discovery-ranking promotion; urgency remains a visible badge, not a ranking boost. Other jobs should be newest first using their posted date, with creation date as the fallback.

**Why:** The owner explicitly removed urgent-first ranking so urgency does not displace featured roles or newer ordinary roles.

**How to apply:** Keep ordering consistent across server pagination and client display; do not reintroduce urgency weights when adding badges or sort options.

Shortlist and interview stages must not suggest that payment is due or that payment instructions are being prepared. Payment-state messaging starts only after an offer is accepted and an actual deposit invoice exists.

**Why:** Early payment labels misrepresented where the applicant was in the hiring process.

**How to apply:** Preserve later-stage paid, verification, deferment and waiver meanings, and use server-authorized setup messages rather than unconditional client fallbacks.
