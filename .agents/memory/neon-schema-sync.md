---
name: Neon prod schema sync
description: How dev→Neon schema drift is closed; the sync script, its gotchas, and why startup-block migrations alone are insufficient for prod.
---

## The rule

`scripts/sync-schema-to-neon.sh` is the canonical way to push schema changes to the Neon production DB. Run it (dry run first, then `--apply`) before any deployment that includes schema changes. It diffs dev (`DATABASE_URL`) vs Neon (`NEON_DATABASE_URL`) via information_schema/pg_indexes and applies only additive DDL (missing tables via pg_dump, missing columns with exact type/default/NOT NULL, missing indexes).

**Why:** The startup migration block in `server/index.ts` only runs where the server runs — dev. Neon drifted 6 months (~8 tables, 62 columns) and would have crashed the client-search launch on the first scaffold INSERT. Ad-hoc ALTERs against Neon are error-prone; the diff-based script makes drift visible and closes it idempotently.

**How to apply:** `bash scripts/sync-schema-to-neon.sh` → review printed SQL → rerun with `--apply`. It verifies the diff is empty afterwards and exits non-zero if not.

## Gotchas learned

- pg_dump's preamble runs `set_config('search_path','',false)` — never concatenate unqualified DDL after a pg_dump file in the same psql `-1` session; run the dump in its own transaction, and schema-qualify generated ALTERs.
- A failed multi-file `psql -1` run rolls back EVERYTHING including the earlier files — re-verify with a fresh diff, don't assume partial application.
- The script refuses to run if `DATABASE_URL` looks like Neon (two-DB mixup guard, see db-two-databases.md).
- It is additive-only: renames/drops/type changes on Neon still need manual SQL.
