// src/lib/knowledge/graph-layout.ts
// Stage 6B Deterministic Progressive Knowledge Graph Layout & Ego-Graph Traversal

import type { Domain, SkillState } from "@/lib/store/types";
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphQueryOptions,
  KnowledgeGraphResponse,
} from "./types";
import { NotFoundError } from "./authority-service";

export class InvalidDepthError extends Error {
  readonly code = "invalid_depth";
  constructor(message = "depth must be an integer between 1 and 3") {
    super(message);
    this.name = "InvalidDepthError";
  }
}

/**
 * Pure function to compute progressive sub-graph, deterministic layout coordinates,
 * and exact epistemic counts. Completely invariant to input array ordering/shuffling.
 */
export function computeKnowledgeGraph(
  domains: Domain[],
  skills: SkillState[],
  allNodes: KnowledgeNode[],
  allEdges: KnowledgeEdge[],
  options: KnowledgeGraphQueryOptions = {},
): KnowledgeGraphResponse {
  const statusFilter = options.status ?? "all";
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 100);

  // 1. Initial filter on raw nodes (Candidate Universe)
  let candidateNodes = allNodes;

  if (statusFilter === "archived") {
    candidateNodes = candidateNodes.filter((n) => n.isArchived);
  } else if (statusFilter === "verified") {
    candidateNodes = candidateNodes.filter(
      (n) => n.verificationStatus === "verified" && !n.isArchived,
    );
  } else if (statusFilter === "inferred") {
    candidateNodes = candidateNodes.filter(
      (n) => n.verificationStatus === "inferred" && !n.isArchived,
    );
  } else {
    // "all" active nodes
    candidateNodes = candidateNodes.filter(
      (n) =>
        (n.verificationStatus === "inferred" || n.verificationStatus === "verified") &&
        !n.isArchived,
    );
  }

  if (options.domainId) {
    candidateNodes = candidateNodes.filter((n) => n.domainId === options.domainId);
  }

  if (options.nodeType) {
    candidateNodes = candidateNodes.filter((n) => n.nodeType === options.nodeType);
  }

  if (options.search && options.search.trim().length > 0) {
    const q = options.search.trim().toLowerCase();
    candidateNodes = candidateNodes.filter((n) => n.title.toLowerCase().includes(q));
  }

  const candidateNodeIdSet = new Set(candidateNodes.map((n) => n.id));
  const allNodesMap = new Map(allNodes.map((n) => [n.id, n]));

  // 2. Filter Active Edges for Traversal (P2-1)
  // Progressive graph traversal follows ONLY active edges (inferred/verified and NOT archived)
  const activeEdges = allEdges.filter(
    (e) =>
      (e.verificationStatus === "inferred" || e.verificationStatus === "verified") &&
      !e.isArchived,
  );

  // Pre-calculate active degree for all nodes across activeEdges
  const degreeMap = new Map<string, number>();
  for (const n of allNodes) {
    degreeMap.set(n.id, 0);
  }
  for (const e of activeEdges) {
    if (degreeMap.has(e.sourceNodeId)) {
      degreeMap.set(e.sourceNodeId, (degreeMap.get(e.sourceNodeId) ?? 0) + 1);
    }
    if (degreeMap.has(e.targetNodeId)) {
      degreeMap.set(e.targetNodeId, (degreeMap.get(e.targetNodeId) ?? 0) + 1);
    }
  }

  // Build deterministic adjacency mapping: nodeId -> sorted list of neighborIds
  const adjMap = new Map<string, Set<string>>();
  for (const n of allNodes) {
    adjMap.set(n.id, new Set<string>());
  }
  for (const e of activeEdges) {
    adjMap.get(e.sourceNodeId)?.add(e.targetNodeId);
    adjMap.get(e.targetNodeId)?.add(e.sourceNodeId);
  }

  let finalNodes: KnowledgeNode[] = [];
  let isTruncated = false;

  // 3. Progressive k-hop ego-graph expansion (when rootNodeId is specified)
  if (options.rootNodeId) {
    const rootNode = allNodesMap.get(options.rootNodeId);
    if (!rootNode) {
      throw new NotFoundError(`Root node ${options.rootNodeId} not found`);
    }

    const depth = options.depth ?? 1;
    if (!Number.isInteger(depth) || depth < 1 || depth > 3) {
      throw new InvalidDepthError("depth must be an integer between 1 and 3");
    }

    // Deterministic BFS active-edge traversal starting from rootNodeId
    const visited = new Set<string>([rootNode.id]);
    let currentLevel = [rootNode.id];

    for (let d = 0; d < depth; d++) {
      const nextLevelSet = new Set<string>();
      // Sort current level to maintain absolute determinism
      const sortedCurrentLevel = [...currentLevel].sort((a, b) => a.localeCompare(b));

      for (const nodeId of sortedCurrentLevel) {
        const neighbors = Array.from(adjMap.get(nodeId) ?? []).sort((a, b) =>
          a.localeCompare(b),
        );
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextLevelSet.add(neighborId);
          }
        }
      }
      currentLevel = Array.from(nextLevelSet).sort((a, b) => a.localeCompare(b));
      if (currentLevel.length === 0) break;
    }

    // Filter visited nodes to only those matching ALL supplied filters (Candidate Universe)
    const matchedVisitedNodes = Array.from(visited)
      .filter((id) => candidateNodeIdSet.has(id))
      .map((id) => allNodesMap.get(id)!)
      .filter(Boolean);

    // Deterministic sort: degree DESC, updated_at DESC, id ASC
    const sorted = matchedVisitedNodes.sort((a, b) => {
      const degA = degreeMap.get(a.id) ?? 0;
      const degB = degreeMap.get(b.id) ?? 0;
      if (degB !== degA) return degB - degA;

      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      if (timeB !== timeA) return timeB - timeA;

      return a.id.localeCompare(b.id);
    });

    if (sorted.length > limit) {
      finalNodes = sorted.slice(0, limit);
      isTruncated = true;
    } else {
      finalNodes = sorted;
      isTruncated = false;
    }
  } else {
    // 4. Initial viewport deterministic ordering & truncation
    // Deterministic sort: degree DESC, updated_at DESC, id ASC
    const sorted = [...candidateNodes].sort((a, b) => {
      const degA = degreeMap.get(a.id) ?? 0;
      const degB = degreeMap.get(b.id) ?? 0;
      if (degB !== degA) return degB - degA;

      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      if (timeB !== timeA) return timeB - timeA;

      return a.id.localeCompare(b.id);
    });

    if (sorted.length > limit) {
      finalNodes = sorted.slice(0, limit);
      isTruncated = true;
    } else {
      finalNodes = sorted;
      isTruncated = false;
    }
  }

  const finalNodeIds = new Set(finalNodes.map((n) => n.id));

  // 5. Filter Edges between final visible nodes and sort deterministically
  const visibleEdges = activeEdges
    .filter((e) => finalNodeIds.has(e.sourceNodeId) && finalNodeIds.has(e.targetNodeId))
    .sort((a, b) => {
      if (a.sourceNodeId !== b.sourceNodeId) return a.sourceNodeId.localeCompare(b.sourceNodeId);
      if (a.targetNodeId !== b.targetNodeId) return a.targetNodeId.localeCompare(b.targetNodeId);
      if (a.relationType !== b.relationType) return a.relationType.localeCompare(b.relationType);
      return a.id.localeCompare(b.id);
    });

  // 6. Compute edge counts for visible nodes
  const inboundMap = new Map<string, number>();
  const outboundMap = new Map<string, number>();
  for (const n of finalNodes) {
    inboundMap.set(n.id, 0);
    outboundMap.set(n.id, 0);
  }
  for (const e of visibleEdges) {
    outboundMap.set(e.sourceNodeId, (outboundMap.get(e.sourceNodeId) ?? 0) + 1);
    inboundMap.set(e.targetNodeId, (inboundMap.get(e.targetNodeId) ?? 0) + 1);
  }

  // 7. Deterministic Positioning (Zero Math.random / Zero Date.now)
  const nodes = finalNodes.map((node, index) => {
    const angle = index * 2.399963229728653; // golden angle
    const radius = 60 * Math.sqrt(index);
    const x = Math.round(radius * Math.cos(angle));
    const y = Math.round(radius * Math.sin(angle));

    return {
      id: node.id,
      title: node.title,
      nodeType: node.nodeType,
      domainId: node.domainId,
      domainName: node.domainName ?? null,
      skillId: node.skillId,
      skillName: node.skillName ?? null,
      verificationStatus: node.verificationStatus,
      isArchived: node.isArchived,
      confidence: node.confidence,
      sourceType: node.sourceType,
      sourceId: node.sourceId,
      inboundEdgeCount: inboundMap.get(node.id) ?? 0,
      outboundEdgeCount: outboundMap.get(node.id) ?? 0,
      position: { x, y },
    };
  });

  const edges = visibleEdges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    relationType: e.relationType,
    verificationStatus: e.verificationStatus,
    isArchived: e.isArchived,
    confidence: e.confidence,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    provenanceNote: e.provenanceNote,
    verifiedAt: e.verifiedAt,
    verifiedBy: e.verifiedBy,
  }));

  // 8. Domain node counts
  const domainNodeCounts = new Map<string, number>();
  for (const n of finalNodes) {
    if (n.domainId) {
      domainNodeCounts.set(n.domainId, (domainNodeCounts.get(n.domainId) ?? 0) + 1);
    }
  }

  const responseDomains = domains.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    nodeCount: domainNodeCounts.get(d.id) ?? 0,
  }));

  return {
    domains: responseDomains,
    nodes,
    edges,
    stats: {
      totalNodes: candidateNodes.length,
      verifiedNodes: nodes.filter((n) => n.verificationStatus === "verified").length,
      inferredNodes: nodes.filter((n) => n.verificationStatus === "inferred").length,
      totalEdges: edges.length,
      verifiedEdges: edges.filter((e) => e.verificationStatus === "verified").length,
      inferredEdges: edges.filter((e) => e.verificationStatus === "inferred").length,
      isTruncated,
    },
  };
}
