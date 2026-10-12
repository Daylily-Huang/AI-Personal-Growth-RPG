import { describe, expect, it } from "vitest";
import { parseReviewPeriod, parseReviewQuery, plainReviewData, reviewTimestamp, parseReviewRow } from "@/lib/review-insights/validation";
import { localReviewPeriod, reviewClientError } from "@/lib/review-insights/client";
import { ReviewError } from "@/lib/review-insights/types";

const now = new Date("2026-10-12T12:00:00.000Z"), period = { mode: "DAILY", start: "2026-10-11T00:00:00.000Z", end: "2026-10-12T00:00:00.000Z", timezone: "Asia/Singapore" };
describe("Review strict input and timestamps", () => {
  it("accepts explicit half-open period without interpreting the timezone as an offset", () => { expect(parseReviewPeriod(period, now)).toEqual(period); });
  it.each([
    { mode: "MONTHLY" }, { timezone: "Mars/Unknown" }, { start: "2026-02-30T00:00:00.000Z" }, { start: period.end }, { end: "2026-10-13T00:00:00.000Z" },
    { start: "2026-10-09T00:00:00.000Z" }, { start: "2026-10-11T00:00:00Z" }, { start: "2026-10-11T00:00:00.000001Z" }, { userId: "forged" }, { facts: {} },
  ])("rejects malformed window/authority %j", delta => { expect(() => parseReviewPeriod({ ...period, ...delta }, now)).toThrow("REVIEW_INVALID_INPUT"); });
  it("accepts 25-hour DST day and rejects more than26 hours", () => {
    const p = { ...period, start: "2026-11-01T04:00:00.000Z", end: "2026-11-02T05:00:00.000Z", timezone: "America/New_York" };
    expect(parseReviewPeriod(p, new Date("2026-11-03"))).toEqual(p);
    expect(() => parseReviewPeriod({ ...p, end: "2026-11-02T07:00:00.000Z" }, new Date("2026-11-03"))).toThrow();
  });
  it("weekly cap permits DST and refuses ninth day", () => {
    expect(parseReviewPeriod({ ...period, mode: "WEEKLY", start: "2026-10-04T23:00:00.000Z" }, now).mode).toBe("WEEKLY");
    expect(() => parseReviewPeriod({ ...period, mode: "WEEKLY", start: "2026-10-03T00:00:00.000Z" }, now)).toThrow();
  });
  it.each(["2026-02-29T00:00:00Z", "2026-01-01T24:00:00Z", "2026-01-01T00:60:00Z", "2026-01-01T00:00:60Z", "2026-01-01T00:00:00+25:00", "0000-01-01T00:00:00Z"])("rejects invalid DB timestamp %s", value => expect(() => reviewTimestamp(value)).toThrow());
  it("preserves valid leap day and microseconds", () => { expect(reviewTimestamp("2024-02-29T00:00:00.000001+00:00")).toBe("2024-02-29T00:00:00.000001+00:00"); });
  it.each([null, undefined, [], new Date(), Object.create({ mode: "DAILY" }), JSON.parse('{"__proto__":{}}'), { nested: { constructor: {} } }, { value: NaN }, { value: "\ud800" }, { value: "\0" }])("rejects non-plain or unsafe data %j", value => {
    if (value === null) expect(() => plainReviewData(value)).not.toThrow(); else expect(() => parseReviewPeriod(value, now)).toThrow();
  });
  it("never executes getters and rejects symbols/cycles/sparse arrays", () => {
    let touched = false; const getter = Object.defineProperty({}, "mode", { get() { touched = true; return "DAILY"; } });
    for (const value of [getter, { [Symbol("x")]: 1 }, new Array(2)]) expect(() => plainReviewData(value)).toThrow();
    const cycle: { self?: unknown } = {}; cycle.self = cycle; expect(() => plainReviewData(cycle)).toThrow(); expect(touched).toBe(false);
  });
  it("rejects duplicate/extra query values before normalization", () => {
    const url = "http://local/api/reviews/summary?" + new URLSearchParams(period);
    for (const suffix of ["&mode=DAILY", "&owner=forged"]) expect(() => parseReviewQuery(new Request(url + suffix))).toThrow("REVIEW_INVALID_INPUT");
  });
  it("row validation requires exact owner, fields and statuses", () => {
    const id = "11111111-1111-4111-8111-111111111111", owner = "22222222-2222-4222-8222-222222222222", row = { id, user_id: owner, created_at: period.start, title: "original", status: "confirmed", total_minutes: null, effective_minutes: null };
    expect(parseReviewRow("activities", row, owner)).toEqual(row);
    for (const delta of [{ user_id: id }, { status: null }, { status: "active" }, { total_minutes: -1 }, { extra: true }]) expect(() => parseReviewRow("activities", { ...row, ...delta }, owner)).toThrow("REVIEW_MALFORMED_DATA");
  });
  it("builds local calendar boundary and clips current day rather than using fixed24h", () => {
    const p = localReviewPeriod("2026-10-12", "DAILY", now); expect(Date.parse(p.end)).toBeLessThanOrEqual(now.getTime()); expect(p.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(() => localReviewPeriod("2026-02-30", "DAILY", now)).toThrow(); expect(() => localReviewPeriod("2026-10-13", "DAILY", now)).toThrow();
  });
  it.each(["constructor", "__proto__", "toString", "private provider payload"])("safe client fallback %s", code => expect(reviewClientError(new ReviewError(code))).toBe("复盘暂不可用，请稍后重试。"));
});
