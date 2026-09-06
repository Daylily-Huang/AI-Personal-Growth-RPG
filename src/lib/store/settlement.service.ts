import crypto from "node:crypto";
import { checkMasteryProposal } from "@/lib/growth-engine/mastery";
import { calculateXp, type QuestSize, type XpInput } from "@/lib/growth-engine/xp";
import { calculateQuestProgressDelta } from "@/lib/growth-engine/quest-progression";
import { countRecentSimilar } from "@/lib/store/similarity";
import type { AssessmentProposal } from "@/lib/ai/schemas";
import type { Repository } from "./repository";
import { isValidUuid } from "@/lib/http/validation";
import type {
  ConfirmResult,
  MasteryVerification,
  MasteryAction,
  SettlementToApply,
  SkillResolutionInput,
  ArtifactResolutionInput,
  XpTransaction,
} from "./types";

const DEFAULT_SKILL_MASTERY = 1;

/** Round4: every ordinary Activity settles as `standard` until a Quest is bound. */
export const DEFAULT_QUEST_SIZE: QuestSize = "standard";

const SIMILARITY_WINDOW_DAYS = 30;
const MAX_REPETITION_CONFLICT_RETRIES = 3;

export interface ConfirmAssessmentOptions {
  artifactResolutions?: ArtifactResolutionInput[];
}

/**
 * Domain service for the Growth Loop — the SINGLE copy of settlement rules.
 *
 * Stage 5A additions:
 * - Skill resolution discriminated union (`existing` vs `create`);
 * - Authoritative evidence record persistence alongside activity settlement;
 * - Preservation of the native MasteryAction 3-state protocol (`none` / `upgrade` / `request_verification`).
 *
 * Stage 7B additions:
 * - Artifact resolution discriminated union (`create` vs `existing` vs `ignore`);
 * - Exact N-of-N proposal coverage validation;
 * - Single atomic settlement transaction covering XP, Skills, Evidence, Quests, Artifacts.
 */
export class SettlementService {
  constructor(private readonly repo: Repository) {}

  async confirmAssessment(
    assessmentId: string,
    options?: ConfirmAssessmentOptions,
  ): Promise<ConfirmResult> {
    for (let attempt = 0; attempt < MAX_REPETITION_CONFLICT_RETRIES; attempt++) {
      const { result, retry } = await this.trySettleOnce(assessmentId, options);
      if (retry) continue;
      return result;
    }
    return { ok: false, reason: "repetition_conflict_retry_exhausted" };
  }

