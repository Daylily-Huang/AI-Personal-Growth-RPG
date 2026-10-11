-- User-manual provenance only; no XP, Mastery, verified Evidence, or Core writes.
-- This migration is a candidate for isolated tests, NOT permission for a live upgrade.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.reward_transactions WHERE upper(btrim(canonical_source_type)) = 'ARTIFACT') THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_UNKNOWN_LEGACY_LEDGER' USING ERRCODE='P0001';
  END IF;
END $$;

CREATE TABLE public.artifact_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artifact_id uuid NOT NULL,
  recognition_class text NOT NULL DEFAULT 'USER_CONFIRMED_ARTIFACT' CHECK (recognition_class='USER_CONFIRMED_ARTIFACT'),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  accepted_title text NOT NULL CHECK (length(btrim(accepted_title))>0),
  accepted_version text,
  accepted_updated_at timestamptz NOT NULL,
  acceptance_note text NOT NULL CHECK (acceptance_note=public.phase8f_trim_text(acceptance_note) AND length(acceptance_note) BETWEEN 1 AND 2000),
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  earn_transaction_id uuid NOT NULL UNIQUE REFERENCES public.reward_transactions(id) ON DELETE RESTRICT,
  policy_version text NOT NULL DEFAULT 'artifact-manual-v1' CHECK (policy_version='artifact-manual-v1'),
  revoked_at timestamptz,
  revocation_reason text,
  correction_transaction_id uuid UNIQUE REFERENCES public.reward_transactions(id) ON DELETE RESTRICT,
  UNIQUE(user_id,artifact_id),
  FOREIGN KEY(user_id,artifact_id) REFERENCES public.artifacts(user_id,id) ON DELETE RESTRICT,
  CHECK ((status='ACTIVE' AND revoked_at IS NULL AND revocation_reason IS NULL AND correction_transaction_id IS NULL)
    OR (status='REVOKED' AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL AND
      revocation_reason=public.phase8f_trim_text(revocation_reason) AND length(revocation_reason) BETWEEN 1 AND 2000 AND correction_transaction_id IS NOT NULL))
);
ALTER TABLE public.artifact_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artifact_acceptances FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.artifact_acceptances TO authenticated;
CREATE POLICY artifact_acceptances_owner_read ON public.artifact_acceptances
  FOR SELECT TO authenticated USING (user_id=auth.uid());

-- Policy is deliberately absent from this lifetime identity.
CREATE UNIQUE INDEX artifact_manual_lifetime_earn ON public.reward_transactions(user_id,canonical_source_type,canonical_source_id)
  WHERE event_kind='EARN' AND canonical_source_type='ARTIFACT';

CREATE FUNCTION public.calculate_artifact_manual_reward_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT 100 $$;

CREATE FUNCTION public.artifact_manual_actor() RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' OR current_setting('role',true) IS DISTINCT FROM 'authenticated' OR u IS NULL THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN u;
END $$;

CREATE FUNCTION public.artifact_manual_credit_json(t public.reward_transactions) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'userId',t.user_id,'accountId',t.account_id,
    'eventKind',t.event_kind,'amount',t.amount,'sourceType',t.canonical_source_type,'sourceId',t.canonical_source_id,
    'policyVersion',t.policy_version,'correctionForId',t.correction_for_id,'createdAt',t.created_at) END
$$;
CREATE FUNCTION public.artifact_manual_acceptance_json(a public.artifact_acceptances) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('id',a.id,'userId',a.user_id,'artifactId',a.artifact_id,'recognitionClass',a.recognition_class,'status',a.status,
    'acceptedTitle',a.accepted_title,'acceptedVersion',a.accepted_version,'acceptedUpdatedAt',a.accepted_updated_at,
    'acceptanceNote',a.acceptance_note,'acceptedAt',a.accepted_at,'earnTransactionId',a.earn_transaction_id,'policyVersion',a.policy_version,
    'revokedAt',a.revoked_at,'revocationReason',a.revocation_reason,'correctionTransactionId',a.correction_transaction_id)
