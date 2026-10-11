import { describe, expect, it } from "vitest";
import { parseProposalEditInput, parseProposalEditQuery, parseProposalFactHistoryQuery,
  parseProposalFacts, proposalFactDescription, proposalFactUuid, parseProposalEditRequest,
  parseProposalEditProposal, parseProposalEditModelResult } from "@/lib/proposal-edit/validation";
import { ProposalEditError, PROPOSAL_FACT_PROMPT_VERSION } from "@/lib/proposal-edit/types";

const id = (number: number) => `abcdef00-0000-0000-0000-${number.toString(16).padStart(12, "0")}`;
const facts = () => ({ description: "完成回归分析；这里只记录事实，不指定分数。", totalMinutes: 60,
  effectiveMinutes: 40, relatedSkillIds: [id(2), id(3)] });
const input = () => ({ requestId: id(1), facts: facts() });

describe("fact edits have exact user-fact fields, never score/owner authority", () => {
  it("normalizes UUIDs and outer whitespace without modifying the caller's object", () => {
    const value = input(); value.requestId = id(1).toUpperCase();
    value.facts.description = `\u000b\ufeff${value.facts.description}　`;
    value.facts.relatedSkillIds[0] = id(2).toUpperCase();
    expect(parseProposalEditInput(value)).toEqual(input());
    expect(value.requestId).toBe(id(1).toUpperCase());
    expect(value.facts.description.startsWith("\u000b")).toBe(true);
  });
  it.each([null, [], {}, { ...input(), extra: true }, { requestId: id(1) },
    { ...input(), requestId: null }, { ...input(), facts: null },
    { ...input(), facts: { ...facts(), xp: 500 } }, { ...input(), userId: id(9) },
    JSON.parse('{"requestId":"' + id(1) + '","facts":{},"__proto__":{}}'),
    Object.assign(Object.create({ owner: id(9) }), input()),
  ])("rejects malformed or authority-bearing input %j", value => {
    expect(() => parseProposalEditInput(value)).toThrow(ProposalEditError);
  });
  it.each(["description", "totalMinutes", "effectiveMinutes", "relatedSkillIds"])("requires explicit %s", key => {
    const value = facts(); Reflect.deleteProperty(value, key);
    expect(() => parseProposalFacts(value)).toThrow(ProposalEditError);
  });
  it("accepts null-prototype plain data, not inherited or symbol authority", () => {
    expect(parseProposalFacts(Object.assign(Object.create(null), facts()))).toEqual(facts());
    expect(() => parseProposalFacts({ ...facts(), [Symbol("xp")]: 1 })).toThrow();
    expect(() => parseProposalFacts(Object.assign(Object.create({ extra: true }), facts()))).toThrow();
  });
  it("never invokes top-level, fact or skill-array getters", () => {
    let calls = 0;
    const outer = input(), inner = facts(), skills = [id(2)];
    Object.defineProperty(outer, "facts", { get() { calls++; return facts(); } });
    Object.defineProperty(inner, "description", { get() { calls++; return "secret"; } });
    Object.defineProperty(skills, "0", { get() { calls++; return id(2); } });
    for (const value of [outer, { ...input(), facts: inner }, { ...input(), facts: { ...facts(), relatedSkillIds: skills } }])
      expect(() => parseProposalEditInput(value)).toThrow();
    expect(calls).toBe(0);
  });
});

