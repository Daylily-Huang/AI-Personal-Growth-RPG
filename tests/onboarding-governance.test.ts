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
import { ACTIVITY_DETAIL_BASE, ACTIVITY_DETAIL_CONTROL, ACTIVITY_DETAIL_ALLOWED,
  ACTIVITY_MAIN_BASE, ACTIVITY_MAIN_CONTROL, ACTIVITY_MAIN_MARKERS, ACTIVITY_MAIN_ALLOWED,
  ACTIVITY_MAIN_ADMISSION_SHA, activityMainScopeViolations, verifyActivityMainAdmission,
  resolveActivityMainWorkingFiles, resolveActivityMainChangedFiles, classifyActivityGuideCommittedRange,
  type NewUserGuideGitOptions } from "./helpers/governance-delta";

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
import { isProposalRejectionCheckout, proposalRejectionHistoricalFiles, assertProposalRejectionActualScope,
  proposalRejectionHistoricalContent, PROPOSAL_REJECTION_HISTORICAL_CONTENT } from "./helpers/governance-delta";
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
    const rejection = isProposalRejectionCheckout();
    const entire = rejection ? proposalRejectionHistoricalFiles(NEW_USER_GUIDE_BASE) : resolveNewUserGuideWorkingFiles(), detail = hasActivityDetailScope(entire);
    if (detail) expect(activityDetailScopeViolations(rejection ? proposalRejectionHistoricalFiles(ACTIVITY_DETAIL_BASE) : resolveActivityDetailWorkingFiles())).toEqual([]);
    const historical = (files: string[]) => detail ? withoutActivityDetailAdditions(files) : files;
    const current = historical(entire); expect(hasNewUserGuideScope(current)).toBe(true);
    expect(newUserGuideScopeViolations(current)).toEqual([]);
    const additions = new Set<string>(NEW_USER_GUIDE_ADDITIONS);
    const fromBase = (base: string) => historical(rejection ? proposalRejectionHistoricalFiles(base) : [...execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base, "--"], { encoding: "utf8" }).split("\0").filter(Boolean),
      ...execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)]);
    expect(graphInteractionScopeViolations(fromBase("f100d1fe10583d1b228e5ad23b0e9fded2730b25").filter(file => !additions.has(file)))).toEqual([]);
    const audits = new Set<string>(CONNECTED_FOCUS_AUDIT_ADDITIONS);
    expect(graphCanvasScopeViolations(fromBase("ab84df35319d08247388051c451be523afe3c7a7").filter(file => !additions.has(file) && !audits.has(file) && file !== "src/app/knowledge/page.tsx"))).toEqual([]);
    for (const extra of extras) expect(newUserGuideScopeViolations([...current, extra])).toEqual([extra]);
  }, isProposalRejectionCheckout() ? 30000 : 5000);
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
    assertHistoricalCommittedGuideScope();
  });
});

