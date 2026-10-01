-- Billing mode is explicit and independent of engagement_type. Legacy rows
-- remain NULL until a client/admin edits and classifies them.
SELECT pg_temp.reconcile_column('public.jobs', 'billing_mode', 'text');
SELECT pg_temp.reconcile_column('public.offers', 'billing_mode', 'text');
SELECT pg_temp.reconcile_column('public.hiring_contracts', 'billing_mode', 'text');

SELECT pg_temp.reconcile_constraint(
  'public.jobs',
  'jobs_billing_mode_check',
  'CHECK (billing_mode IS NULL OR billing_mode IN (''tracked'', ''guaranteed''))'
);
SELECT pg_temp.reconcile_constraint(
  'public.offers',
  'offers_billing_mode_check',
  'CHECK (billing_mode IS NULL OR billing_mode IN (''tracked'', ''guaranteed''))'
);
SELECT pg_temp.reconcile_constraint(
  'public.hiring_contracts',
  'hiring_contracts_billing_mode_check',
  'CHECK (billing_mode IS NULL OR billing_mode IN (''tracked'', ''guaranteed''))'
);

SELECT pg_temp.reconcile_function(
  'public.prevent_offer_billing_mode_change',
  $function_ddl$CREATE OR REPLACE FUNCTION prevent_offer_billing_mode_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'offer billing mode is immutable';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);

SELECT pg_temp.reconcile_trigger(
  'public.offers',
  'offers_billing_mode_immutable',
  $trigger_ddl$CREATE TRIGGER offers_billing_mode_immutable
  BEFORE UPDATE OF billing_mode ON offers
  FOR EACH ROW EXECUTE FUNCTION prevent_offer_billing_mode_change();$trigger_ddl$
);

SELECT pg_temp.reconcile_function(
  'public.prevent_signed_contract_billing_mode_change',
  $function_ddl$CREATE OR REPLACE FUNCTION prevent_signed_contract_billing_mode_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'signed' AND NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'billing mode is immutable after contract signing';
  END IF;
  RETURN NEW;
END;
$$;$function_ddl$
);

SELECT pg_temp.reconcile_trigger(
  'public.hiring_contracts',
  'hiring_contracts_billing_mode_immutable',
  $trigger_ddl$CREATE TRIGGER hiring_contracts_billing_mode_immutable
  BEFORE UPDATE OF billing_mode ON hiring_contracts
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_billing_mode_change();$trigger_ddl$
);