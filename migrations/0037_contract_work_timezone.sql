-- Work display/grouping timezone is distinct from the billing period timezone.
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS work_timezone text;

-- Freeze the existing, valid grouping zone for engagements with recorded work.
-- Raw instants and immutable approved revision snapshots are not modified.
UPDATE hiring_contracts hc
SET work_timezone = j.time_zone
FROM job_submissions js
JOIN jobs j ON j.id = js.job_id
WHERE hc.submission_id = js.id AND hc.work_timezone IS NULL
  AND (j.time_zone = 'UTC' OR j.time_zone ~ '^[A-Za-z_+-]+(/[A-Za-z0-9_+-]+)+$')
  AND EXISTS (SELECT 1 FROM pg_timezone_names tz WHERE tz.name = j.time_zone)
  AND EXISTS (SELECT 1 FROM clock_sessions cs WHERE cs.hiring_contract_id = hc.id);
