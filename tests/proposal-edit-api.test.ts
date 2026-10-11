import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as editGET, POST as editPOST } from "@/app/api/assessments/[id]/edit/route";
import { GET as historyGET } from "@/app/api/activities/[id]/fact-revisions/route";
import { ProposalEditRepository } from "@/lib/proposal-edit/repository";
import { loadProposalFacts, loadProposalSkills, loadProposalHistory, submitProposalFacts, checkProposalFacts,
  ProposalEditClientError, proposalEditClientMessage } from "@/lib/proposal-edit/client";
import { POST as legacyAssessPOST } from "@/app/api/activities/[id]/assess/route";
import { getProposalEditRepository } from "@/lib/proposal-edit/request";
import { ProposalEditService } from "@/lib/proposal-edit/service";
import { proposalEditFailure, proposalEditResponse, proposalEditResultResponse,
  proposalFactHistoryResponse, proposalFactSkillsResponse,
  readProposalEditBody, validateProposalEditPostHeaders } from "@/lib/proposal-edit/http";
import {
  ProposalEditError, PROPOSAL_FACT_PROMPT_VERSION, type ProposalEditRequest,
  type ProposalEditRequestPort, type ProposalEditModelResult,
} from "@/lib/proposal-edit/types";

const mocks = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn(), legacyRepository: vi.fn(), assess: vi.fn(), configured: vi.fn(), reevaluate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.server }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/proposal-edit/ai", () => ({ evaluateProposalFacts: mocks.reevaluate }));
vi.mock("@/lib/store/request-repository", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/store/request-repository")>(), getRequestRepository: mocks.legacyRepository,
}));
vi.mock("@/lib/ai/assess", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/ai/assess")>(), assessActivity: mocks.assess,
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: mocks.configured }));
const id = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const base = id(3), requestId = id(4), activityId = id(2);
const input = () => ({ requestId, facts: { description: "修正事实，不改评分", totalMinutes: 60, effectiveMinutes: 35, relatedSkillIds: [id(5)] } });
function active(): ProposalEditRequest { return { requestId, activityId, baseAssessmentId: base, facts: input().facts,
  createdAt: "2026-10-11T00:00:00Z", expiresAt: "2026-10-11T00:03:00Z", status: "in_progress", completion: null, failure: null }; }
function model(): ProposalEditModelResult { return { modelName: "synthetic-only", promptVersion: PROPOSAL_FACT_PROMPT_VERSION, proposal: {
  activity: { type: "learning", completion: 0.8 }, difficulty: { complexity: 0.5, uncertainty: 0.2, expertise_gap: 0.3, resistance: 0.1 },
  growth: { effort: 0.6, learning: 0.7, performance: 0.4, outcome: 0.5, artifact_value: 0, character_evidence: 0 },
  evidence: { level: 0, explanation: "仅自述" }, affected_skills: [{ name: "统计", reason: "线索" }],
  knowledge_updates: { proposed_nodes: [], proposed_edges: [] }, mastery_changes: [],
  xp_semantics: { base_value: 50, difficulty: 0.5, mastery_gain: 0.2, novelty: 0.4, goal_alignment: 0.7, repetition_risk: "low" },
  next_quest: null, confidence: 0.7, uncertainty_notes: [], artifacts: [],
} }; }
function completed(): ProposalEditRequest { return { ...active(), status: "completed", failure: null, completion: {
  revisionId: id(6), previousRevisionId: null, createdAt: "2026-10-11T00:00:30Z", assessment: {
    id: id(7), activityId, status: "pending", ...model(), rulesVersion: "0.1.0", confidence: 0.7,
    createdAt: "2026-10-11T00:00:30Z", confirmedAt: null,
  },
} }; }
function terminal(status: "failed" | "expired" | "conflict"): ProposalEditRequest {
  if (status === "failed") return { ...active(), status, failure: "AI_UNAVAILABLE", completion: null };
  if (status === "expired") return { ...active(), status, failure: "EXPIRED", completion: null };
  return { ...active(), status, failure: "CONFLICT", completion: null };
}
function setup() {
  const port = { begin: vi.fn().mockResolvedValue({ dispatch: true, request: active() }),
    readRequest: vi.fn().mockResolvedValue(active()), complete: vi.fn().mockResolvedValue(completed()),
    fail: vi.fn().mockResolvedValue(terminal("failed")) };
  const evaluate = vi.fn().mockResolvedValue(model());
  return { port, evaluate, service: new ProposalEditService(port satisfies ProposalEditRequestPort, evaluate) };
}
let auth: ReturnType<typeof vi.fn>, rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); auth = vi.fn().mockResolvedValue({ data: { user: { id: id(1) } }, error: null }); rpc = vi.fn();
  mocks.server.mockResolvedValue({ auth: { getUser: auth }, rpc });
});

