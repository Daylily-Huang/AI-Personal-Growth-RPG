import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "8c111111-aaaa-4000-a000-000000000001";
const USER_B = "8c222222-bbbb-4000-b000-000000000002";
const QUEST_A = "8ca00001-aaaa-4000-a000-000000000001";
const QUEST_A_DELETE = "8ca00002-aaaa-4000-a000-000000000002";
const QUEST_A_FAILURE_DELETE = "8ca00003-aaaa-4000-a000-000000000003";
const QUEST_B = "8cb00001-bbbb-4000-b000-000000000001";
const SEASON_A = "8cc00001-aaaa-4000-a000-000000000001";
const SEASON_A_DELETE = "8cc00002-aaaa-4000-a000-000000000002";
const SEASON_B = "8cd00001-bbbb-4000-b000-000000000001";
const ACTIVITY_A = "8ce00001-aaaa-4000-a000-000000000001";
const ACTIVITY_B = "8cf00001-bbbb-4000-b000-000000000001";
const JOURNAL_FIXED = "8c900001-aaaa-4000-a000-000000000001";
const SKILL_A = "8c700001-aaaa-4000-a000-000000000001";

const ENTRY_TYPES = [
  "FREE_REFLECTION",
  "QUEST_REFLECTION",
  "DAILY_SUMMARY",
  "WEEKLY_REFLECTION",
  "SEASON_REFLECTION",
  "STATE_LOG",
  "DECISION_NOTE",
  "FAILURE_POSTMORTEM",
  "INSIGHT",
] as const;

