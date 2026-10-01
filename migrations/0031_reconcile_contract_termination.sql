-- Reconcile the canonical termination schema before considering legacy history.
SELECT pg_temp.reconcile_column('public.hiring_contracts', 'effective_end_date', 'date');
SELECT pg_temp.reconcile_column('public.hiring_contracts', 'termination_reason', 'text');
SELECT pg_temp.reconcile_column('public.hiring_contracts', 'terminated_by', 'varchar');
SELECT pg_temp.reconcile_column('public.hiring_contracts', 'terminated_at', 'timestamptz');

SELECT pg_temp.reconcile_constraint(
  'public.hiring_contracts',
  'hiring_contracts_terminated_by_fkey',
  'FOREIGN KEY (terminated_by) REFERENCES users(id) ON DELETE RESTRICT'
);
SELECT pg_temp.reconcile_constraint(
  'public.hiring_contracts',
  'hiring_contracts_termination_snapshot_check',
  $definition$CHECK (
    (effective_end_date IS NULL AND termination_reason IS NULL
      AND terminated_by IS NULL AND terminated_at IS NULL)
    OR
    (effective_end_date IS NOT NULL AND billing_mode IN ('tracked', 'guaranteed')
      AND termination_reason IS NOT NULL AND btrim(termination_reason) <> ''
      AND terminated_by IS NOT NULL AND terminated_at IS NOT NULL
      AND (effective_start_date IS NULL OR effective_end_date >= effective_start_date))
  )$definition$,
  true
);

SELECT pg_temp.reconcile_table(
  'public.hiring_contract_termination_requests',
  $body$
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
  $body$
);

SELECT pg_temp.reconcile_index(
  'public.hiring_contract_termination_requests',
  'hiring_contract_termination_one_open_request_idx',
  $ddl$CREATE UNIQUE INDEX hiring_contract_termination_one_open_request_idx
  ON hiring_contract_termination_requests(hiring_contract_id) WHERE status = 'open';$ddl$
);
SELECT pg_temp.reconcile_index(
  'public.hiring_contract_termination_requests',
  'hiring_contract_termination_one_approval_idx',
  $ddl$CREATE UNIQUE INDEX hiring_contract_termination_one_approval_idx
  ON hiring_contract_termination_requests(hiring_contract_id) WHERE status = 'approved';$ddl$
);
SELECT pg_temp.reconcile_index(
  'public.hiring_contract_termination_requests',
  'hiring_contract_termination_requests_status_idx',
  $ddl$CREATE INDEX hiring_contract_termination_requests_status_idx
  ON hiring_contract_termination_requests(status, created_at);$ddl$
);

SELECT pg_temp.reconcile_function(
  'protect_hiring_contract_termination',
  $ddl$CREATE OR REPLACE FUNCTION protect_hiring_contract_termination()
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
$$;$ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.hiring_contracts',
  'hiring_contract_termination_immutable',
  $ddl$CREATE TRIGGER hiring_contract_termination_immutable
  BEFORE UPDATE OF effective_end_date, termination_reason, terminated_by, terminated_at
  ON hiring_contracts
  FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination();$ddl$
);

SELECT pg_temp.reconcile_function(
  'protect_hiring_contract_termination_requests',
  $ddl$CREATE OR REPLACE FUNCTION protect_hiring_contract_termination_requests()
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
$$;$ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.hiring_contract_termination_requests',
  'hiring_contract_termination_requests_immutable',
  $ddl$CREATE TRIGGER hiring_contract_termination_requests_immutable
  BEFORE UPDATE OR DELETE ON hiring_contract_termination_requests
  FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination_requests();$ddl$
);

-- Historical source deployments are optional; all references to that table
-- are deliberately inside this guarded block.
DO $$
DECLARE
  source_oid oid;
  source_kind "char";
  bad_type_count bigint;
  bad_status_count bigint;
  pending_metadata_count bigint;
  missing_user_count bigint;
  missing_contract_count bigint;
  blank_reason_count bigint;
  missing_required_count bigint;
  duplicate_source_open_count bigint;
  duplicate_source_approved_count bigint;
  duplicate_canonical_open_count bigint;
  duplicate_canonical_approved_count bigint;
  different_payload_count bigint;
  postcondition_mismatch_count bigint;
