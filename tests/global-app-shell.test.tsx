// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, renderHook, act } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import {
  AppEnvironment,
  AppSidebar,
  AppHeader,
  AppWorkspace,
  MobileNav,
  InspectorDrawer,
  AppShell,
  AppShellBoundary,
  AppShellProvider,
  useAppShell,
  useInspectorUrlState,
  isProductRoute,
} from "@/components/layout";
import type { DashboardSnapshot } from "@/lib/store/types";
import { validateVisualMigrationDelta } from "./visual-foundation.test";

// Mock next/navigation
let currentPathname = "/dashboard";
let currentSearchParams = new URLSearchParams();
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn((url: string) => {
  const [newPath, query] = url.split("?");
  currentPathname = newPath;
  currentSearchParams = new URLSearchParams(query || "");
});
const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
  }),
}));

const mockDashboard: DashboardSnapshot = {
  player: {
    totalXp: 1250,
    playerLevel: 14,
    energy: 100,
    focus: 85,
    momentum: 3,
  },
  levelProgress: {
    xpIntoLevel: 150,
    xpNeededForNext: 300,
    progress: 0.5,
  },
  recentGrowth: [],
  pendingAssessments: [
    {
      id: "assess-1",
      activityId: "act-1",
      status: "pending",
      proposal: {
        activity: { type: "learning", completion: 1 },
        difficulty: { complexity: 0.5, uncertainty: 0.3, expertise_gap: 0.4, resistance: 0.2 },
        growth: {
          effort: 0.8,
          learning: 0.9,
          performance: 0.7,
          outcome: 0.8,
          artifact_value: 0.2,
          character_evidence: 0.1,
        },
        evidence: { level: 2, explanation: "练习所有权模型" },
        affected_skills: [{ name: "Rust", reason: "练习所有权模型" }],
        knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
        mastery_changes: [],
        xp_semantics: {
          base_value: 20,
          difficulty: 0.5,
          mastery_gain: 0.5,
          novelty: 0.5,
          goal_alignment: 0.6,
          repetition_risk: "low",
        },
        artifacts: [],
        next_quest: { title: "继续进阶", reason: "深入生命周期" },
        confidence: 0.9,
        uncertainty_notes: [],
      },
      modelName: "deepseek",
      promptVersion: "v1",
      rulesVersion: "v1",
      confidence: 0.9,
      createdAt: "2026-08-31T00:00:00Z",
      confirmedAt: null,
    },
  ],
  activities: [],
  skills: [],
  pendingMasteryVerifications: [],
};

