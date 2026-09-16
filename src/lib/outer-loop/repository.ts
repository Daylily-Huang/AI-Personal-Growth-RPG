import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AmendFinalReviewInput,
  ConcludeSeasonInput,
  DraftSeasonInput,
  FinalizeReviewInput,
  PlanSeasonInput,
  ProposalDecision,
  Season,
  SeasonActivity,
  SeasonQuestLink,
  SeasonQuestRole,
  SeasonReview,
  SeasonStatus,
} from "./types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label} payload`);
  }
  return value as JsonRecord;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : asString(value);
}

function mapSeason(row: unknown): Season {
  const data = asRecord(row, "season");
  return {
    id: asString(data.id),
    userId: asString(data.user_id),
    name: asString(data.name),
    description: asNullableString(data.description),
    themeColor: asNullableString(data.theme_color),
    iconKey: asNullableString(data.icon_key),
    status: asString(data.status) as SeasonStatus,
    plannedStartDate: asNullableString(data.planned_start_date),
    targetDurationDays: data.target_duration_days === null || data.target_duration_days === undefined
      ? null
      : Number(data.target_duration_days),
    successCriteria: Array.isArray(data.success_criteria) ? data.success_criteria : null,
    startedAt: asNullableString(data.started_at),
    endedAt: asNullableString(data.ended_at),
    abandonmentReason: asNullableString(data.abandonment_reason),
    createdAt: asString(data.created_at),
    updatedAt: asString(data.updated_at),
  };
}

function mapLink(row: unknown): SeasonQuestLink {
  const data = asRecord(row, "season quest link");
  return {
    id: asString(data.id),
    userId: asString(data.user_id),
    seasonId: asString(data.season_id),
    questId: asString(data.quest_id),
    role: asString(data.role) as SeasonQuestRole,
    createdAt: asString(data.created_at),
  };
}

function mapReview(row: unknown): SeasonReview {
  const data = asRecord(row, "season review");
  return {
    id: asString(data.id),
    userId: asString(data.user_id),
    seasonId: asString(data.season_id),
    reviewType: asString(data.review_type) as SeasonReview["reviewType"],
    version: Number(data.version),
    commitKey: asString(data.commit_key),
    periodStart: asString(data.period_start),
    periodEnd: asString(data.period_end),
    objectiveSummary: data.objective_summary,
    qualitativeReflection: asString(data.qualitative_reflection),
    criteriaEvaluation: data.criteria_evaluation,
    tacticalAdjustments: asNullableString(data.tactical_adjustments),
    amendmentReason: asNullableString(data.amendment_reason),
    supersededById: asNullableString(data.superseded_by_id),
    createdAt: asString(data.created_at),
  };
}

function mapActivity(row: unknown): SeasonActivity {
  const data = asRecord(row, "season activity");
  return {
    id: asString(data.id),
    questId: asNullableString(data.quest_id),
    title: asString(data.title),
    activityType: asNullableString(data.activity_type),
    status: asString(data.status),
    createdAt: asString(data.created_at),
  };
}

