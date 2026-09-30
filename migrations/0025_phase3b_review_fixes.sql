-- Phase 3B review fixes. These changes are additive to the already-applied
-- Talent invoice ledger; historical invoices and payouts remain untouched.

ALTER TABLE hiring_contracts
  ADD COLUMN IF NOT EXISTS effective_start_date date,
  ADD COLUMN IF NOT EXISTS billing_activated_at timestamptz;

-- Preserve the accepted offer's agreed start date on the contract. This is a
-- one-time backfill for contracts which predate the snapshot column.
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

CREATE OR REPLACE FUNCTION prevent_signed_contract_billing_start_change()
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
$$;
CREATE TRIGGER hiring_contract_billing_start_immutable
  BEFORE UPDATE OF effective_start_date, billing_activated_at ON hiring_contracts
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_billing_start_change();

ALTER TABLE talent_invoices
  ADD COLUMN IF NOT EXISTS base_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2) NOT NULL DEFAULT 0;
UPDATE talent_invoices SET base_amount = amount WHERE base_amount IS NULL;
ALTER TABLE talent_invoices ALTER COLUMN base_amount SET NOT NULL;

-- Guaranteed non-performance is a substantiated binary decision: approved
-- means no Talent invoice; rejected means the full guaranteed rate is owed.
ALTER TABLE guaranteed_nonperformance_claims DROP COLUMN IF EXISTS deduction_amount;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS payout_due_on date;
UPDATE payouts p
   SET payout_due_on = ti.payout_due_on
  FROM talent_invoices ti
 WHERE p.talent_invoice_id = ti.id
   AND p.payout_due_on IS NULL;

CREATE OR REPLACE FUNCTION protect_sent_talent_invoice()
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
$$;
CREATE TRIGGER talent_invoices_sent_immutable
  BEFORE UPDATE OR DELETE ON talent_invoices
  FOR EACH ROW EXECUTE FUNCTION protect_sent_talent_invoice();

CREATE OR REPLACE FUNCTION protect_talent_credit_memos()
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
$$;
CREATE TRIGGER talent_credit_memos_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON talent_credit_memos
  FOR EACH ROW EXECUTE FUNCTION protect_talent_credit_memos();

-- A second immutable application ledger supports partial signed adjustments
-- spanning more than one draft invoice without rewriting a prior application.
CREATE TABLE talent_credit_memo_applications_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_memo_id uuid NOT NULL REFERENCES talent_credit_memos(id) ON DELETE RESTRICT,
  talent_invoice_id uuid NOT NULL REFERENCES talent_invoices(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX talent_credit_memo_apps_v2_invoice_idx
  ON talent_credit_memo_applications_v2(talent_invoice_id);
CREATE INDEX talent_credit_memo_apps_v2_memo_idx
  ON talent_credit_memo_applications_v2(credit_memo_id);

CREATE OR REPLACE FUNCTION protect_credit_memo_application_v2()
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
$$;
CREATE TRIGGER talent_credit_memo_applications_v2_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON talent_credit_memo_applications_v2
  FOR EACH ROW EXECUTE FUNCTION protect_credit_memo_application_v2();

CREATE OR REPLACE FUNCTION protect_credit_memo_application_legacy()
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
$$;
CREATE TRIGGER talent_credit_memo_applications_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON talent_credit_memo_applications
  FOR EACH ROW EXECUTE FUNCTION protect_credit_memo_application_legacy();

-- Replenishments are explicit held-collateral ledger entries. A disbursed
-- payout remains an obligation until a same-currency replenishment is recorded.
CREATE TABLE security_deposit_replenishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_contract_id uuid NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  recorded_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_deposit_replenishments_contract_idx
  ON security_deposit_replenishments(hiring_contract_id, created_at);
CREATE OR REPLACE FUNCTION protect_security_deposit_replenishments()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security deposit replenishments are immutable';
END;
$$;
CREATE TRIGGER security_deposit_replenishments_immutable
  BEFORE UPDATE OR DELETE ON security_deposit_replenishments
  FOR EACH ROW EXECUTE FUNCTION protect_security_deposit_replenishments();

CREATE OR REPLACE FUNCTION protect_sent_client_monthly_invoices()
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
$$;
CREATE TRIGGER client_monthly_invoices_immutable
  BEFORE UPDATE OR DELETE ON client_monthly_invoices
  FOR EACH ROW EXECUTE FUNCTION protect_sent_client_monthly_invoices();

CREATE OR REPLACE FUNCTION protect_client_monthly_invoice_lines()
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
$$;
CREATE TRIGGER client_monthly_invoice_lines_immutable
  BEFORE UPDATE OR DELETE ON client_monthly_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION protect_client_monthly_invoice_lines();