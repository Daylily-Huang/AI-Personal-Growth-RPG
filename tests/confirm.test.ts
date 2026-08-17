import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  confirmAssessment,
  createActivity,
  createAssessment,
  getDashboard,
  readDb,
  resetDemoDb,
} from "@/lib/store/demo-db";
import type { AssessmentProposal } from "@/lib/ai/schemas";
import { RULES_VERSION } from "@/lib/growth-engine/xp";

let tempDir: string;

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-rpg-"));
  process.env.DEMO_DB_PATH = path.join(tempDir, "demo.json");
  await resetDemoDb();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DEMO_DB_PATH;
});

const proposal: AssessmentProposal = {
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
  evidence: { level: 2, explanation: "correct explanation" },
  affected_skills: [{ name: "Statistics", reason: "used statistics" }],
  knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
  mastery_changes: [
    {
      target_type: "skill",
      target_name: "Statistics",
      from_level: 1,
      proposed_level: 3,
      confidence: 0.7,
      verification_required: true,
      reason: "evidence supports recall/explain",
    },
  ],
  xp_semantics: {
    base_value: 20,
    difficulty: 0.5,
    mastery_gain: 0.5,
    novelty: 0.5,
    goal_alignment: 0.6,
    repetition_risk: "low",
  },
  artifacts: [],
  next_quest: { title: "Apply to real data", reason: "verify mastery" },
  confidence: 0.7,
  uncertainty_notes: [],
};

async function confirmActivity(p: AssessmentProposal, rawInput: string) {
  const activity = await createActivity({ rawInput });
  const assessment = await createAssessment({
    activityId: activity.id,
    proposal: p,
    modelName: "test-model",
    promptVersion: "test-prompt",
  });
  return confirmAssessment(assessment.id);
}

/** Skills are keyed by stable id in the store; look up by display name. */
function skillByName(name: string) {
  return Object.values(readDb().skills).find((s) => s.name === name);
}

describe("confirmAssessment idempotency", () => {
  test("second confirm does not add XP twice", async () => {
    const activity = await createActivity({ rawInput: "读了一篇统计论文并理解了回归" });
    const assessment = await createAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });

    const first = await confirmAssessment(assessment.id);
    expect(first.ok).toBe(true);
    expect(first.transaction?.amount).toBeGreaterThan(0);

    const dbAfterFirst = readDb();
    expect(dbAfterFirst.transactions).toHaveLength(1);

    const second = await confirmAssessment(assessment.id);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("already_confirmed");

    const dbAfterSecond = readDb();
    expect(dbAfterSecond.transactions).toHaveLength(1);

    const dashboard = await getDashboard();
    expect(dashboard.player.totalXp).toBe(first.transaction!.amount);
  });

  test("rules version is recorded on transaction", async () => {
    const activity = await createActivity({ rawInput: "完成一个实际分析任务" });
    const assessment = await createAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });

    const result = await confirmAssessment(assessment.id);
    expect(result.transaction?.rulesVersion).toBe(RULES_VERSION);
  });

  test("different activity type of the same skill does NOT trigger repetition penalty", async () => {
    const learningActivity = await createActivity({ rawInput: "读统计论文" });
    const learningAssessment = await createAssessment({
      activityId: learningActivity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    const learning = await confirmAssessment(learningAssessment.id);
    expect(learning.transaction?.modifierJson?.repetitionPenalty).toBe(1);

    const productionProposal: AssessmentProposal = {
      ...proposal,
      activity: { ...proposal.activity, type: "production" },
    };
    const productionActivity = await createActivity({ rawInput: "用统计完成一个实际分析产出" });
    const productionAssessment = await createAssessment({
      activityId: productionActivity.id,
      proposal: productionProposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    const production = await confirmAssessment(productionAssessment.id);

    expect(production.transaction?.activityType).toBe("production");
    expect(production.transaction?.repetitionCount).toBe(0);
    expect(production.transaction?.repetitionPenalty).toBe(1);
  });

  test("same skill + same activity type DOES trigger repetition penalty", async () => {
    const seed = await confirmActivity(proposal, "读统计论文 #1");
    expect(seed.transaction?.repetitionCount).toBe(0);
    expect(seed.transaction?.repetitionPenalty).toBe(1);

    const repeat = await confirmActivity(proposal, "读统计论文 #2");
    expect(repeat.transaction?.repetitionCount).toBe(1);
    expect(repeat.transaction?.repetitionPenalty).toBeLessThan(1);

    const db = readDb();
    expect(db.transactions).toHaveLength(2);
  });

  test("concurrent confirm calls settle exactly one transaction", async () => {
    const activity = await createActivity({ rawInput: "并发确认的统计学习" });
    const assessment = await createAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });

    const results = await Promise.all([
      confirmAssessment(assessment.id),
      confirmAssessment(assessment.id),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "already_confirmed")).toHaveLength(1);

    const db = readDb();
    expect(db.transactions).toHaveLength(1);
  });
});

