-- Phase 3B review fixes. These changes are additive to the already-applied
-- Talent invoice ledger; historical invoices and payouts remain untouched.

SELECT pg_temp.reconcile_column('public.hiring_contracts', 'effective_start_date', 'date');
SELECT pg_temp.reconcile_column('public.hiring_contracts', 'billing_activated_at', 'timestamptz');

-- Preserve the accepted offer's agreed start date on the contract. This is a
-- one-time backfill for contracts which predate the snapshot column.
SELECT pg_temp.pause_known_trigger(
  'public.hiring_contracts',
  'hiring_contract_billing_start_immutable',
  $trigger_ddl$CREATE TRIGGER hiring_contract_billing_start_immutable
  BEFORE UPDATE OF effective_start_date, billing_activated_at ON hiring_contracts
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_billing_start_change();$trigger_ddl$
);
UPDATE hiring_contracts hc
   SET effective_start_date = o.proposed_start_date::date
  FROM offers o
 WHERE o.id = hc.offer_id
   AND hc.effective_start_date IS NULL
   AND o.proposed_start_date IS NOT NULL;
UPDATE hiring_contracts
   SET billing_activated_at = GREATEST(
     COALESCE(onspot_signed_at, created_at),
     COALESCE(talent_signed_at, created_at)
   )
 WHERE status = 'signed' AND billing_activated_at IS NULL;
SELECT pg_temp.resume_known_trigger(
  'public.hiring_contracts',
  'hiring_contract_billing_start_immutable'
);

SELECT pg_temp.reconcile_function(
  'public.prevent_signed_contract_billing_start_change',
  $function_ddl$CREATE OR REPLACE FUNCTION prevent_signed_contract_billing_start_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'signed' AND (
    NEW.effective_start_date IS DISTINCT FROM OLD.effective_start_date OR
    NEW.billing_activated_at IS DISTINCT FROM OLD.billing_activated_at
  ) THEN
    RAISE EXCEPTION 'signed contract billing start is immutable';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.hiring_contracts',
  'hiring_contract_billing_start_immutable',
  $trigger_ddl$CREATE TRIGGER hiring_contract_billing_start_immutable
  BEFORE UPDATE OF effective_start_date, billing_activated_at ON hiring_contracts
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_billing_start_change();$trigger_ddl$
);

SELECT pg_temp.reconcile_column(
  'public.talent_invoices',
  'base_amount',
  'numeric(12,2)',
  true
);
SELECT pg_temp.reconcile_column(
  'public.talent_invoices',
  'credit_amount',
  'numeric(12,2) NOT NULL DEFAULT 0'
);
SELECT pg_temp.pause_known_trigger(
  'public.talent_invoices',
  'talent_invoices_sent_immutable',
  $trigger_ddl$CREATE TRIGGER talent_invoices_sent_immutable
  BEFORE UPDATE OR DELETE ON talent_invoices
  FOR EACH ROW EXECUTE FUNCTION protect_sent_talent_invoice();$trigger_ddl$
);
UPDATE talent_invoices SET base_amount = amount WHERE base_amount IS NULL;
SELECT pg_temp.resume_known_trigger(
  'public.talent_invoices',
  'talent_invoices_sent_immutable'
);
ALTER TABLE talent_invoices ALTER COLUMN base_amount SET NOT NULL;

-- Guaranteed non-performance is a substantiated binary decision: approved
-- means no Talent invoice; rejected means the full guaranteed rate is owed.
DO $deduction_column$
DECLARE
  nonzero_count bigint;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_attribute
     WHERE attrelid = 'public.guaranteed_nonperformance_claims'::regclass
       AND attname = 'deduction_amount'
       AND attnum > 0
       AND NOT attisdropped
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM public.guaranteed_nonperformance_claims WHERE deduction_amount <> 0'
      INTO nonzero_count;
    IF nonzero_count > 0 THEN
      RAISE EXCEPTION
        'Cannot drop guaranteed_nonperformance_claims.deduction_amount: % nonzero rows require review; diagnostic review needed',
        nonzero_count;
    END IF;
    ALTER TABLE public.guaranteed_nonperformance_claims DROP COLUMN deduction_amount;
  END IF;
END;
$deduction_column$;

SELECT pg_temp.reconcile_column('public.payouts', 'payout_due_on', 'date');
UPDATE payouts p
   SET payout_due_on = ti.payout_due_on
  FROM talent_invoices ti
 WHERE p.talent_invoice_id = ti.id
   AND p.payout_due_on IS NULL;

SELECT pg_temp.reconcile_function(
  'public.protect_sent_talent_invoice',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_sent_talent_invoice()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'sent' THEN
    RAISE EXCEPTION 'sent Talent invoices are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN
    RAISE EXCEPTION 'sent Talent invoices are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.talent_invoices',
  'talent_invoices_sent_immutable',
  $trigger_ddl$CREATE TRIGGER talent_invoices_sent_immutable
  BEFORE UPDATE OR DELETE ON talent_invoices
  FOR EACH ROW EXECUTE FUNCTION protect_sent_talent_invoice();$trigger_ddl$
);