describe("duration and stable-ID clues remain bounded non-authoritative facts", () => {
  it.each([undefined, "40", false, NaN, Infinity, -1, 0.5, 1441])("rejects invalid minutes %s", value => {
    expect(() => parseProposalFacts({ ...facts(), totalMinutes: value })).toThrow();
    expect(() => parseProposalFacts({ ...facts(), effectiveMinutes: value })).toThrow();
  });
  it("preserves unknown separately from zero, and does not apply a time-to-XP formula", () => {
    expect(parseProposalFacts({ ...facts(), totalMinutes: null, effectiveMinutes: null })).toMatchObject({ totalMinutes: null, effectiveMinutes: null });
    expect(parseProposalFacts({ ...facts(), totalMinutes: 0, effectiveMinutes: -0 })).toMatchObject({ totalMinutes: 0, effectiveMinutes: 0 });
    expect(parseProposalFacts({ ...facts(), totalMinutes: 1440, effectiveMinutes: 1440 })).toMatchObject({ totalMinutes: 1440, effectiveMinutes: 1440 });
    expect(parseProposalFacts({ ...facts(), totalMinutes: null, effectiveMinutes: 40 }).effectiveMinutes).toBe(40);
    expect(() => parseProposalFacts({ ...facts(), totalMinutes: 30, effectiveMinutes: 40 })).toThrow();
  });
  it.each([null, {}, [null], [id(2), id(2).toUpperCase()], Array.from({ length: 6 }, (_, n) => id(n + 2)), new Array(1)])("rejects malformed/duplicate/unbounded clues %j", relatedSkillIds => {
    expect(() => parseProposalFacts({ ...facts(), relatedSkillIds })).toThrow();
  });
  it("preserves ordered zero-to-five UUID clues and copies the array", () => {
    expect(parseProposalFacts({ ...facts(), relatedSkillIds: [] }).relatedSkillIds).toEqual([]);
    const value = { ...facts(), relatedSkillIds: Array.from({ length: 5 }, (_, n) => id(n + 2)) };
    const parsed = parseProposalFacts(value);
    expect(parsed.relatedSkillIds).toEqual(value.relatedSkillIds); expect(parsed.relatedSkillIds).not.toBe(value.relatedSkillIds);
  });
  it("rejects non-JSON extra properties and inherited sparse items", () => {
    const extra = Object.assign([id(2)], { authority: true });
    const sparse = new Array(1); Object.setPrototypeOf(sparse, { 0: id(2) });
    const inherited = [id(2)]; Object.setPrototypeOf(inherited, { authority: true });
    class Clues extends Array<string> {}
    expect(() => parseProposalFacts({ ...facts(), relatedSkillIds: extra })).toThrow();
    expect(() => parseProposalFacts({ ...facts(), relatedSkillIds: sparse })).toThrow();
    expect(() => parseProposalFacts({ ...facts(), relatedSkillIds: inherited })).toThrow();
    expect(() => parseProposalFacts({ ...facts(), relatedSkillIds: new Clues(id(2)) })).toThrow();
  });
});

describe("Unicode and UTF8 budgets do not corrupt retained fact text", () => {
  it.each(["", " \t\u000b\ufeff　", "a\0b", "\ud800", "\udc00", "a\ud800b", "x".repeat(8193), "界".repeat(2731)])("rejects invalid text", value => {
    expect(() => proposalFactDescription(value)).toThrow();
  });
  it("accepts the exact byte boundary and literal markup without executing or stripping it", () => {
    expect(proposalFactDescription("😀".repeat(2048))).toHaveLength(4096);
    expect(proposalFactDescription("界".repeat(2730) + "ab")).toHaveLength(2732);
    const literal = '<script>user_claim</script> https://example.invalid/a\n第二行';
    expect(proposalFactDescription(literal)).toBe(literal);
  });
  it("matches the frozen 25 JS-trim whitespace codepoints and preserves all lowercase letters", () => {
    const whitespace = [9, 10, 11, 12, 13, 32, 160, 5760, ...Array.from({ length: 11 }, (_, n) => 8192 + n), 8232, 8233, 8239, 8287, 12288, 65279];
    expect(whitespace).toHaveLength(25);
    for (const cp of whitespace) expect(proposalFactDescription(String.fromCodePoint(cp) + "valid" + String.fromCodePoint(cp))).toBe("valid");
    for (const letter of "abcdefghijklmnopqrstuvwxyz") expect(proposalFactDescription(letter)).toBe(letter);
  });
  it.each(["", "bad", id(1) + " ", "../" + id(1), id(1).replaceAll("-", "")])("rejects malformed UUID %s", value => {
    expect(() => proposalFactUuid(value)).toThrow();
  });
});

function validProposal() { return {
  activity: { type: "learning", completion: 0 }, difficulty: { complexity: 0, uncertainty: 0, expertise_gap: 0, resistance: 0 },
  growth: { effort: 0, learning: 0, performance: 0, outcome: 0, artifact_value: 0, character_evidence: 0 },
  evidence: { level: 0, explanation: "用户自述" }, affected_skills: [], knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
  mastery_changes: [], xp_semantics: { base_value: 1, difficulty: 0, mastery_gain: 0, novelty: 0, goal_alignment: 0, repetition_risk: "low" },
  next_quest: null, confidence: 0.5, uncertainty_notes: [], artifacts: [],
}; }
function requestRow() { return { userId: id(10), requestId: id(1), activityId: id(11), baseAssessmentId: id(12), facts: facts(),
  status: "in_progress", failure: null, completion: null, createdAt: "2026-10-11T00:00:00Z", expiresAt: "2026-10-11T00:03:00Z" }; }
function completeRow() { return { ...requestRow(), status: "completed", completion: {
  revisionId: id(13), previousRevisionId: null, createdAt: "2026-10-11T00:00:30Z", assessment: {
    userId: id(10), id: id(14), activityId: id(11), status: "pending", proposal: validProposal(), modelName: "synthetic-only",
    promptVersion: PROPOSAL_FACT_PROMPT_VERSION, rulesVersion: "0.1.0", confidence: 0.5, createdAt: "2026-10-11T00:00:30Z", confirmedAt: null,
  },
} }; }
const readRow = (value: unknown) => parseProposalEditRequest(value, id(10), id(12), id(1), input());

