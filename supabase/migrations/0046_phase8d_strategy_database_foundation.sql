-- 0046_phase8d_strategy_database_foundation.sql
-- Phase 8D Round 1: Strategy/Playbook storage foundation and DB authority boundaries.

-- =============================================================================
-- 1. STRATEGIES
-- =============================================================================

CREATE TABLE public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  context_trigger text NOT NULL CHECK (btrim(context_trigger) <> ''),
  action_protocol text NOT NULL CHECK (btrim(action_protocol) <> ''),
  expected_outcome text NOT NULL CHECK (btrim(expected_outcome) <> ''),
  lifecycle_status text NOT NULL DEFAULT 'HYPOTHESIS'
    CHECK (lifecycle_status IN (
      'HYPOTHESIS',
      'TESTING',
      'SUPPORTED',
      'CONTEXTUAL',
      'WEAKENED',
      'RETIRED'
    )),
  confidence_level text NOT NULL DEFAULT 'LOW'
    CHECK (confidence_level IN ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_strategies_user_status
  ON public.strategies (user_id, lifecycle_status);

-- =============================================================================
-- 2. IMMUTABLE STRATEGY VERSIONS
-- =============================================================================

CREATE TABLE public.strategy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number >= 1),
  action_protocol text NOT NULL CHECK (btrim(action_protocol) <> ''),
  context_trigger text NOT NULL CHECK (btrim(context_trigger) <> ''),
  expected_outcome text NOT NULL CHECK (btrim(expected_outcome) <> ''),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT strategy_versions_unique_number UNIQUE (strategy_id, version_number)
);

CREATE INDEX idx_strategy_versions_strat
  ON public.strategy_versions (strategy_id);

-- =============================================================================
-- 3. IMMUTABLE STRATEGY SUPPORT / COUNTER-EVIDENCE LOG
-- =============================================================================

CREATE TABLE public.strategy_supports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE RESTRICT,
  strategy_version_id uuid NOT NULL REFERENCES public.strategy_versions(id) ON DELETE RESTRICT,
  observation_type text NOT NULL
    CHECK (observation_type IN ('SUPPORT', 'COUNTER_EVIDENCE')),
  source_class text NOT NULL
    CHECK (source_class IN (
      'SEASON_REVIEW',
      'ACTIVITY',
      'QUEST_OUTCOME',
      'ARTIFACT',
      'CORE_EVIDENCE_REFERENCE',
      'JOURNAL_CONTEXT',
      'MANUAL_OBSERVATION'
    )),
  source_id uuid NOT NULL,
  evaluator_version text NOT NULL CHECK (btrim(evaluator_version) <> ''),
  note text NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT strategy_supports_source_identity_unique UNIQUE (
    strategy_id,
    source_class,
    source_id,
    observation_type,
    evaluator_version
  )
);

CREATE INDEX idx_strat_supp_strategy
  ON public.strategy_supports (strategy_id, observation_type);

CREATE INDEX idx_strategy_supports_version
  ON public.strategy_supports (strategy_version_id);

