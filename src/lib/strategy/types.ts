export type StrategyStatus = "HYPOTHESIS" | "TESTING" | "SUPPORTED" | "CONTEXTUAL" | "WEAKENED" | "RETIRED";
export type StrategyConfidence = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
export type StrategyObservation = "SUPPORT" | "COUNTER_EVIDENCE";
export type StrategySourceClass =
  | "SEASON_REVIEW" | "ACTIVITY" | "QUEST_OUTCOME" | "ARTIFACT"
  | "CORE_EVIDENCE_REFERENCE" | "JOURNAL_CONTEXT" | "MANUAL_OBSERVATION";

export interface Strategy {
  id: string;
  userId: string;
  title: string;
  description: string;
  contextTrigger: string;
  actionProtocol: string;
  expectedOutcome: string;
  lifecycleStatus: StrategyStatus;
  confidenceLevel: StrategyConfidence;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyVersion {
  id: string;
  userId: string;
  strategyId: string;
  versionNumber: number;
  actionProtocol: string;
  contextTrigger: string;
  expectedOutcome: string;
  createdAt: string;
}

export interface StrategySupport {
  id: string;
  userId: string;
  strategyId: string;
  strategyVersionId: string;
  observationType: StrategyObservation;
  sourceClass: StrategySourceClass;
  sourceId: string;
  evaluatorVersion: string;
  note: string | null;
  observedAt: string;
  createdAt: string;
}

export interface StrategyMetrics {
  supportCount: number;
  counterEvidenceCount: number;
  distinctObservationDates: number;
  completedSeasons: number;
  coreLinks: number;
  supportRatio: number;
  confidenceLevel: StrategyConfidence;
  promotionEligible: boolean;
}

export interface CreateStrategyInput {
  title: string;
  description?: string | null;
  contextTrigger: string;
  actionProtocol: string;
  expectedOutcome: string;
}

export interface InsertSupportInput {
  observationType: StrategyObservation;
  sourceClass: StrategySourceClass;
  sourceId: string;
  evaluatorVersion: string;
  note?: string | null;
  observedAt: string;
}

export interface TransitionStrategyInput {
  targetStatus: StrategyStatus;
  contextBoundaryNote?: string | null;
  retirementReason?: string | null;
  requestIdempotencyKey: string;
}

export interface CreateVersionInput {
  actionProtocol: string;
  contextTrigger: string;
  expectedOutcome: string;
  changeSummary?: string | null;
  requestIdempotencyKey: string;
}

export interface StrategyContext {
  strategy: Strategy;
  versions: StrategyVersion[];
  supports: StrategySupport[];
}
