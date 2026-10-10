import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ASSESSMENT_CONTEXT_BASE as BASE, ASSESSMENT_CONTEXT_CONTROL as CONTROL, ASSESSMENT_CONTEXT_ADMISSION_SHA as HASH,
  ASSESSMENT_CONTEXT_ALLOWED as ALLOWED, ASSESSMENT_CONTEXT_MARKERS as MARKERS, ASSESSMENT_CONTEXT_PRODUCTION as PRODUCTION,
  ASSESSMENT_CONTEXT_TESTS as TESTS, ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as ACTIVITY_CONTENT,
  ASSESSMENT_CONTEXT_COMPATIBILITY_CONTROL as COMPAT_CONTROL, ASSESSMENT_CONTEXT_COMPATIBILITY_SHA as COMPAT_HASH,
  ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED as COMPAT_ALLOWED, ASSESSMENT_CONTEXT_COMPATIBILITY_MARKERS as COMPAT_MARKERS,
  ASSESSMENT_CONTEXT_DEMO_FIXTURE as DEMO_FIXTURE, verifyAssessmentContextCompatibility as verifyCompatibility,
  hasAssessmentContextScope as has, assessmentContextScopeViolations as violations, verifyAssessmentContextAdmission as verify,
  resolveAssessmentContextWorkingFiles as working, resolveAssessmentContextChangedFiles as changed, assertAssessmentContextActualScope as priorActual,
  assertAssessmentContextChangedScope as bindChanged, assessmentContextHistoricalFiles as priorHistory,
  assessmentContextRejectionHistoricalFiles as priorRejectHistory, assessmentContextHistoricalContent as priorContent,
  PROPOSAL_REJECTION_BASE as BEFORE_REJECT, PROPOSAL_REJECTION_ALLOWED, PROPOSAL_REJECTION_HISTORICAL_CONTENT as OLD_CONTENT,
  NEW_USER_GUIDE_BASE, NEW_USER_GUIDE_MARKERS, ACTIVITY_DETAIL_BASE, ACTIVITY_DETAIL_ALLOWED, ACTIVITY_MAIN_BASE, ACTIVITY_MAIN_ALLOWED,
  GRAPH_CANVAS_MARKERS, MOBILE_GRAPH_MARKERS, CONNECTED_FOCUS_MARKERS, SKILL_BOOTSTRAP_MARKERS,
  type AssessmentContextGitOptions } from "./helpers/governance-delta";
import { validateVisualMigrationDelta as visual } from "./visual-foundation.test";
import { phase8fCurrentScopeViolations as phase8f } from "./phase8f-ui-governance.test";
import { isEvidenceSubmissionCheckout, assertEvidenceSubmissionActualScope, evidenceSubmissionContextFiles,
  evidenceSubmissionHistoricalFiles, evidenceSubmissionRejectionFiles, evidenceSubmissionHistoricalContent,
  EVIDENCE_SUBMISSION_BASE } from "./helpers/governance-delta";
// Only actual present-day calls get a fixed-endpoint adapter; every old synthetic model still exercises the original functions.
const actual = (options: AssessmentContextGitOptions = {}) => !options.execute && isEvidenceSubmissionCheckout(options.cwd)
  ? evidenceSubmissionContextFiles(options) : priorActual(options);
const history = (anchor: string, options: AssessmentContextGitOptions = {}) => !options.execute && isEvidenceSubmissionCheckout(options.cwd)
  ? evidenceSubmissionHistoricalFiles(anchor, options) : priorHistory(anchor, options);
const rejectHistory = (options: AssessmentContextGitOptions = {}) => !options.execute && isEvidenceSubmissionCheckout(options.cwd)
  ? evidenceSubmissionRejectionFiles(options) : priorRejectHistory(options);
const content = (file: string, group: "onboarding" | "activity" | "rejection", options: AssessmentContextGitOptions = {}) => !options.execute && isEvidenceSubmissionCheckout(options.cwd)
  ? evidenceSubmissionHistoricalContent(file, group, options) : priorContent(file, group, options);
