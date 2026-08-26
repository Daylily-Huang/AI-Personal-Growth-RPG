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
    const nodeA = makeNode("node-a", "Node A", { updatedAt: "2026-01-01T00:00:00.000Z" });
    const nodeB = makeNode("node-b", "Node B", { updatedAt: "2026-01-01T00:00:00.000Z" });
    const nodeC = makeNode("node-c", "Node C", { updatedAt: "2026-01-05T00:00:00.000Z" });
    const nodeD = makeNode("node-d", "Node D", { updatedAt: "2026-01-02T00:00:00.000Z" });

    const edges = [
      makeEdge("e-1", "node-b", "node-c"),
      makeEdge("e-2", "node-b", "node-d"),
    ];

    const graph = computeKnowledgeGraph(domains, skills, [nodeA, nodeB, nodeC, nodeD], edges);

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

  test("3. Progressive Loading (rootNodeId): traverses active edges up to depth hops", () => {
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
    expect(graphDepth1.nodes.map((n) => n.id)).toEqual(["n-a", "n-b"]);
    expect(graphDepth1.edges.map((e) => e.id)).toEqual(["e-ab"]);

    // Depth 2 from n-a -> includes n-a, n-b, n-c
    const graphDepth2 = computeKnowledgeGraph(domains, skills, [nA, nB, nC, nD, nUnrelated], edges, {
      rootNodeId: "n-a",
      depth: 2,
    });
    expect(graphDepth2.nodes.map((n) => n.id)).toEqual(["n-a", "n-b", "n-c"]);
  });

  test("4. Progressive Active-Edge Rule: Strictly excludes rejected, superseded and archived edges during traversal", () => {
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

    expect(graph.nodes.map((n) => n.id)).toEqual(["n-a", "n-b"]);
    expect(graph.edges.map((e) => e.id)).toEqual(["e-ab"]);
  });

  test("5. P1 Hidden-Bridge Elimination Regressions across all Filter Dimensions", () => {
    // 5.1 Domain Hidden Bridge: A(dom-1) -> B(dom-2) -> C(dom-1)
    const domA = makeNode("dom-a", "Domain Match A", { domainId: "dom-1" });
    const domB = makeNode("dom-b", "Domain Bridge B", { domainId: "dom-2" });
    const domC = makeNode("dom-c", "Domain Match C", { domainId: "dom-1" });
    const domEdges = [
      makeEdge("e-dom-ab", "dom-a", "dom-b"),
      makeEdge("e-dom-bc", "dom-b", "dom-c"),
    ];

    const gDom = computeKnowledgeGraph(domains, skills, [domA, domB, domC], domEdges, {
      rootNodeId: "dom-a",
      depth: 2,
      domainId: "dom-1",
    });
    // B is excluded by filter; C MUST NOT be reached through B!
    expect(gDom.nodes.map((n) => n.id)).toEqual(["dom-a"]);
    expect(gDom.edges).toHaveLength(0);

    // 5.2 Status Hidden Bridge: verified A -> inferred B -> verified C
    const stA = makeNode("st-a", "Verified Node A", { verificationStatus: "verified" });
    const stB = makeNode("st-b", "Inferred Node B", { verificationStatus: "inferred" });
    const stC = makeNode("st-c", "Verified Node C", { verificationStatus: "verified" });
    const stEdges = [
      makeEdge("e-st-ab", "st-a", "st-b"),
      makeEdge("e-st-bc", "st-b", "st-c"),
    ];

    const gStatus = computeKnowledgeGraph(domains, skills, [stA, stB, stC], stEdges, {
      rootNodeId: "st-a",
      depth: 2,
      status: "verified",
    });
    // Inferred B is excluded; verified C MUST NOT be reached through inferred B!
    expect(gStatus.nodes.map((n) => n.id)).toEqual(["st-a"]);
    expect(gStatus.edges).toHaveLength(0);

    // 5.3 NodeType Hidden Bridge: claim A -> concept B -> claim C
    const typeA = makeNode("type-a", "Claim Node A", { nodeType: "claim" });
    const typeB = makeNode("type-b", "Concept Bridge B", { nodeType: "concept" });
    const typeC = makeNode("type-c", "Claim Node C", { nodeType: "claim" });
    const typeEdges = [
      makeEdge("e-type-ab", "type-a", "type-b"),
      makeEdge("e-type-bc", "type-b", "type-c"),
    ];

    const gType = computeKnowledgeGraph(domains, skills, [typeA, typeB, typeC], typeEdges, {
      rootNodeId: "type-a",
      depth: 2,
      nodeType: "claim",
    });
    // Concept B is excluded; claim C MUST NOT be reached through concept B!
    expect(gType.nodes.map((n) => n.id)).toEqual(["type-a"]);
    expect(gType.edges).toHaveLength(0);

    // 5.4 Search Hidden Bridge: Alpha A -> Beta B -> Alpha C
    const srchA = makeNode("srch-a", "Alpha Concept A");
    const srchB = makeNode("srch-b", "Beta Concept B");
    const srchC = makeNode("srch-c", "Alpha Concept C");
    const srchEdges = [
      makeEdge("e-srch-ab", "srch-a", "srch-b"),
      makeEdge("e-srch-bc", "srch-b", "srch-c"),
    ];

    const gSearch = computeKnowledgeGraph(domains, skills, [srchA, srchB, srchC], srchEdges, {
      rootNodeId: "srch-a",
      depth: 2,
      search: "Alpha",
    });
    // Beta B is excluded by search; Alpha C MUST NOT be reached through Beta B!
    expect(gSearch.nodes.map((n) => n.id)).toEqual(["srch-a"]);
    expect(gSearch.edges).toHaveLength(0);
  });

  test("6. Root Filter Mismatch Semantics: Root anchor remains visible while expanded neighbors strictly satisfy filters", () => {
    // Root is domain-2, Child is domain-1, Grandchild is domain-1
    const rootForeign = makeNode("r-foreign", "Foreign Root", { domainId: "dom-2" });
    const childMatch = makeNode("c-match", "Matching Child", { domainId: "dom-1", updatedAt: "2026-01-05T00:00:00.000Z" });
    const grandMatch = makeNode("g-match", "Matching Grandchild", { domainId: "dom-1", updatedAt: "2026-01-02T00:00:00.000Z" });

    const edges = [
      makeEdge("e-rc", "r-foreign", "c-match"),
      makeEdge("e-cg", "c-match", "g-match"),
    ];

    const graph = computeKnowledgeGraph(domains, skills, [rootForeign, childMatch, grandMatch], edges, {
      rootNodeId: "r-foreign",
      depth: 2,
      domainId: "dom-1",
    });

    // Root is preserved as the focal anchor at index 0; expanded neighbors childMatch and grandMatch match domain-1
    expect(graph.nodes.map((n) => n.id)).toEqual(["r-foreign", "c-match", "g-match"]);
    expect(graph.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(graph.edges.map((e) => e.id)).toEqual(["e-cg", "e-rc"]);
  });

  test("7. P1 Root Anchor Survival Under Truncation & Low-Degree Root", () => {
    // Construct root R with low degree (degree=1) and older updatedAt
    const rootR = makeNode("root-r", "Root Low Rank R", {
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Multiple neighbors with higher degree and newer updatedAt
    const highA = makeNode("high-a", "High Degree Neighbor A", {
      updatedAt: "2026-01-10T00:00:00.000Z",
    });
    const highB = makeNode("high-b", "High Degree Neighbor B", {
      updatedAt: "2026-01-08T00:00:00.000Z",
    });
    const highC = makeNode("high-c", "High Degree Neighbor C", {
      updatedAt: "2026-01-06T00:00:00.000Z",
    });
    const extra1 = makeNode("extra-1", "Extra Connecting Node 1");
    const extra2 = makeNode("extra-2", "Extra Connecting Node 2");

    const edges = [
      makeEdge("e-ra", "root-r", "high-a"),
      makeEdge("e-rb", "root-r", "high-b"),
      makeEdge("e-rc", "root-r", "high-c"),
      // Add extra edges to high-a and high-b to elevate their degrees significantly
      makeEdge("e-a1", "high-a", "extra-1"),
      makeEdge("e-a2", "high-a", "extra-2"),
      makeEdge("e-b1", "high-b", "extra-1"),
    ];

    // A. limit = 1: MUST return exactly [root-r] with position (0,0) and isTruncated = true
    const gLim1 = computeKnowledgeGraph(
      domains,
      skills,
      [rootR, highA, highB, highC, extra1, extra2],
      edges,
      { rootNodeId: "root-r", depth: 1, limit: 1 },
    );
    expect(gLim1.nodes.map((n) => n.id)).toEqual(["root-r"]);
    expect(gLim1.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(gLim1.stats.isTruncated).toBe(true);
    expect(gLim1.stats.totalNodes).toBe(4); // root-r + 3 depth-1 neighbors

    // B. limit = 2: MUST return [root-r, high-a] (highest ranked neighbor)
    const gLim2 = computeKnowledgeGraph(
      domains,
      skills,
      [rootR, highA, highB, highC, extra1, extra2],
      edges,
      { rootNodeId: "root-r", depth: 1, limit: 2 },
    );
    expect(gLim2.nodes.map((n) => n.id)).toEqual(["root-r", "high-a"]);
    expect(gLim2.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(gLim2.stats.isTruncated).toBe(true);

    // C. limit = 4: returns all 4 reached nodes
    const gLim4 = computeKnowledgeGraph(
      domains,
      skills,
      [rootR, highA, highB, highC, extra1, extra2],
      edges,
      { rootNodeId: "root-r", depth: 1, limit: 4 },
    );
    expect(gLim4.nodes.map((n) => n.id)).toEqual(["root-r", "high-a", "high-b", "high-c"]);
    expect(gLim4.stats.isTruncated).toBe(false);
  });

  test("8. Shuffled-Input Invariance & Absolute Determinism (P1 Determinism Proof)", () => {
    // Generate 20 interconnected nodes
    const nodes = Array.from({ length: 20 }, (_, i) =>
      makeNode(`node-${String(i).padStart(2, "0")}`, `Node ${i}`, {
        updatedAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );

    const edges: KnowledgeEdge[] = [];
    for (let i = 0; i < 15; i++) {
      edges.push(
        makeEdge(
          `edge-${String(i).padStart(2, "0")}`,
          nodes[i].id,
          nodes[(i + 1) % nodes.length].id,
        ),
      );
      if (i % 2 === 0) {
        edges.push(
          makeEdge(
            `edge-cross-${String(i).padStart(2, "0")}`,
            nodes[i].id,
            nodes[(i + 3) % nodes.length].id,
          ),
        );
      }
    }

    // Compute baseline graph
    const baseline = computeKnowledgeGraph(domains, skills, nodes, edges, {
      rootNodeId: "node-00",
      depth: 2,
      limit: 10,
    });

    // Run 10 iterations with completely shuffled nodes and edges
    for (let iter = 0; iter < 10; iter++) {
      const shuffledNodes = [...nodes].sort(() => Math.random() - 0.5);
      const shuffledEdges = [...edges].sort(() => Math.random() - 0.5);

      const trial = computeKnowledgeGraph(domains, skills, shuffledNodes, shuffledEdges, {
        rootNodeId: "node-00",
        depth: 2,
        limit: 10,
      });

      expect(trial.nodes.map((n) => n.id)).toEqual(baseline.nodes.map((n) => n.id));
      expect(trial.edges.map((e) => e.id)).toEqual(baseline.edges.map((e) => e.id));
      expect(trial.stats.isTruncated).toBe(baseline.stats.isTruncated);
      expect(trial.nodes.map((n) => n.position)).toEqual(baseline.nodes.map((n) => n.position));
    }
  });

  test("9. Invalid Depth & Missing Root Validations", () => {
    const nA = makeNode("n-a", "Root A");

    expect(() =>
      computeKnowledgeGraph(domains, skills, [nA], [], { rootNodeId: "n-a", depth: 0 }),
    ).toThrow(InvalidDepthError);

    expect(() =>
      computeKnowledgeGraph(domains, skills, [nA], [], { rootNodeId: "n-a", depth: 4 }),
    ).toThrow(InvalidDepthError);

    expect(() =>
      computeKnowledgeGraph(domains, skills, [nA], [], { rootNodeId: "nonexistent-root", depth: 1 }),
    ).toThrow(NotFoundError);
  });
});
