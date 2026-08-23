import type { AssessmentProposal } from "@/lib/ai/schemas";

export type ActivityStatus = "pending_assessment" | "assessed" | "confirmed";

export interface Activity {
  id: string;
  questId: string | null;
  questSizeSnapshot?: QuestSize | null;
  questIdSnapshot?: string | null;
  questTitleSnapshot?: string | null;
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
 * Stage 5 Domain model: hierarchical skill categories.
 */
export interface Domain {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder?: number;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Stable skill identity (Milestone 2.7 & Stage 5): the database/domain always refers to a
 * skill by `id`; `name` is a display label and `aliases` help AI matching. The
 * display name must never be the primary identity.
 */
export interface SkillState {
  id: string;
  name: string;
  aliases: string[];
  description?: string | null;
  domainId?: string | null;
  status?: "active" | "archived";
  xp: number;
  level: number;
  masteryLevel: number;
  masteryConfidence: number;
  lastUsedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Stage 5 Minimal Skill Edge Relations */
export type SkillEdgeRelationType = "prerequisite" | "contains" | "supports";

/** Skill tree edge — endpoints are STABLE skill IDs (never display names). */
export interface SkillEdge {
  id?: string;
  sourceId: string;
  targetId: string;
  relation: SkillEdgeRelationType | string;
  createdAt?: string;
}

export interface NewSkillEdgeInput {
  sourceSkillId: string;
  targetSkillId: string;
  relationType: SkillEdgeRelationType;
}

export interface UpdateSkillMetadataInput {
  name?: string;
  aliases?: string[];
  description?: string | null;
  domainId?: string | null;
  status?: "active" | "archived";
}

export interface EvidenceRecord {
  id: string;
  userId: string;
  activityId: string;
  skillId: string | null;
  evidenceLevel: number;
  evidenceType: string | null;
  description: string | null;
  verified: boolean;
  createdAt: string;
}

export interface MasteryEvent {
  id: string;
  userId: string;
  skillId: string;
  activityId?: string | null;
  evidenceId?: string | null;
  fromLevel: number;
  toLevel: number;
  confidence: number;
  eventType: string;
  reason: string | null;
  createdAt: string;
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

// ---------------------------------------------------------------------------
// Stage 5B API & Derived State Read Models
// ---------------------------------------------------------------------------

export type SkillDerivedState =
  | "locked"
  | "available"
  | "learning"
  | "proficient"
  | "advanced"
  | "archived";

export interface SkillFlowNodeData {
  name: string;
  aliases: string[];
  level: number;
  xp: number;
  masteryLevel: number;
  masteryConfidence: number;
  derivedState: SkillDerivedState;
  lastUsedAt: string | null;
  prerequisiteCount: number;
  unfulfilledPrerequisiteCount: number;
}

export interface SkillFlowNode {
  id: string;
  domainId: string | null;
  position: { x: number; y: number };
  data: SkillFlowNodeData;
}

export interface SkillFlowEdge {
  id: string;
  source: string;
  target: string;
  relation: SkillEdgeRelationType | string;
  animated?: boolean;
}

export interface SkillTreeGraphResponse {
  domains: Domain[];
  nodes: SkillFlowNode[];
  edges: SkillFlowEdge[];
}

export interface SkillDetailPrerequisite {
  id: string;
  name: string;
  masteryLevel: number;
  masteryConfidence: number;
  isFulfilled: boolean;
}

export interface SkillDetailNextUnlock {
  id: string;
  name: string;
  derivedState: SkillDerivedState;
}

export interface SkillDetailEvidenceItem {
  id: string;
  activityId: string;
  activityTitle?: string | null;
  evidenceLevel: number;
  evidenceType: string | null;
  description: string | null;
  verified: boolean;
  createdAt: string;
}

export interface SkillDetailMasteryEventItem {
  id: string;
  eventType: string;
  fromLevel: number;
  toLevel: number;
  confidence: number;
  reason: string | null;
  createdAt: string;
}

export interface SkillDetailTransactionItem {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface SkillDetailResponse {
  skill: {
    id: string;
    name: string;
    aliases: string[];
    description: string | null;
    domainId: string | null;
    domainName: string | null;
    level: number;
    xp: number;
    nextLevelXp: number;
    masteryLevel: number;
    masteryConfidence: number;
    derivedState: SkillDerivedState;
    lastUsedAt: string | null;
    createdAt: string;
  };
  prerequisites: SkillDetailPrerequisite[];
  nextUnlocks: SkillDetailNextUnlock[];
  evidenceTimeline: SkillDetailEvidenceItem[];
  masteryHistory: SkillDetailMasteryEventItem[];
  recentTransactions: SkillDetailTransactionItem[];
}

export interface Db {
  version: 4;
  domains?: Domain[];
  activities: Activity[];
  assessments: Assessment[];
  transactions: XpTransaction[];
  skills: Record<string, SkillState>;
  skillEdges: SkillEdge[];
  evidenceRecords: EvidenceRecord[];
  masteryEvents?: MasteryEvent[];
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
 * Stage 5A Skill Resolution Input (Discriminated Union):
 * - `existing`: explicitly binds to an existing verified skill ID;
 * - `create`: explicitly creates a new skill with user-confirmed name.
 */
export type SkillResolutionInput =
  | {
      resolution: "existing";
      skillId: string;
    }
  | {
      resolution: "create";
      proposedName: string;
    };

export interface SettlementSkillToApply {
  /** Stage 5A Mandatory Stable-ID Skill Resolution (Discriminated Union) */
  skill: SkillResolutionInput;
  /** Display name / AI label snapshot at settle time. */
  name: string;
  xpDelta: number;
  masteryAction: MasteryAction;
}

/**
 * The full change set a settlement produces.
 *
 * CRITICAL (Milestone 2.6): this is DELTA-based, not absolute-state. The
 * repository must apply `+= xpDelta` on the current stored state inside its own
 * atomic transaction — it must NOT blindly overwrite totals with values the
 * service computed from an older snapshot (that is the lost-update bug).
 */
export interface SettlementToApply {
  assessmentId: string;
  /** Exact ledger row content; the repository sets the authoritative skillId. */
  transaction: XpTransaction;
  /** = transaction.amount; applied as `current += xpDelta`. */
  xpDelta: number;
  /** Primary skill candidate: resolved-or-created atomically by the store. */
  primarySkill: SettlementSkillToApply;
  /** Secondary skill resolutions (Discriminated Union array). */
  relatedSkillResolutions?: SkillResolutionInput[];
  /** Apply as `player.totalXp += xpDelta`; level is recomputed by the store. */
  player: { xpDelta: number };
  /** Created when the mastery upgrade requires verification. */
  masteryVerification?: MasteryVerification;
  /** Authoritative evidence record to persist alongside settlement. */
  evidence?: {
    id?: string;
    level: number;
    type?: string;
    explanation: string;
  };
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
