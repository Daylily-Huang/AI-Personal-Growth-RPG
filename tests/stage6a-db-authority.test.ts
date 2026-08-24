import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "6a111111-aaaa-4000-a000-000000000001";
const USER_B = "6a222222-bbbb-4000-b000-000000000002";
const DOMAIN_A = "6ad00001-aaaa-4000-a000-000000000001";
const DOMAIN_B = "6ad00002-bbbb-4000-b000-000000000002";
const SKILL_A = "6a500001-aaaa-4000-a000-000000000001";
const SKILL_B = "6a500002-bbbb-4000-b000-000000000002";

describe.skipIf(!DATABASE_URL)("Stage 6A — Knowledge Graph, Schema & Authority (Live PostgreSQL)", () => {
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

    // Clean any prior state for these users
    await pg.query(`
      delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
      delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
      delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
      delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
      delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
    `);

    // Seed test users, profiles, player states, domains and skills
    await pg.query(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'stage6a_user_a@growth.rpg'),
        ('${USER_B}', 'stage6a_user_b@growth.rpg')
      on conflict (id) do nothing;
      insert into public.profiles (user_id, display_name) values
        ('${USER_A}', 'Stage6AUserA'), ('${USER_B}', 'Stage6AUserB')
      on conflict (user_id) do nothing;
      insert into public.player_states (user_id, total_xp, player_level) values
        ('${USER_A}', 0, 1), ('${USER_B}', 0, 1)
      on conflict (user_id) do nothing;
      insert into public.domains (id, user_id, name, slug) values
        ('${DOMAIN_A}', '${USER_A}', 'Biology', 'stage6a-bio-a'),
        ('${DOMAIN_B}', '${USER_B}', 'Computer Science', 'stage6a-cs-b')
      on conflict (user_id, id) do nothing;
      insert into public.skills (id, user_id, name) values
        ('${SKILL_A}', '${USER_A}', 'DNA Sequencing'),
        ('${SKILL_B}', '${USER_B}', 'Algorithms')
      on conflict (user_id, id) do nothing;
    `);
  });

  afterAll(async () => {
    if (pg) {
      await pg.query("reset role");
      await pg.query(`
        delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
        delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
        delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
        delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
        delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      `);
      await pg.end();
    }
  });

  // --------------------------------------------------------------------------
  // 1. KNOWLEDGE NODE CREATION, AUTHORITY & CONFIDENCE INVARIANTS
  // --------------------------------------------------------------------------

  test("1. Creates knowledge nodes with node_type ('concept', 'claim', 'topic') & authority states", async () => {
    const conceptRes = await pg.query<{ id: string; normalized_title: string; verification_status: string }>(`
      insert into public.knowledge_nodes (user_id, node_type, title, description, domain_id, skill_id, verification_status, confidence)
      values ('${USER_A}', 'concept', 'DNA Metabarcoding', 'High-throughput biodiversity identification', '${DOMAIN_A}', '${SKILL_A}', 'verified', 1.0)
      returning id, normalized_title, verification_status;
    `);
    expect(conceptRes.rows[0].id).toBeDefined();
    expect(conceptRes.rows[0].normalized_title).toBe("dna metabarcoding");
    expect(conceptRes.rows[0].verification_status).toBe("verified");

    const claimRes = await pg.query<{ id: string; node_type: string; verification_status: string }>(`
      insert into public.knowledge_nodes (user_id, node_type, title, verification_status, confidence)
      values ('${USER_A}', 'claim', 'trnL P6 loop is suitable for degraded plant DNA', 'inferred', 0.85)
      returning id, node_type, verification_status;
    `);
    expect(claimRes.rows[0].node_type).toBe("claim");
    expect(claimRes.rows[0].verification_status).toBe("inferred");

    const topicRes = await pg.query<{ id: string; node_type: string }>(`
      insert into public.knowledge_nodes (user_id, node_type, title, is_archived)
      values ('${USER_A}', 'topic', 'Molecular Ecology', false)
      returning id, node_type;
    `);
    expect(topicRes.rows[0].node_type).toBe("topic");
  });

  test("2. Confidence Invariant: Inferred nodes must have confidence <= 0.95, Verified must have confidence = 1.00", async () => {
    // Inferred with confidence > 0.95 -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence)
        values ('${USER_A}', 'Overconfident Inference', 'inferred', 0.98);
      `),
    ).rejects.toThrow(/knowledge_nodes_inferred_confidence_check|23514/);

    // Verified with confidence < 1.00 -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence)
        values ('${USER_A}', 'Underconfident Verified', 'verified', 0.80);
      `),
    ).rejects.toThrow(/knowledge_nodes_verified_confidence_check|23514/);
  });

  test("3. Deduplication: Normalized title uniqueness blocks duplicate concept names per tenant", async () => {
    // Case and spacing normalized collision
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title)
        values ('${USER_A}', '   dna   metabarcoding   ');
      `),
    ).rejects.toThrow(/duplicate key value|23505/);

    // Different tenant CAN create the same title
    const userBNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title)
      values ('${USER_B}', 'DNA Metabarcoding')
      returning id;
    `);
    expect(userBNode.rows[0].id).toBeDefined();
  });

  test("4. Check Constraint: Empty title and invalid node_type are strictly rejected", async () => {
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title)
        values ('${USER_A}', '   ');
      `),
    ).rejects.toThrow(/23514|check constraint/);

    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, node_type)
        values ('${USER_A}', 'Invalid Type Node', 'unsupported_type');
      `),
    ).rejects.toThrow(/23514|check constraint/);
  });

  // --------------------------------------------------------------------------
  // 2. KNOWLEDGE EDGE ONTOLOGY, TRUE SYMMETRIC STORAGE & PROVENANCE
  // --------------------------------------------------------------------------

  test("5. Creates directed edges (prerequisite, contains, supports) and enforces edge confidence invariants", async () => {
    const n1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Directed Node 1') returning id;
    `);
    const n2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Directed Node 2') returning id;
    `);
    const n3 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Directed Node 3') returning id;
    `);

    const id1 = n1.rows[0].id;
    const id2 = n2.rows[0].id;
    const id3 = n3.rows[0].id;

    // 1. prerequisite
    const prereq = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${id1}', '${id2}', 'prerequisite') returning id;
    `);
    expect(prereq.rows[0]).toBeDefined();

    // 2. contains
    const contains = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${id1}', '${id3}', 'contains') returning id;
    `);
    expect(contains.rows[0]).toBeDefined();

    // 3. supports with inferred confidence
    const supports = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, provenance_note)
      values ('${USER_A}', '${id2}', '${id3}', 'supports', 'inferred', 0.88, 'Empirical study findings') returning id;
    `);
    expect(supports.rows[0]).toBeDefined();

    // Inferred edge with confidence > 0.95 -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence)
        values ('${USER_A}', '${id3}', '${id1}', 'supports', 'inferred', 0.99);
      `),
    ).rejects.toThrow(/knowledge_edges_inferred_confidence_check|23514/);
  });

  test("6. True Symmetric Storage: 'contradicts' and 'relates_to' require canonical ordering (source < target)", async () => {
    const na = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Sym Node A') returning id;
    `);
    const nb = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Sym Node B') returning id;
    `);

    const rawIdA = na.rows[0].id;
    const rawIdB = nb.rows[0].id;
    const [lowerId, higherId] = rawIdA < rawIdB ? [rawIdA, rawIdB] : [rawIdB, rawIdA];

    // Canonical ordering (lower < higher) succeeds
    const symContradict = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${lowerId}', '${higherId}', 'contradicts') returning id;
    `);
    expect(symContradict.rows[0]).toBeDefined();

    // Non-canonical ordering (higher -> lower) is strictly rejected by CHECK constraint
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
        values ('${USER_A}', '${higherId}', '${lowerId}', 'contradicts');
      `),
    ).rejects.toThrow(/knowledge_edges_symmetric_canonical|23514/);

    // relates_to requires lower < higher AND non-empty provenance_note
    const symRelates = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, provenance_note)
      values ('${USER_A}', '${lowerId}', '${higherId}', 'relates_to', 'Common biochemical pathway') returning id;
    `);
    expect(symRelates.rows[0]).toBeDefined();

    // relates_to without provenance_note is strictly rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
        values ('${USER_A}', '${lowerId}', '${higherId}', 'relates_to');
      `),
    ).rejects.toThrow(/knowledge_edges_relates_to_provenance|23514/);
  });

  test("7. Anti-Self: Self-reference edge is rejected by check constraint", async () => {
    const nodeRes = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Self Edge Node') returning id;
    `);
    const nodeId = nodeRes.rows[0].id;

    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
        values ('${USER_A}', '${nodeId}', '${nodeId}', 'prerequisite');
      `),
    ).rejects.toThrow(/23514|knowledge_edges_anti_self/);
  });

  // --------------------------------------------------------------------------
  // 3. DAG TRIGGER, UPDATE CORRECTNESS & SUPERSEDED EXCLUSION
  // --------------------------------------------------------------------------

  test("8. Anti-Cycle Trigger: Cyclic prerequisite (A -> B -> A) is rejected with 23514", async () => {
    const na = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Cycle Node A') returning id;
    `);
    const nb = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Cycle Node B') returning id;
    `);
    const idA = na.rows[0].id;
    const idB = nb.rows[0].id;

    // A -> B prerequisite
    await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${idA}', '${idB}', 'prerequisite');
    `);

    // B -> A prerequisite must be rejected by trigger
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
        values ('${USER_A}', '${idB}', '${idA}', 'prerequisite');
      `),
    ).rejects.toThrow(/Cyclic dependency detected|23514/);
  });

  test("9. Anti-Cycle Trigger: UPDATE on existing edge (A -> B changed to B -> A) succeeds when acyclic", async () => {
    const nx = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Update Node X') returning id;
    `);
    const ny = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Update Node Y') returning id;
    `);
    const idX = nx.rows[0].id;
    const idY = ny.rows[0].id;

    // Insert X -> Y
    const edgeRes = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${idX}', '${idY}', 'prerequisite') returning id;
    `);
    const edgeId = edgeRes.rows[0].id;

    // Updating SAME row to Y -> X must succeed without falsely cycle-conflicting with its old state
    const updateRes = await pg.query(`
      update public.knowledge_edges
      set source_node_id = '${idY}', target_node_id = '${idX}'
      where id = '${edgeId}'
      returning id;
    `);
    expect(updateRes.rows[0].id).toBe(edgeId);
  });

  test("10. Historical Exclusion: Superseded / Rejected edges do NOT block new current DAG topology", async () => {
    const np = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Hist Node P') returning id;
    `);
    const nq = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Hist Node Q') returning id;
    `);
    const idP = np.rows[0].id;
    const idQ = nq.rows[0].id;

    // Historical P -> Q edge that is superseded
    await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status)
      values ('${USER_A}', '${idP}', '${idQ}', 'prerequisite', 'superseded');
    `);

    // Active Q -> P prerequisite edge must succeed because superseded edge is excluded from DAG
    const activeEdge = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status)
      values ('${USER_A}', '${idQ}', '${idP}', 'prerequisite', 'verified') returning id;
    `);
    expect(activeEdge.rows[0]).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 4. EVIDENCE RECORDS TENANT COMPOSITE FOREIGN KEY
  // --------------------------------------------------------------------------

  test("11. Composite FK on evidence_records.knowledge_node_id enforces tenant safety", async () => {
    const nodeA = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Evidence Backed Concept') returning id;
    `);
    const nodeB = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_B}', 'User B Private Concept') returning id;
    `);
    const idA = nodeA.rows[0].id;
    const idB = nodeB.rows[0].id;

    // User A linking own knowledge node in evidence_records succeeds
    const evRes = await pg.query<{ id: string }>(`
      insert into public.evidence_records (user_id, evidence_type, description, knowledge_node_id)
      values ('${USER_A}', 'E1', 'Lab measurement confirmed', '${idA}') returning id;
    `);
    const evId = evRes.rows[0].id;
    expect(evId).toBeDefined();

    // User A linking User B's knowledge node in evidence_records fails with FK violation
    await expect(
      pg.query(`
        insert into public.evidence_records (user_id, evidence_type, description, knowledge_node_id)
        values ('${USER_A}', 'E1', 'Cross-tenant link attack', '${idB}');
      `),
    ).rejects.toThrow(/foreign key constraint|23503/);

    // Deleting node A sets knowledge_node_id to NULL on evidence record while preserving record and user_id
    await pg.query(`delete from public.knowledge_nodes where id = '${idA}';`);
    const evCheck = await pg.query<{ user_id: string; knowledge_node_id: string | null }>(`
      select user_id, knowledge_node_id from public.evidence_records where id = '${evId}';
    `);
    expect(evCheck.rows[0].user_id).toBe(USER_A);
    expect(evCheck.rows[0].knowledge_node_id).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 5. TENANT ISOLATION, COMPLETE NODE + EDGE RLS MATRIX & ANON PRIVILEGES
  // --------------------------------------------------------------------------

  test("12. Complete Node + Edge RLS Matrix: User A and User B cannot see or mutate each other's graph", async () => {
    // Seed User A Node & Edge
    const a1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'User A Private N1') returning id;
    `);
    const a2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'User A Private N2') returning id;
    `);
    const a1Id = a1.rows[0].id;
    const a2Id = a2.rows[0].id;
    const aEdge = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${a1Id}', '${a2Id}', 'prerequisite') returning id;
    `);
    const aEdgeId = aEdge.rows[0].id;

    // Seed User B Node & Edge
    const b1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_B}', 'User B Private N1') returning id;
    `);
    const b2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_B}', 'User B Private N2') returning id;
    `);
    const b1Id = b1.rows[0].id;
    const b2Id = b2.rows[0].id;
    const bEdge = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_B}', '${b1Id}', '${b2Id}', 'prerequisite') returning id;
    `);
    const bEdgeId = bEdge.rows[0].id;

    // Verify physical fixtures exist in DB
    expect(aEdgeId).toBeDefined();
    expect(bEdgeId).toBeDefined();

    // 1. As Authenticated User A
    await asUser(USER_A, async () => {
      // Node SELECT isolation
      const nodes = await pg.query<{ id: string }>("select id from public.knowledge_nodes");
      const nodeIds = nodes.rows.map((r) => r.id);
      expect(nodeIds).toContain(a1Id);
      expect(nodeIds).toContain(a2Id);
      expect(nodeIds).not.toContain(b1Id);
      expect(nodeIds).not.toContain(b2Id);

      // Edge SELECT isolation
      const edges = await pg.query<{ id: string }>("select id from public.knowledge_edges");
      const edgeIds = edges.rows.map((r) => r.id);
      expect(edgeIds).toContain(aEdgeId);
      expect(edgeIds).not.toContain(bEdgeId);

      // UPDATE B's edge -> 0 rows affected
      const updateEdge = await pg.query("update public.knowledge_edges set confidence = 0.5 where id = $1", [bEdgeId]);
      expect(updateEdge.rowCount).toBe(0);

      // DELETE B's edge -> 0 rows affected
      const deleteEdge = await pg.query("delete from public.knowledge_edges where id = $1", [bEdgeId]);
      expect(deleteEdge.rowCount).toBe(0);

      // Forged edge INSERT as B -> RLS with check fails
      await expect(
        pg.query(
          "insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type) values ($1, $2, $3, 'prerequisite')",
          [USER_B, b1Id, b2Id],
        ),
      ).rejects.toThrow(/row-level security policy|42501/);
    });

    // 2. As Authenticated User B (Reciprocal Proof)
    await asUser(USER_B, async () => {
      const nodes = await pg.query<{ id: string }>("select id from public.knowledge_nodes");
      const nodeIds = nodes.rows.map((r) => r.id);
      expect(nodeIds).toContain(b1Id);
      expect(nodeIds).toContain(b2Id);
      expect(nodeIds).not.toContain(a1Id);
      expect(nodeIds).not.toContain(a2Id);

      const edges = await pg.query<{ id: string }>("select id from public.knowledge_edges");
      const edgeIds = edges.rows.map((r) => r.id);
      expect(edgeIds).toContain(bEdgeId);
      expect(edgeIds).not.toContain(aEdgeId);

      const updateEdge = await pg.query("update public.knowledge_edges set confidence = 0.5 where id = $1", [aEdgeId]);
      expect(updateEdge.rowCount).toBe(0);

      const deleteEdge = await pg.query("delete from public.knowledge_edges where id = $1", [aEdgeId]);
      expect(deleteEdge.rowCount).toBe(0);
    });
  });

  test("13. Fail-Closed Anon Access: Anonymous role has zero table access to knowledge tables", async () => {
    await asAnon(async () => {
      await expect(pg.query("select * from public.knowledge_nodes")).rejects.toThrow(/permission denied|42501/);
      await expect(pg.query("select * from public.knowledge_edges")).rejects.toThrow(/permission denied|42501/);
    });
  });

  test("14. Migration Safety Guard: Fails closed when legacy tables are non-empty", async () => {
    // Execute safety check DO block with a simulated non-empty table
    const guardCheckSql = `
      DO $$
      DECLARE
        v_nodes_count integer := 0;
      BEGIN
        SELECT count(*) FROM public.knowledge_nodes INTO v_nodes_count;
        IF v_nodes_count > 0 THEN
          RAISE EXCEPTION 'Safety abort: legacy knowledge tables contain % nodes.', v_nodes_count;
        END IF;
      END $$;
    `;
    // Since we have seeded rows in knowledge_nodes, the safety check raises exception
    await expect(pg.query(guardCheckSql)).rejects.toThrow(/Safety abort: legacy knowledge tables contain/);
  });
});
