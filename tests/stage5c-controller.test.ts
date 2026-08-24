import { describe, expect, test } from "vitest";
import type { SkillFlowNode } from "@/lib/store/types";
import {
  buildMetadataPatch,
  nextArchiveStatus,
  resolveFocusTarget,
} from "@/app/skills/components/controller";
import type { SkillNodeViewData } from "@/app/skills/components/SkillNode";

function makeNode(
  id: string,
  derivedState: SkillNodeViewData["derivedState"],
  position = { x: 120, y: 240 },
): SkillFlowNode {
  return {
    id,
    domainId: null,
    position,
    data: {
      name: `Skill ${id}`,
      aliases: [],
      level: 1,
      xp: 0,
      masteryLevel: 1,
      masteryConfidence: 0.4,
      derivedState,
      lastUsedAt: null,
      prerequisiteCount: 0,
      unfulfilledPrerequisiteCount: 0,
    },
  };
}

describe("Stage 5C controller — P1-1 archived-focus regression", () => {
  const nodes = [
    makeNode("active-skill", "learning"),
    makeNode("archived-skill", "archived"),
    makeNode("locked-skill", "locked"),
  ];

  test("focusing an ARCHIVED skill selects the 'archived' filter so the node stays visible", () => {
    const focus = resolveFocusTarget(nodes, "archived-skill");
    expect(focus.found).toBe(true);
    // The exact reviewer contract: archived target → stateFilter "archived"
    expect(focus.stateFilter).toBe("archived");
    expect(focus.position).toEqual({ x: 120, y: 240 });
  });

  test("focusing an ACTIVE skill keeps the normal 'all' active scope", () => {
    for (const id of ["active-skill", "locked-skill"]) {
      const focus = resolveFocusTarget(nodes, id);
      expect(focus.found).toBe(true);
      expect(focus.stateFilter).toBe("all");
    }
  });

  test("focus resolution searches the FULL graph, never a pre-filtered view", () => {
    // An archived node would be absent from the "all" viewport; resolving
    // against the full node list must still find it.
    const fullGraphOnly = nodes.filter((n) => n.data.derivedState === "archived");
    expect(resolveFocusTarget(fullGraphOnly, "archived-skill").found).toBe(true);
  });

  test("unknown skill resolves to not-found with default 'all' scope", () => {
    const focus = resolveTargetSafe(nodes, "missing");
    expect(focus.found).toBe(false);
    expect(focus.position).toBeNull();
    expect(focus.stateFilter).toBe("all");
  });

  function resolveTargetSafe(list: SkillFlowNode[], id: string) {
    return resolveFocusTarget(list, id);
  }
});

describe("Stage 5C controller — PATCH metadata whitelist", () => {
  test("payload contains ONLY name/aliases/description/domainId", () => {
    const result = buildMetadataPatch({
      name: "  Deep Work  ",
      aliasesRaw: "专注, deep work, ， 深度工作",
      description: "  长时间不受干扰地工作 ",
      domainId: "d-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.patch).sort()).toEqual([
      "aliases",
      "description",
      "domainId",
      "name",
    ]);
    expect(result.patch).not.toHaveProperty("status");
    expect(result.patch.name).toBe("Deep Work");
    expect(result.patch.aliases).toEqual(["专注", "deep work", "深度工作"]);
    // description passes through verbatim (only fully-blank collapses to null)
    expect(result.patch.description).toBe("  长时间不受干扰地工作 ");
  });

  test("empty description/domain collapse to null; empty name is rejected", () => {
    const empty = buildMetadataPatch({ name: "X", aliasesRaw: "", description: "   ", domainId: "" });
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.patch.description).toBeNull();
      expect(empty.patch.domainId).toBeNull();
      expect(empty.patch.aliases).toEqual([]);
    }

    const rejected = buildMetadataPatch({ name: "   ", aliasesRaw: "", description: "", domainId: "" });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error).toContain("名称不能为空");
  });
});

describe("Stage 5C controller — archive/unarchive toggle", () => {
  test("archived → PATCH status 'active'; any other state → PATCH status 'archived'", () => {
    expect(nextArchiveStatus("archived")).toBe("active");
    for (const state of ["locked", "available", "learning", "proficient", "advanced"] as const) {
      expect(nextArchiveStatus(state)).toBe("archived");
    }
  });
});
