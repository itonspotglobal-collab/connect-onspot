-- Migration 0005: Rename contract_type → engagement_type on jobs table
-- and migrate all existing values to the canonical Half-Day / Full-Time vocabulary.
--
-- MAPPING LOG (rows that received a default — review and correct if wrong):
--   full-time / Full-time (8 rows) → Full-Time  [straightforward casing fix]
--   fixed     (3 rows)             → Full-Time  [defaulted: Customer Service Representative ×2, Senior Virtual Assistant]
--   part-time (2 rows)             → Half-Day   [defaulted: Test, Customer Service Representative]
--   hourly    (2 rows)             → handled individually:
--     test-job-1        ("Test Job")          → DELETED (seed data, no client, no rates)
--     59ba5489-...      ("Virtual Assistant") → status=draft, engagement_type=NULL (needs manual flat-rate review)

-- Step 1: Add engagement_type column (nullable — VA row intentionally stays NULL)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS engagement_type text;

-- Step 2: Migrate values
UPDATE jobs SET engagement_type = 'Full-Time' WHERE lower(contract_type) = 'full-time';
UPDATE jobs SET engagement_type = 'Full-Time' WHERE contract_type = 'fixed';
UPDATE jobs SET engagement_type = 'Half-Day'  WHERE contract_type = 'part-time';
-- "hourly" rows handled individually below; leave engagement_type NULL for them for now

-- Step 3: Delete test seed row
DELETE FROM jobs WHERE id = 'test-job-1';

-- Step 4: Quarantine the remaining hourly row — draft, engagement_type NULL, rates preserved
UPDATE jobs SET status = 'draft'
WHERE id = '59ba5489-9f91-4f4b-b901-e48e7b3c8965';
-- engagement_type intentionally left NULL; hourly_rate_min/max left intact for reference

-- Step 5: Drop the old contract_type column
ALTER TABLE jobs DROP COLUMN IF EXISTS contract_type;

-- Step 6: Migrate candidates.preferences.hourlyRate → rateAmount
-- (rateCurrency stays; rateEngagementType left for talent to fill in via the updated UI)
UPDATE candidates
SET preferences = (preferences - 'hourlyRate')
    || jsonb_build_object('rateAmount', preferences->>'hourlyRate')
WHERE preferences ? 'hourlyRate'
  AND (preferences->>'hourlyRate') IS NOT NULL
  AND (preferences->>'hourlyRate') <> '';
