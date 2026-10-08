-- User-approved catalog creation only; no assessment, growth or reward mutation.
-- 0028 left DML and inherited maintenance privileges; enforce the declared read-only boundary.
REVOKE ALL ON TABLE public.skills FROM anon, authenticated;
GRANT SELECT ON TABLE public.skills TO authenticated;

CREATE FUNCTION public.rpc_create_skill_zero_xp(p_input jsonb)
RETURNS public.skills
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  u uuid := auth.uid(); n text; result public.skills; constraint_name text;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR u IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INVALID_SKILL_INPUT' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_input ? 'name') OR (SELECT count(*) FROM jsonb_object_keys(p_input)) <> 1
     OR jsonb_typeof(p_input->'name') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'INVALID_SKILL_INPUT' USING ERRCODE = '22023';
  END IF;
  n := public.phase8f_trim_text(p_input->>'name');
  IF char_length(n) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'INVALID_SKILL_INPUT' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.skills(user_id, name, domain_id, aliases, description,
    xp, level, mastery_level, mastery_confidence, status, last_used_at)
  VALUES(u, n, NULL, '{}'::text[], NULL, 0, 1, 0, 0, 'active', NULL)
  RETURNING * INTO result;
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS constraint_name = CONSTRAINT_NAME;
  IF constraint_name = 'skills_user_normalized_unique' THEN
    RAISE EXCEPTION 'SKILL_ALREADY_EXISTS' USING ERRCODE = '23505';
  END IF;
  RAISE;
END;
$$;
ALTER FUNCTION public.rpc_create_skill_zero_xp(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_create_skill_zero_xp(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_skill_zero_xp(jsonb) TO authenticated;
