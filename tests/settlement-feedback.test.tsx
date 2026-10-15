// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettlementFeedback, { settlementReceipt } from "@/components/dashboard/SettlementFeedback";
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Settlement receipt feedback", () => {
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
