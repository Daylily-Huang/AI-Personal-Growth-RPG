-- 0036_skill_edges_and_tenant_fks.sql
-- Stage 5A: Skill Edges, Tenant-Safe Composite Foreign Keys & Anti-Cycle DAG Invariants

-- ==============================================================================
-- 1. COMPOSITE UNIQUE CONSTRAINTS (Foundations for Composite Foreign Keys)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skills_user_id_composite_key'
  ) THEN
    ALTER TABLE public.skills ADD CONSTRAINT skills_user_id_composite_key UNIQUE (user_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'domains_user_id_composite_key'
  ) THEN
    ALTER TABLE public.domains ADD CONSTRAINT domains_user_id_composite_key UNIQUE (user_id, id);
  END IF;
END $$;

-- ==============================================================================
-- 2. TENANT-SAFE COMPOSITE FOREIGN KEYS (With Column-Specific SET NULL)
-- ==============================================================================

-- 2.1 domains.parent_id -> domains(user_id, id)
DO $$
BEGIN
  -- Drop existing single-column FK if present
  ALTER TABLE public.domains DROP CONSTRAINT IF EXISTS domains_parent_id_fkey;
  ALTER TABLE public.domains DROP CONSTRAINT IF EXISTS fk_domains_parent_tenant_safe;
  
  ALTER TABLE public.domains
    ADD CONSTRAINT fk_domains_parent_tenant_safe
    FOREIGN KEY (user_id, parent_id)
    REFERENCES public.domains(user_id, id)
    ON DELETE SET NULL (parent_id);
END $$;

-- 2.2 skills.domain_id -> domains(user_id, id)
DO $$
BEGIN
  -- Drop existing single-column FK if present
  ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS skills_domain_id_fkey;
  ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS fk_skills_domain_tenant_safe;
  
  ALTER TABLE public.skills
    ADD CONSTRAINT fk_skills_domain_tenant_safe
    FOREIGN KEY (user_id, domain_id)
    REFERENCES public.domains(user_id, id)
    ON DELETE SET NULL (domain_id);
END $$;

-- 2.3 evidence_records.skill_id -> skills(user_id, id)
DO $$
BEGIN
  -- Drop existing single-column FK if present
  ALTER TABLE public.evidence_records DROP CONSTRAINT IF EXISTS evidence_records_skill_id_fkey;
  ALTER TABLE public.evidence_records DROP CONSTRAINT IF EXISTS fk_evidence_records_skill_tenant_safe;
  
  ALTER TABLE public.evidence_records
    ADD CONSTRAINT fk_evidence_records_skill_tenant_safe
    FOREIGN KEY (user_id, skill_id)
    REFERENCES public.skills(user_id, id)
    ON DELETE SET NULL (skill_id);
END $$;

-- 2.4 mastery_events.evidence_id -> evidence_records(id) (P2 Evidence Traceability)
DO $$
BEGIN
  ALTER TABLE public.mastery_events DROP CONSTRAINT IF EXISTS fk_mastery_events_evidence;
  
  ALTER TABLE public.mastery_events
    ADD CONSTRAINT fk_mastery_events_evidence
    FOREIGN KEY (evidence_id)
    REFERENCES public.evidence_records(id)
    ON DELETE SET NULL;
END $$;

-- ==============================================================================
-- 3. PUBLIC.SKILL_EDGES TABLE & GRAPH CONSTRAINTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.skill_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_skill_id UUID NOT NULL,
    target_skill_id UUID NOT NULL,
    relation_type TEXT NOT NULL CHECK (relation_type IN ('prerequisite', 'contains', 'supports')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Anti-self edge
    CONSTRAINT skill_edges_anti_self CHECK (source_skill_id <> target_skill_id),
    
    -- Composite tenant foreign keys (Blocks User A connecting User B's skills)
    CONSTRAINT fk_skill_edges_source_tenant_safe
        FOREIGN KEY (user_id, source_skill_id)
        REFERENCES public.skills(user_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_skill_edges_target_tenant_safe
        FOREIGN KEY (user_id, target_skill_id)
        REFERENCES public.skills(user_id, id)
        ON DELETE CASCADE,
        
    -- Unique relation between same node pair
    CONSTRAINT skill_edges_unique_relation
        UNIQUE (user_id, source_skill_id, target_skill_id, relation_type)
);

-- 3.1 Single-Parent Contains Invariant (Tree / Forest structure)
CREATE UNIQUE INDEX IF NOT EXISTS skill_edges_single_contains_parent_idx
    ON public.skill_edges (user_id, target_skill_id)
    WHERE relation_type = 'contains';

CREATE INDEX IF NOT EXISTS skill_edges_user_source_idx
    ON public.skill_edges (user_id, source_skill_id);

CREATE INDEX IF NOT EXISTS skill_edges_user_target_idx
    ON public.skill_edges (user_id, target_skill_id);

-- ==============================================================================
-- 4. ANTI-CYCLE DAG TRIGGER FOR PREREQUISITE & CONTAINS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_skill_edge_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_has_cycle BOOLEAN := false;
BEGIN
    -- Only enforce acyclic DAG on 'prerequisite' and 'contains' relations.
    -- 'supports' is a directed synergy graph and allows mutual cycles (A -> B and B -> A).
    IF NEW.relation_type IN ('prerequisite', 'contains') THEN
        WITH RECURSIVE traverse AS (
            -- Base case: traverse edges of the same relation starting from NEW.target_skill_id
            SELECT target_skill_id
            FROM public.skill_edges
            WHERE user_id = NEW.user_id
              AND relation_type = NEW.relation_type
              AND source_skill_id = NEW.target_skill_id
            
            UNION ALL
            
            -- Recursive step
            SELECT e.target_skill_id
            FROM public.skill_edges e
            JOIN traverse t ON e.source_skill_id = t.target_skill_id
            WHERE e.user_id = NEW.user_id
              AND e.relation_type = NEW.relation_type
        )
        SELECT true INTO v_has_cycle
        FROM traverse
        WHERE target_skill_id = NEW.source_skill_id
        LIMIT 1;

        IF v_has_cycle THEN
            RAISE EXCEPTION 'Cycle detected: Cannot create % edge that introduces a directed cycle between skills', NEW.relation_type;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_skill_edge_cycle ON public.skill_edges;
CREATE TRIGGER trg_prevent_skill_edge_cycle
    BEFORE INSERT OR UPDATE ON public.skill_edges
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_skill_edge_cycle();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY ON SKILL_EDGES
-- ==============================================================================
ALTER TABLE public.skill_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_edges_user_isolation_select" ON public.skill_edges;
CREATE POLICY "skill_edges_user_isolation_select"
    ON public.skill_edges FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "skill_edges_user_isolation_insert" ON public.skill_edges;
CREATE POLICY "skill_edges_user_isolation_insert"
    ON public.skill_edges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "skill_edges_user_isolation_update" ON public.skill_edges;
CREATE POLICY "skill_edges_user_isolation_update"
    ON public.skill_edges FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "skill_edges_user_isolation_delete" ON public.skill_edges;
CREATE POLICY "skill_edges_user_isolation_delete"
    ON public.skill_edges FOR DELETE
    USING (auth.uid() = user_id);
