import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CreateStrategyInput, CreateVersionInput, InsertSupportInput, Strategy,
  StrategyMetrics, StrategySupport, StrategyVersion, TransitionStrategyInput,
} from "./types";

type RecordValue = Record<string, unknown>;

const id = z.uuid();
const timestamp = z.string().min(1);
const status = z.enum(["HYPOTHESIS", "TESTING", "SUPPORTED", "CONTEXTUAL", "WEAKENED", "RETIRED"]);
const confidence = z.enum(["LOW", "MODERATE", "HIGH", "VERY_HIGH"]);
const sourceClass = z.enum([
  "SEASON_REVIEW", "ACTIVITY", "QUEST_OUTCOME", "ARTIFACT", "CORE_EVIDENCE_REFERENCE",
  "JOURNAL_CONTEXT", "MANUAL_OBSERVATION",
]);
const strategyRow = z.object({
  id, user_id: id, title: z.string(), description: z.string(), context_trigger: z.string(),
  action_protocol: z.string(), expected_outcome: z.string(), lifecycle_status: status,
  confidence_level: confidence, version: z.number().int().positive(), created_at: timestamp, updated_at: timestamp,
});
const versionRow = z.object({
  id, user_id: id, strategy_id: id, version_number: z.number().int().positive(),
  action_protocol: z.string(), context_trigger: z.string(), expected_outcome: z.string(), created_at: timestamp,
});
const supportRow = z.object({
  id, user_id: id, strategy_id: id, strategy_version_id: id,
  observation_type: z.enum(["SUPPORT", "COUNTER_EVIDENCE"]), source_class: sourceClass,
  source_id: id, evaluator_version: z.string(), note: z.string().nullable(),
  observed_at: timestamp, created_at: timestamp,
});
const metricsRow = z.object({
  support_count: z.number().int().nonnegative(), counter_evidence_count: z.number().int().nonnegative(),
  distinct_observation_dates: z.number().int().nonnegative(), completed_seasons: z.number().int().nonnegative(),
  core_links: z.number().int().nonnegative(), support_ratio: z.number().finite().min(0).max(1),
  confidence_level: confidence, promotion_eligible: z.boolean(),
});

export class StrategyRepositoryError extends Error {
  readonly code: string | null;
  constructor(error: { message: string; code?: string | null }) {
    super(error.message);
    this.name = "StrategyRepositoryError";
    this.code = error.code ?? null;
  }
}

