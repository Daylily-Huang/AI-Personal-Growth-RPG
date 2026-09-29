import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "8d111111-aaaa-4000-a000-000000000001";
const USER_B = "8d222222-bbbb-4000-b000-000000000002";
const JOURNAL_A = "8d900001-aaaa-4000-a000-000000000001";
const JOURNAL_B = "8d900002-bbbb-4000-b000-000000000002";
const QUEST_A = "8d100001-aaaa-4000-a000-000000000001";
const QUEST_B = "8d100002-bbbb-4000-b000-000000000002";
const ACTIVITY_A = "8d200001-aaaa-4000-a000-000000000001";
const ACTIVITY_B = "8d200002-bbbb-4000-b000-000000000002";
const EVIDENCE_A = "8d300001-aaaa-4000-a000-000000000001";
const EVIDENCE_B = "8d300002-bbbb-4000-b000-000000000002";
const ARTIFACT_A = "8d400001-aaaa-4000-a000-000000000001";
const ARTIFACT_B = "8d400002-bbbb-4000-b000-000000000002";
const SEASON_A = "8d500001-aaaa-4000-a000-000000000001";
const SEASON_B = "8d500002-bbbb-4000-b000-000000000002";
const REVIEW_A = "8d600001-aaaa-4000-a000-000000000001";
const REVIEW_B = "8d600002-bbbb-4000-b000-000000000002";

type StrategySourceClass =
  | "SEASON_REVIEW"
  | "ACTIVITY"
  | "QUEST_OUTCOME"
  | "ARTIFACT"
  | "CORE_EVIDENCE_REFERENCE"
  | "JOURNAL_CONTEXT"
  | "MANUAL_OBSERVATION";

