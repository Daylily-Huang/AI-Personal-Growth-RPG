// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ReviewInsightsPanel from "@/components/journey/ReviewInsightsPanel";
import ReviewsClient from "@/components/journey/ReviewsClient";
import { buildReviewSummary } from "@/lib/review-insights/summary";
import { REVIEW_SECTIONS, REVIEW_SOURCES, REVIEW_VERSION, ReviewError, type ReviewData, type ReviewPeriod, type ReviewAnalysisReceipt } from "@/lib/review-insights/types";
const mocks = vi.hoisted(() => ({ load: vi.fn(), analyze: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/review-insights/client", async original => ({ ...await original<typeof import("@/lib/review-insights/client")>(), loadReviewSummary: mocks.load, requestReviewAnalysis: mocks.analyze }));
function summary(period: ReviewPeriod, empty = false) {
  const owner = "11111111-1111-4111-8111-111111111111", id = "22222222-2222-4222-8222-222222222222";
  const data: ReviewData = { ownerId: owner, asOf: new Date().toISOString(), rows: Object.fromEntries(REVIEW_SOURCES.map(s => [s, []])) as unknown as ReviewData["rows"], coverage: REVIEW_SOURCES.map(source => ({ source, scanned: 0, complete: true })) };
  if (!empty) { data.rows.activities = [{ id, user_id: owner, created_at: new Date(Date.parse(period.start) + 1).toISOString(), title: "测试活动", status: "assessed", total_minutes: null, effective_minutes: null }]; data.coverage[0].scanned = 1; }
  return buildReviewSummary(period, data);
}
function receipt(period: ReviewPeriod): ReviewAnalysisReceipt {
  const s = summary(period), item = { text: "资料不足，建议做小范围验证。", supportingIds: [], certainty: "uncertain" as const };
  return { version: REVIEW_VERSION, model: "synthetic-model", analyzedAt: new Date().toISOString(), summary: s, analysis: { overview: "<img src=x onerror=alert(1)>只是纯文本", confidence: 0.2, ...Object.fromEntries(REVIEW_SECTIONS.map(k => [k, { ...item }])), adjustments: [{ ...item }], uncertainties: ["没有能力验证"] } as unknown as ReviewAnalysisReceipt["analysis"] };
}
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockImplementation(async period => summary(period)); mocks.analyze.mockImplementation(async period => receipt(period)); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("Daily/Weekly controlled UI", () => {
  it.each(["2025-11-02T05:30:00.123Z", "2025-11-02T06:30:00.123Z"])("actual page saves the original DST-fold instant and note unchanged: %s", async instant => {
    vi.stubEnv("TZ", "America/New_York"); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(instant));
    expect(new Date().getTimezoneOffset()).toBe(instant.includes("T05:") ? 240 : 300);
    const saves: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { saves.push(JSON.parse(String(init.body))); return new Response("{}", { status: 200 }); }
      return new Response(JSON.stringify(url === "/api/seasons" ? { seasons: [{ id: "33333333-3333-4333-8333-333333333333", name: "当前赛季", status: "ACTIVE" }] } : { reviews: [] }), { status: 200 });
    }));
    render(<ReviewsClient />); await waitFor(() => expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" })); await screen.findByTestId("review-ai-analysis"); fireEvent.click(screen.getByRole("button", { name: "采用为手动复盘草稿（不保存）" }));
    const dialog = await screen.findByRole("dialog"); expect(saves).toHaveLength(0); fireEvent.click(within(dialog).getByRole("button", { name: "确认并固化" }));
    await waitFor(() => expect(saves).toHaveLength(1)); expect(saves[0].periodEnd).toBe(instant); expect(saves[0].objectiveSummary).toMatchObject({ provenance: "USER_CONFIRMED_NOTE", reviewMode: "DAILY", summary: { period: { end: instant } } });
  });
  it("mount/mode/date/refresh only GET; AI never automatic", async () => {
    render(<ReviewInsightsPanel canAdopt={false} onAdopt={vi.fn()} />); await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("复盘类型"), { target: { value: "WEEKLY" } }); await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("复盘日期"), { target: { value: "2026-10-11" } }); await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(3));
    await waitFor(() => expect((screen.getByRole("button", { name: "刷新客观汇总" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "刷新客观汇总" })); await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(4)); expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("explicit analysis displays all required topics, plain text and noActive explanation", async () => {
    const adopt = vi.fn(); const view = render(<ReviewInsightsPanel canAdopt={false} onAdopt={adopt} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" }));
    await screen.findByTestId("review-ai-analysis"); expect(mocks.analyze).toHaveBeenCalledTimes(1); expect(screen.getByText("<img src=x onerror=alert(1)>只是纯文本")).toBeTruthy(); expect(view.container.querySelectorAll("img")).toHaveLength(0);
    for (const text of ["最大成长", "能力突破", "领域平衡", "任务效率", "XP膨胀与重复风险", "Mastery可信度", "休息与状态", "下一步行动"]) expect(screen.getByText(text)).toBeTruthy();
    expect((screen.getByRole("button", { name: "采用为手动复盘草稿（不保存）" }) as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(/当前没有ACTIVE赛季/)).toBeTruthy(); expect(adopt).not.toHaveBeenCalled();
  });
  it("empty and incomplete cannot trigger AI", async () => {
    mocks.load.mockImplementation(async p => summary(p, true)); const view = render(<ReviewInsightsPanel canAdopt onAdopt={vi.fn()} />); await screen.findByTestId("review-empty"); expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(true); view.unmount();
    mocks.load.mockImplementation(async p => { const s = summary(p); s.complete = false; s.coverage[0].complete = false; return s; }); render(<ReviewInsightsPanel canAdopt onAdopt={vi.fn()} />); await screen.findByText(/以下只是已读记录/); expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(true); expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("AI error keeps objective summary and never exposes upstream payload", async () => {
    mocks.analyze.mockRejectedValue(new ReviewError("REVIEW_AI_UNAVAILABLE")); render(<ReviewInsightsPanel canAdopt onAdopt={vi.fn()} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" })); await screen.findByRole("alert"); expect(screen.getByLabelText("客观账本汇总")).toBeTruthy(); expect(screen.queryByTestId("review-ai-analysis")).toBeNull();
  });
  it("changed period/unmount aborts stale request; old analysis cannot be adopted", async () => {
    let resolve: (v: ReviewAnalysisReceipt) => void = () => undefined; mocks.analyze.mockImplementation(() => new Promise(r => { resolve = r; }));
    const adopt = vi.fn(), view = render(<ReviewInsightsPanel canAdopt onAdopt={adopt} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" })); const [old, signal] = mocks.analyze.mock.calls[0];
    fireEvent.change(screen.getByLabelText("复盘类型"), { target: { value: "WEEKLY" } }); await waitFor(() => expect(signal.aborted).toBe(true)); resolve(receipt(old)); await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2)); expect(screen.queryByTestId("review-ai-analysis")).toBeNull(); expect(adopt).not.toHaveBeenCalled(); view.unmount(); expect(mocks.load.mock.calls.at(-1)![1].aborted).toBe(true);
  });
  it("adopt produces only USER_CONFIRMED_NOTE draft and no implicit persistence", async () => {
    const adopt = vi.fn(); render(<ReviewInsightsPanel canAdopt onAdopt={adopt} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" })); await screen.findByTestId("review-ai-analysis"); fireEvent.click(screen.getByRole("button", { name: "采用为手动复盘草稿（不保存）" }));
    expect(adopt).toHaveBeenCalledTimes(1); expect(adopt.mock.calls[0][0].objectiveSummary).toMatchObject({ provenance: "USER_CONFIRMED_NOTE", reviewMode: "DAILY" }); expect(adopt.mock.calls[0][0].reflection).toContain("待用户确认");
  });
  it("old manual save remains explicit; precise draft attached then changing period clears note", async () => {
    const saves: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { saves.push(JSON.parse(String(init.body))); return new Response("{}", { status: 200 }); }
      return new Response(JSON.stringify(url === "/api/seasons" ? { seasons: [{ id: "33333333-3333-4333-8333-333333333333", name: "当前赛季", status: "ACTIVE" }] } : { reviews: [] }), { status: 200 });
    }));
    render(<ReviewsClient />); await waitFor(() => expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" })); await screen.findByTestId("review-ai-analysis"); fireEvent.click(screen.getByRole("button", { name: "采用为手动复盘草稿（不保存）" }));
    let dialog = await screen.findByRole("dialog"); expect(saves).toHaveLength(0); fireEvent.click(within(dialog).getByRole("button", { name: "确认并固化" })); await waitFor(() => expect(saves).toHaveLength(1)); expect(saves[0]).toMatchObject({ reviewType: "AD_HOC", objectiveSummary: { provenance: "USER_CONFIRMED_NOTE", reviewMode: "DAILY" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); fireEvent.click(screen.getByRole("button", { name: "采用为手动复盘草稿（不保存）" })); dialog = await screen.findByRole("dialog"); fireEvent.change(within(dialog).getByLabelText("周期结束"), { target: { value: "2026-10-11T23:59" } }); fireEvent.click(within(dialog).getByRole("button", { name: "确认并固化" })); await waitFor(() => expect(saves).toHaveLength(2)); expect(saves[1].objectiveSummary).toEqual({});
  });
});
