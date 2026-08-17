import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store/demo-db";
import { ActivityAlreadySettledError } from "@/lib/store/demo-repository";
import { assessActivity } from "@/lib/ai/assess";
import { getPromptVersion } from "@/lib/ai/prompts";
import { AI_MODEL_NAME } from "@/lib/ai/config";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const repo = getRepository();
    const activity = await repo.getActivity(id);
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Primary skill / activity type are only known AFTER the proposal exists,
    // so similarity can't be computed here. 0 is honest: the real repetition
    // penalty is enforced deterministically at confirm time (see similarity.ts).
    const recentSimilarCount = 0;
    const proposal = await assessActivity({
      rawInput: activity.rawInput,
      totalMinutes: activity.totalMinutes,
      effectiveMinutes: activity.effectiveMinutes,
      recentSimilarCount,
      activeMainQuest: null,
    });

    const assessment = await repo.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: AI_MODEL_NAME,
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
    console.error("Failed to assess activity", error);
    return NextResponse.json({ error: "Failed to assess activity" }, { status: 500 });
  }
}
