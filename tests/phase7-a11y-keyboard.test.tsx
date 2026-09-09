// @vitest-environment jsdom
import React, { type ComponentProps } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { SkillFlowEdge, SkillFlowNode, SkillTreeGraphResponse } from "@/lib/store/types";
import type { KnowledgeGraphResponse } from "@/lib/knowledge/types";
import SkillNodeView, { type SkillNodeViewData } from "@/app/skills/components/SkillNode";
import KnowledgeNodeView, { type KnowledgeNodeData } from "@/app/knowledge/components/KnowledgeNodeView";
import SkillTableView from "@/app/skills/components/SkillTableView";
import KnowledgeTableView from "@/app/knowledge/components/KnowledgeTableView";
import SkillsPage from "@/app/skills/page";
import KnowledgeMapPage from "@/app/knowledge/page";
import LoginPage from "@/app/login/page";
import DashboardPage from "@/app/dashboard/page";
import { findNextSkillNode } from "@/app/skills/components/keyboard-navigation";
import { findNextKnowledgeNode } from "@/app/knowledge/components/keyboard-navigation";
import { BaseModal } from "@/components/ui/BaseModal";
import { InspectorDrawer } from "@/components/layout/InspectorDrawer";

const mocks = vi.hoisted(() => ({
  search: "",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return { ...actual, Handle: () => null };
});

vi.mock("@/app/skills/components/SkillGraphCanvas", () => ({
  default: ({
    nodes,
    onSelect,
  }: {
    nodes: Array<{ id: string; data: { name: string; isSelected?: boolean } }>;
    onSelect: (skillId: string | null) => void;
  }) => (
    <div data-testid="skills-canvas">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          aria-label={node.data.name}
          aria-pressed={Boolean(node.data.isSelected)}
          onClick={() => onSelect(node.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
              event.preventDefault();
              onSelect(node.id);
            }
          }}
        >
          {node.data.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/app/knowledge/components/KnowledgeGraphCanvas", () => ({
  default: ({ nodes }: { nodes: Array<{ id: string; data: { title: string } }> }) => (
    <div data-testid="knowledge-canvas">
      {nodes.map((node) => <span key={node.id}>{node.data.title}</span>)}
    </div>
  ),
}));

const skillNode = (
  id: string,
  position: { x: number; y: number },
  overrides: Partial<SkillFlowNode["data"]> = {},
): SkillFlowNode => ({
  id,
  domainId: "domain-a",
  position,
  data: {
    name: `技能 ${id}`,
    aliases: [],
    level: 3,
    xp: 120,
    masteryLevel: 2,
    masteryConfidence: 0.7,
    derivedState: "learning",
    lastUsedAt: null,
    prerequisiteCount: 1,
    unfulfilledPrerequisiteCount: 0,
    ...overrides,
  },
});

const skillNodes = [
  skillNode("a", { x: 0, y: 0 }),
  skillNode("b", { x: 100, y: 0 }),
  skillNode("c", { x: 100, y: 100 }),
  skillNode("unconnected", { x: 10, y: 10 }),
];
const skillEdges: SkillFlowEdge[] = [
  { id: "ab", source: "a", target: "b", relation: "prerequisite" },
  { id: "ac", source: "a", target: "c", relation: "supports" },
  { id: "bc", source: "b", target: "c", relation: "contains" },
];

const knowledgeNode = (
  id: string,
  position: { x: number; y: number },
  overrides: Partial<KnowledgeGraphResponse["nodes"][number]> = {},
): KnowledgeGraphResponse["nodes"][number] => ({
  id,
  title: `知识 ${id}`,
  nodeType: "concept",
  domainId: "domain-a",
  domainName: "科研",
  skillId: null,
  skillName: null,
  verificationStatus: "verified",
  isArchived: false,
  confidence: 0.9,
  sourceType: "user_created",
  sourceId: null,
  inboundEdgeCount: 0,
  outboundEdgeCount: 1,
  position,
  ...overrides,
});

const knowledgeGraph: KnowledgeGraphResponse = {
  domains: [{ id: "domain-a", name: "科研", slug: "research", nodeCount: 3 }],
  nodes: [knowledgeNode("a", { x: 0, y: 0 }), knowledgeNode("b", { x: 100, y: 0 }), knowledgeNode("c", { x: 100, y: 100 })],
  edges: [
    {
      id: "ab",
      source: "a",
      target: "b",
      relationType: "supports",
      verificationStatus: "verified",
      isArchived: false,
      confidence: 0.9,
      sourceType: "user_created",
      sourceId: null,
      provenanceNote: null,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: "bc",
      source: "b",
      target: "c",
      relationType: "contradicts",
      verificationStatus: "inferred",
      isArchived: false,
      confidence: 0.6,
      sourceType: "ai_proposal",
      sourceId: null,
      provenanceNote: null,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: "ca",
      source: "c",
      target: "a",
      relationType: "relates_to",
      verificationStatus: "rejected",
      isArchived: false,
      confidence: 0.2,
      sourceType: "ai_proposal",
      sourceId: null,
      provenanceNote: null,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: "ac-superseded",
      source: "a",
      target: "c",
      relationType: "supports",
      verificationStatus: "superseded",
      isArchived: false,
      confidence: 0.4,
      sourceType: "user_created",
      sourceId: null,
      provenanceNote: null,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: "cb-archived",
      source: "c",
      target: "b",
      relationType: "prerequisite",
      verificationStatus: "verified",
      isArchived: true,
      confidence: 0.8,
      sourceType: "user_created",
      sourceId: null,
      provenanceNote: null,
      verifiedAt: null,
      verifiedBy: null,
    },
  ],
  stats: { totalNodes: 3, verifiedNodes: 3, inferredNodes: 0, totalEdges: 5, verifiedEdges: 2, inferredEdges: 1, isTruncated: false },
};

function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

function expectAriaPressed(element: HTMLElement, value: boolean) {
  expect(element.getAttribute("aria-pressed")).toBe(String(value));
}

function skillNodeProps(data: SkillNodeViewData, id = "skill-a"): ComponentProps<typeof SkillNodeView> {
  return {
    id,
    data,
    type: "skillNode",
    selected: false,
    dragging: false,
    zIndex: 0,
    xPos: 0,
    yPos: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    sourcePosition: undefined,
    targetPosition: undefined,
  } as unknown as ComponentProps<typeof SkillNodeView>;
}

function knowledgeNodeProps(data: KnowledgeNodeData, id = data.id): ComponentProps<typeof KnowledgeNodeView> {
  return {
    id,
    data,
    type: "knowledgeNode",
    selected: false,
    dragging: false,
    zIndex: 0,
    xPos: 0,
    yPos: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    sourcePosition: undefined,
    targetPosition: undefined,
  } as unknown as ComponentProps<typeof KnowledgeNodeView>;
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (media: string) => ({
      matches: false,
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mocks.search = "";
});

describe("Phase 7 Round 1 graph keyboard traversal", () => {
  it("chooses connected directional candidates deterministically and skips unconnected nodes", () => {
    expect(findNextSkillNode("a", "right", skillNodes, skillEdges)).toBe("b");
    expect(findNextSkillNode("a", "down", skillNodes, skillEdges)).toBe("c");
    expect(findNextSkillNode("a", "left", skillNodes, skillEdges)).toBeNull();
    expect(findNextSkillNode("unconnected", "right", skillNodes, skillEdges)).toBeNull();

    expect(findNextKnowledgeNode("a", "right", knowledgeGraph.nodes, knowledgeGraph.edges)).toBe("b");
    expect(findNextKnowledgeNode("a", "left", knowledgeGraph.nodes, knowledgeGraph.edges)).toBeNull();
  });

  it("uses the same node selection callback for Enter and Space", () => {
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    const skillData: SkillNodeViewData = {
      ...skillNodes[0].data,
      onSelect,
      onNavigate,
    };
    render(<SkillNodeView {...skillNodeProps(skillData)} />);
    const skillButton = screen.getByRole("button", { name: /技能 a/ });
    fireEvent.keyDown(skillButton, { key: "ArrowRight" });
    fireEvent.keyDown(skillButton, { key: "Enter" });
    fireEvent.keyDown(skillButton, { key: " " });
    expect(onNavigate).toHaveBeenCalledWith("skill-a", "right");
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith("skill-a");

    cleanup();
    const knowledgeOnSelect = vi.fn();
    const knowledgeOnNavigate = vi.fn();
    const knowledgeData: KnowledgeNodeData = {
      ...knowledgeGraph.nodes[0],
      onSelect: knowledgeOnSelect,
      onNavigate: knowledgeOnNavigate,
    };
    render(<KnowledgeNodeView {...knowledgeNodeProps(knowledgeData)} />);
    const knowledgeButton = screen.getByRole("button", { name: /知识 a/ });
    fireEvent.keyDown(knowledgeButton, { key: "ArrowDown" });
    fireEvent.keyDown(knowledgeButton, { key: "Enter" });
    fireEvent.keyDown(knowledgeButton, { key: " " });
    expect(knowledgeOnNavigate).toHaveBeenCalledWith("a", "down");
    expect(knowledgeOnSelect).toHaveBeenCalledTimes(2);
  });

  it("keeps the page-owned selected state synchronized for keyboard, pointer, and clearing", () => {
    function SelectionHarness() {
      const [selectedId, setSelectedId] = React.useState<string | null>(null);
      return (
        <div>
          {skillNodes.slice(0, 2).map((node) => (
            <SkillNodeView
              key={node.id}
              {...skillNodeProps({
                ...node.data,
                isSelected: selectedId === node.id,
                onSelect: setSelectedId,
              }, node.id)}
            />
          ))}
          <button type="button" onClick={() => setSelectedId(null)}>
            清除技能选择
          </button>
        </div>
      );
    }

    render(<SelectionHarness />);
    const skillA = screen.getByRole("button", { name: /技能 a/ });
    const skillB = screen.getByRole("button", { name: /技能 b/ });

    expectAriaPressed(skillA, false);
    expectAriaPressed(skillB, false);

    fireEvent.keyDown(skillA, { key: "Enter" });
    expectAriaPressed(skillA, true);
    expectAriaPressed(skillB, false);

    fireEvent.keyDown(skillB, { key: " " });
    expectAriaPressed(skillA, false);
    expectAriaPressed(skillB, true);

    fireEvent.click(skillA);
    expectAriaPressed(skillA, true);
    expectAriaPressed(skillB, false);

    fireEvent.click(screen.getByRole("button", { name: "清除技能选择" }));
    expectAriaPressed(skillA, false);
    expectAriaPressed(skillB, false);
  });
});

describe("Phase 7 Round 1 semantic graph tables", () => {
  it("exposes a named login landmark and explicit form labels", () => {
    render(<LoginPage />);

    expect(screen.getByRole("main", { name: "AI Personal Growth RPG" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "AI Personal Growth RPG", level: 1 })).toBeDefined();
    expect(screen.getByLabelText("电子邮箱").getAttribute("id")).toBe("login-email");
    expect(screen.getByLabelText("密码").getAttribute("id")).toBe("login-password");
    expect(screen.getByRole("button", { name: "登录已有账号" }).getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    expect(screen.getByLabelText("电子邮箱").getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    expect(screen.getByRole("button", { name: "进入 RPG 世界" }).getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
  });

  it("renders a genuine Skill table and preserves the existing inspection path", () => {
    const onSelect = vi.fn();
    render(
      <SkillTableView
        nodes={skillNodes.map((node) => ({
          ...node,
          data: { ...node.data, domainLabel: "科研" },
          type: "skillNode" as const,
        }))}
        edges={skillEdges}
        onSelect={onSelect}
      />,
    );
    const table = screen.getByRole("table", { name: "当前筛选下的技能成长读模型" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getByRole("button", { name: /查看技能 技能 a/ }).getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    fireEvent.click(within(table).getByRole("button", { name: /查看技能 技能 a/ }));
    expect(onSelect).toHaveBeenCalledWith("a");
    expect(within(table).getAllByText("M2").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("70%").length).toBeGreaterThan(0);
    const relations = screen.getByRole("table", { name: "当前筛选下的技能图谱关系" });
    expect(within(relations).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(relations).getByText(/prerequisite/)).toBeTruthy();
    expect(within(relations).getByText(/contains/)).toBeTruthy();
    expect(within(relations).getByText(/supports/)).toBeTruthy();
    expect(within(screen.getByTestId("skills-relations-table-row-ab")).getByText("技能 a")).toBeTruthy();
    expect(within(screen.getByTestId("skills-relations-table-row-ab")).getByText("技能 b")).toBeTruthy();
    expect(within(screen.getByTestId("skills-relations-table-row-bc")).getByText("技能 c")).toBeTruthy();
  });

  it("renders Knowledge nodes and relationships as semantic tables without conflation", () => {
    const onSelectNode = vi.fn();
    const onSelectEdge = vi.fn();
    const nodes = knowledgeGraph.nodes.map((node) => ({
      id: node.id,
      position: node.position,
      type: "knowledgeNode" as const,
      data: node,
    }));
    const edges = knowledgeGraph.edges.map((edge) => ({ ...edge, sourceType: edge.sourceType }));
    render(
      <KnowledgeTableView
        nodes={nodes}
        edges={edges}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
      />,
    );
    expect(screen.getByRole("table", { name: "当前筛选下的知识节点读模型" })).toBeTruthy();
    const relations = screen.getByRole("table", { name: "当前筛选下的知识关系及其权威状态" });
    expect(within(relations).getAllByRole("columnheader")).toHaveLength(5);
    expect(within(relations).getByText(/— contradicts/)).toBeTruthy();
    expect(within(relations).getAllByText(/→ supports/).length).toBe(2);
    expect(within(relations).getByText(/— relates_to/)).toBeTruthy();
    expect(within(relations).getByText(/→ prerequisite/)).toBeTruthy();
    expect(within(relations).getByText("VERIFIED · ACTIVE")).toBeTruthy();
    expect(within(relations).getByText(/INFERRED · ACTIVE · \[AI PROPOSED 60%\]/)).toBeTruthy();
    expect(within(relations).getByText("REJECTED · ACTIVE")).toBeTruthy();
    expect(within(relations).getByText("SUPERSEDED · ACTIVE")).toBeTruthy();
    expect(within(relations).getByText("VERIFIED · ARCHIVED")).toBeTruthy();
    expect(screen.getByRole("button", { name: /查看知识节点 知识 a/ }).getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    expect(within(relations).getAllByRole("button", { name: /查看知识关系/ })[0].getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    fireEvent.click(within(relations).getAllByRole("button", { name: /查看知识关系/ })[0]);
    expect(onSelectEdge).toHaveBeenCalledWith("ab");
    fireEvent.click(screen.getByRole("button", { name: /查看知识节点 知识 a/ }));
    expect(onSelectNode).toHaveBeenCalledWith("a");
  });
});

describe("Phase 7 Round 1 URL-backed views and overlay ownership", () => {
  it("keeps Dashboard loading overflow owned by a page-local boundary", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<DashboardPage />);
    const loadingState = screen.getByRole("status");
    const owner = loadingState.parentElement;
    expect(owner?.className).toContain("min-w-0");
    expect(owner?.className).toContain("overflow-x-clip");
  });

  it("keeps page-local Skills controls on the existing touch-target contract", async () => {
    mocks.search = "view=table";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ domains: [], nodes: [skillNodes[0]], edges: [] } satisfies SkillTreeGraphResponse)));
    render(<SkillsPage />);
    const table = await screen.findByTestId("skills-accessible-table");

    expect(screen.getByRole("button", { name: "打开筛选面板" }).getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    for (const searchInput of screen.getAllByRole("textbox", { name: "搜索技能" })) {
      expect(searchInput.getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    }

    fireEvent.click(screen.getByRole("button", { name: "打开筛选面板" }));
    expect(screen.getByRole("button", { name: "关闭筛选面板" }).getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    for (const domainButton of screen.getAllByRole("button", { name: /全部领域/ })) {
      expect(domainButton.getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
    }

    expect(within(table).getByRole("button", { name: /查看技能 技能 a/ }).getAttribute("class")).toContain("min-h-[var(--touch-target-min)]");
  });

  it("keeps the Skills workspace height explicit across mobile and desktop shell modes", () => {
    const { container } = render(<SkillsPage />);

    const workspace = container.firstElementChild;
    expect(workspace).toBeTruthy();
    expect(workspace?.getAttribute("class")).toContain("h-[calc(100dvh-var(--header-height)-var(--mobile-nav-height))]");
    expect(workspace?.getAttribute("class")).toContain("md:h-[calc(100dvh-var(--header-height))]");
    expect(screen.getByRole("region", { name: "技能图谱画布" })).toBeTruthy();
  });

  it("restores Skill table mode from view=table and updates the URL through the router", async () => {
    mocks.search = "view=table";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ domains: [], nodes: [skillNodes[0]], edges: [] } satisfies SkillTreeGraphResponse)));
    render(<SkillsPage />);
    await screen.findByTestId("skills-accessible-table");
    expect(screen.queryByTestId("skills-canvas")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "切换图谱" }));
    expect(mocks.replace).toHaveBeenCalledWith("/skills", { scroll: false });
  });

  it("keeps Skill page selection truth aligned for keyboard and pointer activation", async () => {
    const detail = {
      skill: {
        id: "a",
        name: "技能 a",
        aliases: [],
        description: null,
        domainId: "domain-a",
        domainName: "科研",
        level: 3,
        xp: 120,
        nextLevelXp: 200,
        masteryLevel: 2,
        masteryConfidence: 0.7,
        derivedState: "learning",
        lastUsedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      prerequisites: [],
      nextUnlocks: [],
      evidenceTimeline: [],
      masteryHistory: [],
      recentTransactions: [],
    };
    vi.stubGlobal("fetch", vi.fn((input: unknown) => {
      const path = String(input);
      return Promise.resolve(path.startsWith("/api/skills/") ? json(detail) : json({
        domains: [],
        nodes: skillNodes.slice(0, 2),
        edges: skillEdges.slice(0, 1),
      } satisfies SkillTreeGraphResponse));
    }));

    render(<SkillsPage />);
    const skillA = await screen.findByRole("button", { name: "技能 a" });
    const skillB = screen.getByRole("button", { name: "技能 b" });

    fireEvent.keyDown(skillA, { key: "Enter" });
    expectAriaPressed(skillA, true);
    expect(screen.getByTestId("inspector-drawer-root")).toBeTruthy();

    fireEvent.keyDown(skillB, { key: " " });
    expectAriaPressed(skillA, false);
    expectAriaPressed(skillB, true);

    fireEvent.click(skillA);
    expectAriaPressed(skillA, true);
    expectAriaPressed(skillB, false);

    fireEvent.keyDown(window, { key: "Escape" });
    expectAriaPressed(skillA, false);
    expectAriaPressed(skillB, false);
    expect(screen.queryByTestId("inspector-drawer-root")).toBeNull();
  });

  it("restores Knowledge table mode and safely falls back for an unsupported view", async () => {
    mocks.search = "view=table";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(knowledgeGraph)));
    const { unmount } = render(<KnowledgeMapPage />);
    await screen.findByTestId("knowledge-nodes-table");
    expect(screen.getByTestId("knowledge-relations-table")).toBeTruthy();
    unmount();

    mocks.search = "view=unsupported";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(knowledgeGraph)));
    render(<KnowledgeMapPage />);
    await screen.findByTestId("knowledge-canvas");
    expect(screen.queryByTestId("knowledge-nodes-table")).toBeNull();
  });

  it("keeps Escape scoped to the topmost modal before the parent drawer", () => {
    function OverlayStack() {
      const [drawerOpen, setDrawerOpen] = React.useState(true);
      const [modalOpen, setModalOpen] = React.useState(true);
      return (
        <>
          <button type="button" data-testid="drawer-opener">打开检查器</button>
          <InspectorDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="检查器">
            <button type="button">抽屉内容</button>
          </InspectorDrawer>
          <BaseModal open={modalOpen} onClose={() => setModalOpen(false)} title="编辑">
            <button type="button">模态内容</button>
          </BaseModal>
        </>
      );
    }

    render(<OverlayStack />);
    fireEvent.keyDown(screen.getByTestId("base-modal-root"), { key: "Escape" });
    expect(screen.queryByTestId("base-modal-root")).toBeNull();
    expect(screen.getByTestId("inspector-drawer-root")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("inspector-drawer-root")).toBeNull();
  });
});
