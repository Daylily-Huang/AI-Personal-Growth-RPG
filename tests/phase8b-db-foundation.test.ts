import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "8b111111-aaaa-4000-a000-000000000001";
const USER_B = "8b222222-bbbb-4000-b000-000000000002";
const QUEST_A1 = "8ba00001-aaaa-4000-a000-000000000001";
const QUEST_A2 = "8ba00002-aaaa-4000-a000-000000000002";
const QUEST_B1 = "8bb00001-bbbb-4000-b000-000000000001";
const SEASON_A1 = "8bc00001-aaaa-4000-a000-000000000001";
const SEASON_A2 = "8bc00002-aaaa-4000-a000-000000000002";
const SEASON_A_TERMINAL = "8bc00003-aaaa-4000-a000-000000000003";
const SEASON_B1 = "8bd00001-bbbb-4000-b000-000000000001";

describe.skipIf(!DATABASE_URL)("Phase 8B Round 1 — DB foundation authority", () => {
  let pg: Client;

  async function cleanupFixtures(): Promise<void> {
    const cleanupStatements = [
      "delete from public.season_reviews where user_id in ($1, $2)",
      "delete from public.season_quests where user_id in ($1, $2)",
      "delete from public.outer_loop_audit_events where user_id in ($1, $2)",
      "delete from public.outer_loop_proposals where user_id in ($1, $2)",
      "delete from public.seasons where user_id in ($1, $2)",
      "delete from public.quests where user_id in ($1, $2)",
      "delete from auth.users where id in ($1, $2)",
    ];

    for (const statement of cleanupStatements) {
      await pg.query(statement, [USER_A, USER_B]);
    }
  }

  async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await pg.query("set role authenticated");
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    try {
      return await fn();
    } finally {
      await pg.query("reset role");
    }
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    await cleanupFixtures();

    await pg.query(
      `insert into auth.users (id, email) values
         ($1, 'phase8b-a@example.test'),
         ($2, 'phase8b-b@example.test')`,
      [USER_A, USER_B],
    );

    await pg.query(
      `insert into public.quests (id, user_id, title, quest_type) values
         ($1, $4, 'A main quest', 'production'),
         ($2, $4, 'A focus quest', 'production'),
         ($3, $5, 'B quest', 'production')`,
      [QUEST_A1, QUEST_A2, QUEST_B1, USER_A, USER_B],
    );

    await pg.query(
      `insert into public.seasons
         (id, user_id, name, status, planned_start_date, target_duration_days, success_criteria, started_at, ended_at)
       values
         ($1, $4, 'A active season', 'ACTIVE', current_date, 28, '[]'::jsonb, clock_timestamp(), null),
         ($2, $4, 'A planned season', 'PLANNED', current_date + 28, 28, '[]'::jsonb, null, null),
         ($3, $4, 'A completed season', 'COMPLETED', current_date - 28, 28, '[]'::jsonb, clock_timestamp() - interval '28 days', clock_timestamp()),
         ($5, $6, 'B active season', 'ACTIVE', current_date, 28, '[]'::jsonb, clock_timestamp(), null)`,
      [SEASON_A1, SEASON_A2, SEASON_A_TERMINAL, USER_A, SEASON_B1, USER_B],
    );

    await pg.query(
      `insert into public.season_quests (user_id, season_id, quest_id, role) values
         ($1, $2, $3, 'MAIN'),
         ($1, $2, $4, 'FOCUS'),
         ($1, $5, $3, 'FOCUS'),
         ($6, $7, $8, 'MAIN')`,
      [USER_A, SEASON_A1, QUEST_A1, QUEST_A2, SEASON_A2, USER_B, SEASON_B1, QUEST_B1],
    );

    await pg.query(
      `insert into public.outer_loop_proposals
         (user_id, proposal_type, schema_version, payload, expires_at)
       values
         ($1, 'SEASON_PLAN', 1, '{"title":"A"}'::jsonb, clock_timestamp() + interval '14 days'),
         ($2, 'SEASON_PLAN', 1, '{"title":"B"}'::jsonb, clock_timestamp() + interval '14 days')`,
      [USER_A, USER_B],
    );

    await pg.query(
      `insert into public.outer_loop_audit_events
         (user_id, event_type, entity_type, entity_id, request_idempotency_key, policy_version, schema_version)
       values
         ($1, 'TEST_EVENT', 'seasons', $2, 'phase8b-audit-a', 'phase8b-v1', '1'),
         ($3, 'TEST_EVENT', 'seasons', $4, 'phase8b-audit-b', 'phase8b-v1', '1')`,
      [USER_A, SEASON_A1, USER_B, SEASON_B1],
    );

    await pg.query(
      `insert into public.season_reviews
         (user_id, season_id, review_type, version, commit_key, period_start, period_end,
          objective_summary, qualitative_reflection, criteria_evaluation)
       values
         ($1, $2, 'WEEKLY', 1, '8be00001-aaaa-4000-a000-000000000001', clock_timestamp() - interval '7 days', clock_timestamp(),
          '{}'::jsonb, 'A reflection', '[]'::jsonb),
         ($3, $4, 'WEEKLY', 1, '8be00002-bbbb-4000-b000-000000000001', clock_timestamp() - interval '7 days', clock_timestamp(),
          '{}'::jsonb, 'B reflection', '[]'::jsonb)`,
      [USER_A, SEASON_A1, USER_B, SEASON_B1],
    );
  }, 45000);

  afterAll(async () => {
    if (!pg) return;
    await cleanupFixtures();
    await pg.end();
  });

  test("O013_ONLY_ONE_ACTIVE_SEASON_PER_USER", async () => {
    await expect(
      pg.query(
        `insert into public.seasons
           (user_id, name, status, planned_start_date, target_duration_days, success_criteria, started_at)
         values ($1, 'Second active', 'ACTIVE', current_date, 28, '[]'::jsonb, clock_timestamp())`,
        [USER_A],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  test("O014_SEASON_QUEST_IS_N_TO_N and MAIN remains 0..1", async () => {
    const links = await pg.query(
      `select season_id, quest_id, role
       from public.season_quests
       where user_id = $1
       order by season_id, quest_id`,
      [USER_A],
    );
    expect(links.rows).toHaveLength(3);
    expect(links.rows.filter((r) => r.quest_id === QUEST_A1)).toHaveLength(2);
    expect(links.rows.filter((r) => r.season_id === SEASON_A1)).toHaveLength(2);

    await expect(
      pg.query(
        `update public.season_quests
         set role = 'MAIN'
         where season_id = $1 and quest_id = $2`,
        [SEASON_A1, QUEST_A2],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  test("season_quests tenant guard fails closed on forged cross-tenant link", async () => {
    await expect(
      pg.query(
        `insert into public.season_quests (user_id, season_id, quest_id, role)
         values ($1, $2, $3, 'FOCUS')`,
        [USER_A, SEASON_A2, QUEST_B1],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  test("O022_TERMINAL_SEASON_HISTORY_NOT_HARD_DELETED", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(`delete from public.seasons where id = $1`, [SEASON_A_TERMINAL]),
      ).rejects.toThrow(/reached ACTIVE/i);
    });
  });

  test("authenticated clients can create/edit only DRAFT season metadata", async () => {
    await asUser(USER_A, async () => {
      const created = await pg.query(
        `insert into public.seasons (user_id, name, description)
         values ($1, 'Draft season', 'draft') returning id, status`,
        [USER_A],
      );
      expect(created.rows[0].status).toBe("DRAFT");

      const draftId = created.rows[0].id;
      const updated = await pg.query(
        `update public.seasons set name = 'Draft season renamed' where id = $1 returning name`,
        [draftId],
      );
      expect(updated.rows[0].name).toBe("Draft season renamed");

      await expect(
        pg.query(`update public.seasons set status = 'PLANNED' where id = $1`, [draftId]),
      ).rejects.toThrow();

      await pg.query(`delete from public.seasons where id = $1`, [draftId]);
    });

    await asUser(USER_A, async () => {
      await expect(
        pg.query(`update public.seasons set name = 'mutated planned' where id = $1`, [SEASON_A2]),
      ).rejects.toThrow(/only while DRAFT/i);
    });
  });

  test("all five Phase 8B tables enforce tenant-isolated SELECT", async () => {
    await asUser(USER_A, async () => {
      const [proposals, audits, seasons, links, reviews] = await Promise.all([
        pg.query(`select user_id from public.outer_loop_proposals`),
        pg.query(`select user_id from public.outer_loop_audit_events`),
        pg.query(`select user_id from public.seasons`),
        pg.query(`select user_id from public.season_quests`),
        pg.query(`select user_id from public.season_reviews`),
      ]);

      for (const result of [proposals, audits, seasons, links, reviews]) {
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows.every((row) => row.user_id === USER_A)).toBe(true);
      }
    });
  });

  test("RPC-only tables reject direct authenticated mutation", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(
          `insert into public.outer_loop_proposals
             (user_id, proposal_type, schema_version, payload)
           values ($1, 'SEASON_PLAN', 1, '{}'::jsonb)`,
          [USER_A],
        ),
      ).rejects.toThrow();

      await expect(
        pg.query(
          `insert into public.outer_loop_audit_events
             (user_id, event_type, entity_type, request_idempotency_key, policy_version, schema_version)
           values ($1, 'FORGED', 'seasons', 'forged-audit', 'phase8b-v1', '1')`,
          [USER_A],
        ),
      ).rejects.toThrow();

      await expect(
        pg.query(
          `insert into public.season_quests (user_id, season_id, quest_id, role)
           values ($1, $2, $3, 'FOCUS')`,
          [USER_A, SEASON_A2, QUEST_A2],
        ),
      ).rejects.toThrow();

      await expect(
        pg.query(
          `insert into public.season_reviews
             (user_id, season_id, review_type, version, commit_key, period_start, period_end,
              objective_summary, qualitative_reflection, criteria_evaluation)
           values ($1, $2, 'AD_HOC', 1, gen_random_uuid(), clock_timestamp(), clock_timestamp(),
                   '{}'::jsonb, 'forged', '[]'::jsonb)`,
          [USER_A, SEASON_A1],
        ),
      ).rejects.toThrow();
    });
  });

  test("season review content is immutable and supersession is one-time", async () => {
    const existing = await pg.query(
      `select id from public.season_reviews where user_id = $1 and season_id = $2 and review_type = 'WEEKLY'`,
      [USER_A, SEASON_A1],
    );
    const firstId = existing.rows[0].id;

    await expect(
      pg.query(
        `update public.season_reviews set qualitative_reflection = 'rewritten' where id = $1`,
        [firstId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const second = await pg.query(
      `insert into public.season_reviews
         (user_id, season_id, review_type, version, commit_key, period_start, period_end,
          objective_summary, qualitative_reflection, criteria_evaluation)
       values ($1, $2, 'WEEKLY', 2, '8be00003-aaaa-4000-a000-000000000003', clock_timestamp() - interval '7 days', clock_timestamp(),
               '{}'::jsonb, 'A reflection v2', '[]'::jsonb)
       returning id`,
      [USER_A, SEASON_A1],
    );

    await pg.query(
      `update public.season_reviews set superseded_by_id = $1 where id = $2`,
      [second.rows[0].id, firstId],
    );

    await expect(
      pg.query(
        `update public.season_reviews set superseded_by_id = null where id = $1`,
        [firstId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
