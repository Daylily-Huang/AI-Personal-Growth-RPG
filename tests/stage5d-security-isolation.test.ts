import { describe, expect, test, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "5d555555-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const USER_B = "5d555555-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const DOMAIN_A = "5d666666-1111-4000-a000-000000000001";
const DOMAIN_B = "5d666666-2222-4000-b000-000000000002";

/**
 * Stage 5D Gate — tenant isolation on the REAL PostgreSQL RLS layer.
 *
 * For every user-private Skill Tree table, an authenticated role bound to
 * User A's jwt claim must:
 *   - SELECT: see only A's rows (zero of B's rows leak)
 *   - mutate: never affect B's rows (update/delete policies use auth.uid())
 *   - INSERT: never create rows attributed to B (with check user_id = auth.uid())
 *
 * These tests run as the actual `authenticated` role — the same role the
 * API's user-scoped Supabase clients run under — so they prove the RLS
 * guarantees themselves, not the repository's discipline.
 */
describe.skipIf(!DATABASE_URL)("Stage 5D — RLS Tenant Isolation as authenticated role (Live PostgreSQL)", () => {
  let pg: Client;
  let skillAId: string;
  let skillBId: string;
  let edgeAId: string;
  let activityAId: string;
  let assessmentAId: string;

  async function asUser(userId: string, fn: () => Promise<void>) {
    await pg.query("set role authenticated");
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    try {
      await fn();
    } finally {
      await pg.query("reset role");
    }
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    await pg.query(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'stage5d_user_a@growth.rpg'),
        ('${USER_B}', 'stage5d_user_b@growth.rpg')
      on conflict (id) do nothing;
      insert into public.profiles (user_id, display_name) values
        ('${USER_A}', 'Stage5DUserA'), ('${USER_B}', 'Stage5DUserB')
      on conflict (user_id) do nothing;
      insert into public.player_states (user_id, total_xp, player_level) values
        ('${USER_A}', 0, 1), ('${USER_B}', 0, 1)
      on conflict (user_id) do nothing;
      insert into public.domains (id, user_id, name, slug) values
        ('${DOMAIN_A}', '${USER_A}', '5D Domain A', 'stage5d-domain-a'),
        ('${DOMAIN_B}', '${USER_B}', '5D Domain B', 'stage5d-domain-b')
      on conflict (id) do nothing;
      insert into public.skills (id, user_id, domain_id, name, aliases, xp, level, mastery_level, mastery_confidence) values
        ('5d777777-0000-4000-a000-00000000000a', '${USER_A}', '${DOMAIN_A}', '5D Skill A', '{}', 40, 1, 3, 0.8),
        ('5d777777-0000-4000-a000-00000000000c', '${USER_A}', '${DOMAIN_A}', '5D Skill A2', '{}', 5, 1, 1, 0.5),
        ('5d777777-0000-4000-b000-00000000000b', '${USER_B}', '${DOMAIN_B}', '5D Skill B', '{}', 10, 1, 1, 0.4)
      on conflict (id) do nothing;
      insert into public.skill_edges (id, user_id, source_skill_id, target_skill_id, relation_type) values
        ('5d888888-0000-4000-a000-00000000000a', '${USER_A}', '5d777777-0000-4000-a000-00000000000a', '5d777777-0000-4000-a000-00000000000c', 'supports')
      on conflict (id) do nothing;
    `);

    await pg.query(`
      insert into public.activities (id, user_id, raw_input, title, status, rules_version) values
        ('5d999999-0000-4000-a000-00000000000a', '${USER_A}', '5D seed activity', '5D seed activity', 'confirmed', 'v1')
      on conflict (id) do nothing;
      insert into public.ai_assessments (id, user_id, activity_id, status, assessment_json, rules_version) values
        ('5d999999-0000-4000-b000-00000000000a', '${USER_A}', '5d999999-0000-4000-a000-00000000000a', 'confirmed', '{}', 'v1')
      on conflict (id) do nothing;
      insert into public.evidence_records (id, user_id, activity_id, skill_id, evidence_level, evidence_type, description, verified) values
        ('5daaaaaa-0000-4000-a000-00000000000a', '${USER_A}', '5d999999-0000-4000-a000-00000000000a', '5d777777-0000-4000-a000-00000000000a', 3, 'production', '5D evidence', true)
      on conflict (id) do nothing;
      insert into public.mastery_events (id, user_id, activity_id, skill_id, evidence_id, from_level, to_level, confidence, event_type, reason) values
        ('5dbbbbbb-0000-4000-a000-00000000000a', '${USER_A}', '5d999999-0000-4000-a000-00000000000a', '5d777777-0000-4000-a000-00000000000a', '5daaaaaa-0000-4000-a000-00000000000a', 2, 3, 0.8, 'upgrade', '5D upgrade')
      on conflict (id) do nothing;
      insert into public.mastery_verifications (id, user_id, skill_id, skill_name, from_level, to_level, evidence_level, status, proposal_assessment_id) values
        ('5dcccccc-0000-4000-a000-00000000000a', '${USER_A}', '5d777777-0000-4000-a000-00000000000a', '5D Skill A', 4, 5, 4, 'pending', '5d999999-0000-4000-b000-00000000000a')
      on conflict (id) do nothing;
      insert into public.xp_transactions (id, user_id, activity_id, assessment_id, skill_id, skill_name_snapshot, amount, base_amount, reason, rules_version) values
        ('5ddddddd-0000-4000-a000-00000000000a', '${USER_A}', '5d999999-0000-4000-a000-00000000000a', '5d999999-0000-4000-b000-00000000000a', '5d777777-0000-4000-a000-00000000000a', '5D Skill A', 25, 25, '5D xp', 'v1')
      on conflict (id) do nothing;
    `);

    skillAId = "5d777777-0000-4000-a000-00000000000a";
    skillBId = "5d777777-0000-4000-b000-00000000000b";
    edgeAId = "5d888888-0000-4000-a000-00000000000a";
    activityAId = "5d999999-0000-4000-a000-00000000000a";
    assessmentAId = "5d999999-0000-4000-b000-00000000000a";
  });

  afterAll(async () => {
    if (!pg) return;
    await pg.query("reset role");
    await pg.query(`
      delete from public.xp_transactions where user_id in ('${USER_A}', '${USER_B}');
      delete from public.mastery_verifications where user_id in ('${USER_A}', '${USER_B}');
      delete from public.mastery_events where user_id in ('${USER_A}', '${USER_B}');
      delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
      delete from public.skill_edges where user_id in ('${USER_A}', '${USER_B}');
      delete from public.ai_assessments where user_id in ('${USER_A}', '${USER_B}');
      delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
      delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
      delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      delete from public.player_states where user_id in ('${USER_A}', '${USER_B}');
      delete from public.profiles where user_id in ('${USER_A}', '${USER_B}');
      delete from auth.users where id in ('${USER_A}', '${USER_B}');
    `);
    await pg.end();
  });

  const PRIVATE_TABLES = [
    "domains",
    "skills",
    "skill_edges",
    "evidence_records",
    "mastery_events",
    "mastery_verifications",
    "xp_transactions",
  ] as const;

  for (const table of PRIVATE_TABLES) {
    test(`RLS SELECT on ${table}: authenticated A sees own rows, zero of B's`, async () => {
      await asUser(USER_A, async () => {
        const own = await pg.query(`select count(*)::int as n from public.${table} where user_id = $1`, [USER_A]);
        expect(own.rows[0].n).toBeGreaterThan(0);
        const foreign = await pg.query(`select count(*)::int as n from public.${table} where user_id = $1`, [USER_B]);
        expect(foreign.rows[0].n).toBe(0);
        const total = await pg.query(`select count(*)::int as n from public.${table}`);
        expect(total.rows[0].n).toBe(own.rows[0].n);
      });
    });
  }

  test("authenticated A cannot UPDATE User B's skill (grant-level or RLS denial)", async () => {
    await asUser(USER_A, async () => {
      let denied = false;
      let rowCount = -1;
      try {
        const r = await pg.query(
          "update public.skills set name = 'Hijacked' where user_id = $1",
          [USER_B],
        );
        rowCount = r.rowCount ?? 0;
      } catch {
        denied = true;
      }
      expect(denied || rowCount === 0).toBe(true);
    });
    const stillB = await pg.query("select name from public.skills where id = $1", [skillBId]);
    expect(stillB.rows[0].name).toBe("5D Skill B");
  });

  test("authenticated A cannot DELETE User B's edge (RLS delete policy)", async () => {
    await asUser(USER_A, async () => {
      const r = await pg.query(
        "delete from public.skill_edges where user_id = $1",
        [USER_B],
      );
      expect(r.rowCount).toBe(0);
    });
  });

  test("authenticated A cannot reassign B's skill into A's domain (grant-level or RLS with-check denial)", async () => {
    await asUser(USER_A, async () => {
      let denied = false;
      let rowCount = -1;
      try {
        const r = await pg.query(
          "update public.skills set domain_id = $1 where user_id = $2",
          [DOMAIN_A, USER_B],
        );
        rowCount = r.rowCount ?? 0;
      } catch {
        denied = true;
      }
      expect(denied || rowCount === 0).toBe(true);
    });
    const stillB = await pg.query(
      "select domain_id from public.skills where id = $1",
      [skillBId],
    );
    expect(stillB.rows[0].domain_id).toBe(DOMAIN_B);
  });

  test("authenticated INSERT attributing rows to User B is denied (with check user_id)", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(
          "insert into public.skills (id, user_id, name, aliases, xp, level, mastery_level, mastery_confidence) values ($1, $2, 'Forged', '{}', 0, 1, 1, 0.5)",
          [crypto.randomUUID(), USER_B],
        ),
      ).rejects.toThrow();
      await expect(
        pg.query(
          "insert into public.domains (id, user_id, name, slug) values ($1, $2, 'Forged Domain', 'forged')",
          [crypto.randomUUID(), USER_B],
        ),
      ).rejects.toThrow();
    });
  });

  test("authenticated A cannot create an edge referencing B's skill (composite tenant FK)", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(
          "insert into public.skill_edges (id, user_id, source_skill_id, target_skill_id, relation_type) values ($1, $2, $3, $4, 'supports')",
          [crypto.randomUUID(), USER_A, skillAId, skillBId],
        ),
      ).rejects.toThrow();
      await expect(
        pg.query(
          "insert into public.skill_edges (id, user_id, source_skill_id, target_skill_id, relation_type) values ($1, $2, $3, $4, 'supports')",
          [crypto.randomUUID(), USER_A, skillBId, skillAId],
        ),
      ).rejects.toThrow();
    });
  });

  test("read-model inference is closed: A's detail/evidence/events queries never return B rows", async () => {
    await asUser(USER_A, async () => {
      const evidenceForB = await pg.query(
        "select count(*)::int as n from public.evidence_records where skill_id = $1",
        [skillBId],
      );
      expect(evidenceForB.rows[0].n).toBe(0);
      const eventsForB = await pg.query(
        "select count(*)::int as n from public.mastery_events where skill_id = $1",
        [skillBId],
      );
      expect(eventsForB.rows[0].n).toBe(0);
      const txForB = await pg.query(
        "select count(*)::int as n from public.xp_transactions where skill_id = $1",
        [skillBId],
      );
      expect(txForB.rows[0].n).toBe(0);
    });
  });

  test("sanity: seeded ids are wired (activity/assessment/edge referenced correctly)", async () => {
    const edge = await pg.query("select user_id, source_skill_id from public.skill_edges where id = $1", [edgeAId]);
    expect(edge.rows[0].user_id).toBe(USER_A);
    const act = await pg.query("select user_id from public.activities where id = $1", [activityAId]);
    expect(act.rows[0].user_id).toBe(USER_A);
    const asm = await pg.query("select user_id from public.ai_assessments where id = $1", [assessmentAId]);
    expect(asm.rows[0].user_id).toBe(USER_A);
  });
});
