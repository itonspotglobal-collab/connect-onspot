-- Additive cutover. Never rewrite existing offers, agreements, debts or statuses.
ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS invitation_pending boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS contractor_onboarding_cohorts (
  submission_id text PRIMARY KEY REFERENCES job_submissions(id),
  workflow_version integer NOT NULL CHECK (workflow_version IN (1,2)),
  captured_status text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO contractor_onboarding_cohorts(submission_id,workflow_version,captured_status)
SELECT js.id,CASE WHEN js.status IN ('offer_accepted','contract_sent','contract_signed','hired')
 OR EXISTS(SELECT 1 FROM offers o WHERE o.submission_id=js.id AND o.status IN ('accepted','offer_accepted'))
 OR EXISTS(SELECT 1 FROM hiring_contracts hc WHERE hc.submission_id=js.id)
 THEN 1 ELSE 2 END,js.status FROM job_submissions js
ON CONFLICT DO NOTHING;

ALTER TABLE security_deposits ALTER COLUMN hiring_contract_id DROP NOT NULL;
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES offers(id);
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS submission_id text REFERENCES job_submissions(id);
CREATE UNIQUE INDEX IF NOT EXISTS security_deposits_accepted_offer_unique
 ON security_deposits(offer_id) WHERE offer_id IS NOT NULL;
-- The original enum/check is retained and extended, not replaced with a second ledger.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint
  WHERE conrelid='security_deposits'::regclass AND contype='c'
  AND pg_get_constraintdef(oid) LIKE '%status%'
 LOOP EXECUTE format('ALTER TABLE security_deposits DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE security_deposits ADD CONSTRAINT security_deposits_status_check
 CHECK (status IN ('pending','held','drawn','replenishment_pending','suspended','applied','forfeited','returned','void'));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='security_deposits'::regclass AND conname='security_deposits_source_check') THEN
 ALTER TABLE security_deposits ADD CONSTRAINT security_deposits_source_check
  CHECK (hiring_contract_id IS NOT NULL OR (offer_id IS NOT NULL AND submission_id IS NOT NULL)) NOT VALID;
 END IF;
END $$;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS invitation_terms_accepted_at timestamptz;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS invitation_terms_version text;
UPDATE client_profiles SET invitation_terms_accepted_at=msa_accepted_at,invitation_terms_version=msa_version
 WHERE invitation_terms_accepted_at IS NULL AND msa_accepted_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM pg_tables WHERE tablename='client_msa_signatures');

CREATE TABLE IF NOT EXISTS msa_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version text NOT NULL UNIQUE,
 object_key text NOT NULL, filename text NOT NULL, file_size integer NOT NULL,
 sha256 text NOT NULL CHECK(length(sha256)=64),
 effective_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT false,
 uploaded_by text NOT NULL REFERENCES users(id), activated_by text REFERENCES users(id),
 activation_reason text, activated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS msa_documents_one_active ON msa_documents(active) WHERE active;
CREATE TABLE IF NOT EXISTS client_msa_requests (
 client_id text NOT NULL REFERENCES users(id), msa_document_id uuid NOT NULL REFERENCES msa_documents(id),
 submission_id text NOT NULL REFERENCES job_submissions(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(client_id,msa_document_id)
);
CREATE TABLE IF NOT EXISTS client_msa_signatures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id text NOT NULL REFERENCES users(id),
 msa_version text NOT NULL REFERENCES msa_documents(version), document_id uuid NOT NULL REFERENCES msa_documents(id),
 document_sha256 text NOT NULL, signed_at timestamptz NOT NULL DEFAULT now(),
 signer_name text NOT NULL, signer_email text NOT NULL, ip_address text NOT NULL, user_agent text NOT NULL,
 consent_text text NOT NULL, UNIQUE(client_id,msa_version)
);
CREATE TABLE IF NOT EXISTS client_msa_reads (
 client_id text NOT NULL REFERENCES users(id), document_id uuid NOT NULL REFERENCES msa_documents(id),
 document_sha256 text NOT NULL, read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(client_id,document_id)
);
CREATE OR REPLACE FUNCTION void_accepted_offer_deposit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('void','voided','cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE security_deposits SET status='void' WHERE offer_id=NEW.id AND status IN ('pending','held');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS void_accepted_offer_deposit ON offers;
CREATE TRIGGER void_accepted_offer_deposit AFTER UPDATE OF status ON offers
 FOR EACH ROW EXECUTE FUNCTION void_accepted_offer_deposit();
