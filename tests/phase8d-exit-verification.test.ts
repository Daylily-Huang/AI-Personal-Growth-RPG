import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Client } from "pg";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
const USER_A = "8d8f0001-aaaa-4000-a000-000000000001";
const USER_B = "8d8f0002-bbbb-4000-b000-000000000002";
const JOURNAL_A = "8d8f1001-aaaa-4000-a000-000000000001";

/**
 * Phase 8D Round 5 — canonical exit verification set.
 *
 * Controlling document §10 / §11.6 binds O008 / O009 / O017 / O021 as the exit
 * tests for Phase 8D. Each test below is named after the canonical scenario so
 * the exit set is auditable by name; the broader §10 counterexamples and
 * security validations live in strategy-database-foundation.test.ts and
 * strategy-rpc-authority.test.ts, and this file adds the counterexamples those
 * suites left unproven (background-evaluation non-promotion, CONTEXTUAL
 * lifecycle, retirement history, concurrent proposal CAS, VERY_HIGH/0.75
 * boundaries, provenance-only sources).
 */
describe.skipIf(!databaseUrl)("Phase 8D Round 5 — canonical exit verification", () => {
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
         values ($1, 'exit strategy', 'context', 'protocol', 'outcome') returning id`, [USER_A]);
      return result.rows[0]!.id;
    });
  }

  async function insertActivity(title: string, createdAt: string): Promise<{ id: string; observed_at: string }> {
    const result = await pg.query<{ id: string; observed_at: string }>(
      `insert into public.activities (user_id, title, raw_input, rules_version, status, created_at)
       values ($1, $2, 'source', 'phase8d-exit', 'confirmed', $3)
       returning id, created_at::text as observed_at`, [USER_A, title, createdAt]);
    return result.rows[0]!;
  }

  /** `count` confirmed Activities on `count` distinct UTC calendar dates. */
  async function insertActivities(count: number): Promise<Array<{ id: string; observed_at: string }>> {
    const rows: Array<{ id: string; observed_at: string }> = [];
    for (let index = 0; index < count; index += 1) {
      const day = String(index + 1).padStart(2, "0");
      // Always six fractional digits: PostgreSQL keeps microsecond precision.
      const micros = String((index + 1) * 1000).padStart(6, "0");
      rows.push(await insertActivity(`activity day ${index + 1}`, `2026-09-${day}T12:00:00.${micros}Z`));
    }
    return rows;
  }

  async function insertCompletedSeasonReview(createdAt: string): Promise<{ id: string; observed_at: string }> {
    const season = await pg.query<{ id: string }>(
      `insert into public.seasons (user_id, name, status, started_at, ended_at)
       values ($1, 'exit completed season', 'COMPLETED', '2026-08-01T00:00:00Z', '2026-09-05T00:00:00Z')
       returning id`, [USER_A]);
    const review = await pg.query<{ id: string; observed_at: string }>(
      `insert into public.season_reviews
         (user_id, season_id, review_type, version, commit_key, period_start, period_end,
          objective_summary, qualitative_reflection, criteria_evaluation, created_at)
       values ($1, $2, 'FINAL', 1, gen_random_uuid(), '2026-08-01T00:00:00Z', '2026-09-05T00:00:00Z',
         '{}'::jsonb, 'review', '[]'::jsonb, $3)
       returning id, created_at::text as observed_at`, [USER_A, season.rows[0]!.id, createdAt]);
    return review.rows[0]!;
  }

  async function insertEvidenceRecord(createdAt: string): Promise<{ id: string; observed_at: string }> {
    const result = await pg.query<{ id: string; observed_at: string }>(
      `insert into public.evidence_records (user_id, evidence_level, description, created_at)
       values ($1, 2, 'provenance only', $2)
       returning id, created_at::text as observed_at`, [USER_A, createdAt]);
    return result.rows[0]!;
  }

  async function insertSupport(
    strategyId: string, observationType: "SUPPORT" | "COUNTER_EVIDENCE",
    sourceClass: string, sourceId: string, observedAt: string,
  ): Promise<void> {
    await pg.query(
      `select public.rpc_insert_strategy_support($1, $2, $3, $4, 'v1', null, $5)`,
      [strategyId, observationType, sourceClass, sourceId, observedAt]);
  }

  async function transition(strategyId: string, target: string, key: string,
    note: string | null = null, reason: string | null = null): Promise<void> {
    await pg.query(
      `select public.rpc_transition_strategy_status($1, $2, $3, $4, $5)`,
      [strategyId, target, note, reason, key]);
  }

  async function strategyState(strategyId: string): Promise<{ lifecycle_status: string; confidence_level: string; version: number }> {
    const result = await pg.query<{ lifecycle_status: string; confidence_level: string; version: number }>(
      `select lifecycle_status, confidence_level, version from public.strategies where id = $1`, [strategyId]);
    return result.rows[0]!;
  }

  async function metrics(strategyId: string, confirm = false) {
    const result = await pg.query<{ result: { metrics: Record<string, unknown> } }>(
      `select public.rpc_evaluate_strategy_status($1, $2) as result`, [strategyId, confirm]);
    return result.rows[0]!.result.metrics;
  }

  /** TESTING -> SUPPORTED with 4 distinct dates, 1 completed Season, 4 Core links, ratio 1. */
  async function buildEligibleSupportedStrategy(): Promise<{
    id: string;
    activities: Array<{ id: string; observed_at: string }>;
  }> {
    const id = await createStrategy();
    const activities = await insertActivities(4);
    const review = await insertCompletedSeasonReview("2026-09-04T18:00:00.500000Z");
    await asUser(USER_A, async () => {
      await transition(id, "TESTING", `eligible-testing-${id}`);
      for (const activity of activities) await insertSupport(id, "SUPPORT", "ACTIVITY", activity.id, activity.observed_at);
      await insertSupport(id, "SUPPORT", "SEASON_REVIEW", review.id, review.observed_at);
      const promoted = await pg.query<{ result: { strategy: { lifecycle_status: string } } }>(
        `select public.rpc_evaluate_strategy_status($1, true) as result`, [id]);
      expect(promoted.rows[0]!.result.strategy.lifecycle_status).toBe("SUPPORTED");
    });
    return { id, activities };
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
  });
  beforeEach(async () => {
    savepoint = 0;
    await pg.query("begin");
    await pg.query(`insert into auth.users (id, email) values
      ($1, 'phase8d-exit-a@example.test'), ($2, 'phase8d-exit-b@example.test')`, [USER_A, USER_B]);
    await pg.query(`insert into public.journal_entries
      (id, user_id, entry_type, title, content_markdown)
      values ($1, $2, 'FREE_REFLECTION', 'exit journal', 'evidence')`, [JOURNAL_A, USER_A]);
  });
  afterEach(async () => { await pg.query("rollback"); await pg.query("reset role"); });
  afterAll(async () => { if (pg) await pg.end(); });

  test("O008_AI_CANNOT_COMMIT_STRATEGY", async () => {
    // The AI GM path may only create a proposal row; no Strategy exists before review.
    // Phase 8D has no AI generation HTTP endpoint: the AI producer surface is the
    // outer_loop_proposals authority, so the commit boundary is proven here.
    const proposal = await pg.query<{ id: string }>(
      `insert into public.outer_loop_proposals
         (user_id, proposal_type, schema_version, payload, model_metadata)
       values ($1, 'STRATEGY_HYPOTHESIS', 1, $2::jsonb, $3::jsonb)
       returning id`,
      [USER_A,
        JSON.stringify({ title: "AI suggestion", description: "draft", context_trigger: "context",
          action_protocol: "protocol", expected_outcome: "outcome" }),
        JSON.stringify({ model: "ai-gm" })]);

    const pending = await pg.query<{ status: string; decision: string | null; resulting_entity_id: string | null }>(
      `select status, decision, resulting_entity_id from public.outer_loop_proposals where id = $1`,
      [proposal.rows[0]!.id]);
    expect(pending.rows[0]).toEqual({ status: "PROPOSED", decision: null, resulting_entity_id: null });
    const before = await pg.query<{ count: string }>(
      `select count(*) from public.strategies where user_id = $1`, [USER_A]);
    expect(before.rows[0]!.count).toBe("0");

    // A raw AI-style payload sent straight at the domain table is rejected:
    // lifecycle, confidence, version, and owner cannot be forged. The
    // column-level least-privilege grants fail this closed with 42501.
    await asUser(USER_A, async () => {
      await mustFail(() => pg.query(
        `insert into public.strategies
           (user_id, title, context_trigger, action_protocol, expected_outcome, lifecycle_status, confidence_level, version)
         values ($1, 'ai direct commit', 'context', 'protocol', 'outcome', 'SUPPORTED', 'VERY_HIGH', 9)`,
        [USER_A]), "42501");
      await mustFail(() => pg.query(
        `insert into public.strategies
           (user_id, title, context_trigger, action_protocol, expected_outcome)
         values ($1, 'ai cross-tenant commit', 'context', 'protocol', 'outcome')`,
        [USER_B]), "42501");
    });
    await pg.query("set role anon");
    await mustFail(() => pg.query(
      `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'ai-self-review')`,
      [proposal.rows[0]!.id]), "42501");
    await pg.query("reset role");
    await asUser(USER_B, async () => {
      await mustFail(() => pg.query(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'ai-foreign-review')`,
        [proposal.rows[0]!.id]), "P0002");
    });

    const after = await pg.query<{ count: string }>(
      `select count(*) from public.strategies where user_id = $1`, [USER_A]);
    expect(after.rows[0]!.count).toBe("0");
    const stillPending = await pg.query<{ status: string }>(
      `select status from public.outer_loop_proposals where id = $1`, [proposal.rows[0]!.id]);
    expect(stillPending.rows[0]!.status).toBe("PROPOSED");
  });

  test("O009_STRATEGY_REQUIRES_CROSS_TIME_SUPPORT", async () => {
    // Case A — same-day clustering: 2 observations on one calendar day, zero completed Seasons.
    const caseA = await createStrategy();
    const sameDay = [
      await insertActivity("caseA morning", "2026-09-01T08:00:00.111111Z"),
      await insertActivity("caseA evening", "2026-09-01T20:00:00.222222Z"),
    ];
    expect(sameDay[0]!.observed_at).toContain(".111111");
    await asUser(USER_A, async () => {
      await transition(caseA, "TESTING", `caseA-testing-${caseA}`);
      for (const activity of sameDay) await insertSupport(caseA, "SUPPORT", "ACTIVITY", activity.id, activity.observed_at);
      expect(await metrics(caseA)).toMatchObject({
        distinct_observation_dates: 1, completed_seasons: 0, core_links: 2,
        support_ratio: 1, confidence_level: "LOW", promotion_eligible: false,
      });
      // confirm=false on an ineligible Strategy neither promotes nor changes status.
      expect(await strategyState(caseA)).toEqual({ lifecycle_status: "TESTING", confidence_level: "LOW", version: 1 });
      await mustFail(() => pg.query(`select public.rpc_evaluate_strategy_status($1, true)`, [caseA]), "22023");
      await mustFail(() => pg.query(
        `select public.rpc_transition_strategy_status($1, 'SUPPORTED', null, null, $2)`, [caseA, `caseA-promote-${caseA}`]), "22023");
    });
    expect(await strategyState(caseA)).toEqual({ lifecycle_status: "TESTING", confidence_level: "LOW", version: 1 });

    // Case B — 3 distinct dates + 1 completed Season + 2+ Core links + ratio >= 75%:
    // derived confidence is MODERATE, strictly below the HIGH promotion gate.
    const caseB = await createStrategy();
    const threeDates = [
      await insertActivity("caseB day 1", "2026-09-01T12:00:00.123456Z"),
      await insertActivity("caseB day 2", "2026-09-02T12:00:00.234567Z"),
      await insertActivity("caseB day 3", "2026-09-03T12:00:00.345678Z"),
    ];
    // The review lands on the SAME UTC date as day 3, so it cannot lift the
    // distinct-date count to the 4-date promotion gate.
    const review = await insertCompletedSeasonReview("2026-09-03T18:00:00.456789Z");
    await asUser(USER_A, async () => {
      await transition(caseB, "TESTING", `caseB-testing-${caseB}`);
      for (const activity of threeDates) await insertSupport(caseB, "SUPPORT", "ACTIVITY", activity.id, activity.observed_at);
      await insertSupport(caseB, "SUPPORT", "SEASON_REVIEW", review.id, review.observed_at);
      expect(await metrics(caseB)).toMatchObject({
        support_count: 4, distinct_observation_dates: 3, completed_seasons: 1, core_links: 3,
        support_ratio: 1, confidence_level: "MODERATE", promotion_eligible: false,
      });
      await mustFail(() => pg.query(`select public.rpc_evaluate_strategy_status($1, true)`, [caseB]), "22023");
    });
    expect(await strategyState(caseB)).toEqual({ lifecycle_status: "TESTING", confidence_level: "MODERATE", version: 1 });

    // Canonical gate — the 4th distinct date lifts the same Strategy to HIGH.
    const fourth = await insertActivity("caseB day 4", "2026-09-04T12:00:00.567890Z");
    await asUser(USER_A, async () => {
      await insertSupport(caseB, "SUPPORT", "ACTIVITY", fourth.id, fourth.observed_at);
      // This evaluation runs with confirm=false (background/AI semantics) even
      // though the Strategy is now promotion-eligible: it MUST stay TESTING.
      expect(await metrics(caseB)).toMatchObject({
        distinct_observation_dates: 4, completed_seasons: 1, core_links: 4,
        support_ratio: 1, confidence_level: "HIGH", promotion_eligible: true,
      });
      expect(await strategyState(caseB)).toMatchObject({ lifecycle_status: "TESTING", confidence_level: "HIGH" });
      const promoted = await pg.query<{ result: { strategy: { lifecycle_status: string } } }>(
        `select public.rpc_evaluate_strategy_status($1, true) as result`, [caseB]);
      expect(promoted.rows[0]!.result.strategy.lifecycle_status).toBe("SUPPORTED");
    });
    expect(await strategyState(caseB)).toMatchObject({ lifecycle_status: "SUPPORTED", confidence_level: "HIGH" });
  });

  test("O017_STRATEGY_CONFIDENCE_IS_DETERMINISTIC_DERIVED", async () => {
    const id = await createStrategy();
    await asUser(USER_A, async () => {
      await mustFail(() => pg.query(
        `update public.strategies set confidence_level = 'VERY_HIGH' where id = $1`, [id]), "42501");
      await mustFail(() => pg.query(
        `update public.strategies set lifecycle_status = 'SUPPORTED' where id = $1`, [id]), "42501");
      await mustFail(() => pg.query(
        `insert into public.strategies
           (user_id, title, context_trigger, action_protocol, expected_outcome, confidence_level)
         values ($1, 'forged confidence', 'context', 'protocol', 'outcome', 'VERY_HIGH')`, [USER_A]), "42501");
    });
    expect(await strategyState(id)).toEqual({ lifecycle_status: "HYPOTHESIS", confidence_level: "LOW", version: 1 });

    const observed = await pg.query<{ observed_at: string }>(
      `select created_at::text as observed_at from public.journal_entries where id = $1`, [JOURNAL_A]);
    await asUser(USER_A, async () => {
      await transition(id, "TESTING", `o017-testing-${id}`);
      await insertSupport(id, "SUPPORT", "JOURNAL_CONTEXT", JOURNAL_A, observed.rows[0]!.observed_at);
      const first = await metrics(id);
      const second = await metrics(id);
      expect(first).toEqual(second);
      // One Journal observation is not cross-time support: derived confidence stays LOW.
      expect(first).toMatchObject({ support_count: 1, distinct_observation_dates: 1, confidence_level: "LOW" });
    });
    expect(await strategyState(id)).toEqual({ lifecycle_status: "TESTING", confidence_level: "LOW", version: 1 });
  });

  test("O021_AI_PROPOSAL_REQUIRES_CONFIRM_BEFORE_COMMIT", async () => {
    const proposal = await pg.query<{ id: string }>(
      `insert into public.outer_loop_proposals
         (user_id, proposal_type, schema_version, payload)
       values ($1, 'STRATEGY_HYPOTHESIS', 1, $2::jsonb) returning id`,
      [USER_A, JSON.stringify({ title: "AI proposal", description: "draft", context_trigger: "context",
        action_protocol: "protocol", expected_outcome: "outcome" })]);

    const pending = await pg.query<{ status: string; resulting_entity_id: string | null }>(
      `select status, resulting_entity_id from public.outer_loop_proposals where id = $1`, [proposal.rows[0]!.id]);
    expect(pending.rows[0]).toEqual({ status: "PROPOSED", resulting_entity_id: null });
    const before = await pg.query<{ count: string }>(
      `select count(*) from public.strategies where user_id = $1`, [USER_A]);
    expect(before.rows[0]!.count).toBe("0");

    await asUser(USER_A, async () => {
      const settled = await pg.query<{ result: { proposal: { status: string; resulting_entity_id: string } } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'o021-accept') as result`,
        [proposal.rows[0]!.id]);
      expect(settled.rows[0]!.result.proposal.status).toBe("ACCEPTED");
      const committed = await pg.query<{ lifecycle_status: string; confidence_level: string; version: number }>(
        `select lifecycle_status, confidence_level, version from public.strategies where id = $1`,
        [settled.rows[0]!.result.proposal.resulting_entity_id]);
      expect(committed.rows[0]).toEqual({ lifecycle_status: "HYPOTHESIS", confidence_level: "LOW", version: 1 });
    });
    const after = await pg.query<{ count: string }>(
      `select count(*) from public.strategies where user_id = $1`, [USER_A]);
    expect(after.rows[0]!.count).toBe("1");
  });

  test("CONTEXTUAL requires a boundary note, re-promotes, and weakens below 60%", async () => {
    const { id, activities } = await buildEligibleSupportedStrategy();
    await asUser(USER_A, async () => {
      await mustFail(() => pg.query(
        `select public.rpc_transition_strategy_status($1, 'CONTEXTUAL', '   ', null, $2)`, [id, `ctx-blank-${id}`]), "22023");
      await transition(id, "CONTEXTUAL", `ctx-${id}`, "only for unfamiliar stacks");
      expect((await strategyState(id)).lifecycle_status).toBe("CONTEXTUAL");
      await transition(id, "SUPPORTED", `ctx-repromote-${id}`);
      expect((await strategyState(id)).lifecycle_status).toBe("SUPPORTED");
      await transition(id, "CONTEXTUAL", `ctx-again-${id}`, "narrow again");
      for (const activity of activities) {
        await insertSupport(id, "COUNTER_EVIDENCE", "ACTIVITY", activity.id, activity.observed_at);
      }
      const weakened = await pg.query<{ result: { strategy: { lifecycle_status: string }; metrics: { support_count: number; counter_evidence_count: number; support_ratio: number } } }>(
        `select public.rpc_evaluate_strategy_status($1, false) as result`, [id]);
      expect(weakened.rows[0]!.result.metrics).toMatchObject({ support_count: 5, counter_evidence_count: 4 });
      expect(weakened.rows[0]!.result.metrics.support_ratio).toBeLessThan(0.6);
      expect(weakened.rows[0]!.result.strategy.lifecycle_status).toBe("WEAKENED");
    });
    expect((await strategyState(id)).lifecycle_status).toBe("WEAKENED");
  });

  test("retirement requires a reason and keeps retired history queryable", async () => {
    const id = await createStrategy();
    const observed = await pg.query<{ observed_at: string }>(
      `select created_at::text as observed_at from public.journal_entries where id = $1`, [JOURNAL_A]);
    await asUser(USER_A, async () => {
      await transition(id, "TESTING", `retire-testing-${id}`);
      await insertSupport(id, "SUPPORT", "JOURNAL_CONTEXT", JOURNAL_A, observed.rows[0]!.observed_at);
      await mustFail(() => pg.query(
        `select public.rpc_transition_strategy_status($1, 'RETIRED', null, '  ', $2)`, [id, `retire-blank-${id}`]), "22023");
      await transition(id, "RETIRED", `retire-${id}`, null, "did not replicate across contexts");
      expect((await strategyState(id)).lifecycle_status).toBe("RETIRED");
      // A retired Strategy is immutable history: no further protocol version.
      await mustFail(() => pg.query(
        `select public.rpc_create_strategy_version($1, 'p2', 'c2', 'o2', 'revision', $2)`, [id, `retire-version-${id}`]), "23514");
    });
    const history = await pg.query<{ lifecycle_status: string; supports: string; versions: string }>(
      `select s.lifecycle_status,
        (select count(*) from public.strategy_supports ss where ss.strategy_id = s.id)::text as supports,
        (select count(*) from public.strategy_versions sv where sv.strategy_id = s.id)::text as versions
       from public.strategies s where s.id = $1`, [id]);
    expect(history.rows[0]).toEqual({ lifecycle_status: "RETIRED", supports: "1", versions: "1" });
  });

  test("deterministic confidence boundaries: VERY_HIGH, exact 0.75 gate, provenance-only source", async () => {
    // VERY_HIGH: >= 8 distinct dates, >= 2 completed Seasons, >= 4 Core links, ratio >= 85%.
    const veryHigh = await createStrategy();
    const veryHighActivities = await insertActivities(8);
    const veryHighReviews = [
      await insertCompletedSeasonReview("2026-09-08T18:00:00.100000Z"),
      await insertCompletedSeasonReview("2026-09-08T19:00:00.200000Z"),
    ];
    const provenance = await insertEvidenceRecord("2026-09-08T20:00:00.300000Z");
    await asUser(USER_A, async () => {
      await transition(veryHigh, "TESTING", `vh-testing-${veryHigh}`);
      for (const activity of veryHighActivities) await insertSupport(veryHigh, "SUPPORT", "ACTIVITY", activity.id, activity.observed_at);
      for (const review of veryHighReviews) await insertSupport(veryHigh, "SUPPORT", "SEASON_REVIEW", review.id, review.observed_at);
      await insertSupport(veryHigh, "SUPPORT", "CORE_EVIDENCE_REFERENCE", provenance.id, provenance.observed_at);
      // CORE_EVIDENCE_REFERENCE is valid provenance but contributes zero Core links.
      expect(await metrics(veryHigh)).toMatchObject({
        support_count: 11, distinct_observation_dates: 8, completed_seasons: 2, core_links: 8,
        support_ratio: 1, confidence_level: "VERY_HIGH", promotion_eligible: true,
      });
    });

    // Exact promotion boundary: 6 SUPPORT / 2 COUNTER_EVIDENCE = 0.75, which is
    // the inclusive HIGH ratio gate (>= 0.75), not above it.
    const boundary = await createStrategy();
    const boundaryActivities = await insertActivities(5);
    const boundaryReview = await insertCompletedSeasonReview("2026-09-05T18:00:00.600000Z");
    await asUser(USER_A, async () => {
      await transition(boundary, "TESTING", `boundary-testing-${boundary}`);
      for (const activity of boundaryActivities) await insertSupport(boundary, "SUPPORT", "ACTIVITY", activity.id, activity.observed_at);
      await insertSupport(boundary, "SUPPORT", "SEASON_REVIEW", boundaryReview.id, boundaryReview.observed_at);
      await insertSupport(boundary, "COUNTER_EVIDENCE", "ACTIVITY", boundaryActivities[0]!.id, boundaryActivities[0]!.observed_at);
      await insertSupport(boundary, "COUNTER_EVIDENCE", "ACTIVITY", boundaryActivities[1]!.id, boundaryActivities[1]!.observed_at);
      expect(await metrics(boundary)).toMatchObject({
        support_count: 6, counter_evidence_count: 2, support_ratio: 0.75,
        distinct_observation_dates: 5, completed_seasons: 1, core_links: 5,
        confidence_level: "HIGH", promotion_eligible: true,
      });
    });
  });

  test("service_role and anon cannot commit Strategy truth", async () => {
    const id = await createStrategy();
    const version = await pg.query<{ id: string }>(
      `select id from public.strategy_versions where strategy_id = $1 and version_number = 1`, [id]);
    const baseline = await pg.query<{ count: string }>(
      `select count(*) from public.strategies where user_id = $1`, [USER_A]);
    for (const role of ["anon", "service_role"] as const) {
      await pg.query(`set role ${role}`);
      await mustFail(() => pg.query(
        `insert into public.strategies
           (user_id, title, context_trigger, action_protocol, expected_outcome)
         values ($1, 'role commit', 'context', 'protocol', 'outcome')`, [USER_A]), "42501");
      await mustFail(() => pg.query(
        `update public.strategies set title = 'role rewrite' where id = $1`, [id]), "42501");
      await mustFail(() => pg.query(
        `insert into public.strategy_versions
           (user_id, strategy_id, version_number, context_trigger, action_protocol, expected_outcome)
         values ($1, $2, 2, 'context', 'protocol', 'outcome')`, [USER_A, id]), "42501");
      await mustFail(() => pg.query(
        `insert into public.strategy_supports
           (user_id, strategy_id, strategy_version_id, observation_type, source_class, source_id, evaluator_version, observed_at)
         values ($1, $2, $3, 'SUPPORT', 'JOURNAL_CONTEXT', $4, 'v1', clock_timestamp())`,
        [USER_A, id, version.rows[0]!.id, JOURNAL_A]), "42501");
      await mustFail(() => pg.query(`delete from public.strategies where id = $1`, [id]), "42501");
      await pg.query("reset role");
    }
    // The AI role may still file a proposal, but filing one commits no Strategy.
    await pg.query("set role service_role");
    await pg.query(
      `insert into public.outer_loop_proposals (user_id, proposal_type, schema_version, payload)
       values ($1, 'STRATEGY_HYPOTHESIS', 1, $2::jsonb)`,
      [USER_A, JSON.stringify({ title: "role proposal", description: "draft", context_trigger: "context",
        action_protocol: "protocol", expected_outcome: "outcome" })]);
    await pg.query("reset role");
    const after = await pg.query<{ count: string }>(
      `select count(*) from public.strategies where user_id = $1`, [USER_A]);
    expect(after.rows[0]!.count).toBe(baseline.rows[0]!.count);
  });

  test("accepted hypothesis supporting activity IDs never materialize strategy_supports", async () => {
    const activities = await insertActivities(2);
    // §5.1 premise: callers cannot mint the canonical source timestamp directly.
    await asUser(USER_A, async () => {
      await mustFail(() => pg.query(
        `insert into public.activities (user_id, title, raw_input, rules_version, status, created_at)
         values ($1, 'direct activity', 'source', 'phase8d-exit', 'confirmed', '2026-01-01T00:00:00Z')`,
        [USER_A]), "42501");
      await mustFail(() => pg.query(
        `insert into public.journal_entries (user_id, entry_type, title, content_markdown, created_at)
         values ($1, 'FREE_REFLECTION', 'direct journal', 'content', '2026-01-01T00:00:00Z')`,
        [USER_A]), "42501");
    });
    const proposal = await pg.query<{ id: string }>(
      `insert into public.outer_loop_proposals (user_id, proposal_type, schema_version, payload)
       values ($1, 'STRATEGY_HYPOTHESIS', 1, $2::jsonb) returning id`,
      [USER_A, JSON.stringify({ title: "with supporting activities", description: "draft",
        context_trigger: "context", action_protocol: "protocol", expected_outcome: "outcome",
        supporting_activity_ids: activities.map((activity) => activity.id) })]);
    await asUser(USER_A, async () => {
      const settled = await pg.query<{ result: { proposal: { resulting_entity_id: string } } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'support-ids-accept') as result`,
        [proposal.rows[0]!.id]);
      const strategyId = settled.rows[0]!.result.proposal.resulting_entity_id;
      const supports = await pg.query<{ count: string }>(
        `select count(*) from public.strategy_supports where strategy_id = $1`, [strategyId]);
      expect(supports.rows[0]!.count).toBe("0");
      expect(await strategyState(strategyId)).toEqual({
        lifecycle_status: "HYPOTHESIS", confidence_level: "LOW", version: 1,
      });
    });
  });

  test("exact 0.65 / 0.85 ratio gates and CONTEXTUAL confirmation is transition-only", async () => {
    // 13 SUPPORT / 7 COUNTER_EVIDENCE = 0.65 exactly, the inclusive MODERATE gate.
    const moderate = await createStrategy();
    const moderateActivities = await insertActivities(13);
    await asUser(USER_A, async () => {
      await transition(moderate, "TESTING", `moderate-testing-${moderate}`);
      for (const activity of moderateActivities) await insertSupport(moderate, "SUPPORT", "ACTIVITY", activity.id, activity.observed_at);
      for (const activity of moderateActivities.slice(0, 7)) {
        await insertSupport(moderate, "COUNTER_EVIDENCE", "ACTIVITY", activity.id, activity.observed_at);
      }
      expect(await metrics(moderate)).toMatchObject({
        support_count: 13, counter_evidence_count: 7, support_ratio: 0.65,
        distinct_observation_dates: 13, completed_seasons: 0, core_links: 13,
        confidence_level: "MODERATE", promotion_eligible: false,
      });
      await mustFail(() => pg.query(`select public.rpc_evaluate_strategy_status($1, true)`, [moderate]), "22023");
    });

    // 17 SUPPORT / 3 COUNTER_EVIDENCE = 0.85 exactly, the inclusive VERY_HIGH gate.
    const veryHighBoundary = await createStrategy();
    const boundaryActivities = await insertActivities(15);
    const boundaryReviews = [
      await insertCompletedSeasonReview("2026-09-15T18:00:00.700000Z"),
      await insertCompletedSeasonReview("2026-09-15T19:00:00.800000Z"),
    ];
    await asUser(USER_A, async () => {
      await transition(veryHighBoundary, "TESTING", `vhb-testing-${veryHighBoundary}`);
      for (const activity of boundaryActivities) await insertSupport(veryHighBoundary, "SUPPORT", "ACTIVITY", activity.id, activity.observed_at);
      for (const review of boundaryReviews) await insertSupport(veryHighBoundary, "SUPPORT", "SEASON_REVIEW", review.id, review.observed_at);
      for (const activity of boundaryActivities.slice(0, 3)) {
        await insertSupport(veryHighBoundary, "COUNTER_EVIDENCE", "ACTIVITY", activity.id, activity.observed_at);
      }
      expect(await metrics(veryHighBoundary)).toMatchObject({
        support_count: 17, counter_evidence_count: 3, support_ratio: 0.85,
        distinct_observation_dates: 15, completed_seasons: 2, core_links: 15,
        confidence_level: "VERY_HIGH", promotion_eligible: true,
      });
    });

    // §7 scopes evaluation promotion to TESTING -> SUPPORTED. An eligible
    // CONTEXTUAL Strategy is promoted only through rpc_transition_strategy_status,
    // so confirmation here stays fail-closed (22023) and the lifecycle is
    // unchanged; this pins that decision instead of leaving it untested.
    const { id: contextualId } = await buildEligibleSupportedStrategy();
    await asUser(USER_A, async () => {
      await transition(contextualId, "CONTEXTUAL", `ctx-confirm-${contextualId}`, "narrow context");
      await mustFail(() => pg.query(`select public.rpc_evaluate_strategy_status($1, true)`, [contextualId]), "22023");
      expect((await strategyState(contextualId)).lifecycle_status).toBe("CONTEXTUAL");
      await transition(contextualId, "SUPPORTED", `ctx-confirm-back-${contextualId}`);
      expect((await strategyState(contextualId)).lifecycle_status).toBe("SUPPORTED");
    });
  });
});

