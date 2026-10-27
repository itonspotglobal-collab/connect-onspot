-- Prospective policy change only. Never rewrite historical contracts or charges.
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz DEFAULT now()
);
INSERT INTO platform_settings(key,value)
VALUES ('HIRING_PRE_OFFER_PAYMENT_REQUIRED','false') ON CONFLICT(key) DO NOTHING;

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
 IF NOT COALESCE((SELECT value::boolean FROM platform_settings
     WHERE key='HIRING_PRE_OFFER_PAYMENT_REQUIRED'),false) THEN RETURN NEW; END IF;
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
 ) THEN RAISE EXCEPTION 'PRE_OFFER_PAYMENT_REQUIRED' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;

ALTER TABLE job_submissions DROP CONSTRAINT IF EXISTS job_submissions_status_check;
ALTER TABLE job_submissions ADD CONSTRAINT job_submissions_status_check CHECK (
 status IN ('new','invited','declined','withdrawn','under_review','reviewed','shortlisted',
 'rejected','interviewing','offer_extended','offer_expired','offer_accepted','offer_declined',
 'contract_sent','contract_signed','hired')
);

-- A durable, transactionally enqueued event. External work starts after commit.
CREATE TABLE IF NOT EXISTS hiring_lifecycle_events (
 event_key text PRIMARY KEY,
 event_type text NOT NULL,
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),
 attempts integer NOT NULL DEFAULT 0,
 attempted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hiring_lifecycle_events_pending ON hiring_lifecycle_events(status,created_at);

-- Invoice identity on the existing deposit, not a parallel payable/debt.
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS invoice_number text;
CREATE UNIQUE INDEX IF NOT EXISTS security_deposits_invoice_number_unique
 ON security_deposits(invoice_number) WHERE invoice_number IS NOT NULL;
