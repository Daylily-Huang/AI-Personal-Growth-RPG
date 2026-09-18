import { NextResponse } from "next/server";
import { phase8BErrorResponse, readJsonObject, requireNonBlankString, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import type { FinalizeReviewInput } from "@/lib/outer-loop/types";

function parseReviewInput(body: Record<string, unknown>): FinalizeReviewInput {
  const reviewType = body.reviewType;
  if (reviewType !== "WEEKLY" && reviewType !== "AD_HOC") {
    throw new Error("INVALID_REVIEW_TYPE");
  }
  return {
    reviewType,
    periodStart: requireNonBlankString(body.periodStart, "periodStart"),
    periodEnd: requireNonBlankString(body.periodEnd, "periodEnd"),
    objectiveSummary: body.objectiveSummary ?? {},
    qualitativeReflection: requireNonBlankString(body.qualitativeReflection, "qualitativeReflection"),
    criteriaEvaluation: body.criteriaEvaluation ?? [],
    tacticalAdjustments: typeof body.tacticalAdjustments === "string" ? body.tacticalAdjustments : null,
    commitKey: requireUuid(body.commitKey, "commitKey"),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const seasonId = requireUuid(rawId, "seasonId");
    const reviews = await repo.listReviews(seasonId);
    return NextResponse.json({ reviews, count: reviews.length }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to list season reviews");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const seasonId = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    const review = await repo.finalizeReview(seasonId, parseReviewInput(body));
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to finalize season review");
  }
}
