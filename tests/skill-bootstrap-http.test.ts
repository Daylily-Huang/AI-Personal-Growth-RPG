import http from "node:http";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import next from "next";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { isZeroXpSkillReceipt } from "@/lib/skills/bootstrap";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
type Actor = { id: string; cookie: string };
describe.skipIf(!dbUrl)("manual skill real production Next/Auth/PostgreSQL", () => {
  const pg = new Client({ connectionString: dbUrl });
  let app: ReturnType<typeof next>; let server: http.Server; let base: string; let a: Actor; let b: Actor;
  const additions: string[] = []; const addedRows = new Map<string, unknown>(); let original: unknown; let tables: string[];
  async function remember(id: string, owner: string) {
    const row = (await pg.query("select to_jsonb(s) as r from skills s where id=$1", [id])).rows[0]?.r;
    expect(row).toMatchObject({ user_id: owner, xp: 0, level: 1, mastery_level: 0, mastery_confidence: 0, status: "active" });
    additions.push(id); addedRows.set(id, row);
  }
  async function actor(): Promise<Actor> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const credentials = { email: `skill-bootstrap-${randomUUID()}@example.test`, password: `Zero-${randomUUID()}!` };
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    expect(created.error).toBeNull(); if (!created.data.user) throw Error("Missing synthetic user");
    const jar = new Map<string, string>();
    const client = createServerClient(url, key, { cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: values => { for (const { name, value } of values) { if (value) jar.set(name, value); else jar.delete(name); } },
    } });
    expect((await client.auth.signInWithPassword(credentials)).error).toBeNull();
    return { id: created.data.user.id, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
  }
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) as r from public.${table} t
      where user_id=any($1::uuid[]) ${table === "skills" ? "and not(id=any($2::uuid[]))" : ""} order by to_jsonb(t)::text`,
    table === "skills" ? [[a.id, b.id], additions] : [[a.id, b.id]])).rows;
    return result;
  }
  async function post(actor: Actor | null, value: unknown, raw = false) {
    const response = await fetch(`${base}/api/skills`, { method: "POST", redirect: "manual", headers: {
      "Content-Type": "application/json", ...(actor ? { Cookie: actor.cookie } : {}),
    }, body: raw ? String(value) : JSON.stringify(value) });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    return { status: response.status, body: await response.json() };
  }
  async function get(actor: Actor, path = "/api/skills?status=all") {
    const response = await fetch(`${base}${path}`, { headers: { Cookie: actor.cookie } });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    const db = new URL(dbUrl!), api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(db.hostname) || !["127.0.0.1", "localhost"].includes(api.hostname)) throw Error("Local disposable only");
    if (process.env.GITHUB_ACTIONS !== "true") {
      const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK;
      if (!project || !/^phase8f_(r3|test)_[a-z0-9_]+$/.test(project) || db.port !== "54332" || api.port !== "54331") throw Error("Task ownership required");
      expect(execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "com.supabase.cli.project"}}', `supabase_db_${project}`], { encoding: "utf8" }).trim()).toBe(project);
    }
    await pg.connect();
    app = next({ dev: false, hostname: "127.0.0.1", dir: process.cwd() }); await app.prepare();
    server = http.createServer(app.getRequestHandler());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw Error("Missing owned server port");
    base = `http://127.0.0.1:${address.port}`; a = await actor(); b = await actor();
    for (const owner of [a.id, b.id]) {
      const skill = randomUUID(), activity = randomUUID(), assessment = randomUUID();
      await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,'Populated Core',500,2,8,0.8,'archived')", [skill, owner]);
      await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Old confirmed','Original input','confirmed','bootstrap-http')", [activity, owner]);
      await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','bootstrap-http','{}')", [assessment, owner, activity]);
      await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'bootstrap-http','Populated Core')", [owner, activity, assessment, skill]);
      await pg.query("update player_states set total_xp=500,player_level=2 where user_id=$1", [owner]);
      await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing',true)", [owner, activity, skill]);
    }
    tables = (await pg.query(`select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      join pg_attribute at on at.attrelid=c.oid where n.nspname='public' and c.relkind='r' and at.attname='user_id' order by c.relname`)).rows.map(r => r.relname);
    expect(tables.every(t => /^[a-z_]+$/.test(t))).toBe(true); original = await snapshot();
  }, 60000);
  afterAll(async () => {
    try {
      if (original) expect(await snapshot()).toEqual(original);
      for (const [id, row] of addedRows) expect((await pg.query("select to_jsonb(s) as r from skills s where id=$1", [id])).rows[0]?.r).toEqual(row);
    }
    finally {
      if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
      if (app) await app.close(); await pg.end();
    }
  });
  test("unauthenticated malformed request is401 before parsing", async () => {
    expect(await post(null, "{", true)).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
  });
  test("create, GET graph, stable detail and reload at zero", async () => {
    const result = await post(a, { name: " Molecular Ecology " }); expect(result.status).toBe(201);
    expect(isZeroXpSkillReceipt(result.body.skill, "Molecular Ecology")).toBe(true); await remember(result.body.skill.id, a.id);
    const graph = await get(a); expect(graph.status).toBe(200);
    expect(graph.body.nodes).toContainEqual(expect.objectContaining({ id: result.body.skill.id }));
    const detail = await get(a, `/api/skills/${result.body.skill.id}`); expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).toContain("Molecular Ecology");
    expect((await get(a)).body.nodes.map((n: { id: string }) => n.id)).toContain(result.body.skill.id);
  });
  test("normalized replay conflicts; no resurrection of old growth", async () => {
    expect((await post(a, { name: "molecular   ECOLOGY" })).status).toBe(409);
    expect((await post(a, { name: "populated core" })).status).toBe(409);
    expect(await snapshot()).toEqual(original);
  });
  test("B cannot read A skill; same B label gets different own identity", async () => {
    const denied = await get(b, `/api/skills/${additions[0]}`); expect(denied.status).toBe(404);
    expect((await get(b)).body.nodes.map((n: { id: string }) => n.id)).not.toContain(additions[0]);
    const result = await post(b, { name: "Molecular Ecology" }); expect(result.status).toBe(201);
    expect(result.body.skill.id).not.toBe(additions[0]); await remember(result.body.skill.id, b.id);
    expect((await get(a)).body.nodes.map((n: { id: string }) => n.id)).not.toContain(result.body.skill.id);
  });
  test.each(["userId", "user_id", "id", "xp", "level", "masteryLevel", "masteryConfidence", "domainId", "description", "verified"])("HTTP rejects forbidden %s without writes", async field => {
    expect((await post(a, { name: "Forged", [field]: field.includes("user") ? b.id : 500 })).status).toBe(400);
    expect(await snapshot()).toEqual(original);
  });
  test("malformed JSON/NUL/surrogate/prototype payload safe400", async () => {
    for (const value of ["{", '{"name":"x","__proto__":{}}', '{"name":"x\\u0000y"}', '{"name":"\\ud800"}'])
      expect((await post(a, value, true)).status).toBe(400);
  });
  test("two real simultaneous creates one201 and one409", async () => {
    const results = await Promise.all([post(a, { name: "Concurrent HTTP" }), post(a, { name: " concurrent   HTTP " })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const success = results.find(r => r.status === 201)!; await remember(success.body.skill.id, a.id);
    expect(isZeroXpSkillReceipt(success.body.skill, success.body.skill.name)).toBe(true); expect(await snapshot()).toEqual(original);
  });
});
