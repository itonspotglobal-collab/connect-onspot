-- Add more_about_me column to candidates table
-- This stores optional long-form personal/professional information for the Talent profile.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS more_about_me TEXT;
