// tests/stage7a-db-authority.test.ts
// Stage 7A: Artifact Domain Model, Normalized Relational Join Schema, Lifecycle Coherence, RLS & Deletion Protection Authority (Live PostgreSQL)

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
const EVIDENCE_A = "7aee0001-aaaa-4000-a000-000000000001";
const EVIDENCE_B = "7aee0002-bbbb-4000-b000-000000000002";
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

      insert into public.evidence_records (id, user_id, activity_id, skill_id, evidence_level, evidence_type, description, verified) values
        ('${EVIDENCE_A}', '${USER_A}', '${ACTIVITY_A}', '${SKILL_A}', 3, 'work_product', 'Published research paper draft', true),
        ('${EVIDENCE_B}', '${USER_B}', '${ACTIVITY_B}', '${SKILL_B}', 4, 'work_product', 'Published production model', true);
    `);
  });

  afterAll(async () => {
    if (pg) {
      await pg.end();
    }
  });

  // ============================================================================
  // 1. ARTIFACT TAXONOMY & CONSTRAINT INTEGRITY (P1-2 & SMALL SCHEMA PARITY)
  // ============================================================================
  describe("1. Artifact Taxonomy & Constraint Integrity", () => {
    test("1.1 User A creates valid artifacts across allowed 8 taxonomy types", async () => {
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

    test("1.2 Regression: generic 'code' is rejected by check constraint (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type) values ($1, $2, $3)`,
            [USER_A, "Legacy Code Type Artifact", "code"]
          )
        ).rejects.toThrow();
      });
    });

    test("1.3 Invalid arbitrary artifact_type fails check constraint (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type) values ($1, $2, $3)`,
            [USER_A, "Invalid Type", "unsupported_type"]
          )
        ).rejects.toThrow();
      });
    });

    test("1.4 Empty or whitespace title fails check constraint (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type) values ($1, $2, $3)`,
            [USER_A, "    ", "document"]
          )
        ).rejects.toThrow();
      });
    });

    test("1.5 Reusability score numeric(3,2) boundary test (0.00 and 1.00 pass, out-of-bounds fail)", async () => {
      await asUser(USER_A, async () => {
        // 0.00 boundary passes
        const resMin = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type, reusability_score) values ($1, $2, $3, $4) returning reusability_score`,
          [USER_A, "Min Score Artifact", "document", 0.00]
        );
        expect(Number(resMin.rows[0].reusability_score)).toBe(0.00);

        // 1.00 boundary passes
        const resMax = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type, reusability_score) values ($1, $2, $3, $4) returning reusability_score`,
          [USER_A, "Max Score Artifact", "document", 1.00]
        );
        expect(Number(resMax.rows[0].reusability_score)).toBe(1.00);

        // 1.25 fails
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type, reusability_score) values ($1, $2, $3, $4)`,
            [USER_A, "Too High Score", "document", 1.25]
          )
        ).rejects.toThrow();

        // -0.10 fails
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type, reusability_score) values ($1, $2, $3, $4)`,
            [USER_A, "Negative Score", "document", -0.10]
          )
        ).rejects.toThrow();
      });
    });

    test("1.6 Duplicate normalized title for same user fails unique constraint (23505)", async () => {
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
  // 2. LIFECYCLE COHERENCE MATRIX (P1-3)
  // ============================================================================
  describe("2. Lifecycle Coherence Matrix", () => {
    test("2.1 active + is_archived=true is rejected (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type, lifecycle_status, is_archived)
             values ($1, $2, $3, 'active', true)`,
            [USER_A, "Contradictory Active Archived", "document"]
          )
        ).rejects.toThrow();
      });
    });

    test("2.2 archived + is_archived=false is rejected (23514)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(
            `insert into public.artifacts (user_id, title, artifact_type, lifecycle_status, is_archived)
             values ($1, $2, $3, 'archived', false)`,
            [USER_A, "Contradictory Archived Active", "document"]
          )
        ).rejects.toThrow();
      });
    });

    test("2.3 archived + is_archived=true automatically populates archived_at", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type, lifecycle_status, is_archived)
           values ($1, $2, $3, 'archived', true)
           returning id, lifecycle_status, is_archived, archived_at`,
          [USER_A, "Properly Archived Artifact", "document"]
        );
        expect(res.rows[0].lifecycle_status).toBe("archived");
        expect(res.rows[0].is_archived).toBe(true);
        expect(res.rows[0].archived_at).not.toBeNull();
      });
    });

    test("2.4 Restoration from archived to active clears archived_at and sets is_archived=false", async () => {
      await asUser(USER_A, async () => {
        // Create archived
        const res = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type, lifecycle_status, is_archived)
           values ($1, $2, $3, 'archived', true)
           returning id`,
          [USER_A, "Artifact To Restore", "document"]
        );
        const artId = res.rows[0].id;

        // Restore to active
        const restoreRes = await pg.query(
          `update public.artifacts set lifecycle_status = 'active', is_archived = false where id = $1
           returning lifecycle_status, is_archived, archived_at`,
          [artId]
        );
        expect(restoreRes.rows[0].lifecycle_status).toBe("active");
        expect(restoreRes.rows[0].is_archived).toBe(false);
        expect(restoreRes.rows[0].archived_at).toBeNull();
      });
    });

    test("2.5 draft remains non-archived (is_archived=false, archived_at=null)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type, lifecycle_status)
           values ($1, $2, $3, 'draft')
           returning lifecycle_status, is_archived, archived_at`,
          [USER_A, "Draft Artifact", "document"]
        );
        expect(res.rows[0].lifecycle_status).toBe("draft");
        expect(res.rows[0].is_archived).toBe(false);
        expect(res.rows[0].archived_at).toBeNull();
      });
    });

    test("2.6 superseded remains non-archived (is_archived=false, archived_at=null) and can be restored", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type, lifecycle_status)
           values ($1, $2, $3, 'superseded')
           returning id, lifecycle_status, is_archived, archived_at`,
          [USER_A, "Superseded Artifact", "document"]
        );
        const artId = res.rows[0].id;
        expect(res.rows[0].lifecycle_status).toBe("superseded");
        expect(res.rows[0].is_archived).toBe(false);
        expect(res.rows[0].archived_at).toBeNull();

        // Restore superseded back to active
        const restoreRes = await pg.query(
          `update public.artifacts set lifecycle_status = 'active' where id = $1
           returning lifecycle_status, is_archived`,
          [artId]
        );
        expect(restoreRes.rows[0].lifecycle_status).toBe("active");
        expect(restoreRes.rows[0].is_archived).toBe(false);
      });
    });
  });

  // ============================================================================
  // 3. NORMALIZED RELATIONAL JOIN TABLES & COMPOSITE TENANT-SAFE FKS
  // ============================================================================
  describe("3. Normalized Relational Join Tables & Composite Tenant-Safe FKs", () => {
    beforeAll(async () => {
      await pg.query(`
        insert into public.artifacts (id, user_id, title, artifact_type, summary)
        values
          ('${ART_A1}', '${USER_A}', 'LTP Engine Architecture', 'code_repository', 'Confidential A'),
          ('${ART_B1}', '${USER_B}', 'Transformer Training Pipeline', 'code_repository', 'Confidential B')
        on conflict (id) do nothing;
      `);
    });

    test("3.1 Artifact <-> Activity Join: Owned link succeeds; Cross-tenant attempts fail composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        // User A artifact + User A activity -> succeeds
        const res = await pg.query(
          `insert into public.artifact_activities (user_id, artifact_id, activity_id, activity_role)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, ACTIVITY_A, "produced"]
        );
        expect(res.rows.length).toBe(1);

        // User A artifact + User B activity -> fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_activities (user_id, artifact_id, activity_id, activity_role)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, ACTIVITY_B, "produced"]
          )
        ).rejects.toThrow();

        // User B artifact + User A activity -> fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_activities (user_id, artifact_id, activity_id, activity_role)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_B1, ACTIVITY_A, "produced"]
          )
        ).rejects.toThrow();
      });
    });

    test("3.2 Artifact <-> Skill Join: Owned link succeeds; Cross-tenant attempts fail composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, SKILL_A, 4]
        );
        expect(res.rows.length).toBe(1);

        // User A artifact + User B skill -> fails composite FK
        await expect(
          pg.query(
            `insert into public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, SKILL_B, 4]
          )
        ).rejects.toThrow();

        // User B artifact + User A skill -> fails composite FK
        await expect(
          pg.query(
            `insert into public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_B1, SKILL_A, 4]
          )
        ).rejects.toThrow();
      });
    });

    test("3.3 Artifact <-> Knowledge Node Join: Owned link succeeds; Single relation per pair enforced", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, NODE_A1, "synthesizes"]
        );
        expect(res.rows.length).toBe(1);

        // User A artifact + User B node -> fails composite FK
        await expect(
          pg.query(
            `insert into public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, NODE_B1, "synthesizes"]
          )
        ).rejects.toThrow();

        // Duplicate link on same (user_id, artifact_id, node_id) fails unique constraint
        await expect(
          pg.query(
            `insert into public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, NODE_A1, "cites"]
          )
        ).rejects.toThrow();
      });
    });

    test("3.4 Artifact <-> Quest Join: Owned link succeeds; Cross-tenant attempts fail composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `insert into public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable)
           values ($1, $2, $3, $4)
           returning id`,
          [USER_A, ART_A1, QUEST_A, true]
        );
        expect(res.rows.length).toBe(1);

        // User A artifact + User B quest -> fails composite FK
        await expect(
          pg.query(
            `insert into public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_A1, QUEST_B, true]
          )
        ).rejects.toThrow();

        // User B artifact + User A quest -> fails composite FK
        await expect(
          pg.query(
            `insert into public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable)
             values ($1, $2, $3, $4)`,
            [USER_A, ART_B1, QUEST_A, true]
          )
        ).rejects.toThrow();
      });
    });

    test("3.5 Artifact <-> Evidence Join: Owned link succeeds; Cross-tenant attempts fail composite FK (23503)", async () => {
      await asUser(USER_A, async () => {
        // User A artifact + User A evidence -> succeeds
        const res = await pg.query(
          `insert into public.artifact_evidence (user_id, artifact_id, evidence_id)
           values ($1, $2, $3)
           returning id`,
          [USER_A, ART_A1, EVIDENCE_A]
        );
        expect(res.rows.length).toBe(1);

        // User A artifact + User B evidence -> fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_evidence (user_id, artifact_id, evidence_id)
             values ($1, $2, $3)`,
            [USER_A, ART_A1, EVIDENCE_B]
          )
        ).rejects.toThrow();

        // User B artifact + User A evidence -> fails composite FK (23503)
        await expect(
          pg.query(
            `insert into public.artifact_evidence (user_id, artifact_id, evidence_id)
             values ($1, $2, $3)`,
            [USER_A, ART_B1, EVIDENCE_A]
          )
        ).rejects.toThrow();

        // Duplicate link on same pair fails unique constraint (23505)
        await expect(
          pg.query(
            `insert into public.artifact_evidence (user_id, artifact_id, evidence_id)
             values ($1, $2, $3)`,
            [USER_A, ART_A1, EVIDENCE_A]
          )
        ).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // 4. CHILD-TABLE RLS ISOLATION MATRIX (P1-4)
  // ============================================================================
  describe("4. Child-Table RLS Isolation Matrix", () => {
    const childTables = [
      { name: "artifact_activities", idCol: "activity_id", foreignVal: ACTIVITY_A },
      { name: "artifact_skills", idCol: "skill_id", foreignVal: SKILL_A },
      { name: "artifact_knowledge_nodes", idCol: "node_id", foreignVal: NODE_A1 },
      { name: "artifact_quests", idCol: "quest_id", foreignVal: QUEST_A },
      { name: "artifact_evidence", idCol: "evidence_id", foreignVal: EVIDENCE_A },
    ];

    childTables.forEach(({ name }) => {
      test(`4.${name} RLS: User A reads own; User B SELECT/UPDATE/DELETE affects 0 rows`, async () => {
        // User A can select own link
        await asUser(USER_A, async () => {
          const resA = await pg.query(`select * from public.${name} where artifact_id = '${ART_A1}'`);
          expect(resA.rows.length).toBe(1);
          expect(resA.rows[0].user_id).toBe(USER_A);
        });

        // User B cannot select User A link (returns 0 rows)
        await asUser(USER_B, async () => {
          const resB = await pg.query(`select * from public.${name} where artifact_id = '${ART_A1}'`);
          expect(resB.rows.length).toBe(0);

          // User B cannot update User A link
          const updRes = await pg.query(`update public.${name} set created_at = now() where artifact_id = '${ART_A1}'`);
          expect(updRes.rowCount).toBe(0);

          // User B cannot delete User A link
          const delRes = await pg.query(`delete from public.${name} where artifact_id = '${ART_A1}'`);
          expect(delRes.rowCount).toBe(0);
        });

        // Verify User A link still exists unaltered
        await asUser(USER_A, async () => {
          const check = await pg.query(`select * from public.${name} where artifact_id = '${ART_A1}'`);
          expect(check.rows.length).toBe(1);
        });
      });
    });

    test("4.6 Parent artifacts table RLS isolation: User B cannot SELECT, UPDATE, or DELETE User A artifact", async () => {
      await asUser(USER_B, async () => {
        const readForeign = await pg.query(`select * from public.artifacts where id = '${ART_A1}'`);
        expect(readForeign.rows.length).toBe(0);

        const updForeign = await pg.query(`update public.artifacts set title = 'Hostile Edit' where id = '${ART_A1}'`);
        expect(updForeign.rowCount).toBe(0);

        const delForeign = await pg.query(`delete from public.artifacts where id = '${ART_A1}'`);
        expect(delForeign.rowCount).toBe(0);
      });

      const check = await pg.query(`select title from public.artifacts where id = '${ART_A1}'`);
      expect(check.rows[0].title).toBe("LTP Engine Architecture");
    });
  });

  // ============================================================================
  // 5. ANONYMOUS ROLE DENIAL MATRIX (ALL 6 TABLES) (P1-4)
  // ============================================================================
  describe("5. Anonymous Role Denial Matrix (All 6 Tables)", () => {
    const allTables = [
      "artifacts",
      "artifact_activities",
      "artifact_skills",
      "artifact_knowledge_nodes",
      "artifact_quests",
      "artifact_evidence",
    ];

    allTables.forEach((tableName) => {
      test(`5. Anon role has 0 table access to ${tableName}`, async () => {
        await asAnon(async () => {
          await expect(pg.query(`select * from public.${tableName}`)).rejects.toThrow();
        });
      });
    });
  });

  // ============================================================================
  // 6. FAIL-CLOSED DELETION PROTECTION & ARCHIVAL (P1-1)
  // ============================================================================
  describe("6. Fail-Closed Deletion Protection & Archival (Provenance & Evidence)", () => {
    test("6.1 Unreferenced artifact can be cleanly deleted with cascading join records", async () => {
      await asUser(USER_A, async () => {
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

    test("6.2 Artifact referenced by Knowledge Node provenance is BLOCKED from deletion (23503)", async () => {
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
      });
    });

    test("6.3 Artifact referenced by Knowledge Edge provenance is BLOCKED from deletion (23503)", async () => {
      await pg.query(`
        insert into public.artifacts (id, user_id, title, artifact_type)
        values ('${ART_A2}', '${USER_A}', 'Edge Source Artifact', 'code_repository')
        on conflict (id) do nothing;

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

    test("6.4 Artifact attached to Evidence via artifact_evidence is BLOCKED from deletion (23503)", async () => {
      // Create new Artifact with attached Evidence
      let evidenceArtId = "";
      await asUser(USER_A, async () => {
        const artRes = await pg.query(
          `insert into public.artifacts (user_id, title, artifact_type)
           values ($1, $2, $3)
           returning id`,
          [USER_A, "Evidence Grounded Artifact", "document"]
        );
        evidenceArtId = artRes.rows[0].id;

        // Attach to Evidence Record
        await pg.query(
          `insert into public.artifact_evidence (user_id, artifact_id, evidence_id)
           values ($1, $2, $3)`,
          [USER_A, evidenceArtId, EVIDENCE_A]
        );

        // Attempt deletion of Artifact -> BLOCKED with 23503
        await expect(
          pg.query(`delete from public.artifacts where id = $1`, [evidenceArtId])
        ).rejects.toThrow(/Cannot delete artifact: referenced by evidence records/);

        // Verify artifact still exists
        const artCheck = await pg.query(`select id from public.artifacts where id = $1`, [evidenceArtId]);
        expect(artCheck.rows.length).toBe(1);

        // Verify artifact_evidence link still exists
        const linkCheck = await pg.query(`select id from public.artifact_evidence where artifact_id = $1`, [evidenceArtId]);
        expect(linkCheck.rows.length).toBe(1);

        // Archiving the artifact succeeds cleanly
        const archRes = await pg.query(
          `update public.artifacts set is_archived = true, lifecycle_status = 'archived' where id = $1
           returning is_archived, archived_at`,
          [evidenceArtId]
        );
        expect(archRes.rows[0].is_archived).toBe(true);
        expect(archRes.rows[0].archived_at).not.toBeNull();
      });
    });
  });
});
