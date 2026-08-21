-- 0032_quest_integrity_and_authority.sql
-- Stage 4.1: Quest Database Integrity, Anti-Cycle, Tenant Isolation & Settlement Authority.

-- ============================================================
-- 1. Numeric Range & Self-Parent Checks on public.quests
-- ============================================================

alter table public.quests
  add constraint quests_difficulty_range check (difficulty >= 0 and difficulty <= 1),
  add constraint quests_goal_alignment_range check (goal_alignment >= 0 and goal_alignment <= 1),
  add constraint quests_progress_range check (progress >= 0 and progress <= 100),
  add constraint quests_no_self_parent check (parent_quest_id is null or parent_quest_id <> id);

-- ============================================================
-- 2. Tenant Integrity: Parent Quest Must Belong to the Same User
-- ============================================================

alter table public.quests
  add constraint quests_user_id_id_unique unique (user_id, id);

alter table public.quests
  drop constraint if exists quests_parent_quest_id_fkey;

alter table public.quests
  add constraint quests_parent_same_user_fkey
  foreign key (user_id, parent_quest_id)
  references public.quests(user_id, id)
  on delete set null;

-- ============================================================
-- 3. Anti-Cycle Validation Trigger on public.quests
-- ============================================================

create or replace function public.check_quest_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_detected boolean := false;
begin
  if NEW.parent_quest_id is not null then
    if NEW.id is not null and NEW.parent_quest_id = NEW.id then
      raise exception 'Self-parenting is forbidden: quest cannot be its own parent';
    end if;

    if TG_OP = 'UPDATE' and NEW.parent_quest_id is distinct from OLD.parent_quest_id then
      -- Check if NEW.id appears in the ancestor chain of NEW.parent_quest_id
      with recursive ancestor_chain as (
        select id, parent_quest_id, user_id
        from public.quests
        where id = NEW.parent_quest_id and user_id = NEW.user_id
        union all
        select q.id, q.parent_quest_id, q.user_id
        from public.quests q
        inner join ancestor_chain a on q.id = a.parent_quest_id and q.user_id = a.user_id
      )
      select true into v_cycle_detected
      from ancestor_chain
      where id = NEW.id
      limit 1;

      if v_cycle_detected then
        raise exception 'Cycle detected: cannot set parent_quest_id to a descendant quest';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_quest_cycle on public.quests;
create trigger trg_check_quest_cycle
  before insert or update of parent_quest_id on public.quests
  for each row
  execute function public.check_quest_cycle();

-- ============================================================
-- 4. Authoritative Parent Progress Roll-up (Derived State)
-- ============================================================

create or replace function public.sync_parent_quest_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_user_id uuid;
  v_avg_progress numeric;
  v_all_completed boolean;
  v_current_parent public.quests;
  v_new_status text;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  v_parent_id := coalesce(NEW.parent_quest_id, OLD.parent_quest_id);
  v_user_id := coalesce(NEW.user_id, OLD.user_id);

  while v_parent_id is not null loop
    select * into v_current_parent
    from public.quests
    where id = v_parent_id and user_id = v_user_id;

    if not found then
      exit;
    end if;

    select
      coalesce(round(avg(progress)), 0),
      bool_and(status = 'completed')
    into
      v_avg_progress,
      v_all_completed
    from public.quests
    where parent_quest_id = v_parent_id and user_id = v_user_id;

    v_new_status := case
      when v_all_completed then 'completed'
      when v_avg_progress > 0 and v_current_parent.status = 'available' then 'active'
      else v_current_parent.status
    end;

    update public.quests
    set progress = v_avg_progress,
        status = v_new_status,
        completed_at = case when v_new_status = 'completed' then coalesce(v_current_parent.completed_at, now()) else null end,
        updated_at = now()
    where id = v_parent_id;

    -- Walk up the tree
    v_parent_id := v_current_parent.parent_quest_id;
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_sync_parent_quest_progress on public.quests;
create trigger trg_sync_parent_quest_progress
  after insert or update of progress, status, parent_quest_id or delete on public.quests
  for each row
  execute function public.sync_parent_quest_progress();

