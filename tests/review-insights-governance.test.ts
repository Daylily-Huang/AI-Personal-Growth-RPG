import { restoreCommercialGuard } from "./helpers/commercial-scope";
import { restoreMonthlyOnboarding, restoreMonthlyReviewClient } from "./helpers/monthly-scope";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { REVIEW_INSIGHTS_BASE as BASE, REVIEW_INSIGHTS_CONTROL as CONTROL, REVIEW_INSIGHTS_ADMISSION_SHA as HASH, REVIEW_INSIGHTS_ALLOWED as ALLOWED, REVIEW_INSIGHTS_MARKERS as MARKERS, REVIEW_INSIGHTS_PRODUCTION as PRODUCTION, REVIEW_INSIGHTS_TESTS as TESTS, REVIEW_INSIGHTS_OLD_TESTS as OLD,
  assertReviewInsightsActualScope as actual, resolveReviewInsightsChangedFiles as changed, assertReviewInsightsChangedScope as bind, hasReviewInsightsScope as has, reviewInsightsScopeViolations as violations, verifyReviewInsightsAdmission as verify, reviewHistoricalArtifactOptions, reviewHistoricalFunction, reviewHistoricalReader, ARTIFACT_MANUAL_BASE, ARTIFACT_MANUAL_ALLOWED, assertArtifactManualActualScope, artifactManualCumulativeFiles, artifactManualProposalFiles, type ReviewInsightsGitOptions } from "./helpers/governance-delta";
import { validateVisualMigrationDelta as visual } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations as phase8f } from "./phase8f-ui-governance.test";

