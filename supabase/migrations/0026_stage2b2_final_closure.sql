-- 0026_stage2b2_final_closure.sql
-- Stage2-B.2: Final Settlement Freeze (Round17 review).
--
-- Fixes:
--   P1-1  0025 regressed create_activity's rules_version logic back to the old
--         "order by version desc / fallback v1" pattern, undoing 0023's fix.
--         This migration restores ACTIVE-only / activated_at-ordered / fail-closed.
--   P1-2  (Test fix — settlement-rpc.test.ts cross-activity concurrency.)
--   P2-1  New Skill + repetition_conflict left an orphan Skill row. Now uses
--         pg_advisory_xact_lock to serialize skill identity resolution so that
--         no permanent write occurs before all validation passes.
--   P2-2  (Read-path fix — supabase-repository.ts listTransactions.)
--   P2-3  RPC now validates transaction.skillName == primarySkill.name.
--   P2-4  request_verification also checks stale mastery after skill lock.

-- ============================================================
-- 1) create_activity — restore 0023 rules_version + keep 0025 quest ownership
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
  -- P1-1 fix: restore 0023 ACTIVE-only / activated_at-ordered / fail-closed logic.
  -- 0025 had accidentally reverted this to "order by version desc / coalesce v1".
  select version into v_rules_version
    from public.rules_versions
   where status = 'active'
   order by activated_at desc nulls last
   limit 1;

  if v_rules_version is null then
    raise exception 'no_active_rules_version';
  end if;

  -- P1-4 (from 0025): composite tenant integrity — verify quest ownership.
  if p_quest_id is not null and not exists (
    select 1 from public.quests
    where id = p_quest_id and user_id = auth.uid()
  ) then
    raise exception 'quest_not_owned' using errcode = 'check_violation';
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

