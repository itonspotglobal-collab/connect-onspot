-- Separate from recurring invoices, Talent invoices and security deposits.
CREATE TABLE IF NOT EXISTS hiring_fee_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency = 'USD'),
  fee_basis text NOT NULL CHECK (fee_basis = 'fixed_per_hiring_attempt'),
  fee_description text NOT NULL CHECK (length(trim(fee_description)) > 0),
  tax_treatment text NOT NULL CHECK (tax_treatment IN ('inclusive','exempt')),
  tax_description text NOT NULL CHECK (length(trim(tax_description)) > 0),
  due_days integer NOT NULL CHECK (due_days BETWEEN 1 AND 90),
  payment_method text NOT NULL CHECK (payment_method = 'manual_transfer'),
  payment_recipient text NOT NULL CHECK (length(trim(payment_recipient)) > 0),
  payment_instructions text NOT NULL CHECK (length(trim(payment_instructions)) > 0),
  authorized_by varchar NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hiring_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id varchar NOT NULL UNIQUE REFERENCES job_submissions(id),
  job_id varchar NOT NULL REFERENCES jobs(id),
  client_id varchar NOT NULL REFERENCES users(id),
  talent_id varchar NOT NULL REFERENCES users(id),
  ready_by varchar NOT NULL REFERENCES users(id),
  ready_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS hiring_pre_offer_invoice_number_seq;
CREATE TABLE IF NOT EXISTS hiring_pre_offer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_type text NOT NULL DEFAULT 'hiring_pre_offer' CHECK (invoice_type = 'hiring_pre_offer'),
  attempt_id uuid NOT NULL REFERENCES hiring_payment_attempts(id),
  submission_id varchar NOT NULL REFERENCES job_submissions(id),
  job_id varchar NOT NULL REFERENCES jobs(id),
  client_id varchar NOT NULL REFERENCES users(id),
  talent_id varchar NOT NULL REFERENCES users(id),
  invoice_number text NOT NULL UNIQUE DEFAULT
    ('HPO-' || lpad(nextval('hiring_pre_offer_invoice_number_seq')::text, 8, '0')),
  policy_id uuid NOT NULL REFERENCES hiring_fee_policies(id),
  fee_description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency = 'USD'),
  fee_basis text NOT NULL,
  tax_treatment text NOT NULL,
  tax_description text NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK
    (status IN ('draft','issued','verification_pending','paid','overdue','void','payment_failed','refunded','invalidated')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL,
  payment_method text NOT NULL,
  payment_recipient text NOT NULL,
  payment_instructions text NOT NULL,
  payment_reference text,
  verified_amount numeric(14,2),
  verified_currency text,
  verified_reference text,
  verified_recipient text,
  verified_at timestamptz,
  verified_by varchar REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'paid' OR
    (verified_at IS NOT NULL AND verified_by IS NOT NULL
     AND verified_amount = amount AND verified_currency = currency
     AND verified_reference IS NOT NULL AND verified_recipient = payment_recipient))
);
CREATE UNIQUE INDEX IF NOT EXISTS hiring_pre_offer_one_active_attempt
  ON hiring_pre_offer_invoices(attempt_id)
  WHERE status NOT IN ('void','refunded','invalidated');
CREATE UNIQUE INDEX IF NOT EXISTS hiring_pre_offer_unique_settlement
  ON hiring_pre_offer_invoices(payment_method,verified_reference) WHERE verified_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS hiring_pre_offer_client_status ON hiring_pre_offer_invoices(client_id,status);
