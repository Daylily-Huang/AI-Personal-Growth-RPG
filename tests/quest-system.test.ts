import { describe, expect, test, beforeEach } from "vitest";
import { DemoRepository } from "@/lib/store/demo-repository";
import { buildQuestTree, computeAggregatedProgress, syncParentQuestProgress } from "@/lib/store/quest.service";
import type { NewQuestInput } from "@/lib/store/types";
import type { AssessmentProposal } from "@/lib/ai/schemas";

function makeProposal(skillName: string, xpAmount: number): AssessmentProposal {
  return {
    activity: {
      type: "learning",
      completion: 0.8,
    },
    difficulty: {
      complexity: 0.5,
      uncertainty: 0.4,
      expertise_gap: 0.5,
      resistance: 0.3,
    },
    growth: {
      effort: 0.6,
      learning: 0.7,
      performance: 0.4,
      outcome: 0.5,
      artifact_value: 0.2,
      character_evidence: 0.1,
    },
    evidence: {
      level: 1,
      explanation: "Self-report",
    },
    affected_skills: [
      {
        name: skillName,
        reason: "Test skill",
      },
    ],
    knowledge_updates: {
      proposed_nodes: [],
      proposed_edges: [],
    },
    mastery_changes: [],
    xp_semantics: {
      base_value: xpAmount,
      difficulty: 0.5,
      mastery_gain: 0.5,
      novelty: 0.5,
      goal_alignment: 0.8,
      repetition_risk: "low",
    },
    artifacts: [],
    next_quest: null,
    confidence: 0.9,
    uncertainty_notes: [],
  };
}

