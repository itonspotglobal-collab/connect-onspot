---
name: Job approval transition alerts
description: Idempotency and atomicity rule for Client notifications when Admin changes a job's approval status.
---

Treat each real job approval-status transition as its own notification event. Repeating a request while the job is already in the requested state is a successful no-op, but leaving and later re-entering that state must create a fresh unread notification.

**Why:** Deduplicating by job and notification type permanently suppresses legitimate later approvals. Separating the status update from the notification can also commit a transition without its alert if notification persistence fails.

**How to apply:** Lock the job, compare old and requested states, and persist the status update plus its uniquely identified notification in one database transaction. Keep same-state retry protection local to this workflow; do not weaken deduplication rules for unrelated notification types.