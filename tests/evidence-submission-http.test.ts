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
import { playerLevelFromXp } from "@/lib/growth-engine/levels";
import { parseEvidenceResult } from "@/lib/evidence-submission/validation";
import { EVIDENCE_SUBMISSION_PRODUCTION, EVIDENCE_SUBMISSION_MIGRATION } from "./helpers/governance-delta";

type Actor = { id: string; activity: string; skill: string; cookie: string };
type Snapshot = Record<string, Record<string, unknown>[]>;
const dbUrl = process.env.XP_RPG_TEST_DB_URL;
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex").toUpperCase();
function chunks(directory: string): string {
  return readdirSync(directory, { withFileTypes: true }).map(item => item.isDirectory() ? chunks(path.join(directory, item.name)) : item.isFile() && item.name.endsWith(".js") ? readFileSync(path.join(directory, item.name), "utf8") : "").join("\n");
}
describe.skipIf(!dbUrl)("completed-build manual evidence real Auth/Next/HTTP/PostgreSQL", () => {
  const pg = new Client({ connectionString: dbUrl }); let connected = false;
  let app: ReturnType<typeof next> | undefined, server: http.Server | undefined, base: string;
  const actors: Actor[] = [], clients: SupabaseClient[] = []; let tables: string[] = [], expected: Snapshot;
  function bind() {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!), db = new URL(dbUrl!);
    if (![api.hostname, db.hostname].every(host => ["localhost", "127.0.0.1"].includes(host))) throw Error("Only isolated evidence HTTP stack");
    const buildId = readFileSync(".next/BUILD_ID", "utf8").trim(); expect(buildId).not.toBe("");
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!publicKey || !chunks(".next/static").includes(api.origin) || !chunks(".next/static").includes(publicKey)) throw Error("EVIDENCE_BUILD_CONFIG_UNBOUND");
    if (process.env.GITHUB_ACTIONS === "true") return;
    const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK, creationPath = process.env.XP_RPG_EVIDENCE_CREATION_RECEIPT,
      buildPath = process.env.XP_RPG_EVIDENCE_BUILD_RECEIPT;
    if (!project || !/^phase8f_test_[a-z0-9_]+$/.test(project) || api.port !== "54331" || db.port !== "54332" || !creationPath || !buildPath) throw Error("Evidence owned stack/build receipts required");
    const creation = JSON.parse(readFileSync(creationPath, "utf8")); expect(creation.project).toBe(project); expect(creation.containers).toHaveLength(4);
    for (const component of ["db", "auth", "rest", "kong"]) {
      const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${project}`], { encoding: "utf8" }))[0];
      const original = creation.containers.find((row: { component: string }) => row.component === component);
      expect(actual.Id).toBe(original.id); expect(actual.Created).toBe(original.created); expect(actual.State.Status).toBe("running");
      expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(creation.stack);
      if (component === "db" || component === "kong") expect(actual.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"].every((port: { HostPort: string }) => port.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
    }
    const receipt = JSON.parse(readFileSync(buildPath, "utf8")); expect(receipt.cwd).toBe(process.cwd()); expect(receipt.buildId).toBe(buildId);
    expect(receipt.child).toMatchObject({ status: 0, signal: null, error: null });
    for (const file of [...EVIDENCE_SUBMISSION_PRODUCTION, EVIDENCE_SUBMISSION_MIGRATION]) expect(receipt.sources[file]).toBe(sha(readFileSync(file)));
  }
  async function actor(): Promise<Actor> {
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(api, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(admin);
    const credentials = { email: `evidence-http-${randomUUID()}@example.test`, password: `Synthetic!${randomUUID()}a` };
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    if (created.error || !created.data.user) throw Error("Synthetic evidence actor creation failed");
    const jar = new Map<string, string>();
    const session = createServerClient(api, publicKey, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(value => jar.set(value.name, value.value)) } }); clients.push(session);
    if ((await session.auth.signInWithPassword(credentials)).error) throw Error("Synthetic evidence actor signin failed");
    session.auth.stopAutoRefresh(); const id = created.data.user.id, activity = randomUUID(), skill = randomUUID();
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Evidence HTTP','Full preserved raw\n<script>literal</script>','confirmed','evidence-http-frozen')", [activity, id]);
    await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,$3,500,$4,8,0.8,'active')", [skill, id, `HTTP-${skill}`, playerLevelFromXp(500)]);
    return { id, activity, skill, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
  }
  async function snapshot(): Promise<Snapshot> {
    const result: Snapshot = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) as r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [actors.map(who => who.id)])).rows.map(row => row.r);
    return result;
  }
  async function call(who: Actor | null, suffix = "", method = "GET", body?: string | Uint8Array, extra: Record<string, string> = {}) {
    return fetch(`${base}/api/activities/${actors[0].activity}/evidence${suffix}`, { method, redirect: "manual", headers: {
      ...(who ? { Cookie: who.cookie } : {}), ...(method === "POST" ? { "Content-Type": "application/json", Origin: base } : {}), ...extra,
    }, body: body as BodyInit | undefined });
  }
  function input(description = "HTTP <script>完整纯文字</script> https://example.invalid", skillId: string | null = actors[0].skill) { return { requestId: randomUUID(), skillId, description }; }
  async function created(value: ReturnType<typeof input>) {
    const response = await call(actors[0], "", "POST", JSON.stringify(value)); expect(response.status).toBe(201);
    const result = parseEvidenceResult(await response.json(), actors[0].activity, value);
    const after = await snapshot(), without = structuredClone(after);
    without.evidence_records = without.evidence_records.filter(row => row.id !== result.submission.evidence.id);
    without.evidence_submissions = without.evidence_submissions.filter(row => row.request_id !== value.requestId);
    expect(without).toEqual(expected); expected = after; return result;
  }
  beforeAll(async () => {
    bind(); await pg.connect(); connected = true; actors.push(await actor(), await actor());
    tables = (await pg.query(`select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute at on at.attrelid=c.oid where n.nspname='public' and c.relkind='r' and at.attname='user_id' order by c.relname`)).rows.map(row => row.relname);
    expect(tables.every(table => /^[a-z_]+$/.test(table))).toBe(true); expected = await snapshot();
    app = next({ dev: false, dir: process.cwd(), hostname: "127.0.0.1", port: 0 }); await app.prepare();
    server = http.createServer(app.getRequestHandler()); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw Error("No evidence test listener"); base = `http://127.0.0.1:${address.port}`;
  }, 30000);
  afterEach(async () => { expect(await snapshot()).toEqual(expected); });
  afterAll(async () => {
    try { server?.closeAllConnections(); if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve())); await app?.close(); }
    finally { for (const client of clients) client.auth.stopAutoRefresh(); if (connected) await pg.end(); }
    // Immutable fixtures are deliberately left for exact whole-stack disposal.
  });
  it("real cookie201 then exact200 replay and409 conflict; public safe headers and zero other Core", async () => {
    const value = input(), first = await created(value), response = await call(actors[0], "", "POST", JSON.stringify(value));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toContain("Cookie");
    expect(parseEvidenceResult(await response.json(), actors[0].activity, value)).toEqual({ ...first, replayed: true });
    expect((await call(actors[0], "", "POST", JSON.stringify({ ...value, description: "changed" }))).status).toBe(409);
  });
  it("anonymous malformed body/query/origin are401 before business parsing", async () => {
    for (const method of ["GET", "POST"]) expect((await call(null, "?view=bad", method, method === "POST" ? "{" : undefined, { Origin: "https://evil.invalid", "Content-Type": "text/plain" })).status).toBe(401);
  });
  it("real foreign session and missing Skill both404 without existence leak", async () => {
    const foreign = await call(actors[1]); expect(foreign.status).toBe(404);
    for (const skillId of [actors[1].skill, randomUUID()]) expect((await call(actors[0], "", "POST", JSON.stringify(input("x", skillId)))).status).toBe(404);
  });
  it.each(["view=skills&view=skills", "after=", "unknown=x"])("query %s400 and POST query400", async query => {
    expect((await call(actors[0], `?${query}`)).status).toBe(400); expect((await call(actors[0], `?${query}`, "POST", JSON.stringify(input()))).status).toBe(400);
  });
  it("safe malformed UTF8/JSON400, media415, foreignOrigin/crossSite403 and largebody413", async () => {
    expect((await call(actors[0], "", "POST", Uint8Array.from([0xc3, 0x28]))).status).toBe(400);
    expect((await call(actors[0], "", "POST", "{")).status).toBe(400);
    expect((await call(actors[0], "", "POST", JSON.stringify(input()), { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await call(actors[0], "", "POST", JSON.stringify(input()), { Origin: "https://evil.invalid" })).status).toBe(403);
    expect((await call(actors[0], "", "POST", JSON.stringify(input()), { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
    expect((await call(actors[0], "", "POST", JSON.stringify(input("a".repeat(17000))))).status).toBe(413);
  });
  it("GET submissions/skills only own bounded safe DTO, no growth write", async () => {
    const material = input(); await created(material);
    const response = await call(actors[0]), data = await response.json(); expect(response.status).toBe(200);
    expect(data.items.some((row: { requestId: string }) => row.requestId === material.requestId)).toBe(true); expect(JSON.stringify(data)).not.toContain(actors[0].id);
    const skills = await (await call(actors[0], "?view=skills")).json(); expect(skills.items.map((row: { id: string }) => row.id)).toContain(actors[0].skill); expect(skills.items.map((row: { id: string }) => row.id)).not.toContain(actors[1].skill);
  });
  it("old original Activity GET/raw/status remain intact after E0 append", async () => {
    const response = await fetch(`${base}/api/activities/${actors[0].activity}`, { headers: { Cookie: actors[0].cookie }, redirect: "manual" });
    expect(response.status).toBe(200); expect((await response.json()).activity).toMatchObject({ status: "confirmed", rawInput: "Full preserved raw\n<script>literal</script>", rulesVersion: "evidence-http-frozen" });
  });
  it("unsupported method retains framework405 without pretending business authentication", async () => { expect((await call(null, "", "PATCH")).status).toBe(405); });
});
