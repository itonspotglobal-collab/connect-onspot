-- Remove the pre-OnSpot freelance marketplace schema.
--
-- This migration is intentionally fail-closed: legacy rows must be migrated
-- or removed explicitly before these tables can be dropped.
DO $$
DECLARE
  legacy_table text;
  row_count bigint;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY[
    'contracts',
    'milestones',
    'payments',
    'proposals',
    'disputes',
    'time_entries'
  ] LOOP
    IF to_regclass(format('public.%I', legacy_table)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', legacy_table)
        INTO row_count;
      IF row_count > 0 THEN
        RAISE EXCEPTION
          'Cannot remove legacy table %. It contains % row(s); migrate or remove the data first.',
          legacy_table,
          row_count;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Drop the obsolete foreign-key constraints before removing their columns.
-- IF EXISTS makes each drop idempotent so the migration is safe to retry
-- regardless of whether a previous publish attempt partially applied it or
-- whether the constraint was never present in this environment.
ALTER TABLE IF EXISTS message_threads
  DROP CONSTRAINT IF EXISTS message_threads_contract_id_contracts_id_fk;
ALTER TABLE IF EXISTS reviews
  DROP CONSTRAINT IF EXISTS reviews_contract_id_contracts_id_fk;

-- These nullable associations belonged only to the removed contract model.
ALTER TABLE IF EXISTS message_threads DROP COLUMN IF EXISTS contract_id;
ALTER TABLE IF EXISTS reviews DROP COLUMN IF EXISTS contract_id;

-- Drop dependents before their referenced legacy tables.
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS disputes;
DROP TABLE IF EXISTS time_entries;
DROP TABLE IF EXISTS milestones;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS proposals;
