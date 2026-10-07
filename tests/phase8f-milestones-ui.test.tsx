// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import MilestonesPage from "@/app/rewards/milestones/page";
import { RewardsNav } from "@/components/rewards/RewardsNav";
import { MilestoneCommand, parseEditedMilestone, proposalReviewable } from "@/components/milestones/MilestoneCommand";
import { milestoneRequest, useMilestonePage } from "@/components/milestones/client";
import type { MilestoneProposal, MilestoneSource, MilestoneView } from "@/lib/milestone/types";
import { milestoneFixture, milestoneId, mutationReceipt, proposalFixture, proposalId, reviewReceipt, sourceFixture, sourceId, stamp, transactionFixture } from "./helpers/milestone-ui-fixtures";

let pathname = "/rewards/milestones";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function section(name: string) { return within(screen.getByRole("heading", { name }).closest('[data-testid="section-card"]') as HTMLElement); }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

describe("8F milestone UI: reads, informed commands and durable page-session retries", () => {
  let milestones: MilestoneView[]; let sources: MilestoneSource[]; let proposals: MilestoneProposal[];
  let responder: (url: URL, init?: RequestInit) => Promise<Response>;
  let fetchMock: ReturnType<typeof vi.fn>;
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  beforeEach(() => {
    milestones = [milestoneFixture()]; sources = [sourceFixture()]; proposals = []; pathname = "/rewards/milestones";
    responder = async (url, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return url.pathname.endsWith("/review")
          ? response(reviewReceipt(body, proposals.find(p => url.pathname.includes(p.id)) ?? proposalFixture()))
          : response(mutationReceipt(url.pathname, body));
      }
      if (url.pathname === "/api/milestones") return response({ milestones, nextOffset: null });
      if (url.pathname === "/api/milestones/sources") return response({ sources, nextOffset: null, authoritative: false });
      if (url.pathname === "/api/milestones/proposals") return response({ proposals, nextOffset: null, recognitionOnly: true });
      if (url.pathname === `/api/milestones/${milestoneId}`) return response({ milestone: milestones[0] ?? milestoneFixture() });
      return response({ code: "MILESTONE_NOT_FOUND" }, 404);
    };
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responder(new URL(String(input), "http://localhost"), init));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  async function ready() { render(<MilestonesPage />); await screen.findByRole("article", { name: "候选 已完成的 Epic" }); return screen.getByRole("article", { name: `成就 ${milestones[0]?.title ?? "完成研究计划"}` }); }
  async function prepare(label: string) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    const modal = await screen.findByRole("dialog");
    return within(modal);
  }
  function submit() { fireEvent.click(screen.getByRole("button", { name: "核对内容" })); expect(posts()).toHaveLength(0); fireEvent.click(screen.getByRole("button", { name: "确认提交" })); }

  test("mount and refresh are read-only; reality and Artifact boundaries are visible", async () => {
    await ready(); expect(posts()).toHaveLength(0);
    expect(screen.getByText(/Artifact（作品与产物）的成就认定和奖励均暂缓/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "刷新数据" })); await screen.findByRole("article", { name: "候选 已完成的 Epic" });
    expect(posts()).toHaveLength(0);
    expect(fetchMock.mock.calls.every(([, init]) => init.cache === "no-store" && init.credentials === "same-origin")).toBe(true);
  });
  test("local links expose aria-current without changing the top-level destinations", () => {
    const view = render(<RewardsNav />);
    expect(screen.getByRole("link", { name: "成就记录" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "心愿与积分" }).getAttribute("href")).toBe("/rewards/wishes");
    pathname = "/rewards/wishes"; view.rerender(<RewardsNav />);
    expect(screen.getByRole("link", { name: "心愿与积分" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "成就记录" }).hasAttribute("aria-current")).toBe(false);
  });
  test("Core confirmation uses exact semantic fields/key; cancellation and review step never POST", async () => {
    await ready(); screen.getByRole("button", { name: "核对并认定" }).focus(); await prepare("核对并认定");
    fireEvent.click(screen.getByRole("button", { name: "取消" })); expect(posts()).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "核对并认定" }));
    await prepare("核对并认定"); fireEvent.change(screen.getByLabelText("成就说明（选填）"), { target: { value: "来源核对" } });
    submit(); await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0][0]).toBe("/api/milestones");
    expect(JSON.parse(posts()[0][1].body)).toEqual({ milestoneKey: "core.quest", title: "已完成的 Epic", description: "来源核对", recognitionClass: "CORE_VERIFIED", sourceType: "QUEST", sourceId,
      externalEvidenceUrl: null, externalCredentialId: null, confirmationRequestIdempotencyKey: expect.any(String) });
    await screen.findByText(/操作已完成/); expect(posts()).toHaveLength(1);
  });
  test("reality UUID and metadata are self-attested, inert and never include amount authority", async () => {
    await ready(); await prepare("记录现实成就");
    expect(screen.getByText(/奖励积分为 0/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("成就名称"), { target: { value: "参加学术讨论" } });
    fireEvent.change(screen.getByLabelText("证据链接（仅记录，不验证）"), { target: { value: "javascript:alert('no-fetch')" } });
    fireEvent.change(screen.getByLabelText("证书或凭据说明（选填）"), { target: { value: "自述凭据" } });
    submit(); await screen.findByText(/操作已完成/);
    const body = JSON.parse(posts()[0][1].body);
    expect(body).toMatchObject({ recognitionClass: "USER_CONFIRMED_REAL_WORLD", sourceType: "EXTERNAL_CREDENTIAL", externalEvidenceUrl: "javascript:alert('no-fetch')", externalCredentialId: "自述凭据" });
    expect(body.sourceId).toMatch(/^[a-f0-9-]{36}$/); expect(body).not.toHaveProperty("amount");
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("/api/"))).toBe(true);
  });
  test.each(["network", "json", "receipt"])("%s uncertainty survives close/reopen with byte-identical request and source identity", async kind => {
    await ready(); const base = responder; let attempts = 0;
    responder = async (url, init) => {
      if (init?.method === "POST" && ++attempts === 1) {
        if (kind === "network") throw new TypeError("dropped");
        return kind === "json" ? new Response("<html>interrupted</html>") : response({ unrelated: true });
      }
      return base(url, init);
    };
    await prepare("记录现实成就"); fireEvent.change(screen.getByLabelText("成就名称"), { target: { value: "不确定提交" } });
    submit(); await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "暂时关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "继续核对原请求" }));
    expect((screen.getByRole("button", { name: "记录现实成就" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "刷新数据" })); await screen.findByRole("article", { name: "候选 已完成的 Epic" });
    fireEvent.click(screen.getByRole("button", { name: "继续核对原请求" }));
    expect(screen.queryByLabelText("成就名称")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重试同一请求" })); await screen.findByText(/操作已完成/);
    expect(posts()).toHaveLength(2); expect(posts()[1][1].body).toBe(posts()[0][1].body);
  });
  test("pending mutation blocks double click, Escape, backdrop and header dismissal", async () => {
    await ready(); const pending = deferred<Response>(); const base = responder;
    responder = async (url, init) => init?.method === "POST" ? pending.promise : base(url, init);
    await prepare("结算奖励"); fireEvent.click(screen.getByRole("button", { name: "核对内容" }));
    const button = screen.getByRole("button", { name: "确认提交" }); fireEvent.click(button); fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); fireEvent.click(screen.getByTestId("base-modal-backdrop")); fireEvent.click(screen.getByLabelText("关闭对话框"));
    expect(posts()).toHaveLength(1); expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => pending.resolve(response(mutationReceipt(String(posts()[0][0]), JSON.parse(posts()[0][1].body)))));
    await screen.findByText(/操作已完成/);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ policyVersion: "reward-v1", requestIdempotencyKey: expect.any(String) });
  });
  test("successful POST followed by failed refresh retries GET only", async () => {
    await ready(); const base = responder; let committed = false;
    responder = async (url, init) => {
      if (init?.method === "POST") { committed = true; return base(url, init); }
      return committed && url.pathname === "/api/milestones" ? response({ code: "INTERNAL_ERROR" }, 500) : base(url, init);
    };
    await prepare("结算奖励"); submit(); await screen.findByRole("alert");
    expect(screen.getByText(/操作已完成/)).toBeTruthy(); expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新读取" })); await screen.findByRole("alert"); expect(posts()).toHaveLength(1);
  });
  test("a new uncertain command cannot retain the previous command's success notice", async () => {
    await ready(); await prepare("结算奖励"); submit(); await screen.findByText(/操作已完成/);
    await screen.findByRole("button", { name: "撤销认定" }); const base = responder;
    responder = async (url, init) => init?.method === "POST" ? response({ ok: true, replayed: false, milestone: milestoneFixture() }) : base(url, init);
    await prepare("撤销认定"); expect(screen.queryByText(/操作已完成/)).toBeNull();
    fireEvent.change(screen.getByLabelText("操作原因（必填）"), { target: { value: "核对新操作" } });
    fireEvent.click(screen.getByRole("button", { name: "核对内容" })); fireEvent.click(screen.getByRole("button", { name: "确认提交" }));
    await screen.findByText(/未收到有效成功回执/); expect(screen.queryByText(/操作已完成/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "暂时关闭" })); expect(screen.getByRole("button", { name: "继续核对原请求" })).toBeTruthy();
    expect(posts()).toHaveLength(2);
  });
  test.each([
    ["Core", "source"], ["Core", "class"], ["Core", "key"], ["Core", "empty-id"], ["Core", "status"],
    ["reality", "source"], ["reality", "title"], ["settle", "target"], ["settle", "status"],
    ["settle", "unfunded"], ["settle", "transaction"], ["revoke", "target"], ["revoke", "status"],
    ["revoke", "key"], ["revoke", "reason"],
  ])("mismatched %s receipt (%s) stays uncertain and preserves the exact request through resume", async (kind, fault) => {
    await ready(); const base = responder; let attempts = 0;
    responder = async (url, init) => {
      if (init?.method !== "POST") return base(url, init);
      const receipt = mutationReceipt(url.pathname, JSON.parse(String(init.body)), attempts > 0);
      if (++attempts === 1) {
        if (fault === "source") receipt.milestone.source_id = proposalId;
        if (fault === "class") receipt.milestone.recognition_class = "USER_CONFIRMED_REAL_WORLD";
        if (fault === "target") receipt.milestone.id = proposalId;
        if (fault === "empty-id") receipt.milestone.id = "";
        if (fault === "status") receipt.milestone.status = kind === "revoke" ? "ACTIVE" : "REVOKED";
        if (fault === "key") { receipt.milestone.confirmation_request_idempotency_key = "wrong-key"; receipt.milestone.revocation_request_idempotency_key = "wrong-key"; }
        if (fault === "title") receipt.milestone.title = "不是提交的现实记录";
        if (fault === "reason") receipt.milestone.revocation_reason = "另一个操作的原因";
        if (fault === "unfunded") receipt.milestone.granted_reward_credit = false;
        if (fault === "transaction") receipt.milestone.reward_transaction_id = proposalId;
      }
      return response(receipt);
    };
    await prepare(kind === "Core" ? "核对并认定" : kind === "reality" ? "记录现实成就" : kind === "settle" ? "结算奖励" : "撤销认定");
    if (kind === "reality") fireEvent.change(screen.getByLabelText("成就名称"), { target: { value: "原始现实记录" } });
    if (kind === "revoke") fireEvent.change(screen.getByLabelText("操作原因（必填）"), { target: { value: "原始原因" } });
    submit(); await screen.findByText(/未收到有效成功回执/);
    expect(screen.queryByText(/操作已完成/)).toBeNull(); expect(screen.queryByRole("button", { name: "结束本次尝试" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "暂时关闭" }));
    expect((screen.getByRole("button", { name: "记录现实成就" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "继续核对原请求" }));
    fireEvent.click(screen.getByRole("button", { name: "重试同一请求" })); await screen.findByText(/操作已完成/);
    expect(posts()).toHaveLength(2); expect(posts()[1][0]).toBe(posts()[0][0]); expect(posts()[1][1].body).toBe(posts()[0][1].body);
  });
  test("revoke binds its separate key and full reason, retains linked correction explanation", async () => {
    const tx = transactionFixture(); const correction = transactionFixture({ id: sourceId, amount: -150, event_kind: "CORRECTION", correction_for_id: tx.id });
    milestones = [milestoneFixture({ granted_reward_credit: true, reward_transaction_id: tx.id, reward: { status: "CORRECTED", transaction: tx, correction, existingSourceReward: null } })];
    await ready(); await prepare("撤销认定");
    expect((screen.getByRole("button", { name: "核对内容" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/已经修正时只复用原冲正/)).toBeTruthy();
    expect(screen.getByText(/不撤回已兑换心愿/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("操作原因（必填）"), { target: { value: "  经核对撤销\n保留历史  " } });
    submit(); await screen.findByText(/操作已完成/);
    expect(posts()[0][0]).toBe(`/api/milestones/${milestoneId}/revoke`);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ revocationReason: "经核对撤销\n保留历史", revocationRequestIdempotencyKey: expect.any(String) });
  });
  test.each(["ISSUED", "CORRECTED", "NOT_AVAILABLE", "independent", "revoked"])("%s never exposes duplicate/ineligible settlement", async variant => {
    const tx = transactionFixture();
    milestones = [milestoneFixture(variant === "revoked" ? { status: "REVOKED", revocation_reason: "保留原因", revoked_at: stamp }
      : variant === "NOT_AVAILABLE" ? { recognition_class: "USER_CONFIRMED_REAL_WORLD", source_type: "EXTERNAL_CREDENTIAL", selfAttested: true, reward: { status: "NOT_AVAILABLE", transaction: null, correction: null, existingSourceReward: null } }
      : { reward: { status: variant === "independent" ? "NOT_ISSUED" : variant as "ISSUED" | "CORRECTED", transaction: variant === "independent" ? null : tx,
        correction: variant === "CORRECTED" ? transactionFixture({ amount: -150, event_kind: "CORRECTION" }) : null, existingSourceReward: variant === "independent" ? { transaction: tx, correction: null } : null } })];
    await ready(); expect(screen.queryByRole("button", { name: "结算奖励" })).toBeNull();
    if (variant === "revoked") { expect(screen.queryByRole("button", { name: "撤销认定" })).toBeNull(); expect(screen.getByText(/撤销原因：保留原因/)).toBeTruthy(); }
    if (variant === "independent") { expect(screen.getByText(/只读，未关联本成就/)).toBeTruthy(); await prepare("撤销认定"); expect(screen.getByText(/单独存在的来源奖励保持不变/)).toBeTruthy(); }
    expect(posts()).toHaveLength(0);
  });
  test.each(["ACTIVE", "REVOKED"] as const)("candidate with %s recognition links to history, no duplicate confirmation", async status => {
    sources = [sourceFixture({ recognition: { id: milestoneId, status }, existingSourceReward: { transaction: transactionFixture(), correction: null } })];
    await ready(); expect(screen.queryByRole("button", { name: "核对并认定" })).toBeNull();
    expect(screen.getByText(/关联情况请查看成就详情/)).toBeTruthy();
    await prepare("查看已有成就"); await screen.findByText("完整原始记录与奖励来源"); expect(posts()).toHaveLength(0);
  });
  test("detail keeps full long text, original key/proof and revoked reason inert", async () => {
    const title = "长文本v".repeat(60); const proof = "javascript:alert('unsafe')";
    milestones = [milestoneFixture({ title, status: "REVOKED", revoked_at: stamp, revocation_reason: "原因".repeat(200), external_evidence_url: proof, external_credential_id: "凭据原文" })];
    await ready(); const modal = await prepare("查看详情"); await modal.findByText("完整原始记录与奖励来源");
    expect(modal.getByRole("heading", { name: title }).className).not.toMatch(/truncate|line-clamp/);
    expect(modal.getByText(proof)).toBeTruthy(); expect(modal.queryAllByRole("link")).toHaveLength(0);
    expect(modal.getByText(/confirm-key/)).toBeTruthy(); expect(posts()).toHaveLength(0);
  });
  test.each([401, 404, 500])("detail %i shows safe error and no stale record", async status => {
    await ready(); const base = responder;
    responder = async (url, init) => url.pathname === `/api/milestones/${milestoneId}` ? response({ code: status === 401 ? "UNAUTHORIZED" : "internal SQL secret" }, status) : base(url, init);
    const modal = await prepare("查看详情"); await modal.findByRole("alert"); expect(modal.queryByText("完整原始记录与奖励来源")).toBeNull(); expect(modal.queryByText(/internal SQL secret/)).toBeNull();
    if (status === 401) expect(modal.getByRole("link", { name: "重新登录" }).getAttribute("href")).toBe("/login");
  });
  test("loading, all-empty lists and list401 are explicit and do not create records", async () => {
    milestones = []; sources = []; const first = deferred<Response>(); const base = responder;
    responder = async (url, init) => url.pathname === "/api/milestones" ? first.promise : base(url, init);
    render(<MilestonesPage />); expect(screen.getByText("正在读取成就记录…")).toBeTruthy();
    await act(async () => first.resolve(response({ milestones: [], nextOffset: null })));
    await screen.findByText(/当前筛选下还没有成就/); expect(screen.getByText(/当前没有此类提案/)).toBeTruthy();
    responder = async () => response({ code: "UNAUTHORIZED" }, 401); fireEvent.click(screen.getByRole("button", { name: "刷新数据" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: "重新登录" })).toHaveLength(3)); expect(posts()).toHaveLength(0);
  });
  test.each(["milestones", "sources", "proposals"])("%s pagination continues beyond1000, retries failed page and has no implicit cap", async field => {
    proposals = [proposalFixture()]; const base = responder; let fail = true;
    const endpoint = field === "milestones" ? "/api/milestones" : `/api/milestones/${field}`;
    const item = field === "milestones" ? milestoneFixture() : field === "sources" ? sourceFixture() : proposalFixture();
    const later = { ...item, id: "later-page", title: "历史尾页", label: "历史尾页" };
    responder = async (url, init) => {
      if (url.pathname !== endpoint) return base(url, init);
      const offset = url.searchParams.get("offset");
      if (offset === "0") return response({ [field]: [item], nextOffset: 1020 });
      if (fail) { fail = false; return response({ code: "INTERNAL_ERROR" }, 500); }
      return response({ [field]: [later], nextOffset: null });
    };
    render(<MilestonesPage />);
    const scope = section(field === "milestones" ? "成就记录" : field === "sources" ? "Core 成就候选" : "成就提案与历史");
    fireEvent.click(await scope.findByRole("button", { name: "加载更多" })); await scope.findByRole("alert");
    expect(scope.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(scope.getByRole("button", { name: "加载更多" }));
    await waitFor(() => expect(scope.getAllByRole("article")).toHaveLength(2)); expect(scope.queryByRole("button", { name: "加载更多" })).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith(endpoint) && String(url).includes("offset=1020"))).toHaveLength(2); expect(posts()).toHaveLength(0);
  });
  test("all filters are sent to the server; Mastery exact threshold absent for other sources", async () => {
    await ready(); fireEvent.change(screen.getByLabelText("记录状态"), { target: { value: "REVOKED" } });
    fireEvent.change(screen.getByLabelText("认定类别"), { target: { value: "USER_CONFIRMED_REAL_WORLD" } });
    fireEvent.change(screen.getByLabelText("提案状态"), { target: { value: "REJECTED" } });
    fireEvent.change(screen.getByLabelText("候选来源"), { target: { value: "MASTERY" } });
    for (const threshold of ["6", "8", "10"]) {
      fireEvent.change(screen.getByLabelText("验证阈值"), { target: { value: threshold } });
      await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`sourceType=MASTERY&threshold=${threshold}`))).toBe(true));
    }
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("status=REVOKED&recognitionClass=USER_CONFIRMED_REAL_WORLD"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("proposals?status=REJECTED"))).toBe(true);
    fireEvent.change(screen.getByLabelText("候选来源"), { target: { value: "SEASON" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("sourceType=SEASON&limit="))).toBe(true)); expect(posts()).toHaveLength(0);
  });
  test.each(["ACCEPTED", "EDITED", "REJECTED"] as const)("v2 %s keeps original provenance and emits exact sole-review tuple", async decision => {
    proposals = [proposalFixture()]; await ready();
    const article = await screen.findByRole("article", { name: `成就提案 ${proposalId}` });
    expect(within(article).getByText(/fixture-model/)).toBeTruthy(); expect(within(article).getByText(/嵌套来源/)).toBeTruthy(); expect(within(article).getByText(/来源原文/)).toBeTruthy();
    await prepare(decision === "ACCEPTED" ? "接受提案" : decision === "EDITED" ? "编辑后接受" : "拒绝提案");
    const edited = { ...proposalFixture().payload, title: "明确修改", external_credential_id: null, external_evidence_url: "文本链接" };
    if (decision === "EDITED") fireEvent.change(screen.getByLabelText(/完整替换内容/), { target: { value: JSON.stringify(edited) } });
    if (decision === "REJECTED") fireEvent.change(screen.getByLabelText("操作原因（必填）"), { target: { value: "不符合事实" } });
    submit(); await screen.findByText(/操作已完成/);
    expect(posts()).toHaveLength(1); expect(posts()[0][0]).toBe(`/api/outer-loop/proposals/${proposalId}/review`);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ decision, reviewRequestIdempotencyKey: expect.any(String), ...(decision === "EDITED" ? { editedPayload: edited } : {}), ...(decision === "REJECTED" ? { rejectionReason: "不符合事实" } : {}) });
    expect(proposals[0].payload.title).toBe("提案标题");
  });
  test("edited proposal never strips unknown authority fields into a successful request", async () => {
    proposals = [proposalFixture({ payload: { ...proposalFixture().payload, reward_credit_value: 9999 } })]; await ready(); await prepare("编辑后接受");
    fireEvent.click(screen.getByRole("button", { name: "核对内容" })); await screen.findByRole("alert");
    expect(posts()).toHaveLength(0); expect((screen.getByLabelText(/完整替换内容/) as HTMLTextAreaElement).value).toContain("reward_credit_value");
  });
  test.each([
    ["ACCEPTED", "missing"], ["ACCEPTED", "key"], ["ACCEPTED", "source"], ["ACCEPTED", "link"],
    ["EDITED", "title"], ["REJECTED", "reason"], ["REJECTED", "key"], ["REJECTED", "result"],
  ] as const)("review %s malformed %s receipt retains original request until valid replay", async (decision, fault) => {
    proposals = [proposalFixture()]; await ready(); const base = responder; let attempts = 0;
    responder = async (url, init) => {
      if (init?.method !== "POST") return base(url, init);
      const receipt = reviewReceipt(JSON.parse(String(init.body)), proposals[0], attempts > 0);
      if (++attempts === 1) {
        if (fault === "missing") receipt.result.milestone = null;
        if (fault === "key") receipt.result.proposal.review_request_idempotency_key = "different-review";
        if (fault === "source") receipt.result.milestone!.source_id = proposalId;
        if (fault === "title") receipt.result.milestone!.title = "不是已编辑内容";
        if (fault === "link") receipt.result.result!.milestone_id = proposalId;
        if (fault === "reason") receipt.result.proposal.rejection_reason = "另一条原因";
        if (fault === "result") receipt.result.milestone = milestoneFixture();
      }
      return response(receipt);
    };
    await prepare(decision === "ACCEPTED" ? "接受提案" : decision === "EDITED" ? "编辑后接受" : "拒绝提案");
    if (decision === "EDITED") fireEvent.change(screen.getByLabelText(/完整替换内容/), { target: { value: JSON.stringify({ ...proposals[0].payload, title: "已编辑原文" }) } });
    if (decision === "REJECTED") fireEvent.change(screen.getByLabelText("操作原因（必填）"), { target: { value: "原始拒绝原因" } });
    submit(); await screen.findByText(/未收到有效成功回执/); expect(screen.queryByText(/操作已完成/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "暂时关闭" })); fireEvent.click(screen.getByRole("button", { name: "继续核对原请求" }));
    fireEvent.click(screen.getByRole("button", { name: "重试同一请求" })); await screen.findByText(/操作已完成/);
    expect(posts()).toHaveLength(2); expect(posts()[1][1].body).toBe(posts()[0][1].body);
  });
  test.each(["braced", "compact", "grouped", "Mastery"])("review receipt accepts SQL-normalized %s identity without changing submitted payload", async spelling => {
    const canonical = spelling === "Mastery" ? `${sourceId}:M10` : sourceId;
    const rawSource = spelling === "braced" ? `{${sourceId.toUpperCase()}}` : spelling === "compact" ? sourceId.replaceAll("-", "").toUpperCase()
      : spelling === "grouped" ? sourceId.replaceAll("-", "").match(/.{4}/g)!.join("-").toUpperCase() : `${sourceId.toUpperCase()}:M10`;
    const payload = { ...proposalFixture().payload, title: " \u000b原始标题\u3000 ", description: " \t ", recognition_class: " core_verified ",
      source_type: spelling === "Mastery" ? " mastery " : " quest ", source_id: ` ${rawSource} ` };
    proposals = [proposalFixture({ payload })]; await ready(); const base = responder;
    responder = async (url, init) => init?.method === "POST" ? response(reviewReceipt(JSON.parse(String(init.body)), proposals[0], true,
      { ...payload, title: "原始标题", description: null, recognition_class: "CORE_VERIFIED", source_type: spelling === "Mastery" ? "MASTERY" : "QUEST", source_id: canonical })) : base(url, init);
    await prepare("接受提案"); submit(); await screen.findByText(/操作已完成/);
    expect(JSON.parse(posts()[0][1].body)).not.toHaveProperty("editedPayload"); expect(proposals[0].payload).toEqual(payload);
  });
  test.each([1, 3])("schema v%i is reject-only and cannot auto-upgrade", async version => {
    proposals = [proposalFixture({ schema_version: version, supportedSchema: false, availableDecisions: ["REJECTED"] })]; await ready();
    expect(screen.queryByRole("button", { name: "接受提案" })).toBeNull(); expect(screen.queryByRole("button", { name: "编辑后接受" })).toBeNull();
    await prepare("拒绝提案"); fireEvent.change(screen.getByLabelText("操作原因（必填）"), { target: { value: "版本不支持" } });
    submit(); await screen.findByText(/操作已完成/); expect(JSON.parse(posts()[0][1].body)).not.toHaveProperty("editedPayload");
  });
  test.each(["expired", "ACCEPTED", "EDITED", "REJECTED"])("proposal %s retains history without fresh decisions", async variant => {
    proposals = [proposalFixture(variant === "expired" ? { expires_at: stamp } : { status: variant as "ACCEPTED", availableDecisions: [], reviewed_at: stamp, rejection_reason: "历史原因" })];
    await ready(); await screen.findByRole("article", { name: `成就提案 ${proposalId}` });
    for (const name of ["接受提案", "编辑后接受", "拒绝提案"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.getByText(/fixture-model/)).toBeTruthy(); expect(posts()).toHaveLength(0);
  });
  test("expiry between preview and first submit blocks POST; same-key uncertain retry bypasses only client expiry", async () => {
    const current = Date.now(); vi.spyOn(Date, "now").mockReturnValue(current);
    proposals = [proposalFixture({ expires_at: new Date(current + 1000).toISOString() })]; await ready(); await prepare("接受提案");
    fireEvent.click(screen.getByRole("button", { name: "核对内容" })); vi.mocked(Date.now).mockReturnValue(current + 2000);
    fireEvent.click(screen.getByRole("button", { name: "确认提交" })); await screen.findByRole("alert"); expect(posts()).toHaveLength(0);
    vi.mocked(Date.now).mockReturnValue(current); const base = responder; let count = 0;
    responder = async (url, init) => { if (init?.method === "POST" && ++count === 1) throw new TypeError("lost"); return base(url, init); };
    fireEvent.click(screen.getByRole("button", { name: "确认提交" })); await screen.findByText(/连接中断/);
    vi.mocked(Date.now).mockReturnValue(current + 2000); fireEvent.click(screen.getByRole("button", { name: "重试同一请求" }));
    await screen.findByText(/操作已完成/); expect(posts()).toHaveLength(2); expect(posts()[1][1].body).toBe(posts()[0][1].body);
  });
  test("definite409 rejects without clearing original input until explicitly ended", async () => {
    await ready(); const base = responder;
    responder = async (url, init) => init?.method === "POST" ? response({ code: "REWARD_ALREADY_MINTED_FOR_SOURCE" }, 409) : base(url, init);
    await prepare("结算奖励"); submit(); await screen.findByRole("alert");
    expect(screen.getByText(/该来源已发放过奖励/)).toBeTruthy(); expect(screen.getByRole("button", { name: "重试同一请求" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "结束本次尝试" })); await screen.findByText(/本次尝试已结束/); expect(posts()).toHaveLength(1);
  });
});

