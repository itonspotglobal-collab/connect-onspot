---
name: Status email retry invariant
description: Durable rules for applicant email retries that are coupled to application status changes.
---

Failed applicant emails that were intended to change application status must retain the requested status, previous status, and internal note with the email attempt. A retry must be strictly Admin-authorized, serialized per application, allowed only for a failed attempt, and commit status/history/Talent notification only after successful delivery.

**Why:** An email-history retry that only resends the message can tell a Talent their application changed while the canonical application still has the old status, and repeated retries can duplicate delivery.

**How to apply:** Keep dedicated interview, offer, contract, hire, and withdrawal workflows outside the generic status-email path. For generic Admin status changes, use the locked email-send/retry transaction and treat any post-delivery DB failure as a consistency error.