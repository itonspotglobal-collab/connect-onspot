---
name: Interview outcome and calendar policy
description: Recruiting role authority, outcome immutability and calendar failure boundaries.
---

Recruiting stage exceptions may be authorized by Talent Acquisition or Super Admin with a written, audited reason. This does not broaden financial authority.

**Why:** The user explicitly separated recruiting responsibilities from payment and activation approval privileges.

**How to apply:** Evaluate stage-override permissions independently of financial/admin-on-behalf offer permissions. Never grant payment powers just to enable an interview exception.

Recorded interview types and resolved outcomes are immutable; only Pending may resolve to Advance or Reject.

**Why:** A Final Advance authorizes an offer. Later relabeling an already-recorded round would silently change the evidence supporting that authorization.

**How to apply:** Permit type editing and the Final designation before the first outcome, including when recording that first outcome. Preserve the recorded type when resolving Pending.

Shared calendar availability and provider access are not authoritative interview-booking gates. Persist the interview before external synchronization; retain Talent's own overlap protection.

**Why:** Provider permission failures and shared mailbox conflicts previously undid valid interview confirmations and prevented the hiring process from progressing.

**How to apply:** Surface provider failures to recruiting Admins with safe errors and idempotent recovery. Never “fix” a provider outage by weakening Talent overlap checks, signing/deposit gates or authorization.

Original in-flight cohort repairs only grandfather pre-offer eligibility, not future acceptances.

**Why:** Existing interviews/offers should not become stranded by the new prerequisites, while every newly accepted offer must retain the invoice-first funding policy.

**How to apply:** Exclude accepted/financially progressed cases from repair and preserve the fresh-acceptance policy described in pre-offer-payment-policy.md.
