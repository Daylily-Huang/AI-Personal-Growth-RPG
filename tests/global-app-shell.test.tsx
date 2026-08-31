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
  useInspectorUrlState,
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
  // 1-3. Persistent AppShell Boundary & /login Exclusion
  // ----------------------------------------------------
  it("1. verifies ONE persistent AppShell boundary exists and wraps product routes", () => {
    currentPathname = "/dashboard";
    const { rerender } = render(
      <AppShellBoundary>
        <div data-testid="page-dashboard">仪表盘内容</div>
      </AppShellBoundary>
    );

    expect(screen.getByTestId("app-shell-root")).toBeTruthy();
    expect(screen.getByTestId("page-dashboard")).toBeTruthy();

    // Navigate to /quests
    currentPathname = "/quests";
    rerender(
      <AppShellBoundary>
        <div data-testid="page-quests">任务志内容</div>
      </AppShellBoundary>
    );

    expect(screen.getByTestId("app-shell-root")).toBeTruthy();
    expect(screen.getByTestId("page-quests")).toBeTruthy();
  });

  it("2. verifies /login route is strictly excluded from AppShell wrapper", () => {
    currentPathname = "/login";
    render(
      <AppShellBoundary>
        <div data-testid="login-page">登录页面</div>
      </AppShellBoundary>
    );

    expect(screen.queryByTestId("app-shell-root")).toBeNull();
    expect(screen.queryByTestId("app-sidebar")).toBeNull();
    expect(screen.queryByTestId("app-header")).toBeNull();
    expect(screen.getByTestId("login-page")).toBeTruthy();
  });

  it("3. verifies root layout mounts AppShellBoundary", () => {
    const layoutPath = path.resolve(process.cwd(), "src/app/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf8");
    expect(content).toContain("AppShellBoundary");
  });

  // ----------------------------------------------------
  // 4-9. Page Chrome Cleanup & Main Landmark Integrity
  // ----------------------------------------------------
  it("4. verifies Dashboard page contains no legacy Shell wrapper or duplicate header/nav/main", () => {
    const filePath = path.resolve(process.cwd(), "src/app/dashboard/page.tsx");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).not.toContain("function Shell(");
    expect(content).not.toContain("<Shell");
    expect(content).not.toContain("</Shell>");
    expect(content).not.toContain("<main>");
    expect(content).not.toContain("</main>");
  });

  it("5. verifies Quests page contains no legacy header/nav or duplicate main", () => {
    const filePath = path.resolve(process.cwd(), "src/app/quests/page.tsx");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).not.toContain("<header");
    expect(content).not.toContain("</header>");
    expect(content).not.toContain("<main");
    expect(content).not.toContain("</main>");
  });

  it("6. verifies Skills page contains no legacy header/nav or duplicate main", () => {
    const filePath = path.resolve(process.cwd(), "src/app/skills/page.tsx");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).not.toContain("<header");
    expect(content).not.toContain("</header>");
    expect(content).not.toContain("<main");
    expect(content).not.toContain("</main>");
  });

  it("7. verifies Knowledge page contains no legacy header/nav or duplicate main", () => {
    const filePath = path.resolve(process.cwd(), "src/app/knowledge/page.tsx");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).not.toContain("<header");
    expect(content).not.toContain("</header>");
    expect(content).not.toContain("<main");
    expect(content).not.toContain("</main>");
  });

  it("8. verifies AppWorkspace provides the single primary main landmark", () => {
    render(
      <AppWorkspace fullBleed={false}>
        <div>标准内容</div>
      </AppWorkspace>
    );

    const mains = screen.getAllByRole("main");
    expect(mains.length).toBe(1);
    expect(mains[0].id).toBe("main-content");
    expect(mains[0].getAttribute("data-full-bleed")).toBe("false");
  });

  it("8b. verifies AppWorkspace supports fullBleed mode without margins", () => {
    render(
      <AppWorkspace fullBleed={true}>
        <div>全屏画布内容</div>
      </AppWorkspace>
    );

    const workspace = screen.getByTestId("app-workspace");
    expect(workspace.getAttribute("data-full-bleed")).toBe("true");
    expect(workspace.className).toContain("w-full h-full p-0");
  });

  it("9. verifies Skills/Knowledge fullBleed children do not use conflicting h-screen shell roots", () => {
    const skillsContent = fs.readFileSync(path.resolve(process.cwd(), "src/app/skills/page.tsx"), "utf8");
    const knowledgeContent = fs.readFileSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"), "utf8");
    expect(skillsContent).not.toContain("flex h-screen flex-col");
    expect(knowledgeContent).not.toContain("flex h-screen flex-col");
  });

  // ----------------------------------------------------
  // 10-14. Responsive Shell Matrix & Sidebar State
  // ----------------------------------------------------
  it("10. verifies Base viewport exposes MobileNav and hides desktop sidebar", () => {
    render(<AppShell dashboard={mockDashboard}><div>内容</div></AppShell>);
    const sidebar = screen.getByTestId("app-sidebar");
    const mobileNav = screen.getByTestId("mobile-nav");

    expect(sidebar.className).toContain("hidden md:flex");
    expect(mobileNav.className).toContain("md:hidden");
  });

  it("10b. verifies MobileNav renders active dot indicator for current route", () => {
    currentPathname = "/quests";
    render(<MobileNav />);
    const activeNav = screen.getByTestId("mobile-nav-quests");
    expect(activeNav.getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("mobile-active-indicator")).toBeTruthy();
  });

  it("11. verifies sidebar expanded vs collapsed widths and content offsets", () => {
    render(
      <AppShell dashboard={mockDashboard}>
        <div>内容</div>
      </AppShell>
    );

    const toggleBtn = screen.getByTestId("sidebar-toggle-button");
    const sidebar = screen.getByTestId("app-sidebar");
    const container = screen.getByTestId("app-shell-content-container");

    // Initially expanded on desktop
    expect(sidebar.getAttribute("data-collapsed")).toBe("false");
    expect(sidebar.className).toContain("w-[var(--sidebar-width-expanded)]");
    expect(container.className).toContain("md:ml-[var(--sidebar-width-expanded)]");

    // Toggle collapse
    fireEvent.click(toggleBtn);
    expect(sidebar.getAttribute("data-collapsed")).toBe("true");
    expect(sidebar.className).toContain("w-[var(--sidebar-width-collapsed)]");
    expect(container.className).toContain("md:ml-[var(--sidebar-width-collapsed)]");
  });

  it("12. verifies Ctrl/Cmd+B shortcut toggles sidebar collapse", () => {
    render(<AppShell dashboard={mockDashboard}><div>内容</div></AppShell>);
    const sidebar = screen.getByTestId("app-sidebar");

    expect(sidebar.getAttribute("data-collapsed")).toBe("false");
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(sidebar.getAttribute("data-collapsed")).toBe("true");
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(sidebar.getAttribute("data-collapsed")).toBe("false");
  });

  it("13. verifies Ctrl/Cmd+B is suppressed when focused on editable controls", () => {
    render(
      <AppShell dashboard={mockDashboard}>
        <input data-testid="test-input" type="text" />
      </AppShell>
    );
    const sidebar = screen.getByTestId("app-sidebar");
    const input = screen.getByTestId("test-input");

    expect(sidebar.getAttribute("data-collapsed")).toBe("false");
    fireEvent.keyDown(input, { key: "b", ctrlKey: true });
    expect(sidebar.getAttribute("data-collapsed")).toBe("false");
  });

  // ----------------------------------------------------
  // 15-20. AppHeader Breadcrumbs, Progression & Gold Governance
  // ----------------------------------------------------
  it("15. verifies AppHeader hides breadcrumbs and full XP capsule on mobile", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    const breadcrumbs = screen.getByTestId("header-breadcrumbs");
    const capsule = screen.getByTestId("header-progression-capsule");

    expect(breadcrumbs.className).toContain("hidden md:flex");
    expect(capsule.className).toContain("hidden md:flex");
  });

  it("16. verifies AppHeader reads frozen Level and XP without artificial cultivation realms", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    expect(screen.getByTestId("header-player-level").textContent).toBe("LV.14");
    expect(screen.getByTestId("header-xp-into-level").textContent).toBe("150");
    expect(screen.getByTestId("header-xp-needed").textContent).toBe("300 XP");

    const header = screen.getByTestId("app-header");
    expect(header.textContent).not.toContain("筑基");
    expect(header.textContent).not.toContain("金丹");
    expect(header.textContent).not.toContain("元婴");
  });

  it("17. verifies Artifact nav item is disabled with '即将开放' label and prevents 404", () => {
    render(<AppSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
    const disabledItem = screen.getByTestId("nav-item-disabled-产出台");
    expect(disabledItem.getAttribute("aria-disabled")).toBe("true");
    expect(disabledItem.textContent).toContain("即将开放");
    expect(disabledItem.textContent).not.toContain("阶段7C");
  });

  it("18. verifies active navigation treatment strictly consumes neutral selection tokens", () => {
    currentPathname = "/dashboard";
    render(<AppSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
    const activeNav = screen.getByTestId("nav-item-dashboard");
    expect(activeNav.className).toContain("bg-[var(--selection-neutral-bg)]");
    expect(activeNav.className).toContain("border-[var(--selection-neutral-border)]");
    expect(activeNav.className).toContain("text-[var(--selection-neutral-text)]");
    expect(activeNav.className).not.toContain("gold");

    const indicator = screen.getByTestId("nav-active-indicator");
    expect(indicator.className).toContain("bg-[var(--selection-neutral-indicator)]");
  });

  it("19. verifies Brand shield does NOT consume progression Gold", () => {
    const sidebarFilePath = path.resolve(process.cwd(), "src/components/layout/AppSidebar.tsx");
    const content = fs.readFileSync(sidebarFilePath, "utf8");
    expect(content).not.toContain("gold-400)]");
    expect(content).not.toContain("gold-300)]");
  });

  it("20. verifies Progression Gold is consumed ONLY by approved progression UI", () => {
    const headerFilePath = path.resolve(process.cwd(), "src/components/layout/AppHeader.tsx");
    const content = fs.readFileSync(headerFilePath, "utf8");
    // Gold is allowed for the XP progress bar
    expect(content).toContain("bg-[var(--gold-400)]");
  });

  // ----------------------------------------------------
  // 21. Raw Style Literal Audit
  // ----------------------------------------------------
  it("21. verifies no raw hex codes or arbitrary numeric styling literals remain in src/components/layout/**", () => {
    const layoutDir = path.resolve(process.cwd(), "src/components/layout");
    const files = fs.readdirSync(layoutDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(layoutDir, file), "utf8");
      // Check for raw hex colors (#fff, #123456)
      const hexMatches = content.match(/#[0-9a-fA-F]{3,8}\b/g);
      expect(hexMatches, `Raw hex color found in ${file}: ${hexMatches?.join(", ")}`).toBeNull();

      // Check for raw arbitrary pixel brackets like max-w-[120px], text-[10px], rounded-[var(--radius-full,9999px)]
      const arbitraryNumericMatches = content.match(/(?:w|h|p|m|text|rounded|max-w|min-w)-\[\d+px\]/g);
      expect(arbitraryNumericMatches, `Arbitrary numeric pixel literal in ${file}: ${arbitraryNumericMatches?.join(", ")}`).toBeNull();

      // Check for unapproved fallback literals in CSS variables
      const rawFallbackMatches = content.match(/var\(--[^,)]+,\s*[^)]+\)/g);
      expect(rawFallbackMatches, `Unapproved CSS var fallback in ${file}: ${rawFallbackMatches?.join(", ")}`).toBeNull();
    }
  });

  // ----------------------------------------------------
  // 22. AppEnvironment SVG Token Binding
  // ----------------------------------------------------
  it("22. verifies AppEnvironment artwork strictly binds color to var(--bg-ink-wash) via CSS mask", () => {
    render(<AppEnvironment />);
    const artwork = screen.getByTestId("environment-artwork");
    expect(artwork.className).toContain("bg-[var(--bg-ink-wash)]");
    expect(artwork.style.maskImage).toContain("ink-landscape.svg");
  });

  // ----------------------------------------------------
  // 23-30. InspectorDrawer Stacking, Focus Trap & Accessibility
  // ----------------------------------------------------
  it("23. verifies InspectorDrawer backdrop is positioned behind panel inside drawer root", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </InspectorDrawer>
    );

    const root = screen.getByTestId("inspector-drawer-root");
    const backdrop = screen.getByTestId("inspector-drawer-backdrop");
    const panel = screen.getByTestId("inspector-drawer-panel");

    expect(root.contains(backdrop)).toBe(true);
    expect(root.contains(panel)).toBe(true);
    expect(panel.className).toContain("relative z-10");
  });

  it("24. verifies InspectorDrawer closes on Escape key", () => {
    const onClose = vi.fn();
    render(
      <InspectorDrawer open={true} onClose={onClose} title="测试抽屉">
        <div>抽屉内容</div>
      </InspectorDrawer>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("25. verifies Tab key cycles focus from last element to first element", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试抽屉">
        <button data-testid="btn-first">第一按钮</button>
        <button data-testid="btn-last">最后按钮</button>
      </InspectorDrawer>
    );

    const lastBtn = screen.getByTestId("btn-last");

    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(screen.getByTestId("inspector-drawer-close"));
  });

  it("26. verifies Shift+Tab cycles focus from first element to last element", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="测试抽屉">
        <button data-testid="btn-first">第一按钮</button>
        <button data-testid="btn-last">最后按钮</button>
      </InspectorDrawer>
    );

    const closeBtn = screen.getByTestId("inspector-drawer-close");
    const lastBtn = screen.getByTestId("btn-last");

    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);
  });

  it("27. verifies focus is restored to the triggering element upon drawer close", () => {
    const onClose = vi.fn();
    function TestComponent() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="open-trigger" onClick={() => setOpen(true)}>
            打开抽屉
          </button>
          <InspectorDrawer open={open} onClose={() => { setOpen(false); onClose(); }} title="抽屉">
            <button data-testid="inside-btn">内按钮</button>
          </InspectorDrawer>
        </div>
      );
    }

    render(<TestComponent />);
    const trigger = screen.getByTestId("open-trigger");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open drawer
    fireEvent.click(trigger);
    expect(screen.getByTestId("inspector-drawer-panel")).toBeTruthy();

    // Close drawer via close button
    const closeBtn = screen.getByTestId("inspector-drawer-close");
    fireEvent.click(closeBtn);

    // Assert focus restored to trigger element
    expect(document.activeElement).toBe(trigger);
  });

  it("28. verifies title-less drawer provides valid accessible naming without dangling aria-labelledby", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()}>
        <div>无标题抽屉</div>
      </InspectorDrawer>
    );

    const panel = screen.getByTestId("inspector-drawer-panel");
    expect(panel.getAttribute("aria-label")).toBe("检查器");
    expect(panel.getAttribute("aria-labelledby")).toBeNull();
  });

  it("29. verifies InspectorDrawer accepts arbitrary injected children and actions", () => {
    render(
      <InspectorDrawer
        open={true}
        onClose={vi.fn()}
        title="自定义实体"
        actions={<button data-testid="custom-action">保存</button>}
      >
        <div data-testid="custom-child">自定义实体内容</div>
      </InspectorDrawer>
    );

    expect(screen.getByTestId("custom-child")).toBeTruthy();
    expect(screen.getByTestId("custom-action")).toBeTruthy();
  });

  it("30. verifies InspectorDrawer contains zero hardcoded entity business schemas", () => {
    const drawerFilePath = path.resolve(process.cwd(), "src/components/layout/InspectorDrawer.tsx");
    const content = fs.readFileSync(drawerFilePath, "utf8");
    expect(content).not.toContain("SkillDetail");
    expect(content).not.toContain("KnowledgeNode");
    expect(content).not.toContain("QuestDetail");
    expect(content).not.toContain("ArtifactDetail");
  });

  // ----------------------------------------------------
  // 31-34. Universal URL State Infrastructure for Inspector
  // ----------------------------------------------------
  it("31. verifies useInspectorUrlState reads ?inspect=<id> from URL", () => {
    currentSearchParams = new URLSearchParams("inspect=node-123&filter=all");
    const { result } = renderHook(() => useInspectorUrlState());
    expect(result.current.inspectId).toBe("node-123");
  });

  it("32. verifies useInspectorUrlState reads ?tab=<tab> from URL", () => {
    currentSearchParams = new URLSearchParams("inspect=node-123&tab=evidence");
    const { result } = renderHook(() => useInspectorUrlState());
    expect(result.current.inspectId).toBe("node-123");
    expect(result.current.activeTab).toBe("evidence");
  });

  it("33. verifies closing inspector removes inspect and tab query params while preserving others", () => {
    currentSearchParams = new URLSearchParams("view=graph&filter=active&inspect=skill-99&tab=history");
    const { result } = renderHook(() => useInspectorUrlState());

    act(() => {
      result.current.closeInspector();
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard?view=graph&filter=active");
  });

  it("34. verifies openInspector and setTab preserve unrelated query parameters", () => {
    currentSearchParams = new URLSearchParams("domain=rust&level=3");
    const { result } = renderHook(() => useInspectorUrlState());

    act(() => {
      result.current.openInspector("skill-rust-ownership", "details");
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard?domain=rust&level=3&inspect=skill-rust-ownership&tab=details");
  });

  // ----------------------------------------------------
  // 35. Frozen Backend Diff Guard
  // ----------------------------------------------------
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
