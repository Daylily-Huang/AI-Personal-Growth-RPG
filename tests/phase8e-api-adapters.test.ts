import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/reward/service", () => ({ getRewardService: vi.fn() }));
import { getRewardService } from "@/lib/reward/service";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { RewardRepository, RewardRepositoryError } from "@/lib/reward/repository";
import { rewardErrorResponse } from "@/lib/reward/http";
import { WISH_ACTIONS } from "@/lib/reward/types";
import { GET as account } from "@/app/api/rewards/account/route";
import { GET as transactions } from "@/app/api/rewards/transactions/route";
import { GET as redemptions } from "@/app/api/rewards/redemptions/route";
import { GET as sources } from "@/app/api/rewards/sources/route";
import { GET as wishes, POST as create } from "@/app/api/rewards/wishes/route";
import { GET as getWish, PATCH as edit } from "@/app/api/rewards/wishes/[id]/route";
import { GET as proposals } from "@/app/api/rewards/wishes/[id]/proposals/route";
import { POST as action } from "@/app/api/rewards/wishes/[id]/[action]/route";
import { POST as grant } from "@/app/api/rewards/grants/route";
import { POST as correct } from "@/app/api/rewards/transactions/[id]/correct/route";
import { POST as refund } from "@/app/api/rewards/redemptions/[id]/refund/route";

