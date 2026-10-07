ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS responded_by varchar REFERENCES users(id);
CREATE TABLE IF NOT EXISTS offer_expiration_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid NOT NULL REFERENCES offers(id),
 actor_user_id varchar NOT NULL REFERENCES users(id), previous_expires_at timestamptz,
 new_expires_at timestamptz NOT NULL, changed_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS contract_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
 object_key text NOT NULL UNIQUE, original_filename text NOT NULL,
 file_size integer NOT NULL CHECK(file_size BETWEEN 1 AND 10485760),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 version integer NOT NULL CHECK(version>0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','frozen','removed')),
 uploaded_by varchar NOT NULL REFERENCES users(id), uploaded_at timestamptz NOT NULL DEFAULT NOW(),
 UNIQUE(hiring_contract_id,version)
);
