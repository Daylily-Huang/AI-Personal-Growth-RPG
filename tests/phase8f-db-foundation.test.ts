import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
const migration = readFileSync("supabase/migrations/0051_phase8f_milestones_foundation.sql", "utf8");
type Fields = Record<string, unknown>;

test("8F foundation adds one table and no public RPC or frozen-table mutations", () => {
  expect(migration.match(/CREATE TABLE /g)).toHaveLength(1);
  expect(migration).not.toMatch(/CREATE (?:OR REPLACE )?FUNCTION public\.rpc_/i);
  expect(migration).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE) public\.(?:quests|skills|seasons|xp_transactions|reward_transactions|reward_accounts|mastery_events|evidence_records)\b/i);
  expect(migration).not.toContain("SECURITY DEFINER\n");
});

describe.skipIf(!databaseUrl)("Phase 8F Round 1 — rollback-only milestone foundation", () => {
  const pg = new Client({ connectionString: databaseUrl });
  let installed: boolean;
  let user: string;
  let other: string;
  let quest: string;
  let skill: string;
  let season: string;
  let foreignQuest: string;
  let coreBefore: Record<string, unknown>;

  async function snapshotCore() {
    const snapshot: Record<string, unknown> = {};
    for (const table of ["player_states", "quests", "skills", "activities", "xp_transactions",
      "mastery_events", "mastery_verifications", "evidence_records", "knowledge_nodes", "artifacts",
      "seasons", "season_reviews"]) {
      snapshot[table] = (await pg.query(`select to_jsonb(t) as row from public.${table} t
        where user_id = any($1::uuid[]) order by to_jsonb(t)::text`, [[user, other]])).rows;
    }
    return snapshot;
  }
  async function insert(fields: Fields = {}) {
    const values: Fields = {
      user_id: user, milestone_key: "foundation", title: "Recognition fixture", description: null,
      recognition_class: "USER_CONFIRMED_REAL_WORLD", source_type: "EXTERNAL_CREDENTIAL",
      source_id: randomUUID(), confirmation_request_idempotency_key: randomUUID(), ...fields,
    };
    const keys = Object.keys(values);
    return (await pg.query(`insert into public.milestones (${keys.join(",")})
      values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`, Object.values(values))).rows[0];
  }
  async function update(id: string, fields: Fields) {
    return pg.query(`update public.milestones set ${Object.keys(fields).map((key, i) => `${key}=$${i + 2}`).join(",")}
      where id=$1 returning *`, [id, ...Object.values(fields)]);
  }
  async function reject(run: () => Promise<unknown>, code: string) {
    await pg.query("savepoint expected_denial");
    let error: unknown;
    try { await run(); } catch (caught) { error = caught; }
    await pg.query("rollback to savepoint expected_denial");
    await pg.query("release savepoint expected_denial");
    expect(error).toMatchObject({ code });
  }
  async function role(name: "anon" | "authenticated" | "service_role", id = user) {
    await pg.query(`set local role ${name}`);
    await pg.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    expect((await pg.query("select current_user as role, auth.uid() as uid")).rows[0]).toEqual({ role: name, uid: id });
  }
  async function revoke(id: string, fields: Fields = {}) {
    return update(id, { status: "REVOKED", revoked_at: new Date(), revocation_reason: "Withdraw recognition",
      revocation_request_idempotency_key: randomUUID(), ...fields });
  }
  async function earn(fields: Fields = {}) {
    const owner = fields.user_id ?? user;
    const account = (await pg.query(`insert into reward_accounts(user_id) values($1)
      on conflict(user_id) do update set user_id=excluded.user_id returning id`, [owner])).rows[0].id;
    const values: Fields = { user_id: owner, account_id: account, event_kind: "EARN", amount: 150,
      canonical_source_type: "QUEST", canonical_source_id: quest, policy_version: "reward-v1",
      request_idempotency_key: randomUUID(), ...fields };
    return (await pg.query(`insert into reward_transactions(${Object.keys(values).join(",")})
      values(${Object.keys(values).map((_, i) => `$${i + 1}`).join(",")}) returning *`, Object.values(values))).rows[0];
  }
  async function settle(id: string, rewardId: string) {
    return update(id, { granted_reward_credit: true, reward_transaction_id: rewardId });
  }

  beforeAll(async () => {
    await pg.connect();
    installed = (await pg.query("select to_regclass('public.milestones') is not null as installed")).rows[0].installed;
  });
  beforeEach(async () => {
    await pg.query("begin");
    // Existing local data is not reset. On a pre-0051 DB even the DDL rolls back;
    // CI already applies the full chain and exercises its installed table.
    if (!installed) await pg.query(migration);
    user = randomUUID(); other = randomUUID(); quest = randomUUID(); skill = randomUUID();
    season = randomUUID(); foreignQuest = randomUUID();
    await pg.query("insert into auth.users(id,email) values($1,$2),($3,$4)",
      [user, `8f-${user}@example.test`, other, `8f-${other}@example.test`]);
    await pg.query(`insert into quests(id,user_id,title,quest_type,quest_size,status)
      values($1,$2,'Owned fixture','skill','epic','completed'),($3,$4,'Foreign fixture','skill','epic','completed')`,
    [quest, user, foreignQuest, other]);
    const domain = randomUUID();
    await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'8F fixture',$3)", [domain, user, domain]);
    await pg.query("insert into skills(id,user_id,domain_id,name) values($1,$2,$3,'8F fixture')", [skill, user, domain]);
    await pg.query("insert into seasons(id,user_id,name) values($1,$2,'8F fixture')", [season, user]);
    coreBefore = await snapshotCore();
  });
  afterEach(async () => {
    try { await pg.query("reset role"); expect(await snapshotCore()).toEqual(coreBefore); }
    finally { await pg.query("rollback"); }
  });
  afterAll(async () => { await pg.end(); });

  test("RLS, least privileges, private helper and restrictive reward FK are installed", async () => {
    expect((await pg.query("select relrowsecurity from pg_class where oid='milestones'::regclass")).rows[0].relrowsecurity).toBe(true);
    expect((await pg.query("select cmd, roles::text[] as roles from pg_policies where schemaname='public' and tablename='milestones'")).rows)
      .toEqual([{ cmd: "SELECT", roles: ["authenticated"] }]);
    for (const appRole of ["anon", "authenticated", "service_role"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        expect((await pg.query("select has_table_privilege($1,'public.milestones',$2) as allowed", [appRole, privilege])).rows[0].allowed)
          .toBe(appRole === "authenticated" && privilege === "SELECT");
      }
      expect((await pg.query("select has_function_privilege($1,'trg_enforce_milestone_authority()','EXECUTE') as allowed", [appRole])).rows[0].allowed).toBe(false);
    }
    expect((await pg.query(`select confdeltype from pg_constraint where conrelid='milestones'::regclass
      and confrelid='reward_transactions'::regclass`)).rows).toEqual([{ confdeltype: "r" }]);
  });

  test("owner SELECT cannot see foreign rows and anon/service-role cannot SELECT", async () => {
    const a = await insert(); await insert({ user_id: other });
    await role("authenticated");
    expect((await pg.query("select id from milestones order by id")).rows).toEqual([{ id: a.id }]);
    await pg.query("reset role");
    for (const appRole of ["anon", "service_role"] as const) {
      await role(appRole);
      await reject(() => pg.query("select * from milestones"), "42501");
      await pg.query("reset role");
    }
  });

  test.each(["anon", "authenticated", "service_role"] as const)("%s direct INSERT/UPDATE/DELETE/TRUNCATE denied", async appRole => {
    const row = await insert();
    await role(appRole);
    await reject(() => insert(), "42501");
    await reject(() => update(row.id, { title: "forged" }), "42501");
    await reject(() => pg.query("delete from milestones where id=$1", [row.id]), "42501");
    await reject(() => pg.query("truncate milestones"), "42501");
    await pg.query("reset role");
  });

  test("BYPASSRLS service-role still cannot write even after accidental table grants", async () => {
    const row = await insert();
    await pg.query("grant select,insert,update,delete on milestones to service_role");
    await role("service_role");
    await pg.query("select set_config('app.milestone_authority','true',true)");
    await reject(() => insert(), "42501");
    await reject(() => update(row.id, { status: "REVOKED" }), "42501");
    await reject(() => pg.query("delete from milestones where id=$1", [row.id]), "42501");
    await pg.query("reset role");
  });

  test.each(["QUEST", "SEASON", "MASTERY"])("%s insert checks source owner and existence", async source_type => {
    const source_id = source_type === "QUEST" ? quest : source_type === "SEASON" ? season : `${skill}:M6`;
    await insert({ recognition_class: "CORE_VERIFIED", source_type, source_id });
    await reject(() => insert({ user_id: other, recognition_class: "CORE_VERIFIED", source_type, source_id }), "23514");
    await reject(() => insert({ recognition_class: "CORE_VERIFIED", source_type,
      source_id: source_type === "MASTERY" ? `${randomUUID()}:M6` : randomUUID() }), "23514");
  });

  test.each(["ARTIFACT", "LOGIN_STREAK", "TIME", "JOURNAL", "QUEST"])("real-world class rejects %s source", async source_type => {
    await reject(() => insert({ source_type, source_id: quest }), "23514");
  });
  test("Core class excludes external credentials and Artifact; null class/source rejected", async () => {
    for (const source_type of ["EXTERNAL_CREDENTIAL", "ARTIFACT"]) {
      await reject(() => insert({ recognition_class: "CORE_VERIFIED", source_type }), "23514");
    }
    for (const field of ["source_id", "source_type", "recognition_class"]) await reject(() => insert({ [field]: null }), "23502");
  });
  test.each(["", "broken", "{a1111111-aaaa-4000-8000-000000000001}", "A1111111-AAAA-4000-8000-000000000001",
    "a1111111aaaa40008000000000000001", " a1111111-aaaa-4000-8000-000000000001", "a1111111-aaaa-4000-8000-000000000001\n"])("rejects malformed/noncanonical UUID %j", async source_id => {
    await reject(() => insert({ source_id }), "23514");
  });
  test.each(["M5", "M7", "M9", "M06", "m6", "M6:extra", "M6\n"])("rejects malformed Mastery suffix %j", async suffix => {
    await reject(() => insert({ recognition_class: "CORE_VERIFIED", source_type: "MASTERY", source_id: `${skill}:${suffix}` }), "23514");
  });
  test("M6/M8/M10 are distinct canonical identities, each unique across milestone keys", async () => {
    for (const threshold of [6, 8, 10]) {
      const fields = { recognition_class: "CORE_VERIFIED", source_type: "MASTERY", source_id: `${skill}:M${threshold}` };
      await insert(fields);
      await reject(() => insert({ ...fields, milestone_key: "alternate-key" }), "23505");
    }
  });
  test("source and confirmation identities remain unique after revocation", async () => {
    const a = await insert();
    await revoke(a.id);
    await reject(() => insert({ source_id: a.source_id, milestone_key: "alias" }), "23505");
    await reject(() => insert({ confirmation_request_idempotency_key: a.confirmation_request_idempotency_key }), "23505");
    // Same opaque event UUID in another tenant is not the same recognition.
    await insert({ user_id: other, source_id: a.source_id });
    const b = await insert(); const key = randomUUID(); const c = await insert();
    await revoke(b.id, { revocation_request_idempotency_key: key });
    await reject(() => revoke(c.id, { revocation_request_idempotency_key: key }), "23505");
  });
  test.each(["", " ", " key", "key ", "x".repeat(201)])("rejects invalid durable key %j", async key => {
    await reject(() => insert({ confirmation_request_idempotency_key: key }), "23514");
    const row = await insert();
    await reject(() => revoke(row.id, { revocation_request_idempotency_key: key }), "23514");
  });

  test("confirmation pins lifecycle, reward and timestamps; no reward account is created", async () => {
    const row = await insert({ external_evidence_url: "https://example.test/credential", external_credential_id: "DOI-self-attested",
      created_at: "2000-01-01", recognized_at: "2000-01-01", updated_at: "2000-01-01" });
    expect(row).toMatchObject({ status: "ACTIVE", granted_reward_credit: false, reward_transaction_id: null,
      revoked_at: null, revocation_request_idempotency_key: null, revocation_reason: null });
    expect(row.created_at.getUTCFullYear()).toBeGreaterThan(2000);
    expect(row.recognized_at).toEqual(row.created_at); expect(row.updated_at).toEqual(row.created_at);
    for (const fields of [{ status: "REVOKED" }, { granted_reward_credit: true }, { reward_transaction_id: randomUUID() },
      { revoked_at: new Date() }, { revocation_reason: "no" }, { revocation_request_idempotency_key: "no" }]) {
      await reject(() => insert(fields), "23514");
    }
    await revoke(row.id);
    for (const table of ["reward_accounts", "reward_transactions", "outer_loop_audit_events"]) {
      expect((await pg.query(`select count(*)::int as n from ${table} where user_id=$1`, [user])).rows[0].n).toBe(0);
    }
  });
  test.each(["id", "user_id", "milestone_key", "title", "description", "recognition_class", "source_type", "source_id",
    "external_evidence_url", "external_credential_id", "confirmation_request_idempotency_key", "created_at", "recognized_at"])("%s cannot change even under owner authority", async field => {
    const row = await insert();
    const value = field.endsWith("_at") ? new Date("2000-01-01") : ["id", "user_id"].includes(field) ? randomUUID() : "changed";
    await reject(() => update(row.id, { [field]: value }), "42501");
    await reject(() => revoke(row.id, { [field]: value }), "42501");
  });
  test("only settlement and revocation are allowed; revoked history and hard deletion are protected", async () => {
    const row = await insert();
    await reject(() => update(row.id, { updated_at: new Date() }), "42501");
    await reject(() => revoke(row.id, { revocation_reason: " " }), "23514");
    await reject(() => revoke(row.id, { revocation_reason: null }), "23514");
    await reject(() => revoke(row.id, { revoked_at: null }), "23514");
    await reject(() => revoke(row.id, { revocation_request_idempotency_key: null }), "23514");
    await revoke(row.id);
    await reject(() => update(row.id, { status: "ACTIVE" }), "42501");
    await reject(() => revoke(row.id), "42501");
    await reject(() => pg.query("delete from milestones where id=$1", [row.id]), "42501");
    await reject(() => pg.query("delete from auth.users where id=$1", [user]), "42501");
  });

  test("owned exact EARN link settles once and is retained unchanged through revocation", async () => {
    const row = await insert({ recognition_class: "CORE_VERIFIED", source_type: "QUEST", source_id: quest });
    const tx = await earn();
    await settle(row.id, tx.id);
    await reject(() => settle(row.id, tx.id), "42501");
    await reject(() => update(row.id, { granted_reward_credit: false, reward_transaction_id: null }), "42501");
    await reject(() => revoke(row.id, { granted_reward_credit: false, reward_transaction_id: null }), "23514");
    await revoke(row.id);
    expect((await pg.query("select granted_reward_credit,reward_transaction_id,status from milestones where id=$1", [row.id])).rows[0])
      .toEqual({ granted_reward_credit: true, reward_transaction_id: tx.id, status: "REVOKED" });
  });
  test.each(["tenant", "source", "type", "policy", "kind", "missing"])("settlement rejects %s reward-link mismatch", async variant => {
    const row = await insert({ recognition_class: "CORE_VERIFIED", source_type: "QUEST", source_id: quest });
    let tx;
    if (variant === "kind") {
      const original = await earn();
      tx = await earn({ event_kind: "CORRECTION", amount: -original.amount, correction_for_id: original.id });
    } else if (variant === "missing") tx = { id: randomUUID() };
    else tx = await earn(variant === "tenant" ? { user_id: other } : variant === "source" ? { canonical_source_id: foreignQuest }
      : variant === "type" ? { canonical_source_type: "SEASON" } : { policy_version: "reward-v999" });
    await reject(() => settle(row.id, tx.id), "23514");
    expect((await pg.query("select granted_reward_credit,reward_transaction_id from milestones where id=$1", [row.id])).rows[0])
      .toEqual({ granted_reward_credit: false, reward_transaction_id: null });
  });
  test("real-world proof text never permits a funded link", async () => {
    const row = await insert({ external_evidence_url: "https://example.test/verified", external_credential_id: "certificate" });
    const tx = await earn({ canonical_source_type: "EXTERNAL_CREDENTIAL", canonical_source_id: row.source_id });
    await reject(() => settle(row.id, tx.id), "23514");
  });
});
