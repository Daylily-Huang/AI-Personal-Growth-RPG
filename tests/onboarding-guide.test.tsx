// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GettingStartedGuide } from "@/components/onboarding/GettingStartedGuide";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState, isFreshDashboard } from "@/components/dashboard/DashboardStates";

const navigation = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation.router }));
vi.mock("next/link", () => ({ default: ({ href, prefetch, children, ...props }: {
  href: string; prefetch?: boolean; children: React.ReactNode;
}) => <a href={href} data-prefetch={String(prefetch)} {...props}>{children}</a> }));
const id = (n: number) => `12345678-1234-4000-8000-${String(n).padStart(12, "0")}`;
const receipt = (label = "合成主线") => ({ dashboard: {
  quests: [{ id: id(1), title: label, status: "active", isMainQuest: true }],
  skills: [{ id: id(2), name: "已有成长技能", status: "active", xp: 500, masteryLevel: 8 }],
  activities: [{ id: id(3), title: "已保存活动", rawInput: "已实际完成", status: "pending_assessment" }],
} });
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54331");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key");
  navigation.router = { replace: vi.fn() };
  fetchMock = vi.fn().mockResolvedValue(response(receipt())); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("read-only getting started UI and preserved dashboard actions", () => {
  test("SSR is public instructions/loading only, one main/h1 and no fetch", () => {
    const html = renderToString(<GettingStartedGuide />);
    expect(html.match(/<main/g)).toHaveLength(1); expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("尚未核对"); expect(html).not.toContain("合成主线"); expect(fetchMock).not.toHaveBeenCalled();
  });
  test("only fixed same-origin uncached GET; fixed links disable prefetch and no forms/storage", async () => {
    const { container } = render(<GettingStartedGuide />); await screen.findByText("入门准备已完成");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard", expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store", signal: expect.any(AbortSignal) }));
    expect([...container.querySelectorAll("a")].map(a => [a.getAttribute("href"), a.getAttribute("data-prefetch")]))
      .toEqual([["/dashboard", "false"], ["/quests", "false"], ["/skills", "false"], ["/dashboard#quick-log-input", "false"]]);
    expect(container.querySelectorAll("form,input,textarea")).toHaveLength(0);
    expect(screen.getByText(/三步齐全只表示/)).toBeDefined(); expect(screen.getByText(/记录存在不等于/)).toBeDefined();
  });
  test.each([
    ["NEXT_PUBLIC_SUPABASE_URL", undefined], ["NEXT_PUBLIC_SUPABASE_URL", " \t"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined], ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", " \n"],
  ])("missing/blank public %s %j prevents any GET or demo success", async (name, value) => {
    vi.stubEnv(name!, value); render(<GettingStartedGuide />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("尚未配置"));
    expect(fetchMock).not.toHaveBeenCalled(); expect(screen.queryByText("入门准备已完成")).toBeNull();
    expect(screen.getAllByText("尚未核对")).toHaveLength(3); expect(screen.queryByText("合成主线")).toBeNull();
  });
  test("loading never claims empty/success or shows private labels", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); render(<GettingStartedGuide />);
    expect(screen.getAllByText("尚未核对")).toHaveLength(3); expect(screen.queryByText("尚未准备")).toBeNull();
    expect(screen.queryByText("合成主线")).toBeNull();
  });
  test("empty authentic receipt is partial preparation, not AI or site completion", async () => {
    fetchMock.mockResolvedValue(response({ dashboard: { quests: [], skills: [], activities: [] } }));
    render(<GettingStartedGuide />); await screen.findByText("按自己的节奏准备即可");
    expect(screen.getAllByText("尚未准备")).toHaveLength(3); expect(screen.queryByText("入门准备已完成")).toBeNull();
  });
  test("401 clears facts before fixed login navigation", async () => {
    fetchMock.mockResolvedValue(response({ dashboard: receipt().dashboard, error: "private untrusted text" }, 401));
    render(<GettingStartedGuide />); await waitFor(() => expect(navigation.router.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("合成主线")).toBeNull(); expect(screen.queryByText("private untrusted text")).toBeNull();
  });
  test.each(["network", "500", "json", "receipt"])("safe %s failure exposes no raw error/progress and supports explicit retry", async kind => {
    const raw = "secret-server-error";
    if (kind === "network") fetchMock.mockRejectedValueOnce(new Error(raw));
    if (kind === "500") fetchMock.mockResolvedValueOnce(response({ error: raw }, 500));
    if (kind === "json") fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw Error(raw); } });
    if (kind === "receipt") fetchMock.mockResolvedValueOnce(response({ dashboard: { ...receipt().dashboard, skills: [{ ...receipt().dashboard.skills[0], status: null }] } }));
    render(<GettingStartedGuide />); await screen.findByRole("alert");
    expect(screen.queryByText(raw)).toBeNull(); expect(screen.queryByText("合成主线")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新核对" })); await screen.findByText("入门准备已完成");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test("refresh clears old facts immediately until the new generation finishes", async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetchMock.mockResolvedValueOnce(response(receipt("旧主线"))).mockReturnValueOnce(pending.promise);
    render(<GettingStartedGuide />); await screen.findByText("旧主线"); fireEvent.click(screen.getByRole("button", { name: "重新核对" }));
    expect(screen.queryByText("旧主线")).toBeNull(); expect(screen.getAllByText("尚未核对")).toHaveLength(3);
    await act(async () => pending.resolve(response(receipt("新主线")))); expect(await screen.findByText("新主线")).toBeDefined();
  });
  test("late JSON from an aborted generation cannot overwrite a new receipt", async () => {
    const body = deferred<unknown>(); fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => body.promise });
    const view = render(<GettingStartedGuide />); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    navigation.router = { replace: vi.fn() }; view.rerender(<GettingStartedGuide />);
    expect(await screen.findByText("合成主线")).toBeDefined();
    await act(async () => body.resolve(receipt("迟到的旧主线")));
    expect(screen.queryByText("迟到的旧主线")).toBeNull(); expect(screen.getByText("合成主线")).toBeDefined();
  });
  test.each([200, 401, 500])("unmount aborts and ignores late status %i including login", async status => {
    const pending = deferred<ReturnType<typeof response>>(); fetchMock.mockReturnValue(pending.promise);
    const view = render(<GettingStartedGuide />); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal; view.unmount();
    expect(signal.aborted).toBe(true); await act(async () => pending.resolve(response(receipt(), status)));
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });
  test("text-only private labels cannot create HTML or external navigation", async () => {
    render(<GettingStartedGuide />); await screen.findByText("入门准备已完成");
    fetchMock.mockResolvedValue(response(receipt('<img src="https://invalid.test/x" onerror="alert(1)">')));
    fireEvent.click(screen.getByRole("button", { name: "重新核对" }));
    expect(await screen.findByText(/<img src=/)).toBeDefined(); expect(document.querySelector("img")).toBeNull();
  });
  test("dashboard header adds one guide link but keeps the exact original QuickLog callback", () => {
    const callback = vi.fn(); render(<DashboardHeader displayName="修习者" onQuickLog={callback} />);
    expect(screen.getByRole("link", { name: "入门指南" }).getAttribute("href")).toBe("/onboarding");
    fireEvent.click(screen.getByRole("button", { name: "快速记录成长" })); expect(callback).toHaveBeenCalledTimes(1);
  });
  test("fresh card adds a guide link without changing its record callback or authority copy", () => {
    const callback = vi.fn(); render(<EmptyState onFocusQuickLog={callback} />);
    expect(screen.getByRole("link", { name: "查看入门指南" }).getAttribute("href")).toBe("/onboarding");
    fireEvent.click(screen.getByRole("button", { name: "立即开始第一次记录" })); expect(callback).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/经你确认后，服务器 Growth Engine/)).toBeDefined();
  });
  test("fresh predicate remains false as soon as a quest or skill exists", () => {
    const fresh = { activities: [], pendingAssessments: [], recentGrowth: [], skills: [], quests: [], pendingMasteryVerifications: [] };
    expect(isFreshDashboard(fresh as never)).toBe(true);
    expect(isFreshDashboard({ ...fresh, skills: [{}] } as never)).toBe(false);
    expect(isFreshDashboard({ ...fresh, quests: [{}] } as never)).toBe(false);
  });
});
