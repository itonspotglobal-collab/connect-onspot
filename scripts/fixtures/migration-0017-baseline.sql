-- Intentionally small, explicit contract for migration reconciliation tests.
-- This is NOT a production dump: it contains only the pre-0018 columns needed
-- by migrations 0018-0031 and their documented backfills.
CREATE TABLE public.users (
  id varchar PRIMARY KEY,
  role text NOT NULL
);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY,
  client_id varchar REFERENCES public.users(id),
  time_zone text
);

CREATE TABLE public.offers (
  id uuid PRIMARY KEY,
  proposed_start_date timestamp,
  engagement_type text
);

CREATE TABLE public.hiring_contracts (
  id uuid PRIMARY KEY,
  offer_id uuid REFERENCES public.offers(id),
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  onspot_signed_at timestamptz,
  talent_signed_at timestamptz
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY,
  external_ref text
);

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY,
  hiring_contract_id uuid REFERENCES public.hiring_contracts(id),
  external_ref text
);

-- Migration 0017 is included in the baseline contract because 0018-0031 run
-- after it. Keep its original index definition and its source columns.
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  event_key text,
  popup_presented_at timestamp
);
CREATE INDEX notifications_unpresented_hired_popup_idx
  ON public.notifications (user_id, created_at)
  WHERE type = 'job_application_status_changed'
    AND popup_presented_at IS NULL
    AND event_key LIKE 'talent-hired:%';

CREATE TABLE public.app_schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_schema_migrations (id) VALUES
  ('0002_job_submissions_and_application_tokens'),
  ('0003_job_application_status_history'),
  ('0004_candidate_more_about_me'),
  ('0005_engagement_type'),
  ('0006_drop_hourly_rate_columns'),
  ('0007_messages_flagged_for_review'),
  ('0008_interview_timezones'),
  ('0009_client_shortlist_workflow'),
  ('0010_remove_legacy_freelance_tables'),
  ('0011_canonical_engagement_types'),
  ('0012_job_form_requirements'),
  ('0013_admin_interviewers'),
  ('0014_job_application_method_default'),
  ('0015_job_drafts'),
  ('0016_other_job_function'),
  ('0017_talent_hired_popup_acknowledgement');