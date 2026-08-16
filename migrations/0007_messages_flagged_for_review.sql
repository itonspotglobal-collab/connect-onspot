-- Migration: add flagged_for_review column to messages table
-- Messages containing PII (phone numbers / emails) are stored normally but
-- marked for admin review. The flag is never surfaced to senders.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS flagged_for_review boolean NOT NULL DEFAULT false;
