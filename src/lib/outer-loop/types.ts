export type SeasonStatus =
  | "DRAFT"
  | "PLANNED"
  | "ACTIVE"
  | "COMPLETED"
  | "ENDED_EARLY"
  | "ABANDONED"
  | "CANCELLED";

export type SeasonQuestRole = "MAIN" | "FOCUS";
export type SeasonReviewType = "WEEKLY" | "FINAL" | "AD_HOC";
export type ProposalDecision = "ACCEPTED" | "EDITED" | "REJECTED";

export interface Season {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  themeColor: string | null;
  iconKey: string | null;
  status: SeasonStatus;
  plannedStartDate: string | null;
  targetDurationDays: number | null;
  successCriteria: unknown[] | null;
  startedAt: string | null;
  endedAt: string | null;
  abandonmentReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonQuestLink {
  id: string;
  userId: string;
  seasonId: string;
  questId: string;
  role: SeasonQuestRole;
  createdAt: string;
}

export interface SeasonReview {
  id: string;
  userId: string;
  seasonId: string;
  reviewType: SeasonReviewType;
  version: number;
  commitKey: string;
  periodStart: string;
  periodEnd: string;
  objectiveSummary: unknown;
  qualitativeReflection: string;
  criteriaEvaluation: unknown;
  tacticalAdjustments: string | null;
  amendmentReason: string | null;
  supersededById: string | null;
  createdAt: string;
}

export interface SeasonActivity {
  id: string;
  questId: string | null;
  title: string;
  activityType: string | null;
  status: string;
  createdAt: string;
}

export interface SeasonSummary extends Season {
  linkedQuestCount: number;
  reviewCount: number;
  latestReviewType: SeasonReviewType | null;
}

export interface SeasonContext {
  season: Season;
  links: SeasonQuestLink[];
  reviews: SeasonReview[];
  activities: SeasonActivity[];
}

export interface DraftSeasonInput {
  name: string;
  description?: string | null;
  themeColor?: string | null;
  iconKey?: string | null;
}

export interface PlanSeasonInput {
  plannedStartDate: string;
  targetDurationDays: number;
  successCriteria: unknown[];
  requestIdempotencyKey: string;
}

export interface FinalReviewPayload {
  periodStart: string;
  periodEnd: string;
  objectiveSummary: unknown;
  qualitativeReflection: string;
  criteriaEvaluation: unknown;
  tacticalAdjustments?: string | null;
}

export interface ConcludeSeasonInput {
  targetStatus: "COMPLETED" | "ENDED_EARLY" | "ABANDONED";
  finalReview?: FinalReviewPayload | null;
  finalReviewCommitKey?: string | null;
  abandonmentReason?: string | null;
  requestIdempotencyKey: string;
}

export interface FinalizeReviewInput extends FinalReviewPayload {
  reviewType: "WEEKLY" | "AD_HOC";
  commitKey: string;
}

export interface AmendFinalReviewInput {
  review: FinalReviewPayload;
  amendmentReason: string;
  commitKey: string;
  requestIdempotencyKey: string;
}
