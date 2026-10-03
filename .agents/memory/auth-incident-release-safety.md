---
name: Authentication incident release safety
description: Application-only fixes do not establish a database-free restart or release path.
---

During an incident that prohibits migrations, do not treat server startup or ordinary publishing as neutral verification actions.

**Why:** Authentication fixes can require no schema changes while launch hooks and route registration still perform unrelated migration, DDL, or backfill work. A passing build does not prove that a release will avoid those operations.

**How to apply:** Inspect the actual launch path before restarting or recommending publication. Use isolated frontend fixtures and dependency-injected backend checks when startup is prohibited. Report release safety separately from code compatibility, and do not bypass migration safeguards, alter the ledger, or promote unrelated pending changes without explicit approval.

An earlier no-publish/no-migration report is a time-specific observation, not evidence that the live release remains unchanged.

**Why:** Publication can happen between Agent turns, and a deployment's launch command can apply pending migrations even when the preceding conversation did not authorize those migrations.

**How to apply:** During production incident diagnosis, reconcile publication records, timestamped runtime logs, and the positively identified production migration ledger before claiming that pending code or schema is still absent. Do not attribute a publication to a person without evidence.

## Staging isolation policy

Use a separate staging project with its own PostgreSQL database, project-owned object-storage bucket, and server secrets. Keep destructive automated testing on a third, disposable database rather than long-lived staging.

**Why:** The owner explicitly requires production, staging, and disposable-test data separation. A development label alone does not establish safe staging, and shared external credentials can affect real parties even when database records are isolated.

**How to apply:** Establish independent project/database identity, recovery evidence, and external-side-effect controls before application startup or migration. Keep real verification delivery disabled until approved team recipients and delivery restrictions are established. Never substitute production connections or the legacy Neon connection for an unprovisioned staging target.