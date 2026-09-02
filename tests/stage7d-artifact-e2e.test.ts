// tests/stage7d-artifact-e2e.test.ts
// Stage 7D: Artifact E2E Complete Product Lifecycle & Settlement Integration Test Suite

import http from "node:http";
import next from "next";
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CreateArtifactInput,
  UpdateArtifactInput,
  ManageArtifactLinksInput,
  ArtifactResolutionInput,
} from "@/types/artifact";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const TEST_PORT = 3096;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

describe.skipIf(!DATABASE_URL)("Stage 7D — Full Product E2E: Artifact Lifecycle & Settlement Integration", () => {
  let app: ReturnType<typeof next>;
  let server: http.Server;
  let pg: Client;
  let adminClient: SupabaseClient<Database>;

  let userAId: string;
  let userBId: string;
  const userAEmail = `stage7d_e2e_a_${Date.now()}@growth.rpg`;
  const userBEmail = `stage7d_e2e_b_${Date.now()}@growth.rpg`;
  const testPassword = "Password123!Safe";

  let jarA: ReturnType<typeof createCookieJar>;
  let jarB: ReturnType<typeof createCookieJar>;

  let userASkillId: string;
  let userAKnowledgeId: string;
  let userAQuestId: string;

  beforeAll(async () => {
    if (!SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SECRET_KEY) {
      throw new Error("Missing required Supabase keys (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY)");
    }

    adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY);
    jarA = createCookieJar();
    jarB = createCookieJar();

    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

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

    // Provision User A
    const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (errA || !authA.user) throw new Error(`User A create failed: ${errA?.message}`);
    userAId = authA.user.id;

    // Provision User B
    const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (errB || !authB.user) throw new Error(`User B create failed: ${errB?.message}`);
    userBId = authB.user.id;

    // Sign in User A
    const { data: sessA, error: sErrA } = await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });
    if (sErrA || !sessA.session) throw new Error(`User A login failed: ${sErrA?.message}`);

    // Sign in User B
    const { data: sessB, error: sErrB } = await jarB.client.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    });
    if (sErrB || !sessB.session) throw new Error(`User B login failed: ${sErrB?.message}`);

    // Seed domain fixtures for User A with required 'slug' column
    const domRes = await pg.query(
      `insert into public.domains (user_id, name, slug) values ($1, 'Software Engineering', 'software-engineering') returning id`,
      [userAId]
    );
    const domainId = domRes.rows[0].id;

    const skillRes = await pg.query(
      `insert into public.skills (user_id, domain_id, name, level) values ($1, $2, 'TypeScript Architecture', 4) returning id`,
      [userAId, domainId]
    );
    userASkillId = skillRes.rows[0].id;

    const knRes = await pg.query(
      `insert into public.knowledge_nodes (user_id, domain_id, title, node_type, verification_status, confidence, verified_at, verified_by, source_type) values ($1, $2, 'Next.js App Router State', 'concept', 'verified', 1.0, now(), $1, 'user_created') returning id`,
      [userAId, domainId]
    );
    userAKnowledgeId = knRes.rows[0].id;

    const questRes = await pg.query(
      `insert into public.quests (user_id, title, quest_type) values ($1, 'Deliver Stage 7D Freeze', 'production') returning id`,
      [userAId]
    );
    userAQuestId = questRes.rows[0].id;
  }, 45000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (app) await app.close();
    if (pg) {
      if (userAId) await pg.query(`delete from auth.users where id = $1`, [userAId]);
      if (userBId) await pg.query(`delete from auth.users where id = $1`, [userBId]);
      await pg.end();
    }
  });

  // ==========================================
  // Scenario A — Manual Artifact Lifecycle
  // ==========================================
  describe("Scenario A — Manual Artifact Lifecycle", () => {
    let manualArtifactId: string;

    test("1. Create new draft artifact via POST /api/artifacts", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "Manual Test Artifact RFC",
          artifactType: "design_spec",
          summary: "Initial manual draft",
          description: "## Architecture Notes\nDetailed notes here.",
          lifecycleStatus: "draft",
          version: "0.1",
          reusabilityScore: 0.8,
        } as CreateArtifactInput),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.artifact.title).toBe("Manual Test Artifact RFC");
      expect(data.artifact.lifecycleStatus).toBe("draft");
      manualArtifactId = data.artifact.id;
    });

    test("2. View inspector detail via GET /api/artifacts/[id]", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(res.status).toBe(200);
      const detail = await res.json();
      expect(detail.artifact.id).toBe(manualArtifactId);
      expect(detail.links.skills.length).toBe(0);
    });

    test("3. Edit artifact metadata & version via PATCH /api/artifacts/[id]", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          version: "1.0",
          lifecycleStatus: "active",
          isArchived: false,
          summary: "Promoted to active RFC",
        } as UpdateArtifactInput),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.artifact.version).toBe("1.0");
      expect(data.artifact.lifecycleStatus).toBe("active");
    });

    test("4. Link Skill, Knowledge Node, and Quest via POST /api/artifacts/[id]/links", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          skills: [{ skillId: userASkillId, action: "attach", demonstrationLevel: 5 }],
          knowledgeNodes: [{ nodeId: userAKnowledgeId, action: "attach", relationType: "implements" }],
          quests: [{ questId: userAQuestId, action: "attach", isPrimaryDeliverable: true }],
        } as ManageArtifactLinksInput),
      });
      expect(res.status).toBe(200);

      // Verify inspector shows 3 links
      const getRes = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      const detail = await getRes.json();
      expect(detail.links.skills.length).toBe(1);
      expect(detail.links.knowledgeNodes.length).toBe(1);
      expect(detail.links.quests.length).toBe(1);
    });

    test("5. Archive and Restore Artifact", async () => {
      // Archive
      const archRes = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          lifecycleStatus: "archived",
          isArchived: true,
        }),
      });
      expect(archRes.status).toBe(200);
      expect((await archRes.json()).artifact.isArchived).toBe(true);

      // Restore
      const restRes = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          lifecycleStatus: "active",
          isArchived: false,
        }),
      });
      expect(restRes.status).toBe(200);
      expect((await restRes.json()).artifact.isArchived).toBe(false);
    });

    test("6. Physical Delete unreferenced artifact via DELETE /api/artifacts/[id]", async () => {
      const delRes = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}`, {
        method: "DELETE",
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(delRes.status).toBe(204);

      // Verify no longer found
      const getRes = await fetch(`${BASE_URL}/api/artifacts/${manualArtifactId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(getRes.status).toBe(404);
    });
  });

  // ==========================================
  // Scenario B — Assessment Creates Artifact
  // ==========================================
  describe("Scenario B — Assessment Creates Artifact", () => {
    let actId: string;
    let assessId: string;
    let createdArtTitle: string;

    test("Creates activity, pending assessment with artifact proposal, and settles with resolution=create", async () => {
      createdArtTitle = "Assessment Generated Spec " + Date.now();

      const actRes = await pg.query(
        `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes)
         values ($1, 'Refactor Core Engine', 'Refactor Core Engine', 'study', 'pending_assessment', '1.0.0', 45, 40) returning id`,
        [userAId]
      );
      actId = actRes.rows[0].id;

      const assessRes = await pg.query(
        `insert into public.ai_assessments (
           user_id, activity_id, status, confidence, model_name, prompt_version, rules_version, proposal
         ) values ($1, $2, 'pending', 0.95, 'deepseek-v4-flash', '1.0', '1.0', $3) returning id`,
        [
          userAId,
          actId,
          JSON.stringify({
            activity: { type: "learning", completion: 1.0 },
            difficulty: { complexity: 0.6, uncertainty: 0.3, expertise_gap: 0.4, resistance: 0.2 },
            growth: { effort: 0.8, learning: 0.9, performance: 0.7, outcome: 0.8, artifact_value: 0.9, character_evidence: 0.5 },
            evidence: { level: 4, explanation: "Generated system specification" },
            affected_skills: [{ name: "TypeScript Architecture", reason: "Direct work" }],
            knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
            mastery_changes: [],
            xp_semantics: {
              base_value: 80,
              difficulty: 0.8,
              mastery_gain: 0.5,
              novelty: 0.7,
              goal_alignment: 0.9,
              repetition_risk: "low",
            },
            artifacts: [],
            next_quest: null,
            confidence: 0.95,
            uncertainty_notes: [],
            artifactProposals: [
              {
                title: createdArtTitle,
                artifactType: "design_spec",
                summary: "Automated engine specification",
                reusabilityScore: 0.92,
              },
            ],
          }),
        ]
      );
      assessId = assessRes.rows[0].id;

      // Confirm with resolution=create
      const confirmRes = await fetch(`${BASE_URL}/api/assessments/${assessId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "create",
            },
          ] as ArtifactResolutionInput[],
        }),
      });
      expect(confirmRes.status).toBe(200);

      // Verify artifact created and listed
      const listRes = await fetch(`${BASE_URL}/api/artifacts?status=all&search=${encodeURIComponent(createdArtTitle)}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.artifacts.length).toBe(1);
      expect(listData.artifacts[0].title).toBe(createdArtTitle);
    });
  });

  // ==========================================
  // Scenario C — Assessment Links Existing Artifact
  // ==========================================
  describe("Scenario C — Assessment Links Existing Artifact", () => {
    let existingArtifactId: string;

    beforeAll(async () => {
      const artRes = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "Pre-existing Master Plan " + Date.now(),
          artifactType: "document",
        } as CreateArtifactInput),
      });
      existingArtifactId = (await artRes.json()).artifact.id;
    });

    test("Settlement with resolution=existing connects existing artifact with activityRole=modified", async () => {
      const actRes = await pg.query(
        `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes)
         values ($1, 'Iterate on Master Plan', 'Iterate on Master Plan', 'study', 'pending_assessment', '1.0.0', 45, 40) returning id`,
        [userAId]
      );
      const actId = actRes.rows[0].id;

      const assessRes = await pg.query(
        `insert into public.ai_assessments (
           user_id, activity_id, status, confidence, model_name, prompt_version, rules_version, proposal
         ) values ($1, $2, 'pending', 0.95, 'deepseek-v4-flash', '1.0', '1.0', $3) returning id`,
        [
          userAId,
          actId,
          JSON.stringify({
            activity: { type: "learning", completion: 1.0 },
            difficulty: { complexity: 0.5, uncertainty: 0.2, expertise_gap: 0.3, resistance: 0.1 },
            growth: { effort: 0.7, learning: 0.7, performance: 0.6, outcome: 0.7, artifact_value: 0.7, character_evidence: 0.5 },
            evidence: { level: 3, explanation: "Iterated plan" },
            affected_skills: [{ name: "TypeScript Architecture", reason: "Direct work" }],
            knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
            mastery_changes: [],
            xp_semantics: {
              base_value: 50,
              difficulty: 0.8,
              mastery_gain: 0.5,
              novelty: 0.7,
              goal_alignment: 0.9,
              repetition_risk: "low",
            },
            artifacts: [],
            next_quest: null,
            confidence: 0.95,
            uncertainty_notes: [],
            artifactProposals: [
              {
                title: "Suggested Plan Update",
                artifactType: "document",
                reusabilityScore: 0.8,
              },
            ],
          }),
        ]
      );
      const assessId = assessRes.rows[0].id;

      // Confirm linking existing artifact
      const confirmRes = await fetch(`${BASE_URL}/api/assessments/${assessId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "existing",
              artifactId: existingArtifactId,
              activityRole: "modified",
            },
          ] as ArtifactResolutionInput[],
        }),
      });
      expect(confirmRes.status).toBe(200);

      // Verify artifact detail now contains activity link
      const getRes = await fetch(`${BASE_URL}/api/artifacts/${existingArtifactId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      const detail = await getRes.json();
      expect(detail.links.activities.length).toBe(1);
      expect(detail.links.activities[0].activityRole).toBe("modified");
    });
  });

  // ==========================================
  // Scenario D — Ignore Artifact Proposal
  // ==========================================
  describe("Scenario D — Ignore Artifact Proposal", () => {
    test("Settlement with resolution=ignore succeeds without creating unwanted artifacts", async () => {
      const actRes = await pg.query(
        `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes)
         values ($1, 'Quick Exploration', 'Quick Exploration', 'study', 'pending_assessment', '1.0.0', 30, 25) returning id`,
        [userAId]
      );
      const actId = actRes.rows[0].id;

      const assessRes = await pg.query(
        `insert into public.ai_assessments (
           user_id, activity_id, status, confidence, model_name, prompt_version, rules_version, proposal
         ) values ($1, $2, 'pending', 0.95, 'deepseek-v4-flash', '1.0', '1.0', $3) returning id`,
        [
          userAId,
          actId,
          JSON.stringify({
            activity: { type: "learning", completion: 1.0 },
            difficulty: { complexity: 0.3, uncertainty: 0.1, expertise_gap: 0.2, resistance: 0.1 },
            growth: { effort: 0.5, learning: 0.5, performance: 0.5, outcome: 0.5, artifact_value: 0.5, character_evidence: 0.5 },
            evidence: { level: 2, explanation: "Quick scratch" },
            affected_skills: [{ name: "TypeScript Architecture", reason: "Direct work" }],
            knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
            mastery_changes: [],
            xp_semantics: {
              base_value: 30,
              difficulty: 0.5,
              mastery_gain: 0.3,
              novelty: 0.5,
              goal_alignment: 0.8,
              repetition_risk: "low",
            },
            artifacts: [],
            next_quest: null,
            confidence: 0.95,
            uncertainty_notes: [],
            artifactProposals: [
              {
                title: "Scratch Code Not To Keep",
                artifactType: "code_repository",
                reusabilityScore: 0.4,
              },
            ],
          }),
        ]
      );
      const assessId = assessRes.rows[0].id;

      const beforeCount = (
        await pg.query(`select count(*) from public.artifacts where user_id = $1`, [userAId])
      ).rows[0].count;

      const confirmRes = await fetch(`${BASE_URL}/api/assessments/${assessId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "ignore",
            },
          ] as ArtifactResolutionInput[],
        }),
      });
      expect(confirmRes.status).toBe(200);

      const afterCount = (
        await pg.query(`select count(*) from public.artifacts where user_id = $1`, [userAId])
      ).rows[0].count;
      // Exact same artifact count
      expect(afterCount).toBe(beforeCount);
    });
  });

  // ==========================================
  // Scenario E — Cross-User Attack
  // ==========================================
  describe("Scenario E — Cross-User Attack", () => {
    test("User B cannot link User A's artifact in an assessment settlement -> 400 Bad Request", async () => {
      // User A creates an artifact
      const artResA = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "User A Sensitive Secret " + Date.now(),
          artifactType: "document",
        } as CreateArtifactInput),
      });
      const artAId = (await artResA.json()).artifact.id;

      // User B creates an activity & assessment
      const actResB = await pg.query(
        `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes)
         values ($1, 'User B Activity', 'User B Activity', 'study', 'pending_assessment', '1.0.0', 45, 40) returning id`,
        [userBId]
      );
      const actBId = actResB.rows[0].id;

      const assessResB = await pg.query(
        `insert into public.ai_assessments (
           user_id, activity_id, status, confidence, model_name, prompt_version, rules_version, proposal
         ) values ($1, $2, 'pending', 0.95, 'deepseek-v4-flash', '1.0', '1.0', $3) returning id`,
        [
          userBId,
          actBId,
          JSON.stringify({
            activity: { type: "learning", completion: 1.0 },
            difficulty: { complexity: 0.5, uncertainty: 0.2, expertise_gap: 0.3, resistance: 0.1 },
            growth: { effort: 0.6, learning: 0.6, performance: 0.6, outcome: 0.6, artifact_value: 0.6, character_evidence: 0.5 },
            evidence: { level: 2, explanation: "Attempting cross-tenant hijack" },
            affected_skills: [{ name: "TypeScript Architecture", reason: "Direct work" }],
            knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
            mastery_changes: [],
            xp_semantics: {
              base_value: 40,
              difficulty: 0.6,
              mastery_gain: 0.4,
              novelty: 0.6,
              goal_alignment: 0.8,
              repetition_risk: "low",
            },
            artifacts: [],
            next_quest: null,
            confidence: 0.95,
            uncertainty_notes: [],
            artifactProposals: [
              {
                title: "Hijack Target",
                artifactType: "document",
                reusabilityScore: 0.8,
              },
            ],
          }),
        ]
      );
      const assessBId = assessResB.rows[0].id;

      // User B attempts to resolve proposal with User A's artifact ID
      const confirmRes = await fetch(`${BASE_URL}/api/assessments/${assessBId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarB.getCookieHeader(),
        },
        body: JSON.stringify({
          artifactResolutions: [
            {
              proposalIndex: 0,
              resolution: "existing",
              artifactId: artAId,
            },
          ] as ArtifactResolutionInput[],
        }),
      });

      expect(confirmRes.status).toBe(400);
      const data = await confirmRes.json();
      expect(data.error).toContain("该造物不存在或当前账户无权访问");

      // Verify User A artifact has 0 activities linked
      const getResA = await fetch(`${BASE_URL}/api/artifacts/${artAId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      const detailA = await getResA.json();
      expect(detailA.links.activities.length).toBe(0);
    });
  });
});
