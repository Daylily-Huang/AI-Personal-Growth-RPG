import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DemoRepository } from "@/lib/store/demo-repository";
import { SettlementService } from "@/lib/store/settlement.service";
import { buildDashboardSnapshot } from "@/lib/store/dashboard.service";
import type { AssessmentProposal } from "@/lib/ai/schemas";

let tempDir: string;
let repo: DemoRepository;
let service: SettlementService;

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

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-rpg-service-"));
  process.env.DEMO_DB_PATH = path.join(tempDir, "demo.json");
  repo = new DemoRepository();
  service = new SettlementService(repo);
  await repo.reset();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DEMO_DB_PATH;
});

describe("Milestone 2.5/2.6 — SettlementService speaks to the Repository port", () => {
  test("settlement through service+repo produces one ledger entry", async () => {
    const activity = await repo.addActivity({ rawInput: "用统计完成一个分析任务" });
    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });

    const result = await service.confirmAssessment(assessment.id);
    expect(result.ok).toBe(true);
    expect(result.transaction?.amount).toBeGreaterThan(0);
    expect(result.transaction?.repetitionCount).toBe(0);
    expect(await repo.listTransactions()).toHaveLength(1);

    const second = await service.confirmAssessment(assessment.id);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("already_confirmed");
    expect(await repo.listTransactions()).toHaveLength(1);
  });

  test("dashboard read model composes from the repository", async () => {
    const activity = await repo.addActivity({ rawInput: "完成一次动手实验" });
    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    await service.confirmAssessment(assessment.id);

    const dash = await buildDashboardSnapshot(repo);
    expect(dash.recentGrowth).toHaveLength(1);
    expect(dash.skills.some((s) => s.name === "Statistics")).toBe(true);
    expect(dash.player.totalXp).toBeGreaterThan(0);
  });
});

describe("Milestone 2.6 — mastery verification via service", () => {
  test("delta settlement keeps player/skill xp consistent", async () => {
    const activity = await repo.addActivity({ rawInput: "一项举重若轻的练习" });
    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    const result = await service.confirmAssessment(assessment.id);
    expect(result.ok).toBe(true);

    const player = await repo.getPlayer();
    const transactions = await repo.listTransactions();
    const ledgerSum = transactions.reduce((s, t) => s + t.amount, 0);
    expect(player.totalXp).toBe(ledgerSum);

    const skill = await repo.getSkill("Statistics");
    expect(skill?.xp).toBe(transactions[0].amount);
  });

  test("verification-required upgrade is recorded as pending, not applied", async () => {
    const bigProposal: AssessmentProposal = {
      ...proposal,
      evidence: { level: 4, explanation: "real application" },
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
    const activity = await repo.addActivity({ rawInput: "大跨度 Mastery 提议" });
    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal: bigProposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });

    const result = await service.confirmAssessment(assessment.id);
    expect(result.ok).toBe(true);
    expect(result.masteryVerification).toBeDefined();

    const skill = await repo.getSkill("Statistics");
    expect(skill?.masteryLevel).toBe(1); // NOT upgraded

    const verifications = await repo.listMasteryVerifications();
    expect(verifications).toHaveLength(1);
    expect(verifications[0].toLevel).toBe(5);
    expect(verifications[0].status).toBe("pending");
  });
});
