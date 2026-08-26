-- Migration 0013: admin_interviewers
-- Self-service interviewer configuration table.
-- Replaces the ONSPOT_INTERVIEWERS_JSON Replit Secret for managing
-- interviewer records from the Admin dashboard.

CREATE TABLE IF NOT EXISTS admin_interviewers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  title          TEXT        NOT NULL DEFAULT '',
  calendar_email TEXT        NOT NULL DEFAULT '',
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_interviewers_sort_order
  ON admin_interviewers (sort_order);
