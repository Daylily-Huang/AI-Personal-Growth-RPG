/**
 * tests/governance-delta-guard.test.ts
 * Deterministic regression coverage for the shared governance delta guard
 * range resolver and policy evaluator (tests/helpers/governance-delta.ts).
 *
 * Required behavior proofs (MAIN_PUSH_GOVERNANCE_GUARD_FIX_EXECUTION.md §6):
 * - Case A: PR multi-commit delta inspects the FULL merge-base range, not
 *   just the last commit (no unconditional HEAD~1 fallback).
 * - Case B: current-main merge push resolves HEAD^1..HEAD (the merge delta).
 * - Case C: current-main ordinary single-parent push resolves HEAD^1..HEAD.
 * - Case D: a forbidden path outside the authorized list fails evaluation.
 * - Case E: an authorized exception is not rejected solely by a matching
 *   forbidden prefix, and is not a blanket bypass of the prefix.
 * - Case F: unresolvable ancestry fails closed with an explicit error.
 * - Empty changed-file ranges fail closed in both modes (no silent PASS).
 *
 * All fixtures spawn real temporary git repositories; nothing is mocked.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findPolicyViolations,
  resolveGovernanceChangedFiles,
  type DeltaGuardPolicy,
} from "./helpers/governance-delta";

function runGit(dir: string, args: string): string {
  return execSync(`git ${args}`, { cwd: dir, encoding: "utf8" }).trim();
}

function initFixtureRepo(options: { branch?: string } = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "governance-delta-fixture-"));
  runGit(dir, `init -q -b ${options.branch ?? "main"}`);
  runGit(dir, 'config user.name "Governance Fixture"');
  runGit(dir, 'config user.email "governance-fixture@example.invalid"');
  runGit(dir, "config commit.gpgsign false");
  return dir;
}

function commitFile(dir: string, file: string, content: string, message: string): void {
  fs.writeFileSync(path.join(dir, file), content);
  runGit(dir, "add -A");
  runGit(dir, `commit -q -m "${message}"`);
}

/** Simulates a fetched GitHub checkout by pinning refs/remotes/origin/main. */
function setOriginMain(dir: string, rev: string): void {
  runGit(dir, `update-ref refs/remotes/origin/main ${rev}`);
}

