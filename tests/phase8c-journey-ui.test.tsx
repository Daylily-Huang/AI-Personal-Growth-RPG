// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import JournalPage from "@/app/journey/journal/page";
import { JourneyNav } from "@/components/journey/JourneyNav";
import type { JournalEntry } from "@/lib/journal/types";

const routerPush = vi.fn();
let mockPathname = "/journey/journal";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
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

function sampleEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    entryType: "STATE_LOG",
    title: "今天的状态",
    contentMarkdown: "完成了一个长任务，记录一下主观状态。",
    energy: 4,
    focus: 3,
    stress: 2,
    resistance: 2,
    recovery: 4,
    moodValence: 1,
    selfConfidence: 4,
    seasonId: null,
    questId: null,
    activityId: null,
    isArchived: false,
    loggedAt: "2026-09-18T12:00:00.000Z",
    createdAt: "2026-09-18T12:00:00.000Z",
    updatedAt: "2026-09-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 8C Round 3 — Journey Journal UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    routerPush.mockReset();
    mockPathname = "/journey/journal";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/journal")) return jsonResponse({ entries: [] });
      if (url.endsWith("/api/seasons")) return jsonResponse({ seasons: [] });
      if (url.endsWith("/api/quests")) return jsonResponse({ quests: [] });
      return jsonResponse({}, 404);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("Journey navigation exposes the newly authorized Journal surface and marks it current", () => {
    render(<JourneyNav />);

    const journal = screen.getByRole("link", { name: "日志" });
    expect(journal.getAttribute("href")).toBe("/journey/journal");
    expect(journal.getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  test("Journal renders loading-to-empty state and opens a keyboard-capable reflection editor", async () => {
    render(<JournalPage />);

    expect(document.body.contains(await screen.findByText("当前筛选范围还没有日志。"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "写一条反思" }));
    expect(document.body.contains(screen.getByText("反思编辑器"))).toBe(true);
    expect(document.body.contains(screen.getByLabelText("标题"))).toBe(true);
    expect(document.body.contains(screen.getByLabelText("反思正文"))).toBe(true);

    const pageSource = source("src/app/journey/journal/page.tsx");
    expect(pageSource).toContain("event.metaKey || event.ctrlKey");
    expect(pageSource).toContain("requestSubmit()");
    expect(pageSource).toContain("aria-live=\"polite\"");
  });

  test("Journal filters through the HTTP API and archives through PATCH", async () => {
    const entry = sampleEntry();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/journal/") && init?.method === "PATCH") return jsonResponse({ entry: { ...entry, isArchived: true } });
      if (url.includes("/api/journal")) return jsonResponse({ entries: [entry] });
      if (url.endsWith("/api/seasons")) return jsonResponse({ seasons: [] });
      if (url.endsWith("/api/quests")) return jsonResponse({ quests: [] });
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<JournalPage />);

    expect(document.body.contains(await screen.findByText("今天的状态"))).toBe(true);
    fireEvent.change(screen.getByLabelText("类型筛选"), { target: { value: "STATE_LOG" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("entryType=STATE_LOG"))).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "归档" }));
    await waitFor(() => {
      const archiveCall = fetchMock.mock.calls.find(([input, init]) => String(input).includes(entry.id) && init?.method === "PATCH");
      expect(archiveCall).toBeTruthy();
      expect(JSON.parse(String(archiveCall?.[1]?.body))).toEqual({ isArchived: true });
    });
  });

  test("Historical reflection stays editable after its deleted quest context becomes null", async () => {
    const entry = sampleEntry({
      entryType: "QUEST_REFLECTION",
      title: "任务复盘",
      contentMarkdown: "原任务已经删除，但这条历史反思仍应可编辑。",
      questId: null,
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(`/api/journal/${entry.id}`) && init?.method === "PATCH") {
        return jsonResponse({ entry: { ...entry, contentMarkdown: "补充历史反思。" } });
      }
      if (url.includes("/api/journal")) return jsonResponse({ entries: [entry] });
      if (url.endsWith("/api/seasons")) return jsonResponse({ seasons: [] });
      if (url.endsWith("/api/quests")) return jsonResponse({ quests: [] });
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<JournalPage />);

    expect(document.body.contains(await screen.findByText("任务复盘"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    const questSelect = screen.getByLabelText(/任务上下文/);
    expect(questSelect.hasAttribute("required")).toBe(false);
    expect(screen.getByText("未关联或原任务已删除")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("反思正文"), { target: { value: "补充历史反思。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([input, init]) => String(input).includes(entry.id) && init?.method === "PATCH");
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(String(patchCall?.[1]?.body));
      expect(body.contentMarkdown).toBe("补充历史反思。");
      expect(body).not.toHaveProperty("questId");
      expect(body).not.toHaveProperty("seasonId");
    });
  });

  test("Journal redirects unauthenticated reads to login", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/journal")) return jsonResponse({ error: "auth" }, 401);
      if (url.endsWith("/api/seasons")) return jsonResponse({ seasons: [] });
      if (url.endsWith("/api/quests")) return jsonResponse({ quests: [] });
      return jsonResponse({}, 404);
    }));
    render(<JournalPage />);

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/login"));
  });

  test("Round 3 keeps Journal authority behind HTTP and handles private long text without HTML injection", () => {
    const pageSource = source("src/app/journey/journal/page.tsx");
    const navSource = source("src/components/journey/JourneyNav.tsx");
    const formStylesSource = source("src/components/journey/formStyles.ts");
    const combined = `${pageSource}\n${navSource}`;

    expect(combined).not.toMatch(/@\/lib\/supabase/);
    expect(combined).not.toMatch(/\b(?:supabase|db|client)\.from\s*\(/);
    expect(combined).not.toMatch(/\.rpc\s*\(/);
    expect(combined).not.toMatch(/service[_-]?role/i);
    expect(combined).not.toMatch(/JOURNAL_INSIGHT/);
    expect(pageSource).not.toContain("dangerouslySetInnerHTML");
    expect(pageSource).toContain("max-h-48 overflow-y-auto whitespace-pre-wrap break-words");
    expect(pageSource).toContain("[overflow-wrap:anywhere]");
    expect(pageSource).toMatch(/md:grid-cols/);
    expect(pageSource).toMatch(/xl:grid-cols/);
    expect(formStylesSource).toContain("focus-visible:outline");
    expect(pageSource).toContain("不参与 XP、Mastery 或 Evidence 结算");
  });
});
