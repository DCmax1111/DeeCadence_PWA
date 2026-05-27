-- Core authentication and user tables
-- Note: auth.users is managed by Supabase Auth. This file covers public schema tables.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pgvector"; -- For future AI features
-- pgvector is optional and not required for the core finance MVP.

-- User profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  subscription_plan TEXT DEFAULT 'starter',
  -- Payment provider customer IDs
  cleva_customer_id TEXT UNIQUE,
  moniepoint_account_id TEXT UNIQUE,
  palmpay_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Plans (tier definitions)
CREATE TABLE IF NOT EXISTS public.plans (
  id SERIAL PRIMARY KEY,
  product TEXT NOT NULL, -- 'finance', 'dashboard', 'education'
  tier TEXT NOT NULL, -- 'starter', 'growth', 'operator', 'pro', 'campus', etc.
  price_monthly DECIMAL(10, 2),
  price_yearly DECIMAL(10, 2),
  currency TEXT DEFAULT 'NGN',
  features JSONB DEFAULT '{}',
  max_users INT,
  max_ledger_entries INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE(product, tier)
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id INT NOT NULL REFERENCES plans(id),
  status TEXT DEFAULT 'active', -- 'active', 'trialing', 'past_due', 'canceled'
  provider TEXT NOT NULL, -- 'cleva', 'moniepoint', 'palmpay'
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

-- Finance: Ledger entries
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL, -- 'income', 'expense', 'transfer'
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  description TEXT,
  category TEXT,
  entry_date DATE NOT NULL,
  notes TEXT,
  tags TEXT[], -- for filtering/organization
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_entry_type_check'
  ) THEN
    ALTER TABLE public.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN ('income', 'expense', 'transfer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_amount_positive_check'
  ) THEN
    ALTER TABLE public.ledger_entries
      ADD CONSTRAINT ledger_entries_amount_positive_check
      CHECK (amount > 0);
  END IF;
END $$;

-- Finance: Audit logs for ledger
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'ledger_entry', 'subscription', etc.
  entity_id UUID,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dashboard: Workspaces (for team support)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dashboard: Team members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'editor', 'member'
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Dashboard: Sprints
CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active', -- 'planning', 'active', 'completed'
  target_cash DECIMAL(15, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dashboard: Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- 'todo', 'in_progress', 'in_review', 'done'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dashboard: KPI entries
CREATE TABLE IF NOT EXISTS public.kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL, -- 'revenue', 'signups', 'customers', etc.
  value DECIMAL(15, 2) NOT NULL,
  target_value DECIMAL(15, 2),
  unit TEXT, -- 'NGN', 'count', '%', etc.
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Education: Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  required_plan TEXT, -- 'free', 'pro', 'campus'
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Education: Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_markdown TEXT,
  content_url TEXT,
  lesson_order INT DEFAULT 0,
  duration_minutes INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Education: Quiz questions
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice', -- 'multiple_choice', 'short_answer', 'essay'
  options JSONB, -- for multiple choice: [{ text, is_correct }, ...]
  correct_answer TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Education: Student progress
CREATE TABLE IF NOT EXISTS public.student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed'
  progress_percent INT DEFAULT 0,
  quiz_score INT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Payments: Transactions log
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- 'cleva', 'moniepoint', 'palmpay', 'manual_bank'
  provider_transaction_id TEXT NOT NULL,
  provider_customer_id TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'pending', -- 'pending', 'succeeded', 'failed', 'refunded', 'expired'
  transaction_type TEXT DEFAULT 'subscription', -- 'subscription', 'top_up', 'payout'
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_transaction_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_status_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_status_check
      CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'expired'));
  END IF;

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

-- Webhooks: Event log
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL, -- 'cleva', 'moniepoint', 'palmpay'
  event_type TEXT NOT NULL, -- 'subscription.created', 'charge.succeeded', etc.
  event_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, event_id)
);

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(id);
CREATE INDEX idx_ledger_entries_user_id ON ledger_entries(user_id);
CREATE INDEX idx_ledger_entries_date ON ledger_entries(entry_date);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_provider ON transactions(provider);
CREATE INDEX idx_transactions_user_provider_status ON transactions(user_id, provider, status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_student_progress_user_id ON student_progress(user_id);
CREATE INDEX idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Row-Level Security policies (enable RLS, then add policies)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can view/edit only their own data
CREATE POLICY "users_view_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "users_view_own_ledger"
  ON ledger_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_create_own_ledger"
  ON ledger_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_ledger"
  ON ledger_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_ledger"
  ON ledger_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_audit_logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_progress"
  ON student_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_progress"
  ON student_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Verified: All tables and policies created
