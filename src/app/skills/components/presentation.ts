import type {
  Domain,
  SkillDerivedState,
  SkillEdgeRelationType,
  SkillFlowEdge,
  SkillFlowNode,
  SkillTreeGraphResponse,
} from "@/lib/store/types";

/**
 * Stage 5C presentation mapping layer (pure, framework-free).
 *
 * These helpers ONLY translate Stage 5B facts (derivedState / relation /
 * isFulfilled ...) into visual configuration and client-side viewport filters.
 * They must NEVER recompute mastery thresholds, prerequisite fulfillment,
 * topology, or any authority-owned value.
 */

// ---------------------------------------------------------------------------
// Derived-state -> visual config
// ---------------------------------------------------------------------------

export interface SkillStateVisual {
  label: string;
  containerClass: string;
  badgeClass: string;
  /** Node-level opacity treatment */
  dimmed: boolean;
  /** Semantic icon hint rendered by the node component */
  icon: "lock" | "crown" | null;
  /** Subtle pulsing indicator inside the state badge */
  pulseDot: boolean;
}

const STATE_VISUALS: Record<SkillDerivedState, SkillStateVisual> = {
  locked: {
    label: "已锁定",
    containerClass: "border-zinc-600 bg-slate-900/80 opacity-60",
    badgeClass: "bg-zinc-700/50 text-zinc-300",
    dimmed: true,
    icon: "lock",
    pulseDot: false,
  },
  available: {
    label: "可开始",
    containerClass:
      "border-dashed border-emerald-500 bg-slate-900 shadow-[0_0_14px_rgba(16,185,129,0.18)]",
    badgeClass: "bg-emerald-500/15 text-emerald-300",
    dimmed: false,
    icon: null,
    pulseDot: true,
  },
  learning: {
    label: "学习中",
    containerClass:
      "border-sky-500 bg-slate-900 shadow-[0_0_14px_rgba(14,165,233,0.18)]",
    badgeClass: "bg-sky-500/15 text-sky-300",
    dimmed: false,
    icon: null,
    pulseDot: false,
  },
  proficient: {
    label: "熟练",
    containerClass:
      "border-amber-500 bg-slate-900 shadow-[0_0_18px_rgba(245,158,11,0.28)]",
    badgeClass: "bg-amber-500/15 text-amber-300",
    dimmed: false,
    icon: null,
    pulseDot: false,
  },
  advanced: {
    label: "精通",
    containerClass:
      "border-purple-500 ring-2 ring-purple-400/60 bg-slate-900 shadow-[0_0_22px_rgba(168,85,247,0.30)]",
    badgeClass: "bg-purple-500/15 text-purple-300",
    dimmed: false,
    icon: "crown",
    pulseDot: false,
  },
  archived: {
    label: "已归档",
    containerClass:
      "border-zinc-700 bg-slate-950 opacity-70 [background-image:repeating-linear-gradient(45deg,rgba(113,113,122,0.10)_0px,rgba(113,113,122,0.10)_6px,transparent_6px,transparent_12px)]",
    badgeClass: "bg-zinc-800/70 text-zinc-400",
    dimmed: false,
    icon: null,
    pulseDot: false,
  },
};

export function getSkillStateVisual(state: SkillDerivedState): SkillStateVisual {
  return STATE_VISUALS[state];
}

/** Ordered vocabulary for the status filter pills (spec §2.1 + archived). */
export const STATE_FILTER_OPTIONS: Array<{
  value: SkillDerivedState | "all";
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "available", label: "可开始" },
  { value: "learning", label: "学习中" },
  { value: "proficient", label: "熟练" },
  { value: "advanced", label: "精通" },
  { value: "locked", label: "已锁定" },
  { value: "archived", label: "已归档" },
];

// ---------------------------------------------------------------------------
// Edge relation -> visual config
// ---------------------------------------------------------------------------

export interface RelationVisual {
  color: string;
  strokeDasharray?: string;
  marker: "arrow" | "circle" | null;
  animated: boolean;
  label: string;
}

export function getRelationVisual(relation: string): RelationVisual {
  switch (relation as SkillEdgeRelationType) {
    case "prerequisite":
      return {
        color: "#38bdf8",
        marker: "arrow",
        animated: true,
        label: "前置",
      };
    case "contains":
      return {
        color: "#a855f7",
        strokeDasharray: "6 4",
        marker: "circle",
        animated: false,
        label: "包含",
      };
    case "supports":
      return {
        color: "#71717a",
        strokeDasharray: "2 4",
        marker: null,
        animated: false,
        label: "支撑",
      };
    default:
      return {
        color: "#71717a",
        marker: null,
        animated: false,
        label: relation,
      };
  }
}

// ---------------------------------------------------------------------------
// Client-side graph filtering (viewport concern only)
// ---------------------------------------------------------------------------

export interface GraphFilters {
  /** null = all domains */
  domainId: string | null;
  /** "all" shows every active-state skill; "archived" shows archived only */
  stateFilter: SkillDerivedState | "all";
  /** instant text filter over name + aliases */
  search: string;
}

export function filterGraph(
  graph: Pick<SkillTreeGraphResponse, "nodes" | "edges">,
  filters: GraphFilters,
): Pick<SkillTreeGraphResponse, "nodes" | "edges"> {
  const search = filters.search.trim().toLowerCase();

  const visibleNodes = graph.nodes.filter((node) => {
    if (filters.domainId !== null && node.domainId !== filters.domainId) {
      return false;
    }
    if (filters.stateFilter === "all") {
      // Mirror the server's default `status=active` scope: archived skills stay
      // out of the canvas unless the user explicitly asks for them.
      if (node.data.derivedState === "archived") return false;
    } else if (node.data.derivedState !== filters.stateFilter) {
      return false;
    }
    if (search !== "") {
      const haystack = [node.data.name, ...node.data.aliases]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = graph.edges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  );

  return { nodes: visibleNodes, edges: visibleEdges };
}

// ---------------------------------------------------------------------------
// Domain tree with per-domain skill counts
// ---------------------------------------------------------------------------

export interface DomainListItem {
  id: string;
  name: string;
  /** indentation depth derived from the parent chain (presentation only) */
  depth: number;
  count: number;
}

export function buildDomainList(
  domains: Domain[],
  nodes: SkillFlowNode[],
): DomainListItem[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (node.domainId === null) continue;
    counts.set(node.domainId, (counts.get(node.domainId) ?? 0) + 1);
  }

  const byId = new Map(domains.map((d) => [d.id, d]));
  const depthOf = (domain: Domain): number => {
    let depth = 0;
    const seen = new Set<string>([domain.id]);
    let cursor = domain.parentId ? byId.get(domain.parentId) : undefined;
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      depth += 1;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return depth;
  };

  return domains.map((domain) => ({
    id: domain.id,
    name: domain.name,
    depth: depthOf(domain),
    count: counts.get(domain.id) ?? 0,
  }));
}

/** Find a node across the full (unfiltered) graph for camera focusing. */
export function findNodeById(
  nodes: SkillFlowNode[],
  id: string,
): SkillFlowNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** Compact localized timestamp; falls back to the raw string when invalid. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
