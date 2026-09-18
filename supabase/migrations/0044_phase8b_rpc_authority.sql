-- 0044_phase8b_rpc_authority.sql
-- Phase 8B Round 2: deterministic Season / Review / Season-Quest / proposal RPC authority.
-- No Growth Core, Quest lifecycle, Activity, XP, Mastery, Evidence, or reward mutation occurs here.

-- =============================================================================
-- Internal audit helper
-- =============================================================================

CREATE OR REPLACE FUNCTION public.phase8b_write_audit(
  p_user_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_request_idempotency_key text,
  p_event_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.outer_loop_audit_events (
    user_id,
    event_type,
    entity_type,
    entity_id,
    request_idempotency_key,
    policy_version,
    schema_version,
    event_data
  ) VALUES (
    p_user_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_request_idempotency_key,
    'phase8b-v1',
    '1',
    COALESCE(p_event_data, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.phase8b_write_audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.phase8b_write_audit(uuid, text, text, uuid, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.phase8b_write_audit(uuid, text, text, uuid, text, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.phase8b_write_audit(uuid, text, text, uuid, text, jsonb) FROM service_role;

-- =============================================================================
-- 1. rpc_plan_season
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_plan_season(
  p_season_id uuid,
  p_planned_start_date date,
  p_target_duration_days integer,
  p_success_criteria jsonb,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_audit public.outer_loop_audit_events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_request_idempotency_key IS NULL OR btrim(p_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  IF p_target_duration_days IS NULL OR p_target_duration_days < 14 OR p_target_duration_days > 84 THEN
    RAISE EXCEPTION 'INVALID_DURATION' USING ERRCODE = '22023';
  END IF;
  IF p_planned_start_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_PLANNED_START_DATE' USING ERRCODE = '22023';
  END IF;
  IF p_success_criteria IS NULL OR jsonb_typeof(p_success_criteria) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SUCCESS_CRITERIA' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_audit
  FROM public.outer_loop_audit_events
  WHERE user_id = v_user_id
    AND request_idempotency_key = p_request_idempotency_key;

  IF FOUND THEN
    IF v_audit.event_type = 'SEASON_PLANNED' AND v_audit.entity_id = p_season_id THEN
      RETURN jsonb_build_object('season', to_jsonb(v_season), 'replayed', true);
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23505';
  END IF;

  IF v_season.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION' USING ERRCODE = '23514';
  END IF;

  UPDATE public.seasons
  SET status = 'PLANNED',
      planned_start_date = p_planned_start_date,
      target_duration_days = p_target_duration_days,
      success_criteria = p_success_criteria,
      updated_at = clock_timestamp()
  WHERE id = p_season_id
  RETURNING * INTO v_season;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'SEASON_PLANNED',
    'seasons',
    p_season_id,
    p_request_idempotency_key,
    jsonb_build_object(
      'planned_start_date', p_planned_start_date,
      'target_duration_days', p_target_duration_days
    )
  );

  RETURN jsonb_build_object('season', to_jsonb(v_season), 'replayed', false);
END;
$$;

-- =============================================================================
-- 2. rpc_activate_season
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_activate_season(
  p_season_id uuid,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_audit public.outer_loop_audit_events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_request_idempotency_key IS NULL OR btrim(p_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_audit
  FROM public.outer_loop_audit_events
  WHERE user_id = v_user_id
    AND request_idempotency_key = p_request_idempotency_key;

  IF FOUND THEN
    IF v_audit.event_type = 'SEASON_ACTIVATED' AND v_audit.entity_id = p_season_id THEN
      RETURN jsonb_build_object('season', to_jsonb(v_season), 'replayed', true);
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23505';
  END IF;

  IF v_season.status <> 'PLANNED' THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION' USING ERRCODE = '23514';
  END IF;

  -- Serialize activations per user even when no ACTIVE row exists yet. The
  -- partial unique index remains the final database invariant backstop.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.seasons
    WHERE user_id = v_user_id
      AND status = 'ACTIVE'
      AND id <> p_season_id
  ) THEN
    RAISE EXCEPTION 'ACTIVE_SEASON_EXISTS' USING ERRCODE = '23505';
  END IF;

  UPDATE public.seasons
  SET status = 'ACTIVE',
      started_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = p_season_id
  RETURNING * INTO v_season;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'SEASON_ACTIVATED',
    'seasons',
    p_season_id,
    p_request_idempotency_key,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('season', to_jsonb(v_season), 'replayed', false);
END;
$$;

-- =============================================================================
-- 3. rpc_conclude_season
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_conclude_season(
  p_season_id uuid,
  p_target_status text,
  p_final_review jsonb,
  p_final_review_commit_key uuid,
  p_abandonment_reason text,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_audit public.outer_loop_audit_events%ROWTYPE;
  v_existing_review public.season_reviews%ROWTYPE;
  v_prior_review public.season_reviews%ROWTYPE;
  v_new_review public.season_reviews%ROWTYPE;
  v_next_version integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_qualitative_reflection text;
  v_review_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_request_idempotency_key IS NULL OR btrim(p_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  IF p_target_status IS NULL OR p_target_status NOT IN ('COMPLETED', 'ENDED_EARLY', 'ABANDONED') THEN
    RAISE EXCEPTION 'INVALID_TARGET_STATUS' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_audit
  FROM public.outer_loop_audit_events
  WHERE user_id = v_user_id
    AND request_idempotency_key = p_request_idempotency_key;

  IF FOUND THEN
    IF v_audit.event_type = 'SEASON_CONCLUDED'
       AND v_audit.entity_id = p_season_id
       AND COALESCE(v_audit.event_data->>'target_status', '') = p_target_status THEN
      IF v_audit.event_data ? 'review_id' AND NULLIF(v_audit.event_data->>'review_id', '') IS NOT NULL THEN
        SELECT * INTO v_new_review
        FROM public.season_reviews
        WHERE id = (v_audit.event_data->>'review_id')::uuid
          AND user_id = v_user_id;
      END IF;
      RETURN jsonb_build_object(
        'season', to_jsonb(v_season),
        'review', CASE WHEN v_new_review.id IS NULL THEN NULL ELSE to_jsonb(v_new_review) END,
        'replayed', true
      );
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23505';
  END IF;

  IF v_season.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SEASON_NOT_ACTIVE' USING ERRCODE = '23514';
  END IF;

  IF p_target_status IN ('COMPLETED', 'ENDED_EARLY') THEN
    IF p_final_review IS NULL THEN
      RAISE EXCEPTION 'MISSING_FINAL_REVIEW' USING ERRCODE = '22023';
    END IF;
    IF p_final_review_commit_key IS NULL THEN
      RAISE EXCEPTION 'MISSING_FINAL_REVIEW_COMMIT_KEY' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_final_review) <> 'object'
       OR NOT (p_final_review ? 'period_start')
       OR NOT (p_final_review ? 'period_end')
       OR NOT (p_final_review ? 'objective_summary')
       OR NOT (p_final_review ? 'qualitative_reflection')
       OR NOT (p_final_review ? 'criteria_evaluation') THEN
      RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_period_start := (p_final_review->>'period_start')::timestamptz;
      v_period_end := (p_final_review->>'period_end')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE = '22023';
    END;

    IF v_period_end < v_period_start THEN
      RAISE EXCEPTION 'INVALID_PERIOD_RANGE' USING ERRCODE = '22023';
    END IF;

    v_qualitative_reflection := btrim(COALESCE(p_final_review->>'qualitative_reflection', ''));
    IF v_qualitative_reflection = '' THEN
      RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_existing_review
    FROM public.season_reviews
    WHERE user_id = v_user_id AND commit_key = p_final_review_commit_key;

    IF FOUND THEN
      RAISE EXCEPTION 'FINAL_REVIEW_COMMIT_KEY_REUSED' USING ERRCODE = '23505';
    END IF;

    SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
    FROM public.season_reviews
    WHERE season_id = p_season_id AND review_type = 'FINAL';

    SELECT * INTO v_prior_review
    FROM public.season_reviews
    WHERE season_id = p_season_id
      AND review_type = 'FINAL'
      AND superseded_by_id IS NULL
    ORDER BY version DESC
    LIMIT 1;

    INSERT INTO public.season_reviews (
      user_id,
      season_id,
      review_type,
      version,
      commit_key,
      period_start,
      period_end,
      objective_summary,
      qualitative_reflection,
      criteria_evaluation,
      tactical_adjustments,
      amendment_reason
    ) VALUES (
      v_user_id,
      p_season_id,
      'FINAL',
      v_next_version,
      p_final_review_commit_key,
      v_period_start,
      v_period_end,
      p_final_review->'objective_summary',
      v_qualitative_reflection,
      p_final_review->'criteria_evaluation',
      p_final_review->>'tactical_adjustments',
      NULL
    )
    RETURNING * INTO v_new_review;

    IF v_prior_review.id IS NOT NULL THEN
      UPDATE public.season_reviews
      SET superseded_by_id = v_new_review.id
      WHERE id = v_prior_review.id
        AND superseded_by_id IS NULL;
    END IF;

    UPDATE public.seasons
    SET status = p_target_status,
        ended_at = clock_timestamp(),
        abandonment_reason = NULL,
        updated_at = clock_timestamp()
    WHERE id = p_season_id
    RETURNING * INTO v_season;

    v_review_id := v_new_review.id;
  ELSE
    IF p_abandonment_reason IS NULL OR btrim(p_abandonment_reason) = '' THEN
      RAISE EXCEPTION 'MISSING_ABANDONMENT_REASON' USING ERRCODE = '22023';
    END IF;

    UPDATE public.seasons
    SET status = 'ABANDONED',
        ended_at = clock_timestamp(),
        abandonment_reason = btrim(p_abandonment_reason),
        updated_at = clock_timestamp()
    WHERE id = p_season_id
    RETURNING * INTO v_season;

    -- Hard invariant: ABANDONED inserts zero season_reviews rows.
    v_review_id := NULL;
  END IF;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'SEASON_CONCLUDED',
    'seasons',
    p_season_id,
    p_request_idempotency_key,
    jsonb_strip_nulls(jsonb_build_object(
      'target_status', p_target_status,
      'review_id', v_review_id,
      'abandonment_reason', CASE WHEN p_target_status = 'ABANDONED' THEN btrim(p_abandonment_reason) ELSE NULL END
    ))
  );

  RETURN jsonb_build_object(
    'season', to_jsonb(v_season),
    'review', CASE WHEN v_new_review.id IS NULL THEN NULL ELSE to_jsonb(v_new_review) END,
    'replayed', false
  );
END;
$$;

-- =============================================================================
-- 4. rpc_cancel_season
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cancel_season(
  p_season_id uuid,
  p_cancellation_reason text,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_audit public.outer_loop_audit_events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_request_idempotency_key IS NULL OR btrim(p_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_audit
  FROM public.outer_loop_audit_events
  WHERE user_id = v_user_id
    AND request_idempotency_key = p_request_idempotency_key;

  IF FOUND THEN
    IF v_audit.event_type = 'SEASON_CANCELLED' AND v_audit.entity_id = p_season_id THEN
      RETURN jsonb_build_object('season', to_jsonb(v_season), 'replayed', true);
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23505';
  END IF;

  IF v_season.status NOT IN ('DRAFT', 'PLANNED') THEN
    RAISE EXCEPTION 'CANNOT_CANCEL_ACTIVE_OR_TERMINAL_SEASON' USING ERRCODE = '23514';
  END IF;

  UPDATE public.seasons
  SET status = 'CANCELLED',
      updated_at = clock_timestamp()
  WHERE id = p_season_id
  RETURNING * INTO v_season;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'SEASON_CANCELLED',
    'seasons',
    p_season_id,
    p_request_idempotency_key,
    jsonb_strip_nulls(jsonb_build_object('reason', NULLIF(btrim(COALESCE(p_cancellation_reason, '')), '')))
  );

  RETURN jsonb_build_object('season', to_jsonb(v_season), 'replayed', false);
END;
$$;

-- =============================================================================
-- 5. rpc_finalize_season_review
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_finalize_season_review(
  p_season_id uuid,
  p_review_type text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_objective_summary jsonb,
  p_qualitative_reflection text,
  p_criteria_evaluation jsonb,
  p_tactical_adjustments text,
  p_commit_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_existing public.season_reviews%ROWTYPE;
  v_prior public.season_reviews%ROWTYPE;
  v_review public.season_reviews%ROWTYPE;
  v_next_version integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_commit_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_KEY' USING ERRCODE = '22023';
  END IF;
  IF p_review_type IS NULL OR p_review_type NOT IN ('WEEKLY', 'AD_HOC') THEN
    RAISE EXCEPTION 'INVALID_REVIEW_TYPE' USING ERRCODE = '22023';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'INVALID_PERIOD_RANGE' USING ERRCODE = '22023';
  END IF;
  IF p_objective_summary IS NULL OR p_criteria_evaluation IS NULL
     OR p_qualitative_reflection IS NULL OR btrim(p_qualitative_reflection) = '' THEN
    RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Serialize exact commit-key replay behind the parent Season lock. Without
  -- this recheck, two concurrent requests can both miss the key and the loser
  -- surfaces a unique violation instead of replaying the committed Review.
  SELECT * INTO v_existing
  FROM public.season_reviews
  WHERE user_id = v_user_id AND commit_key = p_commit_key;

  IF FOUND THEN
    IF v_existing.season_id = p_season_id AND v_existing.review_type = p_review_type THEN
      RETURN jsonb_build_object('review', to_jsonb(v_existing), 'replayed', true);
    END IF;
    RAISE EXCEPTION 'COMMIT_KEY_REUSED' USING ERRCODE = '23505';
  END IF;

  IF v_season.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SEASON_NOT_ACTIVE' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.season_reviews
  WHERE season_id = p_season_id AND review_type = p_review_type;

  SELECT * INTO v_prior
  FROM public.season_reviews
  WHERE season_id = p_season_id
    AND review_type = p_review_type
    AND superseded_by_id IS NULL
  ORDER BY version DESC
  LIMIT 1;

  INSERT INTO public.season_reviews (
    user_id,
    season_id,
    review_type,
    version,
    commit_key,
    period_start,
    period_end,
    objective_summary,
    qualitative_reflection,
    criteria_evaluation,
    tactical_adjustments,
    amendment_reason
  ) VALUES (
    v_user_id,
    p_season_id,
    p_review_type,
    v_next_version,
    p_commit_key,
    p_period_start,
    p_period_end,
    p_objective_summary,
    btrim(p_qualitative_reflection),
    p_criteria_evaluation,
    p_tactical_adjustments,
    NULL
  )
  RETURNING * INTO v_review;

  IF v_prior.id IS NOT NULL THEN
    UPDATE public.season_reviews
    SET superseded_by_id = v_review.id
    WHERE id = v_prior.id
      AND superseded_by_id IS NULL;
  END IF;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'REVIEW_FINALIZED',
    'season_reviews',
    v_review.id,
    'review:' || p_commit_key::text,
    jsonb_build_object(
      'season_id', p_season_id,
      'review_type', p_review_type,
      'version', v_review.version
    )
  );

  RETURN jsonb_build_object('review', to_jsonb(v_review), 'replayed', false);
END;
$$;

-- =============================================================================
-- 6. rpc_amend_final_season_review
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_amend_final_season_review(
  p_season_id uuid,
  p_amended_review jsonb,
  p_amendment_reason text,
  p_commit_key uuid,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_existing public.season_reviews%ROWTYPE;
  v_prior public.season_reviews%ROWTYPE;
  v_review public.season_reviews%ROWTYPE;
  v_audit public.outer_loop_audit_events%ROWTYPE;
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_commit_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_KEY' USING ERRCODE = '22023';
  END IF;
  IF p_request_idempotency_key IS NULL OR btrim(p_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  IF p_amendment_reason IS NULL OR btrim(p_amendment_reason) = '' THEN
    RAISE EXCEPTION 'MISSING_AMENDMENT_REASON' USING ERRCODE = '22023';
  END IF;
  IF p_amended_review IS NULL OR jsonb_typeof(p_amended_review) <> 'object'
     OR NOT (p_amended_review ? 'period_start')
     OR NOT (p_amended_review ? 'period_end')
     OR NOT (p_amended_review ? 'objective_summary')
     OR NOT (p_amended_review ? 'qualitative_reflection')
     OR NOT (p_amended_review ? 'criteria_evaluation') THEN
    RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- As with periodic Reviews, the parent lock must be acquired before the
  -- durable commit-key replay check so concurrent exact retries converge.
  SELECT * INTO v_existing
  FROM public.season_reviews
  WHERE user_id = v_user_id AND commit_key = p_commit_key;

  IF FOUND THEN
    IF v_existing.season_id = p_season_id AND v_existing.review_type = 'FINAL' THEN
      RETURN jsonb_build_object('review', to_jsonb(v_existing), 'replayed', true);
    END IF;
    RAISE EXCEPTION 'COMMIT_KEY_REUSED' USING ERRCODE = '23505';
  END IF;

  BEGIN
    v_period_start := (p_amended_review->>'period_start')::timestamptz;
    v_period_end := (p_amended_review->>'period_end')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE = '22023';
  END;

  IF v_period_end < v_period_start THEN
    RAISE EXCEPTION 'INVALID_PERIOD_RANGE' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_amended_review->>'qualitative_reflection', '')) = '' THEN
    RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE = '22023';
  END IF;

  IF v_season.status NOT IN ('COMPLETED', 'ENDED_EARLY') THEN
    RAISE EXCEPTION 'SEASON_NOT_TERMINAL' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_prior
  FROM public.season_reviews
  WHERE season_id = p_season_id
    AND review_type = 'FINAL'
    AND superseded_by_id IS NULL
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_PRIOR_FINAL_REVIEW' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_audit
  FROM public.outer_loop_audit_events
  WHERE user_id = v_user_id
    AND request_idempotency_key = p_request_idempotency_key;

  IF FOUND THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.season_reviews (
    user_id,
    season_id,
    review_type,
    version,
    commit_key,
    period_start,
    period_end,
    objective_summary,
    qualitative_reflection,
    criteria_evaluation,
    tactical_adjustments,
    amendment_reason
  ) VALUES (
    v_user_id,
    p_season_id,
    'FINAL',
    v_prior.version + 1,
    p_commit_key,
    v_period_start,
    v_period_end,
    p_amended_review->'objective_summary',
    btrim(p_amended_review->>'qualitative_reflection'),
    p_amended_review->'criteria_evaluation',
    p_amended_review->>'tactical_adjustments',
    btrim(p_amendment_reason)
  )
  RETURNING * INTO v_review;

  UPDATE public.season_reviews
  SET superseded_by_id = v_review.id
  WHERE id = v_prior.id
    AND superseded_by_id IS NULL;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'FINAL_REVIEW_AMENDED',
    'season_reviews',
    v_review.id,
    p_request_idempotency_key,
    jsonb_build_object(
      'season_id', p_season_id,
      'prior_review_id', v_prior.id,
      'new_review_id', v_review.id,
      'version', v_review.version,
      'amendment_reason', btrim(p_amendment_reason)
    )
  );

  RETURN jsonb_build_object('review', to_jsonb(v_review), 'replayed', false);
END;
$$;

-- =============================================================================
-- 7. rpc_link_season_quest / rpc_unlink_season_quest
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_link_season_quest(
  p_season_id uuid,
  p_quest_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_link public.season_quests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('MAIN', 'FOCUS') THEN
    RAISE EXCEPTION 'INVALID_SEASON_QUEST_ROLE' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_season.status NOT IN ('DRAFT', 'PLANNED', 'ACTIVE') THEN
    RAISE EXCEPTION 'SEASON_TERMINATED' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.quests
    WHERE id = p_quest_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_link
  FROM public.season_quests
  WHERE season_id = p_season_id AND quest_id = p_quest_id;

  IF FOUND THEN
    RETURN jsonb_build_object('link', to_jsonb(v_link), 'replayed', true);
  END IF;

  IF p_role = 'MAIN' AND EXISTS (
    SELECT 1 FROM public.season_quests
    WHERE season_id = p_season_id AND role = 'MAIN'
  ) THEN
    RAISE EXCEPTION 'MAIN_QUEST_ALREADY_EXISTS' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.season_quests (user_id, season_id, quest_id, role)
  VALUES (v_user_id, p_season_id, p_quest_id, p_role)
  RETURNING * INTO v_link;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'SEASON_QUEST_LINKED',
    'season_quests',
    v_link.id,
    'season-link:' || gen_random_uuid()::text,
    jsonb_build_object('season_id', p_season_id, 'quest_id', p_quest_id, 'role', p_role)
  );

  RETURN jsonb_build_object('link', to_jsonb(v_link), 'replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_unlink_season_quest(
  p_season_id uuid,
  p_quest_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season public.seasons%ROWTYPE;
  v_link public.season_quests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('MAIN', 'FOCUS') THEN
    RAISE EXCEPTION 'INVALID_SEASON_QUEST_ROLE' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEASON_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_season.status NOT IN ('DRAFT', 'PLANNED', 'ACTIVE') THEN
    RAISE EXCEPTION 'SEASON_TERMINATED' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.quests
    WHERE id = p_quest_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_link
  FROM public.season_quests
  WHERE season_id = p_season_id AND quest_id = p_quest_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('link', NULL, 'removed', false, 'replayed', true);
  END IF;

  DELETE FROM public.season_quests
  WHERE id = v_link.id;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'SEASON_QUEST_UNLINKED',
    'season_quests',
    v_link.id,
    'season-unlink:' || gen_random_uuid()::text,
    jsonb_build_object('season_id', p_season_id, 'quest_id', p_quest_id, 'role', v_link.role)
  );

  RETURN jsonb_build_object('link', to_jsonb(v_link), 'removed', true, 'replayed', false);
END;
$$;

-- =============================================================================
-- 8. rpc_review_outer_loop_proposal
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_review_outer_loop_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_edited_payload jsonb,
  p_rejection_reason text,
  p_review_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_proposal public.outer_loop_proposals%ROWTYPE;
  v_current public.outer_loop_proposals%ROWTYPE;
  v_payload jsonb;
  v_result jsonb;
  v_result_id uuid;
  v_result_type text;
  v_season_id uuid;
  v_duration integer;
  v_start_date date;
  v_review_type text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_objective_summary jsonb;
  v_qualitative_reflection text;
  v_criteria_evaluation jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('ACCEPTED', 'EDITED', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_DECISION' USING ERRCODE = '22023';
  END IF;
  IF p_review_request_idempotency_key IS NULL OR btrim(p_review_request_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current
  FROM public.outer_loop_proposals
  WHERE id = p_proposal_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPOSAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_current.status = 'EXPIRED' THEN
    RETURN jsonb_build_object(
      'proposal', to_jsonb(v_current),
      'resulting_entity_type', NULL,
      'resulting_entity_id', NULL,
      'error_code', 'PROPOSAL_EXPIRED',
      'replayed', true
    );
  END IF;

  IF v_current.status <> 'PROPOSED' THEN
    IF v_current.review_request_idempotency_key = p_review_request_idempotency_key
       AND v_current.status = p_decision THEN
      RETURN jsonb_build_object(
        'proposal', to_jsonb(v_current),
        'resulting_entity_type', v_current.resulting_entity_type,
        'resulting_entity_id', v_current.resulting_entity_id,
        'replayed', true
      );
    END IF;
    RAISE EXCEPTION 'PROPOSAL_ALREADY_REVIEWED' USING ERRCODE = '23514';
  END IF;

  IF v_current.expires_at <= clock_timestamp() THEN
    UPDATE public.outer_loop_proposals
    SET status = 'EXPIRED'
    WHERE id = p_proposal_id
      AND user_id = v_user_id
      AND status = 'PROPOSED'
    RETURNING * INTO v_proposal;

    IF NOT FOUND THEN
      SELECT * INTO v_current
      FROM public.outer_loop_proposals
      WHERE id = p_proposal_id AND user_id = v_user_id;

      IF v_current.status = 'EXPIRED' THEN
        RETURN jsonb_build_object(
          'proposal', to_jsonb(v_current),
          'resulting_entity_type', NULL,
          'resulting_entity_id', NULL,
          'error_code', 'PROPOSAL_EXPIRED',
          'replayed', true
        );
      END IF;

      IF v_current.review_request_idempotency_key = p_review_request_idempotency_key
         AND v_current.status = p_decision THEN
        RETURN jsonb_build_object(
          'proposal', to_jsonb(v_current),
          'resulting_entity_type', v_current.resulting_entity_type,
          'resulting_entity_id', v_current.resulting_entity_id,
          'replayed', true
        );
      END IF;
      RAISE EXCEPTION 'PROPOSAL_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;

    PERFORM public.phase8b_write_audit(
      v_user_id,
      'PROPOSAL_EXPIRED',
      'outer_loop_proposals',
      p_proposal_id,
      'phase8b:proposal-expired:' || p_proposal_id::text,
      jsonb_build_object('expires_at', v_proposal.expires_at)
    );

    RETURN jsonb_build_object(
      'proposal', to_jsonb(v_proposal),
      'resulting_entity_type', NULL,
      'resulting_entity_id', NULL,
      'error_code', 'PROPOSAL_EXPIRED',
      'replayed', false
    );
  END IF;

  IF p_decision = 'EDITED' THEN
    IF p_edited_payload IS NULL OR jsonb_typeof(p_edited_payload) <> 'object' THEN
      RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
    END IF;
    v_payload := p_edited_payload;
  ELSE
    v_payload := v_current.payload;
  END IF;

  -- Validate Phase 8B domain payload before winning CAS so validation failures
  -- never settle the proposal.
  IF p_decision IN ('ACCEPTED', 'EDITED') THEN
    IF v_current.proposal_type = 'SEASON_PLAN' THEN
      IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object'
         OR btrim(COALESCE(v_payload->>'title', '')) = ''
         OR NOT (v_payload ? 'target_start_date')
         OR NOT (v_payload ? 'duration_days')
         OR NOT (v_payload ? 'success_criteria')
         OR jsonb_typeof(v_payload->'success_criteria') <> 'array' THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_start_date := (v_payload->>'target_start_date')::date;
        v_duration := (v_payload->>'duration_days')::integer;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END;
      IF v_duration < 14 OR v_duration > 84 THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END IF;
    ELSIF v_current.proposal_type = 'REVIEW_SUMMARY' THEN
      v_review_type := upper(COALESCE(v_payload->>'review_type', ''));
      IF v_review_type = 'FINAL' THEN
        -- FINAL review confirmation must be coupled to an explicit terminal
        -- Season decision through rpc_conclude_season. This RPC intentionally
        -- refuses to infer COMPLETED vs ENDED_EARLY.
        RAISE EXCEPTION 'FINAL_REVIEW_REQUIRES_SEASON_CONCLUSION' USING ERRCODE = '23514';
      END IF;
      IF v_review_type NOT IN ('WEEKLY', 'AD_HOC')
         OR NOT (v_payload ? 'season_id')
         OR NOT (v_payload ? 'period_start')
         OR NOT (v_payload ? 'period_end')
         OR NOT (v_payload ? 'criteria_evaluation') THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_season_id := (v_payload->>'season_id')::uuid;
        v_period_start := (v_payload->>'period_start')::timestamptz;
        v_period_end := (v_payload->>'period_end')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END;
      IF v_period_end < v_period_start THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END IF;

      IF v_payload ? 'objective_summary' THEN
        v_objective_summary := v_payload->'objective_summary';
      ELSE
        v_objective_summary := jsonb_build_object('recap', COALESCE(v_payload->>'objective_recap', ''));
      END IF;
      v_qualitative_reflection := COALESCE(
        NULLIF(btrim(v_payload->>'qualitative_reflection'), ''),
        NULLIF(btrim(v_payload->>'qualitative_synthesis'), '')
      );
      v_criteria_evaluation := v_payload->'criteria_evaluation';
      IF v_qualitative_reflection IS NULL THEN
        RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
      END IF;
    ELSE
      RAISE EXCEPTION 'PROPOSAL_TYPE_NOT_AUTHORIZED_IN_PHASE8B' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.outer_loop_proposals
  SET status = p_decision,
      decision = p_decision,
      reviewed_at = clock_timestamp(),
      reviewed_by_id = v_user_id,
      review_request_idempotency_key = p_review_request_idempotency_key,
      rejection_reason = CASE WHEN p_decision = 'REJECTED' THEN NULLIF(btrim(COALESCE(p_rejection_reason, '')), '') ELSE NULL END
  WHERE id = p_proposal_id
    AND user_id = v_user_id
    AND status = 'PROPOSED'
  RETURNING * INTO v_proposal;

  IF NOT FOUND THEN
    SELECT * INTO v_current
    FROM public.outer_loop_proposals
    WHERE id = p_proposal_id AND user_id = v_user_id;

    IF v_current.review_request_idempotency_key = p_review_request_idempotency_key
       AND v_current.status = p_decision THEN
      RETURN jsonb_build_object(
        'proposal', to_jsonb(v_current),
        'resulting_entity_type', v_current.resulting_entity_type,
        'resulting_entity_id', v_current.resulting_entity_id,
        'replayed', true
      );
    END IF;
    RAISE EXCEPTION 'PROPOSAL_ALREADY_REVIEWED' USING ERRCODE = '23514';
  END IF;

  IF p_decision IN ('ACCEPTED', 'EDITED') THEN
    IF v_proposal.proposal_type = 'SEASON_PLAN' THEN
      INSERT INTO public.seasons (
        user_id,
        name,
        description,
        status
      ) VALUES (
        v_user_id,
        btrim(v_payload->>'title'),
        NULLIF(btrim(COALESCE(v_payload->>'theme', '')), ''),
        'DRAFT'
      )
      RETURNING id INTO v_result_id;

      v_result := public.rpc_plan_season(
        v_result_id,
        v_start_date,
        v_duration,
        v_payload->'success_criteria',
        'proposal-plan:' || p_proposal_id::text
      );
      v_result_type := 'seasons';
    ELSIF v_proposal.proposal_type = 'REVIEW_SUMMARY' THEN
      v_result := public.rpc_finalize_season_review(
        v_season_id,
        v_review_type,
        v_period_start,
        v_period_end,
        v_objective_summary,
        v_qualitative_reflection,
        v_criteria_evaluation,
        v_payload->>'tactical_adjustments',
        p_proposal_id
      );
      v_result_id := (v_result->'review'->>'id')::uuid;
      v_result_type := 'season_reviews';
    END IF;

    UPDATE public.outer_loop_proposals
    SET resulting_entity_type = v_result_type,
        resulting_entity_id = v_result_id
    WHERE id = p_proposal_id
    RETURNING * INTO v_proposal;
  END IF;

  PERFORM public.phase8b_write_audit(
    v_user_id,
    'PROPOSAL_REVIEWED',
    'outer_loop_proposals',
    p_proposal_id,
    p_review_request_idempotency_key,
    jsonb_strip_nulls(jsonb_build_object(
      'decision', p_decision,
      'proposal_type', v_proposal.proposal_type,
      'resulting_entity_type', v_result_type,
      'resulting_entity_id', v_result_id
    ))
  );

  RETURN jsonb_build_object(
    'proposal', to_jsonb(v_proposal),
    'result', v_result,
    'replayed', false
  );
END;
$$;

-- =============================================================================
-- Execute authority
-- =============================================================================

REVOKE ALL ON FUNCTION public.rpc_plan_season(uuid, date, integer, jsonb, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_activate_season(uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_conclude_season(uuid, text, jsonb, uuid, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_cancel_season(uuid, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_finalize_season_review(uuid, text, timestamptz, timestamptz, jsonb, text, jsonb, text, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_amend_final_season_review(uuid, jsonb, text, uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_link_season_quest(uuid, uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_unlink_season_quest(uuid, uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_plan_season(uuid, date, integer, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_activate_season(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_conclude_season(uuid, text, jsonb, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_season(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_finalize_season_review(uuid, text, timestamptz, timestamptz, jsonb, text, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_amend_final_season_review(uuid, jsonb, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_link_season_quest(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_unlink_season_quest(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text) TO authenticated;
