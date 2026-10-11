import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { artifactManualLegacyProjection, artifactManualProposalFiles, artifactManualHistoricalFiles, artifactManualHistoricalContent, artifactManualEvidenceFiles, artifactManualContextFiles, artifactManualRejectionFiles } from "./helpers/governance-delta";
const actual = artifactManualLegacyProjection(artifactManualPrevious_actual, artifactManualProposalFiles);
const history = artifactManualLegacyProjection(artifactManualPrevious_history, artifactManualHistoricalFiles);
const content = artifactManualLegacyProjection(artifactManualPrevious_content, artifactManualHistoricalContent);
const evidence = artifactManualLegacyProjection(artifactManualPrevious_evidence, artifactManualEvidenceFiles);
const context = artifactManualLegacyProjection(artifactManualPrevious_context, artifactManualContextFiles);
const rejection = artifactManualLegacyProjection(artifactManualPrevious_rejection, artifactManualRejectionFiles);
import {
  PROPOSAL_FACT_EDIT_BASE as BASE, PROPOSAL_FACT_EDIT_CONTROL as CONTROL, PROPOSAL_FACT_EDIT_ADMISSION_SHA as HASH,
  PROPOSAL_FACT_EDIT_ALLOWED as ALLOWED, PROPOSAL_FACT_EDIT_MARKERS as MARKERS,
  PROPOSAL_FACT_EDIT_FIXTURE_PATH as FIXTURE, PROPOSAL_FACT_EDIT_AMENDMENT_PATH as AMENDMENT,
  verifyProposalFactEditAmendment as verifyAmendment, verifyProposalFactEditFixture as verifyFixture,
  PROPOSAL_FACT_EDIT_PRODUCTION as PRODUCTION, PROPOSAL_FACT_EDIT_TESTS as TESTS,
  hasProposalFactEditScope as has, proposalFactEditScopeViolations as violations, verifyProposalFactEditAdmission as verify,
  resolveProposalFactEditWorkingFiles as working, resolveProposalFactEditChangedFiles as changed,
  assertProposalFactEditActualScope as artifactManualPrevious_actual, assertProposalFactEditChangedScope as bind,
  proposalFactEditHistoricalFiles as artifactManualPrevious_history, proposalFactEditEvidenceFiles as artifactManualPrevious_evidence,
  proposalFactEditContextFiles as artifactManualPrevious_context, proposalFactEditRejectionFiles as artifactManualPrevious_rejection, proposalFactEditHistoricalContent as artifactManualPrevious_content,
  EVIDENCE_SUBMISSION_BASE, EVIDENCE_SUBMISSION_ALLOWED, ASSESSMENT_CONTEXT_BASE, ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED,
  PROPOSAL_REJECTION_BASE, PROPOSAL_REJECTION_ALLOWED, PROPOSAL_REJECTION_HISTORICAL_CONTENT,
  ASSESSMENT_CONTEXT_ACTIVITY_CONTENT, ACTIVITY_DETAIL_BASE, ACTIVITY_DETAIL_ALLOWED, ACTIVITY_MAIN_BASE, ACTIVITY_MAIN_ALLOWED,
  NEW_USER_GUIDE_BASE, NEW_USER_GUIDE_MARKERS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, EVIDENCE_SUBMISSION_MARKERS,
  type ProposalRejectionGitOptions,
} from "./helpers/governance-delta";
import { validateVisualMigrationDelta as visual } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations as phase8f } from "./phase8f-ui-governance.test";

