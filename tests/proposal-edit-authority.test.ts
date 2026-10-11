import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";
import { calculateQuestProgressDelta } from "@/lib/growth-engine/quest-progression";
import { parseProposalEditBegin, parseProposalEditRequest } from "@/lib/proposal-edit/validation";
import { PROPOSAL_FACT_PROMPT_VERSION, type ProposalFacts } from "@/lib/proposal-edit/types";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sql = migration("0055_proposal_fact_edit_authority.sql");
const body = (text: string, name: string) => text.match(new RegExp(`(?:CREATE(?: OR REPLACE)? FUNCTION) public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`, "i"))![1];
const withoutAdditions = (value: string) => value.replace(/^  -- BEGIN PROPOSAL_EDIT_[A-Z_]+\n[\s\S]*?^  -- END PROPOSAL_EDIT_[A-Z_]+\n/gm, "");

describe("0055 old SQL bodies remain reversible, not a new settlement algorithm", () => {
  it.each([["record_ai_assessment", "0021_assessment_authority.sql"], ["settle_activity", "0042_artifact_settlement_integration.sql"]])("preserves the full %s body outside precise additions", (name, file) => {
    expect(withoutAdditions(body(sql, name))).toBe(body(migration(file), name));
  });
  it("replaces only the two admitted old functions and creates exactly two private tables", () => {
    expect([...sql.matchAll(/create or replace function public\.([a-z_]+)\(/gi)].map(m => m[1])).toEqual(["record_ai_assessment", "settle_activity"]);
    expect([...sql.matchAll(/create table public\.([a-z_]+)\s*\(/gi)].map(m => m[1])).toEqual(["proposal_fact_edit_requests", "proposal_fact_revisions"]);
  });
});

function assertOwnedStack() {
  const endpoint = new URL(dbUrl!);
  if (!["localhost", "127.0.0.1"].includes(endpoint.hostname)) throw Error("Local synthetic database required");
  if (process.env.GITHUB_ACTIONS === "true") return;
  const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK, receiptFile = process.env.XP_RPG_PROPOSAL_EDIT_CREATION_RECEIPT;
  if (!project || !/^phase8f_test_[a-z0-9_]+$/.test(project) || endpoint.port !== "54332" || !receiptFile) throw Error("Edit synthetic ownership receipt required");
  const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
  expect(receipt.project).toBe(project); expect(receipt.containers).toHaveLength(4);
  for (const component of ["db", "auth", "rest", "kong"]) {
    const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${project}`], { encoding: "utf8" }))[0];
    const original = receipt.containers.find((row: { component: string }) => row.component === component);
    expect(actual.Id).toBe(original.id); expect(actual.Created).toBe(original.created); expect(actual.State.Status).toBe("running");
    expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(receipt.stack);
    if (component === "db" || component === "kong") {
      const ports = actual.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"];
      expect(ports.length).toBeGreaterThan(0); expect(ports.every((p: { HostPort: string }) => p.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
    }
  }
}

function proposal() { return {
  activity: { type: "learning", completion: 0.145 }, difficulty: { complexity: 0.5, uncertainty: 0.2, expertise_gap: 0.3, resistance: 0.1 },
  growth: { effort: 0.6, learning: 0.7, performance: 0.4, outcome: 0.5, artifact_value: 0, character_evidence: 0 },
  evidence: { level: 0, explanation: "self-report" }, affected_skills: [{ name: "Statistics", reason: "clue only" }],
  knowledge_updates: { proposed_nodes: [], proposed_edges: [] }, mastery_changes: [],
  xp_semantics: { base_value: 50, difficulty: 0.5, mastery_gain: 0.2, novelty: 0.4, goal_alignment: 0.7, repetition_risk: "low" },
  next_quest: null, confidence: 0.7, uncertainty_notes: [], artifacts: [],
}; }
type Snapshot = Record<string, Record<string, unknown>[]>;

describe.skipIf(!dbUrl)("0055 real PostgreSQL authority, immutable revisions and all-Core isolation", () => {
  const pg = new Client({ connectionString: dbUrl }); let connected = false;
  let owners: string[], owner: string, activity: string, base: string, skill: string, foreignBase: string;
  let facts: ProposalFacts, tables: string[], expected: Snapshot;
  async function as(who = owner, role = "authenticated") {
    if (!["authenticated", "anon", "service_role"].includes(role)) throw Error("Invalid fixture role");
    await pg.query(`set local role ${role}`); await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [who]);
  }
  async function snapshot(): Promise<Snapshot> {
    const result: Snapshot = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [owners])).rows.map(r => r.r);
    return result;
  }
  async function checkpoint() { await pg.query("reset role"); expected = await snapshot(); await as(); }
  async function denied(run: () => Promise<unknown>, message: string, code?: string) {
    await pg.query("savepoint denial"); let error: unknown;
    try { await run(); } catch (caught) { error = caught; }
    finally { await pg.query("rollback to savepoint denial"); await pg.query("release savepoint denial"); }
    expect(error).toMatchObject({ message: expect.stringContaining(message), ...(code ? { code } : {}) });
  }
  async function begin(key = randomUUID(), target = base, value: unknown = facts) {
    const raw = (await pg.query("select public.rpc_begin_proposal_fact_edit($1,$2,$3) r", [target, key, JSON.stringify(value)])).rows[0].r;
    return parseProposalEditBegin(raw, owner, target, { requestId: key, facts: value as ProposalFacts });
  }
  async function complete(key: string, target = base, value: unknown = proposal()) {
    await as(owner, "service_role");
    const raw = (await pg.query("select public.rpc_complete_proposal_fact_edit($1,$2,$3,$4,$5,$6) r", [owner, target, key, JSON.stringify(value), "synthetic-only", PROPOSAL_FACT_PROMPT_VERSION])).rows[0].r;
    const result = parseProposalEditRequest(raw, owner, target, key);
    if (result.status === "completed") {
      await pg.query("reset role"); const after = await snapshot();
      const expectedAI = expected.ai_assessments;
      const old = expectedAI.find(r => r.id === target)!;
      const newRow = after.ai_assessments.find(r => r.id === result.completion.assessment.id)!;
      const actualOld = after.ai_assessments.find(r => r.id === target)!;
      expect(actualOld).toEqual({ ...old, status: "superseded", updated_at: actualOld.updated_at });
      expect(newRow).toMatchObject({ user_id: owner, activity_id: activity, rules_version: "edit-frozen", status: "pending", model_name: "synthetic-only", prompt_version: PROPOSAL_FACT_PROMPT_VERSION, assessment_json: value });
      const stripped = { ...after, ai_assessments: expectedAI };
      expect(stripped).toEqual(expected); expected = after;
    }
    await as(); return result;
  }
  async function fail(key: string) {
    await as(owner, "service_role");
    const result = (await pg.query("select public.rpc_fail_proposal_fact_edit($1,$2,$3,'AI_UNAVAILABLE') r", [owner, base, key])).rows[0].r;
    await as(); return parseProposalEditRequest(result, owner, base, key);
  }
  async function read(key: string) { return parseProposalEditRequest((await pg.query("select public.rpc_read_proposal_fact_edit($1,$2) r", [base, key])).rows[0].r, owner, base, key); }
  beforeAll(async () => {
    assertOwnedStack(); await pg.connect(); connected = true;
    expect((await pg.query("select to_regprocedure('public.rpc_begin_proposal_fact_edit(uuid,uuid,jsonb)') is not null v")).rows[0].v).toBe(true);
    tables = (await pg.query("select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' order by c.relname")).rows.map(r => r.relname).filter(t => !["proposal_fact_edit_requests", "proposal_fact_revisions"].includes(t));
    expect(tables.every(t => /^[a-z_]+$/.test(t))).toBe(true);
    expect(tables).toEqual(expect.arrayContaining(["activities", "ai_assessments", "player_states", "skills", "xp_transactions", "evidence_records", "reward_accounts", "reward_transactions", "wishes", "outer_loop_proposals"]));
  });
  beforeEach(async () => {
    await pg.query("begin"); await pg.query("set local lock_timeout='3s'");
    owners = [randomUUID(), randomUUID(), randomUUID()]; owner = owners[0]; activity = randomUUID(); base = randomUUID(); skill = randomUUID(); foreignBase = randomUUID();
    facts = { description: "Corrected facts only", totalMinutes: 60, effectiveMinutes: 35, relatedSkillIds: [skill] };
    for (const [index, who] of owners.entries()) {
      const target = index === 0 ? activity : randomUUID(), assessment = index === 0 ? base : index === 1 ? foreignBase : randomUUID();
      const sk = index === 0 ? skill : randomUUID(), oldActivity = randomUUID(), oldAssessment = randomUUID(), domain = randomUUID(), quest = randomUUID();
      await pg.query("insert into auth.users(id,email) values($1,$2)", [who, `${who}@example.test`]);
      await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'Existing',$3)", [domain, who, domain]);
      await pg.query("insert into skills(id,user_id,name,domain_id,xp,level,mastery_level,status) values($1,$2,'Statistics',$3,500,$4,8,'active')", [sk, who, domain, playerLevelFromXp(500)]);
      await pg.query("insert into activities(id,user_id,title,raw_input,effective_minutes,status,rules_version) values($1,$2,'Original','Original immutable',120,'assessed','edit-frozen'),($3,$2,'Old','Old XP',40,'confirmed','edit-history')", [target, who, oldActivity]);
      await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json,confidence) values($1,$2,$3,'pending','edit-frozen',$4,0.7),($5,$2,$6,'confirmed','edit-history','{}',0.7)", [assessment, who, target, JSON.stringify(proposal()), oldAssessment, oldActivity]);
      await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,domain_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,$5,500,500,'edit-history','Statistics')", [who, oldActivity, oldAssessment, sk, domain]);
      await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1", [who, playerLevelFromXp(500)]);
      await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing verified',true)", [who, oldActivity, sk]);
      await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Frozen source','learning','main','completed')", [quest, who]);
      await as(who); await pg.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2)", [quest, `edit-baseline-${randomUUID()}`]); await pg.query("insert into wishes(user_id,title,credit_cost) values($1,'Existing wish',100)", [who]);
      await pg.query("reset role");
      await pg.query("insert into outer_loop_proposals(user_id,proposal_type,schema_version,payload,model_metadata) values($1,'REVIEW_SUMMARY',1,'{}','{\"model\":\"existing\",\"prompt_contract\":\"frozen\",\"temperature\":0.7}')", [who]);
    }
    expect(playerLevelFromXp(500)).toBe(4); await checkpoint();
  });
  afterEach(async () => { try { await pg.query("reset role"); expect(await snapshot()).toEqual(expected); } finally { await pg.query("rollback"); } });
  afterAll(async () => { if (connected) await pg.end(); });

  it("begin/replay/read have no Core deltas, canonical tuple and exact durable 180 seconds", async () => {
    const key = randomUUID(); const first = await begin(key); expect(first.dispatch).toBe(true); expect(first.request.status).toBe("in_progress");
    expect(Date.parse(first.request.expiresAt) - Date.parse(first.request.createdAt)).toBe(180000);
    expect(await begin(key)).toEqual({ ...first, dispatch: false }); expect(await read(key)).toEqual(first.request);
    await denied(() => begin(key, base, { ...facts, effectiveMinutes: 34 }), "PROPOSAL_EDIT_CONFLICT", "23505");
    await denied(() => begin(), "PROPOSAL_EDIT_CONFLICT", "55000");
  });
  it("completion changes only old/new AI plus two audit tables, and replay still works after archive/reject", async () => {
    const key = randomUUID(); await begin(key); const done = await complete(key); expect(done.status).toBe("completed");
    if (done.status !== "completed") throw Error("Expected completed");
    expect(await read(key)).toEqual(done); expect((await begin(key)).dispatch).toBe(false);
    await pg.query("reset role"); await pg.query("update skills set status='archived' where id=$1", [skill]); await pg.query("update ai_assessments set status='rejected' where id=$1", [done.completion.assessment.id]); await checkpoint();
    const replay = await begin(key); expect(replay.dispatch).toBe(false); expect(replay.request.status).toBe("completed");
    expect((await fail(key)).status).toBe("completed");
  });
  it("linear second revision references the first while original Activity remains byte-identical", async () => {
    const key = randomUUID(); await begin(key); const first = await complete(key);
    if (first.status !== "completed") throw Error("Expected completed");
    const nextBase = first.completion.assessment.id, nextKey = randomUUID();
    expect((await begin(nextKey, nextBase)).dispatch).toBe(true);
    const second = await complete(nextKey, nextBase); if (second.status !== "completed") throw Error("Expected second completed");
    expect(second.completion.previousRevisionId).toBe(first.completion.revisionId);
    await denied(() => begin(randomUUID(), base), "PROPOSAL_EDIT_CONFLICT", "55000");
  });
  it("AI failure is terminal and allows only explicit new-key retry", async () => {
    const key = randomUUID(); await begin(key); expect((await fail(key)).status).toBe("failed");
    expect((await begin(key)).dispatch).toBe(false); expect((await read(key)).failure).toBe("AI_UNAVAILABLE");
    expect((await begin()).dispatch).toBe(true);
  });
  it("reject race closes as conflict, never recreates the old pending row", async () => {
    const key = randomUUID(); await begin(key); await pg.query("reset role"); await pg.query("update ai_assessments set status='rejected' where id=$1 and status='pending'", [base]); await checkpoint();
    expect((await complete(key)).status).toBe("conflict"); expect((await begin(key)).dispatch).toBe(false);
  });
  it("archived clue at finalize closes as conflict; old same-key polling remains available", async () => {
    const key = randomUUID(); await begin(key); await pg.query("reset role"); await pg.query("update skills set status='archived' where id=$1", [skill]); await checkpoint();
    expect((await complete(key)).status).toBe("conflict"); expect((await read(key)).status).toBe("conflict");
  });
  it("legacy record is blocked by an effective request and by successful revision", async () => {
    const key = randomUUID(); await begin(key);
    const legacy = () => pg.query("select public.record_ai_assessment($1,$2,$3,'legacy','legacy',0.7)", [owner, activity, JSON.stringify(proposal())]);
    await as(owner, "service_role"); await denied(legacy, "PROPOSAL_EDIT_CONFLICT", "55000"); await as();
    await complete(key); await as(owner, "service_role"); await denied(legacy, "PROPOSAL_EDIT_CONFLICT", "55000");
  });
  it.each([null, [], {}, { description: "x" }, { ...{ description: "x", totalMinutes: null, effectiveMinutes: null, relatedSkillIds: [] }, xp: 50 },
    { description: " ", totalMinutes: 10, effectiveMinutes: 1, relatedSkillIds: [] }, { description: "x", totalMinutes: 0, effectiveMinutes: 1, relatedSkillIds: [] },
    { description: "x", totalMinutes: 1441, effectiveMinutes: null, relatedSkillIds: [] }, { description: "x", totalMinutes: 2.5, effectiveMinutes: null, relatedSkillIds: [] },
    { description: "x", totalMinutes: null, effectiveMinutes: null, relatedSkillIds: [null] }, { description: "x".repeat(8193), totalMinutes: null, effectiveMinutes: null, relatedSkillIds: [] },
  ])("independent SQL fact validation fails closed %#", async value => {
    await denied(() => pg.query("select public.rpc_begin_proposal_fact_edit($1,$2,$3)", [base, randomUUID(), JSON.stringify(value)]), "INVALID_PROPOSAL_EDIT_INPUT", "22023");
  });
  it.each(["description", "totalMinutes", "effectiveMinutes", "relatedSkillIds"])("missing %s is not implicit null", async field => {
    const value = { ...facts } as Record<string, unknown>; delete value[field];
    await denied(() => pg.query("select public.rpc_begin_proposal_fact_edit($1,$2,$3)", [base, randomUUID(), JSON.stringify(value)]), "INVALID_PROPOSAL_EDIT_INPUT", "22023");
  });
  it("foreign/absent base and foreign/archived clue share safe not-found", async () => {
    for (const target of [foreignBase, randomUUID()]) await denied(() => begin(randomUUID(), target), "PROPOSAL_EDIT_NOT_FOUND", "P0002");
    for (const clues of [[randomUUID()], [skill, skill]]) await denied(() => begin(randomUUID(), base, { ...facts, relatedSkillIds: clues }), clues.length === 1 ? "PROPOSAL_EDIT_NOT_FOUND" : "INVALID_PROPOSAL_EDIT_INPUT");
    await pg.query("reset role"); await pg.query("update skills set status='archived' where id=$1", [skill]); await checkpoint();
    await denied(() => begin(), "PROPOSAL_EDIT_NOT_FOUND", "P0002");
  });
  it("all public RPC NULL arguments fail explicitly rather than STRICT null-success", async () => {
    for (const args of [[null, randomUUID(), JSON.stringify(facts)], [base, null, JSON.stringify(facts)], [base, randomUUID(), null]]) await denied(() => pg.query("select public.rpc_begin_proposal_fact_edit($1,$2,$3)", args), "INVALID_PROPOSAL_EDIT_INPUT", "22023");
    for (const args of [[null, randomUUID()], [base, null]]) await denied(() => pg.query("select public.rpc_read_proposal_fact_edit($1,$2)", args), "INVALID_PROPOSAL_EDIT_INPUT", "22023");
    await as(owner, "service_role");
    await denied(() => pg.query("select public.rpc_complete_proposal_fact_edit(null,$1,$2,null,null,null)", [base, randomUUID()]), "INVALID_PROPOSAL_EDIT_INPUT", "22023");
    await denied(() => pg.query("select public.rpc_fail_proposal_fact_edit($1,$2,$3,null)", [owner, base, randomUUID()]), "INVALID_PROPOSAL_EDIT_INPUT", "22023");
  });
  it.each([null, {}, { ...proposal(), confidence: null }, { ...proposal(), activity: { type: "learning", completion: 2 } },
    { ...proposal(), xp: 999 }, { ...proposal(), evidence: { level: 7, explanation: "x" } }, { ...proposal(), next_quest: {} },
  ])("SQL proposal validation is independent and rolls back %#", async value => {
    const key = randomUUID(); await begin(key); await as(owner, "service_role");
    await denied(() => pg.query("select public.rpc_complete_proposal_fact_edit($1,$2,$3,$4,'synthetic-only',$5)", [owner, base, key, JSON.stringify(value), PROPOSAL_FACT_PROMPT_VERSION]), "INVALID_PROPOSAL_EDIT_INPUT", "22023");
    await as(); expect((await read(key)).status).toBe("in_progress");
  });
  it("nested metadata including __proto__ is preserved, never promoted to authority", async () => {
    const value = { ...proposal(), artifactProposals: [{ title: "doc", artifactType: "document", metadata: JSON.parse('{"__proto__":{"v":["中文",null,3]},"temperature":0.7}') }] };
    const key = randomUUID(); await begin(key); const done = await complete(key, base, value); expect(done.status).toBe("completed");
    if (done.status === "completed") expect(done.completion.assessment.proposal.artifactProposals![0].metadata).toEqual(value.artifactProposals[0].metadata);
  });
  it("all roles fail direct writes and private helpers despite broadened grants and forged GUCs", async () => {
    const key = randomUUID(); await begin(key); await complete(key); await pg.query("reset role"); await pg.query("set constraints all immediate");
    await pg.query("grant all on proposal_fact_edit_requests,proposal_fact_revisions to anon,authenticated,service_role");
    for (const table of ["proposal_fact_edit_requests", "proposal_fact_revisions"]) await pg.query(`create policy synthetic_broadened on public.${table} for all using(true) with check(true)`);
    for (const role of ["anon", "authenticated", "service_role"]) {
      await as(owner, role); await pg.query("select set_config('app.proposal_edit_authority','true',true),set_config('app.phase8f_authority','true',true)");
      await denied(() => pg.query("insert into proposal_fact_edit_requests(user_id,request_id,activity_id,base_assessment_id,facts,created_at,expires_at) values($1,$2,$3,$4,$5,now(),now()+interval '180 seconds')", [owner, randomUUID(), activity, base, JSON.stringify(facts)]), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("insert into proposal_fact_revisions select * from proposal_fact_revisions where user_id=$1", [owner]), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("update proposal_fact_edit_requests set facts='{}'"), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("delete from proposal_fact_edit_requests"), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("update proposal_fact_revisions set rules_version='forged'"), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("delete from proposal_fact_revisions"), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("truncate proposal_fact_edit_requests,proposal_fact_revisions"), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
      await denied(() => pg.query("select public.proposal_edit_receipt($1,$2)", [owner, key]), "permission denied", "42501");
    }
    await as(owners[1]); await denied(() => pg.query("delete from proposal_fact_revisions where user_id=$1", [owner]), "PROPOSAL_EDIT_WRITE_FORBIDDEN", "42501");
  });
  it("RLS foreign/blank reads and read-only RPC privileges are not admin projections", async () => {
    const key = randomUUID(); await begin(key); await pg.query("reset role");
    for (const table of ["proposal_fact_edit_requests", "proposal_fact_revisions"]) {
      expect((await pg.query("select relrowsecurity v from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].v).toBe(true);
      for (const role of ["anon", "authenticated", "service_role"]) for (const permission of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) expect((await pg.query("select has_table_privilege($1,$2,$3) v", [role, `public.${table}`, permission])).rows[0].v).toBe(role === "authenticated" && permission === "SELECT");
    }
    const meta = (await pg.query("select prosecdef,provolatile,proisstrict,proconfig,pg_get_userbyid(proowner) owner from pg_proc where oid='public.rpc_read_proposal_fact_edit(uuid,uuid)'::regprocedure")).rows[0];
    expect(meta).toMatchObject({ prosecdef: false, provolatile: "s", proisstrict: false, owner: "postgres", proconfig: ["search_path=public, pg_temp"] });
    for (const who of [owners[1], owners[2]]) { await as(who); expect((await pg.query("select * from proposal_fact_edit_requests where user_id=$1", [owner])).rowCount).toBe(0); await denied(() => read(key), "PROPOSAL_EDIT_NOT_FOUND", "P0002"); }
    await as(""); expect((await pg.query("select * from proposal_fact_edit_requests")).rowCount).toBe(0); await denied(() => read(key), "PROPOSAL_EDIT_AUTH_REQUIRED", "42501");
  });
  it("true Activity cascade removes audit pair but standalone AI deletion is rejected", async () => {
    const key = randomUUID(); await begin(key); const done = await complete(key); if (done.status !== "completed") throw Error("Expected completed");
    await pg.query("reset role"); await denied(async () => { await pg.query("delete from ai_assessments where id=$1", [done.completion.assessment.id]); await pg.query("set constraints all immediate"); }, "foreign key constraint", "23503");
    await pg.query("delete from activities where id=$1", [activity]); await pg.query("set constraints all immediate");
    expect((await pg.query("select * from proposal_fact_edit_requests where request_id=$1", [key])).rowCount).toBe(0); expect((await pg.query("select * from proposal_fact_revisions where activity_id=$1", [activity])).rowCount).toBe(0);
    await checkpoint();
  });
  it("PostgreSQL double rounding matches actual frozen TS at decimal boundaries and 10001 completions", async () => {
    await pg.query("reset role");
    const completions = Array.from({ length: 10001 }, (_, n) => n / 10000).concat([0.145, 0.285, 0.565, 0.575, 0.005, 0.015]);
    const rows = (await pg.query("select v,public.proposal_edit_quest_delta(v,'35'::jsonb) delta from jsonb_array_elements($1::jsonb) v", [JSON.stringify(completions)])).rows;
    for (const row of rows) expect(row.delta).toBe(calculateQuestProgressDelta({ completion: row.v, effectiveMinutes: 35 }));
    for (const minutes of [null, 0, 1, 9, 11, 199, 1440]) expect((await pg.query("select public.proposal_edit_quest_delta('0',$1) delta", [JSON.stringify(minutes)])).rows[0].delta).toBe(calculateQuestProgressDelta({ completion: 0, effectiveMinutes: minutes }));
  });
  it("pure GET and same-key replay never expire a lease; explicit new POST closes it", async () => {
    await pg.query("reset role");
    // A trusted isolated-fixture definer sets an already elapsed creation time.
    // All production constraints and write guards remain enabled.
    await pg.query(`create function pg_temp.seed_elapsed(owner_id uuid, request_key uuid, activity_key uuid, assessment_key uuid, body jsonb) returns void language sql security definer set search_path=public,pg_temp as $$ insert into public.proposal_fact_edit_requests(user_id,request_id,activity_id,base_assessment_id,facts,created_at,expires_at) values(owner_id,request_key,activity_key,assessment_key,body,now()-interval '181 seconds',now()-interval '1 second') $$`);
    await pg.query("grant execute on function pg_temp.seed_elapsed(uuid,uuid,uuid,uuid,jsonb) to authenticated");
    const key = randomUUID(); await as(); await pg.query("select pg_temp.seed_elapsed($1,$2,$3,$4,$5)", [owner, key, activity, base, JSON.stringify(facts)]);
    expect((await read(key)).status).toBe("in_progress"); expect((await begin(key)).dispatch).toBe(false); expect((await read(key)).status).toBe("in_progress");
    expect((await begin()).dispatch).toBe(true); expect((await read(key)).status).toBe("expired");
    expect((await fail(key)).status).toBe("expired");
  });
  it("service finalize closes an elapsed lease without inserting a new proposal", async () => {
    await pg.query("reset role");
    await pg.query(`create function pg_temp.seed_elapsed(owner_id uuid, request_key uuid, activity_key uuid, assessment_key uuid, body jsonb) returns void language sql security definer set search_path=public,pg_temp as $$ insert into public.proposal_fact_edit_requests(user_id,request_id,activity_id,base_assessment_id,facts,created_at,expires_at) values(owner_id,request_key,activity_key,assessment_key,body,now()-interval '181 seconds',now()-interval '1 second') $$`);
    await pg.query("grant execute on function pg_temp.seed_elapsed(uuid,uuid,uuid,uuid,jsonb) to authenticated");
    const key = randomUUID(); await as(); await pg.query("select pg_temp.seed_elapsed($1,$2,$3,$4,$5)", [owner, key, activity, base, JSON.stringify(facts)]);
    expect((await complete(key)).status).toBe("expired"); expect((await begin(key)).dispatch).toBe(false);
  });
  it("ordinary unedited settlement cannot forge revision audit fields", async () => {
    await as(owner, "service_role");
    const payload = { assessmentId: base, transaction: { amount: 0, modifierJson: { factRevisionId: randomUUID() } } };
    expect((await pg.query("select public.settle_activity($1,$2) r", [owner, JSON.stringify(payload)])).rows[0].r).toEqual({ ok: false, reason: "fact_revision_mismatch" });
  });
  it.each([false, true])("edited ordinary Confirm requires matching revision/minutes and explicit Quest delta (Quest=%s)", async withQuest => {
    const quest = randomUUID();
    if (withQuest) {
      await pg.query("reset role"); await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Revision Quest','learning','standard','active')", [quest, owner]);
      await pg.query("update activities set quest_id=$2,quest_id_snapshot=$2,quest_title_snapshot='Revision Quest',quest_size_snapshot='standard' where id=$1", [activity, quest]); await checkpoint();
    }
    const key = randomUUID(); await begin(key); const done = await complete(key); if (done.status !== "completed") throw Error("Expected completed");
    const target = done.completion.assessment.id, revisionId = done.completion.revisionId;
    const payload = { assessmentId: target, xpDelta: 50, factRevisionId: revisionId, factEffectiveMinutes: facts.effectiveMinutes,
      transaction: { id: randomUUID(), activityId: activity, assessmentId: target, xpType: "activity", skillName: "Statistics", activityType: "learning", repetitionCount: 0, repetitionPenalty: 1, amount: 50, baseAmount: 50, modifierJson: { factRevisionId: revisionId, factEffectiveMinutes: facts.effectiveMinutes }, reason: "synthetic ordinary Confirm" },
      primarySkill: { skill: { resolution: "existing", skillId: skill }, name: "Statistics", xpDelta: 50, masteryAction: { action: "none" } },
      relatedSkillResolutions: [], player: { xpDelta: 50 }, evidence: { level: 0, explanation: "self-report", type: "learning" }, ...(withQuest ? { questProgressDelta: 14 } : {}),
    };
    await as(owner, "service_role");
    const settle = async (value: unknown) => (await pg.query("select public.settle_activity($1,$2) r", [owner, JSON.stringify(value)])).rows[0].r;
    expect(await settle({ ...payload, factEffectiveMinutes: 120 })).toEqual({ ok: false, reason: "fact_revision_mismatch" });
    expect(await settle({ ...payload, transaction: { ...payload.transaction, modifierJson: {} } })).toEqual({ ok: false, reason: "fact_revision_mismatch" });
    expect(await settle({ ...payload, questProgressDelta: 15 })).toEqual({ ok: false, reason: "fact_quest_progress_mismatch" });
    if (withQuest) { const absent = { ...payload }; delete absent.questProgressDelta; expect(await settle(absent)).toEqual({ ok: false, reason: "fact_quest_progress_mismatch" }); }
    await pg.query("reset role"); expect(await snapshot()).toEqual(expected); await as(owner, "service_role");
    const result = await settle(payload); expect(result).toMatchObject({ ok: true });
    await pg.query("reset role");
    const original = (await pg.query("select raw_input,effective_minutes from activities where id=$1", [activity])).rows[0]; expect(original).toEqual({ raw_input: "Original immutable", effective_minutes: 120 });
    const ledger = (await pg.query("select amount,modifier_json from xp_transactions where assessment_id=$1", [target])).rows;
    expect(ledger).toHaveLength(1); expect(ledger[0]).toMatchObject({ amount: 50, modifier_json: { factRevisionId: revisionId, factEffectiveMinutes: 35 } });
    if (withQuest) expect((await pg.query("select progress from quests where id=$1", [quest])).rows[0].progress).toBe("14");
    const after = await snapshot();
    for (const table of tables.filter(t => !["activities", "ai_assessments", "skills", "xp_transactions", "player_states", "quests", "quest_progress_events", "evidence_records"].includes(t))) expect(after[table]).toEqual(expected[table]);
    const oldEvidence = new Set(expected.evidence_records.map(r => r.id));
    expect(after.evidence_records.filter(r => oldEvidence.has(r.id))).toEqual(expected.evidence_records);
    expect(after.evidence_records.filter(r => !oldEvidence.has(r.id))).toHaveLength(1);
    expect(after.evidence_records.find(r => !oldEvidence.has(r.id))).toMatchObject({ user_id: owner, activity_id: activity, skill_id: skill, evidence_level: 0 });
    for (const table of tables) expect(after[table].filter(r => r.user_id !== owner)).toEqual(expected[table].filter(r => r.user_id !== owner));
    expected = after; await as();
    expect((await begin(key)).dispatch).toBe(false); expect((await read(key)).status).toBe("completed");
  });
  it("auth-user cascade legally removes the audit chain without disabling guards", async () => {
    // Existing immutable XP ledger intentionally forbids deleting populated owners.
    // A separate zero-ledger owner tests only the new audit-chain cascade.
    await pg.query("reset role"); const cascadeOwner = randomUUID(), target = randomUUID(), assessment = randomUUID(), key = randomUUID();
    await pg.query("insert into auth.users(id,email) values($1,$2)", [cascadeOwner, `${cascadeOwner}@example.test`]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Cascade','Original','assessed','edit-frozen')", [target, cascadeOwner]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json,confidence) values($1,$2,$3,'pending','edit-frozen',$4,0.7)", [assessment, cascadeOwner, target, JSON.stringify(proposal())]);
    await as(cascadeOwner); await pg.query("select public.rpc_begin_proposal_fact_edit($1,$2,$3)", [assessment, key, JSON.stringify({ ...facts, relatedSkillIds: [] })]);
    await as(cascadeOwner, "service_role");
    expect((await pg.query("select public.rpc_complete_proposal_fact_edit($1,$2,$3,$4,'synthetic-only',$5) r", [cascadeOwner, assessment, key, JSON.stringify(proposal()), PROPOSAL_FACT_PROMPT_VERSION])).rows[0].r.status).toBe("completed");
    await pg.query("reset role"); await pg.query("delete from auth.users where id=$1", [cascadeOwner]); await pg.query("set constraints all immediate");
    expect((await pg.query("select * from proposal_fact_edit_requests where user_id=$1", [cascadeOwner])).rowCount).toBe(0);
    expect((await pg.query("select * from proposal_fact_revisions where user_id=$1", [cascadeOwner])).rowCount).toBe(0);
  });
});
