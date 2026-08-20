-- 0027_mastery_null_closure.sql
-- Stage2-B Final Freeze Patch (Round18 review).
--
-- P1-1: New Skill mastery NULL vulnerability.
--   0026 Phase C+D uses advisory lock + deferred Skill creation. When the Skill
--   doesn't exist yet, v_skill_row is unpopulated → v_skill_row.mastery_level = NULL.
--   Phase G then checks:
--     if v_proposed_level <= v_skill_row.mastery_level → 'none'
--   But `0 <= NULL` is NULL/unknown, NOT true. So a malformed payload with
--   proposedLevel=0 on a new Skill would bypass the guard, and Phase H would
--   UPDATE mastery_level = 0, downgrading from the DB default M1.
--
--   Fix: introduce v_current_mastery := coalesce(v_skill_row.mastery_level, 1).
--   All Phase G comparisons and verification fromLevel use this authoritative
--   value instead of the potentially-NULL v_skill_row.mastery_level.
--
--   Additionally, verification fromLevel now uses v_current_mastery directly
--   (not greatest(client_fromLevel, current)), because fromLevel describes the
--   DB's current state — there is no reason to trust the client value at all.

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
  v_current_mastery integer;  -- authoritative: coalesce(v_skill_row.mastery_level, 1)
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
  -- Phase A: Parse + validate canonical XP + skill name consistency
  -- ============================================================
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

  -- P2-3: validate transaction.skillName == primarySkill.name.
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
  -- Phase C+D: Advisory lock on skill identity + lookup
  -- ============================================================
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

  -- P1-1 fix: authoritative current mastery. New Skill → M1 (matches DB default
  -- and TS DEFAULT_SKILL_MASTERY). This eliminates the NULL comparison bug.
  v_current_mastery := coalesce(v_skill_row.mastery_level, 1);

  -- ============================================================
  -- Phase E: Authoritative timestamp AFTER lock
  -- ============================================================
  v_now := clock_timestamp();

  -- ============================================================
  -- Phase F: Repetition check
  -- ============================================================
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

  -- ============================================================
  -- Phase G: Mastery staleness check (uses v_current_mastery — P1-1)
  -- ============================================================
  v_mastery_action := p_settlement->'primarySkill'->'masteryAction'->>'action';

  if v_mastery_action = 'upgrade' then
    v_proposed_level := (p_settlement->'primarySkill'->'masteryAction'->>'proposedLevel')::int;
    -- P1-1: v_current_mastery is never NULL (coalesced to 1 for new skills).
    if v_proposed_level <= v_current_mastery then
      v_mastery_action := 'none';
    end if;
  end if;

  -- P2-4: request_verification stale check (also uses v_current_mastery).
  if v_mastery_action = 'request_verification' then
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    if v_to_level <= v_current_mastery then
      -- Target already reached or surpassed — verification is meaningless.
      v_mastery_action := 'none';
    end if;
  end if;

  -- ============================================================
  -- Phase H: ALL checks passed — permanent writes begin
  -- ============================================================

  -- H.1) Create skill if new.
  if v_skill_is_new then
    insert into public.skills (user_id, name)
    values (p_user_id, v_skill_name)
    on conflict (user_id, normalized_name) do update
      set updated_at = public.skills.updated_at
    returning * into v_skill_row;
    v_skill_id := v_skill_row.id;
  end if;

  -- H.2) Ledger row.
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
      p_user_id, v_skill_id, v_activity_id, v_current_mastery,
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

  -- H.7) Pending MasteryVerification.
  -- P1-1: fromLevel = v_current_mastery (authoritative DB state), not client value.
  if v_mastery_action = 'request_verification' then
    v_from_level := v_current_mastery;  -- authoritative, never trust client
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
