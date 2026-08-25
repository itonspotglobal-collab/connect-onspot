-- Migration 0012: persist the new shared Create / Edit Job form requirements.
-- All additions are nullable or have safe defaults so existing job postings stay
-- readable and editable without destructive backfills.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS minimum_education text,
  ADD COLUMN IF NOT EXISTS required_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requires_us_timezone_overlap boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_fluent_english boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compensation_display_type text NOT NULL DEFAULT 'range',
  ADD COLUMN IF NOT EXISTS contractor_engagement_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_compensation_display_type_check;
ALTER TABLE jobs
  ADD CONSTRAINT jobs_compensation_display_type_check
  CHECK (compensation_display_type IN ('range', 'starting_from', 'negotiable'));