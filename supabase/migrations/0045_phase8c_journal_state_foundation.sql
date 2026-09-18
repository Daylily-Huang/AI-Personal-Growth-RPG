-- 0045_phase8c_journal_state_foundation.sql
-- Phase 8C Round 1: Journal/State storage, constraints, tenant isolation, and RLS.

-- =============================================================================
-- 1. JOURNAL ENTRIES
-- =============================================================================

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL
    CHECK (entry_type IN (
      'FREE_REFLECTION',
      'QUEST_REFLECTION',
      'DAILY_SUMMARY',
      'WEEKLY_REFLECTION',
      'SEASON_REFLECTION',
      'STATE_LOG',
      'DECISION_NOTE',
      'FAILURE_POSTMORTEM',
      'INSIGHT'
    )),
  title text NOT NULL,
  content_markdown text NOT NULL,
  energy integer NULL CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
  focus integer NULL CHECK (focus IS NULL OR focus BETWEEN 1 AND 5),
  stress integer NULL CHECK (stress IS NULL OR stress BETWEEN 1 AND 5),
  resistance integer NULL CHECK (resistance IS NULL OR resistance BETWEEN 1 AND 5),
  recovery integer NULL CHECK (recovery IS NULL OR recovery BETWEEN 1 AND 5),
  mood_valence integer NULL CHECK (mood_valence IS NULL OR mood_valence BETWEEN -2 AND 2),
  self_confidence integer NULL CHECK (self_confidence IS NULL OR self_confidence BETWEEN 1 AND 5),
  season_id uuid NULL REFERENCES public.seasons(id) ON DELETE SET NULL,
  quest_id uuid NULL REFERENCES public.quests(id) ON DELETE SET NULL,
  activity_id uuid NULL REFERENCES public.activities(id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  logged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_journal_user_logged
  ON public.journal_entries (user_id, logged_at DESC);

CREATE INDEX idx_journal_season
  ON public.journal_entries (season_id);

-- =============================================================================
-- 2. TENANT ISOLATION FOR CONTEXTUAL LINKS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_enforce_journal_entry_tenant_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context_user_id uuid;
BEGIN
  IF NEW.season_id IS NOT NULL THEN
    v_context_user_id := NULL;
    SELECT s.user_id INTO v_context_user_id
    FROM public.seasons s
    WHERE s.id = NEW.season_id;

    IF v_context_user_id IS NULL OR NEW.user_id IS DISTINCT FROM v_context_user_id THEN
      RAISE EXCEPTION 'Journal/Season tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.quest_id IS NOT NULL THEN
    v_context_user_id := NULL;
    SELECT q.user_id INTO v_context_user_id
    FROM public.quests q
    WHERE q.id = NEW.quest_id;

    IF v_context_user_id IS NULL OR NEW.user_id IS DISTINCT FROM v_context_user_id THEN
      RAISE EXCEPTION 'Journal/Quest tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.activity_id IS NOT NULL THEN
    v_context_user_id := NULL;
    SELECT a.user_id INTO v_context_user_id
    FROM public.activities a
    WHERE a.id = NEW.activity_id;

    IF v_context_user_id IS NULL OR NEW.user_id IS DISTINCT FROM v_context_user_id THEN
      RAISE EXCEPTION 'Journal/Activity tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_journal_entry_tenant_isolation
BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_journal_entry_tenant_isolation();

-- =============================================================================
-- 3. FIELD AUTHORITY AND SYSTEM-MANAGED TIMESTAMPS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_enforce_journal_entry_field_authority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;

  IF current_user = 'authenticated' AND (
       NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
     ) THEN
    RAISE EXCEPTION 'Journal immutable field mutation prohibited'
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_journal_entry_field_authority
BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_journal_entry_field_authority();

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY journal_entries_select ON public.journal_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY journal_entries_insert ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      season_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.seasons s
        WHERE s.id = season_id AND s.user_id = auth.uid()
      )
    )
    AND (
      quest_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.quests q
        WHERE q.id = quest_id AND q.user_id = auth.uid()
      )
    )
    AND (
      activity_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.id = activity_id AND a.user_id = auth.uid()
      )
    )
  );

CREATE POLICY journal_entries_update ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      season_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.seasons s
        WHERE s.id = season_id AND s.user_id = auth.uid()
      )
    )
    AND (
      quest_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.quests q
        WHERE q.id = quest_id AND q.user_id = auth.uid()
      )
    )
    AND (
      activity_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.id = activity_id AND a.user_id = auth.uid()
      )
    )
  );

CREATE POLICY journal_entries_delete ON public.journal_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- 5. ROLE PRIVILEGES
-- =============================================================================

REVOKE ALL ON public.journal_entries FROM anon, authenticated;

GRANT SELECT, DELETE ON public.journal_entries TO authenticated;

GRANT INSERT (
  id,
  user_id,
  entry_type,
  title,
  content_markdown,
  energy,
  focus,
  stress,
  resistance,
  recovery,
  mood_valence,
  self_confidence,
  season_id,
  quest_id,
  activity_id,
  is_archived,
  logged_at
) ON public.journal_entries TO authenticated;

GRANT UPDATE (
  entry_type,
  title,
  content_markdown,
  energy,
  focus,
  stress,
  resistance,
  recovery,
  mood_valence,
  self_confidence,
  season_id,
  quest_id,
  activity_id,
  is_archived,
  logged_at
) ON public.journal_entries TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO service_role;
