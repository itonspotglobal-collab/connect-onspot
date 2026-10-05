---
name: Timesheet access boundaries
description: Permission and navigation-side-effect decisions for organization-aware hired-work timesheets.
---

Do not reuse organization Team roster visibility as proof of timesheet access. Organization account membership is distinct from a completed Client hiring relationship. Non-hiring organization owners/members need an explicit time/payroll permission policy before receiving another Client's timesheets.

**Why:** The organization-aware Timesheets request explicitly forbids assuming that every workspace member has financial/work-time visibility. Workspace owner/member roles establish account-management access, not an approved expansion of hiring-client timesheet permissions.

**How to apply:** Keep requested organization, Talent and contract IDs as filters within authenticated hiring ownership. Do not add hired Talent to workspace account memberships or introduce a global Talent organization assumption.

Account-navigation eligibility lookups must be read-only and lightweight, rather than generating attendance periods or retrieving session/revision history.

**Why:** A menu is visited throughout the portal. Its visibility check should not trigger the full Timesheet generation/serialization flow merely because the user opened another page.

**How to apply:** Preserve the canonical completed-hire eligibility rule across navigation, Clock and Timesheets; leave period generation to the existing Timesheet flow. Retain historical access without imposing attendance on Guaranteed engagements.
