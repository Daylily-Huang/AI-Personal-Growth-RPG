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
import { PROPOSAL_FACT_EDIT_PRODUCTION } from "./helpers/governance-delta";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex").toUpperCase();
type Actor = { id: string; cookie: string; skill: string };
type Fixture = { actor: Actor; activity: string; assessment: string };
type Snapshot = Record<string, Record<string, unknown>[]>;
const output = () => ({ activity: { type: "learning", completion: 0.145 }, difficulty: { complexity: 0.5, uncertainty: 0.2, expertise_gap: 0.3, resistance: 0.1 },
  growth: { effort: 0.6, learning: 0.7, performance: 0.4, outcome: 0.5, artifact_value: 0, character_evidence: 0 },
  evidence: { level: 0, explanation: "self-report only" }, affected_skills: [{ name: "Statistics", reason: "clue only" }],
  knowledge_updates: { proposed_nodes: [], proposed_edges: [] }, mastery_changes: [],
  xp_semantics: { base_value: 50, difficulty: 0.5, mastery_gain: 0.2, novelty: 0.4, goal_alignment: 0.7, repetition_risk: "low" },
  next_quest: null, confidence: 0.7, uncertainty_notes: [], artifacts: [] });
function chunks(directory: string): string {
  return readdirSync(directory, { withFileTypes: true }).map(item => item.isDirectory() ? chunks(path.join(directory, item.name))
    : item.isFile() && item.name.endsWith(".js") ? readFileSync(path.join(directory, item.name), "utf8") : "").join("\n");
}

