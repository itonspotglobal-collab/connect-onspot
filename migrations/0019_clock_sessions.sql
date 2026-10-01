-- Clock-first work-session records are separate from legacy time_entries.
-- ended_at is only the server-captured clock-out event; approved corrections
-- are retained separately and never rewrite either captured timestamp.
SELECT pg_temp.reconcile_table('public.clock_sessions', $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  talent_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  exception_type text CHECK (exception_type IS NULL OR exception_type IN ('missed_out')),
  exception_detected_at timestamptz,
  exception_status text CHECK (exception_status IS NULL OR exception_status IN ('detected', 'pending', 'approved', 'rejected')),
  proposed_end_at timestamptz,
  proposal_reason text,
  approved_end_at timestamptz,
  resolved_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  resolution_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((exception_status IS NULL) = (exception_type IS NULL)),
  CHECK (
    (exception_status IS NULL AND proposed_end_at IS NULL AND proposal_reason IS NULL
      AND approved_end_at IS NULL AND resolved_by IS NULL AND resolved_at IS NULL AND resolution_reason IS NULL)
    OR (exception_status = 'detected' AND exception_type IS NOT NULL
      AND proposed_end_at IS NULL AND proposal_reason IS NULL AND approved_end_at IS NULL
      AND resolved_by IS NULL AND resolved_at IS NULL AND resolution_reason IS NULL)
    OR (exception_status = 'pending' AND exception_type IS NOT NULL AND proposed_end_at IS NOT NULL
      AND proposal_reason IS NOT NULL AND approved_end_at IS NULL AND resolved_by IS NULL
      AND resolved_at IS NULL AND resolution_reason IS NULL)
    OR (exception_status = 'approved' AND exception_type IS NOT NULL AND proposed_end_at IS NOT NULL
      AND proposal_reason IS NOT NULL AND approved_end_at IS NOT NULL AND resolved_by IS NOT NULL
      AND resolved_at IS NOT NULL AND resolution_reason IS NOT NULL)
    OR (exception_status = 'rejected' AND exception_type IS NOT NULL AND proposed_end_at IS NOT NULL
      AND proposal_reason IS NOT NULL AND approved_end_at IS NULL AND resolved_by IS NOT NULL
      AND resolved_at IS NOT NULL AND resolution_reason IS NOT NULL)
  )
$body$);

-- An approved correction resolves the open clock session without changing its
-- raw ended_at event. Detected/pending exceptions and ordinary open sessions hold
-- the global per-talent lock; rejected exceptions remain open until clocked out.
SELECT pg_temp.reconcile_index(
  'public.clock_sessions',
  'clock_sessions_one_open_per_talent',
  $ddl$CREATE UNIQUE INDEX clock_sessions_one_open_per_talent
    ON clock_sessions (talent_id)
    WHERE ended_at IS NULL AND exception_status IS DISTINCT FROM 'approved';$ddl$
);

SELECT pg_temp.reconcile_index(
  'public.clock_sessions',
  'clock_sessions_talent_recent',
  $ddl$CREATE INDEX clock_sessions_talent_recent
    ON clock_sessions (talent_id, started_at DESC);$ddl$
);