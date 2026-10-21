---
name: Shortlist workflow separation
description: Durable rules for keeping client shortlists distinct from formal hiring invitations.
---

Client shortlisting is a private, persistent planning action, not an applicant or invitation state. Reuse the submission record with an explicit workflow type, exclude shortlist rows from talent applications and invitation checks, and promote the same row when the client later sends a formal invitation.

**Why:** A shortlist must not notify talent, create an interview, unlock messaging, or appear as an application, while still avoiding duplicate records when hiring intent becomes formal.

**How to apply:** Keep shortlist creation role-scoped and idempotent; validate the selected client-owned role separately from formal invitation readiness. Generic application status updates require a genuine application or accepted invitation, never `client_shortlist`. Other hiring actions follow their dedicated eligibility rules; do not infer invitation-only eligibility from a shortlist-compatible status. Keep open roles visible to shortlist planning across approval states, while formal interviews require `approved`.