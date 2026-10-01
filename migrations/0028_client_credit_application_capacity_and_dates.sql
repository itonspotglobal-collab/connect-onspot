-- Fix capacity accounting for multiple Client credit memos and prevent late
-- credits from being applied retroactively after their source statement sent.
SELECT pg_temp.reconcile_function(
  'public.protect_client_credit_applications',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_client_credit_applications()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  statement_status text;
  statement_client text;
  statement_currency text;
  statement_subtotal numeric(12,2);
  gross_line_total numeric(12,2);
  statement_applied numeric(12,2);
  memo_client text;
  memo_currency text;
  memo_period_start date;
  memo_amount numeric(12,2);
  memo_created_at timestamptz;
  memo_original_invoice_id uuid;
  memo_applied numeric(12,2);
  statement_month date;
  source_month date;
  approval_month date;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Client credit applications are immutable';
  END IF;

  SELECT status, client_id, currency, subtotal, invoice_month
    INTO statement_status, statement_client, statement_currency, statement_subtotal, statement_month
    FROM client_monthly_invoices WHERE id = NEW.client_monthly_invoice_id FOR UPDATE;
  SELECT client_id, currency, period_start, all_in_amount, created_at, original_talent_invoice_id
    INTO memo_client, memo_currency, memo_period_start, memo_amount, memo_created_at, memo_original_invoice_id
    FROM client_credit_memos WHERE id = NEW.client_credit_memo_id FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO memo_applied
    FROM client_credit_applications WHERE client_credit_memo_id = NEW.client_credit_memo_id;
  SELECT COALESCE(SUM(amount), 0) INTO statement_applied
    FROM client_credit_applications WHERE client_monthly_invoice_id = NEW.client_monthly_invoice_id;
  SELECT COALESCE(SUM(client_amount), 0) INTO gross_line_total
    FROM client_monthly_invoice_lines WHERE client_monthly_invoice_id = NEW.client_monthly_invoice_id;

  IF statement_status IS DISTINCT FROM 'draft'
     OR statement_client IS DISTINCT FROM memo_client
     OR statement_currency IS DISTINCT FROM memo_currency THEN
    RAISE EXCEPTION 'Client credit applications must target a same-client, same-currency draft statement';
  END IF;

  source_month := date_trunc('month', memo_period_start)::date;
  approval_month := date_trunc(
    'month', memo_created_at AT TIME ZONE 'America/New_York'
  )::date;
  IF statement_month = source_month THEN
    IF EXISTS (
      SELECT 1
        FROM client_monthly_invoice_lines source_line
        JOIN client_monthly_invoices source_statement
          ON source_statement.id = source_line.client_monthly_invoice_id
       WHERE source_line.talent_invoice_id = memo_original_invoice_id
         AND source_statement.status = 'sent'
    ) THEN
      RAISE EXCEPTION 'A sent original-month statement cannot receive a late Client credit';
    END IF;
  ELSIF statement_month <= source_month OR statement_month < approval_month THEN
    RAISE EXCEPTION 'Late Client credits must target an eligible statement at or after approval month';
  END IF;

  -- Invoice lines are the immutable gross snapshot. The statement subtotal may
  -- already be net of previously applied credits, so subtract prior credits
  -- from gross line total exactly once.
  IF gross_line_total = 0 THEN
    gross_line_total := statement_subtotal + statement_applied;
  END IF;
  IF NEW.amount > memo_amount - memo_applied
     OR NEW.amount > gross_line_total - statement_applied THEN
    RAISE EXCEPTION 'Client credit application exceeds remaining memo or nonnegative statement balance';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);