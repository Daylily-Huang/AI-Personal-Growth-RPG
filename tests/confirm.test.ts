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

    const skill = readDb().skills["Statistics"];
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
    const skill = readDb().skills["Statistics"];
    expect(skill?.masteryLevel).toBe(1);

    // Pending verification is persisted.
    const db = readDb();
    expect(db.masteryVerifications).toHaveLength(1);
    expect(db.masteryVerifications[0].skillName).toBe("Statistics");
  });
});
