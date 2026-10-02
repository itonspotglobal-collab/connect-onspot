---
name: Isolated server test boundaries
description: Transitive imports can initialize external stores or auth services before pure unit assertions run.
---

Treat the entire import chain, not just a test's own query calls, as the boundary of an isolated server test.

**Why:** Tests of pure privacy functions and injected route helpers initialized conversation-memory storage or authentication metadata through transitive imports. Denying SQL alone did not make those imports independent of the environment.

**How to apply:** Run isolated tests with provider credentials removed and deny external I/O at every storage boundary. Prefer boundary mocks over partial service mocks that omit unrelated exports. Report import-time configuration failures as environmental file-load failures, separately from assertion failures and database-connected suites that were not run. Never supply a real database merely to make an isolated suite initialize.