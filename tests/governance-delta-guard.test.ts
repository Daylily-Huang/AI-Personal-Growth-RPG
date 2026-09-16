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
  evaluateScopedPolicy,
  type DeltaGuardPolicy,
  PHASE5_DASHBOARD_POLICY,
  PHASE5_QUESTS_POLICY,
  PHASE5_SKILLS_POLICY,
  PHASE6_KNOWLEDGE_POLICY,
  STAGE7C_ARTIFACT_POLICY,
  SHARED_UI_POLICY,
  GLOBAL_APPSHELL_POLICY,
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
  const fullPath = path.join(dir, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
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

describe("Phase 8B Round 0 — Scoped governance guard regressions (G-R0-01 to G-R0-14)", () => {
  it("G-R0-01 backend-only future migration -> historical UI guards applicable=false, PASS", () => {
    const changed = ["supabase/migrations/0043_phase8b_outer_loop_foundation.sql"];

    const questsResult = evaluateScopedPolicy(changed, PHASE5_QUESTS_POLICY);
    expect(questsResult.applicable).toBe(false);
    expect(questsResult.violations).toEqual([]);

    const skillsResult = evaluateScopedPolicy(changed, PHASE5_SKILLS_POLICY);
    expect(skillsResult.applicable).toBe(false);
    expect(skillsResult.violations).toEqual([]);

    const dashboardResult = evaluateScopedPolicy(changed, PHASE5_DASHBOARD_POLICY);
    expect(dashboardResult.applicable).toBe(false);
    expect(dashboardResult.violations).toEqual([]);

    const knowledgeResult = evaluateScopedPolicy(changed, PHASE6_KNOWLEDGE_POLICY);
    expect(knowledgeResult.applicable).toBe(false);
    expect(knowledgeResult.violations).toEqual([]);

    const artifactResult = evaluateScopedPolicy(changed, STAGE7C_ARTIFACT_POLICY);
    expect(artifactResult.applicable).toBe(false);
    expect(artifactResult.violations).toEqual([]);

    const sharedResult = evaluateScopedPolicy(changed, SHARED_UI_POLICY);
    expect(sharedResult.applicable).toBe(false);
    expect(sharedResult.violations).toEqual([]);

    const appshellResult = evaluateScopedPolicy(changed, GLOBAL_APPSHELL_POLICY);
    expect(appshellResult.applicable).toBe(false);
    expect(appshellResult.violations).toEqual([]);
  });

  it("G-R0-02 backend + Quests UI -> Quests guard applicable=true, forbidden backend violation FAIL", () => {
    const changed = [
      "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
      "src/app/quests/page.tsx",
    ];
    const result = evaluateScopedPolicy(changed, PHASE5_QUESTS_POLICY);
    expect(result.applicable).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("supabase/"))).toBe(true);
  });

  it("G-R0-03 backend + Skills UI -> Skills guard must FAIL", () => {
    const changed = [
      "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
      "src/app/skills/page.tsx",
    ];
    const result = evaluateScopedPolicy(changed, PHASE5_SKILLS_POLICY);
    expect(result.applicable).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("supabase/"))).toBe(true);
  });

  it("G-R0-04 backend + Dashboard UI -> Dashboard guard must FAIL", () => {
    const changed = [
      "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
      "src/app/dashboard/page.tsx",
    ];
    const result = evaluateScopedPolicy(changed, PHASE5_DASHBOARD_POLICY);
    expect(result.applicable).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("supabase/"))).toBe(true);
  });

  it("G-R0-05 backend + Knowledge UI -> Knowledge guard must FAIL", () => {
    const changed = [
      "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
      "src/app/knowledge/page.tsx",
    ];
    const result = evaluateScopedPolicy(changed, PHASE6_KNOWLEDGE_POLICY);
    expect(result.applicable).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("supabase/"))).toBe(true);
  });

  it("G-R0-06 backend + Artifact UI -> Stage7C guard must FAIL", () => {
    const changed = [
      "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
      "src/app/artifacts/page.tsx",
    ];
    const result = evaluateScopedPolicy(changed, STAGE7C_ARTIFACT_POLICY);
    expect(result.applicable).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("supabase/"))).toBe(true);
  });

  it("G-R0-07 backend + shared UI primitive -> Shared UI guard must FAIL", () => {
    const changed = [
      "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
      "src/components/ui/PrimaryButton.tsx",
    ];
    const result = evaluateScopedPolicy(changed, SHARED_UI_POLICY);
    expect(result.applicable).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("supabase/"))).toBe(true);
  });

  it("G-R0-08 backend + AppShell layout -> Global AppShell guard must FAIL when its historical policy forbids backend drift", () => {
    const changed = [
      "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
      "src/components/layout/AppSidebar.tsx",
    ];
    const result = evaluateScopedPolicy(changed, GLOBAL_APPSHELL_POLICY);
    expect(result.applicable).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("supabase/"))).toBe(true);
  });

  it("G-R0-09 unrelated docs-only delta -> historical UI guards explicit applicable=false", () => {
    const changed = [
      "docs/Phase8/00_PHASE8_MASTER_ROADMAP.md",
      "docs/Phase8/03_SEASON_AND_REVIEW_SPEC.md",
    ];
    const policies = [
      PHASE5_DASHBOARD_POLICY,
      PHASE5_QUESTS_POLICY,
      PHASE5_SKILLS_POLICY,
      PHASE6_KNOWLEDGE_POLICY,
      STAGE7C_ARTIFACT_POLICY,
      SHARED_UI_POLICY,
      GLOBAL_APPSHELL_POLICY,
    ];
    for (const policy of policies) {
      const result = evaluateScopedPolicy(changed, policy);
      expect(result.applicable).toBe(false);
      expect(result.violations).toEqual([]);
    }
  });

  it("G-R0-10 empty delta -> resolver FAIL-CLOSED", () => {
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

  it("G-R0-11 unresolved merge-base -> resolver FAIL-CLOSED", () => {
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

  it("G-R0-12 current-main merge/push backend-only future phase -> first-parent range correct and historical UI guards applicable=false", () => {
    withRepo((dir) => {
      commitFile(dir, "base.txt", "base", "base");
      const oldMainSha = runGit(dir, "rev-parse HEAD");
      runGit(dir, "checkout -q -b feature/phase8b-backend");
      commitFile(
        dir,
        "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
        "-- migration",
        "phase 8b migration",
      );
      runGit(dir, "checkout -q main");
      runGit(dir, 'merge -q --no-ff -m "Merge branch feature/phase8b-backend" feature/phase8b-backend');
      const headSha = runGit(dir, "rev-parse HEAD");
      setOriginMain(dir, headSha);

      const delta = resolveGovernanceChangedFiles({ cwd: dir });
      expect(delta.mode).toBe("current-main-push");
      expect(delta.range).toBe(`${oldMainSha}..HEAD`);
      expect(delta.files).toContain("supabase/migrations/0043_phase8b_outer_loop_foundation.sql");

      const questsResult = evaluateScopedPolicy(delta.files, PHASE5_QUESTS_POLICY);
      expect(questsResult.applicable).toBe(false);
      expect(questsResult.violations).toEqual([]);

      const skillsResult = evaluateScopedPolicy(delta.files, PHASE5_SKILLS_POLICY);
      expect(skillsResult.applicable).toBe(false);
      expect(skillsResult.violations).toEqual([]);

      const dashboardResult = evaluateScopedPolicy(delta.files, PHASE5_DASHBOARD_POLICY);
      expect(dashboardResult.applicable).toBe(false);
      expect(dashboardResult.violations).toEqual([]);
    });
  });

  it("G-R0-13 current-main push containing historical UI + forbidden backend -> corresponding scoped guard applicable=true and FAILS", () => {
    withRepo((dir) => {
      commitFile(dir, "base.txt", "base", "base");
      runGit(dir, "checkout -q -b feature/mixed-drift");
      commitFile(
        dir,
        "src/app/quests/page.tsx",
        "export default function Quests() {}",
        "quests ui",
      );
      commitFile(
        dir,
        "supabase/migrations/0043_phase8b_outer_loop_foundation.sql",
        "-- migration",
        "migration",
      );
      runGit(dir, "checkout -q main");
      runGit(dir, 'merge -q --no-ff -m "Merge mixed" feature/mixed-drift');
      setOriginMain(dir, "HEAD");

      const delta = resolveGovernanceChangedFiles({ cwd: dir });
      expect(delta.mode).toBe("current-main-push");
      expect(delta.files).toContain("src/app/quests/page.tsx");
      expect(delta.files).toContain("supabase/migrations/0043_phase8b_outer_loop_foundation.sql");

      const questsResult = evaluateScopedPolicy(delta.files, PHASE5_QUESTS_POLICY);
      expect(questsResult.applicable).toBe(true);
      expect(questsResult.violations.length).toBeGreaterThan(0);
      expect(questsResult.violations.some((v) => v.includes("supabase/"))).toBe(true);
    });
  });

  it("G-R0-14 original authorized historical bugfix exception -> behavior remains unchanged when corresponding historical scope is triggered", () => {
    // When Quests UI scope is triggered along with an authorized bugfix exception (PrimaryButton.tsx):
    const changedWithAuthorized = [
      "src/app/quests/page.tsx",
      "src/components/ui/PrimaryButton.tsx",
    ];
    const resultAuthorized = evaluateScopedPolicy(changedWithAuthorized, PHASE5_QUESTS_POLICY);
    expect(resultAuthorized.applicable).toBe(true);
    expect(resultAuthorized.violations).toEqual([]);

    // When Quests UI scope is triggered along with an UNAUTHORIZED UI component (BaseModal.tsx):
    const changedWithUnauthorized = [
      "src/app/quests/page.tsx",
      "src/components/ui/BaseModal.tsx",
    ];
    const resultUnauthorized = evaluateScopedPolicy(changedWithUnauthorized, PHASE5_QUESTS_POLICY);
    expect(resultUnauthorized.applicable).toBe(true);
    expect(resultUnauthorized.violations.length).toBeGreaterThan(0);
    expect(resultUnauthorized.violations[0]).toContain("src/components/ui/BaseModal.tsx");
  });
});
