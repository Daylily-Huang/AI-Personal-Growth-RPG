import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertMonthlyScope, MONTHLY_ALLOWED, MONTHLY_BASE, monthlyReviewHistoricalOptions } from "./helpers/monthly-scope";

const model = (files: readonly string[] = MONTHLY_ALLOWED) => (args: string[]) => {
  if (args[0] === "rev-parse" || args[0] === "merge-base") return MONTHLY_BASE;
  if (args[0] === "diff") return files.join("\0") + "\0";
  if (args[0] === "ls-files") return "";
  throw Error("Unexpected Git command");
};
describe("Current month/effects scope remains separate from immutable Review regression", () => {
  it("binds current complete scope, before historical projection", () => expect(assertMonthlyScope()).toEqual([...MONTHLY_ALLOWED].sort()));
  it.each(MONTHLY_ALLOWED)("missing %s refuses authorization", file => expect(() => assertMonthlyScope("/", model(MONTHLY_ALLOWED.filter(p => p !== file)))).toThrow("FAIL-CLOSED"));
  it("extra backend/migration/dependency files, Git failure and ref drift refuse authorization", () => {
    for (const extra of ["src/lib/growth-engine/xp.ts", "supabase/migrations/0057_unapproved.sql", "package.json"]) expect(() => assertMonthlyScope("/", model([...MONTHLY_ALLOWED, extra]))).toThrow("FAIL-CLOSED");
    expect(() => assertMonthlyScope("/", () => { throw Error("Git unavailable"); })).toThrow("Git unavailable");
    let reads = 0; const git = model(); expect(() => assertMonthlyScope("/", args => args.join(" ") === "rev-parse HEAD" && ++reads > 1 ? "f".repeat(40) : git(args))).toThrow("FAIL-CLOSED");
  });
  it("keeps every explicitly provided synthetic executor untouched", () => {
    const options = { execute: () => { throw Error("original reached"); } };
    expect(monthlyReviewHistoricalOptions(options)).toBe(options);
  });
  it("Review regression's entire old body restores exactly, including models and timeouts", () => {
    const current = readFileSync("tests/review-insights-governance.test.ts", "utf8").replace(/\r\n/g, "\n")
      .replace('import { restoreMonthlyOnboarding, restoreMonthlyReviewClient } from "./helpers/monthly-scope";\n', "")
      .replace('restoreMonthlyReviewClient(current).replace', 'current.replace')
      .replace('canonical(restoreMonthlyOnboarding(text))', 'canonical(text)');
    const before = execFileSync("git", ["show", "f2f847cf24671eaa8c610a61e1a468a5e3798e57:tests/review-insights-governance.test.ts"], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    expect(current).toBe(before);
  });
});
