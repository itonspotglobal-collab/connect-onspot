---
name: Client navigation availability
description: Owner-approved distinction between visible Client functionality and preserved planned routes.
---

Client navigation must lead to implemented destinations appropriate for the Client role. Do not expose unavailable functionality merely because a named route or placeholder exists.

**Why:** The owner approved removing Contracts, Payments, Projects, Performance, and ROI Analytics from visible desktop/mobile Client navigation after auditing their actual destinations.

**How to apply:** Verify the outer router, role dispatch/guard, destination, and all navigation surfaces before adding or retargeting a Client link. Preserve working navigation and business logic.

Keep the existing Coming Soon routes/components for Projects, Performance, and ROI Analytics even while their navigation entries are hidden.

**Why:** The owner explicitly authorized removing navigation exposure only, not deleting or changing those routes/components.

**How to apply:** Do not delete these routes as unused code or replace their destination without separate approval. If real functionality is later implemented, review its Client navigation deliberately.

Billing, Monthly Invoices, and Contract End Requests are distinct flows, not presumed substitutes for general Payments or Contracts navigation.

**Why:** The owner explicitly prohibited retargeting the obsolete links to vaguely related functionality.

**How to apply:** Only introduce an alias or redirect when the intended functionality is demonstrably equivalent; otherwise remove unavailable navigation and preserve normal route-not-found behavior.