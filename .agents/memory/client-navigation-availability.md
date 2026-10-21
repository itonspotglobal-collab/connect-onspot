---
name: Client navigation availability
description: Owner-approved distinction between visible Client functionality and preserved planned routes.
---

Client navigation must lead to implemented destinations appropriate for the Client role. Do not expose unavailable functionality merely because a named route or placeholder exists.

**Why:** The owner approved removing then-unavailable destinations from visible desktop/mobile Client navigation after auditing their actual destinations. That cleanup was not a permanent ban on a destination later given real functionality.

**How to apply:** Verify the outer router, role dispatch/guard, destination, and all navigation surfaces before adding or retargeting a Client link. Preserve working navigation and business logic.

Keep the existing Coming Soon routes/components for Projects, Performance, and ROI Analytics even while their navigation entries are hidden.

**Why:** The owner explicitly authorized removing navigation exposure only, not deleting or changing those routes/components.

**How to apply:** Do not delete these routes as unused code or replace their destination without separate approval. If real functionality is later implemented, review its Client navigation deliberately.

Billing, Monthly Invoices, and Contract End Requests are distinct flows, not presumed substitutes for general Payments or Contracts navigation.

**Why:** The owner explicitly prohibited retargeting the obsolete links to vaguely related functionality.

**How to apply:** Only introduce an alias or redirect when the intended functionality is demonstrably equivalent; otherwise remove unavailable navigation and preserve normal route-not-found behavior.

Keep Client Profile as a company/profile overview with compact job and
application previews, not the primary hiring-management workspace.

**Why:** On 2026-10-22 the owner explicitly requested dedicated Job Postings and
Job Submissions destinations while preserving the existing workflow and the
Management/System navigation.

**How to apply:** Put full management actions in the dedicated destinations and
link there from previews. Preserve old notification/email resource links rather
than requiring senders or historical messages to change.