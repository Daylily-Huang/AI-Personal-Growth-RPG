import { describe, expect, it } from "vitest";
import { evidenceText, evidenceUuid, parseEvidenceInput, parseEvidenceList, parseEvidenceQuery, parseEvidenceResult } from "@/lib/evidence-submission/validation";
import { SKILL_RESPONSE_BYTES, SUBMISSION_RESPONSE_BYTES } from "@/lib/evidence-submission/types";

const id = (n: number) => `10000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const owner = id(1), activity = id(2), requestId = id(3), skillId = id(4);
const input = { requestId, skillId, description: "作品链接 https://example.invalid/a\n<script>原文</script>" };
function item(n = 3, description = input.description) {
  return { requestId: id(n), activityId: activity, requestedSkillId: skillId,
    evidence: { userId: owner, id: id(n + 100), activityId: activity, skillId, evidenceLevel: 0,
      evidenceType: "user_submission", description, verified: false, createdAt: "2026-10-11T02:00:00.123456+00:00" } };
}
function receipt() { return { userId: owner, replayed: false, submission: item() }; }

describe("manual evidence exact input and Unicode boundaries", () => {
  it("canonicalizes UUID/outer trim only, retaining literal link and markup", () => {
    expect(parseEvidenceInput({ ...input, requestId: requestId.toUpperCase(), description: `\u000b\ufeff${input.description}　` })).toEqual(input);
    expect(parseEvidenceInput({ ...input, skillId: null }).skillId).toBeNull();
  });
  it.each([null, [], {}, { ...input, extra: true }, { requestId, description: "a" },
    { ...input, requestId: null }, { ...input, skillId: undefined }, { ...input, description: 42 },
    JSON.parse('{"requestId":"' + requestId + '","skillId":null,"description":"a","__proto__":{}}'),
    Object.assign(Object.create({ inherited: true }), input),
  ])("rejects malformed exact input %j", value => expect(() => parseEvidenceInput(value)).toThrow());
  it("rejects accessor/symbol fields without invoking getters", () => {
    let calls = 0;
    const getter = { ...input };
    Object.defineProperty(getter, "description", { get() { calls++; return "a"; } });
    expect(() => parseEvidenceInput(getter)).toThrow(); expect(calls).toBe(0);
    expect(() => parseEvidenceInput({ ...input, [Symbol("authority")]: true })).toThrow();
  });
  it.each(["", " \t\u000b\ufeff　", "a\0b", "\ud800", "\udc00", "a\ud800b", "a".repeat(8193), "界".repeat(2731)])("rejects invalid/oversize text", text => {
    expect(() => evidenceText(text)).toThrow();
  });
  it("accepts exact 8192 UTF8 bytes and paired emoji", () => {
    expect(evidenceText("😀".repeat(2048))).toHaveLength(4096);
    expect(evidenceText("界".repeat(2730) + "ab")).toHaveLength(2732);
  });
  it("matches all 25 JS trim codepoints while preserving every lowercase letter", () => {
    const whitespace = [9, 10, 11, 12, 13, 32, 160, 5760, ...Array.from({ length: 11 }, (_, i) => 8192 + i), 8232, 8233, 8239, 8287, 12288, 65279];
    expect(whitespace).toHaveLength(25);
    for (const cp of whitespace) expect(evidenceText(String.fromCodePoint(cp) + "valid" + String.fromCodePoint(cp))).toBe("valid");
    for (const letter of "abcdefghijklmnopqrstuvwxyz") expect(evidenceText(letter)).toBe(letter);
  });
  it.each(["bad", "", "10000000000000000000000000000003", "../" + requestId, requestId + " "]) ("rejects malformed UUID %s", value => expect(() => evidenceUuid(value)).toThrow());
  it.each(["view=all", "view=skills&view=skills", "after=", "actor=x", "view=skills&after=" + skillId + "&after=" + skillId])("rejects unbounded/duplicate query %s", value => expect(() => parseEvidenceQuery(new URLSearchParams(value))).toThrow());
  it("parses exact bounded cursors and default view", () => {
    expect(parseEvidenceQuery(new URLSearchParams())).toEqual({ view: "submissions", after: null });
    expect(parseEvidenceQuery(new URLSearchParams({ view: "skills", after: skillId }))).toEqual({ view: "skills", after: skillId });
  });
});

describe("fail-closed raw receipts and public projections", () => {
  it("validates raw owner and strips all private IDs", () => {
    const publicResult = parseEvidenceResult(receipt(), activity, input, owner);
    expect(publicResult.replayed).toBe(false);
    expect(JSON.stringify(publicResult)).not.toContain(owner);
    expect(parseEvidenceResult(publicResult, activity, input)).toEqual(publicResult);
  });
  it.each(["missing", null, "false", 0, true])("rejects non-false verified %s", value => {
    const raw = receipt();
    if (value === "missing") delete (raw.submission.evidence as Partial<typeof raw.submission.evidence>).verified;
    else Object.assign(raw.submission.evidence, { verified: value });
    expect(() => parseEvidenceResult(raw, activity, input, owner)).toThrow();
  });
  it.each([undefined, null, "false", 0])("rejects coerced/missing replay %s", value => {
    expect(() => parseEvidenceResult({ ...receipt(), replayed: value }, activity, input, owner)).toThrow();
  });
  it.each(["userId", "id", "activityId", "skillId", "evidenceLevel", "evidenceType", "description", "createdAt"])("rejects missing evidence field %s", key => {
    const raw = receipt(); Reflect.deleteProperty(raw.submission.evidence, key);
    expect(() => parseEvidenceResult(raw, activity, input, owner)).toThrow();
  });
  it.each(["2026-02-31T00:00:00Z", "2026-10-11", "2026-10-11T00:00:00", "2026-10-11T24:00:00Z", "2026-10-11T00:00:00+24:00", " 2026-10-11T00:00:00Z", "2026-10-11T00:00:00.123456789000000000Z"])("rejects malformed/loose timestamp %s", createdAt => {
    const raw = receipt(); raw.submission.evidence.createdAt = createdAt;
    expect(() => parseEvidenceResult(raw, activity, input, owner)).toThrow();
  });
  it("rejects changed owner/activity/tuple/grade/type and extra metadata", () => {
    for (const patch of [{ userId: id(900) }, { activityId: id(900) }, { skillId: id(900) },
      { evidenceLevel: 1 }, { evidenceType: "settled" }, { description: input.description + " " }, { metadata: {} }]) {
      const raw = receipt(); Object.assign(raw.submission.evidence, patch);
      expect(() => parseEvidenceResult(raw, activity, input, owner)).toThrow();
    }
    expect(() => parseEvidenceResult(receipt(), activity, { ...input, description: "changed" }, owner)).toThrow();
    expect(() => parseEvidenceResult({ ...receipt(), userId: id(900) }, activity, input, owner)).toThrow();
  });
  it("represents a deleted skill as current null while preserving original tuple", () => {
    const raw = receipt(); Object.assign(raw.submission.evidence, { skillId: null });
    expect(parseEvidenceResult(raw, activity, input, owner).submission.requestedSkillId).toBe(skillId);
    expect(parseEvidenceResult(raw, activity, input, owner).submission.evidence.skillId).toBeNull();
  });
  it("reads complete maximum escaped descriptions in 25-item page within the admitted budget", () => {
    for (const description of ["\u0001".repeat(8192), '"'.repeat(8192), "\\".repeat(8192), "界".repeat(2730), "😀".repeat(2048), "\u2028x\u2028".repeat(1024)]) {
      const raw = { userId: owner, activityId: activity, view: "submissions", items: Array.from({ length: 25 }, (_, i) => item(i + 3, description)), nextCursor: id(27) };
      // Outer whitespace is not a stored value; U+2028 fixture has non-whitespace ends.
      raw.items = raw.items.map(row => ({ ...row, evidence: { ...row.evidence, description: row.evidence.description.trim() } }));
      const result = parseEvidenceList(raw, activity, { view: "submissions", after: null }, owner);
      expect(result.items).toHaveLength(25); expect(result.nextCursor).toBe(id(27));
      expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThanOrEqual(SUBMISSION_RESPONSE_BYTES);
      expect(result.items[0]).toMatchObject({ evidence: { description: description.trim() } });
    }
  });
  it("accepts 50 bounded labels including worst escaping and truncation notices", () => {
    const raw = { userId: owner, activityId: activity, view: "skills", items: Array.from({ length: 50 }, (_, i) => ({ userId: owner, id: id(i + 5), name: "\u0001".repeat(200), status: "active", nameTruncated: true })), nextCursor: id(54) };
    const result = parseEvidenceList(raw, activity, { view: "skills", after: skillId }, owner);
    expect(result.items).toHaveLength(50);
    expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThan(SKILL_RESPONSE_BYTES);
    for (const bad of [undefined, null, "archived"]) {
      raw.items[0].status = bad as string;
      expect(() => parseEvidenceList(raw, activity, { view: "skills", after: skillId }, owner)).toThrow();
    }
  });
  it("rejects duplicate/reversed/unbounded pages, wrong cursor and wrong view", () => {
    const raw = { userId: owner, activityId: activity, view: "submissions", items: [item(3), item(4)], nextCursor: null };
    for (const items of [[item(3), item(3)], [item(4), item(3)], Array.from({ length: 26 }, (_, i) => item(i + 3))]) {
      expect(() => parseEvidenceList({ ...raw, items }, activity, { view: "submissions", after: null }, owner)).toThrow();
    }
    expect(() => parseEvidenceList(raw, activity, { view: "submissions", after: requestId }, owner)).toThrow();
    expect(() => parseEvidenceList({ ...raw, nextCursor: id(4) }, activity, { view: "submissions", after: null }, owner)).toThrow();
    expect(() => parseEvidenceList(raw, activity, { view: "skills", after: null }, owner)).toThrow();
    const duplicateEvidence = [item(3), item(4)]; duplicateEvidence[1].evidence.id = duplicateEvidence[0].evidence.id;
    expect(() => parseEvidenceList({ ...raw, items: duplicateEvidence }, activity, { view: "submissions", after: null }, owner)).toThrow();
  });
});
