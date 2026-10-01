-- Phase 3B: separate Talent-side invoice ledger. The historical Client invoice
-- and payout ledgers are intentionally left unchanged.
SELECT pg_temp.reconcile_table(
  'public.talent_invoices',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  talent_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  billing_mode text NOT NULL CHECK (billing_mode IN ('tracked', 'guaranteed')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency text NOT NULL,
  monthly_rate numeric(12,2) NOT NULL,
  amount numeric(12,2) NOT NULL,
  hours numeric(10,4),
  standard_hours numeric(10,4),
  hourly_equivalent numeric(12,4),
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.2000,
  timesheet_revision_id uuid REFERENCES timesheet_revisions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'void')),
  drafted_at timestamptz NOT NULL DEFAULT now(),
  auto_send_at timestamptz NOT NULL,
  sent_at timestamptz,
  payout_due_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hiring_contract_id, period_start, period_end)
  $table_body$,
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY['base_amount', 'credit_amount']::text[]
);
SELECT pg_temp.reconcile_index(
  'public.talent_invoices',
  'talent_invoices_talent_status_idx',
  'CREATE INDEX talent_invoices_talent_status_idx ON talent_invoices(talent_id, status);'
);
SELECT pg_temp.reconcile_index(
  'public.talent_invoices',
  'talent_invoices_period_idx',
  'CREATE INDEX talent_invoices_period_idx ON talent_invoices(period_start, period_end);'
);

SELECT pg_temp.reconcile_table(
  'public.guaranteed_nonperformance_claims',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_invoice_id uuid UNIQUE REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  client_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  deduction_amount numeric(12,2) NOT NULL DEFAULT 0,
  decision_reason text,
  decided_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (hiring_contract_id, period_start, period_end)
  $table_body$,
  ARRAY['deduction_amount']::text[]
);
SELECT pg_temp.reconcile_index(
  'public.guaranteed_nonperformance_claims',
  'guaranteed_claims_status_idx',
  'CREATE INDEX guaranteed_claims_status_idx ON guaranteed_nonperformance_claims(status);'
);

SELECT pg_temp.reconcile_table(
  'public.talent_credit_memos',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_invoice_id uuid NOT NULL REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  corrected_revision_id uuid NOT NULL REFERENCES timesheet_revisions(id) ON DELETE RESTRICT,
  talent_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  currency text NOT NULL,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (original_invoice_id, corrected_revision_id)
  $table_body$,
  ARRAY[]::text[],
  ARRAY['UNIQUE (original_invoice_id, corrected_revision_id)']::text[]
);
SELECT pg_temp.reconcile_index(
  'public.talent_credit_memos',
  'talent_credit_memos_talent_idx',
  'CREATE INDEX talent_credit_memos_talent_idx ON talent_credit_memos(talent_id, created_at);'
);

SELECT pg_temp.reconcile_table(
  'public.talent_credit_memo_applications',
  $table_body$
  credit_memo_id uuid NOT NULL REFERENCES talent_credit_memos(id) ON DELETE RESTRICT,
  talent_invoice_id uuid NOT NULL REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (credit_memo_id, talent_invoice_id)
  $table_body$
);

SELECT pg_temp.reconcile_column(
  'public.payouts',
  'talent_invoice_id',
  'uuid REFERENCES talent_invoices(id) ON DELETE RESTRICT'
);
SELECT pg_temp.reconcile_index(
  'public.payouts',
  'payouts_talent_invoice_unique',
  'CREATE UNIQUE INDEX payouts_talent_invoice_unique ON payouts(talent_invoice_id) WHERE talent_invoice_id IS NOT NULL;'
);

SELECT pg_temp.reconcile_table(
  'public.client_monthly_invoices',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  invoice_month date NOT NULL,
  currency text NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, invoice_month, currency)
  $table_body$
);

SELECT pg_temp.reconcile_table(
  'public.client_monthly_invoice_lines',
  $table_body$
  client_monthly_invoice_id uuid NOT NULL REFERENCES client_monthly_invoices(id) ON DELETE RESTRICT,
  talent_invoice_id uuid NOT NULL UNIQUE REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  talent_amount numeric(12,2) NOT NULL,
  commission_rate numeric(5,4) NOT NULL,
  client_amount numeric(12,2) NOT NULL,
  PRIMARY KEY (client_monthly_invoice_id, talent_invoice_id)
  $table_body$
);