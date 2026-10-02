-- 0049_phase8e_reward_wishes_rpc_authority.sql
-- Phase 8E Round 2: deterministic reward policy, ten authority RPCs,
-- ledger/account parity, and WISH_COST_SUGGESTION proposal settlement.

-- =============================================================================
-- 1. IMMUTABLE REWARD-V1 POLICY + PRIVATE REQUEST/AUDIT HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_reward_grant_v1(
  p_source_type text,
  p_verified_source_attributes jsonb
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := upper(btrim(p_source_type));
  v_size text := lower(COALESCE(p_verified_source_attributes->>'quest_size', ''));
  v_is_boss boolean := COALESCE((p_verified_source_attributes->>'is_boss')::boolean, false);
  v_threshold integer;
BEGIN
  IF v_type = 'SEASON' THEN
    RETURN 150;
  ELSIF v_type = 'QUEST' THEN
    IF v_is_boss OR v_size = 'main' THEN RETURN 200; END IF;
    IF v_size = 'epic' THEN RETURN 150; END IF;
    IF v_size = 'major' THEN RETURN 100; END IF;
    RAISE EXCEPTION 'INELIGIBLE_QUEST_TIER' USING ERRCODE = '22023';
  ELSIF v_type = 'MASTERY' THEN
    v_threshold := (p_verified_source_attributes->>'threshold')::integer;
    IF v_threshold = 6 THEN RETURN 100; END IF;
    IF v_threshold = 8 THEN RETURN 150; END IF;
    IF v_threshold = 10 THEN RETURN 250; END IF;
    RAISE EXCEPTION 'INELIGIBLE_MASTERY_THRESHOLD' USING ERRCODE = '22023';
  END IF;
  RAISE EXCEPTION 'UNSUPPORTED_REWARD_SOURCE' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_begin_request(
  p_user_id uuid,
  p_rpc_name text,
  p_target_entity_type text,
  p_target_entity_id text,
  p_normalized_payload jsonb,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_key text := btrim(COALESCE(p_request_idempotency_key, ''));
  v_identity jsonb;
  v_fingerprint text;
  v_prior public.outer_loop_audit_events%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;
  IF v_key = '' OR length(v_key) > 200 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_rpc_name, '')) = ''
     OR btrim(COALESCE(p_target_entity_type, '')) = ''
     OR btrim(COALESCE(p_target_entity_id, '')) = '' THEN
    RAISE EXCEPTION 'INVALID_REQUEST_IDENTITY' USING ERRCODE = '22023';
  END IF;

  v_identity := jsonb_build_object(
    'rpc_name', p_rpc_name,
    'target_entity_type', p_target_entity_type,
    'target_entity_id', p_target_entity_id,
    'payload', COALESCE(p_normalized_payload, '{}'::jsonb)
  );
  v_fingerprint := encode(
    extensions.digest(convert_to('phase8e-request-v1:' || v_identity::text, 'UTF8'), 'sha256'),
    'hex'
  );

  -- This lock is deliberately before every target/source/account lookup.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || E'\x1f' || v_key, 0)
  );

  SELECT * INTO v_prior
  FROM public.outer_loop_audit_events
  WHERE user_id = p_user_id AND request_idempotency_key = v_key;

  IF FOUND THEN
    IF v_prior.event_data->>'rpc_name' IS DISTINCT FROM p_rpc_name
       OR v_prior.event_data->>'target_entity_type' IS DISTINCT FROM p_target_entity_type
       OR v_prior.event_data->>'target_entity_id' IS DISTINCT FROM p_target_entity_id
       OR v_prior.event_data->>'canonical_request_fingerprint' IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'replayed', true,
      'fingerprint', v_fingerprint,
      'result', v_prior.event_data->'result_snapshot'
    );
  END IF;

  RETURN jsonb_build_object('replayed', false, 'fingerprint', v_fingerprint);
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_write_audit(
  p_user_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_request_idempotency_key text,
  p_rpc_name text,
  p_target_entity_type text,
  p_target_entity_id text,
  p_normalized_payload jsonb,
  p_fingerprint text,
  p_result_snapshot jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.outer_loop_audit_events (
    user_id, event_type, entity_type, entity_id, request_idempotency_key,
    policy_version, schema_version, event_data
  ) VALUES (
    p_user_id, p_event_type, p_entity_type, p_entity_id,
    btrim(p_request_idempotency_key), 'phase8e-reward-v1', '1',
    jsonb_build_object(
      'rpc_name', p_rpc_name,
      'target_entity_type', p_target_entity_type,
      'target_entity_id', p_target_entity_id,
      'normalized_payload', COALESCE(p_normalized_payload, '{}'::jsonb),
      'canonical_request_fingerprint', p_fingerprint,
      'result_snapshot', COALESCE(p_result_snapshot, '{}'::jsonb)
    )
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_lock_reward_account(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.reward_accounts (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_id
  FROM public.reward_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_fold_reward_ledger(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.reward_transactions%ROWTYPE;
  v_lifetime_earned bigint := 0;
  v_net_earned bigint := 0;
  v_lifetime_redeemed bigint := 0;
  v_current_reserved bigint := 0;
  v_committed bigint;
BEGIN
  FOR v_tx IN
    SELECT * FROM public.reward_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at, id
  LOOP
    CASE v_tx.event_kind
      WHEN 'EARN' THEN
        IF v_tx.amount <= 0 THEN RAISE EXCEPTION 'INVALID_EARN_LEDGER_STATE' USING ERRCODE = '23514'; END IF;
        v_lifetime_earned := v_lifetime_earned + v_tx.amount;
        v_net_earned := v_net_earned + v_tx.amount;
      WHEN 'CORRECTION' THEN
        IF v_tx.amount = 0 THEN RAISE EXCEPTION 'INVALID_CORRECTION_LEDGER_STATE' USING ERRCODE = '23514'; END IF;
        IF v_tx.amount > 0 THEN v_lifetime_earned := v_lifetime_earned + v_tx.amount; END IF;
        v_net_earned := v_net_earned + v_tx.amount;
      WHEN 'RESERVE' THEN
        IF v_tx.amount <= 0 THEN RAISE EXCEPTION 'INVALID_RESERVE_LEDGER_STATE' USING ERRCODE = '23514'; END IF;
        v_current_reserved := v_current_reserved + v_tx.amount;
      WHEN 'UNRESERVE' THEN
        v_current_reserved := v_current_reserved - v_tx.amount;
        IF v_tx.amount <= 0 OR v_current_reserved < 0 THEN
          RAISE EXCEPTION 'INVALID_UNRESERVE_LEDGER_STATE' USING ERRCODE = '23514';
        END IF;
      WHEN 'REDEEM' THEN
        v_current_reserved := v_current_reserved - v_tx.amount;
        v_lifetime_redeemed := v_lifetime_redeemed + v_tx.amount;
        IF v_tx.amount <= 0 OR v_current_reserved < 0 THEN
          RAISE EXCEPTION 'INVALID_REDEEM_LEDGER_STATE' USING ERRCODE = '23514';
        END IF;
      WHEN 'REFUND' THEN
        v_lifetime_redeemed := v_lifetime_redeemed - v_tx.amount;
        IF v_tx.amount <= 0 OR v_lifetime_redeemed < 0 THEN
          RAISE EXCEPTION 'INVALID_REFUND_LEDGER_STATE' USING ERRCODE = '23514';
        END IF;
      ELSE
        RAISE EXCEPTION 'UNKNOWN_REWARD_EVENT_KIND' USING ERRCODE = '23514';
    END CASE;
  END LOOP;

  IF v_lifetime_earned > 2147483647 OR v_lifetime_redeemed > 2147483647
     OR v_current_reserved > 2147483647 OR v_net_earned > 2147483647
     OR v_net_earned < -2147483648 THEN
    RAISE EXCEPTION 'REWARD_LEDGER_INTEGER_OVERFLOW' USING ERRCODE = '22003';
  END IF;

  v_committed := v_lifetime_redeemed + v_current_reserved;
  RETURN jsonb_build_object(
    'lifetime_earned', v_lifetime_earned,
    'net_earned', v_net_earned,
    'lifetime_redeemed', v_lifetime_redeemed,
    'current_reserved', v_current_reserved,
    'correction_deficit', greatest(0, v_committed - v_net_earned),
    'current_available', greatest(0, v_net_earned - v_committed)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_preview_reward_account(
  p_account_id uuid,
  p_user_id uuid,
  p_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fold jsonb;
  v_account public.reward_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_account
  FROM public.reward_accounts
  WHERE id = p_account_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  v_fold := public.phase8e_fold_reward_ledger(p_user_id);
  RETURN to_jsonb(v_account) || v_fold || jsonb_build_object('updated_at', p_updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_apply_reward_account(
  p_account_id uuid,
  p_user_id uuid,
  p_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fold jsonb;
  v_account public.reward_accounts%ROWTYPE;
BEGIN
  v_fold := public.phase8e_fold_reward_ledger(p_user_id);
  UPDATE public.reward_accounts SET
    lifetime_earned = (v_fold->>'lifetime_earned')::integer,
    net_earned = (v_fold->>'net_earned')::integer,
    lifetime_redeemed = (v_fold->>'lifetime_redeemed')::integer,
    current_reserved = (v_fold->>'current_reserved')::integer,
    current_available = (v_fold->>'current_available')::integer,
    correction_deficit = (v_fold->>'correction_deficit')::integer,
    updated_at = p_updated_at
  WHERE id = p_account_id AND user_id = p_user_id
  RETURNING * INTO v_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(v_account);
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_sync_reward_account(
  p_account_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_updated_at timestamptz := clock_timestamp();
BEGIN
  RETURN public.phase8e_apply_reward_account(p_account_id, p_user_id, v_updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.phase8e_verified_reward_amount(
  p_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_policy_version text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := upper(btrim(COALESCE(p_source_type, '')));
  v_uuid uuid;
  v_quest public.quests%ROWTYPE;
  v_skill_id uuid;
  v_threshold integer;
  v_match text[];
BEGIN
  IF p_policy_version IS DISTINCT FROM 'reward-v1' THEN
    RAISE EXCEPTION 'UNKNOWN_REWARD_POLICY_VERSION' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'SEASON' THEN
    BEGIN v_uuid := p_source_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'REWARD_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END;
    PERFORM 1 FROM public.seasons s
    WHERE s.id = v_uuid AND s.user_id = p_user_id AND s.status = 'COMPLETED'
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    PERFORM 1 FROM public.season_reviews r
    WHERE r.season_id = v_uuid AND r.user_id = p_user_id AND r.review_type = 'FINAL';
    IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_SOURCE_NOT_ELIGIBLE' USING ERRCODE = '23514'; END IF;
    RETURN public.calculate_reward_grant_v1('SEASON', '{}'::jsonb);
  ELSIF v_type = 'QUEST' THEN
    BEGIN v_uuid := p_source_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'REWARD_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END;
    SELECT * INTO v_quest FROM public.quests
    WHERE id = v_uuid AND user_id = p_user_id
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_quest.status <> 'completed'
       OR (v_quest.quest_size NOT IN ('major', 'epic', 'main') AND NOT v_quest.is_boss) THEN
      RAISE EXCEPTION 'REWARD_SOURCE_NOT_ELIGIBLE' USING ERRCODE = '23514';
    END IF;
    RETURN public.calculate_reward_grant_v1(
      'QUEST', jsonb_build_object('quest_size', v_quest.quest_size, 'is_boss', v_quest.is_boss)
    );
  ELSIF v_type = 'MASTERY' THEN
    v_match := regexp_match(
      p_source_id,
      '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):M(6|8|10)$'
    );
    IF v_match IS NULL THEN RAISE EXCEPTION 'REWARD_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    v_skill_id := v_match[1]::uuid;
    v_threshold := v_match[2]::integer;
    PERFORM 1 FROM public.mastery_verifications mv
    WHERE mv.user_id = p_user_id AND mv.skill_id = v_skill_id
      AND mv.to_level = v_threshold AND mv.status = 'verified'
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_SOURCE_NOT_ELIGIBLE' USING ERRCODE = '23514'; END IF;
    RETURN public.calculate_reward_grant_v1('MASTERY', jsonb_build_object('threshold', v_threshold));
  END IF;

  RAISE EXCEPTION 'UNSUPPORTED_REWARD_SOURCE' USING ERRCODE = '22023';
END;
$$;

-- =============================================================================
-- 2. REWARD EARN/CORRECTION RPCS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_grant_reward_credit(
  p_source_type text,
  p_source_id text,
  p_policy_version text,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_type text := upper(btrim(COALESCE(p_source_type, '')));
  v_source_id text := btrim(COALESCE(p_source_id, ''));
  v_payload jsonb := jsonb_build_object('policy_version', p_policy_version);
  v_begin jsonb;
  v_result jsonb;
  v_amount integer;
  v_account_id uuid;
  v_tx public.reward_transactions%ROWTYPE;
  v_account jsonb;
  v_account_updated_at timestamptz;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_grant_reward_credit',
    'reward_source', v_type || ':' || v_source_id, v_payload, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN
    RETURN (v_begin->'result') || jsonb_build_object('replayed', true);
  END IF;

  IF v_type IN ('MICRO_ACTIVITY', 'DAILY_LOGIN', 'HABIT_CHECKIN', 'JOURNAL',
      'FOCUS_TIME', 'STREAK', 'SELF_ATTESTED', 'ARTIFACT', 'REAL_WORLD_VERIFIED') THEN
    v_result := jsonb_build_object(
      'ok', false,
      'error_code', CASE WHEN v_type IN ('ARTIFACT', 'REAL_WORLD_VERIFIED')
        THEN 'SOURCE_CLASS_NOT_YET_AVAILABLE' ELSE 'FARMING_SOURCE_REJECTED' END,
      'source_type', v_type,
      'source_id', v_source_id,
      'replayed', false
    );
    PERFORM public.phase8e_write_audit(v_user_id, 'REWARD_GRANT_REJECTED',
      'reward_source', NULL, p_request_idempotency_key, 'rpc_grant_reward_credit',
      'reward_source', v_type || ':' || v_source_id, v_payload,
      v_begin->>'fingerprint', v_result);
    RETURN v_result;
  END IF;

  IF v_type NOT IN ('SEASON', 'QUEST', 'MASTERY') OR v_source_id = '' THEN
    RAISE EXCEPTION 'UNSUPPORTED_REWARD_SOURCE' USING ERRCODE = '22023';
  END IF;

  -- Financial lock order: account, then source, then transaction insert.
  v_account_id := public.phase8e_lock_reward_account(v_user_id);
  v_amount := public.phase8e_verified_reward_amount(
    v_user_id, v_type, v_source_id, p_policy_version
  );

  BEGIN
    INSERT INTO public.reward_transactions (
      account_id, user_id, event_kind, amount, canonical_source_type,
      canonical_source_id, policy_version, request_idempotency_key
    ) VALUES (
      v_account_id, v_user_id, 'EARN', v_amount, v_type,
      v_source_id, p_policy_version, btrim(p_request_idempotency_key)
    ) RETURNING * INTO v_tx;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REWARD_SOURCE_ALREADY_GRANTED' USING ERRCODE = '23505';
  END;

  v_account_updated_at := clock_timestamp();
  v_account := public.phase8e_preview_reward_account(v_account_id, v_user_id, v_account_updated_at);
  v_result := jsonb_build_object('ok', true, 'transaction', to_jsonb(v_tx),
    'account', v_account, 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'REWARD_CREDIT_GRANTED',
    'reward_transactions', v_tx.id, p_request_idempotency_key,
    'rpc_grant_reward_credit', 'reward_source', v_type || ':' || v_source_id,
    v_payload, v_begin->>'fingerprint', v_result);
  PERFORM public.phase8e_apply_reward_account(v_account_id, v_user_id, v_account_updated_at);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_correct_reward_transaction(
  p_transaction_id uuid,
  p_note text,
  p_request_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payload jsonb := jsonb_build_object('note', NULLIF(btrim(COALESCE(p_note, '')), ''));
  v_begin jsonb;
  v_original public.reward_transactions%ROWTYPE;
  v_tx public.reward_transactions%ROWTYPE;
  v_account_id uuid;
  v_account jsonb;
  v_result jsonb;
  v_account_updated_at timestamptz;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_correct_reward_transaction',
    'reward_transactions', p_transaction_id::text, v_payload, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN
    RETURN (v_begin->'result') || jsonb_build_object('replayed', true);
  END IF;
  v_account_id := public.phase8e_lock_reward_account(v_user_id);
  SELECT * INTO v_original FROM public.reward_transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_original.event_kind <> 'EARN' THEN
    RAISE EXCEPTION 'ONLY_EARN_CAN_BE_CORRECTED' USING ERRCODE = '23514';
  END IF;
  BEGIN
    INSERT INTO public.reward_transactions (
      account_id, user_id, event_kind, amount, canonical_source_type,
      canonical_source_id, policy_version, request_idempotency_key,
      correction_for_id, note
    ) VALUES (
      v_account_id, v_user_id, 'CORRECTION', -v_original.amount,
      v_original.canonical_source_type, v_original.canonical_source_id,
      v_original.policy_version, btrim(p_request_idempotency_key),
      v_original.id, NULLIF(btrim(COALESCE(p_note, '')), '')
    ) RETURNING * INTO v_tx;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REWARD_TRANSACTION_ALREADY_CORRECTED' USING ERRCODE = '23505';
  END;
  v_account_updated_at := clock_timestamp();
  v_account := public.phase8e_preview_reward_account(v_account_id, v_user_id, v_account_updated_at);
  v_result := jsonb_build_object('ok', true, 'transaction', to_jsonb(v_tx),
    'account', v_account, 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'REWARD_TRANSACTION_CORRECTED',
    'reward_transactions', v_tx.id, p_request_idempotency_key,
    'rpc_correct_reward_transaction', 'reward_transactions', p_transaction_id::text,
    v_payload, v_begin->>'fingerprint', v_result);
  PERFORM public.phase8e_apply_reward_account(v_account_id, v_user_id, v_account_updated_at);
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 3. WISH LIFECYCLE + FINANCIAL RPCS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_activate_wish(
  p_wish_id uuid, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_begin jsonb; v_result jsonb;
  v_wish public.wishes%ROWTYPE;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_activate_wish',
    'wishes', p_wish_id::text, '{}'::jsonb, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  SELECT * INTO v_wish FROM public.wishes WHERE id = p_wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wish.status <> 'IDEA' THEN RAISE EXCEPTION 'INVALID_WISH_TRANSITION' USING ERRCODE = '23514'; END IF;
  IF v_wish.credit_cost IS NULL OR v_wish.credit_cost <= 0 THEN RAISE EXCEPTION 'WISH_COST_REQUIRED' USING ERRCODE = '22023'; END IF;
  UPDATE public.wishes SET status = 'ACTIVE', updated_at = clock_timestamp()
  WHERE id = p_wish_id RETURNING * INTO v_wish;
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish), 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_ACTIVATED', 'wishes', p_wish_id,
    p_request_idempotency_key, 'rpc_activate_wish', 'wishes', p_wish_id::text,
    '{}'::jsonb, v_begin->>'fingerprint', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_set_primary_wish(
  p_wish_id uuid, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_begin jsonb; v_result jsonb;
  v_wish public.wishes%ROWTYPE; v_other uuid; v_account_id uuid;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_set_primary_wish',
    'wishes', p_wish_id::text, '{}'::jsonb, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  v_account_id := public.phase8e_lock_reward_account(v_user_id);
  SELECT * INTO v_wish FROM public.wishes WHERE id = p_wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wish.status <> 'ACTIVE' THEN RAISE EXCEPTION 'INVALID_WISH_TRANSITION' USING ERRCODE = '23514'; END IF;
  IF v_wish.credit_cost IS NULL OR v_wish.credit_cost <= 0 THEN RAISE EXCEPTION 'WISH_COST_REQUIRED' USING ERRCODE = '22023'; END IF;
  SELECT id INTO v_other FROM public.wishes
  WHERE user_id = v_user_id AND id <> p_wish_id AND status IN ('PRIMARY', 'RESERVED')
  ORDER BY id LIMIT 1 FOR UPDATE;
  IF v_other IS NOT NULL THEN RAISE EXCEPTION 'SELECTED_WISH_ALREADY_EXISTS' USING ERRCODE = '23505'; END IF;
  UPDATE public.wishes SET status = 'PRIMARY', updated_at = clock_timestamp()
  WHERE id = p_wish_id RETURNING * INTO v_wish;
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish), 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_SET_PRIMARY', 'wishes', p_wish_id,
    p_request_idempotency_key, 'rpc_set_primary_wish', 'wishes', p_wish_id::text,
    '{}'::jsonb, v_begin->>'fingerprint', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reserve_wish_credits(
  p_wish_id uuid, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_begin jsonb; v_result jsonb;
  v_wish public.wishes%ROWTYPE; v_tx public.reward_transactions%ROWTYPE;
  v_account_id uuid; v_account jsonb; v_account_updated_at timestamptz;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_reserve_wish_credits',
    'wishes', p_wish_id::text, '{}'::jsonb, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  v_account_id := public.phase8e_lock_reward_account(v_user_id);
  v_account := public.phase8e_preview_reward_account(v_account_id, v_user_id, clock_timestamp());
  SELECT * INTO v_wish FROM public.wishes WHERE id = p_wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wish.status <> 'PRIMARY' THEN RAISE EXCEPTION 'INVALID_WISH_TRANSITION' USING ERRCODE = '23514'; END IF;
  IF v_wish.credit_cost IS NULL OR v_wish.credit_cost <= 0 THEN RAISE EXCEPTION 'WISH_COST_REQUIRED' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.wishes
  WHERE user_id = v_user_id AND status = 'REDEEMED' AND cooldown_until > clock_timestamp()
  ORDER BY id LIMIT 1 FOR SHARE;
  IF FOUND THEN RAISE EXCEPTION 'REDEMPTION_COOLDOWN_ACTIVE' USING ERRCODE = '23514'; END IF;
  IF (v_account->>'current_available')::integer < v_wish.credit_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_REWARD_CREDITS' USING ERRCODE = '22003';
  END IF;
  INSERT INTO public.reward_transactions (
    account_id, user_id, event_kind, amount, canonical_source_type,
    canonical_source_id, policy_version, request_idempotency_key
  ) VALUES (v_account_id, v_user_id, 'RESERVE', v_wish.credit_cost, 'WISH',
    v_wish.id::text, NULL, btrim(p_request_idempotency_key)) RETURNING * INTO v_tx;
  UPDATE public.wishes SET status = 'RESERVED', updated_at = clock_timestamp()
  WHERE id = p_wish_id RETURNING * INTO v_wish;
  v_account_updated_at := clock_timestamp();
  v_account := public.phase8e_preview_reward_account(v_account_id, v_user_id, v_account_updated_at);
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish),
    'transaction', to_jsonb(v_tx), 'account', v_account, 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_CREDITS_RESERVED', 'wishes', p_wish_id,
    p_request_idempotency_key, 'rpc_reserve_wish_credits', 'wishes', p_wish_id::text,
    '{}'::jsonb, v_begin->>'fingerprint', v_result);
  PERFORM public.phase8e_apply_reward_account(v_account_id, v_user_id, v_account_updated_at);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_unreserve_wish_credits(
  p_wish_id uuid, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_begin jsonb; v_result jsonb;
  v_wish public.wishes%ROWTYPE; v_tx public.reward_transactions%ROWTYPE;
  v_account_id uuid; v_account jsonb; v_account_updated_at timestamptz;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_unreserve_wish_credits',
    'wishes', p_wish_id::text, '{}'::jsonb, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  v_account_id := public.phase8e_lock_reward_account(v_user_id);
  SELECT * INTO v_wish FROM public.wishes WHERE id = p_wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wish.status <> 'RESERVED' OR v_wish.credit_cost IS NULL THEN
    RAISE EXCEPTION 'INVALID_WISH_TRANSITION' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.reward_transactions (
    account_id, user_id, event_kind, amount, canonical_source_type,
    canonical_source_id, policy_version, request_idempotency_key
  ) VALUES (v_account_id, v_user_id, 'UNRESERVE', v_wish.credit_cost, 'WISH',
    v_wish.id::text, NULL, btrim(p_request_idempotency_key)) RETURNING * INTO v_tx;
  UPDATE public.wishes SET status = 'PRIMARY', updated_at = clock_timestamp()
  WHERE id = p_wish_id RETURNING * INTO v_wish;
  v_account_updated_at := clock_timestamp();
  v_account := public.phase8e_preview_reward_account(v_account_id, v_user_id, v_account_updated_at);
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish),
    'transaction', to_jsonb(v_tx), 'account', v_account, 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_CREDITS_UNRESERVED', 'wishes', p_wish_id,
    p_request_idempotency_key, 'rpc_unreserve_wish_credits', 'wishes', p_wish_id::text,
    '{}'::jsonb, v_begin->>'fingerprint', v_result);
  PERFORM public.phase8e_apply_reward_account(v_account_id, v_user_id, v_account_updated_at);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_redeem_wish(
  p_wish_id uuid, p_celebration_note text, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payload jsonb := jsonb_build_object('celebration_note', NULLIF(btrim(COALESCE(p_celebration_note, '')), ''));
  v_begin jsonb; v_result jsonb; v_wish public.wishes%ROWTYPE;
  v_tx public.reward_transactions%ROWTYPE; v_receipt public.reward_redemptions%ROWTYPE;
  v_account_id uuid; v_account jsonb; v_account_updated_at timestamptz;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_redeem_wish',
    'wishes', p_wish_id::text, v_payload, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  v_account_id := public.phase8e_lock_reward_account(v_user_id);
  SELECT * INTO v_wish FROM public.wishes WHERE id = p_wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wish.status <> 'RESERVED' OR v_wish.credit_cost IS NULL THEN
    RAISE EXCEPTION 'INVALID_WISH_TRANSITION' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.reward_transactions (
    account_id, user_id, event_kind, amount, canonical_source_type,
    canonical_source_id, policy_version, request_idempotency_key
  ) VALUES (v_account_id, v_user_id, 'REDEEM', v_wish.credit_cost, 'WISH',
    v_wish.id::text, NULL, btrim(p_request_idempotency_key)) RETURNING * INTO v_tx;
  UPDATE public.wishes SET status = 'REDEEMED', cooldown_until = clock_timestamp() + interval '7 days',
    updated_at = clock_timestamp() WHERE id = p_wish_id RETURNING * INTO v_wish;
  INSERT INTO public.reward_redemptions (
    user_id, wish_id, transaction_id, credits_spent, celebration_note
  ) VALUES (v_user_id, p_wish_id, v_tx.id, v_wish.credit_cost,
    NULLIF(btrim(COALESCE(p_celebration_note, '')), '')) RETURNING * INTO v_receipt;
  v_account_updated_at := clock_timestamp();
  v_account := public.phase8e_preview_reward_account(v_account_id, v_user_id, v_account_updated_at);
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish),
    'transaction', to_jsonb(v_tx), 'redemption', to_jsonb(v_receipt),
    'account', v_account, 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_REDEEMED', 'wishes', p_wish_id,
    p_request_idempotency_key, 'rpc_redeem_wish', 'wishes', p_wish_id::text,
    v_payload, v_begin->>'fingerprint', v_result);
  PERFORM public.phase8e_apply_reward_account(v_account_id, v_user_id, v_account_updated_at);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_refund_wish_redemption(
  p_redemption_id uuid, p_note text, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payload jsonb := jsonb_build_object('note', NULLIF(btrim(COALESCE(p_note, '')), ''));
  v_begin jsonb; v_result jsonb; v_receipt public.reward_redemptions%ROWTYPE;
  v_wish public.wishes%ROWTYPE; v_tx public.reward_transactions%ROWTYPE;
  v_account_id uuid; v_account jsonb; v_account_updated_at timestamptz;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_refund_wish_redemption',
    'reward_redemptions', p_redemption_id::text, v_payload, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  v_account_id := public.phase8e_lock_reward_account(v_user_id);
  SELECT * INTO v_receipt FROM public.reward_redemptions
  WHERE id = p_redemption_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REDEMPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_wish FROM public.wishes
  WHERE id = v_receipt.wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND OR v_wish.status <> 'REDEEMED' THEN
    RAISE EXCEPTION 'INVALID_REFUND_STATE' USING ERRCODE = '23514';
  END IF;
  BEGIN
    INSERT INTO public.reward_transactions (
      account_id, user_id, event_kind, amount, canonical_source_type,
      canonical_source_id, policy_version, request_idempotency_key,
      refund_for_redemption_id, note
    ) VALUES (v_account_id, v_user_id, 'REFUND', v_receipt.credits_spent, 'WISH',
      v_receipt.wish_id::text, NULL, btrim(p_request_idempotency_key),
      v_receipt.id, NULLIF(btrim(COALESCE(p_note, '')), '')) RETURNING * INTO v_tx;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REDEMPTION_ALREADY_REFUNDED' USING ERRCODE = '23505';
  END;
  v_account_updated_at := clock_timestamp();
  v_account := public.phase8e_preview_reward_account(v_account_id, v_user_id, v_account_updated_at);
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish),
    'transaction', to_jsonb(v_tx), 'redemption', to_jsonb(v_receipt),
    'account', v_account, 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_REDEMPTION_REFUNDED',
    'reward_redemptions', p_redemption_id, p_request_idempotency_key,
    'rpc_refund_wish_redemption', 'reward_redemptions', p_redemption_id::text,
    v_payload, v_begin->>'fingerprint', v_result);
  PERFORM public.phase8e_apply_reward_account(v_account_id, v_user_id, v_account_updated_at);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_archive_wish(
  p_wish_id uuid, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_begin jsonb; v_result jsonb;
  v_wish public.wishes%ROWTYPE;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_archive_wish',
    'wishes', p_wish_id::text, '{}'::jsonb, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  SELECT * INTO v_wish FROM public.wishes WHERE id = p_wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wish.status NOT IN ('IDEA', 'ACTIVE', 'PRIMARY') THEN RAISE EXCEPTION 'INVALID_WISH_TRANSITION' USING ERRCODE = '23514'; END IF;
  UPDATE public.wishes SET status = 'ARCHIVED', updated_at = clock_timestamp()
  WHERE id = p_wish_id RETURNING * INTO v_wish;
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish), 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_ARCHIVED', 'wishes', p_wish_id,
    p_request_idempotency_key, 'rpc_archive_wish', 'wishes', p_wish_id::text,
    '{}'::jsonb, v_begin->>'fingerprint', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_cancel_wish(
  p_wish_id uuid, p_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_begin jsonb; v_result jsonb;
  v_wish public.wishes%ROWTYPE;
BEGIN
  v_begin := public.phase8e_begin_request(v_user_id, 'rpc_cancel_wish',
    'wishes', p_wish_id::text, '{}'::jsonb, p_request_idempotency_key);
  IF (v_begin->>'replayed')::boolean THEN RETURN (v_begin->'result') || jsonb_build_object('replayed', true); END IF;
  SELECT * INTO v_wish FROM public.wishes WHERE id = p_wish_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wish.status NOT IN ('IDEA', 'ACTIVE', 'PRIMARY') THEN RAISE EXCEPTION 'INVALID_WISH_TRANSITION' USING ERRCODE = '23514'; END IF;
  UPDATE public.wishes SET status = 'CANCELLED', updated_at = clock_timestamp()
  WHERE id = p_wish_id RETURNING * INTO v_wish;
  v_result := jsonb_build_object('ok', true, 'wish', to_jsonb(v_wish), 'replayed', false);
  PERFORM public.phase8e_write_audit(v_user_id, 'WISH_CANCELLED', 'wishes', p_wish_id,
    p_request_idempotency_key, 'rpc_cancel_wish', 'wishes', p_wish_id::text,
    '{}'::jsonb, v_begin->>'fingerprint', v_result);
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 4. WISH COST PROPOSAL SETTLEMENT EXTENSION
-- =============================================================================

ALTER FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text)
  RENAME TO phase8d_review_outer_loop_proposal;
REVOKE ALL ON FUNCTION public.phase8d_review_outer_loop_proposal(uuid, text, jsonb, text, text)
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
  v_payload jsonb; v_reviewed_payload jsonb; v_wish public.wishes%ROWTYPE;
  v_wish_id uuid; v_cost integer; v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_proposal FROM public.outer_loop_proposals
  WHERE id = p_proposal_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_proposal.proposal_type <> 'WISH_COST_SUGGESTION' THEN
    RETURN public.phase8d_review_outer_loop_proposal(p_proposal_id, p_decision,
      p_edited_payload, p_rejection_reason, p_review_request_idempotency_key);
  END IF;
  IF p_decision NOT IN ('ACCEPTED', 'EDITED', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_DECISION' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_review_request_idempotency_key, '')) = '' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = '22023';
  END IF;
  IF v_proposal.status <> 'PROPOSED' THEN
    IF v_proposal.review_request_idempotency_key = p_review_request_idempotency_key
       AND v_proposal.status = p_decision THEN
      SELECT event_data->'reviewed_payload' INTO v_reviewed_payload
      FROM public.outer_loop_audit_events
      WHERE user_id = v_user_id AND request_idempotency_key = p_review_request_idempotency_key;
      IF p_decision = 'EDITED' AND p_edited_payload IS DISTINCT FROM v_reviewed_payload THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT' USING ERRCODE = '23505';
      END IF;
      RETURN jsonb_build_object('proposal', to_jsonb(v_proposal),
        'reviewed_payload', v_reviewed_payload,
        'result', CASE WHEN v_proposal.resulting_entity_id IS NULL THEN NULL
          ELSE jsonb_build_object('wish_id', v_proposal.resulting_entity_id) END,
        'replayed', true);
    END IF;
    RAISE EXCEPTION 'PROPOSAL_ALREADY_REVIEWED' USING ERRCODE = '23514';
  END IF;
  IF v_proposal.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'PROPOSAL_EXPIRED' USING ERRCODE = '23514';
  END IF;
  v_payload := CASE WHEN p_decision = 'EDITED' THEN p_edited_payload ELSE v_proposal.payload END;
  IF p_decision IN ('ACCEPTED', 'EDITED') THEN
    IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object'
       OR NOT (v_payload ? 'wish_id') OR NOT (v_payload ? 'suggested_credits') THEN
      RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_wish_id := (v_payload->>'wish_id')::uuid;
      v_cost := (v_payload->>'suggested_credits')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023';
    END;
    IF v_cost <= 0 THEN RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_wish FROM public.wishes
    WHERE id = v_wish_id AND user_id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WISH_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_wish.status NOT IN ('IDEA', 'ACTIVE') THEN
      RAISE EXCEPTION 'WISH_COST_NOT_EDITABLE' USING ERRCODE = '23514';
    END IF;
    UPDATE public.wishes SET credit_cost = v_cost, updated_at = clock_timestamp()
    WHERE id = v_wish_id RETURNING * INTO v_wish;
  END IF;
  UPDATE public.outer_loop_proposals SET
    status = p_decision, decision = p_decision, reviewed_at = clock_timestamp(),
    reviewed_by_id = v_user_id,
    review_request_idempotency_key = p_review_request_idempotency_key,
    rejection_reason = CASE WHEN p_decision = 'REJECTED'
      THEN NULLIF(btrim(COALESCE(p_rejection_reason, '')), '') ELSE NULL END,
    resulting_entity_type = CASE WHEN p_decision IN ('ACCEPTED', 'EDITED') THEN 'wishes' ELSE NULL END,
    resulting_entity_id = CASE WHEN p_decision IN ('ACCEPTED', 'EDITED') THEN v_wish_id ELSE NULL END
  WHERE id = p_proposal_id RETURNING * INTO v_proposal;
  PERFORM public.phase8d_write_audit(v_user_id, 'PROPOSAL_REVIEWED',
    'outer_loop_proposals', p_proposal_id, p_review_request_idempotency_key,
    jsonb_strip_nulls(jsonb_build_object('decision', p_decision,
      'proposal_type', v_proposal.proposal_type,
      'reviewed_payload', CASE WHEN p_decision IN ('ACCEPTED', 'EDITED') THEN v_payload ELSE NULL END,
      'resulting_entity_type', v_proposal.resulting_entity_type,
      'resulting_entity_id', v_proposal.resulting_entity_id)));
  v_result := jsonb_build_object('proposal', to_jsonb(v_proposal),
    'reviewed_payload', CASE WHEN p_decision IN ('ACCEPTED', 'EDITED') THEN v_payload ELSE NULL END,
    'result', CASE WHEN v_wish_id IS NULL THEN NULL ELSE jsonb_build_object('wish_id', v_wish_id) END,
    'replayed', false);
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 5. LEAST-PRIVILEGE EXECUTION GRANTS
-- =============================================================================

REVOKE ALL ON FUNCTION public.calculate_reward_grant_v1(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_begin_request(uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_write_audit(uuid, text, text, uuid, text, text, text, text, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_lock_reward_account(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_fold_reward_ledger(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_preview_reward_account(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_apply_reward_account(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_sync_reward_account(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.phase8e_verified_reward_amount(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_grant_reward_credit(text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_correct_reward_transaction(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_activate_wish(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_set_primary_wish(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_reserve_wish_credits(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_unreserve_wish_credits(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_redeem_wish(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_refund_wish_redemption(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_archive_wish(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_cancel_wish(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_grant_reward_credit(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_correct_reward_transaction(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_activate_wish(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_primary_wish(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reserve_wish_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_unreserve_wish_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_wish(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_refund_wish_redemption(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_archive_wish(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_wish(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_outer_loop_proposal(uuid, text, jsonb, text, text) TO authenticated;
