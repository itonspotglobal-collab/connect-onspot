#!/usr/bin/env bash
# sync-schema-to-neon.sh
#
# Pushes ADDITIVE schema changes (missing tables, columns, indexes) from the
# local dev DB (DATABASE_URL) to the production Neon DB (NEON_DATABASE_URL).
#
# Run this BEFORE every deployment that includes schema changes:
#   bash scripts/sync-schema-to-neon.sh          # dry run — prints the diff SQL
#   bash scripts/sync-schema-to-neon.sh --apply  # applies the diff to Neon
#
# What it does:
#   1. Diffs public-schema tables, columns, and indexes between dev and Neon.
#   2. Missing tables  → pg_dump --schema-only from dev, applied to Neon.
#   3. Missing columns → ALTER TABLE ... ADD COLUMN IF NOT EXISTS with the
#      exact type / default / NOT NULL from the dev catalog.
#   4. Missing indexes → CREATE [UNIQUE] INDEX IF NOT EXISTS from pg_indexes.
#
# Safety:
#   - Purely additive. Never drops or alters existing columns/tables on Neon.
#   - Refuses to run if either URL is missing, or if DATABASE_URL looks like
#     it points at Neon (guard against the two-DB mixup — see
#     .agents/memory/db-two-databases.md).
#   - Each phase runs in its own transaction with ON_ERROR_STOP.
#     (Tables must run separately: pg_dump output clears search_path.)
set -euo pipefail

[ -n "${DATABASE_URL:-}" ]      || { echo "DATABASE_URL not set (local dev DB)"; exit 1; }
[ -n "${NEON_DATABASE_URL:-}" ] || { echo "NEON_DATABASE_URL not set (prod Neon DB)"; exit 1; }
case "$DATABASE_URL" in
  *neon.tech*) echo "REFUSING: DATABASE_URL points at Neon — it must be the LOCAL dev DB."; exit 1;;
esac
case "$NEON_DATABASE_URL" in
  *neon.tech*) ;;
  *) echo "REFUSING: NEON_DATABASE_URL does not look like a Neon host."; exit 1;;
esac

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

QT="SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1"
QC="SELECT table_name||'.'||column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY 1"
QI="SELECT indexname||' :: '||indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1"

psql "$DATABASE_URL"      -Atc "$QT" | sort > dev_tables.txt
psql "$NEON_DATABASE_URL" -Atc "$QT" | sort > neon_tables.txt
psql "$DATABASE_URL"      -Atc "$QC" | sort > dev_cols.txt
psql "$NEON_DATABASE_URL" -Atc "$QC" | sort > neon_cols.txt
psql "$DATABASE_URL"      -Atc "$QI" | sort > dev_idx.txt
psql "$NEON_DATABASE_URL" -Atc "$QI" | sort > neon_idx.txt

comm -23 dev_tables.txt neon_tables.txt > missing_tables.txt

# 1. Missing tables (schema-only dump from dev)
: > missing_tables.sql
if [ -s missing_tables.txt ]; then
  DUMPT=$(sed 's/^/-t /' missing_tables.txt | tr '\n' ' ')
  # shellcheck disable=SC2086
  pg_dump --schema-only --no-owner --no-privileges $DUMPT "$DATABASE_URL" > missing_tables.sql
fi

# 2. Missing columns in tables that exist on BOTH sides
if [ -s missing_tables.txt ]; then
  MTFILTER=$(sed 's/^/^/;s/$/\\./' missing_tables.txt)
else
  MTFILTER='^$THISMATCHESNOTHING'