describe("new model adapter has actual pure-JSON and UTF8 bounds beyond old schema", () => {
  it("valid proposal is copied; original schema/coefficient semantics are preserved", () => {
    const value = validProposal(), result = parseProposalEditProposal(value);
    expect(result).toEqual(value); expect(result).not.toBe(value);
  });
  it.each([NaN, Infinity, -Infinity, undefined, () => 1, BigInt(1), new Date(), new Map(), /private/])("non-JSON metadata %s is rejected before schema", invalid => {
    const value = { ...validProposal(), artifactProposals: [{ title: "artifact", artifactType: "other", metadata: { nested: invalid } }] };
    expect(() => parseProposalEditProposal(value)).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("never invokes nested getter or toJSON, including unknown schema keys", () => {
    let calls = 0;
    const getter = Object.defineProperty({}, "private", { enumerable: true, get() { calls++; return "private"; } });
    const toJSON = { toJSON() { calls++; return "private"; } };
    for (const unknown of [getter, toJSON]) expect(() => parseProposalEditProposal({ ...validProposal(), ignored: unknown })).toThrow();
    expect(calls).toBe(0);
  });
  it("rejects cycles, sparse arrays, inherited data, nonenumerable or symbol-bearing metadata", () => {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const hidden = Object.defineProperty({}, "value", { value: "private" });
    for (const ignored of [cycle, new Array(1), Object.create({ value: 1 }), hidden, { [Symbol("hidden")]: 1 }])
      expect(() => parseProposalEditProposal({ ...validProposal(), ignored })).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it.each(["\ud800", "\udfff", "before\0after"])("rejects malformed JSON strings %j even in discarded keys", value => {
    expect(() => parseProposalEditProposal({ ...validProposal(), ignored: value })).toThrow();
    expect(() => parseProposalEditProposal({ ...validProposal(), [value]: true })).toThrow();
  });
  it("ASCII controls are measured after escaping; 65536 compact UTF8 bytes is accepted, 65537 rejected", () => {
    const original = validProposal(), blank = { ...original, uncertainty_notes: [""] };
    const overhead = new TextEncoder().encode(JSON.stringify(blank)).byteLength;
    const valid = { ...original, uncertainty_notes: ["a".repeat(65536 - overhead)] };
    expect(new TextEncoder().encode(JSON.stringify(parseProposalEditProposal(valid))).byteLength).toBe(65536);
    expect(() => parseProposalEditProposal({ ...original, uncertainty_notes: ["a".repeat(65537 - overhead)] })).toThrow();
    expect(() => parseProposalEditProposal({ ...original, uncertainty_notes: ["\u0001".repeat(12000)] })).toThrow();
    expect(() => parseProposalEditProposal({ ...original, uncertainty_notes: ["你".repeat(22000)] })).toThrow();
  });
  it("model provenance is fixed, nonblank and bounded independently of proposal size", () => {
    const valid = { proposal: validProposal(), modelName: "m".repeat(256), promptVersion: PROPOSAL_FACT_PROMPT_VERSION };
    expect(parseProposalEditModelResult(valid).modelName).toHaveLength(256);
    for (const patch of [{ modelName: " " }, { modelName: "m".repeat(257) }, { modelName: "你".repeat(86) },
      { promptVersion: "activity-evaluator-v0.3-context" }, { modelName: null }, { extra: true }])
      expect(() => parseProposalEditModelResult({ ...valid, ...patch })).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("valid nested metadata including prototype-named keys and Unicode is retained", () => {
    const metadata = JSON.parse('{"__proto__":{"constructor":"中文"},"toString":[1,true,null]}');
    const value = { ...validProposal(), artifactProposals: [{ title: "artifact", artifactType: "other", metadata }] };
    const parsed = parseProposalEditProposal(value).artifactProposals?.[0].metadata;
    expect(parsed).toEqual(metadata); expect(parsed).not.toBe(metadata);
  });
});

describe("raw persisted request receipts fail closed before any public owner projection", () => {
  it.each(["failed", "expired", "conflict"])("accepts exact safe terminal %s, never assumes success", status => {
    const failure = status === "failed" ? "AI_UNAVAILABLE" : status === "expired" ? "EXPIRED" : "CONFLICT";
    expect(readRow({ ...requestRow(), status, failure }).status).toBe(status);
  });
  it.each([null, undefined, "constructor", "toString", "__proto__", "true", false])("raw status %s is never defaulted", status => {
    expect(() => readRow({ ...requestRow(), status })).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it.each(["userId", "requestId", "activityId", "baseAssessmentId", "facts", "status", "createdAt", "expiresAt", "failure", "completion"])("requires raw field %s", key => {
    const value = requestRow(); Reflect.deleteProperty(value, key);
    expect(() => readRow(value)).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("strict canonical persisted facts are checked, not silently trimmed or normalized", () => {
    for (const patch of [{ description: " " + facts().description }, { relatedSkillIds: [id(2).toUpperCase(), id(3)] },
      { totalMinutes: 59 }, { relatedSkillIds: [id(3), id(2)] }])
      expect(() => readRow({ ...requestRow(), facts: { ...facts(), ...patch } })).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it.each(["2026-02-30T00:00:00Z", "2026-10-11", "2026-10-11T00:00:00", "2026-10-11T25:00:00Z", "2026-10-11T00:00:00+24:00"])("invalid/unzoned timestamp %s rejected", createdAt => {
    expect(() => readRow({ ...requestRow(), createdAt })).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("expiry is exactly 180s, completion strictly earlier, including SQL microseconds", () => {
    expect(() => readRow({ ...requestRow(), expiresAt: "2026-10-11T00:03:00.000001Z" })).toThrow();
    const value = completeRow(); value.completion.createdAt = value.completion.assessment.createdAt = "2026-10-11T00:02:59.999999Z";
    expect(readRow(value).status).toBe("completed");
    value.completion.createdAt = value.completion.assessment.createdAt = "2026-10-11T00:03:00Z";
    expect(() => readRow(value)).toThrow();
    const micro = requestRow(); micro.createdAt = "2026-10-11T00:00:00.123456Z"; micro.expiresAt = "2026-10-11T00:03:00.123456+00:00";
    expect(readRow(micro).status).toBe("in_progress");
    micro.expiresAt = "2026-10-11T00:03:00.123457Z"; expect(() => readRow(micro)).toThrow();
  });
  it("completed status needs an actual distinct result and non-self revision chain", () => {
    const value = completeRow();
    value.completion.previousRevisionId = value.completion.revisionId as never;
    expect(() => readRow(value)).toThrow();
    value.completion.previousRevisionId = null; value.completion.assessment.id = id(12);
    expect(() => readRow(value)).toThrow();
  });
  it("does not execute raw accessors or inherit receipt fields", () => {
    let calls = 0; const value = requestRow();
    Object.defineProperty(value, "status", { get() { calls++; return "in_progress"; } });
    expect(() => readRow(value)).toThrow(); expect(calls).toBe(0);
    expect(() => readRow(Object.assign(Object.create({ userId: id(10) }), requestRow()))).toThrow();
  });
  it("completed proposal/provenance must agree with actual confidence and confirmation state", () => {
    for (const patch of [{ confidence: 0.6 }, { status: "confirmed", confirmedAt: null }, { confirmedAt: "2026-10-11T00:01:00Z" },
      { modelName: "m".repeat(257) }, { rulesVersion: "r".repeat(257) }, { promptVersion: "old" }]) {
      const value = completeRow(); Object.assign(value.completion.assessment, patch);
      expect(() => readRow(value)).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
    }
  });
});

describe("assessment edit queries never overload Activity history identity", () => {
  it("supports only exact facts, paged skills and request status queries", () => {
    expect(parseProposalEditQuery(new URLSearchParams())).toEqual({ view: "facts" });
    expect(parseProposalEditQuery(new URLSearchParams("view=skills"))).toEqual({ view: "skills", after: null });
    expect(parseProposalEditQuery(new URLSearchParams({ view: "skills", after: id(2).toUpperCase() }))).toEqual({ view: "skills", after: id(2) });
    expect(parseProposalEditQuery(new URLSearchParams({ view: "request", requestId: id(1) }))).toEqual({ view: "request", requestId: id(1) });
    expect(parseProposalFactHistoryQuery(new URLSearchParams())).toEqual({ after: null });
    expect(parseProposalFactHistoryQuery(new URLSearchParams({ after: id(2) }))).toEqual({ after: id(2) });
  });
  it.each(["view=history", "view=all", "after=" + id(2), "view=facts&requestId=" + id(1), "view=request",
    "view=request&requestId=", "view=skills&after=", "view=skills&view=skills", "actor=x", "view=request&requestId=" + id(1) + "&after=" + id(2)])("rejects ambiguous/unknown edit query %s", query => {
    expect(() => parseProposalEditQuery(new URLSearchParams(query))).toThrow();
  });
  it.each(["view=history", "after=", "actor=x", "after=" + id(2) + "&after=" + id(2)])("history has only a unique bounded cursor %s", query => {
    expect(() => parseProposalFactHistoryQuery(new URLSearchParams(query))).toThrow();
  });
});
