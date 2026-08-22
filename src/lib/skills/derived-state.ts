import type {
  EvidenceRecord,
  MasteryEvent,
  SkillDetailNextUnlock,
  SkillDetailPrerequisite,
  SkillDetailResponse,
  SkillEdge,
  SkillState,
  XpTransaction,
} from "@/lib/store/types";
import { levelFromXp } from "@/lib/growth-engine/levels";

export type SkillDerivedState =
  | "locked"
  | "available"
  | "learning"
  | "proficient"
  | "advanced"
  | "archived";

/**
 * Hard Prerequisite Evaluation Invariant (Mastery + Confidence only).
 * Level (XP) cannot substitute mastery depth.
 *
 * IsPrereqFulfilled(P) <=> P.mastery_level >= 2 && P.mastery_confidence >= 0.5
 */
export function isPrereqFulfilled(prereq: {
  masteryLevel: number;
  masteryConfidence: number;
}): boolean {
  return prereq.masteryLevel >= 2 && prereq.masteryConfidence >= 0.5;
}

/**
 * Total deterministic function deriving the presentation/learning state for any valid Skill.
 *
 * Truth Table Partition (docs/Stage5/03_SKILL_TREE_API_AND_STATE.md):
 * 1. skill.status == 'archived'                                  => 'archived'
 * 2. !allPrereqsMet                                              => 'locked'
 * 3. allPrereqsMet && M >= 6 && conf >= 0.5                      => 'advanced'
 * 4. allPrereqsMet && 3 <= M < 6 && conf >= 0.5                  => 'proficient'
 * 5. allPrereqsMet && xp == 0 && M <= 1                          => 'available'
 * 6. all other combinations (xp > 0, M == 2, or low conf)        => 'learning'
 */
export function computeSkillDerivedState(
  skill: Pick<SkillState, "status" | "xp" | "masteryLevel" | "masteryConfidence">,
  prerequisites: Array<{ masteryLevel: number; masteryConfidence: number }> = [],
): SkillDerivedState {
  if (skill.status === "archived") {
    return "archived";
  }

  const allPrereqsMet = prerequisites.length === 0 || prerequisites.every(isPrereqFulfilled);

  if (!allPrereqsMet) {
    return "locked";
  }

  if (skill.masteryLevel >= 6 && skill.masteryConfidence >= 0.5) {
    return "advanced";
  }

  if (skill.masteryLevel >= 3 && skill.masteryConfidence >= 0.5) {
    return "proficient";
  }

  if (skill.xp === 0 && skill.masteryLevel <= 1) {
    return "available";
  }

  return "learning";
}

/**
 * Evaluate prerequisites for a specific skill given the graph.
 */
export function evaluatePrerequisites(
  skillId: string,
  skillsMap: Map<string, SkillState>,
  incomingEdges: SkillEdge[],
): {
  prerequisites: SkillDetailPrerequisite[];
  allPrereqsMet: boolean;
} {
  const prereqEdges = incomingEdges.filter(
    (e) => e.targetId === skillId && e.relation === "prerequisite",
  );

  const prerequisites: SkillDetailPrerequisite[] = [];

  for (const edge of prereqEdges) {
    const parentSkill = skillsMap.get(edge.sourceId);
    if (!parentSkill) continue;

    const isFulfilled = isPrereqFulfilled(parentSkill);
    prerequisites.push({
      id: parentSkill.id,
      name: parentSkill.name,
      masteryLevel: parentSkill.masteryLevel,
      masteryConfidence: parentSkill.masteryConfidence,
      isFulfilled,
    });
  }

  // Sort deterministically by name then id
  prerequisites.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const allPrereqsMet = prerequisites.length === 0 || prerequisites.every((p) => p.isFulfilled);

  return { prerequisites, allPrereqsMet };
}

/**
 * Derive "Next Unlocks" for a skill (skills for which current skill is an immediate prerequisite).
 */
