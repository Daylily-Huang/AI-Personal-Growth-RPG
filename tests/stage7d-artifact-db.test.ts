// tests/stage7d-artifact-db.test.ts
// Stage 7D: Direct Database, RLS, RPC Privilege & Trigger Adversarial Audit (PostgreSQL Hardened Authority)

import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "7d111111-aaaa-4000-a000-000000000001";
const USER_B = "7d222222-bbbb-4000-b000-000000000002";
const DOMAIN_A = "7dd00001-aaaa-4000-a000-000000000001";
const DOMAIN_B = "7dd00002-bbbb-4000-b000-000000000002";
const SKILL_A = "7d500001-aaaa-4000-a000-000000000001";
const SKILL_B = "7d500002-bbbb-4000-b000-000000000002";
const ACTIVITY_A = "7dc00001-aaaa-4000-a000-000000000001";
const ACTIVITY_B = "7dc00002-bbbb-4000-b000-000000000002";
const QUEST_A = "7de00001-aaaa-4000-a000-000000000001";
const QUEST_B = "7de00002-bbbb-4000-b000-000000000002";
const KN_NODE_A = "7df00001-aaaa-4000-a000-000000000001";
const KN_NODE_B = "7df00001-bbbb-4000-b000-000000000001";
const EVIDENCE_A = "7dee0001-aaaa-4000-a000-000000000001";
const EVIDENCE_B = "7dee0002-bbbb-4000-b000-000000000002";
const ART_A1 = "7da00001-aaaa-4000-a000-000000000001";
const ART_B1 = "7da00001-bbbb-4000-b000-000000000001";

