// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createServer } from "node:http";
import { ProposalFactsEditor, createProposalEditMemory, type ProposalEditMemory } from "@/components/assessments/ProposalFactsEditor";
import { ProposalFactHistory } from "@/components/activities/ProposalFactHistory";
import { PendingProposals } from "@/components/dashboard/PendingProposals";
import { ProposalEditClientError } from "@/lib/proposal-edit/client";
import type { ProposalEditClientResult } from "@/lib/proposal-edit/client";
import { mockAssessment } from "@/lib/ai/assess";
import DashboardPage from "@/app/dashboard/page";
import { AppShellProvider } from "@/components/layout/AppShellContext";
import type { DashboardSnapshot } from "@/lib/store/types";
const mocks = vi.hoisted(() => ({ facts: vi.fn(), skills: vi.fn(), history: vi.fn(), submit: vi.fn(), check: vi.fn(), refresh: vi.fn(), setDashboard: vi.fn(), realShell: false, push: vi.fn(), routerRefresh: vi.fn() }));
vi.mock("@/lib/proposal-edit/client", async original => ({ ...await original<typeof import("@/lib/proposal-edit/client")>(),
  loadProposalFacts: mocks.facts, loadProposalSkills: mocks.skills, loadProposalHistory: mocks.history, submitProposalFacts: mocks.submit, checkProposalFacts: mocks.check }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.routerRefresh }) }));
vi.mock("@/components/layout/AppShellContext", async original => {
  const actual = await original<typeof import("@/components/layout/AppShellContext")>();
  return { ...actual, useOptionalAppShell: () => {
    const shell = actual.useOptionalAppShell();
    return mocks.realShell ? shell : { refreshDashboard: mocks.refresh, setDashboard: mocks.setDashboard };
  } };
});
const id = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const base = id(3), activityId = id(2);
const nativeFetch = globalThis.fetch;
const facts = () => ({ description: "修正前事实", totalMinutes: 60, effectiveMinutes: 35, relatedSkillIds: [] as string[] });
const assessment = (n = 3) => ({ id: id(n), activityId, proposal: mockAssessment({ rawInput: "学习统计", recentSimilarCount: 0 }), status: "pending" as const,
  modelName: "synthetic", promptVersion: "activity-evaluator-v0.3-context", rulesVersion: "0.1.0", confidence: 0.7, createdAt: "2026-10-11T00:00:00Z", confirmedAt: null });