const canonical = (s: string) => s.replace(/\r\n/g, "\n"), git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16e6 }), blob = (path: string) => canonical(git("show", `${BASE}:${path}`)), control = () => readFileSync(CONTROL, "utf8"), revision = (n: number) => String(n).repeat(40);
function model(files: readonly string[] = ALLOWED, head = BASE, remote = BASE): ReviewInsightsGitOptions & { calls: string[] } {
  const calls: string[] = [];
  return { calls, readControl: control, execute(command) {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command.startsWith("merge-base ")) return BASE;
    if (command.startsWith("diff --no-renames --name-only -z ")) return [...files, ""].join("\0");
    throw Error("Unknown new Review synthetic command: " + command);
  } };
}
function override(options: ReviewInsightsGitOptions, key: string, value: string | Error): ReviewInsightsGitOptions {
  return { ...options, execute(command) { if (command === key || key === "diff" && command.startsWith("diff ")) { if (value instanceof Error) throw value; return value; } return options.execute!(command); } };
}
function restoreOld(text: string): string {
  return canonical(restoreMonthlyOnboarding(text)).replace(/^\/\/ REVIEW_HISTORY_ADAPTER_BEGIN\n[\s\S]*?^\/\/ REVIEW_HISTORY_ADAPTER_END\n/m, "")
    .replace(/^  \/\/ REVIEW_SCOPE_SELECTOR_BEGIN\n[\s\S]*?^  \/\/ REVIEW_SCOPE_SELECTOR_END\n/m, "")
    .replace(/\b(\w+) as reviewPrevious_(\w+)/g, (_m, original, alias) => original === alias ? original : original + " as " + alias)
    .replace(/\bimport reviewPrevious_fs from/g, "import fs from");
}
describe("Review22 current42 first, exact immutable699 old regression second", () => {
  it("binds exact42/all23/12production/8tests/13old and zero migration", () => {
    verify(control()); expect(createHash("sha256").update(canonical(control())).digest("hex").toUpperCase()).toBe(HASH);
    expect(ALLOWED).toHaveLength(42); expect(new Set(ALLOWED).size).toBe(42); expect(MARKERS).toHaveLength(23); expect(PRODUCTION).toHaveLength(12); expect(TESTS).toHaveLength(8); expect(OLD).toHaveLength(13);
    expect([...ALLOWED].sort()).toEqual(canonical(control()).match(/```text\n([\s\S]*?)\n```/)![1].split("\n").sort()); expect(ALLOWED.some((p: string) => p.startsWith("supabase/") || p === "package.json")).toBe(false);
    expect(violations(ALLOWED)).toEqual([]); expect(visual([...ALLOWED])).toEqual({ isVisualPR: true, violations: [] }); expect(phase8f([...ALLOWED])).toEqual([]);
  });
  it.each(MARKERS)("missing marker %s cannot use old20 fallback", marker => {
    const files = ALLOWED.filter(f => f !== marker); expect(has(files)).toBe(false); expect(violations(files).length).toBeGreaterThan(0); expect(() => actual(model(files))).toThrow("FAIL-CLOSED");
    expect(visual([...files]).violations.length).toBeGreaterThan(0); expect(phase8f([...files]).length).toBeGreaterThan(0);
  });
  it.each(ALLOWED)("all42 path %s remains mandatory", file => expect(() => actual(model(ALLOWED.filter(f => f !== file)))).toThrow("FAIL-CLOSED"));
  it.each(["src/lib/growth-engine/xp.ts", "src/lib/ai/assess.ts", "src/lib/ai/prompts.ts", "src/lib/store/repository.ts", "src/lib/store/settlement.service.ts", "src/lib/reward/fold.ts", "src/lib/milestone/repository.ts", "src/components/layout/AppShell.tsx", "src/app/globals.css", "src/styles/design-tokens.css", "supabase/migrations/0057_not_admitted.sql", "supabase/migrations/0056_artifact_manual_acceptance.sql", "package.json", "pnpm-lock.yaml", "vitest.config.ts", ".env.local", "密钥不要上传.txt", ".github/workflows/ci.yml", "tests/unsafe.test.ts", "docs/SiteReadiness/20_ARTIFACT_MANUAL_ACCEPTANCE_CONTRACT.md"])("extra/mixed %s denied", extra => {
    const files = [...ALLOWED, extra]; expect(violations(files)).toEqual([extra]); expect(() => actual(model(files))).toThrow("FAIL-CLOSED"); expect(visual(files).violations).toEqual([extra]); expect(phase8f(files)).toEqual([extra]);
  });
  it("duplicate and inherited old46 do not buy permission", () => {
    expect(violations([...ALLOWED, CONTROL])).toContain("duplicate Review paths"); expect(() => actual(model([...new Set([...ALLOWED, ...ARTIFACT_MANUAL_ALLOWED])]))).toThrow("FAIL-CLOSED"); expect(() => actual(model([]))).toThrow("FAIL-CLOSED");
  });
  it("binds both fullPR and current-main firstparent, never HEAD~1 fallback", () => {
    for (const [head, remote] of [[revision(1), BASE], [revision(1), revision(1)]]) {
      const opts = model(ALLOWED, head, remote), delta = changed(opts); bind(delta, opts); expect(actual(opts).sort()).toEqual([...ALLOWED].sort()); expect(delta.range).toBe(BASE + (head === remote ? ".." : "...") + head);
      for (const forged of [{ ...delta, files: delta.files.slice(1) }, { ...delta, files: [...delta.files, CONTROL] }, { ...delta, range: "HEAD~1..HEAD" }, { ...delta, mergeBase: revision(9) }]) expect(() => bind(forged, opts)).toThrow("FAIL-CLOSED");
    }
    expect(() => changed(override(model(ALLOWED, revision(1), revision(1)), 'rev-parse "HEAD^1"', ARTIFACT_MANUAL_BASE))).toThrow("FAIL-CLOSED");
  });
  it.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${BASE} HEAD`, `merge-base ${BASE} origin/main`, "diff", "ls-files --others --exclude-standard -z", 'rev-parse "HEAD^1"'])("Git failure %s is failclosed/reached", key => {
    const opts = model(ALLOWED, revision(1), revision(1)); let reached = false;
    expect(() => actual({ ...opts, execute(command) { if (command === key || key === "diff" && command.startsWith("diff ")) { reached = true; throw Error("independent injected Git error"); } return opts.execute!(command); } })).toThrow("FAIL-CLOSED"); expect(reached).toBe(true);
  });
  it("rejects malformed path/control/ancestry and end-of-call drift", () => {
    for (const raw of ["unterminated", "../secret\0", "/absolute\0", "a\\b\0", "a\nb\0", `${CONTROL}\0${CONTROL}\0`]) expect(() => actual(override(model(), "diff", raw))).toThrow("FAIL-CLOSED");
    for (const text of ["", control() + "\n", control().replace("10000行", "10001行")]) expect(() => actual({ ...model(), readControl: () => text })).toThrow("FAIL-CLOSED");
    expect(() => actual(override(model(), `merge-base ${BASE} HEAD`, revision(9)))).toThrow("FAIL-CLOSED");
    for (const key of ["rev-parse HEAD", "rev-parse origin/main"]) { const opts = model(); let count = 0; expect(() => actual({ ...opts, execute(command) { return command === key && ++count > 1 ? revision(9) : opts.execute!(command); } })).toThrow("FAIL-CLOSED"); }
    let reads = 0; expect(() => actual({ ...model(), readControl: () => control() + (++reads > 1 ? "\n" : "") })).toThrow("FAIL-CLOSED");
  });
  it.each(["tracked-extra", "untracked-extra", "tracked-missing"])("rechecks complete working/untracked scope after terminal HEAD check: %s", kind => {
    const opts = model(); let headReads = 0, drift = false;
    expect(() => actual({ ...opts, execute(command) {
      const before = opts.execute!(command); if (command === "rev-parse HEAD" && ++headReads === 2) drift = true;
      if (drift && command.startsWith("diff --no-renames --name-only -z ") && kind === "tracked-extra") return [...ALLOWED, "src/lib/growth-engine/xp.ts", ""].join("\0");
      if (drift && command === "ls-files --others --exclude-standard -z" && kind === "untracked-extra") return "src/lib/growth-engine/xp.ts\0";
      if (drift && command.startsWith("diff --no-renames --name-only -z ") && kind === "tracked-missing") return [...ALLOWED.slice(1), ""].join("\0");
      return before;
    } })).toThrow("FAIL-CLOSED"); expect(drift).toBe(true);
  });
  it("real strict42 is independently required before actual old46/53/cumulative78", () => {
    expect(actual().sort()).toEqual([...ALLOWED].sort()); const opts = reviewHistoricalArtifactOptions();
    expect(assertArtifactManualActualScope(opts).sort()).toEqual([...ARTIFACT_MANUAL_ALLOWED].sort()); expect(artifactManualProposalFiles(opts)).toHaveLength(53); expect(artifactManualCumulativeFiles(opts)).toHaveLength(78);
    expect(opts.execute!("rev-parse HEAD").trim()).toBe(BASE); expect(opts.execute!("rev-parse origin/main").trim()).toBe(ARTIFACT_MANUAL_BASE);
    for (const marker of MARKERS) expect(() => reviewHistoricalArtifactOptions(model(ALLOWED.filter(f => f !== marker)))).toThrow("FAIL-CLOSED");
  }, 60000);
  it("every explicit synthetic provider/identity is preserved and original path reached", () => {
    const opts = model(), previous = (value: ReviewInsightsGitOptions) => { expect(value).toBe(opts); value.execute!("rev-parse HEAD"); return 17; };
    expect(reviewHistoricalFunction(previous)(opts)).toBe(17); expect(opts.calls).toEqual(["rev-parse HEAD"]);
    const explicit = { cwd: "/", readControl: () => "outside", execute: () => { throw Error("explicit error reached"); } };
    expect(() => reviewHistoricalFunction((o: ReviewInsightsGitOptions) => o.execute!("rev-parse HEAD"))(explicit)).toThrow("explicit error reached");
    for (const reader of ["readControl", "readFixture", "readAmendment", "readUIFixture", "readAPIFixture"] as const) {
      let reached = false; const provided = { [reader]: () => { reached = true; throw Error("own provider reached"); } };
      expect(() => reviewHistoricalFunction((o: typeof provided) => o[reader]!())(provided)).toThrow("own provider reached"); expect(reached).toBe(true);
    }
  });
  it("all13 old WHOLE files invert to699; all bodies/models/assertions/timeouts preserved", () => {
    for (const file of OLD) { const current = restoreCommercialGuard(file, canonical(readFileSync(file, "utf8"))); expect(restoreOld(current), file).toBe(blob(file)); expect(current.match(/REVIEW_HISTORY_ADAPTER_BEGIN/g)).toHaveLength(1); }
    const reader = reviewHistoricalReader(readFileSync); for (const file of OLD) expect(canonical(reader(file, "utf8"))).toBe(blob(file));
    expect(reader("src/lib/growth-engine/xp.ts", "utf8")).toBe(readFileSync("src/lib/growth-engine/xp.ts", "utf8"));
  }, 60000);
  it("helper entire accepted699 prefix and all56 migrations/authority/constants remain exact", () => {
    expect(canonical(readFileSync("tests/helpers/governance-delta.ts", "utf8")).startsWith(blob("tests/helpers/governance-delta.ts"))).toBe(true);
    const sql = readdirSync("supabase/migrations").filter(n => /^00(?:[0-4]\d|5[0-6])_.*\.sql$/.test(n)); expect(sql).toHaveLength(56);
    for (const path of [...sql.map(n => "supabase/migrations/" + n), "src/lib/growth-engine/xp.ts", "src/lib/growth-engine/levels.ts", "src/lib/growth-engine/mastery.ts", "src/lib/ai/prompts.ts", "src/lib/ai/schemas.ts", "src/lib/ai/assess.ts", "src/lib/milestone/repository.ts", "src/lib/reward/fold.ts", "src/lib/store/settlement.service.ts", "src/app/globals.css", "src/styles/design-tokens.css", "package.json", "pnpm-lock.yaml", ".github/workflows/ci.yml"]) expect(canonical(readFileSync(path, "utf8")), path).toBe(blob(path));
    const sql49 = blob("supabase/migrations/0049_phase8e_reward_wishes_rpc_authority.sql"); expect(sql49).toContain("IMMUTABLE");
  }, 30000);
  it("ReviewsClient new marked islands reverse whole source; old FINAL logic unchanged", () => {
    const file = "src/components/journey/ReviewsClient.tsx", current = canonical(readFileSync(file, "utf8"));
    const restored = restoreMonthlyReviewClient(current).replace(/^ *\/\/ REVIEW_INSIGHTS_(?:IMPORT|STATE|MATCH)_BEGIN\n[\s\S]*?^ *\/\/ REVIEW_INSIGHTS_(?:IMPORT|STATE|MATCH)_END\n/gm, "")
      .replace(/\n      \{\/\* REVIEW_INSIGHTS_PANEL_BEGIN \*\/\}[\s\S]*?      \{\/\* REVIEW_INSIGHTS_PANEL_END \*\/\}\n/, "")
      .replace("objectiveSummary: attachedNote ?? {}, // REVIEW_INSIGHTS_OBJECTIVE_NOTE", "objectiveSummary: {},")
      .replace("periodStart: attachedPeriod?.start ?? toIso(periodStart), // REVIEW_INSIGHTS_PERIOD_START", "periodStart: toIso(periodStart),")
      .replace("periodEnd: attachedPeriod?.end ?? toIso(periodEnd), // REVIEW_INSIGHTS_PERIOD_END", "periodEnd: toIso(periodEnd),")
      .replace(/^ *setObjectiveNote\(null\); \/\/ REVIEW_INSIGHTS_CLEAR_(?:AMENDMENT|MANUAL)\n/gm, "")
      .replaceAll(' data-review-draft-time="true" step="any"', "")
      .replaceAll("onChange={(e) => { setPeriodStart(e.target.value); setObjectiveNote(null); }}", "onChange={(e) => setPeriodStart(e.target.value)}")
      .replaceAll("onChange={(e) => { setPeriodEnd(e.target.value); setObjectiveNote(null); }}", "onChange={(e) => setPeriodEnd(e.target.value)}");
    expect(restored).toBe(blob(file));
  });
});
