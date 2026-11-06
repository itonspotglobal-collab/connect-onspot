CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('msa','talent_agreement','sow')),
  name text NOT NULL,
  version text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_by text REFERENCES users(id),
  activated_by text REFERENCES users(id),
  activation_reason text,
  activated_at timestamptz,
  source_document_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kind,version),
  CONSTRAINT contract_templates_activation_check CHECK (status <> 'active' OR
    (activated_by IS NOT NULL AND activated_at IS NOT NULL AND activation_reason IS NOT NULL AND length(trim(activation_reason)) > 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_one_active_kind ON contract_templates(kind) WHERE status='active';
CREATE TABLE IF NOT EXISTS contract_template_fields (
  template_id uuid NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  source text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  editable_by text NOT NULL CHECK (editable_by IN ('admin','preparer','none')),
  PRIMARY KEY(template_id,key)
);
CREATE OR REPLACE FUNCTION enforce_contract_template_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Published template versions are immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.kind IS DISTINCT FROM OLD.kind OR NEW.name IS DISTINCT FROM OLD.name OR
    NEW.version IS DISTINCT FROM OLD.version OR NEW.body IS DISTINCT FROM OLD.body OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.activated_by IS DISTINCT FROM OLD.activated_by OR NEW.activated_at IS DISTINCT FROM OLD.activated_at OR
    NEW.activation_reason IS DISTINCT FROM OLD.activation_reason OR
    NEW.source_document_sha256 IS DISTINCT FROM OLD.source_document_sha256
  ) THEN RAISE EXCEPTION 'Published template versions are immutable'; END IF;
  IF OLD.status='retired' AND NEW.status <> 'retired' THEN RAISE EXCEPTION 'Clone retired templates into a new draft'; END IF;
  IF OLD.status='active' AND NEW.status NOT IN ('active','retired') THEN RAISE EXCEPTION 'Clone active templates into a new draft'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contract_templates_immutable ON contract_templates;
CREATE TRIGGER contract_templates_immutable BEFORE UPDATE OR DELETE ON contract_templates
  FOR EACH ROW EXECUTE FUNCTION enforce_contract_template_immutability();
CREATE OR REPLACE FUNCTION enforce_contract_template_field_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE template_status text;
BEGIN
  SELECT status INTO template_status FROM contract_templates
    WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.template_id ELSE NEW.template_id END FOR SHARE;
  IF template_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Published template fields are immutable'; END IF;
  IF TG_OP='UPDATE' AND NEW.template_id IS DISTINCT FROM OLD.template_id THEN
    RAISE EXCEPTION 'Template fields cannot move between versions';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contract_template_fields_immutable ON contract_template_fields;
CREATE TRIGGER contract_template_fields_immutable BEFORE INSERT OR UPDATE OR DELETE ON contract_template_fields
  FOR EACH ROW EXECUTE FUNCTION enforce_contract_template_field_immutability();
