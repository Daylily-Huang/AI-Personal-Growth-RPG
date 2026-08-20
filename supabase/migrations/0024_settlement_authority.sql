-- 0024_settlement_authority.sql
-- Stage2-B: authoritative settlement RPC (settle_activity).
--
-- Design (docs + repository.ts contract):
--   * The TS SettlementService remains the SINGLE copy of Growth Engine rules
--     (XP math, mastery eligibility). It builds a DELTA-based SettlementToApply.
--   * This RPC is the Supabase implementation of Repository.applySettlement:
--     it applies the deltas in ONE database transaction and enforces the
--     authority invariants the store must own:
--       1. ownership — the settlement only touches rows owned by p_user_id;
--       2. idempotency — one assessment settles once, one `xp_type='activity'`
--          ledger row per Activity (partial unique indexes are the backstop);
--       3. repetition snapshot — the similar-count is re-derived from the
--          COMMITTED ledger inside this transaction; a mismatch with the
--          client's count returns repetition_conflict + the fresh count;
--       4. at most one pending MasteryVerification per (user, skill);
--       5. atomic state transitions — assessment confirmed, activity confirmed,
--          sibling pending revisions superseded.
--   * rules_version on the ledger row is taken from the Activity's frozen
--     value (authoritative), never from the client payload.
--   * service_role only: authenticated/anon/public can never settle.

-- ------------------------------------------------------------
-- Deterministic level curve (parity with src/lib/growth-engine/levels.ts).
-- Player and skill levels are DERIVED caches; total_xp / skill.xp are the
-- authoritative accumulators. A parity test keeps TS and SQL curves in sync.
-- ------------------------------------------------------------
create or replace function public.xp_threshold_for_level(p_level integer)
returns integer
language plpgsql
immutable
as $$
declare
  v_total integer := 0;
  v_l integer;
begin
  if p_level is null or p_level <= 1 then
    return 0;
  end if;
  for v_l in 1 .. (p_level - 1) loop
    v_total := v_total + 100 + (v_l - 1) * 30;
  end loop;
  return v_total;
end;
$$;

create or replace function public.player_level_from_xp(p_total_xp numeric)
returns integer
language plpgsql
immutable
as $$
declare
  v_level integer := 1;
  v_xp numeric := floor(greatest(0, coalesce(p_total_xp, 0)));
begin
  while v_xp >= public.xp_threshold_for_level(v_level + 1) loop
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- ------------------------------------------------------------
-- settle_activity
-- ------------------------------------------------------------
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
  v_related_labels text[];
  v_skill_id uuid;
  v_skill_row public.skills;
  v_mastery_action text;
  v_proposed_level integer;
  v_confidence numeric;
  v_from_level integer;
  v_to_level integer;
  v_evidence_level integer;
  v_repetition_count integer;
  v_activity_type text;
  v_authoritative_count integer;
  v_now timestamptz := now();
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
  v_existing_pending uuid;
  v_verification jsonb := null;
  v_i integer;
  v_assessment public.ai_assessments;
  v_activity public.activities;
