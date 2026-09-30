---
name: Two-database / NEON setup (final)
description: Each env uses its own DATABASE_URL. NEON_DATABASE_URL was a legacy artifact and has been removed.
---

## Environment identity

Development and production use distinct PostgreSQL databases. A legacy
staging Neon connection was once mistaken for production, causing repeated
false claims about production data.

**Why:** Connection names and a development-shell variable do not prove
which database a running deployment uses.

**How to apply:** Avoid querying production from the development shell or
trusting legacy Neon variables. Confirm the target using an independent
live-deployment identity check before drawing production conclusions.

## Reliable production verification

Queries from the development shell never reach the production `DATABASE_URL`.
The read-only production database interface is usable for schema checks: it
returned an existing public job found through the live API, while the
development database did not. Confirm this live-API identity cross-check
whenever using it for production conclusions; do not substitute the old
staging Neon connection or shell environment variables.

**Why:** An old staging Neon variable caused repeated false claims about
production state. The production read-only interface is a separate remote
query path, not a shell query against the development database.

**How to apply:** Verify the live deployment identity with a harmless public
record or equivalent independent check, then use the production read-only
database interface for schema state. Use the live API for app behavior. If the
identity check fails, report production schema as unverified rather than
guessing.
