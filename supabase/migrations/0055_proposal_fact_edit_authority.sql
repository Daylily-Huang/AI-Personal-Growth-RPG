-- SiteReadiness18: immutable fact revisions; AI proposes, ordinary Confirm settles.
-- Forward-only. Never apply this file to the live database without its separate gate.

ALTER TABLE public.ai_assessments ADD CONSTRAINT ai_assessments_proposal_edit_owner_key UNIQUE (user_id, id);

CREATE TABLE public.proposal_fact_edit_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  base_assessment_id uuid NOT NULL,
  facts jsonb NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  failure text,
  revision_id uuid,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, request_id),
  UNIQUE (user_id, request_id, activity_id, base_assessment_id),
  FOREIGN KEY (user_id, activity_id) REFERENCES public.activities(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, base_assessment_id) REFERENCES public.ai_assessments(user_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CHECK (expires_at = created_at + interval '180 seconds'),
  CHECK (
    (status = 'in_progress' AND failure IS NULL AND revision_id IS NULL)
    OR (status = 'completed' AND failure IS NULL AND revision_id IS NOT NULL)
    OR (status = 'failed' AND failure IS NOT DISTINCT FROM 'AI_UNAVAILABLE' AND revision_id IS NULL)
    OR (status = 'expired' AND failure IS NOT DISTINCT FROM 'EXPIRED' AND revision_id IS NULL)
    OR (status = 'conflict' AND failure IS NOT DISTINCT FROM 'CONFLICT' AND revision_id IS NULL)
  )
);
CREATE UNIQUE INDEX proposal_fact_edit_one_in_progress ON public.proposal_fact_edit_requests(user_id, activity_id)
  WHERE status = 'in_progress';
CREATE INDEX proposal_fact_edit_activity_cursor ON public.proposal_fact_edit_requests(user_id, activity_id, request_id);

CREATE TABLE public.proposal_fact_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  base_assessment_id uuid NOT NULL,
  result_assessment_id uuid NOT NULL UNIQUE,
  previous_revision_id uuid,
  rules_version text NOT NULL,
  prompt_version text NOT NULL CHECK (prompt_version = 'activity-evaluator-v0.4-facts'),
  created_at timestamptz NOT NULL,
  UNIQUE (user_id, id),
  UNIQUE (user_id, id, activity_id),
  UNIQUE (user_id, id, request_id, activity_id, base_assessment_id),
  UNIQUE (user_id, request_id),
  UNIQUE (user_id, activity_id, base_assessment_id),
  UNIQUE NULLS NOT DISTINCT (user_id, activity_id, previous_revision_id),
  CHECK (base_assessment_id <> result_assessment_id),
  CHECK (previous_revision_id IS NULL OR previous_revision_id <> id),
  FOREIGN KEY (user_id, activity_id) REFERENCES public.activities(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, request_id, activity_id, base_assessment_id)
    REFERENCES public.proposal_fact_edit_requests(user_id, request_id, activity_id, base_assessment_id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, base_assessment_id) REFERENCES public.ai_assessments(user_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, result_assessment_id) REFERENCES public.ai_assessments(user_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, previous_revision_id, activity_id) REFERENCES public.proposal_fact_revisions(user_id, id, activity_id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.proposal_fact_edit_requests ADD CONSTRAINT proposal_fact_edit_completed_revision_fk
  FOREIGN KEY (user_id, revision_id, request_id, activity_id, base_assessment_id)
  REFERENCES public.proposal_fact_revisions(user_id, id, request_id, activity_id, base_assessment_id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX proposal_fact_revision_activity_cursor ON public.proposal_fact_revisions(user_id, activity_id, id);

ALTER TABLE public.proposal_fact_edit_requests OWNER TO postgres;
ALTER TABLE public.proposal_fact_revisions OWNER TO postgres;
ALTER TABLE public.proposal_fact_edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_fact_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposal_fact_edit_requests, public.proposal_fact_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.proposal_fact_edit_requests, public.proposal_fact_revisions TO authenticated;
CREATE POLICY proposal_fact_edit_owner_read ON public.proposal_fact_edit_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY proposal_fact_revision_owner_read ON public.proposal_fact_revisions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Private primitives. Explicit NULL checks, never STRICT NULL-as-success.
CREATE FUNCTION public.proposal_edit_activity_gate(p_owner uuid, p_activity uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'proposal-edit-activity-v1|' || p_owner::text || '|' || p_activity::text, 0));
$$;

CREATE FUNCTION public.proposal_edit_object(p_value jsonb, p_required text[], p_optional text[] DEFAULT ARRAY[]::text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'object' THEN false ELSE
    p_value ?& p_required AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_value) AS f(key) WHERE NOT (key = ANY(p_required || p_optional))) END;
