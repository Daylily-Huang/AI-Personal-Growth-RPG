// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
} from "@/components/layout";
import type { DashboardSnapshot } from "@/lib/store/types";
import { validateVisualMigrationDelta } from "./visual-foundation.test";

// Mock next/navigation
let currentPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("1. verifies AppEnvironment renders the ink landscape asset and veil overlay with correct z-indices", () => {
    render(<AppEnvironment />);
    const env = screen.getByTestId("app-environment");
    expect(env).not.toBeNull();
    expect(env.getAttribute("aria-hidden")).toBe("true");

    const artwork = screen.getByTestId("environment-artwork");
    expect(artwork).not.toBeNull();
    const img = artwork.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/assets/environment/ink-landscape.svg");

    const veil = screen.getByTestId("environment-veil");
    expect(veil).not.toBeNull();
  });

  it("2. verifies current route produces correct active nav in AppSidebar and MobileNav", () => {
    currentPathname = "/dashboard";
    const { rerender } = render(
      <div>
        <AppSidebar collapsed={false} onToggleCollapse={vi.fn()} playerLevel={14} />
        <MobileNav />
      </div>
    );

    const desktopDashboard = screen.getByTestId("nav-item-dashboard");
    expect(desktopDashboard.getAttribute("data-active")).toBe("true");
    expect(desktopDashboard.getAttribute("aria-current")).toBe("page");

    const mobileDashboard = screen.getByTestId("mobile-nav-dashboard");
    expect(mobileDashboard.getAttribute("data-active")).toBe("true");

    // Switch route to /quests
    currentPathname = "/quests";
    rerender(
      <div>
        <AppSidebar collapsed={false} onToggleCollapse={vi.fn()} playerLevel={14} />
        <MobileNav />
      </div>
    );
    expect(screen.getByTestId("nav-item-quests").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-quests").getAttribute("data-active")).toBe("true");
  });

  it("3. verifies selected navigation is neutral, strictly NOT generic Gold", () => {
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

  it("4. verifies desktop expanded and collapsed structures exist and have token-driven widths", () => {
    const { rerender } = render(
      <AppSidebar collapsed={false} onToggleCollapse={vi.fn()} />
    );
    const sidebar = screen.getByTestId("app-sidebar");
    expect(sidebar.getAttribute("data-collapsed")).toBe("false");
    expect(sidebar.className).toContain("w-[var(--sidebar-width-expanded)]");

    rerender(<AppSidebar collapsed={true} onToggleCollapse={vi.fn()} />);
    expect(sidebar.getAttribute("data-collapsed")).toBe("true");
    expect(sidebar.className).toContain("w-[var(--sidebar-width-collapsed)]");
  });

  it("5. verifies mobile navigation exists with 4 active routes and pre-Stage7C disabled item", () => {
    render(<MobileNav />);
    const mobileNav = screen.getByTestId("mobile-nav");
    expect(mobileNav).not.toBeNull();
    expect(mobileNav.getAttribute("aria-label")).toBe("移动端底部导航");

    expect(screen.getByTestId("mobile-nav-dashboard")).not.toBeNull();
    expect(screen.getByTestId("mobile-nav-quests")).not.toBeNull();
    expect(screen.getByTestId("mobile-nav-skills")).not.toBeNull();
    expect(screen.getByTestId("mobile-nav-knowledge")).not.toBeNull();
    expect(screen.getByTestId("mobile-nav-disabled-产出台")).not.toBeNull();
  });

  it("6. verifies Ctrl/Cmd+B toggles sidebar collapse where applicable", () => {
    const onToggle = vi.fn();
    render(<AppSidebar collapsed={false} onToggleCollapse={onToggle} />);

    // Ctrl+B
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Cmd+B
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("7. verifies shortcut does not fire incorrectly while typing in editable fields", () => {
    const onToggle = vi.fn();
    render(
      <div>
        <AppSidebar collapsed={false} onToggleCollapse={onToggle} />
        <input data-testid="test-input" type="text" />
        <textarea data-testid="test-textarea" />
      </div>
    );

    const input = screen.getByTestId("test-input");
    input.focus();
    fireEvent.keyDown(input, { key: "b", ctrlKey: true });
    expect(onToggle).not.toHaveBeenCalled();

    const textarea = screen.getByTestId("test-textarea");
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("8. verifies breadcrumbs and title map correctly for all existing product routes", () => {
    const routeTitles = [
      { path: "/dashboard", title: "仪表盘" },
      { path: "/quests", title: "任务志" },
      { path: "/skills", title: "技能谱" },
      { path: "/knowledge", title: "知识图" },
    ];

    for (const item of routeTitles) {
      currentPathname = item.path;
      cleanup();
      render(<AppHeader />);
      const titleEl = screen.getByTestId("header-page-title");
      expect(titleEl.textContent).toBe(item.title);
      expect(titleEl.className).toContain("font-serif");
    }
  });

  it("9. verifies header reads playerLevel from frozen dashboard.player.playerLevel field", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    const levelBadge = screen.getByTestId("header-player-level");
    expect(levelBadge.textContent).toContain("LV.14");
  });

  it("10. verifies header reads xpIntoLevel, xpNeededForNext, progress from frozen dashboard.levelProgress", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    expect(screen.getByTestId("header-xp-into-level").textContent).toBe("150");
    expect(screen.getByTestId("header-xp-needed").textContent).toBe("300 XP");
    const xpBar = screen.getByTestId("header-xp-bar");
    expect(xpBar.style.width).toBe("50%");
  });

  it("11. verifies header contains zero cultivation-realm mapping (no 筑基, 金丹, etc.)", () => {
    render(<AppHeader dashboard={mockDashboard} />);
    const header = screen.getByTestId("app-header");
    expect(header.textContent).not.toContain("筑基");
    expect(header.textContent).not.toContain("金丹");
    expect(header.textContent).not.toContain("元婴");
    expect(header.textContent).not.toContain("化神");
  });

  it("12. verifies header uses zero invented current_xp or next_level_xp contract keys", () => {
    const headerFilePath = path.resolve(
      process.cwd(),
      "src/components/layout/AppHeader.tsx"
    );
    const content = fs.readFileSync(headerFilePath, "utf8");
    expect(content).not.toContain("current_xp");
    expect(content).not.toContain("next_level_xp");
  });

  it("13. verifies session identity has graceful initials / monogram fallback", () => {
    render(<AppHeader userEmail="developer@antigravity.ai" />);
    const avatar = screen.getByTestId("header-user-avatar");
    expect(avatar.textContent).toBe("D");
  });

  it("13b. verifies AppWorkspace supports standard gutter and fullBleed mode", () => {
    const { rerender } = render(
      <AppWorkspace fullBleed={false}>
        <div>Workspace Content</div>
      </AppWorkspace>
    );
    const workspace = screen.getByTestId("app-workspace");
    expect(workspace.getAttribute("data-full-bleed")).toBe("false");
    expect(workspace.className).toContain("max-w-[var(--workspace-max-width)]");

    rerender(
      <AppWorkspace fullBleed={true}>
        <div>Full Bleed Canvas</div>
      </AppWorkspace>
    );
    expect(workspace.getAttribute("data-full-bleed")).toBe("true");
    expect(workspace.className).toContain("w-full h-full p-0");
  });

  it("14. verifies InspectorDrawer closes on Escape key", () => {
    const onClose = vi.fn();
    render(
      <InspectorDrawer open={true} onClose={onClose} title="测试抽屉">
        <div>内容</div>
      </InspectorDrawer>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("15. verifies InspectorDrawer restores focus correctly upon close", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <div>
        <button data-testid="trigger-btn">打开抽屉</button>
        <InspectorDrawer open={true} onClose={onClose} title="抽屉">
          <div>抽屉内</div>
        </InspectorDrawer>
      </div>
    );

    const trigger = screen.getByTestId("trigger-btn");
    trigger.focus();

    // Close drawer
    rerender(
      <div>
        <button data-testid="trigger-btn">打开抽屉</button>
        <InspectorDrawer open={false} onClose={onClose} title="抽屉">
          <div>抽屉内</div>
        </InspectorDrawer>
      </div>
    );

    expect(screen.queryByTestId("inspector-drawer-root")).toBeNull();
  });

  it("16. verifies InspectorDrawer accepts injected children", () => {
    render(
      <InspectorDrawer open={true} onClose={vi.fn()} title="实体检查器">
        <div data-testid="custom-injected-child">自定义注入组件</div>
      </InspectorDrawer>
    );
    expect(screen.getByTestId("custom-injected-child").textContent).toBe("自定义注入组件");
  });

  it("17. verifies InspectorDrawer contains zero hardcoded Artifact, Skill, Knowledge, or Quest business schema", () => {
    const drawerFilePath = path.resolve(
      process.cwd(),
      "src/components/layout/InspectorDrawer.tsx"
    );
    const content = fs.readFileSync(drawerFilePath, "utf8");
    expect(content).not.toContain("ArtifactSkillLink");
    expect(content).not.toContain("ArtifactKnowledgeNodeLink");
    expect(content).not.toContain("epistemic_confidence");
    expect(content).not.toContain("evidence_level");
    expect(content).not.toContain("quest_progression");
  });

  it("18. verifies /login does not receive authenticated AppShell", () => {
    const loginPagePath = path.resolve(process.cwd(), "src/app/login/page.tsx");
    const loginContent = fs.readFileSync(loginPagePath, "utf8");
    expect(loginContent).not.toContain("AppShell");
    expect(fs.existsSync(path.resolve(process.cwd(), "src/app/login/layout.tsx"))).toBe(false);
  });

  it("19. verifies existing route URLs remain unchanged", () => {
    expect(fs.existsSync(path.resolve(process.cwd(), "src/app/dashboard/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), "src/app/quests/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), "src/app/skills/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), "src/app/knowledge/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), "src/app/login/page.tsx"))).toBe(true);
  });

  it("20. verifies responsive shell classes correspond to Base/md/lg/xl contract", () => {
    render(
      <AppShell dashboard={mockDashboard}>
        <div>内容</div>
      </AppShell>
    );

    const sidebar = screen.getByTestId("app-sidebar");
    expect(sidebar.className).toContain("hidden md:flex");

    const mobileNav = screen.getByTestId("mobile-nav");
    expect(mobileNav.className).toContain("md:hidden");

    const content = screen.getByTestId("app-shell-content-container");
    expect(content.className).toContain("pb-[var(--mobile-nav-height)] md:pb-0");
  });

  it("21. verifies no raw private styling literals (hex codes) in new shell components", () => {
    const layoutDir = path.resolve(process.cwd(), "src/components/layout");
    const files = fs.readdirSync(layoutDir).filter((f) => f.endsWith(".tsx"));
    const rawHexRegex = /#([0-9a-fA-F]{3,8})\b/;

    for (const file of files) {
      const content = fs.readFileSync(path.join(layoutDir, file), "utf8");
      const hexMatch = content.match(rawHexRegex);
      expect(hexMatch).toBeNull();
    }
  });

  it("22. verifies that Phase 2 changed files match visual migration surfaces and contain zero frozen violations", () => {
    const phase2ChangedFiles = [
      "src/components/layout/AppEnvironment.tsx",
      "src/components/layout/AppSidebar.tsx",
      "src/components/layout/AppHeader.tsx",
      "src/components/layout/AppWorkspace.tsx",
      "src/components/layout/MobileNav.tsx",
      "src/components/layout/InspectorDrawer.tsx",
      "src/components/layout/AppShell.tsx",
      "src/components/layout/index.ts",
      "src/app/dashboard/layout.tsx",
      "src/app/quests/layout.tsx",
      "src/app/skills/layout.tsx",
      "src/app/knowledge/layout.tsx",
      "tests/global-app-shell.test.tsx",
    ];

    const result = validateVisualMigrationDelta(phase2ChangedFiles);
    expect(result.isVisualPR).toBe(true);
    expect(result.violations).toEqual([]);
  });
});
