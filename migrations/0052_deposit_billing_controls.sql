-- Preserve all historical fee exceptions. Deposit arrangements are a separate scope.
ALTER TABLE hiring_payment_waivers ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'pre_offer'
  CHECK(scope IN ('pre_offer','deposit'));
ALTER TABLE hiring_payment_waivers ADD COLUMN IF NOT EXISTS deposit_id uuid REFERENCES security_deposits(id);
ALTER TABLE hiring_payment_waivers ADD COLUMN IF NOT EXISTS deposit_due_at timestamptz;
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS verified_by text REFERENCES users(id);
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS payment_source text;
CREATE UNIQUE INDEX IF NOT EXISTS hiring_payment_waivers_active_scope
 ON hiring_payment_waivers(submission_id,scope) WHERE revoked_at IS NULL;
DROP INDEX IF EXISTS hiring_payment_waivers_active_submission;
CREATE UNIQUE INDEX IF NOT EXISTS hiring_payment_waivers_active_deposit
 ON hiring_payment_waivers(deposit_id) WHERE scope='deposit' AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS onboarding_submission_links (
 submission_id text PRIMARY KEY REFERENCES job_submissions(id),
 canonical_submission_id text NOT NULL REFERENCES job_submissions(id),
 offer_id uuid NOT NULL REFERENCES offers(id),
 linked_by text NOT NULL REFERENCES users(id),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
 linked_at timestamptz NOT NULL DEFAULT now(),
 CHECK(submission_id<>canonical_submission_id)
);
CREATE TABLE IF NOT EXISTS external_deposit_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 deposit_id uuid NOT NULL UNIQUE REFERENCES security_deposits(id),
 amount numeric(12,2) NOT NULL CHECK(amount>0),currency text NOT NULL,
 received_at timestamptz NOT NULL,reference text NOT NULL,
 method text NOT NULL CHECK(method IN ('bank_transfer','check','cash','other')),
 verified_by text NOT NULL REFERENCES users(id),verified_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
 receipt_object_key text,receipt_content_type text,receipt_filename text
);
CREATE UNIQUE INDEX IF NOT EXISTS external_deposit_payment_reference
 ON external_deposit_payments(lower(btrim(reference)));
CREATE TABLE IF NOT EXISTS client_msa_offline_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id text NOT NULL REFERENCES users(id),document_id uuid NOT NULL REFERENCES msa_documents(id),
 document_sha256 text NOT NULL,msa_version text NOT NULL,
 object_key text NOT NULL,sha256 text NOT NULL,filename text NOT NULL,content_type text NOT NULL DEFAULT 'application/pdf',
 signer_name text NOT NULL,signer_email text NOT NULL,signed_at timestamptz NOT NULL,
 recorded_by text NOT NULL REFERENCES users(id),recorded_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
 UNIQUE(client_id,document_id)
);