begin
  v_assessment_id := (p_settlement->>'assessmentId')::uuid;
  v_xp_delta := coalesce((p_settlement->>'xpDelta')::int, 0);
  v_tx := p_settlement->'transaction';
  v_skill_name := coalesce(nullif(v_tx->>'skillName', ''), 'General Growth');
  v_repetition_count := coalesce((v_tx->>'repetitionCount')::int, 0);
  v_activity_type := nullif(v_tx->>'activityType', '');
  v_transaction_id := coalesce((v_tx->>'id')::uuid, gen_random_uuid());
  v_amount := coalesce((v_tx->>'amount')::int, v_xp_delta);
  v_base_amount := coalesce((v_tx->>'baseAmount')::int, 0);
  v_reason := v_tx->>'reason';
  v_modifier := coalesce(v_tx->'modifierJson', '{}'::jsonb);
  v_penalty := coalesce((v_tx->>'repetitionPenalty')::numeric, 1);
  v_xp_type := coalesce(nullif(v_tx->>'xpType', ''), 'activity');
  if v_xp_type not in ('activity', 'adjustment', 'correction') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_xp_type');
  end if;
  v_related_labels := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(p_settlement->'relatedSkillLabels') as t(x)),
    '{}'::text[]
  );

  -- 1) Lock the assessment; verify ownership + pending.
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

  -- 2) Lock the Activity (authoritative id from the assessment row).
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

  -- 3) Idempotency: one original `activity` settlement per Activity.
  --    (Partial unique index xp_transactions_one_activity_settlement_idx is the
  --     DB-level backstop; the activity row lock serializes the race.)
  if exists (
    select 1 from public.xp_transactions
    where activity_id = v_activity_id and xp_type = 'activity'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end if;

  -- 4) Resolve-or-create the primary skill (normalized_name upsert; the 0019
  --    BEFORE-trigger computes normalized_name on insert).
  insert into public.skills (user_id, name)
  values (p_user_id, v_skill_name)
  on conflict (user_id, normalized_name) do update
    set updated_at = v_now
  returning id into v_skill_id;

  -- 5) Authoritative repetition snapshot from the committed ledger.
  select count(*)::int into v_authoritative_count
  from public.xp_transactions
  where user_id = p_user_id
    and skill_id = v_skill_id
    and (v_activity_type is null or activity_type = v_activity_type)
    and created_at >= v_now - interval '30 days'
    and created_at <= v_now;
  if v_authoritative_count <> v_repetition_count then
    return jsonb_build_object(
      'ok', false, 'reason', 'repetition_conflict',
      'actualRepetitionCount', v_authoritative_count
    );
  end if;

  -- 6) Append the ledger row (authoritative rules_version from the Activity).
  v_rules_version := v_activity.rules_version;
  insert into public.xp_transactions (
    id, user_id, activity_id, assessment_id, skill_id, activity_type,
    repetition_count, repetition_penalty, xp_type, amount, base_amount,
    modifier_json, reason, rules_version, created_at
  ) values (
    v_transaction_id, p_user_id, v_activity_id, v_assessment_id, v_skill_id,
    v_activity_type, v_repetition_count, v_penalty, v_xp_type,
    v_amount, v_base_amount, v_modifier, v_reason, v_rules_version, v_now
  )
  returning * into v_tx_row;

  -- 7) Player total (delta) + derived provisional level.
  insert into public.player_states (user_id, total_xp, player_level, updated_at)
  values (p_user_id, v_xp_delta, public.player_level_from_xp(v_xp_delta), v_now)
  on conflict (user_id) do update
    set total_xp = public.player_states.total_xp + v_xp_delta,
        player_level = public.player_level_from_xp(public.player_states.total_xp + v_xp_delta),
        updated_at = v_now;

  -- 8) Primary skill delta + derived level.
  update public.skills
    set xp = public.skills.xp + coalesce((p_settlement->'primarySkill'->>'xpDelta')::numeric, v_xp_delta),
        level = public.player_level_from_xp(
          public.skills.xp + coalesce((p_settlement->'primarySkill'->>'xpDelta')::numeric, v_xp_delta)
        ),
        last_used_at = v_now,
        updated_at = v_now
    where id = v_skill_id
    returning * into v_skill_row;

  -- 9) Mastery action.
  v_mastery_action := p_settlement->'primarySkill'->'masteryAction'->>'action';
  if v_mastery_action = 'upgrade' then
    v_proposed_level := (p_settlement->'primarySkill'->'masteryAction'->>'proposedLevel')::int;
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

  -- 10) Secondary skills (resolve-or-create by normalized name; no graph edge
  --     table exists in the relational schema yet, so edges are not written).
  if coalesce(array_length(v_related_labels, 1), 0) > 0 then
    for v_i in 1 .. array_length(v_related_labels, 1) loop
      insert into public.skills (user_id, name)
      values (p_user_id, v_related_labels[v_i])
      on conflict (user_id, normalized_name) do nothing;
    end loop;
  end if;

  -- 11) Pending MasteryVerification (request_verification), deduped per skill.
  if v_mastery_action = 'request_verification' then
    v_from_level := (p_settlement->'primarySkill'->'masteryAction'->>'fromLevel')::int;
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric, 0.5
    );
    v_evidence_level := coalesce(
      (p_settlement->'masteryVerification'->>'evidenceLevel')::int, 0
    );
    select id into v_existing_pending
    from public.mastery_verifications
    where user_id = p_user_id and skill_id = v_skill_id and status = 'pending';
    if v_existing_pending is null then
      insert into public.mastery_verifications (
        user_id, skill_id, skill_name, from_level, to_level, evidence_level,
        status, proposal_assessment_id, created_at
      ) values (
        p_user_id, v_skill_id, v_skill_name, v_from_level, v_to_level,
        v_evidence_level, 'pending', v_assessment_id, v_now
      )
      returning id into v_existing_pending;
    end if;
    v_verification := jsonb_build_object(
      'id', v_existing_pending,
      'skillId', v_skill_id,
      'skillName', v_skill_name,
      'fromLevel', v_from_level,
      'toLevel', v_to_level,
      'evidenceLevel', v_evidence_level,
      'status', 'pending',
      'proposalAssessmentId', v_assessment_id,
      'createdAt', v_now,
      'resolvedAt', null
    );
  end if;

  -- 12) Supersede sibling pending revisions of the same Activity.
  update public.ai_assessments
    set status = 'superseded', updated_at = v_now
    where activity_id = v_activity_id and id <> v_assessment_id and status = 'pending';

  -- 13) Confirm the assessment + Activity.
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
      'skillName', v_skill_name,
      'activityType', v_activity_type,
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