const canonical=(value:string)=>value.replace(/\r\n/g,"\n"), document=()=>readFileSync(CONTROL,"utf8"), revision=(n:number)=>String(n).repeat(40);
const extras=["src/lib/growth-engine/engine.ts","src/lib/ai/schemas.ts","src/lib/store/settlement.service.ts","src/lib/store/request-repository.ts",
  "src/lib/supabase/admin.ts","src/lib/supabase/server.ts","src/app/api/assessments/[id]/confirm/route.ts","src/app/api/assessments/[id]/reject/route.ts",
  "src/app/api/auth/login/route.ts","src/app/dashboard/page.tsx","src/components/dashboard/PendingProposals.tsx","src/app/skills/page.tsx",
  "src/app/knowledge/page.tsx","src/lib/milestone/repository.ts","src/lib/reward/fold.ts","src/styles/design-tokens.css","src/app/globals.css",
  "src/proxy.ts","supabase/migrations/0054_unsafe.sql","package.json","pnpm-lock.yaml","next.config.ts","tsconfig.json","vitest.config.ts",
  ".github/workflows/ci.yml",".env.local","scripts/unsafe.cjs","public/unsafe.svg","tests/unsafe.test.ts","docs/unsafe.md",
  "docs/SiteReadiness/11_PROPOSAL_REJECTION_CONTRACT.md","docs/Design ChatGPT/01_SYSTEM_RULES.md"];
