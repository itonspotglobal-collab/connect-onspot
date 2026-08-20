---
name: Grouped message alerts
description: Durable rules for aggregating unread Bell alerts without changing messaging unread state.
---

**Rule:** Group only unread `new_message` notifications by recipient and canonical thread. Store the count structurally, refresh the group timestamp on each message, and preserve the thread id for deep links. Reading the thread closes the group; a later unread message starts a new group.

**Why:** Bell notifications are alert/deep-link records, while persisted message `readBy` remains the source of truth for message unread counts. Coupling the two models or parsing notification text causes badge drift and race-prone grouping.

**How to apply:** Route every persisted message through the storage-level atomic upsert. Serialize recipient/thread updates, never include message content or contact PII in Bell text, and skip creating an alert when the message was already marked read before the non-blocking notification step completes.