import type { AssessmentProposal } from "@/lib/ai/schemas";

export type ActivityStatus = "pending_assessment" | "assessed" | "confirmed";

export interface Activity {
  id: string;
  questId?: string | null;
  questSizeSnapshot?: QuestSize | null;
  rawInput: string;
  title: string;
  activityType: string | null;
  status: ActivityStatus;
  totalMinutes: number | null;
  effectiveMinutes: number | null;
  /** Frozen at creation: the governance audit of which rule set will settle this. */
  rulesVersion: string;
  createdAt: string;
}

export type AssessmentStatus = "pending" | "confirmed" | "edited" | "rejected" | "superseded";

export interface Assessment {
  id: string;
  activityId: string;
  status: AssessmentStatus;
  proposal: AssessmentProposal;
  modelName: string;
  promptVersion: string;
  rulesVersion: string;
  confidence: number;
  createdAt: string;
  confirmedAt: string | null;
}

/**
 * Ledger entry type (Milestone 2.7):
 * - `activity`: the one original XP settlement per Activity (UNIQUE per activity).
 * - `adjustment` / `correction`: future editor/admin corrections — allowed to
 *   create their own entries without colliding with the activity settlement.
 */
export type XpTransactionType = "activity" | "adjustment" | "correction";

export interface XpTransaction {
  id: string;
  activityId: string;
  assessmentId: string;
  xpType: XpTransactionType;
  /**
   * Stable skill identity (not the display name).
   * Authoritative — set by the repository at settlement; service passes "".
   */
  skillId: string;
  /** Display-name snapshot at settle time. */
  skillName: string;
  /** Activity type at confirm time (from the proposal), used for similarity. */
  activityType: string | null;
  /** Authoritative similar-activity count computed server-side at confirm time. */
  repetitionCount: number;
  /** Authoritative repetition modifier produced by the Growth Engine. */
  repetitionPenalty: number;
  amount: number;
  baseAmount: number;
  modifierJson: Record<string, unknown>;
  reason: string;
  rulesVersion: string;
  createdAt: string;
}

/**
 * Stable skill identity (Milestone 2.7): the database/domain always refers to a
 * skill by `id`; `name` is a display label and `aliases` help AI matching. The
 * display name must never be the primary identity again.
 */
export interface SkillState {
  id: string;
  name: string;
  aliases: string[];
  xp: number;
  level: number;
  masteryLevel: number;
  masteryConfidence: number;
  lastUsedAt: string | null;
}

/** Skill tree edge — endpoints are STABLE skill IDs (never display names). */
export interface SkillEdge {
  sourceId: string;
  targetId: string;
  relation: string;
}

export interface PlayerState {
  totalXp: number;
  playerLevel: number;
  energy: number;
  focus: number;
  momentum: number;
}

/**
 * A requested Mastery upgrade that could NOT be applied immediately because it
 * requires verification (per the Growth Constitution: high/large mastery jumps
 * must be evidenced, not auto-granted).
 */
export type MasteryVerificationStatus = "pending" | "verified" | "rejected";

