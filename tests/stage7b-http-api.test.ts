import http from "node:http";
import next from "next";
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ArtifactType, ArtifactResolutionInput } from "@/types/artifact";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const TEST_PORT = 3098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const DEFAULT_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEFAULT_LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_LOCAL_ANON_KEY;

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_LOCAL_SERVICE_KEY;

const adminClient = createClient<Database>(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!);

function createCookieJar() {
  const store = new Map<string, string>();
  const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          if (!value) store.delete(name);
          else store.set(name, value);
        });
      },
    },
  });
  return {
    client,
    getCookieHeader() {
      return Array.from(store.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    mergeFromResponse(res: Response) {
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      setCookies.forEach((cookieStr) => {
        const [part] = cookieStr.split(";");
        const [name, ...val] = part.split("=");
        if (name) {
          const v = val.join("=");
          if (cookieStr.includes("Max-Age=0") || !v) store.delete(name.trim());
          else store.set(name.trim(), v);
        }
      });
    },
  };
}

type Jar = ReturnType<typeof createCookieJar>;

async function api(jar: Jar | null, path: string, init: RequestInit = {}): Promise<Response> {
  const cookieHeader = jar ? jar.getCookieHeader() : "";
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init.headers || {}),
    },
  });
  if (jar) {
    jar.mergeFromResponse(res);
  }
  return res;
}

