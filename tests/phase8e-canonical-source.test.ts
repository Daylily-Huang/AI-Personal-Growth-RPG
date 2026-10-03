import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { RewardResult } from "@/lib/reward/types";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
const migration = readFileSync("supabase/migrations/0050_phase8e_reward_canonical_source_fix.sql", "utf8");
const oldGrant = readFileSync("supabase/migrations/0049_phase8e_reward_wishes_rpc_authority.sql", "utf8")
  .match(/CREATE OR REPLACE FUNCTION public\.rpc_grant_reward_credit\([\s\S]*?\$\$;/)![0];

describe.skipIf(!databaseUrl)("Phase 8E corrective canonical source identity", () => {
  const pg = new Client({ connectionString: databaseUrl });
  let user: string;
  beforeAll(async () => { await pg.connect(); });
  beforeEach(async () => {
    await pg.query("begin");
    user = randomUUID();
    await pg.query("insert into auth.users(id,email) values($1,$2)", [user, `canonical-${user}@example.test`]);
  });
  afterEach(async () => { await pg.query("rollback"); });
  afterAll(async () => { await pg.end(); });

  async function source(type: string) {
    const id = `a${randomUUID().slice(1)}`;
    if (type === "QUEST") {
      await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'canonical','skill','major','completed')", [id, user]);
      return id;
    }
    if (type === "SEASON") {
      await pg.query("insert into seasons(id,user_id,name,status,started_at,ended_at) values($1,$2,'canonical','COMPLETED',now()-interval '10 days',now())", [id, user]);
      await pg.query(`insert into season_reviews(user_id,season_id,review_type,version,commit_key,period_start,period_end,objective_summary,qualitative_reflection,criteria_evaluation)
        values($1,$2,'FINAL',1,gen_random_uuid(),now()-interval '10 days',now(),'{}','verified','{}')`, [user, id]);
      return id;
    }
    const domain = randomUUID();
    await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'canonical',$3)", [domain, user, domain]);
    await pg.query("insert into skills(id,user_id,domain_id,name) values($1,$2,$3,'canonical')", [id, user, domain]);
    await pg.query(`insert into mastery_verifications(user_id,skill_id,skill_name,from_level,to_level,evidence_level,status,resolved_at)
      values($1,$2,'canonical',5,6,4,'verified',now())`, [user, id]);
    return `${id}:M6`;
  }
  async function grant(type: string, id: string, key: string): Promise<RewardResult> {
    await pg.query("savepoint rpc_call");
    try {
      await pg.query("set local role authenticated");
      await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
      const { rows } = await pg.query("select rpc_grant_reward_credit($1,$2,'reward-v1',$3) as result", [type, id, key]);
      await pg.query("reset role"); await pg.query("release savepoint rpc_call");
      return rows[0].result;
    } catch (error) {
      await pg.query("rollback to savepoint rpc_call"); await pg.query("reset role");
      await pg.query("release savepoint rpc_call"); throw error;
    }
  }
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of ["reward_accounts", "reward_transactions", "outer_loop_audit_events"]) {
      result[table] = (await pg.query(`select to_jsonb(t) as row from ${table} t where user_id=$1 order by to_jsonb(t)::text`, [user])).rows;
    }
    return result;
  }
  test.each(["SEASON", "QUEST", "MASTERY"])("%s aliases share first mint, replay fingerprint and unique ledger identity", async type => {
    const id = await source(type);
    const first = await grant(type, id.toUpperCase(), "same-semantic-request");
    expect(first.transaction!.canonical_source_id).toBe(id);
    expect(first.transaction!.amount).toBe(type === "SEASON" ? 150 : 100);
    const settled = await snapshot();
    const variants = type === "MASTERY" ? [id, id.toUpperCase()] : [id, id.toUpperCase(), id.replaceAll("-", ""), `{${id.toUpperCase()}}`];
    for (const variant of variants) {
      expect(await grant(type, variant, "same-semantic-request")).toEqual({ ...first, replayed: true });
      await expect(grant(type, variant, randomUUID())).rejects.toMatchObject({ code: "23505", message: "REWARD_SOURCE_ALREADY_GRANTED" });
      expect(await snapshot()).toEqual(settled);
    }
    // Input normalization must not change key conflict precedence for a malformed new target.
    await expect(grant(type, "invalid-source", "same-semantic-request")).rejects.toMatchObject({ code: "23505", message: "IDEMPOTENCY_KEY_REUSED" });
    expect(await snapshot()).toEqual(settled);
  });

  test("normalized uniqueness protects equivalent EARN even outside the RPC", async () => {
    // Isolate index enforcement from the additional canonical-format CHECK.
    // This DDL and every fixture are rolled back by afterEach.
    await pg.query("alter table reward_transactions drop constraint if exists ck_reward_tx_canonical_earn_source");
    const id = await source("QUEST");
    await grant("QUEST", id, "first");
    await pg.query("savepoint index_probe");
    await expect(pg.query(`insert into reward_transactions(account_id,user_id,event_kind,amount,canonical_source_type,canonical_source_id,policy_version,request_idempotency_key)
      select account_id,user_id,event_kind,amount,canonical_source_type,upper(canonical_source_id),policy_version,'alias'
      from reward_transactions where user_id=$1`, [user])).rejects.toMatchObject({ code: "23505", constraint: "uq_reward_tx_normalized_source" });
    await pg.query("rollback to savepoint index_probe");
    expect((await pg.query("select count(*)::int as n from reward_transactions where user_id=$1", [user])).rows[0].n).toBe(1);
  });

  test("migration refuses legacy aliases without rewriting immutable history", async () => {
    // Model the pre-0050 schema only inside this rollback-only transaction.
    await pg.query("alter table reward_transactions drop constraint if exists ck_reward_tx_canonical_earn_source");
    const id = await source("QUEST");
    const account = randomUUID();
    await pg.query("insert into reward_accounts(id,user_id) values($1,$2)", [account, user]);
    await pg.query(`insert into reward_transactions(account_id,user_id,event_kind,amount,canonical_source_type,canonical_source_id,policy_version,request_idempotency_key)
      values($1,$2,'EARN',100,'QUEST',$3,'reward-v1','legacy-alias')`, [account, user, id.toUpperCase()]);
    const before = await snapshot();
    await pg.query("savepoint migration_probe");
    await expect(pg.query(migration)).rejects.toMatchObject({ code: "23514", message: "NONCANONICAL_REWARD_HISTORY_REQUIRES_REVIEW" });
    await pg.query("rollback to savepoint migration_probe");
    expect(await snapshot()).toEqual(before);
  });

  test("a stale 0049 grant body cannot write the first noncanonical EARN or audit", async () => {
    const id = await source("QUEST");
    // Execute the exact historical body, not a simplified insert. This models
    // a call already holding the old function body across a migration boundary.
    // Replacement is transaction-local and restored on rollback, never committed.
    await pg.query(oldGrant);
    const before = await snapshot();
    await expect(grant("QUEST", id.toUpperCase(), "stale-call")).rejects.toMatchObject({
      code: "23514", constraint: "ck_reward_tx_canonical_earn_source",
    });
    expect(await snapshot()).toEqual(before);
    // Rejection must not consume the key or leave an account/audit behind.
    const first = await grant("QUEST", id, "stale-call");
    expect(first.transaction).toMatchObject({ canonical_source_id: id, amount: 100 });
  });

  test("normalization helper is immutable and private; grant remains authenticated-only", async () => {
    const { rows } = await pg.query(`select
      (select provolatile from pg_proc where oid='public.phase8e_canonical_reward_source_id(text,text)'::regprocedure) as volatility,
      has_function_privilege('anon','public.phase8e_canonical_reward_source_id(text,text)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.phase8e_canonical_reward_source_id(text,text)','EXECUTE') as authenticated,
      has_function_privilege('service_role','public.phase8e_canonical_reward_source_id(text,text)','EXECUTE') as service_role`);
    expect(rows[0]).toEqual({ volatility: "i", anon: false, authenticated: false, service_role: false });
  });
});
