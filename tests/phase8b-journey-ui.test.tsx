// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { JourneyNav } from "@/components/journey/JourneyNav";
import ReviewsClient from "@/components/journey/ReviewsClient";
import SeasonsPage from "@/app/journey/seasons/page";
import { isProductRoute } from "@/components/layout/AppShellBoundary";

const routerPush = vi.fn();
let mockPathname = "/journey/seasons";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function source(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
}

describe("Phase 8B Round 4 — Journey UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    routerPush.mockReset();
    mockPathname = "/journey/seasons";
    mockSearchParams = new URLSearchParams();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/seasons")) return jsonResponse({ seasons: [] });
      if (url.endsWith("/api/quests")) return jsonResponse({ quests: [] });
      if (url.endsWith("/api/reviews")) return jsonResponse({ reviews: [] });
      return jsonResponse({}, 404);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("Journey uses a dedicated single AppShell wrapper without changing the historical root route classifier", () => {
    expect(isProductRoute("/journey/seasons")).toBe(false);
    expect(isProductRoute("/journey/reviews")).toBe(false);

    const layout = source("src/app/journey/layout.tsx");
    expect(layout).toContain("<AppShellProvider>");
    expect(layout).toContain("<AppShell");
    expect(layout).toContain("<JourneyNav />");
  });

  test("Journey local navigation exposes only the authorized Seasons and Reviews surfaces", () => {
    render(<JourneyNav />);

    const seasons = screen.getByRole("link", { name: "赛季" });
    const reviews = screen.getByRole("link", { name: "复盘" });
    expect(seasons.getAttribute("href")).toBe("/journey/seasons");
    expect(seasons.getAttribute("aria-current")).toBe("page");
    expect(reviews.getAttribute("href")).toBe("/journey/reviews");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  test("Seasons page renders the bounded empty state and opens an accessible create modal", async () => {
    render(<SeasonsPage />);

    expect(document.body.contains(await screen.findByText("还没有赛季"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "新建赛季" }));
    expect(document.body.contains(await screen.findByRole("dialog", { name: "新建赛季草稿" }))).toBe(true);
    expect(document.body.contains(screen.getByLabelText("赛季名称"))).toBe(true);
  });

  test("Seasons page redirects unauthenticated reads to login", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "auth" }, 401)));
    render(<SeasonsPage />);

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/login"));
  });

  test("Reviews page never offers standalone FINAL creation and disables periodic creation without an ACTIVE Season", async () => {
    mockPathname = "/journey/reviews";
    render(<ReviewsClient />);

    expect(document.body.contains(await screen.findByText("当前筛选范围没有复盘记录。"))).toBe(true);
    expect((screen.getByRole("button", { name: "新建周期复盘" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.contains(screen.getByText(/首次 FINAL Review 只能与 COMPLETED \/ ENDED_EARLY/))).toBe(true);
  });

  test("Round 4 UI never imports Supabase or calls table/RPC authority directly", () => {
    const files = [
      "src/app/journey/seasons/page.tsx",
      "src/app/journey/reviews/page.tsx",
      "src/components/journey/ReviewsClient.tsx",
      "src/app/journey/layout.tsx",
      "src/components/journey/JourneyNav.tsx",
    ];
    const combined = files.map(source).join("\n");

    expect(combined).not.toMatch(/@\/lib\/supabase/);
    expect(combined).not.toMatch(/\.from\s*\(/);
    expect(combined).not.toMatch(/\.rpc\s*\(/);
    expect(combined).not.toMatch(/service[_-]?role/i);
  });

  test("Round 4 stays inside Phase 8B and does not expose Phase 8C–8G API surfaces", () => {
    const combined = [
      source("src/app/journey/seasons/page.tsx"),
      source("src/app/journey/reviews/page.tsx"),
      source("src/components/journey/ReviewsClient.tsx"),
      source("src/components/journey/JourneyNav.tsx"),
    ].join("\n");

    expect(combined).not.toMatch(/\/api\/(journal|strateg|rewards?|wishes|milestones|focus-sessions|protocols)/i);
    expect(combined).not.toMatch(/href=["'`]\/journey\/(journal|strateg|rewards?|wishes|milestones|focus|protocols)/i);
  });

  test("Journey pages retain responsive grid breakpoints and focus-visible treatment", () => {
    const combined = [
      source("src/app/journey/seasons/page.tsx"),
      source("src/app/journey/reviews/page.tsx"),
      source("src/components/journey/ReviewsClient.tsx"),
      source("src/components/journey/JourneyNav.tsx"),
    ].join("\n");

    expect(combined).toMatch(/md:grid-cols/);
    expect(combined).toMatch(/lg:grid-cols|xl:grid-cols/);
    expect(combined).toContain("focus-visible:outline");
  });
});
