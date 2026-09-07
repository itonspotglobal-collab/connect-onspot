---
name: One-time event popups
description: How durable transactional popups share canonical notification events without repeating or consuming bell read state.
---

Use one canonical, idempotent notification event per business transition. Popup presentation must be acknowledged separately from notification read state and claimed atomically on the server.

**Why:** Local or session storage repeats across devices, while reusing `is_read` would silently consume the persistent bell notification. A read-then-write claim can also show the same popup in concurrent tabs.

**How to apply:** For future transactional popups, use a deterministic event key, a nullable presentation acknowledgement on the notification, and one atomic claim operation. Poll/focus checks may discover online events, but must never create another notification.