CREATE TABLE IF NOT EXISTS hiring_payment_events (
  id serial PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES hiring_pre_offer_invoices(id),
  actor_id varchar NOT NULL REFERENCES users(id),
  event text NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hiring_payment_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id varchar NOT NULL REFERENCES job_submissions(id),
  offer_id uuid REFERENCES offers(id),
  invoice_id uuid REFERENCES hiring_pre_offer_invoices(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hiring_payment_exception_offer
 ON hiring_payment_exceptions(offer_id) WHERE offer_id IS NOT NULL;
INSERT INTO hiring_payment_exceptions(submission_id,offer_id,reason)
 SELECT submission_id,id,'historical_offer_payment_unknown_review_required' FROM offers
 ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION hiring_payment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Hiring payment evidence/policy history is immutable' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS hiring_payment_events_immutable ON hiring_payment_events;
CREATE TRIGGER hiring_payment_events_immutable BEFORE UPDATE OR DELETE ON hiring_payment_events
 FOR EACH ROW EXECUTE FUNCTION hiring_payment_immutable();
DROP TRIGGER IF EXISTS hiring_fee_policies_immutable ON hiring_fee_policies;
CREATE TRIGGER hiring_fee_policies_immutable BEFORE UPDATE OR DELETE ON hiring_fee_policies
 FOR EACH ROW EXECUTE FUNCTION hiring_payment_immutable();
DROP TRIGGER IF EXISTS hiring_payment_attempts_immutable ON hiring_payment_attempts;
CREATE TRIGGER hiring_payment_attempts_immutable BEFORE UPDATE OR DELETE ON hiring_payment_attempts
 FOR EACH ROW EXECUTE FUNCTION hiring_payment_immutable();

-- Preserve issued financial terms and the original attempt identity.
CREATE OR REPLACE FUNCTION protect_hiring_invoice_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   RAISE EXCEPTION 'Hiring invoices cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF (to_jsonb(NEW) - ARRAY['status','payment_reference','verified_amount','verified_currency',
     'verified_reference','verified_recipient','verified_at','verified_by','updated_at'])
    IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['status','payment_reference','verified_amount','verified_currency',
     'verified_reference','verified_recipient','verified_at','verified_by','updated_at']) THEN
   RAISE EXCEPTION 'Issued hiring invoice terms are immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.verified_at IS NOT NULL AND
    (NEW.verified_at,NEW.verified_by,NEW.verified_amount,NEW.verified_currency,NEW.verified_reference,NEW.verified_recipient)
     IS DISTINCT FROM
    (OLD.verified_at,OLD.verified_by,OLD.verified_amount,OLD.verified_currency,OLD.verified_reference,OLD.verified_recipient) THEN
   RAISE EXCEPTION 'Verified payment evidence is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hiring_invoice_snapshot_guard ON hiring_pre_offer_invoices;
CREATE TRIGGER hiring_invoice_snapshot_guard BEFORE UPDATE OR DELETE ON hiring_pre_offer_invoices
 FOR EACH ROW EXECUTE FUNCTION protect_hiring_invoice_snapshot();

-- Drizzle/Publish may have precreated tables. Install the SQL-only paid constraint
-- explicitly as well; CREATE TABLE IF NOT EXISTS does not reconcile constraints.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='hiring_pre_offer_paid_evidence_check'
    AND conrelid='hiring_pre_offer_invoices'::regclass) THEN
  ALTER TABLE hiring_pre_offer_invoices ADD CONSTRAINT hiring_pre_offer_paid_evidence_check
   CHECK (status<>'paid' OR (verified_at IS NOT NULL AND verified_by IS NOT NULL
    AND verified_amount IS NOT NULL AND verified_amount=amount
    AND verified_currency IS NOT NULL AND verified_currency=currency
    AND verified_reference IS NOT NULL AND length(trim(verified_reference))>0
    AND verified_recipient IS NOT NULL AND verified_recipient=payment_recipient));
 END IF;
END $$;

-- Every formal offer insertion/new-send, including future Admin-assisted writers,
-- must have paid evidence. Historical response/execution updates are preserved.
CREATE OR REPLACE FUNCTION enforce_hiring_pre_offer_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s record;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF NEW.submission_id IS DISTINCT FROM OLD.submission_id THEN
     RAISE EXCEPTION 'Offer submission identity is immutable' USING ERRCODE='23514';
   END IF;
   IF NEW.status <> 'sent' OR
      (OLD.status = 'sent' AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at) THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO s FROM job_submissions WHERE id=NEW.submission_id FOR UPDATE;
 IF NOT EXISTS (
   SELECT 1 FROM hiring_pre_offer_invoices i
   JOIN hiring_payment_attempts a ON a.id=i.attempt_id
   WHERE i.submission_id=s.id AND a.submission_id=s.id
     AND i.client_id=s.client_id AND a.client_id=s.client_id
     AND i.job_id=s.job_id AND a.job_id=s.job_id
     AND i.talent_id=s.talent_id AND a.talent_id=s.talent_id
     AND i.invoice_type='hiring_pre_offer' AND i.status='paid'
     AND i.amount>0 AND i.verified_amount=i.amount AND i.verified_currency=i.currency
     AND i.verified_at IS NOT NULL AND i.verified_by IS NOT NULL
     AND length(trim(i.verified_reference))>0 AND i.verified_recipient=i.payment_recipient
   FOR SHARE OF i
 ) THEN
   RAISE EXCEPTION 'PRE_OFFER_PAYMENT_REQUIRED' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS offers_pre_offer_payment_guard ON offers;
CREATE TRIGGER offers_pre_offer_payment_guard BEFORE INSERT OR UPDATE ON offers
 FOR EACH ROW EXECUTE FUNCTION enforce_hiring_pre_offer_payment();