-- ============================================================
-- 5. Updated create_activity RPC with Quest Ownership Validation
-- ============================================================

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
  -- If quest_id is provided, verify it belongs to the current user
  if p_quest_id is not null then
    if not exists (
      select 1 from public.quests
      where id = p_quest_id and user_id = auth.uid()
    ) then
      raise exception 'quest_not_owned';
    end if;
  end if;

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

-- ============================================================
-- 6. Updated settle_activity RPC with Exact Stage2-B Parity + Linked Quest Advancement
-- ============================================================

create or replace function public.settle_activity(
  p_user_id uuid,
  p_settlement jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment_id uuid;
  v_xp_delta integer;
  v_activity_id uuid;
  v_skill_name text;
  v_normalized_skill_name text;
  v_related_labels text[];
  v_skill_id uuid;
  v_skill_row public.skills;
  v_skill_is_new boolean;
  v_current_mastery integer;
  v_mastery_action text;
  v_proposed_level integer;
  v_confidence numeric;
  v_from_level integer;
  v_to_level integer;
  v_evidence_level integer;
  v_repetition_count integer;
  v_activity_type text;
  v_authoritative_count integer;
  v_now timestamptz;
  v_tx jsonb;
  v_transaction_id uuid;
  v_amount integer;
  v_base_amount integer;
  v_rules_version text;
  v_reason text;
  v_modifier jsonb;
  v_penalty numeric;
  v_xp_type text;
  v_tx_row public.xp_transactions;
  v_existing_pending public.mastery_verifications;
  v_verification jsonb := null;
  v_i integer;
  v_assessment public.ai_assessments;
  v_activity public.activities;
  v_primary_skill_xp_delta numeric;
  v_settlement_xp_delta integer;
  v_primary_skill_name text;
  v_quest public.quests;
  v_quest_progress_advance numeric;
  v_new_quest_progress numeric;
begin
  -- Phase A: Parse + validate canonical XP + skill name consistency
  v_assessment_id := (p_settlement->>'assessmentId')::uuid;
  v_tx := p_settlement->'transaction';
  v_amount := coalesce((v_tx->>'amount')::int, 0);

  v_settlement_xp_delta := coalesce((p_settlement->>'xpDelta')::int, v_amount);
  v_primary_skill_xp_delta := coalesce(
    (p_settlement->'primarySkill'->>'xpDelta')::numeric,
    v_amount
  );

  if v_settlement_xp_delta <> v_amount then
    return jsonb_build_object('ok', false, 'reason', 'xp_delta_mismatch');
  end if;
  if v_primary_skill_xp_delta <> v_amount then
    return jsonb_build_object('ok', false, 'reason', 'skill_xp_delta_mismatch');
  end if;
  if v_amount < 0 then
    return jsonb_build_object('ok', false, 'reason', 'negative_xp');
  end if;

  v_xp_type := coalesce(nullif(v_tx->>'xpType', ''), 'activity');
  if v_xp_type <> 'activity' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_xp_type_for_settle');
  end if;

  v_xp_delta := v_amount;
  v_skill_name := coalesce(nullif(v_tx->>'skillName', ''), 'General Growth');

  v_primary_skill_name := coalesce(
    nullif(p_settlement->'primarySkill'->>'name', ''),
    v_skill_name
  );
  if v_primary_skill_name <> v_skill_name then
    return jsonb_build_object('ok', false, 'reason', 'skill_name_mismatch');
  end if;

  v_normalized_skill_name := regexp_replace(lower(btrim(v_skill_name)), '\s+', ' ', 'g');

  v_repetition_count := coalesce((v_tx->>'repetitionCount')::int, 0);
  v_activity_type := nullif(v_tx->>'activityType', '');
  v_transaction_id := coalesce((v_tx->>'id')::uuid, gen_random_uuid());
  v_base_amount := coalesce((v_tx->>'baseAmount')::int, 0);
  v_reason := v_tx->>'reason';
  v_modifier := coalesce(v_tx->'modifierJson', '{}'::jsonb);
  v_penalty := coalesce((v_tx->>'repetitionPenalty')::numeric, 1);

  v_related_labels := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(p_settlement->'relatedSkillLabels') as t(x)),
    '{}'::text[]
  );

  -- Phase B: Lock assessment + activity; ownership + idempotency
  select * into v_assessment
  from public.ai_assessments
  where id = v_assessment_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_assessment.user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'not_owned');
  end if;
  if v_assessment.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_confirmed');
  end if;

  v_activity_id := v_assessment.activity_id;
  select * into v_activity
  from public.activities
  where id = v_activity_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'activity_not_found');
  end if;
  if v_activity.user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'not_owned');
  end if;
  if v_activity.status = 'confirmed' then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end if;

  if exists (
    select 1 from public.xp_transactions
    where activity_id = v_activity_id and xp_type = 'activity'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end if;

  -- Phase C+D: Advisory lock on skill identity + lookup
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || '|' || v_normalized_skill_name));

  select * into v_skill_row
  from public.skills
  where user_id = p_user_id and normalized_name = v_normalized_skill_name;

  if found then
    v_skill_id := v_skill_row.id;
    v_skill_is_new := false;
  else
    v_skill_id := null;
    v_skill_is_new := true;
  end if;

  v_current_mastery := coalesce(v_skill_row.mastery_level, 1);
  v_now := clock_timestamp();

  -- Phase F: Repetition check
  if v_skill_is_new then
    v_authoritative_count := 0;
  else
    select count(*)::int into v_authoritative_count
    from public.xp_transactions
    where user_id = p_user_id
      and skill_id = v_skill_id
      and (v_activity_type is null or activity_type = v_activity_type)
      and created_at >= v_now - interval '30 days'
      and created_at <= v_now;
  end if;

  if v_authoritative_count <> v_repetition_count then
    return jsonb_build_object(
      'ok', false, 'reason', 'repetition_conflict',
      'actualRepetitionCount', v_authoritative_count
    );
  end if;

  -- Phase G: Mastery staleness check
  v_mastery_action := p_settlement->'primarySkill'->'masteryAction'->>'action';

  if v_mastery_action = 'upgrade' then
    v_proposed_level := (p_settlement->'primarySkill'->'masteryAction'->>'proposedLevel')::int;
    if v_proposed_level <= v_current_mastery then
      v_mastery_action := 'none';
    end if;
  end if;

  if v_mastery_action = 'request_verification' then
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    if v_to_level <= v_current_mastery then
      v_mastery_action := 'none';
    end if;
  end if;

  -- Phase H: ALL checks passed — permanent writes begin
  if v_skill_is_new then
    insert into public.skills (user_id, name)
    values (p_user_id, v_skill_name)
    on conflict (user_id, normalized_name) do update
      set updated_at = public.skills.updated_at
    returning * into v_skill_row;
    v_skill_id := v_skill_row.id;
  end if;

  v_rules_version := v_activity.rules_version;
  insert into public.xp_transactions (
    id, user_id, activity_id, assessment_id, skill_id, activity_type,
    repetition_count, repetition_penalty, xp_type, amount, base_amount,
    modifier_json, reason, rules_version, skill_name_snapshot, created_at
  ) values (
    v_transaction_id, p_user_id, v_activity_id, v_assessment_id, v_skill_id,
    v_activity_type, v_repetition_count, v_penalty, v_xp_type,
    v_amount, v_base_amount, v_modifier, v_reason, v_rules_version,
    v_skill_name, v_now
  )
  returning * into v_tx_row;

  insert into public.player_states (user_id, total_xp, player_level, updated_at)
  values (p_user_id, v_xp_delta, public.player_level_from_xp(v_xp_delta), v_now)
  on conflict (user_id) do update
    set total_xp = public.player_states.total_xp + v_xp_delta,
        player_level = public.player_level_from_xp(public.player_states.total_xp + v_xp_delta),
        updated_at = v_now;

  update public.skills
    set xp = public.skills.xp + v_xp_delta,
        level = public.player_level_from_xp(public.skills.xp + v_xp_delta),
        last_used_at = v_now,
        updated_at = v_now
    where id = v_skill_id
    returning * into v_skill_row;

  if v_mastery_action = 'upgrade' then
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric,
      v_skill_row.mastery_confidence
    );
    update public.skills
      set mastery_level = v_proposed_level,
          mastery_confidence = v_confidence,
          updated_at = v_now
      where id = v_skill_id;
    insert into public.mastery_events (
      user_id, skill_id, activity_id, from_level, to_level, confidence,
      event_type, reason, created_at
    ) values (
      p_user_id, v_skill_id, v_activity_id, v_current_mastery,
      v_proposed_level, v_confidence, 'upgrade', 'settle_activity', v_now
    );
  end if;

  if coalesce(array_length(v_related_labels, 1), 0) > 0 then
    for v_i in 1 .. array_length(v_related_labels, 1) loop
      insert into public.skills (user_id, name)
      values (p_user_id, v_related_labels[v_i])
      on conflict (user_id, normalized_name) do nothing;
    end loop;
  end if;

  if v_mastery_action = 'request_verification' then
    v_from_level := v_current_mastery;
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric, 0.5
    );
    v_evidence_level := coalesce(
      (p_settlement->'masteryVerification'->>'evidenceLevel')::int, 0
    );

    select * into v_existing_pending
    from public.mastery_verifications
    where user_id = p_user_id and skill_id = v_skill_id and status = 'pending';

    if v_existing_pending.id is null then
      insert into public.mastery_verifications (
        user_id, skill_id, skill_name, from_level, to_level, evidence_level,
        status, proposal_assessment_id, created_at
      ) values (
        p_user_id, v_skill_id, v_skill_name, v_from_level, v_to_level,
        v_evidence_level, 'pending', v_assessment_id, v_now
      )
      returning * into v_existing_pending;
    end if;

    v_verification := jsonb_build_object(
      'id', v_existing_pending.id,
      'skillId', v_existing_pending.skill_id,
      'skillName', v_existing_pending.skill_name,
      'fromLevel', v_existing_pending.from_level,
      'toLevel', v_existing_pending.to_level,
      'evidenceLevel', v_existing_pending.evidence_level,
      'status', v_existing_pending.status,
      'proposalAssessmentId', v_existing_pending.proposal_assessment_id,
      'createdAt', v_existing_pending.created_at,
      'resolvedAt', v_existing_pending.resolved_at
    );
  end if;

  -- Phase H.8: Linked Quest Progress Advancement (Milestone 4.1)
  if v_activity.quest_id is not null then
    select * into v_quest
    from public.quests
    where id = v_activity.quest_id and user_id = p_user_id
    for update;

    if v_quest.id is not null then
      v_quest_progress_advance := coalesce(round(v_activity.completion * 100), 20);
      v_new_quest_progress := least(100, v_quest.progress + v_quest_progress_advance);

      update public.quests
      set progress = v_new_quest_progress,
          status = case
            when v_new_quest_progress >= 100 then 'completed'
            when v_quest.status = 'available' then 'active'
            else v_quest.status
          end,
          completed_at = case
            when v_new_quest_progress >= 100 then coalesce(v_quest.completed_at, v_now)
            else v_quest.completed_at
          end,
          updated_at = v_now
      where id = v_quest.id;
    end if;
  end if;

  -- Phase I: Confirm assessment + activity
  update public.ai_assessments
    set status = 'superseded', updated_at = v_now
    where activity_id = v_activity_id and id <> v_assessment_id and status = 'pending';

  update public.ai_assessments
    set status = 'confirmed', confirmed_at = v_now, updated_at = v_now
    where id = v_assessment_id;
  update public.activities
    set status = 'confirmed', updated_at = v_now
    where id = v_activity_id;

  return jsonb_build_object(
    'ok', true,
    'skillId', v_skill_id,
    'transaction', jsonb_build_object(
      'id', v_tx_row.id,
      'userId', p_user_id,
      'activityId', v_tx_row.activity_id,
      'assessmentId', v_tx_row.assessment_id,
      'skillId', v_skill_id,
      'skillName', v_tx_row.skill_name_snapshot,
      'activityType', v_tx_row.activity_type,
      'xpType', v_tx_row.xp_type,
      'repetitionCount', v_tx_row.repetition_count,
      'repetitionPenalty', v_tx_row.repetition_penalty,
      'amount', v_tx_row.amount,
      'baseAmount', v_tx_row.base_amount,
      'modifierJson', v_tx_row.modifier_json,
      'reason', v_tx_row.reason,
      'rulesVersion', v_tx_row.rules_version,
      'createdAt', v_tx_row.created_at
    ),
    'masteryVerification', v_verification
  );
end;
$$;

revoke all on function public.settle_activity(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.settle_activity(uuid, jsonb) to service_role;
