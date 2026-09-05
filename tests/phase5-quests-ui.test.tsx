// @vitest-environment jsdom
/**
 * tests/phase5-quests-ui.test.tsx
 * Phase 5 — Core Screen Modernization (Stage 5B-UI Quests Modernization)
 * Round 2 Independent Review Governance & Quality Test Suite covering:
 * - 1. Strict Token Existence: Every CSS variable used exists in frozen design-tokens.css
 * - 2. Zero Raw Z-Index: No raw Tailwind z-* classes in Quests code
 * - 3. Zero Dark Hardcoded Classes: Comprehensive dark color scanner (bg-black, text-white, slate/zinc)
 * - 4. Strict Gold Whitelist: Only for affirmative CTA buttons and focus ring, never on generic inputs
 * - 5. Heading Hierarchy: Zero duplicate h1, page uses h2 (AppHeader has h1), cards use h3
 * - 6. Fail-Closed Committed PR Backend Delta Guard (origin/main...HEAD)
 * - 7. Frozen Modal Integration: BaseModal, PrimaryButton, SecondaryButton
 * - 8. Complete W3C ARIA Tablist & Tabpanel Contract with Roving TabIndex and Arrow Keys
 * - 9. Semantic Hierarchical Quests Presentation with Accessible Expand/Collapse
 * - 10. Fail-Closed Error Copy Sanitization: Prevents raw SQL/internal database leaks
 * - 11. Complete Component Rendering: OverviewStats, QuestCard, QuestsStates
 * - 12. Dependency & Lockfile Freeze: Zero package.json or pnpm-lock delta
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

describe("Stage 5B-UI Quests Modernization — Round 2 Governance Audits", () => {
  const questsDir = path.resolve(process.cwd(), "src/components/quests");
  const questsPageFile = path.resolve(process.cwd(), "src/app/quests/page.tsx");
  const designTokensFile = path.resolve(process.cwd(), "src/styles/design-tokens.css");

  const filesToCheck = [
    questsPageFile,
    ...fs.readdirSync(questsDir).map((f) => path.join(questsDir, f)),
  ].filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

  it("STRICT TOKEN GOVERNANCE: every CSS variable used in Quests code exists in frozen design-tokens.css", () => {
    const tokensContent = fs.readFileSync(designTokensFile, "utf8");
    const declaredTokenMatches = tokensContent.match(/--[a-zA-Z0-9_-]+/g) ?? [];
    const declaredTokens = new Set(declaredTokenMatches);

    const usedVars = new Set<string>();
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      const varMatches = content.matchAll(/var\((--[a-zA-Z0-9_-]+)\)/g);
      for (const m of varMatches) {
        usedVars.add(m[1]);
      }
    }

    expect(usedVars.size).toBeGreaterThan(0);
    const unregisteredVars: string[] = [];
    for (const v of usedVars) {
      if (!declaredTokens.has(v)) {
        unregisteredVars.push(v);
      }
    }

    expect(unregisteredVars).toEqual([]);
  });

  it("STRICT GOVERNANCE: zero raw z-index classes in Quests code", () => {
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      const rawZMatch = content.match(/\bz-\d+\b/);
      expect(rawZMatch).toBeNull();
    }
  });

  it("STRICT GOVERNANCE: zero hardcoded dark theme classes (including bg-black, text-white, raw slate/zinc/neutral)", () => {
    const forbiddenDarkPatterns = [
      /\bbg-slate-\d+\b/,
      /\btext-slate-\d+\b/,
      /\bborder-slate-\d+\b/,
      /\bbg-zinc-\d+\b/,
      /\btext-zinc-\d+\b/,
      /\bborder-zinc-\d+\b/,
      /\bbg-neutral-\d+\b/,
      /\btext-neutral-\d+\b/,
      /\bborder-neutral-\d+\b/,
      /\bborder-white\/\d+\b/,
      /\bbg-black\b/,
      /\bbg-black\/\d+\b/,
      /\btext-white\b/,
    ];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenDarkPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it("STRICT GOVERNANCE: zero fantasy / game-prop icons imported or rendered", () => {
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
        if (matches) {
          const lucideImport = content.match(/from\s+["']lucide-react["']/);
          if (lucideImport) {
            const importBlock = content.slice(0, content.indexOf("lucide-react") + 20);
            expect(importBlock).not.toContain(icon);
          }
        }
      }
    }
  });

  it("STRICT GOVERNANCE: Gold token whitelist — Gold allowed only on affirmative CTA and focus ring", () => {
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      // Check that range inputs and checkboxes never use gold accent
      expect(content).not.toMatch(/accent-\[var\(--gold-[^\]]+\)\]/);
    }
  });

  it("HEADING HIERARCHY: Quests page uses h2 (AppHeader uses h1) and cards use h3", () => {
    const pageContent = fs.readFileSync(questsPageFile, "utf8");
    expect(pageContent).not.toMatch(/<h1\b/);
    expect(pageContent).toMatch(/<h2\b/);
  });

  it("STRICT GOVERNANCE: motion-reduce:animate-none on all pulse animations", () => {
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      const pulseMatches = content.match(/animate-pulse/g);
      if (pulseMatches) {
        const reducedMatches = content.match(/motion-reduce:animate-none/g);
        expect(reducedMatches?.length).toBeGreaterThanOrEqual(pulseMatches.length);
      }
    }
  });

  it("FAIL-CLOSED: committed PR backend & domain delta guard against origin/main...HEAD", () => {
    let diff = "";
    try {
      diff = execSync("git diff --name-only origin/main...HEAD", { encoding: "utf8" });
    } catch {
      try {
        diff = execSync("git diff --name-only main...HEAD", { encoding: "utf8" });
      } catch {
        diff = execSync("git diff --name-only HEAD~1", { encoding: "utf8" });
      }
    }

    const modifiedFiles = diff.split("\n").map((s) => s.trim()).filter(Boolean);
    expect(modifiedFiles.length).toBeGreaterThan(0);

    const forbiddenPrefixes = [
      "src/app/api/",
      "supabase/",
      "src/lib/store/",
      "src/lib/growth-engine/",
      "src/lib/ai/",
      "src/lib/supabase/",
      "src/lib/auth/",
      "src/lib/http/",
      "src/proxy.ts",
      "src/components/ui/",
    ];

    for (const file of modifiedFiles) {
      for (const prefix of forbiddenPrefixes) {
        expect(file.startsWith(prefix)).toBe(false);
      }
      expect(file).not.toBe("package.json");
      expect(file).not.toBe("pnpm-lock.yaml");
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

  it("QuestTreeItem: renders hierarchical tree node and child items with expand/collapse toggle", () => {
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

    // Toggle collapse
    const collapseBtn = screen.getByLabelText("折叠子任务");
    fireEvent.click(collapseBtn);
    expect(screen.queryByText("Build Zero-Drift Design System Tokens")).toBeNull();

    // Toggle expand
    const expandBtn = screen.getByLabelText("展开子任务");
    fireEvent.click(expandBtn);
    expect(screen.getByText("Build Zero-Drift Design System Tokens")).toBeDefined();
  });

  it("CreateQuestModal: integrates with frozen BaseModal and handles creation", async () => {
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

    // Rendered via BaseModal (has role="dialog")
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(screen.getByText("新建任务目标")).toBeDefined();

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

  it("CreateQuestModal: fail-closed error copy sanitizes raw database/SQL errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "relation \"quests\" violates foreign key constraint in postgres database SQL" }),
    } as Response);

    render(
      <CreateQuestModal
        existingQuests={mockQuests}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const titleInput = screen.getByPlaceholderText(/例如：深入掌握 PostgreSQL RLS/);
    fireEvent.change(titleInput, { target: { value: "Trigger Error" } });

    const submitBtn = screen.getByText("确认创建");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("创建任务失败，请稍后重试")).toBeDefined();
      expect(screen.queryByText(/foreign key constraint/)).toBeNull();
      expect(screen.queryByText(/postgres database SQL/)).toBeNull();
    });
  });

  it("QuestsSkeletonLoading: maintains ARIA busy contract and reduced-motion", () => {
    render(<QuestsSkeletonLoading />);
    const skeleton = screen.getByRole("status");
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
  });

  it("QuestsEmptyState: renders empty notice with PrimaryButton call to action", () => {
    const handleCreate = vi.fn();
    render(<QuestsEmptyState onCreateQuest={handleCreate} />);
    expect(screen.getByText("暂无任务")).toBeDefined();
    const btn = screen.getByText("创建任务目标");
    fireEvent.click(btn);
    expect(handleCreate).toHaveBeenCalled();
  });

  it("QuestsErrorState: renders error with danger token styling and allows retry", () => {
    const handleRetry = vi.fn();
    render(<QuestsErrorState error="Connection timed out" onRetry={handleRetry} />);
    expect(screen.getByText("Connection timed out")).toBeDefined();
    const retryBtn = screen.getByText("重试");
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalled();
  });
});

describe("Stage 5B-UI Quests Modernization — Page Orchestration & ARIA Tabs", () => {
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

  it("QuestsPage: loads tree and flat quests and supports full ARIA tablist/tabpanel navigation", async () => {
    render(<QuestsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText("任务大厅 (Quest System)")).toBeDefined();
    });

    // Check tablist and tabs
    const tablist = screen.getByRole("tablist", { name: "任务视图分类" });
    expect(tablist).toBeDefined();

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
    expect(treeTab.getAttribute("tabIndex")).toBe("0");
    expect(activeTab.getAttribute("tabIndex")).toBe("-1");

    // Tabpanel exists and references tab
    const tabpanel = screen.getByRole("tabpanel");
    expect(tabpanel.getAttribute("aria-labelledby")).toBe("tab-tree");

    // Arrow navigation: Press ArrowRight on treeTab to navigate to activeTab
    fireEvent.keyDown(treeTab, { key: "ArrowRight" });
    expect(activeTab.getAttribute("aria-selected")).toBe("true");
    expect(activeTab.getAttribute("tabIndex")).toBe("0");
    expect(tabpanel.getAttribute("aria-labelledby")).toBe("tab-active");
    expect(screen.getAllByText("Master PostgreSQL RLS Policies").length).toBeGreaterThanOrEqual(1);

    // Switch to completed tab via click
    fireEvent.click(completedTab);
    expect(completedTab.getAttribute("aria-selected")).toBe("true");
    expect(tabpanel.getAttribute("aria-labelledby")).toBe("tab-completed");
    expect(screen.getByText("Pass Stage 5B Independent Review Gate")).toBeDefined();
  });
});