describe("Stage 4 — Quest System Unit & Service Tests", () => {
  let repo: DemoRepository;

  beforeEach(async () => {
    repo = new DemoRepository();
    await repo.reset();
  });

  test("1. Basic Quest CRUD in Repository", async () => {
    const input: NewQuestInput = {
      title: "Master TypeScript Generics",
      description: "Learn advanced conditional types and mapped types",
      questType: "skill",
      questSize: "standard",
      difficulty: 0.6,
      goalAlignment: 0.9,
      isMainQuest: false,
      isBoss: false,
    };

    // 1. Create
    const quest = await repo.addQuest(input);
    expect(quest.id).toBeDefined();
    expect(quest.title).toBe("Master TypeScript Generics");
    expect(quest.questType).toBe("skill");
    expect(quest.questSize).toBe("standard");
    expect(quest.status).toBe("available");
    expect(quest.progress).toBe(0);

    // 2. Read single
    const fetched = await repo.getQuest(quest.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe(quest.title);

    // 3. List
    const all = await repo.listQuests();
    expect(all.length).toBe(1);

    // 4. Update
    const updated = await repo.updateQuest(quest.id, {
      status: "active",
      progress: 50,
    });
    expect(updated.status).toBe("active");
    expect(updated.progress).toBe(50);

    // 5. Delete
    await repo.deleteQuest(quest.id);
    const afterDelete = await repo.getQuest(quest.id);
    expect(afterDelete).toBeNull();
  });

  test("2. Quest Tree Building (Hierarchy) & Aggregation", async () => {
    // Create Root Main Quest
    const mainQuest = await repo.addQuest({
      title: "Graduate Thesis Defense",
      questType: "production",
      questSize: "main",
      isMainQuest: true,
      isBoss: true,
    });

    // Create Sub-quest 1
    const subQuest1 = await repo.addQuest({
      title: "Literature Review & Card System",
      parentQuestId: mainQuest.id,
      questType: "learning",
      questSize: "major",
      progress: 80,
    });

    // Create Sub-quest 2
    const subQuest2 = await repo.addQuest({
      title: "Fieldwork Data Analysis",
      parentQuestId: mainQuest.id,
      questType: "production",
      questSize: "major",
      progress: 40,
    });

    // Create Nested Sub-sub-quest
    const leafQuest = await repo.addQuest({
      title: "Capwire Preprocessing",
      parentQuestId: subQuest2.id,
      questType: "skill",
      questSize: "standard",
      progress: 60,
    });

    const allQuests = await repo.listQuests();
    const tree = buildQuestTree(allQuests);

    expect(tree.length).toBe(1);
    expect(tree[0].id).toBe(mainQuest.id);
    expect(tree[0].children.length).toBe(2);

    const sub1Node = tree[0].children.find((c) => c.id === subQuest1.id);
    expect(sub1Node).toBeDefined();

    const sub2Node = tree[0].children.find((c) => c.id === subQuest2.id);
    expect(sub2Node).toBeDefined();
    expect(sub2Node?.children.length).toBe(1);
    expect(sub2Node?.children[0].id).toBe(leafQuest.id);

    // Test computeAggregatedProgress
    const aggProgress = computeAggregatedProgress(tree[0]);
    expect(aggProgress).toBeGreaterThanOrEqual(0);
  });

  test("3. Quest Progress Aggregation (Leaf -> Parent -> Grandparent)", async () => {
    // Create Parent
    const parent = await repo.addQuest({
      title: "Parent Milestone",
      questType: "production",
      questSize: "epic",
      status: "available",
      progress: 0,
    });

    // Create Child A
    const childA = await repo.addQuest({
      title: "Child Task A",
      parentQuestId: parent.id,
      questType: "skill",
      progress: 100,
      status: "completed",
    });
    expect(childA.id).toBeDefined();

    // Create Child B
    const childB = await repo.addQuest({
      title: "Child Task B",
      parentQuestId: parent.id,
      questType: "learning",
      progress: 50,
      status: "active",
    });

    // Sync parent progress
    await syncParentQuestProgress(repo, parent.id);

    const updatedParent = await repo.getQuest(parent.id);
    expect(updatedParent).not.toBeNull();
    // Avg of 100 and 50 is 75
    expect(updatedParent?.progress).toBe(75);
    expect(updatedParent?.status).toBe("active");

    // Complete Child B
    await repo.updateQuest(childB.id, { progress: 100, status: "completed" });
    await syncParentQuestProgress(repo, parent.id);

    const completedParent = await repo.getQuest(parent.id);
    expect(completedParent?.progress).toBe(100);
    expect(completedParent?.status).toBe("completed");
  });

  test("4. Filter Quests by Status and isMain", async () => {
    await repo.addQuest({
      title: "Main Quest 1",
      questType: "production",
      isMainQuest: true,
      status: "active",
    });
    await repo.addQuest({
      title: "Side Quest 1",
      questType: "learning",
      isMainQuest: false,
      status: "active",
    });
    await repo.addQuest({
      title: "Finished Side Quest",
      questType: "skill",
      isMainQuest: false,
      status: "completed",
    });

    const mainQuests = await repo.listQuests({ isMain: true });
    expect(mainQuests.length).toBe(1);
    expect(mainQuests[0].title).toBe("Main Quest 1");

    const activeQuests = await repo.listQuests({ status: "active" });
    expect(activeQuests.length).toBe(2);

    const completedQuests = await repo.listQuests({ status: "completed" });
    expect(completedQuests.length).toBe(1);
  });

  test("5. Anti-Cycle Detection (A->A, A->B->A, A->B->C->A)", async () => {
    const questA = await repo.addQuest({
      title: "Quest A",
      questType: "learning",
    });
    const questB = await repo.addQuest({
      title: "Quest B",
      parentQuestId: questA.id,
      questType: "skill",
    });
    const questC = await repo.addQuest({
      title: "Quest C",
      parentQuestId: questB.id,
      questType: "production",
    });

    // 1. Self-parenting (A -> A)
    await expect(repo.updateQuest(questA.id, { parentQuestId: questA.id })).rejects.toThrow(
      "Self-parenting is forbidden",
    );

    // 2. Direct cycle (A -> B -> A)
    await expect(repo.updateQuest(questA.id, { parentQuestId: questB.id })).rejects.toThrow(
      "Cycle detected",
    );

    // 3. Indirect cycle (A -> B -> C -> A)
    await expect(repo.updateQuest(questA.id, { parentQuestId: questC.id })).rejects.toThrow(
      "Cycle detected",
    );
  });

  test("6. Growth Loop: Activity Settlement advances linked Quest & Parent Quest progress", async () => {
    // 1. Create Main Quest & Child Quest
    const mainQuest = await repo.addQuest({
      title: "Publish Ecology Thesis",
      questType: "production",
      questSize: "main",
      isMainQuest: true,
      status: "active",
      progress: 0,
    });

    const subQuest = await repo.addQuest({
      title: "Run Gel Electrophoresis PCR QC",
      parentQuestId: mainQuest.id,
      questType: "skill",
      questSize: "standard",
      status: "active",
      progress: 0,
    });

    // 2. Create Activity linked to subQuest
    const activity = await repo.addActivity({
      rawInput: "Completed PCR replicate run 3 and checked alleles",
      questId: subQuest.id,
      totalMinutes: 60,
      effectiveMinutes: 50,
    });
    expect(activity.questId).toBe(subQuest.id);

    // 3. Create Assessment
    const assessment = await repo.addAssessment({
      activityId: activity.id,
      modelName: "test-model",
      promptVersion: "v1",
      proposal: makeProposal("Genetics Lab", 50),
    });

    // 4. Confirm & Settle
    const { SettlementService } = await import("@/lib/store/settlement.service");
    const service = new SettlementService(repo);
    const result = await service.confirmAssessment(assessment.id);
    expect(result.ok).toBe(true);

    // 5. Verify SubQuest and MainQuest progress advanced
    const updatedSub = await repo.getQuest(subQuest.id);
    expect(updatedSub?.progress).toBeGreaterThan(0);

    const updatedMain = await repo.getQuest(mainQuest.id);
    expect(updatedMain?.progress).toBe(updatedSub?.progress);
  });

  test("7. Unrelated Activity does NOT advance Boss Quest HP / Progress", async () => {
    // Boss Quest
    const bossQuest = await repo.addQuest({
      title: "Defeat Final Defense Panel (Boss)",
      questType: "production",
      questSize: "epic",
      isMainQuest: true,
      isBoss: true,
      status: "active",
      progress: 20,
    });

    // Unrelated activity with NO linked quest
    const activity = await repo.addActivity({
      rawInput: "Casual reading of news articles",
      totalMinutes: 30,
      effectiveMinutes: 20,
    });

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      modelName: "test-model",
      promptVersion: "v1",
      proposal: makeProposal("General Reading", 10),
    });

    const { SettlementService } = await import("@/lib/store/settlement.service");
    const service = new SettlementService(repo);
    await service.confirmAssessment(assessment.id);

    // Boss Quest progress should remain unchanged at 20%
    const currentBoss = await repo.getQuest(bossQuest.id);
    expect(currentBoss?.progress).toBe(20);
  });

  test("8. Failed Quest does NOT rollback settled Learning XP / Ledger", async () => {
    const quest = await repo.addQuest({
      title: "Try Difficult Coding Challenge",
      questType: "learning",
      questSize: "standard",
      status: "active",
      progress: 0,
    });

    // Settle an activity linked to this quest
    const activity = await repo.addActivity({
      rawInput: "Studied dynamic programming for 45 minutes",
      questId: quest.id,
      totalMinutes: 45,
      effectiveMinutes: 40,
    });

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      modelName: "test-model",
      promptVersion: "v1",
      proposal: makeProposal("Algorithms", 40),
    });

    const { SettlementService } = await import("@/lib/store/settlement.service");
    const service = new SettlementService(repo);
    await service.confirmAssessment(assessment.id);

    const playerBeforeFail = await repo.getPlayer();
    expect(playerBeforeFail.totalXp).toBeGreaterThan(0);
    const txBeforeFail = await repo.listTransactions();
    expect(txBeforeFail.length).toBe(1);

    // Fail the quest
    await repo.updateQuest(quest.id, { status: "failed" });
    const failedQuest = await repo.getQuest(quest.id);
    expect(failedQuest?.status).toBe("failed");

    // Settled XP and transactions are strictly immutable and NOT rolled back
    const playerAfterFail = await repo.getPlayer();
    expect(playerAfterFail.totalXp).toBe(playerBeforeFail.totalXp);
    const txAfterFail = await repo.listTransactions();
    expect(txAfterFail.length).toBe(1);
    expect(txAfterFail[0].amount).toBe(txBeforeFail[0].amount);
  });

  test("9. P1-1: Parent progress anti-spoofing in DemoRepository", async () => {
    const parent = await repo.addQuest({
      title: "Parent Quest",
      questType: "production",
      status: "active",
      progress: 0,
    });
    await repo.addQuest({
      title: "Child 1",
      parentQuestId: parent.id,
      questType: "skill",
      progress: 20,
    });
    await repo.addQuest({
      title: "Child 2",
      parentQuestId: parent.id,
      questType: "skill",
      progress: 40,
    });

    const parentBefore = await repo.getQuest(parent.id);
    expect(parentBefore?.progress).toBe(30);

    // Client attempts to spoof progress = 100 on parent
    const spoofed = await repo.updateQuest(parent.id, { progress: 100, status: "completed" });
    expect(spoofed.progress).toBe(30);
    expect(spoofed.status).toBe("active");
  });

  test("10. P1-2: Deleting parent unlinks children (ON DELETE SET NULL)", async () => {
    const parent = await repo.addQuest({
      title: "Parent to Delete",
      questType: "learning",
    });
    const child = await repo.addQuest({
      title: "Child Quest",
      parentQuestId: parent.id,
      questType: "skill",
    });

    await repo.deleteQuest(parent.id);
    const orphan = await repo.getQuest(child.id);
    expect(orphan).toBeDefined();
    expect(orphan?.parentQuestId).toBeNull();
  });

  test("11. P1-3: Reparenting recomputes progress on OLD and NEW parents in DemoRepository", async () => {
    const pA = await repo.addQuest({ title: "Parent A", questType: "production" });
    const pB = await repo.addQuest({ title: "Parent B", questType: "production" });

    await repo.addQuest({ parentQuestId: pA.id, title: "Child 1", questType: "skill", progress: 60 });
    const c2 = await repo.addQuest({ parentQuestId: pA.id, title: "Child 2", questType: "skill", progress: 100 });

    const pABefore = await repo.getQuest(pA.id);
    expect(pABefore?.progress).toBe(80);

    // Move c2 to pB
    await repo.updateQuest(c2.id, { parentQuestId: pB.id });

    const pAAfter = await repo.getQuest(pA.id);
    expect(pAAfter?.progress).toBe(60);

    const pBAfter = await repo.getQuest(pB.id);
    expect(pBAfter?.progress).toBe(100);
  });

  test("12. P1-5: Activity freezes questSizeSnapshot and Settlement records questSize and questCap in modifierJson", async () => {
    const epicQuest = await repo.addQuest({
      title: "Epic Migration",
      questType: "production",
      questSize: "epic",
    });

    const activity = await repo.addActivity({
      rawInput: "Migrated whole auth cluster",
      questId: epicQuest.id,
      totalMinutes: 120,
      effectiveMinutes: 90,
    });
    expect(activity.questSizeSnapshot).toBe("epic");

    // Later the user downgrades the quest to micro
    await repo.updateQuest(epicQuest.id, { questSize: "micro" });

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      modelName: "test-model",
      promptVersion: "v1",
      proposal: makeProposal("System Architecture", 80),
    });

    const { SettlementService } = await import("@/lib/store/settlement.service");
    const service = new SettlementService(repo);
    const settleResult = await service.confirmAssessment(assessment.id);
    expect(settleResult.ok).toBe(true);

    const txs = await repo.listTransactions();
    expect(txs.length).toBe(1);
    expect(txs[0].modifierJson.questSize).toBe("epic");
    expect(txs[0].modifierJson.questCap).toBe(800);
  });

  test("13. P2-2: Archived or Failed Quest does NOT advance progress during settlement", async () => {
    const failedQuest = await repo.addQuest({
      title: "Failing quest",
      questType: "learning",
      status: "failed",
      progress: 10,
    });

    const activity = await repo.addActivity({
      rawInput: "Reflected on reasons for failure",
      questId: failedQuest.id,
      totalMinutes: 30,
      effectiveMinutes: 30,
    });

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      modelName: "test-model",
      promptVersion: "v1",
      proposal: makeProposal("Reflection", 30),
    });

    const { SettlementService } = await import("@/lib/store/settlement.service");
    const service = new SettlementService(repo);
    await service.confirmAssessment(assessment.id);

    const afterQuest = await repo.getQuest(failedQuest.id);
    expect(afterQuest?.status).toBe("failed");
    expect(afterQuest?.progress).toBe(10);
  });
});
