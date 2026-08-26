-- Persist the last JobFormPage step for unfinished postings.
-- The existing jobs row remains the source of truth; this is only draft metadata.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS draft_step integer;