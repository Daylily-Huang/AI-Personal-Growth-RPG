import fs from "node:fs/promises";
import path from "node:path";
import { XpCaseSchema } from "../schemas/case.schema";

// TODO: replace with the product's real Growth Engine import.
// import { calculateXp } from "@/lib/growth-engine/xp";

export type HarnessResult = {
  id: string;
  passed: boolean;
  errors: string[];
  actual?: unknown;
};

async function loadJson(dir: string) {
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".json"));
  return Promise.all(
    files.map(async (name) =>
      JSON.parse(await fs.readFile(path.join(dir, name), "utf8"))
    )
  );
}

export async function runXpHarness(
  calculateXp: (input: unknown) => { finalXp: number }
): Promise<HarnessResult[]> {
  const rawCases = await loadJson("harness/cases/xp");
  const cases = rawCases.map((value) => XpCaseSchema.parse(value));

  return cases.map((testCase) => {
    const actual = calculateXp(testCase.input);
    const errors: string[] = [];

    if (actual.finalXp < testCase.expected.xp.min) {
      errors.push(`XP ${actual.finalXp} < min ${testCase.expected.xp.min}`);
    }

    if (actual.finalXp > testCase.expected.xp.max) {
      errors.push(`XP ${actual.finalXp} > max ${testCase.expected.xp.max}`);
    }

    return {
      id: testCase.id,
      passed: errors.length === 0,
      errors,
      actual,
    };
  });
}
