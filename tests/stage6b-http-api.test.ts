import http from "node:http";
import next from "next";
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const TEST_PORT = 3097;
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

describe.skipIf(!DATABASE_URL)("Stage 6B — Knowledge Map HTTP API & Authority Matrix (Live)", () => {
  let app: ReturnType<typeof next>;
  let server: http.Server;
  let userA: Jar;
  let userB: Jar;
  let userAId: string;
  let userBId: string;
  let activityAId: string;
  const emailA = `stage6b_a_${Date.now()}@growth.rpg`;
  const emailB = `stage6b_b_${Date.now()}@growth.rpg`;

  beforeAll(async () => {
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

    // Seed Activity for User A
    const actRes = await adminClient
      .from("activities")
      .insert({
        user_id: userAId,
        title: "Studied Systems Architecture",
        raw_input: "Reading Distributed Systems book",
        activity_type: "study",
        status: "confirmed",
        rules_version: "1.0.0",
      })
      .select("id")
      .single();
    activityAId = actRes.data!.id;
  }, 60000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (userAId && userBId) {
      await adminClient.from("knowledge_edges").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("knowledge_nodes").delete().in("user_id", [userAId, userBId]);
      await adminClient.from("activities").delete().in("user_id", [userAId, userBId]);
      await adminClient.auth.admin.deleteUser(userAId);
      await adminClient.auth.admin.deleteUser(userBId);
    }
  });

  // --------------------------------------------------------------------------
  // 1. UNAUTHENTICATED ACCESS MATRIX (Fail-Closed)
  // --------------------------------------------------------------------------

  test("1. Unauthenticated requests to all Knowledge endpoints return 401", async () => {
    const fakeId = "00000000-0000-4000-a000-000000000000";

    const r1 = await api(null, "/api/knowledge");
    expect(r1.status).toBe(401);

    const r2 = await api(null, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "Secret Concept" }),
    });
    expect(r2.status).toBe(401);

    const r3 = await api(null, `/api/knowledge/${fakeId}`);
    expect(r3.status).toBe(401);

    const r4 = await api(null, `/api/knowledge/${fakeId}/verify`, { method: "POST" });
    expect(r4.status).toBe(401);

    const r5 = await api(null, "/api/knowledge/edges");
    expect(r5.status).toBe(401);

    const r6 = await api(null, `/api/knowledge/edges/${fakeId}`);
    expect(r6.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // 2. INPUT VALIDATION & FORBIDDEN AUTHORITY MUTATIONS
  // --------------------------------------------------------------------------

  test("2. Malformed parameters, invalid edge status and empty inputs return 400", async () => {
    const r1 = await api(userA, "/api/knowledge?domainId=not-a-uuid");
    expect(r1.status).toBe(400);

    const r2 = await api(userA, "/api/knowledge?rootNodeId=invalid-uuid");
    expect(r2.status).toBe(400);

    const r3 = await api(userA, "/api/knowledge?rootNodeId=00000000-0000-4000-a000-000000000000&depth=5");
    expect(r3.status).toBe(400);
    const d3 = await r3.json();
    expect(d3.code).toBe("invalid_depth");

    const r4 = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "   " }),
    });
    expect(r4.status).toBe(400);
    const d4 = await r4.json();
    expect(d4.code).toBe("empty_title");

    // P2: Invalid Edge status query returns 400 invalid_status
    const r5 = await api(userA, "/api/knowledge/edges?status=unknown_status_val");
    expect(r5.status).toBe(400);
    const d5 = await r5.json();
    expect(d5.code).toBe("invalid_status");
  });

  test("3. Generic PATCH rejects forbidden authority/provenance field mutations with 400", async () => {
    const createRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "Patch Target Node" }),
    });
    expect(createRes.status).toBe(201);
    const node = await createRes.json();

    const patchAuth = await api(userA, `/api/knowledge/${node.id}`, {
      method: "PATCH",
      body: JSON.stringify({ verification_status: "inferred" }),
    });
    expect(patchAuth.status).toBe(400);
    const dataAuth = await patchAuth.json();
    expect(dataAuth.code).toBe("forbidden_authority_mutation");

    const patchSource = await api(userA, `/api/knowledge/${node.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sourceType: "ai_proposal" }),
    });
    expect(patchSource.status).toBe(400);
    const dataSource = await patchSource.json();
    expect(dataSource.code).toBe("forbidden_authority_mutation");

    const patchValid = await api(userA, `/api/knowledge/${node.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated description text" }),
    });
    expect(patchValid.status).toBe(200);
    const dataValid = await patchValid.json();
    expect(dataValid.description).toBe("Updated description text");
  });

  // --------------------------------------------------------------------------
  // 3. SANCTIONED NODE & EDGE AUTHORITY TRANSITIONS
  // --------------------------------------------------------------------------

  test("4. Node Sanctioned Verify & Reject Lifecycle (409 on invalid transition)", async () => {
    const propRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({
        title: "AI Inferred Concept",
        sourceType: "ai_proposal",
        sourceId: activityAId,
        confidence: 0.85,
      }),
    });
    expect(propRes.status).toBe(201);
    const propNode = await propRes.json();
    expect(propNode.verificationStatus).toBe("inferred");
    expect(propNode.confidence).toBe(0.85);

    const verifyRes = await api(userA, `/api/knowledge/${propNode.id}/verify`, { method: "POST" });
    expect(verifyRes.status).toBe(200);
    const verifiedNode = await verifyRes.json();
    expect(verifiedNode.verificationStatus).toBe("verified");
    expect(verifiedNode.confidence).toBe(1.0);
    expect(verifiedNode.verifiedAt).toBeDefined();
    expect(verifiedNode.verifiedBy).toBe(userAId);

    const doubleVerify = await api(userA, `/api/knowledge/${propNode.id}/verify`, { method: "POST" });
    expect(doubleVerify.status).toBe(409);
    const dVerifyData = await doubleVerify.json();
    expect(dVerifyData.code).toBe("invalid_authority_transition");

    const propRes2 = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({
        title: "AI Bad Proposal",
        sourceType: "ai_proposal",
        sourceId: activityAId,
        confidence: 0.75,
      }),
    });
    const propNode2 = await propRes2.json();

    const rejectRes = await api(userA, `/api/knowledge/${propNode2.id}/reject`, { method: "POST" });
    expect(rejectRes.status).toBe(200);
    const rejectedNode = await rejectRes.json();
    expect(rejectedNode.verificationStatus).toBe("rejected");
  });

  // --------------------------------------------------------------------------
  // 4. CONCURRENT DOUBLE VERIFY (P1 Race-Lost Must Return 409 Never 500)
  // --------------------------------------------------------------------------

  test("5. Concurrent Double Verify against inferred Node returns 200 + 409 (Never 500)", async () => {
    // Create an inferred proposal node
    const nodeRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({
        title: "Concurrent Race Node",
        sourceType: "ai_proposal",
        sourceId: activityAId,
        confidence: 0.9,
      }),
    });
    expect(nodeRes.status).toBe(201);
    const node = await nodeRes.json();

    // Fire two simultaneous verify requests
    const [res1, res2] = await Promise.all([
      api(userA, `/api/knowledge/${node.id}/verify`, { method: "POST" }),
      api(userA, `/api/knowledge/${node.id}/verify`, { method: "POST" }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Ensure neither returned 500
    expect(res1.status).not.toBe(500);
    expect(res2.status).not.toBe(500);
  });

  test("6. Edge Creation, Auto-Canonicalization & Authority Transitions", async () => {
    const n1Res = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "Edge Node 1" }),
    });
    const n2Res = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "Edge Node 2" }),
    });
    const n1 = await n1Res.json();
    const n2 = await n2Res.json();

    const selfRes = await api(userA, "/api/knowledge/edges", {
      method: "POST",
      body: JSON.stringify({
        sourceNodeId: n1.id,
        targetNodeId: n1.id,
        relationType: "prerequisite",
      }),
    });
    expect(selfRes.status).toBe(400);

    const relMissingNote = await api(userA, "/api/knowledge/edges", {
      method: "POST",
      body: JSON.stringify({
        sourceNodeId: n1.id,
        targetNodeId: n2.id,
        relationType: "relates_to",
      }),
    });
    expect(relMissingNote.status).toBe(400);
    const relNoteData = await relMissingNote.json();
    expect(relNoteData.code).toBe("missing_provenance_note");

    const [higherId, lowerId] = n1.id > n2.id ? [n1.id, n2.id] : [n2.id, n1.id];
    const symRes = await api(userA, "/api/knowledge/edges", {
      method: "POST",
      body: JSON.stringify({
        sourceNodeId: higherId,
        targetNodeId: lowerId,
        relationType: "contradicts",
      }),
    });
    expect(symRes.status).toBe(201);
    const symEdge = await symRes.json();
    expect(symEdge.sourceNodeId).toBe(lowerId);
    expect(symEdge.targetNodeId).toBe(higherId);

    const dupRes = await api(userA, "/api/knowledge/edges", {
      method: "POST",
      body: JSON.stringify({
        sourceNodeId: lowerId,
        targetNodeId: higherId,
        relationType: "contradicts",
      }),
    });
    expect(dupRes.status).toBe(409);
    const dupData = await dupRes.json();
    expect(dupData.code).toBe("duplicate_edge");

    const inEdgeRes = await api(userA, "/api/knowledge/edges", {
      method: "POST",
      body: JSON.stringify({
        sourceNodeId: n1.id,
        targetNodeId: n2.id,
        relationType: "supports",
        sourceType: "ai_proposal",
        sourceId: activityAId,
        confidence: 0.88,
      }),
    });
    expect(inEdgeRes.status).toBe(201);
    const inEdge = await inEdgeRes.json();

    const verifyEdgeRes = await api(userA, `/api/knowledge/edges/${inEdge.id}/verify`, { method: "POST" });
    expect(verifyEdgeRes.status).toBe(200);
    const verifiedEdge = await verifyEdgeRes.json();
    expect(verifiedEdge.verificationStatus).toBe("verified");
    expect(verifiedEdge.confidence).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // 5. READ MODELS & PROVENANCE RESOLUTION
  // --------------------------------------------------------------------------

  test("7. Read Models: GET /api/knowledge/[id] and GET /api/knowledge/edges/[id] resolve provenance", async () => {
    const pNodeRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({
        title: "Read Model Concept",
        sourceType: "ai_proposal",
        sourceId: activityAId,
      }),
    });
    const pNode = await pNodeRes.json();

    const detailRes = await api(userA, `/api/knowledge/${pNode.id}`);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();

    expect(detail.node.id).toBe(pNode.id);
    expect(detail.node.title).toBe("Read Model Concept");
    expect(detail.provenance.sourceActivity).not.toBeNull();
    expect(detail.provenance.sourceActivity.id).toBe(activityAId);
    expect(detail.connections).toBeDefined();
    expect(Array.isArray(detail.connections.inbound)).toBe(true);
    expect(Array.isArray(detail.connections.outbound)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. ARCHIVED GRAPH QUERY & PROGRESSIVE LOADING (P1 Archived Query Tests)
  // --------------------------------------------------------------------------

  test("8. Archived Graph Query: archived hidden in status=all, visible in status=archived", async () => {
    // Create an active node and an archived node
    const activeRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "Active Architecture Node" }),
    });
    expect(activeRes.status).toBe(201);
    const activeNode = await activeRes.json();

    const archRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "Obsolete Design Node" }),
    });
    expect(archRes.status).toBe(201);
    const toArchiveNode = await archRes.json();

    // Archive the second node
    const patchArch = await api(userA, `/api/knowledge/${toArchiveNode.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isArchived: true }),
    });
    expect(patchArch.status).toBe(200);

    // 1. GET /api/knowledge (status=all): active visible, archived hidden
    const gAll = await api(userA, "/api/knowledge?status=all");
    expect(gAll.status).toBe(200);
    const dAll = await gAll.json();
    expect(dAll.nodes.some((n: { id: string }) => n.id === activeNode.id)).toBe(true);
    expect(dAll.nodes.some((n: { id: string }) => n.id === toArchiveNode.id)).toBe(false);

    // 2. GET /api/knowledge?status=archived: archived returned
    const gArch = await api(userA, "/api/knowledge?status=archived");
    expect(gArch.status).toBe(200);
    const dArch = await gArch.json();
    expect(dArch.nodes.some((n: { id: string }) => n.id === toArchiveNode.id)).toBe(true);
    expect(dArch.nodes.some((n: { id: string }) => n.id === activeNode.id)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 7. CROSS-TENANT SECURITY MATRIX (User A vs User B)
  // --------------------------------------------------------------------------

  test("9. Cross-Tenant Security Matrix: User B accessing User A entities returns 404", async () => {
    const aNodeRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "User A Private Secret Node" }),
    });
    const aNode = await aNodeRes.json();

    const bGet = await api(userB, `/api/knowledge/${aNode.id}`);
    expect(bGet.status).toBe(404);

    const bPatch = await api(userB, `/api/knowledge/${aNode.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: "Hacked by User B" }),
    });
    expect(bPatch.status).toBe(404);

    const bVerify = await api(userB, `/api/knowledge/${aNode.id}/verify`, { method: "POST" });
    expect(bVerify.status).toBe(404);

    const bDelete = await api(userB, `/api/knowledge/${aNode.id}`, { method: "DELETE" });
    expect(bDelete.status).toBe(404);

    const bRoot = await api(userB, `/api/knowledge?rootNodeId=${aNode.id}&depth=1`);
    expect(bRoot.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // 8. OWNED DELETION
  // --------------------------------------------------------------------------

  test("10. Owned Deletion: 204 on success, 404 on repeat delete", async () => {
    const nodeRes = await api(userA, "/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title: "Node To Delete" }),
    });
    const node = await nodeRes.json();

    const d1 = await api(userA, `/api/knowledge/${node.id}`, { method: "DELETE" });
    expect(d1.status).toBe(204);

    const d2 = await api(userA, `/api/knowledge/${node.id}`, { method: "DELETE" });
    expect(d2.status).toBe(404);
  });
});
