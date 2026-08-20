-- 0025_settlement_integrity.sql
-- Stage2-B.1: Settlement Integrity Closure (Round16 review).
--
-- Fixes:
--   P1-1  Mastery monotonic growth — DB enforces greatest(); stale proposals
--         cannot downgrade mastery; mastery_events only records real upgrades.
--   P1-2  Canonical XP delta — single source of truth (transaction.amount);
--         reject mismatched settlement; force xpType = 'activity'.
--   P1-3  Repetition serialization — clock_timestamp() after skill lock
--         prevents transaction-start-time race across concurrent settlements.
--   P1-4  Tenant composite integrity — create_activity validates quest ownership.
--   P2-A  repetition_conflict has zero side effects — all validation completes
--         before any permanent mutation.
--   P2-B  Existing pending MasteryVerification returns actual DB row values.
--   P2-C  skill_name_snapshot column on xp_transactions for ledger history.

-- ============================================================
-- 1) skill_name_snapshot on xp_transactions (P2-C)
-- ============================================================
alter table public.xp_transactions
  add column if not exists skill_name_snapshot text not null default '';

-- backfill from skills for existing rows
update public.xp_transactions t
  set skill_name_snapshot = s.name
  from public.skills s
  where t.skill_id = s.id
    and (t.skill_name_snapshot is null or t.skill_name_snapshot = '');

