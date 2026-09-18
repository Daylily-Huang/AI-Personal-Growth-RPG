-- 0043_phase8b_outer_loop_foundation.sql
-- Phase 8B Round 1: Outer Loop governance + Season/Review schema foundation.
-- Scope is intentionally limited to the five Phase 8B tables authorized by
-- docs/Phase8/13_PHASE8B_SEASON_REVIEW_IMPLEMENTATION_CONTROLLING.md.

-- =============================================================================
-- 1. OUTER LOOP PROPOSALS (non-authoritative AI proposal envelope)
-- =============================================================================

CREATE TABLE public.outer_loop_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_type text NOT NULL CHECK (length(btrim(proposal_type)) > 0),
  schema_version integer NOT NULL CHECK (schema_version >= 1),
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(source_refs) = 'array'),
  model_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(model_metadata) = 'object'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED', 'ACCEPTED', 'EDITED', 'REJECTED', 'EXPIRED')),
  decision text NULL
    CHECK (decision IS NULL OR decision IN ('ACCEPTED', 'EDITED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_at timestamptz NULL,
  reviewed_by_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  review_request_idempotency_key text NULL,
  rejection_reason text NULL,
  resulting_entity_type text NULL,
  resulting_entity_id uuid NULL,
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '14 days'),
  CONSTRAINT ck_outer_loop_proposals_decision_coherence CHECK (
    (status IN ('PROPOSED', 'EXPIRED') AND decision IS NULL)
    OR
    (status IN ('ACCEPTED', 'EDITED', 'REJECTED') AND decision = status)
  ),
  CONSTRAINT ck_outer_loop_proposals_review_metadata CHECK (
    (status IN ('PROPOSED', 'EXPIRED'))
    OR
    (reviewed_at IS NOT NULL AND reviewed_by_id IS NOT NULL AND review_request_idempotency_key IS NOT NULL)
  ),
  CONSTRAINT ck_outer_loop_proposals_expiry CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX uq_proposals_review_idempotency
  ON public.outer_loop_proposals (user_id, review_request_idempotency_key)
  WHERE review_request_idempotency_key IS NOT NULL;

CREATE INDEX idx_outer_proposals_user_status
  ON public.outer_loop_proposals (user_id, status);

-- Proposal source/provenance fields remain immutable after creation. Review RPCs
-- may populate only the documented post-review fields.
CREATE OR REPLACE FUNCTION public.trg_guard_outer_loop_proposal_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.proposal_type IS DISTINCT FROM OLD.proposal_type
     OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
     OR NEW.source_refs IS DISTINCT FROM OLD.source_refs
     OR NEW.model_metadata IS DISTINCT FROM OLD.model_metadata
     OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'Outer Loop proposal provenance is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_outer_loop_proposal_update
BEFORE UPDATE ON public.outer_loop_proposals
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_outer_loop_proposal_update();

-- =============================================================================
-- 2. OUTER LOOP AUDIT EVENTS (append-only audit trail)
-- =============================================================================

CREATE TABLE public.outer_loop_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (length(btrim(event_type)) > 0),
  entity_type text NOT NULL CHECK (length(btrim(entity_type)) > 0),
  entity_id uuid NULL,
  request_idempotency_key text NOT NULL CHECK (length(btrim(request_idempotency_key)) > 0),
  policy_version text NOT NULL CHECK (length(btrim(policy_version)) > 0),
  schema_version text NOT NULL CHECK (length(btrim(schema_version)) > 0),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (user_id, request_idempotency_key)
);

CREATE INDEX idx_outer_audit_user_created
  ON public.outer_loop_audit_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_guard_outer_loop_audit_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Trusted administrative roles may delete rows only for account teardown /
  -- test cleanup. Product clients remain append-only.
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Outer Loop audit events are append-only'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER trg_guard_outer_loop_audit_update
BEFORE UPDATE ON public.outer_loop_audit_events
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_outer_loop_audit_immutability();

CREATE TRIGGER trg_guard_outer_loop_audit_delete
BEFORE DELETE ON public.outer_loop_audit_events
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_outer_loop_audit_immutability();

-- =============================================================================
-- 3. SEASONS (authoritative macro-cycle container)
-- =============================================================================

CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NULL,
  theme_color text NULL,
  icon_key text NULL,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED', 'ENDED_EARLY', 'ABANDONED', 'CANCELLED')),
  planned_start_date date NULL,
  target_duration_days integer NULL
    CHECK (target_duration_days IS NULL OR target_duration_days BETWEEN 14 AND 84),
  success_criteria jsonb NULL
    CHECK (success_criteria IS NULL OR jsonb_typeof(success_criteria) = 'array'),
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  abandonment_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_seasons_active_started CHECK (status <> 'ACTIVE' OR started_at IS NOT NULL),
  CONSTRAINT ck_seasons_terminal_timestamps CHECK (
    status NOT IN ('COMPLETED', 'ENDED_EARLY', 'ABANDONED')
    OR (started_at IS NOT NULL AND ended_at IS NOT NULL)
  ),
  CONSTRAINT ck_seasons_abandonment_reason CHECK (
    status <> 'ABANDONED' OR (abandonment_reason IS NOT NULL AND length(btrim(abandonment_reason)) > 0)
  )
);

