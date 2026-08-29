-- 0042_artifact_settlement_integration.sql
-- Stage 7B: Artifact Proposal Resolution & Atomic Settlement Integration

-- ==============================================================================
-- 1. UPGRADE ATOMIC ACTIVITY SETTLEMENT RPC (Supports ArtifactResolutionInput)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.settle_activity(
  p_user_id uuid,
  p_settlement jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_rel_item jsonb;
  v_rel_res_type text;
  v_rel_proposed_name text;
  v_rel_skill_id uuid;
  v_rel_existing_id uuid;
  v_assessment public.ai_assessments;
  v_activity public.activities;
  v_primary_skill_xp_delta numeric;
  v_settlement_xp_delta integer;
  v_primary_skill_name text;
  v_quest public.quests;
  v_quest_progress_advance numeric;
  v_new_quest_progress numeric;

  -- Stage 7B Artifact resolution variables
  v_stored_proposals jsonb;
  v_proposal_count integer := 0;
  v_resolutions jsonb;
  v_res_count integer := 0;
  v_res_item jsonb;
  v_res_idx integer;
  v_res_type text;
  v_prop_item jsonb;
  v_art_title text;
  v_art_norm_title text;
  v_art_type text;
  v_art_summary text;
  v_art_description text;
  v_art_version text;
  v_art_storage_path text;
  v_art_external_url text;
  v_art_reusability numeric;
  v_art_metadata jsonb;
  v_new_art_id uuid;
  v_existing_art_id uuid;
  v_art_role text;
  v_sid_text text;
  v_kid_text text;
  v_qid_text text;
  v_seen_indices integer[];
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
  -- Phase C: Skill Resolution Authority (Strict Stable ID Union - NO BYPASS)
  -- ============================================================
  IF p_settlement->'primarySkill'->'skill' IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_or_invalid_skill_resolution');
  END IF;

  v_skill_resolution_type := p_settlement->'primarySkill'->'skill'->>'resolution';

  IF v_skill_resolution_type = 'existing' THEN
    -- Resolution: Existing stable skill UUID (Must exist and belong to tenant)
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
    -- Resolution: User-confirmed new skill candidate (Empty name MUST REJECT)
    v_skill_name := btrim(coalesce(p_settlement->'primarySkill'->'skill'->>'proposedName', ''));
    IF v_skill_name = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'empty_proposed_skill_name');
    END IF;
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
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_or_invalid_skill_resolution');
  END IF;

  -- Phase C.2: Validate secondary skill resolutions if present
  IF p_settlement->'relatedSkillResolutions' IS NOT NULL AND jsonb_typeof(p_settlement->'relatedSkillResolutions') = 'array' THEN
    FOR v_rel_item IN SELECT * FROM jsonb_array_elements(p_settlement->'relatedSkillResolutions') LOOP
      v_rel_res_type := v_rel_item->>'resolution';
      IF v_rel_res_type = 'existing' THEN
        v_rel_skill_id := (v_rel_item->>'skillId')::uuid;
        IF v_rel_skill_id IS NULL THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_related_skill_id');
        END IF;
        SELECT id INTO v_rel_existing_id
        FROM public.skills
        WHERE id = v_rel_skill_id AND user_id = p_user_id;
        IF NOT FOUND THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'related_skill_not_found_or_not_owned');
        END IF;
      ELSIF v_rel_res_type = 'create' THEN
        v_rel_proposed_name := btrim(coalesce(v_rel_item->>'proposedName', ''));
        IF v_rel_proposed_name = '' THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'empty_related_skill_proposed_name');
        END IF;
      ELSE
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_related_skill_resolution');
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- Phase C.3: Stage 7B Artifact Resolution Authority & Coverage Validation
  -- ============================================================
  v_stored_proposals := coalesce(
    v_assessment.assessment_json->'proposal'->'artifactProposals',
    v_assessment.assessment_json->'artifactProposals',
    '[]'::jsonb
  );
  IF jsonb_typeof(v_stored_proposals) = 'array' THEN
    v_proposal_count := jsonb_array_length(v_stored_proposals);
  ELSE
    v_proposal_count := 0;
  END IF;

  v_resolutions := p_settlement->'artifactResolutions';

  IF v_proposal_count > 0 THEN
    IF v_resolutions IS NULL OR jsonb_typeof(v_resolutions) <> 'array' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'incomplete_proposal_coverage');
    END IF;

    v_res_count := jsonb_array_length(v_resolutions);
    IF v_res_count <> v_proposal_count THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'incomplete_proposal_coverage');
    END IF;

    v_seen_indices := ARRAY[]::integer[];

    FOR v_res_item IN SELECT * FROM jsonb_array_elements(v_resolutions) LOOP
      IF v_res_item->>'proposalIndex' IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'missing_proposal_index');
      END IF;

      BEGIN
        v_res_idx := (v_res_item->>'proposalIndex')::int;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_proposal_index');
      END;

      IF v_res_idx < 0 OR v_res_idx >= v_proposal_count THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'out_of_range_proposal_index');
      END IF;

      IF v_res_idx = ANY(v_seen_indices) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_proposal_index');
      END IF;

      v_seen_indices := array_append(v_seen_indices, v_res_idx);

      v_res_type := v_res_item->>'resolution';
      v_prop_item := v_stored_proposals->v_res_idx;

      IF v_res_type = 'create' THEN
        v_art_title := btrim(coalesce(
          v_res_item->'approvedOverrides'->>'title',
          v_prop_item->>'title',
          ''
        ));
        IF v_art_title = '' THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'empty_artifact_title');
        END IF;

        v_art_norm_title := regexp_replace(lower(v_art_title), '\s+', ' ', 'g');

        -- Advisory lock on normalized title to avoid race condition
        PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || '|art|' || v_art_norm_title));

        IF EXISTS (
          SELECT 1 FROM public.artifacts
          WHERE user_id = p_user_id AND normalized_title = v_art_norm_title
        ) THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'artifact_title_conflict');
        END IF;

      ELSIF v_res_type = 'existing' THEN
        BEGIN
          v_existing_art_id := (v_res_item->>'artifactId')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_existing_artifact_id');
        END;

        IF v_existing_art_id IS NULL THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_existing_artifact_id');
        END IF;

        PERFORM 1 FROM public.artifacts
        WHERE id = v_existing_art_id AND user_id = p_user_id;

        IF NOT FOUND THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'artifact_not_found_or_not_owned');
        END IF;

        v_art_role := coalesce(v_res_item->>'activityRole', 'modified');
        IF v_art_role NOT IN ('modified', 'referenced') THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_activity_role');
        END IF;

      ELSIF v_res_type = 'ignore' THEN
        -- Valid no-op
      ELSE
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_artifact_resolution');
      END IF;
    END LOOP;

  ELSE
    -- Zero stored proposals: resolutions must be omitted or empty
    IF v_resolutions IS NOT NULL AND jsonb_typeof(v_resolutions) = 'array' AND jsonb_array_length(v_resolutions) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unexpected_artifact_resolutions');
    END IF;
  END IF;

  v_current_mastery := coalesce(v_skill_row.mastery_level, 1);
  v_now := clock_timestamp();

  -- ============================================================
  -- Phase D: Evidence preparation (P2 Authority)
  -- ============================================================
  v_evidence_id := coalesce((p_settlement->'evidence'->>'id')::uuid, gen_random_uuid());
  v_evidence_level := coalesce((p_settlement->'evidence'->>'level')::int, (p_settlement->'masteryVerification'->>'evidenceLevel')::int, 1);
  v_evidence_explanation := coalesce(p_settlement->'evidence'->>'explanation', v_reason);
  v_evidence_type := coalesce(p_settlement->'evidence'->>'type', v_activity_type, 'activity_output');

  -- ============================================================
  -- Phase E: Repetition count derivation & check
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

  -- G.3) Authoritative Evidence Persistence (Unified Stage 5A verified semantics)
  INSERT INTO public.evidence_records (
    id, user_id, activity_id, skill_id, evidence_level, evidence_type,
    description, verified, created_at
  ) VALUES (
    v_evidence_id, p_user_id, v_activity_id, v_skill_id, v_evidence_level,
    v_evidence_type, v_evidence_explanation, (v_mastery_action <> 'request_verification'), v_now
  );

  -- G.4) Player XP + Level recompute.
  UPDATE public.player_states
    SET total_xp = public.player_states.total_xp + v_xp_delta,
        player_level = public.player_level_from_xp(public.player_states.total_xp + v_xp_delta),
        updated_at = v_now
    WHERE user_id = p_user_id;

  -- G.5) Skill XP + Level recompute.
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

  -- G.7) Secondary skills resolution (Strict SkillResolutionInput array)
  IF p_settlement->'relatedSkillResolutions' IS NOT NULL AND jsonb_typeof(p_settlement->'relatedSkillResolutions') = 'array' THEN
    FOR v_rel_item IN SELECT * FROM jsonb_array_elements(p_settlement->'relatedSkillResolutions') LOOP
      v_rel_res_type := v_rel_item->>'resolution';
      IF v_rel_res_type = 'create' THEN
        v_rel_proposed_name := btrim(coalesce(v_rel_item->>'proposedName', ''));
        IF v_rel_proposed_name <> '' THEN
          INSERT INTO public.skills (user_id, name)
          VALUES (p_user_id, v_rel_proposed_name)
          ON CONFLICT (user_id, normalized_name) DO NOTHING;
        END IF;
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

  -- G.9) Stage 7B Artifact Resolutions Execution
  IF v_proposal_count > 0 AND v_resolutions IS NOT NULL THEN
    FOR v_res_item IN SELECT * FROM jsonb_array_elements(v_resolutions) LOOP
      v_res_idx := (v_res_item->>'proposalIndex')::int;
      v_res_type := v_res_item->>'resolution';
      v_prop_item := v_stored_proposals->v_res_idx;

      IF v_res_type = 'create' THEN
        v_new_art_id := gen_random_uuid();
        v_art_title := btrim(coalesce(
          v_res_item->'approvedOverrides'->>'title',
          v_prop_item->>'title',
          ''
        ));
        v_art_type := coalesce(
          v_res_item->'approvedOverrides'->>'artifactType',
          v_prop_item->>'artifactType',
          'other'
        );
        v_art_summary := coalesce(
          v_res_item->'approvedOverrides'->>'summary',
          v_prop_item->>'summary'
        );
        v_art_description := coalesce(
          v_res_item->'approvedOverrides'->>'description',
          v_prop_item->>'description'
        );
        v_art_version := coalesce(
          v_res_item->'approvedOverrides'->>'version',
          v_prop_item->>'version',
          '1.0'
        );
        v_art_storage_path := coalesce(
          v_res_item->'approvedOverrides'->>'storagePath',
          v_prop_item->>'storagePath'
        );
        v_art_external_url := coalesce(
          v_res_item->'approvedOverrides'->>'externalUrl',
          v_prop_item->>'externalUrl'
        );
        v_art_reusability := coalesce(
          (v_res_item->'approvedOverrides'->>'reusabilityScore')::numeric,
          (v_prop_item->>'reusabilityScore')::numeric,
          0.00
        );
        v_art_metadata := coalesce(
          v_prop_item->'metadata',
          '{}'::jsonb
        );

        INSERT INTO public.artifacts (
          id, user_id, title, artifact_type, summary, description,
          lifecycle_status, version, storage_path, external_url,
          reusability_score, metadata, is_archived, archived_at,
          created_at, updated_at
        ) VALUES (
          v_new_art_id, p_user_id, v_art_title, v_art_type, v_art_summary, v_art_description,
          'active', v_art_version, v_art_storage_path, v_art_external_url,
          v_art_reusability, v_art_metadata, false, null,
          v_now, v_now
        );

        INSERT INTO public.artifact_activities (
          user_id, artifact_id, activity_id, activity_role, created_at
        ) VALUES (
          p_user_id, v_new_art_id, v_activity_id, 'produced', v_now
        );

        -- Optional relational links from proposal with fail-closed tenant validation
        IF v_prop_item->'skillIds' IS NOT NULL AND jsonb_typeof(v_prop_item->'skillIds') = 'array' THEN
          FOR v_sid_text IN SELECT * FROM jsonb_array_elements_text(v_prop_item->'skillIds') LOOP
            IF NOT EXISTS (SELECT 1 FROM public.skills WHERE id = v_sid_text::uuid AND user_id = p_user_id) THEN
              RAISE EXCEPTION 'skill_not_found_or_not_owned' USING ERRCODE = 'P0002';
            END IF;
            INSERT INTO public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level, created_at)
            VALUES (p_user_id, v_new_art_id, v_sid_text::uuid, 1, v_now)
            ON CONFLICT (user_id, artifact_id, skill_id) DO NOTHING;
          END LOOP;
        END IF;

        IF v_prop_item->'knowledgeNodeIds' IS NOT NULL AND jsonb_typeof(v_prop_item->'knowledgeNodeIds') = 'array' THEN
          FOR v_kid_text IN SELECT * FROM jsonb_array_elements_text(v_prop_item->'knowledgeNodeIds') LOOP
            IF NOT EXISTS (SELECT 1 FROM public.knowledge_nodes WHERE id = v_kid_text::uuid AND user_id = p_user_id) THEN
              RAISE EXCEPTION 'knowledge_node_not_found_or_not_owned' USING ERRCODE = 'P0002';
            END IF;
            INSERT INTO public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type, created_at)
            VALUES (p_user_id, v_new_art_id, v_kid_text::uuid, 'synthesizes', v_now)
            ON CONFLICT (user_id, artifact_id, node_id) DO NOTHING;
          END LOOP;
        END IF;

        IF v_prop_item->'questIds' IS NOT NULL AND jsonb_typeof(v_prop_item->'questIds') = 'array' THEN
          FOR v_qid_text IN SELECT * FROM jsonb_array_elements_text(v_prop_item->'questIds') LOOP
            IF NOT EXISTS (SELECT 1 FROM public.quests WHERE id = v_qid_text::uuid AND user_id = p_user_id) THEN
              RAISE EXCEPTION 'quest_not_found_or_not_owned' USING ERRCODE = 'P0002';
            END IF;
            INSERT INTO public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable, created_at)
            VALUES (p_user_id, v_new_art_id, v_qid_text::uuid, false, v_now)
            ON CONFLICT (user_id, artifact_id, quest_id) DO NOTHING;
          END LOOP;
        END IF;

      ELSIF v_res_type = 'existing' THEN
        v_existing_art_id := (v_res_item->>'artifactId')::uuid;
        v_art_role := coalesce(v_res_item->>'activityRole', 'modified');

        INSERT INTO public.artifact_activities (
          user_id, artifact_id, activity_id, activity_role, created_at
        ) VALUES (
          p_user_id, v_existing_art_id, v_activity_id, v_art_role, v_now
        )
        ON CONFLICT (user_id, artifact_id, activity_id)
        DO UPDATE SET activity_role = v_art_role;

      ELSIF v_res_type = 'ignore' THEN
        -- Zero writes
      END IF;
    END LOOP;
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
      'userId', v_tx_row.user_id,
      'activityId', v_tx_row.activity_id,
      'assessmentId', v_tx_row.assessment_id,
      'skillId', v_tx_row.skill_id,
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

