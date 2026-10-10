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
import { playerLevelFromXp } from "@/lib/growth-engine/levels";

export function normalizedActivityConfig(value: unknown): { url: string; publishableKey: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("ACTIVITY_CONFIG_UNBOUND");
  const url = Object.getOwnPropertyDescriptor(value, "url"), key = Object.getOwnPropertyDescriptor(value, "publishableKey");
  if (!url || !key || !Object.hasOwn(url, "value") || !Object.hasOwn(key, "value") || typeof url.value !== "string" || typeof key.value !== "string" || !url.value.trim() || !key.value.trim()) throw Error("ACTIVITY_CONFIG_UNBOUND");
  return { url: url.value.trim(), publishableKey: key.value.trim() };
}
export function assertActivityBuildBinding(build: unknown, runtime: unknown) {
  const compiled = normalizedActivityConfig(build), current = normalizedActivityConfig(runtime);
  if (compiled.url !== current.url || compiled.publishableKey !== current.publishableKey) throw Error("ACTIVITY_CONFIG_UNBOUND");
  return current;
}
describe("Activity build/runtime startup gate before dispatch", () => {
  const compiled = { url: "http://127.0.0.1:54331", publishableKey: "synthetic-public-key" };
  test.each([{ ...compiled, url: undefined }, { ...compiled, publishableKey: undefined }, { ...compiled, url: " \t" },
    { ...compiled, publishableKey: " \n" }, { ...compiled, url: "http://127.0.0.1:54321" }, { ...compiled, publishableKey: "other-key" }])("missing/different tuple dispatches nothing %j", runtime => {
    let dispatch = 0; expect(() => { assertActivityBuildBinding(compiled, runtime); dispatch++; }).toThrow("ACTIVITY_CONFIG_UNBOUND"); expect(dispatch).toBe(0);
  });
  test("matching normalized tuple permits dispatch", () => { expect(assertActivityBuildBinding(compiled, { url: ` ${compiled.url}\n`, publishableKey: ` ${compiled.publishableKey}\t` })).toEqual(compiled); });
  test.each([null, [], {}, Object.create(compiled)])("malformed tuple %# fails closed", value => { expect(() => assertActivityBuildBinding(compiled, value)).toThrow("ACTIVITY_CONFIG_UNBOUND"); });
  test("accessor config is rejected without invoking it", () => { let calls = 0; const value = Object.defineProperty({ publishableKey: compiled.publishableKey }, "url", { get: () => { calls++; return compiled.url; } }); expect(() => normalizedActivityConfig(value)).toThrow("ACTIVITY_CONFIG_UNBOUND"); expect(calls).toBe(0); });
});

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
describe.skipIf(!dbUrl)("completed-build Activity private real HTTP", () => {
  const pg = new Client({ connectionString: dbUrl });
  let app: ReturnType<typeof next> | undefined, server: http.Server | undefined, base: string;
  type Actor = { id: string; cookie: string; activities: string[]; label: string; raw: string };
  const actors: Actor[] = []; let tables: string[] = [], baseline: unknown;
  function chunks(directory: string): string { return readdirSync(directory, { withFileTypes: true }).map(item => item.isDirectory() ? chunks(path.join(directory, item.name)) : item.isFile() && item.name.endsWith(".js") ? readFileSync(path.join(directory, item.name), "utf8") : "").join("\n"); }
  async function actor(): Promise<Actor> {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `activity-detail-${randomUUID()}@example.test`, password = `Test!${randomUUID()}x`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); admin.auth.stopAutoRefresh();
    if (created.error || !created.data.user) throw Error("Synthetic Activity actor creation failed");
    const jar = new Map<string, string>();
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => { for (const c of values) jar.set(c.name, c.value); } } });
    const signed = await client.auth.signInWithPassword({ email, password }); client.auth.stopAutoRefresh(); if (signed.error) throw Error("Synthetic Activity actor sign-in failed");
    return { id: created.data.user.id, cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; "), activities: [], label: "private-synthetic-" + randomUUID(), raw: "" };
  }
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of tables) for (const who of actors) result[table + "/" + who.id] = (await pg.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from public.${table} t where user_id=$1`, [who.id])).rows[0].rows;
    return result;
  }
  async function request(who: Actor | null, pathname: string, method = "GET") {
    const response = await fetch(base + pathname, { method, headers: who ? { Cookie: who.cookie } : {}, redirect: "manual", cache: "no-store" }); const text = await response.text();
    let body: unknown; try { body = JSON.parse(text); } catch { body = null; }
    if (method === "GET" && pathname.startsWith("/api/")) { expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toContain("Cookie"); }
    return { status: response.status, text, body, headers: response.headers };
  }
  beforeAll(async () => {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!), db = new URL(dbUrl!);
    if (!["127.0.0.1", "localhost"].includes(api.hostname) || !["127.0.0.1", "localhost"].includes(db.hostname)) throw Error("Only disposable local Activity fixtures allowed");
    const buildId = readFileSync(".next/BUILD_ID", "utf8").trim(); expect(buildId).not.toBe("");
    const runtime = normalizedActivityConfig({ url: api.origin, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
    const compiled = chunks(".next/static"); if (!compiled.includes(runtime.url) || !compiled.includes(runtime.publishableKey)) throw Error("ACTIVITY_CONFIG_UNBOUND");
    if (process.env.GITHUB_ACTIONS !== "true") {
      const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK, receiptPath = process.env.XP_RPG_ACTIVITY_BUILD_RECEIPT, creationPath = process.env.XP_RPG_ACTIVITY_CREATION_RECEIPT;
      if (!project || !/^phase8f_(?:r3|test)_[a-z0-9_]+$/.test(project) || api.port !== "54331" || db.port !== "54332" || !receiptPath || !creationPath) throw Error("Owned disposable Activity stack/build required");
      const creation = JSON.parse(readFileSync(creationPath, "utf8")); expect(creation.project).toBe(project); expect(creation.containers).toHaveLength(4);
      for (const component of ["db", "auth", "rest", "kong"]) {
        const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${project}`], { encoding: "utf8" }))[0], original = creation.containers.find((x: { component: string }) => x.component === component);
        expect(actual.Id).toBe(original.id); expect(actual.Created).toBe(original.created); expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(creation.stack);
        if (component === "db") expect(actual.HostConfig.PortBindings["5432/tcp"].every((x: { HostPort: string }) => x.HostPort === "54332")).toBe(true);
        if (component === "kong") expect(actual.HostConfig.PortBindings["8000/tcp"].every((x: { HostPort: string }) => x.HostPort === "54331")).toBe(true);
      }
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8")); expect(receipt.buildId).toBe(buildId); expect(receipt.cwd).toBe(process.cwd());
      for (const [field, revision] of [["head", "HEAD"], ["tree", "HEAD^{tree}"]]) expect(receipt[field]).toBe(execFileSync("git", ["rev-parse", revision], { encoding: "utf8" }).trim());
      for (const file of ["src/app/activities/[id]/page.tsx", "src/app/api/activities/[id]/route.ts", "src/components/dashboard/ActivityHistoryList.tsx", "src/components/dashboard/RecentGrowthFeed.tsx"]) expect(receipt.productionHashes[file]).toBe(createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase());
      assertActivityBuildBinding(receipt.publicConfig, runtime);
    } else assertActivityBuildBinding(runtime, runtime);
    await pg.connect(); app = next({ dev: false, hostname: "127.0.0.1", dir: process.cwd() }); await app.prepare();
    server = http.createServer(app.getRequestHandler()); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw Error("No owned Activity HTTP port"); base = `http://127.0.0.1:${address.port}`;
    for (let owner = 0; owner < 2; owner++) {
      const who = await actor(); actors.push(who); who.raw = "  " + who.label + "\r\n\n<script>literal-not-executed</script>🙂\t" + "完整原文".repeat(1200) + "  ";
      for (let n = 0; n < 13; n++) { const id = randomUUID(); who.activities.push(id); await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version,created_at) values($1,$2,$3,$4,$5,'activity-detail-fixture','2025-01-01'::timestamptz+$6*interval '1 day')", [id, who.id, n === 0 ? who.label : `${who.label} ${n}`, n === 0 ? who.raw : `synthetic ${n}`, ["confirmed", "pending_assessment", "assessed"][n % 3], n]); }
      const skill = randomUUID(), assessment = randomUUID(), rewardQuest = randomUUID();
      await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,$3,500,$4,0,0,'active')", [skill, who.id, who.label, playerLevelFromXp(500)]);
      await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','activity-detail-fixture','{}')", [assessment, who.id, who.activities[0]]);
      await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'activity-detail-fixture',$5)", [who.id, who.activities[0], assessment, skill, who.label]);
      await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1", [who.id, playerLevelFromXp(500)]);
      await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status,is_main_quest) values($1,$2,'Synthetic completed Major','learning','major','completed',false)", [rewardQuest, who.id]);
      await pg.query("begin"); try { await pg.query("set local role authenticated"); await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [who.id]); const reward = (await pg.query("select rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r", [rewardQuest, randomUUID()])).rows[0].r; expect(reward).toMatchObject({ ok: true, transaction: { amount: 100, event_kind: "EARN" } }); await pg.query("commit"); } catch (error) { await pg.query("rollback"); throw error; }
    }
    tables = (await pg.query("select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' order by c.relname")).rows.map(row => row.relname as string);
    if (!tables.every(t => /^[a-z_]+$/.test(t))) throw Error("Invalid fixture snapshot table");
    for (const table of ["activities", "ai_assessments", "skills", "player_states", "xp_transactions", "reward_accounts", "reward_transactions"]) { expect(tables).toContain(table); for (const who of actors) expect(Number((await pg.query(`select count(*) as n from public.${table} where user_id=$1`, [who.id])).rows[0].n)).toBeGreaterThan(0); }
    baseline = await snapshot(); await new Promise(resolve => setTimeout(resolve, 1500));
  }, 90000);
  afterAll(async () => { try { if (baseline) expect(await snapshot()).toEqual(baseline); } finally { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); } if (app) await app.close(); await pg.end(); } });
  test.each(["own-shape", "invalid", "foreign-shape"])("anonymous %s is private401 before identity lookup", async shape => { const key = shape === "invalid" ? "invalid" : actors[shape === "foreign-shape" ? 1 : 0].activities[0]; const r = await request(null, `/api/activities/${key}`); expect(r.status).toBe(401); expect(r.body).toEqual({ error: "Authentication required" }); });
  test.each([0, 1, 2])("actual persisted status #%s and full original receipt", async n => { const r = await request(actors[0], `/api/activities/${actors[0].activities[n]}`); expect(r.status).toBe(200); expect(r.body).toMatchObject({ activity: { id: actors[0].activities[n], status: ["confirmed", "pending_assessment", "assessed"][n] } }); if (n === 0) expect((r.body as { activity: { rawInput: string } }).activity.rawInput).toBe(actors[0].raw); });
  test("old record outside recent ten stays directly readable", async () => { const who = actors[0], recent = (await pg.query("select id from activities where user_id=$1 order by created_at desc limit 10", [who.id])).rows.map(r => r.id); expect(recent).not.toContain(who.activities[0]); expect((await request(who, `/api/activities/${who.activities[0]}`)).status).toBe(200); });
  test("uppercase UUID reads the same owned record", async () => { const r = await request(actors[0], `/api/activities/${actors[0].activities[0].toUpperCase()}`); expect(r.status).toBe(200); expect(r.body).toMatchObject({ activity: { id: actors[0].activities[0] } }); });
  test.each([0, 1])("owner %s cannot read the other owner's original", async n => { const r = await request(actors[n], `/api/activities/${actors[1 - n].activities[0]}`); expect(r.status).toBe(404); expect(r.body).toEqual({ error: "Activity not found" }); expect(r.text).not.toContain(actors[1 - n].label); });
  test("foreign/nonexistent exact404 and owner query cannot override RLS", async () => { const foreign = await request(actors[0], `/api/activities/${actors[1].activities[0]}?user_id=${actors[1].id}&owner=${actors[1].id}`), missing = await request(actors[0], `/api/activities/${randomUUID()}`); expect(foreign.status).toBe(404); expect(missing.status).toBe(404); expect(foreign.body).toEqual(missing.body); });
  test("authenticated malformed UUID is400", async () => { expect((await request(actors[0], "/api/activities/constructor")).status).toBe(400); });
  test.each(["POST", "PATCH", "DELETE"])("%s is405, never a new write endpoint", async method => { expect((await request(actors[0], `/api/activities/${actors[0].activities[0]}`, method)).status).toBe(405); });
  test("anonymous page is only public shell, never either owner's original in SSR", async () => { const r = await request(null, `/activities/${actors[0].activities[0]}`); expect(r.status).toBe(200); expect(r.text).toContain("活动原文"); for (const who of actors) expect(r.text).not.toContain(who.label); });
  test("repeat reads leave every owner Core and finance row exactly unchanged", async () => { for (let n = 0; n < 3; n++) expect((await request(actors[0], `/api/activities/${actors[0].activities[0]}`)).status).toBe(200); expect(await snapshot()).toEqual(baseline); });
});
