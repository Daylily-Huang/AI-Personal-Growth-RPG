-- 0021_assessment_authority.sql
-- Round12 Stage2-A.1: AI assessments and Activity lifecycle transitions are
-- server-authored. Authenticated users may create/read their Activities, but
-- cannot mutate state-machine fields or delete confirmed facts.

-- Revoke the broad owner UPDATE policy introduced by 0018. Existing databases
-- are repaired by this forward migration; 0018 remains immutable history.
drop policy if exists activities_update on public.activities;
drop policy if exists activities_delete on public.activities;

-- Pending, user-authored activities may be discarded before assessment. Once an
-- assessment exists, the Activity becomes an auditable server-managed fact.
drop policy if exists activities_delete_pending on public.activities;
create policy activities_delete_pending on public.activities
  for delete to authenticated
  using (user_id = auth.uid() and status = 'pending_assessment');

-- Trusted server persistence: inserts assessment and transitions the matching
-- Activity atomically. It deliberately has no EXECUTE grant for authenticated.
create or replace function public.record_ai_assessment(
  p_user_id uuid,
  p_activity_id uuid,
  p_assessment_json jsonb,
  p_model_name text,
  p_prompt_version text,
  p_confidence numeric
)
returns public.ai_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.activities;
  v_assessment public.ai_assessments;
begin
  select * into v_activity
  from public.activities
  where id = p_activity_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'activity_not_found_or_not_owned' using errcode = 'P0002';
  end if;

  if v_activity.status = 'confirmed' then
    raise exception 'activity_already_settled' using errcode = '55000';
  end if;

  insert into public.ai_assessments (
    user_id,
    activity_id,
    rules_version,
    assessment_json,
    model_name,
    prompt_version,
    confidence
  ) values (
    p_user_id,
    v_activity.id,
    v_activity.rules_version,
    p_assessment_json,
    p_model_name,
    p_prompt_version,
    p_confidence
  ) returning * into v_assessment;

  update public.activities
  set status = 'assessed', updated_at = now()
  where id = v_activity.id;

  return v_assessment;
end;
$$;

revoke all on function public.record_ai_assessment(uuid, uuid, jsonb, text, text, numeric) from public;
revoke all on function public.record_ai_assessment(uuid, uuid, jsonb, text, text, numeric) from anon;
revoke all on function public.record_ai_assessment(uuid, uuid, jsonb, text, text, numeric) from authenticated;
grant execute on function public.record_ai_assessment(uuid, uuid, jsonb, text, text, numeric) to service_role;
