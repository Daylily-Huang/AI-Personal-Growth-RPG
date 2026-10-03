import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { foldRewardLedger } from "@/lib/reward/fold";
import type { RewardResult, RewardTransaction } from "@/lib/reward/types";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
const financialTables = ["reward_accounts", "reward_transactions", "reward_redemptions", "wishes"];
const coreTables = ["player_states", "xp_transactions", "skills", "domains", "activities", "ai_assessments", "evidence_records"];

test("O020 catalogue -50 arithmetic remains valid without authorizing a partial-correction RPC", () => {
  expect(foldRewardLedger([
    { event_kind: "EARN", amount: 100 }, { event_kind: "RESERVE", amount: 100 },
    { event_kind: "REDEEM", amount: 100 }, { event_kind: "CORRECTION", amount: -50 },
  ])).toEqual({ lifetime_earned: 100, net_earned: 50, lifetime_redeemed: 100, current_reserved: 0, current_available: 0, correction_deficit: 50 });
});

/** Rollback-only fixture: no persistent users, trigger changes or ledger rewrites. */
describe.skipIf(!databaseUrl)("Phase 8E Round 5 — canonical exit verification", () => {
  let pg: Client;
  let user: string;
  let failure = 0;
  async function snapshot(tables: string[]) {
    const result: Record<string, unknown[]> = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t)::text as row from public.${table} t where user_id=$1 order by to_jsonb(t)::text`, [user])).rows.map(row => row.row);
    return result;
  }
  async function parity() {
    const ledger = await pg.query<RewardTransaction>("select * from reward_transactions where user_id=$1 order by created_at,id", [user]);
    const cache = await pg.query("select to_jsonb(a)-'id'-'user_id'-'updated_at' as state from reward_accounts a where user_id=$1", [user]);
    const sql = await pg.query("select public.phase8e_fold_reward_ledger($1) as state", [user]);
    expect(sql.rows[0].state).toEqual(foldRewardLedger(ledger.rows));
    if (cache.rowCount) expect(cache.rows[0].state).toEqual(sql.rows[0].state);
    else expect(ledger.rows).toEqual([]);
    return sql.rows[0].state;
  }
  async function asUser(sql: string, args: unknown[] = []) {
    await pg.query("set local role authenticated");
    await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    const result = await pg.query(sql, args);
    await pg.query("reset role");
    return result;
  }
  async function invoke(name: string, args: unknown[]): Promise<RewardResult> {
    const result = await asUser(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args);
    await parity();
    return result.rows[0].result;
  }
  async function mustFail(run: () => Promise<unknown>, code: string, message?: string) {
    const savepoint = `exit_failure_${++failure}`;
    await pg.query(`savepoint ${savepoint}`);
    let caught: unknown;
    try { await run(); } catch (error) { caught = error; }
    await pg.query(`rollback to savepoint ${savepoint}`);
    await pg.query(`release savepoint ${savepoint}`);
    await pg.query("reset role");
    expect(caught).toMatchObject({ code, ...(message ? { message } : {}) });
  }
  async function quest(size = "major", boss = false) {
    const id = randomUUID();
    await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status,is_boss,completed_at) values($1,$2,'Exit verified source','skill',$3,'completed',$4,clock_timestamp())", [id, user, size, boss]);
    return id;
  }
  async function earn(source?: string, key = randomUUID()) {
    return invoke("rpc_grant_reward_credit", ["QUEST", source ?? await quest(), "reward-v1", key]);
  }
  async function wish(cost: number) {
    const result = await asUser("insert into wishes(user_id,title,credit_cost) values($1,'Exit wish',$2) returning id", [user, cost]);
    return result.rows[0].id as string;
  }
  async function prepare(id: string) {
    for (const name of ["rpc_activate_wish", "rpc_set_primary_wish", "rpc_reserve_wish_credits"]) await invoke(name, [id, randomUUID()]);
  }
  beforeAll(async () => { pg = new Client({ connectionString: databaseUrl }); await pg.connect(); });
  beforeEach(async () => {
    user = randomUUID(); failure = 0;
    await pg.query("begin");
    await pg.query("insert into auth.users(id,email) values($1,$2)", [user, `phase8e-exit-${user}@example.test`]);
    const domain = randomUUID(), skill = randomUUID(), activity = randomUUID(), assessment = randomUUID();
    await pg.query("insert into domains(id,user_id,name,slug) values($1::uuid,$2,'Exit domain',$3)", [domain, user, domain]);
    await pg.query("insert into skills(id,user_id,domain_id,name,xp,mastery_level) values($1,$2,$3,'Exit skill',500,3)", [skill, user, domain]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing growth','Verified fixture','confirmed','exit-fixture')", [activity, user]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,rules_version,status,assessment_json) values($1,$2,$3,'exit-fixture','confirmed','{}')", [assessment, user, activity]);
    await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,domain_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,$5,500,500,'exit-fixture','Exit skill')", [user, activity, assessment, domain, skill]);
    await pg.query("insert into player_states(user_id,total_xp) values($1,500) on conflict(user_id) do update set total_xp=excluded.total_xp", [user]);
    await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Unchanged existing evidence',true)", [user, activity, skill]);
  });
  afterEach(async () => { await pg.query("rollback"); await pg.query("reset role"); });
  afterAll(async () => { if (pg) await pg.end(); });

  test("O001_XP_NEVER_SPENDABLE: 500 XP and all existing Core rows survive every financial event", async () => {
    const before = await snapshot(coreTables);
    expect((await pg.query("select sum(amount)::int as xp from xp_transactions where user_id=$1", [user])).rows[0].xp).toBe(500);
    const grant = await earn(await quest("major", true));
    expect(grant.transaction!.amount).toBe(200); expect(await snapshot(coreTables)).toEqual(before);
    const id = await wish(200);
    for (const name of ["rpc_activate_wish", "rpc_set_primary_wish", "rpc_reserve_wish_credits", "rpc_unreserve_wish_credits", "rpc_reserve_wish_credits"]) {
      await invoke(name, [id, randomUUID()]); expect(await snapshot(coreTables)).toEqual(before);
    }
    const redeemed = await invoke("rpc_redeem_wish", [id, "No XP spend", randomUUID()]); expect(await snapshot(coreTables)).toEqual(before);
    await invoke("rpc_correct_reward_transaction", [grant.transaction!.id, "Correct reward only", randomUUID()]); expect(await snapshot(coreTables)).toEqual(before);
    await invoke("rpc_refund_wish_redemption", [redeemed.redemption!.id, "Refund reward only", randomUUID()]); expect(await snapshot(coreTables)).toEqual(before);
    expect((await pg.query("select total_xp::int as xp from player_states where user_id=$1", [user])).rows[0].xp).toBe(500);
    expect((await pg.query("select xp::int as xp from skills where user_id=$1", [user])).rows[0].xp).toBe(500);
  });

  test("O002_REWARD_LEDGER_ISOLATED: no foreign key connects either direction to XP tables", async () => {
    const edges = await pg.query(`select c.conname from pg_constraint c
      join pg_class src on src.oid=c.conrelid join pg_class dst on dst.oid=c.confrelid
      join pg_namespace ns on ns.oid=src.relnamespace join pg_namespace nd on nd.oid=dst.relnamespace
      where c.contype='f' and ns.nspname='public' and nd.nspname='public' and
      (((src.relname ~ '^reward_' or src.relname='wishes') and dst.relname ~ '^xp_') or
       ((dst.relname ~ '^reward_' or dst.relname='wishes') and src.relname ~ '^xp_'))`);
    expect(edges.rows).toEqual([]);
    const tables = await pg.query("select relname,relrowsecurity from pg_class where oid=any($1::regclass[]) order by relname", [financialTables.map(t => `public.${t}`)]);
    expect(tables.rows).toHaveLength(4); expect(tables.rows.every(t => t.relrowsecurity)).toBe(true);
  });

  test("O003_MICRO_TASK_FARMING_BLOCKED: rejected sources create only one replayable audit each", async () => {
    const before = await snapshot(financialTables);
    for (const type of ["MICRO_ACTIVITY", "DAILY_LOGIN", "HABIT_CHECKIN", "JOURNAL", "FOCUS_TIME", "STREAK", "SELF_ATTESTED", "ARTIFACT", "REAL_WORLD_VERIFIED"]) {
      const key = randomUUID();
      const first = await invoke("rpc_grant_reward_credit", [type, "not-a-verified-source", "reward-v1", key]);
      expect(first).toMatchObject({ ok: false, replayed: false, error_code: ["ARTIFACT", "REAL_WORLD_VERIFIED"].includes(type) ? "SOURCE_CLASS_NOT_YET_AVAILABLE" : "FARMING_SOURCE_REJECTED" });
      const audit = await snapshot(["outer_loop_audit_events"]);
      expect(await invoke("rpc_grant_reward_credit", [type, "not-a-verified-source", "reward-v1", key])).toEqual({ ...first, replayed: true });
      expect(await snapshot(["outer_loop_audit_events"])).toEqual(audit);
      expect(await snapshot(financialTables)).toEqual(before);
    }
    expect((await snapshot(["outer_loop_audit_events"])).outer_loop_audit_events).toHaveLength(9);
  });

  test("O004_DUPLICATE_REWARD_BLOCKED: key replay and equivalent source identity cannot mint twice", async () => {
    const source = await quest(), key = randomUUID(); const first = await earn(source, key);
    const settled = await snapshot([...financialTables, "outer_loop_audit_events"]);
    expect(await earn(source.toUpperCase(), key)).toEqual({ ...first, replayed: true });
    await mustFail(() => earn(source.toUpperCase()), "23505", "REWARD_SOURCE_ALREADY_GRANTED");
    expect(await snapshot([...financialTables, "outer_loop_audit_events"])).toEqual(settled);
    expect(await parity()).toMatchObject({ lifetime_earned: 100, current_available: 100 });
  });

  test("O005_REWARD_REVERSAL_IS_CORRECTION: full EARN reversal is appended once and original bytes remain", async () => {
    const grant = await earn(); const id = grant.transaction!.id;
    const original = (await pg.query("select to_jsonb(t)::text as row from reward_transactions t where id=$1", [id])).rows[0].row;
    const key = randomUUID(); const corrected = await invoke("rpc_correct_reward_transaction", [id, "Primitive; milestone integration remains Phase 8F", key]);
    expect(corrected.transaction).toMatchObject({ event_kind: "CORRECTION", amount: -100, correction_for_id: id });
    const after = await snapshot([...financialTables, "outer_loop_audit_events"]);
    expect(await invoke("rpc_correct_reward_transaction", [id, "Primitive; milestone integration remains Phase 8F", key])).toEqual({ ...corrected, replayed: true });
    await mustFail(() => invoke("rpc_correct_reward_transaction", [id, "Duplicate correction", randomUUID()]), "23505", "REWARD_TRANSACTION_ALREADY_CORRECTED");
    await mustFail(() => asUser("update reward_transactions set amount=1 where id=$1", [id]), "42501");
    await mustFail(() => asUser("delete from reward_transactions where id=$1", [id]), "42501");
    expect(await snapshot([...financialTables, "outer_loop_audit_events"])).toEqual(after);
    expect(after.reward_transactions).toHaveLength(2);
    expect((await pg.query("select to_jsonb(t)::text as row from reward_transactions t where id=$1", [id])).rows[0].row).toBe(original);
  });

  test("O020_REWARD_CORRECTION_PRESERVES_LEDGER_HISTORY: deficit absorbs future earning without rewriting redemption", async () => {
    const grant = await earn(); const id = await wish(100); await prepare(id);
    const redeemed = await invoke("rpc_redeem_wish", [id, "Immutable receipt", randomUUID()]);
    const receipt = await snapshot(["reward_redemptions", "wishes"]);
    await invoke("rpc_correct_reward_transaction", [grant.transaction!.id, "Exact v1 full reversal", randomUUID()]);
    expect(await parity()).toMatchObject({ net_earned: 0, lifetime_redeemed: 100, current_available: 0, correction_deficit: 100 });
    expect(await snapshot(["reward_redemptions", "wishes"])).toEqual(receipt);
    await earn();
    expect(await parity()).toMatchObject({ net_earned: 100, current_available: 0, correction_deficit: 0 });
    expect(await snapshot(["reward_redemptions", "wishes"])).toEqual(receipt);
    await invoke("rpc_refund_wish_redemption", [redeemed.redemption!.id, "Original receipt is retained", randomUUID()]);
    expect(await parity()).toMatchObject({ current_available: 100, lifetime_redeemed: 0 });
    expect(await snapshot(["reward_redemptions", "wishes"])).toEqual(receipt);
    const nextWish = await wish(50);
    await invoke("rpc_activate_wish", [nextWish, randomUUID()]); await invoke("rpc_set_primary_wish", [nextWish, randomUUID()]);
    const before = await snapshot([...financialTables, "outer_loop_audit_events"]);
    await mustFail(() => invoke("rpc_reserve_wish_credits", [nextWish, randomUUID()]), "23514", "REDEMPTION_COOLDOWN_ACTIVE");
    expect(await snapshot([...financialTables, "outer_loop_audit_events"])).toEqual(before);
  });
});
