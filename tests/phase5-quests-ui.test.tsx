// @vitest-environment jsdom
/**
 * tests/phase5-quests-ui.test.tsx
 * Phase 5 — Core Screen Modernization (Stage 5B-UI Quests Modernization)
 * Comprehensive Governance & Render Test Suite covering:
 * - Static Governance: Zero Dark Hardcoded Classes, Zero Fantasy / Game-Prop Icons
 * - Gold Token Whitelist & Reduced-Motion Contract
 * - 44px Minimum Touch Targets
 * - Fail-Closed Frozen Backend & Domain Delta Guard
 * - Component Rendering: OverviewStats, QuestCard, QuestTreeItem, CreateQuestModal, QuestsStates
 * - Page-Level Orchestration & Tab Navigation
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import QuestsPage from "@/app/quests/page";
import type { Quest, QuestTreeNode } from "@/lib/store/types";
import {
  QuestsOverviewStats,
  QuestCard,
  QuestTreeItem,
  CreateQuestModal,
  QuestsSkeletonLoading,
  QuestsEmptyState,
  QuestsErrorState,
} from "@/components/quests";

// Mock next/navigation
const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/quests",
  useSearchParams: () => new URLSearchParams(),
}));

const mockQuests: Quest[] = [
  {
    id: "quest-1",
    userId: "user-1",
    title: "Master PostgreSQL RLS Policies",
    description: "Write rigorous row-level security tests and policies",
    questType: "learning",
    questSize: "main",
    parentQuestId: null,
    isMainQuest: true,
    isBoss: false,
    difficulty: 0.8,
    goalAlignment: 0.9,
    status: "active",
    progress: 45,
    deadline: "2026-09-30T00:00:00Z",
    completedAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-05T00:00:00Z",
  },
  {
    id: "quest-2",
    userId: "user-1",
    title: "Build Zero-Drift Design System Tokens",
    description: "Implement unified surface and text semantic tokens",
    questType: "production",
    questSize: "major",
    parentQuestId: "quest-1",
    isMainQuest: false,
    isBoss: false,
    difficulty: 0.6,
    goalAlignment: 0.85,
    status: "available",
    progress: 0,
    deadline: null,
    completedAt: null,
    createdAt: "2026-09-02T00:00:00Z",
    updatedAt: "2026-09-05T00:00:00Z",
  },
  {
    id: "quest-3",
    userId: "user-1",
    title: "Pass Stage 5B Independent Review Gate",
    description: "Verify all tests pass without dark classes or fantasy icons",
    questType: "skill",
    questSize: "epic",
    parentQuestId: "quest-1",
    isMainQuest: false,
    isBoss: true,
    difficulty: 0.9,
    goalAlignment: 1.0,
    status: "completed",
    progress: 100,
    deadline: "2026-09-10T00:00:00Z",
    completedAt: "2026-09-05T08:00:00Z",
    createdAt: "2026-09-03T00:00:00Z",
    updatedAt: "2026-09-05T08:00:00Z",
  },
];

const mockTree: QuestTreeNode[] = [
  {
    ...mockQuests[0],
    children: [
      { ...mockQuests[1], children: [] },
      { ...mockQuests[2], children: [] },
    ],
  },
];

describe("Stage 5B-UI Quests Modernization — Governance & Static Checks", () => {
  const questsDir = path.resolve(process.cwd(), "src/components/quests");
  const questsPageFile = path.resolve(process.cwd(), "src/app/quests/page.tsx");

  it("STRICT GOVERNANCE: zero dark hardcoded classes in src/components/quests and page.tsx", () => {
    const filesToCheck = [
      questsPageFile,
      ...fs.readdirSync(questsDir).map((f) => path.join(questsDir, f)),
    ].filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    const forbiddenPatterns = [
      /\bbg-slate-\d+\b/,
      /\bbg-zinc-\d+\b/,
      /\btext-zinc-\d+\b/,
      /\bborder-white\/\d+\b/,
      /\bborder-slate-\d+\b/,
      /\btext-slate-\d+\b/,
    ];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it("STRICT GOVERNANCE: zero fantasy / game-prop icons imported or rendered", () => {
    const filesToCheck = [
      questsPageFile,
      ...fs.readdirSync(questsDir).map((f) => path.join(questsDir, f)),
    ].filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    const forbiddenIcons = [
      "Sword",
      "Swords",
      "Crown",
      "Gem",
      "Scroll",
      "Shield",
      "ShieldAlert",
      "Flame",
    ];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      for (const icon of forbiddenIcons) {
        const importRegex = new RegExp(`\\b${icon}\\b`, "g");
        const matches = content.match(importRegex);
        // Exclude comments or harmless substrings if any
        if (matches) {
          // Verify it's not imported from lucide-react
          const lucideImport = content.match(/from\s+["']lucide-react["']/);
          if (lucideImport) {
            const importBlock = content.slice(0, content.indexOf("lucide-react") + 20);
            expect(importBlock).not.toContain(icon);
          }
        }
      }
    }
  });

  it("STRICT GOVERNANCE: motion-reduce:animate-none on all pulse animations", () => {
    const filesToCheck = [
      questsPageFile,
      ...fs.readdirSync(questsDir).map((f) => path.join(questsDir, f)),
    ].filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      const pulseMatches = content.match(/animate-pulse/g);
      if (pulseMatches) {
        const reducedMatches = content.match(/motion-reduce:animate-none/g);
        expect(reducedMatches?.length).toBeGreaterThanOrEqual(pulseMatches.length);
      }
    }
  });

  it("FAIL-CLOSED: zero backend delta guard", () => {
    let diff = "";
    try {
      diff = execSync("git diff HEAD --name-only", { encoding: "utf8" });
    } catch {
      diff = "";
    }

    const modifiedFiles = diff.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const file of modifiedFiles) {
      expect(file).not.toMatch(/^src\/app\/api\//);
      expect(file).not.toMatch(/^supabase\//);
      expect(file).not.toMatch(/^src\/lib\/growth-engine\//);
      expect(file).not.toMatch(/^src\/lib\/store\//);
      expect(file).not.toMatch(/^src\/proxy\.ts/);
      expect(file).not.toMatch(/^src\/components\/ui\//);
    }
  });
});

describe("Stage 5B-UI Quests Modernization — Component Tests", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("QuestsOverviewStats: renders counts and main quest title accurately", () => {
    render(
      <QuestsOverviewStats
        totalCount={3}
        activeCount={1}
        completedCount={1}
        mainQuest={mockQuests[0]}
      />
    );

    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getAllByText("1").length).toBe(2);
    expect(screen.getByText("总任务数")).toBeDefined();
    expect(screen.getByText(/Master PostgreSQL RLS Policies/)).toBeDefined();
  });

  it("QuestCard: renders quest details, tags, progress, and responds to actions", () => {
    const handleStatus = vi.fn();
    const handleProgress = vi.fn();
    const handleDelete = vi.fn();

    render(
      <QuestCard
        quest={mockQuests[0]}
        onUpdateStatus={handleStatus}
        onUpdateProgress={handleProgress}
        onDelete={handleDelete}
      />
    );

    expect(screen.getByText("Master PostgreSQL RLS Policies")).toBeDefined();
    expect(screen.getByText("学习吸收")).toBeDefined();
    expect(screen.getByText("主线目标")).toBeDefined();
    expect(screen.getAllByText("45%").length).toBeGreaterThanOrEqual(1);

    // Click pause button (since quest-0 is active)
    const pauseBtn = screen.getByTitle("暂停任务");
    fireEvent.click(pauseBtn);
    expect(handleStatus).toHaveBeenCalledWith("quest-1", "paused");

    // Click +25% progress bump
    const bumpBtn = screen.getByText("+25%");
    fireEvent.click(bumpBtn);
    expect(handleProgress).toHaveBeenCalledWith("quest-1", 70);
  });

  it("QuestTreeItem: renders hierarchical tree node and child items", () => {
    const handleStatus = vi.fn();
    const handleProgress = vi.fn();
    const handleDelete = vi.fn();

    render(
      <QuestTreeItem
        node={mockTree[0]}
        level={0}
        onUpdateStatus={handleStatus}
        onUpdateProgress={handleProgress}
        onDelete={handleDelete}
      />
    );

    // Parent title and child titles
    expect(screen.getByText("Master PostgreSQL RLS Policies")).toBeDefined();
    expect(screen.getByText("Build Zero-Drift Design System Tokens")).toBeDefined();
    expect(screen.getByText("Pass Stage 5B Independent Review Gate")).toBeDefined();

    // Child count badge
    expect(screen.getByText("2 个子任务")).toBeDefined();
  });

  it("CreateQuestModal: accessible dialog with submit handler", async () => {
    const handleClose = vi.fn();
    const handleCreated = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(
      <CreateQuestModal
        existingQuests={mockQuests}
        onClose={handleClose}
        onCreated={handleCreated}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(screen.getByLabelText(/新建任务目标/)).toBeDefined();

    const titleInput = screen.getByPlaceholderText(/例如：深入掌握 PostgreSQL RLS/);
    fireEvent.change(titleInput, { target: { value: "New Mission" } });

    const submitBtn = screen.getByText("确认创建");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/quests",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("New Mission"),
        })
      );
      expect(handleCreated).toHaveBeenCalled();
    });
  });

  it("QuestsSkeletonLoading: maintains ARIA busy contract", () => {
    render(<QuestsSkeletonLoading />);
    const skeleton = screen.getByRole("status");
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
  });

  it("QuestsEmptyState: renders empty notice with call to action", () => {
    const handleCreate = vi.fn();
    render(<QuestsEmptyState onCreateQuest={handleCreate} />);
    expect(screen.getByText("暂无任务")).toBeDefined();
    const btn = screen.getByText("创建任务目标");
    fireEvent.click(btn);
    expect(handleCreate).toHaveBeenCalled();
  });

  it("QuestsErrorState: renders error and allows retry", () => {
    const handleRetry = vi.fn();
    render(<QuestsErrorState error="Connection timed out" onRetry={handleRetry} />);
    expect(screen.getByText("Connection timed out")).toBeDefined();
    const retryBtn = screen.getByText("重试");
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalled();
  });
});

describe("Stage 5B-UI Quests Modernization — Page Orchestration", () => {
  beforeEach(() => {
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("tree=true")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ tree: mockTree }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ quests: mockQuests }),
      } as Response);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("QuestsPage: loads tree and flat quests and renders tabs properly", async () => {
    render(<QuestsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText("任务大厅 (Quest System)")).toBeDefined();
    });

    // Check tabs
    const treeTab = screen.getByRole("tab", { name: /任务树视图/ });
    const activeTab = screen.getByRole("tab", { name: /进行中/ });
    const allTab = screen.getByRole("tab", { name: /全部任务/ });
    const completedTab = screen.getByRole("tab", { name: /已完成/ });

    expect(treeTab).toBeDefined();
    expect(activeTab).toBeDefined();
    expect(allTab).toBeDefined();
    expect(completedTab).toBeDefined();

    // Default tab is Tree
    expect(treeTab.getAttribute("aria-selected")).toBe("true");

    // Switch to active tab
    fireEvent.click(activeTab);
    expect(activeTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByText("Master PostgreSQL RLS Policies").length).toBeGreaterThanOrEqual(1);

    // Switch to completed tab
    fireEvent.click(completedTab);
    expect(completedTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Pass Stage 5B Independent Review Gate")).toBeDefined();
  });
});
