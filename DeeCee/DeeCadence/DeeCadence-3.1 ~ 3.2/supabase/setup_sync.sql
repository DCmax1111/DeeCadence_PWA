create table if not exists public.deecadence_sync_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.deecadence_sync_state enable row level security;
revoke all on table public.deecadence_sync_state from anon, public;
grant select, insert, update on table public.deecadence_sync_state to authenticated;
drop policy if exists "Users can read their own DeeCadence sync state" on public.deecadence_sync_state;
create policy "Users can read their own DeeCadence sync state" on public.deecadence_sync_state
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own DeeCadence sync state" on public.deecadence_sync_state;
create policy "Users can create their own DeeCadence sync state" on public.deecadence_sync_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own DeeCadence sync state" on public.deecadence_sync_state;
create policy "Users can update their own DeeCadence sync state" on public.deecadence_sync_state
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create or replace function public.deecadence_save_sync_snapshot(p_expected_revision bigint, p_payload jsonb)
returns table (revision bigint, updated_at timestamptz)
language plpgsql set search_path = ''
as $function$
declare v_revision bigint; v_updated_at timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_expected_revision < 0 then raise exception 'expected revision must be zero or greater'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'sync snapshot must be a JSON object'; end if;
  if pg_column_size(p_payload) > 4194304 then raise exception 'sync snapshot exceeds 4 MB'; end if;
  insert into public.deecadence_sync_state as stored (user_id, revision, payload, updated_at)
  values ((select auth.uid()), 1, p_payload, now())
  on conflict (user_id) do update
    set revision = stored.revision + 1, payload = excluded.payload, updated_at = now()
    where stored.revision = p_expected_revision
  returning revision, updated_at into v_revision, v_updated_at;
  if not found then return; end if;
  return query select v_revision, v_updated_at;
end;
$function$;
revoke all on function public.deecadence_save_sync_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.deecadence_save_sync_snapshot(bigint, jsonb) to authenticated;