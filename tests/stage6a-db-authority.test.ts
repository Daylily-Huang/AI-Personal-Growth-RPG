import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "6a111111-aaaa-4000-a000-000000000001";
const USER_B = "6a222222-bbbb-4000-b000-000000000002";
const DOMAIN_A = "6ad00001-aaaa-4000-a000-000000000001";
const DOMAIN_B = "6ad00002-bbbb-4000-b000-000000000002";
const SKILL_A = "6a500001-aaaa-4000-a000-000000000001";
const SKILL_B = "6a500002-bbbb-4000-b000-000000000002";
const ACTIVITY_A = "6ac00001-aaaa-4000-a000-000000000001";
const ACTIVITY_B = "6ac00002-bbbb-4000-b000-000000000002";
const ARTIFACT_A = "6aa00001-aaaa-4000-a000-000000000001";
const ARTIFACT_B = "6aa00002-bbbb-4000-b000-000000000002";
const FAKE_UUID = "6af00000-dead-4000-f000-000000000000";

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
      delete from public.artifacts where user_id in ('${USER_A}', '${USER_B}');
      delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
      delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
      delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
    `);

    // Seed test users, profiles, player states, domains, skills, activities, and artifacts
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
      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version) values
        ('${ACTIVITY_A}', '${USER_A}', 'Read Paper on DNA Barcoding', 'Reading study notes', 'study', 'confirmed', '1.0.0'),
        ('${ACTIVITY_B}', '${USER_B}', 'Read Paper on Graph Neural Networks', 'Study notes', 'study', 'confirmed', '1.0.0')
      on conflict (id) do nothing;
      insert into public.artifacts (id, user_id, title, artifact_type) values
        ('${ARTIFACT_A}', '${USER_A}', 'PCR Protocol PDF', 'document'),
        ('${ARTIFACT_B}', '${USER_B}', 'GNN Benchmark Code', 'code_repository')
      on conflict (id) do nothing;
    `);
  });

  afterAll(async () => {
    if (pg) {
      await pg.query("reset role");
      await pg.query(`
        delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
        delete from public.knowledge_edges where user_id in ('${USER_A}', '${USER_B}');
        delete from public.knowledge_nodes where user_id in ('${USER_A}', '${USER_B}');
        delete from public.artifacts where user_id in ('${USER_A}', '${USER_B}');
        delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
        delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
        delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      `);
      await pg.end();
    }
  });

  // --------------------------------------------------------------------------
  // 1. KNOWLEDGE NODE CREATION, AUTHORITY & VERIFICATION AUDIT
  // --------------------------------------------------------------------------

  test("1. Creates verified and inferred knowledge nodes with complete audit trail", async () => {
    // 1. Verified user-created concept node (with verified_at and verified_by = user_id)
    const conceptRes = await pg.query<{ id: string; normalized_title: string; verification_status: string }>(`
      insert into public.knowledge_nodes (
        user_id, node_type, title, description, domain_id, skill_id,
        verification_status, confidence, source_type, verified_at, verified_by
      ) values (
        '${USER_A}', 'concept', 'DNA Metabarcoding', 'High-throughput biodiversity identification', '${DOMAIN_A}', '${SKILL_A}',
        'verified', 1.0, 'user_created', now(), '${USER_A}'
      )
      returning id, normalized_title, verification_status;
    `);
    expect(conceptRes.rows[0].id).toBeDefined();
    expect(conceptRes.rows[0].normalized_title).toBe("dna metabarcoding");
    expect(conceptRes.rows[0].verification_status).toBe("verified");

    // 2. Inferred claim node originating from an AI proposal linked to activity
    const claimRes = await pg.query<{ id: string; node_type: string; verification_status: string }>(`
      insert into public.knowledge_nodes (
        user_id, node_type, title, verification_status, confidence, source_type, source_id
      ) values (
        '${USER_A}', 'claim', 'trnL P6 loop is suitable for degraded plant DNA', 'inferred', 0.85, 'ai_proposal', '${ACTIVITY_A}'
      )
      returning id, node_type, verification_status;
    `);
    expect(claimRes.rows[0].node_type).toBe("claim");
    expect(claimRes.rows[0].verification_status).toBe("inferred");
  });

  test("2. Verification Audit Invariant: Verified node must have confidence=1.00, verified_at, and verified_by=user_id", async () => {
    // Verified with verified_at NULL -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_by)
        values ('${USER_A}', 'Audit Missing Timestamp', 'verified', 1.00, '${USER_A}');
      `),
    ).rejects.toThrow(/knowledge_nodes_verified_audit_check|23514/);

    // Verified with verified_by NULL -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at)
        values ('${USER_A}', 'Audit Missing Verifier', 'verified', 1.00, now());
      `),
    ).rejects.toThrow(/knowledge_nodes_verified_audit_check|23514/);

    // Verified with verified_by = USER_B (cross-tenant verifier claim) -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', 'Cross Tenant Verifier Claim', 'verified', 1.00, now(), '${USER_B}');
      `),
    ).rejects.toThrow(/knowledge_nodes_verified_audit_check|23514/);

    // Verified with confidence < 1.00 -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', 'Underconfident Verified', 'verified', 0.80, now(), '${USER_A}');
      `),
    ).rejects.toThrow(/knowledge_nodes_verified_audit_check|23514/);

    // Inferred with confidence > 0.95 -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', 'Overconfident Inferred', 'inferred', 0.98, 'ai_proposal', '${ACTIVITY_A}');
      `),
    ).rejects.toThrow(/knowledge_nodes_inferred_confidence_check|23514/);
  });

  test("3. Provenance Contract: activity, artifact & ai_proposal require source_id", async () => {
    // ai_proposal without source_id -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type)
        values ('${USER_A}', 'Orphan Proposal', 'inferred', 0.80, 'ai_proposal');
      `),
    ).rejects.toThrow(/source_id is required|knowledge_nodes_provenance_source_check|23514/);

    // activity without source_id -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type)
        values ('${USER_A}', 'Orphan Activity Node', 'inferred', 0.80, 'activity');
      `),
    ).rejects.toThrow(/source_id is required|knowledge_nodes_provenance_source_check|23514/);
  });

  // --------------------------------------------------------------------------
  // 1.1 AI PROPOSAL INITIAL INSERTION INVARIANT & REAL TRANSITION (P1-1)
  // --------------------------------------------------------------------------

  test("3.1 AI-Proposal Insertion Invariant & Real Inferred -> Verified Transition (P1-1)", async () => {
    // 1. Node: direct INSERT with ai_proposal + verified MUST be rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (
          user_id, title, verification_status, confidence, source_type, source_id, verified_at, verified_by
        ) values (
          '${USER_A}', 'Sneaky Direct Verified Proposal Node', 'verified', 1.00, 'ai_proposal', '${ACTIVITY_A}', now(), '${USER_A}'
        );
      `),
    ).rejects.toThrow(/AI proposal must initially be inserted with verification_status = inferred|23514/);

    // 2. Node: initial INSERT with ai_proposal + inferred MUST succeed
    const propNodeRes = await pg.query<{ id: string; verification_status: string; confidence: string }>(`
      insert into public.knowledge_nodes (
        user_id, title, verification_status, confidence, source_type, source_id
      ) values (
        '${USER_A}', 'Legitimate Inferred Proposal Node', 'inferred', 0.82, 'ai_proposal', '${ACTIVITY_A}'
      ) returning id, verification_status, confidence;
    `);
    const propNodeId = propNodeRes.rows[0].id;
    expect(propNodeRes.rows[0].verification_status).toBe("inferred");
    expect(Number(propNodeRes.rows[0].confidence)).toBe(0.82);

    // 3. Node: real UPDATE transition from inferred -> verified MUST succeed
    const verifiedNodeRes = await pg.query<{ id: string; verification_status: string; confidence: string; verified_by: string }>(`
      update public.knowledge_nodes
      set verification_status = 'verified', confidence = 1.00, verified_at = now(), verified_by = '${USER_A}'
      where id = '${propNodeId}'
      returning id, verification_status, confidence, verified_by;
    `);
    expect(verifiedNodeRes.rows[0].verification_status).toBe("verified");
    expect(Number(verifiedNodeRes.rows[0].confidence)).toBe(1.0);
    expect(verifiedNodeRes.rows[0].verified_by).toBe(USER_A);

    // Seed target node for edge test
    const targetNodeRes = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Edge Transition Target Node', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const targetNodeId = targetNodeRes.rows[0].id;

    // 4. Edge: direct INSERT with ai_proposal + verified MUST be rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (
          user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id, verified_at, verified_by
        ) values (
          '${USER_A}', '${propNodeId}', '${targetNodeId}', 'supports', 'verified', 1.00, 'ai_proposal', '${ACTIVITY_A}', now(), '${USER_A}'
        );
      `),
    ).rejects.toThrow(/AI proposal must initially be inserted with verification_status = inferred|23514/);

    // 5. Edge: initial INSERT with ai_proposal + inferred MUST succeed
    const propEdgeRes = await pg.query<{ id: string; verification_status: string; confidence: string }>(`
      insert into public.knowledge_edges (
        user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id
      ) values (
        '${USER_A}', '${propNodeId}', '${targetNodeId}', 'supports', 'inferred', 0.85, 'ai_proposal', '${ACTIVITY_A}'
      ) returning id, verification_status, confidence;
    `);
    const propEdgeId = propEdgeRes.rows[0].id;
    expect(propEdgeRes.rows[0].verification_status).toBe("inferred");
    expect(Number(propEdgeRes.rows[0].confidence)).toBe(0.85);

    // 6. Edge: real UPDATE transition from inferred -> verified MUST succeed
    const verifiedEdgeRes = await pg.query<{ id: string; verification_status: string; confidence: string; verified_by: string }>(`
      update public.knowledge_edges
      set verification_status = 'verified', confidence = 1.00, verified_at = now(), verified_by = '${USER_A}'
      where id = '${propEdgeId}'
      returning id, verification_status, confidence, verified_by;
    `);
    expect(verifiedEdgeRes.rows[0].verification_status).toBe("verified");
    expect(Number(verifiedEdgeRes.rows[0].confidence)).toBe(1.0);
    expect(verifiedEdgeRes.rows[0].verified_by).toBe(USER_A);
  });

  // --------------------------------------------------------------------------
  // 1.2 PROVENANCE IMMUTABILITY: RECLASSIFICATION & ERASURE PREVENTION (P1-1)
  // --------------------------------------------------------------------------

  test("3.2 Provenance Identity Immutability on UPDATE (Nodes & Edges - P1-1)", async () => {
    // 1. Node Reclassification Attack: verified user_created -> UPDATE source_type=ai_proposal MUST be rejected
    const userNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, verified_at, verified_by)
      values ('${USER_A}', 'Immutable Source Node 1', 'verified', 1.0, 'user_created', now(), '${USER_A}')
      returning id;
    `);
    const userNodeId = userNode.rows[0].id;

    await expect(
      pg.query(`
        update public.knowledge_nodes
        set source_type = 'ai_proposal', source_id = '${ACTIVITY_A}'
        where id = '${userNodeId}';
      `),
    ).rejects.toThrow(/Provenance identity \(source_type and source_id\) is immutable after creation|23514/);

    // 2. Node Origin Erasure Attack: inferred ai_proposal -> UPDATE source_type=user_created MUST be rejected
    const aiNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', 'Immutable AI Node 2', 'inferred', 0.80, 'ai_proposal', '${ACTIVITY_A}')
      returning id;
    `);
    const aiNodeId = aiNode.rows[0].id;

    await expect(
      pg.query(`
        update public.knowledge_nodes
        set source_type = 'user_created', source_id = null
        where id = '${aiNodeId}';
      `),
    ).rejects.toThrow(/Provenance identity \(source_type and source_id\) is immutable after creation|23514/);

    // 3. Node Legitimate Promotion: updating verification_status while source_type/source_id remain unchanged MUST succeed
    const promoNode = await pg.query<{ id: string; verification_status: string }>(`
      update public.knowledge_nodes
      set verification_status = 'verified', confidence = 1.00, verified_at = now(), verified_by = '${USER_A}'
      where id = '${aiNodeId}'
      returning id, verification_status;
    `);
    expect(promoNode.rows[0].verification_status).toBe("verified");

    // 4. Edge Reclassification Attack: verified user_created -> UPDATE source_type=ai_proposal MUST be rejected
    const userEdge = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, verified_at, verified_by)
      values ('${USER_A}', '${userNodeId}', '${aiNodeId}', 'prerequisite', 'verified', 1.0, 'user_created', now(), '${USER_A}')
      returning id;
    `);
    const userEdgeId = userEdge.rows[0].id;

    await expect(
      pg.query(`
        update public.knowledge_edges
        set source_type = 'ai_proposal', source_id = '${ACTIVITY_A}'
        where id = '${userEdgeId}';
      `),
    ).rejects.toThrow(/Provenance identity \(source_type and source_id\) is immutable after creation|23514/);

    // 5. Edge Origin Erasure Attack: inferred ai_proposal -> UPDATE source_type=user_created MUST be rejected
    const aiEdge = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', '${userNodeId}', '${aiNodeId}', 'supports', 'inferred', 0.85, 'ai_proposal', '${ACTIVITY_A}')
      returning id;
    `);
    const aiEdgeId = aiEdge.rows[0].id;

    await expect(
      pg.query(`
        update public.knowledge_edges
        set source_type = 'user_created', source_id = null
        where id = '${aiEdgeId}';
      `),
    ).rejects.toThrow(/Provenance identity \(source_type and source_id\) is immutable after creation|23514/);

    // 6. Edge Legitimate Promotion: updating verification_status while source_type/source_id remain unchanged MUST succeed
    const promoEdge = await pg.query<{ id: string; verification_status: string }>(`
      update public.knowledge_edges
      set verification_status = 'verified', confidence = 1.00, verified_at = now(), verified_by = '${USER_A}'
      where id = '${aiEdgeId}'
      returning id, verification_status;
    `);
    expect(promoEdge.rows[0].verification_status).toBe("verified");
  });

  // --------------------------------------------------------------------------
  // 1.3 PROVENANCE TARGET INTEGRITY TRIGGER (P1-1)
  // --------------------------------------------------------------------------

  test("3.3 Provenance Target Integrity: Node source_id must exist and belong to the same tenant", async () => {
    // 1. activity source: nonexistent UUID -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', 'Fake Activity Node', 'inferred', 0.80, 'activity', '${FAKE_UUID}');
      `),
    ).rejects.toThrow(/Invalid provenance target: activity|23503/);

    // 2. activity source: foreign-tenant (User B) activity -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', 'Cross Activity Node', 'inferred', 0.80, 'activity', '${ACTIVITY_B}');
      `),
    ).rejects.toThrow(/Invalid provenance target: activity|23503/);

    // 3. activity source: own (User A) activity -> accepted
    const actNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', 'Valid Activity Node', 'inferred', 0.80, 'activity', '${ACTIVITY_A}')
      returning id;
    `);
    expect(actNode.rows[0].id).toBeDefined();

    // 4. artifact source: nonexistent UUID -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', 'Fake Artifact Node', 'inferred', 0.80, 'artifact', '${FAKE_UUID}');
      `),
    ).rejects.toThrow(/Invalid provenance target: artifact|23503/);

    // 5. artifact source: foreign-tenant (User B) artifact -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', 'Cross Artifact Node', 'inferred', 0.80, 'artifact', '${ARTIFACT_B}');
      `),
    ).rejects.toThrow(/Invalid provenance target: artifact|23503/);

    // 6. artifact source: own (User A) artifact -> accepted
    const artNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', 'Valid Artifact Node', 'inferred', 0.80, 'artifact', '${ARTIFACT_A}')
      returning id;
    `);
    expect(artNode.rows[0].id).toBeDefined();

    // 7. ai_proposal source: foreign-tenant activity -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', 'Cross Proposal Node', 'inferred', 0.80, 'ai_proposal', '${ACTIVITY_B}');
      `),
    ).rejects.toThrow(/Invalid provenance target: activity|23503/);
  });

  test("4. Deduplication: Normalized title uniqueness blocks duplicate concept names per tenant", async () => {
    await expect(
      pg.query(`
        insert into public.knowledge_nodes (
          user_id, title, verification_status, confidence, verified_at, verified_by
        ) values (
          '${USER_A}', '   dna   metabarcoding   ', 'verified', 1.0, now(), '${USER_A}'
        );
      `),
    ).rejects.toThrow(/duplicate key value|23505/);

    // User B CAN create same title
    const userBNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (
        user_id, title, verification_status, confidence, verified_at, verified_by
      ) values (
        '${USER_B}', 'DNA Metabarcoding', 'verified', 1.0, now(), '${USER_B}'
      ) returning id;
    `);
    expect(userBNode.rows[0].id).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. KNOWLEDGE EDGE ONTOLOGY, TRUE SYMMETRIC STORAGE & EDGE CONFIDENCE
  // --------------------------------------------------------------------------

  test("5. Creates edges and enforces edge confidence / audit invariants", async () => {
    const n1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Directed Node 1', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const n2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Directed Node 2', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const n3 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Directed Node 3', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);

    const id1 = n1.rows[0].id;
    const id2 = n2.rows[0].id;
    const id3 = n3.rows[0].id;

    // 1. Verified prerequisite edge
    const prereq = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', '${id1}', '${id2}', 'prerequisite', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    expect(prereq.rows[0]).toBeDefined();

    // 2. Inferred supports edge with activity source
    const supports = await pg.query(`
      insert into public.knowledge_edges (
        user_id, source_node_id, target_node_id, relation_type, verification_status, confidence,
        source_type, source_id, provenance_note
      ) values (
        '${USER_A}', '${id2}', '${id3}', 'supports', 'inferred', 0.88,
        'activity', '${ACTIVITY_A}', 'Empirical study findings'
      ) returning id;
    `);
    expect(supports.rows[0]).toBeDefined();

    // 3. Edge Confidence Failures (P2-3)
    // Inferred edge > 0.95 -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', '${id3}', '${id1}', 'supports', 'inferred', 0.99, 'ai_proposal', '${ACTIVITY_A}');
      `),
    ).rejects.toThrow(/knowledge_edges_inferred_confidence_check|23514/);

    // Verified edge < 1.00 -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', '${id3}', '${id1}', 'supports', 'verified', 0.90, now(), '${USER_A}');
      `),
    ).rejects.toThrow(/knowledge_edges_verified_audit_check|23514/);
  });

  test("5.1 Provenance Target Integrity: Edge source_id must exist and belong to the same tenant", async () => {
    const na = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Edge Target N1', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const nb = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Edge Target N2', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const idA = na.rows[0].id;
    const idB = nb.rows[0].id;

    // 1. activity source: nonexistent UUID -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', '${idA}', '${idB}', 'supports', 'inferred', 0.80, 'activity', '${FAKE_UUID}');
      `),
    ).rejects.toThrow(/Invalid provenance target: activity|23503/);

    // 2. activity source: foreign-tenant activity -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', '${idA}', '${idB}', 'supports', 'inferred', 0.80, 'activity', '${ACTIVITY_B}');
      `),
    ).rejects.toThrow(/Invalid provenance target: activity|23503/);

    // 3. artifact source: nonexistent UUID -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', '${idA}', '${idB}', 'supports', 'inferred', 0.80, 'artifact', '${FAKE_UUID}');
      `),
    ).rejects.toThrow(/Invalid provenance target: artifact|23503/);

    // 4. artifact source: foreign-tenant artifact -> rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
        values ('${USER_A}', '${idA}', '${idB}', 'supports', 'inferred', 0.80, 'artifact', '${ARTIFACT_B}');
      `),
    ).rejects.toThrow(/Invalid provenance target: artifact|23503/);

    // 5. artifact source: own artifact -> accepted
    const validArtEdge = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', '${idA}', '${idB}', 'supports', 'inferred', 0.80, 'artifact', '${ARTIFACT_A}')
      returning id;
    `);
    expect(validArtEdge.rows[0].id).toBeDefined();
  });

  test("6. True Symmetric Storage: 'contradicts' and 'relates_to' require canonical ordering (source < target)", async () => {
    const na = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Sym Node A', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const nb = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Sym Node B', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);

    const rawIdA = na.rows[0].id;
    const rawIdB = nb.rows[0].id;
    const [lowerId, higherId] = rawIdA < rawIdB ? [rawIdA, rawIdB] : [rawIdB, rawIdA];

    // Canonical ordering (lower < higher) succeeds
    const symContradict = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', '${lowerId}', '${higherId}', 'contradicts', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    expect(symContradict.rows[0]).toBeDefined();

    // Non-canonical ordering (higher -> lower) is strictly rejected by CHECK constraint
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', '${higherId}', '${lowerId}', 'contradicts', 'verified', 1.0, now(), '${USER_A}');
      `),
    ).rejects.toThrow(/knowledge_edges_symmetric_canonical|23514/);

    // relates_to requires lower < higher AND non-empty provenance_note
    const symRelates = await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, provenance_note, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', '${lowerId}', '${higherId}', 'relates_to', 'Common biochemical pathway', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    expect(symRelates.rows[0]).toBeDefined();

    // relates_to without provenance_note is strictly rejected
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', '${lowerId}', '${higherId}', 'relates_to', 'verified', 1.0, now(), '${USER_A}');
      `),
    ).rejects.toThrow(/knowledge_edges_relates_to_provenance|23514/);
  });

  // --------------------------------------------------------------------------
  // 3. DAG TRIGGER, UPDATE CORRECTNESS & INACTIVE STATUS TABLE-DRIVEN TESTS
  // --------------------------------------------------------------------------

  test("7. Anti-Cycle Trigger: Cyclic prerequisite (A -> B -> A) is rejected with 23514", async () => {
    const na = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Cycle Node A', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const nb = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Cycle Node B', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const idA = na.rows[0].id;
    const idB = nb.rows[0].id;

    // A -> B prerequisite
    await pg.query(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', '${idA}', '${idB}', 'prerequisite', 'verified', 1.0, now(), '${USER_A}');
    `);

    // B -> A prerequisite must be rejected by trigger
    await expect(
      pg.query(`
        insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', '${idB}', '${idA}', 'prerequisite', 'verified', 1.0, now(), '${USER_A}');
      `),
    ).rejects.toThrow(/Cyclic dependency detected|23514/);
  });

  test("8. Anti-Cycle Trigger: UPDATE on existing edge (A -> B changed to B -> A) succeeds when acyclic", async () => {
    const nx = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Update Node X', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const ny = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Update Node Y', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const idX = nx.rows[0].id;
    const idY = ny.rows[0].id;

    // Insert X -> Y
    const edgeRes = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', '${idX}', '${idY}', 'prerequisite', 'verified', 1.0, now(), '${USER_A}') returning id;
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

  test("9. Table-Driven Inactive DAG Exclusion: rejected, superseded & archived edges do NOT block active DAG topology (P2-2)", async () => {
    const inactiveCases = [
      { name: "rejected", status: "rejected", isArchived: false },
      { name: "superseded", status: "superseded", isArchived: false },
      { name: "archived", status: "verified", isArchived: true },
    ];

    for (const [idx, c] of inactiveCases.entries()) {
      const np = await pg.query<{ id: string }>(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', 'DAG Inactive Node P${idx}', 'verified', 1.0, now(), '${USER_A}') returning id;
      `);
      const nq = await pg.query<{ id: string }>(`
        insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
        values ('${USER_A}', 'DAG Inactive Node Q${idx}', 'verified', 1.0, now(), '${USER_A}') returning id;
      `);
      const idP = np.rows[0].id;
      const idQ = nq.rows[0].id;

      // Insert inactive P -> Q edge
      await pg.query(`
        insert into public.knowledge_edges (
          user_id, source_node_id, target_node_id, relation_type, verification_status, is_archived, confidence, verified_at, verified_by
        ) values (
          '${USER_A}', '${idP}', '${idQ}', 'prerequisite', '${c.status}', ${c.isArchived}, 1.0, now(), '${USER_A}'
        );
      `);

      // Active Q -> P prerequisite edge must succeed because inactive edge is excluded from DAG
      const activeEdge = await pg.query(`
        insert into public.knowledge_edges (
          user_id, source_node_id, target_node_id, relation_type, verification_status, is_archived, confidence, verified_at, verified_by
        ) values (
          '${USER_A}', '${idQ}', '${idP}', 'prerequisite', 'verified', false, 1.0, now(), '${USER_A}'
        ) returning id;
      `);
      expect(activeEdge.rows[0].id, `Active reverse edge should be permitted for inactive status: ${c.name}`).toBeDefined();
    }
  });

  // --------------------------------------------------------------------------
  // 4. EVIDENCE RECORDS TENANT COMPOSITE FOREIGN KEY
  // --------------------------------------------------------------------------

  test("10. Composite FK on evidence_records.knowledge_node_id enforces tenant safety", async () => {
    const nodeA = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'Evidence Backed Concept', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const nodeB = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_B}', 'User B Private Concept', 'verified', 1.0, now(), '${USER_B}') returning id;
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
  // 5. COMPLETE DUAL-TENANT RLS CRUD MATRIX (P1-2)
  // --------------------------------------------------------------------------

  test("11. Complete Node + Edge Dual-Tenant RLS Matrix: Full bidirectional CRUD isolation", async () => {
    // Seed User A Node & Edge
    const a1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'User A Matrix N1', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const a2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', 'User A Matrix N2', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const a1Id = a1.rows[0].id;
    const a2Id = a2.rows[0].id;
    const aEdge = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
      values ('${USER_A}', '${a1Id}', '${a2Id}', 'prerequisite', 'verified', 1.0, now(), '${USER_A}') returning id;
    `);
    const aEdgeId = aEdge.rows[0].id;

    // Seed User B Node & Edge
    const b1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_B}', 'User B Matrix N1', 'verified', 1.0, now(), '${USER_B}') returning id;
    `);
    const b2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by)
      values ('${USER_B}', 'User B Matrix N2', 'verified', 1.0, now(), '${USER_B}') returning id;
    `);
    const b1Id = b1.rows[0].id;
    const b2Id = b2.rows[0].id;
    const bEdge = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by)
      values ('${USER_B}', '${b1Id}', '${b2Id}', 'prerequisite', 'verified', 1.0, now(), '${USER_B}') returning id;
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

      // Node UPDATE B -> 0 rows affected
      const updateNode = await pg.query("update public.knowledge_nodes set description = 'Hacked' where id = $1", [b1Id]);
      expect(updateNode.rowCount).toBe(0);

      // Node DELETE B -> 0 rows affected
      const deleteNode = await pg.query("delete from public.knowledge_nodes where id = $1", [b1Id]);
      expect(deleteNode.rowCount).toBe(0);

      // Node forged INSERT as B -> RLS with check fails
      await expect(
        pg.query(
          "insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by) values ($1, 'Forged B Node', 'verified', 1.0, now(), $1)",
          [USER_B],
        ),
      ).rejects.toThrow(/row-level security policy|42501/);

      // Edge SELECT isolation
      const edges = await pg.query<{ id: string }>("select id from public.knowledge_edges");
      const edgeIds = edges.rows.map((r) => r.id);
      expect(edgeIds).toContain(aEdgeId);
      expect(edgeIds).not.toContain(bEdgeId);

      // Edge UPDATE B -> 0 rows affected
      const updateEdge = await pg.query("update public.knowledge_edges set is_archived = true where id = $1", [bEdgeId]);
      expect(updateEdge.rowCount).toBe(0);

      // Edge DELETE B -> 0 rows affected
      const deleteEdge = await pg.query("delete from public.knowledge_edges where id = $1", [bEdgeId]);
      expect(deleteEdge.rowCount).toBe(0);

      // Edge forged INSERT as B -> RLS with check fails
      await expect(
        pg.query(
          "insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by) values ($1, $2, $3, 'prerequisite', 'verified', 1.0, now(), $1)",
          [USER_B, b1Id, b2Id],
        ),
      ).rejects.toThrow(/row-level security policy|42501/);
    });

    // 2. As Authenticated User B (Reciprocal Proof)
    await asUser(USER_B, async () => {
      // Node SELECT isolation
      const nodes = await pg.query<{ id: string }>("select id from public.knowledge_nodes");
      const nodeIds = nodes.rows.map((r) => r.id);
      expect(nodeIds).toContain(b1Id);
      expect(nodeIds).toContain(b2Id);
      expect(nodeIds).not.toContain(a1Id);
      expect(nodeIds).not.toContain(a2Id);

      // Node UPDATE A -> 0 rows affected
      const updateNode = await pg.query("update public.knowledge_nodes set description = 'Hacked' where id = $1", [a1Id]);
      expect(updateNode.rowCount).toBe(0);

      // Node DELETE A -> 0 rows affected
      const deleteNode = await pg.query("delete from public.knowledge_nodes where id = $1", [a1Id]);
      expect(deleteNode.rowCount).toBe(0);

      // Node forged INSERT as A -> RLS with check fails
      await expect(
        pg.query(
          "insert into public.knowledge_nodes (user_id, title, verification_status, confidence, verified_at, verified_by) values ($1, 'Forged A Node', 'verified', 1.0, now(), $1)",
          [USER_A],
        ),
      ).rejects.toThrow(/row-level security policy|42501/);

      // Edge SELECT isolation
      const edges = await pg.query<{ id: string }>("select id from public.knowledge_edges");
      const edgeIds = edges.rows.map((r) => r.id);
      expect(edgeIds).toContain(bEdgeId);
      expect(edgeIds).not.toContain(aEdgeId);

      // Edge UPDATE A -> 0 rows affected
      const updateEdge = await pg.query("update public.knowledge_edges set is_archived = true where id = $1", [aEdgeId]);
      expect(updateEdge.rowCount).toBe(0);

      // Edge DELETE A -> 0 rows affected
      const deleteEdge = await pg.query("delete from public.knowledge_edges where id = $1", [aEdgeId]);
      expect(deleteEdge.rowCount).toBe(0);

      // Edge forged INSERT as A -> RLS with check fails
      await expect(
        pg.query(
          "insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, verified_at, verified_by) values ($1, $2, $3, 'prerequisite', 'verified', 1.0, now(), $1)",
          [USER_A, a1Id, a2Id],
        ),
      ).rejects.toThrow(/row-level security policy|42501/);
    });
  });

  test("12. Fail-Closed Anon Access: Anonymous role has zero table access to knowledge tables", async () => {
    await asAnon(async () => {
      await expect(pg.query("select * from public.knowledge_nodes")).rejects.toThrow(/permission denied|42501/);
      await expect(pg.query("select * from public.knowledge_edges")).rejects.toThrow(/permission denied|42501/);
    });
  });

  // --------------------------------------------------------------------------
  // 6. SOURCE DELETE GUARDS (NODE & EDGE REFERENCES - P1-2 & P2-1)
  // --------------------------------------------------------------------------

  test("13. Source Delete Guards: Referenced Activity & Artifact deletion is rejected with 23503 (P1-2 & P2-1)", async () => {
    // 1. Seed unreferenced activity & artifact for User A
    const freeActId = "6ac00099-aaaa-4000-a000-000000000099";
    const freeArtId = "6aa00099-aaaa-4000-a000-000000000099";
    await pg.query(`
      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version)
      values ('${freeActId}', '${USER_A}', 'Free Activity', 'Notes', 'study', 'confirmed', '1.0.0');
      insert into public.artifacts (id, user_id, title, artifact_type)
      values ('${freeArtId}', '${USER_A}', 'Free Artifact', 'document');
    `);

    // 2. Unreferenced Activity DELETE -> allowed
    const delFreeAct = await pg.query(`delete from public.activities where id = '${freeActId}' returning id;`);
    expect(delFreeAct.rows[0].id).toBe(freeActId);

    // 3. Unreferenced Artifact DELETE -> allowed
    const delFreeArt = await pg.query(`delete from public.artifacts where id = '${freeArtId}' returning id;`);
    expect(delFreeArt.rows[0].id).toBe(freeArtId);

    // 4. Seed guarded activity & artifact referenced by knowledge node
    const guardedActId = "6ac00088-aaaa-4000-a000-000000000088";
    const guardedArtId = "6aa00088-aaaa-4000-a000-000000000088";
    await pg.query(`
      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version)
      values ('${guardedActId}', '${USER_A}', 'Guarded Activity', 'Notes', 'study', 'confirmed', '1.0.0');
      insert into public.artifacts (id, user_id, title, artifact_type)
      values ('${guardedArtId}', '${USER_A}', 'Guarded Artifact', 'document');
    `);

    const gNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', 'Guarded Ref Node', 'inferred', 0.80, 'activity', '${guardedActId}')
      returning id;
    `);
    const gNodeId = gNode.rows[0].id;

    const gArtNode = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', 'Guarded Art Node', 'inferred', 0.80, 'artifact', '${guardedArtId}')
      returning id;
    `);
    const gArtNodeId = gArtNode.rows[0].id;

    // 5. Node-Referenced Activity DELETE -> rejected with 23503
    await expect(
      pg.query(`delete from public.activities where id = '${guardedActId}';`),
    ).rejects.toThrow(/Cannot delete activity|23503/);

    // 6. Node-Referenced Artifact DELETE -> rejected with 23503
    await expect(
      pg.query(`delete from public.artifacts where id = '${guardedArtId}';`),
    ).rejects.toThrow(/Cannot delete artifact|23503/);

    // 7. Clean node references and verify deletion succeeds
    await pg.query(`delete from public.knowledge_nodes where id in ('${gNodeId}', '${gArtNodeId}');`);
    const delGuardedAct = await pg.query(`delete from public.activities where id = '${guardedActId}' returning id;`);
    expect(delGuardedAct.rows[0].id).toBe(guardedActId);
    const delGuardedArt = await pg.query(`delete from public.artifacts where id = '${guardedArtId}' returning id;`);
    expect(delGuardedArt.rows[0].id).toBe(guardedArtId);

    // ------------------------------------------------------------------------
    // Edge-Only Delete Guard Fixtures (P2-1)
    // ------------------------------------------------------------------------
    const edgeOnlyActId = "6ac00077-aaaa-4000-a000-000000000077";
    const edgeOnlyArtId = "6aa00077-aaaa-4000-a000-000000000077";
    await pg.query(`
      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version)
      values ('${edgeOnlyActId}', '${USER_A}', 'Edge-Only Activity', 'Notes', 'study', 'confirmed', '1.0.0');
      insert into public.artifacts (id, user_id, title, artifact_type)
      values ('${edgeOnlyArtId}', '${USER_A}', 'Edge-Only Artifact', 'document');
    `);

    // Create 2 independent knowledge nodes for edges
    const eNode1 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, verified_at, verified_by)
      values ('${USER_A}', 'Edge Delete Guard N1', 'verified', 1.0, 'user_created', now(), '${USER_A}') returning id;
    `);
    const eNode2 = await pg.query<{ id: string }>(`
      insert into public.knowledge_nodes (user_id, title, verification_status, confidence, source_type, verified_at, verified_by)
      values ('${USER_A}', 'Edge Delete Guard N2', 'verified', 1.0, 'user_created', now(), '${USER_A}') returning id;
    `);
    const enId1 = eNode1.rows[0].id;
    const enId2 = eNode2.rows[0].id;

    // Edge referencing edgeOnlyActId ONLY
    const edgeActRef = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', '${enId1}', '${enId2}', 'supports', 'inferred', 0.80, 'activity', '${edgeOnlyActId}') returning id;
    `);
    const edgeActRefId = edgeActRef.rows[0].id;

    // 8. Edge-Only Referenced Activity DELETE -> rejected with 23503
    await expect(
      pg.query(`delete from public.activities where id = '${edgeOnlyActId}';`),
    ).rejects.toThrow(/Cannot delete activity|23503/);

    // Delete referencing edge, now edgeOnlyActId CAN be deleted
    await pg.query(`delete from public.knowledge_edges where id = '${edgeActRefId}';`);
    const delEdgeAct = await pg.query(`delete from public.activities where id = '${edgeOnlyActId}' returning id;`);
    expect(delEdgeAct.rows[0].id).toBe(edgeOnlyActId);

    // Edge referencing edgeOnlyArtId ONLY
    const edgeArtRef = await pg.query<{ id: string }>(`
      insert into public.knowledge_edges (user_id, source_node_id, target_node_id, relation_type, verification_status, confidence, source_type, source_id)
      values ('${USER_A}', '${enId1}', '${enId2}', 'supports', 'inferred', 0.80, 'artifact', '${edgeOnlyArtId}') returning id;
    `);
    const edgeArtRefId = edgeArtRef.rows[0].id;

    // 9. Edge-Only Referenced Artifact DELETE -> rejected with 23503
    await expect(
      pg.query(`delete from public.artifacts where id = '${edgeOnlyArtId}';`),
    ).rejects.toThrow(/Cannot delete artifact|23503/);

    // Delete referencing edge, now edgeOnlyArtId CAN be deleted
    await pg.query(`delete from public.knowledge_edges where id = '${edgeArtRefId}';`);
    const delEdgeArt = await pg.query(`delete from public.artifacts where id = '${edgeOnlyArtId}' returning id;`);
    expect(delEdgeArt.rows[0].id).toBe(edgeOnlyArtId);
  });

  // --------------------------------------------------------------------------
  // 7. MIGRATION SAFETY GUARD REGRESSION
  // --------------------------------------------------------------------------

  test("14. Migration Safety Guard Regression: Direct execution of 0039 guard block fails closed when tables are non-empty", async () => {
    // Read the actual 0039 migration file from disk
    const migrationPath = path.join(process.cwd(), "supabase/migrations/0039_knowledge_graph_authority.sql");
    const migrationContent = fs.readFileSync(migrationPath, "utf8");

    // Extract Section 1 DO block directly from the file
    const match = migrationContent.match(/DO \$\$[\s\S]*?END \$\$;/);
    expect(match, "0039 migration must contain Section 1 DO safety block").not.toBeNull();
    const guardSql = match![0];

    // Since our test database currently contains seeded knowledge nodes and edges,
    // executing the real migration safety block MUST raise the safety abort exception
    await expect(pg.query(guardSql)).rejects.toThrow(/Safety abort: legacy knowledge tables contain \d+ nodes/);
  });
});
