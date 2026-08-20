---
name: Client status approval workflow
description: Clients request generic application status changes; only an Admin can finalize them after applicant email delivery.
---

Client-originated generic application status changes are approval requests, never direct transitions. A pending request captures the application’s then-current status and requested status; an Admin must use the existing applicant email workflow to approve it.

**Why:** A Client action must not tell a Talent their status changed before an Admin selects and successfully sends the appropriate email. The captured current status also prevents applying an obsolete request after an independent transition.

**How to apply:** Keep Client request creation, cancellation, and request notifications separate from `job_submissions.status`. At approval, lock the request and application, reject stale requests before email, then update the request, canonical status, history, Talent notification, and Client approval alert in the same post-delivery transaction.