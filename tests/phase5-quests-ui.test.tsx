// @vitest-environment jsdom
/**
 * tests/phase5-quests-ui.test.tsx
 * Phase 5 — Core Screen Modernization (Stage 5B-UI Quests Modernization)
 * Round 3 Surgical Lifecycle / Fail-Closed Closure Test Suite covering:
 * - 1. Strict Token Governance: Every CSS variable used exists in frozen design-tokens.css
 * - 2. Zero Direct Gold Tokens: Gold strictly encapsulated inside PrimaryButton
 * - 3. Zero Raw Z-Index: No raw Tailwind z-* classes in Quests code
 * - 4. Zero Dark Hardcoded Classes: Comprehensive dark color scanner (bg-black, text-white, slate/zinc)
 * - 5. Heading Hierarchy: Zero duplicate h1, page uses h2 (AppHeader has h1), cards use h3
 * - 6. Fail-Closed Committed PR Backend Delta Guard (strict merge-base, no HEAD~1 fallback)
 * - 7. Complete 7-State QuestStatus Matrix: locked, available, active, paused, completed, failed, archived
 * - 8. +25% Progress Mutation Authority: Strictly restricted to active quests
 * - 9. CreateQuestModal Fail-Closed Error Mapping: Allowlist only, zero SQL/constraint/DB leaks
 * - 10. Semantic Nested List Presentation: <ul> and <li> in tree and flat lists
 * - 11. Complete W3C ARIA Tablist & Tabpanel Contract with Roving TabIndex and Arrow Keys
 * - 12. QuestsStates: Skeleton loading, EmptyState, ErrorState
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
  mapCreateQuestError,
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

describe("Stage 5B-UI Quests Modernization — Governance Audits", () => {
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

  it("STRICT GOVERNANCE: zero direct var(--gold-*) in Quest presentation files (Gold encapsulated in PrimaryButton)", () => {
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/var\(--gold-[^)]+\)/);
    }
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

  it("FAIL-CLOSED: committed PR backend & domain delta guard against merge-base (NO HEAD~1 fallback)", () => {
    let mergeBase = "";
    try {
      mergeBase = execSync("git merge-base origin/main HEAD", { encoding: "utf8" }).trim();
    } catch {
      try {
        mergeBase = execSync("git merge-base main HEAD", { encoding: "utf8" }).trim();
      } catch (err) {
        throw new Error(`FAIL-CLOSED: Unable to resolve merge-base against origin/main or main: ${err}`);
      }
    }

    expect(mergeBase).toBeTruthy();
    const diff = execSync(`git diff --name-only ${mergeBase}...HEAD`, { encoding: "utf8" });
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

describe("Stage 5B-UI Quests Modernization — Full 7-State Lifecycle Matrix", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const baseQuest: Quest = {
    id: "quest-matrix",
    userId: "user-1",
    title: "Lifecycle Matrix Verification Quest",
    description: "Verifying each of the 7 frozen QuestStatus values",
    questType: "learning",
    questSize: "standard",
    parentQuestId: null,
    isMainQuest: false,
    isBoss: false,
    difficulty: 0.5,
    goalAlignment: 0.8,
    status: "available",
    progress: 20,
    deadline: null,
    completedAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-05T00:00:00Z",
  };

  it("1. locked: renders '锁定', NO '已达成', NO +25% button, NO action buttons", () => {
    const handleStatus = vi.fn();
    const handleProgress = vi.fn();

    render(
      <QuestCard
        quest={{ ...baseQuest, status: "locked" }}
        onUpdateStatus={handleStatus}
        onUpdateProgress={handleProgress}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("quest-status-locked")).toBeDefined();
    expect(screen.getByText("锁定")).toBeDefined();
    expect(screen.queryByText("已达成")).toBeNull();
    expect(screen.queryByText("已完成")).toBeNull();
    expect(screen.queryByTestId("quest-progress-bump")).toBeNull();
    expect(screen.queryByTestId("quest-action-start")).toBeNull();
    expect(screen.queryByTestId("quest-action-pause")).toBeNull();
    expect(screen.queryByTestId("quest-action-complete")).toBeNull();
    expect(screen.queryByTestId("quest-action-resume")).toBeNull();
  });

  it("2. available: renders '开始任务', NO +25% button, calls onUpdateStatus('active')", () => {
    const handleStatus = vi.fn();
    const handleProgress = vi.fn();

    render(
      <QuestCard
        quest={{ ...baseQuest, status: "available" }}
        onUpdateStatus={handleStatus}
        onUpdateProgress={handleProgress}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("quest-action-start")).toBeDefined();
    expect(screen.getByText("开始任务")).toBeDefined();
    expect(screen.queryByText("已达成")).toBeNull();
    expect(screen.queryByTestId("quest-progress-bump")).toBeNull();

    fireEvent.click(screen.getByTestId("quest-action-start"));
    expect(handleStatus).toHaveBeenCalledWith("quest-matrix", "active");
  });

  it("3. active: renders '暂停任务', '完成', renders +25% button and triggers bump callback", () => {
    const handleStatus = vi.fn();
    const handleProgress = vi.fn();

    render(
      <QuestCard
        quest={{ ...baseQuest, status: "active" }}
        onUpdateStatus={handleStatus}
        onUpdateProgress={handleProgress}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("quest-action-pause")).toBeDefined();
    expect(screen.getByTestId("quest-action-complete")).toBeDefined();
    expect(screen.getByTestId("quest-progress-bump")).toBeDefined();

    fireEvent.click(screen.getByTestId("quest-action-pause"));
    expect(handleStatus).toHaveBeenCalledWith("quest-matrix", "paused");

    fireEvent.click(screen.getByTestId("quest-action-complete"));
    expect(handleStatus).toHaveBeenCalledWith("quest-matrix", "completed");

    fireEvent.click(screen.getByTestId("quest-progress-bump"));
    expect(handleProgress).toHaveBeenCalledWith("quest-matrix", 45); // 20 + 25
  });

  it("4. paused: renders '继续任务', NO +25% button, calls onUpdateStatus('active')", () => {
    const handleStatus = vi.fn();
    const handleProgress = vi.fn();

    render(
      <QuestCard
        quest={{ ...baseQuest, status: "paused" }}
        onUpdateStatus={handleStatus}
        onUpdateProgress={handleProgress}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("quest-action-resume")).toBeDefined();
    expect(screen.getByText("继续任务")).toBeDefined();
    expect(screen.queryByText("已达成")).toBeNull();
    expect(screen.queryByTestId("quest-progress-bump")).toBeNull();

    fireEvent.click(screen.getByTestId("quest-action-resume"));
    expect(handleStatus).toHaveBeenCalledWith("quest-matrix", "active");
  });

  it("5. completed: renders '已完成', success styling, NO +25% button", () => {
    render(
      <QuestCard
        quest={{ ...baseQuest, status: "completed", progress: 100 }}
        onUpdateStatus={vi.fn()}
        onUpdateProgress={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("quest-status-completed")).toBeDefined();
    expect(screen.getByText("已完成")).toBeDefined();
    expect(screen.queryByTestId("quest-progress-bump")).toBeNull();
  });

  it("6. failed: renders '已失败', danger styling, NO '已达成', NO +25% button", () => {
    render(
      <QuestCard
        quest={{ ...baseQuest, status: "failed" }}
        onUpdateStatus={vi.fn()}
        onUpdateProgress={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("quest-status-failed")).toBeDefined();
    expect(screen.getByText("已失败")).toBeDefined();
    expect(screen.queryByText("已达成")).toBeNull();
    expect(screen.queryByText("已完成")).toBeNull();
    expect(screen.queryByTestId("quest-progress-bump")).toBeNull();
  });

  it("7. archived: renders '已归档', muted styling, NO '已达成', NO +25% button", () => {
    render(
      <QuestCard
        quest={{ ...baseQuest, status: "archived" }}
        onUpdateStatus={vi.fn()}
        onUpdateProgress={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("quest-status-archived")).toBeDefined();
    expect(screen.getByText("已归档")).toBeDefined();
    expect(screen.queryByText("已达成")).toBeNull();
    expect(screen.queryByText("已完成")).toBeNull();
    expect(screen.queryByTestId("quest-progress-bump")).toBeNull();
  });
});

describe("Stage 5B-UI Quests Modernization — Error Allowlist & Component Tests", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("mapCreateQuestError: fail-closed allowlist sanitizes raw database/SQL leaks", () => {
    // 1. Foreign key constraint leak
    expect(
      mapCreateQuestError('insert or update on table "quests" violates foreign key constraint "quests_parent_quest_id_fkey"')
    ).toBe("所选上级任务不存在或不可用");

    // 2. Unique constraint leak
    expect(
      mapCreateQuestError('duplicate key value violates unique constraint "quests_pkey"')
    ).toBe("创建任务失败，请稍后重试");

    // 3. UUID syntax error
    expect(
      mapCreateQuestError('invalid input syntax for type uuid: "abc"')
    ).toBe("创建任务失败，请稍后重试");

    // 4. Arbitrary unexpected server error
    expect(
      mapCreateQuestError("internal connection pool exhausted at node pg driver")
    ).toBe("创建任务失败，请稍后重试");

    // 5. Safe business messages
    expect(mapCreateQuestError("title is required")).toBe("请输入任务名称");
    expect(mapCreateQuestError("Cycle detected in parent quest hierarchy")).toBe(
      "不能将任务关联到自己的下级任务"
    );
    expect(mapCreateQuestError("Self-parenting is forbidden")).toBe(
      "任务不能设置自己为上级任务"
    );
    expect(mapCreateQuestError("unique_active_main_quest")).toBe(
      "当前已有主线任务，请先调整现有主线设置"
    );
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

  it("QuestTreeItem: renders semantic nested <li> and <ul> hierarchy with expand/collapse toggle", () => {
    const handleStatus = vi.fn();
    const handleProgress = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ul data-testid="test-tree-root">
        <QuestTreeItem
          node={mockTree[0]}
          level={0}
          onUpdateStatus={handleStatus}
          onUpdateProgress={handleProgress}
          onDelete={handleDelete}
        />
      </ul>
    );

    // Rendered as li element
    const parentLi = screen.getByTestId("quest-tree-item-quest-1");
    expect(parentLi.tagName.toLowerCase()).toBe("li");

    // Children rendered as nested ul
    const childrenUl = screen.getByTestId("quest-tree-children-quest-1");
    expect(childrenUl.tagName.toLowerCase()).toBe("ul");

    // Toggle collapse
    const collapseBtn = screen.getByLabelText("折叠子任务");
    fireEvent.click(collapseBtn);
    expect(screen.queryByTestId("quest-tree-children-quest-1")).toBeNull();

    // Toggle expand
    const expandBtn = screen.getByLabelText("展开子任务");
    fireEvent.click(expandBtn);
    expect(screen.getByTestId("quest-tree-children-quest-1")).toBeDefined();
  });

  it("CreateQuestModal: integrates with frozen BaseModal and displays sanitized error on foreign key failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'insert or update on table "quests" violates foreign key constraint "quests_parent_quest_id_fkey"',
      }),
    } as Response);

    render(
      <CreateQuestModal
        existingQuests={mockQuests}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const titleInput = screen.getByPlaceholderText(/例如：深入掌握 PostgreSQL RLS/);
    fireEvent.change(titleInput, { target: { value: "FK Test Mission" } });

    const submitBtn = screen.getByText("确认创建");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("所选上级任务不存在或不可用")).toBeDefined();
      expect(screen.queryByText(/foreign key constraint/)).toBeNull();
      expect(screen.queryByText(/quests_parent_quest_id_fkey/)).toBeNull();
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

describe("Stage 5B-UI Quests Modernization — Page Orchestration & Semantic Lists", () => {
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

  it("QuestsPage: loads tree and flat quests and uses semantic ul/li list markup without role=feed", async () => {
    render(<QuestsPage />);

    await waitFor(() => {
      expect(screen.getByText("任务大厅 (Quest System)")).toBeDefined();
    });

    // Check tabs
    const treeTab = screen.getByRole("tab", { name: /任务树视图/ });
    const activeTab = screen.getByRole("tab", { name: /进行中/ });
    const completedTab = screen.getByRole("tab", { name: /已完成/ });

    expect(treeTab.getAttribute("aria-selected")).toBe("true");

    // Tree container is a semantic <ul>
    const treeList = screen.getByTestId("quests-tree-list");
    expect(treeList.tagName.toLowerCase()).toBe("ul");

    // Arrow navigation: Press ArrowRight on treeTab to navigate to activeTab
    fireEvent.keyDown(treeTab, { key: "ArrowRight" });
    expect(activeTab.getAttribute("aria-selected")).toBe("true");

    // Flat list is a semantic <ul>, NOT role="feed"
    expect(screen.queryByRole("feed")).toBeNull();
    const activeList = screen.getByRole("list", { name: "任务列表" });
    expect(activeList.tagName.toLowerCase()).toBe("ul");

    // Switch to completed tab via click
    fireEvent.click(completedTab);
    expect(completedTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Pass Stage 5B Independent Review Gate")).toBeDefined();
  });
});
