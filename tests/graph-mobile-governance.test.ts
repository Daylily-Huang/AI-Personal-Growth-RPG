import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  MOBILE_GRAPH_BASE, MOBILE_GRAPH_CONTROL, MOBILE_GRAPH_PRODUCTION, MOBILE_GRAPH_MARKERS, MOBILE_GRAPH_ALLOWED,
  hasMobileGraphScope, mobileGraphScopeViolations, mobileGraphKnowledgePolicy, graphCanvasKnowledgePolicy,
  GRAPH_CANVAS_MARKERS, SKILL_BOOTSTRAP_MARKERS, SKILL_BOOTSTRAP_PRODUCTION,
  evaluateScopedPolicy, resolveGovernanceChangedFiles,
  CONNECTED_FOCUS_CONTROL, CONNECTED_FOCUS_PAGES, CONNECTED_FOCUS_PRODUCTION, CONNECTED_FOCUS_MARKERS,
  CONNECTED_FOCUS_ALLOWED, CONNECTED_FOCUS_AUDIT_ADDITIONS, hasConnectedFocusScope,
  graphInteractionScopeViolations, graphInteractionKnowledgePolicy,
} from "./helpers/governance-delta";
import { validateVisualMigrationDelta } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations } from "./phase8f-ui-governance.test";

const forbidden = [
  "src/components/graph/useGraphCameraFit.ts", "src/app/skills/page.tsx", "src/app/knowledge/page.tsx",
  "src/app/skills/components/keyboard-navigation.ts", "src/app/knowledge/components/keyboard-navigation.ts",
  "src/app/api/skills/route.ts", "src/app/api/activities/[id]/assess/route.ts", "src/proxy.ts",
  "src/lib/growth-engine/engine.ts", "src/lib/ai/assess.ts", "src/lib/store/repository.ts",
  "src/lib/reward/fold.ts", "src/lib/milestone/repository.ts", "src/lib/knowledge/authority-service.ts",
  "src/components/ui/BaseModal.tsx", "src/components/layout/AppShell.tsx", "src/components/layout/MobileNav.tsx",
  "src/styles/design-tokens.css", "src/app/globals.css", "supabase/migrations/0053_zero_xp_manual_skill_authority.sql",
  "package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts",
  ".github/workflows/ci.yml", "scripts/unsafe.cjs", "public/unsafe.svg", ".env.local",
  "docs/Design ChatGPT/01_SYSTEM_RULES.md", "docs/SiteReadiness/02_GRAPH_CANVAS_READINESS_AND_RESIZE_CONTRACT.md",
  "tests/unsafe.test.ts", "tests/graph-camera-fit.test.tsx",
];
describe("SiteReadiness04 exact two-class graph scope", () => {
  test("binds the independently admitted immutable controller", () => {
    expect(createHash("sha256").update(readFileSync(MOBILE_GRAPH_CONTROL, "utf8").replace(/\r\n/g, "\n")).digest("hex").toUpperCase())
      .toBe("134E00DFCACADDBE0F8F1A7D3E5F9A2A44F51F31044CC84BC14DCD7E7A656311");
  });
  test("requires all five markers, fourteen allowed paths, and only two production files", () => {
    expect(MOBILE_GRAPH_MARKERS).toHaveLength(5); expect(MOBILE_GRAPH_ALLOWED).toHaveLength(14);
    expect(MOBILE_GRAPH_PRODUCTION).toHaveLength(2); expect(new Set(MOBILE_GRAPH_ALLOWED).size).toBe(14);
    expect(hasMobileGraphScope(MOBILE_GRAPH_MARKERS)).toBe(true); expect(mobileGraphScopeViolations(MOBILE_GRAPH_ALLOWED)).toEqual([]);
    for (const marker of MOBILE_GRAPH_MARKERS) {
      const missing = MOBILE_GRAPH_MARKERS.filter(file => file !== marker);
      expect(hasMobileGraphScope(missing)).toBe(false); expect(mobileGraphScopeViolations(missing)).not.toEqual([]);
      expect(mobileGraphKnowledgePolicy(missing)).toEqual(graphCanvasKnowledgePolicy(missing));
    }
  });
  test("blocks each forbidden extra across scope, visual and Phase6 actual adapters", () => {
    const policy = mobileGraphKnowledgePolicy(MOBILE_GRAPH_MARKERS);
    expect(policy.authorizedExceptions).toEqual(MOBILE_GRAPH_PRODUCTION);
    expect(evaluateScopedPolicy([...MOBILE_GRAPH_MARKERS], policy)).toEqual({ applicable: true, violations: [] });
    for (const extra of forbidden) {
      const files = [...MOBILE_GRAPH_MARKERS, extra];
      expect(mobileGraphScopeViolations(files), extra).toEqual([extra]);
      expect(validateVisualMigrationDelta(files).violations, extra).toEqual([extra]);
      if (/^(src\/|supabase\/|\.github\/|public\/|scripts\/)/.test(extra)
        || ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"].includes(extra)) {
        expect(evaluateScopedPolicy(files, mobileGraphKnowledgePolicy(files)).violations.length, extra).toBeGreaterThan(0);
      }
    }
  });
  test("cannot compose old camera, bootstrap or Core scope grants", () => {
    for (const old of [GRAPH_CANVAS_MARKERS, [...SKILL_BOOTSTRAP_MARKERS, ...SKILL_BOOTSTRAP_PRODUCTION]]) {
      const mixed = [...new Set([...MOBILE_GRAPH_MARKERS, ...old])];
      expect(mobileGraphScopeViolations(mixed)).not.toEqual([]);
      expect(validateVisualMigrationDelta(mixed).violations).not.toEqual([]);
      expect(evaluateScopedPolicy(mixed, mobileGraphKnowledgePolicy(mixed)).violations).not.toEqual([]);
    }
  });
  test("checks the full working-plus-untracked delta against accepted f100", () => {
    const tracked = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", MOBILE_GRAPH_BASE, "--"], { encoding: "utf8" }).split("\0").filter(Boolean);
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    const files = [...tracked, ...untracked];
    expect(hasMobileGraphScope(files)).toBe(true); expect(graphInteractionScopeViolations(files)).toEqual([]);
  });
  test("checks full committed PR or verified current-main first-parent range without swallowing Git errors", () => {
    const delta = resolveGovernanceChangedFiles(); expect(delta.files.length).toBeGreaterThan(0);
    if (delta.files.includes(MOBILE_GRAPH_CONTROL)) {
      expect(hasMobileGraphScope(delta.files)).toBe(true); expect(graphInteractionScopeViolations(delta.files)).toEqual([]);
    }
  });
});

