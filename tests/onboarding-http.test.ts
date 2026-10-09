import http from "node:http";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import next from "next";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { readOnboardingProgress } from "@/lib/onboarding/progress";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";

export function normalizedPublicConfig(value: unknown): { url: string; publishableKey: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("GUIDE_CONFIG_UNBOUND");
  const url = Object.getOwnPropertyDescriptor(value, "url"), key = Object.getOwnPropertyDescriptor(value, "publishableKey");
  if (!url || !key || !Object.hasOwn(url, "value") || !Object.hasOwn(key, "value")
    || typeof url.value !== "string" || typeof key.value !== "string" || !url.value.trim() || !key.value.trim()) throw Error("GUIDE_CONFIG_UNBOUND");
  return { url: url.value.trim(), publishableKey: key.value.trim() };
}
/** Also consumed in-memory by the task-owned build/start runner before any dispatch. */
export function assertGuideBuildRuntimeBinding(build: unknown, runtime: unknown) {
  const compiled = normalizedPublicConfig(build), current = normalizedPublicConfig(runtime);
  if (compiled.url !== current.url || compiled.publishableKey !== current.publishableKey) throw Error("GUIDE_CONFIG_UNBOUND");
  return current;
}

describe("guide controlled startup public build/runtime gate", () => {
  const compiled = { url: "http://127.0.0.1:54331", publishableKey: "synthetic-publishable-key" };
  test.each([
    { ...compiled, url: undefined }, { ...compiled, publishableKey: undefined },
    { ...compiled, url: " \t" }, { ...compiled, publishableKey: " \n" },
    { ...compiled, url: "http://127.0.0.1:54321" }, { ...compiled, publishableKey: "different-public-key" },
  ])("missing/different runtime stops before Next or business GET %j", runtime => {
    let dispatches = 0;
    expect(() => { assertGuideBuildRuntimeBinding(compiled, runtime); dispatches++; }).toThrow("GUIDE_CONFIG_UNBOUND");
    expect(dispatches).toBe(0);
  });
  test("equal normalized public tuple matches actual existing trim semantics", () => {
    expect(assertGuideBuildRuntimeBinding(compiled, { url: ` \t${compiled.url}\n`, publishableKey: ` ${compiled.publishableKey} ` })).toEqual(compiled);
  });
  test("missing build, inherited fields and getters are not trusted receipts", () => {
    let getterCalls = 0;
    const getter = { get url() { getterCalls++; return compiled.url; }, publishableKey: compiled.publishableKey };
    for (const value of [null, {}, Object.create(compiled), getter]) expect(() => assertGuideBuildRuntimeBinding(value, compiled)).toThrow("GUIDE_CONFIG_UNBOUND");
    expect(getterCalls).toBe(0);
  });
});

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
type Actor = { id: string; cookie: string };
describe.skipIf(!dbUrl)("guide real completed-build Next/Auth/PostgreSQL reads", () => {
  const pg = new Client({ connectionString: dbUrl });
  let app: ReturnType<typeof next>, server: http.Server, base: string, a: Actor, b: Actor;
  let baseline: unknown, tables: string[];
  const privateLabels = [`Synthetic guide A ${randomUUID()}`, `Synthetic guide B ${randomUUID()}`];
  const fixtureGroup = randomUUID(), grownLevel = playerLevelFromXp(500);
  const identifiers = new Map<string, { skill: string; quest: string; activity: string }>();
  async function actor(): Promise<Actor> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
      const credentials = { email: `guide-http-${randomUUID()}@example.test`, password: `Guide-${randomUUID()}!` };
      const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true,
        app_metadata: { task: "new-user-guide", guide_fixture_run: fixtureGroup } });
      expect(created.error).toBeNull(); if (!created.data.user) throw Error("Synthetic guide Auth user missing");
      const jar = new Map<string, string>();
      const client = createServerClient(url, key, { cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: values => { for (const { name, value } of values) { if (value) jar.set(name, value); else jar.delete(name); } },
      } });
      try { expect((await client.auth.signInWithPassword(credentials)).error).toBeNull(); }
      finally { await client.auth.stopAutoRefresh(); }
      return { id: created.data.user.id, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
    } finally { await admin.auth.stopAutoRefresh(); }
  }
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) as row from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [[a.id, b.id]])).rows;
    return result;
  }
  async function get(who: Actor | null, route = "/api/dashboard") {
    const response = await fetch(`${base}${route}`, { method: "GET", redirect: "manual", cache: "no-store", headers: who ? { Cookie: who.cookie } : {} });
    const text = await response.text();
    return { status: response.status, text, json: () => JSON.parse(text) as unknown };
  }
  function compiledJavaScript(directory: string): string {
    let contents = "";
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) contents += compiledJavaScript(file);
      else if (item.isFile() && item.name.endsWith(".js")) contents += readFileSync(file, "utf8");
    }
    return contents;
  }
  beforeAll(async () => {
    const db = new URL(dbUrl!), api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(db.hostname) || !["127.0.0.1", "localhost"].includes(api.hostname)) throw Error("Only local disposable guide fixtures allowed");
    if (process.env.GITHUB_ACTIONS !== "true") {
      const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK;
      if (!project || !/^phase8f_(?:r3|test)_[a-z0-9_]+$/.test(project) || db.port !== "54332" || api.port !== "54331") throw Error("Guide fixtures require owned task stack, never formal DB");
      expect(execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "com.supabase.cli.project"}}', `supabase_db_${project}`], { encoding: "utf8" }).trim()).toBe(project);
    }
    // Prove completed build contains the very same public values, before preparing Next/GET.
    const buildId = readFileSync(".next/BUILD_ID", "utf8").trim(); expect(buildId).not.toBe("");
    const runtime = normalizedPublicConfig({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
    const chunks = compiledJavaScript(".next/static");
    if (!chunks.includes(runtime.url) || !chunks.includes(runtime.publishableKey)) throw Error("GUIDE_CONFIG_UNBOUND");
    if (process.env.GITHUB_ACTIONS !== "true") {
      const receiptPath = process.env.XP_RPG_GUIDE_BUILD_RECEIPT;
      if (!receiptPath) throw Error("GUIDE_CONFIG_UNBOUND");
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      expect(receipt.buildId).toBe(buildId); expect(receipt.cwd).toBe(process.cwd());
      for (const field of ["head", "tree"] as const) expect(receipt[field]).toBe(execFileSync("git", ["rev-parse", field === "head" ? "HEAD" : "HEAD^{tree}"], { encoding: "utf8" }).trim());
      for (const file of ["src/app/onboarding/page.tsx", "src/components/onboarding/GettingStartedGuide.tsx", "src/lib/onboarding/progress.ts", "src/components/dashboard/DashboardHeader.tsx", "src/components/dashboard/DashboardStates.tsx"]) {
        expect(receipt.productionHashes[file]).toBe(createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase());
      }
      assertGuideBuildRuntimeBinding(receipt.publicConfig, runtime);
    } else {
      // CI's completed build and tests use the exact exported job tuple; chunks bind it.
      assertGuideBuildRuntimeBinding({ url: runtime.url, publishableKey: runtime.publishableKey }, runtime);
    }
    await pg.connect();
    app = next({ dev: false, hostname: "127.0.0.1", dir: process.cwd() }); await app.prepare();
    server = http.createServer(app.getRequestHandler()); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw Error("Missing owned guide server port");
    base = `http://127.0.0.1:${address.port}`; a = await actor(); b = await actor();
    for (const [index, who] of [a, b].entries()) {
      const skill = randomUUID(), secondSkill = randomUUID(), quest = randomUUID(), activity = randomUUID(), assessment = randomUUID();
      const knowledge = randomUUID(), otherKnowledge = randomUUID(), domain = randomUUID(), rewardQuest = randomUUID();
      identifiers.set(who.id, { skill, quest, activity });
      await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,$3,$4)", [domain, who.id, privateLabels[index], domain]);
      await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status,domain_id) values($1,$2,$3,500,$8,8,0.8,$4,$7),($5,$2,$6,0,1,0,0,'active',$7)", [skill, who.id, privateLabels[index], index === 0 ? "active" : "archived", secondSkill, `${privateLabels[index]} auxiliary`, domain, grownLevel]);
      await pg.query("insert into skill_edges(user_id,source_skill_id,target_skill_id,relation_type) values($1,$2,$3,'supports')", [who.id, skill, secondSkill]);
      await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status,is_main_quest) values($1,$2,$3,'learning','main',$4,true)", [quest, who.id, privateLabels[index], index === 0 ? "active" : "paused"]);
      await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,$3,$3,'confirmed','guide-http-fixture')", [activity, who.id, privateLabels[index]]);
      await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','guide-http-fixture','{}')", [assessment, who.id, activity]);
      await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot,domain_id) values($1,$2,$3,$4,500,500,'guide-http-fixture',$5,$6)", [who.id, activity, assessment, skill, privateLabels[index], domain]);
      await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1", [who.id, grownLevel]);
      const evidence = (await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,6,'Explicit synthetic old-growth baseline',true) returning id", [who.id, activity, skill])).rows[0].id;
      await pg.query("insert into mastery_events(user_id,skill_id,activity_id,evidence_id,from_level,to_level,confidence,event_type,reason) values($1,$2,$3,$4,7,8,0.8,'upgrade','Explicit synthetic old-growth baseline')", [who.id, skill, activity, evidence]);
      await pg.query("insert into mastery_verifications(user_id,skill_id,skill_name,from_level,to_level,evidence_level,status,resolved_at) values($1,$2,$3,7,8,6,'verified',clock_timestamp())", [who.id, skill, privateLabels[index]]);
      await pg.query("insert into knowledge_nodes(id,user_id,title,node_type,source_type,verification_status,confidence,is_archived) values($1,$3,$4,'concept','user_created','inferred',0.5,false),($2,$3,$5,'concept','user_created','inferred',0.5,false)", [knowledge, otherKnowledge, who.id, privateLabels[index], `${privateLabels[index]} related`]);
      await pg.query("insert into knowledge_edges(user_id,source_node_id,target_node_id,relation_type,source_type,verification_status,confidence,is_archived) values($1,$2,$3,'supports','user_created','inferred',0.5,false)", [who.id, knowledge, otherKnowledge]);
      // Explicit fixture setup, never a guide action: existing authority funds both ledgers.
      await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status,is_main_quest) values($1,$2,'Synthetic previously completed Major','learning','major','completed',false)", [rewardQuest, who.id]);
      await pg.query("begin");
      try {
        await pg.query("set local role authenticated");
        await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [who.id]);
        const grant = (await pg.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r", [rewardQuest, randomUUID()])).rows[0].r;
        expect(grant).toMatchObject({ ok: true, transaction: { amount: 100, event_kind: "EARN" }, account: { current_available: 100 } });
        await pg.query("commit");
      } catch (error) { await pg.query("rollback"); throw error; }
    }
    tables = (await pg.query("select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' order by c.relname")).rows.map(row => row.relname as string);
    if (!tables.every(table => /^[a-z_]+$/.test(table))) throw Error("Unsafe fixture snapshot table");
    for (const table of ["skills", "skill_edges", "knowledge_nodes", "knowledge_edges", "player_states", "xp_transactions", "mastery_events", "evidence_records", "reward_accounts", "reward_transactions"]) {
      expect(tables).toContain(table);
      for (const who of [a, b]) expect(Number((await pg.query(`select count(*) as n from public.${table} where user_id=$1`, [who.id])).rows[0].n)).toBeGreaterThan(0);
    }
    for (const who of [a, b]) {
      const player = (await pg.query("select total_xp,player_level from player_states where user_id=$1", [who.id])).rows[0];
      expect(Number(player.total_xp)).toBe(500); expect(player.player_level).toBe(playerLevelFromXp(Number(player.total_xp)));
      const skill = (await pg.query("select xp,level from skills where id=$1 and user_id=$2", [identifiers.get(who.id)!.skill, who.id])).rows[0];
      expect(Number(skill.xp)).toBe(500); expect(skill.level).toBe(playerLevelFromXp(Number(skill.xp)));
    }
    baseline = await snapshot();
  }, 60000);
  afterAll(async () => {
    try { if (baseline) expect(await snapshot()).toEqual(baseline); }
    finally {
      if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
      if (app) await app.close(); await pg.end();
    }
  });
  test("anonymous/onboarding is public shell only and private dashboard GET is401", async () => {
    const shell = await get(null, "/onboarding"); expect(shell.status).toBe(200);
    expect(shell.text).toContain("你的入门指南"); expect(shell.text).toContain("尚未核对");
    for (const label of privateLabels) expect(shell.text).not.toContain(label);
    expect((await get(null)).status).toBe(401); expect(await snapshot()).toEqual(baseline);
  });
  test("A exact active main, grown catalog and saved activity are recognized without resetting XP", async () => {
    const result = await get(a); expect(result.status).toBe(200);
    const facts = readOnboardingProgress(result.json()), expected = identifiers.get(a.id)!;
    expect(facts.mainQuest?.id).toBe(expected.quest); expect(facts.skill?.id).toBe(expected.skill);
    expect(facts.activity?.id).toBe(expected.activity); expect(await snapshot()).toEqual(baseline);
    expect((await pg.query("select total_xp::text as xp from player_states where user_id=$1", [a.id])).rows[0].xp).toBe("500");
  });
  test("B paused main shortcut cannot claim active preparation and no A labels or identifiers leak", async () => {
    const result = await get(b); expect(result.status).toBe(200);
    expect(readOnboardingProgress(result.json()).mainQuest).toBeNull();
    expect(result.text).not.toContain(privateLabels[0]);
    for (const identifier of Object.values(identifiers.get(a.id)!)) expect(result.text).not.toContain(identifier);
    expect(await snapshot()).toEqual(baseline);
  });
  test("refresh/revisit and repeated reads preserve all populated owner/graph/ledger/reward tables", async () => {
    for (const who of [a, b]) for (let count = 0; count < 3; count++) {
      expect((await get(who, "/onboarding")).status).toBe(200);
      expect((await get(who)).status).toBe(200);
    }
    expect(await snapshot()).toEqual(baseline);
  });
  test("fixed guide links and existing target pages are real, with no new form or business write", async () => {
    const shell = await get(a, "/onboarding");
    for (const href of ["/quests", "/skills", "/dashboard#quick-log-input", "/dashboard"]) expect(shell.text).toContain(`href="${href}"`);
    expect(shell.text).not.toMatch(/<form[\s>]/);
    for (const route of ["/quests", "/skills", "/dashboard"]) expect((await get(a, route)).status).toBe(200);
    expect(await snapshot()).toEqual(baseline);
  });
});
