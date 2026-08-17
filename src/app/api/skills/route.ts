import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store/demo-db";

interface FlowNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    skillName: string;
    level: number;
    masteryLevel: number;
    masteryConfidence: number;
    xp: number;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export async function GET() {
  try {
    const repo = getRepository();
    const skills = await repo.listSkills();
    const edges = await repo.listSkillEdges();

    // Nodes are keyed by stable skill id; edges endpoints are skill ids too.
    const levels = new Map<string, number>();
    const indegree = new Map<string, number>();
    for (const skill of skills) {
      levels.set(skill.id, 0);
      indegree.set(skill.id, 0);
    }
    for (const edge of edges) {
      if (!indegree.has(edge.sourceId) || !indegree.has(edge.targetId)) continue;
      indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
    }

    // Topological layering: a node's layer = max(source layer) + 1.
    const queue = skills.filter((s) => (indegree.get(s.id) ?? 0) === 0).map((s) => s.id);
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      for (const edge of edges.filter((e) => e.sourceId === id)) {
        levels.set(edge.targetId, Math.max(levels.get(edge.targetId) ?? 0, (levels.get(id) ?? 0) + 1));
        indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) - 1);
        if ((indegree.get(edge.targetId) ?? 0) === 0) queue.push(edge.targetId);
      }
    }

    // Group by layer for stable vertical spacing.
    const layerIndex = new Map<number, number>();
    const nodes: FlowNode[] = skills.map((skill) => {
      const layer = levels.get(skill.id) ?? 0;
      const index = layerIndex.get(layer) ?? 0;
      layerIndex.set(layer, index + 1);
      return {
        id: skill.id,
        position: { x: layer * 280, y: index * 140 },
        data: {
          label: skill.name,
          skillName: skill.name,
          level: skill.level,
          masteryLevel: skill.masteryLevel,
          masteryConfidence: skill.masteryConfidence,
          xp: skill.xp,
        },
      };
    });

    const flowEdges: FlowEdge[] = edges.map((edge, index) => ({
      id: `${edge.sourceId}-${edge.targetId}-${index}`,
      source: edge.sourceId,
      target: edge.targetId,
      label: edge.relation,
      animated: true,
    }));

    return NextResponse.json({ nodes, edges: flowEdges }, { status: 200 });
  } catch (error) {
    console.error("Failed to load skill tree", error);
    return NextResponse.json({ error: "Failed to load skill tree" }, { status: 500 });
  }
}
