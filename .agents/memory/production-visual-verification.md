---
name: Production visual verification isolation
description: Safely exercising the full compiled public app locally without sharing production or development services.
---

Inspect full startup dependencies before attempting an isolated production
visual check. A public page can still require database TLS, Replit metadata,
session configuration and unrelated service constructors before routes load.

**Why:** The compiled app's startup path is broader than individual endpoint
fixtures. Repeatedly supplying only the next missing setting wastes attempts
and can tempt unsafe reuse of live service credentials.

**How to apply:** Use an owned disposable database with TLS and an accurately
represented final-schema migration ledger. Preserve production auth/security
behavior; isolate unrelated services rather than weakening the app or borrowing
live credentials. A native PostgreSQL transport adapter must preserve the
provider's ESM exports: resolve its import entry rather than its CJS require
entry. Do not claim that a final-schema visual fixture tests forward production
migration compatibility or real authenticated-account UAT.

Responsive tests with visible scrollbars use a narrower content column than
the nominal viewport. Check actual rendered bounds, not just viewport arithmetic.

**Why:** A rotated phone that fits a nominal 320px layout can still be clipped
when the browser reserves space for a vertical scrollbar.

**How to apply:** Test actual element/stage rectangles with reduced motion and
visible scrollbars, keeping both no-overflow and no-overlap assertions.
