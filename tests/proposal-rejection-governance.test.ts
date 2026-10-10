import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  PROPOSAL_REJECTION_BASE as BASE, PROPOSAL_REJECTION_CONTROL as CONTROL,
  PROPOSAL_REJECTION_ADMISSION_SHA as ADMISSION_SHA, PROPOSAL_REJECTION_ALLOWED as ALLOWED,
  PROPOSAL_REJECTION_MARKERS as MARKERS, PROPOSAL_REJECTION_PRODUCTION as PRODUCTION,
  PROPOSAL_REJECTION_TESTS as TESTS, PROPOSAL_REJECTION_HISTORICAL_CONTENT as CONTENT,
  hasProposalRejectionScope, proposalRejectionScopeViolations as violations,
  verifyProposalRejectionAdmission, resolveProposalRejectionWorkingFiles as working,
  resolveProposalRejectionChangedFiles as changed, assertProposalRejectionActualScope as actual,
  assertProposalRejectionChangedScope as bindChanged, proposalRejectionHistoricalFiles as history,
  proposalRejectionHistoricalContent as historicalContent, proposalRejectionDashboardFiles as dashboardFiles,
  ACTIVITY_DETAIL_BASE, ACTIVITY_DETAIL_ALLOWED, ACTIVITY_MAIN_BASE, ACTIVITY_MAIN_ALLOWED,
  NEW_USER_GUIDE_BASE, NEW_USER_GUIDE_MARKERS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS,
  SKILL_BOOTSTRAP_MARKERS, CONNECTED_FOCUS_MARKERS, PHASE5_DASHBOARD_POLICY, evaluateScopedPolicy,
  type ProposalRejectionGitOptions,
} from "./helpers/governance-delta";
import { validateVisualMigrationDelta as visual } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations as phase8f } from "./phase8f-ui-governance.test";

const canonical = (value: string) => value.replace(/\r\n/g, "\n");
const document = () => readFileSync(CONTROL, "utf8");
const revision = (n: number) => String(n).repeat(40);
const extras = ["src/app/dashboard/page.tsx", "src/app/api/assessments/[id]/confirm/route.ts",
  "src/app/api/activities/[id]/assess/route.ts", "src/app/api/auth/login/route.ts", "src/app/api/assessments/route.ts",
  "src/lib/store/supabase-repository.ts", "src/lib/store/request-repository.ts", "src/lib/store/assessment-persistence.service.ts",
  "src/lib/growth-engine/engine.ts", "src/lib/ai/assess.ts", "src/lib/ai/prompts.ts", "src/lib/ai/schemas.ts",
  "src/lib/milestone/repository.ts", "src/lib/supabase/admin.ts", "src/lib/supabase/server.ts", "src/proxy.ts",
  "src/components/dashboard/QuickLogCard.tsx", "src/components/layout/AppShellContext.tsx", "src/styles/design-tokens.css",
  "src/app/globals.css", "supabase/migrations/0054_unsafe.sql", "package.json", "pnpm-lock.yaml", "next.config.ts",
  "vitest.config.ts", "tsconfig.json", ".github/workflows/ci.yml", ".env.local", "tests/unsafe.test.ts", "docs/unsafe.md",
  "docs/SiteReadiness/09_ACTIVITY_DETAIL_CONTRACT.md", "docs/Design ChatGPT/01_SYSTEM_RULES.md"];

function model(files: readonly string[] = ALLOWED, head = BASE, remote = revision(2)) {
  const calls: string[] = [];
  const execute = (command: string) => {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return BASE;
    if (command === `merge-base ${BASE} HEAD`) return BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command.startsWith("merge-base ") && command.endsWith(` ${BASE}`)) return command.split(" ")[1];
    if (command.startsWith(`show ${BASE}:`)) return "exact fixture content\n";
    if (command.startsWith("diff --no-renames --name-only -z ")) return files.join("\0") + (files.length ? "\0" : "");
    throw Error("Unexpected bounded fixture Git command");
  };
  return { execute, calls, readControl: document };
}
function altered(options: ProposalRejectionGitOptions, key: string, value: string | Error): ProposalRejectionGitOptions {
  return { ...options, execute: command => {
    if (command === key || (key === "diff" && command.startsWith("diff "))) {
      if (value instanceof Error) throw value;
      return value;
    }
    return options.execute!(command);
  } };
}

