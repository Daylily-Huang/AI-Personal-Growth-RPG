// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";
import Loading from "@/app/loading";
import Help from "@/app/help/page";
import { AppShellProvider } from "@/components/layout/AppShellContext";
import type { DashboardSnapshot } from "@/lib/store/types";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Recoverable product states", () => {
  test("error only offers explicit page retry and never exposes exception or replays a submission", () => { const retry = vi.fn(), error = Object.assign(new Error("PRIVATE_RECORD_AND_SECRET_CANARY"), { digest: "PRIVATE_DIGEST" }); render(<ErrorPage error={error} retry={retry} />); expect(document.body.textContent).not.toContain(error.message); expect(document.body.textContent).not.toContain(error.digest); expect(retry).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "重新加载此页" })); expect(retry).toHaveBeenCalledOnce(); expect(screen.getByText(/先查看它的状态/)).toBeTruthy(); });
  test("shared-data recovery refreshes the stale shell by GET before retry without replaying writes", async () => { const snapshot: DashboardSnapshot = { player: { totalXp: 0, playerLevel: 1, energy: 80, focus: 80, momentum: 0 }, levelProgress: { xpIntoLevel: 0, xpNeededForNext: 100, progress: 0 }, recentGrowth: [], pendingAssessments: [], activities: [], skills: [], pendingMasteryVerifications: [] }; const fetcher = vi.fn(async () => new Response(JSON.stringify({ dashboard: snapshot }), { status: 200 })), retry = vi.fn(); vi.stubGlobal("fetch", fetcher); render(<AppShellProvider initialDashboard={snapshot}><ErrorPage error={new Error("hidden")} retry={retry} /></AppShellProvider>); fireEvent.click(screen.getByRole("button", { name: "重新加载此页" })); expect(retry).not.toHaveBeenCalled(); await waitFor(() => expect(retry).toHaveBeenCalledOnce()); expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledWith("/api/dashboard"); });
  test("global boundary owns its document, has CSS-independent styles and suppresses raw errors", () => { const html = renderToStaticMarkup(<GlobalError error={new Error("DO_NOT_EXPOSE")} retry={() => {}} />); expect(html).toContain('<html lang="zh-CN">'); expect(html).toContain("<body"); expect(html).toContain("background:#f7f6f2"); expect(html).toContain('href="/help"'); expect(html).not.toContain("DO_NOT_EXPOSE"); });
  test("not-found has actionable safe destinations and no retry of unknown mutation", () => { render(<NotFound />); expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("没有找到"); expect(screen.getByRole("link", { name: "回到今天" }).getAttribute("href")).toBe("/dashboard"); expect(screen.getByRole("link", { name: "查看使用帮助" }).getAttribute("href")).toBe("/help"); expect(screen.queryByRole("button")).toBeNull(); });
  test("loading announces a pending page without invented progress or save claims", () => { render(<Loading />); expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true"); expect(document.body.textContent).not.toMatch(/100%|已保存|已完成/); });
  test("public help covers the real workflow, evidence and explicit cloud consent, including actual limitations", () => { render(<Help />); expect(screen.getAllByRole("listitem").length).toBeGreaterThan(5); expect(document.body.textContent).toContain("现有云端 AI"); expect(document.body.textContent).toContain("每批最多8份"); expect(document.body.textContent).toContain("PDF、旧PPT/DOC"); expect(document.body.textContent).toContain("未验证状态"); expect(screen.getByRole("link", { name: /新手引导/ }).getAttribute("href")).toBe("/onboarding"); });
});