function throwIfError(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

export class Phase8BRepository {
  private readonly db: SupabaseClient;

  constructor(
    client: SupabaseClient,
    private readonly userId: string,
  ) {
    this.db = client;
  }

  async listSeasons(): Promise<Season[]> {
    const { data, error } = await this.db
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false });
    throwIfError(error, "Failed to list seasons");
    return (data ?? []).map(mapSeason);
  }

  async getSeason(id: string): Promise<Season | null> {
    const { data, error } = await this.db
      .from("seasons")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError(error, "Failed to load season");
    return data ? mapSeason(data) : null;
  }

  async createDraft(input: DraftSeasonInput): Promise<Season> {
    const { data, error } = await this.db
      .from("seasons")
      .insert({
        user_id: this.userId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        theme_color: input.themeColor || null,
        icon_key: input.iconKey || null,
      })
      .select("*")
      .single();
    throwIfError(error, "Failed to create season");
    return mapSeason(data);
  }

  async updateDraftMetadata(id: string, input: DraftSeasonInput): Promise<Season> {
    const { data, error } = await this.db
      .from("seasons")
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        theme_color: input.themeColor || null,
        icon_key: input.iconKey || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    throwIfError(error, "Failed to update season metadata");
    return mapSeason(data);
  }

  async deleteUnactivated(id: string): Promise<void> {
    const { error } = await this.db.from("seasons").delete().eq("id", id);
    throwIfError(error, "Failed to delete season");
  }

  async planSeason(id: string, input: PlanSeasonInput): Promise<Season> {
    const result = await this.rpc("rpc_plan_season", {
      p_season_id: id,
      p_planned_start_date: input.plannedStartDate,
      p_target_duration_days: input.targetDurationDays,
      p_success_criteria: input.successCriteria,
      p_request_idempotency_key: input.requestIdempotencyKey,
    });
    return mapSeason(asRecord(result, "plan season result").season);
  }

  async activateSeason(id: string, requestIdempotencyKey: string): Promise<Season> {
    const result = await this.rpc("rpc_activate_season", {
      p_season_id: id,
      p_request_idempotency_key: requestIdempotencyKey,
    });
    return mapSeason(asRecord(result, "activate season result").season);
  }

  async concludeSeason(id: string, input: ConcludeSeasonInput): Promise<{ season: Season; review: SeasonReview | null }> {
    const finalReview = input.finalReview
      ? {
          period_start: input.finalReview.periodStart,
          period_end: input.finalReview.periodEnd,
          objective_summary: input.finalReview.objectiveSummary,
          qualitative_reflection: input.finalReview.qualitativeReflection,
          criteria_evaluation: input.finalReview.criteriaEvaluation,
          tactical_adjustments: input.finalReview.tacticalAdjustments ?? null,
        }
      : null;
    const result = asRecord(
      await this.rpc("rpc_conclude_season", {
        p_season_id: id,
        p_target_status: input.targetStatus,
        p_final_review: finalReview,
        p_final_review_commit_key: input.finalReviewCommitKey ?? null,
        p_abandonment_reason: input.abandonmentReason ?? null,
        p_request_idempotency_key: input.requestIdempotencyKey,
      }),
      "conclude season result",
    );
    return {
      season: mapSeason(result.season),
      review: result.review ? mapReview(result.review) : null,
    };
  }

  async cancelSeason(id: string, reason: string | null, requestIdempotencyKey: string): Promise<Season> {
    const result = await this.rpc("rpc_cancel_season", {
      p_season_id: id,
      p_cancellation_reason: reason,
      p_request_idempotency_key: requestIdempotencyKey,
    });
    return mapSeason(asRecord(result, "cancel season result").season);
  }

  async listLinks(seasonId: string): Promise<SeasonQuestLink[]> {
    const { data, error } = await this.db
      .from("season_quests")
      .select("*")
      .eq("season_id", seasonId)
      .order("created_at", { ascending: true });
    throwIfError(error, "Failed to list season quest links");
    return (data ?? []).map(mapLink);
  }

  async linkQuest(seasonId: string, questId: string, role: SeasonQuestRole): Promise<SeasonQuestLink> {
    const result = await this.rpc("rpc_link_season_quest", {
      p_season_id: seasonId,
      p_quest_id: questId,
      p_role: role,
    });
    return mapLink(asRecord(result, "link quest result").link);
  }

  async unlinkQuest(seasonId: string, questId: string, role: SeasonQuestRole): Promise<void> {
    await this.rpc("rpc_unlink_season_quest", {
      p_season_id: seasonId,
      p_quest_id: questId,
      p_role: role,
    });
  }

  async listReviews(seasonId?: string): Promise<SeasonReview[]> {
    let query = this.db
      .from("season_reviews")
      .select("*")
      .order("created_at", { ascending: false });
    if (seasonId) query = query.eq("season_id", seasonId);
    const { data, error } = await query;
    throwIfError(error, "Failed to list season reviews");
    return (data ?? []).map(mapReview);
  }

  async finalizeReview(seasonId: string, input: FinalizeReviewInput): Promise<SeasonReview> {
    const result = await this.rpc("rpc_finalize_season_review", {
      p_season_id: seasonId,
      p_review_type: input.reviewType,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_objective_summary: input.objectiveSummary,
      p_qualitative_reflection: input.qualitativeReflection,
      p_criteria_evaluation: input.criteriaEvaluation,
      p_tactical_adjustments: input.tacticalAdjustments ?? null,
      p_commit_key: input.commitKey,
    });
    return mapReview(asRecord(result, "finalize review result").review);
  }

  async amendFinalReview(seasonId: string, input: AmendFinalReviewInput): Promise<SeasonReview> {
    const result = await this.rpc("rpc_amend_final_season_review", {
      p_season_id: seasonId,
      p_amended_review: {
        period_start: input.review.periodStart,
        period_end: input.review.periodEnd,
        objective_summary: input.review.objectiveSummary,
        qualitative_reflection: input.review.qualitativeReflection,
        criteria_evaluation: input.review.criteriaEvaluation,
        tactical_adjustments: input.review.tacticalAdjustments ?? null,
      },
      p_amendment_reason: input.amendmentReason,
      p_commit_key: input.commitKey,
      p_request_idempotency_key: input.requestIdempotencyKey,
    });
    return mapReview(asRecord(result, "amend final review result").review);
  }

  async listSeasonActivities(season: Season, links?: SeasonQuestLink[]): Promise<SeasonActivity[]> {
    if (!season.startedAt) return [];
    const resolvedLinks = links ?? await this.listLinks(season.id);
    const questIds = resolvedLinks.map((link) => link.questId);
    if (questIds.length === 0) return [];

    const effectiveEnd = season.endedAt ?? new Date().toISOString();
    const { data, error } = await this.db
      .from("activities")
      .select("id, quest_id, title, activity_type, status, created_at")
      .eq("user_id", this.userId)
      .in("quest_id", questIds)
      .gte("created_at", season.startedAt)
      .lte("created_at", effectiveEnd)
      .order("created_at", { ascending: false });
    throwIfError(error, "Failed to derive season activities");
    return (data ?? []).map(mapActivity);
  }

  async reviewProposal(
    proposalId: string,
    decision: ProposalDecision,
    reviewRequestIdempotencyKey: string,
    editedPayload?: JsonRecord | null,
    rejectionReason?: string | null,
  ): Promise<unknown> {
    return this.rpc("rpc_review_outer_loop_proposal", {
      p_proposal_id: proposalId,
      p_decision: decision,
      p_edited_payload: editedPayload ?? null,
      p_rejection_reason: rejectionReason ?? null,
      p_review_request_idempotency_key: reviewRequestIdempotencyKey,
    });
  }

  private async rpc(name: string, args: JsonRecord): Promise<unknown> {
    const { data, error } = await this.db.rpc(name, args);
    throwIfError(error, `RPC ${name} failed`);
    return data;
  }
}
