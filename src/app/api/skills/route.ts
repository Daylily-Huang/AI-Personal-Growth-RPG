import { NextResponse } from "next/server";
import { demoRepository } from "@/lib/store/demo-db";

interface FlowNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
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
    const skills = demoRepository.listSkills();
    const edges = demoRepository.listSkillEdges();

    const levels = new Map<string, number>();
    const indegree = new Map<string, number>();
    for (const skill of skills) {
      levels.set(skill.name, 0);
      indegree.set(skill.name, 0);
    }
    for (const edge of edges) {
      if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    }

    // Topological layering: a node's layer = max(source layer) + 1.
    const queue = skills.filter((s) => (indegree.get(s.name) ?? 0) === 0).map((s) => s.name);
    let head = 0;
    while (head < queue.length) {
      const name = queue[head++];
      for (const edge of edges.filter((e) => e.source === name)) {
        levels.set(edge.target, Math.max(levels.get(edge.target) ?? 0, (levels.get(name) ?? 0) + 1));
        indegree.set(edge.target, (indegree.get(edge.target) ?? 0) - 1);
        if ((indegree.get(edge.target) ?? 0) === 0) queue.push(edge.target);
      }
    }

    // Group by layer for stable vertical spacing.
    const layerIndex = new Map<number, number>();
    const nodes: FlowNode[] = skills.map((skill) => {
      const layer = levels.get(skill.name) ?? 0;
      const index = layerIndex.get(layer) ?? 0;
      layerIndex.set(layer, index + 1);
      return {
        id: skill.name,
        position: { x: layer * 280, y: index * 140 },
        data: {
          label: skill.name,
          level: skill.level,
          masteryLevel: skill.masteryLevel,
          masteryConfidence: skill.masteryConfidence,
          xp: skill.xp,
        },
      };
    });

    const flowEdges: FlowEdge[] = edges.map((edge, index) => ({
      id: `${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.relation,
      animated: true,
    }));

    return NextResponse.json({ nodes, edges: flowEdges }, { status: 200 });
  } catch (error) {
    console.error("Failed to load skill tree", error);
    return NextResponse.json({ error: "Failed to load skill tree" }, { status: 500 });
  }
}
