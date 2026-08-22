-- 0037_skill_settlement_and_evidence.sql
-- Stage 5A: Skill Settlement Stable-ID Authority, Authoritative Evidence Persistence & Metadata RPC

-- ==============================================================================
-- 1. ATOMIC ACTIVITY SETTLEMENT RPC (Upgraded for SkillResolutionInput & Evidence)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.settle_activity(
  p_user_id uuid,
  p_settlement jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assessment_id uuid;
  v_xp_delta integer;
  v_activity_id uuid;
  v_skill_name text;
  v_normalized_skill_name text;
  v_skill_resolution_type text;
  v_skill_id uuid;
  v_skill_row public.skills;
  v_skill_is_new boolean := false;
  v_current_mastery integer;
  v_mastery_action text;
  v_proposed_level integer;
  v_confidence numeric;
  v_from_level integer;
  v_to_level integer;
  v_evidence_id uuid;
  v_evidence_level integer;
  v_evidence_explanation text;
  v_evidence_type text;
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
  v_rel_item jsonb;
  v_rel_res_type text;
  v_rel_proposed_name text;
  v_assessment public.ai_assessments;
  v_activity public.activities;
  v_primary_skill_xp_delta numeric;
  v_settlement_xp_delta integer;
  v_primary_skill_name text;
  v_quest public.quests;
  v_quest_progress_advance numeric;
  v_new_quest_progress numeric;
BEGIN
  -- ============================================================
  -- Phase A: Parse + validate canonical XP + parameters
  -- ============================================================
  v_assessment_id := (p_settlement->>'assessmentId')::uuid;
  v_tx := p_settlement->'transaction';
  v_amount := coalesce((v_tx->>'amount')::int, 0);

  v_settlement_xp_delta := coalesce((p_settlement->>'xpDelta')::int, v_amount);
  v_primary_skill_xp_delta := coalesce(
    (p_settlement->'primarySkill'->>'xpDelta')::numeric,
    v_amount
  );

  IF v_settlement_xp_delta <> v_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'xp_delta_mismatch');
  END IF;
  IF v_primary_skill_xp_delta <> v_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'skill_xp_delta_mismatch');
  END IF;
  IF v_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'negative_xp');
  END IF;

  v_xp_type := coalesce(nullif(v_tx->>'xpType', ''), 'activity');
  IF v_xp_type <> 'activity' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_xp_type_for_settle');
  END IF;

  v_xp_delta := v_amount;
  v_skill_name := coalesce(nullif(v_tx->>'skillName', ''), 'General Growth');
  v_primary_skill_name := coalesce(
    nullif(p_settlement->'primarySkill'->>'name', ''),
    v_skill_name
  );
  IF v_primary_skill_name <> v_skill_name THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'skill_name_mismatch');
  END IF;

  v_repetition_count := coalesce((v_tx->>'repetitionCount')::int, 0);
  v_activity_type := nullif(v_tx->>'activityType', '');
  v_transaction_id := coalesce((v_tx->>'id')::uuid, gen_random_uuid());
  v_base_amount := coalesce((v_tx->>'baseAmount')::int, 0);
  v_reason := v_tx->>'reason';
  v_modifier := coalesce(v_tx->'modifierJson', '{}'::jsonb);
  v_penalty := coalesce((v_tx->>'repetitionPenalty')::numeric, 1);

  -- ============================================================
  -- Phase B: Lock assessment + activity; ownership + idempotency
  -- ============================================================
  SELECT * INTO v_assessment
  FROM public.ai_assessments
  WHERE id = v_assessment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_assessment.user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
  END IF;
  IF v_assessment.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_confirmed');
  END IF;

  v_activity_id := v_assessment.activity_id;
  SELECT * INTO v_activity
  FROM public.activities
  WHERE id = v_activity_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'activity_not_found');
  END IF;
  IF v_activity.user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
  END IF;
  IF v_activity.status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_settled');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE activity_id = v_activity_id AND xp_type = 'activity'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_settled');
  END IF;

  -- ============================================================
  -- Phase C: Skill Resolution Authority (Blocker 1 - Stable ID Union)
  -- ============================================================
  v_skill_resolution_type := p_settlement->'primarySkill'->'skill'->>'resolution';

  IF v_skill_resolution_type = 'existing' THEN
    -- Resolution: Existing stable skill UUID
    v_skill_id := (p_settlement->'primarySkill'->'skill'->>'skillId')::uuid;
    IF v_skill_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_existing_skill_id');
    END IF;

    SELECT * INTO v_skill_row
    FROM public.skills
    WHERE id = v_skill_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'skill_not_found_or_not_owned');
    END IF;

    v_skill_name := v_skill_row.name;
    v_normalized_skill_name := v_skill_row.normalized_name;
    v_skill_is_new := false;

  ELSIF v_skill_resolution_type = 'create' THEN
    -- Resolution: User-confirmed new skill candidate
    v_skill_name := coalesce(nullif(btrim(p_settlement->'primarySkill'->'skill'->>'proposedName'), ''), 'General Growth');
    v_normalized_skill_name := regexp_replace(lower(v_skill_name), '\s+', ' ', 'g');

    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || '|' || v_normalized_skill_name));

    SELECT * INTO v_skill_row
    FROM public.skills
    WHERE user_id = p_user_id AND normalized_name = v_normalized_skill_name
    FOR UPDATE;

    IF FOUND THEN
      v_skill_id := v_skill_row.id;
      v_skill_name := v_skill_row.name;
      v_skill_is_new := false;
    ELSE
      v_skill_id := null;
      v_skill_is_new := true;
    END IF;

  ELSE
    -- Legacy fallback (string name in primarySkill.name or transaction.skillName)
    v_skill_name := coalesce(
      nullif(p_settlement->'primarySkill'->>'name', ''),
      nullif(v_tx->>'skillName', ''),
      'General Growth'
    );
    v_normalized_skill_name := regexp_replace(lower(btrim(v_skill_name)), '\s+', ' ', 'g');

    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || '|' || v_normalized_skill_name));

    SELECT * INTO v_skill_row
    FROM public.skills
    WHERE user_id = p_user_id AND normalized_name = v_normalized_skill_name
    FOR UPDATE;

    IF FOUND THEN
      v_skill_id := v_skill_row.id;
      v_skill_is_new := false;
    ELSE
      v_skill_id := null;
      v_skill_is_new := true;
    END IF;
  END IF;

  v_current_mastery := coalesce(v_skill_row.mastery_level, 1);

  -- ============================================================
  -- Phase D: Authoritative timestamp AFTER lock
  -- ============================================================
  v_now := clock_timestamp();

  -- ============================================================
  -- Phase E: Repetition check
  -- ============================================================
  IF v_skill_is_new THEN
    v_authoritative_count := 0;
  ELSE
    SELECT count(*)::int INTO v_authoritative_count
    FROM public.xp_transactions
    WHERE user_id = p_user_id
      AND skill_id = v_skill_id
      AND (v_activity_type IS NULL OR activity_type = v_activity_type)
      AND created_at >= v_now - interval '30 days'
      AND created_at <= v_now;
  END IF;

  IF v_authoritative_count <> v_repetition_count THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'repetition_conflict',
      'actualRepetitionCount', v_authoritative_count
    );
  END IF;

  -- ============================================================
  -- Phase F: Mastery staleness check (Preserving 3-State Protocol)
  -- ============================================================
  v_mastery_action := coalesce(p_settlement->'primarySkill'->'masteryAction'->>'action', 'none');

  IF v_mastery_action = 'upgrade' THEN
    v_proposed_level := (p_settlement->'primarySkill'->'masteryAction'->>'proposedLevel')::int;
    IF v_proposed_level <= v_current_mastery THEN
      v_mastery_action := 'none';
    END IF;
  ELSIF v_mastery_action = 'request_verification' THEN
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    IF v_to_level <= v_current_mastery THEN
      v_mastery_action := 'none';
    END IF;
  END IF;

  -- ============================================================
  -- Phase G: ALL checks passed — permanent writes begin
  -- ============================================================

  -- G.1) Create skill if new.
  IF v_skill_is_new THEN
    INSERT INTO public.skills (user_id, name)
    VALUES (p_user_id, v_skill_name)
    ON CONFLICT (user_id, normalized_name) DO UPDATE
      SET updated_at = public.skills.updated_at
    RETURNING * INTO v_skill_row;
    v_skill_id := v_skill_row.id;
  END IF;

  -- G.2) Ledger row (xp_transactions).
  v_rules_version := v_activity.rules_version;
  INSERT INTO public.xp_transactions (
    id, user_id, activity_id, assessment_id, skill_id, activity_type,
    repetition_count, repetition_penalty, xp_type, amount, base_amount,
    modifier_json, reason, rules_version, skill_name_snapshot, created_at
  ) VALUES (
    v_transaction_id, p_user_id, v_activity_id, v_assessment_id, v_skill_id,
    v_activity_type, v_repetition_count, v_penalty, v_xp_type,
    v_amount, v_base_amount, v_modifier, v_reason, v_rules_version,
    v_skill_name, v_now
  )
  RETURNING * INTO v_tx_row;

  -- G.3) Authoritative Evidence Persistence (public.evidence_records)
  v_evidence_id := coalesce((p_settlement->'evidence'->>'id')::uuid, gen_random_uuid());
  v_evidence_level := coalesce(
    (p_settlement->'evidence'->>'level')::int,
    (p_settlement->'masteryVerification'->>'evidenceLevel')::int,
    0
  );
  v_evidence_explanation := coalesce(
    p_settlement->'evidence'->>'explanation',
    p_settlement->'evidence'->>'description',
    v_reason
  );
  v_evidence_type := coalesce(
    p_settlement->'evidence'->>'type',
    v_activity_type,
    'activity_output'
  );

  INSERT INTO public.evidence_records (
    id, user_id, activity_id, skill_id, evidence_level,
    evidence_type, description, verified, created_at
  ) VALUES (
    v_evidence_id, p_user_id, v_activity_id, v_skill_id, v_evidence_level,
    v_evidence_type, v_evidence_explanation,
    (v_mastery_action <> 'request_verification'),
    v_now
  );

  -- G.4) Player total + derived level.
  INSERT INTO public.player_states (user_id, total_xp, player_level, updated_at)
  VALUES (p_user_id, v_xp_delta, public.player_level_from_xp(v_xp_delta), v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = public.player_states.total_xp + v_xp_delta,
        player_level = public.player_level_from_xp(public.player_states.total_xp + v_xp_delta),
        updated_at = v_now;

  -- G.5) Primary skill XP delta + derived level.
  UPDATE public.skills
    SET xp = public.skills.xp + v_xp_delta,
        level = public.player_level_from_xp(public.skills.xp + v_xp_delta),
        last_used_at = v_now,
        updated_at = v_now
    WHERE id = v_skill_id
    RETURNING * INTO v_skill_row;

  -- G.6) Mastery action handling (upgrade vs request_verification vs none).
  IF v_mastery_action = 'upgrade' THEN
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric,
      v_skill_row.mastery_confidence
    );
    UPDATE public.skills
      SET mastery_level = v_proposed_level,
          mastery_confidence = v_confidence,
          updated_at = v_now
      WHERE id = v_skill_id;

    INSERT INTO public.mastery_events (
      user_id, skill_id, activity_id, evidence_id, from_level, to_level,
      confidence, event_type, reason, created_at
    ) VALUES (
      p_user_id, v_skill_id, v_activity_id, v_evidence_id, v_current_mastery,
      v_proposed_level, v_confidence, 'upgrade', 'settle_activity', v_now
    );

  ELSIF v_mastery_action = 'request_verification' THEN
    v_from_level := v_current_mastery;
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric, 0.5
    );

    SELECT * INTO v_existing_pending
    FROM public.mastery_verifications
    WHERE user_id = p_user_id AND skill_id = v_skill_id AND status = 'pending';

    IF v_existing_pending.id IS NULL THEN
      INSERT INTO public.mastery_verifications (
        user_id, skill_id, skill_name, from_level, to_level, evidence_level,
        status, proposal_assessment_id, created_at
      ) VALUES (
        p_user_id, v_skill_id, v_skill_name, v_from_level, v_to_level,
        v_evidence_level, 'pending', v_assessment_id, v_now
      )
      RETURNING * INTO v_existing_pending;
    END IF;

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
  END IF;

  -- G.7) Secondary skills resolution (Supports SkillResolutionInput union or string array)
  IF p_settlement->'relatedSkillResolutions' IS NOT NULL AND jsonb_typeof(p_settlement->'relatedSkillResolutions') = 'array' THEN
    FOR v_rel_item IN SELECT * FROM jsonb_array_elements(p_settlement->'relatedSkillResolutions') LOOP
      v_rel_res_type := v_rel_item->>'resolution';
      IF v_rel_res_type = 'create' THEN
        v_rel_proposed_name := btrim(v_rel_item->>'proposedName');
        IF v_rel_proposed_name IS NOT NULL AND v_rel_proposed_name <> '' THEN
          INSERT INTO public.skills (user_id, name)
          VALUES (p_user_id, v_rel_proposed_name)
          ON CONFLICT (user_id, normalized_name) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  ELSIF p_settlement->'relatedSkillLabels' IS NOT NULL AND jsonb_typeof(p_settlement->'relatedSkillLabels') = 'array' THEN
    FOR v_rel_proposed_name IN SELECT * FROM jsonb_array_elements_text(p_settlement->'relatedSkillLabels') LOOP
      IF v_rel_proposed_name IS NOT NULL AND btrim(v_rel_proposed_name) <> '' THEN
        INSERT INTO public.skills (user_id, name)
        VALUES (p_user_id, btrim(v_rel_proposed_name))
        ON CONFLICT (user_id, normalized_name) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- G.8) Linked Quest progress advancement & roll-up
  IF v_activity.quest_id IS NOT NULL THEN
    SELECT * INTO v_quest
    FROM public.quests
    WHERE id = v_activity.quest_id AND user_id = p_user_id
    FOR UPDATE;

    IF v_quest.id IS NOT NULL AND v_quest.status NOT IN ('archived', 'failed') THEN
      v_quest_progress_advance := coalesce(
        (p_settlement->>'questProgressDelta')::numeric,
        round(coalesce(v_activity.effective_minutes, 40) / 2),
        20
      );
      v_new_quest_progress := least(100, v_quest.progress + v_quest_progress_advance);

      UPDATE public.quests
      SET progress = v_new_quest_progress,
          status = CASE
            WHEN v_new_quest_progress >= 100 THEN 'completed'
            WHEN v_quest.status = 'available' THEN 'active'
            ELSE v_quest.status
          END,
          completed_at = CASE
            WHEN v_new_quest_progress >= 100 THEN coalesce(v_quest.completed_at, v_now)
            ELSE v_quest.completed_at
          END,
          updated_at = v_now
      WHERE id = v_quest.id;

      PERFORM public.recompute_quest_chain(p_user_id, v_activity.quest_id);
    END IF;
  END IF;

  -- ============================================================
  -- Phase H: Confirm assessment + activity
  -- ============================================================
  UPDATE public.ai_assessments
    SET status = 'superseded', updated_at = v_now
    WHERE activity_id = v_activity_id AND id <> v_assessment_id AND status = 'pending';

  UPDATE public.ai_assessments
    SET status = 'confirmed', confirmed_at = v_now, updated_at = v_now
    WHERE id = v_assessment_id;

  UPDATE public.activities
    SET status = 'confirmed', updated_at = v_now
    WHERE id = v_activity_id;

  RETURN jsonb_build_object(
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
END;
$$;

REVOKE ALL ON FUNCTION public.settle_activity(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_activity(uuid, jsonb) TO service_role;

-- ==============================================================================
-- 2. SKILL METADATA MUTATION RPC (Whitelist & Domain Ownership Check)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_skill_metadata(
  p_skill_id UUID,
  p_name TEXT,
  p_aliases TEXT[],
  p_description TEXT,
  p_domain_id UUID,
  p_status TEXT
)
RETURNS public.skills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skill public.skills;
  v_old_name TEXT;
  v_new_aliases TEXT[];
  v_new_normalized TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Ownership validation on skill
  SELECT * INTO v_skill FROM public.skills
  WHERE id = p_skill_id AND user_id = auth.uid()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found or access denied';
  END IF;

  -- 2. Domain tenant ownership validation (Blocker 2B)
  IF p_domain_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.domains WHERE id = p_domain_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Invalid domain_id or cross-tenant domain access denied';
    END IF;
  END IF;

  v_old_name := v_skill.name;
  v_new_aliases := coalesce(p_aliases, '{}'::text[]);

  -- 3. Rename Alias Conservation: If name changed, append old name to aliases
  IF p_name IS NOT NULL AND btrim(p_name) <> '' AND btrim(p_name) <> v_old_name THEN
    IF NOT (v_old_name = ANY(v_new_aliases)) THEN
      v_new_aliases := array_append(v_new_aliases, v_old_name);
    END IF;
    
    -- Check normalized conflict with other skills of this user
    v_new_normalized := regexp_replace(lower(btrim(p_name)), '\s+', ' ', 'g');
    IF EXISTS (
      SELECT 1 FROM public.skills
      WHERE user_id = auth.uid()
        AND normalized_name = v_new_normalized
        AND id <> p_skill_id
    ) THEN
      RAISE EXCEPTION 'A skill with normalized name "%" already exists for this user', v_new_normalized;
    END IF;
  END IF;

  -- 4. Status validation
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- 5. Whitelist Update (XP, Level, Mastery strictly untouched)
  UPDATE public.skills
  SET
    name = coalesce(nullif(btrim(p_name), ''), name),
    aliases = v_new_aliases,
    description = p_description,
    domain_id = p_domain_id,
    status = coalesce(p_status, status),
    updated_at = v_now
  WHERE id = p_skill_id AND user_id = auth.uid()
  RETURNING * INTO v_skill;

  RETURN v_skill;
END;
$$;

REVOKE ALL ON FUNCTION public.update_skill_metadata(UUID, TEXT, TEXT[], TEXT, UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_skill_metadata(UUID, TEXT, TEXT[], TEXT, UUID, TEXT) TO authenticated;

-- ==============================================================================
-- 3. REVOKE DIRECT UPDATE ON PUBLIC.SKILLS FOR AUTHENTICATED
-- ==============================================================================
REVOKE UPDATE ON public.skills FROM authenticated;
