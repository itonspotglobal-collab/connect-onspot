ALTER TABLE hiring_contracts
  ADD COLUMN effective_end_date date,
  ADD COLUMN termination_reason text,
  ADD COLUMN terminated_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN terminated_at timestamptz;

ALTER TABLE hiring_contracts
  ADD CONSTRAINT hiring_contracts_termination_snapshot_check CHECK (
    (effective_end_date IS NULL AND termination_reason IS NULL
      AND terminated_by IS NULL AND terminated_at IS NULL)
    OR
    (effective_end_date IS NOT NULL AND billing_mode IN ('tracked', 'guaranteed')
      AND termination_reason IS NOT NULL AND btrim(termination_reason) <> ''
      AND terminated_by IS NOT NULL AND terminated_at IS NOT NULL
      AND (effective_start_date IS NULL OR effective_end_date >= effective_start_date))
  );

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

CREATE TRIGGER hiring_contract_termination_immutable
  BEFORE UPDATE OF effective_end_date, termination_reason, terminated_by, terminated_at
  ON hiring_contracts
  FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination();

CREATE TABLE hiring_contract_termination_requests (
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
    OR
    (status = 'approved' AND decision_reason IS NOT NULL AND btrim(decision_reason) <> ''
      AND decided_by IS NOT NULL AND decided_at IS NOT NULL
      AND approved_effective_end_date IS NOT NULL)
    OR
    (status = 'rejected' AND decision_reason IS NOT NULL AND btrim(decision_reason) <> ''
      AND decided_by IS NOT NULL AND decided_at IS NOT NULL
      AND approved_effective_end_date IS NULL)
  ),
  CHECK (approved_effective_end_date IS NULL OR approved_effective_end_date >= requested_effective_end_date)
);

CREATE UNIQUE INDEX hiring_contract_termination_one_open_request_idx
  ON hiring_contract_termination_requests(hiring_contract_id) WHERE status = 'open';
CREATE UNIQUE INDEX hiring_contract_termination_one_approval_idx
  ON hiring_contract_termination_requests(hiring_contract_id) WHERE status = 'approved';
CREATE INDEX hiring_contract_termination_requests_status_idx
  ON hiring_contract_termination_requests(status, created_at);

CREATE OR REPLACE FUNCTION protect_hiring_contract_termination_requests()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contract termination requests are immutable audit records';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD.status <> 'open'
    OR NEW.status NOT IN ('approved', 'rejected')
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.hiring_contract_id IS DISTINCT FROM OLD.hiring_contract_id
    OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
    OR NEW.requester_role IS DISTINCT FROM OLD.requester_role
    OR NEW.requested_effective_end_date IS DISTINCT FROM OLD.requested_effective_end_date
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.decision_reason IS NULL OR btrim(NEW.decision_reason) = ''
    OR NEW.decided_by IS NULL OR NEW.decided_at IS NULL
    OR (NEW.status = 'approved' AND NEW.approved_effective_end_date IS NULL)
    OR (NEW.status = 'rejected' AND NEW.approved_effective_end_date IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Termination requests allow one immutable adjudication';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hiring_contract_termination_requests_immutable
  BEFORE UPDATE OR DELETE ON hiring_contract_termination_requests
  FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination_requests();