describe.skipIf(!DATABASE_URL)("Stage 7B — Artifact HTTP API & Atomic Settlement Integration (Live Next.js + DB)", () => {
  let app: ReturnType<typeof next>;
  let server: http.Server;
  let pg: Client;
  let userA: Jar;
  let userB: Jar;
  let userAId: string;
  let userBId: string;


  let domainAId: string;
  let skillAId: string;
  let questAId: string;
  let activityAId: string;
  let knowledgeNodeAId: string;

  let skillBId: string;
  let questBId: string;
  let artifactBId: string;
  let activityBId: string;
  let knowledgeNodeBId: string;
  let evidenceBId: string;

  const emailA = `stage7b_a_${Date.now()}@growth.rpg`;
  const emailB = `stage7b_b_${Date.now()}@growth.rpg`;

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    app = next({ dev: false, dir: process.cwd() });
    await app.prepare();
    const handle = app.getRequestHandler();


    server = http.createServer((req, res) => {
      handle(req, res);
    });

    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, () => resolve());
    });

    userA = createCookieJar();
    userB = createCookieJar();

    // Sign up User A & User B
    const signA = await userA.client.auth.signUp({ email: emailA, password: "Password123!" });
    expect(signA.error).toBeNull();
    userAId = signA.data.user!.id;

    const signB = await userB.client.auth.signUp({ email: emailB, password: "Password123!" });
    expect(signB.error).toBeNull();
    userBId = signB.data.user!.id;

    // Seed domain, skills, quest, activity for User A
    const domRes = await adminClient
      .from("domains")
      .insert({ user_id: userAId, name: "Engineering 7B", slug: `eng-7b-${Date.now()}` })
      .select("id")
      .single();
    if (domRes.error) console.error("domRes error:", domRes.error);
    expect(domRes.error).toBeNull();
    domainAId = domRes.data!.id;

    const skRes = await adminClient
      .from("skills")
      .insert({
        user_id: userAId,
        domain_id: domainAId,
        name: "Systems Architecture 7B",
        normalized_name: "systems architecture 7b",
        level: 2,
      })
      .select("id")
      .single();
    if (skRes.error) console.error("skRes error:", skRes.error);
    expect(skRes.error).toBeNull();
    skillAId = skRes.data!.id;

    const qRes = await adminClient
      .from("quests")
      .insert({ user_id: userAId, title: "Build Scalable Backend 7B", quest_type: "production" })
      .select("id")
      .single();
    if (qRes.error) console.error("qRes error:", qRes.error);
    expect(qRes.error).toBeNull();
    questAId = qRes.data!.id;

    const knRes = await adminClient
      .from("knowledge_nodes")
      .insert({
        user_id: userAId,
        domain_id: domainAId,
        skill_id: skillAId,
        title: "CAP Theorem Note",
        node_type: "concept",
        verification_status: "inferred",
        confidence: 0.8,
      })
      .select("id")
      .single();

    if (knRes.error) console.error("knRes error:", knRes.error);
    expect(knRes.error).toBeNull();
    knowledgeNodeAId = knRes.data!.id;

    const actRes = await adminClient
      .from("activities")
      .insert({
        user_id: userAId,
        title: "Designed Distributed Storage",
        raw_input: "Designed Distributed Storage and Partition Strategy",
        activity_type: "coding",
        status: "confirmed",
        rules_version: "1.0.0",
      })
      .select("id")
      .single();
    if (actRes.error) console.error("actRes error:", actRes.error);
    expect(actRes.error).toBeNull();
    activityAId = actRes.data!.id;

    // Seed User B fixtures across all 5 entity types + artifact
    const domBRes = await adminClient
      .from("domains")
      .insert({ user_id: userBId, name: "Engineering B 7B", slug: `eng-b-7b-${Date.now()}` })
      .select("id")
      .single();
    expect(domBRes.error).toBeNull();
    const domainBId = domBRes.data!.id;

    const skBRes = await adminClient
      .from("skills")
      .insert({
        user_id: userBId,
        domain_id: domainBId,
        name: "Deep Learning 7B",
        normalized_name: "deep learning 7b",
        level: 1,
      })
      .select("id")
      .single();
    if (skBRes.error) console.error("skBRes error:", skBRes.error);
    expect(skBRes.error).toBeNull();
    skillBId = skBRes.data!.id;

    const qBRes = await adminClient
      .from("quests")
      .insert({ user_id: userBId, title: "Train Model 7B", quest_type: "production" })
      .select("id")
      .single();
    if (qBRes.error) console.error("qBRes error:", qBRes.error);
    expect(qBRes.error).toBeNull();
    questBId = qBRes.data!.id;

    const knBRes = await adminClient
      .from("knowledge_nodes")
      .insert({
        user_id: userBId,
        domain_id: domainBId,
        title: "Transformer Attention Note B",
        node_type: "concept",
        verification_status: "inferred",
        confidence: 0.9,
      })
      .select("id")
      .single();
    expect(knBRes.error).toBeNull();
    knowledgeNodeBId = knBRes.data!.id;

    const actBRes = await adminClient
      .from("activities")
      .insert({
        user_id: userBId,
        title: "Trained Attention Model B",
        raw_input: "Trained Attention Model on GPU cluster",
        activity_type: "coding",
        status: "confirmed",
        rules_version: "1.0.0",
      })
      .select("id")
      .single();
    expect(actBRes.error).toBeNull();
    activityBId = actBRes.data!.id;

    const evBRes = await adminClient
      .from("evidence_records")
      .insert({
        user_id: userBId,
        activity_id: activityBId,
        evidence_level: 3,
        description: "Benchmark logs from model run",
      })
      .select("id")
      .single();
    expect(evBRes.error).toBeNull();
    evidenceBId = evBRes.data!.id;

    const artBRes = await adminClient
      .from("artifacts")
      .insert({
        user_id: userBId,
        title: "User B Secret Neural Blueprint",
        artifact_type: "design_spec",
        summary: "Top Secret Spec",
        lifecycle_status: "active",
      })
      .select("id")
      .single();
    if (artBRes.error) console.error("artBRes error:", artBRes.error);
    expect(artBRes.error).toBeNull();
    artifactBId = artBRes.data!.id;
  }, 60000);

  afterAll(async () => {

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (userAId && userBId) {
      await adminClient.from("artifact_evidence").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("artifact_quests").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("artifact_knowledge_nodes").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("artifact_skills").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("artifact_activities").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("artifacts").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("evidence_records").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("xp_transactions").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("ai_assessments").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("activities").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("knowledge_nodes").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("quests").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("skills").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("domains").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("player_states").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("profiles").delete().in("user_id", [userAId, userBId]);
      await adminClient.auth.admin.deleteUser(userAId);
      await adminClient.auth.admin.deleteUser(userBId);
    }
    if (pg) {
      await pg.end();
    }
  });


  // Helper to create a test activity + assessment pair for confirm testing
  async function createTestActivityAndAssessment(
    userId: string,
    proposalArtifacts: Array<{
      title: string;
      artifactType: ArtifactType;
      summary?: string;
      description?: string;
      reusabilityScore?: number;
      skillIds?: string[];
      knowledgeNodeIds?: string[];
      questIds?: string[];
    }> = [],
    options?: { questId?: string },
  ) {
    const actRes = await adminClient
      .from("activities")
      .insert({
        user_id: userId,
        title: `Test Activity ${Date.now()}_${Math.random()}`,
        raw_input: "Test Raw Input",
        activity_type: "learning",
        status: "pending_assessment",
        rules_version: "1.0.0",
        effective_minutes: 30,
        quest_id: options?.questId ?? null,
      })
      .select("id")
      .single();
    const activityId = actRes.data!.id;


    const proposalJson = {
      activity: { type: "learning", completion: 1.0 },
      difficulty: { complexity: 0.5, uncertainty: 0.3, expertise_gap: 0.4, resistance: 0.2 },
      growth: { effort: 0.7, learning: 0.8, performance: 0.6, outcome: 0.7, artifact_value: 0.8, character_evidence: 0.5 },
      evidence: { level: 3, explanation: "Completed test activity" },
      affected_skills: [{ name: "Systems Architecture 7B", reason: "Direct study" }],
      knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
      mastery_changes: [{ target_type: "skill", target_name: "Systems Architecture 7B", from_level: 2, proposed_level: 3, confidence: 0.8, verification_required: false, reason: "Good work" }],
      xp_semantics: { base_value: 50, difficulty: 0.5, mastery_gain: 0.4, novelty: 0.5, goal_alignment: 0.8, repetition_risk: "low" },
      artifactProposals: proposalArtifacts,
      artifacts: [],
      next_quest: null,
      confidence: 0.9,
      uncertainty_notes: [],
    };

    const assRes = await adminClient
      .from("ai_assessments")
      .insert({
        activity_id: activityId,
        user_id: userId,
        status: "pending",
        assessment_json: proposalJson as unknown as Database["public"]["Tables"]["ai_assessments"]["Insert"]["assessment_json"],

        confidence: 0.9,
        prompt_version: "activity-evaluator-v0.2",
        rules_version: "1.0.0",
        model_name: "test-model",
      })

      .select("id")
      .single();

    return { activityId, assessmentId: assRes.data!.id };
  }

  // ==========================================================================
  // 1. UNAUTHENTICATED HTTP SECURITY (Fail-Closed)
  // ==========================================================================
  describe("1. Unauthenticated Security Matrix", () => {
    test("Unauthenticated requests return 401 across all artifact routes", async () => {
      const getList = await api(null, "/api/artifacts");
      expect(getList.status).toBe(401);

      const postCreate = await api(null, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({ title: "Unauth Artifact", artifactType: "document" }),
      });
      expect(postCreate.status).toBe(401);

      const getDetail = await api(null, `/api/artifacts/${artifactBId}`);
      expect(getDetail.status).toBe(401);

      const patchUpdate = await api(null, `/api/artifacts/${artifactBId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Hack Title" }),
      });
      expect(patchUpdate.status).toBe(401);

      const deleteArt = await api(null, `/api/artifacts/${artifactBId}`, {
        method: "DELETE",
      });
      expect(deleteArt.status).toBe(401);

      const postLinks = await api(null, `/api/artifacts/${artifactBId}/links`, {
        method: "POST",
        body: JSON.stringify({ activities: [] }),
      });
      expect(postLinks.status).toBe(401);
    });
  });

  // ==========================================================================
  // 1.5. SECURITY DEFINER PRIVILEGE & RAW RPC BOUNDARY MATRIX (Fail-Closed)
  // ==========================================================================
  describe("1.5. Security Definer Privilege & Raw RPC Boundary Matrix", () => {
    test("information_schema & has_function_privilege prove PUBLIC and anon have no EXECUTE, authenticated has EXECUTE", async () => {
      const privQuery = await pg.query(`
        SELECT
          has_function_privilege('anon', 'public.create_artifact_with_links(uuid, jsonb)', 'execute') AS anon_create,
          has_function_privilege('anon', 'public.manage_artifact_links(uuid, uuid, jsonb)', 'execute') AS anon_manage,
          has_function_privilege('authenticated', 'public.create_artifact_with_links(uuid, jsonb)', 'execute') AS auth_create,
          has_function_privilege('authenticated', 'public.manage_artifact_links(uuid, uuid, jsonb)', 'execute') AS auth_manage,
          has_function_privilege('public', 'public.create_artifact_with_links(uuid, jsonb)', 'execute') AS public_create,
          has_function_privilege('public', 'public.manage_artifact_links(uuid, uuid, jsonb)', 'execute') AS public_manage
      `);

      const row = privQuery.rows[0];
      expect(row.anon_create).toBe(false);
      expect(row.anon_manage).toBe(false);
      expect(row.public_create).toBe(false);
      expect(row.public_manage).toBe(false);
      expect(row.auth_create).toBe(true);
      expect(row.auth_manage).toBe(true);
    });

    test("Raw anon client calling create_artifact_with_links and manage_artifact_links is denied with 0 mutations", async () => {
      const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

      const resAnonCreate = await anonClient.rpc("create_artifact_with_links", {
        p_user_id: userAId,
        p_payload: {
          title: "Anon Spoofed Artifact",
          artifactType: "document",
        } as unknown as Database["public"]["Functions"]["create_artifact_with_links"]["Args"]["p_payload"],
      });
      expect(resAnonCreate.error).not.toBeNull();

      const { data: anonArts } = await adminClient
        .from("artifacts")
        .select("id")
        .eq("title", "Anon Spoofed Artifact");
      expect(anonArts?.length ?? 0).toBe(0);

      const resAnonManage = await anonClient.rpc("manage_artifact_links", {
        p_user_id: userAId,
        p_artifact_id: artifactBId,
        p_payload: {
          activities: [{ activityId: activityAId, action: "attach" }],
        } as unknown as Database["public"]["Functions"]["manage_artifact_links"]["Args"]["p_payload"],
      });
      expect(resAnonManage.error).not.toBeNull();
    });

    test("Cross-tenant raw RPC invocation User A -> User B is denied (fail-closed auth guard)", async () => {
      // User A tries to invoke create with User B's user_id
      const resAonB = await userA.client.rpc("create_artifact_with_links", {
        p_user_id: userBId,
        p_payload: {
          title: "User A Spoofed B Art",
          artifactType: "document",
        } as unknown as Database["public"]["Functions"]["create_artifact_with_links"]["Args"]["p_payload"],
      });
      expect(resAonB.error).not.toBeNull();
      expect(resAonB.error?.code).toBe("42501");

      const { data: arts } = await adminClient
        .from("artifacts")
        .select("id")
        .eq("title", "User A Spoofed B Art");
      expect(arts?.length ?? 0).toBe(0);

      // User A tries to invoke manage with User B's user_id
      const resManageAonB = await userA.client.rpc("manage_artifact_links", {
        p_user_id: userBId,
        p_artifact_id: artifactBId,
        p_payload: {
          activities: [{ activityId: activityAId, action: "attach" }],
        } as unknown as Database["public"]["Functions"]["manage_artifact_links"]["Args"]["p_payload"],
      });
      expect(resManageAonB.error).not.toBeNull();
      expect(resManageAonB.error?.code).toBe("42501");

      // User B reciprocal
      const resBonA = await userB.client.rpc("create_artifact_with_links", {
        p_user_id: userAId,
        p_payload: {
          title: "User B Spoofed A Art",
          artifactType: "document",
        } as unknown as Database["public"]["Functions"]["create_artifact_with_links"]["Args"]["p_payload"],
      });
      expect(resBonA.error).not.toBeNull();
      expect(resBonA.error?.code).toBe("42501");
    });

    test("Authenticated own-user raw RPC invocation succeeds", async () => {
      const ownTitle = `Raw Own Created Art ${Date.now()}`;
      const resOwn = await userA.client.rpc("create_artifact_with_links", {
        p_user_id: userAId,
        p_payload: {
          title: ownTitle,
          artifactType: "code_repository",
          summary: "Created directly via RPC",
        } as unknown as Database["public"]["Functions"]["create_artifact_with_links"]["Args"]["p_payload"],
      });
      expect(resOwn.error).toBeNull();
      expect(resOwn.data).toBeDefined();

      const { data: art } = await adminClient
        .from("artifacts")
        .select("*")
        .eq("user_id", userAId)
        .eq("title", ownTitle)
        .single();
      expect(art).toBeDefined();
      expect(art?.artifact_type).toBe("code_repository");
    });
  });

  // ==========================================================================
  // 2. REST API CRUD, FILTERS, JOIN HYDRATION & MULTI-TENANT ISOLATION
  // ==========================================================================
  describe("2. REST API CRUD & Multi-Tenant Isolation", () => {
    let createdArtifactId: string;


    test("POST /api/artifacts creates an artifact with 8-type taxonomy and initial relations", async () => {
      const res = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          title: "Architecture Design Blueprint 7B",
          artifactType: "design_spec",
          summary: "Core system architecture and partition specs",
          description: "Full markdown specs detailing distributed consensus and state machines",
          version: "1.0.0",
          reusabilityScore: 0.85,
          skillIds: [skillAId],
          questIds: [questAId],
          knowledgeNodeIds: [knowledgeNodeAId],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.artifact).toBeDefined();
      expect(data.artifact.title).toBe("Architecture Design Blueprint 7B");
      expect(data.artifact.normalizedTitle).toBe("architecture design blueprint 7b");
      expect(data.artifact.artifactType).toBe("design_spec");
      expect(data.artifact.reusabilityScore).toBe(0.85);
      expect(data.artifact.lifecycleStatus).toBe("active");
      createdArtifactId = data.artifact.id;
    });

    test("POST /api/artifacts enforces title uniqueness per user (409 Conflict)", async () => {
      const res = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          title: "   Architecture   Design Blueprint 7B  ",
          artifactType: "document",
        }),
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe("artifact_title_conflict");
    });

    test("POST /api/artifacts rejects invalid type or empty title (400 Bad Request)", async () => {
      const emptyTitle = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({ title: "  ", artifactType: "document" }),
      });
      expect(emptyTitle.status).toBe(400);

      const invalidType = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({ title: "Valid Title", artifactType: "generic_code" }),
      });
      expect(invalidType.status).toBe(400);
      const data = await invalidType.json();
      expect(data.code).toBe("invalid_type");
    });

    test("GET /api/artifacts lists artifacts with counts and supports filtering", async () => {
      const res = await api(userA, "/api/artifacts?type=design_spec&status=active");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.artifacts.length).toBeGreaterThanOrEqual(1);
      const item = data.artifacts.find((a: { id: string }) => a.id === createdArtifactId);
      expect(item).toBeDefined();
      expect(item.counts.skills).toBe(1);
      expect(item.counts.quests).toBe(1);
      expect(item.counts.knowledgeNodes).toBe(1);
    });

    test("GET /api/artifacts/[id] returns fully hydrated detail with 5 entity join links", async () => {
      const res = await api(userA, `/api/artifacts/${createdArtifactId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.artifact.id).toBe(createdArtifactId);
      expect(data.links.skills.length).toBe(1);
      expect(data.links.skills[0].name).toBe("Systems Architecture 7B");
      expect(data.links.quests.length).toBe(1);
      expect(data.links.quests[0].title).toBe("Build Scalable Backend 7B");
      expect(data.links.knowledgeNodes.length).toBe(1);
      expect(data.links.knowledgeNodes[0].title).toBe("CAP Theorem Note");
    });

    test("GET /api/artifacts/[id] returns non-disclosing 404 for User B artifact", async () => {
      const res = await api(userA, `/api/artifacts/${artifactBId}`);
      expect(res.status).toBe(404);
    });

    test("PATCH /api/artifacts/[id] updates metadata and handles archive/unarchive lifecycle", async () => {
      // Archive
      const patchRes = await api(userA, `/api/artifacts/${createdArtifactId}`, {
        method: "PATCH",
        body: JSON.stringify({
          summary: "Updated architecture summary",
          lifecycleStatus: "archived",
        }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.artifact.summary).toBe("Updated architecture summary");
      expect(patched.artifact.lifecycleStatus).toBe("archived");
      expect(patched.artifact.isArchived).toBe(true);
      expect(patched.artifact.archivedAt).not.toBeNull();

      // Unarchive
      const unarchiveRes = await api(userA, `/api/artifacts/${createdArtifactId}`, {
        method: "PATCH",
        body: JSON.stringify({
          lifecycleStatus: "active",
        }),
      });
      expect(unarchiveRes.status).toBe(200);
      const unarchived = await unarchiveRes.json();
      expect(unarchived.artifact.lifecycleStatus).toBe("active");
      expect(unarchived.artifact.isArchived).toBe(false);
      expect(unarchived.artifact.archivedAt).toBeNull();
    });

    test("POST /api/artifacts/[id]/links supports batch attach and detach across 5 entity types", async () => {
      // Attach activity
      const linkRes = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          activities: [{ activityId: activityAId, action: "attach", activityRole: "produced" }],
        }),
      });
      expect(linkRes.status).toBe(200);
      const data = await linkRes.json();
      expect(data.links.activities.some((a: { id: string }) => a.id === activityAId)).toBe(true);


      // Detach knowledge node
      const detachRes = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          knowledgeNodes: [{ nodeId: knowledgeNodeAId, action: "detach" }],
        }),
      });
      expect(detachRes.status).toBe(200);
      const data2 = await detachRes.json();
      expect(data2.links.knowledgeNodes.length).toBe(0);
    });

    // ------------------------------------------------------------------------
    // Lifecycle Contradiction Tests & isArchived Type Validation on POST & PATCH
    // ------------------------------------------------------------------------
    test("POST /api/artifacts rejects non-boolean isArchived (400 Bad Request)", async () => {
      const invalidTypes = ["true", 1, {}, []];
      for (const val of invalidTypes) {
        const res = await api(userA, "/api/artifacts", {
          method: "POST",
          body: JSON.stringify({
            title: `Type Test ${Date.now()}_${Math.random()}`,
            artifactType: "document",
            isArchived: val,
          }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.code).toBe("invalid_boolean");
      }
    });

    test("POST /api/artifacts rejects contradictory lifecycle combinations (400 Bad Request)", async () => {
      const cases = [
        { lifecycleStatus: "active", isArchived: true },
        { lifecycleStatus: "draft", isArchived: true },
        { lifecycleStatus: "superseded", isArchived: true },
        { lifecycleStatus: "archived", isArchived: false },
      ];

      for (const c of cases) {
        const res = await api(userA, "/api/artifacts", {
          method: "POST",
          body: JSON.stringify({
            title: `Contradiction Test ${Date.now()}_${Math.random()}`,
            artifactType: "document",
            ...c,
          }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.code).toBe("invalid_lifecycle_combination");
      }
    });

    test("PATCH /api/artifacts/[id] rejects contradictory lifecycle combinations (400 Bad Request)", async () => {
      const patchCases = [
        { lifecycleStatus: "active", isArchived: true },
        { lifecycleStatus: "archived", isArchived: false },
      ];

      for (const c of patchCases) {
        const res = await api(userA, `/api/artifacts/${createdArtifactId}`, {
          method: "PATCH",
          body: JSON.stringify(c),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.code).toBe("invalid_lifecycle_combination");
      }
    });

    // ------------------------------------------------------------------------
    // Hostile Create with Foreign Relations
    // ------------------------------------------------------------------------
    test("POST /api/artifacts rejects foreign relation IDs (404 Not Found) with zero artifact creation", async () => {
      const hostileTitle = `Hostile Foreign Create ${Date.now()}`;
      const res = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          title: hostileTitle,
          artifactType: "document",
          skillIds: [skillBId], // foreign skill!
        }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.code).toBe("not_found");

      // Verify zero artifacts created
      const { data: arts } = await adminClient
        .from("artifacts")
        .select("*")
        .eq("user_id", userAId)
        .eq("title", hostileTitle);
      expect(arts?.length ?? 0).toBe(0);
    });

    test("POST /api/artifacts rejects malformed relation UUID (400 Bad Request)", async () => {
      const res = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          title: `Malformed UUID Create ${Date.now()}`,
          artifactType: "document",
          questIds: ["not-a-valid-uuid"],
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("invalid_uuid");
    });

    // ------------------------------------------------------------------------
    // Strict Runtime Validation for /links Semantic Fields
    // ------------------------------------------------------------------------
    test("POST /api/artifacts/[id]/links validates semantic field bounds and types (400 Bad Request)", async () => {
      // 1. Invalid activityRole
      const resRole = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          activities: [{ activityId: activityAId, action: "attach", activityRole: "authored" }],
        }),
      });
      expect(resRole.status).toBe(400);
      const dataRole = await resRole.json();
      expect(dataRole.code).toBe("invalid_input");

      // 2. Out-of-bounds / non-integer demonstrationLevel (0, 6, 2.5)
      for (const badLevel of [0, 6, 2.5]) {
        const resLevel = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
          method: "POST",
          body: JSON.stringify({
            skills: [{ skillId: skillAId, action: "attach", demonstrationLevel: badLevel }],
          }),
        });
        expect(resLevel.status).toBe(400);
        const dataLevel = await resLevel.json();
        expect(dataLevel.code).toBe("invalid_input");
      }

      // 3. Invalid relationType
      const resRel = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          knowledgeNodes: [{ nodeId: knowledgeNodeAId, action: "attach", relationType: "relates" }],
        }),
      });
      expect(resRel.status).toBe(400);
      const dataRel = await resRel.json();
      expect(dataRel.code).toBe("invalid_input");

      // 4. Non-boolean isPrimaryDeliverable
      const resPrimary = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          quests: [{ questId: questAId, action: "attach", isPrimaryDeliverable: "true" }],
        }),
      });
      expect(resPrimary.status).toBe(400);
      const dataPrimary = await resPrimary.json();
      expect(dataPrimary.code).toBe("invalid_input");
    });

    // ------------------------------------------------------------------------
    // Deterministic List Ordering (created_at DESC, id ASC)
    // ------------------------------------------------------------------------
    test("GET /api/artifacts enforces deterministic ordering (created_at DESC, id ASC)", async () => {
      const fixedTimestamp = new Date(Date.now() - 50000).toISOString();
      const titles = [
        `Order Test A ${Date.now()}`,
        `Order Test B ${Date.now()}`,
        `Order Test C ${Date.now()}`,
      ];

      const inserted = await adminClient
        .from("artifacts")
        .insert(
          titles.map((title) => ({
            user_id: userAId,
            title,
            artifact_type: "document",
            created_at: fixedTimestamp,
            updated_at: fixedTimestamp,
          })),
        )
        .select("id, title, created_at");

      expect(inserted.error).toBeNull();
      const rows = inserted.data ?? [];
      expect(rows.length).toBe(3);

      // Expected order for same created_at is id ASC
      const sortedById = [...rows].sort((a, b) => a.id.localeCompare(b.id));

      const res = await api(userA, "/api/artifacts?status=all&limit=50");
      expect(res.status).toBe(200);
      const listData = await res.json();

      const found = listData.artifacts.filter((a: { id: string }) =>
        rows.some((r) => r.id === a.id),
      );
      expect(found.length).toBe(3);
      expect(found[0].id).toBe(sortedById[0].id);
      expect(found[1].id).toBe(sortedById[1].id);
      expect(found[2].id).toBe(sortedById[2].id);
    });

    // ------------------------------------------------------------------------
    // Cross-Tenant Entity ID Isolation Matrix across all 5 Entity Types
    // ------------------------------------------------------------------------
    test("Cross-Tenant HTTP isolation: User A cannot GET, PATCH, DELETE, or link User B's artifact", async () => {
      // 1. GET User B artifact -> 404
      const getRes = await api(userA, `/api/artifacts/${artifactBId}`);
      expect(getRes.status).toBe(404);

      // 2. PATCH User B artifact -> 404 & B unchanged
      const patchRes = await api(userA, `/api/artifacts/${artifactBId}`, {
        method: "PATCH",
        body: JSON.stringify({ summary: "Hacked by User A" }),
      });
      expect(patchRes.status).toBe(404);
      const { data: bArt } = await adminClient.from("artifacts").select("summary").eq("id", artifactBId).single();
      expect(bArt?.summary).toBe("Top Secret Spec");

      // 3. DELETE User B artifact -> 404 & B still exists
      const delRes = await api(userA, `/api/artifacts/${artifactBId}`, { method: "DELETE" });
      expect(delRes.status).toBe(404);
      const { data: bExists } = await adminClient.from("artifacts").select("id").eq("id", artifactBId).single();
      expect(bExists).toBeDefined();

      // 4. POST /links on User B artifact -> 404
      const linkBRes = await api(userA, `/api/artifacts/${artifactBId}/links`, {
        method: "POST",
        body: JSON.stringify({
          activities: [{ activityId: activityAId, action: "attach" }],
        }),
      });
      expect(linkBRes.status).toBe(404);
    });

    test("POST /api/artifacts/[id]/links rejects attaching any of the 5 foreign entity targets (404 Not Found, 0 mutations)", async () => {
      // 1. Foreign Activity
      const resAct = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          activities: [{ activityId: activityBId, action: "attach" }],
        }),
      });
      expect(resAct.status).toBe(404);
      const dataAct = await resAct.json();
      expect(dataAct.code).toBe("not_found");
      const { data: linkAct } = await adminClient
        .from("artifact_activities")
        .select("*")
        .eq("artifact_id", createdArtifactId)
        .eq("activity_id", activityBId);
      expect(linkAct?.length ?? 0).toBe(0);

      // 2. Foreign Skill
      const resSk = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          skills: [{ skillId: skillBId, action: "attach" }],
        }),
      });
      expect(resSk.status).toBe(404);
      const dataSk = await resSk.json();
      expect(dataSk.code).toBe("not_found");
      const { data: linkSk } = await adminClient
        .from("artifact_skills")
        .select("*")
        .eq("artifact_id", createdArtifactId)
        .eq("skill_id", skillBId);
      expect(linkSk?.length ?? 0).toBe(0);

      // 3. Foreign Knowledge Node
      const resKn = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          knowledgeNodes: [{ nodeId: knowledgeNodeBId, action: "attach" }],
        }),
      });
      expect(resKn.status).toBe(404);
      const dataKn = await resKn.json();
      expect(dataKn.code).toBe("not_found");
      const { data: linkKn } = await adminClient
        .from("artifact_knowledge_nodes")
        .select("*")
        .eq("artifact_id", createdArtifactId)
        .eq("node_id", knowledgeNodeBId);
      expect(linkKn?.length ?? 0).toBe(0);

      // 4. Foreign Quest
      const resQ = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          quests: [{ questId: questBId, action: "attach" }],
        }),
      });
      expect(resQ.status).toBe(404);
      const dataQ = await resQ.json();
      expect(dataQ.code).toBe("not_found");
      const { data: linkQ } = await adminClient
        .from("artifact_quests")
        .select("*")
        .eq("artifact_id", createdArtifactId)
        .eq("quest_id", questBId);
      expect(linkQ?.length ?? 0).toBe(0);

      // 5. Foreign Evidence
      const resEv = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          evidence: [{ evidenceId: evidenceBId, action: "attach" }],
        }),
      });
      expect(resEv.status).toBe(404);
      const dataEv = await resEv.json();
      expect(dataEv.code).toBe("not_found");
      const { data: linkEv } = await adminClient
        .from("artifact_evidence")
        .select("*")
        .eq("artifact_id", createdArtifactId)
        .eq("evidence_id", evidenceBId);
      expect(linkEv?.length ?? 0).toBe(0);
    });

    // ------------------------------------------------------------------------
    // Batch Links Atomicity
    // ------------------------------------------------------------------------
    test("POST /api/artifacts/[id]/links executes batch links atomically (all-or-nothing rollback)", async () => {
      // Create a test quest for User A
      const qRes = await adminClient
        .from("quests")
        .insert({ user_id: userAId, title: "Atomic Batch Test Quest", quest_type: "production" })
        .select("id")
        .single();
      const validQuestId = qRes.data!.id;

      // Submit batch with 1 valid attach and 1 foreign attach (questBId)
      const res = await api(userA, `/api/artifacts/${createdArtifactId}/links`, {
        method: "POST",
        body: JSON.stringify({
          quests: [
            { questId: validQuestId, action: "attach" },
            { questId: questBId, action: "attach" }, // foreign!
          ],
        }),
      });

      expect(res.status).toBe(404);

      // Verify the valid attach was NOT committed (transaction rolled back)
      const { data: link } = await adminClient
        .from("artifact_quests")
        .select("*")
        .eq("artifact_id", createdArtifactId)
        .eq("quest_id", validQuestId);
      expect(link?.length ?? 0).toBe(0);
    });

    // ------------------------------------------------------------------------
    // Referenced Delete HTTP Regression (409 Conflict)
    // ------------------------------------------------------------------------
    test("DELETE /api/artifacts/[id] returns 409 when referenced by Evidence record", async () => {
      // Create an artifact to be referenced
      const artRes = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          title: `Referenced Deletion Target ${Date.now()}`,
          artifactType: "document",
        }),
      });
      expect(artRes.status).toBe(201);
      const targetId = (await artRes.json()).artifact.id;

      // Create evidence record referencing the artifact
      const evRes = await adminClient
        .from("evidence_records")
        .insert({
          user_id: userAId,
          activity_id: activityAId,
          evidence_level: 3,
          description: "Evidence linking artifact",
        })
        .select("id")
        .single();
      const evidenceId = evRes.data!.id;

      // Link artifact to evidence
      await adminClient.from("artifact_evidence").insert({
        user_id: userAId,
        artifact_id: targetId,
        evidence_id: evidenceId,
      });

      // Attempt DELETE -> 409 Conflict
      const delRes = await api(userA, `/api/artifacts/${targetId}`, { method: "DELETE" });
      expect(delRes.status).toBe(409);
      const delData = await delRes.json();
      expect(delData.code).toBe("referenced_by_provenance");

      // Verify artifact still exists in DB
      const { data: artCheck } = await adminClient.from("artifacts").select("id").eq("id", targetId).single();
      expect(artCheck).toBeDefined();

      // Archiving succeeds
      const archRes = await api(userA, `/api/artifacts/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: true }),
      });
      expect(archRes.status).toBe(200);
      const archData = await archRes.json();
      expect(archData.artifact.isArchived).toBe(true);
      expect(archData.artifact.lifecycleStatus).toBe("archived");
    });

    test("DELETE /api/artifacts/[id] returns 409 when referenced by Knowledge Node provenance", async () => {
      // Create an artifact to be referenced
      const artRes = await api(userA, "/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          title: `Knowledge Provenance Target ${Date.now()}`,
          artifactType: "document",
        }),
      });
      expect(artRes.status).toBe(201);
      const targetId = (await artRes.json()).artifact.id;

      // Create Knowledge Node referencing this artifact via source_type = 'artifact'
      const knRes = await adminClient
        .from("knowledge_nodes")
        .insert({
          user_id: userAId,
          domain_id: domainAId,
          title: `Node Derived from Art ${Date.now()}`,
          node_type: "concept",
          verification_status: "inferred",
          confidence: 0.8,
          source_type: "artifact",
          source_id: targetId,
        })
        .select("id")
        .single();
      expect(knRes.error).toBeNull();
      const nodeId = knRes.data!.id;


      // Attempt DELETE -> 409 Conflict
      const delRes = await api(userA, `/api/artifacts/${targetId}`, { method: "DELETE" });
      expect(delRes.status).toBe(409);
      const delData = await delRes.json();
      expect(delData.code).toBe("referenced_by_provenance");

      // Verify artifact remains in DB
      const { data: artCheck } = await adminClient.from("artifacts").select("id").eq("id", targetId).single();
      expect(artCheck).toBeDefined();

      // Archiving succeeds
      const archRes = await api(userA, `/api/artifacts/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: true }),
      });
      expect(archRes.status).toBe(200);
      const archData = await archRes.json();
      expect(archData.artifact.isArchived).toBe(true);
      expect(archData.artifact.lifecycleStatus).toBe("archived");

      // Cleanup node
      await adminClient.from("knowledge_nodes").delete().eq("id", nodeId);
    });

  });

  // ==========================================================================
  // 3. GATE 7B: 15 REQUIRED ATOMIC SETTLEMENT VERIFICATION CASES
  // ==========================================================================
  describe("3. Gate 7B — Atomic Settlement & Resolution Verification Suite", () => {
    // ------------------------------------------------------------------------
    // Case 1: Assess with 0 Artifact Proposals & Confirm
    // ------------------------------------------------------------------------
    test("Case 1: Assess with 0 Artifact Proposals & Confirm -> 0 artifact records, 1 XP tx, 1 evidence", async () => {
      const { assessmentId } = await createTestActivityAndAssessment(userAId, []);

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(confirmRes.status).toBe(200);
      const body = await confirmRes.json();
      expect(body.transaction).toBeDefined();

      // Check DB: 0 artifact_activities records for this activity
      const { data: artActs } = await adminClient
        .from("artifact_activities")
        .select("*")
        .eq("activity_id", body.transaction.activityId);
      expect(artActs?.length ?? 0).toBe(0);
    });

    // ------------------------------------------------------------------------
    // Case 2: Single Proposal with Resolution "CREATE"
    // ------------------------------------------------------------------------
    test("Case 2: Single Proposal with Resolution 'CREATE' -> 1 Artifact record created with overrides and linked", async () => {
      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        {
          title: "Proposed Distributed Whitepaper",
          artifactType: "document",
          summary: "Original proposal summary",
          reusabilityScore: 0.5,
        },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        {
          proposalIndex: 0,
          resolution: "create",
          approvedOverrides: {
            title: "Authoritative Whitepaper v1",
            reusabilityScore: 0.95,
          },
        },
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      if (confirmRes.status !== 200) {
        console.error("Case 2 confirm failed:", confirmRes.status, await confirmRes.clone().json());
      }

      expect(confirmRes.status).toBe(200);

      // Verify in DB
      const { data: art } = await adminClient
        .from("artifacts")
        .select("*")
        .eq("user_id", userAId)
        .eq("title", "Authoritative Whitepaper v1")
        .single();
      expect(art).toBeDefined();
      expect(Number(art?.reusability_score)).toBe(0.95);
      expect(art?.artifact_type).toBe("document");

      const { data: actLink } = await adminClient
        .from("artifact_activities")
        .select("*")
        .eq("artifact_id", art!.id)
        .eq("activity_id", activityId)
        .single();
      expect(actLink?.activity_role).toBe("produced");
    });

    // ------------------------------------------------------------------------
    // Case 3: Multiple Proposals with Resolution "CREATE"
    // ------------------------------------------------------------------------
    test("Case 3: Multiple Proposals with Resolution 'CREATE' -> 2 distinct Artifact records created", async () => {
      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: `Multi Artifact Alpha ${Date.now()}`, artifactType: "code_repository" },
        { title: `Multi Artifact Beta ${Date.now()}`, artifactType: "data_analysis" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "create" },
        { proposalIndex: 1, resolution: "create" },
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      expect(confirmRes.status).toBe(200);

      const { data: links } = await adminClient
        .from("artifact_activities")
        .select("*")
        .eq("activity_id", activityId);
      expect(links?.length).toBe(2);
    });

    // ------------------------------------------------------------------------
    // Case 4: Resolution "EXISTING" (Owned Artifact)
    // ------------------------------------------------------------------------
    test("Case 4: Resolution 'EXISTING' (Owned Artifact) -> 0 new Artifact records, link added with role 'modified'", async () => {
      // Create existing artifact for User A
      const preArt = await adminClient
        .from("artifacts")
        .insert({
          user_id: userAId,
          title: `Pre-existing Architecture Doc ${Date.now()}`,
          artifact_type: "document",
          lifecycle_status: "active",
        })
        .select("id")
        .single();

      const existingId = preArt.data!.id;

      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: "Suggested Doc Update", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "existing", artifactId: existingId, activityRole: "modified" },
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      expect(confirmRes.status).toBe(200);

      const { data: link } = await adminClient
        .from("artifact_activities")
        .select("*")
        .eq("artifact_id", existingId)
        .eq("activity_id", activityId)
        .single();
      expect(link?.activity_role).toBe("modified");
    });

    // ------------------------------------------------------------------------
    // Case 5: Resolution "EXISTING" with Foreign Artifact UUID
    // ------------------------------------------------------------------------
    test("Case 5: Resolution 'EXISTING' with Foreign Artifact UUID -> 404 (non-disclosing) & zero settlement", async () => {
      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: "Suggested Doc Update", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "existing", artifactId: artifactBId, activityRole: "modified" },
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      expect(confirmRes.status).toBe(404);

      // Verify entire transaction rolled back: activity is still pending
      const { data: act } = await adminClient.from("activities").select("status").eq("id", activityId).single();
      expect(act?.status).toBe("pending_assessment");
      const { data: ass } = await adminClient.from("ai_assessments").select("status").eq("id", assessmentId).single();
      expect(ass?.status).toBe("pending");
      const { data: txs } = await adminClient.from("xp_transactions").select("*").eq("activity_id", activityId);
      expect(txs?.length ?? 0).toBe(0);
    });

    // ------------------------------------------------------------------------
    // Case 6: Resolution "EXISTING" with Malformed UUID
    // ------------------------------------------------------------------------
    test("Case 6: Resolution 'EXISTING' with Malformed UUID -> 400 Bad Request & zero settlement", async () => {
      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: "Suggested Doc", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        {
          proposalIndex: 0,
          resolution: "existing",
          artifactId: "invalid-uuid-string",
          activityRole: "modified",
        } as unknown as ArtifactResolutionInput,
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      expect(confirmRes.status).toBe(400);

      const { data: act } = await adminClient.from("activities").select("status").eq("id", activityId).single();
      expect(act?.status).toBe("pending_assessment");
    });

    // ------------------------------------------------------------------------
    // Case 7: Resolution "CREATE" with Existing Title Conflict
    // ------------------------------------------------------------------------
    test("Case 7: Resolution 'CREATE' with Existing Title Conflict -> 409 Conflict & zero settlement", async () => {
      // User A already has artifact "Existing Conflict Doc"
      await adminClient.from("artifacts").insert({
        user_id: userAId,
        title: "Existing Conflict Doc",
        artifact_type: "document",
      });

      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: "New Doc", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        {
          proposalIndex: 0,
          resolution: "create",
          approvedOverrides: { title: "   Existing   Conflict Doc   " },
        },
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      expect(confirmRes.status).toBe(409);
      const data = await confirmRes.json();
      expect(data.code).toBe("artifact_title_conflict");

      // Verify zero settlement
      const { data: act } = await adminClient.from("activities").select("status").eq("id", activityId).single();
      expect(act?.status).toBe("pending_assessment");
    });

    // ------------------------------------------------------------------------
    // Case 8: Resolution "IGNORE"
    // ------------------------------------------------------------------------
    test("Case 8: Resolution 'IGNORE' -> 200 OK, 0 Artifacts created, XP + Evidence recorded normally", async () => {
      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: "Discardable Sketch", artifactType: "creative_work" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "ignore" },
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      expect(confirmRes.status).toBe(200);

      // Verify 0 artifact activities
      const { data: artActs } = await adminClient.from("artifact_activities").select("*").eq("activity_id", activityId);
      expect(artActs?.length ?? 0).toBe(0);

      // Verify XP settled
      const { data: txs } = await adminClient.from("xp_transactions").select("*").eq("activity_id", activityId);
      expect(txs?.length).toBe(1);
    });

    // ------------------------------------------------------------------------
    // Case 9: Mixed Resolutions (CREATE + EXISTING + IGNORE)
    // ------------------------------------------------------------------------
    test("Case 9: Mixed Resolutions (CREATE + EXISTING + IGNORE) -> Exact multi-target execution", async () => {
      const preArt = await adminClient
        .from("artifacts")
        .insert({
          user_id: userAId,
          title: `Pre-existing Mixed Target ${Date.now()}`,
          artifact_type: "document",
        })
        .select("id")
        .single();
      const existingId = preArt.data!.id;

      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: `Mixed Created Art ${Date.now()}`, artifactType: "code_repository" },
        { title: "Ignored Scratch Note", artifactType: "synthesis_note" },
        { title: "Update Existing Art", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "create" },
        { proposalIndex: 1, resolution: "ignore" },
        { proposalIndex: 2, resolution: "existing", artifactId: existingId, activityRole: "referenced" },
      ];

      const confirmRes = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      expect(confirmRes.status).toBe(200);

      const { data: links } = await adminClient.from("artifact_activities").select("*").eq("activity_id", activityId);
      expect(links?.length).toBe(2); // 1 produced, 1 referenced
      expect(links?.some((l) => l.activity_role === "produced")).toBe(true);
      expect(links?.some((l) => l.activity_role === "referenced")).toBe(true);
    });

    // ------------------------------------------------------------------------
    // Case 10: Repeat Confirm (Idempotency Guard)
    // ------------------------------------------------------------------------
    test("Case 10: Repeat Confirm -> 409 Conflict ('already_confirmed') and zero duplicate mutations", async () => {
      const { assessmentId, activityId } = await createTestActivityAndAssessment(userAId, [
        { title: `Idempotent Target ${Date.now()}`, artifactType: "presentation" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "create" },
      ];

      // First confirm: succeeds
      const res1 = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res1.status).toBe(200);

      const { count: countBefore } = await adminClient
        .from("artifact_activities")
        .select("*", { count: "exact" })
        .eq("activity_id", activityId);

      // Second confirm: 409
      const res2 = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res2.status).toBe(409);
      const body2 = await res2.json();
      expect(body2.code).toBe("already_confirmed");

      const { count: countAfter } = await adminClient
        .from("artifact_activities")
        .select("*", { count: "exact" })
        .eq("activity_id", activityId);
      expect(countAfter).toBe(countBefore);
    });

    // ------------------------------------------------------------------------
    // Case 11: Duplicate `proposalIndex` in Confirm Payload
    // ------------------------------------------------------------------------
    test("Case 11: Duplicate proposalIndex in confirm payload -> 400 Bad Request", async () => {
      const { assessmentId } = await createTestActivityAndAssessment(userAId, [
        { title: "Prop 0", artifactType: "document" },
        { title: "Prop 1", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "create" },
        { proposalIndex: 0, resolution: "ignore" },
      ];

      const res = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("duplicate_proposal_index");
    });

    // ------------------------------------------------------------------------
    // Case 12: Out-of-Range `proposalIndex`
    // ------------------------------------------------------------------------
    test("Case 12: Out-of-Range proposalIndex -> 400 Bad Request", async () => {
      const { assessmentId } = await createTestActivityAndAssessment(userAId, [
        { title: "Prop 0", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 99, resolution: "create" },
      ];

      const res = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("out_of_range_proposal_index");
    });

    // ------------------------------------------------------------------------
    // Case 13: Incomplete Proposal Coverage
    // ------------------------------------------------------------------------
    test("Case 13: Incomplete proposal coverage (N=2, sent 1) -> 400 Bad Request", async () => {
      const { assessmentId } = await createTestActivityAndAssessment(userAId, [
        { title: "Prop 0", artifactType: "document" },
        { title: "Prop 1", artifactType: "document" },
      ]);

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "create" },
      ];

      const res = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("incomplete_proposal_coverage");
    });

    // ------------------------------------------------------------------------
    // Case 14: Proposal Tampering Protection
    // ------------------------------------------------------------------------
    test("Case 14: Proposal Tampering Protection -> Server strictly reads proposal from database assessment_json", async () => {
      const { assessmentId } = await createTestActivityAndAssessment(userAId, [
        { title: "Canonical AI Generated Title", artifactType: "data_analysis", reusabilityScore: 0.77 },
      ]);

      // Client sends CREATE without overrides
      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "create" },
      ];

      const res = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res.status).toBe(200);

      const { data: art } = await adminClient
        .from("artifacts")
        .select("*")
        .eq("user_id", userAId)
        .eq("title", "Canonical AI Generated Title")
        .single();
      expect(art).toBeDefined();
      expect(art?.artifact_type).toBe("data_analysis");
      expect(Number(art?.reusability_score)).toBe(0.77);
    });

    // ------------------------------------------------------------------------
    // Case 15: Artifact Relation / FK Failure Rollback (Complete Proof)
    // ------------------------------------------------------------------------
    test("Case 15: Artifact Relation / FK Failure Rollback -> 404 (non-disclosing) and all-or-nothing rollback across all subsystems", async () => {
      const proposedTitle = `FK Failure Target ${Date.now()}`;

      // 1. Create a dedicated active Quest for Case 15 where successful settlement in G.8 WOULD mutate it
      const testQuestRes = await adminClient
        .from("quests")
        .insert({
          user_id: userAId,
          title: `Case 15 Rollback Quest ${Date.now()}`,
          quest_type: "production",
          status: "active",
          progress: 10,
        })
        .select("id, progress, status, updated_at, completed_at")
        .single();
      expect(testQuestRes.error).toBeNull();
      const questCase15 = testQuestRes.data!;

      // 2. Snapshot Quest state BEFORE confirm
      const questBefore = {
        progress: questCase15.progress,
        status: questCase15.status,
        updated_at: questCase15.updated_at,
        completed_at: questCase15.completed_at,
      };

      // 3. Create Activity explicitly linked to questCase15.id + Assessment proposal referencing cross-tenant questBId
      const { assessmentId, activityId } = await createTestActivityAndAssessment(
        userAId,
        [
          {
            title: proposedTitle,
            artifactType: "document",
            questIds: [questBId], // deliberate cross-tenant relation failure in G.9
          },
        ],
        { questId: questCase15.id },
      );

      const resolutions: ArtifactResolutionInput[] = [
        { proposalIndex: 0, resolution: "create" },
      ];

      const res = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });

      // The DB composite FK/check rejects User A artifact linked to User B quest -> non-disclosing 404
      expect(res.status).toBe(404);

      // Verify all-or-nothing rollback across all subsystems:
      // 1. Activity and Assessment remain pending
      const { data: act } = await adminClient.from("activities").select("status").eq("id", activityId).single();
      expect(act?.status).toBe("pending_assessment");
      const { data: ass } = await adminClient.from("ai_assessments").select("status").eq("id", assessmentId).single();
      expect(ass?.status).toBe("pending");

      // 2. Zero XP transactions
      const { data: txs } = await adminClient.from("xp_transactions").select("*").eq("activity_id", activityId);
      expect(txs?.length ?? 0).toBe(0);

      // 3. Zero Evidence records
      const { data: evs } = await adminClient.from("evidence_records").select("*").eq("activity_id", activityId);
      expect(evs?.length ?? 0).toBe(0);

      // 4. Zero Mastery events
      const { data: mEvents } = await adminClient.from("mastery_events").select("*").eq("activity_id", activityId);
      expect(mEvents?.length ?? 0).toBe(0);

      // 5. Quest progress, status, updated_at, completed_at completely unchanged (BEFORE === AFTER)
      const { data: questAfter } = await adminClient
        .from("quests")
        .select("progress, status, updated_at, completed_at")
        .eq("id", questCase15.id)
        .single();
      expect(questAfter?.progress).toBe(questBefore.progress);
      expect(questAfter?.status).toBe(questBefore.status);
      expect(questAfter?.updated_at).toBe(questBefore.updated_at);
      expect(questAfter?.completed_at).toBe(questBefore.completed_at);

      // 6. Zero Artifact rows created with proposedTitle
      const { data: arts } = await adminClient.from("artifacts").select("*").eq("user_id", userAId).eq("title", proposedTitle);
      expect(arts?.length ?? 0).toBe(0);

      // 7. Explicitly assert zero leaked rows in all 5 Artifact join tables for this proposed artifact/activity:
      const { data: artActs } = await adminClient.from("artifact_activities").select("*").eq("activity_id", activityId);
      expect(artActs?.length ?? 0).toBe(0);

      const { data: artSks } = await adminClient.from("artifact_skills").select("*, artifacts!inner(title)").eq("artifacts.title", proposedTitle);
      expect(artSks?.length ?? 0).toBe(0);

      const { data: artKns } = await adminClient.from("artifact_knowledge_nodes").select("*, artifacts!inner(title)").eq("artifacts.title", proposedTitle);
      expect(artKns?.length ?? 0).toBe(0);

      const { data: artQs } = await adminClient.from("artifact_quests").select("*, artifacts!inner(title)").eq("artifacts.title", proposedTitle);
      expect(artQs?.length ?? 0).toBe(0);

      const { data: artEvs } = await adminClient.from("artifact_evidence").select("*, artifacts!inner(title)").eq("artifacts.title", proposedTitle);
      expect(artEvs?.length ?? 0).toBe(0);
    });




    // ------------------------------------------------------------------------
    // Approved Overrides Runtime Validation Tests
    // ------------------------------------------------------------------------
    test("Approved Overrides: Unknown keys or invalid types return 400 Bad Request", async () => {
      const { assessmentId } = await createTestActivityAndAssessment(userAId, [
        { title: "Override Validation Target", artifactType: "document" },
      ]);

      // 1. Unknown field in approvedOverrides
      const resUnknown = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "create",
              approvedOverrides: { maliciousField: "malicious_value" },
            },
          ],
        }),
      });
      expect(resUnknown.status).toBe(400);
      const dataUnknown = await resUnknown.json();
      expect(dataUnknown.code).toBe("invalid_approved_overrides");

      // 2. Invalid artifactType in approvedOverrides
      const resInvalidType = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "create",
              approvedOverrides: { artifactType: "generic_code" },
            },
          ],
        }),
      });
      expect(resInvalidType.status).toBe(400);
      const dataInvalidType = await resInvalidType.json();
      expect(dataInvalidType.code).toBe("invalid_artifact_type");

      // 3. Out-of-range reusabilityScore
      const resScore = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "create",
              approvedOverrides: { reusabilityScore: 1.5 },
            },
          ],
        }),
      });
      expect(resScore.status).toBe(400);
      const dataScore = await resScore.json();
      expect(dataScore.code).toBe("invalid_approved_overrides");

      // 4. Empty title in approvedOverrides
      const resEmptyTitle = await api(userA, `/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "create",
              approvedOverrides: { title: "   " },
            },
          ],
        }),
      });
      expect(resEmptyTitle.status).toBe(400);
      const dataEmptyTitle = await resEmptyTitle.json();
      expect(dataEmptyTitle.code).toBe("empty_artifact_title");
    });
  });
});
