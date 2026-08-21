-- Stage 4.4: Activity Quest Snapshot RPC Correction & Search Path Hardening

-- ==============================================================================
-- 1. DROP THE INCORRECT OVERLOAD FROM 0034
-- ==============================================================================
DROP FUNCTION IF EXISTS public.create_activity(
  uuid,
  text,
  text,
  text,
  bigint,
  bigint,
  uuid
);

-- ==============================================================================
-- 2. CREATE OR REPLACE THE PRODUCTION create_activity RPC WITH FULL SNAPSHOTS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_activity(
  p_title text,
  p_raw_input text,
  p_activity_type text default null,
  p_quest_id uuid default null,
  p_total_minutes integer default null,
  p_effective_minutes integer default null,
  p_started_at timestamptz default null,
  p_ended_at timestamptz default null,
  p_completion numeric default null
)
RETURNS public.activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules_version text;
  v_quest_size_snapshot text := null;
  v_quest_id_snapshot uuid := null;
  v_quest_title_snapshot text := null;
  v_activity public.activities;
BEGIN
  IF p_quest_id IS NOT NULL THEN
    SELECT quest_size, title 
    INTO v_quest_size_snapshot, v_quest_title_snapshot
    FROM public.quests
    WHERE id = p_quest_id AND user_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'quest_not_owned';
    END IF;

    v_quest_id_snapshot := p_quest_id;
  END IF;

  SELECT version INTO v_rules_version
  FROM public.rules_versions
  WHERE status = 'active'
  ORDER BY activated_at DESC NULLS LAST
  LIMIT 1;

  IF v_rules_version IS NULL THEN
    RAISE EXCEPTION 'no_active_rules_version';
  END IF;

  INSERT INTO public.activities (
    user_id,
    title,
    raw_input,
    activity_type,
    quest_id,
    quest_size_snapshot,
    quest_id_snapshot,
    quest_title_snapshot,
    total_minutes,
    effective_minutes,
    started_at,
    ended_at,
    completion,
    status,
    rules_version,
    created_at,
    updated_at
  ) VALUES (
    auth.uid(),
    p_title,
    p_raw_input,
    p_activity_type,
    p_quest_id,
    v_quest_size_snapshot,
    v_quest_id_snapshot,
    v_quest_title_snapshot,
    p_total_minutes,
    p_effective_minutes,
    p_started_at,
    p_ended_at,
    p_completion,
    'pending_assessment',
    v_rules_version,
    now(),
    now()
  ) RETURNING * INTO v_activity;

  RETURN v_activity;
END;
$$;

-- Explicitly configure execution permissions
REVOKE ALL ON FUNCTION public.create_activity(text, text, text, uuid, integer, integer, timestamptz, timestamptz, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_activity(text, text, text, uuid, integer, integer, timestamptz, timestamptz, numeric) TO authenticated;

-- ==============================================================================
-- 3. HARDEN recompute_quest_chain WITH EXPLICIT search_path = public (P2-2)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.recompute_quest_chain(p_user_id uuid, p_current_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_id uuid := p_current_id;
  v_parent_id uuid;
  v_children_count integer;
  v_avg_progress numeric;
  v_all_completed boolean;
  v_new_status text;
  v_current_status text;
BEGIN
  WHILE v_current_id IS NOT NULL LOOP
    -- Lock the current node to prevent concurrent child updates from racing
    SELECT parent_quest_id, status 
    INTO v_parent_id, v_current_status
    FROM public.quests 
    WHERE id = v_current_id AND user_id = p_user_id
    FOR UPDATE;

    -- If the quest doesn't exist or doesn't belong to the user, stop
    IF NOT FOUND THEN
      EXIT;
    END IF;

    -- Aggregate children (exclude archived)
    SELECT 
      COUNT(*),
      COALESCE(ROUND(AVG(progress)), 0),
      bool_and(status = 'completed')
    INTO 
      v_children_count, 
      v_avg_progress, 
      v_all_completed
    FROM public.quests
    WHERE parent_quest_id = v_current_id
      AND user_id = p_user_id
      AND status <> 'archived';

    -- Only apply roll-up if there are valid children
    IF v_children_count > 0 THEN
      -- Determine new status, but DO NOT resurrect 'failed' or 'archived' quests
      IF v_current_status IN ('failed', 'archived') THEN
        v_new_status := v_current_status;
      ELSE
        v_new_status := CASE
          WHEN v_all_completed AND v_avg_progress = 100 THEN 'completed'
          WHEN v_avg_progress > 0 THEN 'active'
          ELSE 'available'
        END;
      END IF;
      
      UPDATE public.quests
      SET 
        progress = v_avg_progress,
        status = v_new_status,
        completed_at = CASE WHEN v_new_status = 'completed' THEN COALESCE(completed_at, now()) ELSE NULL END,
        updated_at = now()
      WHERE id = v_current_id;
    END IF;

    -- Move up to the parent
    v_current_id := v_parent_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_quest_chain(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_quest_chain(uuid, uuid) TO service_role;
