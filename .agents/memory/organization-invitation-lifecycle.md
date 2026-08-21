---
name: Organization invitation lifecycle
description: The organization invitation expiry policy and its terminal status behavior.
---

Organization invitations are actionable for 30 days. Expiration is a terminal `expired` status, distinct from declined or revoked, and expired rows must remain in history while no longer blocking a resend to the same email.

**Why:** Owners need an accurate invitation history without stale pending access requests, while retaining an audit trail and allowing a safe retry.

**How to apply:** Preserve the pending-only uniqueness rule when changing this flow. Enforce expiry during scheduled cleanup and at read/response boundaries so an overdue invitation cannot be accepted even if the cleanup job has not run yet.