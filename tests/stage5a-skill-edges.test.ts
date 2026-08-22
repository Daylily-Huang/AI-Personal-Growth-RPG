import { describe, expect, test, beforeEach } from "vitest";
import { DemoRepository } from "@/lib/store/demo-repository";
import type { AssessmentProposal } from "@/lib/ai/schemas";
import type { SettlementToApply, XpTransaction } from "@/lib/store/types";

function createMockProposal(overrides?: Partial<AssessmentProposal>): AssessmentProposal {
  return {
    activity: { type: "skill", completion: 0.8 },
    difficulty: { complexity: 0.5, uncertainty: 0.4, expertise_gap: 0.5, resistance: 0.4 },
    growth: { effort: 0.6, learning: 0.7, performance: 0.5, outcome: 0.5, artifact_value: 0.3, character_evidence: 0.2 },
    evidence: { level: 2, explanation: "Valid test evidence" },
    affected_skills: [{ name: "TypeScript", reason: "TS practice" }],
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
    next_quest: { title: "Follow-up", reason: "Next step" },
    confidence: 0.8,
    uncertainty_notes: [],
    ...overrides,
  };
}

describe("Stage 5A — Skill Graph Authority & Store Invariants (DemoRepository)", () => {
  let repo: DemoRepository;

  beforeEach(async () => {
    repo = new DemoRepository();
    await repo.reset();
  });

  test("1. addEdge: Successfully creates prerequisite, contains, and supports edges", async () => {
    const act = await repo.addActivity({ rawInput: "Learn TypeScript & JavaScript" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal({
        affected_skills: [
          { name: "JavaScript", reason: "JS base" },
          { name: "TypeScript", reason: "TS typed" },
        ],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    const tx: XpTransaction = {
      id: crypto.randomUUID(),
      activityId: act.id,
      assessmentId: assess.id,
      xpType: "activity",
      skillId: "",
      skillName: "JavaScript",
      activityType: "skill",
      repetitionCount: 0,
      repetitionPenalty: 1,
      amount: 30,
      baseAmount: 30,
      modifierJson: {},
      reason: "Initial practice",
      rulesVersion: "test",
      createdAt: new Date().toISOString(),
    };

    const settle: SettlementToApply = {
      assessmentId: assess.id,
      transaction: tx,
      xpDelta: 30,
      primarySkill: {
        skill: { resolution: "create", proposedName: "JavaScript" },
        name: "JavaScript",
        xpDelta: 30,
        masteryAction: { action: "none" },
      },
      relatedSkillResolutions: [{ resolution: "create", proposedName: "TypeScript" }],
      player: { xpDelta: 30 },
    };

    const settleRes = await repo.applySettlement(settle);
    expect(settleRes.ok).toBe(true);

    const jsSkill = await repo.getSkill("JavaScript");
    const tsSkill = await repo.getSkill("TypeScript");
    expect(jsSkill).not.toBeNull();
    expect(tsSkill).not.toBeNull();

    // Add prerequisite edge: JavaScript -> TypeScript
    const edge = await repo.addEdge({
      sourceSkillId: jsSkill!.id,
      targetSkillId: tsSkill!.id,
      relationType: "prerequisite",
    });

    expect(edge.id).toBeDefined();
    expect(edge.sourceId).toBe(jsSkill!.id);
    expect(edge.targetId).toBe(tsSkill!.id);
    expect(edge.relation).toBe("prerequisite");

    const allEdges = await repo.listSkillEdges();
    expect(allEdges.some((e) => e.id === edge.id)).toBe(true);
  });

  test("2. Anti-self: Rejects edge where source equals target", async () => {
    const act = await repo.addActivity({ rawInput: "Self test" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal({
        affected_skills: [{ name: "Python", reason: "Py test" }],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "Python",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Self test",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "create", proposedName: "Python" },
        name: "Python",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    });

    const py = await repo.getSkill("Python");
    expect(py).not.toBeNull();

    await expect(
      repo.addEdge({
        sourceSkillId: py!.id,
        targetSkillId: py!.id,
        relationType: "prerequisite",
      }),
    ).rejects.toThrow("Self-edges are forbidden");
  });

  test("3. Single-Parent Contains Invariant: Rejects second contains parent for the same target", async () => {
    const act = await repo.addActivity({ rawInput: "Structure test" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal({
        affected_skills: [
          { name: "ParentA", reason: "Parent A" },
          { name: "ParentB", reason: "Parent B" },
          { name: "Child", reason: "Child skill" },
        ],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "ParentA",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Structure test",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "create", proposedName: "ParentA" },
        name: "ParentA",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      relatedSkillResolutions: [
        { resolution: "create", proposedName: "ParentB" },
        { resolution: "create", proposedName: "Child" },
      ],
      player: { xpDelta: 20 },
    });

    const parentA = (await repo.getSkill("ParentA"))!;
    const parentB = (await repo.getSkill("ParentB"))!;
    const child = (await repo.getSkill("Child"))!;

    // 1st contains edge: ParentA contains Child -> OK
    await repo.addEdge({
      sourceSkillId: parentA.id,
      targetSkillId: child.id,
      relationType: "contains",
    });

    // 2nd contains edge: ParentB contains Child -> MUST REJECT
    await expect(
      repo.addEdge({
        sourceSkillId: parentB.id,
        targetSkillId: child.id,
        relationType: "contains",
      }),
    ).rejects.toThrow("Single-parent violation: Target skill already has a contains parent");
  });

  test("4. Anti-cycle DAG: Rejects prerequisite cycle (A -> B -> C -> A)", async () => {
    const act = await repo.addActivity({ rawInput: "Cycle test" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal({
        affected_skills: [
          { name: "SkillA", reason: "A" },
          { name: "SkillB", reason: "B" },
          { name: "SkillC", reason: "C" },
        ],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "SkillA",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Cycle test",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "create", proposedName: "SkillA" },
        name: "SkillA",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      relatedSkillResolutions: [
        { resolution: "create", proposedName: "SkillB" },
        { resolution: "create", proposedName: "SkillC" },
      ],
      player: { xpDelta: 20 },
    });

    const a = (await repo.getSkill("SkillA"))!;
    const b = (await repo.getSkill("SkillB"))!;
    const c = (await repo.getSkill("SkillC"))!;

    // A -> B
    await repo.addEdge({ sourceSkillId: a.id, targetSkillId: b.id, relationType: "prerequisite" });
    // B -> C
    await repo.addEdge({ sourceSkillId: b.id, targetSkillId: c.id, relationType: "prerequisite" });

    // C -> A (Cycle!)
    await expect(
      repo.addEdge({ sourceSkillId: c.id, targetSkillId: a.id, relationType: "prerequisite" }),
    ).rejects.toThrow("Cycle detected");
  });

  test("5. Supports relation: Allows mutual synergy (A supports B and B supports A)", async () => {
    const act = await repo.addActivity({ rawInput: "Math practice" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal({
        affected_skills: [{ name: "Math", reason: "Math" }],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "Math",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Math practice",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "create", proposedName: "Math" },
        name: "Math",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    });

    // Create Physics via second settlement
    const act2 = await repo.addActivity({ rawInput: "Physics practice" });
    const assess2 = await repo.addAssessment({
      activityId: act2.id,
      proposal: createMockProposal({
        affected_skills: [{ name: "Physics", reason: "Physics" }],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    await repo.applySettlement({
      assessmentId: assess2.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act2.id,
        assessmentId: assess2.id,
        xpType: "activity",
        skillId: "",
        skillName: "Physics",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Physics practice",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "create", proposedName: "Physics" },
        name: "Physics",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    });

    const math = (await repo.getSkill("Math"))!;
    const phys = (await repo.getSkill("Physics"))!;

    // Math -> Physics
    const edge1 = await repo.addEdge({ sourceSkillId: math.id, targetSkillId: phys.id, relationType: "supports" });
    expect(edge1.id).toBeDefined();

    // Physics -> Math (Mutual supports is allowed!)
    const edge2 = await repo.addEdge({ sourceSkillId: phys.id, targetSkillId: math.id, relationType: "supports" });
    expect(edge2.id).toBeDefined();
  });

  test("6. updateSkillMetadata: Rename preserves old name in aliases (Alias Conservation) and PATCH semantics", async () => {
    const act = await repo.addActivity({ rawInput: "Rename test" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal({
        affected_skills: [{ name: "TypeScript", reason: "TS" }],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "TypeScript",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Rename test",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "create", proposedName: "TypeScript" },
        name: "TypeScript",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    });

    const ts = (await repo.getSkill("TypeScript"))!;
    expect(ts.aliases).toEqual([]);

    // 1. Rename to "TypeScript Advanced" with description
    const updated = await repo.updateSkillMetadata(ts.id, {
      name: "TypeScript Advanced",
      description: "Advanced type gymnastics",
    });

    expect(updated.name).toBe("TypeScript Advanced");
    expect(updated.aliases).toContain("TypeScript"); // Old name preserved in aliases!
    expect(updated.description).toBe("Advanced type gymnastics");

    // 2. Explicit null for description
    const clearedDesc = await repo.updateSkillMetadata(ts.id, {
      description: null,
    });
    expect(clearedDesc.description).toBeNull();
    expect(clearedDesc.name).toBe("TypeScript Advanced"); // Omitted name remains untouched

    // Lookup by old name still finds the same skill
    const byOldName = await repo.getSkill("TypeScript");
    expect(byOldName?.id).toBe(ts.id);
  });

  test("7. Evidence persistence & MasteryAction 3-State Protocol", async () => {
    const act = await repo.addActivity({ rawInput: "Evidence test" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal({
        activity: { type: "production", completion: 0.95 },
        affected_skills: [{ name: "Architecture", reason: "Architecture" }],
        evidence: { level: 4, explanation: "Refactored to clean architecture with zero type escapes" },
        mastery_changes: [
          {
            target_type: "skill",
            target_name: "Architecture",
            from_level: 1,
            proposed_level: 4,
            confidence: 0.95,
            verification_required: true,
            reason: "M4 verification needed",
          },
        ],
      }),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    const settleRes = await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "Architecture",
        activityType: "production",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 50,
        baseAmount: 50,
        modifierJson: {},
        reason: "Clean architecture refactor",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 50,
      primarySkill: {
        skill: { resolution: "create", proposedName: "Architecture" },
        name: "Architecture",
        xpDelta: 50,
        masteryAction: {
          action: "request_verification",
          fromLevel: 1,
          toLevel: 4,
          confidence: 0.95,
        },
      },
      player: { xpDelta: 50 },
      evidence: {
        level: 4,
        type: "production",
        explanation: "Refactored to clean architecture with zero type escapes",
      },
      masteryVerification: {
        id: crypto.randomUUID(),
        skillId: "",
        skillName: "Architecture",
        fromLevel: 1,
        toLevel: 4,
        evidenceLevel: 4,
        status: "pending",
        proposalAssessmentId: assess.id,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      },
    });

    expect(settleRes.ok).toBe(true);
    expect(settleRes.masteryVerification?.status).toBe("pending");

    // Skill masteryLevel should NOT be immediately upgraded to 4 (requires verification)
    const skill = (await repo.getSkill("Architecture"))!;
    expect(skill.masteryLevel).toBe(1);

    // Evidence record should be persisted
    const evidenceList = await repo.listEvidenceRecords(skill.id);
    expect(evidenceList.length).toBe(1);
    expect(evidenceList[0].evidenceLevel).toBe(4);
    expect(evidenceList[0].evidenceType).toBe("production");
    expect(evidenceList[0].description).toBe("Refactored to clean architecture with zero type escapes");
  });

  test("8. Stable ID Authority: Missing skill resolution or invalid ID is rejected", async () => {
    const act = await repo.addActivity({ rawInput: "Stable ID test" });
    const assess = await repo.addAssessment({
      activityId: act.id,
      proposal: createMockProposal(),
      modelName: "test-model",
      promptVersion: "1.0",
    });

    // 1. Missing skill resolution input -> MUST REJECT
    const resNoResolution = await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "TypeScript",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Test",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        // @ts-expect-error test invalid resolution
        skill: undefined,
        name: "TypeScript",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    });
    expect(resNoResolution.ok).toBe(false);
    expect(resNoResolution.reason).toBe("missing_or_invalid_skill_resolution");

    // 2. Non-existent existing skill ID -> MUST REJECT
    const resBadId = await repo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "TypeScript",
        activityType: "skill",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Test",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "existing", skillId: "00000000-0000-4000-a000-000000000000" },
        name: "TypeScript",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    });
    expect(resBadId.ok).toBe(false);
    expect(resBadId.reason).toBe("skill_not_found_or_not_owned");
  });
});
