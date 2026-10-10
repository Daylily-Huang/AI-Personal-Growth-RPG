import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_SUBMISSION_BASE as BASE, EVIDENCE_SUBMISSION_CONTROL as CONTROL, EVIDENCE_SUBMISSION_ADMISSION_SHA as HASH,
  EVIDENCE_SUBMISSION_ALLOWED as ALLOWED, EVIDENCE_SUBMISSION_MARKERS as MARKERS, EVIDENCE_SUBMISSION_PRODUCTION as PRODUCTION,
  EVIDENCE_SUBMISSION_TESTS as TESTS, EVIDENCE_SUBMISSION_MIGRATION as MIGRATION,
  hasEvidenceSubmissionScope as has, evidenceSubmissionScopeViolations as violations, verifyEvidenceSubmissionAdmission as verify,
  resolveEvidenceSubmissionWorkingFiles as working, resolveEvidenceSubmissionChangedFiles as changed,
  assertEvidenceSubmissionActualScope as actual, assertEvidenceSubmissionChangedScope as bind,
  evidenceSubmissionHistoricalFiles as history, evidenceSubmissionContextFiles as contextHistory,
  evidenceSubmissionRejectionFiles as rejectHistory, evidenceSubmissionHistoricalContent as content,
  ASSESSMENT_CONTEXT_BASE as CONTEXT_BASE, ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED as CONTEXT_ALLOWED,
  PROPOSAL_REJECTION_BASE as REJECT_BASE, PROPOSAL_REJECTION_ALLOWED as REJECT_ALLOWED,
  PROPOSAL_REJECTION_HISTORICAL_CONTENT as OLD_CONTENT, ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as ACTIVITY_CONTENT,
  NEW_USER_GUIDE_BASE, NEW_USER_GUIDE_MARKERS, ACTIVITY_DETAIL_BASE, ACTIVITY_DETAIL_ALLOWED,
  ACTIVITY_MAIN_BASE, ACTIVITY_MAIN_ALLOWED, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS,
  SKILL_BOOTSTRAP_MARKERS, type ProposalRejectionGitOptions,
} from "./helpers/governance-delta";
import { validateVisualMigrationDelta as visual } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations as phase8f } from "./phase8f-ui-governance.test";
const canonical = (value: string) => value.replace(/\r\n/g, "\n");
const document = () => readFileSync(CONTROL, "utf8"), revision = (n: number) => String(n).repeat(40);
const actualDiff = (from: string, to: string) => execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", from, to], { encoding: "utf8" });
function model(files: readonly string[] = ALLOWED, head = BASE, remote = revision(2)): ProposalRejectionGitOptions & { calls: string[] } {
  const calls: string[] = [];
  return { readControl: document, calls, execute(command) {
    calls.push(command);
    if (command === "rev-parse HEAD") return head;
    if (command === "rev-parse origin/main") return remote;
    if (command === 'rev-parse "HEAD^1"') return BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command === `merge-base ${BASE} HEAD`) return BASE;
    if (command.startsWith("merge-base ")) return command.split(" ")[1];
    if (command === `diff --no-renames --name-only -z ${CONTEXT_BASE} ${BASE}`) return actualDiff(CONTEXT_BASE, BASE);
    if (command === `diff --no-renames --name-only -z ${REJECT_BASE} ${CONTEXT_BASE}`) return actualDiff(REJECT_BASE, CONTEXT_BASE);
    if (command.startsWith("diff ") && command.endsWith(` ${REJECT_BASE}`)) return actualDiff(command.split(" ").at(-2)!, REJECT_BASE);
    if (command.startsWith("diff ")) return [...files, ""].join("\0");
    if (command.startsWith("show ")) {
      const match = /^show ([0-9a-f]{40}):"([^"]+)"$/.exec(command);
      if (!match) throw Error("fixture invalid show"); return execFileSync("git", ["show", `${match[1]}:${match[2]}`], { encoding: "utf8" });
    }
    throw Error("Unrecognized fixture command");
  } };
}
function alter(options: ProposalRejectionGitOptions, key: string, response: string | Error): ProposalRejectionGitOptions {
  return { ...options, execute: command => {
    if (command === key || (key === "diff" && command.startsWith("diff "))) { if (response instanceof Error) throw response; return response; }
    return options.execute!(command);
  } };
}
const extras = ["src/lib/store/request-repository.ts", "src/lib/store/supabase-repository.ts", "src/lib/growth-engine/engine.ts",
  "src/lib/ai/prompts.ts", "src/lib/supabase/database.types.ts", "src/app/api/activities/route.ts", "src/app/skills/page.tsx",
  "src/app/knowledge/page.tsx", "src/lib/reward/fold.ts", "src/lib/milestone/repository.ts", "src/proxy.ts",
  "supabase/migrations/0055_unsafe.sql", "supabase/migrations/0049_phase8e_reward_wishes_rpc_authority.sql",
  "package.json", "pnpm-lock.yaml", "next.config.ts", "vitest.config.ts", "tsconfig.json", ".github/workflows/ci.yml",
  ".env.local", "密钥不要上传.txt", "scripts/unsafe.cjs", "public/unsafe.svg", "tests/unsafe.test.ts", "docs/unsafe.md"];