// The same historical caller is exercised below, not just its new selector in isolation.
function assertHistoricalCommittedGuideScope(options: NewUserGuideGitOptions = {}): void {
  if (!options.execute && isProposalRejectionCheckout(options.cwd)) {
    assertProposalRejectionActualScope(options);
    const historical = withoutActivityDetailAdditions(proposalRejectionHistoricalFiles(NEW_USER_GUIDE_BASE, options));
    expect(newUserGuideScopeViolations(historical)).toEqual([]);
    return;
  }
  const entire = resolveNewUserGuideChangedFiles(options);
  if (classifyActivityGuideCommittedRange(entire, options) !== "historical") return;
  if (hasActivityDetailScope(entire.files)) expect(activityDetailScopeViolations(resolveActivityDetailChangedFiles(options).files)).toEqual([]);
  const delta = { ...entire, files: hasActivityDetailScope(entire.files) ? withoutActivityDetailAdditions(entire.files) : entire.files };
  if (hasNewUserGuideScope(delta.files)) expect(newUserGuideScopeViolations(delta.files)).toEqual([]);
  else expect(graphInteractionScopeViolations(delta.files)).toEqual([]);
}
function correctiveGit(files: readonly string[], kind: "activity" | "corrective" | "pr" = "activity") {
  const head = revision(4), remote = kind === "pr" ? revision(5) : head;
  const parent = kind === "corrective" ? ACTIVITY_MAIN_BASE : ACTIVITY_DETAIL_BASE;
  const calls: string[] = [];
  return { calls, execute(command: string): string {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return parent;
    for (const base of [NEW_USER_GUIDE_BASE, ACTIVITY_DETAIL_BASE, ACTIVITY_MAIN_BASE]) if (command === `merge-base ${base} HEAD`) return base;
    if (command.startsWith("diff --no-renames --name-only -z ")) {
      if (kind === "pr" && command.includes(`${ACTIVITY_DETAIL_BASE}...`)) return ACTIVITY_DETAIL_ALLOWED.join("\0") + "\0";
      return files.join("\0") + (files.length ? "\0" : "");
    }
    if (command === "ls-files --others --exclude-standard -z") return "";
    throw Error("Unexpected fixture Git command: " + command);
  } };
}
describe("SiteReadiness10 post-main exact corrective admission without historical weakening", () => {
  test("chapter hash is frozen and all current selected paths stay inside the original22", () => {
    const doc = readFileSync(ACTIVITY_MAIN_CONTROL, "utf8");
    const block = doc.replace(/\r\n/g, "\n").match(/<!-- BEGIN:ACTIVITY_MAIN_GUARD_CORRECTIVE_ADMISSION -->[\s\S]*?<!-- END:ACTIVITY_MAIN_GUARD_CORRECTIVE_ADMISSION -->/)![0];
    expect(createHash("sha256").update(block).digest("hex").toUpperCase()).toBe(ACTIVITY_MAIN_ADMISSION_SHA);
    verifyActivityMainAdmission(doc);
    expect(ACTIVITY_MAIN_ALLOWED).toHaveLength(7); expect(ACTIVITY_MAIN_MARKERS).toHaveLength(3);
    for (const file of ACTIVITY_MAIN_ALLOWED) expect(ACTIVITY_DETAIL_ALLOWED).toContain(file);
    expect([...(isProposalRejectionCheckout() ? proposalRejectionHistoricalFiles(ACTIVITY_MAIN_BASE) : resolveActivityMainWorkingFiles())].sort()).toEqual([...ACTIVITY_MAIN_ALLOWED].sort());
  });
  test("actual b9cef main objects reproduce old22-to-shared11 failure, but the same new caller closes it", () => {
    const files = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", `${ACTIVITY_DETAIL_BASE}..${ACTIVITY_MAIN_BASE}`], { encoding: "utf8" }).split("\0").filter(Boolean);
    expect(files.sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort());
    expect(graphInteractionScopeViolations(withoutActivityDetailAdditions(files))).toHaveLength(11);
    const model = correctiveGit(files);
    expect(classifyActivityGuideCommittedRange(resolveNewUserGuideChangedFiles(model), model)).toBe("activity-main");
    expect(() => assertHistoricalCommittedGuideScope(model)).not.toThrow();
  });
  test("future corrective-main uses actual selected working paths and the same caller", () => {
    const files = isProposalRejectionCheckout() ? proposalRejectionHistoricalFiles(ACTIVITY_MAIN_BASE) : resolveActivityMainWorkingFiles(), model = correctiveGit(files, "corrective");
    expect(classifyActivityGuideCommittedRange(resolveNewUserGuideChangedFiles(model), model)).toBe("corrective-main");
    expect(() => assertHistoricalCommittedGuideScope(model)).not.toThrow();
    expect(resolveActivityMainChangedFiles(model).range).toBe(`${ACTIVITY_MAIN_BASE}..${revision(4)}`);
  });
  test("all127 incomplete main correction subsets reject, without changing the pure all3 scope", () => {
    for (let bits = 0; bits < (1 << ACTIVITY_MAIN_ALLOWED.length) - 1; bits++) {
      const files = ACTIVITY_MAIN_ALLOWED.filter((_, n) => bits & (1 << n)), model = correctiveGit(files, "corrective");
      expect(() => assertHistoricalCommittedGuideScope(model), files.join("|")).toThrow();
    }
    expect(activityMainScopeViolations(ACTIVITY_MAIN_MARKERS)).toEqual([]);
  });
  test.each(ACTIVITY_MAIN_MARKERS)("missing corrective marker %s cannot activate a scope", marker => {
    expect(activityMainScopeViolations(ACTIVITY_MAIN_ALLOWED.filter(f => f !== marker)).length).toBeGreaterThan(0);
  });
  test.each(extras)("corrective extra %s cannot compose old permissions", extra => {
    const files = [...ACTIVITY_MAIN_ALLOWED, extra], model = correctiveGit(files, "corrective");
    expect(activityMainScopeViolations(files)).toContain(extra);
    expect(() => assertHistoricalCommittedGuideScope(model)).toThrow();
  });
  test("cumulative full PR retains oldGuide21 and never borrows HEAD first-parent", () => {
    const combined = [...new Set([...NEW_USER_GUIDE_ALLOWED, ...ACTIVITY_DETAIL_ALLOWED])], model = correctiveGit(combined, "pr");
    expect(() => assertHistoricalCommittedGuideScope(model)).not.toThrow();
    expect(withoutActivityDetailAdditions(combined).sort()).toEqual([...NEW_USER_GUIDE_ALLOWED].sort());
    expect(model.calls).not.toContain('rev-parse "HEAD^1"');
    const corrective = resolveActivityMainChangedFiles(model);
    expect(corrective.mode).toBe("pr-branch"); expect(corrective.range).toBe(`${ACTIVITY_MAIN_BASE}...${revision(4)}`);
  });
  test("mode/range/files/accepted-base mismatches and duplicate paths fail closed", () => {
    const model = correctiveGit(ACTIVITY_DETAIL_ALLOWED), whole = resolveNewUserGuideChangedFiles(model);
    for (const forged of [{ ...whole, mode: "pr-branch" as const }, { ...whole, range: `${ACTIVITY_DETAIL_BASE}...${revision(4)}` },
      { ...whole, files: whole.files.slice(1) }, { ...whole, files: [...whole.files, whole.files[0]] }, { ...whole, mergeBase: revision(9) }])
      expect(() => classifyActivityGuideCommittedRange(forged, model)).toThrow("FAIL-CLOSED");
    expect(activityMainScopeViolations([...ACTIVITY_MAIN_ALLOWED, ACTIVITY_MAIN_CONTROL])).toContain("duplicate corrective paths");
  });
  test("every missing Activity marker fails before a main return", () => {
    for (const marker of [ACTIVITY_DETAIL_CONTROL, ...ACTIVITY_DETAIL_ALLOWED.filter(f => f.startsWith("src/"))]) {
      const model = correctiveGit(ACTIVITY_DETAIL_ALLOWED.filter(f => f !== marker));
      expect(() => assertHistoricalCommittedGuideScope(model)).toThrow();
    }
  });
  test.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${NEW_USER_GUIDE_BASE} HEAD`,
    `merge-base ${ACTIVITY_DETAIL_BASE} HEAD`, `merge-base ${ACTIVITY_MAIN_BASE} HEAD`, 'rev-parse "HEAD^1"', "diff"])("actual caller Git error %s fails closed", failure => {
    const kind = failure.includes(ACTIVITY_MAIN_BASE) ? "corrective" : "activity", files = kind === "corrective" ? ACTIVITY_MAIN_ALLOWED : ACTIVITY_DETAIL_ALLOWED;
    const model = correctiveGit(files, kind), broken = { execute: (command: string) => {
      if (command === failure || (failure === "diff" && command.startsWith("diff "))) throw Error("fixture Git error");
      return model.execute(command);
    } };
    expect(() => assertHistoricalCommittedGuideScope(broken)).toThrow("FAIL-CLOSED");
  });
  test.each(["rev-parse HEAD", "rev-parse origin/main", 'rev-parse "HEAD^1"'])("malformed SHA %s fails closed", failure => {
    const model = correctiveGit(ACTIVITY_MAIN_ALLOWED, "corrective");
    expect(() => assertHistoricalCommittedGuideScope({ execute: command => command === failure ? "HEAD~1" : model.execute(command) })).toThrow("FAIL-CLOSED");
  });
  test("nonancestor/empty Git and chapter read/tamper never return a verified class", () => {
    const model = correctiveGit(ACTIVITY_MAIN_ALLOWED, "corrective");
    for (const base of [NEW_USER_GUIDE_BASE, ACTIVITY_MAIN_BASE])
      expect(() => assertHistoricalCommittedGuideScope({ execute: c => c === `merge-base ${base} HEAD` ? revision(9) : model.execute(c) })).toThrow("FAIL-CLOSED");
    expect(() => assertHistoricalCommittedGuideScope(correctiveGit([], "corrective"))).toThrow("FAIL-CLOSED");
    const doc = readFileSync(ACTIVITY_MAIN_CONTROL, "utf8");
    for (const malformed of ["", doc.replace("mandatory3", "mandatory2"), doc + doc]) expect(() => verifyActivityMainAdmission(malformed)).toThrow("FAIL-CLOSED");
    expect(() => assertHistoricalCommittedGuideScope({ ...model, cwd: "/__activity_control_intentionally_absent__" })).toThrow("FAIL-CLOSED");
  });
  test("older HEAD under a newer remote still uses full PR correction range", () => {
    const model = correctiveGit(ACTIVITY_MAIN_ALLOWED, "pr");
    expect(resolveActivityMainChangedFiles(model).mode).toBe("pr-branch");
    expect(model.calls).not.toContain('rev-parse "HEAD^1"');
  });
  test("every nonselected original22 file and helper prefix retain baseline content", () => {
    const canonical = (s: string) => s.replace(/\r\n/g, "\n");
    for (const file of ACTIVITY_DETAIL_ALLOWED.filter(f => !(ACTIVITY_MAIN_ALLOWED as readonly string[]).includes(f)))
      expect(canonical(isProposalRejectionCheckout() && (PROPOSAL_REJECTION_HISTORICAL_CONTENT as readonly string[]).includes(file) ? proposalRejectionHistoricalContent(file) : readFileSync(file, "utf8")), file).toBe(canonical(execFileSync("git", ["show", `${ACTIVITY_MAIN_BASE}:${file}`], { encoding: "utf8" })));
    const helper = "tests/helpers/governance-delta.ts", old = execFileSync("git", ["show", `${ACTIVITY_MAIN_BASE}:${helper}`], { encoding: "utf8" });
    expect(canonical(readFileSync(helper, "utf8")).startsWith(canonical(old))).toBe(true);
    const oldDoc = execFileSync("git", ["show", `${ACTIVITY_MAIN_BASE}:${ACTIVITY_MAIN_CONTROL}`], { encoding: "utf8" });
    expect(canonical(readFileSync(ACTIVITY_MAIN_CONTROL, "utf8")).startsWith(canonical(oldDoc))).toBe(true);
  }, isProposalRejectionCheckout() ? 30000 : 5000);
});
