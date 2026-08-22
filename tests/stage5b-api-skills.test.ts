import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { GET as getSkills } from "@/app/api/skills/route";
import { GET as getSkillDetail, PATCH as patchSkill } from "@/app/api/skills/[id]/route";
import { POST as postSkillEdge } from "@/app/api/skills/edges/route";
import { DELETE as deleteSkillEdge } from "@/app/api/skills/edges/[id]/route";
import { DemoRepository } from "@/lib/store/demo-repository";
import type { AssessmentProposal } from "@/lib/ai/schemas";

vi.mock("@/lib/store/request-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/store/request-repository")>(
    "@/lib/store/request-repository",
  );
  return {
    ...actual,
    getRequestRepository: vi.fn(),
  };
});

import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";

function mockProposal(skillName: string): AssessmentProposal {
  return {
    activity: { type: "learning", completion: 0.7 },
    difficulty: { complexity: 0.5, uncertainty: 0.4, expertise_gap: 0.5, resistance: 0.4 },
    growth: {
      effort: 0.6,
      learning: 0.7,
      performance: 0.3,
      outcome: 0.5,
      artifact_value: 0.2,
      character_evidence: 0.1,
    },
    evidence: { level: 2, explanation: "Demonstrated direct capability" },
    affected_skills: [{ name: skillName, reason: "used skill" }],
    knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
    mastery_changes: [],
    xp_semantics: {
      base_value: 20,
      difficulty: 0.5,
      mastery_gain: 0.5,
      novelty: 0.5,
      goal_alignment: 0.6,
      repetition_risk: "low",
    },
    artifacts: [],
    next_quest: null,
    confidence: 0.9,
    uncertainty_notes: [],
  };
}

