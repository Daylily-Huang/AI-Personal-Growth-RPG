import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ACTIVITY_DETAIL_BASE, ACTIVITY_DETAIL_CONTROL, ACTIVITY_DETAIL_PRODUCTION, ACTIVITY_DETAIL_TESTS,
  ACTIVITY_DETAIL_MARKERS, ACTIVITY_DETAIL_ADDITIONS, ACTIVITY_DETAIL_ALLOWED, hasActivityDetailScope,
  activityDetailScopeViolations, resolveActivityDetailWorkingFiles, resolveActivityDetailChangedFiles,
  withoutActivityDetailAdditions, activityDetailDashboardFiles, evaluateScopedPolicy, PHASE5_DASHBOARD_POLICY,
  NEW_USER_GUIDE_ALLOWED, NEW_USER_GUIDE_MARKERS, newUserGuideScopeViolations, resolveNewUserGuideWorkingFiles,
  NEW_USER_GUIDE_ADDITIONS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, SKILL_BOOTSTRAP_MARKERS,
  CONNECTED_FOCUS_MARKERS } from "./helpers/governance-delta";
import { validateVisualMigrationDelta } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations } from "./phase8f-ui-governance.test";
const extras = ["src/app/api/activities/route.ts", "src/app/api/activities/[id]/assess/route.ts", "src/app/api/assessments/[id]/confirm/route.ts",
  "src/app/api/dashboard/route.ts", "src/app/api/auth/login/route.ts", "src/app/activities/unsafe.tsx", "src/lib/store/request-repository.ts",
  "src/lib/store/repository.ts", "src/lib/store/supabase-repository.ts", "src/lib/ai/assess.ts", "src/lib/ai/prompts.ts",
  "src/lib/growth-engine/engine.ts", "src/lib/http/validation.ts", "src/lib/supabase/env.ts", "src/lib/reward/fold.ts",
  "src/lib/milestone/repository.ts", "src/components/dashboard/QuickLogCard.tsx", "src/components/layout/AppShellBoundary.tsx",
  "src/app/skills/page.tsx", "src/app/knowledge/page.tsx", "src/components/graph/useGraphCameraFit.ts", "src/proxy.ts",
  "supabase/migrations/0054_unsafe.sql", "package.json", "pnpm-lock.yaml", "next.config.ts", "vitest.config.ts", "tsconfig.json",
  ".github/workflows/ci.yml", ".env.local", "scripts/unsafe.cjs", "public/unsafe.svg", "tests/unsafe.test.ts", "docs/unsafe.md",
  "docs/SiteReadiness/07_NEW_USER_GUIDE_CONTRACT.md", "docs/Design ChatGPT/01_SYSTEM_RULES.md"];
