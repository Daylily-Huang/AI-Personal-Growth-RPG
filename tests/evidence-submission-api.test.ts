import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/activities/[id]/evidence/route";
import { evidenceFailure, readEvidenceBody, validateEvidencePostHeaders } from "@/lib/evidence-submission/http";
import { EvidenceSubmissionError } from "@/lib/evidence-submission/types";

const mocks = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.server }));
const id = (n: number) => `10000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const uid = id(1), activityId = id(2), requestId = id(3);
const input = { requestId, skillId: null, description: "plain <script>literal</script> https://example.invalid" };
const raw = () => ({ userId: uid, replayed: false, submission: { requestId, activityId, requestedSkillId: null,
  evidence: { userId: uid, id: id(4), activityId, skillId: null, evidenceLevel: 0, evidenceType: "user_submission", description: input.description, verified: false, createdAt: "2026-10-11T00:00:00+00:00" } } });
let db: { auth: { getUser: ReturnType<typeof vi.fn> }; rpc: ReturnType<typeof vi.fn> };
const context = (id = activityId) => ({ params: Promise.resolve({ id }) });
function request(body: unknown = input, headers: Record<string, string | undefined> = {}, suffix = "") {
  const values = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(headers)) if (value !== undefined) values.set(key, value);
  return new Request(`http://localhost/api/activities/${activityId}/evidence${suffix}`, { method: "POST", headers: values, body: typeof body === "string" ? body : JSON.stringify(body) });
}
beforeEach(() => {
  db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: uid } }, error: null }) }, rpc: vi.fn().mockResolvedValue({ data: raw(), error: null }) };
  mocks.server.mockReset().mockResolvedValue(db);
});
async function status(response: Response, expected: number) {
  expect(response.status).toBe(expected); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie"); return response.json();
}
describe("authenticated manual evidence actual API", () => {
  it("201 exact fixed projection and single RPC, no extra writes", async () => {
    const result = await status(await POST(request(), context()), 201);
    expect(result.replayed).toBe(false); expect(result.submission.evidence.description).toBe(input.description);
    expect(JSON.stringify(result)).not.toContain(uid);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("rpc_submit_activity_evidence", { p_activity_id: activityId, p_request_id: requestId, p_input: { skillId: null, description: input.description } });
  });
  it("200 replay without any prefetch", async () => {
    db.rpc.mockResolvedValue({ data: { ...raw(), replayed: true }, error: null });
    expect((await status(await POST(request(), context()), 200)).replayed).toBe(true);
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it("auth precedes params, headers, body and query; no parse or dispatch", async () => {
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const hostile = { get params(): Promise<{ id: string }> { throw Error("must not parse"); } };
    await status(await POST(request("{", { origin: "https://evil.invalid", "Content-Type": "text/plain" }, "?unknown=x"), hostile), 401);
    await status(await GET(new Request("http://localhost/api?view=bad"), hostile), 401);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each([500, 503, 429, undefined])("unknown auth infrastructure status %s is safe500", async authStatus => {
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: authStatus, message: "private-provider-secret" } });
    expect(JSON.stringify(await status(await POST(request(), context()), 500))).not.toContain("secret"); expect(db.rpc).not.toHaveBeenCalled();
  });
  it("each request creates a fresh client; config absence never falls back to demo", async () => {
    await POST(request(), context()); await POST(request(), context()); expect(mocks.server).toHaveBeenCalledTimes(2);
    mocks.server.mockRejectedValueOnce(new Error("private env config")); await status(await POST(request(), context()), 500);
    expect(db.rpc).toHaveBeenCalledTimes(2);
  });
  it.each([{}, { ...input, userId: uid }, { ...input, evidenceLevel: 3 }, { ...input, verified: true }, { ...input, skillId: undefined }, { ...input, description: "\ud800" }, { ...input, description: "\0" }])("400 malformed payload %# with zero RPC", async value => {
    await status(await POST(request(value), context()), 400); expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each(["?view=skills", "?after=x", "?unknown=x"])("POST query %s rejected without RPC", async query => {
    await status(await POST(request(input, {}, query), context()), 400); expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each(["view=skills&view=skills", "after=", "view=all", "offset=1000"])("GET query %s rejected without RPC", async query => {
    await status(await GET(new Request(`http://localhost/api?${query}`), context()), 400); expect(db.rpc).not.toHaveBeenCalled();
  });
  it("GET uses only the read RPC with keyset parameters", async () => {
    db.rpc.mockResolvedValue({ data: { userId: uid, activityId, view: "skills", items: [], nextCursor: null }, error: null });
    expect(await status(await GET(new Request(`http://localhost/api?view=skills&after=${requestId}`), context()), 200)).toEqual({ view: "skills", items: [], nextCursor: null });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("rpc_list_activity_evidence_submissions", { p_activity_id: activityId, p_view: "skills", p_after: requestId });
  });
  it.each([["EVIDENCE_REQUEST_REUSED", "23505", 409], ["EVIDENCE_TARGET_NOT_FOUND", "P0002", 404], ["INVALID_EVIDENCE_INPUT", "22023", 400], ["EVIDENCE_AUTH_REQUIRED", "42501", 401]])("exact SQL error %s/%s", async (message, code, expected) => {
    db.rpc.mockResolvedValue({ data: null, error: { message, code } }); await status(await POST(request(), context()), Number(expected));
  });
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "EVIDENCE_REQUEST_REUSED", "private SQL stack password"])("unknown/prototype error %s is safe JSON500", async message => {
    for (const code of ["42501", "P0001", "23514"]) {
      const response = evidenceFailure(new EvidenceSubmissionError(message, code));
      expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain(message);
    }
  });
  it.each([{ replayed: "false" }, { replayed: null }, { userId: id(999) }, { submission: null }])("raw receipt mutation %# fails500", async patch => {
    db.rpc.mockResolvedValue({ data: { ...raw(), ...patch }, error: null }); await status(await POST(request(), context()), 500);
  });
  it.each(["verified", "evidenceLevel", "evidenceType", "activityId", "createdAt"])("raw missing %s fails500", async key => {
    const value = raw(); Reflect.deleteProperty(value.submission.evidence, key);
    db.rpc.mockResolvedValue({ data: value, error: null }); await status(await POST(request(), context()), 500);
  });
});

describe("real Host origin and bounded fatal UTF8 stream", () => {
  it.each([
    { host: "example.test", origin: "http://example.test" },
    { host: "localhost:3018", origin: "http://localhost:3018" },
    { host: "example.test", origin: "http://example.test", "x-forwarded-host": "evil.invalid", "x-forwarded-proto": "https" },
    {},
  ])("allows authenticated valid Host or originless nonbrowser %#", async headers => {
    await status(await POST(request(input, headers), context()), 201);
  });
  it.each([
    { host: "example.test", origin: "http://localhost" }, { origin: "null" }, { origin: "https://evil.invalid" },
    { "sec-fetch-site": "cross-site" }, { origin: "http://localhost", "sec-fetch-site": "cross-site" },
  ])("rejects cross site/foreign origin %# with zero RPC", async headers => {
    await status(await POST(request(input, headers), context()), 403); expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each(["text/plain", "application/json; charset=latin1", "application/json;boundary=x", "application/json; charset=\"utf-8", "application/json; charset=utf-8\"", "", "multipart/form-data"])("rejects media %s", async contentType => {
    await status(await POST(request(input, { "Content-Type": contentType }), context()), 415); expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each(["application/json; charset=UTF-8", "Application/JSON; charset=\"utf8\""])("accepts media %s", value => expect(() => validateEvidencePostHeaders(request(input, { "Content-Type": value }))).not.toThrow());
  it("reads exactly16384 bytes, but cancels a streaming16385th byte before parse", async () => {
    const json = JSON.stringify({ a: "x".repeat(16376) }); expect(new TextEncoder().encode(json)).toHaveLength(16384);
    await expect(readEvidenceBody(request(json))).resolves.toEqual({ a: "x".repeat(16376) });
    let cancelled = false, chunks = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) {
      chunks++; controller.enqueue(new Uint8Array(chunks === 1 ? 16384 : 1).fill(32));
    }, cancel() { cancelled = true; } });
    const req = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readEvidenceBody(req)).rejects.toThrow("EVIDENCE_BODY_TOO_LARGE");
    expect(cancelled).toBe(true); expect(chunks).toBeLessThanOrEqual(3);
  });
  it("fatal UTF8 rejects invalid bytes, handles split Unicode and malformed JSON", async () => {
    const bytes = new TextEncoder().encode('{"a":"界😀"}');
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
    await expect(readEvidenceBody(new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit))).resolves.toEqual({ a: "界😀" });
    await expect(readEvidenceBody(new Request("http://localhost", { method: "POST", body: Uint8Array.from([0xc3, 0x28]) }))).rejects.toThrow("INVALID_EVIDENCE_INPUT");
    await status(await POST(request("{"), context()), 400);
  });
  it("lawful16KiB escaped JSON still yields only bounded material", async () => {
    const body = JSON.stringify({ ...input, description: "\u0001".repeat(2700) });
    expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(16384);
    db.rpc.mockResolvedValue({ data: { ...raw(), submission: { ...raw().submission, evidence: { ...raw().submission.evidence, description: "\u0001".repeat(2700) } } }, error: null });
    await status(await POST(request(body), context()), 201);
  });
});
