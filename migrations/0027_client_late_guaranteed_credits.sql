-- Late Guaranteed nonperformance claims are a Client-side ledger, independent
-- of Talent credit memos and immutable Talent invoices.
SELECT pg_temp.reconcile_table(
  'public.client_late_guaranteed_claims',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  original_talent_invoice_id uuid NOT NULL UNIQUE REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  client_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  decision_reason text,
  decided_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (hiring_contract_id, period_start, period_end)
  $table_body$
);
SELECT pg_temp.reconcile_index(
  'public.client_late_guaranteed_claims',
  'client_late_guaranteed_claims_status_idx',
  'CREATE INDEX client_late_guaranteed_claims_status_idx ON client_late_guaranteed_claims(status, created_at);'
);

SELECT pg_temp.reconcile_table(
  'public.client_credit_memos',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  late_claim_id uuid NOT NULL UNIQUE REFERENCES client_late_guaranteed_claims(id) ON DELETE RESTRICT,
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  original_talent_invoice_id uuid NOT NULL UNIQUE REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  client_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  currency text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  all_in_amount numeric(12,2) NOT NULL CHECK (all_in_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
  $table_body$
);
SELECT pg_temp.reconcile_index(
  'public.client_credit_memos',
  'client_credit_memos_client_currency_idx',
  'CREATE INDEX client_credit_memos_client_currency_idx ON client_credit_memos(client_id, currency, period_start, created_at);'
);

SELECT pg_temp.reconcile_table(
  'public.client_credit_applications',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_credit_memo_id uuid NOT NULL REFERENCES client_credit_memos(id) ON DELETE RESTRICT,
  client_monthly_invoice_id uuid NOT NULL REFERENCES client_monthly_invoices(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_credit_memo_id, client_monthly_invoice_id)
  $table_body$
);
SELECT pg_temp.reconcile_index(
  'public.client_credit_applications',
  'client_credit_applications_invoice_idx',
  'CREATE INDEX client_credit_applications_invoice_idx ON client_credit_applications(client_monthly_invoice_id);'
);
SELECT pg_temp.reconcile_index(
  'public.client_credit_applications',
  'client_credit_applications_memo_idx',
  'CREATE INDEX client_credit_applications_memo_idx ON client_credit_applications(client_credit_memo_id);'
);

SELECT pg_temp.reconcile_function(
  'public.protect_client_late_claims',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_client_late_claims()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'late Client claims cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD.status <> 'open' OR NEW.status NOT IN ('approved', 'rejected')
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.hiring_contract_id IS DISTINCT FROM OLD.hiring_contract_id
    OR NEW.original_talent_invoice_id IS DISTINCT FROM OLD.original_talent_invoice_id
    OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.period_start IS DISTINCT FROM OLD.period_start
    OR NEW.period_end IS DISTINCT FROM OLD.period_end
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.decision_reason IS NULL OR NEW.decided_by IS NULL OR NEW.decided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'late Client claims allow only one immutable adjudication';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.client_late_guaranteed_claims',
  'client_late_claims_immutable',
  $trigger_ddl$CREATE TRIGGER client_late_claims_immutable
  BEFORE UPDATE OR DELETE ON client_late_guaranteed_claims
  FOR EACH ROW EXECUTE FUNCTION protect_client_late_claims();$trigger_ddl$
);

SELECT pg_temp.reconcile_function(
  'public.protect_client_credit_memos',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_client_credit_memos()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim_status text; invoice_status text; invoice_currency text;
        claim_contract uuid; claim_invoice uuid; claim_client text;
        claim_start date; claim_end date;
        invoice_contract uuid; invoice_client text; invoice_start date; invoice_end date;
        expected_amount numeric(12,2); invoice_base numeric(12,2); invoice_commission numeric(5,4);
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Client credit memos are immutable'; END IF;
  SELECT status, hiring_contract_id, original_talent_invoice_id, client_id, period_start, period_end
    INTO claim_status, claim_contract, claim_invoice, claim_client, claim_start, claim_end
    FROM client_late_guaranteed_claims WHERE id = NEW.late_claim_id;
  SELECT status, currency, hiring_contract_id, client_id, period_start, period_end,
         base_amount, commission_rate
    INTO invoice_status, invoice_currency, invoice_contract, invoice_client, invoice_start,
         invoice_end, invoice_base, invoice_commission
    FROM talent_invoices WHERE id = NEW.original_talent_invoice_id;
  IF claim_status IS DISTINCT FROM 'approved' OR invoice_status IS DISTINCT FROM 'sent'
     OR invoice_currency IS DISTINCT FROM NEW.currency
     OR claim_contract IS DISTINCT FROM NEW.hiring_contract_id
     OR claim_invoice IS DISTINCT FROM NEW.original_talent_invoice_id
     OR claim_client IS DISTINCT FROM NEW.client_id
     OR claim_start IS DISTINCT FROM NEW.period_start OR claim_end IS DISTINCT FROM NEW.period_end
     OR invoice_contract IS DISTINCT FROM NEW.hiring_contract_id
     OR invoice_client IS DISTINCT FROM NEW.client_id
     OR invoice_start IS DISTINCT FROM NEW.period_start OR invoice_end IS DISTINCT FROM NEW.period_end THEN
    RAISE EXCEPTION 'Client credit memo must reference an approved claim and sent same-currency invoice';
  END IF;
  SELECT client_amount INTO expected_amount
    FROM client_monthly_invoice_lines WHERE talent_invoice_id = NEW.original_talent_invoice_id;
  expected_amount := COALESCE(expected_amount, ROUND(invoice_base * (1 + invoice_commission), 2));
  IF NEW.all_in_amount IS DISTINCT FROM expected_amount THEN
    RAISE EXCEPTION 'Client credit memo must match the original all-in statement snapshot';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.client_credit_memos',
  'client_credit_memos_immutable',
  $trigger_ddl$CREATE TRIGGER client_credit_memos_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON client_credit_memos
  FOR EACH ROW EXECUTE FUNCTION protect_client_credit_memos();$trigger_ddl$
);

SELECT pg_temp.reconcile_function(
  'public.protect_client_credit_applications',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_client_credit_applications()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE statement_status text; statement_client text; statement_currency text;
        memo_client text; memo_currency text; memo_period date;
        memo_amount numeric(12,2); memo_applied numeric(12,2);
        statement_subtotal numeric(12,2); statement_applied numeric(12,2);
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Client credit applications are immutable'; END IF;
  SELECT status, client_id, currency INTO statement_status, statement_client, statement_currency
    FROM client_monthly_invoices WHERE id = NEW.client_monthly_invoice_id FOR UPDATE;
  SELECT client_id, currency, period_start, all_in_amount
    INTO memo_client, memo_currency, memo_period, memo_amount
    FROM client_credit_memos WHERE id = NEW.client_credit_memo_id FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0) INTO memo_applied
    FROM client_credit_applications WHERE client_credit_memo_id = NEW.client_credit_memo_id;
  SELECT subtotal INTO statement_subtotal
    FROM client_monthly_invoices WHERE id = NEW.client_monthly_invoice_id;
  SELECT COALESCE(SUM(amount), 0) INTO statement_applied
    FROM client_credit_applications WHERE client_monthly_invoice_id = NEW.client_monthly_invoice_id;
  IF statement_status IS DISTINCT FROM 'draft' OR statement_client IS DISTINCT FROM memo_client
     OR statement_currency IS DISTINCT FROM memo_currency THEN
    RAISE EXCEPTION 'Client credit applications must target a same-client, same-currency draft statement';
  END IF;
  IF (SELECT invoice_month FROM client_monthly_invoices WHERE id = NEW.client_monthly_invoice_id) < date_trunc('month', memo_period)::date THEN
    RAISE EXCEPTION 'Client credit applications cannot target a prior monthly statement';
  END IF;
  IF NEW.amount > memo_amount - memo_applied OR NEW.amount > statement_subtotal - statement_applied THEN
    RAISE EXCEPTION 'Client credit application exceeds remaining memo or nonnegative statement balance';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.client_credit_applications',
  'client_credit_applications_immutable',
  $trigger_ddl$CREATE TRIGGER client_credit_applications_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON client_credit_applications
  FOR EACH ROW EXECUTE FUNCTION protect_client_credit_applications();$trigger_ddl$
);