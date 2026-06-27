-- DeeCee Focus Strength + global beta testing flag.
-- Run this in Supabase SQL Editor if SCHEMA.complete.sql has already been run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
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
