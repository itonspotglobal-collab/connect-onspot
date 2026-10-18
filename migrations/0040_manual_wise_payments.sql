-- Additive manual settlement evidence. No payment gateway and no historical backfill.
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS payment_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE client_monthly_invoices ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','paid'));
ALTER TABLE client_monthly_invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;
-- Existing replenishment rows already represented manually recorded settled funding.
-- New top-ups are explicitly inserted unpaid and do not count as coverage.
ALTER TABLE security_deposit_replenishments ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid'
  CHECK (payment_status IN ('unpaid','paid'));
ALTER TABLE security_deposit_replenishments ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE TABLE IF NOT EXISTS manual_wise_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('receipt','qr')),
  object_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/png','image/jpeg','image/webp','application/pdf')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 8388608),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS manual_wise_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  recipient text NOT NULL CHECK (length(btrim(recipient)) BETWEEN 1 AND 500),
  instructions text NOT NULL CHECK (length(btrim(instructions)) BETWEEN 1 AND 4000),
  reference_instructions text NOT NULL DEFAULT '',
  qr_file_id uuid REFERENCES manual_wise_files(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT false,
  deposit_funding_confirmed boolean NOT NULL DEFAULT false,
  created_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS manual_wise_active_currency
  ON manual_wise_config(currency) WHERE active;
CREATE TABLE IF NOT EXISTS manual_wise_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('inquiry','hiring_invoice','invoice','monthly_invoice','deposit','replenishment','payout')),
  inquiry_id varchar UNIQUE REFERENCES inquiries(id) ON DELETE RESTRICT,
  hiring_invoice_id uuid UNIQUE REFERENCES hiring_pre_offer_invoices(id) ON DELETE RESTRICT,
  invoice_id uuid UNIQUE REFERENCES invoices(id) ON DELETE RESTRICT,
  monthly_invoice_id uuid UNIQUE REFERENCES client_monthly_invoices(id) ON DELETE RESTRICT,
  deposit_id uuid UNIQUE REFERENCES security_deposits(id) ON DELETE RESTRICT,
  replenishment_id uuid UNIQUE REFERENCES security_deposit_replenishments(id) ON DELETE RESTRICT,
  payout_id uuid UNIQUE REFERENCES payouts(id) ON DELETE RESTRICT,
  payer_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  config_id uuid REFERENCES manual_wise_config(id) ON DELETE RESTRICT,
  approved_destination text,
  destination_approved_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  destination_approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(inquiry_id,hiring_invoice_id,invoice_id,monthly_invoice_id,deposit_id,replenishment_id,payout_id)=1),
  CHECK (
    (category='inquiry' AND inquiry_id IS NOT NULL) OR
    (category='hiring_invoice' AND hiring_invoice_id IS NOT NULL) OR
    (category='invoice' AND invoice_id IS NOT NULL) OR
    (category='monthly_invoice' AND monthly_invoice_id IS NOT NULL) OR
    (category='deposit' AND deposit_id IS NOT NULL) OR
    (category='replenishment' AND replenishment_id IS NOT NULL) OR
    (category='payout' AND payout_id IS NOT NULL)),
  CHECK ((approved_destination IS NULL AND destination_approved_by IS NULL AND destination_approved_at IS NULL)
    OR (category='payout' AND length(btrim(approved_destination))>0
      AND destination_approved_by IS NOT NULL AND destination_approved_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS manual_wise_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES manual_wise_obligations(id) ON DELETE RESTRICT,
  submitted_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount>0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reference text NOT NULL CHECK (length(btrim(reference)) BETWEEN 1 AND 500),
  recipient text NOT NULL,
  receipt_id uuid NOT NULL UNIQUE REFERENCES manual_wise_files(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'verification_pending' CHECK (status IN ('verification_pending','paid','rejected')),
  rejection_reason text,
  verified_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz,
  verified_amount numeric(12,2),
  verified_currency text,
  verified_reference text,
  verified_recipient text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status<>'paid' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL
    AND verified_amount IS NOT NULL AND verified_currency IS NOT NULL AND verified_recipient IS NOT NULL
    AND verified_amount=amount AND verified_currency=currency
    AND verified_reference IS NOT NULL AND length(btrim(verified_reference))>0
    AND verified_recipient=recipient AND settled_at IS NOT NULL)),
  CHECK (status<>'rejected' OR (rejection_reason IS NOT NULL AND length(btrim(rejection_reason))>0))
);
CREATE UNIQUE INDEX IF NOT EXISTS manual_wise_one_live_attempt
  ON manual_wise_submissions(obligation_id) WHERE status IN ('verification_pending','paid');
-- References are globally unique, including legacy hiring settlements (service checks both).
CREATE UNIQUE INDEX IF NOT EXISTS manual_wise_unique_settlement
  ON manual_wise_submissions(lower(btrim(verified_reference))) WHERE status='paid';
CREATE INDEX IF NOT EXISTS manual_wise_review_queue ON manual_wise_submissions(status,created_at);
CREATE INDEX IF NOT EXISTS manual_wise_owner ON manual_wise_obligations(payer_id,category);
CREATE TABLE IF NOT EXISTS manual_wise_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid REFERENCES manual_wise_obligations(id) ON DELETE RESTRICT,
  submission_id uuid REFERENCES manual_wise_submissions(id) ON DELETE RESTRICT,
  actor_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
