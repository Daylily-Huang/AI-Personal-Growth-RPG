// @vitest-environment jsdom
/**
 * tests/phase5-dashboard-ui.test.tsx
 * Phase 5 — Core Screen Modernization (Stage 5A-UI Dashboard Modernization)
 * Round 4 Surgical Final Closure Test Suite covering:
 * - Data Integrity & Zero Fabricated Data
 * - Strict Visual Governance & Single AppEnvironment Layer
 * - Neutral Semantic Icons (Zero Fantasy / Game-Prop Icons)
 * - Complete Reduced-Motion Contract (motion-reduce:animate-none)
 * - Strict 44px Touch Targets across all interactive controls
 * - Settlement Authority & Neutral Un-grounded Copy Guard
 * - Non-duplicate Player Level Hierarchy
 * - Fail-Closed Frozen Backend Delta Guard
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import DashboardPage from "@/app/dashboard/page";
import { AppShellProvider } from "@/components/layout";
import type { DashboardSnapshot, Quest } from "@/lib/store/types";
import {
  DashboardHeader,
  PlayerHeroCard,
  QuestsOverview,
  QuickLogCard,
  TopSkillsCard,
  OverviewSummaryCards,
  LoadingState,
  ErrorState,
  EmptyState,
  isFreshDashboard,
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
      name: "Rust Systems",
      level: 12,
      xp: 1200,
      masteryLevel: 4,
      masteryConfidence: 0.88,
      lastUsedAt: "2026-08-28T14:30:00Z",
    },
    {
      id: "skill-2",
      name: "TypeScript Architecture",
      level: 10,
      xp: 950,
      masteryLevel: 3,
      masteryConfidence: 0.85,
      lastUsedAt: "2026-08-27T10:00:00Z",
    },
  ],
  quests: [
    {
      id: "quest-1",
      title: "深入掌握生命周期与内存安全",
      status: "active",
      progress: 65,
      isMainQuest: true,
      parentQuestId: null,
      description: "完成 Rust 所有权与生命周期的深度学习",
      questType: "learning",
      questSize: "main",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-28T10:00:00Z",
    },
    {
      id: "quest-2",
      title: "构建高内聚领域存储层",
      status: "active",
      progress: 40,
      isMainQuest: false,
      parentQuestId: null,
      description: "实现基于内存与 Supabase 的双模存储抽象",
      questType: "engineering",
      questSize: "minor",
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-28T11:00:00Z",
    },
  ],
  mainQuest: {
    id: "quest-1",
    title: "深入掌握生命周期与内存安全",
    status: "active",
    progress: 65,
    isMainQuest: true,
    parentQuestId: null,
    description: "完成 Rust 所有权与生命周期的深度学习",
    questType: "learning",
    questSize: "main",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-28T10:00:00Z",
  },
  activeQuests: [
    {
      id: "quest-1",
      title: "深入掌握生命周期与内存安全",
      status: "active",
      progress: 65,
      isMainQuest: true,
      parentQuestId: null,
      description: "完成 Rust 所有权与生命周期的深度学习",
      questType: "learning",
      questSize: "main",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-28T10:00:00Z",
    },
    {
      id: "quest-2",
      title: "构建高内聚领域存储层",
      status: "active",
      progress: 40,
      isMainQuest: false,
      parentQuestId: null,
      description: "实现基于内存与 Supabase 的双模存储抽象",
      questType: "engineering",
      questSize: "minor",
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-28T11:00:00Z",
    },
  ],
  recentGrowth: [
    {
      id: "tx-1",
      activityId: "act-1",
      assessmentId: "ass-1",
      xpType: "activity",
      skillId: "skill-1",
      skillName: "Rust Systems",
      activityType: "coding",
      repetitionCount: 1,
      repetitionPenalty: 1.0,
      amount: 45,
      baseAmount: 45,
      modifierJson: {},
      reason: "完成了所有权练习",
      rulesVersion: "2026-08-17.1",
      createdAt: "2026-08-28T14:30:00Z",
    },
  ],
  activities: [
    {
      id: "act-1",
      questId: "quest-1",
      rawInput: "完成了所有权练习并阅读官方文档",
      title: "完成了所有权练习",
      activityType: "coding",
      status: "confirmed",
      totalMinutes: 90,
      effectiveMinutes: 75,
      rulesVersion: "2026-08-17.1",
      createdAt: "2026-08-28T14:00:00Z",
    },
  ],
  pendingAssessments: [],
  pendingMasteryVerifications: [],
} as unknown as DashboardSnapshot;

describe("Phase 5 — Stage 5A-UI Dashboard Modernization Test Suite (Round 4)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    cleanup();
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  // 1. AppShell Integration
  it("1. verifies DashboardPage mounts cleanly and operates inside the global AppShell without requiring internal shell wrapper", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/dashboard") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ dashboard: mockDashboardSnapshot }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(
      <AppShellProvider>
        <DashboardPage />
      </AppShellProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-player-hero")).toBeDefined();
    });

    expect(document.querySelectorAll("aside").length).toBe(0);
    expect(document.querySelectorAll("header").length).toBe(0);
  });

  // 2. No Nested AppShell
  it("2. strictly verifies that DashboardPage does NOT introduce a nested AppShell or secondary AppHeader/AppSidebar", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/dashboard") {
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

    expect(container.querySelector('[data-testid="app-header"]')).toBeNull();
    expect(container.querySelector('[data-testid="app-sidebar"]')).toBeNull();
  });

  // 3. Loading Skeleton Geometry & Reduced Motion
  it("3. renders geometry-reserving skeleton with role=status, aria-busy=true, and motion-reduce:animate-none", () => {
    const { container } = render(<LoadingState />);
    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toBeDefined();
    expect(statusRegion.getAttribute("aria-busy")).toBe("true");

    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
    for (const el of pulseElements) {
      expect(el.className).toContain("motion-reduce:animate-none");
    }

    // No decorative gold spinners
    expect(container.innerHTML).not.toContain("var(--gold-");
  });

  // 4. Error State
  it("4. renders ErrorState on API failure and triggers retry callback on user click", () => {
    const retryFn = vi.fn();
    render(<ErrorState message="网络连接异常" onRetry={retryFn} />);

    expect(screen.getByText("仪表盘加载受阻")).toBeDefined();
    expect(screen.getByText("网络连接异常")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /重新连接/ });
    fireEvent.click(retryBtn);
    expect(retryFn).toHaveBeenCalledTimes(1);
  });

  // 5. Fresh User Onboarding & Settlement Copy Invariant
  it("5. correctly identifies a fresh dashboard and verifies accurate settlement-authority copy", () => {
    const freshSnapshot: DashboardSnapshot = {
      player: { totalXp: 0, playerLevel: 1, energy: 100, focus: 100, momentum: 0 },
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
    expect(isFreshDashboard(freshSnapshot)).toBe(true);

    // Skill-only is NOT fresh
    expect(isFreshDashboard({ ...freshSnapshot, skills: mockDashboardSnapshot.skills })).toBe(false);
    // Quest-only is NOT fresh
    expect(isFreshDashboard({ ...freshSnapshot, quests: mockDashboardSnapshot.quests })).toBe(false);
    // Growth-only is NOT fresh
    expect(isFreshDashboard({ ...freshSnapshot, recentGrowth: mockDashboardSnapshot.recentGrowth })).toBe(false);

    // Render EmptyState and assert frozen authority wording
    const { container } = render(<EmptyState />);
    expect(screen.getByText(/AI 会生成成长评估 Proposal.*Growth Engine 才会结算 XP/)).toBeDefined();
    expect(container.textContent).not.toContain("AI 将评估你的成长并结算");
  });

  // 6. Real Player Level & XP without duplicate level presentation
  it("6. renders Player Level, total XP, and XP progress meter accurately without duplicate level hierarchy", () => {
    render(<PlayerHeroCard dashboard={mockDashboardSnapshot} />);
    const levelBadge = screen.getByTestId("level-badge");
    expect(levelBadge.textContent).toBe("LV.15");
    expect(screen.getByText("成长等级")).toBeDefined();
    expect(screen.getByText("XP Lv.15")).toBeDefined();
    expect(screen.getByText("2850 XP total")).toBeDefined();
    expect(screen.getByText("350")).toBeDefined();
    expect(screen.getByText(/\/ 700 XP/)).toBeDefined();

    // Verify levelBadge parent row contains 成长等级, NOT duplicate LV.15 + XP Lv.15 side-by-side
    const badgeRow = levelBadge.parentElement;
    expect(badgeRow?.textContent).toContain("成长等级");
    expect(badgeRow?.textContent).not.toContain("XP Lv.15");
  });

  // 7. Active Main Quest only
  it("7. renders Main Quest only when its status is strictly 'active'", () => {
    const activeMainQuest: Quest = {
      id: "q-main",
      title: "主线攻坚",
      status: "active",
      progress: 50,
      isMainQuest: true,
      parentQuestId: null,
      description: "active",
      questType: "learning",
      questSize: "main",
      createdAt: "",
      updatedAt: "",
    } as unknown as Quest;

    const { rerender } = render(<QuestsOverview mainQuest={activeMainQuest} activeQuests={[activeMainQuest]} />);
    expect(screen.getByText("当前主线任务 (Main Quest)")).toBeDefined();
    expect(screen.getByText("主线攻坚")).toBeDefined();

    // When status is paused or completed, it must NOT display as current action
    const pausedMainQuest: Quest = { ...activeMainQuest, status: "paused" as Quest["status"] };
    rerender(<QuestsOverview mainQuest={pausedMainQuest} activeQuests={[]} />);
    expect(screen.queryByText("当前主线任务 (Main Quest)")).toBeNull();

    const completedMainQuest: Quest = { ...activeMainQuest, status: "completed" as Quest["status"], progress: 100 };
    rerender(<QuestsOverview mainQuest={completedMainQuest} activeQuests={[]} />);
    expect(screen.queryByText("当前主线任务 (Main Quest)")).toBeNull();
  });

  // 8. No Fabricated Quest XP or Checkboxes
  it("8. strictly ensures QuestsOverview is a read-only preview without fake +XP or local completion checkboxes", () => {
    const { container } = render(
      <QuestsOverview
        mainQuest={mockDashboardSnapshot.mainQuest}
        activeQuests={mockDashboardSnapshot.activeQuests}
      />
    );

    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(container.textContent).not.toContain("+60 XP");
    expect(container.textContent).not.toContain("+80 XP");
    expect(container.textContent).not.toContain("+120 XP");
    expect(container.textContent).not.toContain("晨间冥想");
  });

  // 9. Real Top Skills only (Accurate title, no fake skills, no fake max XP)
  it("9. strictly renders real skills and does not fabricate skills or artificial next-level denominators", () => {
    const { container, rerender } = render(<TopSkillsCard skills={mockDashboardSnapshot.skills} />);
    expect(screen.getByText("核心技能 · Top Skills")).toBeDefined();
    expect(container.textContent).not.toContain("核心技能精通");
    expect(screen.getByText("Rust Systems")).toBeDefined();
    expect(screen.getByText("TypeScript Architecture")).toBeDefined();
    expect(container.textContent).not.toContain("专注力 Lv.23");
    expect(container.textContent).not.toContain("学习力 Lv.21");
    expect(container.textContent).not.toContain("/ 3,000");

    // Empty skills case
    rerender(<TopSkillsCard skills={[]} />);
    expect(screen.getByText("暂无已激活技能，完成活动以解锁技能成长")).toBeDefined();
  });

  // 10. Real numeric vitals
  it("10. faithfully displays exact numeric state values for Energy, Focus, Momentum from API without fabrication", () => {
    render(<PlayerHeroCard dashboard={mockDashboardSnapshot} />);
    expect(screen.getByText("92")).toBeDefined();
    expect(screen.getByText("88")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
  });

  // 11. No Fabricated Business Defaults in Source
  it("11. strictly enforces that dashboard production source contains ZERO fabricated business-data arrays", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    const forbiddenIdentifiers = [
      "defaultTasks",
      "defaultTemplates",
      "growthRateText",
      "todayFocusedText",
      "晨间冥想",
      "初见山巅",
      "博学者",
      "专注者",
      "星野",
      "ZenFocusTimer",
      "RecentAchievements",
      "AiInsightCard",
      "InkAtmosphere",
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      for (const id of forbiddenIdentifiers) {
        expect(content.includes(id), `Forbidden fabricated identifier '${id}' found in ${file}`).toBe(false);
      }
    }
  });

  // 12. Real Structural Regions in DOM
  it("12. verifies semantic grid and layout structure in DashboardPage using real data-testid regions", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/dashboard") {
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
      expect(screen.getByTestId("dashboard-core-grid")).toBeDefined();
    });

    expect(screen.getByTestId("dashboard-action-grid")).toBeDefined();
    expect(screen.getByTestId("dashboard-growth-grid")).toBeDefined();
  });

  // 13. DOM Hierarchy Order
  it("13. verifies Level 1 Player Hero precedes Level 2 Current Action and Level 3 Growth in DOM order", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/dashboard") {
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

    expect(hero.compareDocumentPosition(questSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(questSection.compareDocumentPosition(growthSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // 14. ARIA Progress Attributes
  it("14. enforces proper ARIA attributes on XP and Quest progress elements", () => {
    render(<PlayerHeroCard dashboard={mockDashboardSnapshot} />);
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
    expect(progressBars[0].getAttribute("aria-valuenow")).toBe("50");
    expect(progressBars[0].getAttribute("aria-valuemax")).toBe("100");
    expect(progressBars[0].getAttribute("aria-valuetext")).toBe("350 / 700 XP (50%)");
  });

  // 15. Real Form Action & Quick Log Contract
  it("15. verifies Quick Log handles real form submission with input state and loading feedback", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const setRawInput = vi.fn();

    const { rerender } = render(
      <QuickLogCard
        rawInput="今日阅读技术文档"
        setRawInput={setRawInput}
        onSubmit={onSubmit}
        submitting={false}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /记录并评估/ });
    expect(submitBtn).toBeDefined();
    expect(submitBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // When submitting, disabled and busy
    rerender(
      <QuickLogCard
        rawInput="今日阅读技术文档"
        setRawInput={setRawInput}
        onSubmit={onSubmit}
        submitting={true}
      />
    );
    const submittingBtn = screen.getByRole("button", { name: /AI 评估中…/ });
    expect(submittingBtn.hasAttribute("disabled")).toBe(true);
  });

  // 16. Touch Targets >= 44px Across Full Dashboard
  it("16. ensures all interactive controls across dashboard components meet min-h-[var(--touch-target-min)] contract", () => {
    // 16a. Overview Summary Cards
    const { unmount: u1 } = render(<OverviewSummaryCards dashboard={mockDashboardSnapshot} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-[var(--touch-target-min)]");
    }
    u1();

    // 16b. Top Skills Card
    const { unmount: u2 } = render(<TopSkillsCard skills={mockDashboardSnapshot.skills} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-[var(--touch-target-min)]");
    }
    u2();

    // 16c. Dashboard Header
    const { unmount: u3 } = render(<DashboardHeader onQuickLog={() => {}} />);
    const headerBtn = screen.getByRole("button", { name: /快速记录成长/ });
    expect(headerBtn.className).toContain("min-h-[var(--touch-target-min)]");
    u3();

    // 16d. Quests Overview
    const { unmount: u4 } = render(<QuestsOverview mainQuest={mockDashboardSnapshot.mainQuest} activeQuests={[]} />);
    const questsLink = screen.getByRole("link", { name: /查看全部/ });
    expect(questsLink.className).toContain("min-h-[var(--touch-target-min)]");
    u4();

    // 16e. Quick Log Form
    const { unmount: u5 } = render(
      <QuickLogCard rawInput="abc" setRawInput={() => {}} onSubmit={() => {}} submitting={false} />
    );
    const submitBtn = screen.getByRole("button", { name: /记录并评估/ });
    expect(submitBtn.className).toContain("min-h-[var(--touch-target-min)]");
    u5();

    // 16f. Empty State
    const { unmount: u6 } = render(<EmptyState onFocusQuickLog={() => {}} />);
    const emptyBtn = screen.getByRole("button", { name: /立即开始第一次记录/ });
    expect(emptyBtn.className).toContain("min-h-[var(--touch-target-min)]");
    u6();
  });

  // 17. Reduced Motion Friendly & motion-reduce:animate-none
  it("17. strictly verifies that any animate-* class in dashboard is accompanied by motion-reduce:animate-none", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      expect(content.includes("animate-bounce")).toBe(false);
      expect(content.includes("infinite-floating")).toBe(false);

      // If file has animate-pulse, it must have motion-reduce:animate-none
      if (content.includes("animate-pulse")) {
        expect(content.includes("motion-reduce:animate-none"), `${file} uses animate-pulse without motion-reduce:animate-none`).toBe(true);
      }
    }
  });

  // 18. Strict Gold Token Whitelist
  it("18. strictly restricts direct Gold tokens to Level, XP, and Mastery progression only", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    // Explicitly forbidden to contain ANY direct gold tokens:
    const strictlyForbiddenGoldFiles = [
      "DashboardHeader.tsx",
      "QuestsOverview.tsx",
      "QuickLogCard.tsx",
      "TopSkillsCard.tsx",
      "PendingProposals.tsx",
      "DashboardStates.tsx",
      "ActivityHistoryList.tsx",
      "OverviewSummaryCards.tsx",
    ];

    for (const file of strictlyForbiddenGoldFiles) {
      const filePath = path.join(dashboardDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        expect(content.includes("var(--gold-"), `Unexpected direct Gold token in ${file}`).toBe(false);
      }
    }

    // Allowed gold files must strictly be for XP / Level / Mastery semantics
    const allowedGoldFiles = new Set(["PlayerHeroCard.tsx", "PendingVerifications.tsx", "RecentGrowthFeed.tsx"]);
    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      if (content.includes("var(--gold-")) {
        expect(allowedGoldFiles.has(file), `Direct Gold token in non-whitelisted ${file}`).toBe(true);
      }
    }
  });

  // 19. Zero Raw Z-Index
  it("19. strictly enforces zero raw z-index utility classes in dashboard components", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    const rawZIndexRegex = /z-(10|20|30|40|50|\[[0-9]+\]|\[var\(--z-content\)\])/;

    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      expect(rawZIndexRegex.test(content), `Found raw/unregistered z-index in ${file}`).toBe(false);
    }
  });

  // 20. No Raw Typography Literals
  it("20. strictly forbids raw typography debt literals (text-[10px], text-[11px], text-[12px], text-[13px], text-[17px])", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));
    const pagePath = path.resolve(process.cwd(), "src/app/dashboard/page.tsx");

    const forbiddenTypographyRegex = /text-\[(10|11|12|13|17)px\]/;
    const checkPaths = [...files.map((f) => path.join(dashboardDir, f)), pagePath];

    for (const filePath of checkPaths) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(forbiddenTypographyRegex.test(content), `Found forbidden typography literal in ${filePath}`).toBe(false);
    }
  });

  // 21. No Raw Anchor Tags for Internal Navigation
  it("21. ensures all internal links use Next.js Link instead of raw anchors", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));
    const pagePath = path.resolve(process.cwd(), "src/app/dashboard/page.tsx");

    const checkPaths = [...files.map((f) => path.join(dashboardDir, f)), pagePath];
    for (const filePath of checkPaths) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content.includes('<a href="/'), `Found raw internal anchor link in ${filePath}`).toBe(false);
    }
  });

  // 22. Fail-Closed Frozen Backend Delta Guard
  it("22. strictly asserts ZERO modifications were made to frozen backend and domain paths", () => {
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

  // 23. Zero Hardcoded Dark Theme Regressions
  it("23. guarantees zero hardcoded dark-theme regression classes (bg-slate-900, bg-slate-950, bg-black/20)", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));
    const pagePath = path.resolve(process.cwd(), "src/app/dashboard/page.tsx");

    const checkPaths = [...files.map((f) => path.join(dashboardDir, f)), pagePath];
    const forbiddenClasses = ["bg-slate-900", "bg-slate-950", "bg-black/20", "bg-black/40", "bg-zinc-900"];

    for (const filePath of checkPaths) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const cls of forbiddenClasses) {
        expect(content.includes(cls), `Found forbidden dark class ${cls} in ${filePath}`).toBe(false);
      }
    }
  });

  // 24. Single Global AppEnvironment Verification
  it("24. strictly ensures no secondary fixed full-screen environment layers exist in dashboard components", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      expect(content.includes("fixed inset-0"), `Found duplicate full-screen environment in ${file}`).toBe(false);
      expect(content.includes("InkAtmosphere"), `Found deprecated InkAtmosphere in ${file}`).toBe(false);
    }
  });

  // 25. No Fantasy or Game-Prop Icons Governance Guard
  it("25. strictly forbids overt fantasy/game-prop icons in dashboard presentation (Sword, Swords, Crown, Gem, Scroll, Shield, ShieldAlert)", () => {
    const dashboardDir = path.resolve(process.cwd(), "src/components/dashboard");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".tsx"));

    const forbiddenPropIcons = [
      "Sword",
      "Swords",
      "Crown",
      "Gem",
      "Scroll",
      "Shield",
      "ShieldAlert",
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(dashboardDir, file), "utf8");
      for (const icon of forbiddenPropIcons) {
        const iconRegex = new RegExp(`\\b${icon}\\b`);
        expect(iconRegex.test(content), `Prohibited fantasy/game-prop icon '${icon}' found in ${file}`).toBe(false);
      }
    }
  });

  // 26. Neutral Design Tokens for Local Artwork
  it("26. ensures local SVG artwork consumes semantic design tokens instead of hardcoded hex colors", () => {
    const heroPath = path.resolve(process.cwd(), "src/components/dashboard/PlayerHeroCard.tsx");
    const content = fs.readFileSync(heroPath, "utf8");
    expect(content.includes("#2f3630")).toBe(false);
    expect(content.includes("var(--text-primary)")).toBe(true);
  });

  // 27. Neutral Greeting Subtitle Copy Guard
  it("27. ensures DashboardHeader subtitle is grounded and does not make uncalculated comparative claims", () => {
    const headerPath = path.resolve(process.cwd(), "src/components/dashboard/DashboardHeader.tsx");
    const content = fs.readFileSync(headerPath, "utf8");
    expect(content.includes("今天也比昨天更进一步")).toBe(false);
    expect(content.includes("从真实行动出发，持续沉淀你的成长轨迹")).toBe(true);
  });
});
