import { multiFolderHistoricalFiles, withMultiFolderScope } from "./multi-folder-scope";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
  let actual = [...git("diff", "--no-renames", "--name-only", "-z", TASK_FIRST_BASE, "--").split("\0"), ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0")].filter(Boolean);
  actual = multiFolderHistoricalFiles(TASK_FIRST_BASE, actual, cwd);
  if (actual.length !== new Set(actual).size || JSON.stringify([...actual].sort()) !== JSON.stringify([...TASK_FIRST_FILES].sort())) throw Error("FAIL-CLOSED: task-first scope differs from its exact eleven authorized files");
  return actual;
}
// Only the named UI amendment is added to older explicit allowlists. Their
// historical source comparisons and every forbidden-backend assertion remain.
export function withTaskFirstScope(files: readonly string[], cwd = process.cwd()): string[] {
  if (!hasTaskFirstScope(cwd)) return [...files];
  assertTaskFirstScope(cwd);
  return withMultiFolderScope([...new Set([...files, ...TASK_FIRST_FILES])], cwd);
}

// Invert only the two authorized display strings. The historical caller still
// compares the hash of the entire restored component with its accepted blob.
export function restoreTaskFirstQuickLog(source: string): string {
  const replacements = [
    ['title="做完以后：记录实际行动和结果"', 'title="Quick Log — 记录你刚才在现实中做了什么"'],
    ["AI 会先给出成长建议，你可以核对、修改或拒绝；只有确认后，系统才会按规则结算经验。", "AI 只会生成 Proposal；你确认后，服务器 Growth Engine 才会计算并写入 XP Ledger。"],
  ] as const;
  let restored = source.replace(/\r\n/g, "\n");
  for (const [current, original] of replacements) {
    if (restored.split(current).length !== 2 || restored.includes(original)) throw Error("FAIL-CLOSED: unexpected task-first display amendment");
    restored = restored.replace(current, original);
  }
  return restored;
}
export function taskFirstProtectedHash(file: string, original: () => string, cwd = process.cwd()): string {
  if (file !== "src/components/dashboard/QuickLogCard.tsx" || !hasTaskFirstScope(cwd)) return original();
  assertTaskFirstScope(cwd);
  const input = restoreTaskFirstQuickLog(readFileSync(path.join(cwd, file), "utf8"));
  return execFileSync("git", ["hash-object", "--stdin"], { cwd, encoding: "utf8", input }).trim();
}
