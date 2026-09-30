-- Some development databases applied an earlier termination schema under
-- migration 0029. Add the canonical audited workflow without dropping its
-- historical rows. Databases that ran the canonical 0029 are already ready.
ALTER TABLE hiring_contracts
  ADD COLUMN IF NOT EXISTS effective_end_date date,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS terminated_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminated_by varchar REFERENCES users(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hiring_contracts_termination_snapshot_check') THEN
    ALTER TABLE hiring_contracts ADD CONSTRAINT hiring_contracts_termination_snapshot_check
      CHECK (
        (effective_end_date IS NULL AND termination_reason IS NULL AND terminated_by IS NULL AND terminated_at IS NULL)
        OR (effective_end_date IS NOT NULL AND billing_mode IN ('tracked', 'guaranteed')
          AND termination_reason IS NOT NULL AND btrim(termination_reason) <> ''
          AND terminated_by IS NOT NULL AND terminated_at IS NOT NULL
          AND (effective_start_date IS NULL OR effective_end_date >= effective_start_date))
      ) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hiring_contract_termination_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  requester_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requester_role text NOT NULL CHECK (requester_role IN ('client', 'talent', 'admin')),
  requested_effective_end_date date NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  decision_reason text,
  decided_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  decided_at timestamptz,
  approved_effective_end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'open' AND decision_reason IS NULL AND decided_by IS NULL
      AND decided_at IS NULL AND approved_effective_end_date IS NULL)
    OR (status = 'approved' AND decision_reason IS NOT NULL AND btrim(decision_reason) <> ''
      AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND approved_effective_end_date IS NOT NULL)
    OR (status = 'rejected' AND decision_reason IS NOT NULL AND btrim(decision_reason) <> ''
      AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND approved_effective_end_date IS NULL)
  ),
  CHECK (approved_effective_end_date IS NULL OR approved_effective_end_date >= requested_effective_end_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS hiring_contract_termination_one_open_request_idx
  ON hiring_contract_termination_requests(hiring_contract_id) WHERE status = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS hiring_contract_termination_one_approval_idx
  ON hiring_contract_termination_requests(hiring_contract_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS hiring_contract_termination_requests_status_idx
  ON hiring_contract_termination_requests(status, created_at);

CREATE OR REPLACE FUNCTION protect_hiring_contract_termination()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF OLD.effective_end_date IS NOT NULL
     AND (NEW.effective_end_date IS DISTINCT FROM OLD.effective_end_date
       OR NEW.termination_reason IS DISTINCT FROM OLD.termination_reason
       OR NEW.terminated_by IS DISTINCT FROM OLD.terminated_by
       OR NEW.terminated_at IS DISTINCT FROM OLD.terminated_at) THEN
    RAISE EXCEPTION 'An approved contract termination is immutable';
  END IF;
  IF OLD.effective_end_date IS NULL AND NEW.effective_end_date IS NOT NULL
     AND NEW.effective_end_date < (now() AT TIME ZONE 'America/New_York')::date THEN
    RAISE EXCEPTION 'Contract termination cannot be backdated';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION protect_hiring_contract_termination_requests()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Contract termination requests are immutable audit records'; END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD.status <> 'open' OR NEW.status NOT IN ('approved', 'rejected')
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.hiring_contract_id IS DISTINCT FROM OLD.hiring_contract_id
    OR NEW.requester_id IS DISTINCT FROM OLD.requester_id OR NEW.requester_role IS DISTINCT FROM OLD.requester_role
    OR NEW.requested_effective_end_date IS DISTINCT FROM OLD.requested_effective_end_date
    OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.decision_reason IS NULL OR btrim(NEW.decision_reason) = ''
    OR NEW.decided_by IS NULL OR NEW.decided_at IS NULL
    OR (NEW.status = 'approved' AND NEW.approved_effective_end_date IS NULL)
    OR (NEW.status = 'rejected' AND NEW.approved_effective_end_date IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Termination requests allow one immutable adjudication'; END IF;
  RETURN NEW;
END;
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hiring_contract_termination_immutable') THEN
    CREATE TRIGGER hiring_contract_termination_immutable
      BEFORE UPDATE OF effective_end_date, termination_reason, terminated_by, terminated_at
      ON hiring_contracts FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hiring_contract_termination_requests_immutable') THEN
    CREATE TRIGGER hiring_contract_termination_requests_immutable
      BEFORE UPDATE OR DELETE ON hiring_contract_termination_requests
      FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination_requests();
  END IF;
END $$;

-- Preserve approvals recorded by the earlier schema in the canonical history.
DO $$
BEGIN
  IF to_regclass('public.contract_termination_requests') IS NOT NULL THEN
    INSERT INTO hiring_contract_termination_requests
      (id, hiring_contract_id, requester_id, requester_role, requested_effective_end_date,
       reason, status, decision_reason, decided_by, decided_at, approved_effective_end_date, created_at)
    SELECT r.id, r.hiring_contract_id, r.requested_by,
      CASE WHEN u.role IN ('admin', 'client', 'talent') THEN u.role ELSE 'admin' END,
      r.effective_end_date, r.reason,
      CASE WHEN r.status = 'pending' THEN 'open' ELSE r.status END,
      CASE WHEN r.status = 'pending' THEN NULL ELSE COALESCE(NULLIF(btrim(r.review_reason), ''), 'Previously reviewed') END,
      r.reviewed_by, r.reviewed_at,
      CASE WHEN r.status = 'approved' THEN r.effective_end_date ELSE NULL END, r.created_at
    FROM contract_termination_requests r JOIN users u ON u.id = r.requested_by
    WHERE NOT EXISTS (SELECT 1 FROM hiring_contract_termination_requests old WHERE old.id = r.id)
      AND (r.status = 'pending' OR (r.reviewed_by IS NOT NULL AND r.reviewed_at IS NOT NULL))
    ON CONFLICT DO NOTHING;
  END IF;
END $$;