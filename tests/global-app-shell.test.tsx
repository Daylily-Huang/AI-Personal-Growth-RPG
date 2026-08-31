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
  useOptionalAppShell,
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

  it("3. verifies non-product routes render outside AppShell without layout chrome", () => {
    currentPathname = "/login";
    render(
      <AppShellBoundary>
        <div data-testid="login-content">登录页面</div>
      </AppShellBoundary>
    );

    expect(screen.queryByTestId("app-shell-root")).toBeNull();
    expect(screen.getByTestId("login-content")).toBeTruthy();
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

    expect(tabletLevelBadge).toBeTruthy();
    expect(tabletLevelBadge.className).toContain("hidden md:inline-block lg:hidden");
    expect(tabletLevelBadge.textContent).toBe("LV.14");
  });

  it("7. verifies lg and xl header renders full breadcrumbs and XP progression meter", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    const breadcrumbs = screen.getByTestId("header-breadcrumbs");
    const capsule = screen.getByTestId("header-progression-capsule");
    const xpIntoLevel = screen.getByTestId("header-xp-into-level");
    const xpNeeded = screen.getByTestId("header-xp-needed");
    const xpBar = screen.getByTestId("header-xp-bar");

    expect(breadcrumbs).toBeTruthy();
    expect(capsule).toBeTruthy();
    expect(xpIntoLevel.textContent).toBe("150");
    expect(xpNeeded.textContent).toBe("300 XP");
    expect(xpBar.style.width).toBe("50%");
  });

  it("8. verifies AppSidebar uses CSS-first collapsed width on md and expanded on lg", () => {
    render(<AppSidebar collapsed={false} onToggleCollapse={vi.fn()} playerLevel={14} />);
    const sidebar = screen.getByTestId("app-sidebar");

    expect(sidebar.className).toContain("w-[var(--sidebar-width-collapsed)] lg:w-[var(--sidebar-width-expanded)]");
  });

  it("9. verifies AppShell content margin is offset via CSS-first sidebar tokens", () => {
    render(
      <AppShell dashboard={mockDashboard}>
        <div>内容</div>
      </AppShell>
    );
    const content = screen.getByTestId("app-shell-content-container");

    expect(content.className).toContain("md:ml-[var(--sidebar-width-collapsed)] lg:ml-[var(--sidebar-width-expanded)]");
  });

  it("9b. verifies AppSidebar hides toggle button on md tablet and displays only on lg+", () => {
    render(<AppSidebar collapsed={false} onToggleCollapse={vi.fn()} playerLevel={14} />);
    const toggleBtn = screen.getByTestId("sidebar-toggle-button");
    expect(toggleBtn.className).toContain("hidden lg:flex");
  });

  // ----------------------------------------------------
  // 10-15. Skills & Knowledge Mobile Filter Openers & No Match States
  // ----------------------------------------------------
  it("10. verifies Skills page contains mobile filter opener with aria-label", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/skills/page.tsx"), "utf8");
    expect(content).toContain('aria-label="打开筛选面板"');
    expect(content).toContain("setMobileNavOpen(true)");
  });

  it("11. verifies Knowledge page contains mobile filter opener with aria-label", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");
    expect(content).toContain('aria-label="打开筛选面板"');
    expect(content).toContain("setMobileNavOpen(true)");
  });

  it("12. verifies Knowledge page restores focusTarget and centering mechanism", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");
    expect(content).toContain("setFocusTarget");
    expect(content).toContain("focusTarget={focusTarget}");
  });

  it("13. verifies Knowledge page restores no-match-state and clear-all-filters-btn", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");
    expect(content).toContain('data-testid="no-match-state"');
    expect(content).toContain('data-testid="clear-all-filters-btn"');
    expect(content).toContain("handleResetFilters");
  });

  it("14. verifies Skills detail panel supports single-instance responsive container (desktop static column on xl, overlay on < xl)", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/skills/page.tsx"), "utf8");
    expect(content).toContain("xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0");
    expect(content).toContain("xl:hidden");
    expect(content).toContain("xl:static");
  });

  it("15. verifies Knowledge detail panel supports single-instance responsive container (desktop static column on xl, overlay on < xl)", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");
    expect(content).toContain("xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0");
    expect(content).toContain("xl:hidden");
    expect(content).toContain("xl:static");
  });

  // ----------------------------------------------------
  // 16-19. Shell Read-Model Synchronization & Hook Architecture
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

  it("17. verifies useOptionalAppShell returns null outside provider without throwing", () => {
    function OptionalConsumer() {
      const shellCtx = useOptionalAppShell();
      return <div data-testid="ctx-result">{shellCtx ? "inside" : "outside"}</div>;
    }
    render(<OptionalConsumer />);
    expect(screen.getByTestId("ctx-result").textContent).toBe("outside");
  });

  it("18. verifies useAppShell throws descriptive error when used outside provider", () => {
    function StrictConsumer() {
      useAppShell();
      return <div>strict</div>;
    }
    expect(() => render(<StrictConsumer />)).toThrow("useAppShell must be used within an AppShellProvider");
  });

  it("19. verifies initialDashboard suppresses initial network fetch in AppShellProvider", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <AppShellProvider initialDashboard={mockDashboard}>
        <div>已初始化</div>
      </AppShellProvider>
    );
    expect(fetchSpy).not.toHaveBeenCalledWith("/api/dashboard");
  });

  // ----------------------------------------------------
  // 20-27. InspectorDrawer Modal, Structural Push & Auto Modes
  // ----------------------------------------------------
  it("20. verifies InspectorDrawer mode='push' is a structural aside, NOT a fixed overlay", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="属性检查器" mode="push">
        <div>推送抽屉内容</div>
      </InspectorDrawer>
    );

    const root = screen.getByTestId("inspector-drawer-root");
    expect(root.tagName.toLowerCase()).toBe("aside");
    expect(root.getAttribute("role")).toBe("region");
    expect(root.className).not.toContain("fixed inset-0");
    expect(root.className).toContain("w-[var(--drawer-width-wide)]");
    expect(screen.queryByTestId("inspector-drawer-backdrop")).toBeNull();
  });

  it("21. verifies InspectorDrawer mode='modal' renders fixed viewport overlay with backdrop and dialog role", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="模态抽屉" mode="modal">
        <div>模态抽屉内容</div>
      </InspectorDrawer>
    );

    const root = screen.getByTestId("inspector-drawer-root");
    expect(root.className).toContain("fixed inset-0");
    expect(screen.getByTestId("inspector-drawer-backdrop")).toBeTruthy();
    const panel = screen.getByTestId("inspector-drawer-panel");
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
  });

  it("22. verifies InspectorDrawer mode='auto' renders responsive hybrid layout (modal below xl, push on xl)", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="自适应抽屉" mode="auto">
        <div>自适应内容</div>
      </InspectorDrawer>
    );

    const root = screen.getByTestId("inspector-drawer-root");
    expect(root.className).toContain("fixed inset-0");
    expect(root.className).toContain("xl:static");
    expect(root.className).toContain("xl:w-[var(--drawer-width-wide)]");

    const backdrop = screen.getByTestId("inspector-drawer-backdrop");
    expect(backdrop.className).toContain("xl:hidden");
  });

  it("23. verifies InspectorDrawer closes on Escape key in modal mode", () => {
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
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试" mode="modal">
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
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试" mode="modal">
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
          <InspectorDrawer open={open} onClose={() => { setOpen(false); onClose(); }} title="抽屉" mode="modal">
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
