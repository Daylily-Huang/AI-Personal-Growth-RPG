import crypto from "node:crypto";
import { checkMasteryProposal } from "@/lib/growth-engine/mastery";
import { calculateXp, type QuestSize, type XpInput } from "@/lib/growth-engine/xp";
import { countRecentSimilar } from "@/lib/store/similarity";
import type { AssessmentProposal } from "@/lib/ai/schemas";
import type { Repository } from "./repository";
import type {
  ConfirmResult,
  MasteryVerification,
  MasteryAction,
  SettlementToApply,
  SkillEdge,
  XpTransaction,
} from "./types";

const DEFAULT_SKILL_MASTERY = 1;

/** Round4: every ordinary Activity settles as `standard` until a Quest is bound. */
export const DEFAULT_QUEST_SIZE: QuestSize = "standard";

const SIMILARITY_WINDOW_DAYS = 30;

/**
 * Domain service for the Growth Loop — the SINGLE copy of settlement rules.
 *
 * Milestone 2.6:
 * - async (Repository port is async for Supabase)
 * - DELTA semantics: it computes the transaction + deltas, the repository
 *   applies `current += delta` atomically (no lost updates).
 * - Mastery verification is now enforced: `verificationRequired` upgrades are
 *   NOT applied; they create a pending MasteryVerification instead.
 */
export class SettlementService {
  constructor(private readonly repo: Repository) {}

  async confirmAssessment(assessmentId: string): Promise<ConfirmResult> {
    const assessment = await this.repo.getAssessment(assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (assessment.status !== "pending") {
      return { ok: false, reason: "already_confirmed", assessment };
    }

    const activity = await this.repo.getActivity(assessment.activityId);
    if (!activity) return { ok: false, reason: "activity_not_found" };

    const now = new Date().toISOString();
    const skillName = assessment.proposal.affected_skills[0]?.name ?? "General Growth";
    const activityType = assessment.proposal.activity.type;

    // Repetition only counts SIMILAR prior activities (same skill + same type
    // + 30-day window) — never the total ledger size.
    const transactions = await this.repo.listTransactions();
    const recentSimilarCount = countRecentSimilar(transactions, {
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
      questSize: DEFAULT_QUEST_SIZE,
    };
    const xpResult = calculateXp(xpInput);
    const xpDelta = xpResult.finalXp;

    const transaction: XpTransaction = {
      id: crypto.randomUUID(),
      activityId: activity.id,
      assessmentId: assessment.id,
      skillName,
      activityType,
      repetitionCount: recentSimilarCount,
      repetitionPenalty: xpResult.modifiers.repetitionPenalty,
      amount: xpDelta,
      baseAmount: assessment.proposal.xp_semantics.base_value,
      modifierJson: xpResult.modifiers as unknown as Record<string, unknown>,
      reason: activity.rawInput,
      rulesVersion: xpResult.rulesVersion,
      createdAt: now,
    };

    const currentSkill = await this.repo.getSkill(skillName);
    const currentMastery = currentSkill?.masteryLevel ?? DEFAULT_SKILL_MASTERY;
    const masteryAction = decideMasteryAction({
      changes: assessment.proposal.mastery_changes,
      skillName,
      currentMastery,
      evidenceLevel: assessment.proposal.evidence.level,
    });

    let masteryVerification: MasteryVerification | undefined;
    if (masteryAction.action === "request_verification") {
      masteryVerification = {
        id: crypto.randomUUID(),
        skillName,
        fromLevel: masteryAction.fromLevel,
        toLevel: masteryAction.toLevel,
        evidenceLevel: assessment.proposal.evidence.level,
        status: "pending",
        proposalAssessmentId: assessment.id,
        createdAt: now,
        resolvedAt: null,
      };
    }

    // Related skills (names) + candidate edges for the Skill Tree.
    const relatedSkillNames = assessment.proposal.affected_skills
      .slice(1)
      .map((s) => s.name);
    const newEdges: SkillEdge[] = relatedSkillNames.map((name) => ({
      source: skillName,
      target: name,
      relation: "related",
    }));

    const settlement: SettlementToApply = {
      assessmentId: assessment.id,
      transaction,
      xpDelta,
      primarySkill: {
        name: skillName,
        xpDelta,
        masteryAction,
      },
      relatedSkillNames,
      newEdges,
      player: { xpDelta },
      masteryVerification,
    };

    const result = await this.repo.applySettlement(settlement);
    if (!result.ok) {
      if (result.reason === "already_confirmed") {
        return {
          ok: false,
          reason: "already_confirmed",
          assessment: (await this.repo.getAssessment(assessmentId)) ?? undefined,
        };
      }
      return { ok: false, reason: result.reason };
    }

    return {
      ok: true,
      transaction: settlement.transaction,
      assessment: (await this.repo.getAssessment(assessmentId)) ?? undefined,
      masteryVerification,
    };
  }
}

function decideMasteryAction(input: {
  changes: AssessmentProposal["mastery_changes"];
  skillName: string;
  currentMastery: number;
  evidenceLevel: number;
}): MasteryAction {
  const change =
    input.changes.find((c) => c.target_name === input.skillName) ?? input.changes[0];
  if (!change) return { action: "none" };

  const check = checkMasteryProposal(input.currentMastery, change.proposed_level, input.evidenceLevel);
  if (!check.allowed) return { action: "none" };
  if (change.proposed_level <= input.currentMastery) return { action: "none" };

  if (check.verificationRequired) {
    return {
      action: "request_verification",
      fromLevel: input.currentMastery,
      toLevel: change.proposed_level,
      confidence: change.confidence,
    };
  }
  return { action: "upgrade", proposedLevel: change.proposed_level, confidence: change.confidence };
}