describe.skipIf(!DATABASE_URL)("Stage 7D — Direct Database, RLS, RPC Privilege & Trigger Adversarial Audit (Live PostgreSQL)", () => {
  let pg: Client;

  async function asUser(userId: string, fn: () => Promise<void>) {
    await pg.query("begin");
    await pg.query("set local role authenticated");
    await pg.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    try {
      await fn();
    } finally {
      await pg.query("rollback");
    }
  }

  async function asAnon(fn: () => Promise<void>) {
    await pg.query("begin");
    await pg.query("set local role anon");
    await pg.query("select set_config('request.jwt.claim.sub', '', true)");
    try {
      await fn();
    } finally {
      await pg.query("rollback");
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
      delete from public.artifacts where user_id in ('${USER_A}', '${USER_B}');
      delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
      delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
      delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
      delete from public.quests where user_id in ('${USER_A}', '${USER_B}');
      delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
      delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
      delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      delete from auth.users where id in ('${USER_A}', '${USER_B}');
    `);

    // Insert Auth Users
    await pg.query(`
      insert into auth.users (id, email) values
      ('${USER_A}', 'stage7d_db_a@growth.rpg'),
      ('${USER_B}', 'stage7d_db_b@growth.rpg');
    `);

    // Insert Base Fixtures with required 'slug' column
    await pg.query(`
      insert into public.domains (id, user_id, name, slug) values
      ('${DOMAIN_A}', '${USER_A}', 'Security Systems', 'security-systems'),
      ('${DOMAIN_B}', '${USER_B}', 'Bio Systems', 'bio-systems');

      insert into public.skills (id, user_id, domain_id, name, level) values
      ('${SKILL_A}', '${USER_A}', '${DOMAIN_A}', 'Formal Verification', 4),
      ('${SKILL_B}', '${USER_B}', '${DOMAIN_B}', 'Metabolic Modeling', 3);

      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes) values
      ('${ACTIVITY_A}', '${USER_A}', 'Audit Kernel Memory', 'Audit Kernel Memory', 'study', 'confirmed', '1.0.0', 45, 40),
      ('${ACTIVITY_B}', '${USER_B}', 'Analyze Enzyme Kinetics', 'Analyze Enzyme Kinetics', 'study', 'confirmed', '1.0.0', 60, 55);

      insert into public.quests (id, user_id, title, quest_type) values
      ('${QUEST_A}', '${USER_A}', 'Zero Bug Kernel', 'production'),
      ('${QUEST_B}', '${USER_B}', 'Genome Sequencing', 'production');

      insert into public.knowledge_nodes (id, user_id, domain_id, title, node_type, verification_status, confidence, verified_at, verified_by, source_type) values
      ('${KN_NODE_A}', '${USER_A}', '${DOMAIN_A}', 'Memory Safety Invariants', 'concept', 'verified', 1.0, now(), '${USER_A}', 'user_created'),
      ('${KN_NODE_B}', '${USER_B}', '${DOMAIN_B}', 'Enzyme Kinetics', 'concept', 'verified', 1.0, now(), '${USER_B}', 'user_created');

      insert into public.evidence_records (id, user_id, activity_id, skill_id, evidence_level, evidence_type, description, verified) values
      ('${EVIDENCE_A}', '${USER_A}', '${ACTIVITY_A}', '${SKILL_A}', 4, 'work_product', 'Coq Proof Artifact', true),
      ('${EVIDENCE_B}', '${USER_B}', '${ACTIVITY_B}', '${SKILL_B}', 3, 'work_product', 'Mass Spec CSV', true);
    `);

    // Insert Baseline Artifacts for User A and User B
    await pg.query(`
      insert into public.artifacts (id, user_id, title, artifact_type, summary, lifecycle_status, is_archived) values
      ('${ART_A1}', '${USER_A}', 'Microkernel Security Specification', 'design_spec', 'Formal memory model', 'active', false),
      ('${ART_B1}', '${USER_B}', 'Metabolic Pathway Graph', 'data_analysis', 'Stoichiometric matrix', 'active', false);
    `);
  });

  afterAll(async () => {
    if (pg) {
      await pg.query(`
        delete from public.artifact_evidence where user_id in ('${USER_A}', '${USER_B}');
        delete from public.artifact_quests where user_id in ('${USER_A}', '${USER_B}');
        delete from public.artifact_knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
        delete from public.artifact_skills where user_id in ('${USER_A}', '${USER_B}');
        delete from public.artifact_activities where user_id in ('${USER_A}', '${USER_B}');
        delete from public.artifacts where user_id in ('${USER_A}', '${USER_B}');
        delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
        delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
        delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
        delete from public.quests where user_id in ('${USER_A}', '${USER_B}');
        delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
        delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
        delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
        delete from auth.users where id in ('${USER_A}', '${USER_B}');
      `);
      await pg.end();
    }
  });

  // ==========================================
  // 1. Direct SQL RLS Isolation Attacks
  // ==========================================
  describe("1. Direct SQL RLS Isolation Attacks", () => {
    test("User A cannot SELECT User B artifact directly via SQL (returns 0 rows)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(`select * from public.artifacts where id = $1`, [ART_B1]);
        expect(res.rows.length).toBe(0);
      });
    });

    test("User A cannot INSERT row with User B user_id (RLS WITH CHECK violation)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(`
            insert into public.artifacts (user_id, title, artifact_type)
            values ('${USER_B}', 'Malicious Injection', 'document')
          `)
        ).rejects.toThrow(/new row violates row-level security policy/);
      });
    });

    test("User A cannot UPDATE User B artifact directly via SQL (0 rows affected)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(
          `update public.artifacts set title = 'Hacked Title' where id = $1`,
          [ART_B1]
        );
        expect(res.rowCount).toBe(0);
      });
    });

    test("User A cannot DELETE User B artifact directly via SQL (0 rows affected)", async () => {
      await asUser(USER_A, async () => {
        const res = await pg.query(`delete from public.artifacts where id = $1`, [ART_B1]);
        expect(res.rowCount).toBe(0);
      });
    });
  });

  // ==========================================
  // 2. Cross-Tenant Relational Link Invariants (Composite FKs)
  // ==========================================
  describe("2. Cross-Tenant Relational Link Invariants (Composite FKs)", () => {
    test("User A cannot link User A artifact to User B skill -> blocked by composite FK (user_id, skill_id)", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(`
            insert into public.artifact_skills (user_id, artifact_id, skill_id, demonstration_level)
            values ('${USER_A}', '${ART_A1}', '${SKILL_B}', 4)
          `)
        ).rejects.toThrow(/violates foreign key constraint/);
      });
    });

    test("User A cannot link User A artifact to User B activity -> blocked by composite FK", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(`
            insert into public.artifact_activities (user_id, artifact_id, activity_id, activity_role)
            values ('${USER_A}', '${ART_A1}', '${ACTIVITY_B}', 'produced')
          `)
        ).rejects.toThrow(/violates foreign key constraint/);
      });
    });

    test("User A cannot link User A artifact to User B quest -> blocked by composite FK", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(`
            insert into public.artifact_quests (user_id, artifact_id, quest_id, is_primary_deliverable)
            values ('${USER_A}', '${ART_A1}', '${QUEST_B}', true)
          `)
        ).rejects.toThrow(/violates foreign key constraint/);
      });
    });

    test("User A cannot link User A artifact to User B knowledge node -> blocked by composite FK", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(`
            insert into public.artifact_knowledge_nodes (user_id, artifact_id, node_id, relation_type)
            values ('${USER_A}', '${ART_A1}', '${KN_NODE_B}', 'synthesizes')
          `)
        ).rejects.toThrow(/violates foreign key constraint/);
      });
    });

    test("User A cannot link User A artifact to User B evidence -> blocked by composite FK", async () => {
      await asUser(USER_A, async () => {
        await expect(
          pg.query(`
            insert into public.artifact_evidence (user_id, artifact_id, evidence_id)
            values ('${USER_A}', '${ART_A1}', '${EVIDENCE_B}')
          `)
        ).rejects.toThrow(/violates foreign key constraint/);
      });
    });
  });

  // ==========================================
  // 3. Deletion Protection Trigger & Provenance Immutability
  // ==========================================
  describe("3. Deletion Protection Trigger & Provenance Immutability", () => {
    test("Trigger blocks deletion when artifact is referenced by knowledge node provenance", async () => {
      // Create a knowledge node whose source is ART_A1
      const knId = "7df99999-aaaa-4000-a000-000000000099";
      await pg.query(`
        insert into public.knowledge_nodes (id, user_id, domain_id, title, node_type, verification_status, confidence, verified_at, verified_by, source_type, source_id)
        values ('${knId}', '${USER_A}', '${DOMAIN_A}', 'Prov Node', 'concept', 'verified', 1.0, now(), '${USER_A}', 'artifact', '${ART_A1}');
      `);

      await asUser(USER_A, async () => {
        await expect(
          pg.query(`delete from public.artifacts where id = '${ART_A1}'`)
        ).rejects.toThrow(/Cannot delete artifact: referenced by knowledge node provenance records/);
      });

      // Cleanup prov node
      await pg.query(`delete from public.knowledge_nodes where id = '${knId}'`);
    });

    test("Trigger blocks deletion when artifact is linked in artifact_evidence", async () => {
      // Link ART_A1 to EVIDENCE_A
      await pg.query(`
        insert into public.artifact_evidence (user_id, artifact_id, evidence_id)
        values ('${USER_A}', '${ART_A1}', '${EVIDENCE_A}');
      `);

      await asUser(USER_A, async () => {
        await expect(
          pg.query(`delete from public.artifacts where id = '${ART_A1}'`)
        ).rejects.toThrow(/Cannot delete artifact: referenced by evidence records/);
      });

      // Cleanup link
      await pg.query(`delete from public.artifact_evidence where artifact_id = '${ART_A1}'`);
    });
  });

  // ==========================================
  // 4. Lifecycle Coherence & State Transitions
  // ==========================================
  describe("4. Lifecycle Coherence & State Transitions", () => {
    test("Enforces trigger-maintained timestamps and coherence across all valid transitions", async () => {
      const artId = "7da99999-aaaa-4000-a000-000000000001";
      // 1. draft creation
      await pg.query(`
        insert into public.artifacts (id, user_id, title, artifact_type, lifecycle_status, is_archived)
        values ('${artId}', '${USER_A}', 'Coherence Test Spec', 'design_spec', 'draft', false);
      `);

      // 2. draft -> active
      await pg.query(`
        update public.artifacts set lifecycle_status = 'active' where id = '${artId}';
      `);
      let res = await pg.query(`select lifecycle_status, is_archived, archived_at from public.artifacts where id = '${artId}'`);
      expect(res.rows[0].lifecycle_status).toBe("active");
      expect(res.rows[0].is_archived).toBe(false);
      expect(res.rows[0].archived_at).toBeNull();

      // 3. active -> archived
      await pg.query(`
        update public.artifacts set lifecycle_status = 'archived', is_archived = true where id = '${artId}';
      `);
      res = await pg.query(`select lifecycle_status, is_archived, archived_at from public.artifacts where id = '${artId}'`);
      expect(res.rows[0].lifecycle_status).toBe("archived");
      expect(res.rows[0].is_archived).toBe(true);
      expect(res.rows[0].archived_at).not.toBeNull();

      // 4. archived -> active
      await pg.query(`
        update public.artifacts set lifecycle_status = 'active', is_archived = false where id = '${artId}';
      `);
      res = await pg.query(`select lifecycle_status, is_archived, archived_at from public.artifacts where id = '${artId}'`);
      expect(res.rows[0].lifecycle_status).toBe("active");
      expect(res.rows[0].is_archived).toBe(false);
      expect(res.rows[0].archived_at).toBeNull();

      // 5. superseded -> active
      await pg.query(`
        update public.artifacts set lifecycle_status = 'superseded' where id = '${artId}';
      `);
      await pg.query(`
        update public.artifacts set lifecycle_status = 'active' where id = '${artId}';
      `);
      res = await pg.query(`select lifecycle_status, is_archived, archived_at from public.artifacts where id = '${artId}'`);
      expect(res.rows[0].lifecycle_status).toBe("active");
      expect(res.rows[0].is_archived).toBe(false);
      expect(res.rows[0].archived_at).toBeNull();

      // 6. Contradictory states are rejected
      await expect(
        pg.query(`update public.artifacts set lifecycle_status = 'archived', is_archived = false where id = '${artId}'`)
      ).rejects.toThrow(/Lifecycle status is archived but is_archived is false/);

      await expect(
        pg.query(`update public.artifacts set lifecycle_status = 'active', is_archived = true where id = '${artId}'`)
      ).rejects.toThrow(/Lifecycle status is active but is_archived is true/);

      // Cleanup
      await pg.query(`delete from public.artifacts where id = '${artId}'`);
    });
  });

  // ==========================================
  // 5. SECURITY DEFINER / RPC Privilege Audit
  // ==========================================
  describe("5. SECURITY DEFINER / RPC Privilege Audit", () => {
    test("Direct execution of settle_activity RPC is denied for authenticated and anon roles", async () => {
      // Authenticated role attempt
      await asUser(USER_A, async () => {
        await expect(
          pg.query(`select public.settle_activity($1, $2)`, [
            USER_B,
            JSON.stringify({ malicious: true }),
          ])
        ).rejects.toThrow(/permission denied for function settle_activity/);
      });

      // Anon role attempt
      await asAnon(async () => {
        await expect(
          pg.query(`select public.settle_activity($1, $2)`, [
            USER_B,
            JSON.stringify({ malicious: true }),
          ])
        ).rejects.toThrow(/permission denied for function settle_activity/);
      });
    });
  });

  // ==========================================
  // 6. Anonymous Role Rejection
  // ==========================================
  describe("6. Anonymous Role Rejection", () => {
    test("Anon role has all permissions denied across artifacts and join tables", async () => {
      await asAnon(async () => {
        await expect(pg.query(`select * from public.artifacts`)).rejects.toThrow(/permission denied/);
        await expect(pg.query(`select * from public.artifact_skills`)).rejects.toThrow(/permission denied/);
        await expect(pg.query(`select * from public.artifact_knowledge_nodes`)).rejects.toThrow(/permission denied/);
        await expect(pg.query(`select * from public.artifact_quests`)).rejects.toThrow(/permission denied/);
        await expect(pg.query(`select * from public.artifact_activities`)).rejects.toThrow(/permission denied/);
        await expect(pg.query(`select * from public.artifact_evidence`)).rejects.toThrow(/permission denied/);
      });
    });
  });
});
