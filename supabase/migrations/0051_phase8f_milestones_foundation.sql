-- Phase 8F Round 1, admitted controller 25: recognition storage only.
-- No public RPC, reward issuance, source eligibility evaluator or Core mutation.
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key text NOT NULL CHECK (btrim(milestone_key) <> ''),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NULL,
  recognition_class text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  external_evidence_url text NULL,
  external_credential_id text NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  granted_reward_credit boolean NOT NULL DEFAULT false,
  reward_transaction_id uuid NULL REFERENCES public.reward_transactions(id) ON DELETE RESTRICT,
  confirmation_request_idempotency_key text NOT NULL
    CHECK (btrim(confirmation_request_idempotency_key) <> ''
      AND confirmation_request_idempotency_key = btrim(confirmation_request_idempotency_key)
      AND length(confirmation_request_idempotency_key) <= 200),
  revocation_request_idempotency_key text NULL
    CHECK (revocation_request_idempotency_key IS NULL OR
      (btrim(revocation_request_idempotency_key) <> ''
       AND revocation_request_idempotency_key = btrim(revocation_request_idempotency_key)
       AND length(revocation_request_idempotency_key) <= 200)),
  recognized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz NULL,
  revocation_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT milestones_class_source_check CHECK (
    (recognition_class = 'CORE_VERIFIED' AND source_type IN ('QUEST', 'MASTERY', 'SEASON'))
    OR (recognition_class = 'USER_CONFIRMED_REAL_WORLD' AND source_type = 'EXTERNAL_CREDENTIAL')
  ),
  -- UUID text must be canonical, not merely equal to 0050's permissive normalizer.
  -- Mastery deliberately retains 0050's exact UUID/threshold grammar.
  CONSTRAINT milestones_canonical_source_check CHECK (
    (source_type IN ('QUEST', 'SEASON', 'EXTERNAL_CREDENTIAL') AND
      source_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (source_type = 'MASTERY' AND
      source_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:M(6|8|10)$')
  ),
  CONSTRAINT milestones_reward_shape_check CHECK (
    granted_reward_credit = (reward_transaction_id IS NOT NULL)
    AND (recognition_class <> 'USER_CONFIRMED_REAL_WORLD' OR NOT granted_reward_credit)
  ),
  CONSTRAINT milestones_revocation_shape_check CHECK (
    (status = 'ACTIVE' AND revoked_at IS NULL AND revocation_reason IS NULL
      AND revocation_request_idempotency_key IS NULL)
    OR (status = 'REVOKED' AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL
      AND btrim(revocation_reason) <> '' AND revocation_request_idempotency_key IS NOT NULL)
  ),
  CONSTRAINT milestones_key_source_unique UNIQUE (user_id, milestone_key, source_type, source_id),
  CONSTRAINT milestones_canonical_source_unique UNIQUE (user_id, source_type, source_id),
  CONSTRAINT uq_milestones_confirmation_idempotency UNIQUE (user_id, confirmation_request_idempotency_key)
);

CREATE UNIQUE INDEX uq_milestones_revocation_idempotency
  ON public.milestones (user_id, revocation_request_idempotency_key)
  WHERE revocation_request_idempotency_key IS NOT NULL;
CREATE INDEX idx_milestones_user_class ON public.milestones (user_id, recognition_class);

-- SECURITY INVOKER is intentional: caller identity must survive into this guard.
-- Future bounded SECURITY DEFINER RPCs run as the table owner; application roles
-- cannot manufacture authority with a JWT claim or a custom session setting.
CREATE FUNCTION public.trg_enforce_milestone_authority()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source_owner uuid;
  v_reward public.reward_transactions%ROWTYPE;
  v_account_owner uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Milestone history cannot be deleted' USING ERRCODE = '42501';
  END IF;
  IF current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = TG_RELID)) THEN
    RAISE EXCEPTION 'Milestone mutation requires private RPC authority' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'ACTIVE' OR NEW.granted_reward_credit
       OR NEW.reward_transaction_id IS NOT NULL OR NEW.revoked_at IS NOT NULL
       OR NEW.revocation_reason IS NOT NULL OR NEW.revocation_request_idempotency_key IS NOT NULL THEN
      RAISE EXCEPTION 'Milestone must start active and unfunded' USING ERRCODE = '23514';
    END IF;
    -- This is ownership validation, not Round 2's eligibility evaluator. Keeping
    -- it insert-only lets later revocation preserve history after source removal.
    IF NEW.source_type = 'QUEST' THEN
      SELECT user_id INTO v_source_owner FROM public.quests WHERE id::text = NEW.source_id;
    ELSIF NEW.source_type = 'SEASON' THEN
      SELECT user_id INTO v_source_owner FROM public.seasons WHERE id::text = NEW.source_id;
    ELSIF NEW.source_type = 'MASTERY' THEN
      SELECT user_id INTO v_source_owner FROM public.skills WHERE id::text = split_part(NEW.source_id, ':', 1);
    END IF;
    IF NEW.source_type IN ('QUEST', 'SEASON', 'MASTERY')
       AND (v_source_owner IS NULL OR NEW.user_id IS DISTINCT FROM v_source_owner) THEN
      RAISE EXCEPTION 'Milestone source tenant mismatch' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := clock_timestamp();
    NEW.recognized_at := NEW.created_at;
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - ARRAY['status', 'granted_reward_credit', 'reward_transaction_id',
        'revoked_at', 'revocation_reason', 'revocation_request_idempotency_key', 'updated_at'])
      IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status', 'granted_reward_credit', 'reward_transaction_id',
        'revoked_at', 'revocation_reason', 'revocation_request_idempotency_key', 'updated_at']) THEN
    RAISE EXCEPTION 'Milestone provenance is immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Revoked milestone is immutable' USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'REVOKED' THEN
    IF NEW.granted_reward_credit IS DISTINCT FROM OLD.granted_reward_credit
       OR NEW.reward_transaction_id IS DISTINCT FROM OLD.reward_transaction_id THEN
      RAISE EXCEPTION 'Revocation must retain reward provenance' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.status = 'ACTIVE' AND NOT OLD.granted_reward_credit
        AND NEW.granted_reward_credit AND NEW.reward_transaction_id IS NOT NULL THEN
    SELECT * INTO v_reward FROM public.reward_transactions WHERE id = NEW.reward_transaction_id;
    SELECT user_id INTO v_account_owner FROM public.reward_accounts WHERE id = v_reward.account_id;
    IF NEW.recognition_class <> 'CORE_VERIFIED' OR v_reward.id IS NULL
       OR v_reward.user_id IS DISTINCT FROM NEW.user_id
       OR v_account_owner IS DISTINCT FROM NEW.user_id
       OR v_reward.event_kind IS DISTINCT FROM 'EARN'
       OR v_reward.canonical_source_type IS DISTINCT FROM NEW.source_type
       OR v_reward.canonical_source_id IS DISTINCT FROM NEW.source_id
       OR v_reward.policy_version IS DISTINCT FROM 'reward-v1' THEN
      RAISE EXCEPTION 'Milestone reward provenance mismatch' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Milestone transition prohibited' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_milestone_authority
  BEFORE INSERT OR UPDATE OR DELETE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_milestone_authority();
REVOKE ALL ON FUNCTION public.trg_enforce_milestone_authority()
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestones_owner_select ON public.milestones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.milestones FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.milestones TO authenticated;
