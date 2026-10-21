---
name: Client direct status email policy
description: Client-owned genuine application review transitions send automatic emails without Admin approval; dedicated hiring stages remain separate.
---

Clients may directly change eligible generic review statuses on genuine applications to their own jobs. The corresponding Admin-managed published email must be accepted by the existing Microsoft Graph service before status/history/notifications finalize. No Client composer or Admin approval is required.

**Why:** On 2026-10-21 the owner explicitly replaced the Admin-required approval policy with automatic template-based Client updates, while retaining email/status consistency, Talent privacy and all dedicated hiring/financial approvals.

**How to apply:** Use the existing shared email-linked status handler and canonical status allowlist. Require authoritative job ownership, an exact source version and an idempotent operation identity. Preserve historical requests; retire their approval-send action. Recover previously delivered legacy approvals without resending. Never treat this permission as authority to mutate private shortlists, pending invitations, terminal states, interviews, offers, signatures or billing.