export function computeNextUnlocks(
  skillId: string,
  skillsMap: Map<string, SkillState>,
  allEdges: SkillEdge[],
): SkillDetailNextUnlock[] {
  // Outgoing prerequisite edges: skillId -> targetId
  const outgoingPrereqEdges = allEdges.filter(
    (e) => e.sourceId === skillId && e.relation === "prerequisite",
  );

  const nextUnlocks: SkillDetailNextUnlock[] = [];

  for (const edge of outgoingPrereqEdges) {
    const targetSkill = skillsMap.get(edge.targetId);
    if (!targetSkill || targetSkill.status === "archived") continue;

    // Collect all incoming prerequisites for this target
    const targetIncoming = allEdges.filter(
      (e) => e.targetId === targetSkill.id && e.relation === "prerequisite",
    );
    const targetPrereqStates: Array<{ masteryLevel: number; masteryConfidence: number }> = [];
    for (const inEdge of targetIncoming) {
      const parent = skillsMap.get(inEdge.sourceId);
      if (parent) {
        targetPrereqStates.push(parent);
      }
    }

    const derivedState = computeSkillDerivedState(targetSkill, targetPrereqStates);
    nextUnlocks.push({
      id: targetSkill.id,
      name: targetSkill.name,
      derivedState,
    });
  }

  nextUnlocks.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return nextUnlocks;
}

/**
 * Assemble pure SkillDetailResponse snapshot for a single skill.
 */
export function assembleSkillDetail(params: {
  skill: SkillState;
  domainName: string | null;
  allSkills: SkillState[];
  allEdges: SkillEdge[];
  evidenceRecords: EvidenceRecord[];
  masteryEvents: MasteryEvent[];
  transactions: XpTransaction[];
  activityTitlesMap?: Map<string, string>;
}): SkillDetailResponse {
  const {
    skill,
    domainName,
    allSkills,
    allEdges,
    evidenceRecords,
    masteryEvents,
    transactions,
    activityTitlesMap = new Map(),
  } = params;

  const skillsMap = new Map(allSkills.map((s) => [s.id, s]));

  // 1. Evaluate incoming prerequisites
  const { prerequisites } = evaluatePrerequisites(skill.id, skillsMap, allEdges);

  // 2. Compute self derived state
  const derivedState = computeSkillDerivedState(skill, prerequisites);

  // 3. Compute next unlocks
  const nextUnlocks = computeNextUnlocks(skill.id, skillsMap, allEdges);

  // 4. Compute nextLevelXp from deterministic growth curve
  const levelInfo = levelFromXp(skill.xp);

  // 5. Filter and format evidence timeline (sorted descending by created_at)
  const skillEvidence = evidenceRecords
    .filter((e) => e.skillId === skill.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({
      id: e.id,
      activityId: e.activityId,
      activityTitle: activityTitlesMap.get(e.activityId) ?? null,
      evidenceLevel: e.evidenceLevel,
      evidenceType: e.evidenceType,
      description: e.description,
      verified: e.verified,
      createdAt: e.createdAt,
    }));

  // 6. Filter and format mastery history (sorted descending by created_at)
  const skillMasteryEvents = masteryEvents
    .filter((me) => me.skillId === skill.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((me) => ({
      id: me.id,
      eventType: me.eventType,
      fromLevel: me.fromLevel,
      toLevel: me.toLevel,
      confidence: me.confidence,
      reason: me.reason,
      createdAt: me.createdAt,
    }));

  // 7. Filter and format recent transactions (sorted descending by created_at)
  const skillTransactions = transactions
    .filter((tx) => tx.skillId === skill.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      reason: tx.reason,
      createdAt: tx.createdAt,
    }));

  return {
    skill: {
      id: skill.id,
      name: skill.name,
      aliases: skill.aliases,
      description: skill.description ?? null,
      domainId: skill.domainId ?? null,
      domainName: domainName ?? null,
      level: skill.level,
      xp: skill.xp,
      nextLevelXp: levelInfo.nextLevelXp,
      masteryLevel: skill.masteryLevel,
      masteryConfidence: skill.masteryConfidence,
      derivedState,
      lastUsedAt: skill.lastUsedAt,
      createdAt: skill.createdAt ?? "1970-01-01T00:00:00.000Z",
    },
    prerequisites,
    nextUnlocks,
    evidenceTimeline: skillEvidence,
    masteryHistory: skillMasteryEvents,
    recentTransactions: skillTransactions,
  };
}
