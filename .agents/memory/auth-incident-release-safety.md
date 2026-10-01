---
name: Authentication incident release safety
description: Application-only fixes do not establish a database-free restart or release path.
---

During an incident that prohibits migrations, do not treat server startup or ordinary publishing as neutral verification actions.

**Why:** Authentication fixes can require no schema changes while launch hooks and route registration still perform unrelated migration, DDL, or backfill work. A passing build does not prove that a release will avoid those operations.

**How to apply:** Inspect the actual launch path before restarting or recommending publication. Use isolated frontend fixtures and dependency-injected backend checks when startup is prohibited. Report release safety separately from code compatibility, and do not bypass migration safeguards, alter the ledger, or promote unrelated pending changes without explicit approval.