import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  confirmAssessment,
  createActivity,
  createAssessment,
  readDb,
  resetDemoDb,
} from "@/lib/store/demo-db";
import { calculateXp } from "@/lib/growth-engine/xp";
import type { AssessmentProposal } from "@/lib/ai/schemas";

let tempDir: string;
let dbFile: string;

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-rpg-conc-"));
  dbFile = path.join(tempDir, "demo.json");
  process.env.DEMO_DB_PATH = dbFile;
  await resetDemoDb();

  // Seed a non-zero baseline so lost updates would be visible:
  // initial total_xp = 100.
  fs.writeFileSync(
    dbFile,
    JSON.stringify({
      version: 2,
      activities: [],
      assessments: [],
      transactions: [],
      skills: {},
      skillEdges: [],
      masteryVerifications: [],
      player: { totalXp: 100, playerLevel: 1, energy: 70, focus: 70, momentum: 30 },
    }),
  );
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DEMO_DB_PATH;
});

/**
 * Build a proposal whose every growth modifier is exactly 1.0, so the final
 * XP equals base_value exactly — making concurrency assertions precise.
 */
function unitProposal(base: number, skill: string): AssessmentProposal {
  return {
    activity: { type: "learning", completion: 0.7 },
    difficulty: { complexity: 0.3333333333, uncertainty: 0.3333333333, expertise_gap: 0.3333333333, resistance: 0.3333333333 },
    growth: {
      effort: 0.5,
      learning: 0.5,
      performance: 0.5,
      outcome: 0.5,
      artifact_value: 0.5,
      character_evidence: 0.5,
    },
    evidence: { level: 3, explanation: "neutral" },
    affected_skills: [{ name: skill, reason: "test" }],
    knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
    mastery_changes: [],
    xp_semantics: {
      base_value: base,
      difficulty: 0.3333333333, // difficultyModifier -> 1.0
      mastery_gain: 0.5, // -> 1.0
      novelty: 0.8, // noveltyModifier -> 1.0
      goal_alignment: 0.5, // -> 1.0
      repetition_risk: "low",
    },
    artifacts: [],
    next_quest: null,
    confidence: 0.8,
    uncertainty_notes: [],
  };
}

async function settle(p: AssessmentProposal, rawInput: string) {
  const activity = await createActivity({ rawInput });
  const assessment = await createAssessment({
    activityId: activity.id,
    proposal: p,
    modelName: "test-model",
    promptVersion: "test-prompt",
  });
  return confirmAssessment(assessment.id);
}

describe("Milestone 2.6 — concurrent settlements must not lose updates", () => {
  test("two concurrent settlements: ledger sum == player total == skill xp sum (delta semantics)", async () => {
    const propA = unitProposal(20, "SkillA");
    const propB = unitProposal(30, "SkillB");

    const [r1, r2] = await Promise.all([
      settle(propA, "activity A (+20)"),
      settle(propB, "activity B (+30)"),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const db = readDb();
    const ledgerSum = db.transactions.reduce((s, t) => s + t.amount, 0);
    expect(ledgerSum).toBe(50); // 20 + 30

    expect(db.player.totalXp).toBe(150); // 100 + 50, NOT 100 + last-write

    const skillXp = (name: string) => Object.values(db.skills).find((s) => s.name === name)?.xp ?? 0;
    expect(skillXp("SkillA") + skillXp("SkillB")).toBe(ledgerSum);

    // Each skill's xp matches exactly its own ledger entry.
    expect(skillXp("SkillA")).toBe(db.transactions.find((t) => t.skillName === "SkillA")?.amount);
    expect(skillXp("SkillB")).toBe(db.transactions.find((t) => t.skillName === "SkillB")?.amount);
  });

  test("same skill + same type concurrent: repetition snapshot is consistent (one 0, one 1)", async () => {
    const prop1 = unitProposal(20, "Statistics");
    const prop2 = unitProposal(20, "Statistics");

    const [r1, r2] = await Promise.all([
      settle(prop1, "statistics #1"),
      settle(prop2, "statistics #2"),
    ]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const db = readDb();
    expect(db.transactions).toHaveLength(2);

    const counts = db.transactions.map((t) => t.repetitionCount).sort((a, b) => a - b);
    expect(counts).toEqual([0, 1]);

    const expected = (count: number) =>
      calculateXp({
        baseValue: 20,
        difficulty: 0.3333333333,
        masteryGain: 0.5,
        evidence: 3,
        novelty: 0.8,
        goalAlignment: 0.5,
        repetitionCount: count,
        questSize: "standard",
      }).finalXp;

    const tx0 = db.transactions.find((t) => t.repetitionCount === 0)!;
    const tx1 = db.transactions.find((t) => t.repetitionCount === 1)!;
    expect(tx0.amount).toBe(expected(0));
    expect(tx1.amount).toBe(expected(1));
    expect(tx0.amount).toBeGreaterThan(tx1.amount); // first-time > repeat
  });
});
