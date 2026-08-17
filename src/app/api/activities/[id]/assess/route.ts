import { NextResponse } from "next/server";
import { getActivity, createAssessment, getRecentSimilarCount } from "@/lib/store/demo-db";
import { assessActivity } from "@/lib/ai/assess";
import { getPromptVersion } from "@/lib/ai/prompts";
import { AI_MODEL_NAME } from "@/lib/ai/config";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const activity = getActivity(id);
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const recentSimilarCount = getRecentSimilarCount();
    const proposal = await assessActivity({
      rawInput: activity.rawInput,
      totalMinutes: activity.totalMinutes,
      effectiveMinutes: activity.effectiveMinutes,
      recentSimilarCount,
      activeMainQuest: null,
    });

    const assessment = createAssessment({
      activityId: activity.id,
      proposal,
      modelName: AI_MODEL_NAME,
      promptVersion: getPromptVersion(),
    });

    return NextResponse.json({ assessment }, { status: 200 });
  } catch (error) {
    console.error("Failed to assess activity", error);
    return NextResponse.json({ error: "Failed to assess activity" }, { status: 500 });
  }
}
