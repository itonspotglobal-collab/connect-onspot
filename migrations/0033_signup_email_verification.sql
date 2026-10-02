-- Additive. Run the read-only signup preflight before applying to an approved
-- staging dataset. Never infer inbox proof from historical account existence.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_required boolean;
UPDATE users SET email_verification_required = NOT (
  NULLIF(password_hash, '') IS NOT NULL OR NULLIF(trim(replit_id), '') IS NOT NULL
  OR id LIKE 'google_%' OR id LIKE 'linkedin_%'
) WHERE email_verification_required IS NULL;
ALTER TABLE users ALTER COLUMN email_verification_required SET DEFAULT true;
ALTER TABLE users ALTER COLUMN email_verification_required SET NOT NULL;

-- These fields apply ONLY when user_id IS NULL. Linked Talent always consults
-- users. They are not copies of the user's mutable ownership state.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_verified_email text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_verification_required boolean;
UPDATE candidates SET email_verification_required =
  (user_id IS NOT NULL OR NULLIF(password_hash, '') IS NULL)
  WHERE email_verification_required IS NULL;
ALTER TABLE candidates ALTER COLUMN email_verification_required SET DEFAULT true;
ALTER TABLE candidates ALTER COLUMN email_verification_required SET NOT NULL;

CREATE TABLE IF NOT EXISTS pending_registrations (
  id uuid PRIMARY KEY,
  capability_hash text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('client', 'talent')),
  purpose text NOT NULL CHECK (purpose IN ('signup', 'talent_claim', 'provider')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  username text NOT NULL,
  company text,
  password_hash text,
  context jsonb NOT NULL DEFAULT '{}',
  code_hmac text NOT NULL,
  generation integer NOT NULL DEFAULT 1,
  incorrect_attempts integer NOT NULL DEFAULT 0 CHECK (incorrect_attempts BETWEEN 0 AND 5),
  code_expires_at timestamptz NOT NULL,
  resend_available_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  delivery_status text NOT NULL CHECK (delivery_status IN ('sending', 'accepted', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  superseded_at timestamptz
);
CREATE INDEX IF NOT EXISTS pending_registrations_capability_idx
  ON pending_registrations(capability_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS pending_registrations_expiry_idx ON pending_registrations(expires_at);
CREATE INDEX IF NOT EXISTS pending_registrations_email_idx ON pending_registrations(email);
CREATE TABLE IF NOT EXISTS signup_verification_limits (
  bucket text PRIMARY KEY,
  used integer NOT NULL DEFAULT 0,
  resets_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_provider_links (
  provider text NOT NULL CHECK (provider IN ('google', 'linkedin', 'replit')),
  subject text NOT NULL,
  user_id varchar NOT NULL REFERENCES users(id),
  PRIMARY KEY (provider, subject)
);