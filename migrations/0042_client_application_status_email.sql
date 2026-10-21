-- Extend the existing applicant email ledger; preserve all historical records.
-- NULL source versions identify legacy/manual emails, which keep their behavior.
ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS status_source_version text;
ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS status_completed_at timestamp;
ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS delivery_attempts jsonb NOT NULL DEFAULT '[]'::jsonb;
