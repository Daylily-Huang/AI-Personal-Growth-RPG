-- 0039_knowledge_graph_authority.sql
-- Stage 6A: Knowledge Map Domain Model, Authority Schema & Anti-Cycle DAG Invariants

-- ==============================================================================
-- 1. LEGACY 0012 PROTOTYPE TABLE DATA-SAFETY CHECK & CLEAN REBUILD
-- ==============================================================================
DO $$
DECLARE
  v_nodes_count integer := 0;
  v_edges_count integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_nodes') THEN
    EXECUTE 'SELECT count(*) FROM public.knowledge_nodes' INTO v_nodes_count;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_edges') THEN
    EXECUTE 'SELECT count(*) FROM public.knowledge_edges' INTO v_edges_count;
  END IF;
  
  -- Fail-closed safety guard: if legacy tables contain existing rows, abort drop
  IF v_nodes_count > 0 OR v_edges_count > 0 THEN
    RAISE EXCEPTION 'Safety abort: legacy knowledge tables contain % nodes and % edges. Cannot perform destructive rebuild.',
      v_nodes_count, v_edges_count;
  END IF;
END $$;

DROP TABLE IF EXISTS public.knowledge_edges CASCADE;
DROP TABLE IF EXISTS public.knowledge_nodes CASCADE;

-- ==============================================================================
-- 2. PUBLIC.KNOWLEDGE_NODES TABLE
-- ==============================================================================
CREATE TABLE public.knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    domain_id UUID,
    skill_id UUID,
    node_type TEXT NOT NULL DEFAULT 'concept'
        CHECK (node_type IN ('concept', 'claim', 'topic')),
    title TEXT NOT NULL
        CHECK (length(trim(title)) > 0),
    normalized_title TEXT GENERATED ALWAYS AS (lower(regexp_replace(trim(title), '\s+', ' ', 'g'))) STORED,
    description TEXT,
    verification_status TEXT NOT NULL DEFAULT 'verified'
        CHECK (verification_status IN ('inferred', 'verified', 'rejected', 'superseded')),
    confidence NUMERIC NOT NULL DEFAULT 1.0
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
    source_type TEXT NOT NULL DEFAULT 'user_created'
        CHECK (source_type IN ('activity', 'artifact', 'user_created', 'ai_proposal', 'imported')),
    source_id UUID,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Epistemic Confidence Invariants:
    -- Inferred AI proposals cannot exceed 0.95; Verified nodes must be 1.00
    CONSTRAINT knowledge_nodes_inferred_confidence_check
        CHECK (verification_status <> 'inferred' OR (confidence >= 0.00 AND confidence <= 0.95)),
    CONSTRAINT knowledge_nodes_verified_confidence_check
        CHECK (verification_status <> 'verified' OR confidence = 1.00),

    -- Composite key for tenant-safe foreign key references
    CONSTRAINT knowledge_nodes_user_id_composite_key UNIQUE (user_id, id),
    
    -- Unique title per tenant
    CONSTRAINT knowledge_nodes_unique_user_normalized_title UNIQUE (user_id, normalized_title),
    
    -- Tenant-safe composite foreign keys
    CONSTRAINT fk_knowledge_nodes_domain_tenant_safe
        FOREIGN KEY (user_id, domain_id)
        REFERENCES public.domains(user_id, id)
        ON DELETE SET NULL (domain_id),
        
    CONSTRAINT fk_knowledge_nodes_skill_tenant_safe
        FOREIGN KEY (user_id, skill_id)
        REFERENCES public.skills(user_id, id)
        ON DELETE SET NULL (skill_id)
);

-- ==============================================================================
-- 3. PUBLIC.KNOWLEDGE_EDGES TABLE
-- ==============================================================================
CREATE TABLE public.knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL,
    target_node_id UUID NOT NULL,
    relation_type TEXT NOT NULL
        CHECK (relation_type IN ('prerequisite', 'contains', 'supports', 'contradicts', 'relates_to')),
    verification_status TEXT NOT NULL DEFAULT 'verified'
        CHECK (verification_status IN ('inferred', 'verified', 'rejected', 'superseded')),
    confidence NUMERIC NOT NULL DEFAULT 1.0
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
    source_type TEXT
        CHECK (source_type IS NULL OR source_type IN ('activity', 'artifact', 'user_created', 'ai_proposal', 'imported')),
    source_id UUID,
    provenance_note TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Anti-self loop check
    CONSTRAINT knowledge_edges_anti_self CHECK (source_node_id <> target_node_id),
    
    -- True Symmetric Storage: 'contradicts' and 'relates_to' are strictly canonicalized (source < target)
    CONSTRAINT knowledge_edges_symmetric_canonical
        CHECK (relation_type NOT IN ('contradicts', 'relates_to') OR source_node_id < target_node_id),

    -- Provenance constraint: 'relates_to' edges MUST contain a non-empty explanation note
    CONSTRAINT knowledge_edges_relates_to_provenance
        CHECK (relation_type <> 'relates_to' OR (provenance_note IS NOT NULL AND length(trim(provenance_note)) > 0)),

    -- Epistemic Confidence Invariants:
    CONSTRAINT knowledge_edges_inferred_confidence_check
        CHECK (verification_status <> 'inferred' OR (confidence >= 0.00 AND confidence <= 0.95)),
    CONSTRAINT knowledge_edges_verified_confidence_check
        CHECK (verification_status <> 'verified' OR confidence = 1.00),

    -- Composite key for tenant uniqueness
    CONSTRAINT knowledge_edges_user_id_composite_key UNIQUE (user_id, id),
    
    -- Unique relation between same node pair
    CONSTRAINT knowledge_edges_unique_relation UNIQUE (user_id, source_node_id, target_node_id, relation_type),
    
    -- Composite tenant-safe foreign keys (Block cross-tenant references)
    CONSTRAINT fk_knowledge_edges_source_tenant_safe
        FOREIGN KEY (user_id, source_node_id)
        REFERENCES public.knowledge_nodes(user_id, id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_knowledge_edges_target_tenant_safe
        FOREIGN KEY (user_id, target_node_id)
        REFERENCES public.knowledge_nodes(user_id, id)
        ON DELETE CASCADE
);

