create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email citext not null unique,
  country text not null,
  role_label text,
  current_tool text,
  biggest_struggle text,
  interest_score smallint check (interest_score between 1 and 5),
  desired_features text[] not null default '{}',
  consent_contact boolean not null default true,
  consent_research boolean not null default false,
  source text not null default 'orbit_waitlist',
  status text not null default 'new' check (status in ('new', 'contacted', 'invited', 'converted', 'not_fit')),
  admin_notes text,
  contacted_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waitlist_events (
  id bigint generated always as identity primary key,
  submission_id uuid references public.waitlist_submissions(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_errors (
  id bigint generated always as identity primary key,
  error_message text not null,
  request_email citext,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 1
);

alter table public.waitlist_submissions add column if not exists current_tool text;
alter table public.waitlist_submissions add column if not exists biggest_struggle text;
alter table public.waitlist_submissions add column if not exists desired_features text[] not null default '{}';
alter table public.waitlist_submissions add column if not exists consent_contact boolean not null default true;
alter table public.waitlist_submissions add column if not exists consent_research boolean not null default false;
alter table public.waitlist_submissions add column if not exists source text not null default 'orbit_waitlist';
alter table public.waitlist_submissions add column if not exists status text not null default 'new';
alter table public.waitlist_submissions add column if not exists admin_notes text;
alter table public.waitlist_submissions add column if not exists contacted_at timestamptz;
alter table public.waitlist_submissions add column if not exists metadata jsonb not null default '{}';
alter table public.waitlist_submissions add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_waitlist_submissions_updated_at on public.waitlist_submissions;
create trigger set_waitlist_submissions_updated_at
before update on public.waitlist_submissions
for each row execute function public.set_updated_at();

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.waitlist_submissions enable row level security;
alter table public.waitlist_events enable row level security;
alter table public.waitlist_errors enable row level security;
alter table public.waitlist_rate_limits enable row level security;

revoke all on public.waitlist_submissions from anon, authenticated;
revoke all on public.waitlist_events from anon, authenticated;
revoke all on public.waitlist_errors from anon, authenticated;
revoke all on public.waitlist_rate_limits from anon, authenticated;

grant select on public.profiles to authenticated;
grant select, update on public.waitlist_submissions to authenticated;
grant select on public.waitlist_events to authenticated;
grant select on public.waitlist_errors to authenticated;

grant all on public.waitlist_submissions to service_role;
grant all on public.waitlist_events to service_role;
grant all on public.waitlist_errors to service_role;
grant all on public.waitlist_rate_limits to service_role;
grant usage, select on all sequences in schema public to service_role;

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
on public.profiles for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can read waitlist" on public.waitlist_submissions;
create policy "Admins can read waitlist"
on public.waitlist_submissions for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can update waitlist" on public.waitlist_submissions;
create policy "Admins can update waitlist"
on public.waitlist_submissions for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can read events" on public.waitlist_events;
create policy "Admins can read events"
on public.waitlist_events for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can read errors" on public.waitlist_errors;
create policy "Admins can read errors"
on public.waitlist_errors for select
to authenticated
using (public.is_admin(auth.uid()));