const canonical = (value: string) => value.replace(/\r\n/g, "\n");
const document = () => readFileSync(CONTROL, "utf8"), revision = (n: number) => String(n).repeat(40);
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 4000000 });
const blob = (commit: string, file: string) => canonical(git("show", `${commit}:${file}`));
function model(files: readonly string[] = ALLOWED, head = BASE, remote = revision(2)): ProposalRejectionGitOptions & { calls: string[] } {
  const calls: string[] = [];
  return { readControl: document, calls, execute(command) {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command.startsWith("merge-base ")) return command.split(" ")[1];
    if (command.startsWith("diff ")) {
      const endpoints = command.match(/^diff --no-renames --name-only -z ([a-f0-9]{40}) ([a-f0-9]{40})$/);
      return endpoints ? git("diff", "--no-renames", "--name-only", "-z", endpoints[1], endpoints[2]) : [...files, ""].join("\0");
    }
    const show = /^show ([0-9a-f]{40}):"([^"]+)"$/.exec(command);
    if (show) return git("show", `${show[1]}:${show[2]}`);
    throw Error("Unrecognized synthetic command");
  } };
}
function alter(options: ProposalRejectionGitOptions, key: string, value: string | Error): ProposalRejectionGitOptions {
  return { ...options, execute(command) {
    if (command === key || (key === "diff" && command.startsWith("diff "))) {
      if (value instanceof Error) throw value;
      return value;
    }
    return options.execute!(command);
  } };
}
const extras = ["src/lib/store/request-repository.ts", "src/lib/growth-engine/engine.ts", "src/lib/ai/prompts.ts",
  "src/lib/assessment-context/repository.ts", "src/app/api/assessments/[id]/confirm/route.ts", "src/app/api/assessments/[id]/reject/route.ts",
  "src/lib/supabase/admin.ts", "src/app/skills/page.tsx", "src/app/knowledge/page.tsx", "src/lib/reward/fold.ts", "src/proxy.ts",
  "supabase/migrations/0056_unsafe.sql", "supabase/migrations/0054_evidence_submission_authority.sql", "package.json", "pnpm-lock.yaml",
  "next.config.ts", "tsconfig.json", "vitest.config.ts", ".github/workflows/ci.yml", ".env.local", "密钥不要上传.txt",
  "src/app/globals.css", "src/styles/design-tokens.css", "tests/unsafe.test.ts", "docs/unsafe.md"];

