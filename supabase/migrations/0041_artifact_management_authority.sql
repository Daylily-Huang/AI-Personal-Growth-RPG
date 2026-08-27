-- 0041_artifact_management_authority.sql
-- Stage 7A: Artifact Domain Model, Normalized Relational Join Schema & Deletion Protection Authority

-- ==============================================================================
-- 1. LEGACY 0013 PROTOTYPE TABLE DATA-SAFETY CHECK & CLEAN REBUILD
-- ==============================================================================
DO $$
DECLARE
  v_artifacts_count integer := 0;
  v_links_count integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'artifacts') THEN
    EXECUTE 'SELECT count(*) FROM public.artifacts' INTO v_artifacts_count;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'artifact_links') THEN
    EXECUTE 'SELECT count(*) FROM public.artifact_links' INTO v_links_count;
  END IF;
  
  -- Fail-closed safety guard: if legacy prototype tables contain existing rows, abort drop
  IF v_artifacts_count > 0 OR v_links_count > 0 THEN
    RAISE EXCEPTION 'Safety abort: legacy artifact tables contain % artifacts and % links. Cannot perform destructive rebuild.',
      v_artifacts_count, v_links_count;
  END IF;
END $$;

DROP TABLE IF EXISTS public.artifact_links CASCADE;
DROP TABLE IF EXISTS public.artifacts CASCADE;

-- ==============================================================================
-- 2. COMPOSITE KEYS ON REFERENCED TABLES (IF NOT ALREADY PRESENT)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_user_id_composite_key'
  ) THEN
    ALTER TABLE public.activities ADD CONSTRAINT activities_user_id_composite_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quests_user_id_composite_key'
  ) THEN
    ALTER TABLE public.quests ADD CONSTRAINT quests_user_id_composite_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_records_user_id_composite_key'
  ) THEN
    ALTER TABLE public.evidence_records ADD CONSTRAINT evidence_records_user_id_composite_key UNIQUE (user_id, id);
  END IF;
END $$;

-- ==============================================================================
-- 3. PUBLIC.ARTIFACTS TABLE
-- ==============================================================================
CREATE TABLE public.artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL
        CHECK (length(trim(title)) > 0),
    normalized_title TEXT GENERATED ALWAYS AS (lower(regexp_replace(trim(title), '\s+', ' ', 'g'))) STORED,
    artifact_type TEXT NOT NULL
        CHECK (artifact_type IN ('document', 'code_repository', 'design_spec', 'data_analysis', 'presentation', 'synthesis_note', 'creative_work', 'other')),
    summary TEXT,
    description TEXT,
    lifecycle_status TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle_status IN ('draft', 'active', 'archived', 'superseded')),
    version TEXT DEFAULT '1.0',
    storage_path TEXT,
    external_url TEXT,
    reusability_score NUMERIC(3,2) NOT NULL DEFAULT 0.00
        CHECK (reusability_score >= 0.00 AND reusability_score <= 1.00),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite key for tenant-safe foreign key references
    CONSTRAINT artifacts_user_id_composite_key UNIQUE (user_id, id),
    
    -- Unique title per tenant
    CONSTRAINT artifacts_unique_user_normalized_title UNIQUE (user_id, normalized_title),

    -- Lifecycle coherence constraint
    CONSTRAINT check_artifact_lifecycle_coherence CHECK (
        (lifecycle_status = 'archived' AND is_archived = true AND archived_at IS NOT NULL) OR
        (lifecycle_status IN ('draft', 'active', 'superseded') AND is_archived = false AND archived_at IS NULL)
    )
);

-- ==============================================================================
-- 4. NORMALIZED RELATIONAL JOIN TABLES
-- ==============================================================================