  private async trySettleOnce(
    assessmentId: string,
    options?: ConfirmAssessmentOptions,
  ): Promise<{ result: ConfirmResult; retry: boolean }> {
    const assessment = await this.repo.getAssessment(assessmentId);
    if (!assessment) return { result: { ok: false, reason: "not_found" }, retry: false };
    if (assessment.status !== "pending") {
      return { result: { ok: false, reason: "already_confirmed", assessment }, retry: false };
    }

    const activity = await this.repo.getActivity(assessment.activityId);
    if (!activity) return { result: { ok: false, reason: "activity_not_found" }, retry: false };

    // Stage 7B Artifact resolution validation
    const storedProposals = assessment.proposal.artifactProposals ?? [];
    const proposalCount = storedProposals.length;
    const resolutions = options?.artifactResolutions;

    if (proposalCount > 0) {
      if (!resolutions || !Array.isArray(resolutions) || resolutions.length !== proposalCount) {
        return { result: { ok: false, reason: "incomplete_proposal_coverage" }, retry: false };
      }

      const canonicalTypes = new Set([
        "document",
        "code_repository",
        "design_spec",
        "data_analysis",
        "presentation",
        "synthesis_note",
        "creative_work",
        "other",
      ]);
      const allowedOverrideKeys = new Set([
        "title",
        "artifactType",
        "summary",
        "description",
        "version",
        "externalUrl",
        "storagePath",
        "reusabilityScore",
      ]);

      const seen = new Set<number>();
      for (const res of resolutions) {
        if (typeof res.proposalIndex !== "number" || !Number.isInteger(res.proposalIndex)) {
          return { result: { ok: false, reason: "invalid_proposal_index" }, retry: false };
        }
        if (res.proposalIndex < 0 || res.proposalIndex >= proposalCount) {
          return { result: { ok: false, reason: "out_of_range_proposal_index" }, retry: false };
        }
        if (seen.has(res.proposalIndex)) {
          return { result: { ok: false, reason: "duplicate_proposal_index" }, retry: false };
        }
        seen.add(res.proposalIndex);

        if (res.resolution !== "create" && res.resolution !== "existing" && res.resolution !== "ignore") {
          return { result: { ok: false, reason: "invalid_artifact_resolution" }, retry: false };
        }

        if (res.resolution === "existing") {
          if (!res.artifactId || typeof res.artifactId !== "string" || !isValidUuid(res.artifactId)) {
            return { result: { ok: false, reason: "invalid_existing_artifact_id" }, retry: false };
          }
          if (res.activityRole !== undefined && res.activityRole !== "produced" && res.activityRole !== "modified" && res.activityRole !== "referenced") {
            return { result: { ok: false, reason: "invalid_activity_role" }, retry: false };
          }
        }

        if (res.resolution === "create" && res.approvedOverrides !== undefined) {
          if (typeof res.approvedOverrides !== "object" || res.approvedOverrides === null || Array.isArray(res.approvedOverrides)) {
            return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
          }
          const overrides = res.approvedOverrides as Record<string, unknown>;
          for (const key of Object.keys(overrides)) {
            if (!allowedOverrideKeys.has(key)) {
              return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
            }
          }
          if (overrides.title !== undefined) {
            if (typeof overrides.title !== "string" || !overrides.title.trim()) {
              return { result: { ok: false, reason: "empty_artifact_title" }, retry: false };
            }
          }
          if (overrides.artifactType !== undefined) {
            if (typeof overrides.artifactType !== "string" || !canonicalTypes.has(overrides.artifactType)) {
              return { result: { ok: false, reason: "invalid_artifact_type" }, retry: false };
            }
          }
          if (overrides.reusabilityScore !== undefined) {
            if (typeof overrides.reusabilityScore !== "number" || isNaN(overrides.reusabilityScore) || overrides.reusabilityScore < 0 || overrides.reusabilityScore > 1) {
              return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
            }
          }
          if (overrides.summary !== undefined && overrides.summary !== null && typeof overrides.summary !== "string") {
            return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
          }
          if (overrides.description !== undefined && overrides.description !== null && typeof overrides.description !== "string") {
            return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
          }
          if (overrides.version !== undefined && overrides.version !== null && typeof overrides.version !== "string") {
            return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
          }
          if (overrides.externalUrl !== undefined && overrides.externalUrl !== null && typeof overrides.externalUrl !== "string") {
            return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
          }
          if (overrides.storagePath !== undefined && overrides.storagePath !== null && typeof overrides.storagePath !== "string") {
            return { result: { ok: false, reason: "invalid_approved_overrides" }, retry: false };
          }
        }
      }
    } else {
      if (resolutions && Array.isArray(resolutions) && resolutions.length > 0) {
        return { result: { ok: false, reason: "unexpected_artifact_resolutions" }, retry: false };
      }
    }



    const now = new Date().toISOString();
    const skillName = assessment.proposal.affected_skills[0]?.name ?? "General Growth";
    const skillLabel = assessment.proposal.affected_skills[0]?.name ?? "General Growth";
    const activityType = assessment.proposal.activity.type;

    // Read-only stable id lookup: skill creation happens ONLY inside the store's
    // atomic applySettlement, never here (Round6 — no side effects on failure).
    const existingSkillId = await this.repo.lookupSkillId(skillLabel);
    const skillId = existingSkillId ?? "";

    // Primary skill resolution authority (Discriminated Union)
    const primarySkillResolution: SkillResolutionInput = existingSkillId
      ? { resolution: "existing", skillId: existingSkillId }
      : { resolution: "create", proposedName: skillLabel };

    // Repetition only counts SIMILAR prior activities by the SAME STABLE SKILL ID
    // (aliases count as one and the same skill) + same type + 30-day window.
    // P1-A Fix: brand new skill without a persistent UUID has 0 prior transactions by definition.
    // P2-01: Prefer authoritative countRecentSimilarTransactions to prevent truncation by unpaged listTransactions.
    const recentSimilarCount =
      !skillId
        ? 0
        : typeof this.repo.countRecentSimilarTransactions === "function"
          ? await this.repo.countRecentSimilarTransactions({
              skillId,
              activityType,
              windowDays: SIMILARITY_WINDOW_DAYS,
            })
          : countRecentSimilar(await this.repo.listTransactions(), {
              skillId,
              activityType,
              windowDays: SIMILARITY_WINDOW_DAYS,
            });

    // Milestone 4.2 / Round26 (P1-5): Use frozen quest size snapshot on Activity first
    let effectiveQuestSize: QuestSize = activity.questSizeSnapshot ?? DEFAULT_QUEST_SIZE;
    if (!activity.questSizeSnapshot && activity.questId) {
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

    // Milestone 4.2 / Round26 (P1-4): Shared deterministic quest progression delta
    const questProgressDelta = activity.questId
      ? calculateQuestProgressDelta({
          effectiveMinutes: activity.effectiveMinutes,
          completion: assessment.proposal.activity.completion,
        })
      : undefined;

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

    // Secondary skills: resolve existing vs create
    const relatedSkillLabels = assessment.proposal.affected_skills
      .slice(1)
      .map((s) => s.name);

    const relatedSkillResolutions: SkillResolutionInput[] = [];
    for (const label of relatedSkillLabels) {
      const existingId = await this.repo.lookupSkillId(label);
      if (existingId) {
        relatedSkillResolutions.push({ resolution: "existing", skillId: existingId });
      } else {
        relatedSkillResolutions.push({ resolution: "create", proposedName: label });
      }
    }

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
      modifierJson: {
        ...xpResult.modifiers,
        ...(activity.questIdSnapshot ? { questIdSnapshot: activity.questIdSnapshot } : {}),
        ...(activity.questTitleSnapshot ? { questTitleSnapshot: activity.questTitleSnapshot } : {}),
      } as unknown as Record<string, unknown>,
      reason: activity.rawInput,
      rulesVersion: activity.rulesVersion,
      createdAt: now,
    };

    const settlement: SettlementToApply = {
      assessmentId: assessment.id,
      transaction,
      xpDelta,
      primarySkill: {
        skill: primarySkillResolution,
        name: skillName,
        xpDelta,
        masteryAction,
      },
      relatedSkillResolutions,
      player: { xpDelta },
      masteryVerification,
      evidence: {
        level: assessment.proposal.evidence.level,
        explanation: assessment.proposal.evidence.explanation || activity.rawInput,
        type: activityType ?? "activity_output",
      },
      questProgressDelta,
      artifactResolutions: resolutions,
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
  // P1-01 Fix: Only match proposals targeting 'skill' AND having the exact matching skillName.
  // Never fallback to changes[0] and never accept proposals targeted at knowledge or other skills.
  const change = input.changes.find(
    (c) => c.target_type === "skill" && c.target_name === input.skillName
  );
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
