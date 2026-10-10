import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { ASSESSMENT_CONTEXT_LIMITS as LIMIT, AssessmentContextError, contextSkillRowSchema, parseContextData,
  selectRelatedContextSkills, utf8Bytes, clipContextText, fitAssessmentContextBudget,
  validateAssessmentContextSnapshot, serializeAssessmentContext, type AssessmentContextSnapshot, type ContextSkillRow } from "@/lib/ai/assessment-context";

function snapshot(): AssessmentContextSnapshot {
  return { activityId: randomUUID(), rawInput: "用R做统计分析", context: { version: "activity-context-v1", asOf: "2026-10-10T12:00:00.000Z",
    rulesVersion: "frozen-activity-rule", mainQuest: null, relatedSkills: [], recentSamples: [],
    temporaryState: { energy: 70, focus: 60, momentum: 30, stress: 10 }, coverage: {
      candidateScanTruncated: false, aliasesTruncated: false, skillNamesOmitted: false, relatedSkillsTruncated: false,
      recentSamplesTruncated: false, questChainIncomplete: false, budgetReduced: false } } };
}
function skill(name: string, aliases: string[] = [], id = randomUUID()): ContextSkillRow {
  return { id, user_id: "967bed63-dc5b-48d6-af2f-690362bc476c", name, aliases, mastery_level: 3, mastery_confidence: 0.7, status: "active" };
}
describe("minimal assessment context: actual matching, strict own DTO and UTF8 resource boundary", () => {
  test("freezes exact operational limits, not growth coefficients", () => {
    expect(LIMIT).toEqual({ candidates: 200, candidateQuery: 201, aliases: 20, skills: 5, recent: 5, recentQuery: 6,
      questDepth: 8, recentDays: 30, titleBytes: 512, nameBytes: 160, jsonBytes: 4096 }); expect(Object.isFrozen(LIMIT)).toBe(true);
  });
  test.each(["learn", "RPG", "AR1", "r_2", "_R", "RR"])("R is not a substring authority in %s", raw => {
    expect(selectRelatedContextSkills(raw, [skill("R")]).skills).toEqual([]);
  });
  test.each(["用R学习", "R语言", "(r)", " R ", "R🙂", "r"])("Latin boundaries allow actual standalone/Chinese-neighbor match %s", raw => {
    expect(selectRelatedContextSkills(raw, [skill("R")]).skills.map(row => row.name)).toEqual(["R"]);
  });
  test("Chinese name, alias, longest label, first position and UUID ties are deterministic", () => {
    const a = skill("甲技能", ["统计分析"], "00000000-0000-4000-8000-000000000001"), b = skill("乙技能", ["统计分析"], "00000000-0000-4000-8000-000000000002");
    const c = skill("分析"), d = skill("Python");
    for (const rows of [[d,b,c,a], [c,a,d,b]]) expect(selectRelatedContextSkills("先Python后统计分析", rows).skills.map(row => row.name))
      .toEqual(["Python", "甲技能", "乙技能", "分析"]);
  });
  test("only first200 candidates/20 aliases are examined, and incompleteness is explicit", () => {
    const rows = Array.from({length:201}, (_, index) => skill(`Skill-${index}`, index === 0 ? [...Array.from({length:20}, (_, n) => `alias-${n}`), "secret-match"] : []));
    const result = selectRelatedContextSkills("Skill-200 secret-match", rows);
    expect(result.skills).toEqual([]); expect(result.coverage.candidateScanTruncated).toBe(true); expect(result.coverage.aliasesTruncated).toBe(true);
  });
  test("at most5 matching skills; oversize display identities are omitted, never clipped/renamed", () => {
    const rows = Array.from({length:7}, (_, index) => skill(`Skill${index}`)), long = skill("技能".repeat(40), ["long-match"]);
    const result = selectRelatedContextSkills(rows.map(row => row.name).join(" ") + " long-match", [...rows,long]);
    expect(result.skills).toHaveLength(5); expect(result.coverage.relatedSkillsTruncated).toBe(true); expect(result.coverage.skillNamesOmitted).toBe(true);
    expect(result.skills.every(row => row.name !== long.name)).toBe(true);
  });
  test("UTF8 clipping keeps complete emoji/CJK and includes JSON escaping in actual budget", () => {
    expect(utf8Bytes("中🙂")).toBe(7); expect(clipContextText("中🙂尾",6)).toBe("中"); expect(clipContextText("中🙂尾",7)).toBe("中🙂");
    const value = snapshot(); value.context.mainQuest = { title: clipContextText("🙂".repeat(200),512),titleTruncated:true,source:"bound" };
    expect(utf8Bytes(value.context.mainQuest.title)).toBe(512); expect(serializeAssessmentContext(value)).not.toContain(value.activityId);
    expect(utf8Bytes(serializeAssessmentContext(value))).toBeGreaterThan(JSON.stringify(value.context).length);
  });
  test("budget reduces optional recent samples before skills and retains frozen version/state", () => {
    const value = snapshot(); value.context.relatedSkills=[{name:"R",masteryLevel:3,masteryConfidence:0.7}];
    value.context.recentSamples=Array.from({length:5},()=>({skillName:"R",activityType:'"\\'.repeat(1500),createdAt:value.context.asOf}));
    const result=fitAssessmentContextBudget(value);
    expect(result.context.coverage.budgetReduced).toBe(true); expect(result.context.coverage.recentSamplesTruncated).toBe(true);
    expect(result.context.relatedSkills).toEqual(value.context.relatedSkills); expect(result.context.rulesVersion).toBe(value.context.rulesVersion);
    expect(result.context.temporaryState).toEqual(value.context.temporaryState); expect(utf8Bytes(serializeAssessmentContext(result))).toBeLessThanOrEqual(4096);
    expect(value.context.recentSamples).toHaveLength(5);
  });
  test("escaping-heavy names reduce trailing skills rather than shorten identities", () => {
    const value=snapshot(); value.context.rulesVersion="r".repeat(2800);
    value.context.relatedSkills=Array.from({length:5},(_, n)=>({name: '"\\'.repeat(70)+n, masteryLevel:0,masteryConfidence:0}));
    const result=fitAssessmentContextBudget(value);
    expect(result.context.relatedSkills.length).toBeLessThan(5); expect(result.context.coverage.relatedSkillsTruncated).toBe(true);
    expect(value.context.relatedSkills.slice(0,result.context.relatedSkills.length)).toEqual(result.context.relatedSkills);
    expect(utf8Bytes(serializeAssessmentContext(result))).toBeLessThanOrEqual(4096);
  });
  test("mandatory oversized rules fail instead of truncating or replacing with deployed version", () => {
    const value=snapshot(); value.context.rulesVersion="冻结".repeat(3000);
    expect(()=>fitAssessmentContextBudget(value)).toThrow(AssessmentContextError); expect(value.context.rulesVersion).toHaveLength(6000);
  });
  test.each(["__proto__", "constructor", "prototype", "user_id", "xp", "raw_history", "apiKey"])("unknown/private key %s fails closed", key => {
    const value=snapshot(); Object.defineProperty(value.context,key,{value:"PRIVATE-SENTINEL",enumerable:true});
    expect(()=>validateAssessmentContextSnapshot(value)).toThrow(AssessmentContextError);
  });
  test("missing/null/unknown version, inherited/accessor data and sparse arrays cannot masquerade as valid DTOs", () => {
    const original=snapshot(), inherited=Object.create(original), accessor=snapshot(); let calls=0;
    Object.defineProperty(accessor,"context",{get:()=>{calls++;return original.context;},enumerable:true});
    for(const value of [null,{},inherited,accessor,{...original,context:{...original.context,version:"v2"}},
      {...original,context:{...original.context,coverage:null}},{...original,context:{...original.context,relatedSkills:Array(1)}}])
      expect(()=>validateAssessmentContextSnapshot(value)).toThrow(AssessmentContextError);
    expect(calls).toBe(0);
  });
  test.each([NaN,Infinity,-Infinity,-1,101])("temporary state %s is invalid rather than defaulted", number=>{
    const value=snapshot(); value.context.temporaryState.focus=number; expect(()=>validateAssessmentContextSnapshot(value)).toThrow(AssessmentContextError);
  });
  test("recent metadata must refer to a sent skill and same inclusive30day/server-now window",()=>{
    const value=snapshot(); value.context.relatedSkills=[{name:"R",masteryLevel:3,masteryConfidence:0.7}];
    for(const sample of [{skillName:"foreign",activityType:null,createdAt:value.context.asOf},
      {skillName:"R",activityType:null,createdAt:"2026-10-10T12:00:00.001Z"},
      {skillName:"R",activityType:null,createdAt:"2026-09-10T11:59:59.999Z"}]) {
      value.context.recentSamples=[sample]; expect(()=>validateAssessmentContextSnapshot(value)).toThrow(AssessmentContextError);
    }
    value.context.recentSamples=[{skillName:"R",activityType:null,createdAt:"2026-09-10T12:00:00.000Z"}];
    expect(validateAssessmentContextSnapshot(value).context.recentSamples).toHaveLength(1);
  });
  test("prototype-named labels remain ordinary strings; no IDs/aliases/XP leak in serialization",()=>{
    const value=snapshot(); value.context.relatedSkills=[{name:"__proto__",masteryLevel:0,masteryConfidence:0}];
    const serialized=serializeAssessmentContext(value); expect(JSON.parse(serialized).relatedSkills[0].name).toBe("__proto__");
    for(const privateField of ["activityId","user_id","aliases","xp","description"]) expect(Object.keys(JSON.parse(serialized))).not.toContain(privateField);
    expect(()=>parseContextData(contextSkillRowSchema,{...skill("R"),status:null})).toThrow(AssessmentContextError);
  });
});