describe.skipIf(!DATABASE_URL)("Phase 8C Round 1 — Journal DB foundation authority", () => {
  let pg: Client;

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
      "delete from public.journal_entries where user_id in ($1, $2)",
      "delete from public.activities where user_id in ($1, $2)",
      "delete from public.season_quests where user_id in ($1, $2)",
      "delete from public.seasons where user_id in ($1, $2)",
      "delete from public.quests where user_id in ($1, $2)",
      "delete from public.skills where user_id in ($1, $2)",
      "delete from public.player_states where user_id in ($1, $2)",
      "delete from auth.users where id in ($1, $2)",
    ];

    for (const statement of statements) {
      await pg.query(statement, [USER_A, USER_B]);
    }
  }

  async function snapshotPermanentGrowthState() {
    const player = await pg.query<{ total_xp: string; player_level: number }>(
      `select total_xp::text as total_xp, player_level
       from public.player_states
       where user_id = $1`,
      [USER_A],
    );
    const skills = await pg.query<{
      id: string;
      xp: string;
      level: number;
      mastery_level: number;
      mastery_confidence: string;
    }>(
      `select id, xp::text as xp, level, mastery_level, mastery_confidence::text as mastery_confidence
       from public.skills
       where user_id = $1
       order by id`,
      [USER_A],
    );
    const quests = await pg.query<{ id: string; status: string }>(
      `select id, status
       from public.quests
       where user_id = $1 and id = $2`,
      [USER_A, QUEST_A],
    );
    const events = await pg.query<{ xp: string; evidence: string; mastery: string }>(
      `select
         (select count(*)::text from public.xp_transactions where user_id = $1) as xp,
         (select count(*)::text from public.evidence_records where user_id = $1) as evidence,
         (select count(*)::text from public.mastery_events where user_id = $1) as mastery`,
      [USER_A],
    );

    return {
      player: player.rows,
      skills: skills.rows,
      quests: quests.rows,
      events: events.rows[0]!,
    };
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();
    await cleanupFixtures();

    await pg.query(
      `insert into auth.users (id, email) values
         ($1, 'phase8c-a@example.test'),
         ($2, 'phase8c-b@example.test')`,
      [USER_A, USER_B],
    );

    await pg.query(
      `insert into public.player_states (user_id, total_xp, player_level)
       values ($1, 321, public.player_level_from_xp(321))
       on conflict (user_id) do update
       set total_xp = excluded.total_xp,
           player_level = excluded.player_level`,
      [USER_A],
    );

    await pg.query(
      `insert into public.skills
         (id, user_id, name, xp, level, mastery_level, mastery_confidence)
       values ($1, $2, 'Phase 8C invariant skill', 222, public.player_level_from_xp(222), 4, 0.73)`,
      [SKILL_A, USER_A],
    );

    await pg.query(
      `insert into public.quests (id, user_id, title, quest_type) values
         ($1, $4, 'A quest', 'reflection'),
         ($2, $4, 'A deletable quest', 'reflection'),
         ($3, $4, 'A failure parent quest', 'reflection'),
         ($5, $6, 'B quest', 'reflection')`,
      [QUEST_A, QUEST_A_DELETE, QUEST_A_FAILURE_DELETE, USER_A, QUEST_B, USER_B],
    );

    await pg.query(
      `insert into public.seasons (id, user_id, name, status) values
         ($1, $4, 'A season', 'DRAFT'),
         ($2, $4, 'A deletable season', 'DRAFT'),
         ($3, $5, 'B season', 'DRAFT')`,
      [SEASON_A, SEASON_A_DELETE, SEASON_B, USER_A, USER_B],
    );

    await pg.query(
      `insert into public.activities
         (id, user_id, quest_id, title, raw_input, rules_version)
       values
         ($1, $3, $4, 'A activity', 'A raw input', 'phase8c-test'),
         ($2, $5, $6, 'B activity', 'B raw input', 'phase8c-test')`,
      [ACTIVITY_A, ACTIVITY_B, USER_A, QUEST_A, USER_B, QUEST_B],
    );
  }, 45000);

  afterAll(async () => {
    if (!pg) return;
    await cleanupFixtures();
    await pg.end();
  });

  test("accepts all nine canonical entry types and rejects unknown taxonomy", async () => {
    await asUser(USER_A, async () => {
      for (const entryType of ENTRY_TYPES) {
        const seasonId = entryType === "SEASON_REFLECTION" ? SEASON_A : null;
        const questId = entryType === "QUEST_REFLECTION" || entryType === "FAILURE_POSTMORTEM" ? QUEST_A : null;
        const inserted = await pg.query<{ entry_type: string }>(
          `insert into public.journal_entries
             (user_id, entry_type, title, content_markdown, season_id, quest_id)
           values ($1, $2, $3, 'taxonomy test', $4, $5)
           returning entry_type`,
          [USER_A, entryType, entryType, seasonId, questId],
        );
        expect(inserted.rows[0]?.entry_type).toBe(entryType);
      }

      await expect(
        pg.query(
          `insert into public.journal_entries
             (user_id, entry_type, title, content_markdown)
           values ($1, 'NOT_A_REAL_TYPE', 'bad type', 'bad type')`,
          [USER_A],
        ),
      ).rejects.toThrow();
    });
  });

  test("enforces required authoring context at the authenticated database boundary", async () => {
    await asUser(USER_A, async () => {
      for (const entryType of ["QUEST_REFLECTION", "SEASON_REFLECTION", "FAILURE_POSTMORTEM"] as const) {
        await expect(
          pg.query(
            `insert into public.journal_entries
               (user_id, entry_type, title, content_markdown)
             values ($1, $2, $3, 'missing context')`,
            [USER_A, entryType, `missing ${entryType}`],
          ),
        ).rejects.toThrow();
      }

      const questReflection = await pg.query<{ id: string }>(
        `insert into public.journal_entries
           (user_id, entry_type, title, content_markdown, quest_id)
         values ($1, 'QUEST_REFLECTION', 'db quest context', 'valid', $2)
         returning id`,
        [USER_A, QUEST_A],
      );
      const seasonReflection = await pg.query<{ id: string }>(
        `insert into public.journal_entries
           (user_id, entry_type, title, content_markdown, season_id)
         values ($1, 'SEASON_REFLECTION', 'db season context', 'valid', $2)
         returning id`,
        [USER_A, SEASON_A],
      );
      const failurePostmortem = await pg.query<{ id: string }>(
        `insert into public.journal_entries
           (user_id, entry_type, title, content_markdown, quest_id)
         values ($1, 'FAILURE_POSTMORTEM', 'db failure context', 'valid', $2)
         returning id`,
        [USER_A, QUEST_A],
      );
      const freeReflection = await pg.query<{ id: string }>(
        `insert into public.journal_entries
           (user_id, entry_type, title, content_markdown)
         values ($1, 'FREE_REFLECTION', 'db type change', 'valid')
         returning id`,
        [USER_A],
      );

      await expect(
        pg.query("update public.journal_entries set quest_id = null where id = $1", [questReflection.rows[0]!.id]),
      ).rejects.toThrow();
      await expect(
        pg.query("update public.journal_entries set season_id = null where id = $1", [seasonReflection.rows[0]!.id]),
      ).rejects.toThrow();
      await expect(
        pg.query("update public.journal_entries set quest_id = null where id = $1", [failurePostmortem.rows[0]!.id]),
      ).rejects.toThrow();
      await expect(
        pg.query("update public.journal_entries set entry_type = 'QUEST_REFLECTION' where id = $1", [
          freeReflection.rows[0]!.id,
        ]),
      ).rejects.toThrow();
    });
  });

  test("accepts scalar boundaries and rejects out-of-range values", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(
          `insert into public.journal_entries
             (user_id, entry_type, title, content_markdown,
              energy, focus, stress, resistance, recovery, mood_valence, self_confidence)
           values ($1, 'STATE_LOG', 'lower bounds', 'state', 1, 1, 1, 1, 1, -2, 1),
                  ($1, 'STATE_LOG', 'upper bounds', 'state', 5, 5, 5, 5, 5, 2, 5)`,
          [USER_A],
        ),
      ).resolves.toBeDefined();

      for (const [column, value] of [
        ["energy", 0],
        ["focus", 6],
        ["stress", 0],
        ["resistance", 6],
        ["recovery", 0],
        ["mood_valence", 3],
        ["self_confidence", 6],
      ] as const) {
        await expect(
          pg.query(
            `insert into public.journal_entries
               (user_id, entry_type, title, content_markdown, ${column})
             values ($1, 'STATE_LOG', 'invalid scalar', 'state', $2)`,
            [USER_A, value],
          ),
        ).rejects.toThrow();
      }
    });
  });

  test("isolates SELECT by tenant and lets only the owner archive/unarchive", async () => {
    await pg.query(
      `insert into public.journal_entries (user_id, entry_type, title, content_markdown)
       values ($1, 'FREE_REFLECTION', 'A private', 'A'),
              ($2, 'FREE_REFLECTION', 'B private', 'B')`,
      [USER_A, USER_B],
    );

    await asUser(USER_A, async () => {
      const rows = await pg.query<{ user_id: string; title: string }>(
        "select user_id, title from public.journal_entries where title in ('A private', 'B private') order by title",
      );
      expect(rows.rows).toEqual([{ user_id: USER_A, title: "A private" }]);

      const archived = await pg.query<{ is_archived: boolean }>(
        "update public.journal_entries set is_archived = true where title = 'A private' returning is_archived",
      );
      expect(archived.rows[0]?.is_archived).toBe(true);

      const unarchived = await pg.query<{ is_archived: boolean }>(
        "update public.journal_entries set is_archived = false where title = 'A private' returning is_archived",
      );
      expect(unarchived.rows[0]?.is_archived).toBe(false);

      const foreignUpdate = await pg.query(
        "update public.journal_entries set is_archived = true where title = 'B private'",
      );
      expect(foreignUpdate.rowCount).toBe(0);

      const foreignDelete = await pg.query("delete from public.journal_entries where title = 'B private'");
      expect(foreignDelete.rowCount).toBe(0);
    });

    const preservedForeignRow = await pg.query<{ id: string }>(
      "select id from public.journal_entries where user_id = $1 and title = 'B private'",
      [USER_B],
    );
    expect(preservedForeignRow.rowCount).toBe(1);
  });

  test("O018_CROSS_TENANT_OUTER_LINKS_FAIL_CLOSED rejects forged season, quest, and activity links", async () => {
    await asUser(USER_A, async () => {
      for (const [column, foreignId] of [
        ["season_id", SEASON_B],
        ["quest_id", QUEST_B],
        ["activity_id", ACTIVITY_B],
      ] as const) {
        await expect(
          pg.query(
            `insert into public.journal_entries
               (user_id, entry_type, title, content_markdown, ${column})
             values ($1, 'FREE_REFLECTION', 'forged insert', 'x', $2)`,
            [USER_A, foreignId],
          ),
        ).rejects.toThrow();
      }

      const own = await pg.query<{ id: string }>(
        `insert into public.journal_entries
           (user_id, entry_type, title, content_markdown, season_id, quest_id, activity_id)
         values ($1, 'FREE_REFLECTION', 'own contexts', 'x', $2, $3, $4)
         returning id`,
        [USER_A, SEASON_A, QUEST_A, ACTIVITY_A],
      );

      for (const [column, foreignId] of [
        ["season_id", SEASON_B],
        ["quest_id", QUEST_B],
        ["activity_id", ACTIVITY_B],
      ] as const) {
        await expect(
          pg.query(`update public.journal_entries set ${column} = $1 where id = $2`, [
            foreignId,
            own.rows[0]!.id,
          ]),
        ).rejects.toThrow();
      }
    });
  });

  test("protects immutable fields and system-manages updated_at", async () => {
    await asUser(USER_A, async () => {
      const row = await pg.query<{ id: string; created_at: Date; updated_at: Date }>(
        `insert into public.journal_entries
           (user_id, entry_type, title, content_markdown)
         values ($1, 'FREE_REFLECTION', 'authority', 'before')
         returning id, created_at, updated_at`,
        [USER_A],
      );
      const journal = row.rows[0]!;

      await expect(
        pg.query("update public.journal_entries set id = $1 where id = $2", [JOURNAL_FIXED, journal.id]),
      ).rejects.toThrow();
      await expect(
        pg.query("update public.journal_entries set user_id = $1 where id = $2", [USER_B, journal.id]),
      ).rejects.toThrow();
      await expect(
        pg.query("update public.journal_entries set created_at = created_at - interval '1 day' where id = $1", [
          journal.id,
        ]),
      ).rejects.toThrow();
      await expect(
        pg.query("update public.journal_entries set updated_at = updated_at - interval '1 day' where id = $1", [
          journal.id,
        ]),
      ).rejects.toThrow();

      const edited = await pg.query<{ created_at: Date; updated_at: Date }>(
        "update public.journal_entries set content_markdown = 'after' where id = $1 returning created_at, updated_at",
        [journal.id],
      );
      expect(edited.rows[0]!.created_at.getTime()).toBe(journal.created_at.getTime());
      expect(edited.rows[0]!.updated_at.getTime()).toBeGreaterThanOrEqual(journal.updated_at.getTime());
    });
  });

  test("supports client-generated UUID creation and rejects duplicate primary keys", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(
          `insert into public.journal_entries
             (id, user_id, entry_type, title, content_markdown)
           values ($1, $2, 'FREE_REFLECTION', 'client uuid', 'x')`,
          [JOURNAL_FIXED, USER_A],
        ),
      ).resolves.toBeDefined();

      await expect(
        pg.query(
          `insert into public.journal_entries
             (id, user_id, entry_type, title, content_markdown)
           values ($1, $2, 'FREE_REFLECTION', 'duplicate uuid', 'x')`,
          [JOURNAL_FIXED, USER_A],
        ),
      ).rejects.toThrow();
    });
  });

  test("ON DELETE SET NULL preserves required-context history and allows ordinary edits/archive", async () => {
    const rows = await pg.query<{ id: string; title: string }>(
      `insert into public.journal_entries
         (user_id, entry_type, title, content_markdown, season_id, quest_id,
          energy, focus, stress, resistance, recovery, mood_valence, self_confidence)
       values
         ($1, 'QUEST_REFLECTION', 'quest parent deletion', 'quest history', null, $2, 1, 2, 3, 4, 5, -2, 1),
         ($1, 'SEASON_REFLECTION', 'season parent deletion', 'season history', $3, null, 5, 4, 3, 2, 1, 2, 5),
         ($1, 'FAILURE_POSTMORTEM', 'failure parent deletion', 'failure history', null, $4, 3, 3, 5, 1, 2, 0, 4)
       returning id, title`,
      [USER_A, QUEST_A_DELETE, SEASON_A_DELETE, QUEST_A_FAILURE_DELETE],
    );

    const ids = rows.rows.map((row) => row.id);
    const journalStateBefore = await pg.query(
      `select id, energy, focus, stress, resistance, recovery, mood_valence, self_confidence
       from public.journal_entries
       where id = any($1::uuid[])
       order by id`,
      [ids],
    );
    const growthBefore = await snapshotPermanentGrowthState();

    await asUser(USER_A, async () => {
      await pg.query("delete from public.quests where id = $1", [QUEST_A_DELETE]);
      await pg.query("delete from public.quests where id = $1", [QUEST_A_FAILURE_DELETE]);
      await pg.query("delete from public.seasons where id = $1", [SEASON_A_DELETE]);

      const remaining = await pg.query<{
        title: string;
        quest_id: string | null;
        season_id: string | null;
      }>(
        `select title, quest_id, season_id
         from public.journal_entries
         where id = any($1::uuid[])
         order by title`,
        [ids],
      );

      expect(remaining.rows).toEqual([
        { title: "failure parent deletion", quest_id: null, season_id: null },
        { title: "quest parent deletion", quest_id: null, season_id: null },
        { title: "season parent deletion", quest_id: null, season_id: null },
      ]);

      const edited = await pg.query(
        `update public.journal_entries
         set content_markdown = content_markdown || ' edited', is_archived = true
         where id = any($1::uuid[])`,
        [ids],
      );
      expect(edited.rowCount).toBe(3);

      const unarchived = await pg.query(
        `update public.journal_entries
         set is_archived = false
         where id = any($1::uuid[])`,
        [ids],
      );
      expect(unarchived.rowCount).toBe(3);
    });

    const journalStateAfter = await pg.query(
      `select id, energy, focus, stress, resistance, recovery, mood_valence, self_confidence
       from public.journal_entries
       where id = any($1::uuid[])
       order by id`,
      [ids],
    );
    expect(journalStateAfter.rows).toEqual(journalStateBefore.rows);

    const archiveState = await pg.query<{ is_archived: boolean }>(
      `select is_archived
       from public.journal_entries
       where id = any($1::uuid[])
       order by id`,
      [ids],
    );
    expect(archiveState.rows).toEqual([
      { is_archived: false },
      { is_archived: false },
      { is_archived: false },
    ]);
    expect(await snapshotPermanentGrowthState()).toEqual(growthBefore);
  });

  test("O007_JOURNAL_NOT_EVIDENCE_BY_DEFAULT and C011_JOURNAL_STATE_NOT_CAPABILITY", async () => {
    const before = await snapshotPermanentGrowthState();

    await asUser(USER_A, async () => {
      const inserted = await pg.query<{ id: string }>(
        `insert into public.journal_entries
           (user_id, entry_type, title, content_markdown,
            energy, focus, stress, resistance, recovery, mood_valence, self_confidence)
         values
           ($1, 'STATE_LOG', 'lower boundary state', 'state', 1, 1, 1, 1, 1, -2, 1),
           ($1, 'STATE_LOG', 'upper boundary state', 'state', 5, 5, 5, 5, 5, 2, 5)
         returning id`,
        [USER_A],
      );
      const ids = inserted.rows.map((row) => row.id);
      await pg.query("update public.journal_entries set is_archived = true where id = any($1::uuid[])", [ids]);
      await pg.query("update public.journal_entries set is_archived = false where id = any($1::uuid[])", [ids]);
    });

    expect(await snapshotPermanentGrowthState()).toEqual(before);
  });
});