describe.skipIf(!dbUrl)("proposal facts completed-build real Auth/Next/HTTP/PG with controlled synthetic AI", () => {
  const pg = new Client({ connectionString: dbUrl }); let connected = false;
  let app: ReturnType<typeof next> | undefined, server: http.Server | undefined, ai: http.Server | undefined, origin: string;
  let aiMode: "success" | "invalid" | "hold" = "success", dispatches = 0;
  const held: { release?: () => void } = {};
  function releaseHeld() { held.release?.(); held.release = undefined; }
  const actors: Actor[] = [], clients: SupabaseClient[] = [], aiBodies: unknown[] = [];
  let tables: string[] = [], expected: Snapshot;
  const envNames = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL"];
  const saved = new Map(envNames.map(name => [name, process.env[name]]));
  function bind() {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!), db = new URL(dbUrl!);
    if (![api.hostname, db.hostname].every(host => ["127.0.0.1", "localhost"].includes(host))) throw Error("Synthetic edit HTTP only");
    const buildId = readFileSync(".next/BUILD_ID", "utf8").trim(), key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!buildId || !key || !chunks(".next/static").includes(api.origin) || !chunks(".next/static").includes(key)) throw Error("EDIT_BUILD_CONFIG_UNBOUND");
    if (process.env.GITHUB_ACTIONS === "true") return;
    const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK, creationPath = process.env.XP_RPG_PROPOSAL_EDIT_CREATION_RECEIPT,
      buildPath = process.env.XP_RPG_PROPOSAL_EDIT_BUILD_RECEIPT;
    if (!project || !/^phase8f_test_[a-z0-9_]+$/.test(project) || api.port !== "54331" || db.port !== "54332" || !creationPath || !buildPath)
      throw Error("Owned edit HTTP creation/build receipts required");
    const creation = JSON.parse(readFileSync(creationPath, "utf8")); expect(creation.project).toBe(project); expect(creation.containers).toHaveLength(4);
    for (const component of ["db", "auth", "rest", "kong"]) {
      const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${project}`], { encoding: "utf8" }))[0];
      const original = creation.containers.find((row: { component: string }) => row.component === component);
      expect(actual.Id).toBe(original.id); expect(actual.Created).toBe(original.created); expect(actual.State.Status).toBe("running");
      expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(creation.stack);
      if (component === "db" || component === "kong") {
        const ports = actual.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"];
        expect(ports.length).toBeGreaterThan(0); expect(ports.every((p: { HostPort: string }) => p.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
      }
    }
    const receipt = JSON.parse(readFileSync(buildPath, "utf8")); expect(receipt.cwd).toBe(process.cwd()); expect(receipt.buildId).toBe(buildId);
    expect(receipt.child).toMatchObject({ status: 0, signal: null, error: null });
    for (const file of PROPOSAL_FACT_EDIT_PRODUCTION) expect(receipt.sources[file]).toBe(sha(readFileSync(file)));
  }
  async function actor(): Promise<Actor> {
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(api, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(admin);
    const credentials = { email: `edit-http-${randomUUID()}@example.test`, password: `Synthetic!${randomUUID()}a` };
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    if (created.error || !created.data.user) throw Error("Synthetic actor creation failed");
    const jar = new Map<string, string>();
    const session = createServerClient(api, publicKey, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: values => values.forEach(value => jar.set(value.name, value.value)) } }); clients.push(session);
    if ((await session.auth.signInWithPassword(credentials)).error) throw Error("Synthetic signin failed");
    session.auth.stopAutoRefresh(); const id = created.data.user.id, skill = randomUUID(), oldActivity = randomUUID(), oldAssessment = randomUUID();
    await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,'Statistics',500,$3,8,0.8,'active')", [skill, id, playerLevelFromXp(500)]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Prior','Historical XP','confirmed','0.1.0')", [oldActivity, id]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json,confidence) values($1,$2,$3,'confirmed','0.1.0','{}',0.7)", [oldAssessment, id, oldActivity]);
    await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'0.1.0','Statistics')", [id, oldActivity, oldAssessment, skill]);
    await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1", [id, playerLevelFromXp(500)]);
    return { id, skill, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
  }
  async function snapshot(): Promise<Snapshot> {
    const result: Snapshot = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [actors.map(who => who.id)])).rows.map(row => row.r);
    return result;
  }
  async function fixture(who = actors[0]): Promise<Fixture> {
    const activity = randomUUID(), assessment = randomUUID();
    await pg.query("insert into activities(id,user_id,title,raw_input,total_minutes,effective_minutes,status,rules_version) values($1,$2,'Statistics','Original immutable statistics <script>literal</script>',120,120,'assessed','0.1.0')", [activity, who.id]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json,model_name,prompt_version,confidence) values($1,$2,$3,'pending','0.1.0',$4,'original-model','activity-evaluator-v0.3-context',0.7)", [assessment, who.id, activity, JSON.stringify(output())]);
    expected = await snapshot(); return { actor: who, activity, assessment };
  }
  const material = (who = actors[0]) => ({ requestId: randomUUID(), facts: { description: "实际学习 statistics，不是原记录的120分钟", totalMinutes: 60, effectiveMinutes: 35, relatedSkillIds: [who.skill] } });
  async function call(f: Fixture, method = "GET", body?: string | Uint8Array, query = "", who: Actor | null = f.actor, headers: Record<string, string> = {}) {
    return fetch(`${origin}/api/assessments/${f.assessment}/edit${query}`, { method, redirect: "manual", headers: {
      ...(who ? { Cookie: who.cookie } : {}), ...(method === "POST" ? { "Content-Type": "application/json", Origin: origin } : {}), ...headers,
    }, body: body as BodyInit | undefined });
  }
  async function revised(f: Fixture, value = material(f.actor)) {
    const count = dispatches, before = expected, response = await call(f, "POST", JSON.stringify(value));
    expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toContain("Cookie");
    const data = await response.json(); expect(data).toMatchObject({ replayed: false, request: { requestId: value.requestId, facts: value.facts, status: "completed",
      completion: { assessment: { status: "pending", modelName: "synthetic-facts-only", promptVersion: "activity-evaluator-v0.4-facts" } } } });
    expect(dispatches).toBe(count + 1); expect(JSON.stringify(data)).not.toContain(f.actor.id); expect(data.request).not.toHaveProperty("dispatch");
    const after = await snapshot(), old = before.ai_assessments.find(row => row.id === f.assessment)!;
    const changedOld = after.ai_assessments.find(row => row.id === f.assessment)!;
    expect(changedOld).toEqual({ ...old, status: "superseded", updated_at: changedOld.updated_at });
    const fresh = after.ai_assessments.filter(row => !before.ai_assessments.some(previous => previous.id === row.id)); expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ id: data.request.completion.assessment.id, user_id: f.actor.id, activity_id: f.activity, assessment_json: output() });
    expect({ ...after, ai_assessments: before.ai_assessments }).toEqual(before); expected = after; return { data, value };
  }
  beforeAll(async () => {
    bind(); await pg.connect(); connected = true; actors.push(await actor(), await actor(), await actor());
    tables = (await pg.query("select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' order by c.relname")).rows.map(row => row.relname)
      .filter(table => !["proposal_fact_edit_requests", "proposal_fact_revisions"].includes(table));
    expect(tables.every(table => /^[a-z_]+$/.test(table))).toBe(true); expected = await snapshot();
    ai = http.createServer(async (request, response) => {
      let body = ""; for await (const chunk of request) { body += String(chunk); if (Buffer.byteLength(body) > 131072) { response.writeHead(413).end(); return; } }
      dispatches++; aiBodies.push(JSON.parse(body));
      const finish = () => { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ id: "synthetic", object: "chat.completion", created: 1,
        model: "synthetic-facts-only", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: aiMode === "invalid" ? "not-json" : JSON.stringify(output()) } }] })); };
      if (aiMode === "hold") held.release = finish; else finish();
    });
    await new Promise<void>(resolve => ai!.listen(0, "127.0.0.1", resolve)); const address = ai.address();
    if (!address || typeof address === "string") throw Error("No synthetic AI listener");
    process.env.AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`; process.env.AI_API_KEY = "synthetic-not-a-secret"; process.env.AI_MODEL = "synthetic-facts-only";
    app = next({ dev: false, dir: process.cwd(), hostname: "127.0.0.1", port: 0 }); await app.prepare(); server = http.createServer(app.getRequestHandler());
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve)); const nextAddress = server.address();
    if (!nextAddress || typeof nextAddress === "string") throw Error("No edit HTTP listener"); origin = `http://127.0.0.1:${nextAddress.port}`;
  }, 30000);
  afterEach(async () => { aiMode = "success"; expect(await snapshot()).toEqual(expected); });
  afterAll(async () => {
    releaseHeld();
    try {
      for (const owned of [server, ai]) { owned?.closeAllConnections(); if (owned?.listening) await new Promise<void>(resolve => owned.close(() => resolve())); }
      await app?.close();
    } finally {
      for (const client of clients) client.auth.stopAutoRefresh(); if (connected) await pg.end();
      for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    }
    // Immutable synthetic fixtures stay for exact whole-stack disposal, never guard bypass deletion.
  });
  it("three real actors have consistent populated XP500/Level4 baselines", async () => {
    for (const who of actors) {
      expect(expected.skills.find(row => row.user_id === who.id)).toMatchObject({ xp: 500, level: 4 });
      expect(expected.player_states.find(row => row.user_id === who.id)).toMatchObject({ total_xp: 500, player_level: 4 });
      expect(expected.xp_transactions.filter(row => row.user_id === who.id).reduce((sum, row) => sum + Number(row.amount), 0)).toBe(500);
    }
  });
  it("real cookie creates201 once, same-key replay200 never dispatches AI again", async () => {
    const f = await fixture(), { data, value } = await revised(f), count = dispatches;
    const replay = await call(f, "POST", JSON.stringify(value)); expect(replay.status).toBe(200); expect(await replay.json()).toEqual({ ...data, replayed: true }); expect(dispatches).toBe(count);
    expect((await call(f, "POST", JSON.stringify({ ...value, facts: { ...value.facts, effectiveMinutes: 36 } }))).status).toBe(409); expect(dispatches).toBe(count);
  });
  it("facts and skills reads are own-only fixed DTOs; foreign/missing suggestions404", async () => {
    const f = await fixture(), count = dispatches, response = await call(f), facts = await response.json(); expect(response.status).toBe(200);
    expect(facts.original).toEqual({ description: "Original immutable statistics <script>literal</script>", descriptionTruncated: false, totalMinutes: 120, effectiveMinutes: 120 });
    expect(facts.currentRevision).toBeNull(); const skills = await (await call(f, "GET", undefined, "?view=skills")).json();
    expect(skills.items.map((row: { id: string }) => row.id)).toContain(f.actor.skill); expect(skills.items.map((row: { id: string }) => row.id)).not.toContain(actors[1].skill);
    expect((await call(f, "GET", undefined, "", actors[1])).status).toBe(404); expect((await call({ ...f, assessment: randomUUID() })).status).toBe(404); expect(dispatches).toBe(count);
  });
  it.each(["GET", "POST"])("anonymous %s authenticates before malformed query/body/header", async method => {
    const f = await fixture(), count = dispatches; expect((await call(f, method, method === "POST" ? "{" : undefined, "?bad=x", null,
      { Origin: "https://evil.invalid", "Content-Type": "text/plain" })).status).toBe(401); expect(dispatches).toBe(count);
  });
  it.each(["?view=skills&view=skills", "?after=", "?unknown=x"])("malformed query %s400 with zero model dispatch", async query => {
    const f = await fixture(), count = dispatches; expect((await call(f, "GET", undefined, query)).status).toBe(400);
    expect((await call(f, "POST", JSON.stringify(material()), query)).status).toBe(400); expect(dispatches).toBe(count);
  });
  it("bad UTF8/JSON400/media415/body413/origin403 never starts model", async () => {
    const f = await fixture(), count = dispatches;
    for (const body of ["{", Uint8Array.from([0xc3, 0x28])]) expect((await call(f, "POST", body)).status).toBe(400);
    expect((await call(f, "POST", JSON.stringify(material()), "", f.actor, { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await call(f, "POST", "x".repeat(16385))).status).toBe(413);
    expect((await call(f, "POST", JSON.stringify(material()), "", f.actor, { Origin: "https://evil.invalid" })).status).toBe(403);
    expect((await call(f, "POST", JSON.stringify(material()), "", f.actor, { "Sec-Fetch-Site": "cross-site" })).status).toBe(403); expect(dispatches).toBe(count);
  });
  it("foreign clue404 and client score/owner fields400 are rejected before AI", async () => {
    const f = await fixture(), count = dispatches, value = material();
    expect((await call(f, "POST", JSON.stringify({ ...value, facts: { ...value.facts, relatedSkillIds: [actors[1].skill] } }))).status).toBe(404);
    for (const body of [{ ...value, owner: f.actor.id }, { ...value, facts: { ...value.facts, xp: 999 } }]) expect((await call(f, "POST", JSON.stringify(body))).status).toBe(400);
    expect(dispatches).toBe(count);
  });
  it("invalid synthetic model fails502; replay/status reads preserve original pending without retry", async () => {
    const f = await fixture(), value = material(), count = dispatches; aiMode = "invalid";
    const failed = await call(f, "POST", JSON.stringify(value)); expect(failed.status).toBe(502); expect(await failed.json()).toMatchObject({ requestId: value.requestId, status: "failed" });
    expect(dispatches).toBe(count + 1); aiMode = "success";
    expect((await call(f, "POST", JSON.stringify(value))).status).toBe(502);
    expect((await call(f, "GET", undefined, `?view=request&requestId=${value.requestId}`)).status).toBe(502); expect(dispatches).toBe(count + 1);
    expect((await pg.query("select status from ai_assessments where id=$1", [f.assessment])).rows[0].status).toBe("pending");
  });
  it("real same-key concurrent request202, different key409, held AI completes once", async () => {
    const f = await fixture(), value = material(); aiMode = "hold"; held.release = undefined;
    const first = call(f, "POST", JSON.stringify(value)); const observed = first.then(response => ({ response }), error => ({ error }));
    try {
      await expect.poll(() => Boolean(held.release), { timeout: 10000 }).toBe(true);
      const pending = await call(f, "POST", JSON.stringify(value)); expect(pending.status).toBe(202); expect(pending.headers.get("retry-after")).toBe("3"); expect(await pending.json()).toEqual({ requestId: value.requestId, status: "in_progress" });
      expect((await call(f, "POST", JSON.stringify({ ...value, requestId: randomUUID() }))).status).toBe(409);
      expect((await fetch(`${origin}/api/activities/${f.activity}/assess`, { method: "POST", headers: { Cookie: f.actor.cookie } })).status).toBe(409);
    } finally { releaseHeld(); }
    const result = await observed; if (!("response" in result)) throw result.error;
    expect(result.response.status).toBe(201); const data = await result.response.json(), after = await snapshot();
    expect(after.ai_assessments.filter(row => row.activity_id === f.activity)).toHaveLength(2);
    expect(data.request.completion.assessment.status).toBe("pending");
    expect({ ...after, ai_assessments: expected.ai_assessments }).toEqual(expected); expected = after;
  });
  it("history retains full facts/provenance, old Activity remains immutable, reads dispatch zero", async () => {
    const f = await fixture(), { data, value } = await revised(f), count = dispatches;
    const response = await fetch(`${origin}/api/activities/${f.activity}/fact-revisions`, { headers: { Cookie: f.actor.cookie } }); expect(response.status).toBe(200);
    const history = await response.json(); expect(history.items).toHaveLength(1); expect(history.items[0]).toMatchObject({ requestId: value.requestId, facts: value.facts,
      resultAssessmentId: data.request.completion.assessment.id, modelName: "synthetic-facts-only", promptVersion: "activity-evaluator-v0.4-facts", assessmentStatus: "pending" });
    expect(JSON.stringify(history)).not.toContain(f.actor.id); expect(history.items[0]).not.toHaveProperty("proposal");
    const old = await (await fetch(`${origin}/api/activities/${f.activity}`, { headers: { Cookie: f.actor.cookie } })).json();
    expect(old.activity).toMatchObject({ rawInput: "Original immutable statistics <script>literal</script>", totalMinutes: 120, effectiveMinutes: 120 }); expect(dispatches).toBe(count);
    expect((await fetch(`${origin}/api/activities/${f.activity}/fact-revisions`, { headers: { Cookie: actors[1].cookie } })).status).toBe(404);
  });
  it("synthetic SDK uses bounded v0.4 temperature0 without cookie/service secrets", async () => {
    const f = await fixture(); await revised(f); const body = aiBodies.at(-1) as { model: string; temperature: number; messages: unknown[] };
    expect(body.model).toBe("synthetic-facts-only"); expect(body.temperature).toBe(0); expect(Buffer.byteLength(JSON.stringify(body.messages))).toBeLessThanOrEqual(131072);
    const text = JSON.stringify(body); expect(text).toContain("user_claim"); expect(text).toContain("activity-evaluator-v0.4-facts");
    expect(text).not.toContain(f.actor.cookie); expect(text).not.toContain(process.env.SUPABASE_SECRET_KEY!);
  });
  it("old proposal cannot Confirm; new revision Confirm writes exactly one audited XP row", async () => {
    const f = await fixture(), { data } = await revised(f), count = dispatches, resultId = data.request.completion.assessment.id;
    const confirm = (id: string) => fetch(`${origin}/api/assessments/${id}/confirm`, { method: "POST", headers: { Cookie: f.actor.cookie, "Content-Type": "application/json" }, body: "{}" });
    expect((await confirm(f.assessment)).status).toBe(409); expect(await snapshot()).toEqual(expected);
    const response = await confirm(resultId); expect(response.status).toBe(200);
    const rows = (await pg.query("select * from xp_transactions where activity_id=$1", [f.activity])).rows;
    expect(rows).toHaveLength(1); expect(rows[0].assessment_id).toBe(resultId); expect(Number(rows[0].amount)).toBeGreaterThan(0);
    expect(rows[0].modifier_json).toMatchObject({ factRevisionId: data.request.completion.revisionId, factEffectiveMinutes: 35 });
    expect(rows[0].reason).toBe("Original immutable statistics <script>literal</script>");
    const after = await snapshot(), added = Number(rows[0].amount);
    expect(after.skills.find(row => row.id === f.actor.skill)).toMatchObject({ xp: 500 + added, level: playerLevelFromXp(500 + added) });
    expect(after.player_states.find(row => row.user_id === f.actor.id)).toMatchObject({ total_xp: 500 + added, player_level: playerLevelFromXp(500 + added) });
    for (const who of actors.slice(1)) for (const table of tables) expect(after[table].filter(row => row.user_id === who.id)).toEqual(expected[table].filter(row => row.user_id === who.id));
    // Existing settle_activity has always emitted one Evidence record at Confirm.
    // Re-evaluation itself remains covered by the strict no-Core-change snapshot.
    const newEvidence = after.evidence_records.filter(row => !expected.evidence_records.some(old => old.id === row.id));
    expect(newEvidence).toHaveLength(1);
    expect(newEvidence[0]).toMatchObject({ user_id: f.actor.id, activity_id: f.activity, skill_id: f.actor.skill,
      evidence_level: 0, evidence_type: "learning", description: "self-report only", verified: true });
    expect(after.evidence_records.filter(row => row.id !== newEvidence[0].id)).toEqual(expected.evidence_records);
    for (const table of tables.filter(name => !["ai_assessments", "activities", "skills", "player_states", "xp_transactions", "evidence_records"].includes(name))) expect(after[table], table).toEqual(expected[table]);
    expect(after.activities.find(row => row.id === f.activity)).toMatchObject({ raw_input: "Original immutable statistics <script>literal</script>", total_minutes: 120, effective_minutes: 120, status: "confirmed" });
    expected = after;
    expect((await confirm(resultId)).status).toBe(409); expect((await pg.query("select count(*)::int n from xp_transactions where activity_id=$1", [f.activity])).rows[0].n).toBe(1);
    expect(dispatches).toBe(count);
    const history = await (await fetch(`${origin}/api/activities/${f.activity}/fact-revisions`, { headers: { Cookie: f.actor.cookie } })).json();
    expect(history.items[0]).toMatchObject({ assessmentStatus: "confirmed", facts: { effectiveMinutes: 35 } });
  });
  it("unsupported method405 does not pretend authenticated business handling", async () => { const f = await fixture(); expect((await call(f, "PATCH", undefined, "", null)).status).toBe(405); });
});