-- 4.1 Artifact <-> Activity Join Table
CREATE TABLE public.artifact_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL,
    activity_id UUID NOT NULL,
    activity_role TEXT NOT NULL DEFAULT 'produced'
        CHECK (activity_role IN ('produced', 'referenced', 'modified')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT artifact_activities_user_id_composite_key UNIQUE (user_id, id),
    CONSTRAINT artifact_activities_unique_link UNIQUE (user_id, artifact_id, activity_id),
    CONSTRAINT fk_artifact_activities_artifact
        FOREIGN KEY (user_id, artifact_id)
        REFERENCES public.artifacts(user_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_artifact_activities_activity
        FOREIGN KEY (user_id, activity_id)
        REFERENCES public.activities(user_id, id)
        ON DELETE CASCADE
);

-- 4.2 Artifact <-> Skill Join Table
CREATE TABLE public.artifact_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL,
    skill_id UUID NOT NULL,
    demonstration_level INT NOT NULL DEFAULT 1
        CHECK (demonstration_level >= 1 AND demonstration_level <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT artifact_skills_user_id_composite_key UNIQUE (user_id, id),
    CONSTRAINT artifact_skills_unique_link UNIQUE (user_id, artifact_id, skill_id),
    CONSTRAINT fk_artifact_skills_artifact
        FOREIGN KEY (user_id, artifact_id)
        REFERENCES public.artifacts(user_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_artifact_skills_skill
        FOREIGN KEY (user_id, skill_id)
        REFERENCES public.skills(user_id, id)
        ON DELETE CASCADE
);

-- 4.3 Artifact <-> Knowledge Node Join Table
-- Cardinality: Exactly one semantic relation_type per (user_id, artifact_id, node_id) tuple.
CREATE TABLE public.artifact_knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL,
    node_id UUID NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'synthesizes'
        CHECK (relation_type IN ('cites', 'implements', 'synthesizes', 'evaluates')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT artifact_knowledge_nodes_user_id_composite_key UNIQUE (user_id, id),
    CONSTRAINT artifact_knowledge_nodes_unique_link UNIQUE (user_id, artifact_id, node_id),
    CONSTRAINT fk_artifact_knowledge_nodes_artifact
        FOREIGN KEY (user_id, artifact_id)
        REFERENCES public.artifacts(user_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_artifact_knowledge_nodes_node
        FOREIGN KEY (user_id, node_id)
        REFERENCES public.knowledge_nodes(user_id, id)
        ON DELETE CASCADE
);

-- 4.4 Artifact <-> Quest Join Table
CREATE TABLE public.artifact_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL,
    quest_id UUID NOT NULL,
    is_primary_deliverable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT artifact_quests_user_id_composite_key UNIQUE (user_id, id),
    CONSTRAINT artifact_quests_unique_link UNIQUE (user_id, artifact_id, quest_id),
    CONSTRAINT fk_artifact_quests_artifact
        FOREIGN KEY (user_id, artifact_id)
        REFERENCES public.artifacts(user_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_artifact_quests_quest
        FOREIGN KEY (user_id, quest_id)
        REFERENCES public.quests(user_id, id)
        ON DELETE CASCADE
);

-- 4.5 Artifact <-> Evidence Join Table
-- Referenced artifacts are protected from deletion via ON DELETE RESTRICT and trigger.
CREATE TABLE public.artifact_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL,
    evidence_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT artifact_evidence_user_id_composite_key UNIQUE (user_id, id),
    CONSTRAINT artifact_evidence_unique_link UNIQUE (user_id, artifact_id, evidence_id),
    CONSTRAINT fk_artifact_evidence_artifact
        FOREIGN KEY (user_id, artifact_id)
        REFERENCES public.artifacts(user_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_artifact_evidence_evidence
        FOREIGN KEY (user_id, evidence_id)
        REFERENCES public.evidence_records(user_id, id)
        ON DELETE CASCADE
);

-- ==============================================================================
-- 5. FAIL-CLOSED ARTIFACT DELETION GUARD TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_artifact_delete_if_referenced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Check knowledge_nodes provenance
  IF EXISTS (
    SELECT 1 FROM public.knowledge_nodes
    WHERE user_id = OLD.user_id AND source_type = 'artifact' AND source_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete artifact: referenced by knowledge node provenance records'
      USING ERRCODE = '23503';
  END IF;

  -- 2. Check knowledge_edges provenance
  IF EXISTS (
    SELECT 1 FROM public.knowledge_edges
    WHERE user_id = OLD.user_id AND source_type = 'artifact' AND source_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete artifact: referenced by knowledge edge provenance records'
      USING ERRCODE = '23503';
  END IF;

  -- 3. Check artifact_evidence relationship
  IF EXISTS (
    SELECT 1 FROM public.artifact_evidence
    WHERE user_id = OLD.user_id AND artifact_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete artifact: referenced by evidence records'
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_artifact_delete_if_referenced ON public.artifacts;
CREATE TRIGGER trigger_prevent_artifact_delete_if_referenced
  BEFORE DELETE ON public.artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_artifact_delete_if_referenced();

-- ==============================================================================
-- 6. AUTOMATIC LIFECYCLE COHERENCE & TIMESTAMPS TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_artifact_lifecycle_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();

  -- Fail-closed on explicit contradiction
  IF (NEW.lifecycle_status = 'archived' AND NEW.is_archived = false) THEN
    RAISE EXCEPTION 'Lifecycle status is archived but is_archived is false'
      USING ERRCODE = '23514';
  END IF;

  IF (NEW.lifecycle_status IN ('draft', 'active', 'superseded') AND NEW.is_archived = true) THEN
    RAISE EXCEPTION 'Lifecycle status is % but is_archived is true', NEW.lifecycle_status
      USING ERRCODE = '23514';
  END IF;

  -- Maintain timestamps and flag consistency
  IF NEW.lifecycle_status = 'archived' AND NEW.is_archived = true THEN
    IF NEW.archived_at IS NULL THEN
      NEW.archived_at := now();
    END IF;
  ELSE
    NEW.is_archived := false;
    NEW.archived_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handle_artifact_lifecycle_coherence ON public.artifacts;
CREATE TRIGGER trigger_handle_artifact_lifecycle_coherence
  BEFORE INSERT OR UPDATE ON public.artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_artifact_lifecycle_coherence();

-- ==============================================================================
-- 7. PERFORMANCE & QUERY INDEXES
-- ==============================================================================
CREATE INDEX idx_artifacts_user_type_status ON public.artifacts (user_id, artifact_type, is_archived);
CREATE INDEX idx_artifacts_user_created ON public.artifacts (user_id, created_at DESC);
CREATE INDEX idx_artifact_activities_lookup ON public.artifact_activities (user_id, artifact_id, activity_id);
CREATE INDEX idx_artifact_skills_lookup ON public.artifact_skills (user_id, artifact_id, skill_id);
CREATE INDEX idx_artifact_knowledge_lookup ON public.artifact_knowledge_nodes (user_id, artifact_id, node_id);
CREATE INDEX idx_artifact_quests_lookup ON public.artifact_quests (user_id, artifact_id, quest_id);
CREATE INDEX idx_artifact_evidence_lookup ON public.artifact_evidence (user_id, artifact_id, evidence_id);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_evidence ENABLE ROW LEVEL SECURITY;

-- 8.1 artifacts policies
CREATE POLICY artifacts_select_policy ON public.artifacts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY artifacts_insert_policy ON public.artifacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY artifacts_update_policy ON public.artifacts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY artifacts_delete_policy ON public.artifacts
    FOR DELETE USING (auth.uid() = user_id);

-- 8.2 artifact_activities policies
CREATE POLICY artifact_activities_select ON public.artifact_activities
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY artifact_activities_insert ON public.artifact_activities
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_activities_update ON public.artifact_activities
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_activities_delete ON public.artifact_activities
    FOR DELETE USING (auth.uid() = user_id);

-- 8.3 artifact_skills policies
CREATE POLICY artifact_skills_select ON public.artifact_skills
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY artifact_skills_insert ON public.artifact_skills
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_skills_update ON public.artifact_skills
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_skills_delete ON public.artifact_skills
    FOR DELETE USING (auth.uid() = user_id);

-- 8.4 artifact_knowledge_nodes policies
CREATE POLICY artifact_knowledge_nodes_select ON public.artifact_knowledge_nodes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY artifact_knowledge_nodes_insert ON public.artifact_knowledge_nodes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_knowledge_nodes_update ON public.artifact_knowledge_nodes
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_knowledge_nodes_delete ON public.artifact_knowledge_nodes
    FOR DELETE USING (auth.uid() = user_id);

-- 8.5 artifact_quests policies
CREATE POLICY artifact_quests_select ON public.artifact_quests
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY artifact_quests_insert ON public.artifact_quests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_quests_update ON public.artifact_quests
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_quests_delete ON public.artifact_quests
    FOR DELETE USING (auth.uid() = user_id);

-- 8.6 artifact_evidence policies
CREATE POLICY artifact_evidence_select ON public.artifact_evidence
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY artifact_evidence_insert ON public.artifact_evidence
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_evidence_update ON public.artifact_evidence
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY artifact_evidence_delete ON public.artifact_evidence
    FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- 9. ROLE PRIVILEGES & SECURITY GRANTS (COLUMN-LEVEL HARDENED)
-- ==============================================================================
-- 9.1 artifacts: Full SELECT, INSERT, DELETE; UPDATE restricted to user-authoritative columns
GRANT SELECT, INSERT, DELETE ON public.artifacts TO authenticated;
GRANT UPDATE (
    title,
    artifact_type,
    summary,
    description,
    lifecycle_status,
    version,
    storage_path,
    external_url,
    reusability_score,
    is_archived,
    metadata
) ON public.artifacts TO authenticated;

-- 9.2 artifact_activities: UPDATE restricted to activity_role
GRANT SELECT, INSERT, DELETE ON public.artifact_activities TO authenticated;
GRANT UPDATE (activity_role) ON public.artifact_activities TO authenticated;

-- 9.3 artifact_skills: UPDATE restricted to demonstration_level
GRANT SELECT, INSERT, DELETE ON public.artifact_skills TO authenticated;
GRANT UPDATE (demonstration_level) ON public.artifact_skills TO authenticated;

-- 9.4 artifact_knowledge_nodes: UPDATE restricted to relation_type
GRANT SELECT, INSERT, DELETE ON public.artifact_knowledge_nodes TO authenticated;
GRANT UPDATE (relation_type) ON public.artifact_knowledge_nodes TO authenticated;

-- 9.5 artifact_quests: UPDATE restricted to is_primary_deliverable
GRANT SELECT, INSERT, DELETE ON public.artifact_quests TO authenticated;
GRANT UPDATE (is_primary_deliverable) ON public.artifact_quests TO authenticated;

-- 9.6 artifact_evidence: SELECT, INSERT, DELETE only; NO raw UPDATE granted
GRANT SELECT, INSERT, DELETE ON public.artifact_evidence TO authenticated;

-- 9.7 Fail-Closed Anon Denial
REVOKE ALL ON public.artifacts FROM anon;
REVOKE ALL ON public.artifact_activities FROM anon;
REVOKE ALL ON public.artifact_skills FROM anon;
REVOKE ALL ON public.artifact_knowledge_nodes FROM anon;
REVOKE ALL ON public.artifact_quests FROM anon;
REVOKE ALL ON public.artifact_evidence FROM anon;
