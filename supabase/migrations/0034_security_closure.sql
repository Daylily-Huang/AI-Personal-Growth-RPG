-- Stage 4.3 Final Security Closure

-- ==============================================================================
-- 1. FIX CROSS-TENANT SECURITY DEFINER RPC VULNERABILITY (P1)
-- ==============================================================================
-- Revoke execute from authenticated and public.
-- It is an internal function triggered by triggers only.

-- ==============================================================================
-- 2. PREVENT RESURRECTION OF FAILED/ARCHIVED PARENTS (P2-2)
-- ==============================================================================
DROP FUNCTION IF EXISTS public.recompute_quest_chain(uuid, uuid);

CREATE OR REPLACE FUNCTION public.recompute_quest_chain(p_user_id uuid, p_current_id uuid)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply security grants after recreation
REVOKE ALL ON FUNCTION public.recompute_quest_chain(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_quest_chain(uuid, uuid) TO service_role;


-- ==============================================================================
-- 3. UNIQUE ACTIVE MAIN QUEST CONSTRAINT (P2-1)
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS quests_unique_active_main_quest 
ON public.quests(user_id) 
WHERE is_main_quest = true 
  AND status NOT IN ('completed', 'failed', 'archived');


-- ==============================================================================
-- 4. ACTIVITY QUEST IDENTITY SNAPSHOTS & BACKFILL (P2-4)
-- ==============================================================================
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS quest_id_snapshot uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quest_title_snapshot text DEFAULT NULL;

-- Backfill legacy records
UPDATE public.activities a
SET 
  quest_size_snapshot = q.quest_size,
  quest_id_snapshot = q.id,
  quest_title_snapshot = q.title
FROM public.quests q
WHERE a.quest_id = q.id 
  AND (a.quest_size_snapshot IS NULL OR a.quest_id_snapshot IS NULL);

-- Drop the old create_activity RPC and replace it with one that snapshots everything
DROP FUNCTION IF EXISTS public.create_activity(uuid, text, text, text, bigint, bigint, uuid);

CREATE OR REPLACE FUNCTION public.create_activity(
  p_user_id uuid,
  p_title text,
  p_description text,
  p_domain_id text,
  p_started_at bigint,
  p_ended_at bigint,
  p_quest_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_activity_id uuid;
  v_quest_size text;
  v_quest_title text;
BEGIN
  -- If linked to a quest, freeze its current scale and identity
  IF p_quest_id IS NOT NULL THEN
    SELECT quest_size, title INTO v_quest_size, v_quest_title
    FROM public.quests 
    WHERE id = p_quest_id AND user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quest not found or does not belong to user';
    END IF;
  END IF;

  INSERT INTO public.activities (
    user_id,
    title,
    description,
    domain_id,
    started_at,
    ended_at,
    quest_id,
    quest_size_snapshot,
    quest_id_snapshot,
    quest_title_snapshot,
    status
  ) VALUES (
    p_user_id,
    p_title,
    p_description,
    p_domain_id,
    p_started_at,
    p_ended_at,
    p_quest_id,
    v_quest_size,
    (CASE WHEN p_quest_id IS NOT NULL THEN p_quest_id ELSE NULL END),
    v_quest_title,
    'pending_assessment'
  ) RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
