-- Additive only; existing interview/proposal/offer/contract records are retained.
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_event_id text;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_managed boolean NOT NULL DEFAULT false;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_interviewer_id text;
