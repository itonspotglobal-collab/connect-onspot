CREATE TABLE IF NOT EXISTS contract_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('msa','talent_agreement','sow')),
  hiring_contract_id uuid REFERENCES hiring_contracts(id),
  client_id text REFERENCES users(id),
  template_id uuid NOT NULL REFERENCES contract_templates(id),
  template_version text NOT NULL,
  field_values jsonb NOT NULL DEFAULT '{}',
  field_overrides jsonb NOT NULL DEFAULT '{}',
  body_overrides jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','retired')),
  revision integer NOT NULL DEFAULT 1,
  rendered_document_id uuid REFERENCES contract_documents(id),
  updated_by text NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_drafts_target_check CHECK ((hiring_contract_id IS NOT NULL) <> (client_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_drafts_live_hiring ON contract_drafts(hiring_contract_id) WHERE status <> 'retired';
CREATE UNIQUE INDEX IF NOT EXISTS contract_drafts_live_client ON contract_drafts(client_id) WHERE status <> 'retired';
ALTER TABLE contract_documents ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES contract_templates(id);
ALTER TABLE contract_documents ADD COLUMN IF NOT EXISTS template_version text;
ALTER TABLE contract_documents ADD COLUMN IF NOT EXISTS final_field_values jsonb;
ALTER TABLE contract_documents ADD COLUMN IF NOT EXISTS authoring_snapshot jsonb;
ALTER TABLE contract_document_events ADD COLUMN IF NOT EXISTS field_key text;