-- ============================================================
-- 2) settle_activity — P2-1 (advisory lock), P2-3 (name check), P2-4 (stale RV)
-- ============================================================
--
-- Changes from 0025:
--   * Phase C: instead of INSERT ON CONFLICT DO NOTHING (which creates a Skill
--     row before validation), acquire a transaction-level advisory lock on
--     hashtext(user_id + normalized_name). Then SELECT the skill. This
--     serializes concurrent skill identity resolution without any permanent
--     write. Skill INSERT is deferred to Phase H (after all checks pass).
--   * Phase A: validate transaction.skillName == primarySkill.name (P2-3).
--   * Phase G: also handle request_verification stale mastery (P2-4).

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
begin
  -- ============================================================
  -- Phase A: Parse + validate canonical XP + skill name consistency (P2-3)
  -- ============================================================
  v_assessment_id := (p_settlement->>'assessmentId')::uuid;
  v_tx := p_settlement->'transaction';
  v_amount := coalesce((v_tx->>'amount')::int, 0);

  -- Canonical XP = transaction.amount.  Reject if the other two sources disagree.
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

  -- Force xpType = 'activity'.
  v_xp_type := coalesce(nullif(v_tx->>'xpType', ''), 'activity');
  if v_xp_type <> 'activity' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_xp_type_for_settle');
  end if;

  v_xp_delta := v_amount;
  v_skill_name := coalesce(nullif(v_tx->>'skillName', ''), 'General Growth');

  -- P2-3: validate transaction.skillName == primarySkill.name.
  v_primary_skill_name := coalesce(
    nullif(p_settlement->'primarySkill'->>'name', ''),
    v_skill_name
  );
  if v_primary_skill_name <> v_skill_name then
    return jsonb_build_object('ok', false, 'reason', 'skill_name_mismatch');
  end if;

  -- Compute normalized name for advisory lock + skill lookup.
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

  -- ============================================================
  -- Phase B: Lock assessment + activity; ownership + idempotency
  -- ============================================================

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

  -- ============================================================
  -- Phase C+D: Advisory lock on skill identity (P2-1)
  -- ============================================================
  -- Instead of INSERT ON CONFLICT DO NOTHING (which creates a Skill row before
  -- validation), acquire a transaction-level advisory lock on the normalized
  -- skill identity. This serializes concurrent settlements targeting the same
  -- (user, skill) without any permanent write.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || '|' || v_normalized_skill_name));

  -- After advisory lock: look up existing skill (no INSERT yet).
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

  -- ============================================================
  -- Phase E: Authoritative timestamp AFTER lock
  -- ============================================================
  v_now := clock_timestamp();

  -- ============================================================
  -- Phase F: Repetition check — RETURN on conflict, no writes yet
  -- ============================================================
  if v_skill_is_new then
    -- New skill: no prior transactions exist → authoritative count = 0.
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
    -- No permanent mutation has occurred — safe to return.
    return jsonb_build_object(
      'ok', false, 'reason', 'repetition_conflict',
      'actualRepetitionCount', v_authoritative_count
    );
  end if;

  -- ============================================================
  -- Phase G: Mastery staleness check (P2-4: also for request_verification)
  -- ============================================================
  v_mastery_action := p_settlement->'primarySkill'->'masteryAction'->>'action';

  if v_mastery_action = 'upgrade' then
    v_proposed_level := (p_settlement->'primarySkill'->'masteryAction'->>'proposedLevel')::int;
    if v_proposed_level <= v_skill_row.mastery_level then
      v_mastery_action := 'none';
    end if;
  end if;

  -- P2-4: request_verification also needs stale check after lock.
  if v_mastery_action = 'request_verification' then
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    v_from_level := (p_settlement->'primarySkill'->'masteryAction'->>'fromLevel')::int;
    if v_to_level <= v_skill_row.mastery_level then
      -- Target already reached or surpassed — verification is meaningless.
      v_mastery_action := 'none';
    elsif v_from_level < v_skill_row.mastery_level then
      -- fromLevel is stale but target is still above current — adjust fromLevel.
      -- We don't change the JSON; the verification insert below uses
      -- greatest(v_from_level, v_skill_row.mastery_level) as authoritative fromLevel.
      null;  -- handled at insert time
    end if;
  end if;

  -- ============================================================
  -- Phase H: ALL checks passed — permanent writes begin
  -- ============================================================

  -- H.1) Create skill if new (deferred from Phase C — P2-1).
  if v_skill_is_new then
    insert into public.skills (user_id, name)
    values (p_user_id, v_skill_name)
    on conflict (user_id, normalized_name) do update
      set updated_at = updated_at  -- no-op: just to get the id via returning
    returning * into v_skill_row;
    v_skill_id := v_skill_row.id;
  end if;

  -- H.2) Ledger row (with skill_name_snapshot).
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

  -- H.3) Player total + derived level.
  insert into public.player_states (user_id, total_xp, player_level, updated_at)
  values (p_user_id, v_xp_delta, public.player_level_from_xp(v_xp_delta), v_now)
  on conflict (user_id) do update
    set total_xp = public.player_states.total_xp + v_xp_delta,
        player_level = public.player_level_from_xp(public.player_states.total_xp + v_xp_delta),
        updated_at = v_now;

  -- H.4) Primary skill XP delta + derived level.
  update public.skills
    set xp = public.skills.xp + v_xp_delta,
        level = public.player_level_from_xp(public.skills.xp + v_xp_delta),
        last_used_at = v_now,
        updated_at = v_now
    where id = v_skill_id
    returning * into v_skill_row;

  -- H.5) Mastery upgrade — only when proposed > current.
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
      p_user_id, v_skill_id, v_activity_id, v_skill_row.mastery_level,
      v_proposed_level, v_confidence, 'upgrade', 'settle_activity', v_now
    );
  end if;

  -- H.6) Secondary skills.
  if coalesce(array_length(v_related_labels, 1), 0) > 0 then
    for v_i in 1 .. array_length(v_related_labels, 1) loop
      insert into public.skills (user_id, name)
      values (p_user_id, v_related_labels[v_i])
      on conflict (user_id, normalized_name) do nothing;
    end loop;
  end if;

  -- H.7) Pending MasteryVerification (P2-4: use authoritative fromLevel).
  if v_mastery_action = 'request_verification' then
    v_from_level := (p_settlement->'primarySkill'->'masteryAction'->>'fromLevel')::int;
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric, 0.5
    );
    v_evidence_level := coalesce(
      (p_settlement->'masteryVerification'->>'evidenceLevel')::int, 0
    );

    -- P2-4: use authoritative fromLevel (not stale client value).
    v_from_level := greatest(v_from_level, v_skill_row.mastery_level);

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

  -- ============================================================
  -- Phase I: Confirm assessment + activity
  -- ============================================================
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

revoke all on function public.settle_activity(uuid, jsonb) from public;
revoke all on function public.settle_activity(uuid, jsonb) from anon;
revoke all on function public.settle_activity(uuid, jsonb) from authenticated;
grant execute on function public.settle_activity(uuid, jsonb) to service_role;
