-- Phase 8E corrective authority migration: one canonical identity per real source.
-- 0048/0049 remain historical; reward-v1 amounts and all other authority stay unchanged.
-- No historical ledger/audit rewrite. Noncanonical history requires an explicit recovery plan.

CREATE OR REPLACE FUNCTION public.phase8e_canonical_reward_source_id(
  p_source_type text, p_source_id text
)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := upper(btrim(COALESCE(p_source_type, '')));
  v_id text := btrim(COALESCE(p_source_id, ''));
  v_match text[];
BEGIN
  IF v_type IN ('SEASON', 'QUEST') THEN
    BEGIN
      RETURN (v_id::uuid)::text;
    EXCEPTION WHEN invalid_text_representation THEN
      -- No target lookup or error before caller/key replay conflict resolution.
      RETURN v_id;
    END;
  ELSIF v_type = 'MASTERY' THEN
    v_match := regexp_match(v_id,
      '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):M(6|8|10)$');
    IF v_match IS NOT NULL THEN
      RETURN (v_match[1]::uuid)::text || ':M' || v_match[2];
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.phase8e_canonical_reward_source_id(text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Lock out grant writes while checking legacy rows and installing the corrected function.
-- Fail closed instead of rewriting immutable history or invalidating old audit replay keys.
LOCK TABLE public.reward_transactions IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reward_transactions
    WHERE event_kind = 'EARN'
      AND canonical_source_id IS DISTINCT FROM
        public.phase8e_canonical_reward_source_id(canonical_source_type, canonical_source_id)
  ) THEN
    RAISE EXCEPTION 'NONCANONICAL_REWARD_HISTORY_REQUIRES_REVIEW'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

-- Reject even the first noncanonical insert from an old in-flight grant body.
-- A normalized unique index alone only blocks an alias when a grant already exists.
ALTER TABLE public.reward_transactions
  ADD CONSTRAINT ck_reward_tx_canonical_earn_source CHECK (
    event_kind <> 'EARN' OR canonical_source_id =
      public.phase8e_canonical_reward_source_id(canonical_source_type, canonical_source_id)
  );

-- Defense in depth: normalization participates in schema-backed uniqueness.
CREATE UNIQUE INDEX uq_reward_tx_normalized_source
  ON public.reward_transactions (
    user_id, canonical_source_type,
    public.phase8e_canonical_reward_source_id(canonical_source_type, canonical_source_id),
    policy_version
  ) WHERE event_kind = 'EARN';

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
  v_source_id text := public.phase8e_canonical_reward_source_id(p_source_type, p_source_id);
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

REVOKE ALL ON FUNCTION public.rpc_grant_reward_credit(text, text, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_grant_reward_credit(text, text, text, text)
  TO authenticated;
