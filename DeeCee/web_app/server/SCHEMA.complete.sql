-- DeeCee complete Supabase schema
-- Run this once in Supabase SQL Editor before testing checkout.
-- auth.users is managed by Supabase Auth; this file creates public app tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
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

-- Compatibility repair for older Supabase projects.
-- If a previous project already created public.profiles or public.plans without
-- the columns DeeCee needs, CREATE TABLE IF NOT EXISTS will not change it.
-- These guarded ALTERs add the missing columns before later foreign keys run.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id UUID;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_id_unique
  ON public.profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles(lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles(lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS id INTEGER,
  ADD COLUMN IF NOT EXISTS product TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS price_monthly DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS price_yearly DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_users INT,
  ADD COLUMN IF NOT EXISTS max_ledger_entries INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE SEQUENCE IF NOT EXISTS public.plans_id_seq;

ALTER TABLE public.plans
  ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq');

UPDATE public.plans
SET id = nextval('public.plans_id_seq')
WHERE id IS NULL;

ALTER SEQUENCE public.plans_id_seq
  OWNED BY public.plans.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_id_unique
  ON public.plans(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_product_tier_unique
  ON public.plans(product, tier)
  WHERE product IS NOT NULL AND tier IS NOT NULL;

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

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS plan_id INT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.subscriptions
SET id = gen_random_uuid()
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_id_unique
  ON public.subscriptions(id);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  provider_customer_id TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  transaction_type TEXT DEFAULT 'subscription',
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_transaction_id)
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS subscription_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.transactions
SET id = gen_random_uuid()
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_id_unique
  ON public.transactions(id);

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_gmail_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_gmail_check
      CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+-]+@gmail\.com$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format_check
      CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,24}$');
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

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_blocks_attempted INTEGER NOT NULL,
  total_blocks_completed INTEGER NOT NULL,
  duration_minutes DECIMAL(8, 2) NOT NULL,
  target_minutes DECIMAL(8, 2),
  task TEXT,
  difficulty TEXT,
  ended_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS total_blocks_attempted INTEGER,
  ADD COLUMN IF NOT EXISTS total_blocks_completed INTEGER,
  ADD COLUMN IF NOT EXISTS duration_minutes DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS target_minutes DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS task TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT,
  ADD COLUMN IF NOT EXISTS ended_reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.focus_sessions
SET id = gen_random_uuid()
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_sessions_id_unique
  ON public.focus_sessions(id);

DO $$
BEGIN
  ALTER TABLE public.focus_sessions
    DROP CONSTRAINT IF EXISTS focus_sessions_attempted_check;
  ALTER TABLE public.focus_sessions
    ADD CONSTRAINT focus_sessions_attempted_check
    CHECK (total_blocks_attempted BETWEEN 0 AND 4);

  ALTER TABLE public.focus_sessions
    DROP CONSTRAINT IF EXISTS focus_sessions_completed_check;
  ALTER TABLE public.focus_sessions
    ADD CONSTRAINT focus_sessions_completed_check
    CHECK (total_blocks_completed BETWEEN 0 AND 4);

  ALTER TABLE public.focus_sessions
    DROP CONSTRAINT IF EXISTS focus_sessions_completed_lte_attempted_check;
  ALTER TABLE public.focus_sessions
    ADD CONSTRAINT focus_sessions_completed_lte_attempted_check
    CHECK (total_blocks_completed <= total_blocks_attempted);

  ALTER TABLE public.focus_sessions
    DROP CONSTRAINT IF EXISTS focus_sessions_duration_check;
  ALTER TABLE public.focus_sessions
    ADD CONSTRAINT focus_sessions_duration_check
    CHECK (duration_minutes >= 0 AND duration_minutes <= 1440);
END $$;

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_created
  ON public.focus_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.app_config (key, value)
VALUES ('beta_testing_active', true)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

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
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
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
      AND policyname = 'users_insert_own_profile'
  ) THEN
    CREATE POLICY "users_insert_own_profile"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'focus_sessions'
      AND policyname = 'users_view_own_focus_sessions'
  ) THEN
    CREATE POLICY "users_view_own_focus_sessions"
      ON public.focus_sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'focus_sessions'
      AND policyname = 'users_insert_own_focus_sessions'
  ) THEN
    CREATE POLICY "users_insert_own_focus_sessions"
      ON public.focus_sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_config'
      AND policyname = 'public_view_app_config'
  ) THEN
    CREATE POLICY "public_view_app_config"
      ON public.app_config FOR SELECT
      USING (true);
  END IF;
END $$;

INSERT INTO public.plans (product, tier, price_monthly, currency, features, max_users, max_ledger_entries)
SELECT 'deecee', 'six_day', 0.99, 'USD', '{"sandbox_checkout": true, "manual_checkout": true, "tier": "six_day", "billing_label": "6 days", "access_days": 6}', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE product = 'deecee' AND tier = 'six_day');

INSERT INTO public.plans (product, tier, price_monthly, currency, features, max_users, max_ledger_entries)
SELECT 'deecee', 'monthly', 3.99, 'USD', '{"sandbox_checkout": true, "manual_checkout": true, "tier": "monthly", "billing_label": "month", "access_days": 30}', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE product = 'deecee' AND tier = 'monthly');

INSERT INTO public.plans (product, tier, price_monthly, currency, features, max_users, max_ledger_entries)
SELECT 'deecee', 'yearly', 39.99, 'USD', '{"sandbox_checkout": true, "manual_checkout": true, "tier": "yearly", "billing_label": "year", "access_days": 365}', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE product = 'deecee' AND tier = 'yearly');

INSERT INTO public.plans (product, tier, price_monthly, currency, features, max_users, max_ledger_entries)
SELECT 'deecee', 'lifetime', 99.99, 'USD', '{"sandbox_checkout": true, "manual_checkout": true, "tier": "lifetime", "billing_label": "one-time", "access_days": 36500}', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE product = 'deecee' AND tier = 'lifetime');

UPDATE public.plans
SET price_monthly = CASE tier
      WHEN 'six_day' THEN 0.99
      WHEN 'monthly' THEN 3.99
      WHEN 'yearly' THEN 39.99
      WHEN 'lifetime' THEN 99.99
      ELSE price_monthly
    END,
    currency = 'USD',
    features = jsonb_build_object(
      'sandbox_checkout', true,
      'manual_checkout', true,
      'tier', tier,
      'billing_label', CASE tier
        WHEN 'six_day' THEN '6 days'
        WHEN 'monthly' THEN 'month'
        WHEN 'yearly' THEN 'year'
        WHEN 'lifetime' THEN 'one-time'
        ELSE tier
      END,
      'access_days', CASE tier
        WHEN 'six_day' THEN 6
        WHEN 'monthly' THEN 30
        WHEN 'yearly' THEN 365
        WHEN 'lifetime' THEN 36500
        ELSE 30
      END
    ),
    updated_at = now()
WHERE product = 'deecee'
  AND tier IN ('six_day', 'monthly', 'yearly', 'lifetime');
