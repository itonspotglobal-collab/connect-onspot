-- Optional signature evidence; historical typed signatures are unchanged.
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS signer_title text;
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS signature_png text;
ALTER TABLE client_msa_signatures ADD COLUMN IF NOT EXISTS signer_title text;
ALTER TABLE client_msa_signatures ADD COLUMN IF NOT EXISTS signature_png text;
ALTER TABLE client_msa_countersignatures ADD COLUMN IF NOT EXISTS signer_title text;
ALTER TABLE client_msa_countersignatures ADD COLUMN IF NOT EXISTS signature_png text;
CREATE TABLE IF NOT EXISTS client_msa_executed_copies (
  document_id uuid NOT NULL REFERENCES msa_documents(id),
  client_id text NOT NULL REFERENCES users(id),
  client_signature_id uuid NOT NULL REFERENCES client_msa_signatures(id),
  onspot_signature_id uuid NOT NULL REFERENCES client_msa_countersignatures(id),
  object_key text NOT NULL,
  sha256 text NOT NULL CHECK(length(sha256)=64),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(document_id,client_id)
);
