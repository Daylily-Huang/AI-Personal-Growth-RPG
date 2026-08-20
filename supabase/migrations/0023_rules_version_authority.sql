-- 0023_rules_version_authority.sql
-- Round14 P1-1: the create_activity RPC must freeze an AUTHORITATIVE, active
-- rules version. The Round13 (0022) implementation selected
--   select version ... from public.rules_versions order by version desc limit 1
-- with a `coalesce(..., 'v1')` fallback. That is wrong on three counts:
--   1. it can freeze a DRAFT version (no status = 'active' filter);
--   2. `version` is text, so `order by version desc` is a STRING sort — a future
--      'growth-engine-v9' / 'growth-engine-v10' naming would sort backwards;
--   3. when the registry is empty it wrote the hardcoded 'v1', which DRIFTS from
--      the actual Growth Engine declaration (RULES_VERSION = 'growth-engine-v0.1')
--      in src/lib/growth-engine/xp.ts. The audited rules_version field — which
--      the design says must be frozen at creation and recorded in the Confirm
--      ledger — was therefore untrustworthy.
--
-- Fix:
--   * enforce the "at most one active version" invariant with a partial unique
--     index;
--   * seed the initial active engine version so a fresh DB is never empty;
--   * replace create_activity to pick the single ACTIVE row ordered by
--     activated_at desc, and FAIL CLOSED (raise 'no_active_rules_version')
--     when none exists — never a fallback.

-- Invariant: at most one active rules version may exist at any time.
drop index if exists public.rules_versions_one_active;
create unique index rules_versions_one_active
  on public.rules_versions ((1))
  where status = 'active';

-- Seed the initial active engine version so the registry is never empty in a
-- fresh database. Idempotent: only insert when the version row is absent.
insert into public.rules_versions (version, status, description, activated_at)
select 'growth-engine-v0.1', 'active', 'Initial active growth engine version', now()
where not exists (
  select 1 from public.rules_versions where version = 'growth-engine-v0.1'
);

-- Replace create_activity with active-only, activated_at-ordered, fail-closed
-- logic. Signature is unchanged so generated types need no edit.
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
  -- Authoritative current rules version: the single ACTIVE row, most recently
  -- activated. No draft, no string sort, no fallback.
  select version into v_rules_version
    from public.rules_versions
   where status = 'active'
   order by activated_at desc nulls last
   limit 1;

  if v_rules_version is null then
    raise exception 'no_active_rules_version';
  end if;

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
