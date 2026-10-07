import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("@/lib/milestone/request", () => ({ getMilestoneRepository: vi.fn() }));
vi.mock("@/lib/outer-loop/request", () => ({ getPhase8BRepository: vi.fn() }));
import { getMilestoneRepository } from "@/lib/milestone/request";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { Phase8BRepositoryError } from "@/lib/outer-loop/repository";
import { MilestoneRepositoryError } from "@/lib/milestone/errors";
import { milestoneErrorResponse } from "@/lib/milestone/http";
import { GET as list, POST as confirm } from "@/app/api/milestones/route";
import { GET as detail } from "@/app/api/milestones/[id]/route";
import { POST as settle } from "@/app/api/milestones/[id]/settle/route";
import { POST as revoke } from "@/app/api/milestones/[id]/revoke/route";
import { GET as sources } from "@/app/api/milestones/sources/route";
import { GET as proposals } from "@/app/api/milestones/proposals/route";
import { POST as review } from "@/app/api/outer-loop/proposals/[id]/review/route";

const id = randomUUID();
const context = (value: string = id) => ({ params: Promise.resolve({ id: value }) });
const input = { milestoneKey: " epic ", title: " Recognition ", description: "  ", recognitionClass: " core_verified ",
  sourceType: " quest ", sourceId: `{${id.toUpperCase()}}`, confirmationRequestIdempotencyKey: " key " };
function request(body?: unknown, query = "", raw = false) {
  return new Request(`http://localhost/api/milestones${query}`, { method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: raw ? String(body) : JSON.stringify(body), headers: { "Content-Type": "application/json" } }) });
}
function repo() { return { list: vi.fn().mockResolvedValue({ items: [], nextOffset: null }), detail: vi.fn(),
  sources: vi.fn().mockResolvedValue({ items: [], nextOffset: null }), proposals: vi.fn().mockResolvedValue({ items: [], nextOffset: null }),
  confirm: vi.fn(), settle: vi.fn(), revoke: vi.fn() }; }
let db: ReturnType<typeof repo>;
beforeEach(() => { vi.resetAllMocks(); db = repo(); vi.mocked(getMilestoneRepository).mockResolvedValue(db as never); });

