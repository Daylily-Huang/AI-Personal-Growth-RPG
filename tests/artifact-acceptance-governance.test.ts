// REVIEW_HISTORY_ADAPTER_BEGIN
import { reviewHistoricalFunction, reviewHistoricalReader } from "./helpers/governance-delta";
const stage7c = reviewHistoricalFunction(reviewPrevious_stage7c);
const actual = reviewHistoricalFunction(reviewPrevious_actual);
const changed = reviewHistoricalFunction(reviewPrevious_changed);
const bind = reviewHistoricalFunction(reviewPrevious_bind);
const prior = reviewHistoricalFunction(reviewPrevious_prior);
const evidence = reviewHistoricalFunction(reviewPrevious_evidence);
const context = reviewHistoricalFunction(reviewPrevious_context);
const rejection = reviewHistoricalFunction(reviewPrevious_rejection);
const history = reviewHistoricalFunction(reviewPrevious_history);
const cumulative = reviewHistoricalFunction(reviewPrevious_cumulative);
const readFileSync = reviewHistoricalReader(reviewPrevious_readFileSync);
// REVIEW_HISTORY_ADAPTER_END
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync as reviewPrevious_readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_MANUAL_CORRECTIVE_HEAD as CORRECTIVE, ARTIFACT_MANUAL_CORRECTIVE_TREE as CORRECTIVE_TREE,
  artifactManualStage7CHistoricalDelta as reviewPrevious_stage7c, artifactManualLegacyProjection as legacy, resolveGovernanceChangedFiles as originalResolver,
  ARTIFACT_MANUAL_BASE as BASE, ARTIFACT_MANUAL_CONTROL as CONTROL, ARTIFACT_MANUAL_ADMISSION_SHA as HASH,
  ARTIFACT_MANUAL_ALLOWED as ALLOWED, ARTIFACT_MANUAL_MARKERS as MARKERS, ARTIFACT_MANUAL_PRODUCTION as PRODUCTION,
  ARTIFACT_MANUAL_TESTS as TESTS, ARTIFACT_MANUAL_UI_TEST as UI_TEST, ARTIFACT_MANUAL_API_TEST as API_TEST,
  verifyArtifactManualAPIFixture as verifyAPI,
  artifactManualProposalSyntheticModel as historicalModel, artifactManualProposalFixtureValidator as fixtureAdapter,
  verifyProposalFactEditFixture as originalFixture, assertProposalFactEditActualScope as originalProposalActual,
  resolveProposalFactEditChangedFiles as originalProposalChanged, assertProposalFactEditChangedScope as originalProposalBind,
  proposalFactEditHistoricalContent as originalProposalContent, PROPOSAL_FACT_EDIT_CONTROL, PROPOSAL_FACT_EDIT_AMENDMENT_PATH,
  verifyArtifactManualAdmission as verify, verifyArtifactManualUIAssertion as verifyUI,
  hasArtifactManualScope as has, artifactManualScopeViolations as violations,
  assertArtifactManualActualScope as reviewPrevious_actual, resolveArtifactManualChangedFiles as reviewPrevious_changed, assertArtifactManualChangedScope as reviewPrevious_bind,
  artifactManualProposalFiles as reviewPrevious_prior, artifactManualEvidenceFiles as reviewPrevious_evidence, artifactManualContextFiles as reviewPrevious_context,
  artifactManualRejectionFiles as reviewPrevious_rejection, artifactManualHistoricalFiles as reviewPrevious_history, artifactManualCumulativeFiles as reviewPrevious_cumulative,
  PROPOSAL_FACT_EDIT_BASE, PROPOSAL_FACT_EDIT_ALLOWED, EVIDENCE_SUBMISSION_ALLOWED, ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED,
  PROPOSAL_REJECTION_ALLOWED, NEW_USER_GUIDE_BASE, ACTIVITY_DETAIL_BASE, ACTIVITY_DETAIL_ALLOWED,
  GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, PROPOSAL_FACT_EDIT_MARKERS, type ArtifactManualGitOptions,
} from "./helpers/governance-delta";
import { validateVisualMigrationDelta as visual } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations as phase8f } from "./phase8f-ui-governance.test";