const id = randomUUID();
const context = (target: string = id) => ({ params: Promise.resolve({ id: target }) });
const request = (body: unknown = {}, query = "") => new Request(`http://localhost/api/rewards${query}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const service = {
  account: vi.fn(), transactions: vi.fn(), redemptions: vi.fn(), sources: vi.fn(), wishes: vi.fn(),
  wish: vi.fn(), createWish: vi.fn(), editWish: vi.fn(), proposals: vi.fn(), wishAction: vi.fn(),
  grant: vi.fn(), correct: vi.fn(), refund: vi.fn(),
};
const key = { requestIdempotencyKey: "r3-key" };
const grantBody = { ...key, sourceType: "QUEST", sourceId: id, policyVersion: "reward-v1" };

describe("Phase 8E Round 3 HTTP boundary", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getRewardService).mockResolvedValue(service as never); });

  const endpoints = [
    () => account(), () => transactions(request()), () => redemptions(request()), () => sources(request()),
    () => wishes(request()), () => create(request()), () => getWish(request(), context()),
    () => edit(request(), context()), () => proposals(request(), context()),
    ...WISH_ACTIONS.map(a => () => action(request(), { params: Promise.resolve({ id, action: a }) })),
    () => grant(request()), () => correct(request(), context()), () => refund(request(), context()),
  ];
  test.each(endpoints.map((run, i) => ({ run, i })))("endpoint $i authenticates before parsing", async ({ run }) => {
    vi.mocked(getRewardService).mockRejectedValue(new AuthRequiredError());
    const response = await run();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
  });
  test.each([null, [], 2, "x"])("rejects non-object %j bodies", async body => {
    expect((await create(request(body))).status).toBe(400);
    expect(service.createWish).not.toHaveBeenCalled();
  });
  test("malformed JSON is a 400 after authentication", async () => {
    expect((await create(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
  });
  test.each(["userId", "user_id", "status", "amount", "current_available", "created_at", "cooldown_until"])("metadata rejects %s", async field => {
    expect((await create(request({ title: "x", [field]: "forged" }))).status).toBe(400);
    expect((await edit(request({ [field]: "forged" }), context())).status).toBe(400);
    expect(service.createWish).not.toHaveBeenCalled(); expect(service.editWish).not.toHaveBeenCalled();
  });
  test.each([0, -1, 1.5, "100", 2147483648, true])("rejects invalid credit cost %j", async creditCost => {
    expect((await create(request({ title: "x", creditCost }))).status).toBe(400);
    expect(service.createWish).not.toHaveBeenCalled();
  });
  test("metadata normalizes content but retains explicit null cost", async () => {
    service.createWish.mockResolvedValue({ id, status: "IDEA" });
    expect((await create(request({ title: "  散步  ", description: " 空白 ", creditCost: null }))).status).toBe(201);
    expect(service.createWish).toHaveBeenCalledWith({ title: "散步", description: "空白", creditCost: null });
    expect((await edit(request({}), context())).status).toBe(400);
    expect((await edit(request({ title: "x" }), context("bad"))).status).toBe(400);
  });
  test.each(["?limit=0", "?limit=101", "?limit=2.2", "?offset=-1", "?offset=999999999999999999", "?limit=2&limit=3", "?userId=x"])("rejects query %s", async query => {
    expect((await wishes(request({}, query))).status).toBe(400);
    expect(service.wishes).not.toHaveBeenCalled();
  });
  test("pagination and source type remain operational only", async () => {
    service.sources.mockResolvedValue({ items: [{ sourceId: id }], nextOffset: 4 });
    const response = await sources(request({}, "?sourceType=QUEST&offset=2&limit=2"));
    expect(service.sources).toHaveBeenCalledWith("QUEST", { offset: 2, limit: 2 });
    expect(await response.json()).toMatchObject({ authoritative: false, nextOffset: 4 });
    expect((await sources(request({}, "?sourceType=ARTIFACT"))).status).toBe(400);
  });
  test("proposal route normalizes UUID case without changing pagination", async () => {
    const target = "abcdef12-abcd-4abc-8def-abcdef123456";
    service.proposals.mockResolvedValue({ items: [], nextOffset: null });
    const response = await proposals(request({}, "?limit=2&offset=4"), context(target.toUpperCase()));
    expect(response.status).toBe(200);
    expect(service.proposals).toHaveBeenCalledExactlyOnceWith(target, { limit: 2, offset: 4 });
  });
  test.each(WISH_ACTIONS)("%s invokes one bound authority action", async name => {
    service.wishAction.mockResolvedValue({ ok: true, replayed: false });
    const response = await action(request(key), { params: Promise.resolve({ id, action: name }) });
    expect(response.status).toBe(200);
    expect(service.wishAction).toHaveBeenCalledExactlyOnceWith(id, name, "r3-key", undefined);
    expect(service.wish).not.toHaveBeenCalled();
  });
  test("unknown actions, forged lifecycle payload and overlong keys fail closed", async () => {
    expect((await action(request(key), { params: Promise.resolve({ id, action: "delete" }) })).status).toBe(404);
    expect((await action(request({ ...key, amount: 1 }), { params: Promise.resolve({ id, action: "reserve" }) })).status).toBe(400);
    expect((await grant(request({ ...grantBody, requestIdempotencyKey: "a".repeat(201) }))).status).toBe(400);
    expect(service.wishAction).not.toHaveBeenCalled(); expect(service.grant).not.toHaveBeenCalled();
  });
  test("grant accepts no amount, user or policy bypass", async () => {
    for (const field of ["amount", "user_id", "verified", "status"]) {
      expect((await grant(request({ ...grantBody, [field]: 999 }))).status).toBe(400);
    }
    expect(service.grant).not.toHaveBeenCalled();
    service.grant.mockResolvedValue({ ok: true, replayed: true });
    expect((await grant(request({ ...grantBody, sourceType: " quest " }))).status).toBe(200);
    expect(service.grant).toHaveBeenCalledExactlyOnceWith(grantBody);
  });
  test.each([["FARMING_SOURCE_REJECTED", 400], ["SOURCE_CLASS_NOT_YET_AVAILABLE", 422]] as const)("stored rejection %s keeps status and snapshot", async (code, status) => {
    for (const replayed of [false, true]) {
      service.grant.mockResolvedValue({ ok: false, replayed, error_code: code, source_id: id });
      const response = await grant(request(grantBody));
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ ok: false, replayed, code, source_id: id });
    }
  });
  test("correction and refund require explanation and prohibit amount overrides", async () => {
    for (const run of [correct, refund]) {
      expect((await run(request(key), context())).status).toBe(400);
      expect((await run(request({ ...key, note: "why", amount: -9 }), context())).status).toBe(400);
    }
    service.correct.mockResolvedValue({ ok: true, replayed: true });
    service.refund.mockResolvedValue({ ok: true, replayed: false });
    expect((await correct(request({ ...key, note: " 原因 " }), context())).status).toBe(200);
    expect((await refund(request({ ...key, note: " 原因 " }), context())).status).toBe(200);
    expect(service.correct).toHaveBeenCalledExactlyOnceWith(id, "原因", "r3-key");
    expect(service.refund).toHaveBeenCalledExactlyOnceWith(id, "原因", "r3-key");
  });
  test.each([
    ["IDEMPOTENCY_KEY_REUSED", "23505", 409], ["WISH_NOT_FOUND", "P0002", 404],
    ["REWARD_SOURCE_NOT_ELIGIBLE", "23514", 422], ["INSUFFICIENT_REWARD_CREDITS", "22003", 422],
    ["REDEMPTION_COOLDOWN_ACTIVE", "23514", 422], ["INVALID_WISH_TRANSITION", "23514", 409],
  ])("maps %s without exposing internals", async (message, code, status) => {
    expect(rewardErrorResponse(new RewardRepositoryError(message, code)).status).toBe(status);
  });
  test("unknown errors never leak SQL or hints", async () => {
    const response = rewardErrorResponse(new RewardRepositoryError("select private_secret from internal_table", "42P01"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private_secret");
  });
});

describe("Phase 8E repository RPC allowlist", () => {
  test("all ten actions pass only frozen parameters and never prefetch targets", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, replayed: false }, error: null });
    const from = vi.fn();
    const repo = new RewardRepository({ rpc, from } as never, randomUUID());
    for (const name of WISH_ACTIONS) await repo.wishAction(id, name, "key", "note");
    await repo.grant(grantBody); await repo.correct(id, "why", "key"); await repo.refund(id, "why", "key");
    expect(rpc.mock.calls.map(c => c[0])).toEqual([
      "rpc_activate_wish", "rpc_set_primary_wish", "rpc_reserve_wish_credits", "rpc_unreserve_wish_credits",
      "rpc_redeem_wish", "rpc_archive_wish", "rpc_cancel_wish", "rpc_grant_reward_credit",
      "rpc_correct_reward_transaction", "rpc_refund_wish_redemption",
    ]);
    expect(rpc.mock.calls[4][1]).toEqual({ p_wish_id: id, p_request_idempotency_key: "key", p_celebration_note: "note" });
    expect(rpc.mock.calls[7][1]).toEqual({ p_source_type: "QUEST", p_source_id: id, p_policy_version: "reward-v1", p_request_idempotency_key: "r3-key" });
    expect(from).not.toHaveBeenCalled();
  });
});
