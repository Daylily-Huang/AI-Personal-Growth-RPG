-- Phase 8F Round 2; admitted controller 25. No Core writes or new reward policy.
-- Each request owns one shared key lock and one combined immutable audit.
CREATE FUNCTION public.phase8f_trim_text(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT btrim(p_text, E' \t\n\r\f\v' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

CREATE FUNCTION public.phase8f_normalize_payload(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp
AS $$
DECLARE v jsonb := p_payload; k text; t text;
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RETURN v; END IF;
  FOREACH k IN ARRAY ARRAY['milestone_key','title','description','recognition_class',
    'source_type','source_id','external_evidence_url','external_credential_id'] LOOP
    IF jsonb_typeof(v->k) = 'string' THEN
      t := public.phase8f_trim_text(v->>k);
      IF k IN ('recognition_class','source_type') THEN t := upper(t); END IF;
      IF k IN ('description','external_evidence_url','external_credential_id') THEN t := nullif(t, ''); END IF;
      v := jsonb_set(v, ARRAY[k], coalesce(to_jsonb(t), 'null'::jsonb));
    END IF;
  END LOOP;
  IF jsonb_typeof(v->'source_id') = 'string' THEN
    t := public.phase8e_canonical_reward_source_id(
      CASE WHEN v->>'source_type' = 'EXTERNAL_CREDENTIAL' THEN 'QUEST' ELSE v->>'source_type' END,
      v->>'source_id');
    v := jsonb_set(v, '{source_id}', to_jsonb(t));
  END IF;
  -- Optional absent and null proof metadata have the same stored meaning.
  RETURN jsonb_build_object('external_evidence_url', null, 'external_credential_id', null) || v;
END;
$$;

CREATE FUNCTION public.phase8f_begin_request(
  p_user_id uuid, p_rpc_name text, p_target_type text, p_target_id text,
  p_payload jsonb, p_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_key text := btrim(coalesce(p_key,'')); v_identity jsonb; v_hash text;
  v_prior public.outer_loop_audit_events%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE='28000'; END IF;
  IF public.phase8f_trim_text(v_key) = '' OR length(v_key) > 200 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE='22023';
  END IF;
  v_identity := jsonb_build_object('rpc_name',p_rpc_name,'target_entity_type',p_target_type,
    'target_entity_id',p_target_id,'payload',p_payload);
  v_hash := encode(extensions.digest(convert_to('phase8f-request-v1:' || v_identity::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || E'\x1f' || v_key,0));
  SELECT * INTO v_prior FROM public.outer_loop_audit_events
    WHERE user_id=p_user_id AND request_idempotency_key=v_key;
  IF FOUND THEN
    IF v_prior.policy_version IS DISTINCT FROM 'phase8f-milestone-v1'
      OR v_prior.event_data->>'rpc_name' IS DISTINCT FROM p_rpc_name
      OR v_prior.event_data->>'target_entity_type' IS DISTINCT FROM p_target_type
      OR v_prior.event_data->>'target_entity_id' IS DISTINCT FROM p_target_id
      OR v_prior.event_data->'normalized_payload' IS DISTINCT FROM p_payload
      OR v_prior.event_data->>'canonical_request_fingerprint' IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('replayed',true,'fingerprint',v_hash,'result',v_prior.event_data->'result_snapshot');
  END IF;
  RETURN jsonb_build_object('replayed',false,'fingerprint',v_hash);
END;
$$;

CREATE FUNCTION public.phase8f_write_audit(
  p_user_id uuid, p_event text, p_entity_type text, p_entity_id uuid, p_key text,
  p_rpc text, p_target_type text, p_target_id text, p_payload jsonb, p_hash text, p_result jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.outer_loop_audit_events(user_id,event_type,entity_type,entity_id,
    request_idempotency_key,policy_version,schema_version,event_data)
  VALUES(p_user_id,p_event,p_entity_type,p_entity_id,btrim(p_key),'phase8f-milestone-v1','1',
    jsonb_build_object('rpc_name',p_rpc,'target_entity_type',p_target_type,'target_entity_id',p_target_id,
      'normalized_payload',p_payload,'canonical_request_fingerprint',p_hash,'result_snapshot',p_result))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.phase8f_validate_source(p_user_id uuid, p_class text, p_type text, p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_quest public.quests%ROWTYPE; v_season public.seasons%ROWTYPE;
BEGIN
  IF NOT coalesce((p_class='CORE_VERIFIED' AND p_type IN ('QUEST','SEASON','MASTERY'))
    OR (p_class='USER_CONFIRMED_REAL_WORLD' AND p_type='EXTERNAL_CREDENTIAL'),false) THEN
    RAISE EXCEPTION 'INVALID_RECOGNITION_SOURCE_CLASS' USING ERRCODE='22023';
  END IF;
  IF NOT coalesce((p_type IN ('QUEST','SEASON','EXTERNAL_CREDENTIAL')
      AND p_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (p_type='MASTERY' AND p_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:M(6|8|10)$'),false) THEN
    RAISE EXCEPTION 'INVALID_MILESTONE_SOURCE_ID' USING ERRCODE='22023';
  END IF;
  IF p_type='QUEST' THEN
    SELECT * INTO v_quest FROM public.quests WHERE id=p_id::uuid AND user_id=p_user_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MILESTONE_SOURCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    IF v_quest.status IS DISTINCT FROM 'completed'
      OR NOT coalesce(v_quest.quest_size IN ('epic','main') OR v_quest.is_boss,false) THEN
      RAISE EXCEPTION 'MILESTONE_SOURCE_NOT_ELIGIBLE' USING ERRCODE='P0001';
    END IF;
  ELSIF p_type='SEASON' THEN
    SELECT * INTO v_season FROM public.seasons WHERE id=p_id::uuid AND user_id=p_user_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MILESTONE_SOURCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    IF v_season.status IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'MILESTONE_SOURCE_NOT_ELIGIBLE' USING ERRCODE='P0001';
    END IF;
    PERFORM 1 FROM public.season_reviews WHERE season_id=v_season.id AND user_id=p_user_id
      AND review_type='FINAL' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MILESTONE_SOURCE_NOT_ELIGIBLE' USING ERRCODE='P0001'; END IF;
  ELSIF p_type='MASTERY' THEN
    PERFORM 1 FROM public.skills WHERE id=split_part(p_id,':',1)::uuid AND user_id=p_user_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MILESTONE_SOURCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    PERFORM 1 FROM public.mastery_verifications WHERE user_id=p_user_id
      AND skill_id=split_part(p_id,':',1)::uuid AND to_level=substring(split_part(p_id,':',2) FROM 2)::integer
      AND status='verified' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MILESTONE_SOURCE_NOT_ELIGIBLE' USING ERRCODE='P0001'; END IF;
  END IF;
END;
$$;

-- Caller owns request identity and audit. This helper never nests a public RPC.
CREATE FUNCTION public.phase8f_confirm_record(p_user_id uuid, p_payload jsonb, p_key text)
RETURNS public.milestones LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE k text; v public.milestones%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INVALID_MILESTONE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) AS f(key) WHERE key NOT IN
    ('milestone_key','title','description','recognition_class','source_type','source_id',
     'external_evidence_url','external_credential_id')) THEN
    RAISE EXCEPTION 'INVALID_MILESTONE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['milestone_key','title','recognition_class','source_type','source_id'] LOOP
    IF jsonb_typeof(p_payload->k) IS DISTINCT FROM 'string' OR btrim(p_payload->>k)='' THEN
      RAISE EXCEPTION 'INVALID_MILESTONE_PAYLOAD' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF NOT (p_payload ? 'description') THEN
    RAISE EXCEPTION 'INVALID_MILESTONE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['description','external_evidence_url','external_credential_id'] LOOP
    IF p_payload ? k AND jsonb_typeof(p_payload->k) NOT IN ('string','null') THEN
      RAISE EXCEPTION 'INVALID_MILESTONE_PAYLOAD' USING ERRCODE='22023';
    END IF;
  END LOOP;
  PERFORM public.phase8f_validate_source(p_user_id,p_payload->>'recognition_class',
    p_payload->>'source_type',p_payload->>'source_id');
  BEGIN
    INSERT INTO public.milestones(user_id,milestone_key,title,description,recognition_class,source_type,
      source_id,external_evidence_url,external_credential_id,confirmation_request_idempotency_key)
    VALUES(p_user_id,p_payload->>'milestone_key',p_payload->>'title',p_payload->>'description',
      p_payload->>'recognition_class',p_payload->>'source_type',p_payload->>'source_id',
      p_payload->>'external_evidence_url',p_payload->>'external_credential_id',btrim(p_key)) RETURNING * INTO v;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'MILESTONE_ALREADY_EXISTS' USING ERRCODE='23505';
  END;
  RETURN v;
END;
$$;

CREATE FUNCTION public.rpc_confirm_milestone(
  p_milestone_key text, p_title text, p_description text, p_recognition_class text,
  p_source_type text, p_source_id text, p_external_evidence_url text, p_external_credential_id text,
  p_confirmation_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE u uuid := auth.uid(); p jsonb; b jsonb; r jsonb; target text; m public.milestones%ROWTYPE;
BEGIN
  p := public.phase8f_normalize_payload(jsonb_build_object('milestone_key',p_milestone_key,
    'title',p_title,'description',p_description,'recognition_class',p_recognition_class,
    'source_type',p_source_type,'source_id',p_source_id,'external_evidence_url',p_external_evidence_url,
    'external_credential_id',p_external_credential_id));
  target := (p->>'source_type') || ':' || (p->>'source_id');
  b := public.phase8f_begin_request(u,'rpc_confirm_milestone','milestone_source',target,p,p_confirmation_request_idempotency_key);
  IF (b->>'replayed')::boolean THEN RETURN (b->'result') || '{"replayed":true}'::jsonb; END IF;
  m := public.phase8f_confirm_record(u,p,p_confirmation_request_idempotency_key);
  r := jsonb_build_object('ok',true,'milestone',to_jsonb(m),'replayed',false);
  PERFORM public.phase8f_write_audit(u,'MILESTONE_CONFIRMED','milestones',m.id,
    p_confirmation_request_idempotency_key,'rpc_confirm_milestone','milestone_source',target,p,b->>'fingerprint',r);
  RETURN r;
END;
$$;

CREATE FUNCTION public.rpc_settle_milestone_reward(p_milestone_id uuid, p_policy_version text, p_request_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE u uuid := auth.uid(); p jsonb := jsonb_build_object('policy_version',public.phase8f_trim_text(p_policy_version));
  b jsonb; r jsonb; a uuid; amount integer; stamp timestamptz; preview jsonb;
  m public.milestones%ROWTYPE; tx public.reward_transactions%ROWTYPE;
BEGIN
  b := public.phase8f_begin_request(u,'rpc_settle_milestone_reward','milestones',p_milestone_id::text,p,p_request_idempotency_key);
  IF (b->>'replayed')::boolean THEN RETURN (b->'result') || '{"replayed":true}'::jsonb; END IF;
  IF p_milestone_id IS NULL THEN RAISE EXCEPTION 'INVALID_MILESTONE_ID' USING ERRCODE='22023'; END IF;
  IF p->>'policy_version' IS DISTINCT FROM 'reward-v1' THEN
    RAISE EXCEPTION 'UNKNOWN_REWARD_POLICY_VERSION' USING ERRCODE='22023';
  END IF;
  a := public.phase8e_lock_reward_account(u);
  SELECT * INTO m FROM public.milestones WHERE id=p_milestone_id AND user_id=u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MILESTONE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF m.status <> 'ACTIVE' OR m.granted_reward_credit THEN
    RAISE EXCEPTION 'MILESTONE_NOT_SETTLEABLE' USING ERRCODE='23505';
  END IF;
  IF m.recognition_class <> 'CORE_VERIFIED' THEN
    RAISE EXCEPTION 'INELIGIBLE_FOR_REWARD' USING ERRCODE='P0001';
  END IF;
  PERFORM public.phase8f_validate_source(u,m.recognition_class,m.source_type,m.source_id);
  amount := public.phase8e_verified_reward_amount(u,m.source_type,m.source_id,p->>'policy_version');
  BEGIN
    INSERT INTO public.reward_transactions(account_id,user_id,event_kind,amount,canonical_source_type,
      canonical_source_id,policy_version,request_idempotency_key)
    VALUES(a,u,'EARN',amount,m.source_type,m.source_id,p->>'policy_version',btrim(p_request_idempotency_key))
    RETURNING * INTO tx;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REWARD_ALREADY_MINTED_FOR_SOURCE' USING ERRCODE='23505';
  END;
  UPDATE public.milestones SET granted_reward_credit=true,reward_transaction_id=tx.id
    WHERE id=m.id RETURNING * INTO m;
  stamp := clock_timestamp();
  preview := public.phase8e_preview_reward_account(a,u,stamp);
  r := jsonb_build_object('ok',true,'milestone',to_jsonb(m),'transaction',to_jsonb(tx),'account',preview,'replayed',false);
  PERFORM public.phase8f_write_audit(u,'MILESTONE_REWARD_SETTLED','milestones',m.id,p_request_idempotency_key,
    'rpc_settle_milestone_reward','milestones',p_milestone_id::text,p,b->>'fingerprint',r);
  IF public.phase8e_apply_reward_account(a,u,stamp) IS DISTINCT FROM preview THEN
    RAISE EXCEPTION 'REWARD_ACCOUNT_PARITY_FAILED' USING ERRCODE='P0001';
  END IF;
  RETURN r;
END;
$$;

CREATE FUNCTION public.rpc_revoke_milestone(p_milestone_id uuid, p_revocation_reason text, p_revocation_request_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE u uuid := auth.uid(); p jsonb := jsonb_build_object('reason',nullif(public.phase8f_trim_text(p_revocation_reason),''));
  b jsonb; r jsonb; preview jsonb; stamp timestamptz; reused boolean := false;
  m public.milestones%ROWTYPE; original public.reward_transactions%ROWTYPE;
  correction public.reward_transactions%ROWTYPE; account public.reward_accounts%ROWTYPE;
BEGIN
  b := public.phase8f_begin_request(u,'rpc_revoke_milestone','milestones',p_milestone_id::text,p,p_revocation_request_idempotency_key);
  IF (b->>'replayed')::boolean THEN RETURN (b->'result') || '{"replayed":true}'::jsonb; END IF;
  IF p_milestone_id IS NULL THEN RAISE EXCEPTION 'INVALID_MILESTONE_ID' USING ERRCODE='22023'; END IF;
  IF p->>'reason' IS NULL THEN RAISE EXCEPTION 'MISSING_REVOCATION_REASON' USING ERRCODE='22023'; END IF;
  PERFORM public.phase8e_lock_reward_account_key(u);
  SELECT * INTO account FROM public.reward_accounts WHERE user_id=u FOR UPDATE;
  SELECT * INTO m FROM public.milestones WHERE id=p_milestone_id AND user_id=u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MILESTONE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF m.status <> 'ACTIVE' THEN RAISE EXCEPTION 'MILESTONE_ALREADY_REVOKED' USING ERRCODE='23505'; END IF;
  IF m.granted_reward_credit THEN
    SELECT * INTO original FROM public.reward_transactions WHERE id=m.reward_transaction_id FOR UPDATE;
    IF original.id IS NULL OR account.id IS NULL OR original.account_id IS DISTINCT FROM account.id
      OR original.user_id IS DISTINCT FROM u OR original.event_kind IS DISTINCT FROM 'EARN'
      OR original.amount <= 0 OR original.canonical_source_type IS DISTINCT FROM m.source_type
      OR original.canonical_source_id IS DISTINCT FROM m.source_id OR original.policy_version IS DISTINCT FROM 'reward-v1' THEN
      RAISE EXCEPTION 'MILESTONE_REWARD_PROVENANCE_INVALID' USING ERRCODE='P0001';
    END IF;
    SELECT * INTO correction FROM public.reward_transactions WHERE correction_for_id=original.id AND event_kind='CORRECTION' FOR UPDATE;
    reused := FOUND;
    IF reused THEN
      IF correction.user_id IS DISTINCT FROM u OR correction.account_id IS DISTINCT FROM account.id
        OR correction.amount IS DISTINCT FROM -original.amount
        OR correction.canonical_source_type IS DISTINCT FROM original.canonical_source_type
        OR correction.canonical_source_id IS DISTINCT FROM original.canonical_source_id
        OR correction.policy_version IS DISTINCT FROM original.policy_version THEN
        RAISE EXCEPTION 'MILESTONE_CORRECTION_PROVENANCE_INVALID' USING ERRCODE='P0001';
      END IF;
      preview := public.phase8e_preview_reward_account(account.id,u,account.updated_at);
      IF preview IS DISTINCT FROM to_jsonb(account) THEN
        RAISE EXCEPTION 'REWARD_ACCOUNT_PARITY_FAILED' USING ERRCODE='P0001';
      END IF;
    ELSE
      INSERT INTO public.reward_transactions(account_id,user_id,event_kind,amount,canonical_source_type,
        canonical_source_id,policy_version,request_idempotency_key,correction_for_id,note)
      VALUES(account.id,u,'CORRECTION',-original.amount,original.canonical_source_type,original.canonical_source_id,
        original.policy_version,btrim(p_revocation_request_idempotency_key),original.id,'Milestone revoked: ' || (p->>'reason'))
      RETURNING * INTO correction;
      stamp := clock_timestamp();
      preview := public.phase8e_preview_reward_account(account.id,u,stamp);
    END IF;
  END IF;
  UPDATE public.milestones SET status='REVOKED',revoked_at=clock_timestamp(),revocation_reason=p->>'reason',
    revocation_request_idempotency_key=btrim(p_revocation_request_idempotency_key)
    WHERE id=m.id RETURNING * INTO m;
  r := jsonb_build_object('ok',true,'milestone',to_jsonb(m),'correction',
    CASE WHEN correction.id IS NOT NULL THEN to_jsonb(correction) ELSE NULL END,
    'correction_reused',reused,'account',preview,'replayed',false);
  PERFORM public.phase8f_write_audit(u,'MILESTONE_REVOKED','milestones',m.id,p_revocation_request_idempotency_key,
    'rpc_revoke_milestone','milestones',p_milestone_id::text,p,b->>'fingerprint',r);
  IF m.granted_reward_credit AND NOT reused THEN
    IF public.phase8e_apply_reward_account(account.id,u,stamp) IS DISTINCT FROM preview THEN
      RAISE EXCEPTION 'REWARD_ACCOUNT_PARITY_FAILED' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN r;
END;
$$;

-- Rename preserves the entire accepted body/signature, including historical errors.
ALTER FUNCTION public.rpc_review_outer_loop_proposal(uuid,text,jsonb,text,text)
  RENAME TO phase8e_review_outer_loop_proposal;
REVOKE ALL ON FUNCTION public.phase8e_review_outer_loop_proposal(uuid,text,jsonb,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_review_outer_loop_proposal(
  p_proposal_id uuid, p_decision text, p_edited_payload jsonb,
  p_rejection_reason text, p_review_request_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE u uuid := auth.uid(); proposal public.outer_loop_proposals%ROWTYPE;
  v_decision text := upper(public.phase8f_trim_text(p_decision)); p jsonb; payload jsonb; b jsonb; r jsonb;
  m public.milestones%ROWTYPE;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE='28000'; END IF;
  -- Routing only: never lock a proposal before acquiring its shared request key.
  SELECT * INTO proposal FROM public.outer_loop_proposals WHERE id=p_proposal_id AND user_id=u;
  IF NOT FOUND OR proposal.proposal_type <> 'MILESTONE_CANDIDATE' THEN
    RETURN public.phase8e_review_outer_loop_proposal(p_proposal_id,p_decision,p_edited_payload,
      p_rejection_reason,p_review_request_idempotency_key);
  END IF;
  p := jsonb_build_object('decision',v_decision,'edited_payload',public.phase8f_normalize_payload(p_edited_payload),
    'rejection_reason',nullif(public.phase8f_trim_text(p_rejection_reason),''));
  b := public.phase8f_begin_request(u,'rpc_review_outer_loop_proposal','outer_loop_proposals',p_proposal_id::text,p,p_review_request_idempotency_key);
  IF (b->>'replayed')::boolean THEN RETURN (b->'result') || '{"replayed":true}'::jsonb; END IF;
  SELECT * INTO proposal FROM public.outer_loop_proposals WHERE id=p_proposal_id AND user_id=u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF proposal.proposal_type <> 'MILESTONE_CANDIDATE' THEN
    RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE='22023';
  END IF;
  IF v_decision IS NULL OR v_decision NOT IN ('ACCEPTED','EDITED','REJECTED') THEN
    RAISE EXCEPTION 'INVALID_PROPOSAL_DECISION' USING ERRCODE='22023';
  END IF;
  IF (v_decision='EDITED' AND p_edited_payload IS NULL)
    OR (v_decision<>'EDITED' AND p_edited_payload IS NOT NULL) THEN
    RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE='22023';
  END IF;
  IF proposal.status <> 'PROPOSED' THEN RAISE EXCEPTION 'PROPOSAL_ALREADY_REVIEWED' USING ERRCODE='23505'; END IF;
  IF proposal.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'PROPOSAL_EXPIRED' USING ERRCODE='22023'; END IF;
  IF v_decision <> 'REJECTED' THEN
    IF proposal.schema_version <> 2 THEN RAISE EXCEPTION 'SCHEMA_VALIDATION_FAILED' USING ERRCODE='22023'; END IF;
    payload := CASE WHEN v_decision='EDITED' THEN p->'edited_payload'
      ELSE public.phase8f_normalize_payload(proposal.payload) END;
    BEGIN
      m := public.phase8f_confirm_record(u,payload,p_review_request_idempotency_key);
    EXCEPTION WHEN SQLSTATE '22023' OR SQLSTATE 'P0001' THEN
      RAISE EXCEPTION 'PAYLOAD_VALIDATION_FAILED' USING ERRCODE='22023';
    END;
  END IF;
  UPDATE public.outer_loop_proposals SET status=v_decision,decision=v_decision,reviewed_at=clock_timestamp(),reviewed_by_id=u,
    review_request_idempotency_key=btrim(p_review_request_idempotency_key),
    rejection_reason=CASE WHEN v_decision='REJECTED' THEN p->>'rejection_reason' ELSE NULL END,
    resulting_entity_type=CASE WHEN m.id IS NOT NULL THEN 'milestones' ELSE NULL END,resulting_entity_id=m.id
    WHERE id=proposal.id RETURNING * INTO proposal;
  r := jsonb_build_object('proposal',to_jsonb(proposal),'reviewed_payload',payload,
    'milestone',CASE WHEN m.id IS NOT NULL THEN to_jsonb(m) ELSE NULL END,
    'result',CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('milestone_id',m.id) ELSE NULL END,'replayed',false);
  PERFORM public.phase8f_write_audit(u,'PROPOSAL_REVIEWED','outer_loop_proposals',p_proposal_id,p_review_request_idempotency_key,
    'rpc_review_outer_loop_proposal','outer_loop_proposals',p_proposal_id::text,p,b->>'fingerprint',r);
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.phase8f_trim_text(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase8f_normalize_payload(jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase8f_begin_request(uuid,text,text,text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase8f_write_audit(uuid,text,text,uuid,text,text,text,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase8f_validate_source(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase8f_confirm_record(uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_confirm_milestone(text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_settle_milestone_reward(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_revoke_milestone(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_review_outer_loop_proposal(uuid,text,jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_milestone(text,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_settle_milestone_reward(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_milestone(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_outer_loop_proposal(uuid,text,jsonb,text,text) TO authenticated;