export interface MasteryVerification {
  id: string;
  /** Stable skill identity being upgraded. */
  skillId: string;
  skillName: string;
  fromLevel: number;
  toLevel: number;
  evidenceLevel: number;
  status: MasteryVerificationStatus;
  /** Assessment that proposed the upgrade. */
  proposalAssessmentId: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Db {
  version: 4;
  activities: Activity[];
  assessments: Assessment[];
  transactions: XpTransaction[];
  skills: Record<string, SkillState>;
  skillEdges: SkillEdge[];
  masteryVerifications: MasteryVerification[];
  quests: Quest[];
  player: PlayerState;
}

// ---------------------------------------------------------------------------
// Settlement command (delta semantics — see repository.ts for the rationale)
// ---------------------------------------------------------------------------

export type MasteryAction =
  | { action: "none" }
  | { action: "upgrade"; proposedLevel: number; confidence: number }
  | {
      action: "request_verification";
      fromLevel: number;
      toLevel: number;
      confidence: number;
    };

/**
 * The full change set a settlement produces.
 *
 * CRITICAL (Milestone 2.6): this is DELTA-based, not absolute-state. The
 * repository must apply `+= xpDelta` on the current stored state inside its own
 * atomic transaction — it must NOT blindly overwrite totals with values the
 * service computed from an older snapshot (that is the lost-update bug).
 *
 * Preflight (Round6): NO skill is created outside the atomic settlement. The
 * command carries display labels only; the repository resolves-or-creates the
 * stable skill (random UUID, never derived from the name) inside the atomic
 * write and returns the authoritative persisted result.
 */
export interface SettlementToApply {
  assessmentId: string;
  /** Exact ledger row content; the repository sets the authoritative skillId. */
  transaction: XpTransaction;
  /** = transaction.amount; applied as `current += xpDelta`. */
  xpDelta: number;
  /** Primary skill candidate: resolved-or-created atomically by the store. */
  primarySkill: {
    /** Display name / AI label used for normalized matching. */
    name: string;
    xpDelta: number;
    masteryAction: MasteryAction;
  };
  /** Secondary skill labels; nodes + related edges are created atomically. */
  relatedSkillLabels: string[];
  /** Apply as `player.totalXp += xpDelta`; level is recomputed by the store. */
  player: { xpDelta: number };
  /** Created when the mastery upgrade requires verification. */
  masteryVerification?: MasteryVerification;
  /** Deterministic quest progression delta computed by the domain Growth Engine. */
  questProgressDelta?: number;
}

export interface NewActivityInput {
  rawInput: string;
  questId?: string | null;
  totalMinutes?: number | null;
  effectiveMinutes?: number | null;
}

export interface NewAssessmentInput {
  activityId: string;
  proposal: AssessmentProposal;
  modelName: string;
  promptVersion: string;
}

export interface ConfirmResult {
  ok: boolean;
  reason?: string;
  transaction?: XpTransaction;
  assessment?: Assessment;
  masteryVerification?: MasteryVerification;
  /** Present when reason === "repetition_conflict": fresh authoritative count. */
  actualRepetitionCount?: number;
}

export type QuestType =
  | "learning"
  | "skill"
  | "production"
  | "physical"
  | "maintenance"
  | "reflection";

export type QuestSize = "micro" | "minor" | "standard" | "major" | "epic" | "main";

export type QuestStatus =
  | "locked"
  | "available"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "archived";

export interface Quest {
  id: string;
  userId?: string;
  parentQuestId: string | null;
  title: string;
  description: string | null;
  questType: QuestType;
  questSize: QuestSize;
  status: QuestStatus;
  difficulty: number;
  goalAlignment: number;
  progress: number;
  deadline: string | null;
  isMainQuest: boolean;
  isBoss: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewQuestInput {
  parentQuestId?: string | null;
  title: string;
  description?: string | null;
  questType: QuestType;
  questSize?: QuestSize;
  status?: QuestStatus;
  difficulty?: number;
  goalAlignment?: number;
  progress?: number;
  deadline?: string | null;
  isMainQuest?: boolean;
  isBoss?: boolean;
}

export interface UpdateQuestInput {
  parentQuestId?: string | null;
  title?: string;
  description?: string | null;
  questType?: QuestType;
  questSize?: QuestSize;
  status?: QuestStatus;
  difficulty?: number;
  goalAlignment?: number;
  progress?: number;
  deadline?: string | null;
  isMainQuest?: boolean;
  isBoss?: boolean;
}

export interface QuestTreeNode extends Quest {
  children: QuestTreeNode[];
}

export interface DashboardSnapshot {
  player: PlayerState;
  levelProgress: {
    xpIntoLevel: number;
    xpNeededForNext: number;
    progress: number;
  };
  recentGrowth: XpTransaction[];
  pendingAssessments: Assessment[];
  activities: Activity[];
  skills: SkillState[];
  pendingMasteryVerifications: MasteryVerification[];
  quests?: Quest[];
  mainQuest?: Quest | null;
  activeQuests?: Quest[];
}