$$;
CREATE FUNCTION public.artifact_manual_receipt(a public.artifact_acceptances) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE e public.reward_transactions%ROWTYPE; c public.reward_transactions%ROWTYPE;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' OR a.user_id IS DISTINCT FROM public.artifact_manual_actor() THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_WRITE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO e FROM public.reward_transactions WHERE id=a.earn_transaction_id;
  SELECT * INTO c FROM public.reward_transactions WHERE correction_for_id=e.id AND event_kind='CORRECTION';
  RETURN jsonb_build_object('acceptance',public.artifact_manual_acceptance_json(a),'earn',public.artifact_manual_credit_json(e),
    'correction',public.artifact_manual_credit_json(c),'replayed',false);
END $$;

CREATE FUNCTION public.artifact_manual_begin(p_rpc text,p_key text,p_artifact uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,extensions,pg_temp AS $$
DECLARE u uuid:=public.artifact_manual_actor(); k text:=public.phase8f_trim_text(p_key); identity jsonb; fingerprint text;
  prior public.outer_loop_audit_events%ROWTYPE;
BEGIN
  IF k IS NULL OR length(k) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_INPUT' USING ERRCODE='22023';
  END IF;
  identity:=jsonb_build_object('rpc_name',p_rpc,'target_entity_type','artifacts','target_entity_id',p_artifact::text,'payload',p_payload);
  fingerprint:=encode(extensions.digest(convert_to('artifact-manual-request-v1:'||identity::text,'UTF8'),'sha256'),'hex');
  -- Exactly the shared 0049/0052 lock, before ANY mutable target lookup.
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text||E'\x1f'||k,0));
  SELECT * INTO prior FROM public.outer_loop_audit_events WHERE user_id=u AND request_idempotency_key=k;
  IF FOUND THEN
    IF prior.policy_version IS DISTINCT FROM 'artifact-manual-v1'
      OR prior.event_data->>'rpc_name' IS DISTINCT FROM p_rpc
      OR prior.event_data->>'target_entity_type' IS DISTINCT FROM 'artifacts'
      OR prior.event_data->>'target_entity_id' IS DISTINCT FROM p_artifact::text
      OR prior.event_data->'normalized_payload' IS DISTINCT FROM p_payload
      OR prior.event_data->>'canonical_request_fingerprint' IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_KEY_REUSED' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('replayed',true,'result',prior.event_data->'result_snapshot','fingerprint',fingerprint);
  END IF;
  RETURN jsonb_build_object('replayed',false,'fingerprint',fingerprint);
END $$;

