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

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    // Clean any prior state for these users
    await pg.query(`
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
        delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
        delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
        delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
        delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      `);
      await pg.end();
    }
  });

  // --------------------------------------------------------------------------
  // 1. KNOWLEDGE NODE CREATION & DEDUPLICATION
  // --------------------------------------------------------------------------

  test("1. Creates knowledge nodes with node_type ('concept', 'claim', 'topic')", async () => {
    const conceptRes = await pg.query<{ id: string; normalized_title: string }>(`
      insert into public.knowledge_nodes (user_id, node_type, title, description, domain_id, skill_id)
      values ('${USER_A}', 'concept', 'DNA Metabarcoding', 'High-throughput biodiversity identification', '${DOMAIN_A}', '${SKILL_A}')
      returning id, normalized_title;
    `);
    expect(conceptRes.rows[0].id).toBeDefined();
    expect(conceptRes.rows[0].normalized_title).toBe("dna metabarcoding");

    const claimRes = await pg.query<{ id: string; node_type: string }>(`
      insert into public.knowledge_nodes (user_id, node_type, title, verification_status, confidence)
      values ('${USER_A}', 'claim', 'trnL P6 loop is suitable for degraded plant DNA', 'inferred', 0.85)
      returning id, node_type;
    `);
    expect(claimRes.rows[0].node_type).toBe("claim");

    const topicRes = await pg.query<{ id: string; node_type: string }>(`
      insert into public.knowledge_nodes (user_id, node_type, title)
      values ('${USER_A}', 'topic', 'Molecular Ecology')
      returning id, node_type;
    `);
    expect(topicRes.rows[0].node_type).toBe("topic");
  });

  test("2. Deduplication: Normalized title uniqueness blocks duplicate concept names per tenant", async () => {
    // Exact match collision
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title)
        values ('${USER_A}', 'DNA Metabarcoding');
      `),
    ).rejects.toThrow(/duplicate key value|23505/);

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

  test("3. Check Constraint: Empty title is strictly rejected", async () => {
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title)
        values ('${USER_A}', '   ');
      `),
    ).rejects.toThrow(/23514|check constraint/);
  });

  test("4. Check Constraint: Invalid node_type is strictly rejected", async () => {
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, node_type)
        values ('${USER_A}', 'Invalid Type Node', 'unsupported_type');
      `),
    ).rejects.toThrow(/23514|check constraint/);
  });

  // --------------------------------------------------------------------------
  // 2. KNOWLEDGE EDGE ONTOLOGY & CYCLE INVARIANTS
  // --------------------------------------------------------------------------

  test("5. Creates edges across all 5 relation types", async () => {
    const n1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Concept N1') returning id;
    `);
    const n2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Concept N2') returning id;
    `);
    const n3 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Concept N3') returning id;
    `);
    const n4 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Concept N4') returning id;
    `);
    const n5 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Concept N5') returning id;
    `);
    const n6 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Concept N6') returning id;
    `);

    const id1 = n1.rows[0].id;
    const id2 = n2.rows[0].id;
    const id3 = n3.rows[0].id;
    const id4 = n4.rows[0].id;
    const id5 = n5.rows[0].id;
    const id6 = n6.rows[0].id;

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

    // 3. supports
    const supports = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, confidence, provenance_note)
      values ('${USER_A}', '${id2}', '${id4}', 'supports', 0.88, 'Empirical study findings') returning id;
    `);
    expect(supports.rows[0]).toBeDefined();

    // 4. contradicts
    const contradicts = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${id4}', '${id5}', 'contradicts') returning id;
    `);
    expect(contradicts.rows[0]).toBeDefined();

    // 5. relates_to
    const relatesTo = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${id5}', '${id6}', 'relates_to') returning id;
    `);
    expect(relatesTo.rows[0]).toBeDefined();
  });

  test("6. Anti-Self: Self-reference edge is rejected by check constraint", async () => {
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

  test("7. Anti-Cycle Trigger: Cyclic prerequisite (A -> B -> A) is rejected with 23514", async () => {
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

  test("8. Anti-Cycle Trigger: 3-node cyclic contains (A -> B -> C -> A) is rejected with 23514", async () => {
    const n1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Contains Tree A') returning id;
    `);
    const n2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Contains Tree B') returning id;
    `);
    const n3 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Contains Tree C') returning id;
    `);
    const id1 = n1.rows[0].id;
    const id2 = n2.rows[0].id;
    const id3 = n3.rows[0].id;

    // A -> B contains
    await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${id1}', '${id2}', 'contains');
    `);
    // B -> C contains
    await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${id2}', '${id3}', 'contains');
    `);

    // C -> A contains must be rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
        values ('${USER_A}', '${id3}', '${id1}', 'contains');
      `),
    ).rejects.toThrow(/Cyclic dependency detected|23514/);
  });

  test("9. Cycle-Allowed: supports, contradicts and relates_to permit mutual bidirectional edges", async () => {
    const nx = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Network Node X') returning id;
    `);
    const ny = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Network Node Y') returning id;
    `);
    const idX = nx.rows[0].id;
    const idY = ny.rows[0].id;

    // X -> Y supports
    await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${idX}', '${idY}', 'supports');
    `);
    // Y -> X supports (mutual synergy allowed)
    const mutualSupport = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${idY}', '${idX}', 'supports') returning id;
    `);
    expect(mutualSupport.rows[0]).toBeDefined();

    // X -> Y contradicts & Y -> X contradicts
    await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${idX}', '${idY}', 'contradicts');
    `);
    const mutualContradict = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${idY}', '${idX}', 'contradicts') returning id;
    `);
    expect(mutualContradict.rows[0]).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 3. TENANT ISOLATION & COMPOSITE FOREIGN KEYS
  // --------------------------------------------------------------------------

  test("10. Composite FK: Cross-tenant edge source/target is rejected by database engine", async () => {
    const nodeA = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Tenant Isolation Node A') returning id;
    `);
    const nodeB = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_B}', 'Tenant Isolation Node B') returning id;
    `);
    const idA = nodeA.rows[0].id;
    const idB = nodeB.rows[0].id;

    // User A trying to link User B's node as target
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
        values ('${USER_A}', '${idA}', '${idB}', 'prerequisite');
      `),
    ).rejects.toThrow(/foreign key constraint|23503/);

    // User A trying to link User B's node as source
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
        values ('${USER_A}', '${idB}', '${idA}', 'prerequisite');
      `),
    ).rejects.toThrow(/foreign key constraint|23503/);
  });

  test("11. Composite FK: Cross-tenant domain_id or skill_id reference is rejected", async () => {
    // User A referencing User B's domain
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, domain_id)
        values ('${USER_A}', 'Cross Domain Concept', '${DOMAIN_B}');
      `),
    ).rejects.toThrow(/foreign key constraint|23503/);

    // User A referencing User B's skill
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, skill_id)
        values ('${USER_A}', 'Cross Skill Concept', '${SKILL_B}');
      `),
    ).rejects.toThrow(/foreign key constraint|23503/);
  });

  test("12. Cascade Deletion: Deleting a node cascades and removes its edges", async () => {
    const node1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Cascade Parent') returning id;
    `);
    const node2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'Cascade Child') returning id;
    `);
    const id1 = node1.rows[0].id;
    const id2 = node2.rows[0].id;

    const edgeRes = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type)
      values ('${USER_A}', '${id1}', '${id2}', 'contains') returning id;
    `);
    const edgeId = edgeRes.rows[0].id;

    // Delete node 1
    await pg.query(`delete from public.knowledge_nodes where id = '${id1}';`);

    // Edge must be cascaded
    const edgeCheck = await pg.query(`select 1 from public.knowledge_edges where id = '${edgeId}';`);
    expect(edgeCheck.rowCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 4. ROW LEVEL SECURITY (RLS) MATRIX
  // --------------------------------------------------------------------------

  test("13. RLS Matrix: User A can only see and mutate User A rows as authenticated role", async () => {
    const aNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_A}', 'RLS Private Node A') returning id;
    `);
    const bNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title) values ('${USER_B}', 'RLS Private Node B') returning id;
    `);
    const aId = aNode.rows[0].id;
    const bId = bNode.rows[0].id;

    // As User A
    await asUser(USER_A, async () => {
      // SELECT
      const res = await pg.query<{ id: string }>("select id from public.knowledge_nodes");
      const ids = res.rows.map((r) => r.id);
      expect(ids).toContain(aId);
      expect(ids).not.toContain(bId);

      // UPDATE B -> 0 rows affected
      const updateRes = await pg.query(
        "update public.knowledge_nodes set description = 'Hacked' where id = $1",
        [bId],
      );
      expect(updateRes.rowCount).toBe(0);

      // DELETE B -> 0 rows affected
      const deleteRes = await pg.query(
        "delete from public.knowledge_nodes where id = $1",
        [bId],
      );
      expect(deleteRes.rowCount).toBe(0);

      // INSERT with forged user_id -> RLS with check fails
      await expect(
        pg.query(
          "insert into public.knowledge_nodes (user_id, title) values ($1, 'Forged B Node')",
          [USER_B],
        ),
      ).rejects.toThrow(/new row violates row-level security policy|42501/);
    });

    // As User B
    await asUser(USER_B, async () => {
      const res = await pg.query<{ id: string }>("select id from public.knowledge_nodes");
      const ids = res.rows.map((r) => r.id);
      expect(ids).toContain(bId);
      expect(ids).not.toContain(aId);
    });
  });
});