const canonical = (text: string) => text.replace(/\r\n/g, "\n");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 8e6 });
const blob = (file: string, commit = BASE) => canonical(git("show", `${commit}:${file}`));
const control = () => readFileSync(CONTROL, "utf8"), revision = (n: number) => String(n).repeat(40);
function model(files: readonly string[] = ALLOWED, head = BASE, remote = revision(2)): ArtifactManualGitOptions {
  return { readControl: control, execute(command) {
    if (command === "rev-parse HEAD") return head;
    if (command === 'rev-parse "HEAD^{tree}"') return CORRECTIVE_TREE;
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command.startsWith("merge-base ")) return command.split(" ")[1];
    if (/^rev-parse [a-f0-9]{40}$/.test(command)) return git("rev-parse", command.split(" ")[1]);
    const fixed = /^diff --no-renames --name-only -z ([0-9a-f]{40}) ([0-9a-f]{40})$/.exec(command);
    if (fixed) return git("diff", "--no-renames", "--name-only", "-z", fixed[1], fixed[2]);
    if (command === `diff --no-renames --name-only -z ${PROPOSAL_FACT_EDIT_BASE} --`) return [...new Set([...PROPOSAL_FACT_EDIT_ALLOWED, ...files]), ""].join("\0");
    if (head === CORRECTIVE && command === `diff --no-renames --name-only -z ${BASE}...${CORRECTIVE}`) return [...ALLOWED.filter(f => f !== "tests/stage7c-ui.test.tsx" && f !== API_TEST), ""].join("\0");
    if (command.startsWith("diff ")) return [...files, ""].join("\0");
    const show = /^show ([0-9a-f]{40}):"([^"]+)"$/.exec(command);
    if (show) return git("show", `${show[1]}:${show[2]}`);
    throw Error("Unexpected fixture command");
  } };
}
function override(options: ArtifactManualGitOptions, key: string, value: string | Error): ArtifactManualGitOptions {
  return { ...options, execute(command) { if (command === key || key === "diff" && command.startsWith("diff ")) { if (value instanceof Error) throw value; return value; } return options.execute!(command); } };
}
function proposalSynthetic(files: readonly string[] = PROPOSAL_FACT_EDIT_ALLOWED, head = PROPOSAL_FACT_EDIT_BASE, remote = revision(2)) {
  const calls: string[] = [];
  const original = { calls, readControl: () => readFileSync(PROPOSAL_FACT_EDIT_CONTROL, "utf8"), execute(command: string): string {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return PROPOSAL_FACT_EDIT_BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command.startsWith("merge-base ")) return command.split(" ")[1];
    const endpoints = /^diff --no-renames --name-only -z ([a-f0-9]{40}) ([a-f0-9]{40})$/.exec(command);
    if (endpoints) return git("diff", "--no-renames", "--name-only", "-z", endpoints[1], endpoints[2]);
    if (command.startsWith("diff ")) return [...files, ""].join("\0");
    const show = /^show ([a-f0-9]{40}):"([^"]+)"$/.exec(command);
    if (show) return git("show", `${show[1]}:${show[2]}`);
    throw Error("Unexpected historical model command");
  } };
  return historicalModel(() => original)();
}
function restoreProposalTop(text: string): string {
  const importLine = 'import { artifactManualProposalSyntheticModel, artifactManualProposalFixtureValidator } from "./helpers/governance-delta";\n';
  const modelLine = 'const model = artifactManualProposalSyntheticModel(artifactManualPrevious_model);\n';
  const validatorLine = 'const verifyFixture = artifactManualProposalFixtureValidator(artifactManualPrevious_verifyFixture);\n';
  let restored = text;
  for (const extra of [importLine, modelLine, validatorLine]) {
    if (restored.split(extra).length !== 2) throw Error("FAIL-CLOSED: dedicated proposal top adapter is not unique");
    restored = restored.replace(extra, "");
  }
  if (restored.split("function artifactManualPrevious_model(").length !== 2 || restored.split("verifyProposalFactEditFixture as artifactManualPrevious_verifyFixture,").length !== 2)
    throw Error("FAIL-CLOSED: dedicated proposal aliases are not unique");
  return restored.replace("function artifactManualPrevious_model(", "function model(")
    .replace("verifyProposalFactEditFixture as artifactManualPrevious_verifyFixture,", "verifyProposalFactEditFixture as verifyFixture,");
}
const forbidden = ["src/lib/milestone/types.ts", "src/lib/milestone/repository.ts", "src/lib/reward/fold.ts", "src/lib/ai/prompts.ts", "src/lib/growth-engine/xp.ts",
  "src/lib/store/settlement.service.ts", "src/app/api/artifacts/route.ts", "src/app/api/artifacts/[id]/route.ts", "src/types/artifact.ts",
  "src/app/api/assessments/[id]/confirm/route.ts", "src/components/layout/AppShell.tsx", "src/components/ui/BaseModal.tsx", "src/app/globals.css",
  "src/styles/design-tokens.css", "supabase/migrations/0055_proposal_fact_edit_authority.sql", "supabase/migrations/0050_phase8e_reward_canonical_source_fix.sql",
  "package.json", "pnpm-lock.yaml", "vitest.config.ts", "next.config.ts", ".github/workflows/ci.yml", ".env.local", "密钥不要上传.txt", "tests/unsafe.test.ts"];