function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label} payload`);
  return value as RecordValue;
}

export function mapStrategy(value: unknown): Strategy {
  const row = strategyRow.parse(value);
  return {
    id: row.id, userId: row.user_id, title: row.title, description: row.description,
    contextTrigger: row.context_trigger, actionProtocol: row.action_protocol,
    expectedOutcome: row.expected_outcome, lifecycleStatus: row.lifecycle_status,
    confidenceLevel: row.confidence_level, version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function mapVersion(value: unknown): StrategyVersion {
  const row = versionRow.parse(value);
  return {
    id: row.id, userId: row.user_id, strategyId: row.strategy_id,
    versionNumber: row.version_number, actionProtocol: row.action_protocol,
    contextTrigger: row.context_trigger, expectedOutcome: row.expected_outcome,
    createdAt: row.created_at,
  };
}

export function mapSupport(value: unknown): StrategySupport {
  const row = supportRow.parse(value);
  return {
    id: row.id, userId: row.user_id, strategyId: row.strategy_id,
    strategyVersionId: row.strategy_version_id, observationType: row.observation_type,
    sourceClass: row.source_class, sourceId: row.source_id,
    evaluatorVersion: row.evaluator_version, note: row.note,
    observedAt: row.observed_at, createdAt: row.created_at,
  };
}

export function mapMetrics(value: unknown): StrategyMetrics {
  const row = metricsRow.parse(value);
  return {
    supportCount: row.support_count, counterEvidenceCount: row.counter_evidence_count,
    distinctObservationDates: row.distinct_observation_dates, completedSeasons: row.completed_seasons,
    coreLinks: row.core_links, supportRatio: row.support_ratio,
    confidenceLevel: row.confidence_level, promotionEligible: row.promotion_eligible,
  };
}

function raise(error: { message: string; code?: string | null } | null): void {
  if (error) throw new StrategyRepositoryError(error);
}

export class StrategyRepository {
  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  async list(): Promise<Strategy[]> {
    const { data, error } = await this.db.from("strategies").select("*")
      .eq("user_id", this.userId).order("created_at", { ascending: false });
    raise(error);
    return (data ?? []).map(mapStrategy);
  }

  async get(id: string): Promise<Strategy | null> {
    const { data, error } = await this.db.from("strategies").select("*")
      .eq("user_id", this.userId).eq("id", id).maybeSingle();
    raise(error);
    return data ? mapStrategy(data) : null;
  }

  async create(input: CreateStrategyInput): Promise<Strategy> {
    const { data, error } = await this.db.from("strategies").insert({
      user_id: this.userId, title: input.title, description: input.description ?? "",
      context_trigger: input.contextTrigger, action_protocol: input.actionProtocol,
      expected_outcome: input.expectedOutcome,
    }).select("*").single();
    raise(error);
    return mapStrategy(data);
  }

  async updateMetadata(id: string, changes: { title?: string; description?: string }): Promise<Strategy | null> {
    const { data, error } = await this.db.from("strategies")
      .update(changes).eq("user_id", this.userId).eq("id", id).select("*").maybeSingle();
    raise(error);
    return data ? mapStrategy(data) : null;
  }

  async listVersions(id: string): Promise<StrategyVersion[]> {
    const { data, error } = await this.db.from("strategy_versions").select("*")
      .eq("user_id", this.userId).eq("strategy_id", id).order("version_number", { ascending: false });
    raise(error);
    return (data ?? []).map(mapVersion);
  }

  async listSupports(id: string): Promise<StrategySupport[]> {
    const { data, error } = await this.db.from("strategy_supports").select("*")
      .eq("user_id", this.userId).eq("strategy_id", id).order("created_at", { ascending: false });
    raise(error);
    return (data ?? []).map(mapSupport);
  }

  async insertSupport(id: string, input: InsertSupportInput) {
    const result = record(await this.rpc("rpc_insert_strategy_support", {
      p_strategy_id: id, p_observation_type: input.observationType, p_source_class: input.sourceClass,
      p_source_id: input.sourceId, p_evaluator_version: input.evaluatorVersion,
      p_note: input.note ?? null, p_observed_at: input.observedAt,
    }), "insert support result");
    return {
      support: mapSupport(result.support), replayed: z.boolean().parse(result.replayed),
      evaluation: result.evaluation ? this.mapEvaluation(result.evaluation) : null,
    };
  }

  async evaluate(id: string, confirmPromotion: boolean) {
    return this.mapEvaluation(await this.rpc("rpc_evaluate_strategy_status", {
      p_strategy_id: id, p_confirm_promotion: confirmPromotion,
    }));
  }

  async transition(id: string, input: TransitionStrategyInput) {
    const result = record(await this.rpc("rpc_transition_strategy_status", {
      p_strategy_id: id, p_target_status: input.targetStatus,
      p_context_boundary_note: input.contextBoundaryNote ?? null,
      p_retirement_reason: input.retirementReason ?? null,
      p_request_idempotency_key: input.requestIdempotencyKey,
    }), "transition result");
    return {
      strategy: mapStrategy(result.strategy), previousStatus: status.parse(result.previous_status),
      replayed: z.boolean().parse(result.replayed),
    };
  }

  async createVersion(id: string, input: CreateVersionInput) {
    const result = record(await this.rpc("rpc_create_strategy_version", {
      p_strategy_id: id, p_action_protocol: input.actionProtocol,
      p_context_trigger: input.contextTrigger, p_expected_outcome: input.expectedOutcome,
      p_change_summary: input.changeSummary ?? null,
      p_request_idempotency_key: input.requestIdempotencyKey,
    }), "create version result");
    return { strategy: mapStrategy(result.strategy), version: mapVersion(result.version), replayed: z.boolean().parse(result.replayed) };
  }

  private mapEvaluation(value: unknown) {
    const result = record(value, "evaluate result");
    return {
      strategy: mapStrategy(result.strategy), metrics: mapMetrics(result.metrics),
      strategyVersionId: id.parse(result.strategy_version_id),
    };
  }

  private async rpc(name: string, args: RecordValue): Promise<unknown> {
    const { data, error } = await this.db.rpc(name, args);
    raise(error);
    return data;
  }
}
