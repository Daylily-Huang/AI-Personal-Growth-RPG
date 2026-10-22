import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const TASK_FIRST_BASE = "6dfa88020dd767d95443f2c9ecbf240d7e39ac9a";
export const TASK_FIRST_FILES = [
  "CHANGELOG.md",
  "docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  "docs/SiteReadiness/29_TASK_FIRST_USER_FLOW.md",
  "src/app/dashboard/page.tsx",
  "src/components/dashboard/TaskFirstGuide.tsx",
  "src/components/dashboard/QuickLogCard.tsx",
  "task_plan.md",
  "tests/task-first-guide.test.tsx",
  "tests/helpers/task-first-scope.ts",
  "tests/helpers/monthly-scope.ts",
  "tests/local-library-scope.test.ts"
] as const;
export function hasTaskFirstScope(cwd = process.cwd()) { return existsSync(path.join(cwd, "docs/SiteReadiness/29_TASK_FIRST_USER_FLOW.md")); }
export function assertTaskFirstScope(cwd = process.cwd()) {
  const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16e6 });
  const actual = [...git("diff", "--no-renames", "--name-only", "-z", TASK_FIRST_BASE, "--").split("\0"), ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0")].filter(Boolean);
  if (actual.length !== new Set(actual).size || JSON.stringify([...actual].sort()) !== JSON.stringify([...TASK_FIRST_FILES].sort())) throw Error("FAIL-CLOSED: task-first scope differs from its exact eleven authorized files");
  return actual;
}
// Only the named UI amendment is added to older explicit allowlists. Their
// historical source comparisons and every forbidden-backend assertion remain.
export function withTaskFirstScope(files: readonly string[], cwd = process.cwd()): string[] {
  if (!hasTaskFirstScope(cwd)) return [...files];
  assertTaskFirstScope(cwd);
  return [...new Set([...files, ...TASK_FIRST_FILES])];
}
