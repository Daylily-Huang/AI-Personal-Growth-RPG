// tests/stage7a-db-authority.test.ts
// Stage 7A: Artifact Domain Model, Normalized Relational Join Schema, RLS & Deletion Protection Authority (Live PostgreSQL)

import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "7a111111-aaaa-4000-a000-000000000001";
const USER_B = "7a222222-bbbb-4000-b000-000000000002";
const DOMAIN_A = "7ad00001-aaaa-4000-a000-000000000001";
const DOMAIN_B = "7ad00002-bbbb-4000-b000-000000000002";
const SKILL_A = "7a500001-aaaa-4000-a000-000000000001";
const SKILL_B = "7a500002-bbbb-4000-b000-000000000002";
const ACTIVITY_A = "7ac00001-aaaa-4000-a000-000000000001";
const ACTIVITY_B = "7ac00002-bbbb-4000-b000-000000000002";
const QUEST_A = "7ae00001-aaaa-4000-a000-000000000001";
const QUEST_B = "7ae00002-bbbb-4000-b000-000000000002";
const NODE_A1 = "7af00001-aaaa-4000-a000-000000000001";
const NODE_A2 = "7af00002-aaaa-4000-a000-000000000002";
const NODE_B1 = "7af00001-bbbb-4000-b000-000000000001";
const ART_A1 = "7aa00001-aaaa-4000-a000-000000000001";
const ART_A2 = "7aa00002-aaaa-4000-a000-000000000002";
const ART_B1 = "7aa00001-bbbb-4000-b000-000000000001";