$$;
CREATE FUNCTION public.proposal_edit_number(p_value jsonb, p_min numeric, p_max numeric, p_integer boolean DEFAULT false)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'number' THEN false ELSE
    (p_value #>> '{}')::numeric BETWEEN p_min AND p_max
    AND (NOT p_integer OR trunc((p_value #>> '{}')::numeric) = (p_value #>> '{}')::numeric) END;
$$;
CREATE FUNCTION public.proposal_edit_label(p_value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT p_value IS NOT NULL AND octet_length(p_value) BETWEEN 1 AND 256
    AND public.phase8f_trim_text(p_value) <> '';
$$;

CREATE FUNCTION public.proposal_edit_canonical_facts(p_facts jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE body text; k text; total integer; effective integer; clue jsonb; clue_id text; clues jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.proposal_edit_object(p_facts, ARRAY['description','totalMinutes','effectiveMinutes','relatedSkillIds'])
    OR jsonb_typeof(p_facts->'description') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_facts->'relatedSkillIds') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  body := public.phase8f_trim_text(p_facts->>'description');
  IF octet_length(body) NOT BETWEEN 1 AND 8192 OR jsonb_array_length(p_facts->'relatedSkillIds') > 5 THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['totalMinutes','effectiveMinutes'] LOOP
    IF jsonb_typeof(p_facts->k) IS DISTINCT FROM 'null' AND NOT public.proposal_edit_number(p_facts->k, 0, 1440, true) THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  total := (p_facts->>'totalMinutes')::numeric::integer;
  effective := (p_facts->>'effectiveMinutes')::numeric::integer;
  IF total IS NOT NULL AND effective IS NOT NULL AND effective > total THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  FOR clue IN SELECT value FROM jsonb_array_elements(p_facts->'relatedSkillIds') LOOP
    IF jsonb_typeof(clue) IS DISTINCT FROM 'string'
      OR (clue #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
    clue_id := lower(clue #>> '{}');
    IF clues ? clue_id THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
    clues := clues || jsonb_build_array(clue_id);
  END LOOP;
  RETURN jsonb_build_object('description', body, 'totalMinutes', total, 'effectiveMinutes', effective, 'relatedSkillIds', clues);
END;
$$;

CREATE FUNCTION public.proposal_edit_skills_active(p_owner uuid, p_facts jsonb)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE found_count integer := 0; s record;
BEGIN
  FOR s IN SELECT sk.id FROM public.skills sk WHERE sk.user_id = p_owner AND sk.status = 'active'
    AND sk.id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_facts->'relatedSkillIds'))
    ORDER BY sk.id FOR SHARE LOOP found_count := found_count + 1; END LOOP;
  RETURN found_count = jsonb_array_length(p_facts->'relatedSkillIds');
END;
$$;

-- Validate the actual frozen AssessmentProposal shape independently of TypeScript.
-- jsonb itself rejects NUL, invalid Unicode and non-finite JSON numbers at input.
CREATE FUNCTION public.proposal_edit_validate_proposal(p jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE k text; item jsonb; obj jsonb;
BEGIN
  IF p IS NULL OR octet_length(p::text) > 65536 OR NOT public.proposal_edit_object(p,
    ARRAY['activity','difficulty','growth','evidence','affected_skills','knowledge_updates','mastery_changes','xp_semantics','next_quest','confidence','uncertainty_notes'],
    ARRAY['artifactProposals','artifacts']) THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  -- Finite PostgreSQL numeric is not automatically a finite JSON/JS Number.
  FOR item IN WITH RECURSIVE nodes(n) AS (
    SELECT p UNION ALL SELECT children.value FROM nodes CROSS JOIN LATERAL (
      SELECT value FROM jsonb_each(CASE WHEN jsonb_typeof(nodes.n) = 'object' THEN nodes.n ELSE '{}'::jsonb END)
      UNION ALL SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(nodes.n) = 'array' THEN nodes.n ELSE '[]'::jsonb END)
    ) children
  ) SELECT n FROM nodes WHERE jsonb_typeof(n) = 'number' LOOP
    BEGIN PERFORM (item #>> '{}')::double precision;
    EXCEPTION WHEN numeric_value_out_of_range THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END;
  END LOOP;
  IF NOT public.proposal_edit_object(p->'activity', ARRAY['type','completion'])
    OR jsonb_typeof(p->'activity'->'type') IS DISTINCT FROM 'string'
    OR NOT coalesce(p->'activity'->>'type' IN ('learning','skill','production','physical','maintenance','reflection'), false)
    OR NOT public.proposal_edit_number(p->'activity'->'completion',0,1)
    OR NOT public.proposal_edit_object(p->'difficulty', ARRAY['complexity','uncertainty','expertise_gap','resistance'])
    OR NOT public.proposal_edit_object(p->'growth', ARRAY['effort','learning','performance','outcome','artifact_value','character_evidence']) THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  FOR obj IN SELECT value FROM jsonb_each(jsonb_build_object('difficulty',p->'difficulty','growth',p->'growth')) LOOP
    FOR item IN SELECT value FROM jsonb_each(obj) LOOP
      IF NOT public.proposal_edit_number(item,0,1) THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
    END LOOP;
  END LOOP;
  IF NOT public.proposal_edit_object(p->'evidence', ARRAY['level','explanation'])
    OR NOT public.proposal_edit_number(p->'evidence'->'level',0,6,true)
    OR jsonb_typeof(p->'evidence'->'explanation') IS DISTINCT FROM 'string'
    OR NOT public.proposal_edit_number(p->'confidence',0,1) THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['affected_skills','mastery_changes','uncertainty_notes'] LOOP
    IF jsonb_typeof(p->k) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'affected_skills') LOOP
    IF NOT public.proposal_edit_object(item,ARRAY['name','reason']) OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'reason') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'uncertainty_notes') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF NOT public.proposal_edit_object(p->'knowledge_updates',ARRAY['proposed_nodes','proposed_edges'])
    OR jsonb_typeof(p->'knowledge_updates'->'proposed_nodes') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'knowledge_updates'->'proposed_edges') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'knowledge_updates'->'proposed_nodes') LOOP
    IF NOT public.proposal_edit_object(item,ARRAY['title'],ARRAY['domain']) OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string'
      OR (item ? 'domain' AND jsonb_typeof(item->'domain') IS DISTINCT FROM 'string') THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'knowledge_updates'->'proposed_edges') LOOP
    IF NOT public.proposal_edit_object(item,ARRAY['source','target','relation']) OR jsonb_typeof(item->'source') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'target') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'relation') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'mastery_changes') LOOP
    IF NOT public.proposal_edit_object(item,ARRAY['target_type','target_name','from_level','proposed_level','confidence','verification_required','reason'])
      OR jsonb_typeof(item->'target_type') IS DISTINCT FROM 'string'
      OR NOT coalesce(item->>'target_type' IN ('skill','knowledge'),false)
      OR jsonb_typeof(item->'target_name') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'reason') IS DISTINCT FROM 'string'
      OR NOT public.proposal_edit_number(item->'from_level',0,10,true) OR NOT public.proposal_edit_number(item->'proposed_level',0,10,true)
      OR NOT public.proposal_edit_number(item->'confidence',0,1) OR jsonb_typeof(item->'verification_required') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF NOT public.proposal_edit_object(p->'xp_semantics',ARRAY['base_value','difficulty','mastery_gain','novelty','goal_alignment','repetition_risk'])
    OR NOT public.proposal_edit_number(p->'xp_semantics'->'base_value',1,100)
    OR jsonb_typeof(p->'xp_semantics'->'repetition_risk') IS DISTINCT FROM 'string'
    OR NOT coalesce(p->'xp_semantics'->>'repetition_risk' IN ('low','medium','high'),false) THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['difficulty','mastery_gain','novelty','goal_alignment'] LOOP
    IF NOT public.proposal_edit_number(p->'xp_semantics'->k,0,1) THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF jsonb_typeof(p->'next_quest') IS DISTINCT FROM 'null' THEN
    IF NOT public.proposal_edit_object(p->'next_quest',ARRAY['title','reason']) OR jsonb_typeof(p->'next_quest'->'title') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p->'next_quest'->'reason') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p ? 'artifacts' THEN
    IF jsonb_typeof(p->'artifacts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p->'artifacts') LOOP
      IF NOT public.proposal_edit_object(item,ARRAY['title','type'],ARRAY['confirmed_existing'])
        OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'type') IS DISTINCT FROM 'string'
        OR (item ? 'confirmed_existing' AND jsonb_typeof(item->'confirmed_existing') IS DISTINCT FROM 'boolean') THEN
        RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF p ? 'artifactProposals' THEN
    IF jsonb_typeof(p->'artifactProposals') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p->'artifactProposals') LOOP
      IF NOT public.proposal_edit_object(item,ARRAY['title','artifactType'],ARRAY['summary','description','version','externalUrl','storagePath','reusabilityScore','metadata','skillIds','knowledgeNodeIds','questIds'])
        OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR length(item->>'title') < 1
        OR jsonb_typeof(item->'artifactType') IS DISTINCT FROM 'string'
        OR NOT coalesce(item->>'artifactType' IN ('document','code_repository','design_spec','data_analysis','presentation','synthesis_note','creative_work','other'),false) THEN
        RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
      END IF;
      FOREACH k IN ARRAY ARRAY['summary','description','version','externalUrl','storagePath'] LOOP
        IF item ? k AND jsonb_typeof(item->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
      END LOOP;
      IF (item ? 'metadata' AND jsonb_typeof(item->'metadata') IS DISTINCT FROM 'object')
        OR (item ? 'reusabilityScore' AND NOT public.proposal_edit_number(item->'reusabilityScore',0,1)) THEN
        RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
      END IF;
      FOREACH k IN ARRAY ARRAY['skillIds','knowledgeNodeIds','questIds'] LOOP
        IF item ? k THEN
          IF jsonb_typeof(item->k) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
          IF EXISTS (SELECT 1 FROM jsonb_array_elements(item->k) v WHERE jsonb_typeof(v.value) IS DISTINCT FROM 'string') THEN
            RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
END;
$$;

CREATE FUNCTION public.proposal_edit_request_write_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE role_name text := current_setting('role', true);
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' OR role_name NOT IN ('authenticated','service_role')
    OR (role_name = 'authenticated' AND (auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid())) THEN
    RAISE EXCEPTION 'PROPOSAL_EDIT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF role_name IS DISTINCT FROM 'authenticated' OR NEW.status IS DISTINCT FROM 'in_progress'
      OR NEW.failure IS NOT NULL OR NEW.revision_id IS NOT NULL
      OR NEW.facts IS DISTINCT FROM public.proposal_edit_canonical_facts(NEW.facts)
      OR NOT EXISTS (SELECT 1 FROM public.ai_assessments a JOIN public.activities v ON v.id = a.activity_id
        WHERE a.user_id = NEW.user_id AND a.id = NEW.base_assessment_id AND a.activity_id = NEW.activity_id
          AND v.user_id = NEW.user_id AND a.status = 'pending' AND v.status <> 'confirmed' AND a.rules_version = v.rules_version) THEN
      RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF (NEW.user_id, NEW.request_id, NEW.activity_id, NEW.base_assessment_id, NEW.facts, NEW.created_at, NEW.expires_at)
      IS DISTINCT FROM (OLD.user_id, OLD.request_id, OLD.activity_id, OLD.base_assessment_id, OLD.facts, OLD.created_at, OLD.expires_at)
      OR OLD.status IS DISTINCT FROM 'in_progress' OR NEW.status = 'in_progress'
      OR (role_name = 'authenticated' AND NEW.status IS DISTINCT FROM 'expired') THEN
      RAISE EXCEPTION 'PROPOSAL_EDIT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF (NEW.status = 'expired' AND OLD.expires_at > clock_timestamp())
      OR (NEW.status IN ('failed','completed') AND OLD.expires_at <= clock_timestamp())
      OR (NEW.status = 'completed' AND NOT EXISTS (SELECT 1 FROM public.proposal_fact_revisions r
        WHERE r.id = NEW.revision_id AND r.user_id = NEW.user_id AND r.request_id = NEW.request_id
          AND r.activity_id = NEW.activity_id AND r.base_assessment_id = NEW.base_assessment_id)) THEN
      RAISE EXCEPTION 'PROPOSAL_EDIT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proposal_edit_request_write_guard BEFORE INSERT OR UPDATE ON public.proposal_fact_edit_requests
  FOR EACH ROW EXECUTE FUNCTION public.proposal_edit_request_write_guard();

CREATE FUNCTION public.proposal_edit_revision_insert_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE request_row public.proposal_fact_edit_requests; old_row public.ai_assessments;
  new_row public.ai_assessments; activity_row public.activities; previous public.proposal_fact_revisions;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' OR current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'PROPOSAL_EDIT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO request_row FROM public.proposal_fact_edit_requests WHERE user_id = NEW.user_id AND request_id = NEW.request_id;
  SELECT * INTO old_row FROM public.ai_assessments WHERE user_id = NEW.user_id AND id = NEW.base_assessment_id;
  SELECT * INTO new_row FROM public.ai_assessments WHERE user_id = NEW.user_id AND id = NEW.result_assessment_id;
  SELECT * INTO activity_row FROM public.activities WHERE user_id = NEW.user_id AND id = NEW.activity_id;
  SELECT * INTO previous FROM public.proposal_fact_revisions WHERE user_id = NEW.user_id AND result_assessment_id = NEW.base_assessment_id;
  IF request_row.request_id IS NULL OR old_row.id IS NULL OR new_row.id IS NULL OR activity_row.id IS NULL
    OR request_row.activity_id IS DISTINCT FROM NEW.activity_id OR request_row.base_assessment_id IS DISTINCT FROM NEW.base_assessment_id
    OR request_row.status IS DISTINCT FROM 'in_progress' OR request_row.revision_id IS NOT NULL
    OR request_row.expires_at <= clock_timestamp() OR NEW.created_at < request_row.created_at OR NEW.created_at >= request_row.expires_at
    OR old_row.activity_id IS DISTINCT FROM NEW.activity_id OR new_row.activity_id IS DISTINCT FROM NEW.activity_id
    OR old_row.status IS DISTINCT FROM 'superseded' OR new_row.status IS DISTINCT FROM 'pending' OR activity_row.status = 'confirmed'
    OR NEW.rules_version IS DISTINCT FROM activity_row.rules_version OR old_row.rules_version IS DISTINCT FROM NEW.rules_version
    OR new_row.rules_version IS DISTINCT FROM NEW.rules_version OR NOT public.proposal_edit_label(NEW.rules_version)
    OR NEW.prompt_version IS DISTINCT FROM 'activity-evaluator-v0.4-facts' OR new_row.prompt_version IS DISTINCT FROM NEW.prompt_version
    OR NOT public.proposal_edit_label(new_row.model_name) OR new_row.created_at IS DISTINCT FROM NEW.created_at
    OR new_row.confidence IS DISTINCT FROM (new_row.assessment_json->>'confidence')::numeric
    OR previous.id IS DISTINCT FROM NEW.previous_revision_id
    OR (previous.id IS NULL AND EXISTS (SELECT 1 FROM public.proposal_fact_revisions r WHERE r.user_id = NEW.user_id AND r.activity_id = NEW.activity_id))
    OR (previous.id IS NOT NULL AND EXISTS (SELECT 1 FROM public.proposal_fact_revisions r WHERE r.user_id = NEW.user_id AND r.previous_revision_id = previous.id)) THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  PERFORM public.proposal_edit_validate_proposal(new_row.assessment_json);
  RETURN NEW;
END;
$$;
CREATE TRIGGER proposal_edit_revision_insert_guard BEFORE INSERT ON public.proposal_fact_revisions
  FOR EACH ROW EXECUTE FUNCTION public.proposal_edit_revision_insert_guard();

-- Real parent absence, not an RLS-hidden foreign row, is the only deletion exception.
CREATE FUNCTION public.proposal_edit_delete_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id)
      OR NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.user_id = OLD.user_id AND a.id = OLD.activity_id) THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'PROPOSAL_EDIT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER proposal_edit_request_delete_guard BEFORE DELETE ON public.proposal_fact_edit_requests
  FOR EACH ROW EXECUTE FUNCTION public.proposal_edit_delete_guard();
