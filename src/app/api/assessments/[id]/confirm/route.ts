import { NextResponse } from "next/server";
import { confirmAssessment } from "@/lib/store/demo-db";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = confirmAssessment(id);

    if (!result.ok) {
      const status = result.reason === "not_found" || result.reason === "activity_not_found" ? 404 : 409;
      return NextResponse.json({ error: result.reason, assessment: result.assessment }, { status });
    }

    return NextResponse.json({ transaction: result.transaction, assessment: result.assessment }, { status: 200 });
  } catch (error) {
    console.error("Failed to confirm assessment", error);
    return NextResponse.json({ error: "Failed to confirm assessment" }, { status: 500 });
  }
}