describe.skipIf(!DATABASE_URL)("Stage 7A — Artifact Schema, Composite FKs, RLS & Deletion Protection Authority (Live PostgreSQL)", () => {
  let pg: Client;

  async function asUser(userId: string, fn: () => Promise<void>) {
    await pg.query("set role authenticated");
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    try {
      await fn();
    } finally {
      await pg.query("reset role");
    }
  }

  async function asAnon(fn: () => Promise<void>) {
    await pg.query("set role anon");
    try {
      await fn();
    } finally {
      await pg.query("reset role");
    }
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    // Clean prior state
    await pg.query(`
      delete from public.artifact_evidence where user_id in ('${USER_A}', '${USER_B}');
      delete from public.artifact_quests where user_id in ('${USER_A}', '${USER_B}');
      delete from public.artifact_knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
      delete from public.artifact_skills where user_id in ('${USER_A}', '${USER_B}');
      delete from public.artifact_activities where user_id in ('${USER_A}', '${USER_B}');
      delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
      delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
      delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
      delete from public.artifacts where user_id in ('${USER_A}', '${USER_B}');
      delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
      delete from public.quests where user_id in ('${USER_A}', '${USER_B}');
      delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
      delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      delete from public.player_states where user_id in ('${USER_A}', '${USER_B}');
      delete from public.profiles where user_id in ('${USER_A}', '${USER_B}');
      delete from auth.users where id in ('${USER_A}', '${USER_B}');
    `);

    // Seed test users & profiles
    await pg.query(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'stage7a_user_a@growth.rpg'),
        ('${USER_B}', 'stage7a_user_b@growth.rpg')
      on conflict (id) do nothing;

      insert into public.profiles (user_id, display_name) values
        ('${USER_A}', 'Player 7A'),
        ('${USER_B}', 'Player 7B')
      on conflict (user_id) do nothing;

      insert into public.domains (id, user_id, name, slug) values
        ('${DOMAIN_A}', '${USER_A}', 'Neuroscience', 'neuroscience-7a'),
        ('${DOMAIN_B}', '${USER_B}', 'Machine Learning', 'ml-7b');

      insert into public.skills (id, user_id, domain_id, name, level) values
        ('${SKILL_A}', '${USER_A}', '${DOMAIN_A}', 'Plasticity Modeling', 2),
        ('${SKILL_B}', '${USER_B}', '${DOMAIN_B}', 'Deep Learning', 3);

      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes) values
        ('${ACTIVITY_A}', '${USER_A}', 'Researched synaptic plasticity', 'Researched synaptic plasticity', 'study', 'confirmed', '1.0.0', 45, 40),
        ('${ACTIVITY_B}', '${USER_B}', 'Trained neural network', 'Trained neural network', 'coding', 'confirmed', '1.0.0', 60, 55);

      insert into public.quests (id, user_id, title, quest_type) values
        ('${QUEST_A}', '${USER_A}', 'Publish Neuro Research', 'production'),
        ('${QUEST_B}', '${USER_B}', 'Deploy Transformer Model', 'production');

      insert into public.knowledge_nodes (id, user_id, domain_id, title, node_type, verification_status, confidence, verified_at, verified_by, source_type) values
        ('${NODE_A1}', '${USER_A}', '${DOMAIN_A}', 'Long-Term Potentiation', 'concept', 'verified', 1.0, now(), '${USER_A}', 'user_created'),
        ('${NODE_A2}', '${USER_A}', '${DOMAIN_A}', 'Synaptic Weighting', 'concept', 'verified', 1.0, now(), '${USER_A}', 'user_created'),
        ('${NODE_B1}', '${USER_B}', '${DOMAIN_B}', 'Backpropagation', 'concept', 'verified', 1.0, now(), '${USER_B}', 'user_created');
    `);
  });

  afterAll(async () => {
    if (pg) {
      await pg.end();
    }
  });

  // ============================================================================
  // 1. ARTIFACT TAXONOMY & CONSTRAINT INTEGRITY
  // ============================================================================
  describe("1. Artifact Taxonomy & Constraint Integrity", () => {
    test("1.1 User A creates valid artifacts across allowed taxonomy types", async () => {
      await asUser(USER_A, async () => {
        const types = [
          "document",
          "code_repository",
          "design_spec",
          "data_analysis",
          "presentation",
          "synthesis_note",
          "creative_work",
          "other",
        ];

        for (const t of types) {
          const res = await pg.query(
            `insert into public.artifacts (user_id, title, artifact_type, summary, reusability_score)
             values ($1, $2, $3, $4, $5)
             returning id, artifact_type, lifecycle_status, is_archived`,
            [USER_A, `Artifact of type ${t}`, t, `Summary of ${t}`, 0.85]
          );
          expect(res.rows.length).toBe(1);
          expect(res.rows[0].artifact_type).toBe(t);
          expect(res.rows[0].lifecycle_status).toBe("active");
          expect(res.rows[0].is_archived).toBe(false);
        }
      });
    });

    test("1.2 Invalid artifact_type fails check constraint (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type) values ($1, $2, $3)`,
            [USER_A, "Invalid Type", "unsupported_type"]
          )
        ).rejects.toThrow();
      });
    });

    test("1.3 Empty or whitespace title fails check constraint (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type) values ($1, $2, $3)`,
            [USER_A, "    ", "document"]
          )
        ).rejects.toThrow();
      });
    });

    test("1.4 Reusability score outside 0.00..1.00 fails check constraint (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type, reusability_score) values ($1, $2, $3, $4)`,
            [USER_A, "Out of bounds score", "document", 1.25]
          )
        ).rejects.toThrow();

        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type, reusability_score) values ($1, $2, $3, $4)`,
            [USER_A, "Negative score", "document", -0.1]
          )
        ).rejects.toThrow();
      });
    });

    test("1.5 Duplicate normalized title for same user fails unique constraint (23505)", async () => {
      await asUser(USER_A, async () => {
        const title = "Unique Neural Survey";
        await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type) values ($1, $2, $3)`,
          [USER_A, title, "document"]
        );

        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type) values ($1, $2, $3)`,
            [USER_A, `  ${title.toUpperCase()}  `, "design_spec"]
          )
        ).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // 2. DUAL-TENANT RLS ISOLATION MATRIX
  // ============================================================================
  describe("2. Dual-Tenant RLS Isolation Matrix", () => {
    beforeAll(async () => {
      await pg.query(`
        insert into public.artifacts (id, user_id, title, artifact_type, summary)
        values
          ('${ART_A1}', '${USER_A}', 'Secret User A Spec', 'design_spec', 'Confidential A'),
          ('${ART_B1}', '${USER_B}', 'Secret User B Spec', 'design_spec', 'Confidential B')
        on conflict (id) do nothing;
      `);
    });

    test("2.1 User A can read User A artifact; User B sees 0 rows", async () => {
      await asUser(USER_A, async () => {
        const resA = await pg.query(`select * from public.artifacts where id = '${ART_A1}'`);
        expect(resA.rows.length).toBe(1);
        expect(resA.rows[0].title).toBe("Secret User A Spec");

        const resForeign = await pg.query(`select * from public.artifacts where id = '${ART_B1}'`);
        expect(resForeign.rows.length).toBe(0);
      });

      await asUser(USER_B, async () => {
        const resB = await pg.query(`select * from public.artifacts where id = '${ART_B1}'`);
        expect(resB.rows.length).toBe(1);

        const resForeign = await pg.query(`select * from public.artifacts where id = '${ART_A1}'`);
        expect(resForeign.rows.length).toBe(0);
      });
    });

    test("2.2 User B cannot update User A artifact", async () => {
      await asUser(USER_B, async () => {
        const res = await pg.query(`update public.artifacts set title = 'Hostile Edit' where id = '${ART_A1}'`);
        expect(res.rowCount).toBe(0);
      });

      const check = await pg.query(`select title from public.artifacts where id = '${ART_A1}'`);
      expect(check.rows[0].title).toBe("Secret User A Spec");
    });

    test("2.3 User B cannot delete User A artifact", async () => {
      await asUser(USER_B, async () => {
        const res = await pg.query(`delete from public.artifacts where id = '${ART_A1}'`);
        expect(res.rowCount).toBe(0);
      });

      const check = await pg.query(`select id from public.artifacts where id = '${ART_A1}'`);
      expect(check.rows.length).toBe(1);
    });

    test("2.4 Anonymous client has 0 access to artifacts table", async () => {
      await asAnon(async () => {
        await expect(pg.query(`select * from public.artifacts`)).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // 3. NORMALIZED RELATIONAL JOIN TABLES & COMPOSITE TENANT-SAFE FKS
  // ============================================================================
  describe("3. Normalized Relational Join Tables & Composite Tenant-Safe FKs", () => {
    test("3.1 Artifact <-> Activity Join: Owned link succeeds; Foreign link fails composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        // Owned link succeeds
        const res = await pg.query(
          `insert into public.artifact_activities (user_id, artifact_id, activity_id, activity_role)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, ACTIVITY_A, "produced"]
        );
        expect(res.rows.length).toBe(1);

        // Foreign activity link fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_activities (user_id, artifact_id, activity_id, activity_role)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, ACTIVITY_B, "produced"]
          )
        ).rejects.toThrow();
      });
    });

    test("3.2 Artifact <-> Skill Join: Owned link succeeds; Foreign link fails composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, SKILL_A, 4]
        );
        expect(res.rows.length).toBe(1);

        // Foreign skill link fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, SKILL_B, 4]
          )
        ).rejects.toThrow();
      });
    });

    test("3.3 Artifact <-> Knowledge Node Join: Owned link succeeds; Foreign link fails composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, NODE_A1, "synthesizes"]
        );
        expect(res.rows.length).toBe(1);

        // Foreign knowledge node fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, NODE_B1, "synthesizes"]
          )
        ).rejects.toThrow();
      });
    });

    test("3.4 Artifact <-> Quest Join: Owned link succeeds; Foreign link fails composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, QUEST_A, true]
        );
        expect(res.rows.length).toBe(1);

        // Foreign quest fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, QUEST_B, true]
          )
        ).rejects.toThrow();
      });
    });

    test("3.5 Duplicate join link on same entity fails unique constraint (23505)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, SKILL_A, 2]
          )
        ).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // 4. FAIL-CLOSED DELETION PROTECTION (PROVENANCE & EVIDENCE)
  // ============================================================================
  describe("4. Fail-Closed Deletion Protection (Provenance & Evidence)", () => {
    test("4.1 Unreferenced artifact can be cleanly deleted with cascading join records", async () => {
      await asUser(USER_A, async () => {
        // Create unreferenced artifact with joined skill
        const artRes = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type)
           values ($1, $2, $3)
           returning id`,
          [USER_A, "Disposable Artifact", "document"]
        );
        const artId = artRes.rows[0].id;

        await pg.query(
          `insert into public.artifact_skills (user_id, artifact_id, skill_id) values ($1, $2, $3)`,
          [USER_A, artId, SKILL_A]
        );

        // Delete artifact -> succeeds
        const delRes = await pg.query(`delete from public.artifacts where id = $1`, [artId]);
        expect(delRes.rowCount).toBe(1);

        // Verify join record was cascade deleted
        const joinCheck = await pg.query(`select * from public.artifact_skills where artifact_id = $1`, [artId]);
        expect(joinCheck.rows.length).toBe(0);
      });
    });

    test("4.2 Artifact referenced by Knowledge Node provenance is BLOCKED from deletion (23503)", async () => {
      const freshNodeId = "7af00009-aaaa-4000-a000-000000000009";
      await pg.query(`
        insert into public.knowledge_nodes (id, user_id, domain_id, title, node_type, verification_status, confidence, verified_at, verified_by, source_type, source_id)
        values
          ('${freshNodeId}', '${USER_A}', '${DOMAIN_A}', 'Derived from ART_A1', 'concept', 'verified', 1.0, now(), '${USER_A}', 'artifact', '${ART_A1}')
        on conflict (id) do nothing;
      `);

      await asUser(USER_A, async () => {
        // Attempt deletion of ART_A1 -> must fail with 23503
        await expect(
          pg.query(`delete from public.artifacts where id = '${ART_A1}'`)
        ).rejects.toThrow(/Cannot delete artifact: referenced by knowledge node provenance records/);

        // Archiving the artifact succeeds cleanly
        const archRes = await pg.query(
          `update public.artifacts set is_archived = true, lifecycle_status = 'archived' where id = '${ART_A1}' returning is_archived, archived_at`
        );
        expect(archRes.rows[0].is_archived).toBe(true);
        expect(archRes.rows[0].archived_at).not.toBeNull();
      });
    });

    test("4.3 Artifact referenced by Knowledge Edge provenance is BLOCKED from deletion (23503)", async () => {
      // Create Artifact A2
      await pg.query(`
        insert into public.artifacts (id, user_id, title, artifact_type)
        values ('${ART_A2}', '${USER_A}', 'Edge Source Artifact', 'code_repository')
        on conflict (id) do nothing;
      `);

      // Create Knowledge Edge referencing ART_A2
      await pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by, source_type, source_id)
        values ('${USER_A}', '${NODE_A1}', '${NODE_A2}', 'supports', 'verified', 1.0, now(), '${USER_A}', 'artifact', '${ART_A2}')
        on conflict do nothing;
      `);

      await asUser(USER_A, async () => {
        await expect(
          pg.query(`delete from public.artifacts where id = '${ART_A2}'`)
        ).rejects.toThrow(/Cannot delete artifact: referenced by knowledge edge provenance records/);
      });
    });
  });
});
