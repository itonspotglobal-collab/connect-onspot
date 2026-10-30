CREATE TABLE IF NOT EXISTS admin_hiring_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar NOT NULL REFERENCES users(id),
  submission_id text REFERENCES job_submissions(id),
  client_id varchar NOT NULL REFERENCES users(id),
  talent_id varchar NOT NULL REFERENCES users(id),
  action text NOT NULL,
  previous_state jsonb NOT NULL,
  new_state jsonb NOT NULL,
  reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
  notify_parties boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  reverted_by varchar REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS admin_hiring_overrides_submission_idx
  ON admin_hiring_overrides(submission_id,created_at DESC);
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS activation_override_id uuid REFERENCES admin_hiring_overrides(id);
ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS admin_direct_placement boolean NOT NULL DEFAULT false;
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS waived_by varchar REFERENCES users(id);
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS waived_at timestamptz;
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS waiver_reason text;
ALTER TABLE security_deposits DROP CONSTRAINT IF EXISTS security_deposits_status_check;
ALTER TABLE security_deposits ADD CONSTRAINT security_deposits_status_check CHECK
  (status IN ('pending','held','waived','drawn','replenishment_pending','suspended','forfeited','applied','void'));
ALTER TABLE manual_wise_obligations ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE manual_wise_obligations ADD COLUMN IF NOT EXISTS cancellation_reason text;
