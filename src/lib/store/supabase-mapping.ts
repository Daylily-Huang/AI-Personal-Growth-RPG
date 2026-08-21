import type { AssessmentProposal } from "@/lib/ai/schemas";
import type { Database } from "@/lib/supabase/database.types";
import type { Activity, Assessment, MasteryVerification, PlayerState, Quest, SkillState, XpTransaction } from "./types";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type AssessmentRow = Database["public"]["Tables"]["ai_assessments"]["Row"];
type SkillRow = Database["public"]["Tables"]["skills"]["Row"];
type TransactionRow = Database["public"]["Tables"]["xp_transactions"]["Row"];
type PlayerRow = Database["public"]["Tables"]["player_states"]["Row"];
type VerificationRow = Database["public"]["Tables"]["mastery_verifications"]["Row"];
type QuestRow = Database["public"]["Tables"]["quests"]["Row"];

export function mapActivity(row: ActivityRow & { quest_size_snapshot?: string | null; quest_id_snapshot?: string | null; quest_title_snapshot?: string | null }): Activity {
  return {
    id: row.id,
    questId: row.quest_id,
    questSizeSnapshot: (row.quest_size_snapshot as Activity["questSizeSnapshot"]) ?? null,
    questIdSnapshot: row.quest_id_snapshot ?? null,
    questTitleSnapshot: row.quest_title_snapshot ?? null,
    rawInput: row.raw_input,
    title: row.title,
    activityType: row.activity_type,
    status: row.status as Activity["status"],
    totalMinutes: row.total_minutes,
    effectiveMinutes: row.effective_minutes,
    rulesVersion: row.rules_version,
    createdAt: row.created_at,
  };
}

export function mapAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    activityId: row.activity_id,
    status: row.status as Assessment["status"],
    proposal: row.assessment_json as AssessmentProposal,
    modelName: row.model_name ?? "unknown",
    promptVersion: row.prompt_version ?? "unknown",
    rulesVersion: row.rules_version,
    confidence: Number(row.confidence ?? 0),
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

export function mapSkill(row: SkillRow): SkillState {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    xp: Number(row.xp),
    level: row.level,
    masteryLevel: row.mastery_level,
    masteryConfidence: Number(row.mastery_confidence),
    lastUsedAt: row.last_used_at,
  };
}

export function mapTransaction(row: TransactionRow, skillName?: string): XpTransaction {
  if (!row.skill_id) throw new Error(`xp_transactions row ${row.id} has no skill_id`);
  if (!skillName) throw new Error(`xp_transactions row ${row.id} has no resolved skill name`);
  return {
    id: row.id,
    activityId: row.activity_id,
    assessmentId: row.assessment_id,
    xpType: row.xp_type as XpTransaction["xpType"],
    skillId: row.skill_id,
    skillName,
    activityType: row.activity_type,
    repetitionCount: row.repetition_count,
    repetitionPenalty: Number(row.repetition_penalty),
    amount: row.amount,
    baseAmount: row.base_amount,
    modifierJson: (row.modifier_json ?? {}) as Record<string, unknown>,
    reason: row.reason ?? "",
    rulesVersion: row.rules_version,
    createdAt: row.created_at,
  };
}

export function mapPlayer(row: PlayerRow | null): PlayerState {
  if (!row) throw new Error("player_states invariant violated: authenticated user has no player state");
  return {
    totalXp: Number(row.total_xp),
    playerLevel: row.player_level,
    energy: Number(row.energy),
    focus: Number(row.focus),
    momentum: Number(row.momentum),
  };
}

export function mapMasteryVerification(row: VerificationRow): MasteryVerification {
  return {
    id: row.id,
    skillId: row.skill_id,
    skillName: row.skill_name,
    fromLevel: row.from_level,
    toLevel: row.to_level,
    evidenceLevel: row.evidence_level,
    status: row.status as MasteryVerification["status"],
    proposalAssessmentId: row.proposal_assessment_id ?? "",
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function mapQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    userId: row.user_id,
    parentQuestId: row.parent_quest_id,
    title: row.title,
    description: row.description,
    questType: row.quest_type as Quest["questType"],
    questSize: (row.quest_size ?? "standard") as Quest["questSize"],
    status: row.status as Quest["status"],
    difficulty: Number(row.difficulty),
    goalAlignment: Number(row.goal_alignment),
    progress: Number(row.progress),
    deadline: row.deadline,
    isMainQuest: Boolean(row.is_main_quest),
    isBoss: Boolean(row.is_boss),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