describe("8F UI adversarial transport and complete replacement validation", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  test.each(["constructor", "toString", "__proto__", "hasOwnProperty", "raw SQL secret"])("error code %s is always safe text", async code => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ code, error: "sensitive details" }, 500)));
    await expect(milestoneRequest("/api/milestones")).rejects.toMatchObject({ message: "请求未完成（500），请核对历史后重试。", status: 500 });
  });
  test.each(["reward_credit_value", "amount", "user_id", "reward_transaction_id", "__proto__"])("edited payload rejects %s, never strips", key => {
    const payload = JSON.stringify(proposalFixture().payload).slice(0, -1) + `,"${key}":123}`;
    expect(() => parseEditedMilestone(payload)).toThrow(/不会静默裁剪/);
  });
  test.each(["null", "[]", "{", '{"title":"incomplete"}', JSON.stringify({ ...proposalFixture().payload, description: 42 }), JSON.stringify({ ...proposalFixture().payload, title: " " }), JSON.stringify({ ...proposalFixture().payload, source_id: "x".repeat(201) })])("invalid complete replacement fails: %s", text => {
    expect(() => parseEditedMilestone(text)).toThrow();
  });
  test("valid replacement retains null and optional fields without regenerating source identity", () => {
    const value = { ...proposalFixture().payload, external_evidence_url: null, external_credential_id: "凭据" };
    expect(parseEditedMilestone(JSON.stringify(value))).toEqual(value);
    expect(proposalReviewable(proposalFixture({ schema_version: 1 }), "ACCEPTED")).toBe(false);
  });
  test("confirmed success remains terminal even when parent does not unmount the command", async () => {
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => response(mutationReceipt("/settle", { requestIdempotencyKey: "key" }))));
    render(<MilestoneCommand intent={{ id: "key", kind: "settle", milestone: milestoneFixture() }} open onDismiss={() => {}} onPending={() => {}} onEnd={() => {}} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "核对内容" })); fireEvent.click(screen.getByRole("button", { name: "确认提交" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "重试同一请求" })); expect(fetch).toHaveBeenCalledTimes(1);
    // Parent deliberately did not unmount. Completion remains terminal in the child too.
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

