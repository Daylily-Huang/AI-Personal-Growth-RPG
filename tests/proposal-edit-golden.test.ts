import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateProposalFacts } from "@/lib/proposal-edit/ai";
import { mockAssessment } from "@/lib/ai/assess";

const id = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
function context() { return { activityId: id(2), rulesVersion: "0.1.0", original: { description: "原始统计", descriptionTruncated: false, totalMinutes: 120, effectiveMinutes: 90 },
  facts: { description: "实际进行的是写作，自述", totalMinutes: 60, effectiveMinutes: 35, relatedSkillIds: [] }, skillClues: [], originalContext: {
    version: "activity-context-v1", asOf: "2026-10-11T00:00:00Z", rulesVersion: "0.1.0", mainQuest: null, relatedSkills: [], recentSamples: [],
    temporaryState: { energy: 50, focus: 40, momentum: 30, stress: 20 }, coverage: { candidateScanTruncated: false, aliasesTruncated: false,
      skillNamesOmitted: false, relatedSkillsTruncated: false, recentSamplesTruncated: false, questChainIncomplete: false, budgetReduced: false },
  } }; }
// Pure old fixture generator only; production adapter never imports or falls back to it.
const proposal = () => mockAssessment({ rawInput: "统计学习", recentSimilarCount: 0 });
let fetcher: ReturnType<typeof vi.fn>;
function upstream(content: unknown) { return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { "content-type": "application/json" } }); }
beforeEach(() => {
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"]) vi.stubEnv(key, "");
  vi.stubEnv("AI_API_KEY", "synthetic-only"); vi.stubEnv("AI_BASE_URL", "https://synthetic.invalid/v1"); vi.stubEnv("AI_MODEL", "synthetic-model");
  fetcher = vi.fn().mockResolvedValue(upstream(JSON.stringify(proposal()))); vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("facts-v0.4 golden/actual OpenAI SDK offline transport", () => {
  it("actual SDK sends exact deterministic config and returns only strict proposal/provenance", async () => {
    const result = await evaluateProposalFacts(context());
    expect(result.modelName).toBe("synthetic-model"); expect(result.promptVersion).toBe("activity-evaluator-v0.4-facts"); expect(result.proposal).toEqual(proposal());
    expect(fetcher).toHaveBeenCalledTimes(1); const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://synthetic.invalid/v1/chat/completions");
    const body = JSON.parse(String(init.body)); expect(body).toMatchObject({ model: "synthetic-model", temperature: 0, stream: false, response_format: { type: "json_object" } });
    expect(body.messages).toHaveLength(2); expect(body.messages[1].content).toContain(JSON.stringify(context().facts));
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([429, 500, 503])("actual SDK status %s dispatches once without retry or upstream detail", async status => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { message: "private provider trace" } }), { status, headers: { "content-type": "application/json" } }));
    await expect(evaluateProposalFacts(context())).rejects.toMatchObject({ code: "PROPOSAL_EDIT_AI_UNAVAILABLE", message: "PROPOSAL_EDIT_AI_UNAVAILABLE" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("actual 60s SDK timeout has no retry and returns a fixed safe error", async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("private timeout", "AbortError")), { once: true })));
    const outcome = evaluateProposalFacts(context()).then(() => "unexpected", error => error);
    await vi.advanceTimersByTimeAsync(0); expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60001);
    expect(await outcome).toMatchObject({ code: "PROPOSAL_EDIT_AI_UNAVAILABLE" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([null, "", "   ", "not JSON", "```json\n{}\n```", "{}", "{\"xp\":99999}", "x".repeat(65537)])("invalid/raw oversized content case %# fails safely", async content => {
    fetcher.mockResolvedValue(upstream(content)); await expect(evaluateProposalFacts(context())).rejects.toMatchObject({ code: "PROPOSAL_EDIT_AI_UNAVAILABLE" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("raw model budget is UTF8 bytes, not character count", async () => {
    fetcher.mockResolvedValue(upstream(JSON.stringify({ ...proposal(), uncertainty_notes: ["中".repeat(23000)] })));
    await expect(evaluateProposalFacts(context())).rejects.toMatchObject({ code: "PROPOSAL_EDIT_AI_UNAVAILABLE" });
  });
  it.each(["x".repeat(257), "\u0000bad", "中".repeat(86), "   "])("invalid model label %# stops before SDK dispatch", async model => {
    vi.stubEnv("AI_MODEL", model); await expect(evaluateProposalFacts(context())).rejects.toMatchObject({ code: "PROPOSAL_EDIT_AI_UNAVAILABLE" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("missing configuration never produces a Demo proposal", async () => {
    vi.stubEnv("AI_API_KEY", ""); vi.stubEnv("AI_BASE_URL", ""); await expect(evaluateProposalFacts(context())).rejects.toMatchObject({ code: "PROPOSAL_EDIT_AI_UNAVAILABLE" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...context(), activityId: "bad" }, { ...context(), facts: { xp: 50000 } }, { ...context(), rulesVersion: "foreign" }])("invalid context case %# has zero SDK dispatch", async value => {
    await expect(evaluateProposalFacts(value)).rejects.toMatchObject({ code: "PROPOSAL_EDIT_UNAVAILABLE" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("JSON escaped malformed Unicode in model strings is not silently repaired", async () => {
    fetcher.mockResolvedValue(upstream(JSON.stringify({ ...proposal(), uncertainty_notes: ["\ud800"] })));
    await expect(evaluateProposalFacts(context())).rejects.toMatchObject({ code: "PROPOSAL_EDIT_AI_UNAVAILABLE" });
  });
});
