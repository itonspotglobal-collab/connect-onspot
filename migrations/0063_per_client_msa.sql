-- Companion metadata keeps shared uploaded MSAs and all existing signature FKs unchanged.
ALTER TABLE contract_drafts ADD COLUMN IF NOT EXISTS msa_submission_id text REFERENCES job_submissions(id);
ALTER TABLE contract_drafts ADD COLUMN IF NOT EXISTS rendered_msa_document_id uuid REFERENCES msa_documents(id);
CREATE TABLE IF NOT EXISTS client_msa_documents (
  document_id uuid PRIMARY KEY REFERENCES msa_documents(id),
  client_id text NOT NULL REFERENCES users(id),
  submission_id text NOT NULL REFERENCES job_submissions(id),
  draft_id uuid NOT NULL REFERENCES contract_drafts(id),
  template_id uuid NOT NULL REFERENCES contract_templates(id),
  template_version text NOT NULL,
  final_field_values jsonb NOT NULL,
  authoring_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','voided','superseded')),
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz,
  issue_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS client_msa_documents_one_issued ON client_msa_documents(client_id) WHERE status='issued';
CREATE TABLE IF NOT EXISTS msa_document_reviews (
  document_id uuid NOT NULL REFERENCES msa_documents(id),
  user_id text NOT NULL REFERENCES users(id),
  sha256 text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(document_id,user_id)
);
CREATE TABLE IF NOT EXISTS client_msa_countersignatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES msa_documents(id),
  document_sha256 text NOT NULL,
  signer_user_id text NOT NULL REFERENCES users(id),
  signer_role text NOT NULL DEFAULT 'onspot' CHECK(signer_role='onspot'),
  legal_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  consent_text text NOT NULL,
  ip_address text NOT NULL,
  user_agent text NOT NULL
);
CREATE TABLE IF NOT EXISTS client_msa_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES users(id),
  document_id uuid REFERENCES msa_documents(id),
  draft_id uuid REFERENCES contract_drafts(id),
  actor_id text NOT NULL REFERENCES users(id),
  action text NOT NULL,
  field_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