describe("Proposal Reject11 strict current25 and explicit accepted78d history", () => {
  test("binds the entire immutable contract and exact25/all12/fourproduction/sixnewtests", () => {
    expect(createHash("sha256").update(canonical(document())).digest("hex").toUpperCase()).toBe(ADMISSION_SHA);
    verifyProposalRejectionAdmission(document());
    expect(ALLOWED).toHaveLength(25); expect(new Set(ALLOWED).size).toBe(25);
    expect(MARKERS).toHaveLength(12); expect(PRODUCTION).toHaveLength(4); expect(TESTS).toHaveLength(6);
    const paths = canonical(document()).match(/```text\n([\s\S]*?)\n```/)![1].split("\n");
    expect([...ALLOWED].sort()).toEqual(paths.sort()); expect(violations(ALLOWED)).toEqual([]);
    expect(visual([...ALLOWED])).toEqual({ isVisualPR: true, violations: [] }); expect(phase8f([...MARKERS])).toEqual([]);
  });
  test.each(MARKERS)("missing marker %s cannot activate current scope", marker => {
    const files = ALLOWED.filter(file => file !== marker);
    expect(hasProposalRejectionScope(files)).toBe(false); expect(violations(files).length).toBeGreaterThan(0);
    expect(() => actual(model(files))).toThrow("FAIL-CLOSED");
    if (files.includes(CONTROL)) expect(visual([...files]).violations.length).toBeGreaterThan(0);
    expect(phase8f([...files]).length).toBeGreaterThan(0);
  });
  test.each(extras)("extra %s is denied before historical paths, content or Dashboard adaptation", extra => {
    const files = [...ALLOWED, extra], fixture = model(files);
    expect(violations(files)).toEqual([extra]); expect(visual(files).violations).toEqual([extra]);
    expect(() => actual(fixture)).toThrow("FAIL-CLOSED"); expect(() => history(ACTIVITY_DETAIL_BASE, fixture)).toThrow("FAIL-CLOSED");
    expect(() => historicalContent(CONTENT[0], fixture)).toThrow("FAIL-CLOSED"); expect(() => dashboardFiles(files)).toThrow("FAIL-CLOSED");
  });
  test("duplicate paths and every incomplete nonvisual selector fail before visual early return", () => {
    expect(violations([...MARKERS, CONTROL])).toContain("duplicate proposal paths");
    for (let bits = 1; bits < 1 << MARKERS.length; bits++) {
      const files = MARKERS.filter((_, n) => bits & 1 << n);
      if (!files.includes(CONTROL)) continue;
      expect(visual([...files])).toEqual({ isVisualPR: true, violations: violations(files) });
      if (files.length !== MARKERS.length) expect(visual([...files]).violations.length).toBeGreaterThan(0);
    }
  });
  test("no old marker set or 8F authorization can launder old/new mixed writes", () => {
    for (const previous of [NEW_USER_GUIDE_MARKERS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, SKILL_BOOTSTRAP_MARKERS, CONNECTED_FOCUS_MARKERS]) {
      const files = [...new Set([...ALLOWED, ...previous])]; expect(violations(files).length).toBeGreaterThan(0);
      expect(visual(files).violations.length).toBeGreaterThan(0); expect(() => actual(model(files))).toThrow("FAIL-CLOSED");
    }
    for (const file of extras.filter(file => file.startsWith("src/") || file.startsWith("supabase/")))
      expect(phase8f([...MARKERS, "docs/Phase8/27_PHASE8F_UI_CONTRACT.md", file]), file).toContain(file);
  });
  test("Dashboard adapter removes only the two admitted backend paths; old policy remains strict", () => {
    const filtered = dashboardFiles([...ALLOWED]); expect(ALLOWED.filter(file => !filtered.includes(file))).toEqual([PRODUCTION[0], PRODUCTION[3]]);
    expect(evaluateScopedPolicy(filtered, PHASE5_DASHBOARD_POLICY).violations).toEqual([]);
    expect(evaluateScopedPolicy(["src/app/dashboard/page.tsx", "src/lib/growth-engine/engine.ts"], PHASE5_DASHBOARD_POLICY).violations.length).toBeGreaterThan(0);
    expect(dashboardFiles([PRODUCTION[0]])).toEqual([PRODUCTION[0]]);
  });
  test("actual working/committed entry binds all25 before any historical projection", () => {
    expect([...actual()].sort()).toEqual([...ALLOWED].sort());
    expect(history(ACTIVITY_DETAIL_BASE).sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort());
    expect(history(ACTIVITY_MAIN_BASE).sort()).toEqual([...ACTIVITY_MAIN_ALLOWED].sort());
  });
  test("PR uses full78d-to-HEAD even if remote moved ahead, never HEAD~1", () => {
    for (const head of [BASE, revision(1)]) {
      const fixture = model(ALLOWED, head), delta = changed(fixture);
      expect(delta.mode).toBe("pr-branch"); expect(delta.range).toBe(`${BASE}...${head}`);
      expect(fixture.calls).not.toContain('rev-parse "HEAD^1"'); bindChanged(delta, fixture);
    }
  });
  test("future current main re-resolves exact25, positive remote equality and first parent", () => {
    const fixture = model(ALLOWED, revision(1), revision(1)), delta = changed(fixture);
    expect(delta.mode).toBe("current-main-push"); expect(delta.range).toBe(`${BASE}..${revision(1)}`);
    bindChanged(delta, fixture); expect(actual(fixture)).toEqual(ALLOWED);
    for (const forged of [{ ...delta, mode: "pr-branch" as const }, { ...delta, range: `${BASE}...${revision(1)}` },
      { ...delta, mergeBase: revision(9) }, { ...delta, files: delta.files.slice(1) }, { ...delta, files: [...delta.files, delta.files[0]] }])
      expect(() => bindChanged(forged, fixture)).toThrow("FAIL-CLOSED");
  });
  test.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${BASE} HEAD`, 'rev-parse "HEAD^1"', "diff"])("committed Git failure %s fails closed", key => {
    expect(() => changed(altered(model(ALLOWED, revision(1), revision(1)), key, Error("fixture")))).toThrow("FAIL-CLOSED");
  });
  test.each(["diff", "ls-files --others --exclude-standard -z"])("working Git failure %s fails closed", key => {
    expect(() => working(altered(model(), key, Error("fixture")))).toThrow("FAIL-CLOSED");
  });
  test("empty/malformed/duplicate Git output, wrong ancestry and invalid SHA fail closed", () => {
    for (const [key, value] of [["rev-parse HEAD", ""], ["rev-parse origin/main", "not-sha"], [`merge-base ${BASE} HEAD`, revision(9)],
      ["diff", ""], ["diff", "unterminated"], ["diff", `${CONTROL}\0${CONTROL}\0`], ["diff", "\0"]])
      expect(() => changed(altered(model(), key, value))).toThrow("FAIL-CLOSED");
    expect(() => working(model([]))).toThrow("FAIL-CLOSED");
    expect(() => working(altered(model(), "ls-files --others --exclude-standard -z", `${CONTROL}\0`))).toThrow("FAIL-CLOSED");
    const fixture = model(ALLOWED, revision(1));
    expect(() => actual(altered(fixture, `diff --no-renames --name-only -z ${BASE}...${revision(1)}`, `${CONTROL}\0`))).toThrow("FAIL-CLOSED");
  });
  test("whole contract hash/read failures and duplicate chapters cannot be ignored", () => {
    for (const text of [document() + "\n", document().replace("1024", "1025"), document() + document()])
      expect(() => actual({ ...model(), readControl: () => text })).toThrow("FAIL-CLOSED");
    expect(() => working({ ...model(), readControl: () => { throw Error("fixture read"); } })).toThrow("FAIL-CLOSED");
  });
  test("historical diff is explicit fixed78d and all invalid anchors/Git failures reject", () => {
    const fixture = model(); history(NEW_USER_GUIDE_BASE, fixture);
    expect(fixture.calls).toContain(`diff --no-renames --name-only -z ${NEW_USER_GUIDE_BASE} ${BASE}`);
    for (const anchor of ["HEAD", BASE, revision(9), `${NEW_USER_GUIDE_BASE} -- src`, ""]) expect(() => history(anchor, fixture)).toThrow("FAIL-CLOSED");
    expect(() => history(NEW_USER_GUIDE_BASE, altered(fixture, `merge-base ${NEW_USER_GUIDE_BASE} ${BASE}`, revision(9)))).toThrow("FAIL-CLOSED");
    expect(() => history(NEW_USER_GUIDE_BASE, altered(fixture, `diff --no-renames --name-only -z ${NEW_USER_GUIDE_BASE} ${BASE}`, Error("fixture")))).toThrow("FAIL-CLOSED");
  });
  test("only exact seven overlapping protected inputs use real78d left blob; all other paths reject", () => {
    const overlap = ACTIVITY_DETAIL_ALLOWED.filter(file => !(ACTIVITY_MAIN_ALLOWED as readonly string[]).includes(file) && (ALLOWED as readonly string[]).includes(file));
    expect([...CONTENT].sort()).toEqual(overlap.sort()); expect(CONTENT).toHaveLength(7);
    for (const file of CONTENT) expect(canonical(historicalContent(file))).toBe(canonical(execFileSync("git", ["show", `${BASE}:${file}`], { encoding: "utf8" })));
    for (const file of ["src/app/dashboard/page.tsx", "tests/helpers/governance-delta.ts", "docs/unsafe.md", "../secret", ""]) expect(() => historicalContent(file, model())).toThrow("FAIL-CLOSED");
    expect(() => historicalContent(CONTENT[0], altered(model(), `show ${BASE}:"${CONTENT[0]}"`, Error("fixture")))).toThrow("FAIL-CLOSED");
  }, 30000);
  test("accepted whole helper and02 prefixes plus Dashboard/SQL/Core remain untouched", () => {
    for (const file of ["tests/helpers/governance-delta.ts", "docs/Design ChatGPT/02_PRODUCT_DESIGN.md"])
      expect(canonical(readFileSync(file, "utf8")).startsWith(canonical(execFileSync("git", ["show", `${BASE}:${file}`], { encoding: "utf8" })))).toBe(true);
    for (const file of ["src/app/dashboard/page.tsx", "src/app/api/assessments/[id]/confirm/route.ts", "src/lib/store/request-repository.ts",
      "src/lib/supabase/admin.ts", "src/lib/supabase/server.ts", "src/lib/ai/prompts.ts", "src/lib/ai/schemas.ts", "src/app/globals.css",
      "src/styles/design-tokens.css", "supabase/migrations/0018_authority_rls_matrix.sql",
      "supabase/migrations/0049_phase8e_reward_wishes_rpc_authority.sql", "supabase/migrations/0050_phase8e_reward_canonical_source_fix.sql",
      "supabase/migrations/0053_zero_xp_manual_skill_authority.sql"])
      expect(canonical(readFileSync(file, "utf8")), file).toBe(canonical(execFileSync("git", ["show", `${BASE}:${file}`], { encoding: "utf8" })));
  });
});
