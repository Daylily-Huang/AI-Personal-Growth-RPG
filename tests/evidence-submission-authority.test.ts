import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";
import { parseEvidenceList, parseEvidenceResult } from "@/lib/evidence-submission/validation";
import type { EvidenceSubmissionInput } from "@/lib/evidence-submission/types";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
const signature = "public.rpc_submit_activity_evidence(uuid,uuid,jsonb)";
type Snapshot = Record<string, Record<string, unknown>[]>;
function ownedStack() {
  const endpoint = new URL(dbUrl!);
  if (!["localhost", "127.0.0.1"].includes(endpoint.hostname)) throw Error("Only isolated local evidence fixtures");
  if (process.env.GITHUB_ACTIONS === "true") return;
  const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK, receiptPath = process.env.XP_RPG_EVIDENCE_CREATION_RECEIPT;
  if (!project || !/^phase8f_test_[a-z0-9_]+$/.test(project) || endpoint.port !== "54332" || !receiptPath) throw Error("Exact evidence stack required");
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")); expect(receipt.project).toBe(project); expect(receipt.containers).toHaveLength(4);
  for (const component of ["db", "auth", "rest", "kong"]) {
    const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${project}`], { encoding: "utf8" }))[0];
    const original = receipt.containers.find((row: { component: string }) => row.component === component);
    expect(actual.Id).toBe(original.id); expect(actual.Created).toBe(original.created); expect(actual.State.Status).toBe("running");
    expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(receipt.stack);
    if (component === "db" || component === "kong") expect(actual.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"].every((port: { HostPort: string }) => port.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
  }
}

describe.skipIf(!dbUrl)("Evidence0054 real PostgreSQL authority and all-table isolation", () => {
  const pg = new Client({ connectionString: dbUrl }); let connected = false;
  let a: string, b: string, activity: string, sibling: string, foreign: string, skill: string, foreignSkill: string;
  let tables: string[] = [], globalTables: string[] = [], expected: Snapshot;
  async function as(owner = a, role = "authenticated") {
    if (!["authenticated", "anon", "service_role"].includes(role)) throw Error("Invalid fixture role");
    await pg.query(`set local role ${role}`); await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  }
  async function snapshot(): Promise<Snapshot> {
    const result: Snapshot = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) as r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [[a, b]])).rows.map(row => row.r);
    for (const table of globalTables) result[`global/${table}`] = (await pg.query(`select to_jsonb(t) as r from public.${table} t order by to_jsonb(t)::text`)).rows.map(row => row.r);
    return result;
  }
  async function checkpoint() { await pg.query("reset role"); expected = await snapshot(); await as(); }
  async function denied(run: () => Promise<unknown>, message: string, code?: string) {
    await pg.query("savepoint denied"); let error: unknown;
    try { await run(); } catch (caught) { error = caught; }
    finally { await pg.query("rollback to savepoint denied"); await pg.query("release savepoint denied"); }
    expect(error).toMatchObject({ message: expect.stringContaining(message), ...(code ? { code } : {}) });
  }
  async function submit(input: EvidenceSubmissionInput, target = activity) {
    const result = (await pg.query("select public.rpc_submit_activity_evidence($1,$2,$3) as r", [target, input.requestId, JSON.stringify({ skillId: input.skillId, description: input.description })])).rows[0].r;
    return parseEvidenceResult(result, target, { ...input, description: input.description.trim() }, a);
  }
  async function create(description = "manual body", requested: string | null = skill, key = randomUUID(), target = activity) {
    const result = await submit({ requestId: key, skillId: requested, description }, target);
    expect(result.replayed).toBe(false); expect(result.submission.evidence).toMatchObject({ evidenceLevel: 0, verified: false, evidenceType: "user_submission", skillId: requested, description: description.trim() });
    await pg.query("reset role"); const after = await snapshot(), without = structuredClone(after);
    const evidenceId = result.submission.evidence.id;
    expect(after.evidence_records.filter(row => row.id === evidenceId)).toHaveLength(1);
    expect(after.evidence_submissions.filter(row => row.request_id === key)).toHaveLength(1);
    without.evidence_records = without.evidence_records.filter(row => row.id !== evidenceId);
    without.evidence_submissions = without.evidence_submissions.filter(row => row.request_id !== key);
    expect(without).toEqual(expected); expected = after; await as(); return result;
  }
  async function list(view: "submissions" | "skills" = "submissions", after: string | null = null) {
    const raw = (await pg.query("select public.rpc_list_activity_evidence_submissions($1,$2,$3) as r", [activity, view, after])).rows[0].r;
    return parseEvidenceList(raw, activity, { view, after }, a);
  }
  beforeAll(async () => {
    ownedStack(); await pg.connect(); connected = true;
    expect((await pg.query("select to_regprocedure($1) is not null as v", [signature])).rows[0].v).toBe(true);
    tables = (await pg.query(`select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute at on at.attrelid=c.oid where n.nspname='public' and c.relkind='r' and at.attname='user_id' order by c.relname`)).rows.map(row => row.relname);
    expect(tables.every(table => /^[a-z_]+$/.test(table))).toBe(true);
    globalTables = (await pg.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not exists(select 1 from pg_attribute at where at.attrelid=c.oid and at.attname='user_id') order by c.relname`)).rows.map(row => row.relname);
    expect(globalTables.every(table => /^[a-z_]+$/.test(table))).toBe(true);
    expect(tables).toEqual(expect.arrayContaining(["activities", "skills", "player_states", "xp_transactions", "evidence_records", "evidence_submissions", "reward_accounts", "reward_transactions", "wishes", "milestones", "outer_loop_proposals"]));
  });
  beforeEach(async () => {
    await pg.query("begin"); await pg.query("set local lock_timeout='3s'");
    a = randomUUID(); b = randomUUID(); activity = randomUUID(); sibling = randomUUID(); foreign = randomUUID(); skill = randomUUID(); foreignSkill = randomUUID();
    await pg.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [a, `${a}@example.test`, b, `${b}@example.test`]);
    for (const [owner, target, skillId] of [[a, activity, skill], [b, foreign, foreignSkill]]) {
      const oldActivity = randomUUID(), assessment = randomUUID(), quest = randomUUID(), domain = randomUUID();
      await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'Existing domain',$3)", [domain, owner, domain]);
      await pg.query("insert into skills(id,user_id,name,domain_id,xp,level,mastery_level,mastery_confidence,status) values($1,$2,$3,$5,500,$4,8,0.8,'active')", [skillId, owner, `Existing-${skillId}`, playerLevelFromXp(500), domain]);
      await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Target','Original unchanged','pending_assessment','evidence-frozen'),($3,$2,'Old XP','Old raw','confirmed','evidence-history')", [target, owner, oldActivity]);
      await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','evidence-history','{}')", [assessment, owner, oldActivity]);
      await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,domain_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,$5,500,500,'evidence-history','Existing')", [owner, oldActivity, assessment, skillId, domain]);
      await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1", [owner, playerLevelFromXp(500)]);
      await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing verified evidence',true)", [owner, oldActivity, skillId]);
      await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Completed reward source','learning','main','completed')", [quest, owner]);
      await as(owner);
      await pg.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2)", [quest, `evidence-baseline-${randomUUID()}`]);
      await pg.query("insert into public.wishes(user_id,title,credit_cost) values($1,'Existing wish',100)", [owner]);
      await pg.query("reset role");
      await pg.query("insert into outer_loop_proposals(user_id,proposal_type,schema_version,payload,model_metadata) values($1,'REVIEW_SUMMARY',1,'{}','{\"model\":\"synthetic-existing\",\"prompt_contract\":\"existing\",\"temperature\":0.7}')", [owner]);
    }
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Sibling','Sibling raw','confirmed','evidence-history')", [sibling, a]);
    expect(playerLevelFromXp(500)).toBe(4); await checkpoint();
  });
  afterEach(async () => { try { await pg.query("reset role"); expect(await snapshot()).toEqual(expected); } finally { await pg.query("rollback"); } });
  afterAll(async () => { if (connected) await pg.end(); });

  it.each(["pending_assessment", "assessed", "confirmed"])("accepts own %s but changes only oneE0+receipt", async status => {
    await pg.query("reset role"); await pg.query("update activities set status=$2 where id=$1", [activity, status]); await checkpoint();
    await create("　full literal <script>\nhttps://example.invalid\u000b");
  });
  it("null Skill is explicit general material; exact replay and read have zero further differences", async () => {
    const first = await create("general material", null); const input = { requestId: first.submission.requestId, skillId: null, description: "general material" };
    expect(await submit(input)).toEqual({ ...first, replayed: true }); expect((await list()).items).toEqual([first.submission]);
  });
  it("same key different tuple never mutates; different key same text is another explicit record", async () => {
    const first = await create(); const key = first.submission.requestId;
    for (const [target, requested, body] of [[sibling, skill, "manual body"], [activity, null, "manual body"], [activity, skill, "different"]] as const) await denied(() => submit({ requestId: key, skillId: requested, description: body }, target), "EVIDENCE_REQUEST_REUSED", "23505");
    const second = await create(); expect(second.submission.evidence.id).not.toBe(first.submission.evidence.id);
  });
  it.each([null, [], {}, { skillId: null }, { description: "x" }, { skillId: null, description: null }, { skillId: false, description: "x" }, { skillId: "bad", description: "x" }, { skillId: null, description: " " }, { skillId: null, description: "a".repeat(8193) }, { skillId: null, description: "x", verified: true }, { skillId: null, description: "x", evidenceLevel: 6 }])("SQL independently rejects malformed %j", async value => {
    await denied(() => pg.query("select public.rpc_submit_activity_evidence($1,$2,$3)", [activity, randomUUID(), JSON.stringify(value)]), "INVALID_EVIDENCE_INPUT", "22023");
  });
  it("NULL args/list view rejected explicitly, not STRICT null success", async () => {
    for (const args of [[null, randomUUID(), '{"skillId":null,"description":"x"}'], [activity, null, '{"skillId":null,"description":"x"}'], [activity, randomUUID(), null]]) await denied(() => pg.query("select public.rpc_submit_activity_evidence($1,$2,$3)", args), "INVALID_EVIDENCE_INPUT", "22023");
    await denied(() => pg.query("select public.rpc_list_activity_evidence_submissions($1,null,null)", [activity]), "INVALID_EVIDENCE_INPUT", "22023");
  });
  it("foreign/missing Activity and foreign/archived Skill uniformly404", async () => {
    for (const target of [foreign, randomUUID()]) await denied(() => submit({ requestId: randomUUID(), skillId: null, description: "x" }, target), "EVIDENCE_TARGET_NOT_FOUND", "P0002");
    for (const requested of [foreignSkill, randomUUID()]) await denied(() => submit({ requestId: randomUUID(), skillId: requested, description: "x" }), "EVIDENCE_TARGET_NOT_FOUND", "P0002");
    await pg.query("reset role"); await pg.query("update skills set status='archived' where id=$1", [skill]); await checkpoint();
    await denied(() => submit({ requestId: randomUUID(), skillId: skill, description: "x" }), "EVIDENCE_TARGET_NOT_FOUND", "P0002");
  });
  it("archived Skill does not prefetch-block an exact old replay", async () => {
    const first = await create(); await pg.query("reset role"); await pg.query("update skills set status='archived' where id=$1", [skill]); await checkpoint();
    expect(await submit({ requestId: first.submission.requestId, skillId: skill, description: "manual body" })).toEqual({ ...first, replayed: true });
  });
  it("deleted Skill preserves requested tuple, current Core SETNULL and read/replay", async () => {
    // Separate zero-XP Skill avoids changing the populated historical growth fixtures.
    await pg.query("reset role"); const requested = randomUUID(); await pg.query("insert into skills(id,user_id,name) values($1,$2,$3)", [requested, a, `Delete-${requested}`]); await checkpoint();
    const first = await create("delete fixture", requested); await pg.query("reset role"); await pg.query("delete from skills where id=$1", [requested]); await checkpoint();
    const replay = await submit({ requestId: first.submission.requestId, skillId: requested, description: "delete fixture" });
    expect(replay.replayed).toBe(true); expect(replay.submission.requestedSkillId).toBe(requested); expect(replay.submission.evidence.skillId).toBeNull();
    expect((await list()).items[0]).toEqual(replay.submission);
  });
  it("standalone Core Evidence deletion fails at deferred constraint; Activity cascade remains legal", async () => {
    const first = await create(); await pg.query("reset role");
    await denied(async () => { await pg.query("delete from evidence_records where id=$1", [first.submission.evidence.id]); await pg.query("set constraints all immediate"); }, "evidence_submissions", "23503");
    await pg.query("delete from activities where id=$1", [activity]);
    expect((await pg.query("select count(*)::int as n from evidence_records where id=$1", [first.submission.evidence.id])).rows[0].n).toBe(0);
    expect((await pg.query("select count(*)::int as n from evidence_submissions where request_id=$1", [first.submission.requestId])).rows[0].n).toBe(0);
    await pg.query("set constraints all immediate"); await checkpoint();
    await denied(() => submit({ requestId: first.submission.requestId, skillId: skill, description: "manual body" }), "EVIDENCE_TARGET_NOT_FOUND", "P0002");
  });
  it("all API roles with broadened grants/forged flags cannot direct write or call helpers", async () => {
    const first = await create(); await pg.query("reset role");
    // Flush legitimate deferred FK events so TRUNCATE reaches its guard rather
    // than PostgreSQL's unrelated pending-trigger-event prohibition.
    await pg.query("set constraints all immediate");
    await pg.query("grant all on public.evidence_submissions to anon,authenticated,service_role");
    await pg.query("create policy temporary_broadened_all on public.evidence_submissions for all using(true) with check(true)");
    for (const role of ["anon", "authenticated", "service_role"]) {
      await as(a, role); await pg.query("select set_config('app.evidence_authority','true',true),set_config('app.phase8f_authority','true',true)");
      await denied(() => pg.query("insert into evidence_submissions(user_id,request_id,activity_id,evidence_id) values($1,$2,$3,$4)", [a, randomUUID(), activity, first.submission.evidence.id]), "EVIDENCE_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("update evidence_submissions set requested_skill_id=null where user_id=$1", [a]), "EVIDENCE_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("delete from evidence_submissions where user_id=$1", [a]), "EVIDENCE_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("truncate evidence_submissions"), "EVIDENCE_WRITE_FORBIDDEN", "42501");
      for (const helper of ["evidence_submission_insert_guard", "evidence_submission_change_guard"]) await denied(() => pg.query(`select public.${helper}()`), "permission denied", "42501");
    }
    await as(b);
    expect((await pg.query("select id from activities where id=$1", [activity])).rowCount).toBe(0);
    // A real foreign parent is RLS-hidden, not absent. The definer guard must see it.
    await denied(() => pg.query("delete from evidence_submissions where user_id=$1", [a]), "EVIDENCE_WRITE_FORBIDDEN", "42501");
  });
  it("default grants/RLS/function ownership/read stability and blank identity", async () => {
    await create(); await pg.query("reset role");
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const permission of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) expect((await pg.query("select has_table_privilege($1,'public.evidence_submissions',$2) as v", [role, permission])).rows[0].v).toBe(role === "authenticated" && permission === "SELECT");
      for (const fn of [signature, "public.rpc_list_activity_evidence_submissions(uuid,text,uuid)"]) expect((await pg.query("select has_function_privilege($1,$2,'EXECUTE') as v", [role, fn])).rows[0].v).toBe(role === "authenticated");
    }
    const definitions = (await pg.query("select proname,prosecdef,proisstrict,provolatile,proconfig,pg_get_userbyid(proowner) as owner from pg_proc where oid=any($1::regprocedure[])", [[signature, "public.rpc_list_activity_evidence_submissions(uuid,text,uuid)"]])).rows;
    for (const fn of definitions) expect(fn).toMatchObject({ prosecdef: true, proisstrict: false, owner: "postgres", proconfig: ["search_path=public, pg_temp"] });
    expect(definitions.find(fn => fn.proname === "rpc_list_activity_evidence_submissions").provolatile).toBe("s");
    await as(b); expect((await pg.query("select * from evidence_submissions where user_id=$1", [a])).rowCount).toBe(0);
    await as(""); expect((await pg.query("select * from evidence_submissions")).rowCount).toBe(0);
    await denied(() => list(), "EVIDENCE_AUTH_REQUIRED", "42501");
  });
  it("new receipt fails atomically when a later trigger rejects; retry samekey can succeed", async () => {
    await pg.query("reset role");
    await pg.query(`create function pg_temp.evidence_fixture_fail() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_RECEIPT_FAILURE'; end $$`);
    await pg.query("create trigger zz_evidence_fixture_fail after insert on public.evidence_submissions for each row execute function pg_temp.evidence_fixture_fail()");
    await as(); const key = randomUUID();
    await denied(() => submit({ requestId: key, skillId: skill, description: "rollback entire pair" }), "SYNTHETIC_RECEIPT_FAILURE");
    await pg.query("reset role"); expect(await snapshot()).toEqual(expected);
    await pg.query("drop trigger zz_evidence_fixture_fail on public.evidence_submissions"); await as(); await create("rollback entire pair", skill, key);
  });
  it("auth-user deletion legally cascades the new pair without disabling any guard", async () => {
    await pg.query("reset role"); const owner = randomUUID(), target = randomUUID(), key = randomUUID();
    await pg.query("insert into auth.users(id,email) values($1,$2)", [owner, `${owner}@example.test`]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Cascade','preserved','confirmed','evidence-frozen')", [target, owner]);
    await as(owner); const raw = (await pg.query("select public.rpc_submit_activity_evidence($1,$2,$3) as r", [target, key, '{"skillId":null,"description":"cascade fixture"}'])).rows[0].r;
    const result = parseEvidenceResult(raw, target, { requestId: key, skillId: null, description: "cascade fixture" }, owner);
    await pg.query("reset role"); await pg.query("delete from auth.users where id=$1", [owner]); await pg.query("set constraints all immediate");
    expect((await pg.query("select count(*)::int as n from evidence_records where id=$1", [result.submission.evidence.id])).rows[0].n).toBe(0);
    expect((await pg.query("select count(*)::int as n from evidence_submissions where user_id=$1", [owner])).rows[0].n).toBe(0);
    expect(await snapshot()).toEqual(expected); await as();
  });
  it("independent insert guard rejects wrong tenant and wrong Core even inside postgres definer", async () => {
    const first = await create(); await pg.query("reset role");
    await pg.query(`create function pg_temp.forge_evidence_receipt(owner_id uuid, target uuid, evidence uuid, requested uuid) returns void language sql security definer set search_path=public,pg_temp as $$ insert into public.evidence_submissions(user_id,request_id,activity_id,evidence_id,requested_skill_id) values(owner_id,gen_random_uuid(),target,evidence,requested) $$`);
    await pg.query("grant execute on function pg_temp.forge_evidence_receipt(uuid,uuid,uuid,uuid) to authenticated");
    await as();
    await denied(() => pg.query("select pg_temp.forge_evidence_receipt($1,$2,$3,$4)", [b, foreign, first.submission.evidence.id, skill]), "EVIDENCE_WRITE_FORBIDDEN", "42501");
    const foreignEvidence = expected.evidence_records.find(row => row.user_id === b)!;
    await denied(() => pg.query("select pg_temp.forge_evidence_receipt($1,$2,$3,$4)", [a, activity, foreignEvidence.id, skill]), "INVALID_EVIDENCE_RECEIPT", "P0001");
  });
  it("polluted current Core and unjustified lost Skill do not get hidden by receipt metadata", async () => {
    const first = await create(); await pg.query("reset role");
    await pg.query("update evidence_records set skill_id=null where id=$1", [first.submission.evidence.id]); await checkpoint();
    await denied(() => submit({ requestId: first.submission.requestId, skillId: skill, description: "manual body" }), "INVALID_EVIDENCE_RECEIPT", "P0001");
    await denied(() => list(), "INVALID_EVIDENCE_RECEIPT", "P0001");
  });
  it("1007 receipts/1007 Skills bounded UUID pages: complete, no overlap/leaks or growth mutations", async () => {
    const before = structuredClone(expected);
    await pg.query("select public.rpc_submit_activity_evidence($1,gen_random_uuid(),jsonb_build_object('skillId',null,'description',repeat(chr(1),8192))) from generate_series(1,1007)", [activity]);
    await pg.query("reset role"); await pg.query("insert into skills(user_id,name) select $1,'Page-'||gen_random_uuid()::text from generate_series(1,1007)", [a]); await checkpoint();
    const after = structuredClone(expected);
    expect(after.evidence_records.length - before.evidence_records.length).toBe(1007);
    expect(after.evidence_submissions.length - before.evidence_submissions.length).toBe(1007);
    expect(after.skills.length - before.skills.length).toBe(1007);
    const originalEvidenceIds = new Set(before.evidence_records.map(row => row.id));
    const originalSkillIds = new Set(before.skills.map(row => row.id));
    const originalRequestIds = new Set(before.evidence_submissions.map(row => row.request_id));
    after.evidence_records = after.evidence_records.filter(row => originalEvidenceIds.has(row.id));
    after.evidence_submissions = after.evidence_submissions.filter(row => originalRequestIds.has(row.request_id));
    after.skills = after.skills.filter(row => originalSkillIds.has(row.id));
    expect(after).toEqual(before);
    for (const [view, total, limit] of [["submissions", 1007, 25], ["skills", 1008, 50]] as const) {
      const found: string[] = []; let cursor: string | null = null;
      do {
        const page = await list(view, cursor); expect(page.items.length).toBeLessThanOrEqual(limit);
        found.push(...page.items.map(row => "requestId" in row ? row.requestId : row.id)); cursor = page.nextCursor;
      } while (cursor !== null);
      expect(found).toHaveLength(total); expect(new Set(found).size).toBe(total); expect([...found].sort()).toEqual(found);
    }
  }, 30000);
});