describe("Evidence16 strict authority, immutable admission and whole historical closure", () => {
  it("binds exact35/all19, nine TS/oneSQL/seven tests and sole0054 exception", () => {
    expect(createHash("sha256").update(canonical(document())).digest("hex").toUpperCase()).toBe(HASH); verify(document());
    expect(ALLOWED).toHaveLength(35); expect(new Set(ALLOWED).size).toBe(35); expect(MARKERS).toHaveLength(19); expect(new Set(MARKERS).size).toBe(19);
    expect(PRODUCTION).toHaveLength(9); expect(TESTS).toHaveLength(7); expect(ALLOWED.filter(file => file.startsWith("supabase/"))).toEqual([MIGRATION]);
    expect([...ALLOWED].sort()).toEqual(canonical(document()).match(/```text\n([\s\S]*?)\n```/)![1].split("\n").sort());
    expect(has(ALLOWED)).toBe(true); expect(violations(ALLOWED)).toEqual([]); expect(visual([...ALLOWED])).toEqual({ isVisualPR: true, violations: [] }); expect(phase8f([...ALLOWED])).toEqual([]);
  });
  it.each(MARKERS)("missing marker %s cannot borrow an old gate", marker => {
    const files = ALLOWED.filter(file => file !== marker); expect(has(files)).toBe(false); expect(violations(files).length).toBeGreaterThan(0);
    expect(visual([...files]).violations.length).toBeGreaterThan(0); expect(phase8f([...files]).length).toBeGreaterThan(0);
    expect(() => actual(model(files))).toThrow("FAIL-CLOSED"); expect(() => history(NEW_USER_GUIDE_BASE, model(files))).toThrow("FAIL-CLOSED");
  });
  it.each(extras)("extra %s is rejected before any history", extra => {
    const files = [...ALLOWED, extra]; expect(violations(files)).toEqual([extra]); expect(visual(files).violations).toEqual([extra]); expect(phase8f(files)).toEqual([extra]);
    expect(() => actual(model(files))).toThrow("FAIL-CLOSED"); expect(() => contextHistory(model(files))).toThrow("FAIL-CLOSED");
  });
  it("missing audit path, duplicates and mixed old scopes cannot form35", () => {
    for (const path of ALLOWED) expect(() => actual(model(ALLOWED.filter(file => file !== path)))).toThrow("FAIL-CLOSED");
    expect(violations([...ALLOWED, CONTROL])).toContain("duplicate evidence paths");
    for (const old of [NEW_USER_GUIDE_MARKERS, GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, SKILL_BOOTSTRAP_MARKERS]) expect(() => actual(model([...new Set([...ALLOWED, ...old])]))).toThrow("FAIL-CLOSED");
  });
  it("working/cumulativePR/current-main re-resolve actual mode/range/base/files", () => {
    for (const [head, remote] of [[BASE, revision(2)], [revision(1), revision(2)], [revision(1), revision(1)]]) {
      const fixture = model(ALLOWED, head, remote); expect([...actual(fixture)].sort()).toEqual([...ALLOWED].sort());
      const delta = changed(fixture); bind(delta, fixture);
      expect(delta.range).toBe(head === remote ? `${BASE}..${head}` : `${BASE}...${head}`);
      if (head !== remote) expect(fixture.calls).not.toContain('rev-parse "HEAD^1"');
      for (const forged of [{ ...delta, files: delta.files.slice(1) }, { ...delta, files: [...delta.files, delta.files[0]] }, { ...delta, mergeBase: revision(9) }, { ...delta, mode: head === remote ? "pr-branch" as const : "current-main-push" as const }]) expect(() => bind(forged, fixture)).toThrow("FAIL-CLOSED");
    }
    expect(() => changed(alter(model(ALLOWED, revision(1), revision(1)), 'rev-parse "HEAD^1"', revision(9)))).toThrow("FAIL-CLOSED");
  });
  it.each(["rev-parse HEAD", "rev-parse origin/main", `merge-base ${BASE} HEAD`, 'rev-parse "HEAD^1"', "diff", "ls-files --others --exclude-standard -z"])("Git error %s is fail-closed", key => expect(() => actual(alter(model(ALLOWED, revision(1), revision(1)), key, Error("fixture")))).toThrow("FAIL-CLOSED"));
  it("malformed hashes/paths/contract and empty Git ranges are rejected", () => {
    for (const raw of ["", "unterminated", "\0", `${CONTROL}\0${CONTROL}\0`, "../secret\0", "/absolute\0", "x\\y\0", "x\ny\0"]) expect(() => changed(alter(model(), "diff", raw))).toThrow("FAIL-CLOSED");
    for (const [key, value] of [["rev-parse HEAD", ""], ["rev-parse origin/main", "HEAD~1"], [`merge-base ${BASE} HEAD`, revision(9)]]) expect(() => changed(alter(model(), key, value))).toThrow("FAIL-CLOSED");
    for (const text of ["", document() + "\n", document().replace("1310720", "1310721")]) expect(() => actual({ ...model(), readControl: () => text })).toThrow("FAIL-CLOSED");
    expect(() => actual({ ...model(), readControl: () => { throw Error("fixture read"); } })).toThrow("FAIL-CLOSED");
    expect(() => working(alter(model(), "ls-files --others --exclude-standard -z", Error("fixture")))).toThrow("FAIL-CLOSED");
  });
  it("actual whole35 and distinct32/25/22/7 historical ranges remain strict", () => {
    expect([...actual()].sort()).toEqual([...ALLOWED].sort()); expect(contextHistory().sort()).toEqual([...CONTEXT_ALLOWED].sort());
    expect(rejectHistory().sort()).toEqual([...REJECT_ALLOWED].sort()); expect(history(ACTIVITY_DETAIL_BASE).sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort());
    expect(history(ACTIVITY_MAIN_BASE).sort()).toEqual([...ACTIVITY_MAIN_ALLOWED].sort());
  });
  it("history endpoints and content group cannot be selected by arbitrary input", () => {
    for (const anchor of [BASE, CONTEXT_BASE, REJECT_BASE, "HEAD", "", revision(9), NEW_USER_GUIDE_BASE + " -- src"]) expect(() => history(anchor, model())).toThrow("FAIL-CLOSED");
    for (const group of ["onboarding", "activity", "rejection", "page"] as const) for (const file of ["src/lib/store/request-repository.ts", "tests/helpers/governance-delta.ts", "../secret", "docs/unsafe.md"]) expect(() => content(file, group, model())).toThrow("FAIL-CLOSED");
    expect(() => content(ACTIVITY_CONTENT[0], "onboarding", model())).toThrow("FAIL-CLOSED");
    expect(() => content(OLD_CONTENT[0], "activity", model())).toThrow("FAIL-CLOSED");
    expect(() => content("src/app/activities/[id]/page.tsx", "rejection", model())).toThrow("FAIL-CLOSED");
    expect(() => contextHistory(alter(model(), `diff --no-renames --name-only -z ${CONTEXT_BASE} ${BASE}`, "fake\0"))).toThrow("FAIL-CLOSED");
  });
  it("original page exactly restored by removing only panel import/insertion", () => {
    const file = "src/app/activities/[id]/page.tsx", current = canonical(readFileSync(file, "utf8"));
    const additions = ['import { EvidenceSubmissionPanel } from "@/components/activities/EvidenceSubmissionPanel";\n', '      <EvidenceSubmissionPanel activityId={visible.activity.id} />\n'];
    let reconstructed = current;
    for (const addition of additions) { expect(reconstructed.split(addition)).toHaveLength(2); reconstructed = reconstructed.replace(addition, ""); }
    expect(reconstructed).toBe(canonical(execFileSync("git", ["show", `${BASE}:${file}`], { encoding: "utf8" })));
    expect(canonical(content(file, "page"))).toBe(reconstructed);
  });
  it("entire old helper/product prefixes and all53 old SQL blobs stay frozen", () => {
    for (const file of ["tests/helpers/governance-delta.ts", "docs/Design ChatGPT/02_PRODUCT_DESIGN.md"]) expect(canonical(readFileSync(file, "utf8")).startsWith(canonical(execFileSync("git", ["show", `${BASE}:${file}`], { encoding: "utf8" })))).toBe(true);
    const migrations = readdirSync("supabase/migrations").filter(file => /^00(?:[0-4]\d|5[0-3])_.*\.sql$/.test(file)); expect(migrations).toHaveLength(53);
    for (const name of migrations) {
      const file = `supabase/migrations/${name}`; expect(execFileSync("git", ["hash-object", `--path=${file}`, file], { encoding: "utf8" }).trim()).toBe(execFileSync("git", ["rev-parse", `${BASE}:${file}`], { encoding: "utf8" }).trim());
    }
  }, 30000);
});
