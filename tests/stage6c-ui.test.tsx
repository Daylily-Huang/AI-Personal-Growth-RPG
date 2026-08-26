// @vitest-environment jsdom
// tests/stage6c-ui.test.tsx
// Stage 6C Knowledge Map React/jsdom Component & Interaction Test Suite

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  KnowledgeGraphResponse,
  KnowledgeNodeDetailResponse,
  KnowledgeEdgeDetailResponse,
} from "@/lib/knowledge/types";
import KnowledgeMapPage from "@/app/knowledge/page";
import KnowledgeNodeView, { type KnowledgeNodeData } from "@/app/knowledge/components/KnowledgeNodeView";
import KnowledgeDetailPanel from "@/app/knowledge/components/KnowledgeDetailPanel";
import KnowledgeEdgeDetailPanel from "@/app/knowledge/components/KnowledgeEdgeDetailPanel";
import KnowledgeFilterPanel from "@/app/knowledge/components/KnowledgeFilterPanel";
import { toFlowEdges } from "@/app/knowledge/components/KnowledgeGraphCanvas";
import { DEFAULT_FILTERS } from "@/app/knowledge/components/controller";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
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
  (window as unknown as Record<string, unknown>).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;

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
            contentRect: { width: 400, height: 300, x: 0, y: 0, top: 0, left: 0, bottom: 300, right: 400 },
            borderBoxSize: [{ inlineSize: 400, blockSize: 300 }],
            contentBoxSize: [{ inlineSize: 400, blockSize: 300 }],
            devicePixelContentBoxSize: [{ inlineSize: 400, blockSize: 300 }],
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
  svgProto.getBBox =
    svgProto.getBBox || (() => ({ x: 0, y: 0, width: 0, height: 0 }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const mockGraphData: KnowledgeGraphResponse = {
  domains: [
    { id: "dom-1", name: "Neuroscience", slug: "neuro", nodeCount: 2 },
    { id: "dom-2", name: "AI Systems", slug: "ai", nodeCount: 1 },
  ],
  nodes: [
    {
      id: "node-1",
      title: "Long-Term Potentiation",
      nodeType: "concept",
      domainId: "dom-1",
      domainName: "Neuroscience",
      skillId: "sk-1",
      skillName: "Synaptic Plasticity",
      verificationStatus: "verified",
      isArchived: false,
      confidence: 1.0,
      sourceType: "activity",
      sourceId: "act-1",
      inboundEdgeCount: 0,
      outboundEdgeCount: 1,
      position: { x: 0, y: 0 },
    },
    {
      id: "node-2",
      title: "NMDA Receptor Calcium Flux",
      nodeType: "claim",
      domainId: "dom-1",
      domainName: "Neuroscience",
      skillId: null,
      skillName: null,
      verificationStatus: "inferred",
      isArchived: false,
      confidence: 0.85,
      sourceType: "ai_proposal",
      sourceId: "act-1",
      inboundEdgeCount: 1,
      outboundEdgeCount: 0,
      position: { x: 180, y: 0 },
    },
    {
      id: "node-3",
      title: "Cognitive Architectures",
      nodeType: "topic",
      domainId: "dom-2",
      domainName: "AI Systems",
      skillId: null,
      skillName: null,
      verificationStatus: "verified",
      isArchived: true,
      confidence: 1.0,
      sourceType: "user_created",
      sourceId: null,
      inboundEdgeCount: 0,
      outboundEdgeCount: 0,
      position: { x: 0, y: 180 },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      relationType: "supports",
      verificationStatus: "inferred",
      isArchived: false,
      confidence: 0.85,
      sourceType: "ai_proposal",
      sourceId: "act-1",
      provenanceNote: "LTP induction activates NMDA receptors causing calcium influx",
      verifiedAt: null,
      verifiedBy: null,
    },
  ],
  stats: {
    totalNodes: 3,
    verifiedNodes: 2,
    inferredNodes: 1,
    totalEdges: 1,
    verifiedEdges: 0,
    inferredEdges: 1,
    isTruncated: false,
  },
};

const mockNodeDetail: KnowledgeNodeDetailResponse = {
  node: {
    id: "node-2",
    title: "NMDA Receptor Calcium Flux",
    description: "NMDA receptors allow Ca2+ entry upon glutamate binding and membrane depolarization.",
    nodeType: "claim",
    domainId: "dom-1",
    domainName: "Neuroscience",
    skillId: null,
    skillName: null,
    verificationStatus: "inferred",
    isArchived: false,
    confidence: 0.85,
    sourceType: "ai_proposal",
    sourceId: "act-1",
    verifiedAt: null,
    verifiedBy: null,
    metadata: {},
    lastReviewedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  provenance: {
    sourceActivity: {
      id: "act-1",
      title: "Read LTP Paper",
      activityType: "study",
      completedAt: "2026-01-01T00:00:00.000Z",
    },
    sourceArtifact: {
      id: "art-1",
      title: "LTP Summary Notes.md",
      type: "document",
    },
    evidenceRecords: [
      {
        id: "ev-1",
        type: "E1",
        content: "Extracted passage detailing NMDA Ca2+ channel conductance",
        verified: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
  connections: {
    inbound: [
      {
        edgeId: "edge-1",
        sourceNodeId: "node-1",
        sourceNodeTitle: "Long-Term Potentiation",
        sourceNodeType: "concept",
        relationType: "supports",
        verificationStatus: "inferred",
        confidence: 0.85,
        sourceType: "ai_proposal",
        sourceId: "act-1",
        provenanceNote: "LTP induction activates NMDA receptors",
      },
    ],
    outbound: [],
  },
};

const mockEdgeDetail: KnowledgeEdgeDetailResponse = {
  edge: {
    id: "edge-1",
    sourceNodeId: "node-1",
    sourceNodeTitle: "Long-Term Potentiation",
    targetNodeId: "node-2",
    targetNodeTitle: "NMDA Receptor Calcium Flux",
    relationType: "supports",
    verificationStatus: "inferred",
    confidence: 0.85,
    isArchived: false,
    sourceType: "ai_proposal",
    sourceId: "act-1",
    provenanceNote: "LTP induction activates NMDA receptors causing calcium influx",
    verifiedAt: null,
    verifiedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  provenance: {
    sourceActivity: {
      id: "act-1",
      title: "Read LTP Paper",
      completedAt: "2026-01-01T00:00:00.000Z",
    },
    sourceArtifact: null,
  },
};

describe("Stage 6C — Knowledge Map UI & Component Interaction Tests (Live React/jsdom)", () => {
  test("1. Loading State: Displays spinner and loading text on initial mount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    );

    render(<KnowledgeMapPage />);
    expect(screen.getByTestId("loading-indicator")).toBeDefined();
    expect(screen.getByText("正在加载知识图谱与认知事实…")).toBeDefined();
  });

  test("2. Error State & Retry: Displays error message and allows retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Database connection timeout" }),
      }),
    );

    render(<KnowledgeMapPage />);
    await waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeDefined();
    });
    expect(screen.getByText("Database connection timeout")).toBeDefined();

    // Clicking retry calls fetch again
    const retryBtn = screen.getByTestId("retry-btn");
    fireEvent.click(retryBtn);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  test("3. Empty State: Displays empty graph placeholder when zero total nodes exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          domains: [],
          nodes: [],
          edges: [],
          stats: { totalNodes: 0, verifiedNodes: 0, inferredNodes: 0, totalEdges: 0, verifiedEdges: 0, inferredEdges: 0, isTruncated: false },
        }),
      }),
    );

    render(<KnowledgeMapPage />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-graph-state")).toBeDefined();
    });
    expect(screen.getByText("知识图谱暂未生成")).toBeDefined();
  });

  test("4. 4-Channel Visual Encoding: Verified, Inferred (AI), Archived nodes", () => {
    // 4.1 Verified Concept Node
    const verifiedData: KnowledgeNodeData = {
      id: "v-1",
      title: "Cellular Mitosis",
      nodeType: "concept",
      domainId: "dom-1",
      domainName: "Biology",
      skillId: "sk-1",
      skillName: "Cell Biology",
      verificationStatus: "verified",
      isArchived: false,
      confidence: 1.0,
      sourceType: "user_created",
      sourceId: null,
      inboundEdgeCount: 2,
      outboundEdgeCount: 1,
    };

    const { unmount: unmount1 } = render(
      <KnowledgeNodeView
        id="v-1"
        data={verifiedData}
        type="knowledgeNode"
        selected={false}
        zIndex={1}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        dragging={false}
        deletable={false}
        selectable={true}
        draggable={false}
      />,
    );

    const nodeEl1 = screen.getByTestId("knowledge-node-v-1");
    expect(nodeEl1.className).toContain("border-solid");
    expect(screen.getByText("[VERIFIED]")).toBeDefined();
    expect(screen.getByText("Concept")).toBeDefined();
    expect(screen.getByText("Biology")).toBeDefined();
    expect(screen.getByText("Cell Biology")).toBeDefined();
    unmount1();

    // 4.2 Inferred Claim Node (AI Proposed)
    const inferredData: KnowledgeNodeData = {
      id: "inf-1",
      title: "Spindle Fibers Pull Chromosomes",
      nodeType: "claim",
      domainId: "dom-1",
      domainName: "Biology",
      skillId: null,
      skillName: null,
      verificationStatus: "inferred",
      isArchived: false,
      confidence: 0.88,
      sourceType: "ai_proposal",
      sourceId: "act-1",
      inboundEdgeCount: 1,
      outboundEdgeCount: 0,
    };

    const { unmount: unmount2 } = render(
      <KnowledgeNodeView
        id="inf-1"
        data={inferredData}
        type="knowledgeNode"
        selected={false}
        zIndex={1}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        dragging={false}
        deletable={false}
        selectable={true}
        draggable={false}
      />,
    );

    const nodeEl2 = screen.getByTestId("knowledge-node-inf-1");
    expect(nodeEl2.className).toContain("border-dashed");
    expect(screen.getByText("[AI PROPOSED 88%]")).toBeDefined();
    expect(screen.getByText("Claim")).toBeDefined();
    unmount2();

    // 4.3 Archived Topic Node
    const archivedData: KnowledgeNodeData = {
      id: "arch-1",
      title: "Ancient Cell Theory",
      nodeType: "topic",
      domainId: "dom-1",
      domainName: "Biology",
      skillId: null,
      skillName: null,
      verificationStatus: "verified",
      isArchived: true,
      confidence: 1.0,
      sourceType: "user_created",
      sourceId: null,
      inboundEdgeCount: 0,
      outboundEdgeCount: 0,
    };

    render(
      <KnowledgeNodeView
        id="arch-1"
        data={archivedData}
        type="knowledgeNode"
        selected={false}
        zIndex={1}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        dragging={false}
        deletable={false}
        selectable={true}
        draggable={false}
      />,
    );

    const nodeEl3 = screen.getByTestId("knowledge-node-arch-1");
    expect(nodeEl3.className).toContain("border-dotted");
    expect(screen.getByText("[ARCHIVED]")).toBeDefined();
    expect(screen.getByText("Topic")).toBeDefined();
  });

  test("5. Filter Panel Interactions: Search, Domain, NodeType, Status, Progressive Depth", () => {
    const onFilterChange = vi.fn();
    const onResetFilters = vi.fn();

    const { rerender } = render(
      <KnowledgeFilterPanel
        domains={[{ id: "d-1", name: "Neuroscience", slug: "neuro", nodeCount: 10 }]}
        totalCandidateNodes={15}
        filters={DEFAULT_FILTERS}
        rootNodeTitle={null}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
      />,
    );

    // 5.1 Search Input
    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Plasticity" } });
    expect(onFilterChange).toHaveBeenCalledWith({ search: "Plasticity" });

    // 5.2 Domain Selection
    const domBtn = screen.getByTestId("domain-btn-d-1");
    fireEvent.click(domBtn);
    expect(onFilterChange).toHaveBeenCalledWith({ domainId: "d-1" });

    // 5.3 Node Type Selection
    const claimBtn = screen.getByTestId("node-type-claim-btn");
    fireEvent.click(claimBtn);
    expect(onFilterChange).toHaveBeenCalledWith({ nodeType: "claim" });

    // 5.4 Status Selection
    const verifiedStatusBtn = screen.getByTestId("status-verified-btn");
    fireEvent.click(verifiedStatusBtn);
    expect(onFilterChange).toHaveBeenCalledWith({ status: "verified" });

    // 5.5 Reset Filters CTA
    const resetBtn = screen.getByTestId("reset-filters-btn");
    fireEvent.click(resetBtn);
    expect(onResetFilters).toHaveBeenCalled();

    // 5.6 Progressive Root Active
    rerender(
      <KnowledgeFilterPanel
        domains={[{ id: "d-1", name: "Neuroscience", slug: "neuro", nodeCount: 10 }]}
        totalCandidateNodes={15}
        filters={{ ...DEFAULT_FILTERS, rootNodeId: "root-1", depth: 2 }}
        rootNodeTitle="LTP Root"
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
      />,
    );

    expect(screen.getByTestId("progressive-root-box")).toBeDefined();
    expect(screen.getByText("焦点展开: LTP Root")).toBeDefined();

    // Click depth 3
    const depth3Btn = screen.getByTestId("depth-btn-3");
    fireEvent.click(depth3Btn);
    expect(onFilterChange).toHaveBeenCalledWith({ depth: 3 });

    // Click reset root
    const resetRootBtn = screen.getByTestId("reset-root-btn");
    fireEvent.click(resetRootBtn);
    expect(onFilterChange).toHaveBeenCalledWith({ rootNodeId: null });
  });

  test("6. Node Detail Panel: Fetches GET /api/knowledge/[id], Renders Provenance & 5-Question Audit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/knowledge/node-2")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockNodeDetail,
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    const onSelectNode = vi.fn();
    const onFocusRoot = vi.fn();
    const onDataChanged = vi.fn();
    const onClose = vi.fn();

    render(
      <KnowledgeDetailPanel
        nodeId="node-2"
        domains={[{ id: "dom-1", name: "Neuroscience", slug: "neuro", nodeCount: 2 }]}
        onClose={onClose}
        onSelectNode={onSelectNode}
        onFocusRoot={onFocusRoot}
        onDataChanged={onDataChanged}
      />,
    );

    // Verify 5 core questions rendered
    await waitFor(() => {
      expect(screen.getByTestId("detail-title")).toBeDefined();
    });
    expect(screen.getByText("NMDA Receptor Calcium Flux")).toBeDefined();
    expect(screen.getByText("[AI PROPOSED 85%]")).toBeDefined();
    expect(screen.getByText("Neuroscience")).toBeDefined();

    // Provenance Cards
    expect(screen.getByTestId("provenance-activity-card")).toBeDefined();
    expect(screen.getByText("Read LTP Paper")).toBeDefined();
    expect(screen.getByTestId("provenance-artifact-card")).toBeDefined();
    expect(screen.getByText("LTP Summary Notes.md")).toBeDefined();
    expect(screen.getByTestId("evidence-record-ev-1")).toBeDefined();
    expect(screen.getByText("Extracted passage detailing NMDA Ca2+ channel conductance")).toBeDefined();

    // Connections
    expect(screen.getByText("Long-Term Potentiation")).toBeDefined();

    // Expand as Root CTA
    const expandBtn = screen.getByTestId("expand-as-root-btn");
    fireEvent.click(expandBtn);
    expect(onFocusRoot).toHaveBeenCalledWith("node-2");
  });

  test("7. Node Detail Panel: Explicit Empty State when node has no provenance", async () => {
    const emptyProvenanceDetail: KnowledgeNodeDetailResponse = {
      ...mockNodeDetail,
      provenance: {
        sourceActivity: null,
        sourceArtifact: null,
        evidenceRecords: [],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => emptyProvenanceDetail,
      }),
    );

    render(
      <KnowledgeDetailPanel
        nodeId="node-2"
        domains={[]}
        onClose={vi.fn()}
        onSelectNode={vi.fn()}
        onFocusRoot={vi.fn()}
        onDataChanged={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("empty-provenance-box")).toBeDefined();
    });
    expect(screen.getByText("无直接关联的行为或产出物记录 (手动录入或无溯源)")).toBeDefined();
  });

  test("8. Node Verify & Reject Actions: Calls POST verify/reject and updates state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes("/api/knowledge/node-2/verify") && opts?.method === "POST") {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
        }
        if (url.includes("/api/knowledge/node-2/reject") && opts?.method === "POST") {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
        }
        if (url.includes("/api/knowledge/node-2")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockNodeDetail });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    const onDataChanged = vi.fn();

    render(
      <KnowledgeDetailPanel
        nodeId="node-2"
        domains={[]}
        onClose={vi.fn()}
        onSelectNode={vi.fn()}
        onFocusRoot={vi.fn()}
        onDataChanged={onDataChanged}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("verify-node-btn")).toBeDefined();
    });

    // 8.1 Click Verify
    fireEvent.click(screen.getByTestId("verify-node-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("action-success-alert")).toBeDefined();
    });
    expect(screen.getByText("已成功将节点晋级为已验证事实 [VERIFIED]！")).toBeDefined();
    expect(onDataChanged).toHaveBeenCalled();

    // 8.2 Click Reject
    fireEvent.click(screen.getByTestId("reject-node-btn"));
    await waitFor(() => {
      expect(screen.getByText("已成功否决该 AI 提案节点 [REJECTED]")).toBeDefined();
    });
  });

  test("9. 409 Conflict UX: Verify on non-inferred returns 409 without crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes("/api/knowledge/node-2/verify") && opts?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ error: "invalid_authority_transition", message: "Node is already verified" }),
          });
        }
        if (url.includes("/api/knowledge/node-2")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockNodeDetail });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    render(
      <KnowledgeDetailPanel
        nodeId="node-2"
        domains={[]}
        onClose={vi.fn()}
        onSelectNode={vi.fn()}
        onFocusRoot={vi.fn()}
        onDataChanged={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("verify-node-btn")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("verify-node-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("action-error-alert")).toBeDefined();
    });
    expect(screen.getByText(/409 Conflict/)).toBeDefined();
  });

  test("10. Edge Detail Panel: Fetches GET /api/knowledge/edges/[id], Renders Rationale and Handles Verify/Reject", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes("/api/knowledge/edges/edge-1/verify") && opts?.method === "POST") {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
        }
        if (url.includes("/api/knowledge/edges/edge-1")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockEdgeDetail });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    const onDataChanged = vi.fn();

    render(
      <KnowledgeEdgeDetailPanel
        edgeId="edge-1"
        onClose={vi.fn()}
        onSelectNode={vi.fn()}
        onDataChanged={onDataChanged}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("knowledge-edge-detail-panel")).toBeDefined();
    });

    expect(screen.getByText("Long-Term Potentiation")).toBeDefined();
    expect(screen.getByText("SUPPORTS")).toBeDefined();
    expect(screen.getByText("NMDA Receptor Calcium Flux")).toBeDefined();
    expect(screen.getByText("LTP induction activates NMDA receptors causing calcium influx")).toBeDefined();

    // Verify Edge CTA
    const verifyEdgeBtn = screen.getByTestId("verify-edge-btn");
    fireEvent.click(verifyEdgeBtn);

    await waitFor(() => {
      expect(screen.getByTestId("edge-action-success")).toBeDefined();
    });
    expect(screen.getByText("已成功将关系晋级为已验证事实 [VERIFIED]！")).toBeDefined();
    expect(onDataChanged).toHaveBeenCalled();
  });

  test("11. toFlowEdges Mapping: Converts raw edges to 4-channel ReactFlow edges with custom markers", () => {
    const raw = [
      {
        id: "e-prereq",
        source: "n1",
        target: "n2",
        relationType: "prerequisite" as const,
        verificationStatus: "verified" as const,
        isArchived: false,
        confidence: 1.0,
        sourceType: "user_created" as const,
        sourceId: null,
        provenanceNote: null,
        verifiedAt: null,
        verifiedBy: null,
      },
      {
        id: "e-contains",
        source: "n1",
        target: "n3",
        relationType: "contains" as const,
        verificationStatus: "verified" as const,
        isArchived: false,
        confidence: 1.0,
        sourceType: "user_created" as const,
        sourceId: null,
        provenanceNote: null,
        verifiedAt: null,
        verifiedBy: null,
      },
      {
        id: "e-contradicts",
        source: "n2",
        target: "n3",
        relationType: "contradicts" as const,
        verificationStatus: "verified" as const,
        isArchived: false,
        confidence: 1.0,
        sourceType: "user_created" as const,
        sourceId: null,
        provenanceNote: "Direct conflict",
        verifiedAt: null,
        verifiedBy: null,
      },
    ];

    const flowEdges = toFlowEdges(raw, "e-contains");
    expect(flowEdges).toHaveLength(3);

    // Prerequisite
    expect(flowEdges[0].label).toBe("PREREQUISITE");

    // Contains
    expect(flowEdges[1].label).toBe("CONTAINS");
    expect(flowEdges[1].markerEnd).toBe("url(#knowledge-marker-circle)");
    expect(flowEdges[1].style?.strokeWidth).toBe(2.5); // selected edge

    // Contradicts
    expect(flowEdges[2].label).toBe("CONTRADICTS");
    expect(flowEdges[2].markerEnd).toBe("url(#knowledge-marker-lightning)");
  });

  test("12. Truncation Banner: Displays banner when isTruncated is true", async () => {
    const truncatedGraph: KnowledgeGraphResponse = {
      ...mockGraphData,
      stats: {
        ...mockGraphData.stats,
        isTruncated: true,
        totalNodes: 85,
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => truncatedGraph,
      }),
    );

    render(<KnowledgeMapPage />);

    await waitFor(() => {
      expect(screen.getByTestId("graph-truncated-banner")).toBeDefined();
    });
    expect(screen.getByText(/当前图谱节点较多，已截取前 3 个核心节点/)).toBeDefined();
  });
});
