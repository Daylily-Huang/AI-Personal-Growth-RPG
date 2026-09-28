-- Phase 8D Round 2: database-owned Strategy mutations and deterministic evaluation.
-- The accepted 0046 schema and all Growth Core authorities remain unchanged.

CREATE OR REPLACE FUNCTION public.phase8d_write_audit(
  p_user_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_key text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.outer_loop_audit_events
    (user_id, event_type, entity_type, entity_id, request_idempotency_key,
     policy_version, schema_version, event_data)
  VALUES
    (p_user_id, p_event_type, p_entity_type, p_entity_id, p_key,
     'phase8d-v1', '1', COALESCE(p_data, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The durable key is shared with the Outer Loop audit ledger. A retry may
-- return only the result of the identical request, never another operation.
CREATE OR REPLACE FUNCTION public.rpc_transition_strategy_status(
  p_strategy_id uuid, p_target_status text, p_context_boundary_note text,
  p_retirement_reason text, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_strategy public.strategies%ROWTYPE;
  v_previous_status text;
  v_prior public.outer_loop_audit_events%ROWTYPE;
  v_intent jsonb;
  v_result jsonb;
  v_metrics jsonb;
  v_version_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000'; END IF;
  IF p_request_idempotency_key IS NULL OR btrim(p_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  v_intent := jsonb_build_object('strategy_id', p_strategy_id, 'target_status', p_target_status,
    'context_boundary_note', p_context_boundary_note, 'retirement_reason', p_retirement_reason);
  SELECT * INTO v_strategy FROM public.strategies
  WHERE id = p_strategy_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STRATEGY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_prior FROM public.outer_loop_audit_events
  WHERE user_id = v_user_id AND request_idempotency_key = p_request_idempotency_key;
  IF FOUND THEN
    IF v_prior.event_type <> 'STRATEGY_STATUS_TRANSITIONED'
       OR v_prior.event_data->'intent' IS DISTINCT FROM v_intent THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN (v_prior.event_data->'result') || jsonb_build_object('replayed', true);
  END IF;
  v_previous_status := v_strategy.lifecycle_status;
  IF NOT (
    (v_previous_status = 'HYPOTHESIS' AND p_target_status = 'TESTING') OR
    (v_previous_status = 'TESTING' AND p_target_status IN ('SUPPORTED', 'RETIRED')) OR
    (v_previous_status = 'SUPPORTED' AND p_target_status IN ('CONTEXTUAL', 'WEAKENED')) OR
    (v_previous_status = 'CONTEXTUAL' AND p_target_status IN ('SUPPORTED', 'WEAKENED')) OR
    (v_previous_status = 'WEAKENED' AND p_target_status IN ('TESTING', 'RETIRED'))
  ) THEN RAISE EXCEPTION 'INVALID_STRATEGY_TRANSITION' USING ERRCODE = '23514'; END IF;
  IF p_target_status = 'CONTEXTUAL' AND btrim(COALESCE(p_context_boundary_note, '')) = '' THEN
    RAISE EXCEPTION 'CONTEXT_BOUNDARY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_target_status = 'RETIRED' AND btrim(COALESCE(p_retirement_reason, '')) = '' THEN
    RAISE EXCEPTION 'RETIREMENT_REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_target_status = 'SUPPORTED' THEN
    SELECT id INTO v_version_id FROM public.strategy_versions
    WHERE strategy_id = p_strategy_id AND user_id = v_user_id
      AND version_number = v_strategy.version;
    IF v_version_id IS NULL THEN RAISE EXCEPTION 'STRATEGY_VERSION_MISSING' USING ERRCODE = '23514'; END IF;
    v_metrics := public.phase8d_strategy_metrics(p_strategy_id, v_version_id);
    IF NOT (v_metrics->>'promotion_eligible')::boolean THEN
      RAISE EXCEPTION 'INSUFFICIENT_SUPPORT_FOR_PROMOTION' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.strategies SET lifecycle_status = p_target_status,
    confidence_level = CASE WHEN p_target_status = 'SUPPORTED'
      THEN v_metrics->>'confidence_level' ELSE confidence_level END
  WHERE id = p_strategy_id RETURNING * INTO v_strategy;
  v_result := jsonb_build_object('strategy', to_jsonb(v_strategy),
    'previous_status', v_previous_status, 'replayed', false);
  PERFORM public.phase8d_write_audit(v_user_id, 'STRATEGY_STATUS_TRANSITIONED',
    'strategies', p_strategy_id, p_request_idempotency_key,
    jsonb_build_object('intent', v_intent, 'result', v_result));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_create_strategy_version(
  p_strategy_id uuid, p_action_protocol text, p_context_trigger text,
  p_expected_outcome text, p_change_summary text, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_strategy public.strategies%ROWTYPE;
  v_version public.strategy_versions%ROWTYPE;
  v_prior public.outer_loop_audit_events%ROWTYPE;
  v_intent jsonb;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000'; END IF;
  IF p_request_idempotency_key IS NULL OR btrim(p_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  v_intent := jsonb_build_object('strategy_id', p_strategy_id,
    'action_protocol', p_action_protocol, 'context_trigger', p_context_trigger,
    'expected_outcome', p_expected_outcome, 'change_summary', p_change_summary);
  SELECT * INTO v_strategy FROM public.strategies
  WHERE id = p_strategy_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STRATEGY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_prior FROM public.outer_loop_audit_events
  WHERE user_id = v_user_id AND request_idempotency_key = p_request_idempotency_key;
  IF FOUND THEN
    IF v_prior.event_type <> 'STRATEGY_VERSION_CREATED'
       OR v_prior.event_data->'intent' IS DISTINCT FROM v_intent THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN (v_prior.event_data->'result') || jsonb_build_object('replayed', true);
  END IF;
  IF btrim(COALESCE(p_action_protocol, '')) = ''
     OR btrim(COALESCE(p_context_trigger, '')) = ''
     OR btrim(COALESCE(p_expected_outcome, '')) = '' THEN
    RAISE EXCEPTION 'INVALID_STRATEGY_VERSION' USING ERRCODE = '22023';
  END IF;
  IF v_strategy.lifecycle_status = 'RETIRED' THEN
    RAISE EXCEPTION 'RETIRED_STRATEGY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.strategy_versions
    (user_id, strategy_id, version_number, action_protocol, context_trigger, expected_outcome)
  VALUES (v_user_id, p_strategy_id, v_strategy.version + 1,
    p_action_protocol, p_context_trigger, p_expected_outcome)
  RETURNING * INTO v_version;
  UPDATE public.strategies SET version = v_version.version_number,
    action_protocol = p_action_protocol, context_trigger = p_context_trigger,
    expected_outcome = p_expected_outcome, confidence_level = 'LOW'
  WHERE id = p_strategy_id RETURNING * INTO v_strategy;
  v_result := jsonb_build_object('strategy', to_jsonb(v_strategy),
    'version', to_jsonb(v_version), 'replayed', false);
  PERFORM public.phase8d_write_audit(v_user_id, 'STRATEGY_VERSION_CREATED',
    'strategy_versions', v_version.id, p_request_idempotency_key,
    jsonb_build_object('intent', v_intent, 'result', v_result));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8d_source_timestamp(
  p_user_id uuid, p_source_class text, p_source_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_timestamp timestamptz;
BEGIN
  IF p_source_id IS NULL THEN
    RAISE EXCEPTION 'NULL_SOURCE_ID_PROHIBITED' USING ERRCODE = '22023';
  END IF;
  CASE p_source_class
    WHEN 'SEASON_REVIEW' THEN
      SELECT created_at INTO v_timestamp FROM public.season_reviews
      WHERE id = p_source_id AND user_id = p_user_id;
    WHEN 'ACTIVITY' THEN
      SELECT created_at INTO v_timestamp FROM public.activities
      WHERE id = p_source_id AND user_id = p_user_id;
    WHEN 'QUEST_OUTCOME' THEN
      SELECT COALESCE(completed_at, created_at) INTO v_timestamp FROM public.quests
      WHERE id = p_source_id AND user_id = p_user_id;
    WHEN 'ARTIFACT' THEN
      SELECT created_at INTO v_timestamp FROM public.artifacts
      WHERE id = p_source_id AND user_id = p_user_id;
    WHEN 'CORE_EVIDENCE_REFERENCE' THEN
      SELECT created_at INTO v_timestamp FROM public.evidence_records
      WHERE id = p_source_id AND user_id = p_user_id;
    WHEN 'JOURNAL_CONTEXT', 'MANUAL_OBSERVATION' THEN
      SELECT created_at INTO v_timestamp FROM public.journal_entries
      WHERE id = p_source_id AND user_id = p_user_id;
    ELSE
      RAISE EXCEPTION 'INVALID_SOURCE_CLASS' USING ERRCODE = '22023';
  END CASE;
  IF v_timestamp IS NULL THEN
    RAISE EXCEPTION 'STRATEGY_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_timestamp;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8d_strategy_metrics(
  p_strategy_id uuid, p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_support_count integer;
  v_counter_count integer;
  v_dates integer;
  v_seasons integer;
  v_core_links integer;
  v_ratio numeric;
  v_confidence text := 'LOW';
BEGIN
  WITH canonical AS (
    SELECT DISTINCT ON (
      CASE WHEN ss.source_class IN ('JOURNAL_CONTEXT', 'MANUAL_OBSERVATION')
           THEN 'JOURNAL' ELSE ss.source_class END,
      ss.source_id, ss.observation_type
    ) ss.source_class, ss.source_id, ss.observation_type, ss.observed_at
    FROM public.strategy_supports ss
    WHERE ss.strategy_id = p_strategy_id AND ss.strategy_version_id = p_version_id
    ORDER BY
      CASE WHEN ss.source_class IN ('JOURNAL_CONTEXT', 'MANUAL_OBSERVATION')
           THEN 'JOURNAL' ELSE ss.source_class END,
      ss.source_id, ss.observation_type, ss.id
  )
  SELECT
    count(*) FILTER (WHERE c.observation_type = 'SUPPORT')::integer,
    count(*) FILTER (WHERE c.observation_type = 'COUNTER_EVIDENCE')::integer,
    count(DISTINCT (c.observed_at AT TIME ZONE 'UTC')::date)
      FILTER (WHERE c.observation_type = 'SUPPORT')::integer,
    count(DISTINCT sr.season_id) FILTER (
      WHERE c.observation_type = 'SUPPORT'
        AND c.source_class = 'SEASON_REVIEW'
        AND sr.review_type = 'FINAL' AND season.status = 'COMPLETED'
    )::integer,
    count(DISTINCT CASE
      WHEN c.observation_type <> 'SUPPORT' THEN NULL
      WHEN c.source_class = 'ACTIVITY' AND activity.status = 'confirmed'
        THEN 'ACTIVITY:' || c.source_id::text
      WHEN c.source_class = 'QUEST_OUTCOME' AND quest.status = 'completed'
           AND quest.completed_at IS NOT NULL
        THEN 'QUEST:' || c.source_id::text
      WHEN c.source_class = 'ARTIFACT'
           AND artifact.lifecycle_status IN ('active', 'archived', 'superseded')
        THEN 'ARTIFACT:' || c.source_id::text
      ELSE NULL
    END)::integer
  INTO v_support_count, v_counter_count, v_dates, v_seasons, v_core_links
  FROM canonical c
  LEFT JOIN public.season_reviews sr
    ON c.source_class = 'SEASON_REVIEW' AND sr.id = c.source_id
  LEFT JOIN public.seasons season ON season.id = sr.season_id
  LEFT JOIN public.activities activity
    ON c.source_class = 'ACTIVITY' AND activity.id = c.source_id
  LEFT JOIN public.quests quest
    ON c.source_class = 'QUEST_OUTCOME' AND quest.id = c.source_id
  LEFT JOIN public.artifacts artifact
    ON c.source_class = 'ARTIFACT' AND artifact.id = c.source_id;

  v_ratio := CASE WHEN v_support_count + v_counter_count = 0 THEN 0
    ELSE v_support_count::numeric / (v_support_count + v_counter_count) END;
  IF v_dates >= 8 AND v_seasons >= 2 AND v_core_links >= 4 AND v_ratio >= 0.85 THEN
    v_confidence := 'VERY_HIGH';
  ELSIF v_dates >= 4 AND v_seasons >= 1 AND v_core_links >= 2 AND v_ratio >= 0.75 THEN
    v_confidence := 'HIGH';
  ELSIF v_dates >= 2 AND v_core_links >= 1 AND v_ratio >= 0.65 THEN
    v_confidence := 'MODERATE';
  END IF;
  RETURN jsonb_build_object(
    'support_count', v_support_count,
    'counter_evidence_count', v_counter_count,
    'distinct_observation_dates', v_dates,
    'completed_seasons', v_seasons,
    'core_links', v_core_links,
    'support_ratio', v_ratio,
    'confidence_level', v_confidence,
    'promotion_eligible', v_dates >= 4 AND v_seasons >= 1
      AND v_core_links >= 2 AND v_ratio >= 0.75
      AND v_confidence IN ('HIGH', 'VERY_HIGH')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8d_evaluate_strategy_locked(
  p_user_id uuid, p_strategy_id uuid, p_confirm_promotion boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_strategy public.strategies%ROWTYPE;
  v_version_id uuid;
  v_metrics jsonb;
  v_next_status text;
  v_next_confidence text;
BEGIN
  SELECT * INTO v_strategy FROM public.strategies
  WHERE id = p_strategy_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STRATEGY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT id INTO v_version_id FROM public.strategy_versions
  WHERE strategy_id = p_strategy_id AND user_id = p_user_id
    AND version_number = v_strategy.version;
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'STRATEGY_VERSION_MISSING' USING ERRCODE = '23514';
  END IF;
  v_metrics := public.phase8d_strategy_metrics(p_strategy_id, v_version_id);
  v_next_confidence := v_metrics->>'confidence_level';
  v_next_status := v_strategy.lifecycle_status;
  IF p_confirm_promotion THEN
    IF v_strategy.lifecycle_status = 'SUPPORTED'
       AND (v_metrics->>'promotion_eligible')::boolean THEN
      -- A confirmed promotion is a deterministic fixed point on replay.
      v_next_status := 'SUPPORTED';
    ELSIF v_strategy.lifecycle_status <> 'TESTING'
       OR NOT (v_metrics->>'promotion_eligible')::boolean THEN
      RAISE EXCEPTION 'INSUFFICIENT_SUPPORT_FOR_PROMOTION' USING ERRCODE = '22023';
    ELSE
      v_next_status := 'SUPPORTED';
    END IF;
  ELSIF v_strategy.lifecycle_status IN ('SUPPORTED', 'CONTEXTUAL')
      AND (v_metrics->>'counter_evidence_count')::integer > 0
      AND (v_metrics->>'support_ratio')::numeric < 0.60 THEN
    v_next_status := 'WEAKENED';
  END IF;
  IF v_next_confidence IS DISTINCT FROM v_strategy.confidence_level
     OR v_next_status IS DISTINCT FROM v_strategy.lifecycle_status THEN
    UPDATE public.strategies
    SET confidence_level = v_next_confidence, lifecycle_status = v_next_status
    WHERE id = p_strategy_id RETURNING * INTO v_strategy;
    PERFORM public.phase8d_write_audit(
      p_user_id, 'STRATEGY_EVALUATED', 'strategies', p_strategy_id,
      'phase8d:evaluate:' || gen_random_uuid()::text,
      jsonb_build_object('confidence_level', v_next_confidence,
        'lifecycle_status', v_next_status, 'metrics', v_metrics)
    );
  END IF;
  RETURN jsonb_build_object('strategy', to_jsonb(v_strategy),
    'metrics', v_metrics, 'strategy_version_id', v_version_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_evaluate_strategy_status(
  p_strategy_id uuid, p_confirm_promotion boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  RETURN public.phase8d_evaluate_strategy_locked(
    v_user_id, p_strategy_id, COALESCE(p_confirm_promotion, false));
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_insert_strategy_support(
  p_strategy_id uuid, p_observation_type text, p_source_class text,
  p_source_id uuid, p_evaluator_version text, p_note text, p_observed_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_strategy public.strategies%ROWTYPE;
  v_version_id uuid;
  v_timestamp timestamptz;
  v_canonical_kind text;
  v_existing public.strategy_supports%ROWTYPE;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_observation_type IS NULL OR p_observation_type NOT IN ('SUPPORT', 'COUNTER_EVIDENCE')
     OR p_evaluator_version IS NULL OR btrim(p_evaluator_version) = '' THEN
    RAISE EXCEPTION 'INVALID_STRATEGY_OBSERVATION' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_strategy FROM public.strategies
  WHERE id = p_strategy_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STRATEGY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  v_canonical_kind := CASE WHEN p_source_class IN ('JOURNAL_CONTEXT', 'MANUAL_OBSERVATION')
    THEN 'JOURNAL' ELSE p_source_class END;
  SELECT * INTO v_existing FROM public.strategy_supports ss
  WHERE ss.strategy_id = p_strategy_id AND ss.source_id = p_source_id
    AND ss.observation_type = p_observation_type
    AND (CASE WHEN ss.source_class IN ('JOURNAL_CONTEXT', 'MANUAL_OBSERVATION')
      THEN 'JOURNAL' ELSE ss.source_class END) = v_canonical_kind
  ORDER BY ss.created_at, ss.id LIMIT 1;
  IF FOUND THEN
    -- Quest.completed_at can appear after a pre-completion observation. The
    -- immutable accepted row is authoritative for retry timestamp assertion.
    IF p_observed_at IS NULL OR p_observed_at IS DISTINCT FROM v_existing.observed_at THEN
      RAISE EXCEPTION 'SOURCE_TIMESTAMP_MISMATCH' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('support', to_jsonb(v_existing), 'replayed', true);
  END IF;
  IF v_strategy.lifecycle_status NOT IN ('TESTING', 'SUPPORTED', 'CONTEXTUAL', 'WEAKENED') THEN
    RAISE EXCEPTION 'STRATEGY_NOT_TESTABLE' USING ERRCODE = '23514';
  END IF;
  v_timestamp := public.phase8d_source_timestamp(v_user_id, p_source_class, p_source_id);
  IF p_observed_at IS NULL OR p_observed_at IS DISTINCT FROM v_timestamp THEN
    RAISE EXCEPTION 'SOURCE_TIMESTAMP_MISMATCH' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_version_id FROM public.strategy_versions
  WHERE strategy_id = p_strategy_id AND user_id = v_user_id
    AND version_number = v_strategy.version;
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'STRATEGY_VERSION_MISSING' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.strategy_supports
    (user_id, strategy_id, strategy_version_id, observation_type,
     source_class, source_id, evaluator_version, note, observed_at)
  VALUES
    (v_user_id, p_strategy_id, v_version_id, p_observation_type,
     p_source_class, p_source_id, p_evaluator_version, p_note, v_timestamp)
  RETURNING * INTO v_existing;
  v_result := public.phase8d_evaluate_strategy_locked(v_user_id, p_strategy_id, false);
  PERFORM public.phase8d_write_audit(
    v_user_id, 'STRATEGY_SUPPORT_LOGGED', 'strategy_supports', v_existing.id,
    'phase8d:support:' || v_existing.id::text,
    jsonb_build_object('strategy_id', p_strategy_id,
      'strategy_version_id', v_version_id, 'source_class', p_source_class,
      'source_id', p_source_id, 'observation_type', p_observation_type)
  );
  RETURN jsonb_build_object('support', to_jsonb(v_existing),
    'evaluation', v_result, 'replayed', false);
END;
$$;

-- Preserve Phase 8B semantics while extending its single public review entry.
ALTER FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text)
  RENAME TO phase8b_review_outer_loop_proposal;
REVOKE ALL ON FUNCTION public.phase8b_review_outer_loop_proposal(uuid, text, jsonb, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_review_outer_loop_proposal(
  p_proposal_id uuid, p_decision text, p_edited_payload jsonb,
  p_rejection_reason text, p_review_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_proposal public.outer_loop_proposals%ROWTYPE;
  v_payload jsonb;
  v_result_id uuid;
  v_result_type text;
  v_activity_id text;
  v_candidate uuid;
  v_reviewed_payload jsonb;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_proposal FROM public.outer_loop_proposals
  WHERE id = p_proposal_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_proposal.proposal_type NOT IN
      ('STRATEGY_HYPOTHESIS', 'STRATEGY_COUNTEREVIDENCE_ALERT') THEN
    RETURN public.phase8b_review_outer_loop_proposal(p_proposal_id, p_decision,
      p_edited_payload, p_rejection_reason, p_review_request_idempotency_key);
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('ACCEPTED', 'EDITED', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_DECISION' USING ERRCODE = '22023';
  END IF;
  IF p_review_request_idempotency_key IS NULL OR btrim(p_review_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  IF v_proposal.status = 'EXPIRED' THEN
    RETURN jsonb_build_object('proposal', to_jsonb(v_proposal),
      'resulting_entity_type', NULL, 'resulting_entity_id', NULL,
      'error_code', 'PROPOSAL_EXPIRED', 'replayed', true);
  END IF;
  IF v_proposal.status <> 'PROPOSED' THEN
    IF v_proposal.review_request_idempotency_key = p_review_request_idempotency_key
       AND v_proposal.status = p_decision THEN
      SELECT event_data->'reviewed_payload' INTO v_reviewed_payload
      FROM public.outer_loop_audit_events
      WHERE user_id = v_user_id AND request_idempotency_key = p_review_request_idempotency_key
        AND event_type = 'PROPOSAL_REVIEWED';
      IF p_decision = 'EDITED'
         AND p_edited_payload IS DISTINCT FROM v_reviewed_payload THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT' USING ERRCODE = '23505';
      END IF;
      IF p_decision = 'REJECTED'
         AND NULLIF(btrim(COALESCE(p_rejection_reason, '')), '')
           IS DISTINCT FROM v_proposal.rejection_reason THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT' USING ERRCODE = '23505';
      END IF;
      RETURN jsonb_build_object('proposal', to_jsonb(v_proposal),
        'resulting_entity_type', v_proposal.resulting_entity_type,
        'resulting_entity_id', v_proposal.resulting_entity_id,
        'reviewed_payload', v_reviewed_payload, 'replayed', true);
    END IF;
    RAISE EXCEPTION 'PROPOSAL_ALREADY_REVIEWED' USING ERRCODE = '23514';
  END IF;
  IF v_proposal.expires_at <= clock_timestamp() THEN
    UPDATE public.outer_loop_proposals SET status = 'EXPIRED'
    WHERE id = p_proposal_id RETURNING * INTO v_proposal;
    PERFORM public.phase8d_write_audit(v_user_id, 'PROPOSAL_EXPIRED',
      'outer_loop_proposals', p_proposal_id,
      'phase8d:proposal-expired:' || p_proposal_id::text,
      jsonb_build_object('expires_at', v_proposal.expires_at));
    RETURN jsonb_build_object('proposal', to_jsonb(v_proposal),
      'resulting_entity_type', NULL, 'resulting_entity_id', NULL,
      'error_code', 'PROPOSAL_EXPIRED', 'replayed', false);
  END IF;
  IF p_decision = 'EDITED' THEN
    IF p_edited_payload IS NULL OR jsonb_typeof(p_edited_payload) <> 'object' THEN
      RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
    END IF;
    v_payload := p_edited_payload;
  ELSE
    v_payload := v_proposal.payload;
  END IF;
  IF p_decision IN ('ACCEPTED', 'EDITED') THEN
    IF v_proposal.proposal_type = 'STRATEGY_HYPOTHESIS' THEN
      IF jsonb_typeof(v_payload) <> 'object'
         OR btrim(COALESCE(v_payload->>'title', '')) = ''
         OR btrim(COALESCE(v_payload->>'context_trigger', '')) = ''
         OR btrim(COALESCE(v_payload->>'action_protocol', '')) = ''
         OR btrim(COALESCE(v_payload->>'expected_outcome', '')) = ''
         OR (v_payload ? 'supporting_activity_ids'
             AND jsonb_typeof(v_payload->'supporting_activity_ids') <> 'array') THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END IF;
      IF v_payload ? 'supporting_activity_ids' THEN
        FOR v_activity_id IN SELECT jsonb_array_elements_text(v_payload->'supporting_activity_ids') LOOP
          BEGIN v_candidate := v_activity_id::uuid;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
          END;
          PERFORM 1 FROM public.activities WHERE id = v_candidate AND user_id = v_user_id;
          IF NOT FOUND THEN RAISE EXCEPTION 'STRATEGY_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
        END LOOP;
      END IF;
    ELSE
      IF jsonb_typeof(v_payload) <> 'object'
         OR NOT (v_payload ? 'strategy_id')
         OR NOT (v_payload ? 'counter_evidence_activity_id')
         OR btrim(COALESCE(v_payload->>'observation', '')) = ''
         OR btrim(COALESCE(v_payload->>'recommended_action', '')) = '' THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_candidate := (v_payload->>'strategy_id')::uuid;
        v_result_id := (v_payload->>'counter_evidence_activity_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END;
      PERFORM 1 FROM public.strategies WHERE id = v_candidate AND user_id = v_user_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'STRATEGY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
      PERFORM public.phase8d_source_timestamp(v_user_id, 'ACTIVITY', v_result_id);
      v_result_id := NULL;
    END IF;
  END IF;
  -- The proposal row lock serializes competing reviews. Entity creation and
  -- settlement remain one transaction; any audit conflict rolls both back.
  UPDATE public.outer_loop_proposals
  SET status = p_decision, decision = p_decision, reviewed_at = clock_timestamp(),
    reviewed_by_id = v_user_id,
    review_request_idempotency_key = p_review_request_idempotency_key,
    rejection_reason = CASE WHEN p_decision = 'REJECTED'
      THEN NULLIF(btrim(COALESCE(p_rejection_reason, '')), '') ELSE NULL END
  WHERE id = p_proposal_id RETURNING * INTO v_proposal;
  IF p_decision IN ('ACCEPTED', 'EDITED')
     AND v_proposal.proposal_type = 'STRATEGY_HYPOTHESIS' THEN
    INSERT INTO public.strategies
      (user_id, title, description, context_trigger, action_protocol, expected_outcome)
    VALUES (v_user_id, btrim(v_payload->>'title'),
      COALESCE(v_payload->>'description', ''), btrim(v_payload->>'context_trigger'),
      btrim(v_payload->>'action_protocol'), btrim(v_payload->>'expected_outcome'))
    RETURNING id INTO v_result_id;
    v_result_type := 'strategies';
    UPDATE public.outer_loop_proposals
    SET resulting_entity_type = v_result_type, resulting_entity_id = v_result_id
    WHERE id = p_proposal_id RETURNING * INTO v_proposal;
  END IF;
  PERFORM public.phase8d_write_audit(v_user_id, 'PROPOSAL_REVIEWED',
    'outer_loop_proposals', p_proposal_id, p_review_request_idempotency_key,
    jsonb_strip_nulls(jsonb_build_object('decision', p_decision,
      'proposal_type', v_proposal.proposal_type,
      'reviewed_payload', CASE WHEN p_decision IN ('ACCEPTED', 'EDITED')
        THEN v_payload ELSE NULL END,
      'resulting_entity_type', v_result_type,
      'resulting_entity_id', v_result_id)));
  v_result := jsonb_build_object('proposal', to_jsonb(v_proposal),
    'reviewed_payload', CASE WHEN p_decision IN ('ACCEPTED', 'EDITED')
      THEN v_payload ELSE NULL END,
    'result', CASE WHEN v_result_id IS NOT NULL
      THEN jsonb_build_object('strategy_id', v_result_id) ELSE NULL END,
    'replayed', false);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase8d_write_audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8d_source_timestamp(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8d_strategy_metrics(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8d_evaluate_strategy_locked(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_insert_strategy_support(uuid, text, text, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_evaluate_strategy_status(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_transition_strategy_status(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_create_strategy_version(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_insert_strategy_support(uuid, text, text, uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_evaluate_strategy_status(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_transition_strategy_status(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_strategy_version(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text) TO authenticated;
