import { describe, expect, test } from "vitest";
import type {
  Domain,
  SkillFlowEdge,
  SkillFlowNode,
  SkillTreeGraphResponse,
} from "@/lib/store/types";
import {
  buildDomainList,
  filterGraph,
  findNodeById,
  formatConfidence,
  formatTimestamp,
  getRelationVisual,
  getSkillStateVisual,
} from "@/app/skills/components/presentation";
import type { SkillNodeViewData } from "@/app/skills/components/SkillNode";

function makeNode(
  id: string,
  overrides: Partial<SkillNodeViewData> = {},
): SkillFlowNode {
  return {
    id,
    domainId: null,
    position: { x: 0, y: 0 },
    data: {
      name: `Skill ${id}`,
      aliases: [],
      level: 1,
      xp: 0,
      masteryLevel: 1,
      masteryConfidence: 0.4,
      derivedState: "available",
      lastUsedAt: null,
      prerequisiteCount: 0,
      unfulfilledPrerequisiteCount: 0,
      ...overrides,
    },
  };
}

function makeEdge(source: string, target: string, relation = "prerequisite"): SkillFlowEdge {
  return { id: `${source}->${target}-${relation}`, source, target, relation };
}

const GRAPH: Pick<SkillTreeGraphResponse, "nodes" | "edges"> = {
  nodes: [
    makeNode("ts", { name: "TypeScript", aliases: ["TS"], derivedState: "proficient" }),
    makeNode("next", { name: "Next.js", derivedState: "learning" }),
    makeNode("algo", { name: "Algorithms", derivedState: "locked", unfulfilledPrerequisiteCount: 1 }),
    makeNode("old", { name: "Legacy PHP", derivedState: "archived" }),
    makeNode("art", { name: "Pixel Art", aliases: ["绘画"], derivedState: "available" }),
  ],
  edges: [makeEdge("ts", "next"), makeEdge("ts", "algo"), makeEdge("art", "next", "supports")],
};

describe("Stage 5C — getSkillStateVisual maps every frozen derivedState", () => {
  const cases: Array<[Parameters<typeof getSkillStateVisual>[0], RegExp, string | null]> = [
    ["locked", /opacity-60/, "lock"],
    ["available", /border-emerald-500/, null],
    ["learning", /border-sky-500/, null],
    ["proficient", /border-amber-500/, null],
    ["advanced", /ring-purple-400\/60/, "crown"],
    ["archived", /repeating-linear-gradient/, null],
  ];

  for (const [state, containerPattern, icon] of cases) {
    test(`"${state}" renders its dedicated presentation`, () => {
      const visual = getSkillStateVisual(state);
      expect(visual.containerClass).toMatch(containerPattern);
      expect(visual.badgeClass).toBeTruthy();
      expect(visual.label).toBeTruthy();
      expect(visual.icon).toBe(icon);
    });
  }

  test("locked is dimmed; available pulses; advanced carries crown ring", () => {
    expect(getSkillStateVisual("locked").dimmed).toBe(true);
    expect(getSkillStateVisual("available").pulseDot).toBe(true);
    expect(getSkillStateVisual("advanced").containerClass).toContain("ring-2");
  });
});

describe("Stage 5C — getRelationVisual respects Stage 5A relation semantics", () => {
  test("prerequisite: solid sky arrow, animated", () => {
    const v = getRelationVisual("prerequisite");
    expect(v.color).toBe("#38bdf8");
    expect(v.strokeDasharray).toBeUndefined();
    expect(v.marker).toBe("arrow");
    expect(v.animated).toBe(true);
  });

  test("contains: dashed purple with circle marker (NOT a mastery dependency)", () => {
    const v = getRelationVisual("contains");
    expect(v.color).toBe("#a855f7");
    expect(v.strokeDasharray).toBeDefined();
    expect(v.marker).toBe("circle");
    expect(v.animated).toBe(false);
  });

  test("supports: subtle dotted zinc, no marker", () => {
    const v = getRelationVisual("supports");
    expect(v.color).toBe("#71717a");
    expect(v.strokeDasharray).toBeDefined();
    expect(v.marker).toBeNull();
    expect(v.animated).toBe(false);
  });
});

