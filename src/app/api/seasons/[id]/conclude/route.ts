import { NextResponse } from "next/server";
import { phase8BErrorResponse, readJsonObject, requireNonBlankString, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import type { FinalReviewPayload } from "@/lib/outer-loop/types";

const TERMINAL_STATUSES = ["COMPLETED", "ENDED_EARLY", "ABANDONED"] as const;

function parseFinalReview(value: unknown): FinalReviewPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MISSING_FINAL_REVIEW");
  }
  const review = value as Record<string, unknown>;
  return {
    periodStart: requireNonBlankString(review.periodStart, "finalReview.periodStart"),
    periodEnd: requireNonBlankString(review.periodEnd, "finalReview.periodEnd"),
    objectiveSummary: review.objectiveSummary ?? {},
    qualitativeReflection: requireNonBlankString(review.qualitativeReflection, "finalReview.qualitativeReflection"),
    criteriaEvaluation: review.criteriaEvaluation ?? [],
    tacticalAdjustments: typeof review.tacticalAdjustments === "string" ? review.tacticalAdjustments : null,
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    const targetStatus = body.targetStatus;
    if (typeof targetStatus !== "string" || !TERMINAL_STATUSES.includes(targetStatus as (typeof TERMINAL_STATUSES)[number])) {
      return NextResponse.json({ error: "targetStatus must be COMPLETED, ENDED_EARLY, or ABANDONED", code: "INVALID_TARGET_STATUS" }, { status: 400 });
    }

    const needsReview = targetStatus === "COMPLETED" || targetStatus === "ENDED_EARLY";
    const result = await repo.concludeSeason(id, {
      targetStatus: targetStatus as "COMPLETED" | "ENDED_EARLY" | "ABANDONED",
      finalReview: needsReview ? parseFinalReview(body.finalReview) : null,
      finalReviewCommitKey: needsReview ? requireUuid(body.finalReviewCommitKey, "finalReviewCommitKey") : null,
      abandonmentReason: targetStatus === "ABANDONED"
        ? requireNonBlankString(body.abandonmentReason, "abandonmentReason")
        : null,
      requestIdempotencyKey: requireNonBlankString(body.requestIdempotencyKey, "requestIdempotencyKey"),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to conclude season");
  }
}
