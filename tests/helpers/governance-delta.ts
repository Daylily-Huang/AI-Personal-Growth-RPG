import { execSync } from "node:child_process";

/**
 * Shared fail-closed range resolution + policy evaluation for the committed
 * delta governance guards (phase5-quests-ui / phase5-skills-ui).
 *
 * Behavioral contract (docs/DesignSystem/MAIN_PUSH_GOVERNANCE_GUARD_FIX_EXECUTION.md):
 * - PR / feature-branch context (mergeBase != HEAD): inspect the FULL branch
 *   delta `git diff --name-only <mergeBase>...HEAD`, never a HEAD~1 shortcut,
 *   so multi-commit PRs keep complete coverage.
 * - current-main push context (mergeBase == HEAD, i.e. origin/main == HEAD):
 *   `mergeBase...HEAD` is empty by construction, so inspect the pushed
 *   commit's first-parent delta `git diff --name-only HEAD^1..HEAD`. This
 *   mode is entered only after positively establishing mergeBase == HEAD;
 *   it is never a generic branch fallback.
 * - Unresolvable ancestry and empty changed-file ranges fail closed with an
 *   explicit error. Git failures are never swallowed into a PASS.
 */

export type GovernanceDeltaMode = "pr-branch" | "current-main-push";

export interface GovernanceDelta {
  mode: GovernanceDeltaMode;
  /** Git range expression the changed-file list was computed from. */
  range: string;
  mergeBase: string;
  files: string[];
}

export interface DeltaGuardPolicy {
  forbiddenPrefixes: readonly string[];
  authorizedExceptions: readonly string[];
  forbiddenExactFiles?: readonly string[];
}

export interface ScopedPolicy {
  scopeTriggers: readonly string[];
  forbiddenPrefixes: readonly string[];
  forbiddenExactFiles?: readonly string[];
  authorizedExceptions?: readonly string[];
}

export interface ScopedPolicyResult {
  applicable: boolean;
  violations: string[];
}

export interface ResolveGovernanceChangedFilesOptions {
  /** Repository root to run git in; defaults to the current working directory. */
  cwd?: string;
}

function git(args: string, cwd?: string): string {
  return execSync(`git ${args}`, { encoding: "utf8", cwd }).trim();
}

function diffNameOnly(rangeExpr: string, cwd?: string): string[] {
  // `-z` makes Git emit raw path bytes instead of C-style quoted pathnames,
  // so non-ASCII paths remain matchable by scoped governance policies.
  // `--no-renames` intentionally represents a rename as delete(old)+add(new),
  // preserving BOTH path identities. Otherwise `--name-only` reports only the
  // destination of a detected rename and a protected historical source path
  // could disappear from scope applicability checks.
  const diff = execSync(`git diff --no-renames --name-only -z ${rangeExpr}`, {
    encoding: "utf8",
    cwd,
  });
  return diff.split("\0").filter(Boolean);
}

export function resolveGovernanceChangedFiles(
  options: ResolveGovernanceChangedFilesOptions = {},
): GovernanceDelta {
  const { cwd } = options;

  let mergeBase = "";
  try {
    mergeBase = git("merge-base origin/main HEAD", cwd);
  } catch {
    try {
      mergeBase = git("merge-base main HEAD", cwd);
    } catch (err) {
      throw new Error(`FAIL-CLOSED: Unable to resolve merge-base against origin/main or main: ${err}`);
    }
  }
  if (!mergeBase) {
    throw new Error("FAIL-CLOSED: merge-base resolved to an empty value");
  }

  const head = git("rev-parse HEAD", cwd);
  if (mergeBase !== head) {
    // PR / feature-branch context: full committed branch delta.
    const range = `${mergeBase}...HEAD`;
    const files = diffNameOnly(range, cwd);
    if (files.length === 0) {
      throw new Error(`FAIL-CLOSED: PR delta guard produced an empty changed-file range for ${range}`);
    }
    return { mode: "pr-branch", range, mergeBase, files };
  }

  // current-main push context: origin/main == HEAD.
  let parent: string;
  try {
    // Quote the revision so Windows cmd.exe does not consume `^` as its
    // escape character before Git receives the first-parent expression.
    parent = git('rev-parse "HEAD^1"', cwd);
  } catch (err) {
    throw new Error(
      `FAIL-CLOSED: current-main push mode could not resolve HEAD^1 (no resolvable ancestry): ${err}`,
    );
  }
  const range = `${parent}..HEAD`;
  const files = diffNameOnly(range, cwd);
  if (files.length === 0) {
    throw new Error(
      `FAIL-CLOSED: current-main push delta guard produced an empty changed-file range for ${range}`,
    );
  }
  return { mode: "current-main-push", range, mergeBase, files };
}

/**
 * Pure policy evaluation. A file is compliant only if it is explicitly listed
 * as an authorized exception; otherwise it must match no forbidden prefix and
 * no forbidden exact file. Returns human-readable violations (empty = pass).
 */
export function findPolicyViolations(
  files: readonly string[],
  policy: DeltaGuardPolicy,
): string[] {
  const violations: string[] = [];
  const authorizedExceptions = policy.authorizedExceptions.map(normalizeGovernancePath);
  const forbiddenPrefixes = policy.forbiddenPrefixes.map(normalizeGovernancePath);
  const forbiddenExactFiles = (policy.forbiddenExactFiles ?? []).map(normalizeGovernancePath);

  for (const rawFile of files) {
    const file = normalizeGovernancePath(rawFile);
    if (authorizedExceptions.includes(file)) continue;
    for (const prefix of forbiddenPrefixes) {
      if (file.startsWith(prefix)) {
        violations.push(`${file} matches forbidden prefix "${prefix}"`);
      }
    }
    for (const exact of forbiddenExactFiles) {
      if (file === exact) {
        violations.push(`${file} is a forbidden file`);
      }
    }
  }
  return violations;
}

function normalizeGovernancePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function matchesScopeTrigger(filePath: string, trigger: string): boolean {
  const normalizedFile = normalizeGovernancePath(filePath);
  const normalizedTrigger = normalizeGovernancePath(trigger);

  if (normalizedTrigger.endsWith("/**")) {
    const base = normalizedTrigger.slice(0, -2);
    return normalizedFile.startsWith(base);
  }
  if (normalizedTrigger.endsWith("/*")) {
    const base = normalizedTrigger.slice(0, -1);
    return normalizedFile.startsWith(base);
  }
  if (normalizedTrigger.endsWith("/")) {
    return normalizedFile.startsWith(normalizedTrigger);
  }
  return (
    normalizedFile === normalizedTrigger ||
    normalizedFile.startsWith(`${normalizedTrigger}/`)
  );
}

/**
 * Evaluates a scoped governance policy against a list of changed files.
 *
 * Contract:
 * 1. Checks if ANY file in `files` matches `policy.scopeTriggers`.
 * 2. If no file matches, returns `{ applicable: false, violations: [] }`.
 * 3. If applicable, evaluates the FULL `files` array against the forbidden policy.
 *    (Files are NEVER filtered down to UI-only before evaluation, ensuring mixed
 *    UI + backend modifications fail closed).
 */
export function evaluateScopedPolicy(
  files: readonly string[],
  policy: ScopedPolicy,
): ScopedPolicyResult {
  const isApplicable = files.some((file) =>
    policy.scopeTriggers.some((trigger) => matchesScopeTrigger(file, trigger)),
  );

  if (!isApplicable) {
    return { applicable: false, violations: [] };
  }

  const violations = findPolicyViolations(files, {
    forbiddenPrefixes: policy.forbiddenPrefixes,
    authorizedExceptions: policy.authorizedExceptions ?? [],
    forbiddenExactFiles: policy.forbiddenExactFiles ?? [],
  });

  return { applicable: true, violations };
}

// =============================================================================
// Standardized Historical Phase Policy Specifications
// =============================================================================

export const COMMON_AUTHORIZED_CORE_BUGFIXES: readonly string[] = [
  "src/app/api/activities/[id]/assess/route.ts",
  "src/lib/ai/assess.ts",
  "src/lib/store/demo-repository.ts",
  "src/lib/store/repository.ts",
  "src/lib/store/settlement.service.ts",
  "src/lib/store/supabase-repository.ts",
];

export const PHASE5_DASHBOARD_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/dashboard/",
    "src/components/dashboard/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/auth/",
    "src/lib/http/",
    "src/proxy.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

export const PHASE5_QUESTS_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/quests/",
    "src/components/quests/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/growth-engine/",
    "src/lib/ai/",
    "src/lib/supabase/",
    "src/lib/auth/",
    "src/lib/http/",
    "src/proxy.ts",
    "src/components/ui/",
  ],
  authorizedExceptions: [
    ...COMMON_AUTHORIZED_CORE_BUGFIXES,
    "src/components/ui/PrimaryButton.tsx",
    "src/components/ui/LevelBadge.tsx",
  ],
  forbiddenExactFiles: ["package.json", "pnpm-lock.yaml"],
};

export const PHASE5_SKILLS_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/skills/",
    "src/components/skills/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/growth-engine/",
    "src/lib/ai/",
    "src/lib/supabase/",
    "src/lib/auth/",
    "src/lib/http/",
    "src/proxy.ts",
    "src/components/ui/",
  ],
  authorizedExceptions: [
    ...COMMON_AUTHORIZED_CORE_BUGFIXES,
    "src/components/ui/PrimaryButton.tsx",
    "src/components/ui/LevelBadge.tsx",
  ],
  forbiddenExactFiles: ["package.json", "pnpm-lock.yaml"],
};

export const PHASE6_KNOWLEDGE_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/knowledge/",
    "src/components/knowledge/",
  ],
  forbiddenPrefixes: [
    "src/lib/",
    "src/app/api/",
    "supabase/",
    "src/components/",
    "src/proxy.ts",
    "src/styles/design-tokens.css",
  ],
  authorizedExceptions: [
    "src/components/ui/PrimaryButton.tsx",
    "src/components/ui/LevelBadge.tsx",
  ],
  forbiddenExactFiles: ["package.json", "pnpm-lock.yaml"],
};

export const STAGE7C_ARTIFACT_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/artifacts/",
    "src/components/artifacts/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/http/",
    "src/lib/auth/",
    "src/proxy.ts",
    "src/types/artifact.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

export const SHARED_UI_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/components/ui/",
    "src/styles/design-tokens.css",
    "src/app/globals.css",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/http/",
    "src/lib/auth/",
    "src/proxy.ts",
    "src/types/artifact.ts",
    "src/lib/knowledge/authority-service.ts",
    "src/lib/knowledge/types.ts",
    "src/lib/skills/derived-state.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

export const GLOBAL_APPSHELL_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/components/layout/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/http/",
    "src/lib/auth/",
    "src/proxy.ts",
    "src/types/artifact.ts",
    "src/lib/knowledge/authority-service.ts",
    "src/lib/knowledge/types.ts",
    "src/lib/skills/derived-state.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

