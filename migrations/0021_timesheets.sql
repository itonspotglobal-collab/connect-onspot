-- Timesheets are clock-derived snapshots with append-only reviews and corrections.
SELECT pg_temp.reconcile_column('public.jobs', 'time_zone', 'text');

SELECT pg_temp.reconcile_table('public.timesheet_periods', $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  work_timezone text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved', 'disputed', 'rejected')),
  submitted_at timestamptz,
  approved_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hiring_contract_id, period_start, period_end),
  CHECK (period_start <= period_end)
$body$);
SELECT pg_temp.reconcile_index(
  'public.timesheet_periods',
  'timesheet_periods_contract_period',
  $ddl$CREATE INDEX timesheet_periods_contract_period
    ON timesheet_periods (hiring_contract_id, period_start DESC);$ddl$
);

SELECT pg_temp.reconcile_table(
  'public.timesheet_revisions',
  $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_period_id uuid NOT NULL REFERENCES timesheet_periods(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  created_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  decision_reason text NOT NULL,
  exception_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timesheet_period_id, version)
$body$,
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY['work_timezone']::text[]
);

SELECT pg_temp.reconcile_table('public.timesheet_revision_sessions', $body$
  revision_id uuid NOT NULL REFERENCES timesheet_revisions(id) ON DELETE RESTRICT,
  clock_session_id uuid NOT NULL REFERENCES clock_sessions(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL,
  effective_end_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('clock', 'approved_exception', 'admin_correction')),
  PRIMARY KEY (revision_id, clock_session_id),
  CHECK (effective_end_at > started_at)
$body$);

SELECT pg_temp.reconcile_table('public.timesheet_correction_proposals', $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_period_id uuid NOT NULL REFERENCES timesheet_periods(id) ON DELETE RESTRICT,
  clock_session_id uuid NOT NULL REFERENCES clock_sessions(id) ON DELETE RESTRICT,
  requested_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_started_at timestamptz,
  requested_end_at timestamptz,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_started_at IS NOT NULL OR requested_end_at IS NOT NULL)
$body$);
SELECT pg_temp.reconcile_index(
  'public.timesheet_correction_proposals',
  'timesheet_corrections_period',
  $ddl$CREATE INDEX timesheet_corrections_period
    ON timesheet_correction_proposals (timesheet_period_id, created_at);$ddl$
);

SELECT pg_temp.reconcile_table('public.timesheet_disputes', $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_period_id uuid NOT NULL REFERENCES timesheet_periods(id) ON DELETE RESTRICT,
  client_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  resolution_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
$body$);
SELECT pg_temp.reconcile_index(
  'public.timesheet_disputes',
  'timesheet_disputes_period',
  $ddl$CREATE INDEX timesheet_disputes_period
    ON timesheet_disputes (timesheet_period_id, created_at);$ddl$
);

SELECT pg_temp.reconcile_table('public.timesheet_audit', $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_period_id uuid NOT NULL REFERENCES timesheet_periods(id) ON DELETE RESTRICT,
  actor_id varchar REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('submitted', 'correction_requested', 'disputed', 'review_approved', 'review_rejected', 'review_exception', 'correction_decided')),
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
$body$);
SELECT pg_temp.reconcile_index(
  'public.timesheet_audit',
  'timesheet_audit_period',
  $ddl$CREATE INDEX timesheet_audit_period
    ON timesheet_audit (timesheet_period_id, created_at);$ddl$
);

SELECT pg_temp.reconcile_constraint(
  'public.timesheet_periods',
  'timesheet_period_approved_revision_fk',
  'FOREIGN KEY (approved_revision_id) REFERENCES timesheet_revisions(id) ON DELETE RESTRICT'
);

SELECT pg_temp.reconcile_function(
  'reject_timesheet_history_mutation',
  $ddl$CREATE FUNCTION reject_timesheet_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'timesheet revision and audit history is immutable';
END;
$$;$ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.timesheet_revisions',
  'timesheet_revisions_immutable',
  $ddl$CREATE TRIGGER timesheet_revisions_immutable
    BEFORE UPDATE OR DELETE ON timesheet_revisions
    FOR EACH ROW EXECUTE FUNCTION reject_timesheet_history_mutation();$ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.timesheet_revision_sessions',
  'timesheet_revision_sessions_immutable',
  $ddl$CREATE TRIGGER timesheet_revision_sessions_immutable
    BEFORE UPDATE OR DELETE ON timesheet_revision_sessions
    FOR EACH ROW EXECUTE FUNCTION reject_timesheet_history_mutation();$ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.timesheet_audit',
  'timesheet_audit_immutable',
  $ddl$CREATE TRIGGER timesheet_audit_immutable
    BEFORE UPDATE OR DELETE ON timesheet_audit
    FOR EACH ROW EXECUTE FUNCTION reject_timesheet_history_mutation();$ddl$
);