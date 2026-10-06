---
name: Shared hiring calendar
description: Calendar ownership and Client-permission boundaries for hiring interviews.
---

Admin interview availability and calendar confirmations belong to the shared FindWork mailbox, not the logged-in Admin or the selected interviewer's personal calendar. Selected OnSpot interviewers supply participant context, not a calendar-ownership override.

**Why:** The owner explicitly requires one shared hiring calendar and identified personal-calendar routing as a product bug.

**How to apply:** Keep mailbox operations server-side, fail clearly when permission/access is unavailable, and never treat a saved interview or companion email as proof of Outlook invitation delivery.

Preserve the existing Client in-app proposal/response flow. This calendar correction does not authorize arbitrary Client mailbox access or require a new Admin approval gate.

**Why:** The requested scope explicitly preserves existing Client permissions rather than redesigning scheduling.

**How to apply:** Derive shared-calendar management from Admin-managed interviews; separately verify authenticated browser interactions and real recipient delivery before claiming UAT.
