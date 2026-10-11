import http from "node:http";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import next from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ARTIFACT_MANUAL_PRODUCTION } from "./helpers/governance-delta";
import { parseArtifactAcceptanceReceipt, parseArtifactAcceptanceView } from "@/lib/artifact-acceptance/validation";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
const sha = (input: Buffer | string) => createHash("sha256").update(input).digest("hex").toUpperCase();
function scripts(directory: string): string {
  return readdirSync(directory, { withFileTypes: true }).map(item => item.isDirectory() ? scripts(path.join(directory, item.name)) : item.isFile() && item.name.endsWith(".js") ? readFileSync(path.join(directory, item.name), "utf8") : "").join("\n");
}
type Actor = { id: string; cookie: string };
describe.skipIf(!dbUrl)("Artifact completed-build actual Next/Auth/HTTP/PG (no AI)", () => {
  const pg = new Client({ connectionString: dbUrl }), actors: Actor[] = [], clients: SupabaseClient[] = [];
  let connected = false, app: ReturnType<typeof next> | undefined, server: http.Server | undefined, origin: string;
  let tables: string[], expected: Record<string, unknown[]>;
  async function snapshot() {
    const result: Record<string, unknown[]> = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [actors.map(a => a.id)])).rows.map(x => x.r);
    return result;
  }
  function bind() {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!), db = new URL(dbUrl!);
    if (![api.hostname, db.hostname].every(host => ["localhost", "127.0.0.1"].includes(host))) throw Error("Synthetic endpoints only");
    const build = readFileSync(".next/BUILD_ID", "utf8").trim(), key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!build || !key || !scripts(".next/static").includes(api.origin) || !scripts(".next/static").includes(key)) throw Error("Artifact completed build/config unbound");
    if (process.env.GITHUB_ACTIONS === "true") return;
    if (api.port !== "54331" || db.port !== "54332" || process.env.XP_RPG_DISPOSABLE_TEST_STACK !== "phase8f_test_artifact_20261012") throw Error("Artifact owned stack required");
    const creation = JSON.parse(readFileSync(process.env.XP_RPG_ARTIFACT_CREATION_RECEIPT!, "utf8")); expect(creation.project).toBe(process.env.XP_RPG_DISPOSABLE_TEST_STACK); expect(creation.containers).toHaveLength(4);
    for (const component of ["db", "auth", "rest", "kong"]) {
      const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${creation.project}`], { encoding: "utf8" }))[0], old = creation.containers.find((x: { component: string }) => x.component === component);
      expect(actual.Id).toBe(old.id); expect(actual.Created).toBe(old.created); expect(actual.State.Running).toBe(true);
      expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(creation.project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(creation.stack);
      if (component === "db" || component === "kong") { const ports = actual.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"]; expect(ports.length).toBeGreaterThan(0); expect(ports.every((p: { HostPort: string }) => p.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true); }
    }
    const receipt = JSON.parse(readFileSync(process.env.XP_RPG_ARTIFACT_BUILD_RECEIPT!, "utf8")); expect(receipt.cwd).toBe(process.cwd()); expect(receipt.buildId).toBe(build); expect(receipt.child).toEqual({ status: 0, signal: null, error: null });
    for (const file of ARTIFACT_MANUAL_PRODUCTION) expect(receipt.sources[file], file).toBe(sha(readFileSync(file)));
  }
  async function actor() {
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(api, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(admin);
    const credentials = { email: `artifact-http-${randomUUID()}@example.test`, password: `Synthetic!${randomUUID()}A` };
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true }); if (created.error || !created.data.user) throw Error("Synthetic user creation failed");
    const jar = new Map<string, string>();
    const client = createServerClient(api, publicKey, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(value => jar.set(value.name, value.value)) } }); clients.push(client);
    if ((await client.auth.signInWithPassword(credentials)).error) throw Error("Synthetic sign-in failed"); client.auth.stopAutoRefresh();
    const who = created.data.user.id, skill = randomUUID(), activity = randomUUID(), assessment = randomUUID();
    await pg.query("insert into public.skills(id,user_id,name,xp,level,mastery_level,status) values($1,$2,'Existing HTTP skill',500,4,0,'active')", [skill, who]);
    await pg.query("insert into public.activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing','Immutable','confirmed','http-existing')", [activity, who]);
    await pg.query("insert into public.ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','http-existing','{}')", [assessment, who, activity]);
    await pg.query("insert into public.xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'http-existing','Existing HTTP skill')", [who, activity, assessment, skill]);
    await pg.query("update public.player_states set total_xp=500,player_level=4 where user_id=$1", [who]);
    return { id: who, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
  }
  async function fixture(who = actors[0]) {
    const id = randomUUID(); await pg.query("insert into public.artifacts(id,user_id,title,artifact_type,lifecycle_status) values($1,$2,$3,'document','active')", [id, who.id, `HTTP <script>literal</script> ${id}`]); expected = await snapshot(); return id;
  }
  async function call(id: string, options: { actor?: Actor | null; method?: string; body?: unknown; suffix?: string; headers?: Record<string, string>; raw?: string } = {}) {
    const { actor = actors[0], method = "GET", body, suffix = "", headers = {}, raw } = options;
    const response = await fetch(`${origin}/api/artifacts/${id}/acceptance${suffix}`, { method, headers: { ...(actor ? { Cookie: actor.cookie } : {}), ...(method === "POST" ? { Origin: origin, "Content-Type": "application/json" } : {}), ...headers }, ...(body !== undefined || raw !== undefined ? { body: raw ?? JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toContain("Cookie"); expect(response.headers.get("content-type")).toContain("application/json"); return response;
  }
  async function input(id: string) {
    const response = await call(id); expect(response.status).toBe(200); const v = parseArtifactAcceptanceView(await response.json(), id, actors[0].id);
    return { requestKey: randomUUID(), expectedUpdatedAt: v.artifact.updatedAt, acceptanceNote: "I checked this deliverable" };
  }
  beforeAll(async () => {
    bind(); await pg.connect(); connected = true; actors.push(await actor(), await actor(), await actor());
    tables = (await pg.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' order by c.relname")).rows.map(x => x.relname).filter(t => !["artifact_acceptances", "reward_accounts", "reward_transactions", "outer_loop_audit_events"].includes(t));
    expect(tables.every(t => /^[a-z_]+$/.test(t))).toBe(true); expected = await snapshot();
    app = next({ dev: false, dir: process.cwd(), hostname: "127.0.0.1", port: 0 }); await app.prepare(); server = http.createServer(app.getRequestHandler());
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw Error("No owned Next listener"); origin = `http://127.0.0.1:${address.port}`;
  }, 30000);
  afterEach(async () => { expect(await snapshot()).toEqual(expected); });
  afterAll(async () => {
    try { server?.closeAllConnections(); if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve())); await app?.close(); }
    finally { for (const client of clients) client.auth.stopAutoRefresh(); if (connected) await pg.end(); }
    // Do not delete immutable successful fixtures; dispose the whole owned stack.
  });
  it("three real actors retain XP500/Level4 and no automatic acceptance on GET", async () => {
    for (const who of actors) { expect(expected.skills.find((x) => (x as { user_id: string }).user_id === who.id)).toMatchObject({ xp: 500, level: 4 }); expect(expected.player_states.find(x => (x as { user_id: string }).user_id === who.id)).toMatchObject({ total_xp: 500, player_level: 4 }); }
    const id = await fixture(); for (let n = 0; n < 2; n++) { const response = await call(id); expect(response.status).toBe(200); expect((await response.json()).acceptance).toBeNull(); }
    expect((await pg.query("select count(*)::int n from public.reward_accounts where user_id=$1", [actors[0].id])).rows[0].n).toBe(0);
  });
  it("real cookie accepts exactly100 and same-key replay never mints twice", async () => {
    const id = await fixture(), value = await input(id), response = await call(id, { method: "POST", body: value }); expect(response.status).toBe(200);
    const first = parseArtifactAcceptanceReceipt(await response.json(), id, actors[0].id); expect(first.earn.amount).toBe(100); expect(first.acceptance.recognitionClass).toBe("USER_CONFIRMED_ARTIFACT");
    expect(await (await call(id, { method: "POST", body: value })).json()).toEqual({ ...first, replayed: true }); expect((await call(id, { method: "POST", body: { ...value, requestKey: randomUUID() } })).status).toBe(409);
    expect((await pg.query("select count(*)::int n from public.reward_transactions where user_id=$1 and canonical_source_type='ARTIFACT' and canonical_source_id=$2", [actors[0].id, id])).rows[0].n).toBe(1);
  });
  it("anonymous auth wins before invalid params/query/body/origin for both routes", async () => {
    for (const suffix of ["?x=1", "/revoke?x=1"]) { const response = await call("bad-id", { actor: null, method: "POST", suffix, raw: "not-json", headers: { Origin: "https://foreign.invalid", "Content-Type": "text/plain" } }); expect(response.status).toBe(401); }
  });
  it("foreign and missing sources have indistinguishable404; never another owner data", async () => {
    const foreign = await fixture(actors[1]); const a = await call(foreign), b = await call(randomUUID()); expect(a.status).toBe(404); expect(b.status).toBe(404); expect(await a.json()).toEqual(await b.json());
    expect((await call(foreign, { method: "POST", body: { requestKey: randomUUID(), expectedUpdatedAt: "2026-10-12T00:00:00Z", acceptanceNote: "ok" } })).status).toBe(404);
  });
  it("same-key changed input is409 before archive eligibility checks", async () => {
    const id = await fixture(), value = await input(id); expect((await call(id, { method: "POST", body: value })).status).toBe(200);
    await pg.query("update public.artifacts set lifecycle_status='archived',is_archived=true where id=$1", [id]); expected = await snapshot();
    expect((await call(id, { method: "POST", body: { ...value, acceptanceNote: "changed" } })).status).toBe(409);
    const replay = await (await call(id, { method: "POST", body: value })).json(); expect(replay.replayed).toBe(true); expect(replay.acceptance.status).toBe("ACTIVE");
  });
  it("stale microsecond timestamp rejects409 without an acceptance", async () => {
    const id = await fixture(), value = await input(id); value.expectedUpdatedAt = (await pg.query("select to_char((updated_at-interval '1 microsecond') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') v from public.artifacts where id=$1", [id])).rows[0].v;
    const response = await call(id, { method: "POST", body: value }); expect(response.status).toBe(409); expect(await response.json()).toEqual({ code: "ARTIFACT_ACCEPTANCE_STALE_SOURCE" });
  });
  it.each(["amount", "userId", "policyVersion", "recognitionClass"])("client-supplied %s never acquires authority", async field => {
    const id = await fixture(), value = await input(id); expect((await call(id, { method: "POST", body: { ...value, [field]: 1000 } })).status).toBe(400);
  });
  it("cross-origin/media/body/query boundaries return safe no-store JSON", async () => {
    const id = await fixture(), value = await input(id);
    expect((await call(id, { method: "POST", body: value, headers: { Origin: "https://foreign.invalid" } })).status).toBe(403);
    expect((await call(id, { method: "POST", body: value, headers: { "Content-Type": "text/plain" } })).status).toBe(415);
    expect((await call(id, { method: "POST", raw: "{" })).status).toBe(400);
    expect((await call(id, { suffix: "?bad=1" })).status).toBe(400);
    expect((await call(id, { method: "POST", raw: " ".repeat(16385) })).status).toBe(413);
  });
  it("generic correction is visible onACTIVE; revoke reuses exact correction and terminates", async () => {
    const id = await fixture(), value = await input(id), accepted = parseArtifactAcceptanceReceipt(await (await call(id, { method: "POST", body: value })).json(), id, actors[0].id);
    await pg.query("begin"); let correction: string;
    try { await pg.query("set local role authenticated"); await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [actors[0].id]); correction = (await pg.query("select public.rpc_correct_reward_transaction($1,'Generic HTTP fixture',$2) r", [accepted.earn.id, randomUUID()])).rows[0].r.transaction.id; await pg.query("commit"); } catch (error) { await pg.query("rollback"); throw error; }
    const active = parseArtifactAcceptanceView(await (await call(id)).json(), id, actors[0].id); expect(active.acceptance?.status).toBe("ACTIVE"); expect(active.correction?.id).toBe(correction);
    const body = { requestKey: randomUUID(), reason: "User revoked after review" }, revoked = parseArtifactAcceptanceReceipt(await (await call(id, { method: "POST", suffix: "/revoke", body })).json(), id, actors[0].id);
    expect(revoked.acceptance.status).toBe("REVOKED"); expect(revoked.correction?.id).toBe(correction);
    expect(await (await call(id, { method: "POST", suffix: "/revoke", body })).json()).toEqual({ ...revoked, replayed: true });
    expect((await call(id, { method: "POST", body: { ...value, requestKey: randomUUID() } })).status).toBe(409);
  });
});