-- ==============================================================================
-- 4. EVIDENCE_RECORDS COMPOSITE TENANT FOREIGN KEY TO KNOWLEDGE_NODES
-- ==============================================================================
DO $$
BEGIN
  ALTER TABLE public.evidence_records DROP CONSTRAINT IF EXISTS fk_evidence_records_knowledge_node_tenant_safe;
  ALTER TABLE public.evidence_records
    ADD CONSTRAINT fk_evidence_records_knowledge_node_tenant_safe
    FOREIGN KEY (user_id, knowledge_node_id)
    REFERENCES public.knowledge_nodes(user_id, id)
    ON DELETE SET NULL (knowledge_node_id);
END $$;

-- ==============================================================================
-- 5. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS knowledge_nodes_user_domain_idx ON public.knowledge_nodes (user_id, domain_id);
CREATE INDEX IF NOT EXISTS knowledge_nodes_user_status_idx ON public.knowledge_nodes (user_id, verification_status, is_archived);
CREATE INDEX IF NOT EXISTS knowledge_nodes_user_type_idx ON public.knowledge_nodes (user_id, node_type);
CREATE INDEX IF NOT EXISTS knowledge_edges_user_source_idx ON public.knowledge_edges (user_id, source_node_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_user_target_idx ON public.knowledge_edges (user_id, target_node_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_user_relation_status_idx ON public.knowledge_edges (user_id, relation_type, verification_status, is_archived);

-- ==============================================================================
-- 6. ANTI-CYCLE DAG TRIGGER FOR PREREQUISITE & CONTAINS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_knowledge_edge_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_has_cycle BOOLEAN := false;
BEGIN
    -- Only enforce acyclic DAG on 'prerequisite' and 'contains' relations
    -- Active in DAG: verification_status IN ('inferred', 'verified') AND is_archived = false
    -- (rejected and superseded edges are historical/inactive and excluded from cycle checks)
    IF NEW.relation_type IN ('prerequisite', 'contains')
       AND NEW.verification_status IN ('inferred', 'verified')
       AND NEW.is_archived = false THEN
       
        -- Serialize DAG mutations per tenant and relation type to prevent concurrent cycle races
        PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text || '|knowledge|' || NEW.relation_type));

        WITH RECURSIVE traverse AS (
            -- Base case: traverse edges of the same relation starting from NEW.target_node_id
            -- Exclude the current updating row if this is an UPDATE
            SELECT target_node_id
            FROM public.knowledge_edges
            WHERE user_id = NEW.user_id
              AND relation_type = NEW.relation_type
              AND verification_status IN ('inferred', 'verified')
              AND is_archived = false
              AND source_node_id = NEW.target_node_id
              AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            
            UNION ALL
            
            -- Recursive step
            SELECT e.target_node_id
            FROM public.knowledge_edges e
            INNER JOIN traverse t ON e.source_node_id = t.target_node_id
            WHERE e.user_id = NEW.user_id
              AND e.relation_type = NEW.relation_type
              AND e.verification_status IN ('inferred', 'verified')
              AND e.is_archived = false
              AND e.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        )
        SELECT EXISTS (
            SELECT 1
            FROM traverse
            WHERE target_node_id = NEW.source_node_id
        ) INTO v_has_cycle;

        IF v_has_cycle THEN
            RAISE EXCEPTION 'Cyclic dependency detected for relation type %: source % to target %',
                NEW.relation_type, NEW.source_node_id, NEW.target_node_id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_knowledge_edge_cycle ON public.knowledge_edges;
CREATE TRIGGER trigger_prevent_knowledge_edge_cycle
    BEFORE INSERT OR UPDATE OF source_node_id, target_node_id, relation_type, verification_status, is_archived
    ON public.knowledge_edges
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_knowledge_edge_cycle();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_nodes_select ON public.knowledge_nodes;
CREATE POLICY knowledge_nodes_select ON public.knowledge_nodes
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_nodes_insert ON public.knowledge_nodes;
CREATE POLICY knowledge_nodes_insert ON public.knowledge_nodes
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_nodes_update ON public.knowledge_nodes;
CREATE POLICY knowledge_nodes_update ON public.knowledge_nodes
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_nodes_delete ON public.knowledge_nodes;
CREATE POLICY knowledge_nodes_delete ON public.knowledge_nodes
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_edges_select ON public.knowledge_edges;
CREATE POLICY knowledge_edges_select ON public.knowledge_edges
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_edges_insert ON public.knowledge_edges;
CREATE POLICY knowledge_edges_insert ON public.knowledge_edges
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_edges_update ON public.knowledge_edges;
CREATE POLICY knowledge_edges_update ON public.knowledge_edges
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_edges_delete ON public.knowledge_edges;
CREATE POLICY knowledge_edges_delete ON public.knowledge_edges
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ==============================================================================
-- 8. EXPLICIT PRIVILEGE GRANTS (Fail-closed: No anon table grants)
-- ==============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_nodes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_edges TO authenticated, service_role;