describe("fact-edit request authentication", () => {
  it("fresh request client and verified user are required before any RPC/service construction", async () => {
    await getProposalEditRepository(); await getProposalEditRepository();
    expect(mocks.server).toHaveBeenCalledTimes(2); expect(auth).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("no session fails closed, with no demo, query or lazy admin call", async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getProposalEditRepository()).rejects.toMatchObject({ code: "PROPOSAL_EDIT_AUTH_REQUIRED" });
    expect(rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 499])("verified auth failure %s becomes fixed auth code", async status => {
    auth.mockResolvedValue({ data: { user: null }, error: { status, message: "private secret" } });
    await expect(getProposalEditRepository()).rejects.toMatchObject({ message: "PROPOSAL_EDIT_AUTH_REQUIRED" });
    expect(rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([429, 500, 503, undefined, "401", null])("auth infrastructure status %s is unavailable, never forged login", async status => {
    auth.mockResolvedValue({ data: { user: null }, error: { status, message: "private secret" } });
    await expect(getProposalEditRepository()).rejects.toMatchObject({ message: "PROPOSAL_EDIT_UNAVAILABLE" });
    expect(rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("missing configuration / thrown SDK error is sanitized", async () => {
    mocks.server.mockRejectedValueOnce(Error("private env / service key"));
    await expect(getProposalEditRepository()).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    auth.mockRejectedValueOnce(Error("private provider response"));
    await expect(getProposalEditRepository()).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    expect(mocks.admin).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });
  it("malformed authenticated user identity is infrastructure failure, not user input authority", async () => {
    auth.mockResolvedValue({ data: { user: { id: "invalid" } }, error: null });
    await expect(getProposalEditRepository()).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    expect(rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
});

describe("fact-edit actual GET routes (offline, read-only adapters)", () => {
  const context = (value = base) => ({ params: Promise.resolve({ id: value }) });
  const request = (query = "") => new Request(`http://localhost/api/assessments/${base}/edit${query}`);
  let facts: ReturnType<typeof vi.spyOn>, skills: ReturnType<typeof vi.spyOn>, history: ReturnType<typeof vi.spyOn>, lookup: ReturnType<typeof vi.spyOn>;
  const privateResponse = (response: Response) => {
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(mocks.admin).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  };
  beforeEach(() => {
    facts = vi.spyOn(ProposalEditRepository.prototype, "readFacts").mockResolvedValue({ assessmentId: base } as never);
    skills = vi.spyOn(ProposalEditRepository.prototype, "readSkills").mockResolvedValue({ items: [], nextCursor: null } as never);
    history = vi.spyOn(ProposalEditRepository.prototype, "readHistory").mockResolvedValue({ items: [], nextCursor: null } as never);
    lookup = vi.spyOn(ProposalEditRepository.prototype, "readRequest").mockResolvedValue(active());
  });
  afterEach(() => vi.restoreAllMocks());
  it.each([editGET, historyGET])("auth precedes invalid params and query", async route => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    let readParams = 0;
    const untrusted = { get params(): Promise<{ id: string }> { readParams++; throw Error("params must not be read"); } };
    const response = await route(request("?view=forged&after=bad"), untrusted);
    expect(response.status).toBe(401); expect(readParams).toBe(0); privateResponse(response);
    for (const read of [facts, skills, history, lookup]) expect(read).not.toHaveBeenCalled();
  });
  it.each([editGET, historyGET])("auth infrastructure failure stays private unavailable", async route => {
    auth.mockRejectedValue(Error("private credential"));
    const response = await route(request(), context());
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("credential"); privateResponse(response);
  });
  it.each(["", "?view=facts"])("facts %s use just authenticated fact reader", async query => {
    const response = await editGET(request(query), context());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ assessmentId: base });
    expect(facts).toHaveBeenCalledExactlyOnceWith(base); expect(skills).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled(); privateResponse(response);
  });
  it.each([null, id(99)])("skills cursor %s is passed without mutation", async cursor => {
    const response = await editGET(request(`?view=skills${cursor ? `&after=${cursor}` : ""}`), context());
    expect(response.status).toBe(200); expect(skills).toHaveBeenCalledExactlyOnceWith(base, cursor);
    expect(facts).not.toHaveBeenCalled(); privateResponse(response);
  });
  it.each([null, id(99)])("history cursor %s is activity-scoped", async cursor => {
    const response = await historyGET(request(cursor ? `?after=${cursor}` : ""), context(activityId));
    expect(response.status).toBe(200); expect(history).toHaveBeenCalledExactlyOnceWith(activityId, cursor);
    expect(facts).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled(); privateResponse(response);
  });
  it.each(["?view=facts&after=" + id(99), "?view=skills&requestId=" + requestId, "?view=request", "?view=request&requestId=bad", "?view=skills&after=bad", "?view=facts&view=facts", "?extra=true"])("invalid edit query %s is rejected before reading", async query => {
    const response = await editGET(request(query), context()); expect(response.status).toBe(400);
    for (const read of [facts, skills, history, lookup]) expect(read).not.toHaveBeenCalled(); privateResponse(response);
  });
  it.each(["?after=bad", `?after=${id(99)}&after=${id(99)}`, "?view=facts", "?owner=forged"])("invalid history query %s is rejected", async query => {
    const response = await historyGET(request(query), context(activityId));
    expect(response.status).toBe(400); expect(history).not.toHaveBeenCalled(); privateResponse(response);
  });
  it.each([editGET, historyGET])("invalid path fails after auth without any reader", async route => {
    const response = await route(request(), context("bad")); expect(response.status).toBe(400);
    expect(auth).toHaveBeenCalledTimes(1); for (const read of [facts, skills, history, lookup]) expect(read).not.toHaveBeenCalled(); privateResponse(response);
  });
  it.each([
    [active(), 202], [completed(), 200], [terminal("failed"), 502], [terminal("expired"), 409], [terminal("conflict"), 409],
  ] as const)("request reads return durable %j with status %s and no dispatch", async (result, status) => {
    lookup.mockResolvedValue(result);
    const response = await editGET(request(`?view=request&requestId=${requestId}`), context());
    expect(response.status).toBe(status); expect(lookup).toHaveBeenCalledExactlyOnceWith(base, requestId);
    if (result.status === "in_progress") expect(response.headers.get("retry-after")).toBe("3");
    if (result.status === "completed") expect(await response.json()).toEqual({ replayed: true, request: result });
    expect(facts).not.toHaveBeenCalled(); privateResponse(response);
  });
  it.each(["PROPOSAL_EDIT_NOT_FOUND", "PROPOSAL_EDIT_CONFLICT", "INVALID_PROPOSAL_EDIT_RECEIPT", "PROPOSAL_EDIT_UNAVAILABLE"] as const)("typed reader failure %s stays safe", async code => {
    facts.mockRejectedValue(new ProposalEditError(code));
    const response = await editGET(request(), context()); expect(response.status).toBe(code === "PROPOSAL_EDIT_NOT_FOUND" ? 404 : code === "PROPOSAL_EDIT_CONFLICT" ? 409 : 500); privateResponse(response);
  });
  it("unknown history exception never returns database details", async () => {
    history.mockRejectedValue(Error("postgres service-role private payload"));
    const response = await historyGET(request(), context(activityId)); expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/postgres|service-role|payload/); privateResponse(response);
  });
  it("history has its own fixed larger JSON budget; skills stay at 80KiB", async () => {
    const large = { data: "x".repeat(140000) };
    history.mockResolvedValue(large); skills.mockResolvedValue(large);
    const successful = await historyGET(request(), context(activityId)); expect(successful.status).toBe(200);
    expect(await successful.json()).toEqual(large); privateResponse(successful);
    const denied = await editGET(request("?view=skills"), context()); expect(denied.status).toBe(500); privateResponse(denied);
  });
  it.each([[proposalFactSkillsResponse, 81920], [proposalFactHistoryResponse, 1572864]] as const)("fixed response budget exact byte boundary", (respond, budget) => {
    // JSON string itself adds exactly two bytes; multibyte payload is measured after encoding.
    expect(respond("x".repeat(budget - 2)).status).toBe(200);
    expect(() => respond("x".repeat(budget - 1))).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
    expect(() => respond("中".repeat(Math.ceil(budget / 3)))).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
});

describe("actual legacy assess route fact-edit gate", () => {
  const invoke = () => legacyAssessPOST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: activityId }) });
  let guard: ReturnType<typeof vi.fn>, context: ReturnType<typeof vi.fn>, add: ReturnType<typeof vi.fn>;
  let repository: Record<string, unknown>;
  beforeEach(() => {
    mocks.configured.mockReturnValue(true);
    guard = vi.fn().mockResolvedValue(false); add = vi.fn().mockResolvedValue(completed().completion!.assessment);
    context = vi.fn().mockResolvedValue({ activityId, rawInput: "original", context: {
      version: "activity-context-v1", asOf: "2026-10-11T00:00:00Z", rulesVersion: "0.1.0", mainQuest: null,
      relatedSkills: [], recentSamples: [], temporaryState: { energy: 50, focus: 50, momentum: 50, stress: 50 },
      coverage: { candidateScanTruncated: false, aliasesTruncated: false, skillNamesOmitted: false, relatedSkillsTruncated: false,
        recentSamplesTruncated: false, questChainIncomplete: false, budgetReduced: false },
    } });
    repository = { getActivity: vi.fn().mockResolvedValue({ id: activityId, status: "assessed", rawInput: "original", rulesVersion: "0.1.0" }),
      hasProposalFactEdit: guard, getAssessmentContext: context, addAssessment: add };
    mocks.legacyRepository.mockResolvedValue(repository); mocks.assess.mockResolvedValue({ proposal: model().proposal, modelName: "synthetic" });
  });
  it("existing revision or active request rejects before context/model/persistence", async () => {
    guard.mockResolvedValue(true); const response = await invoke(); expect(response.status).toBe(409);
    expect(guard).toHaveBeenCalledExactlyOnceWith(activityId); expect(context).not.toHaveBeenCalled(); expect(mocks.assess).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled();
  });
  it.each(["missing", "throws"])("guard %s fails closed without model", async mode => {
    if (mode === "missing") delete repository.hasProposalFactEdit;
    else guard.mockRejectedValue(Error("private database failure"));
    const response = await invoke(); expect(response.status).toBe(500);
    expect(context).not.toHaveBeenCalled(); expect(mocks.assess).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("private");
  });
  it("unchanged ordinary assessment uses original context once after clear guard", async () => {
    const response = await invoke(); expect(response.status).toBe(200);
    expect(guard).toHaveBeenCalledTimes(1); expect(context).toHaveBeenCalledExactlyOnceWith(activityId);
    expect(mocks.assess).toHaveBeenCalledTimes(1); expect(add).toHaveBeenCalledTimes(1);
    expect(mocks.assess.mock.calls[0][0]).toMatchObject({ rawInput: "original", authenticatedSnapshot: await context.mock.results[0].value });
  });
  it("actual SQL race conflict is a safe 409 after model, not an unhandled failure", async () => {
    add.mockRejectedValue({ message: "PROPOSAL_EDIT_CONFLICT", detail: "private database" });
    const response = await invoke(); expect(response.status).toBe(409); expect(mocks.assess).toHaveBeenCalledTimes(1);
    expect(await response.text()).not.toContain("private database"); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("Demo deliberately keeps its old no-context/no-new-port path", async () => {
    mocks.configured.mockReturnValue(false); delete repository.hasProposalFactEdit;
    const response = await invoke(); expect(response.status).toBe(200);
    expect(guard).not.toHaveBeenCalled(); expect(context).not.toHaveBeenCalled();
    expect(mocks.assess.mock.calls[0][0]).not.toHaveProperty("authenticatedSnapshot");
    expect(mocks.assess.mock.calls[0][1]).toEqual({ allowDemoFallback: true });
  });
});

describe("actual fact-edit POST route dispatch and unknown-result boundary", () => {
  let begin: ReturnType<typeof vi.spyOn>, read: ReturnType<typeof vi.spyOn>, complete: ReturnType<typeof vi.spyOn>, fail: ReturnType<typeof vi.spyOn>, context: ReturnType<typeof vi.spyOn>;
  const invoke = (body: unknown = input(), query = "", headers: Record<string, string> = {}) => editPOST(new Request(`http://localhost/api/assessments/${base}/edit${query}`,
    { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost", ...headers }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: base }) });
  beforeEach(() => {
    begin = vi.spyOn(ProposalEditRepository.prototype, "begin").mockResolvedValue({ dispatch: true, request: active() });
    read = vi.spyOn(ProposalEditRepository.prototype, "readRequest").mockResolvedValue(completed());
    complete = vi.spyOn(ProposalEditRepository.prototype, "complete").mockResolvedValue(completed());
    fail = vi.spyOn(ProposalEditRepository.prototype, "fail").mockResolvedValue(terminal("failed"));
    context = vi.spyOn(ProposalEditRepository.prototype, "readModelContext").mockResolvedValue({ bounded: "context" } as never);
    mocks.reevaluate.mockResolvedValue(model());
  });
  afterEach(() => vi.restoreAllMocks());
  it("first durable dispatch evaluates once outside the begin call and returns201", async () => {
    const response = await invoke(); expect(response.status).toBe(201); expect(await response.json()).toEqual({ replayed: false, request: completed() });
    expect(begin).toHaveBeenCalledExactlyOnceWith(base, input());
    expect(context).toHaveBeenCalledExactlyOnceWith({ requestId, activityId, baseAssessmentId: base, facts: input().facts });
    expect(mocks.reevaluate).toHaveBeenCalledExactlyOnceWith({ bounded: "context" }); expect(complete).toHaveBeenCalledExactlyOnceWith(base, input(), model());
    expect(begin.mock.invocationCallOrder[0]).toBeLessThan(context.mock.invocationCallOrder[0]);
    expect(context.mock.invocationCallOrder[0]).toBeLessThan(mocks.reevaluate.mock.invocationCallOrder[0]);
    expect(fail).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toBe("Cookie");
  });
  it.each([[active(), 202], [completed(), 200], [terminal("failed"), 502], [terminal("expired"), 409], [terminal("conflict"), 409]] as const)("every existing key state %j replays without context or AI", async (request, status) => {
    begin.mockResolvedValue({ dispatch: false, request }); const response = await invoke(); expect(response.status).toBe(status);
    expect(context).not.toHaveBeenCalled(); expect(mocks.reevaluate).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled();
  });
  it("no login wins over bad headers/body/params, no parsing or dispatch", async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    const response = await editPOST(new Request("http://localhost?forged=1", { method: "POST", body: "not JSON" }),
      { get params(): Promise<{ id: string }> { throw Error("must not parse path"); } });
    expect(response.status).toBe(401); expect(begin).not.toHaveBeenCalled(); expect(context).not.toHaveBeenCalled(); expect(mocks.reevaluate).not.toHaveBeenCalled();
  });
  it.each([
    [input(), "?view=facts", {}, 400], [input(), "", { origin: "http://foreign.invalid" }, 403],
    [input(), "", { "sec-fetch-site": "cross-site" }, 403], [input(), "", { "content-type": "text/plain" }, 415],
    [{ ...input(), xp: 90000 }, "", {}, 400], [{ ...input(), facts: { ...input().facts, effectiveMinutes: 61 } }, "", {}, 400],
    [{ ...input(), facts: { ...input().facts, description: "x".repeat(17000) } }, "", {}, 413],
  ] as const)("invalid POST case %# stops before persistence or model", async (body, query, headers, status) => {
    const response = await invoke(body, query, headers); expect(response.status).toBe(status);
    expect(begin).not.toHaveBeenCalled(); expect(context).not.toHaveBeenCalled(); expect(mocks.reevaluate).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled();
  });
  it("unknown begin uses one same-key GET, not a second begin/context/model", async () => {
    begin.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE")); const response = await invoke(); expect(response.status).toBe(200);
    expect(begin).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledExactlyOnceWith(base, requestId); expect(context).not.toHaveBeenCalled(); expect(mocks.reevaluate).not.toHaveBeenCalled();
  });
  it("unknown commit reads the key once without fail or second model request", async () => {
    complete.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE")); const response = await invoke(); expect(response.status).toBe(200);
    expect(mocks.reevaluate).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledExactlyOnceWith(base, requestId); expect(fail).not.toHaveBeenCalled();
  });
  it("invalid context after begin records safe failure without SDK dispatch", async () => {
    context.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE")); const response = await invoke(); expect(response.status).toBe(502);
    expect(mocks.reevaluate).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled(); expect(fail).toHaveBeenCalledExactlyOnceWith(base, input());
  });
  it("provider error cannot leak input/upstream details or replace old pending", async () => {
    mocks.reevaluate.mockRejectedValue(Error("private prompt/provider details")); const response = await invoke(); expect(response.status).toBe(502);
    expect(await response.text()).not.toMatch(/private|provider/); expect(fail).toHaveBeenCalledExactlyOnceWith(base, input()); expect(complete).not.toHaveBeenCalled();
  });
});

describe("actual browser client transport/public receipts", () => {
  let transport: ReturnType<typeof vi.fn>;
  const signal = () => new AbortController().signal;
  const factsView = () => ({ assessmentId: base, activityId, rulesVersion: "0.1.0", original: { description: "original", descriptionTruncated: false, totalMinutes: 120, effectiveMinutes: 90 }, currentRevision: null });
  const revision = () => ({ id: id(6), requestId, activityId, baseAssessmentId: base, resultAssessmentId: id(7), previousRevisionId: null,
    rulesVersion: "0.1.0", promptVersion: PROPOSAL_FACT_PROMPT_VERSION, createdAt: "2026-10-11T00:00:30Z", facts: input().facts });
  beforeEach(() => { transport = vi.fn(); vi.stubGlobal("fetch", transport); });
  afterEach(() => vi.unstubAllGlobals());
  it("facts use assessment route and require bound activity, original values and native flags", async () => {
    transport.mockResolvedValue(proposalEditResponse(factsView())); const owned = signal();
    expect(await loadProposalFacts(base, activityId, owned)).toEqual(factsView());
    expect(transport).toHaveBeenCalledExactlyOnceWith(`/api/assessments/${base}/edit`, { method: "GET", credentials: "same-origin", cache: "no-store", signal: owned });
  });
  it.each([
    () => ({ ...factsView(), activityId: id(99) }), () => ({ ...factsView(), assessmentId: id(99) }),
    () => ({ ...factsView(), original: { ...factsView().original, descriptionTruncated: null } }),
    () => ({ ...factsView(), original: { ...factsView().original, description: "x".repeat(8193) } }),
    () => ({ ...factsView(), currentRevision: { ...revision(), resultAssessmentId: base } }),
    () => ({ ...factsView(), userId: id(1) }),
  ])("invalid public fact view case %# fails closed", async value => {
    transport.mockResolvedValue(proposalEditResponse(value())); await expect(loadProposalFacts(base, activityId, signal())).rejects.toBeInstanceOf(Error);
  });
  it("skills accept exactly50 ordered unique IDs and validate the lookahead cursor", async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({ id: id(1000 + index), name: "统计", nameTruncated: false, masteryLevel: 8, masteryConfidence: 0.8 }));
    transport.mockResolvedValue(proposalFactSkillsResponse({ assessmentId: base, activityId, items, nextCursor: items[49].id }));
    expect((await loadProposalSkills(base, activityId, id(999), signal())).items).toHaveLength(50);
    expect(transport.mock.calls[0][0]).toBe(`/api/assessments/${base}/edit?view=skills&after=${id(999)}`);
  });
  it.each([
    { items: [], nextCursor: id(99) },
    { items: [{ id: id(99), name: "x", nameTruncated: null, masteryLevel: 0, masteryConfidence: 0 }], nextCursor: null },
    { items: [{ id: id(99), name: "x".repeat(201), nameTruncated: true, masteryLevel: 0, masteryConfidence: 0 }], nextCursor: null },
  ])("malformed skills case %# fails closed", async page => {
    transport.mockResolvedValue(proposalFactSkillsResponse({ assessmentId: base, activityId, ...page }));
    await expect(loadProposalSkills(base, activityId, null, signal())).rejects.toBeInstanceOf(Error);
  });
  it("history is ActivityID-only with complete facts/provenance and no AI JSON", async () => {
    const item = { ...revision(), modelName: "synthetic", assessmentStatus: "pending" };
    transport.mockResolvedValue(proposalFactHistoryResponse({ activityId, items: [item], nextCursor: null }));
    const result = await loadProposalHistory(activityId, null, signal()); expect(result.items[0]).toEqual(item);
    expect(transport.mock.calls[0][0]).toBe(`/api/activities/${activityId}/fact-revisions`);
  });
  it.each([
    () => ({ ...revision(), modelName: "synthetic", assessmentStatus: null }),
    () => ({ ...revision(), modelName: "x".repeat(257), assessmentStatus: "pending" }),
    () => ({ ...revision(), modelName: "synthetic", assessmentStatus: "pending", proposal: model().proposal }),
    () => ({ ...revision(), modelName: "synthetic", assessmentStatus: "pending", activityId: id(99) }),
  ])("malformed public history case %# fails closed", async item => {
    transport.mockResolvedValue(proposalFactHistoryResponse({ activityId, items: [item()], nextCursor: null }));
    await expect(loadProposalHistory(activityId, null, signal())).rejects.toBeInstanceOf(Error);
  });
  it.each(["completed", "in_progress", "failed", "expired", "conflict"] as const)("actual HTTP result %s becomes bound client state without implicit requests", async status => {
    const request = status === "completed" ? completed() : status === "in_progress" ? active() : terminal(status);
    transport.mockResolvedValue(proposalEditResultResponse({ replayed: false, request }));
    const result = await submitProposalFacts(base, activityId, input(), signal()); expect(result.status).toBe(status); expect(transport).toHaveBeenCalledTimes(1);
    if (result.status === "completed") expect(result.request.facts).toEqual(input().facts);
    const [url, init] = transport.mock.calls[0]; expect(url).toBe(`/api/assessments/${base}/edit`); expect(init.method).toBe("POST"); expect(JSON.parse(init.body)).toEqual(input());
  });
  it("unknown POST is never resubmitted; explicit reconciliation sends same-key GET", async () => {
    transport.mockRejectedValueOnce(Error("private socket error"));
    await expect(submitProposalFacts(base, activityId, input(), signal())).rejects.toMatchObject({ code: "unknown" });
    transport.mockResolvedValueOnce(proposalEditResultResponse({ replayed: true, request: completed() }));
    expect((await checkProposalFacts(base, activityId, input(), signal())).status).toBe("completed");
    expect(transport.mock.calls.map(call => call[1].method)).toEqual(["POST", "GET"]);
    expect(transport.mock.calls[1][0]).toBe(`/api/assessments/${base}/edit?view=request&requestId=${requestId}`);
  });
  it.each([
    () => ({ replayed: false, request: { ...completed(), activityId: id(99) } }),
    () => ({ replayed: false, request: { ...completed(), facts: { ...input().facts, effectiveMinutes: 34 } } }),
    () => ({ replayed: "false", request: completed() }),
    () => ({ replayed: false, request: { ...completed(), userId: id(1) } }),
    () => ({ replayed: false, request: { ...completed(), status: null } }),
  ])("untrusted complete public receipt case %# remains unknown", async value => {
    transport.mockResolvedValue(proposalEditResponse(value(), 201));
    await expect(submitProposalFacts(base, activityId, input(), signal())).rejects.toMatchObject({ code: "unknown" });
  });
  it("GET never accepts first-write201 or missing/native false replay flags", async () => {
    transport.mockResolvedValue(proposalEditResultResponse({ replayed: false, request: completed() }));
    await expect(checkProposalFacts(base, activityId, input(), signal())).rejects.toBeInstanceOf(Error);
  });
  it.each([401, 404, 400, 403, 413, 415])("HTTP%s error body is canceled, not shown or parsed", async status => {
    let canceled = 0;
    transport.mockResolvedValue(new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("private database token")); }, cancel() { canceled++; } }), { status }));
    const error = await loadProposalFacts(base, activityId, signal()).then(() => null, cause => cause);
    expect(error).toBeInstanceOf(ProposalEditClientError); expect(proposalEditClientMessage(error)).not.toMatch(/private|token/); expect(canceled).toBe(1);
  });
  it("generic502 is unknown, not proof that this key failed", async () => {
    transport.mockResolvedValue(proposalEditResponse({ error: "private upstream" }, 502));
    await expect(submitProposalFacts(base, activityId, input(), signal())).rejects.toMatchObject({ code: "unknown" });
  });
  it("success response UTF8 overflow cancels the stream and remains unknown", async () => {
    let canceled = 0; transport.mockResolvedValue(new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(131073)); }, cancel() { canceled++; } }), { status: 201 }));
    await expect(submitProposalFacts(base, activityId, input(), signal())).rejects.toMatchObject({ code: "unknown" }); expect(canceled).toBe(1);
  });
  it("invalid UTF8 or malformedJSON cannot become a successful facts read", async () => {
    transport.mockResolvedValue(new Response(new Uint8Array([0xff, 0xff])));
    await expect(loadProposalFacts(base, activityId, signal())).rejects.toBeInstanceOf(Error);
  });
  it("encoded request limit is checked before fetch without inventing a persisted request", async () => {
    await expect(submitProposalFacts(base, activityId, { ...input(), facts: { ...input().facts, description: "\u0001".repeat(8192) } }, signal())).rejects.toMatchObject({ code: "invalid" }); expect(transport).not.toHaveBeenCalled();
  });
});

