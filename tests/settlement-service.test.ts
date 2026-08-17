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
      verification_required: false,
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

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-rpg-service-"));
  process.env.DEMO_DB_PATH = path.join(tempDir, "demo.json");
  repo = new DemoRepository();
  service = new SettlementService(repo);
  repo.reset();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DEMO_DB_PATH;
});

describe("Milestone 2.5 — SettlementService speaks to the Repository port", () => {
  test("settlement through service+repo produces one ledger entry", () => {
    const activity = repo.addActivity({ rawInput: "用统计完成一个分析任务" });
    const assessment = repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });

    const result = service.confirmAssessment(assessment.id);
    expect(result.ok).toBe(true);
    expect(result.transaction?.amount).toBeGreaterThan(0);
    expect(result.transaction?.repetitionCount).toBe(0);
    expect(repo.listTransactions()).toHaveLength(1);

    // idempotent via the service
    const second = service.confirmAssessment(assessment.id);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("already_confirmed");
    expect(repo.listTransactions()).toHaveLength(1);
  });

  test("dashboard read model composes from the repository", () => {
    const activity = repo.addActivity({ rawInput: "完成一次动手实验" });
    const assessment = repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    service.confirmAssessment(assessment.id);

    const dash = buildDashboardSnapshot(repo);
    expect(dash.recentGrowth).toHaveLength(1);
    expect(dash.skills.some((s) => s.name === "Statistics")).toBe(true);
    expect(dash.player.totalXp).toBeGreaterThan(0);
  });
});
