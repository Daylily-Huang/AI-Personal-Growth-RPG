import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_MANUAL_BASE as BASE, ARTIFACT_MANUAL_CONTROL as CONTROL, ARTIFACT_MANUAL_ADMISSION_SHA as HASH,
  ARTIFACT_MANUAL_ALLOWED as ALLOWED, ARTIFACT_MANUAL_MARKERS as MARKERS, ARTIFACT_MANUAL_PRODUCTION as PRODUCTION,
  ARTIFACT_MANUAL_TESTS as TESTS, ARTIFACT_MANUAL_UI_TEST as UI_TEST,
  verifyArtifactManualAdmission as verify, verifyArtifactManualUIAssertion as verifyUI,
  hasArtifactManualScope as has, artifactManualScopeViolations as violations,
  assertArtifactManualActualScope as actual, resolveArtifactManualChangedFiles as changed, assertArtifactManualChangedScope as bind,
  artifactManualProposalFiles as prior, artifactManualEvidenceFiles as evidence, artifactManualContextFiles as context,
  artifactManualRejectionFiles as rejection, artifactManualHistoricalFiles as history, artifactManualCumulativeFiles as cumulative,
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
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command.startsWith("merge-base ")) return command.split(" ")[1];
    if (/^rev-parse [a-f0-9]{40}$/.test(command)) return git("rev-parse", command.split(" ")[1]);
    const fixed = /^diff --no-renames --name-only -z ([0-9a-f]{40}) ([0-9a-f]{40})$/.exec(command);
    if (fixed) return git("diff", "--no-renames", "--name-only", "-z", fixed[1], fixed[2]);
    if (command === `diff --no-renames --name-only -z ${PROPOSAL_FACT_EDIT_BASE} --`) return [...new Set([...PROPOSAL_FACT_EDIT_ALLOWED, ...files]), ""].join("\0");
    if (command.startsWith("diff ")) return [...files, ""].join("\0");
    const show = /^show ([0-9a-f]{40}):"([^"]+)"$/.exec(command);
    if (show) return git("show", `${show[1]}:${show[2]}`);
    throw Error("Unexpected fixture command");
  } };
}
function override(options: ArtifactManualGitOptions, key: string, value: string | Error): ArtifactManualGitOptions {
  return { ...options, execute(command) { if (command === key || key === "diff" && command.startsWith("diff ")) { if (value instanceof Error) throw value; return value; } return options.execute!(command); } };
}
const forbidden = ["src/lib/milestone/types.ts", "src/lib/milestone/repository.ts", "src/lib/reward/fold.ts", "src/lib/ai/prompts.ts", "src/lib/growth-engine/xp.ts",
  "src/lib/store/settlement.service.ts", "src/app/api/artifacts/route.ts", "src/app/api/artifacts/[id]/route.ts", "src/types/artifact.ts",
  "src/app/api/assessments/[id]/confirm/route.ts", "src/components/layout/AppShell.tsx", "src/components/ui/BaseModal.tsx", "src/app/globals.css",
  "src/styles/design-tokens.css", "supabase/migrations/0055_proposal_fact_edit_authority.sql", "supabase/migrations/0050_phase8e_reward_canonical_source_fix.sql",
  "package.json", "pnpm-lock.yaml", "vitest.config.ts", "next.config.ts", ".github/workflows/ci.yml", ".env.local", "密钥不要上传.txt", "tests/unsafe.test.ts"];

describe("Artifact20 corrected admission exact44/all25 and preserved accepted histories", () => {
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
    expect(ALLOWED).toHaveLength(44); expect(new Set(ALLOWED).size).toBe(44); expect(MARKERS).toHaveLength(25); expect(new Set(MARKERS).size).toBe(25);
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
  it("all44 required/unique; mixing old markers cannot buy an exception", () => {
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
  it("actual current44, fixed old53 and exact cumulative77 never subtract overlapping paths", () => {
    expect([...actual()].sort()).toEqual([...ALLOWED].sort()); expect(prior().sort()).toEqual([...PROPOSAL_FACT_EDIT_ALLOWED].sort());
    expect(evidence().sort()).toEqual([...EVIDENCE_SUBMISSION_ALLOWED].sort()); expect(context().sort()).toEqual([...ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED].sort()); expect(rejection().sort()).toEqual([...PROPOSAL_REJECTION_ALLOWED].sort());
    expect(history(ACTIVITY_DETAIL_BASE).sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort());
    expect(cumulative().sort()).toEqual([...new Set([...PROPOSAL_FACT_EDIT_ALLOWED, ...ALLOWED])].sort()); expect(cumulative()).toHaveLength(77);
    expect(ALLOWED.filter(file => (PROPOSAL_FACT_EDIT_ALLOWED as readonly string[]).includes(file))).toHaveLength(20);
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
      const current = canonical(readFileSync(file, "utf8"));
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
});