function httpRequest(body = "{}", headers: Record<string, string> = {}, suffix = "") {
  return new Request(`http://internal.invalid/api/assessments/${base}/edit${suffix}`, {
    method: "POST", body, headers: { "Content-Type": "application/json", ...headers },
  });
}
describe("bounded HTTP primitives with actual installed NextResponse (not live route evidence)", () => {
  it.each(["application/json", "application/json; charset=UTF-8", 'application/json; charset="utf8"'])("accepts only JSON media %s", contentType => {
    expect(() => validateProposalEditPostHeaders(httpRequest("{}", { "Content-Type": contentType }))).not.toThrow();
  });
  it.each(["text/plain", "application/json-evil", "application/json; charset=latin1", "application/json; extra=x"])("rejects media %s", contentType => {
    expect(() => validateProposalEditPostHeaders(httpRequest("{}", { "Content-Type": contentType }))).toThrow("PROPOSAL_EDIT_UNSUPPORTED_MEDIA_TYPE");
  });
  it("real Host, not internal Next URL or forwarded headers, controls origin", () => {
    expect(() => validateProposalEditPostHeaders(httpRequest("{}", { Host: "127.0.0.1:3019", Origin: "http://127.0.0.1:3019", "X-Forwarded-Host": "foreign.invalid" }))).not.toThrow();
    expect(() => validateProposalEditPostHeaders(httpRequest("{}", { Host: "127.0.0.1:3019", Origin: "http://internal.invalid" }))).toThrow("PROPOSAL_EDIT_CROSS_ORIGIN");
  });
  it.each([{ Origin: "null" }, { Origin: "https://foreign.invalid" }, { "Sec-Fetch-Site": "cross-site" }] as Record<string, string>[])("cross-origin %j rejected", headers => {
    expect(() => validateProposalEditPostHeaders(httpRequest("{}", headers))).toThrow("PROPOSAL_EDIT_CROSS_ORIGIN");
  });
  it.each(["?requestId=x", "?view=facts", "?unknown=x"])("POST query %s is not silently ignored", suffix => {
    expect(() => validateProposalEditPostHeaders(httpRequest("{}", {}, suffix))).toThrow("INVALID_PROPOSAL_EDIT_INPUT");
  });
  it("reads at most 16384 actual bytes regardless of Content-Length", async () => {
    expect(await readProposalEditBody(httpRequest("{}" + " ".repeat(16382)))).toEqual({});
    await expect(readProposalEditBody(httpRequest("{}" + " ".repeat(16383), { "Content-Length": "2" }))).rejects.toThrow("PROPOSAL_EDIT_PAYLOAD_TOO_LARGE");
    await expect(readProposalEditBody(httpRequest(JSON.stringify("你".repeat(6000))))).rejects.toThrow("PROPOSAL_EDIT_PAYLOAD_TOO_LARGE");
  });
  it("decodes split multi-byte UTF8 fatally and releases stream lock", async () => {
    const bytes = new TextEncoder().encode('"你"');
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close();
    } });
    const request = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readProposalEditBody(request)).toBe("你"); expect(request.body?.locked).toBe(false);
    for (const invalid of [Uint8Array.of(34, 255, 34), Uint8Array.of(34, 0xe4, 34)]) {
      const bad = new Request("http://localhost", { method: "POST", body: invalid });
      await expect(readProposalEditBody(bad)).rejects.toThrow("INVALID_PROPOSAL_EDIT_INPUT"); expect(bad.body?.locked).toBe(false);
    }
  });
  it("cancel rejection never replaces the original payload limit", async () => {
    let cancels = 0;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(16385)); },
      cancel() { cancels++; throw Error("private cancel"); } });
    const request = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readProposalEditBody(request)).rejects.toThrow("PROPOSAL_EDIT_PAYLOAD_TOO_LARGE");
    expect(cancels).toBe(1); expect(request.body?.locked).toBe(false);
  });
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "private provider/password"])("unknown/prototype failure %s has safe JSON500", async code => {
    const response = proposalEditFailure(new ProposalEditError(code as never));
    expect(response.status).toBe(500); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie"); expect(JSON.stringify(await response.json())).not.toContain(code);
  });
  it("public in-progress is 202/Retry-After3 and contains no facts, owner or dispatch", async () => {
    const response = proposalEditResultResponse({ replayed: true, request: active() });
    expect(response.status).toBe(202); expect(response.headers.get("retry-after")).toBe("3");
    expect(await response.json()).toEqual({ requestId, status: "in_progress" });
  });
  it.each([false, true])("completed replay=%s gives201/200 and exact private result", async replayed => {
    const result = { replayed, request: completed() }, response = proposalEditResultResponse(result);
    expect(response.status).toBe(replayed ? 200 : 201); expect(await response.json()).toEqual(result);
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toBe("Cookie");
  });
  it.each(["failed", "expired", "conflict"] as const)("terminal %s is not a successful new proposal", async status => {
    const response = proposalEditResultResponse({ replayed: true, request: terminal(status) });
    expect(response.status).toBe(status === "failed" ? 502 : 409);
    const body = await response.json(); expect(body.status).toBe(status); expect(body.requestId).toBe(requestId); expect(body).not.toHaveProperty("completion");
  });
  it("public JSON is capped after escaping, not by original string length", () => {
    expect(() => proposalEditResponse({ private: "\u0001".repeat(22000) })).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
    expect(() => proposalEditResponse(undefined)).toThrow("INVALID_PROPOSAL_EDIT_RECEIPT");
  });
});

