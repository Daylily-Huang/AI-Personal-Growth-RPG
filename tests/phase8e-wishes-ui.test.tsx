// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import WishesPage from "@/app/rewards/wishes/page";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import type { RewardTransaction, Wish } from "@/lib/reward/types";

let pathname = "/rewards/wishes";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const txId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const receiptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const proposalId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const stamp = "2026-10-01T12:00:00.000Z";
const sample: Wish = { id, user_id: other, title: "读一本喜欢的书", description: "按自己的节奏", credit_cost: 75, status: "IDEA", cooldown_until: null, created_at: stamp, updated_at: stamp };
const balance = { lifetime_earned: 500, net_earned: 450, lifetime_redeemed: 100, current_reserved: 75, current_available: 275, correction_deficit: 0 };
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function section(title: string) { return within(screen.getByRole("heading", { name: title }).closest('[data-testid="section-card"]') as HTMLElement); }

describe("Phase 8E Wishes UI", () => {
  let wishes: Wish[];
  let transactions: Partial<RewardTransaction>[];
  let receipts: Record<string, unknown>[];
  let proposals: Record<string, unknown>[];
  let fetchMock: ReturnType<typeof vi.fn>;
  let responder: (url: URL, init?: RequestInit) => Promise<Response>;
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  beforeEach(() => {
    wishes = [{ ...sample }]; transactions = []; receipts = []; proposals = [];
    pathname = "/rewards/wishes";
    responder = async (url, init) => {
      if (init?.method === "POST" || init?.method === "PATCH") return response({ ok: true, replayed: false, wish: sample });
      if (url.pathname === "/api/rewards/account") return response({ account: { ...balance, id }, balance });
      if (url.pathname === "/api/rewards/wishes") return response({ wishes, nextOffset: null });
      if (url.pathname === `/api/rewards/wishes/${id}`) return response({ wish: wishes.find(wish => wish.id === id) ?? sample });
      if (url.pathname.endsWith("/proposals")) return response({ proposals, nextOffset: null });
      if (url.pathname === "/api/rewards/sources") return response({ authoritative: false, sources: [], nextOffset: null });
      if (url.pathname === "/api/rewards/transactions") return response({ transactions, nextOffset: null });
      if (url.pathname === "/api/rewards/redemptions") return response({ redemptions: receipts, nextOffset: null });
      return response({ code: "NOT_FOUND" }, 404);
    };
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responder(new URL(String(input), "http://localhost"), init));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  async function ready() { render(<WishesPage />); return screen.findByRole("article", { name: `心愿 ${sample.title}` }); }
  function seedProposal() { proposals = [{ id: proposalId, status: "PROPOSED", payload: { wish_id: id, suggested_credits: 80, rationale: "从实际需要出发" }, source_refs: [{ source_id: txId }], expires_at: "2099-01-01T00:00:00Z", created_at: stamp, resulting_entity_id: null }]; }
  async function openProposals() {
    await ready(); fireEvent.click(screen.getByRole("button", { name: "查看定价建议" }));
    return screen.findByRole("article", { name: `定价提案 ${proposalId}` });
  }
  test("distinct server balances, read-only mount and explicit source limitations", async () => {
    await ready();
    await waitFor(() => expect(screen.getByLabelText("可用积分").textContent).toBe("275"));
    expect(screen.getByLabelText("已预留").textContent).toBe("75");
    expect(screen.getByLabelText("净获得").textContent).toBe("450");
    expect(screen.getByLabelText("累计兑换").textContent).toBe("100");
    expect(screen.getByText(/产物与现实里程碑奖励暂未开放/)).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });
  test("missing account is displayed as zero without any initialization write", async () => {
    const base = responder;
    responder = async (url, init) => url.pathname === "/api/rewards/account" ? response({ account: null, balance: Object.fromEntries(Object.keys(balance).map(key => [key, 0])) }) : base(url, init);
    await ready(); await waitFor(() => expect(screen.getByLabelText("可用积分").textContent).toBe("0"));
    expect(posts()).toHaveLength(0);
  });
  test("create only sends user metadata and preserves draft after failure", async () => {
    await ready(); fireEvent.click(screen.getByRole("button", { name: "新建心愿" }));
    fireEvent.change(screen.getByLabelText("心愿名称"), { target: { value: "安静散步" } });
    fireEvent.change(screen.getByLabelText("积分预算（可暂不填写）"), { target: { value: "60" } });
    const base = responder;
    responder = async (url, init) => init?.method === "POST" ? response({ code: "FORBIDDEN" }, 403) : base(url, init);
    fireEvent.click(screen.getByRole("button", { name: "保存心愿" }));
    await screen.findByRole("alert");
    expect((screen.getByLabelText("心愿名称") as HTMLInputElement).value).toBe("安静散步");
    expect(JSON.parse(posts()[0][1].body)).toEqual({ title: "安静散步", description: "", creditCost: 60 });
  });
  test.each([
    ["IDEA", "激活心愿", "activate"], ["ACTIVE", "设为当前目标", "set-primary"], ["PRIMARY", "预留积分", "reserve"],
    ["RESERVED", "释放预留", "unreserve"], ["RESERVED", "兑换心愿", "redeem"], ["ACTIVE", "归档心愿", "archive"], ["ACTIVE", "取消心愿", "cancel"],
  ] as const)("%s action %s requires an explicit confirmation and one bounded request", async (status, label, action) => {
    wishes = [{ ...sample, status }];
    const card = await ready(); fireEvent.click(within(card).getByRole("button", { name: label }));
    const dialog = await screen.findByRole("dialog"); expect(posts()).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(String(posts()[0][0])).toBe(`/api/rewards/wishes/${id}/${action}`);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ requestIdempotencyKey: expect.any(String), ...(action === "redeem" ? { celebrationNote: null } : {}) });
  });
  test("uncertain financial retries preserve exact key and body", async () => {
    wishes = [{ ...sample, status: "PRIMARY" }]; const base = responder; let count = 0;
    responder = async (url, init) => { if (url.pathname.endsWith("/reserve") && ++count === 1) throw new TypeError("network dropped"); return base(url, init); };
    const card = await ready(); fireEvent.click(within(card).getByRole("button", { name: "预留积分" }));
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "重试同一请求" }));
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[1][1].body).toBe(posts()[0][1].body);
  });
  test("pending confirmation blocks duplicate clicks and Escape without changing payload", async () => {
    wishes = [{ ...sample, status: "PRIMARY" }]; const base = responder;
    let release!: (value: Response) => void;
    responder = async (url, init) => init?.method === "POST" ? new Promise<Response>(resolve => { release = resolve; }) : base(url, init);
    const card = await ready(); fireEvent.click(within(card).getByRole("button", { name: "预留积分" }));
    const submit = screen.getByRole("button", { name: "确认操作" });
    fireEvent.click(submit); fireEvent.click(submit); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(posts()).toHaveLength(1); expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { release(response({ ok: true, replayed: false })); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  test("long target and full financial effect remain in the modal body, never a truncated description", async () => {
    wishes = [{ ...sample, title: "长心愿".repeat(75), status: "RESERVED" }]; render(<WishesPage />);
    const card = await screen.findByRole("article", { name: `心愿 ${wishes[0].title}` });
    fireEvent.click(within(card).getByRole("button", { name: "兑换心愿" }));
    const effect = within(screen.getByTestId("base-modal-body")).getByText(/使用已预留的 75 积分兑换/);
    expect(effect.textContent).toContain(wishes[0].title); expect(effect.className).not.toContain("truncate");
    expect(effect.textContent).toContain("七天冷却"); expect(posts()).toHaveLength(0);
  });
  test("successful mutation followed by failed refresh never resubmits the mutation", async () => {
    wishes = [{ ...sample, status: "PRIMARY" }]; const base = responder; let committed = false;
    responder = async (url, init) => {
      if (init?.method === "POST") { committed = true; return response({ ok: true, replayed: false }); }
      if (committed && url.pathname === "/api/rewards/account") return response({ code: "INTERNAL_ERROR" }, 500);
      return base(url, init);
    };
    const card = await ready(); fireEvent.click(within(card).getByRole("button", { name: "预留积分" }));
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    await screen.findByRole("alert"); expect(screen.getByText(/操作已完成。正在重新读取/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新读取" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  test("selected target is discoverable and actionable beyond the first page", async () => {
    const base = responder;
    responder = async (url, init) => url.pathname === "/api/rewards/wishes" && url.searchParams.get("limit") === "100"
      ? response(url.searchParams.get("offset") === "0" ? { wishes: [sample], nextOffset: 100 } : { wishes: [{ ...sample, id: other, status: "PRIMARY", title: "更早的目标" }], nextOffset: null })
      : base(url, init);
    await ready(); await screen.findByRole("heading", { name: "更早的目标" });
    fireEvent.click(screen.getByRole("button", { name: "当前目标：预留积分" })); fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(String(posts()[0]?.[0])).toBe(`/api/rewards/wishes/${other}/reserve`));
  });
  test("frozen-budget and terminal wishes cannot expose metadata editing", async () => {
    wishes = [{ ...sample, status: "REDEEMED", cooldown_until: "2099-01-01T00:00:00Z" }];
    const card = await ready(); expect(within(card).queryByRole("button", { name: "编辑心愿" })).toBeNull();
    expect(within(card).queryByRole("button", { name: "兑换心愿" })).toBeNull();
    expect(within(card).getByText(/兑换冷却截至/)).toBeTruthy();
  });
  test.each(["correct", "refund"])("%s requires a reason and keeps immutable history visible", async kind => {
    transactions = [{ id: txId, event_kind: "EARN", amount: 100, canonical_source_type: "QUEST", canonical_source_id: other, created_at: stamp }];
    receipts = [{ id: receiptId, wish_id: id, credits_spent: 75, celebration_note: "留给自己的时间", redeemed_at: stamp, refunded: false }];
    await ready(); fireEvent.click(await screen.findByRole("button", { name: kind === "correct" ? "修正这笔发放" : "申请积分退款" }));
    expect((screen.getByRole("button", { name: "确认操作" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("操作说明（必填）"), { target: { value: "核对后修正" } });
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1].body)).toEqual({ note: "核对后修正", requestIdempotencyKey: expect.any(String) });
    expect(String(posts()[0][0])).toBe(kind === "correct" ? `/api/rewards/transactions/${txId}/correct` : `/api/rewards/redemptions/${receiptId}/refund`);
  });
  test("refund-derived state hides repeat refund and retains the receipt", async () => {
    receipts = [{ id: receiptId, wish_id: id, credits_spent: 75, redeemed_at: stamp, refunded: true }];
    await ready(); expect(await screen.findByText(/已退款（原凭证保留）/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "申请积分退款" })).toBeNull();
    expect(screen.getByText(`凭证编号：${receiptId}`)).toBeTruthy();
  });
  test("source selection sends identity and policy, never a client-supplied amount", async () => {
    const base = responder;
    responder = async (url, init) => url.pathname === "/api/rewards/sources" ? response({ sources: [{ id: other, sourceType: "QUEST", sourceId: other, label: "完成写作", alreadyGranted: false }], nextOffset: null }) : base(url, init);
    await ready(); fireEvent.click(await screen.findByRole("button", { name: "核验并领取" }));
    expect(posts()).toHaveLength(0); fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1].body)).toEqual({ sourceType: "QUEST", sourceId: other, policyVersion: "reward-v1", requestIdempotencyKey: expect.any(String) });
  });
  test("ledger pagination appends rather than silently dropping older history", async () => {
    const base = responder;
    responder = async (url, init) => url.pathname === "/api/rewards/transactions" ? response({ transactions: [{ id: url.searchParams.get("offset") === "0" ? txId : other, event_kind: "EARN", amount: 100, canonical_source_type: "QUEST", canonical_source_id: other, created_at: stamp }], nextOffset: url.searchParams.get("offset") === "0" ? 20 : null }) : base(url, init);
    await ready(); fireEvent.click(await section("奖励账本").findByRole("button", { name: "加载更多" }));
    await waitFor(() => expect(section("奖励账本").getAllByRole("listitem")).toHaveLength(2));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("transactions?limit=20&offset=20"))).toBe(true);
  });
  test.each(["wishes", "sources", "redemptions"])("%s pagination preserves the first page", async collection => {
    const base = responder;
    responder = async (url, init) => {
      if (url.pathname !== `/api/rewards/${collection}`) return base(url, init);
      const second = url.searchParams.get("offset") === "20";
      const itemId = second ? other : id;
      const item = collection === "wishes" ? { ...sample, id: itemId, title: second ? "较早的心愿" : sample.title }
        : collection === "sources" ? { id: itemId, sourceType: "QUEST", sourceId: itemId, label: second ? "较早的任务" : "新任务", alreadyGranted: true }
        : { id: itemId, wish_id: id, credits_spent: 75, redeemed_at: stamp, refunded: true };
      return response({ [collection]: [item], nextOffset: second || url.searchParams.get("limit") === "100" ? null : 20 });
    };
    await ready(); const list = section(collection === "wishes" ? "心愿清单" : collection === "sources" ? "核验成长奖励" : "兑换记录");
    fireEvent.click(await list.findByRole("button", { name: "加载更多" }));
    await waitFor(() => expect(list.getAllByRole(collection === "wishes" ? "article" : "listitem")).toHaveLength(2));
    expect(list.queryByRole("button", { name: "加载更多" })).toBeNull();
  });
  test("late source response cannot replace the newly selected source category", async () => {
    const base = responder; let release!: (value: Response) => void;
    responder = async (url, init) => url.pathname === "/api/rewards/sources"
      ? url.searchParams.get("sourceType") === "QUEST" ? new Promise<Response>(resolve => { release = resolve; })
        : response({ sources: [{ id: other, sourceType: "SEASON", sourceId: other, label: "新的赛季结果", alreadyGranted: true }], nextOffset: null })
      : base(url, init);
    await ready(); fireEvent.change(screen.getByRole("combobox", { name: "奖励来源" }), { target: { value: "SEASON" } });
    await screen.findByText("新的赛季结果");
    await act(async () => { release(response({ sources: [{ id, sourceType: "QUEST", sourceId: id, label: "迟到的任务结果", alreadyGranted: false }], nextOffset: null })); });
    expect(screen.queryByText("迟到的任务结果")).toBeNull(); expect(screen.getByText("新的赛季结果")).toBeTruthy();
  });
  test("older cost proposals are reachable without dropping original payloads", async () => {
    seedProposal(); const base = responder;
    responder = async (url, init) => url.pathname.endsWith("/proposals") ? response({ proposals: [{ ...proposals[0], id: url.searchParams.get("offset") === "20" ? other : proposalId }], nextOffset: url.searchParams.get("offset") === "20" ? null : 20 }) : base(url, init);
    await openProposals(); fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    await screen.findByRole("article", { name: `定价提案 ${other}` }); expect(screen.getByRole("article", { name: `定价提案 ${proposalId}` })).toBeTruthy();
  });
  test("A-B-A navigation discards an old load-more response and retains the new middle page", async () => {
    const base = responder; let generation = 0; let release!: (value: Response) => void;
    const source = (sourceId: string, label: string) => ({ id: sourceId, sourceType: "QUEST", sourceId, label, alreadyGranted: true });
    responder = async (url, init) => {
      if (url.pathname !== "/api/rewards/sources") return base(url, init);
      if (url.searchParams.get("sourceType") !== "QUEST") return response({ sources: [], nextOffset: null });
      const offset = Number(url.searchParams.get("offset"));
      if (offset === 0) { generation++; return response({ sources: [source(id, generation === 1 ? "旧首屏" : "新首屏")], nextOffset: 20 }); }
      if (generation === 1) return new Promise<Response>(resolve => { release = resolve; });
      return response({ sources: [source(offset === 20 ? other : txId, offset === 20 ? "不能遗漏的中间页" : "新末页")], nextOffset: offset === 20 ? 40 : null });
    };
    await ready(); fireEvent.click(await section("核验成长奖励").findByRole("button", { name: "加载更多" }));
    fireEvent.change(screen.getByRole("combobox", { name: "奖励来源" }), { target: { value: "SEASON" } });
    await screen.findByText(/当前没有这一类来源/);
    fireEvent.change(screen.getByRole("combobox", { name: "奖励来源" }), { target: { value: "QUEST" } });
    await screen.findByText("新首屏");
    await act(async () => { release(response({ sources: [source(txId, "旧末页")], nextOffset: null })); });
    expect(screen.queryByText("旧末页")).toBeNull();
    fireEvent.click(section("核验成长奖励").getByRole("button", { name: "加载更多" }));
    await screen.findByText("不能遗漏的中间页");
    fireEvent.click(section("核验成长奖励").getByRole("button", { name: "加载更多" }));
    await screen.findByText("新末页"); expect(section("核验成长奖励").getAllByRole("listitem")).toHaveLength(3);
  });
  test("successful lifecycle refresh moves keyboard focus to a stable completion status", async () => {
    const base = responder;
    responder = async (url, init) => {
      if (init?.method === "POST") wishes = [{ ...sample, status: "ACTIVE" }];
      return base(url, init);
    };
    const card = await ready(); const opener = within(card).getByRole("button", { name: "激活心愿" }); opener.focus(); fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    await screen.findByRole("button", { name: "设为当前目标" });
    expect(document.activeElement).toBe(screen.getByText(/操作已完成。正在重新读取/));
  });
  test.each(["ACCEPTED", "EDITED", "REJECTED"])("cost proposal %s is informed, explicit and uses only existing review", async decision => {
    seedProposal(); const card = await openProposals();
    fireEvent.click(within(card).getByText("查看原始提案与来源"));
    expect(within(card).getByText(/从实际需要出发/)).toBeTruthy();
    if (decision === "EDITED") fireEvent.change(within(card).getByLabelText("调整后的积分预算"), { target: { value: "90" } });
    const label = decision === "ACCEPTED" ? "接受建议" : decision === "EDITED" ? "调整后接受" : "拒绝建议";
    if (decision !== "REJECTED") {
      expect((within(card).getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(within(card).getByRole("checkbox"));
    }
    fireEvent.click(within(card).getByRole("button", { name: label })); expect(posts()).toHaveLength(0);
    if (decision === "REJECTED") fireEvent.change(screen.getByLabelText("操作说明（必填）"), { target: { value: "不符合当前需要" } });
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(String(posts()[0][0])).toBe(`/api/outer-loop/proposals/${proposalId}/review`);
    const body = JSON.parse(posts()[0][1].body);
    expect(body).toMatchObject({ decision, reviewRequestIdempotencyKey: expect.any(String) });
    if (decision === "EDITED") expect(body.editedPayload).toEqual({ wish_id: id, suggested_credits: 90, rationale: "从实际需要出发" });
    if (decision === "REJECTED") expect(body.rejectionReason).toBe("不符合当前需要");
  });
  test("expired proposals cannot be accepted", async () => {
    seedProposal(); proposals[0].expires_at = "2000-01-01T00:00:00Z";
    const card = await openProposals(); fireEvent.click(within(card).getByRole("checkbox"));
    expect((within(card).getByRole("button", { name: "接受建议" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(card).getByText("提案已过期，不能接受或拒绝。")).toBeTruthy();
    const reject = within(card).getByRole("button", { name: "拒绝建议" });
    expect((reject as HTMLButtonElement).disabled).toBe(true); fireEvent.click(reject);
    expect(screen.queryByRole("dialog")).toBeNull(); expect(posts()).toHaveLength(0);
  });
  test("loading, empty and authentication failures do not pretend to have usable data", async () => {
    wishes = []; render(<WishesPage />); expect(screen.getByText("正在读取余额…")).toBeTruthy();
    expect(await screen.findByText(/还没有心愿/)).toBeTruthy(); cleanup();
    responder = async () => response({ code: "UNAUTHORIZED" }, 401);
    render(<WishesPage />); await waitFor(() => expect(screen.getAllByRole("link", { name: "重新登录" }).length).toBeGreaterThan(0));
    expect(screen.getByLabelText("可用积分").textContent).toBe("—"); expect(posts()).toHaveLength(0);
  });
  test("Escape closes a confirmation and restores keyboard focus without mutation", async () => {
    const card = await ready(); const opener = within(card).getByRole("button", { name: "激活心愿" }); opener.focus(); fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener); expect(posts()).toHaveLength(0);
  });
  test("desktop and mobile expose both sections, with segment-safe active states", () => {
    pathname = "/journey/journal";
    render(<><AppSidebar collapsed={false} onToggleCollapse={() => {}} /><MobileNav /></>);
    for (const link of screen.getAllByRole("link", { name: "成长旅程" })) expect(link.getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link", { name: "心愿" })).toHaveLength(2);
    expect(within(screen.getByTestId("mobile-nav")).getAllByRole("link")).toHaveLength(7);
    cleanup(); pathname = "/journey-other"; render(<MobileNav />);
    expect(screen.getByRole("link", { name: "成长旅程" }).getAttribute("aria-current")).toBeNull();
  });
});
