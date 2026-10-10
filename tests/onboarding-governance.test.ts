import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  NEW_USER_GUIDE_BASE, NEW_USER_GUIDE_CONTROL, NEW_USER_GUIDE_PRODUCTION, NEW_USER_GUIDE_TESTS,
  NEW_USER_GUIDE_MARKERS, NEW_USER_GUIDE_ADDITIONS, NEW_USER_GUIDE_ALLOWED,
  hasNewUserGuideScope, newUserGuideScopeViolations, resolveNewUserGuideWorkingFiles,
  resolveNewUserGuideChangedFiles, SKILL_BOOTSTRAP_MARKERS, SKILL_BOOTSTRAP_PRODUCTION,
  GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, CONNECTED_FOCUS_MARKERS,
  graphInteractionScopeViolations, CONNECTED_FOCUS_AUDIT_ADDITIONS, graphCanvasScopeViolations,
} from "./helpers/governance-delta";
import { validateVisualMigrationDelta } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations } from "./phase8f-ui-governance.test";
import { hasActivityDetailScope, activityDetailScopeViolations, resolveActivityDetailWorkingFiles,
  resolveActivityDetailChangedFiles, withoutActivityDetailAdditions } from "./helpers/governance-delta";

const extras = [
  "src/app/api/dashboard/route.ts", "src/app/api/skills/route.ts", "src/lib/store/request-repository.ts",
  "src/lib/store/repository.ts", "src/lib/store/supabase-repository.ts", "src/lib/growth-engine/engine.ts",
  "src/lib/ai/assess.ts", "src/lib/ai/prompts/assessment.ts", "src/lib/reward/fold.ts",
  "src/lib/milestone/repository.ts", "src/lib/skills/bootstrap.ts", "src/lib/supabase/env.ts",
  "src/lib/http/validation.ts", "src/proxy.ts", "src/components/ui/BaseModal.tsx",
  "src/components/layout/AppShellBoundary.tsx", "src/components/layout/AppSidebar.tsx", "src/components/layout/MobileNav.tsx",
  "src/components/dashboard/QuickLogCard.tsx", "src/app/dashboard/page.tsx", "src/app/quests/page.tsx",
  "src/app/skills/page.tsx", "src/app/knowledge/page.tsx", "src/components/graph/useGraphCameraFit.ts",
  "src/app/skills/components/SkillCreateForm.tsx", "src/components/quests/CreateQuestModal.tsx",
  "src/components/onboarding/unsafe.tsx", "src/lib/onboarding/unsafe.ts", "src/app/onboarding/unsafe.tsx",
  "src/styles/design-tokens.css", "src/app/globals.css", "supabase/migrations/0053_zero_xp_manual_skill_authority.sql",
  "supabase/migrations/0054_unsafe.sql", "package.json", "pnpm-lock.yaml", "next.config.ts",
  "tsconfig.json", "vitest.config.ts", ".github/workflows/ci.yml", ".env.local", ".env.example",
  "public/unsafe.svg", "scripts/unsafe.cjs", "tests/unsafe.test.ts",
  "docs/Design ChatGPT/01_SYSTEM_RULES.md", "docs/SiteReadiness/01_ZERO_XP_MANUAL_SKILL_CONTRACT.md",
  "docs/SiteReadiness/06_CONNECTED_KEYBOARD_FOCUS_CORRECTIVE_CONTRACT.md", "docs/unsafe.md",
];
const revision = (n: number) => String(n).repeat(40);
function fakeGit(head = revision(1), remote = revision(2), files: readonly string[] = NEW_USER_GUIDE_ALLOWED) {
  const calls: string[] = [];
  const execute = (command: string) => {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === `merge-base ${NEW_USER_GUIDE_BASE} HEAD`) return NEW_USER_GUIDE_BASE;
    if (command === 'rev-parse "HEAD^1"') return revision(3);
    if (command.startsWith("diff ")) return [...files, ""].join("\0");
    if (command === "ls-files --others --exclude-standard -z") return "";
    throw Error("Unknown fake command");
  };
  return { calls, execute };
}