describe("SiteReadiness06 focus successor without weakening old scopes", () => {
  test("binds immutable supplement and exact nineteen-path/nine-marker scope", () => {
    expect(createHash("sha256").update(readFileSync(CONNECTED_FOCUS_CONTROL, "utf8").replace(/\r\n/g, "\n")).digest("hex").toUpperCase())
      .toBe("698EDBDE6658D81F457EDC726508221A5A5D762F6EC18A24D57F11A9EB05D88A");
    expect(CONNECTED_FOCUS_ALLOWED).toHaveLength(19); expect(new Set(CONNECTED_FOCUS_ALLOWED).size).toBe(19);
    expect(CONNECTED_FOCUS_MARKERS).toHaveLength(9); expect(new Set(CONNECTED_FOCUS_MARKERS).size).toBe(9);
    expect(CONNECTED_FOCUS_AUDIT_ADDITIONS).toHaveLength(6); expect(CONNECTED_FOCUS_PRODUCTION).toHaveLength(4);
    expect(graphInteractionScopeViolations(CONNECTED_FOCUS_ALLOWED)).toEqual([]);
    expect(evaluateScopedPolicy([...CONNECTED_FOCUS_ALLOWED], graphInteractionKnowledgePolicy(CONNECTED_FOCUS_ALLOWED))).toEqual({ applicable: true, violations: [] });
    // The new admission exempts only pages, NOT Canvas files without their separate historical controller.
    expect(phase8fCurrentScopeViolations([...CONNECTED_FOCUS_MARKERS])).toEqual([...MOBILE_GRAPH_PRODUCTION]);
    expect(phase8fCurrentScopeViolations([...CONNECTED_FOCUS_MARKERS, ...GRAPH_CANVAS_MARKERS])).toEqual([]);
  });
  test("missing any marker restores exact prior policy and forbids supplemental pages", () => {
    for (const marker of CONNECTED_FOCUS_MARKERS) {
      const missing = CONNECTED_FOCUS_ALLOWED.filter(file => file !== marker);
      expect(hasConnectedFocusScope(missing), marker).toBe(false);
      expect(graphInteractionScopeViolations(missing), marker).toEqual(mobileGraphScopeViolations(missing));
      expect(graphInteractionScopeViolations(missing).length, marker).toBeGreaterThan(0);
      expect(graphInteractionKnowledgePolicy(missing), marker).toEqual(mobileGraphKnowledgePolicy(missing));
      const remainingPage = marker === "src/app/knowledge/page.tsx" ? "src/app/skills/page.tsx" : "src/app/knowledge/page.tsx";
      expect(phase8fCurrentScopeViolations([...CONNECTED_FOCUS_MARKERS].filter(file => file !== marker)), marker).toContain(remainingPage);
    }
  });
  test("all markers still reject arbitrary extras and old Core/SQL authorization mixes", () => {
    for (const extra of [...forbidden.filter(file => !CONNECTED_FOCUS_PAGES.includes(file as typeof CONNECTED_FOCUS_PAGES[number])), "src/app/knowledge/unsafe.tsx", "tests/graph-connected-unsafe.test.ts"]) {
      const files = [...CONNECTED_FOCUS_MARKERS, extra];
      expect(graphInteractionScopeViolations(files), extra).toEqual([extra]);
      expect(validateVisualMigrationDelta(files).violations, extra).toEqual([extra]);
      if (/^(src\/|supabase\/|\.github\/|public\/|scripts\/)/.test(extra) || ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"].includes(extra))
        expect(evaluateScopedPolicy(files, graphInteractionKnowledgePolicy(files)).violations.length, extra).toBeGreaterThan(0);
      if (/^(src\/|supabase\/|\.github\/)/.test(extra) || ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"].includes(extra))
        expect(phase8fCurrentScopeViolations(files), extra).toEqual([...MOBILE_GRAPH_PRODUCTION, extra]);
    }
    for (const old of [GRAPH_CANVAS_MARKERS, [...SKILL_BOOTSTRAP_MARKERS, ...SKILL_BOOTSTRAP_PRODUCTION]]) {
      const mixed = [...new Set([...CONNECTED_FOCUS_MARKERS, ...old])];
      expect(graphInteractionScopeViolations(mixed).length).toBeGreaterThan(0);
      expect(validateVisualMigrationDelta(mixed).violations.length).toBeGreaterThan(0);
    }
  });
});
