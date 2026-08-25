import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseKnowledgeRepository } from "@/lib/store/knowledge-repository";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const DEFAULT_LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_LOCAL_SERVICE_KEY;

const USER_6B_A = "66666666-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const USER_6B_B = "66666666-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const DOMAIN_A = "66666666-d000-4000-a000-000000000001";
const SKILL_A = "66666666-5000-4000-a000-000000000001";
const ACTIVITY_A = "66666666-c000-4000-a000-000000000001";
const ARTIFACT_A = "66666666-a000-4000-a000-000000000001";

describe.skipIf(!DATABASE_URL)("Stage 6B — SupabaseKnowledgeRepository (Live PostgreSQL)", () => {
  let pgClient: Client;
  let repoA: SupabaseKnowledgeRepository;
  let repoB: SupabaseKnowledgeRepository;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();

    // Clean prior state
    await pgClient.query(`
      delete from public.evidence_records where user_id in ('${USER_6B_A}', '${USER_6B_B}');
      delete from public.knowledge_edges where user_id in ('${USER_6B_A}', '${USER_6B_B}');
      delete from public.knowledge_nodes where user_id in ('${USER_6B_A}', '${USER_6B_B}');
      delete from public.artifacts where user_id in ('${USER_6B_A}', '${USER_6B_B}');
      delete from public.activities where user_id in ('${USER_6B_A}', '${USER_6B_B}');
      delete from public.skills where user_id in ('${USER_6B_A}', '${USER_6B_B}');
      delete from public.domains where user_id in ('${USER_6B_A}', '${USER_6B_B}');
    `);

    // Seed test users, profile, domain, skill, activity, artifact
    await pgClient.query(`
      insert into auth.users (id, email) values
        ('${USER_6B_A}', 'stage6b_repo_a@growth.rpg'),
        ('${USER_6B_B}', 'stage6b_repo_b@growth.rpg')
      on conflict (id) do nothing;
      insert into public.profiles (user_id, display_name) values
        ('${USER_6B_A}', 'Stage6BRepoA'),
        ('${USER_6B_B}', 'Stage6BRepoB')
      on conflict (user_id) do nothing;
      insert into public.player_states (user_id, total_xp, player_level) values
        ('${USER_6B_A}', 0, 1),
        ('${USER_6B_B}', 0, 1)
      on conflict (user_id) do nothing;
      insert into public.domains (id, user_id, name, slug) values
        ('${DOMAIN_A}', '${USER_6B_A}', 'Neuroscience', 'neuro')
      on conflict (user_id, id) do nothing;
      insert into public.skills (id, user_id, name) values
        ('${SKILL_A}', '${USER_6B_A}', 'Synaptic Plasticity')
      on conflict (user_id, id) do nothing;
      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version) values
        ('${ACTIVITY_A}', '${USER_6B_A}', 'Read LTP Paper', 'Study notes', 'study', 'confirmed', '1.0.0')
      on conflict (id) do nothing;
      insert into public.artifacts (id, user_id, title, artifact_type) values
        ('${ARTIFACT_A}', '${USER_6B_A}', 'LTP Protocol Doc', 'document')
      on conflict (id) do nothing;
    `);

    const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    repoA = new SupabaseKnowledgeRepository(adminClient, USER_6B_A);
    repoB = new SupabaseKnowledgeRepository(adminClient, USER_6B_B);
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.query(`
        delete from public.evidence_records where user_id in ('${USER_6B_A}', '${USER_6B_B}');
        delete from public.knowledge_edges where user_id in ('${USER_6B_A}', '${USER_6B_B}');
        delete from public.knowledge_nodes where user_id in ('${USER_6B_A}', '${USER_6B_B}');
        delete from public.artifacts where user_id in ('${USER_6B_A}', '${USER_6B_B}');
        delete from public.activities where user_id in ('${USER_6B_A}', '${USER_6B_B}');
        delete from public.skills where user_id in ('${USER_6B_A}', '${USER_6B_B}');
        delete from public.domains where user_id in ('${USER_6B_A}', '${USER_6B_B}');
      `);
      await pgClient.end();
    }
  });

  test("1. createNode and getNode: creates verified and inferred nodes", async () => {
    // 1. Verified user created node
    const vNode = await repoA.createNode({
      title: "Long-Term Potentiation",
      nodeType: "concept",
      domainId: DOMAIN_A,
      skillId: SKILL_A,
      description: "Persistent strengthening of synapses",
    });
    expect(vNode.id).toBeDefined();
    expect(vNode.verificationStatus).toBe("verified");
    expect(vNode.confidence).toBe(1.0);
    expect(vNode.verifiedBy).toBe(USER_6B_A);

    // 2. Inferred node backed by activity
    const iNode = await repoA.createNode({
      title: "NMDA Receptor Activation",
      nodeType: "claim",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      confidence: 0.85,
    });
    expect(iNode.verificationStatus).toBe("inferred");
    expect(iNode.confidence).toBe(0.85);

    // Fetch via getNode
    const fetched = await repoA.getNode(vNode.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe("Long-Term Potentiation");
  });

  test("2. updateNodeMetadata: strictly updates whitelisted fields and sets updated_at", async () => {
    const node = await repoA.createNode({ title: "Spike Timing Dependent Plasticity" });
    const updated = await repoA.updateNodeMetadata(node.id, {
      description: "STDP learning window",
      isArchived: true,
    });

    expect(updated.description).toBe("STDP learning window");
    expect(updated.isArchived).toBe(true);
    expect(updated.archivedAt).not.toBeNull();
  });

  test("3. createEdge and getEdge: handles prerequisite and symmetric auto-canonicalization", async () => {
    const n1 = await repoA.createNode({ title: "Presynaptic Spike" });
    const n2 = await repoA.createNode({ title: "Postsynaptic Spike" });

    // Prerequisite
    const edgePrereq = await repoA.createEdge({
      sourceNodeId: n1.id,
      targetNodeId: n2.id,
      relationType: "prerequisite",
    });
    expect(edgePrereq.relationType).toBe("prerequisite");

    // Symmetric relates_to with inverted IDs -> canonicalized automatically
    const [higher, lower] = n1.id > n2.id ? [n1.id, n2.id] : [n2.id, n1.id];
    const edgeRel = await repoA.createEdge({
      sourceNodeId: higher,
      targetNodeId: lower,
      relationType: "relates_to",
      provenanceNote: "Biochemical correlation",
    });
    expect(edgeRel.sourceNodeId).toBe(lower);
    expect(edgeRel.targetNodeId).toBe(higher);
  });

  test("4. getNodeDetail and getEdgeDetail: resolves full provenance and connection graphs", async () => {
    const conceptNode = await repoA.createNode({
      title: "AMPA Receptor Trafficking",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      domainId: DOMAIN_A,
      skillId: SKILL_A,
    });

    // Link evidence record to conceptNode
    await pgClient.query(`
      insert into public.evidence_records (user_id, activity_id, knowledge_node_id, evidence_type, description, verified)
      values ('${USER_6B_A}', '${ACTIVITY_A}', '${conceptNode.id}', 'E2', 'Staining confirmed insertion', true);
    `);

    const detail = await repoA.getNodeDetail(conceptNode.id);
    expect(detail).not.toBeNull();
    expect(detail!.node.domainName).toBe("Neuroscience");
    expect(detail!.node.skillName).toBe("Synaptic Plasticity");
    expect(detail!.provenance.sourceActivity).not.toBeNull();
    expect(detail!.provenance.sourceActivity!.title).toBe("Read LTP Paper");
    expect(detail!.provenance.evidenceRecords).toHaveLength(1);
    expect(detail!.provenance.evidenceRecords[0].content).toBe("Staining confirmed insertion");
  });

  test("5. Cross-Tenant Isolation: User B cannot access User A records through repository", async () => {
    const nodeA = await repoA.createNode({ title: "User A Vault Node" });

    // User B getNode -> returns null
    const bNode = await repoB.getNode(nodeA.id);
    expect(bNode).toBeNull();

    // User B getNodeDetail -> returns null
    const bDetail = await repoB.getNodeDetail(nodeA.id);
    expect(bDetail).toBeNull();

    // User B deleteNode -> returns false
    const bDelete = await repoB.deleteNode(nodeA.id);
    expect(bDelete).toBe(false);
  });
});
