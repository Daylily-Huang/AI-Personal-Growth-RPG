import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

const url = process.env.XP_RPG_TEST_DB_URL;
const signature = "public.rpc_create_skill_zero_xp(jsonb)";
function disposable() {
  const endpoint = new URL(url!);
  if (!["localhost", "127.0.0.1"].includes(endpoint.hostname)) throw Error("Only local disposable DB fixtures authorized");
  if (process.env.GITHUB_ACTIONS !== "true") {
    const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK;
    if (!project || !/^phase8f_(r3|test)_[a-z0-9_]+$/.test(project) || endpoint.port !== "54332") throw Error("Task-owned disposable stack required");
    expect(execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "com.supabase.cli.project"}}', `supabase_db_${project}`], { encoding: "utf8" }).trim()).toBe(project);
  }
}
describe.skipIf(!url)("zero XP manual skill authority, rollback-only", () => {
  const pg = new Client({ connectionString: url });
  let a: string; let b: string; let oldSkill: string; let tables: string[]; let baseline: Record<string, unknown>;
  let additions: Record<string, unknown>[];
  async function as(id = a, role = "authenticated") {
    await pg.query(`set local role ${role}`); await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  }
  async function snapshot() {
    const s: Record<string, unknown> = {};
    for (const table of tables) s[table] = (await pg.query(`select to_jsonb(t) as r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [[a, b]])).rows.map(x => x.r);
    return s;
  }
  async function create(name: string, owner = a) {
    const row = (await pg.query("select to_jsonb(public.rpc_create_skill_zero_xp($1)) as r", [JSON.stringify({ name })])).rows[0].r;
    expect(row).toMatchObject({ user_id: owner, name: name.trim(), xp: 0, level: 1, mastery_level: 0,
      mastery_confidence: 0, aliases: [], domain_id: null, description: null, last_used_at: null, status: "active" });
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    additions.push(row); return row;
  }
  async function denied(run: () => Promise<unknown>, message: string, code?: string) {
    await pg.query("savepoint denied"); let error: unknown;
    try { await run(); } catch (caught) { error = caught; }
    finally { await pg.query("rollback to savepoint denied"); await pg.query("release savepoint denied"); }
    expect(error).toMatchObject({ message: expect.stringContaining(message), ...(code ? { code } : {}) });
  }
  beforeAll(async () => {
    disposable(); await pg.connect();
    expect((await pg.query("select to_regprocedure($1) is not null as v", [signature])).rows[0].v).toBe(true);
    tables = (await pg.query(`select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      join pg_attribute at on at.attrelid=c.oid where n.nspname='public' and c.relkind='r' and at.attname='user_id' order by c.relname`)).rows.map(x => x.relname);
    expect(tables).toEqual(expect.arrayContaining(["skills", "player_states", "xp_transactions", "evidence_records", "reward_accounts", "reward_transactions", "milestones"]));
    expect(tables.every(t => /^[a-z_]+$/.test(t))).toBe(true);
  });
  beforeEach(async () => {
    await pg.query("begin"); await pg.query("set local lock_timeout='3s'");
    a = randomUUID(); b = randomUUID(); oldSkill = randomUUID(); additions = [];
    await pg.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [a, `${a}@example.test`, b, `${b}@example.test`]);
    for (const [owner, id] of [[a, oldSkill], [b, randomUUID()]]) {
      const domain = randomUUID(), activity = randomUUID(), assessment = randomUUID();
      await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'Existing',$3)", [domain, owner, domain]);
      await pg.query("insert into skills(id,user_id,domain_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,$3,'Existing Core',500,2,8,0.8,'archived')", [id, owner, domain]);
      await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing','Raw provenance','confirmed','skill-bootstrap-fixture')", [activity, owner]);
      await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','skill-bootstrap-fixture','{}')", [assessment, owner, activity]);
      await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,domain_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,$5,500,500,'skill-bootstrap-fixture','Existing Core')", [owner, activity, assessment, domain, id]);
      await pg.query("update player_states set total_xp=500,player_level=2 where user_id=$1", [owner]);
      await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing verified',true)", [owner, activity, id]);
    }
    baseline = await snapshot(); await as();
  });
  afterEach(async () => {
    try {
      await pg.query("reset role"); const after = await snapshot();
      const skills = after.skills as Record<string, unknown>[];
      const added = skills.filter(s => additions.some(x => x.id === s.id));
      expect(added).toHaveLength(additions.length); expect(added).toEqual(expect.arrayContaining(additions));
      after.skills = skills.filter(s => !additions.some(x => x.id === s.id));
      expect(after).toEqual(baseline);
    } finally { await pg.query("rollback"); }
  });
  afterAll(async () => { await pg.end(); });
  test("owned random UUID at exactly zero; no other table mutation", async () => { await create("Molecular Ecology"); });
  test("same label across owners has distinct IDs and SELECT RLS", async () => {
    const first = await create("Molecular Ecology"); await as(b); const second = await create("Molecular Ecology", b);
    expect(second.id).not.toBe(first.id);
    expect((await pg.query("select id from skills where id=any($1::uuid[])", [[first.id, second.id]])).rows).toEqual([{ id: second.id }]);
  });
  test("normalized duplicate never upserts; existing archived/growth unchanged", async () => {
    await denied(() => pg.query("select public.rpc_create_skill_zero_xp($1)", [JSON.stringify({ name: " existing   CORE " })]), "SKILL_ALREADY_EXISTS", "23505");
    const created = await create("Molecular Ecology");
    await denied(() => pg.query("select public.rpc_create_skill_zero_xp($1)", [JSON.stringify({ name: "MOLECULAR\tEcology" })]), "SKILL_ALREADY_EXISTS", "23505");
    expect(created.id).not.toBe(oldSkill);
  });
  test.each([null, [], {}, "name", { name: null }, { name: false }, { name: "" }, { name: " \u000b\ufeff " }, { name: "a".repeat(201) },
    { name: "x", user_id: "foreign" }, { name: "x", id: randomUUID() }, { name: "x", xp: 0 }, { name: "x", mastery_level: 0 },
    { name: "x", domain_id: null }, JSON.parse('{"name":"x","__proto__":{}}')])("SQL independently rejects malformed/extra %j", async payload => {
    await denied(() => pg.query("select public.rpc_create_skill_zero_xp($1)", [JSON.stringify(payload)]), "INVALID_SKILL_INPUT", "22023");
  });
  test("all JS trim codepoints + exactly200 astral Unicode", async () => {
    const trim = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
    expect(Array.from(trim)).toHaveLength(25); await create(`${trim}Molecular Ecology${trim}`); await create("🌱".repeat(200));
    await denied(() => pg.query("select public.rpc_create_skill_zero_xp($1)", [JSON.stringify({ name: "🌱".repeat(201) })]), "INVALID_SKILL_INPUT");
  });
  test("strict grants/owner/search path, unchanged table ACL", async () => {
    await pg.query("reset role");
    const p = (await pg.query("select prosecdef,proconfig,pg_get_userbyid(proowner) as owner from pg_proc where oid=$1::regprocedure", [signature])).rows[0];
    expect(p).toMatchObject({ prosecdef: true, owner: "postgres", proconfig: ["search_path=public, pg_temp"] });
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect((await pg.query("select has_function_privilege($1,$2,'EXECUTE') as v", [role, signature])).rows[0].v).toBe(role === "authenticated");
    }
    for (const role of ["anon", "authenticated"]) for (const permission of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
      expect((await pg.query("select has_table_privilege($1,'public.skills',$2) as v", [role, permission])).rows[0].v).toBe(role === "authenticated" && permission === "SELECT");
    for (const permission of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
      expect((await pg.query("select has_table_privilege('service_role','public.skills',$1) as v", [permission])).rows[0].v).toBe(true);
  });
  test("old metadata RPC still edits archived Core metadata without changing growth", async () => {
    await pg.query("savepoint metadata_compatibility");
    try {
      const row = (await pg.query("select to_jsonb(public.update_skill_metadata($1,$2)) as r", [oldSkill, JSON.stringify({ description: "Controlled metadata still works" })])).rows[0].r;
      expect(row).toMatchObject({ id: oldSkill, description: "Controlled metadata still works", xp: 500, mastery_level: 8, mastery_confidence: 0.8 });
    } finally { await pg.query("rollback to savepoint metadata_compatibility"); await pg.query("release savepoint metadata_compatibility"); }
  });
  test("owned edges INSERT/DELETE still work without table REFERENCES privilege", async () => {
    const source = await create("Source"), target = await create("Target");
    const edge = (await pg.query("insert into skill_edges(user_id,source_skill_id,target_skill_id,relation_type) values($1,$2,$3,'supports') returning id", [a, source.id, target.id])).rows[0].id;
    expect((await pg.query("select id from skill_edges where id=$1", [edge])).rows).toEqual([{ id: edge }]);
    expect((await pg.query("delete from skill_edges where id=$1 returning id", [edge])).rows).toEqual([{ id: edge }]);
  });
  test.each(["anon", "service_role", "postgres"])("broadened EXECUTE plus forged claims/GUC cannot admit %s", async role => {
    await pg.query("reset role"); if (role !== "postgres") await pg.query(`grant execute on function ${signature} to ${role}`);
    await as(a, role);
    await pg.query("select set_config('request.jwt.claim.role','authenticated',true),set_config('app.skill_creation_authorized','true',true)");
    await denied(() => pg.query("select public.rpc_create_skill_zero_xp('{}')"), "UNAUTHORIZED", "42501");
  });
  test("missing UID is denied before validation; direct table writes still denied", async () => {
    await as(""); await denied(() => pg.query("select public.rpc_create_skill_zero_xp('{}')"), "UNAUTHORIZED", "42501");
    await as(); await denied(() => pg.query("insert into skills(user_id,name,xp) values($1,'Forged',500)", [a]), "permission denied", "42501");
  });
});

describe.skipIf(!url)("manual skill committed concurrency (whole owned stack disposal)", () => {
  test("two simultaneous same-normalized-name creates exactly once with no growth", async () => {
    disposable(); const seed = new Client({ connectionString: url }); const x = new Client({ connectionString: url }); const y = new Client({ connectionString: url });
    const id = randomUUID();
    try {
      await Promise.all([seed.connect(), x.connect(), y.connect()]);
      await seed.query("insert into auth.users(id,email) values($1,$2)", [id, `${id}@example.test`]);
      for (const pg of [x, y]) { await pg.query("set role authenticated"); await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); }
      // Attach rejection handlers immediately; no delayed unhandled pg rejection.
      const outcomes = await Promise.allSettled([x.query("select public.rpc_create_skill_zero_xp($1)", [JSON.stringify({ name: "Concurrent Skill" })]),
        y.query("select public.rpc_create_skill_zero_xp($1)", [JSON.stringify({ name: " concurrent   SKILL " })])]);
      expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.find(r => r.status === "rejected")).toMatchObject({ reason: { message: "SKILL_ALREADY_EXISTS", code: "23505" } });
      expect((await seed.query("select xp,level,mastery_level,mastery_confidence from skills where user_id=$1", [id])).rows)
        .toEqual([{ xp: "0", level: 1, mastery_level: 0, mastery_confidence: "0" }]);
      for (const table of ["xp_transactions", "evidence_records", "reward_transactions", "mastery_events", "outer_loop_audit_events"])
        expect((await seed.query(`select count(*)::int as n from public.${table} where user_id=$1`, [id])).rows[0].n).toBe(0);
    } finally { await Promise.all([seed.end(), x.end(), y.end()]); }
  });
});
