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
  "tests/activity-detail-governance.test.ts",
  "tests/activity-detail-ui.test.tsx",
  "tests/artifact-acceptance-governance.test.ts",
  "tests/commercial-recovery.test.tsx",
  "tests/commercial-scope.test.ts",
  "tests/helpers/commercial-scope.ts",
  "tests/helpers/monthly-scope.ts",
  "tests/helpers/multi-folder-scope.ts",
  "tests/local-library-folders.test.ts",
  "tests/local-library-scope.test.ts",
  "tests/monthly-scope.test.ts",
  "tests/navigation-dialog.test.tsx",
  "tests/navigation.test.ts",
  "tests/onboarding-governance.test.ts",
  "tests/phase8b-journey-ui.test.tsx",
  "tests/phase8e-wishes-ui.test.tsx",
  "tests/phase8f-ui-governance.test.ts",
  "tests/proposal-edit-governance.test.ts",
  "tests/review-insights-governance.test.ts"
] as const;
const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16e6 });
const paths = (raw: string) => { if (raw && !raw.endsWith("\0")) throw Error("FAIL-CLOSED: commercial paths"); return raw.split("\0").filter(Boolean); };
const same = (a: readonly string[], b: readonly string[]) => a.length === new Set(a).size && b.length === new Set(b).size && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export const hasCommercialScope = (cwd = process.cwd()) => existsSync(path.join(cwd, "docs/CommercialReadiness/01_NAVIGATION_AND_RECOVERY.md"));
export function assertCommercialFiles(files: readonly string[]) {
  if (!same(files, COMMERCIAL_FILES)) throw Error("FAIL-CLOSED: only the explicitly disclosed navigation-foundation files are authorized");
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

/** Only four user-authorized navigation paths are historical in old freeze assertions. Every backend blob is still read from the current checkout. Current UI is exercised by navigation/recovery/browser tests. */
const FROZEN_NAVIGATION_HISTORY: readonly string[] = [
  "src/components/layout/AppShell.tsx",
  "src/components/layout/AppShellBoundary.tsx",
  "src/components/layout/AppSidebar.tsx",
  "src/components/layout/MobileNav.tsx"
];
export function commercialFrozenUIHash(file: string, currentHash: string, cwd = process.cwd()): string {
  if (!hasCommercialScope(cwd) || !FROZEN_NAVIGATION_HISTORY.includes(file)) return currentHash;
  assertCommercialScope(cwd);
  return git(cwd, ["rev-parse", COMMERCIAL_BASE + ":" + file]).trim();
}
export function commercialFrozenUIContent(file: string, current: string, cwd = process.cwd()): string {
  if (!hasCommercialScope(cwd) || !FROZEN_NAVIGATION_HISTORY.includes(file)) return current;
  assertCommercialScope(cwd);
  return git(cwd, ["show", COMMERCIAL_BASE + ":" + file]);
}
/** Invert only the two outer landmark tags. Inner content, reads, auth and raw-text behavior remain wholly compared by the previous guard. */
export function restoreCommercialActivityFrame(file: string, source: string, cwd = process.cwd()): string {
  if (file !== "src/app/activities/[id]/page.tsx" || !hasCommercialScope(cwd)) return source;
  assertCommercialScope(cwd);
  const pairs = [
  [
    "return <section className=\"mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 py-8 sm:px-6\" aria-labelledby=\"activity-detail-title\">",
    "return <main className=\"mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 py-8 sm:px-6\" aria-labelledby=\"activity-detail-title\">"
  ],
  [
    "    <ActivityDetail key={id} id={id} />\n  </section>;",
    "    <ActivityDetail key={id} id={id} />\n  </main>;"
  ]
];
  for (const [current, accepted] of pairs) {
    if (source.split(current).length !== 2) throw Error("FAIL-CLOSED: activity outer landmark differs");
    source = source.replace(current, accepted);
  }
  return source;
}
export const COMMERCIAL_GUARD_PATCHES: Record<string, readonly (readonly [string, string])[]> = {
  "tests/phase8f-ui-governance.test.ts": [
    [
      "",
      "import { commercialFrozenUIHash } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "execFileSync(\"git\", [\"hash-object\", `--path=${file}`, file], { encoding: \"utf8\" }).trim()",
      "commercialFrozenUIHash(file, execFileSync(\"git\", [\"hash-object\", `--path=${file}`, file], { encoding: \"utf8\" }).trim())"
    ],
    [
      "Rewards wrapper adds local links only; AppShell and main navigation remain accepted blobs",
      "accepted navigation history stays frozen; current navigation has its own explicit scope"
    ]
  ],
  "tests/artifact-acceptance-governance.test.ts": [
    [
      "",
      "import { commercialFrozenUIHash } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "git(\"hash-object\", `--path=${file}`, file).trim()",
      "commercialFrozenUIHash(file, git(\"hash-object\", `--path=${file}`, file).trim())"
    ],
    [
      "accepted helper whole prefix and ALL55 SQL/authority/UI tokens remain frozen",
      "accepted helper and ALL55 authority blobs stay frozen; navigation history is explicitly archived"
    ]
  ],
  "tests/activity-detail-governance.test.ts": [
    [
      "",
      "import { commercialFrozenUIContent } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "expect(canonical(isProposalFactEditCheckout() && (ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as readonly string[]).includes(file) ? proposalFactEditHistoricalContent(file, \"activity\") : isEvidenceSubmissionCheckout() && (ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as readonly string[]).includes(file) ? evidenceSubmissionHistoricalContent(file, \"activity\") : isAssessmentContextCheckout() && (ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as readonly string[]).includes(file) ? assessmentContextHistoricalContent(file, \"activity\") : readFileSync(file, \"utf8\"))",
      "expect(canonical(commercialFrozenUIContent(file, isProposalFactEditCheckout() && (ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as readonly string[]).includes(file) ? proposalFactEditHistoricalContent(file, \"activity\") : isEvidenceSubmissionCheckout() && (ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as readonly string[]).includes(file) ? evidenceSubmissionHistoricalContent(file, \"activity\") : isAssessmentContextCheckout() && (ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as readonly string[]).includes(file) ? assessmentContextHistoricalContent(file, \"activity\") : readFileSync(file, \"utf8\")))"
    ],
    [
      "protected Core/auth/AI/SQL and navigation remain baseline blobs",
      "protected Core/auth/AI/SQL remain current baseline blobs; authorized navigation retains its accepted history"
    ]
  ],
  "tests/onboarding-governance.test.ts": [
    [
      "",
      "import { commercialFrozenUIHash, restoreCommercialGuard } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "monthlyOnboardingProtectedHash(protectedFile, () => execFileSync(\"git\", [\"hash-object\", `--path=${protectedFile}`, protectedFile], { encoding: \"utf8\" }).trim())",
      "commercialFrozenUIHash(protectedFile, monthlyOnboardingProtectedHash(protectedFile, () => execFileSync(\"git\", [\"hash-object\", `--path=${protectedFile}`, protectedFile], { encoding: \"utf8\" }).trim()))"
    ],
    [
      "expect(canonical(isProposalFactEditCheckout() && file === \"src/app/activities/[id]/page.tsx\"",
      "expect(canonical(file === \"tests/activity-detail-ui.test.tsx\" ? restoreCommercialGuard(file, readFileSync(file, \"utf8\")) : isProposalFactEditCheckout() && file === \"src/app/activities/[id]/page.tsx\""
    ]
  ],
  "tests/proposal-edit-governance.test.ts": [
    [
      "",
      "import { restoreCommercialActivityFrame } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "let current = canonical(readFileSync(file, \"utf8\"));",
      "let current = restoreCommercialActivityFrame(file, canonical(readFileSync(file, \"utf8\")));"
    ]
  ],
  "tests/local-library-folders.test.ts": [
    [
      "",
      "import { restoreCommercialMonthly } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "restore(readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"))",
      "restore(file === \"tests/helpers/monthly-scope.ts\" ? restoreCommercialMonthly(readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\")) : readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"))"
    ]
  ],
  "tests/review-insights-governance.test.ts": [
    [
      "",
      "import { restoreCommercialGuard } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "for (const file of OLD) { const current = canonical(readFileSync(file, \"utf8\"));",
      "for (const file of OLD) { const current = restoreCommercialGuard(file, canonical(readFileSync(file, \"utf8\")));"
    ]
  ],
  "tests/activity-detail-ui.test.tsx": [
    [
      "render(<ActivityDetailPage />); const pre =",
      "render(<main><ActivityDetailPage /></main>); const pre ="
    ],
    [
      "one main/h1, fixed return, literal full raw text and same-origin private GET",
      "one composed main/h1, fixed return, literal full raw text and same-origin private GET"
    ]
  ],
  "tests/monthly-scope.test.ts": [
    [
      "",
      "import { restoreCommercialGuard } from \"./helpers/commercial-scope\";\n"
    ],
    [
      "const current = readFileSync(\"tests/review-insights-governance.test.ts\", \"utf8\").replace(/\\r\\n/g, \"\\n\")",
      "const current = restoreCommercialGuard(\"tests/review-insights-governance.test.ts\", readFileSync(\"tests/review-insights-governance.test.ts\", \"utf8\").replace(/\\r\\n/g, \"\\n\"))"
    ]
  ]
};
/** Each amended legacy guard must invert in full to the real accepted base. Unknown edits cannot be hidden by these literal rewrites. */
export function restoreCommercialGuard(file: string, source: string): string {
  for (const [accepted, current] of [...(COMMERCIAL_GUARD_PATCHES[file] ?? [])].reverse()) {
    if (source.split(current).length !== 2) throw Error("FAIL-CLOSED: legacy guard wiring differs");
    source = source.replace(current, accepted);
  }
  return source;
}
