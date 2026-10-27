---
name: Isolated server test boundaries
description: Transitive imports can initialize external stores or auth services before pure unit assertions run.
---

# Workflow cutover fixtures

When a new workflow defaults on for unclassified records, historical-path regression fixtures must explicitly identify their intended legacy cohort. Keep new-path tests separate and exercise the real new guards.

**Why:** Manufacturing accepted offers in an older fixture is not evidence that the new interview, funding or document prerequisites were met. Weakening guards for the test environment would hide application defects.

**How to apply:** Use explicit test-only cohort setup inside the owned disposable database; never add application-wide auth or workflow bypasses. Extracted production-route harnesses must register newly introduced real dependencies rather than replacing authorization or stage checks with no-ops.

Development module resolution and production bundling can select different
extensions for an otherwise identical import.

**Why:** The development TypeScript runner selected a legacy JavaScript sibling,
while the production bundler and isolated database alias selected TypeScript.
A new TypeScript-only export passed build/fixture checks but was absent from the
extensionless development import.

**How to apply:** Resolve new critical exports explicitly and check their actual
development imports as well as the bundle. Database-alias fixtures alone do not
prove real development module wiring.

Treat the entire import chain, not just a test's own query calls, as the boundary of an isolated server test.

**Why:** Tests of pure privacy functions and injected route helpers initialized conversation-memory storage or authentication metadata through transitive imports. Denying SQL alone did not make those imports independent of the environment.

**How to apply:** Run isolated tests with provider credentials removed and deny external I/O at every storage boundary. Prefer boundary mocks over partial service mocks that omit unrelated exports. Report import-time configuration failures as environmental file-load failures, separately from assertion failures and database-connected suites that were not run. Never supply a real database merely to make an isolated suite initialize.

Disposable PostgreSQL processes need an explicitly owned background lifetime and a writable temporary Unix-socket directory in this environment.

**Why:** A detached child started from a one-shot shell did not survive to the next check, and PostgreSQL's default socket directory was unavailable. Both looked like database failures despite a valid disposable dataset.

**How to apply:** Keep the scratch server in a tracked foreground background task, with its socket under the temporary fixture directory; stop only that owned process after validation. Never substitute the application's database when scratch infrastructure fails.

Use the scratch cluster's explicitly initialized role in both PostgreSQL client commands and the disposable connection URL.

**Why:** The workspace's inherited PostgreSQL client defaults can select a different role from the operating-system user that initialized the scratch cluster, producing a misleading role-not-found failure against an otherwise healthy local server.

**How to apply:** Specify the owned scratch role explicitly rather than inheriting application database credentials or client defaults.

Temporary fixture processes and logs do not survive workspace restarts. Keep the reusable harness in tracked source and distinguish interrupted checks from completed assertion results.

**Why:** Workspace restarts during verification erased both the disposable cluster and its output; retrying against the application database would change the safety boundary.

**How to apply:** Reinitialize only the disposable fixture, recheck the latest source edits, and never replace lost test evidence with a claim of success.