CREATE TRIGGER proposal_edit_request_truncate_guard BEFORE TRUNCATE ON public.proposal_fact_edit_requests
  FOR EACH STATEMENT EXECUTE FUNCTION public.proposal_edit_delete_guard();
CREATE TRIGGER proposal_edit_revision_change_guard BEFORE UPDATE OR DELETE ON public.proposal_fact_revisions
  FOR EACH ROW EXECUTE FUNCTION public.proposal_edit_delete_guard();
CREATE TRIGGER proposal_edit_revision_truncate_guard BEFORE TRUNCATE ON public.proposal_fact_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION public.proposal_edit_delete_guard();

CREATE FUNCTION public.proposal_edit_receipt(p_owner uuid, p_request uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE r public.proposal_fact_edit_requests; v public.proposal_fact_revisions; a public.ai_assessments;
  completion jsonb; result jsonb;
BEGIN
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = p_owner AND request_id = p_request;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF r.status = 'completed' THEN
    SELECT * INTO v FROM public.proposal_fact_revisions WHERE user_id = p_owner AND id = r.revision_id
      AND request_id = r.request_id AND activity_id = r.activity_id AND base_assessment_id = r.base_assessment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_RECEIPT' USING ERRCODE = 'P0001'; END IF;
    SELECT * INTO a FROM public.ai_assessments WHERE user_id = p_owner AND id = v.result_assessment_id AND activity_id = r.activity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_RECEIPT' USING ERRCODE = 'P0001'; END IF;
    completion := jsonb_build_object('revisionId',v.id,'previousRevisionId',v.previous_revision_id,'createdAt',v.created_at,
      'assessment',jsonb_build_object('userId',a.user_id,'id',a.id,'activityId',a.activity_id,'status',a.status,
        'proposal',a.assessment_json,'modelName',a.model_name,'promptVersion',a.prompt_version,'rulesVersion',a.rules_version,
        'confidence',a.confidence,'createdAt',a.created_at,'confirmedAt',a.confirmed_at));
  END IF;
  result := jsonb_build_object('userId',r.user_id,'requestId',r.request_id,'activityId',r.activity_id,'baseAssessmentId',r.base_assessment_id,
    'facts',r.facts,'status',r.status,'createdAt',r.created_at,'expiresAt',r.expires_at,'failure',r.failure,'completion',completion);
  IF octet_length(result::text) > 131072 THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_RECEIPT' USING ERRCODE = 'P0001'; END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.rpc_begin_proposal_fact_edit(p_assessment_id uuid, p_request_id uuid, p_facts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE u uuid := auth.uid(); canonical jsonb; a public.ai_assessments; v public.activities;
  r public.proposal_fact_edit_requests; previous public.proposal_fact_revisions; started timestamptz;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR u IS NULL THEN
    RAISE EXCEPTION 'PROPOSAL_EDIT_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_assessment_id IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
  canonical := public.proposal_edit_canonical_facts(p_facts);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('proposal-edit-request-v1|' || u::text || '|' || p_request_id::text,0));
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = u AND request_id = p_request_id;
  IF FOUND THEN
    IF r.base_assessment_id IS DISTINCT FROM p_assessment_id OR r.facts IS DISTINCT FROM canonical THEN
      RAISE EXCEPTION 'PROPOSAL_EDIT_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('dispatch',false,'request',public.proposal_edit_receipt(u,p_request_id));
  END IF;
  SELECT * INTO a FROM public.ai_assessments WHERE user_id = u AND id = p_assessment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.proposal_edit_activity_gate(u,a.activity_id);
  SELECT * INTO a FROM public.ai_assessments WHERE user_id = u AND id = p_assessment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v FROM public.activities WHERE user_id = u AND id = a.activity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO previous FROM public.proposal_fact_revisions WHERE user_id = u AND result_assessment_id = a.id;
  IF a.status IS DISTINCT FROM 'pending' OR v.status = 'confirmed' OR a.rules_version IS DISTINCT FROM v.rules_version
    OR NOT public.proposal_edit_label(v.rules_version)
    OR EXISTS (SELECT 1 FROM public.xp_transactions x WHERE x.activity_id = v.id AND x.xp_type = 'activity')
    OR (previous.id IS NULL AND EXISTS (SELECT 1 FROM public.proposal_fact_revisions h WHERE h.user_id = u AND h.activity_id = v.id))
    OR (previous.id IS NOT NULL AND EXISTS (SELECT 1 FROM public.proposal_fact_revisions h WHERE h.user_id = u AND h.previous_revision_id = previous.id)) THEN
    RAISE EXCEPTION 'PROPOSAL_EDIT_CONFLICT' USING ERRCODE = '55000';
  END IF;
  IF NOT public.proposal_edit_skills_active(u,canonical) THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  started := clock_timestamp();
  UPDATE public.proposal_fact_edit_requests SET status = 'expired', failure = 'EXPIRED'
    WHERE user_id = u AND activity_id = v.id AND status = 'in_progress' AND expires_at <= started;
  IF EXISTS (SELECT 1 FROM public.proposal_fact_edit_requests WHERE user_id = u AND activity_id = v.id AND status = 'in_progress') THEN
    RAISE EXCEPTION 'PROPOSAL_EDIT_CONFLICT' USING ERRCODE = '55000';
  END IF;
  INSERT INTO public.proposal_fact_edit_requests(user_id,request_id,activity_id,base_assessment_id,facts,created_at,expires_at)
    VALUES(u,p_request_id,v.id,a.id,canonical,started,started + interval '180 seconds');
  RETURN jsonb_build_object('dispatch',true,'request',public.proposal_edit_receipt(u,p_request_id));
END;
$$;

