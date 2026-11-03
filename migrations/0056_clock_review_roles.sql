-- Additive only: existing append-only reviews remain untouched.
ALTER TABLE clock_exception_reviews ADD COLUMN IF NOT EXISTS reviewer_role text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'clock_exception_reviews'::regclass
      AND conname = 'clock_exception_reviews_reviewer_role_check') THEN
    ALTER TABLE clock_exception_reviews ADD CONSTRAINT clock_exception_reviews_reviewer_role_check
      CHECK (reviewer_role IN ('client', 'admin'));
  END IF;
END $$;
