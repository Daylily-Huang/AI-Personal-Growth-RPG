import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { ActivityAlreadySettledError, STORE_ERROR_CODES } from "@/lib/store/errors";
import { assessActivity, AIAssessmentError } from "@/lib/ai/assess";
import { getPromptVersion } from "@/lib/ai/prompts";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AssessmentContextError, validateAssessmentContextSnapshot } from "@/lib/ai/assessment-context";
// BEGIN PROPOSAL_FACT_EDIT_LEGACY_IMPORT
import { isProposalFactEditConflict } from "@/lib/proposal-edit/repository";
import { ProposalEditError } from "@/lib/proposal-edit/types";
// END PROPOSAL_FACT_EDIT_LEGACY_IMPORT

const response = (body: unknown, status: number) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
});

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const isDemo = !isSupabaseConfigured();
  try {
    const { id } = await ctx.params;
    const repo = await getRequestRepository();
    const activity = await repo.getActivity(id);
    if (!activity) {
      return response({ error: "Activity not found" }, 404);
    }

    // Round7 (P2): fail BEFORE spending model tokens/API money/response time on
    // an Activity that can never be assessed again. (addAssessment still throws
    // as defense-in-depth, but the cheap guard lives here first.)
    if (activity.status === "confirmed") {
      return response(
        {
          error: `Activity ${activity.id} already settled; re-assessment is disabled until a correction pipeline exists`,
          code: STORE_ERROR_CODES.activityAlreadySettled,
        },
        409,
      );
    }

    // BEGIN PROPOSAL_FACT_EDIT_LEGACY_PREFLIGHT
    if (!isDemo) {
      if (!repo.hasProposalFactEdit) throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE");
      if (await repo.hasProposalFactEdit(activity.id)) throw new ProposalEditError("PROPOSAL_EDIT_CONFLICT");
    }
    // END PROPOSAL_FACT_EDIT_LEGACY_PREFLIGHT
    // Primary skill / activity type are only known AFTER the proposal exists,
    // so similarity can't be computed here. 0 is honest: the real repetition
    // penalty is enforced deterministically at confirm time (see similarity.ts).
    const recentSimilarCount = 0;
    let authenticatedSnapshot;
    if (!isDemo) {
      if (!repo.getAssessmentContext) throw new AssessmentContextError();
      authenticatedSnapshot = validateAssessmentContextSnapshot(await repo.getAssessmentContext(activity.id));
      if (authenticatedSnapshot.activityId !== activity.id || authenticatedSnapshot.rawInput !== activity.rawInput
        || authenticatedSnapshot.context.rulesVersion !== activity.rulesVersion) throw new AssessmentContextError();
    }
    const { proposal, modelName } = await assessActivity(
      {
        rawInput: activity.rawInput,
        totalMinutes: activity.totalMinutes,
        effectiveMinutes: activity.effectiveMinutes,
        recentSimilarCount,
        activeMainQuest: null,
        ...(authenticatedSnapshot ? { activityId: activity.id, authenticatedSnapshot } : {}),
      },
      { allowDemoFallback: isDemo }
    );

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName,
      promptVersion: getPromptVersion(authenticatedSnapshot),
    });

    return response({ assessment }, 200);
  } catch (error) {
    // BEGIN PROPOSAL_FACT_EDIT_LEGACY_CONFLICT
    if (isProposalFactEditConflict(error)) return response({ error: "请使用修正事实入口重新评估；先核实已有重评请求", code: "PROPOSAL_EDIT_CONFLICT" }, 409);
    // END PROPOSAL_FACT_EDIT_LEGACY_CONFLICT
    if (error instanceof ActivityAlreadySettledError) {
      // Round6: a confirmed Activity yields one original settlement; no zombie
      // pending revisions until a correction pipeline exists.
      return response(
        { error: isDemo ? error.message : "Activity already settled; re-assessment is disabled", code: error.code },
        409,
      );
    }
    if (error instanceof AIAssessmentError) {
      // P1-02: Retain Activity as pending_assessment; return retryable error without writing fake assessment
      return response(
        { error: isDemo ? error.message : "AI assessment is unavailable; please retry", code: error.code, retryable: error.retryable },
        502,
      );
    }
    if (error instanceof AssessmentContextError) return response({ error: error.message, code: error.code, retryable: true }, 500);
    if (isDemo) console.error("Failed to assess activity", error);
    if (error instanceof AuthRequiredError) {
      return response({ error: "An authenticated Supabase session is required" }, 401);
    }
    return response({ error: "Failed to assess activity" }, 500);
  }
}
