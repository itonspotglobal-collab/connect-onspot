SELECT pg_temp.reconcile_table('public.clock_session_activities', $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_session_id uuid NOT NULL REFERENCES clock_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('work','lunch','break','meeting')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_paid boolean NOT NULL,
  max_minutes integer CHECK (max_minutes IS NULL OR max_minutes > 0),
  over_limit_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at > started_at)
$body$);
SELECT pg_temp.reconcile_index('public.clock_session_activities', 'clock_session_activities_one_open',
  $ddl$CREATE UNIQUE INDEX clock_session_activities_one_open ON clock_session_activities(clock_session_id) WHERE ended_at IS NULL;$ddl$);
SELECT pg_temp.reconcile_index('public.clock_session_activities', 'clock_session_activities_session_started',
  $ddl$CREATE INDEX clock_session_activities_session_started ON clock_session_activities(clock_session_id,started_at);$ddl$);

ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS lunch_paid boolean DEFAULT false;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS break_paid boolean DEFAULT true;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS meeting_paid boolean DEFAULT true;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS lunch_max_minutes integer DEFAULT 60;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS break_max_minutes integer DEFAULT 15;
ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS breaks_per_day integer DEFAULT 2;

-- Approval freezes activity/payment snapshots, including during disputes.
-- NULL on historical revisions retains the original all-work interpretation.
ALTER TABLE timesheet_revision_sessions ADD COLUMN IF NOT EXISTS activity_snapshot jsonb;