CREATE UNIQUE INDEX uq_seasons_single_active
  ON public.seasons (user_id)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_seasons_user_status
  ON public.seasons (user_id, status);

CREATE OR REPLACE FUNCTION public.trg_enforce_season_field_authority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- SECURITY DEFINER lifecycle RPCs run as their trusted function owner and are
  -- permitted to change lifecycle fields. Direct authenticated writes are
  -- limited to DRAFT descriptive metadata.
  IF current_user = 'authenticated' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Direct season update is allowed only while DRAFT'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.planned_start_date IS DISTINCT FROM OLD.planned_start_date
       OR NEW.target_duration_days IS DISTINCT FROM OLD.target_duration_days
       OR NEW.success_criteria IS DISTINCT FROM OLD.success_criteria
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
       OR NEW.abandonment_reason IS DISTINCT FROM OLD.abandonment_reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Direct lifecycle field update prohibited; use Phase 8B lifecycle RPCs'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_season_field_authority
BEFORE UPDATE ON public.seasons
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_season_field_authority();

CREATE OR REPLACE FUNCTION public.trg_prevent_active_season_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user = 'authenticated'
     AND OLD.status NOT IN ('DRAFT', 'PLANNED') THEN
    RAISE EXCEPTION 'Only DRAFT or PLANNED Seasons can be hard-deleted'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_active_season_delete
BEFORE DELETE ON public.seasons
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_active_season_delete();

-- =============================================================================
-- 4. SEASON QUESTS (N:N, RPC-only mutation)
-- =============================================================================

CREATE TABLE public.season_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  quest_id uuid NOT NULL REFERENCES public.quests(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('MAIN', 'FOCUS')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (season_id, quest_id)
);

CREATE UNIQUE INDEX uq_season_quests_single_main
  ON public.season_quests (season_id)
  WHERE role = 'MAIN';

CREATE INDEX idx_season_quests_season ON public.season_quests (season_id);
CREATE INDEX idx_season_quests_quest ON public.season_quests (quest_id);

CREATE OR REPLACE FUNCTION public.trg_enforce_season_quest_tenant_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_season_user_id uuid;
  v_quest_user_id uuid;
BEGIN
  SELECT s.user_id INTO v_season_user_id
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  SELECT q.user_id INTO v_quest_user_id
  FROM public.quests q
  WHERE q.id = NEW.quest_id;

  IF v_season_user_id IS NULL OR v_quest_user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM v_season_user_id
     OR NEW.user_id IS DISTINCT FROM v_quest_user_id THEN
    RAISE EXCEPTION 'Season/Quest tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_season_quest_tenant_isolation
BEFORE INSERT OR UPDATE ON public.season_quests
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_season_quest_tenant_isolation();

-- =============================================================================
-- 5. SEASON REVIEWS (immutable versioned review records)
-- =============================================================================

CREATE TABLE public.season_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  review_type text NOT NULL CHECK (review_type IN ('WEEKLY', 'FINAL', 'AD_HOC')),
  version integer NOT NULL CHECK (version >= 1),
  commit_key uuid NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  objective_summary jsonb NOT NULL,
  qualitative_reflection text NOT NULL,
  criteria_evaluation jsonb NOT NULL,
  tactical_adjustments text NULL,
  amendment_reason text NULL,
  superseded_by_id uuid NULL REFERENCES public.season_reviews(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (user_id, commit_key),
  UNIQUE (season_id, review_type, version),
  CONSTRAINT ck_season_reviews_period CHECK (period_end >= period_start),
  CONSTRAINT ck_season_reviews_reflection_nonblank CHECK (length(btrim(qualitative_reflection)) > 0),
  CONSTRAINT ck_season_reviews_not_self_superseded CHECK (superseded_by_id IS NULL OR superseded_by_id <> id)
);

CREATE INDEX idx_season_reviews_season
  ON public.season_reviews (season_id, review_type);

CREATE OR REPLACE FUNCTION public.trg_enforce_season_review_tenant_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_season_user_id uuid;
  v_next public.season_reviews%ROWTYPE;
BEGIN
  SELECT s.user_id INTO v_season_user_id
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  IF v_season_user_id IS NULL OR NEW.user_id IS DISTINCT FROM v_season_user_id THEN
    RAISE EXCEPTION 'Season Review tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.superseded_by_id IS NOT NULL THEN
    SELECT * INTO v_next
    FROM public.season_reviews sr
    WHERE sr.id = NEW.superseded_by_id;

    IF v_next.id IS NULL
       OR v_next.user_id IS DISTINCT FROM NEW.user_id
       OR v_next.season_id IS DISTINCT FROM NEW.season_id
       OR v_next.review_type IS DISTINCT FROM NEW.review_type
       OR v_next.version <> NEW.version + 1 THEN
      RAISE EXCEPTION 'Invalid Season Review supersession link'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_season_review_tenant_isolation
