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
  forbiddenExactFiles: readonly string[];
}

export interface ResolveGovernanceChangedFilesOptions {
  /** Repository root to run git in; defaults to the current working directory. */
  cwd?: string;
}

function git(args: string, cwd?: string): string {
  return execSync(`git ${args}`, { encoding: "utf8", cwd }).trim();
}

function diffNameOnly(rangeExpr: string, cwd?: string): string[] {
  const diff = git(`diff --name-only ${rangeExpr}`, cwd);
  return diff
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
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
    parent = git("rev-parse HEAD^1", cwd);
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
  for (const file of files) {
    if (policy.authorizedExceptions.includes(file)) continue;
    for (const prefix of policy.forbiddenPrefixes) {
      if (file.startsWith(prefix)) {
        violations.push(`${file} matches forbidden prefix "${prefix}"`);
      }
    }
    for (const exact of policy.forbiddenExactFiles) {
      if (file === exact) {
        violations.push(`${file} is a forbidden file`);
      }
    }
  }
  return violations;
}
