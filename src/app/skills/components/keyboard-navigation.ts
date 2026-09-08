import type { SkillFlowEdge, SkillFlowNode } from "@/lib/store/types";

export type SkillGraphDirection = "up" | "down" | "left" | "right";

/**
 * Map only the arrow keys used by the graph interaction contract. Other keys
 * remain available to the browser and React Flow.
 */
export function getSkillGraphDirection(key: string): SkillGraphDirection | null {
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
 * Find the nearest loaded node connected to the focused node in the pressed
 * spatial direction. Edge direction is intentionally ignored for navigation;
 * the stored relation itself is never changed.
 */
export function findNextSkillNode(
  currentId: string,
  direction: SkillGraphDirection,
  nodes: SkillFlowNode[],
  edges: SkillFlowEdge[],
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
