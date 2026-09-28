import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Client } from "pg";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
const USER_A = "8d711111-aaaa-4000-a000-000000000001";
const USER_B = "8d722222-bbbb-4000-b000-000000000002";
const JOURNAL_A = "8d790001-aaaa-4000-a000-000000000001";
const JOURNAL_B = "8d790002-bbbb-4000-b000-000000000002";

describe.skipIf(!databaseUrl)("Phase 8D Round 2 — Strategy RPC authority", () => {
  let pg: Client;
  let savepoint = 0;

  async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await pg.query("set role authenticated");
    await pg.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    // A failed SQL statement aborts the test transaction. Do not let RESET
    // ROLE's 25P02 mask the original database error; afterEach rolls back.
    const result = await fn();
    await pg.query("reset role");
    return result;
  }

  async function mustFail(fn: () => Promise<unknown>, expectedCode?: string): Promise<void> {
    const name = `expected_failure_${++savepoint}`;
    await pg.query(`savepoint ${name}`);
    let error: unknown;
    try { await fn(); } catch (caught) { error = caught; }
    await pg.query(`rollback to savepoint ${name}`);
    await pg.query(`release savepoint ${name}`);
    expect(error).toBeDefined();
    if (expectedCode) expect((error as { code?: string }).code).toBe(expectedCode);
  }

  async function createStrategy(): Promise<string> {
    return asUser(USER_A, async () => {
      const result = await pg.query<{ id: string }>(
        `insert into public.strategies
          (user_id, title, context_trigger, action_protocol, expected_outcome)
         values ($1, 'strategy', 'context', 'protocol', 'outcome') returning id`, [USER_A]);
      return result.rows[0]!.id;
    });
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
  });
  beforeEach(async () => {
    savepoint = 0;
    await pg.query("begin");
    await pg.query(`insert into auth.users (id, email) values
      ($1, 'phase8d-rpc-a@example.test'), ($2, 'phase8d-rpc-b@example.test')`, [USER_A, USER_B]);
    await pg.query(`insert into public.journal_entries
      (id, user_id, entry_type, title, content_markdown) values
      ($1, $2, 'FREE_REFLECTION', 'A', 'evidence'),
      ($3, $4, 'FREE_REFLECTION', 'B', 'evidence')`, [JOURNAL_A, USER_A, JOURNAL_B, USER_B]);
  });
  afterEach(async () => { await pg.query("rollback"); await pg.query("reset role"); });
  afterAll(async () => { if (pg) await pg.end(); });

  test("transition and version request keys replay exactly once, conflicts fail", async () => {
    const id = await createStrategy();
    await asUser(USER_A, async () => {
      const first = await pg.query<{ result: { strategy: { lifecycle_status: string }; replayed: boolean } }>(
        `select public.rpc_transition_strategy_status($1, 'TESTING', null, null, 'transition-1') as result`, [id]);
      expect(first.rows[0]!.result.strategy.lifecycle_status).toBe("TESTING");
      const replay = await pg.query<{ result: { replayed: boolean } }>(
        `select public.rpc_transition_strategy_status($1, 'TESTING', null, null, 'transition-1') as result`, [id]);
      expect(replay.rows[0]!.result.replayed).toBe(true);
      await mustFail(() => pg.query(
        `select public.rpc_transition_strategy_status($1, 'RETIRED', null, 'reason', 'transition-1')`, [id]));
      const version = await pg.query<{ result: { version: { version_number: number }; strategy: { confidence_level: string } } }>(
        `select public.rpc_create_strategy_version($1, 'protocol2', 'context2', 'outcome2', 'revision', 'version-1') as result`, [id]);
      expect(version.rows[0]!.result.version.version_number).toBe(2);
      expect(version.rows[0]!.result.strategy.confidence_level).toBe("LOW");
      const again = await pg.query<{ result: { replayed: boolean; version: { version_number: number } } }>(
        `select public.rpc_create_strategy_version($1, 'protocol2', 'context2', 'outcome2', 'revision', 'version-1') as result`, [id]);
      expect(again.rows[0]!.result).toMatchObject({ replayed: true, version: { version_number: 2 } });
      await mustFail(() => pg.query(
        `select public.rpc_create_strategy_version($1, 'protocol3', 'context2', 'outcome2', 'revision', 'version-1')`, [id]));
    });
  });

  test("canonical Journal aliases and evaluator changes cannot inflate support", async () => {
    const id = await createStrategy();
    const observed = await pg.query<{ created_at: Date }>(
      `select created_at from public.journal_entries where id = $1`, [JOURNAL_A]);
    await asUser(USER_A, async () => {
      await pg.query(`select public.rpc_transition_strategy_status($1, 'TESTING', null, null, 'test-2')`, [id]);
      const first = await pg.query<{ result: { replayed: boolean } }>(
        `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'JOURNAL_CONTEXT', $2, 'v1', null, $3) as result`,
        [id, JOURNAL_A, observed.rows[0]!.created_at]);
      expect(first.rows[0]!.result.replayed).toBe(false);
      const replay = await pg.query<{ result: { replayed: boolean } }>(
        `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'MANUAL_OBSERVATION', $2, 'v2', 'different', $3) as result`,
        [id, JOURNAL_A, observed.rows[0]!.created_at]);
      expect(replay.rows[0]!.result.replayed).toBe(true);
      await mustFail(() => pg.query(
        `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'JOURNAL_CONTEXT', $2, 'v3', null, $3)`,
        [id, JOURNAL_B, observed.rows[0]!.created_at]));
      const count = await pg.query<{ count: string }>(
        `select count(*) from public.strategy_supports where strategy_id = $1`, [id]);
      expect(count.rows[0]!.count).toBe("1");
    });
  });

  test("Quest completion does not invalidate an accepted pre-completion support replay", async () => {
    const id = await createStrategy();
    const quest = await pg.query<{ id: string; created_at: Date }>(
      `insert into public.quests (user_id, title, quest_type)
       values ($1, 'changing quest', 'production') returning id, created_at`, [USER_A]);
    const questId = quest.rows[0]!.id;
    const originalTimestamp = quest.rows[0]!.created_at;
    await asUser(USER_A, async () => {
      await pg.query(`select public.rpc_transition_strategy_status($1, 'TESTING', null, null, 'quest-test')`, [id]);
      await pg.query(
        `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'QUEST_OUTCOME', $2, 'v1', null, $3)`,
        [id, questId, originalTimestamp]);
    });
    await pg.query(
      `update public.quests set status = 'completed', completed_at = clock_timestamp() where id = $1`,
      [questId]);
    await asUser(USER_A, async () => {
      const replay = await pg.query<{ result: { replayed: boolean } }>(
        `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'QUEST_OUTCOME', $2, 'v2', null, $3) as result`,
        [id, questId, originalTimestamp]);
      expect(replay.rows[0]!.result.replayed).toBe(true);
    });
  });

  test("confirmed promotion is replayable without another transition or audit", async () => {
    const id = await createStrategy();
    const sources = await pg.query<{ id: string; created_at: Date }>(
      `insert into public.activities
        (user_id, title, raw_input, rules_version, status, created_at)
       values
        ($1, 'day 1', 'source', 'phase8d-round2', 'confirmed', '2026-09-01T12:00:00Z'),
        ($1, 'day 2', 'source', 'phase8d-round2', 'confirmed', '2026-09-02T12:00:00Z'),
        ($1, 'day 3', 'source', 'phase8d-round2', 'confirmed', '2026-09-03T12:00:00Z'),
        ($1, 'day 4', 'source', 'phase8d-round2', 'confirmed', '2026-09-04T12:00:00Z')
       returning id, created_at`, [USER_A]);
    const season = await pg.query<{ id: string }>(
      `insert into public.seasons (user_id, name, status, started_at, ended_at)
       values ($1, 'completed season', 'COMPLETED', '2026-08-01T00:00:00Z', '2026-09-05T00:00:00Z')
       returning id`, [USER_A]);
    const review = await pg.query<{ id: string; created_at: Date }>(
      `insert into public.season_reviews
        (user_id, season_id, review_type, version, commit_key, period_start,
         period_end, objective_summary, qualitative_reflection, criteria_evaluation)
       values ($1, $2, 'FINAL', 1, gen_random_uuid(),
         '2026-08-01T00:00:00Z', '2026-09-05T00:00:00Z', '{}'::jsonb, 'review', '[]'::jsonb)
       returning id, created_at`, [USER_A, season.rows[0]!.id]);
    await asUser(USER_A, async () => {
      await pg.query(`select public.rpc_transition_strategy_status($1, 'TESTING', null, null, 'promotion-test')`, [id]);
      for (const source of sources.rows) {
        await pg.query(
          `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'ACTIVITY', $2, 'v1', null, $3)`,
          [id, source.id, source.created_at]);
      }
      await pg.query(
        `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'SEASON_REVIEW', $2, 'v1', null, $3)`,
        [id, review.rows[0]!.id, review.rows[0]!.created_at]);
      const first = await pg.query<{ result: { strategy: { lifecycle_status: string } } }>(
        `select public.rpc_evaluate_strategy_status($1, true) as result`, [id]);
      expect(first.rows[0]!.result.strategy.lifecycle_status).toBe("SUPPORTED");
      const auditsBefore = await pg.query<{ count: string }>(
        `select count(*) from public.outer_loop_audit_events
         where entity_id = $1 and event_type = 'STRATEGY_EVALUATED'`, [id]);
      const replay = await pg.query<{ result: { strategy: { lifecycle_status: string } } }>(
        `select public.rpc_evaluate_strategy_status($1, true) as result`, [id]);
      expect(replay.rows[0]!.result.strategy.lifecycle_status).toBe("SUPPORTED");
      const auditsAfter = await pg.query<{ count: string }>(
        `select count(*) from public.outer_loop_audit_events
         where entity_id = $1 and event_type = 'STRATEGY_EVALUATED'`, [id]);
      expect(auditsAfter.rows[0]!.count).toBe(auditsBefore.rows[0]!.count);
    });
  });

  test("anonymous execute, direct write, and owner-strategy foreign source fail closed", async () => {
    const id = await createStrategy();
    const version = await pg.query<{ id: string }>(
      `select id from public.strategy_versions where strategy_id = $1 and version_number = 1`, [id]);
    const ownTimestamp = await pg.query<{ created_at: Date }>(
      `select created_at from public.journal_entries where id = $1`, [JOURNAL_A]);
    const foreignTimestamp = await pg.query<{ created_at: Date }>(
      `select created_at from public.journal_entries where id = $1`, [JOURNAL_B]);
    await pg.query("set role anon");
    await mustFail(() => pg.query(`select public.rpc_evaluate_strategy_status($1, false)`, [id]), "42501");
    await pg.query("reset role");
    await asUser(USER_A, async () => {
      await pg.query(`select public.rpc_transition_strategy_status($1, 'TESTING', null, null, 'tenant-test')`, [id]);
      await mustFail(() => pg.query(
        `select public.rpc_insert_strategy_support($1, 'SUPPORT', 'JOURNAL_CONTEXT', $2, 'v1', null, $3)`,
        [id, JOURNAL_B, foreignTimestamp.rows[0]!.created_at]), "P0002");
      await mustFail(() => pg.query(
        `insert into public.strategy_supports
          (user_id, strategy_id, strategy_version_id, observation_type,
           source_class, source_id, evaluator_version, observed_at)
         values ($1, $2, $3, 'SUPPORT', 'JOURNAL_CONTEXT', $4, 'v1', $5)`,
        [USER_A, id, version.rows[0]!.id, JOURNAL_A, ownTimestamp.rows[0]!.created_at]), "42501");
      const count = await pg.query<{ count: string }>(
        `select count(*) from public.strategy_supports where strategy_id = $1`, [id]);
      expect(count.rows[0]!.count).toBe("0");
    });
  });

  test("strategy hypothesis proposal requires review and settles exactly once", async () => {
    const hypothesis = await pg.query<{ id: string }>(
      `insert into public.outer_loop_proposals
        (user_id, proposal_type, schema_version, payload)
       values ($1, 'STRATEGY_HYPOTHESIS', 1, $2::jsonb) returning id`,
      [USER_A, JSON.stringify({ title: "AI suggestion", description: "draft",
        context_trigger: "context", action_protocol: "protocol", expected_outcome: "outcome" })]);
    const proposalId = hypothesis.rows[0]!.id;
    const before = await pg.query<{ count: string }>(
      `select count(*) from public.strategies where user_id = $1`, [USER_A]);
    expect(before.rows[0]!.count).toBe("0");
    await asUser(USER_A, async () => {
      const settled = await pg.query<{ result: { proposal: { resulting_entity_id: string } } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'proposal-1') as result`, [proposalId]);
      const strategyId = settled.rows[0]!.result.proposal.resulting_entity_id;
      const replay = await pg.query<{ result: { replayed: boolean; resulting_entity_id: string } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'proposal-1') as result`, [proposalId]);
      expect(replay.rows[0]!.result).toMatchObject({ replayed: true, resulting_entity_id: strategyId });
      await mustFail(() => pg.query(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'proposal-2')`, [proposalId]));
      const count = await pg.query<{ count: string }>(
        `select count(*) from public.strategies where user_id = $1`, [USER_A]);
      expect(count.rows[0]!.count).toBe("1");
    });
  });

  test("counter-evidence alert acknowledges only and rejects foreign sources", async () => {
    const strategyId = await createStrategy();
    const quest = await pg.query<{ id: string }>(
      `insert into public.quests (user_id, title, quest_type)
       values ($1, 'source quest', 'production') returning id`, [USER_A]);
    const activity = await pg.query<{ id: string }>(
      `insert into public.activities (user_id, quest_id, title, raw_input, rules_version)
       values ($1, $2, 'source activity', 'source', 'phase8d-round2') returning id`,
      [USER_A, quest.rows[0]!.id]);
    const payload = {
      strategy_id: strategyId, counter_evidence_activity_id: activity.rows[0]!.id,
      observation: "possible failure", recommended_action: "review manually",
    };
    const proposal = await pg.query<{ id: string }>(
      `insert into public.outer_loop_proposals
        (user_id, proposal_type, schema_version, payload)
       values ($1, 'STRATEGY_COUNTEREVIDENCE_ALERT', 1, $2::jsonb) returning id`,
      [USER_A, JSON.stringify(payload)]);
    await asUser(USER_A, async () => {
      const settled = await pg.query<{ result: { proposal: { status: string }; reviewed_payload: typeof payload } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'alert-1') as result`,
        [proposal.rows[0]!.id]);
      expect(settled.rows[0]!.result.proposal.status).toBe("ACCEPTED");
      expect(settled.rows[0]!.result.reviewed_payload).toEqual(payload);
      const count = await pg.query<{ count: string }>(
        `select count(*) from public.strategy_supports where strategy_id = $1`, [strategyId]);
      expect(count.rows[0]!.count).toBe("0");
      const strategy = await pg.query<{ lifecycle_status: string; confidence_level: string }>(
        `select lifecycle_status, confidence_level from public.strategies where id = $1`, [strategyId]);
      expect(strategy.rows[0]).toEqual({ lifecycle_status: "HYPOTHESIS", confidence_level: "LOW" });
    });
    const edited = await pg.query<{ id: string }>(
      `insert into public.outer_loop_proposals
        (user_id, proposal_type, schema_version, payload)
       values ($1, 'STRATEGY_COUNTEREVIDENCE_ALERT', 1, $2::jsonb) returning id`,
      [USER_A, JSON.stringify(payload)]);
    const finalPayload = { ...payload, observation: "user corrected observation" };
    await asUser(USER_A, async () => {
      const reviewed = await pg.query<{ result: { reviewed_payload: typeof payload } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'EDITED', $2::jsonb, null, 'alert-edited') as result`,
        [edited.rows[0]!.id, JSON.stringify(finalPayload)]);
      expect(reviewed.rows[0]!.result.reviewed_payload).toEqual(finalPayload);
      const replay = await pg.query<{ result: { reviewed_payload: typeof payload; replayed: boolean } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'EDITED', $2::jsonb, null, 'alert-edited') as result`,
        [edited.rows[0]!.id, JSON.stringify(finalPayload)]);
      expect(replay.rows[0]!.result).toMatchObject({ reviewed_payload: finalPayload, replayed: true });
      await mustFail(() => pg.query(
        `select public.rpc_review_outer_loop_proposal($1, 'EDITED', $2::jsonb, null, 'alert-edited')`,
        [edited.rows[0]!.id, JSON.stringify({ ...finalPayload, observation: "conflicting edit" })]), "23505");
    });
    const forged = await pg.query<{ id: string }>(
      `insert into public.outer_loop_proposals
        (user_id, proposal_type, schema_version, payload)
       values ($1, 'STRATEGY_COUNTEREVIDENCE_ALERT', 1, $2::jsonb) returning id`,
      [USER_B, JSON.stringify(payload)]);
    await asUser(USER_B, async () => {
      await mustFail(() => pg.query(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'forged-alert')`,
        [forged.rows[0]!.id]));
    });
  });
});
