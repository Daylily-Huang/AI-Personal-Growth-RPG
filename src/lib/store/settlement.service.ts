import crypto from "node:crypto";
import { levelFromXp } from "@/lib/growth-engine/levels";
import { checkMasteryProposal } from "@/lib/growth-engine/mastery";
import { calculateXp, type XpInput } from "@/lib/growth-engine/xp";
import { countRecentSimilar } from "@/lib/store/similarity";
import type { Repository } from "./repository";
import type { ConfirmResult, SettlementToApply, SkillEdge, SkillState, XpTransaction } from "./types";

const DEFAULT_SKILL_IDENTITY = {
  level: 1,
  masteryLevel: 1,
  masteryConfidence: 0.5,
} as const;

const SIMILARITY_WINDOW_DAYS = 30;

/**
 * Domain service for the Growth Loop.
 *
 * This is the SINGLE copy of the settlement business rules:
 *   - similarity counting (repetition)
 *   - deterministic XP calculation
 *   - evidence-constrained mastery updates
 *   - primary/related skill state and edges
 *   - player totals
 *
 * It speaks to the `Repository` port, so the demo JSON store and the future
 * Supabase store share this exact logic — never duplicated.
 */
export class SettlementService {
  constructor(private readonly repo: Repository) {}

  confirmAssessment(assessmentId: string): ConfirmResult {
    const assessment = this.repo.getAssessment(assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (assessment.status !== "pending") {
      return { ok: false, reason: "already_confirmed", assessment };
    }

    const activity = this.repo.getActivity(assessment.activityId);
    if (!activity) return { ok: false, reason: "activity_not_found" };

    const now = new Date().toISOString();
    const skillName = assessment.proposal.affected_skills[0]?.name ?? "General Growth";
    const activityType = assessment.proposal.activity.type;

    // Repetition only counts SIMILAR prior activities (same skill + same type
    // + 30-day window) — never the total ledger size.
    const recentSimilarCount = countRecentSimilar(this.repo.listTransactions(), {
      skillName,
      activityType,
      windowDays: SIMILARITY_WINDOW_DAYS,
    });

    const xpInput: XpInput = {
      baseValue: assessment.proposal.xp_semantics.base_value,
      difficulty: assessment.proposal.xp_semantics.difficulty,
      masteryGain: assessment.proposal.xp_semantics.mastery_gain,
      evidence: assessment.proposal.evidence.level,
      novelty: assessment.proposal.xp_semantics.novelty,
      goalAlignment: assessment.proposal.xp_semantics.goal_alignment,
      repetitionCount: recentSimilarCount,
      effectiveMinutes: activity.effectiveMinutes ?? undefined,
    };
    const xpResult = calculateXp(xpInput);

    const transaction: XpTransaction = {
      id: crypto.randomUUID(),
      activityId: activity.id,
      assessmentId: assessment.id,
      skillName,
      activityType,
      repetitionCount: recentSimilarCount,
      repetitionPenalty: xpResult.modifiers.repetitionPenalty,
      amount: xpResult.finalXp,
      baseAmount: assessment.proposal.xp_semantics.base_value,
      modifierJson: xpResult.modifiers as unknown as Record<string, unknown>,
      reason: activity.rawInput,
      rulesVersion: xpResult.rulesVersion,
      createdAt: now,
    };

    const currentSkill = this.repo.getSkill(skillName) ?? defaultSkill(skillName);
    const primarySkill: SkillState = {
      ...currentSkill,
      xp: currentSkill.xp + xpResult.finalXp,
      level: levelFromXp(currentSkill.xp + xpResult.finalXp).level,
      lastUsedAt: now,
    };

    const masteryChange = assessment.proposal.mastery_changes[0];
    if (masteryChange) {
      const check = checkMasteryProposal(
        primarySkill.masteryLevel,
        masteryChange.proposed_level,
        assessment.proposal.evidence.level,
      );
      if (check.allowed && masteryChange.proposed_level > primarySkill.masteryLevel) {
        primarySkill.masteryLevel = masteryChange.proposed_level;
        primarySkill.masteryConfidence = masteryChange.confidence;
      }
    }

    // Related skills (so the Skill Tree can show them) + candidate edges.
    const relatedSkills: SkillState[] = [];
    const newEdges: SkillEdge[] = [];
    for (const related of assessment.proposal.affected_skills.slice(1)) {
      if (!this.repo.getSkill(related.name)) {
        relatedSkills.push(defaultSkill(related.name));
      }
      newEdges.push({ source: skillName, target: related.name, relation: "related" });
    }

    const player = this.repo.getPlayer();
    const updatedPlayer = {
      ...player,
      totalXp: player.totalXp + xpResult.finalXp,
      playerLevel: levelFromXp(player.totalXp + xpResult.finalXp).level,
    };

    const settlement: SettlementToApply = {
      assessmentId: assessment.id,
      transaction,
      primarySkill,
      relatedSkills,
      newEdges,
      player: updatedPlayer,
    };

    const result = this.repo.applySettlement(settlement);
    if (!result.ok) {
      if (result.reason === "already_confirmed") {
        return {
          ok: false,
          reason: "already_confirmed",
          assessment: this.repo.getAssessment(assessmentId) ?? undefined,
        };
      }
      return { ok: false, reason: result.reason };
    }

    return {
      ok: true,
      transaction: settlement.transaction,
      assessment: this.repo.getAssessment(assessmentId) ?? undefined,
    };
  }
}

export const SIMILARITY_WINDOW_DAYS_CONFIG = SIMILARITY_WINDOW_DAYS;

function defaultSkill(name: string): SkillState {
  return {
    name,
    xp: 0,
    ...DEFAULT_SKILL_IDENTITY,
    lastUsedAt: null,
  };
}