-- =============================================================================
-- 4. STRATEGY FIELD AUTHORITY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_enforce_strategy_field_authority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_status IS DISTINCT FROM 'HYPOTHESIS'
       OR NEW.confidence_level IS DISTINCT FROM 'LOW'
       OR NEW.version IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'Strategy initial authority fields must be HYPOTHESIS / LOW / version 1'
        USING ERRCODE = '42501';
    END IF;

    IF current_user = 'authenticated'
       AND (auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'Strategy owner must match authenticated caller'
        USING ERRCODE = '42501';
    END IF;

    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Strategy immutable field mutation prohibited'
      USING ERRCODE = '42501';
  END IF;

  IF current_user = 'authenticated' THEN
    IF NEW.context_trigger IS DISTINCT FROM OLD.context_trigger
       OR NEW.action_protocol IS DISTINCT FROM OLD.action_protocol
       OR NEW.expected_outcome IS DISTINCT FROM OLD.expected_outcome
       OR NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
       OR NEW.confidence_level IS DISTINCT FROM OLD.confidence_level
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
      RAISE EXCEPTION 'Strategy protected field mutation requires RPC authority'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_strategy_field_authority
BEFORE INSERT OR UPDATE ON public.strategies
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_strategy_field_authority();

-- =============================================================================
-- 5. VERSION TENANT ISOLATION + IMMUTABILITY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_enforce_strategy_version_tenant_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_strategy_user_id uuid;
BEGIN
  SELECT s.user_id
  INTO v_strategy_user_id
  FROM public.strategies s
  WHERE s.id = NEW.strategy_id;

  IF v_strategy_user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM v_strategy_user_id THEN
    RAISE EXCEPTION 'Strategy version tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_strategy_version_tenant_isolation
BEFORE INSERT ON public.strategy_versions
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_strategy_version_tenant_isolation();

CREATE OR REPLACE FUNCTION public.trg_prevent_strategy_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Strategy version is immutable'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_prevent_strategy_version_mutation
BEFORE UPDATE OR DELETE ON public.strategy_versions
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_strategy_version_mutation();

-- =============================================================================
-- 6. SUPPORT TENANT/SOURCE ISOLATION + IMMUTABILITY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_enforce_strategy_support_tenant_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_strategy_user_id uuid;
  v_version_user_id uuid;
  v_version_strategy_id uuid;
  v_source_user_id uuid;
BEGIN
  SELECT s.user_id
  INTO v_strategy_user_id
  FROM public.strategies s
  WHERE s.id = NEW.strategy_id;

  IF v_strategy_user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM v_strategy_user_id THEN
    RAISE EXCEPTION 'Strategy support tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT v.user_id, v.strategy_id
  INTO v_version_user_id, v_version_strategy_id
  FROM public.strategy_versions v
  WHERE v.id = NEW.strategy_version_id;

  IF v_version_user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM v_version_user_id
     OR NEW.strategy_id IS DISTINCT FROM v_version_strategy_id THEN
    RAISE EXCEPTION 'Strategy support/version mismatch'
      USING ERRCODE = '23514';
  END IF;

  v_source_user_id := NULL;
  CASE NEW.source_class
    WHEN 'SEASON_REVIEW' THEN
      SELECT sr.user_id INTO v_source_user_id
      FROM public.season_reviews sr
      WHERE sr.id = NEW.source_id;
    WHEN 'ACTIVITY' THEN
      SELECT a.user_id INTO v_source_user_id
      FROM public.activities a
      WHERE a.id = NEW.source_id;
    WHEN 'QUEST_OUTCOME' THEN
      SELECT q.user_id INTO v_source_user_id
      FROM public.quests q
      WHERE q.id = NEW.source_id;
    WHEN 'ARTIFACT' THEN
      SELECT a.user_id INTO v_source_user_id
      FROM public.artifacts a
      WHERE a.id = NEW.source_id;
    WHEN 'CORE_EVIDENCE_REFERENCE' THEN
      SELECT e.user_id INTO v_source_user_id
      FROM public.evidence_records e
      WHERE e.id = NEW.source_id;
    WHEN 'JOURNAL_CONTEXT', 'MANUAL_OBSERVATION' THEN
      SELECT j.user_id INTO v_source_user_id
      FROM public.journal_entries j
      WHERE j.id = NEW.source_id;
    ELSE
      RAISE EXCEPTION 'Unsupported strategy support source class'
        USING ERRCODE = '23514';
  END CASE;

  IF v_source_user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM v_source_user_id THEN
    RAISE EXCEPTION 'Strategy support source tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_strategy_support_tenant_isolation
BEFORE INSERT ON public.strategy_supports
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_strategy_support_tenant_isolation();

CREATE OR REPLACE FUNCTION public.trg_prevent_strategy_support_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Strategy support is immutable'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_prevent_strategy_support_mutation
BEFORE UPDATE OR DELETE ON public.strategy_supports
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_strategy_support_mutation();

-- =============================================================================
-- 7. ATOMIC VERSION-1 BOOTSTRAP
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_bootstrap_strategy_version_one()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.strategy_versions (
    user_id,
    strategy_id,
    version_number,
    action_protocol,
    context_trigger,
    expected_outcome
  ) VALUES (
    NEW.user_id,
    NEW.id,
    1,
    NEW.action_protocol,
    NEW.context_trigger,
    NEW.expected_outcome
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bootstrap_strategy_version_one
AFTER INSERT ON public.strategies
FOR EACH ROW EXECUTE FUNCTION public.trg_bootstrap_strategy_version_one();

REVOKE ALL ON FUNCTION public.trg_enforce_strategy_field_authority() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_enforce_strategy_version_tenant_isolation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_prevent_strategy_version_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_enforce_strategy_support_tenant_isolation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_prevent_strategy_support_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_bootstrap_strategy_version_one() FROM PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_supports ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategies_owner_select ON public.strategies
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY strategies_owner_insert ON public.strategies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND lifecycle_status = 'HYPOTHESIS'
    AND confidence_level = 'LOW'
    AND version = 1
  );

CREATE POLICY strategies_owner_update ON public.strategies
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY strategy_versions_owner_select ON public.strategy_versions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY strategy_supports_owner_select ON public.strategy_supports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- 9. LEAST-PRIVILEGE ROLE GRANTS
-- =============================================================================

REVOKE ALL ON public.strategies FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.strategy_versions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.strategy_supports FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.strategies TO authenticated;
GRANT INSERT (
  user_id,
  title,
  description,
  context_trigger,
  action_protocol,
  expected_outcome
) ON public.strategies TO authenticated;
GRANT UPDATE (title, description) ON public.strategies TO authenticated;

GRANT SELECT ON public.strategy_versions TO authenticated;
GRANT SELECT ON public.strategy_supports TO authenticated;
