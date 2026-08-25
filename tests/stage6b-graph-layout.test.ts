import { describe, expect, test } from "vitest";
import { computeKnowledgeGraph, InvalidDepthError } from "@/lib/knowledge/graph-layout";
import { NotFoundError } from "@/lib/knowledge/authority-service";
import type { KnowledgeNode, KnowledgeEdge } from "@/lib/knowledge/types";
import type { Domain, SkillState } from "@/lib/store/types";

describe("Stage 6B — Knowledge Graph Layout & Progressive Query (Unit Tests)", () => {
  const domains: Domain[] = [
    { id: "dom-1", name: "Bioinformatics", slug: "bio", parentId: null },
    { id: "dom-2", name: "AI Systems", slug: "ai", parentId: null },
  ];

  const skills: SkillState[] = [
    { id: "sk-1", name: "Genomics", aliases: [], xp: 100, level: 1, masteryLevel: 1, masteryConfidence: 1, lastUsedAt: null },
  ];

  function makeNode(id: string, title: string, opts: Partial<KnowledgeNode> = {}): KnowledgeNode {
    return {
      id,
      userId: "u-1",
      domainId: opts.domainId ?? "dom-1",
      skillId: opts.skillId ?? null,
      nodeType: opts.nodeType ?? "concept",
      title,
      normalizedTitle: title.toLowerCase(),
      description: null,
      verificationStatus: opts.verificationStatus ?? "verified",
      confidence: opts.confidence ?? 1.0,
      sourceType: opts.sourceType ?? "user_created",
      sourceId: null,
      verifiedAt: opts.verifiedAt ?? new Date().toISOString(),
      verifiedBy: "u-1",
      isArchived: opts.isArchived ?? false,
      archivedAt: null,
      metadata: {},
      lastReviewedAt: null,
      createdAt: opts.createdAt ?? "2026-01-01T00:00:00.000Z",
      updatedAt: opts.updatedAt ?? "2026-01-01T00:00:00.000Z",
    };
  }

  function makeEdge(id: string, source: string, target: string, opts: Partial<KnowledgeEdge> = {}): KnowledgeEdge {
    return {
      id,
      userId: "u-1",
      sourceNodeId: source,
      targetNodeId: target,
      relationType: opts.relationType ?? "prerequisite",
      verificationStatus: opts.verificationStatus ?? "verified",
      confidence: opts.confidence ?? 1.0,
      sourceType: "user_created",
      sourceId: null,
      provenanceNote: opts.provenanceNote ?? null,
      verifiedAt: new Date().toISOString(),
      verifiedBy: "u-1",
      isArchived: opts.isArchived ?? false,
      archivedAt: null,
      metadata: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  test("1. Initial Viewport: Deterministic Ordering (degree DESC, updated_at DESC, id ASC)", () => {
    // Node A: 0 edges, updated at 2026-01-01
    const nodeA = makeNode("node-a", "Node A", { updatedAt: "2026-01-01T00:00:00.000Z" });
    // Node B: 2 edges, updated at 2026-01-01
    const nodeB = makeNode("node-b", "Node B", { updatedAt: "2026-01-01T00:00:00.000Z" });
    // Node C: 1 edge, updated at 2026-01-05
    const nodeC = makeNode("node-c", "Node C", { updatedAt: "2026-01-05T00:00:00.000Z" });
    // Node D: 1 edge, updated at 2026-01-02
    const nodeD = makeNode("node-d", "Node D", { updatedAt: "2026-01-02T00:00:00.000Z" });

    const edges = [
      makeEdge("e-1", "node-b", "node-c"),
      makeEdge("e-2", "node-b", "node-d"),
    ];

    const graph = computeKnowledgeGraph(domains, skills, [nodeA, nodeB, nodeC, nodeD], edges);

    // Expected order:
    // 1. Node B (degree 2)
    // 2. Node C (degree 1, updated 2026-01-05)
    // 3. Node D (degree 1, updated 2026-01-02)
    // 4. Node A (degree 0, updated 2026-01-01)
    expect(graph.nodes.map((n) => n.id)).toEqual(["node-b", "node-c", "node-d", "node-a"]);
    expect(graph.stats.isTruncated).toBe(false);
  });

  test("2. Initial Viewport Truncation: limits to bounded limit and sets isTruncated: true", () => {
    const nodes = Array.from({ length: 15 }, (_, i) =>
      makeNode(`node-${String(i).padStart(2, "0")}`, `Node ${i}`),
    );

    const graph = computeKnowledgeGraph(domains, skills, nodes, [], { limit: 10 });
    expect(graph.nodes.length).toBe(10);
    expect(graph.stats.isTruncated).toBe(true);
    expect(graph.stats.totalNodes).toBe(15);
  });

  test("3. Progressive Loading (rootNodeId): traverses only active edges up to depth hops", () => {
    // A -> B -> C -> D
    const nA = makeNode("n-a", "Root A");
    const nB = makeNode("n-b", "Child B");
    const nC = makeNode("n-c", "Grandchild C");
    const nD = makeNode("n-d", "Great-Grandchild D");
    const nUnrelated = makeNode("n-unrelated", "Unrelated Node");

    const edges = [
      makeEdge("e-ab", "n-a", "n-b"),
      makeEdge("e-bc", "n-b", "n-c"),
      makeEdge("e-cd", "n-c", "n-d"),
    ];

    // Depth 1 from n-a -> includes n-a, n-b
    const graphDepth1 = computeKnowledgeGraph(domains, skills, [nA, nB, nC, nD, nUnrelated], edges, {
      rootNodeId: "n-a",
      depth: 1,
    });
    expect(graphDepth1.nodes.map((n) => n.id).sort()).toEqual(["n-a", "n-b"]);
    expect(graphDepth1.edges.map((e) => e.id)).toEqual(["e-ab"]);

    // Depth 2 from n-a -> includes n-a, n-b, n-c
    const graphDepth2 = computeKnowledgeGraph(domains, skills, [nA, nB, nC, nD, nUnrelated], edges, {
      rootNodeId: "n-a",
      depth: 2,
    });
    expect(graphDepth2.nodes.map((n) => n.id).sort()).toEqual(["n-a", "n-b", "n-c"]);
  });

  test("4. Progressive Active-Edge Rule: Strictly excludes rejected, superseded and archived edges during traversal (P2-1)", () => {
    const nA = makeNode("n-a", "Root A");
    const nB = makeNode("n-b", "Active Child B");
    const nC = makeNode("n-c", "Rejected Child C");
    const nD = makeNode("n-d", "Archived Child D");

    const edges = [
      makeEdge("e-ab", "n-a", "n-b", { verificationStatus: "verified" }),
      makeEdge("e-ac", "n-a", "n-c", { verificationStatus: "rejected" }),
      makeEdge("e-ad", "n-a", "n-d", { verificationStatus: "verified", isArchived: true }),
    ];

    const graph = computeKnowledgeGraph(domains, skills, [nA, nB, nC, nD], edges, {
      rootNodeId: "n-a",
      depth: 1,
    });

    // Only active relation e-ab is traversed; n-c and n-d are not reached
    expect(graph.nodes.map((n) => n.id)).toEqual(["n-a", "n-b"]);
    expect(graph.edges.map((e) => e.id)).toEqual(["e-ab"]);
  });

  test("5. Invalid Depth & Missing Root Validations", () => {
    const nA = makeNode("n-a", "Root A");

    // Invalid depths: < 1 or > 3 or non-integer
    expect(() =>
      computeKnowledgeGraph(domains, skills, [nA], [], { rootNodeId: "n-a", depth: 0 }),
    ).toThrow(InvalidDepthError);

    expect(() =>
      computeKnowledgeGraph(domains, skills, [nA], [], { rootNodeId: "n-a", depth: 4 }),
    ).toThrow(InvalidDepthError);

    // Missing/foreign rootNodeId -> NotFoundError
    expect(() =>
      computeKnowledgeGraph(domains, skills, [nA], [], { rootNodeId: "nonexistent-root", depth: 1 }),
    ).toThrow(NotFoundError);
  });
});
