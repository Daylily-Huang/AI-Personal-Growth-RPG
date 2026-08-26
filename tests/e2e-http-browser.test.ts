import http from "node:http";
import next from "next";
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const TEST_PORT = 3095;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const DEFAULT_LOCAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEFAULT_LOCAL_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_LOCAL_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_LOCAL_SERVICE_KEY;

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = SUPABASE_SERVICE_ROLE_KEY;

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
    store,
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
          if (cookieStr.includes("Max-Age=0") || !v) {
            store.delete(name.trim());
          } else {
            store.set(name.trim(), v.trim());
          }
        }
      });
    },
  };
}

describe.skipIf(!DATABASE_URL)("Stage 3.1 — Full Real HTTP / Browser Auth E2E (Live Next.js Server)", () => {
  let app: ReturnType<typeof next>;
  let server: http.Server;
  const userAEmail = `e2e_player_a_${Date.now()}@growth.rpg`;
  const userBEmail = `e2e_player_b_${Date.now()}@growth.rpg`;
  const testPassword = "Password123!Safe";

  beforeAll(async () => {
    app = next({
      dev: false,
      hostname: "127.0.0.1",
      port: TEST_PORT,
      dir: process.cwd(),
    });
    await app.prepare();

    const handle = app.getRequestHandler();
    server = http.createServer((req, res) => handle(req, res));
    await new Promise<void>((resolve) => server.listen(TEST_PORT, "127.0.0.1", () => resolve()));
  }, 30000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  test("1. Unauthenticated HTTP access to /dashboard is intercepted by proxy with 307 -> /login", async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/login");
  });

  test("2. Unauthenticated HTTP access to /api/dashboard returns 401 AuthRequiredError", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("3. Real Player A signs up, authenticates, and completes full Activity -> Assess -> Settle journey over HTTP", async () => {
    const jarA = createCookieJar();

    // Sign up User A via Supabase Auth
    const { data: authData, error: authErr } = await jarA.client.auth.signUp({
      email: userAEmail,
      password: testPassword,
    });
    expect(authErr).toBeNull();
    if (!authData?.session) {
      const { error: signErr } = await jarA.client.auth.signInWithPassword({
        email: userAEmail,
        password: testPassword,
      });
      expect(signErr).toBeNull();
    }

    const cookieHeader = jarA.getCookieHeader();
    expect(cookieHeader).toBeTruthy();

    // 1. Initial Dashboard Read over HTTP
    const dashRes1 = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    expect(dashRes1.status).toBe(200);
    const { dashboard: dash1 } = await dashRes1.json();
    expect(dash1.player.totalXp).toBe(0);
    expect(dash1.player.playerLevel).toBe(1);
    expect(dash1.activities.length).toBe(0);

    // 2. Create Activity over HTTP
    const createActRes = await fetch(`${BASE_URL}/api/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        rawInput: "Mastered PostgreSQL RLS and Security Definer RPCs",
        totalMinutes: 60,
        effectiveMinutes: 50,
      }),
    });
    expect(createActRes.status).toBe(201);
    const actBody = await createActRes.json();
    expect(actBody.activity.id).toBeDefined();
    expect(actBody.activity.status).toBe("pending_assessment");
    const activityId = actBody.activity.id;

    // 3. Request AI Assessment over HTTP
    const assessRes = await fetch(`${BASE_URL}/api/activities/${activityId}/assess`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
    expect(assessRes.status).toBe(200);
    const assessBody = await assessRes.json();
    expect(assessBody.assessment.id).toBeDefined();
    const assessmentId = assessBody.assessment.id;

    // 4. Confirm and Settle Assessment over HTTP
    const confirmRes = await fetch(`${BASE_URL}/api/assessments/${assessmentId}/confirm`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
    expect(confirmRes.status).toBe(200);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.transaction).toBeDefined();
    expect(confirmBody.transaction.amount).toBeGreaterThan(0);

    // 5. Re-query Dashboard over HTTP -> verify real DB state update
    const dashRes2 = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    expect(dashRes2.status).toBe(200);
    const { dashboard: dash2 } = await dashRes2.json();
    expect(dash2.player.totalXp).toBeGreaterThan(0);
    expect(dash2.activities.length).toBe(1);
    expect(dash2.recentGrowth.length).toBe(1);
    expect(dash2.skills.length).toBeGreaterThan(0);

    // 6. User A accesses /dashboard page over HTTP with session cookie -> 200 OK (no redirect)
    const pageRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    expect(pageRes.status).toBe(200);
  });

  test("4. Player B context is completely isolated over HTTP", async () => {
    const jarB = createCookieJar();

    // Sign up User B
    const { data: authDataB, error: authErrB } = await jarB.client.auth.signUp({
      email: userBEmail,
      password: testPassword,
    });
    expect(authErrB).toBeNull();
    if (!authDataB?.session) {
      const { error: signErrB } = await jarB.client.auth.signInWithPassword({
        email: userBEmail,
        password: testPassword,
      });
      expect(signErrB).toBeNull();
    }

    const cookieHeaderB = jarB.getCookieHeader();

    // Query User B's dashboard over HTTP
    const dashResB = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeaderB },
    });
    expect(dashResB.status).toBe(200);
    const { dashboard: dashB } = await dashResB.json();
    // Verify User B cannot see User A's data
    expect(dashB.player.totalXp).toBe(0);
    expect(dashB.activities.length).toBe(0);
    expect(dashB.recentGrowth.length).toBe(0);
  });

  test("5. Logout over HTTP clears session and returns 401 on subsequent protected API requests", async () => {
    const jarA = createCookieJar();
    await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });

    let cookieHeader = jarA.getCookieHeader();

    // Call Logout over HTTP
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
    expect(logoutRes.status).toBe(200);

    // Merge deleted cookies from response
    jarA.mergeFromResponse(logoutRes);
    cookieHeader = jarA.getCookieHeader();

    // Access /api/dashboard after logout -> 401
    const dashAfterLogout = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    expect(dashAfterLogout.status).toBe(401);
  });

  test("6. Session token refresh maintains valid authenticated HTTP access to protected routes", async () => {
    const jarA = createCookieJar();
    const { error: signInErr } = await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });
    expect(signInErr).toBeNull();

    // Trigger genuine Supabase Auth session refresh
    const { data: refreshData, error: refreshErr } = await jarA.client.auth.refreshSession();
    expect(refreshErr).toBeNull();
    expect(refreshData.session).toBeDefined();

    const refreshedCookieHeader = jarA.getCookieHeader();
    expect(refreshedCookieHeader).toBeTruthy();

    // Query protected API using refreshed session cookies over HTTP
    const dashRes = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: refreshedCookieHeader },
    });
    expect(dashRes.status).toBe(200);
    const { dashboard } = await dashRes.json();
    expect(dashboard.player.totalXp).toBeGreaterThan(0);
  });

  test("7. Full Production HTTP Quest E2E: Create hierarchy, patch child, aggregate tree, cycle & cross-tenant reject", async () => {
    const jarA = createCookieJar();
    await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });
    const cookieHeaderA = jarA.getCookieHeader();

    const jarB = createCookieJar();
    await jarB.client.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    });
    const cookieHeaderB = jarB.getCookieHeader();

    // 1. User A creates Parent Quest via HTTP POST /api/quests
    const parentRes = await fetch(`${BASE_URL}/api/quests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        title: "HTTP Parent Quest",
        questType: "production",
        isMainQuest: true,
      }),
    });
    expect(parentRes.status).toBe(201);
    const { quest: parentQuest } = await parentRes.json();
    expect(parentQuest.id).toBeDefined();

    // 2. User A creates Child Quest via HTTP POST /api/quests
    const childRes = await fetch(`${BASE_URL}/api/quests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        title: "HTTP Child Quest",
        parentQuestId: parentQuest.id,
        questType: "skill",
        progress: 0,
      }),
    });
    expect(childRes.status).toBe(201);
    const { quest: childQuest } = await childRes.json();
    expect(childQuest.parentQuestId).toBe(parentQuest.id);

    // 3. User A updates Child Quest progress via HTTP PATCH /api/quests/[id]
    const patchRes = await fetch(`${BASE_URL}/api/quests/${childQuest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({ progress: 100, status: "completed" }),
    });
    expect(patchRes.status).toBe(200);

    // 4. User A queries tree via HTTP GET /api/quests?tree=true
    const treeRes = await fetch(`${BASE_URL}/api/quests?tree=true`, {
      headers: { Cookie: cookieHeaderA },
    });
    expect(treeRes.status).toBe(200);
    const { tree } = await treeRes.json();
    const parentInTree = tree.find((t: { id: string }) => t.id === parentQuest.id);
    expect(parentInTree).toBeDefined();
    expect(parentInTree.progress).toBe(100);

    // 5. Anti-cycle over HTTP: Parent -> Child -> Parent (cycle attempt)
    const cycleRes = await fetch(`${BASE_URL}/api/quests/${parentQuest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({ parentQuestId: childQuest.id }),
    });
    expect(cycleRes.status).toBe(400);

    // 6. Cross-tenant isolation over HTTP: User B tries to PATCH User A's quest -> 404
    const userBPatchRes = await fetch(`${BASE_URL}/api/quests/${childQuest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderB },
      body: JSON.stringify({ progress: 0 }),
    });
    expect(userBPatchRes.status).toBe(404);
  });

  test("9. Full End-to-End Quest Growth Loop over HTTP (Create Quest -> Create Linked Activity -> Assess -> Confirm -> Quest Progress & Parent Roll-up Verified over HTTP)", async () => {
    const jarA = createCookieJar();
    await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });
    const cookieHeaderA = jarA.getCookieHeader();

    // 1. User A creates Parent Quest via HTTP POST /api/quests
    const parentRes = await fetch(`${BASE_URL}/api/quests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        title: "E2E Master Quest",
        questType: "production",
        questSize: "major",
        isMainQuest: true,
      }),
    });
    expect(parentRes.status).toBe(201);
    const { quest: parentQuest } = await parentRes.json();

    // 2. User A creates Child Quest via HTTP POST /api/quests
    const childRes = await fetch(`${BASE_URL}/api/quests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        title: "E2E Child Subtask",
        parentQuestId: parentQuest.id,
        questType: "skill",
        questSize: "standard",
        progress: 0,
      }),
    });
    expect(childRes.status).toBe(201);
    const { quest: childQuest } = await childRes.json();

    // 3. User A creates Activity linked to Child Quest
    const actRes = await fetch(`${BASE_URL}/api/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        rawInput: "Completed critical subtask implementation and automated tests",
        questId: childQuest.id,
        totalMinutes: 60,
        effectiveMinutes: 50,
      }),
    });
    expect(actRes.status).toBe(201);
    const { activity } = await actRes.json();
    expect(activity.questId).toBe(childQuest.id);
    expect(activity.questSizeSnapshot).toBe("standard");
    expect(activity.questIdSnapshot).toBe(childQuest.id);
    expect(activity.questTitleSnapshot).toBe("E2E Child Subtask");

    // 4. User renames and changes size of Child Quest (to verify audit snapshot immunity)
    const patchQuestRes = await fetch(`${BASE_URL}/api/quests/${childQuest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        title: "Renamed Subtask Title",
        questSize: "micro",
      }),
    });
    expect(patchQuestRes.status).toBe(200);

    // 5. Request AI Assessment over HTTP
    const assessRes = await fetch(`${BASE_URL}/api/activities/${activity.id}/assess`, {
      method: "POST",
      headers: { Cookie: cookieHeaderA },
    });
    expect(assessRes.status).toBe(200);
    const { assessment } = await assessRes.json();

    // 6. Confirm and Settle Assessment over HTTP
    const confirmRes = await fetch(`${BASE_URL}/api/assessments/${assessment.id}/confirm`, {
      method: "POST",
      headers: { Cookie: cookieHeaderA },
    });
    expect(confirmRes.status).toBe(200);
    const { transaction } = await confirmRes.json();
    expect(transaction.amount).toBeGreaterThan(0);
    expect(transaction.modifierJson.questSize).toBe("standard");
    expect(transaction.modifierJson.questCap).toBe(120);
    expect(transaction.modifierJson.questIdSnapshot).toBe(childQuest.id);
    expect(transaction.modifierJson.questTitleSnapshot).toBe("E2E Child Subtask");

    // 7. Verify Child Quest progress advanced over HTTP GET /api/quests/[id]
    const checkChild = await fetch(`${BASE_URL}/api/quests/${childQuest.id}`, {
      headers: { Cookie: cookieHeaderA },
    });
    expect(checkChild.status).toBe(200);
    const { quest: updatedChild } = await checkChild.json();
    expect(updatedChild.progress).toBeGreaterThan(0);

    // 7. Verify Parent Quest aggregated progress over HTTP GET /api/quests?tree=true
    const checkTree = await fetch(`${BASE_URL}/api/quests?tree=true`, {
      headers: { Cookie: cookieHeaderA },
    });
    expect(checkTree.status).toBe(200);
    const { tree } = await checkTree.json();
    const parentInTree = tree.find((t: { id: string }) => t.id === parentQuest.id);
    expect(parentInTree).toBeDefined();
    expect(parentInTree.progress).toBe(updatedChild.progress);
  });

  test("10. Full Knowledge Map Lifecycle & Cross-Tenant Security Journey over HTTP", async () => {
    const jarA = createCookieJar();
    const { data: authA, error: errA } = await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });
    expect(errA).toBeNull();
    const cookieHeaderA = jarA.getCookieHeader();
    const userAId = authA?.user?.id;
    expect(userAId).toBeDefined();

    const jarB = createCookieJar();
    const { data: authB, error: errB } = await jarB.client.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    });
    expect(errB).toBeNull();
    const cookieHeaderB = jarB.getCookieHeader();
    const userBId = authB?.user?.id;
    expect(userBId).toBeDefined();

    // 1. User A creates Activity via HTTP
    const actRes = await fetch(`${BASE_URL}/api/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        rawInput: "Researched Hebbian Plasticity and Long-Term Potentiation (LTP)",
        totalMinutes: 45,
        effectiveMinutes: 40,
      }),
    });
    expect(actRes.status).toBe(201);
    const actBody = await actRes.json();
    expect(actBody.activity).toBeDefined();
    const actA = actBody.activity;
    expect(actA.id).toBeDefined();

    // 2. User A creates Inferred Knowledge Node (AI proposal backed by Activity)
    // Create direct Supabase service role client to seed inferred proposal
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create domain for User A
    const domainId = crypto.randomUUID();
    await supabaseAdmin.from("domains").insert({
      id: domainId,
      user_id: userAId!,
      name: "E2E Neuroscience",
      slug: `e2e-neuro-${Date.now()}`,
    });

    const nodeA1Id = crypto.randomUUID();
    const nodeA2Id = crypto.randomUUID();

    const { error: seedNode1Err } = await supabaseAdmin.from("knowledge_nodes").insert({
      id: nodeA1Id,
      user_id: userAId!,
      domain_id: domainId,
      title: "Long-Term Potentiation (LTP)",
      description: "Persistent strengthening of synapses based on patterns of activity",
      node_type: "concept",
      verification_status: "inferred",
      confidence: 0.85,
      source_type: "ai_proposal",
      source_id: actA.id,
    });
    expect(seedNode1Err).toBeNull();

    const { error: seedNode2Err } = await supabaseAdmin.from("knowledge_nodes").insert({
      id: nodeA2Id,
      user_id: userAId!,
      domain_id: domainId,
      title: "NMDA Receptor Spine Growth",
      node_type: "claim",
      verification_status: "verified",
      confidence: 1.00,
      verified_at: new Date().toISOString(),
      verified_by: userAId!,
      source_type: "user_created",
    });
    expect(seedNode2Err).toBeNull();

    // 3. User A queries Node 1 Detail over HTTP GET /api/knowledge/[id] -> provenance verification
    const node1Res = await fetch(`${BASE_URL}/api/knowledge/${nodeA1Id}`, {
      headers: { Cookie: cookieHeaderA },
    });
    expect(node1Res.status).toBe(200);
    const node1Detail = await node1Res.json();
    expect(node1Detail.node.id).toBe(nodeA1Id);
    expect(node1Detail.node.verificationStatus).toBe("inferred");
    expect(node1Detail.node.confidence).toBe(0.85);
    expect(node1Detail.provenance.sourceActivity).toBeDefined();
    expect(node1Detail.provenance.sourceActivity.id).toBe(actA.id);

    // 4. User A verifies Node 1 via HTTP POST /api/knowledge/[id]/verify -> 200 + promoted to verified
    const verifyNodeRes = await fetch(`${BASE_URL}/api/knowledge/${nodeA1Id}/verify`, {
      method: "POST",
      headers: { Cookie: cookieHeaderA },
    });
    expect(verifyNodeRes.status).toBe(200);

    const recheckNode1 = await fetch(`${BASE_URL}/api/knowledge/${nodeA1Id}`, {
      headers: { Cookie: cookieHeaderA },
    });
    const recheck1Detail = await recheckNode1.json();
    expect(recheck1Detail.node.verificationStatus).toBe("verified");
    expect(recheck1Detail.node.confidence).toBe(1.0);
    expect(recheck1Detail.node.verifiedBy).toBe(userAId);

    // 5. User A creates Inferred Edge over HTTP POST /api/knowledge/edges
    const createEdgeRes = await fetch(`${BASE_URL}/api/knowledge/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({
        sourceNodeId: nodeA1Id,
        targetNodeId: nodeA2Id,
        relationType: "supports",
        sourceType: "ai_proposal",
        sourceId: actA.id,
        confidence: 0.85,
        provenanceNote: "LTP induction activates NMDA receptors causing structural spine growth",
      }),
    });
    expect(createEdgeRes.status).toBe(201);
    const createdEdge = await createEdgeRes.json();
    expect(createdEdge.id).toBeDefined();
    expect(createdEdge.verificationStatus).toBe("inferred");

    // 6. User A verifies Edge over HTTP POST /api/knowledge/edges/[id]/verify
    const verifyEdgeRes = await fetch(`${BASE_URL}/api/knowledge/edges/${createdEdge.id}/verify`, {
      method: "POST",
      headers: { Cookie: cookieHeaderA },
    });
    expect(verifyEdgeRes.status).toBe(200);

    // 7. User A queries Active Knowledge Graph over HTTP GET /api/knowledge
    const graphRes = await fetch(`${BASE_URL}/api/knowledge`, {
      headers: { Cookie: cookieHeaderA },
    });
    expect(graphRes.status).toBe(200);
    const graphData = await graphRes.json();
    expect(graphData.nodes.some((n: { id: string }) => n.id === nodeA1Id)).toBe(true);
    expect(graphData.nodes.some((n: { id: string }) => n.id === nodeA2Id)).toBe(true);
    expect(graphData.edges.some((e: { id: string }) => e.id === createdEdge.id)).toBe(true);

    // 8. User A archives Node 1 via HTTP PATCH /api/knowledge/[id]
    const patchRes = await fetch(`${BASE_URL}/api/knowledge/${nodeA1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderA },
      body: JSON.stringify({ isArchived: true }),
    });
    expect(patchRes.status).toBe(200);

    // 9. Active graph query hides archived node
    const activeGraphAfterArchive = await fetch(`${BASE_URL}/api/knowledge`, {
      headers: { Cookie: cookieHeaderA },
    });
    const activeData = await activeGraphAfterArchive.json();
    expect(activeData.nodes.some((n: { id: string }) => n.id === nodeA1Id)).toBe(false);

    // 10. Archived graph query retrieves archived node
    const archivedGraphRes = await fetch(`${BASE_URL}/api/knowledge?status=archived`, {
      headers: { Cookie: cookieHeaderA },
    });
    const archivedData = await archivedGraphRes.json();
    expect(archivedData.nodes.some((n: { id: string }) => n.id === nodeA1Id)).toBe(true);

    // 11. Cross-Tenant Security Attacks: User B attempts to access User A Knowledge facts -> 404 (non-disclosing)
    const bGetA = await fetch(`${BASE_URL}/api/knowledge/${nodeA1Id}`, {
      headers: { Cookie: cookieHeaderB },
    });
    expect(bGetA.status).toBe(404);

    const bPatchA = await fetch(`${BASE_URL}/api/knowledge/${nodeA1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderB },
      body: JSON.stringify({ title: "Hacked by User B" }),
    });
    expect(bPatchA.status).toBe(404);

    const bVerifyNodeA = await fetch(`${BASE_URL}/api/knowledge/${nodeA1Id}/verify`, {
      method: "POST",
      headers: { Cookie: cookieHeaderB },
    });
    expect(bVerifyNodeA.status).toBe(404);

    const bGetEdgeA = await fetch(`${BASE_URL}/api/knowledge/edges/${createdEdge.id}`, {
      headers: { Cookie: cookieHeaderB },
    });
    expect(bGetEdgeA.status).toBe(404);

    const bVerifyEdgeA = await fetch(`${BASE_URL}/api/knowledge/edges/${createdEdge.id}/verify`, {
      method: "POST",
      headers: { Cookie: cookieHeaderB },
    });
    expect(bVerifyEdgeA.status).toBe(404);

    // User B tries to create edge referencing User A node
    const bCreateEdgeWithANode = await fetch(`${BASE_URL}/api/knowledge/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeaderB },
      body: JSON.stringify({
        sourceNodeId: nodeA1Id,
        targetNodeId: nodeA2Id,
        relationType: "supports",
        sourceType: "user_created",
      }),
    });
    expect([400, 404]).toContain(bCreateEdgeWithANode.status);
  });
});