function withRepo(fn: (dir: string) => void, options: { branch?: string } = {}): void {
  const dir = initFixtureRepo(options);
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SAMPLE_POLICY: DeltaGuardPolicy = {
  forbiddenPrefixes: ["src/app/api/", "src/lib/growth-engine/", "src/components/ui/"],
  authorizedExceptions: ["src/components/ui/PrimaryButton.tsx"],
  forbiddenExactFiles: ["package.json", "pnpm-lock.yaml"],
};

describe("Governance delta guard — range resolver on real git fixtures", () => {
  it("Case A: PR multi-commit delta covers the full merge-base range, not just HEAD~1", () => {
    withRepo((dir) => {
      commitFile(dir, "base.txt", "base", "base");
      const baseSha = runGit(dir, "rev-parse HEAD");
      runGit(dir, "checkout -q -b feature");
      commitFile(dir, "alpha.txt", "A", "feature commit A");
      commitFile(dir, "beta.txt", "B", "feature commit B");
      setOriginMain(dir, baseSha);

      const delta = resolveGovernanceChangedFiles({ cwd: dir });

      expect(delta.mode).toBe("pr-branch");
      // alpha.txt was introduced by commit A; a HEAD~1..HEAD shortcut would miss it.
      expect(delta.files).toContain("alpha.txt");
      expect(delta.files).toContain("beta.txt");
      expect(delta.files).not.toContain("base.txt");
      expect(delta.range).toBe(`${baseSha}...HEAD`);
    });
  });

  it("Case B: current-main merge push resolves the merge delta via HEAD^1..HEAD", () => {
    withRepo((dir) => {
      commitFile(dir, "base.txt", "base", "base");
      const oldMainSha = runGit(dir, "rev-parse HEAD");
      runGit(dir, "checkout -q -b feature");
      commitFile(dir, "feature.txt", "F", "feature work");
      runGit(dir, "checkout -q main");
      runGit(dir, 'merge -q --no-ff -m "Merge feature" feature'); // merge commit M
      const headSha = runGit(dir, "rev-parse HEAD");
      expect(headSha).not.toBe(oldMainSha);
      setOriginMain(dir, headSha); // pushed-to-main state: origin/main == HEAD

      const delta = resolveGovernanceChangedFiles({ cwd: dir });

      expect(delta.mode).toBe("current-main-push");
      const firstParent = runGit(dir, "rev-parse HEAD^1");
      expect(firstParent).toBe(oldMainSha); // M^1 is the previous main tip
      expect(delta.range).toBe(`${firstParent}..HEAD`);
      expect(delta.files).toContain("feature.txt");
      expect(delta.files).not.toContain("base.txt");
      expect(delta.files.length).toBeGreaterThan(0);
    });
  });

  it("Case C: current-main ordinary single-parent push resolves the pushed commit delta", () => {
    withRepo((dir) => {
      commitFile(dir, "c1.txt", "1", "first commit");
      commitFile(dir, "c2.txt", "2", "direct push to main");
      setOriginMain(dir, "HEAD");

      const delta = resolveGovernanceChangedFiles({ cwd: dir });

      expect(delta.mode).toBe("current-main-push");
      expect(delta.files).toEqual(["c2.txt"]);
    });
  });

  it("empty PR delta (merge-base != HEAD, zero file changes) fails closed", () => {
    withRepo((dir) => {
      commitFile(dir, "base.txt", "base", "base");
      const baseSha = runGit(dir, "rev-parse HEAD");
      runGit(dir, "checkout -q -b feature");
      runGit(dir, 'commit -q --allow-empty -m "empty commit"');
      setOriginMain(dir, baseSha);

      expect(() => resolveGovernanceChangedFiles({ cwd: dir })).toThrowError(
        /FAIL-CLOSED.*empty changed-file range/,
      );
    });
  });

  it("empty current-main delta (no-op merge push) fails closed", () => {
    withRepo((dir) => {
      commitFile(dir, "base.txt", "base", "base");
      runGit(dir, "checkout -q -b feature");
      runGit(dir, 'commit -q --allow-empty -m "empty feature commit"');
      runGit(dir, "checkout -q main");
      runGit(dir, 'merge -q --no-ff -m "no-op merge" feature');
      setOriginMain(dir, "HEAD");

      expect(() => resolveGovernanceChangedFiles({ cwd: dir })).toThrowError(
        /FAIL-CLOSED.*empty changed-file range/,
      );
    });
  });

  it("Case F1: current-main mode with unresolvable HEAD^1 fails closed", () => {
    withRepo((dir) => {
      commitFile(dir, "root.txt", "r", "root commit");
      setOriginMain(dir, "HEAD");

      expect(() => resolveGovernanceChangedFiles({ cwd: dir })).toThrowError(
        /FAIL-CLOSED.*HEAD\^1/,
      );
    });
  });

  it("Case F2: unresolvable merge-base (no origin/main, no main) fails closed", () => {
    // Branch intentionally not named main so neither merge-base probe can resolve.
    withRepo(
      (dir) => {
        commitFile(dir, "root.txt", "r", "root commit");

        expect(() => resolveGovernanceChangedFiles({ cwd: dir })).toThrowError(
          /FAIL-CLOSED: Unable to resolve merge-base/,
        );
      },
      { branch: "trunk" },
    );
  });
});

describe("Governance delta guard — policy evaluation", () => {
  it("Case D: a forbidden path outside the authorized list fails", () => {
    const violations = findPolicyViolations(
      ["src/app/dashboard/page.tsx", "src/lib/growth-engine/xp.ts", "package.json"],
      SAMPLE_POLICY,
    );

    // The allowed page produces no violation; the growth-engine path and the
    // exact forbidden file both do.
    expect(violations.some((v) => v.startsWith("src/app/dashboard/page.tsx"))).toBe(false);
    expect(violations.some((v) => v.startsWith("src/lib/growth-engine/xp.ts"))).toBe(true);
    expect(violations.some((v) => v.startsWith("package.json"))).toBe(true);
    expect(violations.length).toBe(2);
  });

  it("Case E: authorized exception passes despite matching a forbidden prefix, without blanket bypass", () => {
    const violations = findPolicyViolations(
      ["src/components/ui/PrimaryButton.tsx", "src/components/ui/BaseModal.tsx"],
      SAMPLE_POLICY,
    );

    // PrimaryButton is explicitly authorized and must not be rejected solely
    // because it matches the forbidden "src/components/ui/" prefix; BaseModal
    // is not authorized and must still be rejected.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("src/components/ui/BaseModal.tsx");
  });
});