describe("Stage 5C — filterGraph (viewport-only filtering)", () => {
  test("no filters: archived skills are hidden by default (mirrors active scope)", () => {
    const out = filterGraph(GRAPH, { domainId: null, stateFilter: "all", search: "" });
    expect(out.nodes.map((n) => n.id)).toEqual(["ts", "next", "algo", "art"]);
  });

  test("explicit archived pill shows only archived skills", () => {
    const out = filterGraph(GRAPH, { domainId: null, stateFilter: "archived", search: "" });
    expect(out.nodes.map((n) => n.id)).toEqual(["old"]);
  });

  test("domain filter keeps only that domain's nodes and their edges", () => {
    const scoped = {
      nodes: GRAPH.nodes.map((n, i) => ({
        ...n,
        domainId: i % 2 === 0 ? "d1" : "d2",
      })),
      edges: GRAPH.edges,
    };
    const out = filterGraph(scoped, { domainId: "d1", stateFilter: "all", search: "" });
    expect(out.nodes.every((n) => n.domainId === "d1")).toBe(true);
    // edges must not dangle into hidden nodes
    const ids = new Set(out.nodes.map((n) => n.id));
    expect(out.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  test("search matches name case-insensitively and via aliases", () => {
    const byName = filterGraph(GRAPH, { domainId: null, stateFilter: "all", search: "typescript" });
    expect(byName.nodes.map((n) => n.id)).toEqual(["ts"]);

    const byAlias = filterGraph(GRAPH, { domainId: null, stateFilter: "all", search: "绘画" });
    expect(byAlias.nodes.map((n) => n.id)).toEqual(["art"]);
  });

  test("combined filters intersect", () => {
    const out = filterGraph(GRAPH, { domainId: null, stateFilter: "learning", search: "next" });
    expect(out.nodes.map((n) => n.id)).toEqual(["next"]);
  });

  test("empty result set is well-formed (nodes and edges both empty)", () => {
    const out = filterGraph(GRAPH, { domainId: null, stateFilter: "all", search: "不存在" });
    expect(out.nodes).toHaveLength(0);
    expect(out.edges).toHaveLength(0);
  });
});

describe("Stage 5C — buildDomainList", () => {
  const domains: Domain[] = [
    { id: "root", name: "Computer Science", slug: "cs", parentId: null },
    { id: "web", name: "Web Dev", slug: "web", parentId: "root" },
    { id: "misc", name: "Arts", slug: "arts", parentId: null },
  ];

  test("counts skills per domain and indents sub-domains", () => {
    const nodes = [
      makeNode("a", {}),
      makeNode("b", {}),
    ].map((n, i) => ({ ...n, domainId: i === 0 ? "root" : "web" }));

    const list = buildDomainList(domains, nodes);
    expect(list.find((d) => d.id === "root")).toMatchObject({ depth: 0, count: 1 });
    expect(list.find((d) => d.id === "web")).toMatchObject({ depth: 1, count: 1 });
    expect(list.find((d) => d.id === "misc")).toMatchObject({ depth: 0, count: 0 });
  });

  test("survives malformed parent cycles without hanging", () => {
    const cyclic: Domain[] = [
      { id: "x", name: "X", slug: "x", parentId: "y" },
      { id: "y", name: "Y", slug: "y", parentId: "x" },
    ];
    const list = buildDomainList(cyclic, []);
    expect(list).toHaveLength(2);
    expect(list[0].depth).toBeLessThan(10);
  });
});

describe("Stage 5C — misc formatters", () => {
  test("formatConfidence rounds to percent", () => {
    expect(formatConfidence(0.854)).toBe("85%");
    expect(formatConfidence(0.5)).toBe("50%");
  });

  test("findNodeById searches the full unfiltered graph", () => {
    expect(findNodeById(GRAPH.nodes, "old")?.data.name).toBe("Legacy PHP");
    expect(findNodeById(GRAPH.nodes, "missing")).toBeUndefined();
  });

  test("formatTimestamp falls back on invalid input", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
    expect(formatTimestamp("2026-08-20T10:00:00.000Z")).toMatch(/^\d{2}[-/]\d{2}/);
  });
});