describe("Global App Shell — Phase 2 Architecture & Component Verification", () => {
  beforeEach(() => {
    currentPathname = "/dashboard";
    currentSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ----------------------------------------------------
  // 1-4. Route Classifier & Persistent AppShell Boundary
  // ----------------------------------------------------
  it("1. verifies segment-safe isProductRoute classifier matches known product routes and subpaths", () => {
    expect(isProductRoute("/dashboard")).toBe(true);
    expect(isProductRoute("/quests")).toBe(true);
    expect(isProductRoute("/quests/quest-123")).toBe(true);
    expect(isProductRoute("/skills")).toBe(true);
    expect(isProductRoute("/knowledge")).toBe(true);
    expect(isProductRoute("/artifacts")).toBe(true);

    expect(isProductRoute("/login")).toBe(false);
    expect(isProductRoute("/")).toBe(false);
    expect(isProductRoute("/api/dashboard")).toBe(false);
    expect(isProductRoute("/onboarding")).toBe(false);
  });

  it("2. verifies ONE persistent AppShell boundary wraps product routes and survives route transitions", () => {
    currentPathname = "/dashboard";
    const { rerender } = render(
      <AppShellBoundary>
        <div data-testid="page-content">当前页面</div>
      </AppShellBoundary>
    );

    expect(screen.getByTestId("app-shell-root")).toBeTruthy();

    // Navigate to /quests
    currentPathname = "/quests";
    rerender(
      <AppShellBoundary>
        <div data-testid="page-content">当前页面</div>
      </AppShellBoundary>
    );

    expect(screen.getByTestId("app-shell-root")).toBeTruthy();
  });

  it("3. verifies /login and non-product routes are strictly excluded from AppShell", () => {
    currentPathname = "/login";
    const { rerender } = render(
      <AppShellBoundary>
        <div data-testid="login-page">登录</div>
      </AppShellBoundary>
    );

    expect(screen.queryByTestId("app-shell-root")).toBeNull();
    expect(screen.getByTestId("login-page")).toBeTruthy();

    currentPathname = "/";
    rerender(
      <AppShellBoundary>
        <div data-testid="root-landing">根路径重定向</div>
      </AppShellBoundary>
    );
    expect(screen.queryByTestId("app-shell-root")).toBeNull();
  });

  it("4. verifies AppWorkspace sits explicitly above AppEnvironment via z-canvas", () => {
    render(
      <AppShell dashboard={mockDashboard}>
        <div>页面内容</div>
      </AppShell>
    );

    const workspace = screen.getByTestId("app-workspace");
    expect(workspace.className).toContain("relative z-[var(--z-canvas)]");

    const env = screen.getByTestId("app-environment");
    expect(env.className).toContain("z-[var(--z-bg-env)]");
  });

  it("4b. verifies AppWorkspace supports fullBleed canvas rendering without padding", () => {
    render(
      <AppWorkspace fullBleed={true}>
        <div>画布</div>
      </AppWorkspace>
    );
    const workspace = screen.getByTestId("app-workspace");
    expect(workspace.getAttribute("data-full-bleed")).toBe("true");
    expect(workspace.className).toContain("w-full h-full p-0 overflow-hidden");
  });

  // ----------------------------------------------------
  // 5-9. Responsive Header & Sidebar Matrix (CSS-First)
  // ----------------------------------------------------
  it("5. verifies Base header hides breadcrumbs and full XP progression capsule", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    const breadcrumbs = screen.getByTestId("header-breadcrumbs");
    const capsule = screen.getByTestId("header-progression-capsule");

    expect(breadcrumbs.className).toContain("hidden lg:flex");
    expect(capsule.className).toContain("hidden lg:flex");
  });

  it("5b. verifies MobileNav renders active item indicator for current route", () => {
    currentPathname = "/quests";
    render(<MobileNav />);
    const questItem = screen.getByTestId("mobile-nav-quests");
    expect(questItem.getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("mobile-active-indicator")).toBeTruthy();
  });

  it("6. verifies md header displays Compact Title + Level Badge only", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    const tabletLevelBadge = screen.getByTestId("header-tablet-level-badge");
    expect(tabletLevelBadge.className).toContain("hidden md:inline-block lg:hidden");
    expect(tabletLevelBadge.textContent).toBe("LV.14");
  });

  it("7. verifies lg header exposes full Breadcrumbs and XP capsule", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    const breadcrumbs = screen.getByTestId("header-breadcrumbs");
    const capsule = screen.getByTestId("header-progression-capsule");

    expect(breadcrumbs.className).toContain("hidden lg:flex");
    expect(capsule.className).toContain("hidden lg:flex");
  });

  it("8. verifies md sidebar is collapsed by structural CSS classes (no JS matchMedia)", () => {
    render(<AppSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
    const sidebar = screen.getByTestId("app-sidebar");
    expect(sidebar.className).toContain("w-[var(--sidebar-width-collapsed)] lg:w-[var(--sidebar-width-expanded)]");
  });

  it("9. verifies content offset matches CSS-first collapsed md and expanded lg contract", () => {
    render(
      <AppShell dashboard={mockDashboard}>
        <div>内容</div>
      </AppShell>
    );

    const container = screen.getByTestId("app-shell-content-container");
    expect(container.className).toContain("md:ml-[var(--sidebar-width-collapsed)] lg:ml-[var(--sidebar-width-expanded)]");
  });

  it("10. verifies no raw 1024px / 64rem breakpoint literals exist in layout code", () => {
    const layoutDir = path.resolve(process.cwd(), "src/components/layout");
    const files = fs.readdirSync(layoutDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(layoutDir, file), "utf8");
      expect(content).not.toContain("1024px");
      expect(content).not.toContain("64rem");
    }
  });

  // ----------------------------------------------------
  // 11-15. Skills & Knowledge Mobile Filter Opener & Breakpoint Gap Fix
  // ----------------------------------------------------
  it("11. verifies Skills page has a reachable mobile filter opener button", () => {
    const filePath = path.resolve(process.cwd(), "src/app/skills/page.tsx");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain('onClick={() => setMobileNavOpen(true)}');
    expect(content).toContain('aria-label="打开筛选面板"');
  });

  it("12. verifies Knowledge page has a reachable mobile filter opener button", () => {
    const filePath = path.resolve(process.cwd(), "src/app/knowledge/page.tsx");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain('onClick={() => setMobileNavOpen(true)}');
    expect(content).toContain('aria-label="打开筛选面板"');
  });

  it("13. verifies no legacy 1280px matchMedia authority remains in Skills or Knowledge pages", () => {
    const skillsPath = path.resolve(process.cwd(), "src/app/skills/page.tsx");
    const knowledgePath = path.resolve(process.cwd(), "src/app/knowledge/page.tsx");
    expect(fs.readFileSync(skillsPath, "utf8")).not.toContain("1280px");
    expect(fs.readFileSync(knowledgePath, "utf8")).not.toContain("1280px");
  });

  it("14. verifies Skills detail panel supports single-instance responsive container (desktop static column on xl, overlay on < xl)", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/skills/page.tsx"), "utf8");
    expect(content).toContain("xl:relative xl:w-[380px] xl:shrink-0");
    expect(content).toContain("xl:hidden");
    expect(content).toContain("xl:static");
  });

  it("15. verifies Knowledge detail panel supports single-instance responsive container (desktop static column on xl, overlay on < xl)", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");
    expect(content).toContain("xl:relative xl:w-[380px] xl:shrink-0");
    expect(content).toContain("xl:hidden");
    expect(content).toContain("xl:static");
  });

  // ----------------------------------------------------
  // 16-19. Shell Read-Model Synchronization
  // ----------------------------------------------------
  it("16. verifies AppShellContext publishes latest dashboard snapshot to AppHeader", () => {
    function TestConsumer() {
      const { setDashboard } = useAppShell();
      return (
        <div>
          <button
            data-testid="update-btn"
            onClick={() =>
              setDashboard({
                ...mockDashboard,
                player: { ...mockDashboard.player, playerLevel: 15 },
                pendingAssessments: [],
              })
            }
          >
            升级
          </button>
          <AppHeader />
        </div>
      );
    }

    render(
      <AppShellProvider initialDashboard={mockDashboard}>
        <TestConsumer />
      </AppShellProvider>
    );

    expect(screen.getByTestId("header-player-level").textContent).toBe("LV.14");
    expect(screen.getByTestId("pending-assessment-indicator")).toBeTruthy();

    // Trigger update
    fireEvent.click(screen.getByTestId("update-btn"));

    // Header updates immediately
    expect(screen.getByTestId("header-player-level").textContent).toBe("LV.15");
    expect(screen.queryByTestId("pending-assessment-indicator")).toBeNull();
  });

  // ----------------------------------------------------
  // 20-25. InspectorDrawer Mobile Anchoring, Push Mode & A11y
  // ----------------------------------------------------
  it("20. verifies InspectorDrawer root uses flex-col justify-end for bottom sheet anchoring", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试">
        <div>内容</div>
      </InspectorDrawer>
    );

    const root = screen.getByTestId("inspector-drawer-root");
    expect(root.className).toContain("flex flex-col justify-end");
  });

  it("21. verifies InspectorDrawer panel consumes duration-drawer-mobile token on mobile", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试">
        <div>内容</div>
      </InspectorDrawer>
    );

    const panel = screen.getByTestId("inspector-drawer-panel");
    expect(panel.className).toContain("duration-[var(--duration-drawer-mobile)]");
    expect(panel.className).toContain("md:duration-[var(--duration-drawer)]");
  });

  it("22. verifies InspectorDrawer mode='push' renders as non-modal region without backdrop", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试" mode="push">
        <div>推送抽屉内容</div>
      </InspectorDrawer>
    );

    expect(screen.queryByTestId("inspector-drawer-backdrop")).toBeNull();
    const panel = screen.getByTestId("inspector-drawer-panel");
    expect(panel.getAttribute("role")).toBe("region");
    expect(panel.getAttribute("aria-modal")).toBeNull();
  });

  it("23. verifies InspectorDrawer closes on Escape key", () => {
    const onClose = vi.fn();
    render(
      <InspectorDrawer open={true} onClose={onClose} title="测试">
        <div>内容</div>
      </InspectorDrawer>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("24. verifies Tab key cycles focus within modal drawer", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试">
        <button data-testid="btn-last">最后按钮</button>
      </InspectorDrawer>
    );

    const lastBtn = screen.getByTestId("btn-last");
    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(screen.getByTestId("inspector-drawer-close"));
  });

  it("25. verifies Shift+Tab key cycles focus backwards within modal drawer", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试">
        <button data-testid="btn-last">最后按钮</button>
      </InspectorDrawer>
    );

    const closeBtn = screen.getByTestId("inspector-drawer-close");
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("btn-last"));
  });

  it("26. verifies focus is restored to the triggering element upon drawer close", () => {
    const onClose = vi.fn();
    function TestComponent() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="open-trigger" onClick={() => setOpen(true)}>
            打开
          </button>
          <InspectorDrawer open={open} onClose={() => { setOpen(false); onClose(); }} title="抽屉">
            <div>内容</div>
          </InspectorDrawer>
        </div>
      );
    }

    render(<TestComponent />);
    const trigger = screen.getByTestId("open-trigger");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(screen.getByTestId("inspector-drawer-panel")).toBeTruthy();

    const closeBtn = screen.getByTestId("inspector-drawer-close");
    fireEvent.click(closeBtn);

    expect(document.activeElement).toBe(trigger);
  });

  it("27. verifies title-less drawer provides valid accessible naming", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()}>
        <div>无标题抽屉</div>
      </InspectorDrawer>
    );

    const panel = screen.getByTestId("inspector-drawer-panel");
    expect(panel.getAttribute("aria-label")).toBe("检查器");
    expect(panel.getAttribute("aria-labelledby")).toBeNull();
  });

  // ----------------------------------------------------
  // 28-31. Universal URL State Infrastructure
  // ----------------------------------------------------
  it("28. verifies useInspectorUrlState reads ?inspect=<id> from URL", () => {
    currentSearchParams = new URLSearchParams("inspect=node-123&filter=all");
    const { result } = renderHook(() => useInspectorUrlState());
    expect(result.current.inspectId).toBe("node-123");
  });

  it("29. verifies useInspectorUrlState reads ?tab=<tab> from URL", () => {
    currentSearchParams = new URLSearchParams("inspect=node-123&tab=evidence");
    const { result } = renderHook(() => useInspectorUrlState());
    expect(result.current.inspectId).toBe("node-123");
    expect(result.current.activeTab).toBe("evidence");
  });

  it("30. verifies closing inspector removes inspect and tab query params while preserving others", () => {
    currentSearchParams = new URLSearchParams("view=graph&filter=active&inspect=skill-99&tab=history");
    const { result } = renderHook(() => useInspectorUrlState());

    act(() => {
      result.current.closeInspector();
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard?view=graph&filter=active");
  });

  it("31. verifies openInspector and setTab preserve unrelated query parameters", () => {
    currentSearchParams = new URLSearchParams("domain=rust&level=3");
    const { result } = renderHook(() => useInspectorUrlState());

    act(() => {
      result.current.openInspector("skill-rust-ownership", "details");
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard?domain=rust&level=3&inspect=skill-rust-ownership&tab=details");
  });

  // ----------------------------------------------------
  // 32-35. Style Audits & Frozen Diff Guard
  // ----------------------------------------------------
  it("32. verifies Brand shield does NOT consume progression Gold", () => {
    const sidebarFilePath = path.resolve(process.cwd(), "src/components/layout/AppSidebar.tsx");
    const content = fs.readFileSync(sidebarFilePath, "utf8");
    expect(content).not.toContain("gold-400)]");
    expect(content).not.toContain("gold-300)]");
  });

  it("33. verifies no raw hex codes or arbitrary numeric styling literals remain in src/components/layout/**", () => {
    const layoutDir = path.resolve(process.cwd(), "src/components/layout");
    const files = fs.readdirSync(layoutDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(layoutDir, file), "utf8");
      const hexMatches = content.match(/#[0-9a-fA-F]{3,8}\b/g);
      expect(hexMatches, `Raw hex color found in ${file}: ${hexMatches?.join(", ")}`).toBeNull();

      const arbitraryNumericMatches = content.match(/(?:w|h|p|m|text|rounded|max-w|min-w)-\[\d+px\]/g);
      expect(arbitraryNumericMatches, `Arbitrary numeric pixel literal in ${file}: ${arbitraryNumericMatches?.join(", ")}`).toBeNull();

      const rawFallbackMatches = content.match(/var\(--[^,)]+,\s*[^)]+\)/g);
      expect(rawFallbackMatches, `Unapproved CSS var fallback in ${file}: ${rawFallbackMatches?.join(", ")}`).toBeNull();
    }
  });

  it("34. verifies AppEnvironment artwork strictly binds color to var(--bg-ink-wash) via CSS mask", () => {
    render(<AppEnvironment />);
    const artwork = screen.getByTestId("environment-artwork");
    expect(artwork.className).toContain("bg-[var(--bg-ink-wash)]");
    expect(artwork.style.maskImage).toContain("ink-landscape.svg");
  });

  it("35. verifies frozen backend/domain diff guard passes", () => {
    const layoutFiles = [
      "src/components/layout/AppEnvironment.tsx",
      "src/components/layout/AppSidebar.tsx",
      "src/components/layout/AppHeader.tsx",
      "src/components/layout/AppWorkspace.tsx",
      "src/components/layout/MobileNav.tsx",
      "src/components/layout/InspectorDrawer.tsx",
      "src/components/layout/AppShell.tsx",
      "src/components/layout/AppShellBoundary.tsx",
      "src/components/layout/AppShellContext.tsx",
      "src/components/layout/useInspectorUrlState.ts",
      "src/components/layout/index.ts",
      "src/app/layout.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/quests/page.tsx",
      "src/app/skills/page.tsx",
      "src/app/knowledge/page.tsx",
      "tests/global-app-shell.test.tsx",
    ];
    const result = validateVisualMigrationDelta(layoutFiles);
    expect(result.isVisualPR).toBe(true);
    expect(result.violations).toEqual([]);
  });
});
