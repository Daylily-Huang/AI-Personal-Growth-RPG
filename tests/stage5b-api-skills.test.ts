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

  describe("P1-3 — Unauthenticated Access (Must return 401 before any parsing/validation)", () => {
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

    test("unauth GET /api/skills?domainId=not-a-uuid returns 401 (auth precedes query validation)", async () => {
      const req = new Request("http://localhost:3000/api/skills?domainId=not-a-uuid");
      const res = await getSkills(req);
      expect(res.status).toBe(401);
    });

    test("unauth GET /api/skills?status=banana returns 401 (not 400)", async () => {
      const req = new Request("http://localhost:3000/api/skills?status=banana");
      const res = await getSkills(req);
      expect(res.status).toBe(401);
    });

    test("GET /api/skills/[id] returns 401 even with invalid UUID", async () => {
      const req = new Request("http://localhost:3000/api/skills/not-a-uuid");
      const res = await getSkillDetail(req, { params: Promise.resolve({ id: "not-a-uuid" }) });
      expect(res.status).toBe(401);
    });

    test("unauth + valid PATCH returns 401", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request(`http://localhost:3000/api/skills/${validUuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed Skill" }),
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: validUuid }) });
      expect(res.status).toBe(401);
    });

    test("unauth + empty-name PATCH returns 401 (not 400)", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request(`http://localhost:3000/api/skills/${validUuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: validUuid }) });
      expect(res.status).toBe(401);
    });

    test("unauth + malformed JSON PATCH returns 401 (not 400)", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request(`http://localhost:3000/api/skills/${validUuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ not valid json",
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: validUuid }) });
      expect(res.status).toBe(401);
    });

    test("unauth + self-edge POST returns 401 (not 400)", async () => {
      const sameId = crypto.randomUUID();
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: sameId,
          targetSkillId: sameId,
          relationType: "prerequisite",
        }),
      });
      const res = await postSkillEdge(req);
      expect(res.status).toBe(401);
    });

    test("unauth + malformed JSON POST returns 401 (not 400)", async () => {
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json string",
      });
      const res = await postSkillEdge(req);
      expect(res.status).toBe(401);
    });

    test("DELETE /api/skills/edges/[id] returns 401 even with invalid UUID", async () => {
      const req = new Request("http://localhost:3000/api/skills/edges/not-a-uuid", {
        method: "DELETE",
      });
      const res = await deleteSkillEdge(req, { params: Promise.resolve({ id: "not-a-uuid" }) });
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

  describe("GET /api/skills domainId Query Validation (Round 3 P1)", () => {
    test("returns 400 for malformed domainId and never touches repository list methods", async () => {
      const listDomainsSpy = vi.spyOn(demoRepo, "listDomains");
      const listSkillsSpy = vi.spyOn(demoRepo, "listSkills");
      const listEdgesSpy = vi.spyOn(demoRepo, "listSkillEdges");

      const req = new Request("http://localhost:3000/api/skills?domainId=not-a-uuid");
      const res = await getSkills(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("domainId must be a valid UUID");
      expect(listDomainsSpy).not.toHaveBeenCalled();
      expect(listSkillsSpy).not.toHaveBeenCalled();
      expect(listEdgesSpy).not.toHaveBeenCalled();
    });

    test("distinguishes invalid identifier from valid-but-nonexistent domain filter (200 empty graph)", async () => {
      // Seed one real skill so the empty result proves filtering, not an empty store.
      const act = await demoRepo.addActivity({ rawInput: "Practice TS", totalMinutes: 60 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("TypeScript"),
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

      const nonexistentDomainUuid = crypto.randomUUID();
      const req = new Request(
        `http://localhost:3000/api/skills?domainId=${nonexistentDomainUuid}`,
      );
      const res = await getSkills(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.domains).toEqual([]);
      expect(data.nodes).toEqual([]);
      expect(data.edges).toEqual([]);
    });
  });

  describe("GET /api/skills status Query Validation (Round 4 P1)", () => {
    test("returns 400 for invalid status and never touches repository list methods", async () => {
      const listDomainsSpy = vi.spyOn(demoRepo, "listDomains");
      const listSkillsSpy = vi.spyOn(demoRepo, "listSkills");
      const listEdgesSpy = vi.spyOn(demoRepo, "listSkillEdges");

      const req = new Request("http://localhost:3000/api/skills?status=banana");
      const res = await getSkills(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("status must be one of: active, archived, all");
      expect(listDomainsSpy).not.toHaveBeenCalled();
      expect(listSkillsSpy).not.toHaveBeenCalled();
      expect(listEdgesSpy).not.toHaveBeenCalled();
    });

    test("accepts active/archived/all and preserves existing filtering semantics", async () => {
      // Seed one settled skill (default status: active)
      const act = await demoRepo.addActivity({ rawInput: "Probe status", totalMinutes: 30 });
      const assess = await demoRepo.addAssessment({
        activityId: act.id,
        proposal: mockProposal("Status Probe Skill"),
        modelName: "test-model",
        promptVersion: "v1",
      });
      const seeded = await demoRepo.applySettlement({
        assessmentId: assess.id,
        transaction: {
          id: crypto.randomUUID(),
          activityId: act.id,
          assessmentId: assess.id,
          xpType: "activity",
          skillId: "",
          skillName: "Status Probe Skill",
          activityType: "coding",
          repetitionCount: 0,
          repetitionPenalty: 1,
          amount: 40,
          baseAmount: 40,
          modifierJson: {},
          reason: "status probe",
          rulesVersion: "test",
          createdAt: new Date().toISOString(),
        },
        xpDelta: 40,
        primarySkill: {
          skill: { resolution: "create", proposedName: "Status Probe Skill" },
          name: "Status Probe Skill",
          xpDelta: 40,
          masteryAction: { action: "none" },
        },
        player: { xpDelta: 40 },
      });
      expect(seeded.skillId).toBeDefined();

      const base = "http://localhost:3000/api/skills";

      const resActive = await getSkills(new Request(`${base}?status=active`));
      expect(resActive.status).toBe(200);
      expect((await resActive.json()).nodes).toHaveLength(1);

      const resAll = await getSkills(new Request(`${base}?status=all`));
      expect(resAll.status).toBe(200);
      expect((await resAll.json()).nodes).toHaveLength(1);

      const resArchived = await getSkills(new Request(`${base}?status=archived`));
      expect(resArchived.status).toBe(200);
      expect((await resArchived.json()).nodes).toHaveLength(0);

      // Omitted status defaults to active
      const resDefault = await getSkills(new Request(base));
      expect(resDefault.status).toBe(200);
      expect((await resDefault.json()).nodes).toHaveLength(1);
    });
  });

  describe("GET /api/skills/[id] Detail Read Model", () => {
    test("returns 400 for invalid UUID format", async () => {
      const req = new Request("http://localhost:3000/api/skills/invalid-format");
      const res = await getSkillDetail(req, {
        params: Promise.resolve({ id: "invalid-format" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Valid skill UUID is required");
    });

    test("returns 404 for non-existent valid skill UUID", async () => {
      const randomUuid = crypto.randomUUID();
      const req = new Request(`http://localhost:3000/api/skills/${randomUuid}`);
      const res = await getSkillDetail(req, {
        params: Promise.resolve({ id: randomUuid }),
      });
      expect(res.status).toBe(404);
    });

    test("returns full detail model including timeline and prerequisites with stable createdAt", async () => {
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
      const req1 = new Request(`http://localhost:3000/api/skills/${skillId}`);
      const res1 = await getSkillDetail(req1, { params: Promise.resolve({ id: skillId }) });
      expect(res1.status).toBe(200);

      const body1 = await res1.json();
      expect(body1.skill.id).toBe(skillId);
      expect(body1.skill.name).toBe("Supabase RLS");
      expect(body1.skill.derivedState).toBe("learning");
      expect(body1.skill.createdAt).toBeDefined();
      expect(body1.evidenceTimeline).toHaveLength(1);
      expect(body1.evidenceTimeline[0].evidenceLevel).toBe(2);
      expect(body1.evidenceTimeline[0].verified).toBe(true);
      expect(body1.masteryHistory).toHaveLength(1);
      expect(body1.masteryHistory[0].toLevel).toBe(2);
      expect(body1.recentTransactions).toHaveLength(1);

      // Verify deterministic timestamp across multiple calls
      const req2 = new Request(`http://localhost:3000/api/skills/${skillId}`);
      const res2 = await getSkillDetail(req2, { params: Promise.resolve({ id: skillId }) });
      const body2 = await res2.json();
      expect(body2.skill.createdAt).toBe(body1.skill.createdAt);
    });
  });

  describe("PATCH /api/skills/[id] Validation & Metadata Mutation", () => {
    test("returns 400 when route id is not a valid UUID", async () => {
      const req = new Request("http://localhost:3000/api/skills/bad-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Valid Name" }),
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: "bad-id" }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Valid skill UUID is required");
    });

    test("returns 400 when body is malformed JSON", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request(`http://localhost:3000/api/skills/${validUuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ bad json",
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: validUuid }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Malformed JSON body");
    });

    test("returns 400 when name is empty string or only whitespace", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request(`http://localhost:3000/api/skills/${validUuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: validUuid }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("name must be a non-empty string");
    });

    test("returns 400 when domainId is invalid UUID format", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request(`http://localhost:3000/api/skills/${validUuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: "not-a-uuid" }),
      });
      const res = await patchSkill(req, { params: Promise.resolve({ id: validUuid }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("domainId must be a valid UUID or null");
    });

    test("returns 400 when domainId is valid UUID but does not exist (Demo/Supabase parity)", async () => {
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
      const nonExistentDomainUuid = crypto.randomUUID();

      const req = new Request(`http://localhost:3000/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: nonExistentDomainUuid }),
      });

      const res = await patchSkill(req, { params: Promise.resolve({ id: skillId }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("domain");
    });

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
          domainId: "d1111111-1111-4000-a000-000000000001",
        }),
      });

      const res = await patchSkill(req, { params: Promise.resolve({ id: skillId }) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe("Go Programming Language");
      expect(body.aliases).toContain("Golang");
      expect(body.description).toBe("Systems programming with Go");
      expect(body.domainId).toBe("d1111111-1111-4000-a000-000000000001");
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
    test("POST returns 400 for malformed JSON body", async () => {
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ broken",
      });
      const res = await postSkillEdge(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Malformed JSON body");
    });

    test("POST returns 400 when sourceSkillId is invalid UUID", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: "invalid-source",
          targetSkillId: validUuid,
          relationType: "prerequisite",
        }),
      });
      const res = await postSkillEdge(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("sourceSkillId must be a valid UUID");
    });

    test("POST returns 400 when targetSkillId is invalid UUID", async () => {
      const validUuid = crypto.randomUUID();
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: validUuid,
          targetSkillId: "invalid-target",
          relationType: "prerequisite",
        }),
      });
      const res = await postSkillEdge(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("targetSkillId must be a valid UUID");
    });

    test("POST rejects self-edge with 400", async () => {
      const sameId = crypto.randomUUID();
      const req = new Request("http://localhost:3000/api/skills/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: sameId,
          targetSkillId: sameId,
          relationType: "prerequisite",
        }),
      });

      const res = await postSkillEdge(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Self-edges are forbidden");
    });

    test("POST rejects cycle in prerequisite DAG with 409", async () => {
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

    test("P1-2 — DELETE edge returns 204 on success, 404 on repeat or non-existent edge", async () => {
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

      // 1. First DELETE -> 204
      const deleteReq1 = new Request(`http://localhost:3000/api/skills/edges/${edge.id}`, {
        method: "DELETE",
      });
      const deleteRes1 = await deleteSkillEdge(deleteReq1, {
        params: Promise.resolve({ id: edge.id }),
      });
      expect(deleteRes1.status).toBe(204);

      // 2. Second DELETE on same edge -> 404 (P1-2)
      const deleteReq2 = new Request(`http://localhost:3000/api/skills/edges/${edge.id}`, {
        method: "DELETE",
      });
      const deleteRes2 = await deleteSkillEdge(deleteReq2, {
        params: Promise.resolve({ id: edge.id }),
      });
      expect(deleteRes2.status).toBe(404);

      // 3. DELETE random nonexistent UUID edge -> 404 (P1-2)
      const randomEdgeUuid = crypto.randomUUID();
      const deleteReq3 = new Request(`http://localhost:3000/api/skills/edges/${randomEdgeUuid}`, {
        method: "DELETE",
      });
      const deleteRes3 = await deleteSkillEdge(deleteReq3, {
        params: Promise.resolve({ id: randomEdgeUuid }),
      });
      expect(deleteRes3.status).toBe(404);
    });
  });
});
