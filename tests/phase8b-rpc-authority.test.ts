import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "8b311111-aaaa-4000-a000-000000000001";
const USER_B = "8b322222-bbbb-4000-b000-000000000002";
const DOMAIN_A = "8b330001-aaaa-4000-a000-000000000001";
const SKILL_A = "8b340001-aaaa-4000-a000-000000000001";
const QUEST_A1 = "8b350001-aaaa-4000-a000-000000000001";
const QUEST_A2 = "8b350002-aaaa-4000-a000-000000000002";
const QUEST_B1 = "8b350001-bbbb-4000-b000-000000000001";
const ACTIVITY_A = "8b360001-aaaa-4000-a000-000000000001";
const EVIDENCE_A = "8b370001-aaaa-4000-a000-000000000001";

describe.skipIf(!DATABASE_URL)("Phase 8B Round 2 — deterministic RPC authority", () => {
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

  async function createUserClient(userId: string): Promise<Client> {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    return client;
  }

  async function insertDraftSeason(name: string): Promise<string> {
    const result = await pg.query(
      `insert into public.seasons (user_id, name) values ($1, $2) returning id`,
      [USER_A, name],
    );
    return result.rows[0].id;
  }

  async function planSeason(seasonId: string, key = `plan-${randomUUID()}`) {
    return asUser(USER_A, async () =>
      pg.query(
        `select public.rpc_plan_season($1, current_date, 28, $2::jsonb, $3) as result`,
        [seasonId, JSON.stringify([{ criterion: "ship" }]), key],
      ),
    );
  }

  async function activateSeason(seasonId: string, key = `activate-${randomUUID()}`) {
    return asUser(USER_A, async () =>
      pg.query(`select public.rpc_activate_season($1, $2) as result`, [seasonId, key]),
    );
  }

  async function coreSnapshot() {
    const [quest, activity, skill, evidence, counts] = await Promise.all([
      pg.query(`select to_jsonb(q) as row from public.quests q where id = $1`, [QUEST_A1]),
      pg.query(`select to_jsonb(a) as row from public.activities a where id = $1`, [ACTIVITY_A]),
      pg.query(`select to_jsonb(s) as row from public.skills s where id = $1`, [SKILL_A]),
      pg.query(`select to_jsonb(e) as row from public.evidence_records e where id = $1`, [EVIDENCE_A]),
      pg.query(
        `select
           (select count(*)::int from public.xp_transactions where user_id = $1) as xp_count,
           (select count(*)::int from public.mastery_events where user_id = $1) as mastery_event_count,
           (select count(*)::int from public.mastery_verifications where user_id = $1) as mastery_verification_count,
           (select count(*)::int from public.evidence_records where user_id = $1) as evidence_count,
           (select count(*)::int from public.activities where user_id = $1) as activity_count`,
        [USER_A],
      ),
    ]);
    return {
      quest: quest.rows[0]?.row,
      activity: activity.rows[0]?.row,
      skill: skill.rows[0]?.row,
      evidence: evidence.rows[0]?.row,
      counts: counts.rows[0],
    };
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    await pg.query(
      `
      delete from public.season_reviews where user_id in ($1, $2);
      delete from public.season_quests where user_id in ($1, $2);
      delete from public.outer_loop_audit_events where user_id in ($1, $2);
      delete from public.outer_loop_proposals where user_id in ($1, $2);
      delete from public.seasons where user_id in ($1, $2);
      delete from public.xp_transactions where user_id in ($1, $2);
      delete from public.mastery_verifications where user_id in ($1, $2);
      delete from public.mastery_events where user_id in ($1, $2);
      delete from public.evidence_records where user_id in ($1, $2);
      delete from public.activities where user_id in ($1, $2);
      delete from public.quests where user_id in ($1, $2);
      delete from public.skills where user_id in ($1, $2);
      delete from public.domains where user_id in ($1, $2);
      delete from auth.users where id in ($1, $2);
      `,
      [USER_A, USER_B],
    );

    await pg.query(
      `insert into auth.users (id, email) values
         ($1, 'phase8b-rpc-a@example.test'),
         ($2, 'phase8b-rpc-b@example.test')`,
      [USER_A, USER_B],
    );
    await pg.query(
      `insert into public.domains (id, user_id, name, slug)
       values ($1, $2, 'Phase8B Domain', 'phase8b-rpc-domain')`,
      [DOMAIN_A, USER_A],
    );
    await pg.query(
      `insert into public.skills (id, user_id, domain_id, name, xp, level, mastery_level, mastery_confidence)
       values ($1, $2, $3, 'Phase8B Skill', 42, 2, 2, 0.72)`,
      [SKILL_A, USER_A, DOMAIN_A],
    );
    await pg.query(
      `insert into public.quests (id, user_id, title, quest_type, status, progress) values
         ($1, $4, 'Quest A1', 'production', 'active', 37),
         ($2, $4, 'Quest A2', 'production', 'available', 0),
         ($3, $5, 'Quest B1', 'production', 'active', 12)`,
      [QUEST_A1, QUEST_A2, QUEST_B1, USER_A, USER_B],
    );
    await pg.query(
      `insert into public.activities
         (id, user_id, quest_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes, created_at)
       values ($1, $2, $3, 'Phase8B activity', 'Phase8B activity', 'study', 'confirmed', '1.0.0', 40, 35, clock_timestamp() - interval '1 day')`,
      [ACTIVITY_A, USER_A, QUEST_A1],
    );
    await pg.query(
      `insert into public.evidence_records
         (id, user_id, activity_id, skill_id, evidence_level, evidence_type, description, verified)
       values ($1, $2, $3, $4, 3, 'work_product', 'Phase8B frozen core evidence', true)`,
      [EVIDENCE_A, USER_A, ACTIVITY_A, SKILL_A],
    );
  }, 45000);

  afterAll(async () => {
    if (!pg) return;
    await pg.query("reset role");
    await pg.query(
      `
      delete from public.season_reviews where user_id in ($1, $2);
      delete from public.season_quests where user_id in ($1, $2);
      delete from public.outer_loop_audit_events where user_id in ($1, $2);
      delete from public.outer_loop_proposals where user_id in ($1, $2);
      delete from public.seasons where user_id in ($1, $2);
      delete from public.xp_transactions where user_id in ($1, $2);
      delete from public.mastery_verifications where user_id in ($1, $2);
      delete from public.mastery_events where user_id in ($1, $2);
      delete from public.evidence_records where user_id in ($1, $2);
      delete from public.activities where user_id in ($1, $2);
      delete from public.quests where user_id in ($1, $2);
      delete from public.skills where user_id in ($1, $2);
      delete from public.domains where user_id in ($1, $2);
      delete from auth.users where id in ($1, $2);
      `,
      [USER_A, USER_B],
    );
    await pg.end();
  });

  test("plan -> activate supports zero linked quests and exact replay", async () => {
    const seasonId = await insertDraftSeason("Zero quest season");
    const planKey = `plan-${randomUUID()}`;
    const activateKey = `activate-${randomUUID()}`;

    const planned = await planSeason(seasonId, planKey);
    expect(planned.rows[0].result.season.status).toBe("PLANNED");
    expect(planned.rows[0].result.replayed).toBe(false);

    const planReplay = await planSeason(seasonId, planKey);
    expect(planReplay.rows[0].result.replayed).toBe(true);

    const activated = await activateSeason(seasonId, activateKey);
    expect(activated.rows[0].result.season.status).toBe("ACTIVE");
    expect(activated.rows[0].result.season.started_at).toBeTruthy();

    const activationReplay = await activateSeason(seasonId, activateKey);
    expect(activationReplay.rows[0].result.replayed).toBe(true);

    await asUser(USER_A, async () => {
      const abandoned = await pg.query(
        `select public.rpc_conclude_season($1, 'ABANDONED', null, null, 'test cleanup', $2) as result`,
        [seasonId, `cleanup-${randomUUID()}`],
      );
      expect(abandoned.rows[0].result.season.status).toBe("ABANDONED");
    });
  });

  test("O013_ONLY_ONE_ACTIVE_SEASON_PER_USER — concurrent activation serializes", async () => {
    const seasonA = await insertDraftSeason("Concurrent A");
    const seasonB = await insertDraftSeason("Concurrent B");
    await planSeason(seasonA);
    await planSeason(seasonB);

    const clientA = await createUserClient(USER_A);
    const clientB = await createUserClient(USER_A);
    try {
      const [resultA, resultB] = await Promise.allSettled([
        clientA.query(`select public.rpc_activate_season($1, $2) as result`, [seasonA, `act-${randomUUID()}`]),
        clientB.query(`select public.rpc_activate_season($1, $2) as result`, [seasonB, `act-${randomUUID()}`]),
      ]);

      const fulfilled = [resultA, resultB].filter((r) => r.status === "fulfilled");
      const rejected = [resultA, resultB].filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const active = await pg.query(
        `select id from public.seasons where user_id = $1 and status = 'ACTIVE' and id in ($2, $3)`,
        [USER_A, seasonA, seasonB],
      );
      expect(active.rows).toHaveLength(1);

      await asUser(USER_A, async () => {
        await pg.query(
          `select public.rpc_conclude_season($1, 'ABANDONED', null, null, 'concurrency cleanup', $2)`,
          [active.rows[0].id, `cleanup-${randomUUID()}`],
        );
      });
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  test("O014_SEASON_QUEST_IS_N_TO_N and cross-tenant linking fails closed", async () => {
    const seasonA = await insertDraftSeason("N:N A");
    const seasonB = await insertDraftSeason("N:N B");

    await asUser(USER_A, async () => {
      const main = await pg.query(`select public.rpc_link_season_quest($1, $2, 'MAIN') as result`, [seasonA, QUEST_A1]);
      expect(main.rows[0].result.link.role).toBe("MAIN");
      const focus = await pg.query(`select public.rpc_link_season_quest($1, $2, 'FOCUS') as result`, [seasonA, QUEST_A2]);
      expect(focus.rows[0].result.link.role).toBe("FOCUS");
      const reused = await pg.query(`select public.rpc_link_season_quest($1, $2, 'FOCUS') as result`, [seasonB, QUEST_A1]);
      expect(reused.rows[0].result.link.quest_id).toBe(QUEST_A1);

      const replay = await pg.query(`select public.rpc_link_season_quest($1, $2, 'MAIN') as result`, [seasonA, QUEST_A1]);
      expect(replay.rows[0].result.replayed).toBe(true);

      await expect(
        pg.query(`select public.rpc_link_season_quest($1, $2, 'FOCUS')`, [seasonA, QUEST_B1]),
      ).rejects.toThrow(/TENANT_MISMATCH/);
    });

    const links = await pg.query(
      `select season_id, quest_id from public.season_quests where user_id = $1 and season_id in ($2, $3)`,
      [USER_A, seasonA, seasonB],
    );
    expect(links.rows.filter((r) => r.season_id === seasonA)).toHaveLength(2);
    expect(links.rows.filter((r) => r.quest_id === QUEST_A1)).toHaveLength(2);
  });

  test("O006_SEASON_END_DOES_NOT_REWRITE_GROWTH + O015_SEASON_DOES_NOT_COMPLETE_QUEST", async () => {
    const seasonId = await insertDraftSeason("Growth isolation season");
    await planSeason(seasonId);
    await asUser(USER_A, async () => {
      await pg.query(`select public.rpc_link_season_quest($1, $2, 'MAIN')`, [seasonId, QUEST_A1]);
    });
    await activateSeason(seasonId);

    const before = await coreSnapshot();
    const commitKey = randomUUID();
    const review = {
      period_start: new Date(Date.now() - 7 * 86400000).toISOString(),
      period_end: new Date().toISOString(),
      objective_summary: { activities: 1 },
      qualitative_reflection: "Completed the season without rewriting Core truth.",
      criteria_evaluation: [{ criterion: "ship", status: "MET" }],
      tactical_adjustments: "Keep scope stable",
    };

    await asUser(USER_A, async () => {
      const concluded = await pg.query(
        `select public.rpc_conclude_season($1, 'COMPLETED', $2::jsonb, $3::uuid, null, $4) as result`,
        [seasonId, JSON.stringify(review), commitKey, `conclude-${randomUUID()}`],
      );
      expect(concluded.rows[0].result.season.status).toBe("COMPLETED");
      expect(concluded.rows[0].result.review.review_type).toBe("FINAL");
    });

    const after = await coreSnapshot();
    expect(after).toEqual(before);
    expect(after.quest.status).toBe("active");
    expect(Number(after.quest.progress)).toBe(37);
  });

  test("ABANDONED requires reason and inserts zero reviews", async () => {
    const seasonId = await insertDraftSeason("Abandoned season");
    await planSeason(seasonId);
    await activateSeason(seasonId);

    await asUser(USER_A, async () => {
      await expect(
        pg.query(`select public.rpc_conclude_season($1, 'ABANDONED', null, null, '   ', $2)`, [seasonId, `bad-${randomUUID()}`]),
      ).rejects.toThrow(/MISSING_ABANDONMENT_REASON/);

      const result = await pg.query(
        `select public.rpc_conclude_season($1, 'ABANDONED', null, null, 'priority changed', $2) as result`,
        [seasonId, `abandon-${randomUUID()}`],
      );
      expect(result.rows[0].result.season.status).toBe("ABANDONED");
      expect(result.rows[0].result.review).toBeNull();
    });

    const reviews = await pg.query(`select count(*)::int as count from public.season_reviews where season_id = $1`, [seasonId]);
    expect(reviews.rows[0].count).toBe(0);
  });

  test("O016_REVIEW_DOES_NOT_CREATE_GROWTH_TRUTH + versioning + commit replay", async () => {
    const seasonId = await insertDraftSeason("Review isolation season");
    await planSeason(seasonId);
    await activateSeason(seasonId);
    const before = await coreSnapshot();

    const commit1 = randomUUID();
    const commit2 = randomUUID();
    let review1Id = "";
    let review2Id = "";

    await asUser(USER_A, async () => {
      const one = await pg.query(
        `select public.rpc_finalize_season_review($1, 'WEEKLY', clock_timestamp() - interval '7 days', clock_timestamp(), '{}'::jsonb, 'week one', '[]'::jsonb, null, $2::uuid) as result`,
        [seasonId, commit1],
      );
      review1Id = one.rows[0].result.review.id;
      expect(one.rows[0].result.review.version).toBe(1);

      const replay = await pg.query(
        `select public.rpc_finalize_season_review($1, 'WEEKLY', clock_timestamp() - interval '7 days', clock_timestamp(), '{}'::jsonb, 'week one retry', '[]'::jsonb, null, $2::uuid) as result`,
        [seasonId, commit1],
      );
      expect(replay.rows[0].result.replayed).toBe(true);
      expect(replay.rows[0].result.review.id).toBe(review1Id);

      const two = await pg.query(
        `select public.rpc_finalize_season_review($1, 'WEEKLY', clock_timestamp() - interval '7 days', clock_timestamp(), '{}'::jsonb, 'week two', '[]'::jsonb, 'adjust focus', $2::uuid) as result`,
        [seasonId, commit2],
      );
      review2Id = two.rows[0].result.review.id;
      expect(two.rows[0].result.review.version).toBe(2);
    });

    const first = await pg.query(`select superseded_by_id from public.season_reviews where id = $1`, [review1Id]);
    expect(first.rows[0].superseded_by_id).toBe(review2Id);
    const after = await coreSnapshot();
    expect(after).toEqual(before);

    await asUser(USER_A, async () => {
      await pg.query(
        `select public.rpc_conclude_season($1, 'ABANDONED', null, null, 'review test cleanup', $2)`,
        [seasonId, `cleanup-${randomUUID()}`],
      );
    });
  });

  test("FINAL amendment creates N+1 without reopening or changing season timestamps", async () => {
    const seasonId = await insertDraftSeason("Final amendment season");
    await planSeason(seasonId);
    await activateSeason(seasonId);

    const initialPayload = {
      period_start: new Date(Date.now() - 4 * 86400000).toISOString(),
      period_end: new Date().toISOString(),
      objective_summary: { outcome: "met" },
      qualitative_reflection: "Initial final review",
      criteria_evaluation: [],
    };
    await asUser(USER_A, async () => {
      await pg.query(
        `select public.rpc_conclude_season($1, 'ENDED_EARLY', $2::jsonb, $3::uuid, null, $4)`,
        [seasonId, JSON.stringify(initialPayload), randomUUID(), `conclude-${randomUUID()}`],
      );
    });

    const before = await pg.query(`select status, started_at, ended_at from public.seasons where id = $1`, [seasonId]);
    const amended = {
      ...initialPayload,
      qualitative_reflection: "Corrected final review",
      objective_summary: { outcome: "partially_met" },
    };

    await asUser(USER_A, async () => {
      const result = await pg.query(
        `select public.rpc_amend_final_season_review($1, $2::jsonb, 'correct factual wording', $3::uuid, $4) as result`,
        [seasonId, JSON.stringify(amended), randomUUID(), `amend-${randomUUID()}`],
      );
      expect(result.rows[0].result.review.review_type).toBe("FINAL");
      expect(result.rows[0].result.review.version).toBe(2);
    });

    const after = await pg.query(`select status, started_at, ended_at from public.seasons where id = $1`, [seasonId]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  test("proposal CAS: accepted SEASON_PLAN commits once; exact replay returns same entity; distinct retry conflicts", async () => {
    const proposalId = randomUUID();
    const payload = {
      title: "Proposal season",
      theme: "Deep work",
      target_start_date: new Date().toISOString().slice(0, 10),
      duration_days: 28,
      success_criteria: [{ criterion: "deliver" }],
    };
    await pg.query(
      `insert into public.outer_loop_proposals
         (id, user_id, proposal_type, schema_version, payload, expires_at)
       values ($1, $2, 'SEASON_PLAN', 1, $3::jsonb, clock_timestamp() + interval '14 days')`,
      [proposalId, USER_A, JSON.stringify(payload)],
    );

    const reviewKey = `proposal-review-${randomUUID()}`;
    let resultingSeasonId = "";
    await asUser(USER_A, async () => {
      const accepted = await pg.query(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, $2) as result`,
        [proposalId, reviewKey],
      );
      resultingSeasonId = accepted.rows[0].result.proposal.resulting_entity_id;
      expect(accepted.rows[0].result.proposal.status).toBe("ACCEPTED");
      expect(resultingSeasonId).toBeTruthy();

      const replay = await pg.query(
        `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, $2) as result`,
        [proposalId, reviewKey],
      );
      expect(replay.rows[0].result.replayed).toBe(true);
      expect(replay.rows[0].result.resulting_entity_id).toBe(resultingSeasonId);

      await expect(
        pg.query(
          `select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, $2)`,
          [proposalId, `distinct-${randomUUID()}`],
        ),
      ).rejects.toThrow(/PROPOSAL_ALREADY_REVIEWED/);
    });

    const seasons = await pg.query(`select id, status from public.seasons where id = $1`, [resultingSeasonId]);
    expect(seasons.rows).toHaveLength(1);
    expect(seasons.rows[0].status).toBe("PLANNED");
  });
});
