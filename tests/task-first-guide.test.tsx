// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { assertTaskFirstScope, restoreTaskFirstQuickLog } from "./helpers/task-first-scope";
import { TaskFirstGuide } from "@/components/dashboard/TaskFirstGuide";
import type { DashboardSnapshot } from "@/lib/store/types";
vi.mock("next/link", () => ({ default: ({ children, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => { void prefetch; return <a {...props}>{children}</a>; } }));
const makeSnapshot = (statuses: string[] = [], assessmentStatuses: string[] = []): DashboardSnapshot => ({
  mainQuest: null,
  quests: statuses.map((status, index) => ({ id: `quest-${index}`, status, title: `任务${index}` })),
  pendingAssessments: assessmentStatuses.map((status, index) => ({ id: `assessment-${index}`, status })),
} as DashboardSnapshot);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const renderGuide = (dashboard = makeSnapshot()) => {
  const onQuickLog = vi.fn(), onReview = vi.fn();
  const view = render(<TaskFirstGuide dashboard={dashboard} onQuickLog={onQuickLog} onReview={onReview} />);
  return { ...view, onQuickLog, onReview };
};
describe("task-first daily workflow", () => {
  it("restores the entire frozen record component and rejects ambiguous display amendments", () => {
    const file = "src/components/dashboard/QuickLogCard.tsx";
    const current = readFileSync(file, "utf8");
    const original = execFileSync("git", ["show", `6dfa88020dd767d95443f2c9ecbf240d7e39ac9a:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    expect(restoreTaskFirstQuickLog(current)).toBe(original);
    expect(restoreTaskFirstQuickLog(current + "\n// unrelated change\n")).not.toBe(original);
    expect(() => restoreTaskFirstQuickLog(current.replace("做完以后：记录实际行动和结果", "其他文案"))).toThrow("FAIL-CLOSED");
    expect(() => restoreTaskFirstQuickLog(current + 'title="做完以后：记录实际行动和结果"')).toThrow("FAIL-CLOSED");
  });
  it("admits only the eleven disclosed UI, documentation and guard files", () => { expect(assertTaskFirstScope()).toHaveLength(11); });
  it("provides a usable next action without requiring skills or any prior activity", () => {
    renderGuide();
    expect(screen.getByRole("link", { name: /去设置我的目标/ }).getAttribute("href")).toBe("/quests");
    expect(screen.getByRole("button", { name: "去记录结果" })).toBeDefined();
    expect(screen.getByRole("button", { name: "查看待核对建议" })).toBeDefined();
  });
  it.each(["paused", "completed", "archived", "failed", "locked", "available"])("does not call %s quests active", status => {
    renderGuide(makeSnapshot([status]));
    expect(screen.getByRole("link", { name: /去设置我的目标/ })).toBeDefined();
    expect(screen.queryByRole("link", { name: /选择接下来要做的任务/ })).toBeNull();
  });
  it("uses active status without inventing a today schedule, AI recommendation or completed step", () => {
    renderGuide(makeSnapshot(["active", "paused"]));
    expect(screen.getByRole("link", { name: /选择接下来要做的任务/ })).toBeDefined();
    expect(screen.queryByText(/今日已完成|AI 推荐任务|已完成第一步/)).toBeNull();
    const items = within(screen.getByRole("list", { name: "日常使用流程" })).getAllByRole("listitem");
    expect(items.map(item => within(item).getByRole("heading").textContent)).toEqual(["选一件任务", "去实际行动", "记录做了什么", "核对成长建议", "回顾并选下一步"]);
  });
  it("falls back to a known main quest only when the full quest collection is unavailable", () => {
    const snapshot = makeSnapshot(); delete snapshot.quests;
    snapshot.mainQuest = { status: "active" } as NonNullable<DashboardSnapshot["mainQuest"]>;
    renderGuide(snapshot);
    expect(screen.getByRole("link", { name: /选择接下来要做的任务/ })).toBeDefined();
  });
  it("counts pending proposals only and never implies that they are settled", () => {
    renderGuide(makeSnapshot([], ["pending", "confirmed", "rejected", "superseded", "pending"]));
    expect(screen.getByRole("button", { name: "核对建议（2）" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toContain("尚未结算");
  });
  it("navigation actions never create, assess, confirm or change business data", () => {
    const snapshot = makeSnapshot(["active"], ["pending"]), before = JSON.stringify(snapshot);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { onQuickLog, onReview } = renderGuide(snapshot);
    fireEvent.click(screen.getByRole("button", { name: "去记录结果" }));
    fireEvent.click(screen.getByRole("button", { name: "核对建议（1）" }));
    expect(onQuickLog).toHaveBeenCalledTimes(1); expect(onReview).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled(); expect(JSON.stringify(snapshot)).toBe(before);
    vi.unstubAllGlobals();
  });
  it("offers the existing review route and makes other features optional", () => {
    renderGuide();
    expect(screen.getByRole("link", { name: "去复盘" }).getAttribute("href")).toBe("/journey/reviews");
    const details = screen.getByText("其他功能什么时候用？").closest("details")!;
    expect(details.hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByText("其他功能什么时候用？"));
    for (const href of ["/skills", "/knowledge", "/artifacts", "/local-library"]) expect(details.querySelector(`a[href="${href}"]`)).not.toBeNull();
    expect(details.textContent).toContain("不用每天");
  });
  it("provides touch targets and real controls without a fake online completion button", () => {
    const { container } = renderGuide();
    for (const control of container.querySelectorAll("button, a, summary")) expect(control.className).toContain("min-h-[var(--touch-target-min)]");
    expect(screen.queryByRole("button", { name: /去实际行动|完成行动|领取经验/ })).toBeNull();
  });
  it("leaves existing submit, assess, confirmation and receipt handlers byte-equivalent", () => {
    const file = "src/app/dashboard/page.tsx";
    const original = execFileSync("git", ["show", `6dfa88020dd767d95443f2c9ecbf240d7e39ac9a:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    const current = readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace('import { TaskFirstGuide } from "@/components/dashboard/TaskFirstGuide";\n', "");
    expect(current.split("  const focusQuickLog =")[0]).toBe(original.split("  const focusQuickLog =")[0]);
    expect(current).toContain('id="growth-review-step" tabIndex={-1}');
    expect(current.indexOf("<TaskFirstGuide")).toBeLessThan(current.indexOf('data-testid="dashboard-core-grid"'));
  });
});