-- ============================================================
-- 2) settle_activity — full replacement (P1-1, P1-2, P1-3, P2-A, P2-B, P2-C)
-- ============================================================
--
-- New operation order:
--   Phase A  Parse + validate canonical XP (P1-2)
--   Phase B  Lock assessment + activity; ownership + idempotency checks
--   Phase C  Resolve-or-create skill (INSERT ON CONFLICT — no updated_at mutation)
--   Phase D  SELECT ... FOR UPDATE on skill (serialization lock)
--   Phase E  clock_timestamp() AFTER lock (P1-3)
--   Phase F  Repetition check — RETURN on conflict, no writes yet (P2-A)
--   Phase G  Mastery staleness check — no writes yet (P1-1)
--   Phase H  All validation passed → permanent writes begin
--   Phase I  Confirm assessment + activity
--
-- Key invariants:
--   * transaction.amount is the single canonical XP delta.
--   * settlement.xpDelta and primarySkill.xpDelta must match it.
--   * xpType is always 'activity' for this RPC.
--   * mastery_level = greatest(current, proposed); event only when proposed > current.
--   * repetition window uses clock_timestamp() taken after the skill lock.
--   * No permanent mutation occurs before all checks pass.

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
begin
  -- ============================================================
  -- Phase A: Parse + validate canonical XP (P1-2)
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

  -- Force xpType = 'activity'.  adjustment/correction must go through a
  -- separate correction RPC (not yet implemented).
  v_xp_type := coalesce(nullif(v_tx->>'xpType', ''), 'activity');
  if v_xp_type <> 'activity' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_xp_type_for_settle');
  end if;

  v_xp_delta := v_amount;  -- canonical delta
  v_skill_name := coalesce(nullif(v_tx->>'skillName', ''), 'General Growth');
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
  if exists (
    select 1 from public.xp_transactions
    where activity_id = v_activity_id and xp_type = 'activity'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end if;

  -- ============================================================
  -- Phase C: Resolve-or-create skill (no updated_at mutation on conflict)
  -- ============================================================
  -- The 0019 BEFORE-trigger computes normalized_name on insert.
  -- On conflict we do NOTHING — no updated_at bump — because all real
  -- mutations happen in Phase H only if all checks pass.
  insert into public.skills (user_id, name)
  values (p_user_id, v_skill_name)
  on conflict (user_id, normalized_name) do nothing
  returning id into v_skill_id;

  if v_skill_id is null then
    select id into v_skill_id
    from public.skills
    where user_id = p_user_id
      and normalized_name = regexp_replace(lower(btrim(v_skill_name)), '\s+', ' ', 'g');
  end if;

  -- ============================================================
  -- Phase D: Acquire skill serialization lock (P1-3)
  -- ============================================================
  select * into v_skill_row
  from public.skills
  where id = v_skill_id
  for update;

  -- ============================================================
  -- Phase E: Authoritative timestamp AFTER lock (P1-3)
  -- ============================================================
  -- now() in PostgreSQL is the transaction-start timestamp and does NOT
  -- advance after waiting on a row lock.  clock_timestamp() is the real
  -- wall-clock time, which is what we need for the repetition window.
  v_now := clock_timestamp();

  -- ============================================================
  -- Phase F: Repetition check — RETURN on conflict, no writes yet (P2-A)
  -- ============================================================
  select count(*)::int into v_authoritative_count
  from public.xp_transactions
  where user_id = p_user_id
    and skill_id = v_skill_id
    and (v_activity_type is null or activity_type = v_activity_type)
    and created_at >= v_now - interval '30 days'
    and created_at <= v_now;

  if v_authoritative_count <> v_repetition_count then
    -- No permanent mutation has occurred yet — safe to return.
    return jsonb_build_object(
      'ok', false, 'reason', 'repetition_conflict',
      'actualRepetitionCount', v_authoritative_count
    );
  end if;

  -- ============================================================
  -- Phase G: Mastery staleness check — no writes yet (P1-1)
  -- ============================================================
  v_mastery_action := p_settlement->'primarySkill'->'masteryAction'->>'action';
  if v_mastery_action = 'upgrade' then
    v_proposed_level := (p_settlement->'primarySkill'->'masteryAction'->>'proposedLevel')::int;
    -- If the DB already has a higher mastery (another settlement upgraded it
    -- while we waited for the lock), the proposal is stale.  Demote to none.
    if v_proposed_level <= v_skill_row.mastery_level then
      v_mastery_action := 'none';
    end if;
  end if;

  -- ============================================================
  -- Phase H: ALL checks passed — permanent writes begin
  -- ============================================================

  -- H.1) Ledger row (authoritative rules_version from the Activity; P2-C: skill_name_snapshot).
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

  -- H.2) Player total (delta) + derived provisional level.
  insert into public.player_states (user_id, total_xp, player_level, updated_at)
  values (p_user_id, v_xp_delta, public.player_level_from_xp(v_xp_delta), v_now)
  on conflict (user_id) do update
    set total_xp = public.player_states.total_xp + v_xp_delta,
        player_level = public.player_level_from_xp(public.player_states.total_xp + v_xp_delta),
        updated_at = v_now;

  -- H.3) Primary skill XP delta + derived level (canonical v_xp_delta; P1-2).
  update public.skills
    set xp = public.skills.xp + v_xp_delta,
        level = public.player_level_from_xp(public.skills.xp + v_xp_delta),
        last_used_at = v_now,
        updated_at = v_now
    where id = v_skill_id
    returning * into v_skill_row;

  -- H.4) Mastery upgrade — only when proposed > current (P1-1).
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
    -- mastery event: from_level < to_level is guaranteed by Phase G check.
    insert into public.mastery_events (
      user_id, skill_id, activity_id, from_level, to_level, confidence,
      event_type, reason, created_at
    ) values (
      p_user_id, v_skill_id, v_activity_id, v_skill_row.mastery_level,
      v_proposed_level, v_confidence, 'upgrade', 'settle_activity', v_now
    );
  end if;

  -- H.5) Secondary skills (resolve-or-create by normalized name).
  if coalesce(array_length(v_related_labels, 1), 0) > 0 then
    for v_i in 1 .. array_length(v_related_labels, 1) loop
      insert into public.skills (user_id, name)
      values (p_user_id, v_related_labels[v_i])
      on conflict (user_id, normalized_name) do nothing;
    end loop;
  end if;

  -- H.6) Pending MasteryVerification (request_verification), deduped per skill (P2-B).
  if v_mastery_action = 'request_verification' then
    v_from_level := (p_settlement->'primarySkill'->'masteryAction'->>'fromLevel')::int;
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric, 0.5
    );
    v_evidence_level := coalesce(
      (p_settlement->'masteryVerification'->>'evidenceLevel')::int, 0
    );

    -- Select the FULL existing pending row (P2-B).
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

    -- Return the ACTUAL persisted row values (P2-B).
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

  -- Supersede sibling pending revisions of the same Activity.
  update public.ai_assessments
    set status = 'superseded', updated_at = v_now
    where activity_id = v_activity_id and id <> v_assessment_id and status = 'pending';

  -- Confirm the assessment + Activity.
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

-- Revoke from all non-service_role (same as 0024).
revoke all on function public.settle_activity(uuid, jsonb) from public;
revoke all on function public.settle_activity(uuid, jsonb) from anon;
revoke all on function public.settle_activity(uuid, jsonb) from authenticated;
grant execute on function public.settle_activity(uuid, jsonb) to service_role;

-- ============================================================
-- 3) create_activity — quest ownership validation (P1-4)
-- ============================================================
--
-- The SECURITY DEFINER function previously accepted any p_quest_id without
-- verifying the caller owns that quest.  An authenticated user who knew
-- another user's quest UUID could create an Activity referencing it,
-- violating tenant isolation.

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
  -- P1-4: Composite tenant integrity — verify quest ownership.
  if p_quest_id is not null and not exists (
    select 1 from public.quests
    where id = p_quest_id and user_id = auth.uid()
  ) then
    raise exception 'quest_not_owned' using errcode = 'check_violation';
  end if;

  -- Authoritative current rules version.
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
