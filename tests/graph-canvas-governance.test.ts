import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  GRAPH_CANVAS_ALLOWED, GRAPH_CANVAS_MARKERS, GRAPH_CANVAS_PRODUCTION,
  hasGraphCanvasScope, graphCanvasScopeViolations, graphCanvasKnowledgePolicy,
  PHASE6_KNOWLEDGE_POLICY, SKILL_BOOTSTRAP_MARKERS, SKILL_BOOTSTRAP_PRODUCTION,
  evaluateScopedPolicy, resolveGovernanceChangedFiles,
  hasMobileGraphScope, mobileGraphScopeViolations, MOBILE_GRAPH_BASE, MOBILE_GRAPH_AUDIT_ADDITIONS,
  hasConnectedFocusScope, graphInteractionScopeViolations, CONNECTED_FOCUS_AUDIT_ADDITIONS,
} from "./helpers/governance-delta";
import { validateVisualMigrationDelta } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations } from "./phase8f-ui-governance.test";
import { hasNewUserGuideScope, newUserGuideScopeViolations, resolveNewUserGuideWorkingFiles,
  resolveNewUserGuideChangedFiles, NEW_USER_GUIDE_ADDITIONS } from "./helpers/governance-delta";

const base = "ab84df35319d08247388051c451be523afe3c7a7";
import { hasActivityDetailScope, activityDetailScopeViolations, resolveActivityDetailWorkingFiles,
  resolveActivityDetailChangedFiles, withoutActivityDetailAdditions } from "./helpers/governance-delta";
const forbidden = [
  "src/app/api/skills/route.ts", "src/app/api/activities/[id]/assess/route.ts",
  "src/app/api/auth/login/route.ts", "src/lib/ai/assess.ts", "src/lib/store/repository.ts",
  "src/lib/growth-engine/engine.ts", "src/lib/reward/fold.ts", "src/lib/milestone/repository.ts",
  "src/lib/knowledge/authority-service.ts", "src/components/rewards/WishesClient.tsx",
  "src/components/layout/MobileNav.tsx", "src/components/ui/BaseModal.tsx", "src/proxy.ts",
  "src/styles/design-tokens.css", "src/app/knowledge/page.tsx", "src/components/graph/unsafe.ts",
  "supabase/migrations/0053_zero_xp_manual_skill_authority.sql", ".github/workflows/ci.yml",
  "package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts",
  "public/unsafe.svg", "scripts/unsafe.cjs", ".env.local",
  "docs/Design ChatGPT/01_SYSTEM_RULES.md", "tests/unsafe.test.ts",
];

