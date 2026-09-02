// tests/stage7d-artifact-security.test.ts
// Stage 7D: Artifact Final Security, Cross-Tenant Isolation, Atomicity, Idempotency & Concurrency Audit

import http from "node:http";
import next from "next";
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ArtifactResolutionInput,
  CreateArtifactInput,
  ManageArtifactLinksInput,
} from "@/types/artifact";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const TEST_PORT = 3097;
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

describe.skipIf(!DATABASE_URL)("Stage 7D — Artifact Final Security, Cross-Tenant Isolation, Atomicity & Concurrency Audit", () => {
  let app: ReturnType<typeof next>;
  let server: http.Server;
  let pg: Client;
  let adminClient: SupabaseClient<Database>;

  let userAId: string;
  let userBId: string;
  const userAEmail = `stage7d_sec_a_${Date.now()}@growth.rpg`;
  const userBEmail = `stage7d_sec_b_${Date.now()}@growth.rpg`;
  const testPassword = "Password123!Safe";

  let jarA: ReturnType<typeof createCookieJar>;
  let jarB: ReturnType<typeof createCookieJar>;

  // Test Fixture IDs
  let userASkillId: string;
  let userBSkillId: string;
  let userAQuestId: string;
  let userBQuestId: string;
  let userAKnowledgeId: string;
  let userAActivityId: string;
  let userBActivityId: string;
  let userAEvidenceId: string;
  let userBEvidenceId: string;

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

    // Seed domain fixtures for User A with slug
    const domResA = await pg.query(
      `insert into public.domains (user_id, name, slug) values ($1, 'AI Security', 'ai-security') returning id`,
      [userAId]
    );
    const domainAId = domResA.rows[0].id;

    const skillResA = await pg.query(
      `insert into public.skills (user_id, domain_id, name, level) values ($1, $2, 'Cryptography', 3) returning id`,
      [userAId, domainAId]
    );
    userASkillId = skillResA.rows[0].id;

    const questResA = await pg.query(
      `insert into public.quests (user_id, title, quest_type) values ($1, 'Security Audit Protocol', 'production') returning id`,
      [userAId]
    );
    userAQuestId = questResA.rows[0].id;

    const knResA = await pg.query(
      `insert into public.knowledge_nodes (user_id, domain_id, title, node_type, verification_status, confidence, verified_at, verified_by, source_type) values ($1, $2, 'Zero Trust Architecture', 'concept', 'verified', 1.0, now(), $1, 'user_created') returning id`,
      [userAId, domainAId]
    );
    userAKnowledgeId = knResA.rows[0].id;

    const actResA = await pg.query(
      `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes) values ($1, 'Audit Auth Boundary', 'Audit Auth Boundary', 'study', 'pending_assessment', '1.0.0', 45, 40) returning id`,
      [userAId]
    );
    userAActivityId = actResA.rows[0].id;

    const evResA = await pg.query(
      `insert into public.evidence_records (user_id, activity_id, skill_id, evidence_level, evidence_type, description, verified) values ($1, $2, $3, 4, 'work_product', 'Full security audit transcript', true) returning id`,
      [userAId, userAActivityId, userASkillId]
    );
    userAEvidenceId = evResA.rows[0].id;

    // Seed domain fixtures for User B with slug
    const domResB = await pg.query(
      `insert into public.domains (user_id, name, slug) values ($1, 'Bioinformatics', 'bioinformatics') returning id`,
      [userBId]
    );
    const domainBId = domResB.rows[0].id;

    const skillResB = await pg.query(
      `insert into public.skills (user_id, domain_id, name, level) values ($1, $2, 'Genomics', 2) returning id`,
      [userBId, domainBId]
    );
    userBSkillId = skillResB.rows[0].id;

    const questResB = await pg.query(
      `insert into public.quests (user_id, title, quest_type) values ($1, 'Genome Sequencing Quest', 'production') returning id`,
      [userBId]
    );
    userBQuestId = questResB.rows[0].id;

    const actResB = await pg.query(
      `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes) values ($1, 'Sequence Alignment', 'Sequence Alignment', 'study', 'pending_assessment', '1.0.0', 60, 55) returning id`,
      [userBId]
    );
    userBActivityId = actResB.rows[0].id;

    const evResB = await pg.query(
      `insert into public.evidence_records (user_id, activity_id, skill_id, evidence_level, evidence_type, description, verified) values ($1, $2, $3, 3, 'work_product', 'Mass Spec Transcript', true) returning id`,
      [userBId, userBActivityId, userBSkillId]
    );
    userBEvidenceId = evResB.rows[0].id;
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
  // 1. Cross-Tenant Isolation & Non-Disclosing 404
  // ==========================================
  describe("1. Cross-Tenant Isolation & Non-Disclosure", () => {
    let userAArtifactId: string;

    beforeAll(async () => {
      // User A creates an artifact
      const res = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "User A Confidential RFC",
          artifactType: "design_spec",
          summary: "Internal confidential design document",
          reusabilityScore: 0.95,
        } as CreateArtifactInput),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      userAArtifactId = data.artifact.id;
    });

    test("User B cannot GET User A artifact -> returns non-disclosing 404", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${userAArtifactId}`, {
        headers: { Cookie: jarB.getCookieHeader() },
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("造物不存在或已被移除");
    });

    test("User B cannot PATCH User A artifact -> returns non-disclosing 404", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${userAArtifactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarB.getCookieHeader(),
        },
        body: JSON.stringify({ title: "Hacked by User B" }),
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("造物不存在或已被移除");
    });

    test("User B cannot DELETE User A artifact -> returns non-disclosing 404", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${userAArtifactId}`, {
        method: "DELETE",
        headers: { Cookie: jarB.getCookieHeader() },
      });
      expect(res.status).toBe(404);
    });

    test("User B cannot link to User A artifact -> returns non-disclosing 404", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${userAArtifactId}/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarB.getCookieHeader(),
        },
        body: JSON.stringify({
          skills: [{ skillId: userBSkillId, action: "attach", demonstrationLevel: 3 }],
        } as ManageArtifactLinksInput),
      });
      expect(res.status).toBe(404);
    });

    test("User B listing /api/artifacts never enumerates User A artifacts", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts?status=all`, {
        headers: { Cookie: jarB.getCookieHeader() },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const ids = (data.artifacts || []).map((a: { id: string }) => a.id);
      expect(ids).not.toContain(userAArtifactId);
    });

    test("User B search /api/artifacts?search=Confidential never returns User A artifact", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts?status=all&search=Confidential`, {
        headers: { Cookie: jarB.getCookieHeader() },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.artifacts.length).toBe(0);
    });

    test("User B cannot enumerate or infer User A artifacts using skillId or questId filters", async () => {
      // Filter with User A's skillId
      const skillRes = await fetch(`${BASE_URL}/api/artifacts?status=all&skillId=${userASkillId}`, {
        headers: { Cookie: jarB.getCookieHeader() },
      });
      expect(skillRes.status).toBe(200);
      const skillData = await skillRes.json();
      expect(skillData.artifacts.length).toBe(0);

      // Filter with User A's questId
      const questRes = await fetch(`${BASE_URL}/api/artifacts?status=all&questId=${userAQuestId}`, {
        headers: { Cookie: jarB.getCookieHeader() },
      });
      expect(questRes.status).toBe(200);
      const questData = await questRes.json();
      expect(questData.artifacts.length).toBe(0);

      // User A filters with User B's questId -> returns 0 items
      const questResA = await fetch(`${BASE_URL}/api/artifacts?status=all&questId=${userBQuestId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(questResA.status).toBe(200);
      const questDataA = await questResA.json();
      expect(questDataA.artifacts.length).toBe(0);
    });

    test("Unauthenticated request to /api/artifacts returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts`);
      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // 2. Artifact CRUD Authority & Constraints
  // ==========================================
  describe("2. Artifact CRUD Authority & Constraints", () => {
    test("Rejects creation with duplicate normalized title for same tenant -> 409 conflict", async () => {
      const title = "Unique Architecture RFC " + Date.now();
      const res1 = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title,
          artifactType: "document",
        } as CreateArtifactInput),
      });
      expect(res1.status).toBe(201);

      // Attempt second creation with duplicate normalized title (ignoring whitespace and case)
      const res2 = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "  " + title.toUpperCase() + "  ",
          artifactType: "document",
        } as CreateArtifactInput),
      });
      expect(res2.status).toBe(409);
      const data = await res2.json();
      expect(data.error).toContain("已存在同名造物标题");
    });

    test("Rejects malformed UUID in GET /api/artifacts/[id] -> 400 bad request", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/not-a-valid-uuid`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("造物 ID 格式无效");
    });

    test("Rejects invalid lifecycle state transition via PATCH", async () => {
      const res1 = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "Lifecycle Test Artifact " + Date.now(),
          artifactType: "document",
          lifecycleStatus: "draft",
        } as CreateArtifactInput),
      });
      expect(res1.status).toBe(201);
      const art = (await res1.json()).artifact;

      // Invalid transition: try to set lifecycleStatus to 'archived' without setting isArchived=true
      const res2 = await fetch(`${BASE_URL}/api/artifacts/${art.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          lifecycleStatus: "archived",
          isArchived: false,
        }),
      });
      expect(res2.status).toBe(400);
    });
  });

  // ==========================================
  // 3. Relationship Authority & True Cross-Category Batch Atomicity
  // ==========================================
  describe("3. Relationship Authority & True Cross-Category Batch Atomicity", () => {
    let testArtifactId: string;

    beforeAll(async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "Cross Category Atomicity Artifact " + Date.now(),
          artifactType: "code_repository",
        } as CreateArtifactInput),
      });
      expect(res.status).toBe(201);
      testArtifactId = (await res.json()).artifact.id;
    });

    test("Exact cross-category atomicity failure: valid skill + valid knowledge + valid quest + foreign evidence -> ZERO partial write", async () => {
      // User A submits batch with valid skill, valid knowledge, valid quest, but foreign User B evidence
      const res = await fetch(`${BASE_URL}/api/artifacts/${testArtifactId}/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          skills: [{ skillId: userASkillId, action: "attach", demonstrationLevel: 4 }],
          knowledgeNodes: [{ nodeId: userAKnowledgeId, action: "attach", relationType: "implements" }],
          quests: [{ questId: userAQuestId, action: "attach", isPrimaryDeliverable: true }],
          evidence: [{ evidenceId: userBEvidenceId, action: "attach" }], // Foreign User B Evidence!
        } as ManageArtifactLinksInput),
      });
      expect(res.status).toBe(400);

      // Verify ZERO partial writes across ALL relation tables
      const getRes = await fetch(`${BASE_URL}/api/artifacts/${testArtifactId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(getRes.status).toBe(200);
      const detail = await getRes.json();
      expect(detail.links.skills.length).toBe(0);
      expect(detail.links.knowledgeNodes.length).toBe(0);
      expect(detail.links.quests.length).toBe(0);
      expect(detail.links.evidence.length).toBe(0);
      expect(detail.links.activities.length).toBe(0);

      // Also directly query DB to guarantee zero writes
      const skillCount = await pg.query(`select count(*) from public.artifact_skills where artifact_id = $1`, [testArtifactId]);
      const knCount = await pg.query(`select count(*) from public.artifact_knowledge_nodes where artifact_id = $1`, [testArtifactId]);
      const questCount = await pg.query(`select count(*) from public.artifact_quests where artifact_id = $1`, [testArtifactId]);
      expect(parseInt(skillCount.rows[0].count)).toBe(0);
      expect(parseInt(knCount.rows[0].count)).toBe(0);
      expect(parseInt(questCount.rows[0].count)).toBe(0);
    });

    test("Successfully applies multi-category batch link operations atomically", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${testArtifactId}/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          skills: [{ skillId: userASkillId, action: "attach", demonstrationLevel: 5 }],
          knowledgeNodes: [{ nodeId: userAKnowledgeId, action: "attach", relationType: "implements" }],
          quests: [{ questId: userAQuestId, action: "attach", isPrimaryDeliverable: true }],
          activities: [{ activityId: userAActivityId, action: "attach", activityRole: "produced" }],
          evidence: [{ evidenceId: userAEvidenceId, action: "attach" }],
        } as ManageArtifactLinksInput),
      });
      expect(res.status).toBe(200);

      // Verify all 5 categories attached
      const getRes = await fetch(`${BASE_URL}/api/artifacts/${testArtifactId}`, {
        headers: { Cookie: jarA.getCookieHeader() },
      });
      const detail = await getRes.json();
      expect(detail.links.skills.length).toBe(1);
      expect(detail.links.skills[0].demonstrationLevel).toBe(5);
      expect(detail.links.knowledgeNodes.length).toBe(1);
      expect(detail.links.knowledgeNodes[0].relationType).toBe("implements");
      expect(detail.links.quests.length).toBe(1);
      expect(detail.links.quests[0].isPrimaryDeliverable).toBe(true);
      expect(detail.links.activities.length).toBe(1);
      expect(detail.links.evidence.length).toBe(1);
    });
  });

  // ==========================================
  // 4. Provenance / Evidence Deletion Protection (Fail-Closed)
  // ==========================================
  describe("4. Provenance & Evidence Deletion Protection", () => {
    let protectedArtifactId: string;

    beforeAll(async () => {
      // Create an artifact and link evidence
      const res = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "Protected Provenance Artifact " + Date.now(),
          artifactType: "data_analysis",
          evidenceIds: [userAEvidenceId],
        } as CreateArtifactInput),
      });
      expect(res.status).toBe(201);
      protectedArtifactId = (await res.json()).artifact.id;
    });

    test("Physical DELETE on evidence-referenced artifact is rejected with 409 referenced_by_provenance", async () => {
      const res = await fetch(`${BASE_URL}/api/artifacts/${protectedArtifactId}`, {
        method: "DELETE",
        headers: { Cookie: jarA.getCookieHeader() },
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe("referenced_by_provenance");
      expect(data.error).toContain("referenced by knowledge provenance or evidence records");
    });

    test("Evidence-referenced artifact can still be safely archived and restored", async () => {
      // Archive
      const patchRes = await fetch(`${BASE_URL}/api/artifacts/${protectedArtifactId}`, {
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
      expect(patchRes.status).toBe(200);
      const patched = (await patchRes.json()).artifact;
      expect(patched.lifecycleStatus).toBe("archived");
      expect(patched.isArchived).toBe(true);

      // Restore
      const restoreRes = await fetch(`${BASE_URL}/api/artifacts/${protectedArtifactId}`, {
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
      expect(restoreRes.status).toBe(200);
      const restored = (await restoreRes.json()).artifact;
      expect(restored.lifecycleStatus).toBe("active");
      expect(restored.isArchived).toBe(false);
    });
  });

  // ==========================================
  // 5. Assessment Proposal Settlement Rollback & Idempotency
  // ==========================================
  describe("5. Assessment Proposal Settlement Rollback & Idempotency", () => {
    let assessmentId: string;
    let activityId: string;

    beforeAll(async () => {
      // Create an activity for User A
      const actRes = await pg.query(
        `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes)
         values ($1, 'Assessment Settlement Test', 'Assessment Settlement Test', 'study', 'pending_assessment', '1.0.0', 45, 40) returning id`,
        [userAId]
      );
      activityId = actRes.rows[0].id;

      // Create an AI assessment with 2 artifact proposals
      const assessRes = await pg.query(
        `insert into public.ai_assessments (
           user_id, activity_id, status, confidence, model_name, prompt_version, rules_version, proposal
         ) values ($1, $2, 'pending', 0.95, 'deepseek-v4-flash', '1.0', '1.0', $3) returning id`,
        [
          userAId,
          activityId,
          JSON.stringify({
            activity: { type: "learning", completion: 1.0 },
            difficulty: { complexity: 0.5, uncertainty: 0.3, expertise_gap: 0.4, resistance: 0.2 },
            growth: { effort: 0.7, learning: 0.8, performance: 0.6, outcome: 0.7, artifact_value: 0.8, character_evidence: 0.5 },
            evidence: { level: 3, explanation: "Completed security survey" },
            affected_skills: [{ name: "Cryptography", reason: "Direct study" }],
            knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
            mastery_changes: [
              {
                target_type: "skill",
                target_name: "Cryptography",
                from_level: 3,
                proposed_level: 4,
                confidence: 0.95,
                verification_required: false,
                reason: "Consistent practice",
              },
            ],
            xp_semantics: {
              base_value: 60,
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
                title: "Security Assessment Whitepaper " + Date.now(),
                artifactType: "document",
                summary: "Comprehensive security analysis",
                reusabilityScore: 0.9,
              },
              {
                title: "Ignored Note " + Date.now(),
                artifactType: "synthesis_note",
                summary: "Draft notes",
                reusabilityScore: 0.5,
              },
            ],
          }),
        ]
      );
      assessmentId = assessRes.rows[0].id;
    });

    test("Failed settlement (linking foreign User B artifact) proves FULL rollback and ZERO mutation", async () => {
      // Record baseline snapshot
      const beforeAssess = (await pg.query(`select status from public.ai_assessments where id = $1`, [assessmentId])).rows[0];
      const beforeAct = (await pg.query(`select status from public.activities where id = $1`, [activityId])).rows[0];
      const beforeTxCount = parseInt((await pg.query(`select count(*) from public.xp_transactions where user_id = $1`, [userAId])).rows[0].count);
      const beforeArtCount = parseInt((await pg.query(`select count(*) from public.artifacts where user_id = $1`, [userAId])).rows[0].count);
      const beforeArtActCount = parseInt((await pg.query(`select count(*) from public.artifact_activities where user_id = $1`, [userAId])).rows[0].count);

      // User B creates an artifact
      const bRes = await fetch(`${BASE_URL}/api/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarB.getCookieHeader(),
        },
        body: JSON.stringify({
          title: "User B Secret " + Date.now(),
          artifactType: "document",
        } as CreateArtifactInput),
      });
      const bArtifactId = (await bRes.json()).artifact.id;

      // User A attempts to resolve proposal 0 as Existing with User B artifactId
      const res = await fetch(`${BASE_URL}/api/assessments/${assessmentId}/confirm`, {
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
              artifactId: bArtifactId,
            },
            {
              proposalIndex: 1,
              resolution: "ignore",
            },
          ] as ArtifactResolutionInput[],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("该造物不存在或当前账户无权访问");

      // Verify ZERO state mutation after failure
      const afterAssess = (await pg.query(`select status from public.ai_assessments where id = $1`, [assessmentId])).rows[0];
      const afterAct = (await pg.query(`select status from public.activities where id = $1`, [activityId])).rows[0];
      const afterTxCount = parseInt((await pg.query(`select count(*) from public.xp_transactions where user_id = $1`, [userAId])).rows[0].count);
      const afterArtCount = parseInt((await pg.query(`select count(*) from public.artifacts where user_id = $1`, [userAId])).rows[0].count);
      const afterArtActCount = parseInt((await pg.query(`select count(*) from public.artifact_activities where user_id = $1`, [userAId])).rows[0].count);

      expect(afterAssess.status).toBe(beforeAssess.status);
      expect(afterAct.status).toBe(beforeAct.status);
      expect(afterAssess.status).toBe("pending");
      expect(afterAct.status).toBe("pending_assessment");
      expect(afterTxCount).toBe(beforeTxCount);
      expect(afterArtCount).toBe(beforeArtCount);
      expect(afterArtActCount).toBe(beforeArtActCount);
    });

    test("Successfully settles assessment and proves comprehensive idempotency across all domain entities on duplicate confirm", async () => {
      const artTitle = "Security Assessment Whitepaper Confirmed " + Date.now();
      const resolutions: ArtifactResolutionInput[] = [
        {
          proposalIndex: 0,
          resolution: "create",
          approvedOverrides: {
            title: artTitle,
            artifactType: "document",
            reusabilityScore: 0.9,
          },
        },
        {
          proposalIndex: 1,
          resolution: "ignore",
        },
      ];

      // 1. First Confirm -> SUCCESS
      const res1 = await fetch(`${BASE_URL}/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res1.status).toBe(200);

      // Record snapshot after successful 1st settlement
      const txRes1 = await pg.query(`select * from public.xp_transactions where activity_id = $1`, [activityId]);
      expect(txRes1.rows.length).toBe(1);
      const firstTx = txRes1.rows[0];

      const artRes1 = await pg.query(`select * from public.artifacts where user_id = $1 and title = $2`, [userAId, artTitle]);
      expect(artRes1.rows.length).toBe(1);
      const createdArtId = artRes1.rows[0].id;

      const artActRes1 = await pg.query(`select count(*) from public.artifact_activities where activity_id = $1`, [activityId]);
      expect(parseInt(artActRes1.rows[0].count)).toBe(1);

      const assessRow1 = (await pg.query(`select status from public.ai_assessments where id = $1`, [assessmentId])).rows[0];
      expect(assessRow1.status).toBe("confirmed");

      // 2. Duplicate Confirm -> rejected with 409 already_confirmed
      const res2 = await fetch(`${BASE_URL}/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: jarA.getCookieHeader(),
        },
        body: JSON.stringify({ artifactResolutions: resolutions }),
      });
      expect(res2.status).toBe(409);
      const errData = await res2.json();
      expect(errData.code).toBe("already_confirmed");

      // Verify strict idempotency: zero duplicate transactions, zero duplicate artifacts, zero duplicate links
      const txRes2 = await pg.query(`select * from public.xp_transactions where activity_id = $1`, [activityId]);
      expect(txRes2.rows.length).toBe(1);
      expect(txRes2.rows[0].id).toBe(firstTx.id);

      const artRes2 = await pg.query(`select * from public.artifacts where user_id = $1 and title = $2`, [userAId, artTitle]);
      expect(artRes2.rows.length).toBe(1);
      expect(artRes2.rows[0].id).toBe(createdArtId);

      const artActRes2 = await pg.query(`select count(*) from public.artifact_activities where activity_id = $1`, [activityId]);
      expect(parseInt(artActRes2.rows[0].count)).toBe(1);
    });
  });

  // ==========================================
  // 6. Concurrency Audit (Race Condition Protection)
  // ==========================================
  describe("6. Concurrency Audit", () => {
    test("Two simultaneous confirmation requests on the same assessment result in exactly ONE success and ZERO duplicate mutations", async () => {
      const concTitle = "Concurrent Artifact " + Date.now();
      // Setup concurrent assessment fixture
      const actRes = await pg.query(
        `insert into public.activities (user_id, title, raw_input, activity_type, status, rules_version, total_minutes, effective_minutes)
         values ($1, 'Concurrent Settlement Test', 'Concurrent Settlement Test', 'study', 'pending_assessment', '1.0.0', 45, 40) returning id`,
        [userAId]
      );
      const concActId = actRes.rows[0].id;

      const assessRes = await pg.query(
        `insert into public.ai_assessments (
           user_id, activity_id, status, confidence, model_name, prompt_version, rules_version, proposal
         ) values ($1, $2, 'pending', 0.95, 'deepseek-v4-flash', '1.0', '1.0', $3) returning id`,
        [
          userAId,
          concActId,
          JSON.stringify({
            activity: { type: "learning", completion: 1.0 },
            difficulty: { complexity: 0.5, uncertainty: 0.3, expertise_gap: 0.4, resistance: 0.2 },
            growth: { effort: 0.7, learning: 0.8, performance: 0.6, outcome: 0.7, artifact_value: 0.8, character_evidence: 0.5 },
            evidence: { level: 3, explanation: "Concurrent race test" },
            affected_skills: [{ name: "Cryptography", reason: "Direct study" }],
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
                title: concTitle,
                artifactType: "code_repository",
                reusabilityScore: 0.8,
              },
            ],
          }),
        ]
      );
      const concAssessId = assessRes.rows[0].id;

      const payload = {
        artifactResolutions: [
          {
            proposalIndex: 0,
            resolution: "create",
          },
        ] as ArtifactResolutionInput[],
      };

      // Fire 2 simultaneous requests in parallel
      const [res1, res2] = await Promise.all([
        fetch(`${BASE_URL}/api/assessments/${concAssessId}/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: jarA.getCookieHeader(),
          },
          body: JSON.stringify(payload),
        }),
        fetch(`${BASE_URL}/api/assessments/${concAssessId}/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: jarA.getCookieHeader(),
          },
          body: JSON.stringify(payload),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must be 200 (Success) and the other 409 (already_confirmed)
      expect(statuses).toEqual([200, 409]);

      // Verify exactly ONE assessment was confirmed
      const assessConfirmedCount = await pg.query(
        `select count(*) from public.ai_assessments where id = $1 and status = 'confirmed'`,
        [concAssessId]
      );
      expect(parseInt(assessConfirmedCount.rows[0].count)).toBe(1);

      // Verify exactly ONE transaction was recorded in DB
      const txCount = await pg.query(
        `select count(*) from public.xp_transactions where activity_id = $1`,
        [concActId]
      );
      expect(parseInt(txCount.rows[0].count)).toBe(1);

      // Verify exactly ONE artifact was created in public.artifacts
      const artCount = await pg.query(
        `select count(*) from public.artifacts where user_id = $1 and title = $2`,
        [userAId, concTitle]
      );
      expect(parseInt(artCount.rows[0].count)).toBe(1);

      // Verify exactly ONE artifact_activities relationship
      const artActCount = await pg.query(
        `select count(*) from public.artifact_activities where user_id = $1 and activity_id = $2`,
        [userAId, concActId]
      );
      expect(parseInt(artActCount.rows[0].count)).toBe(1);
    });
  });
});