describe("8F Round3 strict authenticated HTTP adapters", () => {
  test.each([list, detail, confirm, settle, revoke, sources, proposals])("authentication precedes parsing for %s", async handler => {
    vi.mocked(getMilestoneRepository).mockRejectedValue(new AuthRequiredError());
    const req = request("{", "?limit=bad", true); const parse = vi.spyOn(req, "json");
    const response = await handler(req, context("not-an-id"));
    expect(response.status).toBe(401); expect(parse).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  test("confirm normalizes transport but retains source aliases for SQL identity and returns original snapshot", async () => {
    const snapshot = { ok: true, replayed: true, milestone: { id, status: "ACTIVE" } };
    db.confirm.mockResolvedValue(snapshot);
    const response = await confirm(request(input));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(snapshot);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(db.confirm).toHaveBeenCalledWith({ ...input, milestoneKey: "epic", title: "Recognition", description: null,
      recognitionClass: "CORE_VERIFIED", sourceType: "QUEST", externalEvidenceUrl: null, externalCredentialId: null,
      confirmationRequestIdempotencyKey: "key" });
    expect(db.detail).not.toHaveBeenCalled(); expect(db.sources).not.toHaveBeenCalled();
  });
  test.each(["userId", "amount", "reward_credit_value", "granted_reward_credit", "rewardTransactionId", "status"])("confirm rejects authority field %s", async field => {
    expect((await confirm(request({ ...input, [field]: true }))).status).toBe(400);
    expect(db.confirm).not.toHaveBeenCalled();
  });
  test.each([undefined, [], {}, 7, true])("required description rejects %s", async description => {
    const response = await confirm(request({ ...input, description }));
    expect(response.status).toBe(400); expect(db.confirm).not.toHaveBeenCalled();
  });
  test.each(["", " \t\n\u00a0 ", "x".repeat(201), null, {}, 2])("invalid request key rejected: %s", async confirmationRequestIdempotencyKey => {
    expect((await confirm(request({ ...input, confirmationRequestIdempotencyKey }))).status).toBe(400);
  });
  test.each(["{", "null", "[]", "1"])("malformed/nonobject JSON %s fails closed", async body => {
    expect((await confirm(request(body, "", true))).status).toBe(400); expect(db.confirm).not.toHaveBeenCalled();
  });
  test("settle/revoke pass exact tuple once, without current-state or ownership fetch", async () => {
    const snapshot = { ok: true, replayed: true, milestone: { id } };
    db.settle.mockResolvedValue(snapshot); db.revoke.mockResolvedValue(snapshot);
    expect(await (await settle(request({ policyVersion: " reward-v1 ", requestIdempotencyKey: " s " }), context(id.toUpperCase()))).json()).toEqual(snapshot);
    expect(db.settle).toHaveBeenCalledExactlyOnceWith(id, "reward-v1", "s");
    expect(await (await revoke(request({ revocationReason: " reason ", revocationRequestIdempotencyKey: " r " }), context())).json()).toEqual(snapshot);
    expect(db.revoke).toHaveBeenCalledExactlyOnceWith(id, "reason", "r");
    expect(db.detail).not.toHaveBeenCalled();
  });
  test.each([settle, revoke])("mutation rejects unknown fields, query, UUID and blank body", async handler => {
    for (const req of [request({ amount: 200 }), request({}, "?amount=1"), request({})]) expect((await handler(req, context())).status).toBe(400);
    expect((await handler(request({}), context("bad"))).status).toBe(400);
    expect(db.settle).not.toHaveBeenCalled(); expect(db.revoke).not.toHaveBeenCalled();
  });
  test("list filters and pagination remain explicit, including revoked history", async () => {
    db.list.mockResolvedValue({ items: [{ id, status: "REVOKED" }], nextOffset: 1010 });
    const response = await list(request(undefined, "?limit=10&offset=1000&status=REVOKED&recognitionClass=CORE_VERIFIED"));
    expect(await response.json()).toEqual({ milestones: [{ id, status: "REVOKED" }], nextOffset: 1010 });
    expect(db.list).toHaveBeenCalledWith({ limit: 10, offset: 1000 }, { status: "REVOKED", recognitionClass: "CORE_VERIFIED" });
  });
  test.each(["?limit=0", "?limit=101", "?limit=1&limit=2", "?offset=-1", "?offset=1e3", "?offset=2147483548", "?unknown=1", "?status=BAD", "?recognitionClass=ARTIFACT"])("invalid query %s", async query => {
    expect((await list(request(undefined, query))).status).toBe(400); expect(db.list).not.toHaveBeenCalled();
  });
  test.each(["?sourceType=MASTERY", "?sourceType=MASTERY&threshold=7", "?sourceType=QUEST&threshold=6", "?sourceType=ARTIFACT", "?sourceType=QUEST&sourceType=SEASON"])("invalid discovery %s", async query => {
    expect((await sources(request(undefined, query))).status).toBe(400); expect(db.sources).not.toHaveBeenCalled();
  });
  test.each([6, 8, 10])("unique Mastery discovery threshold %s", async threshold => {
    const response = await sources(request(undefined, `?sourceType=MASTERY&threshold=${threshold}&limit=1`));
    expect(await response.json()).toMatchObject({ sources: [], authoritative: false });
    expect(db.sources).toHaveBeenCalledWith("MASTERY", { limit: 1, offset: 0 }, threshold);
  });
  test("detail absence/foreign error has one safe shape", async () => {
    db.detail.mockRejectedValue(new MilestoneRepositoryError("MILESTONE_NOT_FOUND", "P0002"));
    const response = await detail(request(), context());
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "MILESTONE_NOT_FOUND", code: "MILESTONE_NOT_FOUND" });
  });
  test("proposal pages preserve history and advertise recognition only", async () => {
    const response = await proposals(request(undefined, "?status=REJECTED&offset=1000"));
    expect(await response.json()).toEqual({ proposals: [], nextOffset: null, recognitionOnly: true });
    expect(db.proposals).toHaveBeenCalledWith({ limit: 50, offset: 1000 }, "REJECTED");
  });
  test.each([
    ["IDEMPOTENCY_KEY_REUSED", 409], ["MILESTONE_ALREADY_EXISTS", 409], ["REWARD_ALREADY_MINTED_FOR_SOURCE", 409],
    ["MILESTONE_NOT_SETTLEABLE", 409], ["MILESTONE_ALREADY_REVOKED", 409], ["MILESTONE_SOURCE_NOT_ELIGIBLE", 422],
    ["INELIGIBLE_FOR_REWARD", 422], ["INVALID_RECOGNITION_SOURCE_CLASS", 400], ["INVALID_MILESTONE_SOURCE_ID", 400],
    ["MILESTONE_SOURCE_NOT_FOUND", 404], ["UNKNOWN_REWARD_POLICY_VERSION", 400], ["PAYLOAD_VALIDATION_FAILED", 422],
  ])("safe domain error %s -> %s", async (message, status) => {
    const response = milestoneErrorResponse(new MilestoneRepositoryError(String(message), "P0001"));
    expect(response.status).toBe(status); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: message, code: message });
  });
  test.each(["23505", "23514", "P0001", "42501"])("arbitrary SQL detail never escapes %s", async code => {
    const response = milestoneErrorResponse(new MilestoneRepositoryError("secret SQL table constraint", code));
    expect(response.status).toBe(code === "42501" ? 403 : 500);
    expect(await response.text()).not.toMatch(/secret|SQL|constraint/);
  });
  test.each(["constructor", "toString", "__proto__"])("inherited property %s is not an allowed domain error", async message => {
    for (const code of ["42501", "23505"]) {
      for (const error of [new MilestoneRepositoryError(message,code), new Phase8BRepositoryError({message,code})]) {
        const response=milestoneErrorResponse(error);
        expect(response.status).toBe(code==="42501"?403:500);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(await response.json()).toEqual(code==="42501"
          ? {error:"FORBIDDEN",code:"FORBIDDEN"}
          : {error:"Milestone request failed",code:"INTERNAL_ERROR"});
      }
    }
  });
});