BEGIN
  source_oid := to_regclass('public.contract_termination_requests');
  IF source_oid IS NULL THEN
    RETURN;
  END IF;

  SELECT c.relkind
    INTO source_kind
    FROM pg_class c
   WHERE c.oid = source_oid;
  IF source_kind NOT IN ('r', 'p') THEN
    RAISE EXCEPTION
      'Cannot import public.contract_termination_requests: expected a table (relkind r or p), found relkind %',
      source_kind;
  END IF;

  SELECT count(*)
    INTO bad_type_count
    FROM (VALUES
      ('id', 'uuid'::regtype),
      ('hiring_contract_id', 'uuid'::regtype),
      ('requested_by', 'character varying'::regtype),
      ('effective_end_date', 'date'::regtype),
      ('reason', 'text'::regtype),
      ('status', 'text'::regtype),
      ('review_reason', 'text'::regtype),
      ('reviewed_by', 'character varying'::regtype),
      ('reviewed_at', 'timestamp with time zone'::regtype),
      ('created_at', 'timestamp with time zone'::regtype)
    ) AS expected(column_name, type_oid)
    LEFT JOIN pg_attribute a
      ON a.attrelid = source_oid
     AND a.attname = expected.column_name
     AND a.attnum > 0
     AND NOT a.attisdropped
   WHERE a.attname IS NULL
      OR a.atttypid <> expected.type_oid
      OR (expected.type_oid = 'character varying'::regtype AND a.atttypmod <> -1);

  IF bad_type_count > 0 THEN
    RAISE EXCEPTION
      'Cannot import public.contract_termination_requests: % required columns are missing or have incompatible types',
      bad_type_count;
  END IF;

  DROP TABLE IF EXISTS pg_temp.termination_0031_import_map;
  CREATE TEMP TABLE termination_0031_import_map ON COMMIT DROP AS
    SELECT
      r.id,
      r.hiring_contract_id,
      r.requested_by AS requester_id,
      CASE WHEN u.role IN ('admin', 'client', 'talent') THEN u.role ELSE 'admin' END::text
        AS requester_role,
      r.effective_end_date AS requested_effective_end_date,
      r.reason,
      CASE WHEN r.status = 'pending' THEN 'open' ELSE r.status END AS status,
      CASE WHEN r.status = 'pending' THEN NULL
        ELSE COALESCE(NULLIF(btrim(r.review_reason), ''), 'Previously reviewed')
      END AS decision_reason,
      r.reviewed_by AS decided_by,
      r.reviewed_at AS decided_at,
      CASE WHEN r.status = 'approved' THEN r.effective_end_date ELSE NULL END
        AS approved_effective_end_date,
      r.created_at
    FROM public.contract_termination_requests r
    LEFT JOIN public.users u ON u.id = r.requested_by
    WHERE r.status = 'pending'
       OR (r.reviewed_by IS NOT NULL AND r.reviewed_at IS NOT NULL);

  SELECT count(*)
    INTO bad_status_count
    FROM public.contract_termination_requests r
   WHERE r.status IS NULL
      OR r.status NOT IN ('pending', 'approved', 'rejected');

  SELECT count(*)
    INTO pending_metadata_count
    FROM public.contract_termination_requests r
   WHERE r.status = 'pending'
     AND (r.review_reason IS NOT NULL OR r.reviewed_by IS NOT NULL OR r.reviewed_at IS NOT NULL);

  SELECT count(*)
    INTO missing_user_count
    FROM pg_temp.termination_0031_import_map m
    LEFT JOIN public.users requester ON requester.id = m.requester_id
    LEFT JOIN public.users reviewer ON reviewer.id = m.decided_by
   WHERE requester.id IS NULL
      OR (m.decided_by IS NOT NULL AND reviewer.id IS NULL);

  SELECT count(*)
    INTO missing_contract_count
    FROM pg_temp.termination_0031_import_map m
    LEFT JOIN public.hiring_contracts hc ON hc.id = m.hiring_contract_id
   WHERE hc.id IS NULL;

  SELECT count(*)
    INTO blank_reason_count
    FROM pg_temp.termination_0031_import_map m
   WHERE m.reason IS NULL OR btrim(m.reason) = '';

  SELECT count(*)
    INTO missing_required_count
    FROM pg_temp.termination_0031_import_map m
   WHERE m.id IS NULL
      OR m.hiring_contract_id IS NULL
      OR m.requester_id IS NULL
      OR m.requested_effective_end_date IS NULL
      OR m.created_at IS NULL;

  SELECT count(*)
    INTO different_payload_count
    FROM pg_temp.termination_0031_import_map a
   WHERE EXISTS (
     SELECT 1
       FROM pg_temp.termination_0031_import_map b
      WHERE b.id = a.id
        AND ROW(
          b.hiring_contract_id, b.requester_id, b.requester_role,
          b.requested_effective_end_date, b.reason, b.status,
          b.decision_reason, b.decided_by, b.decided_at,
          b.approved_effective_end_date, b.created_at
        ) IS DISTINCT FROM ROW(
          a.hiring_contract_id, a.requester_id, a.requester_role,
          a.requested_effective_end_date, a.reason, a.status,
          a.decision_reason, a.decided_by, a.decided_at,
          a.approved_effective_end_date, a.created_at
        )
   );

  SELECT different_payload_count + count(*)
    INTO different_payload_count
    FROM (
      SELECT DISTINCT ON (m.id) m.*
        FROM pg_temp.termination_0031_import_map m
       ORDER BY m.id
    ) m
    JOIN public.hiring_contract_termination_requests existing ON existing.id = m.id
   WHERE ROW(
       existing.hiring_contract_id, existing.requester_id, existing.requester_role,
       existing.requested_effective_end_date, existing.reason, existing.status,
       existing.decision_reason, existing.decided_by, existing.decided_at,
       existing.approved_effective_end_date, existing.created_at
     ) IS DISTINCT FROM ROW(
       m.hiring_contract_id, m.requester_id, m.requester_role,
       m.requested_effective_end_date, m.reason, m.status,
       m.decision_reason, m.decided_by, m.decided_at,
       m.approved_effective_end_date, m.created_at
     );

  SELECT COALESCE(sum(group_size - 1) FILTER (WHERE status = 'open'), 0),
         COALESCE(sum(group_size - 1) FILTER (WHERE status = 'approved'), 0)
    INTO duplicate_source_open_count, duplicate_source_approved_count
    FROM (
      SELECT status, hiring_contract_id, count(*) AS group_size
        FROM (
          SELECT DISTINCT ON (m.id) m.*
            FROM pg_temp.termination_0031_import_map m
           ORDER BY m.id
        ) deduplicated
       WHERE status IN ('open', 'approved')
       GROUP BY status, hiring_contract_id
      HAVING count(*) > 1
    ) duplicate_groups;

  SELECT count(*)
    INTO duplicate_canonical_open_count
    FROM (
      SELECT DISTINCT ON (m.id) m.*
        FROM pg_temp.termination_0031_import_map m
       ORDER BY m.id
    ) m
   WHERE m.status = 'open'
     AND EXISTS (
       SELECT 1
         FROM public.hiring_contract_termination_requests existing
        WHERE existing.hiring_contract_id = m.hiring_contract_id
          AND existing.status = 'open'
          AND existing.id IS DISTINCT FROM m.id
     );

  SELECT count(*)
    INTO duplicate_canonical_approved_count
    FROM (
      SELECT DISTINCT ON (m.id) m.*
        FROM pg_temp.termination_0031_import_map m
       ORDER BY m.id
    ) m
   WHERE m.status = 'approved'
     AND EXISTS (
       SELECT 1
         FROM public.hiring_contract_termination_requests existing
        WHERE existing.hiring_contract_id = m.hiring_contract_id
          AND existing.status = 'approved'
          AND existing.id IS DISTINCT FROM m.id
     );

  IF bad_status_count > 0
     OR pending_metadata_count > 0
     OR missing_user_count > 0
     OR missing_contract_count > 0
     OR blank_reason_count > 0
     OR missing_required_count > 0
     OR duplicate_source_open_count > 0
     OR duplicate_source_approved_count > 0
     OR duplicate_canonical_open_count > 0
     OR duplicate_canonical_approved_count > 0
     OR different_payload_count > 0 THEN
    RAISE EXCEPTION
      'Cannot import legacy contract terminations: bad statuses %, pending rows with review metadata %, missing users %, missing contracts %, blank reasons %, missing required values %, duplicate source open requests %, duplicate source approvals %, conflicts with canonical open requests %, conflicts with canonical approvals %, same-ID different-payload conflicts %',
      bad_status_count,
      pending_metadata_count,
      missing_user_count,
      missing_contract_count,
      blank_reason_count,
      missing_required_count,
      duplicate_source_open_count,
      duplicate_source_approved_count,
      duplicate_canonical_open_count,
      duplicate_canonical_approved_count,
      different_payload_count;
  END IF;

  INSERT INTO public.hiring_contract_termination_requests
    (id, hiring_contract_id, requester_id, requester_role, requested_effective_end_date,
     reason, status, decision_reason, decided_by, decided_at, approved_effective_end_date, created_at)
  SELECT m.id, m.hiring_contract_id, m.requester_id, m.requester_role,
         m.requested_effective_end_date, m.reason, m.status, m.decision_reason,
         m.decided_by, m.decided_at, m.approved_effective_end_date, m.created_at
    FROM (
      SELECT DISTINCT ON (mapped.id) mapped.*
        FROM pg_temp.termination_0031_import_map mapped
       ORDER BY mapped.id
    ) m
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.hiring_contract_termination_requests existing
      WHERE existing.id = m.id
   );

  SELECT count(*)
    INTO postcondition_mismatch_count
    FROM (
      SELECT DISTINCT ON (mapped.id) mapped.*
        FROM pg_temp.termination_0031_import_map mapped
       ORDER BY mapped.id
    ) m
    LEFT JOIN public.hiring_contract_termination_requests existing ON existing.id = m.id
   WHERE existing.id IS NULL
      OR ROW(
        existing.hiring_contract_id, existing.requester_id, existing.requester_role,
        existing.requested_effective_end_date, existing.reason, existing.status,
        existing.decision_reason, existing.decided_by, existing.decided_at,
        existing.approved_effective_end_date, existing.created_at
      ) IS DISTINCT FROM ROW(
        m.hiring_contract_id, m.requester_id, m.requester_role,
        m.requested_effective_end_date, m.reason, m.status,
        m.decision_reason, m.decided_by, m.decided_at,
        m.approved_effective_end_date, m.created_at
      );

  IF postcondition_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'Legacy contract termination import did not reconcile: % eligible IDs are missing or have a different payload',
      postcondition_mismatch_count;
  END IF;

  DROP TABLE pg_temp.termination_0031_import_map;
END
$$;