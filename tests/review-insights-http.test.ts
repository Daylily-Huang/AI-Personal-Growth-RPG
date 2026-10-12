import http from "node:http";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import next from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { REVIEW_INSIGHTS_PRODUCTION } from "./helpers/governance-delta";
import { parseReviewSummary } from "@/lib/review-insights/validation";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
type Actor = { id: string; cookie: string; activityId?: string; skillId?: string };
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex").toUpperCase();
function scripts(dir: string): string { return readdirSync(dir, { withFileTypes: true }).map(e => e.isDirectory() ? scripts(path.join(dir, e.name)) : e.isFile() && e.name.endsWith(".js") ? readFileSync(path.join(dir, e.name), "utf8") : "").join("\n"); }
describe.skipIf(!dbUrl)("Review completed-build real Next/Auth/PG HTTP (no provider)", () => {
  const pg = new Client({ connectionString: dbUrl }), actors: Actor[] = [], clients: SupabaseClient[] = [];
  let connected = false, app: ReturnType<typeof next> | undefined, server: http.Server | undefined, origin: string, tables: string[], expected: Record<string, unknown[]>, period: { mode: string; start: string; end: string; timezone: string };
  function bind() {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!), db = new URL(dbUrl!);
    expect([api.hostname, db.hostname].every(h => ["localhost", "127.0.0.1"].includes(h))).toBe(true);
    const build = readFileSync(".next/BUILD_ID", "utf8").trim(), compiled = scripts(".next/static"); expect(build.length).toBeGreaterThan(0); expect(compiled).toContain(api.origin); expect(compiled).toContain(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    if (process.env.GITHUB_ACTIONS === "true") return;
    expect(api.port).toBe("54331"); expect(db.port).toBe("54332");
    const creation = JSON.parse(readFileSync(process.env.XP_RPG_REVIEW_CREATION_RECEIPT!, "utf8")); expect(creation.project).toBe(process.env.XP_RPG_DISPOSABLE_TEST_STACK); expect(creation.containers).toHaveLength(4);
    for (const component of ["db", "auth", "rest", "kong"]) {
      const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${creation.project}`], { encoding: "utf8" }))[0], old = creation.containers.find((c: { component: string }) => c.component === component);
      expect(actual.Id).toBe(old.id); expect(actual.Created).toBe(old.created); expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(creation.project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(creation.stack); expect(actual.State.Running).toBe(true);
      if (["db", "kong"].includes(component)) expect(actual.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"].every((p: { HostPort: string }) => p.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
    }
    const receipt = JSON.parse(readFileSync(process.env.XP_RPG_REVIEW_BUILD_RECEIPT!, "utf8")); expect(receipt.cwd).toBe(process.cwd()); expect(receipt.buildId).toBe(build); expect(receipt.child).toEqual({ status: 0, signal: null, error: null }); for (const file of REVIEW_INSIGHTS_PRODUCTION) expect(receipt.sources[file], file).toBe(sha(readFileSync(file)));
  }
  async function snapshot() {
    const result: Record<string, unknown[]> = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [actors.map(a => a.id)])).rows.map(r => r.r);
    return result;
  }
  async function actor(populated: boolean): Promise<Actor> {
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(api, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(admin);
    const credentials = { email: `review-${randomUUID()}@example.test`, password: `Synthetic!${randomUUID()}A` }, created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    if (created.error || !created.data.user) throw Error("Synthetic Review actor failed");
    const jar = new Map<string, string>(), client = createServerClient(api, key, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(v => jar.set(v.name, v.value)) } }); clients.push(client);
    if ((await client.auth.signInWithPassword(credentials)).error) throw Error("Synthetic Review sign-in failed"); client.auth.stopAutoRefresh();
    const result: Actor = { id: created.data.user.id, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
    if (populated) {
      result.skillId = randomUUID(); result.activityId = randomUUID(); const assessment = randomUUID();
      await pg.query("insert into public.skills(id,user_id,name,xp,level,mastery_level,status) values($1,$2,'Review known skill',500,4,0,'active')", [result.skillId, result.id]);
      await pg.query("insert into public.activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Review actual confirmed','DO_NOT_SEND_RAW_PRIVATE','confirmed','review-http')", [result.activityId, result.id]);
      await pg.query("insert into public.ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','review-http','{}')", [assessment, result.id, result.activityId]);
      await pg.query("insert into public.xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'review-http','Review known skill')", [result.id, result.activityId, assessment, result.skillId]);
      await pg.query("update public.player_states set total_xp=500,player_level=4 where user_id=$1", [result.id]);
    }
    return result;
  }
  async function call(route: "summary" | "analyze", who: Actor | null = actors[0], raw?: string, headers: Record<string, string> = {}, query?: string) {
    const response = await fetch(`${origin}/api/reviews/${route}${route === "summary" ? "?" + (query ?? new URLSearchParams(period)) : ""}`, { method: route === "summary" ? "GET" : "POST", headers: { ...(who ? { Cookie: who.cookie } : {}), ...(route === "analyze" ? { "Content-Type": "application/json", Origin: origin } : {}), ...headers }, ...(route === "analyze" ? { body: raw ?? JSON.stringify(period) } : {}), signal: AbortSignal.timeout(15000) });
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toContain("Cookie"); return response;
  }
  beforeAll(async () => {
    bind(); await pg.connect(); connected = true; actors.push(await actor(true), await actor(true), await actor(false));
    await pg.query("insert into public.activities(user_id,title,raw_input,status,rules_version) select $1,'Paged review '||n,'PRIVATE_RAW_PAGED','assessed','review-http' from generate_series(1,1001) n", [actors[0].id]);
    tables = (await pg.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' order by c.relname")).rows.map(r => r.relname);
    expect(tables.length).toBeGreaterThan(30); expect(tables.every(t => /^[a-z_]+$/.test(t))).toBe(true); expected = await snapshot();
    period = { mode: "DAILY", start: new Date(Date.now() - 3600000).toISOString(), end: new Date().toISOString(), timezone: "UTC" };
    app = next({ dev: false, dir: process.cwd(), hostname: "127.0.0.1", port: 0 }); await app.prepare(); server = http.createServer(app.getRequestHandler()); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw Error("No task listener"); origin = `http://127.0.0.1:${address.port}`;
  }, 30000);
  afterEach(async () => { expect(await snapshot()).toEqual(expected); });
  afterAll(async () => { try { server?.closeAllConnections(); if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve())); await app?.close(); } finally { for (const client of clients) client.auth.stopAutoRefresh(); if (connected) await pg.end(); } });
  it("actual cookie/RLS1000+ data returns1002 not1000, and XP remains500/Level4", async () => {
    const r = await call("summary"); expect(r.status).toBe(200); const body = await r.json(), s = parseReviewSummary(body.summary); expect(s.counts.activities).toBe(1002); expect(s.xp.net).toBe(500); expect(s.complete).toBe(true); expect(JSON.stringify(body)).not.toMatch(/DO_NOT_SEND_RAW_PRIVATE|PRIVATE_RAW_PAGED/);
    expect(expected.skills.find((r: unknown) => (r as { user_id: string }).user_id === actors[0].id)).toMatchObject({ xp: 500, level: 4 }); expect(expected.player_states.find((r: unknown) => (r as { user_id: string }).user_id === actors[0].id)).toMatchObject({ total_xp: 500, player_level: 4 });
  });
  it("three owners never see other's records; empty is explicit", async () => {
    const second = parseReviewSummary((await (await call("summary", actors[1])).json()).summary); expect(second.counts.activities).toBe(1); expect(second.activities[0].id).toBe(actors[1].activityId); expect(second.activities.some(a => a.id === actors[0].activityId)).toBe(false);
    const empty = parseReviewSummary((await (await call("summary", actors[2])).json()).summary); expect(empty.xp.net).toBe(0); expect(empty.counts.activities).toBe(0); expect(empty.state).toBeNull(); expect((await call("analyze", actors[2])).status).toBe(422);
  });
  it("weekly is same owner ledger with explicit weekly provenance", async () => { const query = new URLSearchParams({ ...period, mode: "WEEKLY" }).toString(); const r = await call("summary", actors[0], undefined, {}, query); expect(r.status).toBe(200); expect(parseReviewSummary((await r.json()).summary).period.mode).toBe("WEEKLY"); });
  it("anonymous auth precedes invalid body/query/media/origin", async () => {
    expect((await call("summary", null, undefined, {}, "owner=forged")).status).toBe(401); expect((await call("analyze", null, "{", { Origin: "https://foreign.invalid", "Content-Type": "text/plain" })).status).toBe(401);
  });
  it.each(["userId", "summary", "xp", "model"])("forged%s is400 and never source authority", async key => { expect((await call("analyze", actors[0], JSON.stringify({ ...period, [key]: actors[1].id }))).status).toBe(400); });
  it("cross-origin/media/body/query safely fail without database writes", async () => {
    expect((await call("analyze", actors[0], undefined, { Origin: "https://foreign.invalid" })).status).toBe(403); expect((await call("analyze", actors[0], undefined, { "Content-Type": "text/plain" })).status).toBe(415); expect((await call("analyze", actors[0], " ".repeat(2049))).status).toBe(413); expect((await call("analyze", actors[0], "{")).status).toBe(400); expect((await call("summary", actors[0], undefined, {}, new URLSearchParams(period) + "&mode=DAILY")).status).toBe(400);
  });
  it("no configured provider is503, not fabricated success; GET remains usable", async () => {
    expect(process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY).toBeUndefined(); const response = await call("analyze"); expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: "REVIEW_AI_NOT_CONFIGURED" }); expect((await call("summary")).status).toBe(200);
  });
});
