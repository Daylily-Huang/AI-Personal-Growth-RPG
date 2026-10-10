// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
const nav = vi.hoisted(() => ({ params: { id: "aaaaaaaa-1234-4000-8000-000000000001" } as { id: unknown }, router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => nav.router, useParams: () => nav.params }));
vi.mock("next/link", () => ({ default: ({ href, prefetch, children, ...props }: { href: string; prefetch?: boolean; children: React.ReactNode }) => <a href={href} data-prefetch={String(prefetch)} {...props}>{children}</a> }));
import ActivityDetailPage from "@/app/activities/[id]/page";
import { ActivityHistoryList } from "@/components/dashboard/ActivityHistoryList";
import { RecentGrowthFeed } from "@/components/dashboard/RecentGrowthFeed";
import type { Activity, XpTransaction } from "@/lib/store/types";
const id = (n = 1) => `aaaaaaaa-1234-4000-8000-${String(n).padStart(12, "0")}`;
const raw = "  第一行\r\n\n🙂 <script>literal</script>\t" + "长文本🙂".repeat(600) + "  ";
const fixture = (key = id(), text = raw): Activity => ({ id: key, title: "活动标题", rawInput: text, status: "confirmed", createdAt: "2026-10-10T00:00:00Z", rulesVersion: "v-test", questId: null, activityType: "learning", totalMinutes: 25, effectiveMinutes: 20 });
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { nav.params = { id: id() }; nav.router = { replace: vi.fn() }; vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54331"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key"); fetchMock = vi.fn().mockResolvedValue(response({ activity: fixture() })); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Activity detail visible original text", () => {
  test("one main/h1, fixed return, literal full raw text and same-origin private GET", async () => {
    render(<ActivityDetailPage />); const pre = await screen.findByTestId("activity-raw-input");
    expect(pre.textContent).toBe(raw); expect(pre.querySelector("script")).toBeNull(); expect(pre.className).not.toMatch(/truncate|line-clamp/);
    expect(pre.className).toContain("whitespace-pre-wrap"); expect(screen.getAllByRole("main")).toHaveLength(1); expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "返回仪表盘" }).getAttribute("href")).toBe("/dashboard");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/activities/${id()}`, expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(screen.getByText("v-test")).toBeDefined(); expect(screen.getByText("已确认")).toBeDefined();
  });
  test.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])("missing %s fails closed with zero fetch", async key => {
    vi.stubEnv(key, " \t"); render(<ActivityDetailPage />); await screen.findByRole("alert"); expect(fetchMock).not.toHaveBeenCalled(); expect(screen.queryByTestId("activity-raw-input")).toBeNull();
  });
  test.each(["invalid", "constructor", [id()], undefined])("invalid route %s has no private request", async key => {
    nav.params = { id: key }; render(<ActivityDetailPage />); await screen.findByText("活动地址无效，请从你的活动记录重新打开。"); expect(fetchMock).not.toHaveBeenCalled();
  });
  test("uppercase UUID is the same identity", async () => { nav.params.id = id().toUpperCase(); render(<ActivityDetailPage />); await screen.findByTestId("activity-raw-input"); });
  test("loading has no private facts", () => { fetchMock.mockReturnValue(new Promise(() => {})); render(<ActivityDetailPage />); expect(screen.getByRole("status")).toBeDefined(); expect(screen.queryByText("活动标题")).toBeNull(); });
  test.each([400, 404, 500, 503])("safe HTTP %s has no leaked error body or raw record", async status => {
    fetchMock.mockResolvedValue(response({ error: "private-upstream-error", activity: fixture() }, status)); render(<ActivityDetailPage />); await screen.findByRole("alert"); expect(screen.queryByTestId("activity-raw-input")).toBeNull(); expect(screen.queryByText("private-upstream-error")).toBeNull();
  });
  test("401 clears facts and navigates only to fixed/login", async () => { fetchMock.mockResolvedValue(response({ activity: fixture(), error: "foreign" }, 401)); render(<ActivityDetailPage />); await waitFor(() => expect(nav.router.replace).toHaveBeenCalledExactlyOnceWith("/login")); expect(screen.queryByTestId("activity-raw-input")).toBeNull(); });
  test.each(["pending_assessment", "assessed", "confirmed"])("recognizes exact persisted status %s", async status => { fetchMock.mockResolvedValue(response({ activity: { ...fixture(), status } })); render(<ActivityDetailPage />); await screen.findByTestId("activity-raw-input"); });
  test.each(["id", "title", "rawInput", "status", "createdAt", "rulesVersion"].flatMap(field => [undefined, null].map(value => ({ field, value }))))("missing/null $field receipt fails closed", async ({ field, value }) => {
    fetchMock.mockResolvedValue(response({ activity: { ...fixture(), [field]: value } })); render(<ActivityDetailPage />); await screen.findByRole("alert"); expect(screen.queryByTestId("activity-raw-input")).toBeNull();
  });
  test.each(["constructor", "__proto__", "toString", "archived"])("unknown/prototype status %s never maps to confirmed", async status => { fetchMock.mockResolvedValue(response({ activity: { ...fixture(), status } })); render(<ActivityDetailPage />); await screen.findByRole("alert"); expect(screen.queryByTestId("activity-raw-input")).toBeNull(); });
  test.each([{}, [], { activity: [] }, { activity: { ...fixture(), id: id(2) } }, { activity: { ...fixture(), createdAt: "not-date" } }])("malformed or wrong-identity receipt fails closed %#", async body => { fetchMock.mockResolvedValue(response(body)); render(<ActivityDetailPage />); await screen.findByRole("alert"); expect(screen.queryByTestId("activity-raw-input")).toBeNull(); });
  test("inherited fields and accessor receipts are rejected without invoking getters", async () => {
    const getter = vi.fn(() => fixture()); fetchMock.mockResolvedValueOnce(response(Object.defineProperty({}, "activity", { get: getter }))).mockResolvedValueOnce(response({ activity: Object.create(fixture()) }));
    render(<ActivityDetailPage />); await screen.findByRole("alert"); expect(getter).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "重新读取" })); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)); expect(screen.queryByTestId("activity-raw-input")).toBeNull();
  });
  test.each(["network", "json"])("safe %s failure supports explicit retry", async kind => {
    if (kind === "network") fetchMock.mockRejectedValueOnce(Error("secret-network")); else fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw Error("secret-json"); } });
    render(<ActivityDetailPage />); await screen.findByRole("alert"); expect(screen.queryByText(/secret-/)).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "重新读取" })); await screen.findByTestId("activity-raw-input");
  });
  test("refresh clears existing original immediately", async () => {
    const next = deferred<ReturnType<typeof response>>(); fetchMock.mockResolvedValueOnce(response({ activity: fixture(id(), "old-private") })).mockReturnValueOnce(next.promise);
    render(<ActivityDetailPage />); await screen.findByTestId("activity-raw-input"); fireEvent.click(screen.getByRole("button", { name: "重新读取" })); expect(screen.queryByText("old-private")).toBeNull();
    await act(async () => next.resolve(response({ activity: fixture(id(), "new-private") }))); expect((await screen.findByTestId("activity-raw-input")).textContent).toBe("new-private");
  });
  test("id change and late JSON never reveal the prior activity", async () => {
    const pending = deferred<unknown>(); fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => pending.promise }).mockResolvedValueOnce(response({ activity: fixture(id(2), "second-private") }));
    const view = render(<ActivityDetailPage />); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); nav.params.id = id(2); view.rerender(<ActivityDetailPage />); expect(screen.queryByTestId("activity-raw-input")).toBeNull();
    await screen.findByTestId("activity-raw-input"); await act(async () => pending.resolve({ activity: fixture(id(), "first-private") })); expect(screen.getByTestId("activity-raw-input").textContent).toBe("second-private");
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });
  test("router generation clears stale facts and unmount aborts requests", async () => {
    const next = deferred<ReturnType<typeof response>>(); fetchMock.mockResolvedValueOnce(response({ activity: fixture(id(), "old-private") })).mockReturnValueOnce(next.promise);
    const view = render(<ActivityDetailPage />); await screen.findByTestId("activity-raw-input"); nav.router = { replace: vi.fn() }; view.rerender(<ActivityDetailPage />); expect(screen.queryByText("old-private")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)); view.unmount(); expect((fetchMock.mock.calls[1][1] as RequestInit).signal?.aborted).toBe(true); await act(async () => next.resolve(response({ activity: fixture() })));
  });
});
describe("real Activity links, not guessed transaction IDs", () => {
  test("ActivityLog preserves ten-item order, exact IDs and empty behavior", () => {
    const values = Array.from({ length: 12 }, (_, n) => ({ ...fixture(id(n + 1)), title: `活动${n + 1}` }));
    const view = render(<ActivityHistoryList activities={values} />); const links = screen.getAllByRole("link"); expect(links).toHaveLength(10); links.forEach((link, n) => { expect(link.getAttribute("href")).toBe(`/activities/${id(n + 1)}`); expect(link.getAttribute("data-prefetch")).toBe("false"); expect(link.className).toContain("touch-target-min"); });
    view.rerender(<ActivityHistoryList activities={[]} />); expect(screen.queryByRole("link")).toBeNull();
  });
  test("RecentGrowth keeps actual activity identity, six items, XP and repeat semantics", () => {
    const values = Array.from({ length: 8 }, (_, n) => ({ id: id(100 + n), activityId: id(n + 1), assessmentId: id(200 + n), reason: `成长${n}`, skillName: "真实技能", amount: 6, createdAt: fixture().createdAt, repetitionPenalty: 0.8, repetitionCount: 2 } as XpTransaction));
    render(<RecentGrowthFeed transactions={values} />); const links = screen.getAllByRole("link"); expect(links).toHaveLength(6); links.forEach((link, n) => expect(link.getAttribute("href")).toBe(`/activities/${id(n + 1)}`)); expect(screen.getAllByText("+6 XP")).toHaveLength(6); expect(screen.getAllByText(/重复 ×0.8/)).toHaveLength(6);
  });
  test.each([null, undefined, "", "constructor", "bad-id"])("legacy activityId %s is plain text, not a fabricated link", activityId => {
    const tx = { id: id(99), activityId, reason: "保留旧成长", amount: 3, skillName: "旧技能", createdAt: fixture().createdAt } as XpTransaction;
    const view = render(<RecentGrowthFeed transactions={[tx]} />); expect(screen.queryByRole("link")).toBeNull(); expect(screen.getByText("保留旧成长")).toBeDefined(); view.rerender(<RecentGrowthFeed transactions={[]} />); expect(screen.queryByText("保留旧成长")).toBeNull();
  });
});
