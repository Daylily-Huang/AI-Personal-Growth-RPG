import { NextResponse } from "next/server";
import { phase8BErrorResponse, readJsonObject, requireNonBlankString, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const seasonId = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    const reviewBody = body.review;
    if (!reviewBody || typeof reviewBody !== "object" || Array.isArray(reviewBody)) {
      return NextResponse.json({ error: "review must be an object", code: "INVALID_INPUT" }, { status: 400 });
    }
    const review = reviewBody as Record<string, unknown>;
    const amended = await repo.amendFinalReview(seasonId, {
      review: {
        periodStart: requireNonBlankString(review.periodStart, "review.periodStart"),
        periodEnd: requireNonBlankString(review.periodEnd, "review.periodEnd"),
        objectiveSummary: review.objectiveSummary ?? {},
        qualitativeReflection: requireNonBlankString(review.qualitativeReflection, "review.qualitativeReflection"),
        criteriaEvaluation: review.criteriaEvaluation ?? [],
        tacticalAdjustments: typeof review.tacticalAdjustments === "string" ? review.tacticalAdjustments : null,
      },
      amendmentReason: requireNonBlankString(body.amendmentReason, "amendmentReason"),
      commitKey: requireUuid(body.commitKey, "commitKey"),
      requestIdempotencyKey: requireNonBlankString(body.requestIdempotencyKey, "requestIdempotencyKey"),
    });
    return NextResponse.json({ review: amended }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to amend final season review");
  }
}
