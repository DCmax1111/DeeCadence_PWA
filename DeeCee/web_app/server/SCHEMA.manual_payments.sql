-- DeeCee manual transfer checkout support.
-- Run after the base Supabase schema if these columns/constraints do not exist yet.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

DO $$
BEGIN
  ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_status_check;

  ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'successful', 'succeeded', 'failed', 'abandoned', 'refunded', 'expired'));

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_type_check
      CHECK (transaction_type IN ('subscription', 'top_up', 'payout'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_amount_positive_check
      CHECK (amount > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_user_provider_status
  ON public.transactions(user_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON public.transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT,
  event_type TEXT NOT NULL,
  signature_valid BOOLEAN DEFAULT false,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.plans (product, tier, price_monthly, currency, features, max_users, max_ledger_entries)
VALUES
  ('deecee', 'starter', 9.99, 'USD', '{"sandbox_checkout": true, "manual_checkout": true, "tier": "starter"}', 1, NULL),
  ('deecee', 'growth', 19.99, 'USD', '{"sandbox_checkout": true, "manual_checkout": true, "tier": "growth"}', 1, NULL),
  ('deecee', 'operator', 39.99, 'USD', '{"sandbox_checkout": true, "manual_checkout": true, "tier": "operator"}', 1, NULL)
ON CONFLICT (product, tier) DO UPDATE
SET price_monthly = EXCLUDED.price_monthly,
    currency = EXCLUDED.currency,
    features = EXCLUDED.features,
    updated_at = now();