describe("Mastery verification is enforced (Round4 P1)", () => {
  test("immediate allowed upgrade is applied", async () => {
    const smallProposal: AssessmentProposal = {
      ...proposal,
      evidence: { level: 1, explanation: "summarized the material" },
      mastery_changes: [
        {
          target_type: "skill",
          target_name: "Statistics",
          from_level: 1,
          proposed_level: 2,
          confidence: 0.8,
          verification_required: false,
          reason: "E1 supports a small step",
        },
      ],
    };
    const result = await confirmActivity(smallProposal, "总结一篇统计材料");
    expect(result.ok).toBe(true);
    expect(result.masteryVerification).toBeUndefined();

    const skill = skillByName("Statistics");
    expect(skill?.masteryLevel).toBe(2);
  });

  test("large jump requiring verification is NOT auto-granted + creates pending verification", async () => {
    const bigProposal: AssessmentProposal = {
      ...proposal,
      evidence: { level: 4, explanation: "applied in a real analysis" },
      mastery_changes: [
        {
          target_type: "skill",
          target_name: "Statistics",
          from_level: 1,
          proposed_level: 5,
          confidence: 0.7,
          verification_required: true,
          reason: "M5 requires verification",
        },
      ],
    };
    const result = await confirmActivity(bigProposal, "大跨度 Mastery 提议");
    expect(result.ok).toBe(true);
    expect(result.masteryVerification).toBeDefined();
    expect(result.masteryVerification?.status).toBe("pending");
    expect(result.masteryVerification?.toLevel).toBe(5);

    // Skill is NOT upgraded yet.
    const skill = skillByName("Statistics");
    expect(skill?.masteryLevel).toBe(1);

    // Pending verification is persisted.
    const db = readDb();
    expect(db.masteryVerifications).toHaveLength(1);
    expect(db.masteryVerifications[0].skillName).toBe("Statistics");
  });
});

describe("Milestone 2.7 — settlement integrity", () => {
  test("one Activity => at most ONE original activity settlement (no re-assess after confirm)", async () => {
    const activity = await createActivity({ rawInput: "同一次活动先评后复评" });
    const firstAssessment = await createAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    const first = await confirmAssessment(firstAssessment.id);
    expect(first.ok).toBe(true);
    const xpAfterFirst = readDb().player.totalXp;

    // Round6 (option B): a confirmed Activity cannot be re-assessed.
    await expect(
      createAssessment({
        activityId: activity.id,
        proposal,
        modelName: "test-model",
        promptVersion: "test-prompt",
      }),
    ).rejects.toThrow();

    const db = readDb();
    expect(db.assessments).toHaveLength(1); // no zombie revision minted
    expect(db.transactions).toHaveLength(1); // exactly one ledger entry
    expect(db.player.totalXp).toBe(xpAfterFirst); // no duplicate XP
    expect(db.transactions[0].xpType).toBe("activity");
  });

  test("pre-confirm revision is superseded when one assessment is confirmed", async () => {
    const activity = await createActivity({ rawInput: "先有多份评估再确认" });
    const s1 = await createAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    const s2 = await createAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });

    const confirmed = await confirmAssessment(s1.id);
    expect(confirmed.ok).toBe(true);

    const db = readDb();
    expect(db.assessments.find((a) => a.id === s1.id)?.status).toBe("confirmed");
    expect(db.assessments.find((a) => a.id === s2.id)?.status).toBe("superseded");
    expect(db.transactions).toHaveLength(1);

    // The superseded revision is gone from the pending queue (no zombie).
    const dashboard = await getDashboard();
    expect(dashboard.pendingAssessments.map((a) => a.id)).not.toContain(s2.id);
  });

  test("ledger records frozen rulesVersion from the Activity", async () => {
    const activity = await createActivity({ rawInput: "规则版本冻结测试" });
    const assessment = await createAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    expect(activity.rulesVersion).toBe(RULES_VERSION);

    const result = await confirmAssessment(assessment.id);
    expect(result.transaction?.rulesVersion).toBe(activity.rulesVersion);
    expect(result.transaction?.rulesVersion).toBe(RULES_VERSION);
  });

  test("primary-only skill policy: only the primary skill gets XP", async () => {
    const multiSkill: AssessmentProposal = {
      ...proposal,
      affected_skills: [
        { name: "Statistics", reason: "primary" },
        { name: "R", reason: "secondary" },
      ],
    };
    const activity = await createActivity({ rawInput: "用 R 做统计分析" });
    const assessment = await createAssessment({
      activityId: activity.id,
      proposal: multiSkill,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    const result = await confirmAssessment(assessment.id);
    expect(result.ok).toBe(true);

    const db = readDb();
    // Exactly one XP transaction → primary skill only.
    expect(db.transactions).toHaveLength(1);
    expect(result.transaction?.skillName).toBe("Statistics");

    const secondary = skillByName("R");
    expect(secondary).toBeDefined(); // node exists for the skill tree
    expect(secondary?.xp).toBe(0); // but zero XP
    expect(secondary?.masteryLevel).toBe(1);
  });

  test("same skill label resolves to one stable skill id across activities", async () => {
    const a1 = await confirmActivity(proposal, "统计第一课");
    const a2 = await confirmActivity(proposal, "统计第二课（同技能，同类）");
    expect(a1.ok && a2.ok).toBe(true);
    expect(a2.transaction?.skillId).toBe(a1.transaction?.skillId);
    expect(a2.transaction?.repetitionCount).toBe(1); // same skill + same type
  });
});