describe("SiteReadiness02 exact graph-only scope", () => {
  test("requires every marker and exactly four production paths", () => {
    expect(GRAPH_CANVAS_PRODUCTION).toHaveLength(4);
    expect(hasGraphCanvasScope(GRAPH_CANVAS_MARKERS)).toBe(true);
    expect(graphCanvasScopeViolations(GRAPH_CANVAS_ALLOWED)).toEqual([]);
    for (const marker of GRAPH_CANVAS_MARKERS) {
      const missing = GRAPH_CANVAS_MARKERS.filter(file => file !== marker);
      expect(hasGraphCanvasScope(missing)).toBe(false);
      expect(graphCanvasScopeViolations(missing)).not.toEqual([]);
      expect(graphCanvasKnowledgePolicy(missing)).toBe(PHASE6_KNOWLEDGE_POLICY);
      expect(phase8fCurrentScopeViolations([...missing])).not.toEqual([]);
    }
  });
  test("rejects every forbidden extra without borrowing old Core or skill authorization", () => {
    for (const extra of forbidden) {
      expect(graphCanvasScopeViolations([...GRAPH_CANVAS_MARKERS, extra]), extra).toEqual([extra]);
      expect(validateVisualMigrationDelta([...GRAPH_CANVAS_MARKERS, extra]).violations, extra).toEqual([extra]);
    }
    const mixed = [...GRAPH_CANVAS_MARKERS, ...SKILL_BOOTSTRAP_MARKERS, ...SKILL_BOOTSTRAP_PRODUCTION];
    expect(graphCanvasScopeViolations(mixed)).toContain("src/app/api/skills/route.ts");
    expect(validateVisualMigrationDelta(mixed).violations).toContain("src/app/api/skills/route.ts");
  });
  test("Phase6 adapter evaluates the whole delta with only the four exact exceptions", () => {
    const policy = graphCanvasKnowledgePolicy(GRAPH_CANVAS_MARKERS);
    expect(policy.authorizedExceptions).toEqual(GRAPH_CANVAS_PRODUCTION);
    expect(evaluateScopedPolicy([...GRAPH_CANVAS_MARKERS], policy)).toEqual({ applicable: true, violations: [] });
    for (const extra of forbidden.filter(file => !/^(docs\/|tests\/|\.env)/.test(file))) {
      expect(evaluateScopedPolicy([...GRAPH_CANVAS_MARKERS, extra], policy).violations.length, extra).toBeGreaterThan(0);
    }
  });
  test("8F cumulative adapter exempts only graph paths and preserves unrelated denials", () => {
    expect(phase8fCurrentScopeViolations([...GRAPH_CANVAS_MARKERS])).toEqual([]);
    for (const extra of forbidden.filter(file => /^(src\/|supabase\/|\.github\/)/.test(file)
      || ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"].includes(file))) {
      expect(phase8fCurrentScopeViolations([...GRAPH_CANVAS_MARKERS, extra]), extra).toEqual([extra]);
    }
  });
  test("binds the entire working candidate, including untracked files, to the accepted base", () => {
    const tracked = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", base, "--"], { encoding: "utf8" }).split("\0").filter(Boolean);
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    const entire = [...tracked, ...untracked], detail = hasActivityDetailScope(entire);
    if (detail) expect(activityDetailScopeViolations(resolveActivityDetailWorkingFiles())).toEqual([]);
    const historical = (files: string[]) => detail ? withoutActivityDetailAdditions(files) : files;
    const files = historical(entire);
    if (hasNewUserGuideScope(files)) {
      expect(newUserGuideScopeViolations(historical(resolveNewUserGuideWorkingFiles()))).toEqual([]);
      const additions = new Set<string>(NEW_USER_GUIDE_ADDITIONS);
      const newer = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", MOBILE_GRAPH_BASE, "--"], { encoding: "utf8" }).split("\0").filter(Boolean);
      expect(graphInteractionScopeViolations(historical([...newer, ...untracked]).filter(file => !additions.has(file)))).toEqual([]);
      const auditAdditions = new Set<string>(CONNECTED_FOCUS_AUDIT_ADDITIONS);
      expect(graphCanvasScopeViolations(files.filter(file => !additions.has(file) && !auditAdditions.has(file) && file !== "src/app/knowledge/page.tsx"))).toEqual([]);
    } else if (hasConnectedFocusScope(files)) {
      const newer = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", MOBILE_GRAPH_BASE, "--"], { encoding: "utf8" }).split("\0").filter(Boolean);
      expect(graphInteractionScopeViolations([...newer, ...untracked])).toEqual([]);
      const auditAdditions = new Set<string>(CONNECTED_FOCUS_AUDIT_ADDITIONS);
      expect(graphCanvasScopeViolations(files.filter(file => !auditAdditions.has(file) && file !== "src/app/knowledge/page.tsx"))).toEqual([]);
    } else if (hasMobileGraphScope(files)) {
      const newer = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", MOBILE_GRAPH_BASE, "--"], { encoding: "utf8" }).split("\0").filter(Boolean);
      expect(mobileGraphScopeViolations([...newer, ...untracked])).toEqual([]);
      const auditAdditions = new Set<string>(MOBILE_GRAPH_AUDIT_ADDITIONS);
      expect(graphCanvasScopeViolations(files.filter(file => !auditAdditions.has(file)))).toEqual([]);
    } else {
      expect(graphCanvasScopeViolations(files)).toEqual([]);
    }
  });
  test("checks the full committed PR or verified current-main first-parent range", () => {
    const delta = resolveGovernanceChangedFiles();
    expect(delta.files.length).toBeGreaterThan(0);
    if (hasActivityDetailScope(delta.files)) expect(activityDetailScopeViolations(resolveActivityDetailChangedFiles().files)).toEqual([]);
    else if (hasNewUserGuideScope(delta.files)) expect(newUserGuideScopeViolations(resolveNewUserGuideChangedFiles().files)).toEqual([]);
    else if (hasConnectedFocusScope(delta.files)) expect(graphInteractionScopeViolations(delta.files)).toEqual([]);
    else if (hasGraphCanvasScope(delta.files)) expect(graphCanvasScopeViolations(delta.files)).toEqual([]);
  });
});