function complete(input: { requestId: string; facts: ReturnType<typeof facts> }): Extract<ProposalEditClientResult, { status: "completed" }> {
  return { status: "completed", replayed: false, request: { requestId: input.requestId, activityId, baseAssessmentId: base, facts: input.facts,
    status: "completed", createdAt: "2026-10-11T00:00:00Z", expiresAt: "2026-10-11T00:03:00Z", failure: null,
    completion: { revisionId: id(6), previousRevisionId: null, createdAt: "2026-10-11T00:00:30Z", assessment: { ...assessment(7), promptVersion: "activity-evaluator-v0.4-facts" } } } };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("crypto", { randomUUID: vi.fn(() => id(100)) });
  mocks.facts.mockImplementation(async (base: string, activity: string) => ({ assessmentId: base, activityId: activity, rulesVersion: "0.1.0", currentRevision: null,
    original: { description: facts().description, descriptionTruncated: false, totalMinutes: 60, effectiveMinutes: 35 } }));
  mocks.skills.mockImplementation(async (base: string, activity: string) => ({ assessmentId: base, activityId: activity, items: [{ id: id(5), name: "统计", nameTruncated: false, masteryLevel: 8, masteryConfidence: 0.8 }], nextCursor: null }));
  mocks.history.mockResolvedValue({ activityId, items: [], nextCursor: null });
  mocks.submit.mockImplementation(async (_base, _activity, input) => complete(input)); mocks.check.mockImplementation(async (_base, _activity, input) => complete(input));
  mocks.refresh.mockResolvedValue({ ok: true, status: 200 });
  mocks.realShell = false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function editor(memory: ProposalEditMemory = { input: null, result: null }, completed = vi.fn().mockResolvedValue(true)) {
  const store = createProposalEditMemory(memory);
  const close = vi.fn(); const view = render(<ProposalFactsEditor assessmentId={base} activityId={activityId} memory={store} onClose={close} onCompleted={completed} />);
  await waitFor(() => expect(mocks.facts).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText("正在读取原始事实与技能…")).toBeNull());
  return { ...view, memory: store, close, completed };
}
describe("fact editor actual React lifecycle and request ownership", () => {
  it("native fact-only form has original details, two minute fields, clue labels and no score input", async () => {
    const view = await editor(); expect(screen.getByRole("textbox", { name: "本次完整事实描述" })).toBeTruthy();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2); expect(screen.getByRole("checkbox", { name: /统计/ })).toBeTruthy();
    expect(view.container.querySelectorAll('input[name="xp"],input[name="confidence"],input[name="mastery"]')).toHaveLength(0);
    expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.check).not.toHaveBeenCalled();
    expect(screen.getByText("原总分钟：60；原有效分钟：35")).toBeTruthy();
  });
  it("new valid facts and clue are canonicalized once; double submit cannot dispatch twice", async () => {
    const { completed, memory } = await editor(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "  实际是写作练习  " } });
    fireEvent.click(screen.getByRole("checkbox", { name: /统计/ }));
    const button = screen.getByRole("button", { name: "确认事实并请求 AI 重评" }); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1)); expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(memory.read().input?.facts).toEqual({ ...facts(), description: "实际是写作练习", relatedSkillIds: [id(5)] });
    expect(screen.getByText(/新建议已保存，尚未结算 XP/)).toBeTruthy();
  });
  it("unknown freezes the same facts/key; explicit reconciliation is GET-only", async () => {
    mocks.submit.mockRejectedValue(new ProposalEditClientError("unknown")); const { memory } = await editor();
    fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("原编号"));
    expect(screen.getByRole("textbox").closest("fieldset")?.disabled).toBe(true); const original = memory.read().input;
    fireEvent.click(screen.getByRole("button", { name: "用原编号核实结果" }));
    await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1)); expect(mocks.check.mock.calls[0][2]).toBe(original); expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
  it("known pre-dispatch invalid body unlocks editing rather than inventing an unknown persisted request", async () => {
    mocks.submit.mockRejectedValue(new ProposalEditClientError("invalid")); const { memory } = await editor();
    fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" })); await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(memory.read().input).toBeNull(); expect(screen.getByRole("textbox").closest("fieldset")?.disabled).toBe(false);
  });
  it("cross-field invalid minutes show a readable validation error before any submission", async () => {
    const view = await editor();
    fireEvent.change(screen.getByRole("spinbutton", { name: "总分钟（留空为未知）" }), { target: { value: "10" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "有效分钟（留空为未知）" }), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("有效分钟不超过总分钟"));
    expect(mocks.submit).not.toHaveBeenCalled(); expect(view.memory.read().input).toBeNull();
  });
  it("success plus refresh failure preserves receipt and cannot automatically POST again", async () => {
    const { memory } = await editor({ input: null, result: null }, vi.fn().mockRejectedValue(Error("private refresh failure")));
    fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" }));
    await waitFor(() => expect(screen.getByText(/列表刷新未完成。回执已保留/)).toBeTruthy());
    expect(memory.read().result?.status).toBe("completed"); expect(mocks.submit).toHaveBeenCalledTimes(1); expect(mocks.check).not.toHaveBeenCalled();
  });
  it("one failed initialization aborts its still-pending sibling read", async () => {
    let siblingAborted = false; mocks.facts.mockRejectedValue(new ProposalEditClientError("unavailable"));
    mocks.skills.mockImplementation((_base, _activity, _after, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => { siblingAborted = true; reject(new DOMException("Aborted", "AbortError")); }, { once: true })));
    await editor(); expect(siblingAborted).toBe(true); expect(mocks.facts.mock.calls[0][2]).toBe(mocks.skills.mock.calls[0][3]);
  });
  it("unmount aborts a pending submission and preserves original memory key", async () => {
    mocks.submit.mockImplementation((_base, _activity, _input, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })));
    const view = await editor(); fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" }));
    expect(mocks.submit).toHaveBeenCalledTimes(1); const signal = mocks.submit.mock.calls[0][3]; view.unmount();
    expect(signal.aborted).toBe(true); expect(view.memory.read().input?.requestId).toBe(id(100)); expect(view.completed).not.toHaveBeenCalled();
  });
  it("manual check only reads once and never starts another polling budget", async () => {
    mocks.submit.mockRejectedValue(new ProposalEditClientError("unknown")); const view = await editor(); fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy()); mocks.check.mockResolvedValue({ status: "in_progress", requestId: view.memory.read().input!.requestId });
    fireEvent.click(screen.getByRole("button", { name: "用原编号核实结果" })); await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1));
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
  it.each(["facts", "skills"] as const)("native fetch/socket: failing %s aborts the other already-connected owned read", async failedView => {
    const actual = await vi.importActual<typeof import("@/lib/proposal-edit/client")>("@/lib/proposal-edit/client");
    mocks.facts.mockImplementation(actual.loadProposalFacts); mocks.skills.mockImplementation(actual.loadProposalSkills);
    let count = 0, hangingClosed = false; let failedResponse: import("node:http").ServerResponse | null = null;
    const server = createServer((request, response) => {
      const view = new URL(request.url!, "http://localhost").searchParams.get("view") === "skills" ? "skills" : "facts";
      count++; if (view === failedView) failedResponse = response; else response.once("close", () => { hangingClosed = true; });
      if (count === 2) { failedResponse!.writeHead(500, { "Content-Type": "application/json" }); failedResponse!.end('{"error":"synthetic failure"}'); }
    });
    try {
      await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address();
      if (!address || typeof address === "string") throw Error("synthetic listener missing");
      vi.stubGlobal("fetch", (url: string, init: RequestInit) => nativeFetch(new URL(String(url), `http://127.0.0.1:${address.port}`), init));
      const view = await editor(); await waitFor(() => expect(hangingClosed).toBe(true)); expect(count).toBe(2);
      expect(mocks.facts.mock.calls[0][2].aborted).toBe(true); expect(mocks.skills.mock.calls[0][3].aborted).toBe(true); view.unmount();
    } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
  it("auto polling stops at60s/at most20 GETs then offers original-key manual check", async () => {
    const view = await editor(); vi.useFakeTimers();
    mocks.submit.mockResolvedValue({ status: "in_progress", requestId: id(100) }); mocks.check.mockResolvedValue({ status: "in_progress", requestId: id(100) });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" })); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60001); });
    expect(mocks.check.mock.calls.length).toBeGreaterThan(0); expect(mocks.check.mock.calls.length).toBeLessThanOrEqual(20);
    expect(mocks.submit).toHaveBeenCalledTimes(1); expect(mocks.submit.mock.calls[0][3].aborted).toBe(true); expect(view.memory.read().input?.requestId).toBe(id(100));
  });
});
describe("explicit history and per-item pending integration", () => {
  it("closed history performs no GET; opening reads once and closing aborts its owned request", async () => {
    const view = render(<ProposalFactHistory activityId={activityId} />); expect(mocks.history).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "查看修正历史" })); await waitFor(() => expect(mocks.history).toHaveBeenCalledTimes(1));
    expect(mocks.history.mock.calls[0][0]).toBe(activityId); fireEvent.click(screen.getByRole("button", { name: "关闭修正历史" }));
    expect(mocks.history.mock.calls[0][2].aborted).toBe(true); view.unmount();
  });
  it("history displays complete facts and three provenance labels without proposal JSON", async () => {
    mocks.history.mockResolvedValue({ activityId, nextCursor: null, items: [{ id: id(6), requestId: id(100), activityId, baseAssessmentId: base, resultAssessmentId: id(7), previousRevisionId: null,
      rulesVersion: "0.1.0", promptVersion: "activity-evaluator-v0.4-facts", modelName: "synthetic", assessmentStatus: "pending", createdAt: "2026-10-11T00:00:30Z", facts: facts() }] });
    render(<ProposalFactHistory activityId={activityId} />); fireEvent.click(screen.getByRole("button", { name: "查看修正历史" }));
    await waitFor(() => expect(screen.getByText(facts().description)).toBeTruthy()); expect(screen.getByText(/来源模型：synthetic；提示词：activity-evaluator-v0.4-facts；规则：0.1.0/)).toBeTruthy();
  });
  it("editing locks only its own Confirm/Reject and returns native focus on close", async () => {
    const confirm = vi.fn(); render(<PendingProposals assessments={[assessment(3), assessment(8)]} confirmingId={null} onConfirm={confirm} />);
    expect(mocks.facts).not.toHaveBeenCalled(); const buttons = screen.getAllByRole("button", { name: "修正事实" }); fireEvent.click(buttons[0]);
    await waitFor(() => expect(mocks.facts).toHaveBeenCalledTimes(1));
    const confirmFirst = screen.getByTestId(`confirm-assessment-btn-${base}`) as HTMLButtonElement;
    const confirmOther = screen.getByTestId(`confirm-assessment-btn-${id(8)}`) as HTMLButtonElement;
    expect(confirmFirst.disabled).toBe(true); expect(confirmOther.disabled).toBe(false); fireEvent.click(confirmOther); expect(confirm).toHaveBeenCalledExactlyOnceWith(id(8), undefined);
    fireEvent.click(screen.getByRole("button", { name: /取消并关闭/ })); await waitFor(() => expect(document.activeElement).toBe(buttons[0])); expect(confirmFirst.disabled).toBe(false);
  });
  it("replacement retires old proposal even when dashboard refresh fails; closing preserves receipt", async () => {
    const refresh = vi.fn().mockResolvedValue(new Response(null, { status: 503 })); vi.stubGlobal("fetch", refresh); const confirm = vi.fn();
    render(<PendingProposals assessments={[assessment()]} confirmingId={null} onConfirm={confirm} />); fireEvent.click(screen.getByRole("button", { name: "修正事实" }));
    await waitFor(() => expect(screen.queryByText("正在读取原始事实与技能…")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" })); await waitFor(() => expect(screen.getByText(/列表刷新未完成。回执已保留/)).toBeTruthy());
    expect(refresh).toHaveBeenCalledTimes(1); expect(mocks.refresh).not.toHaveBeenCalled(); expect(mocks.setDashboard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "关闭重评结果" }));
    expect((screen.getByTestId(`confirm-assessment-btn-${base}`) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "查看重评回执" }));
    expect(screen.getByText(/新建议已保存，尚未结算 XP/)).toBeTruthy(); expect(mocks.submit).toHaveBeenCalledTimes(1); expect(confirm).not.toHaveBeenCalled();
  });
  it("actual DashboardPage and AppShell retain the editor receipt after a503 refresh", async () => {
    mocks.realShell = true;
    const dashboard: DashboardSnapshot = { player: { totalXp: 500, playerLevel: 4, energy: 70, focus: 60, momentum: 30 },
      levelProgress: { xpIntoLevel: 0, xpNeededForNext: 100, progress: 0 }, skills: [], recentGrowth: [], activities: [],
      pendingAssessments: [assessment()], pendingMasteryVerifications: [], quests: [], mainQuest: null, activeQuests: [] };
    const refresh = vi.fn().mockResolvedValue(new Response(null, { status: 503 })); vi.stubGlobal("fetch", refresh);
    render(<AppShellProvider initialDashboard={dashboard} initialUserEmail="synthetic@example.invalid"><DashboardPage /></AppShellProvider>);
    fireEvent.click(screen.getByRole("button", { name: "修正事实" }));
    await waitFor(() => expect(screen.queryByText("正在读取原始事实与技能…")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" }));
    await waitFor(() => expect(screen.getByText(/列表刷新未完成。回执已保留/)).toBeTruthy());
    expect(refresh).toHaveBeenCalledTimes(1); expect(refresh.mock.calls[0][0]).toBe("/api/dashboard");
    expect((screen.getByTestId(`confirm-assessment-btn-${base}`) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("dashboard-player-hero")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭重评结果" })); fireEvent.click(screen.getByRole("button", { name: "查看重评回执" }));
    expect(screen.getByText(/新建议已保存，尚未结算 XP/)).toBeTruthy(); expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
  it.each(["close", "unmount"] as const)("owned dashboard read aborts on editor %s and cannot publish a late snapshot", async kind => {
    let resolve!: (response: Response) => void;
    const refresh = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal("fetch", refresh);
    const view = render(<PendingProposals assessments={[assessment()]} confirmingId={null} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "修正事实" }));
    await waitFor(() => expect(screen.queryByText("正在读取原始事实与技能…")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "确认事实并请求 AI 重评" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1)); const signal = refresh.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    if (kind === "close") fireEvent.click(screen.getByRole("button", { name: "关闭重评结果" })); else view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(new Response(JSON.stringify({ dashboard: { late: true } }), { status: 200 })); });
    expect(mocks.setDashboard).not.toHaveBeenCalled(); expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
});
