import { beforeEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: true, session: vi.fn(), reject: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => mocks.configured }));
vi.mock("@/lib/store/request-repository", () => ({ AuthRequiredError: class extends Error {} }));
vi.mock("@/lib/store/assessment-rejection.service", () => ({
  getAssessmentRejectionSession: mocks.session,
  AssessmentRejectionError: class extends Error { constructor(readonly code: string) { super(code); } },
}));
import { POST } from "@/app/api/assessments/[id]/reject/route";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { AssessmentRejectionError } from "@/lib/store/assessment-rejection.service";
const id = "00000000-0000-4000-8000-000000000001";
const activityId = "00000000-0000-4000-8000-000000000002";
const receipt = { assessment: { id, activityId, status: "rejected" } };
function request(body = "{}", headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/assessments/${id}/reject`, { method: "POST", body, headers: { "Content-Type": "application/json", ...headers } });
}
const call = (req = request(), target = id) => POST(req, { params: Promise.resolve({ id: target }) });
beforeEach(() => { vi.clearAllMocks(); mocks.configured = true; mocks.session.mockResolvedValue({ reject: mocks.reject }); mocks.reject.mockResolvedValue(receipt); });
describe("Proposal rejection API authority and bounded payload", () => {
  test("same-origin empty JSON returns the actual receipt with private no-store", async () => {
    const response = await call(request("{}", { Origin: "http://localhost" }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(receipt);
    expect(mocks.reject).toHaveBeenCalledExactlyOnceWith(id);
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toBe("Cookie");
  });
  test("missing configuration has no auth, demo or write dispatch", async () => {
    mocks.configured = false; const response = await call(); expect(response.status).toBe(503); expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test.each([
    { Origin: "http://127.0.0.1:3056", Host: "127.0.0.1:3056" },
    { Origin: "http://127.0.0.1:3056", Host: "127.0.0.1:3056", "X-Forwarded-Host": "foreign.invalid", "X-Forwarded-Proto": "https" },
  ] as Record<string, string>[])("browser Host, not Next's internal URL or forwarded headers, accepts same-origin %j", async headers => {
    const req = new Request(`http://0.0.0.0:3000/api/assessments/${id}/reject`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json", ...headers } });
    const response = await call(req); expect(response.status).toBe(200); expect(await response.json()).toEqual(receipt);
    expect(mocks.reject).toHaveBeenCalledExactlyOnceWith(id);
  });
  test.each([
    { Origin: "http://localhost", Host: "127.0.0.1:3056" },
    { Origin: "https://foreign.invalid", Host: "127.0.0.1:3056", "X-Forwarded-Host": "foreign.invalid", "X-Forwarded-Proto": "https" },
  ] as Record<string, string>[])("internal or forwarded-origin match cannot override browser Host %j", async headers => {
    expect((await call(request("{}", headers))).status).toBe(403); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test("auth precedes UUID and payload validation", async () => {
    mocks.session.mockRejectedValue(new AuthRequiredError()); const response = await call(request("not-json"), "invalid"); expect(response.status).toBe(401); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test("authenticated invalid UUID never dispatches mutation", async () => { expect((await call(request(), "invalid")).status).toBe(400); expect(mocks.reject).not.toHaveBeenCalled(); });
  test.each(["null", "[]", '"text"', "1", "{", '{"owner":"foreign"}', '{"status":"confirmed"}', '{"__proto__":{}}'])
  ("rejects invalid or authority-bearing body %s", async body => { expect((await call(request(body))).status).toBe(400); expect(mocks.reject).not.toHaveBeenCalled(); });
  test.each(["text/plain", "application/x-www-form-urlencoded", "application/json-evil"])("rejects content type %s", async contentType => {
    expect((await call(request("{}", { "Content-Type": contentType }))).status).toBe(400); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test.each([{ Origin: "https://foreign.invalid" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }] as Record<string, string>[])("cross-site request %j cannot mutate", async headers => {
    expect((await call(request("{}", headers))).status).toBe(403); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test("1024 real bytes are accepted, 1025 rejected regardless of declared length", async () => {
    expect((await call(request("{}" + " ".repeat(1022)))).status).toBe(200); mocks.reject.mockClear();
    expect((await call(request("{}" + " ".repeat(1023), { "Content-Length": "2" }))).status).toBe(413); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test("UTF8 bytes, not JS string length, determine limit", async () => {
    expect((await call(request("你".repeat(400), { "Content-Length": "1" }))).status).toBe(413); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test("oversized chunk remains413 even if stream cancellation fails", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(1025)); }, cancel() { throw Error("cancel failed"); } });
    const req = new Request(`http://localhost/api/assessments/${id}/reject`, { method: "POST", body, duplex: "half", headers: { "Content-Type": "application/json" } } as RequestInit);
    expect((await call(req)).status).toBe(413); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test("invalid UTF8 is malformed, never replacement-decoded into a payload", async () => {
    const req = new Request(`http://localhost/api/assessments/${id}/reject`, { method: "POST", body: new Uint8Array([0xff]), headers: { "Content-Type": "application/json" } });
    expect((await call(req)).status).toBe(400); expect(mocks.reject).not.toHaveBeenCalled();
  });
  test.each([["not_found", 404], ["assessment_conflict", 409], ["invalid_receipt", 500]] as const)("safe domain error %s", async (code, status) => {
    mocks.reject.mockRejectedValue(new AssessmentRejectionError(code)); const response = await call(); expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  test.each(["constructor", "__proto__", "toString", "SQL_PRIVATE_VALUE"])("unknown error %s never selects a prototype status or leaks", async message => {
    mocks.reject.mockRejectedValue(new Error(message)); const response = await call(); expect(response.status).toBe(500); expect(await response.text()).not.toContain(message);
  });
  test("auth infrastructure failure is a safe 500, not demo or an invented session", async () => {
    mocks.session.mockRejectedValue(new Error("SECRET_INFRA_VALUE")); const response = await call(); expect(response.status).toBe(500); expect(await response.text()).not.toContain("SECRET_INFRA_VALUE"); expect(mocks.reject).not.toHaveBeenCalled();
  });
});
