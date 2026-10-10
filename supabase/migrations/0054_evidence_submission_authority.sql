-- Manual E0 intake only. Core description is the only material body truth.
CREATE TABLE public.evidence_submissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  requested_skill_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id),
  UNIQUE (evidence_id),
  FOREIGN KEY (user_id, activity_id) REFERENCES public.activities(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, evidence_id) REFERENCES public.evidence_records(user_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX evidence_submissions_activity_cursor ON public.evidence_submissions(user_id, activity_id, request_id);
ALTER TABLE public.evidence_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_submissions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.evidence_submissions TO authenticated;
CREATE POLICY evidence_submissions_owner_read ON public.evidence_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- INVOKER is intentional: a client with broadened grants cannot impersonate
-- the postgres execution identity inside the sanctioned SECURITY DEFINER RPC.
CREATE FUNCTION public.evidence_submission_insert_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE e public.evidence_records%ROWTYPE;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres'
    OR current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'EVIDENCE_WRITE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM public.evidence_records WHERE id = NEW.evidence_id;
  IF NOT FOUND OR e.user_id IS DISTINCT FROM NEW.user_id OR e.activity_id IS DISTINCT FROM NEW.activity_id
    OR e.skill_id IS DISTINCT FROM NEW.requested_skill_id OR e.evidence_level IS DISTINCT FROM 0
    OR e.verified IS DISTINCT FROM false OR e.evidence_type IS DISTINCT FROM 'user_submission'
    OR e.knowledge_node_id IS NOT NULL OR e.description IS NULL
    OR e.description IS DISTINCT FROM public.phase8f_trim_text(e.description)
    OR octet_length(e.description) NOT BETWEEN 1 AND 8192
    OR NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.id = NEW.activity_id AND a.user_id = NEW.user_id)
    OR (NEW.requested_skill_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.skills s WHERE s.id = NEW.requested_skill_id AND s.user_id = NEW.user_id AND s.status = 'active')) THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_RECEIPT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.evidence_submission_insert_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.evidence_submission_insert_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER evidence_submission_insert_guard BEFORE INSERT ON public.evidence_submissions
  FOR EACH ROW EXECUTE FUNCTION public.evidence_submission_insert_guard();

-- DEFINER is intentional here: parent absence must be real, not an RLS-hidden
-- foreign Activity. It does not authorize INSERT and UPDATE is always denied.
CREATE FUNCTION public.evidence_submission_change_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (
    NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id)
    OR NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.id = OLD.activity_id AND a.user_id = OLD.user_id)
  ) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'EVIDENCE_WRITE_FORBIDDEN' USING ERRCODE = '42501';
END;
$$;
ALTER FUNCTION public.evidence_submission_change_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.evidence_submission_change_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER evidence_submission_change_guard BEFORE UPDATE OR DELETE ON public.evidence_submissions
  FOR EACH ROW EXECUTE FUNCTION public.evidence_submission_change_guard();
CREATE TRIGGER evidence_submission_truncate_guard BEFORE TRUNCATE ON public.evidence_submissions
  FOR EACH STATEMENT EXECUTE FUNCTION public.evidence_submission_change_guard();

CREATE FUNCTION public.rpc_submit_activity_evidence(p_activity_id uuid, p_request_id uuid, p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  u uuid := auth.uid(); requested uuid; body text; replayed boolean := false;
  r public.evidence_submissions%ROWTYPE; e public.evidence_records%ROWTYPE;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR u IS NULL THEN
    RAISE EXCEPTION 'EVIDENCE_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_activity_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_INPUT' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_input ? 'skillId' AND p_input ? 'description')
    OR (SELECT count(*) FROM jsonb_object_keys(p_input)) <> 2
    OR jsonb_typeof(p_input->'description') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'skillId') NOT IN ('null', 'string') THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_INPUT' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'skillId') = 'string' THEN
    IF p_input->>'skillId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'INVALID_EVIDENCE_INPUT' USING ERRCODE = '22023';
    END IF;
    requested := (p_input->>'skillId')::uuid;
  END IF;
  body := public.phase8f_trim_text(p_input->>'description');
  IF octet_length(body) NOT BETWEEN 1 AND 8192 THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_INPUT' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evidence-submit-v1|' || u::text || '|' || p_request_id::text, 0));
  SELECT * INTO r FROM public.evidence_submissions WHERE user_id = u AND request_id = p_request_id;
  IF FOUND THEN
    replayed := true;
    SELECT * INTO e FROM public.evidence_records WHERE id = r.evidence_id;
    IF NOT FOUND OR e.user_id IS DISTINCT FROM u OR e.activity_id IS DISTINCT FROM r.activity_id
      OR e.evidence_level IS DISTINCT FROM 0 OR e.evidence_type IS DISTINCT FROM 'user_submission'
      OR e.verified IS DISTINCT FROM false OR e.knowledge_node_id IS NOT NULL
      OR e.description IS NULL OR e.description IS DISTINCT FROM public.phase8f_trim_text(e.description)
      OR octet_length(e.description) NOT BETWEEN 1 AND 8192
      OR (e.skill_id IS NOT NULL AND e.skill_id IS DISTINCT FROM r.requested_skill_id)
      OR (e.skill_id IS NULL AND r.requested_skill_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.skills s WHERE s.id = r.requested_skill_id))
      OR (e.skill_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.skills s WHERE s.id = e.skill_id AND s.user_id = u)) THEN
      RAISE EXCEPTION 'INVALID_EVIDENCE_RECEIPT' USING ERRCODE = 'P0001';
    END IF;
    IF r.activity_id IS DISTINCT FROM p_activity_id OR r.requested_skill_id IS DISTINCT FROM requested OR e.description IS DISTINCT FROM body THEN
      RAISE EXCEPTION 'EVIDENCE_REQUEST_REUSED' USING ERRCODE = '23505';
    END IF;
  ELSE
    PERFORM 1 FROM public.activities a WHERE a.id = p_activity_id AND a.user_id = u
      AND a.status IN ('pending_assessment', 'assessed', 'confirmed') FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_TARGET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF requested IS NOT NULL THEN
      PERFORM 1 FROM public.skills s WHERE s.id = requested AND s.user_id = u AND s.status = 'active' FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_TARGET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    END IF;
    INSERT INTO public.evidence_records(user_id, activity_id, skill_id, knowledge_node_id, evidence_level, evidence_type, description, verified)
      VALUES (u, p_activity_id, requested, NULL, 0, 'user_submission', body, false) RETURNING * INTO e;
    INSERT INTO public.evidence_submissions(user_id, request_id, activity_id, evidence_id, requested_skill_id)
      VALUES (u, p_request_id, p_activity_id, e.id, requested) RETURNING * INTO r;
  END IF;
  RETURN jsonb_build_object('userId', u, 'replayed', replayed, 'submission', jsonb_build_object(
    'requestId', r.request_id, 'activityId', r.activity_id, 'requestedSkillId', r.requested_skill_id,
    'evidence', jsonb_build_object('userId', e.user_id, 'id', e.id, 'activityId', e.activity_id, 'skillId', e.skill_id,
      'evidenceLevel', e.evidence_level, 'evidenceType', e.evidence_type, 'description', e.description,
      'verified', e.verified, 'createdAt', e.created_at)));
