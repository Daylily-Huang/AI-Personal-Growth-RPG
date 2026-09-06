import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { ActivityAlreadySettledError, STORE_ERROR_CODES } from "@/lib/store/errors";
import { assessActivity, AIAssessmentError } from "@/lib/ai/assess";
import { getPromptVersion } from "@/lib/ai/prompts";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const repo = await getRequestRepository();
    const activity = await repo.getActivity(id);
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Round7 (P2): fail BEFORE spending model tokens/API money/response time on
    // an Activity that can never be assessed again. (addAssessment still throws
    // as defense-in-depth, but the cheap guard lives here first.)
    if (activity.status === "confirmed") {
      return NextResponse.json(
        {
          error: `Activity ${activity.id} already settled; re-assessment is disabled until a correction pipeline exists`,
          code: STORE_ERROR_CODES.activityAlreadySettled,
        },
        { status: 409 },
      );
    }

    // Primary skill / activity type are only known AFTER the proposal exists,
    // so similarity can't be computed here. 0 is honest: the real repetition
    // penalty is enforced deterministically at confirm time (see similarity.ts).
    const recentSimilarCount = 0;
    const isDemo = !isSupabaseConfigured();
    const { proposal, modelName } = await assessActivity(
      {
        rawInput: activity.rawInput,
        totalMinutes: activity.totalMinutes,
        effectiveMinutes: activity.effectiveMinutes,
        recentSimilarCount,
        activeMainQuest: null,
      },
      { allowDemoFallback: isDemo }
    );

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName,
      promptVersion: getPromptVersion(),
    });

    return NextResponse.json({ assessment }, { status: 200 });
  } catch (error) {
    if (error instanceof ActivityAlreadySettledError) {
      // Round6: a confirmed Activity yields one original settlement; no zombie
      // pending revisions until a correction pipeline exists.
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }
    if (error instanceof AIAssessmentError) {
      // P1-02: Retain Activity as pending_assessment; return retryable error without writing fake assessment
      return NextResponse.json(
        { error: error.message, code: error.code, retryable: error.retryable },
        { status: 502 },
      );
    }
    console.error("Failed to assess activity", error);
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to assess activity" }, { status: 500 });
  }
}
