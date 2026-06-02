-- DeeCee complete Supabase schema
-- Run this once in Supabase SQL Editor before testing checkout.
-- auth.users is managed by Supabase Auth; this file creates public app tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  subscription_plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plans (
  id SERIAL PRIMARY KEY,
  product TEXT NOT NULL,
  tier TEXT NOT NULL,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  features JSONB DEFAULT '{}',
  max_users INT,
  max_ledger_entries INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product, tier)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id INT NOT NULL REFERENCES public.plans(id),
  status TEXT DEFAULT 'active',
  provider TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  provider_customer_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_subscription_id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  provider_customer_id TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'pending',
  transaction_type TEXT DEFAULT 'subscription',
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_transaction_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_status_check
      CHECK (status IN ('active', 'trialing', 'past_due', 'canceled'));
  END IF;

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

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_plans_product_tier
  ON public.plans(product, tier);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
  ON public.transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_provider
  ON public.transactions(provider);

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

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_created
  ON public.webhook_events(provider, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'users_view_own_profile'
  ) THEN
    CREATE POLICY "users_view_own_profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'users_update_own_profile'
  ) THEN
    CREATE POLICY "users_update_own_profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'plans'
      AND policyname = 'public_view_deecee_plans'
  ) THEN
    CREATE POLICY "public_view_deecee_plans"
      ON public.plans FOR SELECT
      USING (product = 'deecee');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'users_view_own_subscriptions'
  ) THEN
    CREATE POLICY "users_view_own_subscriptions"
      ON public.subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transactions'
      AND policyname = 'users_view_own_transactions'
  ) THEN
    CREATE POLICY "users_view_own_transactions"
      ON public.transactions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

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
