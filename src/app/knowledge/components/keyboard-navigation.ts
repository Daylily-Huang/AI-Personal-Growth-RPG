import type { KnowledgeGraphResponse } from "@/lib/knowledge/types";

export type KnowledgeGraphDirection = "up" | "down" | "left" | "right";

export function getKnowledgeGraphDirection(key: string): KnowledgeGraphDirection | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

/**
 * Keyboard adjacency is a view concern: loaded graph edges connect the
 * candidates in either direction, while the persisted relation remains
 * untouched. Stable id ordering resolves equal-distance ties.
 */
export function findNextKnowledgeNode(
  currentId: string,
  direction: KnowledgeGraphDirection,
  nodes: KnowledgeGraphResponse["nodes"],
  edges: KnowledgeGraphResponse["edges"],
): string | null {
  const current = nodes.find((node) => node.id === currentId);
  if (!current) return null;

  const connectedIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source === currentId) connectedIds.add(edge.target);
    if (edge.target === currentId) connectedIds.add(edge.source);
  }

  const candidates = nodes
    .filter((node) => connectedIds.has(node.id) && node.id !== currentId)
    .map((node) => {
      const dx = node.position.x - current.position.x;
      const dy = node.position.y - current.position.y;
      const isInDirection =
        direction === "right"
          ? dx > 0
          : direction === "left"
            ? dx < 0
            : direction === "down"
              ? dy > 0
              : dy < 0;
      return { node, isInDirection, distance: dx * dx + dy * dy };
    })
    .filter((candidate) => candidate.isInDirection)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.node.id < b.node.id) return -1;
      if (a.node.id > b.node.id) return 1;
      return 0;
    });

  return candidates[0]?.node.id ?? null;
}
