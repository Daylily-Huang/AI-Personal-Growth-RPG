import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
export const MULTI_FOLDER_BASE = "cf775704f227393249430809c48b52dc32fdb4bf";
export const MULTI_FOLDER_FILES = [
  "CHANGELOG.md", "docs/Design ChatGPT/02_PRODUCT_DESIGN.md", "docs/SiteReadiness/30_MULTI_FOLDER_LIBRARY.md",
  "src/app/local-library/page.tsx", "src/lib/local-library/folders.ts", "task_plan.md",
  "tests/local-library-ui.test.tsx", "tests/local-library-folders.test.ts", "tests/local-library-multi-folder-ui.test.tsx",
  "tests/helpers/multi-folder-scope.ts", "tests/helpers/task-first-scope.ts", "tests/helpers/monthly-scope.ts", "tests/local-library-scope.test.ts",
] as const;
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16e6 });
const paths = (raw: string) => { if (raw && !raw.endsWith("\0")) throw Error("FAIL-CLOSED: multi-folder path encoding"); return raw.split("\0").filter(Boolean); };
const equal = (a: readonly string[], b: readonly string[]) => a.length === new Set(a).size && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export const hasMultiFolderScope = (cwd = process.cwd()) => existsSync(path.join(cwd, "docs/SiteReadiness/30_MULTI_FOLDER_LIBRARY.md"));
export function assertMultiFolderFiles(actual: readonly string[]) {
  if (!equal(actual, MULTI_FOLDER_FILES)) throw Error("FAIL-CLOSED: only the thirteen disclosed multi-folder files are authorized");
}
export function assertMultiFolderScope(cwd = process.cwd()): string[] {
  const actual = [...paths(git(cwd, "diff", "--no-renames", "--name-only", "-z", MULTI_FOLDER_BASE, "--")), ...paths(git(cwd, "ls-files", "--others", "--exclude-standard", "-z"))];
  assertMultiFolderFiles(actual);
  return actual;
}
export function withMultiFolderScope(files: readonly string[], cwd = process.cwd()): string[] {
  if (!hasMultiFolderScope(cwd)) return [...files];
  assertMultiFolderScope(cwd);
  return [...new Set([...files, ...MULTI_FOLDER_FILES])];
}
/** Current exact scope is checked before a historical range can be projected. */
export function multiFolderHistoricalFiles(base: string, actual: string[], cwd = process.cwd()): string[] {
  if (!hasMultiFolderScope(cwd)) return actual;
  assertMultiFolderScope(cwd);
  const historical = paths(git(cwd, "diff", "--no-renames", "--name-only", "-z", base, MULTI_FOLDER_BASE, "--"));
  if (!equal(actual, [...new Set([...historical, ...MULTI_FOLDER_FILES])])) throw Error("FAIL-CLOSED: unexpected historical/current multi-folder composition");
  return historical;
}
export function restoreMultiFolderMonthly(source: string): string {
  return source.replace(/^  \/\/ Explicit MultiFolder30[^\n]*\n(?:  [^\n]*\n){2}/m, "");
}
export function restoreMultiFolderTaskFirst(source: string): string {
  return source.replace('import { multiFolderHistoricalFiles, withMultiFolderScope } from "./multi-folder-scope";\n', "")
    .replace('  let actual = ', '  const actual = ')
    .replace('  actual = multiFolderHistoricalFiles(TASK_FIRST_BASE, actual, cwd);\n', "")
    .replace('return withMultiFolderScope([...new Set([...files, ...TASK_FIRST_FILES])], cwd);', 'return [...new Set([...files, ...TASK_FIRST_FILES])];');
}