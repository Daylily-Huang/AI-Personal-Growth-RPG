import { z } from "zod";

export const REVIEW_VERSION = "daily-weekly-review-v1" as const;
export const REVIEW_PAGE_SIZE = 200;
export const REVIEW_SOURCE_LIMIT = 10000;
export const REVIEW_SAMPLE_LIMIT = 20;
export const REVIEW_BODY_BYTES = 2048;
export const REVIEW_PROMPT_BYTES = 16384;
export const REVIEW_OUTPUT_BYTES = 16384;
export const REVIEW_TIMEOUT_MS = 60000;
export const REVIEW_MAX_TOKENS = 2048;
export const REVIEW_SOURCES = ["activities", "xp_transactions", "mastery_events", "skills", "knowledge_nodes", "artifacts", "quests", "domains", "journal_entries"] as const;
export type ReviewSource = typeof REVIEW_SOURCES[number];
export class ReviewError extends Error {
  constructor(readonly code: string) { super(code); this.name = "ReviewError"; }
}
export interface ReviewPeriod { mode: "DAILY" | "WEEKLY"; start: string; end: string; timezone: string }
export interface ReviewRow { id: string; user_id: string; created_at: string; [key: string]: unknown }
export interface ReviewData { ownerId: string; rows: Record<ReviewSource, ReviewRow[]>; coverage: SourceCoverage[]; asOf: string }
export interface SourceCoverage { source: ReviewSource; scanned: number; complete: boolean }

const id = z.string().uuid(), count = z.number().int().nonnegative().max(REVIEW_SOURCE_LIMIT), label = z.string().max(320);
const timestamp = z.string().min(20).max(40);
export const ReviewPeriodSchema = z.strictObject({ mode: z.enum(["DAILY", "WEEKLY"]), start: timestamp, end: timestamp, timezone: z.string().min(1).max(100) });
const groupedXp = z.strictObject({ id: id.nullable(), name: label.nullable(), amount: z.number().int().safe(), entries: count });
export const ReviewSummarySchema = z.strictObject({
  version: z.literal(REVIEW_VERSION), period: ReviewPeriodSchema, asOf: timestamp, complete: z.boolean(),
  coverage: z.array(z.strictObject({ source: z.enum(REVIEW_SOURCES), scanned: count, complete: z.boolean() })).length(9),
  counts: z.strictObject({ activities: count, confirmedActivities: count, xpEntries: count, masteryEvents: count, newSkills: count, newKnowledgeNodes: count, newArtifacts: count }),
  xp: z.strictObject({ net: z.number().int().safe(), activity: z.number().int().safe(), adjustment: z.number().int().safe(), correction: z.number().int().safe(), repeatedSettlements: count, penalizedSettlements: count,
    bySkill: z.array(groupedXp).max(20), byDomain: z.array(groupedXp).max(20), omittedSkillGroups: count, omittedDomainGroups: count }),
  activities: z.array(z.strictObject({ id, title: label, createdAt: timestamp, status: z.enum(["pending_assessment", "assessed", "confirmed"]), totalMinutes: z.number().int().nonnegative().nullable(), effectiveMinutes: z.number().int().nonnegative().nullable() })).max(20),
  newSkills: z.array(z.strictObject({ id, name: label, status: z.enum(["active", "archived"]) })).max(20),
  masteryChanges: z.array(z.strictObject({ id, skillId: id.nullable(), from: z.number().int().min(0).max(10), to: z.number().int().min(0).max(10), kind: z.enum(["upgrade", "confidence_refresh", "confidence_decay", "correction"]), evidenceId: id.nullable() })).max(20),
  knowledge: z.array(z.strictObject({ id, title: label, status: z.enum(["inferred", "verified", "rejected", "superseded"]), archived: z.boolean() })).max(20),
  artifacts: z.array(z.strictObject({ id, title: label, status: z.enum(["draft", "active", "archived", "superseded"]) })).max(20),
  mainQuests: z.array(z.strictObject({ id, title: label, status: z.enum(["locked", "available", "active", "paused", "completed", "failed", "archived"]), currentProgress: z.number().min(0).max(100), periodChange: z.null() })).max(20),
  state: z.strictObject({ id, loggedAt: timestamp, energy: z.number().int().min(1).max(5).nullable(), focus: z.number().int().min(1).max(5).nullable(), stress: z.number().int().min(1).max(5).nullable(), resistance: z.number().int().min(1).max(5).nullable(), recovery: z.number().int().min(1).max(5).nullable(), moodValence: z.number().int().min(-2).max(2).nullable(), selfConfidence: z.number().int().min(1).max(5).nullable() }).nullable(),
  sampling: z.strictObject({ limit: z.literal(20), titleLimit: z.literal(160), omitted: z.array(z.strictObject({ category: z.enum(["activities", "newSkills", "masteryChanges", "knowledge", "artifacts", "mainQuests"]), count })).length(6) }),
  sourceRefs: z.array(z.strictObject({ ref: z.string().min(1).max(100), source: z.enum(REVIEW_SOURCES), id, label })).max(200),
  snapshotWarning: z.literal("多次只读查询，非原子快照；当前技能/领域/主线不是历史快照，主线期间增量未知。状态为用户本期自评；时间不等于XP，作品创建不等于独立验证。"),
});
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
export const REVIEW_SECTIONS = ["growth", "breakthrough", "artifact", "knowledge", "problem", "imbalance", "efficiency", "xpRisk", "masteryRisk", "rest", "nextAction"] as const;
const finding = z.strictObject({ text: z.string().trim().min(1).max(600), supportingIds: z.array(z.string().min(1).max(100)).max(5), certainty: z.enum(["supported", "uncertain"]) });
export const ReviewAnalysisSchema = z.strictObject({
  overview: z.string().trim().min(1).max(600), confidence: z.number().min(0).max(1),
  growth: finding, breakthrough: finding, artifact: finding, knowledge: finding, problem: finding, imbalance: finding, efficiency: finding, xpRisk: finding, masteryRisk: finding, rest: finding, nextAction: finding,
  adjustments: z.array(finding).min(1).max(3), uncertainties: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
});
export type ReviewAnalysis = z.infer<typeof ReviewAnalysisSchema>;
export interface ReviewAnalysisReceipt { version: typeof REVIEW_VERSION; model: string; analyzedAt: string; summary: ReviewSummary; analysis: ReviewAnalysis }
export interface ReviewDraft { period: ReviewPeriod; reflection: string; adjustments: string; objectiveSummary: { provenance: "USER_CONFIRMED_NOTE"; reviewMode: "DAILY" | "WEEKLY"; summary: ReviewSummary } }
