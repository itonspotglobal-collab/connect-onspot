ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS party_type text NOT NULL DEFAULT 'onspot';
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS organization_id varchar REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS prepared_by varchar REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS talent_message text;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS document_managed boolean NOT NULL DEFAULT false;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='hiring_contracts'::regclass AND conname='hiring_contract_party_type_check') THEN
  ALTER TABLE hiring_contracts ADD CONSTRAINT hiring_contract_party_type_check CHECK (party_type IN ('onspot','client','organization'));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS contract_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
 object_key text NOT NULL UNIQUE, original_filename text NOT NULL, mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 file_size integer NOT NULL CHECK(file_size>0 AND file_size<=10485760),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 version integer NOT NULL CHECK(version>0), status text NOT NULL DEFAULT 'draft'
 CHECK(status IN ('draft','sent_for_signature','talent_signed','countersigned','executed','voided','declined','superseded')),
 uploaded_by varchar NOT NULL REFERENCES users(id), uploaded_at timestamptz NOT NULL DEFAULT NOW(),
 sent_at timestamptz, executed_at timestamptz, executed_object_key text, executed_sha256 text,
 UNIQUE(hiring_contract_id,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_documents_current ON contract_documents(hiring_contract_id)
 WHERE status NOT IN ('superseded','voided','declined');
CREATE TABLE IF NOT EXISTS contract_document_reviews (
 document_id uuid NOT NULL REFERENCES contract_documents(id), user_id varchar NOT NULL REFERENCES users(id),
 sha256 text NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(document_id,user_id)
);
CREATE TABLE IF NOT EXISTS contract_signatures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES contract_documents(id),
 signer_user_id varchar NOT NULL REFERENCES users(id), signer_role text NOT NULL
 CHECK(signer_role IN ('talent','client','organization','onspot')),
 legal_name text NOT NULL CHECK(length(btrim(legal_name)) BETWEEN 3 AND 200),
 signature_method text NOT NULL DEFAULT 'typed_name_consent', signed_at timestamptz NOT NULL DEFAULT NOW(),
 document_version integer NOT NULL, document_sha256 text NOT NULL,
 organization_id varchar REFERENCES organizations(id), authority_context text NOT NULL,
 audit_metadata jsonb NOT NULL DEFAULT '{}', UNIQUE(document_id,signer_role)
);
CREATE TABLE IF NOT EXISTS contract_document_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id),
 document_id uuid REFERENCES contract_documents(id), actor_user_id varchar NOT NULL REFERENCES users(id),
 action text NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS contract_delivery_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES contract_documents(id),
 event_type text NOT NULL, recipient_user_id varchar NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT NOW(),
 UNIQUE(document_id,event_type,recipient_user_id)
);
