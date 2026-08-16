---
name: Two-database setup (local vs Neon cloud)
description: DATABASE_URL = local helium dev DB; NEON_DATABASE_URL = Neon cloud/prod DB. Scripts must always use DATABASE_URL. Guards and log lines exist to prevent silent mismatches.
---

## The rule

- `DATABASE_URL` → `helium/heliumdb` — the local dev DB the running server always connects to.
- `NEON_DATABASE_URL` → Neon cloud — production only; only reach for it when explicitly targeting prod.

Scripts (migrations, traces, admin one-offs) **must use `DATABASE_URL`**. Using `NEON_DATABASE_URL` in a script while the dev server is on `DATABASE_URL` causes silent mismatch: schema changes land in the wrong database, and traces hit different data.

## Guards in place

### 1. Server startup log
`server/index.ts` → `logDatabaseConnection()` emits:
```
🔗 DB: helium/heliumdb [LOCAL DEV]
```
(or `[NEON CLOUD]` / `[UNKNOWN]`). Visible at the very top of every `npm run dev` start. Check it before running any migration.

### 2. Script preflight module
`scripts/db-preflight.ts` → import and call at the top of any migration or admin script:

```ts
import { dbPreflight } from "../scripts/db-preflight";
await dbPreflight();           // prints target, continues
await dbPreflight("local");    // throws if not local dev
await dbPreflight("cloud");    // throws if not Neon cloud
```

Prints `[db-preflight] DATABASE_URL → helium/heliumdb [LOCAL DEV]` so the target is the first line of script output.

**Why:** This pattern caused three real problems (hourly_rate columns, test-client password reset, PII flag migration/trace) before the guards were added. Each time the script author reached for `NEON_DATABASE_URL` without realising the server uses `DATABASE_URL`. The guards make it impossible to be silently wrong.

**How to apply:** Every new migration script gets `await dbPreflight("local")` as line 2 (after the import). If a script is intentionally for prod, use `await dbPreflight("cloud")` and pass `NEON_DATABASE_URL` explicitly — never silently fall through to the wrong one.
