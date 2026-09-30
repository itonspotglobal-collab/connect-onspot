-- Provider-neutral account references; no funds or credentials are stored here.
-- An absent row means not_connected. Do not pre-create rows for all users.
CREATE TABLE IF NOT EXISTS payment_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('client', 'talent')),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name text,
  external_account_id text,
  status text NOT NULL DEFAULT 'not_connected'
    CHECK (status IN ('not_connected', 'pending', 'active', 'restricted')),
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_accounts_owner_unique
  ON payment_provider_accounts (owner_type, owner_id);

-- Prevent the same provider account from being assigned to multiple owners.
CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_accounts_external_unique
  ON payment_provider_accounts (provider_name, external_account_id)
  WHERE provider_name IS NOT NULL AND external_account_id IS NOT NULL;

-- These references are separate from external_ref, which still supports the
-- existing semi-manual wire/card receipt and payout reference workflows.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS external_charge_id text;

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS external_transfer_id text;