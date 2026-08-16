---
name: Two-database / NEON setup (final)
description: Each env uses its own DATABASE_URL. NEON_DATABASE_URL was a legacy artifact and has been removed.
---

# Database environment map (confirmed from production startup logs, 2026-08-16)

| Environment | DATABASE_URL |
|---|---|
| Dev (local) | `helium/heliumdb` (local Postgres) |
| Production | `ep-empty-wildflower-ae9hsx05…/neondb` (Neon cloud) |

## What was removed and why

`NEON_DATABASE_URL` and `NEON_DB_LABEL` were removed from all environments.

**Root cause of 5 false-conclusion incidents:** `NEON_DATABASE_URL` pointed to a separate
staging Neon project (`ep-royal-meadow`, 0 candidates) in both dev and production — never
the real production database. Agents and scripts querying it falsely concluded "0 records
in production" when production had real data accessible only via `DATABASE_URL`.

**How production schema is maintained:** Startup DDL blocks in `server/routes.ts`
(`ALTER TABLE … ADD COLUMN IF NOT EXISTS`) run against `DATABASE_URL` on every deploy.
No separate sync script is needed.

`scripts/sync-schema-to-neon.sh` is now marked deprecated with an explanatory header.
`scripts/db-preflight.ts` retains only `dbPreflight()` for DATABASE_URL checks.
`server/index.ts` startup log was cleaned of the NEON guard block.

## The only reliable production verification rule

**Hit the live API directly.** Database queries from dev never reach the production
`DATABASE_URL` (only accessible inside the production container). API calls to
`https://connect.onspotglobal.com` are the only way to confirm production state.

**Why:** Any agent asked "what's in production?" must use the live API, not a DB query.
This rule closes the 5 false-conclusion incidents permanently.

**How to apply:** Before writing any conclusion about production data, ask:
"Did I get this from a real HTTP request to connect.onspotglobal.com?"
If not, the conclusion is unverified.
