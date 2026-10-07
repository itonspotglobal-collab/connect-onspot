---
name: Clock work timezone policy
description: Why tracked work uses a confirmed engagement zone, not browser location or a mutable global job zone.
---

Work timezone is confirmed engagement context, not physical-location evidence. Browser timezone is only a suggestion; do not infer canonical work zones from IP, GPS, or device defaults.

**Why:** The owner requested regional local-time display without location tracking or claims of verified physical presence. Profile defaults do not establish explicit work-zone consent.

**How to apply:** Keep work-zone setup explicit and timezone-aware. Client-facing labels must say work/local timezone, not verified location.

Keep a valid work zone stable after recorded work; do not let a Talent Clock change a global job zone or regroup historical approved work.

**Why:** Per-engagement work context can differ from a profile/device region, while daily totals and approved snapshots must remain reproducible. A mutable shared job zone could affect other Talent and reinterpret history.

**How to apply:** Reuse valid explicitly configured context and snapshot it for tracking. Missing legacy context may be confirmed only when approved history is not reinterpreted. Later zone changes after recorded work require a deliberate history/snapshot policy, not an unrestricted setting edit.

Tracked-work timers are visual projections of canonical sessions, never another persisted hours source.

**Why:** The owner explicitly required preserving clock-derived hours and no per-second database writes.

**How to apply:** Recover the saved session after navigation/authentication changes. Keep unfinished work distinct from completed totals; do not silently complete it for submission.
