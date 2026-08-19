-- 0022_activity_creation_authority.sql
-- Round13 P1-1: clients must not directly INSERT into activities, because the
-- 0018 `activities_insert` policy only checks `user_id = auth.uid()` and the
-- table allows status in (pending_assessment, assessed, confirmed). That lets a
-- hostile authenticated client forge:
--   - status = 'confirmed' with no Assessment and no XP ledger
--   - rules_version = arbitrary (an authority-controlled audit fact)
--   - created_at / updated_at = arbitrary
-- The 0020 before-update trigger does NOT guard INSERTs.
--
-- Fix: revoke direct INSERT and route creation through a SECURITY DEFINER RPC
-- that owns the facts the client must never choose:
--   user_id       = auth.uid()
--   status        = 'pending_assessment'
--   rules_version = authoritative current version
--   created_at    = now()
--   updated_at    = now()

drop policy if exists activities_insert on public.activities;

create or replace function public.create_activity(
  p_title text,
  p_raw_input text,
  p_activity_type text default null,
  p_quest_id uuid default null,
  p_total_minutes integer default null,
  p_effective_minutes integer default null,
  p_started_at timestamptz default null,
  p_ended_at timestamptz default null,
  p_completion numeric default null
)
returns public.activities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rules_version text;
  v_activity public.activities;
begin
  -- Authoritative current rules version. rules_versions has no created_at, so
  -- order by version; fall back to 'v1' when the registry is empty.
  select version into v_rules_version
    from public.rules_versions
   order by version desc
   limit 1;
  v_rules_version := coalesce(v_rules_version, 'v1');

  insert into public.activities (
    user_id,
    title,
    raw_input,
    activity_type,
    quest_id,
    total_minutes,
    effective_minutes,
    started_at,
    ended_at,
    completion,
    status,
    rules_version,
    created_at,
    updated_at
  ) values (
    auth.uid(),
    p_title,
    p_raw_input,
    p_activity_type,
    p_quest_id,
    p_total_minutes,
    p_effective_minutes,
    p_started_at,
    p_ended_at,
    p_completion,
    'pending_assessment',
    v_rules_version,
    now(),
    now()
  ) returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.create_activity(
  text, text, text, uuid, integer, integer, timestamptz, timestamptz, numeric
) from public, anon;
grant execute on function public.create_activity(
  text, text, text, uuid, integer, integer, timestamptz, timestamptz, numeric
) to authenticated;
