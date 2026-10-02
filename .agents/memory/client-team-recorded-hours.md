---
name: Client Team recorded-hour semantics
description: Owner-approved distinction between dashboard activity and billable time, with provenance and timezone constraints.
---

The Client Team Dashboard's weekly hours, hours logged, and daily activity represent recorded work, not timesheet-approved or billable hours. Preserve legacy recorded time separately from modern Tracked clocks; Guaranteed engagements have no attendance requirement and must display "Not tracked", not an implied zero-work result.

**Why:** The owner explicitly approved this distinction: the dashboard answers how much recorded activity exists, while billing answers what reviewed work is financially billable. Revisions and invoices are additional representations of the same work, never extra recorded hours.

**How to apply:** Keep billing/approval logic unchanged when correcting dashboard activity. Modern day/week boundaries use the contract/work timezone, Monday–Sunday; legacy reporting retains its established timezone behavior. Exclude unfinished/unresolved durations rather than inventing clock-out instants. "Last active" is Talent clock activity, not administrative or financial events. Preserve explicit availability as the primary presence signal.

Do not invent historical legacy/modern overlap precedence or deduplicate by matching Talent, Client, timestamps, or duration.

**Why:** The source audit did not establish that historical cross-model records cannot overlap. The owner requires a concrete ambiguous logical engagement to be reported before introducing any heuristic.

**How to apply:** Select records through their explicit engagement provenance, never add clocks to revision/invoice hours, and stop for a product decision if actual indistinguishable cross-model duplication is discovered.