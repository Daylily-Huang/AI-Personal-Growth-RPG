-- supabase/migrations/0040_knowledge_authority_mutation.sql
-- Stage 6B Sanctioned Epistemic Authority Mutation & Column Privilege Boundary

-- ==============================================================================
-- 1. COLUMN-LEVEL UPDATE PRIVILEGE TIGHTENING (P0 Authority Bypass Protection)
-- ==============================================================================

-- Revoke blanket table-level UPDATE from authenticated role
REVOKE UPDATE ON public.knowledge_nodes FROM authenticated;
REVOKE UPDATE ON public.knowledge_edges FROM authenticated;

-- Ensure table-level SELECT, INSERT, DELETE are explicitly preserved
GRANT SELECT, INSERT, DELETE ON public.knowledge_nodes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.knowledge_edges TO authenticated;

-- Grant authenticated role UPDATE on ONLY safe client-mutable metadata/lifecycle columns
-- (Raw mutation on verification_status, confidence, verified_at, verified_by, source_type,
--  source_id, user_id, id, node_type is strictly DENIED at DB level).
GRANT UPDATE (
    title,
    description,
    domain_id,
    skill_id,
    metadata,
    is_archived,
    archived_at,
    updated_at,
    last_reviewed_at
) ON public.knowledge_nodes TO authenticated;

-- On knowledge_edges, provenance_note is epistemic provenance and CANNOT be rewritten by raw clients.
-- Raw update is strictly restricted to non-authority metadata and lifecycle columns.
GRANT UPDATE (
    metadata,
    is_archived,
    archived_at,
    updated_at
) ON public.knowledge_edges TO authenticated;

-- ==============================================================================
-- 2. SANCTIONED SECURITY DEFINER AUTHORITY RPCs
-- ==============================================================================

-- 2.1 Verify Knowledge Node
CREATE OR REPLACE FUNCTION public.verify_knowledge_node(p_node_id uuid)
RETURNS public.knowledge_nodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_row public.knowledge_nodes;
    v_now timestamptz := clock_timestamp();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
    END IF;

    -- 1. Locate only caller-owned row (fail-closed against foreign tenants)
    SELECT * INTO v_row
    FROM public.knowledge_nodes
    WHERE id = p_node_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'node_not_found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. State machine precondition: must be in inferred state
    IF v_row.verification_status <> 'inferred' THEN
        RAISE EXCEPTION 'invalid_authority_transition: only inferred nodes may be verified'
            USING ERRCODE = '22000';
    END IF;

    -- 3. Atomic CAS transition to verified
    UPDATE public.knowledge_nodes
    SET verification_status = 'verified',
        confidence = 1.00,
        verified_at = v_now,
        verified_by = v_user_id,
        updated_at = v_now
    WHERE id = p_node_id AND user_id = v_user_id AND verification_status = 'inferred'
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_authority_transition: concurrent update lost'
            USING ERRCODE = '22000';
    END IF;

    RETURN v_row;
END;
$$;

-- 2.2 Reject Knowledge Node
CREATE OR REPLACE FUNCTION public.reject_knowledge_node(p_node_id uuid)
RETURNS public.knowledge_nodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_row public.knowledge_nodes;
    v_now timestamptz := clock_timestamp();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_row
    FROM public.knowledge_nodes
    WHERE id = p_node_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'node_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_row.verification_status <> 'inferred' THEN
        RAISE EXCEPTION 'invalid_authority_transition: only inferred nodes may be rejected'
            USING ERRCODE = '22000';
    END IF;

    UPDATE public.knowledge_nodes
    SET verification_status = 'rejected',
        updated_at = v_now
    WHERE id = p_node_id AND user_id = v_user_id AND verification_status = 'inferred'
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_authority_transition: concurrent update lost'
            USING ERRCODE = '22000';
    END IF;

    RETURN v_row;
END;
$$;

-- 2.3 Verify Knowledge Edge
CREATE OR REPLACE FUNCTION public.verify_knowledge_edge(p_edge_id uuid)
RETURNS public.knowledge_edges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_row public.knowledge_edges;
    v_now timestamptz := clock_timestamp();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_row
    FROM public.knowledge_edges
    WHERE id = p_edge_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'edge_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_row.verification_status <> 'inferred' THEN
        RAISE EXCEPTION 'invalid_authority_transition: only inferred edges may be verified'
            USING ERRCODE = '22000';
    END IF;

    UPDATE public.knowledge_edges
    SET verification_status = 'verified',
        confidence = 1.00,
        verified_at = v_now,
        verified_by = v_user_id,
        updated_at = v_now
    WHERE id = p_edge_id AND user_id = v_user_id AND verification_status = 'inferred'
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_authority_transition: concurrent update lost'
            USING ERRCODE = '22000';
    END IF;

    RETURN v_row;
END;
$$;

-- 2.4 Reject Knowledge Edge
CREATE OR REPLACE FUNCTION public.reject_knowledge_edge(p_edge_id uuid)
RETURNS public.knowledge_edges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_row public.knowledge_edges;
    v_now timestamptz := clock_timestamp();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_row
    FROM public.knowledge_edges
    WHERE id = p_edge_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'edge_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_row.verification_status <> 'inferred' THEN
        RAISE EXCEPTION 'invalid_authority_transition: only inferred edges may be rejected'
            USING ERRCODE = '22000';
    END IF;

    UPDATE public.knowledge_edges
    SET verification_status = 'rejected',
        updated_at = v_now
    WHERE id = p_edge_id AND user_id = v_user_id AND verification_status = 'inferred'
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_authority_transition: concurrent update lost'
            USING ERRCODE = '22000';
    END IF;

    RETURN v_row;
END;
$$;

-- ==============================================================================
-- 3. FUNCTION EXECUTE PERMISSIONS (Fail-Closed against PUBLIC)
-- ==============================================================================
REVOKE EXECUTE ON FUNCTION public.verify_knowledge_node(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_knowledge_node(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_knowledge_edge(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_knowledge_edge(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verify_knowledge_node(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_knowledge_node(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_knowledge_edge(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_knowledge_edge(uuid) TO authenticated, service_role;