// The concurrent fixture is committed so both sessions see the same proposal.
// It runs only in CI's disposable Supabase database; never on a persistent local test DB.
describe.skipIf(!databaseUrl || process.env.CI !== "true")("Phase 8D Round 5 — concurrent Strategy proposal review", () => {
  test("two sessions reviewing one STRATEGY_HYPOTHESIS commit exactly one Strategy", async () => {
    const admin = new Client({ connectionString: databaseUrl });
    const first = new Client({ connectionString: databaseUrl });
    const second = new Client({ connectionString: databaseUrl });
    await Promise.all([admin.connect(), first.connect(), second.connect()]);
    try {
      const user = await admin.query<{ id: string }>(`select gen_random_uuid()::text as id`);
      const userId = user.rows[0]!.id;
      await admin.query(`insert into auth.users (id, email) values ($1, $2)`,
        [userId, `phase8d-proposal-cas-${userId}@example.test`]);
      const proposal = await admin.query<{ id: string }>(
        `insert into public.outer_loop_proposals (user_id, proposal_type, schema_version, payload)
         values ($1, 'STRATEGY_HYPOTHESIS', 1, $2::jsonb) returning id`,
        [userId, JSON.stringify({ title: "concurrent proposal", description: "draft", context_trigger: "context",
          action_protocol: "protocol", expected_outcome: "outcome" })]);
      const proposalId = proposal.rows[0]!.id;
      for (const client of [first, second]) {
        await client.query("set role authenticated");
        await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
      }
      const pid = await second.query<{ pid: number }>(`select pg_backend_pid() as pid`);
      const secondPid = pid.rows[0]!.pid;
      async function awaitRowLock(): Promise<void> {
        for (let attempt = 0; attempt < 50; attempt++) {
          const state = await admin.query<{ wait_event_type: string | null }>(
            `select wait_event_type from pg_stat_activity where pid = $1`, [secondPid]);
          if (state.rows[0]?.wait_event_type === "Lock") return;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("second proposal review never waited on the first session's row lock");
      }

      await first.query("begin");
      await second.query("begin");
      const winner = await first.query<{ result: { proposal: { resulting_entity_id: string } } }>(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'cas-winner') as result`,
        [proposalId]);
      const pendingLoser = second.query(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'cas-loser')`,
        [proposalId]).then((result) => ({ result }), (error: unknown) => ({ error }));
      await awaitRowLock();
      await first.query("commit");
      const loser = await pendingLoser;
      expect("error" in loser && (loser.error as { code?: string }).code).toBe("23514");
      await second.query("rollback");

      const strategies = await admin.query<{ count: string }>(
        `select count(*)::text as count from public.strategies where user_id = $1`, [userId]);
      expect(strategies.rows[0]!.count).toBe("1");
      const proposalState = await admin.query<{ status: string; resulting_entity_id: string }>(
        `select status, resulting_entity_id from public.outer_loop_proposals where id = $1`, [proposalId]);
      expect(proposalState.rows[0]).toEqual({
        status: "ACCEPTED",
        resulting_entity_id: winner.rows[0]!.result.proposal.resulting_entity_id,
      });
    } finally {
      await Promise.allSettled([first.query("rollback"), second.query("rollback")]);
      await Promise.allSettled([first.end(), second.end(), admin.end()]);
    }
  });
});