BEFORE INSERT OR UPDATE ON public.season_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_season_review_tenant_isolation();

CREATE OR REPLACE FUNCTION public.trg_guard_season_review_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.season_id IS DISTINCT FROM OLD.season_id
     OR NEW.review_type IS DISTINCT FROM OLD.review_type
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.commit_key IS DISTINCT FROM OLD.commit_key
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.objective_summary IS DISTINCT FROM OLD.objective_summary
     OR NEW.qualitative_reflection IS DISTINCT FROM OLD.qualitative_reflection
     OR NEW.criteria_evaluation IS DISTINCT FROM OLD.criteria_evaluation
     OR NEW.tactical_adjustments IS DISTINCT FROM OLD.tactical_adjustments
     OR NEW.amendment_reason IS DISTINCT FROM OLD.amendment_reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Season Review content is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.superseded_by_id IS NOT NULL
     AND NEW.superseded_by_id IS DISTINCT FROM OLD.superseded_by_id THEN
    RAISE EXCEPTION 'Season Review superseded_by_id is one-time immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_season_review_immutability
BEFORE UPDATE ON public.season_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_season_review_immutability();

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.outer_loop_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outer_loop_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY outer_loop_proposals_select ON public.outer_loop_proposals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY outer_loop_proposals_insert_denied ON public.outer_loop_proposals
  FOR INSERT WITH CHECK (false);
CREATE POLICY outer_loop_proposals_update_denied ON public.outer_loop_proposals
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY outer_loop_proposals_delete_denied ON public.outer_loop_proposals
  FOR DELETE USING (false);

CREATE POLICY outer_loop_audit_events_select ON public.outer_loop_audit_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY outer_loop_audit_events_insert_denied ON public.outer_loop_audit_events
  FOR INSERT WITH CHECK (false);
CREATE POLICY outer_loop_audit_events_update_denied ON public.outer_loop_audit_events
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY outer_loop_audit_events_delete_denied ON public.outer_loop_audit_events
  FOR DELETE USING (false);

CREATE POLICY seasons_select ON public.seasons
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY seasons_insert_draft ON public.seasons
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status = 'DRAFT'
    AND planned_start_date IS NULL
    AND target_duration_days IS NULL
    AND success_criteria IS NULL
    AND started_at IS NULL
    AND ended_at IS NULL
    AND abandonment_reason IS NULL
  );
CREATE POLICY seasons_update_own ON public.seasons
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY seasons_delete_own ON public.seasons
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY season_quests_select ON public.season_quests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY season_quests_insert_denied ON public.season_quests
  FOR INSERT WITH CHECK (false);
CREATE POLICY season_quests_update_denied ON public.season_quests
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY season_quests_delete_denied ON public.season_quests
  FOR DELETE USING (false);

CREATE POLICY season_reviews_select ON public.season_reviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY season_reviews_insert_denied ON public.season_reviews
  FOR INSERT WITH CHECK (false);
CREATE POLICY season_reviews_update_denied ON public.season_reviews
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY season_reviews_delete_denied ON public.season_reviews
  FOR DELETE USING (false);

-- =============================================================================
-- 7. ROLE PRIVILEGES (least privilege, RPC-only mutation boundaries)
-- =============================================================================

REVOKE ALL ON public.outer_loop_proposals FROM anon, authenticated;
REVOKE ALL ON public.outer_loop_audit_events FROM anon, authenticated;
REVOKE ALL ON public.seasons FROM anon, authenticated;
REVOKE ALL ON public.season_quests FROM anon, authenticated;
REVOKE ALL ON public.season_reviews FROM anon, authenticated;

GRANT SELECT ON public.outer_loop_proposals TO authenticated;
GRANT SELECT ON public.outer_loop_audit_events TO authenticated;
GRANT SELECT ON public.season_quests TO authenticated;
GRANT SELECT ON public.season_reviews TO authenticated;

GRANT SELECT, DELETE ON public.seasons TO authenticated;
GRANT INSERT (user_id, name, description, theme_color, icon_key)
  ON public.seasons TO authenticated;
GRANT UPDATE (name, description, theme_color, icon_key)
  ON public.seasons TO authenticated;

-- The trusted server gateway may create AI proposals. Authoritative lifecycle
-- settlement remains RPC-owned and is implemented in Phase 8B Round 2.
GRANT SELECT, INSERT ON public.outer_loop_proposals TO service_role;
GRANT SELECT ON public.outer_loop_audit_events TO service_role;
