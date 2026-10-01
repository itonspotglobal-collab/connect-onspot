-- The existing immutable-snapshot triggers must protect ended contracts, too.
SELECT pg_temp.reconcile_function(
  'prevent_signed_contract_billing_start_change',
  $ddl$CREATE OR REPLACE FUNCTION prevent_signed_contract_billing_start_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('signed', 'terminated') AND (
    NEW.effective_start_date IS DISTINCT FROM OLD.effective_start_date OR
    NEW.billing_activated_at IS DISTINCT FROM OLD.billing_activated_at
  ) THEN
    RAISE EXCEPTION 'executed contract billing start is immutable';
  END IF;
  RETURN NEW;
END;
$$;$ddl$
);

SELECT pg_temp.reconcile_function(
  'prevent_signed_contract_billing_mode_change',
  $ddl$CREATE OR REPLACE FUNCTION prevent_signed_contract_billing_mode_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('signed', 'terminated') AND NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'billing mode is immutable after contract signing';
  END IF;
  RETURN NEW;
END;
$$;$ddl$
);