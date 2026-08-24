-- Legacy freelance cleanup is intentionally deferred.
--
-- The current publish is additive-only for the new billing engine. Preserve
-- the legacy tables and their contract relationships in both development and
-- production until a separate, reviewed data-migration plan is approved.
-- This migration ID remains a no-op for compatibility with environments where
-- it was already recorded in app_schema_migrations.
DO $$
BEGIN
  RAISE NOTICE 'Legacy freelance schema cleanup deferred; no legacy data or schema was modified.';
END $$;
