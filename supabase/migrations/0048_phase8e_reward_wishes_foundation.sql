-- 0048_phase8e_reward_wishes_foundation.sql
-- Phase 8E Round 1: isolated reward ledger, Wish storage, and DB authority boundaries.

-- =============================================================================
-- 1. REWARD ACCOUNTS (RPC-MAINTAINED LEDGER CACHE)
-- =============================================================================

CREATE TABLE public.reward_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  lifetime_earned integer NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  net_earned integer NOT NULL DEFAULT 0,
  lifetime_redeemed integer NOT NULL DEFAULT 0 CHECK (lifetime_redeemed >= 0),
  current_reserved integer NOT NULL DEFAULT 0 CHECK (current_reserved >= 0),
  current_available integer NOT NULL DEFAULT 0 CHECK (current_available >= 0),
  correction_deficit integer NOT NULL DEFAULT 0 CHECK (correction_deficit >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_reward_accounts_user
  ON public.reward_accounts (user_id);

-- =============================================================================
-- 2. APPEND-ONLY REWARD TRANSACTIONS
-- =============================================================================

CREATE TABLE public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.reward_accounts(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_kind text NOT NULL
    CHECK (event_kind IN ('EARN', 'CORRECTION', 'RESERVE', 'UNRESERVE', 'REDEEM', 'REFUND')),
  amount integer NOT NULL,
  canonical_source_type text NOT NULL CHECK (btrim(canonical_source_type) <> ''),
  canonical_source_id text NOT NULL CHECK (btrim(canonical_source_id) <> ''),
  policy_version text NULL CHECK (policy_version IS NULL OR btrim(policy_version) <> ''),
  request_idempotency_key text NOT NULL CHECK (btrim(request_idempotency_key) <> ''),
  correction_for_id uuid NULL REFERENCES public.reward_transactions(id) ON DELETE RESTRICT,
  refund_for_redemption_id uuid NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT reward_transactions_user_request_key_unique
    UNIQUE (user_id, request_idempotency_key),
  CONSTRAINT reward_transactions_event_shape_check CHECK (
    (
      event_kind = 'EARN'
      AND amount > 0
      AND policy_version IS NOT NULL
      AND correction_for_id IS NULL
      AND refund_for_redemption_id IS NULL
    ) OR (
      event_kind = 'CORRECTION'
      AND amount <> 0
      AND policy_version IS NOT NULL
      AND correction_for_id IS NOT NULL
      AND refund_for_redemption_id IS NULL
    ) OR (
      event_kind IN ('RESERVE', 'UNRESERVE', 'REDEEM')
      AND amount > 0
      AND canonical_source_type = 'WISH'
      AND correction_for_id IS NULL
      AND refund_for_redemption_id IS NULL
    ) OR (
      event_kind = 'REFUND'
      AND amount > 0
      AND canonical_source_type = 'WISH'
      AND correction_for_id IS NULL
      AND refund_for_redemption_id IS NOT NULL
    )
  )
);

CREATE INDEX idx_reward_tx_user_created
  ON public.reward_transactions (user_id, created_at DESC);

CREATE UNIQUE INDEX uq_reward_tx_canonical_source
  ON public.reward_transactions (
    user_id,
    canonical_source_type,
    canonical_source_id,
    policy_version,
    event_kind
  )
  WHERE event_kind = 'EARN';

CREATE UNIQUE INDEX uq_reward_tx_correction_for
  ON public.reward_transactions (correction_for_id)
  WHERE event_kind = 'CORRECTION';

-- =============================================================================
-- 3. WISHES
-- =============================================================================

CREATE TABLE public.wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  credit_cost integer NULL CHECK (credit_cost IS NULL OR credit_cost > 0),
  status text NOT NULL DEFAULT 'IDEA'
    CHECK (status IN ('IDEA', 'ACTIVE', 'PRIMARY', 'RESERVED', 'REDEEMED', 'ARCHIVED', 'CANCELLED')),
  cooldown_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_wishes_user_status
  ON public.wishes (user_id, status);

CREATE UNIQUE INDEX uq_wishes_single_selected
  ON public.wishes (user_id)
  WHERE status IN ('PRIMARY', 'RESERVED');

-- =============================================================================
-- 4. IMMUTABLE REDEMPTION RECEIPTS + CIRCULAR REFUND FK
-- =============================================================================

CREATE TABLE public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wish_id uuid NOT NULL REFERENCES public.wishes(id) ON DELETE RESTRICT,
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.reward_transactions(id) ON DELETE RESTRICT,
  credits_spent integer NOT NULL CHECK (credits_spent > 0),
  celebration_note text NULL,
  redeemed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_reward_redemptions_user
  ON public.reward_redemptions (user_id, redeemed_at DESC);

ALTER TABLE public.reward_transactions
  ADD CONSTRAINT reward_transactions_refund_redemption_fk
  FOREIGN KEY (refund_for_redemption_id)
  REFERENCES public.reward_redemptions(id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_reward_tx_refund_for_redemption
  ON public.reward_transactions (refund_for_redemption_id)
  WHERE event_kind = 'REFUND';

-- =============================================================================
-- 5. TENANT/REFERENCE GUARDS + IMMUTABILITY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_enforce_reward_transaction_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_user_id uuid;
  v_original_user_id uuid;
  v_original_account_id uuid;
  v_original_kind text;
  v_original_amount integer;
  v_original_source_type text;
  v_original_source_id text;
  v_original_policy_version text;
  v_wish_user_id uuid;
  v_redemption_user_id uuid;
  v_redemption_wish_id uuid;
  v_redemption_credits_spent integer;
  v_redemption_account_id uuid;
BEGIN
  SELECT a.user_id
  INTO v_account_user_id
  FROM public.reward_accounts a
  WHERE a.id = NEW.account_id;

  IF v_account_user_id IS NULL OR NEW.user_id IS DISTINCT FROM v_account_user_id THEN
    RAISE EXCEPTION 'Reward transaction/account tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.event_kind = 'CORRECTION' THEN
    SELECT t.user_id, t.account_id, t.event_kind, t.amount,
           t.canonical_source_type, t.canonical_source_id, t.policy_version
    INTO v_original_user_id, v_original_account_id, v_original_kind, v_original_amount,
         v_original_source_type, v_original_source_id, v_original_policy_version
    FROM public.reward_transactions t
    WHERE t.id = NEW.correction_for_id;

    IF v_original_user_id IS NULL
       OR NEW.user_id IS DISTINCT FROM v_original_user_id
       OR NEW.account_id IS DISTINCT FROM v_original_account_id
       OR v_original_kind IS DISTINCT FROM 'EARN'
       OR NEW.amount IS DISTINCT FROM -v_original_amount
       OR NEW.canonical_source_type IS DISTINCT FROM v_original_source_type
       OR NEW.canonical_source_id IS DISTINCT FROM v_original_source_id
       OR NEW.policy_version IS DISTINCT FROM v_original_policy_version THEN
      RAISE EXCEPTION 'Reward correction source mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.event_kind IN ('RESERVE', 'UNRESERVE', 'REDEEM', 'REFUND') THEN
    SELECT w.user_id
    INTO v_wish_user_id
    FROM public.wishes w
    WHERE w.id::text = NEW.canonical_source_id;

    IF v_wish_user_id IS NULL OR NEW.user_id IS DISTINCT FROM v_wish_user_id THEN
      RAISE EXCEPTION 'Reward transaction/Wish tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.event_kind = 'REFUND' THEN
    SELECT r.user_id, r.wish_id, r.credits_spent, t.account_id
    INTO v_redemption_user_id, v_redemption_wish_id, v_redemption_credits_spent,
         v_redemption_account_id
    FROM public.reward_redemptions r
    JOIN public.reward_transactions t ON t.id = r.transaction_id
    WHERE r.id = NEW.refund_for_redemption_id;

    IF v_redemption_user_id IS NULL
       OR NEW.user_id IS DISTINCT FROM v_redemption_user_id
       OR NEW.account_id IS DISTINCT FROM v_redemption_account_id
       OR NEW.canonical_source_id IS DISTINCT FROM v_redemption_wish_id::text
       OR NEW.amount IS DISTINCT FROM v_redemption_credits_spent THEN
      RAISE EXCEPTION 'Reward refund receipt mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_reward_transaction_integrity
BEFORE INSERT ON public.reward_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_reward_transaction_integrity();

CREATE OR REPLACE FUNCTION public.trg_prevent_reward_transaction_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Reward transaction is immutable'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_prevent_reward_transaction_mutation
BEFORE UPDATE OR DELETE ON public.reward_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_reward_transaction_mutation();

CREATE OR REPLACE FUNCTION public.trg_enforce_wish_field_authority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'IDEA' OR NEW.cooldown_until IS NOT NULL THEN
      RAISE EXCEPTION 'Wish creation must start in IDEA without cooldown'
        USING ERRCODE = '42501';
    END IF;

    IF current_user = 'authenticated'
       AND (auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'Wish owner must match authenticated caller'
        USING ERRCODE = '42501';
    END IF;

    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Wish immutable field mutation prohibited'
      USING ERRCODE = '42501';
  END IF;

  IF current_user = 'authenticated' THEN
    IF OLD.status NOT IN ('IDEA', 'ACTIVE')
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.cooldown_until IS DISTINCT FROM OLD.cooldown_until
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
      RAISE EXCEPTION 'Wish protected field mutation requires RPC authority'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_wish_field_authority
BEFORE INSERT OR UPDATE ON public.wishes
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_wish_field_authority();

CREATE OR REPLACE FUNCTION public.trg_enforce_reward_redemption_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wish_user_id uuid;
  v_wish_status text;
  v_transaction_user_id uuid;
  v_transaction_kind text;
  v_transaction_amount integer;
  v_transaction_source_type text;
  v_transaction_source_id text;
BEGIN
  SELECT w.user_id, w.status
  INTO v_wish_user_id, v_wish_status
  FROM public.wishes w
  WHERE w.id = NEW.wish_id;

  SELECT t.user_id, t.event_kind, t.amount, t.canonical_source_type, t.canonical_source_id
  INTO v_transaction_user_id, v_transaction_kind, v_transaction_amount,
       v_transaction_source_type, v_transaction_source_id
  FROM public.reward_transactions t
  WHERE t.id = NEW.transaction_id;

  IF v_wish_user_id IS NULL
     OR v_transaction_user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM v_wish_user_id
     OR NEW.user_id IS DISTINCT FROM v_transaction_user_id
     OR v_wish_status IS DISTINCT FROM 'REDEEMED'
     OR v_transaction_kind IS DISTINCT FROM 'REDEEM'
     OR v_transaction_source_type IS DISTINCT FROM 'WISH'
     OR v_transaction_source_id IS DISTINCT FROM NEW.wish_id::text
     OR v_transaction_amount IS DISTINCT FROM NEW.credits_spent THEN
    RAISE EXCEPTION 'Reward redemption tenant or settlement mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_reward_redemption_integrity
BEFORE INSERT ON public.reward_redemptions
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_reward_redemption_integrity();

CREATE OR REPLACE FUNCTION public.trg_prevent_reward_redemption_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Reward redemption is immutable'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_prevent_reward_redemption_mutation
BEFORE UPDATE OR DELETE ON public.reward_redemptions
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_reward_redemption_mutation();

REVOKE ALL ON FUNCTION public.trg_enforce_reward_transaction_integrity() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_prevent_reward_transaction_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_enforce_wish_field_authority() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_enforce_reward_redemption_integrity() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_prevent_reward_redemption_mutation() FROM PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY reward_accounts_owner_select ON public.reward_accounts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY reward_transactions_owner_select ON public.reward_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY wishes_owner_select ON public.wishes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY wishes_owner_insert ON public.wishes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'IDEA' AND cooldown_until IS NULL);

CREATE POLICY wishes_owner_update ON public.wishes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('IDEA', 'ACTIVE'))
  WITH CHECK (auth.uid() = user_id AND status IN ('IDEA', 'ACTIVE'));

CREATE POLICY reward_redemptions_owner_select ON public.reward_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- 7. LEAST-PRIVILEGE ROLE GRANTS
-- =============================================================================

REVOKE ALL ON public.reward_accounts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.reward_transactions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.wishes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.reward_redemptions FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.reward_accounts TO authenticated;
GRANT SELECT ON public.reward_transactions TO authenticated;
GRANT SELECT ON public.wishes TO authenticated;
GRANT INSERT (user_id, title, description, credit_cost) ON public.wishes TO authenticated;
GRANT UPDATE (title, description, credit_cost) ON public.wishes TO authenticated;
GRANT SELECT ON public.reward_redemptions TO authenticated;
