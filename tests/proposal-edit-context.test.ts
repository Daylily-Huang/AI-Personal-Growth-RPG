import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { buildProposalEditMessages, loadProposalEditModelContext, validateProposalEditModelContext } from "@/lib/proposal-edit/context";
import { SYSTEM_CONSTITUTION } from "@/lib/ai/prompts";
const id = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const owner = id(1), activityId = id(2), base = id(3);
const facts = () => ({ description: "修正事实：写作而非统计", totalMinutes: 60, effectiveMinutes: 35, relatedSkillIds: [id(5), id(4)] });
const activity = () => ({ id: activityId, user_id: owner, raw_input: "统计 original", total_minutes: 120, effective_minutes: 90, status: "assessed", rules_version: "0.1.0" });
const assessment = () => ({ id: base, user_id: owner, activity_id: activityId, status: "pending", rules_version: "0.1.0" });
const skill = (n: number, name = "写作") => ({ id: id(n), user_id: owner, name, status: "active", mastery_level: 8, mastery_confidence: 0.8 });
function fixtures() {
  const value = activity();
  const row = { id: value.id, user_id: value.user_id, raw_input: value.raw_input, status: value.status, rules_version: value.rules_version };
  return [[assessment()], [activity()], [skill(4), skill(5)], { ...row, quest_id: null, activity_type: "learning" }, [],
    [{ ...skill(4, "统计"), aliases: [] }], { user_id: owner, energy: 50, focus: 40, momentum: 30, stress: 20 }, []];
}
function sdk(queue: unknown[], status = 200) {
  const urls: URL[] = [];
  const db = createClient("http://synthetic.invalid", "synthetic-public-only", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      expect(init?.method ?? "GET").toBe("GET"); urls.push(new URL(String(url)));
      if (!queue.length) throw Error("unexpected query");
      return new Response(JSON.stringify(queue.shift()), { status, headers: { "content-type": "application/json" } });
    } } });
  return { db, urls };
}
function context() {
  return { activityId, rulesVersion: "0.1.0", original: { description: "original", descriptionTruncated: false, totalMinutes: 120, effectiveMinutes: 90 },
    facts: { ...facts(), relatedSkillIds: [] }, skillClues: [], originalContext: {
      version: "activity-context-v1", asOf: "2026-10-11T00:00:00Z", rulesVersion: "0.1.0", mainQuest: null, relatedSkills: [], recentSamples: [],
      temporaryState: { energy: 50, focus: 40, momentum: 30, stress: 20 },
      coverage: { candidateScanTruncated: false, aliasesTruncated: false, skillNamesOmitted: false, relatedSkillsTruncated: false, recentSamplesTruncated: false, questChainIncomplete: false, budgetReduced: false },
    } };
}
describe("fact-edit minimal server model context", () => {
  it("real SDK queries bind two raw owners, original v1 and ordered corrected clues separately", async () => {
    const { db, urls } = sdk(fixtures());
    const result = await loadProposalEditModelContext(db, owner, base, activityId, facts());
    expect(result.facts).toEqual(facts()); expect(result.original).toEqual({ description: "统计 original", descriptionTruncated: false, totalMinutes: 120, effectiveMinutes: 90 });
    expect(result.skillClues.map(s => s.id)).toEqual([id(5), id(4)]);
    expect(result.originalContext.relatedSkills.map(s => s.name)).toEqual(["统计"]);
    expect(urls).toHaveLength(8); for (const url of urls) expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
    expect(urls[2].searchParams.get("limit")).toBe("3"); expect(urls[5].searchParams.get("limit")).toBe("201"); expect(urls[7].searchParams.get("limit")).toBe("6");
    expect(urls.map(url => url.searchParams.get("select")).join(" ")).not.toMatch(/assessment_json|model_metadata|\*/);
    expect(JSON.stringify(result)).not.toMatch(/user_id|synthetic-public-only/);
  });
  it("zero clues skip the clue query but retain original-v1 selection", async () => {
    const queue = fixtures(); queue.splice(2, 1); const { db, urls } = sdk(queue);
    const result = await loadProposalEditModelContext(db, owner, base, activityId, { ...facts(), relatedSkillIds: [] });
    expect(result.skillClues).toEqual([]); expect(result.originalContext.relatedSkills[0].name).toBe("统计"); expect(urls).toHaveLength(7);
  });
  it.each([
    [0, [{ ...assessment(), user_id: id(99) }]], [0, [{ ...assessment(), activity_id: id(99) }]],
    [0, [{ ...assessment(), status: "superseded" }]], [0, []], [0, null],
    [1, [{ ...activity(), user_id: id(99) }]], [1, [{ ...activity(), status: "confirmed" }]], [1, [{ ...activity(), rules_version: "changed" }]],
    [2, [skill(4)]], [2, [skill(4), skill(4)]], [2, [skill(4), { ...skill(5), user_id: id(99) }]],
    [2, [skill(4), { ...skill(5), status: "archived" }]], [2, [skill(4), { ...skill(5), status: null }]], [2, [skill(4), skill(99)]],
  ])("raw malformed/foreign/changed query %s fails closed", async (index, replacement) => {
    const queue: unknown[] = fixtures(); queue[index as number] = replacement; const { db } = sdk(queue);
    await expect(loadProposalEditModelContext(db, owner, base, activityId, facts())).rejects.toBeInstanceOf(Error);
  });
  it("old v1 fetched original facts must match the separate original read", async () => {
    const queue: unknown[] = fixtures(); queue[3] = { ...(queue[3] as object), raw_input: "changed original" }; const { db } = sdk(queue);
    await expect(loadProposalEditModelContext(db, owner, base, activityId, facts())).rejects.toMatchObject({ code: "INVALID_PROPOSAL_EDIT_RECEIPT" });
  });
  it.each([401, 404, 429, 503])("infrastructure %s never means empty context", async status => {
    const { db, urls } = sdk([{ message: "private database details" }], status);
    await expect(loadProposalEditModelContext(db, owner, base, activityId, facts())).rejects.toMatchObject({ message: "PROPOSAL_EDIT_UNAVAILABLE" }); expect(urls).toHaveLength(1);
  });
  it("complete prompt preserves old output/boundaries, original vs corrected provenance and has no authority IDs", () => {
    const result = buildProposalEditMessages(context()); expect(result[0]).toEqual({ role: "system", content: SYSTEM_CONSTITUTION });
    expect(result[1].content).toContain("activity-evaluator-v0.4-facts"); expect(result[1].content).toContain(JSON.stringify(context().facts));
    expect(result[1].content).toContain("original-context"); expect(result[1].content).toContain("不是独立核实"); expect(result[1].content).toContain("Artifact 认定/奖励延期");
    expect(result[1].content).not.toContain(activityId); expect(result[1].content).not.toContain(owner);
  });
  it("original8192 + corrected8192 worst escape and five200-codepoint clues fit complete serialized messages", () => {
    const value = context(); value.original.description = "\u0001".repeat(8192); value.facts.description = "\u0001".repeat(8192);
    const full = { ...value, facts: { ...value.facts, relatedSkillIds: [1, 2, 3, 4, 5].map(id) },
      skillClues: [1, 2, 3, 4, 5].map(n => ({ id: id(n), name: "\u0001".repeat(200), nameTruncated: true, masteryLevel: 8, masteryConfidence: 0.8 })) };
    expect(new TextEncoder().encode(JSON.stringify(buildProposalEditMessages(full))).byteLength).toBeLessThanOrEqual(131072);
  });
  it.each([
    (v: ReturnType<typeof context>) => ({ ...v, original: { ...v.original, description: "x".repeat(8193) } }),
    (v: ReturnType<typeof context>) => ({ ...v, rulesVersion: "changed" }),
    (v: ReturnType<typeof context>) => ({ ...v, extraPrivate: "must not send" }),
    (v: ReturnType<typeof context>) => ({ ...v, facts: { ...v.facts, relatedSkillIds: [id(5)] } }),
    (v: ReturnType<typeof context>) => ({ ...v, originalContext: { ...v.originalContext, extra: true } }),
  ])("invalid injected context cannot reach a prompt", mutate => {
    expect(() => buildProposalEditMessages(mutate(context()))).toThrow("PROPOSAL_EDIT_UNAVAILABLE");
  });
  it("getter/prototype forged context is rejected without invoking a getter", () => {
    let calls = 0; const forged = { ...context(), get facts() { calls++; throw Error("private getter"); } };
    expect(() => validateProposalEditModelContext(forged)).toThrow("PROPOSAL_EDIT_UNAVAILABLE"); expect(calls).toBe(0);
    expect(() => validateProposalEditModelContext(Object.create(context()))).toThrow("PROPOSAL_EDIT_UNAVAILABLE");
  });
});
