// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import KnowledgeMapPage from "@/app/knowledge/page";
import LinkedSkillSummary from "@/app/knowledge/components/LinkedSkillSummary";
import { layoutKnowledgeNodes, filterKnowledgeEdges } from "@/app/knowledge/components/canvas-layout";
import { getEdgeVisual } from "@/app/knowledge/components/presentation";
import type { KnowledgeGraphResponse, KnowledgeNodeDetailResponse } from "@/lib/knowledge/types";
import type { KnowledgeGraphCanvasProps } from "@/app/knowledge/components/KnowledgeGraphCanvas";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/knowledge/components/KnowledgeGraphCanvas", () => ({
  default: (props: KnowledgeGraphCanvasProps) => <div data-testid="canvas">
    {props.nodes.map((node) => <button key={node.id} onClick={() => props.onSelectNode(node.id)}>{node.data.title}</button>)}
    {props.rawEdges.map((edge) => <button key={edge.id} onClick={() => props.onSelectEdge(edge.id)}>edge:{edge.id}</button>)}
  </div>,
}));

const node = (id: string, overrides: Partial<KnowledgeGraphResponse["nodes"][number]> = {}): KnowledgeGraphResponse["nodes"][number] => ({
  id, title: `知识 ${id}`, nodeType: "concept", domainId: "domain-a", domainName: "科研", skillId: null, skillName: null,
  verificationStatus: "verified", isArchived: false, confidence: 1, sourceType: "user_created", sourceId: null,
  inboundEdgeCount: 0, outboundEdgeCount: 0, position: { x: 10, y: 20 }, ...overrides,
});
const graph: KnowledgeGraphResponse = {
  domains: [{ id: "domain-a", name: "科研", slug: "research", nodeCount: 2 }],
  nodes: [node("a"), node("b", { verificationStatus: "inferred", confidence: 0.8 })],
  edges: [
    { id: "ab", source: "a", target: "b", relationType: "prerequisite", verificationStatus: "inferred", isArchived: false, confidence: 0.8, sourceType: "user_created", sourceId: null, provenanceNote: null, verifiedAt: null, verifiedBy: null },
    { id: "ba", source: "b", target: "a", relationType: "supports", verificationStatus: "verified", isArchived: false, confidence: 1, sourceType: "user_created", sourceId: null, provenanceNote: null, verifiedAt: null, verifiedBy: null },
  ],
  stats: { totalNodes: 2, verifiedNodes: 1, inferredNodes: 1, totalEdges: 2, verifiedEdges: 1, inferredEdges: 1, isTruncated: false },
};
const detail = (id: string): KnowledgeNodeDetailResponse => ({
  node: { ...node(id, { verificationStatus: "inferred" }), description: "定义", verifiedAt: null, verifiedBy: null, metadata: {}, lastReviewedAt: null, createdAt: "2026-09-06", updatedAt: "2026-09-06" },
  provenance: { sourceActivity: null, sourceArtifact: { id: "artifact-a", title: "研究笔记", type: "document" }, evidenceRecords: [{ id: "evidence-a", type: "summary", content: "概念总结", verified: false, createdAt: "2026-09-06" }] },
  connections: { inbound: [], outbound: [] },
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function mockApi() {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("/api/knowledge/edges/")) return json({ edge: { ...graph.edges[0], sourceNodeId: "a", sourceNodeTitle: "知识 a", targetNodeId: "b", targetNodeTitle: "知识 b" }, provenance: { sourceActivity: null, sourceArtifact: null } });
    if (url === "/api/knowledge/a" || url === "/api/knowledge/b") return json(detail(url.slice(-1)));
    return json(graph);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: (media: string) => ({ matches: false, media, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Phase 6 view-only layout and relation semantics", () => {
  it("clusters by identity and type, stays stable under input reordering, and does not mutate input", () => {
    const nodes = [node("a"), node("b"), node("c", { domainId: "domain-b" }), node("d", { domainId: null }), node("e", { nodeType: "claim" })];
    const snapshot = JSON.stringify(nodes);
    const result = layoutKnowledgeNodes(nodes, "clustered");
    expect(result.clusters).toHaveLength(4);
    expect(result).toEqual(layoutKnowledgeNodes([...nodes].reverse(), "clustered"));
    expect(new Set(result.nodes.map((n) => JSON.stringify(n.position))).size).toBe(nodes.length);
    for (const group of result.clusters) {
      for (const other of result.clusters) {
        if (group.id !== other.id) expect(group.x + group.width <= other.x || other.x + other.width <= group.x || group.y + group.height <= other.y || other.y + other.height <= group.y).toBe(true);
      }
    }
    expect(JSON.stringify(nodes)).toBe(snapshot);
    expect(layoutKnowledgeNodes(nodes, "relations").nodes).toBe(nodes);
    expect(layoutKnowledgeNodes([], "clustered").clusters).toEqual([]);
  });
  it("filters loaded edges independently while dropping missing endpoints", () => {
    expect(filterKnowledgeEdges(graph.edges, graph.nodes, "verified", "all").map((e) => e.id)).toEqual(["ba"]);
    expect(filterKnowledgeEdges(graph.edges, graph.nodes, "inferred", "supports")).toEqual([]);
    expect(filterKnowledgeEdges(graph.edges, [graph.nodes[0]], "all", "all")).toEqual([]);
    const archived = [{ ...graph.edges[0], isArchived: true }];
    expect(filterKnowledgeEdges(archived, graph.nodes, "archived", "all")).toHaveLength(1);
    expect(filterKnowledgeEdges(archived, graph.nodes, "inferred", "all")).toHaveLength(0);
  });
  it("preserves direction, authority and historical labels without motion", () => {
    for (const relation of ["prerequisite", "contains", "supports", "contradicts", "relates_to"] as const) {
      for (const status of ["verified", "inferred", "rejected", "superseded"] as const) {
        const visual = getEdgeVisual(relation, status, 0.8);
        expect(visual.animated).toBe(false);
        expect(visual.isSymmetric).toBe(relation === "contradicts" || relation === "relates_to");
        if (visual.isSymmetric) expect(["arrow", "hollow-arrow"]).not.toContain(visual.marker);
        else expect(["arrow", "hollow-arrow"]).toContain(visual.marker);
        if (status === "rejected" || status === "superseded") { expect(visual.label).toContain(status.toUpperCase()); expect(visual.label).not.toContain("VERIFIED"); }
      }
    }
    expect(getEdgeVisual("supports", "verified", 1, true).label).toContain("ARCHIVED");
  });
});

describe("Phase 6 workspace interactions", () => {
  it("uses one shared inspector across node, edge and node selections; filters clear hidden edge details", async () => {
    mockApi(); render(<KnowledgeMapPage />);
    fireEvent.click(await screen.findByRole("button", { name: "知识 a" }));
    expect(await screen.findByTestId("detail-title")).toHaveProperty("textContent", "知识 a");
    expect(screen.getAllByTestId("inspector-drawer-root")).toHaveLength(1);
    expect(screen.getByText("研究笔记")).toBeTruthy();
    expect(screen.getByText("未验证证据")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "edge:ab" }));
    await screen.findByTestId("knowledge-edge-detail-panel");
    expect(screen.queryByTestId("knowledge-detail-panel")).toBeNull();
    expect(screen.getAllByTestId("inspector-drawer-root")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("关系权威筛选"), { target: { value: "verified" } });
    expect(screen.queryByRole("button", { name: "edge:ab" })).toBeNull();
    expect(screen.queryByTestId("inspector-drawer-root")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "知识 b" }));
    expect(await screen.findByTestId("detail-title")).toHaveProperty("textContent", "知识 b");
  });
  it("cancel and Escape in shared metadata modal do not write or dismiss the parent inspector", async () => {
    const fetcher = mockApi(); render(<KnowledgeMapPage />);
    fireEvent.click(await screen.findByRole("button", { name: "知识 a" }));
    fireEvent.click(await screen.findByTestId("open-edit-modal-btn"));
    const modal = screen.getByRole("dialog", { name: "编辑知识节点元数据" });
    fireEvent.change(within(modal).getByTestId("edit-node-title-input"), { target: { value: "未保存" } });
    fireEvent.keyDown(modal, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "编辑知识节点元数据" })).toBeNull();
    expect(screen.getByTestId("inspector-drawer-root")).toBeTruthy();
    fireEvent.click(screen.getByTestId("open-edit-modal-btn"));
    expect(screen.getByTestId("edit-node-title-input")).toHaveProperty("value", "知识 a");
    fireEvent.click(screen.getByTestId("cancel-edit-metadata-btn"));
    expect(fetcher.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it("list view provides nodes and edges, and mobile filters mount one filter instance", async () => {
    mockApi(); render(<KnowledgeMapPage />); await screen.findByTestId("canvas");
    fireEvent.click(screen.getByRole("button", { name: "切换列表" }));
    expect(screen.queryByTestId("canvas")).toBeNull();
    expect(screen.getByRole("heading", { name: "知识节点" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "知识关系" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开筛选面板" }));
    expect(screen.getAllByTestId("search-input")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "知识筛选" })).toBeTruthy();
  });
  it("ignores late graph responses from obsolete filters", async () => {
    let resolveOld!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; })).mockResolvedValue(json(graph));
    vi.stubGlobal("fetch", fetcher); render(<KnowledgeMapPage />);
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "new" } });
    await screen.findByTestId("canvas");
    resolveOld(json({ ...graph, nodes: [], stats: { ...graph.stats, totalNodes: 0 } }));
    await waitFor(() => expect(screen.queryByTestId("empty-graph-state")).toBeNull());
    expect(screen.getByRole("button", { name: "知识 a" })).toBeTruthy();
  });
  it("reads actual linked skill state and never fabricates mastery after an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ skill: { id: "s", name: "统计", xp: 123, nextLevelXp: 300, masteryLevel: 6, masteryConfidence: 0.8 } })).mockResolvedValueOnce(json({}, 500)));
    const { rerender } = render(<LinkedSkillSummary skillId="s" />);
    await screen.findByText("统计");
    expect(screen.getByTestId("xp-progress").getAttribute("data-current")).toBe("123");
    expect(screen.getByText("M6")).toBeTruthy();
    rerender(<LinkedSkillSummary skillId="other" />);
    expect(screen.queryByText("M6")).toBeNull();
    await screen.findByText("关联技能状态暂不可用");
    expect(screen.queryByTestId("xp-progress")).toBeNull();
  });
});

