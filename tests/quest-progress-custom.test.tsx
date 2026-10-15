// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuestCard } from "@/components/quests/QuestCard";
import type { Quest, QuestStatus } from "@/lib/store/types";

const quest: Quest = {
  id: "custom-progress", userId: "synthetic-user", title: "自定义进度测试", description: "",
  questType: "learning", questSize: "standard", status: "active", progress: 50,
  difficulty: 0.5, goalAlignment: 0.8, parentQuestId: null, isMainQuest: false, isBoss: false,
  deadline: null, completedAt: null, createdAt: "2026-10-15", updatedAt: "2026-10-15",
};
afterEach(cleanup);
function setup(progress = 50, status: QuestStatus = "active", save = vi.fn()) {
  render(<QuestCard quest={{ ...quest, progress, status }} onUpdateStatus={vi.fn()} onDelete={vi.fn()} onUpdateProgress={save} />);
  return save;
}
function change(value: string) { fireEvent.change(screen.getByRole("spinbutton"), { target: { value } }); }
function submit() { fireEvent.click(screen.getByTestId("quest-progress-bump")); }

describe("Custom quest progress increments", () => {
  it.each([["5", 55], ["30", 80], ["1.5", 51.5], ["50", 100], ["999", 100]])("adds %s and saves %s, capped at completion", async (amount, expected) => {
    const save = setup(); change(amount); submit();
    expect(save).toHaveBeenCalledExactlyOnceWith(quest.id, expected);
    await waitFor(() => expect(screen.getByRole("spinbutton").hasAttribute("disabled")).toBe(false));
  });
  it.each(["", "0", "-1", "abc", "Infinity"])("does not submit invalid increment %s", value => {
    const save = setup(); change(value); submit(); expect(save).not.toHaveBeenCalled();
  });
  it("keeps the existing default25 operation", async () => {
    const save = setup(20); submit(); expect(save).toHaveBeenCalledWith(quest.id,45);
    await waitFor(() => expect(screen.getByRole("spinbutton").hasAttribute("disabled")).toBe(false));
  });
  it.each<QuestStatus>(["locked", "available", "paused", "completed", "failed", "archived"])("does not expose increment control for %s", status => {
    setup(50,status); expect(screen.queryByRole("spinbutton")).toBeNull(); expect(screen.queryByTestId("quest-progress-bump")).toBeNull();
  });
  it("accepts keyboard form submission and rejects repeated submissions during save", async () => {
    let finish!: () => void; const save = vi.fn(() => new Promise<void>(resolve => {finish=resolve;}));
    setup(50,"active",save); change("7");const form=screen.getByRole("spinbutton").closest("form")!;
    fireEvent.submit(form);fireEvent.submit(form);expect(save).toHaveBeenCalledExactlyOnceWith(quest.id,57);
    expect(screen.getByRole("spinbutton").hasAttribute("disabled")).toBe(true);finish();
    await waitFor(() => expect(screen.getByRole("spinbutton").hasAttribute("disabled")).toBe(false));
  });
  it("shows a recoverable save failure and allows retry", async () => {
    const save=vi.fn().mockRejectedValueOnce(new Error("synthetic failure")).mockResolvedValueOnce(undefined);
    setup(50,"active",save); change("3");submit();await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("重试"));
    submit();await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));await waitFor(()=>expect(screen.queryByRole("alert")).toBeNull());
  });
});
