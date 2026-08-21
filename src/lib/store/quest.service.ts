import type { Repository } from "./repository";
import type { Quest, QuestTreeNode } from "./types";

/**
 * Build a hierarchical tree of quests from a flat list.
 * Roots are quests where parentQuestId is null or parent is not present in the list.
 */
export function buildQuestTree(quests: Quest[]): QuestTreeNode[] {
  const nodeMap = new Map<string, QuestTreeNode>();
  quests.forEach((q) => {
    nodeMap.set(q.id, { ...q, children: [] });
  });

  const roots: QuestTreeNode[] = [];

  quests.forEach((q) => {
    const node = nodeMap.get(q.id)!;
    if (q.parentQuestId && nodeMap.has(q.parentQuestId)) {
      const parent = nodeMap.get(q.parentQuestId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Calculate aggregated progress of a quest tree node.
 * If node has children: average of child progress values.
 * Otherwise returns node.progress.
 */
export function computeAggregatedProgress(node: QuestTreeNode): number {
  if (!node.children || node.children.length === 0) {
    return node.progress;
  }
  const childProgressSum = node.children.reduce((sum, child) => {
    return sum + computeAggregatedProgress(child);
  }, 0);
  return Math.round(childProgressSum / node.children.length);
}

/**
 * Detect if assigning `targetParentId` as the parent of `questId` would create a cycle.
 */
export function detectQuestCycle(
  quests: Quest[],
  questId: string,
  targetParentId: string,
): boolean {
  if (questId === targetParentId) return true;

  const questMap = new Map<string, Quest>();
  quests.forEach((q) => questMap.set(q.id, q));

  let currentId: string | null = targetParentId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    if (currentId === questId) return true;
    visited.add(currentId);
    const parent = questMap.get(currentId);
    currentId = parent?.parentQuestId ?? null;
  }

  return false;
}

/**
 * Recursively recalculate and update parent quest progress up the tree.
 * Uses a visited set to guarantee termination even in cyclic scenarios.
 */
export async function syncParentQuestProgress(
  repo: Repository,
  parentQuestId: string | null,
  visited: Set<string> = new Set<string>(),
): Promise<void> {
  if (!parentQuestId || visited.has(parentQuestId)) return;
  visited.add(parentQuestId);

  const parent = await repo.getQuest(parentQuestId);
  if (!parent) return;

  const siblings = await repo.listQuests({ parentQuestId });
  if (siblings.length === 0) return;

  const totalProgress = siblings.reduce((sum, s) => sum + s.progress, 0);
  const avgProgress = Math.round(totalProgress / siblings.length);

  const allCompleted = siblings.every((s) => s.status === "completed");
  const newStatus = allCompleted ? "completed" : avgProgress > 0 && parent.status === "available" ? "active" : parent.status;

  if (parent.progress !== avgProgress || parent.status !== newStatus) {
    await repo.updateQuest(parent.id, {
      progress: avgProgress,
      status: newStatus,
    });
    // recurse to grandparent
    if (parent.parentQuestId) {
      await syncParentQuestProgress(repo, parent.parentQuestId, visited);
    }
  }
}

