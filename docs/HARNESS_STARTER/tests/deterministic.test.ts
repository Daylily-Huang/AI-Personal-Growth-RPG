import { describe, expect, test } from "vitest";
import { runXpHarness } from "../runners/deterministic";

// Replace this placeholder with the real calculateXp import when Growth Engine exists.
const calculateXp = (input: any) => ({
  finalXp: Math.round(
    input.baseValue *
      input.difficulty *
      input.masteryGain *
      input.evidence *
      input.novelty *
      input.goalAlignment
  ),
});

describe("Growth Harness: XP golden cases", async () => {
  const results = await runXpHarness(calculateXp);

  for (const result of results) {
    test(result.id, () => {
      expect(result.errors, JSON.stringify(result.actual, null, 2)).toEqual([]);
    });
  }
});