describe("fact-edit orchestration with explicit persisted-dispatch authority (not a DB race proof)", () => {
  it("begin -> one model -> complete, with immutable isolated facts; no original Activity mutation port", async () => {
    const { port, evaluate, service } = setup(); const value = input();
    const result = await service.submit(base, value);
    expect(result).toEqual({ replayed: false, request: completed() });
    expect(port.begin).toHaveBeenCalledExactlyOnceWith(base, value);
    expect(evaluate).toHaveBeenCalledTimes(1); expect(port.complete).toHaveBeenCalledExactlyOnceWith(base, value, model());
    expect(port.fail).not.toHaveBeenCalled(); expect(port.readRequest).not.toHaveBeenCalled();
    const handed = evaluate.mock.calls[0][0];
    expect(handed).toEqual({ requestId, activityId, baseAssessmentId: base, facts: value.facts });
    expect(Object.isFrozen(handed)).toBe(true); expect(Object.isFrozen(handed.facts)).toBe(true); expect(Object.isFrozen(handed.facts.relatedSkillIds)).toBe(true);
    expect(handed.facts).not.toBe(value.facts); expect(Object.isFrozen(value.facts)).toBe(false);
  });
  it.each(["in_progress", "completed", "failed", "expired", "conflict"] as const)("existing %s key never dispatches or mutates state", async status => {
    const { port, evaluate, service } = setup();
    const request = status === "in_progress" ? active() : status === "completed" ? completed() : terminal(status);
    port.begin.mockResolvedValue({ dispatch: false, request });
    expect(await service.submit(base, input())).toEqual({ replayed: true, request });
    expect(evaluate).not.toHaveBeenCalled(); expect(port.complete).not.toHaveBeenCalled(); expect(port.fail).not.toHaveBeenCalled(); expect(port.readRequest).not.toHaveBeenCalled();
  });
  it.each(["PROPOSAL_EDIT_NOT_FOUND", "PROPOSAL_EDIT_CONFLICT", "INVALID_PROPOSAL_EDIT_RECEIPT"] as const)("authoritative begin error %s has zero model/fallback writes", async code => {
    const { port, evaluate, service } = setup(); port.begin.mockRejectedValue(new ProposalEditError(code));
    await expect(service.submit(base, input())).rejects.toMatchObject({ code });
    expect(evaluate).not.toHaveBeenCalled(); expect(port.readRequest).not.toHaveBeenCalled(); expect(port.fail).not.toHaveBeenCalled();
  });
  it.each(["in_progress", "completed", "failed"] as const)("unknown begin result only reconciles %s same key; never takes dispatch ownership", async status => {
    const { port, evaluate, service } = setup(); port.begin.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"));
    const request = status === "in_progress" ? active() : status === "completed" ? completed() : terminal(status);
    port.readRequest.mockResolvedValue(request);
    expect(await service.submit(base, input())).toEqual({ replayed: true, request });
    expect(port.readRequest).toHaveBeenCalledExactlyOnceWith(base, requestId); expect(port.begin).toHaveBeenCalledTimes(1);
    expect(evaluate).not.toHaveBeenCalled(); expect(port.fail).not.toHaveBeenCalled(); expect(port.complete).not.toHaveBeenCalled();
  });
  it("lost complete response reads the completed key; never marks it failed or calls AI again", async () => {
    const { port, evaluate, service } = setup(); port.complete.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE")); port.readRequest.mockResolvedValue(completed());
    expect(await service.submit(base, input())).toEqual({ replayed: true, request: completed() });
    expect(evaluate).toHaveBeenCalledTimes(1); expect(port.complete).toHaveBeenCalledTimes(1); expect(port.readRequest).toHaveBeenCalledExactlyOnceWith(base, requestId); expect(port.fail).not.toHaveBeenCalled();
  });
  it("model failure records only fixed fail; old pending remains a SQL responsibility", async () => {
    const { port, evaluate, service } = setup(); evaluate.mockRejectedValue(Error("private prompt/provider"));
    expect(await service.submit(base, input())).toEqual({ replayed: false, request: terminal("failed") });
    expect(port.fail).toHaveBeenCalledExactlyOnceWith(base, input()); expect(port.complete).not.toHaveBeenCalled();
  });
  it("invalid model shape fails before any complete call", async () => {
    const { port, evaluate, service } = setup(); evaluate.mockResolvedValue({ ...model(), proposal: { xp: 9000 } });
    expect((await service.submit(base, input())).request.status).toBe("failed"); expect(port.fail).toHaveBeenCalledTimes(1); expect(port.complete).not.toHaveBeenCalled();
  });
  it.each(["expired", "conflict"] as const)("late successful AI returns terminal %s, no claimed new assessment", async status => {
    const { port, service } = setup(); port.complete.mockResolvedValue(terminal(status));
    expect(await service.submit(base, input())).toEqual({ replayed: false, request: terminal(status) }); expect(port.fail).not.toHaveBeenCalled();
  });
  it("unknown fail result reconciles, never rewrites a concurrent completed request", async () => {
    const { port, evaluate, service } = setup(); evaluate.mockRejectedValue(Error("timeout"));
    port.fail.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE")); port.readRequest.mockResolvedValue(completed());
    expect(await service.submit(base, input())).toEqual({ replayed: true, request: completed() });
    expect(port.fail).toHaveBeenCalledTimes(1); expect(port.complete).not.toHaveBeenCalled(); expect(evaluate).toHaveBeenCalledTimes(1);
  });
  it("uncertain state stays uncertain after one failed read, no blind retry/lease/new key", async () => {
    const { port, evaluate, service } = setup();
    port.begin.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE")); port.readRequest.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"));
    await expect(service.submit(base, input())).rejects.toThrow("PROPOSAL_EDIT_UNAVAILABLE");
    expect(port.begin).toHaveBeenCalledTimes(1); expect(port.readRequest).toHaveBeenCalledTimes(1); expect(evaluate).not.toHaveBeenCalled(); expect(port.fail).not.toHaveBeenCalled();
  });
  it("mismatching durable facts/route from any read never become success", async () => {
    const { port, evaluate, service } = setup();
    port.begin.mockRejectedValue(new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"));
    port.readRequest.mockResolvedValue({ ...active(), facts: { ...input().facts, effectiveMinutes: 34 } });
    await expect(service.submit(base, input())).rejects.toThrow("INVALID_PROPOSAL_EDIT_RECEIPT"); expect(evaluate).not.toHaveBeenCalled();
  });
  it("invalid caller data stops before begin/model/admin", async () => {
    const { port, evaluate, service } = setup();
    await expect(service.submit("wrong", input())).rejects.toThrow("INVALID_PROPOSAL_EDIT_INPUT");
    await expect(service.submit(base, { ...input(), userId: id(99) } as never)).rejects.toThrow("INVALID_PROPOSAL_EDIT_INPUT");
    expect(port.begin).not.toHaveBeenCalled(); expect(evaluate).not.toHaveBeenCalled();
  });
});
