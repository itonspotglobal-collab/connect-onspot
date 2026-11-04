---
name: Disposable fixture schema generation
description: Disposable schema generation, migration baseline compatibility, and transaction-local reconciliation.
---

Generate the temporary native fixture schema once into a fresh temporary directory. Do not reuse an absolute output directory for incremental generation.

**Why:** Drizzle's snapshot lookup prepends a relative prefix to an absolute snapshot path during a second generation, producing ENOENT even though the snapshot exists. Fresh temporary generation avoids this tooling quirk.

**How to apply:** Regenerate from the current shared schema into a new temporary directory, then initialize only the explicitly disposable local fixture database. Never reset the application or production database to work around fixture tooling.

Do not assume a current ORM snapshot is a valid baseline for replaying every historical SQL migration. Reconciliation helpers must share the migration connection and transaction.

**Why:** Retired-column transformations can fail on current tables. Reconciliation also compares physical index properties: ORM-generated descending indexes can use different NULL ordering from SQL defaults, even on a non-null column. A guard failure during fixture preparation is not evidence that application calculations failed.

**How to apply:** Use the real reconciliation support with its transaction-local lifetime. Preserve conflict detection; resolve baseline equivalence only in owned disposable fixtures, never by changing customer data or weakening production guards. Report preparation blockers separately from executed API-test results.

For tables whose authoritative definitions are versioned financial SQL, bootstrap the disposable fixture from those migrations rather than first creating their current ORM definitions.

**Why:** A current ORM default can differ from the original SQL-owned definition even when both represent the same application feature. Replaying historical definitions over the final ORM schema then correctly fails reconciliation before any behavior is tested.

**How to apply:** Keep production reconciliation strict. Build SQL-owned tables from their authoritative migrations in an owned temporary database, deferring unrelated ORM foreign keys until their referenced tables exist. Never treat this fixture-only accommodation as permission to modify an application database.

Reconciliation support installs a catalog-first search path. Unqualified ORM-generated CREATE statements need an explicit public creation namespace in the owned fixture.

**Why:** Otherwise fixture generation attempts to create application tables in pg_catalog and fails before any tests execute.

**How to apply:** Set the fixture creation search path deliberately after installing transaction-local helpers. This is distinct from index/default equivalence conflicts; do not weaken reconciliation to hide those conflicts.

Also verify migrations through the application's actual runner, not only through a test harness that preloads their dependencies.

**Why:** A fixture can successfully reconcile tables while concealing missing session-local helper setup in the normal startup path. Behavioral tests alone do not prove startup readiness.

**How to apply:** Check helper initialization and finalization on the same runner connection/transaction and confirm the development application starts after a newly added reconciliation migration. Never use production as the integration-test target.

Native local PostgreSQL fixtures need a native database adapter at the test boundary, not the application's hosted Neon WebSocket transport.

**Why:** Finance integration imports reached a local HTTPS/WebSocket port instead of the disposable PostgreSQL port, even though the test URL itself was correct. Schema preparation succeeded while endpoint tests could not connect.

**How to apply:** Bind production database imports to a guarded, disposable native adapter in the test build. Preserve the explicit fixture role/database checks and stripped provider credentials; do not change the production driver to accommodate tests.
