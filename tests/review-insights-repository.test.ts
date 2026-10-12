import { describe, expect, it } from "vitest";
import { ReviewInsightsRepository, type ReviewReadClient, type ReviewQuery } from "@/lib/review-insights/repository";
import { REVIEW_SOURCES } from "@/lib/review-insights/types";

const owner = "11111111-1111-4111-8111-111111111111", id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const period = { mode: "DAILY" as const, start: "2026-10-11T00:00:00.000Z", end: "2026-10-12T00:00:00.000Z", timezone: "UTC" };
function mock(count: number, mutate?: (row: Record<string, unknown>, index: number) => unknown, fail?: "error" | "null" | "throw" | "reverse") {
  const calls: { source: string; ops: [string, unknown, unknown][] }[] = [];
  const client = { from(source: string) { return { select(fields: string) {
    const ops: [string, unknown, unknown][] = [["select", fields, null]]; calls.push({ source, ops });
    const query: Record<string, unknown> = {};
    for (const op of ["eq", "gte", "lt", "gt", "order", "limit"]) query[op] = (a: unknown, b: unknown) => { ops.push([op, a, b]); return query; };
    query.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      if (fail === "throw") return Promise.reject(Error("private SQL")).then(resolve, reject);
      const cursor = ops.find(o => o[0] === "gt")?.[2] as string | undefined, n = cursor ? Number(cursor.split("-").at(-1)) : 0;
      let data: unknown = source === "activities" ? Array.from({ length: Math.min(201, Math.max(0, count - n)) }, (_, i) => {
        const row = { id: id(n + i + 1), user_id: owner, created_at: "2026-10-11T12:00:00.000001Z", title: "私有活动", status: "confirmed", total_minutes: null, effective_minutes: null };
        return mutate ? mutate(row, i) : row;
      }) : [];
      if (fail === "reverse" && Array.isArray(data)) data = data.reverse();
      return Promise.resolve({ data: fail === "null" ? null : data, error: fail === "error" ? { message: "private SQL" } : null }).then(resolve, reject);
    };
    return query as unknown as ReviewQuery;
  } }; } } as unknown as ReviewReadClient;
  return { repository: new ReviewInsightsRepository(client, owner), calls };
}
describe("Review RLS+owner read-only keyset", () => {
  it("paginates1001 using id cursor, not silently capped1000/offset, all nine owners explicit", async () => {
    const { repository, calls } = mock(1001), result = await repository.summarize(period);
    expect(result.counts.activities).toBe(1001); expect(result.complete).toBe(true); expect(calls.filter(c => c.source === "activities")).toHaveLength(6);
    expect([...new Set(calls.map(c => c.source))]).toEqual([...REVIEW_SOURCES]);
    for (const c of calls) { expect(c.ops).toContainEqual(["eq", "user_id", owner]); expect(c.ops).toContainEqual(["order", "id", { ascending: true }]); expect(c.ops).toContainEqual(["limit", 201, undefined]); expect(c.ops.some(x => /insert|update|delete|rpc|range/.test(x[0]))).toBe(false); }
    expect(calls[1].ops).toContainEqual(["gt", "id", id(200)]);
  });
  it.each([10000, 10001])("distinguishes exact cap from truncation at%s", async n => {
    const result = await mock(n).repository.summarize(period); expect(result.counts.activities).toBe(10000); expect(result.complete).toBe(n === 10000);
  });
  it.each(["error", "null", "throw", "reverse"] as const)("fails closed for%s, not empty success", async fail => { await expect(mock(3, undefined, fail).repository.summarize(period)).rejects.toThrow(/REVIEW_(UNAVAILABLE|MALFORMED_DATA)/); });
  it.each([
    (r: Record<string, unknown>) => ({ ...r, user_id: id(999) }),
    (r: Record<string, unknown>) => ({ ...r, created_at: period.end }),
    (r: Record<string, unknown>) => ({ ...r, created_at: "2026-10-10T23:59:59Z" }),
    (r: Record<string, unknown>) => ({ ...r, status: null }),
    (r: Record<string, unknown>) => ({ ...r, id: id(1) }),
  ])("rejects foreign/out-of-window/malformed/duplicate receipts", async mutate => { await expect(mock(3, mutate).repository.summarize(period)).rejects.toThrow("REVIEW_MALFORMED_DATA"); });
  it("selects no raw input, journal body, arbitrary metadata or secret columns", async () => {
    const { repository, calls } = mock(1); await repository.summarize(period);
    for (const c of calls) expect(c.ops[0][1]).not.toMatch(/raw_input|content_markdown|description|metadata|\*/);
    expect(calls.find(c => c.source === "journal_entries")!.ops).toContainEqual(["gte", "logged_at", period.start]);
    expect(calls.find(c => c.source === "quests")!.ops).toContainEqual(["eq", "is_main_quest", true]);
  });
});
