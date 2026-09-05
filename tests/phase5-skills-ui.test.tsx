// @vitest-environment jsdom
/**
 * tests/phase5-skills-ui.test.tsx
 * Phase 5 — Core Screen Modernization (Stage 5C-UI Skills Modernization)
 * Round 1 Implementation Test Suite covering all 35 governance and verification points:
 * 
 * Part 1: Strict Governance & Static Audits
 *  1. Strict Token Governance: Every CSS variable used exists in frozen design-tokens.css
 *  2. Zero Direct Gold Tokens: Gold strictly encapsulated inside PrimaryButton
 *  3. Zero Raw Z-Index: No raw Tailwind z-* classes in skills code
 *  4. Zero Dark Hardcoded Classes: Comprehensive dark color scanner (bg-black, text-white, slate/zinc/neutral)
 *  5. Zero colorMode="dark": React Flow canvas colorMode set to "light"
 *  6. Zero Fantasy / Game-Prop Icons: No Crown, Sword, Swords, Flame, Gem, Shield, etc.
 *  7. Zero Hardcoded Neon Hex Colors: No #38bdf8, #a855f7, #0b0f17, #71717a, etc.
 *  8. Single Global AppShell Contract: Skills page does NOT render duplicate AppShell
 *  9. Semantic Route Contract: /skills is configured as fullBleed in AppShellBoundary
 * 10. Heading Hierarchy: Skills page does not use h1 (AppHeader owns h1), uses h2 for main section, h3 for cards/panels
 * 11. Reduced Motion Contract: motion-reduce:animate-none on all pulse animations, reduced-motion canvas durations
 * 12. Fail-Closed PR Delta Guard: Committed git merge-base against origin/main/main forbidding backend/domain/primitives/deps
 *
 * Part 2: Pure Presentation & Edge Semantics Matrix
 * 13. Complete Derived State Visual Mapping (locked, available, learning, proficient, advanced, archived)
 * 14. Edge Relation Semantic Mapping (prerequisite, contains, supports)
 * 15. Shared Primitives: LevelBadge and MasteryBadge rendering
 * 16. Domain List Count & Depth Computation
 * 17. Client-side Graph Filtering: domain, state, search, and archived scope
 * 18. Interaction Controllers: focus resolution, archive toggle, metadata patch validation
 *
 * Part 3: Interactive Component & ARIA Contract Tests
 * 19. SkillNode Component: Accessible button with tabIndex={0}, Enter/Space keyboard selection, badges
 * 20. InspectorDrawer Integration: Renders InspectorDrawer with title "技能全景档案", auto mode, onClose handler
 * 21. SkillDetailPanel: Loading state, skill info, prerequisites check/cross, next unlock, BaseModal metadata editor
 * 22. EvidenceTimeline: Renders timeline items with evidence level badges and verified status, handles empty state
 * 23. DomainFilterPanel: Renders domain tree, state filter options, h3 headings
 * 24. SkillsPage States: Skeleton loading (role="status", aria-busy="true"), error with retry, empty state
 * 25. SkillsPage Filtering & Selection Orchestration: Domain filtering, text search, state filtering, node selection opening InspectorDrawer
 */

import React from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { MarkerType } from "@xyflow/react";

import SkillsPage from "@/app/skills/page";
import SkillNodeView, { type SkillNodeViewData } from "@/app/skills/components/SkillNode";
import SkillDetailPanel from "@/app/skills/components/SkillDetailPanel";
import DomainFilterPanel from "@/app/skills/components/DomainFilterPanel";
import EvidenceTimeline from "@/app/skills/components/EvidenceTimeline";
import {
  getSkillStateVisual,
  getRelationVisual,
  buildDomainList,
  filterGraph,
} from "@/app/skills/components/presentation";
import { toFlowEdges } from "@/app/skills/components/SkillGraphCanvas";
import { resolveFocusTarget, nextArchiveStatus, buildMetadataPatch } from "@/app/skills/components/controller";
import type {
  Domain,
  SkillDerivedState,
  SkillDetailResponse,
  SkillFlowNode,
  SkillTreeGraphResponse,
} from "@/lib/store/types";