END;
$$;
ALTER FUNCTION public.rpc_submit_activity_evidence(uuid, uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_submit_activity_evidence(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submit_activity_evidence(uuid, uuid, jsonb) TO authenticated;

CREATE FUNCTION public.rpc_list_activity_evidence_submissions(p_activity_id uuid, p_view text, p_after uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  u uuid := auth.uid(); rows jsonb := '[]'::jsonb; more boolean := false; cursor uuid;
  r public.evidence_submissions%ROWTYPE; e public.evidence_records%ROWTYPE; s record;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR u IS NULL THEN
    RAISE EXCEPTION 'EVIDENCE_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_activity_id IS NULL OR p_view IS NULL OR p_view NOT IN ('submissions', 'skills') THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_INPUT' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.id = p_activity_id AND a.user_id = u) THEN
    RAISE EXCEPTION 'EVIDENCE_TARGET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_view = 'skills' THEN
    FOR s IN SELECT sk.id, sk.name FROM public.skills sk WHERE sk.user_id = u AND sk.status = 'active'
      AND (p_after IS NULL OR sk.id > p_after) ORDER BY sk.id LIMIT 51 LOOP
      IF jsonb_array_length(rows) = 50 THEN more := true; EXIT; END IF;
      rows := rows || jsonb_build_array(jsonb_build_object('userId', u, 'id', s.id, 'name', left(s.name, 200),
        'status', 'active', 'nameTruncated', char_length(s.name) > 200));
      cursor := s.id;
    END LOOP;
  ELSE
    FOR r IN SELECT * FROM public.evidence_submissions es WHERE es.user_id = u AND es.activity_id = p_activity_id
      AND (p_after IS NULL OR es.request_id > p_after) ORDER BY es.request_id LIMIT 26 LOOP
      SELECT * INTO e FROM public.evidence_records er WHERE er.id = r.evidence_id;
      IF NOT FOUND OR e.user_id IS DISTINCT FROM u OR e.activity_id IS DISTINCT FROM p_activity_id
        OR e.evidence_level IS DISTINCT FROM 0 OR e.evidence_type IS DISTINCT FROM 'user_submission'
        OR e.verified IS DISTINCT FROM false OR e.knowledge_node_id IS NOT NULL
        OR e.description IS NULL OR e.description IS DISTINCT FROM public.phase8f_trim_text(e.description)
        OR octet_length(e.description) NOT BETWEEN 1 AND 8192
        OR (e.skill_id IS NOT NULL AND e.skill_id IS DISTINCT FROM r.requested_skill_id)
        OR (e.skill_id IS NULL AND r.requested_skill_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.skills sk WHERE sk.id = r.requested_skill_id))
        OR (e.skill_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.skills sk WHERE sk.id = e.skill_id AND sk.user_id = u)) THEN
        RAISE EXCEPTION 'INVALID_EVIDENCE_RECEIPT' USING ERRCODE = 'P0001';
      END IF;
      IF jsonb_array_length(rows) = 25 THEN more := true; EXIT; END IF;
      rows := rows || jsonb_build_array(jsonb_build_object('requestId', r.request_id, 'activityId', r.activity_id,
        'requestedSkillId', r.requested_skill_id, 'evidence', jsonb_build_object('userId', e.user_id, 'id', e.id,
          'activityId', e.activity_id, 'skillId', e.skill_id, 'evidenceLevel', e.evidence_level,
          'evidenceType', e.evidence_type, 'description', e.description, 'verified', e.verified, 'createdAt', e.created_at)));
      cursor := r.request_id;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('userId', u, 'activityId', p_activity_id, 'view', p_view, 'items', rows,
    'nextCursor', CASE WHEN more THEN cursor ELSE NULL END);
END;
$$;
ALTER FUNCTION public.rpc_list_activity_evidence_submissions(uuid, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_list_activity_evidence_submissions(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_list_activity_evidence_submissions(uuid, text, uuid) TO authenticated;
