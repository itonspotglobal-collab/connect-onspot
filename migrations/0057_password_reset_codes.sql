CREATE TABLE IF NOT EXISTS password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL,
  code_hmac text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_codes_role_check CHECK (role IN ('client','talent')),
  CONSTRAINT password_reset_codes_attempts_check CHECK (attempts BETWEEN 0 AND 5),
  CONSTRAINT password_reset_codes_email_check CHECK (email = lower(btrim(email))),
  CONSTRAINT password_reset_codes_hmac_check CHECK (length(code_hmac) = 64)
);
CREATE INDEX IF NOT EXISTS password_reset_codes_email_created_idx
  ON password_reset_codes (email, created_at DESC);