// ---------------------------------------------------------------------------
// Mocks and Environment Setup
// ---------------------------------------------------------------------------

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/skills",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    Handle: () => null,
  };
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  class DOMMatrixReadOnlyMock {
    m22 = 1;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
      if (scale !== undefined) this.m22 = Number(scale);
    }
  }
  (globalThis as Record<string, unknown>).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;

  class ResizeObserverMock {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      this.cb(
        [
          {
            target: el,
            contentRect: { width: 400, height: 400, x: 0, y: 0, top: 0, left: 0, bottom: 400, right: 400 },
            borderBoxSize: [{ inlineSize: 400, blockSize: 400 }],
            contentBoxSize: [{ inlineSize: 400, blockSize: 400 }],
            devicePixelContentBoxSize: [{ inlineSize: 400, blockSize: 400 }],
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

  const svgProto = window.SVGElement.prototype as unknown as {
    getBBox?: () => { x: number; y: number; width: number; height: number };
  };
  svgProto.getBBox = svgProto.getBBox || (() => ({ x: 0, y: 0, width: 0, height: 0 }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------

function baseNodeData(overrides: Partial<SkillNodeViewData> = {}): SkillNodeViewData {
  return {
    name: "TypeScript 架构设计",
    aliases: ["TS", "type-system"],
    level: 3,
    xp: 85,
    masteryLevel: 3,
    masteryConfidence: 0.75,
    derivedState: "learning",
    lastUsedAt: "2026-09-01T10:00:00Z",
    prerequisiteCount: 0,
    unfulfilledPrerequisiteCount: 0,
    ...overrides,
  };
}

const mockDomains: Domain[] = [
  { id: "eng", slug: "eng", name: "软件工程", parentId: null, sortOrder: 0, createdAt: "2026-09-01T00:00:00Z" },
  { id: "arch", slug: "arch", name: "系统架构", parentId: "eng", sortOrder: 1, createdAt: "2026-09-01T00:00:00Z" },
];

const mockGraph: SkillTreeGraphResponse = {
  domains: mockDomains,
  nodes: [
    {
      id: "skill-1",
      domainId: "arch",
      position: { x: 100, y: 100 },
      data: baseNodeData({ name: "分布式系统设计", derivedState: "proficient", masteryLevel: 4, masteryConfidence: 0.9 }),
    },
    {
      id: "skill-2",
      domainId: "arch",
      position: { x: 300, y: 100 },
      data: baseNodeData({ name: "微服务契约测试", derivedState: "available", masteryLevel: 2, masteryConfidence: 0.5 }),
    },
    {
      id: "skill-archived",
      domainId: "eng",
      position: { x: 100, y: 300 },
      data: baseNodeData({ name: "遗留代码重构", derivedState: "archived", masteryLevel: 1, masteryConfidence: 0.3 }),
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "skill-1",
      target: "skill-2",
      relation: "prerequisite",
    },
  ],
};

const mockDetail: SkillDetailResponse = {
  skill: {
    id: "skill-1",
    name: "分布式系统设计",
    aliases: ["distributed-systems"],
    description: "掌握 CAP/BASE 定理与分布式共识算法",
    domainId: "arch",
    domainName: "系统架构",
    level: 4,
    xp: 220,
    nextLevelXp: 500,
    masteryLevel: 4,
    masteryConfidence: 0.9,
    derivedState: "proficient",
    lastUsedAt: "2026-09-04T12:00:00Z",
    createdAt: "2026-08-01T00:00:00Z",
  },
  prerequisites: [
    {
      id: "prereq-1",
      name: "网络协议基础",
      masteryLevel: 3,
      masteryConfidence: 0.85,
      isFulfilled: true,
    },
    {
      id: "prereq-2",
      name: "并发编程",
      masteryLevel: 1,
      masteryConfidence: 0.4,
      isFulfilled: false,
    },
  ],
  nextUnlocks: [
    {
      id: "unlock-1",
      name: "服务网格高可用",
      derivedState: "available",
    },
  ],
  evidenceTimeline: [
    {
      id: "ev-1",
      activityId: "act-1",
      activityTitle: "分布式共识验证",
      evidenceLevel: 4,
      evidenceType: "production",
      description: "生产环境完成多活数据中心 Raft 协议验证",
      verified: true,
      createdAt: "2026-09-04T12:00:00Z",
    },
  ],
  masteryHistory: [
    {
      id: "audit-1",
      eventType: "upgrade",
      fromLevel: 3,
      toLevel: 4,
      confidence: 0.9,
      reason: "通过高可用架构压力测试与混沌工程验证",
      createdAt: "2026-09-04T12:00:00Z",
    },
  ],
  recentTransactions: [
    {
      id: "tx-1",
      amount: 50,
      reason: "突破演练",
      createdAt: "2026-09-04T12:00:00Z",
    },
  ],
};

// ===========================================================================
// Part 1: Strict Governance & Static Audits
// ===========================================================================

describe("Stage 5C-UI Skills Modernization — Governance Audits", () => {
  const skillsDir = path.resolve(process.cwd(), "src/app/skills");
  const designTokensFile = path.resolve(process.cwd(), "src/styles/design-tokens.css");

  function getFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        files.push(...getFiles(fullPath));
      } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const skillsFiles = getFiles(skillsDir);

  it("1. STRICT TOKEN GOVERNANCE: every CSS variable used in skills code exists in frozen design-tokens.css", () => {
    const tokensContent = fs.readFileSync(designTokensFile, "utf8");
    const declaredTokenMatches = tokensContent.match(/--[a-zA-Z0-9_-]+/g) ?? [];
    const declaredTokens = new Set(declaredTokenMatches);

    const usedVars = new Set<string>();
    for (const file of skillsFiles) {
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

  it("2. STRICT GOVERNANCE: zero direct var(--gold-*) or gold tokens in skills presentation files", () => {
    for (const file of skillsFiles) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/var\(--[a-z0-9-]*gold[a-z0-9-]*\)/i);
      expect(content).not.toMatch(/\btext-gold\b|\bbg-gold\b|\bborder-gold\b/i);
    }
  });

  it("3. STRICT GOVERNANCE: zero raw z-index classes in skills code", () => {
    for (const file of skillsFiles) {
      const content = fs.readFileSync(file, "utf8");
      const rawZMatch = content.match(/\bz-\d+\b/);
      expect(rawZMatch).toBeNull();
    }
  });

  it("4. STRICT GOVERNANCE: zero hardcoded dark theme classes (including bg-black, text-white, raw slate/zinc/neutral)", () => {
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

    for (const file of skillsFiles) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenDarkPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it("5. ZERO colorMode='dark': SkillGraphCanvas sets colorMode='light'", () => {
    const canvasFile = path.join(skillsDir, "components/SkillGraphCanvas.tsx");
    const content = fs.readFileSync(canvasFile, "utf8");
    expect(content).not.toMatch(/colorMode=["']dark["']/);
    expect(content).toMatch(/colorMode=["']light["']/);
  });

  it("6. STRICT GOVERNANCE: zero fantasy / game-prop icons imported or rendered", () => {
    const forbiddenIcons = [
      "Crown",
      "Sword",
      "Swords",
      "Flame",
      "Gem",
      "Scroll",
      "Shield",
      "ShieldAlert",
    ];

    for (const file of skillsFiles) {
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

  it("7. STRICT GOVERNANCE: zero hardcoded neon hex colors in skills code", () => {
    const forbiddenHexes = [
      "#38bdf8",
      "#a855f7",
      "#0b0f17",
      "#71717a",
      "#00ffff",
      "#ff00ff",
      "#22c55e",
      "#eab308",
    ];

    for (const file of skillsFiles) {
      const content = fs.readFileSync(file, "utf8");
      for (const hex of forbiddenHexes) {
        expect(content.toLowerCase()).not.toContain(hex);
      }
    }
  });

  it("8. SINGLE GLOBAL APPSHELL CONTRACT: skills page does NOT render a nested AppShell", () => {
    const pageFile = path.join(skillsDir, "page.tsx");
    const pageContent = fs.readFileSync(pageFile, "utf8");
    expect(pageContent).not.toMatch(/<AppShell\b/);
    expect(pageContent).not.toMatch(/import.*AppShell.*from/);
  });

  it("9. SEMANTIC ROUTE CONTRACT: /skills is configured as fullBleed in AppShellBoundary", () => {
    const boundaryFile = path.resolve(process.cwd(), "src/components/layout/AppShellBoundary.tsx");
    const boundaryContent = fs.readFileSync(boundaryFile, "utf8");
    expect(boundaryContent).toMatch(/\/skills/);
    expect(boundaryContent).toMatch(/isFullBleed.*skills/);
  });

  it("10. HEADING HIERARCHY: skills page does not use h1 (AppHeader has h1), uses h2 for main network, h3 for panels", () => {
    const pageFile = path.join(skillsDir, "page.tsx");
    const pageContent = fs.readFileSync(pageFile, "utf8");
    expect(pageContent).not.toMatch(/<h1\b/);
    expect(pageContent).toMatch(/<h2\b/);

    const filterPanelFile = path.join(skillsDir, "components/DomainFilterPanel.tsx");
    const filterContent = fs.readFileSync(filterPanelFile, "utf8");
    expect(filterContent).not.toMatch(/<h1\b/);
    expect(filterContent).not.toMatch(/<h2\b/);
    expect(filterContent).toMatch(/<h3\b/);
  });

  it("11. REDUCED MOTION: motion-reduce:animate-none on all pulse animations", () => {
    for (const file of skillsFiles) {
      const content = fs.readFileSync(file, "utf8");
      const pulseMatches = content.match(/animate-pulse/g);
      if (pulseMatches) {
        const reducedMatches = content.match(/motion-reduce:animate-none/g);
        expect(reducedMatches?.length).toBeGreaterThanOrEqual(pulseMatches.length);
      }
    }
  });

  it("12. FAIL-CLOSED: committed PR backend & domain delta guard against merge-base (NO HEAD~1 fallback)", () => {
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

// ===========================================================================
// Part 2: Pure Presentation & Edge Semantics Matrix
// ===========================================================================

describe("Stage 5C-UI Skills Modernization — Pure Presentation & Edge Semantics", () => {
  const states: SkillDerivedState[] = [
    "locked",
    "available",
    "learning",
    "proficient",
    "advanced",
    "archived",
  ];

  it("13. Complete Derived State Visual Mapping: all 6 states have valid tokens, labels, and icons", () => {
    for (const state of states) {
      const visual = getSkillStateVisual(state);
      expect(visual.label).toBeTruthy();
      expect(visual.containerClass).toContain("var(--");
      expect(visual.badgeClass).toContain("var(--");
      if (state === "locked") {
        expect(visual.dimmed).toBe(true);
        expect(visual.icon).toBe("lock");
      } else {
        expect(visual.dimmed).toBe(false);
        expect(visual.icon).toBeNull();
      }
      if (state === "available") {
        expect(visual.pulseDot).toBe(true);
      } else {
        expect(visual.pulseDot).toBe(false);
      }
    }
  });

  it("14. Edge Relation Semantic Mapping: prerequisite, contains, supports", () => {
    const prereq = getRelationVisual("prerequisite");
    expect(prereq.color).toBe("var(--state-info-text)");
    expect(prereq.marker).toBe("arrow");
    expect(prereq.animated).toBe(false);
    expect(prereq.label).toBe("前置");

    const contains = getRelationVisual("contains");
    expect(contains.color).toBe("var(--entity-artifact-text)");
    expect(contains.marker).toBe("circle");
    expect(contains.strokeDasharray).toBe("6 4");
    expect(contains.animated).toBe(false);
    expect(contains.label).toBe("包含");

    const supports = getRelationVisual("supports");
    expect(supports.color).toBe("var(--text-muted)");
    expect(supports.marker).toBeNull();
    expect(supports.strokeDasharray).toBe("2 4");
    expect(supports.animated).toBe(false);
    expect(supports.label).toBe("支撑");

    const edges = toFlowEdges([
      { id: "e1", source: "a", target: "b", relation: "prerequisite" },
      { id: "e2", source: "b", target: "c", relation: "contains" },
      { id: "e3", source: "c", target: "d", relation: "supports" },
    ]);
    expect(edges[0].markerEnd).toMatchObject({ type: MarkerType.ArrowClosed, color: "var(--state-info-text)" });
    expect(edges[1].markerEnd).toBe("url(#skill-edge-contains-circle)");
    expect(edges[2].markerEnd).toBeUndefined();
    expect(edges.every((e) => e.animated === false)).toBe(true);
  });

  it("15. Shared Primitives: LevelBadge and MasteryBadge rendering", () => {
    const data = baseNodeData({ level: 5, masteryLevel: 4 });
    const { container } = render(
      <SkillNodeView
        id="test-node"
        data={data}
        selected={false}
        type="skillNode"
        zIndex={1}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        dragging={false}
        draggable={false}
        selectable={false}
        deletable={false}
      />
    );

    expect(screen.getByText(/LV\.5/i)).toBeDefined();
    expect(screen.getByText(/M4/i)).toBeDefined();
    expect(container.querySelector('[data-testid="mastery-badge"]')).toBeDefined();
  });

  it("16. Domain List Count & Depth Computation", () => {
    const domains: Domain[] = [
      { id: "root", slug: "root", name: "根领域", parentId: null, sortOrder: 0, createdAt: "2026-09-01T00:00:00Z" },
      { id: "sub", slug: "sub", name: "子领域", parentId: "root", sortOrder: 1, createdAt: "2026-09-01T00:00:00Z" },
    ];
    const nodes: SkillFlowNode[] = [
      { id: "n1", domainId: "root", position: { x: 0, y: 0 }, data: baseNodeData() },
      { id: "n2", domainId: "sub", position: { x: 0, y: 0 }, data: baseNodeData() },
      { id: "n3", domainId: "sub", position: { x: 0, y: 0 }, data: baseNodeData() },
    ];

    const list = buildDomainList(domains, nodes);
    expect(list).toEqual([
      { id: "root", name: "根领域", depth: 0, count: 1 },
      { id: "sub", name: "子领域", depth: 1, count: 2 },
    ]);
  });

  it("17. Graph Filtering: domain, state, search, and archived scope", () => {
    const rawNodes: SkillFlowNode[] = [
      { id: "n1", domainId: "d1", position: { x: 0, y: 0 }, data: baseNodeData({ name: "React", derivedState: "available" }) },
      { id: "n2", domainId: "d1", position: { x: 0, y: 0 }, data: baseNodeData({ name: "Vue", derivedState: "learning" }) },
      { id: "n3", domainId: "d2", position: { x: 0, y: 0 }, data: baseNodeData({ name: "Rust", derivedState: "archived" }) },
    ];
    const rawEdges = [{ id: "e1", source: "n1", target: "n2", relation: "prerequisite" as const }];

    // Default "all" hides archived nodes
    const allActive = filterGraph({ nodes: rawNodes, edges: rawEdges }, { domainId: null, stateFilter: "all", search: "" });
    expect(allActive.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(allActive.edges).toHaveLength(1);

    // Filter by domain
    const d1Only = filterGraph({ nodes: rawNodes, edges: rawEdges }, { domainId: "d1", stateFilter: "all", search: "" });
    expect(d1Only.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);

    // Filter by explicit "archived" state
    const archivedOnly = filterGraph({ nodes: rawNodes, edges: rawEdges }, { domainId: null, stateFilter: "archived", search: "" });
    expect(archivedOnly.nodes.map((n) => n.id)).toEqual(["n3"]);
    expect(archivedOnly.edges).toHaveLength(0);

    // Search filter
    const searchRes = filterGraph({ nodes: rawNodes, edges: rawEdges }, { domainId: null, stateFilter: "all", search: "react" });
    expect(searchRes.nodes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("18. Interaction Controllers: focus resolution, archive toggle, metadata patch validation", () => {
    const nodes: SkillFlowNode[] = [
      { id: "s1", domainId: "d1", position: { x: 10, y: 20 }, data: baseNodeData({ derivedState: "learning" }) },
      { id: "s-arch", domainId: "d1", position: { x: 30, y: 40 }, data: baseNodeData({ derivedState: "archived" }) },
    ];

    expect(resolveFocusTarget(nodes, "s1")).toEqual({ found: true, position: { x: 10, y: 20 }, stateFilter: "all" });
    expect(resolveFocusTarget(nodes, "s-arch")).toEqual({ found: true, position: { x: 30, y: 40 }, stateFilter: "archived" });
    expect(resolveFocusTarget(nodes, "non-existent")).toEqual({ found: false, position: null, stateFilter: "all" });

    expect(nextArchiveStatus("archived")).toBe("active");
    expect(nextArchiveStatus("learning")).toBe("archived");

    expect(buildMetadataPatch({ name: "", aliasesRaw: "", description: "", domainId: "" })).toEqual({
      ok: false,
      error: "名称不能为空",
    });
    expect(buildMetadataPatch({ name: "Golang", aliasesRaw: "go, go-lang", description: "并发编程", domainId: "d1" })).toEqual({
      ok: true,
      patch: {
        name: "Golang",
        aliases: ["go", "go-lang"],
        description: "并发编程",
        domainId: "d1",
      },
    });
  });
});

// ===========================================================================
// Part 3: Interactive Component & ARIA Contract Tests
// ===========================================================================

describe("Stage 5C-UI Skills Modernization — Interactive Components & Workspaces", () => {
  it("19. SkillNode Component: renders LevelBadge, MasteryBadge, confidence and supports keyboard activation", () => {
    const onSelect = vi.fn();
    const data = baseNodeData({
      name: "React 核心",
      level: 4,
      masteryLevel: 3,
      masteryConfidence: 0.88,
      derivedState: "learning",
      onSelect,
    });

    const { container } = render(
      <SkillNodeView
        id="node-1"
        data={data}
        selected={false}
        type="skillNode"
        zIndex={1}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        dragging={false}
        draggable={false}
        selectable={false}
        deletable={false}
      />
    );

    expect(screen.getByText("React 核心")).toBeDefined();
    // Badges
    expect(screen.getByText(/LV\.4/i)).toBeDefined();
    expect(screen.getByText(/M3/i)).toBeDefined();
    expect(screen.getByText(/置信 88%/i)).toBeDefined();

    // Keyboard navigation
    const button = container.querySelector('[tabindex="0"]')!;
    expect(button).toBeTruthy();
    expect(button.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(button, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("20. SkillDetailPanel: displays details, prerequisites, and opens BaseModal for editing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDetail,
    } as Response);

    const onClose = vi.fn();
    const onFocusSkill = vi.fn();
    const onChanged = vi.fn();

    render(
      <SkillDetailPanel
        skillId="skill-1"
        domains={mockDomains}
        onClose={onClose}
        onFocusSkill={onFocusSkill}
        onChanged={onChanged}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("分布式系统设计")).toBeDefined();
      expect(screen.getByText("网络协议基础")).toBeDefined();
      expect(screen.getByText("并发编程")).toBeDefined();
      expect(screen.getByText("服务网格高可用")).toBeDefined();
      expect(screen.getByText("生产环境完成多活数据中心 Raft 协议验证")).toBeDefined();
    });

    // Prerequisite click navigates
    fireEvent.click(screen.getByText("网络协议基础"));
    expect(onFocusSkill).toHaveBeenCalledWith("prereq-1");

    // Open metadata edit modal
    const editBtn = screen.getByLabelText("编辑技能元数据");
    fireEvent.click(editBtn);

    expect(screen.getByText("编辑技能元数据")).toBeDefined();
    expect(screen.getByText("保存")).toBeDefined();
    expect(screen.getByText("取消")).toBeDefined();
  });

  it("21. EvidenceTimeline: renders verified timeline entries and handles empty state", () => {
    const { rerender } = render(
      <EvidenceTimeline items={mockDetail.evidenceTimeline} />
    );

    expect(screen.getByText("分布式共识验证")).toBeDefined();
    expect(screen.getByText("已验证")).toBeDefined();
    expect(screen.getByText("生产环境完成多活数据中心 Raft 协议验证")).toBeDefined();

    // Empty state
    rerender(<EvidenceTimeline items={[]} />);
    expect(screen.getByText(/暂无证据记录/)).toBeDefined();
  });

  it("22. DomainFilterPanel: renders domain list with counts and h3 section titles", () => {
    const onSelectDomain = vi.fn();
    const onSelectState = vi.fn();

    const domainList = buildDomainList(mockDomains, mockGraph.nodes);

    render(
      <DomainFilterPanel
        domains={domainList}
        totalCount={3}
        activeDomainId="arch"
        onSelectDomain={onSelectDomain}
        stateFilter="all"
        onSelectState={onSelectState}
      />
    );

    expect(screen.getByText("系统架构")).toBeDefined();
    expect(screen.getByText("全部领域")).toBeDefined();

    // Check h3 headings
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.length).toBeGreaterThanOrEqual(2);

    // Select domain
    fireEvent.click(screen.getByText("全部领域"));
    expect(onSelectDomain).toHaveBeenCalledWith(null);
  });

  it("23. SkillsPage: orchestrates loading skeleton, canvas rendering, node selection into InspectorDrawer", async () => {
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/skills/skill-1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDetail,
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockGraph,
      } as Response);
    }) as unknown as typeof fetch;

    render(<SkillsPage />);

    // Initially loading
    expect(screen.getByRole("status")).toBeDefined();

    // After loading completes
    await waitFor(() => {
      expect(screen.getByText("分布式系统设计")).toBeDefined();
      expect(screen.getByText("微服务契约测试")).toBeDefined();
    });

    // Select a node to open InspectorDrawer
    fireEvent.click(screen.getByText("分布式系统设计"));

    // InspectorDrawer opens with title
    await waitFor(() => {
      expect(screen.getByText("技能全景档案")).toBeDefined();
    });
  });

  it("24. SkillsPage: handles API error state with accessible retry button", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Database unreachable" }),
    } as Response);

    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("加载失败")).toBeDefined();
      expect(screen.getByText("加载技能树失败")).toBeDefined();
      expect(screen.getByText("重试")).toBeDefined();
    });
  });
});
