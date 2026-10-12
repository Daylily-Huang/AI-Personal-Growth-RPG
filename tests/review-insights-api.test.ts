import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/reviews/summary/route";
import { POST } from "@/app/api/reviews/analyze/route";
import { getReviewInsightsRepository } from "@/lib/review-insights/request";
import { analyzeReview } from "@/lib/review-insights/ai";
import { reviewFailure } from "@/lib/review-insights/http";
import { ReviewError } from "@/lib/review-insights/types";
vi.mock("@/lib/review-insights/request", () => ({ getReviewInsightsRepository: vi.fn() }));
vi.mock("@/lib/review-insights/ai", () => ({ analyzeReview: vi.fn() }));
const summarize = vi.fn(), p = { mode: "DAILY", start: "2026-10-11T00:00:00.000Z", end: "2026-10-12T00:00:00.000Z", timezone: "UTC" }, base = "http://local/api/reviews/";
function request(body: unknown = p, headers: Record<string, string> = {}) { return new Request(base + "analyze", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://local", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); summarize.mockResolvedValue({ factual: "server-owned" }); vi.mocked(getReviewInsightsRepository).mockResolvedValue({ summarize } as never); vi.mocked(analyzeReview).mockResolvedValue({ strict: "analysis" } as never); });
describe("Review auth-first private HTTP adapters", () => {
  it("GET summarizes server-owned period without any provider/write", async () => {
    const r = await GET(new Request(base + "summary?" + new URLSearchParams(p))); expect(r.status).toBe(200); expect(await r.json()).toEqual({ summary: { factual: "server-owned" } }); expect(summarize).toHaveBeenCalledWith(p); expect(analyzeReview).not.toHaveBeenCalled();
    expect(r.headers.get("cache-control")).toBe("private, no-store"); expect(r.headers.get("vary")).toBe("Cookie");
  });
  it("POST rebuilds facts from own repository and propagates request abort signal", async () => {
    const req = request(), r = await POST(req); expect(r.status).toBe(200); expect(summarize).toHaveBeenCalledWith(p); expect(analyzeReview).toHaveBeenCalledWith({ factual: "server-owned" }, req.signal);
  });
  it("auth precedes malformed JSON/query/origin/media and provider", async () => {
    vi.mocked(getReviewInsightsRepository).mockRejectedValue(new ReviewError("REVIEW_AUTH_REQUIRED"));
    for (const req of [request("{", { Origin: "https://foreign.invalid", "Content-Type": "text/plain" }), new Request(base + "summary?owner=foreign")]) {
      const r = req.method === "GET" ? await GET(req) : await POST(req); expect(r.status).toBe(401); expect(await r.json()).toEqual({ code: "REVIEW_AUTH_REQUIRED" });
    }
    expect(summarize).not.toHaveBeenCalled(); expect(analyzeReview).not.toHaveBeenCalled();
  });
  it.each(["userId", "facts", "model", "xp", "serviceRole", "summary"])("client %s has no fact/authority channel", async key => {
    const r = await POST(request({ ...p, [key]: "forged" })); expect(r.status).toBe(400); expect(summarize).not.toHaveBeenCalled(); expect(analyzeReview).not.toHaveBeenCalled();
  });
  it.each(["&mode=DAILY", "&owner=foreign", "&offset=1000"])("unknown/duplicate query %s is rejected", async suffix => { expect((await GET(new Request(base + "summary?" + new URLSearchParams(p) + suffix))).status).toBe(400); expect(summarize).not.toHaveBeenCalled(); });
  it.each([["origin", 403], ["media", 415], ["oversize", 413], ["json", 400], ["utf8", 400], ["prototype", 400]] as const)("enforces %s boundary", async (kind, status) => {
    const req = kind === "utf8" ? new Request(base + "analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: new Uint8Array([0xc3, 0x28]) }) : request(kind === "oversize" ? " ".repeat(2049) : kind === "json" ? "{" : kind === "prototype" ? '{"__proto__":{}}' : p, kind === "origin" ? { Origin: "https://foreign.invalid" } : kind === "media" ? { "Content-Type": "text/plain" } : {});
    expect((await POST(req)).status).toBe(status); expect(summarize).not.toHaveBeenCalled();
  });
  it.each(["constructor", "toString", "__proto__", "private SQL+key+raw", "hasOwnProperty"])("safe error fallback %s never throws/echoes", async key => {
    for (const error of [new ReviewError(key), Error(key), { code: key, message: key }]) { const r = reviewFailure(error); expect(r.status).toBe(500); expect(await r.json()).toEqual({ code: "REVIEW_UNAVAILABLE" }); expect(r.headers.get("cache-control")).toBe("private, no-store"); }
  });
  it("provider failure retains no payload and makes zero writes", async () => { vi.mocked(analyzeReview).mockRejectedValue(new ReviewError("REVIEW_AI_INVALID")); const r = await POST(request()); expect(r.status).toBe(502); expect(await r.json()).toEqual({ code: "REVIEW_AI_INVALID" }); expect(summarize).toHaveBeenCalledTimes(1); });
});
