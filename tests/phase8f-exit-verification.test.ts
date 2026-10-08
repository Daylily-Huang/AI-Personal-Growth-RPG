import { randomUUID } from "node:crypto";
import { Client, type QueryResult } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { foldRewardLedger } from "@/lib/reward/fold";
import type { RewardResult, RewardTransaction } from "@/lib/reward/types";
import type { Milestone, MilestoneProposal, MilestoneResult } from "@/lib/milestone/types";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
const coreTables = ["player_states", "domains", "skills", "activities", "ai_assessments", "xp_transactions",
  "mastery_events", "mastery_verifications", "evidence_records", "knowledge_nodes", "artifacts", "quests", "seasons", "season_reviews"];
const financialTables = ["reward_accounts", "reward_transactions", "reward_redemptions", "wishes"];
const outerTables = [...financialTables, "milestones", "outer_loop_proposals", "outer_loop_audit_events"];
type Payload = Record<string, unknown>;
type Snapshot = Record<string, unknown[]>;
interface Actor { user: string; skill: string; cached: string; epic: string; main: string; boss: string; major: string; incomplete: string; season: string; noFinal: string }
interface ReviewResult { replayed: boolean; proposal: MilestoneProposal; milestone: Milestone | null; result: { milestone_id: string } | null }

