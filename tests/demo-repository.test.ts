import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DemoRepository } from "@/lib/store/demo-repository";
import type { SettlementToApply } from "@/lib/store/types";
import type { AssessmentProposal } from "@/lib/ai/schemas";
import { RULES_VERSION } from "@/lib/growth-engine/xp";

let tempDir: string;
let dbFile: string;
let repo: DemoRepository;

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
  confidence: 0.7,
  uncertainty_notes: [],
};

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-rpg-corr-"));
  dbFile = path.join(tempDir, "demo.json");
  process.env.DEMO_DB_PATH = dbFile;
  repo = new DemoRepository();
  await repo.reset();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DEMO_DB_PATH;
});

describe("DemoRepository corruption safety (Round4 item)", () => {
  test("missing file -> fresh empty world", () => {
    const db = repo.readDb();
    expect(db.activities).toEqual([]);
    expect(db.transactions).toEqual([]);
    expect(db.player.totalXp).toBe(0);
  });

  test("invalid JSON -> throws, original kept, backup created, NOT overwritten", () => {
    const garbage = "this is {{ not json";
    fs.writeFileSync(dbFile, garbage, "utf8");

    expect(() => repo.readDb()).toThrow();

    // Original file untouched.
    expect(fs.readFileSync(dbFile, "utf8")).toBe(garbage);

    // Backup exists.
    const backups = fs.readdirSync(tempDir).filter((f) => f.startsWith("demo.json.corrupt-"));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(tempDir, backups[0]), "utf8")).toBe(garbage);
  });

  test("invalid shape -> throws and keeps original", () => {
    fs.writeFileSync(dbFile, JSON.stringify({ version: 99, hello: "world" }), "utf8");

    expect(() => repo.readDb()).toThrow();

    const backups = fs.readdirSync(tempDir).filter((f) => f.startsWith("demo.json.corrupt-"));
    expect(backups).toHaveLength(1);
  });

  test("legacy v1 file without masteryVerifications is tolerated", async () => {
    fs.writeFileSync(
      dbFile,
      JSON.stringify({
        version: 1,
        activities: [],
        assessments: [],
        transactions: [],
        skills: {},
        skillEdges: [],
        player: { totalXp: 5, playerLevel: 1, energy: 70, focus: 70, momentum: 30 },
      }),
      "utf8",
    );

    const db = repo.readDb();
    expect(db.masteryVerifications).toEqual([]);
    expect(db.player.totalXp).toBe(5);

    const p = await repo.getPlayer();
    expect(p.totalXp).toBe(5);
  });
});

describe("Milestone 2.7 — settlement integrity guards (store-level)", () => {
  async function makePendingAssessment(activityId: string) {
    return repo.addAssessment({
      activityId,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
  }

  function buildSettlement(input: {
    assessment: Awaited<ReturnType<typeof repo.addAssessment>>;
    activityId: string;
    skillId: string;
    skillName?: string;
    repetitionCount?: number;
    masteryVerification?: SettlementToApply["masteryVerification"];
  }): SettlementToApply {
    const name = input.skillName ?? "Statistics";
    return {
      assessmentId: input.assessment.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: input.activityId,
        assessmentId: input.assessment.id,
        xpType: "activity",
        skillId: input.skillId,
        skillName: name,
        activityType: "learning",
        repetitionCount: input.repetitionCount ?? 0,
        repetitionPenalty: 1,
        amount: 10,
        baseAmount: 10,
        modifierJson: {},
        reason: "test",
        rulesVersion: RULES_VERSION,
        createdAt: new Date().toISOString(),
      },
      xpDelta: 10,
      primarySkill: {
        id: input.skillId,
        name,
        xpDelta: 10,
        masteryAction: { action: "none" },
      },
      relatedSkillNames: [],
      newEdges: [],
      player: { xpDelta: 10 },
      masteryVerification: input.masteryVerification,
    };
  }

  test("stable skill id: same label twice -> same id", async () => {
    const id1 = await repo.resolveSkillId("Statistics");
    const id2 = await repo.resolveSkillId("Statistics");
    expect(id1).toBe(id2);
    expect(id1.startsWith("skill-")).toBe(true);
  });

  test("stale repetition snapshot is rejected (repetition_conflict) and nothing is written", async () => {
    const activity = await repo.addActivity({ rawInput: "x" });
    const assessment = await makePendingAssessment(activity.id);
    const settlement = buildSettlement({ assessment, activityId: activity.id, skillId: "skill-a", repetitionCount: 5 });

    const res = await repo.applySettlement(settlement);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("repetition_conflict");
    expect(res.actualRepetitionCount).toBe(0); // the fresh authoritative count

    expect(await repo.listTransactions()).toHaveLength(0);
    expect((await repo.getPlayer()).totalXp).toBe(0);
  });

  test("second activity settlement for the same Activity is rejected (already_settled)", async () => {
    const activity = await repo.addActivity({ rawInput: "one activity" });
    const s1 = await makePendingAssessment(activity.id);
    const ok1 = await repo.applySettlement(buildSettlement({ assessment: s1, activityId: activity.id, skillId: "skill-a" }));
    expect(ok1.ok).toBe(true);

    const s2 = await makePendingAssessment(activity.id); // revision
    const ok2 = await repo.applySettlement(buildSettlement({ assessment: s2, activityId: activity.id, skillId: "skill-a" }));
    expect(ok2.ok).toBe(false);
    expect(ok2.reason).toBe("already_settled");

    expect(await repo.listTransactions()).toHaveLength(1);
  });

  test("at most one pending mastery verification per skill", async () => {
    const activityA = await repo.addActivity({ rawInput: "A" });
    const sA = await makePendingAssessment(activityA.id);
    const v = (skillId: string): SettlementToApply["masteryVerification"] => ({
      id: crypto.randomUUID(),
      skillId,
      skillName: "Statistics",
      fromLevel: 1,
      toLevel: 5,
      evidenceLevel: 4,
      status: "pending",
      proposalAssessmentId: sA.id,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });

    const okA = await repo.applySettlement(
      buildSettlement({ assessment: sA, activityId: activityA.id, skillId: "skill-a", masteryVerification: v("skill-a") }),
    );
    expect(okA.ok).toBe(true);

    // Second activity, same skill + same type → must carry repetitionCount=1,
    // and its pending verification is deduped (skipped).
    const activityB = await repo.addActivity({ rawInput: "B" });
    const sB = await makePendingAssessment(activityB.id);
    const okB = await repo.applySettlement(
      buildSettlement({ assessment: sB, activityId: activityB.id, skillId: "skill-a", repetitionCount: 1, masteryVerification: v("skill-a") }),
    );
    expect(okB.ok).toBe(true);

    const pending = (await repo.listMasteryVerifications()).filter((x) => x.status === "pending");
    expect(pending).toHaveLength(1);
  });
});