describe("Stage 5B — Skill API Routes", () => {
  let tempDir: string;
  let demoRepo: DemoRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-skills-api-test-"));
    process.env.DEMO_DB_PATH = path.join(tempDir, "demo.json");
    demoRepo = new DemoRepository();
    await demoRepo.reset();
    (getRequestRepository as unknown as Mock).mockResolvedValue(demoRepo);
  });

  afterEach(() => {
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
    delete process.env.DEMO_DB_PATH;
    vi.restoreAllMocks();
  });

  describe("Unauthenticated Access (401)", () => {
    beforeEach(() => {
      (getRequestRepository as unknown as Mock).mockRejectedValue(
        new AuthRequiredError(),
      );
    });

    test("GET /api/skills returns 401", async () => {
      const req = new Request("http://localhost:3000/api/skills");
      const res = await getSkills(req);
      expect(res.status).toBe(401);
    });

    test("GET /api/skills/[id] returns 401", async () => {
      const req = new Request("http://localhost:3000/api/skills/s-1");
      const res = await getSkillDetail(req, { params: Promise.resolve({ id: "s-1" }) });
      expect(res.status).toBe(401);
    });

    test("PATCH /api/skills/[id] returns 401", async () => {
      const req = new Request("http://localhost:3000/api/skills/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: "s-1" }) });
      expect(res.status).toBe(401);
    });

    test("POST /api/skills/edges returns 401", async () => {
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: "s-1",
          targetSkillId: "s-2",
          relationType: "prerequisite",
        }),
      });
      const res = await postSkillEdge(req);
      expect(res.status).toBe(401);
    });

    test("DELETE /api/skills/edges/[id] returns 401", async () => {
      const req = new Request("http://localhost:3000/api/skills/edges/e-1", {
        method: "DELETE",
      });
      const res = await deleteSkillEdge(req, { params: Promise.resolve({ id: "e-1" }) });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/skills Graph List & Filtering", () => {
    test("returns full positioned skill tree graph with derived states", async () => {
      // Seed two skills via settlement
      const act = await demoRepo.addActivity({ rawInput: "Practice TS", totalMinutes: 60 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("TypeScript"),
        modelName: "test-model",
        promptVersion: "v1",
      });

      const s1 = await demoRepo.applySettlement({
        assessmentId: assess.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act.id,
          assessmentId: assess.id,
          xpType: "activity",
          skillId: "",
          skillName: "TypeScript",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 300,
          baseAmount: 300,
          modifierJson: {},
          reason: "TS Practice",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 300,
        primarySkill: {
          skill: { resolution: "create", proposedName: "TypeScript" },
          name: "TypeScript",
          xpDelta: 300,
          masteryAction: { action: "upgrade", proposedLevel: 3, confidence: 0.85 },
        },
        player: { xpDelta: 300 },
      });

      const act2 = await demoRepo.addActivity({ rawInput: "Practice JS", totalMinutes: 30 });
      const assess2 = await demoRepo.addAssessment({
        activityId: act2.id,
        proposal: mockProposal("Next.js"),
        modelName: "test-model",
        promptVersion: "v1",
      });
      const s2 = await demoRepo.applySettlement({
        assessmentId: assess2.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act2.id,
          assessmentId: assess2.id,
          xpType: "activity",
          skillId: "",
          skillName: "Next.js",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 0,
          baseAmount: 0,
          modifierJson: {},
          reason: "Next.js Practice",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 0,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Next.js" },
          name: "Next.js",
          xpDelta: 0,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 0 },
      });

      // Add prerequisite edge: TypeScript -> Next.js
      await demoRepo.addEdge({
        sourceSkillId: s1.skillId!,
        targetSkillId: s2.skillId!,
        relationType: "prerequisite",
      });

      const req = new Request("http://localhost:3000/api/skills");
      const res = await getSkills(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.domains).toBeDefined();
      expect(data.nodes).toHaveLength(2);
      expect(data.edges).toHaveLength(1);

      const tsNode = data.nodes.find((n: { id: string }) => n.id === s1.skillId);
      const nextNode = data.nodes.find((n: { id: string }) => n.id === s2.skillId);

      expect(tsNode.data.derivedState).toBe("proficient");
      expect(nextNode.data.derivedState).toBe("available");
      expect(nextNode.position.x).toBe(280); // topological layer 1
    });
  });

  describe("GET /api/skills/[id] Detail Read Model", () => {
    test("returns 404 for non-existent skill id", async () => {
      const req = new Request("http://localhost:3000/api/skills/00000000-0000-0000-0000-000000000000");
      const res = await getSkillDetail(req, {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
      });
      expect(res.status).toBe(404);
    });

    test("returns full detail model including timeline and prerequisites", async () => {
      const act = await demoRepo.addActivity({ rawInput: "Build Auth", totalMinutes: 90 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("Supabase RLS"),
        modelName: "test-model",
        promptVersion: "v1",
      });

      const setRes = await demoRepo.applySettlement({
        assessmentId: assess.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act.id,
          assessmentId: assess.id,
          xpType: "activity",
          skillId: "",
          skillName: "Supabase RLS",
          activityType: "security",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 150,
          baseAmount: 150,
          modifierJson: {},
          reason: "Implemented multi-tenant RLS",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 150,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Supabase RLS" },
          name: "Supabase RLS",
          xpDelta: 150,
          masteryAction: { action: "upgrade", proposedLevel: 2, confidence: 0.8 },
        },
        player: { xpDelta: 150 },
        evidence: {
          level: 2,
          type: "security_rules",
          explanation: "Wrote exhaustive RLS policies with tenant isolation",
        },
      });

      const skillId = setRes.skillId!;
      const req = new Request(`http://localhost:3000/api/skills/${skillId}`);
      const res = await getSkillDetail(req, { params: Promise.resolve({ id: skillId }) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skill.id).toBe(skillId);
      expect(body.skill.name).toBe("Supabase RLS");
      expect(body.skill.derivedState).toBe("learning");
      expect(body.evidenceTimeline).toHaveLength(1);
      expect(body.evidenceTimeline[0].evidenceLevel).toBe(2);
      expect(body.evidenceTimeline[0].verified).toBe(true);
      expect(body.masteryHistory).toHaveLength(1);
      expect(body.masteryHistory[0].toLevel).toBe(2);
      expect(body.recentTransactions).toHaveLength(1);
    });
  });

  describe("PATCH /api/skills/[id] Metadata Mutation", () => {
    test("successfully updates skill metadata and preserves old name in aliases", async () => {
      const act = await demoRepo.addActivity({ rawInput: "Learn Go", totalMinutes: 45 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("Golang"),
        modelName: "test-model",
        promptVersion: "v1",
      });

      const setRes = await demoRepo.applySettlement({
        assessmentId: assess.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act.id,
          assessmentId: assess.id,
          xpType: "activity",
          skillId: "",
          skillName: "Golang",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 50,
          baseAmount: 50,
          modifierJson: {},
          reason: "Go practice",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 50,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Golang" },
          name: "Golang",
          xpDelta: 50,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 50 },
      });

      const skillId = setRes.skillId!;

      const req = new Request(`http://localhost:3000/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Go Programming Language",
          description: "Systems programming with Go",
          domainId: "d-cs",
        }),
      });

      const res = await patchSkill(req, { params: Promise.resolve({ id: skillId }) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe("Go Programming Language");
      expect(body.aliases).toContain("Golang");
      expect(body.description).toBe("Systems programming with Go");
      expect(body.domainId).toBe("d-cs");
    });

    test("returns 400 when name is empty string", async () => {
      const req = new Request("http://localhost:3000/api/skills/some-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: "some-id" }) });
      expect(res.status).toBe(400);
    });

    test("returns 409 when renaming to a name that conflicts with an existing skill", async () => {
      const act = await demoRepo.addActivity({ rawInput: "Learn Rust", totalMinutes: 45 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("Rust"),
        modelName: "test-model",
        promptVersion: "v1",
      });

      await demoRepo.applySettlement({
        assessmentId: assess.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act.id,
          assessmentId: assess.id,
          xpType: "activity",
          skillId: "",
          skillName: "Rust",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 50,
          baseAmount: 50,
          modifierJson: {},
          reason: "Rust practice",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 50,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Rust" },
          name: "Rust",
          xpDelta: 50,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 50 },
      });

      const act2 = await demoRepo.addActivity({ rawInput: "Learn C++", totalMinutes: 45 });
      const assess2 = await demoRepo.addAssessment({
        activityId: act2.id,
        proposal: mockProposal("C++"),
        modelName: "test-model",
        promptVersion: "v1",
      });
      const s2 = await demoRepo.applySettlement({
        assessmentId: assess2.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act2.id,
          assessmentId: assess2.id,
          xpType: "activity",
          skillId: "",
          skillName: "C++",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 50,
          baseAmount: 50,
          modifierJson: {},
          reason: "C++ practice",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 50,
        primarySkill: {
          skill: { resolution: "create", proposedName: "C++" },
          name: "C++",
          xpDelta: 50,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 50 },
      });

      // Attempt to rename C++ to "   rust   "
      const req = new Request(`http://localhost:3000/api/skills/${s2.skillId!}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   rust   " }),
      });

      const res = await patchSkill(req, { params: Promise.resolve({ id: s2.skillId! }) });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/skills/edges & DELETE /api/skills/edges/[id]", () => {
    test("rejects self-edge with 400", async () => {
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: "same-id",
          targetSkillId: "same-id",
          relationType: "prerequisite",
        }),
      });

      const res = await postSkillEdge(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Self-edges are forbidden");
    });

    test("rejects cycle in prerequisite DAG with 409", async () => {
      const act = await demoRepo.addActivity({ rawInput: "Seeding skills", totalMinutes: 10 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("Node A"),
        modelName: "test-model",
        promptVersion: "v1",
      });

      const sA = await demoRepo.applySettlement({
        assessmentId: assess.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act.id,
          assessmentId: assess.id,
          xpType: "activity",
          skillId: "",
          skillName: "Node A",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 10,
          baseAmount: 10,
          modifierJson: {},
          reason: "Seed",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 10,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Node A" },
          name: "Node A",
          xpDelta: 10,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 10 },
      });

      const act2 = await demoRepo.addActivity({ rawInput: "Seeding skills 2", totalMinutes: 10 });
      const assess2 = await demoRepo.addAssessment({
        activityId: act2.id,
        proposal: mockProposal("Node B"),
        modelName: "test-model",
        promptVersion: "v1",
      });
      const sB = await demoRepo.applySettlement({
        assessmentId: assess2.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act2.id,
          assessmentId: assess2.id,
          xpType: "activity",
          skillId: "",
          skillName: "Node B",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 10,
          baseAmount: 10,
          modifierJson: {},
          reason: "Seed",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 10,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Node B" },
          name: "Node B",
          xpDelta: 10,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 10 },
      });

      // Edge 1: A -> B
      const req1 = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: sA.skillId!,
          targetSkillId: sB.skillId!,
          relationType: "prerequisite",
        }),
      });
      const res1 = await postSkillEdge(req1);
      expect(res1.status).toBe(201);

      // Edge 2: B -> A (creates cycle!) -> MUST RETURN 409
      const req2 = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: sB.skillId!,
          targetSkillId: sA.skillId!,
          relationType: "prerequisite",
        }),
      });
      const res2 = await postSkillEdge(req2);
      expect(res2.status).toBe(409);
    });

    test("successfully creates and deletes an edge", async () => {
      const act = await demoRepo.addActivity({ rawInput: "Seeding skills", totalMinutes: 10 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("Node X"),
        modelName: "test-model",
        promptVersion: "v1",
      });

      const sA = await demoRepo.applySettlement({
        assessmentId: assess.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act.id,
          assessmentId: assess.id,
          xpType: "activity",
          skillId: "",
          skillName: "Node X",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 10,
          baseAmount: 10,
          modifierJson: {},
          reason: "Seed",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 10,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Node X" },
          name: "Node X",
          xpDelta: 10,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 10 },
      });

      const act2 = await demoRepo.addActivity({ rawInput: "Seeding skills 2", totalMinutes: 10 });
      const assess2 = await demoRepo.addAssessment({
        activityId: act2.id,
        proposal: mockProposal("Node Y"),
        modelName: "test-model",
        promptVersion: "v1",
      });
      const sB = await demoRepo.applySettlement({
        assessmentId: assess2.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act2.id,
          assessmentId: assess2.id,
          xpType: "activity",
          skillId: "",
          skillName: "Node Y",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 10,
          baseAmount: 10,
          modifierJson: {},
          reason: "Seed",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 10,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Node Y" },
          name: "Node Y",
          xpDelta: 10,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 10 },
      });

      const createReq = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: sA.skillId!,
          targetSkillId: sB.skillId!,
          relationType: "supports",
        }),
      });

      const createRes = await postSkillEdge(createReq);
      expect(createRes.status).toBe(201);
      const edge = await createRes.json();
      expect(edge.id).toBeDefined();

      const deleteReq = new Request(`http://localhost:3000/api/skills/edges/${edge.id}`, {
        method: "DELETE",
      });
      const deleteRes = await deleteSkillEdge(deleteReq, {
        params: Promise.resolve({ id: edge.id }),
      });
      expect(deleteRes.status).toBe(204);
    });
  });
});