function PagingProbe({ url }: { url: string }) {
  const page = useMilestonePage<{ id: string }>(url, "items", 0);
  return <><p>{page.items.map(item => item.id).join(",")}</p><p role="status">{page.loading ? "loading" : "ready"}</p>{page.error && <p role="alert">{page.error.message}</p>}<button onClick={page.more}>more</button><button onClick={page.retry}>retry</button></>;
}
describe("8F UI pagination generation discipline", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  test.each(["success", "failure"])("late %s from A cannot overwrite B→A fresh generation", async outcome => {
    const more = deferred<Response>(); let aReads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/a" && url.searchParams.get("offset") === "20") return more.promise;
      return response({ items: [{ id: url.pathname === "/a" ? `a-${++aReads}` : "b" }], nextOffset: 20 });
    }));
    const view = render(<PagingProbe url="/a" />); await screen.findByText("a-1");
    fireEvent.click(screen.getByText("more")); view.rerender(<PagingProbe url="/b" />); await screen.findByText("b");
    view.rerender(<PagingProbe url="/a" />); await screen.findByText("a-2");
    await act(async () => outcome === "success" ? more.resolve(response({ items: [{ id: "stale" }], nextOffset: null })) : more.reject(new Error("late error")));
    expect(screen.getByText("a-2")).toBeTruthy(); expect(screen.queryByText(/stale/)).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
  });
  test("aborted first-page response ignored even if fetch ignores abort", async () => {
    const slow = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.startsWith("/a") ? slow.promise : response({ items: [{ id: "new-b" }], nextOffset: null })));
    const view = render(<PagingProbe url="/a" />); view.rerender(<PagingProbe url="/b" />); await screen.findByText("new-b");
    await act(async () => slow.resolve(response({ items: [{ id: "old-a" }], nextOffset: null })));
    expect(screen.getByText("new-b")).toBeTruthy(); expect(screen.queryByText("old-a")).toBeNull();
  });
  test.each([0, -1, "20", 2147483548, 1.5, undefined])("invalid nextOffset %s is visible, not silently truncated", async nextOffset => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ items: [], nextOffset })));
    render(<PagingProbe url="/a" />); expect((await screen.findByRole("alert")).textContent).toMatch(/分页响应无效/);
  });
});
