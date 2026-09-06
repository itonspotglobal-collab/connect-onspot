---
name: Client event notification details
description: Product invariants for Client notifications that open current-state informational dialogs.
---

Client notifications for hiring events are immutable event signals, keyed to the state transition or immutable history row that created them. Their detail dialogs must fetch the latest authorization-checked state rather than replaying a stale event snapshot. An unread notification must be successfully marked read before its dialog or destination opens.

**Why:** Interview state can change after a notification is created, and opening details before mark-read completes can show a false read state or violate the expected click sequence.

**How to apply:** For future event notifications, insert idempotently with the state mutation, authorize detail lookups against the current owner, derive display data from current records, and stop navigation with visible feedback if mark-read fails.