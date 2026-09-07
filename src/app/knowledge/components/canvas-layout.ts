import type { KnowledgeGraphResponse, KnowledgeRelationType, KnowledgeVerificationStatus } from "@/lib/knowledge/types";

export type EdgeAuthorityFilter = "all" | KnowledgeVerificationStatus | "archived";
export type RelationFilter = "all" | KnowledgeRelationType;
export type LayoutMode = "clustered" | "relations";

export interface KnowledgeCluster {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
}

/** View-only layout: stable domain/type groups, no synthetic domain entities or writes. */
export function layoutKnowledgeNodes(nodes: KnowledgeGraphResponse["nodes"], mode: LayoutMode) {
  if (mode === "relations") return { nodes, clusters: [] as KnowledgeCluster[] };
  const groups = new Map<string, KnowledgeGraphResponse["nodes"]>();
  for (const node of nodes) {
    const key = JSON.stringify([node.domainId, node.nodeType]);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  const positioned: KnowledgeGraphResponse["nodes"] = [];
  const clusters: KnowledgeCluster[] = [];
  const labels = { topic: "主题", concept: "概念", claim: "命题" };
  let y = 0;
  // Two cluster columns, advancing by the tallest group in each row.
  let rowHeight = 0;
  [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([id, group], index) => {
    const x = (index % 2) * 680;
    if (index % 2 === 0 && index > 0) { y += rowHeight + 48; rowHeight = 0; }
    const height = 72 + Math.ceil(group.length / 2) * 208;
    rowHeight = Math.max(rowHeight, height);
    const first = group[0];
    clusters.push({ id, label: `${first.domainName ?? "未分类领域"} · ${labels[first.nodeType]}`, x, y, width: 640, height, count: group.length });
    [...group].sort((a, b) => a.id.localeCompare(b.id)).forEach((node, i) => {
      positioned.push({ ...node, position: { x: x + 24 + (i % 2) * 304, y: y + 60 + Math.floor(i / 2) * 208 } });
    });
  });
  return { nodes: positioned, clusters };
}

export function filterKnowledgeEdges(
  edges: KnowledgeGraphResponse["edges"],
  nodes: KnowledgeGraphResponse["nodes"],
  authority: EdgeAuthorityFilter,
  relation: RelationFilter,
) {
  const ids = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)
    && (authority === "all" || (authority === "archived" ? edge.isArchived : edge.verificationStatus === authority && !edge.isArchived))
    && (relation === "all" || edge.relationType === relation));
}