fi
comm -23 dev_cols.txt neon_cols.txt | grep -v -f <(echo "$MTFILTER") > missing_cols.txt || true
: > missing_columns.sql
if [ -s missing_cols.txt ]; then
  PAIRS=$(awk -F. '{printf "(%s%s%s,%s%s%s),", "'\''",$1,"'\''","'\''",$2,"'\''"}' missing_cols.txt | sed 's/,$//')
  psql "$DATABASE_URL" -Atc "
    SELECT 'ALTER TABLE public.'||quote_ident(c.table_name)||' ADD COLUMN IF NOT EXISTS '||quote_ident(c.column_name)||' '||
      format_type(a.atttypid,a.atttypmod) ||
      COALESCE(' DEFAULT '||c.column_default,'') ||
      CASE WHEN c.is_nullable='NO' THEN ' NOT NULL' ELSE '' END || ';'
    FROM information_schema.columns c
    JOIN pg_class cl ON cl.relname=c.table_name AND cl.relnamespace='public'::regnamespace
    JOIN pg_attribute a ON a.attrelid=cl.oid AND a.attname=c.column_name
    WHERE c.table_schema='public' AND (c.table_name,c.column_name) IN ($PAIRS)
    ORDER BY c.table_name, c.column_name" > missing_columns.sql
fi

# 3. Missing indexes on shared tables (indexes on new tables ship in the dump)
comm -23 dev_idx.txt neon_idx.txt | grep -v -f <(echo "$MTFILTER" | sed 's/\^/ ON public\\./;s/\\\.$/ /') \
  | sed 's/^[^:]*:: //;s/CREATE INDEX/CREATE INDEX IF NOT EXISTS/;s/CREATE UNIQUE INDEX/CREATE UNIQUE INDEX IF NOT EXISTS/;s/$/;/' \
  > missing_indexes.sql || true

# Guaranteed tables — applied regardless of pg_dump diff (idempotent DDL)
# Add any table here that is created by a startup migration block in routes.ts
# and must exist on Neon for production features to work correctly.
cat > guaranteed_tables.sql << 'GUARANTEED_SQL'
CREATE TABLE IF NOT EXISTS search_query_frequency (
  normalized_query text PRIMARY KEY,
  count            integer NOT NULL DEFAULT 1,
  last_searched_at timestamptz NOT NULL DEFAULT NOW()
);
GUARANTEED_SQL

echo "── Diff summary ──────────────────────────────────"
echo "Missing tables : $(wc -l < missing_tables.txt)"
echo "Missing columns: $( [ -f missing_cols.txt ] && wc -l < missing_cols.txt || echo 0)"
echo "Missing indexes: $(wc -l < missing_indexes.sql)"
echo "Guaranteed DDL : guaranteed_tables.sql (search_query_frequency)"

if ! $APPLY; then
  echo ""
  echo "DRY RUN — SQL that would be applied to Neon:"
  echo "-- tables --";  cat missing_tables.sql
  echo "-- columns --"; cat missing_columns.sql
  echo "-- indexes --"; cat missing_indexes.sql
  echo "-- guaranteed --"; cat guaranteed_tables.sql
  echo ""
  echo "Re-run with --apply to execute against NEON_DATABASE_URL."
  exit 0
fi

# Apply. Tables FIRST and in their own psql run — the pg_dump preamble clears
# search_path, which would break the unqualified statements that follow.
if [ -s missing_tables.sql ]; then
  psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f missing_tables.sql > /dev/null
  echo "✅ Tables applied"
fi
if [ -s missing_columns.sql ] || [ -s missing_indexes.sql ]; then
  cat missing_columns.sql missing_indexes.sql | psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -1 > /dev/null
  echo "✅ Columns + indexes applied"
fi

# Apply guaranteed tables (idempotent — safe to run every time)
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f guaranteed_tables.sql > /dev/null
echo "✅ Guaranteed tables applied (search_query_frequency)"

# Verify: re-diff should be empty
psql "$DATABASE_URL" -Atc "$QC" | sort > d2.txt
psql "$NEON_DATABASE_URL" -Atc "$QC" | sort > n2.txt
REMAIN=$(comm -23 d2.txt n2.txt | wc -l)
if [ "$REMAIN" -eq 0 ]; then
  echo "✅ Verified: Neon schema now contains every dev table/column."
else
  echo "⚠️  $REMAIN column(s) still missing on Neon:"
  comm -23 d2.txt n2.txt
  exit 1
fi
