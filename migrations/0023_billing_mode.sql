-- Billing mode is explicit and independent of engagement_type. Legacy rows
-- remain NULL until a client/admin edits and classifies them.
ALTER TABLE jobs ADD COLUMN billing_mode text;
ALTER TABLE offers ADD COLUMN billing_mode text;
ALTER TABLE hiring_contracts ADD COLUMN billing_mode text;

ALTER TABLE jobs ADD CONSTRAINT jobs_billing_mode_check
  CHECK (billing_mode IS NULL OR billing_mode IN ('tracked', 'guaranteed'));
ALTER TABLE offers ADD CONSTRAINT offers_billing_mode_check
  CHECK (billing_mode IS NULL OR billing_mode IN ('tracked', 'guaranteed'));
ALTER TABLE hiring_contracts ADD CONSTRAINT hiring_contracts_billing_mode_check
  CHECK (billing_mode IS NULL OR billing_mode IN ('tracked', 'guaranteed'));

CREATE OR REPLACE FUNCTION prevent_offer_billing_mode_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'offer billing mode is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER offers_billing_mode_immutable
  BEFORE UPDATE OF billing_mode ON offers
  FOR EACH ROW EXECUTE FUNCTION prevent_offer_billing_mode_change();

CREATE OR REPLACE FUNCTION prevent_signed_contract_billing_mode_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'signed' AND NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'billing mode is immutable after contract signing';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hiring_contracts_billing_mode_immutable
  BEFORE UPDATE OF billing_mode ON hiring_contracts
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_billing_mode_change();