-- Investor inquiries are separate from BPO leads and service purchases.
-- Do not store these submissions only in email: failed delivery must not lose them.
CREATE TABLE IF NOT EXISTS public.investor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  firm text NOT NULL CHECK (btrim(firm) <> ''),
  email varchar(254) NOT NULL CHECK (btrim(email) <> ''),
  request_type text NOT NULL CHECK (request_type IN ('meeting', 'deck', 'founder')),
  message text,
  notification_status text NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending', 'sent', 'failed')),
  notification_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  notification_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_investor_requests_created_at
  ON public.investor_requests (created_at DESC);