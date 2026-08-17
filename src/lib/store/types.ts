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

export interface Db {
  version: 1;
  activities: Activity[];
  assessments: Assessment[];
  transactions: XpTransaction[];
  skills: Record<string, SkillState>;
  skillEdges: SkillEdge[];
  player: PlayerState;
}

/** The full change set a settlement produces, applied atomically by a Repository. */
export interface SettlementToApply {
  assessmentId: string;
  transaction: XpTransaction;
  /** Updated (or brand-new) primary skill state. */
  primarySkill: SkillState;
  /** Secondary skills that need to exist so the Skill Tree can show them. */
  relatedSkills: SkillState[];
  /** New skill edges to persist (deduped by the repository). */
  newEdges: SkillEdge[];
  /** Updated player totals. */
  player: PlayerState;
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
}
