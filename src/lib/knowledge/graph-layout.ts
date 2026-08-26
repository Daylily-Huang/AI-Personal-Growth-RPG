// src/lib/knowledge/graph-layout.ts
// Stage 6B Deterministic Graph Layout & Progressive Query Engine

import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphResponse,
  KnowledgeNodeType,
} from "./types";
import type { Domain, SkillState } from "@/lib/store/types";
import { NotFoundError } from "./authority-service";

export interface ComputeGraphOptions {
  domainId?: string;
  status?: "all" | "verified" | "inferred" | "archived";
  nodeType?: KnowledgeNodeType;
  search?: string;
  rootNodeId?: string;
  depth?: number; // 1..3
  limit?: number; // default 60, max 100
}

export class InvalidDepthError extends Error {
  readonly code = "invalid_depth";
  constructor(message = "depth must be an integer between 1 and 3") {
    super(message);
    this.name = "InvalidDepthError";
  }
}

export function computeKnowledgeGraph(
  domains: Domain[],
  skills: SkillState[],
  allNodes: KnowledgeNode[],
  allEdges: KnowledgeEdge[],
  options: ComputeGraphOptions = {},
): KnowledgeGraphResponse {
  const domainMap = new Map(domains.map((d) => [d.id, d.name]));
  const skillMap = new Map(skills.map((s) => [s.id, s.name]));
  const allNodesMap = new Map(allNodes.map((n) => [n.id, n]));

  const limit = Math.min(Math.max(options.limit ?? 60, 1), 100);

  // 1. Candidate Universe: Filter nodes by domain, status, nodeType, and search query
  const candidateNodes = allNodes.filter((node) => {
    // 1.1 Status Filter
    if (options.status === "archived") {
      if (!node.isArchived) return false;
    } else {
      if (node.isArchived) return false;
      if (options.status === "verified" && node.verificationStatus !== "verified") return false;
      if (options.status === "inferred" && node.verificationStatus !== "inferred") return false;
      // Default "all" returns active facts: verificationStatus IN ('inferred', 'verified')
      if (
        (options.status === "all" || !options.status) &&
        node.verificationStatus !== "inferred" &&
        node.verificationStatus !== "verified"
      ) {
        return false;
      }
    }

    // 1.2 Domain Filter
    if (options.domainId && node.domainId !== options.domainId) {
      return false;
    }

    // 1.3 Node Type Filter
    if (options.nodeType && node.nodeType !== options.nodeType) {
      return false;
    }

    // 1.4 Search Filter (Case-Insensitive substring matching on title)
    if (options.search && options.search.trim().length > 0) {
      const q = options.search.trim().toLowerCase();
      if (!node.title.toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  });

  const candidateNodeIdSet = new Set(candidateNodes.map((n) => n.id));

  // 2. Active Edges: inferred or verified, and not archived
  // Edges are active when status IN ('inferred', 'verified') and isArchived is false
  const activeEdges = allEdges.filter(
    (e) =>
      !e.isArchived &&
      (e.verificationStatus === "inferred" || e.verificationStatus === "verified"),
  );

  // Compute active degree for each node (inbound + outbound active edges)
  const degreeMap = new Map<string, number>();
  for (const n of allNodes) {
    degreeMap.set(n.id, 0);
  }
  for (const e of activeEdges) {
    degreeMap.set(e.sourceNodeId, (degreeMap.get(e.sourceNodeId) ?? 0) + 1);
    degreeMap.set(e.targetNodeId, (degreeMap.get(e.targetNodeId) ?? 0) + 1);
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
    // P1 Hidden Bridge Elimination: only enqueue neighbors that belong to candidateNodeIdSet!
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
          if (!visited.has(neighborId) && candidateNodeIdSet.has(neighborId)) {
            visited.add(neighborId);
            nextLevelSet.add(neighborId);
          }
        }
      }
      currentLevel = Array.from(nextLevelSet).sort((a, b) => a.localeCompare(b));
      if (currentLevel.length === 0) break;
    }

    // Root anchor is always visible; all reached neighbors strictly satisfy active filters.
    const matchedVisitedNodes = Array.from(visited)
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
    }
  } else {
    // 4. Initial Viewport Query (Root-less): Return top-degree candidate nodes
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
    }
  }

  const finalNodeIdSet = new Set(finalNodes.map((n) => n.id));

  // 5. Visible Edges: Active edges between final visible nodes
  // Deterministic edge sort: sourceNodeId ASC, targetNodeId ASC, relationType ASC, id ASC
  const visibleEdges = activeEdges
    .filter((e) => finalNodeIdSet.has(e.sourceNodeId) && finalNodeIdSet.has(e.targetNodeId))
    .sort((a, b) => {
      if (a.sourceNodeId !== b.sourceNodeId) return a.sourceNodeId.localeCompare(b.sourceNodeId);
      if (a.targetNodeId !== b.targetNodeId) return a.targetNodeId.localeCompare(b.targetNodeId);
      if (a.relationType !== b.relationType) return a.relationType.localeCompare(b.relationType);
      return a.id.localeCompare(b.id);
    });

  // 6. Deterministic Spatial Layout Coordinates
  // Arrange nodes deterministically on concentric rings based on degree rank
  const layoutNodes = finalNodes.map((node, index) => {
    const total = finalNodes.length;
    let x = 0;
    let y = 0;

    if (options.rootNodeId && node.id === options.rootNodeId) {
      // Place focal root at center (0, 0)
      x = 0;
      y = 0;
    } else {
      const ring = Math.floor(index / 12) + 1;
      const ringRadius = ring * 180;
      const ringIndex = index % 12;
      const ringCount = Math.min(12, total - (ring - 1) * 12);
      const angle = (ringIndex / ringCount) * 2 * Math.PI;

      x = Math.round(ringRadius * Math.cos(angle));
      y = Math.round(ringRadius * Math.sin(angle));
    }

    return {
      id: node.id,
      title: node.title,
      nodeType: node.nodeType,
      domainId: node.domainId,
      domainName: node.domainId ? domainMap.get(node.domainId) ?? null : null,
      skillId: node.skillId,
      skillName: node.skillId ? skillMap.get(node.skillId) ?? null : null,
      verificationStatus: node.verificationStatus,
      isArchived: node.isArchived,
      confidence: node.confidence,
      sourceType: node.sourceType,
      sourceId: node.sourceId,
      inboundEdgeCount: activeEdges.filter((e) => e.targetNodeId === node.id).length,
      outboundEdgeCount: activeEdges.filter((e) => e.sourceNodeId === node.id).length,
      position: { x, y },
    };
  });

  const layoutEdges = visibleEdges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    relationType: edge.relationType,
    verificationStatus: edge.verificationStatus,
    isArchived: edge.isArchived,
    confidence: edge.confidence,
    sourceType: edge.sourceType,
    sourceId: edge.sourceId,
    provenanceNote: edge.provenanceNote,
    verifiedAt: edge.verifiedAt,
    verifiedBy: edge.verifiedBy,
  }));

  // 7. Domain summaries
  const domainSummaries = domains.map((dom) => ({
    id: dom.id,
    name: dom.name,
    slug: dom.slug,
    nodeCount: finalNodes.filter((n) => n.domainId === dom.id).length,
  }));

  // 8. Graph Statistics
  const stats = {
    totalNodes: options.rootNodeId ? finalNodes.length : candidateNodes.length,
    verifiedNodes: finalNodes.filter((n) => n.verificationStatus === "verified").length,
    inferredNodes: finalNodes.filter((n) => n.verificationStatus === "inferred").length,
    totalEdges: visibleEdges.length,
    verifiedEdges: visibleEdges.filter((e) => e.verificationStatus === "verified").length,
    inferredEdges: visibleEdges.filter((e) => e.verificationStatus === "inferred").length,
    isTruncated,
  };

  return {
    domains: domainSummaries,
    nodes: layoutNodes,
    edges: layoutEdges,
    stats,
  };
}