describe.skipIf(!dbUrl)("Evidence0054 real concurrent committed pairs, exact disposable stack", () => {
  const pg = new Client({ connectionString: dbUrl }); const peers: Client[] = []; let connected = false;
  let owner: string, target: string, skill: string;
  const query = "select public.rpc_submit_activity_evidence($1,$2,$3) as r";
  const payload = (text = "same concurrent body") => JSON.stringify({ skillId: skill, description: text });
  async function peer() {
    const client = new Client({ connectionString: dbUrl }); await client.connect(); peers.push(client);
    await client.query("begin"); await client.query("set local lock_timeout='4s'"); await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); return client;
  }
  async function waiting(pid: number) {
    for (let attempt = 0; attempt < 50; attempt++) {
      if ((await pg.query("select exists(select 1 from pg_locks where pid=$1 and not granted) as v", [pid])).rows[0].v) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error("Expected independently observed PostgreSQL lock wait");
  }
  async function counts(key: string) {
    return (await pg.query("select count(*)::int as receipts,count(distinct e.id)::int as evidence from evidence_submissions r join evidence_records e on e.id=r.evidence_id where r.user_id=$1 and r.request_id=$2", [owner, key])).rows[0];
  }
  beforeAll(async () => {
    ownedStack(); await pg.connect(); connected = true; owner = randomUUID(); target = randomUUID(); skill = randomUUID();
    await pg.query("insert into auth.users(id,email) values($1,$2)", [owner, `${owner}@example.test`]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Concurrent','Must remain unchanged','confirmed','evidence-concurrent')", [target, owner]);
    await pg.query("insert into skills(id,user_id,name) values($1,$2,$3)", [skill, owner, `Concurrent-${skill}`]);
  });
  afterAll(async () => {
    for (const client of peers) { try { await client.query("rollback"); } finally { await client.end(); } }
    if (connected) await pg.end(); // Whole-stack disposal owns these committed immutable fixtures.
  });
  it.each(["same", "different", "abort-first"] as const)("samekey %s serializes on actual advisory lock with caught rejection", async mode => {
    const first = await peer(), second = await peer(), key = randomUUID();
    const pid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
    const result = (await first.query(query, [target, key, payload()])).rows[0].r;
    // Attach both outcomes at creation time, before waiting for the first commit.
    const pending = second.query(query, [target, key, payload(mode === "different" ? "other tuple" : undefined)])
      .then(value => ({ value, error: null }), error => ({ value: null, error }));
    try {
      await waiting(pid); await first.query(mode === "abort-first" ? "rollback" : "commit");
      const other = await pending;
      if (mode === "different") { expect(other.error).toMatchObject({ message: "EVIDENCE_REQUEST_REUSED", code: "23505" }); await second.query("rollback"); }
      else { expect(other.error).toBeNull(); expect(other.value!.rows[0].r.replayed).toBe(mode === "same"); if (mode === "same") expect(other.value!.rows[0].r.submission).toEqual(result.submission); await second.query("commit"); }
      expect(await counts(key)).toEqual({ receipts: 1, evidence: 1 });
    } finally { await first.query("rollback"); await pending; await second.query("rollback"); }
  }, 10000);
  it("different keys create independent pairs with no change to Activity/Skill/player facts", async () => {
    const first = await peer(), second = await peer(), keys = [randomUUID(), randomUUID()];
    const before = (await pg.query("select (select to_jsonb(a) from activities a where id=$1) as a,(select to_jsonb(s) from skills s where id=$2) as s,(select to_jsonb(p) from player_states p where user_id=$3) as p", [target, skill, owner])).rows[0];
    const operations = [first, second].map((client, index) => client.query(query, [target, keys[index], payload()]).then(value => ({ value, error: null }), error => ({ value: null, error })));
    try {
      for (const outcome of await Promise.all(operations)) expect(outcome.error).toBeNull();
      await first.query("commit"); await second.query("commit");
      for (const key of keys) expect(await counts(key)).toEqual({ receipts: 1, evidence: 1 });
      expect((await pg.query("select (select to_jsonb(a) from activities a where id=$1) as a,(select to_jsonb(s) from skills s where id=$2) as s,(select to_jsonb(p) from player_states p where user_id=$3) as p", [target, skill, owner])).rows[0]).toEqual(before);
    } finally { await first.query("rollback"); await second.query("rollback"); }
  }, 10000);
  it("first creation locks Skill against archive/delete and Activity against delete", async () => {
    for (const action of ["archive-skill", "delete-skill", "delete-activity"]) {
      const activityId = randomUUID(), skillId = randomUUID(), key = randomUUID();
      await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Race target','Unchanged','pending_assessment','evidence-race')", [activityId, owner]);
      await pg.query("insert into skills(id,user_id,name) values($1,$2,$3)", [skillId, owner, `Race-${skillId}`]);
      const creator = await peer(), mutator = new Client({ connectionString: dbUrl }); await mutator.connect(); peers.push(mutator); await mutator.query("begin");
      await mutator.query("set local lock_timeout='4s'"); const pid = (await mutator.query("select pg_backend_pid() as pid")).rows[0].pid;
      const body = JSON.stringify({ skillId, description: "Race body" }); await creator.query(query, [activityId, key, body]);
      const sql = action === "archive-skill" ? "update skills set status='archived' where id=$1" : action === "delete-skill" ? "delete from skills where id=$1" : "delete from activities where id=$1";
      const pending = mutator.query(sql, [action === "delete-activity" ? activityId : skillId]).then(value => ({ value, error: null }), error => ({ value: null, error }));
      try {
        await waiting(pid); await creator.query("commit"); expect((await pending).error).toBeNull(); await mutator.query("commit");
        const replay = await peer();
        if (action === "delete-activity") { await expect(replay.query(query, [activityId, key, body])).rejects.toMatchObject({ message: "EVIDENCE_TARGET_NOT_FOUND", code: "P0002" }); await replay.query("rollback"); expect(await counts(key)).toEqual({ receipts: 0, evidence: 0 }); }
        else { const result = (await replay.query(query, [activityId, key, body])).rows[0].r; expect(result.replayed).toBe(true); expect(result.submission.requestedSkillId).toBe(skillId); expect(result.submission.evidence.skillId).toBe(action === "delete-skill" ? null : skillId); await replay.query("commit"); }
      } finally { await creator.query("rollback"); await pending; await mutator.query("rollback"); }
    }
  }, 10000);
});
