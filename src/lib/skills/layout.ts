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

  // 4. Compute topological layering based on prerequisite and hierarchy edges
  const levels = new Map<string, number>();
  const indegree = new Map<string, number>();

  for (const skill of filteredSkills) {
    levels.set(skill.id, 0);
    indegree.set(skill.id, 0);
  }

  // Prerequisite / contains edges determine vertical/horizontal DAG depth
  const dagEdges = filteredEdges.filter((e) => e.relation === "prerequisite" || e.relation === "contains");
  for (const edge of dagEdges) {
    if (!indegree.has(edge.sourceId) || !indegree.has(edge.targetId)) continue;
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
  }

  const queue = filteredSkills.filter((s) => (indegree.get(s.id) ?? 0) === 0).map((s) => s.id);
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    for (const edge of dagEdges.filter((e) => e.sourceId === id)) {
      levels.set(edge.targetId, Math.max(levels.get(edge.targetId) ?? 0, (levels.get(id) ?? 0) + 1));
      indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) - 1);
      if ((indegree.get(edge.targetId) ?? 0) === 0) queue.push(edge.targetId);
    }
  }

  // 5. Group by layer for stable spacing and calculate derived states
  const layerIndex = new Map<number, number>();
  const nodes: SkillFlowNode[] = filteredSkills.map((skill) => {
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
