-- Per-application exceptions only; never mutate the global policy or settlement.
CREATE TABLE IF NOT EXISTS hiring_payment_waivers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submission_id text NOT NULL REFERENCES job_submissions(id),
 client_id text NOT NULL REFERENCES users(id),
 job_id text NOT NULL REFERENCES jobs(id),
 talent_id text NOT NULL REFERENCES users(id),
 waiver_type text NOT NULL CHECK (waiver_type IN ('defer','waive')),
 reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
 arrangement_note text,
 granted_by text NOT NULL REFERENCES users(id),
 granted_at timestamptz NOT NULL DEFAULT now(),
 revoked_by text REFERENCES users(id), revoked_at timestamptz, revoke_reason text,
 locked_at timestamptz,
 deferred_payment_required boolean NOT NULL DEFAULT false,
 deferred_invoice_id uuid REFERENCES hiring_pre_offer_invoices(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS hiring_payment_waivers_active_submission
 ON hiring_payment_waivers(submission_id) WHERE revoked_at IS NULL;

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
 IF EXISTS(SELECT 1 FROM hiring_payment_waivers w WHERE w.submission_id=s.id
   AND w.client_id=s.client_id AND w.job_id=s.job_id AND w.talent_id=s.talent_id
   AND w.revoked_at IS NULL FOR SHARE OF w) THEN RETURN NEW; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM hiring_pre_offer_invoices i JOIN hiring_payment_attempts a ON a.id=i.attempt_id
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