describe("Phase 6 scope and token gates", () => {
  it("uses existing tokens, no private colors, raw z-layers or knowledge mastery", () => {
    const root = path.resolve("src/app/knowledge");
    const files = fs.readdirSync(root, { recursive: true }).map(String).filter((file) => /\.(tsx?|css)$/.test(file));
    const tokens = fs.readFileSync("src/styles/design-tokens.css", "utf8");
    for (const file of files) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      for (const [, token] of text.matchAll(/var\((--[\w-]+)\)/g)) expect(tokens, `${file}: ${token}`).toContain(`${token}:`);
      expect(text, file).not.toMatch(/#[0-9a-f]{3,8}\b|\bz-\d+\b|var\(--(?:gold|border-gold|text-gold)-/i);
      if (file !== "components/LinkedSkillSummary.tsx" && file !== "components\\LinkedSkillSummary.tsx") expect(text, file).not.toMatch(/<MasteryBadge|<XPProgress/);
    }
  });
  it("keeps all frozen backend, previous pages, primitives and dependencies unchanged from the Phase 6 baseline", () => {
    const base = "a93e2bcada3eca63c3d69ecc633fd50df0f54e94";
    // Includes committed and uncommitted tracked changes, not merely HEAD.
    const files = execFileSync("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
    for (const file of files) expect(file).not.toMatch(/^(src\/lib\/|src\/app\/api\/|supabase\/|src\/components\/|src\/app\/(skills|quests|dashboard)\/|src\/proxy\.ts|package\.json|pnpm-lock\.yaml)/);
  });
});
