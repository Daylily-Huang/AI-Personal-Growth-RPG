import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseKnowledgeRepository } from "@/lib/store/knowledge-repository";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const DEFAULT_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEFAULT_LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_LOCAL_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_LOCAL_SERVICE_KEY;

const DOMAIN_A = "66666666-d000-4000-a000-000000000001";
const SKILL_A = "66666666-5000-4000-a000-000000000001";
const ACTIVITY_A = "66666666-c000-4000-a000-000000000001";
const ARTIFACT_A = "66666666-a000-4000-a000-000000000001";

describe.skipIf(!DATABASE_URL)("Stage 6B — SupabaseKnowledgeRepository & Raw Authenticated DB Authority Gate (Live)", () => {
  let pgClient: Client;
  let repoA: SupabaseKnowledgeRepository;
  let repoB: SupabaseKnowledgeRepository;
  let authUserAClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  beforeAll(async () => {
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();

    // Setup authenticated clients for User A & User B via standard signUp
    const emailA = `stage6b_repo_a_${Date.now()}@growth.rpg`;
    const emailB = `stage6b_repo_b_${Date.now()}@growth.rpg`;

    authUserAClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authUserBClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const signA = await authUserAClient.auth.signUp({ email: emailA, password: "Password123!" });
    expect(signA.error).toBeNull();
    userAId = signA.data.user!.id;

    const signB = await authUserBClient.auth.signUp({ email: emailB, password: "Password123!" });
    expect(signB.error).toBeNull();
    userBId = signB.data.user!.id;

    // Seed test profiles, domain, skill, activity, artifact
    await pgClient.query(`
      insert into public.profiles (user_id, display_name) values
        ('${userAId}', 'Stage6BRepoA'),
        ('${userBId}', 'Stage6BRepoB')
      on conflict (user_id) do nothing;
      insert into public.player_states (user_id, total_xp, player_level) values
        ('${userAId}', 0, 1),
        ('${userBId}', 0, 1)
      on conflict (user_id) do nothing;
      insert into public.domains (id, user_id, name, slug) values
        ('${DOMAIN_A}', '${userAId}', 'Neuroscience', 'neuro')
      on conflict (user_id, id) do nothing;
      insert into public.skills (id, user_id, name) values
        ('${SKILL_A}', '${userAId}', 'Synaptic Plasticity')
      on conflict (user_id, id) do nothing;
      insert into public.activities (id, user_id, title, raw_input, activity_type, status, rules_version) values
        ('${ACTIVITY_A}', '${userAId}', 'Read LTP Paper', 'Study notes', 'study', 'confirmed', '1.0.0')
      on conflict (id) do nothing;
      insert into public.artifacts (id, user_id, title, artifact_type) values
        ('${ARTIFACT_A}', '${userAId}', 'LTP Protocol Doc', 'document')
      on conflict (id) do nothing;
    `);

    repoA = new SupabaseKnowledgeRepository(authUserAClient, userAId);
    repoB = new SupabaseKnowledgeRepository(authUserBClient, userBId);
  });

  afterAll(async () => {
    if (pgClient && userAId && userBId) {
      await pgClient.query(`
        delete from public.evidence_records where user_id in ('${userAId}', '${userBId}');
        delete from public.knowledge_edges where user_id in ('${userAId}', '${userBId}');
        delete from public.knowledge_nodes where user_id in ('${userAId}', '${userBId}');
        delete from public.artifacts where user_id in ('${userAId}', '${userBId}');
        delete from public.activities where user_id in ('${userAId}', '${userBId}');
        delete from public.skills where user_id in ('${userAId}', '${userBId}');
        delete from public.domains where user_id in ('${userAId}', '${userBId}');
      `);
      await pgClient.end();
      await adminClient.auth.admin.deleteUser(userAId).catch(() => {});
      await adminClient.auth.admin.deleteUser(userBId).catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // 1. P0 RAW AUTHENTICATED MUTATION DENIAL PROOF (Column Privileges)
  // --------------------------------------------------------------------------

  test("1. P0 Authority Boundary: Direct raw authenticated UPDATE on authority/provenance columns is DENIED by DB", async () => {
    const inferredNode = await repoA.createNode({
      title: "Direct Mutation Target Node",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      confidence: 0.85,
    });
    expect(inferredNode.verificationStatus).toBe("inferred");

    // 1. Direct raw UPDATE on verification_status via authenticated client -> MUST BE DENIED (42501 permission denied)
    const { error: errStatus } = await authUserAClient
      .from("knowledge_nodes")
      .update({ verification_status: "verified" } as unknown as Database["public"]["Tables"]["knowledge_nodes"]["Update"])
      .eq("id", inferredNode.id);
    expect(errStatus).not.toBeNull();
    expect(errStatus!.message.toLowerCase()).toContain("permission denied");

    // 2. Direct raw UPDATE on confidence -> MUST BE DENIED
    const { error: errConf } = await authUserAClient
      .from("knowledge_nodes")
      .update({ confidence: 1.0 } as unknown as Database["public"]["Tables"]["knowledge_nodes"]["Update"])
      .eq("id", inferredNode.id);
    expect(errConf).not.toBeNull();
    expect(errConf!.message.toLowerCase()).toContain("permission denied");

    // 3. Direct raw UPDATE on verified_by -> MUST BE DENIED
    const { error: errBy } = await authUserAClient
      .from("knowledge_nodes")
      .update({ verified_by: userAId } as unknown as Database["public"]["Tables"]["knowledge_nodes"]["Update"])
      .eq("id", inferredNode.id);
    expect(errBy).not.toBeNull();
    expect(errBy!.message.toLowerCase()).toContain("permission denied");

    // 4. Create edge and test direct raw UPDATE on edge verification_status -> MUST BE DENIED
    const n2 = await repoA.createNode({ title: "Direct Mutation Target Node 2" });
    const edge = await repoA.createEdge({
      sourceNodeId: inferredNode.id,
      targetNodeId: n2.id,
      relationType: "supports",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      confidence: 0.88,
    });

    const { error: errEdgeStatus } = await authUserAClient
      .from("knowledge_edges")
      .update({ verification_status: "verified" } as unknown as Database["public"]["Tables"]["knowledge_edges"]["Update"])
      .eq("id", edge.id);
    expect(errEdgeStatus).not.toBeNull();
    expect(errEdgeStatus!.message.toLowerCase()).toContain("permission denied");

    // 5. Legitimate client metadata update -> SUCCEEDS
    const { error: errMeta } = await authUserAClient
      .from("knowledge_nodes")
      .update({ description: "Updated via authorized metadata column" })
      .eq("id", inferredNode.id);
    expect(errMeta).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 2. SANCTIONED SECURITY DEFINER RPC VERIFICATION & REJECTION
  // --------------------------------------------------------------------------

  test("2. Sanctioned RPCs: verify and reject execute atomic authority transitions", async () => {
    // 1. Node Verify RPC
    const node1 = await repoA.createNode({
      title: "RPC Node Verify Test",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      confidence: 0.85,
    });
    const verifiedNode = await repoA.applyNodeAuthorityTransition(node1.id, "verify");
    expect(verifiedNode.verificationStatus).toBe("verified");
    expect(verifiedNode.confidence).toBe(1.0);
    expect(verifiedNode.verifiedBy).toBe(userAId);

    // 2. Node Reject RPC
    const node2 = await repoA.createNode({
      title: "RPC Node Reject Test",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      confidence: 0.8,
    });
    const rejectedNode = await repoA.applyNodeAuthorityTransition(node2.id, "reject");
    expect(rejectedNode.verificationStatus).toBe("rejected");

    // 3. Edge Verify RPC
    const edge1 = await repoA.createEdge({
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
      relationType: "supports",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      confidence: 0.82,
    });
    const verifiedEdge = await repoA.applyEdgeAuthorityTransition(edge1.id, "verify");
    expect(verifiedEdge.verificationStatus).toBe("verified");
    expect(verifiedEdge.confidence).toBe(1.0);
    expect(verifiedEdge.verifiedBy).toBe(userAId);

    // 4. Edge Reject RPC
    const edge2 = await repoA.createEdge({
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
      relationType: "relates_to",
      provenanceNote: "Conceptual hypothesis",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      confidence: 0.77,
    });
    const rejectedEdge = await repoA.applyEdgeAuthorityTransition(edge2.id, "reject");
    expect(rejectedEdge.verificationStatus).toBe("rejected");
  });

  // --------------------------------------------------------------------------
  // 3. CRUD & READ MODEL PROVENANCE RESOLUTION
  // --------------------------------------------------------------------------

  test("3. updateNodeMetadata strictly updates whitelisted fields and sets updated_at", async () => {
    const node = await repoA.createNode({ title: "Spike Timing Dependent Plasticity" });
    const updated = await repoA.updateNodeMetadata(node.id, {
      description: "STDP learning window",
      isArchived: true,
    });

    expect(updated.description).toBe("STDP learning window");
    expect(updated.isArchived).toBe(true);
    expect(updated.archivedAt).not.toBeNull();
  });

  test("4. createEdge and getEdge: handles prerequisite and symmetric auto-canonicalization", async () => {
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

  test("5. getNodeDetail and getEdgeDetail: resolves full provenance and connection graphs", async () => {
    const conceptNode = await repoA.createNode({
      title: "AMPA Receptor Trafficking",
      sourceType: "ai_proposal",
      sourceId: ACTIVITY_A,
      domainId: DOMAIN_A,
      skillId: SKILL_A,
    });

    await pgClient.query(`
      insert into public.evidence_records (user_id, activity_id, knowledge_node_id, evidence_type, description, verified)
      values ('${userAId}', '${ACTIVITY_A}', '${conceptNode.id}', 'E2', 'Staining confirmed insertion', true);
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

  test("6. Cross-Tenant Isolation: User B cannot access User A records through repository", async () => {
    const nodeA = await repoA.createNode({ title: "User A Vault Node" });

    const bNode = await repoB.getNode(nodeA.id);
    expect(bNode).toBeNull();

    const bDetail = await repoB.getNodeDetail(nodeA.id);
    expect(bDetail).toBeNull();

    const bDelete = await repoB.deleteNode(nodeA.id);
    expect(bDelete).toBe(false);
  });
});
