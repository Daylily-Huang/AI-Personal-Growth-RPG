import type {
  Domain,
  SkillEdge,
  SkillFlowNode,
  SkillFlowEdge,
  SkillState,
  SkillTreeGraphResponse,
} from "@/lib/store/types";
import { computeSkillDerivedState, isPrereqFulfilled } from "./derived-state";

export interface ComputeSkillGraphOptions {
  domainId?: string | null;
  status?: "active" | "archived" | "all";
}

/**
 * Pure function to compute positioned graph nodes, derived states, and styled edges.
 *
 * Cycle-Safe Strategy for Mixed Relations (P2):
 * Stage 5A DB guarantees that `prerequisite` edges and `contains` edges are individually
 * acyclic, but their union could theoretically cycle. To ensure deterministic, crash-proof
 * layout:
 *   1. Primary topological layering is computed strictly on `prerequisite` edges (guaranteed DAG).
 *   2. `contains` and `supports` relations do not influence layering at all; they are
 *      emitted purely as styled edges after prerequisite layering is complete.
 *   3. Any unvisited or cycle-entangled node falls back safely to layer 0.
 *   4. Node placement is deterministically sorted by layer, name, and ID.
 */
export function computeSkillGraph(
  domains: Domain[],
  skills: SkillState[],
  edges: SkillEdge[],
  options: ComputeSkillGraphOptions = {},
): SkillTreeGraphResponse {
  const statusFilter = options.status ?? "active";

  // 1. Filter skills by status
  let filteredSkills = skills;
  if (statusFilter !== "all") {
    filteredSkills = filteredSkills.filter((s) => (s.status ?? "active") === statusFilter);
  }

  // 2. Filter skills by domain if domainId provided
  if (options.domainId) {
    filteredSkills = filteredSkills.filter((s) => s.domainId === options.domainId);
  }

  const validSkillIds = new Set(filteredSkills.map((s) => s.id));
  const skillsMap = new Map(skills.map((s) => [s.id, s]));

  // 3. Filter edges to only those connecting valid skills
  const filteredEdges = edges.filter(
    (e) => validSkillIds.has(e.sourceId) && validSkillIds.has(e.targetId),
  );

  // 4. Compute topological layering based on prerequisite DAG
  const levels = new Map<string, number>();
  const indegree = new Map<string, number>();

  for (const skill of filteredSkills) {
    levels.set(skill.id, 0);
    indegree.set(skill.id, 0);
  }

  // Primary structural layering uses prerequisite edges
  const prereqEdges = filteredEdges.filter((e) => e.relation === "prerequisite");
  for (const edge of prereqEdges) {
    if (!indegree.has(edge.sourceId) || !indegree.has(edge.targetId)) continue;
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
  }

  const queue = filteredSkills.filter((s) => (indegree.get(s.id) ?? 0) === 0).map((s) => s.id);
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    for (const edge of prereqEdges.filter((e) => e.sourceId === id)) {
      levels.set(edge.targetId, Math.max(levels.get(edge.targetId) ?? 0, (levels.get(id) ?? 0) + 1));
      indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) - 1);
      if ((indegree.get(edge.targetId) ?? 0) === 0) queue.push(edge.targetId);
    }
  }

  // Fallback: any node with remaining indegree > 0 (e.g. if an edge set had a cycle) is safely kept at layer 0

  // 5. Group by layer for stable spacing and calculate derived states
  // Sort deterministic order by layer ASC, then name ASC, then id ASC
  const sortedSkills = [...filteredSkills].sort((a, b) => {
    const la = levels.get(a.id) ?? 0;
    const lb = levels.get(b.id) ?? 0;
    if (la !== lb) return la - lb;
    const nameComp = a.name.localeCompare(b.name);
    if (nameComp !== 0) return nameComp;
    return a.id.localeCompare(b.id);
  });

  const layerIndex = new Map<number, number>();
  const nodes: SkillFlowNode[] = sortedSkills.map((skill) => {
    const layer = levels.get(skill.id) ?? 0;
    const index = layerIndex.get(layer) ?? 0;
    layerIndex.set(layer, index + 1);

    // Incoming prerequisites from full skills universe
    const incomingPrereqEdges = edges.filter(
      (e) => e.targetId === skill.id && e.relation === "prerequisite",
    );
    const prereqStates: Array<{ masteryLevel: number; masteryConfidence: number }> = [];
    let unfulfilledPrerequisiteCount = 0;

    for (const inEdge of incomingPrereqEdges) {
      const parent = skillsMap.get(inEdge.sourceId);
      if (parent) {
        prereqStates.push(parent);
        if (!isPrereqFulfilled(parent)) {
          unfulfilledPrerequisiteCount++;
        }
      }
    }

    const derivedState = computeSkillDerivedState(skill, prereqStates);

    return {
      id: skill.id,
      domainId: skill.domainId ?? null,
      position: { x: layer * 280, y: index * 140 },
      data: {
        name: skill.name,
        aliases: skill.aliases,
        level: skill.level,
        xp: skill.xp,
        masteryLevel: skill.masteryLevel,
        masteryConfidence: skill.masteryConfidence,
        derivedState,
        lastUsedAt: skill.lastUsedAt,
        prerequisiteCount: incomingPrereqEdges.length,
        unfulfilledPrerequisiteCount,
      },
    };
  });

  // 6. Map styled edges
  const flowEdges: SkillFlowEdge[] = filteredEdges.map((edge, index) => ({
    id: edge.id ?? `${edge.sourceId}-${edge.targetId}-${edge.relation}-${index}`,
    source: edge.sourceId,
    target: edge.targetId,
    relation: edge.relation,
    animated: edge.relation === "prerequisite",
  }));

  // 7. Filter domains if domainId was specified
  let visibleDomains = domains;
  if (options.domainId) {
    visibleDomains = domains.filter((d) => d.id === options.domainId);
  }

  return {
    domains: visibleDomains,
    nodes,
    edges: flowEdges,
  };
}
