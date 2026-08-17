import type { AssessmentProposal } from "@/lib/ai/schemas";

export interface Activity {
  id: string;
  rawInput: string;
  title: string;
  activityType: string | null;
  status: "pending_assessment" | "assessed" | "confirmed";
  totalMinutes: number | null;
  effectiveMinutes: number | null;
  createdAt: string;
}

export interface Assessment {
  id: string;
  activityId: string;
  status: "pending" | "confirmed" | "edited" | "rejected";
  proposal: AssessmentProposal;
  modelName: string;
  promptVersion: string;
  rulesVersion: string;
  confidence: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface XpTransaction {
  id: string;
  activityId: string;
  assessmentId: string;
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

export interface SkillState {
  name: string;
  xp: number;
  level: number;
  masteryLevel: number;
  masteryConfidence: number;
  lastUsedAt: string | null;
}

export interface SkillEdge {
  source: string;
  target: string;
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
  version: 2;
  activities: Activity[];
  assessments: Assessment[];
  transactions: XpTransaction[];
  skills: Record<string, SkillState>;
  skillEdges: SkillEdge[];
  masteryVerifications: MasteryVerification[];
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
 */
export interface SettlementToApply {
  assessmentId: string;
  /** Exact ledger row (authoritative record of this settlement). */
  transaction: XpTransaction;
  /** = transaction.amount; applied as `current += xpDelta`. */
  xpDelta: number;
  /** Primary skill: apply xpDelta to current stored xp and act on mastery. */
  primarySkill: {
    name: string;
    xpDelta: number;
    masteryAction: MasteryAction;
  };
  /** Secondary skills that must exist so the Skill Tree can show them. */
  relatedSkillNames: string[];
  /** New skill edges to persist (deduped by the repository). */
  newEdges: SkillEdge[];
  /** Apply as `player.totalXp += xpDelta`; level is recomputed by the store. */
  player: { xpDelta: number };
  /** Created when the mastery upgrade requires verification. */
  masteryVerification?: MasteryVerification;
}

export interface NewActivityInput {
  rawInput: string;
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
}
