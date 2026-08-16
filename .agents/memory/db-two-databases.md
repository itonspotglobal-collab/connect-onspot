---
name: Two-database / NEON setup (corrected)
description: Which database each environment actually uses; NEON_DATABASE_URL is NOT the production DB.
---

# Database environment map (confirmed from production startup logs)

| Environment | DATABASE_URL | NEON_DATABASE_URL |
|---|---|---|
| Dev (local) | `helium/heliumdb` (local Postgres) | `ep-royal-meadow-aexmdrj7…/neondb` (staging Neon, **0 candidates**) |
| Production | `ep-empty-wildflower-ae9hsx05…/neondb` (real prod Neon, **25 candidates**) | `ep-royal-meadow-aexmdrj7…/neondb` (same staging Neon, **0 candidates**) |

## Key facts

- **NEON_DATABASE_URL is NOT the production database in either environment.** It points to a staging/separate Neon project (`ep-royal-meadow`) that is empty in both dev and prod.
- **The real production database is `DATABASE_URL` in the production environment** (`ep-empty-wildflower`). Scripts and agents querying NEON_DATABASE_URL to check production state are querying the wrong database.
- All five prior false-conclusion incidents (hourly_rate columns, test.client password reset, inferCategory production-impact, scaffold job description, "0 candidates in Neon") traced to querying NEON_DATABASE_URL instead of the actual production DATABASE_URL.
- The only reliable way to verify production state from outside the production environment is to **hit the live production API directly** (no auth token, real endpoint), not a database query via NEON_DATABASE_URL.

## NEON mismatch guard

`server/index.ts` startup now prints both connections:
```
🔗 DB: <DATABASE_URL host> [NEON CLOUD | LOCAL DEV]
⚠️  NEON DB: ep-royal-meadow-aexmdrj7… [NEON_DB_LABEL="unset"] — NOT confirmed as production.
```

`scripts/db-preflight.ts` exports `neonPreflight(strict?)` — call before any script that uses NEON_DATABASE_URL.

`NEON_DB_LABEL` env var: set to `"production"` only if NEON_DATABASE_URL actually IS the production database (currently it is not, so the warning should stay visible).

**Why:** Makes the dev/prod boundary impossible to cross silently. Any agent checking startup logs or running db-preflight before querying NEON sees immediately that it is not the production database.

**How to apply:** Before writing any conclusion about production data, always ask: "Did I get this from a live API hit to connect.onspotglobal.com, or from a database query?" Database queries via NEON_DATABASE_URL are against a staging/empty Neon and do not reflect production state.
