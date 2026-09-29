// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PlaybookPage from "@/app/journey/playbook/page";
import { JourneyNav } from "@/components/journey/JourneyNav";
import type { Strategy, StrategyContext } from "@/lib/strategy/types";
import type { StrategyProposalPreview } from "@/lib/strategy/discovery";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/journey/playbook",
  useRouter: () => ({ push: routerPush }),
}));

const id = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const secondSourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const proposalId = "33333333-3333-4333-8333-333333333333";
const observedAt = "2026-09-29T12:34:56.123456+00:00";
const strategy: Strategy = {
  id, userId: "44444444-4444-4444-8444-444444444444", title: "深度工作",
  description: "在明确边界内测试", contextTrigger: "开始写作前", actionProtocol: "关掉通知",
  expectedOutcome: "完成一节草稿", lifecycleStatus: "TESTING", confidenceLevel: "LOW",
  version: 1, createdAt: observedAt, updatedAt: observedAt,
};
const context: StrategyContext = {
  strategy,
  versions: [{ id: "55555555-5555-4555-8555-555555555555", userId: strategy.userId, strategyId: id,
    versionNumber: 1, actionProtocol: strategy.actionProtocol, contextTrigger: strategy.contextTrigger,
    expectedOutcome: strategy.expectedOutcome, createdAt: observedAt }],
  supports: [],
};
const proposal: StrategyProposalPreview = {
  id: proposalId, proposalType: "STRATEGY_COUNTEREVIDENCE_ALERT", status: "PROPOSED",
  payload: { strategy_id: id, counter_evidence_activity_id: sourceId,
    observation: "可能与预期不符", recommended_action: "核对原始活动" },
  sourceRefs: [{ source_id: sourceId }], createdAt: observedAt, expiresAt: "2099-01-01T00:00:00Z",
};

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

