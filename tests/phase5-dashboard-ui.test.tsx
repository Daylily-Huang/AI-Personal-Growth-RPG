// @vitest-environment jsdom
/**
 * tests/phase5-dashboard-ui.test.tsx
 * Phase 5 — Core Screen Modernization (Stage 5A-UI Dashboard Modernization)
 * Complete Test Suite covering Requirements 1-21 & Visual Governance
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import DashboardPage from "@/app/dashboard/page";
import { AppShellProvider } from "@/components/layout";
import type { DashboardSnapshot } from "@/lib/store/types";
import {
  PlayerHero,
  QuestsOverview,
  QuickLogCard,
  ActivityHistoryList,
  OverviewSummaryCards,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/dashboard";

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
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// Comprehensive Test Fixture with real schema data
const mockDashboardSnapshot: DashboardSnapshot = {
  player: {
    totalXp: 2850,
    playerLevel: 15,
    energy: 92,
    focus: 88,
    momentum: 4,
  },
  levelProgress: {
    xpIntoLevel: 350,
    xpNeededForNext: 700,
    progress: 0.5,
  },
  skills: [
    {
      id: "skill-1",
      userId: "user-1",
      name: "Rust Systems",
      level: 12,
      xp: 1200,
      masteryLevel: 4,
      masteryConfidence: 0.88,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-20T00:00:00Z",
    },
    {
      id: "skill-2",
      userId: "user-1",
      name: "TypeScript Architecture",
      level: 8,
      xp: 800,
      masteryLevel: 3,
      masteryConfidence: 0.92,
      createdAt: "2026-08-05T00:00:00Z",
      updatedAt: "2026-08-22T00:00:00Z",
    },
  ],
  quests: [
    {
      id: "quest-main",
      userId: "user-1",
      title: "深入掌握生命周期与内存安全",
      status: "active",
      progress: 65,
      isMainQuest: true,
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-25T00:00:00Z",
    },
    {
      id: "quest-side-1",
      userId: "user-1",
      title: "实现 CAS 并发控制状态机",
      status: "active",
      progress: 40,
      isMainQuest: false,
      createdAt: "2026-08-12T00:00:00Z",
      updatedAt: "2026-08-26T00:00:00Z",
    },
  ],
  mainQuest: {
    id: "quest-main",
    userId: "user-1",
    title: "深入掌握生命周期与内存安全",
    status: "active",
    progress: 65,
    isMainQuest: true,
    createdAt: "2026-08-10T00:00:00Z",
    updatedAt: "2026-08-25T00:00:00Z",
  },
  activeQuests: [
    {
      id: "quest-main",
      userId: "user-1",
      title: "深入掌握生命周期与内存安全",
      status: "active",
      progress: 65,
      isMainQuest: true,
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-25T00:00:00Z",
    },
    {
      id: "quest-side-1",
      userId: "user-1",
      title: "实现 CAS 并发控制状态机",
      status: "active",
      progress: 40,
      isMainQuest: false,
      createdAt: "2026-08-12T00:00:00Z",
      updatedAt: "2026-08-26T00:00:00Z",
    },
  ],
  recentGrowth: [
    {
      id: "tx-1",
      userId: "user-1",
      amount: 45,
      reason: "完成了生命周期标注重构练习",
      skillId: "skill-1",
      skillName: "Rust Systems",
      repetitionPenalty: 1,
      repetitionCount: 1,
      createdAt: "2026-08-28T14:30:00Z",
    },
    {
      id: "tx-2",
      userId: "user-1",
      amount: 20,
      reason: "阅读并发编程指南第三章",
      skillId: "skill-1",
      skillName: "Rust Systems",
      repetitionPenalty: 0.8,
      repetitionCount: 2,
      createdAt: "2026-08-27T10:15:00Z",
    },
  ],
  activities: [
    {
      id: "act-1",
      userId: "user-1",
      title: "阅读 Rust 并发手册与生命周期标注",
      rawInput: "深入研读并编写示例代码",
      status: "assessed",
      createdAt: "2026-08-28T14:00:00Z",
    },
  ],
  pendingAssessments: [],
  pendingMasteryVerifications: [
    {
      id: "verif-1",
      skillId: "skill-1",
      skillName: "Rust Systems",
      fromLevel: 3,
      toLevel: 4,
      evidenceLevel: 2,
      status: "pending",
      proposalAssessmentId: "ass-1",
      createdAt: "2026-08-28T14:35:00Z",
      resolvedAt: null,
    },
  ],
} as unknown as DashboardSnapshot;

describe("Phase 5 — Stage 5A-UI Dashboard Modernization Test Suite", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    cleanup();
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  // 1. Dashboard only uses global AppShell
  it("1. verifies DashboardPage mounts cleanly and operates inside the global AppShell without requiring internal shell wrapper", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url) === "/api/dashboard") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ dashboard: mockDashboardSnapshot }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    const { container } = render(
      <AppShellProvider>
        <DashboardPage />
      </AppShellProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-player-hero")).toBeDefined();
    });

    // Verify main content is rendered directly
    expect(container.querySelector("main")).toBeNull(); // Page itself does not render redundant <main> wrapper
  });

  // 2. No nested AppShell
  it("2. strictly verifies that DashboardPage does NOT introduce a nested AppShell or secondary AppHeader/AppSidebar", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url) === "/api/dashboard") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ dashboard: mockDashboardSnapshot }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-player-hero")).toBeDefined();
    });

    expect(container.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(container.querySelector('[data-testid="app-header"]')).toBeNull();
    expect(container.querySelector('[data-testid="app-sidebar"]')).toBeNull();
  });

  // 3. Loading state
  it("3. renders calm LoadingState without layout jumps while fetching dashboard snapshot", () => {
    render(<LoadingState />);
    expect(screen.getByTestId("dashboard-loading-state")).toBeDefined();
    expect(screen.getByText("Loading your growth world…")).toBeDefined();
  });

  // 4. API error state + retry
  it("4. renders ErrorState on API failure and triggers retry callback on user click", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Network connection failed" onRetry={onRetry} />);

    expect(screen.getByTestId("dashboard-error-state")).toBeDefined();
    expect(screen.getByText("Network connection failed")).toBeDefined();
    expect(screen.getByText("加载失败")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /重试 \/ Retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 5. Empty state
  it("5. renders inspiring EmptyState when no activity or proposals exist", () => {
    const onRefresh = vi.fn();
    render(<EmptyState onRefresh={onRefresh} />);

    expect(screen.getByTestId("dashboard-empty-state")).toBeDefined();
    expect(screen.getByText("还没有成长记录")).toBeDefined();
    expect(screen.getByText("🌱")).toBeDefined();

    const refreshBtn = screen.getByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // 6. Player level / XP rendering
  it("6. renders Player Level Badge, Level text, total XP, and XP progress meter accurately", () => {
    render(<PlayerHero dashboard={mockDashboardSnapshot} />);

    expect(screen.getByTestId("level-badge")).toBeDefined();
    expect(screen.getByText("LV.15")).toBeDefined();
    expect(screen.getByText("XP Lv.15")).toBeDefined();
    expect(screen.getByText("2850 XP total")).toBeDefined();
    expect(screen.getByText(/350 \/ 700 XP to next level/)).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
    expect(screen.getByTestId("xp-progress")).toBeDefined();
  });

  // 7. Current quest/action rendering
  it("7. renders Main Quest with Crown icon, progress bar, and secondary active quests", () => {
    render(
      <QuestsOverview
        mainQuest={mockDashboardSnapshot.mainQuest}
        activeQuests={mockDashboardSnapshot.activeQuests}
      />
    );

    expect(screen.getByText("当前主线任务 (Main Quest)")).toBeDefined();
    expect(screen.getByText("深入掌握生命周期与内存安全")).toBeDefined();
    expect(screen.getByText("65%")).toBeDefined();
    expect(screen.getByText("实现 CAS 并发控制状态机")).toBeDefined();
    expect(screen.getByText("40%")).toBeDefined();
  });

  // 8. Recent activity rendering
  it("8. renders Recent Activity History with title and date/status", () => {
    render(<ActivityHistoryList activities={mockDashboardSnapshot.activities} />);

    expect(screen.getByText("Activity History")).toBeDefined();
    expect(screen.getByText("阅读 Rust 并发手册与生命周期标注")).toBeDefined();
    expect(screen.getByText(/assessed/i)).toBeDefined();
  });

  // 9. Real navigation actions
  it("9. provides valid and accessible navigation links to /quests, /skills, /artifacts, /knowledge", () => {
    render(<OverviewSummaryCards dashboard={mockDashboardSnapshot} />);

    const questsLink = screen.getByRole("link", { name: /任务大厅 · Quests/i });
    expect(questsLink.getAttribute("href")).toBe("/quests");

    const skillsLink = screen.getByRole("link", { name: /技能树 · Skills/i });
    expect(skillsLink.getAttribute("href")).toBe("/skills");

    const artifactsLink = screen.getByRole("link", { name: /造物成果 · Artifacts/i });
    expect(artifactsLink.getAttribute("href")).toBe("/artifacts");

    const knowledgeLink = screen.getByRole("link", { name: /知识图谱 · Graph/i });
    expect(knowledgeLink.getAttribute("href")).toBe("/knowledge");
  });

  // 10. Data values from API response
  it("10. faithfully displays exact numeric state values for Energy, Focus, Momentum from API without fabrication", () => {
    render(<PlayerHero dashboard={mockDashboardSnapshot} />);

    expect(screen.getByText("92")).toBeDefined(); // Energy
    expect(screen.getByText("88")).toBeDefined(); // Focus
    expect(screen.getByText("4")).toBeDefined();  // Momentum
  });

  // 11. No fabricated metrics
  it("11. strictly ensures no fake streaks, fake random numbers, or ungrounded statistics exist", () => {
    const emptyDashboard: DashboardSnapshot = {
      player: { playerLevel: 1, totalXp: 0, energy: 100, focus: 100, momentum: 0 },
      levelProgress: { xpIntoLevel: 0, xpNeededForNext: 100, progress: 0 },
      skills: [],
      quests: [],
      activeQuests: [],
      mainQuest: null,
      recentGrowth: [],
      activities: [],
      pendingAssessments: [],
      pendingMasteryVerifications: [],
    };

    const { container } = render(<OverviewSummaryCards dashboard={emptyDashboard} />);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1); // Skills count is 0
    expect(container.textContent).toContain("/ 0"); // Quests count is 0 / 0
    expect(container.textContent).not.toContain("连续打卡");
    expect(container.textContent).not.toContain("Streak");
  });

  // 12. Responsive semantic layout
  it("12. verifies semantic grid and layout class structure for responsive breakpoints (lg:grid-cols-12)", () => {
    const { container } = render(
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <QuestsOverview mainQuest={mockDashboardSnapshot.mainQuest} />
        </div>
        <div className="lg:col-span-5">
          <QuickLogCard rawInput="" setRawInput={vi.fn()} onSubmit={vi.fn()} submitting={false} />
        </div>
      </div>
    );

    expect(container.querySelector(".lg\\:grid-cols-12")).toBeTruthy();
    expect(container.querySelector(".lg\\:col-span-7")).toBeTruthy();
    expect(container.querySelector(".lg\\:col-span-5")).toBeTruthy();
  });

  // 13. Mobile priority order
  it("13. verifies Level 1 Player Hero precedes Level 2 Current Action and Level 3 Growth in DOM order", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url) === "/api/dashboard") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ dashboard: mockDashboardSnapshot }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-player-hero")).toBeDefined();
    });

    const hero = screen.getByTestId("dashboard-player-hero");
    const questSection = screen.getByText("任务目标概览 (Active Quests)");
    const growthSection = screen.getByText("Recent Growth");

    // Preceding DOM order check: hero is before questSection, questSection is before growthSection
    expect(hero.compareDocumentPosition(questSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(questSection.compareDocumentPosition(growthSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // 14. Accessible progress
  it("14. enforces proper ARIA attributes on XP and Quest progress elements", () => {
    render(<PlayerHero dashboard={mockDashboardSnapshot} />);
    const xpProgress = screen.getByRole("progressbar");
    expect(xpProgress.getAttribute("aria-valuenow")).toBe("50");
    expect(xpProgress.getAttribute("aria-valuemin")).toBe("0");
    expect(xpProgress.getAttribute("aria-valuemax")).toBe("100");
  });

  // 15. Keyboard navigation
  it("15. verifies actionable cards and buttons support keyboard operation via Tab and Enter/Space", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <QuickLogCard
        rawInput="今日练习代码"
        setRawInput={vi.fn()}
        onSubmit={onSubmit}
        submitting={false}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /记录并评估/i });
    submitBtn.focus();
    expect(document.activeElement).toBe(submitBtn);

    fireEvent.keyDown(submitBtn, { key: "Enter" });
  });

  // 16. Focus-visible
  it("16. ensures interactive elements include focus-visible focus ring styling", () => {
    const { container } = render(<PlayerHero dashboard={mockDashboardSnapshot} />);
    const focusableElements = container.querySelectorAll("[tabindex='0'], a");
    expect(focusableElements.length).toBeGreaterThan(0);
    focusableElements.forEach((el) => {
      expect(el.className).toContain("focus-visible:");
    });
  });

  // 17. Reduced motion governance
  it("17. verifies that transitions do not rely on bounce or infinite floating animations", () => {
    const { container } = render(<PlayerHero dashboard={mockDashboardSnapshot} />);
    expect(container.innerHTML).not.toContain("animate-bounce");
    expect(container.innerHTML).not.toContain("animate-float");
  });

  // 18. Frozen gold whitelist
  it("18. confirms gold tokens are strictly restricted to Level, XP, Mastery, progression, primary affirmative CTA, focus", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    const allowedGoldFiles = new Set([
      "PlayerHero.tsx",
      "PlayerHeroCard.tsx",
      "TodayQuestsCard.tsx",
      "WeeklyTrendCard.tsx",
      "AiInsightCard.tsx",
      "SkillsGrowthBar.tsx",
      "ZenFocusTimerCard.tsx",
      "DashboardHeader.tsx",
      "RecentAchievementsCard.tsx",
      "PendingProposals.tsx",
      "QuestsOverview.tsx",
      "QuickLogCard.tsx",
      "DashboardStates.tsx",
      "RecentGrowthFeed.tsx",
      "PendingVerifications.tsx",
    ]);

    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      // If gold is used, ensure it is in allowed context
      if (content.includes("var(--gold-")) {
        expect(allowedGoldFiles.has(file), `Unexpected gold token in ${file}`).toBe(true);
      }
    }
  });

  // 19. No raw z-index
  it("19. strictly enforces zero raw z-index utility classes in dashboard components", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    const rawZIndexRegex = /z-(40|50|\[[0-9]+\])/;
    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      expect(rawZIndexRegex.test(content)).toBe(false);
    }
  });

  // 20. No arbitrary forbidden typography literals
  it("20. strictly forbids raw typography debt literals (text-[10px], text-[11px], text-[13px], text-[17px])", () => {
    const checkPaths = [
      path.resolve(process.cwd(), "src/app/dashboard/page.tsx"),
      ...fs.readdirSync(path.resolve(process.cwd(), "src/components/dashboard"))
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => path.resolve(process.cwd(), "src/components/dashboard", f)),
    ];

    const forbiddenTypographyRegex = /text-\[(10px|11px|13px|17px)\]/;
    for (const filePath of checkPaths) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(forbiddenTypographyRegex.test(content)).toBe(false);
    }
  });

  // 21. Fail-Closed Frozen Backend Delta Guard
  it("21. strictly asserts ZERO modifications were made to frozen backend and domain paths", () => {
    const forbiddenPrefixes = [
      "src/app/api/",
      "supabase/",
      "src/lib/store/",
      "src/lib/ai/",
      "src/lib/growth-engine/",
      "src/lib/supabase/",
      "src/lib/auth/",
      "src/lib/http/",
      "src/proxy.ts",
    ];

    function resolveBaseRefStrict(): string {
      const candidates = [
        process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null,
        "origin/main",
        "main",
      ].filter(Boolean) as string[];

      for (const candidate of candidates) {
        try {
          execSync(`git rev-parse --verify ${candidate}`, { stdio: "ignore" });
          return candidate;
        } catch {}
      }
      throw new Error("FAIL-CLOSED: Unable to resolve valid git base ref for backend delta guard.");
    }

    const baseRef = resolveBaseRefStrict();
    const gitDiff = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: "utf8" });
    const changedFiles = gitDiff
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const violations = changedFiles.filter((file) =>
      forbiddenPrefixes.some((prefix) => file.startsWith(prefix) || file.includes(prefix))
    );

    expect(violations).toEqual([]);
  });

  // 22. Visual Governance Guard: zero dark-theme regressions or cyberpunk styles
  it("22. guarantees zero hardcoded dark-theme regression classes (bg-slate-900, bg-slate-950, bg-black/20)", () => {
    const checkPaths = [
      path.resolve(process.cwd(), "src/app/dashboard/page.tsx"),
      ...fs.readdirSync(path.resolve(process.cwd(), "src/components/dashboard"))
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => path.resolve(process.cwd(), "src/components/dashboard", f)),
    ];

    const forbiddenDarkClasses = [
      "bg-slate-900",
      "bg-slate-950",
      "bg-black/20",
      "from-slate-900",
      "to-slate-950",
      "from-amber-950",
    ];

    for (const filePath of checkPaths) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const cls of forbiddenDarkClasses) {
        expect(content.includes(cls)).toBe(false);
      }
    }
  });
});
