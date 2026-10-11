import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseArtifactAcceptanceReceipt } from "@/lib/artifact-acceptance/validation";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
function ownership() {
  if (!dbUrl) throw Error("Actual test database required");
  const endpoint = new URL(dbUrl);
  if (!["127.0.0.1", "localhost"].includes(endpoint.hostname)) throw Error("Only local synthetic database allowed");
  if (process.env.GITHUB_ACTIONS === "true") return;
  if (endpoint.port !== "54332" || process.env.XP_RPG_DISPOSABLE_TEST_STACK !== "phase8f_test_artifact_20261012") throw Error("Synthetic Artifact stack required");
  const receipt = JSON.parse(readFileSync(process.env.XP_RPG_ARTIFACT_CREATION_RECEIPT!, "utf8"));
  expect(receipt.project).toBe(process.env.XP_RPG_DISPOSABLE_TEST_STACK); expect(receipt.containers).toHaveLength(4);
  for (const component of ["db", "auth", "rest", "kong"]) {
    const item = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${receipt.project}`], { encoding: "utf8" }))[0];
    const captured = receipt.containers.find((x: { component: string }) => x.component === component);
    expect(item.Id).toBe(captured.id); expect(item.Created).toBe(captured.created); expect(item.State.Running).toBe(true);
    expect(item.Config.Labels["com.supabase.cli.project"]).toBe(receipt.project);
    expect(item.Config.Labels["com.supabase.cli.workdir"]).toBe(receipt.stack);
    if (component === "db" || component === "kong") {
      const ports = item.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"];
      expect(ports.length).toBeGreaterThan(0); expect(ports.every((p: { HostPort: string }) => p.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
    }
  }
}

describe.skipIf(!dbUrl)("0056 real PostgreSQL manual Artifact authority (rollback fixtures)", () => {
  const pg = new Client({ connectionString: dbUrl }); let connected = false;
  let owners: string[], user: string, other: string, artifact: string, timestamp: string, quest: string;
  let coreTables: string[], baseline: Record<string, unknown[]>;
  const receipt = (raw: unknown) => parseArtifactAcceptanceReceipt(raw, artifact, user);
  async function as(who = user, role = "authenticated") {
    if (!["authenticated", "anon", "service_role"].includes(role)) throw Error("Invalid role");
    await pg.query(`set local role ${role}`); await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [who]);
  }
  async function snapshot() {
    const value: Record<string, unknown[]> = {};
    for (const table of coreTables) value[table] = (await pg.query(`select to_jsonb(t) r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [owners])).rows.map(x => x.r);
    return value;
  }
  async function checkpoint() { await pg.query("reset role"); baseline = await snapshot(); await as(); }
  async function accept(key = randomUUID(), expected: string | null = timestamp, note: string | null = "User checked the actual deliverable", target: string | null = artifact) {
    return receipt((await pg.query("select public.rpc_accept_artifact_manual($1,$2,$3,$4) r", [target, expected, note, key])).rows[0].r);
  }
  async function revoke(key = randomUUID(), reason: string | null = "Does not meet my acceptance criteria") {
    return receipt((await pg.query("select public.rpc_revoke_artifact_manual($1,$2,$3) r", [artifact, reason, key])).rows[0].r);
  }
  async function denied(action: () => Promise<unknown>, message: string, code?: string) {
    await pg.query("savepoint rejected"); let caught: unknown;
    try { await action(); } catch (error) { caught = error; }
    finally { await pg.query("rollback to savepoint rejected"); await pg.query("release savepoint rejected"); }
    expect(caught).toMatchObject({ message: expect.stringContaining(message), ...(code ? { code } : {}) });
  }
  async function account() { return (await pg.query("select to_jsonb(t) r from public.reward_accounts t where user_id=$1", [user])).rows[0]?.r; }
  async function counts() {
    return (await pg.query("select (select count(*)::int from public.artifact_acceptances where user_id=$1) a,(select count(*)::int from public.reward_transactions where user_id=$1) t,(select count(*)::int from public.outer_loop_audit_events where user_id=$1) e", [user])).rows[0];
  }
  beforeAll(async () => {
    ownership(); await pg.connect(); connected = true;
    expect((await pg.query("select to_regprocedure('public.rpc_accept_artifact_manual(uuid,text,text,text)') is not null v")).rows[0].v).toBe(true);
    coreTables = (await pg.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' order by c.relname")).rows.map(x => x.relname).filter(t => !["reward_accounts", "reward_transactions", "outer_loop_audit_events", "artifact_acceptances"].includes(t));
    expect(coreTables.every(t => /^[a-z_]+$/.test(t))).toBe(true);
    expect(coreTables).toEqual(expect.arrayContaining(["artifacts", "activities", "ai_assessments", "skills", "player_states", "xp_transactions", "evidence_records", "wishes", "reward_redemptions"]));
  });
  beforeEach(async () => {
    await pg.query("begin"); await pg.query("set local lock_timeout='3s'");
    owners = [randomUUID(), randomUUID(), randomUUID()]; [user, other] = owners; artifact = randomUUID(); quest = randomUUID();
    for (const who of owners) {
      const domain = randomUUID(), skill = randomUUID(), activity = randomUUID(), assessment = randomUUID();
      await pg.query("insert into auth.users(id,email) values($1,$2)", [who, `${who}@example.test`]);
      await pg.query("insert into public.domains(id,user_id,name,slug) values($1,$2,'Existing',$3)", [domain, who, domain]);
      await pg.query("insert into public.skills(id,user_id,name,domain_id,xp,level,mastery_level,status) values($1,$2,'Existing',$3,500,$4,8,'active')", [skill, who, domain, playerLevelFromXp(500)]);
      await pg.query("insert into public.activities(id,user_id,title,raw_input,effective_minutes,status,rules_version) values($1,$2,'Existing','Immutable',40,'confirmed','existing')", [activity, who]);
      await pg.query("insert into public.ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json,confidence) values($1,$2,$3,'confirmed','existing','{}',0.7)", [assessment, who, activity]);
      await pg.query("insert into public.xp_transactions(user_id,activity_id,assessment_id,skill_id,domain_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,$5,500,500,'existing','Existing')", [who, activity, assessment, skill, domain]);
      await pg.query("update public.player_states set total_xp=500,player_level=$2 where user_id=$1", [who, playerLevelFromXp(500)]);
      const evidence = (await pg.query("insert into public.evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing verified',true) returning id", [who, activity, skill])).rows[0].id;
      await pg.query("insert into public.mastery_verifications(user_id,skill_id,skill_name,from_level,to_level,evidence_level,status,proposal_assessment_id,resolved_at) values($1,$2,'Existing',6,8,3,'verified',$3,now())", [who, skill, assessment]);
      const art = who === user ? artifact : randomUUID(), q = who === user ? quest : randomUUID(), node = randomUUID(), next = randomUUID();
      await pg.query("insert into public.artifacts(id,user_id,title,artifact_type,lifecycle_status,updated_at) values($1,$2,'Original deliverable','document','active','2026-10-12T01:02:03.123456Z')", [art, who]);
      await pg.query("insert into public.quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Existing reward source','learning','epic','completed')", [q, who]);
      await pg.query("insert into public.knowledge_nodes(id,user_id,domain_id,skill_id,title,verification_status,confidence) values($1,$2,$3,$4,'Existing concept','inferred',0.7),($5,$2,$3,$4,'Next concept','inferred',0.7)", [node, who, domain, skill, next]);
      await pg.query("insert into public.knowledge_edges(user_id,source_node_id,target_node_id,relation_type,verification_status,confidence) values($1,$2,$3,'prerequisite','inferred',0.7)", [who, node, next]);
      await pg.query("insert into public.artifact_activities(user_id,artifact_id,activity_id) values($1,$2,$3)", [who, art, activity]);
      await pg.query("insert into public.artifact_skills(user_id,artifact_id,skill_id) values($1,$2,$3)", [who, art, skill]);
      await pg.query("insert into public.artifact_knowledge_nodes(user_id,artifact_id,node_id) values($1,$2,$3)", [who, art, node]);
      await pg.query("insert into public.artifact_quests(user_id,artifact_id,quest_id) values($1,$2,$3)", [who, art, q]);
      await pg.query("insert into public.artifact_evidence(user_id,artifact_id,evidence_id) values($1,$2,$3)", [who, art, evidence]);
      await pg.query("insert into public.outer_loop_proposals(user_id,proposal_type,schema_version,payload,model_metadata) values($1,'REVIEW_SUMMARY',1,'{}','{\"model\":\"existing\",\"prompt_contract\":\"frozen\",\"temperature\":0.7}')", [who]);
    }
    timestamp = (await pg.query("select to_char(updated_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') v from public.artifacts where id=$1", [artifact])).rows[0].v;
    expect(playerLevelFromXp(500)).toBe(4); await checkpoint();
  });
  afterEach(async () => { try { await pg.query("reset role"); expect(await snapshot()).toEqual(baseline); } finally { await pg.query("rollback"); } });
  afterAll(async () => { if (connected) await pg.end(); });

  it("first manual acceptance atomically gives exactly100 credits, never XP/Core verification", async () => {
    const result = await accept(); expect(result).toMatchObject({ replayed: false, acceptance: { status: "ACTIVE", recognitionClass: "USER_CONFIRMED_ARTIFACT", acceptedTitle: "Original deliverable", acceptedUpdatedAt: timestamp.replace("Z", "+00:00") }, earn: { amount: 100, sourceType: "ARTIFACT", sourceId: artifact, policyVersion: "artifact-manual-v1" }, correction: null });
    await pg.query("set constraints all immediate"); expect(await counts()).toEqual({ a: 1, t: 1, e: 1 });
    expect(await account()).toMatchObject({ current_available: 100, correction_deficit: 0 });
  });
  it("exact replay survives rename/version/archive/revocation and returns original snapshot", async () => {
    const key = randomUUID(), first = await accept(key); expect(await accept(key)).toEqual({ ...first, replayed: true });
    await pg.query("reset role"); await pg.query("update public.artifacts set title='Renamed',version='v2',lifecycle_status='archived',is_archived=true where id=$1", [artifact]); await checkpoint();
    await revoke(); expect(await accept(key)).toEqual({ ...first, replayed: true });
    await denied(() => accept(), "ALREADY_ACCEPTED", "23505"); expect(await counts()).toEqual({ a: 1, t: 2, e: 2 });
  });
  it.each(["note", "timestamp", "target", "revoke"])("same-key different %s conflicts before mutable source lookup", async kind => {
    const key = randomUUID(); await accept(key);
    await pg.query("reset role"); await pg.query("update public.artifacts set lifecycle_status='archived',is_archived=true where id=$1", [artifact]); await checkpoint();
    await denied(() => kind === "revoke" ? revoke(key) : accept(key, kind === "timestamp" ? "2026-10-12T01:02:03.123457Z" : timestamp, kind === "note" ? "Changed" : undefined, kind === "target" ? randomUUID() : artifact), "KEY_REUSED", "23505");
    expect(await counts()).toEqual({ a: 1, t: 1, e: 1 });
  });
  it("shared oldRPC key namespace conflicts both ways and legacy grant still rejects Artifact", async () => {
    const key = randomUUID(); await pg.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2)", [quest, key]);
    await denied(() => accept(key), "KEY_REUSED", "23505");
    const next = randomUUID(); await accept(next);
    await denied(() => pg.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2)", [quest, next]), "IDEMPOTENCY_KEY_REUSED", "23505");
    const oldRejection = (await pg.query("select public.rpc_grant_reward_credit('ARTIFACT',$1,'reward-v1',$2) r", [artifact, randomUUID()])).rows[0].r;
    expect(oldRejection).toMatchObject({ ok: false, error_code: "SOURCE_CLASS_NOT_YET_AVAILABLE" });
    expect((await counts()).t).toBe(2);
  });
  it.each(["draft", "superseded", "archived"])("%s cannot be first accepted", async status => {
    await pg.query("reset role"); await pg.query("update public.artifacts set lifecycle_status=$2,is_archived=($2='archived') where id=$1", [artifact, status]); await checkpoint();
    await denied(() => accept(), "SOURCE_INELIGIBLE", "P0001"); expect(await account()).toBeUndefined(); expect(await counts()).toEqual({ a: 0, t: 0, e: 0 });
  });
  it("microsecond stale source is not silently rounded to a millisecond", async () => {
    const stale = (await pg.query("select to_char((updated_at-interval '1 microsecond') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') v from public.artifacts where id=$1", [artifact])).rows[0].v;
    expect(stale).not.toBe(timestamp); await denied(() => accept(randomUUID(), stale), "STALE_SOURCE", "P0001"); expect(await account()).toBeUndefined();
  });
  it.each([null, "", " ", "\u000b", "x".repeat(2001)])("invalid note rejects independently inSQL %#", async note => {
    await denied(() => accept(randomUUID(), timestamp, note), "INVALID_INPUT", "22023"); expect(await account()).toBeUndefined();
  });
  it.each([null, "", "today", "2026-02-30T00:00:00Z", "2026-10-12T01:02:03", "2026-10-12T24:00:00Z", "2026-10-12T01:02:60Z", "2026-10-12T01:02:03+25:00", "x".repeat(129)])("invalid timestamp rejects independently inSQL %#", async expected => {
    await denied(() => accept(randomUUID(), expected), "INVALID_INPUT", "22023"); expect(await account()).toBeUndefined();
  });
  it.each([null, "", "\t", "x".repeat(201)])("invalid request key rejects independently inSQL %#", async key => {
    await denied(() => pg.query("select public.rpc_accept_artifact_manual($1,$2,'ok',$3)", [artifact, timestamp, key]), "INVALID_INPUT", "22023");
  });
  it("foreign/absent source and missing/foreign revocation fail without leaking or creating accounts", async () => {
    await denied(() => accept(randomUUID(), timestamp, "ok", randomUUID()), "NOT_FOUND", "P0002");
    await as(other); await denied(() => accept(), "NOT_FOUND", "P0002"); await denied(() => revoke(), "NOT_FOUND", "P0002"); await as();
    await denied(() => revoke(), "NOT_FOUND", "P0002"); expect(await account()).toBeUndefined();
  });
  it("revoke once writes exact-100 correction, retains EARN and same-key replay; no remint", async () => {
    const first = await accept(), key = randomUUID(), revoked = await revoke(key);
    expect(revoked).toMatchObject({ acceptance: { status: "REVOKED", earnTransactionId: first.earn.id }, correction: { amount: -100, correctionForId: first.earn.id } });
    expect(await revoke(key)).toEqual({ ...revoked, replayed: true }); expect(await account()).toMatchObject({ current_available: 0, correction_deficit: 0 });
    await denied(() => revoke(), "ALREADY_REVOKED", "23505"); await denied(() => accept(), "ALREADY_ACCEPTED", "23505");
  });
  it("generic correction reuses exact provenance without a second cache update", async () => {
    const first = await accept();
    const corrected = (await pg.query("select public.rpc_correct_reward_transaction($1,'Existing generic correction',$2) r", [first.earn.id, randomUUID()])).rows[0].r;
    const before = await account(), revoked = await revoke();
    expect(revoked.correction?.id).toBe(corrected.transaction.id); expect(await account()).toEqual(before); expect(await counts()).toEqual({ a: 1, t: 2, e: 3 });
  });
  it("existing150 deficit is repaid by100 acceptance: debt50/available0; Wishes/receipts/Core preserved", async () => {
    const earned = (await pg.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) r", [quest, randomUUID()])).rows[0].r;
    const wish = (await pg.query("insert into public.wishes(user_id,title,credit_cost) values($1,'Existing celebration',150) returning id", [user])).rows[0].id;
    for (const name of ["rpc_activate_wish", "rpc_set_primary_wish", "rpc_reserve_wish_credits"]) await pg.query(`select public.${name}($1,$2)`, [wish, randomUUID()]);
    await pg.query("select public.rpc_redeem_wish($1,'Celebrate',$2)", [wish, randomUUID()]);
    await pg.query("select public.rpc_correct_reward_transaction($1,'Existing revoked earn',$2)", [earned.transaction.id, randomUUID()]);
    await checkpoint(); expect(await account()).toMatchObject({ correction_deficit: 150, current_available: 0 });
    await accept(); expect(await account()).toMatchObject({ correction_deficit: 50, current_available: 0, lifetime_redeemed: 150 });
    await revoke(); expect(await account()).toMatchObject({ correction_deficit: 150, current_available: 0, lifetime_redeemed: 150 });
  });
  it("cache parity drift fails closed rather than repairing cache or issuing credits", async () => {
    await pg.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2)", [quest, randomUUID()]);
    await pg.query("reset role"); await pg.query("update public.reward_accounts set current_available=current_available+1 where user_id=$1", [user]); await as();
    const before = await account(); await denied(() => accept(), "REWARD_ACCOUNT_PARITY_FAILED", "P0001"); expect(await account()).toEqual(before); expect((await counts()).a).toBe(0);
  });
  it("hard delete and cascade cannot remove accepted provenance", async () => {
    await accept(); await pg.query("reset role");
    await pg.query("delete from public.artifact_evidence where artifact_id=$1", [artifact]); await checkpoint(); await pg.query("reset role");
    await denied(() => pg.query("delete from public.artifacts where id=$1", [artifact]), "foreign key", "23503");
    await denied(() => pg.query("delete from public.artifact_acceptances where artifact_id=$1", [artifact]), "WRITE_FORBIDDEN", "42501");
    await denied(() => pg.query("truncate public.artifact_acceptances"), "WRITE_FORBIDDEN", "42501");
  });
  it.each(["anon", "service_role"])("%s cannot invoke acceptance even with forged JWT sub", async role => {
    await as(user, role); await denied(() => accept(), "permission denied", "42501"); await denied(() => revoke(), "permission denied", "42501");
    await pg.query("reset role"); await pg.query(`grant execute on function public.rpc_accept_artifact_manual(uuid,text,text,text),public.rpc_revoke_artifact_manual(uuid,text,text) to ${role}`);
    await as(user, role); await denied(() => accept(), "AUTH_REQUIRED", "42501");
  });
  it.each(["authenticated", "anon", "service_role"])("%s broadened grants plus forged authority flags cannot mint or forge history", async role => {
    const first = await accept(); await pg.query("reset role");
    await pg.query(`grant all on public.artifact_acceptances,public.reward_transactions,public.outer_loop_audit_events to ${role}`);
    await pg.query(`grant execute on all functions in schema public to ${role}`);
    await pg.query(`create policy artifact_test_broadened on public.artifact_acceptances for all to ${role} using(true) with check(true)`);
    await as(user, role);
    await pg.query("select set_config('app.artifact_manual_authority','true',true),set_config('app.reward_rpc_authority','true',true),set_config('request.jwt.claim.role','service_role',true)");
    const identity = (await pg.query("select current_user r,auth.uid() u")).rows[0]; expect(identity).toEqual({ r: role, u: user });
    await denied(() => pg.query("update public.artifact_acceptances set accepted_title='Forged' where artifact_id=$1", [artifact]), "WRITE_FORBIDDEN", "42501");
    await denied(() => pg.query("insert into public.artifact_acceptances(user_id,artifact_id,accepted_title,accepted_updated_at,acceptance_note,earn_transaction_id) values($1,$2,'Forged',now(),'ok',$3)", [user, artifact, first.earn.id]), "WRITE_FORBIDDEN", "42501");
    await denied(() => pg.query("truncate public.artifact_acceptances"), "WRITE_FORBIDDEN", "42501");
    await denied(() => pg.query("insert into public.reward_transactions(user_id,account_id,event_kind,amount,canonical_source_type,canonical_source_id,policy_version,request_idempotency_key) values($1,$2,'EARN',100,'ARTIFACT',$3,'artifact-manual-v1',$4)", [user, first.earn.accountId, artifact, randomUUID()]), "WRITE_FORBIDDEN", "42501");
    await denied(() => pg.query("insert into public.outer_loop_audit_events(user_id,event_type,entity_type,entity_id,request_idempotency_key,policy_version,schema_version,event_data) values($1,'ARTIFACT_MANUALLY_ACCEPTED','artifact_acceptances',$2,$3,'artifact-manual-v1','1','{}')", [user, first.acceptance.id, randomUUID()]), "WRITE_FORBIDDEN", "42501");
    await denied(() => pg.query("select public.artifact_manual_begin('rpc_accept_artifact_manual',$1,$2,'{}')", [randomUUID(), artifact]), "AUTH_REQUIRED", "42501");
  });
  it("owner RLS hides foreign/blank rows and helper grants stay private", async () => {
    await accept(); await as(other); expect((await pg.query("select * from public.artifact_acceptances")).rows).toEqual([]);
    await as(""); expect((await pg.query("select * from public.artifact_acceptances")).rows).toEqual([]);
    await pg.query("reset role");
    for (const role of ["authenticated", "anon", "service_role"]) {
      const grants = (await pg.query("select p.proname,has_function_privilege($1,p.oid,'EXECUTE') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'artifact_manual_%' or p.proname='calculate_artifact_manual_reward_v1')", [role])).rows;
      expect(grants.length).toBe(11); expect(grants.every(g => g.allowed === false)).toBe(true);
    }
  });
  it("all new functions match candidate bytes; old0049/0050 prosrc, eight numeric values remain frozen", async () => {
    await pg.query("reset role");
    const source = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const body = (sql: string, name: string) => sql.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`, "i"))![1];
    const candidate = source("0056_artifact_manual_acceptance.sql"), names = [...candidate.matchAll(/CREATE FUNCTION public\.([a-z_0-9]+)\(/g)].map(m => m[1]);
    expect(names).toHaveLength(13);
    for (const name of names) {
      const rows = (await pg.query("select p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1", [name])).rows;
      expect(rows).toHaveLength(1); expect(rows[0].prosrc.replace(/\r\n/g, "\n"), name).toBe(body(candidate, name));
    }
    for (const [name, migration] of [["calculate_reward_grant_v1", "0049_phase8e_reward_wishes_rpc_authority.sql"], ["phase8e_verified_reward_amount", "0049_phase8e_reward_wishes_rpc_authority.sql"], ["phase8e_canonical_reward_source_id", "0050_phase8e_reward_canonical_source_fix.sql"], ["rpc_grant_reward_credit", "0050_phase8e_reward_canonical_source_fix.sql"]]) {
      const rows = (await pg.query("select p.prosrc,p.provolatile,p.proisstrict from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1", [name])).rows;
      expect(rows).toHaveLength(1); expect(rows[0].prosrc.replace(/\r\n/g, "\n"), name).toBe(body(source(migration), name));
      if (name === "calculate_reward_grant_v1") expect(rows[0]).toMatchObject({ provolatile: "i", proisstrict: true });
    }
    const cases: Array<[string, object]> = [["SEASON", {}], ["QUEST", { quest_size: "major" }], ["QUEST", { quest_size: "epic" }], ["QUEST", { quest_size: "main" }], ["QUEST", { is_boss: true }], ["MASTERY", { threshold: 6 }], ["MASTERY", { threshold: 8 }], ["MASTERY", { threshold: 10 }]];
    const amounts: number[] = []; for (const [type, attributes] of cases) amounts.push((await pg.query("select public.calculate_reward_grant_v1($1,$2) n", [type, JSON.stringify(attributes)])).rows[0].n);
    expect(amounts).toEqual([150, 100, 150, 200, 200, 100, 150, 250]);
    expect((await pg.query("select p.provolatile,public.calculate_artifact_manual_reward_v1() n from pg_proc p where p.oid='public.calculate_artifact_manual_reward_v1()'::regprocedure")).rows[0]).toEqual({ provolatile: "i", n: 100 });
  });
});