describe("SiteReadiness07 strict presentational-only scope without historical weakening", () => {
  test("binds the immutable admitted contract, exact21/5/4/5/11/12 and no sixth guard", () => {
    expect(createHash("sha256").update(readFileSync(NEW_USER_GUIDE_CONTROL, "utf8").replace(/\r\n/g, "\n")).digest("hex").toUpperCase())
      .toBe("80D9A76814F8F21DCAAF35B973DFC500E6D6D369DD5E00B91D6AD583202752CF");
    expect(NEW_USER_GUIDE_ALLOWED).toHaveLength(21); expect(new Set(NEW_USER_GUIDE_ALLOWED).size).toBe(21);
    expect(NEW_USER_GUIDE_PRODUCTION).toHaveLength(5); expect(NEW_USER_GUIDE_TESTS).toHaveLength(4);
    expect(NEW_USER_GUIDE_MARKERS).toHaveLength(11); expect(NEW_USER_GUIDE_ADDITIONS).toHaveLength(12);
    expect(NEW_USER_GUIDE_ALLOWED).toContain("tests/graph-mobile-governance.test.ts");
    expect(NEW_USER_GUIDE_ALLOWED).not.toContain("tests/phase5-dashboard-ui.test.tsx");
    expect(hasNewUserGuideScope(NEW_USER_GUIDE_ALLOWED)).toBe(true);
    expect(newUserGuideScopeViolations(NEW_USER_GUIDE_ALLOWED)).toEqual([]);
    expect(validateVisualMigrationDelta([...NEW_USER_GUIDE_ALLOWED]).violations).toEqual([]);
    expect(phase8fCurrentScopeViolations([...NEW_USER_GUIDE_MARKERS])).toEqual([]);
  });
  test.each(NEW_USER_GUIDE_MARKERS)("missing marker %s never grants current scope", marker => {
    const files = NEW_USER_GUIDE_ALLOWED.filter(file => file !== marker);
    expect(hasNewUserGuideScope(files)).toBe(false); expect(newUserGuideScopeViolations(files).length).toBeGreaterThan(0);
    const production = NEW_USER_GUIDE_PRODUCTION.filter(file => file !== marker);
    expect(phase8fCurrentScopeViolations([...NEW_USER_GUIDE_MARKERS].filter(file => file !== marker))).toEqual(production);
  });
  test("every extra remains rejected even under all markers and old controller spoofs", () => {
    for (const extra of extras) {
      const files = [...NEW_USER_GUIDE_ALLOWED, extra];
      expect(newUserGuideScopeViolations(files), extra).toEqual([extra]);
      expect(validateVisualMigrationDelta(files).violations, extra).toEqual([extra]);
      expect(newUserGuideScopeViolations([...files, ...SKILL_BOOTSTRAP_MARKERS, ...SKILL_BOOTSTRAP_PRODUCTION]), extra).toContain(extra);
    }
    for (const old of [SKILL_BOOTSTRAP_MARKERS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, CONNECTED_FOCUS_MARKERS])
      expect(newUserGuideScopeViolations([...NEW_USER_GUIDE_ALLOWED, ...old]).length).toBeGreaterThan(0);
  });
  test("unchanged helper prefix, frozen rules/tokens and protected production stay accepted", () => {
    const file = "tests/helpers/governance-delta.ts";
    const old = execFileSync("git", ["show", `${NEW_USER_GUIDE_BASE}:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    expect(readFileSync(file, "utf8").replace(/\r\n/g, "\n").startsWith(old)).toBe(true);
    for (const protectedFile of ["src/components/layout/AppShellBoundary.tsx", "src/components/layout/AppShell.tsx",
      "src/components/dashboard/QuickLogCard.tsx", "src/app/dashboard/page.tsx", "src/app/skills/page.tsx", "src/app/knowledge/page.tsx",
      "src/lib/http/validation.ts", "src/app/api/dashboard/route.ts", "src/lib/store/request-repository.ts",
      "src/styles/design-tokens.css", "src/app/globals.css", "docs/Design ChatGPT/01_SYSTEM_RULES.md",
      "docs/SiteReadiness/04_GRAPH_MOBILE_OVERLAY_AND_CONNECTED_NAV_CONTRACT.md", "docs/SiteReadiness/06_CONNECTED_KEYBOARD_FOCUS_CORRECTIVE_CONTRACT.md"]) {
      expect(execFileSync("git", ["hash-object", `--path=${protectedFile}`, protectedFile], { encoding: "utf8" }).trim(), protectedFile)
        .toBe(execFileSync("git", ["rev-parse", `${NEW_USER_GUIDE_BASE}:${protectedFile}`], { encoding: "utf8" }).trim());
    }
  });
  test("product02 is only an appended L1 clarification, with its full old text preserved", () => {
    const file = "docs/Design ChatGPT/02_PRODUCT_DESIGN.md";
    const old = execFileSync("git", ["show", `${NEW_USER_GUIDE_BASE}:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    expect(readFileSync(file, "utf8").replace(/\r\n/g, "\n").startsWith(old)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("# 73.");
  });
  test("actual entire working tracked+untracked is strict before any historical filtering", () => {
    const entire = resolveNewUserGuideWorkingFiles(), detail = hasActivityDetailScope(entire);
    if (detail) expect(activityDetailScopeViolations(resolveActivityDetailWorkingFiles())).toEqual([]);
    const historical = (files: string[]) => detail ? withoutActivityDetailAdditions(files) : files;
    const current = historical(entire); expect(hasNewUserGuideScope(current)).toBe(true);
    expect(newUserGuideScopeViolations(current)).toEqual([]);
    const additions = new Set<string>(NEW_USER_GUIDE_ADDITIONS);
    const fromBase = (base: string) => historical([...execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base, "--"], { encoding: "utf8" }).split("\0").filter(Boolean),
      ...execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)]);
    expect(graphInteractionScopeViolations(fromBase("f100d1fe10583d1b228e5ad23b0e9fded2730b25").filter(file => !additions.has(file)))).toEqual([]);
    const audits = new Set<string>(CONNECTED_FOCUS_AUDIT_ADDITIONS);
    expect(graphCanvasScopeViolations(fromBase("ab84df35319d08247388051c451be523afe3c7a7").filter(file => !additions.has(file) && !audits.has(file) && file !== "src/app/knowledge/page.tsx"))).toEqual([]);
    for (const extra of extras) expect(newUserGuideScopeViolations([...current, extra])).toEqual([extra]);
  });
  test("pure presentation code has no write, private config, storage or AI authority", () => {
    for (const file of NEW_USER_GUIDE_PRODUCTION.slice(0, 3)) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/(?:SUPABASE_SECRET|SERVICE_ROLE|AI_API_KEY|OPENAI_API_KEY|localStorage|sessionStorage|dangerouslySetInnerHTML|\.rpc\(|method:\s*["'](?:POST|PATCH|DELETE)|onboarding_completed)/);
      expect(source).not.toMatch(/from ["']@\/lib\/(?:store|supabase|auth|growth-engine|ai)\//);
    }
  });
  test("full PR range is accepted-base-to-HEAD, not HEAD~1", () => {
    const fake = fakeGit(), delta = resolveNewUserGuideChangedFiles(fake);
    expect(delta.mode).toBe("pr-branch"); expect(delta.range).toBe(`${NEW_USER_GUIDE_BASE}...${revision(1)}`);
    expect(newUserGuideScopeViolations(delta.files)).toEqual([]); expect(fake.calls).not.toContain('rev-parse "HEAD^1"');
  });
  test("current main uses first parent only after positive remote HEAD equality", () => {
    const fake = fakeGit(revision(1), revision(1)), delta = resolveNewUserGuideChangedFiles(fake);
    expect(delta.mode).toBe("current-main-push"); expect(delta.range).toBe(`${revision(3)}..${revision(1)}`);
    expect(newUserGuideScopeViolations(delta.files)).toEqual([]);
  });
  test("HEAD as an ancestor of newer origin/main cannot borrow first-parent context", () => {
    const fake = fakeGit(NEW_USER_GUIDE_BASE, revision(2), []);
    expect(() => resolveNewUserGuideChangedFiles(fake)).toThrow("FAIL-CLOSED");
    expect(fake.calls).not.toContain('rev-parse "HEAD^1"');
  });
  test.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${NEW_USER_GUIDE_BASE} HEAD`, 'rev-parse "HEAD^1"', "diff"])("Git failure %s is not swallowed", failure => {
    const fake = fakeGit(revision(1), revision(1));
    expect(() => resolveNewUserGuideChangedFiles({ execute: command => {
      if (command === failure || (failure === "diff" && command.startsWith("diff "))) throw Error("fixture Git failure");
      return fake.execute(command);
    } })).toThrow("FAIL-CLOSED");
  });
  test("wrong base, invalid revisions and empty ranges fail closed", () => {
    const fake = fakeGit();
    for (const [command, value] of [["rev-parse HEAD", ""], ["rev-parse origin/main", "HEAD~1"], [`merge-base ${NEW_USER_GUIDE_BASE} HEAD`, revision(9)]])
      expect(() => resolveNewUserGuideChangedFiles({ execute: input => input === command ? value : fake.execute(input) })).toThrow("FAIL-CLOSED");
    expect(() => resolveNewUserGuideChangedFiles(fakeGit(revision(1), revision(2), []))).toThrow("FAIL-CLOSED");
  });
  test.each(["tracked", "untracked"])("working %s Git failure is not converted to empty success", failure => {
    expect(() => resolveNewUserGuideWorkingFiles({ execute: command => {
      if ((failure === "tracked" && command.startsWith("diff ")) || (failure === "untracked" && command.startsWith("ls-files "))) throw Error("failure");
      return "";
    } })).toThrow("FAIL-CLOSED");
  });
  test("actual committed range retains old accepted PR53 scope before this candidate is committed", () => {
    const entire = resolveNewUserGuideChangedFiles();
    if (hasActivityDetailScope(entire.files)) expect(activityDetailScopeViolations(resolveActivityDetailChangedFiles().files)).toEqual([]);
    const delta = { ...entire, files: hasActivityDetailScope(entire.files) ? withoutActivityDetailAdditions(entire.files) : entire.files };
    if (hasNewUserGuideScope(delta.files)) expect(newUserGuideScopeViolations(delta.files)).toEqual([]);
    else expect(graphInteractionScopeViolations(delta.files)).toEqual([]);
  });
});