-- Explicit permissions: settle_activity is strictly service_role only
REVOKE ALL ON FUNCTION public.settle_activity(uuid, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.settle_activity(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.settle_activity(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_activity(uuid, jsonb) TO service_role;


-- ==============================================================================
-- 2. TRANSACTIONAL ARTIFACT CREATION WITH INITIAL LINKS (FAIL-CLOSED)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_artifact_with_links(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_title text;
  v_norm_title text;
  v_type text;
  v_summary text;
  v_description text;
  v_status text;
  v_version text;
  v_storage_path text;
  v_external_url text;
  v_reusability_score numeric;
  v_metadata jsonb;
  v_artifact_row public.artifacts;
  v_item text;
  v_now timestamptz := clock_timestamp();
BEGIN
  -- Multi-tenant security check
  IF v_caller_id IS NOT NULL AND v_caller_id <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  v_title := btrim(p_payload->>'title');
  IF v_title IS NULL OR v_title = '' THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = '22023';
  END IF;

  v_norm_title := lower(regexp_replace(v_title, '\s+', ' ', 'g'));
  IF EXISTS (
    SELECT 1 FROM public.artifacts
    WHERE user_id = p_user_id AND normalized_title = v_norm_title
  ) THEN
    RAISE EXCEPTION 'artifact_title_conflict' USING ERRCODE = '23505';
  END IF;

  v_type := p_payload->>'artifactType';
  IF v_type NOT IN ('document', 'code_repository', 'design_spec', 'data_analysis', 'presentation', 'synthesis_note', 'creative_work', 'other') THEN
    RAISE EXCEPTION 'invalid_artifact_type' USING ERRCODE = '22023';
  END IF;


  v_status := coalesce(p_payload->>'lifecycleStatus', 'active');
  IF v_status NOT IN ('draft', 'active', 'archived', 'superseded') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  v_summary := p_payload->>'summary';
  v_description := p_payload->>'description';
  v_version := coalesce(p_payload->>'version', '1.0');
  v_storage_path := p_payload->>'storagePath';
  v_external_url := p_payload->>'externalUrl';
  v_reusability_score := coalesce((p_payload->>'reusabilityScore')::numeric, 0.0);
  IF v_reusability_score < 0.0 OR v_reusability_score > 1.0 THEN
    RAISE EXCEPTION 'invalid_score' USING ERRCODE = '22023';
  END IF;
  v_metadata := coalesce(p_payload->'metadata', '{}'::jsonb);

  -- 1. Fail-closed tenant validation of all initial link targets
  IF p_payload ? 'activityIds' AND jsonb_typeof(p_payload->'activityIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'activityIds') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.activities WHERE id = v_item::uuid AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'activity_not_found_or_not_owned' USING ERRCODE = 'P0002';
      END IF;
    END LOOP;
  END IF;

  IF p_payload ? 'skillIds' AND jsonb_typeof(p_payload->'skillIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'skillIds') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.skills WHERE id = v_item::uuid AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'skill_not_found_or_not_owned' USING ERRCODE = 'P0002';
      END IF;
    END LOOP;
  END IF;

  IF p_payload ? 'knowledgeNodeIds' AND jsonb_typeof(p_payload->'knowledgeNodeIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'knowledgeNodeIds') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.knowledge_nodes WHERE id = v_item::uuid AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'knowledge_node_not_found_or_not_owned' USING ERRCODE = 'P0002';
      END IF;
    END LOOP;
  END IF;

  IF p_payload ? 'questIds' AND jsonb_typeof(p_payload->'questIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'questIds') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.quests WHERE id = v_item::uuid AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'quest_not_found_or_not_owned' USING ERRCODE = 'P0002';
      END IF;
    END LOOP;
  END IF;

  IF p_payload ? 'evidenceIds' AND jsonb_typeof(p_payload->'evidenceIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'evidenceIds') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.evidence_records WHERE id = v_item::uuid AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'evidence_not_found_or_not_owned' USING ERRCODE = 'P0002';
      END IF;
    END LOOP;
  END IF;

  -- 2. Insert Artifact
  INSERT INTO public.artifacts (
    user_id,
    title,
    artifact_type,
    summary,
    description,
    lifecycle_status,
    version,
    storage_path,
    external_url,
    reusability_score,
    metadata,
    is_archived,
    archived_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_title,
    v_type,
    v_summary,
    v_description,
    v_status,
    v_version,
    v_storage_path,
    v_external_url,
    v_reusability_score,
    v_metadata,
    (v_status = 'archived'),
    CASE WHEN v_status = 'archived' THEN v_now ELSE NULL END,
    v_now,
    v_now
  ) RETURNING * INTO v_artifact_row;

  -- 3. Insert initial relations atomically
  IF p_payload ? 'activityIds' AND jsonb_typeof(p_payload->'activityIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'activityIds') LOOP
      INSERT INTO public.artifact_activities (user_id, artifact_id, activity_id, activity_role, created_at)
      VALUES (p_user_id, v_artifact_row.id, v_item::uuid, 'produced', v_now)
      ON CONFLICT (user_id, artifact_id, activity_id) DO NOTHING;
    END LOOP;
  END IF;

  IF p_payload ? 'skillIds' AND jsonb_typeof(p_payload->'skillIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'skillIds') LOOP
      INSERT INTO public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level, created_at)
      VALUES (p_user_id, v_artifact_row.id, v_item::uuid, 1, v_now)
      ON CONFLICT (user_id, artifact_id, skill_id) DO NOTHING;
    END LOOP;
  END IF;

  IF p_payload ? 'knowledgeNodeIds' AND jsonb_typeof(p_payload->'knowledgeNodeIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'knowledgeNodeIds') LOOP
      INSERT INTO public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type, created_at)
      VALUES (p_user_id, v_artifact_row.id, v_item::uuid, 'synthesizes', v_now)
      ON CONFLICT (user_id, artifact_id, node_id) DO NOTHING;
    END LOOP;
  END IF;

  IF p_payload ? 'questIds' AND jsonb_typeof(p_payload->'questIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'questIds') LOOP
      INSERT INTO public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable, created_at)
      VALUES (p_user_id, v_artifact_row.id, v_item::uuid, false, v_now)
      ON CONFLICT (user_id, artifact_id, quest_id) DO NOTHING;
    END LOOP;
  END IF;

  IF p_payload ? 'evidenceIds' AND jsonb_typeof(p_payload->'evidenceIds') = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements_text(p_payload->'evidenceIds') LOOP
      INSERT INTO public.artifact_evidence (user_id, artifact_id, evidence_id, created_at)
      VALUES (p_user_id, v_artifact_row.id, v_item::uuid, v_now)
      ON CONFLICT (user_id, artifact_id, evidence_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN to_jsonb(v_artifact_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_artifact_with_links(uuid, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_artifact_with_links(uuid, jsonb) FROM anon;


-- ==============================================================================
-- 3. TRANSACTIONAL BATCH ARTIFACT LINK MUTATION (FAIL-CLOSED)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.manage_artifact_links(
  p_user_id uuid,
  p_artifact_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_item jsonb;
  v_act_id uuid;
  v_sk_id uuid;
  v_node_id uuid;
  v_q_id uuid;
  v_ev_id uuid;
  v_action text;
  v_role text;
  v_level int;
  v_rel text;
  v_primary boolean;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_caller_id IS NOT NULL AND v_caller_id <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  -- 1. Artifact must exist and belong to user
  IF NOT EXISTS (SELECT 1 FROM public.artifacts WHERE id = p_artifact_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'artifact_not_found_or_not_owned' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Process Activities
  IF p_payload ? 'activities' AND jsonb_typeof(p_payload->'activities') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'activities') LOOP
      v_act_id := (v_item->>'activityId')::uuid;
      v_action := v_item->>'action';
      IF v_action = 'attach' THEN
        IF NOT EXISTS (SELECT 1 FROM public.activities WHERE id = v_act_id AND user_id = p_user_id) THEN
          RAISE EXCEPTION 'activity_not_found_or_not_owned' USING ERRCODE = 'P0002';
        END IF;
        v_role := coalesce(v_item->>'activityRole', 'produced');
        INSERT INTO public.artifact_activities (user_id, artifact_id, activity_id, activity_role, created_at)
        VALUES (p_user_id, p_artifact_id, v_act_id, v_role, v_now)
        ON CONFLICT (user_id, artifact_id, activity_id)
        DO UPDATE SET activity_role = v_role;
      ELSIF v_action = 'detach' THEN
        DELETE FROM public.artifact_activities
        WHERE user_id = p_user_id AND artifact_id = p_artifact_id AND activity_id = v_act_id;
      END IF;
    END LOOP;
  END IF;

  -- 3. Process Skills
  IF p_payload ? 'skills' AND jsonb_typeof(p_payload->'skills') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'skills') LOOP
      v_sk_id := (v_item->>'skillId')::uuid;
      v_action := v_item->>'action';
      IF v_action = 'attach' THEN
        IF NOT EXISTS (SELECT 1 FROM public.skills WHERE id = v_sk_id AND user_id = p_user_id) THEN
          RAISE EXCEPTION 'skill_not_found_or_not_owned' USING ERRCODE = 'P0002';
        END IF;
        v_level := coalesce((v_item->>'demonstrationLevel')::int, 1);
        INSERT INTO public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level, created_at)
        VALUES (p_user_id, p_artifact_id, v_sk_id, v_level, v_now)
        ON CONFLICT (user_id, artifact_id, skill_id)
        DO UPDATE SET demonstration_level = v_level;
      ELSIF v_action = 'detach' THEN
        DELETE FROM public.artifact_skills
        WHERE user_id = p_user_id AND artifact_id = p_artifact_id AND skill_id = v_sk_id;
      END IF;
    END LOOP;
  END IF;

  -- 4. Process Knowledge Nodes
  IF p_payload ? 'knowledgeNodes' AND jsonb_typeof(p_payload->'knowledgeNodes') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'knowledgeNodes') LOOP
      v_node_id := (v_item->>'nodeId')::uuid;
      v_action := v_item->>'action';
      IF v_action = 'attach' THEN
        IF NOT EXISTS (SELECT 1 FROM public.knowledge_nodes WHERE id = v_node_id AND user_id = p_user_id) THEN
          RAISE EXCEPTION 'knowledge_node_not_found_or_not_owned' USING ERRCODE = 'P0002';
        END IF;
        v_rel := coalesce(v_item->>'relationType', 'synthesizes');
        INSERT INTO public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type, created_at)
        VALUES (p_user_id, p_artifact_id, v_node_id, v_rel, v_now)
        ON CONFLICT (user_id, artifact_id, node_id)
        DO UPDATE SET relation_type = v_rel;
      ELSIF v_action = 'detach' THEN
        DELETE FROM public.artifact_knowledge_nodes
        WHERE user_id = p_user_id AND artifact_id = p_artifact_id AND node_id = v_node_id;
      END IF;
    END LOOP;
  END IF;

  -- 5. Process Quests
  IF p_payload ? 'quests' AND jsonb_typeof(p_payload->'quests') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'quests') LOOP
      v_q_id := (v_item->>'questId')::uuid;
      v_action := v_item->>'action';
      IF v_action = 'attach' THEN
        IF NOT EXISTS (SELECT 1 FROM public.quests WHERE id = v_q_id AND user_id = p_user_id) THEN
          RAISE EXCEPTION 'quest_not_found_or_not_owned' USING ERRCODE = 'P0002';
        END IF;
        v_primary := coalesce((v_item->>'isPrimaryDeliverable')::boolean, false);
        INSERT INTO public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable, created_at)
        VALUES (p_user_id, p_artifact_id, v_q_id, v_primary, v_now)
        ON CONFLICT (user_id, artifact_id, quest_id)
        DO UPDATE SET is_primary_deliverable = v_primary;
      ELSIF v_action = 'detach' THEN
        DELETE FROM public.artifact_quests
        WHERE user_id = p_user_id AND artifact_id = p_artifact_id AND quest_id = v_q_id;
      END IF;
    END LOOP;
  END IF;

  -- 6. Process Evidence
  IF p_payload ? 'evidence' AND jsonb_typeof(p_payload->'evidence') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'evidence') LOOP
      v_ev_id := (v_item->>'evidenceId')::uuid;
      v_action := v_item->>'action';
      IF v_action = 'attach' THEN
        IF NOT EXISTS (SELECT 1 FROM public.evidence_records WHERE id = v_ev_id AND user_id = p_user_id) THEN
          RAISE EXCEPTION 'evidence_not_found_or_not_owned' USING ERRCODE = 'P0002';
        END IF;
        INSERT INTO public.artifact_evidence (user_id, artifact_id, evidence_id, created_at)
        VALUES (p_user_id, p_artifact_id, v_ev_id, v_now)
        ON CONFLICT (user_id, artifact_id, evidence_id) DO NOTHING;
      ELSIF v_action = 'detach' THEN
        DELETE FROM public.artifact_evidence
        WHERE user_id = p_user_id AND artifact_id = p_artifact_id AND evidence_id = v_ev_id;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_artifact_links(uuid, uuid, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.manage_artifact_links(uuid, uuid, jsonb) FROM anon;



