import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/strategy/request", () => ({ getStrategyRepository: vi.fn() }));
vi.mock("@/lib/strategy/service", () => ({ getStrategyService: vi.fn() }));

import { GET as listStrategies, POST as createStrategy } from "@/app/api/strategies/route";
import { GET as getStrategy, PATCH as patchStrategy } from "@/app/api/strategies/[id]/route";
import { GET as listSupports, POST as insertSupport } from "@/app/api/strategies/[id]/supports/route";
import { GET as listVersions, POST as createVersion } from "@/app/api/strategies/[id]/versions/route";
import { POST as evaluate } from "@/app/api/strategies/[id]/evaluate/route";
import { POST as transition } from "@/app/api/strategies/[id]/transition/route";
import { getStrategyRepository } from "@/lib/strategy/request";
import { getStrategyService } from "@/lib/strategy/service";
import { StrategyRepository, StrategyRepositoryError } from "@/lib/strategy/repository";
import { AuthRequiredError } from "@/lib/store/request-repository";

const userId = randomUUID();
const strategyId = randomUUID();
const sourceId = randomUUID();
const observedAt = "2026-09-02T12:34:56.123456Z";

function context(id = strategyId) { return { params: Promise.resolve({ id }) }; }
function request(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
function rawStrategy() {
  return {
    id: strategyId, user_id: userId, title: "Strategy", description: "",
    context_trigger: "context", action_protocol: "protocol", expected_outcome: "outcome",
    lifecycle_status: "TESTING", confidence_level: "LOW", version: 1,
    created_at: observedAt, updated_at: observedAt,
  };
}
function rawVersion() {
  return {
    id: randomUUID(), user_id: userId, strategy_id: strategyId, version_number: 2,
    action_protocol: "protocol 2", context_trigger: "context", expected_outcome: "outcome",
    created_at: observedAt,
  };
}
function rawSupport() {
  return {
    id: randomUUID(), user_id: userId, strategy_id: strategyId, strategy_version_id: randomUUID(),
    observation_type: "SUPPORT", source_class: "ACTIVITY", source_id: sourceId,
    evaluator_version: "v1", note: null, observed_at: observedAt, created_at: observedAt,
  };
}
function rawMetrics() {
  return {
    support_count: 1, counter_evidence_count: 0, distinct_observation_dates: 1,
    completed_seasons: 0, core_links: 1, support_ratio: 1, confidence_level: "LOW",
    promotion_eligible: false,
  };
}

describe("Phase 8D Round 3 — authenticated HTTP adapters", () => {
  beforeEach(() => vi.resetAllMocks());

  test("list requires auth before returning private strategies", async () => {
    vi.mocked(getStrategyService).mockRejectedValue(new AuthRequiredError());
    const response = await listStrategies();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("create authenticates before parsing and rejects forged authority fields", async () => {
    vi.mocked(getStrategyRepository).mockRejectedValueOnce(new AuthRequiredError());
    const malformed = new Request("http://localhost/api/strategies", { method: "POST", body: "{" });
    expect((await createStrategy(malformed)).status).toBe(401);
    const create = vi.fn();
    vi.mocked(getStrategyRepository).mockResolvedValue({ create } as never);
    const response = await createStrategy(request("/api/strategies", {
      title: "x", contextTrigger: "c", actionProtocol: "p", expectedOutcome: "o",
      lifecycleStatus: "SUPPORTED",
    }));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test("create passes only user-authored fields and returns HYPOTHESIS from repository", async () => {
    const create = vi.fn().mockResolvedValue({ id: strategyId, lifecycleStatus: "HYPOTHESIS", confidenceLevel: "LOW" });
    vi.mocked(getStrategyRepository).mockResolvedValue({ create } as never);
    const response = await createStrategy(request("/api/strategies", {
      title: "  Study  ", contextTrigger: "  cue  ", actionProtocol: "  action  ", expectedOutcome: "  result  ",
    }));
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      title: "Study", description: undefined, contextTrigger: "cue", actionProtocol: "action", expectedOutcome: "result",
    });
    await expect(response.json()).resolves.toMatchObject({ strategy: { lifecycleStatus: "HYPOTHESIS" } });
  });

  test("detail returns 404 for a foreign or missing Strategy and never lists its evidence", async () => {
    const getContext = vi.fn().mockResolvedValue(null);
    vi.mocked(getStrategyService).mockResolvedValue({ getContext } as never);
    const response = await getStrategy(new Request(`http://localhost/api/strategies/${strategyId}`), context());
    expect(response.status).toBe(404);
    expect(getContext).toHaveBeenCalledWith(strategyId);
  });

  test("metadata PATCH rejects protocol/confidence bypass", async () => {
    const updateMetadata = vi.fn();
    vi.mocked(getStrategyRepository).mockResolvedValue({ updateMetadata } as never);
    const req = request(`/api/strategies/${strategyId}`, { title: "x", actionProtocol: "forged" });
    const response = await patchStrategy(req, context());
    expect(response.status).toBe(400);
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  test("metadata PATCH changes only supplied fields and rejects an empty patch", async () => {
    const updateMetadata = vi.fn().mockResolvedValue({ id: strategyId, title: "Renamed", description: "retained" });
    vi.mocked(getStrategyRepository).mockResolvedValue({ updateMetadata } as never);
    const response = await patchStrategy(request(`/api/strategies/${strategyId}`, { title: " Renamed " }), context());
    expect(response.status).toBe(200);
    expect(updateMetadata).toHaveBeenCalledWith(strategyId, { title: "Renamed" });
    expect((await patchStrategy(request(`/api/strategies/${strategyId}`, {}), context())).status).toBe(400);
    expect(updateMetadata).toHaveBeenCalledTimes(1);
  });

  test("support route preserves microsecond assertion and never constructs evidence locally", async () => {
    const insert = vi.fn().mockResolvedValue({ support: { id: randomUUID() }, replayed: false });
    vi.mocked(getStrategyRepository).mockResolvedValue({ insertSupport: insert } as never);
    const response = await insertSupport(request(`/api/strategies/${strategyId}/supports`, {
      observationType: "SUPPORT", sourceClass: "ACTIVITY", sourceId,
      evaluatorVersion: "v1", observedAt,
    }), context());
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(strategyId, {
      observationType: "SUPPORT", sourceClass: "ACTIVITY", sourceId,
      evaluatorVersion: "v1", note: undefined, observedAt,
    });
  });

  test("support route rejects source-class and caller timestamp forgery before RPC", async () => {
    const insert = vi.fn();
    vi.mocked(getStrategyRepository).mockResolvedValue({ insertSupport: insert } as never);
    const response = await insertSupport(request(`/api/strategies/${strategyId}/supports`, {
      observationType: "SUPPORT", sourceClass: "FREE_FORM", sourceId,
      evaluatorVersion: "v1", observedAt: "2026-09-02T12:34:56",
    }), context());
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  test("support and version reads require an owned parent Strategy", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const listSupportsMock = vi.fn();
    const listVersionsMock = vi.fn();
    vi.mocked(getStrategyRepository).mockResolvedValue({ get, listSupports: listSupportsMock, listVersions: listVersionsMock } as never);
    expect((await listSupports(new Request(`http://localhost/api/strategies/${strategyId}/supports`), context())).status).toBe(404);
    expect((await listVersions(new Request(`http://localhost/api/strategies/${strategyId}/versions`), context())).status).toBe(404);
    expect(listSupportsMock).not.toHaveBeenCalled();
    expect(listVersionsMock).not.toHaveBeenCalled();
  });

  test("version creation forwards durable key and protocol to the RPC adapter", async () => {
    const create = vi.fn().mockResolvedValue({ strategy: { id: strategyId }, version: { versionNumber: 2 }, replayed: false });
    vi.mocked(getStrategyRepository).mockResolvedValue({ createVersion: create } as never);
    const response = await createVersion(request(`/api/strategies/${strategyId}/versions`, {
      actionProtocol: "protocol 2", contextTrigger: "context", expectedOutcome: "outcome",
      changeSummary: "revision", requestIdempotencyKey: "version-2",
    }), context());
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(strategyId, expect.objectContaining({
      actionProtocol: "protocol 2", requestIdempotencyKey: "version-2",
    }));
  });

  test("evaluation defaults to non-promoting and maps insufficient confirmation to 422", async () => {
    const evaluateMock = vi.fn().mockResolvedValueOnce({ metrics: { promotionEligible: false } })
      .mockRejectedValueOnce(new StrategyRepositoryError({ message: "INSUFFICIENT_SUPPORT_FOR_PROMOTION", code: "22023" }));
    vi.mocked(getStrategyRepository).mockResolvedValue({ evaluate: evaluateMock } as never);
    expect((await evaluate(request(`/api/strategies/${strategyId}/evaluate`, {}), context())).status).toBe(200);
    expect(evaluateMock).toHaveBeenCalledWith(strategyId, false);
    const rejected = await evaluate(request(`/api/strategies/${strategyId}/evaluate`, { confirmPromotion: true }), context());
    expect(rejected.status).toBe(422);
    expect(evaluateMock).toHaveBeenCalledWith(strategyId, true);
  });

  test("transition delegates status/key and maps serialized conflict to 409", async () => {
    const transitionMock = vi.fn().mockRejectedValue(
      new StrategyRepositoryError({ message: "INVALID_STRATEGY_TRANSITION", code: "23514" }));
    vi.mocked(getStrategyRepository).mockResolvedValue({ transition: transitionMock } as never);
    const response = await transition(request(`/api/strategies/${strategyId}/transition`, {
      targetStatus: "TESTING", requestIdempotencyKey: "begin-testing",
    }), context());
    expect(response.status).toBe(409);
    expect(transitionMock).toHaveBeenCalledWith(strategyId, expect.objectContaining({
      targetStatus: "TESTING", requestIdempotencyKey: "begin-testing",
    }));
  });
});

describe("Phase 8D Round 3 — repository RPC delegation", () => {
  test("all four authority mutations call only the frozen RPC names and snake-case inputs", async () => {
    const rpc = vi.fn().mockImplementation(async (name: string) => {
      if (name === "rpc_insert_strategy_support") {
        return { data: { support: rawSupport(), replayed: false,
          evaluation: { strategy: rawStrategy(), metrics: rawMetrics(), strategy_version_id: randomUUID() } }, error: null };
      }
      if (name === "rpc_evaluate_strategy_status") {
        return { data: { strategy: rawStrategy(), metrics: rawMetrics(), strategy_version_id: randomUUID() }, error: null };
      }
      if (name === "rpc_transition_strategy_status") {
        return { data: { strategy: rawStrategy(), previous_status: "HYPOTHESIS", replayed: false }, error: null };
      }
      return { data: { strategy: rawStrategy(), version: rawVersion(), replayed: false }, error: null };
    });
    const repository = new StrategyRepository({ rpc } as never, userId);
    const support = await repository.insertSupport(strategyId, {
      observationType: "SUPPORT", sourceClass: "ACTIVITY", sourceId,
      evaluatorVersion: "v1", observedAt,
    });
    expect(support.support.observedAt).toBe(observedAt);
    expect(support.evaluation?.metrics.coreLinks).toBe(1);
    const evaluation = await repository.evaluate(strategyId, false);
    expect(evaluation.metrics.promotionEligible).toBe(false);
    const transitioned = await repository.transition(strategyId, {
      targetStatus: "TESTING", requestIdempotencyKey: "transition-1",
    });
    expect(transitioned.previousStatus).toBe("HYPOTHESIS");
    const version = await repository.createVersion(strategyId, {
      actionProtocol: "protocol 2", contextTrigger: "context", expectedOutcome: "outcome",
      requestIdempotencyKey: "version-2",
    });
    expect(version.version.versionNumber).toBe(2);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      "rpc_insert_strategy_support", "rpc_evaluate_strategy_status",
      "rpc_transition_strategy_status", "rpc_create_strategy_version",
    ]);
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_observed_at: observedAt, p_source_id: sourceId });
    expect(rpc.mock.calls[2]![1]).toMatchObject({ p_request_idempotency_key: "transition-1" });
  });

  test("malformed authoritative RPC output fails closed instead of returning an empty strategy or NaN metrics", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: {
      strategy: { ...rawStrategy(), lifecycle_status: undefined },
      metrics: rawMetrics(), strategy_version_id: randomUUID(),
    }, error: null }).mockResolvedValueOnce({ data: {
      strategy: rawStrategy(), metrics: { ...rawMetrics(), support_ratio: undefined },
      strategy_version_id: randomUUID(),
    }, error: null });
    const repository = new StrategyRepository({ rpc } as never, userId);
    await expect(repository.evaluate(strategyId, false)).rejects.toThrow();
    await expect(repository.evaluate(strategyId, false)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
