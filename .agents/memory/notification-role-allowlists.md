---
name: Notification role allow-lists
description: Why persisted notification events can be absent from the bell and unread badge.
---

Every persisted notification type must also be included in the recipient role’s notification allow-list and presentation/routing configuration.

**Why:** The notification APIs can correctly return a database row while both the bell dropdown and unread-count hook silently filter it out. Persistence alone does not make an event visible.

**How to apply:** When adding or auditing a notification event, verify the complete path: database recipient and event key, API response, role allow-list, visual configuration, click destination, unread-count filter, and any active-session toast deduplication.