CREATE FUNCTION public.rpc_complete_proposal_fact_edit(p_user_id uuid, p_assessment_id uuid, p_request_id uuid,
  p_proposal jsonb, p_model_name text, p_prompt_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.proposal_fact_edit_requests; a public.ai_assessments; v public.activities;
  previous public.proposal_fact_revisions; new_id uuid; v_revision_id uuid; completed_at timestamptz;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'PROPOSAL_EDIT_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL OR p_assessment_id IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('proposal-edit-request-v1|' || p_user_id::text || '|' || p_request_id::text,0));
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = p_user_id AND request_id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF r.base_assessment_id IS DISTINCT FROM p_assessment_id THEN RAISE EXCEPTION 'PROPOSAL_EDIT_CONFLICT' USING ERRCODE = '23505'; END IF;
  IF r.status <> 'in_progress' THEN RETURN public.proposal_edit_receipt(p_user_id,p_request_id); END IF;
  PERFORM public.proposal_edit_activity_gate(p_user_id,r.activity_id);
  SELECT * INTO a FROM public.ai_assessments WHERE user_id = p_user_id AND id = p_assessment_id FOR UPDATE;
  SELECT * INTO v FROM public.activities WHERE user_id = p_user_id AND id = r.activity_id FOR UPDATE;
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF r.status <> 'in_progress' THEN RETURN public.proposal_edit_receipt(p_user_id,p_request_id); END IF;
  IF r.expires_at <= clock_timestamp() THEN
    UPDATE public.proposal_fact_edit_requests SET status = 'expired', failure = 'EXPIRED' WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN public.proposal_edit_receipt(p_user_id,p_request_id);
  END IF;
  SELECT * INTO previous FROM public.proposal_fact_revisions WHERE user_id = p_user_id AND result_assessment_id = a.id;
  IF a.id IS NULL OR v.id IS NULL OR a.activity_id IS DISTINCT FROM r.activity_id OR a.status IS DISTINCT FROM 'pending' OR v.status = 'confirmed'
    OR a.rules_version IS DISTINCT FROM v.rules_version OR NOT public.proposal_edit_label(v.rules_version)
    OR EXISTS (SELECT 1 FROM public.xp_transactions x WHERE x.activity_id = v.id AND x.xp_type = 'activity')
    OR (previous.id IS NULL AND EXISTS (SELECT 1 FROM public.proposal_fact_revisions h WHERE h.user_id = p_user_id AND h.activity_id = v.id))
    OR (previous.id IS NOT NULL AND EXISTS (SELECT 1 FROM public.proposal_fact_revisions h WHERE h.user_id = p_user_id AND h.previous_revision_id = previous.id))
    OR NOT public.proposal_edit_skills_active(p_user_id,r.facts) THEN
    UPDATE public.proposal_fact_edit_requests SET status = 'conflict', failure = 'CONFLICT' WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN public.proposal_edit_receipt(p_user_id,p_request_id);
  END IF;
  IF NOT public.proposal_edit_label(p_model_name) OR p_prompt_version IS DISTINCT FROM 'activity-evaluator-v0.4-facts' THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  PERFORM public.proposal_edit_validate_proposal(p_proposal);
  completed_at := clock_timestamp();
  IF r.expires_at <= completed_at THEN
    UPDATE public.proposal_fact_edit_requests SET status = 'expired', failure = 'EXPIRED' WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN public.proposal_edit_receipt(p_user_id,p_request_id);
  END IF;
  INSERT INTO public.ai_assessments(user_id,activity_id,rules_version,prompt_version,model_name,assessment_json,confidence,created_at,updated_at)
    VALUES(p_user_id,v.id,v.rules_version,p_prompt_version,p_model_name,p_proposal,(p_proposal->>'confidence')::numeric,completed_at,completed_at)
    RETURNING id INTO new_id;
  UPDATE public.ai_assessments SET status = 'superseded', updated_at = completed_at
    WHERE user_id = p_user_id AND activity_id = v.id AND status = 'pending' AND id <> new_id;
  INSERT INTO public.proposal_fact_revisions(user_id,request_id,activity_id,base_assessment_id,result_assessment_id,previous_revision_id,rules_version,prompt_version,created_at)
    VALUES(p_user_id,p_request_id,v.id,a.id,new_id,previous.id,v.rules_version,p_prompt_version,completed_at) RETURNING id INTO v_revision_id;
  UPDATE public.proposal_fact_edit_requests SET status = 'completed', revision_id = v_revision_id
    WHERE user_id = p_user_id AND request_id = p_request_id;
  RETURN public.proposal_edit_receipt(p_user_id,p_request_id);
END;
$$;

CREATE FUNCTION public.rpc_fail_proposal_fact_edit(p_user_id uuid, p_assessment_id uuid, p_request_id uuid, p_failure text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.proposal_fact_edit_requests; a public.ai_assessments; v public.activities; next_status text; next_failure text;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'PROPOSAL_EDIT_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL OR p_assessment_id IS NULL OR p_request_id IS NULL OR p_failure IS DISTINCT FROM 'AI_UNAVAILABLE' THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('proposal-edit-request-v1|' || p_user_id::text || '|' || p_request_id::text,0));
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = p_user_id AND request_id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF r.base_assessment_id IS DISTINCT FROM p_assessment_id THEN RAISE EXCEPTION 'PROPOSAL_EDIT_CONFLICT' USING ERRCODE = '23505'; END IF;
  IF r.status <> 'in_progress' THEN RETURN public.proposal_edit_receipt(p_user_id,p_request_id); END IF;
  PERFORM public.proposal_edit_activity_gate(p_user_id,r.activity_id);
  SELECT * INTO a FROM public.ai_assessments WHERE user_id = p_user_id AND id = p_assessment_id FOR UPDATE;
  SELECT * INTO v FROM public.activities WHERE user_id = p_user_id AND id = r.activity_id FOR UPDATE;
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF r.status <> 'in_progress' THEN RETURN public.proposal_edit_receipt(p_user_id,p_request_id); END IF;
  IF r.expires_at <= clock_timestamp() THEN next_status := 'expired'; next_failure := 'EXPIRED';
  ELSIF a.id IS NULL OR v.id IS NULL OR a.status IS DISTINCT FROM 'pending' OR v.status = 'confirmed' THEN next_status := 'conflict'; next_failure := 'CONFLICT';
  ELSE next_status := 'failed'; next_failure := 'AI_UNAVAILABLE'; END IF;
  UPDATE public.proposal_fact_edit_requests SET status = next_status, failure = next_failure
    WHERE user_id = p_user_id AND request_id = p_request_id;
  RETURN public.proposal_edit_receipt(p_user_id,p_request_id);
END;
$$;

-- Read RPC deliberately INVOKER: all request/revision/assessment reads use actual RLS.
-- Its inline projection matches the private receipt helper, but grants no helper EXECUTE.
CREATE FUNCTION public.rpc_read_proposal_fact_edit(p_assessment_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE u uuid := auth.uid(); r public.proposal_fact_edit_requests; v public.proposal_fact_revisions; a public.ai_assessments;
  completion jsonb; result jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR u IS NULL THEN RAISE EXCEPTION 'PROPOSAL_EDIT_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_assessment_id IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023'; END IF;
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = u AND request_id = p_request_id AND base_assessment_id = p_assessment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_EDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF r.status = 'completed' THEN
    SELECT * INTO v FROM public.proposal_fact_revisions WHERE user_id = u AND id = r.revision_id
      AND request_id = r.request_id AND activity_id = r.activity_id AND base_assessment_id = r.base_assessment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_RECEIPT' USING ERRCODE = 'P0001'; END IF;
    SELECT * INTO a FROM public.ai_assessments WHERE user_id = u AND id = v.result_assessment_id AND activity_id = r.activity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_RECEIPT' USING ERRCODE = 'P0001'; END IF;
    completion := jsonb_build_object('revisionId',v.id,'previousRevisionId',v.previous_revision_id,'createdAt',v.created_at,
      'assessment',jsonb_build_object('userId',a.user_id,'id',a.id,'activityId',a.activity_id,'status',a.status,
        'proposal',a.assessment_json,'modelName',a.model_name,'promptVersion',a.prompt_version,'rulesVersion',a.rules_version,
        'confidence',a.confidence,'createdAt',a.created_at,'confirmedAt',a.confirmed_at));
  END IF;
  result := jsonb_build_object('userId',r.user_id,'requestId',r.request_id,'activityId',r.activity_id,'baseAssessmentId',r.base_assessment_id,
    'facts',r.facts,'status',r.status,'createdAt',r.created_at,'expiresAt',r.expires_at,'failure',r.failure,'completion',completion);
  IF octet_length(result::text) > 131072 THEN RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_RECEIPT' USING ERRCODE = 'P0001'; END IF;
  RETURN result;
END;
$$;

DO $$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'proposal_edit_activity_gate(uuid,uuid)', 'proposal_edit_object(jsonb,text[],text[])',
    'proposal_edit_number(jsonb,numeric,numeric,boolean)', 'proposal_edit_label(text)',
    'proposal_edit_canonical_facts(jsonb)', 'proposal_edit_skills_active(uuid,jsonb)',
    'proposal_edit_validate_proposal(jsonb)', 'proposal_edit_request_write_guard()',
    'proposal_edit_revision_insert_guard()', 'proposal_edit_delete_guard()', 'proposal_edit_receipt(uuid,uuid)',
    'rpc_begin_proposal_fact_edit(uuid,uuid,jsonb)', 'rpc_read_proposal_fact_edit(uuid,uuid)',
    'rpc_complete_proposal_fact_edit(uuid,uuid,uuid,jsonb,text,text)', 'rpc_fail_proposal_fact_edit(uuid,uuid,uuid,text)'
  ] LOOP
    EXECUTE 'ALTER FUNCTION public.' || signature || ' OWNER TO postgres';
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || signature || ' FROM PUBLIC, anon, authenticated, service_role';
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_begin_proposal_fact_edit(uuid,uuid,jsonb), public.rpc_read_proposal_fact_edit(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_complete_proposal_fact_edit(uuid,uuid,uuid,jsonb,text,text), public.rpc_fail_proposal_fact_edit(uuid,uuid,uuid,text) TO service_role;

-- IEEE double projection matches JSON.parse/Math.round, including 0.145*100.
-- Do not use decimal round(completion*100): it can disagree with the frozen TS.
CREATE FUNCTION public.proposal_edit_quest_delta(p_completion jsonb, p_minutes jsonb)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE scaled double precision; whole double precision;
BEGIN
  IF NOT public.proposal_edit_number(p_completion,0,1)
    OR (jsonb_typeof(p_minutes) IS DISTINCT FROM 'null' AND NOT public.proposal_edit_number(p_minutes,0,1440,true)) THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_EDIT_INPUT' USING ERRCODE = '22023';
  END IF;
  IF (p_completion #>> '{}')::double precision > 0 THEN scaled := (p_completion #>> '{}')::double precision * 100;
  ELSIF (p_minutes #>> '{}')::integer > 0 THEN scaled := (p_minutes #>> '{}')::double precision / 2;
  ELSE RETURN 20; END IF;
  whole := floor(scaled);
  RETURN least(100,greatest(5,(whole + CASE WHEN scaled - whole >= 0.5 THEN 1 ELSE 0 END)::integer));
END;
$$;

CREATE FUNCTION public.proposal_edit_settlement_guard(p_owner uuid, p_assessment public.ai_assessments,
  p_activity public.activities, p_settlement jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v public.proposal_fact_revisions; r public.proposal_fact_edit_requests; modifier jsonb := p_settlement->'transaction'->'modifierJson';
BEGIN
  SELECT * INTO v FROM public.proposal_fact_revisions WHERE user_id = p_owner AND result_assessment_id = p_assessment.id;
  IF NOT FOUND THEN
    IF p_settlement ? 'factRevisionId' OR p_settlement ? 'factEffectiveMinutes'
      OR modifier ? 'factRevisionId' OR modifier ? 'factEffectiveMinutes' THEN RETURN 'fact_revision_mismatch'; END IF;
    RETURN NULL;
  END IF;
  SELECT * INTO r FROM public.proposal_fact_edit_requests WHERE user_id = p_owner AND request_id = v.request_id;
  IF NOT FOUND OR r.status IS DISTINCT FROM 'completed' OR r.revision_id IS DISTINCT FROM v.id
    OR v.activity_id IS DISTINCT FROM p_activity.id OR r.activity_id IS DISTINCT FROM p_activity.id
    OR p_assessment.activity_id IS DISTINCT FROM p_activity.id OR p_assessment.user_id IS DISTINCT FROM p_owner
    OR p_activity.user_id IS DISTINCT FROM p_owner OR r.base_assessment_id IS DISTINCT FROM v.base_assessment_id
    OR v.rules_version IS DISTINCT FROM p_activity.rules_version OR p_assessment.rules_version IS DISTINCT FROM v.rules_version
    OR p_settlement->'factRevisionId' IS DISTINCT FROM to_jsonb(v.id)
    OR p_settlement->'factEffectiveMinutes' IS DISTINCT FROM r.facts->'effectiveMinutes'
    OR jsonb_typeof(modifier) IS DISTINCT FROM 'object'
    OR modifier->'factRevisionId' IS DISTINCT FROM to_jsonb(v.id)
    OR modifier->'factEffectiveMinutes' IS DISTINCT FROM r.facts->'effectiveMinutes' THEN RETURN 'fact_revision_mismatch'; END IF;
  IF p_activity.quest_id IS NOT NULL THEN
    IF jsonb_typeof(p_settlement->'questProgressDelta') IS DISTINCT FROM 'number'
      OR p_settlement->'questProgressDelta' IS DISTINCT FROM to_jsonb(public.proposal_edit_quest_delta(
        p_assessment.assessment_json->'activity'->'completion',r.facts->'effectiveMinutes')) THEN RETURN 'fact_quest_progress_mismatch'; END IF;
  ELSIF p_settlement ? 'questProgressDelta' THEN RETURN 'fact_quest_progress_mismatch'; END IF;
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.proposal_edit_quest_delta(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.proposal_edit_settlement_guard(uuid,public.ai_assessments,public.activities,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.proposal_edit_quest_delta(jsonb,jsonb),
  public.proposal_edit_settlement_guard(uuid,public.ai_assessments,public.activities,jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- The two admitted old-function replacements follow below, with reversible additions only.

create or replace function public.record_ai_assessment(
  p_user_id uuid,
  p_activity_id uuid,
  p_assessment_json jsonb,
  p_model_name text,
  p_prompt_version text,
  p_confidence numeric
)
returns public.ai_assessments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity public.activities;
  v_assessment public.ai_assessments;
begin
  -- BEGIN PROPOSAL_EDIT_GATE_RECORD
  PERFORM public.proposal_edit_activity_gate(p_user_id,p_activity_id);
  -- END PROPOSAL_EDIT_GATE_RECORD
  select * into v_activity
  from public.activities
  where id = p_activity_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'activity_not_found_or_not_owned' using errcode = 'P0002';
  end if;

  if v_activity.status = 'confirmed' then
    raise exception 'activity_already_settled' using errcode = '55000';
  end if;

  -- BEGIN PROPOSAL_EDIT_LEGACY_GUARD
  IF EXISTS (SELECT 1 FROM public.proposal_fact_edit_requests r WHERE r.user_id = p_user_id
      AND r.activity_id = p_activity_id AND r.status = 'in_progress' AND r.expires_at > clock_timestamp())
    OR EXISTS (SELECT 1 FROM public.proposal_fact_revisions r WHERE r.user_id = p_user_id AND r.activity_id = p_activity_id) THEN
    RAISE EXCEPTION 'PROPOSAL_EDIT_CONFLICT' USING ERRCODE = '55000';
  END IF;
  -- END PROPOSAL_EDIT_LEGACY_GUARD
  insert into public.ai_assessments (
    user_id,
    activity_id,
    rules_version,
    assessment_json,
    model_name,
    prompt_version,
    confidence
  ) values (
    p_user_id,
    v_activity.id,
    v_activity.rules_version,
    p_assessment_json,
    p_model_name,
    p_prompt_version,
    p_confidence
  ) returning * into v_assessment;

  update public.activities
  set status = 'assessed', updated_at = now()
  where id = v_activity.id;

  return v_assessment;
end;
$$;
ALTER FUNCTION public.record_ai_assessment(uuid,uuid,jsonb,text,text,numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_ai_assessment(uuid,uuid,jsonb,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_assessment(uuid,uuid,jsonb,text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_activity(
  p_user_id uuid,
  p_settlement jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- BEGIN PROPOSAL_EDIT_DECLARATION
  v_proposal_edit_reason text;
  -- END PROPOSAL_EDIT_DECLARATION
  v_assessment_id uuid;
  v_xp_delta integer;
  v_activity_id uuid;
  v_skill_name text;
  v_normalized_skill_name text;
  v_skill_resolution_type text;
  v_skill_id uuid;
  v_skill_row public.skills;
  v_skill_is_new boolean := false;
  v_current_mastery integer;
  v_mastery_action text;
  v_proposed_level integer;
  v_confidence numeric;
  v_from_level integer;
  v_to_level integer;
  v_evidence_id uuid;
  v_evidence_level integer;
  v_evidence_explanation text;
  v_evidence_type text;
  v_repetition_count integer;
  v_activity_type text;
  v_authoritative_count integer;
  v_now timestamptz;
  v_tx jsonb;
  v_transaction_id uuid;
  v_amount integer;
  v_base_amount integer;
  v_rules_version text;
  v_reason text;
  v_modifier jsonb;
  v_penalty numeric;
  v_xp_type text;
  v_tx_row public.xp_transactions;
  v_existing_pending public.mastery_verifications;
  v_verification jsonb := null;
  v_rel_item jsonb;
  v_rel_res_type text;
  v_rel_proposed_name text;
  v_rel_skill_id uuid;
  v_rel_existing_id uuid;
  v_assessment public.ai_assessments;
  v_activity public.activities;
  v_primary_skill_xp_delta numeric;
  v_settlement_xp_delta integer;
  v_primary_skill_name text;
  v_quest public.quests;
  v_quest_progress_advance numeric;
  v_new_quest_progress numeric;

  -- Stage 7B Artifact resolution variables
  v_stored_proposals jsonb;
  v_proposal_count integer := 0;
  v_resolutions jsonb;
  v_res_count integer := 0;
  v_res_item jsonb;
  v_res_idx integer;
  v_res_type text;
  v_prop_item jsonb;
  v_art_title text;
  v_art_norm_title text;
  v_art_type text;
  v_art_summary text;
  v_art_description text;
  v_art_version text;
  v_art_storage_path text;
  v_art_external_url text;
  v_art_reusability numeric;
  v_art_metadata jsonb;
  v_new_art_id uuid;
  v_existing_art_id uuid;
  v_art_role text;
  v_sid_text text;
  v_kid_text text;
  v_qid_text text;
  v_seen_indices integer[];
BEGIN
  -- ============================================================
  -- Phase A: Parse + validate canonical XP + parameters
  -- ============================================================
  v_assessment_id := (p_settlement->>'assessmentId')::uuid;
  v_tx := p_settlement->'transaction';
  v_amount := coalesce((v_tx->>'amount')::int, 0);

  v_settlement_xp_delta := coalesce((p_settlement->>'xpDelta')::int, v_amount);
  v_primary_skill_xp_delta := coalesce(
    (p_settlement->'primarySkill'->>'xpDelta')::numeric,
    v_amount
  );

  IF v_settlement_xp_delta <> v_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'xp_delta_mismatch');
  END IF;
  IF v_primary_skill_xp_delta <> v_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'skill_xp_delta_mismatch');
  END IF;
  IF v_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'negative_xp');
  END IF;

  v_xp_type := coalesce(nullif(v_tx->>'xpType', ''), 'activity');
  IF v_xp_type <> 'activity' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_xp_type_for_settle');
  END IF;

  v_xp_delta := v_amount;
  v_skill_name := coalesce(nullif(v_tx->>'skillName', ''), 'General Growth');
  v_primary_skill_name := coalesce(
    nullif(p_settlement->'primarySkill'->>'name', ''),
    v_skill_name
  );
  IF v_primary_skill_name <> v_skill_name THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'skill_name_mismatch');
  END IF;

  v_repetition_count := coalesce((v_tx->>'repetitionCount')::int, 0);
  v_activity_type := nullif(v_tx->>'activityType', '');
  v_transaction_id := coalesce((v_tx->>'id')::uuid, gen_random_uuid());
  v_base_amount := coalesce((v_tx->>'baseAmount')::int, 0);
  v_reason := v_tx->>'reason';
  v_modifier := coalesce(v_tx->'modifierJson', '{}'::jsonb);
  v_penalty := coalesce((v_tx->>'repetitionPenalty')::numeric, 1);

  -- ============================================================
  -- Phase B: Lock assessment + activity; ownership + idempotency
  -- ============================================================
  -- BEGIN PROPOSAL_EDIT_GATE_SETTLE
  PERFORM public.proposal_edit_activity_gate(a.user_id,a.activity_id)
    FROM public.ai_assessments a WHERE a.id = v_assessment_id;
  -- END PROPOSAL_EDIT_GATE_SETTLE
  SELECT * INTO v_assessment
  FROM public.ai_assessments
  WHERE id = v_assessment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_assessment.user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
  END IF;
  IF v_assessment.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_confirmed');
  END IF;

  v_activity_id := v_assessment.activity_id;
  SELECT * INTO v_activity
  FROM public.activities
  WHERE id = v_activity_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'activity_not_found');
  END IF;
  IF v_activity.user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
  END IF;
  IF v_activity.status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_settled');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE activity_id = v_activity_id AND xp_type = 'activity'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_settled');
  END IF;

  -- BEGIN PROPOSAL_EDIT_SETTLEMENT_RECEIPT
  v_proposal_edit_reason := public.proposal_edit_settlement_guard(p_user_id,v_assessment,v_activity,p_settlement);
  IF v_proposal_edit_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'reason',v_proposal_edit_reason);
  END IF;
  -- END PROPOSAL_EDIT_SETTLEMENT_RECEIPT
  -- ============================================================
  -- Phase C: Skill Resolution Authority (Strict Stable ID Union - NO BYPASS)
  -- ============================================================
  IF p_settlement->'primarySkill'->'skill' IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_or_invalid_skill_resolution');
  END IF;

  v_skill_resolution_type := p_settlement->'primarySkill'->'skill'->>'resolution';

  IF v_skill_resolution_type = 'existing' THEN
    -- Resolution: Existing stable skill UUID (Must exist and belong to tenant)
    v_skill_id := (p_settlement->'primarySkill'->'skill'->>'skillId')::uuid;
    IF v_skill_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_existing_skill_id');
    END IF;

    SELECT * INTO v_skill_row
    FROM public.skills
    WHERE id = v_skill_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'skill_not_found_or_not_owned');
    END IF;

    v_skill_name := v_skill_row.name;
    v_normalized_skill_name := v_skill_row.normalized_name;
    v_skill_is_new := false;

  ELSIF v_skill_resolution_type = 'create' THEN
    -- Resolution: User-confirmed new skill candidate (Empty name MUST REJECT)
    v_skill_name := btrim(coalesce(p_settlement->'primarySkill'->'skill'->>'proposedName', ''));
    IF v_skill_name = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'empty_proposed_skill_name');
    END IF;
    v_normalized_skill_name := regexp_replace(lower(v_skill_name), '\s+', ' ', 'g');

    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || '|' || v_normalized_skill_name));

    SELECT * INTO v_skill_row
    FROM public.skills
    WHERE user_id = p_user_id AND normalized_name = v_normalized_skill_name
    FOR UPDATE;

    IF FOUND THEN
      v_skill_id := v_skill_row.id;
      v_skill_name := v_skill_row.name;
      v_skill_is_new := false;
    ELSE
      v_skill_id := null;
      v_skill_is_new := true;
    END IF;

  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_or_invalid_skill_resolution');
  END IF;

  -- Phase C.2: Validate secondary skill resolutions if present
  IF p_settlement->'relatedSkillResolutions' IS NOT NULL AND jsonb_typeof(p_settlement->'relatedSkillResolutions') = 'array' THEN
    FOR v_rel_item IN SELECT * FROM jsonb_array_elements(p_settlement->'relatedSkillResolutions') LOOP
      v_rel_res_type := v_rel_item->>'resolution';
      IF v_rel_res_type = 'existing' THEN
        v_rel_skill_id := (v_rel_item->>'skillId')::uuid;
        IF v_rel_skill_id IS NULL THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_related_skill_id');
        END IF;
        SELECT id INTO v_rel_existing_id
        FROM public.skills
        WHERE id = v_rel_skill_id AND user_id = p_user_id;
        IF NOT FOUND THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'related_skill_not_found_or_not_owned');
        END IF;
      ELSIF v_rel_res_type = 'create' THEN
        v_rel_proposed_name := btrim(coalesce(v_rel_item->>'proposedName', ''));
        IF v_rel_proposed_name = '' THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'empty_related_skill_proposed_name');
        END IF;
      ELSE
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_related_skill_resolution');
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- Phase C.3: Stage 7B Artifact Resolution Authority & Coverage Validation
  -- ============================================================
  v_stored_proposals := coalesce(
    v_assessment.assessment_json->'proposal'->'artifactProposals',
    v_assessment.assessment_json->'artifactProposals',
    '[]'::jsonb
  );
  IF jsonb_typeof(v_stored_proposals) = 'array' THEN
    v_proposal_count := jsonb_array_length(v_stored_proposals);
  ELSE
    v_proposal_count := 0;
  END IF;

  v_resolutions := p_settlement->'artifactResolutions';

  IF v_proposal_count > 0 THEN
    IF v_resolutions IS NULL OR jsonb_typeof(v_resolutions) <> 'array' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'incomplete_proposal_coverage');
    END IF;

    v_res_count := jsonb_array_length(v_resolutions);
    IF v_res_count <> v_proposal_count THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'incomplete_proposal_coverage');
    END IF;

    v_seen_indices := ARRAY[]::integer[];

    FOR v_res_item IN SELECT * FROM jsonb_array_elements(v_resolutions) LOOP
      IF v_res_item->>'proposalIndex' IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'missing_proposal_index');
      END IF;

      BEGIN
        v_res_idx := (v_res_item->>'proposalIndex')::int;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_proposal_index');
      END;

      IF v_res_idx < 0 OR v_res_idx >= v_proposal_count THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'out_of_range_proposal_index');
      END IF;

      IF v_res_idx = ANY(v_seen_indices) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_proposal_index');
      END IF;

      v_seen_indices := array_append(v_seen_indices, v_res_idx);

      v_res_type := v_res_item->>'resolution';
      v_prop_item := v_stored_proposals->v_res_idx;

      IF v_res_type = 'create' THEN
        v_art_title := btrim(coalesce(
          v_res_item->'approvedOverrides'->>'title',
          v_prop_item->>'title',
          ''
        ));
        IF v_art_title = '' THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'empty_artifact_title');
        END IF;

        v_art_norm_title := regexp_replace(lower(v_art_title), '\s+', ' ', 'g');

        -- Advisory lock on normalized title to avoid race condition
        PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || '|art|' || v_art_norm_title));

        IF EXISTS (
          SELECT 1 FROM public.artifacts
          WHERE user_id = p_user_id AND normalized_title = v_art_norm_title
        ) THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'artifact_title_conflict');
        END IF;

      ELSIF v_res_type = 'existing' THEN
        BEGIN
          v_existing_art_id := (v_res_item->>'artifactId')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_existing_artifact_id');
        END;

        IF v_existing_art_id IS NULL THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_existing_artifact_id');
        END IF;

        PERFORM 1 FROM public.artifacts
        WHERE id = v_existing_art_id AND user_id = p_user_id;

        IF NOT FOUND THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'artifact_not_found_or_not_owned');
        END IF;

        v_art_role := coalesce(v_res_item->>'activityRole', 'modified');
        IF v_art_role NOT IN ('modified', 'referenced') THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_activity_role');
        END IF;

      ELSIF v_res_type = 'ignore' THEN
        -- Valid no-op
      ELSE
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_artifact_resolution');
      END IF;
    END LOOP;

  ELSE
    -- Zero stored proposals: resolutions must be omitted or empty
    IF v_resolutions IS NOT NULL AND jsonb_typeof(v_resolutions) = 'array' AND jsonb_array_length(v_resolutions) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unexpected_artifact_resolutions');
    END IF;
  END IF;

  v_current_mastery := coalesce(v_skill_row.mastery_level, 1);
  v_now := clock_timestamp();

  -- ============================================================
  -- Phase D: Evidence preparation (P2 Authority)
  -- ============================================================
  v_evidence_id := coalesce((p_settlement->'evidence'->>'id')::uuid, gen_random_uuid());
  v_evidence_level := coalesce((p_settlement->'evidence'->>'level')::int, (p_settlement->'masteryVerification'->>'evidenceLevel')::int, 1);
  v_evidence_explanation := coalesce(p_settlement->'evidence'->>'explanation', v_reason);
  v_evidence_type := coalesce(p_settlement->'evidence'->>'type', v_activity_type, 'activity_output');

  -- ============================================================
  -- Phase E: Repetition count derivation & check
  -- ============================================================
  IF v_skill_is_new THEN
    v_authoritative_count := 0;
  ELSE
    SELECT count(*)::int INTO v_authoritative_count
    FROM public.xp_transactions
    WHERE user_id = p_user_id
      AND skill_id = v_skill_id
      AND (v_activity_type IS NULL OR activity_type = v_activity_type)
      AND created_at >= v_now - interval '30 days'
      AND created_at <= v_now;
  END IF;

  IF v_authoritative_count <> v_repetition_count THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'repetition_conflict',
      'actualRepetitionCount', v_authoritative_count
    );
  END IF;

  -- ============================================================
  -- Phase F: Mastery staleness check (Preserving 3-State Protocol)
  -- ============================================================
  v_mastery_action := coalesce(p_settlement->'primarySkill'->'masteryAction'->>'action', 'none');

  IF v_mastery_action = 'upgrade' THEN
    v_proposed_level := (p_settlement->'primarySkill'->'masteryAction'->>'proposedLevel')::int;
    IF v_proposed_level <= v_current_mastery THEN
      v_mastery_action := 'none';
    END IF;
  ELSIF v_mastery_action = 'request_verification' THEN
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    IF v_to_level <= v_current_mastery THEN
      v_mastery_action := 'none';
    END IF;
  END IF;

  -- ============================================================
  -- Phase G: ALL checks passed — permanent writes begin
  -- ============================================================

  -- G.1) Create skill if new.
  IF v_skill_is_new THEN
    INSERT INTO public.skills (user_id, name)
    VALUES (p_user_id, v_skill_name)
    ON CONFLICT (user_id, normalized_name) DO UPDATE
      SET updated_at = public.skills.updated_at
    RETURNING * INTO v_skill_row;
    v_skill_id := v_skill_row.id;
  END IF;

  -- G.2) Ledger row (xp_transactions).
  v_rules_version := v_activity.rules_version;
  INSERT INTO public.xp_transactions (
    id, user_id, activity_id, assessment_id, skill_id, activity_type,
    repetition_count, repetition_penalty, xp_type, amount, base_amount,
    modifier_json, reason, rules_version, skill_name_snapshot, created_at
  ) VALUES (
    v_transaction_id, p_user_id, v_activity_id, v_assessment_id, v_skill_id,
    v_activity_type, v_repetition_count, v_penalty, v_xp_type,
    v_amount, v_base_amount, v_modifier, v_reason, v_rules_version,
    v_skill_name, v_now
  )
  RETURNING * INTO v_tx_row;

  -- G.3) Authoritative Evidence Persistence (Unified Stage 5A verified semantics)
  INSERT INTO public.evidence_records (
    id, user_id, activity_id, skill_id, evidence_level, evidence_type,
    description, verified, created_at
  ) VALUES (
    v_evidence_id, p_user_id, v_activity_id, v_skill_id, v_evidence_level,
    v_evidence_type, v_evidence_explanation, (v_mastery_action <> 'request_verification'), v_now
  );

  -- G.4) Player XP + Level recompute.
  UPDATE public.player_states
    SET total_xp = public.player_states.total_xp + v_xp_delta,
        player_level = public.player_level_from_xp(public.player_states.total_xp + v_xp_delta),
        updated_at = v_now
    WHERE user_id = p_user_id;

  -- G.5) Skill XP + Level recompute.
  UPDATE public.skills
    SET xp = public.skills.xp + v_xp_delta,
        level = public.player_level_from_xp(public.skills.xp + v_xp_delta),
        last_used_at = v_now,
        updated_at = v_now
    WHERE id = v_skill_id
    RETURNING * INTO v_skill_row;

  -- G.6) Mastery action handling (upgrade vs request_verification vs none).
  IF v_mastery_action = 'upgrade' THEN
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric,
      v_skill_row.mastery_confidence
    );
    UPDATE public.skills
      SET mastery_level = v_proposed_level,
          mastery_confidence = v_confidence,
          updated_at = v_now
      WHERE id = v_skill_id;

    INSERT INTO public.mastery_events (
      user_id, skill_id, activity_id, evidence_id, from_level, to_level,
      confidence, event_type, reason, created_at
    ) VALUES (
      p_user_id, v_skill_id, v_activity_id, v_evidence_id, v_current_mastery,
      v_proposed_level, v_confidence, 'upgrade', 'settle_activity', v_now
    );

  ELSIF v_mastery_action = 'request_verification' THEN
    v_from_level := v_current_mastery;
    v_to_level := (p_settlement->'primarySkill'->'masteryAction'->>'toLevel')::int;
    v_confidence := coalesce(
      (p_settlement->'primarySkill'->'masteryAction'->>'confidence')::numeric, 0.5
    );

    SELECT * INTO v_existing_pending
    FROM public.mastery_verifications
    WHERE user_id = p_user_id AND skill_id = v_skill_id AND status = 'pending';

    IF v_existing_pending.id IS NULL THEN
      INSERT INTO public.mastery_verifications (
        user_id, skill_id, skill_name, from_level, to_level, evidence_level,
        status, proposal_assessment_id, created_at
      ) VALUES (
        p_user_id, v_skill_id, v_skill_name, v_from_level, v_to_level,
        v_evidence_level, 'pending', v_assessment_id, v_now
      )
      RETURNING * INTO v_existing_pending;
    END IF;

    v_verification := jsonb_build_object(
      'id', v_existing_pending.id,
      'skillId', v_existing_pending.skill_id,
      'skillName', v_existing_pending.skill_name,
      'fromLevel', v_existing_pending.from_level,
      'toLevel', v_existing_pending.to_level,
      'evidenceLevel', v_existing_pending.evidence_level,
      'status', v_existing_pending.status,
      'proposalAssessmentId', v_existing_pending.proposal_assessment_id,
      'createdAt', v_existing_pending.created_at,
      'resolvedAt', v_existing_pending.resolved_at
    );
  END IF;

  -- G.7) Secondary skills resolution (Strict SkillResolutionInput array)
  IF p_settlement->'relatedSkillResolutions' IS NOT NULL AND jsonb_typeof(p_settlement->'relatedSkillResolutions') = 'array' THEN
    FOR v_rel_item IN SELECT * FROM jsonb_array_elements(p_settlement->'relatedSkillResolutions') LOOP
      v_rel_res_type := v_rel_item->>'resolution';
      IF v_rel_res_type = 'create' THEN
        v_rel_proposed_name := btrim(coalesce(v_rel_item->>'proposedName', ''));
        IF v_rel_proposed_name <> '' THEN
          INSERT INTO public.skills (user_id, name)
          VALUES (p_user_id, v_rel_proposed_name)
          ON CONFLICT (user_id, normalized_name) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- G.8) Linked Quest progress advancement & roll-up
  IF v_activity.quest_id IS NOT NULL THEN
    SELECT * INTO v_quest
    FROM public.quests
    WHERE id = v_activity.quest_id AND user_id = p_user_id
    FOR UPDATE;

    IF v_quest.id IS NOT NULL AND v_quest.status NOT IN ('archived', 'failed') THEN
      v_quest_progress_advance := coalesce(
        (p_settlement->>'questProgressDelta')::numeric,
        round(coalesce(v_activity.effective_minutes, 40) / 2),
        20
      );
      v_new_quest_progress := least(100, v_quest.progress + v_quest_progress_advance);

      UPDATE public.quests
      SET progress = v_new_quest_progress,
          status = CASE
            WHEN v_new_quest_progress >= 100 THEN 'completed'
            WHEN v_quest.status = 'available' THEN 'active'
            ELSE v_quest.status
          END,
          completed_at = CASE
            WHEN v_new_quest_progress >= 100 THEN coalesce(v_quest.completed_at, v_now)
            ELSE v_quest.completed_at
          END,
          updated_at = v_now
      WHERE id = v_quest.id;

      PERFORM public.recompute_quest_chain(p_user_id, v_activity.quest_id);
    END IF;
  END IF;

  -- G.9) Stage 7B Artifact Resolutions Execution
  IF v_proposal_count > 0 AND v_resolutions IS NOT NULL THEN
    FOR v_res_item IN SELECT * FROM jsonb_array_elements(v_resolutions) LOOP
      v_res_idx := (v_res_item->>'proposalIndex')::int;
      v_res_type := v_res_item->>'resolution';
      v_prop_item := v_stored_proposals->v_res_idx;

      IF v_res_type = 'create' THEN
        v_new_art_id := gen_random_uuid();
        v_art_title := btrim(coalesce(
          v_res_item->'approvedOverrides'->>'title',
          v_prop_item->>'title',
          ''
        ));
        v_art_type := coalesce(
          v_res_item->'approvedOverrides'->>'artifactType',
          v_prop_item->>'artifactType',
          'other'
        );
        v_art_summary := coalesce(
          v_res_item->'approvedOverrides'->>'summary',
          v_prop_item->>'summary'
        );
        v_art_description := coalesce(
          v_res_item->'approvedOverrides'->>'description',
          v_prop_item->>'description'
        );
        v_art_version := coalesce(
          v_res_item->'approvedOverrides'->>'version',
          v_prop_item->>'version',
          '1.0'
        );
        v_art_storage_path := coalesce(
          v_res_item->'approvedOverrides'->>'storagePath',
          v_prop_item->>'storagePath'
        );
        v_art_external_url := coalesce(
          v_res_item->'approvedOverrides'->>'externalUrl',
          v_prop_item->>'externalUrl'
        );
        v_art_reusability := coalesce(
          (v_res_item->'approvedOverrides'->>'reusabilityScore')::numeric,
          (v_prop_item->>'reusabilityScore')::numeric,
          0.00
        );
        v_art_metadata := coalesce(
          v_prop_item->'metadata',
          '{}'::jsonb
        );

        INSERT INTO public.artifacts (
          id, user_id, title, artifact_type, summary, description,
          lifecycle_status, version, storage_path, external_url,
          reusability_score, metadata, is_archived, archived_at,
          created_at, updated_at
        ) VALUES (
          v_new_art_id, p_user_id, v_art_title, v_art_type, v_art_summary, v_art_description,
          'active', v_art_version, v_art_storage_path, v_art_external_url,
          v_art_reusability, v_art_metadata, false, null,
          v_now, v_now
        );

        INSERT INTO public.artifact_activities (
          user_id, artifact_id, activity_id, activity_role, created_at
        ) VALUES (
          p_user_id, v_new_art_id, v_activity_id, 'produced', v_now
        );

        -- Optional relational links from proposal with fail-closed tenant validation
        IF v_prop_item->'skillIds' IS NOT NULL AND jsonb_typeof(v_prop_item->'skillIds') = 'array' THEN
          FOR v_sid_text IN SELECT * FROM jsonb_array_elements_text(v_prop_item->'skillIds') LOOP
            IF NOT EXISTS (SELECT 1 FROM public.skills WHERE id = v_sid_text::uuid AND user_id = p_user_id) THEN
              RAISE EXCEPTION 'skill_not_found_or_not_owned' USING ERRCODE = 'P0002';
            END IF;
            INSERT INTO public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level, created_at)
            VALUES (p_user_id, v_new_art_id, v_sid_text::uuid, 1, v_now)
            ON CONFLICT (user_id, artifact_id, skill_id) DO NOTHING;
          END LOOP;
        END IF;

        IF v_prop_item->'knowledgeNodeIds' IS NOT NULL AND jsonb_typeof(v_prop_item->'knowledgeNodeIds') = 'array' THEN
          FOR v_kid_text IN SELECT * FROM jsonb_array_elements_text(v_prop_item->'knowledgeNodeIds') LOOP
            IF NOT EXISTS (SELECT 1 FROM public.knowledge_nodes WHERE id = v_kid_text::uuid AND user_id = p_user_id) THEN
              RAISE EXCEPTION 'knowledge_node_not_found_or_not_owned' USING ERRCODE = 'P0002';
            END IF;
            INSERT INTO public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type, created_at)
            VALUES (p_user_id, v_new_art_id, v_kid_text::uuid, 'synthesizes', v_now)
            ON CONFLICT (user_id, artifact_id, node_id) DO NOTHING;
          END LOOP;
        END IF;

        IF v_prop_item->'questIds' IS NOT NULL AND jsonb_typeof(v_prop_item->'questIds') = 'array' THEN
          FOR v_qid_text IN SELECT * FROM jsonb_array_elements_text(v_prop_item->'questIds') LOOP
            IF NOT EXISTS (SELECT 1 FROM public.quests WHERE id = v_qid_text::uuid AND user_id = p_user_id) THEN
              RAISE EXCEPTION 'quest_not_found_or_not_owned' USING ERRCODE = 'P0002';
            END IF;
            INSERT INTO public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable, created_at)
            VALUES (p_user_id, v_new_art_id, v_qid_text::uuid, false, v_now)
            ON CONFLICT (user_id, artifact_id, quest_id) DO NOTHING;
          END LOOP;
        END IF;

      ELSIF v_res_type = 'existing' THEN
        v_existing_art_id := (v_res_item->>'artifactId')::uuid;
        v_art_role := coalesce(v_res_item->>'activityRole', 'modified');

        INSERT INTO public.artifact_activities (
          user_id, artifact_id, activity_id, activity_role, created_at
        ) VALUES (
          p_user_id, v_existing_art_id, v_activity_id, v_art_role, v_now
        )
        ON CONFLICT (user_id, artifact_id, activity_id)
        DO UPDATE SET activity_role = v_art_role;

      ELSIF v_res_type = 'ignore' THEN
        -- Zero writes
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- Phase H: Confirm assessment + activity
  -- ============================================================
  UPDATE public.ai_assessments
    SET status = 'superseded', updated_at = v_now
    WHERE activity_id = v_activity_id AND id <> v_assessment_id AND status = 'pending';

  UPDATE public.ai_assessments
    SET status = 'confirmed', confirmed_at = v_now, updated_at = v_now
    WHERE id = v_assessment_id;

  UPDATE public.activities
    SET status = 'confirmed', updated_at = v_now
    WHERE id = v_activity_id;

  RETURN jsonb_build_object(
    'ok', true,
    'skillId', v_skill_id,
    'transaction', jsonb_build_object(
      'id', v_tx_row.id,
      'userId', v_tx_row.user_id,
      'activityId', v_tx_row.activity_id,
      'assessmentId', v_tx_row.assessment_id,
      'skillId', v_tx_row.skill_id,
      'skillName', v_tx_row.skill_name_snapshot,
      'activityType', v_tx_row.activity_type,
      'xpType', v_tx_row.xp_type,
      'repetitionCount', v_tx_row.repetition_count,
      'repetitionPenalty', v_tx_row.repetition_penalty,
      'amount', v_tx_row.amount,
      'baseAmount', v_tx_row.base_amount,
      'modifierJson', v_tx_row.modifier_json,
      'reason', v_tx_row.reason,
      'rulesVersion', v_tx_row.rules_version,
      'createdAt', v_tx_row.created_at
    ),
    'masteryVerification', v_verification
  );
END;
$$;
ALTER FUNCTION public.settle_activity(uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.settle_activity(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_activity(uuid,jsonb) TO service_role;

