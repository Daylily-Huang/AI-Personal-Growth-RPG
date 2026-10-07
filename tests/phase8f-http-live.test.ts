import http from "node:http";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import next from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import type { MilestoneProposal, MilestoneResult, MilestoneSource, MilestoneView } from "@/lib/milestone/types";
import type { Wish, RewardRedemption } from "@/lib/reward/types";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
type Actor = { id: string; cookie: string; client: SupabaseClient };
type Json = Record<string, unknown>;
type Payload = MilestoneResult & { code: string; milestones: MilestoneView[]; milestone: MilestoneView;
  sources: MilestoneSource[]; proposals: MilestoneProposal[]; nextOffset: number | null; result: Json; authoritative: boolean;
  wish: Wish; redemption: RewardRedemption };

describe.skipIf(!databaseUrl)("8F Round3 real Next/Auth/PostgreSQL HTTP (disposable stack)", () => {
  const pg = new Client({ connectionString: databaseUrl });
  let app: ReturnType<typeof next>; let server: http.Server; let base: string;
  let a: Actor; let b: Actor; let domain: string; let coreSkill: string;
  let core: unknown; let otherCore: unknown;
  const coreTables = ["player_states", "domains", "quests", "skills", "activities", "ai_assessments", "xp_transactions",
    "mastery_events", "mastery_verifications", "evidence_records", "knowledge_nodes", "artifacts", "seasons", "season_reviews"];
  const financeTables = ["reward_accounts", "reward_transactions", "reward_redemptions", "wishes", "milestones", "outer_loop_proposals", "outer_loop_audit_events"];
  async function snapshot(tables: string[], user = a.id) {
    const result: Record<string, unknown> = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) as row from public.${table} t where user_id=$1 order by to_jsonb(t)::text`, [user])).rows;
    return result;
  }
  // Explicit fixture creation is the only allowed Core delta; every later HTTP flow checks the populated baseline.
  async function seed(sql: string, args: unknown[] = []) {
    if (core) expect(await snapshot(coreTables)).toEqual(core);
    if (otherCore) expect(await snapshot(coreTables,b.id)).toEqual(otherCore);
    const result = await pg.query(sql, args); core = await snapshot(coreTables);
    if (otherCore) otherCore = await snapshot(coreTables,b.id);
    return result;
  }
  async function actor(): Promise<Actor> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const credentials = { email: `phase8f-http-${randomUUID()}@example.test`, password: `8f-${randomUUID()}!` };
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    expect(created.error).toBeNull(); if (!created.data.user) throw Error("Test Auth user missing");
    const jar = new Map<string, string>();
    const client = createServerClient(url, key, { cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: values => { for (const value of values) { if (value.value) jar.set(value.name, value.value); else jar.delete(value.name); } },
    } });
    expect((await client.auth.signInWithPassword(credentials)).error).toBeNull();
    expect(jar.size).toBeGreaterThan(0);
    return { id: created.data.user.id, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "), client };
  }
  async function call(who: Actor | null, path: string, body?: unknown, raw = false) {
    const response = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", redirect: "manual",
      headers: { ...(who ? { Cookie: who.cookie } : {}), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: raw ? String(body) : JSON.stringify(body) }) });
    const payload = await response.json() as Payload;
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    return { status: response.status, body: payload };
  }
  async function quest(size = "epic", status = "completed", boss = false, owner?: Actor) {
    const id = randomUUID();
    await seed("insert into quests(id,user_id,title,quest_type,quest_size,status,is_boss) values($1,$2,'HTTP source','skill',$3,$4,$5)", [id, (owner ?? a).id, size, status, boss]);
    return id;
  }
  const confirmation = (sourceId: string, more: Json = {}) => ({ milestoneKey: "epic", title: "HTTP recognition", description: null,
    recognitionClass: "CORE_VERIFIED", sourceType: "QUEST", sourceId, confirmationRequestIdempotencyKey: randomUUID(), ...more });
  async function recognize(sourceId: string, more: Json = {}, who?: Actor) {
    const response = await call(who ?? a, "/api/milestones", confirmation(sourceId, more));
    expect(response.status, JSON.stringify(response.body)).toBe(200); return response.body;
  }
  async function proposal(payload: Json, version = 2, expired = false, type = "MILESTONE_CANDIDATE") {
    const id = randomUUID();
    await pg.query(`insert into outer_loop_proposals(id,user_id,proposal_type,schema_version,payload,created_at,expires_at)
      values($1,$2,$3,$4,$5,clock_timestamp()-interval '2 days',clock_timestamp()+$6::interval)`, [id,a.id,type,version,payload,expired ? "-1 day" : "1 day"]);
    return id;
  }
  const proposalPayload = (id: string) => ({ milestone_key: "epic", title: "Candidate", description: null,
    recognition_class: "CORE_VERIFIED", source_type: "QUEST", source_id: id });

  beforeAll(async () => {
    const url = new URL(databaseUrl!); const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !["127.0.0.1", "localhost"].includes(api.hostname)) throw Error("Only local disposable HTTP fixtures authorized");
    if (process.env.GITHUB_ACTIONS !== "true") {
      const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK;
      if (!project || !/^phase8f_(?:r3|test)_[a-z0-9_]+$/.test(project) || url.port !== "54332" || api.port !== "54331") throw Error("8F HTTP requires a task-owned disposable stack, never the persistent development DB");
      const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "com.supabase.cli.project"}}', `supabase_db_${project}`], { encoding: "utf8" }).trim();
      if (label !== project) throw Error("Disposable database ownership not verified");
    }
    await pg.connect();
    expect((await pg.query("select to_regprocedure('public.rpc_confirm_milestone(text,text,text,text,text,text,text,text,text)') is not null as v")).rows[0].v).toBe(true);
    app = next({ dev: false, hostname: "127.0.0.1", dir: process.cwd() }); await app.prepare();
    const handle = app.getRequestHandler(); server = http.createServer((req, res) => handle(req, res));
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw Error("Missing test port");
    base = `http://127.0.0.1:${address.port}`;
    a = await actor(); b = await actor(); domain = randomUUID(); coreSkill = randomUUID();
    const activity = randomUUID(), assessment = randomUUID();
    await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'HTTP existing Core',$3)", [domain,a.id,domain]);
    await pg.query("insert into skills(id,user_id,domain_id,name,xp,mastery_level) values($1,$2,$3,'Existing Core',500,10)", [coreSkill,a.id,domain]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing','Evidence','confirmed','8f-http')", [activity,a.id]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,rules_version,status,assessment_json) values($1,$2,$3,'8f-http','confirmed','{}')", [assessment,a.id,activity]);
    await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,domain_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,$5,500,500,'8f-http','Existing Core')", [a.id,activity,assessment,domain,coreSkill]);
    await pg.query("update player_states set total_xp=500 where user_id=$1", [a.id]);
    await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing',true)", [a.id,activity,coreSkill]);
    core = await snapshot(coreTables);
    otherCore = await snapshot(coreTables,b.id);
  }, 60000);
  afterEach(async () => {
    if (core) expect(await snapshot(coreTables)).toEqual(core);
    if (otherCore) expect(await snapshot(coreTables,b.id)).toEqual(otherCore);
  });
  afterAll(async () => {
    try { if (core) expect(await snapshot(coreTables)).toEqual(core); }
    finally {
      if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
      if (app) await app.close();
      await pg.end();
    }
    // Milestone history is immutable. Do NOT disable triggers, cascade-delete Auth users,
    // or clean unrelated rows. The explicitly disposable task stack / GitHub runner
    // owns final whole-environment disposal (recorded separately, not claimed here).
  });

  test("all entrypoints authenticate before malformed input and return private no-store", async () => {
    for (const path of ["/api/milestones?limit=bad", `/api/milestones/${randomUUID()}`, "/api/milestones/sources?sourceType=ARTIFACT", "/api/milestones/proposals"]) {
      expect((await call(null,path)).status).toBe(401);
    }
    for (const path of ["/api/milestones", `/api/milestones/${randomUUID()}/settle`, `/api/milestones/${randomUUID()}/revoke`, `/api/outer-loop/proposals/${randomUUID()}/review`]) {
      expect((await call(null,path,"{",true)).status).toBe(401);
    }
  });
  test("empty read paths do not create accounts, milestones or Core state", async () => {
    const before = await snapshot(financeTables);
    expect((await call(a,"/api/milestones")).body.milestones).toEqual([]);
    expect((await call(a,"/api/milestones/sources?sourceType=MASTERY&threshold=10")).body.sources).toEqual([]);
    expect((await call(a,"/api/milestones/proposals")).body.proposals).toEqual([]);
    expect(await snapshot(financeTables)).toEqual(before); expect(await snapshot(coreTables)).toEqual(core);
  });
  test("recognition, settlement, revocation and retries preserve exact original snapshots", async () => {
    const source = await quest(); const input = confirmation(source); const financial = await snapshot(["reward_accounts", "reward_transactions"]);
    const first = await call(a,"/api/milestones",input); expect(first.status).toBe(200);
    expect(await snapshot(["reward_accounts", "reward_transactions"])).toEqual(financial);
    const id = first.body.milestone.id; const key = randomUUID();
    const settled = await call(a,`/api/milestones/${id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:key});
    expect(settled.status,JSON.stringify(settled.body)).toBe(200); expect(settled.body.transaction?.amount).toBe(150);
    expect((await call(a,`/api/milestones/${id}`)).body.milestone.reward.status).toBe("ISSUED");
    const revokeInput = {revocationReason:"Withdraw",revocationRequestIdempotencyKey:randomUUID()};
    const revoked = await call(a,`/api/milestones/${id}/revoke`,revokeInput);
    expect(revoked.status).toBe(200); expect(revoked.body.correction?.amount).toBe(-150);
    const current = (await call(a,`/api/milestones/${id}`)).body.milestone;
    expect(current).toMatchObject({status:"REVOKED",granted_reward_credit:true,reward_transaction_id:settled.body.transaction?.id,reward:{status:"CORRECTED"}});
    const after = await snapshot(financeTables);
    expect((await call(a,"/api/milestones",{...input,sourceId:`{${source.toUpperCase()}}`})).body).toEqual({...first.body,replayed:true});
    expect((await call(a,`/api/milestones/${id.toUpperCase()}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:key})).body).toEqual({...settled.body,replayed:true});
    expect((await call(a,`/api/milestones/${id}/revoke`,revokeInput)).body).toEqual({...revoked.body,replayed:true});
    expect((await call(a,`/api/milestones/${id}/revoke`,{...revokeInput,revocationReason:"Changed"})).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await snapshot(financeTables)).toEqual(after); expect(await snapshot(coreTables)).toEqual(core);
  });
  test("known key conflicts before invalid source/foreign target lookup; malformed input never leaks SQL", async () => {
    const source = await quest(); const input = confirmation(source); expect((await call(a,"/api/milestones",input)).status).toBe(200);
    const before = await snapshot(financeTables);
    for (const sourceId of ["malformed",randomUUID()]) expect((await call(a,"/api/milestones",{...input,sourceId})).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect((await call(a,`/api/milestones/${randomUUID()}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:input.confirmationRequestIdempotencyKey})).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    for (const extra of [{amount:200},{userId:b.id},{granted_reward_credit:true}]) expect((await call(a,"/api/milestones",{...confirmation(source),...extra})).status).toBe(400);
    const malformed = await call(a,"/api/milestones",confirmation("broken")); expect(malformed.status).toBe(400);
    expect(JSON.stringify(malformed.body)).not.toMatch(/pg_|constraint|PL\/pgSQL|secret|SELECT/);
    expect(await snapshot(financeTables)).toEqual(before);
  });
  test("real-world metadata is self-attestation, never fetched or funded; unfunded revoke creates no account", async () => {
    let fetched = 0; const trap = http.createServer((_req,res)=>{fetched++;res.end("not verification");});
    await new Promise<void>(resolve=>trap.listen(0,"127.0.0.1",resolve));
    try {
      const address=trap.address(); if(!address||typeof address==="string") throw Error("Missing trap port");
      const before=await snapshot(["reward_accounts","reward_transactions"],b.id);
      const m=await recognize(randomUUID(),{recognitionClass:"USER_CONFIRMED_REAL_WORLD",sourceType:"EXTERNAL_CREDENTIAL",externalEvidenceUrl:`http://127.0.0.1:${address.port}/private`,externalCredentialId:"self-attested-doi"},b);
      const read=await call(b,`/api/milestones/${m.milestone.id}`);
      expect(read.body.milestone).toMatchObject({selfAttested:true,reward:{status:"NOT_AVAILABLE"}});
      expect((await call(b,`/api/milestones/${m.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()})).status).toBe(422);
      expect((await call(b,`/api/milestones/${m.milestone.id}/revoke`,{revocationReason:"No longer claimed",revocationRequestIdempotencyKey:randomUUID()})).status).toBe(200);
      expect(await snapshot(["reward_accounts","reward_transactions"],b.id)).toEqual(before); expect(fetched).toBe(0);
    } finally { trap.closeAllConnections(); await new Promise<void>(resolve=>trap.close(()=>resolve())); }
  });
  test("tenant isolation applies to HTTP and direct authenticated table/private helper access", async () => {
    const source=await quest(); const m=await recognize(source); const before=await snapshot(financeTables);
    for(const id of [m.milestone.id,randomUUID()]) {
      expect((await call(b,`/api/milestones/${id}`)).body.code).toBe("MILESTONE_NOT_FOUND");
      expect((await call(b,`/api/milestones/${id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()})).status).toBe(404);
      expect((await call(b,`/api/milestones/${id}/revoke`,{revocationReason:"Foreign",revocationRequestIdempotencyKey:randomUUID()})).status).toBe(404);
    }
    expect((await call(b,"/api/milestones",confirmation(source))).status).toBe(404);
    expect((await b.client.from("milestones").select("*").eq("id",m.milestone.id)).data).toEqual([]);
    expect((await a.client.from("milestones").update({status:"REVOKED"}).eq("id",m.milestone.id)).error).not.toBeNull();
    expect((await a.client.from("milestones").delete().eq("id",m.milestone.id)).error).not.toBeNull();
    expect((await a.client.rpc("phase8f_trim_text",{p_text:"x"})).error).not.toBeNull();
    expect(await snapshot(financeTables)).toEqual(before);
  });
  test("direct reward cannot be reattached or minted through a milestone, including corrected history", async () => {
    const source=await quest(); const key=randomUUID();
    const grant=await call(a,"/api/rewards/grants",{sourceType:"QUEST",sourceId:source,policyVersion:"reward-v1",requestIdempotencyKey:key});
    expect(grant.status).toBe(200); const m=await recognize(source);
    expect((await call(a,`/api/milestones/${m.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()})).body.code).toBe("REWARD_ALREADY_MINTED_FOR_SOURCE");
    const corrected=await call(a,`/api/rewards/transactions/${grant.body.transaction!.id}/correct`,{note:"Wrong claim",requestIdempotencyKey:randomUUID()});
    expect(corrected.status).toBe(200);
    const view=(await call(a,`/api/milestones/${m.milestone.id}`)).body.milestone;
    expect(view.reward.status).toBe("NOT_ISSUED"); expect(view.reward.transaction).toBeNull();
    expect(view.reward.existingSourceReward?.correction?.amount).toBe(-150);
    const before=await snapshot(["reward_accounts","reward_transactions"]);
    expect((await call(a,`/api/milestones/${m.milestone.id}/revoke`,{revocationReason:"Unfunded",revocationRequestIdempotencyKey:randomUUID()})).status).toBe(200);
    expect(await snapshot(["reward_accounts","reward_transactions"])).toEqual(before);
  });
  test("linked EARN corrected earlier remains visible and revoke reuses it without changing finances", async () => {
    const m=await recognize(await quest());
    const settled=await call(a,`/api/milestones/${m.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()});
    expect(settled.status).toBe(200);
    const corrected=await call(a,`/api/rewards/transactions/${settled.body.transaction!.id}/correct`,{note:"Prior correction",requestIdempotencyKey:randomUUID()});
    expect(corrected.status).toBe(200);
    expect((await call(a,`/api/milestones/${m.milestone.id}`)).body.milestone).toMatchObject({status:"ACTIVE",reward:{status:"CORRECTED"}});
    const before=await snapshot(["reward_accounts","reward_transactions","wishes","reward_redemptions"]);
    const revoked=await call(a,`/api/milestones/${m.milestone.id}/revoke`,{revocationReason:"After correction",revocationRequestIdempotencyKey:randomUUID()});
    expect(revoked.status).toBe(200); expect(revoked.body.correction_reused).toBe(true);
    expect(revoked.body.correction?.id).toBe(corrected.body.transaction?.id);
    expect(await snapshot(["reward_accounts","reward_transactions","wishes","reward_redemptions"])).toEqual(before);
  });
  test("spent reward revocation preserves Wish/receipt and later EARN repays the deficit", async () => {
    // B has no financial account, but retains the earlier self-attested history.
    const source=await quest("epic","completed",false,b); const m=await recognize(source,{},b);
    expect((await call(b,`/api/milestones/${m.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()})).body.account?.current_available).toBe(150);
    const created=await call(b,"/api/rewards/wishes",{title:"Celebration",creditCost:150});
    expect(created.status).toBe(201); const wishId=created.body.wish.id;
    for (const action of ["activate","set-primary","reserve","redeem"]) {
      const response=await call(b,`/api/rewards/wishes/${wishId}/${action}`,{requestIdempotencyKey:randomUUID()});
      expect(response.status,JSON.stringify(response.body)).toBe(200);
    }
    const receipt=await snapshot(["wishes","reward_redemptions"],b.id);
    const revoked=await call(b,`/api/milestones/${m.milestone.id}/revoke`,{revocationReason:"Spent source invalidated",revocationRequestIdempotencyKey:randomUUID()});
    expect(revoked.status).toBe(200); expect(revoked.body.account).toMatchObject({current_available:0,correction_deficit:150,lifetime_redeemed:150});
    const next=await recognize(await quest("main","completed",false,b),{},b);
    const earned=await call(b,`/api/milestones/${next.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()});
    expect(earned.status).toBe(200); expect(earned.body.account).toMatchObject({current_available:50,correction_deficit:0,lifetime_redeemed:150});
    expect(await snapshot(["wishes","reward_redemptions"],b.id)).toEqual(receipt);
  });
  test("concurrent same-key confirm/settle/revoke requests yield one write and immutable replay", async () => {
    const source=await quest(); const input=confirmation(source);
    async function pair(path:string,body:Json) {
      const responses=await Promise.all([call(a,path,body),call(a,path,body)]);
      expect(responses.map(r=>r.status)).toEqual([200,200]);
      expect(responses.map(r=>r.body.replayed).sort()).toEqual([false,true]);
      expect({...responses[0].body,replayed:false}).toEqual({...responses[1].body,replayed:false});
      return responses[0].body;
    }
    const confirmed=await pair("/api/milestones",input);
    const settled=await pair(`/api/milestones/${confirmed.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()});
    await pair(`/api/milestones/${confirmed.milestone.id}/revoke`,{revocationReason:"Concurrent",revocationRequestIdempotencyKey:randomUUID()});
    expect((await pg.query("select count(*)::int n from reward_transactions where id=$1 or correction_for_id=$1",[settled.transaction!.id])).rows[0].n).toBe(2);
    expect((await pg.query("select count(*)::int n from outer_loop_audit_events where user_id=$1 and entity_id=$2",[a.id,confirmed.milestone.id])).rows[0].n).toBe(3);
  });
  test("concurrent direct grant/settle and correction/revoke keep exactly one EARN and correction", async () => {
    const source=await quest(); const m=await recognize(source);
    const grants=await Promise.all([
      call(a,`/api/milestones/${m.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()}),
      call(a,"/api/rewards/grants",{sourceType:"QUEST",sourceId:source,policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()}),
    ]);
    expect(grants.map(r=>r.status).sort()).toEqual([200,409]);
    const earn=(await pg.query("select id from reward_transactions where user_id=$1 and canonical_source_id=$2 and event_kind='EARN'",[a.id,source])).rows;
    expect(earn).toHaveLength(1);
    // Use a funded milestone for the correction/revoke race irrespective of the first race winner.
    const funded=await recognize(await quest());
    const settled=await call(a,`/api/milestones/${funded.milestone.id}/settle`,{policyVersion:"reward-v1",requestIdempotencyKey:randomUUID()});
    expect(settled.status).toBe(200);
    const [revoked,corrected]=await Promise.all([
      call(a,`/api/milestones/${funded.milestone.id}/revoke`,{revocationReason:"Race",revocationRequestIdempotencyKey:randomUUID()}),
      call(a,`/api/rewards/transactions/${settled.body.transaction!.id}/correct`,{note:"Race",requestIdempotencyKey:randomUUID()}),
    ]);
    expect(revoked.status).toBe(200); expect([200,409]).toContain(corrected.status);
    expect((await pg.query("select count(*)::int n from reward_transactions where correction_for_id=$1",[settled.body.transaction!.id])).rows[0].n).toBe(1);
    expect((await call(a,`/api/milestones/${funded.milestone.id}`)).body.milestone).toMatchObject({status:"REVOKED",reward:{status:"CORRECTED"}});
  });
  test("v2 proposal acceptance only recognizes, replays before CAS, and binds complete decision tuple", async () => {
    const source=await quest(); const payload=proposalPayload(source); const id=await proposal(payload);
    const input={decision:"ACCEPTED",reviewRequestIdempotencyKey:randomUUID()}; const path=`/api/outer-loop/proposals/${id}/review`;
    const before=await snapshot(["reward_accounts","reward_transactions"]);
    expect((await call(b,path,input)).status).toBe(404);
    const accepted=await call(a,path,input); expect(accepted.status,JSON.stringify(accepted.body)).toBe(200);
    expect(accepted.body.result.milestone).toMatchObject({granted_reward_credit:false});
    expect((await call(a,path,input)).body.result).toEqual({...accepted.body.result,replayed:true});
    expect((await call(a,path,{...input,decision:"REJECTED"})).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect((await call(a,path,{...input,reviewRequestIdempotencyKey:randomUUID()})).status).toBe(409);
    expect((await pg.query("select payload from outer_loop_proposals where id=$1",[id])).rows[0].payload).toEqual(payload);
    expect(await snapshot(["reward_accounts","reward_transactions"])).toEqual(before);
  });
  test("v1 reject-only, expired proposals and unknown AI amounts fail without writes; v2 edit preserves original", async () => {
    const source=await quest(); const original=proposalPayload(source);
    const legacy=await proposal(original,1), expired=await proposal(original,2,true), forged=await proposal({...original,reward_credit_value:999});
    const edited=await proposal({...original,title:"Original"});
    const before=await snapshot(financeTables);
    for(const id of [legacy,expired,forged]) expect((await call(a,`/api/outer-loop/proposals/${id}/review`,{decision:"ACCEPTED",reviewRequestIdempotencyKey:randomUUID()})).status).toBe(422);
    expect((await call(a,`/api/outer-loop/proposals/${edited}/review`,{decision:"EDITED",editedPayload:{title:"Incomplete"},reviewRequestIdempotencyKey:randomUUID()})).status).toBe(422);
    expect(await snapshot(financeTables)).toEqual(before);
    expect((await call(a,`/api/outer-loop/proposals/${legacy}/review`,{decision:"REJECTED",rejectionReason:"Legacy",reviewRequestIdempotencyKey:randomUUID()})).status).toBe(200);
    const edit=await call(a,`/api/outer-loop/proposals/${edited}/review`,{decision:"EDITED",editedPayload:{...original,title:"Edited"},reviewRequestIdempotencyKey:randomUUID()});
    expect(edit.status).toBe(200); expect(edit.body.result.milestone).toMatchObject({title:"Edited",granted_reward_credit:false});
    expect((await pg.query("select payload->>'title' as title from outer_loop_proposals where id=$1",[edited])).rows[0].title).toBe("Original");
  });
  test("proposal concurrency and reads preserve full payload/version, history and tenant isolation", async () => {
    const source=await quest(); const payload=proposalPayload(source); const id=await proposal(payload);
    const input={decision:"ACCEPTED",reviewRequestIdempotencyKey:randomUUID()}; const path=`/api/outer-loop/proposals/${id}/review`;
    const responses=await Promise.all([call(a,path,input),call(a,path,input)]);
    expect(responses.map(r=>r.status)).toEqual([200,200]);
    expect(responses.map(r=>r.body.result.replayed).sort()).toEqual([false,true]);
    const other=await proposal(proposalPayload(await quest()));
    const cas=await Promise.all(["ACCEPTED","REJECTED"].map(decision=>call(a,`/api/outer-loop/proposals/${other}/review`,{decision,reviewRequestIdempotencyKey:randomUUID()})));
    expect(cas.map(r=>r.status).sort()).toEqual([200,409]);
    const legacy=await proposal(payload,1), expired=await proposal(payload,2,true), fresh=await proposal(payload);
    const page=await call(a,"/api/milestones/proposals?limit=100"); expect(page.status).toBe(200);
    expect(page.body.proposals.find(p=>p.id===id)).toMatchObject({payload,schema_version:2,status:"ACCEPTED",availableDecisions:[]});
    expect(page.body.proposals.find(p=>p.id===legacy)).toMatchObject({supportedSchema:false,availableDecisions:["REJECTED"]});
    expect(page.body.proposals.find(p=>p.id===expired)).toMatchObject({availableDecisions:[]});
    expect(page.body.proposals.find(p=>p.id===fresh)).toMatchObject({supportedSchema:true,availableDecisions:["ACCEPTED","EDITED","REJECTED"]});
    expect((await call(b,"/api/milestones/proposals")).body.proposals).toEqual([]);
  });
  test("eligible discovery excludes ordinary Major and incomplete quests; Boss exception stays", async () => {
    const major=await quest("major"), incomplete=await quest("epic","active"), boss=await quest("major","completed",true);
    const response=await call(a,"/api/milestones/sources?sourceType=QUEST&limit=100"); expect(response.status).toBe(200);
    const ids=response.body.sources.map(row=>row.sourceId); expect(ids).not.toContain(major); expect(ids).not.toContain(incomplete); expect(ids).toContain(boss);
    expect((await call(a,"/api/milestones",confirmation(major))).status).toBe(422);
    expect((await call(a,"/api/milestones",confirmation(boss,{sourceType:"ARTIFACT"}))).status).toBe(400);
  });
  test("Mastery candidates page unique skills despite >1000 duplicate verifications; exact tiers only", async () => {
    const skill=randomUUID();
    await seed("insert into skills(id,user_id,domain_id,name,mastery_level) values($1,$2,$3,'Other verified',10)",[skill,a.id,domain]);
    await seed(`insert into mastery_verifications(user_id,skill_id,skill_name,from_level,to_level,evidence_level,status)
      select $1,$2,'Duplicated exact threshold',5,6,6,'verified' from generate_series(1,1005)`,[a.id,coreSkill]);
    await seed("insert into mastery_verifications(user_id,skill_id,skill_name,from_level,to_level,evidence_level,status) values($1,$2,'Other',5,6,6,'verified'),($1,$2,'Other',7,8,6,'verified')",[a.id,skill]);
    const seen:string[]=[]; let offset:number|null=0;
    do { const response=await call(a,`/api/milestones/sources?sourceType=MASTERY&threshold=6&limit=1&offset=${offset}`);
      expect(response.status,JSON.stringify(response.body)).toBe(200); seen.push(...response.body.sources.map(row=>row.sourceId)); offset=response.body.nextOffset;
    } while(offset!==null);
    expect(seen.sort()).toEqual([`${coreSkill}:M6`,`${skill}:M6`].sort());
    expect((await call(a,"/api/milestones/sources?sourceType=MASTERY&threshold=8")).body.sources.map(row=>row.sourceId)).toEqual([`${skill}:M8`]);
    expect((await call(a,"/api/milestones/sources?sourceType=MASTERY&threshold=10")).body.sources).toEqual([]);
  });
  test("Season discovery requires an owned FINAL review and does not duplicate amendment versions", async () => {
    const good=randomUUID(), missing=randomUUID();
    await seed(`insert into seasons(id,user_id,name,status,started_at,ended_at) values
      ($1,$3,'With final','COMPLETED',clock_timestamp()-interval '1 day',clock_timestamp()),
      ($2,$3,'Without final','COMPLETED',clock_timestamp()-interval '1 day',clock_timestamp())`,[good,missing,a.id]);
    await seed(`insert into season_reviews(user_id,season_id,review_type,version,commit_key,period_start,period_end,objective_summary,qualitative_reflection,criteria_evaluation)
      select $1,$2,'FINAL',g,gen_random_uuid(),clock_timestamp()-interval '1 day',clock_timestamp(),'{}','Final','{}' from generate_series(1,2) g`,[a.id,good]);
    const response=await call(a,"/api/milestones/sources?sourceType=SEASON&limit=1");
    expect(response.status,JSON.stringify(response.body)).toBe(200); expect(response.body.sources.map(row=>row.sourceId)).toEqual([good]);
    expect(response.body.nextOffset).toBeNull();
  });
  test("history pagination remains complete past the PostgREST 1000-row per-request limit", async () => {
    const batch=randomUUID();
    await seed(`insert into quests(user_id,title,quest_type,quest_size,status)
      select $1,$2,'skill','epic','completed' from generate_series(1,1005)`,[a.id,batch]);
    await pg.query(`insert into milestones(user_id,milestone_key,title,description,recognition_class,source_type,source_id,confirmation_request_idempotency_key)
      select $1,'bulk','History',null,'CORE_VERIFIED','QUEST',id::text,id::text from quests where user_id=$1 and title=$2`,[a.id,batch]);
    const expected=Number((await pg.query("select count(*) from milestones where user_id=$1",[a.id])).rows[0].count);
    const seen:string[]=[]; let offset:number|null=0;
    do { const response=await call(a,`/api/milestones?limit=100&offset=${offset}`); expect(response.status).toBe(200);
      seen.push(...response.body.milestones.map(row=>row.id)); offset=response.body.nextOffset;
      expect(seen.length).toBeLessThanOrEqual(expected);
    } while(offset!==null);
    expect(seen.length).toBe(expected); expect(new Set(seen).size).toBe(expected); expect(expected).toBeGreaterThan(1000);
    expect((await call(b,"/api/milestones?limit=100&offset=1000")).body.milestones).toEqual([]);
    const expectedSources=Number((await pg.query("select count(*) from quests where user_id=$1 and status='completed' and (quest_size in ('epic','main') or is_boss)",[a.id])).rows[0].count);
    const sourceIds:string[]=[]; offset=0;
    do { const response=await call(a,`/api/milestones/sources?sourceType=QUEST&limit=100&offset=${offset}`); expect(response.status).toBe(200);
      sourceIds.push(...response.body.sources.map(row=>row.sourceId)); offset=response.body.nextOffset;
      expect(sourceIds.length).toBeLessThanOrEqual(expectedSources);
    } while(offset!==null);
    expect(sourceIds.length).toBe(expectedSources); expect(new Set(sourceIds).size).toBe(expectedSources);
    await pg.query(`insert into outer_loop_proposals(user_id,proposal_type,schema_version,payload)
      select $1,'MILESTONE_CANDIDATE',2,$2::jsonb from generate_series(1,1005)`,[a.id,proposalPayload(randomUUID())]);
    const expectedProposals=Number((await pg.query("select count(*) from outer_loop_proposals where user_id=$1 and proposal_type='MILESTONE_CANDIDATE'",[a.id])).rows[0].count);
    const proposalIds:string[]=[]; offset=0;
    const before=await snapshot(financeTables);
    do { const response=await call(a,`/api/milestones/proposals?limit=100&offset=${offset}`); expect(response.status).toBe(200);
      proposalIds.push(...response.body.proposals.map(row=>row.id)); offset=response.body.nextOffset;
      expect(proposalIds.length).toBeLessThanOrEqual(expectedProposals);
    } while(offset!==null);
    expect(proposalIds.length).toBe(expectedProposals); expect(new Set(proposalIds).size).toBe(expectedProposals);
    expect(await snapshot(financeTables)).toEqual(before);
    expect(await snapshot(coreTables)).toEqual(core);
  },30000);
});