/** New fixtures are rollback-only; no migration, trigger disabling, or hard-delete cleanup. */
describe.skipIf(!databaseUrl)("Phase8F Round5 canonical exit verification", () => {
  const pg = new Client({ connectionString: databaseUrl });
  let owner: Actor; let other: Actor; let baseline: Snapshot | undefined;
  let inTransaction = false;
  async function snapshot(tables: string[]): Promise<Snapshot> {
    const rows: Snapshot = {};
    for (const table of tables) rows[table] = (await pg.query(`select to_jsonb(t)::text as row from public.${table} t
      where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [[owner.user, other.user]])).rows.map(r => r.row);
    return rows;
  }
  async function coreUnchanged() {
    expect(baseline).toBeDefined();
    expect(await snapshot(coreTables)).toEqual(baseline);
    for (const actor of [owner, other]) {
      expect((await pg.query("select sum(amount)::int as xp from xp_transactions where user_id=$1", [actor.user])).rows[0].xp).toBe(500);
      expect((await pg.query("select total_xp::int as total_xp from player_states where user_id=$1", [actor.user])).rows[0].total_xp).toBe(500);
      expect((await pg.query("select xp::int as xp from skills where id=$1", [actor.skill])).rows[0].xp).toBe(500);
    }
  }
  async function parity(user = owner.user) {
    const ledger = (await pg.query<RewardTransaction>("select * from reward_transactions where user_id=$1 order by created_at,id", [user])).rows;
    const sql = (await pg.query("select phase8e_fold_reward_ledger($1) as state", [user])).rows[0].state;
    const cache = (await pg.query("select to_jsonb(a)-'id'-'user_id'-'updated_at' as state from reward_accounts a where user_id=$1", [user])).rows;
    expect(sql).toEqual(foldRewardLedger(ledger));
    if (cache.length) { expect(cache).toHaveLength(1); expect(cache[0].state).toEqual(sql); }
    else expect(ledger).toEqual([]);
    return sql;
  }
  async function asActor(sql: string, args: unknown[] = [], actor = owner, role: "authenticated" | "anon" | "service_role" = "authenticated"): Promise<QueryResult> {
    await pg.query(`set local role ${role}`);
    await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [actor.user]);
    const result = await pg.query(sql, args);
    await pg.query("reset role");
    return result;
  }
  async function invoke<T>(name: string, args: unknown[], actor = owner): Promise<T> {
    const result = await asActor(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args, actor);
    await coreUnchanged(); await parity(owner.user); await parity(other.user);
    return result.rows[0].r as T;
  }
  async function denied(run: () => Promise<unknown>, code: string, message?: string) {
    const before = await snapshot(outerTables);
    await pg.query("savepoint expected_denial");
    let caught: unknown;
    try { await run(); } catch (error) { caught = error; }
    await pg.query("rollback to savepoint expected_denial");
    await pg.query("release savepoint expected_denial");
    await pg.query("reset role");
    expect(caught).toMatchObject({ code, ...(message ? { message } : {}) });
    expect(await snapshot(outerTables)).toEqual(before);
    await coreUnchanged(); await parity(owner.user); await parity(other.user);
  }
  function payload(overrides: Payload = {}, actor = owner): Payload {
    return { milestone_key: "exit.achievement", title: "Exit achievement", description: null,
      recognition_class: "CORE_VERIFIED", source_type: "QUEST", source_id: actor.epic,
      external_evidence_url: null, external_credential_id: null, ...overrides };
  }
  function confirm(overrides: Payload = {}, key: string = randomUUID(), actor = owner) {
    const p = payload(overrides, actor);
    return invoke<MilestoneResult>("rpc_confirm_milestone", [p.milestone_key, p.title, p.description, p.recognition_class,
      p.source_type, p.source_id, p.external_evidence_url, p.external_credential_id, key], actor);
  }
  const settle = (id: string, key: string = randomUUID(), actor = owner) => invoke<MilestoneResult>("rpc_settle_milestone_reward", [id, "reward-v1", key], actor);
  const revoke = (id: string, key: string = randomUUID(), actor = owner) => invoke<MilestoneResult>("rpc_revoke_milestone", [id, "Withdraw recognition, preserve history", key], actor);
  const grant = (source: string, key: string = randomUUID()) => invoke<RewardResult>("rpc_grant_reward_credit", ["QUEST", source, "reward-v1", key]);
  const correct = (id: string) => invoke<RewardResult>("rpc_correct_reward_transaction", [id, "Existing correction", randomUUID()]);
  const review = (id: string, decision: string, edited: Payload | null = null, key: string = randomUUID()) =>
    invoke<ReviewResult>("rpc_review_outer_loop_proposal", [id, decision, edited, decision === "REJECTED" ? "Not pursuing" : null, key]);
  async function createProposal(p = payload(), version = 2, expired = false) {
    const id = randomUUID();
    const refs = [{ type: "QUEST", id: owner.epic, context: { text: "原始证据", retained: [1, null, "two"] } }];
    const metadata = JSON.parse('{"model":"fixture-only","prompt_contract":"milestone-v2","temperature":0,"__proto__":{"keep":"原样"}}');
    await pg.query(`insert into outer_loop_proposals(id,user_id,proposal_type,schema_version,payload,source_refs,model_metadata,created_at,expires_at)
      values($1,$2,'MILESTONE_CANDIDATE',$3,$4::jsonb,$5::jsonb,$6::jsonb,clock_timestamp()-interval '2 days',clock_timestamp()+$7::interval)`,
    [id, owner.user, version, JSON.stringify(p), JSON.stringify(refs), JSON.stringify(metadata), expired ? "-1 day" : "1 day"]);
    await coreUnchanged();
    return { id, payload: p, source_refs: refs, model_metadata: metadata };
  }
  async function fixture(): Promise<Actor> {
    const a: Actor = { user: randomUUID(), skill: randomUUID(), cached: randomUUID(), epic: randomUUID(), main: randomUUID(),
      boss: randomUUID(), major: randomUUID(), incomplete: randomUUID(), season: randomUUID(), noFinal: randomUUID() };
    await pg.query("insert into auth.users(id,email) values($1,$2)", [a.user, `phase8f-exit-${a.user}@example.test`]);
    const domain = randomUUID(), activity = randomUUID(), assessment = randomUUID();
    await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'Existing domain',$3)", [domain, a.user, domain]);
    await pg.query(`insert into skills(id,user_id,domain_id,name,xp,mastery_level) values
      ($1,$2,$3,'Verified skill',500,10),($4,$2,$3,'Unverified cached skill',0,10)`, [a.skill, a.user, domain, a.cached]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing activity','Fixture','confirmed','8f-exit')", [activity, a.user]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,rules_version,status,assessment_json) values($1,$2,$3,'8f-exit','confirmed','{}')", [assessment, a.user, activity]);
    await pg.query(`insert into xp_transactions(user_id,activity_id,assessment_id,domain_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot)
      values($1,$2,$3,$4,$5,500,500,'8f-exit','Verified skill')`, [a.user, activity, assessment, domain, a.skill]);
    await pg.query("update player_states set total_xp=500 where user_id=$1", [a.user]);
    await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing evidence',true)", [a.user, activity, a.skill]);
    for (const level of [6, 8, 10]) await pg.query(`insert into mastery_verifications(user_id,skill_id,skill_name,from_level,to_level,evidence_level,status,resolved_at)
      values($1,$2,'Verified skill',$3,$4,6,'verified',clock_timestamp())`, [a.user, a.skill, level - 1, level]);
    for (const [id, size, boss, status] of [[a.epic, "epic", false, "completed"], [a.main, "main", false, "completed"],
      [a.boss, "major", true, "completed"], [a.major, "major", false, "completed"], [a.incomplete, "epic", false, "active"]]) {
      await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,is_boss,status) values($1,$2,'Existing Quest','skill',$3,$4,$5)", [id, a.user, size, boss, status]);
    }
    for (const id of [a.season, a.noFinal]) await pg.query(`insert into seasons(id,user_id,name,status,started_at,ended_at)
      values($1,$2,'Completed Season','COMPLETED',clock_timestamp()-interval '30 days',clock_timestamp())`, [id, a.user]);
    await pg.query(`insert into season_reviews(user_id,season_id,review_type,version,commit_key,period_start,period_end,objective_summary,qualitative_reflection,criteria_evaluation)
      values($1,$2,'FINAL',1,gen_random_uuid(),clock_timestamp()-interval '30 days',clock_timestamp(),'{}','Final review','{}')`, [a.user, a.season]);
    return a;
  }
  beforeAll(async () => {
    await pg.connect();
    expect((await pg.query("select to_regclass('public.milestones') is not null and to_regprocedure('public.rpc_revoke_milestone(uuid,text,text)') is not null as ready")).rows[0].ready).toBe(true);
  });
  beforeEach(async () => {
    baseline = undefined;
    await pg.query("begin"); inTransaction = true;
    await pg.query("set local lock_timeout='3s'; set local statement_timeout='10s'");
    owner = await fixture(); other = await fixture(); baseline = await snapshot(coreTables);
    await coreUnchanged();
  });
  afterEach(async () => {
    try { if (baseline) { await pg.query("reset role"); await coreUnchanged(); } }
    finally { if (inTransaction) { await pg.query("rollback"); inTransaction = false; } }
  });
  afterAll(async () => { await pg.end(); });

  test("frozen reward-v1: all eight amounts, Boss precedence and immutable policy", async () => {
    const cases = [["SEASON", {}, 150], ["QUEST", { quest_size: "major" }, 100], ["QUEST", { quest_size: "epic" }, 150],
      ["QUEST", { quest_size: "main" }, 200], ["QUEST", { quest_size: "epic", is_boss: true }, 200],
      ["MASTERY", { threshold: 6 }, 100], ["MASTERY", { threshold: 8 }, 150], ["MASTERY", { threshold: 10 }, 250]] as const;
    for (const [kind, attributes, amount] of cases) expect((await pg.query("select calculate_reward_grant_v1($1,$2::jsonb) as amount", [kind, JSON.stringify(attributes)])).rows[0].amount).toBe(amount);
    expect((await pg.query("select provolatile from pg_proc where oid='calculate_reward_grant_v1(text,jsonb)'::regprocedure")).rows[0].provolatile).toBe("i");
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t => [t, []])));
  });

  test("O001/O020: spent milestone reversal creates debt, preserves history/500 XP, next EARN absorbs debt", async () => {
    const ck = randomUUID(), sk = randomUUID(), rk = randomUUID();
    const recognized = await confirm({}, ck);
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t => [t, []])));
    const funded = await settle(recognized.milestone.id, sk);
    expect(funded.transaction?.amount).toBe(150);
    const earnBefore = (await pg.query("select to_jsonb(t) as r from reward_transactions t where id=$1", [funded.transaction!.id])).rows[0].r;
    const wish = (await asActor("insert into wishes(user_id,title,credit_cost) values($1,'Celebrate once',150) returning id", [owner.user])).rows[0].id;
    await coreUnchanged();
    for (const name of ["rpc_activate_wish", "rpc_set_primary_wish", "rpc_reserve_wish_credits"]) await invoke<RewardResult>(name, [wish, randomUUID()]);
    await invoke<RewardResult>("rpc_redeem_wish", [wish, "Already celebrated", randomUUID()]);
    const histories = await snapshot(["wishes", "reward_redemptions"]);
    const reversed = await revoke(recognized.milestone.id, rk);
    expect(reversed.correction).toMatchObject({ amount: -150, correction_for_id: funded.transaction!.id });
    expect(await parity()).toMatchObject({ current_available: 0, correction_deficit: 150, lifetime_redeemed: 150 });
    expect(await snapshot(["wishes", "reward_redemptions"])).toEqual(histories);
    expect((await pg.query("select to_jsonb(t) as r from reward_transactions t where id=$1", [funded.transaction!.id])).rows[0].r).toEqual(earnBefore);
    expect((await grant(owner.main)).transaction?.amount).toBe(200);
    expect(await parity()).toMatchObject({ current_available: 50, correction_deficit: 0, lifetime_earned: 350, net_earned: 200 });
    expect(await snapshot(["wishes", "reward_redemptions"])).toEqual(histories);
    const beforeReplay = await snapshot(outerTables);
    expect(await confirm({}, ck)).toEqual({ ...recognized, replayed: true });
    expect(await settle(recognized.milestone.id, sk)).toEqual({ ...funded, replayed: true });
    expect(await revoke(recognized.milestone.id, rk)).toEqual({ ...reversed, replayed: true });
    expect(await snapshot(outerTables)).toEqual(beforeReplay);
  });

  test("O002: live FK graph isolates XP and all seven financial/milestone/proposal tables retain RLS", async () => {
    const edges = await pg.query(`select c.conname from pg_constraint c join pg_class s on s.oid=c.conrelid join pg_class d on d.oid=c.confrelid
      join pg_namespace ns on ns.oid=s.relnamespace join pg_namespace nd on nd.oid=d.relnamespace where c.contype='f' and ns.nspname='public' and nd.nspname='public'
      and ((s.relname=any($1::text[]) and d.relname ~ '^xp_') or (d.relname=any($1::text[]) and s.relname ~ '^xp_'))`, [[...financialTables, "milestones"]]);
    expect(edges.rows).toEqual([]);
    const tables = await pg.query("select relname,relrowsecurity from pg_class where oid=any($1::regclass[])", [outerTables.map(t => `public.${t}`)]);
    expect(tables.rows).toHaveLength(7); expect(tables.rows.every(t => t.relrowsecurity)).toBe(true);
  });

  test.each([false, true])("O004: independent EARN corrected=%s cannot be reattached or reversed by an unfunded wrapper", async alreadyCorrected => {
    const directKey = randomUUID(), confirmationKey = randomUUID();
    const direct = await grant(owner.epic, directKey);
    expect(await grant(owner.epic.toUpperCase(), directKey)).toEqual({ ...direct, replayed: true });
    if (alreadyCorrected) await correct(direct.transaction!.id);
    const recognized = await confirm({}, confirmationKey);
    expect(await confirm({ source_id: `{${owner.epic.toUpperCase()}}` }, confirmationKey)).toEqual({ ...recognized, replayed: true });
    await denied(() => settle(recognized.milestone.id), "23505", "REWARD_ALREADY_MINTED_FOR_SOURCE");
    await denied(() => confirm({ milestone_key: "renamed", source_id: owner.epic.replaceAll("-", "") }), "23505", "MILESTONE_ALREADY_EXISTS");
    const finances = await snapshot(financialTables);
    const revoked = await revoke(recognized.milestone.id);
    expect(revoked.milestone).toMatchObject({ granted_reward_credit: false, reward_transaction_id: null });
    expect(revoked.correction).toBeNull(); expect(await snapshot(financialTables)).toEqual(finances);
    await denied(() => confirm(), "23505", "MILESTONE_ALREADY_EXISTS");
    expect((await pg.query("select count(*)::int as n from reward_transactions where user_id=$1 and event_kind='EARN'", [owner.user])).rows[0].n).toBe(1);
  });

  test.each([false, true])("O005: linked EARN correction reused=%s, exact original provenance and replay retained", async reuse => {
    const recognized = await confirm(), funded = await settle(recognized.milestone.id), key = randomUUID();
    if (reuse) await correct(funded.transaction!.id);
    const finances = await snapshot(financialTables);
    const original = (await pg.query("select to_jsonb(t) as r from reward_transactions t where id=$1", [funded.transaction!.id])).rows[0].r;
    const reversed = await revoke(recognized.milestone.id, key);
    expect(reversed.correction_reused).toBe(reuse);
    expect(reversed.correction).toMatchObject({ event_kind: "CORRECTION", amount: -150, correction_for_id: funded.transaction!.id,
      canonical_source_type: "QUEST", canonical_source_id: owner.epic, policy_version: "reward-v1" });
    for (const field of ["id", "user_id", "milestone_key", "title", "description", "recognition_class", "source_type", "source_id", "external_evidence_url",
      "external_credential_id", "confirmation_request_idempotency_key", "recognized_at", "created_at", "granted_reward_credit", "reward_transaction_id"] as const) {
      expect(reversed.milestone[field]).toEqual(funded.milestone[field]);
    }
    expect((await pg.query("select to_jsonb(t) as r from reward_transactions t where id=$1", [funded.transaction!.id])).rows[0].r).toEqual(original);
    if (reuse) expect(await snapshot(financialTables)).toEqual(finances);
    expect(await revoke(recognized.milestone.id, key)).toEqual({ ...reversed, replayed: true });
    await denied(() => revoke(recognized.milestone.id), "23505", "MILESTONE_ALREADY_REVOKED");
    expect((await pg.query("select count(*)::int as n from reward_transactions where correction_for_id=$1", [funded.transaction!.id])).rows[0].n).toBe(1);
    await denied(() => asActor("delete from milestones where id=$1", [recognized.milestone.id]), "42501");
    await denied(() => asActor("update reward_transactions set note='rewrite' where id=$1", [funded.transaction!.id]), "42501");
  });

  test("O012: qualified Epic/Main/Boss/FINAL Season/exact verified Mastery recognize first and settle separately", async () => {
    const sources = [["QUEST", owner.epic, 150], ["QUEST", owner.main, 200], ["QUEST", owner.boss, 200], ["SEASON", owner.season, 150],
      ["MASTERY", `${owner.skill}:M6`, 100], ["MASTERY", `${owner.skill}:M8`, 150], ["MASTERY", `${owner.skill}:M10`, 250]] as const;
    for (const [source_type, source_id, amount] of sources) {
      const before = await snapshot(financialTables);
      const recognized = await confirm({ source_type, source_id });
      expect(recognized.milestone).toMatchObject({ granted_reward_credit: false, reward_transaction_id: null });
      expect(await snapshot(financialTables)).toEqual(before);
      expect((await settle(recognized.milestone.id)).transaction?.amount).toBe(amount);
    }
  });

  test("O012: ineligible and vanity/Artifact sources fail closed with populated Core unchanged", async () => {
    for (const [source_type, source_id] of [["QUEST", owner.major], ["QUEST", owner.incomplete], ["SEASON", owner.noFinal], ["MASTERY", `${owner.cached}:M6`]]) {
      await denied(() => confirm({ source_type, source_id }), "P0001", "MILESTONE_SOURCE_NOT_ELIGIBLE");
    }
    for (const source_type of ["DAILY_LOGIN", "STREAK", "FOCUS_TIME", "ARTIFACT"]) {
      await denied(() => confirm({ source_type }), "22023", "INVALID_RECOGNITION_SOURCE_CLASS");
    }
    expect(await snapshot(outerTables)).toEqual(Object.fromEntries(outerTables.map(t => [t, []])));
  });

  test("O012: reality proof text is only self-attestation and unfunded revoke never creates an account", async () => {
    const original = payload({ recognition_class: "USER_CONFIRMED_REAL_WORLD", source_type: "EXTERNAL_CREDENTIAL", source_id: randomUUID(),
      external_evidence_url: "http://127.0.0.1/private-proof", external_credential_id: "self-attested-not-verified" });
    const recognized = await confirm(original);
    expect(recognized.milestone).toMatchObject({ recognition_class: "USER_CONFIRMED_REAL_WORLD", granted_reward_credit: false, reward_transaction_id: null });
    await denied(() => settle(recognized.milestone.id), "P0001", "INELIGIBLE_FOR_REWARD");
    expect((await revoke(recognized.milestone.id)).correction).toBeNull();
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t => [t, []])));
  });

  test("O018: owner positive controls, cross-tenant 404, RLS and private/direct-write denial", async () => {
    const own = await confirm(), victim = await confirm({}, randomUUID(), other);
    for (const [actor, id] of [[owner, own.milestone.id], [other, victim.milestone.id]] as const) {
      expect((await asActor("select id from milestones order by id", [], actor)).rows).toEqual([{ id }]);
    }
    const before = await snapshot(outerTables);
    await denied(() => confirm({ source_id: other.epic }), "P0002", "MILESTONE_SOURCE_NOT_FOUND");
    for (const id of [victim.milestone.id, randomUUID()]) {
      await denied(() => settle(id), "P0002", "MILESTONE_NOT_FOUND");
      await denied(() => revoke(id), "P0002", "MILESTONE_NOT_FOUND");
    }
    await denied(() => asActor("update milestones set title='forged' where id=$1", [own.milestone.id]), "42501");
    await denied(() => asActor("insert into milestones(user_id) values($1)", [owner.user]), "42501");
    await denied(() => asActor("delete from milestones where id=$1", [own.milestone.id]), "42501");
    for (const role of ["anon", "authenticated", "service_role"] as const) {
      await denied(() => asActor("select phase8f_trim_text('forged helper access')", [], owner, role), "42501");
    }
    expect(await snapshot(outerTables)).toEqual(before);
  });

  test.each(["ACCEPTED", "EDITED", "REJECTED"])("O021: %s requires explicit review, preserves every original provenance field and never funds", async decision => {
    const proposed = await createProposal(), key = randomUUID();
    const before = await snapshot(outerTables);
    for (let i = 0; i < 3; i++) expect((await asActor("select status from outer_loop_proposals where id=$1", [proposed.id])).rows[0].status).toBe("PROPOSED");
    expect(await snapshot(outerTables)).toEqual(before);
    expect((await pg.query("select count(*)::int as n from milestones where user_id=$1", [owner.user])).rows[0].n).toBe(0);
    const edited = decision === "EDITED" ? payload({ title: "Explicit edited confirmation", source_id: owner.main }) : null;
    const result = await review(proposed.id, decision, edited, key);
    expect(result.proposal).toMatchObject({ status: decision, payload: proposed.payload, source_refs: proposed.source_refs, model_metadata: proposed.model_metadata });
    if (decision === "REJECTED") { expect(result.milestone).toBeNull(); expect(result.result).toBeNull(); }
    else {
      expect(result.milestone).toMatchObject({ status: "ACTIVE", source_id: decision === "EDITED" ? owner.main : owner.epic, granted_reward_credit: false, reward_transaction_id: null });
      expect(result.result?.milestone_id).toBe(result.milestone!.id);
      await revoke(result.milestone!.id);
    }
    const after = await snapshot(outerTables);
    expect(await review(proposed.id, decision, edited, key)).toEqual({ ...result, replayed: true });
    expect(await snapshot(outerTables)).toEqual(after);
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t => [t, []])));
    await denied(() => review(proposed.id, decision, edited), "23505", "PROPOSAL_ALREADY_REVIEWED");
  });

  test("O021: legacy, expiry, partial editing and AI financial fields cannot bypass confirmation", async () => {
    const legacy = await createProposal(payload(), 1);
    for (const decision of ["ACCEPTED", "EDITED"]) await denied(() => review(legacy.id, decision, decision === "EDITED" ? payload() : null), "22023", "SCHEMA_VALIDATION_FAILED");
    expect((await review(legacy.id, "REJECTED")).milestone).toBeNull();
    const expired = await createProposal(payload(), 2, true);
    for (const decision of ["ACCEPTED", "REJECTED"]) await denied(() => review(expired.id, decision), "22023", "PROPOSAL_EXPIRED");
    const valid = await createProposal();
    await denied(() => review(valid.id, "EDITED", { title: "Partial only" }), "22023", "PAYLOAD_VALIDATION_FAILED");
    for (const field of ["amount", "reward_credit_value", "user_id", "granted_reward_credit", "reward_transaction_id"]) {
      const forged = await createProposal(payload({ [field]: 150 }));
      await denied(() => review(forged.id, "ACCEPTED"), "22023", "PAYLOAD_VALIDATION_FAILED");
    }
    expect((await pg.query("select count(*)::int as n from milestones where user_id=$1", [owner.user])).rows[0].n).toBe(0);
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t => [t, []])));
  });
});