SELECT pg_temp.reconcile_function(
  'public.protect_talent_credit_memos',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_talent_credit_memos()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Talent credit memos are immutable';
  END IF;
  SELECT status INTO original_status FROM talent_invoices WHERE id = NEW.original_invoice_id;
  IF original_status IS DISTINCT FROM 'sent' THEN
    RAISE EXCEPTION 'Talent credit memos must refer to a sent invoice';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.talent_credit_memos',
  'talent_credit_memos_immutable',
  $trigger_ddl$CREATE TRIGGER talent_credit_memos_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON talent_credit_memos
  FOR EACH ROW EXECUTE FUNCTION protect_talent_credit_memos();$trigger_ddl$
);

-- A second immutable application ledger supports partial signed adjustments
-- spanning more than one draft invoice without rewriting a prior application.
SELECT pg_temp.reconcile_table(
  'public.talent_credit_memo_applications_v2',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_memo_id uuid NOT NULL REFERENCES talent_credit_memos(id) ON DELETE RESTRICT,
  talent_invoice_id uuid NOT NULL REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  created_at timestamptz NOT NULL DEFAULT now()
  $table_body$
);
SELECT pg_temp.reconcile_index(
  'public.talent_credit_memo_applications_v2',
  'talent_credit_memo_apps_v2_invoice_idx',
  'CREATE INDEX talent_credit_memo_apps_v2_invoice_idx ON talent_credit_memo_applications_v2(talent_invoice_id);'
);
SELECT pg_temp.reconcile_index(
  'public.talent_credit_memo_applications_v2',
  'talent_credit_memo_apps_v2_memo_idx',
  'CREATE INDEX talent_credit_memo_apps_v2_memo_idx ON talent_credit_memo_applications_v2(credit_memo_id);'
);

SELECT pg_temp.reconcile_function(
  'public.protect_credit_memo_application_v2',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_credit_memo_application_v2()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'credit memo applications are immutable';
  END IF;
  SELECT status INTO invoice_status FROM talent_invoices WHERE id = NEW.talent_invoice_id;
  IF invoice_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'credit memo applications must target an unsent Talent invoice draft';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.talent_credit_memo_applications_v2',
  'talent_credit_memo_applications_v2_immutable',
  $trigger_ddl$CREATE TRIGGER talent_credit_memo_applications_v2_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON talent_credit_memo_applications_v2
  FOR EACH ROW EXECUTE FUNCTION protect_credit_memo_application_v2();$trigger_ddl$
);

SELECT pg_temp.reconcile_function(
  'public.protect_credit_memo_application_legacy',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_credit_memo_application_legacy()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'credit memo applications are immutable';
  END IF;
  SELECT status INTO invoice_status FROM talent_invoices WHERE id = NEW.talent_invoice_id;
  IF invoice_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'credit memo applications must target an unsent Talent invoice draft';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.talent_credit_memo_applications',
  'talent_credit_memo_applications_immutable',
  $trigger_ddl$CREATE TRIGGER talent_credit_memo_applications_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON talent_credit_memo_applications
  FOR EACH ROW EXECUTE FUNCTION protect_credit_memo_application_legacy();$trigger_ddl$
);

-- Replenishments are explicit held-collateral ledger entries. A disbursed
-- payout remains an obligation until a same-currency replenishment is recorded.
SELECT pg_temp.reconcile_table(
  'public.security_deposit_replenishments',
  $table_body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  recorded_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
  $table_body$
);
SELECT pg_temp.reconcile_index(
  'public.security_deposit_replenishments',
  'security_deposit_replenishments_contract_idx',
  'CREATE INDEX security_deposit_replenishments_contract_idx ON security_deposit_replenishments(hiring_contract_id, created_at);'
);
SELECT pg_temp.reconcile_function(
  'public.protect_security_deposit_replenishments',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_security_deposit_replenishments()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security deposit replenishments are immutable';
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.security_deposit_replenishments',
  'security_deposit_replenishments_immutable',
  $trigger_ddl$CREATE TRIGGER security_deposit_replenishments_immutable
  BEFORE UPDATE OR DELETE ON security_deposit_replenishments
  FOR EACH ROW EXECUTE FUNCTION protect_security_deposit_replenishments();$trigger_ddl$
);

SELECT pg_temp.reconcile_function(
  'public.protect_sent_client_monthly_invoices',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_sent_client_monthly_invoices()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'sent' THEN
    RAISE EXCEPTION 'sent Client monthly invoices are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN
    RAISE EXCEPTION 'sent Client monthly invoices are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.client_monthly_invoices',
  'client_monthly_invoices_immutable',
  $trigger_ddl$CREATE TRIGGER client_monthly_invoices_immutable
  BEFORE UPDATE OR DELETE ON client_monthly_invoices
  FOR EACH ROW EXECUTE FUNCTION protect_sent_client_monthly_invoices();$trigger_ddl$
);

SELECT pg_temp.reconcile_function(
  'public.protect_client_monthly_invoice_lines',
  $function_ddl$CREATE OR REPLACE FUNCTION protect_client_monthly_invoice_lines()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Client monthly invoice lines are immutable';
  END IF;
  SELECT status INTO invoice_status
    FROM client_monthly_invoices WHERE id = NEW.client_monthly_invoice_id;
  IF invoice_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Client monthly invoice lines can only be added before the invoice is sent';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);
SELECT pg_temp.reconcile_trigger(
  'public.client_monthly_invoice_lines',
  'client_monthly_invoice_lines_immutable',
  $trigger_ddl$CREATE TRIGGER client_monthly_invoice_lines_immutable
  BEFORE UPDATE OR DELETE ON client_monthly_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION protect_client_monthly_invoice_lines();$trigger_ddl$,
  ARRAY[31]::smallint[],
  false
);