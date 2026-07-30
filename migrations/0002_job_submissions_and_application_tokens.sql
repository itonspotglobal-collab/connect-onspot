-- Migration: Job Submissions & Application Tokens
-- Adds the tables and columns required for the built-in job-apply → signup → portal flow.
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS guards).

-- ── 1. New columns on jobs ────────────────────────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS apply_link          text,
  ADD COLUMN IF NOT EXISTS application_method  text DEFAULT 'external_link',
  ADD COLUMN IF NOT EXISTS approval_status     text NOT NULL DEFAULT 'pending';

-- ── 2. job_submissions ────────────────────────────────────────────────────────
-- Stores one row per built-in application-form submission.

CREATE TABLE IF NOT EXISTS job_submissions (
  id                  varchar      PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              varchar      NOT NULL REFERENCES jobs(id),
  client_id           varchar      REFERENCES users(id),
  first_name          text,
  last_name           text,
  applicant_name      text,          -- kept for backward-compat with legacy rows
  email               text         NOT NULL,
  phone               text,
  location            text,
  resume_url          text,
  resume_file_name    text,
  portfolio_url       text,
  cover_letter        text,
  expected_salary     text,
  availability        text,
  status              text         NOT NULL DEFAULT 'new',   -- new | reviewed | shortlisted | rejected | hired
  talent_id           varchar      REFERENCES users(id),
  registration_status text         NOT NULL DEFAULT 'pending_account', -- pending_account | registered
  submitted_at        timestamp    DEFAULT NOW(),
  created_at          timestamp    DEFAULT NOW(),
  updated_at          timestamp    DEFAULT NOW()
);

-- ── 3. application_tokens ─────────────────────────────────────────────────────
-- Short-lived (60 min) token issued after apply; consumed on signup to link
-- the new account to the submission.

CREATE TABLE IF NOT EXISTS application_tokens (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id varchar      NOT NULL REFERENCES job_submissions(id) ON DELETE CASCADE,
  token_hash    varchar(64)  NOT NULL UNIQUE,  -- SHA-256 of the raw bearer token
  expires_at    timestamp    NOT NULL,
  used_at       timestamp,                     -- set when the token is consumed
  created_at    timestamp    NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_job_submissions_job_id     ON job_submissions (job_id);
CREATE INDEX IF NOT EXISTS idx_job_submissions_email      ON job_submissions (lower(email));
CREATE INDEX IF NOT EXISTS idx_job_submissions_talent_id  ON job_submissions (talent_id);
CREATE INDEX IF NOT EXISTS idx_application_tokens_hash    ON application_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_approval_status       ON jobs (approval_status);
CREATE INDEX IF NOT EXISTS idx_jobs_application_method    ON jobs (application_method);

-- ── 5. Backfill: open jobs with no external apply link → built_in_form ────────
-- Idempotent: only updates rows that have not already been explicitly set.

UPDATE jobs
   SET application_method = 'built_in_form',
       apply_link         = NULL,
       updated_at         = NOW()
 WHERE status = 'open'
   AND (
         application_method IS NULL
      OR application_method = ''
      OR (
           application_method != 'external_link'
           AND application_method != 'built_in_form'
         )
      OR (
           apply_link IS NULL OR apply_link = ''
           OR apply_link ILIKE '%leadconnectorhq.com%'
         )
   )
   AND NOT (
         application_method = 'external_link'
     AND apply_link IS NOT NULL
     AND apply_link != ''
     AND apply_link NOT ILIKE '%leadconnectorhq.com%'
   );
