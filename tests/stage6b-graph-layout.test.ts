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
    expect(graphDepth1.nodes.map((n) => n.id).sort()).toEqual(["n-a", "n-b"]);
    expect(graphDepth1.edges.map((e) => e.id)).toEqual(["e-ab"]);

    // Depth 2 from n-a -> includes n-a, n-b, n-c
    const graphDepth2 = computeKnowledgeGraph(domains, skills, [nA, nB, nC, nD, nUnrelated], edges, {
      rootNodeId: "n-a",
      depth: 2,
    });
    expect(graphDepth2.nodes.map((n) => n.id).sort()).toEqual(["n-a", "n-b", "n-c"]);
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

  test("5. Root Ego Graph Filter Combinations (P1 Root Filter Tests)", () => {
    const rootNode = makeNode("r-1", "Root Algorithm", {
      domainId: "dom-1",
      nodeType: "concept",
      verificationStatus: "verified",
    });

    const inferredChild = makeNode("c-inferred", "Inferred Child", {
      domainId: "dom-1",
      nodeType: "claim",
      verificationStatus: "inferred",
    });

    const foreignDomainChild = makeNode("c-foreign", "Foreign Domain Child", {
      domainId: "dom-2", // Different domain
      nodeType: "concept",
      verificationStatus: "verified",
    });

    const topicChild = makeNode("c-topic", "Topic Child", {
      domainId: "dom-1",
      nodeType: "topic",
      verificationStatus: "verified",
    });

    const searchMatchChild = makeNode("c-search", "Search Alpha Match", {
      domainId: "dom-1",
      nodeType: "concept",
      verificationStatus: "verified",
    });

    const edges = [
      makeEdge("e-1", "r-1", "c-inferred"),
      makeEdge("e-2", "r-1", "c-foreign"),
      makeEdge("e-3", "r-1", "c-topic"),
      makeEdge("e-4", "r-1", "c-search"),
    ];

    const allUniverse = [rootNode, inferredChild, foreignDomainChild, topicChild, searchMatchChild];

    // 5.1 root + status=verified: inferred neighbor c-inferred excluded
    const gStatus = computeKnowledgeGraph(domains, skills, allUniverse, edges, {
      rootNodeId: "r-1",
      depth: 1,
      status: "verified",
    });
    expect(gStatus.nodes.map((n) => n.id)).not.toContain("c-inferred");
    expect(gStatus.nodes.map((n) => n.id)).toContain("r-1");

    // 5.2 root + domainId=dom-1: foreign domain neighbor c-foreign excluded
    const gDomain = computeKnowledgeGraph(domains, skills, allUniverse, edges, {
      rootNodeId: "r-1",
      depth: 1,
      domainId: "dom-1",
    });
    expect(gDomain.nodes.map((n) => n.id)).not.toContain("c-foreign");
    expect(gDomain.nodes.map((n) => n.id)).toContain("r-1");

    // 5.3 root + nodeType=claim: non-claim nodes (concept, topic) excluded
    const gType = computeKnowledgeGraph(domains, skills, allUniverse, edges, {
      rootNodeId: "r-1",
      depth: 1,
      nodeType: "claim",
    });
    expect(gType.nodes.map((n) => n.id)).toEqual(["c-inferred"]);

    // 5.4 root + search="Alpha": nonmatching nodes excluded
    const gSearch = computeKnowledgeGraph(domains, skills, allUniverse, edges, {
      rootNodeId: "r-1",
      depth: 1,
      search: "Alpha",
    });
    expect(gSearch.nodes.map((n) => n.id)).toEqual(["c-search"]);
  });

  test("6. Shuffled-Input Invariance & Absolute Determinism (P1 Determinism Proof)", () => {
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

  test("7. Invalid Depth & Missing Root Validations", () => {
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
