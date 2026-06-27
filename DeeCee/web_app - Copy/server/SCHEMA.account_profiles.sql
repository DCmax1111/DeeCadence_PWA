-- DeeCee account profile upgrade.
-- Run after the base DeeCee schema.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE public.profiles
SET username = left(
  lower(regexp_replace(
    CASE
      WHEN length(coalesce(display_name, '')) >= 3 THEN display_name
      ELSE 'user_' || left(id::text, 8)
    END,
    '[^a-zA-Z0-9_]',
    '_',
    'g'
  )),
  24
)
WHERE username IS NULL;

DO $$
BEGIN
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles(lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles(lower(username))
  WHERE username IS NOT NULL;

DO $$
BEGIN
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
END $$;
