import { describe, expect, it, vi, afterEach } from "vitest";
import { localReviewPeriod, matchingReviewDraftPeriod, reviewDraft, reviewDraftInputTime } from "@/lib/review-insights/client";
import { previousReviewMonth, reviewMonthStart, withMonthlyComparison } from "@/lib/review-insights/monthly";
import { buildReviewSummary } from "@/lib/review-insights/summary";
import { parseReviewPeriod, parseReviewReceipt, parseReviewSummary } from "@/lib/review-insights/validation";
import { prepareReviewPrompt } from "@/lib/review-insights/ai";
import { REVIEW_SOURCES, REVIEW_SECTIONS, type ReviewData, type ReviewPeriod, type ReviewAnalysisReceipt } from "@/lib/review-insights/types";
import { ReviewInsightsRepository, type ReviewReadClient } from "@/lib/review-insights/repository";

const now = new Date("2026-10-15T10:00:00.000Z"), owner = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const month: ReviewPeriod = { mode: "MONTHLY", start: "2026-10-01T00:00:00.000Z", end: now.toISOString(), timezone: "UTC" };
function summary(period = month, n = 1, amount = 10) {
  const rows = Object.fromEntries(REVIEW_SOURCES.map(s => [s, []])) as unknown as ReviewData["rows"];
  const created_at = new Date(Date.parse(period.start) + 1).toISOString();
  rows.activities = [{ id: id(n), user_id: owner, created_at, title: "可追溯活动", status: "confirmed", total_minutes: null, effective_minutes: null }];
  rows.xp_transactions = [{ id: id(n + 100), user_id: owner, created_at, activity_id: id(n), skill_id: null, domain_id: null, amount, xp_type: amount < 0 ? "correction" : "activity", repetition_count: 0, repetition_penalty: 1 }];
  return buildReviewSummary(period, { ownerId: owner, asOf: now.toISOString(), rows, coverage: REVIEW_SOURCES.map(source => ({ source, scanned: rows[source].length, complete: true })) });
}
const pair = () => withMonthlyComparison(summary(), summary(previousReviewMonth(month), 2, -5));
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("Monthly calendar windows and honest comparison", () => {
  it.each([
    [2024, 1, "UTC", "2024-02-01T00:00:00.000Z"],
    [2026, 9, "Asia/Singapore", "2026-09-30T16:00:00.000Z"],
    [2026, 10, "America/New_York", "2026-11-01T04:00:00.000Z"],
    [2020, 10, "America/Havana", "2020-11-01T04:00:00.000Z"],
    [2026, 0, "Pacific/Kiritimati", "2025-12-31T10:00:00.000Z"],
  ])("finds first real month instant %s/%s %s", (year, monthIndex, zone, expected) => expect(reviewMonthStart(year, monthIndex, zone)).toBe(expected));
  it("leap February and year rollover use natural calendar boundaries", () => {
    const p = { ...month, start: "2024-03-01T00:00:00.000Z", end: "2024-04-01T00:00:00.000Z" };
    expect(previousReviewMonth(p).start).toBe("2024-02-01T00:00:00.000Z");
    expect(previousReviewMonth({ ...month, start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" }).start).toBe("2025-12-01T00:00:00.000Z");
  });
  it("31-day fall-back month permits 745 hours, but refuses arbitrary or multi-month windows", () => {
    const p = { ...month, start: "2026-09-30T23:00:00.000Z", end: "2026-11-01T00:00:00.000Z", timezone: "Europe/London" };
    expect(parseReviewPeriod(p, new Date("2026-12-02"))).toEqual(p);
    for (const delta of [{ start: "2026-10-02T00:00:00.000Z" }, { end: "2026-11-02T00:00:00.000Z" }]) expect(() => parseReviewPeriod({ ...month, ...delta }, new Date("2026-12-02"))).toThrow("REVIEW_INVALID_INPUT");
  });
  it("local picker clips month-to-date and retains calendar-month start", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(localReviewPeriod("2026-10-15", "MONTHLY", now)).toMatchObject({ start: "2026-10-01T04:00:00.000Z", end: now.toISOString() });
    expect(localReviewPeriod("2024-02-14", "MONTHLY", now)).toMatchObject({ start: "2024-02-01T05:00:00.000Z", end: "2024-03-01T05:00:00.000Z" });
  });
  it("keeps signed corrections, exact counts and incomplete-month warning; never rates ability", () => {
    const s = parseReviewSummary(pair());
    expect(s.version).toBe("monthly-review-v1"); expect(s.xp.net).toBe(10); expect(s.comparison?.previous.xp.net).toBe(-5); expect(s.comparison?.partialCurrent).toBe(true);
    const p = prepareReviewPrompt(s); expect(p.messages[0].content).toContain("不能作同比增长率或能力排名");
    expect(() => withMonthlyComparison(s, summary())).toThrow("REVIEW_MALFORMED_DATA");
  });
  it("either month's truncation disables AI and missing comparison cannot be a valid receipt", () => {
    const s = pair(); s.comparison!.previous.complete = false; s.comparison!.previous.coverage[0].complete = false;
    expect(() => prepareReviewPrompt(s)).toThrow("REVIEW_INCOMPLETE");
    expect(() => parseReviewReceipt({ version: "monthly-review-v1", model: "test", analyzedAt: now.toISOString(), summary: summary(), analysis: {} })).toThrow("REVIEW_AI_INVALID");
  });
  it("previous-month refs are allowed, unrelated refs rejected; adoption remains AD_HOC with MONTHLY provenance", () => {
    const s = pair(), finding = { text: "整理真实作品", supportingIds: [s.comparison!.previous.sourceRefs[0].ref], certainty: "supported" as const };
    const analysis = { overview: "两期记录对照，能力变化未知", confidence: 0.2, ...Object.fromEntries(REVIEW_SECTIONS.map(k => [k, finding])), adjustments: [finding], uncertainties: ["月度时长不同"] } as ReviewAnalysisReceipt["analysis"];
    const receipt: ReviewAnalysisReceipt = { version: "monthly-review-v1", model: "test", analyzedAt: now.toISOString(), summary: s, analysis };
    expect(parseReviewReceipt(receipt).analysis.growth.supportingIds).toEqual(finding.supportingIds);
    expect(() => parseReviewReceipt({ ...receipt, analysis: { ...analysis, growth: { ...finding, supportingIds: [`activities:${id(999)}`] } } })).toThrow();
    const draft = reviewDraft(receipt); expect(draft.reflection).toContain("月度复盘草稿"); expect(draft.objectiveSummary.reviewMode).toBe("MONTHLY");
    expect(matchingReviewDraftPeriod(draft.objectiveSummary, reviewDraftInputTime(month.start), reviewDraftInputTime(month.end), "AD_HOC")).toEqual(month);
    expect(matchingReviewDraftPeriod(draft.objectiveSummary, reviewDraftInputTime(month.start), reviewDraftInputTime(month.end), "WEEKLY")).toBeNull();
  });
  it("reuses owner-filtered read-only repository for both exact windows; prior query failure is not zero", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
    const windows: string[] = []; let priorFailure = false;
    const client = { from(source: string) { return { select() {
      const ops = new Map<string, unknown>(), q: Record<string, unknown> = {};
      for (const op of ["eq", "gte", "lt", "gt", "order", "limit"]) q[op] = (key: string, value: unknown) => { ops.set(`${op}:${key}`, value); return q; };
      q.then = (resolve: (value: unknown) => unknown) => {
        expect(ops.get("eq:user_id")).toBe(owner);
        const start = String(ops.get("gte:created_at") ?? ""); if (source === "activities") windows.push(start);
        return Promise.resolve({ data: [], error: priorFailure && start === "2026-09-01T00:00:00.000Z" ? { message: "private" } : null }).then(resolve);
      }; return q;
    } }; } } as unknown as ReviewReadClient;
    const repository = new ReviewInsightsRepository(client, owner), result = await repository.summarize(month);
    expect(windows).toEqual([month.start, "2026-09-01T00:00:00.000Z"]); expect(result.comparison?.previous.counts.activities).toBe(0);
    priorFailure = true; await expect(repository.summarize(month)).rejects.toThrow("REVIEW_UNAVAILABLE");
  });
});