describe("Phase 8D Round 4 Playbook UI", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let currentProposals: StrategyProposalPreview[];
  beforeEach(() => {
    routerPush.mockReset();
    currentProposals = [proposal];
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/strategies" && init?.method === "POST") return response({ strategy }, 201);
      if (url === "/api/strategies") return response({ strategies: [strategy] });
      if (url === `/api/strategies/${id}`) return response(context);
      if (url === "/api/strategies/proposals") return response({ proposals: currentProposals });
      if (url.startsWith("/api/strategies/sources?")) return response({ sources: [{ id: new URL(url, "http://localhost").searchParams.get("id") ?? sourceId,
        sourceClass: url.includes("sourceClass=ACTIVITY") ? "ACTIVITY" : "JOURNAL_CONTEXT",
        label: "一条原始记录", observedAt, details: url.includes("&id=") ? "原始活动全文" : null }] });
      if (url.endsWith("/evaluate")) return response({ strategy, metrics: {
        supportCount: 4, counterEvidenceCount: 0, distinctObservationDates: 4,
        completedSeasons: 1, coreLinks: 2, supportRatio: 1,
        confidenceLevel: "HIGH", promotionEligible: true,
      }, strategyVersionId: context.versions[0].id });
      if (url.endsWith("/supports")) return response({ support: {}, replayed: false }, 201);
      if (url.endsWith("/versions")) return response({ strategy, version: {}, replayed: false }, 201);
      if (url.endsWith("/transition")) return response({ strategy });
      if (url.includes("/outer-loop/proposals/")) return response({ result: {} });
      return response({ error: "Missing mock" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "66666666-6666-4666-8666-666666666666" });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  test("navigation exposes Playbook and detail shows server-derived status", async () => {
    render(<JourneyNav />);
    expect(screen.getByRole("link", { name: "策略手册" }).getAttribute("aria-current")).toBe("page");
    cleanup();
    render(<PlaybookPage />);
    expect(await screen.findByText(/派生置信度：低/)).toBeTruthy();
    expect(screen.getByText(/不会自动晋升/)).toBeTruthy();
  });

  test("evaluation is non-promoting until an explicit second confirmation", async () => {
    render(<PlaybookPage />);
    fireEvent.click(await screen.findByRole("button", { name: "重新评估证据" }));
    await screen.findByRole("button", { name: "确认晋升为获支持" });
    const evaluations = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/evaluate"));
    expect(JSON.parse(evaluations[0][1].body)).toEqual({ confirmPromotion: false });
    fireEvent.click(screen.getByRole("button", { name: "确认晋升为获支持" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/evaluate"))).toHaveLength(2));
    expect(JSON.parse(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/evaluate"))[1][1].body)).toEqual({ confirmPromotion: true });
  });

  test("support uses source ID and exact six-digit timestamp without Date conversion", async () => {
    render(<PlaybookPage />);
    await screen.findByText(/派生置信度：低/);
    fireEvent.change(screen.getByLabelText("来源记录 UUID"), { target: { value: sourceId } });
    fireEvent.change(screen.getByLabelText("来源原始时间戳"), { target: { value: observedAt } });
    fireEvent.click(screen.getByRole("button", { name: "单独记录支持" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/supports") && init?.method === "POST")).toBe(true));
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/supports"));
    expect(JSON.parse(call![1].body)).toMatchObject({ sourceId, observedAt, observationType: "SUPPORT" });
  });

  test("journal picker copies canonical source identity and timestamp verbatim", async () => {
    render(<PlaybookPage />);
    await screen.findByText(/派生置信度：低/);
    fireEvent.click(screen.getByRole("button", { name: "读取我的近期日志情境来源" }));
    const select = await screen.findByLabelText("选择原始来源");
    fireEvent.change(select, { target: { value: sourceId } });
    expect((screen.getByLabelText("来源记录 UUID") as HTMLInputElement).value).toBe(sourceId);
    expect((screen.getByLabelText("来源原始时间戳") as HTMLInputElement).value).toBe(observedAt);
  });

  test("old-version evidence is visible only as history and not counted as current", async () => {
    const oldSupport = {
      id: "77777777-7777-4777-8777-777777777777", userId: strategy.userId, strategyId: id,
      strategyVersionId: context.versions[0].id, observationType: "SUPPORT" as const,
      sourceClass: "JOURNAL_CONTEXT" as const, sourceId, evaluatorVersion: "playbook-ui-v1",
      note: "旧方案的观察", observedAt, createdAt: observedAt,
    };
    const revisedStrategy = { ...strategy, version: 2, confidenceLevel: "LOW" as const };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/strategies/proposals") return response({ proposals: [] });
      if (url === "/api/strategies") return response({ strategies: [revisedStrategy] });
      if (url === `/api/strategies/${id}`) return response({ strategy: revisedStrategy,
        versions: [...context.versions, { ...context.versions[0], id: "88888888-8888-4888-8888-888888888888", versionNumber: 2 }],
        supports: [oldSupport],
      });
      return response({}, 404);
    });
    render(<PlaybookPage />);
    expect(await screen.findByText("当前版本暂无支持或反证记录。")).toBeTruthy();
    fireEvent.click(screen.getByText(/查看历史版本证据/));
    expect(screen.getByText("旧方案的观察")).toBeTruthy();
  });

  test("acknowledging counter-evidence alert never posts a support", async () => {
    render(<PlaybookPage />);
    await screen.findByText(/派生置信度：低/);
    fireEvent.click(await screen.findByRole("button", { name: /反证警报.*33333333/ }));
    expect(screen.getByText(/可能与预期不符/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("审核决定"), { target: { value: "ACCEPTED" } });
    fireEvent.click(screen.getByRole("button", { name: "提交提案审核" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "请先按 ID 核对提案引用的每条原始活动，再确认审核");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/outer-loop/proposals/"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "按 ID 核对原始活动" }));
    await screen.findByText(/已核对：一条原始记录/);
    expect(screen.getByText("原始活动全文")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === `/api/strategies/sources?sourceClass=ACTIVITY&id=${sourceId}`)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "提交提案审核" }));
    await screen.findByText(/警报已审核；这不会记录反证/);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/supports"))).toBe(false);
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/outer-loop/proposals/"));
    expect(JSON.parse(call![1].body)).toMatchObject({ decision: "ACCEPTED" });
  });

  test("edited proposal review submits the inspected payload through existing CAS only", async () => {
    render(<PlaybookPage />);
    fireEvent.click(await screen.findByRole("button", { name: /反证警报.*33333333/ }));
    expect(screen.getByText(/可能与预期不符/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("审核决定"), { target: { value: "EDITED" } });
    fireEvent.change(screen.getByLabelText("编辑后的完整提案 JSON"), { target: { value: JSON.stringify({ ...proposal.payload, observation: "修订说明" }) } });
    fireEvent.click(screen.getByRole("button", { name: "按 ID 核对原始活动" }));
    await screen.findByText(/已核对：一条原始记录/);
    fireEvent.click(screen.getByRole("button", { name: "提交提案审核" }));
    await screen.findByText(/警报已审核；这不会记录反证/);
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/outer-loop/proposals/"));
    expect(JSON.parse(call![1].body)).toMatchObject({ decision: "EDITED", editedPayload: { observation: "修订说明" } });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/supports"))).toBe(false);
  });

  test("changing an edited alert's activity ID requires a new exact-source check", async () => {
    render(<PlaybookPage />);
    fireEvent.click(await screen.findByRole("button", { name: /反证警报.*33333333/ }));
    fireEvent.click(screen.getByRole("button", { name: "按 ID 核对原始活动" }));
    await screen.findByText(/已核对：一条原始记录/);
    fireEvent.change(screen.getByLabelText("审核决定"), { target: { value: "EDITED" } });
    fireEvent.change(screen.getByLabelText("编辑后的完整提案 JSON"), { target: { value: JSON.stringify({
      ...proposal.payload, counter_evidence_activity_id: "99999999-9999-4999-8999-999999999999",
    }) } });
    fireEvent.click(screen.getByRole("button", { name: "提交提案审核" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "请先按 ID 核对提案引用的每条原始活动，再确认审核");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/outer-loop/proposals/"))).toBe(false);
  });

  test("hypothesis with two supporting activities requires both exact-source checks", async () => {
    currentProposals = [{ ...proposal, proposalType: "STRATEGY_HYPOTHESIS", payload: {
      title: "新的策略假设", context_trigger: "研究开始时", action_protocol: "先列问题",
      expected_outcome: "找到可检验结论", supporting_activity_ids: [sourceId, secondSourceId],
    } }];
    render(<PlaybookPage />);
    fireEvent.click(await screen.findByRole("button", { name: /策略假设.*33333333/ }));
    fireEvent.change(screen.getByLabelText("审核决定"), { target: { value: "ACCEPTED" } });
    let checks = screen.getAllByRole("button", { name: "按 ID 核对原始活动" });
    expect(checks).toHaveLength(2);
    fireEvent.click(checks[0]);
    await waitFor(() => expect(screen.getAllByText(/已核对：一条原始记录/)).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "提交提案审核" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "请先按 ID 核对提案引用的每条原始活动，再确认审核");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/outer-loop/proposals/"))).toBe(false);
    checks = screen.getAllByRole("button", { name: "按 ID 核对原始活动" });
    fireEvent.click(checks[1]);
    await waitFor(() => expect(screen.getAllByText(/已核对：一条原始记录/)).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "提交提案审核" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/outer-loop/proposals/"))).toBe(true));
  });
});
