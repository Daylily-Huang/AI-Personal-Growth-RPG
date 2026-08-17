import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DemoRepository } from "@/lib/store/demo-repository";
import { ActivityAlreadySettledError } from "@/lib/store/errors";
import type { SettlementToApply, Assessment } from "@/lib/store/types";
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
    expect(fs.readFileSync(dbFile, "utf8")).toBe(garbage);

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
});

describe("Milestone 2.7/Preflight — settlement guards & skill identity (store-level)", () => {
  async function makePendingAssessment(activityId: string) {
    return repo.addAssessment({
      activityId,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
  }

  function buildSettlement(input: {
    assessment: { id: string };
    activityId: string;
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
        skillId: "",
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
      primarySkill: { name, xpDelta: 10, masteryAction: { action: "none" } },
      relatedSkillLabels: [],
      player: { xpDelta: 10 },
      masteryVerification: input.masteryVerification,
    };
  }

  test("lookupSkillId is READ-ONLY (unknown -> null, never creates)", async () => {
    expect(await repo.lookupSkillId("Statistics")).toBe(null);
    expect((await repo.listSkills()).length).toBe(0);
  });

  test("skill ids are stable UUIDs + normalized label lookup prevents overwrite", async () => {
    const activity = await repo.addActivity({ rawInput: "one" });
    const s1 = await makePendingAssessment(activity.id);
    const res = await repo.applySettlement(
      buildSettlement({ assessment: s1, activityId: activity.id, skillName: "Regression Analysis" }),
    );
    expect(res.ok).toBe(true);
    expect(res.skillId).toMatch(/^[0-9a-f-]{36}$/); // UUID identity, not a slug

    // Case + whitespace + alias normalization all resolve to the SAME id.
    const idA = await repo.lookupSkillId("Regression Analysis");
    const idB = await repo.lookupSkillId("Regression   Analysis");
    const idC = await repo.lookupSkillId("regression analysis");
    expect(idA).toBe(res.skillId);
    expect(idB).toBe(idA);
    expect(idC).toBe(idA);

    // The skill state was NOT reset by a later lookup/normalization.
    const skill = await repo.getSkill("regression analysis");
    expect(skill?.xp).toBe(10);
    expect(skill?.id).toBe(res.skillId);
  });

  test("stale repetition snapshot is rejected (repetition_conflict) and nothing is written", async () => {
    const activity = await repo.addActivity({ rawInput: "x" });
    const assessment = await makePendingAssessment(activity.id);
    const settlement = buildSettlement({ assessment, activityId: activity.id, repetitionCount: 5 });

    const res = await repo.applySettlement(settlement);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("repetition_conflict");
    expect(res.actualRepetitionCount).toBe(0);

    expect(await repo.listTransactions()).toHaveLength(0);
    expect((await repo.getPlayer()).totalXp).toBe(0);
  });

  test("re-assessing a confirmed Activity is rejected (option B: no zombie revisions)", async () => {
    const activity = await repo.addActivity({ rawInput: "one activity" });
    const s1 = await makePendingAssessment(activity.id);
    const ok1 = await repo.applySettlement(buildSettlement({ assessment: s1, activityId: activity.id }));
    expect(ok1.ok).toBe(true);

    await expect(makePendingAssessment(activity.id)).rejects.toBeInstanceOf(ActivityAlreadySettledError);
    expect(await repo.listTransactions()).toHaveLength(1);
  });

  test("applySettlement already_settled guard still works as defense-in-depth", async () => {
    const activity = await repo.addActivity({ rawInput: "one activity" });
    const s1 = await makePendingAssessment(activity.id);
    await repo.applySettlement(buildSettlement({ assessment: s1, activityId: activity.id }));

    // Fabricate a pending assessment on the (already-confirmed) activity to
    // prove the store-level guard rejects a second activity settlement even if
    // something bypassed the app layer.
    const fabricated = {
      id: "fabricated-pending",
      activityId: activity.id,
      status: "pending" as const,
      proposal,
      modelName: "test",
      promptVersion: "test",
      rulesVersion: RULES_VERSION,
      confidence: 0.7,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    } satisfies Assessment;
    const raw = JSON.parse(fs.readFileSync(dbFile, "utf8"));
    raw.assessments.unshift(fabricated);
    fs.writeFileSync(dbFile, JSON.stringify(raw));

    const res = await repo.applySettlement(buildSettlement({ assessment: fabricated, activityId: activity.id }));
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("already_settled");
    expect(await repo.listTransactions()).toHaveLength(1);
  });

  test("pre-confirm revision is superseded when one is confirmed (no zombie pending)", async () => {
    const activity = await repo.addActivity({ rawInput: "one activity" });
    const s1 = await makePendingAssessment(activity.id);
    const s2 = await makePendingAssessment(activity.id); // revision while still assessed

    const ok = await repo.applySettlement(buildSettlement({ assessment: s1, activityId: activity.id }));
    expect(ok.ok).toBe(true);

    const assessments = repo.readDb().assessments;
    expect(assessments.find((a) => a.id === s1.id)?.status).toBe("confirmed");
    expect(assessments.find((a) => a.id === s2.id)?.status).toBe("superseded");

    expect((await repo.listPendingAssessments()).map((a) => a.id)).not.toContain(s2.id);
  });

  test("assessment inherits the Activity frozen rulesVersion (not engine current)", async () => {
    const activity = await repo.addActivity({ rawInput: "旧活动" });
    const db = repo.readDb();
    db.activities[0]!.rulesVersion = "legacy-v0"; // simulate an activity minted under an older engine
    fs.writeFileSync(dbFile, JSON.stringify(db));

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "test-prompt",
    });
    expect(assessment.rulesVersion).toBe("legacy-v0");
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
      buildSettlement({ assessment: sA, activityId: activityA.id, masteryVerification: v("") }),
    );
    expect(okA.ok).toBe(true);
    expect(okA.masteryVerification?.status).toBe("pending");

    // Second activity, same skill + same type → count=1, verification deduped.
    const activityB = await repo.addActivity({ rawInput: "B" });
    const sB = await makePendingAssessment(activityB.id);
    const okB = await repo.applySettlement(
      buildSettlement({ assessment: sB, activityId: activityB.id, repetitionCount: 1, masteryVerification: v("") }),
    );
    expect(okB.ok).toBe(true);

    // Authoritative return: the EXISTING pending verification (not a new phantom id).
    expect(okB.masteryVerification?.id).toBe(okA.masteryVerification?.id);

    const pending = (await repo.listMasteryVerifications()).filter((x) => x.status === "pending");
    expect(pending).toHaveLength(1);
  });
});