function model(files:readonly string[]=ALLOWED,head=BASE,remote=revision(2)) {
  const calls:string[]=[];
  return {calls,readControl:document,execute(command:string):string {
    calls.push(command);if(command==="rev-parse HEAD")return head;if(command==="rev-parse origin/main")return remote;
    if(command==='rev-parse "HEAD^1"')return BASE;if(command===`merge-base ${BASE} HEAD`)return BASE;
    if(command==="ls-files --others --exclude-standard -z")return "";
    if(command.startsWith("merge-base ")&&command.endsWith(` ${BASE}`))return command.split(" ")[1];
    if(command.startsWith("merge-base ")&&command.endsWith(` ${BEFORE_REJECT}`))return command.split(" ")[1];
    if(command.startsWith(`show ${BASE}:`)||command.startsWith(`show ${BEFORE_REJECT}:`))return "historical fixture content\n";
    if(command===`diff --no-renames --name-only -z ${BEFORE_REJECT} ${BASE}`)return PROPOSAL_REJECTION_ALLOWED.join("\0")+"\0";
    if(command.startsWith("diff --no-renames --name-only -z ")&&command.endsWith(` ${BEFORE_REJECT}`))return "historical-path.txt\0";
    if(command.startsWith("diff --no-renames --name-only -z "))return files.join("\0")+(files.length?"\0":"");
    throw Error("Unexpected bounded fixture Git command");
  }};
}
function altered(options:AssessmentContextGitOptions,key:string,value:string|Error):AssessmentContextGitOptions {
  return {...options,execute:command=>{if(command===key||(key==="diff"&&command.startsWith("diff "))){if(value instanceof Error)throw value;return value;}return options.execute!(command);}};
}
describe("context13 exact30/16 new gate and explicitly bounded accepted history",()=>{
  test("entire immutable contract, unique production/tests/markers/allowlist bind exactly",()=>{
    expect(createHash("sha256").update(canonical(document())).digest("hex").toUpperCase()).toBe(HASH);verify(document());
    expect(ALLOWED).toHaveLength(30);expect(new Set(ALLOWED).size).toBe(30);expect(MARKERS).toHaveLength(16);expect(new Set(MARKERS).size).toBe(16);
    expect(PRODUCTION).toHaveLength(7);expect(TESTS).toHaveLength(7);expect([...ALLOWED].sort()).toEqual(canonical(document()).match(/```text\n([\s\S]*?)\n```/)![1].split("\n").sort());
    expect(violations(ALLOWED)).toEqual([]);expect(visual([...ALLOWED])).toEqual({isVisualPR:true,violations:[]});expect(phase8f([...MARKERS])).toEqual([]);
  });
  test.each(MARKERS)("missing %s fails before nonvisual early-return/history/content",marker=>{
    const files=ALLOWED.filter(file=>file!==marker);expect(has(files)).toBe(false);expect(violations(files).length).toBeGreaterThan(0);
    expect(()=>actual(model(files))).toThrow("FAIL-CLOSED");expect(()=>history(NEW_USER_GUIDE_BASE,model(files))).toThrow("FAIL-CLOSED");
    if(files.includes(CONTROL))expect(visual([...files]).violations.length).toBeGreaterThan(0);
    expect(phase8f([...files]).length).toBeGreaterThan(0);
  });
  test.each(extras)("extra %s is rejected before any historical allowance",extra=>{
    const files=[...ALLOWED,extra];expect(violations(files)).toEqual([extra]);expect(visual(files).violations).toEqual([extra]);expect(()=>actual(model(files))).toThrow("FAIL-CLOSED");
    expect(()=>history(NEW_USER_GUIDE_BASE,model(files))).toThrow("FAIL-CLOSED");expect(()=>rejectHistory(model(files))).toThrow("FAIL-CLOSED");
    expect(()=>content(ACTIVITY_CONTENT[0],"activity",model(files))).toThrow("FAIL-CLOSED");
    if(/^(src\/|supabase\/|\.github\/)/.test(extra)||["package.json","pnpm-lock.yaml","next.config.ts","tsconfig.json","vitest.config.ts"].includes(extra))expect(phase8f([...MARKERS,extra])).toContain(extra);
  });
  test("duplicates, incompleteAPI-only selectors and old permission mixes never activate",()=>{
    expect(violations([...ALLOWED,CONTROL])).toContain("duplicate context paths");
    for(const previous of [NEW_USER_GUIDE_MARKERS,GRAPH_CANVAS_MARKERS,MOBILE_GRAPH_MARKERS,CONNECTED_FOCUS_MARKERS,SKILL_BOOTSTRAP_MARKERS]) {
      const files=[...new Set([...ALLOWED,...previous])];expect(violations(files).length).toBeGreaterThan(0);expect(visual(files).violations.length).toBeGreaterThan(0);
    }
    for(const files of [[CONTROL],[CONTROL,PRODUCTION[0]],[CONTROL,...PRODUCTION],[CONTROL,...TESTS]])expect(visual([...files]).violations.length).toBeGreaterThan(0);
  });
  test("actual entire current32 and distinct historical22/7/25 remain exact",()=>{
    expect([...actual()].sort()).toEqual([...COMPAT_ALLOWED].sort());expect(history(ACTIVITY_DETAIL_BASE).sort()).toEqual([...ACTIVITY_DETAIL_ALLOWED].sort());
    expect(history(ACTIVITY_MAIN_BASE).sort()).toEqual([...ACTIVITY_MAIN_ALLOWED].sort());expect(rejectHistory().sort()).toEqual([...PROPOSAL_REJECTION_ALLOWED].sort());
  });
  test("full accepted15f...HEAD range remains PR when remote ahead, never HEAD~1",()=>{
    for(const head of [BASE,revision(1)]){const fixture=model(ALLOWED,head),delta=changed(fixture);expect(delta.mode).toBe("pr-branch");expect(delta.range).toBe(`${BASE}...${head}`);bindChanged(delta,fixture);expect(fixture.calls).not.toContain('rev-parse "HEAD^1"');}
  });
  test("verified current-main uses actualfirstparent and rejects forgedmode/range/files/base",()=>{
    const fixture=model(ALLOWED,revision(1),revision(1)),delta=changed(fixture);expect(delta.mode).toBe("current-main-push");expect(delta.range).toBe(`${BASE}..${revision(1)}`);bindChanged(delta,fixture);actual(fixture);
    for(const bad of [{...delta,mode:"pr-branch" as const},{...delta,range:`${BASE}...${revision(1)}`},{...delta,mergeBase:revision(9)},{...delta,files:delta.files.slice(1)},{...delta,files:[...delta.files,delta.files[0]]}])expect(()=>bindChanged(bad,fixture)).toThrow("FAIL-CLOSED");
  });
  test.each(["rev-parse HEAD","rev-parse origin/main",`merge-base ${BASE} HEAD`,'rev-parse "HEAD^1"',"diff"])("Git error %s is failclosed",key=>{
    expect(()=>changed(altered(model(ALLOWED,revision(1),revision(1)),key,Error("fixture")))).toThrow("FAIL-CLOSED");
  });
  test("empty/malformed/duplicate/path traversal/hash/read/ancestry inputs cannot bind",()=>{
    for(const raw of ["","unterminated","\0",`${CONTROL}\0${CONTROL}\0`,"../secret\0","/absolute\0","x\\y\0","x\ny\0"])
      expect(()=>changed(altered(model(),"diff",raw))).toThrow("FAIL-CLOSED");
    for(const [key,value] of [["rev-parse HEAD",""],["rev-parse origin/main","HEAD~1"],[`merge-base ${BASE} HEAD`,revision(9)]])expect(()=>changed(altered(model(),key,value))).toThrow("FAIL-CLOSED");
    for(const text of ["",document()+"\n",document().replace("4096","4097"),document()+document()])expect(()=>actual({...model(),readControl:()=>text})).toThrow("FAIL-CLOSED");
    expect(()=>actual({...model(),readControl:()=>{throw Error("fixture");}})).toThrow("FAIL-CLOSED");
    expect(()=>working(altered(model(),"ls-files --others --exclude-standard -z",Error("fixture")))).toThrow("FAIL-CLOSED");
  });
  test("history uses two explicit real fixed endpoints, denies arbitrary anchors/Git failures",()=>{
    const fixture=model();history(NEW_USER_GUIDE_BASE,fixture);rejectHistory(fixture);
    expect(fixture.calls).toContain(`diff --no-renames --name-only -z ${NEW_USER_GUIDE_BASE} ${BEFORE_REJECT}`);expect(fixture.calls).toContain(`diff --no-renames --name-only -z ${BEFORE_REJECT} ${BASE}`);
    for(const anchor of [BASE,BEFORE_REJECT,"HEAD","",revision(9),NEW_USER_GUIDE_BASE+" -- src"])expect(()=>history(anchor,fixture)).toThrow("FAIL-CLOSED");
    expect(()=>history(NEW_USER_GUIDE_BASE,altered(fixture,`merge-base ${NEW_USER_GUIDE_BASE} ${BEFORE_REJECT}`,revision(9)))).toThrow("FAIL-CLOSED");
    expect(()=>rejectHistory(altered(fixture,`diff --no-renames --name-only -z ${BEFORE_REJECT} ${BASE}`,"fake\0"))).toThrow("FAIL-CLOSED");
  });
  test("ten content paths are endpoint/group-bound, never blanket old docs/source",()=>{
    for(const file of OLD_CONTENT)expect(canonical(content(file,"onboarding"))).toBe(canonical(execFileSync("git",["show",`${BEFORE_REJECT}:${file}`],{encoding:"utf8"})));
    for(const file of ACTIVITY_CONTENT)expect(canonical(content(file,"activity"))).toBe(canonical(execFileSync("git",["show",`${BASE}:${file}`],{encoding:"utf8"})));
    expect(canonical(content("src/lib/ai/prompts.ts","rejection"))).toBe(canonical(execFileSync("git",["show",`${BASE}:src/lib/ai/prompts.ts`],{encoding:"utf8"})));
    for(const group of ["onboarding","activity","rejection"] as const)for(const file of ["src/lib/store/request-repository.ts","src/app/dashboard/page.tsx","tests/helpers/governance-delta.ts","docs/unsafe.md"])
      expect(()=>content(file,group,model())).toThrow("FAIL-CLOSED");
    expect(()=>content(ACTIVITY_CONTENT[0],"onboarding",model())).toThrow("FAIL-CLOSED");expect(()=>content(OLD_CONTENT[0],"activity",model())).toThrow("FAIL-CLOSED");
  },30000);
  test("entire accepted helper/product prefixes and all forbidden DB/growth/config scopes remain frozen",()=>{
    for(const file of ["tests/helpers/governance-delta.ts","docs/Design ChatGPT/02_PRODUCT_DESIGN.md"])expect(canonical(readFileSync(file,"utf8")).startsWith(canonical(execFileSync("git",["show",`${BASE}:${file}`],{encoding:"utf8"})))).toBe(true);
    const protectedPaths=["supabase","src/lib/supabase","src/lib/growth-engine","src/lib/store/settlement.service.ts","src/lib/store/request-repository.ts","src/lib/ai/schemas.ts","src/app/api/assessments","src/components/dashboard/PendingProposals.tsx","package.json","pnpm-lock.yaml",".github","src/app/globals.css","src/styles/design-tokens.css"];
    if (isEvidenceSubmissionCheckout()) {
      assertEvidenceSubmissionActualScope();
      expect(execFileSync("git",["diff","--no-renames","--name-only",BASE,EVIDENCE_SUBMISSION_BASE,"--",...protectedPaths],{encoding:"utf8"}).trim()).toBe("");
      return;
    }
    expect(execFileSync("git",["diff","--no-renames","--name-only",BASE,"--",...protectedPaths],{encoding:"utf8"}).trim()).toBe("");
  });
});