CREATE FUNCTION public.artifact_manual_write_audit(a public.artifact_acceptances,p_rpc text,p_key text,p_payload jsonb,p_fingerprint text,p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' OR a.user_id IS DISTINCT FROM public.artifact_manual_actor() THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_WRITE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.outer_loop_audit_events(user_id,event_type,entity_type,entity_id,request_idempotency_key,policy_version,schema_version,event_data)
  VALUES(a.user_id,CASE WHEN a.status='ACTIVE' THEN 'ARTIFACT_MANUALLY_ACCEPTED' ELSE 'ARTIFACT_ACCEPTANCE_REVOKED' END,
    'artifact_acceptances',a.id,public.phase8f_trim_text(p_key),'artifact-manual-v1','1',
    jsonb_build_object('rpc_name',p_rpc,'target_entity_type','artifacts','target_entity_id',a.artifact_id::text,
      'normalized_payload',p_payload,'canonical_request_fingerprint',p_fingerprint,'result_snapshot',p_result));
END $$;

-- INVOKER preserves the real write execution identity. Client-set flags are irrelevant.
CREATE FUNCTION public.artifact_manual_row_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE source public.artifacts%ROWTYPE; e public.reward_transactions%ROWTYPE; c public.reward_transactions%ROWTYPE;
BEGIN
  IF TG_OP NOT IN ('INSERT','UPDATE') THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_WRITE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF current_user IS DISTINCT FROM 'postgres' OR current_setting('role',true) IS DISTINCT FROM 'authenticated'
    OR auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_WRITE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO source FROM public.artifacts WHERE id=NEW.artifact_id AND user_id=NEW.user_id;
  SELECT * INTO e FROM public.reward_transactions WHERE id=NEW.earn_transaction_id;
  IF source.id IS NULL OR e.id IS NULL OR e.user_id IS DISTINCT FROM NEW.user_id
    OR e.event_kind IS DISTINCT FROM 'EARN' OR e.amount IS DISTINCT FROM public.calculate_artifact_manual_reward_v1()
    OR e.canonical_source_type IS DISTINCT FROM 'ARTIFACT' OR e.canonical_source_id IS DISTINCT FROM NEW.artifact_id::text
    OR e.policy_version IS DISTINCT FROM 'artifact-manual-v1'
    OR NOT EXISTS(SELECT 1 FROM public.reward_accounts WHERE id=e.account_id AND user_id=NEW.user_id) THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_RECEIPT' USING ERRCODE='P0001';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'ACTIVE' OR NEW.recognition_class IS DISTINCT FROM 'USER_CONFIRMED_ARTIFACT'
      OR NEW.policy_version IS DISTINCT FROM 'artifact-manual-v1' OR source.lifecycle_status IS DISTINCT FROM 'active'
      OR source.is_archived IS DISTINCT FROM false OR NEW.accepted_title IS DISTINCT FROM source.title
      OR NEW.accepted_version IS DISTINCT FROM source.version OR NEW.accepted_updated_at IS DISTINCT FROM source.updated_at THEN
      RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_RECEIPT' USING ERRCODE='P0001';
    END IF;
  ELSE
    IF OLD.status IS DISTINCT FROM 'ACTIVE' OR NEW.status IS DISTINCT FROM 'REVOKED'
      OR (to_jsonb(NEW)-ARRAY['status','revoked_at','revocation_reason','correction_transaction_id'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revoked_at','revocation_reason','correction_transaction_id']) THEN
      RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_WRITE_FORBIDDEN' USING ERRCODE='42501';
    END IF;
    SELECT * INTO c FROM public.reward_transactions WHERE id=NEW.correction_transaction_id;
    IF c.id IS NULL OR c.user_id IS DISTINCT FROM NEW.user_id OR c.account_id IS DISTINCT FROM e.account_id
      OR c.event_kind IS DISTINCT FROM 'CORRECTION' OR c.correction_for_id IS DISTINCT FROM e.id
      OR c.amount IS DISTINCT FROM -e.amount OR c.canonical_source_type IS DISTINCT FROM e.canonical_source_type
      OR c.canonical_source_id IS DISTINCT FROM e.canonical_source_id OR c.policy_version IS DISTINCT FROM e.policy_version THEN
      RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_RECEIPT' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER artifact_manual_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.artifact_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.artifact_manual_row_guard();
CREATE TRIGGER artifact_manual_truncate_guard BEFORE TRUNCATE ON public.artifact_acceptances
  FOR EACH STATEMENT EXECUTE FUNCTION public.artifact_manual_row_guard();

CREATE FUNCTION public.artifact_manual_ledger_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF upper(btrim(NEW.canonical_source_type)) IS DISTINCT FROM 'ARTIFACT'
    AND NEW.policy_version IS DISTINCT FROM 'artifact-manual-v1' THEN RETURN NEW; END IF;
  IF current_user IS DISTINCT FROM 'postgres' OR current_setting('role',true) IS DISTINCT FROM 'authenticated'
    OR auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_WRITE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF NEW.canonical_source_type IS DISTINCT FROM 'ARTIFACT' OR NEW.policy_version IS DISTINCT FROM 'artifact-manual-v1'
    OR NEW.canonical_source_id IS NULL OR NEW.canonical_source_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR NOT coalesce((NEW.event_kind='EARN' AND NEW.amount=public.calculate_artifact_manual_reward_v1())
      OR (NEW.event_kind='CORRECTION' AND NEW.amount=-public.calculate_artifact_manual_reward_v1()),false)
    OR NOT EXISTS(SELECT 1 FROM public.artifacts WHERE id::text=NEW.canonical_source_id AND user_id=NEW.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.reward_accounts WHERE id=NEW.account_id AND user_id=NEW.user_id) THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_RECEIPT' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER artifact_manual_ledger_guard BEFORE INSERT ON public.reward_transactions
  FOR EACH ROW EXECUTE FUNCTION public.artifact_manual_ledger_guard();

-- EARN is inserted before its referencing acceptance. Validate the completed link
-- at commit, without weakening the immediate real-role guard or old ledger trigger.
CREATE FUNCTION public.artifact_manual_ledger_link_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target uuid;
BEGIN
  IF NEW.canonical_source_type IS DISTINCT FROM 'ARTIFACT' THEN RETURN NEW; END IF;
  target:=CASE WHEN NEW.event_kind='EARN' THEN NEW.id ELSE NEW.correction_for_id END;
  IF NOT EXISTS(SELECT 1 FROM public.artifact_acceptances WHERE user_id=NEW.user_id
    AND artifact_id::text=NEW.canonical_source_id AND earn_transaction_id=target AND policy_version=NEW.policy_version) THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_RECEIPT' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER artifact_manual_ledger_link_guard AFTER INSERT ON public.reward_transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.artifact_manual_ledger_link_guard();

-- Prevent forged successful audit receipts under broadened grants, too.
CREATE FUNCTION public.artifact_manual_audit_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.policy_version IS DISTINCT FROM 'artifact-manual-v1' AND NEW.entity_type IS DISTINCT FROM 'artifact_acceptances'
    AND NEW.event_type NOT IN ('ARTIFACT_MANUALLY_ACCEPTED','ARTIFACT_ACCEPTANCE_REVOKED') THEN RETURN NEW; END IF;
  IF current_user IS DISTINCT FROM 'postgres' OR current_setting('role',true) IS DISTINCT FROM 'authenticated'
    OR auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_WRITE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER artifact_manual_audit_guard BEFORE INSERT ON public.outer_loop_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.artifact_manual_audit_guard();

CREATE FUNCTION public.rpc_accept_artifact_manual(p_artifact_id uuid,p_expected_updated_at text,p_acceptance_note text,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=public.artifact_manual_actor(); note text:=public.phase8f_trim_text(p_acceptance_note);
  payload jsonb:=jsonb_build_object('expectedUpdatedAt',p_expected_updated_at,'acceptanceNote',note);
  begun jsonb; source public.artifacts%ROWTYPE; a public.artifact_acceptances%ROWTYPE; account public.reward_accounts%ROWTYPE;
  expected timestamptz; earn_id uuid; result jsonb;
BEGIN
  begun:=public.artifact_manual_begin('rpc_accept_artifact_manual',p_request_key,p_artifact_id,payload);
  IF (begun->>'replayed')::boolean THEN RETURN (begun->'result')||'{"replayed":true}'::jsonb; END IF;
  IF p_artifact_id IS NULL OR note IS NULL OR length(note) NOT BETWEEN 1 AND 2000
    OR p_expected_updated_at IS NULL OR length(p_expected_updated_at)>128 OR p_expected_updated_at ~ '[^ -~]'
    OR p_expected_updated_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,9})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_INPUT' USING ERRCODE='22023';
  END IF;
  BEGIN expected:=p_expected_updated_at::timestamptz;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format OR SQLSTATE '22009' THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_INPUT' USING ERRCODE='22023';
  END;
  PERFORM public.phase8e_lock_reward_account_key(u);
  SELECT * INTO source FROM public.artifacts WHERE id=p_artifact_id AND user_id=u FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO a FROM public.artifact_acceptances WHERE user_id=u AND artifact_id=p_artifact_id FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_ALREADY_ACCEPTED' USING ERRCODE='23505'; END IF;
  IF source.lifecycle_status IS DISTINCT FROM 'active' OR source.is_archived IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_SOURCE_INELIGIBLE' USING ERRCODE='P0001';
  END IF;
  IF source.updated_at IS DISTINCT FROM expected THEN RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_STALE_SOURCE' USING ERRCODE='P0001'; END IF;
  earn_id:=public.phase8e_lock_reward_account(u);
  SELECT * INTO account FROM public.reward_accounts WHERE id=earn_id AND user_id=u FOR UPDATE;
  IF public.phase8e_preview_reward_account(account.id,u,account.updated_at) IS DISTINCT FROM to_jsonb(account) THEN
    RAISE EXCEPTION 'REWARD_ACCOUNT_PARITY_FAILED' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.reward_transactions(account_id,user_id,event_kind,amount,canonical_source_type,canonical_source_id,policy_version,request_idempotency_key,note)
  VALUES(account.id,u,'EARN',public.calculate_artifact_manual_reward_v1(),'ARTIFACT',p_artifact_id::text,'artifact-manual-v1',
    public.phase8f_trim_text(p_request_key),'User-manually accepted Artifact; not independent verification') RETURNING id INTO earn_id;
  INSERT INTO public.artifact_acceptances(user_id,artifact_id,accepted_title,accepted_version,accepted_updated_at,acceptance_note,earn_transaction_id)
  VALUES(u,p_artifact_id,source.title,source.version,source.updated_at,note,earn_id) RETURNING * INTO a;
  PERFORM public.phase8e_apply_reward_account(account.id,u,clock_timestamp());
  result:=public.artifact_manual_receipt(a);
  PERFORM public.artifact_manual_write_audit(a,'rpc_accept_artifact_manual',p_request_key,payload,begun->>'fingerprint',result);
  RETURN result;
END $$;

CREATE FUNCTION public.rpc_revoke_artifact_manual(p_artifact_id uuid,p_reason text,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=public.artifact_manual_actor(); reason text:=public.phase8f_trim_text(p_reason);
  payload jsonb:=jsonb_build_object('reason',reason); begun jsonb; result jsonb; reused boolean;
  a public.artifact_acceptances%ROWTYPE; e public.reward_transactions%ROWTYPE; c public.reward_transactions%ROWTYPE;
  account public.reward_accounts%ROWTYPE;
BEGIN
  begun:=public.artifact_manual_begin('rpc_revoke_artifact_manual',p_request_key,p_artifact_id,payload);
  IF (begun->>'replayed')::boolean THEN RETURN (begun->'result')||'{"replayed":true}'::jsonb; END IF;
  IF p_artifact_id IS NULL OR reason IS NULL OR length(reason) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_INPUT' USING ERRCODE='22023';
  END IF;
  PERFORM public.phase8e_lock_reward_account_key(u);
  PERFORM 1 FROM public.artifacts WHERE id=p_artifact_id AND user_id=u FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO account FROM public.reward_accounts WHERE user_id=u FOR UPDATE;
  SELECT * INTO a FROM public.artifact_acceptances WHERE user_id=u AND artifact_id=p_artifact_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF a.status IS DISTINCT FROM 'ACTIVE' THEN RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_ALREADY_REVOKED' USING ERRCODE='23505'; END IF;
  SELECT * INTO e FROM public.reward_transactions WHERE id=a.earn_transaction_id FOR UPDATE;
  IF e.id IS NULL OR account.id IS NULL OR e.user_id IS DISTINCT FROM u OR e.account_id IS DISTINCT FROM account.id
    OR e.event_kind IS DISTINCT FROM 'EARN' OR e.amount IS DISTINCT FROM public.calculate_artifact_manual_reward_v1()
    OR e.canonical_source_type IS DISTINCT FROM 'ARTIFACT' OR e.canonical_source_id IS DISTINCT FROM p_artifact_id::text
    OR e.policy_version IS DISTINCT FROM 'artifact-manual-v1' THEN
    RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_RECEIPT' USING ERRCODE='P0001';
  END IF;
  IF public.phase8e_preview_reward_account(account.id,u,account.updated_at) IS DISTINCT FROM to_jsonb(account) THEN
    RAISE EXCEPTION 'REWARD_ACCOUNT_PARITY_FAILED' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO c FROM public.reward_transactions WHERE correction_for_id=e.id AND event_kind='CORRECTION' FOR UPDATE;
  reused:=FOUND;
  IF reused THEN
    IF c.user_id IS DISTINCT FROM u OR c.account_id IS DISTINCT FROM account.id OR c.event_kind IS DISTINCT FROM 'CORRECTION'
      OR c.correction_for_id IS DISTINCT FROM e.id OR c.amount IS DISTINCT FROM -e.amount
      OR c.canonical_source_type IS DISTINCT FROM e.canonical_source_type OR c.canonical_source_id IS DISTINCT FROM e.canonical_source_id
      OR c.policy_version IS DISTINCT FROM e.policy_version THEN
      RAISE EXCEPTION 'ARTIFACT_ACCEPTANCE_INVALID_RECEIPT' USING ERRCODE='P0001';
    END IF;
  ELSE
    INSERT INTO public.reward_transactions(account_id,user_id,event_kind,amount,canonical_source_type,canonical_source_id,policy_version,request_idempotency_key,correction_for_id,note)
    VALUES(account.id,u,'CORRECTION',-e.amount,e.canonical_source_type,e.canonical_source_id,e.policy_version,
      public.phase8f_trim_text(p_request_key),e.id,'Manual Artifact acceptance revoked: '||reason) RETURNING * INTO c;
    PERFORM public.phase8e_apply_reward_account(account.id,u,clock_timestamp());
  END IF;
  UPDATE public.artifact_acceptances SET status='REVOKED',revoked_at=clock_timestamp(),revocation_reason=reason,correction_transaction_id=c.id
    WHERE id=a.id RETURNING * INTO a;
  result:=public.artifact_manual_receipt(a);
  PERFORM public.artifact_manual_write_audit(a,'rpc_revoke_artifact_manual',p_request_key,payload,begun->>'fingerprint',result);
  RETURN result;
END $$;

DO $$ DECLARE signature text; BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'calculate_artifact_manual_reward_v1()', 'artifact_manual_actor()',
    'artifact_manual_credit_json(public.reward_transactions)', 'artifact_manual_acceptance_json(public.artifact_acceptances)',
    'artifact_manual_receipt(public.artifact_acceptances)', 'artifact_manual_begin(text,text,uuid,jsonb)',
    'artifact_manual_write_audit(public.artifact_acceptances,text,text,jsonb,text,jsonb)',
    'artifact_manual_row_guard()', 'artifact_manual_ledger_guard()', 'artifact_manual_ledger_link_guard()', 'artifact_manual_audit_guard()',
    'rpc_accept_artifact_manual(uuid,text,text,text)', 'rpc_revoke_artifact_manual(uuid,text,text)'
  ] LOOP
    EXECUTE 'ALTER FUNCTION public.'||signature||' OWNER TO postgres';
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||signature||' FROM PUBLIC,anon,authenticated,service_role';
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.rpc_accept_artifact_manual(uuid,text,text,text), public.rpc_revoke_artifact_manual(uuid,text,text) TO authenticated;
