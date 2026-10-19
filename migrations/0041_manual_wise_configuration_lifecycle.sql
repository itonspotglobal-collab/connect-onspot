-- Additive lifecycle metadata on the existing receiving-instructions authority.
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS config_status text;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS supported_currencies text[];
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS base_versions jsonb NOT NULL DEFAULT '{}';
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS previous_version_id uuid REFERENCES manual_wise_config(id) ON DELETE RESTRICT;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS source_config_id uuid REFERENCES manual_wise_config(id) ON DELETE RESTRICT;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS activated_by varchar REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS activated_at timestamptz;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS deactivated_by varchar REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS change_reason text;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS deactivation_reason text;
ALTER TABLE manual_wise_config ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
-- Legacy versions are not newly approvable drafts. Unknown historic activation
-- identities/dates stay NULL instead of inventing approval evidence.
UPDATE manual_wise_config SET config_status=CASE WHEN active THEN 'active' ELSE 'inactive' END
  WHERE config_status IS NULL;
UPDATE manual_wise_config SET supported_currencies=ARRAY[currency] WHERE supported_currencies IS NULL;
ALTER TABLE manual_wise_config ALTER COLUMN config_status SET DEFAULT 'draft';
ALTER TABLE manual_wise_config ALTER COLUMN config_status SET NOT NULL;
ALTER TABLE manual_wise_config ALTER COLUMN supported_currencies SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='manual_wise_config_status_check') THEN
    ALTER TABLE manual_wise_config ADD CONSTRAINT manual_wise_config_status_check
      CHECK(config_status IN ('draft','active','inactive','reviewed'));
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='manual_wise_config_active_status_check') THEN
    ALTER TABLE manual_wise_config ADD CONSTRAINT manual_wise_config_active_status_check
      CHECK(active=(config_status='active'));
  END IF;
END $$;
