---
name: Legacy model removal
description: Safety rule for retiring legacy APIs, tables, or client models.
---

When removing a legacy API or data model, search the whole repository for callers first, migrate each user-facing path to the canonical replacement, and add an end-to-end test for the visible flow.

**Why:** Removing the server-side model while leaving an older client caller in place creates a runtime 404 that typechecking and unrelated feature tests will not catch.

**How to apply:** Treat unused-looking components as live until their imports and route references are verified; search for the old endpoint/schema name and test the replacement request through the registered application routes.