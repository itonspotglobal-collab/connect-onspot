-- Preserve the agreed display timezone separately from the instant.
-- Existing timestamp-without-time-zone values were written from ISO strings
-- by the application, so interpret those legacy wall-clock values as UTC.

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS confirmed_time_zone text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = 'interviews'
       AND column_name = 'confirmed_time'
       AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE interviews
      ALTER COLUMN confirmed_time TYPE timestamptz
      USING CASE
        WHEN confirmed_time IS NULL THEN NULL
        ELSE confirmed_time AT TIME ZONE 'UTC'
      END;
  END IF;
END $$;

UPDATE interviews
   SET confirmed_time_zone = 'UTC'
 WHERE confirmed_time IS NOT NULL
   AND confirmed_time_zone IS NULL;

ALTER TABLE interview_proposals
  ADD COLUMN IF NOT EXISTS selected_time_zone text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = 'interview_proposals'
       AND column_name = 'selected_time'
       AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE interview_proposals
      ALTER COLUMN selected_time TYPE timestamptz
      USING CASE
        WHEN selected_time IS NULL THEN NULL
        ELSE selected_time AT TIME ZONE 'UTC'
      END;
  END IF;
END $$;

UPDATE interview_proposals
   SET selected_time_zone = 'UTC'
 WHERE selected_time IS NOT NULL
   AND selected_time_zone IS NULL;