describe("compatibility15 exact32/17 without weakening original13 or historical guards",()=>{
  const compatibility=()=>readFileSync(COMPAT_CONTROL,"utf8");
  test("full immutable supplement and exact two additions bind current selectors",()=>{
    expect(createHash("sha256").update(canonical(compatibility())).digest("hex").toUpperCase()).toBe(COMPAT_HASH);verifyCompatibility(compatibility());verify(document());
    expect(COMPAT_ALLOWED).toHaveLength(32);expect(new Set(COMPAT_ALLOWED).size).toBe(32);expect(COMPAT_MARKERS).toHaveLength(17);
    expect(new Set(COMPAT_MARKERS).size).toBe(17);expect(COMPAT_MARKERS.filter(file=>!MARKERS.includes(file as typeof MARKERS[number]))).toEqual([COMPAT_CONTROL]);
    expect(COMPAT_ALLOWED.filter(file=>!(ALLOWED as readonly string[]).includes(file)).sort()).toEqual([COMPAT_CONTROL,DEMO_FIXTURE].sort());
    expect([...COMPAT_ALLOWED].sort()).toEqual(canonical(compatibility()).match(/```text\n([\s\S]*?)\n```/)![1].split("\n").sort());
    expect(has(COMPAT_ALLOWED)).toBe(true);expect(violations(COMPAT_ALLOWED)).toEqual([]);expect(visual([...COMPAT_ALLOWED])).toEqual({isVisualPR:true,violations:[]});expect(phase8f([...COMPAT_ALLOWED])).toEqual([]);
  });
  test.each(COMPAT_MARKERS)("missing compatibility marker %s fails before every old fallback",marker=>{
    const files=COMPAT_ALLOWED.filter(file=>file!==marker);expect(has(files)).toBe(false);expect(violations(files).length).toBeGreaterThan(0);
    expect(visual([...files]).violations.length).toBeGreaterThan(0);expect(phase8f([...files]).length).toBeGreaterThan(0);
    expect(()=>actual(model(files))).toThrow("FAIL-CLOSED");expect(()=>history(NEW_USER_GUIDE_BASE,model(files))).toThrow("FAIL-CLOSED");
    expect(()=>rejectHistory(model(files))).toThrow("FAIL-CLOSED");expect(()=>content(ACTIVITY_CONTENT[0],"activity",model(files))).toThrow("FAIL-CLOSED");
  });
  test.each(extras)("compatibility extra %s never receives a historical allowance",extra=>{
    const files=[...COMPAT_ALLOWED,extra];expect(violations(files)).toEqual([extra]);expect(visual(files).violations).toEqual([extra]);
    expect(()=>actual(model(files))).toThrow("FAIL-CLOSED");expect(()=>history(NEW_USER_GUIDE_BASE,model(files))).toThrow("FAIL-CLOSED");
  });
  test("required old Demo fixture, duplicates and oldscope mixes cannot form32",()=>{
    const missing=COMPAT_ALLOWED.filter(file=>file!==DEMO_FIXTURE);expect(has(missing)).toBe(false);expect(visual([...missing]).violations.length).toBeGreaterThan(0);expect(()=>actual(model(missing))).toThrow("FAIL-CLOSED");
    expect(violations([...COMPAT_ALLOWED,COMPAT_CONTROL])).toContain("duplicate context paths");
    for(const previous of [NEW_USER_GUIDE_MARKERS,GRAPH_CANVAS_MARKERS,MOBILE_GRAPH_MARKERS,CONNECTED_FOCUS_MARKERS,SKILL_BOOTSTRAP_MARKERS])expect(()=>actual(model([...new Set([...COMPAT_ALLOWED,...previous])]))).toThrow("FAIL-CLOSED");
    // Original13 synthetic/default behavior is still separately exercised by the entire preceding describe.
    expect(violations(ALLOWED)).toEqual([]);expect(violations([...ALLOWED,DEMO_FIXTURE]).length).toBeGreaterThan(0);
  });
  test("both admission hashes/read failures and all Git failures stay failclosed",()=>{
    for(const text of ["",compatibility()+"\n",compatibility().replace("EXACT32","EXACT33")]){
      expect(()=>verifyCompatibility(text)).toThrow("FAIL-CLOSED");expect(()=>actual({...model(COMPAT_ALLOWED),readCompatibilityControl:()=>text})).toThrow("FAIL-CLOSED");
    }
    expect(()=>actual({...model(COMPAT_ALLOWED),readCompatibilityControl:()=>{throw Error("fixture");}})).toThrow("FAIL-CLOSED");
    expect(()=>actual({...model(COMPAT_ALLOWED),readControl:()=>document()+"\n"})).toThrow("FAIL-CLOSED");
    for(const key of ["rev-parse HEAD","rev-parse origin/main",`merge-base ${BASE} HEAD`,'rev-parse "HEAD^1"',"diff","ls-files --others --exclude-standard -z"])
      expect(()=>actual(altered(model(COMPAT_ALLOWED,revision(1),revision(1)),key,Error("fixture")))).toThrow("FAIL-CLOSED");
  });
  test("working, cumulativePR and current-main bind exact32 and actual range",()=>{
    for(const [head,remote,mode] of [[BASE,revision(2),"pr-branch"],[revision(1),revision(2),"pr-branch"],[revision(1),revision(1),"current-main-push"]] as const){
      const fixture=model(COMPAT_ALLOWED,head,remote);expect([...actual(fixture)].sort()).toEqual([...COMPAT_ALLOWED].sort());
      const delta=changed(fixture);expect(delta.mode).toBe(mode);bindChanged(delta,fixture);
      expect(delta.range).toBe(mode==="current-main-push"?`${BASE}..${head}`:`${BASE}...${head}`);
      expect(()=>bindChanged({...delta,files:delta.files.filter(file=>file!==COMPAT_CONTROL)},fixture)).toThrow("FAIL-CLOSED");
    }
  });
  test("all six old AI-failure test bodies restore by removing only explicit Demo selection",()=>{
    const addition="    // Explicit Demo fixture: never inherit configured Supabase authority from the full suite.\n    delete process.env.NEXT_PUBLIC_SUPABASE_URL;\n    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;\n";
    const current=canonical(readFileSync(DEMO_FIXTURE,"utf8"));expect(current.split(addition)).toHaveLength(2);
    expect(current.replace(addition,"")).toBe(canonical(execFileSync("git",["show",`${BASE}:${DEMO_FIXTURE}`],{encoding:"utf8"})));
    for(const group of ["onboarding","activity","rejection"] as const)expect(()=>content(DEMO_FIXTURE,group,model(COMPAT_ALLOWED))).toThrow("FAIL-CLOSED");
  });
});
