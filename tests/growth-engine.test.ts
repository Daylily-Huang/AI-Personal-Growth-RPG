import { describe, expect, test } from "vitest";
import { calculateXp, type XpInput } from "@/lib/growth-engine/xp";
import { levelFromXp, xpThresholdForLevel } from "@/lib/growth-engine/levels";
import {
  checkMasteryProposal,
  maxMasteryForEvidence,
  requiresMasteryVerification,
} from "@/lib/growth-engine/mastery";

function baseInput(overrides: Partial<XpInput> = {}): XpInput {
  return {
    baseValue: 20,
    difficulty: 0.5,
    masteryGain: 0.5,
    evidence: 2,
    novelty: 0.5,
    goalAlignment: 0.5,
    repetitionCount: 0,
    effectiveMinutes: 60,
    questSize: "standard",
    ...overrides,
  };
}

describe("calculateXp", () => {
  test("same input returns same output", () => {
    const a = calculateXp(baseInput());
    const b = calculateXp(baseInput());
    expect(a).toEqual(b);
  });

  test("time is not a linear XP source", () => {
    const short = calculateXp(baseInput({ effectiveMinutes: 60 }));
    const long = calculateXp(baseInput({ effectiveMinutes: 300 }));
    expect(long.finalXp).toBeLessThan(short.finalXp * 5);
    expect(long.finalXp).toBeGreaterThanOrEqual(short.finalXp);
  });

  test("repetition reduces XP", () => {
    const first = calculateXp(baseInput({ repetitionCount: 0, novelty: 0.1 }));
    const repeated = calculateXp(baseInput({ repetitionCount: 29, novelty: 0.1 }));
    expect(repeated.finalXp).toBeLessThan(first.finalXp * 0.4);
  });

  test("high evidence increases XP within bounds", () => {
    const low = calculateXp(baseInput({ evidence: 0 }));
    const high = calculateXp(baseInput({ evidence: 6 }));
    expect(high.finalXp).toBeGreaterThan(low.finalXp);
  });

  test("novelty can relieve repetition penalty", () => {
    const repeatedRote = calculateXp(baseInput({ repetitionCount: 29, novelty: 0.1 }));
    const repeatedBreakthrough = calculateXp(baseInput({ repetitionCount: 29, novelty: 1 }));
    expect(repeatedBreakthrough.finalXp).toBeGreaterThan(repeatedRote.finalXp);
  });

  test("all modifier bounds are respected", () => {
    const result = calculateXp(baseInput());
    const { modifiers } = result;
    expect(modifiers.difficulty).toBeGreaterThanOrEqual(0.75);
    expect(modifiers.difficulty).toBeLessThanOrEqual(1.5);
    expect(modifiers.evidence).toBeGreaterThanOrEqual(0.5);
    expect(modifiers.evidence).toBeLessThanOrEqual(1.35);
    expect(modifiers.novelty).toBeGreaterThanOrEqual(0.2);
    expect(modifiers.novelty).toBeLessThanOrEqual(1.2);
    expect(modifiers.goalAlignment).toBeGreaterThanOrEqual(0.8);
    expect(modifiers.goalAlignment).toBeLessThanOrEqual(1.2);
    expect(modifiers.timeFactor).toBeLessThanOrEqual(1.15);
  });
});

describe("levels", () => {
  test("level thresholds increase with level", () => {
    expect(xpThresholdForLevel(2)).toBe(100);
    expect(xpThresholdForLevel(3)).toBe(230);
    expect(xpThresholdForLevel(3)).toBeGreaterThan(xpThresholdForLevel(2));
  });

  test("levelFromXp returns progress", () => {
    const info = levelFromXp(150);
    expect(info.level).toBe(2);
    expect(info.xpIntoLevel).toBe(50);
    expect(info.xpNeededForNext).toBe(130);
    expect(info.progress).toBeGreaterThan(0);
  });
});

describe("mastery", () => {
  test("E0 cannot propose M6", () => {
    const check = checkMasteryProposal(1, 6, 0);
    expect(check.allowed).toBe(false);
    expect(check.maxAllowed).toBeLessThan(6);
  });

  test("E4 can propose M6", () => {
    const check = checkMasteryProposal(4, 6, 4);
    expect(check.allowed).toBe(true);
    expect(check.verificationRequired).toBe(true);
  });

  test("XP does not automatically raise mastery", () => {
    expect(maxMasteryForEvidence(0)).toBe(2);
    expect(requiresMasteryVerification(4, 5)).toBe(true);
  });
});
