---
name: Clock activity and paid-time policy
description: Engagement activity defaults, daily limits, and immutable approved-hour interpretations.
---

Talent switches between Work, Lunch, Break and Meeting within the same session, without clocking out. Work is always paid. Defaults are unpaid lunch, paid breaks and paid meetings; lunch is 60 minutes, breaks 15 minutes, with two breaks per work day.

**Why:** The owner explicitly requires a continuous shift with payment calculated from its status history, preserving the existing missed-Time-Out review process.

**How to apply:** Snapshot payment eligibility and applicable duration limits when an activity starts. A rule change affects subsequent activities, not an already-running activity. Over-limit durations warn and notify once, never auto-switch or block Time Out. Count daily allowances across the engagement's sessions in its stable work timezone so clocking out/in does not reset allowances.

Approved timesheets must retain their original interpretation. Historical approvals without activity snapshots remain all-work; new approvals freeze activity/payment details. Approved earlier finish times clip calculations, never erase or rewrite captured activities.

**Why:** Later contract-rule changes and missed-Time-Out decisions must not silently alter an approved amount or previously issued invoice.

**How to apply:** Use the same paid-time interpretation in Clock, daily/period totals, dashboard activity and invoice hours. Keep full activity placement in approval snapshots so partial-period billing can exclude unpaid segments at their actual times, rather than pro-rating total paid hours.
