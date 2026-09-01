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
import DashboardPage from "@/app/dashboard/page";
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

  it("22. verifies InspectorDrawer mode='auto' resolves modal below xl and structural push at xl", () => {
    // 1. Below xl: modal behavior (role=dialog, aria-modal=true, backdrop present)
    const { unmount } = render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="自适应抽屉" mode="auto">
        <div>自适应内容</div>
      </InspectorDrawer>
    );

    const modalRoot = screen.getByTestId("inspector-drawer-root");
    expect(modalRoot.className).toContain("fixed inset-0");
    expect(screen.getByTestId("inspector-drawer-backdrop")).toBeTruthy();
    const modalPanel = screen.getByTestId("inspector-drawer-panel");
    expect(modalPanel.getAttribute("role")).toBe("dialog");
    expect(modalPanel.getAttribute("aria-modal")).toBe("true");

    unmount();

    // 2. At xl: structural push behavior (role=region, aria-modal absent, no backdrop, non-fixed)
    document.documentElement.style.setProperty("--breakpoint-xl", "90rem");
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="自适应抽屉" mode="auto">
        <div>自适应内容</div>
      </InspectorDrawer>
    );

    const pushRoot = screen.getByTestId("inspector-drawer-root");
    expect(pushRoot.tagName.toLowerCase()).toBe("aside");
    expect(pushRoot.getAttribute("role")).toBe("region");
    expect(pushRoot.className).not.toContain("fixed inset-0");
    expect(pushRoot.className).toContain("w-[var(--drawer-width-wide)]");
    expect(screen.queryByTestId("inspector-drawer-backdrop")).toBeNull();

    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty("--breakpoint-xl");
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

  it("36. verifies zero react-hooks/rules-of-hooks suppressions exist in layout and page code", () => {
    const filesToCheck = [
      "src/components/layout/AppShell.tsx",
      "src/components/layout/AppHeader.tsx",
      "src/components/layout/AppShellContext.tsx",
      "src/app/dashboard/page.tsx",
    ];
    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
      expect(content).not.toContain("rules-of-hooks");
      expect(content).not.toMatch(/try\s*\{\s*useAppShell\(\)/);
    }
  });

  it("37. verifies AppHeader renders zero-layout-shift skeletons on md and lg when dashboard is loading", () => {
    render(<AppHeader dashboard={null} />);
    const tabletSkeleton = screen.getByTestId("header-tablet-level-skeleton");
    const progressionSkeleton = screen.getByTestId("header-progression-skeleton");

    expect(tabletSkeleton).toBeTruthy();
    expect(tabletSkeleton.className).toContain("hidden md:inline-block lg:hidden");
    expect(progressionSkeleton).toBeTruthy();
    expect(progressionSkeleton.className).toContain("hidden lg:flex");
  });

  it("38. verifies AppSidebar navigation items retain accessible names and titles on tablet icon-only mode", () => {
    render(<AppSidebar collapsed={false} onToggleCollapse={vi.fn()} playerLevel={14} />);
    const questLink = screen.getByTestId("nav-item-quests");
    expect(questLink.getAttribute("aria-label")).toBe("任务志");
    expect(questLink.getAttribute("title")).toBe("任务志");

    const disabledArtifact = screen.getByTestId("nav-item-disabled-产出台");
    expect(disabledArtifact.getAttribute("aria-label")).toBe("产出台，即将开放");
    expect(disabledArtifact.getAttribute("title")).toBe("产出台 (即将开放)");
  });

  it("39. verifies AppHeader progression skeleton reserves the Total XP segment for zero layout shift at xl", () => {
    render(<AppHeader dashboard={null} />);
    const totalXpSkeleton = screen.getByTestId("header-total-xp-skeleton");
    expect(totalXpSkeleton).toBeTruthy();
    expect(totalXpSkeleton.className).toContain("hidden xl:inline-block");
  });

  it("40. verifies no undefined drawer token or raw 45px calculation exists in skills/knowledge pages", () => {
    const skillsContent = fs.readFileSync(path.resolve(process.cwd(), "src/app/skills/page.tsx"), "utf8");
    const knowledgeContent = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");

    expect(skillsContent).not.toContain("--drawer-width-collapsed");
    expect(knowledgeContent).not.toContain("--drawer-width-collapsed");
    expect(skillsContent).not.toContain("45px");
    expect(knowledgeContent).not.toContain("45px");
  });

  it("41. verifies Knowledge truncation banner does NOT consume progression Gold", () => {
    const knowledgeContent = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");
    expect(knowledgeContent).not.toContain("gold-400");
    expect(knowledgeContent).not.toContain("gold-300");
  });

  it("42. verifies AppShellProvider handles initial 500 error and sets dashboardError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    function ErrorConsumer() {
      const { dashboardError, dashboardLoading } = useAppShell();
      if (dashboardLoading) return <div>loading</div>;
      return <div data-testid="error-result">{dashboardError}</div>;
    }

    render(
      <AppShellProvider>
        <ErrorConsumer />
      </AppShellProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId("error-result").textContent).toContain("Failed to load dashboard: 500");
  });

  it("43. verifies no raw '90rem' or '1440px' exists in InspectorDrawer.tsx", () => {
    const drawerPath = path.resolve(process.cwd(), "src/components/layout/InspectorDrawer.tsx");
    const content = fs.readFileSync(drawerPath, "utf8");
    expect(content).not.toContain("90rem");
    expect(content).not.toContain("1440px");
  });

  it("44. verifies InspectorDrawer auto mode preserves child local state across responsive transitions without subtree remount", () => {
    document.documentElement.style.setProperty("--breakpoint-xl", "90rem");
    let changeListener: (() => void) | null = null;
    let isMatches = false;

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      get matches() {
        return isMatches;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === "change") changeListener = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function StatefulChild() {
      const [text, setText] = React.useState("初始输入值");
      return (
        <div>
          <input
            data-testid="child-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      );
    }

    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="自适应" mode="auto">
        <StatefulChild />
      </InspectorDrawer>
    );

    const input = screen.getByTestId("child-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "修改后的持久输入值" } });
    expect(input.value).toBe("修改后的持久输入值");

    // Transition from below-xl (< 1440px) to xl (>= 1440px)
    act(() => {
      isMatches = true;
      if (changeListener) changeListener();
    });

    const inputAfterTransition = screen.getByTestId("child-input") as HTMLInputElement;
    expect(inputAfterTransition.value).toBe("修改后的持久输入值");

    // Transition back from xl to below-xl
    act(() => {
      isMatches = false;
      if (changeListener) changeListener();
    });

    const inputAfterSecondTransition = screen.getByTestId("child-input") as HTMLInputElement;
    expect(inputAfterSecondTransition.value).toBe("修改后的持久输入值");

    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty("--breakpoint-xl");
  });

  it("45. verifies shared slot geometry contracts guarantee identical width/height between skeleton and loaded header states", () => {
    // 1. Loading State
    const { unmount } = render(<AppHeader dashboard={null} />);
    const tabletSkeleton = screen.getByTestId("header-tablet-level-skeleton");
    const progressionSkeleton = screen.getByTestId("header-progression-skeleton");
    const totalXpSkeleton = screen.getByTestId("header-total-xp-skeleton");

    expect(tabletSkeleton.className).toContain("w-11 h-5");
    expect(progressionSkeleton.className).toContain("gap-2.5 px-3 py-1.5");
    expect(totalXpSkeleton.className).toContain("w-16 h-4");

    unmount();

    // 2. Loaded State
    render(
      <AppHeader
        dashboard={{
          player: { playerLevel: 14, totalXp: 1250, unallocatedSkillPoints: 0 },
          levelProgress: { currentLevel: 14, xpIntoLevel: 250, xpNeededForNext: 500, progress: 0.5 },
          activeQuests: [],
          skillsSummary: [],
          recentActivities: [],
          pendingAssessments: [],
          streak: { currentStreak: 1, bestStreak: 1, lastActivityDate: null },
        } as unknown as DashboardSnapshot}
      />
    );

    const loadedTabletBadge = screen.getByTestId("header-tablet-level-badge");
    const loadedProgressionCapsule = screen.getByTestId("header-progression-capsule");
    const loadedPlayerLevel = screen.getByTestId("header-player-level");
    const loadedTotalXp = screen.getByTestId("header-total-xp");

    expect(loadedTabletBadge.className).toContain("w-11 h-5");
    expect(loadedPlayerLevel.className).toContain("w-11 h-5");
    expect(loadedProgressionCapsule.className).toContain("gap-2.5 px-3 py-1.5");
    expect(loadedTotalXp.className).toContain("w-16 h-4");
  });

  it("46. verifies large Player Level and large Total XP maintain shared slot geometry with truncation", () => {
    render(
      <AppHeader
        dashboard={{
          player: { playerLevel: 9999, totalXp: 1000000, unallocatedSkillPoints: 0 },
          levelProgress: { currentLevel: 9999, xpIntoLevel: 0, xpNeededForNext: 1000, progress: 0 },
          activeQuests: [],
          skillsSummary: [],
          recentActivities: [],
          pendingAssessments: [],
          streak: { currentStreak: 1, bestStreak: 1, lastActivityDate: null },
        } as unknown as DashboardSnapshot}
      />
    );

    const loadedTabletBadge = screen.getByTestId("header-tablet-level-badge");
    const loadedPlayerLevel = screen.getByTestId("header-player-level");
    const loadedTotalXp = screen.getByTestId("header-total-xp");

    expect(loadedTabletBadge.className).toContain("w-11 h-5");
    expect(loadedTabletBadge.className).toContain("truncate");
    expect(loadedPlayerLevel.className).toContain("w-11 h-5");
    expect(loadedPlayerLevel.className).toContain("truncate");
    expect(loadedTotalXp.className).toContain("w-16 h-4");
    expect(loadedTotalXp.className).toContain("truncate");
  });

  it("47. verifies DashboardPage redirects to /login on unauthenticated error state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    render(
      <AppShellProvider>
        <DashboardPage />
      </AppShellProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockRouterPush).toHaveBeenCalledWith("/login");
  });

  it("48. verifies auto drawer direct open at xl does NOT steal focus from active opener", () => {
    document.documentElement.style.setProperty("--breakpoint-xl", "90rem");
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function TestDirectXl() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="xl-opener" onClick={() => setOpen(true)}>
            打开
          </button>
          <InspectorDrawer open={open} onClose={() => setOpen(false)} mode="auto">
            <button data-testid="drawer-inner-btn">内部按钮</button>
          </InspectorDrawer>
        </div>
      );
    }

    render(<TestDirectXl />);
    const opener = screen.getByTestId("xl-opener");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);

    // In push mode at xl, focus remains on opener and is NOT stolen into drawer
    expect(document.activeElement).toBe(opener);

    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty("--breakpoint-xl");
  });

  it("49. verifies transition from push (xl) to modal (below xl) moves outside focus into the active modal", async () => {
    document.documentElement.style.setProperty("--breakpoint-xl", "90rem");
    let isMatches = true;
    let changeListener: (() => void) | null = null;

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      get matches() {
        return isMatches;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === "change") changeListener = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function TestPushToModal() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="push-opener" onClick={() => setOpen(true)}>
            打开抽屉
          </button>
          <button data-testid="outside-workspace-btn">工作区其他按钮</button>
          <InspectorDrawer open={open} onClose={() => setOpen(false)} mode="auto">
            <button data-testid="drawer-target-btn">抽屉按钮</button>
          </InspectorDrawer>
        </div>
      );
    }

    render(<TestPushToModal />);
    const opener = screen.getByTestId("push-opener");
    opener.focus();
    fireEvent.click(opener);

    // In push mode, user focuses an outside workspace button
    const outsideBtn = screen.getByTestId("outside-workspace-btn");
    outsideBtn.focus();
    expect(document.activeElement).toBe(outsideBtn);

    // Viewport shrinks below xl -> drawer transitions from push to modal
    act(() => {
      isMatches = false;
      if (changeListener) changeListener();
    });

    // Wait for focus containment RAF to execute
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const drawerClose = screen.getByTestId("inspector-drawer-close");
    const drawerTarget = screen.getByTestId("drawer-target-btn");
    const isInsideDrawer = document.activeElement === drawerClose || document.activeElement === drawerTarget;
    expect(isInsideDrawer).toBe(true);

    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty("--breakpoint-xl");
  });

  it("50. verifies unmounting InspectorDrawer while open restores focus to connected opener", () => {
    function TestUnmountWhileOpen() {
      const [mounted, setMounted] = React.useState(false);
      return (
        <div>
          <button data-testid="unmount-opener" onClick={() => setMounted(true)}>
            挂载并打开
          </button>
          {mounted && (
            <InspectorDrawer open={true} onClose={() => setMounted(false)} mode="modal">
              <button onClick={() => setMounted(false)} data-testid="dismiss-unmount">
                销毁抽屉
              </button>
            </InspectorDrawer>
          )}
        </div>
      );
    }

    render(<TestUnmountWhileOpen />);
    const opener = screen.getByTestId("unmount-opener");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    expect(screen.getByTestId("dismiss-unmount")).toBeTruthy();

    const dismissBtn = screen.getByTestId("dismiss-unmount");
    fireEvent.click(dismissBtn);

    expect(document.activeElement).toBe(opener);
  });

  it("51. verifies AppShellProvider + DashboardPage executes exactly ONE initial /api/dashboard request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        dashboard: {
          player: { playerLevel: 10, totalXp: 1000, energy: 100, focus: 100, momentum: 1 },
          levelProgress: { xpIntoLevel: 100, xpNeededForNext: 400, progress: 0.25 },
          skills: [],
          quests: [],
          activeQuests: [],
          mainQuest: null,
          recentGrowth: [],
          activities: [],
          pendingAssessments: [],
          pendingMasteryVerifications: [],
        },
      }),
    } as Response);

    render(
      <AppShellProvider>
        <DashboardPage />
      </AppShellProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const dashboardCalls = fetchSpy.mock.calls.filter((call) => call[0] === "/api/dashboard");
    expect(dashboardCalls.length).toBe(1);
    expect(screen.getByText("XP Lv.10")).toBeTruthy();
    expect(screen.getByText("1000 XP total")).toBeTruthy();
  });

  it("52. verifies initial 500 error renders ErrorState and retry recovers dashboard state", async () => {
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/dashboard") {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500 } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dashboard: {
              player: { playerLevel: 12, totalXp: 1500, energy: 100, focus: 100, momentum: 1 },
              levelProgress: { xpIntoLevel: 200, xpNeededForNext: 600, progress: 0.33 },
              skills: [],
              quests: [],
              activeQuests: [],
              mainQuest: null,
              recentGrowth: [],
              activities: [],
              pendingAssessments: [],
              pendingMasteryVerifications: [],
            },
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(
      <AppShellProvider>
        <DashboardPage />
      </AppShellProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    expect(retryBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(retryBtn);
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByText("XP Lv.12")).toBeTruthy();
    expect(screen.getByText("1500 XP total")).toBeTruthy();
  });

  it("53. verifies network rejection renders ErrorState and retry recovers", async () => {
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/dashboard") {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network offline failure");
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dashboard: {
              player: { playerLevel: 15, totalXp: 2000, energy: 100, focus: 100, momentum: 1 },
              levelProgress: { xpIntoLevel: 300, xpNeededForNext: 800, progress: 0.375 },
              skills: [],
              quests: [],
              activeQuests: [],
              mainQuest: null,
              recentGrowth: [],
              activities: [],
              pendingAssessments: [],
              pendingMasteryVerifications: [],
            },
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(
      <AppShellProvider>
        <DashboardPage />
      </AppShellProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByText("Network offline failure")).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: /Retry/i });

    await act(async () => {
      fireEvent.click(retryBtn);
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByText("XP Lv.15")).toBeTruthy();
    expect(screen.getByText("2000 XP total")).toBeTruthy();
  });

  it("54. verifies responsive transition (xl -> below-xl) followed by drawer close restores focus to ORIGINAL opener", async () => {
    document.documentElement.style.setProperty("--breakpoint-xl", "90rem");
    let isMatches = true;
    let changeListener: (() => void) | null = null;

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      get matches() {
        return isMatches;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === "change") changeListener = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function TestFullCycle() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="lifecycle-opener" onClick={() => setOpen(true)}>
            打开抽屉
          </button>
          <button data-testid="outside-ctrl">外部控件</button>
          <InspectorDrawer open={open} onClose={() => setOpen(false)} mode="auto">
            <button data-testid="drawer-inside-btn">抽屉内控件</button>
          </InspectorDrawer>
        </div>
      );
    }

    render(<TestFullCycle />);
    const opener = screen.getByTestId("lifecycle-opener");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    // 1. Open auto drawer at xl (push mode)
    fireEvent.click(opener);
    expect(document.activeElement).toBe(opener);

    // 2. Focus outside workspace control
    const outsideCtrl = screen.getByTestId("outside-ctrl");
    outsideCtrl.focus();
    expect(document.activeElement).toBe(outsideCtrl);

    // 3. Viewport transitions xl -> below-xl (becomes modal)
    act(() => {
      isMatches = false;
      if (changeListener) changeListener();
    });

    // Modal focus containment moves focus inside the drawer
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const drawerClose = screen.getByTestId("inspector-drawer-close");
    const drawerInside = screen.getByTestId("drawer-inside-btn");
    const isInside = document.activeElement === drawerClose || document.activeElement === drawerInside;
    expect(isInside).toBe(true);

    // 4. Close drawer
    fireEvent.click(drawerClose);

    // 5. Verify focus returns to the ORIGINAL opener
    expect(document.activeElement).toBe(opener);

    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty("--breakpoint-xl");
  });

  it("55. verifies auto drawer at xl preserves normal Tab order and does not trap focus", () => {
    document.documentElement.style.setProperty("--breakpoint-xl", "90rem");
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function TestXlTabOrder() {
      const [open, setOpen] = React.useState(true);
      return (
        <div>
          <InspectorDrawer open={open} onClose={() => setOpen(false)} mode="auto">
            <button data-testid="inside-first">内部第一按钮</button>
            <button data-testid="inside-last">内部最后按钮</button>
          </InspectorDrawer>
          <button data-testid="outside-tab-target">外部下一个焦点目标</button>
        </div>
      );
    }

    render(<TestXlTabOrder />);
    const insideLast = screen.getByTestId("inside-last");
    insideLast.focus();
    expect(document.activeElement).toBe(insideLast);

    // Dispatch Tab keydown event on the last focusable element in push drawer
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    // In structural push mode, event is NOT preventDefaulted (not trapped)
    expect(event.defaultPrevented).toBe(false);

    // Focus can freely advance to outside target in normal document flow
    const outsideTarget = screen.getByTestId("outside-tab-target");
    outsideTarget.focus();
    expect(document.activeElement).toBe(outsideTarget);

    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty("--breakpoint-xl");
  });

  it("56. verifies switching to xl before pending modal-focus RAF executes does NOT steal focus into push drawer", () => {
    document.documentElement.style.setProperty("--breakpoint-xl", "90rem");
    let isMatches = false;
    let changeListener: (() => void) | null = null;

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      get matches() {
        return isMatches;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === "change") changeListener = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    let scheduledRafCallback: FrameRequestCallback | null = null;
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = vi.fn().mockImplementation((cb: FrameRequestCallback) => {
      scheduledRafCallback = cb;
      return 999;
    });
    window.cancelAnimationFrame = vi.fn().mockImplementation(() => {
      scheduledRafCallback = null;
    });

    function TestStaleRaf() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="stale-opener" onClick={() => setOpen(true)}>
            打开抽屉
          </button>
          <InspectorDrawer open={open} onClose={() => setOpen(false)} mode="auto">
            <button data-testid="stale-inside-btn">抽屉按钮</button>
          </InspectorDrawer>
        </div>
      );
    }

    render(<TestStaleRaf />);
    const opener = screen.getByTestId("stale-opener");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    // 1. Open drawer below xl (modal mode) -> schedules RAF
    fireEvent.click(opener);
    expect(scheduledRafCallback).not.toBeNull();

    // 2. Viewport switches to xl (push mode) before RAF is flushed
    act(() => {
      isMatches = true;
      if (changeListener) changeListener();
    });

    // 3. Execute the stale callback if any remained
    if (scheduledRafCallback) {
      act(() => {
        (scheduledRafCallback as FrameRequestCallback)(performance.now());
      });
    }

    // 4. Focus remains on opener and is NOT stolen
    expect(document.activeElement).toBe(opener);

    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty("--breakpoint-xl");
  });

  it("57. verifies Quick Log submission invokes POST /api/activities -> assess -> refreshDashboard and synchronizes AppHeader and DashboardPage", async () => {
    let dashboardCallCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      const urlStr = String(url);
      if (urlStr === "/api/dashboard") {
        dashboardCallCount++;
        if (dashboardCallCount === 1) {
          // Initial snapshot: Level 10, XP 1000, 0 pending
          return {
            ok: true,
            status: 200,
            json: async () => ({
              dashboard: {
                player: { playerLevel: 10, totalXp: 1000, energy: 100, focus: 100, momentum: 1 },
                levelProgress: { xpIntoLevel: 100, xpNeededForNext: 400, progress: 0.25 },
                skills: [],
                quests: [],
                activeQuests: [],
                mainQuest: null,
                recentGrowth: [],
                activities: [],
                pendingAssessments: [],
                pendingMasteryVerifications: [],
              },
            }),
          } as Response;
        }
        // Refreshed snapshot after quick log & assessment: Level 11, XP 1250, 1 pending
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dashboard: {
              player: { playerLevel: 11, totalXp: 1250, energy: 90, focus: 85, momentum: 2 },
              levelProgress: { xpIntoLevel: 250, xpNeededForNext: 500, progress: 0.5 },
              skills: [],
              quests: [],
              activeQuests: [],
              mainQuest: null,
              recentGrowth: [],
              activities: [
                {
                  id: "act-101",
                  userId: "u-1",
                  rawInput: "今天学习了 Rust 并写了测试",
                  activityType: "coding",
                  createdAt: new Date().toISOString(),
                },
              ],
              pendingAssessments: [
                {
                  id: "ass-201",
                  activityId: "act-101",
                  userId: "u-1",
                  proposal: {
                    activity: { type: "coding" },
                    evidence: { level: 2, explanation: "编写了并通过了单元测试" },
                    affected_skills: [{ name: "Rust", reason: "学习核心语法" }],
                    mastery_changes: [{ from_level: 0, proposed_level: 1, reason: "初次掌握基础" }],
                    xp_semantics: { base_value: 50, difficulty: 0.5, novelty: 0.8, repetition_risk: "low" },
                    uncertainty_notes: [],
                  },
                  modelName: "test-model",
                  promptVersion: "1.0",
                  rulesVersion: "1.0",
                  confidence: 0.95,
                  createdAt: new Date().toISOString(),
                  confirmedAt: null,
                },
              ],
              pendingMasteryVerifications: [],
            },
          }),
        } as Response;
      }

      if (urlStr === "/api/activities" && options?.method === "POST") {
        const body = JSON.parse(String(options?.body));
        return {
          ok: true,
          status: 201,
          json: async () => ({
            activity: {
              id: "act-101",
              userId: "u-1",
              rawInput: body.rawInput,
              activityType: "coding",
              createdAt: new Date().toISOString(),
            },
          }),
        } as Response;
      }

      if (urlStr === "/api/activities/act-101/assess" && options?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            assessment: {
              id: "ass-201",
              activityId: "act-101",
            },
          }),
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(
      <AppShellProvider>
        <AppHeader onLogout={vi.fn()} />
        <DashboardPage />
      </AppShellProvider>
    );

    // Initial load hydration
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // 1. Initial State assertions
    expect(screen.getByText("XP Lv.10")).toBeTruthy();
    expect(screen.getByText("1000 XP total")).toBeTruthy();
    expect(screen.getByTestId("header-player-level").textContent).toBe("LV.10");
    expect(screen.queryByTestId("pending-assessment-indicator")).toBeNull();

    // 2. Submit Quick Log
    const input = screen.getByPlaceholderText(/例如：今天读了 1.5 小时 LC 方法/);
    fireEvent.change(input, { target: { value: "今天学习了 Rust 并写了测试" } });
    const submitBtn = screen.getByRole("button", { name: /记录并评估/ });

    await act(async () => {
      fireEvent.click(submitBtn);
      await new Promise((r) => setTimeout(r, 50));
    });

    // 3. Refreshed State assertions on both DashboardPage and AppHeader
    expect(screen.getByText("XP Lv.11")).toBeTruthy();
    expect(screen.getByText("1250 XP total")).toBeTruthy();
    expect(screen.getByTestId("header-player-level").textContent).toBe("LV.11");
    expect(screen.getByTestId("pending-assessment-indicator")).toBeTruthy();
    expect(screen.getByTestId("pending-assessment-indicator").textContent).toContain("1 待确认评估");
    expect(screen.getByText("待确认的 AI 评估")).toBeTruthy();
  });

  it("58. verifies Assessment Confirm invokes POST /api/assessments/:id/confirm -> refreshDashboard and synchronizes AppHeader and DashboardPage", async () => {
    let dashboardCallCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      const urlStr = String(url);
      if (urlStr === "/api/dashboard") {
        dashboardCallCount++;
        if (dashboardCallCount === 1) {
          // Initial snapshot with 1 pending assessment, Level 11, XP 1250
          return {
            ok: true,
            status: 200,
            json: async () => ({
              dashboard: {
                player: { playerLevel: 11, totalXp: 1250, energy: 90, focus: 85, momentum: 2 },
                levelProgress: { xpIntoLevel: 250, xpNeededForNext: 500, progress: 0.5 },
                skills: [],
                quests: [],
                activeQuests: [],
                mainQuest: null,
                recentGrowth: [],
                activities: [],
                pendingAssessments: [
                  {
                    id: "ass-301",
                    activityId: "act-301",
                    userId: "u-1",
                    proposal: {
                      activity: { type: "coding" },
                      evidence: { level: 2, explanation: "通过所有测试" },
                      affected_skills: [{ name: "TypeScript", reason: "类型重构" }],
                      mastery_changes: [{ from_level: 1, proposed_level: 2, reason: "进阶掌握" }],
                      xp_semantics: { base_value: 100, difficulty: 0.6, novelty: 0.7, repetition_risk: "low" },
                      uncertainty_notes: [],
                    },
                    modelName: "test-model",
                    promptVersion: "1.0",
                    rulesVersion: "1.0",
                    confidence: 0.98,
                    createdAt: new Date().toISOString(),
                    confirmedAt: null,
                  },
                ],
                pendingMasteryVerifications: [],
              },
            }),
          } as Response;
        }
        // Refreshed snapshot after confirm: Level 12, XP 1600, 0 pending
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dashboard: {
              player: { playerLevel: 12, totalXp: 1600, energy: 95, focus: 90, momentum: 3 },
              levelProgress: { xpIntoLevel: 100, xpNeededForNext: 600, progress: 0.166 },
              skills: [],
              quests: [],
              activeQuests: [],
              mainQuest: null,
              recentGrowth: [],
              activities: [],
              pendingAssessments: [],
              pendingMasteryVerifications: [],
            },
          }),
        } as Response;
      }

      if (urlStr === "/api/assessments/ass-301/confirm" && options?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(
      <AppShellProvider>
        <AppHeader onLogout={vi.fn()} />
        <DashboardPage />
      </AppShellProvider>
    );

    // Initial load hydration
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // 1. Initial State assertions
    expect(screen.getByText("XP Lv.11")).toBeTruthy();
    expect(screen.getByText("1250 XP total")).toBeTruthy();
    expect(screen.getByTestId("header-player-level").textContent).toBe("LV.11");
    expect(screen.getByTestId("pending-assessment-indicator")).toBeTruthy();
    expect(screen.getByTestId("pending-assessment-indicator").textContent).toContain("1 待确认评估");

    // 2. Click confirm button
    const confirmBtn = screen.getByRole("button", { name: /确认并结算/ });
    expect(confirmBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(confirmBtn);
      await new Promise((r) => setTimeout(r, 50));
    });

    // 3. Refreshed State assertions
    expect(screen.getByText("XP Lv.12")).toBeTruthy();
    expect(screen.getByText("1600 XP total")).toBeTruthy();
    expect(screen.getByTestId("header-player-level").textContent).toBe("LV.12");
    expect(screen.queryByTestId("pending-assessment-indicator")).toBeNull();
  });
});
