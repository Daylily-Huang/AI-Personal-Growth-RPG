import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "6d555555-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const USER_B = "6d555555-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const DOMAIN_A = "6d666666-1111-4000-a000-000000000001";
const DOMAIN_B = "6d666666-2222-4000-b000-000000000002";
const ACT_A = "6d999999-0000-4000-a000-00000000000a";
const ACT_B = "6d999999-0000-4000-b000-00000000000b";
const ART_A = "6daaaaaa-0000-4000-a000-00000000000a";
const ART_B = "6daaaaaa-0000-4000-b000-00000000000b";

const NODE_A1 = "6d777777-0000-4000-a000-000000000001";
const NODE_A2 = "6d777777-0000-4000-a000-000000000002";
const NODE_B1 = "6d777777-0000-4000-b000-000000000001";
const NODE_B2 = "6d777777-0000-4000-b000-000000000002";

const EDGE_A1 = "6d888888-0000-4000-a000-000000000001";
const EDGE_B1 = "6d888888-0000-4000-b000-000000000001";

/**
 * Stage 6D Gate — Knowledge Map RLS Isolation, Raw API Bypass Denial & Authority Security.
 *
 * Runs directly against live PostgreSQL under the `authenticated` role bound to User JWT claims.
 */
describe.skipIf(!DATABASE_URL)("Stage 6D — Knowledge Map Security & Authority Bypass Audit (Live PostgreSQL)", () => {
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

    // 1. Seed Auth Users, Profiles, Player States, Domains, Activities, Artifacts
    await pg.query(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'stage6d_user_a@growth.rpg'),
        ('${USER_B}', 'stage6d_user_b@growth.rpg')
      on conflict (id) do nothing;
      insert into public.profiles (user_id, display_name) values
        ('${USER_A}', 'Stage6DUserA'), ('${USER_B}', 'Stage6DUserB')
      on conflict (user_id) do nothing;
      insert into public.player_states (user_id, total_xp, player_level) values
        ('${USER_A}', 0, 1), ('${USER_B}', 0, 1)
      on conflict (user_id) do nothing;
      insert into public.domains (id, user_id, name, slug) values
        ('${DOMAIN_A}', '${USER_A}', '6D Domain A', 'stage6d-domain-a'),
        ('${DOMAIN_B}', '${USER_B}', '6D Domain B', 'stage6d-domain-b')
      on conflict (id) do nothing;
      insert into public.activities (id, user_id, raw_input, title, status, rules_version) values
        ('${ACT_A}', '${USER_A}', '6D seed activity A', '6D seed activity A', 'confirmed', 'v1'),
        ('${ACT_B}', '${USER_B}', '6D seed activity B', '6D seed activity B', 'confirmed', 'v1')
      on conflict (id) do nothing;
      insert into public.artifacts (id, user_id, title, artifact_type, description) values
        ('${ART_A}', '${USER_A}', '6D artifact A', 'document', 'Summary A'),
        ('${ART_B}', '${USER_B}', '6D artifact B', 'document', 'Summary B')
      on conflict (id) do nothing;
    `);

    // 2. Seed Knowledge Nodes (both inferred and verified)
    await pg.query(`
      insert into public.knowledge_nodes (id, user_id, domain_id, title, node_type, verification_status, confidence, verified_at, verified_by, source_type, source_id) values
        ('${NODE_A1}', '${USER_A}', '${DOMAIN_A}', '6D Concept A1 Inferred', 'concept', 'inferred', 0.85, null, null, 'ai_proposal', '${ACT_A}'),
        ('${NODE_A2}', '${USER_A}', '${DOMAIN_A}', '6D Concept A2 Verified', 'concept', 'verified', 1.00, now(), '${USER_A}', 'user_created', null),
        ('${NODE_B1}', '${USER_B}', '${DOMAIN_B}', '6D Concept B1 Inferred', 'concept', 'inferred', 0.80, null, null, 'ai_proposal', '${ACT_B}'),
        ('${NODE_B2}', '${USER_B}', '${DOMAIN_B}', '6D Concept B2 Verified', 'concept', 'verified', 1.00, now(), '${USER_B}', 'user_created', null)
      on conflict (id) do nothing;
    `);

    // 3. Seed Knowledge Edges
    await pg.query(`
      insert into public.knowledge_edges (id, user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id, provenance_note) values
        ('${EDGE_A1}', '${USER_A}', '${NODE_A1}', '${NODE_A2}', 'supports', 'inferred', 0.85, 'ai_proposal', '${ACT_A}', 'A supports A2'),
        ('${EDGE_B1}', '${USER_B}', '${NODE_B1}', '${NODE_B2}', 'supports', 'inferred', 0.80, 'ai_proposal', '${ACT_B}', 'B supports B2')
      on conflict (id) do nothing;
    `);
  });

  afterAll(async () => {
    if (!pg) return;
    await pg.query("reset role");
    await pg.query(`
      delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
      delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
      delete from public.artifacts where user_id in ('${USER_A}', '${USER_B}');
      delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
      delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      delete from public.player_states where user_id in ('${USER_A}', '${USER_B}');
      delete from public.profiles where user_id in ('${USER_A}', '${USER_B}');
      delete from auth.users where id in ('${USER_A}', '${USER_B}');
    `);
    await pg.end();
  });

  // =========================================================================
  // 1. RLS Tenant Isolation (knowledge_nodes & knowledge_edges)
  // =========================================================================

  test("1.1 RLS SELECT Isolation on knowledge_nodes: User A sees only User A nodes, zero User B leakage", async () => {
    await asUser(USER_A, async () => {
      const res = await pg.query("select id, user_id, title from public.knowledge_nodes");
      expect(res.rows.length).toBe(2);
      expect(res.rows.every((r) => r.user_id === USER_A)).toBe(true);

      const foreignQuery = await pg.query("select id from public.knowledge_nodes where user_id = $1", [USER_B]);
      expect(foreignQuery.rows.length).toBe(0);
    });

    await asUser(USER_B, async () => {
      const res = await pg.query("select id, user_id, title from public.knowledge_nodes");
      expect(res.rows.length).toBe(2);
      expect(res.rows.every((r) => r.user_id === USER_B)).toBe(true);
    });
  });

  test("1.2 RLS SELECT Isolation on knowledge_edges: User A sees only User A edges, zero User B leakage", async () => {
    await asUser(USER_A, async () => {
      const res = await pg.query("select id, user_id from public.knowledge_edges");
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe(EDGE_A1);
    });

    await asUser(USER_B, async () => {
      const res = await pg.query("select id, user_id from public.knowledge_edges");
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe(EDGE_B1);
    });
  });

  test("1.3 RLS Foreign Mutation Denial: User B cannot UPDATE or DELETE User A rows", async () => {
    await asUser(USER_B, async () => {
      // User B attempts to UPDATE User A's node title
      const updateNodeRes = await pg.query("update public.knowledge_nodes set title = 'Hacked' where id = $1", [NODE_A1]);
      expect(updateNodeRes.rowCount).toBe(0);

      // User B attempts to DELETE User A's edge
      const deleteEdgeRes = await pg.query("delete from public.knowledge_edges where id = $1", [EDGE_A1]);
      expect(deleteEdgeRes.rowCount).toBe(0);
    });

    // Verify User A's data was untouched
    const checkNode = await pg.query("select title from public.knowledge_nodes where id = $1", [NODE_A1]);
    expect(checkNode.rows[0].title).toBe("6D Concept A1 Inferred");
  });

  // =========================================================================
  // 2. Raw Data API Authority Bypass Denial (Migration 0040 Column Permissions)
  // =========================================================================

  test("2.1 Raw UPDATE of protected Node columns by authenticated role is DENIED by PostgreSQL permission revocation", async () => {
    await asUser(USER_A, async () => {
      // Direct raw UPDATE of verification_status -> 42501 (permission denied)
      await expect(
        pg.query("update public.knowledge_nodes set verification_status = 'verified' where id = $1", [NODE_A1]),
      ).rejects.toThrow(/permission denied/);

      // Direct raw UPDATE of confidence -> 42501
      await expect(
        pg.query("update public.knowledge_nodes set confidence = 1.0 where id = $1", [NODE_A1]),
      ).rejects.toThrow(/permission denied/);

      // Direct raw UPDATE of verified_at / verified_by -> 42501
      await expect(
        pg.query("update public.knowledge_nodes set verified_at = now() where id = $1", [NODE_A1]),
      ).rejects.toThrow(/permission denied/);

      await expect(
        pg.query("update public.knowledge_nodes set verified_by = $1 where id = $2", [USER_A, NODE_A1]),
      ).rejects.toThrow(/permission denied/);

      // Direct raw UPDATE of source_type / source_id -> 42501
      await expect(
        pg.query("update public.knowledge_nodes set source_type = 'user_created' where id = $1", [NODE_A1]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  test("2.2 Raw UPDATE of safe whitelisted Node columns (title, description, metadata, is_archived) SUCCEEDS", async () => {
    await asUser(USER_A, async () => {
      const res = await pg.query(
        "update public.knowledge_nodes set title = 'Updated Safe Title', description = 'Safe description' where id = $1",
        [NODE_A1],
      );
      expect(res.rowCount).toBe(1);
    });

    const check = await pg.query("select title, description from public.knowledge_nodes where id = $1", [NODE_A1]);
    expect(check.rows[0].title).toBe("Updated Safe Title");
    expect(check.rows[0].description).toBe("Safe description");
  });

  test("2.3 Raw UPDATE of protected Edge columns (verification_status, confidence, provenance_note, source_type) is DENIED", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query("update public.knowledge_edges set verification_status = 'verified' where id = $1", [EDGE_A1]),
      ).rejects.toThrow(/permission denied/);

      await expect(
        pg.query("update public.knowledge_edges set provenance_note = 'Malicious note' where id = $1", [EDGE_A1]),
      ).rejects.toThrow(/permission denied/);

      await expect(
        pg.query("update public.knowledge_edges set source_type = 'user_created' where id = $1", [EDGE_A1]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  // =========================================================================
  // 3. Sanctioned Authority RPC Matrix (verify_knowledge_node / reject_knowledge_node)
  // =========================================================================

  test("3.1 verify_knowledge_node RPC: Authenticated User A verifies owned inferred node -> 200 + audit stamped", async () => {
    await asUser(USER_A, async () => {
      const res = await pg.query("select * from public.verify_knowledge_node($1)", [NODE_A1]);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].verification_status).toBe("verified");
      expect(Number(res.rows[0].confidence)).toBe(1.0);
      expect(res.rows[0].verified_by).toBe(USER_A);
      expect(res.rows[0].verified_at).not.toBeNull();
    });

    // Verify on already verified node throws invalid_authority_transition
    await asUser(USER_A, async () => {
      await expect(
        pg.query("select * from public.verify_knowledge_node($1)", [NODE_A1]),
      ).rejects.toThrow(/invalid_authority_transition/);
    });
  });

  test("3.2 verify_knowledge_node RPC: User B cannot verify User A's node (Tenant Isolation throws node_not_found)", async () => {
    await asUser(USER_B, async () => {
      await expect(
        pg.query("select * from public.verify_knowledge_node($1)", [NODE_A1]),
      ).rejects.toThrow(/node_not_found/);
    });
  });

  test("3.3 reject_knowledge_node RPC: Authenticated User B rejects owned inferred node -> rejected state", async () => {
    await asUser(USER_B, async () => {
      const res = await pg.query("select * from public.reject_knowledge_node($1)", [NODE_B1]);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].verification_status).toBe("rejected");
    });
  });

  test("3.4 Anonymous / Public execution of authority RPCs is DENIED (Revoked execution for anon)", async () => {
    await asAnon(async () => {
      await expect(
        pg.query("select * from public.verify_knowledge_node($1)", [NODE_A1]),
      ).rejects.toThrow(/permission denied/);

      await expect(
        pg.query("select * from public.reject_knowledge_node($1)", [NODE_A1]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  // =========================================================================
  // 4. Provenance Target Integrity & Immutability Audit
  // =========================================================================

  test("4.1 Foreign provenance injection is blocked: User A cannot create node backed by User B activity", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(`
          insert into public.knowledge_nodes (user_id, domain_id, title, node_type, verification_status, confidence, source_type, source_id)
          values ('${USER_A}', '${DOMAIN_A}', 'Cross-tenant provenance test', 'concept', 'inferred', 0.8, 'activity', '${ACT_B}')
        `),
      ).rejects.toThrow();
    });
  });

  test("4.2 AI proposal direct insertion as verified is blocked by database constraint", async () => {
    await asUser(USER_A, async () => {
      await expect(
        pg.query(`
          insert into public.knowledge_nodes (user_id, domain_id, title, node_type, verification_status, confidence, source_type, source_id)
          values ('${USER_A}', '${DOMAIN_A}', 'AI Bypass Verified', 'concept', 'verified', 1.0, 'ai_proposal', '${ACT_A}')
        `),
      ).rejects.toThrow(/AI proposal must initially be inserted/);
    });
  });

  test("4.3 Deletion of Activity / Artifact referenced by Knowledge Node or Edge is BLOCKED", async () => {
    // Activity A is referenced by NODE_A1 / EDGE_A1
    await expect(
      pg.query("delete from public.activities where id = $1", [ACT_A]),
    ).rejects.toThrow(/referenced by knowledge provenance records/);
  });

  // =========================================================================
  // 5. Symmetric Relation Auto-Canonicalization & Determinism
  // =========================================================================

  test("5.1 Symmetric edge auto-canonicalization prevents duplicate reversed facts", async () => {
    // Raw SQL insert respects knowledge_edges_symmetric_canonical check constraint (source < target)
    const minNode = [NODE_A1, NODE_A2].sort()[0];
    const maxNode = [NODE_A1, NODE_A2].sort()[1];

    const res1 = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, provenance_note)
      values ('${USER_A}', '${minNode}', '${maxNode}', 'contradicts', 'inferred', 0.75, 'user_created', 'Symmetric conflict')
      returning source_node_id, target_node_id;
    `);

    expect(res1.rows[0].source_node_id).toBe(minNode);
    expect(res1.rows[0].target_node_id).toBe(maxNode);

    // Attempting to insert non-canonical reversed order is rejected by check constraint
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, provenance_note)
        values ('${USER_A}', '${maxNode}', '${minNode}', 'contradicts', 'inferred', 0.75, 'user_created', 'Non-canonical reversed')
      `),
    ).rejects.toThrow(/knowledge_edges_symmetric_canonical/);
  });
});
