import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
export const COMMERCIAL_BASE = "c02f4cc2eb8486f185b83399086788047d51505e";
export const COMMERCIAL_FILES = [
  "CHANGELOG.md",
  "docs/CommercialReadiness/00_MASTER_PLAN.md",
  "docs/CommercialReadiness/01_NAVIGATION_AND_RECOVERY.md",
  "docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  "src/app/activities/[id]/page.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/help/page.tsx",
  "src/app/journey/layout.tsx",
  "src/app/loading.tsx",
  "src/app/not-found.tsx",
  "src/app/rewards/layout.tsx",
  "src/components/layout/AppHeader.tsx",
  "src/components/layout/AppShell.tsx",
  "src/components/layout/AppShellBoundary.tsx",
  "src/components/layout/AppSidebar.tsx",
  "src/components/layout/MobileNav.tsx",
  "src/components/layout/NavigationDialog.tsx",
  "src/components/system/RecoveryPanel.tsx",
  "src/lib/navigation.ts",
  "task_plan.md",
  "tests/commercial-recovery.test.tsx",
  "tests/commercial-scope.test.ts",
  "tests/helpers/commercial-scope.ts",
  "tests/helpers/monthly-scope.ts",
  "tests/helpers/multi-folder-scope.ts",
  "tests/local-library-scope.test.ts",
  "tests/navigation-dialog.test.tsx",
  "tests/navigation.test.ts",
  "tests/phase8b-journey-ui.test.tsx",
  "tests/phase8e-wishes-ui.test.tsx"
] as const;
const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16e6 });
const paths = (raw: string) => { if (raw && !raw.endsWith("\0")) throw Error("FAIL-CLOSED: commercial paths"); return raw.split("\0").filter(Boolean); };
const same = (a: readonly string[], b: readonly string[]) => a.length === new Set(a).size && b.length === new Set(b).size && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export const hasCommercialScope = (cwd = process.cwd()) => existsSync(path.join(cwd, "docs/CommercialReadiness/01_NAVIGATION_AND_RECOVERY.md"));
export function assertCommercialFiles(files: readonly string[]) {
  if (!same(files, COMMERCIAL_FILES)) throw Error("FAIL-CLOSED: only the thirty-one disclosed commercial-foundation files are authorized");
}
export function assertCommercialScope(cwd = process.cwd()): string[] {
  const head = git(cwd, ["rev-parse", "HEAD"]).trim(), remote = git(cwd, ["rev-parse", "origin/main"]).trim();
  for (const endpoint of [head, remote]) if (!/^[a-f0-9]{40}$/.test(endpoint) || git(cwd, ["merge-base", COMMERCIAL_BASE, endpoint]).trim() !== COMMERCIAL_BASE) throw Error("FAIL-CLOSED: commercial ancestry");
  const read = () => [...paths(git(cwd, ["diff", "--no-renames", "--name-only", "-z", COMMERCIAL_BASE, "--"])), ...paths(git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]))];
  const files = read(); assertCommercialFiles(files);
  if (git(cwd, ["rev-parse", "HEAD"]).trim() !== head || git(cwd, ["rev-parse", "origin/main"]).trim() !== remote || !same(read(), files)) throw Error("FAIL-CLOSED: commercial drift");
  return files;
}
/** Current strict authorization first; archived releases retain their real accepted endpoint. */
export function commercialHistoricalFiles(base: string, actual: string[], cwd = process.cwd()): string[] {
  if (!hasCommercialScope(cwd)) return actual;
  assertCommercialScope(cwd);
  const historical = paths(git(cwd, ["diff", "--no-renames", "--name-only", "-z", base, COMMERCIAL_BASE, "--"]));
  if (!same(actual, [...new Set([...historical, ...COMMERCIAL_FILES])])) throw Error("FAIL-CLOSED: commercial historical/current composition");
  return historical;
}
export function withCommercialFiles(files: readonly string[], cwd = process.cwd()): string[] {
  if (!hasCommercialScope(cwd)) return [...files];
  assertCommercialScope(cwd); return [...new Set([...files, ...COMMERCIAL_FILES])];
}
export function restoreCommercialMonthly(source: string): string {
  return source.replace('import { commercialHistoricalFiles } from "./commercial-scope";\n', "")
    .replace('const files = commercialHistoricalFiles(MONTHLY_BASE, raw.flatMap(value => value.split("\\0").filter(Boolean)), cwd);', 'const files = raw.flatMap(value => value.split("\\0").filter(Boolean));');
}
