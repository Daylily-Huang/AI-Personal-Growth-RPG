import type { SkillDerivedState, SkillFlowNode } from "@/lib/store/types";

/**
 * Stage 5C interaction controllers (pure, framework-free).
 *
 * These helpers own the UI *state transitions* of the skills workspace so the
 * page component stays a thin wiring layer. Like presentation.ts they must
 * NEVER recompute mastery thresholds, prerequisite fulfillment, or any
 * authority-owned value — they only read Stage 5B facts
 * (node.data.derivedState) and map them to viewport/UI state.
 */

export interface FocusResolution {
  /** whether the skill exists in the full (unfiltered) graph */
  found: boolean;
  /** node position for camera centering; null when not found */
  position: { x: number; y: number } | null;
  /**
   * State-filter value required so the focused node stays visible on canvas.
   *
   * `filterGraph` hides archived nodes under "all" (mirroring the API's
   * active-only default scope), so focusing an archived skill must switch the
   * viewport to the explicit "archived" pill — otherwise the detail panel
   * would open for an invisible target.
   */
  stateFilter: SkillDerivedState | "all";
}

/** Resolve focus filters from the FULL graph (never the filtered view). */
export function resolveFocusTarget(
  nodes: SkillFlowNode[],
  skillId: string,
): FocusResolution {
  const node = findFocusNode(nodes, skillId);
  if (!node) {
    return { found: false, position: null, stateFilter: "all" };
  }
  return {
    found: true,
    position: node.position,
    stateFilter:
      node.data.derivedState === "archived" ? "archived" : "all",
  };
}

function findFocusNode(
  nodes: SkillFlowNode[],
  id: string,
): SkillFlowNode | undefined {
  return nodes.find((n) => n.id === id);
}

/** Fields allowed by the Stage 5B PATCH /api/skills/[id] metadata whitelist. */
export interface SkillMetadataPatch {
  name: string;
  aliases: string[];
  description: string | null;
  domainId: string | null;
}

export interface SkillMetadataFormInput {
  name: string;
  aliasesRaw: string;
  description: string;
  domainId: string;
}

/**
 * Build the PATCH payload for the metadata editor.
 * Returns ONLY whitelisted fields (name/aliases/description/domainId);
 * status must go through buildStatusPatch instead.
 */
export function buildMetadataPatch(
  input: SkillMetadataFormInput,
): { ok: true; patch: SkillMetadataPatch } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, error: "名称不能为空" };
  }
  return {
    ok: true,
    patch: {
      name,
      aliases: input.aliasesRaw
        .split(/[,，]/)
        .map((a) => a.trim())
        .filter(Boolean),
      description: input.description.trim() === "" ? null : input.description,
      domainId: input.domainId === "" ? null : input.domainId,
    },
  };
}

/** Archive toggle: archived → unarchive to active; anything else → archived. */
export function nextArchiveStatus(
  derivedState: SkillDerivedState,
): "active" | "archived" {
  return derivedState === "archived" ? "active" : "archived";
}
