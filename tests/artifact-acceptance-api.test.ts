import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/artifacts/[id]/acceptance/route";
import { POST as REVOKE } from "@/app/api/artifacts/[id]/acceptance/revoke/route";
import { artifactAcceptanceFailure } from "@/lib/artifact-acceptance/http";
import { ArtifactAcceptanceError } from "@/lib/artifact-acceptance/types";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), from: vi.fn(), server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.server }));
const id = "11111111-1111-4111-8111-111111111111", owner = "22222222-2222-4222-8222-222222222222";
const earnId = "33333333-3333-4333-8333-333333333333", accountId = "44444444-4444-4444-8444-444444444444";
const stamp = "2026-10-12T00:00:00.123456+00:00";
const input = () => ({ requestKey: "accept-key", expectedUpdatedAt: stamp, acceptanceNote: "我的交付清单已完成" });
function receipt() {
  return { acceptance: { id: "66666666-6666-4666-8666-666666666666", userId: owner, artifactId: id, recognitionClass: "USER_CONFIRMED_ARTIFACT",
    status: "ACTIVE", acceptedTitle: "交付", acceptedVersion: "1.0", acceptedUpdatedAt: stamp, acceptanceNote: input().acceptanceNote,
    acceptedAt: stamp, earnTransactionId: earnId, policyVersion: "artifact-manual-v1", revokedAt: null, revocationReason: null, correctionTransactionId: null },
  earn: { id: earnId, userId: owner, accountId, eventKind: "EARN", amount: 100, sourceType: "ARTIFACT", sourceId: id,
    policyVersion: "artifact-manual-v1", correctionForId: null, createdAt: stamp }, correction: null, replayed: false };
}
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
const url = `http://127.0.0.1:3058/api/artifacts/${id}/acceptance`;
const request = (body: unknown = input(), headers: Record<string, string> = {}, target = url) => new Request(target, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
function privateJson(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie"); expect(response.headers.get("content-type")).toContain("application/json");
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.server.mockResolvedValue({ auth: { getUser: mocks.auth }, rpc: mocks.rpc, from: mocks.from });
  mocks.auth.mockResolvedValue({ data: { user: { id: owner } }, error: null });
  mocks.rpc.mockResolvedValue({ data: receipt(), error: null });
});

describe("Artifact private routes: actual auth factory, ordered parsing, no prefetch and bounded JSON", () => {
  it.each([GET, POST, REVOKE])("auth precedes even dynamic-param evaluation, headers, body and all repository work", async route => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null }); let parsed = 0;
    const params = { then() { parsed++; throw Error("must not parse before auth"); } } as unknown as Promise<{ id: string }>;
    const response = await route(request({ amount: 999 }, { Origin: "https://evil.invalid", "Content-Type": "text/plain" }, url + "?bad=1"), { params });
    expect(response.status).toBe(401); privateJson(response); expect(parsed).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500, 429])("auth error %s is classified without Demo/admin fallback", async status => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: { status } });
    const response = await POST(request(), context()); expect(response.status).toBe(status < 500 && status !== 429 ? 401 : 500);
    privateJson(response); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("missing configuration is safe500, not a false401 or fallback user", async () => {
    mocks.server.mockRejectedValueOnce(Error("private config diagnostic"));
    const response = await GET(new Request(url), context()); expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("diagnostic"); privateJson(response);
  });
  it("maps exact accept arguments only and does not prefetch the mutable source", async () => {
    const response = await POST(request(), context()); expect(response.status).toBe(200); privateJson(response);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_accept_artifact_manual", {
      p_artifact_id: id, p_expected_updated_at: stamp, p_acceptance_note: input().acceptanceNote, p_request_key: "accept-key",
    });
    expect(mocks.from).not.toHaveBeenCalled(); expect((await response.json()).earn.amount).toBe(100);
  });
  it("maps revoke arguments only; replay validates the stored receipt without target reads", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...receipt(), replayed: true }, error: null });
    const response = await REVOKE(request({ requestKey: "revoke-key", reason: "错误交付" }), context());
    expect(response.status).toBe(200); expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_revoke_artifact_manual", {
      p_artifact_id: id, p_reason: "错误交付", p_request_key: "revoke-key",
    }); expect(mocks.from).not.toHaveBeenCalled(); expect((await response.json()).replayed).toBe(true);
  });
  it.each([GET, POST, REVOKE])("rejects invalid route ID and unexpected/repeated query after auth", async route => {
    expect((await route(request(), context("bad"))).status).toBe(400);
    expect((await route(request(input(), {}, url + "?view=x&view=x"), context())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(["amount", "policy", "userId", "status", "recognitionClass", "constructor", "__proto__"])("rejects body authority field %s", async field => {
    const body = Object.defineProperty(input(), field, { value: 100, enumerable: true });
    const response = await POST(request(body), context()); expect(response.status).toBe(400); privateJson(response);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["application/json", "application/json; charset=UTF-8", 'application/json; charset="utf8"'])("accepts frozen UTF8 media type %s", async media => {
    expect((await POST(request(input(), { "Content-Type": media }), context())).status).toBe(200);
  });
  it.each(["text/plain", "application/json; charset=latin1", "application/json; extra=1"])("rejects unsupported media %s", async media => {
    expect((await POST(request(input(), { "Content-Type": media }), context())).status).toBe(415); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("matches real Host+scheme exactly and ignores forwarded headers", async () => {
    expect((await POST(request(input(), { Host: "localhost:3058", Origin: "http://localhost:3058", "X-Forwarded-Host": "evil.invalid" }), context())).status).toBe(200);
    const cases: Array<Record<string, string>> = [{ Origin: "http://evil.invalid:3058" }, { Origin: "https://127.0.0.1:3058" }, { "Sec-Fetch-Site": "cross-site" }];
    for (const headers of cases) {
      expect((await POST(request(input(), headers), context())).status).toBe(403);
    }
  });
  it("bounds actual streamed bytes and rejects malformed UTF8/JSON before RPC", async () => {
    expect((await POST(request({ ...input(), acceptanceNote: "x".repeat(16384) }), context())).status).toBe(413);
    for (const bytes of [new Uint8Array([0xff, 0xfe]), new TextEncoder().encode('{"requestKey":')]) {
      const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
      const value = new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
      expect((await POST(value, context())).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([null, undefined, "active", "constructor"])("malformed RPC status %s cannot yield success", async status => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt(), acceptance: { ...receipt().acceptance, status } }, error: null });
    const response = await POST(request(), context()); expect(response.status).toBe(500); privateJson(response);
  });
  it.each(["constructor", "toString", "__proto__", "unknown database detail"])("prototype SQL error %s remains safe JSON", async message => {
    for (const code of ["42501", "23505", "P0001"]) {
      const response = artifactAcceptanceFailure(new ArtifactAcceptanceError(message, code));
      expect(response.status).toBe(code === "42501" ? 403 : 500); privateJson(response);
      expect(await response.text()).not.toContain(message);
    }
  });
  it.each(["ARTIFACT_ACCEPTANCE_KEY_REUSED", "ARTIFACT_ACCEPTANCE_ALREADY_ACCEPTED", "ARTIFACT_ACCEPTANCE_ALREADY_REVOKED", "ARTIFACT_ACCEPTANCE_STALE_SOURCE"])("maps safe conflict %s", async message => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message, code: "23505" } });
    const response = await POST(request(), context()); expect(response.status).toBe(409); privateJson(response);
  });
});
