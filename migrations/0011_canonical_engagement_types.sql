-- Migration 0011: Rename all legacy engagement_type values to the canonical
-- Lite / Standard vocabulary and rebuild the jobs_engagement_type_check constraint.
--
-- Background: migration 0005 introduced Half-Day / Full-Time as the canonical
-- labels. In 2026-08, both were renamed (Half-Day → Lite, Full-Time → Standard)
-- to match flat-rate billing language. The startup normalization code in
-- server/routes.ts failed to apply this in production because the old constraint
-- blocked UPDATE statements that tried to write 'Standard' or 'Lite' before the
-- constraint was dropped.
--
-- MAPPING (repository-approved — confirmed from engagement-type-rename.md):
--   Full-Time  →  Standard  (76 rows in production)
--   Half-Day   →  Lite      ( 1 row  in production)
--   full-time  →  Standard  (lowercase legacy form)
--   part-time  →  Lite      (lowercase legacy form)
--   NULL       →  stays NULL (intentional: unreviewed legacy rows)
--
-- Any engagement_type value NOT in the mapping is an unknown legacy value.
-- The migration refuses to continue and raises a human-readable error so the
-- value can be reviewed before re-running. This protects against silent data
-- corruption.

-- Step 1: Drop the stale constraint FIRST so the normalizing UPDATEs are not
-- blocked. The table is unguarded momentarily inside this transaction; a ROLLBACK
-- on any subsequent failure (managed by the migration runner) restores the
-- original state atomically.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_engagement_type_check;

-- Step 2: Normalize repository-approved legacy values.
UPDATE jobs SET engagement_type = 'Standard', updated_at = NOW()
 WHERE engagement_type = 'Full-Time';

UPDATE jobs SET engagement_type = 'Lite', updated_at = NOW()
 WHERE engagement_type = 'Half-Day';

UPDATE jobs SET engagement_type = 'Standard', updated_at = NOW()
 WHERE engagement_type = 'full-time';

UPDATE jobs SET engagement_type = 'Lite', updated_at = NOW()
 WHERE engagement_type = 'part-time';

-- Step 3: Safety check — any remaining non-canonical, non-NULL value means an
-- unknown legacy label that has not been mapped. Raise an error so the
-- transaction rolls back rather than silently writing a bad constraint.
DO $$
DECLARE
  violating_count INT;
  violating_sample TEXT;
BEGIN
  SELECT COUNT(*),
         string_agg(id || ':' || engagement_type, ', ' ORDER BY id)
    INTO violating_count, violating_sample
    FROM jobs
   WHERE engagement_type IS NOT NULL
     AND engagement_type NOT IN ('Lite', 'Standard');

  IF violating_count > 0 THEN
    RAISE EXCEPTION
      'Migration 0011 aborted: % row(s) have unrecognized engagement_type values '
      'that are not in the approved mapping (sample: %). '
      'Review and reclassify them manually, then re-run this migration.',
      violating_count, violating_sample;
  END IF;
END $$;

-- Step 4: Add the new constraint (NULL-safe: legacy draft rows may have NULL).
ALTER TABLE jobs
  ADD CONSTRAINT jobs_engagement_type_check
  CHECK (engagement_type IS NULL OR engagement_type IN ('Lite', 'Standard'));
