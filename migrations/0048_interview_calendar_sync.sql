ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_sync_status text;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_sync_error text;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='interviews'::regclass
    AND conname='interviews_calendar_sync_status_check') THEN
    ALTER TABLE interviews ADD CONSTRAINT interviews_calendar_sync_status_check
      CHECK(calendar_sync_status IN ('synced','failed','skipped'));
  END IF;
END $$;
