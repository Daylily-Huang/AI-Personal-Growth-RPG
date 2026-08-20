import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { SettlementService } from "@/lib/store/settlement.service";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    // Stage2-B: resolve the request-scoped repository (fail-closed). When
    // Supabase is configured the settlement goes through the authoritative
    // settle_activity RPC; otherwise it runs on the Demo repository.
    const repo = await getRequestRepository();
    const result = await new SettlementService(repo).confirmAssessment(id);

    if (!result.ok) {
      const status = result.reason === "not_found" || result.reason === "activity_not_found" ? 404 : 409;
      return NextResponse.json({ error: result.reason, assessment: result.assessment }, { status });
    }

    return NextResponse.json(
      {
        transaction: result.transaction,
        assessment: result.assessment,
        masteryVerification: result.masteryVerification,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to confirm assessment", error);
    return NextResponse.json({ error: "Failed to confirm assessment" }, { status: 500 });
  }
}