describe("8F narrow existing proposal endpoint", () => {
  function milestoneRepo() {
    const value = { isMilestoneProposal: vi.fn().mockResolvedValue(true), reviewProposal: vi.fn().mockResolvedValue({ replayed: true, milestone: { id } }) };
    vi.mocked(getPhase8BRepository).mockResolvedValue(value as never); return value;
  }
  test("v2 full replacement and unknown payload fields reach authoritative SQL unchanged", async () => {
    const db = milestoneRepo(); const payload = { title: "proposal", amount: 999, nested: { user_id: id } };
    await review(request({ decision: "EDITED", editedPayload: payload, reviewRequestIdempotencyKey: " k ", rejectionReason: " reason " }), context());
    expect(db.reviewProposal).toHaveBeenCalledWith(id, "EDITED", "k", payload, "reason");
    db.reviewProposal.mockRejectedValue(new Phase8BRepositoryError({ message: "PAYLOAD_VALIDATION_FAILED", code: "22023" }));
    expect((await review(request({ decision: "ACCEPTED", reviewRequestIdempotencyKey: "k" }), context())).status).toBe(422);
  });
  test.each([{ userId: id }, { amount: 50 }, { rejectionReason: 5 }, { editedPayload: null }, { decision: {} }])("milestone envelope rejects %s", async extra => {
    const db = milestoneRepo(); const response = await review(request({ decision: "ACCEPTED", reviewRequestIdempotencyKey: "k", ...extra }), context());
    expect(response.status).toBe(400); expect(db.reviewProposal).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  test("replay error/body not rewritten using current milestone state", async () => {
    const db = milestoneRepo(); const response = await review(request({ decision: "ACCEPTED", reviewRequestIdempotencyKey: "k" }), context());
    expect(await response.json()).toEqual({ result: { replayed: true, milestone: { id } } });
    expect(db.isMilestoneProposal).toHaveBeenCalledExactlyOnceWith(id);
  });
  test("unknown milestone SQL failure is sanitized", async () => {
    const db = milestoneRepo(); db.reviewProposal.mockRejectedValue(new Phase8BRepositoryError({ message: "sensitive constraint detail", code: "23505" }));
    const response = await review(request({ decision: "REJECTED", reviewRequestIdempotencyKey: "k" }), context());
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("sensitive");
  });
  test.each(["42501", "23505", "P0001"])("routing read failure is sanitized before a branch exists: %s", async code => {
    const db = milestoneRepo();
    db.isMilestoneProposal.mockRejectedValue(new Phase8BRepositoryError({ message: "permission denied for table outer_loop_proposals", code }));
    const req = request("{", "", true); const parse = vi.spyOn(req, "json");
    const response = await review(req, context());
    expect(response.status).toBe(code === "42501" ? 403 : 500);
    expect(await response.json()).toEqual(code === "42501"
      ? { error: "FORBIDDEN", code: "FORBIDDEN" }
      : { error: "Milestone request failed", code: "INTERNAL_ERROR" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(parse).not.toHaveBeenCalled(); expect(db.reviewProposal).not.toHaveBeenCalled();
  });
});