describe.skipIf(!DATABASE_URL)("Phase 8D Round 1 — Strategy DB foundation authority", () => {
  let pg: Client;
  let failureSeq = 0;

  async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await pg.query("set role authenticated");
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    try {
      return await fn();
    } finally {
      await pg.query("reset role");
    }
  }

  async function cleanupFixtures(): Promise<void> {
    const statements = [
      "delete from public.strategy_supports where user_id in ($1, $2)",
      "delete from public.strategy_versions where user_id in ($1, $2)",
      "delete from public.strategies where user_id in ($1, $2)",
      "delete from public.season_reviews where user_id in ($1, $2)",
      "delete from public.seasons where user_id in ($1, $2)",
      "delete from public.evidence_records where user_id in ($1, $2)",
      "delete from public.artifacts where user_id in ($1, $2)",
      "delete from public.journal_entries where user_id in ($1, $2)",
      "delete from public.activities where user_id in ($1, $2)",
      "delete from public.quests where user_id in ($1, $2)",
      "delete from auth.users where id in ($1, $2)",
    ];

    for (const statement of statements) {
      await pg.query(statement, [USER_A, USER_B]);
    }
  }

  async function expectDbFailure(run: () => Promise<unknown>): Promise<void> {
    failureSeq += 1;
    const savepoint = `expected_failure_${failureSeq}`;
    await pg.query(`savepoint ${savepoint}`);

    let caught: unknown;
    try {
      await run();
    } catch (error) {
      caught = error;
    }

    await pg.query(`rollback to savepoint ${savepoint}`);
    await pg.query(`release savepoint ${savepoint}`);
    expect(caught).toBeDefined();
  }

  async function createStrategy(
    userId: string,
    suffix: string,
  ): Promise<{ id: string; versionId: string }> {
    return asUser(userId, async () => {
      const created = await pg.query<{ id: string }>(
        `insert into public.strategies
           (user_id, title, description, context_trigger, action_protocol, expected_outcome)
         values ($1, $2, 'description', 'context', 'protocol', 'outcome')
         returning id`,
        [userId, `strategy ${suffix}`],
      );
      const strategyId = created.rows[0]!.id;
      const version = await pg.query<{ id: string }>(
        `select id
         from public.strategy_versions
         where strategy_id = $1 and version_number = 1`,
        [strategyId],
      );
      return { id: strategyId, versionId: version.rows[0]!.id };
    });
  }

  async function insertSupportAsDatabaseAuthority(args: {
    userId: string;
    strategyId: string;
    versionId: string;
    sourceId: string;
    sourceClass?: StrategySourceClass;
    evaluatorVersion?: string;
  }): Promise<string> {
    const inserted = await pg.query<{ id: string }>(
      `insert into public.strategy_supports
         (
           user_id,
           strategy_id,
           strategy_version_id,
           observation_type,
           source_class,
           source_id,
           evaluator_version,
           note,
           observed_at
         )
       values ($1, $2, $3, 'SUPPORT', $4, $5, $6, 'round-1 fixture', clock_timestamp())
       returning id`,
      [
        args.userId,
        args.strategyId,
        args.versionId,
        args.sourceClass ?? "JOURNAL_CONTEXT",
        args.sourceId,
        args.evaluatorVersion ?? "phase8d-round1-test",
      ],
    );
    return inserted.rows[0]!.id;
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    await cleanupFixtures();

    await pg.query(
      `insert into auth.users (id, email) values
         ($1, 'phase8d-a@example.test'),
         ($2, 'phase8d-b@example.test')`,
      [USER_A, USER_B],
    );
    await pg.query(
      `insert into public.journal_entries
         (id, user_id, entry_type, title, content_markdown)
       values
         ($1, $2, 'FREE_REFLECTION', 'A journal', 'A source'),
         ($3, $4, 'FREE_REFLECTION', 'B journal', 'B source')`,
      [JOURNAL_A, USER_A, JOURNAL_B, USER_B],
    );
    await pg.query(
      `insert into public.quests (id, user_id, title, quest_type) values
         ($1, $2, 'A quest', 'production'),
         ($3, $4, 'B quest', 'production')`,
      [QUEST_A, USER_A, QUEST_B, USER_B],
    );
    await pg.query(
      `insert into public.activities (id, user_id, quest_id, title, raw_input, rules_version) values
         ($1, $2, $3, 'A activity', 'A source', 'phase8d-round1'),
         ($4, $5, $6, 'B activity', 'B source', 'phase8d-round1')`,
      [ACTIVITY_A, USER_A, QUEST_A, ACTIVITY_B, USER_B, QUEST_B],
    );
    await pg.query(
      `insert into public.evidence_records
         (id, user_id, activity_id, evidence_level, evidence_type, description)
       values
         ($1, $2, $3, 2, 'work_product', 'A evidence'),
         ($4, $5, $6, 2, 'work_product', 'B evidence')`,
      [EVIDENCE_A, USER_A, ACTIVITY_A, EVIDENCE_B, USER_B, ACTIVITY_B],
    );
    await pg.query(
      `insert into public.artifacts (id, user_id, title, artifact_type) values
         ($1, $2, 'A artifact', 'document'),
         ($3, $4, 'B artifact', 'document')`,
      [ARTIFACT_A, USER_A, ARTIFACT_B, USER_B],
    );
    await pg.query(
      `insert into public.seasons (id, user_id, name, status) values
         ($1, $2, 'A season', 'DRAFT'),
         ($3, $4, 'B season', 'DRAFT')`,
      [SEASON_A, USER_A, SEASON_B, USER_B],
    );
    await pg.query(
      `insert into public.season_reviews
         (id, user_id, season_id, review_type, version, commit_key, period_start, period_end,
          objective_summary, qualitative_reflection, criteria_evaluation)
       values
         ($1, $2, $3, 'AD_HOC', 1, '8d610001-aaaa-4000-a000-000000000001', clock_timestamp(), clock_timestamp(),
          '{}'::jsonb, 'A review', '[]'::jsonb),
         ($4, $5, $6, 'AD_HOC', 1, '8d610002-bbbb-4000-b000-000000000002', clock_timestamp(), clock_timestamp(),
          '{}'::jsonb, 'B review', '[]'::jsonb)`,
      [REVIEW_A, USER_A, SEASON_A, REVIEW_B, USER_B, SEASON_B],
    );
  }, 45000);

  beforeEach(async () => {
    failureSeq = 0;
    await pg.query("begin");
  });

  afterEach(async () => {
    await pg.query("rollback");
    await pg.query("reset role");
  });

  afterAll(async () => {
    if (!pg) return;
    await cleanupFixtures();
    await pg.end();
  });

  test("direct owner creation forces HYPOTHESIS / LOW / version 1 and atomically snapshots version 1", async () => {
    await asUser(USER_A, async () => {
      const created = await pg.query<{
        id: string;
        lifecycle_status: string;
        confidence_level: string;
        version: number;
        created_at: Date;
        updated_at: Date;
      }>(
        `insert into public.strategies
           (user_id, title, description, context_trigger, action_protocol, expected_outcome)
         values ($1, 'owner bootstrap', 'description', 'context-v1', 'protocol-v1', 'outcome-v1')
         returning id, lifecycle_status, confidence_level, version, created_at, updated_at`,
        [USER_A],
      );

      expect(created.rows[0]).toMatchObject({
        lifecycle_status: "HYPOTHESIS",
        confidence_level: "LOW",
        version: 1,
      });
      expect(created.rows[0]!.updated_at.getTime()).toBe(created.rows[0]!.created_at.getTime());

      const versions = await pg.query<{
        version_number: number;
        context_trigger: string;
        action_protocol: string;
        expected_outcome: string;
      }>(
        `select version_number, context_trigger, action_protocol, expected_outcome
         from public.strategy_versions
         where strategy_id = $1`,
        [created.rows[0]!.id],
      );

      expect(versions.rows).toEqual([
        {
          version_number: 1,
          context_trigger: "context-v1",
          action_protocol: "protocol-v1",
          expected_outcome: "outcome-v1",
        },
      ]);
    });
  });

  test("direct authenticated creation fails closed on forged authority and provenance fields", async () => {
    await asUser(USER_A, async () => {
      await expectDbFailure(() =>
        pg.query(
          `insert into public.strategies
             (user_id, title, description, context_trigger, action_protocol, expected_outcome, lifecycle_status)
           values ($1, 'forged lifecycle', '', 'context', 'protocol', 'outcome', 'SUPPORTED')`,
          [USER_A],
        ),
      );
      await expectDbFailure(() =>
        pg.query(
          `insert into public.strategies
             (user_id, title, description, context_trigger, action_protocol, expected_outcome, confidence_level)
           values ($1, 'forged confidence', '', 'context', 'protocol', 'outcome', 'VERY_HIGH')`,
          [USER_A],
        ),
      );
      await expectDbFailure(() =>
        pg.query(
          `insert into public.strategies
             (user_id, title, description, context_trigger, action_protocol, expected_outcome, version)
           values ($1, 'forged version', '', 'context', 'protocol', 'outcome', 9)`,
          [USER_A],
        ),
      );
      await expectDbFailure(() =>
        pg.query(
          `insert into public.strategies
             (user_id, title, description, context_trigger, action_protocol, expected_outcome)
           values ($1, 'forged owner', '', 'context', 'protocol', 'outcome')`,
          [USER_B],
        ),
      );
      await expectDbFailure(() =>
        pg.query(
          `insert into public.strategies
             (id, user_id, title, description, context_trigger, action_protocol, expected_outcome)
           values (gen_random_uuid(), $1, 'forged id', '', 'context', 'protocol', 'outcome')`,
          [USER_A],
        ),
      );
    });
  });

  test("direct authenticated update is allowlisted to title and description only", async () => {
    const strategy = await createStrategy(USER_A, "editable");

    await asUser(USER_A, async () => {
      const updated = await pg.query<{ title: string; description: string }>(
        `update public.strategies
         set title = 'renamed', description = 'rewritten'
         where id = $1
         returning title, description`,
        [strategy.id],
      );
      expect(updated.rows[0]).toEqual({ title: "renamed", description: "rewritten" });

      const forbiddenUpdates = [
        "update public.strategies set context_trigger = 'forged' where id = $1",
        "update public.strategies set action_protocol = 'forged' where id = $1",
        "update public.strategies set expected_outcome = 'forged' where id = $1",
        "update public.strategies set version = 2 where id = $1",
        "update public.strategies set lifecycle_status = 'SUPPORTED' where id = $1",
        "update public.strategies set confidence_level = 'VERY_HIGH' where id = $1",
        "update public.strategies set user_id = $2 where id = $1",
        "update public.strategies set created_at = clock_timestamp() where id = $1",
        "update public.strategies set updated_at = clock_timestamp() where id = $1",
      ];

      for (const sql of forbiddenUpdates) {
        await expectDbFailure(() => pg.query(sql, [strategy.id, USER_B]));
      }
    });
  });

  test("direct authenticated Strategy DELETE is denied", async () => {
    const strategy = await createStrategy(USER_A, "delete denied");

    await asUser(USER_A, async () => {
      await expectDbFailure(() => pg.query("delete from public.strategies where id = $1", [strategy.id]));
      const preserved = await pg.query("select id from public.strategies where id = $1", [strategy.id]);
      expect(preserved.rowCount).toBe(1);
    });
  });

  test("direct authenticated writes to strategy_versions are denied", async () => {
    const strategy = await createStrategy(USER_A, "version direct write");

    await asUser(USER_A, async () => {
      await expectDbFailure(() =>
        pg.query(
          `insert into public.strategy_versions
             (user_id, strategy_id, version_number, action_protocol, context_trigger, expected_outcome)
           values ($1, $2, 2, 'p2', 'c2', 'o2')`,
          [USER_A, strategy.id],
        ),
      );
      await expectDbFailure(() =>
        pg.query("update public.strategy_versions set action_protocol = 'forged' where id = $1", [
          strategy.versionId,
        ]),
      );
      await expectDbFailure(() =>
        pg.query("delete from public.strategy_versions where id = $1", [strategy.versionId]),
      );
    });
  });

  test("direct authenticated writes to strategy_supports are denied", async () => {
    const strategy = await createStrategy(USER_A, "support direct write");
    const supportId = await insertSupportAsDatabaseAuthority({
      userId: USER_A,
      strategyId: strategy.id,
      versionId: strategy.versionId,
      sourceId: JOURNAL_A,
    });

    await asUser(USER_A, async () => {
      await expectDbFailure(() =>
        pg.query(
          `insert into public.strategy_supports
             (
               user_id, strategy_id, strategy_version_id, observation_type,
               source_class, source_id, evaluator_version, observed_at
             )
           values ($1, $2, $3, 'SUPPORT', 'JOURNAL_CONTEXT', $4, 'direct-client', clock_timestamp())`,
          [USER_A, strategy.id, strategy.versionId, JOURNAL_A],
        ),
      );
      await expectDbFailure(() =>
        pg.query("update public.strategy_supports set note = 'forged' where id = $1", [supportId]),
      );
      await expectDbFailure(() => pg.query("delete from public.strategy_supports where id = $1", [supportId]));
    });
  });

  test("RLS isolates strategies, versions, and supports by tenant", async () => {
    const strategyA = await createStrategy(USER_A, "tenant A");
    const strategyB = await createStrategy(USER_B, "tenant B");
    const supportA = await insertSupportAsDatabaseAuthority({
      userId: USER_A,
      strategyId: strategyA.id,
      versionId: strategyA.versionId,
      sourceId: JOURNAL_A,
    });
    const supportB = await insertSupportAsDatabaseAuthority({
      userId: USER_B,
      strategyId: strategyB.id,
      versionId: strategyB.versionId,
      sourceId: JOURNAL_B,
    });

    await asUser(USER_A, async () => {
      const strategies = await pg.query<{ id: string }>(
        "select id from public.strategies where id in ($1, $2) order by id",
        [strategyA.id, strategyB.id],
      );
      const versions = await pg.query<{ id: string }>(
        "select id from public.strategy_versions where id in ($1, $2) order by id",
        [strategyA.versionId, strategyB.versionId],
      );
      const supports = await pg.query<{ id: string }>(
        "select id from public.strategy_supports where id in ($1, $2) order by id",
        [supportA, supportB],
      );

      expect(strategies.rows.map((row) => row.id)).toEqual([strategyA.id]);
      expect(versions.rows.map((row) => row.id)).toEqual([strategyA.versionId]);
      expect(supports.rows.map((row) => row.id)).toEqual([supportA]);
    });
  });

  test("strategy_version tenant guard rejects owner mismatch", async () => {
    const strategyA = await createStrategy(USER_A, "version tenant");

    await expectDbFailure(() =>
      pg.query(
        `insert into public.strategy_versions
           (user_id, strategy_id, version_number, action_protocol, context_trigger, expected_outcome)
         values ($1, $2, 2, 'p2', 'c2', 'o2')`,
        [USER_B, strategyA.id],
      ),
    );
  });

  test("support guard rejects Strategy/version/user mismatch", async () => {
    const strategyA = await createStrategy(USER_A, "support A");
    const strategyA2 = await createStrategy(USER_A, "support A2");
    const strategyB = await createStrategy(USER_B, "support B");

    await expectDbFailure(() =>
      insertSupportAsDatabaseAuthority({
        userId: USER_A,
        strategyId: strategyB.id,
        versionId: strategyA.versionId,
        sourceId: JOURNAL_A,
      }),
    );
    await expectDbFailure(() =>
      insertSupportAsDatabaseAuthority({
        userId: USER_A,
        strategyId: strategyA.id,
        versionId: strategyA2.versionId,
        sourceId: JOURNAL_A,
      }),
    );
    await expectDbFailure(() =>
      insertSupportAsDatabaseAuthority({
        userId: USER_A,
        strategyId: strategyA.id,
        versionId: strategyB.versionId,
        sourceId: JOURNAL_A,
      }),
    );
    await expectDbFailure(() =>
      insertSupportAsDatabaseAuthority({
        userId: USER_B,
        strategyId: strategyA.id,
        versionId: strategyA.versionId,
        sourceId: JOURNAL_B,
      }),
    );
  });

  test("all canonical source branches accept owned rows and reject foreign or class-mismatched rows", async () => {
    const strategyA = await createStrategy(USER_A, "all source branches");
    const cases: Array<{
      sourceClass: StrategySourceClass;
      owned: string;
      foreign: string;
      mismatched: string;
    }> = [
      { sourceClass: "SEASON_REVIEW", owned: REVIEW_A, foreign: REVIEW_B, mismatched: ACTIVITY_A },
      { sourceClass: "ACTIVITY", owned: ACTIVITY_A, foreign: ACTIVITY_B, mismatched: QUEST_A },
      { sourceClass: "QUEST_OUTCOME", owned: QUEST_A, foreign: QUEST_B, mismatched: ARTIFACT_A },
      { sourceClass: "ARTIFACT", owned: ARTIFACT_A, foreign: ARTIFACT_B, mismatched: EVIDENCE_A },
      {
        sourceClass: "CORE_EVIDENCE_REFERENCE",
        owned: EVIDENCE_A,
        foreign: EVIDENCE_B,
        mismatched: JOURNAL_A,
      },
    ];

    for (const source of cases) {
      await insertSupportAsDatabaseAuthority({
        userId: USER_A,
        strategyId: strategyA.id,
        versionId: strategyA.versionId,
        sourceId: source.owned,
        sourceClass: source.sourceClass,
      });
      await expectDbFailure(() =>
        insertSupportAsDatabaseAuthority({
          userId: USER_A,
          strategyId: strategyA.id,
          versionId: strategyA.versionId,
          sourceId: source.foreign,
          sourceClass: source.sourceClass,
        }),
      );
      await expectDbFailure(() =>
        insertSupportAsDatabaseAuthority({
          userId: USER_A,
          strategyId: strategyA.id,
          versionId: strategyA.versionId,
          sourceId: source.mismatched,
          sourceClass: source.sourceClass,
        }),
      );
    }
  });

  test("Journal-backed source guard rejects foreign and free-form manual UUIDs", async () => {
    const strategyA = await createStrategy(USER_A, "journal source");

    await expectDbFailure(() =>
      insertSupportAsDatabaseAuthority({
        userId: USER_A,
        strategyId: strategyA.id,
        versionId: strategyA.versionId,
        sourceId: JOURNAL_B,
        sourceClass: "JOURNAL_CONTEXT",
      }),
    );
    await expectDbFailure(() =>
      insertSupportAsDatabaseAuthority({
        userId: USER_A,
        strategyId: strategyA.id,
        versionId: strategyA.versionId,
        sourceId: "8d999999-aaaa-4000-a000-000000000099",
        sourceClass: "MANUAL_OBSERVATION",
      }),
    );

    const manual = await insertSupportAsDatabaseAuthority({
      userId: USER_A,
      strategyId: strategyA.id,
      versionId: strategyA.versionId,
      sourceId: JOURNAL_A,
      sourceClass: "MANUAL_OBSERVATION",
    });
    const stored = await pg.query<{ source_id: string; source_class: string }>(
      "select source_id, source_class from public.strategy_supports where id = $1",
      [manual],
    );
    expect(stored.rows[0]).toEqual({
      source_id: JOURNAL_A,
      source_class: "MANUAL_OBSERVATION",
    });
  });

  test("version and support rows remain immutable even under database authority", async () => {
    const strategyA = await createStrategy(USER_A, "immutable rows");
    const support = await insertSupportAsDatabaseAuthority({
      userId: USER_A,
      strategyId: strategyA.id,
      versionId: strategyA.versionId,
      sourceId: JOURNAL_A,
    });

    await expectDbFailure(() =>
      pg.query("update public.strategy_versions set action_protocol = 'mutated' where id = $1", [
        strategyA.versionId,
      ]),
    );
    await expectDbFailure(() =>
      pg.query("delete from public.strategy_versions where id = $1", [strategyA.versionId]),
    );
    await expectDbFailure(() =>
      pg.query("update public.strategy_supports set note = 'mutated' where id = $1", [support]),
    );
    await expectDbFailure(() => pg.query("delete from public.strategy_supports where id = $1", [support]));
  });

  test("frozen storage uniqueness rejects exact replay of a support identity", async () => {
    const strategyA = await createStrategy(USER_A, "storage unique");

    await insertSupportAsDatabaseAuthority({
      userId: USER_A,
      strategyId: strategyA.id,
      versionId: strategyA.versionId,
      sourceId: JOURNAL_A,
      sourceClass: "JOURNAL_CONTEXT",
      evaluatorVersion: "storage-identity-v1",
    });

    await expectDbFailure(() =>
      insertSupportAsDatabaseAuthority({
        userId: USER_A,
        strategyId: strategyA.id,
        versionId: strategyA.versionId,
        sourceId: JOURNAL_A,
        sourceClass: "JOURNAL_CONTEXT",
        evaluatorVersion: "storage-identity-v1",
      }),
    );
  });
});
