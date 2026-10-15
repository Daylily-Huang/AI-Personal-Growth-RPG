// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettlementFeedback, { GrowthStage, GrowthRipple, settlementReceipt } from "@/components/dashboard/SettlementFeedback";
import DashboardPage from "@/app/dashboard/page";
import styles from "@/components/dashboard/SettlementFeedback.module.css";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/layout/AppShellContext", () => ({ useOptionalAppShell: () => null }));
vi.mock("@/components/dashboard", () => ({
  DashboardHeader: () => null, PlayerHeroCard: () => null, QuestsOverview: () => null, QuickLogCard: () => null,
  TopSkillsCard: () => null, PendingVerifications: () => null, RecentGrowthFeed: () => null, ActivityHistoryList: () => null,
  OverviewSummaryCards: () => null, LoadingState: () => <p>读取中</p>, ErrorState: () => <p>读取失败</p>, EmptyState: () => null, isFreshDashboard: () => false,
  PendingProposals: ({ onConfirm }: { onConfirm: (id: string) => void }) => <button onClick={() => onConfirm("33333333-3333-4333-8333-333333333333")}>测试确认入口</button>,
}));

const id = "11111111-1111-4111-8111-111111111111", activityId = "22222222-2222-4222-8222-222222222222", assessmentId = "33333333-3333-4333-8333-333333333333";
const transaction = { id, activityId, assessmentId, xpType: "activity", amount: 7, skillName: "真实技能" };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); window.localStorage.clear(); vi.unstubAllGlobals(); });
describe("Settlement receipt feedback", () => {
  it("spent celebration decorations are removed, while the receipt stays readable", () => {
    vi.useFakeTimers();
    const props = { receipt: { id, activityId, amount: 7, skillName: "真实技能" }, onDismiss: vi.fn() };
    const view = render(<><GrowthRipple /><SettlementFeedback {...props} /></>);
    expect(screen.getByTestId("settlement-sparks")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.queryByTestId("settlement-sparks")).toBeNull(); expect(screen.queryByTestId("growth-ripple")).toBeNull();
    view.rerender(<><GrowthRipple /><SettlementFeedback {...props} /></>);
    expect(screen.queryByTestId("settlement-sparks")).toBeNull(); expect(screen.getByText(/\+7 XP/)).toBeTruthy();
  });
  it("positive new settlements have twelve decorative sparks, never focusable controls", () => {
    render(<SettlementFeedback receipt={{ id, activityId, amount: 7, skillName: "真实技能" }} onDismiss={vi.fn()} />);
    const sparks = screen.getByTestId("settlement-sparks");
    expect(sparks.getAttribute("aria-hidden")).toBe("true");
    expect(sparks.children).toHaveLength(12);
    expect(sparks.querySelectorAll("button,a,[tabindex]")).toHaveLength(0);
  });
  it("zero or already presented receipts never emit settlement particles", () => {
    const view = render(<SettlementFeedback receipt={{ id, activityId, amount: 0, skillName: "记录" }} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId("settlement-sparks")).toBeNull();
    view.unmount(); render(<SettlementFeedback receipt={{ id, activityId, amount: 7, skillName: "记录" }} animateArrival={false} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId("settlement-sparks")).toBeNull();
  });
  it("level celebration waits for a higher authoritative refreshed level and retains its DOM on rerenders", () => {
    const props = { receipt: { id, activityId, amount: 7, skillName: "真实技能", previousPlayerLevel: 1 }, onDismiss: vi.fn() };
    const view = render(<SettlementFeedback {...props} />);
    expect(screen.queryByText("LEVEL UP")).toBeNull();
    view.rerender(<SettlementFeedback {...props} currentPlayerLevel={1} />); expect(screen.queryByText("LEVEL UP")).toBeNull();
    view.rerender(<SettlementFeedback {...props} currentPlayerLevel={2} />); const celebration = screen.getByTestId("level-celebration");
    expect(screen.getByLabelText("玩家等级 LV.2")).toBeTruthy();
    view.rerender(<SettlementFeedback {...props} currentPlayerLevel={2} />); expect(screen.getByTestId("level-celebration")).toBe(celebration);
  });
  it("motion preference is local, persists across mounts and does not hide content", async () => {
    const view = render(<GrowthStage><p>真实账本内容</p></GrowthStage>);
    const toggle = screen.getByRole("button", { name: /动态效果/ });
    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true")); fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false"); expect(window.localStorage.getItem("rpg:growth-effects")).toBe("off");
    view.unmount(); render(<GrowthStage><p>真实账本内容</p></GrowthStage>);
    await waitFor(() => expect(screen.getByRole("button", { name: /动态效果/ }).getAttribute("aria-pressed")).toBe("false"));
    expect(screen.getByText("真实账本内容")).toBeTruthy();
  });
  it("blocked browser storage still allows an in-memory motion choice", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("Storage disabled"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("Storage disabled"); });
    render(<GrowthStage><p>真实账本内容</p></GrowthStage>);
    const toggle = screen.getByRole("button", { name: /动态效果/ });
    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(toggle); expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("真实账本内容")).toBeTruthy();
  });
  it("an already presented receipt retains viewport positioning without replaying arrival", () => {
    render(<SettlementFeedback receipt={{ id, activityId, amount: 7, skillName: "真实技能" }} animateArrival={false} onDismiss={vi.fn()} />);
    const feedback = screen.getByTestId("settlement-feedback");
    expect(feedback.classList.contains(styles.receipt)).toBe(true);
    expect(feedback.classList.contains(styles.arrival)).toBe(false);
  });
  it("only accepts actual matching settlement transaction; proposals and wrong assessment never award", () => {
    expect(settlementReceipt({ transaction }, assessmentId)).toMatchObject({ id, amount: 7 });
    for (const value of [{ proposal: { xp: 9999 } }, { transaction: { ...transaction, assessmentId: activityId } }, { transaction: { ...transaction, amount: NaN } }, { transaction: { ...transaction, xpType: "correction" } }, { transaction: { ...transaction, id: "forged" } }, { transaction: { ...transaction, amount: 1.5 } }]) expect(settlementReceipt(value, assessmentId)).toBeNull();
  });
  it("renders signed confirmed amount and evidence route, remains readable until explicitly closed", () => {
    const close = vi.fn(); render(<SettlementFeedback receipt={settlementReceipt({ transaction }, assessmentId)!} onDismiss={close} />);
    expect(screen.getByText(/\+7 XP/)).toBeTruthy(); expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(`/activities/${activityId}`);
    fireEvent.click(screen.getByRole("button", { name: "关闭提示" })); expect(close).toHaveBeenCalledOnce();
  });
  it("zero XP remains zero and never claims a mastery or level upgrade", () => {
    render(<SettlementFeedback receipt={{ id, activityId, amount: 0, skillName: "记录" }} onDismiss={vi.fn()} />);
    expect(screen.getByText(/0 XP/)).toBeTruthy(); expect(screen.queryByText(/Level Up|Mastery提升/)).toBeNull();
  });
  it("real dashboard handler waits for server success, reads refreshed level and never replays the same receipt", async () => {
    let committed = false, duplicate = false, resolveConfirm: (response: Response) => void = () => undefined;
    const dashboard = () => ({ player: { playerLevel: committed ? 2 : 1 }, recentGrowth: committed ? [transaction] : [], activities: [], skills: [], pendingAssessments: [], pendingMasteryVerifications: [] });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/dashboard") return new Response(JSON.stringify({ dashboard: dashboard() }));
      if (duplicate) return new Response(JSON.stringify({ transaction }));
      return new Promise<Response>(resolve => { resolveConfirm = resolve; });
    }));
    const view = render(<DashboardPage />); await screen.findByRole("button", { name: "测试确认入口" });
    expect(screen.queryByTestId("settlement-feedback")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "测试确认入口" }));
    expect(screen.queryByTestId("settlement-feedback")).toBeNull(); committed = true; resolveConfirm(new Response(JSON.stringify({ transaction })));
    await screen.findByTestId("settlement-feedback"); await screen.findByLabelText("玩家等级 LV.2");
    fireEvent.click(screen.getByRole("button", { name: "关闭提示" })); duplicate = true;
    fireEvent.click(screen.getByRole("button", { name: "测试确认入口" })); await waitFor(() => expect(screen.queryByTestId("settlement-feedback")).toBeNull());
    view.unmount(); render(<DashboardPage />); await screen.findByRole("button", { name: "测试确认入口" }); expect(screen.queryByTestId("settlement-feedback")).toBeNull();
  });
  it("HTTP conflict cannot trigger a reward animation", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/dashboard" ? new Response(JSON.stringify({ dashboard: { player: { playerLevel: 1 }, recentGrowth: [], activities: [], skills: [], pendingAssessments: [], pendingMasteryVerifications: [] } })) : new Response(JSON.stringify({ code: "already_confirmed" }), { status: 409 })));
    render(<DashboardPage />); fireEvent.click(await screen.findByRole("button", { name: "测试确认入口" })); await screen.findByRole("alert"); expect(screen.queryByTestId("settlement-feedback")).toBeNull();
  });
});
