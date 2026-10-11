import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ProposalEditRepository, loadProposalFactRevision, hasProposalFactEdit } from "@/lib/proposal-edit/repository";
import { PROPOSAL_FACT_PROMPT_VERSION } from "@/lib/proposal-edit/types";
import { parseProposalFactRevision, parseProposalEditProposal } from "@/lib/proposal-edit/validation";
import { SettlementService } from "@/lib/store/settlement.service";
import { calculateXp } from "@/lib/growth-engine/xp";
import { calculateQuestProgressDelta } from "@/lib/growth-engine/quest-progression";
import type { Repository } from "@/lib/store/repository";
import type { Activity, Assessment, SettlementToApply } from "@/lib/store/types";

const id = (n: number) => `10000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const owner = id(1), activity = id(2), base = id(3), requestId = id(4);
const facts = { description: "完成统计分析，尚未通过独立验证。", totalMinutes: 60, effectiveMinutes: 35, relatedSkillIds: [id(5)] };
const input = { requestId, facts };
function proposal() { return {
  activity: { type: "learning", completion: 0.8 }, difficulty: { complexity: 0.5, uncertainty: 0.2, expertise_gap: 0.3, resistance: 0.1 },
  growth: { effort: 0.6, learning: 0.7, performance: 0.4, outcome: 0.5, artifact_value: 0, character_evidence: 0 },
  evidence: { level: 0, explanation: "用户自述，不是独立验证" }, affected_skills: [{ name: "统计", reason: "线索" }],
  knowledge_updates: { proposed_nodes: [], proposed_edges: [] }, mastery_changes: [],
  xp_semantics: { base_value: 50, difficulty: 0.5, mastery_gain: 0.2, novelty: 0.4, goal_alignment: 0.7, repetition_risk: "low" },
  next_quest: null, confidence: 0.7, uncertainty_notes: [], artifacts: [],
}; }
function raw() { return { userId: owner, requestId, activityId: activity, baseAssessmentId: base, facts,
  status: "in_progress", createdAt: "2026-10-11T00:00:00Z", expiresAt: "2026-10-11T00:03:00Z", failure: null, completion: null }; }
function completed(status = "pending") { return { ...raw(), status: "completed", completion: {
  revisionId: id(6), previousRevisionId: null, createdAt: "2026-10-11T00:00:30Z",
  assessment: { userId: owner, id: id(7), activityId: activity, status, proposal: proposal(), modelName: "synthetic-review-model",
    promptVersion: PROPOSAL_FACT_PROMPT_VERSION, rulesVersion: "0.1.0", confidence: 0.7,
    createdAt: "2026-10-11T00:00:30Z", confirmedAt: status === "confirmed" ? "2026-10-11T00:01:00Z" : null },
} }; }

function revisionRows(n = 0) {
  const receipt = completed();
  const revision = { id: id(600 + n), user_id: owner, request_id: id(700 + n), activity_id: activity,
    base_assessment_id: n ? id(800 + n - 1) : base, result_assessment_id: id(800 + n), previous_revision_id: n ? id(600 + n - 1) : null,
    rules_version: "0.1.0", prompt_version: PROPOSAL_FACT_PROMPT_VERSION, created_at: receipt.completion.createdAt };
  const request = { user_id: owner, request_id: revision.request_id, activity_id: activity, base_assessment_id: revision.base_assessment_id,
    facts: { ...facts }, status: "completed", failure: null, revision_id: revision.id, created_at: receipt.createdAt, expires_at: receipt.expiresAt };
  const model = { id: revision.result_assessment_id, user_id: owner, activity_id: activity, status: "pending", model_name: "synthetic-review-model",
    prompt_version: revision.prompt_version, rules_version: revision.rules_version, created_at: revision.created_at };
  return { revision, request, model };
}
const assessmentRow = () => ({ id: base, user_id: owner, activity_id: activity, status: "pending", rules_version: "0.1.0" });
const activityRow = () => ({ id: activity, user_id: owner, raw_input: "Original immutable", total_minutes: 240, effective_minutes: 120, status: "assessed", rules_version: "0.1.0" });
const skillRow = (n = 0) => ({ id: id(1000 + n), user_id: owner, name: "统计", status: "active", mastery_level: 8, mastery_confidence: 0.8 });
function readSdk(values: unknown[], status = 200) {
  const calls: URL[] = []; const queue = [...values];
  const client = createClient("http://proposal-edit.invalid", "synthetic-public-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
      calls.push(new URL(url instanceof Request ? url.url : String(url))); expect(init?.method ?? "GET").toBe("GET");
      if (!queue.length) throw Error("Unexpected extra query");
      return new Response(JSON.stringify(queue.shift()), { status, headers: { "Content-Type": "application/json" } });
    } },
  });
  const authority = vi.fn(() => { throw Error("No admin read"); });
  return { client, calls, authority, repo: new ProposalEditRepository(client, owner, authority), remaining: () => queue.length };
}
describe("fact revision reads through the actual installed SDK, never an admin", () => {
  it("binds both raw owners/request/revision without reading assessment JSON", async () => {
    const rows = revisionRows(), { client, calls } = readSdk([[rows.revision], [rows.request]]);
    const result = await loadProposalFactRevision(client, owner, rows.revision.result_assessment_id);
    expect(result).toEqual(parseProposalFactRevision(rows.revision, rows.request, owner));
    expect(JSON.stringify(result)).not.toContain(owner); expect(calls).toHaveLength(2);
    expect(calls[0].pathname).toBe("/rest/v1/proposal_fact_revisions");
    expect(calls[0].searchParams.get("user_id")).toBe(`eq.${owner}`);
    expect(calls[0].searchParams.get("result_assessment_id")).toBe(`eq.${rows.revision.result_assessment_id}`);
    expect(calls[1].pathname).toBe("/rest/v1/proposal_fact_edit_requests");
    expect(calls[1].searchParams.get("request_id")).toBe(`eq.${rows.revision.request_id}`);
    expect(calls.every(url => !url.search.includes("assessment_json"))).toBe(true);
  });
  it("only an actual zero-row revision is absence", async () => {
    const { client, calls } = readSdk([[]]); expect(await loadProposalFactRevision(client, owner, base)).toBeNull(); expect(calls).toHaveLength(1);
  });
  it.each([null, {}, { ...revisionRows().revision, user_id: id(99) }, { ...revisionRows().revision, result_assessment_id: base },
    { ...revisionRows().revision, prompt_version: null }, { ...revisionRows().revision, previous_revision_id: id(600) },
  ])("invalid revision %# cannot silently mean no revision", async value => {
    const { client, calls } = readSdk([[value]]); await expect(loadProposalFactRevision(client, owner, id(800))).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT"); expect(calls).toHaveLength(1);
  });
  it.each([null, { ...revisionRows().request, user_id: id(99) }, { ...revisionRows().request, status: null },
    { ...revisionRows().request, status: "in_progress" }, { ...revisionRows().request, revision_id: id(99) },
    { ...revisionRows().request, expires_at: "2026-10-11T00:03:00.000001Z" },
  ])("invalid request join %# cannot reach Growth Engine", async value => {
    const { client } = readSdk([[revisionRows().revision], value === null ? [] : [value]]);
    await expect(loadProposalFactRevision(client, owner, id(800))).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it.each([404, 503, 520])("read infrastructure failure %s is not absence and has no SDK retry", async status => {
    const { client, calls } = readSdk([{ message: "private internal table detail" }], status);
    await expect(loadProposalFactRevision(client, owner, base)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE"); expect(calls).toHaveLength(1);
  });
  it("facts initialization preserves original values and never reads proposals", async () => {
    const { repo, calls, authority } = readSdk([[assessmentRow()], [activityRow()], []]);
    expect(await repo.readFacts(base)).toEqual({ assessmentId: base, activityId: activity, rulesVersion: "0.1.0", original: { description: "Original immutable", descriptionTruncated: false, totalMinutes: 240, effectiveMinutes: 120 }, currentRevision: null });
    expect(calls).toHaveLength(3); expect(calls.every(url => !url.search.includes("assessment_json"))).toBe(true); expect(authority).not.toHaveBeenCalled();
  });
  it("facts initialization returns complete corrected facts separately from original", async () => {
    const rows = revisionRows();
    const { repo } = readSdk([[{ ...assessmentRow(), id: id(800) }], [activityRow()], [rows.revision], [rows.request]]);
    const view = await repo.readFacts(id(800)); expect(view.original.effectiveMinutes).toBe(120); expect(view.currentRevision?.facts.effectiveMinutes).toBe(35);
  });
  it.each(["confirmed", "rejected", "edited", "superseded"])("nonpending %s initialization stops before Activity/AI reads", async status => {
    const { repo, calls } = readSdk([[{ ...assessmentRow(), status }]]); await expect(repo.readFacts(base)).rejects.toThrow("PROPOSAL_EDIT_CONFLICT"); expect(calls).toHaveLength(1);
  });
  it("skills use bounded 50+1 keyset queries and explicit truncation, not permanent changes", async () => {
    const values = Array.from({ length: 51 }, (_, n) => ({ ...skillRow(n), name: "𠮷".repeat(201) }));
    const { repo, calls } = readSdk([[assessmentRow()], [activityRow()], values]);
    const result = await repo.readSkills(base, null); expect(result.items).toHaveLength(50); expect(result.nextCursor).toBe(values[49].id);
    expect(result.items[0]).toMatchObject({ name: "𠮷".repeat(200), nameTruncated: true, masteryLevel: 8, masteryConfidence: 0.8 });
    expect(calls[2].searchParams.get("limit")).toBe("51"); expect(calls[2].searchParams.get("order")).toBe("id.asc"); expect(calls[2].searchParams.get("status")).toBe("eq.active");
  });
  it("skills cursor is checked in the same owner/active scope before requesting next page", async () => {
    const { repo, calls } = readSdk([[assessmentRow()], [activityRow()], [skillRow()], [skillRow(1)]]);
    const page = await repo.readSkills(base, skillRow().id); expect(page.items).toHaveLength(1); expect(page.nextCursor).toBeNull(); expect(calls[3].searchParams.get("id")).toBe(`gt.${skillRow().id}`);
  });
  it.each([{ ...skillRow(), user_id: id(99) }, { ...skillRow(), status: null }, { ...skillRow(), mastery_level: null }, { ...skillRow(), mastery_confidence: "0.8" }])("malformed Skill %# fails closed", async value => {
    const { repo } = readSdk([[assessmentRow()], [activityRow()], [value]]); await expect(repo.readSkills(base, null)).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("history paginates 25+1 complete request facts and three provenance labels, never AI JSON", async () => {
    const rows = Array.from({ length: 26 }, (_, n) => revisionRows(n));
    const { repo, calls } = readSdk([[activityRow()], rows.map(r => r.revision), rows.map(r => r.request), rows.map(r => r.model)]);
    const result = await repo.readHistory(activity, null); expect(result.items).toHaveLength(25); expect(result.nextCursor).toBe(id(624));
    expect(result.items[0]).toMatchObject({ modelName: "synthetic-review-model", assessmentStatus: "pending", rulesVersion: "0.1.0", promptVersion: PROPOSAL_FACT_PROMPT_VERSION, facts });
    expect(calls.every(url => !url.search.includes("assessment_json"))).toBe(true); expect(calls[1].searchParams.get("limit")).toBe("26"); expect(calls[2].searchParams.get("limit")).toBe("26");
    expect(calls.every(url => url.searchParams.get("user_id") === `eq.${owner}`)).toBe(true);
  });
  it("worst ASCII-control facts and labels retain 25 full entries within history budget", async () => {
    const rows = Array.from({ length: 26 }, (_, n) => revisionRows(n));
    for (const row of rows) { row.request.facts.description = "\u0001".repeat(8192); row.revision.rules_version = row.model.rules_version = "\u0001".repeat(256); row.model.model_name = "\u0001".repeat(256); }
    const { repo } = readSdk([[activityRow()], rows.map(r => r.revision), rows.map(r => r.request), rows.map(r => r.model)]);
    const view = await repo.readHistory(activity, null); expect(view.items).toHaveLength(25); expect(view.items.every(r => r.facts.description.length === 8192)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(view)).byteLength).toBeLessThanOrEqual(1572864);
  });
  it.each(["missing-request", "foreign-model", "bad-rules", "missing-model", "duplicate-revision"])("history %s fails closed", async attack => {
    const row = revisionRows(), model = { ...row.model, ...(attack === "foreign-model" ? { user_id: id(99) } : attack === "bad-rules" ? { rules_version: "tampered" } : {}) };
    const revisions = attack === "duplicate-revision" ? [row.revision, row.revision] : [row.revision];
    const { repo } = readSdk([[activityRow()], revisions, attack === "missing-request" ? [] : [row.request], attack === "missing-model" ? [] : [model]]);
    await expect(repo.readHistory(activity, null)).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("legacy preflight is read-only and short-circuits on successful revision", async () => {
    const { client, calls } = readSdk([[revisionRows().revision]]); expect(await hasProposalFactEdit(client, owner, activity)).toBe(true); expect(calls).toHaveLength(1);
  });
  it("legacy preflight distinguishes no Edit from a real effective request", async () => {
    const empty = readSdk([[], []]); expect(await hasProposalFactEdit(empty.client, owner, activity)).toBe(false);
    const effective = readSdk([[], [{ request_id: requestId, user_id: owner, activity_id: activity, status: "in_progress", expires_at: "9999-01-01T00:00:00Z" }]]);
    expect(await hasProposalFactEdit(effective.client, owner, activity)).toBe(true); expect(effective.calls[1].searchParams.get("expires_at")).toMatch(/^gt\./);
  });
});

describe("actual unchanged Growth Engine consumes only verified effective minutes", () => {
  function storage(revision: unknown | null, includePort = true) {
    const p = parseProposalEditProposal(proposal());
    const source: Activity = Object.freeze({ id: activity, questId: id(99), questSizeSnapshot: "epic", questIdSnapshot: id(99), questTitleSnapshot: "Frozen Quest", rawInput: "Original untouched", title: "Original title", activityType: null, status: "assessed", totalMinutes: 240, effectiveMinutes: 120, rulesVersion: "0.1.0", createdAt: "2026-10-11T00:00:00Z" });
    const assessment: Assessment = { id: id(800), activityId: activity, status: "pending", proposal: p, modelName: "synthetic-only", promptVersion: PROPOSAL_FACT_PROMPT_VERSION, rulesVersion: "0.1.0", confidence: 0.7, createdAt: "2026-10-11T00:00:30Z", confirmedAt: null };
    const apply = vi.fn(async (value: SettlementToApply) => ({ ok: true, transaction: value.transaction }));
    const port = { getAssessment: vi.fn(async () => assessment), getActivity: vi.fn(async () => source),
      ...(includePort ? { getProposalFactRevision: vi.fn(async () => revision) } : {}),
      lookupSkillId: vi.fn(async () => id(5)), countRecentSimilarTransactions: vi.fn(async () => 2), getQuest: vi.fn(), getSkill: vi.fn(async () => ({ masteryLevel: 8 })), applySettlement: apply };
    return { source, p, apply, port, service: new SettlementService(port as unknown as Repository) };
  }
  it.each([null, 0, 1, 9, 11, 35, 1440])("uses actual calculateXp/Quest for corrected %s minutes, retaining all other inputs", async minutes => {
    const rows = revisionRows(); rows.request.facts = { ...facts, totalMinutes: 1440, effectiveMinutes: minutes } as typeof facts;
    const revision = parseProposalFactRevision(rows.revision, rows.request, owner), { source, p, apply, port, service } = storage(revision);
    expect((await service.confirmAssessment(id(800))).ok).toBe(true); expect(apply).toHaveBeenCalledTimes(1);
    const value = apply.mock.calls[0][0];
    const xp = calculateXp({ baseValue: p.xp_semantics.base_value, difficulty: p.xp_semantics.difficulty, masteryGain: p.xp_semantics.mastery_gain, evidence: p.evidence.level, novelty: p.xp_semantics.novelty, goalAlignment: p.xp_semantics.goal_alignment, repetitionCount: 2, effectiveMinutes: minutes ?? undefined, questSize: "epic" });
    expect(value.xpDelta).toBe(xp.finalXp); expect(value.transaction.amount).toBe(xp.finalXp);
    expect(value.questProgressDelta).toBe(calculateQuestProgressDelta({ completion: p.activity.completion, effectiveMinutes: minutes }));
    expect(value).toMatchObject({ factRevisionId: revision.id, factEffectiveMinutes: minutes, transaction: { reason: source.rawInput, rulesVersion: source.rulesVersion, modifierJson: { factRevisionId: revision.id, factEffectiveMinutes: minutes, questIdSnapshot: id(99), questTitleSnapshot: "Frozen Quest" } } });
    expect(source.effectiveMinutes).toBe(120); expect(source.totalMinutes).toBe(240); expect(port.getQuest).not.toHaveBeenCalled();
  });
  it("absent Demo port and actual null revision produce the same original settlement", async () => {
    const demo = storage(null, false), plain = storage(null); await demo.service.confirmAssessment(id(800)); await plain.service.confirmAssessment(id(800));
    const normalize = (v: SettlementToApply) => ({ ...v, transaction: { ...v.transaction, id: "nonce", createdAt: "time" } });
    expect(normalize(demo.apply.mock.calls[0][0])).toEqual(normalize(plain.apply.mock.calls[0][0]));
    expect(Object.hasOwn(plain.apply.mock.calls[0][0], "factRevisionId")).toBe(false); expect(Object.hasOwn(plain.apply.mock.calls[0][0].transaction.modifierJson, "factEffectiveMinutes")).toBe(false);
  });
  it.each([undefined, {}, { ...parseProposalFactRevision(revisionRows().revision, revisionRows().request, owner), activityId: id(99) },
    { ...parseProposalFactRevision(revisionRows().revision, revisionRows().request, owner), rulesVersion: "tampered" },
    { ...parseProposalFactRevision(revisionRows().revision, revisionRows().request, owner), facts: { ...facts, effectiveMinutes: null, xp: 999 } },
  ])("malformed optional storage port %# fails before any growth write", async value => {
    const { service, apply, port } = storage(value); await expect(service.confirmAssessment(id(800))).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT"); expect(apply).not.toHaveBeenCalled(); expect(port.lookupSkillId).not.toHaveBeenCalled();
  });
});

function sdk(response: unknown, status = 200) {
  const calls: { role: string; path: string; method: string; body: unknown }[] = [];
  const client = (role: string) => createClient("http://proposal-edit.invalid", "synthetic-public-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
      calls.push({ role, path: new URL(url instanceof Request ? url.url : String(url)).pathname,
        method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      if (response instanceof Error) throw response;
      return new Response(JSON.stringify(response), { status, headers: { "Content-Type": "application/json" } });
    } },
  });
  const authority = vi.fn(() => client("service"));
  return { calls, authority, repo: new ProposalEditRepository(client("user"), owner, authority) };
}

describe("actual installed SDK fact-edit request adapter (offline, not SQL evidence)", () => {
  it("begins with one authenticated RPC and no owner/score/admin prefetch", async () => {
    const { repo, calls, authority } = sdk({ dispatch: true, request: raw() });
    const result = await repo.begin(base.toUpperCase(), { ...input, facts: { ...facts, description: `　${facts.description}\u000b` } });
    expect(result.dispatch).toBe(true); expect(JSON.stringify(result)).not.toContain(owner);
    expect(authority).not.toHaveBeenCalled();
    expect(calls).toEqual([{ role: "user", path: "/rest/v1/rpc/rpc_begin_proposal_fact_edit", method: "POST",
      body: { p_assessment_id: base, p_request_id: requestId, p_facts: facts } }]);
  });
  it.each(["pending", "confirmed", "rejected", "superseded"])("completed replay survives subsequent %s without admin or prefetch", async status => {
    const { repo, calls, authority } = sdk({ dispatch: false, request: completed(status) });
    const result = await repo.begin(base, input);
    expect(result.dispatch).toBe(false); expect(result.request.status).toBe("completed"); expect(calls).toHaveLength(1);
    expect(authority).not.toHaveBeenCalled();
  });
  it("reads an existing key without expiry mutation/AI/admin", async () => {
    const { repo, calls, authority } = sdk(raw());
    expect((await repo.readRequest(base, requestId)).status).toBe("in_progress");
    expect(calls).toEqual([{ role: "user", path: "/rest/v1/rpc/rpc_read_proposal_fact_edit", method: "POST",
      body: { p_assessment_id: base, p_request_id: requestId } }]);
    expect(authority).not.toHaveBeenCalled();
  });
  it("only complete uses lazy service authority, with exact persisted IDs and validated proposal", async () => {
    const { repo, calls, authority } = sdk(completed());
    const model = { proposal: proposal(), modelName: "synthetic-review-model", promptVersion: PROPOSAL_FACT_PROMPT_VERSION };
    const result = await repo.complete(base, input, model as never);
    expect(result.status).toBe("completed"); expect(authority).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([{ role: "service", path: "/rest/v1/rpc/rpc_complete_proposal_fact_edit", method: "POST",
      body: { p_user_id: owner, p_assessment_id: base, p_request_id: requestId, p_proposal: model.proposal,
        p_model_name: model.modelName, p_prompt_version: PROPOSAL_FACT_PROMPT_VERSION } }]);
  });
  it("fail sends only one fixed safe code, never a provider error/body", async () => {
    const { repo, calls } = sdk({ ...raw(), status: "failed", failure: "AI_UNAVAILABLE" });
    expect((await repo.fail(base, input)).status).toBe("failed");
    expect(calls).toEqual([{ role: "service", path: "/rest/v1/rpc/rpc_fail_proposal_fact_edit", method: "POST",
      body: { p_user_id: owner, p_assessment_id: base, p_request_id: requestId, p_failure: "AI_UNAVAILABLE" } }]);
  });
  it("invalid direct callers cannot construct an admin or dispatch SDK", async () => {
    const { repo, calls, authority } = sdk(null);
    await expect(repo.begin("wrong", input)).rejects.toThrow();
    await expect(repo.begin(base, { ...input, facts: { ...facts, xp: 500 } } as never)).rejects.toThrow();
    await expect(repo.readRequest(base, "wrong")).rejects.toThrow();
    await expect(repo.fail(base, { ...input, requestId: "wrong" })).rejects.toThrow();
    await expect(repo.complete(base, input, { proposal: proposal(), modelName: "private", promptVersion: "client-version" } as never)).rejects.toThrow();
    expect(calls).toHaveLength(0); expect(authority).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...raw(), userId: id(99) }, { ...raw(), status: undefined }, { ...raw(), status: null },
    { ...raw(), baseAssessmentId: id(99) }, { ...raw(), requestId: id(99) },
    { ...raw(), facts: { ...facts, effectiveMinutes: 34 } }, { ...raw(), completion: {} },
  ])("malformed/wrong tuple receipt %# fails closed without retry", async request => {
    const { repo, calls } = sdk({ dispatch: true, request });
    await expect(repo.begin(base, input)).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT"); expect(calls).toHaveLength(1);
  });
  it.each([null, "false", 0, {}, undefined])("dispatch must be actual boolean: %s", async dispatch => {
    const { repo } = sdk({ dispatch, request: raw() });
    await expect(repo.begin(base, input)).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("terminal dispatch=true cannot cause AI", async () => {
    await expect(sdk({ dispatch: true, request: completed() }).repo.begin(base, input)).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "private password / provider body"])("unknown/prototype DB error %s becomes safe unavailable", async message => {
    const { repo, calls } = sdk({ message, code: "42501", details: "secret", hint: "secret" }, 400);
    await expect(repo.begin(base, input)).rejects.toMatchObject({ message: "PROPOSAL_EDIT_UNAVAILABLE", code: "PROPOSAL_EDIT_UNAVAILABLE" });
    expect(calls).toHaveLength(1);
  });
  it.each(["INVALID_PROPOSAL_EDIT_INPUT", "PROPOSAL_EDIT_AUTH_REQUIRED", "PROPOSAL_EDIT_NOT_FOUND", "PROPOSAL_EDIT_CONFLICT"])("known fixed SQL code %s remains safe with no retry", async message => {
    const { repo, calls } = sdk({ message, code: "P0001", details: "private" }, 400);
    await expect(repo.begin(base, input)).rejects.toMatchObject({ message, code: message }); expect(calls).toHaveLength(1);
  });
  it.each(["userId", "activityId", "status", "promptVersion", "rulesVersion", "confidence", "createdAt", "confirmedAt"])("nested assessment requires raw %s", async key => {
    const data = completed(); Reflect.deleteProperty(data.completion.assessment, key);
    await expect(sdk(data).repo.readRequest(base, requestId)).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it("nested owner and Activity must match before public projection", async () => {
    const wrongOwner = completed(), wrongActivity = completed();
    wrongOwner.completion.assessment.userId = id(99); wrongActivity.completion.assessment.activityId = id(99);
    for (const value of [wrongOwner, wrongActivity]) await expect(sdk(value).repo.readRequest(base, requestId)).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
  it.each([503, 520])("actual SDK transient HTTP%s is not retried for any authority/read RPC", async status => {
    const { repo, calls } = sdk({ message: "private gateway" }, status);
    await expect(repo.begin(base, input)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    await expect(repo.readRequest(base, requestId)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    await expect(repo.complete(base, input, { proposal: proposal(), modelName: "synthetic", promptVersion: PROPOSAL_FACT_PROMPT_VERSION } as never)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    await expect(repo.fail(base, input)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    expect(calls).toHaveLength(4); expect(calls.map(call => call.method)).toEqual(["POST", "POST", "POST", "POST"]);
  });
  it("actual SDK lost network response dispatches once per explicit method and sanitizes cause", async () => {
    const { repo, calls } = sdk(new TypeError("private network / token"));
    await expect(repo.begin(base, input)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    await expect(repo.readRequest(base, requestId)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    await expect(repo.complete(base, input, { proposal: proposal(), modelName: "synthetic", promptVersion: PROPOSAL_FACT_PROMPT_VERSION } as never)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    await expect(repo.fail(base, input)).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE"); expect(calls).toHaveLength(4);
  });
});
