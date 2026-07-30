-- Migration: add job_application_status_history table
-- Safely maps legacy 'new' -> 'submitted' so the new status model is consistent.

CREATE TABLE IF NOT EXISTS job_application_status_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id varchar   NOT NULL REFERENCES job_submissions(id) ON DELETE CASCADE,
  previous_status text,
  new_status  text        NOT NULL,
  note        text,
  changed_by  varchar     REFERENCES users(id),
  created_at  timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jash_application_id ON job_application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_jash_changed_by     ON job_application_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_jash_created_at     ON job_application_status_history(created_at);

-- Map legacy 'new' -> 'submitted' so the UI shows the correct label
UPDATE job_submissions SET status = 'submitted' WHERE status = 'new';

-- Change column default for new rows
ALTER TABLE job_submissions ALTER COLUMN status SET DEFAULT 'submitted';
