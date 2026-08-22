---
name: Shortlist workflow separation
description: Durable rules for keeping client shortlists distinct from formal hiring invitations.
---

Client shortlisting is a private, persistent planning action, not an applicant or invitation state. Reuse the submission record with an explicit workflow type, exclude shortlist rows from talent applications and invitation checks, and promote the same row when the client later sends a formal invitation.

**Why:** A shortlist must not notify talent, create an interview, unlock messaging, or appear as an application, while still avoiding duplicate records when hiring intent becomes formal.

**How to apply:** Keep shortlist creation role-scoped and idempotent; validate the selected client-owned role separately from formal invitation readiness; retain the existing invitation and messaging gates for promotion. Every interview, offer, contract, and status mutation must also require `client_invitation`, never merely a shortlist-compatible status. Keep open roles visible to shortlist planning across approval states, while formal interviews require `approved`.