describe("Artifact20 corrected admission exact46/all25 and preserved accepted histories", () => {
  it("uncommitted accepted HEAD still requires readable remote revision and accepted ancestry", () => {
    const candidate = model(ALLOWED, BASE, BASE);
    expect(actual(candidate).sort()).toEqual([...ALLOWED].sort());
    for (const key of ["rev-parse origin/main", `merge-base ${BASE} origin/main`]) {
      expect(() => actual(override(candidate, key, Error("Remote unreadable")))).toThrow("FAIL-CLOSED");
      expect(() => actual(override(candidate, key, ""))).toThrow("FAIL-CLOSED");
    }
    expect(() => actual(override(candidate, `merge-base ${BASE} origin/main`, revision(9)))).toThrow("FAIL-CLOSED");
    expect(canonical(readFileSync("docs/Design ChatGPT/02_PRODUCT_DESIGN.md", "utf8")).startsWith(blob("docs/Design ChatGPT/02_PRODUCT_DESIGN.md"))).toBe(true);
  });
  it("binds corrected contract, exact paths,13production/8tests and only0056", () => {
    verify(control()); expect(createHash("sha256").update(canonical(control())).digest("hex").toUpperCase()).toBe(HASH);
    expect(ALLOWED).toHaveLength(46); expect(new Set(ALLOWED).size).toBe(46); expect(MARKERS).toHaveLength(25); expect(new Set(MARKERS).size).toBe(25);
    expect(PRODUCTION).toHaveLength(13); expect(TESTS).toHaveLength(8);
    expect([...ALLOWED].sort()).toEqual(canonical(control()).match(/```text\n([\s\S]*?)\n```/)![1].split("\n").sort());
    expect(ALLOWED.filter(path => path.startsWith("supabase/"))).toEqual(["supabase/migrations/0056_artifact_manual_acceptance.sql"]);
    expect(violations(ALLOWED)).toEqual([]); expect(visual([...ALLOWED])).toEqual({ isVisualPR: true, violations: [] }); expect(phase8f([...ALLOWED])).toEqual([]);
  });
  it.each(MARKERS)("missing marker %s never falls through to an old allowance", marker => {
    const files = ALLOWED.filter(file => file !== marker); expect(has(files)).toBe(false); expect(violations(files).length).toBeGreaterThan(0);
    expect(visual([...files]).violations.length).toBeGreaterThan(0); expect(phase8f([...files]).length).toBeGreaterThan(0);
    for (const fn of [actual, prior, evidence, context, rejection, cumulative]) expect(() => fn(model(files))).toThrow("FAIL-CLOSED");
    expect(() => history(NEW_USER_GUIDE_BASE, model(files))).toThrow("FAIL-CLOSED");
  });
  it.each(forbidden)("extra %s never enters the current scope", extra => {
    const files = [...ALLOWED, extra]; expect(violations(files)).toEqual([extra]); expect(visual(files).violations).toEqual([extra]); expect(phase8f(files)).toEqual([extra]);
    expect(() => actual(model(files))).toThrow("FAIL-CLOSED"); expect(() => prior(model(files))).toThrow("FAIL-CLOSED");
  });
  it("all46 required/unique; mixing old markers cannot buy an exception", () => {
    for (const path of ALLOWED) expect(() => actual(model(ALLOWED.filter(x => x !== path)))).toThrow("FAIL-CLOSED");
    expect(violations([...ALLOWED, CONTROL])).toContain("duplicate Artifact paths");
    for (const old of [GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, PROPOSAL_FACT_EDIT_MARKERS]) expect(() => actual(model([...new Set([...ALLOWED, ...old])]))).toThrow("FAIL-CLOSED");
  });
  it("sole old UI assertion reverses the ENTIRE file; no other fixture/expect mutation", () => {
    const now = canonical(readFileSync(UI_TEST, "utf8")), accepted = blob(UI_TEST); verifyUI(now, accepted);
    const replacement = 'expect(screen.getByText(/Artifact（作品与产物）支持用户手动验收，每件首次100愿望积分/)).toBeTruthy();';
    for (const mutated of [accepted, now + "\n", now.replace(replacement, ""), now + replacement, now.replace("toBeTruthy()", "toBeDefined()"), now.replace("100愿望积分", "101愿望积分")]) {
      expect(() => verifyUI(mutated, accepted)).toThrow("FAIL-CLOSED"); expect(() => actual({ ...model(), readUIFixture: () => mutated })).toThrow("FAIL-CLOSED");
    }
  });
  it("full PR and current-main bind exact mode/first-parent/range/files", () => {
    for (const [head, remote] of [[revision(1), revision(2)], [revision(1), revision(1)]]) {
      const options = model(ALLOWED, head, remote), delta = changed(options); bind(delta, options); expect([...actual(options)].sort()).toEqual([...ALLOWED].sort());
      expect(delta.range).toBe(head === remote ? `${BASE}..${head}` : `${BASE}...${head}`);
      for (const invalid of [{ ...delta, files: delta.files.slice(1) }, { ...delta, files: [...delta.files, CONTROL] }, { ...delta, range: "HEAD~1..HEAD" }, { ...delta, mergeBase: revision(9) }]) expect(() => bind(invalid, options)).toThrow("FAIL-CLOSED");
    }
    expect(() => changed(override(model(ALLOWED, revision(1), revision(1)), 'rev-parse "HEAD^1"', revision(9)))).toThrow("FAIL-CLOSED");
  });
  it.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${BASE} HEAD`, `merge-base ${BASE} origin/main`, 'rev-parse "HEAD^1"', "diff", "ls-files --others --exclude-standard -z"])("Git failure %s fails closed", key => {
    const options = override(model(ALLOWED, revision(1), revision(1)), key, Error("Read-only fixture failure")); expect(() => actual(options)).toThrow("FAIL-CLOSED");
  });
  it("invalid contract/paths/revision/ancestry cannot become an empty green scope", () => {
    for (const text of ["", control() + "\n", control().replace("100积分", "101积分")]) expect(() => actual({ ...model(), readControl: () => text })).toThrow("FAIL-CLOSED");
    expect(() => actual({ ...model(), readControl: () => { throw Error("Unreadable"); } })).toThrow("FAIL-CLOSED");
    for (const raw of ["", "unterminated", "\0", "../secret\0", "/absolute\0", "a\\b\0", "a\nb\0", `${CONTROL}\0${CONTROL}\0`]) expect(() => changed(override(model(), "diff", raw))).toThrow("FAIL-CLOSED");
    expect(() => actual(override(model(), `merge-base ${BASE} HEAD`, revision(9)))).toThrow("FAIL-CLOSED");
  });
  it("actual current46, fixed old53 and exact cumulative78 never subtract overlapping paths", () => {
    expect([...actual()].sort()).toEqual([...ALLOWED].sort()); expect(prior().sort()).toEqual([...PROPOSAL_FACT_EDIT_ALLOWED].sort());
    expect(evidence().sort()).toEqual([...EVIDENCE_SUBMISSION_ALLOWED].sort()); expect(context().sort()).toEqual([...ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED].sort()); expect(rejection().sort()).toEqual([...PROPOSAL_REJECTION_ALLOWED].sort());
    expect(history(ACTIVITY_DETAIL_BASE).sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort());
    expect(cumulative().sort()).toEqual([...new Set([...PROPOSAL_FACT_EDIT_ALLOWED, ...ALLOWED])].sort()); expect(cumulative()).toHaveLength(78);
    expect(ALLOWED.filter(file => (PROPOSAL_FACT_EDIT_ALLOWED as readonly string[]).includes(file))).toHaveLength(21);
    expect(() => prior(override(model(), `diff --no-renames --name-only -z ${PROPOSAL_FACT_EDIT_BASE} ${BASE}`, "unsafe\0"))).toThrow("FAIL-CLOSED");
  }, 60000);
  it("accepted helper whole prefix and ALL55 SQL/authority/UI tokens remain frozen", () => {
    expect(canonical(readFileSync("tests/helpers/governance-delta.ts", "utf8")).startsWith(blob("tests/helpers/governance-delta.ts"))).toBe(true);
    const oldSql = readdirSync("supabase/migrations").filter(name => /^00(?:[0-4]\d|5[0-5])_.*\.sql$/.test(name)); expect(oldSql).toHaveLength(55);
    const protectedFiles = ["src/lib/growth-engine/xp.ts", "src/lib/growth-engine/levels.ts", "src/lib/growth-engine/mastery.ts", "src/lib/ai/prompts.ts", "src/lib/ai/schemas.ts", "src/lib/ai/assess.ts", "src/lib/milestone/repository.ts", "src/lib/milestone/types.ts", "src/lib/store/settlement.service.ts", "src/lib/store/supabase-artifact-repository.ts", "src/types/artifact.ts", "src/app/globals.css", "src/styles/design-tokens.css", "package.json", "pnpm-lock.yaml", ".github/workflows/ci.yml",
      "src/components/layout/AppShell.tsx", "src/components/layout/AppSidebar.tsx", "src/components/layout/MobileNav.tsx", "src/components/ui/BaseModal.tsx", "src/components/rewards/client.tsx", "src/components/rewards/RewardConfirmation.tsx", "src/app/rewards/wishes/page.tsx"];
    for (const file of [...oldSql.map(name => `supabase/migrations/${name}`), ...protectedFiles]) expect(git("hash-object", `--path=${file}`, file).trim(), file).toBe(git("rev-parse", `${BASE}:${file}`).trim());
  }, 30000);
  it("old ten governance bodies are identical after removing ONLY the new entry/projection", () => {
    for (const name of ["activity-detail", "assessment-context", "evidence-submission", "graph-canvas", "graph-mobile", "onboarding", "phase8f-ui", "proposal-rejection", "proposal-edit", "visual-foundation"]) {
      const file = `tests/${name}${name === "visual-foundation" ? "" : "-governance"}.test.ts`;
      let current = canonical(readFileSync(file, "utf8"));
      if (name === "proposal-edit") current = restoreProposalTop(current);
      const restored = current.replace(/^import \{ artifactManualLegacyProjection[^\n]*\n/gm, "")
        .replace(/^const \w+ = artifactManualLegacyProjection\([^\n]*\n/gm, "")
        .replace(/\b(\w+) as artifactManualPrevious_(\w+)/g, (_match, original, alias) => original === alias ? original : `${original} as ${alias}`)
        .replace(/^  if \(changedFiles\.includes\(ARTIFACT_MANUAL_CONTROL\)\) return \{ isVisualPR: true, violations: artifactManualScopeViolations\(changedFiles\) \};\n/m, "")
        .replace(/^  if \(files\.includes\(ARTIFACT_MANUAL_CONTROL\)\) return artifactManualScopeViolations\(files\);\n/m, "");
      expect(restored, file).toBe(blob(file));
    }
  });
  it("newly admitted Dashboard entry reverses the entire original27 test file, with all assertions intact", () => {
    const file = "tests/phase5-dashboard-ui.test.tsx";
    const current = canonical(readFileSync(file, "utf8"));
    const restored = current.replace(/^import \{ artifactManualLegacyProjection[^\n]*\n/gm, "")
      .replace(/^const \w+ = artifactManualLegacyProjection\([^\n]*\n/gm, "")
      .replace(/\b(\w+) as artifactManualPrevious_(\w+)/g, (_match, original, alias) => original === alias ? original : `${original} as ${alias}`);
    expect(restored).toBe(blob(file));
    expect(current.match(/^  it\(/gm)).toHaveLength(27);
  });
  it("Stage7C top alias/wrapper restores all29 original tests and assertions exactly", () => {
    const file = "tests/stage7c-ui.test.tsx", current = canonical(readFileSync(file, "utf8"));
    const restored = current.replace(/^import \{ artifactManualLegacyProjection[^\n]*\n/gm, "")
      .replace(/^const \w+ = artifactManualLegacyProjection\([^\n]*\n/gm, "")
      .replace(/\b(\w+) as artifactManualPrevious_(\w+)/g, (_m, original, alias) => original === alias ? original : original + " as " + alias);
    expect(restored).toBe(blob(file)); expect(current.match(/^\s*it\(/gm)).toHaveLength(29);
  });
  it("precise rejected e0a44 transition validates working46 but exported committed binder rejects44", () => {
    const options = model(ALLOWED, CORRECTIVE, BASE);
    expect(actual(options).sort()).toEqual([...ALLOWED].sort()); expect(cumulative(options)).toHaveLength(78);
    const delta = changed(options); expect(delta.files).toHaveLength(44);
    expect(() => bind(delta, options)).toThrow("FAIL-CLOSED");
    for (const key of ['rev-parse "HEAD^{tree}"', "rev-parse origin/main", 'show ' + CORRECTIVE + ':"' + CONTROL + '"']) {
      for (const value of ["", revision(9), Error("Unreadable transition")]) expect(() => actual(override(options, key, value))).toThrow("FAIL-CLOSED");
    }
    const range = 'diff --no-renames --name-only -z ' + BASE + '...' + CORRECTIVE, old44 = delta.files;
    for (const files of [old44.slice(1), [...old44, "tests/stage7c-ui.test.tsx"], [...old44, CONTROL], [...old44.slice(1), "src/unsafe.ts"]])
      expect(() => actual(override(options, range, [...files, ""].join("\0")))).toThrow("FAIL-CLOSED");
    const head = revision(1);
    expect(() => actual(override(model(ALLOWED, head, BASE), 'diff --no-renames --name-only -z ' + BASE + '...' + head, [...old44, ""].join("\0")))).toThrow("FAIL-CLOSED");
    expect(() => bind(delta, model(ALLOWED, BASE, BASE))).toThrow("FAIL-CLOSED");
  });
  it("Stage7C fixed53 projection has truthful immutable metadata after current46/cumulative78", () => {
    const options = model(ALLOWED, CORRECTIVE, BASE), delta = stage7c(options);
    expect(delta).toEqual({ mode: "pr-branch", range: PROPOSAL_FACT_EDIT_BASE + '...' + BASE, mergeBase: PROPOSAL_FACT_EDIT_BASE, files: prior(options) });
    expect(delta.files).toHaveLength(53); expect(cumulative(options)).toHaveLength(78);
    for (const marker of MARKERS) expect(() => stage7c(model(ALLOWED.filter(f => f !== marker)))).toThrow("FAIL-CLOSED");
    expect(() => stage7c(model([...ALLOWED, "src/unsafe.ts"]))).toThrow("FAIL-CLOSED");
    expect(() => stage7c(override(options, 'diff --no-renames --name-only -z ' + PROPOSAL_FACT_EDIT_BASE + ' ' + BASE, "unsafe\0"))).toThrow("FAIL-CLOSED");
    const calls: string[] = [], previous = (opts: ArtifactManualGitOptions = {}) => { calls.push("old"); return originalResolver(opts); };
    const wrapped = legacy(previous, stage7c);
    wrapped(model(ALLOWED)); expect(calls).toEqual(["old"]); // synthetic execute is never projected
  }, 60000);

  it("old API sole fixture UUID reverses all21 original tests, mocks and assertions exactly", () => {
    const now = canonical(readFileSync(API_TEST, "utf8")), accepted = blob(API_TEST);
    verifyAPI(now, accepted);
    const fixed = 'return {activityId:"11111111-1111-4111-8111-111111111111",rawInput:"本人活动原文"';
    for (const mutated of [accepted, now + "\n", now + fixed, now.replace(fixed, ""), now.replace('not.toMatch(/Foreign|forged|999/)', 'not.toMatch(/Foreign|forged/)'), now.replace('mockResolvedValue(false)', 'mockResolvedValue(true)')]) {
      expect(() => verifyAPI(mutated, accepted)).toThrow("FAIL-CLOSED");
      expect(() => actual({ ...model(), readAPIFixture: () => mutated })).toThrow("FAIL-CLOSED");
    }
  });
  it("per-invocation proof rejects HEAD/remote or any admission input drifting before return", () => {
    for (const key of ["rev-parse HEAD", "rev-parse origin/main"]) {
      const options = model(ALLOWED, CORRECTIVE, BASE); let reads = 0;
      expect(() => actual({ ...options, execute(command) { if (command === key && ++reads > 1) return revision(9); return options.execute!(command); } })).toThrow("FAIL-CLOSED");
    }
    for (const reader of ["readControl", "readUIFixture", "readAPIFixture"] as const) {
      const initial = readFileSync(reader === "readControl" ? CONTROL : reader === "readUIFixture" ? UI_TEST : API_TEST, "utf8"); let reads = 0;
      expect(() => actual({ ...model(ALLOWED, CORRECTIVE, BASE), [reader]: () => initial + (++reads > 1 ? "\n" : "") })).toThrow("FAIL-CLOSED");
    }
    const head = revision(1);
    for (const omitted of [API_TEST, "tests/stage7c-ui.test.tsx"]) {
      const options = model(ALLOWED.filter(f => f !== omitted), head, BASE);
      expect(() => bind(changed(options), options)).toThrow("FAIL-CLOSED");
    }
  });

  it("V6 proposal top inverse preserves the entire accepted116 tests and original model body", () => {
    const file = "tests/proposal-edit-governance.test.ts", current = canonical(readFileSync(file, "utf8"));
    const restoredTop = restoreProposalTop(current);
    const restored = restoredTop.replace(/^import \{ artifactManualLegacyProjection[^\n]*\n/gm, "")
      .replace(/^const \w+ = artifactManualLegacyProjection\([^\n]*\n/gm, "")
      .replace(/\b(\w+) as artifactManualPrevious_(\w+)/g, (_m, original, alias) => original === alias ? original : original + " as " + alias);
    expect(restored).toBe(blob(file));
    expect(current.slice(current.indexOf('describe("Proposal facts18'))).toBe(blob(file).slice(blob(file).indexOf('describe("Proposal facts18')));
    for (const mutation of [current.replace("const model = artifactManualProposalSyntheticModel(artifactManualPrevious_model);", ""),
      current + 'const model = artifactManualProposalSyntheticModel(artifactManualPrevious_model);\n',
      current.replace("function artifactManualPrevious_model(", "function model(")]) expect(() => restoreProposalTop(mutation)).toThrow("FAIL-CLOSED");
  });
  it("historical model default reads real5168, preserves identities, and is never a current46 proof", () => {
    const calls: string[] = [], execute = (command: string) => { void command; throw Error("synthetic execute cannot supply the historical fixture"); };
    const readControl = () => "old synthetic controller", original = { calls, execute, readControl };
    const wrapped = historicalModel(() => original)();
    expect(wrapped.calls).toBe(calls); expect(wrapped.execute).toBe(execute); expect(wrapped.readControl).toBe(readControl);
    const provider = (wrapped as typeof wrapped & { readFixture: () => string }).readFixture;
    expect(canonical(provider())).toBe(blob(API_TEST)); expect(canonical(provider())).toBe(blob(API_TEST));
    originalFixture(provider(), blob(API_TEST, PROPOSAL_FACT_EDIT_BASE));
    expect(() => actual(proposalSynthetic())).toThrow("FAIL-CLOSED");
    expect(() => historicalModel(() => ({ calls, readControl }))()).toThrow("FAIL-CLOSED");
    const outside = { cwd: "/", calls, execute, readControl }; expect(historicalModel(() => outside)()).toBe(outside);
  });
  it("explicit fixture providers and later caller overrides always win over historical defaults", () => {
    const base = proposalSynthetic(), readFixture = () => { throw Error("explicit fixture error"); };
    const explicit = { ...base, readFixture };
    expect(historicalModel(() => explicit)()).toBe(explicit);
    expect(() => originalProposalActual(explicit)).toThrow("FAIL-CLOSED");
    let reached = false;
    expect(() => originalProposalActual({ ...base, readFixture() { reached = true; return blob(API_TEST) + "\n"; } })).toThrow("FAIL-CLOSED");
    expect(reached).toBe(true);
  });
  it("direct fixture adaptation has both exact inverses and never replaces accepted or nonArtifact inputs", () => {
    const current = readFileSync(API_TEST, "utf8"), historical = blob(API_TEST), accepted = blob(API_TEST, PROPOSAL_FACT_EDIT_BASE);
    const adapter = fixtureAdapter(originalFixture); adapter(current, accepted); adapter(historical, accepted);
    expect(() => adapter(current, accepted + "\n")).toThrow("FAIL-CLOSED");
    const fixed = 'return {activityId:"11111111-1111-4111-8111-111111111111",rawInput:"本人活动原文"';
    for (const mutation of [current + "\n", current + fixed, current.replace(fixed, ""), current.replace("mockResolvedValue(false)", "mockResolvedValue(true)"), current.replace("not.toMatch(/Foreign|forged|999/)", "not.toMatch(/Foreign|forged/)"), accepted]) {
      expect(mutation).not.toBe(current);
      expect(() => adapter(mutation, accepted)).toThrow("FAIL-CLOSED");
    }
    let observed: string[] = [];
    const spy = fixtureAdapter((left, right) => { observed = [left, right]; originalFixture(left, right); });
    spy(current, accepted); expect(observed).toEqual([historical, accepted]);
    const outside = fixtureAdapter((left, right) => { observed = [left, right]; }, "/"); outside(current, accepted);
    expect(observed).toEqual([current, accepted]);
  });
  it("old PR/main positives reach real synthetic topology before every injected Git failure", () => {
    for (const [head, remote] of [[PROPOSAL_FACT_EDIT_BASE, revision(2)], [revision(1), revision(2)], [revision(1), revision(1)]]) {
      const options = proposalSynthetic(PROPOSAL_FACT_EDIT_ALLOWED, head, remote);
      expect(originalProposalActual(options).sort()).toEqual([...PROPOSAL_FACT_EDIT_ALLOWED].sort());
      const delta = originalProposalChanged(options); originalProposalBind(delta, options);
      expect(delta.range).toBe(head === remote ? PROPOSAL_FACT_EDIT_BASE + ".." + head : PROPOSAL_FACT_EDIT_BASE + "..." + head);
      expect(options.calls).toContain("rev-parse HEAD"); expect(options.calls).toContain("rev-parse origin/main");
    }
    for (const key of ["rev-parse HEAD", "rev-parse origin/main", `merge-base ${PROPOSAL_FACT_EDIT_BASE} HEAD`, 'rev-parse "HEAD^1"', "diff", "ls-files --others --exclude-standard -z", `show ${PROPOSAL_FACT_EDIT_BASE}:"${API_TEST}"`]) {
      const options = proposalSynthetic(PROPOSAL_FACT_EDIT_ALLOWED, revision(1), revision(1)); let reached = false;
      expect(() => originalProposalActual({ ...options, execute(command) {
        if (command === key || key === "diff" && command.startsWith("diff ")) { reached = true; throw Error("injected targeted Git failure"); }
        return options.execute(command);
      } })).toThrow("FAIL-CLOSED");
      expect(reached, key).toBe(true);
    }
  });
  it("old control amendment and fixture negative tests reach their own injected provider", () => {
    for (const reader of ["readControl", "readAmendment", "readFixture"] as const) {
      const options = proposalSynthetic(); let reached = false;
      expect(() => originalProposalActual({ ...options, [reader]: () => { reached = true; throw Error("targeted provider failure"); } })).toThrow("FAIL-CLOSED");
      expect(reached, reader).toBe(true);
    }
    expect(readFileSync(PROPOSAL_FACT_EDIT_AMENDMENT_PATH, "utf8")).toContain("PROPOSAL_FACT_EDIT_FIXTURE_AMENDMENT");
  });
  it("old forged delta and group/path negatives execute past valid historical fixture", () => {
    const options = proposalSynthetic(PROPOSAL_FACT_EDIT_ALLOWED, revision(1), revision(2));
    const delta = originalProposalChanged(options);
    for (const forged of [{ ...delta, files: delta.files.slice(1) }, { ...delta, mergeBase: revision(9) }, { ...delta, range: "HEAD~1..HEAD" }]) {
      options.calls.length = 0; expect(() => originalProposalBind(forged, options)).toThrow("FAIL-CLOSED");
      expect(options.calls.some(call => call.startsWith("diff "))).toBe(true);
    }
    expect(canonical(originalProposalContent("src/lib/store/repository.ts", "context-source", options))).toBe(blob("src/lib/store/repository.ts", PROPOSAL_FACT_EDIT_BASE));
    for (const [file, group] of [["../secret", "context-source"], ["src/lib/store/repository.ts", "page"]] as const) {
      options.calls.length = 0; expect(() => originalProposalContent(file, group, options)).toThrow("FAIL-CLOSED");
      expect(options.calls).toContain("rev-parse HEAD");
    }
  });

});
