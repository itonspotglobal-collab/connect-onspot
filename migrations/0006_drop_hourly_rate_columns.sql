-- Drop unused hourly rate columns from jobs table.
-- The match scorer no longer reads these; engagement_type + candidate
-- preferences.rateAmount are used instead.

ALTER TABLE jobs DROP COLUMN IF EXISTS hourly_rate_min;
ALTER TABLE jobs DROP COLUMN IF EXISTS hourly_rate_max;