describe("Proposal facts18 amended exact53/35 gate with immutable history and fail-closed Git", () => {
  it("binds immutable contract and exactly21 production/10 tests, sole0055 SQL", () => {
    verify(document()); expect(createHash("sha256").update(canonical(document())).digest("hex").toUpperCase()).toBe(HASH);
    expect(ALLOWED).toHaveLength(53); expect(new Set(ALLOWED).size).toBe(53); expect(MARKERS).toHaveLength(35); expect(new Set(MARKERS).size).toBe(35);
    expect(PRODUCTION).toHaveLength(21); expect(TESTS).toHaveLength(10);
    expect([...ALLOWED].sort()).toEqual([...canonical(document()).match(/```text\n([\s\S]*?)\n```/)![1].split("\n"), FIXTURE].sort());
    expect(ALLOWED.filter(file => file.startsWith("supabase/"))).toEqual(["supabase/migrations/0055_proposal_fact_edit_authority.sql"]);
    expect(has(ALLOWED)).toBe(true); expect(violations(ALLOWED)).toEqual([]); expect(visual([...ALLOWED])).toEqual({ isVisualPR: true, violations: [] }); expect(phase8f([...ALLOWED])).toEqual([]);
  });
  it("amendment is mandatory, unique, immutable; every old fixture byte and assertion is preserved", () => {
    const amendment = readFileSync(AMENDMENT, "utf8"), fixture = readFileSync(FIXTURE, "utf8"), accepted = git("show", `${BASE}:${FIXTURE}`);
    verifyAmendment(amendment); verifyFixture(fixture, accepted);
    for (const text of ["", amendment + amendment, amendment.replace("严格53", "严格54"), amendment.replace("END PROPOSAL_FACT_EDIT_FIXTURE_AMENDMENT", "END_BAD")]) {
      expect(() => verifyAmendment(text)).toThrow("FAIL-CLOSED");
      const options = { ...model(), readAmendment: () => text };
      for (const check of [actual, evidence, context, rejection, changed]) expect(() => check(options)).toThrow("FAIL-CLOSED");
    }
    expect(() => actual({ ...model(), readAmendment: () => { throw Error("unreadable"); } })).toThrow("FAIL-CLOSED");
    for (const text of [accepted, fixture.replace("mockResolvedValue(false)", "mockResolvedValue(true)"), fixture.replace("toBe(200)", "toBe(201)"), fixture + "\n"]) {
      // Mutate an actual old assertion rather than relying on a possibly absent literal.
      const changedFixture = text === fixture ? fixture.replace("toHaveBeenCalledWith", "toHaveBeenCalledExactlyOnceWith") : text;
      expect(() => verifyFixture(changedFixture, accepted)).toThrow("FAIL-CLOSED");
      expect(() => actual({ ...model(), readFixture: () => changedFixture })).toThrow("FAIL-CLOSED");
    }
    expect(() => actual(model(ALLOWED.filter(path => path !== FIXTURE)))).toThrow("FAIL-CLOSED");
  });
  it.each(MARKERS)("missing %s fails before every historical projection", marker => {
    const files = ALLOWED.filter(file => file !== marker); expect(has(files)).toBe(false); expect(violations(files).length).toBeGreaterThan(0);
    expect(visual([...files]).violations.length).toBeGreaterThan(0); expect(phase8f([...files]).length).toBeGreaterThan(0);
    for (const check of [actual, evidence, context, rejection]) expect(() => check(model(files))).toThrow("FAIL-CLOSED");
    expect(() => history(NEW_USER_GUIDE_BASE, model(files))).toThrow("FAIL-CLOSED");
    expect(() => content("src/app/activities/[id]/page.tsx", "evidence-page", model(files))).toThrow("FAIL-CLOSED");
  });
  it.each(extras)("unauthorized %s never acquires an old-scope exception", extra => {
    const files = [...ALLOWED, extra]; expect(violations(files)).toEqual([extra]); expect(visual(files).violations).toEqual([extra]); expect(phase8f(files)).toEqual([extra]);
    expect(() => actual(model(files))).toThrow("FAIL-CLOSED"); expect(() => evidence(model(files))).toThrow("FAIL-CLOSED");
  });
  it("all53 required, no duplicates or historical marker composition", () => {
    for (const path of ALLOWED) expect(() => actual(model(ALLOWED.filter(file => file !== path)))).toThrow("FAIL-CLOSED");
    expect(violations([...ALLOWED, CONTROL])).toContain("duplicate proposal fact edit paths");
    for (const old of [NEW_USER_GUIDE_MARKERS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, EVIDENCE_SUBMISSION_MARKERS])
      expect(() => actual(model([...new Set([...ALLOWED, ...old])]))).toThrow("FAIL-CLOSED");
  });
  it("full multi-commit PR and positively identified current-main bind exact base/mode/range/files", () => {
    for (const [head, remote] of [[BASE, revision(2)], [revision(1), revision(2)], [revision(1), revision(1)]]) {
      const fixture = model(ALLOWED, head, remote); expect([...actual(fixture)].sort()).toEqual([...ALLOWED].sort());
      const delta = changed(fixture); bind(delta, fixture);
      expect(delta.range).toBe(head === remote ? `${BASE}..${head}` : `${BASE}...${head}`);
      if (head !== remote) expect(fixture.calls).not.toContain('rev-parse "HEAD^1"');
      for (const forged of [{ ...delta, files: delta.files.slice(1) }, { ...delta, files: [...delta.files, delta.files[0]] },
        { ...delta, mergeBase: revision(9) }, { ...delta, range: `${revision(9)}..${head}` },
        { ...delta, mode: head === remote ? "pr-branch" as const : "current-main-push" as const }]) expect(() => bind(forged, fixture)).toThrow("FAIL-CLOSED");
    }
    expect(() => changed(alter(model(ALLOWED, revision(1), revision(1)), 'rev-parse "HEAD^1"', revision(9)))).toThrow("FAIL-CLOSED");
    const ahead = model(ALLOWED, revision(1), revision(3)); expect(changed(ahead).mode).toBe("pr-branch"); expect(ahead.calls).not.toContain('rev-parse "HEAD^1"');
  });
  it.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${BASE} HEAD`, 'rev-parse "HEAD^1"', "diff", "ls-files --others --exclude-standard -z"])("Git failure %s cannot pass", key => {
    expect(() => actual(alter(model(ALLOWED, revision(1), revision(1)), key, Error("synthetic Git failure")))).toThrow("FAIL-CLOSED");
  });
  it("invalid contract/read/ancestry/revision/paths and empty ranges reject", () => {
    for (const text of ["", document() + "\n", document().replace("131072", "131073")]) expect(() => actual({ ...model(), readControl: () => text })).toThrow("FAIL-CLOSED");
    expect(() => actual({ ...model(), readControl: () => { throw Error("read failure"); } })).toThrow("FAIL-CLOSED");
    for (const [key, value] of [["rev-parse HEAD", ""], ["rev-parse origin/main", "HEAD~1"], [`merge-base ${BASE} HEAD`, revision(9)]]) expect(() => changed(alter(model(), key, value))).toThrow("FAIL-CLOSED");
    for (const raw of ["", "unterminated", "\0", `${CONTROL}\0${CONTROL}\0`, "../secret\0", "/absolute\0", "x\\y\0", "x\ny\0"])
      expect(() => changed(alter(model(), "diff", raw))).toThrow("FAIL-CLOSED");
    expect(() => working(alter(model(), "ls-files --others --exclude-standard -z", "../secret\0"))).toThrow("FAIL-CLOSED");
  });
  it("actual53 and each fixed historical range retain their complete old scopes", () => {
    expect([...actual()].sort()).toEqual([...ALLOWED].sort()); expect(evidence().sort()).toEqual([...EVIDENCE_SUBMISSION_ALLOWED].sort());
    expect(context().sort()).toEqual([...ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED].sort()); expect(rejection().sort()).toEqual([...PROPOSAL_REJECTION_ALLOWED].sort());
    expect(history(ACTIVITY_DETAIL_BASE).sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort()); expect(history(ACTIVITY_MAIN_BASE).sort()).toEqual([...ACTIVITY_MAIN_ALLOWED].sort());
    for (const [from, to, fn] of [[EVIDENCE_SUBMISSION_BASE, BASE, evidence], [ASSESSMENT_CONTEXT_BASE, EVIDENCE_SUBMISSION_BASE, context], [PROPOSAL_REJECTION_BASE, ASSESSMENT_CONTEXT_BASE, rejection]] as const)
      expect(() => fn(alter(model(), `diff --no-renames --name-only -z ${from} ${to}`, "fake\0"))).toThrow("FAIL-CLOSED");
  });
  it("history and exact content group endpoints are not caller-controlled", () => {
    for (const anchor of [BASE, EVIDENCE_SUBMISSION_BASE, ASSESSMENT_CONTEXT_BASE, "HEAD", "", revision(9), NEW_USER_GUIDE_BASE + " -- src"])
      expect(() => history(anchor, model())).toThrow("FAIL-CLOSED");
    for (const group of ["onboarding", "activity", "rejection", "page", "evidence-page", "context-source"] as const)
      for (const file of ["src/lib/store/request-repository.ts", "tests/helpers/governance-delta.ts", "../secret", "docs/unsafe.md"]) expect(() => content(file, group, model())).toThrow("FAIL-CLOSED");
    for (const file of PROPOSAL_REJECTION_HISTORICAL_CONTENT) expect(canonical(content(file, "onboarding", model()))).toBe(blob(PROPOSAL_REJECTION_BASE, file));
    for (const file of ASSESSMENT_CONTEXT_ACTIVITY_CONTENT) expect(canonical(content(file, "activity", model()))).toBe(blob(ASSESSMENT_CONTEXT_BASE, file));
    for (const file of ["src/lib/store/repository.ts", "src/lib/store/supabase-repository.ts"]) expect(canonical(content(file, "context-source", model()))).toBe(blob(BASE, file));
    expect(() => content("src/lib/store/repository.ts", "page", model())).toThrow("FAIL-CLOSED");
    expect(canonical(content("src/app/activities/[id]/page.tsx", "page", model()))).toBe(blob(EVIDENCE_SUBMISSION_BASE, "src/app/activities/[id]/page.tsx"));
    expect(canonical(content("src/app/activities/[id]/page.tsx", "evidence-page", model()))).toBe(blob(BASE, "src/app/activities/[id]/page.tsx"));
  });
  it("all seven current production changes reverse exactly to accepted229c; no historical fake run", () => {
    actual();
    for (const file of ["src/lib/store/repository.ts", "src/lib/store/types.ts", "src/lib/store/supabase-repository.ts", "src/lib/store/settlement.service.ts",
      "src/app/api/activities/[id]/assess/route.ts", "src/components/dashboard/PendingProposals.tsx", "src/app/activities/[id]/page.tsx"]) {
      let current = canonical(readFileSync(file, "utf8"));
      const before = current;
      current = current.replace(/^[ \t]*\/\/ BEGIN PROPOSAL_FACT_EDIT_([A-Z_]+)\n[\s\S]*?^[ \t]*\/\/ END PROPOSAL_FACT_EDIT_\1\n/gm, "")
        .replace(/^[ \t]*\{\/\* BEGIN PROPOSAL_FACT_EDIT_([A-Z_]+) \*\/\}\n[\s\S]*?^[ \t]*\{\/\* END PROPOSAL_FACT_EDIT_\1 \*\/\}\n/gm, "")
        .replace(/^[ \t]*\/\* BEGIN PROPOSAL_FACT_EDIT_([A-Z_]+) \*\/\n[\s\S]*?^[ \t]*\/\* END PROPOSAL_FACT_EDIT_\1 \*\/\n/gm, "");
      expect(current, file).not.toBe(before);
      if (file.endsWith("PendingProposals.tsx")) {
        expect(current.split('const isBusy = isConfirming || operation === "reject" || editing || retired;')).toHaveLength(2);
        current = current.replace('const isBusy = isConfirming || operation === "reject" || editing || retired;', 'const isBusy = isConfirming || operation === "reject";');
      }
      if (file.endsWith("settlement.service.ts")) {
        expect(current.split("effectiveMinutes: effectiveMinutes ?? undefined")).toHaveLength(2);
        expect(current.match(/^          effectiveMinutes,$/gm)).toHaveLength(1);
        current = current.replace("effectiveMinutes: effectiveMinutes ?? undefined", "effectiveMinutes: activity.effectiveMinutes ?? undefined")
          .replace(/^          effectiveMinutes,$/m, "          effectiveMinutes: activity.effectiveMinutes,");
      }
      expect(current, file).toBe(blob(BASE, file));
    }
  });
  it("entire old helper prefix, all54 migrations and frozen authority/source blobs remain real", () => {
    expect(canonical(readFileSync("tests/helpers/governance-delta.ts", "utf8")).startsWith(blob(BASE, "tests/helpers/governance-delta.ts"))).toBe(true);
    const oldSql = readdirSync("supabase/migrations").filter(file => /^00(?:[0-4]\d|5[0-4])_.*\.sql$/.test(file)); expect(oldSql).toHaveLength(54);
    const protectedFiles = ["src/lib/ai/prompts.ts", "src/lib/ai/schemas.ts", "src/lib/ai/assess.ts", "src/lib/store/request-repository.ts",
      "src/lib/growth-engine/xp.ts", "src/lib/growth-engine/levels.ts", "src/lib/growth-engine/mastery.ts", "src/lib/growth-engine/quest-progression.ts",
      "package.json", "pnpm-lock.yaml", "src/lib/milestone/repository.ts", "src/lib/milestone/http.ts", "src/lib/milestone/request.ts", "src/lib/milestone/types.ts",
      "src/lib/milestone/errors.ts", "src/lib/milestone/proposal-review.ts", "src/app/api/milestones/route.ts", "src/app/api/milestones/[id]/route.ts",
      "src/app/api/milestones/[id]/settle/route.ts", "src/app/api/milestones/[id]/revoke/route.ts", "src/app/api/milestones/proposals/route.ts", "src/app/api/milestones/sources/route.ts"];
    for (const file of [...oldSql.map(name => `supabase/migrations/${name}`), ...protectedFiles])
      expect(git("hash-object", `--path=${file}`, file).trim(), file).toBe(git("rev-parse", `${BASE}:${file}`).trim());
  }, 30000);
});
