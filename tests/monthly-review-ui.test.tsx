// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ReviewInsightsPanel from "@/components/journey/ReviewInsightsPanel";
import ReviewsClient from "@/components/journey/ReviewsClient";
import { buildReviewSummary } from "@/lib/review-insights/summary";
import { previousReviewMonth, withMonthlyComparison } from "@/lib/review-insights/monthly";
import { REVIEW_SECTIONS, REVIEW_SOURCES, type ReviewAnalysisReceipt, type ReviewData, type ReviewPeriod } from "@/lib/review-insights/types";

const mocks = vi.hoisted(() => ({ load: vi.fn(), analyze: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/review-insights/client", async original => ({ ...await original<typeof import("@/lib/review-insights/client")>(), loadReviewSummary: mocks.load, requestReviewAnalysis: mocks.analyze }));
function summary(period: ReviewPeriod) {
  const owner = "11111111-1111-4111-8111-111111111111", id = "22222222-2222-4222-8222-222222222222";
  const rows = Object.fromEntries(REVIEW_SOURCES.map(s => [s, []])) as unknown as ReviewData["rows"];
  rows.activities = [{ id, user_id: owner, created_at: new Date(Date.parse(period.start) + 1).toISOString(), title: "真实记录", status: "confirmed", total_minutes: null, effective_minutes: null }];
  const data = { ownerId: owner, asOf: new Date().toISOString(), rows, coverage: REVIEW_SOURCES.map(source => ({ source, scanned: rows[source].length, complete: true })) };
  const current = buildReviewSummary(period, data);
  if (period.mode !== "MONTHLY") return current;
  const previous = previousReviewMonth(period), priorRows = { ...rows, activities: [{ ...rows.activities[0], created_at: new Date(Date.parse(previous.start) + 1).toISOString() }] };
  return withMonthlyComparison(current, buildReviewSummary(previous, { ...data, rows: priorRows }));
}
function receipt(period: ReviewPeriod): ReviewAnalysisReceipt {
  const s = summary(period), finding = { text: "整理可核实作品", supportingIds: [], certainty: "uncertain" as const };
  return { version: s.version, model: "synthetic", analyzedAt: new Date().toISOString(), summary: s, analysis: { overview: "当前两期缺少可比验证，能力变化未知", confidence: 0.2, ...Object.fromEntries(REVIEW_SECTIONS.map(k => [k, finding])), adjustments: [finding], uncertainties: ["两期时长可能不同"] } as unknown as ReviewAnalysisReceipt["analysis"] };
}
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockImplementation(async p => summary(p)); mocks.analyze.mockImplementation(async p => receipt(p)); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Monthly report reuses existing review flow", () => {
  it("server markup does not bake in its clock or timezone before hydration", () => {
    const html = renderToString(<ReviewInsightsPanel canAdopt={false} onAdopt={vi.fn()} />);
    expect(html).toContain('type="date"');
    expect(html).toContain('value=""');
    expect(html).not.toContain("（不含结束时刻）；时区");
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("selecting month only loads objective comparison; AI requires a separate click", async () => {
    render(<ReviewInsightsPanel canAdopt={false} onAdopt={vi.fn()} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("复盘类型"), { target: { value: "MONTHLY" } });
    await screen.findByRole("region", { name: "月度成长对照" });
    expect(mocks.analyze).not.toHaveBeenCalled(); expect(screen.getByText(/差值是记录变化，不是能力增长率/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" })); await screen.findByTestId("review-ai-analysis");
    expect(mocks.analyze.mock.calls[0][0].mode).toBe("MONTHLY");
  });
  it("incomplete previous month hides deltas and disables monthly AI", async () => {
    mocks.load.mockImplementation(async p => { const s = summary(p); if (s.comparison) { s.comparison.previous.complete = false; s.comparison.previous.coverage[0].complete = false; } return s; });
    render(<ReviewInsightsPanel canAdopt={false} onAdopt={vi.fn()} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1)); fireEvent.change(screen.getByLabelText("复盘类型"), { target: { value: "MONTHLY" } });
    await screen.findByText(/两期至少一期来源不完整/); expect((screen.getByRole("button", { name: "生成AI复盘" }) as HTMLButtonElement).disabled).toBe(true); expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("monthly adoption preserves MONTHLY provenance and full comparison, saving only after confirmation", async () => {
    const saves: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { saves.push(JSON.parse(String(init.body))); return new Response("{}", { status: 200 }); }
      return new Response(JSON.stringify(url === "/api/seasons" ? { seasons: [{ id: "33333333-3333-4333-8333-333333333333", name: "当前赛季", status: "ACTIVE" }] } : { reviews: [] }), { status: 200 });
    }));
    render(<ReviewsClient />); await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("复盘类型"), { target: { value: "MONTHLY" } }); await screen.findByRole("region", { name: "月度成长对照" });
    fireEvent.click(screen.getByRole("button", { name: "生成AI复盘" })); await screen.findByTestId("review-ai-analysis");
    fireEvent.click(screen.getByRole("button", { name: "采用为手动复盘草稿（不保存）" })); const dialog = await screen.findByRole("dialog"); expect(saves).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "确认并固化" })); await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({ reviewType: "AD_HOC", objectiveSummary: { reviewMode: "MONTHLY", summary: { comparison: { previous: { period: { mode: "MONTHLY" } } } } } });
  });
});
