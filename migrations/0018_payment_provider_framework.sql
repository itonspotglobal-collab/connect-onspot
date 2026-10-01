-- Provider-neutral account references; no funds or credentials are stored here.
-- An absent row means not_connected. Do not pre-create rows for all users.
SELECT pg_temp.reconcile_table('public.payment_provider_accounts', $body$
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('client', 'talent')),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name text,
  external_account_id text,
  status text NOT NULL DEFAULT 'not_connected'
    CHECK (status IN ('not_connected', 'pending', 'active', 'restricted')),
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
$body$);

SELECT pg_temp.reconcile_index(
  'public.payment_provider_accounts',
  'payment_provider_accounts_owner_unique',
  $ddl$CREATE UNIQUE INDEX payment_provider_accounts_owner_unique
    ON payment_provider_accounts (owner_type, owner_id);$ddl$
);

-- Prevent the same provider account from being assigned to multiple owners.
SELECT pg_temp.reconcile_index(
  'public.payment_provider_accounts',
  'payment_provider_accounts_external_unique',
  $ddl$CREATE UNIQUE INDEX payment_provider_accounts_external_unique
    ON payment_provider_accounts (provider_name, external_account_id)
    WHERE provider_name IS NOT NULL AND external_account_id IS NOT NULL;$ddl$
);

-- These references are separate from external_ref, which still supports the
-- existing semi-manual wire/card receipt and payout reference workflows.
SELECT pg_temp.reconcile_column('public.invoices', 'payment_provider', 'text');
SELECT pg_temp.reconcile_column('public.invoices', 'external_charge_id', 'text');

SELECT pg_temp.reconcile_column('public.payouts', 'payment_provider', 'text');
SELECT pg_temp.reconcile_column('public.payouts', 'external_transfer_id', 'text');