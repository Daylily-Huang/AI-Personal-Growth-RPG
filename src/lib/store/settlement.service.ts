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
  XpTransaction,
} from "./types";

const DEFAULT_SKILL_MASTERY = 1;

/** Round4: every ordinary Activity settles as `standard` until a Quest is bound. */
export const DEFAULT_QUEST_SIZE: QuestSize = "standard";

const SIMILARITY_WINDOW_DAYS = 30;
const MAX_REPETITION_CONFLICT_RETRIES = 3;

/**
 * Domain service for the Growth Loop — the SINGLE copy of settlement rules.
 *
 * Milestone 2.7 additions:
 * - one `xpType="activity"` settlement per Activity (the store also guards this);
 * - `rulesVersion` is frozen on the Activity and recorded on the ledger, so a
 *   future engine upgrade never silently re-arbitrates old histories;
 * - repetition snapshot conflicts are retried with a fresh count (optimistic
 *   concurrency), because the authoritative count is derived inside the store's
 *   atomic write.
 */
export class SettlementService {
  constructor(private readonly repo: Repository) {}

  async confirmAssessment(assessmentId: string): Promise<ConfirmResult> {
    for (let attempt = 0; attempt < MAX_REPETITION_CONFLICT_RETRIES; attempt++) {
      const { result, retry } = await this.trySettleOnce(assessmentId);
      if (retry) continue;
      return result;
    }
    return { ok: false, reason: "repetition_conflict_retry_exhausted" };
  }

  private async trySettleOnce(assessmentId: string): Promise<{ result: ConfirmResult; retry: boolean }> {
    const assessment = await this.repo.getAssessment(assessmentId);
    if (!assessment) return { result: { ok: false, reason: "not_found" }, retry: false };
    if (assessment.status !== "pending") {
      return { result: { ok: false, reason: "already_confirmed", assessment }, retry: false };
    }

    const activity = await this.repo.getActivity(assessment.activityId);
    if (!activity) return { result: { ok: false, reason: "activity_not_found" }, retry: false };

    const now = new Date().toISOString();
    const skillName = assessment.proposal.affected_skills[0]?.name ?? "General Growth";
    const skillLabel = assessment.proposal.affected_skills[0]?.name ?? "General Growth";
    const activityType = assessment.proposal.activity.type;

    // Read-only stable id lookup: skill creation happens ONLY inside the store's
    // atomic applySettlement, never here (Round6 — no side effects on failure).
    const existingSkillId = await this.repo.lookupSkillId(skillLabel);
    const skillId = existingSkillId ?? "";

    // Repetition only counts SIMILAR prior activities by the SAME STABLE SKILL ID
    // (aliases count as one and the same skill) + same type + 30-day window.
    const transactions = await this.repo.listTransactions();
    const recentSimilarCount = countRecentSimilar(transactions, {
      skillId,
      activityType,
      windowDays: SIMILARITY_WINDOW_DAYS,
    });

    // Milestone 4.1: Fetch authoritative bound Quest if linked to use actual questSize cap
    let effectiveQuestSize: QuestSize = DEFAULT_QUEST_SIZE;
    if (activity.questId) {
      const boundQuest = await this.repo.getQuest(activity.questId);
      if (boundQuest) {
        effectiveQuestSize = boundQuest.questSize;
      }
    }

    const xpInput: XpInput = {
      baseValue: assessment.proposal.xp_semantics.base_value,
      difficulty: assessment.proposal.xp_semantics.difficulty,
      masteryGain: assessment.proposal.xp_semantics.mastery_gain,
      evidence: assessment.proposal.evidence.level,
      novelty: assessment.proposal.xp_semantics.novelty,
      goalAlignment: assessment.proposal.xp_semantics.goal_alignment,
      repetitionCount: recentSimilarCount,
      effectiveMinutes: activity.effectiveMinutes ?? undefined,
      questSize: effectiveQuestSize,
    };
    const xpResult = calculateXp(xpInput);
    const xpDelta = xpResult.finalXp;

    const currentSkill = await this.repo.getSkill(skillLabel);
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
        skillId, // placeholder — the repository sets the authoritative id
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

    // Secondary skills: only labels travel; the store resolves/creates nodes
    // and related edges by stable id inside the atomic settlement.
    const relatedSkillLabels = assessment.proposal.affected_skills
      .slice(1)
      .map((s) => s.name);

    const transaction: XpTransaction = {
      id: crypto.randomUUID(),
      activityId: activity.id,
      assessmentId: assessment.id,
      xpType: "activity",
      skillId, // placeholder — the repository sets the authoritative id
      skillName,
      activityType,
      repetitionCount: recentSimilarCount,
      repetitionPenalty: xpResult.modifiers.repetitionPenalty,
      amount: xpDelta,
      baseAmount: assessment.proposal.xp_semantics.base_value,
      modifierJson: xpResult.modifiers as unknown as Record<string, unknown>,
      reason: activity.rawInput,
      // Milestone 2.7: the ledger records the rule set frozen at Activity
      // creation, NOT whatever engine is deployed today.
      rulesVersion: activity.rulesVersion,
      createdAt: now,
    };

    const settlement: SettlementToApply = {
      assessmentId: assessment.id,
      transaction,
      xpDelta,
      primarySkill: {
        name: skillName,
        xpDelta,
        masteryAction,
      },
      relatedSkillLabels,
      player: { xpDelta },
      masteryVerification,
    };

    const result = await this.repo.applySettlement(settlement);
    if (result.ok) {
      return {
        result: {
          ok: true,
          transaction: result.transaction,
          assessment: (await this.repo.getAssessment(assessmentId)) ?? undefined,
          masteryVerification: result.masteryVerification ?? undefined,
        },
        retry: false,
      };
    }

    if (result.reason === "repetition_conflict") {
      // Optimistic concurrency: re-read with the fresh authoritative count.
      return {
        result: { ok: false, reason: "repetition_conflict", actualRepetitionCount: result.actualRepetitionCount },
        retry: true,
      };
    }

    const assessmentNow = (await this.repo.getAssessment(assessmentId)) ?? undefined;
    return { result: { ok: false, reason: result.reason, assessment: assessmentNow }, retry: false };
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