const revision = (n: number) => String(n).repeat(40);
function fakeGit(head = revision(1), remote = revision(2), files: readonly string[] = ACTIVITY_DETAIL_ALLOWED) {
  const calls: string[] = [];
  const execute = (command: string) => {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === `merge-base ${ACTIVITY_DETAIL_BASE} HEAD`) return ACTIVITY_DETAIL_BASE;
    if (command === 'rev-parse "HEAD^1"') return revision(3);
    if (command.startsWith("diff ")) return [...files, ""].join("\0");
    if (command === "ls-files --others --exclude-standard -z") return "";
    throw Error("Unknown fake Git command");
  };
  return { execute, calls };
}
const canonical = (s: string) => s.replace(/\r\n/g, "\n");
describe("Activity09 strict current scope without historical permission laundering", () => {
  test("binds admitted09, exact22/all10/exclusive11 and four production/four new tests", () => {
    expect(createHash("sha256").update(canonical(readFileSync(ACTIVITY_DETAIL_CONTROL, "utf8"))).digest("hex").toUpperCase()).toBe("21C01BA24945783E5A03356A1A6A2CDEF4624960DBD774C6EB44F374CC81AF91");
    expect(ACTIVITY_DETAIL_ALLOWED).toHaveLength(22); expect(new Set(ACTIVITY_DETAIL_ALLOWED).size).toBe(22);
    expect(ACTIVITY_DETAIL_MARKERS).toHaveLength(10); expect(ACTIVITY_DETAIL_ADDITIONS).toHaveLength(11);
    expect(ACTIVITY_DETAIL_PRODUCTION).toHaveLength(4); expect(ACTIVITY_DETAIL_TESTS).toHaveLength(4);
    expect(ACTIVITY_DETAIL_ADDITIONS).not.toContain("docs/Design ChatGPT/02_PRODUCT_DESIGN.md");
    expect(ACTIVITY_DETAIL_ADDITIONS).toContain("tests/phase5-dashboard-ui.test.tsx"); expect(activityDetailScopeViolations(ACTIVITY_DETAIL_ALLOWED)).toEqual([]);
    expect(validateVisualMigrationDelta([...ACTIVITY_DETAIL_ALLOWED]).violations).toEqual([]); expect(phase8fCurrentScopeViolations([...ACTIVITY_DETAIL_MARKERS])).toEqual([]);
  });
  test.each(ACTIVITY_DETAIL_MARKERS)("missing marker %s cannot authorize privateGET or any new production", marker => {
    const files = ACTIVITY_DETAIL_MARKERS.filter(f => f !== marker); expect(hasActivityDetailScope(files)).toBe(false); expect(activityDetailScopeViolations(files).length).toBeGreaterThan(0);
    expect(validateVisualMigrationDelta([...files]).violations.length).toBeGreaterThan(0); expect(phase8fCurrentScopeViolations([...files]).length).toBeGreaterThan(0);
    expect(activityDetailDashboardFiles([...files])).toEqual(files);
  });
  test("09 presence is strict even for all nonvisual/API-only subsets before visual applicability", () => {
    for (let bits = 1; bits < 1 << ACTIVITY_DETAIL_MARKERS.length; bits++) {
      const files = ACTIVITY_DETAIL_MARKERS.filter((_, n) => bits & 1 << n);
      if (!files.includes(ACTIVITY_DETAIL_CONTROL)) continue;
      const result = validateVisualMigrationDelta([...files]);
      expect(result.isVisualPR, files.join("|")).toBe(true);
      expect(result.violations, files.join("|")).toEqual(activityDetailScopeViolations(files));
      if (!hasActivityDetailScope(files)) expect(result.violations.length).toBeGreaterThan(0);
    }
  });
  test.each(extras)("extra %s is rejected before filters or Dashboard exception", extra => {
    const files = [...ACTIVITY_DETAIL_MARKERS, extra]; expect(activityDetailScopeViolations(files)).toEqual([extra]); expect(validateVisualMigrationDelta(files).violations).toEqual([extra]); expect(() => activityDetailDashboardFiles(files)).toThrow("FAIL-CLOSED");
  });
  test.each([NEW_USER_GUIDE_MARKERS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, SKILL_BOOTSTRAP_MARKERS, CONNECTED_FOCUS_MARKERS].map(earlier => ({ earlier })))("no borrowing earlier scope %#", ({ earlier }) => {
    const mixed = [...new Set([...ACTIVITY_DETAIL_MARKERS, ...earlier])]; expect(activityDetailScopeViolations(mixed).length).toBeGreaterThan(0); expect(validateVisualMigrationDelta(mixed).violations.length).toBeGreaterThan(0);
  });
  test("Dashboard adapter exempts precisely the new route, retaining original policy and synthetic denial", () => {
    const files = [...ACTIVITY_DETAIL_ALLOWED], filtered = activityDetailDashboardFiles(files);
    expect(files.filter(f => !filtered.includes(f))).toEqual(["src/app/api/activities/[id]/route.ts"]);
    expect(evaluateScopedPolicy(filtered, PHASE5_DASHBOARD_POLICY)).toEqual({ applicable: true, violations: [] });
    expect(evaluateScopedPolicy(["src/components/dashboard/ActivityHistoryList.tsx", "src/app/api/activities/[id]/route.ts"], PHASE5_DASHBOARD_POLICY).violations).toHaveLength(1);
    expect(evaluateScopedPolicy(["src/app/dashboard/page.tsx", "src/lib/growth-engine/engine.ts"], PHASE5_DASHBOARD_POLICY).violations).toHaveLength(1);
  });
  test("actual working is exact22 before filtering old Guide21, with every old marker retained", () => {
    const current = resolveActivityDetailWorkingFiles(); expect([...current].sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort());
    expect(activityDetailScopeViolations(current)).toEqual([]);
    const historical = withoutActivityDetailAdditions(resolveNewUserGuideWorkingFiles()); expect(newUserGuideScopeViolations(historical)).toEqual([]); expect([...historical].sort()).toEqual([...NEW_USER_GUIDE_ALLOWED].sort());
    const combined = [...new Set([...NEW_USER_GUIDE_ALLOWED, ...ACTIVITY_DETAIL_ALLOWED])]; expect(withoutActivityDetailAdditions(combined).sort()).toEqual([...NEW_USER_GUIDE_ALLOWED].sort());
    expect(NEW_USER_GUIDE_ADDITIONS).toHaveLength(12);
  });
  test("all old helper text and02 prefix remain exactly, with only new appendices", () => {
    for (const file of ["tests/helpers/governance-delta.ts", "docs/Design ChatGPT/02_PRODUCT_DESIGN.md"]) {
      const old = execFileSync("git", ["show", `${ACTIVITY_DETAIL_BASE}:${file}`], { encoding: "utf8" }); expect(canonical(readFileSync(file, "utf8")).startsWith(canonical(old))).toBe(true);
    }
    expect(readFileSync("docs/Design ChatGPT/02_PRODUCT_DESIGN.md", "utf8")).toContain("# 74.");
  });
  test("protected Core/auth/AI/SQL and navigation remain baseline blobs", () => {
    for (const file of ["src/lib/store/request-repository.ts", "src/lib/store/supabase-repository.ts", "src/lib/http/validation.ts", "src/lib/ai/assess.ts", "src/lib/ai/prompts.ts", "src/lib/ai/schemas.ts", "src/lib/growth-engine/levels.ts", "src/proxy.ts", "src/components/layout/AppShellBoundary.tsx", "src/app/globals.css",
      "supabase/migrations/0049_phase8e_reward_wishes_rpc_authority.sql", "supabase/migrations/0050_phase8e_reward_canonical_source_fix.sql", "supabase/migrations/0053_zero_xp_manual_skill_authority.sql"]) {
      const baseline = execFileSync("git", ["show", `${ACTIVITY_DETAIL_BASE}:${file}`], { encoding: "utf8" }); expect(canonical(readFileSync(file, "utf8")), file).toBe(canonical(baseline));
    }
  });
  test("read-only page/API have no new authority, demo fallbacks, storage or secret references", () => {
    for (const file of ACTIVITY_DETAIL_PRODUCTION) expect(readFileSync(file, "utf8"), file).not.toMatch(/dangerouslySetInnerHTML|localStorage|sessionStorage|SUPABASE_SECRET|AI_API_KEY|OPENAI_API_KEY|\.rpc\(|method:\s*["'](?:POST|PATCH|DELETE)/);
    const api = readFileSync(ACTIVITY_DETAIL_PRODUCTION[1], "utf8"); expect(api).not.toContain("getRequestRepository"); expect(api).not.toContain("console."); expect(api).toContain('"private, no-store"');
  });
  test("full PR range includes all earlier candidate commits, never HEAD~1", () => { const fake = fakeGit(), delta = resolveActivityDetailChangedFiles(fake); expect(delta.range).toBe(`${ACTIVITY_DETAIL_BASE}...${revision(1)}`); expect(activityDetailScopeViolations(delta.files)).toEqual([]); expect(fake.calls).not.toContain('rev-parse "HEAD^1"'); });
  test("current main requires positive origin HEAD equality before first-parent", () => { const fake = fakeGit(revision(1), revision(1)), delta = resolveActivityDetailChangedFiles(fake); expect(delta.mode).toBe("current-main-push"); expect(delta.range).toBe(`${revision(3)}..${revision(1)}`); });
  test("older HEAD ancestor of newer remote still takes full PR range", () => { const fake = fakeGit(ACTIVITY_DETAIL_BASE, revision(2)); expect(resolveActivityDetailChangedFiles(fake).mode).toBe("pr-branch"); expect(fake.calls).not.toContain('rev-parse "HEAD^1"'); });
  test.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${ACTIVITY_DETAIL_BASE} HEAD`, 'rev-parse "HEAD^1"', "diff"])("Git error %s fails closed", failure => { const fake = fakeGit(revision(1), revision(1)); expect(() => resolveActivityDetailChangedFiles({ execute: command => { if (command === failure || (failure === "diff" && command.startsWith("diff "))) throw Error("fixture"); return fake.execute(command); } })).toThrow("FAIL-CLOSED"); });
  test.each(["tracked", "untracked"])("working %s error fails closed", failure => { const fake = fakeGit(); expect(() => resolveActivityDetailWorkingFiles({ execute: command => { if ((failure === "tracked" && command.startsWith("diff ")) || (failure === "untracked" && command.startsWith("ls-files "))) throw Error("fixture"); return fake.execute(command); } })).toThrow("FAIL-CLOSED"); });
  test("malformed revisions, wrong base, empty working and empty PR cannot pass", () => {
    const fake = fakeGit(); for (const [key, value] of [["rev-parse HEAD", "not-sha"], ["rev-parse origin/main", ""], [`merge-base ${ACTIVITY_DETAIL_BASE} HEAD`, revision(9)]]) expect(() => resolveActivityDetailChangedFiles({ execute: c => c === key ? value : fake.execute(c) })).toThrow("FAIL-CLOSED");
    expect(() => resolveActivityDetailChangedFiles(fakeGit(revision(1), revision(2), []))).toThrow("FAIL-CLOSED"); expect(() => resolveActivityDetailWorkingFiles(fakeGit(revision(1), revision(2), []))).toThrow("FAIL-CLOSED");
  });
});
