// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Assessment } from "@/lib/store/types";
const m = vi.hoisted(() => ({ push: vi.fn(), fetch: vi.fn(), shell: null as unknown }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/components/layout/AppShellContext", () => ({ useOptionalAppShell: () => m.shell }));
import { PendingProposals } from "@/components/dashboard/PendingProposals";
import { rejectProposal } from "@/lib/assessments/rejection-client";
const id = "00000000-0000-4000-8000-000000000001", activityId = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
function assessment(target = id): Assessment {
  return { id: target, activityId, status: "pending", modelName: "synthetic", confidence: 0.8,
    proposal: { activity: { type: "learning" }, evidence: { level: 1, explanation: "合成证据说明" },
      affected_skills: [{ name: "测试技能", reason: "学习" }], mastery_changes: [], uncertainty_notes: [],
      xp_semantics: { base_value: 1, difficulty: 0.5, novelty: 0.5, repetition_risk: "low" }, artifactProposals: [] },
  } as unknown as Assessment;
}
const receipt = (status: unknown = "rejected") => ({ assessment: { id, activityId, status } });
const response = (value = receipt(), status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function view(items = [assessment()], onConfirm = vi.fn()) { return render(<PendingProposals assessments={items} confirmingId={null} onConfirm={onConfirm} />); }
function ask() { fireEvent.click(screen.getAllByRole("button", { name: "拒绝提案" })[0]); }
const submit = () => fireEvent.click(screen.getByRole("button", { name: "确定拒绝" }));
beforeEach(() => { vi.clearAllMocks(); m.shell = null; m.fetch.mockResolvedValue(response()); vi.stubGlobal("fetch", m.fetch); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Actual rejection component and client transport", () => {
  test("opening and cancelling are read-only; warning is explicit", () => {
    view(); ask(); expect(screen.getByText(/不删除原活动/)).toBeTruthy(); expect(m.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消拒绝" })); expect(screen.queryByRole("button", { name: "确定拒绝" })).toBeNull(); expect(m.fetch).not.toHaveBeenCalled();
  });
  test("one proven receipt removes pending and retains success even when empty", async () => {
    const refreshDashboard = vi.fn().mockResolvedValue({ ok: true }); m.shell = { refreshDashboard };
    const ui = view(); ask(); submit();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("评估已拒绝"));
    expect(screen.queryByRole("button", { name: "拒绝提案" })).toBeNull(); expect(screen.getByText("共 0 项")).toBeTruthy();
    expect(m.fetch).toHaveBeenCalledTimes(1); expect(m.fetch.mock.calls[0][0]).toBe(`/api/assessments/${id}/reject`);
    expect(m.fetch.mock.calls[0][1]).toMatchObject({ method: "POST", body: "{}", credentials: "same-origin", cache: "no-store" });
    expect(refreshDashboard).toHaveBeenCalledTimes(1);
    ui.rerender(<PendingProposals assessments={[]} confirmingId={null} onConfirm={vi.fn()} />); expect(screen.getByRole("status").textContent).toContain("评估历史保留");
  });
  test("reject locks this item and repeat dispatch, not another item", async () => {
    const pending = deferred<Response>(); m.fetch.mockReturnValue(pending.promise); const confirm = vi.fn(); view([assessment(), assessment(other)], confirm); ask(); submit();
    const confirmButtons = screen.getAllByRole("button", { name: "确认并结算" });
    expect((confirmButtons[0] as HTMLButtonElement).disabled).toBe(true); expect((confirmButtons[1] as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "拒绝中…" })); expect(m.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(confirmButtons[1]); expect(confirm).toHaveBeenCalledWith(other, undefined);
    await act(async () => { pending.resolve(response()); });
  });
  test("existing Confirm tuple unchanged and own reject disabled until it ends", async () => {
    const pending = deferred<void>(), confirm = vi.fn(() => pending.promise); view([assessment()], confirm); fireEvent.click(screen.getByRole("button", { name: "确认并结算" }));
    expect(confirm).toHaveBeenCalledExactlyOnceWith(id, undefined); expect((screen.getByRole("button", { name: "拒绝提案" }) as HTMLButtonElement).disabled).toBe(true); expect(m.fetch).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(); });
    expect((screen.getByRole("button", { name: "拒绝提案" }) as HTMLButtonElement).disabled).toBe(false);
  });
  test("unexpected Confirm rejection is handled without unhandled promise", async () => {
    view([assessment()], vi.fn().mockRejectedValue(Error("PRIVATE_CONFIRM_ERROR"))); fireEvent.click(screen.getByRole("button", { name: "确认并结算" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("确认未完成")); expect(screen.getByRole("alert").textContent).not.toContain("PRIVATE_CONFIRM_ERROR");
  });
  test.each([400, 404, 500, 503])("HTTP%s retains proposal and permits retry, not success", async status => {
    m.fetch.mockResolvedValue(response(receipt(), status)); view(); ask(); submit();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy()); expect(screen.queryByRole("status")).toBeNull(); expect(screen.getByRole("button", { name: "确定拒绝" })).toBeTruthy();
  });
  test("401 redirects only to fixed login and does not dismiss", async () => {
    m.fetch.mockResolvedValue(response(receipt(), 401)); view(); ask(); submit(); await waitFor(() => expect(m.push).toHaveBeenCalledExactlyOnceWith("/login")); expect(screen.queryByRole("status")).toBeNull();
  });
  test("409 refreshes but never claims rejected", async () => {
    const refreshDashboard = vi.fn().mockResolvedValue({ ok: true }); m.shell = { refreshDashboard }; m.fetch.mockResolvedValue(response(receipt(), 409)); view(); ask(); submit();
    await waitFor(() => expect(refreshDashboard).toHaveBeenCalledTimes(1)); expect(screen.getByRole("status").textContent).toContain("未执行拒绝");
  });
  test("accepted write with failed refresh is explicitly distinguished", async () => {
    m.shell = { refreshDashboard: vi.fn().mockResolvedValue({ ok: false, status: 500 }) }; view(); ask(); submit();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("列表刷新未完成")); expect(screen.getByRole("status").textContent).toContain("评估已拒绝");
  });
  test.each([undefined, null, "active", "confirmed", "pending", "constructor"])("raw receipt status%s never defaults to rejected", async status => {
    m.fetch.mockResolvedValue(response({ assessment: { id, activityId, status } })); view(); ask(); submit(); await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy()); expect(screen.queryByRole("status")).toBeNull();
  });
  test("removed item aborts its request; late response cannot remove a new proposal", async () => {
    const pending = deferred<Response>(); m.fetch.mockReturnValue(pending.promise); const ui = view(); ask(); submit(); const signal = m.fetch.mock.calls[0][1].signal;
    ui.rerender(<PendingProposals assessments={[assessment(other)]} confirmingId={null} onConfirm={vi.fn()} />); expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve(response()); }); expect(screen.getByText("共 1 项")).toBeTruthy(); expect(screen.queryByRole("status")).toBeNull();
  });
  test("unmount aborts task-owned fetch", async () => {
    const pending = deferred<Response>(); m.fetch.mockReturnValue(pending.promise); const ui = view(); ask(); submit(); const signal = m.fetch.mock.calls[0][1].signal;
    ui.unmount(); expect(signal.aborted).toBe(true); await act(async () => { pending.resolve(response()); });
  });
  test("plain empty list remains empty and makes no request", () => { const ui = view([]); expect(ui.container.textContent).toBe(""); expect(m.fetch).not.toHaveBeenCalled(); });
  test.each(["id", "activityId"])("mismatched %s receipt fails closed", async key => {
    m.fetch.mockResolvedValue(response({ assessment: { ...receipt().assessment, [key]: other } })); await expect(rejectProposal(id, activityId, new AbortController().signal)).rejects.toThrow("有效拒绝回执");
  });
  test("inherited receipt fields fail closed", async () => {
    m.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ assessment: Object.create(receipt().assessment) }) });
    await expect(rejectProposal(id, activityId, new AbortController().signal)).rejects.toThrow("有效拒绝回执");
  });
});
